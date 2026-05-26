import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv, saveEnv, formatEnvStatus, KNOWN_ENV_VARS } from '../config/env.js';
import { numberedSelect, promptInput } from '../utils/select.js';

async function cmdEnvShow(options: { dir?: string }) {
  console.log(formatEnvStatus(options.dir));
}

async function cmdEnvSet(key: string, value: string, options: { dir?: string }) {
  const vars = loadEnv(options.dir);
  vars[key.toUpperCase()] = value;
  saveEnv(vars, options.dir);
  console.log(chalk.green(`Set ${key.toUpperCase()}`));
  console.log(formatEnvStatus(options.dir));
}

async function cmdEnvUnset(key: string, options: { dir?: string }) {
  const vars = loadEnv(options.dir);
  delete vars[key.toUpperCase()];
  saveEnv(vars, options.dir);
  console.log(chalk.yellow(`Unset ${key.toUpperCase()}`));
}

async function cmdEnvSelect(options: { dir?: string }) {
  if (!process.stdin.isTTY) {
    console.log(chalk.yellow('Interactive mode requires a TTY. Use `lovecode env set <KEY> <VALUE>` instead.'));
    return;
  }
  const vars = loadEnv(options.dir);

  const choices = KNOWN_ENV_VARS.map((v) => {
    const current = vars[v.key] || process.env[v.key] || '';
    const status = current ? chalk.green('✓ set') : chalk.dim('○ empty');
    const masked = current && v.key.includes('KEY')
      ? current.slice(0, 8) + '*'.repeat(Math.min(current.length - 8, 12))
      : current || '';
    return {
      name: `${v.key.padEnd(28)} ${status}`,
      value: v.key,
      description: masked ? `${v.description} (${masked})` : v.description,
    };
  });

  let key: string;
  try {
    key = await numberedSelect(choices, {
      message: 'Select an environment variable to set:',
      termux: true,
    });
  } catch {
    console.log(chalk.yellow('\nInteractive selection unavailable. Use `lovecode env set <KEY> <VALUE>` instead.'));
    return;
  }

  const existing = vars[key] || '';
  const description = KNOWN_ENV_VARS.find((v) => v.key === key)?.description || '';

  let value: string;
  try {
    value = await promptInput(`Enter value for ${key} (${description})`, existing || undefined);
  } catch {
    console.log(chalk.yellow('\nInput unavailable. Use `lovecode env set <KEY> <VALUE>` instead.'));
    return;
  }

  if (!value) {
    console.log(chalk.yellow('\nNo value entered. Skipping.'));
    return;
  }

  vars[key] = value;
  saveEnv(vars, options.dir);
  console.log(chalk.green(`\n✓ ${key} saved`));
  console.log(formatEnvStatus(options.dir));
}

export const envCommand = new Command('env')
  .alias('environment')
  .description('Manage environment variables for API keys and settings')
  .option('--dir <path>', 'Project directory', process.cwd())
  .addHelpText('after', `
  Examples:
    lovecode env                   Show current environment
    lovecode env select            Interactive variable selection
    lovecode env set GROQ_API_KEY gsk_xxx
    lovecode env unset GROQ_API_KEY

  On Termux/Android: uses numbered input instead of arrow keys
  `);

envCommand
  .command('set')
  .description('Set an environment variable')
  .argument('<key>', 'Variable name')
  .argument('<value>', 'Variable value')
  .option('--dir <path>', 'Project directory')
  .action(cmdEnvSet);

envCommand
  .command('unset')
  .description('Remove an environment variable')
  .argument('<key>', 'Variable name')
  .option('--dir <path>', 'Project directory')
  .action(cmdEnvUnset);

envCommand
  .command('select')
  .alias('pick')
  .description('Interactively select and set an environment variable')
  .option('--dir <path>', 'Project directory')
  .action(cmdEnvSelect);

envCommand.action(cmdEnvShow);
