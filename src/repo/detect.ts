import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

export interface ProjectType {
  name: string;
  icon: string;
  confidence: number;
  language: string;
  detectedBy: string[];
  configFiles: string[];
}

export interface ProjectInfo {
  types: ProjectType[];
  primary: ProjectType | null;
  languages: string[];
  packageManager: string | null;
  buildTool: string | null;
}

interface DetectionRule {
  name: string;
  icon: string;
  language: string;
  check: (rootDir: string) => { detected: boolean; confidence: number; evidence: string[] };
}

const rules: DetectionRule[] = [
  {
    name: 'Next.js',
    icon: '▲',
    language: 'TypeScript',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'next.config.js')) || fs.existsSync(path.join(dir, 'next.config.mjs'))) {
        evidence.push('next.config.{js,mjs}');
      }
      const pkg = readJson(path.join(dir, 'package.json'));
      if (pkg?.dependencies?.next || pkg?.devDependencies?.next) {
        evidence.push('package.json: next dependency');
      }
      return { detected: evidence.length > 0, confidence: evidence.length >= 2 ? 95 : 70, evidence };
    },
  },
  {
    name: 'React',
    icon: '⚛',
    language: 'TypeScript/JavaScript',
    check: (dir) => {
      const evidence: string[] = [];
      const pkg = readJson(path.join(dir, 'package.json'));
      if (pkg?.dependencies?.react) evidence.push('package.json: react dependency');
      if (fs.existsSync(path.join(dir, 'jsconfig.json'))) evidence.push('jsconfig.json');
      if (findFiles(dir, '.jsx', 3).length > 0) evidence.push('.jsx files found');
      if (findFiles(dir, '.tsx', 3).length > 0) evidence.push('.tsx files found');
      return { detected: evidence.length > 0, confidence: Math.min(evidence.length * 30, 95), evidence };
    },
  },
  {
    name: 'Node.js',
    icon: '●',
    language: 'JavaScript',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'package.json'))) evidence.push('package.json');
      if (fs.existsSync(path.join(dir, 'package-lock.json'))) evidence.push('package-lock.json');
      const pkg = readJson(path.join(dir, 'package.json'));
      if (pkg && !pkg?.dependencies?.react && !pkg?.dependencies?.next) {
        evidence.push('Node.js package (no React/Next)');
      }
      return { detected: evidence.length > 0, confidence: Math.min(evidence.length * 35, 90), evidence };
    },
  },
  {
    name: 'Go',
    icon: '🔷',
    language: 'Go',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'go.mod'))) evidence.push('go.mod');
      if (fs.existsSync(path.join(dir, 'go.sum'))) evidence.push('go.sum');
      if (findFiles(dir, '.go', 3).length > 0) evidence.push('.go files found');
      return { detected: evidence.length > 0, confidence: evidence.includes('go.mod') ? 98 : 60, evidence };
    },
  },
  {
    name: 'Django',
    icon: '🎯',
    language: 'Python',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'manage.py'))) evidence.push('manage.py');
      if (findFiles(dir, 'settings.py', 5).length > 0) evidence.push('settings.py found');
      const cfg = readFile(path.join(dir, 'requirements.txt'));
      if (cfg?.includes('django')) evidence.push('requirements.txt: django');
      const pipfile = readFile(path.join(dir, 'Pipfile'));
      if (pipfile?.includes('django')) evidence.push('Pipfile: django');
      return { detected: evidence.length > 0, confidence: evidence.includes('manage.py') ? 95 : 50, evidence };
    },
  },
  {
    name: 'Flutter',
    icon: '🟦',
    language: 'Dart',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) evidence.push('pubspec.yaml');
      if (findFiles(dir, '.dart', 3).length > 0) evidence.push('.dart files found');
      if (fs.existsSync(path.join(dir, 'android')) && fs.existsSync(path.join(dir, 'ios'))) {
        evidence.push('android/ & ios/ directories');
      }
      return { detected: evidence.length > 0, confidence: evidence.includes('pubspec.yaml') ? 95 : 50, evidence };
    },
  },
  {
    name: 'Python',
    icon: '🐍',
    language: 'Python',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'requirements.txt'))) evidence.push('requirements.txt');
      if (fs.existsSync(path.join(dir, 'setup.py'))) evidence.push('setup.py');
      if (fs.existsSync(path.join(dir, 'pyproject.toml'))) evidence.push('pyproject.toml');
      if (findFiles(dir, '.py', 5).length > 0) evidence.push('.py files found');
      return { detected: evidence.length > 0, confidence: Math.min(evidence.length * 25, 90), evidence };
    },
  },
  {
    name: 'Rust',
    icon: '🦀',
    language: 'Rust',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'Cargo.toml'))) evidence.push('Cargo.toml');
      if (fs.existsSync(path.join(dir, 'Cargo.lock'))) evidence.push('Cargo.lock');
      if (findFiles(dir, '.rs', 3).length > 0) evidence.push('.rs files found');
      return { detected: evidence.length > 0, confidence: evidence.includes('Cargo.toml') ? 98 : 60, evidence };
    },
  },
  {
    name: 'Vue.js',
    icon: '💚',
    language: 'JavaScript',
    check: (dir) => {
      const evidence: string[] = [];
      const pkg = readJson(path.join(dir, 'package.json'));
      if (pkg?.dependencies?.vue) evidence.push('package.json: vue');
      if (findFiles(dir, '.vue', 3).length > 0) evidence.push('.vue files found');
      return { detected: evidence.length > 0, confidence: Math.min(evidence.length * 40, 90), evidence };
    },
  },
  {
    name: 'Angular',
    icon: '🔺',
    language: 'TypeScript',
    check: (dir) => {
      const evidence: string[] = [];
      if (fs.existsSync(path.join(dir, 'angular.json'))) evidence.push('angular.json');
      const pkg = readJson(path.join(dir, 'package.json'));
      if (pkg?.dependencies?.['@angular/core']) evidence.push('package.json: @angular/core');
      return { detected: evidence.length > 0, confidence: Math.min(evidence.length * 40, 95), evidence };
    },
  },
];

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

