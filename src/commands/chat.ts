import { Command } from 'commander';
import chalk from 'chalk';
import { ChatHistory, SlashHandler, renderMarkdown, createSimpleInput } from '../chat/index.js';
import type { AIProvider, AIProviderConfig } from '../ai/provider.js';
import {
  createSession,
  appendToSession,
  writeChatLog,
  ensureDirs,
} from '../memory/index.js';

function renderHeader(): void {
  console.log(chalk.bold.cyan('\n  ╔════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║         LoveCode AI ⚡  Interactive Chat       ║'));
  console.log(chalk.bold.cyan('  ╚════════════════════════════════════════════════╝'));
  console.log(chalk.dim('  Type /help for commands  •  /exit to quit\n'));
}

function renderUserMessage(content: string): void {
  console.log(chalk.bold.green('\n  ── You ──'));
  console.log(`  ${content}`);
}

export const chatCommand = new Command('chat')
  .alias('c')
  .description('Start an interactive chat session with LoveCode AI')
  .option('-m, --model <name>', 'AI model to use')
  .option('-p, --provider <name>', 'AI provider (ollama, groq, openrouter, together, huggingface)')
  .option('--base-url <url>', 'Base URL for the AI provider')
  .option('--no-stream', 'Disable streaming responses')
  .option('--resume', 'Resume last session')
  .action(async (options) => {
    ensureDirs();

    let loadEnvFn: (dir?: string) => Record<string, string> = () => ({});
    let loadConfigFn: () => { model?: string; provider?: string } = () => ({});
    try {
      ({ loadEnv: loadEnvFn } = await import('../config/env.js'));
      ({ loadConfig: loadConfigFn } = await import('../config/config.js'));
      loadEnvFn();
    } catch {
      // proceed without config
    }

    let cfgModel = options.model;
    let cfgProvider = options.provider;
    let cfgBaseUrl = options.baseUrl;

    if (!cfgModel || !cfgProvider) {
      try {
        const config = loadConfigFn();
        if (!cfgModel) cfgModel = config.model || 'codellama';
        if (!cfgProvider) cfgProvider = config.provider || 'ollama';
      } catch {
        if (!cfgModel) cfgModel = 'codellama';
        if (!cfgProvider) cfgProvider = 'ollama';
      }
    }

    const { resolveModel } = await import('../ai/registry.js');
    const resolved = resolveModel(cfgProvider || cfgModel || 'codellama');
    const entry = resolved.entry;
    const model = entry.models.includes(cfgModel || '') ? cfgModel || entry.defaultModel : entry.defaultModel;
    const cfg = entry.getConfig?.(model) || { model, baseUrl: cfgBaseUrl || 'http://localhost:11434', temperature: 0.2, maxTokens: 4096 };

    const provider: AIProvider = entry.provider;
    const providerConfig: AIProviderConfig = {
      model,
      baseUrl: cfgBaseUrl || cfg.baseUrl,
      temperature: cfg.temperature ?? 0.2,
      maxTokens: cfg.maxTokens ?? 4096,
    };

    const history = new ChatHistory();
    const slash = new SlashHandler();
    history.createSession(`Chat - ${model}`);

    renderHeader();
    console.log(chalk.dim(`  Model: ${model}  •  Provider: ${entry.name}`));
    console.log(chalk.dim(`  Session: ${history.getCurrent()?.id}\n`));

    const session = createSession(`Chat - ${model}`, {
      model,
      provider: entry.name,
    });
    let dirty = false;

    const saveLog = () => {
      if (!dirty) return;
      try {
        const path = writeChatLog(session.id, session.title, session.entries);
        console.log(chalk.dim(`\n  Chat log saved: ${path}`));
      } catch {
        // skip
      }
    };

    process.on('SIGINT', () => {
      console.log(chalk.cyan('\n  Goodbye! ⚡\n'));
      saveLog();
      process.exit(0);
    });

    while (true) {
      const rawInput = await createSimpleInput(chalk.bold('  You > '));
      const input = rawInput.trim();

      if (!input) continue;

      if (slash.isSlashCommand(input)) {
        const result = await slash.execute(input);
        if (result === '__EXIT__') {
          saveLog();
          console.log(chalk.cyan('\n  Goodbye! ⚡\n'));
          process.exit(0);
        }
        if (result) {
          console.log(result);
        }
        if (input === '/clear') {
          history.reset();
          history.createSession(`Chat - ${model}`);
        }
        if (input === '/reset') {
          history.reset();
          history.createSession(`Chat - ${model}`);
          console.log(chalk.green('  ✓ Conversation reset\n'));
        }
        continue;
      }

      renderUserMessage(input);
      history.append('user', input);
      appendToSession(session, 'user', input);
      dirty = true;

      try {
        const messages = history.getMessages();
        const messagesTyped = messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

        process.stdout.write(chalk.bold.cyan('\n  ── LoveCode ──'));

        if (options.stream && provider.stream) {
          let fullResponse = '';
          let isFirst = true;

          for await (const token of provider.stream(messagesTyped, providerConfig)) {
            if (isFirst) {
              process.stdout.write('\n');
              isFirst = false;
            }
            process.stdout.write(token);
            fullResponse += token;
          }

          console.log('\n');
          history.append('assistant', fullResponse);
          appendToSession(session, 'assistant', fullResponse);
        } else {
          const response = await provider.chat(messagesTyped, providerConfig);
          const rendered = renderMarkdown(response);
          console.log(`\n${rendered}\n`);
          history.append('assistant', response);
          appendToSession(session, 'assistant', response);
        }
      } catch (err) {
        console.log(chalk.red(`\n  ✗ Error: ${(err as Error).message}\n`));
      }
    }
  });
