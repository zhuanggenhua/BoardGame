import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ignore from 'ignore';
import { verifyOperationGuideAssets } from './operation-guide-assets.mjs';

test('指南所引用的图片可完整解码且不被容器忽略规则过滤', async () => {
    const rules = ignore().add(fs.readFileSync('.dockerignore', 'utf8'));
    for (const url of await verifyOperationGuideAssets()) assert.equal(rules.ignores(`public${url}`), false, url);
});

test('缺图、网页和伪造图片头会阻止构建检查', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-guide-build-'));
    try {
        fs.mkdirSync(path.join(root, 'src/components/system'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src/components/system/OperationGuidePanel.tsx'), "const screenshot = {src:'/images/operation-guide/example.png'}");
        await assert.rejects(verifyOperationGuideAssets(root), /ENOENT/);
        fs.mkdirSync(path.join(root, 'public/images/operation-guide'), { recursive: true });
        fs.writeFileSync(path.join(root, 'public/images/operation-guide/example.png'), '<!doctype html>');
        await assert.rejects(verifyOperationGuideAssets(root), /需要真实图片/);
        fs.writeFileSync(path.join(root, 'public/images/operation-guide/example.png'), Buffer.concat([
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('damaged'),
        ]));
        await assert.rejects(verifyOperationGuideAssets(root), /无法完整解码/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
