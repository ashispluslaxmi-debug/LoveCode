import Conf from 'conf';

export interface ChatEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  created: number;
  updated: number;
  entries: ChatEntry[];
}

const store = new Conf<{ sessions: ChatSession[] }>({
  projectName: 'lovecode',
  schema: {
    sessions: {
      type: 'array',
      default: [],
    },
  },
});

export class ChatHistory {
  private sessions: ChatSession[];
  private currentId: string | null = null;

  constructor() {
    this.sessions = store.get('sessions', []);
  }

  createSession(title: string = 'New Chat'): string {
    const id = Date.now().toString(36);
    const session: ChatSession = {
      id,
      title,
      created: Date.now(),
      updated: Date.now(),
      entries: [],
    };
    this.sessions.unshift(session);
    this.currentId = id;
    this.persist();
    return id;
  }

  append(role: ChatEntry['role'], content: string): void {
    if (!this.currentId) return;
    const session = this.sessions.find((s) => s.id === this.currentId);
    if (session) {
      session.entries.push({ role, content, timestamp: Date.now() });
      session.updated = Date.now();
      this.persist();
    }
  }

  getCurrent(): ChatSession | null {
    if (!this.currentId) return null;
    return this.sessions.find((s) => s.id === this.currentId) ?? null;
  }

  getMessages(): Array<{ role: string; content: string }> {
    const session = this.getCurrent();
    if (!session) return [];
    return session.entries.map((e) => ({ role: e.role, content: e.content }));
  }

  switchSession(id: string): void {
    if (this.sessions.find((s) => s.id === id)) {
      this.currentId = id;
    }
  }

  listSessions(): ChatSession[] {
    return this.sessions;
  }

  search(query: string): ChatSession[] {
    const lower = query.toLowerCase();
    return this.sessions.filter((s) => {
      if (s.title.toLowerCase().includes(lower)) return true;
      return s.entries.some((e) => e.content.toLowerCase().includes(lower));
    });
  }

  deleteSession(id: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    if (this.currentId === id) {
      this.currentId = this.sessions[0]?.id ?? null;
    }
    this.persist();
  }

  renameSession(id: string, title: string): void {
    const session = this.sessions.find((s) => s.id === id);
    if (session) {
      session.title = title;
      session.updated = Date.now();
      this.persist();
    }
  }

  reset(): void {
    this.currentId = null;
  }

  private persist(): void {
    store.set('sessions', this.sessions);
  }
}
