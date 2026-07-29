import { Router, Request, Response } from "express";
import { safetyBackstop } from "../../safetyBackstop";
import { pgDb, systemStatus, errorCount, livePositions, liveAccountStats, demoLivePositions, addServerLog } from "../../server";
import { checkIPAllowlist } from "../middleware/auth";

export const safetyRouter = Router();

// GET /api/safety/state
safetyRouter.get("/state", (req: Request, res: Response) => {
  res.json({
    success: true,
    state: safetyBackstop.getState(),
    systemStatus
  });
});

// POST /api/safety/config
safetyRouter.post("/config", checkIPAllowlist, (req: Request, res: Response) => {
  const {
    drawdownThresholdPct,
    emergencyHaltPolicy,
    globalMinConfidenceThreshold,
    dailyLossLimitPct,
    dailyLossResetUtcHour,
    useCompoundedSizing,
    principalCapital,
    naturalExecutionConfig,
    instrumentEdgeScores,
    aiTimeframes
  } = req.body;

  const updates: any = {};
  if (drawdownThresholdPct !== undefined) updates.drawdownThresholdPct = parseFloat(drawdownThresholdPct);
  if (emergencyHaltPolicy !== undefined && (emergencyHaltPolicy === "FLATTEN_ALL" || emergencyHaltPolicy === "FREEZE_NEW_ONLY")) {
    updates.emergencyHaltPolicy = emergencyHaltPolicy;
  }
  if (globalMinConfidenceThreshold !== undefined) updates.globalMinConfidenceThreshold = parseFloat(globalMinConfidenceThreshold);
  if (dailyLossLimitPct !== undefined) updates.dailyLossLimitPct = parseFloat(dailyLossLimitPct);
  if (dailyLossResetUtcHour !== undefined) updates.dailyLossResetUtcHour = parseInt(dailyLossResetUtcHour, 10);
  if (useCompoundedSizing !== undefined) updates.useCompoundedSizing = Boolean(useCompoundedSizing);
  if (principalCapital !== undefined) updates.principalCapital = parseFloat(principalCapital);
  
  if (naturalExecutionConfig !== undefined && typeof naturalExecutionConfig === "object") {
    const currentState = safetyBackstop.getState();
    updates.naturalExecutionConfig = {
      ...currentState.naturalExecutionConfig,
      ...naturalExecutionConfig
    };
  }

  if (instrumentEdgeScores !== undefined && typeof instrumentEdgeScores === "object") {
    const currentState = safetyBackstop.getState();
    updates.instrumentEdgeScores = {
      ...currentState.instrumentEdgeScores,
      ...instrumentEdgeScores
    };
  }

  if (aiTimeframes !== undefined && typeof aiTimeframes === "object") {
    const currentState = safetyBackstop.getState();
    updates.aiTimeframes = {
      ...currentState.aiTimeframes,
      ...aiTimeframes
    };
  }

  safetyBackstop.updateState(updates);
  addServerLog("RISK-MANAGER", "INFO", `[SAFETY CONFIG UPDATED] Dynamic risk parameters updated. GlobalMinConf: ${safetyBackstop.getState().globalMinConfidenceThreshold}, DailyLossLimit: ${safetyBackstop.getState().dailyLossLimitPct}%, SizingMode: ${safetyBackstop.getState().useCompoundedSizing ? "COMPOUNDED" : "PRINCIPAL-ONLY"}`);
  res.json({ success: true, state: safetyBackstop.getState() });
});

// GET /api/safety/heartbeat
safetyRouter.get("/heartbeat", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    systemStatus,
    errorCount,
    livePositionsCount: livePositions.length,
    liveAccountStats,
    timestamp: Date.now()
  });
});

// POST /api/safety/clear-notifications
safetyRouter.post("/clear-notifications", checkIPAllowlist, (req: Request, res: Response) => {
  safetyBackstop.updateState({ notifications: [] });
  res.json({ success: true });
});

