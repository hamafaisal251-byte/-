import { useState, useEffect } from 'react';
import { 
  Send, 
  Settings, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCcw, 
  FileText, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  ToggleLeft, 
  ToggleRight,
  Database,
  Smartphone
} from 'lucide-react';

interface EventToggles {
  silentLock: boolean;
  emergencyHalt: boolean;
  safeMode: boolean;
  candidateReview: boolean;
  equityMilestone: boolean;
  watchdogAlert: boolean;
  ciFailure: boolean;
  dailyReport: boolean;
  weeklyReport: boolean;
}

interface TelegramConfigData {
  enabled: boolean;
  botToken: string;
  chatId: string;
  maskedToken?: string;
  dailyReportTimeUtc: string;
  eventToggles: EventToggles;
}

interface NotificationAuditLog {
  id: string | number;
  timestamp: string;
  eventType: string;
  channel: string;
  content: string;
  deliveryStatus: "SUCCESS" | "FAILED" | "RETRYING" | "SKIPPED";
  errorMessage: string | null;
}

export default function TelegramNotificationPanel() {
  const [config, setConfig] = useState<TelegramConfigData>({
    enabled: true,
    botToken: '',
    chatId: '',
    dailyReportTimeUtc: '20:00',
    eventToggles: {
      silentLock: true,
      emergencyHalt: true,
      safeMode: true,
      candidateReview: true,
      equityMilestone: true,
      watchdogAlert: true,
      ciFailure: true,
      dailyReport: true,
      weeklyReport: true
    }
  });

  const [inputBotToken, setInputBotToken] = useState<string>('');
  const [inputChatId, setInputChatId] = useState<string>('');
  const [inputReportTime, setInputReportTime] = useState<string>('20:00');
  const [logs, setLogs] = useState<NotificationAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [reportTriggerStatus, setReportTriggerStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'toggles' | 'logs'>('config');

  const fetchConfigAndLogs = async () => {
    try {
      const [cfgRes, logsRes] = await Promise.all([
        fetch('/api/notifications/telegram/config'),
        fetch('/api/notifications/telegram/logs')
      ]);

      if (cfgRes.ok) {
        const data = await cfgRes.json();
        setConfig(data.config);
        setInputBotToken(data.config.maskedToken || data.config.botToken || '');
        setInputChatId(data.config.chatId || '');
        setInputReportTime(data.config.dailyReportTimeUtc || '20:00');
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
    } catch (err) {
      console.warn("Transient fetch notice for Telegram config or logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndLogs();
    const interval = setInterval(fetchConfigAndLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setTestResult(null);
    try {
      const payload: any = {
        enabled: config.enabled,
        chatId: inputChatId.trim(),
        dailyReportTimeUtc: inputReportTime,
        eventToggles: config.eventToggles
      };
      // Only include botToken if user modified it away from masked string
      if (inputBotToken && !inputBotToken.includes('...')) {
        payload.botToken = inputBotToken.trim();
      }

      const res = await fetch('/api/notifications/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setTestResult({ success: true, message: 'Telegram alert configuration saved successfully!' });
      } else {
        setTestResult({ success: false, message: 'Failed to update configuration.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleGlobal = async (newEnabled: boolean) => {
    setConfig(prev => ({ ...prev, enabled: newEnabled }));
    try {
      await fetch('/api/notifications/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled })
      });
    } catch (err) {
      console.error("Error toggling global alert status:", err);
    }
  };

  const handleToggleEvent = async (key: keyof EventToggles) => {
    const updatedToggles = { ...config.eventToggles, [key]: !config.eventToggles[key] };
    setConfig(prev => ({ ...prev, eventToggles: updatedToggles }));

    try {
      await fetch('/api/notifications/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventToggles: updatedToggles })
      });
    } catch (err) {
      console.error("Error toggling event:", err);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/notifications/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
      fetchConfigAndLogs();
    } catch (err: any) {
      setTestResult({ success: false, message: `Test dispatch error: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerReport = async (type: 'daily' | 'weekly') => {
    setReportTriggerStatus(`Triggering ${type} summary report...`);
    try {
      const res = await fetch('/api/notifications/telegram/trigger-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      setReportTriggerStatus(data.message);
      setTimeout(() => setReportTriggerStatus(null), 4000);
      fetchConfigAndLogs();
    } catch (err: any) {
      setReportTriggerStatus(`Report trigger error: ${err.message}`);
      setTimeout(() => setReportTriggerStatus(null), 4000);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 font-mono text-xs animate-pulse">
        Connecting to Telegram Notification Engine...
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl" id="telegram-panel-root">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-950/80 border border-cyan-500/40 rounded-xl text-cyan-400">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
              سیستمی ئاگادارکردنەوەی تێلیگرام <span className="text-cyan-400 font-mono text-xs">| Telegram Push Alerts & Periodic Reports</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Proactive critical-event alerting & automated daily/weekly summaries delivered directly to your phone.
            </p>
          </div>
        </div>

        {/* Global Master Switch */}
        <div className="flex items-center space-x-3 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
          <span className="text-xs font-mono text-slate-300 font-semibold">Master Alert Channel:</span>
          <button
            onClick={() => handleToggleGlobal(!config.enabled)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              config.enabled 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {config.enabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {config.enabled ? 'ACTIVE' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* Tabs Sub-navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs font-mono">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'config'
              ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 font-bold'
              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Bot Credentials & Schedule
        </button>
        <button
          onClick={() => setActiveTab('toggles')}
          className={`px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'toggles'
              ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 font-bold'
              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          Critical Event Toggles
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 font-bold'
              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          `notifications_log` Audit Trail ({logs.length})
        </button>
      </div>

      {/* TAB 1: Bot Credentials & Schedule Configuration */}
      {activeTab === 'config' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Telegram Bot Token Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                Telegram Bot API Token
              </label>
              <input
                type="text"
                placeholder="e.g. 8192837491:AAH8xY_SampleToken..."
                value={inputBotToken}
                onChange={(e) => setInputBotToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono outline-none focus:border-cyan-500 transition-all"
              />
              <p className="text-[10px] text-slate-500 font-sans">
                Obtain via @BotFather on Telegram. Token remains encrypted & strictly isolated.
              </p>
            </div>

            {/* Telegram Chat ID Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                Telegram Chat ID or Channel ID
              </label>
              <input
                type="text"
                placeholder="e.g. -1002384910293 or 123456789"
                value={inputChatId}
                onChange={(e) => setInputChatId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono outline-none focus:border-cyan-500 transition-all"
              />
              <p className="text-[10px] text-slate-500 font-sans">
                Your personal Telegram User ID or Group/Channel ID where notifications are sent.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 font-mono">Automated Daily Report Dispatch Time (UTC)</span>
              </div>
              <input
                type="text"
                placeholder="20:00"
                value={inputReportTime}
                onChange={(e) => setInputReportTime(e.target.value)}
                className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono font-bold text-center outline-none focus:border-cyan-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              The automated daily summary includes demo-live account P&L, trade counts, win rate, drawdown from peak, candidate review events, and safety status.
            </p>
          </div>

          {/* Action Buttons: Save & Test Connection */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Settings className="w-3.5 h-3.5" />
                {isSaving ? 'Saving Credentials...' : 'Save Configuration'}
              </button>

              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2 bg-purple-950/80 text-purple-300 hover:text-purple-200 border border-purple-500/40 font-bold font-mono text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-purple-400" />
                {isTesting ? 'Sending Test Message...' : 'Test Connection'}
              </button>
            </div>

            {/* Immediate Manual Summary Dispatch Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleTriggerReport('daily')}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 font-mono text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3 h-3 text-cyan-400" />
                Dispatch Daily Report
              </button>

              <button
                onClick={() => handleTriggerReport('weekly')}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 font-mono text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3 h-3 text-cyan-400" />
                Dispatch Weekly Summary
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              testResult.success 
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {reportTriggerStatus && (
            <div className="p-2.5 bg-cyan-950/50 border border-cyan-500/30 rounded-xl text-xs font-mono text-cyan-300">
              {reportTriggerStatus}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Critical Event Toggles */}
      {activeTab === 'toggles' && (
        <div className="space-y-4 font-mono">
          <p className="text-xs text-slate-400 font-sans">
            Configure which specific events automatically trigger instant phone push notifications:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Toggle 1: Silent Lock */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  🛑 Silent Lock Triggered
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Drawdown threshold breach or daily loss soft-halt.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('silentLock')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.silentLock ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

            {/* Toggle 2: Emergency Halt */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  🚨 Emergency Halt Tripped
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Manual kill-switch or hard safety stop engaged.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('emergencyHalt')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.emergencyHalt ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

            {/* Toggle 3: Safe Mode */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  🛡️ Safe Mode Entered / Exited
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Failover parameters disengaged or restored.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('safeMode')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.safeMode ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

            {/* Toggle 4: Candidate Human Review */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  🧬 Candidate Review Required
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Candidate reaches AWAITING_HUMAN_CONFIRMATION.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('candidateReview')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.candidateReview ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

            {/* Toggle 5: Equity Milestones */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  📈 Equity High & Max Drawdown Milestones
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  New all-time demo-live peak or max drawdown low.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('equityMilestone')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.equityMilestone ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

            {/* Toggle 6: Watchdog Alert */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  🔥 Watchdog Main Process Unresponsive
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Independent sentinel detects main engine heartbeat loss.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('watchdogAlert')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.watchdogAlert ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

            {/* Toggle 7: CI Failure */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  ❌ CI Pipeline & Invariant Failure
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Automated proposals rejected by regression guard on main.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('ciFailure')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.ciFailure ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

            {/* Toggle 8: Daily & Weekly Summaries */}
            <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  📊 Daily & Weekly Periodic Summaries
                </span>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Automated end-of-day and 7-day trailing reports.
                </p>
              </div>
              <button 
                onClick={() => handleToggleEvent('dailyReport')}
                className="cursor-pointer text-cyan-400 hover:text-cyan-300"
              >
                {config.eventToggles.dailyReport ? <ToggleRight className="w-7 h-7 text-cyan-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: Audit Trail (`notifications_log` Table) */}
      {activeTab === 'logs' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800 pb-2">
            <span>AUDIT TRAIL RECORDED IN <code>notifications_log</code> TABLE</span>
            <span>SHOWING LAST {logs.length} DISPATCHES</span>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-sans">
              No notifications dispatched yet. Click "Test Connection" to trigger a test dispatch.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {logs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-400 text-[11px] uppercase tracking-wider">
                      [{log.eventType}]
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        log.deliveryStatus === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                        log.deliveryStatus === 'SKIPPED' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                        'bg-rose-950 text-rose-400 border border-rose-800/40'
                      }`}>
                        {log.deliveryStatus}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap line-clamp-3 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                    {log.content.replace(/<[^>]*>?/gm, '')}
                  </div>

                  {log.errorMessage && (
                    <div className="text-[10px] text-rose-400 font-mono">
                      Error: {log.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
