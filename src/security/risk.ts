import chalk from 'chalk';

export interface RiskScore {
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  score: number;
  reasons: string[];
  suggestedAction: 'auto' | 'confirm' | 'block';
}

const COMMAND_RULES: Array<{ pattern: RegExp; score: number; reason: string }> = [
  { pattern: /^rm\s+-rf\s+(\/|\/\w+|\.)/, score: 100, reason: 'Destructive recursive delete' },
  { pattern: /^rm\s+-rf/, score: 80, reason: 'Recursive force delete' },
  { pattern: /^rm\s+/, score: 30, reason: 'File deletion' },
  { pattern: /^sudo\s+/, score: 85, reason: 'Superuser execution' },
  { pattern: /^su\s+/, score: 80, reason: 'Switch user' },
  { pattern: /^chmod\s+777/, score: 90, reason: 'World-writable permissions' },
  { pattern: /^chmod\s+/, score: 40, reason: 'Permission change' },
  { pattern: /^chown\s+/, score: 50, reason: 'Ownership change' },
  { pattern: /^dd\s+/, score: 95, reason: 'Low-level disk operation' },
  { pattern: /^mkfs/, score: 95, reason: 'Filesystem creation' },
  { pattern: /^fdisk/, score: 95, reason: 'Disk partitioning' },
  { pattern: /^:\(\)/, score: 100, reason: 'Shellshock/fork bomb' },
  { pattern: /^eval\s+/, score: 85, reason: 'Dynamic code evaluation' },
  { pattern: /^exec\s+/, score: 80, reason: 'Process replacement' },
  { pattern: /^kill\s+-9/, score: 70, reason: 'Force kill process' },
  { pattern: /^kill\s+/, score: 40, reason: 'Signal process' },
  { pattern: /^pkill\s+/, score: 45, reason: 'Kill by name' },
  { pattern: /^>\/dev/, score: 90, reason: 'Raw device write' },
  { pattern: /^wget\s+.*\||^curl\s+.*\|/, score: 75, reason: 'Pipe downloaded content to shell' },
  { pattern: /^\|\s*(sh|bash|zsh)/, score: 90, reason: 'Pipe to shell' },
  { pattern: /^systemctl/, score: 50, reason: 'System service management' },
  { pattern: /^service/, score: 35, reason: 'Service management' },
  { pattern: /^apt\s+(install|remove|purge)/, score: 55, reason: 'Package installation/removal' },
  { pattern: /^npm\s+(install|uninstall|publish)\s+-g/, score: 60, reason: 'Global package operation' },
  { pattern: /^npm\s+(install|uninstall|publish)/, score: 25, reason: 'Package operation' },
  { pattern: /^pip\s+(install|uninstall)/, score: 25, reason: 'Python package operation' },
  { pattern: /^docker\s+(rm|rmi|kill|stop)/, score: 40, reason: 'Docker container/image modification' },
  { pattern: /^docker\s+(run|exec)\s+/, score: 45, reason: 'Docker container execution' },
  { pattern: /^git\s+push/, score: 30, reason: 'Git push to remote' },
  { pattern: /^git\s+reset/, score: 35, reason: 'Git history reset' },
  { pattern: /^git\s+revert/, score: 25, reason: 'Git revert' },
  { pattern: /^git\s+merge/, score: 20, reason: 'Git merge' },
  { pattern: /^git\s+rebase/, score: 30, reason: 'Git rebase' },
  { pattern: /^gh\s+/, score: 25, reason: 'GitHub CLI operation' },
  { pattern: /^passwd/, score: 80, reason: 'Password change' },
  { pattern: /^useradd|^usermod|^userdel/, score: 85, reason: 'User management' },
  { pattern: /^groupadd|^groupmod|^groupdel/, score: 70, reason: 'Group management' },
  { pattern: /^crontab/, score: 60, reason: 'Cron job modification' },
  { pattern: /^iptables/, score: 90, reason: 'Firewall modification' },
  { pattern: /^ufw\s+/, score: 70, reason: 'Firewall modification' },
  { pattern: /^mount/, score: 85, reason: 'Filesystem mount' },
  { pattern: /^umount/, score: 80, reason: 'Filesystem unmount' },
  { pattern: /^export\s+\w+=/, score: 10, reason: 'Environment variable set' },
  { pattern: /^alias\s+/, score: 10, reason: 'Shell alias creation' },
  { pattern: /^source\s+/, score: 20, reason: 'Source script' },
  { pattern: /^\.\s+/, score: 20, reason: 'Source script' },
];

