import crypto from "crypto";
import { pgDb } from "../db";
import { addServerLog } from "./logging";
import { decrypt } from "../utils/crypto";

export interface NewsEvent {
  title?: string;
  source?: string;
  url?: string;
  time?: string;
  impact?: "HIGH" | "MEDIUM" | "LOW";
  currency?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  minutesRemaining?: number;
  sentimentScore?: number;
}

export let currentNewsEvents: NewsEvent[] = [];

export let minutesUntilHighImpactNews = 999;
export let sentimentScore = 0.0;

export let individualSentiments: Record<string, { score: number; confidence: number; count: number; lastFetch: string }> = {
  news_api: { score: 0.0, confidence: 0, count: 0, lastFetch: "" },
  finnhub: { score: 0.0, confidence: 0, count: 0, lastFetch: "" },
  trading_economics: { score: 0.0, confidence: 0, count: 0, lastFetch: "" },
  alpha_vantage: { score: 0.0, confidence: 0, count: 0, lastFetch: "" },
  market_aux: { score: 0.0, confidence: 0, count: 0, lastFetch: "" },
  fred: { score: 0.0, confidence: 0, count: 0, lastFetch: "" }
};

interface NewsFeedItem {
  source: string;
  title: string;
  url?: string;
  time: string;
  sentiment: number;
}
export let aggregatedNewsFeed: NewsFeedItem[] = [];

export let aggregatedSentimentState = {
  score: 0.0,
  disagreement: false,
  breakdown: [] as any[],
  minScore: 0.0,
  maxScore: 0.0
};

export function updateNewsSentimentState(score: number, state: any) {
  sentimentScore = score;
  aggregatedSentimentState = state;
}

export const platformStatusCache: Record<string, {
  status: "CONNECTED" | "ERROR" | "NOT_CONFIGURED" | "LICENSED_ONLY";
  errorMessage: string;
  lastFetchTime: string;
}> = {
  news_api: { status: "NOT_CONFIGURED", errorMessage: "", lastFetchTime: "" },
  finnhub: { status: "NOT_CONFIGURED", errorMessage: "", lastFetchTime: "" },
  trading_economics: { status: "NOT_CONFIGURED", errorMessage: "", lastFetchTime: "" },
  alpha_vantage: { status: "NOT_CONFIGURED", errorMessage: "", lastFetchTime: "" },
  market_aux: { status: "NOT_CONFIGURED", errorMessage: "", lastFetchTime: "" },
  fred: { status: "NOT_CONFIGURED", errorMessage: "", lastFetchTime: "" },
  bloomberg: { status: "LICENSED_ONLY", errorMessage: "Requires enterprise licensing — not available via public API", lastFetchTime: "" },
  reuters: { status: "LICENSED_ONLY", errorMessage: "Requires enterprise licensing — not available via public API", lastFetchTime: "" }
};

export function computeAggregatedSentiment() {
  const activeSources = Object.entries(individualSentiments).filter(([_, data]) => {
    return data.lastFetch !== "";
  });

  if (activeSources.length === 0) {
    return {
      score: 0.0,
      disagreement: false,
      breakdown: [] as any[],
      minScore: 0.0,
      maxScore: 0.0
    };
  }

  let weightedSum = 0;
  let confidenceSum = 0;
  let minScore = 1.0;
  let maxScore = -1.0;

  const breakdown = activeSources.map(([source, data]) => {
    weightedSum += data.score * data.confidence;
    confidenceSum += data.confidence;
    if (data.score < minScore) minScore = data.score;
    if (data.score > maxScore) maxScore = data.score;
    
    return {
      source,
      score: data.score,
      confidence: data.confidence,
      count: data.count,
      lastFetch: data.lastFetch
    };
  });

  const finalScore = confidenceSum > 0 ? weightedSum / confidenceSum : 0.0;
  const disagreement = activeSources.length > 1 && (maxScore - minScore) >= 0.5;

  return {
    score: Math.max(-1.0, Math.min(1.0, finalScore)),
    disagreement,
    breakdown,
    minScore: minScore === 1.0 ? 0.0 : minScore,
    maxScore: maxScore === -1.0 ? 0.0 : maxScore
  };
}

