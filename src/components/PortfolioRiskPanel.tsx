import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Sliders, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Percent, 
  Save, 
  BarChart3, 
  Grid, 
  Info, 
  AlertTriangle,
  Play,
  FileText,
  Download,
  Flame,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";

interface StressResult {
  scenarioId: string;
  scenarioName: string;
  simulationsCount: number;
  normalVar99: number;
  evtVar999: number;
  expectedShortfall999: number;
  maxSimulatedDrawdown: number;
  survivalProbability: number;
  liquidityBufferPass: boolean;
  quantiles: Record<string, number>;
  timestamp: string;
}

interface RiskLimits {
  maxTotalNotionalExposure: number;
  maxSingleInstrumentExposure: number;
  maxCorrelatedGroupExposure: number;
  drawdownThresholdPct: number;
}

interface RiskMetrics {
  totalExposure: number;
  var95Hist: number;
  var99Hist: number;
  var95Param: number;
  var99Param: number;
  volatilities: Record<string, number>;
  correlationMatrix: Record<string, number>;
  singleExposures: Record<string, number>;
  correlatedGroupExposure: number;
  usdShortExposure: number;
  usdLongExposure: number;
  currentDrawdownPct: number;
  peakEquity: number;
  currentEquity: number;
  limits: RiskLimits;
  dataQuality?: Record<string, {
    dataPoints: number;
    timeSpanMinutes: number;
    isRobust: boolean;
    statusText: string;
  }>;
  insufficientHistory?: boolean;
  historyMessage?: string;
}

interface HistoryItem {
  id: number;
  timestamp: string;
  var_95_hist: number;
  var_99_hist: number;
  var_95_param: number;
  var_99_param: number;
  total_exposure: number;
  portfolio_drawdown: number;
}

