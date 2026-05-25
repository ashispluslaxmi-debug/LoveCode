import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../chat/markdown.js';

describe('markdown rendering', () => {
  it('renders headings', () => {
    const result = renderMarkdown('# Hello\n## World');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('renders bold and italic', () => {
    const result = renderMarkdown('**bold** and *italic*');
    expect(result).toContain('bold');
    expect(result).toContain('italic');
  });

  it('renders code blocks', () => {
    const result = renderMarkdown('```ts\nconst x = 1;\n```');
    expect(result).toContain('const x = 1');
  });

  it('renders tables', () => {
    const result = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(result).toContain('A');
    expect(result).toContain('1');
  });

  it('renders lists', () => {
    const result = renderMarkdown('- a\n- b');
    expect(result).toContain('a');
    expect(result).toContain('b');
  });
});
