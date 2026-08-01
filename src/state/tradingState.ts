export let systemStatus: "NOMINAL" | "THROTTLED" | "EMERGENCY_HALT" = "NOMINAL";

export function setSystemStatus(status: "NOMINAL" | "THROTTLED" | "EMERGENCY_HALT") {
  systemStatus = status;
}

export let errorCount = 0;

export function setErrorCount(count: number) {
  errorCount = count;
}

export function incrementErrorCount() {
  errorCount++;
}

export let demoLivePositions: any[] = [
  { id: 'pos-demo-1', symbol: 'EUR/USD', type: 'BUY', size: 1.5, entryPrice: 1.08450, currentPrice: 1.08580, sl: 1.08000, tp: 1.09500, pnl: 195.00 },
  { id: 'pos-demo-2', symbol: 'GBP/USD', type: 'SELL', size: 2.0, entryPrice: 1.26420, currentPrice: 1.26310, sl: 1.27000, tp: 1.25200, pnl: 220.00 },
  { id: 'pos-demo-3', symbol: 'BTC/USD', type: 'BUY', size: 0.5, entryPrice: 62450.00, currentPrice: 62780.00, sl: 61000.00, tp: 65000.00, pnl: 165.00 }
];

export function setDemoLivePositions(positions: any[]) {
  demoLivePositions.length = 0;
  demoLivePositions.push(...positions);
  livePositions = demoLivePositions;
}

export let demoLiveAccountStats = {
  balance: 104250.40,
  equity: 104830.40,
  usedMargin: 3750.00,
  freeMargin: 101080.40,
  marginLevel: 2795.4,
  todayPnl: 1420.50
};

export let demoLiveDailyTradesCount = 0;
export let demoLiveDailyWinsCount = 0;
export let demoLiveMaxDrawdownToday = 0.0;
export let lastCheckedDateUTCStr = new Date().toISOString().split("T")[0];

export let lastRecordedStats = {
  balance: 0,
  equity: 0,
  usedMargin: 0,
  freeMargin: 0,
  positionsCount: -1,
  todayPnl: -999999
};

export function recordDemoLiveTradeClose(pnl: number) {
  demoLiveDailyTradesCount++;
  if (pnl > 0) {
    demoLiveDailyWinsCount++;
  }
}

export let realLivePositions: any[] = [];

export function setRealLivePositions(positions: any[]) {
  realLivePositions.length = 0;
  realLivePositions.push(...positions);
}

export let realLiveAccountStats = {
  balance: 50000.00,
  equity: 50000.00,
  usedMargin: 0.00,
  freeMargin: 50000.00,
  marginLevel: 0,
  todayPnl: 0.00
};

export let realLiveActiveCandidateId = "candidate-a";
export function setRealLiveActiveCandidateId(id: string) {
  realLiveActiveCandidateId = id;
}

export let livePositions = demoLivePositions;
export function setLivePositions(positions: any[]) {
  livePositions = positions;
}

export let liveAccountStats = demoLiveAccountStats;
export function setLiveAccountStats(stats: any) {
  liveAccountStats = stats;
}

export let arbitrageConfig = {
  liveEnabled: false,
  thresholdNetProfitUsd: 15.0,
  orderSizeBtc: 0.5,
  slippagePct: 0.05
};

export let activeCandidateId = "candidate-a";
export function setActiveCandidateId(id: string) { activeCandidateId = id; }

export let candidatesList: any[] = [
  {
    id: "candidate-a",
    name: "Reward Candidate #0412: Latency Optimized Sniper",
    creator: "AGENT_GEN_V2",
    status: "IDLE",
    code: `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) { return 0.0; }`,
    metrics: {
      avgReward: 4.2,
      maxDrawdown: 0.8,
      avgLatencyNs: 180.0,
      leaksBytes: 0,
      astWarningsCount: 0
    }
  }
];
export function setCandidatesList(list: any[]) { candidatesList = list; }

export let geminiAvailableState: "GEMINI_AVAILABLE" | "GEMINI_UNAVAILABLE" = "GEMINI_AVAILABLE";
export function setGeminiAvailableState(s: "GEMINI_AVAILABLE" | "GEMINI_UNAVAILABLE") { geminiAvailableState = s; }

export let geminiLastTransitionTime = new Date().toISOString();
export function setGeminiLastTransitionTime(t: string) { geminiLastTransitionTime = t; }

export let tier3Status = "RUNNING";
export function setTier3Status(s: string) { tier3Status = s; }

export let selectedLocalModel = "llama3.1:70b";
export let ollamaStatus = "ONLINE";
export let benchmarkResults: any = {};
export let mockOutageSimulated = false;
export function setMockOutageSimulated(val: boolean) { mockOutageSimulated = val; }
export let geminiUnavailableSince: string | null = null;
export function setGeminiUnavailableSince(t: string | null) { geminiUnavailableSince = t; }

export let inMemoryToolCallLogs: any[] = [];

export let activeCodePRs: any[] = [
  {
    prId: "PR-2041",
    title: "Optimization: Microsecond order routing batching",
    branch: "feat/order-routing-optimization",
    author: "AI Evolution Engine",
    ciStatus: "PASSED",
    coveragePct: 94.2,
    deployTarget: "CANARY_SHADOW",
    valgrindLeaks: 0,
    astWarnings: 0,
    version: "2.4.0"
  }
];

export let pipelineHistory: any[] = [
  {
    id: "PR-2040",
    title: "Refactor: Safety backstop drawdown calculation",
    branch: "refactor/drawdown-safety",
    author: "Human Admin",
    mergedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    ciStatus: "PASSED",
    deployDurationSec: 12.4,
    version: "2.4.0"
  }
];

