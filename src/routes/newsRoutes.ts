import { Router, Request, Response } from "express";
import { checkIPAllowlist, asyncHandler } from "../middleware/auth";
import { pgDb } from "../db";
import { encrypt } from "../utils/crypto";
import { addServerLog } from "../services/logging";
import {
  testNewsConnection,
  updateNewsAndCalendar,
  platformStatusCache,
  individualSentiments,
  computeAggregatedSentiment,
  updateNewsSentimentState,
  currentNewsEvents,
  minutesUntilHighImpactNews,
  sentimentScore,
  aggregatedSentimentState,
  aggregatedNewsFeed
} from "../services/newsService";

export const newsRouter = Router();

// POST /api/news/test-connection
newsRouter.post("/test-connection", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { platform, apiKey } = req.body;
  if (!platform || !apiKey) {
    return res.status(400).json({ success: false, error: "Platform and API Key are required." });
  }

  addServerLog("GO-BACKPLANE", "INFO", `تاقیکردنەوەی گرێدانی هەواڵ و داتای دەرەکی بۆ: ${platform.toUpperCase()}`);
  const result = await testNewsConnection(platform, apiKey);
  if (result.success) {
    addServerLog("GO-BACKPLANE", "SUCCESS", `تاقیکردنەوەی گرێدانی ${platform.toUpperCase()} سەرکەوتوو بوو.`);
    res.json({ success: true });
  } else {
    addServerLog("GO-BACKPLANE", "WARNING", `گرێدانی ${platform.toUpperCase()} سەرنەکەوت: ${result.errorMessage}`);
    res.status(400).json({ success: false, error: result.errorMessage || "Validation failed" });
  }
}));

// POST /api/news/config
newsRouter.post("/config", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { newsApiKey, finnhubKey, tradingEconomicsKey, alphaVantageKey, marketAuxKey, fredKey } = req.body;
  
  const cfg = await pgDb.query("SELECT * FROM news_config") || {};

  const finalNewsApiEnc = newsApiKey !== undefined ? (newsApiKey ? encrypt(newsApiKey) : "") : (cfg.newsApiKeyEnc || "");
  const finalFinnhubEnc = finnhubKey !== undefined ? (finnhubKey ? encrypt(finnhubKey) : "") : (cfg.finnhubKeyEnc || "");
  const finalTradingEconomicsEnc = tradingEconomicsKey !== undefined ? (tradingEconomicsKey ? encrypt(tradingEconomicsKey) : "") : (cfg.tradingEconomicsKeyEnc || "");
  const finalAlphaVantageEnc = alphaVantageKey !== undefined ? (alphaVantageKey ? encrypt(alphaVantageKey) : "") : (cfg.alphaVantageKeyEnc || "");
  const finalMarketAuxEnc = marketAuxKey !== undefined ? (marketAuxKey ? encrypt(marketAuxKey) : "") : (cfg.marketAuxKeyEnc || "");
  const finalFredEnc = fredKey !== undefined ? (fredKey ? encrypt(fredKey) : "") : (cfg.fredKeyEnc || "");

  await pgDb.query("INSERT INTO news_config (id, news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc) VALUES (1, $1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET news_api_key_enc = EXCLUDED.news_api_key_enc, finnhub_key_enc = EXCLUDED.finnhub_key_enc, trading_economics_key_enc = EXCLUDED.trading_economics_key_enc, alpha_vantage_key_enc = EXCLUDED.alpha_vantage_key_enc, market_aux_key_enc = EXCLUDED.market_aux_key_enc, fred_key_enc = EXCLUDED.fred_key_enc", [
    finalNewsApiEnc,
    finalFinnhubEnc,
    finalTradingEconomicsEnc,
    finalAlphaVantageEnc,
    finalMarketAuxEnc,
    finalFredEnc
  ]);
  
  setTimeout(updateNewsAndCalendar, 500);

  addServerLog("GO-BACKPLANE", "SUCCESS", "کلیلەکانی هەواڵ و داتای گشتی بە شێوەیەکی پارێزراو پاشەکەوتکران.");
  res.json({ success: true });
}));

