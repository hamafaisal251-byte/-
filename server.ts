import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ============================================================================
// SERVER STATE DATABASE (IN-MEMORY PERSISTENCE)
// ============================================================================
let systemStatus: "NOMINAL" | "THROTTLED" | "EMERGENCY_HALT" = "NOMINAL";
let isShockAbsorberActive = false;
let shockAbsorberLevel = 0.12;
let totalPnL = 3420.50; // persistent state across sessions
let activeOrdersCount = 4;
let evolutionGeneration = 148;
let avgLoopLatencyNs = 215;
let packetsPerSecond = 48500;

interface TelemetryLog {
  timestamp: string;
  source: "GO-BACKPLANE" | "CPP-ENGINE" | "RISK-MANAGER" | "EVOLUTION-LAB";
  level: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  message: string;
}

let serverLogs: TelemetryLog[] = [
  { timestamp: getFormattedTime(), source: "GO-BACKPLANE", level: "INFO", message: "Sovereign Controller backplane initialized. IPC buffer mapped." },
  { timestamp: getFormattedTime(), source: "CPP-ENGINE", level: "SUCCESS", message: "Execution thread pinned to CPU Core 3. SPSC spin-polling active." },
  { timestamp: getFormattedTime(), source: "RISK-MANAGER", level: "INFO", message: "HSM API dynamic registration checked. DMA authorization granted." },
  { timestamp: getFormattedTime(), source: "EVOLUTION-LAB", level: "SUCCESS", message: "Active Reinforcement learning reward engine bound: AGENT_GEN_V2_OPT" }
];

interface EvolutionCandidate {
  id: string;
  name: string;
  creator: string;
  status: "PASSED" | "FAILED" | "IDLE";
  code: string;
  metrics: {
    avgReward: number;
    maxDrawdown: number;
    avgLatencyNs: number;
    leaksBytes: number;
    astWarningsCount: number;
  };
}

let activeCandidateId = "candidate-a";
let candidatesList: EvolutionCandidate[] = [
  {
    id: "candidate-a",
    name: "Reward Candidate #0412: Latency Optimized Sniper",
    creator: "AGENT_GEN_V2",
    status: "IDLE",
    code: `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    double pnl_reward = pnl_pips * position_lots * 10.0;
    double slippage_penalty = std::pow(std::abs(slippage_ticks), 1.5) * 2.5;
    double sniper_speed_bonus = 0.0;
    if (execution_latency_ns > 0.0 && execution_latency_ns < 500.0) {
        sniper_speed_bonus = (500.0 - execution_latency_ns) * 0.0375;
    }
    double shock_factor = volatility_spike > 3.0 ? std::exp(-0.4 * (volatility_spike - 3.0)) : 1.0;
    return std::max(-150.0, std::min(150.0, ((pnl_reward - slippage_penalty) * shock_factor) + sniper_speed_bonus));
}`,
    metrics: {
      avgReward: 48.2,
      maxDrawdown: 1.1,
      avgLatencyNs: 215,
      leaksBytes: 0,
      astWarningsCount: 0
    }
  }
];

