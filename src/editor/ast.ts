const PAIR_MATCH: Record<string, string> = {
  '{': '}',
  '[': ']',
  '(': ')',
};

const OPENERS = new Set(Object.keys(PAIR_MATCH));
const CLOSERS = new Set(Object.values(PAIR_MATCH));

export interface SyntaxCheckResult {
  valid: boolean;
  errors: SyntaxError[];
}

export interface SyntaxError {
  line: number;
  column: number;
  message: string;
}

export function checkBraceBalance(code: string, _filePath?: string): SyntaxCheckResult {
  const errors: SyntaxError[] = [];
  const stack: Array<{ char: string; line: number; column: number }> = [];
  const lines = code.split('\n');

  let inBlockComment = false;
  let inString = false;
  let stringChar = '';

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      const nextChar = line[col + 1] || '';

      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          col++;
        }
        continue;
      }

      if (inString) {
        if (char === '\\') {
          col++;
          continue;
        }
        if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if ((char === '/' && nextChar === '*') || (char === '/' && nextChar === '/')) {
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          col++;
        }
        break;
      }

      if (char === '#' && (col === 0 || line[col - 1] === ' ' || line[col - 1] === '\t')) {
        break;
      }

      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
        continue;
      }

      if (OPENERS.has(char)) {
        stack.push({ char, line: lineNum + 1, column: col + 1 });
      } else if (CLOSERS.has(char)) {
        const expected = Object.entries(PAIR_MATCH).find(([, v]) => v === char)?.[0];
        if (stack.length === 0) {
          errors.push({
            line: lineNum + 1,
            column: col + 1,
            message: `Unexpected closing '${char}' without opening '${expected}'`,
          });
        } else {
          const last = stack[stack.length - 1];
          if (PAIR_MATCH[last.char] !== char) {
            errors.push({
              line: lineNum + 1,
              column: col + 1,
              message: `Expected '${PAIR_MATCH[last.char]}' but found '${char}'`,
            });
          } else {
            stack.pop();
          }
        }
      }
    }
  }

  for (const remaining of stack) {
    errors.push({
      line: remaining.line,
      column: remaining.column,
      message: `Unclosed '${remaining.char}' — expected '${PAIR_MATCH[remaining.char]}'`,
    });
  }

  return { valid: errors.length === 0, errors };
}

export function hasValidSyntax(code: string, lang?: string): boolean {
  const balance = checkBraceBalance(code);

  const ext = lang?.toLowerCase() || '';
  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'go', 'c', 'cpp', 'java', 'kt'].some((e) => ext.includes(e) || ext === e)) {
    if (!balance.valid) {
      return false;
    }
  }

  return true;
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    java: 'java',
    kt: 'kotlin',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
  };
  return langMap[ext] || 'unknown';
}
