import * as fs from 'node:fs';
import * as os from 'node:os';

let _isTermux: boolean | null = null;
let _isCodespaces: boolean | null = null;

export function isTermux(): boolean {
  if (_isTermux !== null) return _isTermux;
  _isTermux = fs.existsSync('/data/data/com.termux') || process.env.PREFIX === '/data/data/com.termux/files/usr' || !!(process.env.TERMUX_VERSION);
  return _isTermux;
}

export function isCodespaces(): boolean {
  if (_isCodespaces !== null) return _isCodespaces;
  _isCodespaces = process.env.CODESPACES === 'true' || !!process.env.CODESPACE_NAME || fs.existsSync('/.codespaces');
  return _isCodespaces;
}

export function lowRamMode(): boolean {
  const totalMem = os.totalmem();
  const memMb = totalMem / (1024 * 1024);
  return memMb < 1024 || process.env.LOVECODE_LOW_RAM === 'true' || isTermux();
}

export function recommendedMaxMemory(): number {
  const totalMem = os.totalmem();
  const memMb = totalMem / (1024 * 1024);
  if (memMb < 1024) return 128;
  if (memMb < 2048) return 256;
  if (memMb < 4096) return 512;
  return 1024;
}

export function platformInfo(): string[] {
  const info: string[] = [];
  info.push(`OS: ${os.platform()} ${os.release()}`);
  info.push(`CPU: ${os.cpus().length} cores`);
  info.push(`RAM: ${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB total, ${(os.freemem() / (1024 ** 3)).toFixed(1)} GB free`);
  info.push(`Node: ${process.version}`);
  if (isTermux()) info.push('Platform: Termux (Android)');
  if (isCodespaces()) info.push('Platform: GitHub Codespaces');
  return info;
}
