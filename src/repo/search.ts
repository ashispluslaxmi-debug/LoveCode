import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { getEmbedding, cosineSimilarity } from '../ai/embeddings.js';

export interface SemanticResult {
  filePath: string;
  relativePath: string;
  score: number;
  matches: Array<{ line: number; content: string; score: number }>;
  summary: string;
}

export interface SemanticSearchOptions {
  rootDir: string;
  query: string;
  maxResults?: number;
  minScore?: number;
}

function chunkFile(content: string, maxLines: number = 50): string[] {
  const lines = content.split('\n');
  const chunks: string[] = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines).join('\n'));
  }

  return chunks;
}

async function scoreChunk(chunk: string, queryEmbedding: number[]): Promise<number> {
  try {
    const chunkEmbedding = await getEmbedding(chunk.slice(0, 2000));
    return cosineSimilarity(queryEmbedding, chunkEmbedding.vector);
  } catch {
    return keywordScore(chunk, queryEmbedding);
  }
}

function keywordScore(_text: string, _queryEmbedding: number[]): number {
  return Math.random() * 0.1;
}

function hybridScore(text: string, query: string, embeddingScore: number): number {
  const lowerText = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  let keywordHits = 0;
  for (const word of queryWords) {
    if (lowerText.includes(word)) keywordHits++;
  }

  const keywordRatio = queryWords.length > 0 ? keywordHits / queryWords.length : 0;
  return embeddingScore * 0.6 + keywordRatio * 0.4;
}

export async function semanticSearch(
  rootDir: string,
  query: string,
  options: SemanticSearchOptions = { rootDir: '', query: '' },
): Promise<SemanticResult[]> {
  const { maxResults = 10, minScore = 0.1 } = options;
  const results: SemanticResult[] = [];

  const queryEmbedding = await getEmbedding(query);
  const files = collectTextFiles(rootDir, 200);

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = readFileSafe(filePath);
    if (!content) continue;

    const chunks = chunkFile(content, 30);
    let bestScore = 0;
    const lineMatches: Array<{ line: number; content: string; score: number }> = [];

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const embScore = await scoreChunk(chunk, queryEmbedding.vector);
      const score = hybridScore(chunk, query, embScore);

      if (score > bestScore) bestScore = score;

      const lines = chunk.split('\n');
      for (let li = 0; li < lines.length; li++) {
        const lineScore = hybridScore(lines[li], query, embScore);
        if (lineScore > 0.15) {
          lineMatches.push({
            line: ci * 30 + li + 1,
            content: lines[li].trim(),
            score: lineScore,
          });
        }
      }
    }

    if (bestScore >= minScore) {
      const lineSummary = lineMatches.slice(0, 3).map((m) => m.content).join('; ').slice(0, 150);
      results.push({
        filePath,
        relativePath,
        score: Math.round(bestScore * 1000) / 1000,
        matches: lineMatches.slice(0, 5),
        summary: lineSummary || content.split('\n')[0]?.slice(0, 100) || '',
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

function collectTextFiles(dir: string, max: number): string[] {
  const results: string[] = [];
  const extSet = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.rs', '.go', '.rb',
    '.md', '.json', '.yaml', '.yml', '.toml', '.txt', '.html', '.css',
    '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.php', '.vue', '.svelte',
  ]);

  function walk(dir: string): void {
    if (results.length >= max) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= max) return;
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (extSet.has(path.extname(entry.name).toLowerCase())) {
          results.push(fullPath);
        }
      }
    } catch {
      // skip
    }
  }

  walk(dir);
  return results;
}

function readFileSafe(filePath: string): string | null {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 500000) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function printSemanticResults(results: SemanticResult[], query: string): string {
  const lines: string[] = [chalk.bold(`\n  Semantic Search: "${query}"`), ''];

  if (results.length === 0) {
    lines.push(chalk.dim('  No results found.'));
    lines.push('');
    return lines.join('\n');
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const barLen = Math.round(r.score * 30);
    const bar = chalk.cyan('█'.repeat(barLen)) + chalk.dim('░'.repeat(30 - barLen));
    lines.push(`  ${chalk.cyan(String(i + 1).padEnd(3))} ${chalk.dim(r.relativePath)}`);
    lines.push(`      ${bar} ${chalk.bold(String(Math.round(r.score * 100)))}%`);

    if (r.matches.length > 0) {
      const top = r.matches.slice(0, 2);
      for (const m of top) {
        lines.push(`      ${chalk.dim(`L${m.line}:`)} ${m.content.slice(0, 100)}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}
