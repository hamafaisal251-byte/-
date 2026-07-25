import React, { useState, useEffect } from 'react';
import { Activity, Zap, ShieldAlert, Gauge, TrendingUp, BarChart2, Layers, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface ExecutionAttributionData {
  timestamp: string;
  overallQualityScore: number;
  latencyBreakdown: {
    networkRttMs: number;
    riskCheckMs: number;
    fixGatewayMs: number;
    totalExecutionLatencyMs: number;
    maxObservedLatencyMs: number;
  };
  slippageAttribution: {
    positiveSlippagePct: number;
    negativeSlippagePct: number;
    avgPositiveSlippagePips: number;
    avgNegativeSlippagePips: number;
    brierScoreContribution: number;
  };
  liquidityVacuum: {
    protectionActive: boolean;
    blockedSpikesCount: number;
    spreadBaselinePips: Record<string, number>;
    lastBlockedSpike: any | null;
  };
  crossAssetCorrelation: {
    pairs: Array<{
      pairA: string;
      pairB: string;
      correlation: number;
      status: string;
    }>;
    contagionRiskLevel: string;
    maxPairCorrelationThreshold: number;
  };
}

export const ExecutionAttributionPanel: React.FC = () => {
  const [data, setData] = useState<ExecutionAttributionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttribution = async () => {
    try {
      const res = await fetch('/api/execution/attribution');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          setData(json);
          setError(null);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch execution attribution:", err);
      setError("کێشە لە وەرگرتنی زانیاری شیکاری ئاراستەکردن.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttribution();
    const timer = setInterval(fetchAttribution, 3000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
        <span className="text-xs font-mono">بارکردنی شیکاری لایڤی ئاراستەکردنی فەرمانەکان...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div id="execution-attribution-panel" className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-5 text-slate-200 select-none">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-3" dir="rtl">
        <div className="flex items-center space-x-2.5 space-x-reverse">
          <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div className="text-right">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">شیکاری ئەدای ئاراستەکردنی فەرمانەکان (Execution Quality & Attribution)</h3>
            <span className="text-[10px] text-slate-500 font-mono block">REAL-TIME LATENCY, SLIPPAGE & LIQUIDITY VACUUM ATTRIBUTION</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <span className="px-2.5 py-1 text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            SCORE: {data.overallQualityScore} / 100
          </span>
          <button 
            onClick={fetchAttribution}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="نوێکردنەوە"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" dir="rtl">
        
        {/* Total Latency */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-medium">
            <span>دواکەوتنی گشتی (Execution RTT)</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            {data.latencyBreakdown.totalExecutionLatencyMs} <span className="text-xs text-slate-500">ms</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Network: {data.latencyBreakdown.networkRttMs}ms | FIX: {data.latencyBreakdown.fixGatewayMs}ms
          </div>
        </div>

        {/* Positive Slippage */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-medium">
            <span>خلیسکانی ئەرێنی (Positive Slippage)</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {data.slippageAttribution.positiveSlippagePct}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Avg Gain: +{data.slippageAttribution.avgPositiveSlippagePips} pips
          </div>
        </div>

        {/* Liquidity Vacuum Spikes Blocked */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-medium">
            <span>تەقینەوەی بێشەپۆلی (Spikes Blocked)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-sky-400">
            {data.liquidityVacuum.blockedSpikesCount} <span className="text-xs text-slate-500">EVENTS</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Vacuum Protection: {data.liquidityVacuum.protectionActive ? "ACTIVE ✓" : "OFF"}
          </div>
        </div>

        {/* Cross-Asset Contagion */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-medium">
            <span>مەترسی هاوبەش (Contagion Risk)</span>
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {data.crossAssetCorrelation.contagionRiskLevel}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Max Threshold: {data.crossAssetCorrelation.maxPairCorrelationThreshold}
          </div>
        </div>

      </div>

      {/* DETAILED ATTRIBUTION & CORRELATION BREAKDOWN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="rtl">
        
        {/* Latency Breakdown Gauge */}
        <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-slate-300">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>دابەشبوونی دواکەوتنی تۆڕ و سیستەم (Microsecond Latency Breakdown)</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>تۆڕی دەرەکی (Network RTT)</span>
                <span>{data.latencyBreakdown.networkRttMs} ms</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(data.latencyBreakdown.networkRttMs / data.latencyBreakdown.totalExecutionLatencyMs) * 100}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>پشکنینی مەترسی ناوەکی (Risk Check)</span>
                <span>{data.latencyBreakdown.riskCheckMs} ms</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(data.latencyBreakdown.riskCheckMs / data.latencyBreakdown.totalExecutionLatencyMs) * 100}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>دەروازەی FIX (FIX Protocol Gateway)</span>
                <span>{data.latencyBreakdown.fixGatewayMs} ms</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(data.latencyBreakdown.fixGatewayMs / data.latencyBreakdown.totalExecutionLatencyMs) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Asset Correlation Matrix */}
        <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-slate-300">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <span>ماتریسی پەیوەندی نێوان دراوەکان (Cross-Asset Pairwise Correlation)</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {data.crossAssetCorrelation.pairs.map((pair, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-slate-950/60 rounded border border-slate-800/60">
                <span className="text-slate-300 font-bold">{pair.pairA} ↔ {pair.pairB}</span>
                <div className="flex items-center space-x-3 space-x-reverse">
                  <span className={`font-mono font-bold ${pair.correlation > 0.7 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {pair.correlation > 0 ? `+${pair.correlation}` : pair.correlation}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${pair.status === 'NOMINAL' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' : 'bg-slate-900 text-slate-400'}`}>
                    {pair.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
