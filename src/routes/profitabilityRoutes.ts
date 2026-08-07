/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from "express";
import { evaluateWalkForwardOptimization } from "../services/walkForwardService";
import { simulateRealTradeExecution } from "../services/microstructureExecutionService";
import { calculateOrderFlowImbalance } from "../services/orderFlowService";
import { calculateDynamicRiskSizing } from "../services/dynamicRiskSizingService";

export const profitabilityRouter = Router();

// 1. Walk-Forward Optimization & Overfitting Evaluation
profitabilityRouter.post(["/wfo/evaluate", "/v1/wfo/evaluate"], (req: Request, res: Response) => {
  try {
    const candidateId = req.body.candidateId || "candidate-a";
    const candidateName = req.body.candidateName || "Reward Candidate #0412: Latency Optimized Sniper";
    const result = evaluateWalkForwardOptimization(candidateId, candidateName);
    res.json({ success: true, summary: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Real-Time Microstructure Execution Simulation (Slippage & Friction)
profitabilityRouter.post(["/microstructure/execution-sim", "/v1/microstructure/execution-sim"], (req: Request, res: Response) => {
  try {
    const { symbol = "EUR/USD", orderType = "BUY", orderSizeLots = 1.0, entryPrice = 1.08520, availableDepthLots = 10.0, volatilitySpike = 1.0 } = req.body;
    const result = simulateRealTradeExecution({
      symbol,
      orderType,
      orderSizeLots: Number(orderSizeLots),
      entryPrice: Number(entryPrice),
      availableDepthLots: Number(availableDepthLots),
      volatilitySpike: Number(volatilitySpike)
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Multi-Timeframe Order Flow Imbalance (OFI) Signal
profitabilityRouter.get(["/order-flow/ofi", "/v1/order-flow/ofi"], (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || "EUR/USD";
    const bid = Number(req.query.bid) || 1.08520;
    const ask = Number(req.query.ask) || 1.08528;
    const bidVol = Number(req.query.bidVol) || 5.2;
    const askVol = Number(req.query.askVol) || 3.1;

    const result = calculateOrderFlowImbalance(symbol, bid, ask, bidVol, askVol);
    res.json({ success: true, ofi: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Dynamic Fractional Kelly & Volatility Regime Risk Sizing
profitabilityRouter.post(["/risk/calculate-sizing", "/v1/risk/calculate-sizing"], (req: Request, res: Response) => {
  try {
    const {
      accountEquityUsd = 100000,
      winRatePct = 58,
      winLossRatio = 1.45,
      currentVolatilitySpike = 1.0,
      instrument = "EUR/USD",
      stopLossPips = 15,
      currentPrice = 1.08520
    } = req.body;

    const result = calculateDynamicRiskSizing({
      accountEquityUsd: Number(accountEquityUsd),
      winRatePct: Number(winRatePct),
      winLossRatio: Number(winLossRatio),
      currentVolatilitySpike: Number(currentVolatilitySpike),
      instrument,
      stopLossPips: Number(stopLossPips),
      currentPrice: Number(currentPrice)
    });

    res.json({ success: true, riskSizing: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
