export { OllamaProvider } from './ollama.js';
export { OpenAILikeProvider } from './openai-like.js';
export { chatWithFallback, streamWithFallback } from './fallback.js';
export {
  getProvider, getProviderForModel, getAllProviders,
  getLocalProviders, getRemoteProviders,
  resolveModel, setDefaultModel, getDefaultModel,
  printProviders,
} from './registry.js';
export type { ProviderEntry } from './registry.js';
export { getEmbedding, cosineSimilarity, averageEmbedding } from './embeddings.js';
export type { AIProvider, AIProviderConfig, Message } from './provider.js';