const TOOL_RULES: Array<{ tool: string; args?: string[]; score: number; reason: string }> = [
  { tool: 'delete_file', score: 70, reason: 'File deletion' },
  { tool: 'delete_dir', score: 80, reason: 'Directory deletion' },
  { tool: 'overwrite_dir', score: 90, reason: 'Directory overwrite' },
  { tool: 'write_file', score: 20, reason: 'File write' },
  { tool: 'edit_file', score: 15, reason: 'File edit' },
  { tool: 'create_file', score: 10, reason: 'File creation' },
  { tool: 'append_file', score: 10, reason: 'File append' },
  { tool: 'rename_file', score: 15, reason: 'File rename' },
  { tool: 'duplicate_file', score: 5, reason: 'File duplicate' },
  { tool: 'execute_command', score: 30, reason: 'Shell command execution' },
  { tool: 'inline_patch', score: 15, reason: 'Inline code patch' },
  { tool: 'refactor', score: 20, reason: 'Multi-file refactor' },
  { tool: 'snapshot_restore', score: 60, reason: 'Snapshot restoration' },
  { tool: 'git_commit', score: 15, reason: 'Git commit' },
  { tool: 'git_push', score: 30, reason: 'Git push' },
  { tool: 'git_reset', score: 40, reason: 'Git reset' },
];

export function assessCommandRisk(command: string): RiskScore {
  const trimmed = command.trim();
  let maxScore = 0;
  const reasons: string[] = [];

  for (const rule of COMMAND_RULES) {
    if (rule.pattern.test(trimmed)) {
      if (rule.score > maxScore) maxScore = rule.score;
      reasons.push(rule.reason);
    }
  }

  if (reasons.length === 0) {
    return { level: 'safe', score: 0, reasons: ['No risk patterns matched'], suggestedAction: 'auto' };
  }

  const level = scoreToLevel(maxScore);
  const action = scoreToAction(maxScore);
  return { level, score: maxScore, reasons: [...new Set(reasons)], suggestedAction: action };
}

export function assessToolRisk(toolName: string, args?: Record<string, string>): RiskScore {
  if (toolName === 'execute_command' && args?.command) {
    return assessCommandRisk(args.command);
  }

  const rule = TOOL_RULES.find((r) => r.tool === toolName);
  if (!rule) {
    const safeTools = ['read_file', 'grep_search', 'glob_search', 'list_dir', 'get_cwd', 'file_tree', 'git_status', 'git_branch', 'git_branches', 'git_log', 'git_diff', 'recall_preferences', 'recall_repo_memory', 'list_workflows', 'vector_search', 'plugin_list'];
    return safeTools.includes(toolName)
      ? { level: 'safe', score: 0, reasons: ['Read-only operation'], suggestedAction: 'auto' }
      : { level: 'low', score: 15, reasons: [`Tool: ${toolName}`], suggestedAction: 'auto' };
  }

  const level = scoreToLevel(rule.score);
  const action = scoreToAction(rule.score);
  return { level, score: rule.score, reasons: [rule.reason], suggestedAction: action };
}

function scoreToLevel(score: number): RiskScore['level'] {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  if (score >= 10) return 'low';
  return 'safe';
}

function scoreToAction(score: number): RiskScore['suggestedAction'] {
  if (score >= 80) return 'block';
  if (score >= 25) return 'confirm';
  return 'auto';
}

export function formatRisk(risk: RiskScore): string {
  const colors: Record<string, (s: string) => string> = {
    safe: chalk.green,
    low: chalk.cyan,
    medium: chalk.yellow,
    high: chalk.red,
    critical: chalk.bgRed.white,
  };
  const color = colors[risk.level] || chalk.dim;
  const label = risk.level.toUpperCase().padEnd(10);
  const action = risk.suggestedAction === 'auto' ? chalk.green(risk.suggestedAction) : risk.suggestedAction === 'confirm' ? chalk.yellow(risk.suggestedAction) : chalk.bgRed.white(` ${risk.suggestedAction} `);
  return `  ${color(label)} score=${risk.score} action=${action} ${chalk.dim(risk.reasons.join(', '))}`;
}
