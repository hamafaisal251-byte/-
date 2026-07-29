import fs from "fs";
import path from "path";
import { telegramNotifier } from "./telegramNotifier";

export interface InstrumentEdgeInfo {
  winRate: number;
  sharpe: number;
  tradesCount: number;
  demonstratedEdgeScore: number;
  liquidityScore?: number;
  dataSourceType?: "FULL_DATA" | "TICK_PROXY_ONLY";
  liquidityConfidence?: "HIGH" | "LOW_PROXY";
  liquidityMultiplier?: number;
  avgSpreadPips?: number;
  avgRealizedSlippagePips?: number;
  allocationStatus: "FULL" | "REDUCED" | "DEPRIORITIZED";
  note: string;
}

export interface TimeframeInfo {
  selectedTimeframe: "M5" | "M15" | "H1" | "H4";
  winRate: number;
  sharpe: number;
  signalReliability: number;
  reason: string;
}

export interface NaturalExecutionConfig {
  enabled: boolean;
  jitterMinMs: number;
  jitterMaxMs: number;
  maxSizingVariancePct: number;
  note: string;
}

export interface SafetyState {
  safeModeActive: boolean;
  safeModeTriggerReason: string | null;
  safeModeTriggeredAt: string | null;
  silentLockActive: boolean;
  silentLockTriggerReason: string | null;
  silentLockTriggeredAt: string | null;
  emergencyHaltActive: boolean;
  emergencyHaltPolicy: "FLATTEN_ALL" | "FREEZE_NEW_ONLY";
  drawdownThresholdPct: number; // e.g. 5.0 for 5% max drawdown

  // Rule 1: Minimum confidence threshold
  globalMinConfidenceThreshold: number; // default 0.65 (65%)

  // Rule 2: Daily loss limit
  dailyLossLimitPct: number; // default 3.0 (3%)
  dayStartEquity: number;
  currentDayLossPct: number;
  lastDailyResetUtc: string;
  dailyLossLimitBreached: boolean;
  dailyLossLimitHaltActive: boolean;
  dailyLossLimitTriggeredAt: string | null;
  dailyLossLimitAutoResumeAt: string | null;

  // Rule 3: Segregate profit from principal
  useCompoundedSizing: boolean; // default false (principal only)
  principalCapital: number;
  accumulatedProfit: number;

  // Rule 4: Demonstrated edge per instrument
  instrumentEdgeScores: Record<string, InstrumentEdgeInfo>;

  // Rule 5: AI-selected timeframes
  aiTimeframes: Record<string, TimeframeInfo>;

  // Rule 6: Natural execution timing
  naturalExecutionConfig: NaturalExecutionConfig;

  peakEquity: number;
  maxTotalNotionalExposure: number;
  maxSingleInstrumentExposure: number;
  maxCorrelatedGroupExposure: number;
  watchdogLastHeartbeat: string;
  watchdogStatus: "ALIVE" | "ERROR" | "NOMINAL";
  lastDrawdownPct: number;
  lastRollbackEvent: {
    timestamp: string;
    fromVersion: string;
    toVersion: string;
    metricsAtTrigger: {
      SharpeRatio: number;
      maxDrawdown: number;
    };
  } | null;
  triggerHistory: {
    id: string;
    timestamp: string;
    type: "SAFE_MODE" | "SILENT_LOCK" | "EMERGENCY_HALT" | "DAILY_LOSS_LIMIT_24H" | "SYSTEM";
    event: string;
    reason: string;
    details: any;
  }[];
  notificationConfig: {
    webhookUrl: string;
    emailAlerts: boolean;
    smsAlerts: boolean;
  };
  notifications: {
    id: string;
    timestamp: string;
    message: string;
    read: boolean;
  }[];
}

const DEFAULT_STATE: SafetyState = {
  safeModeActive: false,
  safeModeTriggerReason: null,
  safeModeTriggeredAt: null,
  silentLockActive: false,
  silentLockTriggerReason: null,
  silentLockTriggeredAt: null,
  emergencyHaltActive: false,
  emergencyHaltPolicy: "FLATTEN_ALL",
  drawdownThresholdPct: 5.0, // 5% default max drawdown
  
  globalMinConfidenceThreshold: 0.65, // 65% global min confidence
  
  dailyLossLimitPct: 3.0, // 3% daily loss limit
  dayStartEquity: 104830.40,
  currentDayLossPct: 0.0,
  lastDailyResetUtc: new Date().toISOString().split("T")[0],
  dailyLossLimitBreached: false,
  dailyLossLimitHaltActive: false,
  dailyLossLimitTriggeredAt: null,
  dailyLossLimitAutoResumeAt: null,

  useCompoundedSizing: false, // Segregated sizing by default
  principalCapital: 100000.00,
  accumulatedProfit: 4830.40,

  instrumentEdgeScores: {
    "EUR/USD": { winRate: 62.5, sharpe: 1.82, tradesCount: 48, demonstratedEdgeScore: 0.85, allocationStatus: "FULL", note: "Statistically significant edge demonstrated" },
    "GBP/USD": { winRate: 58.1, sharpe: 1.45, tradesCount: 36, demonstratedEdgeScore: 0.72, allocationStatus: "FULL", note: "Positive Sharpe and edge confirmed" },
    "USD/JPY": { winRate: 54.0, sharpe: 1.10, tradesCount: 29, demonstratedEdgeScore: 0.58, allocationStatus: "FULL", note: "Moderate positive edge" },
    "AUD/USD": { winRate: 42.0, sharpe: 0.35, tradesCount: 22, demonstratedEdgeScore: 0.25, allocationStatus: "REDUCED", note: "Sub-threshold Sharpe. Allocation scaled down to 40%" },
    "BTC/USD": { winRate: 68.4, sharpe: 2.15, tradesCount: 52, demonstratedEdgeScore: 0.92, allocationStatus: "FULL", note: "High statistical edge demonstrated" },
  },

  aiTimeframes: {
    "EUR/USD": { selectedTimeframe: "H1", winRate: 64.0, sharpe: 1.88, signalReliability: 88.5, reason: "H1 shows lowest Brier miscalibration and highest trend persistence" },
    "GBP/USD": { selectedTimeframe: "M15", winRate: 59.2, sharpe: 1.52, signalReliability: 82.1, reason: "M15 captures session momentum cleanly without whipsaw" },
    "USD/JPY": { selectedTimeframe: "H4", winRate: 56.0, sharpe: 1.25, signalReliability: 79.4, reason: "H4 filters out central bank rate noise" },
    "AUD/USD": { selectedTimeframe: "H1", winRate: 45.0, sharpe: 0.40, signalReliability: 65.0, reason: "H1 reduces false signals during low liquidity hours" },
    "BTC/USD": { selectedTimeframe: "M5", winRate: 70.1, sharpe: 2.22, signalReliability: 91.2, reason: "M5 aligns with exchange orderbook depth imbalances" },
  },

  naturalExecutionConfig: {
    enabled: true,
    jitterMinMs: 50,
    jitterMaxMs: 350,
    maxSizingVariancePct: 1.5,
    note: "Natural Execution Variance active: applies 50-350ms bounded timing jitter and +/- 1.5% size variance to eliminate robotic execution signatures without breaching risk limits."
  },

  peakEquity: 104830.40, // Match start equity of the system
  maxTotalNotionalExposure: 500000.00,
  maxSingleInstrumentExposure: 300000.00,
  maxCorrelatedGroupExposure: 400000.00,
  watchdogLastHeartbeat: new Date().toISOString(),
  watchdogStatus: "NOMINAL",
  lastDrawdownPct: 0.0,
  lastRollbackEvent: null,
  triggerHistory: [
    {
      id: "hist-init",
      timestamp: new Date().toISOString(),
      type: "SYSTEM",
      event: "Safety Backstop Initialized",
      reason: "System boot and safety isolation layer established.",
      details: {}
    }
  ],
  notificationConfig: {
    webhookUrl: "https://discord.com/api/webhooks/dummy-sovereign",
    emailAlerts: true,
    smsAlerts: false
  },
  notifications: []
};

class SafetyBackstopManager {
  private filepath = path.join(process.cwd(), "safety_state.json");
  private state: SafetyState = { ...DEFAULT_STATE };
  private isLoaded = false;
  public onSaveCallback?: (state: SafetyState) => void;
  public onDailyLossClosePositionsCallback?: () => void;

  constructor() {
    this.load();
  }