// GET /api/news/config
newsRouter.get("/config", asyncHandler(async (req: Request, res: Response) => {
  const cfg = await pgDb.query("SELECT * FROM news_config") || {};
  res.json({
    success: true,
    hasNewsApiKey: !!cfg.newsApiKeyEnc,
    hasFinnhubKey: !!cfg.finnhubKeyEnc,
    hasTradingEconomicsKey: !!cfg.tradingEconomicsKeyEnc,
    hasAlphaVantageKey: !!cfg.alphaVantageKeyEnc,
    hasMarketAuxKey: !!cfg.marketAuxKeyEnc,
    hasFredKey: !!cfg.fredKeyEnc
  });
}));

// GET /api/news/platforms
newsRouter.get("/platforms", asyncHandler(async (req: Request, res: Response) => {
  const cfg = await pgDb.query("SELECT * FROM news_config") || {};
  
  const platforms = [
    {
      id: "news_api",
      name: "NewsAPI.org",
      hasKey: !!cfg.newsApiKeyEnc,
      status: !cfg.newsApiKeyEnc ? "NOT_CONFIGURED" : (platformStatusCache.news_api?.status || "CONNECTED"),
      errorMessage: platformStatusCache.news_api?.errorMessage || "",
      lastFetchTime: platformStatusCache.news_api?.lastFetchTime || "",
      description: "سەرچاوەیەکی جیهانی گرنگ بۆ هەواڵە دارایی و جیۆپۆلیتیکییەکان."
    },
    {
      id: "finnhub",
      name: "Finnhub Forex News API",
      hasKey: !!cfg.finnhubKeyEnc,
      status: !cfg.finnhubKeyEnc ? "NOT_CONFIGURED" : (platformStatusCache.finnhub?.status || "CONNECTED"),
      errorMessage: platformStatusCache.finnhub?.errorMessage || "",
      lastFetchTime: platformStatusCache.finnhub?.lastFetchTime || "",
      description: "پێشکەشکاری سەرەکی هەواڵ و ڕاپۆرتەکانی بازاڕی فۆرێکس."
    },
    {
      id: "trading_economics",
      name: "Trading Economics API",
      hasKey: !!cfg.tradingEconomicsKeyEnc,
      status: !cfg.tradingEconomicsKeyEnc ? "NOT_CONFIGURED" : (platformStatusCache.trading_economics?.status || "CONNECTED"),
      errorMessage: platformStatusCache.trading_economics?.errorMessage || "",
      lastFetchTime: platformStatusCache.trading_economics?.lastFetchTime || "",
      description: "ڕۆژژمێری ئابووری و داتاکانی گەشەی ووڵاتان."
    },
    {
      id: "alpha_vantage",
      name: "Alpha Vantage Sentiment API",
      hasKey: !!cfg.alphaVantageKeyEnc,
      status: !cfg.alphaVantageKeyEnc ? "NOT_CONFIGURED" : (platformStatusCache.alpha_vantage?.status || "CONNECTED"),
      errorMessage: platformStatusCache.alpha_vantage?.errorMessage || "",
      lastFetchTime: platformStatusCache.alpha_vantage?.lastFetchTime || "",
      description: "داتای سێنتیمێنتی بەهێز و کات-ڕاستەقینە بۆ فۆرێکس."
    },
    {
      id: "market_aux",
      name: "MarketAux Financial News API",
      hasKey: !!cfg.marketAuxKeyEnc,
      status: !cfg.marketAuxKeyEnc ? "NOT_CONFIGURED" : (platformStatusCache.market_aux?.status || "CONNECTED"),
      errorMessage: platformStatusCache.market_aux?.errorMessage || "",
      lastFetchTime: platformStatusCache.market_aux?.lastFetchTime || "",
      description: "هەواڵی کورت و تایبەت بە جووڵە داراییەکان و گرێدانی هەستی بازاڕ."
    },
    {
      id: "fred",
      name: "FRED Federal Reserve Data",
      hasKey: !!cfg.fredKeyEnc,
      status: !cfg.fredKeyEnc ? "NOT_CONFIGURED" : (platformStatusCache.fred?.status || "CONNECTED"),
      errorMessage: platformStatusCache.fred?.errorMessage || "",
      lastFetchTime: platformStatusCache.fred?.lastFetchTime || "",
      description: "سەرچاوەی فەرمی سێنتیمێنت و تێکڕای ڕێژەی سوو لە بانکی فیدراڵی ئەمریکا."
    },
    {
      id: "bloomberg",
      name: "Bloomberg Enterprise Terminal API",
      hasKey: false,
      status: "LICENSED_ONLY",
      errorMessage: "Requires enterprise licensing — not available via public API",
      lastFetchTime: "",
      description: "پرۆتۆکۆلی پەیوەندی فەرمی و زانیاری ڕاستەقینەی بلومبێرگ."
    },
    {
      id: "reuters",
      name: "Reuters Eikon / Refinitiv API",
      hasKey: false,
      status: "LICENSED_ONLY",
      errorMessage: "Requires enterprise licensing — not available via public API",
      lastFetchTime: "",
      description: "سیستەمی گواستنەوەی نێودەوڵەتی هەواڵەکانی ڕۆیتەرز."
    }
  ];

  res.json({ success: true, platforms });
}));

