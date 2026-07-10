import { useState, useEffect } from "react";
import { 
  Brain, Search, Globe, RefreshCw, CheckCircle2, XCircle, 
  Database, Activity, ChevronRight, ChevronDown, BookOpen, Clock, AlertCircle
} from "lucide-react";

export interface SelfImprovementLog {
  id: string;
  timestamp: string;
  weaknessDetected: string;
  metricDetails: string;
  researchTopic: string;
  cacheHit: boolean;
  sources: { title: string; uri: string }[];
  groundedSummary: string;
  generatedCandidateName: string;
  sandboxStatus: "PASSED" | "FAILED" | "REJECTED_NOT_SIGNIFICANT";
  sandboxReason: string;
  metrics: {
    avgReward: number;
    maxDrawdown: number;
    SharpeRatio: number;
    tradesCount: number;
  };
  candidatesEvaluated?: {
    name: string;
    success: boolean;
    reason: string;
    metrics: {
      avgReward: number;
      maxDrawdown: number;
      SharpeRatio: number;
      tradesCount: number;
    };
  }[];
  statisticalTest?: {
    testType: string;
    tStatistic: number;
    pValue: number;
    meanDiff: number;
    df: number;
    significant: boolean;
  };
  decisionReason?: string;
}

export default function SelfImprovementDashboard() {
  const [logs, setLogs] = useState<SelfImprovementLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [triggeringCycle, setTriggeringCycle] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [monitorStats, setMonitorStats] = useState<{
    rollingSharpe: number;
    rollingAvgReward: number;
    evaluationsCount: number;
    degradationPeriods: number;
    consecutivePeriodsLimit: number;
    lastRollbackEvent: {
      timestamp: string;
      fromVersion: string;
      toVersion: string;
      metricsAtTrigger: { SharpeRatio: number; maxDrawdown: number };
    } | null;
    rollbackHistory: { id: string; timestamp: string; name: string; metrics: any }[];
  } | null>(null);

  const fetchLogs = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/self-improvement/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch self-improvement logs:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchMonitorStats = async () => {
    try {
      const res = await fetch("/api/self-improvement/monitor");
      if (res.ok) {
        const data = await res.json();
        setMonitorStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch monitor stats:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchMonitorStats();
    const interval = setInterval(() => {
      fetchLogs();
      fetchMonitorStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerManualCycle = async () => {
    if (triggeringCycle) return;
    setTriggeringCycle(true);
    try {
      const res = await fetch("/api/self-improvement/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.log) {
          setLogs(prev => [data.log, ...prev]);
          setExpandedLogId(data.log.id);
        }
      }
    } catch (err) {
      console.error("Failed to trigger self-improvement run:", err);
    } finally {
      setTriggeringCycle(false);
    }
  };

  // Stats derivation
  const totalRuns = logs.length;
  const passedCount = logs.filter(l => l.sandboxStatus === "PASSED").length;
  const failedCount = logs.filter(l => l.sandboxStatus === "FAILED").length;
  const cacheHitCount = logs.filter(l => l.cacheHit).length;
  const cacheHitRate = totalRuns > 0 ? Math.round((cacheHitCount / totalRuns) * 100) : 0;
  const successRate = totalRuns > 0 ? Math.round((passedCount / totalRuns) * 100) : 0;

  return (
    <div id="self-improvement-dashboard" className="space-y-6" dir="rtl">
      
      {/* Top Professional Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">خولەکانی باشترکردن</span>
            <div className="text-2xl font-black text-slate-100 mt-1 font-mono">{totalRuns}</div>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">ڕوودانی خۆکار و لایڤ</span>
          </div>
          <div className="p-3 bg-purple-950/40 border border-purple-500/20 rounded-xl text-purple-400">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">بڕینی سانبۆکس (Passed)</span>
            <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">{passedCount}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">ڕێژەی سەرکەوتن: {successRate}%</span>
          </div>
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">ڕەتکراوە لە سانبۆکس</span>
            <div className="text-2xl font-black text-rose-400 mt-1 font-mono">{failedCount}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">ڕەتکراوە بەهۆی مەرج یان ئاسایش</span>
          </div>
          <div className="p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl text-rose-400">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">کاشی لۆکاڵی (Cache Hits)</span>
            <div className="text-2xl font-black text-sky-400 mt-1 font-mono">{cacheHitCount}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">ڕێژەی کارایی کاش: {cacheHitRate}%</span>
          </div>
          <div className="p-3 bg-sky-950/40 border border-sky-500/20 rounded-xl text-sky-400">
            <Database className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Main Grid: Control & Logs Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Audit Logs Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex justify-between items-center mb-5 border-b border-slate-850 pb-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="p-2 bg-purple-950/60 border border-purple-500/30 rounded-lg text-purple-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100">لۆگی وردبینی باشترکردنی سەربەخۆ | Audit Trails</h2>
                  <p className="text-[10px] text-slate-400">لۆگی چاکسازی، گەڕانی زانستی چالاک، سەرچاوەکانی وێب و چاککردنی فۆرمولەکان</p>
                </div>
              </div>
              <button 
                onClick={fetchLogs} 
                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-805 text-slate-300 rounded-lg transition-all"
                title="Refresh logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 space-y-2">
                <Brain className="w-8 h-8 text-slate-700 mx-auto animate-pulse" />
                <p className="text-xs font-mono">هیچ لۆگێکی خۆباشکردن لە سیستەمدا بەردەست نییە لەم خولەدا.</p>
                <p className="text-[10px]">چاوەڕوان بە تا خولی خۆکاری خولاو دەست پێ دەکات یان دوگمەی چاکسازی ڕاستەوخۆ دابگرە.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const logDate = new Date(log.timestamp).toLocaleTimeString();
                  
                  return (
                    <div 
                      key={log.id} 
                      className={`border rounded-xl transition-all ${
                        isExpanded 
                          ? "bg-[#0a0f1d] border-purple-800/60 shadow-lg" 
                          : "bg-slate-900/60 border-slate-850 hover:border-slate-800"
                      }`}
                    >
                      {/* Accordion Header */}
                      <button 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="w-full p-4 flex items-center justify-between text-right cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 space-x-reverse flex-1">
                          {log.sandboxStatus === "PASSED" ? (
                            <div className="p-1.5 bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded-lg">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="p-1.5 bg-rose-950 border border-rose-500/40 text-rose-400 rounded-lg">
                              <XCircle className="w-4 h-4" />
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 space-x-reverse flex-wrap">
                              <span className="text-xs font-bold text-slate-100 leading-tight">
                                {log.generatedCandidateName}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${
                                log.cacheHit 
                                  ? "bg-sky-950 border border-sky-850 text-sky-400" 
                                  : "bg-purple-950 border border-purple-850 text-purple-400"
                              }`}>
                                {log.cacheHit ? "CACHE HIT" : "FRESH WEB SEARCH"}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              <span>{logDate}</span>
                              <span className="text-slate-600">|</span>
                              <span className="text-amber-400/80 truncate max-w-[250px] md:max-w-md">{log.weaknessDetected}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mr-4 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* Accordion Expanded Body */}
                      {isExpanded && (
                        <div className="p-5 border-t border-slate-850 space-y-4 text-xs leading-relaxed bg-slate-950/60 rounded-b-xl text-slate-300">
                          
                          {/* Weakness Detail */}
                          <div className="bg-slate-900/80 border border-slate-850 p-3 rounded-lg space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>لاوازی دۆزراوە لە تاقیکردنەوەی DRL (Detected Weakness)</span>
                            </div>
                            <p className="text-slate-300 pr-5">{log.weaknessDetected}</p>
                            <p className="text-[10px] text-slate-500 pr-5 font-mono">سیگناڵی چاودێری: {log.metricDetails}</p>
                          </div>

                          {/* Grounded Summary (Kurdish Explanation) */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>توێژینەوەی دەرهێنراو بە گەڕانی گۆگڵ (Grounded Insights)</span>
                            </div>
                            <div className="bg-slate-900/40 p-3.5 rounded-lg border border-slate-850 text-slate-300 pr-5">
                              {log.groundedSummary}
                            </div>
                          </div>

                          {/* Cited Web References */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                              <Globe className="w-3.5 h-3.5" />
                              <span>سەرچاوە وێبییە فەرمییەکان (Cited Google Search Grounding)</span>
                            </div>
                            <div className="flex flex-wrap gap-2 pr-5">
                              {log.sources.map((src, i) => (
                                <a 
                                  key={i} 
                                  href={src.uri} 
                                  target="_blank" 
                                  referrerPolicy="no-referrer"
                                  rel="noopener noreferrer"
                                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-sky-400 px-3 py-1 rounded-md text-[10px] flex items-center gap-1.5 transition-all"
                                >
                                  <Globe className="w-3 h-3 text-sky-500" />
                                  <span>{src.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>

                          {/* Sandbox Evaluation Verdict */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                              <Activity className="w-3.5 h-3.5" />
                              <span>ئەنجامەکانی سانبۆکس پۆرت و تاقیکردنەوە (Sandbox Gate Metrics)</span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 p-3.5 rounded-lg border border-slate-850 text-center font-mono pr-5">
                              <div>
                                <span className="text-slate-500 block text-[9px]">Sharpe Ratio</span>
                                <span className={`text-sm font-bold ${log.metrics.SharpeRatio >= 1.2 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {log.metrics.SharpeRatio.toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[9px]">Max Drawdown</span>
                                <span className={`text-sm font-bold ${log.metrics.maxDrawdown <= 5.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {log.metrics.maxDrawdown.toFixed(2)}%
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[9px]">Avg Reward</span>
                                <span className="text-sm font-bold text-slate-100">
                                  {log.metrics.avgReward.toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[9px]">Total Trades</span>
                                <span className={`text-sm font-bold ${log.metrics.tradesCount >= 10 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {log.metrics.tradesCount}
                                </span>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-400 pr-5">
                              <strong>دەرەنجامی گەیت: </strong>
                              {log.sandboxStatus === "PASSED" ? (
                                <span className="text-emerald-400 font-bold">سەرکەوتوو بوو. کاندیدەکە بە سەرکەوتوویی خرایە کار بۆ بازرگانی دیمو.</span>
                              ) : log.sandboxStatus === "REJECTED_NOT_SIGNIFICANT" ? (
                                <span className="text-amber-400 font-bold">پاشەکەوت نەکرا چونکە جیاوازیی قازانجەکە لە لایەنی ئامارییەوە بەهێز نەبوو. هۆکار: {log.sandboxReason}</span>
                              ) : (
                                <span className="text-rose-400 font-bold">ڕەتکرایەوە. هۆکار: {log.sandboxReason}</span>
                              )}
                            </p>
                          </div>

                          {/* Candidates Population Details */}
                          {log.candidatesEvaluated && log.candidatesEvaluated.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                              <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                                <Activity className="w-3.5 h-3.5" />
                                <span>کۆمەڵەی کاندیدە دروستکراوەکان (Population Candidates Sandbox Evaluation)</span>
                              </div>
                              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-850 space-y-2 pr-5">
                                <span className="text-[10px] text-slate-400 block mb-1">
                                  سەرجەم {log.candidatesEvaluated.length} کاندید بە هاوتەریب تاقیکرانەوە لەسەر دەیتای مێژوویی:
                                </span>
                                <div className="space-y-1.5">
                                  {log.candidatesEvaluated.map((c: any, idx: number) => (
                                    <div key={idx} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex justify-between items-center text-[10px] font-mono">
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-500">#{idx + 1}</span>
                                        <span className={c.success ? "text-emerald-400" : "text-slate-400"}>{c.name}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span>Sharpe: <strong className={c.metrics.SharpeRatio >= 1.2 ? "text-emerald-400" : "text-rose-400"}>{c.metrics.SharpeRatio.toFixed(2)}</strong></span>
                                        <span>MaxDD: <strong>{c.metrics.maxDrawdown.toFixed(1)}%</strong></span>
                                        <span>Trades: <strong>{c.metrics.tradesCount}</strong></span>
                                        <span className={`px-1 rounded text-[8px] font-bold ${c.success ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : "bg-rose-950 text-rose-400 border border-rose-900"}`}>
                                          {c.success ? "PASSED" : "FAILED"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Statistical Significance Test Details */}
                          {log.statisticalTest && (
                            <div className="space-y-1.5 pt-2">
                              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                                <Activity className="w-3.5 h-3.5" />
                                <span>تاقیکردنەوەی گرنگی ئاماریی پێش نیشاندان (Statistical Significance Testing)</span>
                              </div>
                              <div className="bg-slate-900/40 p-3.5 rounded-lg border border-slate-850 space-y-2 pr-5 font-mono text-[10px]">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-500 block text-[8px]">Test Type</span>
                                    <span className="text-slate-300 font-bold text-[9px]">{log.statisticalTest.testType}</span>
                                  </div>
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-500 block text-[8px]">t-Statistic</span>
                                    <span className="text-slate-100 font-bold">{log.statisticalTest.tStatistic}</span>
                                  </div>
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-500 block text-[8px]">p-Value</span>
                                    <span className={`font-bold ${log.statisticalTest.significant ? "text-emerald-400" : "text-rose-400"}`}>
                                      {log.statisticalTest.pValue}
                                    </span>
                                  </div>
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-500 block text-[8px]">Result</span>
                                    <span className={`font-bold ${log.statisticalTest.significant ? "text-emerald-400" : "text-rose-400"}`}>
                                      {log.statisticalTest.significant ? "SIGNIFICANT (p < 0.05)" : "NOT SIGNIFICANT"}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                                  <strong>شیکردنەوە: </strong>
                                  {log.statisticalTest.significant ? (
                                    <span>جیاوازی کارایی لایەنەکان لە نێوان کاندید و وەشانی چالاک خاوەن گرنگیی ئاماریی پێویستە (Confidence &gt; 95%). مۆدێلی نوێ لەم خولەدا بە سەرکەوتوویی جێگیر کرا.</span>
                                  ) : (
                                    <span>جیاوازی کارایی لایەنەکان لە ڕووی لایەنی ئامارییەوە جیاواز نەبوو (Confidence &lt; 95%). وەشانی چالاکی ئێستا پارێزراو دەبێت بۆ ڕێگری لە کێشەی نەوسان.</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Console Control & Cached Items List */}
        <div className="space-y-6">
          
          {/* Box 1: Manual Run Console */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <Brain className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-bold text-slate-100">مەیدانی چاککردنی ڕاستەوخۆ</h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              تۆ دەتوانیت بە شێوەیەکی دەستی لەگەڵ مەکینەی خۆباشکردنی نەرمەکاڵا کاربکەیت. مەکینەکە دەستبەجێ دوایین لۆگی لاوازی و مۆدێلی DRL دەخوێنێتەوە، گەڕانێکی گەورەی زانستی لە ڕێگەی Gemini Flash 3.5 + Google Search ئەنجام دەدات، لۆکاڵی کاش نوێ دەکاتەوە و کاندیدێکی نوێ ئامادە دەکات.
            </p>

            <button
              onClick={triggerManualCycle}
              disabled={triggeringCycle}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 space-x-reverse transition-all border ${
                triggeringCycle 
                  ? "bg-slate-800 border-slate-750 text-slate-400 cursor-not-allowed" 
                  : "bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-950/40 cursor-pointer"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${triggeringCycle ? 'animate-spin' : ''}`} />
              <span>{triggeringCycle ? "سەربەخۆ خەریکی توێژینەوە و دیزاینە..." : "خستنەکاری خولی چاکسازی دەستی (Trigger Self-Improvement)"}</span>
            </button>
            
            <div className="text-[10px] text-slate-500 font-mono text-center">
              <span>* خولی خۆکاری چاککردن بە شێوەیەکی بێدەنگ هەر ٣ خولەک جارێک ڕوودەدات.</span>
            </div>
          </div>

          {/* Regime-Change Monitor Widget */}
          {monitorStats && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2 space-x-reverse justify-between border-b border-slate-850 pb-3">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-100">چاودێری ڕژێمی کارایی (Regime Monitor)</h3>
                </div>
                <span className="text-[9px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded font-black">
                  LIVE TRACKING
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center font-mono">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-850">
                  <span className="text-slate-500 block text-[9px] uppercase">Rolling Sharpe</span>
                  <span className={`text-base font-bold ${monitorStats.rollingSharpe >= 0.5 ? "text-emerald-400" : "text-rose-400"}`}>
                    {monitorStats.rollingSharpe.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-850">
                  <span className="text-slate-500 block text-[9px] uppercase">Rolling Avg Reward</span>
                  <span className="text-base font-bold text-slate-100">
                    {monitorStats.rollingAvgReward.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>ژمارەی هەڵسەنگاندنەکان (Window)</span>
                  <span className="font-mono font-bold text-slate-300">{monitorStats.evaluationsCount} / 100 periods</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>قۆناغەکانی تێکچوون (Degradation)</span>
                  <span className="font-mono font-bold text-slate-300">
                    <span className={monitorStats.degradationPeriods > 0 ? "text-amber-400" : "text-slate-500"}>
                      {monitorStats.degradationPeriods}
                    </span>{" "}
                    / {monitorStats.consecutivePeriodsLimit} consecutive
                  </span>
                </div>
              </div>

              {/* Last Rollback Event Details */}
              {monitorStats.lastRollbackEvent ? (
                <div className="bg-rose-950/30 border border-rose-900/60 p-3.5 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                    <AlertCircle className="w-4 h-4" />
                    <span>⚠️ پاشەکشەی خۆکار ئەنجامدراوە</span>
                  </div>
                  <div className="text-[10px] text-slate-300 space-y-1">
                    <p>وەشانی کێشەدار: <strong className="text-rose-300">{monitorStats.lastRollbackEvent.fromVersion}</strong></p>
                    <p>وەشانی جێگیر: <strong className="text-emerald-400">{monitorStats.lastRollbackEvent.toVersion}</strong></p>
                    <p>کاتی پاشەکشە: <span className="text-slate-400 font-mono">{new Date(monitorStats.lastRollbackEvent.timestamp).toLocaleTimeString()}</span></p>
                    <p>کارایی کاتی تێکچوون: <span className="font-mono text-rose-300">Sharpe={monitorStats.lastRollbackEvent.metricsAtTrigger.SharpeRatio.toFixed(2)}</span></p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900 text-center">
                  <span className="text-[10px] text-emerald-500/80 font-bold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> سیستەم جێگیرە و هیچ پاشەکشەیەک ڕووی نەداوە
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Box 2: Cache Tracker Stats & Active Cache Entries */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Database className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-100">چاودێری کاشی توێژینەوە لۆکاڵی</h3>
              </div>
              <span className="text-[9px] font-mono bg-sky-950 text-sky-400 border border-sky-850 px-2 py-0.5 rounded font-black">
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              بۆ ڕێگری لە لێکدانەوەی دووبارەی بابەتەکانی توێژینەوە، مەکینەکە کاشی دەستبەجێ بەکاردێنێت. کاتێک کاش لێدراو دەبێت، هیچ کرێدیتی زیادە یان پرسیاری دەرەکی دروست نابێت.
            </p>

            <div className="space-y-2">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">بابەتە پاشەکەوتکراوەکان (RAM Cache)</span>
                <span className="font-mono font-bold text-slate-100">{logs.length > 0 ? Array.from(new Set(logs.map(l => l.researchTopic))).length : 0} بابەت</span>
              </div>
              
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 flex justify-between items-center text-xs">
                <span className="text-slate-400">هاوشێوەبوونی دەیتابەیس</span>
                <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-500" />
                  PERSISTED
                </span>
              </div>
            </div>

            {/* List top research topics cached */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">دوایین بابەتە کاشکراوەکان:</span>
              
              {logs.length === 0 ? (
                <span className="text-[10px] text-slate-600 block italic">هیچ داتایەک نەدۆزرایەوە...</span>
              ) : (
                Array.from(new Set(logs.map(l => l.researchTopic))).slice(0, 3).map((topic, i) => (
                  <div key={i} className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 text-[10px] text-slate-400 truncate" title={topic}>
                    🧠 {topic}
                  </div>
                ))
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
