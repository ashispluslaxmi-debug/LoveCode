import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { classifyCommand } from '../core/approval.js';

export interface ExecOptions {
  command: string;
  cwd: string;
  timeout?: number;
  env?: Record<string, string>;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number | null) => void;
  signal?: AbortSignal;
}

export interface ExecResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number;
  cancelled: boolean;
}

export class CommandExecutor extends EventEmitter {
  private process: ChildProcess | null = null;
  private aborted = false;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private startTime = 0;
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    super();
    this.cwd = cwd;
  }

  async execute(options: ExecOptions): Promise<ExecResult> {
    const { command, timeout = 120000, env, signal } = options;
    this.aborted = false;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.startTime = Date.now();

    const isDangerous = classifyCommand(command);

    if (isDangerous === 'dangerous') {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: 'Command blocked by sandbox: classified as dangerous',
        duration: 0,
        cancelled: false,
      };
    }

    return new Promise((resolve) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const shellFlag = process.platform === 'win32' ? '/c' : '-c';

      try {
        this.process = spawn(shell, [shellFlag, command], {
          cwd: this.cwd,
          env: { ...process.env, ...env, FORCE_COLOR: '1' },
          stdio: ['pipe', 'pipe', 'pipe'],
          signal: signal,
        });
      } catch (err) {
        resolve({
          success: false,
          exitCode: null,
          stdout: '',
          stderr: String(err),
          duration: 0,
          cancelled: false,
        });
        return;
      }

      const timer = setTimeout(() => {
        this.kill();
        resolve({
          success: false,
          exitCode: null,
          stdout: this.stdoutBuffer,
          stderr: this.stderrBuffer + '\n[Timeout] Command timed out',
          duration: Date.now() - this.startTime,
          cancelled: true,
        });
      }, timeout);

      this.process!.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.stdoutBuffer += text;
        options.onStdout?.(text);
        this.emit('stdout', text);
      });

      this.process!.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.stderrBuffer += text;
        options.onStderr?.(text);
        this.emit('stderr', text);
      });

      this.process!.on('exit', (exitCode) => {
        clearTimeout(timer);
        const duration = Date.now() - this.startTime;
        options.onExit?.(exitCode);
        this.emit('exit', exitCode);

        resolve({
          success: exitCode === 0 && !this.aborted,
          exitCode,
          stdout: this.stdoutBuffer,
          stderr: this.stderrBuffer,
          duration,
          cancelled: this.aborted,
        });
      });

      this.process!.on('error', (err) => {
        clearTimeout(timer);
        this.emit('error', err);
        resolve({
          success: false,
          exitCode: null,
          stdout: this.stdoutBuffer,
          stderr: String(err),
          duration: Date.now() - this.startTime,
          cancelled: this.aborted,
        });
      });
    });
  }

  kill(): void {
    this.aborted = true;
    if (this.process && !this.process.killed) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t']);
      } else {
        this.process.kill('SIGTERM');
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 3000);
      }
    }
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function execCommand(
  command: string,
  cwd: string = process.cwd(),
  timeout: number = 120000,
): Promise<ExecResult> {
  const executor = new CommandExecutor(cwd);
  return executor.execute({ command, cwd, timeout });
}
