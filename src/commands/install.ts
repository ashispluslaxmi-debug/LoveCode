import { Command } from 'commander';
import chalk from 'chalk';
import { getInstallerInfo, isGloballyInstalled, printInstallInstructions, createInstallScript } from '../installers/index.js';

async function cmdInstallStatus() {
  const info = getInstallerInfo();
  const global = isGloballyInstalled();
  console.log(chalk.bold('\n  Install Status'));
  console.log(`  Method:     ${chalk.cyan(info.method)}`);
  console.log(`  Version:    ${info.version}`);
  console.log(`  Node:       ${info.nodeVersion}`);
  console.log(`  Platform:   ${info.platform}`);
  console.log(`  Global CLI: ${global ? chalk.green('✓') : chalk.dim('—')}`);
}

async function cmdInstallGuide() {
  printInstallInstructions();
}

async function cmdInstallScript(options: { dir?: string }) {
  createInstallScript(options.dir);
  console.log(chalk.green(`  ✓ install.sh created in ${options.dir || process.cwd()}`));
  console.log(chalk.dim('  Run: bash install.sh'));
}

export const installCommand = new Command('install')
  .alias('installer')
  .description('Installation management and instructions')
  .option('--dir <path>', 'Project directory', process.cwd())
  .addHelpText('after', `
  Examples:
    lovecode install            Show install status
    lovecode install guide      Show install instructions
    lovecode install script     Generate install.sh
  `);

installCommand
  .command('guide')
  .description('Show installation instructions')
  .action(cmdInstallGuide);

installCommand
  .command('script')
  .description('Generate installation script')
  .option('--dir <path>', 'Project directory')
  .action(cmdInstallScript);

installCommand.action(cmdInstallStatus);
