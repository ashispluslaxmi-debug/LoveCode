export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderConfig {
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  name: string;
  chat(messages: Message[], config: AIProviderConfig): Promise<string>;
  stream?(messages: Message[], config: AIProviderConfig): AsyncIterable<string>;
}
