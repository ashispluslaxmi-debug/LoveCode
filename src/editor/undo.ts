import * as fs from 'node:fs';
import * as path from 'node:path';

export interface UndoEntry {
  id: string;
  filePath: string;
  timestamp: number;
  originalContent: string;
  label: string;
}

const UNDO_DIR = '.lovecode/undo';

function getUndoDir(rootDir: string): string {
  return path.join(rootDir, UNDO_DIR);
}

function ensureUndoDir(rootDir: string): string {
  const dir = getUndoDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getUndoFilePath(rootDir: string, id: string): string {
  return path.join(getUndoDir(rootDir), `${id}.json`);
}

function getIndexPath(rootDir: string): string {
  return path.join(getUndoDir(rootDir), 'index.json');
}

export function saveUndoPoint(
  rootDir: string,
  filePath: string,
  label: string = 'edit',
): UndoEntry | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const content = fs.readFileSync(filePath, 'utf-8');

    const entry: UndoEntry = {
      id,
      filePath,
      timestamp: Date.now(),
      originalContent: content,
      label,
    };

    ensureUndoDir(rootDir);
    const entryFile = getUndoFilePath(rootDir, id);
    fs.writeFileSync(entryFile, JSON.stringify(entry, null, 2), 'utf-8');

    const indexPath = getIndexPath(rootDir);
    let index: UndoEntry[] = [];
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch {
        index = [];
      }
    }
    index.unshift(entry);
    if (index.length > 100) index = index.slice(0, 100);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    return entry;
  } catch {
    return null;
  }
}

export function undoLast(rootDir: string, filePath?: string): UndoEntry | null {
  try {
    const indexPath = getIndexPath(rootDir);
    if (!fs.existsSync(indexPath)) return null;

    const index: UndoEntry[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const targetIdx = filePath
      ? index.findIndex((e) => e.filePath === filePath)
      : 0;

    if (targetIdx === -1) return null;
    const entry = index[targetIdx];

    if (!fs.existsSync(entry.filePath)) {
      index.splice(targetIdx, 1);
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
      return null;
    }

    fs.writeFileSync(entry.filePath, entry.originalContent, 'utf-8');

    index.splice(targetIdx, 1);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    const entryFile = getUndoFilePath(rootDir, entry.id);
    if (fs.existsSync(entryFile)) fs.unlinkSync(entryFile);

    return entry;
  } catch {
    return null;
  }
}

export function getUndoHistory(rootDir: string): UndoEntry[] {
  try {
    const indexPath = getIndexPath(rootDir);
    if (!fs.existsSync(indexPath)) return [];
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return [];
  }
}

export function clearUndoHistory(rootDir: string): void {
  try {
    const indexPath = getIndexPath(rootDir);
    if (fs.existsSync(indexPath)) {
      const index: UndoEntry[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      for (const entry of index) {
        const entryFile = getUndoFilePath(rootDir, entry.id);
        if (fs.existsSync(entryFile)) fs.unlinkSync(entryFile);
      }
      fs.unlinkSync(indexPath);
    }
  } catch {
    // ignore
  }
}

export function undoForFile(rootDir: string, filePath: string): UndoEntry | null {
  return undoLast(rootDir, filePath);
}