function getNestedValue(obj: any, pathStr: string): any {
  if (!pathStr) return obj;
  const parts = pathStr.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const match = part.match(/^(\w+)(?:\[(\d+)\])?$/);
    if (match) {
      const key = match[1];
      const index = match[2];
      current = current[key];
      if (index !== undefined && Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      }
    } else {
      current = current[part];
    }
  }
  return current;
}

export async function executeCustomConnectorEndpoint(
  connector: any,
  endpointName: string,
  variables: Record<string, any> = {},
  rawRequestPayload: any = null
) {
  const endpoints = connector.endpoints || {};
  const endpoint = endpoints[endpointName];
  if (!endpoint) {
    throw new Error(`Endpoint '${endpointName}' is not defined in this custom connector configuration.`);
  }

  const method = (endpoint.method || "GET").toUpperCase();
  let pathTemplate = endpoint.path || "";
  
  let resolvedPath = pathTemplate;
  for (const [key, val] of Object.entries(variables)) {
    resolvedPath = resolvedPath.replace(new RegExp(`{${key}}`, "g"), String(val));
  }

  const baseUrl = connector.base_url.replace(/\/$/, "");
  let fullUrl = `${baseUrl}${resolvedPath.startsWith("/") ? "" : "/"}${resolvedPath}`;

  const authScheme = connector.auth_scheme;
  const authConfig = connector.auth_config || {};
  
  const decryptedApiKey = authConfig.apiKeyEnc ? decrypt(authConfig.apiKeyEnc) : (authConfig.apiKey || "");
  const decryptedSecretKey = authConfig.secretKeyEnc ? decrypt(authConfig.secretKeyEnc) : (authConfig.secretKey || "");
  const decryptedUsername = authConfig.usernameEnc ? decrypt(authConfig.usernameEnc) : (authConfig.username || "");
  const decryptedPassword = authConfig.passwordEnc ? decrypt(authConfig.passwordEnc) : (authConfig.password || "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const queryParams: Record<string, string> = {};

  let bodyStr = "";
  if (["POST", "PUT", "PATCH"].includes(method)) {
    let finalPayload = rawRequestPayload;
    if (!finalPayload && endpoint.bodyTemplate) {
      let temp = endpoint.bodyTemplate;
      for (const [key, val] of Object.entries(variables)) {
        temp = temp.replace(new RegExp(`{${key}}`, "g"), String(val));
      }
      try {
        finalPayload = JSON.parse(temp);
      } catch (e) {
        bodyStr = temp;
      }
    }
    if (finalPayload) {
      bodyStr = JSON.stringify(finalPayload);
    }
  }

  if (authScheme === "api_key_header") {
    const headerName = authConfig.headerName || "X-API-KEY";
    headers[headerName] = decryptedApiKey;
  } else if (authScheme === "api_key_query_param") {
    const paramName = authConfig.paramName || "api_key";
    queryParams[paramName] = decryptedApiKey;
  } else if (authScheme === "bearer_token") {
    headers["Authorization"] = `Bearer ${decryptedApiKey}`;
  } else if (authScheme === "basic_auth") {
    const creds = `${decryptedUsername}:${decryptedPassword || decryptedApiKey}`;
    headers["Authorization"] = `Basic ${Buffer.from(creds).toString("base64")}`;
  } else if (authScheme === "hmac_signed") {
    const algo = authConfig.algorithm || "sha256";
    const hmacEncoding = authConfig.encoding || "hex";
    const signaturePlacement = authConfig.placement || "header";
    const signatureName = authConfig.signatureName || "X-Signature";
    const timestampName = authConfig.timestampName || "X-Timestamp";
    const timestampVal = String(Date.now());

    let messagePattern = authConfig.messagePattern || "{timestamp}{method}{path}{body}";
    let msg = messagePattern
      .replace("{timestamp}", timestampVal)
      .replace("{method}", method)
      .replace("{path}", resolvedPath)
      .replace("{body}", bodyStr);

    const signature = crypto
      .createHmac(algo, decryptedSecretKey)
      .update(msg)
      .digest(hmacEncoding as any);

    if (timestampName) {
      headers[timestampName] = timestampVal;
    }

    if (signaturePlacement === "header") {
      headers[signatureName] = signature;
      if (decryptedApiKey) {
        headers[authConfig.apiKeyHeaderName || "X-API-KEY"] = decryptedApiKey;
      }
    } else {
      queryParams[signatureName] = signature;
      queryParams["timestamp"] = timestampVal;
      if (decryptedApiKey) {
        queryParams[authConfig.apiKeyQueryName || "signature_key"] = decryptedApiKey;
      }
    }
  }

  const urlObj = new URL(fullUrl);
  for (const [k, v] of Object.entries(queryParams)) {
    urlObj.searchParams.append(k, v);
  }
  fullUrl = urlObj.toString();

  const fetchOptions: any = {
    method,
    headers
  };
  if (bodyStr) {
    fetchOptions.body = bodyStr;
  }

  const response = await fetch(fullUrl, fetchOptions);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${responseText}`);
  }

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Response is not valid JSON. Raw output: ${responseText.substring(0, 500)}`);
  }

  const mapping = endpoint.mapping || {};
  const result: Record<string, any> = {
    _raw: parsedJson
  };

  for (const [internalKey, externalPath] of Object.entries(mapping)) {
    if (typeof externalPath === "string") {
      const extracted = getNestedValue(parsedJson, externalPath);
      result[internalKey] = extracted;
    }
  }

  return result;
}

