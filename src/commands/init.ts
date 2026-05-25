import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { saveConfig, getDefaults, formatConfig } from '../config/config.js';
import { saveEnvExample } from '../config/env.js';
import { runSetup } from '../config/setup.js';

export const initCommand = new Command('init')
  .alias('i')
  .description('Initialize LoveCode AI in the current project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(async (options) => {
    const dir = options.dir || process.cwd();
    const configPath = path.join(dir, '.lovecode/config.yaml');
    const force = options.force;

    if (fs.existsSync(configPath) && !force) {
      console.log(chalk.yellow(`\n  Config already exists at ${configPath}`));
      console.log(chalk.dim('  Use --force to overwrite, or run "lovecode setup" for interactive setup.\n'));
      return;
    }

    const config = getDefaults();
    saveConfig(config, dir);
    saveEnvExample(dir);

    console.log(chalk.bold.cyan('\n  LoveCode AI ⚡ Initialized\n'));
    console.log(chalk.green(`  ✓ ${configPath}`));
    console.log(chalk.green(`  ✓ ${path.join(dir, '.env.example')}`));
    console.log(formatConfig(config));
    console.log(chalk.dim('\n  Run "lovecode setup" for interactive configuration,'));
    console.log(chalk.dim('  or edit .lovecode/config.yaml directly.\n'));
  });

export const setupCommand = new Command('setup')
  .alias('configure')
  .description('Run the interactive setup wizard')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(async (options) => {
    await runSetup(options.dir);
  });
