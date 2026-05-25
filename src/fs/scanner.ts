import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { loadIgnoreRules, isIgnored } from './ignore.js';

export interface ScannedFile {
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: Date;
  extension: string;
  category: FileCategory;
}

export type FileCategory = 'source' | 'config' | 'doc' | 'script' | 'data' | 'other';

export interface ScanOptions {
  rootDir: string;
  maxDepth?: number;
  maxFiles?: number;
  includeHidden?: boolean;
  categories?: FileCategory[];
}

const sourceExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.py', '.rs', '.go', '.rb', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.php', '.r', '.scala', '.ex', '.exs',
]);

const configExtensions = new Set([
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.env', '.env.example', '.editorconfig', '.prettierrc', '.eslintrc',
  'tsconfig.json', 'package.json', 'Dockerfile', 'Makefile',
]);

const docExtensions = new Set([
  '.md', '.mdx', '.txt', '.rst', '.adoc', '.wiki', '.org',
]);

const scriptExtensions = new Set([
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
]);

const dataExtensions = new Set([
  '.csv', '.tsv', '.jsonl', '.xml', '.sql', '.graphql', '.proto',
]);

function categorize(ext: string, basename: string): FileCategory {
  if (sourceExtensions.has(ext)) return 'source';
  if (configExtensions.has(ext) || configExtensions.has(basename)) return 'config';
  if (docExtensions.has(ext)) return 'doc';
  if (scriptExtensions.has(ext)) return 'script';
  if (dataExtensions.has(ext)) return 'data';
  return 'other';
}

export function scanDirectory(options: ScanOptions): ScannedFile[] {
  const { rootDir, maxDepth = 20, maxFiles = 10000, includeHidden = false } = options;

  const rules = loadIgnoreRules(rootDir);
  const results: ScannedFile[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth || results.length >= maxFiles) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (relativePath.startsWith('..')) continue;

      const isHidden = entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '..';
      if (isHidden && !includeHidden) {
        if (entry.isDirectory()) continue;
        const skipHiddenConfig = entry.name === '.gitignore' || entry.name === '.env';
        if (!skipHiddenConfig) continue;
      }

      if (isIgnored(relativePath, rules)) continue;

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const stats = fs.statSync(fullPath);
        const relative = relativePath.replace(/\\/g, '/');

        results.push({
          path: fullPath,
          relativePath: relative,
          size: stats.size,
          modifiedAt: stats.mtime,
          extension: ext,
          category: categorize(ext, entry.name),
        });
      }
    }
  }

  walk(rootDir, 0);

  if (options.categories && options.categories.length > 0) {
    return results.filter((f) => options.categories!.includes(f.category));
  }

  return results;
}

export function getFilesByCategory(files: ScannedFile[]): Record<FileCategory, ScannedFile[]> {
  const grouped: Record<string, ScannedFile[]> = {
    source: [],
    config: [],
    doc: [],
    script: [],
    data: [],
    other: [],
  };

  for (const file of files) {
    grouped[file.category].push(file);
  }

  return grouped as Record<FileCategory, ScannedFile[]>;
}

export function printScanSummary(files: ScannedFile[]): string {
  const grouped = getFilesByCategory(files);
  const total = files.length;

  const categoryColors: Record<FileCategory, (s: string) => string> = {
    source: chalk.cyan,
    config: chalk.yellow,
    doc: chalk.green,
    script: chalk.magenta,
    data: chalk.blue,
    other: chalk.gray,
  };

  const lines: string[] = [chalk.bold(`\n  Scanned ${total} files`)];
  for (const [category, catFiles] of Object.entries(grouped)) {
    if (catFiles.length > 0) {
      const color = categoryColors[category as FileCategory] || chalk.gray;
      lines.push(`  ${color(category.padEnd(10))} ${catFiles.length} files`);
    }
  }

  return lines.join('\n');
}
