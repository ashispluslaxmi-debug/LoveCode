import * as fs from 'node:fs';
import * as path from 'node:path';
import { getEmbedding, cosineSimilarity } from '../ai/embeddings.js';

export interface VectorMemoryEntry {
  id: string;
  text: string;
  vector: number[];
  metadata: Record<string, string>;
  timestamp: number;
}

export interface VectorSearchResult {
  entry: VectorMemoryEntry;
  score: number;
}

function getVectorDir(rootDir?: string): string {
  const base = rootDir || process.cwd();
  return path.join(base, '.lovecode', 'memory');
}

function getVectorFilePath(rootDir?: string): string {
  return path.join(getVectorDir(rootDir), 'vectors.json');
}

function ensureDir(rootDir?: string): void {
  const dir = getVectorDir(rootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadVectors(rootDir?: string): VectorMemoryEntry[] {
  const filePath = getVectorFilePath(rootDir);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as VectorMemoryEntry[];
  } catch {
    return [];
  }
}

function saveVectors(entries: VectorMemoryEntry[], rootDir?: string): void {
  ensureDir(rootDir);
  const filePath = getVectorFilePath(rootDir);
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
}

export async function storeVector(
  text: string,
  metadata?: Record<string, string>,
  rootDir?: string,
): Promise<VectorMemoryEntry> {
  const result = await getEmbedding(text);
  const entry: VectorMemoryEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    vector: result.vector,
    metadata: metadata || {},
    timestamp: Date.now(),
  };
  const entries = loadVectors(rootDir);
  entries.push(entry);
  saveVectors(entries, rootDir);
  return entry;
}

export async function storeVectors(
  items: Array<{ text: string; metadata?: Record<string, string> }>,
  rootDir?: string,
): Promise<VectorMemoryEntry[]> {
  const entries = loadVectors(rootDir);
  const newEntries: VectorMemoryEntry[] = [];
  for (const item of items) {
    const result = await getEmbedding(item.text);
    newEntries.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: item.text,
      vector: result.vector,
      metadata: item.metadata || {},
      timestamp: Date.now(),
    });
  }
  entries.push(...newEntries);
  saveVectors(entries, rootDir);
  return newEntries;
}

export async function searchVectors(
  query: string,
  options?: { topK?: number; minScore?: number; filter?: Record<string, string> },
  rootDir?: string,
): Promise<VectorSearchResult[]> {
  const entries = loadVectors(rootDir);
  if (entries.length === 0) return [];

  const queryResult = await getEmbedding(query);
  const queryVec = queryResult.vector;

  const minScore = options?.minScore ?? 0.1;
  const topK = options?.topK ?? 5;

  let filtered = entries;
  if (options?.filter) {
    const filterKeys = Object.keys(options.filter);
    if (filterKeys.length > 0) {
      filtered = entries.filter((e) =>
        filterKeys.every((k) => e.metadata[k] === options.filter![k]),
      );
    }
  }

  const scored: VectorSearchResult[] = filtered.map((entry) => ({
    entry,
    score: cosineSimilarity(queryVec, entry.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score >= minScore).slice(0, topK);
}

export function deleteVector(id: string, rootDir?: string): boolean {
  const entries = loadVectors(rootDir);
  const before = entries.length;
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length < before) {
    saveVectors(filtered, rootDir);
    return true;
  }
  return false;
}

export function clearVectors(rootDir?: string): void {
  const filePath = getVectorFilePath(rootDir);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function getVectorCount(rootDir?: string): number {
  return loadVectors(rootDir).length;
}

export function formatVectorResults(results: VectorSearchResult[]): string {
  if (results.length === 0) return 'No matching memories found.';
  const lines: string[] = ['Vector Memory Search Results:'];
  for (const r of results) {
    const score = (r.score * 100).toFixed(1);
    const tags = Object.entries(r.entry.metadata)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    const meta = tags ? chalkDim(tags) : '';
    lines.push(`  [${score}%] ${r.entry.text.slice(0, 120)}${meta ? ` (${meta})` : ''}`);
  }
  return lines.join('\n');
}

function chalkDim(s: string): string {
  return `\x1b[2m${s}\x1b[22m`;
}
