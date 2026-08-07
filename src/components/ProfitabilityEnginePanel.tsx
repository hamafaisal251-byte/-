/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  BarChart2, 
  Sliders, 
  Activity, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Layers, 
  DollarSign, 
  Scale, 
  Target
} from 'lucide-react';
import { WfoEvaluationSummary } from '../services/walkForwardService';
import { ExecutionSimResult } from '../services/microstructureExecutionService';
import { OfiSignalResult } from '../services/orderFlowService';
import { RiskSizingResult } from '../services/dynamicRiskSizingService';

export default function ProfitabilityEnginePanel() {
  const [activeSubTab, setActiveSubTab] = useState<'wfo' | 'execution' | 'orderflow' | 'risk'>('wfo');
  const [loading, setLoading] = useState<boolean>(false);

  // 1. WFO State
  const [wfoResult, setWfoResult] = useState<WfoEvaluationSummary | null>(null);

  // 2. Microstructure Execution State
  const [execSymbol, setExecSymbol] = useState<string>('EUR/USD');
  const [execType, setExecType] = useState<'BUY' | 'SELL'>('BUY');
  const [execSize, setExecSize] = useState<number>(2.5);
  const [execPrice, setExecPrice] = useState<number>(1.08520);
  const [execDepth, setExecDepth] = useState<number>(10.0);
  const [execVolSpike, setExecVolSpike] = useState<number>(1.5);
  const [execResult, setExecResult] = useState<ExecutionSimResult | null>(null);

  // 3. OFI State
  const [ofiSymbol, setOfiSymbol] = useState<string>('EUR/USD');
  const [ofiBid, setOfiBid] = useState<number>(1.08520);
  const [ofiAsk, setOfiAsk] = useState<number>(1.08528);
  const [ofiBidVol, setOfiBidVol] = useState<number>(5.4);
  const [ofiAskVol, setOfiAskVol] = useState<number>(2.8);
  const [ofiResult, setOfiResult] = useState<OfiSignalResult | null>(null);

  // 4. Dynamic Risk Sizing State
  const [equity, setEquity] = useState<number>(100000);
  const [winRate, setWinRate] = useState<number>(58);
  const [winLossRatio, setWinLossRatio] = useState<number>(1.45);
  const [riskVolSpike, setRiskVolSpike] = useState<number>(1.0);
  const [stopLossPips, setStopLossPips] = useState<number>(15);
  const [riskResult, setRiskResult] = useState<RiskSizingResult | null>(null);

  // Run WFO Scan
  const runWfoScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wfo/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: 'candidate-a',
          candidateName: 'Sniper HFT Strategy v2.4'
        })
      });
      const data = await res.json();
      if (data.success) {
        setWfoResult(data.summary);
      }
    } catch (err) {
      console.error('WFO scan failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run Microstructure Execution Sim
  const runExecSim = async () => {
    try {
      const res = await fetch('/api/microstructure/execution-sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: execSymbol,
          orderType: execType,
          orderSizeLots: execSize,
          entryPrice: execPrice,
          availableDepthLots: execDepth,
          volatilitySpike: execVolSpike
        })
      });
      const data = await res.json();
      if (data.success) {
        setExecResult(data.result);
      }
    } catch (err) {
      console.error('Exec sim failed:', err);
    }
  };

  // Fetch OFI Signal
  const fetchOfiSignal = async () => {
    try {
      const url = `/api/order-flow/ofi?symbol=${ofiSymbol}&bid=${ofiBid}&ask=${ofiAsk}&bidVol=${ofiBidVol}&askVol=${ofiAskVol}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOfiResult(data.ofi);
      }
    } catch (err) {
      console.error('OFI signal fetch failed:', err);
    }
  };

  // Run Dynamic Risk Sizing Calc
  const runRiskSizingCalc = async () => {
    try {
      const res = await fetch('/api/risk/calculate-sizing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountEquityUsd: equity,
          winRatePct: winRate,
          winLossRatio,
          currentVolatilitySpike: riskVolSpike,
          instrument: 'EUR/USD',
          stopLossPips,
          currentPrice: 1.08520
        })
      });
      const data = await res.json();
      if (data.success) {
        setRiskResult(data.riskSizing);
      }
    } catch (err) {
      console.error('Risk sizing calc failed:', err);
    }
  };

  useEffect(() => {
    runWfoScan();
    runExecSim();
    fetchOfiSignal();
    runRiskSizingCalc();
  }, []);

  return (
    <div id="profitability-engine-container" className="space-y-6">
      
      {/* Top Section Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
              PROFITABILITY ENGINE v2.4
            </span>
            <span className="bg-cyan-950 border border-cyan-800 text-cyan-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
              QUANTITATIVE EXECUTION MODEL
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 mt-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Profitability & Mathematical Execution Safeguards
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Eliminates curve-fitting, calculates true microstructural slippage & commissions, enforces multi-timeframe order flow filters, and applies Kelly Risk-of-Ruin protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              runWfoScan();
              runExecSim();
              fetchOfiSignal();
              runRiskSizingCalc();
            }}
            disabled={loading}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalibrate All Models</span>
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('wfo')}
          className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'wfo'
              ? 'bg-slate-900 border-emerald-500 text-emerald-300 shadow-md'
              : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>1. Walk-Forward (WFO) & Overfitting Guard</span>
        </button>

        <button
          onClick={() => setActiveSubTab('execution')}
          className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'execution'
              ? 'bg-slate-900 border-cyan-500 text-cyan-300 shadow-md'
              : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>2. Microstructure Slippage & Commission Engine</span>
        </button>

        <button
          onClick={() => setActiveSubTab('orderflow')}
          className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'orderflow'
              ? 'bg-slate-900 border-purple-500 text-purple-300 shadow-md'
              : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-purple-400" />
          <span>3. Multi-Timeframe Order Flow (OFI) Signals</span>
        </button>

        <button
          onClick={() => setActiveSubTab('risk')}
          className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center space-x-2 border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'risk'
              ? 'bg-slate-900 border-amber-500 text-amber-300 shadow-md'
              : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4 text-amber-400" />
          <span>4. Dynamic Kelly & Volatility Risk Sizing</span>
        </button>
      </div>

      {/* SUB-TAB 1: Walk-Forward Optimization & Overfitting Guard */}
      {activeSubTab === 'wfo' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-200">Walk-Forward In-Sample (IS) vs Out-of-Sample (OOS) Verification</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Validates strategy edge across 5 rolling time windows to detect over-optimized parameters before real deployment.
                </p>
              </div>
              {wfoResult && (
                <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 ${
                  wfoResult.overallStatus === 'PASSED'
                    ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                    : 'bg-rose-950 border-rose-700 text-rose-400'
                }`}>
                  {wfoResult.overallStatus === 'PASSED' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>Status: {wfoResult.overallStatus}</span>
                </div>
              )}
            </div>

            {wfoResult && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-mono">
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Avg In-Sample Sharpe</span>
                    <span className="text-lg font-bold text-emerald-400">{wfoResult.avgInSampleSharpe}</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Avg Out-of-Sample Sharpe</span>
                    <span className={`text-lg font-bold ${wfoResult.avgOutOfSampleSharpe >= 1.1 ? 'text-sky-400' : 'text-rose-400'}`}>
                      {wfoResult.avgOutOfSampleSharpe}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Avg Overfitting Index</span>
                    <span className={`text-lg font-bold ${wfoResult.avgOverfittingIndex <= 0.40 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(wfoResult.avgOverfittingIndex * 100).toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Max Threshold: 40.0%</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">OOS Consistency</span>
                    <span className="text-lg font-bold text-purple-400">{wfoResult.consistencyScore}%</span>
                  </div>
                </div>

                {/* Rolling Windows Table */}
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs text-slate-300 font-mono">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Window</th>
                        <th className="p-2.5">IS Range</th>
                        <th className="p-2.5">OOS Range</th>
                        <th className="p-2.5">IS Sharpe</th>
                        <th className="p-2.5">OOS Sharpe</th>
                        <th className="p-2.5">IS / OOS Win Rate</th>
                        <th className="p-2.5">Overfitting Index</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {wfoResult.windows.map(win => (
                        <tr key={win.windowId} className="hover:bg-slate-850/40">
                          <td className="p-2.5 font-bold text-slate-200">#0{win.windowId}</td>
                          <td className="p-2.5 text-slate-400">{win.inSampleStartDate} - {win.inSampleEndDate}</td>
                          <td className="p-2.5 text-slate-400">{win.outOfSampleStartDate} - {win.outOfSampleEndDate}</td>
                          <td className="p-2.5 text-emerald-400 font-bold">{win.inSampleSharpe}</td>
                          <td className="p-2.5 text-sky-400 font-bold">{win.outOfSampleSharpe}</td>
                          <td className="p-2.5 text-slate-300">{win.inSampleWinRate}% / {win.outOfSampleWinRate}%</td>
                          <td className="p-2.5 font-bold">
                            <span className={win.overfittingIndex > 0.40 ? 'text-rose-400' : 'text-slate-200'}>
                              {(win.overfittingIndex * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              win.status === 'PASSED' 
                                ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                                : 'bg-rose-950 border border-rose-800 text-rose-400'
                            }`}>
                              {win.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Microstructure Slippage & Commission Engine */}
      {activeSubTab === 'execution' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Controls */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Execution Friction Inputs
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Instrument Symbol</label>
                <select 
                  value={execSymbol} 
                  onChange={e => setExecSymbol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono"
                >
                  <option value="EUR/USD">EUR/USD (Forex FX)</option>
                  <option value="GBP/USD">GBP/USD (Forex FX)</option>
                  <option value="BTC/USD">BTC/USD (Crypto)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Order Type</label>
                  <select 
                    value={execType} 
                    onChange={e => setExecType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Order Size (Lots)</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    value={execSize} 
                    onChange={e => setExecSize(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Available Depth at Top of Book (Lots)</label>
                <input 
                  type="number" 
                  step="1" 
                  value={execDepth} 
                  onChange={e => setExecDepth(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Volatility Spike Index (1.0 = Normal, 3.0+ = Shock)</label>
                <input 
                  type="number" 
                  step="0.5" 
                  value={execVolSpike} 
                  onChange={e => setExecVolSpike(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                />
              </div>

              <button
                onClick={runExecSim}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all cursor-pointer"
              >
                Calculate Realistic Execution
              </button>
            </div>
          </div>

          {/* Results Display */}
          <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Realized Microstructure Friction Breakdown
            </h3>

            {execResult && (
              <div className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Requested Price</span>
                    <span className="text-sm font-bold text-slate-200">{execResult.requestedPrice}</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Executed Fill Price</span>
                    <span className="text-sm font-bold text-cyan-400">{execResult.executedPrice}</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Latency Delay</span>
                    <span className="text-sm font-bold text-amber-400">{execResult.simulatedLatencyMs} ms</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Friction Loss %</span>
                    <span className="text-sm font-bold text-rose-400">{execResult.effectiveFrictionPct}%</span>
                  </div>
                </div>

                {/* Friction items */}
                <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Cost Deductions Breakdown</h4>
                  <div className="space-y-2 text-slate-400">
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Half-Spread Cost:</span>
                      <span className="text-slate-200 font-bold">-{execResult.halfSpreadDeductionPips} pips</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Quadratic Market Impact Slippage:</span>
                      <span className="text-amber-400 font-bold">-{execResult.slippagePips} pips</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span>Broker/Exchange Commission:</span>
                      <span className="text-rose-400 font-bold">-${execResult.commissionUsd.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between pt-1 text-sm font-bold">
                      <span className="text-slate-200">Net Realized Trade PnL:</span>
                      <span className={execResult.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        +${execResult.netPnlUsd.toFixed(2)} ({execResult.netPnlPips} pips)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Multi-Timeframe Order Flow (OFI) */}
      {activeSubTab === 'orderflow' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-purple-400" />
                  Multi-Timeframe Order Flow Imbalance (OFI) & Micro-Price Engine
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tracks net volume additions and cancellations at top-of-book levels to generate high-probability trade filters.
                </p>
              </div>

              <button
                onClick={fetchOfiSignal}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Fetch OFI Metrics</span>
              </button>
            </div>

            {ofiResult && (
              <div className="space-y-4 font-mono">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Composite OFI Score</span>
                    <span className={`text-lg font-bold ${ofiResult.compositeOfiScore > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {ofiResult.compositeOfiScore > 0 ? `+${ofiResult.compositeOfiScore}` : ofiResult.compositeOfiScore}
                    </span>
                    <span className="text-[9px] text-slate-500 block">Range: -1.0 to +1.0</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Micro-Price Divergence</span>
                    <span className="text-lg font-bold text-purple-400">{ofiResult.microPrice}</span>
                    <span className="text-[9px] text-slate-500 block">Mid-Price: {ofiResult.midPrice}</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Orderbook Imbalance</span>
                    <span className="text-lg font-bold text-sky-400">{(ofiResult.orderbookImbalanceRatio * 100).toFixed(1)}% Bid</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">OFI Signal Action</span>
                    <span className="text-sm font-bold text-emerald-400">{ofiResult.signalAction}</span>
                    <span className="text-[9px] text-slate-500 block">{ofiResult.confidencePct}% Confidence</span>
                  </div>
                </div>

                {/* OFI Timeframe Grid */}
                <div className="grid grid-cols-4 gap-3 text-center text-xs">
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">OFI 1-Second</span>
                    <span className="font-bold text-purple-300">{ofiResult.ofi1s}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">OFI 5-Second</span>
                    <span className="font-bold text-purple-300">{ofiResult.ofi5s}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">OFI 1-Minute</span>
                    <span className="font-bold text-purple-300">{ofiResult.ofi1m}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">OFI 5-Minute</span>
                    <span className="font-bold text-purple-300">{ofiResult.ofi5m}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Dynamic Kelly & Volatility Risk Sizing */}
      {activeSubTab === 'risk' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Risk Input Controls */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Risk Model Inputs
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Account Equity ($)</label>
                <input 
                  type="number" 
                  step="5000" 
                  value={equity} 
                  onChange={e => setEquity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Win Rate (%)</label>
                  <input 
                    type="number" 
                    step="1" 
                    value={winRate} 
                    onChange={e => setWinRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Win/Loss Ratio</label>
                  <input 
                    type="number" 
                    step="0.05" 
                    value={winLossRatio} 
                    onChange={e => setWinLossRatio(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Stop Loss Distance (Pips)</label>
                <input 
                  type="number" 
                  step="1" 
                  value={stopLossPips} 
                  onChange={e => setStopLossPips(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Volatility Spike Index (GARCH)</label>
                <input 
                  type="number" 
                  step="0.5" 
                  value={riskVolSpike} 
                  onChange={e => setRiskVolSpike(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono" 
                />
              </div>

              <button
                onClick={runRiskSizingCalc}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-all cursor-pointer"
              >
                Calculate Fractional Kelly Sizing
              </button>
            </div>
          </div>

          {/* Risk Results */}
          <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 font-mono">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" />
              Kelly Criterion & Risk-of-Ruin (RoR) Recommendation
            </h3>

            {riskResult && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Full Kelly Allocation</span>
                    <span className="text-lg font-bold text-slate-200">{(riskResult.fullKellyFraction * 100).toFixed(1)}%</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Quarter Kelly Safe Target</span>
                    <span className="text-lg font-bold text-emerald-400">{(riskResult.quarterKellyFraction * 100).toFixed(2)}%</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Volatility Regime</span>
                    <span className="text-xs font-bold text-amber-400 mt-1 block">{riskResult.volatilityRegime}</span>
                    <span className="text-[9px] text-slate-500 block">Mult: {riskResult.volatilityRegimeMultiplier}x</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Risk of Ruin (20% Breach)</span>
                    <span className={`text-lg font-bold ${riskResult.riskOfRuinPct <= 5.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {riskResult.riskOfRuinPct}%
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-slate-400">Recommended Position Size:</span>
                    <span className="text-lg font-bold text-emerald-400">{riskResult.recommendedPositionSizeLots} Lots</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <span className="text-slate-400">Total USD at Risk per Trade:</span>
                    <span className="text-slate-200 font-bold">${riskResult.riskAmountUsd.toFixed(2)} ({riskResult.riskPctOfEquity}% of Equity)</span>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">Risk Guard Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      riskResult.isApprovedByRiskGuard
                        ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                        : 'bg-rose-950 border border-rose-800 text-rose-400'
                    }`}>
                      {riskResult.isApprovedByRiskGuard ? 'APPROVED' : 'REJECTED BY RISK GUARD'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
