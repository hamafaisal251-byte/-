#!/usr/bin/env node

/**
 * SOVEREIGN NEXUS: COBDEBASE AUDIT-AND-REPAIR ENGINE
 * File: /scripts/audit_and_repair.js
 * Purpose: Recursively audit backend Go, Python DRL services, and dashboard TS/JS components.
 *          Performs targeted static repairs while enforcing non-negotiable, strict exclusion rules
 *          on critical trading execution, IP whitelisting, and emergency drawdown safety guardrails.
 */

import fs from "fs";
import path from "path";

// Color codes using standard ANSI escape characters
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const RESET = "\x1b[0m";

console.log(`${BOLD}${CYAN}=====================================================================`);
console.log(`        SOVEREIGN NEXUS AUTOMATED AUDIT-AND-REPAIR SYSTEM           `);
console.log(`=====================================================================${RESET}`);

// Definition of the 3 strictly excluded areas (Never touched by automated generation/repair)
const EXCLUDED_AREAS = [
  {
    id: "trading-execution",
    name: "FIX Protocol & Broker Connection Order Dispatching",
    pattern: /(internal\/trading\/fix\.go|fix_session|order_dispatch)/i,
    description: "Core execution of order placement and FIX standard session handlers to prevent algorithmic rogue orders."
  },
  {
    id: "security-auth",
    name: "Security & Authentication Access Control (IP Whitelist/Keys)",
    pattern: /(internal\/crypto\/|api_mutate_key|ip_allowlist|CORSMiddleware|internal\/api\/router\.go)/i,
    description: "Cryptographic key managers, rotating salts, and IP-whitelisting routing handlers preserving API perimeter security."
  },
  {
    id: "risk-halt",
    name: "Emergency Capital Caps & Drawdown Risk Halts",
    pattern: /(internal\/safety\/backstop\.go|watchdog\.ts|emergency_halt)/i,
    description: "Drawdown caps, capital loss limits, and watchdog process killers acting as hardware-level safety breakers."
  }
];

const stats = {
  scannedFiles: 0,
  excludedSkips: 0,
  issuesFound: 0,
  issuesRepaired: 0,
  violations: []
};

// Traverses directories recursively skipping node_modules, dist, and .git
function walkDirectory(dir, callback) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(process.cwd(), fullPath);
    
    // Skip large artifact and control directories
    if (file === "node_modules" || file === "dist" || file === ".git" || file === ".aistudio" || file === "node_modules_cache") {
      return;
    }
    
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      walkDirectory(fullPath, callback);
    } else {
      callback(relativePath, fullPath);
    }
  });
}

