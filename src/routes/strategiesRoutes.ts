import { Router, Request, Response } from "express";
import { checkIPAllowlist } from "../middleware/auth";
import { pgDb } from "../db";
import { addServerLog } from "../services/logging";

export const strategiesRouter = Router();

// GET /api/strategies/config
strategiesRouter.get("/config", (req: Request, res: Response) => {
  const config = pgDb.query("SELECT * FROM instrument_strategies") || {};
  res.json({ success: true, config });
});

// POST /api/strategies/config
strategiesRouter.post("/config", checkIPAllowlist, (req: Request, res: Response) => {
  const { symbol, whaleMode, sniperMode, breakevenEnabled, breakevenThreshold, dynamicSlEnabled, shockAbsorberEnabled, sniperConfidenceThreshold, whaleConfidenceThreshold } = req.body;
  const result = pgDb.query("UPDATE instrument_strategies", [
    symbol,
    whaleMode,
    sniperMode,
    breakevenEnabled,
    breakevenThreshold,
    dynamicSlEnabled,
    shockAbsorberEnabled,
    parseFloat(sniperConfidenceThreshold || 0.85),
    parseFloat(whaleConfidenceThreshold || 0.80)
  ]);
  addServerLog("RISK-MANAGER", "INFO", `کۆنفیدی تەکینیکەکانی ${symbol} بە سەرکەوتوویی نوێکرایەوە (Strategy mode parameters updated).`);
  res.json({ success: true, strategy: result });
});

// GET /api/strategies/audit-logs
strategiesRouter.get("/audit-logs", (req: Request, res: Response) => {
  const logs = pgDb.query("SELECT * FROM strategy_audit_logs") || [];
  res.json({ success: true, logs });
});
