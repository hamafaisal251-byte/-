import React, { useState, useEffect } from "react";
import { 
  Droplets, 
  ShieldAlert, 
  RefreshCw, 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Layers, 
  BarChart3, 
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Cpu
} from "lucide-react";

export interface LiquidityItem {
  id?: number;
  timestamp: string;
  instrument: string;
  compositeScore: number;
  spreadScore: number;
  volumeScore: number;
  slippageScore: number;
  depthScore: number;
  dataSourceType: "FULL_DATA" | "TICK_PROXY_ONLY";
  confidenceLevel: "HIGH" | "LOW_PROXY";
  avgSpreadPips: number;
  volume24hOrTicks: number;
  avgRealizedSlippagePips: number;
  depthUsd: number;
  allocationMultiplier: number;
  allocationStatus: "FULL" | "REDUCED" | "DEPRIORITIZED";
  note: string;
}

export function LiquidityManagerPanel() {
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [latestScores, setLatestScores] = useState<Record<string, LiquidityItem>>({});
  const [history, setHistory] = useState<LiquidityItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "FULL_DATA" | "TICK_PROXY_ONLY">("ALL");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchLiquidityData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/liquidity/summary");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      
      if (data.success) {
        setLatestScores(data.latestBySymbol || {});
        // Standardize keys for history array
        const rawHist = data.recentScoresHistory || [];
        const formattedHist: LiquidityItem[] = rawHist.map((item: any) => ({
          id: item.id,
          timestamp: item.timestamp,
          instrument: item.instrument,
          compositeScore: parseFloat(item.composite_score ?? item.compositeScore ?? 0),
          spreadScore: parseFloat(item.spread_score ?? item.spreadScore ?? 0),
          volumeScore: parseFloat(item.volume_score ?? item.volumeScore ?? 0),
          slippageScore: parseFloat(item.slippage_score ?? item.slippageScore ?? 0),
          depthScore: parseFloat(item.depth_score ?? item.depthScore ?? 0),
          dataSourceType: item.data_source_type || item.dataSourceType || "TICK_PROXY_ONLY",
          confidenceLevel: item.confidence_level || item.confidenceLevel || "LOW_PROXY",
          avgSpreadPips: parseFloat(item.avg_spread_pips ?? item.avgSpreadPips ?? 0),
          volume24hOrTicks: parseFloat(item.volume_24h_or_ticks ?? item.volume24hOrTicks ?? 0),
          avgRealizedSlippagePips: parseFloat(item.avg_realized_slippage_pips ?? item.avgRealizedSlippagePips ?? 0),
          depthUsd: parseFloat(item.depth_usd ?? item.depthUsd ?? 0),
          allocationMultiplier: parseFloat(item.allocation_multiplier ?? item.allocationMultiplier ?? 1.0),
          allocationStatus: item.allocation_status || item.allocationStatus || "FULL",
          note: item.note || ""
        }));
        setHistory(formattedHist);
      }
    } catch (err) {
      console.error("Failed to fetch liquidity summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const res = await fetch("/api/liquidity/recalculate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchLiquidityData();
      }
    } catch (err) {
      console.error("Failed to recalculate liquidity scores:", err);
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    fetchLiquidityData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLiquidityData();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const itemsList = Object.values(latestScores).map((item: any) => ({
    id: item.id,
    timestamp: item.timestamp,
    instrument: item.instrument,
    compositeScore: parseFloat(item.composite_score ?? item.compositeScore ?? 0),
    spreadScore: parseFloat(item.spread_score ?? item.spreadScore ?? 0),
    volumeScore: parseFloat(item.volume_score ?? item.volumeScore ?? 0),
    slippageScore: parseFloat(item.slippage_score ?? item.slippageScore ?? 0),
    depthScore: parseFloat(item.depth_score ?? item.depthScore ?? 0),
    dataSourceType: (item.data_source_type || item.dataSourceType || "TICK_PROXY_ONLY") as "FULL_DATA" | "TICK_PROXY_ONLY",
    confidenceLevel: (item.confidence_level || item.confidenceLevel || "LOW_PROXY") as "HIGH" | "LOW_PROXY",
    avgSpreadPips: parseFloat(item.avg_spread_pips ?? item.avgSpreadPips ?? 0),
    volume24hOrTicks: parseFloat(item.volume_24h_or_ticks ?? item.volume24hOrTicks ?? 0),
    avgRealizedSlippagePips: parseFloat(item.avg_realized_slippage_pips ?? item.avgRealizedSlippagePips ?? 0),
    depthUsd: parseFloat(item.depth_usd ?? item.depthUsd ?? 0),
    allocationMultiplier: parseFloat(item.allocation_multiplier ?? item.allocationMultiplier ?? 1.0),
    allocationStatus: (item.allocation_status || item.allocationStatus || "FULL") as "FULL" | "REDUCED" | "DEPRIORITIZED",
    note: item.note || ""
  }));

  const filteredItems = itemsList.filter((item) => {
    if (filter === "FULL_DATA") return item.dataSourceType === "FULL_DATA";
    if (filter === "TICK_PROXY_ONLY") return item.dataSourceType === "TICK_PROXY_ONLY";
    return true;
  });

  const getScoreBadgeColor = (score: number) => {
    if (score >= 75) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (score >= 50) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "FULL":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> FULL ALLOCATION</span>;
      case "REDUCED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><AlertTriangle className="w-3 h-3" /> REDUCED SIZING</span>;
      case "DEPRIORITIZED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><ShieldAlert className="w-3 h-3" /> DEPRIORITIZED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/80 p-6 rounded-xl border border-slate-800 shadow-xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-1">
            <Droplets className="w-4 h-4" />
            <span>Quantitative Execution Backstop</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Liquidity & Manipulation Resistance Scoring
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Formalized scoring prioritizing deep, high-volume instruments over illiquid or vulnerable pairs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              autoRefresh 
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse text-cyan-400" : ""}`} />
            {autoRefresh ? "Live 15s Polling" : "Polling Paused"}
          </button>

          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Force Recalculate"}
          </button>
        </div>
      </div>

      {/* Transparent Formula & System Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            <span>Composite Scoring Model</span>
          </div>
          <div className="text-xl font-bold text-white">
            0.30<span className="text-slate-400 text-sm font-normal">S</span> + 0.25<span className="text-slate-400 text-sm font-normal">V</span> + 0.25<span className="text-slate-400 text-sm font-normal">Sl</span> + 0.20<span className="text-slate-400 text-sm font-normal">D</span>
          </div>
          <p className="text-xs text-slate-400">
            Weighted combination of Real Spread Tightness (30%), Trading Volume (25%), Past Realized Slippage (25%), and Market Depth (20%).
          </p>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            <span>Demonstrated Edge Integration</span>
          </div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <span>0.40x – 1.00x</span>
            <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Dynamic Scale</span>
          </div>
          <p className="text-xs text-slate-400">
            The Liquidity Score directly scales position allocation multiplier (<code className="text-cyan-300">liquidityMultiplier</code>) in Sniper, Whale, and DRL engines.
          </p>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Data Source Transparency</span>
          </div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <span>L2 Depth vs Tick Proxy</span>
          </div>
          <p className="text-xs text-slate-400">
            Crypto (BTC/ETH) uses connected L2 order book feeds (<span className="text-emerald-400 font-semibold">HIGH Confidence</span>). FX crosses without L2 use tick velocity proxy (<span className="text-amber-400 font-semibold">LOW_PROXY</span>).
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between bg-slate-900/40 p-1.5 rounded-lg border border-slate-800">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "ALL" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Instruments ({itemsList.length})
          </button>
          <button
            onClick={() => setFilter("FULL_DATA")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "FULL_DATA" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Full L2 Data (HIGH Confidence)
          </button>
          <button
            onClick={() => setFilter("TICK_PROXY_ONLY")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "TICK_PROXY_ONLY" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Tick Proxy Only (LOW Confidence)
          </button>
        </div>

        <div className="text-xs text-slate-400 px-3">
          Showing {filteredItems.length} active scored instruments
        </div>
      </div>

      {/* Scored Instruments Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading && itemsList.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 animate-pulse">
            Loading real instrument liquidity metrics...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 bg-slate-900/30 rounded-xl border border-slate-800">
            No instruments match the selected data source filter.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.instrument}
              className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition-all shadow-md relative overflow-hidden group"
            >
              {/* Card Top Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    {item.instrument}
                  </h3>
                  <div className="mt-1">
                    {item.dataSourceType === "FULL_DATA" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                        <Cpu className="w-2.5 h-2.5" /> FULL L2 DATA [HIGH]
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                        <Info className="w-2.5 h-2.5" /> TICK PROXY [LOW_CONFIDENCE]
                      </span>
                    )}
                  </div>
                </div>

                <div className={`text-right px-3 py-1 rounded-lg border font-mono font-bold text-base ${getScoreBadgeColor(item.compositeScore)}`}>
                  {item.compositeScore}
                  <span className="text-[10px] block font-normal opacity-70">/ 100</span>
                </div>
              </div>

              {/* Progress Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Liquidity Score</span>
                  <span className="text-slate-200 font-mono">{item.compositeScore}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      item.compositeScore >= 75 ? "bg-emerald-500" : item.compositeScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, item.compositeScore))}%` }}
                  />
                </div>
              </div>

              {/* Key Operational Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                  <span className="text-slate-400 block text-[10px] uppercase">Avg Spread</span>
                  <span className="font-mono font-semibold text-slate-200">{item.avgSpreadPips} pips</span>
                </div>

                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                  <span className="text-slate-400 block text-[10px] uppercase">Realized Slippage</span>
                  <span className={`font-mono font-semibold ${item.avgRealizedSlippagePips > 1.2 ? "text-rose-400" : "text-emerald-400"}`}>
                    {item.avgRealizedSlippagePips} pips
                  </span>
                </div>

                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                  <span className="text-slate-400 block text-[10px] uppercase">24h Vol / Ticks</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {item.volume24hOrTicks >= 1000000 
                      ? `$${(item.volume24hOrTicks / 1000000).toFixed(1)}M` 
                      : `${item.volume24hOrTicks.toLocaleString()} ticks`}
                  </span>
                </div>

                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                  <span className="text-slate-400 block text-[10px] uppercase">Position Sizing</span>
                  <span className="font-mono font-bold text-cyan-400">{item.allocationMultiplier}x</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>{getStatusBadge(item.allocationStatus)}</div>
              </div>

              <p className="text-[11px] text-slate-400 leading-tight italic bg-slate-950/30 p-2 rounded border border-slate-800/40">
                "{item.note}"
              </p>
            </div>
          ))
        )}
      </div>

      {/* Recalculation History Table */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Audit History & Score Evolution
          </h3>
          <span className="text-xs text-slate-400">
            Last {history.length} evaluation cycles
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-4 text-center">Data Source</th>
                <th className="py-3 px-4 text-center">Composite Score</th>
                <th className="py-3 px-4 text-center">Spread (Pips)</th>
                <th className="py-3 px-4 text-center">Slippage (Pips)</th>
                <th className="py-3 px-4 text-center">Multiplier</th>
                <th className="py-3 px-4 text-center">Allocation Status</th>
                <th className="py-3 px-4">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                    No historical liquidity logs recorded yet.
                  </td>
                </tr>
              ) : (
                history.slice(0, 15).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 font-sans text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white font-sans">{log.instrument}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${log.dataSourceType === "FULL_DATA" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {log.dataSourceType === "FULL_DATA" ? "HIGH (L2)" : "LOW (PROXY)"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold text-cyan-300">
                      {log.compositeScore} / 100
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-300">{log.avgSpreadPips}</td>
                    <td className="py-2.5 px-4 text-center text-slate-300">{log.avgRealizedSlippagePips}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-cyan-400">{log.allocationMultiplier}x</td>
                    <td className="py-2.5 px-4 text-center font-sans">{getStatusBadge(log.allocationStatus)}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-400 text-[11px] truncate max-w-xs">{log.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
