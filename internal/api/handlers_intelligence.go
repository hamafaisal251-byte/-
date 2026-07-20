package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/proda-nexus/sovereign-trading/internal/crypto"
)

var (
	intelMutex               sync.RWMutex
	geminiAvailableState     = "GEMINI_AVAILABLE"
	geminiLastTransitionTime = time.Now().Format(time.RFC3339)
	tier3Status              = "RUNNING"
	selectedLocalModel       = "qwen2.5-coder:32b"
	ollamaStatus             = "OFFLINE"
	mockOutageSimulated      = false
	llmProviderMode          = "gemini"
	enablePolicyRouting      = true
	routingPolicy            = `{"routine_parameter_tuning": "deepseek", "complex_multi_signal_synthesis": "gemini", "tier_2_fallback": "self_hosted", "deep_research": "gemini", "general": "gemini"}`
	policyReasoning          = "DeepSeek handles routine parameter tuning. Gemini handles complex synthesis. Self-hosted handles Tier-2 fallback."
)

// GetSystemIntelligenceStatus handles GET /api/system-intelligence/status
func (h *Handler) GetSystemIntelligenceStatus(c *gin.Context) {
	intelMutex.RLock()
	defer intelMutex.RUnlock()

	selfHostedURL := os.Getenv("SELF_HOSTED_MODEL_URL")
	if selfHostedURL == "" {
		selfHostedURL = "http://127.0.0.1:11434/v1"
	}
	selfHostedModelName := os.Getenv("SELF_HOSTED_MODEL_NAME")
	if selfHostedModelName == "" {
		selfHostedModelName = "qwen2.5-coder:32b"
	}

	// Try reading benchmarks
	var benchmarkData interface{} = map[string]interface{}{}
	benchmarkPath := filepath.Join(".", "benchmark_results.json")
	if bBytes, err := os.ReadFile(benchmarkPath); err == nil {
		_ = json.Unmarshal(bBytes, &benchmarkData)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":                  true,
		"geminiAvailableState":     geminiAvailableState,
		"geminiLastTransitionTime": geminiLastTransitionTime,
		"tier3Status":              tier3Status,
		"selectedLocalModel":       selectedLocalModel,
		"ollamaStatus":             ollamaStatus,
		"benchmarkResults":         benchmarkData,
		"mockOutageSimulated":      mockOutageSimulated,
		"llmProviderMode":          llmProviderMode,
		"selfHostedUrl":            selfHostedURL,
		"selfHostedModelName":      selfHostedModelName,
	})
}

// SimulateOutage handles POST /api/system-intelligence/simulate-outage
type SimulateOutageInput struct {
	Simulate bool `json:"simulate"`
}

func (h *Handler) SimulateOutage(c *gin.Context) {
	ctx := c.Request.Context()
	var input SimulateOutageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	intelMutex.Lock()
	mockOutageSimulated = input.Simulate
	transitionTime := time.Now().Format(time.RFC3339)
	geminiLastTransitionTime = transitionTime

	if mockOutageSimulated {
		geminiAvailableState = "GEMINI_UNAVAILABLE"
		tier3Status = "PAUSED_AWAITING_GEMINI"

		log.Printf("[DEVELOPER-OVERRIDE] Outage simulation toggled to active")

		// Write to availability log in DB
		_, _ = h.DB.Pool.Exec(ctx,
			"INSERT INTO gemini_availability_log (status, details, timestamp) VALUES ($1, $2, $3)",
			"GEMINI_UNAVAILABLE", "Outage manually simulated by developer/user override.", transitionTime,
		)

		// Insert fake self improvement pause log
		pauseLog := `{"avgReward": 0, "maxDrawdown": 0, "SharpeRatio": 0, "tradesCount": 0}`
		_, _ = h.DB.Pool.Exec(ctx,
			`INSERT INTO self_improvement_logs (id, timestamp, weakness_detected, metric_details, research_topic, cache_hit, sources, grounded_summary, generated_candidate_name, sandbox_status, sandbox_reason, metrics)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			fmt.Sprintf("outage-sim-%d", time.Now().UnixNano()/1e6), transitionTime, "ALL", "Developer forced simulation", "N/A", false, "[]",
			"Manual outage simulated by developer override. System entered PAUSED_AWAITING_GEMINI tier 3 mode.", "N/A", "PAUSED_AWAITING_GEMINI",
			"Sovereign evolutionary self-improvement engine paused. Gemini API is unreachable.", pauseLog,
		)
	} else {
		geminiAvailableState = "GEMINI_AVAILABLE"
		tier3Status = "RUNNING"

		log.Printf("[DEVELOPER-OVERRIDE] Outage simulation cleared")

		_, _ = h.DB.Pool.Exec(ctx,
			"INSERT INTO gemini_availability_log (status, details, timestamp) VALUES ($1, $2, $3)",
			"GEMINI_AVAILABLE", "Outage simulation cleared. Gemini connection re-established.", transitionTime,
		)

		resumeLog := `{"avgReward": 0, "maxDrawdown": 0, "SharpeRatio": 0, "tradesCount": 0}`
		_, _ = h.DB.Pool.Exec(ctx,
			`INSERT INTO self_improvement_logs (id, timestamp, weakness_detected, metric_details, research_topic, cache_hit, sources, grounded_summary, generated_candidate_name, sandbox_status, sandbox_reason, metrics)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			fmt.Sprintf("outage-clear-%d", time.Now().UnixNano()/1e6), transitionTime, "ALL", "Developer cleared simulation", "N/A", false, "[]",
			"Manual outage simulation cleared. System returned to RUNNING mode.", "N/A", "RESUMED",
			"Sovereign evolutionary self-improvement engine resumed automatically.", resumeLog,
		)
	}
	intelMutex.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"success":                  true,
		"geminiAvailableState":     geminiAvailableState,
		"geminiLastTransitionTime": geminiLastTransitionTime,
		"tier3Status":              tier3Status,
		"mockOutageSimulated":      mockOutageSimulated,
	})
}

