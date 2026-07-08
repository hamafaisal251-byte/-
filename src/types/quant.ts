/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SystemMetrics {
  nanosecondLatency: number;
  packetsPerSecond: number;
  activeOrdersCount: number;
  cpuCoresUsage: number[];
  shockAbsorberLevel: number; // 0.0 to 1.0 (multiplier/cooldown)
  isShockAbsorberActive: boolean;
  totalPnL: number; // pips
  movingBreakEvenActive: boolean;
  hedgingLocksActive: boolean;
  systemStatus: 'NOMINAL' | 'THROTTLED' | 'HALTED' | 'EMERGENCY_KILL';
  evolutionGeneration: number;
  activeRewardModule: string;
}

export interface TelemetryLog {
  timestamp: string;
  source: 'GO-BACKPLANE' | 'CPP-ENGINE' | 'FPGA-DMA' | 'EVOLUTION-LAB' | 'RISK-MANAGER';
  level: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  message: string;
}

export interface RewardParams {
  pnlPips: number;
  latencyNs: number;
  slippageTicks: number;
  volatilitySpike: number; // 1.0 = baseline, 5.0+ = high flash crash potential
  positionLots: number;
}

export interface EvolutionCandidate {
  id: string;
  name: string;
  creator: 'AGENT_GEN_V2' | 'AGENT_GEN_V3_PATCH' | 'HUMAN_OPERATOR' | 'MALICIOUS_AGENT_MOCK';
  status: 'IDLE' | 'COMPILING' | 'SANDBOX_RUNNING' | 'VALGRIND_CHECKING' | 'PASSED' | 'FAILED';
  code: string;
  failureReason?: string;
  metrics?: {
    avgReward: number;
    maxDrawdown: number;
    avgLatencyNs: number;
    leaksBytes: number;
    astWarningsCount: number;
  };
  researchSources?: { title: string; uri: string }[];
  groundedText?: string;
}

export interface ArchitectureComponent {
  id: string;
  title: string;
  subTitle: string;
  iconName: string;
  description: string;
  technicalDeepDive: string;
  productionCode: string;
  language: 'cpp' | 'go' | 'bash' | 'json';
}