// POST /api/news/disconnect
newsRouter.post("/disconnect", checkIPAllowlist, asyncHandler(async (req: Request, res: Response) => {
  const { platform } = req.body;
  if (!platform) {
    return res.status(400).json({ success: false, error: "Platform name is required." });
  }

  const cfg = await pgDb.query("SELECT * FROM news_config") || {};

  let newsApiKeyEnc = cfg.newsApiKeyEnc || "";
  let finnhubKeyEnc = cfg.finnhubKeyEnc || "";
  let tradingEconomicsKeyEnc = cfg.tradingEconomicsKeyEnc || "";
  let alphaVantageKeyEnc = cfg.alphaVantageKeyEnc || "";
  let marketAuxKeyEnc = cfg.marketAuxKeyEnc || "";
  let fredKeyEnc = cfg.fredKeyEnc || "";

  if (platform === "news_api") newsApiKeyEnc = "";
  else if (platform === "finnhub") finnhubKeyEnc = "";
  else if (platform === "trading_economics") tradingEconomicsKeyEnc = "";
  else if (platform === "alpha_vantage") alphaVantageKeyEnc = "";
  else if (platform === "market_aux") marketAuxKeyEnc = "";
  else if (platform === "fred") fredKeyEnc = "";

  await pgDb.query("INSERT INTO news_config (id, news_api_key_enc, finnhub_key_enc, trading_economics_key_enc, alpha_vantage_key_enc, market_aux_key_enc, fred_key_enc) VALUES (1, $1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET news_api_key_enc = EXCLUDED.news_api_key_enc, finnhub_key_enc = EXCLUDED.finnhub_key_enc, trading_economics_key_enc = EXCLUDED.trading_economics_key_enc, alpha_vantage_key_enc = EXCLUDED.alpha_vantage_key_enc, market_aux_key_enc = EXCLUDED.market_aux_key_enc, fred_key_enc = EXCLUDED.fred_key_enc", [
    newsApiKeyEnc,
    finnhubKeyEnc,
    tradingEconomicsKeyEnc,
    alphaVantageKeyEnc,
    marketAuxKeyEnc,
    fredKeyEnc
  ]);

  if (platformStatusCache[platform]) {
    platformStatusCache[platform].status = "NOT_CONFIGURED";
    platformStatusCache[platform].errorMessage = "";
    platformStatusCache[platform].lastFetchTime = "";
  }
  if (individualSentiments[platform]) {
    individualSentiments[platform] = { score: 0.0, confidence: 0, count: 0, lastFetch: "" };
  }

  const computed = computeAggregatedSentiment();
  updateNewsSentimentState(computed.score, computed);

  addServerLog("GO-BACKPLANE", "INFO", `کۆنفیگ و کلیلەکانی بڕاینی ${platform.toUpperCase()} سڕانەوە.`);
  res.json({ success: true });
}));

// GET /api/news/feed
newsRouter.get("/feed", (req: Request, res: Response) => {
  res.json({
    success: true,
    events: currentNewsEvents,
    minutesUntilHighImpactNews,
    sentimentScore,
    influenceMultiplier: minutesUntilHighImpactNews < 30 ? 0.25 : 1.0,
    hasCalendarFeed: currentNewsEvents.length > 0,
    sentimentState: aggregatedSentimentState,
    liveFeed: aggregatedNewsFeed
  });
});
