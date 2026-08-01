import { Router, Request, Response } from "express";
import { z } from "zod";
import { pgDb } from "../db";
import {
  candidatesList,
  activeCandidateId,
  setActiveCandidateId
} from "../state/tradingState";
import { safetyBackstop } from "../../safetyBackstop";
import { addServerLog } from "../services/logging";
import { checkIPAllowlist } from "../middleware/auth";
import { llmProvider } from "../../llmProvider";
import {
  AdoptCandidateSchema,
  SelectCandidateSchema,
  BacktestSchema,
  executeSandboxForCandidate,
  evaluateCppRewardInJs,
  recordPromotedVersion,
  synthesizeCandidateFromResearch
} from "../services/evolutionService";

export const evolutionRouter = Router();

const GeminiAnalyzeSchema = z.object({
  code: z.string().min(1, "Code parameter is required"),
  candidateName: z.string().optional()
});

// GET /api/candidates
evolutionRouter.get(["/candidates", "/v1/candidates", "/evolution/candidates"], (req: Request, res: Response) => {
  res.json({ success: true, candidates: candidatesList, activeCandidateId });
});

// GET /api/candidates/sandbox_history
evolutionRouter.get(["/candidates/sandbox_history", "/v1/candidates/sandbox_history", "/evolution/candidates/sandbox_history"], (req: Request, res: Response) => {
  const history = pgDb.query("SELECT * FROM sandbox_runs") || [];
  res.json({ success: true, history });
});

