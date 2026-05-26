import { Command } from 'commander';
import chalk from 'chalk';
import { startTUI } from '../tui/index.js';
import type { AIProvider, AIProviderConfig, Message } from '../ai/provider.js';
import type { ToolResult } from '../core/tools.js';

const TOOL_SYSTEM_PROMPT = `You are LoveCode AI, a terminal-native coding assistant with full access to the project filesystem.

You can read, write, edit, and search files using tool tags:

<tool name="read_file">
path=<file path>
</tool>

<tool name="write_file">
path=<file path>
content=<file content>
</tool>

<tool name="edit_file">
path=<file path>
oldString=<text to replace>
newString=<replacement text>
</tool>

<tool name="create_file">
path=<file path>
</tool>

<tool name="delete_file">
path=<file path>
</tool>

<tool name="append_file">
path=<file path>
content=<text to append>
</tool>

<tool name="grep_search">
pattern=<regex pattern>
</tool>

<tool name="glob_search">
pattern=<glob pattern>
</tool>

<tool name="read_dir">
path=<directory path>
</tool>

<tool name="execute_command">
command=<shell command>
</tool>

When you need to access files, use the appropriate tool tag.
After getting results, continue helping the user.`;

async function loadAIProvider(): Promise<{ provider: AIProvider; config: AIProviderConfig } | null> {
  try {
    const { loadEnv } = await import('../config/env.js');
    const { loadConfig } = await import('../config/config.js');
    const { resolveModel } = await import('../ai/registry.js');

    loadEnv();
    const cfg = loadConfig();

    if (!cfg.provider) {
      console.log(chalk.yellow('No AI provider configured. Use `lovecode init` to set one up.'));
      return null;
    }

    const resolved = resolveModel(cfg.provider);
    if (!resolved) {
      console.log(chalk.yellow(`Provider "${cfg.provider}" not found. Use \`lovecode init\` to reconfigure.`));
      return null;
    }

    const provider = resolved.entry.provider;
    const model = resolved.model;
    const config: AIProviderConfig = {
      model,
      temperature: cfg.model_params?.temperature ?? 0.2,
      maxTokens: cfg.model_params?.max_tokens ?? 4096,
      baseUrl: cfg.api?.base_url,
    };

    return { provider, config };
  } catch (err) {
    console.log(chalk.red(`Failed to load AI provider: ${(err as Error).message}`));
    return null;
  }
}

async function processToolCalls(response: string, workingDir: string): Promise<string[]> {
  const outputs: string[] = [];
  const toolRegex = /<tool\s+name="([^"]+)">\n?([\s\S]*?)<\/tool>/g;
  let match: RegExpExecArray | null;

  while ((match = toolRegex.exec(response)) !== null) {
    const toolName = match[1];
    const argsBlock = match[2].trim();
    const args: Record<string, string> = {};

    for (const line of argsBlock.split('\n')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1).trim();
        args[key] = value;
      }
    }

    try {
      const tool = await getTool(toolName);
      if (!tool) {
        outputs.push(`Unknown tool: ${toolName}`);
        continue;
      }
      const result = await tool.execute(workingDir, args);
      const output = result.success
        ? `[${toolName}] result:\n${result.output.slice(0, 3000)}`
        : `[${toolName}] error: ${result.error || result.output}`;
      outputs.push(output);
    } catch (err) {
      outputs.push(`[${toolName}] exception: ${(err as Error).message}`);
    }
  }

  return outputs;
}

