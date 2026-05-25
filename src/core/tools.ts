import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import {
  scanDirectory,
  renameFile as fsRename,
  duplicateFile as fsDuplicate,
  getDirectoryTree,
  findFiles,
  semanticSearch,
  rankFiles,
  printRankedFiles,
  printScanSummary,
} from '../fs/index.js';
import {
  applyInlinePatch,
  checkBraceBalance,
  saveUndoPoint,
  undoForFile,
  getUndoHistory,
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  executeRefactor,
  planRefactor,
} from '../editor/index.js';
import { execCommand, createDefaultPolicy, evaluateCommand, printSandboxVerdict } from '../shell/index.js';
import { detectProject, printProjectInfo } from '../repo/detect.js';
import { analyzeDependencies, printDepGraph } from '../repo/deps.js';
import { generateSummary, printSummary } from '../repo/summary.js';
import {
  getPreferences,
  savePreferences,
  getRepoMemory,
  addRepoNote,
  saveWorkflow,
  getWorkflows,
  storeVector,
  searchVectors,
  formatVectorResults,
} from '../memory/index.js';
import {
  getStatus,
  formatStatus,
  stageAll,
  commit,
  getLog,
  formatLog,
  getBranches,
  formatBranches,
  createBranch,
  switchBranch,
  isGitAvailable,
  getCurrentBranch,
  getFullDiff,
  getStagedDiff,
} from '../git/index.js';
import { goto, click, type as browserType, screenshot, inspect, isBrowserRunning, formatScreenshotResult, formatDOMElement } from '../browser/index.js';
import { listPlugins, enablePlugin, disablePlugin, getAllPluginTools, loadBuiltinPlugins } from '../plugin/index.js';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  usage: string;
  execute(workingDir: string, args: Record<string, string>): Promise<ToolResult> | ToolResult;
}

