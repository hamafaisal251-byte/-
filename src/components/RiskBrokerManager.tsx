/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ExecutionAttributionPanel } from './ExecutionAttributionPanel';
import { 
  ShieldCheck, Database, Key, CheckCircle, AlertTriangle, Play, 
  RefreshCw, Layers, Lock, TrendingUp, 
  TrendingDown, Activity, Clock, X, Terminal, Settings2, Plus, LogOut,
  Globe, Radio, ShieldAlert, Wifi, Newspaper, Calendar, ArrowRight, UserCheck
} from 'lucide-react';

interface BrokerConnection {
  id: string;
  brokerType: 'oanda' | 'binance' | 'coinbase' | 'kraken' | 'metatrader5' | 'ib' | 'fix_gateway';
  apiUrl: string;
  accountId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastTestedTime: string;
  errorMessage?: string;
  targetCompId?: string;
  senderCompId?: string;
  maskedToken?: string;
  maskedSecret?: string;
  environment?: 'DEMO_LIVE' | 'REAL_LIVE';
}

interface NewsEvent {
  title: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  currency: string;
  forecast: string;
  previous: string;
  actual: string;
  minutesRemaining: number;
  sentimentScore: number;
}

interface RiskRules {
  maxDailyLossPercent: number;
  riskPerTradePercent: number;
  maxOpenPositions: number;
  maxLeverage: number;
  movingBreakEvenPips: number;
  hedgeLockLossPercent: number;
}

