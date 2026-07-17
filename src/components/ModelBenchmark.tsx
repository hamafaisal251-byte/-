import { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, AlertTriangle, ShieldCheck, Play, Award, Zap, Terminal, Database, Server, ChevronDown, ChevronUp, Clock, BarChart3, Settings, Receipt, ListFilter, Save } from 'lucide-react';

interface ModelStats {
  passRate: number;
  whitelistRate: number;
  compileRate: number;
  asanRate: number;
  avgLatency: number;
  passedCount: number;
}

interface PromptResult {
  promptId: number;
  topic: string;
  guideline: string;
  gemini: {
    code: string;
    whitelist: boolean;
    compile: boolean;
    asan: boolean;
    passed: boolean;
    latency: number;
  };
  qwen: {
    code: string;
    whitelist: boolean;
    compile: boolean;
    asan: boolean;
    passed: boolean;
    latency: number;
  };
}

interface BenchmarkData {
  timestamp: string;
  sampleSize: number;
  geminiStats: ModelStats;
  qwenStats: ModelStats;
  brierScores: {
    gemini: number;
    qwen: number;
  };
  reassignmentPolicy: string;
  policyExplanation: string;
  results: PromptResult[];
}

interface ProviderConfig {
  mode: 'gemini' | 'self_hosted' | 'deepseek';
  selfHostedUrl: string;
  selfHostedModelName: string;
  enablePolicyRouting: boolean;
  routingPolicy: {
    routine_parameter_tuning: 'gemini' | 'self_hosted' | 'deepseek';
    complex_multi_signal_synthesis: 'gemini' | 'self_hosted' | 'deepseek';
    tier_2_fallback: 'gemini' | 'self_hosted' | 'deepseek';
    deep_research: 'gemini' | 'self_hosted' | 'deepseek';
    general: 'gemini' | 'self_hosted' | 'deepseek';
  };
  policyReasoning: string;
  deepseekApiKeyConfigured: boolean;
}

interface UsageLog {
  id: number;
  timestamp: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: string;
  taskCategory: string;
  status: string;
}

interface UsageSummary {
  provider: string;
  promptTokens: string;
  completionTokens: string;
  totalTokens: string;
  cost: string;
  callCount: string;
}

