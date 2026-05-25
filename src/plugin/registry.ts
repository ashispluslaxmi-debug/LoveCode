import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { PluginPackage, PluginAPI, PluginManifest, MarketplacePlugin } from './types.js';

const _require = createRequire(import.meta.url);
import { PLUGIN_DIR, builtinPlugins } from './types.js';
import type { ToolDefinition } from '../core/tools.js';

const loadedPlugins: Map<string, PluginPackage> = new Map();
let toolListeners: Array<(tools: ToolDefinition[]) => void> = [];

export function onToolsChanged(cb: (tools: ToolDefinition[]) => void): void {
  toolListeners.push(cb);
}

function notifyToolsChanged(): void {
  const allTools = getAllPluginTools();
  for (const cb of toolListeners) {
    cb(allTools);
  }
}

export function registerPlugin(plugin: PluginAPI): PluginPackage {
  const pkg: PluginPackage = {
    manifest: plugin.manifest,
    module: plugin,
    enabled: true,
    loadedAt: Date.now(),
  };
  loadedPlugins.set(plugin.name, pkg);
  notifyToolsChanged();
  return pkg;
}

export function unregisterPlugin(name: string): boolean {
  const pkg = loadedPlugins.get(name);
  if (!pkg) return false;
  pkg.module.onUnload?.();
  loadedPlugins.delete(name);
  notifyToolsChanged();
  return true;
}

export function getPlugin(name: string): PluginPackage | undefined {
  return loadedPlugins.get(name);
}

export function listPlugins(): PluginPackage[] {
  return Array.from(loadedPlugins.values());
}

export function enablePlugin(name: string): boolean {
  const pkg = loadedPlugins.get(name);
  if (!pkg) return false;
  pkg.enabled = true;
  notifyToolsChanged();
  return true;
}

export function disablePlugin(name: string): boolean {
  const pkg = loadedPlugins.get(name);
  if (!pkg) return false;
  pkg.enabled = false;
  notifyToolsChanged();
  return true;
}

export function getAllPluginTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  for (const pkg of loadedPlugins.values()) {
    if (!pkg.enabled) continue;
    if (pkg.module.getTools) {
      tools.push(...pkg.module.getTools());
    }
  }
  return tools;
}

export function loadBuiltinPlugins(): string[] {
  const loaded: string[] = [];
  for (const bp of builtinPlugins) {
    if (loadedPlugins.has(bp.name)) continue;
    try {
      const plugin = bp.create();
      registerPlugin(plugin);
      loaded.push(bp.name);
    } catch (err) {
      console.error(`Failed to load builtin plugin "${bp.name}":`, err);
    }
  }
  return loaded;
}

export function loadExternalPlugins(rootDir?: string): string[] {
  const base = rootDir || process.cwd();
  const pluginDir = path.join(base, PLUGIN_DIR);
  if (!fs.existsSync(pluginDir)) return [];

  const loaded: string[] = [];
  for (const entry of fs.readdirSync(pluginDir)) {
    const fullPath = path.join(pluginDir, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;
    const manifestPath = path.join(fullPath, 'plugin.json');
    const mainPath = path.join(fullPath, 'index.js');

    if (!fs.existsSync(manifestPath) || !fs.existsSync(mainPath)) continue;

    try {
      const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestRaw);

      const pluginModule = _require(mainPath) as PluginAPI;
      pluginModule.manifest = manifest;
      registerPlugin(pluginModule);
      loaded.push(entry);
    } catch (err) {
      console.error(`Failed to load plugin "${entry}":`, err);
    }
  }
  return loaded;
}

export function formatPluginList(plugins: PluginPackage[]): string {
  if (plugins.length === 0) return 'No plugins loaded.';
  const lines: string[] = ['Loaded Plugins:'];
  for (const p of plugins) {
    const status = p.enabled ? '✓' : '✗';
    const tags = p.manifest.tags?.join(', ') || '';
    lines.push(`  ${status} ${p.manifest.name}@${p.manifest.version}  ${p.manifest.description}${tags ? ` (${tags})` : ''}`);
  }
  return lines.join('\n');
}

export const marketplacePlugins: MarketplacePlugin[] = [
  { name: 'docker', version: '1.0.0', description: 'Docker container management', author: 'LoveCode', downloads: 1200, rating: 4.5, tags: ['docker', 'devops'], installUrl: 'builtin' },
  { name: 'kubernetes', version: '1.0.0', description: 'Kubernetes cluster management', author: 'LoveCode', downloads: 890, rating: 4.3, tags: ['k8s', 'devops'], installUrl: 'builtin' },
  { name: 'firebase', version: '1.0.0', description: 'Firebase deployment and management', author: 'LoveCode', downloads: 650, rating: 4.1, tags: ['firebase', 'deploy'], installUrl: 'builtin' },
  { name: 'prisma', version: '1.0.0', description: 'Prisma ORM tools', author: 'LoveCode', downloads: 1500, rating: 4.7, tags: ['prisma', 'database', 'orm'], installUrl: 'builtin' },
  { name: 'eslint-fixer', version: '1.0.0', description: 'Automated ESLint fix suggestions', author: 'Community', downloads: 420, rating: 3.8, tags: ['linting', 'code-quality'], installUrl: 'npm' },
  { name: 'prettier', version: '1.0.0', description: 'Prettier code formatting integration', author: 'Community', downloads: 380, rating: 4.0, tags: ['formatting', 'code-style'], installUrl: 'npm' },
];

export function searchMarketplace(query: string): MarketplacePlugin[] {
  const lower = query.toLowerCase();
  return marketplacePlugins.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.tags.some((t) => t.toLowerCase().includes(lower)),
  );
}

export function formatMarketplace(plugins: MarketplacePlugin[]): string {
  if (plugins.length === 0) return 'No plugins found.';
  const lines: string[] = ['Plugin Marketplace:'];
  for (const p of plugins) {
    lines.push(`  ${p.name.padEnd(20)} v${p.version.padEnd(8)} ${(p.rating + '★').padEnd(6)} ${p.downloads} downloads  ${p.description}`);
  }
  return lines.join('\n');
}