const fileTools: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    usage: 'path=<file path>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const filePath = path.resolve(workingDir, args.path || '.');
        if (!fs.existsSync(filePath)) {
          return { success: false, output: '', error: `File not found: ${args.path}` };
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const numbered = lines.map((l, i) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n');
        return { success: true, output: numbered };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file (creates parent dirs)',
    usage: 'path=<file path> content=<file content>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const filePath = path.resolve(workingDir, args.path || '');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, args.content || '', 'utf-8');
        return { success: true, output: `Wrote ${filePath}` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'edit_file',
    description: 'Edit a file by replacing text (oldString -> newString)',
    usage: 'path=<file path> oldString=<text to find> newString=<replacement>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const filePath = path.resolve(workingDir, args.path || '');
        if (!fs.existsSync(filePath)) {
          return { success: false, output: '', error: `File not found: ${args.path}` };
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const { oldString, newString } = args;
        if (!oldString) {
          return { success: false, output: '', error: 'oldString is required' };
        }
        const count = (content.match(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (count === 0) {
          return { success: false, output: '', error: `oldString not found in ${args.path}` };
        }
        const updated = content.replaceAll(oldString, newString || '');
        fs.writeFileSync(filePath, updated, 'utf-8');
        return { success: true, output: `Edited ${filePath} (${count} replacement${count > 1 ? 's' : ''})` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'create_file',
    description: 'Create a new empty file',
    usage: 'path=<file path>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const filePath = path.resolve(workingDir, args.path || '');
        if (fs.existsSync(filePath)) {
          return { success: false, output: '', error: `File already exists: ${args.path}` };
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '', 'utf-8');
        return { success: true, output: `Created ${filePath}` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file',
    usage: 'path=<file path>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const filePath = path.resolve(workingDir, args.path || '');
        if (!fs.existsSync(filePath)) {
          return { success: false, output: '', error: `File not found: ${args.path}` };
        }
        fs.unlinkSync(filePath);
        return { success: true, output: `Deleted ${filePath}` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'append_file',
    description: 'Append content to the end of a file',
    usage: 'path=<file path> content=<content to append>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const filePath = path.resolve(workingDir, args.path || '');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.appendFileSync(filePath, (args.content || '') + '\n', 'utf-8');
        return { success: true, output: `Appended to ${filePath}` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
];

const commandTools: ToolDefinition[] = [];

const searchTools: ToolDefinition[] = [
  {
    name: 'grep_search',
    description: 'Search file contents with a regular expression',
    usage: 'pattern=<regex> [include=<glob pattern>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const pattern = args.pattern || '';
        const include = args.include || '**/*';
        const cmd = `rg -n '${pattern.replace(/'/g, "'\\''")}' --include '${include}' 2>/dev/null || echo "(no matches)"`;
        const output = execSync(cmd, { cwd: workingDir, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
        return { success: true, output: output.trim() };
      } catch {
        return { success: true, output: '(no matches)' };
      }
    },
  },
  {
    name: 'glob_search',
    description: 'Find files matching a glob pattern',
    usage: 'pattern=<glob pattern>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const pattern = args.pattern || '*';
        const cmd = `ls -1 ${pattern.replace(/ /g, '\\ ')} 2>/dev/null || echo "(no files found)"`;
        const output = execSync(cmd, { cwd: workingDir, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
        return { success: true, output: output.trim() };
      } catch {
        return { success: true, output: '(no files found)' };
      }
    },
  },
  {
    name: 'list_dir',
    description: 'List files and directories',
    usage: 'path=<directory path>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const dirPath = path.resolve(workingDir, args.path || '.');
        if (!fs.existsSync(dirPath)) {
          return { success: false, output: '', error: `Directory not found: ${args.path}` };
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const output = entries
          .map((e) => (e.isDirectory() ? chalk.cyan(`${e.name}/`) : e.name))
          .join('\n');
        return { success: true, output };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'get_cwd',
    description: 'Get the current working directory',
    usage: '(no arguments)',
    execute(_workingDir: string, _args: Record<string, string>): ToolResult {
      return { success: true, output: process.cwd() };
    },
  },
];

const fsEngineTools: ToolDefinition[] = [
  {
    name: 'scan_files',
    description: 'Recursively scan files in the project. Returns categorized listing.',
    usage: '[path=<dir>] [maxDepth=<number>] [category=<source|config|doc|script|data>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const rootDir = path.resolve(workingDir, args.path || '.');
        const maxDepth = parseInt(args.maxDepth || '10', 10);
        const category = args.category as string | undefined;
        const files = scanDirectory({
          rootDir,
          maxDepth,
          maxFiles: 10000,
        });
        if (category) {
          const filtered = files.filter((f) => f.category === category);
          const summary = printScanSummary(filtered);
          const fileList = filtered.map((f) => `  ${f.relativePath}`).join('\n');
          return { success: true, output: `${summary}\n\n${fileList}` };
        }
        return { success: true, output: printScanSummary(files) };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'find_file',
    description: 'Search for files by name/pattern',
    usage: 'query=<name or pattern> [content=<true|false>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const query = args.query || '';
        const includeContent = args.content === 'true';
        const results = findFiles({ rootDir: workingDir, query, maxResults: 20, includeContent });
        if (results.length === 0) return { success: true, output: '(no files found)' };

        const lines = results.map((r, i) => {
          let line = `  ${i + 1}. ${r.relativePath} ${chalk.dim(`(score: ${r.score})`)}`;
          if (r.matches && r.matches.length > 0) {
            const top = r.matches.slice(0, 3);
            line += top.map((m) => `\n       ${chalk.dim(`L${m.line}:`)} ${m.content.slice(0, 80)}`).join('');
          }
          return line;
        });
        return { success: true, output: `Found ${results.length} files:\n${lines.join('\n')}` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'semantic_search',
    description: 'Search by file name and content (combined)',
    usage: 'query=<search term>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const query = args.query || '';
        const results = semanticSearch(query, workingDir);
        if (results.length === 0) return { success: true, output: '(no matches)' };
        const lines = results.map((r, i) => {
          let line = `  ${i + 1}. ${r.relativePath} ${chalk.dim(`(score: ${r.score})`)}`;
          if (r.matches && r.matches.length > 0) {
            const top = r.matches.slice(0, 2);
            line += top.map((m) => `\n       ${chalk.dim(`L${m.line}:`)} ${m.content.slice(0, 80)}`).join('');
          }
          return line;
        });
        return { success: true, output: `Semantic search results:\n${lines.join('\n')}` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'rename_file',
    description: 'Rename or move a file',
    usage: 'oldPath=<current path> newPath=<new path>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const oldPath = path.resolve(workingDir, args.oldPath || '');
      const newPath = path.resolve(workingDir, args.newPath || '');
      const result = fsRename(oldPath, newPath);
      return { success: result.success, output: result.message, error: result.error };
    },
  },
  {
    name: 'duplicate_file',
    description: 'Copy/duplicate a file',
    usage: 'source=<source path> dest=<destination path>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const sourcePath = path.resolve(workingDir, args.source || '');
      const destPath = path.resolve(workingDir, args.dest || '');
      const result = fsDuplicate(sourcePath, destPath);
      return { success: result.success, output: result.message, error: result.error };
    },
  },
  {
    name: 'file_tree',
    description: 'Show directory tree structure',
    usage: '[path=<dir>] [maxDepth=<number>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const dirPath = path.resolve(workingDir, args.path || '.');
        const maxDepth = parseInt(args.maxDepth || '3', 10);
        const tree = getDirectoryTree(dirPath, '', maxDepth);
        return { success: true, output: tree };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'rank_files',
    description: 'Rank files by importance for context',
    usage: '[task=<task description>] [limit=<number>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const task = args.task || '';
        const limit = parseInt(args.limit || '10', 10);
        const files = scanDirectory({ rootDir: workingDir, maxDepth: 10, maxFiles: 5000 });
        const ranked = rankFiles(files, task);
        const top = ranked.slice(0, limit);
        return { success: true, output: printRankedFiles(top) };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
];

const editorTools: ToolDefinition[] = [
  {
    name: 'inline_patch',
    description: 'Apply a search/replace patch to a file with context matching',
    usage: 'path=<file> search=<text to find> replace=<replacement>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const filePath = path.resolve(workingDir, args.path || '');
      const result = applyInlinePatch(filePath, args.search || '', args.replace || '');
      if (result.success) {
        saveUndoPoint(workingDir, filePath, 'inline_patch');
      }
      return { success: result.success, output: result.output, error: result.error };
    },
  },
  {
    name: 'syntax_check',
    description: 'Check a file for basic syntax errors (brace balance)',
    usage: 'path=<file path>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      try {
        const filePath = path.resolve(workingDir, args.path || '');
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = checkBraceBalance(content, filePath);
        if (result.valid) {
          return { success: true, output: 'Syntax check passed: all braces balanced' };
        }
        const lines = result.errors.map(
          (e) => `  Line ${e.line}:${e.column} — ${e.message}`,
        );
        return { success: false, output: `Syntax errors found:\n${lines.join('\n')}` };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
  {
    name: 'undo',
    description: 'Undo the last file edit',
    usage: '[path=<file path>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const filePath = args.path ? path.resolve(workingDir, args.path) : undefined;
      const result = filePath ? undoForFile(workingDir, filePath) : undoForFile(workingDir, '');
      if (result) {
        return { success: true, output: `Undone: ${result.label} on ${result.filePath}` };
      }
      return { success: false, output: '', error: 'Nothing to undo' };
    },
  },
  {
    name: 'undo_history',
    description: 'Show undo history',
    usage: '(no arguments)',
    execute(workingDir: string, _args: Record<string, string>): ToolResult {
      const history = getUndoHistory(workingDir);
      if (history.length === 0) return { success: true, output: '(no undo history)' };
      const lines = history.map(
        (e, i) => `  ${i + 1}. ${chalk.dim(e.label)} — ${e.filePath} ${chalk.dim(`(${new Date(e.timestamp).toLocaleString()})`)}`,
      );
      return { success: true, output: `Undo History:\n${lines.join('\n')}` };
    },
  },
  {
    name: 'snapshot',
    description: 'Create a snapshot of a file',
    usage: 'path=<file path> [label=<optional label>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const filePath = path.resolve(workingDir, args.path || '');
      const label = args.label || 'manual';
      const snap = createSnapshot(workingDir, filePath, label);
      if (snap) {
        return { success: true, output: `Snapshot created: ${snap.id} (${snap.size} bytes)` };
      }
      return { success: false, output: '', error: 'Failed to create snapshot' };
    },
  },
  {
    name: 'snapshot_list',
    description: 'List available snapshots',
    usage: '(no arguments)',
    execute(workingDir: string, _args: Record<string, string>): ToolResult {
      const snaps = listSnapshots(workingDir);
      if (snaps.length === 0) return { success: true, output: '(no snapshots)' };
      const lines = snaps.map(
        (s, i) => `  ${i + 1}. ${chalk.cyan(s.id)} ${chalk.dim(s.relativePath)} — ${s.label}`,
      );
      return { success: true, output: `Snapshots:\n${lines.join('\n')}` };
    },
  },
  {
    name: 'snapshot_restore',
    description: 'Restore a file from a snapshot',
    usage: 'id=<snapshot id>',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const id = args.id || '';
      const ok = restoreSnapshot(workingDir, id);
      if (ok) return { success: true, output: `Restored snapshot: ${id}` };
      return { success: false, output: '', error: `Snapshot not found: ${id}` };
    },
  },
  {
    name: 'refactor',
    description: 'Execute multi-file refactoring with syntax validation',
    usage: 'edits=<JSON array of {filePath,search,replace,description}>',
    async execute(workingDir: string, args: Record<string, string>): Promise<ToolResult> {
      try {
        const edits = JSON.parse(args.edits || '[]');
        if (!Array.isArray(edits) || edits.length === 0) {
          return { success: false, output: '', error: 'edits must be a non-empty JSON array' };
        }
        const plan = planRefactor(edits, workingDir, true);
        const result = await executeRefactor(plan);
        return { success: result.success, output: result.output };
      } catch (err) {
        return { success: false, output: '', error: String(err) };
      }
    },
  },
];

const shellTools: ToolDefinition[] = [
  {
    name: 'execute_command',
    description: 'Run a shell command with sandbox, timeout, and output capture',
    usage: 'command=<shell command> [timeout=<ms>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult | Promise<ToolResult> {
      const command = args.command || '';
      const timeout = parseInt(args.timeout || '120000', 10);

      const policy = createDefaultPolicy();
      const verdict = evaluateCommand(command, policy);

      if (!verdict.allowed) {
        return {
          success: false,
          output: printSandboxVerdict(verdict),
          error: verdict.reason,
        };
      }

      return execCommand(command, workingDir, timeout).then((result) => ({
        success: result.success,
        output: result.stdout + (result.stderr ? `\n${chalk.yellow(result.stderr)}` : ''),
        error: result.success ? undefined : `Exit code: ${result.exitCode}${result.cancelled ? ' (cancelled)' : ''}`,
      }));
    },
  },
];

const memoryTools: ToolDefinition[] = [
  {
    name: 'store_preference',
    description: 'Store a coding preference',
    usage: 'key=<name> value=<value>',
    async execute(_workingDir: string, args: Record<string, string>): Promise<ToolResult> {
      const key = args.key;
      const value = args.value;
      if (!key || !value) return { success: false, output: '', error: 'key and value required' };
      const boolKeys = ['semiColons', 'trailingComma'];
      const numKeys = ['indentSize'];
      const prefs: Record<string, unknown> = {};
      if (boolKeys.includes(key)) prefs[key] = value === 'true' || value === 'yes';
      else if (numKeys.includes(key)) prefs[key] = parseInt(value, 10);
      else prefs[key] = value;
      savePreferences(prefs as Parameters<typeof savePreferences>[0]);
      return { success: true, output: `Stored preference ${key} = ${value}` };
    },
  },
  {
    name: 'recall_preferences',
    description: 'Retrieve stored coding preferences',
    usage: '',
    execute(): ToolResult {
      const prefs = getPreferences();
      const lines = [
        `Indent: ${prefs.indentStyle} (${prefs.indentSize})`,
        `Quotes: ${prefs.quoteStyle}`,
        `Semicolons: ${prefs.semiColons ? 'yes' : 'no'}`,
        `Trailing commas: ${prefs.trailingComma ? 'yes' : 'no'}`,
        `Test runner: ${prefs.preferredTestRunner}`,
        `Package manager: ${prefs.preferredPackageManager}`,
        `Linter: ${prefs.preferredLinter}`,
      ];
      return { success: true, output: lines.join('\n') };
    },
  },
  {
    name: 'repo_note',
    description: 'Store a note about the repository structure or conventions',
    usage: 'note=<text>',
    execute(_workingDir: string, args: Record<string, string>): ToolResult {
      if (!args.note) return { success: false, output: '', error: 'note required' };
      addRepoNote(args.note);
      return { success: true, output: `Note saved: ${args.note}` };
    },
  },
  {
    name: 'recall_repo_memory',
    description: 'Retrieve stored repo memory and notes',
    usage: '',
    execute(): ToolResult {
      const mem = getRepoMemory();
      const lines: string[] = [];
      if (mem.primaryLanguage) lines.push(`Language: ${mem.primaryLanguage}`);
      if (mem.frameworks.length) lines.push(`Frameworks: ${mem.frameworks.join(', ')}`);
      if (mem.entryPoints.length) lines.push(`Entry points: ${mem.entryPoints.join(', ')}`);
      if (mem.buildCommands.length) lines.push(`Build: ${mem.buildCommands.join(', ')}`);
      if (mem.testCommands.length) lines.push(`Test: ${mem.testCommands.join(', ')}`);
      if (mem.notes.length) lines.push(`Notes:\n  ${mem.notes.join('\n  ')}`);
      return { success: true, output: lines.join('\n') || 'No repo memory stored.' };
    },
  },
  {
    name: 'save_workflow',
    description: 'Save a reusable workflow for future tasks',
    usage: 'name=<workflow name> steps=<comma separated steps>',
    execute(_workingDir: string, args: Record<string, string>): ToolResult {
      if (!args.name || !args.steps) return { success: false, output: '', error: 'name and steps required' };
      const steps = args.steps.split(',').map((s) => s.trim());
      saveWorkflow({ name: args.name, description: steps[0] || '', steps, tags: [], created: Date.now(), used: Date.now() });
      return { success: true, output: `Workflow "${args.name}" saved with ${steps.length} steps.` };
    },
  },
  {
    name: 'list_workflows',
    description: 'List saved workflows',
    usage: '',
    execute(): ToolResult {
      const wf = getWorkflows();
      if (wf.workflows.length === 0) return { success: true, output: 'No saved workflows.' };
      const lines = wf.workflows.map((w) => `  ${w.name} (${w.steps.length} steps): ${w.description}`);
      return { success: true, output: `Workflows:\n${lines.join('\n')}` };
    },
  },
  {
    name: 'vector_store',
    description: 'Store text in vector memory for semantic recall',
    usage: 'text=<content> [label=<category>]',
    async execute(_workingDir: string, args: Record<string, string>): Promise<ToolResult> {
      if (!args.text) return { success: false, output: '', error: 'text required' };
      const metadata: Record<string, string> = {};
      if (args.label) metadata.label = args.label;
      await storeVector(args.text, metadata);
      return { success: true, output: 'Stored in vector memory.' };
    },
  },
  {
    name: 'vector_search',
    description: 'Search vector memory by semantic similarity',
    usage: 'query=<search text> [topK=<number>]',
    async execute(_workingDir: string, args: Record<string, string>): Promise<ToolResult> {
      if (!args.query) return { success: false, output: '', error: 'query required' };
      const topK = args.topK ? parseInt(args.topK, 10) : 5;
      const results = await searchVectors(args.query, { topK });
      return { success: true, output: formatVectorResults(results) };
    },
  },
];

const gitTools: ToolDefinition[] = [
  {
    name: 'git_status',
    description: 'Show working tree status',
    usage: '',
    execute(_workingDir: string): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      const status = getStatus();
      return { success: true, output: formatStatus(status) };
    },
  },
  {
    name: 'git_commit',
    description: 'Stage all changes and commit with a message',
    usage: 'message=<commit message>',
    execute(_workingDir: string, args: Record<string, string>): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      if (!args.message) return { success: false, output: '', error: 'message required' };
      stageAll();
      const result = commit(args.message);
      return result.success
        ? { success: true, output: `Committed: ${result.hash ? result.hash.slice(0, 8) : 'ok'} — ${args.message}` }
        : { success: false, output: result.output, error: result.output };
    },
  },
  {
    name: 'git_diff',
    description: 'Show current diff (staged + unstaged)',
    usage: '[staged=<true|false>]',
    execute(_workingDir: string, args: Record<string, string>): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      const diff = args.staged === 'true' ? getStagedDiff() : getFullDiff();
      return { success: true, output: diff || 'No changes.' };
    },
  },
  {
    name: 'git_branches',
    description: 'List all branches',
    usage: '',
    execute(): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      const branches = getBranches();
      return { success: true, output: formatBranches(branches) };
    },
  },
  {
    name: 'git_create_branch',
    description: 'Create and switch to a new branch',
    usage: 'name=<branch name>',
    execute(_workingDir: string, args: Record<string, string>): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      if (!args.name) return { success: false, output: '', error: 'name required' };
      const ok = createBranch(args.name);
      return ok
        ? { success: true, output: `Created and switched to branch "${args.name}"` }
        : { success: false, output: '', error: `Failed to create branch "${args.name}"` };
    },
  },
  {
    name: 'git_switch_branch',
    description: 'Switch to an existing branch',
    usage: 'name=<branch name>',
    execute(_workingDir: string, args: Record<string, string>): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      if (!args.name) return { success: false, output: '', error: 'name required' };
      const result = switchBranch(args.name);
      return result.success
        ? { success: true, output: `Switched to branch "${args.name}"` }
        : { success: false, output: result.output, error: result.output };
    },
  },
  {
    name: 'git_log',
    description: 'Show recent commit log',
    usage: '[count=<number>]',
    execute(_workingDir: string, args: Record<string, string>): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      const count = args.count ? parseInt(args.count, 10) : 10;
      const log = getLog(count);
      return { success: true, output: formatLog(log) };
    },
  },
  {
    name: 'git_branch',
    description: 'Get current branch name',
    usage: '',
    execute(): ToolResult {
      if (!isGitAvailable()) return { success: false, output: '', error: 'Git not available' };
      return { success: true, output: getCurrentBranch() };
    },
  },
];

