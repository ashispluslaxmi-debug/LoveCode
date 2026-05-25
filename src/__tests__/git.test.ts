import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

let tmpDir: string;

function writeFile(relPath: string, content: string = 'hello'): void {
  fs.writeFileSync(path.join(tmpDir, relPath), content, 'utf-8');
}

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    return (err.stdout || err.stderr || err.message || '').toString().trim();
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lovecode-git-test-'));
  git('init');
  git('config user.email "test@test.com"');
  git('config user.name "Test"');
  writeFile('.gitkeep', 'init');
  git('add -A');
  git('commit -m "initial"');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Git - Commands', () => {
  it('detects git repo', async () => {
    const { isRepo, isGitAvailable, getGitRoot } = await import('../git/commands.js');
    expect(isGitAvailable()).toBe(true);
    expect(isRepo(tmpDir)).toBe(true);
    expect(getGitRoot(tmpDir)).toBe(tmpDir);
  });

  it('shows clean status for committed repo', async () => {
    const { getStatus } = await import('../git/commands.js');
    const status = getStatus(tmpDir);
    expect(status.clean).toBe(true);
    expect(status.staged.length).toBe(0);
    expect(status.unstaged.length).toBe(0);
  });

  it('detects untracked files', async () => {
    const { getStatus } = await import('../git/commands.js');
    writeFile('test.txt');
    const status = getStatus(tmpDir);
    expect(status.clean).toBe(false);
    expect(status.untracked).toContain('test.txt');
  });

  it('detects staged files', async () => {
    const { getStatus, stageAll } = await import('../git/commands.js');
    writeFile('test.txt');
    stageAll(tmpDir);
    const status = getStatus(tmpDir);
    expect(status.staged).toContain('test.txt');
    expect(status.untracked.length).toBe(0);
  });

  it('commits changes', async () => {
    const { commit, getLog } = await import('../git/commands.js');
    writeFile('test.txt');
    git('add -A');
    const result = commit('feat: add test file', tmpDir);
    expect(result.success).toBe(true);
    expect(result.hash).toBeTruthy();

    const log = getLog(5, tmpDir);
    expect(log.length).toBe(2);
    expect(log[0].message).toBe('feat: add test file');
  });

  it('shows nothing to commit on clean repo', async () => {
    const { commit } = await import('../git/commands.js');
    const result = commit('message', tmpDir);
    expect(result.success).toBe(false);
    expect(result.output).toContain('Nothing to commit');
  });

  it('lists branches', async () => {
    const { getBranches, createBranch } = await import('../git/commands.js');
    const branches = getBranches(tmpDir);
    expect(branches.length).toBe(1);
    expect(branches[0].current).toBe(true);

    createBranch('feature', tmpDir);
    const branches2 = getBranches(tmpDir);
    expect(branches2.length).toBe(2);
  });

  it('creates and switches branches', async () => {
    const { createBranch } = await import('../git/commands.js');
    const result = createBranch('feature/test', tmpDir);
    expect(result).toBe(true);
  });

  it('switches between branches', async () => {
    const { createBranch, switchBranch, getCurrentBranch } = await import('../git/commands.js');
    const defaultBranch = getCurrentBranch(tmpDir);
    createBranch('feature', tmpDir);
    writeFile('a.txt');
    git('add -A');
    git('commit -m "a"');

    const result = switchBranch(defaultBranch, tmpDir);
    expect(result.success).toBe(true);
    expect(getCurrentBranch(tmpDir)).toBe(defaultBranch);
  });

  it('deletes a branch', async () => {
    const { createBranch, getBranches, deleteBranch, switchBranch, getCurrentBranch } = await import('../git/index.js');
    const defaultBranch = getCurrentBranch(tmpDir);
    createBranch('to-delete', tmpDir);
    writeFile('x.txt');
    git('add -A');
    git('commit -m "x"');

    switchBranch(defaultBranch, tmpDir);
    const result = deleteBranch('to-delete', true, tmpDir);
    expect(result.success).toBe(true);

    const branches = getBranches(tmpDir);
    expect(branches.find((b) => b.name === 'to-delete')).toBeUndefined();
  });

  it('shows diff', async () => {
    const { getDiff, stageAll } = await import('../git/commands.js');
    writeFile('test.txt', 'line1\nline2\nline3');
    stageAll(tmpDir);
    const diff = getDiff(tmpDir);
    expect(diff).toContain('+line1');
  });

  it('shows log', async () => {
    const { commit, getLog } = await import('../git/commands.js');
    writeFile('a.txt', 'a');
    git('add -A');
    commit('first commit', tmpDir);

    writeFile('b.txt', 'b');
    git('add -A');
    commit('second commit', tmpDir);

    const log = getLog(5, tmpDir);
    expect(log.length).toBe(3);
    expect(log[0].message).toBe('second commit');
    expect(log[1].message).toBe('first commit');
  });

  it('handles non-git directory', async () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    const { isRepo, getGitRoot } = await import('../git/commands.js');
    expect(isRepo(nonGitDir)).toBe(false);
    expect(getGitRoot(nonGitDir)).toBeNull();
    fs.rmSync(nonGitDir, { recursive: true, force: true });
  });

  it('shows staged vs unstaged diff', async () => {
    const { getStagedDiff, getUnstagedDiff, stageAll } = await import('../git/commands.js');
    writeFile('staged.txt', 'staged content');
    stageAll(tmpDir);
    writeFile('staged.txt', 'unstaged content');

    const staged = getStagedDiff(tmpDir);
    expect(staged).toContain('+staged content');

    const unstaged = getUnstagedDiff(tmpDir);
    expect(unstaged).toContain('+unstaged content');
  });
});

