export interface SovereignRuntimeState {
  systemVersion: string;
  systemStatus: "NOMINAL" | "THROTTLED" | "EMERGENCY_HALT";
  isShockAbsorberActive: boolean;
  shockAbsorberLevel: number;
  totalPnL: number;
  errorCount: number;
  currentRegimeState: {
    active: {
      trendRegime: string;
      trendStrength: number;
      volatilityRegime: string;
      volatilityAtr: number;
      marketSession: string;
      allocationWeights: Record<string, number>;
    };
    pending: {
      trendRegime: string;
      volatilityRegime: string;
      consecutiveCount: number;
    };
  };
}

export const initialRuntimeState: SovereignRuntimeState = {
  systemVersion: "1.5.0",
  systemStatus: "NOMINAL",
  isShockAbsorberActive: false,
  shockAbsorberLevel: 0.12,
  totalPnL: 3420.50,
  errorCount: 0,
  currentRegimeState: {
    active: {
      trendRegime: "RANGING",
      trendStrength: 15.0,
      volatilityRegime: "NORMAL",
      volatilityAtr: 0.5,
      marketSession: "Asian",
      allocationWeights: {
        member_0: 1.0,
        member_1: 1.0,
        member_2: 1.0,
        member_3: 1.0,
        member_4: 1.0,
        sniper_mod: 1.0,
        whale_mode: 1.0
      }
    },
    pending: {
      trendRegime: "RANGING",
      volatilityRegime: "NORMAL",
      consecutiveCount: 3
    }
  }
};
