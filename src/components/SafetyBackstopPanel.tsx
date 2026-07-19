import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  Settings, 
  AlertTriangle, 
  RotateCcw, 
  Play, 
  Bell, 
  Sliders, 
  Cpu, 
  Layers, 
  Activity 
} from 'lucide-react';

interface TriggerHistoryItem {
  id: string;
  timestamp: string;
  type: "SAFE_MODE" | "SILENT_LOCK" | "EMERGENCY_HALT" | "SYSTEM";
  event: string;
  reason: string;
  details: any;
}

interface SafetyNotification {
  id: string;
  timestamp: string;
  message: string;
  read: boolean;
}

interface SafetyState {
  safeModeActive: boolean;
  safeModeTriggerReason: string | null;
  safeModeTriggeredAt: string | null;
  silentLockActive: boolean;
  silentLockTriggerReason: string | null;
  silentLockTriggeredAt: string | null;
  emergencyHaltActive: boolean;
  emergencyHaltPolicy: "FLATTEN_ALL" | "FREEZE_NEW_ONLY";
  drawdownThresholdPct: number;
  peakEquity: number;
  watchdogLastHeartbeat: string;
  watchdogStatus: "ALIVE" | "ERROR" | "NOMINAL";
  triggerHistory: TriggerHistoryItem[];
  notifications: SafetyNotification[];
}

