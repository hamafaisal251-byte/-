# Sovereign Algorithmic FX Trading Engine (NEXUS Proda)

Sovereign FX is a institutional-grade, multi-tiered algorithmic Forex trading platform engineered for ultra-low latency execution, deep reinforcement learning (PPO) ensemble decisioning, FIX protocol connectivity, and safety-critical execution controls.

---

## 🏗️ Architecture Overview

The platform uses a hybrid microservice architecture designed for fault resilience, strict risk boundaries, and mathematical execution precision:

```
                  +-----------------------------------+
                  |   React + Vite Frontend Client    |
                  |     (TypeScript / Tailwind)       |
                  +-----------------+-----------------+
                                    |
                                    v
+-----------------------------------+-----------------------------------+
|               Node.js / Express Container Ingress (Port 3000)          |
|    - Proxy API Routes & Static SPA Host                                |
|    - Prometheus Metrics Exporter (/metrics)                            |
|    - OpenAPI / Swagger UI Specification (/swagger/index.html)          |
|    - Real-Time Risk State Synchronization & Safety Backstop            |
+-----------------+---------------------------------+-------------------+
                  |                                 |
                  v                                 v
+-----------------+-----------------+   +-----------+-------------------+
|  Go High-Performance API Core     |   |  Python DRL PPO Microservice      |
|  - FIX Protocol Engine            |   |  - 5-Member Diversity Ensemble    |
|  - Latency Arbitrage Monitor      |   |  - Self-Attention Sequence Model  |
|  - PostgreSQL Pool & Storage      |   |  - Standalone FastAPI/HTTP        |
+-----------------+-----------------+   +-----------------------------------+
                  |
                  v
+-----------------+-----------------------------------------------------+
|                     Persistence & Cache Tier                          |
|  - PostgreSQL 16 (Relational Historical & Audit Storage)               |
|  - Redis 7 (In-Memory Key-Value Caching & Lock Manager)                |
+-----------------------------------------------------------------------+
```

### Core Components
1. **Express & Go Core (`server.ts` & `internal/api/`)**: High-throughput REST API handlers, IP allowlist firewall, and trade execution management.
2. **Safety Backstop Engine (`internal/safety/`)**: Independent circuit-breaker monitoring, Silent Lock triggers, and Drawdown Limit enforcement.
3. **PPO DRL Ensemble (`drl_service.py`)**: 5-member neural network ensemble using Proximal Policy Optimization with self-attention layers and layer normalization.
4. **Telemetry & Observability**: Sentry exception tracking with credential scrubbing, Prometheus operational metrics exposition (`/metrics`), and Grafana dashboard visualization.

---

## 🚀 Quick Start & Setup

### Prerequisites
- Docker & Docker Compose (`docker-compose` v2+)
- Node.js 18+ and npm (for local frontend development)

### 1. Environment Configuration
Copy `.env.example` to `.env` and populate your environment variables:
```bash
cp .env.example .env
```

Key environment variables:
- `SENTRY_DSN`: (Optional) Your Sentry DSN for Go, Node, and Python error reporting.
- `MASTER_ENCRYPTION_KEY`: 32-byte secret used to encrypt/decrypt broker credentials via AES-256 GCM.
- `API_MUTATE_KEY`: Authorization bearer token required for mutating control API endpoints.
- `DATABASE_URL`: PostgreSQL connection URL (`postgresql://postgres:postgres@postgres:5432/sovereign_db`).
- `REDIS_URL`: Redis connection URL (`redis://redis:6379`).

### 2. Launch Stack via Docker Compose
Start all services (PostgreSQL, Redis, Backend, Prometheus, Grafana):
```bash
docker-compose up -d --build
```

Services will be accessible at:
- **Web App & API Ingress**: `http://localhost:3000`
- **Swagger API Documentation**: `http://localhost:3000/swagger/index.html` (or `/api/docs`)
- **Prometheus Metrics**: `http://localhost:3000/metrics`
- **Prometheus Server**: `http://localhost:9090`
- **Grafana Dashboards**: `http://localhost:3001` (Default login: `admin` / `admin`)

---

## 🧪 Testing & Quality Assurance

Run the built-in linting and architectural invariant regression suite:
```bash
# Run TypeScript compilation and linter
npm run lint

# Run full production application bundle test
npm run build

# Run architectural invariant guard
./bin/regression_guard.sh
```

---

## 🛡️ Safety Architecture

The Sovereign platform implements a 3-layer execution safety model to protect capital against execution anomalies, slippage spikes, and runaway loops:

1. **Emergency Halt**: Instantly cancels open orders and blocks new order submissions upon trigger.
2. **Silent Lock**: Suspends order routing while continuing telemetry logging when drawdown limits (e.g. 5%) are approached.
3. **Protected Zones**: Automation guards strictly prevent modification or shrinking of core safety-critical files (`audit_and_repair.js`, safety backstop controllers).
