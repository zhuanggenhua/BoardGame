import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compareDiagnostics, countDiagnostics, parseTypeDiagnostics } from '../typecheck-diagnostics.mjs';

test('real four-project gate isolates allowances, refuses overwrite and prunes without adding errors', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardgame-typecheck-runner-'));
    const repository = fileURLToPath(new URL('../../..', import.meta.url));
    const scripts = path.join(root, 'scripts/infra');
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(path.join(root, 'apps/api'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    for (const file of ['typecheck-projects.mjs', 'typecheck-diagnostics.mjs', 'typecheck-baseline-schema.mjs']) {
        fs.copyFileSync(path.join(repository, 'scripts/infra', file), path.join(scripts, file));
    }
    fs.symlinkSync(path.join(repository, 'node_modules'), path.join(root, 'node_modules'), 'junction');
    const projects = ['tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.server.json', 'apps/api/tsconfig.json'];
    for (const [index, project] of projects.entries()) {
        fs.writeFileSync(path.join(root, `${index}.ts`), 'export const value: number = "wrong";\n');
        fs.writeFileSync(path.join(root, project), JSON.stringify({ compilerOptions: { strict: true, types: [], skipLibCheck: true },
            files: [index === 3 ? '../../3.ts' : `${index}.ts`] }));
    }
    const run = (...args) => spawnSync(process.execPath, [path.join(scripts, 'typecheck-projects.mjs'), ...args], { cwd: root, encoding: 'utf8' });
    const baselinePath = path.join(scripts, 'typecheck-baseline.json');
    try {
        const initial = run('--write-baseline');
        assert.equal(initial.status, 0, initial.stderr);
        assert.notEqual(run('--write-baseline').status, 0);
        const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
        assert.equal(git('init').status, 0);
        const hooks = path.join(root, 'empty-hooks');
        fs.mkdirSync(hooks);
        assert.equal(git('add', 'scripts/infra/typecheck-baseline.json').status, 0);
        assert.equal(git('-c', 'user.name=GateFixture', '-c', 'user.email=gate@example.invalid', '-c', 'commit.gpgsign=false',
            '-c', `core.hooksPath=${hooks}`, 'commit', '--no-verify', '-m', 'reviewed fixture baseline').status, 0);
        const original = fs.readFileSync(baselinePath, 'utf8');
        const expanded = JSON.parse(original);
        expanded.projects['tsconfig.app.json'][0].count += 1;
        fs.writeFileSync(baselinePath, JSON.stringify(expanded));
        assert.notEqual(run().status, 0, 'editing the baseline cannot expand the trusted allowances');
        fs.writeFileSync(baselinePath, original);
        assert.equal(run().status, 0);
        fs.writeFileSync(path.join(root, '1.ts'), 'export const value: number = 1;\n');
        assert.notEqual(run().status, 0, 'resolved allowances must not remain available');
        assert.equal(run('--prune-baseline').status, 0);
        const tightened = fs.readFileSync(baselinePath, 'utf8');
        fs.writeFileSync(path.join(root, '1.ts'), 'export const value: number = "wrong";\n');
        assert.notEqual(run('--prune-baseline').status, 0);
        assert.equal(fs.readFileSync(baselinePath, 'utf8'), tightened, 'a failed prune must be atomic');
        fs.writeFileSync(path.join(root, 'tsconfig.app.json'), '{"compilerOptions":{"invalidOption":true},"files":["0.ts"]}');
        assert.notEqual(run().status, 0);
        assert.equal(fs.readFileSync(baselinePath, 'utf8'), tightened);
    } finally {
        fs.unlinkSync(path.join(root, 'node_modules'));
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'boardgame-typecheck-runner-'));
        fs.rmSync(root, { recursive: true });
    }
});

test('identical return lines in different functions cannot exchange a grandfathered error', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardgame-typecheck-scope-'));
    const file = path.join(root, 'a.ts');
    try {
        fs.writeFileSync(file, 'function old(value: string): number {\n return value;\n}\nfunction newer(value: number): number {\n return value;\n}\n');
        const old = parseTypeDiagnostics('a.ts(2,2): error TS2322: Bad value', root);
        fs.writeFileSync(file, 'function old(value: number): number {\n return value;\n}\nfunction newer(value: string): number {\n return value;\n}\n');
        const next = parseTypeDiagnostics('a.ts(5,2): error TS2322: Bad value', root);
        assert.equal(old[0].source, next[0].source);
        assert.equal(compareDiagnostics(next, countDiagnostics(old)).newDiagnostics.length, 1);
    } finally {
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'boardgame-typecheck-scope-'));
        fs.rmSync(root, { recursive: true });
    }
});