describe('Git - Conflict', () => {
  it('detects no conflicts in clean repo', async () => {
    const { detectConflicts } = await import('../git/conflict.js');
    expect(detectConflicts(tmpDir).length).toBe(0);
  });

  it('detects conflict markers', async () => {
    const { getConflictMarkers } = await import('../git/index.js');
    writeFile('c.txt', '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> other\n');
    git('add -A');
    git('commit -m "conflict file"');

    const markers = getConflictMarkers('c.txt', tmpDir);
    expect(markers.length).toBe(3);
    expect(markers[0].type).toBe('start');
    expect(markers[1].type).toBe('separator');
    expect(markers[2].type).toBe('end');
  });

  it('detects merge conflicts', async () => {
    const { getConflictFiles, hasConflicts, getCurrentBranch } = await import('../git/index.js');
    const defaultBranch = getCurrentBranch(tmpDir);
    writeFile('c.txt', 'base content');
    git('add -A');
    git('commit -m "base"');

    git('checkout -b other');
    writeFile('c.txt', 'other branch change');
    git('add -A');
    git('commit -m "other"');

    git(`checkout ${defaultBranch}`);
    writeFile('c.txt', 'master branch change');
    git('add -A');
    git('commit -m "master"');

    git('checkout other');
    git(`merge ${defaultBranch}`);

    const has = hasConflicts(tmpDir);
    expect(has).toBe(true);

    const files = getConflictFiles(tmpDir);
    expect(files).toContain('c.txt');
  });
});

describe('Git - Message generation', () => {
  it('generates fallback message when no AI', async () => {
    const { generateCommitMessage } = await import('../git/message.js');
    writeFile('fallback.txt', 'new content');
    git('add -A');
    const msg = await generateCommitMessage();
    expect(msg).toBeTruthy();
  });

  it('generates fallback PR summary', async () => {
    const { generatePRSummary } = await import('../git/message.js');
    writeFile('pr.txt', 'content');
    git('add -A');
    git('commit -m "feat: pr content"');

    const summary = await generatePRSummary('master');
    expect(summary).toBeTruthy();
  });
});
