import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

export interface DepEdge {
  source: string;
  target: string;
  type: 'import' | 'require' | 'dynamic';
}

export interface DepNode {
  name: string;
  filePath: string;
  imports: string[];
  importedBy: string[];
  isExternal: boolean;
}

export interface DepGraph {
  nodes: Map<string, DepNode>;
  edges: DepEdge[];
  entryPoints: string[];
  externalDeps: string[];
}

const IMPORT_PATTERNS: Array<{ regex: RegExp; type: DepEdge['type'] }> = [
  { regex: /import\s+(?:\*\s+as\s+\w+\s+from\s+)?['"]([^'"]+)['"]/g, type: 'import' },
  { regex: /import\s+(\w+(?:\s*,\s*\w+)?)\s+from\s+['"]([^'"]+)['"]/g, type: 'import' },
  { regex: /import\s+type\s+.*?from\s+['"]([^'"]+)['"]/g, type: 'import' },
  { regex: /from\s+['"]([^'"]+)['"]/g, type: 'import' },
  { regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, type: 'require' },
  { regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, type: 'dynamic' },
];

const PYTHON_PATTERNS: Array<{ regex: RegExp; type: DepEdge['type'] }> = [
  { regex: /^import\s+(\w+(?:\.\w+)*)/gm, type: 'import' },
  { regex: /^from\s+(\w+(?:\.\w+)*)\s+import/gm, type: 'import' },
];

const GO_PATTERNS: Array<{ regex: RegExp; type: DepEdge['type'] }> = [
  { regex: /^import\s+\(([^)]+)\)/gms, type: 'import' },
  { regex: /^import\s+"([^"]+)"/gm, type: 'import' },
];

const RUST_PATTERNS: Array<{ regex: RegExp; type: DepEdge['type'] }> = [
  { regex: /^use\s+(\w+(?:::\w+)*)/gm, type: 'import' },
  { regex: /^extern\s+crate\s+(\w+)/gm, type: 'import' },
];

export function analyzeDependencies(rootDir: string): DepGraph {
  const nodes = new Map<string, DepNode>();
  const edges: DepEdge[] = [];
  const sourceFiles = collectSourceFiles(rootDir);

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();
    let patterns = IMPORT_PATTERNS;

    if (ext === '.py') patterns = PYTHON_PATTERNS;
    else if (ext === '.go') patterns = GO_PATTERNS;
    else if (ext === '.rs') patterns = RUST_PATTERNS;

    if (!nodes.has(relativePath)) {
      nodes.set(relativePath, {
        name: relativePath,
        filePath,
        imports: [],
        importedBy: [],
        isExternal: false,
      });
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const imports = extractImports(content, patterns);

      for (const imp of imports) {
        const resolved = resolveImport(imp, relativePath, rootDir, sourceFiles);
        edges.push({ source: relativePath, target: resolved, type: 'import' });
        nodes.get(relativePath)!.imports.push(imp);

        if (!nodes.has(resolved)) {
          const isExternal = !sourceFiles.includes(resolved) && !fs.existsSync(resolved);
          nodes.set(resolved, {
            name: resolved,
            filePath: resolved,
            imports: [],
            importedBy: [],
            isExternal,
          });
        }
        nodes.get(resolved)!.importedBy.push(relativePath);
      }
    } catch {
      // skip unreadable files
    }
  }

  const entryPoints = detectEntryPoints(rootDir, sourceFiles);
  const externalDeps = [...nodes.values()].filter((n) => n.isExternal).map((n) => n.name);

  return { nodes, edges, entryPoints, externalDeps };
}

function collectSourceFiles(rootDir: string): string[] {
  const results: string[] = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'target', 'vendor']);

  function walk(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || skipDirs.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.rb', '.java'].includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // skip
    }
  }

  walk(rootDir);
  return results;
}

