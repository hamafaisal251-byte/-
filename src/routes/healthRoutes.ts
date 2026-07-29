import { Router, Request, Response } from "express";
import { prometheusClient } from "../services/metricsService";
import { checkChronyTracking, getSyncedTime } from "../services/chronyService";

export const healthRouter = Router();

// GET /api/health
healthRouter.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    system: "Sovereign NEXUS",
    version: "1.5.0"
  });
});

// GET /metrics (Prometheus endpoints)
healthRouter.get("/metrics", async (req: Request, res: Response) => {
  try {
    res.set("Content-Type", prometheusClient.register.contentType);
    res.end(await prometheusClient.register.metrics());
  } catch (ex: any) {
    res.status(500).end(ex.message);
  }
});

// GET /api/time (Chrony time sync)
healthRouter.get("/time", async (req: Request, res: Response) => {
  const chrony = await checkChronyTracking();
  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    syncedTimestampMs: getSyncedTime(),
    chrony
  });
});
