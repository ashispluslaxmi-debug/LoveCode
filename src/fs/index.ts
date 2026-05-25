export { scanDirectory, getFilesByCategory, printScanSummary } from './scanner.js';
export type { ScannedFile, FileCategory, ScanOptions } from './scanner.js';

export { loadIgnoreRules, isIgnored } from './ignore.js';
export type { IgnoreRules } from './ignore.js';

export {
  renameFile,
  duplicateFile,
  getFileInfo,
  ensureDir,
  createDir,
  moveToTrash,
  getDirectoryTree,
} from './operations.js';
export type { FileOpResult } from './operations.js';

export { findFiles, semanticSearch, findWithRipgrep } from './search.js';
export type { SearchResult, SearchOptions } from './search.js';

export { rankFiles, getTopFiles, printRankedFiles } from './rank.js';
export type { RankedFile, RankOptions } from './rank.js';
