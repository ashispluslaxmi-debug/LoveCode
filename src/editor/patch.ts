import * as fs from 'node:fs';
import chalk from 'chalk';

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface PatchResult {
  success: boolean;
  applied: boolean;
  output: string;
  error?: string;
}

export function parseUnifiedDiff(diff: string): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  const lines = diff.split('\n');
  let current: PatchHunk | null = null;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      if (current) hunks.push(current);
      current = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) hunks.push(current);
  return hunks;
}

export function applyPatch(
  filePath: string,
  oldContent: string,
  newContent: string,
): PatchResult {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff = generateDiff(oldLines, newLines);

  try {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return {
      success: true,
      applied: true,
      output: diff,
    };
  } catch (err) {
    return {
      success: false,
      applied: false,
      output: '',
      error: String(err),
    };
  }
}

export function generateDiff(oldLines: string[], newLines: string[]): string {
  const result: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  let hasChanges = false;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      result.push(`  ${oldLine}`);
    } else {
      hasChanges = true;
      if (oldLine !== undefined) {
        result.push(chalk.red(`- ${oldLine}`));
      }
      if (newLine !== undefined) {
        result.push(chalk.green(`+ ${newLine}`));
      }
    }
  }

  if (!hasChanges) return '(no changes)';
  return result.join('\n');
}

export function applyInlinePatch(
  filePath: string,
  searchBlock: string,
  replaceBlock: string,
): PatchResult {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, applied: false, output: '', error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    const searchNormalized = searchBlock.trim();
    const contentNormalized = content;

    const idx = contentNormalized.indexOf(searchNormalized);
    if (idx === -1) {
      return {
        success: false,
        applied: false,
        output: '',
        error: 'Search block not found in file. The context may have changed.',
      };
    }

    const before = contentNormalized.slice(0, idx);
    const after = contentNormalized.slice(idx + searchNormalized.length);
    const newContent = before + replaceBlock + after;

    const oldLines = searchBlock.split('\n');
    const newLines = replaceBlock.split('\n');
    const diff = generateDiff(oldLines, newLines);

    fs.writeFileSync(filePath, newContent, 'utf-8');

    return { success: true, applied: true, output: `Patch applied:\n${diff}` };
  } catch (err) {
    return { success: false, applied: false, output: '', error: String(err) };
  }
}
