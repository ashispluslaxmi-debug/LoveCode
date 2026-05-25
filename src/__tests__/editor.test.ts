import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkBraceBalance } from '../editor/ast.js';
import { applyInlinePatch, generateDiff } from '../editor/patch.js';
import { createSnapshot, listSnapshots } from '../editor/snapshot.js';
import { saveUndoPoint, undoForFile, getUndoHistory, clearUndoHistory } from '../editor/undo.js';

describe('Editor Engine - AST', () => {
  it('detects balanced braces', () => {
    const result = checkBraceBalance('function foo() { return [1, 2, 3]; }');
    expect(result.valid).toBe(true);
  });

  it('detects unbalanced braces', () => {
    const result = checkBraceBalance('function foo() { return [1, 2, 3;');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles nested braces', () => {
    const code = `if (true) {
  if (false) {
    console.log("nested");
  }
}`;
    const result = checkBraceBalance(code);
    expect(result.valid).toBe(true);
  });

  it('detects unexpected closing brace', () => {
    const result = checkBraceBalance('function foo() { } }');
    expect(result.valid).toBe(false);
  });
});

describe('Editor Engine - Patch', () => {
  it('generates diff for changed lines', () => {
    const oldLines = ['const x = 1;', 'const y = 2;'];
    const newLines = ['const x = 1;', 'const y = 42;'];
    const diff = generateDiff(oldLines, newLines);
    expect(diff).toContain('y = 2');
    expect(diff).toContain('y = 42');
  });

  it('reports no changes for identical content', () => {
    const lines = ['const x = 1;'];
    const diff = generateDiff(lines, lines);
    expect(diff).toContain('no changes');
  });

  it('applies inline patch', () => {
    const testFile = '/tmp/lovecode-test-patch.txt';
    fs.writeFileSync(testFile, 'const x = null;\nconst y = 1;\n', 'utf-8');

    const result = applyInlinePatch(testFile, 'const x = null;', 'const x = {};');
    expect(result.success).toBe(true);
    expect(result.applied).toBe(true);

    const content = fs.readFileSync(testFile, 'utf-8');
    expect(content).toContain('const x = {};');
    expect(content).not.toContain('const x = null;');

    fs.unlinkSync(testFile);
  });
});

describe('Editor Engine - Snapshot', () => {
  const testDir = '/tmp/lovecode-test-snap';
  const testFile = path.join(testDir, 'test.txt');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testFile, 'hello world', 'utf-8');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates snapshots', () => {
    const snap = createSnapshot(testDir, testFile, 'test');
    expect(snap).not.toBeNull();
    expect(snap!.relativePath).toBe('test.txt');
    expect(snap!.size).toBe(11);
  });

  it('lists snapshots', () => {
    const snaps = listSnapshots(testDir);
    expect(snaps.length).toBeGreaterThan(0);
    expect(snaps[0].label).toBe('test');
  });
});

describe('Editor Engine - Undo', () => {
  const testDir = '/tmp/lovecode-test-undo';
  const testFile = path.join(testDir, 'test.txt');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testFile, 'original content', 'utf-8');
  });

  afterAll(() => {
    clearUndoHistory(testDir);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('saves undo points', () => {
    const entry = saveUndoPoint(testDir, testFile, 'test edit');
    expect(entry).not.toBeNull();
    expect(entry!.label).toBe('test edit');
  });

  it('shows undo history', () => {
    const history = getUndoHistory(testDir);
    expect(history.length).toBeGreaterThan(0);
  });

  it('restores file on undo', () => {
    saveUndoPoint(testDir, testFile, 'before modification');
    fs.writeFileSync(testFile, 'modified content', 'utf-8');

    const result = undoForFile(testDir, testFile);
    expect(result).not.toBeNull();

    const content = fs.readFileSync(testFile, 'utf-8');
    expect(content).toBe('original content');
  });
});
