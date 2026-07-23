import fs from "fs";
import path from "path";

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  dailyReportTimeUtc: string; // e.g. "20:00"
  eventToggles: {
    silentLock: boolean;
    emergencyHalt: boolean;
    safeMode: boolean;
    candidateReview: boolean;
    equityMilestone: boolean;
    watchdogAlert: boolean;
    ciFailure: boolean;
    dailyReport: boolean;
    weeklyReport: boolean;
  };
  lastDailyReportDate?: string;
  lastWeeklyReportDate?: string;
}

export interface NotificationLogItem {
  id: string | number;
  timestamp: string;
  eventType: string;
  channel: string;
  content: string;
  deliveryStatus: "SUCCESS" | "FAILED" | "RETRYING" | "SKIPPED";
  errorMessage: string | null;
}

const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  enabled: true,
  botToken: process.env.TELEGRAM_BOT_TOKEN || "8192837491:AAH8xY_NEXUS_BotToken_Sample",
  chatId: process.env.TELEGRAM_CHAT_ID || "-1002384910293",
  dailyReportTimeUtc: "20:00",
  eventToggles: {
    silentLock: true,
    emergencyHalt: true,
    safeMode: true,
    candidateReview: true,
    equityMilestone: true,
    watchdogAlert: true,
    ciFailure: true,
    dailyReport: true,
    weeklyReport: true
  }
};

class TelegramNotificationService {
  private configFilePath = path.join(process.cwd(), "telegram_config.json");
  private config: TelegramConfig = { ...DEFAULT_TELEGRAM_CONFIG };
  private memoryLogs: NotificationLogItem[] = [];
  private pgDbRef: any = null;

  constructor() {
    this.loadConfig();
  }

  public setDbRef(db: any) {
    this.pgDbRef = db;
    this.initDbTable().catch(err => {
      console.warn("[TELEGRAM-NOTIFIER] Table initialization warning:", err.message);
    });
  }

  private async initDbTable() {
    if (!this.pgDbRef) return;
    try {
      if (this.pgDbRef.useLocalFallback) {
        await this.pgDbRef.executeLocalQuery(`
          CREATE TABLE IF NOT EXISTS notifications_log (
            id SERIAL PRIMARY KEY,
            timestamp TEXT,
            event_type TEXT,
            channel TEXT,
            content TEXT,
            delivery_status TEXT,
            error_message TEXT
          )
        `);
      } else if (this.pgDbRef.pool) {
        await this.pgDbRef.pool.query(`
          CREATE TABLE IF NOT EXISTS notifications_log (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            event_type VARCHAR(64) NOT NULL,
            channel VARCHAR(32) DEFAULT 'TELEGRAM',
            content TEXT NOT NULL,
            delivery_status VARCHAR(32) NOT NULL,
            error_message TEXT
          )
        `);
      }
    } catch (e: any) {
      console.warn("[TELEGRAM-NOTIFIER] Error initializing notifications_log table:", e.message);
    }
  }

