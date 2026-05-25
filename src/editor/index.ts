export { applyPatch, applyInlinePatch, generateDiff, parseUnifiedDiff } from './patch.js';
export type { PatchHunk, PatchResult } from './patch.js';

export { checkBraceBalance, hasValidSyntax, detectLanguage } from './ast.js';
export type { SyntaxCheckResult, SyntaxError } from './ast.js';

export { saveUndoPoint, undoLast, undoForFile, getUndoHistory, clearUndoHistory } from './undo.js';
export type { UndoEntry } from './undo.js';

export {
  createSnapshot,
  restoreSnapshot,
  listSnapshots,
  deleteSnapshot,
  pruneSnapshots,
  snapshotDiff,
  createBatchSnapshot,
} from './snapshot.js';
export type { Snapshot } from './snapshot.js';

export { executeRefactor, planRefactor } from './refactor.js';
export type { RefactorEdit, RefactorResult, RefactorPlan } from './refactor.js';
