import { Command } from 'commander';
import chalk from 'chalk';
import {
  assessCommandRisk,
  assessToolRisk,
  formatRisk,
} from '../security/risk.js';
import {
  scanText,
  scanDirectory,
  formatSecretSummary,
} from '../security/secrets.js';
import {
  listProfiles,
  checkCommand,
  formatProfile,
} from '../security/sandbox.js';
import {
  loadPermissions,
  setDefault,
  addPermission,
  removePermission,
  checkPermission,
  addTrustedSource,
  removeTrustedSource,
  resetPermissions,
  formatPermissions,
} from '../security/permissions.js';
import type { PermissionSet } from '../security/permissions.js';

async function cmdAssessRisk(command: string | undefined, options: { tool?: string; args?: string }) {
  if (command) {
    const risk = assessCommandRisk(command);
    console.log(`\n  ${chalk.bold('Command Risk Assessment')}`);
    console.log(`  ${chalk.dim(command)}`);
    console.log(formatRisk(risk));
  } else if (options.tool) {
    let args: Record<string, string> | undefined;
    if (options.args) {
      try { args = JSON.parse(options.args) as Record<string, string>; } catch { args = { command: options.args }; }
    }
    const risk = assessToolRisk(options.tool, args);
    console.log(`\n  ${chalk.bold('Tool Risk Assessment')}`);
    console.log(`  ${chalk.dim(`${options.tool}${args ? ' ' + JSON.stringify(args) : ''}`)}`);
    console.log(formatRisk(risk));
  } else {
    console.log(chalk.yellow('Provide a command string or --tool.'));
  }
}

async function cmdScanSecrets(options: { text?: string; dir?: string; max?: string }) {
  if (options.text) {
    const matches = scanText(options.text);
    console.log(formatSecretSummary(matches));
  } else if (options.dir) {
    const max = parseInt(options.max || '100', 10);
    console.log(chalk.dim(`Scanning ${options.dir} for secrets...`));
    const matches = scanDirectory(options.dir, max);
    console.log(formatSecretSummary(matches));
  } else {
    console.log(chalk.yellow('Provide --text or --dir.'));
  }
}

async function cmdProfiles() {
  const profiles = listProfiles();
  console.log(chalk.bold('\n  Sandbox Profiles:\n'));
  for (const p of profiles) {
    console.log(formatProfile(p));
    console.log('');
  }
}

async function cmdSandbox(command: string, options: { profile?: string }) {
  const result = checkCommand(command, process.cwd(), options.profile);
  if (result.allowed) {
    console.log(chalk.green(`\n  Allowed: ${chalk.dim(command)}`));
  } else {
    console.log(chalk.red(`\n  Blocked: ${chalk.dim(command)}`));
    console.log(`  ${chalk.yellow(result.reason)}`);
  }
}

async function cmdPermissions(options: { dir?: string; set?: string; add?: string; action?: string; remove?: string; source?: string }) {
  if (options.set && options.action) {
    const defaults = ['fileRead', 'fileWrite', 'networkAccess', 'commandExecution', 'environmentAccess'] as const;
    if (!defaults.includes(options.set as keyof PermissionSet['defaults'])) {
      console.log(chalk.red(`Invalid default: ${options.set}. Options: ${defaults.join(', ')}`));
      return;
    }
    const perms = setDefault(options.set as keyof PermissionSet['defaults'], options.action as 'allow' | 'deny' | 'ask', options.dir);
    console.log(chalk.green(`Default "${options.set}" set to "${options.action}".`));
    console.log(formatPermissions(perms));
  } else if (options.add && options.action) {
    const action = options.action as 'allow' | 'deny' | 'ask';
    const perms = addPermission(options.add, action, undefined, options.dir);
    console.log(chalk.green(`Permission added: ${options.add} → ${action}`));
    console.log(formatPermissions(perms));
  } else if (options.remove) {
    const ok = removePermission(options.remove, options.dir);
    console.log(ok ? chalk.green(`Removed permission: ${options.remove}`) : chalk.yellow(`Permission not found: ${options.remove}`));
  } else if (options.source) {
    addTrustedSource(options.source, options.dir);
    console.log(chalk.green(`Trusted source added: ${options.source}`));
  } else {
    const perms = loadPermissions(options.dir);
    console.log(formatPermissions(perms));
  }
}

