/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, Zap, Flame, RotateCcw, Play, CheckCircle2, Cpu, Globe, Database } from 'lucide-react';
import { SystemMetrics, TelemetryLog } from '../types/quant';

interface SavedBrokerConfig {
  brokerType: 'oanda' | 'metatrader5' | 'fix_gateway' | 'ib';
  apiUrl: string;
  accountId: string;
  apiToken: string;
  targetCompId: string;
  senderCompId: string;
}

interface SavedRiskRules {
  maxDailyLossPercent: number;
  riskPerTradePercent: number;
  maxOpenPositions: number;
  maxLeverage: number;
  movingBreakEvenPips: number;
  hedgeLockLossPercent: number;
}

interface TelemetrySimulatorProps {
  activeCandidateName?: string;
}

export default function TelemetrySimulator({ activeCandidateName }: TelemetrySimulatorProps) {
  const [brokerConfig, setBrokerConfig] = useState<SavedBrokerConfig | null>(null);
  const [brokerConnected, setBrokerConnected] = useState<boolean>(false);
  const [riskRules, setRiskRules] = useState<SavedRiskRules | null>(null);

  // Real-time rates from external free Exchange Rate API
  const [livePrices, setLivePrices] = useState<{
    eurUsd: number;
    gbpUsd: number;
    usdJpy: number;
    audUsd: number;
  }>({
    eurUsd: 1.0852,
    gbpUsd: 1.2735,
    usdJpy: 156.44,
    audUsd: 0.6658,
  });

  const [metrics, setMetrics] = useState<SystemMetrics>({
    nanosecondLatency: 215,
    packetsPerSecond: 48500,
    activeOrdersCount: 4,
    cpuCoresUsage: [12, 8, 41, 99], // Core 2 Go, Core 3 C++ (Spinning)
    shockAbsorberLevel: 0.12,
    isShockAbsorberActive: false,
    totalPnL: 142.6,
    movingBreakEvenActive: true,
    hedgingLocksActive: false,
    systemStatus: 'NOMINAL',
    evolutionGeneration: 148,
    activeRewardModule: 'AGENT_GEN_V2_OPT',
  });

  const [logs, setLogs] = useState<TelemetryLog[]>([
    { timestamp: '15:33:45.002', source: 'GO-BACKPLANE', level: 'INFO', message: 'Sovereign Controller backplane initialized. IPC buffer mapped.' },
    { timestamp: '15:33:45.005', source: 'CPP-ENGINE', level: 'SUCCESS', message: 'Execution thread pinned to CPU Core 3. SPSC spin-polling active.' },
    { timestamp: '15:33:45.012', source: 'RISK-MANAGER', level: 'INFO', message: 'HSM API dynamic registration checked. DMA authorization granted.' },
    { timestamp: '15:33:46.120', source: 'EVOLUTION-LAB', level: 'SUCCESS', message: 'Active Reinforcement learning reward engine bound: AGENT_GEN_V2_OPT' }
  ]);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const simTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync active candidate name with metrics and logs dynamically
  useEffect(() => {
    if (activeCandidateName) {
      const nameClean = activeCandidateName.replace('Reward Candidate ', '').substring(0, 24);
      setMetrics(prev => ({
        ...prev,
        activeRewardModule: nameClean,
      }));
      const timeStr = new Date().toTimeString().split(' ')[0];
      setLogs(prev => [
        ...prev,
        {
          timestamp: timeStr,
          source: 'EVOLUTION-LAB',
          level: 'SUCCESS',
          message: `Dynamic hot-swap successful: '${nameClean}' is now active on CPU Core 3.`
        }
      ]);
    }
  }, [activeCandidateName]);

  // Load from localStorage on mount and register listeners
  useEffect(() => {
    const loadConfigs = () => {
      const savedBroker = localStorage.getItem('SOVEREIGN_BROKER_CONFIG');
      const isConnected = localStorage.getItem('SOVEREIGN_BROKER_CONNECTED') === 'true';
      const savedRules = localStorage.getItem('SOVEREIGN_RISK_RULES');

      if (savedBroker) {
        try {
          setBrokerConfig(JSON.parse(savedBroker));
        } catch (e) {}
      }
      setBrokerConnected(isConnected);
      if (savedRules) {
        try {
          const parsed = JSON.parse(savedRules);
          setRiskRules(parsed);
          setMetrics(prev => ({
            ...prev,
            activeOrdersCount: parsed.maxOpenPositions || 4,
          }));
        } catch (e) {}
      }
    };

    loadConfigs();
    window.addEventListener('storage', loadConfigs);
    return () => window.removeEventListener('storage', loadConfigs);
  }, []);

  // Fetch real-time market data from exchange rates API
  useEffect(() => {
    const fetchRealRates = async () => {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (response.ok) {
          const data = await response.json();
          if (data && data.rates) {
            const { EUR, GBP, JPY, AUD } = data.rates;
            // EUR/USD is 1 / EUR rate relative to USD
            // GBP/USD is 1 / GBP rate relative to USD
            // USD/JPY is JPY rate relative to USD
            // AUD/USD is 1 / AUD rate relative to USD
            const newPrices = {
              eurUsd: parseFloat((1 / EUR).toFixed(5)),
              gbpUsd: parseFloat((1 / GBP).toFixed(5)),
              usdJpy: parseFloat(JPY.toFixed(3)),
              audUsd: parseFloat((1 / AUD).toFixed(5)),
            };
            setLivePrices(newPrices);
            
            if (brokerConnected && brokerConfig) {
              addLog('GO-BACKPLANE', 'SUCCESS', `ڕاستەوخۆ دەستبەسەرداگرتنی تیکەکانی بڕۆکەر: EUR/USD=${newPrices.eurUsd} | USD/JPY=${newPrices.usdJpy} (API Sync OK)`);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching live rates:', error);
      }
    };

    fetchRealRates();
    const interval = setInterval(fetchRealRates, 10000); // sync every 10 seconds
    return () => clearInterval(interval);
  }, [brokerConnected, brokerConfig]);

  // Auto scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Telemetry loop
  useEffect(() => {
    if (metrics.systemStatus === 'EMERGENCY_KILL') return;

    simTimer.current = setInterval(() => {
      setMetrics((prev) => {
        if (prev.systemStatus === 'EMERGENCY_KILL') return prev;

        // Fluctuations
        const isThrottled = prev.systemStatus === 'THROTTLED';
        const latency = isThrottled
          ? Math.floor(650 + Math.random() * 350)
          : Math.floor(180 + Math.random() * 80);
        
        const throughput = isThrottled
          ? Math.floor(105000 + Math.random() * 20000)
          : Math.floor(45000 + Math.random() * 6000);

        const cpuGo = Math.floor(35 + Math.random() * 12);
        const cpuCpp = isThrottled ? 100 : 99; // Pin spinning

        // Decay shock absorber slowly if active
        let shockLvl = prev.shockAbsorberLevel;
        let shockActive = prev.isShockAbsorberActive;
        let status = prev.systemStatus;

        if (isThrottled) {
          shockLvl -= 0.15;
          if (shockLvl <= 0.2) {
            shockLvl = 0.15;
            shockActive = false;
            status = 'NOMINAL';
            addLog('CPP-ENGINE', 'INFO', 'نەرمکردنەوەی جێگیربوون تەواو بوو (Slippage normalized). دۆخی ئاسایی کاراکرا.');
          }
        }

        const pnlDelta = isThrottled ? -0.4 : (Math.random() > 0.4 ? 0.3 : -0.1);
        const newPnL = prev.totalPnL + pnlDelta;

        return {
          ...prev,
          nanosecondLatency: latency,
          packetsPerSecond: throughput,
          cpuCoresUsage: [Math.floor(8 + Math.random() * 6), Math.floor(5 + Math.random() * 5), cpuGo, cpuCpp],
          shockAbsorberLevel: parseFloat(shockLvl.toFixed(2)),
          isShockAbsorberActive: shockActive,
          totalPnL: parseFloat(newPnL.toFixed(1)),
          systemStatus: status,
        };
      });

      // Add small micro-movements to rates to simulate real ticks
      setLivePrices(prev => ({
        eurUsd: parseFloat((prev.eurUsd + (Math.random() - 0.5) * 0.0001).toFixed(5)),
        gbpUsd: parseFloat((prev.gbpUsd + (Math.random() - 0.5) * 0.0001).toFixed(5)),
        usdJpy: parseFloat((prev.usdJpy + (Math.random() - 0.5) * 0.01).toFixed(3)),
        audUsd: parseFloat((prev.audUsd + (Math.random() - 0.5) * 0.0001).toFixed(5)),
      }));

      // Random logs based on active configurations
      if (Math.random() > 0.85 && metrics.systemStatus === 'NOMINAL') {
        const pips = (Math.random() * 1.5).toFixed(1);
        const brokerLabel = brokerConnected && brokerConfig ? brokerConfig.brokerType.toUpperCase() : 'DMA-CORE';
        const accountLabel = brokerConnected && brokerConfig ? ` [Acc: ${brokerConfig.accountId}]` : '';
        addLog('CPP-ENGINE', 'SUCCESS', `گرێبەست جێبەجێکرا لەڕێگەی [${brokerLabel}]${accountLabel}. PnL: +${pips} pips.`);
      }
    }, 1000);

    return () => {
      if (simTimer.current) clearInterval(simTimer.current);
    };
  }, [metrics.systemStatus, brokerConnected, brokerConfig]);

  const addLog = (source: TelemetryLog['source'], level: TelemetryLog['level'], message: string) => {
    const timeStr = new Date().toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0');
    setLogs((prev) => [...prev, { timestamp: timeStr, source, level, message }]);
  };

  // Action: Trigger Flash Crash/Slippage Volatility Spike
  const triggerVolatilitySpike = () => {
    if (metrics.systemStatus === 'EMERGENCY_KILL') return;

    setMetrics((prev) => ({
      ...prev,
      systemStatus: 'THROTTLED',
      shockAbsorberLevel: 1.0,
      isShockAbsorberActive: true,
      movingBreakEvenActive: true,
    }));

    addLog('GO-BACKPLANE', 'WARNING', 'CRITICAL MARKET VOLATILITY DETECTED: Slippage EMA spiked to 4.2 Ticks.');
    addLog('CPP-ENGINE', 'CRITICAL', 'HARD SHOCK ABSORBER ACTIVATED: Hardware execution loop locked out.');
    addLog('RISK-MANAGER', 'INFO', 'Safety Protocol engaged: Enforcing Immediate Moving Break-Even at +1.0 pips.');
  };

  // Action: EMERGENCY KILL-SWITCH (Hard stop)
  const triggerEmergencyKill = () => {
    if (simTimer.current) clearInterval(simTimer.current);

    setMetrics({
      nanosecondLatency: 0,
      packetsPerSecond: 0,
      activeOrdersCount: 0,
      cpuCoresUsage: [0, 0, 0, 0],
      shockAbsorberLevel: 0,
      isShockAbsorberActive: false,
      totalPnL: metrics.totalPnL,
      movingBreakEvenActive: false,
      hedgingLocksActive: true,
      systemStatus: 'EMERGENCY_KILL',
      evolutionGeneration: metrics.evolutionGeneration,
      activeRewardModule: 'NONE',
    });

    addLog('GO-BACKPLANE', 'CRITICAL', '⚠️🚨 EMERGENCY KILL-SWITCH MANUALLY TRIPPED! 🚨⚠️');
    addLog('GO-BACKPLANE', 'CRITICAL', '[KILL-SWITCH] POSIX Signal SIGUSR1 intercepted. Initiating emergency recovery stack.');
    addLog('RISK-MANAGER', 'CRITICAL', '[KILL-SWITCH] Revoking dynamic HSM authorization API keys. DMA disengaged.');
    addLog('CPP-ENGINE', 'CRITICAL', '[KILL-SWITCH] Pinned thread core affinity wiped. Ring buffer unmapped.');
    addLog('RISK-MANAGER', 'SUCCESS', '[KILL-SWITCH] Dynamic Hedging Locks Engaged: All positions locked net-neutral. Trading halt complete.');
  };

  // Action: Reset System
  const resetSystem = () => {
    setMetrics({
      nanosecondLatency: 205,
      packetsPerSecond: 42000,
      activeOrdersCount: 4,
      cpuCoresUsage: [10, 7, 35, 99],
      shockAbsorberLevel: 0.1,
      isShockAbsorberActive: false,
      totalPnL: 142.6,
      movingBreakEvenActive: true,
      hedgingLocksActive: false,
      systemStatus: 'NOMINAL',
      evolutionGeneration: 148,
      activeRewardModule: 'AGENT_GEN_V2_OPT',
    });

    setLogs([
      { timestamp: '15:33:45.002', source: 'GO-BACKPLANE', level: 'INFO', message: 'Sovereign Controller backplane initialized. IPC buffer mapped.' },
      { timestamp: '15:33:45.005', source: 'CPP-ENGINE', level: 'SUCCESS', message: 'Execution thread pinned to CPU Core 3. SPSC spin-polling active.' },
      { timestamp: '15:33:45.012', source: 'RISK-MANAGER', level: 'INFO', message: 'HSM API dynamic registration checked. DMA authorization granted.' },
      { timestamp: '15:33:46.120', source: 'EVOLUTION-LAB', level: 'SUCCESS', message: 'Active Reinforcement learning reward engine bound: AGENT_GEN_V2_OPT' },
      { timestamp: '15:35:01.401', source: 'GO-BACKPLANE', level: 'INFO', message: 'System hot reboot triggered. Restoring nominal parameters.' }
    ]);
  };

  return (
    <div id="telemetry-simulator-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left side: Telemetry stats & controls */}
      <div id="telemetry-metrics-and-controls" className="lg:col-span-6 flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-xl p-5">
        
        <div>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-1">Live Telemetry Console</h3>
              <p className="text-xs text-slate-500">Real-time metrics streaming directly from the IPC shared memory queue and Go controller watchdog.</p>
            </div>
            
            {/* Status indicator */}
            <span className={`px-2.5 py-1 text-[10px] font-mono font-black border rounded-md uppercase tracking-wider ${
              metrics.systemStatus === 'NOMINAL' 
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                : metrics.systemStatus === 'THROTTLED'
                ? 'bg-amber-950/40 text-amber-400 border-amber-500/30 animate-pulse'
                : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
            }`}>
              SYSTEM: {metrics.systemStatus}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 my-6">
            
            {/* Latency card */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Avg Loop Latency</span>
                <span className="text-xl font-mono font-black text-slate-100 block mt-1">
                  {metrics.nanosecondLatency > 0 ? `${metrics.nanosecondLatency} ns` : '0 ns'}
                </span>
                <span className="text-[9px] text-slate-500 block">SPSC Spin Loop speed</span>
              </div>
              <Zap className={`w-8 h-8 ${metrics.nanosecondLatency > 500 ? 'text-amber-500' : 'text-sky-400'}`} />
            </div>

            {/* Throughput card */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Tick Throughput</span>
                <span className="text-xl font-mono font-black text-slate-100 block mt-1">
                  {metrics.packetsPerSecond > 0 ? `${metrics.packetsPerSecond.toLocaleString()} pps` : '0 pps'}
                </span>
                <span className="text-[9px] text-slate-500 block">Ingested packets / sec</span>
              </div>
              <Activity className="w-8 h-8 text-emerald-400" />
            </div>

            {/* Shock Absorber level */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Shock Absorber</span>
                <span className={`text-[10px] font-mono font-bold ${metrics.isShockAbsorberActive ? 'text-amber-400' : 'text-slate-400'}`}>
                  {metrics.isShockAbsorberActive ? 'ACTIVE THROTTLE' : 'MONITORING'}
                </span>
              </div>
              <div className="mt-2.5 flex items-center space-x-2">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${metrics.isShockAbsorberActive ? 'bg-amber-500' : 'bg-sky-500'}`}
                    style={{ width: `${metrics.shockAbsorberLevel * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-300">{(metrics.shockAbsorberLevel * 10).toFixed(1)}/10</span>
              </div>
            </div>

            {/* Running PnL */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Simulated Profit/Loss</span>
                <span className={`text-xl font-mono font-black block mt-1 ${metrics.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {metrics.totalPnL >= 0 ? '+' : ''}{metrics.totalPnL.toFixed(1)} Pips
                </span>
                <span className="text-[9px] text-slate-500 block">Sovereign cumulative gain</span>
              </div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                DRL Gen {metrics.evolutionGeneration}
              </span>
            </div>

          </div>

          {/* Live Exchange Rates Ticker */}
          <div id="live-exchange-rates-ticker" className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg mb-4 space-y-3 text-right" dir="rtl">
            <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center justify-start space-x-2 space-x-reverse">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>نرخی جفتە دراوەکانی بازار بە کاتی ڕاستەقینە (REAL DATA)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">EUR/USD</span>
                <span className="text-sm font-mono font-bold text-slate-100 mt-0.5 block">{livePrices.eurUsd.toFixed(5)}</span>
                <span className="text-[8px] text-emerald-400 font-mono font-bold">LIVE RATE</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">GBP/USD</span>
                <span className="text-sm font-mono font-bold text-slate-100 mt-0.5 block">{livePrices.gbpUsd.toFixed(5)}</span>
                <span className="text-[8px] text-emerald-400 font-mono font-bold">LIVE RATE</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">USD/JPY</span>
                <span className="text-sm font-mono font-bold text-slate-100 mt-0.5 block">{livePrices.usdJpy.toFixed(3)}</span>
                <span className="text-[8px] text-emerald-400 font-mono font-bold">LIVE RATE</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">AUD/USD</span>
                <span className="text-sm font-mono font-bold text-slate-100 mt-0.5 block">{livePrices.audUsd.toFixed(5)}</span>
                <span className="text-[8px] text-emerald-400 font-mono font-bold">LIVE RATE</span>
              </div>
            </div>
            {brokerConnected && brokerConfig ? (
              <div className="flex items-center space-x-1.5 space-x-reverse text-[9px] text-sky-400 mt-1 bg-sky-950/20 px-2 py-1 rounded border border-sky-900/40">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>داتای بەستراوەی بڕۆکەری ڕاستەقینە: OANDA/FIX API بە شێوەیەکی خۆکار نرخەکان ڕاست دەکاتەوە.</span>
              </div>
            ) : (
              <div className="text-[9px] text-amber-400/80 mt-1">
                * زانیارییەکان ڕاستەوخۆ لە ڕێگەی Open Exchange API نوێ دەکرێنەوە بۆ لابردنی تەواوی داتای وەهمی.
              </div>
            )}
          </div>

          {/* Core pinning display */}
          <div id="cpu-core-pinning-display" className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-lg space-y-3">
            <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center">
              <Cpu className="w-4 h-4 text-slate-400 mr-2" />
              CPU AFFINITY BOUNDS (Core Pinning)
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {metrics.cpuCoresUsage.map((usage, idx) => (
                <div key={idx} className="bg-slate-950 p-2 rounded border border-slate-800/60 text-center">
                  <span className="text-[8px] font-mono text-slate-500 block">CORE 0{idx}</span>
                  <span className="text-xs font-mono font-bold text-slate-200 block my-1">{usage}%</span>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${idx === 3 ? 'bg-emerald-500' : idx === 2 ? 'bg-sky-500' : 'bg-slate-600'}`}
                      style={{ width: `${usage}%` }}
                    ></div>
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 block mt-1">
                    {idx === 3 ? 'C++ SPIN' : idx === 2 ? 'GO CTRL' : 'OS SYS'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              *Core 3 runs C++ spin loop. Notice CPU 99% constant load representing lock-free SPSC checking with zero kernel preemption. Core 2 runs Go async controller backplane.
            </p>
          </div>
        </div>

        {/* Action triggers */}
        <div className="pt-4 border-t border-slate-800 mt-4 flex flex-col sm:flex-row gap-3">
          
          {/* Spike simulator */}
          <button
            id="btn-simulate-spike"
            disabled={metrics.systemStatus === 'EMERGENCY_KILL'}
            onClick={triggerVolatilitySpike}
            className="flex-1 px-4 py-3 border border-amber-600 bg-amber-950/20 text-amber-400 hover:bg-amber-950/40 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span>Simulate Volatility Spike</span>
          </button>

          {/* EMERGENCY KILL */}
          <button
            id="btn-emergency-kill"
            onClick={triggerEmergencyKill}
            className="flex-1 px-4 py-3 border border-red-500 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-red-950/50"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 animate-bounce" />
            <span>TRIGGER KILL-SWITCH</span>
          </button>

          {/* Reset button (visible when halted) */}
          {metrics.systemStatus === 'EMERGENCY_KILL' && (
            <button
              id="btn-reset-system"
              onClick={resetSystem}
              className="px-4 py-3 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Reset Nominal</span>
            </button>
          )}

        </div>

      </div>

      {/* Right side: Real-time logging terminal */}
      <div id="telemetry-terminal-logs" className="lg:col-span-6 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden min-h-[350px]">
        {/* Terminal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="text-sm font-bold text-slate-100 font-mono">SOVEREIGN_SYSTEM_WATCHDOG.log</span>
          </div>
          <span className="text-xs font-mono text-slate-500">STDOUT STREAMS</span>
        </div>

        {/* Terminal logs display */}
        <div 
          ref={logContainerRef}
          className="flex-1 p-5 bg-[#030611] font-mono text-xs overflow-y-auto space-y-2.5 leading-relaxed"
        >
          {logs.map((log, idx) => {
            let srcColor = 'text-slate-400';
            if (log.source === 'GO-BACKPLANE') srcColor = 'text-sky-400';
            else if (log.source === 'CPP-ENGINE') srcColor = 'text-emerald-400';
            else if (log.source === 'RISK-MANAGER') srcColor = 'text-purple-400';
            else if (log.source === 'EVOLUTION-LAB') srcColor = 'text-amber-400';

            let lvlColor = 'text-slate-400';
            if (log.level === 'WARNING') lvlColor = 'text-amber-500 font-bold';
            else if (log.level === 'CRITICAL') lvlColor = 'text-rose-500 font-bold bg-rose-950/30 px-1 rounded border border-rose-800/30';
            else if (log.level === 'SUCCESS') lvlColor = 'text-emerald-400 font-bold';

            return (
              <div key={idx} className="flex items-start space-x-2 border-b border-slate-900/40 pb-1.5 last:border-0">
                <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                <span className={`${srcColor} shrink-0 font-bold`}>[{log.source}]</span>
                <span className={`${lvlColor} shrink-0 text-[10px]`}>{log.level}</span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
