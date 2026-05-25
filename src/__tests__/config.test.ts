import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig, saveConfig, resetConfig, getDefaults, formatConfig } from '../config/config.js';
import { loadEnv, saveEnv, KNOWN_ENV_VARS } from '../config/env.js';
import { cached, cachedAsync, invalidateCache } from '../performance/cache.js';

const TEST_DIR = '/tmp/lovecode-test-config';

describe('Config System', () => {
  afterEach(() => {
    resetConfig(TEST_DIR);
    invalidateCache();
  });

  it('loads default config when no file exists', () => {
    const config = loadConfig(TEST_DIR);
    expect(config.model).toBe('deepseek');
    expect(config.theme).toBe('neon');
    expect(config.approval_mode).toBe('smart');
    expect(config.telemetry?.enabled).toBe(false);
  });

  it('saves and loads YAML config', () => {
    const config = getDefaults();
    config.model = 'codellama';
    config.theme = 'ocean';
    config.approval_mode = 'strict';
    config.telemetry = { enabled: true, crash_reports: false };
    saveConfig(config, TEST_DIR);

    const loaded = loadConfig(TEST_DIR);
    expect(loaded.model).toBe('codellama');
    expect(loaded.theme).toBe('ocean');
    expect(loaded.approval_mode).toBe('strict');
    expect(loaded.telemetry?.enabled).toBe(true);
  });

  it('overrides from environment variables', () => {
    process.env.LOVECODE_MODEL = 'mistral';
    process.env.LOVECODE_THEME = 'forest';
    process.env.LOVECODE_APPROVAL_MODE = 'permissive';

    const config = loadConfig(TEST_DIR);
    expect(config.model).toBe('mistral');
    expect(config.theme).toBe('forest');
    expect(config.approval_mode).toBe('permissive');

    delete process.env.LOVECODE_MODEL;
    delete process.env.LOVECODE_THEME;
    delete process.env.LOVECODE_APPROVAL_MODE;
  });

  it('formatConfig returns non-empty string', () => {
    const config = getDefaults();
    const output = formatConfig(config);
    expect(output.length).toBeGreaterThan(50);
    expect(output).toContain('deepseek');
    expect(output).toContain('neon');
  });
});

describe('Environment Variables', () => {
  afterEach(() => {
    const envPath = '/tmp/lovecode-test-env/.env';
    const fs = require('node:fs');
    if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
  });

  it('loads env vars from .env file', () => {
    const { writeFileSync, existsSync, unlinkSync, mkdirSync } = require('node:fs');
    const dir = '/tmp/lovecode-test-env';
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/.env`, 'GROQ_API_KEY=gsk_test123\nOPENROUTER_API_KEY=sk-or-abc\n', 'utf-8');

    const vars = loadEnv(dir);
    expect(vars.GROQ_API_KEY).toBe('gsk_test123');
    expect(vars.OPENROUTER_API_KEY).toBe('sk-or-abc');

    if (existsSync(`${dir}/.env`)) unlinkSync(`${dir}/.env`);
  });

  it('saves env vars to .env file', () => {
    saveEnv({ GROQ_API_KEY: 'test-key-123' }, '/tmp/lovecode-test-env-2');
    const vars = loadEnv('/tmp/lovecode-test-env-2');
    expect(vars.GROQ_API_KEY).toBe('test-key-123');
  });

  it('includes all known env vars in save', () => {
    saveEnv({}, '/tmp/lovecode-test-env-3');
    const vars = loadEnv('/tmp/lovecode-test-env-3');
    // Should have defaults for all known vars
    expect(vars.OLLAMA_URL).toBe('http://localhost:11434');
  });
});

describe('Performance Cache', () => {
  afterEach(() => {
    invalidateCache();
  });

  it('caches values with TTL', () => {
    let callCount = 0;
    const result1 = cached('test-key', 5000, () => {
      callCount++;
      return 'value1';
    });
    expect(result1).toBe('value1');
    expect(callCount).toBe(1);

    const result2 = cached('test-key', 5000, () => {
      callCount++;
      return 'value2';
    });
    expect(result2).toBe('value1');
    expect(callCount).toBe(1);
  });

  it('expires cache after TTL', async () => {
    let callCount = 0;
    cached('expire-key', 10, () => {
      callCount++;
      return 'fresh';
    });
    expect(callCount).toBe(1);

    await new Promise((r) => setTimeout(r, 20));
    cached('expire-key', 10, () => {
      callCount++;
      return 'stale';
    });
    expect(callCount).toBe(2);
  });

  it('caches async values', async () => {
    let callCount = 0;
    const result1 = await cachedAsync('async-key', 5000, async () => {
      callCount++;
      return 'async-val';
    });
    expect(result1).toBe('async-val');
    expect(callCount).toBe(1);

    const result2 = await cachedAsync('async-key', 5000, async () => {
      callCount++;
      return 'new-val';
    });
    expect(result2).toBe('async-val');
    expect(callCount).toBe(1);
  });

  it('invalidates specific cache key', () => {
    cached('a', 5000, () => 'a');
    cached('b', 5000, () => 'b');
    invalidateCache('a');
    expect(cached('a', 5000, () => 'new-a')).toBe('new-a');
    expect(cached('b', 5000, () => 'new-b')).toBe('b');
  });

  it('clears all cache', () => {
    cached('x', 5000, () => 'x');
    invalidateCache();
    expect(cached('x', 5000, () => 'new-x')).toBe('new-x');
  });
});
