import { Command } from 'commander';
import chalk from 'chalk';
import {
  isGitAvailable,
  isRepo,
  getGitRoot,
  getStatus,
  stageAll,
  commit,
  getLog,
  getBranches,
  createBranch,
  switchBranch,
  deleteBranch,
  cleanupMergedBranches,
  getDiff,
  formatStatus,
  formatBranches,
  formatLog,
  generateCommitMessage,
  generatePRSummary,
  detectConflicts,
  suggestResolutions,
  formatConflictInfo,
  formatResolutionSuggestions,
} from '../git/index.js';

function requireGit(cwd?: string): boolean {
  if (!isGitAvailable()) {
    console.log(chalk.red('  ✗ Git is not installed or not in PATH.'));
    return false;
  }
  if (!isRepo(cwd)) {
    console.log(chalk.red('  ✗ Not a git repository.'));
    return false;
  }
  return true;
}

async function cmdCommit(opts: { message?: string; all?: boolean; dir?: string; generate?: boolean }) {
  if (!requireGit(opts.dir)) return;

  const dir = opts.dir || process.cwd();
  const root = getGitRoot(dir);

  if (opts.all) {
    stageAll(root || dir);
  }

  const status = getStatus(root || dir);

  if (status.clean && !opts.message) {
    console.log(chalk.yellow('  Nothing to commit. Working tree clean.'));
    return;
  }

  let commitMessage = opts.message;

  if (!commitMessage && opts.generate) {
    console.log(chalk.dim('  Generating commit message...'));
    commitMessage = await generateCommitMessage();
    console.log(chalk.cyan(`  Generated: ${commitMessage.split('\n')[0]}\n`));
  }

  if (!commitMessage) {
    console.log(chalk.yellow('  No commit message provided. Use --message or --generate.'));
    console.log(chalk.dim('  Examples:'));
    console.log(chalk.dim('    lovecode commit -m "feat: add login"'));
    console.log(chalk.dim('    lovecode commit --generate'));
    return;
  }

  if (opts.all) {
    console.log(chalk.dim('  Staging all changes...'));
  }

  const result = commit(commitMessage, root || dir);
  if (result.success) {
    console.log(chalk.green(`  ✓ Committed${result.hash ? ` (${result.hash.slice(0, 8)})` : ''}`));
    if (result.output) {
      const lines = result.output.split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.includes('changed') || line.includes('insertion') || line.includes('deletion')) {
          console.log(chalk.dim(`  ${line}`));
        }
      }
    }
  } else {
    console.log(chalk.red(`  ✗ ${result.output}`));
  }
}

async function cmdStatus(options: { dir?: string }) {
  if (!requireGit(options.dir)) return;
  const dir = options.dir || process.cwd();
  const root = getGitRoot(dir);
  const status = getStatus(root || dir);
  console.log(chalk.bold(`\n  Git Status — ${chalk.cyan(status.branch)}`));
  console.log(`  ${formatStatus(status)}`);
  console.log('');
}

async function cmdBranch(action: string | undefined, name: string | undefined, options: { dir?: string; force?: boolean }) {
  if (!requireGit(options.dir)) return;
  const dir = options.dir || process.cwd();
  const gitRoot = getGitRoot(dir);

  if (!action || action === 'list') {
    const branches = getBranches(gitRoot || dir);
    console.log(chalk.bold(`\n  Branches (${branches.length}):`));
    console.log(`  ${formatBranches(branches)}`);
    console.log('');
    return;
  }

  if (!name) {
    console.log(chalk.yellow('  Branch name required.'));
    return;
  }

  switch (action) {
    case 'create': {
      const ok = createBranch(name, gitRoot || dir);
      console.log(ok ? chalk.green(`  ✓ Created and switched to "${name}"`) : chalk.red(`  ✗ Failed to create branch "${name}"`));
      break;
    }
    case 'switch': {
      const result = switchBranch(name, gitRoot || dir);
      console.log(result.success ? chalk.green(`  ✓ Switched to "${name}"`) : chalk.red(`  ✗ ${result.output}`));
      break;
    }
    case 'delete': {
      const result = deleteBranch(name, options.force, gitRoot || dir);
      console.log(result.success ? chalk.green(`  ✓ Deleted branch "${name}"`) : chalk.red(`  ✗ ${result.output}`));
      break;
    }
    case 'cleanup': {
      console.log(chalk.dim('  Cleaning up merged branches...'));
      const deleted = cleanupMergedBranches(gitRoot || dir);
      if (deleted.length === 0) {
        console.log(chalk.yellow('  No merged branches to clean up.'));
      } else {
        console.log(chalk.green(`  ✓ Deleted ${deleted.length} merged branc${deleted.length > 1 ? 'hes' : 'h'}:`));
        for (const b of deleted) {
          console.log(`    • ${b}`);
        }
      }
      break;
    }
    default:
      console.log(chalk.yellow(`  Unknown action: ${action}. Use: create, switch, delete, cleanup, or list.`));
  }
}

async function cmdLog(options: { count?: string; dir?: string }) {
  if (!requireGit(options.dir)) return;
  const dir = options.dir || process.cwd();
  const root = getGitRoot(dir);
  const count = parseInt(options.count || '10', 10);
  const log = getLog(count, root || dir);
  if (log.length === 0) {
    console.log(chalk.yellow('  No commits found.'));
    return;
  }
  console.log(chalk.bold(`\n  Recent Commits (${log.length}):`));
  console.log(`  ${formatLog(log)}`);
  console.log('');
}

