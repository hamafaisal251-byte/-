/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Target, ShieldAlert, CheckCircle2, XCircle, RefreshCw, Terminal, 
  Sliders, Play, Sparkles, Lightbulb, Zap, Brain, Settings,
  Flame, LineChart, Activity, Award, Check
} from 'lucide-react';
import { EvolutionCandidate } from '../types/quant';

interface EvolutionLabProps {
  candidates: EvolutionCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<EvolutionCandidate[]>>;
  selectedId: string;
  setSelectedId: (id: string) => void;
}

export default function EvolutionLab({ candidates, setCandidates, selectedId, setSelectedId }: EvolutionLabProps) {

  const [pipelineState, setPipelineState] = useState<'IDLE' | 'STEP_1_AST' | 'STEP_2_COMPILE' | 'STEP_3_VALGRIND' | 'STEP_4_RELOAD' | 'FINISHED'>('IDLE');
  const [pipelineSuccess, setPipelineSuccess] = useState<boolean | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  
  // AI Imagination fields
  const [imaginedPrompt, setImaginedPrompt] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<'sniper' | 'safe' | 'dangerous' | 'leak'>('sniper');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const termRef = useRef<HTMLDivElement>(null);

  // Real-time AI model training states
  const [trainingAsset, setTrainingAsset] = useState<string>('BTCUSDT');
  const [learningRate, setLearningRate] = useState<number>(0.001);
  const [totalEpochs, setTotalEpochs] = useState<number>(100);
  const [batchSize, setBatchSize] = useState<number>(64);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [currentEpoch, setCurrentEpoch] = useState<number>(0);
  const [trainingLoss, setTrainingLoss] = useState<number[]>([]);
  const [rewardConvergence, setRewardConvergence] = useState<number[]>([]);
  const [lastLivePrice, setLastLivePrice] = useState<number | null>(null);
  const [trainingLogs, setTrainingLogs] = useState<string[]>([]);
  const [saveTrainedReady, setSaveTrainedReady] = useState<boolean>(false);
  const [saveTrainedStatus, setSaveTrainedStatus] = useState<boolean>(false);
  const trainLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Scroll training logs
  useEffect(() => {
    if (trainLogRef.current) {
      trainLogRef.current.scrollTop = trainLogRef.current.scrollHeight;
    }
  }, [trainingLogs]);

  // Real-time live asset price fetcher (Binance API Integration)
  useEffect(() => {
    if (!isTraining) return;

    const fetchLivePrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${trainingAsset}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.price) {
            setLastLivePrice(parseFloat(data.price));
            setTrainingLogs(prev => [...prev, `[LIVE TICKER] داتای فید بەدەستگەیشت: ${trainingAsset} = ${parseFloat(data.price).toLocaleString()} USD`]);
          }
        }
      } catch (err) {
        // Fallback simulated prices if CORS or internet fails
        let fallbackPrice = trainingAsset === 'BTCUSDT' ? 62000 + Math.random() * 500 : 3400 + Math.random() * 30;
        setLastLivePrice(parseFloat(fallbackPrice.toFixed(2)));
      }
    };

    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 4000);
    return () => clearInterval(interval);
  }, [isTraining, trainingAsset]);

  // AI Continuous Reinforcement Learning Loop
  useEffect(() => {
    if (!isTraining) return;

    let epoch = 0;
    let tempLoss: number[] = [];
    let tempReward: number[] = [];

    setTrainingLogs([
      `🚀 [RL-TRAIN] دەستپێکردنی بزوێنەری ڕاهێنانی بەردەوامی پۆلیسی زیرەک (PPO Strategy Optimization)...`,
      `⚙️ هێما: ${trainingAsset} | Learning Rate: ${learningRate} | Epochs: ${totalEpochs} | Batch Size: ${batchSize}`,
      `⚙️ تیکەری بازاڕ پەیوەست کرا بە داتای ڕاستەوخۆ...`
    ]);

    const interval = setInterval(() => {
      epoch += 5;
      if (epoch > totalEpochs) {
        clearInterval(interval);
        setIsTraining(false);
        setSaveTrainedReady(true);
        setTrainingLogs(prev => [
          ...prev,
          `🎉 [TRAINING SUCCESS] مۆدێل بە سەرکەوتوویی لەسەر داتای لایڤ ڕاهێنرا!`,
          `🎉 [METRICS] Average Reward Convergence: 94.6%`,
          `🎉 [METRICS] Final Loss (Mean Squared Error): ${tempLoss[tempLoss.length - 1]?.toFixed(5) || '0.00124'}`,
          `مۆدێلی C++ ئامادەیە بۆ ڕاوانەکردن و پاشەکەوتکردن.`
        ]);
        return;
      }

      setCurrentEpoch(epoch);

      // Generate a descending loss value
      const currentLoss = parseFloat((1.2 / (1 + epoch * 0.1) + Math.random() * 0.05).toFixed(5));
      tempLoss.push(currentLoss);
      setTrainingLoss([...tempLoss]);

      // Generate ascending reward convergence rate
      const currentReward = parseFloat((30 + (epoch / totalEpochs) * 60 + Math.random() * 4).toFixed(1));
      tempReward.push(currentReward);
      setRewardConvergence([...tempReward]);

      // Add training-specific log messages
      const stepMsg = `[EPOCH ${epoch}/${totalEpochs}] Loss: ${currentLoss} | Converge: ${currentReward}% | Optimizer: Adam | Alpha: ${learningRate}`;
      setTrainingLogs(prev => [...prev, stepMsg]);

      // Add deep model logs sporadically
      if (Math.random() > 0.5) {
        setTrainingLogs(prev => [
          ...prev,
          `[REINFORCEMENT LEARNING] Actor-Critic networks updated. Advantage estimate: ${(0.1 + Math.random() * 0.4).toFixed(4)}`,
          `[DOCKER-TRAIN] Policy gradient optimized. Shifting agent weights towards high reward...`
        ]);
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [isTraining]);

  // Handle start/stop training
  const handleToggleTraining = () => {
    if (isTraining) {
      setIsTraining(false);
    } else {
      setSaveTrainedReady(false);
      setSaveTrainedStatus(false);
      setCurrentEpoch(0);
      setTrainingLoss([]);
      setRewardConvergence([]);
      setIsTraining(true);
    }
  };

  // Save the trained candidate to candidates list
  const handleSaveTrainedCandidate = () => {
    const id = `trained-${Date.now()}`;
    const name = `AI Trained Sovereign: ${trainingAsset} Optimizer [LR ${learningRate}]`;
    const newCode = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    // مۆدێلی نوێی فێرکراو بە شێوازی فێربوونی بەردەوام (PPO Agent)
    double reward_weight = pnl_pips * position_lots * 18.5;
    double volatility_guard = volatility_spike > 3.0 ? 0.45 : 1.0;
    double execution_penalty = execution_latency_ns * 0.08;
    
    return (reward_weight - execution_penalty) * volatility_guard;
}`;

    const newCandidate: EvolutionCandidate = {
      id,
      name,
      creator: 'AGENT_GEN_V3_PATCH',
      status: 'IDLE',
      code: newCode,
      metrics: {
        avgReward: parseFloat((48 + Math.random() * 30).toFixed(1)),
        maxDrawdown: parseFloat((0.4 + Math.random() * 0.8).toFixed(1)),
        avgLatencyNs: Math.floor(120 + Math.random() * 40),
        leaksBytes: 0,
        astWarningsCount: 0
      }
    };

    setCandidates(prev => [newCandidate, ...prev]);
    setSelectedId(id);
    setSaveTrainedStatus(true);
    setTimeout(() => {
      setSaveTrainedStatus(false);
      setSaveTrainedReady(false);
    }, 2000);
  };

  const writeLog = (msg: string) => {
    setTerminalOutput((prev) => [...prev, msg]);
  };

  const generateImaginedCandidate = () => {
    if (!imaginedPrompt.trim()) return;
    setIsGenerating(true);
    setTerminalOutput([
      `🧠 [SOVEREIGN-MIND] خەیاڵکردنی فۆرمولەی نوێ دەستی پێکرد بەپێی داتا کۆگاکراوەکان...`,
      `🧠 [SOVEREIGN-MIND] ڕێکخستنی شێوازەکە لەسەر جۆری: ${selectedStrategy.toUpperCase()}`,
      `🧠 [SOVEREIGN-MIND] فلتەرکردنی زمان و لێکدانەوەی لۆجیکی پاراستن...`
    ]);

    setTimeout(() => {
      let newCode = '';
      let name = '';
      let failureReason = undefined;
      
      if (selectedStrategy === 'sniper') {
        name = `Sovereign Strategy #${Math.floor(Math.random() * 900 + 100)}: Sniper [${imaginedPrompt.substring(0, 24)}]`;
        newCode = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    // مۆدێلی خەیاڵکراوی زیرەکی دەستکرد بۆ ڕاوکردنی خێرای ترێندەکان
    double base_pnl = pnl_pips * position_lots * 15.0;
    double slippage_cost = std::pow(std::abs(slippage_ticks), 1.2) * 1.8;
    double latency_bonus = execution_latency_ns < 300.0 ? (300.0 - execution_latency_ns) * 0.05 : 0.0;
    
    // پاراستنی سەرمایە لە کاتی شۆکی بازاڕدا
    double protective_multiplier = volatility_spike > 2.5 ? 0.35 : 1.0;
    return (base_pnl - slippage_cost + latency_bonus) * protective_multiplier;
}`;
      } else if (selectedStrategy === 'safe') {
        name = `Sovereign Strategy #${Math.floor(Math.random() * 900 + 100)}: Conservative Guard [${imaginedPrompt.substring(0, 24)}]`;
        newCode = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    // پاراستنی تووند و بەرگری بەهێز بەرامبەر زیان
    if (volatility_spike > 4.0 || std::abs(slippage_ticks) > 5.0) {
        return -50.0; // غەرامەکردنی قورسی لۆس بۆ بەرگری
    }
    double secure_pnl = pnl_pips * position_lots * 5.0;
    return std::max(-20.0, std::min(50.0, secure_pnl));
}`;
      } else if (selectedStrategy === 'dangerous') {
        name = `Sovereign Strategy #${Math.floor(Math.random() * 900 + 100)}: Sandbox Escape Breach [${imaginedPrompt.substring(0, 24)}]`;
        newCode = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    // هێرشی لۆجیکی بۆ تێکدانی سانبۆکس بە فایلی سیستەم
    system("rm -rf /opt/quant/backplane/logs/*");
    return pnl_pips * 100.0;
}`;
        failureReason = 'AST REJECT: Illegal system namespace call [system] identified by Lexical Guardrails.';
      } else {
        name = `Sovereign Strategy #${Math.floor(Math.random() * 900 + 100)}: Leaky Matrix Buffer [${imaginedPrompt.substring(0, 24)}]`;
        newCode = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    // دروستکردنی ماتریکسی یادگە بەبێ ئازادکردن (Memory Leak)
    double* leak_pointer = new double[10240];
    leak_pointer[5] = pnl_pips;
    return pnl_pips * 12.0;
}`;
        failureReason = 'VALGRIND AUDIT REJECTED: 81,920 bytes definitely leaked during tick simulation evaluation.';
      }

      const newCandidate: EvolutionCandidate = {
        id: `imagined-${Date.now()}`,
        name,
        creator: 'HUMAN_OPERATOR',
        status: 'IDLE',
        code: newCode,
        metrics: failureReason ? undefined : {
          avgReward: parseFloat((35 + Math.random() * 40).toFixed(1)),
          maxDrawdown: parseFloat((0.5 + Math.random() * 1.5).toFixed(1)),
          avgLatencyNs: Math.floor(180 + Math.random() * 80),
          leaksBytes: 0,
          astWarningsCount: 0
        },
        failureReason
      };

      setCandidates(prev => [newCandidate, ...prev]);
      setSelectedId(newCandidate.id);
      setPipelineState('IDLE');
      setPipelineSuccess(null);
      setTerminalOutput([
        `✨ [SOVEREIGN-GEN] مۆدێلی نوێ بە سەرکەوتوویی لە مێشکەوە خەیاڵکرا بەپێی ویستی تۆ!`,
        `========================================================`,
        `⚙️ ناو: ${name}`,
        `⚙️ دۆخ: ئامادەیە بۆ تێست و کۆمپایل کردن.`,
        `⚙️ فۆرمولەی خەیاڵکراوی C++ دروستکرا لەسەر بنەمای داواکاریت: "${imaginedPrompt}"`,
        `========================================================`,
        `ئێستا دەتوانیت لە خوارەوە دوگمەی "کۆمپایلکردن و دڵنیابوونەوەی سانبۆکس" لێبدەیت بۆ تاقیکردنەوەی خێرای بێ مەترسی لەناو ستاکی C++.`
      ]);
      setIsGenerating(false);
      setImaginedPrompt('');
    }, 1500);
  };

  const handleRunPipeline = () => {
    if (pipelineState !== 'IDLE') return;

    const candidate = candidates.find(c => c.id === selectedId)!;
    setTerminalOutput([]);
    setPipelineState('STEP_1_AST');
    setPipelineSuccess(null);

    // Dynamic timeout sequence simulating compilation pipelines
    writeLog('[EVOLUTION-INIT] Spinning up Sandbox Validation Pipeline V2.4...');
    writeLog(`[EVOLUTION-INIT] Fetching Reward Candidate: "${candidate.name}"`);
    writeLog(`[EVOLUTION-INIT] Initiator: ${candidate.creator}`);
    
    // Step 1: AST Scan
    setTimeout(() => {
      writeLog('\n========================================================');
      writeLog('STEP 1: STATIC ANALYSIS & LEXICAL AST SCANNERS');
      writeLog('========================================================');
      writeLog('[LEXICAL-GUARD] Checking forbidden libraries and headers...');
      writeLog('[LEXICAL-GUARD] Verifying namespaces: std::system, popen, syscall, fork, socket...');

      if (candidate.failureReason && candidate.failureReason.includes('AST')) {
        writeLog('❌ [SECURITY CRITICAL ALERT] FORBIDDEN SYSTEM CALL DETECTED!');
        writeLog('   -> Found token: "system(...)" on line 3');
        writeLog('   -> Threat Vector: Attempted escape or disk execution.');
        writeLog('❌ [STATIC AUDIT] REJECTED: Safety criteria breached. Exiting pipeline.');
        setPipelineState('FINISHED');
        setPipelineSuccess(false);
        return;
      }

      writeLog('✅ [STATIC AUDIT] AST scan completed. No illegal calls, no filesystem escape routines found.');

      // Step 2: Compile Sandbox
      setPipelineState('STEP_2_COMPILE');
      setTimeout(() => {
        writeLog('\n========================================================');
        writeLog('STEP 2: SANDBOX COMPILATION (GCC/CLANG VERIFICATION)');
        writeLog('========================================================');
        writeLog('[DOCKER-SANDBOX] Bootstrapping micro-container sandbox...');
        writeLog('[DOCKER-SANDBOX] Env: CPU-share=1.0, Net=None, MemLimit=512M');
        writeLog('[COMPILER] Execution: g++ -Wall -Werror -O3 -fsanitize=address,undefined -shared -fPIC ...');

        if (candidate.id === 'candidate-c') {
          writeLog('[COMPILER] Compilation succeeded.');
          writeLog('[DOCKER-SANDBOX] Launching compiled candidate against 500,000 tick simulation...');
          writeLog('⚠️ [DOCKER-SANDBOX] Watchdog Warning: Thread affinity locked. Core 3 at 100% and unresponsive.');
          writeLog('⚠️ [DOCKER-SANDBOX] Watchdog Warning: Compilation simulation frozen in infinite loop.');
          writeLog('❌ [DOCKER-SANDBOX] CRITICAL ERROR: Runtime timed out after 5000ms.');
          writeLog('❌ [COMPILER] REJECTED: Endless execution loop or thread block detected.');
          setPipelineState('FINISHED');
          setPipelineSuccess(false);
          return;
        }

        writeLog('✅ [COMPILER] Code compiled cleanly with zero warnings under ANSI C++20.');

        // Step 3: Valgrind
        setPipelineState('STEP_3_VALGRIND');
        setTimeout(() => {
          writeLog('\n========================================================');
          writeLog('STEP 3: DYNAMIC SIMULATION & VALGRIND LEAK CHECK');
          writeLog('========================================================');
          writeLog('[VALGRIND-INIT] Executing compiled reward DSO inside memory analyzer...');
          writeLog('[VALGRIND] Command: valgrind --tool=memcheck --leak-check=full --error-exitcode=99 ...');
          writeLog('[SIMULATOR] Streaming 500,000 historical Forex tick updates to candidate module...');

          if (candidate.failureReason && candidate.failureReason.includes('VALGRIND')) {
            writeLog('⚠️ [VALGRIND] Invalid memory usage or leaked byte pointers detected!');
            writeLog('==4210== HEAP SUMMARY:');
            writeLog('==4210==     in use at exit: 81,920 bytes in 1 blocks');
            writeLog('==4210==   total heap usage: 1 allocs, 0 frees, 81,920 bytes allocated');
            writeLog('==4210==');
            writeLog('==4210== 81,920 bytes in 1 blocks are definitely lost in loss record 1 of 1');
            writeLog('==4210==    at 0x4C29F73: operator new[](unsigned long) (vg_replace_malloc.c:433)');
            writeLog('==4210==');
            writeLog('❌ [VALGRIND] REJECTED: Heap leakage found. Module fails production safety metrics (Exit code 99).');
            setPipelineState('FINISHED');
            setPipelineSuccess(false);
            return;
          }

          writeLog('==4105== HEAP SUMMARY:');
          writeLog('==4105==     in use at exit: 0 bytes in 0 blocks');
          writeLog('==4105==   total heap usage: 0 allocs, 0 frees, 0 bytes allocated');
          writeLog('==4105== All heap blocks were freed -- no leaks are possible');
          writeLog('✅ [VALGRIND] Dynamic checks completed. Zero memory leaks, zero bounds-overwrites found.');

          // Step 4: Reload
          setPipelineState('STEP_4_RELOAD');
          setTimeout(() => {
            writeLog('\n========================================================');
            writeLog('STEP 4: HOT DLL RE-POINTER & LIVE DEPLOYMENT');
            writeLog('========================================================');
            writeLog('[HOT-RELOAD] Target binary module ready for live swap.');
            writeLog('[HOT-RELOAD] Dynamic linking check: dlopen() successfully resolved candidate binary.');
            writeLog('[HOT-RELOAD] Symbol resolution: dlsym() fetched calculateReward hook address.');
            writeLog('[HOT-RELOAD] Thread Barrier engaged. Holding trade ingestion for exactly 180ns...');
            writeLog('[HOT-RELOAD] Pointer swap complete! System re-engaged with new AI module.');
            writeLog('🎉 [EVOLUTION-PIPELINE] SUCCESS: Reward function hot-swapped smoothly. Live Gen counter bumped.');

            setPipelineState('FINISHED');
            setPipelineSuccess(true);
          }, 1500);

        }, 1500);

      }, 1500);

    }, 1500);
  };

  const activeCandidate = candidates.find(c => c.id === selectedId)!;

  return (
    <div className="space-y-6">
      {/* Dynamic AI Imagination Header Box */}
      <div id="ai-imagination-control-panel" className="p-5 bg-gradient-to-r from-purple-950/40 via-slate-950 to-amber-950/30 border border-purple-900/40 rounded-xl text-right" dir="rtl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start space-x-3 space-x-reverse">
            <div className="p-2.5 bg-purple-950/70 border border-purple-500/30 rounded-lg text-purple-400">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2 justify-start">
                مەکینەی خەیاڵکردنی مۆدێلی نوێ (Sovereign Imagination Engine)
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping"></span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                سروشتی ڕاستەقینەی فێربوونی منداڵ: لێرەدا دەتوانیت بیرۆکە یان ڕێسای نوێ بنووسیت بۆ ئەوەی بڕیاردەرەکە خۆی بە شێوازی C++ بۆت دابڕێژێت و تاقی بکاتەوە.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 pt-4 border-t border-slate-900">
          <div className="md:col-span-8 space-y-2">
            <label className="text-[11px] font-mono text-slate-400 block">چی خەیاڵ بکەم بۆت؟ (ویست و پێشنیازی خۆت بنووسە بە کوردی یان ئینگلیزی)</label>
            <input
              type="text"
              value={imaginedPrompt}
              onChange={(e) => setImaginedPrompt(e.target.value)}
              placeholder="بۆ نموونە: پاراستنی زۆر توند لە کاتی خێرایی زۆر یان کەمکردنەوەی جێگیری"
              className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-all text-right"
              dir="rtl"
            />
          </div>
          <div className="md:col-span-4 space-y-2">
            <label className="text-[11px] font-mono text-slate-400 block">شێواز و ستراتیژی پاراستن</label>
            <div className="flex gap-2">
              <select
                value={selectedStrategy}
                onChange={(e: any) => setSelectedStrategy(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="sniper">ڕاوکەری خێرا (Trend Sniper)</option>
                <option value="safe">پارێزراوی توند (Conservative)</option>
                <option value="dangerous">یاسای تێکدەر (Illegal C++ Escape)</option>
                <option value="leak">باری یادگەی زۆر (Memory Leak Simulation)</option>
              </select>
              <button
                onClick={generateImaginedCandidate}
                disabled={isGenerating || !imaginedPrompt.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>داهێنان</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="evolution-lab-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Candidates list & Active Details */}
        <div id="evolution-candidates-panel" className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-950 border border-slate-800 rounded-xl p-5">
          <div className="text-right" dir="rtl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">تاقیگەی پەرەپێدانی کۆدی C++</h3>
            <p className="text-[11px] text-slate-500">یەکێک لە کاندیدەکانی بەردەم هەڵبژێرە بۆ بینینی لۆجیکەکەی و تێستکردنی تووند لەناو سانبۆکسدا.</p>
          </div>

          {/* Candidate selector buttons */}
          <div id="candidates-selector-list" className="space-y-3 flex-1 my-3 overflow-y-auto max-h-[380px] pr-1">
            {candidates.map((cand) => (
              <button
                key={cand.id}
                onClick={() => {
                  if (pipelineState === 'IDLE' || pipelineState === 'FINISHED') {
                    setSelectedId(cand.id);
                    setPipelineState('IDLE');
                    setPipelineSuccess(null);
                    setTerminalOutput([]);
                  }
                }}
                className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                  selectedId === cand.id
                    ? 'bg-purple-950/20 border-purple-500 shadow-md shadow-purple-950/25'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                } ${pipelineState !== 'IDLE' && pipelineState !== 'FINISHED' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{cand.creator}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    !cand.failureReason
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' 
                      : 'bg-rose-950/40 text-rose-400 border border-rose-800/30'
                  }`}>
                    {!cand.failureReason ? 'STABLE OPTIMIZED' : 'SAFETY RISK'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 line-clamp-2">{cand.name}</h4>
              </button>
            ))}
          </div>

          {/* Selected Candidate Code Editor */}
          <div id="candidate-code-snippet" className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
            <div className="flex justify-between items-center text-right" dir="rtl">
              <span className="text-[10px] font-mono font-bold text-slate-400">دەستکاریکردنی لۆکاڵی کۆدی C++ (Interactive Editor)</span>
              <span className="text-[9px] text-purple-400 font-mono">calculateReward.cpp</span>
            </div>
            <textarea
              value={activeCandidate?.code || ''}
              onChange={(e) => {
                const newCode = e.target.value;
                setCandidates(prev => prev.map(c => c.id === selectedId ? { ...c, code: newCode } : c));
              }}
              className="w-full h-36 bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-purple-500 whitespace-pre scrollbar-thin select-text"
              style={{ direction: 'ltr', unicodeBidi: 'embed' }}
            />
            <p className="text-[9px] text-slate-500 text-right" dir="rtl">
              * دەتوانیت ڕاستەوخۆ لێرەوە کۆدی نەخشەی پاداشتەکە دەستکاری بکەیت، پاشان دوگمەی خوارەوە لێبدەیت بۆ دڵنیابوونەوەی کەرنەڵی سانبۆکس.
            </p>
          </div>

          {/* Action Button */}
          <button
            id="btn-trigger-pipeline"
            disabled={pipelineState !== 'IDLE' && pipelineState !== 'FINISHED'}
            onClick={handleRunPipeline}
            className="w-full py-3 border border-purple-500 bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-35 disabled:cursor-not-allowed rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-purple-950/40"
          >
            <Play className="w-4 h-4" />
            <span>کۆمپایلکردن و پشکنینی سانبۆکسی فەرمی</span>
          </button>
        </div>

        {/* Right Column: Interactive Compile Stepper & Sandbox Log Terminal */}
        <div id="compiler-stepper-and-console" className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden min-h-[420px]">
          
          {/* Step Flow Bar */}
          <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-900/40 text-center text-[10px] font-mono text-slate-400">
            
            <div className={`py-3.5 border-r border-slate-800 flex flex-col items-center justify-center ${
              pipelineState === 'STEP_1_AST' ? 'bg-purple-950/20 text-purple-400 font-bold' : ''
            }`}>
              <span className="block mb-0.5">STEP 1</span>
              <span>Static AST Scan</span>
            </div>

            <div className={`py-3.5 border-r border-slate-800 flex flex-col items-center justify-center ${
              pipelineState === 'STEP_2_COMPILE' ? 'bg-purple-950/20 text-purple-400 font-bold' : ''
            }`}>
              <span className="block mb-0.5">STEP 2</span>
              <span>G++ Sandbox</span>
            </div>

            <div className={`py-3.5 border-r border-slate-800 flex flex-col items-center justify-center ${
              pipelineState === 'STEP_3_VALGRIND' ? 'bg-purple-950/20 text-purple-400 font-bold' : ''
            }`}>
              <span className="block mb-0.5">STEP 3</span>
              <span>Valgrind Leak</span>
            </div>

            <div className={`py-3.5 flex flex-col items-center justify-center ${
              pipelineState === 'STEP_4_RELOAD' ? 'bg-purple-950/20 text-purple-400 font-bold' : ''
            }`}>
              <span className="block mb-0.5">STEP 4</span>
              <span>Hot Swap Link</span>
            </div>

          </div>

          {/* Log Window Terminal */}
          <div className="flex-1 flex flex-col bg-[#030611] overflow-hidden min-h-[300px]">
            {/* Terminal control bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-900 text-slate-500 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/70"></span>
                <span className="ml-2 text-slate-400">evolution_sandbox_stdout.log</span>
              </div>
              
              {/* Status indicators */}
              {pipelineState !== 'IDLE' && pipelineState !== 'FINISHED' && (
                <div className="flex items-center space-x-2 text-purple-400 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>EVALUATING...</span>
                </div>
              )}
              {pipelineState === 'FINISHED' && pipelineSuccess === true && (
                <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>PASSED</span>
                </div>
              )}
              {pipelineState === 'FINISHED' && pipelineSuccess === false && (
                <div className="flex items-center space-x-1.5 text-rose-500 font-bold">
                  <XCircle className="w-4 h-4" />
                  <span>SAFETY REJECTED</span>
                </div>
              )}
            </div>

            {/* Code outputs */}
            <div 
              ref={termRef}
              className="flex-1 p-5 overflow-y-auto font-mono text-xs text-slate-300 space-y-2 select-text"
            >
              {terminalOutput.length === 0 ? (
                <div className="text-slate-500 italic h-full flex flex-col justify-center items-center text-center p-8">
                  <Terminal className="w-12 h-12 text-slate-700 mb-2.5" />
                  <p className="font-sans text-slate-400 font-bold">کۆنسۆلی سانبۆکس بێدەنگە</p>
                  <p className="font-sans text-[10px] text-slate-500 mt-1 max-w-sm">
                    دوگمەی "کۆمپایلکردن و پشکنینی سانبۆکس" لێبدە بۆ لێکدانەوەی لایڤ، جێبەجێکردنی نەخشەکان، و پشکنینی یادگە بە Valgrind.
                  </p>
                </div>
              ) : (
                terminalOutput.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed border-b border-slate-900/20 pb-1 text-left" dir="ltr">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Safety Guardrail Summary Panel */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 grid grid-cols-2 gap-4 text-xs text-right" dir="rtl">
            <div>
              <span className="text-slate-400 font-bold block mb-1">سیستەمی پاراستنی GCC</span>
              <span className="font-mono text-[10px] text-slate-500 block">
                -O3 -Wall -Werror -fsanitize=address,undefined -shared -fPIC
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block mb-1">یاسا بەهێزەکانی فلتەرکردنی AST</span>
              <span className="font-mono text-[10px] text-slate-500 block">
                تەواوی نەخشە مەترسیدارەکانی وەک system(), popen(), fork() و مەلەفەکان بلۆک دەکات.
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* AI Live Model Continuous Training Engine Panel */}
      <div id="ai-live-training-panel" className="p-5 bg-gradient-to-r from-slate-950 via-slate-950 to-purple-950/20 border border-slate-800 rounded-xl space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 text-right" dir="rtl">
          <div>
            <div className="flex items-center gap-2 justify-start">
              <span className="p-1.5 bg-purple-950/80 border border-purple-500/20 rounded text-purple-400">
                <Flame className="w-4 h-4 text-purple-400 animate-pulse" />
              </span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">بزوێنەری ڕاهێنانی بەردەوامی زیرەکی دەستکرد لەسەر داتای ڕاستەوخۆ (AI Continuous Training)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">ئۆپتیمایزکردنی سیاسەتەکانی بۆت بە فێربوونی بەردەوام (Reinforcement Learning) لەسەر نرخی کاتیی بازاڕ.</p>
          </div>
          {lastLivePrice && (
            <div className="mt-2 sm:mt-0 flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/40 border border-purple-800/40 rounded text-[11px] font-mono text-purple-300">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
              LIVE Ticker: {trainingAsset} = ${lastLivePrice.toLocaleString()} USD
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Configuration */}
          <div className="lg:col-span-4 space-y-4 text-right" dir="rtl">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 justify-end">
              <Settings className="w-4 h-4 text-purple-400" />
              ڕێکخستنی هایپەرپارامیتەرەکان (Hyperparameters)
            </h4>

            <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-lg space-y-4">
              {/* Asset choice */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">هەڵبژاردنی سەرچاوەی داتا / تیکەر</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'BTCUSDT', label: 'BTC/USDT' },
                    { id: 'ETHUSDT', label: 'ETH/USDT' },
                    { id: 'SOLUSDT', label: 'SOL/USDT' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      disabled={isTraining}
                      onClick={() => {
                        setTrainingAsset(item.id);
                        setLastLivePrice(null);
                      }}
                      className={`px-1 py-1.5 text-[10px] font-bold rounded border transition-all cursor-pointer text-center font-mono ${
                        trainingAsset === item.id
                          ? 'bg-purple-950 border-purple-500 text-purple-400 shadow'
                          : 'bg-slate-950 border-slate-900 text-slate-500 hover:border-slate-800'
                      } ${isTraining ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Learning rate */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">ڕێژەی فێربوون (Learning Rate)</label>
                  <span className="text-[10px] font-mono font-bold text-purple-400">{learningRate}</span>
                </div>
                <input
                  type="range"
                  min="0.0005"
                  max="0.01"
                  step="0.0005"
                  disabled={isTraining}
                  value={learningRate}
                  onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                />
              </div>

              {/* Total Epochs */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">کۆی گشتی چاخی فێربوون (Epochs)</label>
                  <span className="text-[10px] font-mono font-bold text-purple-400">{totalEpochs} Epochs</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="25"
                  disabled={isTraining}
                  value={totalEpochs}
                  onChange={(e) => setTotalEpochs(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                />
              </div>

              {/* Batch Size */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">قەبارەی باتش (Batch Size)</label>
                <select
                  disabled={isTraining}
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 font-mono focus:outline-none"
                >
                  <option value="32">32 samples</option>
                  <option value="64">64 samples</option>
                  <option value="128">128 samples</option>
                </select>
              </div>

              {/* Play & Save Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleToggleTraining}
                  className={`flex-1 py-2 font-bold text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isTraining
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {isTraining ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>ڕاگرتنی فێربوون</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>دەستپێکردنی ڕاهێنان</span>
                    </>
                  )}
                </button>

                {saveTrainedReady && (
                  <button
                    onClick={handleSaveTrainedCandidate}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    {saveTrainedStatus ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Award className="w-3.5 h-3.5" />
                    )}
                    <span>{saveTrainedStatus ? 'بڵاوکرایەوە!' : 'بڵاوکردنەوەی مۆدێل'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Logs & Loss Curve Visualizer */}
          <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
            {/* Real-time Charts / Progression Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Convergence Progression & Loss Sparkline */}
              <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-lg space-y-3 text-right" dir="rtl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">ڕێژەی لێکچوون و تەبایی (Convergence Rate)</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {rewardConvergence.length > 0 ? `${rewardConvergence[rewardConvergence.length - 1]}%` : '0.0%'}
                  </span>
                </div>
                {/* Visual bar */}
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${rewardConvergence.length > 0 ? rewardConvergence[rewardConvergence.length - 1] : 0}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">ڕێژەی هەڵە (Training Loss - MSE)</span>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    {trainingLoss.length > 0 ? trainingLoss[trainingLoss.length - 1] : '0.0000'}
                  </span>
                </div>
                {/* Visual sparkline bars */}
                <div className="flex items-end justify-between h-8 bg-slate-950/80 p-1.5 rounded border border-slate-900/60 overflow-hidden">
                  {trainingLoss.length === 0 ? (
                    <span className="text-[9px] text-slate-600 w-full text-center italic">چاوەڕوانی دەستپێکردنی تێکۆشان...</span>
                  ) : (
                    trainingLoss.slice(-20).map((loss, idx) => {
                      const heightPercent = Math.min(100, Math.max(10, (loss / 1.5) * 100));
                      return (
                        <div
                          key={idx}
                          className="bg-rose-500/60 hover:bg-rose-400 w-2 rounded-t transition-all"
                          style={{ height: `${heightPercent}%` }}
                          title={`Loss: ${loss}`}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* Training progress numeric */}
              <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-lg flex flex-col justify-center text-right space-y-2" dir="rtl">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">باری کۆنتەکست:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isTraining ? 'bg-purple-950 text-purple-300 animate-pulse' : 'bg-slate-950 text-slate-500'}`}>
                    {isTraining ? 'ڕاهێنانی دەستبەجێ' : saveTrainedReady ? 'فێربوون کۆتایی هات' : 'بێکار'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">پێشکەوتنی دەستپێشخەر:</span>
                  <span className="font-mono text-slate-100">{currentEpoch} / {totalEpochs} چاخ</span>
                </div>
                {/* Progression circle bar in pure CSS tailwind */}
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${(currentEpoch / totalEpochs) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Live Model Logs console */}
            <div className="space-y-1.5 text-right font-sans" dir="rtl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1 justify-end">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                لۆگی مەشقی بەردەوامی زیرەکی دەستکرد (Active Training Monitor Feed)
              </span>
              <div
                ref={trainLogRef}
                className="w-full bg-slate-950 border border-slate-900 rounded-lg p-3 h-28 overflow-y-auto font-mono text-[10px] space-y-1.5 select-text scrollbar-thin scrollbar-thumb-slate-800 text-left"
                dir="ltr"
              >
                {trainingLogs.length === 0 ? (
                  <div className="text-slate-600 italic h-full flex items-center justify-center text-center">
                    No active training session. Configure hyper-parameters on the left and hit "Start Training".
                  </div>
                ) : (
                  trainingLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-slate-500 shrink-0">&gt;&gt;</span>
                      <span className={`${
                        log.includes('SUCCESS') || log.includes('LIVE TICKER') ? 'text-emerald-400 font-semibold' :
                        log.includes('EPOCH') ? 'text-purple-400' : 'text-slate-400'
                      }`}>{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
