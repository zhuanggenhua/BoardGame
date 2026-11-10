import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mock, test } from 'node:test';
import { prepareSnapshotRuntimeData } from './e2e-snapshot-runtime-data.mjs';

test('静态资源读取固定根，上传数据在独立运行目录可写', () => {
    const base = fs.mkdtempSync(path.join(process.cwd(), 'temp', 'e2e-runtime-data-test-'));
    const source = path.join(base, 'source');
    const output = path.join(base, 'runtime');
    for (const directory of ['public', 'dist', 'uploads']) fs.mkdirSync(path.join(source, directory), { recursive: true });
    fs.mkdirSync(path.join(source, 'public', 'game-data'));
    fs.mkdirSync(path.join(source, 'src', 'games', 'dicethrone', 'ui'), { recursive: true });
    fs.mkdirSync(path.join(source, 'src', 'ui-scenes'), { recursive: true });
    fs.writeFileSync(path.join(source, 'public', 'asset.txt'), 'old asset');
    fs.writeFileSync(path.join(source, 'public', 'game-data', 'layout.json'), 'old layout');
    fs.writeFileSync(path.join(source, 'src', 'games', 'dicethrone', 'ui', 'abilitySlotLayout.ts'), 'old source');
    fs.writeFileSync(path.join(source, 'uploads', 'avatar.txt'), 'old avatar');
    try {
        prepareSnapshotRuntimeData(source, output);
        assert.equal(fs.readFileSync(path.join(output, 'public', 'asset.txt'), 'utf8'), 'old asset');
        fs.writeFileSync(path.join(output, 'uploads', 'avatar.txt'), 'new avatar');
        assert.equal(fs.readFileSync(path.join(source, 'uploads', 'avatar.txt'), 'utf8'), 'old avatar');
        fs.writeFileSync(path.join(output, 'layout-data', 'layout.json'), 'new layout');
        fs.writeFileSync(path.join(output, 'src', 'games', 'dicethrone', 'ui', 'abilitySlotLayout.ts'), 'new source');
        assert.equal(fs.readFileSync(path.join(source, 'public', 'game-data', 'layout.json'), 'utf8'), 'old layout');
        assert.equal(fs.readFileSync(path.join(source, 'src', 'games', 'dicethrone', 'ui', 'abilitySlotLayout.ts'), 'utf8'), 'old source');
        assert.throws(() => prepareSnapshotRuntimeData(source, output), { code: 'EEXIST' });
    } finally {
        for (const directory of ['public', 'dist']) {
            const link = path.join(output, directory);
            if (fs.existsSync(link)) {
                if (process.platform === 'win32') fs.rmdirSync(link);
                else fs.unlinkSync(link);
            }
        }
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test('准备失败只移除本次目录，不影响快照输入', () => {
    const base = fs.mkdtempSync(path.join(process.cwd(), 'temp', 'e2e-runtime-fail-test-'));
    const source = path.join(base, 'source');
    const output = path.join(base, 'runtime');
    fs.mkdirSync(path.join(source, 'public'), { recursive: true });
    fs.mkdirSync(path.join(source, 'uploads'));
    fs.writeFileSync(path.join(source, 'public', 'asset.txt'), 'keep');
    const failure = new Error('injected copy failure');
    const stub = mock.method(fs, 'cpSync', () => { throw failure; });
    try {
        assert.throws(() => prepareSnapshotRuntimeData(source, output), error => error === failure);
        assert.equal(fs.existsSync(output), false);
        assert.equal(fs.readFileSync(path.join(source, 'public', 'asset.txt'), 'utf8'), 'keep');
    } finally { stub.mock.restore(); fs.rmSync(base, { recursive: true, force: true }); }
});
