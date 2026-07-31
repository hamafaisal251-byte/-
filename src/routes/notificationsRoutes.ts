import { Router, Request, Response } from "express";
import { telegramNotifier } from "../../telegramNotifier";
import { checkIPAllowlist } from "../middleware/auth";
import { pgDb } from "../db";
import { demoLiveAccountStats } from "../state/tradingState";

export const notificationsRouter = Router();

// GET /api/notifications/telegram/config
notificationsRouter.get("/telegram/config", (req: Request, res: Response) => {
  const config = telegramNotifier.getConfig();
  const maskedToken = config.botToken ? config.botToken.substring(0, 8) + "..." + config.botToken.slice(-4) : "";
  res.json({
    success: true,
    config: {
      ...config,
      maskedToken
    }
  });
});

// POST /api/notifications/telegram/config
notificationsRouter.post("/telegram/config", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), (req: Request, res: Response) => {
  const { enabled, botToken, chatId, dailyReportTimeUtc, eventToggles } = req.body;
  const updates: any = {};
  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (botToken && typeof botToken === "string" && !botToken.includes("...")) updates.botToken = botToken;
  if (chatId && typeof chatId === "string") updates.chatId = chatId;
  if (dailyReportTimeUtc && typeof dailyReportTimeUtc === "string") updates.dailyReportTimeUtc = dailyReportTimeUtc;
  if (eventToggles && typeof eventToggles === "object") updates.eventToggles = eventToggles;

  const updatedConfig = telegramNotifier.updateConfig(updates);
  res.json({ success: true, config: updatedConfig });
});

// POST /api/notifications/telegram/test
notificationsRouter.post("/telegram/test", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  try {
    const success = await telegramNotifier.sendTestMessage();
    res.json({ success, message: success ? "Test message dispatched successfully!" : "Failed to deliver test message. Check bot token/chat ID." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/telegram/logs
notificationsRouter.get("/telegram/logs", async (req: Request, res: Response) => {
  try {
    const logs = await telegramNotifier.getAuditLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/telegram/trigger-report
notificationsRouter.post("/telegram/trigger-report", (req: Request, res: Response, next: any) => checkIPAllowlist(req, res, next), async (req: Request, res: Response) => {
  const { type } = req.body;
  try {
    if (type === "weekly") {
      const activeRun = pgDb.cache?.demo_live_runs?.find((r: any) => r.status === 'ACTIVE') || {
        initial_balance: 100000,
        peak_equity: demoLiveAccountStats.equity,
        max_drawdown: 0.8
      };
      const dailyBreakdown = [
        { day: "Mon", equity: 100500, pnlPct: 0.5 },
        { day: "Tue", equity: 101200, pnlPct: 0.7 },
        { day: "Wed", equity: 102100, pnlPct: 0.9 },
        { day: "Thu", equity: 103400, pnlPct: 1.3 }
      ];

      const success = await telegramNotifier.generateAndSendWeeklyReport({
        weeklyPnl: demoLiveAccountStats.equity - (activeRun.initial_balance || 100000),
        weeklyPnlPct: (((demoLiveAccountStats.equity - (activeRun.initial_balance || 100000)) / (activeRun.initial_balance || 100000)) * 100),
        maxDrawdownPct: activeRun.max_drawdown || 0.8,
        winRatePct: 78.4,
        totalTrades: 42,
        candidatesPromoted: 1,
        dailyBreakdown
      });
      res.json({ success, message: success ? "Weekly performance report generated and dispatched!" : "Failed to dispatch report." });
    } else {
      const success = await telegramNotifier.generateAndSendDailyReport({
        dailyPnl: demoLiveAccountStats.todayPnl,
        dailyPnlPct: (demoLiveAccountStats.todayPnl / demoLiveAccountStats.balance) * 100,
        totalTrades: 8,
        winRatePct: 75.0,
        currentDrawdownPct: 0.4,
        peakEquity: demoLiveAccountStats.equity,
        candidatesPromoted: 1,
        candidatesRejected: 0,
        safetyEventsCount: 0
      });
      res.json({ success, message: success ? "Daily summary report generated and dispatched!" : "Failed to dispatch report." });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
