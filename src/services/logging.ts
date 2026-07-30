export interface TelemetryLog {
  timestamp: string;
  source: "GO-BACKPLANE" | "CPP-ENGINE" | "RISK-MANAGER" | "EVOLUTION-LAB" | "VALUE-DISCOVERY" | "META-CONTROLLER";
  level: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL" | "WARN";
  message: string;
}

function getFormattedTime(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

export let serverLogs: TelemetryLog[] = [
  { timestamp: getFormattedTime(), source: "GO-BACKPLANE", level: "INFO", message: "Sovereign Controller backplane initialized. IPC buffer mapped." },
  { timestamp: getFormattedTime(), source: "CPP-ENGINE", level: "SUCCESS", message: "Execution thread pinned to CPU Core 3. SPSC spin-polling active." },
  { timestamp: getFormattedTime(), source: "RISK-MANAGER", level: "INFO", message: "HSM API dynamic registration checked. DMA authorization granted." },
  { timestamp: getFormattedTime(), source: "EVOLUTION-LAB", level: "SUCCESS", message: "Active Reinforcement learning reward engine bound: AGENT_GEN_V2_OPT" }
];

export function addServerLog(source: TelemetryLog['source'], level: TelemetryLog['level'], message: string) {
  serverLogs.push({ timestamp: getFormattedTime(), source, level, message });
  if (serverLogs.length > 200) {
    serverLogs.shift();
  }
}
