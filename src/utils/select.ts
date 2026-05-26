import * as readline from 'node:readline';
import chalk from 'chalk';
import { isTermux } from '../platform/detect.js';

export interface SelectChoice {
  name: string;
  value: string;
  description?: string;
}

function createRL(): readline.Interface | null {
  try {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
  } catch {
    return null;
  }
}

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      rl.question(query, (answer) => {
        try { rl.close(); } catch { /* ignore */ }
        resolve(answer);
      });
    } catch {
      try { rl.close(); } catch { /* ignore */ }
      resolve('');
    }
  });
}

export async function numberedSelect(
  choices: SelectChoice[],
  options?: { message?: string; pageSize?: number; termux?: boolean },
): Promise<string> {
  const termux = options?.termux ?? isTermux();
  const pageSize = options?.pageSize || 15;
  const message = options?.message || 'Select an option:';

  console.log(`\n  ${chalk.bold(message)}\n`);

  const display = choices.slice(0, pageSize);
  for (let i = 0; i < display.length; i++) {
    const num = chalk.cyan(`${i + 1}`.padStart(3));
    const desc = display[i].description ? chalk.dim(` — ${display[i].description}`) : '';
    console.log(`  ${num}. ${display[i].name}${desc}`);
  }

  if (choices.length > pageSize) {
    console.log(`  ${chalk.dim(`... and ${choices.length - pageSize} more. Use \`lovecode env set\` directly.`)}`);
  }

  const rl = createRL();
  if (!rl) {
    console.log(chalk.yellow('\nCannot open input. Use `lovecode env set <KEY> <VALUE>` instead.'));
    return '';
  }

  const prompt = termux ? `\n  ${chalk.cyan('?')} Enter number (1-${display.length}): ` : `\n  ${chalk.cyan('?')} Enter number (1-${display.length}), or press Enter for 1: `;

  const answer = await askQuestion(rl, prompt);
  const trimmed = answer.trim();
  if (!trimmed && !termux) {
    return display[0].value;
  }
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1 || num > display.length) {
    console.log(chalk.red(`  Invalid selection. Please enter a number between 1 and ${display.length}.`));
    return numberedSelect(choices, options);
  }
  return display[num - 1].value;
}

export async function promptInput(
  q: string,
  defaultValue?: string,
): Promise<string> {
  const rl = createRL();
  if (!rl) {
    console.log(chalk.yellow('\nCannot open input. Using default value.'));
    return defaultValue || '';
  }

  const prompt = defaultValue
    ? `  ${chalk.cyan('?')} ${q} ${chalk.dim(`(${defaultValue})`)}: `
    : `  ${chalk.cyan('?')} ${q}: `;

  const answer = await askQuestion(rl, prompt);
  return answer.trim() || defaultValue || '';
}
