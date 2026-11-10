import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { prepareSnapshotDependencies } from './e2e-snapshot-dependencies.mjs';

test('bundle 的外部依赖固定在对应源码根，不能用另一版本覆盖', () => {
    const base = fs.mkdtempSync(path.join(process.cwd(), 'temp', 'e2e-bundle-deps-'));
    const first = path.join(base, 'first');
    const second = path.join(base, 'second');
    const output = path.join(base, 'output');
    for (const [root, value] of [[first, 'old'], [second, 'new']]) {
        const pkg = path.join(root, 'node_modules', 'probe-package');
        fs.mkdirSync(pkg, { recursive: true });
        fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'probe-package', type: 'module', exports: './index.js' }));
        fs.writeFileSync(path.join(pkg, 'index.js'), `export default '${value}';`);
    }
    try {
        prepareSnapshotDependencies(first, output);
        fs.mkdirSync(path.join(output, 'game'));
        const entry = path.join(output, 'game', 'server.mjs');
        fs.writeFileSync(entry, "import value from 'probe-package'; console.log(value)");
        const result = spawnSync(process.execPath, ['--preserve-symlinks', entry], { encoding: 'utf8', windowsHide: true });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), 'old');
        assert.throws(() => prepareSnapshotDependencies(second, output), /其他源码快照/);
        assert.equal(fs.readlinkSync(path.join(output, 'node_modules')), path.join(first, 'node_modules'));
    } finally {
        const link = path.join(output, 'node_modules');
        if (fs.existsSync(link)) fs.rmdirSync(link);
        fs.rmSync(base, { recursive: true, force: true });
    }
});
