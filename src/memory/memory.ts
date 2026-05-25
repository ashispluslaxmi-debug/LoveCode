import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CodingPreferences {
  indentStyle: 'spaces' | 'tabs';
  indentSize: number;
  quoteStyle: 'single' | 'double';
  semiColons: boolean;
  trailingComma: boolean;
  preferredTestRunner: string;
  preferredPackageManager: string;
  preferredLinter: string;
  custom: Record<string, string>;
}

export interface RepoMemory {
  lastScan: number;
  totalFiles: number;
  totalDirs: number;
  primaryLanguage: string;
  frameworks: string[];
  entryPoints: string[];
  keyDirectories: string[];
  buildCommands: string[];
  testCommands: string[];
  notes: string[];
}

export interface WorkflowMemory {
  workflows: Workflow[];
}

export interface Workflow {
  name: string;
  description: string;
  steps: string[];
  tags: string[];
  created: number;
  used: number;
}

function getMemoryDir(rootDir?: string): string {
  const base = rootDir || process.cwd();
  return path.join(base, '.lovecode', 'memory');
}

function getMemoryFilePath(key: string, rootDir?: string): string {
  return path.join(getMemoryDir(rootDir), `${key}.json`);
}

function ensureMemoryDir(rootDir?: string): void {
  const dir = getMemoryDir(rootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readMemory<T>(key: string, fallback: T, rootDir?: string): T {
  const filePath = getMemoryFilePath(key, rootDir);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeMemory<T>(key: string, data: T, rootDir?: string): void {
  ensureMemoryDir(rootDir);
  const filePath = getMemoryFilePath(key, rootDir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export const DEFAULT_PREFERENCES: CodingPreferences = {
  indentStyle: 'spaces',
  indentSize: 2,
  quoteStyle: 'single',
  semiColons: true,
  trailingComma: true,
  preferredTestRunner: 'vitest',
  preferredPackageManager: 'npm',
  preferredLinter: 'eslint',
  custom: {},
};

export const DEFAULT_REPO: RepoMemory = {
  lastScan: 0,
  totalFiles: 0,
  totalDirs: 0,
  primaryLanguage: '',
  frameworks: [],
  entryPoints: [],
  keyDirectories: [],
  buildCommands: [],
  testCommands: [],
  notes: [],
};

export const DEFAULT_WORKFLOWS: WorkflowMemory = {
  workflows: [],
};

export function getPreferences(rootDir?: string): CodingPreferences {
  return readMemory<CodingPreferences>('preferences', DEFAULT_PREFERENCES, rootDir);
}

export function savePreferences(prefs: Partial<CodingPreferences>, rootDir?: string): CodingPreferences {
  const current = getPreferences(rootDir);
  const updated: CodingPreferences = { ...current, ...prefs };
  writeMemory('preferences', updated, rootDir);
  return updated;
}

export function getRepoMemory(rootDir?: string): RepoMemory {
  return readMemory<RepoMemory>('repo', DEFAULT_REPO, rootDir);
}

export function saveRepoMemory(data: Partial<RepoMemory>, rootDir?: string): RepoMemory {
  const current = getRepoMemory(rootDir);
  const updated: RepoMemory = { ...current, ...data };
  writeMemory('repo', updated, rootDir);
  return updated;
}

export function getWorkflows(rootDir?: string): WorkflowMemory {
  return readMemory<WorkflowMemory>('workflows', DEFAULT_WORKFLOWS, rootDir);
}

export function saveWorkflow(workflow: Workflow, rootDir?: string): WorkflowMemory {
  const current = getWorkflows(rootDir);
  const existingIdx = current.workflows.findIndex((w) => w.name === workflow.name);
  if (existingIdx >= 0) {
    current.workflows[existingIdx] = workflow;
  } else {
    current.workflows.push(workflow);
  }
  writeMemory('workflows', current, rootDir);
  return current;
}

export function deleteWorkflow(name: string, rootDir?: string): boolean {
  const current = getWorkflows(rootDir);
  const before = current.workflows.length;
  current.workflows = current.workflows.filter((w) => w.name !== name);
  if (current.workflows.length < before) {
    writeMemory('workflows', current, rootDir);
    return true;
  }
  return false;
}

export function addRepoNote(note: string, rootDir?: string): RepoMemory {
  const current = getRepoMemory(rootDir);
  current.notes.push(note);
  if (current.notes.length > 50) current.notes = current.notes.slice(-50);
  writeMemory('repo', current, rootDir);
  return current;
}

export function clearAllMemory(rootDir?: string): void {
  const dir = getMemoryDir(rootDir);
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
  }
}

export function formatPreferences(prefs: CodingPreferences): string {
  const lines: string[] = ['Coding Preferences:'];
  lines.push(`  Indent: ${prefs.indentStyle} (${prefs.indentSize})`);
  lines.push(`  Quotes: ${prefs.quoteStyle}`);
  lines.push(`  Semicolons: ${prefs.semiColons ? 'yes' : 'no'}`);
  lines.push(`  Trailing commas: ${prefs.trailingComma ? 'yes' : 'no'}`);
  lines.push(`  Test runner: ${prefs.preferredTestRunner}`);
  lines.push(`  Package manager: ${prefs.preferredPackageManager}`);
  lines.push(`  Linter: ${prefs.preferredLinter}`);
  if (Object.keys(prefs.custom).length > 0) {
    lines.push('  Custom:');
    for (const [k, v] of Object.entries(prefs.custom)) {
      lines.push(`    ${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

export function formatRepoMemory(mem: RepoMemory): string {
  const lines: string[] = ['Repo Memory:'];
  lines.push(`  Last scanned: ${mem.lastScan ? new Date(mem.lastScan).toISOString() : 'never'}`);
  lines.push(`  Files: ${mem.totalFiles}  Dirs: ${mem.totalDirs}`);
  if (mem.primaryLanguage) lines.push(`  Primary language: ${mem.primaryLanguage}`);
  if (mem.frameworks.length) lines.push(`  Frameworks: ${mem.frameworks.join(', ')}`);
  if (mem.entryPoints.length) lines.push(`  Entry points: ${mem.entryPoints.join(', ')}`);
  if (mem.keyDirectories.length) lines.push(`  Key dirs: ${mem.keyDirectories.join(', ')}`);
  if (mem.buildCommands.length) lines.push(`  Build: ${mem.buildCommands.join(', ')}`);
  if (mem.testCommands.length) lines.push(`  Test: ${mem.testCommands.join(', ')}`);
  if (mem.notes.length) lines.push(`  Notes (${mem.notes.length}):`);
  for (const note of mem.notes.slice(-5)) {
    lines.push(`    • ${note}`);
  }
  return lines.join('\n');
}
