import * as fs from 'node:fs';
import * as path from 'node:path';
import { getGitRoot, hasConflicts, getConflictFiles, getConflictMarkers, isGitAvailable, isRepo } from './commands.js';

export interface ConflictInfo {
  file: string;
  markers: number;
  lines: number;
  regions: Array<{ startLine: number; endLine: number }>;
}

export interface ResolutionSuggestion {
  file: string;
  strategy: string;
  explanation: string;
}

export function detectConflicts(cwd?: string): ConflictInfo[] {
  if (!isGitAvailable() || !isRepo(cwd)) return [];
  if (!hasConflicts(cwd)) return [];

  const files = getConflictFiles(cwd);
  const root = getGitRoot(cwd);

  return files.map((file) => {
    const markers = getConflictMarkers(file, cwd);
    const regions: Array<{ startLine: number; endLine: number }> = [];
    for (let i = 0; i < markers.length; i++) {
      if (markers[i].type === 'start') {
        const end = markers.find((m, j) => j > i && m.type === 'end');
        if (end) {
          regions.push({ startLine: markers[i].line, endLine: end.line });
        }
      }
    }

    const fullPath = root ? path.join(root, file) : file;
    let lineCount = 0;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      lineCount = content.split('\n').length;
    } catch {}

    return {
      file,
      markers: markers.length / 3,
      lines: lineCount,
      regions,
    };
  });
}

export function suggestResolutions(cwd?: string): ResolutionSuggestion[] {
  const conflicts = detectConflicts(cwd);
  if (conflicts.length === 0) return [];

  return conflicts.map((conflict) => {
    const strategy = pickStrategy(conflict);
    return {
      file: conflict.file,
      strategy: strategy.label,
      explanation: strategy.explanation,
    };
  });
}

function pickStrategy(conflict: ConflictInfo): { label: string; explanation: string } {
  if (conflict.regions.length <= 2 && conflict.markers <= 2) {
    return {
      label: 'manual-edit',
      explanation: `Small conflict in ${conflict.file} (${conflict.markers} conflict regions). Open the file, resolve each conflict region by keeping the appropriate changes, remove <<<<<<<, =======, >>>>>>> markers, then run 'git add ${conflict.file}' and 'git commit'.`,
    };
  }

  return {
    label: 'review-carefully',
    explanation: `Multiple conflict regions in ${conflict.file}. Review each region carefully, keeping the correct combination of changes. After resolving all conflicts, use 'git add ${conflict.file}' and continue the merge with 'git commit'.`,
  };
}

export function formatConflictInfo(conflicts: ConflictInfo[]): string {
  if (conflicts.length === 0) return 'No merge conflicts detected.';

  const lines: string[] = [`Merge Conflicts Detected (${conflicts.length} files):`];
  for (const c of conflicts) {
    lines.push(`  ${c.file}`);
    lines.push(`    Conflict regions: ${c.markers}`);
    lines.push(`    Total lines: ${c.lines}`);
    for (const region of c.regions) {
      lines.push(`    Lines ${region.startLine}-${region.endLine}`);
    }
  }
  return lines.join('\n');
}

export function formatResolutionSuggestions(suggestions: ResolutionSuggestion[]): string {
  if (suggestions.length === 0) return 'No resolution suggestions needed.';

  const lines: string[] = ['Resolution Suggestions:'];
  for (const s of suggestions) {
    lines.push(`  File: ${s.file}`);
    lines.push(`  Strategy: ${s.strategy}`);
    lines.push(`  ${s.explanation}`);
    lines.push('');
  }
  return lines.join('\n');
}
