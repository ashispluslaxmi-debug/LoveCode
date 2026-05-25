import { Command } from 'commander';
import chalk from 'chalk';
import { OllamaProvider } from '../ai/ollama.js';
import { ChatHistory, SlashHandler, renderMarkdown, createSimpleInput } from '../chat/index.js';
import type { AIProvider, AIProviderConfig } from '../ai/provider.js';
import {
  createSession,
  appendToSession,
  writeChatLog,
  ensureDirs,
  getPreferences,
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
  .option('-m, --model <name>', 'AI model to use', 'codellama')
  .option('-p, --provider <name>', 'AI provider (ollama, openai-compatible)', 'ollama')
  .option('--base-url <url>', 'Base URL for the AI provider', 'http://localhost:11434')
  .option('--no-stream', 'Disable streaming responses')
  .option('--resume', 'Resume last session')
  .action(async (options) => {
    ensureDirs();
    const history = new ChatHistory();
    const slash = new SlashHandler();
    const provider: AIProvider = new OllamaProvider();
    const prefs = getPreferences();

    const providerConfig: AIProviderConfig = {
      model: options.model,
      baseUrl: options.baseUrl,
      temperature: prefs.indentSize ? 0.2 : 0.2,
      maxTokens: 4096,
    };

    history.createSession(`Chat - ${options.model}`);

    renderHeader();
    console.log(chalk.dim(`  Model: ${options.model}  •  Provider: ${options.provider}`));
    console.log(chalk.dim(`  Session: ${history.getCurrent()?.id}\n`));

    if (!(provider as OllamaProvider).isAvailable) {
      const available = await (provider as OllamaProvider).isAvailable(options.baseUrl);
      if (!available) {
        console.log(chalk.yellow('  ⚠ Ollama not detected. Start it with: ollama serve'));
        console.log(chalk.yellow(`  Ensure model "${options.model}" is pulled: ollama pull ${options.model}\n`));
      }
    }

    const session = createSession(`Chat - ${options.model}`, {
      model: options.model,
      provider: options.provider,
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
          history.createSession(`Chat - ${options.model}`);
        }
        if (input === '/reset') {
          history.reset();
          history.createSession(`Chat - ${options.model}`);
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
