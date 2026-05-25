import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import chalk from 'chalk';

export interface InteractiveSession {
  process: ReturnType<typeof spawn> | null;
  sendInput(data: string): void;
  close(): void;
}

export interface InteractiveOptions {
  command: string;
  cwd: string;
  onOutput?: (data: string) => void;
  onExit?: (code: number | null) => void;
}

export function createInteractiveSession(options: InteractiveOptions): InteractiveSession {
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
  const shellFlag = process.platform === 'win32' ? '/c' : '-c';

  const proc = spawn(shell, [shellFlag, options.command], {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1', TERM: 'xterm-256color' },
  });

  proc.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stdout.write(text);
    options.onOutput?.(text);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    process.stderr.write(chalk.yellow(text));
    options.onOutput?.(text);
  });

  proc.on('exit', (code) => {
    options.onExit?.(code);
  });

  proc.on('error', (err) => {
    process.stderr.write(chalk.red(`\n  Error: ${err.message}\n`));
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });

  rl.on('line', (line) => {
    if (proc.stdin?.writable) {
      proc.stdin.write(line + '\n');
    }
  });

  proc.on('exit', () => {
    rl.close();
  });

  return {
    process: proc,
    sendInput(data: string) {
      if (proc.stdin?.writable) {
        proc.stdin.write(data + '\n');
      }
    },
    close() {
      rl.close();
      if (!proc.killed) {
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL');
        }, 3000);
      }
    },
  };
}

export function promptForPassword(prompt: string = 'Password: '): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.stdin;
    const isRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(false);

    rl.question(chalk.dim(prompt), (answer) => {
      rl.close();
      if (stdin.setRawMode && isRaw) stdin.setRawMode(true);
      resolve(answer);
    });
  });
}

export function promptForConfirmation(
  message: string,
  defaultYes: boolean = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const suffix = defaultYes ? ' [Y/n]: ' : ' [y/N]: ';
    rl.question(chalk.yellow(message + suffix), (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') resolve(defaultYes);
      else resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

export function promptForInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(chalk.cyan(prompt), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
