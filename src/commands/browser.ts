import { Command } from 'commander';
import chalk from 'chalk';

async function cmdStart(options: { headless?: boolean; dir?: string }) {
  const { launchBrowser } = await import('../browser/playwright.js');
  try {
    await launchBrowser({ headless: options.headless !== false });
    console.log(chalk.green('Browser launched.'));
  } catch (err) {
    console.log(chalk.red(`Failed: ${(err as Error).message}`));
  }
}

async function cmdStop() {
  const { closeBrowser } = await import('../browser/playwright.js');
  await closeBrowser();
  console.log(chalk.yellow('Browser closed.'));
}

async function cmdGoto(url: string) {
  const { goto } = await import('../browser/playwright.js');
  try {
    const result = await goto(url);
    console.log(chalk.green(result));
  } catch (err) {
    console.log(chalk.red(`Error: ${(err as Error).message}`));
  }
}

async function cmdClick(selector: string) {
  const { click } = await import('../browser/playwright.js');
  try {
    const result = await click(selector);
    console.log(chalk.green(result));
  } catch (err) {
    console.log(chalk.red(`Error: ${(err as Error).message}`));
  }
}

async function cmdType(selector: string, text: string | undefined, options: { text?: string }) {
  const { type } = await import('../browser/playwright.js');
  const value = text || options.text || '';
  try {
    const result = await type(selector, value);
    console.log(chalk.green(result));
  } catch (err) {
    console.log(chalk.red(`Error: ${(err as Error).message}`));
  }
}

async function cmdScreenshot(options: { name?: string; dir?: string }) {
  const { screenshot, formatScreenshotResult } = await import('../browser/playwright.js');
  try {
    const result = await screenshot(options.name);
    console.log(chalk.green(formatScreenshotResult(result)));
  } catch (err) {
    console.log(chalk.red(`Error: ${(err as Error).message}`));
  }
}

async function cmdInspect(selector: string) {
  const { inspect, formatDOMElement } = await import('../browser/playwright.js');
  try {
    const el = await inspect(selector);
    if (el) {
      console.log(formatDOMElement(el));
    } else {
      console.log(chalk.yellow(`Element not found: ${selector}`));
    }
  } catch (err) {
    console.log(chalk.red(`Error: ${(err as Error).message}`));
  }
}

async function cmdActions(actions: string[], options: { file?: string }) {
  const { runActions } = await import('../browser/playwright.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsedActions: any[];
  if (options.file) {
    const fs = await import('node:fs');
    const content = fs.readFileSync(options.file, 'utf-8');
    parsedActions = JSON.parse(content);
  } else {
    parsedActions = actions.map((a) => JSON.parse(a));
  }
  try {
    const results = await runActions(parsedActions);
    for (const r of results) {
      console.log(chalk.cyan(`  → ${r.slice(0, 200)}`));
    }
  } catch (err) {
    console.log(chalk.red(`Error: ${(err as Error).message}`));
  }
}

export const browserCommand = new Command('browser')
  .alias('br')
  .description('Browser automation — Playwright-powered')
  .addHelpText('after', `
  Examples:
    lovecode browser start              Launch headless browser
    lovecode browser start --no-headless Launch visible browser
    lovecode browser stop               Close browser
    lovecode browser goto https://example.com
    lovecode browser click "#submit"
    lovecode browser type "#email" "user@example.com"
    lovecode browser screenshot --name "homepage"
    lovecode browser inspect "#header"
    lovecode browser actions '{"type":"goto","url":"..."}' '{"type":"screenshot"}'
    lovecode browser actions --file actions.json
  `);

browserCommand
  .command('start')
  .description('Launch the browser')
  .option('--no-headless', 'Show browser window')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdStart);

browserCommand
  .command('stop')
  .description('Close the browser')
  .action(cmdStop);

browserCommand
  .command('goto')
  .description('Navigate to a URL')
  .argument('<url>', 'URL to navigate to')
  .action(cmdGoto);

browserCommand
  .command('click')
  .description('Click an element')
  .argument('<selector>', 'CSS selector')
  .action(cmdClick);

browserCommand
  .command('type')
  .description('Type text into an input')
  .argument('<selector>', 'CSS selector')
  .argument('[text]', 'Text to type')
  .option('-t, --text <text>', 'Text to type')
  .action(cmdType);

browserCommand
  .command('screenshot')
  .alias('ss')
  .description('Take a screenshot')
  .option('-n, --name <name>', 'Screenshot filename prefix')
  .option('--dir <path>', 'Project directory', process.cwd())
  .action(cmdScreenshot);

browserCommand
  .command('inspect')
  .description('Inspect a DOM element')
  .argument('<selector>', 'CSS selector')
  .action(cmdInspect);

browserCommand
  .command('actions')
  .description('Run a sequence of browser actions (JSON)')
  .argument('[actions...]', 'JSON action objects')
  .option('-f, --file <path>', 'JSON file with actions array')
  .action(cmdActions);
