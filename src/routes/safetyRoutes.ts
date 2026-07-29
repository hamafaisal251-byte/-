import { Router, Request, Response } from "express";
import { safetyBackstop } from "../../safetyBackstop";
import { telegramNotifier } from "../../telegramNotifier";

export const safetyRouter = Router();

// GET /api/safety/state
safetyRouter.get("/state", (req: Request, res: Response) => {
  res.json({ success: true, state: safetyBackstop.getState() });
});

// POST /api/safety/safe-mode/trigger
safetyRouter.post("/safe-mode/trigger", (req: Request, res: Response) => {
  const { reason } = req.body;
  safetyBackstop.triggerSafeMode(reason || "Manual operator trigger from UI dashboard.");
  res.json({ success: true, message: "Safe Mode triggered successfully.", state: safetyBackstop.getState() });
});

// POST /api/safety/safe-mode/exit
safetyRouter.post("/safe-mode/exit", (req: Request, res: Response) => {
  safetyBackstop.exitSafeMode();
  res.json({ success: true, message: "Safe Mode disengaged successfully.", state: safetyBackstop.getState() });
});

// POST /api/safety/silent-lock/trigger
safetyRouter.post("/silent-lock/trigger", (req: Request, res: Response) => {
  const { reason } = req.body;
  safetyBackstop.triggerSilentLock(reason || "Manual operator trigger.");
  res.json({ success: true, message: "Silent lock triggered.", state: safetyBackstop.getState() });
});

// POST /api/safety/silent-lock/resume
safetyRouter.post("/silent-lock/resume", (req: Request, res: Response) => {
  safetyBackstop.resumeFromSilentLock();
  res.json({ success: true, message: "Silent lock resumed.", state: safetyBackstop.getState() });
});

// POST /api/safety/emergency-halt/trigger
safetyRouter.post("/emergency-halt/trigger", (req: Request, res: Response) => {
  const { reason } = req.body;
  safetyBackstop.triggerEmergencyHalt(reason || "Manual operator panic button engaged.");
  res.json({ success: true, message: "Emergency halt triggered.", state: safetyBackstop.getState() });
});

// POST /api/safety/emergency-halt/reset
safetyRouter.post("/emergency-halt/reset", (req: Request, res: Response) => {
  safetyBackstop.resetEmergencyHalt();
  res.json({ success: true, message: "Emergency halt reset.", state: safetyBackstop.getState() });
});
