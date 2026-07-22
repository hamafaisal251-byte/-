import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const TS_BACKEND = process.env.TS_BACKEND_URL || 'http://127.0.0.1:3000'; // Default TS backend port
const GO_BACKEND = process.env.GO_BACKEND_URL || 'http://127.0.0.1:3001'; // Default Go backend port
const LOG_FILE = path.join(process.cwd(), 'cutover_discrepancies.log');

function logDiscrepancy(message: string) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}\n`;
  console.log(`⚠️  ${message}`);
  fs.appendFileSync(LOG_FILE, formatted);
}

async function compareEndpoints(endpoint: string, method: string = 'GET', body: any = null) {
  console.log(`\n🔍 Comparing endpoint: ${method} ${endpoint}`);
  
  const headers = { 'Content-Type': 'application/json' };
  const fetchOptions: any = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  let tsData: any = null;
  let goData: any = null;
  let tsStatus = 0;
  let goStatus = 0;

  // 1. Fetch TS
  try {
    const tsRes = await fetch(`${TS_BACKEND}${endpoint}`, fetchOptions);
    tsStatus = tsRes.status;
    tsData = await tsRes.json();
  } catch (err: any) {
    logDiscrepancy(`TS endpoint ${endpoint} failed: ${err.message}`);
  }

  // 2. Fetch Go
  try {
    const goRes = await fetch(`${GO_BACKEND}${endpoint}`, fetchOptions);
    goStatus = goRes.status;
    goData = await goRes.json();
  } catch (err: any) {
    logDiscrepancy(`Go endpoint ${endpoint} failed: ${err.message}`);
  }

  if (tsStatus !== goStatus) {
    logDiscrepancy(`Status code mismatch for ${endpoint}. TS: ${tsStatus}, Go: ${goStatus}`);
    return;
  }

  if (!tsData || !goData) {
    logDiscrepancy(`Could not compare ${endpoint} because one or both backends returned empty/invalid response.`);
    return;
  }

  // Recursive comparison helper
  const compareKeys = (path: string, tsObj: any, goObj: any) => {
    if (typeof tsObj !== typeof goObj) {
      logDiscrepancy(`Type mismatch at ${path}. TS: ${typeof tsObj}, Go: ${typeof goObj}`);
      return;
    }

    if (tsObj && typeof tsObj === 'object') {
      if (Array.isArray(tsObj)) {
        if (!Array.isArray(goObj)) {
          logDiscrepancy(`Array mismatch at ${path}. TS is array, Go is not.`);
          return;
        }
        if (tsObj.length !== goObj.length) {
          logDiscrepancy(`Array length mismatch at ${path}. TS: ${tsObj.length}, Go: ${goObj.length}`);
        }
        // Check structural similarity on elements up to limit
        const limit = Math.min(tsObj.length, goObj.length, 3);
        for (let i = 0; i < limit; i++) {
          compareKeys(`${path}[${i}]`, tsObj[i], goObj[i]);
        }
      } else {
        const tsKeys = Object.keys(tsObj).sort();
        const goKeys = Object.keys(goObj).sort();

        // Check for missing keys in Go
        for (const key of tsKeys) {
          // Ignore highly dynamic/timestamp keys
          if (['timestamp', 'updatedAt', 'updated_at', 'last_transition_time', 'transitionTime', 'pingMs', 'pnl_pips', 'offsetMs'].includes(key)) continue;
          if (!(key in goObj)) {
            // Check camelCase vs snake_case equivalent
            const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (snakeCaseKey in goObj) continue;

            logDiscrepancy(`Go missing key: "${key}" under path "${path}"`);
          }
        }

        // Compare nested structures
        for (const key of tsKeys) {
          if (['timestamp', 'updatedAt', 'updated_at', 'last_transition_time', 'transitionTime', 'pingMs', 'pnl_pips', 'offsetMs'].includes(key)) continue;
          if (key in goObj) {
            compareKeys(`${path}.${key}`, tsObj[key], goObj[key]);
          }
        }
      }
    } else {
      // Direct value comparison (with small float tolerance)
      if (typeof tsObj === 'number' && typeof goObj === 'number') {
        const diff = Math.abs(tsObj - goObj);
        if (diff > 0.0001) {
          logDiscrepancy(`Value mismatch at ${path}. TS: ${tsObj}, Go: ${goObj} (Diff: ${diff})`);
        }
      } else if (tsObj !== goObj) {
        logDiscrepancy(`Value mismatch at ${path}. TS: "${tsObj}", Go: "${goObj}"`);
      }
    }
  };

  compareKeys(endpoint, tsData, goData);
}

async function runSideBySideVerification() {
  console.log('===================================================================');
  console.log('  SOVEREIGN FX TRADING BOT: GO BACKEND SIDE-BY-SIDE VERIFICATION  ');
  console.log('===================================================================');
  console.log(`Logging findings to: ${LOG_FILE}\n`);

  // Clear or prepare log file
  fs.writeFileSync(LOG_FILE, `--- CUTOVER VERIFICATION LOG ${new Date().toISOString()} ---\n`);

  const endpointsToCompare = [
    '/api/health',
    '/api/safety/state',
    '/api/security/info',
    '/api/brokers/connections',
    '/api/strategies/config',
    '/api/calibration/summary',
    '/api/value-discovery/summary',
    '/api/demo-live/runs',
    '/api/demo-live/performance',
    '/api/fix/status',
    '/api/arbitrage/state',
    '/api/risk/portfolio',
    '/api/news/config',
    '/api/news/platforms',
    '/api/news/feed',
    '/api/custom-connectors',
    '/api/drl/ensemble',
    '/api/time-sync/status',
    '/api/pipeline/prs',
    '/api/pipeline/history',
    '/api/system-intelligence/status',
    '/api/system-intelligence/provider-config',
    '/api/system-intelligence/provider-usage',
    '/api/system-intelligence/tool-logs',
    '/api/sovereign-mind/snapshot',
    '/api/sovereign-mind/history',
    '/api/tools/registry',
    '/api/synthesis/dashboard',
    '/api/market_regime/summary',
    '/api/positions',
    '/api/nexus-agent/status',
    '/api/meta-controller/status',
    '/api/dark-pool/weekly',
    '/api/value-discovery/evolution-logs',
    '/api/risk/history',
    '/api/historical_ticks_v2/status',
    '/api/live-training/status',
    '/api/gemini/research/logs',
    '/api/strategies/audit-logs'
  ];

  for (const ep of endpointsToCompare) {
    await compareEndpoints(ep);
  }

  console.log('\n===================================================================');
  console.log('  VERIFICATION SEQUENCE FINISHED. CHECK cutover_discrepancies.log   ');
  console.log('===================================================================');
}

runSideBySideVerification().catch(console.error);
