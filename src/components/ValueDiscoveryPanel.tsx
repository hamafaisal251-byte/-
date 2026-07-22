import React from "react";
import { 
  Search, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  RefreshCw, 
  FileText, 
  Lock, 
  Unlock,
  Check
} from "lucide-react";

interface Hypothesis {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  proposed_signal: string;
  author: string;
  status: "PENDING" | "FAILED" | "PASSED_RAW" | "PASSED_FDR" | "PROMOTED";
  regime: string;
  p_value: number | null;
  fdr_adjusted_p: number | null;
  effect_size: number | null;
  metrics: any;
}

interface ValueDiscoveryPanelProps {
  summary: {
    success: boolean;
    stats: {
      totalHypotheses: number;
      totalTested: number;
      passedRawCount: number;
      passedFdrCount: number;
      promotedCount: number;
      hitRate: number;
      fdrThreshold: number;
    };
    hypotheses: Hypothesis[];
  } | null;
  loading: boolean;
  generating: boolean;
  testing: boolean;
  promotingId: string | null;
  onGenerate: () => Promise<void>;
  onTest: () => Promise<void>;
  onPromote: (id: string) => Promise<void>;
  error: string | null;
  filter: string;
  setFilter: (f: string) => void;
  search: string;
  setSearch: (s: string) => void;
}

