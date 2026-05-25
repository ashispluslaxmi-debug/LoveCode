import { describe, it, expect } from 'vitest';
import { detectInstallMethod, getInstallerInfo, isGloballyInstalled, createInstallScript } from '../installers/install.js';
import * as fs from 'node:fs';

describe('Installer System', () => {
  it('detects install method', () => {
    const method = detectInstallMethod();
    expect(['npm', 'yarn', 'pnpm', 'ci', 'unknown']).toContain(method);
  });

  it('returns installer info', () => {
    const info = getInstallerInfo();
    expect(info.version).toBeTruthy();
    expect(info.nodeVersion).toBeTruthy();
    expect(info.platform).toBeTruthy();
  });

  it('creates install.sh script', () => {
    createInstallScript('/tmp/lovecode-test-install');
    expect(fs.existsSync('/tmp/lovecode-test-install/install.sh')).toBe(true);
    const content = fs.readFileSync('/tmp/lovecode-test-install/install.sh', 'utf-8');
    expect(content).toContain('LoveCode');
    expect(content).toContain('npm install');
    fs.unlinkSync('/tmp/lovecode-test-install/install.sh');
  });
});
