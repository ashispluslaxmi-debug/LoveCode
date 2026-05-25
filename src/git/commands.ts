import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GitStatus {
  branch: string;
  behind: number;
  ahead: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicted: string[];
  clean: boolean;
}

export interface GitLogEntry {
  hash: string;
  date: string;
  author: string;
  message: string;
}

export interface BranchInfo {
  current: boolean;
  name: string;
  remote?: string;
  behind: number;
  ahead: number;
}

interface ExecResult { stdout: string; stderr: string; failed: boolean }

function exec(cmd: string, cwd?: string): ExecResult {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });
    return { stdout: stdout.trim(), stderr: '', failed: false };
  } catch (err: unknown) {
    const e = err as { stderr?: string | Buffer; stdout?: string | Buffer; message: string; status?: number };
    const toStr = (v: string | Buffer | undefined): string => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      return v.toString('utf-8');
    };
    const stdout = toStr(e.stdout).trim();
    const stderr = toStr(e.stderr).trim();
    return { stdout, stderr: stderr || e.message, failed: true };
  }
}

export function isGitAvailable(): boolean {
  try {
    execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getGitRoot(cwd?: string): string | null {
  const result = exec('git rev-parse --show-toplevel', cwd);
  if (result.stderr) return null;
  return result.stdout;
}

export function isRepo(cwd?: string): boolean {
  return getGitRoot(cwd) !== null;
}

export function getCurrentBranch(cwd?: string): string {
  const result = exec('git rev-parse --abbrev-ref HEAD', cwd);
  return result.stdout || 'unknown';
}

export function getStatus(cwd?: string): GitStatus {
  const root = getGitRoot(cwd);
  const defaultCwd = root || cwd || process.cwd();

  const branchStr = exec('git status --branch --porcelain=v2', defaultCwd);
  const branch = getCurrentBranch(defaultCwd);

  let behind = 0;
  let ahead = 0;
  const behindMatch = branchStr.stdout.match(/# branch\.ab \+(\d+) \-(\d+)/);
  if (behindMatch) {
    ahead = parseInt(behindMatch[1], 10);
    behind = parseInt(behindMatch[2], 10);
  }

  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  const conflicted: string[] = [];

  for (const line of branchStr.stdout.split('\n')) {
    if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const parts = line.split(' ');
      const xy = parts[0].slice(0, 2);
      const isStaged = xy[0] !== '.' && xy[0] !== ' ';
      const isUnstaged = xy[1] !== '.' && xy[1] !== ' ';
      const path = parts[parts.length - 1];

      if (xy[0] === 'u' || xy[1] === 'u') {
        conflicted.push(path);
      } else {
        if (isStaged) staged.push(path);
        if (isUnstaged) unstaged.push(path);
      }
    } else if (line.startsWith('? ')) {
      untracked.push(line.slice(2));
    }
  }

  return {
    branch,
    behind,
    ahead,
    staged,
    unstaged,
    untracked,
    conflicted,
    clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0 && conflicted.length === 0,
  };
}

export function stageAll(cwd?: string): boolean {
  const root = getGitRoot(cwd);
  const result = exec('git add -A', root || cwd);
  return !result.failed;
}

export function stageFiles(files: string[], cwd?: string): boolean {
  const root = getGitRoot(cwd);
  if (!root) return false;
  const result = exec(`git add -- ${files.map((f) => `"${f}"`).join(' ')}`, root);
  return !result.failed;
}

export function commit(message: string, cwd?: string): { success: boolean; hash?: string; output: string } {
  const root = getGitRoot(cwd);
  if (!root) return { success: false, output: 'Not a git repository' };

  const result = exec(`git commit -m "${message.replace(/"/g, '\\"')}"`, root);
  const output = (result.stdout + '\n' + result.stderr).toLowerCase();
  if (output.includes('nothing to commit')) {
    return { success: false, output: 'Nothing to commit. Working tree clean.' };
  }
  if (result.failed) {
    return { success: false, output: result.stderr || result.stdout };
  }

  const hashMatch = result.stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
  return {
    success: true,
    hash: hashMatch?.[1],
    output: result.stdout,
  };
}

export function getDiff(cwd?: string): string {
  const root = getGitRoot(cwd);
  if (!root) return '';
  const result = exec('git diff --staged', root);
  if (result.stdout) return result.stdout;
  const unstaged = exec('git diff', root);
  return unstaged.stdout;
}

export function getStagedDiff(cwd?: string): string {
  const root = getGitRoot(cwd);
  if (!root) return '';
  const result = exec('git diff --cached', root);
  return result.stdout;
}

export function getUnstagedDiff(cwd?: string): string {
  const root = getGitRoot(cwd);
  if (!root) return '';
  const result = exec('git diff', root);
  return result.stdout;
}

export function getFullDiff(cwd?: string): string {
  const root = getGitRoot(cwd);
  if (!root) return '';
  const result = exec('git diff HEAD', root);
  return result.stdout;
}

export function getLog(count: number = 10, cwd?: string): GitLogEntry[] {
  const root = getGitRoot(cwd);
  if (!root) return [];
  const result = exec(`git log --oneline --format="%H|%ai|%an|%s" --max-count=${count}`, root);
  if (!result.stdout) return [];

  return result.stdout.split('\n').map((line) => {
    const [hash, date, author, ...msgParts] = line.split('|');
    return { hash, date, author, message: msgParts.join('|') };
  });
}

export function getBranches(cwd?: string): BranchInfo[] {
  const root = getGitRoot(cwd);
  if (!root) return [];

  const result = exec('git branch -v', root);
  if (!result.stdout) return [];

  const branches: BranchInfo[] = [];
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const current = line.startsWith('* ');
    const parts = trimmed.replace(/^\*\s*/, '').split(/\s+/);
    const name = parts[0];
    branches.push({ current, name, behind: 0, ahead: 0 });
  }
  return branches;
}

export function createBranch(name: string, cwd?: string): boolean {
  const root = getGitRoot(cwd);
  if (!root) return false;
  const result = exec(`git checkout -b "${name}"`, root);
  return !result.failed;
}

export function switchBranch(name: string, cwd?: string): { success: boolean; output: string } {
  const root = getGitRoot(cwd);
  if (!root) return { success: false, output: 'Not a git repository' };
  const result = exec(`git checkout "${name}"`, root);
  if (result.failed) return { success: false, output: result.stderr || result.stdout };
  return { success: true, output: result.stdout || result.stderr };
}

export function deleteBranch(name: string, force: boolean = false, cwd?: string): { success: boolean; output: string } {
  const root = getGitRoot(cwd);
  if (!root) return { success: false, output: 'Not a git repository' };
  const flag = force ? '-D' : '-d';
  const result = exec(`git branch ${flag} "${name}"`, root);
  if (result.failed) return { success: false, output: result.stderr || result.stdout };
  return { success: true, output: result.stdout || result.stderr };
}

export function cleanupMergedBranches(cwd?: string): string[] {
  const root = getGitRoot(cwd);
  if (!root) return [];
  const current = getCurrentBranch(root);

  const result = exec('git branch --merged', root);
  const deleted: string[] = [];
  for (const line of result.stdout.split('\n')) {
    const name = line.trim().replace(/^\*\s*/, '');
    if (name && name !== current && name !== 'main' && name !== 'master') {
      const del = deleteBranch(name, false, root);
      if (del.success) deleted.push(name);
    }
  }
  return deleted;
}

export function getPRDiff(baseBranch: string = 'main', cwd?: string): string {
  const root = getGitRoot(cwd);
  if (!root) return '';
  const result = exec(`git diff ${baseBranch}...HEAD`, root);
  return result.stdout;
}

export function getPRLog(baseBranch: string = 'main', cwd?: string): GitLogEntry[] {
  const root = getGitRoot(cwd);
  if (!root) return [];
  const result = exec(`git log ${baseBranch}..HEAD --oneline --format="%H|%ai|%an|%s"`, root);
  if (!result.stdout) return [];
  return result.stdout.split('\n').map((line) => {
    const [hash, date, author, ...msgParts] = line.split('|');
    return { hash, date, author, message: msgParts.join('|') };
  });
}

export function hasConflicts(cwd?: string): boolean {
  const root = getGitRoot(cwd);
  if (!root) return false;
  const result = exec('git diff --name-only --diff-filter=U', root);
  return result.stdout.trim().length > 0;
}

export function getConflictFiles(cwd?: string): string[] {
  const root = getGitRoot(cwd);
  if (!root) return [];
  const result = exec('git diff --name-only --diff-filter=U', root);
  return result.stdout ? result.stdout.split('\n').filter(Boolean) : [];
}

export function getConflictMarkers(filePath: string, cwd?: string): Array<{ line: number; type: 'ours' | 'theirs' | 'separator' | 'start' | 'end' }> {
  const root = getGitRoot(cwd);
  const fullPath = root ? path.join(root, filePath) : filePath;
  if (!fs.existsSync(fullPath)) return [];

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const markers: Array<{ line: number; type: 'ours' | 'theirs' | 'separator' | 'start' | 'end' }> = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('<<<<<<<')) markers.push({ line: i + 1, type: 'start' });
    else if (l.startsWith('=======')) markers.push({ line: i + 1, type: 'separator' });
    else if (l.startsWith('>>>>>>>')) markers.push({ line: i + 1, type: 'end' });
  }
  return markers;
}

