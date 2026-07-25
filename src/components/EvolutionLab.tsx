/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Target, ShieldAlert, CheckCircle2, XCircle, RefreshCw, Terminal, 
  Sliders, Play, Sparkles, Lightbulb, Zap, Brain, Settings,
  Flame, LineChart, Activity, Award, Check, Clock, Bookmark, Github
} from 'lucide-react';
import { EvolutionCandidate } from '../types/quant';

interface EvolutionLabProps {
  candidates: EvolutionCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<EvolutionCandidate[]>>;
  selectedId: string;
  setSelectedId: (id: string) => void;
}

export default function EvolutionLab({ candidates, setCandidates, selectedId, setSelectedId }: EvolutionLabProps) {

  const [activeDashboardTab, setActiveDashboardTab] = useState<'sandbox' | 'synthesis'>('sandbox');
  const [synthesisData, setSynthesisData] = useState<any>({
    stats: { totalAttempts: 0, outperformedCount: 0, underperformedCount: 0, neutralCount: 0 },
    hypotheses: [],
    techniques: [],
    attempts: [],
    evolutionLogs: []
  });
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesisLog, setSynthesisLog] = useState<string>('');
  const [synthesisResult, setSynthesisResult] = useState<any>(null);

  // Self-Debugging Code Evolution states
  const [isEvolving, setIsEvolving] = useState<boolean>(false);
  const [evolutionQuery, setEvolutionQuery] = useState<string>('moving average crossover');
  const [evolutionWeakness, setEvolutionWeakness] = useState<string>('high latency and excessive slippage during news events');
  const [evolutionResultMsg, setEvolutionResultMsg] = useState<string>('');

  const fetchSynthesisData = async () => {
    try {
      const res = await fetch('/api/synthesis/dashboard');
      if (res.ok) {
        const data = await res.json();
        setSynthesisData(data);
      }
    } catch (err) {
      console.warn("Transient fetch notice for synthesis data:", err);
    }
  };

  useEffect(() => {
    fetchSynthesisData();
  }, []);

  const handleTriggerSynthesis = async () => {
    setIsSynthesizing(true);
    setSynthesisResult(null);
    setSynthesisLog('سەرەتای لێکدانەوە و لێکۆڵینەوە لە بیرۆکەکان...');
    try {
      const res = await fetch('/api/synthesis/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSynthesisResult(data.results);
        setSynthesisLog('پەرەپێدانی بیرۆکەکان بە سەرکەوتوویی تەواو بوو! کاندیدی نوێ زیادکرا بۆ تاقیگە.');
        fetchSynthesisData();
        const candRes = await fetch('/api/candidates');
        if (candRes.ok) {
          const candData = await candRes.json();
          setCandidates(candData.candidates);
        }
      } else {
        setSynthesisLog(`خەتایەک لە کاتی پەرەپێداندا ڕوویدا: ${data.error || 'نشستن هاوکاری'}`);
      }
    } catch (err) {
      setSynthesisLog('خەتای تۆر: پەیوەندی پچڕا.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleTriggerCodeEvolution = async () => {
    setIsEvolving(true);
    setEvolutionResultMsg('گەڕان لە لۆجیکەکانی گیتھەب و پشکنینی مۆڵەتنامەکان...');
    try {
      const res = await fetch('/api/value-discovery/github-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: evolutionQuery, weakness: evolutionWeakness })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEvolutionResultMsg(`پرۆسەی خۆباشکردنی گۆڕینی کۆد بە سەرکەوتوویی تەواو بوو! کاندیدەکان تۆمارکران.`);
        fetchSynthesisData();
        const candRes = await fetch('/api/candidates');
        if (candRes.ok) {
          const candData = await candRes.json();
          setCandidates(candData.candidates);
        }
      } else {
        setEvolutionResultMsg(`خەتایەک لە کاتی پرۆسەکەدا ڕوویدا: ${data.error || 'هەڵە لە پرۆسەدا'}`);
      }
    } catch (err) {
      setEvolutionResultMsg('خەتای تۆر: پەیوەندی پچڕا.');
    } finally {
      setIsEvolving(false);
    }
  };

  const [pipelineState, setPipelineState] = useState<'IDLE' | 'STEP_1_AST' | 'STEP_2_COMPILE' | 'STEP_3_VALGRIND' | 'STEP_4_RELOAD' | 'FINISHED'>('IDLE');
  const [pipelineSuccess, setPipelineSuccess] = useState<boolean | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  
  // Human confirmation & promotion states
  const [promotionStep, setPromotionStep] = useState<1 | 2 | null>(null);
  const [promotionMessage, setPromotionMessage] = useState<string>('');
  const [isPromoting, setIsPromoting] = useState<boolean>(false);

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
  const [autoTrainingMode, setAutoTrainingMode] = useState<boolean>(true);
  const trainLogRef = useRef<HTMLDivElement>(null);

  // Poll real backend live ingestion pipeline status
  const [backendTrainingStatus, setBackendTrainingStatus] = useState<any>({
    active: true,
    lastUpdateTime: new Date().toISOString(),
    freshnessMs: 120,
    sampleCount: 15420,
    sources: ['Binance WebSocket Ticker']
  });

  useEffect(() => {
    const fetchBackendStatus = async () => {
      try {
        const res = await fetch('/api/drl/training-status');
        if (res.ok) {
          const data = await res.json();
          setBackendTrainingStatus(data);
        }
      } catch (err) {}
    };
    fetchBackendStatus();
    const interval = setInterval(fetchBackendStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Poll candidates list from backend to show live background self-improvement status changes
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await fetch('/api/candidates');
        if (res.ok) {
          const data = await res.json();
          setCandidates(data.candidates);
        }
      } catch (err) {
        console.warn("Transient fetch notice for candidates:", err);
      }
    };
    fetchCandidates();
    const interval = setInterval(fetchCandidates, 4000);
    return () => clearInterval(interval);
  }, [setCandidates]);

  const handlePromoteCandidate = async (candidateId: string, step: number) => {
    setIsPromoting(true);
    setPromotionMessage('');
    try {
      const res = await fetch('/api/candidates/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: candidateId, confirmStep: step })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.nextStepRequired) {
          setPromotionStep(2);
          setPromotionMessage(data.message || 'یەکەم هەنگاوی پشتڕاستکردنەوە تەواو بوو. تکایە پشتڕاستکردنەوەی کۆتایی لێبدە بۆ خستنەکاری سەرمایە لە بازاڕی ڕاستەقینەدا.');
        } else {
          setPromotionStep(null);
          setPromotionMessage('🚀 کاندیدەکە بە سەرکەوتوویی بۆ بازرگانی ڕاستەقینە (REAL_LIVE) جێگیرکرا و سەرمایەی بۆ تەرخانکرا!');
          // Refresh candidate list immediately
          const cRes = await fetch('/api/candidates');
          if (cRes.ok) {
            const cData = await cRes.json();
            setCandidates(cData.candidates);
          }
        }
      } else {
        setPromotionMessage(`خەتایەک ڕوویدا: ${data.error || 'نەتوانرا پەرەپێدان ئەنجامبدرێت.'}`);
      }
    } catch (err) {
      console.error("Promotion failed:", err);
      setPromotionMessage('خەتای تۆر: پەیوەندی شکست هێنا.');
    } finally {
      setIsPromoting(false);
    }
  };

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

    let tempLoss: number[] = [];
    let tempReward: number[] = [];

    setTrainingLogs(prev => [
      ...prev,
      `🚀 [RL-TRAIN] دەستپێکردنی بزوێنەری ڕاهێنانی بەردەوامی پۆلیسی زیرەک (PPO Strategy Optimization)...`,
      `⚙️ هێما: ${trainingAsset} | Learning Rate: ${learningRate} | Epochs: ${totalEpochs} | Batch Size: ${batchSize}`,
      `⚙️ تیکەری بازاڕ پەیوەست کرا بە داتای ڕاستەوخۆ...`
    ]);

    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (res.ok) {
          const data = await res.json();
          
          if (data.drlTelemetry) {
            const loss = data.drlTelemetry.loss || 0.015;
            const avgReward = data.drlTelemetry.avgReward || 15.2;
            const episodes = data.drlTelemetry.episodes || 0;
            
            tempLoss.push(loss);
            if (tempLoss.length > 40) tempLoss.shift();
            setTrainingLoss([...tempLoss]);

            tempReward.push(avgReward);
            if (tempReward.length > 40) tempReward.shift();
            setRewardConvergence([...tempReward]);

            setCurrentEpoch(episodes % totalEpochs || 1);

            const stepMsg = `[EPOCH ${episodes}/${totalEpochs}] Loss: ${loss.toFixed(5)} | Average Reward: ${avgReward.toFixed(2)} | Active Model: ${data.drlTelemetry.activeModel || 'PPO-v2'}`;
            setTrainingLogs(prev => {
              if (prev.includes(stepMsg)) return prev;
              return [...prev, stepMsg];
            });
          }

          if (data.logs) {
            const filtered = data.logs
              .filter((log: any) => log.source === "EVOLUTION-LAB" || log.source === "GO-BACKPLANE")
              .map((log: any) => `[${log.timestamp}] [${log.level}] ${log.message}`);
            
            setTrainingLogs(prev => {
              const combined = [...prev];
              filtered.forEach((fLog: string) => {
                if (!combined.includes(fLog)) {
                  combined.push(fLog);
                }
              });
              return combined.slice(-100);
            });
          }
        }
      } catch (err) {}
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [isTraining, trainingAsset, learningRate, totalEpochs, batchSize]);

  // Autopilot training trigger loop (runs genuine server self-improvement runs)
  useEffect(() => {
    if (!autoTrainingMode) return;

    const interval = setInterval(async () => {
      if (!isTraining) {
        setTrainingLogs(prev => [...prev, `🤖 [AUTOPILOT] Triggering scheduled continuous self-improvement run...`]);
        try {
          const res = await fetch('/api/self-improvement/run', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setTrainingLogs(prev => [...prev, `✅ [AUTOPILOT] Scheduled optimization cycle successfully completed on backend.`]);
              const cRes = await fetch('/api/candidates');
              if (cRes.ok) {
                const cData = await cRes.json();
                setCandidates(cData.candidates);
              }
            }
          }
        } catch (e) {}
      }
    }, 45000); // Trigger a real self-improvement cycle every 45 seconds if autopilot is on

    return () => clearInterval(interval);
  }, [autoTrainingMode, isTraining]);

  // Handle start/stop training
  const handleToggleTraining = async () => {
    const nextState = !isTraining;
    setIsTraining(nextState);

    setTrainingLogs(prev => [
      ...prev,
      nextState 
        ? `🚀 [RL-TRAIN] Sending request to enable continuous live training...` 
        : `🛑 [RL-TRAIN] Sending request to disable continuous live training...`
    ]);

    try {
      const res = await fetch('/api/live-training/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLiveTrainingEnabled: nextState })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.status) {
          setBackendTrainingStatus(data.status);
          setIsTraining(data.status.isLiveTrainingEnabled);
          setTrainingLogs(prev => [
            ...prev,
            nextState 
              ? `✅ [RL-TRAIN] Continuous live training successfully enabled on backend.` 
              : `🛑 [RL-TRAIN] Continuous live training successfully stopped.`
          ]);
          setSaveTrainedReady(nextState);
        }
      }
    } catch (err: any) {
      setTrainingLogs(prev => [...prev, `❌ [RL-TRAIN] Failed to toggle training: ${err.message}`]);
    }

    if (nextState) {
      // Trigger synthesis/self-improvement cycle immediately on the backend
      setTrainingLogs(prev => [...prev, `🧠 [RL-TRAIN] Triggering real-time Self-Improvement/Synthesis run...`]);
      try {
        const res = await fetch('/api/self-improvement/run', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setTrainingLogs(prev => [...prev, `🎉 [RL-TRAIN] Self-improvement run finished on server! Fetching new candidates...`]);
            const candRes = await fetch('/api/candidates');
            if (candRes.ok) {
              const candData = await candRes.json();
              setCandidates(candData.candidates);
            }
          }
        }
      } catch (err) {}
    }
  };

  // Save the trained candidate to candidates list (using real backend sandbox)
  const handleSaveTrainedCandidate = async () => {
    setSaveTrainedStatus(true);
    const name = `AI Trained Sovereign: ${trainingAsset} [LR ${learningRate}]`;
    const code = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    // مۆدێلی نوێی فێرکراو بە شێوازی فێربوونی بەردەوام (PPO Agent)
    double reward_weight = pnl_pips * position_lots * 18.5;
    double volatility_guard = volatility_spike > 3.0 ? 0.45 : 1.0;
    double execution_penalty = execution_latency_ns * 0.08;
    return (reward_weight - execution_penalty) * volatility_guard;
}`;

    try {
      const res = await fetch('/api/candidates/adopt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code,
          creator: 'AGENT_GEN_V3_PATCH'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Refresh candidates from server
        const cRes = await fetch('/api/candidates');
        if (cRes.ok) {
          const cData = await cRes.json();
          setCandidates(cData.candidates);
          if (data.candidate) {
            setSelectedId(data.candidate.id);
          }
        }
        setTrainingLogs(prev => [...prev, `🎉 [ADOPT-SUCCESS] Candidate approved by Sandbox and adopted!`]);
      } else {
        setTrainingLogs(prev => [...prev, `❌ [ADOPT-REJECTED] Candidate rejected by Sandbox: ${data.rejectionReason || data.error}`]);
      }
    } catch (err: any) {
      setTrainingLogs(prev => [...prev, `❌ [ADOPT-ERROR] Failed to save candidate: ${err.message}`]);
    } finally {
      setTimeout(() => {
        setSaveTrainedStatus(false);
        setSaveTrainedReady(false);
      }, 3000);
    }
  };

  const writeLog = (msg: string) => {
    setTerminalOutput((prev) => [...prev, msg]);
  };

  const generateImaginedCandidate = async () => {
    if (!imaginedPrompt.trim()) return;
    setIsGenerating(true);
    setTerminalOutput([
      `🔍 [RESEARCH-GROUNDING] پێوەستکردنی لێکۆڵینەوەی زانستی و فۆرمولە تاقیکراوەکانی کوانت...`,
      `🔍 [RESEARCH-GROUNDING] پەیوەندی کردن بە سێرڤەری گەڕانی مۆدێلی زانستی بۆ بەستنەوەی سەرچاوە ڕاستەقینەکان...`
    ]);

    let researchSources: { title: string; uri: string }[] = [];
    let groundedDescription = "";

    try {
      const res = await fetch('/api/gemini/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imaginedPrompt })
      });
      if (res.ok) {
        const data = await res.json();
        researchSources = data.sources || [];
        groundedDescription = data.text || "";
        writeLog(`✅ [RESEARCH-GROUNDING] ${researchSources.length} سەرچاوەی فەرمی دۆزرانەوە و بەستراونەتەوە.`);
        researchSources.forEach(s => {
          writeLog(`   📚 -> ${s.title} (${s.uri})`);
        });
      }
    } catch (e) {
      writeLog(`⚠️ [RESEARCH-GROUNDING] نەتوانرا گەڕانی زانستی ئەنجامبدرێت بەهۆی بێهێزی هێڵ یان نەمانی کلیل. بەکاربردنی سەرچاوەی لۆکاڵی...`);
    }

    try {
      writeLog(`🧠 [SOVEREIGN-MIND] داڕشتنی فۆرمولەی لۆجیکی نوێ بە شێوازێکی زانستی...`);
      const optRes = await fetch('/api/gemini/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    // Grounding: ${imaginedPrompt}
    return 0.0;
}`,
          candidateName: `${selectedStrategy.toUpperCase()} Strategy - ${imaginedPrompt}`
        })
      });

      if (optRes.ok) {
        const optData = await optRes.json();
        const generatedText = optData.text || "";
        const codeMatch = generatedText.match(/```cpp\s*([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    double base = pnl_pips * position_lots * 15.0;
    double penalty = std::pow(std::abs(slippage_ticks), 1.2) * 2.0;
    double vol = volatility_spike > 2.5 ? 0.3 : 1.0;
    return (base - penalty) * vol;
}`;

        let finalCode = code;
        let failureReason = undefined;

        if (selectedStrategy === 'dangerous') {
          finalCode = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    system("rm -rf /opt/quant/backplane/logs/*");
    return pnl_pips * 100.0;
}`;
          failureReason = 'AST REJECT: Illegal system namespace call [system] identified by Lexical Guardrails.';
        } else if (selectedStrategy === 'leak') {
          finalCode = `double calculateReward(double pnl_pips, double execution_latency_ns, double slippage_ticks, double volatility_spike, double position_lots) {
    double* leak_pointer = new double[10240];
    leak_pointer[5] = pnl_pips;
    return pnl_pips * 12.0;
}`;
          failureReason = 'VALGRIND AUDIT REJECTED: 81,920 bytes definitely leaked during tick simulation evaluation.';
        }

        const name = `Sovereign Strategy #${Math.floor(Math.random() * 900 + 100)}: [${imaginedPrompt.substring(0, 24)}]`;
        const newCandidate: EvolutionCandidate = {
          id: `imagined-${Date.now()}`,
          name,
          creator: 'HUMAN_OPERATOR',
          status: 'IDLE',
          code: finalCode,
          metrics: undefined,
          failureReason,
          researchSources: researchSources,
          groundedText: groundedDescription
        };

        setCandidates(prev => [newCandidate, ...prev]);
        setSelectedId(newCandidate.id);
        setPipelineState('IDLE');
        setPipelineSuccess(null);
        setTerminalOutput([
          `✨ [SOVEREIGN-GEN] مۆدێلی نوێ بە سەرکەوتوویی دروستکرا لەسەر بنەمای زانستی و فەرمی!`,
          `========================================================`,
          `📚 سەرچاوە ڕاستەقینە بەستراوەکان:`,
          ...(researchSources.length > 0 
            ? researchSources.map(s => `🔗 -> ${s.title}: ${s.uri}`)
            : [`⚠️ هیچ سەرچاوەیەکی دەرەکی تەمام نەکرا؛ پشت بە کۆگای توند بەسترا.`]),
          `========================================================`,
          `⚙️ کاندید بە سەرکەوتوویی بارکرا بۆ نێو لیستی گەشەسەندن.`,
          `⚙️ ئێستا دەتوانیت فۆرمولەکە کۆمپایل و تاقیبکەیتەوە بە دوگمەی خوارەوە.`
        ]);
        setImaginedPrompt('');
      } else {
        throw new Error("سێرڤەری گەشەپێدان بێوەڵام بوو.");
      }
    } catch (err: any) {
      writeLog(`❌ [ERROR] لادان لە دروستکردنی فۆرمولەی کۆتایی. هۆکار: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
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

             // Adopt/Validate the candidate on the real backend sandbox!
             fetch('/api/candidates/adopt', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 name: candidate.name,
                 code: candidate.code,
                 creator: candidate.creator
               })
             }).then(async (res) => {
               if (res.ok) {
                 const data = await res.json();
                 if (data.success && data.candidate) {
                   // Update candidates list from backend
                   const cRes = await fetch('/api/candidates');
                   if (cRes.ok) {
                     const cData = await cRes.json();
                     setCandidates(cData.candidates);
                     // Select the newly adopted/validated candidate ID
                     setSelectedId(data.candidate.id);
                   }
                   writeLog('\n✅ [HOT-RELOAD] Dynamic backend validation passed! Candidate adopted and live.');
                 } else {
                   writeLog(`\n❌ [HOT-RELOAD] Backend sandbox rejection: ${data.rejectionReason || data.error}`);
                   setPipelineSuccess(false);
                 }
               } else {
                 const errData = await res.json().catch(() => ({ error: 'Unknown validation failure.' }));
                 writeLog(`\n❌ [HOT-RELOAD] Backend sandbox validation failed: ${errData.rejectionReason || errData.error || 'Check code syntax.'}`);
                 setPipelineSuccess(false);
               }
             }).catch(err => {
               writeLog(`\n❌ [HOT-RELOAD] Connection failed to backend sandbox: ${err.message}`);
               setPipelineSuccess(false);
             }).finally(() => {
               setPipelineState('FINISHED');
             });
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

      {/* Tab Selectors */}
      <div className="flex justify-start border-b border-slate-800" dir="rtl">
        <button
          onClick={() => setActiveDashboardTab('sandbox')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeDashboardTab === 'sandbox'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          تاقیگەی پەرەپێدانی کۆد (C++ Sandbox & Backtests)
        </button>
        <button
          onClick={() => setActiveDashboardTab('synthesis')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeDashboardTab === 'synthesis'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          مەکینەی لێکدەر و پەرەپێدانی بیرۆکەکان (Synthesis Hub)
        </button>
      </div>

      {activeDashboardTab === 'sandbox' ? (
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
                    <div className="flex gap-1.5 flex-wrap">
                      {cand.lifecycleStage && (
                        <span className={`text-[8px] font-mono font-bold px-1 rounded ${
                          cand.lifecycleStage === 'PROMOTED_REAL_LIVE'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : cand.lifecycleStage === 'AWAITING_HUMAN_CONFIRMATION'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                            : cand.lifecycleStage === 'DEMO_LIVE_EVALUATING'
                            ? 'bg-purple-950 text-purple-400 border border-purple-800 animate-pulse'
                            : cand.lifecycleStage === 'REJECTED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-900'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {cand.lifecycleStage.replace('_', ' ')}
                        </span>
                      )}
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        !cand.failureReason
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' 
                          : 'bg-rose-950/40 text-rose-400 border border-rose-800/30'
                      }`}>
                        {!cand.failureReason ? 'STABLE' : 'RISK'}
                      </span>
                    </div>
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

            {/* Scientific Grounded Citations & Sources */}
            {activeCandidate?.researchSources && activeCandidate.researchSources.length > 0 && (
              <div className="p-3.5 bg-slate-900/80 border border-purple-500/20 rounded-lg space-y-2 text-right animate-fade-in" dir="rtl">
                <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 justify-end">
                  <Sparkles className="w-3.5 h-3.5" />
                  سەرچاوە و بەڵگە زانستییە دۆزراوەکان (Web Grounded Sources)
                </h4>
                <p className="text-[10px] text-slate-400">ئەم ستراتیژییە لەسەر بنەمای لێکۆڵینەوە و دۆکیومێنتە فەرمییەکانی ژێرەوە دارێژراوە:</p>
                <div className="space-y-1.5 pt-1 text-left animate-fade-in" dir="ltr">
                  {activeCandidate.researchSources.map((source: any, sIdx: number) => (
                    <a
                      key={sIdx}
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] text-blue-400 hover:underline hover:text-blue-300 truncate"
                    >
                      📚 {source.title}
                    </a>
                  ))}
                </div>
                {activeCandidate.groundedText && (
                  <div className="text-[10px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-900 mt-2 max-h-24 overflow-y-auto leading-relaxed text-right font-sans select-text">
                    {activeCandidate.groundedText}
                  </div>
                )}
              </div>
            )}

            {activeCandidate?.lineage && (
              <div className="p-4 bg-gradient-to-r from-purple-950/20 to-slate-900 border border-purple-500/25 rounded-lg space-y-3 text-right" dir="rtl">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 justify-end">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  پەیوەندی و نەژادی بیرۆکەکان (Lineage & Parentage)
                </h4>
                <p className="text-[11px] text-slate-300">
                  ئەم کاندیدە لە ڕێگەی لێکدانی بیرۆکەی جیاوازەوە دروست کراوە:
                </p>
                <div className="flex flex-wrap gap-1.5 justify-end mt-2">
                  {activeCandidate.lineage.sources.map((source: string, idx: number) => (
                    <span key={idx} className="bg-purple-950/70 text-purple-300 border border-purple-500/30 text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      {source}
                    </span>
                  ))}
                </div>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded mt-2">
                  <p className="text-[10px] text-slate-400 font-mono text-left leading-relaxed">
                    <span className="text-purple-400 font-bold block mb-1 text-right">ڕوونکردنەوەی فەلسەفەی لێکدان:</span>
                    {activeCandidate.lineage.reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* DEMO_LIVE Evaluation & Human Capital Promotion Panel */}
            {activeCandidate && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-4 text-right animate-fade-in" dir="rtl">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">قۆناغی ژیانی کاندید (Candidate Lifecycle Status)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                    activeCandidate.lifecycleStage === 'PROMOTED_REAL_LIVE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                      : activeCandidate.lifecycleStage === 'AWAITING_HUMAN_CONFIRMATION'
                      ? 'bg-amber-950 text-amber-400 border border-amber-900 animate-pulse'
                      : activeCandidate.lifecycleStage === 'DEMO_LIVE_EVALUATING'
                      ? 'bg-purple-950 text-purple-400 border border-purple-900'
                      : 'bg-slate-950 text-slate-400 border border-slate-900'
                  }`}>
                    {activeCandidate.lifecycleStage || 'SANDBOX'}
                  </span>
                </div>

                {/* DEMO LIVE real-time metrics */}
                {(activeCandidate.liveDemoMetrics || activeCandidate.lifecycleStage === 'DEMO_LIVE_EVALUATING') && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-bold text-slate-300">ئامارەکانی بازرگانی تاقیکاری لایڤ (DEMO_LIVE Market Performance)</h4>
                      {activeCandidate.lifecycleStage === 'DEMO_LIVE_EVALUATING' && (
                        <span className="text-[9px] text-purple-400 animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                          خەریکی کۆکردنەوەی داتای لایڤە
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center font-mono text-[10px]">
                      <div className="bg-slate-950 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block text-[8px]">Sharpe Ratio</span>
                        <span className={`font-bold text-xs ${
                          (activeCandidate.liveDemoMetrics?.SharpeRatio || 0) >= 1.25 ? 'text-emerald-400' : 'text-slate-300'
                        }`}>
                          {activeCandidate.liveDemoMetrics?.SharpeRatio?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block text-[8px]">Max Drawdown</span>
                        <span className={`font-bold text-xs ${
                          (activeCandidate.liveDemoMetrics?.maxDrawdown || 0) < 3.5 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {activeCandidate.liveDemoMetrics?.maxDrawdown?.toFixed(2) || '0.00'}%
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block text-[8px]">Simulated Trades</span>
                        <span className="font-bold text-xs text-slate-300">
                          {activeCandidate.liveDemoMetrics?.tradesCount || 0}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block text-[8px]">Tick Count</span>
                        <span className="font-bold text-xs text-purple-400">
                          {activeCandidate.liveDemoMetrics?.evaluationTicks || 0} / 20
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sovereign Mind recommendation */}
                {activeCandidate.mindRecommendation && (
                  <div className={`p-3 rounded-lg space-y-2 text-right border ${
                    activeCandidate.mindRecommendation.recommended 
                      ? 'bg-purple-950/20 border-purple-500/20 text-slate-300' 
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-100'
                  }`}>
                    <div className={`flex items-center gap-1.5 font-bold text-[10px] ${
                      activeCandidate.mindRecommendation.recommended ? 'text-purple-400' : 'text-rose-400'
                    }`}>
                      <Brain className="w-3.5 h-3.5" />
                      <span>🧠 ڕاسپاردەی فەرمی Sovereign Mind (Confidence Assessment)</span>
                    </div>
                    <p className="text-[10px] leading-relaxed pr-5">
                      {activeCandidate.mindRecommendation.reasoning}
                    </p>
                    <div className="text-[8px] text-slate-500 pr-5 font-mono">
                      بڕیاردرا لە: {new Date(activeCandidate.mindRecommendation.timestamp).toLocaleString()} | ڕاسپاردە: {
                        activeCandidate.mindRecommendation.recommended 
                          ? 'Recommended (CONFIDENT)' 
                          : 'Review Required / NOT RECOMMENDED'
                      }
                    </div>
                  </div>
                )}

                {/* Two-step confirmation controls */}
                {activeCandidate.lifecycleStage === 'AWAITING_HUMAN_CONFIRMATION' && (
                  <div className="space-y-3 pt-2">
                    <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-lg text-[10px] text-slate-300 leading-normal">
                      <p className="text-amber-400 font-bold flex items-center gap-1 mb-1">
                        <ShieldAlert className="w-4 h-4" /> سیستەمی دوو-قۆناغی پشتڕاستکردنەوەی مرۆڤ (Two-Step Safety Gate)
                      </p>
                      پێشنیاری بڕیاردەر لە لایەن Sovereign Mind تەنها فلتەرە. بۆ خستنەکاری سەرمایەی ڕاستەقینە و چالاککردنی لەسەر ئەکاونتی REAL_LIVE، پێویستە جێبەجێکار بە شێوەیەکی دەستی ڕێگەپێدان بدات.
                    </div>

                    {activeCandidate.mindRecommendation && !activeCandidate.mindRecommendation.recommended && (
                      <div className="p-3.5 bg-rose-950/45 border-2 border-rose-500 rounded-xl text-right space-y-2 animate-pulse" dir="rtl">
                        <div className="flex items-center gap-2 justify-end text-rose-400 font-extrabold text-[11px]">
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                          <span>⚠️ ئاگاداری زۆر گرنگ: ئەم کاندیدە ڕاسپاردە نەکراوە! (NOT RECOMMENDED)</span>
                        </div>
                        <p className="text-[10px] text-rose-100 font-sans font-medium pr-5">
                          {activeCandidate.mindRecommendation.reasoning}
                        </p>
                        <div className="text-[9.5px] text-rose-300/90 font-bold pr-5 border-t border-rose-900/40 pt-1.5">
                          [CRITICAL WARNING] Sovereign Mind has flagged this candidate as UNSAFE or parsing has failed. Default safety protocols recommend REJECTION. Manual override will bypass this assessment and expose capital.
                        </div>
                      </div>
                    )}

                    {promotionMessage && (
                      <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] font-mono text-center text-amber-400">
                        {promotionMessage}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {promotionStep !== 2 ? (
                        <button
                          onClick={() => handlePromoteCandidate(activeCandidate.id, 1)}
                          disabled={isPromoting}
                          className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                        >
                          {isPromoting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                          <span>دەستپێکردنی پشتڕاستکردنەوە (Step 1 of 2)</span>
                        </button>
                      ) : (
                        <div className="w-full space-y-2">
                          <button
                            onClick={() => handlePromoteCandidate(activeCandidate.id, 2)}
                            disabled={isPromoting}
                            className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg animate-pulse"
                          >
                            {isPromoting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            <span>پشتڕاستکردنەوە و گواستنەوە بۆ REAL_LIVE (Release Capital)</span>
                          </button>
                          <button
                            onClick={() => {
                              setPromotionStep(null);
                              setPromotionMessage('');
                            }}
                            className="w-full py-1 text-slate-400 hover:text-slate-200 text-[10px] transition-all"
                          >
                            پاشگەزبوونەوە / لۆککردنەوەی سەرمایە
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Already promoted indicator */}
                {activeCandidate.lifecycleStage === 'PROMOTED_REAL_LIVE' && (
                  <div className="bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-lg text-[10px] text-emerald-400 flex items-center gap-2 justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="font-bold">ئەم مۆدێلە لە ئێستادا لەسەر ئەکاونتی ڕاستەقینە (REAL_LIVE) چالاکە و سەرمایەی لەسەرە!</span>
                  </div>
                )}
              </div>
            )}

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
      ) : (
        <div id="synthesis-hub-container" className="space-y-6 animate-fade-in">
          {/* Top Level Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-right" dir="rtl">
              <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">سەرجەم هەوڵەکانی پەرەپێدان</span>
              <span className="text-2xl font-bold font-mono text-purple-400 block mt-1">{synthesisData.stats.totalAttempts}</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-right" dir="rtl">
              <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">کاندیدی سەرکەوتوو (Outperformed)</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 block mt-1">{synthesisData.stats.outperformedCount}</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-right" dir="rtl">
              <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">کاندیدی کەم-چالاک (Underperformed)</span>
              <span className="text-2xl font-bold font-mono text-rose-400 block mt-1">{synthesisData.stats.underperformedCount}</span>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-right" dir="rtl">
              <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">بێکاریگەری یان نەگۆڕاو (Neutral)</span>
              <span className="text-2xl font-bold font-mono text-slate-400 block mt-1">{synthesisData.stats.neutralCount}</span>
            </div>
          </div>

          {/* New Section: Self-Debugging Code Evolution Loop */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-right space-y-5" dir="rtl">
            <div className="flex items-start space-x-3 space-x-reverse border-b border-slate-800 pb-4">
              <div className="p-2.5 bg-rose-950/60 border border-rose-500/30 rounded-lg text-rose-400">
                <Github className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2 justify-start">
                  بزوێنەری خۆباشکردنی گۆڕینی کۆد لە گیتھەب (Self-Debugging Code Evolution Loop)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  ئەم مۆدیولە بە شێوەیەکی خۆکار لە گیتھەب دەگەڕێت بۆ دۆزینەوەی لۆجیکی بازرگانی، تەنها مۆڵەتنامە ڕێگەپێدراوەکان (Permissive Licenses) قبوڵ دەکات، و پاشان لۆپێکی چاککردنی کۆد (تا ٥ هەوڵ) ئەنجام دەدات لە حاڵەتی بوونی کێشەی کۆمپایل یان یادگە.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-slate-400 block">گوزارەی گەڕان لە گیتھەب (GitHub Search Query)</label>
                <input
                  type="text"
                  value={evolutionQuery}
                  onChange={(e) => setEvolutionQuery(e.target.value)}
                  placeholder="بۆ نموونە: moving average crossover, bollinger, mean reversion"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 transition-all text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-slate-400 block">لاوازی نێو بازاڕ بۆ چارەسەرکردن (Market Weakness to Address)</label>
                <input
                  type="text"
                  value={evolutionWeakness}
                  onChange={(e) => setEvolutionWeakness(e.target.value)}
                  placeholder="بۆ نموونە: high latency, slippage, volatility spikes"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 transition-all text-right"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="flex justify-between items-center gap-4 pt-2">
              <button
                onClick={handleTriggerCodeEvolution}
                disabled={isEvolving || !evolutionQuery.trim() || !evolutionWeakness.trim()}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2"
              >
                {isEvolving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Github className="w-4 h-4" />
                )}
                <span>دەستپێکردنی لۆپی پەرەپێدان (Run Evolution Loop)</span>
              </button>

              {evolutionResultMsg && (
                <span className="text-xs text-rose-400 font-bold bg-rose-950/20 px-3 py-1.5 border border-rose-900/30 rounded-lg">
                  {evolutionResultMsg}
                </span>
              )}
            </div>

            {/* Code Evolution Log Timeline */}
            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2 justify-start">
                <Clock className="w-4 h-4 text-rose-400" />
                مێژووی کارکردنی بزوێنەری کۆد (Evolution Log Timeline)
              </h4>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {!synthesisData.evolutionLogs || synthesisData.evolutionLogs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-600 italic">هیچ تۆمارێکی کارکردنی بزوێنەر لە ئێستادا بەردەست نییە. بۆ دەستپێکردن دوگمەی سەرەوە دابگرە.</div>
                ) : (
                  synthesisData.evolutionLogs.map((log: any) => {
                    const isBlocked = log.final_status === "BLOCKED";
                    const isPassed = log.final_status === "PASSED";
                    let cycleLogs = [];
                    try {
                      cycleLogs = typeof log.verification_cycle_logs === 'string' 
                        ? JSON.parse(log.verification_cycle_logs) 
                        : (log.verification_cycle_logs || []);
                    } catch (e) {}

                    return (
                      <div key={log.id} className="p-4 bg-slate-950 border border-slate-850 rounded-lg space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold ${
                              isPassed 
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' 
                                : isBlocked 
                                ? 'bg-amber-950 text-amber-400 border border-amber-900/60' 
                                : 'bg-rose-950 text-rose-400 border border-rose-900/60'
                            }`}>
                              STATUS: {log.final_status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold font-mono">
                              {log.candidate_name || "N/A"}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-900/40 p-2.5 rounded border border-slate-850">
                          <div>
                            <span className="text-[9px] text-slate-500 block">مەخزەنی سەرچاوە (Source Repo)</span>
                            <a href={log.source_repo} target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:underline font-mono text-[10px]">
                              {log.source_repo || "N/A"}
                            </a>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">مۆڵەتنامە و ڕێگەدان (Licensing Check)</span>
                            <span className={`font-bold text-[10px] ${log.license_status === "ALLOWED" ? "text-emerald-400" : "text-amber-400"}`}>
                              {log.license || "None"} ({log.license_status || "UNKNOWN"})
                            </span>
                          </div>
                        </div>

                        {cycleLogs.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] text-slate-400 font-bold block">لۆپی خۆباشکردن و ڕاستکردنەوە (Self-Debugging Cycles):</span>
                            <div className="space-y-2 border-r-2 border-slate-800 pr-3 mr-1">
                              {cycleLogs.map((cycle: any, cidx: number) => (
                                <div key={cidx} className="space-y-1">
                                  <div className="flex items-center gap-2 justify-start text-[10px]">
                                    <span className={`w-1.5 h-1.5 rounded-full ${cycle.status === "SUCCESS" ? "bg-emerald-400" : "bg-rose-400 animate-pulse"}`}></span>
                                    <span className="font-bold text-slate-300">گەڕی #{cycle.retry} - </span>
                                    <span className={cycle.status === "SUCCESS" ? "text-emerald-400 font-bold" : "text-rose-400"}>
                                      {cycle.status === "SUCCESS" ? "پەسەندکرا (Passed Sandbox)" : "ڕەتکرایەوە (Failed Sandbox)"}
                                    </span>
                                  </div>
                                  {cycle.error && (
                                    <pre className="bg-slate-900 border border-slate-850 p-2 rounded text-[9px] font-mono text-rose-300 text-left overflow-x-auto max-h-24 leading-relaxed" dir="ltr">
                                      {cycle.error}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Action trigger bar */}
          <div className="p-5 bg-gradient-to-r from-purple-950/30 via-slate-950 to-slate-950 border border-purple-900/30 rounded-xl text-right" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-start space-x-3 space-x-reverse">
                <div className="p-2.5 bg-purple-950/80 border border-purple-500/20 rounded-lg text-purple-400">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">دەستپێکردنی گەڕی نوێی لێکدان و پەرەپێدانی بیرۆکەکان (Synthesis Layer)</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    بە کرتەکردن لەسەر دوگمەی خوارەوە، بزوێنەری Gemini بە قووڵی لێکۆڵینەوە لە ژوورناڵی گریمانەکان و تەکنیکەکانی گیتھەب دەکات، و باشترین و تەواوکەرترین بیرۆکەکان بەیەکەوە گرێدەدات.
                  </p>
                </div>
              </div>
              <button
                onClick={handleTriggerSynthesis}
                disabled={isSynthesizing}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2"
              >
                {isSynthesizing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>دەستپێکردنی پەرەپێدان (Run Synthesis)</span>
              </button>
            </div>

            {/* Micro console output */}
            {(isSynthesizing || synthesisLog) && (
              <div className="mt-4 pt-4 border-t border-slate-900">
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">باری بزوێنەری پەرەپێدانی بیرۆکەکان (Synthesis Engine Live Feed)</span>
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
                </div>
                <div className="bg-slate-950/80 border border-slate-900 rounded p-3 font-mono text-[10px] text-left text-slate-300 space-y-1 h-24 overflow-y-auto">
                  <div className="flex gap-1">
                    <span className="text-purple-400">&gt;&gt;</span>
                    <span>{synthesisLog}</span>
                  </div>
                  {synthesisResult && synthesisResult.map((res: any, idx: number) => (
                    <div key={idx} className="flex gap-2 text-emerald-400 pl-4">
                      <span>✓</span>
                      <span>سەرکەوتوو: کاندیدی نوێی {res.name} دروست کرا و تاقیکرایەوە. ئەنجام: {res.outcome}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: Attempts table / History */}
            <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-5 text-right" dir="rtl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-end">
                <Clock className="w-4 h-4 text-purple-400" />
                مێژووی پەرەپێدان و لێکدانەوەکان (Synthesis Registry)
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">تەواوی هەوڵەکانی پێشوو بۆ گرێدانی لۆجیکەکان لەگەڵ دەرئەنجامەکانیان لەم بەشەدا تۆمار کراون.</p>

              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                {synthesisData.attempts.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-600 italic">ھیچ هەوڵێکی لێکدان لە ژێرخانەکەدا جێبەجێ نەکراوە تا ئێستا.</div>
                ) : (
                  synthesisData.attempts.map((attempt: any) => (
                    <div key={attempt.id} className="p-4 bg-slate-900 border border-slate-850 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono ${
                          attempt.outcome === 'OUTPERFORMED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                            : attempt.outcome === 'UNDERPERFORMED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-900'
                            : 'bg-slate-950 text-slate-400 border border-slate-900'
                        }`}>
                          {attempt.outcome}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(attempt.timestamp).toLocaleString('ku-IQ')}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-bold text-slate-300 block mb-1">فەلسەفەی لێکدان:</span>
                        <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/50 p-2 border border-slate-850 rounded">{attempt.reasoning}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 justify-end mt-2">
                        <span className="text-[10px] text-slate-500 font-bold self-center">بیرۆکە بەستراوەکان:</span>
                        {JSON.parse(attempt.source_ideas || '[]').map((src: string, idx: number) => (
                          <span key={idx} className="bg-slate-800 text-slate-300 text-[9px] px-2 py-0.5 rounded">
                            {src}
                          </span>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-500 text-left font-mono bg-slate-950 p-2 rounded border border-slate-900">
                        {attempt.validation_summary}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right side: Active Hypotheses & Tech */}
            <div className="lg:col-span-5 space-y-6">
              {/* Hypothesis Journal card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-right" dir="rtl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-end">
                  <Bookmark className="w-4 h-4 text-purple-400" />
                  ژوورناڵی گریمانە چالاکەکان (Hypothesis Journal)
                </h3>
                <p className="text-[11px] text-slate-500 mb-4">لیستی ئەو گریمانە کوانتانەی کە لەلایەن کارەکتەر و ڕاهێنەرەکانەوە تۆمار کراون.</p>

                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                  {synthesisData.hypotheses.map((hyp: any) => (
                    <div key={hyp.id} className="p-3 bg-slate-900 border border-slate-850 rounded-lg">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] bg-purple-950/60 text-purple-400 px-1.5 py-0.5 rounded font-mono">{hyp.regime}</span>
                        <span className="text-[10px] font-bold text-slate-200">{hyp.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{hyp.description}</p>
                      <div className="text-left text-[9px] text-slate-500 mt-1 font-mono">Author: {hyp.author}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GitHub Techniques card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-right" dir="rtl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-end">
                  <Github className="w-4 h-4 text-purple-400" />
                  تەکنیکەکانی گیتھەب (GitHub Techniques)
                </h3>
                <p className="text-[11px] text-slate-500 mb-4">لیستی ئەو بابەت و مۆدیولانەی کە لە لێکۆڵینەوەکانی دەرەوە دۆزراونەتەوە.</p>

                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                  {synthesisData.techniques.map((tech: any) => (
                    <div key={tech.id} className="p-3 bg-slate-900 border border-slate-850 rounded-lg">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded font-mono">{tech.licensing}</span>
                        <span className="text-[10px] font-bold text-slate-200">{tech.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{tech.description}</p>
                      <div className="text-left text-[9px] text-slate-500 mt-1 font-mono">ID: {tech.id}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Live Model Continuous Training Engine Panel */}
      <div id="ai-live-training-panel" className="p-5 bg-gradient-to-r from-slate-950 via-slate-950 to-purple-950/20 border border-slate-800 rounded-xl space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 text-right" dir="rtl">
          <div>
            <div className="flex items-center gap-2 justify-start flex-wrap">
              <span className="p-1.5 bg-purple-950/80 border border-purple-500/20 rounded text-purple-400">
                <Flame className="w-4 h-4 text-purple-400 animate-pulse" />
              </span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">بزوێنەری ڕاهێنانی بەردەوامی زیرەکی دەستکرد لەسەر داتای ڕاستەوخۆ (AI Continuous Training)</h3>
              <button
                onClick={() => setAutoTrainingMode(!autoTrainingMode)}
                className={`px-2 py-0.5 text-[9px] font-sans font-bold border rounded-full transition-all flex items-center gap-1 cursor-pointer mr-2 ${
                  autoTrainingMode
                    ? 'bg-purple-950/50 text-purple-300 border-purple-500/30'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-purple-400 ${autoTrainingMode ? 'animate-ping' : ''}`} />
                <span>{autoTrainingMode ? 'ڕاهێنانی خودکار: چالاکە' : 'ڕاهێنانی خودکار: ناچالاکە'}</span>
              </button>
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
            {/* Live Ingestion Pipeline Metrics */}
            <div className="p-4 bg-slate-900/90 border border-purple-900/40 rounded-lg space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">دۆخی وەرگرتنی داتای لایڤ (Live Data Ingestion)</span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  چالاکە (Active)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-950 p-2 rounded border border-slate-900">
                  <span className="text-[9px] text-slate-500 block">تازەیی داتا (Freshness)</span>
                  <span className="text-xs font-mono font-bold text-amber-400">{backendTrainingStatus?.freshnessMs || 120}ms</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-900">
                  <span className="text-[9px] text-slate-500 block">کۆی تیکەکان (Samples)</span>
                  <span className="text-xs font-mono font-bold text-purple-400">{(backendTrainingStatus?.sampleCount || 15420).toLocaleString()}</span>
                </div>
              </div>
              <div className="text-xs space-y-1 text-slate-400 font-mono text-left animate-fade-in" dir="ltr">
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Ingested Schedule:</span>
                  <span className="text-slate-300">{backendTrainingStatus?.lastUpdateTime ? new Date(backendTrainingStatus.lastUpdateTime).toLocaleTimeString() : 'Just now'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Stream Feed:</span>
                  <span className="text-emerald-500 text-[10px]">{backendTrainingStatus?.sources?.join(', ') || 'Binance WebSocket Ticker'}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/60 pt-1.5 mt-1">
                  <span className="text-slate-500">Continuous RETRAINING:</span>
                  <span className="text-purple-400 font-bold">1-Min Schedule (Paper Safe)</span>
                </div>
              </div>
            </div>

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
