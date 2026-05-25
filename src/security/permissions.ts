import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

export interface Permission {
  resource: string;
  action: 'allow' | 'deny' | 'ask';
  reason?: string;
}

export interface PermissionSet {
  version: number;
  entries: Permission[];
  defaults: {
    fileRead: 'allow' | 'deny' | 'ask';
    fileWrite: 'allow' | 'deny' | 'ask';
    networkAccess: 'allow' | 'deny' | 'ask';
    commandExecution: 'allow' | 'deny' | 'ask';
    environmentAccess: 'allow' | 'deny' | 'ask';
  };
  trustedSources: string[];
}

const PERMISSION_FILE = '.lovecode/permissions.json';

const DEFAULT_PERMISSIONS: PermissionSet = {
  version: 1,
  entries: [],
  defaults: {
    fileRead: 'allow',
    fileWrite: 'ask',
    networkAccess: 'ask',
    commandExecution: 'ask',
    environmentAccess: 'allow',
  },
  trustedSources: ['localhost', '*.npmjs.org', 'registry.npmjs.org'],
};

let cachedPermissions: PermissionSet | null = null;

function getPermPath(rootDir?: string): string {
  return path.join(rootDir || process.cwd(), PERMISSION_FILE);
}

export function loadPermissions(rootDir?: string): PermissionSet {
  if (cachedPermissions) return cachedPermissions;
  const filePath = getPermPath(rootDir);
  if (!fs.existsSync(filePath)) {
    savePermissions(DEFAULT_PERMISSIONS, rootDir);
    cachedPermissions = { ...DEFAULT_PERMISSIONS };
    return cachedPermissions;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    cachedPermissions = JSON.parse(raw) as PermissionSet;
    return cachedPermissions;
  } catch {
    cachedPermissions = { ...DEFAULT_PERMISSIONS };
    return cachedPermissions;
  }
}

export function savePermissions(perms: PermissionSet, rootDir?: string): void {
  const filePath = getPermPath(rootDir);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(perms, null, 2), 'utf-8');
  cachedPermissions = perms;
}

export function setDefault(key: keyof PermissionSet['defaults'], value: 'allow' | 'deny' | 'ask', rootDir?: string): PermissionSet {
  const perms = loadPermissions(rootDir);
  perms.defaults[key] = value;
  savePermissions(perms, rootDir);
  return perms;
}

export function addPermission(resource: string, action: 'allow' | 'deny' | 'ask', reason?: string, rootDir?: string): PermissionSet {
  const perms = loadPermissions(rootDir);
  const existing = perms.entries.findIndex((e) => e.resource === resource);
  if (existing >= 0) {
    perms.entries[existing] = { resource, action, reason };
  } else {
    perms.entries.push({ resource, action, reason });
  }
  savePermissions(perms, rootDir);
  return perms;
}

export function removePermission(resource: string, rootDir?: string): boolean {
  const perms = loadPermissions(rootDir);
  const before = perms.entries.length;
  perms.entries = perms.entries.filter((e) => e.resource !== resource);
  if (perms.entries.length < before) {
    savePermissions(perms, rootDir);
    return true;
  }
  return false;
}

export function checkPermission(resource: string, category: keyof PermissionSet['defaults'], rootDir?: string): 'allow' | 'deny' | 'ask' {
  const perms = loadPermissions(rootDir);

  const specific = perms.entries.find((e) => {
    if (e.resource.startsWith('*')) {
      const suffix = e.resource.slice(1);
      return resource.endsWith(suffix);
    }
    if (e.resource.endsWith('*')) {
      const prefix = e.resource.slice(0, -1);
      return resource.startsWith(prefix);
    }
    return e.resource === resource;
  });
  if (specific) return specific.action;

  return perms.defaults[category];
}

export function addTrustedSource(source: string, rootDir?: string): PermissionSet {
  const perms = loadPermissions(rootDir);
  if (!perms.trustedSources.includes(source)) {
    perms.trustedSources.push(source);
  }
  savePermissions(perms, rootDir);
  return perms;
}

export function removeTrustedSource(source: string, rootDir?: string): boolean {
  const perms = loadPermissions(rootDir);
  const before = perms.trustedSources.length;
  perms.trustedSources = perms.trustedSources.filter((s) => s !== source);
  if (perms.trustedSources.length < before) {
    savePermissions(perms, rootDir);
    return true;
  }
  return false;
}

export function isSourceTrusted(url: string, rootDir?: string): boolean {
  const perms = loadPermissions(rootDir);
  return perms.trustedSources.some((s) => {
    if (s.startsWith('*.')) {
      return url.includes(s.slice(1));
    }
    return url.includes(s);
  });
}

export function resetPermissions(rootDir?: string): void {
  const filePath = getPermPath(rootDir);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  cachedPermissions = null;
}

export function formatPermissions(perms: PermissionSet): string {
  const lines: string[] = [chalk.bold('\n  Permission Settings')];
  lines.push(`  ${chalk.dim('File Read:')}      ${formatAction(perms.defaults.fileRead)}`);
  lines.push(`  ${chalk.dim('File Write:')}      ${formatAction(perms.defaults.fileWrite)}`);
  lines.push(`  ${chalk.dim('Network:')}          ${formatAction(perms.defaults.networkAccess)}`);
  lines.push(`  ${chalk.dim('Commands:')}         ${formatAction(perms.defaults.commandExecution)}`);
  lines.push(`  ${chalk.dim('Environment:')}      ${formatAction(perms.defaults.environmentAccess)}`);

  if (perms.entries.length > 0) {
    lines.push(`\n  ${chalk.bold('Specific Permissions:')}`);
    for (const e of perms.entries) {
      lines.push(`  ${formatAction(e.action)} ${e.resource}${e.reason ? ` ${chalk.dim(`(${e.reason})`)}` : ''}`);
    }
  }

  if (perms.trustedSources.length > 0) {
    lines.push(`\n  ${chalk.bold('Trusted Sources:')}`);
    for (const s of perms.trustedSources) {
      lines.push(`  ${chalk.green('✓')} ${s}`);
    }
  }

  return lines.join('\n');
}

function formatAction(action: 'allow' | 'deny' | 'ask'): string {
  switch (action) {
    case 'allow': return chalk.green('ALLOW');
    case 'deny': return chalk.red('DENY');
    case 'ask': return chalk.yellow('ASK');
  }
}