export default function ModelBenchmark() {
  const [activeTab, setActiveTab] = useState<'benchmark' | 'config' | 'usage'>('benchmark');
  
  // Benchmark state
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState<boolean>(true);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [expandedPromptId, setExpandedPromptId] = useState<number | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationSuccess, setCalibrationSuccess] = useState<string | null>(null);

  // Config State
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [deepseekApiKey, setDeepseekApiKey] = useState<string>('');

  // Usage State
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary[]>([]);
  const [loadingUsage, setLoadingUsage] = useState<boolean>(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  // Fetch benchmark results
  const fetchBenchmark = async () => {
    try {
      setLoadingBenchmark(true);
      const res = await fetch('/api/benchmark-results');
      if (res.ok) {
        const json = await res.json();
        if (json.success !== false) {
          setData(json);
          setBenchmarkError(null);
        } else {
          setBenchmarkError(json.message || "Failed to load results.");
        }
      } else {
        setBenchmarkError("Failed to fetch benchmark metadata.");
      }
    } catch (err: any) {
      setBenchmarkError("Error reaching the metrics server: " + err.message);
    } finally {
      setLoadingBenchmark(false);
    }
  };

  // Fetch provider configuration
  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch('/api/system-intelligence/provider-config');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setConfig(json);
          setDeepseekApiKey(json.deepseekApiKeyConfigured ? '••••••••••••••••' : '');
          setConfigError(null);
        } else {
          setConfigError(json.error || "Failed to load LLM config.");
        }
      }
    } catch (err: any) {
      setConfigError("Error loading configurations: " + err.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch usage logs & metrics
  const fetchUsage = async () => {
    try {
      setLoadingUsage(true);
      const res = await fetch('/api/system-intelligence/provider-usage');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUsageLogs(json.logs || []);
          setUsageSummary(json.summary || []);
          setUsageError(null);
        } else {
          setUsageError(json.error || "Failed to load usage summary.");
        }
      }
    } catch (err: any) {
      setUsageError("Error loading usage statistics: " + err.message);
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    fetchBenchmark();
    fetchConfig();
    fetchUsage();
  }, []);

  const handleTriggerCalibration = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationSuccess(null);
      const res = await fetch('/api/system-intelligence/recalibrate-benchmarks', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setCalibrationSuccess(json.message);
        // Poll benchmark results again after 15s
        setTimeout(() => {
          fetchBenchmark();
        }, 15000);
      } else {
        setBenchmarkError(json.error || "Failed to trigger calibration.");
      }
    } catch (err: any) {
      setBenchmarkError("Error launching calibrator: " + err.message);
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    try {
      setLoadingConfig(true);
      setSaveSuccess(false);
      const payload = {
        ...config,
        deepseekApiKey: deepseekApiKey === '••••••••••••••••' ? undefined : deepseekApiKey
      };
      const res = await fetch('/api/system-intelligence/provider-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        setConfigError(null);
        fetchConfig();
        fetchUsage();
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setConfigError(json.error || "Failed to save configuration.");
      }
    } catch (err: any) {
      setConfigError("Error saving configurations: " + err.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleRoutingPolicyChange = (category: string, val: any) => {
    if (!config) return;
    setConfig({
      ...config,
      routingPolicy: {
        ...config.routingPolicy,
        [category]: val
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-850">
        <button
          onClick={() => setActiveTab('benchmark')}
          className={`px-5 py-3 text-xs font-mono font-bold tracking-wider uppercase border-b-2 transition flex items-center space-x-2 cursor-pointer ${
            activeTab === 'benchmark'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Benchmark Matrix</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('config');
            fetchConfig();
          }}
          className={`px-5 py-3 text-xs font-mono font-bold tracking-wider uppercase border-b-2 transition flex items-center space-x-2 cursor-pointer ${
            activeTab === 'config'
              ? 'border-purple-500 text-purple-400 bg-purple-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Provider Controller</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('usage');
            fetchUsage();
          }}
          className={`px-5 py-3 text-xs font-mono font-bold tracking-wider uppercase border-b-2 transition flex items-center space-x-2 cursor-pointer ${
            activeTab === 'usage'
              ? 'border-blue-500 text-blue-400 bg-blue-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Costs & Usage Logs</span>
        </button>
      </div>

      {/* ==================== TAB 1: BENCHMARKS ==================== */}
      {activeTab === 'benchmark' && (
        <div className="space-y-6">
          {/* Overview Header */}
          <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] bg-purple-950 border border-purple-800 text-purple-300 px-2 py-0.5 rounded font-black uppercase tracking-widest font-mono">
                    COMPLIANCE GATES
                  </span>
                  <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded font-black uppercase tracking-widest font-mono">
                    ROUTING CALIBRATOR
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-100 flex items-center space-x-2">
                  <Award className="w-6 h-6 text-emerald-400" />
                  <span>Sovereign LLM Objective Benchmarks</span>
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
                  Strict empirical evaluation comparing Google Gemini and our upgraded, self-hosted open-source alternative. This quantitative matrix governs our active task routing policy based on sandbox pass rates.
                </p>
              </div>
              <button
                onClick={handleTriggerCalibration}
                disabled={isCalibrating}
                className={`px-5 py-3 rounded-xl bg-slate-950 border border-slate-850 text-xs font-bold font-mono text-slate-200 flex items-center space-x-2 hover:bg-slate-900 hover:border-slate-700 transition cursor-pointer shrink-0 ${isCalibrating ? 'opacity-50' : ''}`}
              >
                <Zap className={`w-4 h-4 text-amber-400 ${isCalibrating ? 'animate-bounce' : ''}`} />
                <span>{isCalibrating ? "RECALIBRATING..." : "RUN LIVE CALIBRATION"}</span>
              </button>
            </div>

            {calibrationSuccess && (
              <div className="mt-4 p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-xs text-emerald-400 font-mono text-right" dir="rtl">
                {calibrationSuccess}
              </div>
            )}

            {data && (
              <div className="mt-6 pt-6 border-t border-slate-850 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-900 space-y-2 text-right" dir="rtl">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase font-black">مۆدێلی سەربەخۆ | Self-Hosted Model</span>
                  <div className="flex items-center justify-end space-x-2">
                    <span className="text-sm font-bold text-slate-200">Qwen2.5-Coder-32B-Instruct</span>
                    <Server className="w-4 h-4 text-purple-400 mr-2" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    مۆدێلی کۆدنووسینی قورسی ٣٢ ملیار پارامیتەری، فیت کراوە بە کەرنەڵی C++ بۆ زیادکردنی ئۆتۆنۆمی گەشەکردنی کاندیدەکانی NEXUS.
                  </p>
                </div>
                
                <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-900/40 space-y-1 text-right" dir="rtl">
                  <span className="text-[10px] font-mono text-emerald-400 block uppercase font-black">یاسای دابەشکردنی ئەرکەکان | Active Routing Policy</span>
                  <div className="flex items-center justify-end space-x-1.5">
                    <span className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider font-mono">
                      {data.reassignmentPolicy}
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 mr-1.5" />
                  </div>
                  <p className="text-[11px] text-emerald-300 leading-relaxed">
                    {data.policyExplanation}
                  </p>
                </div>
              </div>
            )}
          </div>

          {loadingBenchmark ? (
            <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-16 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-mono text-slate-400">Loading benchmark matrix results...</p>
            </div>
          ) : (
            <>
              {benchmarkError && (
                <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 flex items-start space-x-3 text-right" dir="rtl">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 ml-3" />
                  <div className="space-y-1">
                    <span className="font-semibold text-rose-300 text-xs uppercase block">ئاگاداری سیستەم | System Alert</span>
                    <p className="text-xs text-rose-200">{benchmarkError}</p>
                  </div>
                </div>
              )}

              {data && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Gemini stats Card */}
                    <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-6 relative overflow-hidden">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-emerald-950/60 border border-emerald-800 text-emerald-400 rounded-lg">
                            <Cpu className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-100">Google Gemini</h3>
                            <p className="text-[10px] font-mono text-slate-500">PRIMARY SYSTEM HOST (Free Tier)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-emerald-400 font-mono">{data.geminiStats.passRate}%</span>
                          <span className="block text-[8px] font-mono text-slate-500">OVERALL PASS RATE</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Whitelist Check</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono">{data.geminiStats.whitelistRate}%</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">GCC Compilation</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono">{data.geminiStats.compileRate}%</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">ASan Dynamic Playback</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono">{data.geminiStats.asanRate}%</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Average Latency</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono flex items-center">
                            <Clock className="w-4 h-4 text-slate-400 mr-1 shrink-0" />
                            {data.geminiStats.avgLatency}ms
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900 text-xs font-mono text-slate-400 flex justify-between items-center">
                        <span>Brier Calibration Score:</span>
                        <span className="text-slate-200 font-bold">{data.brierScores.gemini}</span>
                      </div>
                    </div>

                    {/* Upgraded Qwen Coder stats Card */}
                    <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-6 relative overflow-hidden">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-purple-950/60 border border-purple-800 text-purple-400 rounded-lg">
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-100">Qwen2.5-Coder-32B</h3>
                            <p className="text-[10px] font-mono text-slate-500">SELF-HOSTED CODESPACE</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-purple-400 font-mono">{data.qwenStats.passRate}%</span>
                          <span className="block text-[8px] font-mono text-slate-500">OVERALL PASS RATE</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Whitelist Check</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono">{data.qwenStats.whitelistRate}%</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">GCC Compilation</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono">{data.qwenStats.compileRate}%</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">ASan Dynamic Playback</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono">{data.qwenStats.asanRate}%</span>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Average Latency</span>
                          <span className="text-lg font-bold text-slate-200 mt-1 font-mono flex items-center">
                            <Clock className="w-4 h-4 text-slate-400 mr-1 shrink-0" />
                            {data.qwenStats.avgLatency}ms
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900 text-xs font-mono text-slate-400 flex justify-between items-center">
                        <span>Brier Calibration Score:</span>
                        <span className="text-slate-200 font-bold">{data.brierScores.qwen}</span>
                      </div>
                    </div>

                  </div>

                  {/* Hardware requirements */}
                  <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                      <Database className="w-5 h-5 text-emerald-400" />
                      <span>Rented Server Deployment Hardware Specifications</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">VRAM CONSUMPTION (FP16)</span>
                        <span className="text-lg font-extrabold text-slate-200 font-mono">64 GB</span>
                        <p className="text-xs text-slate-400">Requires high-capacity server GPUs like A100 (80GB) or dual RTX 6000 Ada.</p>
                      </div>

                      <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">OLLAMA INT4 QUANTIZED</span>
                        <span className="text-lg font-extrabold text-purple-400 font-mono">~19 GB</span>
                        <p className="text-xs text-slate-400">Ideal for budget-optimized direct deployment on a single standard RTX 3090/4090 GPU.</p>
                      </div>

                      <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">RECOMMENDED GPU HOST</span>
                        <span className="text-lg font-extrabold text-emerald-400 font-mono">NVIDIA L4 / A10G</span>
                        <p className="text-xs text-slate-400">Renting on RunPod/Vast.ai costs approximately $0.35 - $0.70 per hour.</p>
                      </div>
                    </div>
                  </div>

                  {/* breakdown of results */}
                  <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                      <span>Empirical Hypotheses Evaluation Breakdown (15 Tests)</span>
                    </h3>

                    <div className="space-y-3">
                      {data.results.map((result) => (
                        <div 
                          key={result.promptId} 
                          className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden transition-all duration-200"
                        >
                          <button
                            onClick={() => setExpandedPromptId(expandedPromptId === result.promptId ? null : result.promptId)}
                            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-900/40 transition cursor-pointer"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-3">
                                <span className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-black">
                                  #{result.promptId}
                                </span>
                                <h4 className="text-sm font-bold text-slate-100">{result.topic}</h4>
                              </div>
                              <p className="text-xs text-slate-400 max-w-2xl">{result.guideline}</p>
                            </div>

                            <div className="flex items-center space-x-4">
                              <div className="flex space-x-2 text-[10px] font-mono">
                                <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-md flex items-center space-x-1">
                                  <span>Gemini:</span>
                                  <span className={result.gemini.passed ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                    {result.gemini.passed ? "PASS" : "FAIL"}
                                  </span>
                                </span>
                                <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-md flex items-center space-x-1">
                                  <span>Qwen:</span>
                                  <span className={result.qwen.passed ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                    {result.qwen.passed ? "PASS" : "FAIL"}
                                  </span>
                                </span>
                              </div>
                              {expandedPromptId === result.promptId ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {expandedPromptId === result.promptId && (
                            <div className="border-t border-slate-900 bg-slate-950/80 p-5 space-y-4 font-sans">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/60 px-2 py-0.5 rounded uppercase font-black">
                                      Gemini Code & Audit
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500">{result.gemini.latency}ms</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
                                    <span className={`p-1.5 rounded-md ${result.gemini.whitelist ? 'bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'}`}>
                                      Whitelist: {result.gemini.whitelist ? "PASS" : "FAIL"}
                                    </span>
                                    <span className={`p-1.5 rounded-md ${result.gemini.compile ? 'bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'}`}>
                                      GCC: {result.gemini.compile ? "PASS" : "FAIL"}
                                    </span>
                                    <span className={`p-1.5 rounded-md ${result.gemini.asan ? 'bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'}`}>
                                      ASan: {result.gemini.asan ? "PASS" : "FAIL"}
                                    </span>
                                  </div>
                                  <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-300 border border-emerald-950 overflow-x-auto">
                                    <code>{result.gemini.code}</code>
                                  </pre>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-purple-400 bg-purple-950/30 border border-purple-900/60 px-2 py-0.5 rounded uppercase font-black">
                                      Qwen Code & Audit
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500">{result.qwen.latency}ms</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
                                    <span className={`p-1.5 rounded-md ${result.qwen.whitelist ? 'bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'}`}>
                                      Whitelist: {result.qwen.whitelist ? "PASS" : "FAIL"}
                                    </span>
                                    <span className={`p-1.5 rounded-md ${result.qwen.compile ? 'bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'}`}>
                                      GCC: {result.qwen.compile ? "PASS" : "FAIL"}
                                    </span>
                                    <span className={`p-1.5 rounded-md ${result.qwen.asan ? 'bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'}`}>
                                      ASan: {result.qwen.asan ? "PASS" : "FAIL"}
                                    </span>
                                  </div>
                                  <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-purple-300 border border-purple-950 overflow-x-auto">
                                    <code>{result.qwen.code}</code>
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SYSTEM CONFIG ==================== */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Settings className="w-5 h-5 text-purple-400" />
              <span>Sovereign Cognitive Engine Controller</span>
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Configure active LLM backends, save API credentials securely using our encrypted DB store, and customize task routing overrides to balance performance, latency, and token cost.
            </p>

            {configError && (
              <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 flex items-start space-x-3 text-right" dir="rtl">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 ml-3" />
                <div className="space-y-1">
                  <span className="font-semibold text-rose-300 text-xs uppercase block">هەڵەی ڕێکخستن | Configuration Error</span>
                  <p className="text-xs text-rose-200">{configError}</p>
                </div>
              </div>
            )}

            {saveSuccess && (
              <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-xl p-4 text-emerald-400 text-xs font-mono text-right" dir="rtl">
                ✓ ڕێکخستنەکان بە سەرکەوتوویی لە بنکەی دراوە پاشەکەوت کران و لەسەر سێرڤەرەکە چالاك کران.
              </div>
            )}

            {loadingConfig ? (
              <div className="py-12 text-center text-slate-400 text-xs font-mono">
                Loading database configurations...
              </div>
            ) : config ? (
              <form onSubmit={handleSaveConfig} className="space-y-6">
                
                {/* Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold text-slate-300 uppercase block">ACTIVE COGNITIVE ENGINE PROVIDER</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, mode: 'gemini' })}
                      className={`p-4 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        config.mode === 'gemini'
                          ? 'border-emerald-500 bg-emerald-950/20 text-emerald-200'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Cpu className="w-5 h-5 text-emerald-400 mb-2" />
                      <span className="text-sm font-extrabold block">Google Gemini</span>
                      <span className="text-[11px] text-slate-400 mt-1">High-quality native multi-modal host with search grounding capabilities.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, mode: 'deepseek' })}
                      className={`p-4 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        config.mode === 'deepseek'
                          ? 'border-blue-500 bg-blue-950/20 text-blue-200'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Zap className="w-5 h-5 text-blue-400 mb-2" />
                      <span className="text-sm font-extrabold block">DeepSeek-V3 (API)</span>
                      <span className="text-[11px] text-slate-400 mt-1">Independent OpenAI-compatible engine with exceptional coding and logic.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, mode: 'self_hosted' })}
                      className={`p-4 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        config.mode === 'self_hosted'
                          ? 'border-purple-500 bg-purple-950/20 text-purple-200'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Server className="w-5 h-5 text-purple-400 mb-2" />
                      <span className="text-sm font-extrabold block">Self-Hosted (Ollama)</span>
                      <span className="text-[11px] text-slate-400 mt-1">Upgraded local Qwen2.5-Coder-32B running direct quantitative loops.</span>
                    </button>
                  </div>
                </div>

                {/* API Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-850 pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase block">DeepSeek API Secret Key</label>
                    <input
                      type="password"
                      placeholder={config.deepseekApiKeyConfigured ? "••••••••••••••••" : "Enter deepseek API key"}
                      value={deepseekApiKey}
                      onChange={(e) => setDeepseekApiKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm font-mono focus:border-purple-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">
                      Saved securely inside the `llm_provider_config` table using encrypted AES backstops.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase block">Self-Hosted Ollama URL</label>
                    <input
                      type="text"
                      value={config.selfHostedUrl}
                      onChange={(e) => setConfig({ ...config, selfHostedUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm font-mono focus:border-purple-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">
                      Standard OpenAI compatible endpoint (defaults to local Ollama /v1 context).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-slate-300 uppercase block">Self-Hosted Model Name</label>
                    <input
                      type="text"
                      value={config.selfHostedModelName}
                      onChange={(e) => setConfig({ ...config, selfHostedModelName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2 flex flex-col justify-end">
                    <div className="flex items-center space-x-3 bg-slate-950/60 border border-slate-850 p-4 rounded-xl">
                      <input
                        type="checkbox"
                        id="enablePolicyRouting"
                        checked={config.enablePolicyRouting}
                        onChange={(e) => setConfig({ ...config, enablePolicyRouting: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950"
                      />
                      <label htmlFor="enablePolicyRouting" className="text-xs font-mono font-bold text-slate-200 cursor-pointer select-none">
                        ENABLE TASK-SPECIFIC POLICY ROUTING
                      </label>
                    </div>
                  </div>
                </div>

                {/* Dynamic Task-Routing Configuration */}
                {config.enablePolicyRouting && (
                  <div className="border-t border-slate-850 pt-4 space-y-4">
                    <div className="flex items-center space-x-2">
                      <ListFilter className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-sm font-bold text-slate-200 font-mono uppercase">Dynamic Task-Routing Matrix Overrides</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* routine_parameter_tuning */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Routine Parameter Tuning</span>
                        <select
                          value={config.routingPolicy.routine_parameter_tuning}
                          onChange={(e) => handleRoutingPolicyChange('routine_parameter_tuning', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                        >
                          <option value="gemini">Gemini</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="self_hosted">Self-Hosted</option>
                        </select>
                      </div>

                      {/* complex_multi_signal_synthesis */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Complex Signal Synthesis</span>
                        <select
                          value={config.routingPolicy.complex_multi_signal_synthesis}
                          onChange={(e) => handleRoutingPolicyChange('complex_multi_signal_synthesis', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                        >
                          <option value="gemini">Gemini</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="self_hosted">Self-Hosted</option>
                        </select>
                      </div>

                      {/* tier_2_fallback */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Tier-2 Fallback Summaries</span>
                        <select
                          value={config.routingPolicy.tier_2_fallback}
                          onChange={(e) => handleRoutingPolicyChange('tier_2_fallback', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                        >
                          <option value="gemini">Gemini</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="self_hosted">Self-Hosted</option>
                        </select>
                      </div>

                      {/* deep_research */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Academic Deep Research</span>
                        <select
                          value={config.routingPolicy.deep_research}
                          onChange={(e) => handleRoutingPolicyChange('deep_research', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                        >
                          <option value="gemini">Gemini</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="self_hosted">Self-Hosted</option>
                        </select>
                      </div>

                      {/* general */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">General System Operations</span>
                        <select
                          value={config.routingPolicy.general}
                          onChange={(e) => handleRoutingPolicyChange('general', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                        >
                          <option value="gemini">Gemini</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="self_hosted">Self-Hosted</option>
                        </select>
                      </div>
                    </div>

                    {/* policyReasoning */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono font-bold text-slate-300 uppercase block">Active Routing Policy Reasoning</label>
                      <textarea
                        value={config.policyReasoning}
                        onChange={(e) => setConfig({ ...config, policyReasoning: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs font-sans focus:border-purple-500 focus:outline-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end border-t border-slate-850 pt-4">
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-mono font-extrabold text-slate-100 flex items-center space-x-2 transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>SAVE CONFIG & ROUTING</span>
                  </button>
                </div>

              </form>
            ) : null}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: COSTS & LOGS ==================== */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gemini Usage summary */}
            {(() => {
              const gemSummary = usageSummary.find(s => s.provider === 'gemini') || { promptTokens: '0', completionTokens: '0', cost: '0', callCount: '0' };
              return (
                <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">GEMINI ACCRUAL</span>
                    <Cpu className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-2xl font-black font-mono text-slate-200">${parseFloat(gemSummary.cost).toFixed(5)}</span>
                    <span className="block text-[10px] font-mono text-slate-500 uppercase">Total Estimated API Cost</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-850">
                    <div>Calls: <span className="text-slate-200 font-bold">{gemSummary.callCount}</span></div>
                    <div>Tokens: <span className="text-slate-200 font-bold">{parseInt(gemSummary.promptTokens) + parseInt(gemSummary.completionTokens)}</span></div>
                  </div>
                </div>
              );
            })()}

            {/* DeepSeek Usage summary */}
            {(() => {
              const dsSummary = usageSummary.find(s => s.provider === 'deepseek') || { promptTokens: '0', completionTokens: '0', cost: '0', callCount: '0' };
              return (
                <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/40">DEEPSEEK ACCRUAL</span>
                    <Zap className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-2xl font-black font-mono text-slate-200">${parseFloat(dsSummary.cost).toFixed(5)}</span>
                    <span className="block text-[10px] font-mono text-slate-500 uppercase">Total Estimated API Cost</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-850">
                    <div>Calls: <span className="text-slate-200 font-bold">{dsSummary.callCount}</span></div>
                    <div>Tokens: <span className="text-slate-200 font-bold">{parseInt(dsSummary.promptTokens) + parseInt(dsSummary.completionTokens)}</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Self hosted Usage summary */}
            {(() => {
              const shSummary = usageSummary.find(s => s.provider === 'self_hosted') || { promptTokens: '0', completionTokens: '0', cost: '0', callCount: '0' };
              return (
                <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/40">SELF-HOSTED ACCRUAL</span>
                    <Server className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-2xl font-black font-mono text-slate-200">${parseFloat(shSummary.cost).toFixed(5)}</span>
                    <span className="block text-[10px] font-mono text-slate-500 uppercase">Total Estimated API Cost</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-850">
                    <div>Calls: <span className="text-slate-200 font-bold">{shSummary.callCount}</span></div>
                    <div>Tokens: <span className="text-slate-200 font-bold">{parseInt(shSummary.promptTokens) + parseInt(shSummary.completionTokens)}</span></div>
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Usage Log List */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-slate-400" />
              <span>Real-Time Cognitive Provider Usage Logs (Last 100 Calls)</span>
            </h3>

            {loadingUsage ? (
              <div className="py-12 text-center text-slate-400 text-xs font-mono">
                Loading database logs stream...
              </div>
            ) : usageLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-mono">
                No cognitive calls have been logged yet. Activating agents will write logs here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Model</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Tokens (P / C)</th>
                      <th className="py-3 px-4">Cost ($)</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-900 text-slate-300 hover:bg-slate-900/20">
                        <td className="py-3 px-4 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded font-black ${
                            log.provider === 'gemini' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' :
                            log.provider === 'deepseek' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/40' :
                            'bg-purple-950/40 text-purple-400 border border-purple-900/40'
                          }`}>
                            {log.provider.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{log.model}</td>
                        <td className="py-3 px-4 text-slate-400">{log.taskCategory}</td>
                        <td className="py-3 px-4 text-slate-400">{log.promptTokens} / {log.completionTokens}</td>
                        <td className="py-3 px-4 text-slate-200 font-bold">${parseFloat(log.cost).toFixed(5)}</td>
                        <td className="py-3 px-4">
                          <span className={log.status === 'success' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
