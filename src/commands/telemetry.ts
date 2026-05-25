import { Command } from 'commander';
import chalk from 'chalk';
import { isTelemetryEnabled, enableTelemetry, disableTelemetry, getTelemetryData, clearTelemetryData, formatTelemetryStatus } from '../telemetry/index.js';

async function cmdTelemetryStatus(options: { dir?: string }) {
  const enabled = isTelemetryEnabled(options.dir);
  const data = getTelemetryData(options.dir);
  console.log(formatTelemetryStatus(enabled, data));
}

async function cmdTelemetryEnable(options: { dir?: string }) {
  enableTelemetry(options.dir);
  console.log(chalk.yellow('Telemetry enabled.'));
  console.log(chalk.dim('  Anonymous usage data will be collected to improve LoveCode.'));
  console.log(chalk.dim('  No personal or project data is ever sent.'));
}

async function cmdTelemetryDisable(options: { dir?: string }) {
  disableTelemetry(options.dir);
  console.log(chalk.green('Telemetry disabled.'));
}

async function cmdTelemetryClear(options: { dir?: string }) {
  clearTelemetryData(options.dir);
  console.log(chalk.green('Telemetry data cleared.'));
}

export const telemetryCommand = new Command('telemetry')
  .alias('analytics')
  .description('Manage anonymous telemetry and crash reporting')
  .option('--dir <path>', 'Project directory', process.cwd())
  .addHelpText('after', `
  Privacy-first by default. Telemetry is disabled unless explicitly enabled.

  Examples:
    lovecode telemetry          Show telemetry status
    lovecode telemetry enable   Enable anonymous telemetry
    lovecode telemetry disable  Disable telemetry
    lovecode telemetry clear    Clear collected data
  `);

telemetryCommand
  .command('enable')
  .description('Enable anonymous telemetry')
  .option('--dir <path>', 'Project directory')
  .action(cmdTelemetryEnable);

telemetryCommand
  .command('disable')
  .description('Disable telemetry')
  .option('--dir <path>', 'Project directory')
  .action(cmdTelemetryDisable);

telemetryCommand
  .command('clear')
  .description('Clear all collected telemetry data')
  .option('--dir <path>', 'Project directory')
  .action(cmdTelemetryClear);

telemetryCommand.action(cmdTelemetryStatus);