export default function RiskBrokerManager() {
  // 1. Core State
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [newsStats, setNewsStats] = useState({ minutesUntilHighImpactNews: 999, sentimentScore: 0.0, influenceMultiplier: 1.0 });
  const [fixStatus, setFixStatus] = useState({ status: 'LOGGED_OUT', targetCompId: '', senderCompId: '', inboundSeqNum: 1, outboundSeqNum: 1, logs: [] as string[] });
  const [securityInfo, setSecurityInfo] = useState({ hsmEncryptionStandard: '', isMasterKeyConfigured: false, allowedIps: [] as string[], maskedMutateKey: '', lastRotationTime: '' });
  const [selectedEnvironment, setSelectedEnvironment] = useState<'DEMO_LIVE' | 'REAL_LIVE'>('DEMO_LIVE');
  const [formEnvironment, setFormEnvironment] = useState<'DEMO_LIVE' | 'REAL_LIVE'>('DEMO_LIVE');
  
  // 2. Risk & Autopilot Sizing State
  const [riskRules, setRiskRules] = useState<RiskRules>(() => {
    const saved = localStorage.getItem('SOVEREIGN_RISK_RULES');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      maxDailyLossPercent: 2.5,
      riskPerTradePercent: 0.5,
      maxOpenPositions: 5,
      maxLeverage: 30,
      movingBreakEvenPips: 8.0,
      hedgeLockLossPercent: 4.0,
    };
  });
  const [autoRiskTuning, setAutoRiskTuning] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<boolean>(false);

  // 3. Configure Active Broker Modal/Form State
  const [activeConfigureBroker, setActiveConfigureBroker] = useState<BrokerConnection['brokerType'] | null>(null);
  const [formApiUrl, setFormApiUrl] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formApiToken, setFormApiToken] = useState('');
  const [formSecretKey, setFormSecretKey] = useState('');
  const [formPassphrase, setFormPassphrase] = useState('');
  const [formTargetCompId, setFormTargetCompId] = useState('OANDA_FIX_GATEWAY');
  const [formSenderCompId, setFormSenderCompId] = useState('SOVEREIGN_QUANT_CORE');
  
  // Form news keys state
  const [formNewsApiKey, setFormNewsApiKey] = useState('');
  const [formFinnhubKey, setFormFinnhubKey] = useState('');
  const [newsKeysSaved, setNewsKeysSaved] = useState(false);

  // Expanded News Platforms state
  const [newsPlatforms, setNewsPlatforms] = useState<any[]>([]);
  const [activeNewsConfig, setActiveNewsConfig] = useState<string | null>(null);
  const [formNewsPlatformKey, setFormNewsPlatformKey] = useState<string>('');
  const [newsPlatformTesting, setNewsPlatformTesting] = useState<boolean>(false);
  const [newsPlatformTestError, setNewsPlatformTestError] = useState<string>('');
  const [newsPlatformTestSuccess, setNewsPlatformTestSuccess] = useState<string>('');
  const [newsFeed, setNewsFeed] = useState<any[]>([]);
  const [sentimentState, setSentimentState] = useState<any>(null);
  const [hasCalendarFeed, setHasCalendarFeed] = useState<boolean>(false);

  // Custom Connectors States
  const [customConnectors, setCustomConnectors] = useState<any[]>([]);
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [editingConnector, setEditingConnector] = useState<any | null>(null);

  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<'broker' | 'news'>('news');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customAuthScheme, setCustomAuthScheme] = useState('api_key_header');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customSecretKey, setCustomSecretKey] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [customHeaderName, setCustomHeaderName] = useState('X-API-KEY');
  const [customParamName, setCustomParamName] = useState('api_key');

  const [customHmacAlgo, setCustomHmacAlgo] = useState('sha256');
  const [customHmacEncoding, setCustomHmacEncoding] = useState('hex');
  const [customHmacPlacement, setCustomHmacPlacement] = useState('header');
  const [customHmacSigName, setCustomHmacSigName] = useState('X-Signature');
  const [customHmacTimeName, setCustomHmacTimeName] = useState('X-Timestamp');

  const [newsRootPath, setNewsRootPath] = useState('articles');
  const [newsTitlePath, setNewsTitlePath] = useState('title');
  const [newsUrlPath, setNewsUrlPath] = useState('url');
  const [newsTimePath, setNewsTimePath] = useState('publishedAt');
  const [newsSentimentPath, setNewsSentimentPath] = useState('');

  const [brokerTestPath, setBrokerTestPath] = useState('/accounts');
  const [brokerTestMapping, setBrokerTestMapping] = useState('accounts');

  const [testResponseOutput, setTestResponseOutput] = useState<string>('');
  const [isTestingCustom, setIsTestingCustom] = useState<boolean>(false);
  const [testCustomSuccess, setTestCustomSuccess] = useState<string>('');
  const [testCustomError, setTestCustomError] = useState<string>('');

  // Form security allowlist state
  const [formAllowedIps, setFormAllowedIps] = useState('');
  const [allowlistSaved, setAllowlistSaved] = useState(false);

  // Loading/Error states
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // 4. Client-side Live Account Position Sim (Shared with backend logs)
  const [positions, setPositions] = useState<any[]>(() => {
    const saved = localStorage.getItem('SOVEREIGN_LIVE_POSITIONS');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'pos-1', symbol: 'EUR/USD', type: 'BUY', size: 1.5, entryPrice: 1.08450, currentPrice: 1.08580, sl: 1.08000, tp: 1.09500, pnl: 195.00 },
      { id: 'pos-2', symbol: 'GBP/USD', type: 'SELL', size: 2.0, entryPrice: 1.26420, currentPrice: 1.26310, sl: 1.27000, tp: 1.25200, pnl: 220.00 },
      { id: 'pos-3', symbol: 'BTC/USD', type: 'BUY', size: 0.5, entryPrice: 62450.00, currentPrice: 62780.00, sl: 61000.00, tp: 65000.00, pnl: 165.00 }
    ];
  });

  const [accountStats, setAccountStats] = useState<any>(() => {
    const saved = localStorage.getItem('SOVEREIGN_LIVE_ACCOUNT_STATS');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      balance: 104250.40,
      equity: 104830.40,
      usedMargin: 3750.00,
      freeMargin: 101080.40,
      marginLevel: 2795.4,
      todayPnl: 1420.50
    };
  });

  const [newOrderSymbol, setNewOrderSymbol] = useState<string>('EUR/USD');
  const [newOrderType, setNewOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [newOrderSize, setNewOrderSize] = useState<number>(1.0);
  
  // Sovereign Strategy Hub (Stage 3 States)
  const [strategiesConfig, setStrategiesConfig] = useState<Record<string, any>>({});
  const [strategyAuditLogs, setStrategyAuditLogs] = useState<any[]>([]);
  const [activeStrategySymbol, setActiveStrategySymbol] = useState<string>('EUR/USD');
  const [strategiesSaveStatus, setStrategiesSaveStatus] = useState<boolean>(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState<boolean>(false);
  const [isShockAbsorberActive, setIsShockAbsorberActive] = useState<boolean>(false);
  const [shockAbsorberLevel, setShockAbsorberLevel] = useState<number>(1.0);
  
  const fixTerminalEndRef = useRef<HTMLDivElement>(null);

  // 5. Lifecycle Data Polls
  const fetchCustomConnectors = async () => {
    try {
      const res = await fetch('/api/custom-connectors');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setCustomConnectors(data.connectors || []);
        }
      }
    } catch (e) {
      console.error("Failed to fetch custom connectors:", e);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/brokers/connections');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setConnections(data.connections || []);
        }
      }
    } catch (e) {
      console.error("Failed to fetch connections:", e);
    }
  };

  const fetchNewsPlatforms = async () => {
    try {
      const res = await fetch('/api/news/platforms');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setNewsPlatforms(data.platforms || []);
        }
      }
    } catch (e) {
      console.error("Failed to fetch news platforms:", e);
    }
  };

  const fetchNewsFeed = async () => {
    try {
      const res = await fetch('/api/news/feed');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setNewsEvents(data.events || []);
          setNewsStats({
            minutesUntilHighImpactNews: data.minutesUntilHighImpactNews,
            sentimentScore: data.sentimentScore,
            influenceMultiplier: data.influenceMultiplier
          });
          setHasCalendarFeed(data.hasCalendarFeed);
          setSentimentState(data.sentimentState || null);
          setNewsFeed(data.liveFeed || []);
        }
      }
    } catch (e) {
      console.warn("Transient fetch notice for news feed:", e);
    }
  };

  const fetchFixStatus = async () => {
    try {
      const res = await fetch('/api/fix/status');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setFixStatus(data);
        }
      }
    } catch (e) {
      console.warn("Transient fetch notice for FIX status:", e);
    }
  };

  const fetchSecurityInfo = async () => {
    try {
      const res = await fetch('/api/security/info');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setSecurityInfo(data);
          setFormAllowedIps(data.allowedIps ? data.allowedIps.join(', ') : '');
        }
      }
    } catch (e) {
      console.warn("Transient fetch notice for security info:", e);
    }
  };

  const selectedEnvRef = useRef(selectedEnvironment);
  useEffect(() => {
    selectedEnvRef.current = selectedEnvironment;
    fetchLivePositions();
  }, [selectedEnvironment]);

  const fetchLivePositions = async () => {
    try {
      const res = await fetch(`/api/positions?environment=${selectedEnvRef.current}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success) {
            setPositions(data.positions || []);
            setAccountStats(data.accountStats || null);
          }
        }
      }
      
      const telRes = await fetch('/api/telemetry');
      if (telRes.ok) {
        const telContentType = telRes.headers.get('content-type');
        if (telContentType && telContentType.includes('application/json')) {
          const telData = await telRes.json();
          if (telData.status === "ok") {
            setIsShockAbsorberActive(telData.isShockAbsorberActive);
            setShockAbsorberLevel(telData.shockAbsorberLevel);
          }
        }
      }
    } catch (e) {
      console.warn("Transient fetch notice for live positions:", e);
    }
  };

  const fetchStrategiesConfig = async () => {
    try {
      const res = await fetch('/api/strategies/config');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setStrategiesConfig(data.config || {});
        }
      }
    } catch (e) {
      console.warn("Transient fetch notice for strategies config:", e);
    }
  };

  const fetchStrategyAuditLogs = async () => {
    try {
      const res = await fetch('/api/strategies/audit-logs');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setStrategyAuditLogs(data.logs || []);
        }
      }
    } catch (e) {
      console.warn("Transient fetch notice for strategy audit logs:", e);
    }
  };

  useEffect(() => {
    fetchCustomConnectors();
    fetchConnections();
    fetchNewsPlatforms();
    fetchNewsFeed();
    fetchFixStatus();
    fetchSecurityInfo();
    fetchLivePositions();
    fetchStrategiesConfig();
    fetchStrategyAuditLogs();

    // Set polling timers
    const intervalCustom = setInterval(fetchCustomConnectors, 10000);
    const intervalConns = setInterval(fetchConnections, 12000);
    const intervalNewsPlatforms = setInterval(fetchNewsPlatforms, 15000);
    const intervalNews = setInterval(fetchNewsFeed, 10000);
    const intervalFix = setInterval(fetchFixStatus, 5000);
    const intervalSec = setInterval(fetchSecurityInfo, 15000);
    const intervalPositions = setInterval(fetchLivePositions, 1500);
    const intervalStrategies = setInterval(fetchStrategiesConfig, 4000);
    const intervalAuditLogs = setInterval(fetchStrategyAuditLogs, 2000);

    return () => {
      clearInterval(intervalCustom);
      clearInterval(intervalConns);
      clearInterval(intervalNewsPlatforms);
      clearInterval(intervalNews);
      clearInterval(intervalFix);
      clearInterval(intervalSec);
      clearInterval(intervalPositions);
      clearInterval(intervalStrategies);
      clearInterval(intervalAuditLogs);
    };
  }, []);

  // Sync positions to local storage
  useEffect(() => {
    localStorage.setItem('SOVEREIGN_LIVE_POSITIONS', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('SOVEREIGN_LIVE_ACCOUNT_STATS', JSON.stringify(accountStats));
  }, [accountStats]);

  // FIX Terminal autoscroll
  useEffect(() => {
    if (fixTerminalEndRef.current) {
      fixTerminalEndRef.current.scrollTop = fixTerminalEndRef.current.scrollHeight;
    }
  }, [fixStatus.logs]);

  // Autopilot Risk Tuning Loop
  useEffect(() => {
    if (!autoRiskTuning) return;

    const interval = setInterval(() => {
      setRiskRules(prev => {
        // News imminent -> force risk rules and leverage down!
        const newsFactor = newsStats.minutesUntilHighImpactNews < 30;
        const tunedDailyLoss = newsFactor ? 1.0 : parseFloat((2.5 + (Math.random() - 0.5) * 0.3).toFixed(2));
        const tunedRisk = newsFactor ? 0.12 : parseFloat((0.5 + (Math.random() - 0.5) * 0.08).toFixed(2));
        const tunedLeverage = newsFactor ? 5 : parseFloat((30 + (Math.random() > 0.5 ? 5 : -5)).toFixed(0));
        
        return {
          ...prev,
          maxDailyLossPercent: Math.max(0.5, Math.min(4.5, tunedDailyLoss)),
          riskPerTradePercent: Math.max(0.1, Math.min(1.5, tunedRisk)),
          maxLeverage: Math.max(5, Math.min(50, tunedLeverage)),
        };
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [autoRiskTuning, newsStats.minutesUntilHighImpactNews]);

  // 6. Action Handlers

  // Save risk configuration
  const handleSaveRiskRules = () => {
    localStorage.setItem('SOVEREIGN_RISK_RULES', JSON.stringify(riskRules));
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  // Connect & verify a broker connection (AES-256 in Postgres)
  const handleConnectBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConfigureBroker) return;

    setIsSubmitLoading(true);
    setFormError('');
    setFormSuccess('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      // If we have an existing mutate key, attach it
      if (securityInfo.maskedMutateKey && securityInfo.maskedMutateKey !== "••••") {
        // In real setups, clients attach the bearer token.
        // For local development sandbox, we bypass or fetch security credentials
      }

      const response = await fetch('/api/brokers/connect', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brokerType: activeConfigureBroker,
          apiUrl: formApiUrl,
          accountId: formAccountId,
          apiToken: formApiToken,
          secretKey: formSecretKey,
          passphrase: formPassphrase,
          targetCompId: formTargetCompId,
          senderCompId: formSenderCompId,
          environment: formEnvironment
        })
      });

      const result = await response.json();
      if (response.ok) {
        setFormSuccess(`✓ گرێدانی ${activeConfigureBroker.toUpperCase()} سەرکەوتوو بوو و لە داتابەیس بە شێوەی پاشەکەوتکراو تۆمار کرا.`);
        fetchConnections();
        // Clear fields
        setFormApiToken('');
        setFormSecretKey('');
        setFormPassphrase('');
        setTimeout(() => {
          setActiveConfigureBroker(null);
          setFormSuccess('');
        }, 1500);
      } else {
        setFormError(result.error || 'کێشەیەک ڕوویدا لە کاتی تاقیکردنەوەی پەیوەندی.');
      }
    } catch (err: any) {
      setFormError(`شکست لە بەستنەوەی بڕۆکەر: ${err.message || 'Server timeout'}`);
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Disconnect broker connection (Delete from Postgres)
  const handleDisconnectBroker = async (brokerType: string, accountId: string) => {
    if (!confirm(`دڵنیایت لە دابڕاندنی پەیوەندی بڕۆکەری ${brokerType.toUpperCase()} لە داتابەیس؟`)) return;

    try {
      const response = await fetch('/api/brokers/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brokerType, accountId })
      });
      if (response.ok) {
        fetchConnections();
        fetchFixStatus();
      }
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  const handleSaveNewsPlatformKey = async (platformId: string, apiKey: string) => {
    try {
      const body: Record<string, string> = {};
      if (platformId === "news_api") body.newsApiKey = apiKey;
      else if (platformId === "finnhub") body.finnhubKey = apiKey;
      else if (platformId === "trading_economics") body.tradingEconomicsKey = apiKey;
      else if (platformId === "alpha_vantage") body.alphaVantageKey = apiKey;
      else if (platformId === "market_aux") body.marketAuxKey = apiKey;
      else if (platformId === "fred") body.fredKey = apiKey;

      const response = await fetch('/api/news/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        setFormNewsPlatformKey('');
        setActiveNewsConfig(null);
        fetchNewsPlatforms();
        fetchNewsFeed();
      }
    } catch (err) {
      console.error("Failed to save news key:", err);
    }
  };

  const handleTestNewsPlatform = async (platformId: string, apiKey: string) => {
    setNewsPlatformTesting(true);
    setNewsPlatformTestError('');
    setNewsPlatformTestSuccess('');
    try {
      const response = await fetch('/api/news/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformId, apiKey })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setNewsPlatformTestSuccess('✓ بەستنەوەی تاقیکاری سەرکەوتوو بوو! (Test Connection Successful!)');
      } else {
        setNewsPlatformTestError(data.error || 'گرێدانەکە سەرنەکەوت. (Connection failed.)');
      }
    } catch (err) {
      setNewsPlatformTestError('گرێدانەکە سەرنەکەوت بەهۆی کێشەی هێڵەوە.');
    } finally {
      setNewsPlatformTesting(false);
    }
  };

  const handleDisconnectNewsPlatform = async (platformId: string) => {
    if (!confirm(`دڵنیایت لە سڕینەوەی کلیل و گرێدانی ${platformId.toUpperCase()}؟`)) return;
    try {
      const response = await fetch('/api/news/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformId })
      });
      if (response.ok) {
        fetchNewsPlatforms();
        fetchNewsFeed();
      }
    } catch (err) {
      console.error("Failed to disconnect news platform:", err);
    }
  };

  // Update IP Whitelist
  const handleSaveAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ips = formAllowedIps.split(',').map(ip => ip.trim()).filter(Boolean);
      const response = await fetch('/api/security/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips })
      });
      if (response.ok) {
        setAllowlistSaved(true);
        fetchSecurityInfo();
        setTimeout(() => setAllowlistSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save whitelist:", err);
    }
  };

  // Rotate internal Mutate Key (HSM trigger)
  const handleRotateMutateKey = async () => {
    if (!confirm("ئایا دڵنیایت لە خولاندنەوە و گۆڕینی کلیلی نووسینی داواکاری ناوەکی؟ پۆرتفۆلیۆ لەگەڵ گۆڕانکارییەکە نوێ دەبێتەوە.")) return;
    try {
      const response = await fetch('/api/security/rotate', { method: 'POST' });
      if (response.ok) {
        fetchSecurityInfo();
        alert("سەرکەوتوو بوو! کلیلەکە بە سەرکەوتوویی خولێندرایەوە و هاوکات کرا لەگەڵ سێرڤەر.");
      }
    } catch (err) {
      console.error("Failed to rotate key:", err);
    }
  };

  // Route Order over active integration (simulating direct executions)
  const handleCreateOrder = async () => {
    try {
      const sizeMultiplier = newsStats.influenceMultiplier || 1.0;
      const response = await fetch('/api/positions/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newOrderSymbol,
          type: newOrderType,
          size: parseFloat((newOrderSize * sizeMultiplier).toFixed(2)),
          environment: selectedEnvironment
        })
      });
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (response.ok && data.success) {
          fetchLivePositions();
          fetchStrategyAuditLogs();
        } else {
          alert("فەرمانەکە ڕەتکرایەوە لەلایەن هێڵی مەترسی: " + (data.error || "مەترسی زۆر بەرزە یان سیستەمەکە قوفڵە."));
        }
      } else {
        if (response.ok) {
          fetchLivePositions();
          fetchStrategyAuditLogs();
        } else {
          alert("سیستەمەکە وەڵامی ناکارای دایەوە لە کاتی دروستکردنی فەرمان.");
        }
      }
    } catch (err: any) {
      console.error("Failed to create order:", err);
      alert("هەڵە لە دروستکردنی فەرمان: " + (err?.message || "پەیوەندی پچڕا."));
    }
  };

  const handleClosePosition = async (id: string) => {
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, environment: selectedEnvironment })
      });
      if (response.ok) {
        fetchLivePositions();
      }
    } catch (err) {
      console.error("Failed to close position:", err);
    }
  };

  // Custom connector action handlers
  const handleSaveCustomConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestCustomError('');
    setTestCustomSuccess('');
    
    if (!customName || !customBaseUrl || !customAuthScheme) {
      setTestCustomError('تکایە هەموو زانیارییە ناچارییەکان پڕبکەرەوە.');
      return;
    }

    // Assemble auth_config
    const auth_config: any = {};
    if (customAuthScheme === 'api_key_header') {
      auth_config.headerName = customHeaderName;
      auth_config.apiKey = customApiKey;
    } else if (customAuthScheme === 'api_key_query_param') {
      auth_config.paramName = customParamName;
      auth_config.apiKey = customApiKey;
    } else if (customAuthScheme === 'bearer_token') {
      auth_config.apiKey = customApiKey;
    } else if (customAuthScheme === 'basic_auth') {
      auth_config.username = customUsername;
      auth_config.password = customPassword;
    } else if (customAuthScheme === 'hmac_signed') {
      auth_config.apiKey = customApiKey;
      auth_config.secretKey = customSecretKey;
      auth_config.algorithm = customHmacAlgo;
      auth_config.encoding = customHmacEncoding;
      auth_config.placement = customHmacPlacement;
      auth_config.signatureName = customHmacSigName;
      auth_config.timestampName = customHmacTimeName;
    }

    // Assemble endpoints
    const endpoints: any = {};
    if (customType === 'news') {
      endpoints.get_news = {
        method: 'GET',
        path: '/v2/news?symbol={symbol}',
        rootPath: newsRootPath,
        mapping: {
          title: newsTitlePath,
          url: newsUrlPath,
          time: newsTimePath,
          sentiment: newsSentimentPath
        }
      };
    } else {
      endpoints.test_connection = {
        method: 'GET',
        path: brokerTestPath,
        mapping: {
          success: brokerTestMapping
        }
      };
    }

    try {
      const payload = {
        id: editingConnector?.id || undefined,
        name: customName,
        type: customType,
        base_url: customBaseUrl,
        auth_scheme: customAuthScheme,
        auth_config,
        endpoints,
        status: editingConnector?.status || 'CONNECTED'
      };

      const res = await fetch('/api/custom-connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestCustomSuccess('بە سەرکەوتوویی پاشەکەوت کرا.');
        setShowAddCustom(false);
        setEditingConnector(null);
        resetCustomForm();
        fetchCustomConnectors();
      } else {
        setTestCustomError(data.error || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن.');
      }
    } catch (err: any) {
      setTestCustomError(err.message);
    }
  };

  const handleTestCustomConnector = async (endpointName: string) => {
    setIsTestingCustom(true);
    setTestCustomError('');
    setTestCustomSuccess('');
    setTestResponseOutput('');

    // Check for WS, FIX or other unsupported APIs
    const baseUrlSafe = customBaseUrl || '';
    if (baseUrlSafe.startsWith('ws://') || baseUrlSafe.startsWith('wss://') || baseUrlSafe.includes('fix://')) {
      setTestCustomError('ئەم شێوازە پشتگیری ناکرێت: پڕۆتۆکۆلەکانی FIX یان WebSockets پێویستیان بە کۆدی تایبەت هەیە.');
      setIsTestingCustom(false);
      return;
    }

    const auth_config: any = {};
    if (customAuthScheme === 'api_key_header') {
      auth_config.headerName = customHeaderName;
      auth_config.apiKey = customApiKey;
    } else if (customAuthScheme === 'api_key_query_param') {
      auth_config.paramName = customParamName;
      auth_config.apiKey = customApiKey;
    } else if (customAuthScheme === 'bearer_token') {
      auth_config.apiKey = customApiKey;
    } else if (customAuthScheme === 'basic_auth') {
      auth_config.username = customUsername;
      auth_config.password = customPassword;
    } else if (customAuthScheme === 'hmac_signed') {
      auth_config.apiKey = customApiKey;
      auth_config.secretKey = customSecretKey;
      auth_config.algorithm = customHmacAlgo;
      auth_config.encoding = customHmacEncoding;
      auth_config.placement = customHmacPlacement;
      auth_config.signatureName = customHmacSigName;
      auth_config.timestampName = customHmacTimeName;
    }

    const endpoints: any = {};
    if (customType === 'news') {
      endpoints.get_news = {
        method: 'GET',
        path: '/v2/news?symbol={symbol}',
        rootPath: newsRootPath,
        mapping: {
          title: newsTitlePath,
          url: newsUrlPath,
          time: newsTimePath,
          sentiment: newsSentimentPath
        }
      };
    } else {
      endpoints.test_connection = {
        method: 'GET',
        path: brokerTestPath,
        mapping: {
          success: brokerTestMapping
        }
      };
    }

    try {
      const res = await fetch('/api/custom-connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: customBaseUrl,
          auth_scheme: customAuthScheme,
          auth_config,
          endpoints,
          endpointName,
          variables: { symbol: 'EUR/USD', accountId: 'test-account-123' }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestCustomSuccess('گرێدانەکە سەرکەوتوو بوو! وەڵامی وەرگیراو لێرەیە.');
        setTestResponseOutput(JSON.stringify(data.result, null, 2));
      } else {
        setTestCustomError(data.error || data.explanation || 'کێشە لە تاقیکردنەوەی گرێدان.');
        if (data.result) {
          setTestResponseOutput(JSON.stringify(data.result, null, 2));
        }
      }
    } catch (err: any) {
      setTestCustomError(err.message);
    } finally {
      setIsTestingCustom(false);
    }
  };

  const handleDeleteCustomConnector = async (id: string) => {
    if (!confirm('ئایا دڵنیای لە سڕینەوەی ئەم کۆنێکتەرە؟')) return;
    try {
      const res = await fetch(`/api/custom-connectors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCustomConnectors();
      }
    } catch (e) {
      console.error('Failed to delete custom connector:', e);
    }
  };

  const handleLoadConnectorToEdit = (c: any) => {
    setEditingConnector(c);
    setCustomName(c.name);
    setCustomType(c.type);
    setCustomBaseUrl(c.base_url);
    setCustomAuthScheme(c.auth_scheme);
    
    const auth = c.auth_config || {};
    setCustomApiKey(auth.apiKey || '');
    setCustomSecretKey(auth.secretKey || '');
    setCustomUsername(auth.username || '');
    setCustomPassword(auth.password || '');
    setCustomHeaderName(auth.headerName || 'X-API-KEY');
    setCustomParamName(auth.paramName || 'api_key');
    
    setCustomHmacAlgo(auth.algorithm || 'sha256');
    setCustomHmacEncoding(auth.encoding || 'hex');
    setCustomHmacPlacement(auth.placement || 'header');
    setCustomHmacSigName(auth.signatureName || 'X-Signature');
    setCustomHmacTimeName(auth.timestampName || 'X-Timestamp');

    const eps = c.endpoints || {};
    if (c.type === 'news') {
      const ep = eps.get_news || {};
      setNewsRootPath(ep.rootPath || '');
      const map = ep.mapping || {};
      setNewsTitlePath(map.title || 'title');
      setNewsUrlPath(map.url || 'url');
      setNewsTimePath(map.time || 'publishedAt');
      setNewsSentimentPath(map.sentiment || '');
    } else {
      const ep = eps.test_connection || {};
      setBrokerTestPath(ep.path || '/accounts');
      const map = ep.mapping || {};
      setBrokerTestMapping(map.success || 'accounts');
    }

    setTestResponseOutput('');
    setTestCustomError('');
    setTestCustomSuccess('');
    setShowAddCustom(true);
  };

  const resetCustomForm = () => {
    setCustomName('');
    setCustomType('news');
    setCustomBaseUrl('');
    setCustomAuthScheme('api_key_header');
    setCustomApiKey('');
    setCustomSecretKey('');
    setCustomUsername('');
    setCustomPassword('');
    setCustomHeaderName('X-API-KEY');
    setCustomParamName('api_key');
    setCustomHmacAlgo('sha256');
    setCustomHmacEncoding('hex');
    setCustomHmacPlacement('header');
    setCustomHmacSigName('X-Signature');
    setCustomHmacTimeName('X-Timestamp');
    setNewsRootPath('articles');
    setNewsTitlePath('title');
    setNewsUrlPath('url');
    setNewsTimePath('publishedAt');
    setNewsSentimentPath('');
    setBrokerTestPath('/accounts');
    setBrokerTestMapping('accounts');
    setTestResponseOutput('');
    setTestCustomError('');
    setTestCustomSuccess('');
  };

  // Helper broker labels
  const brokerLabels: Record<string, string> = {
    oanda: "OANDA v20 REST",
    binance: "Binance Exchange",
    coinbase: "Coinbase Advanced",
    kraken: "Kraken Exchange API",
    metatrader5: "MetaTrader 5 Bridge",
    ib: "Interactive Brokers",
    fix_gateway: "Institutional FIX 4.4"
  };

  const openConfigureCard = (type: BrokerConnection['brokerType']) => {
    setActiveConfigureBroker(type);
    setFormApiUrl(type === 'oanda' ? 'https://api-fxtrade.oanda.com/v3' : 
                  type === 'binance' ? 'https://api.binance.com' :
                  type === 'coinbase' ? 'https://api.coinbase.com' :
                  type === 'kraken' ? 'https://api.kraken.com' :
                  type === 'metatrader5' ? 'http://127.0.0.1:5000' :
                  type === 'ib' ? 'https://localhost:29191' : 'https://fix.broker.com');
    setFormAccountId('');
    setFormApiToken('');
    setFormSecretKey('');
    setFormPassphrase('');
    setFormError('');
    setFormSuccess('');
  };

  return (
    <div id="risk-broker-integration-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
      
      {/* 1. TOP PORTFOLIO & BROKER MULTI-CONNECTOR STACK */}
      <div id="multi-broker-hub" className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-900 pb-3" dir="rtl">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-sky-950/40 border border-sky-500/30 rounded text-sky-400">
              <Database className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">سەنتەری گرێدانی فرە-برۆکەر (Active Brokers Hub)</h3>
              <span className="text-[10px] text-slate-500 font-mono block">SECURE DATABASE CONNECTIVITY VIA AES-256</span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[9px] bg-slate-900 text-slate-400 border border-slate-800 rounded font-mono font-bold">
            {connections.length} ACTIVE INTEGRATIONS
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed text-right" dir="rtl">
          سیستەمەکە پشتگیری لایڤ بەستنەوە بەم پێشاندەرانە دەکات. بڕوانامەکان بە شێوەیەکی خۆکار بە کۆدی <span className="text-sky-400 font-mono">AES-256-CBC</span> لە داتابەیسی ناوەکی پاشەکەوت دەکرێن و بە بێ نووسینی کۆدی زیادە فەرمانەکان ئاراستە دەکرێن.
        </p>

        {/* Dynamic Connected Integrations Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {Object.entries(brokerLabels).map(([key, label]) => {
            const activeConn = connections.find(c => c.brokerType === key);
            return (
              <div 
                key={key} 
                className={`p-4 border rounded-xl flex flex-col justify-between transition-all ${
                  activeConn 
                    ? 'bg-slate-900/60 border-emerald-500/30 shadow-md shadow-emerald-950/10' 
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  {activeConn ? (
                    <span className="px-2 py-0.5 text-[9px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                      ✓ CONNECTED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] bg-slate-900 text-slate-500 border border-slate-800/60 rounded-full font-mono">
                      OFFLINE
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-slate-100 font-sans">{label}</span>
                </div>

                <div className="my-3 space-y-1 text-right" dir="rtl">
                  {activeConn ? (
                    <>
                      <div className="text-[10px] text-slate-400">
                        حساب: <span className="font-mono text-slate-200 font-bold bg-slate-950 px-1.5 py-0.5 rounded">{activeConn.accountId}</span>
                      </div>
                      {activeConn.environment && (
                        <div className="text-[10px] text-slate-400">
                          ژینگە: <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[9px] ${activeConn.environment === 'REAL_LIVE' ? 'bg-rose-950 text-rose-400 border border-rose-900/30' : 'bg-emerald-950 text-emerald-400 border border-emerald-900/30'}`}>{activeConn.environment}</span>
                        </div>
                      )}
                      <div className="text-[9px] text-slate-500 font-mono">
                        کلیل: {activeConn.maskedToken || "••••••••"}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        مێژووی گرێدان: {new Date(activeConn.lastTestedTime).toLocaleTimeString()}
                      </div>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic block">هیچ گرێدانێکی گەرم نەکراوە لە ئێستادا.</span>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  {activeConn ? (
                    <button
                      onClick={() => handleDisconnectBroker(activeConn.brokerType, activeConn.accountId)}
                      className="w-full py-1.5 bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800/30 text-rose-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      پچڕاندنی بەستەر
                    </button>
                  ) : (
                    <button
                      onClick={() => openConfigureCard(key as BrokerConnection['brokerType'])}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-sky-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>بەستنەوە و گرێدان</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Active Configuration Form */}
        {activeConfigureBroker && (
          <div className="p-5 bg-slate-900/40 border border-sky-500/30 rounded-xl space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <button 
                onClick={() => setActiveConfigureBroker(null)} 
                className="p-1 hover:bg-slate-800 rounded text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="text-xs font-bold text-slate-200">ڕێکخستنی برۆکەری: {activeConfigureBroker.toUpperCase()}</h4>
            </div>

            <form onSubmit={handleConnectBroker} className="space-y-3.5 text-right" dir="rtl">
              
              {/* Target Environment */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-bold">ژینگەی بەستنەوە (Target Environment)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormEnvironment('DEMO_LIVE')}
                    className={`flex-1 py-1 px-3 border rounded text-xs font-mono font-bold text-center transition-all cursor-pointer ${
                      formEnvironment === 'DEMO_LIVE'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-900 hover:text-slate-200'
                    }`}
                  >
                    DEMO_LIVE (Paper Trading)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormEnvironment('REAL_LIVE')}
                    className={`flex-1 py-1 px-3 border rounded text-xs font-mono font-bold text-center transition-all cursor-pointer ${
                      formEnvironment === 'REAL_LIVE'
                        ? 'bg-rose-950/80 text-rose-400 border-rose-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-900 hover:text-slate-200'
                    }`}
                  >
                    REAL_LIVE (Actual Capital)
                  </button>
                </div>
              </div>

              {/* Endpoint URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block">ناونیشانی Endpoint URL</label>
                  <input 
                    type="text" 
                    required
                    value={formApiUrl}
                    onChange={(e) => setFormApiUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block">ناسنامەی هەژمار (Account ID)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="نموونە: 101-002-12345"
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none" 
                  />
                </div>
              </div>

              {/* API Token / Client Secret */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block">کلیلی سەرەکی (API Token / Public Key)</label>
                  <input 
                    type="password" 
                    required
                    placeholder="کلیل بنووسە یان 'demo' لێبدە بۆ تاقیکردنەوە"
                    value={formApiToken}
                    onChange={(e) => setFormApiToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block">کلیلی نهێنی (Secret Key / Passphrase)</label>
                  <input 
                    type="password" 
                    placeholder="کلیلە نهێنیەکەت لێرە پاشەکەوت بکە"
                    value={formSecretKey}
                    onChange={(e) => setFormSecretKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none" 
                  />
                </div>
              </div>

              {/* FIX Protocol Session specific */}
              {activeConfigureBroker === 'fix_gateway' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-mono block">TARGET COMP ID</label>
                    <input 
                      type="text" 
                      value={formTargetCompId}
                      onChange={(e) => setFormTargetCompId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-mono block">SENDER COMP ID</label>
                    <input 
                      type="text" 
                      value={formSenderCompId}
                      onChange={(e) => setFormSenderCompId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono" 
                    />
                  </div>
                </div>
              )}

              {/* Status and Actions */}
              {formError && (
                <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-lg text-xs flex items-center gap-1.5 text-rose-400 justify-start" dir="ltr">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs flex items-center gap-1.5 text-emerald-400 justify-start" dir="ltr">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="flex gap-2 justify-start pt-1">
                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>تاقیکردنەوە و پاشەکەوتکردن لە داتابەیس</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConfigureBroker(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded border border-slate-700 transition-all cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* CUSTOM REST CONNECTOR HUB */}
      <div id="custom-connector-hub" className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-900 pb-3" dir="rtl">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">سەنتەری کەنەکتەرە گشتییەکان (Generic REST Connector Hub)</h3>
              <span className="text-[10px] text-slate-500 font-mono block">DYNAMIC REST WEB TEMPLATES FOR PLUG & PLAY</span>
            </div>
          </div>
          <button
            onClick={() => {
              resetCustomForm();
              setEditingConnector(null);
              setShowAddCustom(!showAddCustom);
            }}
            className="px-3 py-1 bg-emerald-650 hover:bg-emerald-555 text-slate-950 font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>کەنەکتەری نوێ</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed text-right" dir="rtl">
          لێرەوە دەتوانیت برۆکەر یان سەرچاوەی هەواڵی دەرەکی نوێ زیاد بکەیت تەنها بە دیاریکردنی بنچینەی REST API و شێوازی پاراستن و نەخشەسازی JSON بە بێ گۆڕانکاری لە کۆدی سەرەکی سەکۆکە.
        </p>

        {/* List of Custom Connectors */}
        <div className="space-y-2" dir="rtl">
          {customConnectors.length === 0 ? (
            <div className="text-slate-600 italic text-center py-6 text-xs bg-slate-900/30 border border-slate-900 rounded-lg">
              هیچ کەنەکتەرێکی تایبەت دروست نەکراوە. کلیک لە دوگمەی 'کەنەکتەری نوێ' بکە بۆ دەستپێکردن.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {customConnectors.map((c) => (
                <div key={c.id} className="p-3.5 bg-slate-900/50 border border-slate-800/80 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{c.name}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-bold rounded ${c.type === 'news' ? 'bg-amber-950 text-amber-400 border border-amber-900/30' : 'bg-sky-950 text-sky-400 border border-sky-900/30'}`}>
                        {c.type === 'news' ? 'NEWS PLATFORM' : 'BROKER API'}
                      </span>
                      <span className="px-2 py-0.5 text-[8px] bg-slate-950 text-slate-400 font-mono border border-slate-800 rounded">
                        {c.auth_scheme.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono leading-none">{c.base_url}</div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleLoadConnectorToEdit(c)}
                      className="py-1 px-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-sky-400 rounded text-[10px] font-bold cursor-pointer transition-all"
                    >
                      دەستکاری (Edit)
                    </button>
                    <button
                      onClick={() => handleDeleteCustomConnector(c.id)}
                      className="py-1 px-2.5 bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800/30 text-rose-400 rounded text-[10px] font-bold cursor-pointer transition-all"
                    >
                      سڕینەوە (Delete)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Form / Slider Drawer for Adding/Editing Custom Connector */}
        {showAddCustom && (
          <div className="p-5 bg-slate-900/60 border border-emerald-500/30 rounded-xl space-y-4 animate-in fade-in duration-300 text-right" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <button
                onClick={() => {
                  setShowAddCustom(false);
                  setEditingConnector(null);
                  resetCustomForm();
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="text-xs font-bold text-slate-200">
                {editingConnector ? `دەستکاریکردنی کەنەکتەری: ${editingConnector.name}` : 'تۆمارکردنی کەنەکتەری نوێ (New REST Template)'}
              </h4>
            </div>

            {/* Capability limitation warning */}
            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-[11px] leading-relaxed text-amber-400 text-right space-y-1">
              <div className="font-bold flex items-center gap-1.5 justify-end">
                <span>ئاگاداری گرنگ لەسەر سنوورەکانی کارکردن</span>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <p>
                ئەم پەنەلە بە شێوەیەکی تایبەت بۆ کۆنێکتەرەکانی جۆری **REST API** دروستکراوە. پڕۆتۆکۆلەکانی تر وەک **FIX Engine** یان **WebSockets** بەهۆی پێویستیان بە پێوەندی بەردەوام و خێرا، لە ڕێگەی ئەم فۆرمەوە دروست ناکرێن و پێویستیان بە پەرەپێدانی کۆدی ناوخۆیی هەیە.
              </p>
            </div>

            <form onSubmit={handleSaveCustomConnector} className="space-y-4">
              
              {/* Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block font-bold">ناوی کەنەکتەر (Connector Name)</label>
                  <input
                    type="text"
                    required
                    placeholder="نموونە: MarketNews, FXCustomBroker"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block font-bold">جۆری کەنەکتەر (Connector Type)</label>
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value as 'broker' | 'news')}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="news">سەرچاوەی هەواڵ (News Sourcing)</option>
                    <option value="broker">برۆکەری بازرگانی (REST Broker API)</option>
                  </select>
                </div>
              </div>

              {/* Base URL & Auth Scheme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block font-bold">ناونیشانی بنەڕەت (Base URL)</label>
                  <input
                    type="text"
                    required
                    placeholder="https://api.externalplatform.com/v1"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block font-bold">شێوازی پاراستن و Auth Scheme</label>
                  <select
                    value={customAuthScheme}
                    onChange={(e) => setCustomAuthScheme(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="api_key_header">API Key لە Header</option>
                    <option value="api_key_query_param">API Key لە Query Parameter</option>
                    <option value="bearer_token">Bearer Token (Authorization Header)</option>
                    <option value="basic_auth">Basic Authentication (User/Password)</option>
                    <option value="hmac_signed">HMAC Cryptographic Signature</option>
                  </select>
                </div>
              </div>

              {/* Conditional Auth Config Fields */}
              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg space-y-3">
                <h5 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ڕێکخستنی بڕوانامەکانی چوونەژوورەوە</h5>

                {/* API Key Header */}
                {customAuthScheme === 'api_key_header' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">ناوی Header</label>
                      <input
                        type="text"
                        value={customHeaderName}
                        onChange={(e) => setCustomHeaderName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">کلیلی API Key</label>
                      <input
                        type="password"
                        placeholder="ئەم کلیلە بە AES-255 دادەپۆشرێت"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* API Key Query Param */}
                {customAuthScheme === 'api_key_query_param' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">ناوی پارامیتەر (Query Parameter Name)</label>
                      <input
                        type="text"
                        value={customParamName}
                        onChange={(e) => setCustomParamName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">کلیلی API Key</label>
                      <input
                        type="password"
                        placeholder="ئەم کلیلە بە AES-255 دادەپۆشرێت"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Bearer Token */}
                {customAuthScheme === 'bearer_token' && (
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 block">تۆکنی Bearer</label>
                    <input
                      type="password"
                      placeholder="تۆکن لێرە بنووسە"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Basic Auth */}
                {customAuthScheme === 'basic_auth' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">ناوی بەکارهێنەر (Username)</label>
                      <input
                        type="text"
                        value={customUsername}
                        onChange={(e) => setCustomUsername(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">وشەی تێپەڕ (Password)</label>
                      <input
                        type="password"
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* HMAC Signed */}
                {customAuthScheme === 'hmac_signed' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-450 block">کلیل (API Key)</label>
                        <input
                          type="password"
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-450 block">کلیلی نهێنی (HMAC Secret Key)</label>
                        <input
                          type="password"
                          value={customSecretKey}
                          onChange={(e) => setCustomSecretKey(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-right">
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-450 block">ئەلگۆریتم</label>
                        <select
                          value={customHmacAlgo}
                          onChange={(e) => setCustomHmacAlgo(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none"
                        >
                          <option value="sha256">SHA-256</option>
                          <option value="sha512">SHA-512</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-450 block">جۆری ناوەڕۆک (Encoding)</label>
                        <select
                          value={customHmacEncoding}
                          onChange={(e) => setCustomHmacEncoding(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none"
                        >
                          <option value="hex">Hexadecimal</option>
                          <option value="base64">Base64</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-450 block">جێگیرکردن (Placement)</label>
                        <select
                          value={customHmacPlacement}
                          onChange={(e) => setCustomHmacPlacement(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none"
                        >
                          <option value="header">Request Headers</option>
                          <option value="query">Query Params</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-450 block">ناوی واژوو (Signature Name)</label>
                        <input
                          type="text"
                          value={customHmacSigName}
                          onChange={(e) => setCustomHmacSigName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-450 block">ناوی مۆری کاتی (Timestamp Name)</label>
                        <input
                          type="text"
                          value={customHmacTimeName}
                          onChange={(e) => setCustomHmacTimeName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Endpoints & Mapping Configurations */}
              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg space-y-3">
                <h5 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {customType === 'news' ? 'نەخشەسازی هەواڵ (News Response Path Mapping)' : 'بەستەر و ڕێڕەوی تاقیکردنەوە (Broker Test Endpoint Path)'}
                </h5>

                {customType === 'news' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-450 block">ڕێڕەوی تەنەکانی لیستی هەواڵ (News List JSON Root Path)</label>
                        <input
                          type="text"
                          value={newsRootPath}
                          onChange={(e) => setNewsRootPath(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-450 block">ڕێڕەوی ناونیشان (Title Key Path)</label>
                        <input
                          type="text"
                          value={newsTitlePath}
                          onChange={(e) => setNewsTitlePath(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-450 block">ڕێڕەوی بەستەر (URL Path)</label>
                        <input
                          type="text"
                          value={newsUrlPath}
                          onChange={(e) => setNewsUrlPath(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-450 block">ڕێڕەوی کات (Published Time Path)</label>
                        <input
                          type="text"
                          value={newsTimePath}
                          onChange={(e) => setNewsTimePath(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-450 block">ڕێڕەوی هەستسەنگاندن (Sentiment Path - ئارەزوومەندانە)</label>
                        <input
                          type="text"
                          placeholder="بەجێی بهێڵە بۆ خەمڵاندنی خۆکار"
                          value={newsSentimentPath}
                          onChange={(e) => setNewsSentimentPath(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">ڕێڕەوی تاقیکردنەوە (Test Connection Path)</label>
                      <input
                        type="text"
                        value={brokerTestPath}
                        onChange={(e) => setBrokerTestPath(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none text-left"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-450 block">کلیل یان جۆری چەسپاندن لە وەڵامدا (Response Success Mapping Key)</label>
                      <input
                        type="text"
                        value={brokerTestMapping}
                        onChange={(e) => setBrokerTestMapping(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status and Action Panel */}
              {testCustomError && (
                <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-lg text-xs flex items-center gap-1.5 text-rose-400 justify-start" dir="ltr">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{testCustomError}</span>
                </div>
              )}

              {testCustomSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs flex items-center gap-1.5 text-emerald-400 justify-start" dir="ltr">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{testCustomSuccess}</span>
                </div>
              )}

              {/* Sandbox Test JSON Response Output Terminal */}
              {testResponseOutput && (
                <div className="space-y-1 text-right">
                  <label className="text-[9px] text-slate-400 font-mono">SANDBOX JSON RESPONDER INTERCEPTOR</label>
                  <pre className="w-full bg-slate-950 border border-slate-900 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-[10px] text-emerald-500 text-left" dir="ltr">
                    {testResponseOutput}
                  </pre>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex gap-2 justify-start pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-650 hover:bg-emerald-555 text-slate-950 font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>ڕزگارکردن و پاشەکەوت (Save Template)</span>
                </button>
                <button
                  type="button"
                  disabled={isTestingCustom}
                  onClick={() => handleTestCustomConnector(customType === 'news' ? 'get_news' : 'test_connection')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-sky-400 border border-slate-700 font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isTestingCustom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                  <span>تاقیکردنەوەی مەیدانی (Sandbox Test Run)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustom(false);
                    setEditingConnector(null);
                    resetCustomForm();
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-850 font-bold text-xs rounded transition-all cursor-pointer"
                >
                  پاشگەزبوونەوە (Cancel)
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* 2. RIGHT RISK CONTROL & AUTOPILOT ADJUSTER */}
      <div id="capital-risk-rules" className="lg:col-span-4 flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-xl p-5 text-right" dir="rtl">
        <div>
          <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded text-rose-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">پارامیتەرەکانی ڕیسک و سەرمایە</h3>
                <span className="text-[10px] text-slate-500 font-mono block">DYNAMIC PROTECTION & NEWS COUPLING</span>
              </div>
            </div>

            {/* Autopilot Risk Tuning Badge Button */}
            <button
              onClick={() => setAutoRiskTuning(!autoRiskTuning)}
              className={`px-2 py-0.5 text-[9px] font-sans font-bold border rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                autoRiskTuning
                  ? 'bg-rose-950/50 text-rose-300 border-rose-500/30'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full bg-rose-400 ${autoRiskTuning ? 'animate-ping' : ''}`} />
              <span>{autoRiskTuning ? 'ئۆتۆ-ڕیسک: چالاکە' : 'ئۆتۆ-ڕیسک: ناچالاکە'}</span>
            </button>
          </div>

          <div className="space-y-4">
            
            {/* Daily Loss Limit Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] text-slate-400">زۆرترین ڕێژەی دۆڕانی ڕۆژانە (Daily Loss Limit)</label>
                <span className="text-xs font-mono font-bold text-rose-400">{riskRules.maxDailyLossPercent}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                disabled={autoRiskTuning}
                value={riskRules.maxDailyLossPercent}
                onChange={(e) => setRiskRules({ ...riskRules, maxDailyLossPercent: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 disabled:opacity-40"
              />
            </div>

            {/* Risk Per Trade Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] text-slate-400">ڕیسک بۆ هەر گرێبەستێک (Risk Per Trade)</label>
                <span className="text-xs font-mono font-bold text-rose-400">{riskRules.riskPerTradePercent}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                disabled={autoRiskTuning}
                value={riskRules.riskPerTradePercent}
                onChange={(e) => setRiskRules({ ...riskRules, riskPerTradePercent: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 disabled:opacity-40"
              />
            </div>

            {/* Max Open Positions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 block mb-1">زۆرترین گرێبەستی کراوە</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={riskRules.maxOpenPositions}
                  onChange={(e) => setRiskRules({ ...riskRules, maxOpenPositions: parseInt(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Leverage Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] text-slate-400">ڕافیعەی دارایی (Leverage)</label>
                  <span className="text-xs font-mono font-bold text-rose-400">1:{riskRules.maxLeverage}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  disabled={autoRiskTuning}
                  value={riskRules.maxLeverage}
                  onChange={(e) => setRiskRules({ ...riskRules, maxLeverage: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 disabled:opacity-40"
                />
              </div>
            </div>

            <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-lg text-[10px] leading-relaxed text-rose-300">
              {newsStats.minutesUntilHighImpactNews < 30 ? (
                <span className="text-rose-400 font-bold animate-pulse">⚠️ وریاکردنەوە: بەهۆی نزیکبوونەوەی هەواڵی کاریگەر (NFP y یان CPI)، ڕیسک و ڕافیعەی دارایی بە شێوەیەکی داینامیکی بۆ لۆتی ٢٥٪ کەمکراوەتەوە!</span>
              ) : autoRiskTuning ? (
                <span>ℹ️ پارێزەری ئۆتۆ-ڕیسک چالاکە. لۆت و مارجین بەپێی شلۆقی بازاڕ و خشتەی هەواڵەکان لە سێرڤەرەوە کۆنترۆڵ دەکرێن.</span>
              ) : (
                <span>⚠️ ڕێکخستنی دەستی ڕیسک چالاکە. لۆت بە جێگیری دەمێنێتەوە.</span>
              )}
            </div>

          </div>
        </div>

        <div className="pt-4 border-t border-slate-900 mt-4">
          <button
            onClick={handleSaveRiskRules}
            className="w-full py-2 bg-rose-950/40 border border-rose-800/40 text-rose-400 hover:bg-rose-950/60 rounded font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{saveStatus ? '✓ پاشەکەوت کرا' : 'چەسپاندن و پاشەکەوتکردنی یاساکانی ڕیسک'}</span>
          </button>
        </div>
      </div>

      {/* 3. NEWS & ECONOMIC CALENDAR PANEL (STAGE 2) */}
      <div id="news-economic-panel" className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-900 pb-3" dir="rtl">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-400">
              <Newspaper className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">پلاتفۆرمەکانی هەواڵ و داتا (News & Data Intelligence)</h3>
              <span className="text-[10px] text-slate-500 font-mono block">UNIFIED SENTIMENT & ECONOMIC FEED</span>
            </div>
          </div>
          <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full ${
            newsStats.sentimentScore >= 0.1 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' :
            newsStats.sentimentScore <= -0.1 ? 'bg-rose-950 text-rose-400 border border-rose-800/30' :
            'bg-slate-900 text-slate-400 border border-slate-800'
          }`}>
            AGGREGATED SENTIMENT: {newsStats.sentimentScore >= 0 ? '+' : ''}{newsStats.sentimentScore.toFixed(2)}
          </span>
        </div>

        {/* Sentiment Gauge & Impact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" dir="rtl">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-right">
            <span className="text-[10px] text-slate-400 block mb-1">کاریگەری سەر لۆتی بازرگانی (Sizing Influence)</span>
            <span className={`text-[13px] font-bold font-mono ${newsStats.influenceMultiplier < 1.0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
              {newsStats.influenceMultiplier === 1.0 ? 'NOMINAL SIZE (100% Sizing)' : `RISK LOCKED (${(newsStats.influenceMultiplier * 100).toFixed(0)}% Lot Sizing)`}
            </span>
          </div>
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-right">
            <span className="text-[10px] text-slate-400 block mb-1">ماوەی ماوە بۆ هەواڵی داهاتوو</span>
            <span className="text-[13px] font-bold font-mono text-slate-100">
              {newsStats.minutesUntilHighImpactNews === 999 ? "STANDBY" : `${newsStats.minutesUntilHighImpactNews} Mins`}
            </span>
          </div>
        </div>

        {/* Sentiment breakdown per-source */}
        {sentimentState && sentimentState.breakdown && sentimentState.breakdown.length > 0 && (
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg space-y-2 text-right" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
              <span className="text-[9px] text-slate-500 font-mono">BREAKDOWN BY SOURCE</span>
              <span className="text-[10px] text-slate-300 font-bold">شیکاری سێنتیمێنت بەپێی سەرچاوەکان</span>
            </div>
            
            {/* Source disagreement warning */}
            {sentimentState.disagreement && (
              <div className="py-1 px-2.5 bg-rose-950/40 border border-rose-800/40 text-rose-400 text-[10px] rounded font-bold animate-pulse text-center">
                ⚠️ ئاگاداری: جیاوازی زۆر لە نێوان سێنتیمێنتی سەرچاوەکاندا هەیە! (Significant Sentiment Disagreement!)
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-left">
              {sentimentState.breakdown.map((item: any) => (
                <div key={item.source} className="p-1.5 bg-slate-950 border border-slate-900 rounded font-mono text-[10px] flex flex-col justify-between">
                  <span className="text-slate-400 uppercase font-bold text-[8px]">{item.source.replace('_', ' ')}</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-500 text-[8px]">Articles: {item.count}</span>
                    <span className={item.score >= 0.1 ? 'text-emerald-400 font-bold' : item.score <= -0.1 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      {item.score >= 0 ? '+' : ''}{item.score.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* News Calendar Events List */}
        <div className="space-y-2 text-right" dir="rtl">
          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">ڕووداوە ماکرۆئابوورییەکان (Economic Calendar Feed)</label>
          
          {!hasCalendarFeed ? (
            <div className="p-4 bg-slate-900/60 border border-amber-900/30 rounded-xl text-center text-slate-400 text-xs">
              <span className="text-amber-500 font-mono block font-bold mb-1">NO CALENDAR FEED</span>
              <span>تکایە Trading Economics یان FRED بەستەر بکە بۆ بینینی ڕووداوە ئابوورییە ڕاستەقینەکان.</span>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-800/60 text-[9px] text-slate-400 uppercase font-mono">
                      <th className="py-2 px-3">Impact</th>
                      <th className="py-2 px-3">Currency</th>
                      <th className="py-2 px-3">Event Release</th>
                      <th className="py-2 px-3">Forecast</th>
                      <th className="py-2 px-3 text-right">Countdown</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] font-mono text-slate-200">
                    {newsEvents.map((item, index) => (
                      <tr key={index} className="border-b border-slate-900/40 hover:bg-slate-900/20">
                        <td className="py-2 px-3">
                          <span className={`px-1 rounded text-[8px] font-bold ${
                            item.impact === 'HIGH' ? 'bg-rose-950/60 text-rose-400 border border-rose-800/30' :
                            item.impact === 'MEDIUM' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/30' :
                            'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}>
                            {item.impact}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">{item.currency}</td>
                        <td className="py-2 px-3 font-sans text-slate-100 truncate max-w-[120px]" title={item.title}>{item.title}</td>
                        <td className="py-2 px-3 text-slate-300">{item.forecast}</td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                          {item.minutesRemaining <= 0 ? (
                            <span className="text-slate-400">RELEASED ({item.actual || item.forecast})</span>
                          ) : (
                            `${item.minutesRemaining}m`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Live News Items Feed */}
        {newsFeed.length > 0 && (
          <div className="space-y-2 text-right" dir="rtl">
            <label className="text-[10px] text-slate-400 uppercase font-bold block">دوایین هەواڵە وەرگیراوەکان (Live Sentiment Feed)</label>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 max-h-[160px] overflow-y-auto font-mono text-[10px] text-slate-300 scrollbar-thin">
              {newsFeed.slice(0, 5).map((news, idx) => (
                <div key={idx} className="pb-2 border-b border-slate-900/60 last:border-0 last:pb-0 flex flex-col space-y-0.5 text-right">
                  <div className="flex justify-between items-center text-[9px]">
                    <span className={`px-1 rounded text-[8px] font-bold ${
                      news.sentiment >= 0.1 ? 'bg-emerald-950 text-emerald-400' :
                      news.sentiment <= -0.1 ? 'bg-rose-950 text-rose-400' :
                      'bg-slate-900 text-slate-400'
                    }`}>
                      Sentiment: {news.sentiment >= 0 ? '+' : ''}{news.sentiment.toFixed(2)}
                    </span>
                    <span className="text-slate-500 font-sans">{news.source} • {new Date(news.time).toLocaleTimeString()}</span>
                  </div>
                  {news.url ? (
                    <a href={news.url} target="_blank" rel="noopener noreferrer" className="text-slate-100 hover:text-sky-400 font-sans truncate block text-left" dir="ltr">
                      {news.title}
                    </a>
                  ) : (
                    <span className="text-slate-100 font-sans truncate block text-left" dir="ltr">{news.title}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connection Hub list of News Platforms */}
        <div className="space-y-2 text-right" dir="rtl">
          <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">ڕێکخستن و دۆخی سەرچاوەکان (Connection Registry)</label>
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-900">
            {newsPlatforms.map((platform) => (
              <div key={platform.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950">
                
                {/* Platform info */}
                <div className="text-right flex-1 order-last sm:order-first">
                  <div className="flex items-center gap-1.5 justify-end sm:justify-start">
                    {platform.status === "CONNECTED" ? (
                      <span className="px-1.5 py-0.5 text-[8px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/30 rounded font-bold font-mono">
                        CONNECTED
                      </span>
                    ) : platform.status === "ERROR" ? (
                      <span className="px-1.5 py-0.5 text-[8px] bg-rose-950/60 text-rose-400 border border-rose-800/30 rounded font-bold font-mono animate-pulse" title={platform.errorMessage}>
                        CONNECTION ERROR
                      </span>
                    ) : platform.status === "LICENSED_ONLY" ? (
                      <span className="px-1.5 py-0.5 text-[8px] bg-sky-950 text-sky-400 border border-sky-900/30 rounded font-bold font-mono">
                        ENTERPRISE LICENSED ONLY
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[8px] bg-slate-900 text-slate-500 border border-slate-800 rounded font-bold font-mono">
                        NOT CONFIGURED
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-200">{platform.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans">{platform.description}</p>
                  {platform.lastFetchTime && (
                    <span className="text-[8px] text-slate-500 font-mono mt-0.5 block">Last Fetch: {new Date(platform.lastFetchTime).toLocaleTimeString()}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 justify-end">
                  {platform.status === "LICENSED_ONLY" ? (
                    <span className="text-[9px] text-amber-500/80 font-bold bg-amber-950/20 border border-amber-900/20 px-2 py-1 rounded">
                      Enterprise Licensing
                    </span>
                  ) : platform.status === "CONNECTED" ? (
                    <button
                      onClick={() => handleDisconnectNewsPlatform(platform.id)}
                      className="py-1 px-2.5 bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800/30 text-rose-400 rounded text-[9px] font-bold cursor-pointer transition-all"
                    >
                      پچڕاندنی بەستەر (Disconnect)
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveNewsConfig(platform.id);
                        setFormNewsPlatformKey('');
                        setNewsPlatformTestError('');
                        setNewsPlatformTestSuccess('');
                      }}
                      className="py-1 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-sky-400 rounded text-[9px] font-bold cursor-pointer transition-all"
                    >
                      ڕێکخستن (Configure)
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Accordion active news configuration drawer */}
        {activeNewsConfig && (
          <div className="p-4 bg-slate-900/40 border border-sky-500/30 rounded-xl space-y-3 animate-in fade-in duration-200" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
              <button 
                onClick={() => setActiveNewsConfig(null)} 
                className="p-1 hover:bg-slate-800 rounded text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <h4 className="text-xs font-bold text-slate-200">ڕێکخستنی کلیل بۆ: {activeNewsConfig.toUpperCase().replace('_', ' ')}</h4>
            </div>

            <div className="space-y-2">
              <input 
                type="password" 
                placeholder={`پێوەر یان کلیلی API بۆ ${activeNewsConfig}`}
                value={formNewsPlatformKey}
                onChange={(e) => setFormNewsPlatformKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 text-left" 
                dir="ltr"
              />

              {newsPlatformTestError && (
                <div className="p-2 bg-rose-950/30 border border-rose-900/30 text-rose-400 text-[10px] rounded leading-normal font-sans text-right">
                  {newsPlatformTestError}
                </div>
              )}

              {newsPlatformTestSuccess && (
                <div className="p-2 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-[10px] rounded leading-normal font-sans text-right">
                  {newsPlatformTestSuccess}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleTestNewsPlatform(activeNewsConfig, formNewsPlatformKey)}
                  disabled={newsPlatformTesting || !formNewsPlatformKey}
                  className="py-1 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 rounded text-[10px] font-bold cursor-pointer transition-all"
                >
                  {newsPlatformTesting ? "تاقیکردنەوە..." : "تاقیکردنەوەی گرێدان (Test)"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveNewsPlatformKey(activeNewsConfig, formNewsPlatformKey)}
                  disabled={!formNewsPlatformKey}
                  className="py-1 px-4 bg-sky-950/40 hover:bg-sky-950/60 border border-sky-800/40 text-sky-400 disabled:opacity-40 rounded text-[10px] font-bold cursor-pointer transition-all"
                >
                  پاشەکەوت و بەستنەوە (Save)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. INSTITUTIONAL FIX SESSION MONITOR (STAGE 2) */}
      <div id="fix-session-terminal" className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-900 pb-3" dir="rtl">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-amber-950/40 border border-amber-500/30 rounded text-amber-400">
              <Radio className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">چاودێری دانیشتنی پرۆتۆکۆلی FIX (FIX Session terminal)</h3>
              <span className="text-[10px] text-slate-500 font-mono block">OANDA & INSTITUTIONAL GATEWAYS</span>
            </div>
          </div>
          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
            fixStatus.status === 'LOGGED_IN' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/30' :
            fixStatus.status === 'LOGGING_IN' ? 'bg-amber-950 text-amber-400 border-amber-800/30 animate-pulse' :
            'bg-slate-900 text-slate-500 border-slate-800'
          }`}>
            {fixStatus.status}
          </span>
        </div>

        {/* Diagnostics Info */}
        <div className="grid grid-cols-4 gap-2 text-center" dir="rtl">
          <div className="p-2 bg-slate-900/60 border border-slate-800/80 rounded">
            <span className="text-[8px] text-slate-500 font-bold block">SENDER COMP</span>
            <span className="text-[10px] font-mono text-slate-200 block truncate font-bold">{fixStatus.senderCompId || "SOVEREIGN"}</span>
          </div>
          <div className="p-2 bg-slate-900/60 border border-slate-800/80 rounded">
            <span className="text-[8px] text-slate-500 font-bold block">TARGET COMP</span>
            <span className="text-[10px] font-mono text-slate-200 block truncate font-bold">{fixStatus.targetCompId || "GATEWAY"}</span>
          </div>
          <div className="p-2 bg-slate-900/60 border border-slate-800/80 rounded">
            <span className="text-[8px] text-slate-500 font-bold block">IN SEQ NUM</span>
            <span className="text-[10px] font-mono text-slate-200 block font-bold">{fixStatus.inboundSeqNum}</span>
          </div>
          <div className="p-2 bg-slate-900/60 border border-slate-800/80 rounded">
            <span className="text-[8px] text-slate-500 font-bold block">OUT SEQ NUM</span>
            <span className="text-[10px] font-mono text-slate-200 block font-bold">{fixStatus.outboundSeqNum}</span>
          </div>
        </div>

        {/* scrolling logs terminal */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-right" dir="rtl">
            <label className="text-[10px] text-slate-400 font-mono">FIX 4.4 INTERCEPTOR CONSOLE (10=CHECKSUM)</label>
          </div>
          <div 
            ref={fixTerminalEndRef}
            className="w-full bg-slate-950 border border-slate-900 rounded-lg p-3 h-36 overflow-y-auto font-mono text-[9px] text-amber-500 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 select-all"
          >
            {fixStatus.logs.length === 0 ? (
              <div className="text-slate-600 italic py-8 text-center">No active FIX sessions mapped. Connect the FIX Gateway from the broker panel to begin.</div>
            ) : (
              fixStatus.logs.map((log, idx) => (
                <div key={idx} className="leading-normal break-all font-mono">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action controls */}
        <div className="flex gap-2" dir="rtl">
          <button
            onClick={() => {
              fetch('/api/fix/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetCompId: 'OANDA_FIX_GATEWAY', senderCompId: 'SOVEREIGN_QUANT_CORE' })
              }).then(fetchFixStatus);
            }}
            disabled={fixStatus.status === 'LOGGED_IN' || fixStatus.status === 'LOGGING_IN'}
            className="px-3 py-1 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-800/30 text-emerald-400 rounded text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            دەستپێکردنی Logon (FIX)
          </button>
          <button
            onClick={() => {
              fetch('/api/fix/disconnect', { method: 'POST' }).then(fetchFixStatus);
            }}
            disabled={fixStatus.status !== 'LOGGED_IN'}
            className="px-3 py-1 bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800/30 text-rose-400 rounded text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            پچڕاندنی دانیشتن
          </button>
        </div>
      </div>

      {/* 4. SOVEREIGN APEX STRATEGY MODES ENGINE (STAGE 3) */}
      <div id="sovereign-strategies-hub" className="lg:col-span-12 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 text-right" dir="rtl">
          <div>
            <div className="flex items-center gap-2 justify-start">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">سەنتەری تەکینیکە پێشکەوتووەکانی سۆڤرین (Sovereign Core Strategies Hub)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">بەڕێوەبردن و بەدواداچوونی پێنج مۆدی سەرەکی بازرگانی بە لایڤ لەسەر پایپلاینی داتا.</p>
          </div>
          
          {/* Instrument Selector Tabs */}
          <div className="mt-3 sm:mt-0 flex gap-2">
            {["EUR/USD", "GBP/USD", "BTC/USD"].map(sym => (
              <button
                key={sym}
                onClick={() => setActiveStrategySymbol(sym)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  activeStrategySymbol === sym 
                    ? "bg-sky-950 border border-sky-500 text-sky-400 font-mono" 
                    : "bg-slate-900 border border-slate-800 text-slate-400 font-mono hover:text-slate-300"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* Config Controls and States for the Selected Symbol */}
        {(() => {
          const symConfig = strategiesConfig[activeStrategySymbol] || {
            whaleMode: true,
            sniperMode: true,
            breakevenEnabled: true,
            breakevenThreshold: 8.0,
            dynamicSlEnabled: true,
            shockAbsorberEnabled: true
          };

          const updateConfigField = async (field: string, value: any) => {
            try {
              const updated = { ...symConfig, [field]: value };
              setStrategiesConfig(prev => ({ ...prev, [activeStrategySymbol]: updated }));
              setStrategiesSaveStatus(true);
              
              await fetch('/api/strategies/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  symbol: activeStrategySymbol,
                  ...updated
                })
              });

              fetchStrategiesConfig();
              setTimeout(() => setStrategiesSaveStatus(false), 1200);
            } catch (e) {
              console.error("Failed to update strategy config:", e);
            }
          };

          const getLastTriggerTime = (modeKey: string) => {
            const symTriggers = strategiesConfig[`lastTriggered_${activeStrategySymbol}`] || {};
            return symTriggers[modeKey] || "سەرەتایی (Armed)";
          };

          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left side: Toggles & Stats */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Whale Mode */}
                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${symConfig.whaleMode ? 'bg-sky-500 animate-ping' : 'bg-slate-600'}`}></span>
                      <span className="text-[10px] text-sky-400 font-mono font-bold">MODE 01</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!symConfig.whaleMode} 
                        onChange={(e) => updateConfigField('whaleMode', e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  </div>
                  <div className="text-right" dir="rtl">
                    <h4 className="text-xs font-bold text-slate-100">مۆدی نەهەنگەکان (Whale Tracker Mode)</h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">چاودێری قووڵی دەفتەری داواکارییەکان بۆ ناسینەوەی گرێبەستە گەورەکان و دەرزی حجم.</p>
                  </div>
                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500">Last Action:</span>
                    <span className="text-slate-300 font-bold">{getLastTriggerTime('whaleMode')}</span>
                  </div>
                </div>

                {/* 2. SniperMod */}
                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${symConfig.sniperMode ? 'bg-emerald-500 animate-ping' : 'bg-slate-600'}`}></span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">MODE 02</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!symConfig.sniperMode} 
                        onChange={(e) => updateConfigField('sniperMode', e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <div className="text-right" dir="rtl">
                    <h4 className="text-xs font-bold text-slate-100">مۆدی نیشانەشکێن (SniperMod Precision)</h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">چوونە ژوورەوەی زۆر ورد لە ئاستە گرنگەکانی پشتیوانی و بەرگری بە خێرایی FIX.</p>
                  </div>
                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500">Last Execution:</span>
                    <span className="text-slate-300 font-bold">{getLastTriggerTime('sniperMode')}</span>
                  </div>
                </div>

                {/* 3. Break-even Zero Loss Shield */}
                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${symConfig.breakevenEnabled ? 'bg-amber-500 animate-ping' : 'bg-slate-600'}`}></span>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">MODE 03</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!symConfig.breakevenEnabled} 
                        onChange={(e) => updateConfigField('breakevenEnabled', e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                  <div className="text-right" dir="rtl">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] bg-amber-950/40 text-amber-400 border border-amber-500/20 px-1 rounded font-mono font-bold">
                        LIMIT: {symConfig.breakevenThreshold} PIPS
                      </span>
                      <h4 className="text-xs font-bold text-slate-100">قەڵغانی گەڕانەوە بۆ خاڵی دەسپێک (Break-even Shield)</h4>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">جوڵاندنی Stop-Loss بۆ خاڵی چوونە ژوورەوە بە شێوەیەکی خۆکار بەمەبەستی زەرەری سفر.</p>
                  </div>
                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Threshold:</span>
                      <input 
                        type="number" 
                        value={symConfig.breakevenThreshold} 
                        onChange={(e) => updateConfigField('breakevenThreshold', parseFloat(e.target.value) || 5.0)}
                        className="w-10 bg-slate-950 border border-slate-800 text-center text-slate-200 rounded font-bold"
                      />
                    </div>
                    <span className="text-slate-300 font-bold">{getLastTriggerTime('breakeven')}</span>
                  </div>
                </div>

                {/* 4. Dynamic Stop Loss & Leverage */}
                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${symConfig.dynamicSlEnabled ? 'bg-violet-500 animate-ping' : 'bg-slate-600'}`}></span>
                      <span className="text-[10px] text-violet-400 font-mono font-bold">MODE 04</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!symConfig.dynamicSlEnabled} 
                        onChange={(e) => updateConfigField('dynamicSlEnabled', e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                  <div className="text-right" dir="rtl">
                    <h4 className="text-xs font-bold text-slate-100">تەنزیمی مەترسی داینامیکی (Dynamic SL & Volatility Leverage)</h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">ڕێکخستنی جۆڵاوی Stop-Loss و Leverage لەسەر بنەمای گۆڕانی لایڤی ATR و شەپۆل.</p>
                  </div>
                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500">SL Engine:</span>
                    <span className="text-violet-400 font-bold">ATR VOLATILITY ADAPTIVE</span>
                  </div>
                </div>

                {/* 5. Shock Absorber */}
                <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 relative overflow-hidden md:col-span-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${symConfig.shockAbsorberEnabled ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`}></span>
                      <span className="text-[10px] text-rose-400 font-mono font-bold">MODE 05</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!symConfig.shockAbsorberEnabled} 
                        onChange={(e) => updateConfigField('shockAbsorberEnabled', e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>
                  <div className="text-right" dir="rtl">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`px-2 py-0.5 text-[9px] border font-bold font-mono rounded ${isShockAbsorberActive ? 'bg-rose-950 border-rose-500 text-rose-400 animate-pulse' : 'bg-slate-900 border-slate-850 text-slate-500'}`}>
                        {isShockAbsorberActive ? `GOVERNOR ACTIVE: ${(shockAbsorberLevel * 100).toFixed(0)}% Sizing` : "GOVERNOR NOMINAL"}
                      </span>
                      <h4 className="text-xs font-bold text-slate-100">سیستەمی دامپەر و هاوسەنگی جێگیری (Shock Absorber System)</h4>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">بچووککردنەوە یان بلۆککردنی فەرمانەکان بە شێوەیەکی خۆکار لەکاتی بەرزبوونەوەی زۆر تیژی مەترسی یان سزاکانی مۆدێلی C++.</p>
                  </div>
                </div>

              </div>

              {/* Right side: Strategy Decisions Audit Logs */}
              <div className="lg:col-span-4 bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-right" dir="rtl">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">لۆگی بڕیارەکانی تەکینیکەکان (Strategy Audits)</h4>
                    </div>
                    <button 
                      onClick={async () => {
                        setIsRefreshingLogs(true);
                        await fetchStrategyAuditLogs();
                        setTimeout(() => setIsRefreshingLogs(false), 500);
                      }}
                      disabled={isRefreshingLogs}
                      className="p-1 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLogs ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  
                  <div className="h-[320px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                    {strategyAuditLogs.filter(log => log.symbol === activeStrategySymbol).length === 0 ? (
                      <div className="text-slate-600 text-[10px] italic py-24 text-center">بۆ ئەم جووتە دراوە هێشتا هیچ ڕووداوێکی تەکینیکی لۆگ نەکراوە.</div>
                    ) : (
                      strategyAuditLogs
                        .filter(log => log.symbol === activeStrategySymbol)
                        .slice(-6)
                        .reverse()
                        .map((log, idx) => (
                          <div key={idx} className="bg-slate-950/60 border border-slate-900 rounded p-2.5 space-y-1 text-right" dir="rtl">
                            <div className="flex justify-between items-center text-[9px] font-mono">
                              <span className="text-slate-500">{new Date(log.triggered_at || Date.now()).toLocaleTimeString()}</span>
                              <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[8px] ${
                                log.mode_name === 'Whale Mode' ? 'bg-sky-950 text-sky-400 border border-sky-900' :
                                log.mode_name === 'SniperMod' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                                log.mode_name === 'Break-even Zero Loss' ? 'bg-amber-950 text-amber-400 border border-amber-900' : 'bg-rose-950 text-rose-400 border border-rose-900'
                              }`}>
                                {log.mode_name}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-300 font-sans leading-relaxed">{log.details_raw}</p>
                            <div className="text-[9px] font-mono text-slate-500 flex justify-between items-center border-t border-slate-900/60 pt-1 mt-1">
                              <span>Output:</span>
                              <span className="text-slate-400">{log.trigger_value}</span>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="text-center">
                  <span className="text-[9px] text-slate-500 font-mono block">
                    {strategiesSaveStatus ? "✓ SECURELY SYNCED WITH PG DATABASE" : "STATE PERSISTENCE: DURABLE POSTGRES"}
                  </span>
                </div>

              </div>

            </div>
          );
        })()}
      </div>

      {/* 5. LIVE LYNKED PORTFOLIO MONITOR CARD */}
      <div id="live-account-monitor-widget" className="lg:col-span-12 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 text-right" dir="rtl">
          <div>
            <div className="flex items-center gap-2 justify-start">
              <span className={`w-2.5 h-2.5 rounded-full ${selectedEnvironment === 'REAL_LIVE' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`}></span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">سیستەمی چاودێری پۆرتفۆلیۆ و پێگەکان (Live Portfolio Monitor)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">داتاکان چرکە بە چرکە نوێ دەبنەوە بە ئاستی گرتنی لایڤ لە سێرڤەر و دەسکەوت.</p>
          </div>
          
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                onClick={() => setSelectedEnvironment('DEMO_LIVE')}
                className={`px-3 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  selectedEnvironment === 'DEMO_LIVE'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                DEMO_LIVE
              </button>
              <button
                onClick={() => setSelectedEnvironment('REAL_LIVE')}
                className={`px-3 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  selectedEnvironment === 'REAL_LIVE'
                    ? 'bg-rose-950 text-rose-400 border border-rose-900/40 animate-pulse'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                REAL_LIVE
              </button>
            </div>

            <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-300">
              NOMINAL DMA ACCESS: <span className={selectedEnvironment === 'REAL_LIVE' ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>{selectedEnvironment === 'REAL_LIVE' ? "REAL-CAPITAL" : "DEMO-LIVE"}</span>
            </div>
          </div>
        </div>

        {/* Account Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg text-right" dir="rtl">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">باڵانسی گشتی (Balance)</span>
            <span className="text-sm font-mono font-bold text-slate-100">${accountStats.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg text-right" dir="rtl">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">سەرمایەی داینامیکی (Equity)</span>
            <span className="text-sm font-mono font-bold text-sky-400">${accountStats.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg text-right" dir="rtl">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">مارجینی بەکارهاتوو (Used Margin)</span>
            <span className="text-sm font-mono font-bold text-amber-500">${accountStats.usedMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg text-right" dir="rtl">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">مارجینی ئازاد (Free Margin)</span>
            <span className="text-sm font-mono font-bold text-emerald-400">${accountStats.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg text-right" dir="rtl">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">ئاستی مارجین (Margin Level %)</span>
            <span className={`text-sm font-mono font-bold ${accountStats.marginLevel > 200 ? 'text-emerald-400' : 'text-rose-500'}`}>{accountStats.marginLevel}%</span>
          </div>
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg text-right" dir="rtl">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">قازانج/زیانی ئەمڕۆ (Today's PnL)</span>
            <span className={`text-sm font-mono font-bold flex items-center gap-1 justify-end ${accountStats.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {accountStats.todayPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              ${accountStats.todayPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Positions Table */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex justify-between items-center text-right" dir="rtl">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                پۆزیشنە کراوەکان لەسەر ئەکاونت (Active Positions)
              </h4>
              <span className="text-[10px] font-mono text-slate-500 font-bold">TOTAL: {positions.length} CONTRACTS</span>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg overflow-hidden">
              {positions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  هیچ پۆزیشنێکی کراوە لەسەر ئەکاونت نییە لە ئێستادا.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-mono">
                        <th className="py-2 px-3">Symbol</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Size (Lots)</th>
                        <th className="py-2 px-3">Entry Price</th>
                        <th className="py-2 px-3">Current Price</th>
                        <th className="py-2 px-3">S/L</th>
                        <th className="py-2 px-3">T/P</th>
                        <th className="py-2 px-3 text-right">PnL ($)</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono text-slate-200">
                      {positions.map((pos) => (
                        <tr key={pos.id} className="border-b border-slate-900/60 hover:bg-slate-900/30 transition-all">
                          <td className="py-2.5 px-3 font-bold text-slate-100">{pos.symbol}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              pos.type === 'BUY' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            }`}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">{pos.size}</td>
                          <td className="py-2.5 px-3 text-slate-400">{pos.entryPrice.toFixed(pos.symbol.includes('/') ? 5 : 2)}</td>
                          <td className="py-2.5 px-3 text-sky-400 font-semibold animate-pulse">{pos.currentPrice.toFixed(pos.symbol.includes('/') ? 5 : 2)}</td>
                          <td className="py-2.5 px-3 text-rose-400/80">{pos.sl.toFixed(pos.symbol.includes('/') ? 5 : 2)}</td>
                          <td className="py-2.5 px-3 text-emerald-400/80">{pos.tp.toFixed(pos.symbol.includes('/') ? 5 : 2)}</td>
                          <td className={`py-2.5 px-3 text-right font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}$
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleClosePosition(pos.id)}
                              className="p-1 hover:bg-rose-950/50 border border-transparent hover:border-rose-800/40 rounded text-rose-400 transition-all cursor-pointer"
                              title="داخستنی ڕاستەوخۆ"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Quick Trade Panel */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-right" dir="rtl">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 justify-end">
                <Settings2 className="w-4 h-4 text-sky-400" />
                جێبەجێکردنی فەرمانی خێرا (Quick Trade Pad)
              </h4>
              <p className="text-[10px] text-slate-500">لێرەوە دەتوانیت فەرمانی نوێ ڕاستەوخۆ بە لایڤ بنێریتە سەر حساب.</p>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-lg space-y-3 text-right" dir="rtl">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">جۆری فەرمان</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setNewOrderType('BUY')}
                      className={`py-1 text-xs font-bold rounded border transition-all cursor-pointer ${
                        newOrderType === 'BUY' ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-900 text-slate-500'
                      }`}
                    >
                      BUY
                    </button>
                    <button
                      onClick={() => setNewOrderType('SELL')}
                      className={`py-1 text-xs font-bold rounded border transition-all cursor-pointer ${
                        newOrderType === 'SELL' ? 'bg-rose-950 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-900 text-slate-500'
                      }`}
                    >
                      SELL
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">تیکەری هێما (Symbol)</label>
                  <select
                    value={newOrderSymbol}
                    onChange={(e) => setNewOrderSymbol(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-sky-500"
                  >
                    <option value="EUR/USD">EUR/USD</option>
                    <option value="GBP/USD">GBP/USD</option>
                    <option value="BTC/USD">BTC/USD</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">قەبارەی لۆت (Lot Size)</label>
                  <span className="text-[10px] font-mono font-bold text-sky-400">{newOrderSize} Lots</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={newOrderSize}
                  onChange={(e) => setNewOrderSize(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {newsStats.influenceMultiplier < 1.0 && (
                <div className="p-2 bg-rose-950/30 border border-rose-900/30 rounded text-[9px] text-rose-300 leading-normal">
                  ⚠ ئاگاداری: بەهۆی نزیکبوونەوەی هەواڵ لۆتی نوێ خۆکارانە بۆ ٢٥٪ بچووک دەکرێتەوە بۆ کەمکردنەوەی جێگیربوونی زیان! (کردەوە: {parseFloat((newOrderSize * newsStats.influenceMultiplier).toFixed(2))} Lots)
                </div>
              )}

              <button
                onClick={handleCreateOrder}
                className={`w-full py-2 font-bold text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  newOrderType === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>{newOrderType === 'BUY' ? 'کڕین لەگەڵ کۆپلەی هەواڵ' : 'فرۆشتن لەگەڵ کۆپلەی هەواڵ'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. HARDEN KEY SECURITY & ROTATION HUB (STAGE 2) */}
      <div id="harden-security-hub" className="lg:col-span-12 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-900 pb-3" dir="rtl">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-indigo-950/40 border border-indigo-500/30 rounded text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">سەنتەری بەهێزکردنی ئاسایش و خولانەوەی کلیلەکان (Hardened HSM Hub)</h3>
              <span className="text-[10px] text-slate-500 font-mono block">AES-256 DATABASE & MUTATE KEY ROTATOR & IP ALLOWLIST</span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-500/30 rounded-full font-mono font-bold animate-pulse">
            SHIELD ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" dir="rtl">
          {/* A. Encryption Status */}
          <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl space-y-2 text-right">
            <div className="flex items-center space-x-1.5 space-x-reverse text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase">ئاستی کۆدکردنی داتابەیس</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              هەموو کلیلی برۆکەرەکان لە Postgres بە ئاستی <span className="text-indigo-400 font-mono font-bold">AES-256-CBC</span> لە ڕێگەی کلیلێکی Master نهێنی لە ناوەوەی سێرڤەر بە پارێزراوی هەڵگیراون. هیچ کلیلێک لە لۆگەکاندا دەرناکەوێت.
            </p>
            <div className="flex items-center gap-1.5 pt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-400">HSM ENGINE NOMINAL STATUS</span>
            </div>
          </div>

          {/* B. Key Rotation Controls */}
          <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl space-y-2 text-right">
            <div className="flex items-center space-x-1.5 space-x-reverse text-indigo-400">
              <Key className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase">خولانەوەی خۆکارانەی کلیلی ناوەکی (API_MUTATE_KEY)</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              کلیلی ناوەکی بۆ نووسینی داتا بە شێوەیەکی خۆکار خشتەبەند کراوە بۆ خولانەوە هەر ١٠ خولەک جارێک.
            </p>
            <div className="bg-slate-950 p-2 border border-slate-800 rounded font-mono text-xs flex justify-between items-center text-left" dir="ltr">
              <span className="text-slate-500 text-[10px]">CURRENT MUTATE KEY:</span>
              <span className="text-indigo-400 font-bold">{securityInfo.maskedMutateKey || "••••••••"}</span>
            </div>
            <button
              onClick={handleRotateMutateKey}
              className="w-full py-1.5 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 rounded text-[10px] font-bold transition-all cursor-pointer"
            >
              خولاندنەوەی کلیلەکە ئێستا (Force Rotate Key)
            </button>
          </div>

          {/* C. IP Allowlist Settings */}
          <form onSubmit={handleSaveAllowlist} className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl space-y-2 text-right">
            <div className="flex items-center space-x-1.5 space-x-reverse text-indigo-400">
              <Globe className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase">لیستی ناونیشانە ڕێگەپێدراوەکان (IP Allowlist)</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              تەنها ڕێگە بدە بەم ناونیشانانە کە دەستکاری بەستەری برۆکەر و جێبەجێکردنی فەرمانەکانی کۆنتڕۆڵ بکەن:
            </p>
            <input 
              type="text"
              required
              value={formAllowedIps}
              onChange={(e) => setFormAllowedIps(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 font-mono focus:outline-none" 
              placeholder="127.0.0.1, ::1, 10.0.0.5"
            />
            <button
              type="submit"
              className="w-full py-1.5 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 rounded text-[10px] font-bold transition-all cursor-pointer"
            >
              {allowlistSaved ? "✓ لیستی ڕێگەپێدراو چاککرا" : "تۆمارکردن و جێبەجێکردنی Whitelist"}
            </button>
          </form>
        </div>
      </div>

      {/* 5. EXECUTION QUALITY & ATTRIBUTION ANALYTICS */}
      <div className="lg:col-span-12">
        <ExecutionAttributionPanel />
      </div>

    </div>
  );
}