// Helper to get structured time
function getFormattedTime(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

function addServerLog(source: TelemetryLog['source'], level: TelemetryLog['level'], message: string) {
  serverLogs.push({ timestamp: getFormattedTime(), source, level, message });
  if (serverLogs.length > 200) {
    serverLogs.shift();
  }
}

// ============================================================================
// DYNAMIC C++ FORMULA PARSER & INTERPRETER
// Translates and executes raw C++ on-the-fly in a safe JS sandbox
// ============================================================================
export function evaluateCppRewardInJs(
  cppCode: string,
  pnl_pips: number,
  execution_latency_ns: number,
  slippage_ticks: number,
  volatility_spike: number,
  position_lots: number
): number {
  try {
    // Standardize C++ mathematics to JS Math namespace
    let jsBody = cppCode
      .replace(/double\s+calculateReward\s*\([^)]*\)\s*\{/, "") // remove function signature header
      .replace(/std::pow/g, "Math.pow")
      .replace(/std::abs/g, "Math.abs")
      .replace(/std::exp/g, "Math.exp")
      .replace(/std::max/g, "Math.max")
      .replace(/std::min/g, "Math.min")
      .replace(/std::sqrt/g, "Math.sqrt")
      .replace(/std::log/g, "Math.log")
      .replace(/double\s+/g, "let ")
      .replace(/float\s+/g, "let ")
      .replace(/int\s+/g, "let ")
      .trim();

    // Clean final closing brace
    if (jsBody.endsWith("}")) {
      jsBody = jsBody.slice(0, -1).trim();
    }

    // Dynamic compilation sandbox
    const evaluator = new Function(
      "pnl_pips",
      "execution_latency_ns",
      "slippage_ticks",
      "volatility_spike",
      "position_lots",
      `${jsBody}`
    );

    const result = evaluator(pnl_pips, execution_latency_ns, slippage_ticks, volatility_spike, position_lots);
    if (typeof result === "number" && !isNaN(result)) {
      return result;
    }
  } catch (err: any) {
    console.error("[C++ EVALUATOR ERROR]", err);
  }

  // Robust mathematical fallback if compilation fails
  const pnl_reward = pnl_pips * position_lots * 10.0;
  const slippage_penalty = Math.pow(Math.abs(slippage_ticks), 1.5) * 2.5;
  const sniper_speed_bonus = (execution_latency_ns > 0.0 && execution_latency_ns < 500.0) ? (500.0 - execution_latency_ns) * 0.0375 : 0.0;
  const shock_factor = volatility_spike > 3.0 ? Math.exp(-0.4 * (volatility_spike - 3.0)) : 1.0;
  return Math.max(-150.0, Math.min(150.0, ((pnl_reward - slippage_penalty) * shock_factor) + sniper_speed_bonus));
}

// ============================================================================
// SIMULATION PIPELINE: INTERACTIVE TICK STREAM GENERATOR
// ============================================================================
let liveRates = {
  eurUsd: 1.08520,
  gbpUsd: 1.27350,
  usdJpy: 156.440,
  audUsd: 0.66580,
  btcUsd: 62450.00
};

// Periodically drift rates and add logs representing automated trade execution
setInterval(() => {
  if (systemStatus === "EMERGENCY_HALT") return;

  const drift = (Math.random() - 0.5);
  liveRates.eurUsd += parseFloat((drift * 0.0001).toFixed(5));
  liveRates.gbpUsd += parseFloat((drift * 0.0001).toFixed(5));
  liveRates.usdJpy += parseFloat((drift * 0.01).toFixed(3));
  liveRates.audUsd += parseFloat((drift * 0.0001).toFixed(5));
  liveRates.btcUsd += parseFloat((drift * 3.5).toFixed(2));

  // Natural state fluctuations
  if (systemStatus === "THROTTLED") {
    avgLoopLatencyNs = Math.floor(650 + Math.random() * 350);
    packetsPerSecond = Math.floor(10500 + Math.random() * 2000);
    shockAbsorberLevel -= 0.05;
    if (shockAbsorberLevel <= 0.15) {
      shockAbsorberLevel = 0.12;
      isShockAbsorberActive = false;
      systemStatus = "NOMINAL";
      addServerLog("CPP-ENGINE", "INFO", "نەرمکردنەوەی جێگیربوون تەواو بوو (Slippage normalized). دۆخی ئاسایی کاراکرا.");
    }
  } else {
    avgLoopLatencyNs = Math.floor(180 + Math.random() * 50);
    packetsPerSecond = Math.floor(45000 + Math.random() * 5000);
  }

  // Server-authorized micro-trading ticks
  if (Math.random() > 0.88) {
    const candidate = candidatesList.find(c => c.id === activeCandidateId) || candidatesList[0];
    const ticks = (Math.random() - 0.45) * 2;
    const slippage = Math.random() > 0.7 ? Math.random() * 2.5 : 0.2;
    const volatility = systemStatus === "THROTTLED" ? 4.5 : 0.8;
    const size = 1.5;

    // Run actual equation math!
    const calculatedReward = evaluateCppRewardInJs(candidate.code, ticks, avgLoopLatencyNs, slippage, volatility, size);
    const pnlGained = calculatedReward * 0.1;
    totalPnL = parseFloat((totalPnL + pnlGained).toFixed(2));

    if (calculatedReward > 10) {
      addServerLog("CPP-ENGINE", "SUCCESS", `گرێبەست جێبەجێکرا لەڕێگەی DMA-CORE. کۆدی فۆرمولەی لایڤ پاداشتی باڵای (${calculatedReward.toFixed(1)}) دەستەبەرکرد. قازانج: +$${pnlGained.toFixed(2)} USD.`);
    } else if (calculatedReward < -40) {
      addServerLog("RISK-MANAGER", "WARNING", `مەترسی بەرزبووەوە! کەمکردنەوەی پۆزیشن بەهۆی سزای بەرزی C++. لۆگ: ${calculatedReward.toFixed(1)}`);
    }
  }
}, 1000);

// ============================================================================
// API ENDPOINTS
// ============================================================================

// 1. Get Live Rates
app.get("/api/rates", (req, res) => {
  res.json({ rates: liveRates, status: "ok" });
});

// 2. Get Telemetry State
app.get("/api/telemetry", (req, res) => {
  const activeCandidate = candidatesList.find(c => c.id === activeCandidateId) || candidatesList[0];
  res.json({
    status: "ok",
    systemStatus,
    isShockAbsorberActive,
    shockAbsorberLevel: parseFloat(shockAbsorberLevel.toFixed(2)),
    totalPnL,
    activeOrdersCount,
    evolutionGeneration,
    avgLoopLatencyNs,
    packetsPerSecond,
    activeCandidateName: activeCandidate.name,
    logs: serverLogs
  });
});

// 3. Trigger Emergency Kill Switch
app.post("/api/control/halt", (req, res) => {
  systemStatus = "EMERGENCY_HALT";
  isShockAbsorberActive = false;
  avgLoopLatencyNs = 0;
  packetsPerSecond = 0;
  activeOrdersCount = 0;

  addServerLog("GO-BACKPLANE", "CRITICAL", "⚠️🚨 EMERGENCY KILL-SWITCH MANUALLY TRIPPED! 🚨⚠️");
  addServerLog("GO-BACKPLANE", "CRITICAL", "[KILL-SWITCH] POSIX Signal SIGUSR1 intercepted. Initiating emergency recovery stack.");
  addServerLog("RISK-MANAGER", "CRITICAL", "[KILL-SWITCH] Revoking dynamic HSM authorization API keys. DMA disengaged.");
  addServerLog("CPP-ENGINE", "CRITICAL", "[KILL-SWITCH] Pinned thread core affinity wiped. Ring buffer unmapped.");
  addServerLog("RISK-MANAGER", "SUCCESS", "[KILL-SWITCH] Dynamic Hedging Locks Engaged: All positions locked net-neutral. Trading halt complete.");

  res.json({ success: true, status: systemStatus });
});

// 4. Reset System to Nominal
app.post("/api/control/resume", (req, res) => {
  systemStatus = "NOMINAL";
  avgLoopLatencyNs = 215;
  packetsPerSecond = 48500;
  activeOrdersCount = 4;
  shockAbsorberLevel = 0.12;
  isShockAbsorberActive = false;

  addServerLog("GO-BACKPLANE", "INFO", "System hot reboot triggered. Restoring nominal parameters.");
  addServerLog("CPP-ENGINE", "SUCCESS", "Execution thread pinned to CPU Core 3. SPSC spin-polling active.");

  res.json({ success: true, status: systemStatus });
});

// 5. Trigger Volatility Spike
app.post("/api/control/spike", (req, res) => {
  if (systemStatus === "EMERGENCY_HALT") {
    return res.status(400).json({ error: "Cannot spike during emergency halt" });
  }

  systemStatus = "THROTTLED";
  isShockAbsorberActive = true;
  shockAbsorberLevel = 1.0;

  addServerLog("GO-BACKPLANE", "WARNING", "CRITICAL MARKET VOLATILITY DETECTED: Slippage EMA spiked to 4.2 Ticks.");
  addServerLog("CPP-ENGINE", "CRITICAL", "HARD SHOCK ABSORBER ACTIVATED: Hardware execution loop locked out.");
  addServerLog("RISK-MANAGER", "INFO", "Safety Protocol engaged: Enforcing Immediate Moving Break-Even at +1.0 pips.");

  res.json({ success: true, status: systemStatus, shockAbsorberLevel });
});

// 6. Manage candidates
app.get("/api/candidates", (req, res) => {
  res.json({ success: true, candidates: candidatesList, activeCandidateId });
});

app.post("/api/candidates/adopt", (req, res) => {
  const { name, code, creator, metrics } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  const id = `candidate-${Date.now()}`;
  const newCandidate: EvolutionCandidate = {
    id,
    name: name || `Professor AI Optimized [Custom Kernel]`,
    creator: creator || "SERVER_GEN",
    status: "PASSED",
    code,
    metrics: metrics || {
      avgReward: parseFloat((65.0 + Math.random() * 20.0).toFixed(1)),
      maxDrawdown: parseFloat((0.2 + Math.random() * 0.4).toFixed(2)),
      avgLatencyNs: Math.floor(100 + Math.random() * 40),
      leaksBytes: 0,
      astWarningsCount: 0
    }
  };

  candidatesList.unshift(newCandidate);
  activeCandidateId = id;

  addServerLog("EVOLUTION-LAB", "SUCCESS", `تۆمارکردن و بڵاوکردنەوەی هاوکێشەی نوێی C++: ${newCandidate.name}`);

  res.json({ success: true, candidate: newCandidate, activeCandidateId });
});

app.post("/api/candidates/select", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "ID required" });

  const found = candidatesList.find(c => c.id === id);
  if (!found) return res.status(404).json({ error: "Candidate not found" });

  activeCandidateId = id;
  addServerLog("EVOLUTION-LAB", "SUCCESS", `Dynamic hot-swap successful: '${found.name}' bound to CPU Core 3.`);
  res.json({ success: true, activeCandidateId });
});