async function getTool(name: string): Promise<{ execute: (dir: string, args: Record<string, string>) => Promise<ToolResult> } | null> {
  if (name === 'read_file') {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    return {
      execute: async (workingDir, args) => {
        const filePath = resolve(workingDir, args.path || '.');
        if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${args.path}` };
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const numbered = lines.map((l: string, i: number) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n');
        return { success: true, output: numbered };
      },
    };
  }
  if (name === 'write_file') {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    return {
      execute: async (workingDir, args) => {
        const filePath = resolve(workingDir, args.path || '');
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, args.content || '', 'utf-8');
        return { success: true, output: `Wrote ${filePath}` };
      },
    };
  }
  if (name === 'edit_file') {
    const { readFileSync, writeFileSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    return {
      execute: async (workingDir, args) => {
        const filePath = resolve(workingDir, args.path || '');
        if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${args.path}` };
        const content = readFileSync(filePath, 'utf-8');
        if (!args.oldString) return { success: false, output: '', error: 'oldString required' };
        const escaped = args.oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const count = (content.match(new RegExp(escaped, 'g')) || []).length;
        if (count === 0) return { success: false, output: '', error: `oldString not found in ${args.path}` };
        const updated = content.replaceAll(args.oldString, args.newString || '');
        writeFileSync(filePath, updated, 'utf-8');
        return { success: true, output: `Edited ${filePath} (${count} replacement${count > 1 ? 's' : ''})` };
      },
    };
  }
  if (name === 'create_file') {
    const { writeFileSync, mkdirSync, existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    return {
      execute: async (workingDir, args) => {
        const filePath = resolve(workingDir, args.path || '');
        if (existsSync(filePath)) return { success: false, output: '', error: `File exists: ${args.path}` };
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, '', 'utf-8');
        return { success: true, output: `Created ${filePath}` };
      },
    };
  }
  if (name === 'delete_file') {
    const { unlinkSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    return {
      execute: async (workingDir, args) => {
        const filePath = resolve(workingDir, args.path || '');
        if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${args.path}` };
        unlinkSync(filePath);
        return { success: true, output: `Deleted ${filePath}` };
      },
    };
  }
  if (name === 'append_file') {
    const { appendFileSync, mkdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    return {
      execute: async (workingDir, args) => {
        const filePath = resolve(workingDir, args.path || '');
        mkdirSync(dirname(filePath), { recursive: true });
        appendFileSync(filePath, (args.content || '') + '\n', 'utf-8');
        return { success: true, output: `Appended to ${filePath}` };
      },
    };
  }
  if (name === 'grep_search') {
    const { execSync } = await import('node:child_process');
    return {
      execute: async (workingDir, args) => {
        try {
          const pattern = args.pattern || '';
          const cmd = `rg -n '${pattern.replace(/'/g, "'\\''")}' 2>/dev/null || echo "(no matches)"`;
          const output = execSync(cmd, { cwd: workingDir, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
          return { success: true, output: output.trim() };
        } catch {
          return { success: true, output: '(no matches)' };
        }
      },
    };
  }
  if (name === 'glob_search') {
    const { execSync } = await import('node:child_process');
    return {
      execute: async (workingDir, args) => {
        try {
          const pattern = args.pattern || '*';
          const cmd = `ls -1 ${pattern} 2>/dev/null || echo "(no files found)"`;
          const output = execSync(cmd, { cwd: workingDir, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
          return { success: true, output: output.trim() };
        } catch {
          return { success: true, output: '(no files found)' };
        }
      },
    };
  }
  if (name === 'read_dir') {
    const { readdirSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    return {
      execute: async (workingDir, args) => {
        const dirPath = resolve(workingDir, args.path || '.');
        if (!existsSync(dirPath)) return { success: false, output: '', error: `Directory not found: ${args.path}` };
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const output = (entries as unknown as Array<{ isDirectory(): boolean; name: string }>)
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n');
        return { success: true, output };
      },
    };
  }
  if (name === 'execute_command') {
    const { execSync } = await import('node:child_process');
    return {
      execute: async (workingDir, args) => {
        try {
          const command = args.command || '';
          const timeout = parseInt(args.timeout || '30000', 10);
          const output = execSync(command, {
            cwd: workingDir,
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024,
            timeout,
          });
          return { success: true, output: output.trim() };
        } catch (err) {
          const e = err as Error & { stderr?: string };
          return { success: false, output: e.stderr || e.message, error: e.message };
        }
      },
    };
  }
  return null;
}

async function cmdTUI(options: { theme?: string; dir?: string }) {
  const workingDir = options.dir || process.cwd();
  console.log(chalk.dim('Starting LoveCode TUI...'));

  if (options.theme) {
    const mod = await import('../tui/theme.js');
    const names = mod.getThemeNames();
    if (names.includes(options.theme as 'default')) {
      mod.setTheme(options.theme as 'default');
    }
  }

  const ai = await loadAIProvider();
  if (!ai) {
    startTUI({
      projectName: 'LoveCode AI',
      branch: 'main',
      fileCount: 142,
      language: 'TypeScript',
      framework: 'Node.js',
      repoStatus: 'clean',
      messages: [],
      onSendMessage: async () => 'No AI provider configured. Run `lovecode init` to set one up.',
      onRunCommand: async () => 'No AI provider configured.',
    });
    return;
  }

  const { provider, config } = ai;
  const messages: Message[] = [{ role: 'system', content: TOOL_SYSTEM_PROMPT }];

  startTUI({
    projectName: 'LoveCode AI',
    branch: 'main',
    fileCount: 142,
    language: 'TypeScript',
    framework: 'Node.js',
    repoStatus: 'clean',
    messages: [],
    provider: provider.name,
    model: config.model,
    onSendMessage: async (msg: string) => {
      messages.push({ role: 'user', content: msg });

      for (let round = 0; round < 5; round++) {
        const response = await provider.chat(messages, config);
        messages.push({ role: 'assistant', content: response });

        const toolOutputs = await processToolCalls(response, workingDir);
        if (toolOutputs.length === 0) {
          return response;
        }

        for (const output of toolOutputs) {
          messages.push({ role: 'user', content: output });
        }
      }

      return 'Max tool call rounds reached. Please try again with a simpler request.';
    },
    onRunCommand: async (command: string) => {
      const { execSync } = await import('node:child_process');
      try {
        const output = execSync(command, { cwd: workingDir, encoding: 'utf-8', timeout: 60000 });
        return output.trim();
      } catch (err) {
        const e = err as Error & { stderr?: string };
        return e.stderr || e.message;
      }
    },
  });
}

export const tuiCommand = new Command('tui')
  .alias('ui')
  .description('Launch the Terminal User Interface (TUI)')
  .option('-t, --theme <name>', 'Theme (default, dark, light, ocean, solarized)', 'default')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdTUI)
  .addHelpText('after', `
  Controls:
    Tab          Cycle focus between panes
    Escape       Enter vim normal mode
    i            Enter vim insert mode
    j/k          Scroll up/down (vim normal mode)

  Slash commands:
    /help        Show help
    /clear       Clear messages
    /theme <n>   Change theme
    /connect     Show providers
    /model       Show AI config
    /export      Save chat to file
    /!<cmd>      Run a shell command
    /exit        Quit TUI

  The AI can read, write, and edit files in the project directory.
  `);
