import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { loadConfig, saveConfig, getDefaults, formatConfig } from '../config/config.js';
import { saveEnv, KNOWN_ENV_VARS } from '../config/env.js';

export interface SetupAnswers {
  model: string;
  provider: string;
  approval_mode: 'smart' | 'strict' | 'permissive';
  theme: string;
  api_key?: string;
  telemetry: boolean;
  create_env: boolean;
}

const MODELS = ['deepseek', 'llama3', 'codellama', 'mistral', 'mixtral', 'qwen', 'phi', 'gpt-4o-mini', 'claude-3-haiku'];
const PROVIDERS = ['ollama', 'groq', 'openrouter', 'togetherai', 'huggingface'];
const THEMES = ['neon', 'dark', 'light', 'ocean', 'forest', 'midnight', 'sunset'];

function ask(q: string, options?: { default?: string; choices?: string[]; password?: boolean }): Promise<string> {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    const def = options?.default ? ` [${options.default}]` : '';
    const choices = options?.choices ? ` (${options.choices.join('/')})` : '';
    stdout.write(`  ${chalk.cyan('?')} ${q}${choices}${def}: `);

    stdin.once('data', (data) => {
      let answer = data.toString().trim();

      if (options?.password) {
        stdout.write('\r' + ' '.repeat(80) + '\r');
        stdout.write(`  ${chalk.green('✓')} ${q}: ${'*'.repeat(answer.length)}\n`);
      } else {
        stdout.write(`  ${chalk.green('✓')} ${q}: ${answer || def || '(skipped)'}\n`);
      }

      if (!answer && def) answer = def;
      if (options?.choices && answer) {
        const match = options.choices.find((c) => c.toLowerCase().startsWith(answer.toLowerCase()));
        if (match) answer = match;
      }
      resolve(answer);
    });
  });
}

async function confirm(q: string, defaultYes = true): Promise<boolean> {
  return new Promise((resolve) => {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    process.stdout.write(`  ${chalk.cyan('?')} ${q} (${hint}): `);
    process.stdin.once('data', (data) => {
      const answer = data.toString().trim().toLowerCase();
      process.stdout.write(`  ${chalk.green('✓')} ${q}: ${answer || (defaultYes ? 'yes' : 'no')}\n`);
      if (!answer) resolve(defaultYes);
      else resolve(answer === 'y' || answer === 'yes');
    });
  });
}

export async function runSetup(rootDir?: string): Promise<void> {
  console.log(chalk.bold.cyan('\n  ⚡ LoveCode AI Setup Wizard\n'));
  console.log(chalk.dim('  This will configure LoveCode for your environment.\n'));
  console.log(chalk.dim('  Press Enter to accept defaults.\n'));

  const dir = rootDir || process.cwd();
  const existing = loadConfig(dir);
  const defaults = getDefaults();

  const model = await ask('Default model', { default: existing.model || defaults.model, choices: MODELS });
  const provider = await ask('AI provider', { default: existing.provider || 'ollama', choices: PROVIDERS });
  const approvalMode = await ask('Approval mode', { default: existing.approval_mode, choices: ['smart', 'strict', 'permissive'] }) as SetupAnswers['approval_mode'];
  const theme = await ask('Theme', { default: existing.theme || defaults.theme, choices: THEMES });

  const telemetryOn = existing.telemetry?.enabled;
  const telemetry = await confirm('Enable anonymous telemetry?', telemetryOn || false);

  const createEnv = await confirm('Create .env file for API keys?', false);

  let apiKey = '';
  if (createEnv && provider !== 'ollama') {
    const envVar = KNOWN_ENV_VARS.find((v) => v.key.startsWith(provider.toUpperCase()));
    if (envVar) {
      const existingKey = process.env[envVar.key] || '';
      apiKey = await ask(`${envVar.key}`, { default: existingKey ? existingKey.slice(0, 8) + '***' : '', password: existingKey ? false : true });
    }
  }

  const config = {
    ...defaults,
    model,
    provider,
    approval_mode: approvalMode,
    theme,
    telemetry: { enabled: telemetry, crash_reports: false },
  };

  saveConfig(config, dir);
  console.log(chalk.green(`\n  ✓ Config saved to ${path.join(dir, '.lovecode/config.yaml')}`));

  if (createEnv) {
    const envVars: Record<string, string> = {};
    if (apiKey && provider !== 'ollama') {
      const envKey = KNOWN_ENV_VARS.find((v) => v.key.startsWith(provider.toUpperCase()));
      if (envKey) envVars[envKey.key] = apiKey;
    }
    saveEnv(envVars, dir);
    console.log(chalk.green(`  ✓ Environment saved to ${path.join(dir, '.env')}`));
  }

  console.log(chalk.dim('\n  Final configuration:'));
  console.log(formatConfig(loadConfig(dir)));
  console.log(chalk.bold.cyan('\n  Setup complete! Run "lovecode" to start.\n'));
}
