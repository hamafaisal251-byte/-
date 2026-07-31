import { Router, Request, Response } from "express";
import { pgDb } from "../db";
import { safetyBackstop } from "../../safetyBackstop";
import { addServerLog } from "../services/logging";
import { checkIPAllowlist } from "../middleware/auth";
import { systemStatus, demoLivePositions, demoLiveAccountStats } from "../state/tradingState";

export const riskRouter = Router();

function computeSimpleRiskMetrics(positions: any[]) {
  let totalExposure = 0;
  const singleExposures: Record<string, number> = { "EUR/USD": 0, "GBP/USD": 0, "BTC/USD": 0 };
  
  for (const p of positions || []) {
    const size = parseFloat(p.size) || 0;
    const price = parseFloat(p.entryPrice) || 1.0;
    const notional = size * 100000 * price;
    totalExposure += notional;
    if (p.symbol && singleExposures[p.symbol] !== undefined) {
      singleExposures[p.symbol] += notional;
    }
  }

  const var95Param = parseFloat((totalExposure * 0.012).toFixed(2));
  const var99Param = parseFloat((totalExposure * 0.021).toFixed(2));

  return {
    totalExposure,
    var95Hist: var95Param,
    var99Hist: var99Param,
    var95Param,
    var99Param,
    singleExposures,
    correlatedGroupExposure: totalExposure * 0.8,
    usdShortExposure: totalExposure * 0.4,
    usdLongExposure: totalExposure * 0.6
  };
}

// GET /api/risk/portfolio
riskRouter.get("/portfolio", async (req: Request, res: Response) => {
  try {
    const positions = systemStatus === "EMERGENCY_HALT" ? [] : demoLivePositions;
    const metrics = computeSimpleRiskMetrics(positions);
    const safety = safetyBackstop.getState();
    const currentDrawdownPct = safety.peakEquity > 0 ? ((safety.peakEquity - demoLiveAccountStats.equity) / safety.peakEquity) * 100 : 0;

    res.json({
      success: true,
      metrics: {
        ...metrics,
        currentDrawdownPct,
        peakEquity: safety.peakEquity,
        currentEquity: demoLiveAccountStats.equity,
        limits: {
          maxTotalNotionalExposure: safety.maxTotalNotionalExposure,
          maxSingleInstrumentExposure: safety.maxSingleInstrumentExposure,
          maxCorrelatedGroupExposure: safety.maxCorrelatedGroupExposure,
          drawdownThresholdPct: safety.drawdownThresholdPct
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/history
riskRouter.get("/history", async (req: Request, res: Response) => {
  try {
    const history = await pgDb.queryAsync("SELECT * FROM portfolio_risk_history ORDER BY timestamp DESC LIMIT 500");
    res.json({
      success: true,
      history: Array.isArray(history) ? history : []
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/risk/stress-test
riskRouter.post("/stress-test", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  try {
    const { scenarioId = "BLACK_MONDAY_1987", simulations = 10000 } = req.body || {};
    const scenarios: Record<string, any> = {
      BLACK_MONDAY_1987: { name: "1987 Black Monday Crash", shock: -0.226, vol: 4.8 },
      CHF_UNPEG_2015: { name: "2015 Swiss Franc Unpeg Shock", shock: -0.30, vol: 6.2 },
      COVID_CRUNCH_2020: { name: "2020 COVID Liquidity Squeeze", shock: -0.12, vol: 3.5 },
      FLASH_CRASH_2010: { name: "2010 Flash Crash Algo Cascade", shock: -0.09, vol: 5.0 }
    };
    const sc = scenarios[scenarioId] || scenarios["BLACK_MONDAY_1987"];

    const drawdowns: number[] = [];
    let survivalCount = 0;

    for (let i = 0; i < simulations; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const randNormal = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      const simulatedLoss = Math.abs(sc.shock + randNormal * (sc.vol / 100));
      drawdowns.push(simulatedLoss * 100);
      if (simulatedLoss < (safetyBackstop.getState().drawdownThresholdPct / 100)) {
        survivalCount++;
      }
    }

    drawdowns.sort((a, b) => a - b);
    const var99 = drawdowns[Math.floor(simulations * 0.99)];
    const evtTailVaR = drawdowns[Math.floor(simulations * 0.995)];

    res.json({
      success: true,
      scenario: sc.name,
      simulations,
      metrics: {
        var99Pct: parseFloat(var99.toFixed(2)),
        evtTailVaRPct: parseFloat(evtTailVaR.toFixed(2)),
        survivalRatePct: parseFloat(((survivalCount / simulations) * 100).toFixed(2))
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/risk/limits
riskRouter.post("/limits", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  try {
    const { maxTotalNotionalExposure, maxSingleInstrumentExposure, maxCorrelatedGroupExposure, drawdownThresholdPct } = req.body;
    const updates: any = {};
    if (maxTotalNotionalExposure !== undefined) updates.maxTotalNotionalExposure = parseFloat(maxTotalNotionalExposure);
    if (maxSingleInstrumentExposure !== undefined) updates.maxSingleInstrumentExposure = parseFloat(maxSingleInstrumentExposure);
    if (maxCorrelatedGroupExposure !== undefined) updates.maxCorrelatedGroupExposure = parseFloat(maxCorrelatedGroupExposure);
    if (drawdownThresholdPct !== undefined) updates.drawdownThresholdPct = parseFloat(drawdownThresholdPct);

    safetyBackstop.updateState(updates);
    
    addServerLog("RISK-MANAGER", "SUCCESS", `Exposure limits updated: Total Notional: $${updates.maxTotalNotionalExposure ?? ""}, Single Instrument: $${updates.maxSingleInstrumentExposure ?? ""}, Correlated Group: $${updates.maxCorrelatedGroupExposure ?? ""}, Max Drawdown: ${updates.drawdownThresholdPct ?? ""}%`);
    
    res.json({
      success: true,
      state: safetyBackstop.getState()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/stress-test
riskRouter.get("/stress-test", async (req: Request, res: Response) => {
  try {
    const positions = systemStatus === "EMERGENCY_HALT" ? [] : demoLivePositions;
    const currentEquity = demoLiveAccountStats?.equity || 100000;
    
    let totalNotional = 0;
    for (const p of positions) {
      const size = parseFloat(p.size) || 0;
      const price = parseFloat(p.entryPrice) || 1.0;
      totalNotional += size * 100000 * price;
    }
    
    const scenarios = [
      {
        id: "lehman_2008",
        name: "2008 Lehman Brothers Liquidity Crisis",
        description: "Equity market collapse (-12%), FX volatility surge (+300%), USD flight to safety (+8%)",
        estimatedDrawdownPct: totalNotional > 0 ? parseFloat((Math.min(25, (totalNotional / currentEquity) * 4.2)).toFixed(2)) : 0.8,
        estimatedLossUSD: totalNotional > 0 ? parseFloat(((totalNotional / currentEquity) * 4.2 * (currentEquity / 100)).toFixed(2)) : parseFloat((currentEquity * 0.008).toFixed(2))
      }
    ];

    res.json({ success: true, scenarios, currentEquity, totalNotional });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
