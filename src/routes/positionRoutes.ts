import { Router, Request, Response } from "express";
import { safetyBackstop } from "../../safetyBackstop";

export const positionRouter = Router();

// GET /api/positions/active
positionRouter.get("/active", (req: Request, res: Response) => {
  res.json({
    success: true,
    positions: [],
    stats: {
      openPositions: 0,
      totalUnrealizedPl: 0.0,
      marginUsed: 0.0
    }
  });
});

// POST /api/positions/order (Order entry with Pre-trade Drawdown Enforcement)
positionRouter.post("/order", (req: Request, res: Response) => {
  const { symbol, side, size } = req.body;

  const estimatedNotional = (parseFloat(size) || 1) * 10000;
  const estimatedRiskUsd = estimatedNotional * 0.02;
  const currentEquity = 100000;
  const drawdownCheck = safetyBackstop.checkDrawdown(estimatedRiskUsd, currentEquity);

  if (!drawdownCheck.allowed) {
    return res.status(400).json({
      success: false,
      error: `Pre-trade Drawdown Guard Blocked Order: ${drawdownCheck.reason}`
    });
  }

  res.json({
    success: true,
    orderId: `ORD-${Date.now()}`,
    symbol: symbol || "EURUSD",
    side: side || "BUY",
    status: "EXECUTED",
    timestamp: new Date().toISOString()
  });
});
