/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sliders, Target, ShieldAlert, Zap, TrendingUp, Sparkles, HelpCircle } from 'lucide-react';
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

  return (
    <div id="reward-playground-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left side: Param Sliders and Output Breakdown */}
      <div id="sliders-and-results" className="lg:col-span-6 flex flex-col space-y-6 bg-slate-950 border border-slate-800 rounded-xl p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-1">C++ Reward Simulator</h3>
          <p className="text-xs text-slate-500">Fine-tune the parameters below to observe how the local Deep Reinforcement Learning reward function evaluates system fitness.</p>
        </div>

        {/* Sliders panel */}
        <div className="space-y-4">
          
          {/* PnL Parameter */}
          <div 
            id="slider-group-pnl" 
            onMouseEnter={() => setActiveHighlight('pnl')}
            onMouseLeave={() => setActiveHighlight(null)}
            className={`p-3 rounded-lg border transition-all ${activeHighlight === 'pnl' ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                Absolute Profit & Loss
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {params.pnlPips >= 0 ? '+' : ''}{params.pnlPips.toFixed(1)} Pips
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="50"
              step="0.5"
              value={params.pnlPips}
              onChange={(e) => setParams({ ...params, pnlPips: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>-30.0 Pips (Stop Loss)</span>
              <span>+50.0 Pips (Take Profit)</span>
            </div>
          </div>

          {/* Position Lots */}
          <div 
            id="slider-group-lots"
            onMouseEnter={() => setActiveHighlight('pnl')}
            onMouseLeave={() => setActiveHighlight(null)}
            className={`p-3 rounded-lg border transition-all ${activeHighlight === 'pnl' ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center">
                <Sliders className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                Volume (Position Size)
              </label>
              <span className="text-xs font-mono font-bold text-slate-300">
                {params.positionLots.toFixed(1)} Lots
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={params.positionLots}
              onChange={(e) => setParams({ ...params, positionLots: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.1 Lots (Micro)</span>
              <span>20.0 Lots (Heavy)</span>
            </div>
          </div>

          {/* Latency Parameter */}
          <div 
            id="slider-group-latency"
            onMouseEnter={() => setActiveHighlight('latency')}
            onMouseLeave={() => setActiveHighlight(null)}
            className={`p-3 rounded-lg border transition-all ${activeHighlight === 'latency' ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center">
                <Zap className="w-3.5 h-3.5 text-sky-400 mr-1.5" />
                System Latency (End-to-End)
              </label>
              <span className={`text-xs font-mono font-bold ${params.latencyNs < 500 ? 'text-sky-400' : params.latencyNs >= 1500 ? 'text-rose-400' : 'text-slate-400'}`}>
                {params.latencyNs} ns {params.latencyNs < 500 ? '(Sniper Mode)' : params.latencyNs >= 1500 ? '(Stale/Late)' : ''}
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              step="10"
              value={params.latencyNs}
              onChange={(e) => setParams({ ...params, latencyNs: parseInt(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>50 ns (Sub-micro)</span>
              <span>2,000 ns (2.0 µs)</span>
            </div>
          </div>

          {/* Slippage Parameter */}
          <div 
            id="slider-group-slippage"
            onMouseEnter={() => setActiveHighlight('slippage')}
            onMouseLeave={() => setActiveHighlight(null)}
            className={`p-3 rounded-lg border transition-all ${activeHighlight === 'slippage' ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center">
                <Sliders className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
                Execution Slippage
              </label>
              <span className={`text-xs font-mono font-bold ${params.slippageTicks > 3.0 ? 'text-amber-500' : 'text-slate-300'}`}>
                {params.slippageTicks.toFixed(1)} Ticks
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="10.0"
              step="0.1"
              value={params.slippageTicks}
              onChange={(e) => setParams({ ...params, slippageTicks: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.0 Ticks (Ideal)</span>
              <span>10.0 Ticks (Extreme Slip)</span>
            </div>
          </div>

          {/* Volatility Spike Parameter */}
          <div 
            id="slider-group-volatility"
            onMouseEnter={() => setActiveHighlight('volatility')}
            onMouseLeave={() => setActiveHighlight(null)}
            className={`p-3 rounded-lg border transition-all ${activeHighlight === 'volatility' ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400 mr-1.5" />
                Volatility Spike Level
              </label>
              <span className={`text-xs font-mono font-bold ${params.volatilitySpike > 3.0 ? 'text-purple-400' : 'text-slate-300'}`}>
                {params.volatilitySpike.toFixed(1)}x Baseline {params.volatilitySpike > 3.0 ? '(Shock Active)' : ''}
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.1"
              value={params.volatilitySpike}
              onChange={(e) => setParams({ ...params, volatilitySpike: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1.0x (Calm Market)</span>
              <span>10.0x (Flash Crash Spike)</span>
            </div>
          </div>

        </div>

        {/* Math Output Breakdown Box */}
        <div id="mathematical-breakdown-panel" className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3.5">
          <h4 className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider">REWARD EQUATION VALUES</h4>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* PnL component */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
              <span className="text-slate-400 block mb-0.5">1. PnL Scaling Gain</span>
              <span className={`font-mono font-bold ${pnlReward >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnlReward >= 0 ? '+' : ''}{pnlReward.toFixed(2)} pts
              </span>
            </div>

            {/* Slippage penalty */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
              <span className="text-slate-400 block mb-0.5">2. Slippage Penalty</span>
              <span className="font-mono font-bold text-amber-500">
                -{slippagePenalty.toFixed(2)} pts
              </span>
            </div>

            {/* Sniper bonus */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
              <span className="text-slate-400 block mb-0.5">3. Sniper Latency Adjustment</span>
              <span className={`font-mono font-bold ${sniperSpeedBonus >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                {sniperSpeedBonus >= 0 ? '+' : ''}{sniperSpeedBonus.toFixed(2)} pts
              </span>
            </div>

            {/* Volatility attenuation */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
              <span className="text-slate-400 block mb-0.5">4. Shock Absorber Multiplier</span>
              <span className={`font-mono font-bold ${shockFactor < 1.0 ? 'text-purple-400' : 'text-slate-400'}`}>
                {(shockFactor * 100).toFixed(0)}% Reward Exposure
              </span>
            </div>
          </div>

          {/* Equation assembly visualization */}
          <div className="pt-2 border-t border-slate-800 text-xs font-mono text-slate-400">
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span>UNCONSTRAINED:</span>
              <span className="text-slate-200 font-bold">
                (({pnlReward.toFixed(1)} - {slippagePenalty.toFixed(1)}) * {shockFactor.toFixed(2)}) + {sniperSpeedBonus.toFixed(1)} = <span className="text-white">{unconstrainedReward.toFixed(2)}</span>
              </span>
            </div>
          </div>

          {/* Final Large output */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-700/60 rounded-lg">
            <div>
              <span className="text-xs font-semibold text-slate-300 flex items-center">
                <Target className="w-4 h-4 text-emerald-400 mr-2" />
                Final Bounded Scalar Reward (R)
              </span>
              <span className="text-[10px] text-slate-500 block">Bounded strictly to [-150.0, 150.0] limits to prevent gradient explosion</span>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-mono font-black ${finalReward >= 10 ? 'text-emerald-400' : finalReward <= -10 ? 'text-rose-400' : 'text-slate-100'}`}>
                {finalReward >= 0 ? '+' : ''}{finalReward.toFixed(3)}
              </span>
              {Math.abs(unconstrainedReward) > 150.0 && (
                <span className="text-[9px] font-mono text-amber-500 block">⚠️ Constrained by bounds</span>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Right side: Real-time highlights of C++ file */}
      <div id="cpp-function-line-highlights" className="lg:col-span-6 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40">
          <h3 className="text-sm font-bold text-slate-100 flex items-center">
            <Sparkles className="w-4 h-4 text-amber-400 mr-2" />
            Active Source Code Context
          </h3>
          <span className="text-xs text-slate-500">Notice how parameter alterations dynamically bind to equations in standard compiled C++ functions.</span>
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
            className={`p-1.5 rounded transition-all ${activeHighlight === 'pnl' ? 'bg-emerald-950/40 border border-emerald-800/80 text-emerald-100' : 'text-slate-300 border border-transparent'}`}
            onMouseEnter={() => setActiveHighlight('pnl')}
            onMouseLeave={() => setActiveHighlight(null)}
          >
            <span className="text-slate-500 inline-block w-8 select-none">L09:</span>
            <span className="text-pink-400">double</span> pnl_reward = pnl_pips * position_lots * <span className="text-amber-300">10.0</span>;
            {activeHighlight === 'pnl' && (
              <span className="block text-[10px] text-emerald-400 font-sans mt-0.5">
                ↳ Gain: {params.pnlPips.toFixed(1)} pips * {params.positionLots.toFixed(1)} lots * 10.0 = {pnlReward.toFixed(2)} points
              </span>
            )}
          </div>

          {/* Line 2: Slippage Exponential penalty */}
          <div 
            className={`p-1.5 rounded transition-all ${activeHighlight === 'slippage' ? 'bg-amber-950/40 border border-amber-800/80 text-amber-100' : 'text-slate-300 border border-transparent'}`}
            onMouseEnter={() => setActiveHighlight('slippage')}
            onMouseLeave={() => setActiveHighlight(null)}
          >
            <span className="text-slate-500 inline-block w-8 select-none">L12:</span>
            <span className="text-pink-400">double</span> slippage_penalty = std::pow(std::abs(slippage_ticks), <span className="text-amber-300">1.5</span>) * <span className="text-amber-300">2.5</span>;
            {activeHighlight === 'slippage' && (
              <span className="block text-[10px] text-amber-400 font-sans mt-0.5">
                ↳ Exponential Penalty: abs({params.slippageTicks.toFixed(1)})^{1.5} * 2.5 = {slippagePenalty.toFixed(2)} points (Slippage exponential dampener)
              </span>
            )}
          </div>

          {/* Line 3: Latency speed bonus */}
          <div 
            className={`p-1.5 rounded transition-all ${activeHighlight === 'latency' ? 'bg-sky-950/40 border border-sky-800/80 text-sky-100' : 'text-slate-300 border border-transparent'}`}
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
            &#125; <span className="text-pink-400">else if</span> (execution_latency_ns &gt;= <span className="text-amber-300">1500.0</span>) &#123;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L19:</span>
            &nbsp;&nbsp;&nbsp;&nbsp;sniper_speed_bonus = <span className="text-amber-300">-5.0</span>;
            <br />
            <span className="text-slate-500 inline-block w-8 select-none">L20:</span>
            &#125;
            {activeHighlight === 'latency' && (
              <span className="block text-[10px] text-sky-400 font-sans mt-0.5">
                ↳ Latency Check: {params.latencyNs}ns. Speed Bonus awarded: {sniperSpeedBonus >= 0 ? '+' : ''}{sniperSpeedBonus.toFixed(2)} points
              </span>
            )}
          </div>

          {/* Line 4: Volatility attenuation */}
          <div 
            className={`p-1.5 rounded transition-all ${activeHighlight === 'volatility' ? 'bg-purple-950/40 border border-purple-800/80 text-purple-100' : 'text-slate-300 border border-transparent'}`}
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
            {activeHighlight === 'volatility' && (
              <span className="block text-[10px] text-purple-400 font-sans mt-0.5">
                ↳ Volatility Check: {params.volatilitySpike.toFixed(1)}x baseline. Shock Factor dampener: {shockFactor.toFixed(3)}x multiplier
              </span>
            )}
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

        {/* Tip on deep reinforcment training */}
        <div id="drl-training-insight" className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              <strong className="text-slate-300">Optimization Goal:</strong> The local evolution engine searches for mathematical weights that maximize this reward scalar while enforcing a bounded risk profile inside the live compiler sandbox.
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
