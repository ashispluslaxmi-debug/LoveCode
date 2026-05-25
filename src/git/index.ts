export {
  isGitAvailable,
  isRepo,
  getGitRoot,
  getCurrentBranch,
  getStatus,
  stageAll,
  stageFiles,
  commit,
  getDiff,
  getStagedDiff,
  getUnstagedDiff,
  getFullDiff,
  getLog,
  getBranches,
  createBranch,
  switchBranch,
  deleteBranch,
  cleanupMergedBranches,
  getPRDiff,
  getPRLog,
  hasConflicts,
  getConflictFiles,
  getConflictMarkers,
  formatStatus,
  formatBranches,
  formatLog,
  abbreviateDiff,
} from './commands.js';
export type { GitStatus, GitLogEntry, BranchInfo } from './commands.js';

export { generateCommitMessage, generatePRSummary } from './message.js';
export type { MessageOptions } from './message.js';

export { detectConflicts, suggestResolutions, formatConflictInfo, formatResolutionSuggestions } from './conflict.js';
export type { ConflictInfo, ResolutionSuggestion } from './conflict.js';
