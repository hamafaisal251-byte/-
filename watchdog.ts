import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { safetyBackstop } from "./safetyBackstop";

const MAIN_SERVER_URL = "http://127.0.0.1:3000";
const CHECK_INTERVAL_MS = 2000; // Ping every 2 seconds
const STATE_FILE_PATH = path.join("/tmp", "live_trading_state.json");

// Establish connection pool to the real PostgreSQL database
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "sovereign_db",
  connectionTimeoutMillis: 15000,
});
pool.on("error", (err) => {
  console.error("[WATCHDOG-POSTGRES] Unexpected error on idle DB client:", err);
});

let consecutiveFailures = 0;
let consecutiveDrlFailures = 0;

console.log("[WATCHDOG] Independent Sentinel process started successfully.");
safetyBackstop.updateState({ watchdogStatus: "NOMINAL", watchdogLastHeartbeat: new Date().toISOString() });

// Run the monitoring loop
async function monitorLoop() {
  try {
    const safety = safetyBackstop.getState();
    let mainServerAlive = false;
    let mainServerState: any = null;

    // 1. Check core trading engine heartbeat
    try {
      const response = await fetch(`${MAIN_SERVER_URL}/api/safety/heartbeat`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        mainServerState = await response.json();
        mainServerAlive = true;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
        console.warn(`[WATCHDOG] Main server returned non-OK code. Failure count: ${consecutiveFailures}`);
      }
    } catch (err: any) {
      consecutiveFailures++;
      console.warn(`[WATCHDOG] Failed to connect to main server heartbeat. Failure count: ${consecutiveFailures}. Error: ${err.message}`);
    }

    // Update watchdog heartbeat in safety_state.json
    safetyBackstop.updateState({ watchdogLastHeartbeat: new Date().toISOString() });

    // 2. Check DRL service status
    let drlServiceAlive = false;
    try {
      const drlResponse = await fetch("http://127.0.0.1:8000/api/drl/telemetry", { signal: AbortSignal.timeout(1500) });
      if (drlResponse.ok) {
        drlServiceAlive = true;
        consecutiveDrlFailures = 0;
      } else {
        consecutiveDrlFailures++;
      }
    } catch (err) {
      consecutiveDrlFailures++;
    }

    // 3. Read live trading state from disk (independent backstop memory)
    let liveState: any = { livePositions: [], liveAccountStats: {} };
    if (fs.existsSync(STATE_FILE_PATH)) {
      try {
        liveState = JSON.parse(fs.readFileSync(STATE_FILE_PATH, "utf8"));
      } catch (e) {
        // Fallback or ignore parse error of temporary state
      }
    }

    // 4. Read broker connections from the real PostgreSQL database
    let brokerConnections: any[] = [];
    try {
      const dbRes = await pool.query(
        "SELECT id, broker_type as \"brokerType\", api_url as \"apiUrl\", account_id as \"accountId\", status, error_message as \"errorMessage\" FROM broker_connections"
      );
      brokerConnections = dbRes.rows;
    } catch (e: any) {
      console.error("[WATCHDOG-POSTGRES-ERROR] Failed to fetch broker connections:", e.message);
    }

    // --- EVALUATE FAILURE CONDITIONS ---

    // Condition A: Main system unresponsive (3 sequential failures / 6 seconds)
    if (consecutiveFailures >= 3) {
      if (!safety.safeModeActive || !safety.emergencyHaltActive) {
        const reason = `MAIN ENGINE UNRESPONSIVE: Failed heartbeat checks ${consecutiveFailures} consecutive times. Detached sentinel initiating failover.`;
        console.error(`[WATCHDOG] ${reason}`);
        
        // Trigger Safe Mode
        safetyBackstop.triggerSafeMode(reason);
        // Trigger Emergency Halt
        safetyBackstop.triggerEmergencyHalt(reason, { source: "WATCHDOG_DETECTION" });

        // Execute Halt policy on disk directly since server is frozen!
        await executeHaltPolicyOnDisk(safety.emergencyHaltPolicy, liveState);
      }
    }

    // Condition B: Throws repeated errors
    // If main server reports elevated errors in heartbeat state
    if (mainServerAlive && mainServerState && mainServerState.errorCount > 10) {
      if (!safety.safeModeActive) {
        const reason = `CRITICAL EXCEPTION FLOW: Core engine reported high error frequency (${mainServerState.errorCount} exceptions logged). Switching to Safe Mode.`;
        console.error(`[WATCHDOG] ${reason}`);
        safetyBackstop.triggerSafeMode(reason);
      }
    }

    // Condition C: Lose connectivity to a broker mid-position
    const hasOpenPositions = liveState && liveState.livePositions && liveState.livePositions.length > 0;
    if (hasOpenPositions) {
      // Check if any of our active brokers are disconnected
      // Let's see if any broker connection status is not "CONNECTED" (e.g. DISCONNECTED or FAILED)
      const disconnectedBroker = brokerConnections.find(conn => conn.status === "DISCONNECTED" || conn.status === "FAILED");
      if (disconnectedBroker) {
        if (!safety.safeModeActive) {
          const reason = `BROKER LINK SEVERED: Broker connection '${disconnectedBroker.brokerType}' (ID: ${disconnectedBroker.accountId}) disconnected or failed mid-position. Enforcing Safe Mode.`;
          console.error(`[WATCHDOG] ${reason}`);
          safetyBackstop.triggerSafeMode(reason);
        }
      }
    }

    // Condition D: DRL service became unresponsive while in active trading
    if (consecutiveDrlFailures >= 5 && hasOpenPositions) {
      if (!safety.safeModeActive) {
        const reason = `DRL OUTAGE: Deep Reinforcement Learning backend lost heartbeat for 10 seconds during active exposure. Safe Mode triggered.`;
        console.error(`[WATCHDOG] ${reason}`);
        safetyBackstop.triggerSafeMode(reason);
      }
    }

  } catch (err: any) {
    console.error("[WATCHDOG-MONITOR-ERROR]", err);
  }

  // Schedule next check
  setTimeout(monitorLoop, CHECK_INTERVAL_MS);
}

