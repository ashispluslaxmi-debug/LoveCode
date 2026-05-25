import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Snapshot {
  id: string;
  filePath: string;
  relativePath: string;
  timestamp: number;
  label: string;
  size: number;
}

const SNAPSHOT_DIR = '.lovecode/snapshots';

function getSnapshotDir(rootDir: string): string {
  return path.join(rootDir, SNAPSHOT_DIR);
}

function ensureSnapshotDir(rootDir: string): string {
  const dir = getSnapshotDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function createSnapshot(
  rootDir: string,
  filePath: string,
  label: string = '',
): Snapshot | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const snapshotDir = ensureSnapshotDir(rootDir);

    const snapshot: Snapshot = {
      id,
      filePath,
      relativePath,
      timestamp: Date.now(),
      label,
      size: content.length,
    };

    fs.writeFileSync(path.join(snapshotDir, `${id}.snap`), content, 'utf-8');
    fs.writeFileSync(path.join(snapshotDir, `${id}.meta`), JSON.stringify(snapshot, null, 2), 'utf-8');

    return snapshot;
  } catch {
    return null;
  }
}

export function restoreSnapshot(rootDir: string, id: string): boolean {
  try {
    const snapshotDir = getSnapshotDir(rootDir);
    const metaPath = path.join(snapshotDir, `${id}.meta`);
    const snapPath = path.join(snapshotDir, `${id}.snap`);

    if (!fs.existsSync(metaPath) || !fs.existsSync(snapPath)) return false;

    const meta: Snapshot = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const content = fs.readFileSync(snapPath, 'utf-8');

    if (fs.existsSync(meta.filePath)) {
      fs.writeFileSync(meta.filePath, content, 'utf-8');
    }

    return true;
  } catch {
    return false;
  }
}

export function listSnapshots(rootDir: string): Snapshot[] {
  try {
    const snapshotDir = getSnapshotDir(rootDir);
    if (!fs.existsSync(snapshotDir)) return [];

    const files = fs.readdirSync(snapshotDir);
    const metaFiles = files.filter((f) => f.endsWith('.meta'));
    const snapshots: Snapshot[] = [];

    for (const metaFile of metaFiles) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(snapshotDir, metaFile), 'utf-8'));
        snapshots.push(meta);
      } catch {
        // skip corrupt entries
      }
    }

    snapshots.sort((a, b) => b.timestamp - a.timestamp);
    return snapshots;
  } catch {
    return [];
  }
}

export function deleteSnapshot(rootDir: string, id: string): boolean {
  try {
    const snapshotDir = getSnapshotDir(rootDir);
    const metaPath = path.join(snapshotDir, `${id}.meta`);
    const snapPath = path.join(snapshotDir, `${id}.snap`);

    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);

    return true;
  } catch {
    return false;
  }
}

export function pruneSnapshots(rootDir: string, keep: number = 20): number {
  const snapshots = listSnapshots(rootDir);
  if (snapshots.length <= keep) return 0;

  const toRemove = snapshots.slice(keep);
  for (const snap of toRemove) {
    deleteSnapshot(rootDir, snap.id);
  }

  return toRemove.length;
}

export function snapshotDiff(rootDir: string, id1: string, id2: string): string | null {
  try {
    const snapshotDir = getSnapshotDir(rootDir);
    const snap1 = fs.readFileSync(path.join(snapshotDir, `${id1}.snap`), 'utf-8');
    const snap2 = fs.readFileSync(path.join(snapshotDir, `${id2}.snap`), 'utf-8');

    const lines1 = snap1.split('\n');
    const lines2 = snap2.split('\n');

    const maxLen = Math.max(lines1.length, lines2.length);
    const diff: string[] = [];

    for (let i = 0; i < maxLen; i++) {
      if (lines1[i] !== lines2[i]) {
        if (i < lines1.length) diff.push(`- ${lines1[i]}`);
        if (i < lines2.length) diff.push(`+ ${lines2[i]}`);
      }
    }

    return diff.join('\n');
  } catch {
    return null;
  }
}

export function createBatchSnapshot(
  rootDir: string,
  filePaths: string[],
  label: string = 'batch',
): Snapshot[] {
  const snapshots: Snapshot[] = [];
  for (const fp of filePaths) {
    const snap = createSnapshot(rootDir, fp, label);
    if (snap) snapshots.push(snap);
  }
  return snapshots;
}