// GetAvailabilityLog handles GET /api/system-intelligence/availability-log
func (h *Handler) GetAvailabilityLog(c *gin.Context) {
	ctx := c.Request.Context()

	rows, err := h.DB.Pool.Query(ctx, "SELECT id, status, details, timestamp FROM gemini_availability_log ORDER BY timestamp DESC LIMIT 50")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type AvailLog struct {
		ID        int       `json:"id"`
		Status    string    `json:"status"`
		Details   string    `json:"details"`
		Timestamp time.Time `json:"timestamp"`
	}

	var logs []AvailLog
	for rows.Next() {
		var l AvailLog
		err := rows.Scan(&l.ID, &l.Status, &l.Details, &l.Timestamp)
		if err == nil {
			logs = append(logs, l)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "logs": logs})
}

// GetLLMProviderConfig handles GET /api/system-intelligence/provider-config
func (h *Handler) GetLLMProviderConfig(c *gin.Context) {
	ctx := c.Request.Context()

	var (
		mode, selfHostedURL, selfHostedModelName, routingPolicyStr, reasoning string
		enablePolicyRouting                                                   bool
		deepseekApiKeyEnc                                                     string
	)

	err := h.DB.Pool.QueryRow(ctx, "SELECT mode, self_hosted_url, self_hosted_model_name, enable_policy_routing, routing_policy, policy_reasoning, deepseek_api_key_enc FROM llm_provider_config WHERE id = 1").Scan(
		&mode, &selfHostedURL, &selfHostedModelName, &enablePolicyRouting, &routingPolicyStr, &reasoning, &deepseekApiKeyEnc,
	)

	if err != nil {
		// Fallbacks
		c.JSON(http.StatusOK, gin.H{
			"success":                  true,
			"mode":                     "gemini",
			"selfHostedUrl":            "http://127.0.0.1:11434/v1",
			"selfHostedModelName":      "qwen2.5-coder:32b",
			"enablePolicyRouting":      true,
			"routingPolicy":            map[string]interface{}{"routine_parameter_tuning": "deepseek", "complex_multi_signal_synthesis": "gemini", "tier_2_fallback": "self_hosted", "deep_research": "gemini", "general": "gemini"},
			"policyReasoning":          "Fallback defaults",
			"deepseekApiKeyConfigured": false,
		})
		return
	}

	var policy map[string]interface{}
	_ = json.Unmarshal([]byte(routingPolicyStr), &policy)

	c.JSON(http.StatusOK, gin.H{
		"success":                  true,
		"mode":                     mode,
		"selfHostedUrl":            selfHostedURL,
		"selfHostedModelName":      selfHostedModelName,
		"enablePolicyRouting":      enablePolicyRouting,
		"routingPolicy":            policy,
		"policyReasoning":          reasoning,
		"deepseekApiKeyConfigured": deepseekApiKeyEnc != "",
	})
}

