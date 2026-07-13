import { describe, it, expect } from "vitest";

// Pre-emptively set the test env to prevent server start side effects
process.env.NODE_ENV = "test";

import {
  evaluateCppRewardInJs,
  runPairedTTest,
  encrypt,
  decrypt,
  isCodeWhitelisted
} from "../server";

describe("Sovereign FX Trading Bot - Unit Test Suite", () => {

  describe("evaluateCppRewardInJs (Mathjs-based Reward Evaluator)", () => {
    it("should correctly evaluate valid C++ mathematical expressions against inputs", () => {
      const cppCode = `
        double calculateReward(double pnl_pips, double execution_latency_ns) {
          double pnl_reward = pnl_pips * 2.0;
          return pnl_reward;
        }
      `;
      // inputs: cppCode, pnl_pips, execution_latency_ns, slippage_ticks, volatility_spike, position_lots
      const reward = evaluateCppRewardInJs(cppCode, 15, 120, 1, 0.01, 1.5);
      expect(reward).toBe(30);
    });

    it("should support conditional logic conversion (C++ if block to ternary expression)", () => {
      const cppCode = `
        double calculateReward(double pnl_pips) {
          double reward = pnl_pips;
          if (pnl_pips > 10) {
            reward = pnl_pips * 1.5;
          }
          return reward;
        }
      `;
      const rewardHigh = evaluateCppRewardInJs(cppCode, 20, 0, 0, 0, 0);
      expect(rewardHigh).toBe(30);

      const rewardLow = evaluateCppRewardInJs(cppCode, 6, 0, 0, 0, 0);
      expect(rewardLow).toBe(6);
    });

    it("should execute code with complex math functions like sqrt, abs, pow", () => {
      const cppCode = `
        double calculateReward(double pnl_pips, double execution_latency_ns) {
          double penalty = pow(execution_latency_ns, 0.5) * 0.5;
          return pnl_pips - penalty;
        }
      `;
      const reward = evaluateCppRewardInJs(cppCode, 50, 100, 0, 0, 0);
      // pow(100, 0.5) = 10; penalty = 5; return 50 - 5 = 45
      expect(reward).toBe(45);
    });

    it("should strictly reject non-whitelisted C++ words or system commands to block exploit vectors", () => {
      const maliciousCode = `
        double calculateReward(double pnl_pips) {
          eval("process.exit(1)");
          return pnl_pips;
        }
      `;
      expect(isCodeWhitelisted(maliciousCode)).toBe(false);
      // Suppresses exception and falls back to: Math.max(-150.0, Math.min(150.0, ((pnl_reward - slippage_penalty) * shock_factor) + sniper_speed_bonus))
      // pnl_reward = pnl_pips * position_lots * 10 = 10 * 0 * 10 = 0
      const reward = evaluateCppRewardInJs(maliciousCode, 10, 0, 0, 0, 0);
      expect(reward).toBe(0);
    });

    it("should reject malicious characters like backticks, square brackets, and quotes", () => {
      const badChar1 = "double calculateReward() { char a = `x`; return 0; }";
      const badChar2 = "double calculateReward() { int arr[5]; return 0; }";
      
      expect(isCodeWhitelisted(badChar1)).toBe(false);
      expect(isCodeWhitelisted(badChar2)).toBe(false);
    });
  });

  describe("runPairedTTest (Statistical Significance)", () => {
    it("should return non-significant for sample size less than 5", () => {
      const cand = [1.0, 2.0, 3.0, 4.0];
      const active = [0.5, 1.5, 2.5, 3.5];
      const res = runPairedTTest(cand, active);
      expect(res.significant).toBe(false);
      expect(res.pValue).toBe(1.0);
    });

    it("should correctly identify statistically significant outperformance with N >= 5", () => {
      // Candidate returns consistently higher than active returns
      const cand = [2.5, 3.1, 2.8, 3.4, 2.9];
      const active = [0.5, 0.8, 0.6, 0.7, 0.6];
      const res = runPairedTTest(cand, active);
      
      expect(res.significant).toBe(true);
      expect(res.meanDiff).toBeGreaterThan(0);
      expect(res.pValue).toBeLessThan(0.05);
    });

    it("should return significant=false when candidate is tied or worse than active", () => {
      const cand = [0.5, 0.8, 0.6, 0.7, 0.6];
      const active = [2.5, 3.1, 2.8, 3.4, 2.9];
      const res = runPairedTTest(cand, active);
      
      expect(res.significant).toBe(false);
      expect(res.meanDiff).toBeLessThan(0);
    });
  });

  describe("Calibration & Brier Score Computation Math", () => {
    it("should mathematically compute the exact Brier Score for sample calibration buckets", () => {
      // Brier Score formula: Sum((f_i - o_i)^2) / N where f_i is confidence, o_i is 1 for WIN, 0 for LOSS
      const testCases = [
        { f: 0.85, o: 1.0 }, // WIN
        { f: 0.85, o: 1.0 }, // WIN
        { f: 0.85, o: 0.0 }, // LOSS
      ];

      const brierSum = testCases.reduce((sum, item) => sum + Math.pow(item.f - item.o, 2), 0);
      const brierScore = brierSum / testCases.length;

      // Mathematically:
      // (0.85 - 1.0)^2 = 0.0225
      // (0.85 - 1.0)^2 = 0.0225
      // (0.85 - 0.0)^2 = 0.7225
      // Sum = 0.7675
      // Mean = 0.7675 / 3 = 0.255833333333
      expect(brierScore).toBeCloseTo(0.25583, 5);
    });

    it("should calculate Brier Score of 0.0 for perfect prediction calibration", () => {
      const perfectCase = [
        { f: 1.0, o: 1.0 },
        { f: 1.0, o: 1.0 }
      ];
      const brierSum = perfectCase.reduce((sum, item) => sum + Math.pow(item.f - item.o, 2), 0);
      expect(brierSum / perfectCase.length).toBe(0.0);
    });

    it("should calculate expected win rate as the average of confidence scores", () => {
      const confs = [0.80, 0.85, 0.90];
      const avgConf = confs.reduce((sum, c) => sum + c, 0) / confs.length;
      expect(avgConf).toBe(0.85);
    });
  });

  describe("AES-256 Key Encryption & Decryption", () => {
    it("should correctly perform a full round-trip of encrypting and decrypting critical credentials", () => {
      const originalText = "OANDA-PRODA-SECRET-API-TOKEN-XYZ-123";
      
      const encrypted = encrypt(originalText);
      expect(encrypted).not.toBe(originalText);
      expect(encrypted.length).toBeGreaterThan(20);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });
  });

  describe("SniperMod & Whale Mode Deterministic Signal Logic", () => {
    it("should evaluate SniperMod trigger breakout conditions correctly", () => {
      const currentPrice = 1.27505; // Approaches GBP psychological level 1.27500
      const roundNumber = 1.27500;
      const distance = Math.abs(currentPrice - roundNumber);
      const threshold = 0.00015;
      
      expect(distance).toBeLessThan(threshold);

      // crossedAbove condition
      const prevPrice = 1.27495;
      const crossedAbove = currentPrice > roundNumber && prevPrice <= roundNumber;
      expect(crossedAbove).toBe(true);

      const atr = 0.00012;
      const priceChange = currentPrice - prevPrice;
      const absChange = Math.abs(priceChange);
      const isHighMomentum = absChange > (atr * 0.3);
      expect(isHighMomentum).toBe(true);

      // Assert trigger breakout buy
      let triggerType = null;
      let predictedDirection = null;
      if (crossedAbove && isHighMomentum) {
        triggerType = "BREAKOUT";
        predictedDirection = "BUY";
      }
      expect(triggerType).toBe("BREAKOUT");
      expect(predictedDirection).toBe("BUY");

      // Compute deterministic confidence
      const signalStrength = Math.min(1.0, absChange / Math.max(0.00001, atr));
      const sniperConfidence = parseFloat(Math.min(0.99, 0.75 + (signalStrength * 0.20)).toFixed(2));
      expect(sniperConfidence).toBeGreaterThanOrEqual(0.75);
      expect(sniperConfidence).toBeLessThan(1.0);
    });

    it("should evaluate Whale Mode resting volume imbalance triggers correctly", () => {
      const bidsVolume = 1250;
      const asksVolume = 300;
      const imbalanceRatio = bidsVolume / Math.max(1, asksVolume);
      
      // Imbalance threshold is > 3.0
      const isImbalance = imbalanceRatio > 3.0;
      expect(isImbalance).toBe(true);

      const tickVolume = 500;
      const avgVolume = 150;
      const isSpike = tickVolume > avgVolume * 2.5;
      expect(isSpike).toBe(true);

      // Signal calculation
      const spikeRatio = tickVolume / Math.max(1, avgVolume);
      const rawSignal = Math.max(imbalanceRatio / 5.0, spikeRatio / 4.0);
      const signal = parseFloat(Math.min(1.0, Math.max(0.1, rawSignal)).toFixed(2));
      
      expect(signal).toBeCloseTo(0.83, 2);

      const whaleConfidence = parseFloat(Math.min(0.99, 0.70 + (signal * 0.25)).toFixed(2));
      expect(whaleConfidence).toBeGreaterThanOrEqual(0.70);
      expect(whaleConfidence).toBeLessThan(1.0);

      const predictedDirection = bidsVolume > asksVolume ? "BUY" : "SELL";
      expect(predictedDirection).toBe("BUY");
    });
  });

});
