import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface SearchResult {
  filePath: string;
  relativePath: string;
  matches?: Array<{ line: number; content: string }>;
  score: number;
}

export interface SearchOptions {
  rootDir: string;
  query: string;
  maxResults?: number;
  includeContent?: boolean;
}

function normalizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0);
}

function scoreByName(filename: string, query: string): number {
  const lower = filename.toLowerCase();
  const qLower = query.toLowerCase();
  let score = 0;

  if (lower === qLower) score += 100;
  else if (lower.includes(qLower)) score += 50;
  else if (lower.startsWith(qLower)) score += 40;

  const queryWords = normalizeQuery(query);
  const nameWords = normalizeQuery(filename.replace(/[.-]/g, ' '));

  for (const qw of queryWords) {
    for (const nw of nameWords) {
      if (nw === qw) score += 20;
      else if (nw.startsWith(qw) || nw.endsWith(qw)) score += 10;
      else if (nw.includes(qw)) score += 5;
    }
  }

  return score;
}

function collectAllFiles(dir: string, maxFiles: number = 5000): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    if (results.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

export function findFiles(options: SearchOptions): SearchResult[] {
  const { rootDir, query, maxResults = 20 } = options;
  const allFiles = collectAllFiles(rootDir);
  const scored: SearchResult[] = [];

  for (const filePath of allFiles) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const basename = path.basename(filePath);
    const score = scoreByName(basename, query) + scoreByName(relativePath, query) * 0.5;

    if (score > 0) {
      scored.push({
        filePath,
        relativePath,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, maxResults);

  if (options.includeContent) {
    for (const result of results) {
      result.matches = searchFileContent(result.filePath, query);
    }
  }

  return results;
}

function searchFileContent(filePath: string, query: string): Array<{ line: number; content: string }> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: Array<{ line: number; content: string }> = [];
    const lowerQuery = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        matches.push({ line: i + 1, content: lines[i].trim() });
        if (matches.length >= 10) break;
      }
    }

    return matches;
  } catch {
    return [];
  }
}

export function findWithRipgrep(query: string, rootDir: string): SearchResult[] {
  try {
    const cmd = `rg -l -i '${query.replace(/'/g, "'\\''")}' 2>/dev/null`;
    const output = execSync(cmd, { cwd: rootDir, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    const files = output.trim().split('\n').filter(Boolean);

    return files.slice(0, 30).map((filePath) => ({
      filePath: path.join(rootDir, filePath),
      relativePath: filePath,
      score: 50,
    }));
  } catch {
    return [];
  }
}

export function semanticSearch(query: string, rootDir: string): SearchResult[] {
  const nameResults = findFiles({ rootDir, query, maxResults: 15 });
  const namePaths = new Set(nameResults.map((r) => r.relativePath));

  let contentResults: SearchResult[] = [];
  try {
    contentResults = findWithRipgrep(query, rootDir);
  } catch {
    const textFiles = collectAllFiles(rootDir, 2000).filter((f) => {
      const ext = path.extname(f);
      return ['.ts', '.js', '.py', '.rs', '.go', '.md', '.json', '.txt', '.yaml', '.yml'].includes(ext);
    });

    for (const filePath of textFiles.slice(0, 100)) {
      const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
      if (namePaths.has(relativePath)) continue;
      const matches = searchFileContent(filePath, query);
      if (matches.length > 0) {
        contentResults.push({
          filePath,
          relativePath,
          matches,
          score: 10 + matches.length,
        });
      }
    }
  }

  const combined = [...nameResults];
  for (const cr of contentResults) {
    if (!namePaths.has(cr.relativePath)) {
      combined.push(cr);
    }
  }

  combined.sort((a, b) => b.score - a.score);
  return combined.slice(0, 20);
}