function readJson(filePath: string): PkgJson | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function findFiles(dir: string, ext: string, max: number): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= max) break;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFiles(fullPath, ext, max - results.length));
      } else if (entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch {
    // skip
  }
  return results;
}

export function detectProject(rootDir: string): ProjectInfo {
  const types: ProjectType[] = [];

  for (const rule of rules) {
    const result = rule.check(rootDir);
    if (result.detected) {
      types.push({
        name: rule.name,
        icon: rule.icon,
        confidence: result.confidence,
        language: rule.language,
        detectedBy: result.evidence,
        configFiles: result.evidence,
      });
    }
  }

  types.sort((a, b) => b.confidence - a.confidence);

  const languages = [...new Set(types.map((t) => t.language))];
  const primary = types[0] || null;

  const pkg = readJson(path.join(rootDir, 'package.json'));
  let packageManager: string | null = null;
  if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) packageManager = 'yarn';
  else if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) packageManager = 'npm';
  else if (fs.existsSync(path.join(rootDir, 'bun.lockb'))) packageManager = 'bun';

  let buildTool: string | null = null;
  if (pkg?.scripts) {
    const scripts = pkg.scripts as Record<string, string>;
    if (scripts.build) {
      if (scripts.build.includes('webpack')) buildTool = 'webpack';
      else if (scripts.build.includes('vite')) buildTool = 'vite';
      else if (scripts.build.includes('tsc')) buildTool = 'tsc';
      else if (scripts.build.includes('next')) buildTool = 'next';
      else buildTool = 'custom';
    }
  }
  if (!buildTool && fs.existsSync(path.join(rootDir, 'webpack.config.js'))) buildTool = 'webpack';
  if (!buildTool && fs.existsSync(path.join(rootDir, 'vite.config.ts'))) buildTool = 'vite';
  if (!buildTool && fs.existsSync(path.join(rootDir, 'tsconfig.json'))) buildTool = 'tsc';

  return { types, primary, languages, packageManager, buildTool };
}

export function printProjectInfo(info: ProjectInfo): string {
  const lines: string[] = [chalk.bold('\n  Project Detection')];

  if (info.primary) {
    lines.push(`  ${info.primary.icon} ${chalk.cyan(info.primary.name)} ${chalk.dim(`(${info.primary.confidence}% confidence)`)}`);
    lines.push(`  ${chalk.dim('  Language:')} ${info.languages.join(', ')}`);
  }

  if (info.types.length > 0) {
    lines.push(chalk.dim('\n  All detected:'));
    for (const t of info.types) {
      const bar = confidenceBar(t.confidence);
      lines.push(`  ${t.icon} ${chalk.cyan(t.name.padEnd(12))} ${bar} ${chalk.dim(`${t.confidence}%`)}`);
    }
  } else {
    lines.push(chalk.yellow('\n  No known project types detected.'));
  }

  if (info.packageManager) {
    lines.push(`\n  Package Manager: ${chalk.cyan(info.packageManager)}`);
  }
  if (info.buildTool) {
    lines.push(`  Build Tool: ${chalk.cyan(info.buildTool)}`);
  }

  lines.push('');
  return lines.join('\n');
}

function confidenceBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}