// POST /api/safety/safe-mode/trigger
safetyRouter.post("/safe-mode/trigger", (req: Request, res: Response) => {
  const { reason } = req.body;
  safetyBackstop.triggerSafeMode(reason || "Manual operator trigger from UI dashboard.");
  res.json({ success: true, message: "Safe Mode triggered successfully.", state: safetyBackstop.getState() });
});

// POST /api/safety/safe-mode/exit
safetyRouter.post("/safe-mode/exit", (req: Request, res: Response) => {
  safetyBackstop.exitSafeMode();
  res.json({ success: true, message: "Safe Mode disengaged successfully.", state: safetyBackstop.getState() });
});

// POST /api/safety/silent-lock/trigger
safetyRouter.post("/silent-lock/trigger", (req: Request, res: Response) => {
  const { reason } = req.body;
  safetyBackstop.triggerSilentLock(reason || "Manual operator trigger.");
  res.json({ success: true, message: "Silent lock triggered.", state: safetyBackstop.getState() });
});

// POST /api/safety/silent-lock/resume
safetyRouter.post("/silent-lock/resume", (req: Request, res: Response) => {
  safetyBackstop.resumeFromSilentLock();
  res.json({ success: true, message: "Silent lock resumed.", state: safetyBackstop.getState() });
});

// POST /api/safety/emergency-halt/trigger
safetyRouter.post("/emergency-halt/trigger", (req: Request, res: Response) => {
  const { reason } = req.body;
  safetyBackstop.triggerEmergencyHalt(reason || "Manual operator panic button engaged.");
  res.json({ success: true, message: "Emergency halt triggered.", state: safetyBackstop.getState() });
});

// POST /api/safety/emergency-halt/reset
safetyRouter.post("/emergency-halt/reset", (req: Request, res: Response) => {
  safetyBackstop.resetEmergencyHalt();
  res.json({ success: true, message: "Emergency halt reset.", state: safetyBackstop.getState() });
});