const browserTools: ToolDefinition[] = [
  {
    name: 'browser_goto',
    description: 'Navigate the browser to a URL',
    usage: 'url=<URL>',
    async execute(_wd: string, args: Record<string, string>): Promise<ToolResult> {
      if (!args.url) return { success: false, output: '', error: 'url required' };
      try {
        if (!isBrowserRunning()) {
          const { launchBrowser } = await import('../browser/index.js');
          await launchBrowser();
        }
        const result = await goto(args.url);
        return { success: true, output: result };
      } catch (e) {
        return { success: false, output: '', error: String(e) };
      }
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element on the page',
    usage: 'selector=<CSS selector>',
    async execute(_wd: string, args: Record<string, string>): Promise<ToolResult> {
      if (!args.selector) return { success: false, output: '', error: 'selector required' };
      try {
        const result = await click(args.selector);
        return { success: true, output: result };
      } catch (e) {
        return { success: false, output: '', error: String(e) };
      }
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into an input element',
    usage: 'selector=<CSS selector> text=<text>',
    async execute(_wd: string, args: Record<string, string>): Promise<ToolResult> {
      if (!args.selector) return { success: false, output: '', error: 'selector required' };
      if (!args.text) return { success: false, output: '', error: 'text required' };
      try {
        const result = await browserType(args.selector, args.text);
        return { success: true, output: result };
      } catch (e) {
        return { success: false, output: '', error: String(e) };
      }
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take a browser screenshot',
    usage: '[name=<filename>]',
    async execute(): Promise<ToolResult> {
      try {
        const result = await screenshot();
        return { success: true, output: formatScreenshotResult(result) };
      } catch (e) {
        return { success: false, output: '', error: String(e) };
      }
    },
  },
  {
    name: 'browser_inspect',
    description: 'Inspect a DOM element on the page',
    usage: 'selector=<CSS selector>',
    async execute(_wd: string, args: Record<string, string>): Promise<ToolResult> {
      if (!args.selector) return { success: false, output: '', error: 'selector required' };
      try {
        const el = await inspect(args.selector);
        if (!el) return { success: false, output: '', error: 'Element not found' };
        return { success: true, output: formatDOMElement(el) };
      } catch (e) {
        return { success: false, output: '', error: String(e) };
      }
    },
  },
];

const pluginTools: ToolDefinition[] = [
  {
    name: 'plugin_list',
    description: 'List loaded plugins',
    usage: '',
    execute(): ToolResult {
      const plugins = listPlugins();
      const lines = plugins.map((p) => `  ${p.enabled ? '✓' : '✗'} ${p.manifest.name}@${p.manifest.version} — ${p.manifest.description}`);
      return { success: true, output: lines.join('\n') || 'No plugins loaded.' };
    },
  },
  {
    name: 'plugin_enable',
    description: 'Enable a plugin by name',
    usage: 'name=<plugin name>',
    execute(_wd: string, args: Record<string, string>): ToolResult {
      if (!args.name) return { success: false, output: '', error: 'name required' };
      const ok = enablePlugin(args.name);
      return ok ? { success: true, output: `Enabled ${args.name}` } : { success: false, output: '', error: `Plugin "${args.name}" not found` };
    },
  },
  {
    name: 'plugin_disable',
    description: 'Disable a plugin by name',
    usage: 'name=<plugin name>',
    execute(_wd: string, args: Record<string, string>): ToolResult {
      if (!args.name) return { success: false, output: '', error: 'name required' };
      const ok = disablePlugin(args.name);
      return ok ? { success: true, output: `Disabled ${args.name}` } : { success: false, output: '', error: `Plugin "${args.name}" not found` };
    },
  },
];

const repoTools: ToolDefinition[] = [
  {
    name: 'detect_project',
    description: 'Detect project type, framework, and stack',
    usage: '[dir=<directory>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const dir = args.dir ? path.resolve(workingDir, args.dir) : workingDir;
      const info = detectProject(dir);
      return { success: true, output: printProjectInfo(info) };
    },
  },
  {
    name: 'analyze_deps',
    description: 'Analyze dependencies and import graph',
    usage: '[dir=<directory>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const dir = args.dir ? path.resolve(workingDir, args.dir) : workingDir;
      const graph = analyzeDependencies(dir);
      return { success: true, output: printDepGraph(graph) };
    },
  },
  {
    name: 'repo_summary',
    description: 'Generate a full repository architecture summary',
    usage: '[dir=<directory>]',
    execute(workingDir: string, args: Record<string, string>): ToolResult {
      const dir = args.dir ? path.resolve(workingDir, args.dir) : workingDir;
      const summary = generateSummary(dir);
      return { success: true, output: printSummary(summary) };
    },
  },
];

loadBuiltinPlugins();

export const allTools: ToolDefinition[] = [
  ...fileTools,
  ...commandTools,
  ...searchTools,
  ...fsEngineTools,
  ...editorTools,
  ...shellTools,
  ...repoTools,
  ...memoryTools,
  ...gitTools,
  ...browserTools,
  ...pluginTools,
  ...getAllPluginTools(),
];

export function getTool(name: string): ToolDefinition | undefined {
  return allTools.find((t) => t.name === name);
}

export function listTools(): string {
  return allTools.map((t) => `  ${chalk.cyan(t.name.padEnd(20))} ${chalk.dim(t.description)}`).join('\n');
}

export function getToolNames(): string[] {
  return allTools.map((t) => t.name);
}
