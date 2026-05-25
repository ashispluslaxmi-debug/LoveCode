import { Command } from 'commander';
import chalk from 'chalk';
import {
  listSessions,
  loadSession,
  searchSessions,
  getPreferences,
  savePreferences,
  formatPreferences,
  getRepoMemory,
  formatRepoMemory,
  getWorkflows,
  saveWorkflow,
  deleteWorkflow,
  addRepoNote,
  storeVector,
  searchVectors,
  formatVectorResults,
  getVectorCount,
  clearVectors,
  listChatLogs,
  clearAllMemory,
} from '../memory/index.js';

async function cmdSessions(options: { dir?: string }) {
  const sessions = listSessions(options.dir);
  if (sessions.length === 0) {
    console.log(chalk.yellow('No sessions found.'));
    return;
  }
  console.log(chalk.bold(`\n  Sessions (${sessions.length}):\n`));
  for (const s of sessions) {
    const date = new Date(s.updated).toLocaleString();
    const msgCount = s.entries.length;
    console.log(`  ${chalk.cyan(s.id.slice(0, 12))}  ${chalk.bold(s.title)}`);
    console.log(`       ${chalk.dim(`${msgCount} msgs  •  ${date}  •  ${s.model}`)}`);
  }
}

async function cmdShowSession(id: string, options: { dir?: string }) {
  const session = loadSession(id, options.dir);
  if (!session) {
    console.log(chalk.red(`Session "${id}" not found.`));
    return;
  }
  console.log(chalk.bold(`\n  Session: ${session.title}`));
  console.log(chalk.dim(`  ID: ${session.id}  •  Model: ${session.model}  •  ${session.entries.length} messages`));
  console.log(chalk.dim(`  Created: ${new Date(session.created).toLocaleString()}`));
  console.log('');
  for (const entry of session.entries.slice(-20)) {
    const role = entry.role === 'user' ? chalk.green('You') : entry.role === 'assistant' ? chalk.cyan('LoveCode') : chalk.yellow('System');
    const preview = entry.content.length > 200 ? entry.content.slice(0, 200) + '...' : entry.content;
    console.log(`  ${role}: ${preview}\n`);
  }
}

async function cmdSearchSessions(query: string, options: { dir?: string }) {
  const results = searchSessions(query, options.dir);
  if (results.length === 0) {
    console.log(chalk.yellow(`No sessions matching "${query}".`));
    return;
  }
  console.log(chalk.bold(`\n  Search results for "${query}" (${results.length}):\n`));
  for (const s of results) {
    const date = new Date(s.updated).toLocaleString();
    console.log(`  ${chalk.cyan(s.id.slice(0, 12))}  ${chalk.bold(s.title)}  ${chalk.dim(date)}`);
  }
}

async function cmdPreferences(options: { dir?: string; set?: string[] }) {
  if (options.set && options.set.length > 0) {
    const updates: Record<string, string> = {};
    for (const pair of options.set) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        updates[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
      }
    }
    const boolKeys = ['semiColons', 'trailingComma'];
    const prefs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (boolKeys.includes(k)) prefs[k] = v === 'true' || v === 'yes';
      else if (['indentSize'].includes(k)) prefs[k] = parseInt(v, 10);
      else prefs[k] = v;
    }
    const saved = savePreferences(prefs as Parameters<typeof savePreferences>[0], options.dir);
    console.log(chalk.green('Preferences updated:'));
    console.log(formatPreferences(saved));
  } else {
    const prefs = getPreferences(options.dir);
    console.log(formatPreferences(prefs));
  }
}

async function cmdRepoMemory(options: { dir?: string; note?: string }) {
  if (options.note) {
    const updated = addRepoNote(options.note, options.dir);
    console.log(chalk.green('Note added to repo memory.'));
    console.log(formatRepoMemory(updated));
  } else {
    const mem = getRepoMemory(options.dir);
    console.log(formatRepoMemory(mem));
  }
}

async function cmdWorkflows(options: { dir?: string; name?: string; save?: string[]; delete?: string; show?: string }) {
  const wf = getWorkflows(options.dir);

  if (options.save && options.name) {
    const steps = options.save;
    const workflow = {
      name: options.name,
      description: steps[0] || '',
      steps,
      tags: [],
      created: Date.now(),
      used: Date.now(),
    };
    saveWorkflow(workflow, options.dir);
    console.log(chalk.green(`Workflow "${options.name}" saved (${steps.length} steps).`));
    return;
  }

  if (options.delete) {
    const ok = deleteWorkflow(options.delete, options.dir);
    console.log(ok ? chalk.green(`Workflow "${options.delete}" deleted.`) : chalk.yellow(`Workflow "${options.delete}" not found.`));
    return;
  }

  if (wf.workflows.length === 0) {
    console.log(chalk.yellow('No saved workflows.'));
    return;
  }

  console.log(chalk.bold(`\n  Workflows (${wf.workflows.length}):\n`));
  for (const w of wf.workflows) {
    const date = new Date(w.used).toLocaleString();
    console.log(`  ${chalk.cyan(w.name)}  ${chalk.dim(w.description || '(no description)')}`);
    console.log(`       ${chalk.dim(`${w.steps.length} steps  •  last used ${date}`)}`);
  }
}

