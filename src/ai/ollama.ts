import { AIProvider, Message, AIProviderConfig } from './provider.js';
import { Logger } from '../utils/logger.js';

export class OllamaProvider implements AIProvider {
  name = 'ollama';

  async chat(messages: Message[], config: AIProviderConfig): Promise<string> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    Logger.debug(`Ollama chat: ${config.model} (${messages.length} messages)`);

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        options: {
          temperature: config.temperature ?? 0.2,
          num_predict: config.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content ?? '';
  }

  async *stream(messages: Message[], config: AIProviderConfig): AsyncIterable<string> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        options: {
          temperature: config.temperature ?? 0.2,
          num_predict: config.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.done) return;
          if (parsed.message?.content) {
            yield parsed.message.content;
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async isAvailable(baseUrl?: string): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl || 'http://localhost:11434'}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