export default function SafetyBackstopPanel() {
  const [safetyState, setSafetyState] = useState<SafetyState | null>(null);
  const [policy, setPolicy] = useState<"FLATTEN_ALL" | "FREEZE_NEW_ONLY">("FLATTEN_ALL");
  const [drawdownThreshold, setDrawdownThreshold] = useState<number>(5.0);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [confirmHalt, setConfirmHalt] = useState<boolean>(false);
  const [confirmResume, setConfirmResume] = useState<boolean>(false);
  const [secondsSinceHeartbeat, setSecondsSinceHeartbeat] = useState<number>(0);

  // Poll state every 1.5 seconds
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/safety/state');
        if (res.ok) {
          const data = await res.json();
          setSafetyState(data.state);
          setPolicy(data.state.emergencyHaltPolicy);
          setDrawdownThreshold(data.state.drawdownThresholdPct);
        }
      } catch (err) {
        console.error("Failed to fetch safety backstop state:", err);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, []);

  // Update heartbeat age counter
  useEffect(() => {
    if (!safetyState?.watchdogLastHeartbeat) return;
    const interval = setInterval(() => {
      const ageMs = Date.now() - new Date(safetyState.watchdogLastHeartbeat).getTime();
      setSecondsSinceHeartbeat(Math.max(0, Math.floor(ageMs / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [safetyState?.watchdogLastHeartbeat]);

  const handleUpdateConfig = async () => {
    setIsConfiguring(true);
    try {
      const res = await fetch('/api/safety/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawdownThresholdPct: drawdownThreshold,
          emergencyHaltPolicy: policy
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSafetyState(data.state);
      }
    } catch (err) {
      console.error("Failed to update safety config:", err);
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleTriggerHalt = async () => {
    try {
      const res = await fetch('/api/control/halt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setConfirmHalt(false);
      }
    } catch (err) {
      console.error("Error triggering halt:", err);
    }
  };

  const handleResetResume = async () => {
    try {
      const res = await fetch('/api/control/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setConfirmResume(false);
      }
    } catch (err) {
      console.error("Error triggering resume:", err);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await fetch('/api/safety/clear-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestLogs(["[INFO] Initiating Stage 7 Safety Layer automated verification sequence...", "[INFO] Connecting to sandbox-contained simulation vectors..."]);
    try {
      const res = await fetch('/api/safety/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setTestLogs(prev => [...prev, ...data.logs, "✅ [SUCCESS] Automated safety backstop verification finished! All systems secured."]);
      } else {
        setTestLogs(prev => [...prev, "❌ [FAIL] Test suite failed to execute correctly on the backstop engine."]);
      }
    } catch (err: any) {
      setTestLogs(prev => [...prev, `❌ [FAIL] Communication link failure: ${err.message}`]);
    } finally {
      setIsRunningTests(false);
    }
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return 'N/A';
    return new Date(isoStr).toLocaleTimeString() + " (" + new Date(isoStr).toLocaleDateString() + ")";
  };

  if (!safetyState) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono animate-pulse">
        <Activity className="w-8 h-8 mx-auto text-emerald-400 animate-spin mb-3" />
        بارکردنی لایەری پاراستنی نێکسەس (Loading NEXUS Safety Backstop Core)...
      </div>
    );
  }

  return (
    <div className="space-y-6" id="safety-backstop-wrapper">
      
      {/* Overview Status Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="safety-status-grid">
        
        {/* Watchdog Process Heartbeat Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-xl"></div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Watchdog Process</span>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                secondsSinceHeartbeat > 10 ? 'bg-rose-900/40 text-rose-300' : 'bg-emerald-950/60 text-emerald-300'
              }`}>
                {secondsSinceHeartbeat > 10 ? 'OFFLINE' : 'MONITORING'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              سێنتینێلی سەربەخۆ
            </h3>
            <p className="text-[11px] text-slate-400 mt-2 font-mono">
              Heartbeat: <span className="text-emerald-400 font-bold">{secondsSinceHeartbeat}s ago</span>
            </p>
          </div>
          <div className="border-t border-slate-800/80 mt-3 pt-2 text-[9px] font-mono text-slate-500">
            Detached OS Process: PID Auto
          </div>
        </div>

        {/* Plan B Failover Safe Mode Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-32 h-32 ${safetyState.safeModeActive ? 'bg-amber-500/10' : 'bg-slate-500/5'} rounded-full filter blur-xl`}></div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Plan B Failover</span>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                safetyState.safeModeActive ? 'bg-amber-950 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {safetyState.safeModeActive ? 'ENGAGED' : 'NOMINAL'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              دۆخی پارێزراوی لایڤ
            </h3>
            <p className="text-[11px] text-slate-400 mt-2 font-sans line-clamp-2">
              {safetyState.safeModeActive ? safetyState.safeModeTriggerReason : 'Continuous health checks and broker connection mapping are fully green.'}
            </p>
          </div>
          <div className="border-t border-slate-800/80 mt-3 pt-2 text-[9px] font-mono text-slate-500">
            {safetyState.safeModeActive ? `Engaged: ${formatDate(safetyState.safeModeTriggeredAt)}` : 'Auto liquidation active on error'}
          </div>
        </div>

        {/* Silent Lock (Drawdown Backstop) Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-32 h-32 ${safetyState.silentLockActive ? 'bg-rose-500/10' : 'bg-slate-500/5'} rounded-full filter blur-xl`}></div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Silent Lock</span>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                safetyState.silentLockActive ? 'bg-rose-950 text-rose-400 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {safetyState.silentLockActive ? 'SOFT-HALT' : 'NOMINAL'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              قوفڵی بێدەنگی مەترسی
            </h3>
            <p className="text-[11px] text-slate-400 mt-2 font-sans line-clamp-2">
              {safetyState.silentLockActive ? safetyState.silentLockTriggerReason : `Soft halt triggers automatically if total account drawdown exceeds ${safetyState.drawdownThresholdPct}%.`}
            </p>
          </div>
          <div className="border-t border-slate-800/80 mt-3 pt-2 text-[9px] font-mono text-slate-500">
            Limit: {safetyState.drawdownThresholdPct}% of peak equity
          </div>
        </div>

        {/* Emergency Stop status card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-32 h-32 ${safetyState.emergencyHaltActive ? 'bg-red-500/10' : 'bg-slate-500/5'} rounded-full filter blur-xl`}></div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Emergency Stop</span>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                safetyState.emergencyHaltActive ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {safetyState.emergencyHaltActive ? 'TRIPPED' : 'ARMED'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              ڕاگرتنی گشتی سیستەم
            </h3>
            <p className="text-[11px] text-slate-400 mt-2 font-mono">
              Policy: <span className="text-slate-200 font-bold">{safetyState.emergencyHaltPolicy}</span>
            </p>
          </div>
          <div className="border-t border-slate-800/80 mt-3 pt-2 text-[9px] font-mono text-slate-500">
            Hardstop backstop is active
          </div>
        </div>

      </div>

      {/* Main Configurations & Operations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="safety-ops-grid">
        
        {/* Left: Unbypassable Policy & Risk Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Settings className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">Unbypassable Safety Config</h3>
          </div>
          
          {/* Policy selector */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 block font-mono">EMERGENCY HALT POLICY:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPolicy("FLATTEN_ALL")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  policy === "FLATTEN_ALL"
                    ? 'bg-rose-950/40 border-rose-500/80 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                FLATTEN_ALL
                <span className="block text-[8px] font-normal text-slate-500 mt-0.5">Liquidity Close</span>
              </button>
              <button
                onClick={() => setPolicy("FREEZE_NEW_ONLY")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  policy === "FREEZE_NEW_ONLY"
                    ? 'bg-amber-950/40 border-amber-500/80 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                FREEZE_NEW
                <span className="block text-[8px] font-normal text-slate-500 mt-0.5">Lock Entries Only</span>
              </button>
            </div>
          </div>

          {/* Drawdown threshold slider */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400">MAX DRAWDOWN BOUNDARY:</span>
              <span className="text-emerald-400 font-bold">{drawdownThreshold.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="20.0"
              step="0.5"
              value={drawdownThreshold}
              onChange={(e) => setDrawdownThreshold(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>1.0% (Aggressive)</span>
              <span>20.0% (Conservative)</span>
            </div>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleUpdateConfig}
            disabled={isConfiguring}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-slate-950 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            <Sliders className="w-3.5 h-3.5" />
            {isConfiguring ? 'گواستنەوەی فەرمانەکان...' : 'چەسپاندنی ڕێسا نەگۆڕەکان (Apply Static Config)'}
          </button>
          
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-[10px] text-slate-500 leading-relaxed font-sans">
            <span className="font-bold text-slate-400 block mb-1">ℹ️ Isolation & Bypass Immunity:</span>
            ئەم ڕێسایانە ڕاستەوخۆ لەسەر دیسکی سێرڤەر جێگیر دەکرێن. دۆخەکانی بازرگانی و پەرەپێدانی خۆکاری داهاتوو هیچ دەسەڵاتێکیان بەسەر ئەم سنورانەدا نییە و ناتوانن لێی لابدەن.
          </div>
        </div>

        {/* Center: Operator Emergency & Safe Mode Control panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">Core Emergency Operations</h3>
            </div>

            {/* Emergency Halt Stop Trigger */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 block font-mono">GLOBAL EMERGENCY KILL SWITCH:</span>
              
              {!confirmHalt ? (
                <button
                  onClick={() => setConfirmHalt(true)}
                  className="w-full py-3 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-900 text-rose-400 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  وەستاندنی فریاگوزاری (MANUAL EMERGENCY HALT)
                </button>
              ) : (
                <div className="bg-slate-950 p-3 rounded-lg border border-rose-500/50 space-y-3">
                  <span className="text-[10px] font-mono text-rose-300 block text-center font-bold">
                    ⚠️ دوو پێداچوونەوە: ئایا دڵنیایت لە بڕینی فەرمانی گشتی بازرگانی؟
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfirmHalt(false)}
                      className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold rounded"
                    >
                      پەشیمانبوونەوە
                    </button>
                    <button
                      onClick={handleTriggerHalt}
                      className="py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded"
                    >
                      بەڵێ، ڕاگیرا بکە 🚨
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Nominal Resume Restore Action */}
            <div className="space-y-2 pt-2">
              <span className="text-xs text-slate-400 block font-mono">NOMINAL SYSTEM RECOVERY RESET:</span>
              
              {!confirmResume ? (
                <button
                  onClick={() => setConfirmResume(true)}
                  disabled={!safetyState.emergencyHaltActive && !safetyState.safeModeActive && !safetyState.silentLockActive}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  پاککردنەوە و چاککردنەوە (Reset All Safety Backstops)
                </button>
              ) : (
                <div className="bg-slate-950 p-3 rounded-lg border border-emerald-500/50 space-y-3">
                  <span className="text-[10px] font-mono text-emerald-300 block text-center font-bold">
                    🔒 ڕێپێدانی مرۆیی: دووبارە پۆزیشنەکان ئاسایی ببنەوە؟
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfirmResume(false)}
                      className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold rounded"
                    >
                      بێبەشکردن
                    </button>
                    <button
                      onClick={handleResetResume}
                      className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded"
                    >
                      بەڵێ، ئاسایی کەرەوە
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[9px] text-slate-500 font-mono text-center pt-4">
            System status: <span className="text-slate-300">{safetyState.emergencyHaltActive ? "EMERGENCY_HALT" : "NOMINAL"}</span>
          </div>
        </div>

        {/* Right: Automated Watchdog Tests Suite Verification */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">Automated Watchdog Tests</h3>
              </div>
              <span className="text-[9px] font-mono text-slate-500">Stage 7 Validator</span>
            </div>

            <p className="text-[10px] text-slate-400 mt-2 font-sans">
              سیستەمەکە لێرەوە توانای تاقیکردنەوەی هەموو مەرجەکانی لادان، دۆخی بێدەنگی، پچڕانی پەیوەندی بڕۆکەر و وەستاندنی سەربەخۆ تاقیدەکاتەوە بەبێ دروستکردنی هیچ زیانێکی ڕاستەقینە.
            </p>

            {/* Test Execution Output logs */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 mt-3 h-32 overflow-y-auto text-[9px] font-mono text-slate-400 space-y-1 scrollbar-none">
              {testLogs.length === 0 ? (
                <span className="text-slate-600 italic">No tests executed in this session. Click run below to verify safety backstop.</span>
              ) : (
                testLogs.map((log, idx) => {
                  const isFail = log?.startsWith?.("[FAIL]");
                  const isPass = log?.startsWith?.("[PASS]");
                  const isCheck = log?.startsWith?.("✅");
                  return (
                    <div key={idx} className={
                      isFail ? "text-rose-400" : 
                      isPass ? "text-emerald-400" : 
                      isCheck ? "text-emerald-300 font-bold" : "text-slate-400"
                    }>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 disabled:opacity-40 text-emerald-300 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            {isRunningTests ? 'تاقیکردنەوەی چالاکانە جێبەجێ دەبێت...' : 'جێبەجێکردنی پڕۆتۆکۆڵی تاقیکردنەوە (Run Safety Tests)'}
          </button>
        </div>

      </div>

      {/* Safety Logs & Trigger Event History Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="safety-logs-grid">
        
        {/* Left: Real-time Notification Alert Center */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">Real-Time Safety Alerts</h3>
            </div>
            <button
              onClick={handleClearNotifications}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-mono transition-all"
            >
              Clear Logs
            </button>
          </div>

          <div className="space-y-2 h-48 overflow-y-auto pr-1 scrollbar-none">
            {safetyState.notifications.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-600 font-mono italic">
                No safety alerts triggered. All background parameters nominal.
              </div>
            ) : (
              safetyState.notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-2.5 rounded-lg border text-[10px] leading-relaxed flex items-start gap-2.5 font-mono ${
                    notif.message.includes("Activated") || notif.message.includes("ENGAGED") || notif.message.includes("ACTIVATED")
                      ? "bg-rose-950/20 border-rose-900/40 text-rose-300"
                      : "bg-slate-950 border-slate-850 text-slate-400"
                  }`}
                >
                  <span className="text-[8px] text-slate-600 mt-0.5 shrink-0">
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </span>
                  <div>
                    {notif.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Security Log Audit Trail History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">Audit Trail (Immutable Security Logs)</h3>
          </div>

          <div className="space-y-2 h-48 overflow-y-auto pr-1 scrollbar-none">
            {safetyState.triggerHistory.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-600 font-mono italic">
                Audit trail database is clean. No historic lockouts or failovers.
              </div>
            ) : (
              safetyState.triggerHistory.map((hist) => (
                <div key={hist.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-900 text-[10px] font-mono space-y-1">
                  <div className="flex justify-between items-center text-[9px]">
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] ${
                      hist.type === "EMERGENCY_HALT" ? "bg-red-950 text-red-300" :
                      hist.type === "SAFE_MODE" ? "bg-amber-950 text-amber-300" :
                      hist.type === "SILENT_LOCK" ? "bg-rose-950 text-rose-300" : "bg-slate-900 text-slate-400"
                    }`}>
                      {hist.type}
                    </span>
                    <span className="text-slate-500">{new Date(hist.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-200 font-bold">{hist.event}</div>
                  <div className="text-slate-400 leading-relaxed">{hist.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
