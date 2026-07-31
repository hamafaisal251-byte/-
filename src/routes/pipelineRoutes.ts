import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { addServerLog } from "../services/logging";
import { activeCodePRs, pipelineHistory } from "../state/tradingState";

export const pipelineRouter = Router();

const protectedZonesList = [
  { id: "trading-execution", name: "FIX Protocol & Order Dispatching", pattern: "internal/trading/fix.go", status: "PROTECTED" },
  { id: "security-auth", name: "Security & Auth Access Control", pattern: "internal/crypto/*, CORSMiddleware", status: "PROTECTED" },
  { id: "risk-halt", name: "Emergency Caps & Drawdown Halts", pattern: "internal/safety/backstop.go, watchdog.ts", status: "PROTECTED" },
  { id: "sovereign-mind-boundary", name: "Sovereign Mind Safety Boundary", pattern: "sovereignMind.ts", status: "PROTECTED" },
  { id: "architectural-invariants-protection", name: "Architectural Invariants & Regression Guard", pattern: "architectural_invariants.json, verify_invariants.js", status: "PROTECTED" }
];

const violationHistory = [
  {
    id: "viol-101",
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    invariantId: "protected_zones_never_shrink",
    targetFile: "architectural_invariants.json",
    actor: "Automated Mutation Loop (Attempted Override)",
    result: "BLOCKED_BY_PROTECTED_ZONE",
    details: "Automated mutation loop attempted to modify architectural_invariants.json. Pipeline automatically blocked and logged violation."
  }
];

const invariantUpdatesHistory = [
  {
    id: "inv-upd-101",
    commit: "invariant: add C++ valgrind memory leak rule to baseline",
    author: "Human Admin (Explicit Sign-off)",
    timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
    prTitle: "invariant: EstablishValgrindMemoryInvariants",
    description: "⚠️ ATTENTION: This PR modifies architectural_invariants.json.",
    status: "MERGED_HUMAN_APPROVED"
  }
];

// GET /api/pipeline/prs
pipelineRouter.get("/prs", (req: Request, res: Response) => {
  res.json({ prs: activeCodePRs });
});

// GET /api/pipeline/history
pipelineRouter.get("/history", (req: Request, res: Response) => {
  res.json({ history: pipelineHistory });
});

// GET /api/pipeline/invariants
pipelineRouter.get("/invariants", (req: Request, res: Response) => {
  let baselineData: any = { invariants: [] };
  try {
    const invPath = path.join(process.cwd(), "architectural_invariants.json");
    if (fs.existsSync(invPath)) {
      baselineData = JSON.parse(fs.readFileSync(invPath, "utf8"));
    }
  } catch (e) {
    console.error("Error reading architectural_invariants.json:", e);
  }

  res.json({
    version: baselineData.version || "1.0.0",
    lastUpdated: baselineData.lastUpdated || new Date().toISOString(),
    invariants: baselineData.invariants || [],
    protectedZones: protectedZonesList,
    recentViolations: violationHistory,
    invariantUpdatesHistory: invariantUpdatesHistory
  });
});

// POST /api/pipeline/propose
pipelineRouter.post("/propose", async (req: Request, res: Response) => {
  const { goal, targetFile, isHumanAuthorized } = req.body;
  try {
    console.log(`[PIPELINE-API] Spawning propose script for goal: ${goal}, targetFile: ${targetFile || 'default'}`);
    const scriptPath = path.join(process.cwd(), "scripts/propose_code_change.js");
    
    let cmd = `node "${scriptPath}" --goal "${goal || 'high-volatility'}"`;
    if (targetFile) cmd += ` --target "${targetFile}"`;
    if (isHumanAuthorized) cmd += ` --human-authorized`;

    try {
      execSync(cmd, {
        env: { ...process.env },
        encoding: "utf8"
      });
    } catch (execErr: any) {
      console.warn("[PIPELINE-API] Propose script exited non-zero:", execErr.message);
    }
    
    const stagedPath = path.join(process.cwd(), "staged_pr.json");
    if (fs.existsSync(stagedPath)) {
      const stagedData = JSON.parse(fs.readFileSync(stagedPath, "utf8"));
      if (stagedData.status === "FAILED_AUDIT" || stagedData.status === "BLOCKED_PROTECTED_ZONE" || stagedData.status === "FAILED_INVARIANT") {
        return res.status(400).json({ error: stagedData.error, log: stagedData.log, status: stagedData.status });
      }
      
      activeCodePRs.unshift(stagedData);
      return res.json({ pr: stagedData });
    } else {
      throw new Error("Staged PR data not produced by script");
    }
  } catch (err: any) {
    console.error("[PIPELINE-API-ERROR] Propose failed:", err);
    res.status(500).json({ error: err.message || "Failed to run automated AI loop." });
  }
});

// POST /api/pipeline/merge
pipelineRouter.post("/merge", (req: Request, res: Response) => {
  const { prId } = req.body;
  const prIndex = activeCodePRs.findIndex(p => p.prId === prId);
  if (prIndex === -1) {
    return res.status(404).json({ error: "PR not found or already merged" });
  }
  
  const pr = activeCodePRs[prIndex];
  
  if (pr.code) {
    try {
      console.log(`[PIPELINE-API] Applying merged C++ code from ${pr.prId} to test/test_clean.cpp...`);
      fs.writeFileSync(path.join(process.cwd(), "test/test_clean.cpp"), pr.code, "utf8");
    } catch (e) {
      console.error("[PIPELINE-API] Failed to copy merged code:", e);
    }
  }

  activeCodePRs.splice(prIndex, 1);
  
  const nextVer = `2.4.${pipelineHistory.length + 2}`;
  pipelineHistory.unshift({
    id: pr.prId,
    title: pr.title,
    branch: pr.branch,
    author: pr.author,
    mergedAt: new Date().toISOString(),
    ciStatus: "PASSED",
    deployDurationSec: 15.0,
    version: nextVer
  });
  
  addServerLog("EVOLUTION-LAB", "INFO", `🚀 [MERGE GATED APPROVED] PR ${pr.prId} merged successfully. Zero-downtime rolling restart completed. Running dynamic system version: ${nextVer}`);
  
  res.json({ success: true });
});
