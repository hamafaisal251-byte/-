import { useState, useEffect } from "react";
import { 
  Brain, ShieldAlert, CheckCircle2, AlertTriangle, ShieldCheck, 
  Activity, Play, RefreshCw, Layers, ToggleLeft, ToggleRight, List, Cpu,
  Settings, Terminal, Sliders, Server, Globe, ArrowRight, Eye, Check
} from "lucide-react";

export interface AvailabilityLog {
  id: number;
  timestamp: string;
  status: string;
  details: string;
}

export interface ToolCallLog {
  id: number;
  timestamp: string;
  sessionId: string;
  toolName: string;
  arguments: any;
  returnValue: string;
}

export default function SystemIntelligencePanel() {
  const [status, setStatus] = useState<{
    geminiAvailableState: "GEMINI_AVAILABLE" | "GEMINI_UNAVAILABLE";
    geminiLastTransitionTime: string;
    tier3Status: "RUNNING" | "PAUSED_AWAITING_GEMINI";
    selectedLocalModel: string;
    ollamaStatus: string;
    benchmarkResults: Record<string, number>;
    mockOutageSimulated: boolean;
    llmProviderMode: "gemini" | "self_hosted";
    selfHostedUrl: string;
    selfHostedModelName: string;
  } | null>(null);

  const [logs, setLogs] = useState<AvailabilityLog[]>([]);
  const [toolLogs, setToolLogs] = useState<ToolCallLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toggling, setToggling] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Provider configuration inputs
  const [providerMode, setProviderMode] = useState<"gemini" | "self_hosted">("gemini");
  const [selfHostedUrl, setSelfHostedUrl] = useState<string>("http://127.0.0.1:11434/v1");
  const [selfHostedModelName, setSelfHostedModelName] = useState<string>("llama3.1:70b");

  // Selected audit tool log for detail modal/drawer
  const [selectedToolLog, setSelectedToolLog] = useState<ToolCallLog | null>(null);

  // Diagnostics state
  const [diagnosticTask, setDiagnosticTask] = useState<"summarize" | "sentiment" | "anomaly">("summarize");
  const [diagnosticPayload, setDiagnosticPayload] = useState<string>('{"logsCount": 12, "latency": 150, "volatility": 2.8}');
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState<boolean>(false);

  const fetchStatusAndLogs = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [statusRes, logsRes, toolLogsRes] = await Promise.all([
        fetch("/api/system-intelligence/status"),
        fetch("/api/system-intelligence/availability-log"),
        fetch("/api/system-intelligence/tool-logs")
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
        if (!isSilent) {
          setProviderMode(statusData.llmProviderMode || "gemini");
          setSelfHostedUrl(statusData.selfHostedUrl || "http://127.0.0.1:11434/v1");
          setSelfHostedModelName(statusData.selfHostedModelName || "llama3.1:70b");
        }
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
      if (toolLogsRes.ok) {
        const toolLogsData = await toolLogsRes.json();
        setToolLogs(toolLogsData.logs || []);
      }
    } catch (err) {
      console.warn("Failed to fetch system intelligence details (expected during startup/restart):", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndLogs();
    // Poll status every 8 seconds for live updates
    const timer = setInterval(() => {
      fetchStatusAndLogs(true);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleOutage = async () => {
    if (!status || toggling) return;
    setToggling(true);
    try {
      const targetState = !status.mockOutageSimulated;
      const res = await fetch("/api/system-intelligence/simulate-outage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulate: targetState })
      });
      if (res.ok) {
        await fetchStatusAndLogs(true);
      }
    } catch (err) {
      console.error("Failed to toggle mock outage:", err);
    } finally {
      setToggling(false);
    }
  };

  const handleSaveProviderConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/system-intelligence/provider-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: providerMode,
          selfHostedUrl,
          selfHostedModelName
        })
      });
      if (res.ok) {
        await fetchStatusAndLogs(true);
        alert("Sovereign LLM Provider configuration updated successfully!");
      }
    } catch (err) {
      console.error("Failed to save provider config:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setDiagnosticRunning(true);
    setDiagnosticResult(null);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(diagnosticPayload);
      } catch (e) {
        parsedPayload = { rawText: diagnosticPayload };
      }

      const res = await fetch("/api/system-intelligence/tier2-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: diagnosticTask,
          payload: parsedPayload
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDiagnosticResult(data.result);
      } else {
        setDiagnosticResult({ success: false, error: "HTTP error " + res.status });
      }
    } catch (err: any) {
      setDiagnosticResult({ success: false, error: err.message });
    } finally {
      setDiagnosticRunning(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatusAndLogs();
    setRefreshing(false);
  };

  if (loading && !status) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
        <p className="text-xs font-mono">Loading Sovereign Intelligence Resilience diagnostics...</p>
      </div>
    );
  }

  const isGeminiAvailable = status?.geminiAvailableState === "GEMINI_AVAILABLE";

  return (
    <div className="space-y-6">
      
      {/* 1. Status Overview Header Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Badge / Summary Card */}
        <div className={`md:col-span-8 p-6 rounded-xl border relative overflow-hidden transition-all duration-300 ${
          isGeminiAvailable 
            ? "bg-slate-900 border-emerald-500/30 shadow-md shadow-emerald-950/20" 
            : "bg-slate-900 border-rose-500/30 shadow-md shadow-rose-950/20"
        }`}>
          {/* Ambient Glow */}
          <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 pointer-events-none rounded-full ${
            isGeminiAvailable ? "bg-emerald-500" : "bg-rose-500"
          }`} />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 text-right" dir="rtl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full ${isGeminiAvailable ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-bounce"}`} />
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide">رۆتینی چاودێری هۆشیاری سیستەم | Intelligent Resilience</h3>
              </div>
              
              <div className="text-3xl font-black mt-1">
                {isGeminiAvailable ? (
                  <span className="text-emerald-400 font-mono tracking-tight">GEMINI ONLINE</span>
                ) : (
                  <span className="text-rose-400 font-mono tracking-tight">GEMINI OFFLINE</span>
                )}
              </div>
              
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                {isGeminiAvailable 
                  ? "مەکینەی هۆشیاری هاوسەنگی جێگیری بەکاردەهێنێت. پرۆسەکانی لێکۆڵینەوەی قووڵ و چاککردنی کۆدەکان بە تەواوی چالاکن."
                  : "مەکینەی فەرمی هاوسەنگی ناچالاکە. پرۆسەکانی کۆدەکان (تۆڕی ئۆتۆماتیکی پاشەکشە) گۆڕاون بۆ ئاستی ٢ و ٣."}
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-all cursor-pointer"
              title="دوبارە نوێکردنەوە"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-purple-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Override Toggle Controller */}
        <div className="md:col-span-4 bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between space-y-4">
          <div className="text-right" dir="rtl">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-slate-200">تاقیکردنەوەی بارودۆخی پەککەوتن</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              پەککەوتنی دەستکرد چالاک بکە بۆ دڵنیابوون لەوەی کە سیستەمەکە چۆن دەگۆڕێت بۆ مۆدێلی لۆکاڵی هاوشێوە.
            </p>
          </div>

          <button
            onClick={handleToggleOutage}
            disabled={toggling}
            className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-3.5 space-x-reverse transition-all border ${
              status?.mockOutageSimulated 
                ? "bg-rose-950/40 border-rose-500/50 hover:bg-rose-900/30 text-rose-300"
                : "bg-slate-800/80 border-slate-700 hover:border-purple-500/30 text-slate-300"
            }`}
          >
            {status?.mockOutageSimulated ? (
              <>
                <ToggleRight className="w-6 h-6 text-rose-400" />
                <span>ناچالاککردنی پەککەوتن (Outage Active)</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-slate-400" />
                <span>هاوشێوەکردنی پەککەوتن (Simulate Outage)</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* NEW SECTION: Provider Abstraction Controller & Hardware Requirement details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Provider Config Slider Form */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded font-black">PROVIDER SETTINGS</span>
            <div className="flex items-center gap-2 text-slate-200 font-bold text-xs text-right" dir="rtl">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>هەڵبژاردنی دابینکەری زیرەکی دەستکرد (Active LLM Provider)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Gemini Option */}
            <div 
              onClick={() => setProviderMode("gemini")}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                providerMode === "gemini" 
                  ? "bg-purple-950/20 border-purple-500" 
                  : "bg-slate-950 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex justify-between items-start">
                <Brain className={`w-5 h-5 ${providerMode === "gemini" ? "text-purple-400" : "text-slate-500"}`} />
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${providerMode === "gemini" ? "bg-purple-900 text-purple-300" : "bg-slate-900 text-slate-400"}`}>API PROXY</span>
              </div>
              <div className="text-right mt-3" dir="rtl">
                <h4 className="text-xs font-bold text-slate-200">Google Gemini API</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">سرویسی هەوری جیهانی گوگل</p>
              </div>
            </div>

            {/* Self-Hosted Option */}
            <div 
              onClick={() => setProviderMode("self_hosted")}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                providerMode === "self_hosted" 
                  ? "bg-sky-950/20 border-sky-500" 
                  : "bg-slate-950 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex justify-between items-start">
                <Server className={`w-5 h-5 ${providerMode === "self_hosted" ? "text-sky-400" : "text-slate-500"}`} />
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${providerMode === "self_hosted" ? "bg-sky-900 text-sky-300" : "bg-slate-900 text-slate-400"}`}>LOCAL GPU</span>
              </div>
              <div className="text-right mt-3" dir="rtl">
                <h4 className="text-xs font-bold text-slate-200">Self-Hosted Agent</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">مۆدێلی سەرچاوە کراوەی ناوخۆیی</p>
              </div>
            </div>
          </div>

          {providerMode === "self_hosted" && (
            <div className="space-y-3 pt-2 font-mono text-[11px] animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 block text-right">Self-Hosted URL</label>
                  <input 
                    type="text" 
                    value={selfHostedUrl} 
                    onChange={(e) => setSelfHostedUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 block text-right">Model Identifier</label>
                  <input 
                    type="text" 
                    value={selfHostedModelName} 
                    onChange={(e) => setSelfHostedModelName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center border-t border-slate-800 pt-4">
            <div className="text-slate-500 text-[10px] font-mono">
              Current Mode: <strong className="text-purple-400">{status?.llmProviderMode?.toUpperCase()}</strong>
            </div>
            <button
              onClick={handleSaveProviderConfig}
              disabled={savingConfig}
              className="py-2 px-5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-purple-950/20"
            >
              {savingConfig ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              <span>تۆمارکردنی دابینکەر (Save Config)</span>
            </button>
          </div>
        </div>

        {/* Real Hardware Requirements Notice */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-sky-500/10 blur-2xl rounded-full" />
          
          <div className="text-right space-y-2.5 relative z-10" dir="rtl">
            <div className="flex items-center gap-2 justify-end text-sky-400 font-bold text-xs">
              <Cpu className="w-4 h-4" />
              <span>پێداویستییە فەرمییەکانی مۆدێلی ناوخۆیی (GPU Scale)</span>
            </div>
            
            <h4 className="text-sm font-black text-slate-200">مەرجەکانی میوانداریکردنی مۆدێلی Llama-3.1-70B</h4>
            
            <p className="text-[10px] text-slate-400 leading-relaxed">
              کارپێکردنی مۆدێلێکی بەهێزی ٧٠ ملیار پارامەتری سەرچاوە کراوە پێویستی بە دابینکەرێکی دەرەکی ڕاستەقینەی خاوەن GPU هەیە. ناگۆڕدرێت بە کۆمپیوتەرێکی ئاسایی یان مۆبایل.
            </p>

            <ul className="text-[10px] text-slate-500 space-y-1.5 list-disc list-inside bg-slate-950 p-3 rounded-lg border border-slate-850">
              <li>١ لانی کەم کارتێکی <strong>NVIDIA A100 (80GB VRAM)</strong> یان H100 پێویستە.</li>
              <li>٢ میوانداریکردنی ئاسان لەسەر پلاتفۆڕمەکانی: <strong>RunPod, Vast.ai, یان Lambda Labs</strong>.</li>
              <li>٣ تێکڕای تاخیربوون لەم ڕەقەکاڵایە: <strong>~٣٥٠ میلی چرکە</strong> بۆ جێبەجێکردنی هەر خولێکی فەرمان.</li>
            </ul>
          </div>

          <div className="text-[10px] font-mono text-slate-500 text-left pt-2 border-t border-slate-800">
            Recommended Server: <span className="text-sky-400">RunPod Secure Cloud</span>
          </div>
        </div>

      </div>

      {/* 2. Resilience Tiers Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tier 1 Box */}
        <div className={`p-5 rounded-xl border bg-slate-950/40 space-y-3 relative ${isGeminiAvailable ? "border-emerald-500/20" : "border-slate-800/50"}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">TIER 1 (API)</span>
            <ShieldCheck className={`w-4 h-4 ${isGeminiAvailable ? "text-emerald-400" : "text-slate-500"}`} />
          </div>
          <div className="text-right" dir="rtl">
            <h4 className="text-xs font-bold text-slate-200">هاوسەنگی سەرەکی (Gemini-3.5)</h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              کاتێک تۆڕەکە ئامادەیە، هەموو چاکسازییەک و توێژینەوەیەک لە ڕێگەی فەرمی دەکات.
            </p>
          </div>
          <div className="text-xs font-mono pt-2 border-t border-slate-900 flex justify-between text-slate-400">
            <span>Status:</span>
            <span className={isGeminiAvailable ? "text-emerald-400 font-bold" : "text-slate-500"}>
              {isGeminiAvailable ? "ACTIVE" : "BYPASSED"}
            </span>
          </div>
        </div>

        {/* Tier 2 Box */}
        <div className={`p-5 rounded-xl border bg-slate-950/40 space-y-3 relative ${!isGeminiAvailable ? "border-amber-500/20" : "border-slate-800/50"}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">TIER 2 (LOCAL LLM)</span>
            <Layers className={`w-4 h-4 ${!isGeminiAvailable ? "text-amber-400 animate-pulse" : "text-slate-500"}`} />
          </div>
          <div className="text-right" dir="rtl">
            <h4 className="text-xs font-bold text-slate-200">داشکاندنی لۆکاڵی (Local Fallback)</h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              بۆ پرۆسە نەرمەکان (لێکدانەوەی ڕاپۆرت، لایەنی متمانە، پێشبینی لۆگ) گۆڕاوە بۆ مۆدێلی لۆکاڵی {status?.selectedLocalModel}.
            </p>
          </div>
          <div className="text-xs font-mono pt-2 border-t border-slate-900 flex justify-between text-slate-400">
            <span>Model:</span>
            <span className="text-sky-400 font-bold">{status?.selectedLocalModel || "llama3.2:3b"}</span>
          </div>
        </div>

        {/* Tier 3 Box */}
        <div className={`p-5 rounded-xl border bg-slate-950/40 space-y-3 relative ${status?.tier3Status === "PAUSED_AWAITING_GEMINI" ? "border-rose-500/20" : "border-slate-800/50"}`}>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">TIER 3 (CRITICAL CODE)</span>
            <ShieldAlert className={`w-4 h-4 ${status?.tier3Status === "PAUSED_AWAITING_GEMINI" ? "text-rose-400 animate-pulse" : "text-slate-500"}`} />
          </div>
          <div className="text-right" dir="rtl">
            <h4 className="text-xs font-bold text-slate-200">پرۆسەی ڕاگرتنی ڕەها (Pause Action)</h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              ڕاگرتنی مەکینەی چاکسازی کۆد بە تەواوی، چونکە هیچ نووسینەوەیەکی کۆد لۆکاڵانە ئەنجام نادرێت بۆ پاراستنی هێڵەکانی سەلامەتی.
            </p>
          </div>
          <div className="text-xs font-mono pt-2 border-t border-slate-900 flex justify-between text-slate-400">
            <span>Core State:</span>
            <span className={status?.tier3Status === "PAUSED_AWAITING_GEMINI" ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
              {status?.tier3Status || "RUNNING"}
            </span>
          </div>
        </div>

      </div>

      {/* NEW SECTION: Agent Tool Calling Audit Trail logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded font-black">AUDIT TRAIL</span>
          <div className="flex items-center gap-1.5 text-slate-200 font-bold text-xs text-right" dir="rtl">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>تۆماری کارپێکردنی ئامرازەکانی کۆد لایەن مۆدێلی ناوخۆیی (Agent Tool Execution Logs)</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 leading-normal text-right" dir="rtl">
          لەم بەشەدا وردەکاری کارپێکردنی ئامرازەکانی کۆد بۆ مۆدێلی لۆکاڵی وەک <code className="text-purple-400 font-bold">web_search</code>، <code className="text-sky-400 font-bold">get_live_price</code> نیشان دەدرێت بۆ دڵنیابوون لە چاوپێکەوتنەکان و پاراستنی سەلامەتی.
        </p>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 max-h-72 overflow-y-auto">
          <table className="w-full text-right border-collapse font-mono text-[11px]" dir="rtl">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px]">
                <th className="p-3">کات / Time</th>
                <th className="p-3 text-center">Session ID</th>
                <th className="p-3 text-center">ئامراز / Tool</th>
                <th className="p-3 text-center">پارامەترەکان / Args</th>
                <th className="p-3 text-left">چاوپێکەوتن (Details)</th>
              </tr>
            </thead>
            <tbody>
              {toolLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-600 italic font-sans">
                    هیچ لۆگێکی چالاک لە کارپێکردنی ئامرازەکانی کۆد لایەن مۆدێلی لۆکاڵی دەست نەکەوتووە.
                  </td>
                </tr>
              ) : (
                toolLogs.map((log) => {
                  const timeStr = new Date(log.timestamp).toLocaleTimeString();
                  return (
                    <tr key={log.id} className="border-b border-slate-900 hover:bg-slate-900/20 text-slate-300">
                      <td className="p-3 text-slate-500 text-[10px]">{timeStr}</td>
                      <td className="p-3 text-center text-slate-400 text-[10px] truncate max-w-xs">{log.sessionId}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-950/60 text-purple-400 border border-purple-900">
                          {log.toolName}
                        </span>
                      </td>
                      <td className="p-3 text-center text-sky-300 text-[10px] truncate max-w-[150px]" title={JSON.stringify(log.arguments)}>
                        {JSON.stringify(log.arguments)}
                      </td>
                      <td className="p-3 text-left">
                        <button
                          onClick={() => setSelectedToolLog(log)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-sky-400" />
                          <span>ببینە (View)</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed view modal for a selected Tool call */}
      {selectedToolLog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center text-right" dir="rtl">
              <h3 className="text-xs font-bold text-slate-200">وردەکاری لۆگی کارپێکردنی ئامراز</h3>
              <button 
                onClick={() => setSelectedToolLog(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono font-bold"
              >
                [ CLOSE ]
              </button>
            </div>
            <div className="p-5 space-y-4 text-right" dir="rtl">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 block">ئامراز / Tool</span>
                  <span className="text-purple-400 font-extrabold font-mono uppercase bg-purple-950/60 px-2 py-1 rounded border border-purple-900/50 inline-block">{selectedToolLog.toolName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block">کات / Timestamp</span>
                  <span className="text-slate-300 font-mono">{new Date(selectedToolLog.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 text-xs block">پارامەترەکانی داواکاری (Arguments)</span>
                <pre className="w-full bg-slate-950 border border-slate-850 p-3 rounded-lg text-left text-xs font-mono text-sky-300 overflow-x-auto" dir="ltr">
                  {JSON.stringify(selectedToolLog.arguments, null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 text-xs block">دەرئەنجام (Returned Output)</span>
                <pre className="w-full bg-slate-950 border border-slate-850 p-3 rounded-lg text-left text-xs font-mono text-emerald-400 overflow-x-auto max-h-56 overflow-y-auto" dir="ltr">
                  {selectedToolLog.returnValue}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Diagnostic Playground and Transition Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Transition Logs Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded font-black">LAST 10 EVENTS</span>
            <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs">
              <List className="w-4 h-4 text-purple-400" />
              <span>مێژووی پەککەوتن و گۆڕانی جێگیرییەکان</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-850 bg-slate-950">
            <table className="w-full text-right border-collapse font-mono text-[11px]" dir="rtl">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px]">
                  <th className="p-2.5">کات / Timestamp</th>
                  <th className="p-2.5">جۆر</th>
                  <th className="p-2.5 font-bold text-left">وردەکارییەکان / Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-600 italic font-sans">
                      هیچ تۆمارێکی گۆڕانکاری جێگیری پاشکەوت تا ئێستا تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  logs.slice(0, 10).map((log, idx) => {
                    const timeStr = new Date(log.timestamp).toLocaleString();
                    const isAvail = log.status === "GEMINI_AVAILABLE";
                    return (
                      <tr key={log.id || idx} className="border-b border-slate-900 hover:bg-slate-900/20 text-slate-300">
                        <td className="p-2.5 text-slate-500 text-[10px]">{timeStr}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            isAvail ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900" : "bg-rose-950/60 text-rose-400 border border-rose-900"
                          }`}>
                            {isAvail ? "ONLINE" : "OFFLINE"}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-400 text-left text-xs max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Tier 2 Diagnostic Playground */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded font-black">DIAGNOSTICS PLAYGROUND</span>
            <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>تاقیکردنەوەی چالاککردنی لۆکاڵی جێگرەوە</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed text-right" dir="rtl">
            ئەنجامدانی ئەرکی ئاستی ٢ لە ڕێگەی کارپێکردنەوەی ناچالاک بە بێدەنگی. کاتێک Gemini ناچالاک بێت، تێکستی گەڕاوە بە شێوەیەکی ئاشکرا تاگ دەکرێت بە <strong className="text-amber-400 font-bold">Simulated Local Fallback</strong>.
          </p>

          <div className="space-y-3 font-sans">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setDiagnosticTask("summarize");
                  setDiagnosticPayload('{"logsCount": 12, "latency": 150, "volatility": 2.8}');
                }}
                className={`p-2 rounded text-xs font-bold border transition-all ${
                  diagnosticTask === "summarize"
                    ? "bg-purple-950/60 border-purple-500/50 text-purple-400"
                    : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300"
                }`}
              >
                Summarize Logs
              </button>
              <button
                onClick={() => {
                  setDiagnosticTask("sentiment");
                  setDiagnosticPayload('{"headline": "US macroeconomic inflation spikes higher than market consensus, posing dollar risks."}');
                }}
                className={`p-2 rounded text-xs font-bold border transition-all ${
                  diagnosticTask === "sentiment"
                    ? "bg-purple-950/60 border-purple-500/50 text-purple-400"
                    : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300"
                }`}
              >
                Sentiment Score
              </button>
              <button
                onClick={() => {
                  setDiagnosticTask("anomaly");
                  setDiagnosticPayload('{"latency": 450, "volatility": 3.1, "slippage": 8}');
                }}
                className={`p-2 rounded text-xs font-bold border transition-all ${
                  diagnosticTask === "anomaly"
                    ? "bg-purple-950/60 border-purple-500/50 text-purple-400"
                    : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-300"
                }`}
              >
                Anomaly Detection
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 block text-right">Payload Input (JSON string)</label>
              <textarea
                value={diagnosticPayload}
                onChange={(e) => setDiagnosticPayload(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-purple-500/50 text-right"
              />
            </div>

            <button
              onClick={handleRunDiagnostic}
              disabled={diagnosticRunning}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2 space-x-reverse cursor-pointer shadow shadow-sky-950/30 transition-all"
            >
              <Play className={`w-3.5 h-3.5 ${diagnosticRunning ? "animate-ping text-purple-300" : ""}`} />
              <span>{diagnosticRunning ? "خەریکی جێبەجێکردنە..." : "ئەنجامدانی تاقیکردنەوە (Execute Tier 2)"}</span>
            </button>
          </div>

          {/* Diagnostic Result Render */}
          {diagnosticResult && (
            <div className="bg-slate-950/70 border border-slate-850 p-3.5 rounded-lg space-y-2 text-right" dir="rtl">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <span className="text-[9px] font-mono text-slate-500 uppercase">{diagnosticResult.timestamp ? new Date(diagnosticResult.timestamp).toLocaleTimeString() : ""}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    diagnosticResult.generatedBy === "gemini" 
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                      : "bg-amber-950 text-amber-400 border border-amber-900"
                  }`}>
                    {diagnosticResult.generatedBy === "gemini" ? "✓ GEMINI GENERATED" : "⚠ FALLBACK SIMULATED"}
                  </span>
                  <span className="text-xs font-bold text-slate-300">ئەنجامی فۆرمولەی لێکدانەوە</span>
                </div>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                {diagnosticResult.text}
              </div>

              <div className="text-[10px] text-slate-500 font-mono text-left" dir="ltr">
                Model used: <span className="text-purple-400 font-bold">{diagnosticResult.modelUsed}</span>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
