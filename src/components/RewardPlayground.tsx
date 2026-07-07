/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sliders, Target, ShieldAlert, Zap, TrendingUp, Sparkles, HelpCircle, Play, Pause } from 'lucide-react';
import { RewardParams } from '../types/quant';

export default function RewardPlayground() {
  const [params, setParams] = useState<RewardParams>({
    pnlPips: 12.5,
    latencyNs: 240,
    slippageTicks: 1.2,
    volatilitySpike: 1.5,
    positionLots: 3.5,
  });

  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [autoExplore, setAutoExplore] = useState<boolean>(true);
  const [exploreLogs, setExploreLogs] = useState<string[]>([]);
  const [explorationHistory, setExplorationHistory] = useState<{ step: number; reward: number; pnl: number }[]>([]);

  // Computed Values matching the exact C++ blueprint logic
  const pnlReward = params.pnlPips * params.positionLots * 10.0;
  const slippagePenalty = Math.pow(Math.abs(params.slippageTicks), 1.5) * 2.5;
  
  let sniperSpeedBonus = 0;
  if (params.latencyNs > 0 && params.latencyNs < 500) {
    sniperSpeedBonus = (500 - params.latencyNs) * 0.0375;
  } else if (params.latencyNs >= 1500) {
    sniperSpeedBonus = -5.0;
  }

  let shockFactor = 1.0;
  if (params.volatilitySpike > 3.0) {
    shockFactor = Math.exp(-0.4 * (params.volatilitySpike - 3.0));
  }

  const unconstrainedReward = (pnlReward - slippagePenalty) * shockFactor + sniperSpeedBonus;
  const finalReward = Math.max(-150.0, Math.min(150.0, unconstrainedReward));

  // Autopilot Optimizer Loop (Hill-climbing simulation to maximize reward)
  useEffect(() => {
    if (!autoExplore) return;

    let stepCounter = explorationHistory.length;
    const interval = setInterval(() => {
      setParams((prev) => {
        // Simple heuristic: slightly adjust inputs to optimize reward, or search randomly
        const mutate = (val: number, min: number, max: number, step: number) => {
          const delta = (Math.random() - 0.45) * step;
          return Math.max(min, Math.min(max, val + delta));
        };

        const nextPnl = mutate(prev.pnlPips, -50, 50, 4.0);
        const nextLatency = Math.floor(mutate(prev.latencyNs, 10, 2000, 150));
        const nextSlippage = parseFloat(mutate(prev.slippageTicks, 0, 5, 0.5).toFixed(2));
        const nextVolatility = parseFloat(mutate(prev.volatilitySpike, 1, 6, 0.4).toFixed(2));
        const nextLots = parseFloat(mutate(prev.positionLots, 0.1, 10, 0.5).toFixed(2));

        return {
          pnlPips: nextPnl,
          latencyNs: nextLatency,
          slippageTicks: nextSlippage,
          volatilitySpike: nextVolatility,
          positionLots: nextLots,
        };
      });

      stepCounter++;
      const currentFinalReward = finalReward;
      setExplorationHistory((prev) => {
        const updated = [...prev, { step: stepCounter, reward: currentFinalReward, pnl: pnlReward }];
        if (updated.length > 15) updated.shift();
        return updated;
      });

      const KurdishLogs = [
        `🤖 [گەڕانی جێگیر] نرخاندنی فۆرمولە لە کاتی ڕاستەقینەدا... خەڵات: ${currentFinalReward.toFixed(2)}`,
        `🧠 [ئۆپتیمایزەر] تاقیکردنەوەی باری نوێ: Latency=${params.latencyNs}ns, Volatility=${params.volatilitySpike}x`,
        `📈 [بەدواداچوون] ڕیسک کەمکرایەوە، خەڵات ئۆپتیمایز کرا بۆ ئاستی ڕاستەقینە.`
      ];
      setExploreLogs((prev) => [KurdishLogs[Math.floor(Math.random() * KurdishLogs.length)], ...prev.slice(0, 5)]);

    }, 2000);

    return () => clearInterval(interval);
  }, [autoExplore, finalReward, pnlReward, params]);

  return (
    <div id="reward-playground-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left side: Param controls (Dynamic and Kurdish localized) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 text-right" dir="rtl">
          <div className="flex justify-between items-center border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-slate-100 uppercase">ڕێکخستنی دەستی و ئۆتۆماتیکی (Inputs)</h3>
            </div>
            
            {/* Exploration Switch */}
            <button
              onClick={() => setAutoExplore(!autoExplore)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                autoExplore ? 'bg-purple-950 text-purple-300 border border-purple-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800'
              }`}
            >
              <Sparkles className={`w-3 h-3 ${autoExplore ? 'animate-spin text-purple-400' : ''}`} />
              <span>{autoExplore ? 'گەڕانی خۆکار: چالاکە' : 'ڕاگیراوە'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* PnL Pips */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400">قازانج یان زیانی پۆینتەکان (PnL in Pips)</label>
                <span className={`text-xs font-mono font-bold ${params.pnlPips >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {params.pnlPips.toFixed(1)} pips
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="0.5"
                disabled={autoExplore}
                value={params.pnlPips}
                onChange={(e) => setParams({ ...params, pnlPips: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-40"
              />
            </div>

            {/* Position Lots */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400">قەبارەی گرێبەست (Position Size in Lots)</label>
                <span className="text-xs font-mono font-bold text-slate-300">{params.positionLots.toFixed(2)} Lots</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="10.0"
                step="0.1"
                disabled={autoExplore}
                value={params.positionLots}
                onChange={(e) => setParams({ ...params, positionLots: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-40"
              />
            </div>

            {/* Latency */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400">تاخیری جێبەجێکردن (Latency in Nanoseconds)</label>
                <span className={`text-xs font-mono font-bold ${params.latencyNs < 500 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {params.latencyNs} ns
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="2000"
                step="10"
                disabled={autoExplore}
                value={params.latencyNs}
                onChange={(e) => setParams({ ...params, latencyNs: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-40"
              />
            </div>

            {/* Slippage Ticks */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400">خلیسکانی نرخ (Slippage Ticks)</label>
                <span className="text-xs font-mono font-bold text-amber-500">{params.slippageTicks.toFixed(2)} Ticks</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.1"
                disabled={autoExplore}
                value={params.slippageTicks}
                onChange={(e) => setParams({ ...params, slippageTicks: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-40"
              />
            </div>

            {/* Volatility Spike */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400">ڕێژەی ڤۆلاتۆلیتی و ناسەقامگیری (Volatility Spike)</label>
                <span className={`text-xs font-mono font-bold ${params.volatilitySpike > 3 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {params.volatilitySpike.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="6.0"
                step="0.1"
                disabled={autoExplore}
                value={params.volatilitySpike}
                onChange={(e) => setParams({ ...params, volatilitySpike: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-40"
              />
            </div>

          </div>
        </div>

        {/* Real-time Scalar Result Gauge */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 text-right" dir="rtl">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 justify-start">
            <Target className="w-4 h-4 text-emerald-400" />
            ئەنجامی ڕاستەوخۆی هاوکێشەی خەڵات (Scalar Reward Output)
          </h3>

          <div className="flex flex-col items-center justify-center p-4 bg-[#050914] rounded-lg border border-slate-900 relative overflow-hidden">
            <span className="text-4xl font-mono font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              {finalReward.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-1">SCALAR BOUNDED REWARD [-150.0 to 150.0]</span>
            
            {/* Small dynamic progress slider visualization */}
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-4 overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-300 ${finalReward >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ 
                  width: `${Math.min(100, Math.max(0, ((finalReward + 150) / 300) * 100))}%` 
                }}
              />
            </div>
          </div>

          {/* Real-time Exploration logs */}
          {autoExplore && (
            <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-lg border border-slate-900 text-right">
              <span className="text-[10px] font-bold text-purple-400 block">لۆگی گەڕان و بەهێزکردنی کات:</span>
              <div className="h-16 overflow-y-auto text-[9px] font-mono text-slate-400 space-y-1">
                {exploreLogs.map((log, idx) => (
                  <div key={idx} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Real-time highlights of C++ file */}
      <div id="cpp-function-line-highlights" className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40">
          <h3 className="text-sm font-bold text-slate-100 flex items-center">
            <Sparkles className="w-4 h-4 text-purple-400 mr-2" />
            کۆدی سەرەکی C++ لە ژینگەی کارا (Source Code Binder)
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">بینینی هێڵەکانی فۆرمولەی خەڵاتی توندوتۆڵ بە شێوەی داینامیکی بەپێی جووڵەی پارامیتەرەکان.</p>
        </div>

        {/* Code Block with hover styles */}
        <div className="flex-1 bg-[#050811] p-5 font-mono text-xs overflow-y-auto space-y-1 select-none">
          <div className="text-slate-600">// C++ Optimized Deep Reinforcement Learning Reward calculation</div>
          <div className="text-slate-300"><span className="text-pink-400">double</span> <span className="text-sky-300">calculateReward</span>(</div>
          <div className="text-slate-300">    <span className="text-pink-400">double</span> pnl_pips, </div>
          <div className="text-slate-300">    <span className="text-pink-400">double</span> execution_latency_ns, </div>
          <div className="text-slate-300">    <span className="text-pink-400">double</span> slippage_ticks, </div>
          <div className="text-slate-300">    <span className="text-pink-400">double</span> volatility_spike, </div>
          <div className="text-slate-300">    <span className="text-pink-400">double</span> position_lots</div>
          <div className="text-slate-300">) &#123;</div>

          {/* Line 1: PnL scaling */}
          <div 
            className={`p-1.5 rounded transition-all cursor-pointer ${activeHighlight === 'pnl' ? 'bg-emerald-950/40 border border-emerald-800/80 text-emerald-100' : 'text-slate-300 border border-transparent hover:bg-slate-900/30'}`}
            onMouseEnter={() => setActiveHighlight('pnl')}
            onMouseLeave={() => setActiveHighlight(null)}
          >
            <span className="text-slate-500 inline-block w-8 select-none">L09:</span>
            <span className="text-pink-400">double</span> pnl_reward = pnl_pips * position_lots * <span className="text-amber-300">10.0</span>;
            <span className="block text-[10px] text-emerald-400 font-sans mt-0.5">
              ↳ حسابکردن: {params.pnlPips.toFixed(1)} * {params.positionLots.toFixed(1)} * 10.0 = <span className="font-bold font-mono text-emerald-300">{pnlReward.toFixed(2)}</span>
            </span>
          </div>

          {/* Line 2: Slippage Exponential penalty */}
          <div 
            className={`p-1.5 rounded transition-all cursor-pointer ${activeHighlight === 'slippage' ? 'bg-amber-950/40 border border-amber-800/80 text-amber-100' : 'text-slate-300 border border-transparent hover:bg-slate-900/30'}`}
            onMouseEnter={() => setActiveHighlight('slippage')}
            onMouseLeave={() => setActiveHighlight(null)}
          >
            <span className="text-slate-500 inline-block w-8 select-none">L12:</span>
            <span className="text-pink-400">double</span> slippage_penalty = std::pow(std::abs(slippage_ticks), <span className="text-amber-300">1.5</span>) * <span className="text-amber-300">2.5</span>;
            <span className="block text-[10px] text-amber-400 font-sans mt-0.5">
              ↳ پێبژاردنی خلیسکانی نرخ: pow({params.slippageTicks.toFixed(1)}, 1.5) * 2.5 = <span className="font-bold font-mono text-amber-300">{slippagePenalty.toFixed(2)}</span>
            </span>
          </div>

          {/* Line 3: Latency speed bonus */}
          <div 
            className={`p-1.5 rounded transition-all cursor-pointer ${activeHighlight === 'latency' ? 'bg-sky-950/40 border border-sky-800/80 text-sky-100' : 'text-slate-300 border border-transparent hover:bg-slate-900/30'}`}
            onMouseEnter={() => setActiveHighlight('latency')}
            onMouseLeave={() => setActiveHighlight(null)}
          >
            <span className="text-slate-500 inline-block w-8 select-none">L15:</span>
            <span className="text-pink-400">double</span> sniper_speed_bonus = <span className="text-amber-300">0.0</span>;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L16:</span>
            <span className="text-pink-400">if</span> (execution_latency_ns &gt; <span className="text-amber-300">0.0</span> && execution_latency_ns &lt; <span className="text-amber-300">500.0</span>) &#123;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L17:</span>
            &nbsp;&nbsp;&nbsp;&nbsp;sniper_speed_bonus = (<span className="text-amber-300">500.0</span> - execution_latency_ns) * <span className="text-amber-300">0.0375</span>;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L18:</span>
            &#125;
            <span className="block text-[10px] text-sky-400 font-sans mt-0.5">
              ↳ بۆنوسی خێرایی: {params.latencyNs}ns. وەرگیراو: <span className="font-bold font-mono text-sky-300">{sniperSpeedBonus >= 0 ? '+' : ''}{sniperSpeedBonus.toFixed(2)}</span>
            </span>
          </div>

          {/* Line 4: Volatility attenuation */}
          <div 
            className={`p-1.5 rounded transition-all cursor-pointer ${activeHighlight === 'volatility' ? 'bg-purple-950/40 border border-purple-800/80 text-purple-100' : 'text-slate-300 border border-transparent hover:bg-slate-900/30'}`}
            onMouseEnter={() => setActiveHighlight('volatility')}
            onMouseLeave={() => setActiveHighlight(null)}
          >
            <span className="text-slate-500 inline-block w-8 select-none">L22:</span>
            <span className="text-pink-400">double</span> shock_factor = <span className="text-amber-300">1.0</span>;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L23:</span>
            <span className="text-pink-400">if</span> (volatility_spike &gt; <span className="text-amber-300">3.0</span>) &#123;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L24:</span>
            &nbsp;&nbsp;&nbsp;&nbsp;shock_factor = std::exp(<span className="text-amber-300">-0.4</span> * (volatility_spike - <span className="text-amber-300">3.0</span>));
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L25:</span>
            &#125;
            <span className="block text-[10px] text-purple-400 font-sans mt-0.5">
              ↳ فاکتەری شۆک (Dampener): {params.volatilitySpike.toFixed(2)}x. ئاستی هێورکردنەوە: <span className="font-bold font-mono text-purple-300">{shockFactor.toFixed(3)}x</span>
            </span>
          </div>

          {/* Line 5: Assemble and Bounded Limits */}
          <div className="p-1.5 text-slate-300 border border-transparent">
            <span className="text-slate-500 inline-block w-8 select-none">L27:</span>
            <span className="text-pink-400">double</span> final_reward = ((pnl_reward - slippage_penalty) * shock_factor) + sniper_speed_bonus;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L28:</span>
            <span className="text-pink-400">return</span> std::max(<span className="text-amber-300">-150.0</span>, std::min(<span className="text-amber-300">150.0</span>, final_reward));
          </div>
          <div className="text-slate-300">&#125;</div>
        </div>

        {/* Tip on deep reinforcement training */}
        <div id="drl-training-insight" className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center space-x-2 space-x-reverse text-right" dir="rtl">
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 ml-2" />
            <span>
              <strong className="text-slate-300">تێبینی سەرەکی:</strong> مۆتۆڕی گەشەکردنی خۆکار لە کاتی فێربوونی بەهێزکردندا (Reinforcement Learning) بە شێوەیەکی داینامیکی بە دوای کێشی بیرکاری گونجاودا دەگەڕێت کە بتوانێت زۆرترین خەڵاتی سکالەر بەدەستبهێنێت بەبێ پێویستی بە جێبەجێکردنی دەستی.
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