export async function testNewsConnection(platform: string, apiKey: string): Promise<{ success: boolean; errorMessage?: string }> {
  if (!apiKey) {
    return { success: false, errorMessage: "API Key is empty" };
  }
  try {
    if (platform === "news_api") {
      const response = await fetch(`https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${apiKey}`);
      if (response.ok) {
        return { success: true };
      } else {
        const errJson = await response.json().catch(() => ({}));
        return { success: false, errorMessage: errJson.message || `HTTP ${response.status}` };
      }
    } else if (platform === "finnhub") {
      const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`);
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, errorMessage: `HTTP ${response.status}` };
      }
    } else if (platform === "trading_economics") {
      const response = await fetch(`https://api.tradingeconomics.com/calendar?c=${apiKey}`).catch(() => null);
      if (response && (response.ok || response.status === 401)) {
        if (response.status === 401) {
          return { success: false, errorMessage: "Unauthorized: Invalid Trading Economics API Key" };
        }
        return { success: true };
      }
      return { success: false, errorMessage: "Trading Economics API unreachable or unauthorized." };
    } else if (platform === "alpha_vantage") {
      const response = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}`);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data["Note"] || data["Error Message"]) {
          return { success: false, errorMessage: data["Note"] || data["Error Message"] };
        }
        return { success: true };
      } else {
        return { success: false, errorMessage: `HTTP ${response.status}` };
      }
    } else if (platform === "market_aux") {
      const response = await fetch(`https://api.marketaux.com/v1/news/all?symbols=TSLA&limit=1&api_token=${apiKey}`);
      if (response.ok) {
        return { success: true };
      } else {
        const errJson = await response.json().catch(() => ({}));
        return { success: false, errorMessage: errJson.error?.message || `HTTP ${response.status}` };
      }
    } else if (platform === "fred") {
      const response = await fetch(`https://api.stlouisfed.org/fred/series?series_id=DFF&api_key=${apiKey}&file_type=json`);
      if (response.ok) {
        return { success: true };
      } else {
        const errJson = await response.json().catch(() => ({}));
        return { success: false, errorMessage: errJson.error_message || `HTTP ${response.status}` };
      }
    }
    return { success: false, errorMessage: "Unknown platform" };
  } catch (err: any) {
    return { success: false, errorMessage: err.message };
  }
}

