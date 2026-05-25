export { detectProject, printProjectInfo } from './detect.js';
export type { ProjectType, ProjectInfo } from './detect.js';

export { analyzeDependencies, printDepGraph, findCircularDeps } from './deps.js';
export type { DepGraph, DepEdge, DepNode } from './deps.js';

export { semanticSearch as semanticCodeSearch, printSemanticResults } from './search.js';
export type { SemanticResult, SemanticSearchOptions } from './search.js';

export { generateSummary, printSummary } from './summary.js';
export type { RepoSummary } from './summary.js';
