import fs from "fs";
import path from "path";

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
  peakEquity: number;
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
    type: "SAFE_MODE" | "SILENT_LOCK" | "EMERGENCY_HALT" | "SYSTEM";
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
  peakEquity: 104830.40, // Match start equity of the system
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
  public onSaveCallback?: (state: SafetyState) => void;

  constructor() {
    this.load();
  }

  public load(): SafetyState {
    try {
      if (fs.existsSync(this.filepath)) {
        const raw = fs.readFileSync(this.filepath, "utf8");
        this.state = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      console.error("[SAFETY-BACKSTOP] Load error, falling back to defaults:", err);
      this.state = { ...DEFAULT_STATE };
      // Safe fallback saving to overwrite any truncated or corrupted state files
      try {
        fs.writeFileSync(this.filepath, JSON.stringify(this.state, null, 2), "utf8");
      } catch (saveErr) {
        console.error("[SAFETY-BACKSTOP] Failed to save recovery state:", saveErr);
      }
    }
    return this.state;
  }

  public save() {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(this.state, null, 2), "utf8");
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

  public logTrigger(type: "SAFE_MODE" | "SILENT_LOCK" | "EMERGENCY_HALT" | "SYSTEM", event: string, reason: string, details: any = {}) {
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
    this.addNotification(`🚨 [Plan B Failover] Safe Mode ACTIVATED: ${reason}`);
    this.logTrigger("SAFE_MODE", "Safe Mode Activated", reason, { triggeredAt: this.state.safeModeTriggeredAt });
    this.save();
  }

  public exitSafeMode() {
    this.load();
    if (!this.state.safeModeActive) return;
    this.state.safeModeActive = false;
    this.state.safeModeTriggerReason = null;
    this.state.safeModeTriggeredAt = null;
    this.addNotification(`✅ [Plan B Failover] Safe Mode disengaged. System restored to normal trading parameters.`);
    this.logTrigger("SAFE_MODE", "Safe Mode Disengaged", "Manual operator reactivation.");
    this.save();
  }

  public triggerSilentLock(reason: string, details: any = {}) {
    this.load();
    if (this.state.silentLockActive) return;
    this.state.silentLockActive = true;
    this.state.silentLockTriggerReason = reason;
    this.state.silentLockTriggeredAt = new Date().toISOString();
    this.addNotification(`🛑 [SILENT LOCK] Hard Soft-Halt ENGAGED: ${reason}. All new position entries and evolution candidate promotions are strictly blocked.`);
    this.logTrigger("SILENT_LOCK", "Silent Lock Activated", reason, details);
    this.save();
  }

  public resumeFromSilentLock() {
    this.load();
    if (!this.state.silentLockActive) return;
    this.state.silentLockActive = false;
    this.state.silentLockTriggerReason = null;
    this.state.silentLockTriggeredAt = null;
    this.addNotification(`✅ [SILENT LOCK] Reset. Live trading operations and candidate promotions re-authorized by human operator.`);
    this.logTrigger("SILENT_LOCK", "Silent Lock Reset", "Manual operator override with double verification.");
    this.save();
  }

  public triggerEmergencyHalt(reason: string, details: any = {}) {
    this.load();
    this.state.emergencyHaltActive = true;
    this.addNotification(`⚠️ [EMERGENCY HALT] Triggered: ${reason}. Policy: ${this.state.emergencyHaltPolicy}`);
    this.logTrigger("EMERGENCY_HALT", "Emergency Halt Tripped", reason, { policy: this.state.emergencyHaltPolicy, ...details });
    this.save();
  }

  public resetEmergencyHalt() {
    this.load();
    this.state.emergencyHaltActive = false;
    this.addNotification(`✅ [EMERGENCY HALT] System disarmed. Nominals restored.`);
    this.logTrigger("EMERGENCY_HALT", "Emergency Halt Cleared", "Operator reset system status.");
    this.save();
  }
}

export const safetyBackstop = new SafetyBackstopManager();
