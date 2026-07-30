import { Router, Request, Response } from "express";

export const microstructureRouter = Router();

// GET /api/microstructure/book
microstructureRouter.get("/book", (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || "EUR/USD";
  const now = Date.now();
  const basePrice = symbol.includes("JPY") ? 156.44 : 1.0852;
  const pipSize = symbol.includes("JPY") ? 0.01 : 0.0001;
  const spreadPips = +(0.3 + ((now % 100) / 300)).toFixed(2);
  const halfSpread = (spreadPips * pipSize) / 2;

  let totalBidVol = 0;
  let totalAskVol = 0;

  const bids = Array.from({ length: 10 }, (_, i) => {
    const step = (i + 1) * pipSize * 0.4;
    const price = +(basePrice - halfSpread - step).toFixed(5);
    const volume = +((15 + (10 - i) * 8 + ((now + i * 13) % 12))).toFixed(1);
    totalBidVol += volume;
    return { level: i + 1, price, volume, orderCount: Math.floor(volume / 3.5) + 1 };
  });

  const asks = Array.from({ length: 10 }, (_, i) => {
    const step = (i + 1) * pipSize * 0.4;
    const price = +(basePrice + halfSpread + step).toFixed(5);
    const volume = +((12 + (10 - i) * 7.5 + ((now + i * 17) % 14))).toFixed(1);
    totalAskVol += volume;
    return { level: i + 1, price, volume, orderCount: Math.floor(volume / 3.2) + 1 };
  });

  const oba = +((totalBidVol - totalAskVol) / (totalBidVol + totalAskVol)).toFixed(3);
  let microState = "BALANCED";
  if (oba > 0.18) microState = "BID_HEAVY";
  else if (oba < -0.18) microState = "ASK_HEAVY";

  res.json({
    success: true,
    orderBook: {
      symbol,
      timestamp: new Date().toISOString().split("T")[1].replace("Z", ""),
      midPrice: basePrice,
      spreadPips,
      bids,
      asks,
      totalBidVolume: +totalBidVol.toFixed(1),
      totalAskVolume: +totalAskVol.toFixed(1),
      orderBookImbalance: oba,
      microstructureState: microState
    }
  });
});

// GET /api/microstructure/slippage
microstructureRouter.get("/slippage", (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || "EUR/USD";
  const side = (req.query.side as string) || "BUY";
  const lots = parseFloat(req.query.lots as string) || 1.0;
  const basePrice = symbol.includes("JPY") ? 156.44 : 1.0852;
  const pipSize = symbol.includes("JPY") ? 0.01 : 0.0001;

  const slippagePips = +((lots * 0.18) + (Math.sin(lots) * 0.05)).toFixed(2);
  const expectedVwap = side === "BUY" ? +(basePrice + (slippagePips * pipSize)).toFixed(5) : +(basePrice - (slippagePips * pipSize)).toFixed(5);
  const impactScore = Math.min(100, +(lots * 12.5 + slippagePips * 15).toFixed(1));

  res.json({
    success: true,
    estimate: {
      orderSizeLots: lots,
      expectedVwap,
      slippagePips,
      marketImpactScore: impactScore,
      queuePositionUs: 120 + Math.floor(lots * 45) + (Date.now() % 80)
    }
  });
});
