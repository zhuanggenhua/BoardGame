import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    prependNodePath,
    resolveWorkspaceNodeModuleFile,
} from '../../../scripts/infra/node-module-resolver.mjs';

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'node-module-resolver-'));
    const repoRoot = path.join(root, 'repo');
    const worktreeRoot = path.join(repoRoot, '.worktrees', 'qidahen');
    const localModuleFile = path.join(worktreeRoot, 'node_modules', 'playwright', 'cli.js');
    const fallbackModuleFile = path.join(repoRoot, 'node_modules', 'playwright', 'cli.js');

    fs.mkdirSync(path.dirname(fallbackModuleFile), { recursive: true });
    fs.writeFileSync(fallbackModuleFile, '// fallback playwright cli');
    fs.mkdirSync(worktreeRoot, { recursive: true });

    return {
        root,
        repoRoot,
        worktreeRoot,
        localModuleFile,
        fallbackModuleFile,
    };
}

describe('node-module-resolver', () => {
    it('优先使用当前 worktree 的 node_modules', () => {
        const fixture = createFixture();
        try {
            fs.mkdirSync(path.dirname(fixture.localModuleFile), { recursive: true });
            fs.writeFileSync(fixture.localModuleFile, '// local playwright cli');

            const resolved = resolveWorkspaceNodeModuleFile('playwright/cli.js', {
                cwd: fixture.worktreeRoot,
            });

            expect(resolved.filePath).toBe(fixture.localModuleFile);
            expect(resolved.usedFallback).toBe(false);
        } finally {
            fs.rmSync(fixture.root, { recursive: true, force: true });
        }
    });

    it('在 worktree 缺失时回退到上层仓库的 node_modules', () => {
        const fixture = createFixture();
        try {
            const resolved = resolveWorkspaceNodeModuleFile('playwright/cli.js', {
                cwd: fixture.worktreeRoot,
            });

            expect(resolved.filePath).toBe(fixture.fallbackModuleFile);
            expect(resolved.usedFallback).toBe(true);
        } finally {
            fs.rmSync(fixture.root, { recursive: true, force: true });
        }
    });

    it('prependNodePath 会保留并去重 node_modules 根目录', () => {
        const env = prependNodePath({
            NODE_PATH: 'C:\\existing\\node_modules',
        }, 'C:\\repo\\node_modules');

        expect(env.NODE_PATH).toContain('C:\\repo\\node_modules');
        expect(env.NODE_PATH).toContain('C:\\existing\\node_modules');
    });
});
