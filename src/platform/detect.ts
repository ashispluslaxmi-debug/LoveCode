import * as fs from 'node:fs';
import * as os from 'node:os';

let _isTermux: boolean | null = null;
let _isCodespaces: boolean | null = null;
let _isTouch: boolean | null = null;

export function isTermux(): boolean {
  if (_isTermux !== null) return _isTermux;
  _isTermux = fs.existsSync('/data/data/com.termux')
    || process.env.PREFIX === '/data/data/com.termux/files/usr'
    || !!(process.env.TERMUX_VERSION)
    || process.env.TERMUX_APK_RELEASE !== undefined
    || false;
  return _isTermux;
}

export function isTouchDevice(): boolean {
  if (_isTouch !== null) return _isTouch;
  _isTouch = isTermux()
    || process.env.LOVECODE_TOUCH === 'true'
    || process.env.TERMUX_VERSION !== undefined
    || false;
  return _isTouch;
}

export function isCodespaces(): boolean {
  if (_isCodespaces !== null) return _isCodespaces;
  _isCodespaces = process.env.CODESPACES === 'true'
    || !!process.env.CODESPACE_NAME
    || fs.existsSync('/.codespaces')
    || false;
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
  if (isTermux()) return 128;
  if (memMb < 1024) return 128;
  if (memMb < 2048) return 256;
  if (memMb < 4096) return 512;
  return 1024;
}

export function termuxInfo(): string[] {
  if (!isTermux()) return [];
  const info: string[] = [];
  info.push(`Termux version: ${process.env.TERMUX_VERSION || 'unknown'}`);
  info.push(`Touch optimized: ${isTouchDevice() ? 'yes' : 'no'}`);
  info.push(`Low RAM mode: ${lowRamMode() ? 'enabled' : 'disabled'}`);
  info.push(`Max memory: ${recommendedMaxMemory()}MB`);
  info.push(`Cache TTL: ${cacheTTL()}ms`);
  return info;
}

export function cacheTTL(): number {
  return isTermux() ? 120_000 : 300_000;
}

export function platformInfo(): string[] {
  const info: string[] = [];
  info.push(`OS: ${os.platform()} ${os.release()}`);
  info.push(`CPU: ${os.cpus().length} cores`);
  info.push(`RAM: ${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB total, ${(os.freemem() / (1024 ** 3)).toFixed(1)} GB free`);
  info.push(`Node: ${process.version}`);
  if (isTermux()) info.push(`Platform: Termux (Android) ${process.env.TERMUX_VERSION || ''}`);
  if (isCodespaces()) info.push('Platform: GitHub Codespaces');
  return info;
}
