import { Command } from 'commander';
import chalk from 'chalk';
import { startTUI } from '../tui/index.js';

async function cmdTUI(options: { theme?: string; dir?: string }) {
  console.log(chalk.dim('Starting LoveCode TUI...'));

  if (options.theme) {
    const mod = await import('../tui/theme.js');
    const names = mod.getThemeNames();
    const themeName = options.theme as string;
    const n = themeName as keyof typeof mod.themes;
    if (names.includes(themeName as 'default' | 'dark' | 'light' | 'ocean' | 'solarized')) {
      mod.setTheme(n);
    } else {
      console.log(chalk.yellow(`Unknown theme "${options.theme}". Using default. Available: ${names.join(', ')}`));
    }
  }

  startTUI({
    projectName: 'LoveCode AI',
    branch: 'main',
    fileCount: 142,
    language: 'TypeScript',
    framework: 'Node.js',
    repoStatus: 'clean',
    messages: [],
    onSendMessage: async (msg: string) => {
      return `You said: ${msg}\n\nThis is a simulated AI response. Connect to a real AI provider for actual responses.`;
    },
    onRunCommand: async (cmd: string) => {
      return `Simulated output for: ${cmd}`;
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
    Ctrl+N/P     Next/previous pane

  Slash commands:
    /help        Show help
    /clear       Clear messages
    /theme <n>   Change theme (default, dark, light, ocean, solarized)
    /vim         Toggle vim mode
    /!<cmd>      Run a shell command
    /exit        Quit TUI
  `);
