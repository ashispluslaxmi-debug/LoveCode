import * as path from 'path';
import chalk from 'chalk';
import type { ScannedFile } from './scanner.js';

export interface RankedFile extends ScannedFile {
  rankScore: number;
  rankReasons: string[];
}

export interface RankOptions {
  boostSource?: boolean;
  boostRecent?: boolean;
  boostShallow?: boolean;
  boostConfig?: boolean;
  recentHours?: number;
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  source: 100,
  config: 70,
  script: 60,
  doc: 40,
  data: 30,
  other: 10,
};

const EXTENSION_BOOSTS: Record<string, number> = {
  '.ts': 15,
  '.tsx': 15,
  '.js': 10,
  '.jsx': 10,
  '.py': 12,
  '.rs': 12,
  '.go': 12,
  '.md': 5,
};

const IMPORTANT_FILES: Record<string, number> = {
  'package.json': 50,
  'tsconfig.json': 40,
  'Cargo.toml': 40,
  'go.mod': 40,
  'pyproject.toml': 40,
  'Dockerfile': 30,
  'docker-compose.yml': 30,
  'Makefile': 25,
  'README.md': 20,
  'index.ts': 20,
  'main.ts': 20,
  'app.ts': 20,
  'server.ts': 20,
  'cli.ts': 15,
  'main.py': 20,
  'main.rs': 20,
  'main.go': 20,
  'mod.rs': 15,
  'lib.rs': 15,
  'index.js': 20,
  'main.js': 20,
};

export function rankFiles(
  files: ScannedFile[],
  taskDescription?: string,
  options: RankOptions = {},
): RankedFile[] {
  const {
    boostSource = true,
    boostRecent = true,
    boostShallow = true,
    boostConfig = true,
    recentHours = 48,
  } = options;

  const taskTokens = taskDescription
    ? taskDescription.toLowerCase().split(/[\s_-]+/).filter((w) => w.length > 2)
    : [];

  const now = Date.now();
  const recentCutoff = now - recentHours * 60 * 60 * 1000;

  const results: RankedFile[] = files.map((file) => {
    let score = 0;
    const reasons: string[] = [];
    const basename = path.basename(file.path);

    score += CATEGORY_WEIGHTS[file.category] || 10;
    reasons.push(`category:${file.category}=${CATEGORY_WEIGHTS[file.category] || 10}`);

    if (boostSource && file.category === 'source') {
      const extBoost = EXTENSION_BOOSTS[file.extension] || 0;
      if (extBoost > 0) {
        score += extBoost;
        reasons.push(`ext-boost:${file.extension}=${extBoost}`);
      }
    }

    if (IMPORTANT_FILES[basename] !== undefined) {
      score += IMPORTANT_FILES[basename];
      reasons.push(`important-file:${basename}=${IMPORTANT_FILES[basename]}`);
    }

    if (boostConfig && file.category === 'config') {
      score += 15;
      reasons.push('config-boost=15');
    }

    if (boostRecent && file.modifiedAt.getTime() > recentCutoff) {
      const recencyBoost = 20;
      score += recencyBoost;
      reasons.push(`recently-modified=${recencyBoost}`);
    }

    if (boostShallow) {
      const depth = file.relativePath.split('/').length;
      const depthBoost = Math.max(0, 20 - depth * 2);
      score += depthBoost;
      if (depthBoost > 0) reasons.push(`shallow-depth=${depthBoost}`);
    }

    if (file.size < 100) {
      score -= 5;
      reasons.push('small-file=-5');
    }

    if (file.size > 500000) {
      score -= 10;
      reasons.push('large-file=-10');
    }

    if (taskTokens.length > 0) {
      const lowerPath = file.relativePath.toLowerCase();
      const lowerName = basename.toLowerCase();
      let taskMatchScore = 0;

      for (const token of taskTokens) {
        if (lowerName.includes(token)) taskMatchScore += 15;
        if (lowerPath.includes(token)) taskMatchScore += 8;
      }

      if (taskMatchScore > 0) {
        score += taskMatchScore;
        reasons.push(`task-match=${taskMatchScore}`);
      }
    }

    return { ...file, rankScore: score, rankReasons: reasons };
  });

  results.sort((a, b) => b.rankScore - a.rankScore);
  return results;
}

export function getTopFiles(files: ScannedFile[], n: number = 10, task?: string): RankedFile[] {
  return rankFiles(files, task).slice(0, n);
}

export function printRankedFiles(ranked: RankedFile[]): string {
  const lines: string[] = [''];
  lines.push(chalk.bold('  File Context Rankings'));

  const maxScore = ranked.length > 0 ? ranked[0].rankScore : 1;

  for (const file of ranked) {
    const barLength = Math.round((file.rankScore / maxScore) * 20);
    const bar = chalk.cyan('█'.repeat(barLength)) + chalk.dim('░'.repeat(20 - barLength));
    const pct = Math.round((file.rankScore / maxScore) * 100);
    lines.push(`  ${chalk.dim(file.relativePath)}`);
    lines.push(`  ${bar} ${chalk.bold(String(file.rankScore))} ${chalk.dim(`(${pct}%)`)}`);
  }

  lines.push('');
  return lines.join('\n');
}
