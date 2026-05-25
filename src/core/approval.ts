import * as readline from 'node:readline';
import chalk from 'chalk';
import type { SafetyLevel, AutonomyMode, ApprovalVerdict } from './types.js';
import { getModeConfig } from './modes.js';

const dangerousPatterns = [
  /^rm\s+-rf\s+(\/|\/\w+|\.)/,
  /^sudo\s+/,
  /^chmod\s+777/,
  /^dd\s+/,
  /^mkfs/,
  /^fdisk/,
  /^>\/dev/,
  /^:\(\)\s*{/,
  /^wget\s+.*\||^curl\s+.*\|/,
  /^eval\s+/,
  /^exec\s+/,
];

const warningPatterns = [
  /^rm\s+/,
  /^chmod\s+/,
  /^chown\s+/,
  /^mv\s+/,
  /^cp\s+/,
  /^kill\s+/,
  /^pkill\s+/,
  /^systemctl/,
  /^service/,
  /^apt\s+(install|remove|purge)/,
  /^npm\s+(install|uninstall|publish)/,
  /^pip\s+(install|uninstall)/,
  /^docker\s+(rm|rmi|kill|stop)/,
  /^git\s+push/,
  /^git\s+reset/,
  /^git\s+revert/,
  /^git\s+merge/,
  /^git\s+rebase/,
  /^gh\s+/,
];

export function classifyCommand(command: string): SafetyLevel {
  const trimmed = command.trim();
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) return 'dangerous';
  }
  for (const pattern of warningPatterns) {
    if (pattern.test(trimmed)) return 'warning';
  }
  return 'safe';
}

export function classifyTool(toolName: string, args?: Record<string, string>): SafetyLevel {
  if (toolName === 'execute_command' && args?.command) {
    return classifyCommand(args.command);
  }
  const safeTools = new Set(['read_file', 'grep_search', 'glob_search', 'list_dir', 'get_cwd']);
  const warningTools = new Set(['write_file', 'edit_file', 'create_file', 'append_file']);
  const dangerousTools = new Set(['delete_file', 'delete_dir', 'overwrite_dir']);

  if (safeTools.has(toolName)) return 'safe';
  if (dangerousTools.has(toolName)) return 'dangerous';
  if (warningTools.has(toolName)) return 'warning';

  return 'warning';
}

function askApproval(description: string, toolName: string, level: SafetyLevel): Promise<boolean> {
  return new Promise((resolve) => {
    const label = level === 'dangerous'
      ? chalk.bgRed.white(' DANGEROUS ')
      : chalk.bgYellow.black(' WARNING ');

    console.log(`\n  ${label} ${chalk.dim(toolName)}: ${description}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(chalk.dim('  Allow? (y/N): '), (answer) => {
      rl.close();
      const allowed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      if (allowed) {
        console.log(chalk.green('  ✓ Approved\n'));
      } else {
        console.log(chalk.yellow('  ✗ Skipped\n'));
      }
      resolve(allowed);
    });
  });
}

export async function getApproval(
  mode: AutonomyMode,
  toolName: string,
  description: string,
  args?: Record<string, string>,
): Promise<ApprovalVerdict> {
  const level = classifyTool(toolName, args);
  const config = getModeConfig(mode);

  if (level === 'dangerous') {
    if (mode === 'yolo') {
      console.log(chalk.bgRed.white(`  ${toolName}: ${description}`));
      if (!config.autoApproveWarning) {
        const allowed = await askApproval(description, toolName, level);
        return { allowed, reason: allowed ? 'approved by user' : 'blocked by user' };
      }
      return { allowed: true, reason: 'yolo mode' };
    }
    console.log(chalk.bgRed.white(`  BLOCKED: ${toolName} - ${description}`));
    console.log(chalk.dim('  This action is classified as dangerous.\n'));
    return { allowed: false, reason: 'dangerous action blocked' };
  }

  if (level === 'warning') {
    if (config.autoApproveWarning) {
      console.log(chalk.green(`  ✓ ${toolName}: ${chalk.dim(description)}`));
      return { allowed: true, reason: `${mode} mode auto-approve` };
    }
    const allowed = await askApproval(description, toolName, level);
    return { allowed, reason: allowed ? 'approved by user' : 'skipped by user' };
  }

  if (config.autoApproveSafe) {
    return { allowed: true, reason: `${mode} mode auto-approve` };
  }

  const allowed = await askApproval(description, toolName, level);
  return { allowed, reason: allowed ? 'approved by user' : 'skipped by user' };
}
