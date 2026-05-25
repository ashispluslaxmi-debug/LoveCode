export {
  createSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  appendToSession,
  updateSessionContext,
  searchSessions,
  resumeLastSession,
  ensureDirs,
} from './session.js';
export type { SessionData, SessionEntry } from './session.js';

export {
  getPreferences,
  savePreferences,
  getRepoMemory,
  saveRepoMemory,
  getWorkflows,
  saveWorkflow,
  deleteWorkflow,
  addRepoNote,
  clearAllMemory,
  formatPreferences,
  formatRepoMemory,
} from './memory.js';
export type { CodingPreferences, RepoMemory, WorkflowMemory, Workflow } from './memory.js';

export {
  storeVector,
  storeVectors,
  searchVectors,
  deleteVector,
  clearVectors,
  getVectorCount,
  formatVectorResults,
  loadVectors,
} from './vector.js';
export type { VectorMemoryEntry, VectorSearchResult } from './vector.js';

export {
  writeChatLog,
  listChatLogs,
  getChatLogCount,
  deleteChatLog,
} from './chatlog.js';
