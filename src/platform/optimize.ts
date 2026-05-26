import chalk from 'chalk';
import { isTermux, isCodespaces, isTouchDevice, lowRamMode, recommendedMaxMemory, platformInfo, termuxInfo } from './detect.js';

export function optimizeForPlatform(): void {
  const applied: string[] = [];

  if (isTermux()) {
    process.env.LOVECODE_LOW_RAM = 'true';
    process.env.TERM = 'xterm-256color';
    process.env.LOVECODE_TOUCH = 'true';
    applied.push('Low RAM mode enabled (128MB max)');
    applied.push('Touch-optimized input enabled');
    applied.push('Cache TTL reduced to 120s');
    console.log(chalk.dim(`  ${chalk.yellow('📱')} Termux optimizations applied:`));
    for (const a of applied) {
      console.log(chalk.dim(`    • ${a}`));
    }
  }

  if (isCodespaces()) {
    console.log(chalk.dim(`  ${chalk.blue('☁')} Codespaces detected: persistent session mode`));
  }
}

export function formatPlatformStatus(): string {
  const lines: string[] = [chalk.bold('\n  Platform Status')];
  lines.push(`  Termux:      ${isTermux() ? chalk.green('✓') : chalk.dim('—')}`);
  lines.push(`  Touch:       ${isTouchDevice() ? chalk.green('✓') : chalk.dim('—')}`);
  lines.push(`  Codespaces:  ${isCodespaces() ? chalk.green('✓') : chalk.dim('—')}`);
  lines.push(`  Low RAM:     ${lowRamMode() ? chalk.yellow('active') : chalk.dim('no')}`);
  lines.push(`  Max Mem:     ${recommendedMaxMemory()}MB`);
  lines.push('');
  if (isTermux()) {
    lines.push(chalk.bold('  Termux Details:'));
    for (const t of termuxInfo()) {
      lines.push(`    ${t}`);
    }
    lines.push('');
  }
  for (const line of platformInfo()) {
    lines.push(`  ${chalk.dim(line)}`);
  }
  if (isTouchDevice()) {
    lines.push('');
    lines.push(chalk.dim('  Tip: Use numbered selections instead of arrow keys'));
  }
  return lines.join('\n');
}
