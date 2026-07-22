import { useState, useEffect } from 'react';
import { Brain, Sparkles, ShieldCheck, Activity, Cpu, Layers, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2, XCircle, BarChart2 } from 'lucide-react';

export default function SovereignMindPanel() {
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      setLoading(true);
      const [snapRes, histRes] = await Promise.all([
        fetch('/api/sovereign-mind/snapshot'),
        fetch('/api/sovereign-mind/history')
      ]);

      if (snapRes.ok) {
        const snapData = await snapRes.json();
        setSnapshot(snapData.snapshot);
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Sovereign Mind orchestrator state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerCycle = async () => {
    try {
      setTriggering(true);
      const res = await fetch('/api/sovereign-mind/trigger', { method: 'POST' });
      if (res.ok) {
        await fetchState();
      }
    } catch (err: any) {
      console.error('Trigger cycle failed:', err);
    } finally {
      setTriggering(false);
    }
  };

  const latestCycle = history?.cycles?.[0];

  return (
    <div id="sovereign-mind-orchestrator-panel" className="space-y-6">
      
      {/* Header Banner */}
      <div id="sovereign-mind-header" className="bg-slate-950 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-purple-950 to-slate-950 border border-purple-500/40 rounded-xl text-purple-400 shadow-lg shadow-purple-950/50">
              <Brain className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono bg-purple-950 border border-purple-800 text-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Top-Level Continuous Orchestrator</span>
                <span className="text-[10px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Hard Boundary Enforced</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 mt-1">Sovereign Mind Orchestration Engine</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">Synthesizes real-time signals across all sub-systems into coordinated, explainable recommendations.</p>
            </div>
          </div>

          <button
            id="trigger-sovereign-mind-btn"
            onClick={handleTriggerCycle}
            disabled={triggering}
            className={`px-5 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              triggering
                ? 'bg-slate-800 border border-slate-700 text-slate-400 cursor-wait'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${triggering ? 'animate-spin' : ''}`} />
            <span>{triggering ? 'SYNTHESIZING AGENT STATES...' : 'TRIGGER ORCHESTRATION CYCLE'}</span>
          </button>
        </div>
      </div>

      {loading && !snapshot ? (
        <div id="sovereign-mind-loading" className="p-12 text-center font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded-xl">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-3" />
          Aggregating state across DRL Ensemble, Value Discovery, Market Regime Classifier, and Creative Synthesis...
        </div>
      ) : (
        <>
          {/* Latest Coordinated Recommendation Banner */}
          <div id="latest-recommendation-card" className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-slate-100">Latest Cross-Subsystem Coordinated Recommendation</h3>
              </div>
              <div className="flex items-center space-x-3 font-mono text-xs">
                {latestCycle?.applied ? (
                  <span className="flex items-center space-x-1.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 px-2.5 py-1 rounded-full font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PERMITTED ACTIONS APPLIED</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5 bg-amber-950/80 border border-amber-800 text-amber-300 px-2.5 py-1 rounded-full font-bold">
                    <XCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>HELD BACK ({latestCycle?.heldBackReason || 'Safety Gating Active'})</span>
                  </span>
                )}
                <span className="bg-slate-900 border border-slate-800 text-slate-400 px-2 py-1 rounded">
                  Confidence: {((latestCycle?.recommendation?.confidenceScore || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Primary Insight Headline */}
            <div className="bg-purple-950/30 border border-purple-800/50 rounded-lg p-4">
              <div className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider mb-1">Primary Orchestration Insight</div>
              <p className="text-sm font-semibold text-purple-100">
                {latestCycle?.recommendation?.primaryInsight || 'Multi-signal equilibrium maintained across all sub-systems.'}
              </p>
            </div>

            {/* Detailed Multi-Sentence Reasoning */}
            <div className="space-y-1.5">
              <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Cross-Subsystem Reasoning Justification</div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5 font-mono">
                {latestCycle?.recommendation?.reasoning || 'All subsystems monitored under nominal operating bounds.'}
              </p>
            </div>

            {/* Subsystem Connections Grid */}
            {latestCycle?.recommendation?.subsystemConnections?.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Connected Signals Across Subsystems</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {latestCycle.recommendation.subsystemConnections.map((conn: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1 text-xs">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {conn.subsystems?.map((sub: string, sIdx: number) => (
                          <span key={sIdx} className="bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                            {sub}
                          </span>
                        ))}
                      </div>
                      <div className="text-slate-300 font-medium"><strong>Observation:</strong> {conn.observation}</div>
                      <div className="text-purple-300 font-mono"><strong>Implication:</strong> {conn.implication}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested & Applied Actions */}
            {latestCycle?.recommendation?.suggestedActions?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Permitted Subsystem Actions</div>
                <div className="space-y-2">
                  {latestCycle.recommendation.suggestedActions.map((act: any, aIdx: number) => (
                    <div key={aIdx} className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                            {act.targetSubsystem}
                          </span>
                          <span className="font-mono font-bold text-slate-200">{act.actionType}</span>
                        </div>
                        <p className="text-slate-400 text-xs mt-1 font-mono">{act.rationale}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[10px] font-mono text-purple-300 shrink-0">
                        Payload: {JSON.stringify(act.payload)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Aggregated Ecosystem Snapshot Matrix (6 Subsystems) */}
          <div id="subsystems-aggregated-snapshot-matrix" className="space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-purple-400" />
              <span>Real-Time Subsystem State Matrix (6 Aggregated Modules)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* 1. Market Regime Classifier */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase">1. Market Regime Classifier</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Classified Regime:</span>
                    <span className="text-slate-100 font-bold">{snapshot?.marketRegime?.currentRegime || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Volatility Index:</span>
                    <span className="text-amber-400 font-bold">{snapshot?.marketRegime?.volatilityIndex}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trend Strength:</span>
                    <span className="text-emerald-400 font-bold">{((snapshot?.marketRegime?.trendStrength || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* 2. DRL Ensemble */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold text-sky-400 uppercase">2. DRL Ensemble</span>
                  <Cpu className="w-4 h-4 text-sky-400" />
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rolling Accuracy:</span>
                    <span className="text-sky-400 font-bold">{((snapshot?.drlEnsemble?.rollingAccuracy || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Brier Score:</span>
                    <span className="text-slate-100 font-bold">{snapshot?.drlEnsemble?.rollingBrierScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Member Weights:</span>
                    <span className="text-purple-300 font-bold text-[10px]">
                      {Object.keys(snapshot?.drlEnsemble?.ensembleWeights || {}).length} Models Active
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Value Discovery Agent */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold text-purple-400 uppercase">3. Value Discovery Agent</span>
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Hypotheses:</span>
                    <span className="text-slate-100 font-bold">{snapshot?.valueDiscovery?.totalHypotheses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">FDR-Significant:</span>
                    <span className="text-emerald-400 font-bold">{snapshot?.valueDiscovery?.passedFdrCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Promoted Live:</span>
                    <span className="text-purple-300 font-bold">{snapshot?.valueDiscovery?.promotedCount}</span>
                  </div>
                </div>
              </div>

              {/* 4. Creative Synthesis Layer */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold text-pink-400 uppercase">4. Creative Synthesis Layer</span>
                  <Sparkles className="w-4 h-4 text-pink-400" />
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Attempts:</span>
                    <span className="text-slate-100 font-bold">{snapshot?.creativeSynthesis?.totalAttempts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recent Success Rate:</span>
                    <span className="text-pink-400 font-bold">{((snapshot?.creativeSynthesis?.recentSuccessRate || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latest Status:</span>
                    <span className="text-emerald-400 font-bold">
                      {snapshot?.creativeSynthesis?.recentAttempts?.[0]?.status || 'IDLE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Strategy Allocation per Instrument */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase">5. Strategy Allocation</span>
                  <BarChart2 className="w-4 h-4 text-amber-400" />
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  {snapshot?.strategyPerformance?.slice(0, 3).map((strat: any, sIdx: number) => (
                    <div key={sIdx} className="flex justify-between">
                      <span className="text-slate-400">{strat.symbol}:</span>
                      <span className="text-amber-300 font-bold">{strat.allocationWeight}x (Sharpe {strat.sharpeRatio})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Read-Only Safety Backstop */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-mono font-bold text-red-400 uppercase">6. Safety Backstop (Read-Only)</span>
                  <ShieldCheck className="w-4 h-4 text-red-400" />
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Safe Mode:</span>
                    <span className={snapshot?.safetyStateReadonly?.safeModeActive ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                      {snapshot?.safetyStateReadonly?.safeModeActive ? "ACTIVE" : "NOMINAL"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Emergency Halt:</span>
                    <span className={snapshot?.safetyStateReadonly?.emergencyHaltActive ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                      {snapshot?.safetyStateReadonly?.emergencyHaltActive ? "HALTED" : "NOMINAL"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Drawdown:</span>
                    <span className="text-slate-100 font-bold">{snapshot?.safetyStateReadonly?.currentDrawdownPct}%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Orchestration Cycle History Log */}
          {history?.cycles?.length > 0 && (
            <div id="orchestration-history-log" className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-purple-400" />
                <span>Orchestration Reasoning Cycle History</span>
              </h3>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {history.cycles.map((cycle: any, cIdx: number) => (
                  <div key={cIdx} className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5 space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-300 font-bold">{cycle.id}</span>
                      <span className="text-slate-500">{new Date(cycle.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-200 font-sans font-medium">{cycle.recommendation?.primaryInsight}</p>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Status: {cycle.applied ? 'APPLIED' : `HELD BACK (${cycle.heldBackReason})`}</span>
                      <span>Confidence: {((cycle.recommendation?.confidenceScore || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
