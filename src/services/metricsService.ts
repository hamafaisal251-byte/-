import client from "prom-client";

client.collectDefaultMetrics({ register: client.register });

export const promHttpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of processed HTTP requests.",
  labelNames: ["method", "endpoint", "status"]
});

export const promHttpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds.",
  labelNames: ["method", "endpoint"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

export const promHttpErrorsTotal = new client.Counter({
  name: "http_requests_errors_total",
  help: "Total number of HTTP server errors.",
  labelNames: ["endpoint", "status"]
});

export const promTradesExecutedTotal = new client.Counter({
  name: "trades_executed_total",
  help: "Total number of executed trades across all brokers.",
  labelNames: ["broker", "symbol", "side", "outcome"]
});

export const promPortfolioDrawdownPct = new client.Gauge({
  name: "portfolio_drawdown_pct",
  help: "Current portfolio drawdown percentage."
});

export const promPortfolioVarUSD = new client.Gauge({
  name: "portfolio_var_usd",
  help: "Current Value-at-Risk (99% 1-day VaR) in USD."
});

export const promPortfolioSharpeRatio = new client.Gauge({
  name: "portfolio_sharpe_ratio",
  help: "Current annualized portfolio Sharpe ratio."
});

export const promSilentLockTriggersTotal = new client.Counter({
  name: "silent_lock_triggers_total",
  help: "Total count of Silent Lock triggers."
});

export const promEmergencyHaltTriggersTotal = new client.Counter({
  name: "emergency_halt_triggers_total",
  help: "Total count of Emergency Halt / Safe Mode triggers."
});

export const promDrlTrainingCycleDurationSeconds = new client.Gauge({
  name: "drl_training_cycle_duration_seconds",
  help: "Last recorded DRL training cycle duration in seconds."
});

export const promDbActiveConnections = new client.Gauge({
  name: "db_pool_active_connections",
  help: "Current active database connections in pool."
});

export const promDbIdleConnections = new client.Gauge({
  name: "db_pool_idle_connections",
  help: "Current idle database connections in pool."
});

export const promDbMaxConnections = new client.Gauge({
  name: "db_pool_max_connections",
  help: "Maximum configured database pool size."
});

export { client as prometheusClient };
