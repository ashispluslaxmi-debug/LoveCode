import { describe, it, expect } from 'vitest';
import { getProvider, getAllProviders, getLocalProviders, getRemoteProviders, resolveModel, printProviders } from '../ai/registry.js';
import { cosineSimilarity, averageEmbedding } from '../ai/embeddings.js';

describe('AI Registry', () => {
  it('has ollama provider', () => {
    const ollama = getProvider('ollama');
    expect(ollama).toBeDefined();
    expect(ollama!.local).toBe(true);
    expect(ollama!.models).toContain('codellama');
  });

  it('has groq provider', () => {
    const groq = getProvider('groq');
    expect(groq).toBeDefined();
    expect(groq!.local).toBe(false);
  });

  it('has multiple providers', () => {
    const all = getAllProviders();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it('finds local providers', () => {
    const local = getLocalProviders();
    expect(local.length).toBeGreaterThanOrEqual(1);
    expect(local[0].local).toBe(true);
  });

  it('finds remote providers', () => {
    const remote = getRemoteProviders();
    expect(remote.length).toBeGreaterThanOrEqual(4);
  });

  it('resolves provider by name', () => {
    const resolved = resolveModel('ollama');
    expect(resolved.entry.name).toBe('ollama');
  });

  it('resolves model to its provider', () => {
    const resolved = resolveModel('deepseek-coder');
    expect(resolved.entry.name).toBe('ollama');
    expect(resolved.model).toBe('deepseek-coder');
  });

  it('generates provider listing', () => {
    const listing = printProviders();
    expect(listing).toContain('ollama');
    expect(listing).toContain('groq');
    expect(listing).toContain('openrouter');
  });
});

describe('Embeddings', () => {
  it('computes cosine similarity', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);

    const c = [0, 1, 0];
    expect(cosineSimilarity(a, c)).toBeCloseTo(0, 5);
  });

  it('computes average embedding', () => {
    const vectors = [[1, 0], [0, 1]];
    const avg = averageEmbedding(vectors);
    expect(avg[0]).toBeCloseTo(0.5);
    expect(avg[1]).toBeCloseTo(0.5);
  });
});
