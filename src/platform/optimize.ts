import chalk from 'chalk';
import { isTermux, isCodespaces, lowRamMode, recommendedMaxMemory, platformInfo } from './detect.js';

export function optimizeForPlatform(): void {
  if (isTermux()) {
    process.env.LOVECODE_LOW_RAM = 'true';
    process.env.TERM = 'xterm-256color';
    console.log(chalk.dim(`  ${chalk.yellow('📱')} Termux detected: low RAM mode enabled, max ${recommendedMaxMemory()}MB`));
  }

  if (isCodespaces()) {
    console.log(chalk.dim(`  ${chalk.blue('☁')} Codespaces detected: persistent session mode`));
  }
}

export function formatPlatformStatus(): string {
  const lines: string[] = [chalk.bold('\n  Platform Status')];
  lines.push(`  Termux:     ${isTermux() ? chalk.green('✓') : chalk.dim('—')}`);
  lines.push(`  Codespaces: ${isCodespaces() ? chalk.green('✓') : chalk.dim('—')}`);
  lines.push(`  Low RAM:    ${lowRamMode() ? chalk.yellow('✓') : chalk.dim('—')}`);
  lines.push(`  Max Mem:    ${recommendedMaxMemory()}MB`);
  lines.push('');
  for (const line of platformInfo()) {
    lines.push(`  ${chalk.dim(line)}`);
  }
  return lines.join('\n');
}
