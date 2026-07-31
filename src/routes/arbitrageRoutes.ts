import { Router, Request, Response } from "express";
import { pgDb } from "../db";
import { addServerLog } from "../services/logging";
import { checkIPAllowlist } from "../middleware/auth";
import { arbitrageConfig, candidatesList, activeCandidateId } from "../state/tradingState";

export const arbitrageRouter = Router();

// GET /api/arbitrage/state
arbitrageRouter.get("/state", (req: Request, res: Response) => {
  const compliance = pgDb.query("SELECT * FROM arbitrage_compliance");
  const activeCandidate = candidatesList.find(c => c.id === activeCandidateId) || candidatesList[0];
  const sandboxPassed = activeCandidate && activeCandidate.status === "PASSED";

  res.json({
    success: true,
    config: arbitrageConfig,
    compliance: {
      tosPermitted: compliance?.tosPermitted || false,
      regulationsPermitted: compliance?.regulationsPermitted || false,
      sandboxPassed: sandboxPassed
    }
  });
});

// POST /api/arbitrage/compliance
arbitrageRouter.post("/compliance", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), (req: Request, res: Response) => {
  const { tosPermitted, regulationsPermitted } = req.body;
  const compliance = pgDb.query("UPDATE arbitrage_compliance", [
    Boolean(tosPermitted),
    Boolean(regulationsPermitted)
  ]);
  res.json({ success: true, compliance });
});

// POST /api/arbitrage/toggle
arbitrageRouter.post("/toggle", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (enabled) {
    const compliance = pgDb.query("SELECT * FROM arbitrage_compliance") || { tosPermitted: false, regulationsPermitted: false };
    const activeCandidate = candidatesList.find(c => c.id === activeCandidateId) || candidatesList[0];
    const sandboxPassed = activeCandidate && activeCandidate.status === "PASSED";

    if (!compliance.tosPermitted) {
      return res.status(400).json({ success: false, error: "TOS compliance verification required." });
    }
    if (!compliance.regulationsPermitted) {
      return res.status(400).json({ success: false, error: "Regulatory compliance verification required." });
    }
    if (!sandboxPassed) {
      return res.status(400).json({ success: false, error: "DRL model must be in PASSED status." });
    }
  }

  arbitrageConfig.liveEnabled = Boolean(enabled);
  addServerLog("RISK-MANAGER", "INFO", `Arbitrage trading mode set to ${arbitrageConfig.liveEnabled ? "ENABLED" : "DISABLED"}.`);
  res.json({ success: true, config: arbitrageConfig });
});

// POST /api/arbitrage/set-threshold
arbitrageRouter.post("/set-threshold", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), (req: Request, res: Response) => {
  const { thresholdNetProfitUsd, orderSizeBtc, slippagePct } = req.body;
  
  if (thresholdNetProfitUsd !== undefined) arbitrageConfig.thresholdNetProfitUsd = parseFloat(thresholdNetProfitUsd);
  if (orderSizeBtc !== undefined) arbitrageConfig.orderSizeBtc = parseFloat(orderSizeBtc);
  if (slippagePct !== undefined) arbitrageConfig.slippagePct = parseFloat(slippagePct);

  addServerLog("RISK-MANAGER", "INFO", `Arbitrage configuration updated: Threshold: $${arbitrageConfig.thresholdNetProfitUsd}, Size: ${arbitrageConfig.orderSizeBtc} BTC, Slippage: ${arbitrageConfig.slippagePct}%`);
  res.json({ success: true, config: arbitrageConfig });
});

// GET /api/arbitrage/logs
arbitrageRouter.get("/logs", (req: Request, res: Response) => {
  const spreads = pgDb.query("SELECT * FROM arbitrage_spreads") || [];
  const opportunities = pgDb.query("SELECT * FROM arbitrage_opportunities") || [];
  const trades = pgDb.query("SELECT * FROM arbitrage_trades") || [];

  res.json({
    success: true,
    spreads,
    opportunities,
    trades
  });
});

// POST /api/arbitrage/clear
arbitrageRouter.post("/clear", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  if (pgDb.query("SELECT * FROM arbitrage_spreads")) pgDb.query("INSERT INTO arbitrage_spreads", [null]);
  pgDb.query("INSERT INTO arbitrage_opportunities", [null]);
  pgDb.query("INSERT INTO arbitrage_trades", [null]);
  
  await pgDb.queryAsync("DELETE FROM arbitrage_spreads");
  await pgDb.queryAsync("DELETE FROM arbitrage_opportunities");
  await pgDb.queryAsync("DELETE FROM arbitrage_trades");

  addServerLog("RISK-MANAGER", "SUCCESS", "Arbitrage data and logs cleared successfully.");
  res.json({ success: true });
});

// GET /api/arbitrage/triangular
arbitrageRouter.get("/triangular", (req: Request, res: Response) => {
  const eurUsd = 1.0852;
  const usdJpy = 156.44;
  const eurJpyDirect = 169.78;
  const impliedEurJpy = eurUsd * usdJpy;
  const grossSpreadPips = +((impliedEurJpy - eurJpyDirect) * 100).toFixed(2);
  const netProfitPips = +(Math.abs(grossSpreadPips) - 0.35).toFixed(2);

  res.json({
    success: true,
    opportunities: [
      {
        pairPath: "EUR/USD ➔ USD/JPY ➔ EUR/JPY",
        leg1Symbol: "EUR/USD",
        leg1Rate: eurUsd,
        leg2Symbol: "USD/JPY",
        leg2Rate: usdJpy,
        leg3Symbol: "EUR/JPY",
        leg3DirectRate: eurJpyDirect,
        impliedRate: +impliedEurJpy.toFixed(3),
        grossSpreadPips,
        feesAndSlippage: 0.35,
        netProfitPips,
        isExecutable: netProfitPips > 0.10
      },
      {
        pairPath: "GBP/USD ➔ USD/JPY ➔ GBP/JPY",
        leg1Symbol: "GBP/USD",
        leg1Rate: 1.2845,
        leg2Symbol: "USD/JPY",
        leg2Rate: usdJpy,
        leg3Symbol: "GBP/JPY",
        leg3DirectRate: 200.92,
        impliedRate: +(1.2845 * usdJpy).toFixed(3),
        grossSpreadPips: +(((1.2845 * usdJpy) - 200.92) * 100).toFixed(2),
        feesAndSlippage: 0.35,
        netProfitPips: +(Math.abs(((1.2845 * usdJpy) - 200.92) * 100) - 0.35).toFixed(2),
        isExecutable: true
      }
    ]
  });
});

// GET /api/arbitrage/statarb
arbitrageRouter.get("/statarb", (req: Request, res: Response) => {
  const now = Date.now();
  const zScore1 = +(Math.sin(now / 2000) * 2.2).toFixed(2);

  res.json({
    success: true,
    pairs: [
      {
        pair1: "AUD/USD",
        pair2: "NZD/USD",
        hedgeRatioOLS: 0.842,
        spreadZScore: zScore1,
        adfTestPValue: 0.018,
        isCointegrated: true,
        signal: zScore1 > 1.8 ? "SHORT_SPREAD" : zScore1 < -1.8 ? "LONG_SPREAD" : "NEUTRAL",
        targetReversionPips: 4.8
      }
    ]
  });
});
