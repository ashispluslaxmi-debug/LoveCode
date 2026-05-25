import { marked, Renderer } from 'marked';
import chalk from 'chalk';
import { highlight, isLanguageSupported } from './syntax.js';

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, m: string) => chalk.bold(m))
    .replace(/\*(.+?)\*/g, (_, m: string) => chalk.italic(m))
    .replace(/`(.+?)`/g, (_, m: string) => chalk.bgGray(chalk.white(m)))
    .replace(/~~(.+?)~~/g, (_, m: string) => chalk.strikethrough(m));
}

function renderCodeBlock(code: string, lang?: string): string {
  const langId = lang?.toLowerCase() ?? '';
  const langTag = langId ? chalk.dim(` ${langId} `) : '';

  let highlighted: string;
  if (langId && isLanguageSupported(langId)) {
    highlighted = highlight(code, langId);
  } else {
    highlighted = code;
  }

  const lines = highlighted.split('\n');
  const numbered = lines
    .map((line, i) => {
      const num = chalk.dim(String(i + 1).padStart(3, ' '));
      return `${num} │ ${line}`;
    })
    .join('\n');

  return [
    chalk.dim('  ┌─') + langTag + chalk.dim('─'.repeat(Math.max(40, 60 - (langTag.length + 10)))),
    numbered,
    chalk.dim('  └─') + chalk.dim('─'.repeat(58)),
  ].join('\n');
}

function renderTable(header: string[], rows: string[][]): string {
  const colWidths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length)),
  );

  const formatRow = (cells: string[], isHeader: boolean): string => {
    const formatted = cells
      .map((c, i) => {
        const cell = c.padEnd(colWidths[i], ' ');
        return isHeader ? chalk.bold(cell) : cell;
      })
      .join(chalk.dim(' │ '));
    return `  ${formatted}`;
  };

  const sep = colWidths.map((w) => '─'.repeat(w)).join(chalk.dim('─┼─'));

  return [
    formatRow(header, true),
    chalk.dim(`  ${sep}`),
    ...rows.map((r) => formatRow(r, false)),
  ].join('\n');
}

const renderer = new Renderer();

renderer.heading = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { depth: number; text: string };
  const prefix = '#'.repeat(token.depth);
  const color = token.depth === 1 ? chalk.bold.cyan : token.depth === 2 ? chalk.bold.blue : chalk.bold;
  return `\n${color(`${prefix} ${renderInline(token.text)}`)}\n`;
};

renderer.paragraph = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string };
  return `  ${renderInline(token.text)}\n`;
};

renderer.code = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string; lang: string | undefined };
  return `\n${renderCodeBlock(token.text, token.lang)}\n`;
};

renderer.list = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { ordered: boolean; items: Array<{ text: string; checked?: boolean }> };
  let result = '';
  for (let i = 0; i < token.items.length; i++) {
    const item = token.items[i];
    const prefix = token.ordered ? `${i + 1}.` : '•';
    const text = renderInline(item.text);
    const task = item.checked !== undefined ? `[${item.checked ? 'x' : ' '}] ` : '';
    result += `  ${chalk.dim(prefix)} ${task}${text}\n`;
  }
  return result;
};

renderer.table = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { header: Array<{ text: string }>; rows: Array<Array<{ text: string }>> };
  const header = token.header.map((c: { text: string }) => c.text);
  const rows = token.rows.map((r: Array<{ text: string }>) => r.map((c: { text: string }) => c.text));
  return `\n${renderTable(header, rows)}\n\n`;
};

renderer.blockquote = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string };
  return token.text.split('\n').map((l: string) => chalk.dim(`  │ ${l}`)).join('\n') + '\n';
};

renderer.hr = function (): string {
  return `\n  ${chalk.dim('─'.repeat(60))}\n`;
};

renderer.space = function (): string {
  return '';
};

renderer.codespan = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string };
  return chalk.bgGray(chalk.white(token.text));
};

renderer.strong = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string };
  return chalk.bold(token.text);
};

renderer.em = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string };
  return chalk.italic(token.text);
};

renderer.del = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string };
  return chalk.strikethrough(token.text);
};

renderer.link = function (this: unknown, ...args: unknown[]): string {
  const token = args[0] as { text: string; href: string };
  return `${chalk.underline(token.text)} (${chalk.dim(token.href)})`;
};

export function renderMarkdown(input: string): string {
  return marked.parse(input, { renderer, gfm: true, breaks: true, async: false }) as string;
}