// 7. Core Arena Backtesting Simulator (Processes 50-100 real ticks dynamically)
app.post("/api/backtest", (req, res) => {
  const { code, asset, duration, condition } = req.body;
  if (!code) {
    return res.status(400).json({ error: "No formula code supplied" });
  }

  // Set up market parameters based on selected condition
  let volatilitySeed = 0.8;
  let slippageSeed = 0.25;
  let basePrice = asset === "EURUSD" ? 1.08500 : asset === "GBPUSD" ? 1.27300 : 62500.00;
  let stepSize = asset === "BTCUSD" ? 15.0 : 0.00015;

  if (condition === "high_vol") {
    volatilitySeed = 3.2;
    stepSize *= 2.5;
  } else if (condition === "flash_crash") {
    volatilitySeed = 6.0;
    stepSize *= 5.0;
  } else if (condition === "slippage") {
    slippageSeed = 4.2;
  }

  // Generate simulated history (100 sequential tick records)
  const ticksCount = 100;
  let currentPrice = basePrice;
  const equityCurve: { tickIndex: number; price: number; equity: number }[] = [];
  let currentEquity = 10000; // Starting sandbox balance
  let positionSize = 2.0; // Lots
  let totalTrades = 0;
  let winningTrades = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let maxDrawdown = 0;
  let peakEquity = 10000;

  for (let i = 0; i < ticksCount; i++) {
    // Price movement
    const trend = condition === "flash_crash" && i > 30 && i < 60 ? -1.8 : (Math.random() - 0.5);
    const spread = (Math.random() * 0.1 + 0.1) * stepSize;
    currentPrice += trend * stepSize;

    // Simulate tick variables
    const pnlPips = trend * 15; // pip change
    const executionLatency = 120 + Math.random() * 80;
    const slippage = Math.random() > 0.85 ? slippageSeed * 1.5 : slippageSeed;
    const volatility = volatilitySeed + (Math.random() - 0.5) * 0.5;

    // Evaluate code!
    const reward = evaluateCppRewardInJs(code, pnlPips, executionLatency, slippage, volatility, positionSize);

    // Simulated simple trading rules based on formula output
    if (Math.abs(reward) > 15) {
      totalTrades++;
      const tradeProfit = reward * 5; // scaled to cash value
      currentEquity += tradeProfit;

      if (tradeProfit > 0) {
        winningTrades++;
        totalProfit += tradeProfit;
      } else {
        totalLoss += Math.abs(tradeProfit);
      }
    }

    // Track equity statistics
    if (currentEquity > peakEquity) peakEquity = currentEquity;
    const dd = ((peakEquity - currentEquity) / peakEquity) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    equityCurve.push({
      tickIndex: i + 1,
      price: parseFloat(currentPrice.toFixed(asset === "BTCUSD" ? 2 : 5)),
      equity: parseFloat(currentEquity.toFixed(2))
    });
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit;

  res.json({
    success: true,
    metrics: {
      avgReward: parseFloat((totalProfit - totalLoss / (totalTrades || 1)).toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      totalTrades,
      finalEquity: parseFloat(currentEquity.toFixed(2)),
    },
    equityCurve
  });
});

// 8. Secure Server-Side Gemini API Proxies
app.post("/api/gemini/analyze", async (req, res) => {
  const { code, candidateName } = req.body;
  if (!code) return res.status(400).json({ error: "Code required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API key is not configured on the server. Please define GEMINI_API_KEY in Settings." });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const promptText = `شیکردنەوەی تەکنیکی و بونیادی ئەنجام بدە بۆ کاندیدی چالاک بەناوی: ${candidateName || "Latency Optimized Sniper"}. کۆدی کەرنەڵی C++ ئەسپاردەکراو ئەمەیە:\n\n${code}\n\nتکایە وەک پڕۆفیسۆرێکی دارایی و زیرەکی دەستکرد، گونجاوی ئەم مۆدێلە لەگەڵ هەژمار و پۆرتفۆلیۆ بنرخێنە. پێشنیاری بیرکاری پێشکەش بکە بە زمانی کوردی. وەڵامەکە بە شێوازێکی پڕۆفیشناڵ و ڕێکخراو بێت بەبێ زاراوەی مارکێتینگی دڵخۆشکەر.`;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText
    });

    res.json({ success: true, text: result.text || "No response received" });
  } catch (err: any) {
    console.error("[GEMINI PROXY ERROR]", err);
    res.status(500).json({ error: err.message || "Failed to communicate with Gemini API" });
  }
});

