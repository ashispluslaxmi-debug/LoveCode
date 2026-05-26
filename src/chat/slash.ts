import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { createRequire } from 'node:module';
import type { ProviderEntry } from '../ai/registry.js';

const _require = createRequire(import.meta.url);

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  execute(args: string[]): string | Promise<string>;
}

function readMasked(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    const onData = (char: string) => {
      const code = char.charCodeAt(0);
      if (code === 3) {
        rl.close();
        stdin.removeListener('data', onData);
        resolve('');
        return;
      }
      stdin.write('\x1B[2K\x1B[200D' + prompt + '*'.repeat(rl.line.length + 1));
    };
    stdin.on('data', onData);
    rl.question(prompt, (answer) => {
      stdin.removeListener('data', onData);
      stdin.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

function readInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
}

function envFilePath(): string {
  return path.resolve(process.cwd(), '.env');
}

function saveApiKey(provider: string, apiKey: string): void {
  const envPath = envFilePath();
  const keyName = `${provider.toUpperCase()}_API_KEY`;
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
    const regex = new RegExp(`^${keyName}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${keyName}=${apiKey}`);
    } else {
      content += `\n${keyName}=${apiKey}\n`;
    }
  } else {
    content = `# LoveCode AI - API Keys\n${keyName}=${apiKey}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf-8');
  process.env[keyName] = apiKey;
}

function getSavedProviders(): { provider: string; keySet: boolean }[] {
  const providers = ['groq', 'openrouter', 'together', 'huggingface'];
  const result: { provider: string; keySet: boolean }[] = [];
  if (fs.existsSync(envFilePath())) {
    const content = fs.readFileSync(envFilePath(), 'utf-8');
    for (const p of providers) {
      const keyName = `${p.toUpperCase()}_API_KEY`;
      const regex = new RegExp(`^${keyName}=(.+)$`, 'm');
      const match = content.match(regex);
      result.push({ provider: p, keySet: !!match && match[1].length > 0 });
    }
  } else {
    for (const p of providers) {
      result.push({ provider: p, keySet: !!process.env[`${p.toUpperCase()}_API_KEY`] });
    }
  }
  return result;
}

export class SlashHandler {
  private commands: Map<string, SlashCommand> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register({
      name: 'help',
      description: 'Show available slash commands',
      usage: '/help',
      execute: () => this.showHelp(),
    });

    this.register({
      name: 'clear',
      description: 'Clear the current session history',
      usage: '/clear',
      execute: () => {
        return 'Session cleared';
      },
    });

    this.register({
      name: 'models',
      description: 'List available AI models',
      usage: '/models',
      execute: () => {
        const { getAllProviders } = _require('../ai/registry.js');
        const providers = getAllProviders();
        const lines: string[] = [chalk.bold('\n  Available Models by Provider')];
        for (const entry of providers) {
          const tag = entry.local ? chalk.green(' LOCAL ') : chalk.blue(' CLOUD ');
          lines.push(`\n  ${tag} ${chalk.cyan(entry.name)}`);
          for (const m of entry.models) {
            const def = m === entry.defaultModel ? chalk.dim(' (default)') : '';
            lines.push(`    ${chalk.dim('•')} ${chalk.white(m)}${def}`);
          }
        }
        lines.push('');
        return lines.join('\n');
      },
    });

    this.register({
      name: 'connect',
      description: 'Configure provider, model, and API key',
      usage: '/connect',
      execute: async () => {
        const { getAllProviders } = _require('../ai/registry.js');
        const { loadConfig, saveConfig } = _require('../config/config.js');

        const saved = getSavedProviders();
        const providers = getAllProviders();
        const lines: string[] = [chalk.bold('\n  ⚡ Connect to an AI Provider')];

        lines.push(chalk.dim('\n  Already configured:'));
        for (const s of saved) {
          const icon = s.keySet ? chalk.green('✓') : chalk.dim('○');
          const keyDisplay = s.keySet ? chalk.dim('(key saved)') : chalk.dim('(no key)');
          lines.push(`  ${icon} ${chalk.cyan(s.provider.padEnd(15))} ${keyDisplay}`);
        }

        lines.push(chalk.dim('\n  Available providers:'));
        providers.forEach((p: ProviderEntry, i: number) => {
          const tag = p.local ? chalk.green('local') : chalk.blue('cloud');
          lines.push(`  ${chalk.cyan(`${i + 1}`)}. ${chalk.white(p.name.padEnd(15))} ${tag}`);
        });
        lines.push('');
        console.log(lines.join('\n'));

        const choice = await readInput(`  ${chalk.cyan('?')} Select provider (1-${providers.length}): `);
        const idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= providers.length) {
          return chalk.red('Invalid selection.') + chalk.dim(' Use /connect to try again.');
        }

        const entry = providers[idx];
        const providerName = entry.name;

        console.log(chalk.bold(`\n  Provider: ${chalk.cyan(providerName)}`));

        console.log(chalk.dim('\n  Available models:'));
        entry.models.forEach((m: string, i: number) => {
          const def = m === entry.defaultModel ? chalk.dim(' (default)') : '';
          console.log(`  ${chalk.cyan(`${i + 1}`)}. ${chalk.white(m)}${def}`);
        });

        const modelChoice = await readInput(`\n  ${chalk.cyan('?')} Select model (1-${entry.models.length}, Enter for default): `);
        const modelIdx = parseInt(modelChoice, 10) - 1;
        const selectedModel = !isNaN(modelIdx) && modelIdx >= 0 && modelIdx < entry.models.length
          ? entry.models[modelIdx]
          : entry.defaultModel;

        console.log(`  ${chalk.green('✓')} Model: ${chalk.cyan(selectedModel)}`);

        let apiKey = '';
        if (!entry.local) {
          const existingKey = process.env[`${providerName.toUpperCase()}_API_KEY`] || '';
          if (existingKey) {
            console.log(`  ${chalk.dim('Existing key:')} ${maskKey(existingKey)}`);
            const change = await readInput(`  ${chalk.cyan('?')} Change API key? (y/N): `);
            if (change.toLowerCase() === 'y' || change.toLowerCase() === 'yes') {
              apiKey = await readMasked(`  ${chalk.cyan('?')} Enter ${chalk.cyan(providerName)} API key: `);
            } else {
              apiKey = existingKey;
            }
          } else {
            apiKey = await readMasked(`  ${chalk.cyan('?')} Enter ${chalk.cyan(providerName)} API key: `);
          }

          if (apiKey && apiKey.length > 0) {
            saveApiKey(providerName, apiKey);
            console.log(`  ${chalk.green('✓')} API key saved securely to .env`);
          }
        }

        const config = loadConfig();
        config.model = selectedModel;
        config.provider = providerName;
        saveConfig(config);
        console.log(`  ${chalk.green('✓')} Config saved: provider=${chalk.cyan(providerName)}, model=${chalk.cyan(selectedModel)}`);

        return chalk.bold.green(`\n  ✓ Connected to ${providerName} with ${selectedModel}\n`) + chalk.dim('  Run /models to verify. Start chatting to use the new configuration.\n');
      },
    });

    this.register({
      name: 'files',
      description: 'Show files in the current context',
      usage: '/files',
      execute: () => {
        return [
          chalk.bold('Files in Context:'),
          chalk.dim('  (No files added yet. Use /context add <path>)'),
        ].join('\n');
      },
    });

    this.register({
      name: 'context',
      description: 'Manage context files',
      usage: '/context <add|remove|list> [path]',
      execute: (args) => {
        if (args.length === 0) {
          return `${chalk.yellow('Usage:')} /context <add|remove|list> [path]`;
        }
        const sub = args[0];
        switch (sub) {
          case 'list':
            return chalk.dim('  Files in context: (none)');
          case 'add':
            return `  ${chalk.green('+')} Added ${chalk.cyan(args[1] || '?')} to context`;
          case 'remove':
            return `  ${chalk.red('-')} Removed ${chalk.cyan(args[1] || '?')} from context`;
          default:
            return `${chalk.yellow('Unknown subcommand:')} ${sub}`;
        }
      },
    });

    this.register({
      name: 'reset',
      description: 'Reset the current conversation',
      usage: '/reset',
      execute: () => {
        return 'Conversation reset';
      },
    });

    this.register({
      name: 'exit',
      description: 'Exit LoveCode AI',
      usage: '/exit',
      execute: () => {
        return '__EXIT__';
      },
    });

    this.register({
      name: 'quit',
      description: 'Exit LoveCode AI',
      usage: '/quit',
      execute: () => {
        return '__EXIT__';
      },
    });
  }

  register(cmd: SlashCommand): void {
    this.commands.set(cmd.name, cmd);
  }

  isSlashCommand(input: string): boolean {
    return input.startsWith('/');
  }

  async execute(input: string): Promise<string | null> {
    if (!this.isSlashCommand(input)) return null;

    const parts = input.slice(1).split(/\s+/);
    const name = parts[0];
    const args = parts.slice(1);

    const cmd = this.commands.get(name);
    if (!cmd) {
      return `${chalk.red('Unknown command:')} ${name}. ${chalk.dim('Type /help for available commands.')}`;
    }

    return cmd.execute(args);
  }

  showHelp(): string {
    const lines = [chalk.bold('\n  LoveCode AI Slash Commands'), ''];
    for (const cmd of this.commands.values()) {
      lines.push(`  ${chalk.cyan(cmd.usage.padEnd(30))} ${chalk.dim(cmd.description)}`);
    }
    lines.push('');
    return lines.join('\n');
  }
}
