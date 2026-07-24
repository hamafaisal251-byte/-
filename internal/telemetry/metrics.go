package telemetry

import (
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

type MetricsCollector struct {
	mu                       sync.RWMutex
	httpRequestsTotal        map[string]uint64
	httpErrorsTotal          map[string]uint64
	tradesExecutedTotal      map[string]uint64
	drlTrainingDurationSec   float64
	dbActiveConnections      int
	dbMaxConnections         int
	dbIdleConnections        int
	requestLatencySumSec     float64
	requestLatencyCount      uint64
}

var GlobalMetrics = &MetricsCollector{
	httpRequestsTotal:   make(map[string]uint64),
	httpErrorsTotal:     make(map[string]uint64),
	tradesExecutedTotal: make(map[string]uint64),
	dbMaxConnections:    20,
}

func (m *MetricsCollector) RecordHTTPRequest(method, endpoint string, statusCode int, durationSec float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := fmt.Sprintf(`method="%s",endpoint="%s",status="%d"`, method, endpoint, statusCode)
	m.httpRequestsTotal[key]++

	if statusCode >= 500 {
		errKey := fmt.Sprintf(`endpoint="%s"`, endpoint)
		m.httpErrorsTotal[errKey]++
	}

	m.requestLatencySumSec += durationSec
	atomic.AddUint64(&m.requestLatencyCount, 1)
}

func (m *MetricsCollector) RecordTradeExecuted(broker, symbol, side string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := fmt.Sprintf(`broker="%s",symbol="%s",side="%s"`, broker, symbol, side)
	m.tradesExecutedTotal[key]++
}

func (m *MetricsCollector) SetDRLTrainingDuration(sec float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.drlTrainingDurationSec = sec
}

func (m *MetricsCollector) SetDBPoolStats(active, idle, max int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.dbActiveConnections = active
	m.dbIdleConnections = idle
	m.dbMaxConnections = max
}

func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start).Seconds()

		endpoint := c.FullPath()
		if endpoint == "" {
			endpoint = "unknown"
		}

		GlobalMetrics.RecordHTTPRequest(c.Request.Method, endpoint, c.Writer.Status(), duration)
	}
}

func ServePrometheusMetrics(c *gin.Context) {
	GlobalMetrics.mu.RLock()
	defer GlobalMetrics.mu.RUnlock()

	res := "# HELP http_requests_total Total number of processed HTTP requests.\n"
	res += "# TYPE http_requests_total counter\n"
	for labels, count := range GlobalMetrics.httpRequestsTotal {
		res += fmt.Sprintf("http_requests_total{%s} %d\n", labels, count)
	}

	res += "\n# HELP http_requests_errors_total Total number of HTTP 5xx server errors.\n"
	res += "# TYPE http_requests_errors_total counter\n"
	for labels, count := range GlobalMetrics.httpErrorsTotal {
		res += fmt.Sprintf("http_requests_errors_total{%s} %d\n", labels, count)
	}

	res += "\n# HELP trades_executed_total Total number of executed trades across all brokers.\n"
	res += "# TYPE trades_executed_total counter\n"
	for labels, count := range GlobalMetrics.tradesExecutedTotal {
		res += fmt.Sprintf("trades_executed_total{%s} %d\n", labels, count)
	}

	res += "\n# HELP drl_training_cycle_duration_seconds Last recorded DRL training cycle duration in seconds.\n"
	res += "# TYPE drl_training_cycle_duration_seconds gauge\n"
	res += fmt.Sprintf("drl_training_cycle_duration_seconds %.4f\n", GlobalMetrics.drlTrainingDurationSec)

	res += "\n# HELP db_pool_active_connections Current active database connections in pool.\n"
	res += "# TYPE db_pool_active_connections gauge\n"
	res += fmt.Sprintf("db_pool_active_connections %d\n", GlobalMetrics.dbActiveConnections)

	res += "\n# HELP db_pool_idle_connections Current idle database connections in pool.\n"
	res += "# TYPE db_pool_idle_connections gauge\n"
	res += fmt.Sprintf("db_pool_idle_connections %d\n", GlobalMetrics.dbIdleConnections)

	res += "\n# HELP db_pool_max_connections Maximum configured database pool size.\n"
	res += "# TYPE db_pool_max_connections gauge\n"
	res += fmt.Sprintf("db_pool_max_connections %d\n", GlobalMetrics.dbMaxConnections)

	c.Data(http.StatusOK, "text/plain; version=0.0.4; charset=utf-8", []byte(res))
}
