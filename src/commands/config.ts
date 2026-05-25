import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, formatConfig } from '../config/config.js';

async function cmdShow(options: { dir?: string }) {
  const config = loadConfig(options.dir);
  console.log(formatConfig(config));
}

async function cmdSetModel(model: string, options: { dir?: string }) {
  const config = loadConfig(options.dir);
  config.model = model;
  saveConfig(config, options.dir);
  console.log(chalk.green(`Model set to: ${model}`));
  console.log(formatConfig(loadConfig(options.dir)));
}

async function cmdSetTheme(theme: string, options: { dir?: string }) {
  const config = loadConfig(options.dir);
  config.theme = theme;
  saveConfig(config, options.dir);
  console.log(chalk.green(`Theme set to: ${theme}`));
}

async function cmdSetApproval(mode: string, options: { dir?: string }) {
  const valid = ['smart', 'strict', 'permissive'];
  if (!valid.includes(mode)) {
    console.log(chalk.red(`Invalid mode: ${mode}. Options: ${valid.join(', ')}`));
    return;
  }
  const config = loadConfig(options.dir);
  config.approval_mode = mode as any;
  saveConfig(config, options.dir);
  console.log(chalk.green(`Approval mode set to: ${mode}`));
}

async function cmdSetProvider(provider: string, options: { dir?: string }) {
  const config = loadConfig(options.dir);
  config.provider = provider;
  saveConfig(config, options.dir);
  console.log(chalk.green(`Provider set to: ${provider}`));
}

export const configCommand = new Command('config')
  .alias('cfg')
  .description('View or modify LoveCode configuration')
  .option('--dir <path>', 'Project directory', process.cwd())
  .addHelpText('after', `
  Examples:
    lovecode config              Show current configuration
    lovecode config set model llama3
    lovecode config set theme ocean
    lovecode config set approval smart
    lovecode config set provider groq
  `);

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Config key (model, theme, approval, provider)')
  .argument('<value>', 'Config value')
  .option('--dir <path>', 'Project directory')
  .action(async (key: string, value: string, options: { dir?: string }) => {
    switch (key) {
      case 'model': await cmdSetModel(value, options); break;
      case 'theme': await cmdSetTheme(value, options); break;
      case 'approval': await cmdSetApproval(value, options); break;
      case 'provider': await cmdSetProvider(value, options); break;
      default: console.log(chalk.red(`Unknown config key: ${key}. Valid keys: model, theme, approval, provider`));
    }
  });

configCommand.action(cmdShow);
