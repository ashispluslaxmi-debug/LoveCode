import chalk from 'chalk';
import type { AIProvider, AIProviderConfig } from './provider.js';
import { OllamaProvider } from './ollama.js';
import { OpenAILikeProvider } from './openai-like.js';

export interface ProviderEntry {
  name: string;
  provider: AIProvider;
  models: string[];
  local: boolean;
  priority: number;
  defaultModel: string;
  configOverrides?: Partial<AIProviderConfig>;
  getConfig?: (model: string) => AIProviderConfig;
}

const registry: ProviderEntry[] = [
  {
    name: 'ollama',
    provider: new OllamaProvider(),
    models: ['codellama', 'deepseek-coder', 'llama3.2', 'llama3.1', 'mistral', 'mixtral', 'phi3', 'qwen2.5-coder'],
    local: true,
    priority: 10,
    defaultModel: 'codellama',
    getConfig: (model: string) => ({
      model,
      baseUrl: 'http://localhost:11434',
      temperature: 0.2,
      maxTokens: 8192,
    }),
  },
  {
    name: 'groq',
    provider: new OpenAILikeProvider('groq', 'https://api.groq.com/openai/v1'),
    models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b'],
    local: false,
    priority: 30,
    defaultModel: 'llama3-70b-8192',
    getConfig: (model: string) => ({
      model,
      baseUrl: 'https://api.groq.com/openai/v1',
      temperature: 0.2,
      maxTokens: 8192,
    }),
  },
  {
    name: 'openrouter',
    provider: new OpenAILikeProvider('openrouter', 'https://openrouter.ai/api/v1'),
    models: [
      'google/gemini-2.0-flash-001', 'google/gemini-2.0-flash-lite-preview',
      'mistralai/mistral-7b-instruct', 'meta-llama/llama-3.2-3b-instruct',
      'deepseek/deepseek-chat', 'qwen/qwen-2.5-7b-instruct',
    ],
    local: false,
    priority: 40,
    defaultModel: 'google/gemini-2.0-flash-001',
    getConfig: (model: string) => ({
      model,
      baseUrl: 'https://openrouter.ai/api/v1',
      temperature: 0.2,
      maxTokens: 8192,
    }),
  },
  {
    name: 'together',
    provider: new OpenAILikeProvider('together', 'https://api.together.xyz/v1'),
    models: [
      'mistralai/Mixtral-8x22B-Instruct-v0.1', 'mistralai/Mistral-7B-Instruct-v0.3',
      'meta-llama/Llama-3.2-3B-Instruct-Turbo', 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
      'deepseek-ai/deepseek-coder-33b-instruct', 'Qwen/Qwen2.5-7B-Instruct-Turbo',
    ],
    local: false,
    priority: 50,
    defaultModel: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
    getConfig: (model: string) => ({
      model,
      baseUrl: 'https://api.together.xyz/v1',
      temperature: 0.2,
      maxTokens: 8192,
    }),
  },
  {
    name: 'huggingface',
    provider: new OpenAILikeProvider('huggingface', 'https://api-inference.huggingface.co/v1'),
    models: [
      'HuggingFaceH4/zephyr-7b-beta', 'mistralai/Mistral-7B-Instruct-v0.3',
      'meta-llama/Meta-Llama-3-8B-Instruct', 'google/gemma-2-9b-it',
    ],
    local: false,
    priority: 60,
    defaultModel: 'HuggingFaceH4/zephyr-7b-beta',
    getConfig: (model: string) => ({
      model,
      baseUrl: 'https://api-inference.huggingface.co/v1',
      temperature: 0.2,
      maxTokens: 4096,
    }),
  },
];

export function getProvider(name: string): ProviderEntry | undefined {
  return registry.find((p) => p.name === name);
}

export function getProviderForModel(model: string): ProviderEntry | undefined {
  return registry.find((p) => p.models.includes(model) || p.defaultModel === model);
}

export function getAllProviders(): ProviderEntry[] {
  return [...registry];
}

export function getLocalProviders(): ProviderEntry[] {
  return registry.filter((p) => p.local);
}

export function getRemoteProviders(): ProviderEntry[] {
  return registry.filter((p) => !p.local);
}

export function resolveModel(modelOrProvider: string): { entry: ProviderEntry; model: string } {
  const byName = getProvider(modelOrProvider);
  if (byName) {
    return { entry: byName, model: byName.defaultModel };
  }

  const byModel = getProviderForModel(modelOrProvider);
  if (byModel) {
    return { entry: byModel, model: modelOrProvider };
  }

  const local = getLocalProviders()[0];
  return { entry: local, model: modelOrProvider };
}

export function printProviders(): string {
  const lines: string[] = [chalk.bold('\n  Available Providers')];

  for (const entry of registry) {
    const tag = entry.local ? chalk.green(' LOCAL ') : chalk.blue(' CLOUD ');
    const defaultModel = chalk.dim(`(default: ${entry.defaultModel})`);
    const models = entry.models.slice(0, 4).join(', ');
    const more = entry.models.length > 4 ? chalk.dim(` +${entry.models.length - 4} more`) : '';
    lines.push(`\n  ${tag} ${chalk.cyan(entry.name.padEnd(12))} ${defaultModel}`);
    lines.push(`      ${chalk.dim(models)}${more}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function setDefaultModel(model: string): { provider: string; model: string } | null {
  const resolved = resolveModel(model);
  resolved.entry.defaultModel = resolved.model;
  return { provider: resolved.entry.name, model: resolved.model };
}

export function getDefaultModel(): { provider: string; model: string } {
  const highest = [...registry].sort((a, b) => {
    if (a.local && !b.local) return -1;
    if (!a.local && b.local) return 1;
    return a.priority - b.priority;
  })[0];

  return { provider: highest.name, model: highest.defaultModel };
}
