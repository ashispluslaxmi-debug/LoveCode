import { AIProvider, Message, AIProviderConfig } from './provider.js';
import { Logger } from '../utils/logger.js';

export class OpenAILikeProvider implements AIProvider {
  name: string;
  private baseUrl: string;

  constructor(name: string, baseUrl: string) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async chat(messages: Message[], config: AIProviderConfig): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    Logger.debug(`[${this.name}] chat: ${config.model} (${messages.length} messages)`);

    const apiKey = this.getApiKey();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.2,
        max_tokens: config.maxTokens ?? 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`[${this.name}] API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }

  async *stream(messages: Message[], config: AIProviderConfig): AsyncIterable<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const apiKey = this.getApiKey();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.2,
        max_tokens: config.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`[${this.name}] API error ${response.status}: ${body.slice(0, 200)}`);
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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6).trim();
        if (jsonStr === '[DONE]') return;

        try {
          const parsed = JSON.parse(jsonStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip parse errors
        }
      }
    }
  }

  private getApiKey(): string | undefined {
    const envVar = this.name.toUpperCase();
    return process.env[`${envVar}_API_KEY`] || process.env.OPENAI_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.getApiKey()
          ? { Authorization: `Bearer ${this.getApiKey()}` }
          : {},
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
