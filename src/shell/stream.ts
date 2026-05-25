import chalk from 'chalk';

export interface StreamOptions {
  showTimestamp?: boolean;
  prefix?: string;
  colorStdout?: boolean;
  colorStderr?: boolean;
  maxLines?: number;
}

let lineCount = 0;
const MAX_BUFFER_LINES = 1000;

export function formatStreamLine(
  data: string,
  stream: 'stdout' | 'stderr',
  options: StreamOptions = {},
): string {
  const lines = data.split('\n').filter((l) => l.length > 0 || data.endsWith('\n'));
  const result: string[] = [];

  for (const line of lines) {
    if (line.length === 0) {
      result.push('');
      continue;
    }

    let formatted = line;

    if (options.prefix) {
      formatted = `${options.prefix} ${formatted}`;
    }

    if (options.showTimestamp) {
      const ts = chalk.dim(`[${new Date().toLocaleTimeString()}]`);
      formatted = `${ts} ${formatted}`;
    }

    if (stream === 'stdout' && options.colorStdout !== false) {
      formatted = chalk.white(formatted);
    } else if (stream === 'stderr' && options.colorStderr !== false) {
      formatted = chalk.yellow(formatted);
    }

    result.push(formatted);
  }

  return result.join('\n');
}

export function writeStream(data: string, stream: 'stdout' | 'stderr'): void {
  const out = stream === 'stdout' ? process.stdout : process.stderr;
  out.write(data);
}

export function writeStreamLine(
  data: string,
  stream: 'stdout' | 'stderr',
  options: StreamOptions = {},
): void {
  const formatted = formatStreamLine(data, stream, options);
  writeStream(formatted + '\n', stream);
  lineCount++;

  if (lineCount > MAX_BUFFER_LINES) {
    writeStream(chalk.dim('  [output truncated...]\n'), stream);
  }
}

export function createStreamRenderer(
  options: StreamOptions = {},
): (data: string, stream: 'stdout' | 'stderr') => void {
  return (data: string, stream: 'stdout' | 'stderr') => {
    writeStreamLine(data, stream, options);
  };
}

export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

export function createProgressBar(current: number, total: number, label: string = ''): string {
  const width = 30;
  const progress = Math.min(current / total, 1);
  const filled = Math.round(width * progress);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const pct = Math.round(progress * 100);
  return `  ${bar} ${chalk.bold(String(pct))}% ${chalk.dim(label)}`;
}