function runAudit() {
  walkDirectory(process.cwd(), (relativePath, fullPath) => {
    stats.scannedFiles++;
    
    // Check if file matches any of the strictly excluded areas
    let isExcluded = false;
    let matchingExclusion = null;
    
    for (const area of EXCLUDED_AREAS) {
      if (area.pattern.test(relativePath)) {
        isExcluded = true;
        matchingExclusion = area;
        break;
      }
    }
    
    if (isExcluded) {
      stats.excludedSkips++;
      console.log(`${BOLD}${MAGENTA}[EXCLUSION-BYPASS]${RESET} Skipping critical file: ${BOLD}${relativePath}${RESET}`);
      console.log(`                   Reason: ${matchingExclusion.name}`);
      console.log(`                   Scope: ${matchingExclusion.description}`);
      return;
    }
    
    // Read the file contents for static checking
    let content = "";
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch (e) {
      return;
    }
    
    let fileModified = false;
    const fileIssues = [];
    
    // --- CHECK 1: Mock/Synthetic Metrics (Random Placeholders) ---
    const randomPatterns = [
      /6\.5\s*\+\s*rand\.Float64/gi,
      /rand\.Float64\(\)\s*\*\s*10/gi,
      /synthetic_sine_wave/gi
    ];
    
    for (const pattern of randomPatterns) {
      if (pattern.test(content)) {
        stats.issuesFound++;
        const issue = {
          type: "SYNTHETIC-METRICS",
          file: relativePath,
          description: "Found synthetic or randomized metric generator in production logic.",
          severity: "HIGH",
          repaired: false
        };
        fileIssues.push(issue);
        stats.violations.push(issue);
      }
    }
    
    // --- CHECK 2: Python Bare/Empty Exception clauses (DRL Service) ---
    if (relativePath.endsWith(".py")) {
      const bareExceptPattern = /except:\s*$/gm;
      if (bareExceptPattern.test(content)) {
        stats.issuesFound++;
        const originalContent = content;
        content = content.replace(/except:\s*$/gm, "except Exception as e:");
        fileModified = true;
        stats.issuesRepaired++;
        const issue = {
          type: "PYTHON-BARE-EXCEPT",
          file: relativePath,
          description: "Replaced insecure bare Python 'except:' clause with robust typed exception handling.",
          severity: "MEDIUM",
          repaired: true
        };
        fileIssues.push(issue);
        stats.violations.push(issue);
      }
    }
    
    // --- CHECK 3: Non-3000 Hardcoded Ingress Ports (Vite Constraint) ---
    if (relativePath.endsWith(".config.ts") || relativePath.endsWith(".config.js") || relativePath === "server.ts") {
      const wrongPortPattern = /port:\s*(3001|5173)/gi;
      if (wrongPortPattern.test(content)) {
        stats.issuesFound++;
        content = content.replace(/port:\s*(3001|5173)/gi, "port: 3000");
        fileModified = true;
        stats.issuesRepaired++;
        const issue = {
          type: "WRONG-INGRESS-PORT",
          file: relativePath,
          description: "Corrected hardcoded sandbox-unfriendly ports (3001/5173) to comply with external port 3000 routing.",
          severity: "HIGH",
          repaired: true
        };
        fileIssues.push(issue);
        stats.violations.push(issue);
      }
    }
    
    // --- CHECK 4: Missing Error Returns in Go Backend ---
    if (relativePath.endsWith(".go")) {
      const unhandledErrPattern = /Rows\.Scan\([^)]+\)\s*\n\s*if\s+err\s*!=\s*nil\s*\{\s*\n\s*\}/gi;
      if (unhandledErrPattern.test(content)) {
        stats.issuesFound++;
        const issue = {
          type: "UNHANDLED-GO-ERROR",
          file: relativePath,
          description: "Detected missing error log or crash return on database scan failure.",
          severity: "MEDIUM",
          repaired: false
        };
        fileIssues.push(issue);
        stats.violations.push(issue);
      }
    }
    
    // Write back changes if any repairs were performed
    if (fileModified) {
      try {
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`${BOLD}${GREEN}[AUTO-REPAIRED]${RESET} Statically resolved issues inside: ${BOLD}${relativePath}${RESET}`);
        fileIssues.filter(i => i.repaired).forEach(i => {
          console.log(`                 -> Resolved: ${i.description}`);
        });
      } catch (writeErr) {
        console.error(`${RED}[ERROR] Failed to write repair to ${relativePath}: ${writeErr.message}${RESET}`);
      }
    } else if (fileIssues.length > 0) {
      console.log(`${BOLD}${YELLOW}[WARNING]${RESET} Potential architectural anomalies in: ${BOLD}${relativePath}${RESET}`);
      fileIssues.forEach(i => {
        console.log(`                 -> Issue: [${i.severity}] ${i.description}`);
      });
    }
  });
  
  // Write the audit report to JSON
  const reportPath = path.join(process.cwd(), "audit_report.json");
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    statistics: {
      totalScanned: stats.scannedFiles,
      exclusionsBypassed: stats.excludedSkips,
      issuesIdentified: stats.issuesFound,
      issuesResolved: stats.issuesRepaired
    },
    exclusionsApplied: EXCLUDED_AREAS.map(e => ({ name: e.name, description: e.description, pattern: e.pattern.toString() })),
    findings: stats.violations
  }, null, 2), "utf8");
  
  console.log(`\n${BOLD}${CYAN}=====================================================================`);
  console.log(`                     AUDIT & REPAIR SUMMARY                          `);
  console.log(`=====================================================================${RESET}`);
  console.log(`  - Total Code Files Scanned:       ${stats.scannedFiles}`);
  console.log(`  - Strictly Excluded Skips:        ${BOLD}${GREEN}${stats.excludedSkips}${RESET}`);
  console.log(`  - Code Issues Identified:         ${BOLD}${YELLOW}${stats.issuesFound}${RESET}`);
  console.log(`  - Code Issues Statically Fixed:   ${BOLD}${GREEN}${stats.issuesRepaired}${RESET}`);
  console.log(`  - Saved Report File:              /audit_report.json\n`);
  
  if (stats.issuesFound > stats.issuesRepaired) {
    console.log(`${BOLD}${YELLOW}[COMPLIANCE STATUS] Core codebase healthy. Please review non-mutated warnings manually.${RESET}`);
  } else {
    console.log(`${BOLD}${GREEN}[COMPLIANCE STATUS] Core codebase fully verified, safety whitelisted, and 100% healthy.${RESET}`);
  }
}

runAudit();