async function cmdVectorStore(options: { dir?: string; query?: string; store?: string; clear?: boolean; count?: boolean }) {
  if (options.clear) {
    clearVectors(options.dir);
    console.log(chalk.green('Vector memory cleared.'));
    return;
  }

  if (options.count) {
    console.log(`Vector memory entries: ${getVectorCount(options.dir)}`);
    return;
  }

  if (options.store) {
    const entry = await storeVector(options.store, {}, options.dir);
    console.log(chalk.green(`Stored: "${options.store.slice(0, 80)}..."`));
    console.log(chalk.dim(`  ID: ${entry.id}`));
    return;
  }

  if (options.query) {
    const results = await searchVectors(options.query, { topK: 10 }, options.dir);
    console.log(formatVectorResults(results));
    return;
  }

  console.log(chalk.yellow('Specify --query, --store, --count, or --clear.'));
}

async function cmdChatLogs(options: { dir?: string }) {
  const logs = listChatLogs(options.dir);
  if (logs.length === 0) {
    console.log(chalk.yellow('No chat logs found.'));
    return;
  }
  const totalSize = logs.reduce((acc, l) => acc + l.size, 0);
  const sizeStr = totalSize > 1024 ? `${(totalSize / 1024).toFixed(1)} KB` : `${totalSize} B`;
  console.log(chalk.bold(`\n  Chat Logs (${logs.length}, ${sizeStr}):\n`));
  for (const log of logs.slice(0, 20)) {
    const date = log.modified.toLocaleString();
    const size = log.size > 1024 ? `${(log.size / 1024).toFixed(1)} KB` : `${log.size} B`;
    console.log(`  ${chalk.dim(log.name.slice(0, 50).padEnd(52))} ${chalk.yellow(size.padStart(8))}  ${chalk.dim(date)}`);
  }
  if (logs.length > 20) {
    console.log(chalk.dim(`  ... and ${logs.length - 20} more`));
  }
}

async function cmdClearAll(options: { dir?: string }) {
  clearAllMemory(options.dir);
  clearVectors(options.dir);
  console.log(chalk.green('All memory data cleared.'));
}

export const memoryCommand = new Command('memory')
  .alias('mem')
  .description('Manage sessions, memory, and chat logs')
  .option('--dir <path>', 'Project directory', process.cwd())

  .addCommand(
    new Command('sessions')
      .alias('s')
      .description('List all persistent sessions')
      .option('--dir <path>', 'Project directory')
      .action(cmdSessions),
  )
  .addCommand(
    new Command('session')
      .description('Show a specific session')
      .argument('<id>', 'Session ID')
      .option('--dir <path>', 'Project directory')
      .action(cmdShowSession),
  )
  .addCommand(
    new Command('search')
      .description('Search sessions by text')
      .argument('<query>', 'Search query')
      .option('--dir <path>', 'Project directory')
      .action(cmdSearchSessions),
  )
  .addCommand(
    new Command('prefs')
      .alias('preferences')
      .description('View or set coding preferences')
      .option('-s, --set <values...>', 'Set preferences (key=value key=value)')
      .option('--dir <path>', 'Project directory')
      .action(cmdPreferences),
  )
  .addCommand(
    new Command('repo')
      .description('View or update repo memory')
      .option('--note <text>', 'Add a note to repo memory')
      .option('--dir <path>', 'Project directory')
      .action(cmdRepoMemory),
  )
  .addCommand(
    new Command('workflows')
      .alias('wf')
      .description('Manage saved workflows')
      .option('--name <name>', 'Workflow name (for --save)')
      .option('--save <steps...>', 'Save workflow steps')
      .option('--delete <name>', 'Delete a workflow')
      .option('--dir <path>', 'Project directory')
      .action(cmdWorkflows),
  )
  .addCommand(
    new Command('vector')
      .alias('v')
      .description('Vector memory operations')
      .option('--query <text>', 'Search vector memory')
      .option('--store <text>', 'Store text in vector memory')
      .option('--count', 'Show vector entry count')
      .option('--clear', 'Clear all vector memory')
      .option('--dir <path>', 'Project directory')
      .action(cmdVectorStore),
  )
  .addCommand(
    new Command('logs')
      .alias('chats')
      .description('List chat log files')
      .option('--dir <path>', 'Project directory')
      .action(cmdChatLogs),
  )
  .addCommand(
    new Command('clear')
      .description('Clear all memory data')
      .option('--dir <path>', 'Project directory')
      .action(cmdClearAll),
  )
  .addHelpText(
    'after',
    `
  Examples:
    lovecode memory sessions              List all sessions
    lovecode memory session <id>          Show session details
    lovecode memory search "error fix"    Search sessions
    lovecode memory prefs                 Show preferences
    lovecode memory prefs -s indentSize=4 quoteStyle=double
    lovecode memory repo                  Show repo memory
    lovecode memory repo --note "uses pnpm"
    lovecode memory workflows             List workflows
    lovecode memory workflows --save "step1" "step2" --name "test"
    lovecode memory vector --query "auth" Search vector memory
    lovecode memory vector --store "important context"
    lovecode memory logs                  List chat logs
    lovecode memory clear                 Clear everything
`,
  );
