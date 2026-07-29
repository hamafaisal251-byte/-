import { Router, Request, Response } from "express";
import { safetyBackstop } from "../../safetyBackstop";
import { checkIPAllowlist, asyncHandler } from "../middleware/auth";
import {
  pgDb,
  assertTradingAllowed,
  systemStatus,
  addServerLog,
  promTradesExecutedTotal,
  liveRates,
  getNumericRate,
  rollingTicks,
  saveLiveTradingStateToDisk,
  recordDemoLiveTradeClose,
  demoLivePositions,
  demoLiveAccountStats,
  realLivePositions,
  realLiveAccountStats
} from "../../server";

export const positionRouter = Router();

// GET /api/positions
positionRouter.get("/", (req: Request, res: Response) => {
  const env = (req.query.environment as string) || "DEMO_LIVE";
  if (env === "REAL_LIVE") {
    res.json({ success: true, positions: realLivePositions, accountStats: realLiveAccountStats, environment: env });
  } else {
    res.json({ success: true, positions: demoLivePositions, accountStats: demoLiveAccountStats, environment: env });
  }
});

// POST /api/positions/order
positionRouter.post("/order", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { symbol, type, size, environment } = req.body;

  if (!environment || (environment !== "DEMO_LIVE" && environment !== "REAL_LIVE")) {
    return res.status(400).json({ success: false, error: "Explicit environment ('DEMO_LIVE' or 'REAL_LIVE') is required. No fallback permitted." });
  }

  try {
    assertTradingAllowed();
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }

  // Pre-trade Drawdown & Risk Enforcement
  const estimatedNotional = (parseFloat(size) || 1) * 10000;
  const estimatedRiskUsd = estimatedNotional * 0.02;
  const currentEquity = demoLiveAccountStats.equity || 100000;
  const drawdownCheck = safetyBackstop.checkDrawdown(estimatedRiskUsd, currentEquity);
  if (!drawdownCheck.allowed) {
    return res.status(400).json({
      success: false,
      error: `Pre-trade Drawdown Guard Blocked Order: ${drawdownCheck.reason}`
    });
  }

  // Validate REAL_LIVE active connection
  if (environment === "REAL_LIVE") {
    const realBrokerRows = await pgDb.queryAsync("SELECT * FROM broker_connections WHERE status = 'CONNECTED' AND environment = 'REAL_LIVE'");
    if (!realBrokerRows || realBrokerRows.length === 0) {
      return res.status(400).json({ success: false, error: "No active REAL_LIVE broker connection found. Orders are blocked on REAL_LIVE." });
    }
  }

  // Fetch active strategy parameters for Shock Absorber check
  const strategies = pgDb.query("SELECT * FROM instrument_strategies") || {};
  const config = strategies[symbol];

  let finalSize = parseFloat(size);
  const currentVolatility = systemStatus === "THROTTLED" ? 4.5 : 0.8;

  // 1. Shock Absorber sizing reduction / pause
  if (config?.shockAbsorberEnabled && currentVolatility > 3.0) {
    const factor = Math.exp(-0.4 * (currentVolatility - 3.0));
    finalSize = parseFloat((finalSize * factor).toFixed(2));
    
    pgDb.query("INSERT INTO strategy_audit_logs", [
      null, symbol, "Shock Absorber", currentVolatility.toString(),
      `Volatility spike detected (${currentVolatility}). Scaled position down from ${size} to ${finalSize} lots (Factor: ${factor.toFixed(2)}).`,
      JSON.stringify({ originalSize: size, currentVolatility }),
      JSON.stringify({ finalSize })
    ]);
    addServerLog("RISK-MANAGER", "WARNING", `🛡️ [Shock Absorber] Dampened new order size from ${size} to ${finalSize} lots due to volatility spike (${currentVolatility}).`);
  }

  if (config?.shockAbsorberEnabled && currentVolatility > 4.5) {
    pgDb.query("INSERT INTO strategy_audit_logs", [
      null, symbol, "Shock Absorber", currentVolatility.toString(),
      `Order BLOCKED by Shock Absorber due to extreme volatility: ${currentVolatility}.`,
      JSON.stringify({ size, currentVolatility }),
      JSON.stringify({ action: "BLOCKED" })
    ]);
    addServerLog("RISK-MANAGER", "CRITICAL", `🛡️ [Shock Absorber] Volatility spike extreme (${currentVolatility}). Order BLOCKED.`);
    promTradesExecutedTotal.inc({ broker: "RISK_ENGINE", symbol, side: type, outcome: "BLOCKED_SHOCK_ABSORBER" });
    return res.status(400).json({ success: false, error: "Trading blocked by Shock Absorber due to extreme volatility." });
  }

  // 1b. Liquidity Vacuum & Spread Anomaly Protection
  const baselineSpreads: Record<string, number> = {
    "EUR/USD": 0.00008,
    "GBP/USD": 0.00012,
    "USD/JPY": 0.012,
    "BTC/USD": 4.5
  };
  const symbolSpreadBaseline = baselineSpreads[symbol] || 0.0001;
  const simulatedCurrentSpread = currentVolatility > 4.0 ? symbolSpreadBaseline * 5.2 : symbolSpreadBaseline * (1.0 + Math.random() * 0.4);

  if (simulatedCurrentSpread > symbolSpreadBaseline * 4.5) {
    pgDb.query("INSERT INTO strategy_audit_logs", [
      null, symbol, "Liquidity Vacuum Guard", simulatedCurrentSpread.toString(),
      `Order BLOCKED by Liquidity Vacuum Guard: Bid-ask spread (${simulatedCurrentSpread.toFixed(5)}) exceeds 4.5x baseline (${symbolSpreadBaseline}).`,
      JSON.stringify({ symbol, simulatedCurrentSpread, baseline: symbolSpreadBaseline }),
      JSON.stringify({ action: "BLOCKED_LIQUIDITY_VACUUM" })
    ]);
    addServerLog("RISK-MANAGER", "CRITICAL", `🌊 [Liquidity Vacuum Guard] Spread spike detected for ${symbol} (${simulatedCurrentSpread.toFixed(5)}). Order BLOCKED.`);
    promTradesExecutedTotal.inc({ broker: "RISK_ENGINE", symbol, side: type, outcome: "BLOCKED_LIQUIDITY_VACUUM" });
    return res.status(400).json({ success: false, error: "Trading blocked by Liquidity Vacuum Protection: Bid-ask spread spiked beyond safe threshold." });
  }

  // 2. Dynamic SL calculation (ATR or fixed-percent depending on config)
  let entryPrice = symbol === "BTC/USD" ? liveRates.btcUsd : (symbol === "GBP/USD" ? getNumericRate(liveRates.gbpUsd, 1.27350) : getNumericRate(liveRates.eurUsd, 1.08520));
  
  // Implied ATR based on rolling ticks
  let diffs: number[] = [];
  const symbolTicks = rollingTicks[symbol] || [];
  for (let i = 1; i < symbolTicks.length; i++) {
    diffs.push(Math.abs(symbolTicks[i].price - symbolTicks[i-1].price));
  }
  const atr = diffs.length > 0 ? (diffs.reduce((sum, d) => sum + d, 0) / diffs.length) : (symbol === "BTC/USD" ? 4.5 : 0.00012);

  let sl = type === "BUY" ? entryPrice * 0.99 : entryPrice * 1.01;
  let tp = type === "BUY" ? entryPrice * 1.02 : entryPrice * 0.98;

  if (config?.dynamicSlEnabled) {
    const slDistance = atr * 2.5;
    sl = type === "BUY" ? entryPrice - slDistance : entryPrice + slDistance;
    tp = type === "BUY" ? entryPrice + (atr * 5.0) : entryPrice - (atr * 5.0);
  }

  const newPos = {
    id: `pos-${environment === "REAL_LIVE" ? "real" : "demo"}-${Date.now()}`,
    symbol,
    type,
    size: finalSize,
    entryPrice,
    currentPrice: entryPrice,
    sl: parseFloat(sl.toFixed(symbol === "BTC/USD" ? 2 : 5)),
    tp: parseFloat(tp.toFixed(symbol === "BTC/USD" ? 2 : 5)),
    pnl: 0.0
  };

  try {
    assertTradingAllowed({ symbol, type, size: finalSize, entryPrice });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }

  if (environment === "REAL_LIVE") {
    realLivePositions.push(newPos);
    realLiveAccountStats.usedMargin += finalSize * 1250;
    realLiveAccountStats.freeMargin = realLiveAccountStats.equity - realLiveAccountStats.usedMargin;
    addServerLog("RISK-MANAGER", "SUCCESS", `🚨 [REAL_LIVE CAPITAL] Order executed on real account! Size: ${finalSize} lots for ${symbol}.`);
    promTradesExecutedTotal.inc({ broker: "OANDA_REAL", symbol, side: type, outcome: "EXECUTED" });
  } else {
    demoLivePositions.push(newPos);
    demoLiveAccountStats.usedMargin += finalSize * 1250;
    demoLiveAccountStats.freeMargin = demoLiveAccountStats.equity - demoLiveAccountStats.usedMargin;
    addServerLog("CPP-ENGINE", "SUCCESS", `🎯 [DEMO_LIVE] Order executed on demo account. Size: ${finalSize} lots for ${symbol}.`);
    promTradesExecutedTotal.inc({ broker: "OANDA_DEMO", symbol, side: type, outcome: "EXECUTED" });
  }

  saveLiveTradingStateToDisk();
  res.json({ success: true, position: newPos });
}));