export async function updateNewsAndCalendar() {
  const newsKeys = await pgDb.query("SELECT * FROM news_config") || {};
  let newsApiKey = newsKeys.newsApiKeyEnc ? decrypt(newsKeys.newsApiKeyEnc) : "";
  let finnhubKey = newsKeys.finnhubKeyEnc ? decrypt(newsKeys.finnhubKeyEnc) : "";
  let tradingEconomicsKey = newsKeys.tradingEconomicsKeyEnc ? decrypt(newsKeys.tradingEconomicsKeyEnc) : "";
  let alphaVantageKey = newsKeys.alphaVantageKeyEnc ? decrypt(newsKeys.alphaVantageKeyEnc) : "";
  let marketAuxKey = newsKeys.marketAuxKeyEnc ? decrypt(newsKeys.marketAuxKeyEnc) : "";
  let fredKey = newsKeys.fredKeyEnc ? decrypt(newsKeys.fredKeyEnc) : "";

  try {
    if (newsApiKey) {
      try {
        const response = await fetch(`https://newsapi.org/v2/everything?q=forex+OR+inflation+OR+cpi+OR+fed&sortBy=publishedAt&pageSize=5&apiKey=${newsApiKey}`);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.articles && data.articles.length > 0) {
            const titles = data.articles.map((a: any) => a.title).join(" ");
            const negativeWords = ["crash", "drop", "inflation", "hike", "recession", "hawkish", "down", "deficit", "warns"];
            const positiveWords = ["grow", "rise", "dovish", "easing", "boost", "surplus", "up", "recovery", "strong"];
            let score = 0;
            negativeWords.forEach(w => { if (titles.toLowerCase().includes(w)) score -= 0.15; });
            positiveWords.forEach(w => { if (titles.toLowerCase().includes(w)) score += 0.15; });
            const finalScore = Math.max(-1.0, Math.min(1.0, score));
            
            individualSentiments.news_api = {
              score: finalScore,
              confidence: 0.8,
              count: data.articles.length,
              lastFetch: new Date().toISOString()
            };
            
            data.articles.forEach((art: any) => {
              let itemScore = 0;
              negativeWords.forEach(w => { if (art.title.toLowerCase().includes(w)) itemScore -= 0.2; });
              positiveWords.forEach(w => { if (art.title.toLowerCase().includes(w)) itemScore += 0.2; });
              aggregatedNewsFeed.unshift({
                source: "NewsAPI",
                title: art.title,
                url: art.url,
                time: art.publishedAt || new Date().toISOString(),
                sentiment: Math.max(-1.0, Math.min(1.0, itemScore))
              });
            });
            
            platformStatusCache.news_api = { status: "CONNECTED", errorMessage: "", lastFetchTime: new Date().toISOString() };
          }
        } else {
          platformStatusCache.news_api = { status: "ERROR", errorMessage: `HTTP ${response.status}`, lastFetchTime: new Date().toISOString() };
        }
      } catch (err: any) {
        platformStatusCache.news_api = { status: "ERROR", errorMessage: err.message, lastFetchTime: new Date().toISOString() };
      }
    }

    if (finnhubKey) {
      try {
        const response = await fetch(`https://finnhub.io/api/v1/news?category=forex&token=${finnhubKey}`);
        if (response.ok) {
          const data = await response.json() as any;
          if (Array.isArray(data) && data.length > 0) {
            const titles = data.slice(0, 5).map((a: any) => a.headline).join(" ");
            const negativeWords = ["crash", "drop", "inflation", "hike", "recession", "hawkish", "down", "deficit", "warns"];
            const positiveWords = ["grow", "rise", "dovish", "easing", "boost", "surplus", "up", "recovery", "strong"];
            let score = 0;
            negativeWords.forEach(w => { if (titles.toLowerCase().includes(w)) score -= 0.15; });
            positiveWords.forEach(w => { if (titles.toLowerCase().includes(w)) score += 0.15; });
            const finalScore = Math.max(-1.0, Math.min(1.0, score));

            individualSentiments.finnhub = {
              score: finalScore,
              confidence: 0.85,
              count: Math.min(5, data.length),
              lastFetch: new Date().toISOString()
            };

            data.slice(0, 5).forEach((art: any) => {
              let itemScore = 0;
              negativeWords.forEach(w => { if (art.headline.toLowerCase().includes(w)) itemScore -= 0.2; });
              positiveWords.forEach(w => { if (art.headline.toLowerCase().includes(w)) itemScore += 0.2; });
              aggregatedNewsFeed.unshift({
                source: "Finnhub",
                title: art.headline,
                url: art.url,
                time: new Date(art.datetime * 1000).toISOString(),
                sentiment: Math.max(-1.0, Math.min(1.0, itemScore))
              });
            });

            platformStatusCache.finnhub = { status: "CONNECTED", errorMessage: "", lastFetchTime: new Date().toISOString() };
          }
        } else {
          platformStatusCache.finnhub = { status: "ERROR", errorMessage: `HTTP ${response.status}`, lastFetchTime: new Date().toISOString() };
        }
      } catch (err: any) {
        platformStatusCache.finnhub = { status: "ERROR", errorMessage: err.message, lastFetchTime: new Date().toISOString() };
      }
    }

    if (alphaVantageKey) {
      try {
        const response = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${alphaVantageKey}`);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.feed && Array.isArray(data.feed)) {
            let totalScore = 0;
            let count = 0;
            data.feed.slice(0, 5).forEach((item: any) => {
              const rawScore = parseFloat(item.overall_sentiment_score) || 0.0;
              let normalScore = rawScore / 0.5;
              normalScore = Math.max(-1.0, Math.min(1.0, normalScore));
              
              totalScore += rawScore;
              count++;

              aggregatedNewsFeed.unshift({
                source: "Alpha Vantage",
                title: item.title,
                url: item.url,
                time: item.time_published ? new Date(item.time_published.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6')).toISOString() : new Date().toISOString(),
                sentiment: normalScore
              });
            });

            const avgScore = count > 0 ? totalScore / count : 0.0;
            individualSentiments.alpha_vantage = {
              score: Math.max(-1.0, Math.min(1.0, avgScore / 0.4)),
              confidence: 0.9,
              count: count,
              lastFetch: new Date().toISOString()
            };

            platformStatusCache.alpha_vantage = { status: "CONNECTED", errorMessage: "", lastFetchTime: new Date().toISOString() };
          } else if (data["Note"] || data["Error Message"]) {
            platformStatusCache.alpha_vantage = { status: "ERROR", errorMessage: data["Note"] || data["Error Message"], lastFetchTime: new Date().toISOString() };
          }
        } else {
          platformStatusCache.alpha_vantage = { status: "ERROR", errorMessage: `HTTP ${response.status}`, lastFetchTime: new Date().toISOString() };
        }
      } catch (err: any) {
        platformStatusCache.alpha_vantage = { status: "ERROR", errorMessage: err.message, lastFetchTime: new Date().toISOString() };
      }
    }

    if (marketAuxKey) {
      try {
        const response = await fetch(`https://api.marketaux.com/v1/news/all?symbols=TSLA,AMZN&limit=5&api_token=${marketAuxKey}`);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.data && Array.isArray(data.data)) {
            let totalScore = 0;
            let count = 0;
            data.data.forEach((item: any) => {
              const s = parseFloat(item.sentiment);
              if (!isNaN(s)) {
                totalScore += s;
                count++;
              }
              aggregatedNewsFeed.unshift({
                source: "MarketAux",
                title: item.title,
                url: item.url,
                time: item.published_at || new Date().toISOString(),
                sentiment: parseFloat(item.sentiment) || 0.0
              });
            });

            individualSentiments.market_aux = {
              score: count > 0 ? totalScore / count : 0.0,
              confidence: 0.8,
              count: count,
              lastFetch: new Date().toISOString()
            };
            platformStatusCache.market_aux = { status: "CONNECTED", errorMessage: "", lastFetchTime: new Date().toISOString() };
          }
        } else {
          platformStatusCache.market_aux = { status: "ERROR", errorMessage: `HTTP ${response.status}`, lastFetchTime: new Date().toISOString() };
        }
      } catch (err: any) {
        platformStatusCache.market_aux = { status: "ERROR", errorMessage: err.message, lastFetchTime: new Date().toISOString() };
      }
    }

    if (fredKey) {
      try {
        const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${fredKey}&file_type=json&sort_order=desc&limit=5`);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.observations && Array.isArray(data.observations)) {
            const latest = parseFloat(data.observations[0]?.value);
            const prev = parseFloat(data.observations[1]?.value);
            let score = 0.0;
            if (!isNaN(latest) && !isNaN(prev)) {
              score = latest > prev ? -0.2 : 0.2;
            }

            individualSentiments.fred = {
              score,
              confidence: 0.7,
              count: data.observations.length,
              lastFetch: new Date().toISOString()
            };

            data.observations.slice(0, 3).forEach((obs: any) => {
              aggregatedNewsFeed.unshift({
                source: "FRED",
                title: `FED CPI Release observed at ${obs.value} (${obs.date})`,
                time: obs.date + "T00:00:00Z",
                sentiment: score
              });
            });

            platformStatusCache.fred = { status: "CONNECTED", errorMessage: "", lastFetchTime: new Date().toISOString() };
          }
        } else {
          platformStatusCache.fred = { status: "ERROR", errorMessage: `HTTP ${response.status}`, lastFetchTime: new Date().toISOString() };
        }
      } catch (err: any) {
        platformStatusCache.fred = { status: "ERROR", errorMessage: err.message, lastFetchTime: new Date().toISOString() };
      }
    }

    // --- ECONOMIC CALENDAR ---
    if (tradingEconomicsKey) {
      try {
        const response = await fetch(`https://api.tradingeconomics.com/calendar?c=${tradingEconomicsKey}&f=json`).catch(() => null);
        if (response && response.ok) {
          const data = await response.json() as any;
          if (Array.isArray(data)) {
            const mapped: NewsEvent[] = data.slice(0, 5).map((item: any) => {
              const eventTime = new Date(item.Date);
              const diffMs = eventTime.getTime() - Date.now();
              const minutesRemaining = Math.round(diffMs / 60000);

              let impact: "HIGH" | "MEDIUM" | "LOW" = "LOW";
              if (item.Importance === 3 || String(item.Importance).toLowerCase().includes("high")) {
                impact = "HIGH";
              } else if (item.Importance === 2 || String(item.Importance).toLowerCase().includes("medium") || String(item.Importance).toLowerCase().includes("mid")) {
                impact = "MEDIUM";
              }

              let evSentiment = 0.0;
              if (impact === "HIGH") {
                evSentiment = item.Actual && item.Forecast && parseFloat(item.Actual) > parseFloat(item.Forecast) ? 0.35 : -0.35;
              }

              return {
                title: item.Event || "Macro Economic Indicator Release",
                impact,
                currency: item.Currency || "USD",
                forecast: item.Forecast || "N/A",
                previous: item.Previous || "N/A",
                actual: item.Actual || "",
                minutesRemaining,
                sentimentScore: evSentiment
              };
            });

            if (mapped.length > 0) {
              currentNewsEvents = mapped;
              platformStatusCache.trading_economics = { status: "CONNECTED", errorMessage: "", lastFetchTime: new Date().toISOString() };
              individualSentiments.trading_economics = {
                score: mapped.reduce((acc, curr) => acc + (curr.sentimentScore || 0), 0) / mapped.length,
                confidence: 0.95,
                count: mapped.length,
                lastFetch: new Date().toISOString()
              };
            }
          }
        } else if (response) {
          platformStatusCache.trading_economics = { status: "ERROR", errorMessage: `HTTP ${response.status}`, lastFetchTime: new Date().toISOString() };
        }
      } catch (err: any) {
        platformStatusCache.trading_economics = { status: "ERROR", errorMessage: err.message, lastFetchTime: new Date().toISOString() };
      }
    } else if (fredKey) {
      try {
        const seriesList = ["DFF", "CPIAUCSL", "UNRATE"];
        const names = { "DFF": "FOMC Interest Rate Decision", "CPIAUCSL": "US Core CPI MoM", "UNRATE": "US Unemployment Rate" };
        const currencies = { "DFF": "USD", "CPIAUCSL": "USD", "UNRATE": "USD" };
        
        const events: NewsEvent[] = [];
        for (const sid of seriesList) {
          const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${sid}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`);
          if (response.ok) {
            const data = await response.json() as any;
            if (data.observations && data.observations.length > 0) {
              const obs = data.observations[0];
              events.push({
                title: names[sid as keyof typeof names],
                impact: "HIGH",
                currency: currencies[sid as keyof typeof currencies],
                forecast: "FRED Real Observation",
                previous: "N/A",
                actual: obs.value || "",
                minutesRemaining: -30,
                sentimentScore: 0.1
              });
            }
          }
        }
        if (events.length > 0) {
          currentNewsEvents = events;
          platformStatusCache.fred = { status: "CONNECTED", errorMessage: "", lastFetchTime: new Date().toISOString() };
        }
      } catch (err: any) {
        console.error("FRED Calendar setup failed:", err);
      }
    } else {
      // Free fall-back: public Forex Factory weekly calendar feed (real, zero-configuration)
      try {
        const response = await fetch(`https://nfs.faireconomy.media/ff_calendar_thisweek.json`);
        if (response.ok) {
          const data = await response.json() as any;
          if (Array.isArray(data)) {
            const now = Date.now();
            const mapped: NewsEvent[] = data
              .map((item: any) => {
                const eventTime = new Date(item.date);
                const diffMs = eventTime.getTime() - now;
                const minutesRemaining = Math.round(diffMs / 60000);

                let impact: "HIGH" | "MEDIUM" | "LOW" = "LOW";
                if (item.impact === "High") {
                  impact = "HIGH";
                } else if (item.impact === "Medium") {
                  impact = "MEDIUM";
                }

                return {
                  title: item.title || "Economic Indicator",
                  impact,
                  currency: item.country || "USD",
                  forecast: item.forecast || "N/A",
                  previous: item.previous || "N/A",
                  actual: item.actual || "",
                  minutesRemaining,
                  sentimentScore: impact === "HIGH" ? -0.1 : 0.0
                };
              })
              .filter(item => item.minutesRemaining > -180 && item.minutesRemaining < 1440)
              .slice(0, 10);

            if (mapped.length > 0) {
              currentNewsEvents = mapped;
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch public Forex Factory economic calendar fallback:", err.message);
        currentNewsEvents = [];
      }
    }

    // Fetch and incorporate Custom News Connectors
    try {
      const customNewsConnectors = await pgDb.queryAsync("SELECT * FROM custom_connectors WHERE type = 'news'");
      if (customNewsConnectors && customNewsConnectors.length > 0) {
        for (const connector of customNewsConnectors) {
          try {
            // Execute the get_news endpoint
            const result = await executeCustomConnectorEndpoint(connector, "get_news", { symbol: "EUR/USD" });
            const endpoints = connector.endpoints || {};
            const endpoint = endpoints["get_news"] || {};
            const rootPath = endpoint.rootPath || "";
            const listObj = rootPath ? getNestedValue(result._raw, rootPath) : result._raw;

            if (Array.isArray(listObj)) {
              const mappedArticles: any[] = [];
              let scoreSum = 0;
              let count = 0;

              const negativeWords = ["crash", "drop", "inflation", "hike", "recession", "hawkish", "down", "deficit", "warns"];
              const positiveWords = ["grow", "rise", "dovish", "easing", "boost", "surplus", "up", "recovery", "strong"];

              listObj.forEach((item: any) => {
                const titleMapping = endpoint.mapping?.title || "title";
                const urlMapping = endpoint.mapping?.url || "url";
                const timeMapping = endpoint.mapping?.time || "publishedAt";
                const sentimentMapping = endpoint.mapping?.sentiment || "";

                const title = getNestedValue(item, titleMapping) || "";
                const url = getNestedValue(item, urlMapping) || "";
                const time = getNestedValue(item, timeMapping) || new Date().toISOString();

                let sentimentVal = 0.0;
                if (sentimentMapping) {
                  sentimentVal = parseFloat(getNestedValue(item, sentimentMapping)) || 0.0;
                } else {
                  let score = 0;
                  negativeWords.forEach(w => { if (title.toLowerCase().includes(w)) score -= 0.2; });
                  positiveWords.forEach(w => { if (title.toLowerCase().includes(w)) score += 0.2; });
                  sentimentVal = Math.max(-1.0, Math.min(1.0, score));
                }

                if (title) {
                  mappedArticles.push({
                    source: connector.name,
                    title,
                    url,
                    time,
                    sentiment: sentimentVal
                  });
                  scoreSum += sentimentVal;
                  count++;
                }
              });

              if (mappedArticles.length > 0) {
                mappedArticles.forEach(art => {
                  aggregatedNewsFeed.unshift(art);
                });

                individualSentiments[connector.name] = {
                  score: scoreSum / count,
                  confidence: 0.85,
                  count: mappedArticles.length,
                  lastFetch: new Date().toISOString()
                };

                platformStatusCache[connector.name] = {
                  status: "CONNECTED",
                  errorMessage: "",
                  lastFetchTime: new Date().toISOString()
                };
              }
            }
          } catch (connectorErr: any) {
            console.error(`[CUSTOM-NEWS-CONNECTOR-ERROR] ${connector.name}:`, connectorErr.message);
            platformStatusCache[connector.name] = {
              status: "ERROR",
              errorMessage: connectorErr.message,
              lastFetchTime: new Date().toISOString()
            };
          }
        }
      }
    } catch (dbErr: any) {
      console.error("[CUSTOM-NEWS-CONNECTORS-DB-ERROR]", dbErr.message);
    }

    if (aggregatedNewsFeed.length > 50) {
      const titlesSeen = new Set<string>();
      aggregatedNewsFeed = aggregatedNewsFeed.filter(item => {
        if (titlesSeen.has(item.title)) return false;
        titlesSeen.add(item.title);
        return true;
      }).slice(0, 50);
    }

    const computed = computeAggregatedSentiment();
    sentimentScore = computed.score;
    aggregatedSentimentState = computed;

    const highImpact = currentNewsEvents.find(e => e.impact === "HIGH" && (e.minutesRemaining || 0) > 0);
    minutesUntilHighImpactNews = highImpact && highImpact.minutesRemaining !== undefined ? highImpact.minutesRemaining : 999;
    
    if (minutesUntilHighImpactNews < 30) {
      addServerLog("RISK-MANAGER", "WARNING", `[DRL-INTEGRATION] Pausing/reducing order sizing to 25% ahead of high impact news! Countdown: ${minutesUntilHighImpactNews}m.`);
    }

  } catch (err: any) {
    console.error("[NEWS-FETCH-ERROR]", err);
  }
}

// Economic news updates every 3 minutes
setInterval(updateNewsAndCalendar, 180000);

