import { describe, it, expect } from 'vitest';
import { scanDirectory } from '../fs/scanner.js';
import { findFiles, semanticSearch } from '../fs/search.js';
import { rankFiles } from '../fs/rank.js';
import { isIgnored, loadIgnoreRules } from '../fs/ignore.js';

describe('FS Engine - Scanner', () => {
  it('scans directories recursively', () => {
    const files = scanDirectory({ rootDir: '/workspaces/LoveCode/src', maxDepth: 2, maxFiles: 200 });
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((f) => f.extension === '.ts')).toBe(true);
  });

  it('categorizes files correctly', () => {
    const files = scanDirectory({ rootDir: '/workspaces/LoveCode/src', maxDepth: 3, maxFiles: 200 });
    const sourceFiles = files.filter((f) => f.category === 'source');
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('respects maxDepth', () => {
    const shallow = scanDirectory({ rootDir: '/workspaces/LoveCode', maxDepth: 1, maxFiles: 100 });
    const deep = scanDirectory({ rootDir: '/workspaces/LoveCode', maxDepth: 10, maxFiles: 100 });
    expect(deep.length).toBeGreaterThanOrEqual(shallow.length);
  });
});

describe('FS Engine - Ignore', () => {
  it('loads ignore rules', () => {
    const rules = loadIgnoreRules('/workspaces/LoveCode');
    expect(rules.patterns.length).toBeGreaterThan(0);
  });

  it('ignores node_modules', () => {
    const rules = loadIgnoreRules('/workspaces/LoveCode');
    expect(isIgnored('node_modules/foo/bar.js', rules)).toBe(true);
  });

  it('does not ignore source files', () => {
    const rules = loadIgnoreRules('/workspaces/LoveCode');
    expect(isIgnored('src/index.ts', rules)).toBe(false);
  });
});

describe('FS Engine - Search', () => {
  it('finds files by name', () => {
    const results = findFiles({ rootDir: '/workspaces/LoveCode/src', query: 'agent', maxResults: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.relativePath.includes('agent'))).toBe(true);
  });

  it('semantic search works', () => {
    const results = semanticSearch('autonomous agent', '/workspaces/LoveCode/src');
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('FS Engine - Ranking', () => {
  it('ranks files by importance', () => {
    const files = scanDirectory({ rootDir: '/workspaces/LoveCode/src', maxDepth: 5, maxFiles: 500 });
    const ranked = rankFiles(files, 'autonomous agent');
    expect(ranked.length).toBe(files.length);
    expect(ranked[0].rankScore).toBeGreaterThanOrEqual(ranked[ranked.length - 1].rankScore);
  });

  it('boosts task-relevant files', () => {
    const files = scanDirectory({ rootDir: '/workspaces/LoveCode/src', maxDepth: 5, maxFiles: 500 });
    const ranked = rankFiles(files, 'agent');
    const top = ranked.slice(0, 5);
    expect(top.some((f) => f.relativePath.includes('agent'))).toBe(true);
  });
});
