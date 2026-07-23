#!/usr/bin/env node

/**
 * SOVEREIGN NEXUS: ARCHITECTURAL INVARIANTS REGRESSION GUARD
 * File: /scripts/verify_invariants.js
 * Purpose: Evaluates codebase against baseline invariants defined in /architectural_invariants.json.
 *          Fails CI/build if any architectural invariant is violated.
 */

import fs from "fs";
import path from "path";

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

console.log(`${BOLD}${CYAN}=====================================================================`);
console.log(`         SOVEREIGN NEXUS ARCHITECTURAL INVARIANTS REGRESSION GUARD    `);
console.log(`=====================================================================${RESET}`);

const INVARIANTS_FILE = path.join(process.cwd(), "architectural_invariants.json");

if (!fs.existsSync(INVARIANTS_FILE)) {
  console.error(`${BOLD}${RED}[FATAL ERROR] architectural_invariants.json baseline file is missing!${RESET}`);
  process.exit(1);
}

let baselineData;
try {
  baselineData = JSON.parse(fs.readFileSync(INVARIANTS_FILE, "utf8"));
} catch (e) {
  console.error(`${BOLD}${RED}[FATAL ERROR] Failed to parse architectural_invariants.json: ${e.message}${RESET}`);
  process.exit(1);
}

const invariants = baselineData.invariants || [];
let totalCount = invariants.length;
let passedCount = 0;
let violations = [];

console.log(`${BOLD}Loaded ${totalCount} baseline invariants (Version: ${baselineData.version}, Last Updated: ${baselineData.lastUpdated})${RESET}\n`);

for (const inv of invariants) {
  console.log(`${BOLD}${CYAN}[CHECKING] ${inv.id}${RESET}: ${inv.name}`);
  let pass = true;
  let reason = "";

  try {
    if (inv.ruleType === "script_check") {
      const pkgPath = path.join(process.cwd(), inv.file);
      if (!fs.existsSync(pkgPath)) {
        pass = false;
        reason = `File ${inv.file} does not exist.`;
      } else {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        const scripts = pkg.scripts || {};
        for (const pattern of inv.forbiddenPatterns || []) {
          for (const [sName, sVal] of Object.entries(scripts)) {
            if (typeof sVal === "string" && sVal.includes(pattern)) {
              pass = false;
              reason = `Forbidden script pattern '${pattern}' found in script '${sName}': "${sVal}"`;
              break;
            }
          }
        }
      }
    } else if (inv.ruleType === "root_file_blacklist") {
      const rootFiles = fs.readdirSync(process.cwd());
      for (const blacklisted of inv.blacklistedFiles || []) {
        if (rootFiles.includes(blacklisted)) {
          pass = false;
          reason = `Blacklisted file '${blacklisted}' exists in repository root!`;
          break;
        }
      }
    } else if (inv.ruleType === "file_contains") {
      const targetPath = path.join(process.cwd(), inv.file);
      if (!fs.existsSync(targetPath)) {
        pass = false;
        reason = `File ${inv.file} does not exist.`;
      } else {
        const content = fs.readFileSync(targetPath, "utf8");
        for (const reqPattern of inv.requiredPatterns || []) {
          if (!content.includes(reqPattern)) {
            pass = false;
            reason = `Required pattern '${reqPattern}' missing in ${inv.file}.`;
            break;
          }
        }
        if (pass) {
          for (const forbPattern of inv.forbiddenPatterns || []) {
            if (content.includes(forbPattern)) {
              pass = false;
              reason = `Forbidden mock/fake pattern '${forbPattern}' found in ${inv.file}.`;
              break;
            }
          }
        }
      }
    } else if (inv.ruleType === "protected_zones_min_count") {
      const targetPath = path.join(process.cwd(), inv.file);
      if (!fs.existsSync(targetPath)) {
        pass = false;
        reason = `Audit file ${inv.file} does not exist.`;
      } else {
        const content = fs.readFileSync(targetPath, "utf8");
        // Count entries in EXCLUDED_AREAS array
        const matches = content.match(/id:\s*["']([^"']+)["']/g) || [];
        const zoneIds = matches.map(m => m.replace(/id:\s*["']/, "").replace(/["']/, ""));
        
        if (zoneIds.length < inv.minZoneCount) {
          pass = false;
          reason = `Protected zones count (${zoneIds.length}) shrank below baseline threshold (${inv.minZoneCount}).`;
        } else {
          for (const reqZone of inv.requiredZoneIds || []) {
            if (!zoneIds.includes(reqZone)) {
              pass = false;
              reason = `Required protected zone '${reqZone}' missing in ${inv.file}.`;
              break;
            }
          }
        }
      }
    } else if (inv.ruleType === "port_check") {
      const targetPath = path.join(process.cwd(), inv.file);
      if (fs.existsSync(targetPath)) {
        const content = fs.readFileSync(targetPath, "utf8");
        if (/port:\s*(3001|5173)/i.test(content) || /PORT\s*=\s*(3001|5173)/i.test(content)) {
          pass = false;
          reason = `Hardcoded invalid port (3001/5173) detected in ${inv.file}. Must adhere to port 3000 routing.`;
        }
      }
    }
  } catch (err) {
    pass = false;
    reason = `Execution error evaluating invariant: ${err.message}`;
  }

  if (pass) {
    passedCount++;
    console.log(`  └─ ${BOLD}${GREEN}PASSED${RESET}: ${inv.description}\n`);
  } else {
    violations.push({ id: inv.id, name: inv.name, file: inv.file, reason });
    console.log(`  └─ ${BOLD}${RED}FAILED${RESET}: ${reason}\n`);
  }
}

console.log(`${BOLD}${CYAN}=====================================================================`);
console.log(`                   REGRESSION GUARD RESULT                           `);
console.log(`=====================================================================${RESET}`);
console.log(`  - Total Invariants Verified: ${totalCount}`);
console.log(`  - Passed:                    ${BOLD}${GREEN}${passedCount}${RESET}`);
console.log(`  - Violations / Reversions:   ${BOLD}${violations.length > 0 ? RED : GREEN}${violations.length}${RESET}\n`);

if (violations.length > 0) {
  console.error(`${BOLD}${RED}[REGRESSION GUARD FAILED] Architectural invariants breached!${RESET}`);
  violations.forEach(v => {
    console.error(`  - [${v.id}] ${v.name} (${v.file}): ${v.reason}`);
  });
  process.exit(1);
} else {
  console.log(`${BOLD}${GREEN}[REGRESSION GUARD PASSED] All architectural invariants intact and verified.${RESET}\n`);
  process.exit(0);
}
