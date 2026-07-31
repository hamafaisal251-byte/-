# Sovereign FX Trading Bot — System Architecture & Developer Guide

## 1. System Overview & Dual-Service Architecture

The Sovereign FX Trading System is built on a high-throughput dual-service architecture designed for ultra-low latency execution, comprehensive risk management, and self-evolving Deep Reinforcement Learning (DRL) strategy optimization.

```
+-------------------------------------------------------------------------+
|                        Client / Dashboard / API                         |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                        Node.js Core Gateway Server                      |
|                  (Express, TypeScript, Vitest, Postgres/JSON)           |
|  - API Routing & Authentication (/src/routes/*)                         |
|  - Shared Trading & System State (/src/state/tradingState.ts)           |
|  - Postgres Engine & Fallback Persistence (/src/db/index.ts)            |
|  - DRL Model Ensemble & Inference Pipeline (/api/drl/*)                  |
|  - Pre-trade Risk & Drawdown Circuit Breaker (/api/risk/*)              |
+-------------------------------------------------------------------------+
                                    |
                     HTTP / REST & Internal Proxy
                                    |
                                    v
+-------------------------------------------------------------------------+
|                   Go High-Frequency Engine & Execution                  |
|                     (cmd/main.go / Dockerfile.go)                       |
|  - Low-Latency FIX Protocol Connectivity (/api/fix/*)                   |
|  - Broker Socket Streams & Order Routing                                |
|  - Microsecond Tick Processing & Order Book Synchronization             |
+-------------------------------------------------------------------------+
```

### Communication Flow
- **Node.js Core Gateway**: Listens on port `3000` (or configured port). Handles incoming web traffic, REST APIs, safety backstops, DRL predictions, and system telemetry.
- **Go Engine**: Specialized process compiled via `Dockerfile.go`. Manages high-frequency FIX socket channels and direct exchange APIs. Node proxies execution requests to the Go microservice using internal REST/FIX client adapters.

---

## 2. Route Directory & URL Prefix Mapping (`src/routes/`)

All modular API endpoints are decoupled into `src/routes/` and mounted in `server.ts`:

| Route File | URL Prefix | Description / Domain Responsibilities |
| :--- | :--- | :--- |
| `analyticsRoutes.ts` | `/api/analytics` | Portfolio performance, trade metrics, and PnL reporting |
| `arbitrageRoutes.ts` | `/api/arbitrage` | Tri-angular & cross-exchange arbitrage monitoring & compliance toggle |
| `brokerRoutes.ts` | `/api/broker` | Broker connectivity, account balances, and order placement |
| `customConnectorsRoutes.ts` | `/api/connectors` | Custom broker/exchange API adapter registration |
| `drlRoutes.ts` | `/api/drl` | DRL model inference, training triggers, recalibration, & telemetry |
| `evolutionRoutes.ts` | `/api/evolution` | Candidate strategy promotion, C++ reward module AST/lexical audits |
| `fixRoutes.ts` | `/api/fix` | FIX engine status, logon/logout control, & raw session telemetry |
| `healthRoutes.ts` | `/api/health` | System health checks, liveness, and readiness probes |
| `microstructureRoutes.ts` | `/api/microstructure` | Order book depth, L2/L3 tick analytics, & spread tracking |
| `miscRoutes.ts` | `/api` | Base system endpoints (`/system`, `/live-training`, `/ready`, `/docs`, `/sovereign-*`) |
| `newsRoutes.ts` | `/api/news` | News sentiment aggregation & high-impact event filter |
| `notificationsRoutes.ts` | `/api/notifications` | Telegram notifier dispatch & log management |
| `pipelineRoutes.ts` | `/api/pipeline` | Real-time WebSocket tick stream management |
| `positionRoutes.ts` | `/api/positions` | Active trade position management, stop-loss, & take-profit |
| `riskRoutes.ts` | `/api/risk` | Pre-trade drawdown backstop, VaR calculation, & symbol exposure limits |
| `safetyRoutes.ts` | `/api/safety` | Circuit breakers, emergency panic halt, & safe-mode controls |
| `securityRoutes.ts` | `/api/security` | IP allowlist management & secret vault access logs |
| `strategiesRoutes.ts` | `/api/strategies` | Strategy parameters, weights, & performance toggles |
| `systemIntelligenceRoutes.ts` | `/api/system-intelligence` | Self-improvement cycle triggers & synthesis attempts |
| `valueDiscoveryRoutes.ts` | `/api/value-discovery` | Market hypothesis generation & value discovery journal |

---

## 3. Shared State & Persistence Architecture

### Shared In-Memory State (`src/state/tradingState.ts`)
- Holds live system runtime metrics, active positions, drawdown counters, candidate statuses, and safety halt flags.
- Ensures atomic, zero-latency state inspection for pre-trade safety checks across all route handlers without database overhead.

### Dual-Mode Database Engine (`src/db/index.ts`)
- Encapsulated within `PostgresEngine`.
- Primary Mode: Connects to PostgreSQL database on port 5432.
- Fallback Mode: If PostgreSQL is unreachable, automatically engages an offline JSON cache (`postgres_state.json`), ensuring seamless execution without crashing or interrupting operations during offline development and testing.

### Domain Services (`src/services/` & `/telegramNotifier.ts`)
- `telegramNotifier.ts`: Asynchronous dispatch channel for critical security alerts, drawdown breaches, and candidate promotions.
- `evolution_validator.sh`: Security-isolated dynamic scanner using Cppcheck, G++, ASan/LSan/UBSan, and Valgrind to validate C++ code before dynamic hot-reloading.

---

## 4. Local Testing & CI Pipeline

### Running Tests Locally
- **Run Full Test Suite**:
  ```bash
  npm test
  ```
- **Run Code Linter**:
  ```bash
  npm run lint
  ```
- **Verify Invariants**:
  ```bash
  node scripts/verify_invariants.js
  ```
- **Test C++ Evolution Validator**:
  ```bash
  ./evolution_validator.sh test/test_clean.cpp
  ```

### Continuous Integration Pipeline (`.github/workflows/ci.yml`)
The GitHub Actions workflow executes three sequential jobs:

1. **`static-analysis-and-unit-tests`**:
   - Executes `scripts/verify_invariants.js`
   - Runs `npm run lint`
   - Executes full unit & integration test suite (`npm test`)
   - Verifies TypeScript build (`npm run build`)
   - Installs `cppcheck`, `g++`, and `valgrind`
   - Runs `evolution_validator.sh` against all 5 C++ candidate test files:
     - `test_clean.cpp`, `test_proposed.cpp`, `test_proposed_temp.cpp` (must **PASS**)
     - `test_leak.cpp`, `test_static.cpp` (must **REJECT** and fail if passed)

2. **`strategy-walk-forward-validation`**:
   - Runs HFT strategy playback and 500,000 tick simulation using `evolution_validator.sh`. Fails loudly on any compilation or runtime assertion error.

3. **`zero-downtime-deploy-precheck`**:
   - Verifies deployment assets. Fails if either `Dockerfile.node` or `Dockerfile.go` is missing.