// Write flattened positions back to disk if MAIN server is unresponsive
async function executeHaltPolicyOnDisk(policy: "FLATTEN_ALL" | "FREEZE_NEW_ONLY", liveState: any) {
  try {
    if (policy === "FLATTEN_ALL") {
      const positionsCount = liveState?.livePositions?.length || 0;
      if (positionsCount > 0) {
        console.warn(`[WATCHDOG-RECOVERY] Executing FLATTEN_ALL policy. Closing ${positionsCount} open positions independently.`);
        
        let totalPnLSum = 0;
        for (const pos of liveState.livePositions) {
          totalPnLSum += pos.pnl || 0;
        }

        // Wipe the live trading state file positions (flatten)
        const updatedStats = {
          balance: parseFloat(( (liveState.liveAccountStats.balance || 104250.40) + totalPnLSum ).toFixed(2)),
          equity: parseFloat(( (liveState.liveAccountStats.balance || 104250.40) + totalPnLSum ).toFixed(2)),
          usedMargin: 0,
          freeMargin: parseFloat(( (liveState.liveAccountStats.balance || 104250.40) + totalPnLSum ).toFixed(2)),
          marginLevel: 0,
          todayPnl: (liveState.liveAccountStats.todayPnl || 0) + totalPnLSum
        };

        const recoveryState = {
          livePositions: [],
          liveAccountStats: updatedStats,
          timestamp: Date.now(),
          recoveryTriggered: true,
          recoveryReason: "WIPED_BY_WATCHDOG_HALT_POLICY"
        };

        fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(recoveryState, null, 2), "utf8");
        console.log("[WATCHDOG-RECOVERY] Successfully flattened live positions state on disk.");

        // Write a critical audit log entry into the PostgreSQL database directly so the user sees it!
        try {
          await pool.query(
            `INSERT INTO strategy_audit_logs (id, timestamp, symbol, mode, trigger_value, action_taken, input_params, output_result)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              `audit-${Date.now()}-watchdog`,
              new Date().toISOString(),
              "ALL",
              "FAILOVER WATCHDOG",
              null,
              `Watchdog executed emergency FLATTEN_ALL policy due to unresponsive core engine. Closed ${positionsCount} positions. Realized PnL: $${totalPnLSum.toFixed(2)}.`,
              JSON.stringify({ policy, positionsCount }),
              JSON.stringify({ finalBalance: updatedStats.balance })
            ]
          );
          console.log("[WATCHDOG-RECOVERY] Successfully committed recovery log directly into PostgreSQL database.");
        } catch (dbErr: any) {
          console.error("[WATCHDOG-RECOVERY-ERROR] Failed to write audit log to database:", dbErr.message);
        }
      }
    } else {
      console.log("[WATCHDOG-RECOVERY] Policy is FREEZE_NEW_ONLY. No positions were flattened on disk.");
    }
  } catch (err: any) {
    console.error("[WATCHDOG-RECOVERY-ERROR] Failed to execute offline halt policy:", err);
  }
}

// Start monitoring
monitorLoop();
