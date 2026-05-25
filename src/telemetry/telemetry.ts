import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequire } from 'node:module';
import chalk from 'chalk';

const _require = createRequire(import.meta.url);

interface TelemetryEvent {
  event: string;
  timestamp: number;
  properties: Record<string, string | number | boolean>;
}

interface CrashReport {
  error: string;
  stack: string;
  timestamp: number;
  version: string;
  platform: string;
}

const TELEMETRY_DIR = '.lovecode/telemetry';

let _enabled: boolean | null = null;

function telemetryDir(rootDir?: string): string {
  return path.resolve(rootDir || process.cwd(), TELEMETRY_DIR);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function isTelemetryEnabled(rootDir?: string): boolean {
  if (_enabled !== null) return _enabled;

  if (process.env.LOVECODE_TELEMETRY === 'true') {
    _enabled = true;
    return true;
  }
  if (process.env.LOVECODE_TELEMETRY === 'false') {
    _enabled = false;
    return false;
  }

  const configPath = path.resolve(rootDir || process.cwd(), '.lovecode/config.yaml');
  if (fs.existsSync(configPath)) {
    try {
      const { loadConfig } = _require('../config/config.js');
      const config = loadConfig(rootDir);
      _enabled = config.telemetry?.enabled === true;
      return _enabled;
    } catch {
      _enabled = false;
      return false;
    }
  }

  _enabled = false;
  return false;
}

export function enableTelemetry(rootDir?: string): void {
  _enabled = true;
  process.env.LOVECODE_TELEMETRY = 'true';
  try {
    const { loadConfig, saveConfig } = _require('../config/config.js');
    const config = loadConfig(rootDir);
    config.telemetry = config.telemetry || { enabled: false, crash_reports: false };
    config.telemetry.enabled = true;
    saveConfig(config, rootDir);
  } catch {
    // fallback: just set env
  }
}

export function disableTelemetry(rootDir?: string): void {
  _enabled = false;
  process.env.LOVECODE_TELEMETRY = 'false';
  try {
    const { loadConfig, saveConfig } = _require('../config/config.js');
    const config = loadConfig(rootDir);
    if (config.telemetry) config.telemetry.enabled = false;
    saveConfig(config, rootDir);
  } catch {
    // fallback
  }
}

function trackEvent(event: string, properties: Record<string, string | number | boolean> = {}): void {
  if (!isTelemetryEnabled()) return;

  const dir = telemetryDir();
  ensureDir(dir);

  const entry: TelemetryEvent = {
    event,
    timestamp: Date.now(),
    properties: {
      ...properties,
      platform: os.platform(),
      node: process.version,
    },
  };

  const filePath = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
  } catch {
    // silently fail
  }
}

export function trackCommand(command: string): void {
  trackEvent('command_executed', { command });
}

export function trackError(error: Error): void {
  if (!isTelemetryEnabled()) return;

  const dir = telemetryDir();
  ensureDir(dir);

  const report: CrashReport = {
    error: error.message,
    stack: error.stack || '',
    timestamp: Date.now(),
    version: process.env.npm_package_version || '0.1.0',
    platform: os.platform(),
  };

  const filePath = path.join(dir, `crash-${Date.now()}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(report), 'utf-8');
  } catch {
    // silently fail
  }
}

export function trackStartup(): void {
  trackEvent('startup', {});
}

export function trackShutdown(): void {
  trackEvent('shutdown', { uptime: process.uptime() });
}

export function getTelemetryData(rootDir?: string): { events: TelemetryEvent[]; crashes: CrashReport[] } {
  const dir = telemetryDir(rootDir);
  const events: TelemetryEvent[] = [];
  const crashes: CrashReport[] = [];

  if (!fs.existsSync(dir)) return { events, crashes };

  for (const file of fs.readdirSync(dir)) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const data = JSON.parse(content);
      if (file.startsWith('crash-')) {
        crashes.push(data as CrashReport);
      } else {
        events.push(data as TelemetryEvent);
      }
    } catch {
      // skip malformed
    }
  }

  return { events, crashes };
}

export function clearTelemetryData(rootDir?: string): void {
  const dir = telemetryDir(rootDir);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function formatTelemetryStatus(enabled: boolean, data: { events: TelemetryEvent[]; crashes: CrashReport[] }): string {
  const lines: string[] = [chalk.bold('\n  Telemetry Status')];
  lines.push(`  Status:     ${enabled ? chalk.yellow('ENABLED') : chalk.green('DISABLED')}`);
  lines.push(`  Events:     ${data.events.length}`);
  lines.push(`  Crashes:    ${data.crashes.length}`);

  if (data.events.length > 0) {
    lines.push(chalk.dim(`\n  Recent Events:`));
    for (const e of data.events.slice(-5)) {
      const date = new Date(e.timestamp).toLocaleString();
      lines.push(`  ${chalk.dim(date)} ${e.event}`);
    }
  }

  return lines.join('\n');
}
