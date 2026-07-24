package api

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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

	// OpenAPI / Swagger Documentation
	r.GET("/swagger/doc.json", h.ServeSwaggerJSON)
	r.GET("/swagger/index.html", h.ServeSwaggerUI)
	r.GET("/swagger", h.ServeSwaggerUI)
	r.GET("/swagger/*any", h.ServeSwaggerUI)
	r.GET("/api/docs", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/swagger/index.html")
	})

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

		// AI Orchestration: Calibration
		protected.GET("/api/calibration/summary", h.GetCalibrationSummary)
		protected.POST("/api/calibration/trigger", h.TriggerCalibration)

		// AI Orchestration: Value Discovery
		protected.GET("/api/value-discovery/summary", h.GetValueDiscoverySummary)
		protected.POST("/api/value-discovery/generate", h.GenerateHypothesis)
		protected.POST("/api/value-discovery/test", h.TestHypothesis)
		protected.POST("/api/value-discovery/promote", h.PromoteHypothesis)

		// AI Orchestration: Deep Research
		protected.GET("/api/deep-research/sessions", h.GetDeepResearchSessions)
		protected.POST("/api/deep-research/run", h.RunDeepResearch)

		// AI Orchestration: Self-Improvement / Synthesis
		protected.POST("/api/synthesis/run", h.RunSelfImprovement)

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

		// STAGE 3 & 6: TRADING, FIX & ARBITRAGE SYSTEM ROUTES
		protected.GET("/api/fix/status", h.GetFIXStatus)
		protected.POST("/api/fix/connect", h.ConnectFIX)
		protected.POST("/api/fix/disconnect", h.DisconnectFIX)

		protected.GET("/api/arbitrage/state", h.GetArbitrageState)
		protected.POST("/api/arbitrage/compliance", h.UpdateArbitrageCompliance)
		protected.POST("/api/arbitrage/toggle", h.ToggleArbitrage)
		protected.POST("/api/arbitrage/set-threshold", h.SetArbitrageThreshold)
		protected.GET("/api/arbitrage/logs", h.GetArbitrageLogs)
		protected.POST("/api/arbitrage/clear", h.ClearArbitrage)

		protected.GET("/api/risk/portfolio", h.GetPortfolioRisk)

		// --- NEW PORTED GO BACKEND ENDPOINTS ---

		// News & Economic Calendar
		protected.POST("/api/news/test-connection", h.TestNewsConnection)
		protected.POST("/api/news/config", h.ConfigNews)
		protected.GET("/api/news/config", h.GetNewsConfig)
		protected.GET("/api/news/platforms", h.GetNewsPlatforms)
		protected.POST("/api/news/disconnect", h.DisconnectNews)
		protected.GET("/api/news/feed", h.GetNewsFeed)

		// Generic Connector Framework
		protected.GET("/api/custom-connectors", h.GetCustomConnectors)
		protected.POST("/api/custom-connectors", h.CreateCustomConnector)
		protected.POST("/api/custom-connectors/test", h.TestCustomConnector)
		protected.DELETE("/api/custom-connectors/:id", h.DeleteCustomConnector)

		// DRL Ensemble
		protected.GET("/api/drl/ensemble", h.GetDrlEnsemble)
		protected.GET("/api/drl/telemetry", h.GetDrlTelemetry)

		// Chrony Clock Sync Status
		protected.GET("/api/time-sync/status", h.GetTimeSyncStatus)

		// Code Pipeline
		protected.GET("/api/pipeline/prs", h.GetPipelinePRs)
		protected.GET("/api/pipeline/history", h.GetPipelineHistory)
		protected.POST("/api/pipeline/propose", h.ProposePipelineCode)
		protected.POST("/api/pipeline/merge", h.MergePipelinePR)

		// System Intelligence status & resilience layer
		protected.GET("/api/system-intelligence/status", h.GetSystemIntelligenceStatus)
		protected.POST("/api/system-intelligence/simulate-outage", h.SimulateOutage)
		protected.GET("/api/system-intelligence/availability-log", h.GetAvailabilityLog)
		protected.GET("/api/system-intelligence/provider-config", h.GetLLMProviderConfig)
		protected.POST("/api/system-intelligence/provider-config", h.UpdateLLMProviderConfig)
		protected.GET("/api/system-intelligence/provider-usage", h.GetLLMProviderUsage)
		protected.POST("/api/system-intelligence/recalibrate-benchmarks", h.RecalibrateBenchmarks)
		protected.GET("/api/system-intelligence/tool-logs", h.GetToolLogs)
		protected.GET("/api/benchmark-results", h.GetBenchmarkResults)

		// Sovereign Mind
		protected.GET("/api/sovereign-mind/snapshot", h.GetSovereignMindSnapshot)
		protected.GET("/api/sovereign-mind/history", h.GetSovereignMindHistory)
		protected.POST("/api/sovereign-mind/trigger", h.TriggerSovereignMind)

		// Tool Registry
		protected.GET("/api/tools/registry", h.GetToolRegistry)
		protected.POST("/api/tools/execute", h.ExecuteTool)

		// Synthesis Dashboard & Market Regime
		protected.GET("/api/synthesis/dashboard", h.GetSynthesisDashboard)
		protected.GET("/api/market_regime/summary", h.GetMarketRegimeSummary)
		protected.POST("/api/market_regime/simulate-return", h.SimulateMarketRegimeReturn)
		protected.POST("/api/market_regime/reclassify", h.ReclassifyMarketRegime)

		// Positions & Order Execution
		protected.GET("/api/positions", h.GetPositions)
		protected.POST("/api/positions/order", h.PlaceOrder)
		protected.POST("/api/positions/close", h.ClosePosition)

		// Nexus Agent & Meta Controller
		protected.GET("/api/nexus-agent/status", h.GetNexusAgentStatus)
		protected.POST("/api/nexus-agent/config", h.UpdateNexusAgentConfig)
		protected.POST("/api/nexus-agent/trigger", h.TriggerNexusAgent)
		protected.GET("/api/meta-controller/status", h.GetMetaControllerStatus)

		// Dark Pool & Value Discovery Evolution
		protected.GET("/api/dark-pool/weekly", h.GetDarkPoolWeekly)
		protected.POST("/api/dark-pool/config", h.ConfigDarkPool)
		protected.POST("/api/dark-pool/fetch-finra", h.FetchFinraDarkPool)
		protected.GET("/api/value-discovery/evolution-logs", h.GetValueDiscoveryEvolutionLogs)
		protected.POST("/api/value-discovery/github-evolution", h.GithubEvolutionValueDiscovery)

		// Risk History & Limits
		protected.GET("/api/risk/history", h.GetRiskHistory)
		protected.POST("/api/risk/limits", h.UpdateRiskLimits)

		// Historical Ticks, Walk Forward, Live Training & Gemini Research
		protected.GET("/api/historical_ticks_v2/status", h.GetHistoricalTicksStatus)
		protected.POST("/api/historical_ticks_v2/sync", h.SyncHistoricalTicks)
		protected.POST("/api/walk_forward/run", h.RunWalkForward)
		protected.GET("/api/live-training/status", h.GetLiveTrainingStatus)
		protected.POST("/api/live-training/toggle", h.ToggleLiveTraining)
		protected.POST("/api/gemini/research", h.RunGeminiResearch)
		protected.GET("/api/gemini/research/logs", h.GetGeminiResearchLogs)
		protected.GET("/api/strategies/audit-logs", h.GetStrategyAuditLogs)
		protected.GET("/api/system-implementation-status", h.GetSystemImplementationStatus)
	}

	// Serve React Static assets with SPA fallback for non-API routes
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
			return
		}

		// Serve static assets from dist/
		filePath := filepath.Join("dist", path)
		if _, err := os.Stat(filePath); err == nil && !strings.HasSuffix(filePath, "/") {
			c.File(filePath)
			return
		}

		// Default SPA fallback
		c.File(filepath.Join("dist", "index.html"))
	})

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
