import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv, saveEnv, formatEnvStatus } from '../config/env.js';

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

export const envCommand = new Command('env')
  .alias('environment')
  .description('Manage environment variables for API keys and settings')
  .option('--dir <path>', 'Project directory', process.cwd())
  .addHelpText('after', `
  Examples:
    lovecode env                   Show current environment
    lovecode env set GROQ_API_KEY gsk_xxx
    lovecode env set OPENROUTER_API_KEY sk-or-xxx
    lovecode env unset GROQ_API_KEY
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

envCommand.action(cmdEnvShow);
