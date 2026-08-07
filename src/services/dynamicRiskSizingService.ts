/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RiskSizingParams {
  accountEquityUsd: number;
  winRatePct: number; // e.g. 58 for 58%
  winLossRatio: number; // e.g. 1.5 (Avg Win / Avg Loss)
  kellyFraction?: number; // default 0.25 (Quarter-Kelly for conservative safety)
  currentVolatilitySpike?: number; // 1.0 = normal, 2.5+ = high GARCH volatility
  instrument: string;
  stopLossPips: number;
  currentPrice: number;
}

export interface RiskSizingResult {
  instrument: string;
  accountEquityUsd: number;
  fullKellyFraction: number; // f* = p - (1-p)/b
  quarterKellyFraction: number;
  volatilityRegime: 'LOW_VOLATILITY' | 'NORMAL' | 'HIGH_GARCH_SPIKE' | 'EXTREME_SHOCK';
  volatilityRegimeMultiplier: number; // 0.2 to 1.2
  recommendedPositionSizeLots: number;
  riskAmountUsd: number;
  riskPctOfEquity: number;
  riskOfRuinPct: number; // Probability of 20% drawdown breach
  isApprovedByRiskGuard: boolean;
  guardRejectionReason?: string;
  timestamp: string;
}

/**
 * Calculates optimal position sizing using the Fractional Kelly Criterion,
 * adjusted dynamically for market volatility regimes and strict Risk-of-Ruin caps.
 */
export function calculateDynamicRiskSizing(params: RiskSizingParams): RiskSizingResult {
  const {
    accountEquityUsd,
    winRatePct,
    winLossRatio,
    kellyFraction = 0.25,
    currentVolatilitySpike = 1.0,
    instrument,
    stopLossPips,
    currentPrice
  } = params;

  const p = Math.max(0.1, Math.min(0.95, winRatePct / 100.0));
  const q = 1.0 - p;
  const b = Math.max(0.2, winLossRatio);

  // Full Kelly Formula: f* = p - (q / b) = (p * b - q) / b
  const fullKellyFraction = Math.max(0, (p * b - q) / b);
  const quarterKellyFraction = fullKellyFraction * kellyFraction;

  // Volatility Regime Assessment
  let volatilityRegime: 'LOW_VOLATILITY' | 'NORMAL' | 'HIGH_GARCH_SPIKE' | 'EXTREME_SHOCK' = 'NORMAL';
  let volatilityRegimeMultiplier = 1.0;

  if (currentVolatilitySpike >= 3.5) {
    volatilityRegime = 'EXTREME_SHOCK';
    volatilityRegimeMultiplier = 0.25;
  } else if (currentVolatilitySpike >= 2.0) {
    volatilityRegime = 'HIGH_GARCH_SPIKE';
    volatilityRegimeMultiplier = 0.5;
  } else if (currentVolatilitySpike < 0.8) {
    volatilityRegime = 'LOW_VOLATILITY';
    volatilityRegimeMultiplier = 1.15;
  }

  // Adjusted fractional Kelly risk %
  let effectiveRiskPct = quarterKellyFraction * volatilityRegimeMultiplier;
  
  // Enforce Hard Risk-of-Ruin Cap (Never risk > 1.5% of account equity per single trade)
  const maxCapPct = 0.015; 
  if (effectiveRiskPct > maxCapPct) {
    effectiveRiskPct = maxCapPct;
  }

  const riskAmountUsd = accountEquityUsd * effectiveRiskPct;

  // Calculate position size in lots based on stop loss distance in USD per lot
  const isCrypto = instrument.includes('BTC');
  const pipMultiplier = isCrypto ? 1.0 : 0.0001;
  const stopLossDistance = Math.max(5.0, stopLossPips);
  const usdPerPipPerLot = isCrypto ? 1.0 : 10.0; // Standard lot for FX = $10/pip
  const lossPerLotUsd = stopLossDistance * usdPerPipPerLot;

  let recommendedPositionSizeLots = lossPerLotUsd > 0 ? riskAmountUsd / lossPerLotUsd : 0.1;

  // Cap lot sizing to realistic limits
  recommendedPositionSizeLots = parseFloat(Math.max(0.01, Math.min(isCrypto ? 2.5 : 10.0, recommendedPositionSizeLots)).toFixed(2));

  // Risk-of-Ruin Calculation (Analytical approximation for 20% drawdown breach)
  // RoR = ((1 - (b-1)*p) / (1 + (b-1)*p)) ^ (Equity * RiskFraction / LossUnit)
  const edge = p * b - q;
  const riskOfRuinPct = edge > 0 
    ? parseFloat((Math.exp(-2.0 * edge * (1.0 / (effectiveRiskPct + 0.001))) * 100).toFixed(2))
    : 99.9;

  let isApprovedByRiskGuard = true;
  let guardRejectionReason: string | undefined;

  if (fullKellyFraction <= 0) {
    isApprovedByRiskGuard = false;
    guardRejectionReason = `Strategy edge is negative or non-existent (WinRate: ${winRatePct}%, Win/Loss Ratio: ${winLossRatio}). Kelly calculation yielded 0 allocation.`;
  } else if (riskOfRuinPct > 5.0) {
    isApprovedByRiskGuard = false;
    guardRejectionReason = `Risk of Ruin (${riskOfRuinPct}%) exceeds maximum allowable threshold (5.0%). Position sizing rejected.`;
  }

  return {
    instrument,
    accountEquityUsd,
    fullKellyFraction: parseFloat(fullKellyFraction.toFixed(4)),
    quarterKellyFraction: parseFloat(quarterKellyFraction.toFixed(4)),
    volatilityRegime,
    volatilityRegimeMultiplier: parseFloat(volatilityRegimeMultiplier.toFixed(2)),
    recommendedPositionSizeLots,
    riskAmountUsd: parseFloat(riskAmountUsd.toFixed(2)),
    riskPctOfEquity: parseFloat((effectiveRiskPct * 100).toFixed(2)),
    riskOfRuinPct,
    isApprovedByRiskGuard,
    guardRejectionReason,
    timestamp: new Date().toISOString()
  };
}
