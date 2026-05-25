import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SessionEntry } from './session.js';

function getChatLogDir(rootDir?: string): string {
  const base = rootDir || process.cwd();
  return path.join(base, '.lovecode', 'chats');
}

function ensureDir(rootDir?: string): void {
  const dir = getChatLogDir(rootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeChatLog(
  sessionId: string,
  title: string,
  entries: SessionEntry[],
  rootDir?: string,
): string {
  ensureDir(rootDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40) || 'chat';
  const fileName = `${timestamp}_${safeTitle}_${sessionId.slice(0, 8)}.txt`;
  const filePath = path.join(getChatLogDir(rootDir), fileName);

  const lines: string[] = [
    `╔══════════════════════════════════════════════════╗`,
    `║           LoveCode AI - Chat Log                ║`,
    `╚══════════════════════════════════════════════════╝`,
    `Session: ${sessionId}`,
    `Title:   ${title}`,
    `Date:    ${new Date().toISOString()}`,
    `───────────────────────────────────────────────────`,
    '',
  ];

  for (const entry of entries) {
    const role = entry.role === 'user' ? 'You' : entry.role === 'assistant' ? 'LoveCode' : 'System';
    lines.push(`── ${role} ── [${new Date(entry.timestamp).toISOString()}]`);
    lines.push(entry.content);
    lines.push('');
  }

  lines.push(`───────────────────────────────────────────────────`);
  lines.push(`End of chat log — ${entries.length} messages`);

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

export function listChatLogs(rootDir?: string): Array<{ path: string; name: string; size: number; modified: Date }> {
  const dir = getChatLogDir(rootDir);
  if (!fs.existsSync(dir)) return [];
  const logs: Array<{ path: string; name: string; size: number; modified: Date }> = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.txt')) continue;
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      logs.push({ path: filePath, name: file, size: stat.size, modified: stat.mtime });
    } catch {
      // skip
    }
  }
  logs.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  return logs;
}

export function getChatLogCount(rootDir?: string): number {
  const dir = getChatLogDir(rootDir);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).length;
}

export function deleteChatLog(fileName: string, rootDir?: string): boolean {
  const dir = getChatLogDir(rootDir);
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
