import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { detectProject, type ProjectInfo } from './detect.js';
import { analyzeDependencies, type DepGraph } from './deps.js';

export interface RepoSummary {
  projectInfo: ProjectInfo;
  depGraph: DepGraph;
  totalFiles: number;
  totalDirs: number;
  totalLines: number;
  languages: Map<string, { files: number; lines: number }>;
  directoryTree: string;
  largestFiles: Array<{ path: string; size: number; lines: number }>;
  structure: string;
}

function countDirStats(dir: string): { files: number; dirs: number; lines: number; languages: Map<string, { files: number; lines: number }>; largest: Array<{ path: string; size: number; lines: number }> } {
  let files = 0;
  let dirs = 0;
  let totalLines = 0;
  const languages = new Map<string, { files: number; lines: number }>();
  const largest: Array<{ path: string; size: number; lines: number }> = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'target', 'vendor', 'coverage']);

  function walk(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || skipDirs.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          dirs++;
          walk(fullPath);
        } else {
          files++;
          const ext = path.extname(entry.name).toLowerCase() || entry.name;
          const stats = fs.statSync(fullPath);

          let lineCount = 0;
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            lineCount = content.split('\n').length;
            totalLines += lineCount;
          } catch {
            // skip binary
          }

          const existing = languages.get(ext) || { files: 0, lines: 0 };
          existing.files++;
          existing.lines += lineCount;
          languages.set(ext, existing);

          largest.push({ path: fullPath, size: stats.size, lines: lineCount });
        }
      }
    } catch {
      // skip
    }
  }

  walk(dir);

  largest.sort((a, b) => b.size - a.size);

  return { files, dirs, lines: totalLines, languages, largest: largest.slice(0, 10) };
}

function buildDirectoryTree(rootDir: string, maxDepth: number = 4): string {
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'target', 'vendor', 'coverage']);
  const result: string[] = [];

  function walk(dir: string, prefix: string, depth: number): void {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const filtered = entries.filter((e) => !e.name.startsWith('.') && !skipDirs.has(e.name));
      const sorted = filtered.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const isLast = i === sorted.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const nextPrefix = isLast ? '    ' : '│   ';

        if (entry.isDirectory()) {
          result.push(`${prefix}${connector}${chalk.cyan(entry.name)}/`);
          walk(path.join(dir, entry.name), prefix + nextPrefix, depth + 1);
        } else {
          const stats = fs.statSync(path.join(dir, entry.name));
          const size = stats.size > 1024 ? `${(stats.size / 1024).toFixed(1)} KB` : `${stats.size} B`;
          result.push(`${prefix}${connector}${entry.name} ${chalk.dim(size)}`);
        }
      }
    } catch {
      // skip
    }
  }

  result.push(chalk.bold(`${path.basename(rootDir)}/`));
  walk(rootDir, '', 1);
  return result.join('\n');
}

function languageLabel(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript React', '.js': 'JavaScript', '.jsx': 'React',
    '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.rb': 'Ruby', '.java': 'Java',
    '.kt': 'Kotlin', '.swift': 'Swift', '.c': 'C', '.cpp': 'C++', '.h': 'C/C++ Header',
    '.cs': 'C#', '.php': 'PHP', '.vue': 'Vue', '.svelte': 'Svelte',
    '.md': 'Markdown', '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
    '.toml': 'TOML', '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS',
  };
  return map[ext] || ext || '(unknown)';
}

export function generateSummary(rootDir: string): RepoSummary {
  const projectInfo = detectProject(rootDir);
  const depGraph = analyzeDependencies(rootDir);
  const stats = countDirStats(rootDir);
  const directoryTree = buildDirectoryTree(rootDir);

  return {
    projectInfo,
    depGraph,
    totalFiles: stats.files,
    totalDirs: stats.dirs,
    totalLines: stats.lines,
    languages: stats.languages,
    directoryTree,
    largestFiles: stats.largest,
    structure: directoryTree,
  };
}

export function printSummary(summary: RepoSummary): string {
  const lines: string[] = [
    chalk.bold('\n  ╔═══════════════════════════════════════════════╗'),
    chalk.bold('  ║         Repository Architecture Summary       ║'),
    chalk.bold('  ╚═══════════════════════════════════════════════╝'),
    '',
  ];

  if (summary.projectInfo.primary) {
    const p = summary.projectInfo.primary;
    lines.push(`  ${p.icon} ${chalk.bold(p.name)} ${chalk.dim(`${p.confidence}% confidence`)}`);
    lines.push(`  ${chalk.dim('Language:')} ${p.language}`);
  }

  lines.push('');
  lines.push(`  ${chalk.bold('Stats')}`);
  lines.push(`  ${chalk.dim('Files:')}        ${summary.totalFiles}`);
  lines.push(`  ${chalk.dim('Directories:')}  ${summary.totalDirs}`);
  lines.push(`  ${chalk.dim('Lines of code:')} ${summary.totalLines.toLocaleString()}`);

  if (summary.projectInfo.packageManager) {
    lines.push(`  ${chalk.dim('Package mgr:')}  ${summary.projectInfo.packageManager}`);
  }
  if (summary.projectInfo.buildTool) {
    lines.push(`  ${chalk.dim('Build tool:')}    ${summary.projectInfo.buildTool}`);
  }

  lines.push('');
  lines.push(`  ${chalk.bold('Languages')}`);
  const sortedLangs = [...summary.languages.entries()].sort(([, a], [, b]) => b.lines - a.lines);
  for (const [ext, info] of sortedLangs.slice(0, 10)) {
    const label = languageLabel(ext);
    const pct = summary.totalLines > 0 ? ((info.lines / summary.totalLines) * 100).toFixed(1) : '0';
    const bar = chalk.cyan('█'.repeat(Math.round(parseFloat(pct) / 5))) + chalk.dim('░'.repeat(20 - Math.round(parseFloat(pct) / 5)));
    lines.push(`  ${chalk.cyan(label.padEnd(20))} ${bar} ${chalk.bold(pct)}%  ${chalk.dim(`(${info.files} files, ${info.lines.toLocaleString()} lines)`)}`);
  }

  if (summary.largestFiles.length > 0) {
    lines.push('');
    lines.push(`  ${chalk.bold('Largest Files')}`);
    for (const f of summary.largestFiles.slice(0, 5)) {
      const relativePath = f.path;
      const size = f.size > 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${f.size} B`;
      lines.push(`  ${chalk.dim(relativePath)} ${chalk.yellow(size)} ${chalk.dim(`(${f.lines} lines)`)}`);
    }
  }

  if (summary.depGraph.entryPoints.length > 0) {
    lines.push('');
    lines.push(`  ${chalk.bold('Entry Points')}`);
    for (const ep of summary.depGraph.entryPoints) {
      lines.push(`  ${chalk.green('→')} ${ep}`);
    }
  }

  lines.push('');
  lines.push(`  ${chalk.bold('Directory Structure')}`);
  lines.push(summary.directoryTree);

  lines.push('');
  return lines.join('\n');
}