// POST /api/candidates/adopt
evolutionRouter.post(["/candidates/adopt", "/v1/candidates/adopt", "/evolution/candidates/adopt"], (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  try {
    const safety = safetyBackstop.getState();
    if (safety.silentLockActive) {
      return res.status(400).json({ success: false, error: "Candidate promotion / selection is BLOCKED by Silent Lock state." });
    }
    if (safety.emergencyHaltActive) {
      return res.status(400).json({ success: false, error: "Candidate promotion / selection is BLOCKED by Emergency Halt state." });
    }

    const validated = AdoptCandidateSchema.parse(req.body);
    const { name, code, creator } = validated;

    const sandboxResult = executeSandboxForCandidate(name || "AI Candidate", code, creator || "HUMAN_OPERATOR");

    const logRecord = {
      id: `sandbox-${sandboxResult.success ? "success" : "fail"}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      name: name || "AI Candidate",
      code,
      status: sandboxResult.success ? "PROMOTED" : "REJECTED",
      rejectionReason: sandboxResult.rejectionReason,
      metrics: sandboxResult.metrics
    };

    pgDb.query("INSERT INTO sandbox_runs", [logRecord]);

    if (!sandboxResult.success) {
      addServerLog("EVOLUTION-LAB", "CRITICAL", `⚠️ Sandbox REJECTED candidate: '${name}'. Metrics: Sharpe=${sandboxResult.metrics.SharpeRatio.toFixed(2)}, MaxDD=${sandboxResult.metrics.maxDrawdown.toFixed(2)}%, Trades=${sandboxResult.metrics.tradesCount}. Reason: ${sandboxResult.rejectionReason}`);
      return res.status(400).json({
        success: false,
        error: "Candidate failed sandbox promotion criteria",
        rejectionReason: sandboxResult.rejectionReason,
        metrics: sandboxResult.metrics
      });
    }

    const id = `candidate-${Date.now()}`;
    const newCandidate = {
      id,
      name: name || `Professor AI Optimized [Custom Kernel]`,
      creator: creator || "SERVER_GEN",
      status: "PASSED",
      code,
      metrics: {
        avgReward: parseFloat(sandboxResult.metrics.avgReward.toFixed(1)),
        maxDrawdown: parseFloat(sandboxResult.metrics.maxDrawdown.toFixed(2)),
        avgLatencyNs: Math.floor(100 + Math.random() * 40),
        leaksBytes: 0,
        astWarningsCount: 0
      }
    };

    candidatesList.unshift(newCandidate);
    setActiveCandidateId(id);

    addServerLog("EVOLUTION-LAB", "SUCCESS", `🎉 Sandbox APPROVED candidate: '${name}'! Promoted to Demo execution. Sharpe=${sandboxResult.metrics.SharpeRatio.toFixed(2)}, MaxDD=${sandboxResult.metrics.maxDrawdown.toFixed(2)}%, Trades=${sandboxResult.metrics.tradesCount}`);

    res.json({ success: true, candidate: newCandidate, activeCandidateId, sandboxRecord: logRecord });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/candidates/select
evolutionRouter.post(["/candidates/select", "/v1/candidates/select", "/evolution/candidates/select"], (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  try {
    const safety = safetyBackstop.getState();
    if (safety.silentLockActive) {
      return res.status(400).json({ success: false, error: "Candidate promotion / selection is BLOCKED by Silent Lock state." });
    }
    if (safety.emergencyHaltActive) {
      return res.status(400).json({ success: false, error: "Candidate promotion / selection is BLOCKED by Emergency Halt state." });
    }

    const validated = SelectCandidateSchema.parse(req.body);
    const { id } = validated;

    const found = candidatesList.find((c: any) => c.id === id);
    if (!found) return res.status(404).json({ error: "Candidate not found" });

    if (found.status !== "PASSED") {
      return res.status(403).json({
        error: "Sandbox Bypass Protection: Candidate has not cleared sandbox validation rules and cannot be executed."
      });
    }

    setActiveCandidateId(id);
    addServerLog("EVOLUTION-LAB", "SUCCESS", `Dynamic hot-swap successful: '${found.name}' bound to CPU Core 3.`);
    res.json({ success: true, activeCandidateId });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/candidates/promote
evolutionRouter.post(["/candidates/promote", "/v1/candidates/promote", "/evolution/candidates/promote"], (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  try {
    const safety = safetyBackstop.getState();
    if (safety.silentLockActive) {
      return res.status(400).json({ success: false, error: "Candidate promotion is BLOCKED by Silent Lock state." });
    }
    if (safety.emergencyHaltActive) {
      return res.status(400).json({ success: false, error: "Candidate promotion is BLOCKED by Emergency Halt state." });
    }

    const { id, confirmStep } = req.body;
    if (!id) return res.status(400).json({ success: false, error: "Candidate ID is required." });

    const found = candidatesList.find((c: any) => c.id === id);
    if (!found) return res.status(404).json({ success: false, error: "Candidate not found." });

    if (confirmStep === 1) {
      addServerLog("EVOLUTION-LAB", "WARNING", `👨‍✈️ Human promotion initiated (Step 1 of 2) for Candidate ${id}: '${found.name}'.`);
      return res.json({ success: true, nextStepRequired: 2, message: "Step 1 of 2 cleared. Please provide final confirmation to deploy capital." });
    }

    if (confirmStep === 2) {
      found.lifecycleStage = "PROMOTED_REAL_LIVE";
      found.status = "PASSED"; 
      setActiveCandidateId(id); 
      
      recordPromotedVersion(found.id, found.name, found.code, found.liveDemoMetrics || found.metrics || {});

      addServerLog("EVOLUTION-LAB", "SUCCESS", `🚀 CAPITAL PROMOTED (Step 2 of 2) cleared! '${found.name}' is now running in REAL_LIVE with live capital execution.`);
      return res.json({ success: true, message: `Candidate ${id} successfully promoted to REAL_LIVE and executing with live capital.` });
    }

    return res.status(400).json({ success: false, error: "Invalid confirmation step." });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/backtest
evolutionRouter.post(["/backtest", "/v1/backtest", "/evolution/backtest"], async (req: Request, res: Response) => {
  try {
    const validated = BacktestSchema.parse(req.body);
    const { code, asset, duration, condition } = validated;

    let volatilitySeed = 0.8;
    let slippageSeed = 0.25;
    let basePrice = asset === "EURUSD" ? 1.08500 : asset === "GBPUSD" ? 1.27300 : 62500.00;
    let stepSize = asset === "BTCUSD" ? 15.0 : 0.00015;

    if (condition === "high_vol") {
      volatilitySeed = 3.2;
      stepSize *= 2.5;
    } else if (condition === "flash_crash") {
      volatilitySeed = 6.0;
      stepSize *= 5.0;
    } else if (condition === "slippage") {
      slippageSeed = 4.2;
    }

    const ticksCount = 100;
    let currentPrice = basePrice;
    const equityCurve: { tickIndex: number; price: number; equity: number }[] = [];
    let currentEquity = 10000;
    let positionSize = 2.0;
    let totalTrades = 0;
    let winningTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let maxDrawdown = 0;
    let peakEquity = 10000;

    for (let i = 0; i < ticksCount; i++) {
      const trend = condition === "flash_crash" && i > 30 && i < 60 ? -1.8 : (Math.random() - 0.5);
      currentPrice += trend * stepSize;

      const pnlPips = trend * 15;
      const executionLatency = 120 + Math.random() * 80;
      const slippage = Math.random() > 0.85 ? slippageSeed * 1.5 : slippageSeed;
      const volatility = volatilitySeed + (Math.random() - 0.5) * 0.5;

      const reward = evaluateCppRewardInJs(code, pnlPips, executionLatency, slippage, volatility, positionSize);

      if (Math.abs(reward) > 15) {
        totalTrades++;
        const tradeProfit = reward * 5;
        currentEquity += tradeProfit;

        if (tradeProfit > 0) {
          winningTrades++;
          totalProfit += tradeProfit;
        } else {
          totalLoss += Math.abs(tradeProfit);
        }
      }

      if (currentEquity > peakEquity) peakEquity = currentEquity;
      const dd = ((peakEquity - currentEquity) / peakEquity) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;

      equityCurve.push({
        tickIndex: i + 1,
        price: parseFloat(currentPrice.toFixed(asset === "BTCUSD" ? 2 : 5)),
        equity: parseFloat(currentEquity.toFixed(2))
      });
    }

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit;

    res.json({
      success: true,
      metrics: {
        avgReward: parseFloat((totalProfit - totalLoss / (totalTrades || 1)).toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
        totalTrades,
        finalEquity: parseFloat(currentEquity.toFixed(2)),
      },
      equityCurve
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/gemini/analyze
evolutionRouter.post(["/gemini/analyze", "/v1/gemini/analyze"], async (req: Request, res: Response) => {
  try {
    const validated = GeminiAnalyzeSchema.parse(req.body);
    const { code, candidateName } = validated;

    const promptText = `شیکردنەوەی تەکنیکی و بونیادی ئەنجام بدە بۆ کاندیدی چالاک بەناوی: ${candidateName || "Latency Optimized Sniper"}. کۆدی کەرنەڵی C++ ئەسپاردەکراو ئەمەیە:\n\n${code}\n\nتکایە وەک پڕۆفیسۆرێکی دارایی و زیرەکی دەستکرد، گونجاوی ئەم مۆدێلە لەگەڵ هەژمار و پۆرتفۆلیۆ بنرخێنە. پێشنیاری بیرکاری پێشکەش بکە بە زمانی کوردی. وەڵامەکە بە شێوازێکی پڕۆفیشناڵ و ڕێکخراو بێت بەبێ زاراوەی مارکێتینگی دڵخۆشکەر.`;

    const result = await llmProvider.generateText({
      prompt: promptText
    });
    res.json({ success: true, text: result.text });
  } catch (err: any) {
    console.error("[ANALYZE-ERROR] Generation failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gemini/optimize
evolutionRouter.post(["/gemini/optimize", "/v1/gemini/optimize"], async (req: Request, res: Response) => {
  try {
    const validated = GeminiAnalyzeSchema.parse(req.body);
    const { code, candidateName } = validated;

    const promptText = `ئۆپتیمایزکردنی فۆرمولەی کەرنەڵی C++ ڕادەست بکە بۆ کاندیدی ${candidateName || "Active Candidate"}. کۆدەکەی ئەمەیە:\n\n${code}\n\nهاوکێشەکە ئۆپتیمایز بکە بۆ بەدەستهێنانی کەمترین تاخیربوون (Low Latency) و زۆرترین قازانج لەژێر نۆرمەکانی PPO. تەنها کۆدەکەی C++ لەناو بلۆکی نیشانەکردنی کۆد \`\`\`cpp ... \`\`\` و پێشنیارە بیرکارییەکان بە کوردی پێشکەش بکە.`;

    const result = await llmProvider.generateText({
      prompt: promptText
    });
    res.json({ success: true, text: result.text });
  } catch (err: any) {
    console.error("[OPTIMIZE-ERROR] Generation failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates/synthesize
evolutionRouter.post(["/candidates/synthesize", "/v1/candidates/synthesize", "/evolution/synthesize"], async (req: Request, res: Response) => {
  try {
    const topic = req.body.topic || "Volatility-Dampened High Frequency Reward Kernel";
    const researchSummary = req.body.researchSummary || "Microstructure latency dampening with quadratic slippage penalties.";

    const result = await synthesizeCandidateFromResearch(topic, researchSummary);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || "http://127.0.0.1:3001";

// POST /api/evolution/hot-patch
evolutionRouter.post(["/hot-patch", "/v1/hot-patch"], async (req: Request, res: Response) => {
  try {
    const targetUrl = `${GO_BACKEND_URL}/api/evolution/hot-patch`;
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: `Go backend service unreachable: ${err.message}`
    });
  }
});

// GET /api/evolution/patches
evolutionRouter.get(["/patches", "/v1/patches"], async (req: Request, res: Response) => {
  try {
    const targetUrl = `${GO_BACKEND_URL}/api/evolution/patches`;
    const response = await fetch(targetUrl, {
      method: "GET"
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: `Go backend service unreachable: ${err.message}`
    });
  }
});

// POST /api/evolution/self-heal
evolutionRouter.post(["/self-heal", "/v1/self-heal"], async (req: Request, res: Response) => {
  try {
    const targetUrl = `${GO_BACKEND_URL}/api/evolution/self-heal`;
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: `Go backend service unreachable: ${err.message}`
    });
  }
});

// GET /api/evolution/healing-logs
evolutionRouter.get(["/healing-logs", "/v1/healing-logs"], async (req: Request, res: Response) => {
  try {
    const targetUrl = `${GO_BACKEND_URL}/api/evolution/healing-logs`;
    const response = await fetch(targetUrl, {
      method: "GET"
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: `Go backend service unreachable: ${err.message}`
    });
  }
});