async function cmdCheckPermission(resource: string, options: { dir?: string; category?: string }) {
  const category = (options.category as keyof PermissionSet['defaults']) || 'fileRead';
  const result = checkPermission(resource, category, options.dir);
  const color = result === 'allow' ? chalk.green : result === 'deny' ? chalk.red : chalk.yellow;
  console.log(`  ${color(result.toUpperCase())}  ${chalk.dim(resource)} (${category})`);
}

async function cmdReset(options: { dir?: string }) {
  resetPermissions(options.dir);
  console.log(chalk.green('Permissions reset to defaults.'));
}

async function cmdRemoveSource(source: string, options: { dir?: string }) {
  const ok = removeTrustedSource(source, options.dir);
  console.log(ok ? chalk.green(`Removed trusted source: ${source}`) : chalk.yellow(`Source not found: ${source}`));
}

export const securityCommand = new Command('security')
  .alias('sec')
  .alias('secure')
  .description('Security tools: risk assessment, secret detection, sandbox, permissions')
  .addHelpText('after', `
  Examples:
    lovecode security risk "rm -rf /"            Assess command risk
    lovecode security risk --tool write_file      Assess tool risk
    lovecode security scan --dir .                Scan project for secrets
    lovecode security scan --text "API_KEY=123"   Scan text for secrets
    lovecode security profiles                    List sandbox profiles
    lovecode security sandbox "npm install"       Test command against sandbox
    lovecode security sandbox "rm -rf" --profile restricted
    lovecode security perms                       Show permissions
    lovecode security perms --set fileWrite --action deny
    lovecode security perms --add "*.secret.*" --action deny
    lovecode security perms --remove "*.secret.*"
    lovecode security perms --source "github.com"
    lovecode security check "npm install" --category commandExecution
    lovecode security reset                       Reset permissions
  `);

securityCommand
  .command('risk')
  .description('Assess command or tool risk')
  .argument('[command]', 'Command string to assess')
  .option('--tool <name>', 'Tool name to assess')
  .option('--args <json>', 'Tool arguments (JSON string)')
  .action(cmdAssessRisk);

securityCommand
  .command('scan')
  .description('Scan for secrets in text or directory')
  .option('--text <text>', 'Text to scan')
  .option('--dir <path>', 'Directory to scan')
  .option('--max <n>', 'Max files to scan', '100')
  .action(cmdScanSecrets);

securityCommand
  .command('profiles')
  .description('List available sandbox profiles')
  .action(cmdProfiles);

securityCommand
  .command('sandbox')
  .description('Check a command against sandbox policy')
  .argument('<command>', 'Command string to check')
  .option('--profile <name>', 'Sandbox profile name', 'standard')
  .action(cmdSandbox);

securityCommand
  .command('perms')
  .alias('permissions')
  .description('View or manage permissions')
  .option('--dir <path>', 'Project directory')
  .option('--set <category>', 'Set default permission (fileRead/fileWrite/networkAccess/commandExecution/environmentAccess)')
  .option('--action <allow|deny|ask>', 'Permission action')
  .option('--add <resource>', 'Add specific permission')
  .option('--remove <resource>', 'Remove specific permission')
  .option('--source <url>', 'Add trusted source')
  .action(cmdPermissions);

securityCommand
  .command('check')
  .description('Check a permission for a resource')
  .argument('<resource>', 'Resource to check')
  .option('--category <name>', 'Permission category', 'fileRead')
  .action(cmdCheckPermission);

securityCommand
  .command('reset')
  .description('Reset permissions to defaults')
  .option('--dir <path>', 'Project directory')
  .action(cmdReset);

securityCommand
  .command('untrust')
  .description('Remove a trusted source')
  .argument('<source>', 'Source URL to remove')
  .option('--dir <path>', 'Project directory')
  .action(cmdRemoveSource);
