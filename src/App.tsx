/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Cpu, Shuffle, Target, ShieldAlert, Sliders, Zap, Activity, Info, ShieldCheck, Brain, Award, BarChart3, ArrowUpDown } from 'lucide-react';
import ArchitectureMap from './components/ArchitectureMap';
import RewardPlayground from './components/RewardPlayground';
import TelemetrySimulator from './components/TelemetrySimulator';
import EvolutionLab from './components/EvolutionLab';
import RiskBrokerManager from './components/RiskBrokerManager';
import AlienBrainLab from './components/AlienBrainLab';
import BacktestArena from './components/BacktestArena';
import AIPilotLab from './components/AIPilotLab';
import SelfImprovementDashboard from './components/SelfImprovementDashboard';
import ArbitragePanel from './components/ArbitragePanel';
import SafetyBackstopPanel from './components/SafetyBackstopPanel';
import { EvolutionCandidate } from './types/quant';

type TabId = 'architecture' | 'telemetry' | 'evolution' | 'risk-broker' | 'alien-brain' | 'reward-playground' | 'backtest-arena' | 'ai-pilot-lab' | 'self-improvement-log' | 'arbitrage' | 'safety-backstop';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('architecture');
  const [emergencyFrozen, setEmergencyFrozen] = useState<boolean>(false);
  const [sandboxError, setSandboxError] = useState<{ title: string; message: string; metrics?: any } | null>(null);
  const [candidates, setCandidates] = useState<EvolutionCandidate[]>(() => {
    const saved = localStorage.getItem('SOVEREIGN_EVO_CANDIDATES');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'candidate-a',
        name: 'Reward Candidate #0412: Latency Optimized Sniper',
        creator: 'AGENT_GEN_V2',
        status: 'IDLE',
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
  });

  const [selectedId, setSelectedId] = useState<string>(() => {
    return localStorage.getItem('SOVEREIGN_SELECTED_CANDIDATE_ID') || 'candidate-a';
  });

  // Load initial state from backend server, keep synchronized with client actions
  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const response = await fetch('/api/candidates');
        if (response.ok) {
          const data = await response.json();
          setCandidates(data.candidates);
          setSelectedId(data.activeCandidateId);
        }
      } catch (err) {
        console.warn('Error syncing candidates from server (expected during startup/restart):', err);
      }
    };
    fetchInitialState();

    // Also poll telemetry periodically to sync emergency stop status!
    const syncStatus = async () => {
      try {
        const response = await fetch('/api/telemetry');
        if (response.ok) {
          const data = await response.json();
          setEmergencyFrozen(data.systemStatus === 'EMERGENCY_HALT');
        }
      } catch (err) {
        console.warn('Status sync error (expected during startup/restart):', err);
      }
    };
    const statusInterval = setInterval(syncStatus, 1500);
    return () => clearInterval(statusInterval);
  }, []);

  // Hook selections to write directly to server
  const handleSelectCandidateId = async (id: string) => {
    setSelectedId(id);
    localStorage.setItem('SOVEREIGN_SELECTED_CANDIDATE_ID', id);
    try {
      await fetch('/api/candidates/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (err) {
      console.error('Error selecting candidate on server:', err);
    }
  };

  const handleUpdateCandidates = async (value: EvolutionCandidate[] | ((prev: EvolutionCandidate[]) => EvolutionCandidate[])) => {
    let newCands: EvolutionCandidate[] = [];
    if (typeof value === 'function') {
      newCands = value(candidates);
    } else {
      newCands = value;
    }
    setCandidates(newCands);
    localStorage.setItem('SOVEREIGN_EVO_CANDIDATES', JSON.stringify(newCands));

    // Detect if any candidate is new, and adopt it on server-side
    const added = newCands.filter(nc => !candidates.some(c => c.id === nc.id));
    for (const cand of added) {
      try {
        const response = await fetch('/api/candidates/adopt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cand)
        });
        
        if (!response.ok) {
          const errData = await response.json();
          setSandboxError({
            title: `C++ Code Promotion Blocked`,
            message: errData.rejectionReason || errData.error || "Candidate did not clear sandbox verification rules.",
            metrics: errData.metrics
          });
          // Remove failed candidate from local client state
          setCandidates(prev => prev.filter(c => c.id !== cand.id));
        } else {
          setSandboxError(null);
        }
      } catch (err: any) {
        console.error('Error adopting candidate on server:', err);
        setSandboxError({
          title: "Connection / Sandbox Error",
          message: err.message || "Failed to reach the server sandbox pipeline."
        });
      }
    }
  };

  return (
    <div id="quant-app-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30">
      
      {/* Top Professional Header Bar */}
      <header id="quant-header" className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-emerald-400 shadow-md shadow-emerald-950/40">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">SOVEREIGN V2.4</span>
              <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">ئۆتۆماتیکی نیشتمانی</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-50">Sovereign FX Trading Bot</h1>
            <p className="text-xs text-slate-400 font-sans">بۆتی بازرگانی خودکار، جێبەجێکردنی کەرنەڵی C++ و لێکدانەوەی لایڤی کاندیدەکان</p>
          </div>
        </div>

        {/* Real-time status tags & Emergency Button */}
        <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
          {/* Real-time status tags for authentic quant feel */}
          <div id="header-status-grid" className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-slate-900/60 border border-slate-800 p-1.5 px-2 rounded flex flex-col min-w-[100px]">
              <span className="text-slate-500 uppercase font-bold">کلیلی HSM پارێزراو</span>
              <span className="text-emerald-400 font-black mt-0.5 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                SECURE
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-1.5 px-2 rounded flex flex-col min-w-[100px]">
              <span className="text-slate-500 uppercase font-bold">پەرەپێدانی خودکار</span>
              <span className={emergencyFrozen ? "text-rose-500 font-black mt-0.5 flex items-center" : "text-purple-400 font-black mt-0.5 flex items-center"}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${emergencyFrozen ? 'bg-rose-500' : 'bg-purple-500 animate-ping'}`}></span>
                {emergencyFrozen ? 'OFFLINE' : 'AUTOPILOT'}
              </span>
            </div>
          </div>

          {/* Global Emergency Stop Button (دوگمەی ئێمرجنسی) */}
          <button
            onClick={() => setEmergencyFrozen(!emergencyFrozen)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              emergencyFrozen
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 animate-pulse shadow-md shadow-rose-950/50'
                : 'bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border-rose-900/40'
            }`}
          >
            <ShieldAlert className={`w-4 h-4 shrink-0 ${emergencyFrozen ? 'animate-bounce' : ''}`} />
            <div className="text-right" dir="rtl">
              <span className="block text-[8px] text-slate-400">باری فریاگوزاری</span>
              <span className="block text-[11px] font-black">{emergencyFrozen ? 'سیستەم ڕاگیراوە 🛑' : 'دوگمەی ئێمرجنسی'}</span>
            </div>
          </button>
        </div>
      </header>

      {/* Main navigation tabs */}
      <nav id="quant-tabs-navigation" className="bg-[#050914] border-b border-slate-900 px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
          
          {/* Tab 1: Architecture Blueprint */}
          <button
            id="tab-btn-architecture"
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-sm'
                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>01. تەلارسازی سیستەم | Architecture Blueprint</span>
          </button>

          {/* Tab 2: Telemetry */}
          <button
            id="tab-btn-telemetry"
            onClick={() => setActiveTab('telemetry')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'telemetry'
                ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-sm'
                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0 text-sky-400" />
            <span>02. چاودێری و لۆگ | Live Telemetry & Logs</span>
          </button>

          {/* Tab 3: Evolution */}
          <button
            id="tab-btn-evolution"
            onClick={() => setActiveTab('evolution')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'evolution'
                ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-sm'
                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>03. تاقیگەی گەشەکردن | AI Sandbox</span>
          </button>

          {/* New Tab: Professor AI Co-Pilot & Swarm Arbitrage */}
          <button
            id="tab-btn-ai-pilot-lab"
            onClick={() => setActiveTab('ai-pilot-lab')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ai-pilot-lab'
                ? 'bg-slate-900 border-purple-800 text-purple-200 shadow-sm'
                : 'bg-transparent border-transparent text-purple-400 hover:text-purple-300'
            }`}
          >
            <Brain className="w-4 h-4 shrink-0 text-purple-400 animate-pulse" />
            <span className="text-purple-300 font-bold">★ پڕۆفیسۆری ژیری و ئاڵوگۆڕ | AI Co-Pilot & Swarm</span>
          </button>

          {/* Tab 4: Risk & Broker Connection */}
          <button
            id="tab-btn-risk-broker"
            onClick={() => setActiveTab('risk-broker')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'risk-broker'
                ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-sm'
                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400" />
            <span>04. مەترسی و بڕۆکەر | Risk & Broker</span>
          </button>

          {/* Tab 5: Alien Brain Advanced Modes */}
          <button
            id="tab-btn-alien-brain"
            onClick={() => setActiveTab('alien-brain')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'alien-brain'
                ? 'bg-slate-900 border-purple-800 text-purple-200 shadow-sm shadow-purple-950/20'
                : 'bg-transparent border-transparent text-purple-400 hover:text-purple-200'
            }`}
          >
            <Brain className="w-4 h-4 shrink-0 text-purple-400" />
            <span>05. مۆدەکانی دەماری | Neural & API Keys</span>
          </button>

          {/* Tab 6: Reward Playground */}
          <button
            id="tab-btn-reward-playground"
            onClick={() => setActiveTab('reward-playground')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'reward-playground'
                ? 'bg-slate-900 border-amber-800 text-amber-200 shadow-sm shadow-amber-950/20'
                : 'bg-transparent border-transparent text-amber-400 hover:text-amber-200'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0 text-amber-400" />
            <span>06. تاقیگەی هاوکێشە | C++ Reward Playground</span>
          </button>

          {/* Tab 7: Backtest Arena */}
          <button
            id="tab-btn-backtest-arena"
            onClick={() => setActiveTab('backtest-arena')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'backtest-arena'
                ? 'bg-slate-900 border-emerald-800 text-emerald-200 shadow-sm shadow-emerald-950/20'
                : 'bg-transparent border-transparent text-emerald-400 hover:text-emerald-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>07. مەیدانی باکتێست | Backtest Arena</span>
          </button>

          {/* Tab 8: Self-Improvement Logs */}
          <button
            id="tab-btn-self-improvement-log"
            onClick={() => setActiveTab('self-improvement-log')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'self-improvement-log'
                ? 'bg-slate-900 border-purple-800 text-purple-200 shadow-sm shadow-purple-950/20'
                : 'bg-transparent border-transparent text-purple-400 hover:text-purple-300'
            }`}
          >
            <Brain className="w-4 h-4 shrink-0 text-purple-400 animate-pulse" />
            <span className="font-bold">08. خۆباشکردنی سەربەخۆ | Self-Improvement Logs</span>
          </button>

          {/* Tab 9: Cross-Exchange Arbitrage */}
          <button
            id="tab-btn-arbitrage"
            onClick={() => setActiveTab('arbitrage')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'arbitrage'
                ? 'bg-slate-900 border-purple-800 text-purple-200 shadow-sm shadow-purple-950/20'
                : 'bg-transparent border-transparent text-purple-400 hover:text-purple-300'
            }`}
          >
            <ArrowUpDown className="w-4 h-4 shrink-0 text-purple-400 animate-pulse" />
            <span className="font-bold">09. ئاربیتراژ و ناڕێکی بازاڕ | Cross-Exchange Arbitrage</span>
          </button>

          {/* Tab 10: Unbypassable Safety Backstop */}
          <button
            id="tab-btn-safety-backstop"
            onClick={() => setActiveTab('safety-backstop')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'safety-backstop'
                ? 'bg-slate-900 border-rose-800 text-rose-200 shadow-sm shadow-rose-950/20'
                : 'bg-transparent border-transparent text-rose-400 hover:text-rose-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 animate-pulse" />
            <span className="font-bold">10. لایەری پاراستنی نێکسەس | NEXUS Safety Backstop</span>
          </button>

        </div>
      </nav>

      {/* Main Container workspace */}
      <main id="quant-main-workspace" className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Emergency Halt Banner */}
        {emergencyFrozen ? (
          <div id="emergency-lockdown-banner" className="p-5 bg-rose-950/40 border-2 border-rose-500/80 rounded-xl text-right animate-pulse space-y-3 shadow-lg shadow-rose-950/40" dir="rtl">
            <div className="flex items-center gap-3 justify-end text-rose-200">
              <h3 className="text-base font-black">🚨 باری فریاگوزاری چالاکە - سیستەم ڕاگیراوە (EMERGENCY HALT ACTIVE)</h3>
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <p className="text-xs text-rose-300 leading-relaxed">
              هەموو کارە خۆکارەکان، فۆرمولە تاقیکارییەکان، ئۆپتیمایزکردنەکانی C++، و چالاکییەکانی بازرگانی کاتیی بە توندی قوفڵ کراون بۆ پاراستنی سەرجەم سەرمایەکان. تەنها زیادکردنی کلیلەکانی API و کۆنتڕۆڵی دوگمەی فریاگوزاری چالاکن.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setActiveTab('alien-brain')}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                بەڕێوەبردنی کلیلی بڕۆکەرەکان (Manage APIs)
              </button>
              <button
                onClick={() => setEmergencyFrozen(false)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                بڵاوکردنەوەی دۆخی ئاسایی (Disengage Emergency Lock)
              </button>
            </div>
          </div>
        ) : (
          /* Analytical Top Banner */
          <div id="analytical-banner" className="p-4 bg-gradient-to-r from-slate-900 to-[#0b101f] border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start space-x-3 shadow-md text-right" dir="rtl">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 ml-3" />
            <div className="leading-relaxed space-y-1">
              <span className="font-semibold text-slate-200 block">ژینگەی شیکاری سیستەمە سەربەخۆکانی بازرگانی (Sovereign Systems Analytics)</span>
              <p>
                ئەم بەشە نوێنەرایەتی ڕووکاری بازرگانی خۆکار دەکات. دەتوانیت لۆگەکانی چاودێری لایڤ، کاتی جێبەجێکردنی فۆرمولەی C++، یاساکانی بەستنەوەی بڕۆکەرەکان و مەترسییەکان دیاری بکەیت، هەروەها تاقیکردنەوەی تووند لەسەر داتای ڕابردووی بازار ئەنجام بدەیت.
              </p>
            </div>
          </div>
        )}

        {sandboxError && (
          <div id="sandbox-rejection-banner" className="p-5 bg-rose-950/45 border border-rose-500/50 rounded-xl text-right space-y-3 shadow-md shadow-rose-950/20" dir="rtl">
            <div className="flex justify-between items-center">
              <button 
                onClick={() => setSandboxError(null)} 
                className="text-rose-400 hover:text-rose-300 font-bold text-xs bg-slate-900 px-2 py-1 rounded"
              >
                ✕ داخستن
              </button>
              <div className="flex items-center gap-2 text-rose-300">
                <span className="font-bold text-sm">{sandboxError.title}</span>
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <p className="text-xs text-rose-200 leading-relaxed font-mono whitespace-pre-wrap">{sandboxError.message}</p>
            {sandboxError.metrics && (
              <div className="grid grid-cols-4 gap-3 text-center text-[10px] font-mono bg-slate-950 p-3 rounded border border-slate-900 mt-2">
                <div className="p-1">
                  <span className="text-slate-500 block">Sharpe Ratio</span>
                  <span className="text-rose-400 font-bold">{sandboxError.metrics.SharpeRatio ?? 'N/A'}</span>
                </div>
                <div className="p-1">
                  <span className="text-slate-500 block">Max Drawdown</span>
                  <span className="text-rose-400 font-bold">{sandboxError.metrics.maxDrawdown ?? 'N/A'}%</span>
                </div>
                <div className="p-1">
                  <span className="text-slate-500 block">Avg Reward</span>
                  <span className="text-rose-400 font-bold">{sandboxError.metrics.avgReward ?? 'N/A'}</span>
                </div>
                <div className="p-1">
                  <span className="text-slate-500 block">Trades Count</span>
                  <span className="text-rose-400 font-bold">{sandboxError.metrics.tradesCount ?? 'N/A'}</span>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-500 font-sans">
              * یاسای برۆمۆشن گەیتی سانبۆکس: Sharpe Ratio &gt;= 1.2، لادان لە زیان &lt;= 5.0٪، و لانی کەم ١٠ تاقیکردنەوە. لۆگەکە بۆ هەمیشەیی لە دەیتابەیسی Postgres پاشەکەوت کرا.
            </p>
          </div>
        )}

        {/* Tab content switcher */}
        <div id="tab-content-container" className="transition-opacity duration-300">
          {activeTab === 'architecture' && <ArchitectureMap />}
          {activeTab === 'telemetry' && <TelemetrySimulator activeCandidateName={candidates.find(c => c.id === selectedId)?.name} />}
          {activeTab === 'evolution' && <EvolutionLab candidates={candidates} setCandidates={handleUpdateCandidates} selectedId={selectedId} setSelectedId={handleSelectCandidateId} />}
          {activeTab === 'risk-broker' && <RiskBrokerManager />}
          {activeTab === 'alien-brain' && <AlienBrainLab />}
          {activeTab === 'reward-playground' && <RewardPlayground />}
          {activeTab === 'backtest-arena' && <BacktestArena candidates={candidates} selectedCandidateId={selectedId} setSelectedCandidateId={handleSelectCandidateId} />}
          {activeTab === 'ai-pilot-lab' && <AIPilotLab candidates={candidates} setCandidates={handleUpdateCandidates} selectedId={selectedId} setSelectedId={handleSelectCandidateId} emergencyFrozen={emergencyFrozen} />}
          {activeTab === 'self-improvement-log' && <SelfImprovementDashboard />}
          {activeTab === 'arbitrage' && <ArbitragePanel />}
          {activeTab === 'safety-backstop' && <SafetyBackstopPanel />}
        </div>

      </main>

      {/* Footer bar */}
      <footer id="quant-footer" className="mt-auto border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-600 font-mono">
        <p>© 2026 Sovereign AI Algorithmic Trading Architectures. High-Frequency Direct DMA Execution. Safe Sandbox Environment.</p>
      </footer>

    </div>
  );
}
