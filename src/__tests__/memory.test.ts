import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';

let tmpDir: string;

function getRootDir(): string {
  return tmpDir;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovecode-mem-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Memory - Sessions', () => {
  it('creates and loads a session', async () => {
    const { createSession, loadSession } = await import('../memory/session.js');
    const session = createSession('Test Chat', { model: 'test-model', workingDir: getRootDir() });
    expect(session.id).toBeTruthy();
    expect(session.title).toBe('Test Chat');

    const loaded = loadSession(session.id, getRootDir());
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe('Test Chat');
    expect(loaded!.model).toBe('test-model');
  });

  it('appends entries and persists', async () => {
    const { createSession, loadSession, appendToSession } = await import('../memory/session.js');
    const session = createSession('Persist Test', { workingDir: getRootDir() });
    appendToSession(session, 'user', 'hello');
    appendToSession(session, 'assistant', 'hi there');

    const loaded = loadSession(session.id, getRootDir());
    expect(loaded!.entries.length).toBe(2);
    expect(loaded!.entries[0].role).toBe('user');
    expect(loaded!.entries[0].content).toBe('hello');
    expect(loaded!.entries[1].role).toBe('assistant');
    expect(loaded!.entries[1].content).toBe('hi there');
  });

  it('lists sessions in reverse chronological order', async () => {
    const { createSession, listSessions } = await import('../memory/session.js');
    createSession('First', { workingDir: getRootDir() });
    await new Promise((r) => setTimeout(r, 10));
    const s2 = createSession('Second', { workingDir: getRootDir() });
    const sessions = listSessions(getRootDir());
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0].id).toBe(s2.id);
  });

  it('searches sessions by content', async () => {
    const { createSession, appendToSession, searchSessions } = await import('../memory/session.js');
    const s1 = createSession('Bug Hunt', { workingDir: getRootDir() });
    appendToSession(s1, 'user', 'fix the authentication bug');
    const s2 = createSession('Feature', { workingDir: getRootDir() });
    appendToSession(s2, 'user', 'add new feature');

    const results = searchSessions('authentication', getRootDir());
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(s1.id);
  });

  it('deletes a session', async () => {
    const { createSession, listSessions, deleteSession } = await import('../memory/session.js');
    const session = createSession('Delete Me', { workingDir: getRootDir() });
    expect(listSessions(getRootDir()).length).toBe(1);
    deleteSession(session.id, getRootDir());
    expect(listSessions(getRootDir()).length).toBe(0);
  });

  it('updates session context', async () => {
    const { createSession, updateSessionContext, loadSession } = await import('../memory/session.js');
    const session = createSession('Context Test', { workingDir: getRootDir() });
    updateSessionContext(session, 'framework', 'react');
    const loaded = loadSession(session.id, getRootDir());
    expect(loaded!.context.framework).toBe('react');
  });

  it('resumes last session', async () => {
    const { createSession, resumeLastSession } = await import('../memory/session.js');
    createSession('Old', { workingDir: getRootDir() });
    await new Promise((r) => setTimeout(r, 10));
    createSession('Recent', { workingDir: getRootDir() });
    const resumed = resumeLastSession(getRootDir());
    expect(resumed).not.toBeNull();
    expect(resumed!.title).toBe('Recent');
  });

  it('ensures dirs exist', async () => {
    const { ensureDirs } = await import('../memory/session.js');
    ensureDirs(getRootDir());
    expect(fs.existsSync(path.join(getRootDir(), '.lovecode', 'sessions'))).toBe(true);
    expect(fs.existsSync(path.join(getRootDir(), '.lovecode', 'chats'))).toBe(true);
    expect(fs.existsSync(path.join(getRootDir(), '.lovecode', 'memory'))).toBe(true);
  });
});

describe('Memory - Long-Term Memory', () => {
  it('gets default preferences', async () => {
    const { getPreferences, DEFAULT_PREFERENCES } = await import('../memory/memory.js');
    const prefs = getPreferences(getRootDir());
    expect(prefs.indentStyle).toBe(DEFAULT_PREFERENCES.indentStyle);
    expect(prefs.indentSize).toBe(DEFAULT_PREFERENCES.indentSize);
  });

  it('saves and retrieves preferences', async () => {
    const { getPreferences, savePreferences } = await import('../memory/memory.js');
    savePreferences({ indentSize: 4, quoteStyle: 'double' }, getRootDir());
    const prefs = getPreferences(getRootDir());
    expect(prefs.indentSize).toBe(4);
    expect(prefs.quoteStyle).toBe('double');
  });

  it('saves and retrieves repo memory', async () => {
    const { getRepoMemory, saveRepoMemory } = await import('../memory/memory.js');
    saveRepoMemory({ primaryLanguage: 'TypeScript', totalFiles: 42 }, getRootDir());
    const mem = getRepoMemory(getRootDir());
    expect(mem.primaryLanguage).toBe('TypeScript');
    expect(mem.totalFiles).toBe(42);
  });

  it('adds repo notes', async () => {
    const { getRepoMemory, addRepoNote } = await import('../memory/memory.js');
    addRepoNote('uses pnpm', getRootDir());
    addRepoNote('monorepo structure', getRootDir());
    const mem = getRepoMemory(getRootDir());
    expect(mem.notes.length).toBe(2);
    expect(mem.notes[0]).toBe('uses pnpm');
  });

  it('saves and lists workflows', async () => {
    const { getWorkflows, saveWorkflow, deleteWorkflow } = await import('../memory/memory.js');
    saveWorkflow({ name: 'test-flow', description: 'Test workflow', steps: ['step1', 'step2'], tags: [], created: Date.now(), used: Date.now() }, getRootDir());
    const wf = getWorkflows(getRootDir());
    expect(wf.workflows.length).toBe(1);
    expect(wf.workflows[0].name).toBe('test-flow');

    deleteWorkflow('test-flow', getRootDir());
    expect(getWorkflows(getRootDir()).workflows.length).toBe(0);
  });

  it('limits notes to 50', async () => {
    const { getRepoMemory, addRepoNote } = await import('../memory/memory.js');
    for (let i = 0; i < 60; i++) {
      addRepoNote(`note ${i}`, getRootDir());
    }
    const mem = getRepoMemory(getRootDir());
    expect(mem.notes.length).toBe(50);
    expect(mem.notes[0]).toBe('note 10');
  });

  it('formats preferences', async () => {
    const { formatPreferences, savePreferences } = await import('../memory/memory.js');
    savePreferences({ indentStyle: 'tabs', indentSize: 4 }, getRootDir());
    const prefs = (await import('../memory/memory.js')).getPreferences(getRootDir());
    const formatted = formatPreferences(prefs);
    expect(formatted).toContain('tabs');
    expect(formatted).toContain('4');
  });
});

