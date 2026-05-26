import chalk from 'chalk';

export interface SandboxProfile {
  name: string;
  allowNetwork: boolean;
  allowFileRead: boolean;
  allowFileWrite: boolean;
  allowProcessSpawn: boolean;
  allowEnvironmentAccess: boolean;
  maxCpuTime: number;
  maxMemoryMb: number;
  allowedPaths: string[];
  blockedPaths: string[];
  allowedEnvVars: string[];
}

export interface SandboxRule {
  id: string;
  description: string;
  active: boolean;
  check: (command: string, cwd: string) => { allowed: boolean; reason?: string };
}

const PROFILES: Record<string, SandboxProfile> = {
  isolated: {
    name: 'isolated',
    allowNetwork: false,
    allowFileRead: true,
    allowFileWrite: false,
    allowProcessSpawn: false,
    allowEnvironmentAccess: false,
    maxCpuTime: 5000,
    maxMemoryMb: 256,
    allowedPaths: [],
    blockedPaths: [],
    allowedEnvVars: ['PATH', 'HOME', 'USER'],
  },
  restricted: {
    name: 'restricted',
    allowNetwork: false,
    allowFileRead: true,
    allowFileWrite: true,
    allowProcessSpawn: true,
    allowEnvironmentAccess: false,
    maxCpuTime: 30000,
    maxMemoryMb: 512,
    allowedPaths: [],
    blockedPaths: ['/etc', '/usr', '/bin', '/sbin', '/dev', '/proc', '/sys', '/root'],
    allowedEnvVars: ['PATH', 'HOME', 'USER', 'PWD', 'SHELL'],
  },
  standard: {
    name: 'standard',
    allowNetwork: true,
    allowFileRead: true,
    allowFileWrite: true,
    allowProcessSpawn: true,
    allowEnvironmentAccess: true,
    maxCpuTime: 300000,
    maxMemoryMb: 2048,
    allowedPaths: [],
    blockedPaths: [],
    allowedEnvVars: [],
  },
  permissive: {
    name: 'permissive',
    allowNetwork: true,
    allowFileRead: true,
    allowFileWrite: true,
    allowProcessSpawn: true,
    allowEnvironmentAccess: true,
    maxCpuTime: 600000,
    maxMemoryMb: 8192,
    allowedPaths: [],
    blockedPaths: [],
    allowedEnvVars: [],
  },
};

const BLOCKED_COMMANDS: SandboxRule[] = [
  {
    id: 'no-crypto-mining',
    description: 'Block cryptocurrency mining commands',
    active: true,
    check: (cmd: string) => {
      const miningPatterns = [/^minerd/, /^cpuminer/, /^xmrig/, /^ethminer/, /^claymore/, /^ccminer/];
      for (const p of miningPatterns) {
        if (p.test(cmd)) return { allowed: false, reason: 'Cryptocurrency mining blocked' };
      }
      return { allowed: true };
    },
  },
  {
    id: 'no-exfiltration',
    description: 'Block network data exfiltration',
    active: true,
    check: (cmd: string) => {
      const exfilPatterns = [/^nc\s+/, /^netcat\s+/, /^ncat\s+/, /^telnet\s+/];
      for (const p of exfilPatterns) {
        if (p.test(cmd)) return { allowed: false, reason: 'Network exfiltration tool blocked' };
      }
      return { allowed: true };
    },
  },
  {
    id: 'no-bruteforce',
    description: 'Block brute-force and scanning tools',
    active: true,
    check: (cmd: string) => {
      const scanPatterns = [/^nmap/, /^masscan/, /^hydra/, /^john/, /^hashcat/, /^aircrack/, /^sqlmap/, /^nikto/];
      for (const p of scanPatterns) {
        if (p.test(cmd)) return { allowed: false, reason: 'Security scanning tool blocked' };
      }
      return { allowed: true };
    },
  },
  {
    id: 'no-package-manager-mod',
    description: 'Block package manager modifications',
    active: false,
    check: (_cmd: string) => {
      return { allowed: true };
    },
  },
];

export function getProfile(name: string): SandboxProfile {
  return PROFILES[name] || PROFILES.standard;
}

export function listProfiles(): SandboxProfile[] {
  return Object.values(PROFILES);
}

export function checkCommand(command: string, cwd: string, profileName?: string): { allowed: boolean; reason?: string } {
  const profile = getProfile(profileName || 'standard');

  if (!profile.allowNetwork) {
    const networkCmds = [/^curl\s+/, /^wget\s+/, /^nc\s+/, /^ssh\s+/, /^scp\s+/, /^rsync\s+/, /^git\s+(clone|fetch|pull|push)/, /^npm\s+(install|publish)/, /^pip\s+install/];
    for (const p of networkCmds) {
      if (p.test(command)) return { allowed: false, reason: `Network access blocked by "${profile.name}" profile` };
    }
  }

  if (!profile.allowFileWrite) {
    const writeCmds = [/^>/, /^>>/, /^tee/, /^touch\s+/, /^mkdir\s+/, /^cp\s+/, /^mv\s+/];
    for (const p of writeCmds) {
      if (p.test(command)) return { allowed: false, reason: `File write blocked by "${profile.name}" profile` };
    }
  }

  for (const rule of BLOCKED_COMMANDS) {
    if (!rule.active) continue;
    const result = rule.check(command, cwd);
    if (!result.allowed) return result;
  }

  return { allowed: true };
}

export function formatProfile(profile: SandboxProfile): string {
  const yes = chalk.green('✓');
  const no = chalk.red('✗');
  return [
    `${chalk.bold(profile.name.toUpperCase())}`,
    `  Network:      ${profile.allowNetwork ? yes : no}`,
    `  File Read:    ${profile.allowFileRead ? yes : no}`,
    `  File Write:   ${profile.allowFileWrite ? yes : no}`,
    `  Process:      ${profile.allowProcessSpawn ? yes : no}`,
    `  Environment:  ${profile.allowEnvironmentAccess ? yes : no}`,
    `  CPU Time:     ${profile.maxCpuTime}ms`,
    `  Memory:       ${profile.maxMemoryMb}MB`,
  ].join('\n');
}
