import * as fs from 'node:fs';
import chalk from 'chalk';
import { applyInlinePatch } from './patch.js';
import { createBatchSnapshot, type Snapshot } from './snapshot.js';
import { hasValidSyntax, detectLanguage } from './ast.js';

export interface RefactorEdit {
  filePath: string;
  search: string;
  replace: string;
  description: string;
}

export interface RefactorResult {
  success: boolean;
  applied: number;
  failed: number;
  snapshots: Snapshot[];
  errors: Array<{ filePath: string; error: string }>;
  output: string;
}

export interface RefactorPlan {
  edits: RefactorEdit[];
  rootDir: string;
  validateSyntax: boolean;
}

export async function executeRefactor(plan: RefactorPlan): Promise<RefactorResult> {
  const snapshots: Snapshot[] = [];
  const errors: Array<{ filePath: string; error: string }> = [];
  let applied = 0;

  const filesToSnapshot = [...new Set(plan.edits.map((e) => e.filePath))];
  const batchSnaps = createBatchSnapshot(plan.rootDir, filesToSnapshot, 'refactor');
  snapshots.push(...batchSnaps);

  for (const edit of plan.edits) {
    const result = applyInlinePatch(edit.filePath, edit.search, edit.replace);

    if (result.success && result.applied) {
      if (plan.validateSyntax) {
        try {
          const content = fs.readFileSync(edit.filePath, 'utf-8');
          const lang = detectLanguage(edit.filePath);
          if (!hasValidSyntax(content, lang)) {
            errors.push({
              filePath: edit.filePath,
              error: 'Syntax validation failed after edit. Use undo or snapshot to revert.',
            });
          }
        } catch {
          // skip validation on read error
        }
      }
      applied++;
    } else {
      errors.push({
        filePath: edit.filePath,
        error: result.error || 'Patch failed to apply',
      });
    }
  }

  const total = plan.edits.length;
  const allSuccess = errors.length === 0;
  const successCount = applied;

  const output = [
    chalk.bold('\n  Refactor Summary'),
    chalk.dim(`  ${successCount}/${total} edits applied`),
    ...(snapshots.length > 0 ? [chalk.dim(`  Snapshots: ${snapshots.length} created`)] : []),
    ...errors.map((e) => chalk.red(`  ✗ ${e.filePath}: ${e.error}`)),
    allSuccess ? chalk.green('  ✓ All edits applied successfully\n') : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    success: allSuccess,
    applied: successCount,
    failed: errors.length,
    snapshots,
    errors,
    output,
  };
}

export function planRefactor(
  edits: RefactorEdit[],
  rootDir: string,
  validateSyntax: boolean = true,
): RefactorPlan {
  return { edits, rootDir, validateSyntax };
}
