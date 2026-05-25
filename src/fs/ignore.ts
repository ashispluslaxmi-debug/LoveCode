import * as fs from 'node:fs';
import * as path from 'node:path';

export interface IgnoreRules {
  patterns: string[];
  negations: string[];
}

function parseGitignore(content: string): IgnoreRules {
  const patterns: string[] = [];
  const negations: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('!')) {
      negations.push(trimmed.slice(1));
    } else {
      patterns.push(trimmed);
    }
  }

  return { patterns, negations };
}

function loadFile(dir: string, filename: string): IgnoreRules | null {
  const filePath = path.join(dir, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseGitignore(content);
  } catch {
    return null;
  }
}

export function loadIgnoreRules(rootDir: string): IgnoreRules {
  const rules: IgnoreRules = { patterns: [], negations: [] };

  const gitignore = loadFile(rootDir, '.gitignore');
  if (gitignore) {
    rules.patterns.push(...gitignore.patterns);
    rules.negations.push(...gitignore.negations);
  }

  const lovecodeignore = loadFile(rootDir, '.lovecodeignore');
  if (lovecodeignore) {
    rules.patterns.push(...lovecodeignore.patterns);
    rules.negations.push(...lovecodeignore.negations);
  }

  rules.patterns.push('node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**');

  return rules;
}

export function isIgnored(relativePath: string, rules: IgnoreRules): boolean {
  const normalized = relativePath.replace(/\\/g, '/');

  for (const negation of rules.negations) {
    if (matchPattern(normalized, negation)) return false;
  }

  for (const pattern of rules.patterns) {
    if (matchPattern(normalized, pattern)) return true;
  }

  return false;
}

function matchPattern(filePath: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    if (filePath.startsWith(pattern) || filePath === pattern.slice(0, -1)) return true;
  }

  if (pattern.startsWith('/')) {
    return matchSimple(filePath, pattern.slice(1));
  }

  if (matchSimple(filePath, pattern)) return true;

  const basename = path.basename(filePath);
  if (isGlobless(pattern) && basename === pattern) return true;

  return false;
}

function isGlobless(pattern: string): boolean {
  return !pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[');
}

function matchSimple(filePath: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filePath.split('/').slice(-pattern.split('/').length).join('/'));
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLESTAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLESTAR___/g, '.*')
    .replace(/\?/g, '[^/]');

  return new RegExp(`^${escaped}$`);
}