async function cmdPRSummary(baseBranch: string | undefined, options: { dir?: string }) {
  if (!requireGit(options.dir)) return;
  const base = baseBranch || 'main';

  console.log(chalk.dim(`  Generating PR summary (${base}...HEAD)...`));
  const summary = await generatePRSummary(base);
  console.log(`\n${summary}\n`);
}

async function cmdConflicts(options: { dir?: string }) {
  if (!requireGit(options.dir)) return;
  const dir = options.dir || process.cwd();
  const root = getGitRoot(dir);

  const conflicts = detectConflicts(root || dir);
  console.log(`\n${formatConflictInfo(conflicts)}`);

  if (conflicts.length > 0) {
    console.log('');
    const suggestions = suggestResolutions(root || dir);
    console.log(formatResolutionSuggestions(suggestions));
  }
  console.log('');
}

async function cmdDiff(options: { staged?: boolean; dir?: string }) {
  if (!requireGit(options.dir)) return;
  const dir = options.dir || process.cwd();
  const root = getGitRoot(dir);

  const diff = options.staged ? (await import('../git/index.js')).getStagedDiff(root || dir) : getDiff(root || dir);

  if (!diff) {
    console.log(chalk.yellow('  No changes to show.'));
    return;
  }

  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('+')) {
      process.stdout.write(chalk.green(line) + '\n');
    } else if (line.startsWith('-')) {
      process.stdout.write(chalk.red(line) + '\n');
    } else if (line.startsWith('@@')) {
      process.stdout.write(chalk.cyan(line) + '\n');
    } else if (line.startsWith('diff --git')) {
      process.stdout.write(chalk.bold(line) + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}

export const gitCommand = new Command('git')
  .description('Git integration — commit, branch, PR summaries, conflict help')
  .addHelpText('after', `
  Examples:
    lovecode git status              Show working tree status
    lovecode git commit -m "message"   Commit with message
    lovecode git commit --generate     AI-generated commit message
    lovecode git commit --all -m "msg" Stage all and commit
    lovecode git branch               List branches
    lovecode git branch create <name>  Create and switch to branch
    lovecode git branch switch <name>  Switch branch
    lovecode git branch delete <name>  Delete a branch
    lovecode git branch cleanup        Delete merged branches
    lovecode git log                   Show recent commits
    lovecode git log --count 20        Show 20 commits
    lovecode git pr-summary            Generate PR summary
    lovecode git pr-summary develop    PR summary vs develop
    lovecode git conflicts             Detect and resolve conflicts
    lovecode git diff                  Show unstaged diff
    lovecode git diff --staged         Show staged diff
  `);

gitCommand
  .command('status')
  .alias('st')
  .description('Show working tree status')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdStatus);

gitCommand
  .command('commit')
  .alias('ci')
  .description('Commit changes')
  .argument('[message]', 'Commit message')
  .option('-m, --message <msg>', 'Commit message')
  .option('-a, --all', 'Stage all changes before committing')
  .option('-g, --generate', 'Generate commit message from diff')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action((message: string | undefined, options: Record<string, unknown>) => {
    const msg = message || (options.message as string) || undefined;
    return cmdCommit({ message: msg, all: options.all as boolean, dir: options.dir as string, generate: options.generate as boolean });
  });

const branchCmd = new Command('branch')
  .alias('b')
  .description('Manage branches')
  .option('--dir <path>', 'Project directory', process.cwd())
  .option('-f, --force', 'Force delete branch');

branchCmd
  .command('list')
  .description('List branches')
  .action((_opts: unknown, cmd: Command) => cmdBranch('list', undefined, cmd.parent?.opts() || {}));

branchCmd
  .command('create')
  .description('Create and switch to a new branch')
  .argument('<name>', 'Branch name')
  .action((name: string, _opts: unknown, cmd: Command) => cmdBranch('create', name, cmd.parent?.opts() || {}));

branchCmd
  .command('switch')
  .description('Switch to a branch')
  .argument('<name>', 'Branch name')
  .action((name: string, _opts: unknown, cmd: Command) => cmdBranch('switch', name, cmd.parent?.opts() || {}));

branchCmd
  .command('delete')
  .description('Delete a branch')
  .argument('<name>', 'Branch name')
  .action((name: string, _opts: unknown, cmd: Command) => cmdBranch('delete', name, cmd.parent?.opts() || {}));

branchCmd
  .command('cleanup')
  .description('Delete merged branches')
  .action((_opts: unknown, cmd: Command) => cmdBranch('cleanup', undefined, cmd.parent?.opts() || {}));

gitCommand.addCommand(branchCmd);

gitCommand
  .command('log')
  .description('Show recent commits')
  .option('-n, --count <number>', 'Number of commits', '10')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdLog);

gitCommand
  .command('pr-summary')
  .alias('pr')
  .description('Generate a PR summary from branch diff')
  .argument('[base]', 'Base branch', 'main')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdPRSummary);

gitCommand
  .command('conflicts')
  .alias('conflict')
  .description('Detect and suggest merge conflict resolution')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdConflicts);

gitCommand
  .command('diff')
  .description('Show diff')
  .option('--staged', 'Show staged diff')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdDiff);
