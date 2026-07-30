import { safetyBackstop } from "../../safetyBackstop";
import { pgDb } from "../db";
import { addServerLog } from "./logging";
import { demoLivePositions, demoLiveAccountStats } from "../state/tradingState";

export let liveRates: {
  eurUsd: number | string;
  gbpUsd: number | string;
  usdJpy: number | string;
  audUsd: number | string;
  btcUsd: number;
} = {
  eurUsd: 1.08520,
  gbpUsd: 1.27350,
  usdJpy: 156.440,
  audUsd: 0.66580,
  btcUsd: 65450.00
};

export let rollingTicks: Record<string, { price: number; volume: number }[]> = {
  "EUR/USD": [],
  "GBP/USD": [],
  "BTC/USD": []
};

export let currentWhaleSignals: Record<string, number> = {
  "EUR/USD": 0.0
};

export function getNumericRate(rate: number | string, fallback: number): number {
  return typeof rate === "number" ? rate : fallback;
}

export function getExposures(positions: any[]) {
  let totalNotional = 0;
  const singleExposures: Record<string, number> = {
    "EUR/USD": 0,
    "GBP/USD": 0,
    "BTC/USD": 0
  };
  
  let usdShortExposure = 0;
  let usdLongExposure = 0;

  for (const pos of positions) {
    const symNorm = pos.symbol.replace("/", "").toUpperCase();
    const price = pos.currentPrice || pos.entryPrice || (symNorm === "EURUSD" ? 1.085 : symNorm === "GBPUSD" ? 1.273 : 62500);
    const multiplier = (symNorm === "EURUSD" || symNorm === "GBPUSD") ? 100000 : 1;
    const notional = pos.size * multiplier * price;

    totalNotional += notional;
    
    let key = "EUR/USD";
    if (symNorm === "GBPUSD") key = "GBP/USD";
    else if (symNorm === "BTCUSD") key = "BTC/USD";
    singleExposures[key] = (singleExposures[key] || 0) + notional;

    if (key === "EUR/USD" || key === "GBP/USD") {
      if (pos.type === "BUY") {
        usdShortExposure += notional;
      } else if (pos.type === "SELL") {
        usdLongExposure += notional;
      }
    }
  }

  const correlatedGroupExposure = Math.max(usdShortExposure, usdLongExposure);

  return {
    totalNotional,
    singleExposures,
    correlatedGroupExposure,
    usdShortExposure,
    usdLongExposure
  };
}

export function checkExposureLimits(newPosition?: { symbol: string; type: "BUY" | "SELL"; size: number; entryPrice?: number }) {
  const safety = safetyBackstop.getState();
  const positions = [...demoLivePositions];
  if (newPosition) {
    positions.push({
      id: "simulated-test",
      symbol: newPosition.symbol,
      type: newPosition.type,
      size: newPosition.size,
      entryPrice: newPosition.entryPrice || 1.085,
      currentPrice: newPosition.entryPrice || 1.085,
      pnl: 0,
      pnlPips: 0
    });
  }

  const { totalNotional, singleExposures, correlatedGroupExposure } = getExposures(positions);

  if (totalNotional > safety.maxTotalNotionalExposure) {
    throw new Error(`Proposed position would push total exposure to $${totalNotional.toFixed(2)}, breaching maximum limit of $${safety.maxTotalNotionalExposure.toFixed(2)}.`);
  }

  for (const [inst, exp] of Object.entries(singleExposures)) {
    if (exp > safety.maxSingleInstrumentExposure) {
      throw new Error(`Proposed position would push single-instrument exposure for ${inst} to $${exp.toFixed(2)}, breaching maximum limit of $${safety.maxSingleInstrumentExposure.toFixed(2)}.`);
    }
  }

  if (correlatedGroupExposure > safety.maxCorrelatedGroupExposure) {
    throw new Error(`Proposed position would push correlated group exposure to $${correlatedGroupExposure.toFixed(2)}, breaching maximum limit of $${safety.maxCorrelatedGroupExposure.toFixed(2)}.`);
  }
}

