import { describe, it, expect } from 'vitest';
import { isTermux, isCodespaces, lowRamMode, platformInfo } from '../platform/detect.js';
import { startTimer, endTimer, measure, measureAsync } from '../performance/bench.js';

describe('Platform Detection', () => {
  it('detects not termux in CI', () => {
    expect(isTermux()).toBe(false);
  });

  it('detects codespaces via env var', () => {
    const before = process.env.CODESPACES;
    process.env.CODESPACES = 'true';
    expect(isCodespaces()).toBe(true);
    if (before) process.env.CODESPACES = before;
    else delete process.env.CODESPACES;
  });

  it('returns platform info', () => {
    const info = platformInfo();
    expect(info.length).toBeGreaterThanOrEqual(4);
    expect(info.some((l) => l.startsWith('OS:'))).toBe(true);
    expect(info.some((l) => l.startsWith('RAM:'))).toBe(true);
  });

  it('lowRamMode respects env var', () => {
    process.env.LOVECODE_LOW_RAM = 'true';
    expect(lowRamMode()).toBe(true);
    delete process.env.LOVECODE_LOW_RAM;
  });
});

describe('Performance Benchmarks', () => {
  it('measures sync functions', () => {
    const result = measure('test-sync', () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      return sum;
    });
    expect(result).toBe(499500);
  });

  it('measures async functions', async () => {
    const result = await measureAsync('test-async', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'done';
    }, 100);
    expect(result).toBe('done');
  });

  it('startTimer and endTimer return elapsed time', () => {
    startTimer('test-timer');
    const elapsed = endTimer('test-timer');
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('endTimer returns -1 for unknown timer', () => {
    expect(endTimer('nonexistent')).toBe(-1);
  });
});
