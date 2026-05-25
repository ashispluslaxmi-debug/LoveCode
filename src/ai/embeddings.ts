import { execSync } from 'node:child_process';

export interface EmbeddingResult {
  vector: number[];
  model: string;
  provider: string;
}

export async function getEmbedding(text: string): Promise<EmbeddingResult> {
  const ollamaBaseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { embedding?: number[] };
      if (data.embedding) {
        return { vector: data.embedding, model: 'nomic-embed-text', provider: 'ollama' };
      }
    }
  } catch {
    // fall through
  }

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'all-minilm',
        prompt: text,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { embedding?: number[] };
      if (data.embedding) {
        return { vector: data.embedding, model: 'all-minilm', provider: 'ollama' };
      }
    }
  } catch {
    // fall through
  }

  return getSimpleEmbedding(text);
}

function getSimpleEmbedding(text: string): EmbeddingResult {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const vector = new Array(128).fill(0);

  const chars = text.split('');
  for (let i = 0; i < Math.min(chars.length, 128); i++) {
    vector[i] = chars[i].charCodeAt(0) / 255;
  }

  return { vector, model: 'simple', provider: 'local' };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function averageEmbedding(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const avg = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < v.length; i++) {
      avg[i] += v[i] / vectors.length;
    }
  }
  return avg;
}

export function checkOllamaEmbeddingModel(): boolean {
  try {
    execSync('ollama list 2>/dev/null | grep -q "nomic-embed-text\\|all-minilm"', {
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}
