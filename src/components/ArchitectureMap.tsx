/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Cpu, Shuffle, Target, ShieldAlert, ChevronRight, CornerDownRight, Terminal, Brain, Sparkles, Code, Lightbulb, Zap } from 'lucide-react';
import { SYSTEM_BLUEPRINTS } from '../data/blueprints';
import { ArchitectureComponent } from '../types/quant';

export default function ArchitectureMap() {
  const [selectedComponent, setSelectedComponent] = useState<ArchitectureComponent>(SYSTEM_BLUEPRINTS[0]);
  const [activeCycle, setActiveCycle] = useState<'idle' | 'learning' | 'coding' | 'compiling' | 'executing'>('idle');
  const [interactiveLog, setInteractiveLog] = useState<string[]>([
    "System standby. Cognitive evolution circuit armed and nominal.",
    "Dual-sector pipeline monitoring live London/New York core trades..."
  ]);

  const [imaginationTicks, setImaginationTicks] = useState<number>(3728510);
  const [lightSpeedBoost, setLightSpeedBoost] = useState<boolean>(false);
  const [curiosityScore, setCuriosityScore] = useState<number>(98.4);

  useEffect(() => {
    const interval = setInterval(() => {
      setImaginationTicks(prev => prev + (lightSpeedBoost ? 985 : 12));
      // Randomly fluctuation of curiosity
      setCuriosityScore(prev => {
        const delta = (Math.random() - 0.5) * 0.4;
        return Math.min(100, Math.max(95, prev + delta));
      });
    }, 150);
    return () => clearInterval(interval);
  }, [lightSpeedBoost]);

  const triggerSelfEvolutionCycle = () => {
    if (activeCycle !== 'idle') return;
    
    setActiveCycle('learning');
    setInteractiveLog(prev => [
      `[${new Date().toLocaleTimeString()}] INITIATED: Triggering full autonomous evolution cycle...`,
      ...prev
    ]);
    
    setTimeout(() => {
      setActiveCycle('coding');
      setInteractiveLog(prev => [
        `[${new Date().toLocaleTimeString()}] DEEP LEARNING SECTOR: Reinforcement Learning policy weights analyzed. Pushing reward constraints to Search & Coding Sector.`, 
        ...prev
      ]);
    }, 2000);

    setTimeout(() => {
      setActiveCycle('compiling');
      setInteractiveLog(prev => [
        `[${new Date().toLocaleTimeString()}] SEARCH & CODING SECTOR: Auto-generated fresh C++ reward candidate. Initiating sandboxed AST security filter...`,
        `[${new Date().toLocaleTimeString()}] SANDBOX STAGE 1 (AST): Checked for popen/system/fork violations. Passed static lexical scans.`,
        `[${new Date().toLocaleTimeString()}] SANDBOX STAGE 2 (ASan): Code compiled with GCC AddressSanitizer. Verified 100% bounds-safe.`,
        ...prev
      ]);
    }, 4500);

    setTimeout(() => {
      setActiveCycle('executing');
      setInteractiveLog(prev => [
        `[${new Date().toLocaleTimeString()}] SYSTEM POINTER SWAP: Performing atomic C++ function pointer swap live on CPU Core 3.`,
        `[${new Date().toLocaleTimeString()}] SUCCESS: Neural execution successfully hot-swapped! Dynamic optimization calibrated (sniper speed: 412ns).`,
        ...prev
      ]);
    }, 7500);

    setTimeout(() => {
      setActiveCycle('idle');
    }, 10000);
  };

  return (
    <div id="architecture-blueprint-workspace" className="space-y-6">
      
      {/* Self-Evolving Internal Brain Interactive Panel */}
      <div id="self-evolving-brain-panel" className="bg-slate-950 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-800 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-emerald-950 to-slate-950 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-mono bg-purple-950 border border-purple-800 text-purple-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Autonomous Cognitive Loop</span>
                <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-semibold">Self-Reflexive</span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mt-1">Self-Evolving Internal Brain Architecture</h3>
            </div>
          </div>
          <button
            id="trigger-cognitive-cycle-btn"
            onClick={triggerSelfEvolutionCycle}
            disabled={activeCycle !== 'idle'}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeCycle === 'idle'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{activeCycle === 'idle' ? 'TRIGGER SELF-EVOLUTION' : 'EVOLVING STACK...'}</span>
          </button>
        </div>

        {/* Visual Diagram Area: Self-Evolving Internal Brain */}
        <div className="py-6 flex flex-col items-center">
          
          {/* Main Brain Container Frame */}
          <div className="w-full max-w-3xl border border-dashed border-slate-800 bg-slate-900/10 rounded-2xl p-6 relative">
            <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-500 font-mono text-[9px] font-bold rounded">
              SELF-EVOLVING INTERNAL BRAIN OUTER MATRIX
            </span>

            {/* Top row: Dual-Sector Core */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
              
              {/* Sector 1: Deep Learning Sector */}
              <div className={`md:col-span-4 p-4 rounded-xl border transition-all text-center flex flex-col justify-between h-40 ${
                activeCycle === 'learning'
                  ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/20'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}>
                <div>
                  <div className="flex justify-center mb-1 text-emerald-400">
                    <Target className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-mono font-bold text-slate-300">DEEP LEARNING SECTOR</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">(Deep Reinforcement Learning)</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded p-2 text-[10px] font-mono text-left space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">RL Policy Weight:</span>
                    <span className="text-emerald-400 font-bold">12x Multiplier</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reward Function:</span>
                    <span className="text-sky-400 font-bold">DQN Matrix</span>
                  </div>
                </div>
              </div>

              {/* Connecting Sync Channel */}
              <div className="md:col-span-3 flex flex-col items-center justify-center py-2">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-2 text-center">
                  {activeCycle === 'coding' || activeCycle === 'learning' ? (
                    <span className="text-emerald-400 font-bold animate-pulse">Synaptic Exchange Live</span>
                  ) : (
                    "Bi-Directional Synapse"
                  )}
                </div>
                <div className="flex items-center space-x-2 w-full px-4">
                  <div className="h-0.5 bg-slate-800 flex-1 relative">
                    {/* Glowing dynamic packet indicator */}
                    <div className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                      activeCycle === 'learning' ? 'bg-emerald-400 right-0 animate-pulse' :
                      activeCycle === 'coding' ? 'bg-sky-400 left-0 animate-pulse' : 'bg-slate-700 left-1/2 -translate-x-1/2'
                    }`}></div>
                  </div>
                  <div className="font-mono text-xs text-slate-400 select-none">&lt;───&gt;</div>
                  <div className="h-0.5 bg-slate-800 flex-1 relative"></div>
                </div>
                <span className="text-[9px] font-mono text-slate-600 mt-2">Active Optimization Telemetry</span>
              </div>

              {/* Sector 2: Search & Coding Sector */}
              <div className={`md:col-span-4 p-4 rounded-xl border transition-all text-center flex flex-col justify-between h-40 ${
                activeCycle === 'coding'
                  ? 'bg-sky-950/40 border-sky-500 shadow-lg shadow-sky-950/30 ring-1 ring-sky-500/20'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}>
                <div>
                  <div className="flex justify-center mb-1 text-sky-400">
                    <Code className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-mono font-bold text-slate-300">SEARCH & CODING SECTOR</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">(Local SLM + Web Search)</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded p-2 text-[10px] font-mono text-left space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">LLM Generation:</span>
                    <span className="text-sky-400 font-bold">DeepSeek V3 / SLM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AST Validation:</span>
                    <span className="text-emerald-400 font-bold">SECURE GATEWAY</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Cognitive Imagination & Child-style Light-speed Trial-and-Error Exploration */}
            <div id="cognitive-imagination-sandbox" className="mt-5 p-4 bg-gradient-to-r from-purple-950/40 via-slate-950 to-emerald-950/40 border border-purple-900/40 rounded-xl text-right" dir="rtl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-start space-x-3 space-x-reverse">
                  <div className="p-2 bg-purple-950/60 border border-purple-500/30 rounded-lg text-purple-400 mt-1 sm:mt-0">
                    <Lightbulb className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 justify-start">
                      مەکینەی خەیاڵکردنی مێشک و تاقیکردنەوەی خێرا
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      وەک منداڵێک فێردەبێت: مۆدێلەکە بە بەردەوامی خەیاڵی هەزاران ستراتیژی داهێنەرانە دەکات و بە خێرایی تاقی دەکاتەوە بۆ فێربوون لەناو بازاڕدا بەبێ مەترسی بۆ سەر سەرمایە.
                    </p>
                  </div>
                </div>

                <button
                  id="toggle-light-speed-boost"
                  onClick={() => setLightSpeedBoost(!lightSpeedBoost)}
                  className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold flex items-center space-x-1 space-x-reverse border transition-all cursor-pointer ${
                    lightSpeedBoost
                      ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-amber-400'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${lightSpeedBoost ? 'animate-bounce' : ''}`} />
                  <span>{lightSpeedBoost ? 'کۆنترۆڵی خێرایی ڕووناکی چالاكە' : 'چالاککردنی خێرایی ڕووناکی'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-900 text-right" dir="rtl">
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                  <span className="text-[9px] text-slate-500 block">کۆی تاقیکردنەوەکانی مێشک</span>
                  <span className="text-xs font-mono font-bold text-purple-400 mt-0.5 block" dir="ltr">{imaginationTicks.toLocaleString()} Runs</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                  <span className="text-[9px] text-slate-500 block">خێرایی فێربوونی زیرەکی</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block" dir="ltr">
                    {lightSpeedBoost ? '2.4M Iterations/s' : '4,800 Iterations/s'}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                  <span className="text-[9px] text-slate-500 block">ئاستی داهێنان (Curiosity)</span>
                  <span className="text-xs font-mono font-bold text-sky-400 mt-0.5 block" dir="ltr">{curiosityScore.toFixed(2)}%</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                  <span className="text-[9px] text-slate-500 block">یاساکانی مەترسی</span>
                  <span className="text-xs font-mono font-bold text-amber-400 mt-0.5 block">پارێزراو بە تەواوی ✓</span>
                </div>
              </div>
            </div>

            {/* Vertical Flow Vectors going down to C++ / Sandbox */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-start mt-6 pt-2 border-t border-slate-800/60">
              
              {/* Left Action Output Channel */}
              <div className="md:col-span-4 flex flex-col items-center">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-slate-700 to-emerald-500 border-dashed border-l border-slate-800"></div>
                  <div className="text-[12px] text-emerald-400 select-none">▼</div>
                </div>
                <div className={`mt-2 w-full p-3 bg-slate-900 border rounded-lg text-center transition-all ${
                  activeCycle === 'executing' ? 'border-emerald-500 bg-emerald-950/10 text-emerald-300' : 'border-slate-800'
                }`}>
                  <h5 className="text-[11px] font-mono font-black">[FPGA & C++ CONTROL]</h5>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">CPU Core 3 Pinnings & DMA Buffers</p>
                </div>
              </div>

              {/* Empty Middle spacer */}
              <div className="md:col-span-3"></div>

              {/* Right Action Output Channel */}
              <div className="md:col-span-4 flex flex-col items-center">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-slate-700 to-purple-500 border-dashed border-l border-slate-800"></div>
                  <div className="text-[12px] text-purple-400 select-none">▼</div>
                </div>
                <div className={`mt-2 w-full p-3 bg-slate-900 border rounded-lg text-center transition-all ${
                  activeCycle === 'compiling' ? 'border-purple-500 bg-purple-950/10 text-purple-300' : 'border-slate-800'
                }`}>
                  <h5 className="text-[11px] font-mono font-black">[SANDBOX TESTING]</h5>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">Static Lexical check & ASan Auditing</p>
                </div>
              </div>

            </div>

          </div>
          
        </div>

        {/* Live Terminal Console output for loop telemetry */}
        <div className="mt-2 bg-[#050811] border border-slate-900 rounded-lg overflow-hidden">
          <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-900 text-[10px] font-mono text-slate-400 flex justify-between items-center">
            <span>COGNITIVE PIPELINE LOG CONSOLE</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] text-slate-500">LIVE FEED</span>
            </div>
          </div>
          <div className="p-3 font-mono text-[10px] text-slate-300 space-y-1 h-24 overflow-y-auto leading-relaxed select-text">
            {interactiveLog.map((log, index) => (
              <div key={index} className={log.includes("SUCCESS") || log.includes("OK") ? "text-emerald-400" : log.includes("INITIATED") ? "text-sky-400" : "text-slate-400"}>
                {log}
              </div>
            ))}
          </div>
        </div>

      </div>

      <div id="architecture-map-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">

      {/* Left side: Visual flow diagram */}
      <div id="visual-blueprint-map" className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-950 border border-slate-800 rounded-xl p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-1">System Pipeline</h3>
          <p className="text-xs text-slate-500">Click on any component below to inspect its sovereign low-latency source code and design paradigm.</p>
        </div>

        {/* Vertical Pipeline of Nodes with arrows */}
        <div id="pipeline-nodes" className="flex flex-col space-y-4 my-4 relative">
          
          {/* Component 1: Go Controller Backplane */}
          <button
            id="node-go-async-controller"
            onClick={() => setSelectedComponent(SYSTEM_BLUEPRINTS[1])}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedComponent.id === 'go-async-controller'
                ? 'bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-sky-900/30 border border-sky-800 rounded text-sky-400">
                  <Shuffle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono text-sky-400 font-bold">NODE 01: GOLANG CONTROLLER</h4>
                  <p className="text-sm font-semibold text-slate-100">Async Telemetry & Watchdog</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${selectedComponent.id === 'go-async-controller' ? 'rotate-90 text-sky-400' : ''}`} />
            </div>
            <div className="mt-2 text-xs text-slate-400 font-sans line-clamp-2">
              Goroutines manage overall orchestration, telemetry broadcasting, and absolute hardware-level Emergency Kill-Switch bounds.
            </div>
          </button>

          {/* Connection Vector 1 */}
          <div className="flex justify-center my-1">
            <div className="w-0.5 h-6 bg-gradient-to-b from-sky-500/60 to-purple-500/60 border-dashed border-l border-slate-700"></div>
          </div>

          {/* Component 2: POSIX Shared Memory Lockless Ring Buffer */}
          <button
            id="node-ipc-ring-buffer"
            onClick={() => setSelectedComponent(SYSTEM_BLUEPRINTS[0])}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedComponent.id === 'ipc-ring-buffer'
                ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-950/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-900/30 border border-purple-800 rounded text-purple-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono text-purple-400 font-bold">NODE 02: POSIX SHARED MEMORY</h4>
                  <p className="text-sm font-semibold text-slate-100">Lockless SPSC Ring Buffer</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${selectedComponent.id === 'ipc-ring-buffer' ? 'rotate-90 text-purple-400' : ''}`} />
            </div>
            <div className="mt-2 text-xs text-slate-400 font-sans line-clamp-2">
              Shared-memory mapped HugePages. 64-byte cache-line padded data entries with release-acquire fences for zero locks.
            </div>
          </button>

          {/* Connection Vector 2 */}
          <div className="flex justify-center my-1">
            <div className="w-0.5 h-6 bg-gradient-to-b from-purple-500/60 to-emerald-500/60 border-dashed border-l border-slate-700"></div>
          </div>

          {/* Component 3: C++ Execution Core & FPGA DMA */}
          <button
            id="node-cpp-execution-core"
            onClick={() => setSelectedComponent(SYSTEM_BLUEPRINTS[2])}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedComponent.id === 'cpp-execution-core'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-900/30 border border-emerald-800 rounded text-emerald-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono text-emerald-400 font-bold">NODE 03: C++ / FPGA EXECUTION</h4>
                  <p className="text-sm font-semibold text-slate-100">DMA & Sniper Shock Absorber</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${selectedComponent.id === 'cpp-execution-core' ? 'rotate-90 text-emerald-400' : ''}`} />
            </div>
            <div className="mt-2 text-xs text-slate-400 font-sans line-clamp-2">
              Isolated CPU core pinning, PCIe memory-mapped IO (MMIO), and immediate slippage-based hardware execution brakes.
            </div>
          </button>

          {/* Connection Vector 3 */}
          <div className="flex justify-center my-1">
            <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500/60 to-amber-500/60 border-dashed border-l border-slate-700"></div>
          </div>

          {/* Component 4: C++ DRL Reward Function */}
          <button
            id="node-cpp-reward-function"
            onClick={() => setSelectedComponent(SYSTEM_BLUEPRINTS[3])}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedComponent.id === 'cpp-reward-function'
                ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-900/30 border border-amber-800 rounded text-amber-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono text-amber-400 font-bold">NODE 04: C++ REWARD FUNCTION</h4>
                  <p className="text-sm font-semibold text-slate-100">Active DRL calculateReward</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${selectedComponent.id === 'cpp-reward-function' ? 'rotate-90 text-amber-400' : ''}`} />
            </div>
            <div className="mt-2 text-xs text-slate-400 font-sans line-clamp-2">
              High-frequency reward math evaluating slippage exponent decay, sniper response speeds, and volatility buffers.
            </div>
          </button>

          {/* Connection Vector 4 */}
          <div className="flex justify-center my-1">
            <div className="w-0.5 h-6 bg-gradient-to-b from-amber-500/60 to-rose-500/60 border-dashed border-l border-slate-700"></div>
          </div>

          {/* Component 5: Self-Evolution Guardrails */}
          <button
            id="node-self-evolution-guards"
            onClick={() => setSelectedComponent(SYSTEM_BLUEPRINTS[4])}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedComponent.id === 'self-evolution-guards'
                ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-900/30 border border-rose-800 rounded text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-mono text-rose-400 font-bold">NODE 05: EVOLUTION GUARDRAILS</h4>
                  <p className="text-sm font-semibold text-slate-100">Static AST & Docker Sandboxing</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${selectedComponent.id === 'self-evolution-guards' ? 'rotate-90 text-rose-400' : ''}`} />
            </div>
            <div className="mt-2 text-xs text-slate-400 font-sans line-clamp-2">
              Compiler script blocking unsafe inclusions, dynamic memory check triggers, and historical tick test benchmarks.
            </div>
          </button>
        </div>

        {/* Local Security Isolation Detail */}
        <div id="hsm-key-isolation-info" className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-lg text-xs flex items-start space-x-2.5">
          <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-300">HSM Core Isolation Enforced:</span> api keys and binary keys are compiled out and referenced via local PKCS#11 hardware calls. Hot reloading maintains this sandbox logic and blocks any static code extraction attempts.
          </div>
        </div>
      </div>

      {/* Right side: Detailed deep dive and source code */}
      <div id="blueprint-details-display" className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/40">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2.5 animate-pulse"></span>
              {selectedComponent.title}
            </h3>
            <span className="text-xs text-slate-400 font-mono">{selectedComponent.subTitle}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-slate-800 border border-slate-700 text-slate-300">
              {selectedComponent.language}
            </span>
          </div>
        </div>

        {/* Explanatory detail panel */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/20 text-sm">
          <div className="text-slate-300 whitespace-pre-line leading-relaxed">
            {selectedComponent.technicalDeepDive}
          </div>
        </div>

        {/* Code display terminal */}
        <div className="flex-1 flex flex-col bg-[#050811] overflow-hidden min-h-[350px]">
          {/* Terminal control bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-900 text-slate-500 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/70"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/70"></span>
              <span className="ml-2 text-slate-400">production_kernel_impl.{selectedComponent.language === 'cpp' ? 'hpp' : selectedComponent.language === 'go' ? 'go' : 'sh'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-400">
              <Terminal className="w-3.5 h-3.5" />
              <span>UTF-8</span>
            </div>
          </div>

          {/* Code blocks with custom highlight */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-300 leading-relaxed selection:bg-slate-800">
            <pre className="whitespace-pre overflow-x-auto">
              <code>{selectedComponent.productionCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