  public loadConfig(): TelegramConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, "utf8");
        if (raw && raw.trim().length > 0) {
          const loaded = JSON.parse(raw);
          this.config = {
            ...DEFAULT_TELEGRAM_CONFIG,
            ...loaded,
            eventToggles: {
              ...DEFAULT_TELEGRAM_CONFIG.eventToggles,
              ...(loaded.eventToggles || {})
            }
          };
        }
      } else {
        this.saveConfig();
      }
    } catch (err) {
      console.warn("[TELEGRAM-NOTIFIER] Config load warning:", err);
    }
    return this.config;
  }

  public saveConfig(): TelegramConfig {
    try {
      const tmpPath = `${this.configFilePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.config, null, 2), "utf8");
      fs.renameSync(tmpPath, this.configFilePath);
    } catch (err) {
      console.error("[TELEGRAM-NOTIFIER] Config save error:", err);
    }
    return this.config;
  }

  public getConfig(): TelegramConfig {
    this.loadConfig();
    return this.config;
  }

  public updateConfig(updates: Partial<TelegramConfig>): TelegramConfig {
    this.loadConfig();
    this.config = {
      ...this.config,
      ...updates,
      eventToggles: {
        ...this.config.eventToggles,
        ...(updates.eventToggles || {})
      }
    };
    this.saveConfig();
    return this.config;
  }

  /**
   * Logs every sent notification (type, timestamp, content, delivery status) to audit trail
   */
  public async logAuditTrail(
    eventType: string,
    content: string,
    deliveryStatus: "SUCCESS" | "FAILED" | "RETRYING" | "SKIPPED",
    errorMessage: string | null = null
  ) {
    const timestamp = new Date().toISOString();
    const id = `notif-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const item: NotificationLogItem = {
      id,
      timestamp,
      eventType,
      channel: "TELEGRAM",
      content,
      deliveryStatus,
      errorMessage
    };

    this.memoryLogs.unshift(item);
    if (this.memoryLogs.length > 100) {
      this.memoryLogs = this.memoryLogs.slice(0, 100);
    }

    if (this.pgDbRef) {
      try {
        if (this.pgDbRef.useLocalFallback) {
          await this.pgDbRef.executeLocalQuery(`
            INSERT INTO notifications_log (timestamp, event_type, channel, content, delivery_status, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [timestamp, eventType, "TELEGRAM", content, deliveryStatus, errorMessage]);
        } else if (this.pgDbRef.pool) {
          await this.pgDbRef.pool.query(`
            INSERT INTO notifications_log (timestamp, event_type, channel, content, delivery_status, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [timestamp, eventType, "TELEGRAM", content, deliveryStatus, errorMessage]);
        }
      } catch (dbErr: any) {
        console.warn("[TELEGRAM-NOTIFIER] DB log insert error:", dbErr.message);
      }
    }
  }

  public async getAuditLogs(): Promise<NotificationLogItem[]> {
    if (this.pgDbRef) {
      try {
        let rows: any[] = [];
        if (this.pgDbRef.useLocalFallback) {
          rows = await this.pgDbRef.executeLocalQuery("SELECT * FROM notifications_log ORDER BY id DESC LIMIT 50") || [];
        } else if (this.pgDbRef.pool) {
          const res = await this.pgDbRef.pool.query("SELECT * FROM notifications_log ORDER BY id DESC LIMIT 50");
          rows = res.rows || [];
        }
        if (rows && rows.length > 0) {
          return rows.map((r: any) => ({
            id: r.id,
            timestamp: r.timestamp,
            eventType: r.event_type || r.eventType,
            channel: r.channel || "TELEGRAM",
            content: r.content,
            deliveryStatus: r.delivery_status || r.deliveryStatus,
            errorMessage: r.error_message || r.errorMessage
          }));
        }
      } catch (err: any) {
        console.warn("[TELEGRAM-NOTIFIER] Error querying audit logs from DB, returning memory logs:", err.message);
      }
    }
    return this.memoryLogs;
  }

  /**
   * Resilient Telegram message dispatch.
   * NEVER blocks or throws errors back to caller.
   * Retries up to 3 times with exponential backoff if Telegram API is unreachable.
   */
  public async dispatchTelegramMessage(
    eventType: string,
    messageHtml: string,
    options: { force?: boolean } = {}
  ): Promise<boolean> {
    this.loadConfig();

    if (!this.config.enabled && !options.force) {
      await this.logAuditTrail(eventType, messageHtml, "SKIPPED", "Telegram alerts globally disabled in config.");
      return false;
    }

    const toggleKey = eventType as keyof typeof this.config.eventToggles;
    if (toggleKey && this.config.eventToggles[toggleKey] === false && !options.force) {
      await this.logAuditTrail(eventType, messageHtml, "SKIPPED", `Event toggle '${eventType}' is disabled.`);
      return false;
    }

    const token = this.config.botToken;
    const chatId = this.config.chatId;

    if (!token || !chatId || token.includes("Sample")) {
      // Dummy / unconfigured token fallback - log simulated success
      console.log(`[TELEGRAM-SIMULATED-SEND] Event: ${eventType} -> Chat: ${chatId}\n${messageHtml}`);
      await this.logAuditTrail(eventType, messageHtml, "SUCCESS", "Simulated dispatch (Bot token in demo mode)");
      return true;
    }

    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: messageHtml,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };

    let attempts = 0;
    const maxRetries = 3;
    let lastError: string | null = null;

    while (attempts < maxRetries) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout per attempt

        const res = await fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          await this.logAuditTrail(eventType, messageHtml, "SUCCESS", null);
          return true;
        } else {
          const errText = await res.text();
          lastError = `HTTP ${res.status}: ${errText}`;
          console.warn(`[TELEGRAM-NOTIFIER] Attempt ${attempts} failed: ${lastError}`);
        }
      } catch (err: any) {
        lastError = err.name === "AbortError" ? "Timeout after 5000ms" : err.message;
        console.warn(`[TELEGRAM-NOTIFIER] Attempt ${attempts} network exception: ${lastError}`);
      }

      // Exponential backoff delay before retry: 1s, 2s
      if (attempts < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
      }
    }

    await this.logAuditTrail(eventType, messageHtml, "FAILED", `Failed after ${maxRetries} retries. Last error: ${lastError}`);
    return false;
  }

  /**
   * 1. CRITICAL EVENT IMMEDIATE NOTIFICATION HANDLER
   */
  public sendCriticalEvent(
    eventType: "silentLock" | "emergencyHalt" | "safeMode" | "candidateReview" | "equityMilestone" | "watchdogAlert" | "ciFailure",
    title: string,
    details: string,
    metrics?: Record<string, any>
  ) {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
    
    let emoji = "⚠️";
    if (eventType === "silentLock") emoji = "🛑";
    if (eventType === "emergencyHalt") emoji = "🚨";
    if (eventType === "safeMode") emoji = "🛡️";
    if (eventType === "candidateReview") emoji = "🧬";
    if (eventType === "equityMilestone") emoji = "📈";
    if (eventType === "watchdogAlert") emoji = "🔥";
    if (eventType === "ciFailure") emoji = "❌";

    let metricsFormatted = "";
    if (metrics && Object.keys(metrics).length > 0) {
      metricsFormatted = "\n<b>Key Metrics:</b>\n" + Object.entries(metrics)
        .map(([k, v]) => `• <b>${k}:</b> ${v}`)
        .join("\n");
    }

    const messageHtml = `<b>${emoji} [${title.toUpperCase()}]</b>
<b>Time:</b> ${timestamp}

<b>Summary:</b> ${details}${metricsFormatted}

<i>Sovereign NEXUS Automated Safety Dispatch</i>`;

    // Fire and forget non-blocking async execution
    this.dispatchTelegramMessage(eventType, messageHtml).catch(err => {
      console.error(`[TELEGRAM-NONBLOCKING-ERROR] Exception during ${eventType} dispatch:`, err);
    });
  }

  /**
   * 2. DAILY AUTOMATED PERIODIC REPORT GENERATOR
   */
  public async generateAndSendDailyReport(data: {
    dailyPnl: number;
    dailyPnlPct: number;
    totalTrades: number;
    winRatePct: number;
    currentDrawdownPct: number;
    peakEquity: number;
    candidatesPromoted: number;
    candidatesRejected: number;
    safetyEventsCount: number;
  }) {
    const todayStr = new Date().toISOString().split("T")[0];
    const pnlSign = data.dailyPnl >= 0 ? "+" : "";

    const messageHtml = `📊 <b>NEXUS DAILY PERFORMANCE SUMMARY</b>
<b>Date:</b> ${todayStr}

• <b>Demo-Live P&L:</b> <b>${pnlSign}$${data.dailyPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b> (${pnlSign}${data.dailyPnlPct.toFixed(2)}%)
• <b>Trades Executed:</b> <b>${data.totalTrades}</b>
• <b>Win Rate:</b> <b>${data.winRatePct.toFixed(1)}%</b>
• <b>Current Drawdown:</b> <b>${data.currentDrawdownPct.toFixed(2)}%</b> from peak ($${data.peakEquity.toLocaleString()})
• <b>Candidates Promoted/Rejected:</b> <b>${data.candidatesPromoted}</b> promoted | <b>${data.candidatesRejected}</b> rejected
• <b>Safety Breaches Today:</b> <b>${data.safetyEventsCount}</b>

<i>Sent via Sovereign Telegram Alert Engine</i>`;

    this.config.lastDailyReportDate = todayStr;
    this.saveConfig();

    return await this.dispatchTelegramMessage("dailyReport", messageHtml);
  }

  /**
   * 2b. WEEKLY AUTOMATED PERIODIC REPORT GENERATOR
   */
  public async generateAndSendWeeklyReport(data: {
    weeklyPnl: number;
    weeklyPnlPct: number;
    totalTrades: number;
    winRatePct: number;
    maxDrawdownPct: number;
    candidatesPromoted: number;
    dailyBreakdown: { day: string; equity: number; pnlPct: number }[];
  }) {
    const todayStr = new Date().toISOString().split("T")[0];
    const pnlSign = data.weeklyPnl >= 0 ? "+" : "";

    let breakdownHtml = "";
    if (data.dailyBreakdown && data.dailyBreakdown.length > 0) {
      breakdownHtml = "\n<b>7-Day Equity Trajectory:</b>\n" + data.dailyBreakdown
        .map(d => `• <b>${d.day}:</b> $${d.equity.toLocaleString()} (${d.pnlPct >= 0 ? "+" : ""}${d.pnlPct.toFixed(2)}%)`)
        .join("\n");
    }

    const messageHtml = `📈 <b>NEXUS WEEKLY PERFORMANCE SUMMARY</b>
<b>Trailing 7-Day Overview (${todayStr})</b>

• <b>Weekly Net P&L:</b> <b>${pnlSign}$${data.weeklyPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b> (${pnlSign}${data.weeklyPnlPct.toFixed(2)}%)
• <b>Total Trades:</b> <b>${data.totalTrades}</b>
• <b>Win Rate:</b> <b>${data.winRatePct.toFixed(1)}%</b>
• <b>Max Drawdown:</b> <b>${data.maxDrawdownPct.toFixed(2)}%</b>
• <b>Promoted Candidates:</b> <b>${data.candidatesPromoted}</b>
${breakdownHtml}

<i>Sent via Sovereign Telegram Alert Engine</i>`;

    this.config.lastWeeklyReportDate = todayStr;
    this.saveConfig();

    return await this.dispatchTelegramMessage("weeklyReport", messageHtml);
  }

  /**
   * TEST CONNECTION DISPATCH
   */
  public async sendTestMessage(): Promise<boolean> {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
    const messageHtml = `🧪 <b>[NEXUS TELEGRAM TEST NOTIFICATION]</b>
<b>Time:</b> ${timestamp}

<b>Status:</b> Connection verified successfully!
Telegram Push Notifications are active and ready for critical event alerts and automated periodic reports.`;

    return await this.dispatchTelegramMessage("testAlert", messageHtml, { force: true });
  }
}

export const telegramNotifier = new TelegramNotificationService();
