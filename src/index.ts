import { Command } from 'commander';
import chalk from 'chalk';
import { chatCommand } from './commands/chat.js';
import { runCommand } from './commands/run.js';
import { initCommand, setupCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { envCommand } from './commands/env.js';
import { platformCommand } from './commands/platform.js';
import { telemetryCommand } from './commands/telemetry.js';
import { installCommand } from './commands/install.js';
import { modelsCommand } from './commands/models.js';
import { analyzeCommand } from './commands/analyze.js';
import { memoryCommand } from './commands/memory.js';
import { gitCommand } from './commands/git.js';
import { tuiCommand } from './commands/tui.js';
import { pluginCommand } from './commands/plugin.js';
import { browserCommand } from './commands/browser.js';
import { securityCommand } from './commands/security.js';

const pkg = {
  version: '0.1.0',
  name: 'lovecode-ai',
  description: 'Terminal-native autonomous coding agent powered by free AI models',
};

export const program = new Command();

program
  .name(pkg.name)
  .description(chalk.cyan(pkg.description))
  .version(pkg.version, '-v, --version', 'Output the current version');

program.addCommand(chatCommand);
program.addCommand(runCommand);
program.addCommand(initCommand);
program.addCommand(setupCommand);
program.addCommand(modelsCommand);
program.addCommand(analyzeCommand);
program.addCommand(configCommand);
program.addCommand(envCommand);
program.addCommand(platformCommand);
program.addCommand(telemetryCommand);
program.addCommand(installCommand);
program.addCommand(memoryCommand);
program.addCommand(gitCommand);
program.addCommand(tuiCommand);
program.addCommand(pluginCommand);
program.addCommand(browserCommand);
program.addCommand(securityCommand);
