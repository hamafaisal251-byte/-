/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Cpu, Shuffle, Target, ShieldAlert, Sliders, Zap, Activity, Info, ShieldCheck, Brain, Award, BarChart3 } from 'lucide-react';
import ArchitectureMap from './components/ArchitectureMap';
import RewardPlayground from './components/RewardPlayground';
import TelemetrySimulator from './components/TelemetrySimulator';
import EvolutionLab from './components/EvolutionLab';
import RiskBrokerManager from './components/RiskBrokerManager';
import AlienBrainLab from './components/AlienBrainLab';
import BacktestArena from './components/BacktestArena';
import { EvolutionCandidate } from './types/quant';

type TabId = 'architecture' | 'telemetry' | 'evolution' | 'risk-broker' | 'alien-brain' | 'reward-playground' | 'backtest-arena';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('architecture');
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

  // Keep state synchronized with local storage actions
  useEffect(() => {
    const handleStorageChange = () => {
      const savedCands = localStorage.getItem('SOVEREIGN_EVO_CANDIDATES');
      const savedSel = localStorage.getItem('SOVEREIGN_SELECTED_CANDIDATE_ID');
      if (savedCands) {
        try {
          setCandidates(JSON.parse(savedCands));
        } catch (e) {}
      }
      if (savedSel) {
        setSelectedId(savedSel);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    // Initial fetch
    handleStorageChange();
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync state to local storage when changed locally
  useEffect(() => {
    localStorage.setItem('SOVEREIGN_EVO_CANDIDATES', JSON.stringify(candidates));
  }, [candidates]);

  useEffect(() => {
    localStorage.setItem('SOVEREIGN_SELECTED_CANDIDATE_ID', selectedId);
  }, [selectedId]);

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

        {/* Real-time status tags for authentic quant feel */}
        <div id="header-status-grid" className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
          <div className="bg-slate-900/60 border border-slate-800 p-2 rounded flex flex-col">
            <span className="text-slate-500 uppercase font-bold">کلیلی HSM پارێزراو</span>
            <span className="text-emerald-400 font-black mt-0.5 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              SECURE LOCK
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-2 rounded flex flex-col">
            <span className="text-slate-500 uppercase font-bold">بزوێنەری C++ SPSC</span>
            <span className="text-sky-400 font-black mt-0.5 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-1.5 animate-pulse"></span>
              CORE PINNED
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-2 rounded flex flex-col">
            <span className="text-slate-500 uppercase font-bold">چاودێری و پشکنین</span>
            <span className="text-purple-400 font-black mt-0.5 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5 animate-pulse"></span>
              NOMINAL
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-2 rounded flex flex-col">
            <span className="text-slate-500 uppercase font-bold">پەرەپێدانی خودکار</span>
            <span className="text-amber-400 font-black mt-0.5 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
              STANDBY
            </span>
          </div>
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

        </div>
      </nav>

      {/* Main Container workspace */}
      <main id="quant-main-workspace" className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Analytical Top Banner */}
        <div id="analytical-banner" className="p-4 bg-gradient-to-r from-slate-900 to-[#0b101f] border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start space-x-3 shadow-md text-right" dir="rtl">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 ml-3" />
          <div className="leading-relaxed space-y-1">
            <span className="font-semibold text-slate-200 block">ژینگەی شیکاری سیستەمە سەربەخۆکانی بازرگانی (Sovereign Systems Analytics)</span>
            <p>
              ئەم بەشە نوێنەرایەتی ڕووکاری بازرگانی خۆکار دەکات. دەتوانیت لۆگەکانی چاودێری لایڤ، کاتی جێبەجێکردنی فۆرمولەی C++، یاساکانی بەستنەوەی بڕۆکەرەکان و مەترسییەکان دیاری بکەیت، هەروەها تاقیکردنەوەی تووند لەسەر داتای ڕابردووی بازار ئەنجام بدەیت.
            </p>
          </div>
        </div>

        {/* Tab content switcher */}
        <div id="tab-content-container" className="transition-opacity duration-300">
          {activeTab === 'architecture' && <ArchitectureMap />}
          {activeTab === 'telemetry' && <TelemetrySimulator activeCandidateName={candidates.find(c => c.id === selectedId)?.name} />}
          {activeTab === 'evolution' && <EvolutionLab candidates={candidates} setCandidates={setCandidates} selectedId={selectedId} setSelectedId={setSelectedId} />}
          {activeTab === 'risk-broker' && <RiskBrokerManager />}
          {activeTab === 'alien-brain' && <AlienBrainLab />}
          {activeTab === 'reward-playground' && <RewardPlayground />}
          {activeTab === 'backtest-arena' && <BacktestArena candidates={candidates} selectedCandidateId={selectedId} setSelectedCandidateId={setSelectedId} />}
        </div>

      </main>

      {/* Footer bar */}
      <footer id="quant-footer" className="mt-auto border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-600 font-mono">
        <p>© 2026 Sovereign AI Algorithmic Trading Architectures. High-Frequency Direct DMA Execution. Safe Sandbox Environment.</p>
      </footer>

    </div>
  );
}
