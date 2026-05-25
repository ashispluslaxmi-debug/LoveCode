import * as fs from 'node:fs';
import * as path from 'node:path';

const LOVE_CODE_DIR = '.lovecode';
const SESSIONS_DIR = 'sessions';

export interface SessionEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface SessionData {
  id: string;
  title: string;
  created: number;
  updated: number;
  model: string;
  provider: string;
  workingDir: string;
  entries: SessionEntry[];
  context: Record<string, string>;
}

export function getSessionsDir(rootDir?: string): string {
  const base = rootDir || process.cwd();
  return path.join(base, LOVE_CODE_DIR, SESSIONS_DIR);
}

export function ensureDirs(rootDir?: string): void {
  const base = rootDir || process.cwd();
  const sessionsDir = getSessionsDir(base);
  const chatsDir = path.join(base, LOVE_CODE_DIR, 'chats');
  const memoryDir = path.join(base, LOVE_CODE_DIR, 'memory');
  for (const dir of [sessionsDir, chatsDir, memoryDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function createSession(
  title: string,
  options?: { model?: string; provider?: string; workingDir?: string },
): SessionData {
  ensureDirs(options?.workingDir);
  const session: SessionData = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    created: Date.now(),
    updated: Date.now(),
    model: options?.model || 'unknown',
    provider: options?.provider || 'unknown',
    workingDir: options?.workingDir || process.cwd(),
    entries: [],
    context: {},
  };
  saveSession(session);
  return session;
}

export function saveSession(session: SessionData): void {
  const dir = getSessionsDir(session.workingDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export function loadSession(id: string, rootDir?: string): SessionData | null {
  const dir = getSessionsDir(rootDir);
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function listSessions(rootDir?: string): SessionData[] {
  const dir = getSessionsDir(rootDir);
  if (!fs.existsSync(dir)) return [];
  const sessions: SessionData[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      sessions.push(JSON.parse(raw) as SessionData);
    } catch {
      // skip corrupt
    }
  }
  sessions.sort((a, b) => b.updated - a.updated);
  return sessions;
}

export function deleteSession(id: string, rootDir?: string): boolean {
  const dir = getSessionsDir(rootDir);
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function appendToSession(
  session: SessionData,
  role: SessionEntry['role'],
  content: string,
): void {
  session.entries.push({ role, content, timestamp: Date.now() });
  session.updated = Date.now();
  saveSession(session);
}

export function updateSessionContext(
  session: SessionData,
  key: string,
  value: string,
): void {
  session.context[key] = value;
  session.updated = Date.now();
  saveSession(session);
}

export function searchSessions(query: string, rootDir?: string): SessionData[] {
  const lower = query.toLowerCase();
  return listSessions(rootDir).filter(
    (s) =>
      s.title.toLowerCase().includes(lower) ||
      s.entries.some((e) => e.content.toLowerCase().includes(lower)),
  );
}

export function resumeLastSession(rootDir?: string): SessionData | null {
  const sessions = listSessions(rootDir);
  return sessions.length > 0 ? sessions[0] : null;
}
