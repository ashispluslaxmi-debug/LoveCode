import chalk from 'chalk';
import type { Message } from './provider.js';
import { getProvider, getProviderForModel, getAllProviders, type ProviderEntry } from './registry.js';

export interface FallbackResult {
  content: string;
  provider: string;
  model: string;
  attempts: Array<{ provider: string; model: string; error?: string }>;
}

export async function chatWithFallback(
  messages: Message[],
  preferredModel: string,
  preferredProvider?: string,
  offlineOnly: boolean = false,
): Promise<FallbackResult> {
  const attempts: Array<{ provider: string; model: string; error?: string }> = [];
  let chain: ProviderEntry[] = [];

  if (preferredProvider) {
    const entry = getProvider(preferredProvider);
    if (entry && (!offlineOnly || entry.local)) {
      chain.push(entry);
    }
  }

  const modelEntry = !preferredProvider ? getProviderForModel(preferredModel) : undefined;
  if (modelEntry && !chain.find((c) => c.name === modelEntry.name)) {
    if (!offlineOnly || modelEntry.local) {
      chain.push(modelEntry);
    }
  }

  const sorted = getAllProviders().sort((a, b) => a.priority - b.priority);

  for (const entry of sorted) {
    if (!chain.find((c) => c.name === entry.name)) {
      if (!offlineOnly || entry.local) {
        chain.push(entry);
      }
    }
  }

  if (offlineOnly) {
    chain = chain.filter((e) => e.local);
  }

  for (const entry of chain) {
    const model = preferredModel && getProviderForModel(preferredModel)?.name === entry.name
      ? preferredModel
      : entry.defaultModel;

    const config = entry.getConfig?.(model) || {
      model,
      baseUrl: entry.name === 'ollama' ? 'http://localhost:11434' : undefined,
      temperature: 0.2,
      maxTokens: 8192,
    };

    try {
      const content = await entry.provider.chat(messages, config);
      attempts.push({ provider: entry.name, model });
      return { content, provider: entry.name, model, attempts };
    } catch (err) {
      const error = (err as Error).message;
      attempts.push({ provider: entry.name, model, error });
      continue;
    }
  }

  throw new Error(
    `All providers failed:\n${attempts
      .map((a) => `  ${chalk.red('✗')} ${a.provider}/${a.model}: ${a.error || 'unknown error'}`)
      .join('\n')}`,
  );
}

export async function streamWithFallback(
  messages: Message[],
  preferredModel: string,
  preferredProvider?: string,
  offlineOnly: boolean = false,
): Promise<{
  stream: AsyncIterable<string>;
  provider: string;
  model: string;
}> {
  let chain: ProviderEntry[] = [];

  if (preferredProvider) {
    const entry = getProvider(preferredProvider);
    if (entry && (!offlineOnly || entry.local)) {
      chain.push(entry);
    }
  }

  const modelEntry = !preferredProvider ? getProviderForModel(preferredModel) : undefined;
  if (modelEntry && !chain.find((c) => c.name === modelEntry.name)) {
    if (!offlineOnly || modelEntry.local) {
      chain.push(modelEntry);
    }
  }

  const sorted = getAllProviders().sort((a, b) => a.priority - b.priority);

  for (const entry of sorted) {
    if (!chain.find((c) => c.name === entry.name)) {
      if (!offlineOnly || entry.local) {
        chain.push(entry);
      }
    }
  }

  if (offlineOnly) {
    chain = chain.filter((e) => e.local);
  }

  for (const entry of chain) {
    const model = preferredModel && getProviderForModel(preferredModel)?.name === entry.name
      ? preferredModel
      : entry.defaultModel;

    const config = entry.getConfig?.(model) || {
      model,
      baseUrl: entry.name === 'ollama' ? 'http://localhost:11434' : undefined,
      temperature: 0.2,
      maxTokens: 8192,
    };

    if (entry.provider.stream) {
      try {
        const stream = entry.provider.stream(messages, config);
        return { stream, provider: entry.name, model };
      } catch {
        continue;
      }
    }

    try {
      const content = await entry.provider.chat(messages, config);
      const stream = async function* () {
        yield content;
      };
      return { stream: stream(), provider: entry.name, model };
    } catch {
      continue;
    }
  }

  throw new Error('All providers failed for streaming');
}
