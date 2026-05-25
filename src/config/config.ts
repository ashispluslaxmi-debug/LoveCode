import * as fs from 'node:fs';
import * as path from 'node:path';
import * as YAML from 'js-yaml';
import chalk from 'chalk';

export interface LoveCodeConfig {
  model: string;
  theme: string;
  approval_mode: 'smart' | 'strict' | 'permissive';
  provider?: string;
  model_params?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
  api?: {
    base_url?: string;
    timeout?: number;
  };
  performance?: {
    lazy_load: boolean;
    cache_ttl: number;
    max_memory_mb: number;
  };
  termux?: {
    low_ram: boolean;
    touch_optimized: boolean;
  };
  telemetry?: {
    enabled: boolean;
    crash_reports: boolean;
  };
  security?: {
    profile: string;
    scan_secrets: boolean;
  };
}

const DEFAULT_CONFIG: LoveCodeConfig = {
  model: 'deepseek',
  theme: 'neon',
  approval_mode: 'smart',
  performance: {
    lazy_load: true,
    cache_ttl: 300_000,
    max_memory_mb: 200,
  },
  termux: {
    low_ram: false,
    touch_optimized: false,
  },
  telemetry: {
    enabled: false,
    crash_reports: false,
  },
  security: {
    profile: 'standard',
    scan_secrets: true,
  },
};

let cachedConfig: LoveCodeConfig | null = null;
const CONFIG_FILENAME = '.lovecode/config.yaml';
const LEGACY_JSON = '.lovecode/config.json';

export function configDir(rootDir?: string): string {
  return path.resolve(rootDir || process.cwd(), '.lovecode');
}

function yamlPath(rootDir?: string): string {
  return path.resolve(configDir(rootDir), 'config.yaml');
}

function jsonPath(rootDir?: string): string {
  return path.resolve(configDir(rootDir), 'config.json');
}

export function loadConfig(rootDir?: string): LoveCodeConfig {
  if (cachedConfig) return cachedConfig;

  const merged: LoveCodeConfig = { ...DEFAULT_CONFIG };

  const yml = yamlPath(rootDir);
  const json = jsonPath(rootDir);

  let fileConfig: Record<string, any> = {};

  if (fs.existsSync(yml)) {
    try {
      const raw = fs.readFileSync(yml, 'utf-8');
      const parsed = YAML.load(raw) as Record<string, any>;
      if (parsed) fileConfig = parsed;
    } catch (err) {
      console.error(chalk.yellow(`Warning: Failed to parse ${yml}: ${err}`));
    }
  } else if (fs.existsSync(json)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(json, 'utf-8'));
    } catch {
      // ignore
    }
  }

  Object.assign(merged, fileConfig);

  if (process.env.LOVECODE_MODEL) merged.model = process.env.LOVECODE_MODEL;
  if (process.env.LOVECODE_THEME) merged.theme = process.env.LOVECODE_THEME;
  if (process.env.LOVECODE_APPROVAL_MODE) merged.approval_mode = process.env.LOVECODE_APPROVAL_MODE as LoveCodeConfig['approval_mode'];

  cachedConfig = merged;
  return merged;
}

export function saveConfig(config: LoveCodeConfig, rootDir?: string): void {
  const dir = configDir(rootDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const yml = {
    model: config.model,
    theme: config.theme,
    approval_mode: config.approval_mode,
    ...(config.provider ? { provider: config.provider } : {}),
    ...(config.model_params ? { model_params: config.model_params } : {}),
    ...(config.api ? { api: config.api } : {}),
    ...(config.performance ? { performance: config.performance } : {}),
    ...(config.termux ? { termux: config.termux } : {}),
    ...(config.telemetry ? { telemetry: config.telemetry } : {}),
    ...(config.security ? { security: config.security } : {}),
  };

  fs.writeFileSync(yamlPath(rootDir), YAML.dump(yml, { indent: 2, lineWidth: 120 }), 'utf-8');
  cachedConfig = config;
}

export function getDefaults(): LoveCodeConfig {
  return { ...DEFAULT_CONFIG };
}

export function resetConfig(rootDir?: string): void {
  const yml = yamlPath(rootDir);
  if (fs.existsSync(yml)) fs.unlinkSync(yml);
  const json = jsonPath(rootDir);
  if (fs.existsSync(json)) fs.unlinkSync(json);
  cachedConfig = null;
}

export function formatConfig(config: LoveCodeConfig): string {
  const lines: string[] = [chalk.bold('\n  LoveCode Configuration')];

  lines.push(`\n  ${chalk.dim('Model:')}          ${chalk.cyan(config.model)}`);
  lines.push(`  ${chalk.dim('Theme:')}          ${chalk.magenta(config.theme)}`);
  lines.push(`  ${chalk.dim('Approval Mode:')}  ${approvalColor(config.approval_mode)}`);

  if (config.provider) lines.push(`  ${chalk.dim('Provider:')}       ${config.provider}`);
  if (config.model_params) {
    lines.push(`\n  ${chalk.bold('Model Params:')}`);
    if (config.model_params.temperature !== undefined) lines.push(`    temperature: ${config.model_params.temperature}`);
    if (config.model_params.top_p !== undefined) lines.push(`    top_p: ${config.model_params.top_p}`);
    if (config.model_params.max_tokens !== undefined) lines.push(`    max_tokens: ${config.model_params.max_tokens}`);
  }

  if (config.performance) {
    lines.push(`\n  ${chalk.bold('Performance:')}`);
    lines.push(`    lazy_load:    ${config.performance.lazy_load ? chalk.green('✓') : chalk.red('✗')}`);
    lines.push(`    cache_ttl:    ${config.performance.cache_ttl}ms`);
    lines.push(`    max_memory:   ${config.performance.max_memory_mb}MB`);
  }

  if (config.telemetry) {
    lines.push(`\n  ${chalk.bold('Telemetry:')}`);
    lines.push(`    enabled:      ${config.telemetry.enabled ? chalk.yellow('ON') : chalk.green('OFF')}`);
    lines.push(`    crash_reports:${config.telemetry.crash_reports ? chalk.yellow('ON') : chalk.green('OFF')}`);
  }

  if (config.security) {
    lines.push(`\n  ${chalk.bold('Security:')}`);
    lines.push(`    profile:      ${config.security.profile}`);
    lines.push(`    scan_secrets: ${config.security.scan_secrets ? chalk.green('✓') : chalk.red('✗')}`);
  }

  if (config.termux) {
    lines.push(`\n  ${chalk.bold('Termux:')}`);
    lines.push(`    low_ram:       ${config.termux.low_ram ? chalk.yellow('✓') : chalk.red('✗')}`);
    lines.push(`    touch_opt:     ${config.termux.touch_optimized ? chalk.green('✓') : chalk.red('✗')}`);
  }

  return lines.join('\n');
}

function approvalColor(mode: string): string {
  switch (mode) {
    case 'strict': return chalk.red(mode);
    case 'smart': return chalk.yellow(mode);
    case 'permissive': return chalk.green(mode);
    default: return mode;
  }
}