export function assertTradingAllowed(newPosition?: {
  symbol?: string;
  type?: "BUY" | "SELL";
  size?: number;
  entryPrice?: number;
  confidence?: number;
  mode?: string;
}) {
  const safety = safetyBackstop.getState();

  // Rule 2: Evaluate Daily Loss Limit against live equity baseline & auto-resume timer
  if (typeof demoLiveAccountStats !== "undefined" && demoLiveAccountStats?.equity) {
    safetyBackstop.checkDailyLossLimit(demoLiveAccountStats.equity);
  }

  // 24-Hour Daily Loss Limit Halt Check
  if (safety.dailyLossLimitHaltActive) {
    throw new Error(`Trading forbidden: 24-Hour Daily Loss Limit Halt active until ${safety.dailyLossLimitAutoResumeAt || "24h expiry"}.`);
  }

  // Silent Lock Check
  if (safety.silentLockActive) {
    throw new Error(`Trading forbidden: Silent Lock is currently active: ${safety.silentLockTriggerReason || "Maximum drawdown limit breached"}`);
  }

  // Emergency Halt Check
  if (safety.emergencyHaltActive) {
    throw new Error("Trading forbidden: Emergency Halt is currently active.");
  }

  // Safe Mode Check
  if (safety.safeModeActive) {
    throw new Error(`Trading forbidden: Safe Mode is currently active: ${safety.safeModeTriggerReason || "Failover Mode"}`);
  }

  // Rule 1: Minimum Confidence Threshold Check (65% default)
  if (newPosition && typeof newPosition.confidence === "number") {
    const minThreshold = safety.globalMinConfidenceThreshold !== undefined ? safety.globalMinConfidenceThreshold : 0.65;
    if (newPosition.confidence < minThreshold) {
      const modeName = newPosition.mode || "Strategy";
      const sym = newPosition.symbol || "ALL";
      const logMsg = `🚫 [MIN CONFIDENCE FILTERED] Signal for ${sym} (${modeName}) with confidence ${(newPosition.confidence * 100).toFixed(1)}% BLOCKED - below global min threshold of ${(minThreshold * 100).toFixed(0)}%.`;

      addServerLog("RISK-MANAGER", "WARNING", logMsg);

      pgDb.query("INSERT INTO strategy_audit_logs", [
        null, sym, `${modeName} Blocked`, `${newPosition.confidence} Conf`,
        logMsg,
        JSON.stringify({ confidence: newPosition.confidence, globalMinThreshold: minThreshold, symbol: sym, mode: modeName }),
        JSON.stringify({ status: "BLOCKED_CONFIDENCE_THRESHOLD", symbol: sym, confidence: newPosition.confidence })
      ]);

      throw new Error(`Trading forbidden: Signal confidence ${(newPosition.confidence * 100).toFixed(1)}% is below global minimum threshold of ${(minThreshold * 100).toFixed(0)}%.`);
    }
  }

  // Rule 4: Instrument Demonstrated Edge Status Check
  if (newPosition && newPosition.symbol && safety.instrumentEdgeScores) {
    const edgeInfo = safety.instrumentEdgeScores[newPosition.symbol];
    if (edgeInfo && edgeInfo.allocationStatus === "DEPRIORITIZED" && edgeInfo.demonstratedEdgeScore <= 0) {
      const msg = `📉 [DEMONSTRATED EDGE BLOCKED] ${newPosition.symbol} is DEPRIORITIZED due to insufficient demonstrated edge (Sharpe: ${edgeInfo.sharpe}, WinRate: ${edgeInfo.winRate}%).`;
      addServerLog("RISK-MANAGER", "WARNING", msg);
      throw new Error(msg);
    }
  }

  // Exposure Limits Check
  if (newPosition && newPosition.symbol && newPosition.type && typeof newPosition.size === "number") {
    checkExposureLimits({ symbol: newPosition.symbol, type: newPosition.type, size: newPosition.size, entryPrice: newPosition.entryPrice });
  }
}

export function saveLiveTradingStateToDisk() {
  // Saved via DB or persistent cache in tradingState
}
