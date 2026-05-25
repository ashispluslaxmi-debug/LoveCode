import * as readline from 'node:readline';

export interface InputResult {
  text: string;
  cancelled: boolean;
}

export function createMultilineInput(prompt: string = ''): Promise<InputResult> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
    });

    if (prompt) {
      process.stdout.write(prompt);
    }

    let currentLine = '';

    process.stdin.on('keypress', (str, key) => {
      if (key && key.name === 'return') {
        if (key.shift) {
          lines.push(currentLine);
          currentLine = '';
          process.stdout.write('\n');
          rl.write('');
          return;
        }
        lines.push(currentLine);
        rl.close();
      }
      if (key && key.name === 'escape') {
        rl.close();
        resolve({ text: '', cancelled: true });
      }
    });

    rl.on('line', (line) => {
      currentLine = line;
    });

    rl.on('close', () => {
      const text = lines.join('\n');
      resolve({ text, cancelled: false });
    });
  });
}

export function createSimpleInput(prompt: string = ''): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
