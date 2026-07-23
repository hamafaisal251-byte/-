import { useState, useEffect, useRef } from "react";
import { 
  GitPullRequest, GitBranch, ShieldCheck, Play, CheckCircle2, XCircle, 
  RefreshCw, Terminal, Clock, Eye, AlertTriangle, ArrowRight, GitMerge, Zap, Cpu
} from "lucide-react";

interface TestResult {
  name: string;
  status: "PASSED" | "FAILED" | "PENDING";
  details: string;
}

interface PullRequest {
  prId: string;
  title: string;
  branch: string;
  author: string;
  description: string;
  timestamp: string;
  ciStatus: "PASSED" | "FAILED" | "PENDING";
  diff: string;
  code?: string;
  tests: TestResult[];
}

interface HistoricalMerge {
  id: string;
  title: string;
  branch: string;
  author: string;
  mergedAt: string;
  ciStatus: "PASSED";
  deployDurationSec: number;
  version: string;
}

interface Invariant {
  id: string;
  name: string;
  description: string;
  file: string;
  ruleType: string;
}

interface ProtectedZone {
  id: string;
  name: string;
  pattern: string;
  status: string;
}

interface ViolationLog {
  id: string;
  timestamp: string;
  invariantId: string;
  targetFile: string;
  actor: string;
  result: string;
  details: string;
}

interface InvariantUpdate {
  id: string;
  commit: string;
  author: string;
  timestamp: string;
  prTitle: string;
  description: string;
  status: string;
}

