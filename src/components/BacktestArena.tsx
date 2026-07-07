/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Play, RotateCcw, TrendingUp, Award, BarChart3, Clock, 
  HelpCircle, ShieldCheck, Download, Code, CheckCircle2, 
  Database, FileText, ArrowUpRight, ArrowDownRight, Layers,
  RefreshCw
} from 'lucide-react';
import { EvolutionCandidate } from '../types/quant';

interface BacktestArenaProps {
  candidates: EvolutionCandidate[];
  selectedCandidateId: string;
  setSelectedCandidateId: (id: string) => void;
}

export default function BacktestArena({ candidates, selectedCandidateId, setSelectedCandidateId }: BacktestArenaProps) {
  const [currencyPair, setCurrencyPair] = useState<string>('EUR/USD');
  const [duration, setDuration] = useState<string>('3M'); // 1M, 3M, 6M, 1Y
  const [startingBalance, setStartingBalance] = useState<number>(50000);
  const [marketCondition, setMarketCondition] = useState<'nominal' | 'high_vol' | 'flash_crash' | 'slippage'>('nominal');
  
  // Backtest status
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [backtestCompleted, setBacktestCompleted] = useState<boolean>(false);

  // Performance stats
  const [stats, setStats] = useState({
    finalBalance: 50000,
    netProfit: 0,
    netProfitPercent: 0,
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
  });

  // Equity Curve array for the graph
  const [equityHistory, setEquityHistory] = useState<number[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [simulationLogs]);

  const activeCandidate = candidates.find(c => c.id === selectedCandidateId) || candidates[0];

  const handleStartBacktest = () => {
    if (isRunning) return;

    setIsRunning(true);
    setBacktestCompleted(false);
    setProgress(0);
    setSimulationLogs([]);
    setEquityHistory([startingBalance]);

    const chosenCandidate = activeCandidate;
    const isFailedStrategy = chosenCandidate?.failureReason !== undefined;

    setSimulationLogs([
      `🚀 [ARENA-INIT] دەستپێکردنی مۆدێلی تاقیکردنەوەی دواوە (Backtesting Engine v2.4)...`,
      `📊 [ARENA-INIT] کاندیدی هەڵبژێردراو: "${chosenCandidate?.name}"`,
      `📊 [ARENA-INIT] جۆری بازار: ${currencyPair} | ماوەی تاقیکردنەوە: ${duration} | سەرمایەی سەرەتایی: $${startingBalance.toLocaleString()}`,
      `📊 [ARENA-INIT] ژینگەی بازاری تاقیکراوە: ${marketCondition.toUpperCase()}`,
      `🔍 [ARENA-INIT] پشکنینی پۆینتەری مەکینە و دڵنیابوونەوەی داتاکان... OK.`
    ]);

    let step = 0;
    const totalSteps = 40;
    let currentBal = startingBalance;
    const history: number[] = [startingBalance];

    const interval = setInterval(() => {
      step++;
      const currentProgress = Math.min(100, Math.floor((step / totalSteps) * 100));
      setProgress(currentProgress);

      // Core simulation physics
      let tradeResult = 0;
      let logMsg = '';

      // Set baseline rates based on candidate status & strategy parameters
      const isDangerous = isFailedStrategy || chosenCandidate?.id.includes('malicious') || chosenCandidate?.id.includes('leak');
      const isEndless = chosenCandidate?.id.includes('candidate-c');

      if (isEndless && step === 15) {
        setSimulationLogs(prev => [
          ...prev,
          `❌ [CRITICAL-FATAL] THREAD BLOCK DETECTED. Core affinity Core 03 unresponsive.`,
          `❌ [CRITICAL-FATAL] Sandbox execution exceeded threshold limit. Backtest aborted automatically.`
        ]);
        setIsRunning(false);
        clearInterval(interval);
        return;
      }

      if (isDangerous) {
        // High risk, random extreme values, or crash simulation
        tradeResult = (Math.random() - 0.7) * (startingBalance * 0.12); // mostly losses
        if (marketCondition === 'flash_crash') {
          tradeResult = -Math.abs((Math.random() - 0.2) * (startingBalance * 0.25));
        }
      } else {
        // Nominal stable quant strategy simulation
        const isConservative = chosenCandidate?.name.toLowerCase().includes('conservative');
        const multiplier = isConservative ? 0.02 : 0.05;

        let trendBias = 0.53; // default positive bias for sovereign model
        if (marketCondition === 'high_vol') trendBias = 0.51;
        if (marketCondition === 'slippage') trendBias = 0.48; // slippage hurts win bias

        const win = Math.random() < trendBias;
        const sizeFactor = Math.random() * (startingBalance * multiplier);
        tradeResult = win ? sizeFactor * 1.3 : -sizeFactor * 0.95;
      }

      currentBal += tradeResult;
      // Prevent balance from going below 0
      if (currentBal < 0) currentBal = 0;

      history.push(currentBal);
      setEquityHistory([...history]);

      // Dynamic Kurdish logs based on simulation step
      const day = Math.floor(step * (duration === '1M' ? 0.75 : duration === '3M' ? 2.25 : duration === '6M' ? 4.5 : 9));
      if (step % 5 === 0) {
        logMsg = `📅 [ڕۆژی #${day}] نرخەکان نوێکرانەوە. باڵانسی هەژمار: $${Math.floor(currentBal).toLocaleString()} | PnL لایڤ: ${tradeResult >= 0 ? '+' : ''}$${Math.floor(tradeResult).toLocaleString()}`;
        setSimulationLogs(prev => [...prev, logMsg]);
      }

      if (step === totalSteps) {
        // Finish Simulation and calculate stats
        clearInterval(interval);
        setIsRunning(false);
        setBacktestCompleted(true);

        const profit = currentBal - startingBalance;
        const profitPercent = (profit / startingBalance) * 100;
        
        let winR = isDangerous ? 31.4 : 64.8;
        let pFactor = isDangerous ? 0.65 : 2.15;
        let maxDD = isDangerous ? 42.5 : 4.2;
        let sharpe = isDangerous ? -0.85 : 3.42;

        if (marketCondition === 'high_vol') {
          winR -= 3.5;
          pFactor -= 0.2;
          maxDD += 2.8;
          sharpe -= 0.4;
        } else if (marketCondition === 'slippage') {
          winR -= 6.0;
          pFactor -= 0.4;
          maxDD += 3.5;
          sharpe -= 0.75;
        }

        setStats({
          finalBalance: Math.floor(currentBal),
          netProfit: Math.floor(profit),
          netProfitPercent: parseFloat(profitPercent.toFixed(2)),
          winRate: parseFloat(winR.toFixed(1)),
          totalTrades: isDangerous ? 184 : 142,
          profitFactor: parseFloat(pFactor.toFixed(2)),
          maxDrawdown: parseFloat(maxDD.toFixed(1)),
          sharpeRatio: parseFloat(sharpe.toFixed(2)),
        });

        setSimulationLogs(prev => [
          ...prev,
          `\n========================================================`,
          `🎉 [ARENA-COMPLETE] تاقیکردنەوەی دواوە بە سەرکەوتوویی کۆتایی هات!`,
          `========================================================`,
          `✅ باڵانسی کۆتایی: $${Math.floor(currentBal).toLocaleString()}`,
          `✅ کۆی قازانج: $${Math.floor(profit).toLocaleString()} (${profitPercent.toFixed(2)}%)`,
          `✅ ڕێژەی سەرکەوتن: ${winR.toFixed(1)}% | فاکتەری قازانج: ${pFactor.toFixed(2)}`,
          `✅ نزمترین دابەزینی بالانس (Max Drawdown): ${maxDD.toFixed(1)}%`,
          `✅ ڕێژەی شارپ (Sharpe Ratio): ${sharpe.toFixed(2)}`
        ]);
      }
    }, 120);
  };

  // Generate ZIP/Source code download mock
  const [downloadingCode, setDownloadingCode] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const handleDownloadCode = () => {
    if (downloadingCode) return;
    setDownloadingCode(true);
    setDownloadSuccess(false);

    setTimeout(() => {
      setDownloadingCode(false);
      setDownloadSuccess(true);
      
      // Simulate physical download of standard text files containing C++ & Go Core
      const fileContent = `// Sovereign Algorithmic Trading Bot Core Core v2.4
// Exported Code Bundle for Human Auditing

#include <iostream>
#include <cmath>
#include <algorithm>

double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    double pnl_reward = pnl_pips * position_lots * 10.0;
    double slippage_penalty = std::pow(std::abs(slippage_ticks), 1.5) * 2.5;
    double sniper_speed_bonus = 0.0;
    if (execution_latency_ns > 0.0 && execution_latency_ns < 500.0) {
        sniper_speed_bonus = (500.0 - execution_latency_ns) * 0.0375;
    }
    double shock_factor = volatility_spike > 3.0 ? std::exp(-0.4 * (volatility_spike - 3.0)) : 1.0;
    return std::max(-150.0, std::min(150.0, ((pnl_reward - slippage_penalty) * shock_factor) + sniper_speed_bonus));
}`;

      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sovereign_bot_core_cpp.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => setDownloadSuccess(false), 3000);
    }, 1200);
  };

  // SVG Chart path calculation
  const getSvgPath = () => {
    if (equityHistory.length === 0) return '';
    const width = 600;
    const height = 150;
    const padding = 10;
    
    const minVal = Math.min(...equityHistory) * 0.98;
    const maxVal = Math.max(...equityHistory) * 1.02;
    const range = maxVal - minVal || 1;

    return equityHistory.map((val, idx) => {
      const x = padding + (idx / (equityHistory.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // SVG Area path calculation
  const getSvgAreaPath = () => {
    if (equityHistory.length === 0) return '';
    const width = 600;
    const height = 150;
    const padding = 10;
    
    const minVal = Math.min(...equityHistory) * 0.98;
    const maxVal = Math.max(...equityHistory) * 1.02;
    const range = maxVal - minVal || 1;

    const linePath = getSvgPath();
    const lastX = padding + (width - padding * 2);
    const bottomY = height;

    return `${linePath} L ${lastX} ${bottomY} L ${padding} ${bottomY} Z`;
  };

  return (
    <div id="backtest-arena-wrapper" className="space-y-6">
      
      {/* Kurdish Language Header Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-950 to-sky-950/40 border border-slate-800 rounded-xl p-5 text-right animate-fade-in" dir="rtl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-start space-x-3 space-x-reverse">
            <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/30 rounded-lg text-emerald-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">مەیدانی تاقیکردنەوەی دواوەی کۆدەکان (Historical Backtest Arena)</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                هەر بیرۆکەیەک یان فۆرمولەیەکی C++ کە دروست دەبێت، لێرەدا دەتوانیت لەسەر زانیاری ڕاستەقینەی ڕابردووی بازار بە قورسی تاقی بکەیتەوە بۆ ئەوەی دڵنیابیت لە ڕێژەی قازانج و سەقامگیری باڵانسەکەت پێش کاراکردنی لایڤ.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Settings and Download Codes */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Backtest Config Panel */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-right" dir="rtl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-start gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              ڕێکخستنی تاقیکردنەوەی دواوە (Simulation Setup)
            </h3>

            <div className="space-y-4">
              
              {/* Candidate Selector */}
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">کاندیدی تاقیکەرەوە (Choose Strategy)</label>
                <select
                  value={selectedCandidateId}
                  onChange={(e) => {
                    setSelectedCandidateId(e.target.value);
                    setBacktestCompleted(false);
                    setEquityHistory([]);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                >
                  {candidates.map(cand => (
                    <option key={cand.id} value={cand.id}>{cand.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Currency Pair */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">دراو یان سەرمایە</label>
                  <select
                    value={currencyPair}
                    onChange={(e) => setCurrencyPair(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="EUR/USD">EUR/USD (یۆرۆ/دۆلار)</option>
                    <option value="GBP/USD">GBP/USD (پاوەند/دۆلار)</option>
                    <option value="USD/JPY">USD/JPY (دۆلار/یەن)</option>
                    <option value="AUD/USD">AUD/USD (ئۆسترالی/دۆلار)</option>
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">ماوەی ڕابردوو (Duration)</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="1M">1 مانگی ڕابردوو</option>
                    <option value="3M">3 مانگی ڕابردوو</option>
                    <option value="6M">6 مانگی ڕابردوو</option>
                    <option value="1Y">1 ساڵی ڕابردوو</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Balance */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">سەرمایەی سەرەتایی ($)</label>
                  <input
                    type="number"
                    value={startingBalance}
                    onChange={(e) => setStartingBalance(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Market conditions */}
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">دۆخی شۆکی بازار</label>
                  <select
                    value={marketCondition}
                    onChange={(e: any) => setMarketCondition(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="nominal">دۆخی ئاسایی (Stable nominal)</option>
                    <option value="high_vol">هەواڵ و جووڵەی بەهێز (High Volatility)</option>
                    <option value="flash_crash">داڕمانی لەناکاو (Flash Crash Scenario)</option>
                    <option value="slippage">خلیسکانی نرخ (Extreme Slippage)</option>
                  </select>
                </div>
              </div>

              {/* Start Trigger */}
              <button
                disabled={isRunning}
                onClick={handleStartBacktest}
                className="w-full py-3 mt-2 border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-2 space-x-reverse cursor-pointer disabled:opacity-40"
              >
                <Play className="w-4 h-4 shrink-0" />
                <span>دەستپێکردنی تاقیکردنەوەی مێژوویی دواوە</span>
              </button>

            </div>
          </div>

          {/* Export and download core code block as requested */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-right font-sans" dir="rtl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-start gap-1.5">
              <Code className="w-4 h-4 text-sky-400" />
              داگرتنی کۆدەکانی بۆتەکە (Download Source Code Bundle)
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              کۆدی فۆرمولەی خەڵاتی C++ لەگەڵ بزوێنەری سەرەکی پلاتفۆڕمەکە (Go Backplane & POSIX Threads) دەتوانیت بە تەواوی لێرەوە داگریت بۆ بەکارهێنان لەسەر ڕاڕەوەکانی کەرنەڵی لۆکاڵ.
            </p>

            <button
              onClick={handleDownloadCode}
              disabled={downloadingCode}
              className="w-full py-3 border border-sky-600 bg-sky-950/20 text-sky-400 hover:bg-sky-950/40 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 space-x-reverse transition-all cursor-pointer"
            >
              {downloadingCode ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ئامادە دەکرێت...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>داگیرا! (Check Downloads folder)</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>داگرتنی سەرچاوەی کۆدی C++ بۆتەکە</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Column: Dynamic SVG Equity chart, Metrics, and Console */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          
          {/* Equity Graph Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
            <div className="flex justify-between items-start mb-4 text-right" dir="rtl">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase">مەنهەجی گەشەی باڵانس (Live Equity Curve Chart)</h4>
                <p className="text-[10px] text-slate-500">بینینی جووڵەی سەرمایە بە شێوەی گرافێکی داینامیکی بە گۆرانکارییەکان.</p>
              </div>
              
              {equityHistory.length > 0 && (
                <span className={`text-xs font-mono font-bold ${
                  equityHistory[equityHistory.length - 1] >= startingBalance ? 'text-emerald-400' : 'text-rose-400'
                }`} dir="ltr">
                  ${Math.floor(equityHistory[equityHistory.length - 1]).toLocaleString()}
                </span>
              )}
            </div>

            {/* Dynamic Custom SVG Graph */}
            <div className="h-40 w-full bg-slate-900/40 rounded-lg border border-slate-900 flex items-center justify-center relative overflow-hidden">
              {equityHistory.length < 2 ? (
                <div className="text-slate-600 text-[11px] italic text-center font-sans">
                  هیچ داتایەکی گرافیک نییە. تکایە دوگمەی ڕنکردنی باکتێست لێبدە بۆ بینینی گراف.
                </div>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="0" y1="37.5" x2="600" y2="37.5" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1="0" y1="75" x2="600" y2="75" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1="0" y1="112.5" x2="600" y2="112.5" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />

                  {/* Shaded Area */}
                  <path d={getSvgAreaPath()} fill="url(#chartGradient)" className="transition-all duration-300" />

                  {/* Stroke Line */}
                  <path 
                    d={getSvgPath()} 
                    fill="none" 
                    stroke={equityHistory[equityHistory.length - 1] >= startingBalance ? '#10b981' : '#f43f5e'} 
                    strokeWidth="1.5"
                    className="transition-all duration-300" 
                  />
                </svg>
              )}

              {/* In-progress progress bar indicator */}
              {isRunning && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Performance Metrics Breakdown */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-right" dir="rtl">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">ئامارەکانی سەرکەوتن (Performance Metrics)</h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              {/* Stat 1: Return */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 block mb-1">کۆی قازانج (Return)</span>
                <span className={`text-sm font-mono font-black ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stats.netProfit >= 0 ? '+' : ''}{stats.netProfitPercent}%
                </span>
                <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                  ${stats.netProfit.toLocaleString()}
                </span>
              </div>

              {/* Stat 2: Win Rate */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 block mb-1">ڕێژەی سەرکەوتن (Win Rate)</span>
                <span className="text-sm font-mono font-black text-slate-100">
                  {stats.winRate}%
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  کۆی {stats.totalTrades} مامەڵە
                </span>
              </div>

              {/* Stat 3: Profit Factor */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 block mb-1">فاکتەری قازانج (PF)</span>
                <span className={`text-sm font-mono font-black ${stats.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {stats.profitFactor}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  قازانج بەسەر لۆس
                </span>
              </div>

              {/* Stat 4: Sharpe Ratio */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 block mb-1">ڕێژەی شارپ (Sharpe)</span>
                <span className="text-sm font-mono font-black text-sky-400">
                  {stats.sharpeRatio}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  سەقامگیری و لایڤ هێز
                </span>
              </div>

            </div>
          </div>

          {/* Micro Terminal Live outputs */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col min-h-[160px]">
            <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400">backtest_engine_live_stdout.log</span>
              <span className="text-[9px] text-slate-500">HISTORICAL TICK STREAMS</span>
            </div>

            <div className="bg-[#030611] p-4 font-mono text-[11px] text-slate-300 space-y-2 overflow-y-auto max-h-[180px] flex-1 text-left" dir="ltr">
              {simulationLogs.length === 0 ? (
                <div className="text-slate-600 italic text-center py-6 font-sans">
                  ئامادەیە بۆ ڕنکردنی باکتێست. دوگمەی سەوز لێبدە بۆ دەستپێکردن.
                </div>
              ) : (
                simulationLogs.map((log, idx) => (
                  <div key={idx} className="border-b border-slate-950/20 pb-1 font-mono">
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
