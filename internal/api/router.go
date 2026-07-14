package api

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func SetupRouter(h *Handler) *gin.Engine {
	// Set release mode if not in development
	if h.Cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Implement Structured Request Logging & Recovery Middlewares
	r.Use(gin.Recovery())
	r.Use(LoggerMiddleware())
	r.Use(CORSMiddleware())
	r.Use(TrackActiveRequests())

		// Public Health endpoints
	r.GET("/api/health", h.HealthCheck)
	r.GET("/api/v1/health", h.HealthCheck)
	r.GET("/api/ready", h.ReadyCheck)

	// Public safety status & heartbeat
	r.GET("/api/safety/state", h.GetSafetyState)
	r.GET("/api/safety/heartbeat", h.GetSafetyHeartbeat)

	// Public security endpoints (used to check status)
	r.GET("/api/security/info", h.GetSecurityInfo)

	// Protected Mutating endpoints with IP Whitelisting Validation
	protected := r.Group("/")
	protected.Use(h.CheckIPAllowlist())
	{
		// Broker Connections
		protected.GET("/api/brokers/connections", h.GetBrokerConnections)
		protected.POST("/api/brokers/connect", h.ConnectBroker)
		protected.POST("/api/brokers/disconnect", h.DisconnectBroker)

		// Security Key Rotate & Allowlist Updates
		protected.POST("/api/security/rotate", h.RotateSecurityKey)
		protected.POST("/api/security/allowlist", h.UpdateIPWhitelist)

		// Strategies Config
		protected.GET("/api/strategies/config", h.GetStrategiesConfig)
		protected.POST("/api/strategies/config", h.UpdateStrategyConfig)

		// Demo Live Observation Period Runs
		protected.GET("/api/demo-live/runs", h.GetDemoLiveRuns)
		protected.POST("/api/demo-live/runs", h.CreateDemoLiveRun)
		protected.GET("/api/demo-live/performance", h.GetDemoLivePerformance)

		// Safety & Control
		protected.POST("/api/safety/config", h.UpdateSafetyConfig)
		protected.POST("/api/safety/clear-notifications", h.ClearSafetyNotifications)
		protected.POST("/api/safety/test-run", h.RunSafetyTest)

		protected.POST("/api/control/halt", h.ManualHalt)
		protected.POST("/api/v1/control/halt", h.ManualHalt)
		protected.POST("/api/control/resume", h.ManualResume)
		protected.POST("/api/v1/control/resume", h.ManualResume)
	}

	return r
}

func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		clientIP := c.ClientIP()

		log.Printf("[HTTP] %d | %s %s%s | IP: %s | Latency: %v",
			status, c.Request.Method, path,
			func() string {
				if query != "" {
					return "?" + query
				}
				return ""
			}(),
			clientIP, latency,
		)
	}
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Mutate-Key")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