describe('Memory - Vector Memory', () => {
  it('stores and searches vectors', async () => {
    const { storeVector, searchVectors } = await import('../memory/vector.js');
    await storeVector('autonomous coding agent with tool use', { label: 'concept' }, getRootDir());
    await storeVector('react component with hooks and state', { label: 'code' }, getRootDir());

    const results = await searchVectors('coding', { topK: 5, minScore: 0 }, getRootDir());
    expect(results.length).toBeGreaterThan(0);
  });

  it('filters by metadata', async () => {
    const { storeVector, searchVectors } = await import('../memory/vector.js');
    await storeVector('autonomous agent', { type: 'concept' }, getRootDir());
    await storeVector('react component', { type: 'code' }, getRootDir());

    const results = await searchVectors('agent', { topK: 5, minScore: 0, filter: { type: 'concept' } }, getRootDir());
    expect(results.every((r) => r.entry.metadata.type === 'concept')).toBe(true);
  });

  it('returns empty for no matches', async () => {
    const { searchVectors } = await import('../memory/vector.js');
    const results = await searchVectors('nonexistent', { topK: 5, minScore: 0.9 }, getRootDir());
    expect(results.length).toBe(0);
  });

  it('counts vectors', async () => {
    const { storeVector, getVectorCount } = await import('../memory/vector.js');
    expect(getVectorCount(getRootDir())).toBe(0);
    await storeVector('test', {}, getRootDir());
    expect(getVectorCount(getRootDir())).toBe(1);
  });

  it('deletes a vector', async () => {
    const { storeVector, deleteVector, getVectorCount } = await import('../memory/vector.js');
    const entry = await storeVector('delete me', {}, getRootDir());
    expect(getVectorCount(getRootDir())).toBe(1);
    deleteVector(entry.id, getRootDir());
    expect(getVectorCount(getRootDir())).toBe(0);
  });

  it('clears all vectors', async () => {
    const { storeVector, clearVectors, getVectorCount } = await import('../memory/vector.js');
    await storeVector('one', {}, getRootDir());
    await storeVector('two', {}, getRootDir());
    clearVectors(getRootDir());
    expect(getVectorCount(getRootDir())).toBe(0);
  });

  it('formats vector results', async () => {
    const { searchVectors, formatVectorResults, storeVector } = await import('../memory/vector.js');
    await storeVector('coding agent', { type: 'concept' }, getRootDir());
    const results = await searchVectors('coding', { topK: 5, minScore: 0 }, getRootDir());
    const formatted = formatVectorResults(results);
    expect(formatted).toContain('Vector Memory Search Results');
  });
});

describe('Memory - Chat Logs', () => {
  it('writes a chat log file', async () => {
    const { writeChatLog, listChatLogs } = await import('../memory/chatlog.js');
    const { createSession, appendToSession } = await import('../memory/session.js');
    const session = createSession('Log Test', { workingDir: getRootDir() });
    appendToSession(session, 'user', 'hello');
    appendToSession(session, 'assistant', 'world');

    const filePath = writeChatLog(session.id, session.title, session.entries, getRootDir());
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('hello');
    expect(content).toContain('world');

    const logs = listChatLogs(getRootDir());
    expect(logs.length).toBe(1);
  });

  it('counts chat logs', async () => {
    const { writeChatLog, getChatLogCount } = await import('../memory/chatlog.js');
    const { createSession, appendToSession } = await import('../memory/session.js');
    const session = createSession('Count Test', { workingDir: getRootDir() });
    appendToSession(session, 'user', 'msg');

    writeChatLog(session.id, session.title, session.entries, getRootDir());
    expect(getChatLogCount(getRootDir())).toBe(1);
  });

  it('deletes a chat log', async () => {
    const { writeChatLog, listChatLogs, deleteChatLog } = await import('../memory/chatlog.js');
    const { createSession, appendToSession } = await import('../memory/session.js');
    const session = createSession('Delete Test', { workingDir: getRootDir() });
    appendToSession(session, 'user', 'msg');

    const filePath = writeChatLog(session.id, session.title, session.entries, getRootDir());
    const fileName = path.basename(filePath);
    expect(listChatLogs(getRootDir()).length).toBe(1);
    deleteChatLog(fileName, getRootDir());
    expect(listChatLogs(getRootDir()).length).toBe(0);
  });
});
