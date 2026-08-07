/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExecutionSimParams {
  symbol: string;
  orderType: 'BUY' | 'SELL';
  orderSizeLots: number;
  entryPrice: number;
  availableDepthLots?: number;
  volatilitySpike?: number; // 1.0 = baseline, 3.0+ = shock
  baseSpreadPips?: number;
  commissionPerLotUsd?: number;
}

export interface ExecutionSimResult {
  symbol: string;
  requestedPrice: number;
  executedPrice: number;
  grossPnlPips: number;
  netPnlPips: number;
  netPnlUsd: number;
  halfSpreadDeductionPips: number;
  slippagePips: number;
  commissionUsd: number;
  simulatedLatencyMs: number;
  tcpCongestionMultiplier: number;
  priceDriftPips: number;
  effectiveFrictionPct: number;
  timestamp: string;
}

/**
 * Asymmetric Power-Law / EVT Jump-Impact Slippage Model:
 * Slippage = Eta * sigma * (Q / Depth)^alpha + JumpImpact
 * where alpha = 1.35 (super-linear power law), Eta = asymmetric coefficient
 */
export function calculateAsymmetricEvtSlippage(
  orderSizeLots: number,
  availableDepthLots: number,
  volatilitySpike: number,
  isBuy: boolean,
  baseSlippagePips: number
): number {
  const depthRatio = orderSizeLots / Math.max(0.1, availableDepthLots);
  const powerLawAlpha = 1.35; // Empirical power law exponent for high-frequency depth consumption
  
  // Asymmetric liquidity parameter (ask liquidity tends to evaporate faster during panic buys)
  const asymmetryFactor = isBuy ? 1.15 : 1.0;
  
  // Power-law impact
  const powerLawImpact = Math.pow(depthRatio, powerLawAlpha) * asymmetryFactor;
  
  // Extreme Value Theory (EVT) tail jump factor when volatility breaches shock thresholds (>2.5x)
  let evtTailJump = 0;
  if (volatilitySpike > 2.5) {
    const tailXi = 0.25; // Generalized Pareto shape parameter
    evtTailJump = (baseSlippagePips * Math.pow(volatilitySpike, 1.8)) / (1.0 - tailXi);
  }

  return baseSlippagePips * (1.0 + powerLawImpact) * volatilitySpike + evtTailJump;
}

/**
 * Heavy-Tailed Log-Normal / Pareto Latency Engine with TCP Socket Queue Congestion
 */
export function simulateHeavyTailedLatency(volatilitySpike: number): { latencyMs: number; congestionMult: number } {
  // Base log-normal distribution for latency: meanlog = 1.6 (5ms median), sdlog = 0.65
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.max(1e-10, Math.random());
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  const baseLatencyMs = Math.exp(1.6 + 0.65 * z); // Heavy tail
  
  // Socket queue congestion during high volatility spikes (Pareto burst factor)
  let congestionMult = 1.0;
  if (volatilitySpike > 1.8) {
    const paretoShape = 1.5;
    const paretoScale = 1.2;
    const paretoRandom = paretoScale / Math.pow(Math.max(1e-5, Math.random()), 1.0 / paretoShape);
    congestionMult = Math.min(8.0, paretoRandom);
  }

  const finalLatencyMs = parseFloat((baseLatencyMs * congestionMult).toFixed(2));
  return {
    latencyMs: finalLatencyMs,
    congestionMult: parseFloat(congestionMult.toFixed(2))
  };
}

/**
 * Real-Time Microstructure Execution Engine:
 * Simulates non-linear market impact slippage, bid-ask spread costs,
 * heavy-tailed latency, and broker commission fees.
 */
export function simulateRealTradeExecution(params: ExecutionSimParams): ExecutionSimResult {
  const {
    symbol,
    orderType,
    orderSizeLots,
    entryPrice,
    availableDepthLots = 10.0,
    volatilitySpike = 1.0,
    baseSpreadPips = symbol.includes('BTC') ? 15.0 : symbol.includes('GBP') ? 1.2 : 0.8,
    commissionPerLotUsd = symbol.includes('BTC') ? 12.0 : 6.0
  } = params;

  // 1. Half-Spread Deduction (in pips)
  const halfSpreadPips = baseSpreadPips / 2.0;

  // 2. Asymmetric Power-Law EVT Jump-Impact Slippage
  const baseSlippage = symbol.includes('BTC') ? 2.5 : 0.2;
  const slippagePips = calculateAsymmetricEvtSlippage(
    orderSizeLots,
    availableDepthLots,
    volatilitySpike,
    orderType === 'BUY',
    baseSlippage
  );

  // 3. Heavy-Tailed Latency Simulation with TCP Socket Congestion
  const { latencyMs: simulatedLatencyMs, congestionMult: tcpCongestionMultiplier } = simulateHeavyTailedLatency(volatilitySpike);
  
  // Price drift during latency window
  const driftDirection = Math.random() > 0.45 ? 1 : -1;
  const priceDriftPips = (simulatedLatencyMs / 1000.0) * volatilitySpike * 0.8 * driftDirection;

  // Total execution friction in pips
  const totalFrictionPips = halfSpreadPips + slippagePips + Math.max(0, priceDriftPips * (orderType === 'BUY' ? 1 : -1));

  const pipMultiplier = symbol.includes('BTC') ? 1.0 : 0.0001;
  const executedPrice = orderType === 'BUY' 
    ? entryPrice + (totalFrictionPips * pipMultiplier)
    : entryPrice - (totalFrictionPips * pipMultiplier);

  // Commission calculation
  const commissionUsd = orderSizeLots * commissionPerLotUsd;

  // Assume baseline 10 pip movement for evaluation
  const hypotheticalGrossMovePips = 12.5;
  const grossPnlPips = hypotheticalGrossMovePips;
  const netPnlPips = grossPnlPips - totalFrictionPips;

  const pipValueUsd = symbol.includes('BTC') ? 1.0 : (orderSizeLots * 100000 * 0.0001);
  const netPnlUsd = (netPnlPips * pipValueUsd) - commissionUsd;

  const effectiveFrictionPct = parseFloat(((totalFrictionPips / hypotheticalGrossMovePips) * 100).toFixed(2));

  return {
    symbol,
    requestedPrice: parseFloat(entryPrice.toFixed(symbol.includes('BTC') ? 2 : 5)),
    executedPrice: parseFloat(executedPrice.toFixed(symbol.includes('BTC') ? 2 : 5)),
    grossPnlPips: parseFloat(grossPnlPips.toFixed(2)),
    netPnlPips: parseFloat(netPnlPips.toFixed(2)),
    netPnlUsd: parseFloat(netPnlUsd.toFixed(2)),
    halfSpreadDeductionPips: parseFloat(halfSpreadPips.toFixed(2)),
    slippagePips: parseFloat(slippagePips.toFixed(2)),
    commissionUsd: parseFloat(commissionUsd.toFixed(2)),
    simulatedLatencyMs,
    tcpCongestionMultiplier,
    priceDriftPips: parseFloat(priceDriftPips.toFixed(3)),
    effectiveFrictionPct,
    timestamp: new Date().toISOString()
  };
}
