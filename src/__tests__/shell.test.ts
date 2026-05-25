import { describe, it, expect } from 'vitest';
import { evaluateCommand, createDefaultPolicy, printSandboxVerdict } from '../shell/sandbox.js';

describe('Shell Engine - Sandbox', () => {
  it('allows safe commands', () => {
    const policy = createDefaultPolicy();
    expect(evaluateCommand('npm test', policy).allowed).toBe(true);
    expect(evaluateCommand('ls -la', policy).allowed).toBe(true);
    expect(evaluateCommand('git status', policy).allowed).toBe(true);
  });

  it('blocks dangerous commands', () => {
    const policy = createDefaultPolicy();
    expect(evaluateCommand('rm -rf /', policy).allowed).toBe(false);
    expect(evaluateCommand('sudo rm -rf /etc', policy).allowed).toBe(false);
  });

  it('produces verdict output', () => {
    const verdict = evaluateCommand('npm install', createDefaultPolicy());
    const output = printSandboxVerdict(verdict);
    expect(output.length).toBeGreaterThan(0);
  });
});
