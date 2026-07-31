import { Router, Request, Response } from "express";
import path from "path";
import { pgDb } from "../db";
import { encrypt } from "../utils/crypto";
import { addServerLog } from "../services/logging";
import {
  llmProviderMode,
  setLLMProviderMode,
  setEnablePolicyRouting,
  setRoutingPolicy
} from "../../llmProvider";
import {
  geminiAvailableState,
  setGeminiAvailableState,
  geminiLastTransitionTime,
  setGeminiLastTransitionTime,
  tier3Status,
  setTier3Status,
  selectedLocalModel,
  ollamaStatus,
  benchmarkResults,
  mockOutageSimulated,
  setMockOutageSimulated,
  setGeminiUnavailableSince,
  inMemoryToolCallLogs
} from "../state/tradingState";

export const systemIntelligenceRouter = Router();

// GET LLM Provider Configuration
systemIntelligenceRouter.get("/provider-config", async (req: Request, res: Response) => {
  try {
    const configRows = await pgDb.pool.query("SELECT * FROM llm_provider_config WHERE id = 1");
    if (configRows.rows && configRows.rows[0]) {
      const row = configRows.rows[0];
      return res.json({
        success: true,
        mode: row.mode,
        selfHostedUrl: row.self_hosted_url,
        selfHostedModelName: row.self_hosted_model_name,
        enablePolicyRouting: row.enable_policy_routing,
        routingPolicy: row.routing_policy,
        policyReasoning: row.policy_reasoning,
        deepseekApiKeyConfigured: !!(row.deepseek_api_key_enc && row.deepseek_api_key_enc.trim().length > 0)
      });
    }
    return res.json({
      success: true,
      mode: llmProviderMode || "gemini",
      selfHostedUrl: process.env.SELF_HOSTED_MODEL_URL || "http://127.0.0.1:11434/v1",
      selfHostedModelName: process.env.SELF_HOSTED_MODEL_NAME || "qwen2.5-coder:32b",
      enablePolicyRouting: true,
      routingPolicy: {
        routine_parameter_tuning: "deepseek",
        complex_multi_signal_synthesis: "gemini",
        tier_2_fallback: "self_hosted",
        deep_research: "gemini",
        general: "gemini"
      },
      policyReasoning: "Fallback defaults",
      deepseekApiKeyConfigured: false
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST update LLM Provider Configuration
systemIntelligenceRouter.post("/provider-config", async (req: Request, res: Response) => {
  try {
    const { mode, selfHostedUrl, selfHostedModelName, enablePolicyRouting, routingPolicy, policyReasoning, deepseekApiKey } = req.body;
    
    let updateApiKeySql = "";
    const params: any[] = [mode, selfHostedUrl, selfHostedModelName, enablePolicyRouting === true, typeof routingPolicy === "string" ? routingPolicy : JSON.stringify(routingPolicy), policyReasoning];
    
    if (deepseekApiKey !== undefined && deepseekApiKey.trim() !== "" && !deepseekApiKey.startsWith("••••")) {
      const encryptedKey = encrypt(deepseekApiKey.trim());
      updateApiKeySql = ", deepseek_api_key_enc = $7";
      params.push(encryptedKey);
      
      process.env.DEEPSEEK_API_KEY = deepseekApiKey.trim();
    }

    const query = `
      UPDATE llm_provider_config
      SET mode = $1,
          self_hosted_url = $2,
          self_hosted_model_name = $3,
          enable_policy_routing = $4,
          routing_policy = $5,
          policy_reasoning = $6
          ${updateApiKeySql}
      WHERE id = 1
    `;

    await pgDb.pool.query(query, params);

    setLLMProviderMode(mode);
    setEnablePolicyRouting(enablePolicyRouting === true);
    setRoutingPolicy(routingPolicy, policyReasoning);
    process.env.SELF_HOSTED_MODEL_URL = selfHostedUrl;
    process.env.SELF_HOSTED_MODEL_NAME = selfHostedModelName;

    addServerLog("GO-BACKPLANE", "INFO", `Sovereign LLM Provider configuration updated. Routing set to mode: ${mode}, policy: ${enablePolicyRouting ? "active" : "disabled"}`);

    return res.json({ success: true, message: "LLM configurations saved and applied to running processes successfully." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET LLM Usage Metrics and History
systemIntelligenceRouter.get("/provider-usage", async (req: Request, res: Response) => {
  try {
    const usageSummary = await pgDb.pool.query(`
      SELECT 
        provider,
        SUM(prompt_tokens) as "promptTokens",
        SUM(completion_tokens) as "completionTokens",
        SUM(total_tokens) as "totalTokens",
        SUM(cost) as "cost",
        COUNT(*) as "callCount"
      FROM provider_usage_log
      GROUP BY provider
    `);

    const rawLogs = await pgDb.pool.query(`
      SELECT id, timestamp, provider, model, prompt_tokens as "promptTokens", completion_tokens as "completionTokens", total_tokens as "totalTokens", cost, task_category as "taskCategory", status
      FROM provider_usage_log
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    return res.json({
      success: true,
      summary: usageSummary.rows,
      logs: rawLogs.rows
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST Trigger Recalibration of Benchmarks
systemIntelligenceRouter.post("/recalibrate-benchmarks", async (req: Request, res: Response) => {
  try {
    console.log("[BENCHMARK-RUN] Launching live model calibration script asynchronously...");
    const scriptPath = path.join(process.cwd(), "scripts", "benchmark_models.ts");
    
    const { exec } = require("child_process");
    exec(`npx tsx "${scriptPath}"`, (error: any, stdout: any, stderr: any) => {
      if (error) {
        console.error("[BENCHMARK-RUN-ERROR] Script failed:", error.message);
        addServerLog("GO-BACKPLANE", "WARNING", `Model calibration harness failed: ${error.message}`);
        return;
      }
      console.log("[BENCHMARK-RUN-SUCCESS] Script completed successfully.");
      addServerLog("GO-BACKPLANE", "INFO", "Model calibration harness completed successfully. New benchmarks logged.");
    });

    return res.json({ success: true, message: "Benchmark recalibration triggered." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

systemIntelligenceRouter.get("/status", (req: Request, res: Response) => {
  res.json({
    success: true,
    geminiAvailableState,
    geminiLastTransitionTime,
    tier3Status,
    selectedLocalModel,
    ollamaStatus,
    benchmarkResults,
    mockOutageSimulated,
    llmProviderMode,
    selfHostedUrl: process.env.SELF_HOSTED_MODEL_URL || "http://127.0.0.1:11434/v1",
    selfHostedModelName: process.env.SELF_HOSTED_MODEL_NAME || "llama3.1:70b"
  });
});

systemIntelligenceRouter.post("/simulate-outage", async (req: Request, res: Response) => {
  try {
    const { simulate } = req.body;
    setMockOutageSimulated(!!simulate);
    const isOutage = !!simulate;
    
    if (isOutage) {
      setGeminiAvailableState("GEMINI_UNAVAILABLE");
      const transitionTime = new Date().toISOString();
      setGeminiLastTransitionTime(transitionTime);
      setTier3Status("PAUSED_AWAITING_GEMINI");
      setGeminiUnavailableSince(transitionTime);
      
      try {
        const log = {
          id: `outage-sim-${Date.now()}`,
          timestamp: transitionTime,
          weaknessDetected: "ALL",
          metricDetails: "Developer forced simulation",
          researchTopic: "N/A",
          cacheHit: false,
          sources: [],
          groundedSummary: "Manual outage simulated by developer override. System entered PAUSED_AWAITING_GEMINI tier 3 mode.",
          generatedCandidateName: "N/A",
          sandboxStatus: "PAUSED_AWAITING_GEMINI" as any,
          sandboxReason: "Sovereign evolutionary self-improvement engine paused. Gemini API is unreachable.",
          metrics: { avgReward: 0, maxDrawdown: 0, SharpeRatio: 0, tradesCount: 0 }
        };
        await pgDb.executeLocalQuery("INSERT INTO self_improvement_logs", [log]);
        
        await pgDb.queryAsync(
          "INSERT INTO gemini_availability_log (status, details, timestamp) VALUES ($1, $2, $3)",
          ["GEMINI_UNAVAILABLE", "Outage manually simulated by developer/user override.", transitionTime]
        );
      } catch (err: any) {
        console.error("[SIMULATE-OUTAGE] Log write failed:", err.message);
      }
    } else {
      setGeminiAvailableState("GEMINI_AVAILABLE");
      const transitionTime = new Date().toISOString();
      setGeminiLastTransitionTime(transitionTime);
      setTier3Status("RUNNING");
      setGeminiUnavailableSince(null);
      
      try {
        const log = {
          id: `outage-clear-${Date.now()}`,
          timestamp: transitionTime,
          weaknessDetected: "ALL",
          metricDetails: "Developer cleared simulation",
          researchTopic: "N/A",
          cacheHit: false,
          sources: [],
          groundedSummary: "Manual outage simulation cleared. System returned to RUNNING mode.",
          generatedCandidateName: "N/A",
          sandboxStatus: "RESUMED" as any,
          sandboxReason: "Sovereign evolutionary self-improvement engine resumed automatically.",
          metrics: { avgReward: 0, maxDrawdown: 0, SharpeRatio: 0, tradesCount: 0 }
        };
        await pgDb.executeLocalQuery("INSERT INTO self_improvement_logs", [log]);

        await pgDb.queryAsync(
          "INSERT INTO gemini_availability_log (status, details, timestamp) VALUES ($1, $2, $3)",
          ["GEMINI_AVAILABLE", "Outage simulation cleared. Gemini connection re-established.", transitionTime]
        );
      } catch (err: any) {
        console.error("[SIMULATE-OUTAGE] Log write failed:", err.message);
      }
    }
    
    res.json({
      success: true,
      geminiAvailableState,
      geminiLastTransitionTime,
      tier3Status,
      mockOutageSimulated: isOutage
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

systemIntelligenceRouter.get("/availability-log", async (req: Request, res: Response) => {
  let logs: any[] = [];
  try {
    logs = await pgDb.queryAsync("SELECT * FROM gemini_availability_log ORDER BY timestamp DESC LIMIT 50");
  } catch (err: any) {
    console.error("[GET-AVAILABILITY-LOG-ERROR] DB fetch failed, using local fallback execution...", err.message);
    logs = await pgDb.executeLocalQuery("SELECT * FROM gemini_availability_log");
  }
  res.json({ success: true, logs });
});

systemIntelligenceRouter.post("/tier2-run", async (req: Request, res: Response) => {
  try {
    const { taskType, payload } = req.body;
    if (!taskType || !["summarize", "sentiment", "anomaly"].includes(taskType)) {
      return res.status(400).json({ success: false, error: "Invalid taskType. Supported values: summarize, sentiment, anomaly" });
    }
    res.json({ success: true, result: { taskType, processed: true, payload } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

systemIntelligenceRouter.get("/tool-logs", async (req: Request, res: Response) => {
  try {
    let logs: any[] = [];
    try {
      logs = await pgDb.queryAsync("SELECT id, timestamp, session_id as \"sessionId\", tool_name as \"toolName\", arguments, return_value as \"returnValue\" FROM self_hosted_tool_logs ORDER BY timestamp DESC LIMIT 100") || [];
    } catch (dbErr: any) {
      console.warn("[TOOL-LOGS] DB query failed, utilizing in-memory tool call logs fallback:", dbErr.message);
    }

    if (!logs || logs.length === 0) {
      logs = inMemoryToolCallLogs;
    }

    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