// UpdateLLMProviderConfig handles POST /api/system-intelligence/provider-config
type UpdateLLMProviderConfigInput struct {
	Mode                string                 `json:"mode" binding:"required"`
	SelfHostedURL       string                 `json:"selfHostedUrl" binding:"required"`
	SelfHostedModelName string                 `json:"selfHostedModelName" binding:"required"`
	EnablePolicyRouting bool                   `json:"enablePolicyRouting"`
	RoutingPolicy       map[string]interface{} `json:"routingPolicy"`
	PolicyReasoning     string                 `json:"policyReasoning"`
	DeepseekApiKey      string                 `json:"deepseekApiKey"`
}

func (h *Handler) UpdateLLMProviderConfig(c *gin.Context) {
	ctx := c.Request.Context()
	var input UpdateLLMProviderConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	policyBytes, _ := json.Marshal(input.RoutingPolicy)
	policyStr := string(policyBytes)

	// Fetch old api key enc first
	var oldKeyEnc string
	_ = h.DB.Pool.QueryRow(ctx, "SELECT deepseek_api_key_enc FROM llm_provider_config WHERE id = 1").Scan(&oldKeyEnc)

	apiKeyEnc := oldKeyEnc
	if input.DeepseekApiKey != "" && input.DeepseekApiKey != "••••••••" && !strings.HasPrefix(input.DeepseekApiKey, "••••") {
		apiKeyEnc, _ = crypto.Encrypt(input.DeepseekApiKey)
		os.Setenv("DEEPSEEK_API_KEY", input.DeepseekApiKey)
	}

	_, err := h.DB.Pool.Exec(ctx, `
		INSERT INTO llm_provider_config (id, mode, self_hosted_url, self_hosted_model_name, enable_policy_routing, routing_policy, policy_reasoning, deepseek_api_key_enc)
		VALUES (1, $1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			mode = EXCLUDED.mode,
			self_hosted_url = EXCLUDED.self_hosted_url,
			self_hosted_model_name = EXCLUDED.self_hosted_model_name,
			enable_policy_routing = EXCLUDED.enable_policy_routing,
			routing_policy = EXCLUDED.routing_policy,
			policy_reasoning = EXCLUDED.policy_reasoning,
			deepseek_api_key_enc = EXCLUDED.deepseek_api_key_enc`,
		input.Mode, input.SelfHostedURL, input.SelfHostedModelName, input.EnablePolicyRouting, policyStr, input.PolicyReasoning, apiKeyEnc,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Update running in-memory configurations
	intelMutex.Lock()
	llmProviderMode = input.Mode
	enablePolicyRouting = input.EnablePolicyRouting
	routingPolicy = policyStr
	policyReasoning = input.PolicyReasoning
	os.Setenv("SELF_HOSTED_MODEL_URL", input.SelfHostedURL)
	os.Setenv("SELF_HOSTED_MODEL_NAME", input.SelfHostedModelName)
	intelMutex.Unlock()

	AddServerLog("GO-BACKPLANE", "INFO", fmt.Sprintf("Sovereign LLM Provider configuration updated. Routing set to mode: %s, policy active: %v", input.Mode, input.EnablePolicyRouting))

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "LLM configurations saved and applied to running processes successfully."})
}

