/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { 
  Play, RefreshCw, AlertTriangle, CheckCircle, Info, Calendar, 
  TrendingUp, TrendingDown, Clock, ShieldCheck, ListFilter, Plus,
  Award, ArrowUpDown, ChevronRight, Ban, Zap, Percent, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DemoLiveRun {
  id: number;
  started_at: string;
  planned_end_at: string;
  initial_balance: number;
  peak_equity: number;
  max_drawdown: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ABORTED';
}

interface EquitySnapshot {
  id: number;
  run_id: number;
  timestamp: string;
  balance: number;
  equity: number;
  used_margin: number;
  free_margin: number;
  open_position_count: number;
  daily_pnl: number;
}

interface DailyRollup {
  id: number;
  run_id: number;
  date: string;
  starting_balance: number;
  ending_balance: number;
  total_pnl: number;
  trade_count: number;
  win_rate: number;
  max_drawdown: number;
}

interface DemoLiveAlert {
  id: number;
  run_id: number;
  timestamp: string;
  type: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

interface InstrumentStat {
  symbol: string;
  tradesCount: number;
  winRate: number;
  totalPnl: number;
}

export default function DemoLiveObservationPanel() {
  const [runs, setRuns] = useState<DemoLiveRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  
  const [runDetails, setRunDetails] = useState<DemoLiveRun | null>(null);
  const [equityHistory, setEquityHistory] = useState<EquitySnapshot[]>([]);
  const [dailyRollups, setDailyRollups] = useState<DailyRollup[]>([]);
  const [alerts, setAlerts] = useState<DemoLiveAlert[]>([]);
  const [instrumentBreakdown, setInstrumentBreakdown] = useState<InstrumentStat[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showNewRunModal, setShowNewRunModal] = useState<boolean>(false);
  const [newRunBalance, setNewRunBalance] = useState<number>(100000);
  const [newRunLoading, setNewRunLoading] = useState<boolean>(false);
  const [newRunError, setNewRunError] = useState<string>('');
  
  const [activeSubTab, setActiveSubTab] = useState<'chart' | 'instruments' | 'alerts'>('chart');

  // Load all available runs
  const fetchRuns = useCallback(async (selectNewestActive = false) => {
    try {
      const res = await fetch('/api/demo-live/runs');
      if (res.ok) {
        const data = await res.json();
        const runsList = data.runs as DemoLiveRun[];
        setRuns(runsList);
        
        if (runsList.length > 0) {
          if (selectNewestActive) {
            const active = runsList.find(r => r.status === 'ACTIVE');
            setSelectedRunId(active ? active.id : runsList[0].id);
          } else if (selectedRunId === null) {
            setSelectedRunId(runsList[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching demo-live runs:', err);
    }
  }, [selectedRunId]);

  // Load specific performance stats
  const fetchPerformance = useCallback(async (runId: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/demo-live/performance?run_id=${runId}`);
      if (res.ok) {
        const data = await res.json();
        setRunDetails(data.run);
        setEquityHistory(data.history || []);
        setDailyRollups(data.rollups || []);
        setAlerts(data.alerts || []);
        setInstrumentBreakdown(data.instrumentBreakdown || []);
      }
    } catch (err) {
      console.error('Error fetching demo-live performance details:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns(true);
  }, []);

  useEffect(() => {
    if (selectedRunId !== null) {
      fetchPerformance(selectedRunId);
    }
  }, [selectedRunId, fetchPerformance]);

  const handleRefresh = () => {
    if (selectedRunId !== null) {
      fetchPerformance(selectedRunId);
    }
    fetchRuns();
  };

  const handleStartNewRun = async () => {
    setNewRunLoading(true);
    setNewRunError('');
    try {
      const res = await fetch('/api/demo-live/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_balance: newRunBalance })
      });
      const data = await res.json();
      if (data.success) {
        setShowNewRunModal(false);
        setNewRunBalance(100000);
        // Refresh with select newest run active
        await fetchRuns(true);
      } else {
        setNewRunError(data.error || 'Failed to start observation run');
      }
    } catch (err: any) {
      setNewRunError(err.message || 'Network error occurred');
    } finally {
      setNewRunLoading(false);
    }
  };

  // Helper: calculate win rate
  const totalTrades = dailyRollups.reduce((acc, curr) => acc + curr.trade_count, 0);
  const totalProfitTradesRollup = dailyRollups.reduce((acc, curr) => acc + (curr.trade_count * (curr.win_rate / 100)), 0);
  const overallWinRate = totalTrades > 0 ? parseFloat(((totalProfitTradesRollup / totalTrades) * 100).toFixed(1)) : 0;

  // Helper: Format Dates
  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return isoStr;
    }
  };

  // Helper: calculate time elapsed & progress
  const getProgressPct = () => {
    if (!runDetails) return 0;
    const start = new Date(runDetails.started_at).getTime();
    const end = new Date(runDetails.planned_end_at).getTime();
    const now = Math.min(new Date().getTime(), end);
    const duration = end - start;
    if (duration <= 0) return 100;
    return parseFloat((((now - start) / duration) * 100).toFixed(1));
  };

  const getRemainingDays = () => {
    if (!runDetails) return 0;
    const end = new Date(runDetails.planned_end_at).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Process data for the Recharts graph
  const chartData = equityHistory.map((s) => {
    const d = new Date(s.timestamp);
    return {
      name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      Balance: s.balance,
      Equity: s.equity,
      used_margin: s.used_margin,
      free_margin: s.free_margin
    };
  });

  return (
    <div className="space-y-6 text-gray-100" id="demo-live-root-container">
      {/* 1. Header & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              {runDetails?.status === 'ACTIVE' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${runDetails?.status === 'ACTIVE' ? 'bg-emerald-500' : runDetails?.status === 'COMPLETED' ? 'bg-blue-500' : 'bg-gray-500'}`}></span>
            </span>
            <h1 className="text-2xl font-bold tracking-tight font-sans">
              Demo-Live Continuous 6-Month Observation
            </h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Tracking performance rollups, equity curves, drawdown events, and system alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Run Selector */}
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400 font-mono">Run:</span>
            <select
              value={selectedRunId || ''}
              onChange={(e) => setSelectedRunId(Number(e.target.value))}
              className="bg-transparent text-sm font-sans font-medium text-emerald-400 focus:outline-none cursor-pointer pr-4"
              id="run-id-selector"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id} className="bg-gray-950 text-gray-100">
                  #{r.id} ({r.status}) - {formatDate(r.started_at)}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger manual refresh */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-gray-300 transition-colors cursor-pointer"
            id="refresh-demo-live-btn"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>

          {/* Initiate New 6-Month Run */}
          <button
            onClick={() => setShowNewRunModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-lg cursor-pointer"
            id="init-new-run-btn"
          >
            <Plus className="h-4 w-4" />
            New Run
          </button>
        </div>
      </div>

      {/* 2. Top-level Summary Cards */}
      {runDetails && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="demo-live-summary-cards">
          {/* Card 1: Balance / Equity */}
          <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 relative overflow-hidden" id="card-balance-equity">
            <div className="absolute top-0 right-0 p-3 text-gray-800">
              <Zap className="h-10 w-10 text-emerald-500/10" />
            </div>
            <div className="text-xs text-gray-400 font-medium tracking-wider uppercase font-mono">Current Account state</div>
            <div className="text-2xl font-bold tracking-tight text-white mt-2 font-sans">
              ${(equityHistory[equityHistory.length - 1]?.equity ?? runDetails.initial_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-2.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-gray-400">Balance:</span>
              <span className="font-semibold text-white font-mono">
                ${(equityHistory[equityHistory.length - 1]?.balance ?? runDetails.initial_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 2: Peak Equity & Drawdown */}
          <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 relative overflow-hidden" id="card-peak-drawdown">
            <div className="absolute top-0 right-0 p-3 text-gray-800">
              <ArrowUpDown className="h-10 w-10 text-rose-500/10" />
            </div>
            <div className="text-xs text-gray-400 font-medium tracking-wider uppercase font-mono">Peak Equity & Drawdown</div>
            <div className="text-2xl font-bold tracking-tight text-rose-400 mt-2 font-mono">
              -{runDetails.max_drawdown.toFixed(2)}%
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-2.5 text-gray-400">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>Peak:</span>
              <span className="font-semibold text-gray-200 font-mono">
                ${runDetails.peak_equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 3: Global Win Rate */}
          <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 relative overflow-hidden" id="card-win-rate">
            <div className="absolute top-0 right-0 p-3 text-gray-800">
              <Percent className="h-10 w-10 text-blue-500/10" />
            </div>
            <div className="text-xs text-gray-400 font-medium tracking-wider uppercase font-mono">Cumulative Win Rate</div>
            <div className="text-2xl font-bold tracking-tight text-blue-400 mt-2 font-mono">
              {overallWinRate > 0 ? `${overallWinRate}%` : '0.0%'}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-2.5 text-gray-400">
              <span className="font-semibold text-gray-200 font-mono">{totalTrades}</span>
              <span>total closed trades recorded</span>
            </div>
          </div>

          {/* Card 4: Run Timeline / Period */}
          <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 relative overflow-hidden" id="card-run-timeline">
            <div className="absolute top-0 right-0 p-3 text-gray-800">
              <Clock className="h-10 w-10 text-amber-500/10" />
            </div>
            <div className="text-xs text-gray-400 font-medium tracking-wider uppercase font-mono">Observation Progress</div>
            <div className="text-2xl font-bold tracking-tight text-amber-400 mt-2 font-sans">
              {runDetails.status === 'ACTIVE' ? `${getRemainingDays()} Days Left` : runDetails.status}
            </div>
            <div className="mt-3.5 space-y-1">
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${runDetails.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                  style={{ width: `${getProgressPct()}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>Start: {formatDate(runDetails.started_at)}</span>
                <span>{getProgressPct()}% Complete</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Chart & Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="demo-live-details-layout">
        {/* Left 2 Columns: Chart or Instrument Grid or Alerts list */}
        <div className="lg:col-span-2 bg-gray-950 border border-gray-800 rounded-xl p-5" id="performance-chart-container">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveSubTab('chart')}
                className={`text-sm font-semibold pb-3 -mb-3.5 transition-colors cursor-pointer border-b-2 ${activeSubTab === 'chart' ? 'text-emerald-400 border-emerald-400' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
                id="subtab-chart"
              >
                Equity Curve Chart
              </button>
              <button
                onClick={() => setActiveSubTab('instruments')}
                className={`text-sm font-semibold pb-3 -mb-3.5 transition-colors cursor-pointer border-b-2 ${activeSubTab === 'instruments' ? 'text-emerald-400 border-emerald-400' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
                id="subtab-instruments"
              >
                Per-Instrument Breakdown
              </button>
              <button
                onClick={() => setActiveSubTab('alerts')}
                className={`text-sm font-semibold pb-3 -mb-3.5 relative transition-colors cursor-pointer border-b-2 ${activeSubTab === 'alerts' ? 'text-emerald-400 border-emerald-400' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
                id="subtab-alerts"
              >
                Alerts Feed
                {alerts.length > 0 && (
                  <span className="absolute top-0 -right-2.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </button>
            </div>
            
            <div className="text-xs text-gray-500 font-mono">
              Run Duration: 6 Months (Observation Mode)
            </div>
          </div>

          <div className="min-h-[350px]">
            {activeSubTab === 'chart' && (
              <div className="h-[350px] w-full" id="equity-recharts-container">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={10} 
                        tickLine={false}
                        domain={['dataMin - 1000', 'dataMax + 1000']}
                        tickFormatter={(v) => `$${v.toLocaleString()}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#1f2937', color: '#f3f4f6', borderRadius: '8px' }}
                        itemStyle={{ color: '#10b981' }}
                        formatter={(value: any) => [`$${parseFloat(value).toLocaleString()}`]}
                      />
                      <Area type="monotone" dataKey="Equity" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEquity)" />
                      <Line type="monotone" dataKey="Balance" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Activity className="h-10 w-10 text-gray-700 animate-pulse mb-2" />
                    <p className="text-sm font-mono">No equity history snapshots recorded yet.</p>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'instruments' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="instruments-breakdown-grid">
                {instrumentBreakdown.map((item) => {
                  const isPositive = item.totalPnl >= 0;
                  return (
                    <div 
                      key={item.symbol} 
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between"
                      id={`instrument-${item.symbol.replace('/', '-')}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white tracking-wide">{item.symbol}</span>
                          <span className="text-[10px] font-mono text-gray-500">instrument</span>
                        </div>
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {isPositive ? '+' : ''}${item.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6 pt-3 border-t border-gray-800/60 text-xs">
                        <div>
                          <span className="text-gray-500 block uppercase tracking-wider text-[9px] font-mono">Win Rate</span>
                          <span className="font-semibold text-gray-200 mt-1 block font-mono text-sm">{item.winRate}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block uppercase tracking-wider text-[9px] font-mono">Total Trades</span>
                          <span className="font-semibold text-gray-200 mt-1 block font-mono text-sm">{item.tradesCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeSubTab === 'alerts' && (
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1" id="alerts-list-subtab">
                {alerts.length > 0 ? (
                  alerts.map((a) => {
                    const isCritical = a.severity === 'CRITICAL';
                    const isWarning = a.severity === 'WARNING';
                    return (
                      <div 
                        key={a.id} 
                        className={`border rounded-lg p-3 flex gap-3 text-sm transition-all ${
                          isCritical 
                            ? 'bg-rose-950/20 border-rose-900/60 text-rose-200' 
                            : isWarning 
                              ? 'bg-amber-950/20 border-amber-900/60 text-amber-200' 
                              : 'bg-gray-900 border-gray-800 text-gray-300'
                        }`}
                        id={`alert-item-${a.id}`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {isCritical ? (
                            <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />
                          ) : isWarning ? (
                            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                          ) : (
                            <Info className="h-4.5 w-4.5 text-emerald-500" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium font-sans leading-relaxed text-xs">{a.message}</p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                            <span className="uppercase tracking-wider font-semibold">{a.type}</span>
                            <span>•</span>
                            <span>{new Date(a.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                    <ShieldCheck className="h-10 w-10 text-emerald-500/20 mb-2" />
                    <p className="text-sm font-mono text-gray-400">All systems green. No alerts triggered.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Current Active Status / Mini Details */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 flex flex-col justify-between" id="active-status-sidebar">
          <div>
            <h3 className="text-sm font-bold text-gray-200 tracking-wider uppercase font-mono border-b border-gray-800 pb-3 mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-400" />
              Observation Target Info
            </h3>

            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800/80 rounded-lg p-3 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Initial Balance:</span>
                  <span className="font-mono text-gray-200">${runDetails?.initial_balance?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Period Target:</span>
                  <span className="font-semibold text-emerald-400 font-mono">6 Months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Risk Environment:</span>
                  <span className="font-mono text-amber-500">DEMO_LIVE_STABLE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trading Model:</span>
                  <span className="font-mono text-emerald-400">DRL-Ensemble (PPO)</span>
                </div>
              </div>

              {/* Status Alert Indicator */}
              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3 text-xs text-emerald-200 flex gap-2">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-400">Continuous Tracking Active</p>
                  <p className="text-gray-400 text-[10px] mt-0.5 leading-normal">
                    snapshots are recorded automatically upon any balance, trade status, or P&L updates.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-800/60 pt-4 text-center">
            <span className="text-[10px] text-gray-600 font-mono tracking-widest block uppercase">NEXUS Platform DMA CORE</span>
          </div>
        </div>
      </div>

      {/* 4. Day-by-Day Rollups Table */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-5" id="daily-rollups-table-card">
        <h3 className="text-sm font-bold text-gray-200 tracking-wider uppercase font-mono border-b border-gray-800 pb-3 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-400" />
          Day-by-Day Rollups History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider font-mono text-[10px]">
                <th className="py-3 px-4 font-semibold">Date (UTC)</th>
                <th className="py-3 px-4 font-semibold">Starting Balance</th>
                <th className="py-3 px-4 font-semibold">Ending Balance</th>
                <th className="py-3 px-4 font-semibold text-right">Net Daily P&L</th>
                <th className="py-3 px-4 font-semibold text-center">Trade Count</th>
                <th className="py-3 px-4 font-semibold text-center">Win Rate</th>
                <th className="py-3 px-4 font-semibold text-center">Max Drawdown</th>
              </tr>
            </thead>
            <tbody>
              {dailyRollups.length > 0 ? (
                dailyRollups.map((r) => {
                  const isPositive = r.total_pnl >= 0;
                  return (
                    <tr key={r.id} className="border-b border-gray-900 hover:bg-gray-900/40 transition-colors" id={`rollup-row-${r.id}`}>
                      <td className="py-3 px-4 font-medium text-gray-300 font-sans">{r.date}</td>
                      <td className="py-3 px-4 text-gray-400 font-mono">${r.starting_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-gray-200 font-mono">${r.ending_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}${r.total_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-gray-300">{r.trade_count}</td>
                      <td className="py-3 px-4 text-center font-mono text-blue-400 font-bold">{r.win_rate}%</td>
                      <td className="py-3 px-4 text-center font-mono text-rose-400">{r.max_drawdown}%</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 font-mono text-xs">
                    No daily rollups finalized yet for this observation run.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Start New 6-Month Run Confirmation Modal */}
      <AnimatePresence>
        {showNewRunModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" id="new-run-modal-backdrop">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-950 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative"
              id="new-run-modal-card"
            >
              <h2 className="text-lg font-bold text-white tracking-wide border-b border-gray-800 pb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Initialize New Observation Run
              </h2>

              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Starting a new observation run will immediately mark the currently active run as <span className="text-gray-200 font-semibold font-mono">ABORTED</span>. 
                All current open demo live positions will be closed, and the balance will be reset to the specified starting balance.
              </p>

              <div className="space-y-1.5 mt-5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block">Initial Funding (USD)</label>
                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2.5">
                  <span className="text-gray-500 font-sans mr-2 font-medium">$</span>
                  <input
                    type="number"
                    value={newRunBalance}
                    onChange={(e) => setNewRunBalance(Number(e.target.value))}
                    className="bg-transparent text-sm text-gray-200 font-semibold focus:outline-none w-full font-mono"
                    placeholder="100000"
                    id="new-run-balance-input"
                  />
                </div>
              </div>

              {newRunError && (
                <div className="bg-rose-950/20 border border-rose-900/50 text-rose-400 rounded-lg p-3 text-xs mt-4">
                  {newRunError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={() => setShowNewRunModal(false)}
                  disabled={newRunLoading}
                  className="bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                  id="cancel-new-run-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartNewRun}
                  disabled={newRunLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow-lg transition-colors cursor-pointer flex items-center gap-2"
                  id="confirm-new-run-btn"
                >
                  {newRunLoading ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                  Initialize Run
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
