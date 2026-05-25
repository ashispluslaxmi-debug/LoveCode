import chalk from 'chalk';

const keywordHighlights: Record<string, { keywords: string[]; types?: string[]; builtins?: string[] }> = {
  javascript: {
    keywords: [
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
      'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
      'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of',
      'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
      'var', 'void', 'while', 'with', 'yield',
    ],
    builtins: [
      'console', 'Math', 'JSON', 'Promise', 'Array', 'Object', 'String', 'Number',
      'Map', 'Set', 'Symbol', 'Reflect', 'Proxy', 'Error', 'Date', 'RegExp',
    ],
  },
  typescript: {
    keywords: [
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
      'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
      'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'interface',
      'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch',
      'this', 'throw', 'try', 'type', 'typeof', 'var', 'void', 'while', 'with', 'yield',
    ],
    types: [
      'string', 'number', 'boolean', 'any', 'never', 'void', 'unknown',
      'null', 'undefined', 'Array', 'Record', 'Partial', 'Required',
      'Pick', 'Omit', 'Exclude', 'Extract', 'Promise',
    ],
    builtins: [
      'console', 'Math', 'JSON', 'Promise', 'Array', 'Object', 'String', 'Number',
      'Map', 'Set', 'Symbol', 'Reflect', 'Proxy', 'Error', 'Date', 'RegExp',
    ],
  },
  go: {
    keywords: [
      'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
      'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
      'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var',
    ],
    types: [
      'bool', 'byte', 'complex64', 'complex128', 'error', 'float32', 'float64',
      'int', 'int8', 'int16', 'int32', 'int64', 'rune', 'string',
      'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',
    ],
    builtins: [
      'append', 'cap', 'close', 'copy', 'delete', 'len', 'make', 'new',
      'panic', 'print', 'println', 'recover', 'fmt', 'http', 'json', 'io', 'os',
    ],
  },
  python: {
    keywords: [
      'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
      'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
      'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
      'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
    ],
    builtins: [
      'print', 'len', 'range', 'type', 'int', 'str', 'float', 'list', 'dict',
      'set', 'tuple', 'bool', 'open', 'input', 'map', 'filter', 'zip', 'enumerate',
      'sorted', 'reversed', 'abs', 'max', 'min', 'sum', 'any', 'all',
      'self', 'cls', 'super',
    ],
  },
  rust: {
    keywords: [
      'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
      'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in',
      'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
      'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type',
      'unsafe', 'use', 'where', 'while',
    ],
    types: [
      'bool', 'char', 'f32', 'f64', 'i8', 'i16', 'i32', 'i64', 'i128',
      'isize', 'str', 'String', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
      'Vec', 'Option', 'Result', 'Box', 'HashMap', 'HashSet', 'Iterator',
    ],
    builtins: [
      'println', 'print', 'format', 'assert', 'assert_eq', 'assert_ne',
      'panic', 'todo', 'unreachable', 'unimplemented', 'dbg', 'eprint', 'eprintln',
    ],
  },
  bash: {
    keywords: [
      'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done',
      'case', 'esac', 'in', 'function', 'return', 'exit', 'export', 'local',
      'source', 'set', 'unset', 'declare', 'typeset',
    ],
    builtins: [
      'echo', 'printf', 'read', 'cd', 'ls', 'cat', 'grep', 'sed', 'awk',
      'find', 'xargs', 'sort', 'uniq', 'wc', 'head', 'tail', 'cut', 'tr',
      'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'chmod', 'chown', 'touch',
      'git', 'npm', 'node', 'yarn', 'npx', 'docker', 'curl', 'wget',
    ],
  },
};

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  go: 'go',
};

function highlightLine(line: string, lang: string): string {
  const config = keywordHighlights[lang];
  if (!config) return line;

  const allKeywords = [
    ...(config.keywords || []),
    ...(config.types || []),
    ...(config.builtins || []),
  ];

  const sorted = [...allKeywords].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const keywordPattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');

  const types = config.types || [];
  const builtins = config.builtins || [];
  const typesSet = new Set(types);
  const builtinsSet = new Set(builtins);
  const keywordsSet = new Set(config.keywords || []);

  return line.replace(keywordPattern, (match) => {
    if (typesSet.has(match)) return chalk.blue(match);
    if (builtinsSet.has(match)) return chalk.cyan(match);
    if (keywordsSet.has(match)) return chalk.magenta(match);
    return chalk.magenta(match);
  });
}

function highlightCommentsAndStrings(code: string, lang: string): string {
  if (lang === 'bash') {
    return code
      .replace(/(#[^\n]*)/g, (_, m) => chalk.gray(m))
      .replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, (_, __, m) => chalk.green(m));
  }

  const commentPatterns: Array<{ start: string }> = [
    { start: '//' },
    { start: '#' },
    { start: '/*' },
  ];

  let result = code;
  for (const { start } of commentPatterns) {
    if (start === '/*') {
      result = result.replace(/\/\*[\s\S]*?\*\//g, (m) => chalk.gray(m));
    } else if (start === '//') {
      result = result.replace(/\/\/[^\n]*/g, (m) => chalk.gray(m));
    } else if (start === '#') {
      result = result.replace(/#[^\n]*/g, (m) => chalk.gray(m));
    }
  }

  result = result.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, (_, m) => chalk.green(m));

  result = result.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, (_, m) => chalk.yellow(m));

  return result;
}

export function highlight(code: string, lang: string): string {
  const resolvedLang = languageAliases[lang] || lang;
  if (!keywordHighlights[resolvedLang]) return code;

  const lines = code.split('\n');
  const highlighted = lines.map((line) => {
    const withStrings = highlightCommentsAndStrings(line, resolvedLang);
    const withKeywords = highlightLine(withStrings, resolvedLang);
    return withKeywords;
  });

  return highlighted.join('\n');
}

export function isLanguageSupported(lang: string): boolean {
  const resolved = languageAliases[lang] || lang;
  return !!keywordHighlights[resolved];
}
