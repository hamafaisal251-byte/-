package telemetry

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP Metrics
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of processed HTTP requests.",
		},
		[]string{"method", "endpoint", "status"},
	)

	HTTPRequestDurationSeconds = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds.",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"method", "endpoint"},
	)

	HTTPErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_errors_total",
			Help: "Total number of HTTP server or client errors.",
		},
		[]string{"endpoint", "status"},
	)

	// Trading & Risk Metrics
	TradesExecutedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "trades_executed_total",
			Help: "Total number of executed trades across all brokers.",
		},
		[]string{"broker", "symbol", "side", "outcome"},
	)

	PortfolioDrawdownPct = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "portfolio_drawdown_pct",
			Help: "Current portfolio drawdown percentage.",
		},
	)

	PortfolioVarUSD = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "portfolio_var_usd",
			Help: "Current Value-at-Risk (99% 1-day VaR) in USD.",
		},
	)

	PortfolioSharpeRatio = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "portfolio_sharpe_ratio",
			Help: "Current annualized portfolio Sharpe ratio.",
		},
	)

	SilentLockTriggersTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "silent_lock_triggers_total",
			Help: "Total count of Silent Lock triggers.",
		},
	)

	EmergencyHaltTriggersTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "emergency_halt_triggers_total",
			Help: "Total count of Emergency Halt / Safe Mode triggers.",
		},
	)

	// DRL Metrics
	DRLTrainingCycleDurationSeconds = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "drl_training_cycle_duration_seconds",
			Help: "Last recorded DRL training cycle duration in seconds.",
		},
	)

	// DB Metrics
	DBActiveConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_pool_active_connections",
			Help: "Current active database connections in pool.",
		},
	)

	DBIdleConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_pool_idle_connections",
			Help: "Current idle database connections in pool.",
		},
	)

	DBMaxConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_pool_max_connections",
			Help: "Maximum configured database pool size.",
		},
	)
)

func init() {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDurationSeconds,
		HTTPErrorsTotal,
		TradesExecutedTotal,
		PortfolioDrawdownPct,
		PortfolioVarUSD,
		PortfolioSharpeRatio,
		SilentLockTriggersTotal,
		EmergencyHaltTriggersTotal,
		DRLTrainingCycleDurationSeconds,
		DBActiveConnections,
		DBIdleConnections,
		DBMaxConnections,
	)

	DBMaxConnections.Set(20)
}

// RecordHTTPRequest updates Prometheus HTTP metrics
func RecordHTTPRequest(method, endpoint string, statusCode int, durationSec float64) {
	statusStr := fmt.Sprintf("%d", statusCode)
	HTTPRequestsTotal.WithLabelValues(method, endpoint, statusStr).Inc()
	HTTPRequestDurationSeconds.WithLabelValues(method, endpoint).Observe(durationSec)

	if statusCode >= 400 {
		HTTPErrorsTotal.WithLabelValues(endpoint, statusStr).Inc()
	}
}

// RecordTradeExecuted records a trade execution with default outcome
func RecordTradeExecuted(broker, symbol, side string) {
	RecordTradeExecutedWithOutcome(broker, symbol, side, "EXECUTED")
}

// RecordTradeExecutedWithOutcome records a trade with explicit outcome
func RecordTradeExecutedWithOutcome(broker, symbol, side, outcome string) {
	TradesExecutedTotal.WithLabelValues(broker, symbol, side, outcome).Inc()
}

// SetPortfolioRiskMetrics updates real portfolio risk gauge values
func SetPortfolioRiskMetrics(drawdownPct, varUsd, sharpe float64) {
	PortfolioDrawdownPct.Set(drawdownPct)
	PortfolioVarUSD.Set(varUsd)
	PortfolioSharpeRatio.Set(sharpe)
}

// RecordSilentLockTrigger increments Silent Lock counter
func RecordSilentLockTrigger() {
	SilentLockTriggersTotal.Inc()
}

// RecordEmergencyHaltTrigger increments Emergency Halt counter
func RecordEmergencyHaltTrigger() {
	EmergencyHaltTriggersTotal.Inc()
}

// SetDRLTrainingDuration sets DRL training duration metric
func SetDRLTrainingDuration(sec float64) {
	DRLTrainingCycleDurationSeconds.Set(sec)
}

// SetDBPoolStats updates database connection pool gauges
func SetDBPoolStats(active, idle, max int) {
	DBActiveConnections.Set(float64(active))
	DBIdleConnections.Set(float64(idle))
	DBMaxConnections.Set(float64(max))
}

// PrometheusMiddleware returns a Gin middleware for request tracking
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start).Seconds()

		endpoint := c.FullPath()
		if endpoint == "" {
			endpoint = c.Request.URL.Path
		}

		RecordHTTPRequest(c.Request.Method, endpoint, c.Writer.Status(), duration)
	}
}

// ServePrometheusMetrics delegates to prometheus/client_golang promhttp handler
func ServePrometheusMetrics(c *gin.Context) {
	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}