function extractImports(content: string, patterns: Array<{ regex: RegExp; type: DepEdge['type'] }>): string[] {
  const imports: string[] = [];

  for (const { regex } of patterns) {
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const imp = (match[2] || match[1] || '').trim();
      if (imp && !imp.startsWith('.') && !imp.startsWith('/')) {
        const parts = imp.split('/');
        imports.push(parts[0].startsWith('@') ? `${parts[0]}/${parts[1] || ''}` : parts[0]);
      } else if (imp) {
        imports.push(imp);
      }
    }
  }

  return [...new Set(imports)];
}

function resolveImport(imp: string, relativeFrom: string, rootDir: string, allFiles: string[]): string {
  if (imp.startsWith('.')) {
    const dir = path.dirname(path.join(rootDir, relativeFrom));
    const resolved = path.resolve(dir, imp);
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '/index.ts', '/index.js'];

    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (allFiles.includes(candidate)) return path.relative(rootDir, candidate).replace(/\\/g, '/');
    }

    return imp;
  }

  return imp;
}

function detectEntryPoints(rootDir: string, files: string[]): string[] {
  const entries: string[] = [];

  const entryNames = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js', 'server.ts', 'server.js'];
  for (const name of entryNames) {
    const fp = path.join(rootDir, name);
    if (files.includes(fp)) entries.push(name);
  }

  if (fs.existsSync(path.join(rootDir, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      if (pkg.main) {
        const mainPath = path.join(rootDir, pkg.main);
        const relative = path.relative(rootDir, mainPath).replace(/\\/g, '/');
        if (!entries.includes(relative)) entries.push(relative);
      }
    } catch {
      // ignore
    }
  }

  return entries;
}

export function printDepGraph(graph: DepGraph): string {
  const lines: string[] = [chalk.bold('\n  Dependency Analysis')];

  lines.push(`\n  ${chalk.dim('Source files:')} ${graph.nodes.size}`);
  lines.push(`  ${chalk.dim('External deps:')} ${graph.externalDeps.length}`);

  if (graph.entryPoints.length > 0) {
    lines.push(`\n  ${chalk.bold('Entry Points:')}`);
    for (const ep of graph.entryPoints) {
      lines.push(`  ${chalk.green('→')} ${ep}`);
    }
  }

  if (graph.externalDeps.length > 0) {
    lines.push(`\n  ${chalk.bold('External Dependencies:')}`);
    const unique = [...new Set(graph.externalDeps)].sort();
    for (const dep of unique.slice(0, 20)) {
      lines.push(`  ${chalk.cyan('■')} ${dep}`);
    }
    if (unique.length > 20) {
      lines.push(`  ${chalk.dim(`  ... and ${unique.length - 20} more`)}`);
    }
  }

  const mostImported = [...graph.nodes.entries()]
    .filter(([, n]) => n.importedBy.length > 0)
    .sort(([, a], [, b]) => b.importedBy.length - a.importedBy.length)
    .slice(0, 10);

  if (mostImported.length > 0) {
    lines.push(`\n  ${chalk.bold('Most Imported Modules:')}`);
    for (const [name, node] of mostImported) {
      lines.push(`  ${chalk.yellow('★')} ${name} ${chalk.dim(`(imported ${node.importedBy.length}x)`)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function findCircularDeps(graph: DepGraph): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const circles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);

    const nodeData = graph.nodes.get(node);
    if (!nodeData) { recursionStack.delete(node); return; }

    for (const imp of nodeData.imports) {
      const target = resolveImportInGraph(imp, node, graph);
      if (target && graph.nodes.has(target)) {
        if (!visited.has(target)) {
          dfs(target, [...path, target]);
        } else if (recursionStack.has(target)) {
          const cycle = [...path.slice(path.indexOf(target)), target];
          circles.push(cycle);
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const [name] of graph.nodes) {
    if (!visited.has(name)) {
      dfs(name, [name]);
    }
  }

  return circles;
}

function resolveImportInGraph(imp: string, from: string, _graph: DepGraph): string | null {
  if (!imp.startsWith('.')) return null;
  const dir = path.dirname(from);
  const resolved = path.normalize(path.join(dir, imp)).replace(/\\/g, '/');
  return resolved;
}