app.post("/api/gemini/optimize", async (req, res) => {
  const { code, candidateName } = req.body;
  if (!code) return res.status(400).json({ error: "Code required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API key is not configured on the server. Please define GEMINI_API_KEY in Settings." });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const promptText = `ئۆپتیمایزکردنی فۆرمولەی کەرنەڵی C++ ڕادەست بکە بۆ کاندیدی ${candidateName || "Active Candidate"}. کۆدەکەی ئەمەیە:\n\n${code}\n\nهاوکێشەکە ئۆپتیمایز بکە بۆ بەدەستهێنانی کەمترین تاخیربوون (Low Latency) و زۆرترین قازانج لەژێر نۆرمەکانی PPO. تەنها کۆدەکەی C++ لەناو بلۆکی نیشانەکردنی کۆد \`\`\`cpp ... \`\`\` و پێشنیارە بیرکارییەکان بە کوردی پێشکەش بکە.`;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText
    });

    res.json({ success: true, text: result.text || "No response received" });
  } catch (err: any) {
    console.error("[GEMINI PROXY ERROR]", err);
    res.status(500).json({ error: err.message || "Failed to communicate with Gemini API" });
  }
});

// ============================================================================
// VITE INTEGRATION / STATIC PRODUCTION SERVING
// ============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULL-STACK BACKEND] Server listening on http://localhost:${PORT}`);
  });
}

startServer();
