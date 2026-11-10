import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ensureSingleWorkerRuntime, getSnapshotRuntimeScope } from './e2e-runtime-manager.mjs';
import { calculateSnapshotRevision } from './e2e-snapshot-revision.mjs';

test('服务版本由源码内容和实际配置决定，会话标识变化不改变 scope', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-version-identity-'));
    try {
        const roots = ['a', 'b', 'c'].map(name => {
            const root = path.join(base, name);
            fs.mkdirSync(path.join(root, 'src'), { recursive: true });
            fs.writeFileSync(path.join(root, 'package.json'), '{}');
            fs.writeFileSync(path.join(root, 'src', 'domain.ts'), name === 'c' ? 'new' : 'old');
            return root;
        });
        const oldRevision = await calculateSnapshotRevision(roots[0]);
        assert.equal(await calculateSnapshotRevision(roots[1]), oldRevision);
        assert.notEqual(await calculateSnapshotRevision(roots[2]), oldRevision);
        const first = getSnapshotRuntimeScope(oldRevision, { CODEX_TOOL_CALL_ID: 'a', PW_E2E_SESSION_ID: 'one', NODE_ENV: 'test' });
        assert.equal(first, getSnapshotRuntimeScope(oldRevision, { CODEX_TOOL_CALL_ID: 'b', PW_E2E_SESSION_ID: 'two', NODE_ENV: 'test' }));
        assert.notEqual(first, getSnapshotRuntimeScope(oldRevision, { NODE_ENV: 'production' }));
        await assert.rejects(ensureSingleWorkerRuntime({ sourceRoot: roots[0], snapshotRevision: oldRevision }), /快照|提供器/);
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
