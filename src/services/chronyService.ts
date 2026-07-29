import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ChronyTrackingData {
  offsetMs: number | null;
  rootDispersionMs: number | null;
  stratum: number | null;
  syncStatus: string;
  rawOutput: string;
}

let lastClockOffsetMs = 0;
let lastChronyData: ChronyTrackingData = {
  offsetMs: null,
  rootDispersionMs: null,
  stratum: null,
  syncStatus: "chrony not available — clock offset unknown",
  rawOutput: ""
};

export async function checkChronyTracking(): Promise<ChronyTrackingData> {
  try {
    const { stdout, stderr } = await execAsync("chronyc tracking");
    const rawOutput = stdout || stderr || "";
    
    let offsetMs: number | null = null;
    let rootDispersionMs: number | null = null;
    let stratum: number | null = null;
    let syncStatus = "synced";

    const stratumMatch = rawOutput.match(/Stratum\s*:\s*(\d+)/i);
    if (stratumMatch) {
      stratum = parseInt(stratumMatch[1], 10);
    }

    const systemTimeMatch = rawOutput.match(/System time\s*:\s*([+-]?\d*(?:\.\d+)?)\s*seconds\s*(slow|fast)\s*of/i);
    const lastOffsetMatch = rawOutput.match(/Last offset\s*:\s*([+-]?\d*(?:\.\d+)?)\s*seconds/i);
    
    if (lastOffsetMatch) {
      const lastOffsetSec = parseFloat(lastOffsetMatch[1]);
      offsetMs = lastOffsetSec * 1000.0;
    } else if (systemTimeMatch) {
      const val = parseFloat(systemTimeMatch[1]);
      const dir = systemTimeMatch[2].toLowerCase();
      const sign = dir === "slow" ? -1.0 : 1.0;
      offsetMs = val * sign * 1000.0;
    }

    const dispersionMatch = rawOutput.match(/Root dispersion\s*:\s*([+-]?\d*(?:\.\d+)?)\s*seconds/i);
    if (dispersionMatch) {
      rootDispersionMs = parseFloat(dispersionMatch[1]) * 1000.0;
    }

    const leapStatusMatch = rawOutput.match(/Leap status\s*:\s*([^\n\r]+)/i);
    let leapStatus = leapStatusMatch ? leapStatusMatch[1].trim() : "Normal";
    if (leapStatus.toLowerCase().includes("not synchronised")) {
      syncStatus = "not synchronised";
    } else {
      syncStatus = `synced (stratum ${stratum || "?"}, leap: ${leapStatus})`;
    }

    if (offsetMs !== null) {
      lastClockOffsetMs = offsetMs;
    } else {
      lastClockOffsetMs = 0;
    }

    lastChronyData = {
      offsetMs,
      rootDispersionMs,
      stratum,
      syncStatus,
      rawOutput
    };

    return lastChronyData;
  } catch (err: any) {
    lastClockOffsetMs = 0;
    lastChronyData = {
      offsetMs: null,
      rootDispersionMs: null,
      stratum: null,
      syncStatus: "chrony not available — clock offset unknown",
      rawOutput: err.message || "Failed to execute chronyc tracking"
    };
    return lastChronyData;
  }
}

export function getSyncedTime(): number {
  return Date.now() + (lastClockOffsetMs || 0);
}

export function getLastChronyData(): ChronyTrackingData {
  return lastChronyData;
}