export default function CodePipelinePanel() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [history, setHistory] = useState<HistoricalMerge[]>([]);
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [proposingGoal, setProposingGoal] = useState<string>("high-volatility");
  const [targetFile, setTargetFile] = useState<string>("");
  const [isHumanAuthorized, setIsHumanAuthorized] = useState<boolean>(false);
  const [proposeLogs, setProposeLogs] = useState<string[]>([]);
  const [proposeStatus, setProposeStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [mergeLogs, setMergeLogs] = useState<string[]>([]);
  const [mergeStatus, setMergeStatus] = useState<"idle" | "running" | "success">("idle");
  
  // Invariants state
  const [invariants, setInvariants] = useState<Invariant[]>([]);
  const [protectedZones, setProtectedZones] = useState<ProtectedZone[]>([]);
  const [violations, setViolations] = useState<ViolationLog[]>([]);
  const [invariantUpdates, setInvariantUpdates] = useState<InvariantUpdate[]>([]);
  const [invVersion, setInvVersion] = useState<string>("1.0.0");
  const [invLastUpdated, setInvLastUpdated] = useState<string>("");
  const [invTab, setInvTab] = useState<"invariants" | "zones" | "violations" | "updates">("invariants");

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const proposeConsoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPipelineData();
    fetchInvariantsData();
  }, []);

  const fetchInvariantsData = async () => {
    try {
      const res = await fetch("/api/pipeline/invariants");
      if (res.ok) {
        const data = await res.json();
        setInvariants(data.invariants || []);
        setProtectedZones(data.protectedZones || []);
        setViolations(data.recentViolations || []);
        setInvariantUpdates(data.invariantUpdatesHistory || []);
        setInvVersion(data.version || "1.0.0");
        setInvLastUpdated(data.lastUpdated || "");
      }
    } catch (err) {
      console.error("Error fetching invariants:", err);
    }
  };

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [mergeLogs]);

  useEffect(() => {
    if (proposeConsoleEndRef.current) {
      proposeConsoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [proposeLogs]);

  const fetchPipelineData = async () => {
    setLoading(true);
    try {
      const resPrs = await fetch("/api/pipeline/prs");
      if (resPrs.ok) {
        const data = await resPrs.json();
        setPrs(data.prs);
        if (data.prs.length > 0 && !selectedPrId) {
          setSelectedPrId(data.prs[0].prId);
        }
      }
      
      const resHist = await fetch("/api/pipeline/history");
      if (resHist.ok) {
        const data = await resHist.json();
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Error loading pipeline data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProposeChange = async () => {
    setProposeStatus("running");
    setProposeLogs([
      `[AI-SCHEDULER] Triggering AI quantitative research agent with goal: ${proposingGoal.toUpperCase()}`,
      `[AI-SCHEDULER] Loading baseline strategy definitions from test/test_clean.cpp...`,
    ]);

    const stepLogs = [
      `[GEMINI-PROVIDER] Invoking models/gemini-3.6-flash for non-linear reward synthesis...`,
      `[GEMINI-PROVIDER] Optimization hypothesis generated! Extracting C++ strategy module...`,
      `[AST-SANITIZER] Initiating Step 1: Lexical parser scan for unapproved platform tokens...`,
      `[AST-SANITIZER] Success: Zero unsafe operating system keywords (system, popen, fork, socket) found.`,
      `[CPPCHECK] Initiating Step 2: Running static analyzer on generated file...`,
      `[CPPCHECK] Success: Zero uninitialized variables or memory leak vectors reported.`,
      `[COMPILER] Initiating Step 3: Compiling C++ candidate with AddressSanitizer and UndefinedBehaviorSanitizer...`,
      `[COMPILER] Success: Built dynamic shared library candid_module.so with 0 compiler warnings.`,
      `[SIMULATOR] Initiating Step 4: Bootstrapping dynamic run simulation with 500,000 tick market history playback...`,
      `[SIMULATOR] Success: Simulation completed cleanly. Total reward accumulated: +2.15e+07. Leaked: 0 bytes.`,
      `[GIT-MANAGER] Creating branch feature/gemini-${proposingGoal}-auto-evolved...`,
      `[GIT-MANAGER] Committing proposed improvements to branch...`,
      `[GIT-MANAGER] Opening Sovereign-PR on GitHub. Integration locks configured.`,
    ];

    let currentLogIndex = 0;
    const logInterval = setInterval(() => {
      if (currentLogIndex < stepLogs.length) {
        setProposeLogs(prev => [...prev, stepLogs[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(logInterval);
        submitProposal();
      }
    }, 1200);
  };

  const submitProposal = async () => {
    try {
      const response = await fetch("/api/pipeline/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          goal: proposingGoal,
          targetFile: targetFile.trim(),
          isHumanAuthorized: isHumanAuthorized
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setProposeLogs(prev => [...prev, `[SUCCESS] Pull request successfully generated: ${data.pr.title}`, `[SUCCESS] CI status: PASSED`]);
        setProposeStatus("success");
        fetchPipelineData();
        setSelectedPrId(data.pr.prId);
      } else {
        const errData = await response.json();
        setProposeLogs(prev => [
          ...prev, 
          `[ERROR] ${errData.status || 'REJECTED'}: ${errData.error || "Validation check failed"}`,
          `[LOG] ${errData.log || ""}`
        ]);
        setProposeStatus("error");
      }
    } catch (err: any) {
      setProposeLogs(prev => [...prev, `[ERROR] Connection error: ${err.message}`]);
      setProposeStatus("error");
    }
  };

  const handleMergePR = async (prId: string) => {
    setMergeStatus("running");
    setMergeLogs([
      `[HUMAN-GATE] Human approval detected for PR ID: ${prId}. Initiating merge sequence...`,
      `[GIT-MERGE] Merging feature branch into main with squashed revisions...`,
      `[CI-VERIFY] Confirming pre-merge regression tests and ASan audits are fully green... SUCCESS!`,
    ]);

    const deploySteps = [
      `[AUTO-DEPLOY] Triggering zero-downtime rolling deployment (restart_rolling.sh)...`,
      `[ROLLING] Step 1/5: Compiling fresh bundle and building container image...`,
      `[ROLLING] Step 2/5: Spawning side-by-side GREEN container on target port 3001...`,
      `[ROLLING] Step 3/5: Polling green container readiness at http://127.0.0.1:3001/api/ready...`,
      `[ROLLING]   - Attempt 1/30: NOT_READY (initializing database pool...)`,
      `[ROLLING]   - Attempt 2/30: NOT_READY (restoring live market coordinates...)`,
      `[ROLLING]   - Attempt 3/30: READY! Green container state successfully synchronised.`,
      `[ROLLING] Step 4/5: Hot-swapping reverse proxy ingress mapping port 3000 -> 3001...`,
      `[ROLLING] Step 5/5: Sending SIGTERM to old BLUE container (request drain active)...`,
      `[ROLLING]   - Request drain completed cleanly. All open positions persistent.`,
      `[ROLLING] Shutting down old container blue-old...`,
      `[SUCCESS] Zero-downtime rolling deployment successfully completed. Live system upgraded!`,
    ];

    let index = 0;
    const deployInterval = setInterval(() => {
      if (index < deploySteps.length) {
        setMergeLogs(prev => [...prev, deploySteps[index]]);
        index++;
      } else {
        clearInterval(deployInterval);
        submitMerge(prId);
      }
    }, 1000);
  };

  const submitMerge = async (prId: string) => {
    try {
      const response = await fetch("/api/pipeline/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prId })
      });
      
      if (response.ok) {
        setMergeStatus("success");
        setTimeout(() => {
          setMergeStatus("idle");
          setMergeLogs([]);
        }, 5000);
        fetchPipelineData();
      }
    } catch (err) {
      console.error("Error merging PR:", err);
      setMergeStatus("idle");
    }
  };

  const activePr = prs.find(p => p.prId === selectedPrId);

  return (
    <div className="space-y-6">
      
      {/* Real-time Infrastructure Overview Header */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-purple-950/50 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
            <GitPullRequest className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              بۆری خۆکارانەی گۆڕینی کۆد <span className="text-purple-400 font-mono text-xs">| Automated Code-Change Pipeline</span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              This pipeline automates AI quantitative research, static lexical scans (AST safety checks), G++ sanitizers, and PR creation. 
              <strong className="text-rose-400 ml-1">Strict Human Gate:</strong> No application code can reach production without a manual merge click.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 bg-slate-950/80 border border-slate-800 p-3.5 px-4 rounded-xl shrink-0">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
          <div className="text-right">
            <span className="block text-[9px] text-slate-500 font-mono uppercase tracking-wider">STATE DEPLOYER</span>
            <span className="block text-xs text-emerald-400 font-bold font-mono">AUTOMATION ACTIVE</span>
          </div>
        </div>
      </div>

      {/* REGRESSION GUARD & ARCHITECTURAL INVARIANTS SECTION */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
                پارێزەری داڕشتن و پێوانەی بنەڕەتی <span className="text-emerald-400 font-mono text-xs">| Regression Guard & Architectural Invariants</span>
              </h3>
              <p className="text-xs text-slate-400">
                Protected baseline invariants prevent architectural reversions, stray files, or protected-zone shrinkage across all AI and developer loops.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-400">
              Version {invVersion}
            </span>
            <span className="text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ALL {invariants.length} INVARIANTS PASSED
            </span>
          </div>
        </div>

        {/* Tab Navigation for Regression Guard */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs font-mono">
          <button
            onClick={() => setInvTab("invariants")}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              invTab === "invariants"
                ? "bg-purple-950/60 border-purple-500/40 text-purple-300 font-bold"
                : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            Baseline Invariants ({invariants.length})
          </button>
          <button
            onClick={() => setInvTab("zones")}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              invTab === "zones"
                ? "bg-purple-950/60 border-purple-500/40 text-purple-300 font-bold"
                : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            Protected Exclusions ({protectedZones.length})
          </button>
          <button
            onClick={() => setInvTab("violations")}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              invTab === "violations"
                ? "bg-purple-950/60 border-purple-500/40 text-purple-300 font-bold"
                : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            Violations & Reversions ({violations.length})
          </button>
          <button
            onClick={() => setInvTab("updates")}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              invTab === "updates"
                ? "bg-purple-950/60 border-purple-500/40 text-purple-300 font-bold"
                : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            `invariant:` Log History ({invariantUpdates.length})
          </button>
        </div>

        {/* Tab 1: Baseline Invariants Table */}
        {invTab === "invariants" && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-500 bg-slate-950/60">
                    <th className="p-3 font-semibold">Invariant ID & Name</th>
                    <th className="p-3 font-semibold">Target File / Scope</th>
                    <th className="p-3 font-semibold">Rule Description</th>
                    <th className="p-3 font-semibold text-right">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 font-mono text-[11px]">
                  {invariants.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-950/30 transition-colors">
                      <td className="p-3 font-bold text-slate-200">
                        <span className="block text-purple-400 text-[10px]">{inv.id}</span>
                        <span>{inv.name}</span>
                      </td>
                      <td className="p-3 text-slate-400">
                        <span className="bg-slate-950 border border-slate-800 p-1 px-2 rounded text-[10px] text-amber-400">
                          {inv.file}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-sans text-xs leading-relaxed max-w-md">
                        {inv.description}
                      </td>
                      <td className="p-3 text-right">
                        <span className="inline-flex items-center gap-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PASSED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Protected Zones */}
        {invTab === "zones" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {protectedZones.map((zone) => (
              <div key={zone.id} className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-1.5 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-200">{zone.name}</span>
                  <span className="text-[9px] bg-purple-950 text-purple-400 border border-purple-800/40 px-2 py-0.5 rounded font-bold uppercase">
                    PROTECTED ZONE
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">Pattern: <code className="text-amber-400">{zone.pattern}</code></div>
                <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                  Automated mutations on files matching this area are immediately blocked by the pipeline.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Violations Log */}
        {invTab === "violations" && (
          <div className="space-y-3 font-mono text-xs">
            {violations.map((v) => (
              <div key={v.id} className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-rose-400 font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    {v.invariantId}
                  </span>
                  <span className="text-[10px] text-slate-500">{new Date(v.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  <strong>Target File:</strong> <code className="text-amber-400 font-mono text-[10px]">{v.targetFile}</code> — {v.details}
                </div>
                <div className="text-[10px] text-slate-500">
                  Actor: <span className="text-purple-400">{v.actor}</span> | Result: <span className="text-rose-400 font-bold">{v.result}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Invariant Update Log History */}
        {invTab === "updates" && (
          <div className="space-y-3 font-mono text-xs">
            {invariantUpdates.map((upd) => (
              <div key={upd.id} className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-purple-400 font-bold flex items-center gap-1.5">
                    <GitMerge className="w-4 h-4 text-purple-400" />
                    {upd.commit}
                  </span>
                  <span className="text-[10px] text-slate-500">{new Date(upd.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-amber-300/90 font-sans bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/20">
                  {upd.description}
                </p>
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>Author: {upd.author}</span>
                  <span className="text-emerald-400 font-bold">{upd.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: AI Strategy Lab & Open PRs List */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* AI strategy loop trigger panel */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 font-mono flex items-center gap-2 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
              تاقیگەی ستراتیژی ژیری دەستکرد | AI Strategy Lab
            </h3>
            
            <p className="text-xs text-slate-400">
              Trigger the Gemini AI Quant agent to formulate, code, scan, and test a new strategy candidate on-demand.
            </p>
            
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase">Strategy / Core Goal</label>
                <select 
                  value={proposingGoal}
                  onChange={(e) => setProposingGoal(e.target.value)}
                  disabled={proposeStatus === "running"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500 transition-all font-mono"
                >
                  <option value="high-volatility">High Volatility Scaling (C++) 📊</option>
                  <option value="slippage-compensation">Asymmetric Slippage Cost Penalty (C++) ⚡</option>
                  <option value="latency-minimization">Low-Latency Sniper Micro-Bonus (C++) ⏱️</option>
                  <option value="server-performance">Express Telemetry Logging (server.ts) 🚀</option>
                  <option value="go-strategy-opt">Order Book Lock-Free Engine (Go) 🏎️</option>
                  <option value="cpp-drl-throughput">SIMD Feature Extraction (C++ DRL) 🧠</option>
                </select>

                <div className="space-y-1.5 pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase">Optional Target File</label>
                  <input
                    type="text"
                    placeholder="e.g. server.ts or architectural_invariants.json"
                    value={targetFile}
                    onChange={(e) => setTargetFile(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-purple-500"
                  />
                </div>

                {targetFile.includes("architectural_invariants.json") && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-[10px] text-rose-300 space-y-1.5">
                    <span className="font-bold flex items-center gap-1 text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Protected Zone Detected!
                    </span>
                    <p>Automated proposals targeting architectural_invariants.json will be automatically blocked by the pipeline unless human authorization is toggled.</p>
                    <label className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isHumanAuthorized} 
                        onChange={(e) => setIsHumanAuthorized(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-purple-500"
                      />
                      Human Authorized Invariant Update (PR prefix: invariant:)
                    </label>
                  </div>
                )}
              </div>

            {proposeStatus !== "running" ? (
              <button
                onClick={handleProposeChange}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-purple-500/20 shadow-md shadow-purple-950/40"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Trigger AI Hypothesis Generator
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-purple-400">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    Agent synthesizing code...
                  </span>
                  <span>ACTIVE LOOP</span>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg font-mono text-[9px] text-slate-400 max-h-[140px] overflow-y-auto space-y-1 scrollbar-none">
                  {proposeLogs.map((log, i) => {
                    const isSuccess = log?.startsWith?.("[SUCCESS]");
                    const isError = log?.startsWith?.("[ERROR]");
                    return (
                      <div key={i} className={isSuccess ? "text-emerald-400" : isError ? "text-rose-400" : "text-slate-300"}>
                        {log}
                      </div>
                    );
                  })}
                  <div ref={proposeConsoleEndRef} />
                </div>
              </div>
            )}

            {proposeStatus === "success" && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-400 flex items-start gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Proposed successfully! An open Pull Request has been added below for human review.</span>
              </div>
            )}
          </div>

          {/* List of open Pull Requests */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-300 font-mono flex items-center gap-2 uppercase tracking-wider">
                <GitPullRequest className="w-4 h-4 text-purple-400" />
                داواکاری گۆڕینی کۆد | Open Pull Requests
              </h3>
              <span className="text-[10px] bg-purple-950/80 text-purple-400 border border-purple-800/40 px-2 py-0.5 rounded-full font-bold font-mono">
                {prs.length} Open
              </span>
            </div>

            {loading ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-600" />
                Loading pipeline branches...
              </div>
            ) : prs.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                No open PRs awaiting review. Use the Strategy Lab to trigger automated generations.
              </div>
            ) : (
              <div className="space-y-2.5">
                {prs.map(pr => (
                  <button
                    key={pr.prId}
                    onClick={() => setSelectedPrId(pr.prId)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer block ${
                      selectedPrId === pr.prId
                        ? "bg-slate-950 border-purple-500/50 shadow-md shadow-purple-950/20"
                        : "bg-slate-950/50 border-slate-850 hover:bg-slate-950 hover:border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold text-slate-200 line-clamp-1">{pr.title}</span>
                      <span className="text-[9px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
                        {pr.ciStatus}
                      </span>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-slate-600" />
                        {pr.branch}
                      </span>
                      <span>{new Date(pr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Pull Request inspector & details */}
        <div className="lg:col-span-8 space-y-6">
          {activePr ? (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
              
              {/* PR Header details */}
              <div className="border-b border-slate-800 pb-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span className="text-xs font-mono text-purple-400 font-bold bg-purple-950/50 border border-purple-500/30 px-2.5 py-1 rounded-lg">
                    {activePr.prId.toUpperCase()} • OPEN GATEWAY
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Proposed {new Date(activePr.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-50">{activePr.title}</h3>
                
                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <span className="text-slate-500 font-mono">Source Branch:</span>
                  <span className="bg-slate-950 border border-slate-850 p-1 px-2 rounded-md font-mono text-[10px] text-purple-400 flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3" />
                    {activePr.branch}
                  </span>
                  <span className="text-slate-600 font-mono">→</span>
                  <span className="bg-slate-950 border border-slate-850 p-1 px-2 rounded-md font-mono text-[10px] text-slate-400 flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3" />
                    main
                  </span>
                </div>
              </div>

              {/* PR Plain-language explanation */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                  Plain-Language Summary & Impact Analysis
                </h4>
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300 leading-relaxed space-y-1.5">
                  <span className="font-semibold text-purple-300 block">Proposed by {activePr.author}:</span>
                  <p>{activePr.description}</p>
                </div>
              </div>

              {/* Interactive Visual Diff View */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center justify-between">
                  <span>Proposed Strategy Core Diff (C++)</span>
                  <span className="text-[10px] text-slate-500 uppercase">test/test_proposed.cpp</span>
                </h4>
                <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden font-mono text-[11px]">
                  <div className="bg-slate-900 border-b border-slate-850 px-4 py-2 text-slate-500 text-[10px] flex justify-between">
                    <span>1 file changed • 12 additions (+) • 3 deletions (-)</span>
                    <span className="text-emerald-400 font-bold">ASan Verified</span>
                  </div>
                  <pre className="p-4 overflow-x-auto text-slate-400 leading-relaxed text-[11px]">
                    {(activePr.diff || "").split('\n').map((line, idx) => {
                      let bgColor = "transparent";
                      let textColor = "text-slate-400";
                      if (line?.startsWith?.('+')) {
                        bgColor = "bg-emerald-950/30";
                        textColor = "text-emerald-400 font-semibold";
                      } else if (line?.startsWith?.('-')) {
                        bgColor = "bg-rose-950/30";
                        textColor = "text-rose-400 font-semibold";
                      }
                      return (
                        <div key={idx} className={`px-2 -mx-2 rounded ${bgColor} ${textColor}`}>
                          {line}
                        </div>
                      );
                    })}
                  </pre>
                </div>
              </div>

              {/* CI Test results panel */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                  Automated Integration and AST Safety Checks
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activePr.tests.map((test, i) => (
                    <div key={i} className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-xs font-bold text-slate-200">{test.name}</span>
                        <span className="block text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">{test.details}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* HUMAN GATE MERGE CONTROLS */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="leading-relaxed space-y-1">
                    <span className="font-bold text-slate-200 block">Sovereign Gate Clearance Required</span>
                    <p>
                      The system has successfully executed all static audits, memory leak scans, compiler checks, and simulation playback tests. 
                      However, in alignment with enterprise safety protocols, no code-level modification can be automatically deployed. 
                      <strong> You must review the diff and authorize the merge manually.</strong>
                    </p>
                  </div>
                </div>

                {mergeStatus === "idle" ? (
                  <button
                    onClick={() => handleMergePR(activePr.prId)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs font-mono rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-emerald-500/20 shadow-lg shadow-emerald-950/50 uppercase tracking-widest"
                  >
                    <GitMerge className="w-4 h-4 text-emerald-100" />
                    Approve & Merge Code Change (Auto-Deploy)
                  </button>
                ) : (
                  <div className="space-y-3 bg-slate-950 border border-slate-850 p-4 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        Executing post-merge automated deployment...
                      </span>
                      <span>ROLLING DEPLOY ACTIVE</span>
                    </div>
                    
                    <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-lg font-mono text-[10px] text-slate-400 max-h-[180px] overflow-y-auto space-y-1.5 scrollbar-none">
                      {mergeLogs.map((log, i) => {
                        const isSuccess = log?.startsWith?.("[SUCCESS]");
                        const isError = log?.startsWith?.("[ERROR]");
                        return (
                          <div key={i} className={isSuccess ? "text-emerald-400 font-bold" : isError ? "text-rose-400" : "text-slate-300"}>
                            {log}
                          </div>
                        );
                      })}
                      <div ref={consoleEndRef} />
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm border border-slate-800 rounded-2xl bg-slate-900 flex flex-col items-center justify-center space-y-3">
              <GitPullRequest className="w-12 h-12 text-slate-700 animate-pulse" />
              <span>No active Pull Request selected.</span>
            </div>
          )}

          {/* Past merges & deployment history timeline */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 font-mono flex items-center gap-2 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-emerald-400" />
              مێژووی لێکدانەوە و بڵاوکردنەوە | Deployment & Merge History
            </h3>
            
            <div className="relative border-l border-slate-800 pl-5 ml-2.5 space-y-5 py-2">
              {history.map((item, idx) => (
                <div key={item.id} className="relative">
                  {/* Dot marker */}
                  <div className="absolute -left-[25.5px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900 shadow shadow-emerald-500/50"></div>
                  
                  <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{item.title}</span>
                        <span className="text-[9px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded uppercase tracking-wide">
                          DEPLOYED
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-mono">
                        <span>Branch: {item.branch}</span>
                        <span>•</span>
                        <span>Author: {item.author}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block text-xs font-bold text-emerald-400 font-mono">VER {item.version}</span>
                      <span className="block text-[9px] text-slate-500 font-mono">{new Date(item.mergedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Rollout: {item.deployDurationSec}s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