// GetLLMProviderUsage handles GET /api/system-intelligence/provider-usage
func (h *Handler) GetLLMProviderUsage(c *gin.Context) {
	ctx := c.Request.Context()

	// 1. Summary
	summaryRows, err := h.DB.Pool.Query(ctx, `
		SELECT provider, SUM(prompt_tokens) as "promptTokens", SUM(completion_tokens) as "completionTokens", SUM(total_tokens) as "totalTokens", SUM(cost) as "cost", COUNT(*) as "callCount"
		FROM provider_usage_log
		GROUP BY provider`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer summaryRows.Close()

	type SummaryRow struct {
		Provider         string  `json:"provider"`
		PromptTokens     int64   `json:"promptTokens"`
		CompletionTokens int64   `json:"completionTokens"`
		TotalTokens      int64   `json:"totalTokens"`
		Cost             float64 `json:"cost"`
		CallCount        int64   `json:"callCount"`
	}

	var summary []SummaryRow
	for summaryRows.Next() {
		var s SummaryRow
		err := summaryRows.Scan(&s.Provider, &s.PromptTokens, &s.CompletionTokens, &s.TotalTokens, &s.Cost, &s.CallCount)
		if err == nil {
			summary = append(summary, s)
		}
	}

	// 2. Logs
	logsRows, err := h.DB.Pool.Query(ctx, `
		SELECT id, timestamp, provider, model, prompt_tokens as "promptTokens", completion_tokens as "completionTokens", total_tokens as "totalTokens", cost, task_category as "taskCategory", status
		FROM provider_usage_log
		ORDER BY timestamp DESC
		LIMIT 100`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer logsRows.Close()

	type UsageLog struct {
		ID               int       `json:"id"`
		Timestamp        time.Time `json:"timestamp"`
		Provider         string    `json:"provider"`
		Model            string    `json:"model"`
		PromptTokens     int       `json:"promptTokens"`
		CompletionTokens int       `json:"completionTokens"`
		TotalTokens      int       `json:"totalTokens"`
		Cost             float64   `json:"cost"`
		TaskCategory     string    `json:"taskCategory"`
		Status           string    `json:"status"`
	}

	var logs []UsageLog
	for logsRows.Next() {
		var l UsageLog
		err := logsRows.Scan(&l.ID, &l.Timestamp, &l.Provider, &l.Model, &l.PromptTokens, &l.CompletionTokens, &l.TotalTokens, &l.Cost, &l.TaskCategory, &l.Status)
		if err == nil {
			logs = append(logs, l)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"summary": summary,
		"logs":    logs,
	})
}

// RecalibrateBenchmarks handles POST /api/system-intelligence/recalibrate-benchmarks
func (h *Handler) RecalibrateBenchmarks(c *gin.Context) {
	log.Println("[BENCHMARK-RUN] Launching live model calibration script asynchronously...")
	scriptPath := filepath.Join(".", "scripts", "benchmark_models.ts")

	go func() {
		cmd := exec.Command("npx", "tsx", scriptPath)
		cmd.Env = os.Environ()
		output, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("[BENCHMARK-RUN-ERROR] Script failed: %v. Output: %s", err, string(output))
			AddServerLog("GO-BACKPLANE", "WARNING", fmt.Sprintf("Model calibration harness failed: %v", err))
			return
		}
		log.Println("[BENCHMARK-RUN-SUCCESS] Script completed successfully.")
		AddServerLog("GO-BACKPLANE", "INFO", "Model calibration harness completed successfully. New benchmarks logged.")
	}()

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Model calibration harness triggered successfully."})
}

// GetToolLogs handles GET /api/system-intelligence/tool-logs
func (h *Handler) GetToolLogs(c *gin.Context) {
	ctx := c.Request.Context()

	rows, err := h.DB.Pool.Query(ctx, `
		SELECT id, timestamp, session_id as "sessionId", tool_name as "toolName", arguments, return_value as "returnValue"
		FROM self_hosted_tool_logs
		ORDER BY timestamp DESC
		LIMIT 100`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type ToolLog struct {
		ID          int       `json:"id"`
		Timestamp   time.Time `json:"timestamp"`
		SessionID   string    `json:"sessionId"`
		ToolName    string    `json:"toolName"`
		Arguments   string    `json:"arguments"`
		ReturnValue string    `json:"returnValue"`
	}

	var logs []ToolLog
	for rows.Next() {
		var l ToolLog
		err := rows.Scan(&l.ID, &l.Timestamp, &l.SessionID, &l.ToolName, &l.Arguments, &l.ReturnValue)
		if err == nil {
			logs = append(logs, l)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "logs": logs})
}

// GetBenchmarkResults handles GET /api/benchmark-results
func (h *Handler) GetBenchmarkResults(c *gin.Context) {
	benchmarkPath := filepath.Join(".", "benchmark_results.json")
	if _, err := os.Stat(benchmarkPath); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "No benchmark run history found. Run a new benchmark harness first.",
		})
		return
	}

	bBytes, err := os.ReadFile(benchmarkPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to read benchmark results file."})
		return
	}

	var data interface{}
	if err := json.Unmarshal(bBytes, &data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to parse benchmark results JSON."})
		return
	}

	c.JSON(http.StatusOK, data)
}
