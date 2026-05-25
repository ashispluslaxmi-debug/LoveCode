import { Command } from 'commander';
import chalk from 'chalk';
import { formatPlatformStatus } from '../platform/optimize.js';

async function cmdPlatform() {
  console.log(formatPlatformStatus());
}

export const platformCommand = new Command('platform')
  .alias('sys')
  .alias('info')
  .description('Show platform detection and optimization status')
  .action(cmdPlatform);