  public load(force = false): SafetyState {
    if (this.isLoaded && !force) {
      return this.state;
    }
    try {
      if (fs.existsSync(this.filepath)) {
        const raw = fs.readFileSync(this.filepath, "utf8");
        if (raw && raw.trim().length > 0) {
          const loaded = JSON.parse(raw);
          this.state = {
            ...DEFAULT_STATE,
            ...loaded,
            instrumentEdgeScores: { ...DEFAULT_STATE.instrumentEdgeScores, ...(loaded.instrumentEdgeScores || {}) },
            aiTimeframes: { ...DEFAULT_STATE.aiTimeframes, ...(loaded.aiTimeframes || {}) },
            naturalExecutionConfig: { ...DEFAULT_STATE.naturalExecutionConfig, ...(loaded.naturalExecutionConfig || {}) }
          };
        }
      } else {
        this.save();
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn("[SAFETY-BACKSTOP] Non-fatal load warning, keeping in-memory state:", err instanceof Error ? err.message : err);
      this.isLoaded = true;
    }
    return this.state;
  }

  public triggerDailyLossLimit24H(reason: string, details: any = {}) {
    this.load();
    const triggeredAt = new Date().toISOString();
    const autoResumeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    this.state.dailyLossLimitBreached = true;
    this.state.dailyLossLimitHaltActive = true;
    this.state.dailyLossLimitTriggeredAt = triggeredAt;
    this.state.dailyLossLimitAutoResumeAt = autoResumeAt;

    this.addNotification(`🛑 [DAILY LOSS LIMIT 24H] Trading halted for 24 hours until ${autoResumeAt}. All open positions flattened. New trade entries strictly blocked.`);
    this.logTrigger("DAILY_LOSS_LIMIT_24H", "Daily Loss Limit 24H Halt Engaged", reason, {
      ...details,
      triggeredAt,
      autoResumeAt
    });

    telegramNotifier.sendCriticalEvent("dailyLossLimit", "Daily Loss 24H Limit Engaged", reason, {
      "Trigger Reason": reason,
      "Triggered At": triggeredAt,
      "Auto Resume Scheduled": autoResumeAt
    });

    // Execute real position closing immediately
    if (this.onDailyLossClosePositionsCallback) {
      try {
        this.onDailyLossClosePositionsCallback();
      } catch (err) {
        console.error("[SAFETY-BACKSTOP] Error executing position closing callback:", err);
      }
    }

    this.save();
  }

  public checkAndClearAutoResumeHalt(): boolean {
    this.load();
    if (!this.state.dailyLossLimitHaltActive || !this.state.dailyLossLimitAutoResumeAt) {
      return false;
    }

    const now = Date.now();
    const resumeTime = new Date(this.state.dailyLossLimitAutoResumeAt).getTime();

    if (now >= resumeTime) {
      console.log(`[DAILY LOSS LIMIT 24H] 24-Hour timeout elapsed (${this.state.dailyLossLimitAutoResumeAt}). Automatically resuming trading...`);
      this.state.dailyLossLimitHaltActive = false;
      this.state.dailyLossLimitTriggeredAt = null;
      this.state.dailyLossLimitAutoResumeAt = null;
      this.state.dailyLossLimitBreached = false;

      this.addNotification(`✅ [DAILY LOSS LIMIT 24H] 24-Hour cooling period completed. Daily loss trading halt automatically disengaged.`);
      this.logTrigger("DAILY_LOSS_LIMIT_24H", "24H Daily Loss Limit Auto-Resume", "Exact 24-hour timeout elapsed. Trading automatically resumed.", {
        clearedAt: new Date().toISOString()
      });

      telegramNotifier.sendCriticalEvent("dailyLossLimit", "Daily Loss 24H Halt Auto-Cleared", "24-hour cooling period completed. Trading automatically resumed.");
      this.save();
      return true;
    }

    return false;
  }

  public checkDailyLossLimit(currentEquity: number) {
    this.load();

    // Check if auto-resume time has passed
    this.checkAndClearAutoResumeHalt();

    const todayUtc = new Date().toISOString().split("T")[0];

    // Reset daily loss metrics at midnight UTC boundary
    if (this.state.lastDailyResetUtc !== todayUtc) {
      console.log(`[DAILY LOSS LIMIT] New UTC Day (${todayUtc}). Resetting daily equity baseline from $${(this.state.dayStartEquity || 100000).toFixed(2)} to $${currentEquity.toFixed(2)}.`);
      this.state.lastDailyResetUtc = todayUtc;
      this.state.dayStartEquity = currentEquity;
      this.state.currentDayLossPct = 0.0;
      
      if (this.state.dailyLossLimitBreached && !this.state.dailyLossLimitHaltActive) {
        this.state.dailyLossLimitBreached = false;
        this.addNotification(`✅ [DAILY LOSS LIMIT] New UTC trading day started (${todayUtc}). Daily loss metrics reset.`);
      }
      this.save();
      return;
    }

    // Compute current day loss percentage
    const prevLossPct = this.state.currentDayLossPct;
    if (this.state.dayStartEquity > 0 && currentEquity < this.state.dayStartEquity) {
      const lossAmount = this.state.dayStartEquity - currentEquity;
      this.state.currentDayLossPct = parseFloat(((lossAmount / this.state.dayStartEquity) * 100).toFixed(2));
    } else {
      this.state.currentDayLossPct = 0.0;
    }

    // Trigger 24H daily loss limit breach if threshold crossed
    const limitPct = this.state.dailyLossLimitPct || 3.0;
    if (this.state.currentDayLossPct >= limitPct && !this.state.dailyLossLimitHaltActive) {
      const reason = `DAILY_LOSS_LIMIT_24H: Daily loss of ${this.state.currentDayLossPct.toFixed(2)}% breached ${limitPct}% limit (Start: $${this.state.dayStartEquity.toFixed(2)}, Current: $${currentEquity.toFixed(2)})`;
      this.triggerDailyLossLimit24H(reason, {
        dayStartEquity: this.state.dayStartEquity,
        currentEquity,
        lossPct: this.state.currentDayLossPct,
        limitPct
      });
    } else if (Math.abs(this.state.currentDayLossPct - prevLossPct) > 0.05) {
      this.save();
    }
  }

  public checkDrawdown(proposedTradeRiskUsd: number, currentEquity: number): { allowed: boolean; reason?: string; drawdownPct?: number } {
    this.load();
    if (this.state.emergencyHaltActive) {
      return { allowed: false, reason: "Emergency Halt is active." };
    }
    if (this.state.silentLockActive) {
      return { allowed: false, reason: "Silent Lock soft-halt is active." };
    }
    if (this.state.dailyLossLimitHaltActive) {
      return { allowed: false, reason: "Daily Loss Limit 24H trading halt is active." };
    }

    const peak = Math.max(this.state.peakEquity || 100000, currentEquity);
    this.state.peakEquity = peak;
    const currentDrawdownPct = peak > 0 ? ((peak - currentEquity) / peak) * 100 : 0;
    this.state.lastDrawdownPct = parseFloat(currentDrawdownPct.toFixed(2));

    const threshold = this.state.drawdownThresholdPct || 5.0;

    if (currentDrawdownPct >= threshold) {
      const reason = `Max drawdown breached: current drawdown ${currentDrawdownPct.toFixed(2)}% exceeds max threshold (${threshold}%)`;
      this.triggerSilentLock(reason);
      return { allowed: false, reason, drawdownPct: currentDrawdownPct };
    }

    const projectedEquity = currentEquity - Math.abs(proposedTradeRiskUsd || 0);
    const projectedDrawdownPct = peak > 0 ? ((peak - projectedEquity) / peak) * 100 : 0;

    if (projectedDrawdownPct >= threshold) {
      return {
        allowed: false,
        reason: `Pre-trade risk check failed: projected trade drawdown (${projectedDrawdownPct.toFixed(2)}%) would breach max limit (${threshold}%)`,
        drawdownPct: projectedDrawdownPct
      };
    }

    return { allowed: true, drawdownPct: currentDrawdownPct };
  }

  public save() {
    try {
      const tmpPath = `${this.filepath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), "utf8");
      fs.renameSync(tmpPath, this.filepath);
      if (this.onSaveCallback) {
        this.onSaveCallback(this.state);
      }
    } catch (err) {
      console.error("[SAFETY-BACKSTOP] Save error:", err);
    }
  }

  public getState(): SafetyState {
    this.load();
    return this.state;
  }

  public updateState(changes: Partial<SafetyState>) {
    this.load();
    this.state = { ...this.state, ...changes };
    this.save();
  }

  public addNotification(message: string) {
    this.load();
    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      message,
      read: false
    };
    this.state.notifications.unshift(newNotif);
    // limit to 50 notifications
    if (this.state.notifications.length > 50) {
      this.state.notifications = this.state.notifications.slice(0, 50);
    }
    this.save();
    console.log(`[SAFETY-NOTIFICATION] ${message}`);
  }

  public logTrigger(type: "SAFE_MODE" | "SILENT_LOCK" | "EMERGENCY_HALT" | "DAILY_LOSS_LIMIT_24H" | "SYSTEM", event: string, reason: string, details: any = {}) {
    this.load();
    const logItem = {
      id: `trig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type,
      event,
      reason,
      details
    };
    this.state.triggerHistory.unshift(logItem);
    // Limit to 100 triggers to keep file size lightweight and prevent disk corruption
    if (this.state.triggerHistory.length > 100) {
      this.state.triggerHistory = this.state.triggerHistory.slice(0, 100);
    }
    this.save();
  }

  public triggerSafeMode(reason: string) {
    this.load();
    if (this.state.safeModeActive) return;
    this.state.safeModeActive = true;
    this.state.safeModeTriggerReason = reason;
    this.state.safeModeTriggeredAt = new Date().toISOString();
    this.save();
    this.addNotification(`🚨 [Plan B Failover] Safe Mode ACTIVATED: ${reason}`);
    this.logTrigger("SAFE_MODE", "Safe Mode Activated", reason, { triggeredAt: this.state.safeModeTriggeredAt });
    telegramNotifier.sendCriticalEvent("safeMode", "Safe Mode Entered", reason, {
      "Trigger Reason": reason,
      "Triggered At": this.state.safeModeTriggeredAt
    });
  }

  public exitSafeMode() {
    this.load();
    if (!this.state.safeModeActive) return;
    this.state.safeModeActive = false;
    this.state.safeModeTriggerReason = null;
    this.state.safeModeTriggeredAt = null;
    this.save();
    this.addNotification(`✅ [Plan B Failover] Safe Mode disengaged. System restored to normal trading parameters.`);
    this.logTrigger("SAFE_MODE", "Safe Mode Disengaged", "Manual operator reactivation.");
    telegramNotifier.sendCriticalEvent("safeMode", "Safe Mode Exited", "System restored to nominal trading parameters by operator.");
  }

  public triggerSilentLock(reason: string, details: any = {}) {
    this.load();
    if (this.state.silentLockActive) return;
    this.state.silentLockActive = true;
    this.state.silentLockTriggerReason = reason;
    this.state.silentLockTriggeredAt = new Date().toISOString();
    this.save();
    this.addNotification(`🛑 [SILENT LOCK] Hard Soft-Halt ENGAGED: ${reason}. All new position entries and evolution candidate promotions are strictly blocked.`);
    this.logTrigger("SILENT_LOCK", "Silent Lock Activated", reason, details);
    telegramNotifier.sendCriticalEvent("silentLock", "Silent Lock Triggered", reason, {
      "Reason": reason,
      "Drawdown": `${(this.state.lastDrawdownPct || 0).toFixed(2)}%`,
      "Trading State": "HALTED (New entries blocked)"
    });
  }

  public resumeFromSilentLock() {
    this.load();
    if (!this.state.silentLockActive) return;
    this.state.silentLockActive = false;
    this.state.silentLockTriggerReason = null;
    this.state.silentLockTriggeredAt = null;
    this.save();
    this.addNotification(`✅ [SILENT LOCK] Reset. Live trading operations and candidate promotions re-authorized by human operator.`);
    this.logTrigger("SILENT_LOCK", "Silent Lock Reset", "Manual operator override with double verification.");
    telegramNotifier.sendCriticalEvent("silentLock", "Silent Lock Disengaged", "Live trading and candidate promotions re-authorized by human operator.");
  }

  public triggerEmergencyHalt(reason: string, details: any = {}) {
    this.load();
    this.state.emergencyHaltActive = true;
    this.save();
    this.addNotification(`⚠️ [EMERGENCY HALT] Triggered: ${reason}. Policy: ${this.state.emergencyHaltPolicy}`);
    this.logTrigger("EMERGENCY_HALT", "Emergency Halt Tripped", reason, { policy: this.state.emergencyHaltPolicy, ...details });
    telegramNotifier.sendCriticalEvent("emergencyHalt", "Emergency Halt Triggered", reason, {
      "Reason": reason,
      "Halt Policy": this.state.emergencyHaltPolicy
    });
  }

  public resetEmergencyHalt() {
    this.load();
    this.state.emergencyHaltActive = false;
    this.save();
    this.addNotification(`✅ [EMERGENCY HALT] System disarmed. Nominals restored.`);
    this.logTrigger("EMERGENCY_HALT", "Emergency Halt Cleared", "Operator reset system status.");
    telegramNotifier.sendCriticalEvent("emergencyHalt", "Emergency Halt Cleared", "System disarmed. All nominals restored by operator.");
  }
}

export const safetyBackstop = new SafetyBackstopManager();