export function formatStatus(status: GitStatus): string {
  const lines: string[] = [
    `Branch: ${status.branch}`,
    status.clean ? '(clean)' : '',
  ].filter(Boolean);

  if (status.behind || status.ahead) {
    lines.push(`  ${status.behind > 0 ? `${status.behind} behind` : ''}${status.behind && status.ahead ? ', ' : ''}${status.ahead > 0 ? `${status.ahead} ahead` : ''}`);
  }

  for (const [label, items] of [['Staged', status.staged], ['Unstaged', status.unstaged], ['Untracked', status.untracked], ['Conflicted', status.conflicted]] as const) {
    if (items.length > 0) {
      lines.push(`  ${label}:`);
      for (const item of items.slice(0, 20)) {
        lines.push(`    ${item}`);
      }
      if (items.length > 20) lines.push(`    ... and ${items.length - 20} more`);
    }
  }
  return lines.join('\n');
}

export function formatBranches(branches: BranchInfo[]): string {
  return branches.map((b) => `${b.current ? '* ' : '  '}${b.name}`).join('\n');
}

export function formatLog(log: GitLogEntry[]): string {
  return log.map((e) => `${e.hash.slice(0, 8)}  ${e.date.slice(0, 10)}  ${e.author}  ${e.message}`).join('\n');
}

export function abbreviateDiff(diff: string, maxLines: number = 100): string {
  const lines = diff.split('\n');
  if (lines.length <= maxLines) return diff;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
}
