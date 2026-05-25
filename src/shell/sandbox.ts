import chalk from 'chalk';

export interface SandboxPolicy {
  allowCommands: RegExp[];
  blockCommands: RegExp[];
  allowNetwork: boolean;
  allowFileWrite: boolean;
  maxProcessTime: number;
  allowedPrefixes: string[];
}

const SAFE_PREFIXES = [
  'npm', 'node', 'npx', 'yarn', 'pnpm', 'bun',
  'python', 'python3', 'pip', 'pip3',
  'go', 'cargo', 'rustc',
  'tsc', 'eslint', 'prettier',
  'git', 'ls', 'cat', 'head', 'tail', 'wc', 'sort', 'uniq',
  'echo', 'printf', 'grep', 'rg', 'ag', 'ack',
  'find', 'tree', 'pwd', 'which', 'whoami',
  'curl', 'wget',
  'mkdir', 'touch', 'cp', 'mv',
  'docker', 'docker-compose',
  'make', 'cmake',
  'jq', 'yq',
  'diff', 'patch',
  'test', '[',
];

const DEFAULT_BLOCKED: RegExp[] = [
  /^rm\s+-rf\s+(\/|\/\w+)/,
  /^sudo\s+/,
  /^su\s+/,
  /^chmod\s+777/,
  /^dd\s+/,
  /^mkfs/,
  /^fdisk/,
  /^:\(\)/,
  /^eval\s+/,
  /^exec\s+/,
  /^kill\s+-9/,
  /^>\/dev\/sda/,
];

const DEFAULT_ALLOWED: RegExp[] = [
  /^npm\s+(install|run|test|build|start|add|remove|update)/,
  /^node\s+/,
  /^npx\s+/,
  /^yarn\s+/,
  /^python3?\s+/,
  /^pip3?\s+(install|list|show)/,
  /^go\s+(build|run|test|mod|fmt)/,
  /^cargo\s+(build|run|test|check|add)/,
  /^rustc\s+/,
  /^tsc\s*/,
  /^eslint\s+/,
  /^prettier\s+/,
  /^git\s+(status|log|diff|show|add|commit|push|pull|branch|checkout|stash|init|clone)/,
  /^ls\s*/,
  /^cat\s+/,
  /^head\s+/,
  /^tail\s+/,
  /^grep\s+/,
  /^rg\s+/,
  /^find\s+/,
  /^echo\s+/,
  /^printf\s+/,
  /^pwd\s*/,
  /^which\s+/,
  /^mkdir\s+/,
  /^touch\s+/,
  /^cp\s+/,
  /^mv\s+/,
  /^rm\s+(?!-rf\s+\/)/,
  /^diff\s+/,
  /^jq\s+/,
  /^make\s+/,
  /^docker\s+(ps|images|build|run|compose)/,
  /^curl\s+/,
  /^wget\s+/,
];

export function createDefaultPolicy(): SandboxPolicy {
  return {
    allowCommands: DEFAULT_ALLOWED,
    blockCommands: DEFAULT_BLOCKED,
    allowNetwork: true,
    allowFileWrite: true,
    maxProcessTime: 300000,
    allowedPrefixes: SAFE_PREFIXES,
  };
}

export interface SandboxVerdict {
  allowed: boolean;
  reason: string;
  risk: 'safe' | 'low' | 'medium' | 'high' | 'blocked';
}

export function evaluateCommand(command: string, policy?: SandboxPolicy): SandboxVerdict {
  const p = policy || createDefaultPolicy();
  const trimmed = command.trim();

  for (const block of p.blockCommands) {
    if (block.test(trimmed)) {
      return {
        allowed: false,
        reason: `Command matches blocked pattern: ${block}`,
        risk: 'blocked',
      };
    }
  }

  for (const allow of p.allowCommands) {
    if (allow.test(trimmed)) {
      return {
        allowed: true,
        reason: 'Command matches allowed pattern',
        risk: 'safe',
      };
    }
  }

  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (p.allowedPrefixes.includes(firstWord)) {
    return {
      allowed: true,
      reason: `Command prefix "${firstWord}" is in safe list`,
      risk: 'low',
    };
  }

  return {
    allowed: false,
    reason: `Command "${trimmed.slice(0, 50)}..." is not in the allowed list`,
    risk: 'blocked',
  };
}

export function printSandboxVerdict(verdict: SandboxVerdict): string {
  const labels: Record<string, string> = {
    safe: chalk.green('SAFE'),
    low: chalk.cyan('LOW RISK'),
    medium: chalk.yellow('MEDIUM RISK'),
    high: chalk.red('HIGH RISK'),
    blocked: chalk.bgRed.white(' BLOCKED '),
  };

  return `  ${labels[verdict.risk] || chalk.dim('UNKNOWN')} ${chalk.dim(verdict.reason)}`;
}