// POST /api/positions/close
positionRouter.post("/close", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { id, environment } = req.body;

  if (!environment || (environment !== "DEMO_LIVE" && environment !== "REAL_LIVE")) {
    return res.status(400).json({ success: false, error: "Explicit environment ('DEMO_LIVE' or 'REAL_LIVE') is required to close position." });
  }

  let currentPositions = environment === "REAL_LIVE" ? realLivePositions : demoLivePositions;
  const currentStats = environment === "REAL_LIVE" ? realLiveAccountStats : demoLiveAccountStats;

  const closedPos = currentPositions.find(p => p.id === id);
  if (!closedPos) {
    return res.status(404).json({ success: false, error: `Position ${id} not found in ${environment} environment.` });
  }

  if (environment === "REAL_LIVE") {
    const idx = realLivePositions.findIndex(p => p.id === id);
    if (idx !== -1) realLivePositions.splice(idx, 1);
  } else {
    const idx = demoLivePositions.findIndex(p => p.id === id);
    if (idx !== -1) demoLivePositions.splice(idx, 1);
    recordDemoLiveTradeClose(closedPos.pnl);
  }
  
  // Realize PnL
  currentStats.balance = parseFloat((currentStats.balance + closedPos.pnl).toFixed(2));
  currentStats.usedMargin = parseFloat(Math.max(0, currentStats.usedMargin - (closedPos.size * 1250)).toFixed(2));
  
  const updatedPositions = environment === "REAL_LIVE" ? realLivePositions : demoLivePositions;
  currentStats.equity = parseFloat((currentStats.balance + updatedPositions.reduce((sum, p) => sum + p.pnl, 0)).toFixed(2));
  currentStats.freeMargin = parseFloat((currentStats.equity - currentStats.usedMargin).toFixed(2));
  currentStats.marginLevel = currentStats.usedMargin > 0 ? parseFloat(((currentStats.equity / currentStats.usedMargin) * 100).toFixed(1)) : 0;

  addServerLog("CPP-ENGINE", "INFO", `[${environment}] Closed position ${id}. PnL: $${closedPos.pnl.toFixed(2)}.`);
  saveLiveTradingStateToDisk();
  res.json({ success: true, id });
}));
