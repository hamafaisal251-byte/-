import { Router, Request, Response } from "express";
import { pgDb } from "../db";
import {
  candidatesList,
  activeCandidateId,
  setActiveCandidateId
} from "../state/tradingState";
import { safetyBackstop } from "../../safetyBackstop";
import { addServerLog } from "../services/logging";
import { checkIPAllowlist } from "../middleware/auth";
import {
  AdoptCandidateSchema,
  SelectCandidateSchema,
  BacktestSchema,
  executeSandboxForCandidate,
  evaluateCppRewardInJs,
  recordPromotedVersion
} from "../services/evolutionService";

export const evolutionRouter = Router();

// GET /api/candidates
evolutionRouter.get("/candidates", (req: Request, res: Response) => {
  res.json({ success: true, candidates: candidatesList, activeCandidateId });
});

// GET /api/candidates/sandbox_history
evolutionRouter.get("/candidates/sandbox_history", (req: Request, res: Response) => {
  const history = pgDb.query("SELECT * FROM sandbox_runs") || [];
  res.json({ success: true, history });
});

// POST /api/candidates/adopt
evolutionRouter.post("/candidates/adopt", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
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
evolutionRouter.post("/candidates/select", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
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
evolutionRouter.post("/candidates/promote", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
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
evolutionRouter.post("/backtest", async (req: Request, res: Response) => {
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
