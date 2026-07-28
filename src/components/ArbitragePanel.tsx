import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowUpDown, 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  Zap, 
  RefreshCw, 
  Trash2, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Settings, 
  AlertTriangle,
  HelpCircle,
  FileText
} from 'lucide-react';

interface SpreadRecord {
  timestamp: string;
  binanceBid: number;
  binanceAsk: number;
  coinbaseBid: number;
  coinbaseAsk: number;
  krakenBid: number;
  krakenAsk: number;
  maxSpread: number;
}

interface OpportunityRecord {
  id: string;
  timestamp: string;
  pair: string;
  buyVenue: string;
  sellVenue: string;
  buyPrice: number;
  sellPrice: number;
  grossDiff: number;
  fees: number;
  netEdge: number;
}

interface TradeRecord {
  id: string;
  timestamp: string;
  opportunityId: string;
  pair: string;
  buyVenue: string;
  sellVenue: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  realizedPnL: number;
  status: 'SUCCESS_COMPLETED' | 'SELL_LEG_FAILED_UNWOUND' | 'PARTIAL_FILL_RESIZED';
  fallbackAction: string;
  log: string;
}

interface TriangularOpportunity {
  pairPath: string;
  leg1Symbol: string;
  leg1Rate: number;
  leg2Symbol: string;
  leg2Rate: number;
  leg3Symbol: string;
  leg3DirectRate: number;
  impliedRate: number;
  grossSpreadPips: number;
  feesAndSlippage: number;
  netProfitPips: number;
  isExecutable: boolean;
}

interface StatArbPair {
  pair1: string;
  pair2: string;
  hedgeRatioOLS: number;
  spreadZScore: number;
  adfTestPValue: number;
  isCointegrated: boolean;
  signal: string;
  targetReversionPips: number;
}

interface ArbitrageState {
  config: {
    liveEnabled: boolean;
    thresholdNetProfitUsd: number;
    orderSizeBtc: number;
    slippagePct: number;
  };
  compliance: {
    tosPermitted: boolean;
    regulationsPermitted: boolean;
    sandboxPassed: boolean;
  };
}

