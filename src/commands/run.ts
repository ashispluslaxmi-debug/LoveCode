import { Command } from 'commander';
import chalk from 'chalk';
import { OllamaProvider } from '../ai/ollama.js';
import { AutonomousAgent } from '../core/agent.js';
import { listModes } from '../core/modes.js';
import type { AutonomyMode } from '../core/types.js';

export const runCommand = new Command('run')
  .alias('r')
  .description('Run LoveCode AI on a specific task in autonomous mode')
  .argument('[task]', 'The task description for the AI to execute')
  .option('-m, --model <name>', 'AI model to use', 'codellama')
  .option('-p, --provider <name>', 'AI provider', 'ollama')
  .option('--base-url <url>', 'Base URL for the AI provider', 'http://localhost:11434')
  .option('--mode <mode>', 'Autonomy mode: assist, smart, yolo', 'smart')
  .option('--dir <path>', 'Working directory', process.cwd())
  .option('--list-modes', 'List available autonomy modes and exit')
  .action(async (task: string | undefined, options) => {
    if (options.listModes) {
      console.log(chalk.bold('\n  Available Autonomy Modes\n'));
      console.log(listModes());
      console.log('');
      return;
    }

    if (!task) {
      console.log(chalk.red('\n  Error: task argument is required.\n'));
      console.log(chalk.dim('  Usage: lovecode run "<task description>"\n'));
      return;
    }

    const mode = options.mode as AutonomyMode;
    const validModes: AutonomyMode[] = ['assist', 'smart', 'yolo'];
    if (!validModes.includes(mode)) {
      console.log(chalk.red(`\n  Invalid mode: "${options.mode}". Use --list-modes to see available modes.\n`));
      return;
    }

    const provider = new OllamaProvider();

    const agent = new AutonomousAgent({
      mode,
      model: options.model,
      provider,
      providerConfig: {
        model: options.model,
        baseUrl: options.baseUrl,
        temperature: 0.2,
        maxTokens: 8192,
      },
      workingDir: options.dir,
      task,
    });

    try {
      await agent.execute();
    } catch (err) {
      console.log(chalk.red(`\n  ✗ Agent error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });
