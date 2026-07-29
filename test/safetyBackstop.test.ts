import { describe, it, expect, beforeEach } from "vitest";
import { safetyBackstop } from "../safetyBackstop";

describe("SafetyBackstop Pre-trade Drawdown Enforcement", () => {
  beforeEach(() => {
    safetyBackstop.updateState({
      emergencyHaltActive: false,
      silentLockActive: false,
      dailyLossLimitHaltActive: false,
      drawdownThresholdPct: 5.0,
      peakEquity: 100000,
      lastDrawdownPct: 0
    });
  });

  it("should allow trades within acceptable drawdown parameters", () => {
    const res = safetyBackstop.checkDrawdown(500, 98000);
    expect(res.allowed).toBe(true);
    expect(res.drawdownPct).toBeLessThan(5.0);
  });

  it("should block trades if current drawdown exceeds the maximum threshold", () => {
    const res = safetyBackstop.checkDrawdown(100, 94000); // 6% drawdown
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("exceeds max threshold");
  });

  it("should block trade if projected loss would breach drawdown threshold", () => {
    const res = safetyBackstop.checkDrawdown(2000, 96000); // projected equity 94000 = 6% drawdown
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Pre-trade risk check failed");
  });

  it("should strictly block trades during Emergency Halt", () => {
    safetyBackstop.updateState({ emergencyHaltActive: true });
    const res = safetyBackstop.checkDrawdown(100, 100000);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Emergency Halt is active");
  });
});
