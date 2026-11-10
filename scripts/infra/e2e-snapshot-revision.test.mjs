import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { calculateSnapshotRevision } from './e2e-snapshot-revision.mjs';

test('内容、目录成员和初始可写数据都参与版本身份，缓存不参与', async () => {
    const root = fs.mkdtempSync(path.join(process.cwd(), 'temp', 'e2e-revision-test-'));
    try {
        for (const dir of ['src', 'uploads', 'node_modules/.vite']) fs.mkdirSync(path.join(root, dir), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'lazy.ts'), 'old');
        fs.writeFileSync(path.join(root, 'uploads', 'data.txt'), 'old');
        fs.writeFileSync(path.join(root, 'node_modules', '.vite', 'cache'), 'old cache');
        const first = await calculateSnapshotRevision(root);
        fs.writeFileSync(path.join(root, 'node_modules', '.vite', 'cache'), 'new cache');
        assert.equal(await calculateSnapshotRevision(root), first);
        fs.writeFileSync(path.join(root, 'uploads', 'data.txt'), 'new');
        const second = await calculateSnapshotRevision(root);
        assert.notEqual(second, first);
        fs.writeFileSync(path.join(root, 'src', 'new.json'), '{}');
        assert.notEqual(await calculateSnapshotRevision(root), second);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('测试脚本和 Playwright 配置变化都改变快照版本', async () => {
    const root = fs.mkdtempSync(path.join(process.cwd(), 'temp', 'e2e-revision-tests-'));
    try {
        fs.mkdirSync(path.join(root, 'e2e'));
        fs.writeFileSync(path.join(root, 'e2e', 'example.e2e.ts'), 'old');
        fs.writeFileSync(path.join(root, 'playwright.config.ts'), 'old config');
        fs.writeFileSync(path.join(root, 'playwright.config.parallel.ts'), 'old parallel config');
        const initial = await calculateSnapshotRevision(root);
        fs.writeFileSync(path.join(root, 'e2e', 'example.e2e.ts'), 'new');
        const afterTest = await calculateSnapshotRevision(root);
        assert.notEqual(afterTest, initial);
        fs.writeFileSync(path.join(root, 'playwright.config.ts'), 'new config');
        const afterConfig = await calculateSnapshotRevision(root);
        assert.notEqual(afterConfig, afterTest);
        fs.writeFileSync(path.join(root, 'playwright.config.parallel.ts'), 'new parallel config');
        assert.notEqual(await calculateSnapshotRevision(root), afterConfig);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('依赖指向源码根以外的链接时拒绝生成版本', async () => {
    const base = fs.mkdtempSync(path.join(process.cwd(), 'temp', 'e2e-revision-link-'));
    const root = path.join(base, 'source');
    const external = path.join(base, 'external');
    const link = path.join(root, 'node_modules', 'linked');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.mkdirSync(external);
    fs.symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir');
    try {
        await assert.rejects(calculateSnapshotRevision(root), /未经固定的链接/);
    } finally {
        if (process.platform === 'win32') fs.rmdirSync(link);
        else fs.unlinkSync(link);
        fs.rmSync(base, { recursive: true, force: true });
    }
});