export default function ArbitragePanel() {
  const [state, setState] = useState<ArbitrageState | null>(null);
  const [spreads, setSpreads] = useState<SpreadRecord[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [threshold, setThreshold] = useState<number>(15.0);
  const [orderSize, setOrderSize] = useState<number>(0.5);
  const [slippage, setSlippage] = useState<number>(0.05);

  // Phase 3 States
  const [triangularOpps, setTriangularOpps] = useState<TriangularOpportunity[]>([]);
  const [statArbPairs, setStatArbPairs] = useState<StatArbPair[]>([]);

  // Fetch all state and logs
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [stateRes, logsRes, triRes, statRes] = await Promise.all([
        fetch('/api/arbitrage/state'),
        fetch('/api/arbitrage/logs'),
        fetch('/api/arbitrage/triangular'),
        fetch('/api/arbitrage/statarb')
      ]);

      if (stateRes.ok && logsRes.ok) {
        const stateData = await stateRes.json();
        const logsData = await logsRes.json();

        setState(stateData);
        setSpreads(logsData.spreads || []);
        setOpportunities(logsData.opportunities || []);
        setTrades(logsData.trades || []);

        if (stateData.config) {
          setThreshold(stateData.config.thresholdNetProfitUsd);
          setOrderSize(stateData.config.orderSizeBtc);
          setSlippage(stateData.config.slippagePct);
        }
      }

      if (triRes.ok) {
        const triData = await triRes.json();
        if (triData.success) setTriangularOpps(triData.opportunities || []);
      }

      if (statRes.ok) {
        const statData = await statRes.json();
        if (statData.success) setStatArbPairs(statData.pairs || []);
      }

      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`نەتوانرا داتاکان دابگیرێن: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll for live rates and logs every 2 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update compliance checklist
  const handleComplianceToggle = async (type: 'tos' | 'regulations') => {
    if (!state) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const updatedTos = type === 'tos' ? !state.compliance.tosPermitted : state.compliance.tosPermitted;
    const updatedRegs = type === 'regulations' ? !state.compliance.regulationsPermitted : state.compliance.regulationsPermitted;

    try {
      const res = await fetch('/api/arbitrage/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tosPermitted: updatedTos,
          regulationsPermitted: updatedRegs
        })
      });

      if (res.ok) {
        const data = await res.json();
        setState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            compliance: {
              ...prev.compliance,
              tosPermitted: updatedTos,
              regulationsPermitted: updatedRegs
            }
          };
        });
        setSuccessMessage("ڕێککەوتنامەی یاسایی و مەرجەکان بە سەرکەوتوویی نوێکرانەوە.");
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || "خەتایەک لە تۆمارکردنی ڕەزامەندی یاسایی ڕوویدا.");
      }
    } catch (err: any) {
      setErrorMessage(`شکستی پێکبەستن: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Toggle live execution toggle
  const handleLiveToggle = async () => {
    if (!state) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetEnabled = !state.config.liveEnabled;

    try {
      const res = await fetch('/api/arbitrage/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetEnabled })
      });

      if (res.ok) {
        const data = await res.json();
        setState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            config: {
              ...prev.config,
              liveEnabled: targetEnabled
            }
          };
        });
        setSuccessMessage(
          targetEnabled 
            ? "بزوێنەری ئاربیتراژی لایڤ چالاک کرا! سیستەم بە بەردەوامی پشکنین دەکات." 
            : "بازرگانی ئاربیتراژ لایڤ ناچالاک کرا."
        );
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || "مەرجەکانی چالاککردن تەواو نین.");
      }
    } catch (err: any) {
      setErrorMessage(`کێشە لە پەیوەندی سێرڤەر: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Save configuration threshold parameters
  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/arbitrage/set-threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thresholdNetProfitUsd: threshold,
          orderSizeBtc: orderSize,
          slippagePct: slippage
        })
      });

      if (res.ok) {
        setSuccessMessage("پارامیتەرەکانی ئاربیتراژ و کۆنترۆڵی مەترسی نوێکرانەوە.");
        fetchData(true);
      } else {
        setErrorMessage("شکست لە نوێکردنەوەی پارامیتەرەکان.");
      }
    } catch (err: any) {
      setErrorMessage(`خەتا: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Clear all database logs/metrics
  const handleClearLogs = async () => {
    if (!confirm("دڵنیای لە پاککردنەوەی هەموو مێژووی ئاربیتراژ و لۆگەکانی بازرگانی؟")) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/arbitrage/clear', { method: 'POST' });
      if (res.ok) {
        setSuccessMessage("هەموو مێژووی لۆگەکان سڕانەوە.");
        setSpreads([]);
        setOpportunities([]);
        setTrades([]);
      } else {
        setErrorMessage("سڕینەوەی لۆگەکان سەرکەوتوو نەبوو.");
      }
    } catch (err: any) {
      setErrorMessage(`خەتا: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const currentSpread = spreads[spreads.length - 1];

  return (
    <div id="arbitrage-root-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6" dir="rtl">
      
      {/* Banner / Notices */}
      <div className="lg:col-span-12 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <div>
            <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-purple-400 animate-pulse shrink-0" />
              <span>قۆناغی ٦: ئاربیتراژی نێوان ئاڵوگۆڕەکان | Stage 6: Cross-Exchange Arbitrage</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              مۆنیتەرکردنی هاوتەریبی نرخە ڕاستەقینەکان، ئەنجامدانی هاوکاتی ڕاوە قازانجەکان، و بەڕێوەبردنی حاڵەتەکانی شکستی گواستنەوە بە شێوەیەکی خۆکار.
            </p>
          </div>
          <button 
            onClick={() => fetchData()}
            disabled={isLoading || isActionLoading}
            className="px-3 py-1.5 bg-slate-905 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>نوێکردنەوە | Sync</span>
          </button>
        </div>

        {errorMessage && (
          <div id="arbitrage-error-banner" className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div id="arbitrage-success-banner" className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* LEFT COLUMN: Controls, Compliance, and Real-time Spread Matrix (7 cols on lg) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Real-time Exchange Venue Rate Matrix */}
        <div className="bg-[#050914]/85 border border-slate-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-bold text-slate-200">هەلی ئاربیتراژ و پشکنینی ڕاستەقینە | Real-Time Spread Matrix</h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span>BTC/USD لایڤ</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Binance card */}
            <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-3 text-center space-y-1">
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Binance</div>
              <div className="text-[10px] text-slate-500 font-mono">Taker Fee: 0.10%</div>
              <div className="pt-2 border-t border-slate-900/40 mt-1">
                <div className="text-xs text-slate-400 font-mono">Ask: <span className="text-slate-100 font-bold">${currentSpread ? currentSpread.binanceAsk.toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}</span></div>
                <div className="text-xs text-slate-400 font-mono">Bid: <span className="text-slate-100 font-bold">${currentSpread ? currentSpread.binanceBid.toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}</span></div>
              </div>
            </div>

            {/* Coinbase card */}
            <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-3 text-center space-y-1">
              <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Coinbase Pro</div>
              <div className="text-[10px] text-slate-500 font-mono">Taker Fee: 0.60%</div>
              <div className="pt-2 border-t border-slate-900/40 mt-1">
                <div className="text-xs text-slate-400 font-mono">Ask: <span className="text-slate-100 font-bold">${currentSpread ? currentSpread.coinbaseAsk.toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}</span></div>
                <div className="text-xs text-slate-400 font-mono">Bid: <span className="text-slate-100 font-bold">${currentSpread ? currentSpread.coinbaseBid.toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}</span></div>
              </div>
            </div>

            {/* Kraken card */}
            <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-3 text-center space-y-1">
              <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Kraken</div>
              <div className="text-[10px] text-slate-500 font-mono">Taker Fee: 0.40%</div>
              <div className="pt-2 border-t border-slate-900/40 mt-1">
                <div className="text-xs text-slate-400 font-mono">Ask: <span className="text-slate-100 font-bold">${currentSpread ? currentSpread.krakenAsk.toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}</span></div>
                <div className="text-xs text-slate-400 font-mono">Bid: <span className="text-slate-100 font-bold">${currentSpread ? currentSpread.krakenBid.toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}</span></div>
              </div>
            </div>
          </div>

          {/* Spread Overview display */}
          <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-mono uppercase">گەورەترین جیاوازی نرخ | MAX RAW SPREAD DIFFERENTIAL</span>
              <div className="text-xl font-mono font-black text-slate-200 mt-1 flex items-baseline gap-1.5">
                <span>${currentSpread ? currentSpread.maxSpread.toFixed(2) : '0.00'}</span>
                <span className="text-xs font-normal text-slate-400">USD</span>
              </div>
            </div>
            
            <div className="w-full sm:w-auto flex items-center gap-3">
              <div className="text-left font-mono">
                <div className="text-[10px] text-slate-500">EST. TRANSFER COST</div>
                <div className="text-xs text-slate-300 font-bold">$3.50 flat</div>
              </div>
              <div className="text-left font-mono border-r border-slate-800 pr-3">
                <div className="text-[10px] text-slate-500">SLIPPAGE BUFF</div>
                <div className="text-xs text-slate-300 font-bold">{slippage}%</div>
              </div>
              <div className="text-left font-mono border-r border-slate-800 pr-3">
                <div className="text-[10px] text-slate-500">RE-ROUTE LOCKS</div>
                <div className="text-xs text-emerald-400 font-bold">ACTIVE</div>
              </div>
            </div>
          </div>
        </div>

        {/* PHASE 3: MULTI-ASSET TRIANGULAR FX & STATISTICAL COINTEGRATION ARBITRAGE */}
        <div id="phase3-arbitrage-multiasset" className="bg-[#050914]/85 border border-slate-900 rounded-2xl p-5 space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400 shrink-0" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>TRIANGULAR FX & STATISTICAL COINTEGRATION ARBITRAGE</span>
                <span className="px-2 py-0.5 text-[10px] bg-purple-950 text-purple-400 border border-purple-500/30 rounded">
                  PHASE 3
                </span>
              </h2>
            </div>
            <span className="text-[10px] text-slate-500">CROSS-CURRENCY LOOP & ADF Z-SCORE</span>
          </div>

          {/* Triangular FX Opportunities */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 block uppercase">1. TRIANGULAR FX CROSS SPREADS</span>
            <div className="grid grid-cols-1 gap-2">
              {triangularOpps.map((opp, idx) => (
                <div key={idx} className="p-3 bg-slate-950/80 border border-slate-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                  <div>
                    <span className="text-slate-100 font-bold block">{opp.pairPath}</span>
                    <span className="text-[10px] text-slate-400">
                      Leg 1 ({opp.leg1Symbol}): {opp.leg1Rate} | Leg 2 ({opp.leg2Symbol}): {opp.leg2Rate}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-[10px] text-slate-500 block">IMPLIED vs DIRECT</span>
                      <span className="font-bold text-slate-200">{opp.impliedRate} / {opp.leg3DirectRate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">NET EDGE</span>
                      <span className={`font-bold ${opp.netProfitPips > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        +{opp.netProfitPips} pips
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${opp.isExecutable ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900 text-slate-500'}`}>
                      {opp.isExecutable ? "EXECUTABLE" : "MONITORING"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statistical Arbitrage & Cointegration */}
          <div className="space-y-2 pt-2 border-t border-slate-900">
            <span className="text-xs font-bold text-slate-300 block uppercase">2. STATISTICAL COINTEGRATION (ADF TEST & Z-SCORE)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {statArbPairs.map((pair, idx) => (
                <div key={idx} className="p-3 bg-slate-950/80 border border-slate-900 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-100">{pair.pair1} / {pair.pair2}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pair.signal === 'LONG_SPREAD' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : pair.signal === 'SHORT_SPREAD' ? 'bg-rose-950 text-rose-400 border border-rose-500/30' : 'bg-slate-900 text-slate-400'}`}>
                      {pair.signal}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Hedge Ratio (OLS Beta): <strong>{pair.hedgeRatioOLS}</strong></span>
                    <span>Spread Z-Score: <strong className={Math.abs(pair.spreadZScore) > 1.8 ? 'text-amber-400 font-bold' : 'text-slate-200'}>{pair.spreadZScore}</strong></span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-900">
                    <span>ADF p-val: {pair.adfTestPValue} (Cointegrated: {pair.isCointegrated ? "YES" : "NO"})</span>
                    <span>Reversion: +{pair.targetReversionPips} pips</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compliance Checklist and Live Activator Toggle */}
        <div className="bg-[#050914]/85 border border-slate-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-200">مەرجەکانی یاسایی و چالاککردنی بزوێنەر | Compliance & Live Execution</h2>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            بۆ کاراکردنی بازرگانی خۆکاری ئاربیتراژ لەسەر نرخە ڕاستەقینەکان، پێویستە سەرجەم مەرجەکانی خوارەوە پشکنین و واژۆ بکەیت. ئەم مۆدەتە پێویستە گەیتی سانبۆکسی Stage 4 تێپەڕێنێت.
          </p>

          <div className="space-y-3 bg-slate-950/60 p-4 border border-slate-900 rounded-xl text-xs">
            {/* Checklist 1 */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={state?.compliance.tosPermitted || false}
                onChange={() => handleComplianceToggle('tos')}
                disabled={isActionLoading}
                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-purple-600 focus:ring-purple-800 mt-0.5 accent-purple-600 cursor-pointer"
              />
              <div className="text-right">
                <div className="font-bold text-slate-300">پەسەندکردنی مەرجەکانی ئاڵوگۆڕەکان (Terms of Service Permitted)</div>
                <p className="text-[10px] text-slate-500 mt-0.5">پشتڕاست دەکەمەوە کە بازرگانی یەک کاتی لە نێوان ئەکاونتە لکێندراوەکانی Binance، Coinbase و Kraken مەرجەکانی بەکارهێنانیان پێشێل ناکات.</p>
              </div>
            </label>

            {/* Checklist 2 */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2.5 border-t border-slate-900/50">
              <input 
                type="checkbox" 
                checked={state?.compliance.regulationsPermitted || false}
                onChange={() => handleComplianceToggle('regulations')}
                disabled={isActionLoading}
                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-purple-600 focus:ring-purple-800 mt-0.5 accent-purple-600 cursor-pointer"
              />
              <div className="text-right">
                <div className="font-bold text-slate-300">ڕەزامەندی یاسایی ناوخۆیی (Regulatory Compliance Sign-off)</div>
                <p className="text-[10px] text-slate-500 mt-0.5">پشتڕاست دەکەمەوە کە بازرگانی ئاربیتراژی خێرا (HFT) و مانیپۆلاسیۆنی نادروست بەپێی یاسا داراییەکانی دەسەڵاتی دادوەری من ڕێگەپێدراوە.</p>
              </div>
            </label>

            {/* Checklist 3 (Sandbox status, readonly from active DRL model) */}
            <div className="flex items-start gap-2.5 pt-2.5 border-t border-slate-900/50">
              <div className="mt-0.5 shrink-0">
                {state?.compliance.sandboxPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div className="text-right flex-1 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-300">گەیتی سانبۆکسی Stage 4 (DRL Sandbox Promotion Gate)</div>
                  <p className="text-[10px] text-slate-500 mt-0.5">مۆدێلی چالاکی DRL کاندیدەکەی پێویستە گەیتی گەشەکردنی بە سەرکەوتوویی بڕیبێت (Sharpe Ratio &gt;= 1.2).</p>
                </div>
                <div>
                  {state?.compliance.sandboxPassed ? (
                    <span className="bg-emerald-950 text-emerald-400 text-[10px] px-2 py-0.5 font-bold rounded-md font-mono border border-emerald-900 shrink-0">پەسەندکرا | PASSED</span>
                  ) : (
                    <span className="bg-rose-950 text-rose-400 text-[10px] px-2 py-0.5 font-bold rounded-md font-mono border border-rose-900 shrink-0 font-sans">تێپەڕنەبووە | FAILED</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Master live switch toggle control */}
          <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-4 flex items-center justify-between">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-300">بزوێنەری لایڤ ئاربیتراژ | Live Arbitrage Engine Activation</span>
              <p className="text-[10px] text-slate-500 mt-0.5">جێبەجێکردنی هاوکاتی لایڤ و نەهێشتنی ناڕێکی بە لایڤی.</p>
            </div>

            <button
              onClick={handleLiveToggle}
              disabled={isActionLoading || !state}
              className={`px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all flex items-center gap-2 cursor-pointer border ${
                state?.config.liveEnabled 
                  ? 'bg-rose-600 hover:bg-rose-700 border-rose-500 text-slate-100 shadow-md shadow-rose-950/30'
                  : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400'
              }`}
            >
              <Zap className={`w-4 h-4 ${state?.config.liveEnabled ? 'text-amber-300 fill-amber-300 animate-bounce' : 'text-slate-500'}`} />
              <span>
                {state?.config.liveEnabled ? "ناچالاککردن | DISABLE ENGINE" : "چالاککردن | ENABLE LIVE"}
              </span>
            </button>
          </div>
        </div>

        {/* Target Parameters Threshold Manager */}
        <div className="bg-[#050914]/85 border border-slate-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
            <Settings className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-200">پارامیتەرەکانی قازانج و ڕێسک | Arbitrage Risk Thresholds</h2>
          </div>

          <form onSubmit={handleSaveThresholds} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 text-right">
                <label className="font-bold text-slate-300 font-mono">THRESHOLD NET PROFIT ($)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 font-mono text-slate-200 text-left focus:outline-none focus:border-purple-800"
                />
                <span className="text-[10px] text-slate-500">قازانجی خاوێن دوای دەرکردنی فێییەکان.</span>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="font-bold text-slate-300 font-mono">ORDER SIZE (BTC)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={orderSize}
                  onChange={(e) => setOrderSize(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 font-mono text-slate-200 text-left focus:outline-none focus:border-purple-800"
                />
                <span className="text-[10px] text-slate-500">قەبارەی پۆزیشن بۆ ڕەچاوکردن.</span>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="font-bold text-slate-300 font-mono">SLIPPAGE ESTIMATION (%)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 font-mono text-slate-200 text-left focus:outline-none focus:border-purple-800"
                />
                <span className="text-[10px] text-slate-500">لادانی نرخ لە کاتی پڕبوونەوە.</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={isActionLoading}
                className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/50 border border-rose-900 text-rose-300 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>سڕینەوەی لۆگەکان | Clear Logs</span>
              </button>

              <button
                type="submit"
                disabled={isActionLoading}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-emerald-400 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>پاشەکەوتکردن | Update Risk Specs</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Scanned Opportunities & Executed trades with detailed audits */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Scanned Inefficiencies Log */}
        <div className="bg-[#050914]/85 border border-slate-900 rounded-2xl p-5 space-y-4 flex flex-col h-[340px]">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
            <TrendingUp className="w-4 h-4 text-purple-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-200">ناڕێکییە گەڕاوەکان | Scanned Market Inefficiencies</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {opportunities.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs py-8">
                <HelpCircle className="w-8 h-8 text-slate-800 mb-2 shrink-0" />
                <span>هیچ ناڕێکییەک نەدۆزراوەتەوە تا ئێستا</span>
                <span className="text-[10px] text-slate-700 mt-0.5">Searching parallel venues continuously...</span>
              </div>
            ) : (
              opportunities.map((opp) => {
                const passed = opp.netEdge >= threshold;
                return (
                  <div key={opp.id} className={`p-3 border rounded-xl flex items-center justify-between text-xs transition-all ${
                    passed 
                      ? 'bg-purple-950/20 border-purple-900/60 shadow-md shadow-purple-950/10' 
                      : 'bg-slate-950/40 border-slate-900'
                  }`}>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300 uppercase">{opp.buyVenue} → {opp.sellVenue}</span>
                        <span className="text-[9px] text-slate-500 font-mono">({opp.pair})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                        <span>Buy: ${(opp.buyPrice ?? 0).toLocaleString()}</span>
                        <span>Sell: ${(opp.sellPrice ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="text-[9px] text-slate-600 font-mono">{new Date(opp.timestamp).toLocaleTimeString()}</div>
                    </div>

                    <div className="text-left font-mono space-y-1">
                      <div className={`font-bold ${passed ? 'text-emerald-400' : 'text-slate-400'}`}>
                        +${opp.netEdge.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Fees: ${opp.fees.toFixed(2)}
                      </div>
                      <div>
                        {passed ? (
                          <span className="bg-emerald-950/80 text-emerald-400 text-[8px] px-1.5 py-0.5 font-bold rounded border border-emerald-900 uppercase">Passed Gate</span>
                        ) : (
                          <span className="bg-slate-900 text-slate-500 text-[8px] px-1.5 py-0.5 font-bold rounded border border-slate-950 uppercase">Below Threshold</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Trade Execution Fallbacks Audit Log */}
        <div className="bg-[#050914]/85 border border-slate-900 rounded-2xl p-5 space-y-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-bold text-slate-200">مێژووی بازرگانی و ئەپلیکەیشنە شکستخواردووەکان | Trade Executions & Leg Fallbacks</h2>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Total Runs: {trades.length}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar text-xs">
            {trades.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs py-8">
                <AlertTriangle className="w-8 h-8 text-slate-800 mb-2 shrink-0 animate-pulse" />
                <span>هیچ بازرگانییەکی ئاربیتراژ جێبەجێ نەکراوە</span>
                <span className="text-[10px] text-slate-700 mt-0.5">Enable Live Arbitrage and meet all compliance requirements.</span>
              </div>
            ) : (
              trades.map((trade) => {
                let statusBadge = null;
                if (trade.status === 'SUCCESS_COMPLETED') {
                  statusBadge = <span className="bg-emerald-950 text-emerald-400 text-[9px] px-2 py-0.5 font-bold rounded border border-emerald-900">SUCCESS</span>;
                } else if (trade.status === 'SELL_LEG_FAILED_UNWOUND') {
                  statusBadge = <span className="bg-rose-950 text-rose-400 text-[9px] px-2 py-0.5 font-bold rounded border border-rose-900">LEG_FAILED_UNWOUND</span>;
                } else {
                  statusBadge = <span className="bg-amber-950 text-amber-400 text-[9px] px-2 py-0.5 font-bold rounded border border-amber-900">PARTIAL_FILL_RESIZED</span>;
                }

                return (
                  <div key={trade.id} className="bg-slate-950/60 border border-slate-900/80 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-right">
                        <div className="font-bold text-slate-300 uppercase">{trade.buyVenue} → {trade.sellVenue}</div>
                        <div className="text-[9px] text-slate-600 font-mono">{new Date(trade.timestamp).toLocaleString()}</div>
                      </div>
                      <div className="text-left font-mono">
                        <div className={`font-black ${trade.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.realizedPnL >= 0 ? '+' : ''}${trade.realizedPnL.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-slate-500">{trade.quantity} BTC</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-900/60 pt-2 text-[10px]">
                      <span className="text-slate-500 font-mono">Status Indicator:</span>
                      {statusBadge}
                    </div>

                    {/* Detailed fallback audits showing actual leg actions */}
                    <div className="bg-slate-950 p-2.5 border border-slate-900/80 rounded-lg space-y-1">
                      <div className="text-[9px] text-purple-400 font-mono font-bold">FALLBACK STRATEGY PROTOCOL:</div>
                      <div className="text-[10px] text-slate-400 leading-relaxed font-sans text-right">
                        {trade.log}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
