# Zero-Downtime Rolling Deployment Blueprint
## Sovereign FX Trading Bot (NEXUS Engine)

This document details the architectural blueprint and operational sequence for deploying updates to the `server.ts` core engine with **absolute zero downtime** and **perfect continuity of safety layers**.

---

## 1. Architectural Principles

In high-frequency quantitative systems, dropping connections or freezing execution during a deployment introduces severe systemic risk. If a container stops abruptly:
* Open leveraged positions cannot be monitored or evolved.
* Slippage or stop-loss mechanisms fail to fire.
* Incoming order fill confirmations from OANDA or other brokers are missed.

To eliminate this gap, the NEXUS system employs a **Stateless-Restart-Safe Architecture** coupled with **Graceful Shutdown Handover**.

```
  [Traffic Router]
         |
         +-------> [Old Container (Version A)] --(SIGTERM)--> [Blocks mutates, drains requests, flushes state to DB]
         |                                                                      |
         | (Swaps routing when ready)                                            v [Handover State]
         |                                                                 [Postgres DB]
         v                                                                      ^
  [New Container (Version B)] --(/api/ready OK)---------------------------------+ [Restores active positions]
```

### Key Pillars:
1. **Durable Database-Anchored State**: No runtime trade state (`demoLivePositions`, `realLivePositions`, `liveAccountStats`, `safetyState`) is held exclusively in volatile memory. Every state change is serialized and persisted to PostgreSQL (under `runtime_state`).
2. **SIGTERM/SIGINT Orchestration**: Upon receiving a termination signal, the active process shifts to a stand-down mode, finishes in-flight requests, flushes state, and closes sockets cleanly.
3. **Passive Sentinel Safety Watchdog**: The independent `watchdog.ts` process tracks the database state. When the old engine initiates a graceful shutdown, it flags this in the database, instructing the Watchdog to stand down rather than triggering false-positive emergencies or circuit breaks.
4. **Health Gating `/api/ready`**: The new container remains offline to load balancer traffic until it has successfully pulled the database state, synchronized clocks, verified microservices, and booted nominal.

---

## 2. The Graceful Handover Sequence

When a new version is pushed, the rolling deployment follows this strict sequence:

```
[ Step 1: Boot Green (B) ]  ->  [ Step 2: Poll /api/ready ]  ->  [ Step 3: Swap Router ]  ->  [ Step 4: Terminate Blue (A) ]
```

### Stage A: Booting the New Engine (Version B)
1. The orchestrator (Kubernetes, AWS ECS, Docker-Compose, or PM2) spins up the new container **alongside** the old container.
2. The new engine starts up and connects to the PostgreSQL database.
3. It calls `loadLiveTradingStateFromDb()`, restoring all active positions, account metrics, and the safety state (Safe Mode / Silent Lock toggles) from Postgres.
4. It initializes background processes (APEX DRL Microservice, sentinel Watchdog) and NTP clock synchronizations.
5. Once all initializations are 100% complete, `/api/ready` begins returning `200 OK`.

### Stage B: Routing Cutover & Graceful Stand-down of the Old Engine (Version A)
1. The load balancer detects that the new container is healthy via the `/api/ready` endpoint.
2. The routing layer instantly redirects all future incoming traffic to the new container.
3. The orchestrator sends a `SIGTERM` signal to the old container (Version A).
4. **Version A handles `SIGTERM`:**
   * It immediately flips its internal `isShuttingDown` flag to `true`.
   * It creates `/tmp/graceful_shutdown.flag` and flags `"graceful_shutdown" = true` in Postgres to instruct the independent Sentinel Watchdog to **stand down** rather than alerting.
   * It rejects any new state-mutating requests (POST, PUT, DELETE) with a `503 Service Unavailable` response, directing clients to retry immediately against the new instance.
   * It tracks and waits for any **active, in-flight requests** to drain completely.
   * It flushes a final, absolute snapshot of positions and safety state to Postgres under `live_trading_state`.
   * It logs a clean handover record to the `deployment_history` audit table.
   * It closes open database connections and stops HTTP server sockets.
   * It exits gracefully with code `0`.

---

## 3. Operational Guarantees

* **Zero Position Loss**: Since active positions are retrieved asynchronously from the DB on startup, Version B seamlessly picks up right where Version A left off.
* **No Safety Circuit Trips**: The Sentinel Watchdog monitors the `graceful_shutdown` flag. It knows not to trigger Plan B failovers because the old server explicitly marked its exit as a clean system handover.
* **Continuous Safety Polling**: Because Version B's background safety loops are fully active before Version A terminates, there is **never a single second** where active positions are left unmonitored.
* **Atomic Version Handover**: The `deployment_history` table records the handover parameters, ensuring perfect auditability of transitions across versions.
