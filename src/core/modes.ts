import chalk from 'chalk';
import type { AutonomyMode, AgentContext } from './types.js';

export interface ModeConfig {
  label: string;
  icon: string;
  description: string;
  color: (text: string) => string;
  autoApproveSafe: boolean;
  autoApproveWarning: boolean;
  maxRetries: number;
  maxSteps: number;
}

const modeConfigs: Record<AutonomyMode, ModeConfig> = {
  assist: {
    label: 'Assist',
    icon: '🎯',
    description: 'User controls every step — you approve each action before execution',
    color: (t: string) => chalk.blue(t),
    autoApproveSafe: false,
    autoApproveWarning: false,
    maxRetries: 1,
    maxSteps: 15,
  },
  smart: {
    label: 'Smart',
    icon: '🧠',
    description: 'Semi-autonomous — safe actions run auto, warnings ask approval, dangerous blocked',
    color: (t: string) => chalk.yellow(t),
    autoApproveSafe: true,
    autoApproveWarning: false,
    maxRetries: 3,
    maxSteps: 30,
  },
  yolo: {
    label: 'YOLO',
    icon: '🚀',
    description: 'Full autonomy — all actions execute without user intervention',
    color: (t: string) => chalk.magenta(t),
    autoApproveSafe: true,
    autoApproveWarning: true,
    maxRetries: 5,
    maxSteps: 50,
  },
};

export function getModeConfig(mode: AutonomyMode): ModeConfig {
  return modeConfigs[mode];
}

export function renderModeHeader(mode: AutonomyMode): string {
  const cfg = modeConfigs[mode];
  const raw = `${chalk.bold(cfg.color(` ${cfg.icon} ${cfg.label} Mode `))}`;
  return raw;
}

export function createContext(mode: AutonomyMode, workingDir: string): AgentContext {
  const cfg = modeConfigs[mode];
  return {
    mode,
    workingDir,
    maxRetries: cfg.maxRetries,
    maxSteps: cfg.maxSteps,
  };
}

export function listModes(): string {
  return Object.entries(modeConfigs)
    .map(([, cfg]) => `  ${cfg.color(`${cfg.icon} ${cfg.label}`.padEnd(15))} ${chalk.dim(cfg.description)}`)
    .join('\n');
}
