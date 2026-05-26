import { performance } from 'node:perf_hooks';

const marks: Map<string, number> = new Map();

export function startTimer(label: string): void {
  marks.set(label, performance.now());
}

export function endTimer(label: string): number {
  const start = marks.get(label);
  if (start === undefined) return -1;
  const elapsed = performance.now() - start;
  marks.delete(label);
  return elapsed;
}

export function logTimer(label: string, thresholdMs?: number): number {
  const elapsed = endTimer(label);
  if (thresholdMs === undefined || elapsed > thresholdMs) {
    const warn = thresholdMs !== undefined && elapsed > thresholdMs ? ' ⚠' : '';
    const color = elapsed > 100 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}  ${label}: ${elapsed.toFixed(1)}ms\x1b[0m${warn}`);
  }
  return elapsed;
}

export function measure<T>(label: string, fn: () => T): T {
  startTimer(label);
  try {
    return fn();
  } finally {
    endTimer(label);
  }
}

export async function measureAsync<T>(label: string, fn: () => Promise<T>, thresholdMs?: number): Promise<T> {
  startTimer(label);
  try {
    return await fn();
  } finally {
    logTimer(label, thresholdMs);
  }
}

export function startupTime(): number {
  const now = performance.now();
  return now;
}

export function measureStartup(): { total: number; imports: number; config: number } {
  startTimer('startup.total');
  startTimer('startup.imports');
  const importTime = endTimer('startup.imports');

  startTimer('startup.config');
  const configTime = endTimer('startup.config');

  const total = endTimer('startup.total');
  return { total, imports: importTime, config: configTime };
}
