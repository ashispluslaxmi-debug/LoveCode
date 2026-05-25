import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileOpResult {
  success: boolean;
  message: string;
  error?: string;
}

export function renameFile(oldPath: string, newPath: string): FileOpResult {
  try {
    const dir = path.dirname(newPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.renameSync(oldPath, newPath);
    return { success: true, message: `Renamed to ${newPath}` };
  } catch (err) {
    return { success: false, message: '', error: String(err) };
  }
}

export function duplicateFile(sourcePath: string, destPath: string): FileOpResult {
  try {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, destPath);
    return { success: true, message: `Duplicated to ${destPath}` };
  } catch (err) {
    return { success: false, message: '', error: String(err) };
  }
}

export function getFileInfo(filePath: string): FileOpResult & {
  size?: number;
  modifiedAt?: Date;
  createdAt?: Date;
  isSymlink?: boolean;
} {
  try {
    const stats = fs.statSync(filePath);
    return {
      success: true,
      message: `${filePath}`,
      size: stats.size,
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime,
      isSymlink: stats.isSymbolicLink(),
    };
  } catch (err) {
    return { success: false, message: '', error: String(err) };
  }
}

export function ensureDir(dirPath: string): FileOpResult {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true, message: `Directory ready: ${dirPath}` };
  } catch (err) {
    return { success: false, message: '', error: String(err) };
  }
}

export function createDir(dirPath: string): FileOpResult {
  try {
    if (fs.existsSync(dirPath)) {
      return { success: false, message: '', error: `Directory already exists: ${dirPath}` };
    }
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true, message: `Created directory: ${dirPath}` };
  } catch (err) {
    return { success: false, message: '', error: String(err) };
  }
}

export function moveToTrash(filePath: string, trashDir: string): FileOpResult {
  try {
    const trashPath = path.join(trashDir, `${path.basename(filePath)}.${Date.now()}`);
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    fs.renameSync(filePath, trashPath);
    return { success: true, message: `Moved to trash: ${trashPath}` };
  } catch (err) {
    return { success: false, message: '', error: String(err) };
  }
}

export function getDirectoryTree(
  dirPath: string,
  prefix: string = '',
  maxDepth: number = 3,
  currentDepth: number = 0,
): string {
  if (currentDepth > maxDepth) return `${prefix}  ...\n`;

  let result = '';
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return `${prefix}  (error reading)\n`;
  }

  const filtered = entries.filter((e) => !e.name.startsWith('.') || e.name === '.gitignore');
  const sorted = filtered.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const isLast = i === sorted.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const nextPrefix = isLast ? '    ' : '│   ';

    if (entry.isDirectory()) {
      result += `${prefix}${connector}${entry.name}/\n`;
      result += getDirectoryTree(
        path.join(dirPath, entry.name),
        prefix + nextPrefix,
        maxDepth,
        currentDepth + 1,
      );
    } else {
      const stats = fs.statSync(path.join(dirPath, entry.name));
      const size = formatSize(stats.size);
      result += `${prefix}${connector}${entry.name} ${size}\n`;
    }
  }

  return result;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  return `(${size.toFixed(1)} ${units[unitIdx]})`;
}
