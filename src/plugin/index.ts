import { loadBuiltinPlugins, listPlugins } from './registry.js';
export * from './types.js';
export * from './registry.js';

loadBuiltinPlugins();

export function getPluginTools() {
  return listPlugins().filter((p) => p.enabled).flatMap((p) => p.module.getTools?.() || []);
}