export default function PortfolioRiskPanel() {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local edit states for limits
  const [maxTotal, setMaxTotal] = useState<number>(500000);
  const [maxSingle, setMaxSingle] = useState<number>(300000);
  const [maxCorrelated, setMaxCorrelated] = useState<number>(400000);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(5.0);

  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Phase 3 States
  const [stressScenario, setStressScenario] = useState<string>("BLACK_MONDAY_1987");
  const [stressResult, setStressResult] = useState<StressResult | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [auditReport, setAuditReport] = useState<any | null>(null);
  const [exportingAudit, setExportingAudit] = useState<boolean>(false);

  const handleRunStressTest = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/risk/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: stressScenario, simulations: 10000 })
      });
      const data = await res.json();
      if (data.success) {
        setStressResult(data.result);
      }
    } catch (err: any) {
      alert(`Stress test failed: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleExportAuditReport = async () => {
    setExportingAudit(true);
    try {
      const res = await fetch("/api/compliance/regulatory-export");
      const data = await res.json();
      if (data.success) {
        setAuditReport(data.report);
        // Download as JSON file
        const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `MIFID_II_CFTC_AUDIT_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingAudit(false);
    }
  };

  const fetchRiskData = async () => {
    try {
      const res = await fetch("/api/risk/portfolio");
      if (!res.ok) throw new Error("Failed to fetch real-time portfolio risk metrics");
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
        setError(null);
        // Sync local states if not currently editing/saving
        if (!saving) {
          setMaxTotal(data.metrics.limits.maxTotalNotionalExposure);
          setMaxSingle(data.metrics.limits.maxSingleInstrumentExposure);
          setMaxCorrelated(data.metrics.limits.maxCorrelatedGroupExposure);
          setMaxDrawdown(data.metrics.limits.drawdownThresholdPct);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Risk Engine communication failure");
    }
  };

  const fetchHistoryData = async () => {
    try {
      const res = await fetch("/api/risk/history");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          // Sort ascending for Recharts plotting
          const sorted = [...data.history].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setHistory(sorted);
        }
      }
    } catch (err) {
      console.error("Error loading risk history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
    fetchHistoryData();

    const interval = setInterval(() => {
      fetchRiskData();
    }, 5000); // 5-second polling for real-time responsiveness

    return () => clearInterval(interval);
  }, []);

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/risk/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxTotalNotionalExposure: maxTotal,
          maxSingleInstrumentExposure: maxSingle,
          maxCorrelatedGroupExposure: maxCorrelated,
          drawdownThresholdPct: maxDrawdown
        })
      });

      if (!res.ok) throw new Error("Server rejected risk limit update");
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await fetchRiskData();
        await fetchHistoryData();
      }
    } catch (err: any) {
      alert(`Rejection: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

  const chartData = history.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    "VaR 95% (Hist)": item.var_95_hist,
    "VaR 99% (Hist)": item.var_99_hist,
    "VaR 95% (Param)": item.var_95_param,
    "VaR 99% (Param)": item.var_99_param,
    "Drawdown %": item.portfolio_drawdown
  }));

  // Correlation matrix formatted beautifully
  const pairs = [
    { label: "EUR/USD ↔ GBP/USD", val: metrics?.correlationMatrix["EUR/USD-GBP/USD"] ?? 0 },
    { label: "EUR/USD ↔ BTC/USD", val: metrics?.correlationMatrix["EUR/USD-BTC/USD"] ?? 0 },
    { label: "GBP/USD ↔ BTC/USD", val: metrics?.correlationMatrix["GBP/USD-BTC/USD"] ?? 0 },
  ];

  return (
    <div id="portfolio-risk-workspace" className="space-y-6">
      
      {/* Title Header with Kurdish and English */}
      <div id="risk-header" className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right" dir="rtl">
        <div>
          <div className="flex items-center gap-2 justify-end">
            <h2 className="text-lg font-black text-slate-100">ئۆپتیمایزەر و ئەندازیاری مەترسی پۆرتفۆلیۆ</h2>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-xs text-slate-400 font-sans mt-1">
            مۆدێلی مەترسی پۆرتفۆلیۆ لەسەر بنەمای زانیارییە لایڤەکانی بازار و داتاکانی ڕابردوو (Value-at-Risk Engine)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportAuditReport}
            disabled={exportingAudit}
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            dir="ltr"
          >
            <Download className={`w-4 h-4 text-sky-400 ${exportingAudit ? 'animate-bounce' : ''}`} />
            <span>MiFID II / CFTC Audit Export</span>
          </button>
          <div className="p-2 px-3 bg-slate-950 border border-slate-800 rounded-lg text-center font-mono">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">STATE REFRESH</span>
            <span className="text-emerald-400 text-xs font-black animate-pulse">● ACTIVE POLLING</span>
          </div>
        </div>
      </div>

      {/* PHASE 3: MONTE CARLO EVT STRESS TESTING PANEL */}
      <div id="evt-stress-test-panel" className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-950/60 border border-rose-500/40 rounded text-rose-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>MONTE CARLO 10,000-PATH EVT STRESS TEST</span>
                <span className="px-2 py-0.5 text-[10px] bg-rose-950 text-rose-400 border border-rose-500/40 rounded font-bold">
                  PHASE 3 HEAVY-TAIL TAIL VaR 99.9%
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">Extreme Value Theory (Generalized Pareto Distribution) Tail Risk Analysis under Crisis Market Conditions</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={stressScenario}
              onChange={(e) => setStressScenario(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="BLACK_MONDAY_1987">1987 Black Monday (-22.6% Crash)</option>
              <option value="CHF_UNPEG_2015">2015 Swiss Franc Unpeg (-30% Gap)</option>
              <option value="COVID_CRUNCH_2020">2020 COVID Liquidity Squeeze</option>
              <option value="FLASH_CRASH_2010">2010 Flash Crash Algo Loop</option>
            </select>

            <button
              onClick={handleRunStressTest}
              disabled={isTesting}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? "Running 10k Paths..." : "Simulate Stress Test"}</span>
            </button>
          </div>
        </div>

        {/* Stress Test Results View */}
        {stressResult && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Scenario</span>
                <span className="font-bold text-slate-200 text-xs block my-0.5">{stressResult.scenarioName}</span>
                <span className="text-[9px] text-slate-400">{stressResult.simulationsCount.toLocaleString()} Monte Carlo Paths</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Normal VaR 99.0%</span>
                <span className="font-bold text-amber-400 text-sm block my-0.5">{stressResult.normalVar99}%</span>
                <span className="text-[9px] text-slate-400">Standard Gaussian model</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">EVT Tail VaR 99.9%</span>
                <span className="font-bold text-rose-400 text-sm block my-0.5">{stressResult.evtVar999}%</span>
                <span className="text-[9px] text-rose-400/80">Extreme Value Pareto Tail</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Expected Shortfall (CVaR)</span>
                <span className="font-bold text-purple-400 text-sm block my-0.5">{stressResult.expectedShortfall999}%</span>
                <span className="text-[9px] text-slate-400">Mean Tail Loss Beyond 99.9%</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Survival Rate</span>
                <span className={`font-bold text-sm block my-0.5 ${stressResult.survivalProbability >= 99.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stressResult.survivalProbability}%
                </span>
                <span className="text-[9px] text-slate-400">
                  Liquidity Buffer: <strong className={stressResult.liquidityBufferPass ? "text-emerald-400" : "text-rose-400"}>{stressResult.liquidityBufferPass ? "ADEQUATE" : "DEFICIT"}</strong>
                </span>
              </div>
            </div>

            {/* Quantiles Bar */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 flex flex-wrap justify-between items-center text-[11px] gap-2">
              <span className="text-slate-400 font-bold uppercase">Quantile Tail Distribution:</span>
              <div className="flex gap-4">
                <span className="text-slate-300">P50: <strong className="text-slate-100">{stressResult.quantiles.p50}%</strong></span>
                <span className="text-slate-300">P90: <strong className="text-amber-300">{stressResult.quantiles.p90}%</strong></span>
                <span className="text-slate-300">P95: <strong className="text-amber-400">{stressResult.quantiles.p95}%</strong></span>
                <span className="text-slate-300">P99: <strong className="text-rose-400">{stressResult.quantiles.p99}%</strong></span>
                <span className="text-rose-400 font-bold">P99.9 (EVT): {stressResult.quantiles["p99.9"]}%</span>
              </div>
            </div>
          </div>
        )}

        {auditReport && (
          <div className="p-3 bg-sky-950/30 border border-sky-500/30 rounded text-xs text-sky-300 flex justify-between items-center">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <span>MiFID II & Dodd-Frank Audit Report exported successfully. PTP Clock Sync: <strong>{auditReport.clockSyncPTPUs * 1000} ns</strong> (Pass: {auditReport.clockSyncPass ? "Yes" : "No"}). Best Execution Score: <strong>{auditReport.bestExecutionScore}%</strong></span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">HASH: {auditReport.auditHash}</span>
          </div>
        )}
      </div>

      {/* Data Quality & Correlation Stability Status */}
      {metrics && (
        <div id="data-quality-banner" className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
          metrics.insufficientHistory 
            ? "bg-amber-950/20 border-amber-500/30 text-amber-300" 
            : "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
        }`} dir="rtl">
          <div className="flex items-start gap-2">
            <Info className={`w-5 h-5 shrink-0 mt-0.5 ${metrics.insufficientHistory ? "text-amber-400" : "text-emerald-400"}`} />
            <div className="text-right">
              <span className="text-xs font-black block">دۆخی سەقامگیری و دروستی داتای پۆرتفۆلیۆ (Data Quality & Correlation Stability)</span>
              <span className="text-[11px] text-slate-300 block font-sans mt-0.5">
                {metrics.historyMessage || "داتای لایڤی سەربەخۆ بە شێوەیەکی ڕاستەوخۆ دەخوێنرێتەوە بۆ چاودێریکردنی مەترسی"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[10px]" dir="ltr">
            {metrics.dataQuality && Object.entries(metrics.dataQuality).map(([inst, q]: any) => (
              <div key={inst} className={`p-1.5 px-2.5 rounded border ${
                q.isRobust 
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" 
                  : "bg-amber-950/40 border-amber-500/20 text-amber-400"
              }`}>
                <span className="font-bold mr-1.5">{inst} :</span>
                <span>{q.statusText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs rounded-xl flex items-center gap-2 justify-end" dir="rtl">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>هەڵە لە سیستەمی کۆنتڕۆڵی مەترسی: {error}</span>
        </div>
      )}

      {/* Real-time VaR & Metrics Cards */}
      <div id="realtime-metrics-grid" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Total Exposure */}
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2 relative overflow-hidden group hover:border-slate-750 transition-all">
          <div className="flex justify-between items-center">
            <span className="p-1.5 bg-sky-950/40 border border-sky-500/30 rounded text-sky-400">
              <DollarSign className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-500 font-mono">ACTIVE EXPOSURE</span>
          </div>
          <div className="pt-2">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {metrics ? formatCurrency(metrics.totalExposure) : "$0.00"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 flex justify-between">
            <span>Limit: {metrics ? formatCurrency(metrics.limits.maxTotalNotionalExposure) : "$0.00"}</span>
            <span className="text-slate-500 font-bold font-mono">TOTAL NOTIONAL</span>
          </div>
        </div>

        {/* 1-Day 95% Historical VaR */}
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2 relative overflow-hidden group hover:border-slate-750 transition-all">
          <div className="flex justify-between items-center">
            <span className="p-1.5 bg-amber-950/40 border border-amber-500/30 rounded text-amber-400">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-500 font-mono">VaR 95% (HISTORICAL)</span>
          </div>
          <div className="pt-2">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {metrics ? formatCurrency(metrics.var95Hist) : "$0.00"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 flex justify-between">
            <span>Parametric: {metrics ? formatCurrency(metrics.var95Param) : "$0.00"}</span>
            <span className="text-amber-500/80 font-bold font-mono">95% CONFIDENCE</span>
          </div>
        </div>

        {/* 1-Day 99% Historical VaR */}
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2 relative overflow-hidden group hover:border-slate-750 transition-all">
          <div className="flex justify-between items-center">
            <span className="p-1.5 bg-rose-950/40 border border-rose-500/30 rounded text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-500 font-mono">VaR 99% (HISTORICAL)</span>
          </div>
          <div className="pt-2">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {metrics ? formatCurrency(metrics.var99Hist) : "$0.00"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 flex justify-between">
            <span>Parametric: {metrics ? formatCurrency(metrics.var99Param) : "$0.00"}</span>
            <span className="text-rose-500/80 font-bold font-mono">99% CONFIDENCE</span>
          </div>
        </div>

        {/* Portfolio Drawdown */}
        <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2 relative overflow-hidden group hover:border-slate-750 transition-all">
          <div className="flex justify-between items-center">
            <span className="p-1.5 bg-purple-950/40 border border-purple-500/30 rounded text-purple-400">
              <TrendingDown className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-500 font-mono">PORTFOLIO DRAWDOWN</span>
          </div>
          <div className="pt-2">
            <span className="text-2xl font-black text-purple-400 font-mono">
              {metrics ? `${metrics.currentDrawdownPct.toFixed(2)}%` : "0.00%"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 flex justify-between">
            <span>Limit Threshold: {metrics ? `${metrics.limits.drawdownThresholdPct.toFixed(1)}%` : "0.0%"}</span>
            <span className="text-purple-500 font-bold font-mono">FROM PEAK EQUITY</span>
          </div>
        </div>

      </div>

      {/* Main Dashboard Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Interactive Exposure Limits Form & Correlation Matrices */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Exposure Limits Configuration Panel */}
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2 justify-end pb-3 border-b border-slate-900" dir="rtl">
              <h3 className="text-sm font-bold text-slate-200">کۆنتڕۆڵکردنی سنوورەکانی مەترسی</h3>
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>

            <form onSubmit={handleSaveLimits} className="space-y-4" dir="rtl">
              
              {/* Max Total Notional */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">بڕی گشتی هێزی لایڤ (USD Notional)</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatCurrency(maxTotal)}</span>
                </div>
                <input 
                  type="range" 
                  min="50000" 
                  max="2000000" 
                  step="25000"
                  value={maxTotal} 
                  onChange={(e) => setMaxTotal(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Max Single Instrument */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">یەک سەرچاوەی دیاریکراو (Single Instrument)</span>
                  <span className="text-amber-400 font-mono font-bold">{formatCurrency(maxSingle)}</span>
                </div>
                <input 
                  type="range" 
                  min="25000" 
                  max="1000000" 
                  step="10000"
                  value={maxSingle} 
                  onChange={(e) => setMaxSingle(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Max Correlated Group Exposure */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">مەترسی گروپە هاوپەیوەندەکان (Correlated EUR/GBP)</span>
                  <span className="text-rose-400 font-mono font-bold">{formatCurrency(maxCorrelated)}</span>
                </div>
                <input 
                  type="range" 
                  min="50000" 
                  max="1200000" 
                  step="25000"
                  value={maxCorrelated} 
                  onChange={(e) => setMaxCorrelated(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* Max Drawdown Limit */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">لادانی گشتی زیان (Silent Lock Drawdown Limit)</span>
                  <span className="text-purple-400 font-mono font-bold">{maxDrawdown.toFixed(1)}%</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="20.0" 
                  step="0.5"
                  value={maxDrawdown} 
                  onChange={(e) => setMaxDrawdown(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full mt-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-emerald-500/30 text-xs font-bold text-slate-200 hover:text-emerald-400 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>{saving ? "پاشەکەوت دەکرێت..." : "سەپاندنی سنوورەکانی کۆنترۆڵ (Apply Limits)"}</span>
              </button>

              {saveSuccess && (
                <div className="text-[11px] text-center text-emerald-400 font-bold bg-emerald-950/30 p-2 rounded-lg border border-emerald-500/20">
                  ✓ نوێکردنەوەی سنوورەکانی مەترسی بە تەواوی لە کەرنەڵی سیستەمدا جێگیر کرا!
                </div>
              )}
            </form>
          </div>

          {/* Correlation Matrix & Volatilities */}
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2 justify-end pb-3 border-b border-slate-900" dir="rtl">
              <h3 className="text-sm font-bold text-slate-200">هاوپەیوەندی لایڤی بازاڕەکان (Correlation Matrix)</h3>
              <Grid className="w-4 h-4 text-sky-400" />
            </div>

            <div className="space-y-3 font-mono text-xs">
              {pairs.map((p, i) => {
                const isStrong = Math.abs(p.val) > 0.7;
                return (
                  <div key={i} className="p-2.5 bg-slate-950 border border-slate-900 rounded-lg flex justify-between items-center">
                    <span className={`text-[11px] font-black ${isStrong ? 'text-amber-400' : 'text-sky-400'}`}>
                      {p.val >= 0 ? "+" : ""}{p.val.toFixed(4)}
                    </span>
                    <span className="text-slate-400 font-sans">{p.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 bg-sky-950/10 border border-sky-900/40 rounded-xl text-[10px] text-slate-400 leading-relaxed font-sans flex items-start gap-2 text-right" dir="rtl">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 ml-2" />
              <p>
                ئەم ڕێژانە بە شێوەیەکی دینامیکی ڕاستەوخۆ لە داتاکانی ڕابردوو کێشراونەتەوە. هاوپەیوەندی بەهێز (زیاتر لە ٠.٧ یان کەمتر لە -٠.٧) مەترسی هاوبەش دروست دەکات، هەربۆیە گەیتی سنووردارکردن لەسەر کۆی بەرکەوتە کار دەکات.
              </p>
            </div>
          </div>

        </div>

        {/* Right Side: Charts & Exposure Distributions */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Main Risk History Trend Charts */}
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-900" dir="rtl">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-200">ڕەوتی نەخشەی Value-at-Risk و زیانەکان</h3>
                <BarChart3 className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono">1-DAY VAR HISTORIC TIMELINE</span>
            </div>

            <div className="h-[280px] w-full font-mono text-xs">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-500 font-sans">
                  باردەکرێت...
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 font-sans">
                  داتا بەردەست نییە بۆ ڕەوتەکە. تەنها چالاکییە نوێکان پاشەکەوت دەکرێن.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                    <XAxis dataKey="time" stroke="#475569" />
                    <YAxis stroke="#475569" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="VaR 95% (Hist)" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="VaR 99% (Hist)" stroke="#f87171" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="VaR 95% (Param)" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="VaR 99% (Param)" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Instrument Exposure Distributions & Current Volatilities */}
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2 justify-end pb-3 border-b border-slate-900" dir="rtl">
              <h3 className="text-sm font-bold text-slate-200">بەرکەوتەی تاکەکەسی هەر دراوێک و ڕێژەیVolatility لایڤ</h3>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" dir="rtl">
              {["EUR/USD", "GBP/USD", "BTC/USD"].map((inst, idx) => {
                const exposure = metrics?.singleExposures[inst] ?? 0;
                const vol = metrics?.volatilities[inst] ?? 0;
                const maxInstLimit = metrics?.limits.maxSingleInstrumentExposure ?? 300000;
                const percentage = Math.min(100, (exposure / maxInstLimit) * 100);

                return (
                  <div key={idx} className="p-4 bg-slate-950 border border-slate-900 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-100">{inst}</span>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                        Vol: {(vol * 100).toFixed(4)}%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-500">EXPOSURE</span>
                        <span className="text-slate-300 font-bold">{formatCurrency(exposure)}</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>Limit: {formatCurrency(maxInstLimit)}</span>
                        <span>{percentage.toFixed(1)}% utilized</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