export const ValueDiscoveryPanel: React.FC<ValueDiscoveryPanelProps> = ({
  summary,
  loading,
  generating,
  testing,
  promotingId,
  onGenerate,
  onTest,
  onPromote,
  error,
  filter,
  setFilter,
  search,
  setSearch
}) => {
  const stats = summary?.stats || {
    totalHypotheses: 0,
    totalTested: 0,
    passedRawCount: 0,
    passedFdrCount: 0,
    promotedCount: 0,
    hitRate: 0,
    fdrThreshold: 0.05
  };

  const hypotheses = Array.isArray(summary?.hypotheses) ? summary.hypotheses : [];

  // Filter & Search
  const filteredHypotheses = hypotheses.filter(h => {
    // Status Filter
    if (filter !== "ALL") {
      if (filter === "PENDING" && h.status !== "PENDING") return false;
      if (filter === "FAILED" && h.status !== "FAILED") return false;
      if (filter === "PASSED_RAW" && h.status !== "PASSED_RAW") return false;
      if (filter === "PASSED_FDR" && h.status !== "PASSED_FDR") return false;
      if (filter === "PROMOTED" && h.status !== "PROMOTED") return false;
    }
    
    // Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const titleMatch = h.title?.toLowerCase().includes(q);
      const descMatch = h.description?.toLowerCase().includes(q);
      const signalMatch = h.proposed_signal?.toLowerCase().includes(q);
      const regimeMatch = h.regime?.toLowerCase().includes(q);
      const authorMatch = h.author?.toLowerCase().includes(q);
      return titleMatch || descMatch || signalMatch || regimeMatch || authorMatch;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Kurdish Title & Subtitle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="text-right w-full md:w-auto">
          <h2 className="text-lg font-black text-slate-100 flex items-center justify-end gap-2">
            <span className="bg-rose-950 text-rose-400 border border-rose-900 px-2.5 py-0.5 rounded text-xs font-mono font-black">STRICT STATISTICAL CONTROL</span>
            مەکینەی دۆزینەوەی بەها و تاقیکردنەوەی گریمانەکان
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            توێژینەوەی سیستەماتیک لەسەر ئاماژە و مۆدێلە نوێیەکانی بازاڕ بە کۆنترۆڵکردنی توندی ڕێژەی دۆزینەوەی هەڵە (FDR) لە ڕێگەی Benjamini-Hochberg.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/60 p-4 rounded-xl flex items-start gap-3 text-rose-400 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-right w-full">
            <strong className="block font-black mb-1">ئاگاداری / promotion error:</strong>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Metrics Row / Funnel Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">تەواوی گریمانەکان (Hypotheses)</span>
          <div className="text-3xl font-black text-slate-100 my-2 font-mono">{stats.totalHypotheses}</div>
          <span className="text-[9px] text-slate-400">سەرجەم بیرۆکە تۆمارکراوەکان</span>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">تاقیکراوەتەوە (Tested)</span>
          <div className="text-3xl font-black text-amber-500 my-2 font-mono">{stats.totalTested}</div>
          <span className="text-[9px] text-slate-400">لە ڕێگەی Walk-Forward</span>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">مانەوەی سەرەتایی (Passed Raw)</span>
          <div className="text-3xl font-black text-purple-400 my-2 font-mono">{stats.passedRawCount}</div>
          <span className="text-[9px] text-slate-400">مانادار بەبێ FDR (p &lt; 0.05)</span>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">مانەوەی توند (Surviving FDR)</span>
          <div className="text-3xl font-black text-emerald-400 my-2 font-mono">{stats.passedFdrCount}</div>
          <span className="text-[9px] text-emerald-500/80 font-bold">survived correction (q &lt; 0.05)</span>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">ڕێژەی سەرکەوتن (Hit Rate)</span>
          <div className="text-3xl font-black text-sky-400 my-2 font-mono">{stats.hitRate}%</div>
          <span className="text-[9px] text-slate-400">نسبەتی گریمانە ڕاستەقینەکان</span>
        </div>
      </div>

      {/* Visual Discovery Funnel */}
      <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono text-right">میکانیزمی پاڵاوتنی زانستی (Scientific Discovery Funnel)</h3>
        
        <div className="relative pt-4 pb-2">
          {/* Funnel Steps visual layout */}
          <div className="grid grid-cols-4 gap-2 text-center font-mono text-[10px]">
            <div className="space-y-2">
              <div className="h-4 bg-slate-800 rounded flex items-center justify-center text-slate-300 font-bold">
                100% (All Ideas)
              </div>
              <span className="text-slate-400">1. گریمانەی نوێ</span>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-purple-950 text-purple-300 border border-purple-900 rounded flex items-center justify-center font-bold">
                {stats.totalTested > 0 ? Math.round((stats.passedRawCount / stats.totalTested) * 100) : 0}% Raw Pass
              </div>
              <span className="text-purple-400">2. بەهای تاقیکردنەوە</span>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-emerald-950 text-emerald-300 border border-emerald-900 rounded flex items-center justify-center font-bold">
                {stats.totalTested > 0 ? Math.round((stats.passedFdrCount / stats.totalTested) * 100) : 0}% FDR Pass
              </div>
              <span className="text-emerald-400">3. پاڵاوتنی توند</span>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-sky-950 text-sky-300 border border-sky-900 rounded flex items-center justify-center font-bold">
                {stats.totalTested > 0 ? Math.round((stats.promotedCount / stats.totalTested) * 100) : 0}% Promoted
              </div>
              <span className="text-sky-400">4. جێگیرکردن لە مۆدێل</span>
            </div>
          </div>

          {/* Graphical bar progress representing the shrinking funnel */}
          <div className="mt-4 h-2 bg-slate-950 rounded-full overflow-hidden flex">
            <div className="h-full bg-slate-700" style={{ width: "30%" }} />
            <div className="h-full bg-purple-500" style={{ width: `${Math.max(5, stats.totalTested > 0 ? (stats.passedRawCount / stats.totalTested) * 30 : 0)}%` }} />
            <div className="h-full bg-emerald-500" style={{ width: `${Math.max(5, stats.totalTested > 0 ? (stats.passedFdrCount / stats.totalTested) * 30 : 0)}%` }} />
            <div className="h-full bg-sky-500" style={{ width: `${Math.max(5, stats.totalTested > 0 ? (stats.promotedCount / stats.totalTested) * 10 : 0)}%` }} />
          </div>
        </div>

        <div className="text-[10px] text-slate-500 text-right leading-relaxed">
          * تێبینی: تاقیکردنەوەی زۆری گریمانەکان دەبێتە هۆی بەرزبوونەوەی شانسی دەرچوونی ئاماژە بێ کەڵکەکان بە شێوەیەکی ڕێکەوتی (Data Snooping). بۆیە بەکارهێنانی <strong>Benjamini-Hochberg FDR</strong> ڕاستکردنەوە دەکات بۆ ئەوەی دڵنیابین ئەو ئاماژانەی بەرەو Sandbox دەڕۆن خاوەن بەهایەکی زانستی ڕاستەقینەن بە کەمترین هەڵەی جۆری یەکەم (Type I Error).
        </div>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Generate Button */}
        <button
          onClick={onGenerate}
          disabled={generating || loading}
          className={`py-3.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
            generating
              ? "bg-slate-800 border-slate-750 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white border-rose-500 shadow-md shadow-rose-950/40"
          }`}
        >
          <Sparkles className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
          <span>
            {generating 
              ? "بریکاری دۆزینەوە خەریکی گەڕان و لێکۆڵینەوەیە..." 
              : "پێشنیارکردنی گریمانەی نوێ لە ڕێگەی بریکارەوە (Generate Signal Hypotheses)"}
          </span>
        </button>

        {/* Test Button */}
        <button
          onClick={onTest}
          disabled={testing || loading}
          className={`py-3.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
            testing
              ? "bg-slate-800 border-slate-750 text-slate-400 cursor-not-allowed"
              : "bg-slate-900 hover:bg-slate-850 text-amber-400 border-amber-500/30 hover:border-amber-500/60 shadow-md"
          }`}
        >
          <Play className={`w-4 h-4 text-amber-400 ${testing ? "animate-spin" : ""}`} />
          <span>
            {testing 
              ? "خەریکی ئەنجامدانی Walk-Forward و بەراوردکاری FDR..." 
              : "تاقیکردنەوەی دەستبەجێی گشت گریمانە هەڵپەسێردراوەکان (Run Rigorous Tests)"}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="گەڕان لە گریمانەکان..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-3 pr-9 text-xs text-slate-200 text-right focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-1.5 justify-end w-full md:w-auto" dir="rtl">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                filter === "ALL"
                  ? "bg-rose-950 text-rose-400 border border-rose-900"
                  : "bg-slate-950 text-slate-400 border border-transparent hover:bg-slate-900"
              }`}
            >
              گشتی ({hypotheses.length})
            </button>
            <button
              onClick={() => setFilter("PENDING")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                filter === "PENDING"
                  ? "bg-amber-950/80 text-amber-400 border border-amber-900/60"
                  : "bg-slate-950 text-slate-400 border border-transparent hover:bg-slate-900"
              }`}
            >
              ھەڵپەسێردراو ({hypotheses.filter(h => h.status === "PENDING").length})
            </button>
            <button
              onClick={() => setFilter("PASSED_FDR")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                filter === "PASSED_FDR"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-900/60"
                  : "bg-slate-950 text-slate-400 border border-transparent hover:bg-slate-900"
              }`}
            >
              سەرکەوتووی FDR ({hypotheses.filter(h => h.status === "PASSED_FDR").length})
            </button>
            <button
              onClick={() => setFilter("PROMOTED")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                filter === "PROMOTED"
                  ? "bg-sky-950/80 text-sky-400 border border-sky-900/60"
                  : "bg-slate-950 text-slate-400 border border-transparent hover:bg-slate-900"
              }`}
            >
              جێگیرکراو ({hypotheses.filter(h => h.status === "PROMOTED").length})
            </button>
            <button
              onClick={() => setFilter("FAILED")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                filter === "FAILED"
                  ? "bg-rose-950/80 text-rose-400 border border-rose-900/60"
                  : "bg-slate-950 text-slate-400 border border-transparent hover:bg-slate-900"
              }`}
            >
              شکستخواردوو ({hypotheses.filter(h => h.status === "FAILED").length})
            </button>
          </div>

        </div>
      </div>

      {/* Hypothesis Journal Grid */}
      {loading ? (
        <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-xs text-slate-400">خەریکی گواستنەوەی زانیارییەکانی دەفتەری گریمانەکان...</span>
        </div>
      ) : filteredHypotheses.length === 0 ? (
        <div className="bg-slate-950 border border-slate-850 rounded-xl p-12 text-center text-slate-500 italic text-xs">
          هیچ گریمانەیەک نەدۆزرایەوە کە لەگەڵ پاڵاوتنەکە یەکبگرێتەوە.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHypotheses.map((h) => {
            const hasPassedFdr = h.status === "PASSED_FDR" || h.status === "PROMOTED";
            const isPending = h.status === "PENDING";
            const isFailed = h.status === "FAILED";
            const isPromoted = h.status === "PROMOTED";
            const isPassedRawOnly = h.status === "PASSED_RAW";

            return (
              <div 
                key={h.id} 
                className={`bg-slate-900 border rounded-xl p-5 transition-all flex flex-col justify-between gap-4 ${
                  isPromoted 
                    ? "border-sky-500/30 hover:border-sky-500/50 bg-gradient-to-b from-slate-900 to-sky-950/10" 
                    : hasPassedFdr 
                    ? "border-emerald-500/30 hover:border-emerald-500/50 bg-gradient-to-b from-slate-900 to-emerald-950/10" 
                    : isFailed 
                    ? "border-rose-950 hover:border-rose-900/40 opacity-75"
                    : isPassedRawOnly
                    ? "border-purple-500/20 hover:border-purple-500/40 bg-gradient-to-b from-slate-900 to-purple-950/10"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2 border-b border-slate-850 pb-3">
                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {isPending && (
                      <span className="bg-amber-950/80 text-amber-400 border border-amber-900/60 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono">
                        PENDING (PRE-SIMULATION LOGGED)
                      </span>
                    )}
                    {isFailed && (
                      <span className="bg-rose-950/80 text-rose-400 border border-rose-900/60 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono">
                        REJECTED: RAW p &ge; 0.05
                      </span>
                    )}
                    {isPassedRawOnly && (
                      <span className="bg-purple-950/80 text-purple-400 border border-purple-900/60 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono" title="This signal is significant individually but rejected when correcting for multiple comparisons to avoid fake discoveries.">
                        REJECTED BY FDR q &ge; 0.05 (Data Snooping Check)
                      </span>
                    )}
                    {h.status === "PASSED_FDR" && (
                      <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-900/60 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono">
                        APPROVED: SURVIVED FDR CORRECTION (q &lt; 0.05)
                      </span>
                    )}
                    {isPromoted && (
                      <span className="bg-sky-950/80 text-sky-400 border border-sky-900/60 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-sky-400" /> PROMOTED TO SANDBOX LIVE
                      </span>
                    )}

                    <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2.5 py-0.5 rounded-full text-[9px] font-bold">
                      {h.regime}
                    </span>
                  </div>

                  {/* ID and Date */}
                  <div className="text-left font-mono text-[9px] text-slate-500 w-full sm:w-auto">
                    <span>{h.id} • {new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="text-right space-y-2">
                  <h4 className="text-sm font-black text-slate-200">{h.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">{h.description}</p>
                  
                  {/* Proposed Signal block */}
                  <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-right font-mono text-[10px] space-y-1">
                    <span className="text-slate-500 block uppercase font-bold text-[8px]">سیگناڵی نوێی پێشنیارکراو (Proposed Signal Feature):</span>
                    <span className="text-slate-300 font-bold block">{h.proposed_signal}</span>
                  </div>
                </div>

                {/* Metrics and Stats footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-950/40 border border-slate-850/50 p-3 rounded-lg">
                  
                  {/* Stats numbers */}
                  <div className="flex gap-4 font-mono text-[10px] text-slate-400 w-full sm:w-auto justify-start sm:justify-end">
                    <div className="bg-slate-950 p-2 rounded border border-slate-850/60 text-center min-w-[80px]">
                      <span className="text-[8px] text-slate-500 block">RAW P-VALUE</span>
                      <strong className={`font-bold block ${h.p_value !== null && h.p_value < 0.05 ? "text-emerald-400" : "text-slate-400"}`}>
                        {h.p_value !== null ? h.p_value.toFixed(4) : "N/A"}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-850/60 text-center min-w-[80px]" title="False Discovery Rate adjusted p-value (q-value)">
                      <span className="text-[8px] text-slate-500 block">FDR ADJ P (Q)</span>
                      <strong className={`font-bold block ${h.fdr_adjusted_p !== null && h.fdr_adjusted_p < 0.05 ? "text-emerald-400" : h.fdr_adjusted_p !== null && h.fdr_adjusted_p >= 0.05 ? "text-rose-400" : "text-slate-400"}`}>
                        {h.fdr_adjusted_p !== null ? h.fdr_adjusted_p.toFixed(4) : "N/A"}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-850/60 text-center min-w-[80px]" title="Effect size measured as Sharpe Ratio delta in backtest">
                      <span className="text-[8px] text-slate-500 block">EFFECT SIZE (&Delta;S)</span>
                      <strong className={`font-bold block ${h.effect_size !== null && h.effect_size > 0.4 ? "text-emerald-400" : h.effect_size !== null ? "text-slate-300" : "text-slate-400"}`}>
                        {h.effect_size !== null ? `${h.effect_size > 0 ? "+" : ""}${h.effect_size.toFixed(2)}` : "N/A"}
                      </strong>
                    </div>
                  </div>

                  {/* Actions (Promote button with lock logic) */}
                  <div className="w-full sm:w-auto flex justify-end">
                    {isPromoted ? (
                      <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold font-mono">
                        <Check className="w-4 h-4" />
                        <span>PROMOTED &amp; COMPILING</span>
                      </div>
                    ) : hasPassedFdr ? (
                      <button
                        onClick={() => onPromote(h.id)}
                        disabled={promotingId === h.id}
                        className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg border border-sky-500 shadow-sm shadow-sky-950/50 flex items-center gap-1.5 cursor-pointer font-mono"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>PROMOTE TO SANDBOX</span>
                      </button>
                    ) : (
                      <div 
                        className="bg-slate-950 text-slate-500 text-[10px] py-1.5 px-3 rounded-lg border border-slate-850/60 flex items-center gap-1.5 font-mono cursor-not-allowed select-none"
                        title={isPending ? "Pending Backtest simulation. Run tests first." : "Promotion Blocked: Does not clear FDR threshold. Proceeding would commit data snooping bias."}
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-right">
                          {isPending ? "AWAITING WALK-FORWARD" : "BLOCKED BY FDR CONTROL"}
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