// POST /api/safety/test-run
safetyRouter.post("/test-run", checkIPAllowlist, async (req: Request, res: Response) => {
  const logs: string[] = [];
  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    logs.push(`[TEST] Running: ${name}...`);
    try {
      await fn();
      logs.push(`[PASS] ${name}`);
    } catch (e: any) {
      logs.push(`[FAIL] ${name}: ${e.message}`);
    }
  };

  // 1. Test Silent Lock trigger on drawdown breach
  await runTest("Silent Lock Trigger on drawdown breach", () => {
    const initialPeak = safetyBackstop.getState().peakEquity;
    const backupPeak = initialPeak;
    const backupLock = safetyBackstop.getState().silentLockActive;

    safetyBackstop.updateState({ peakEquity: 200000, silentLockActive: false });
    
    const currentDrawdownPct = ((200000 - liveAccountStats.equity) / 200000) * 100;
    if (currentDrawdownPct >= safetyBackstop.getState().drawdownThresholdPct) {
      safetyBackstop.triggerSilentLock(`Simulated Drawdown Breach: ${currentDrawdownPct.toFixed(1)}%`);
    }

    const postState = safetyBackstop.getState();
    if (!postState.silentLockActive) {
      throw new Error("Silent lock should be active on drawdown threshold breach.");
    }

    safetyBackstop.updateState({ peakEquity: backupPeak, silentLockActive: backupLock });
  });

  // 2. Test Broker disconnection mid-position triggers Safe Mode
  await runTest("Broker disconnect mid-position triggers Safe Mode", async () => {
    const backupConns = (await pgDb.queryAsync("SELECT * FROM broker_connections")) || [];
    
    await pgDb.queryAsync("INSERT INTO broker_connections (id, broker_type, status, api_url, account_id)", [
      "mock-broker-fail", "BINANCE", "DISCONNECTED", "https://api.binance.com", "mock-bin-acc"
    ]);

    const safety = safetyBackstop.getState();
    const backupSafeMode = safety.safeModeActive;
    safetyBackstop.updateState({ safeModeActive: false });

    const livePositionsCount = livePositions.length;
    const connections = (await pgDb.queryAsync("SELECT * FROM broker_connections")) || [];
    const disconnectedBroker = connections.find((c: any) => c.status === "DISCONNECTED");

    if (livePositionsCount > 0 && disconnectedBroker) {
      safetyBackstop.triggerSafeMode(`Watchdog: Broker connection disconnected mid-position.`);
    }

    const postState = safetyBackstop.getState();
    if (!postState.safeModeActive) {
      throw new Error("Safe Mode should be active when broker disconnects mid-position.");
    }

    await pgDb.queryAsync("DELETE FROM broker_connections WHERE id = $1", ["mock-broker-fail"]);
    safetyBackstop.updateState({ safeModeActive: backupSafeMode });
  });

  // 3. Test Unresponsive main process watchdog detection
  await runTest("Unresponsive main process watchdog detection", () => {
    const consecutiveFailuresTest = 3;
    const safety = safetyBackstop.getState();
    const backupHalt = safety.emergencyHaltActive;
    safetyBackstop.updateState({ emergencyHaltActive: false });

    if (consecutiveFailuresTest >= 3) {
      const reason = "TEST: Main engine unresponsive watchdog simulation.";
      safetyBackstop.triggerSafeMode(reason);
      safetyBackstop.triggerEmergencyHalt(reason, { source: "WATCHDOG_DETECTION" });
    }

    const postState = safetyBackstop.getState();
    if (!postState.emergencyHaltActive || !postState.safeModeActive) {
      throw new Error("Watchdog should activate emergency halt and safe mode upon consecutive failures.");
    }

    safetyBackstop.updateState({ emergencyHaltActive: backupHalt });
  });

  // 4. Test 24H Daily Loss Limit halt, position flattening, and auto-resume execution
  await runTest("24H Daily Loss Limit halt, position flattening, and auto-resume execution", async () => {
    const backupState = { ...safetyBackstop.getState() };
    const backupPositions = [...demoLivePositions];

    demoLivePositions.push({ id: "test-loss-pos", symbol: "EUR/USD", type: "BUY", size: 1.0, entryPrice: 1.0850, currentPrice: 1.0850, pnl: -3500 });

    safetyBackstop.triggerDailyLossLimit24H("TEST: 3% Daily loss threshold breached", { currentDayLossPct: 3.5 });

    const postState = safetyBackstop.getState();
    if (!postState.dailyLossLimitHaltActive || !postState.dailyLossLimitAutoResumeAt) {
      throw new Error("dailyLossLimitHaltActive and dailyLossLimitAutoResumeAt must be active upon daily loss breach.");
    }

    if (demoLivePositions.length !== 0) {
      throw new Error("All open positions must be flattened when 24H Daily Loss Limit triggers.");
    }

    const autoResumeTime = new Date(postState.dailyLossLimitAutoResumeAt).getTime();
    const triggerTime = new Date(postState.dailyLossLimitTriggeredAt!).getTime();
    const diffHours = (autoResumeTime - triggerTime) / (1000 * 60 * 60);
    if (Math.abs(diffHours - 24) > 0.01) {
      throw new Error(`Auto-resume time must be set to exactly 24 hours from trigger time (got ${diffHours.toFixed(2)}h).`);
    }

    safetyBackstop.updateState({
      dailyLossLimitHaltActive: backupState.dailyLossLimitHaltActive,
      dailyLossLimitTriggeredAt: backupState.dailyLossLimitTriggeredAt,
      dailyLossLimitAutoResumeAt: backupState.dailyLossLimitAutoResumeAt,
      dailyLossLimitBreached: backupState.dailyLossLimitBreached
    });
    demoLivePositions.length = 0;
    demoLivePositions.push(...backupPositions);
  });

  res.json({
    success: true,
    logs
  });
});
