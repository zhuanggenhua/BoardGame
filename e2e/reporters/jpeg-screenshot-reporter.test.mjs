import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import JpegScreenshotReporter from './jpeg-screenshot-reporter.ts';

test('只转换本测试明确归属的附件，保留共享证据和其他测试原图', async () => {
    const root = await mkdtemp(join(tmpdir(), 'jpeg-reporter-'));
    try {
        const outputDir = join(root, 'test-one');
        await mkdir(outputDir);
        await mkdir(join(root, 'test-one-neighbor'));
        const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#28a8cc' } }).png().toBuffer();
        const owned = join(outputDir, 'failure.png');
        const unreferenced = join(outputDir, 'explicit-original.png');
        const shared = join(root, 'evidence.png');
        const neighboring = join(root, 'test-one-neighbor', 'other.png');
        for (const path of [owned, unreferenced, shared, neighboring]) await writeFile(path, png);
        const attachment = path => ({ name: 'screenshot', path, contentType: 'image/png' });
        // Reporter 的 TestResult 没有 outputDir，目录来自正式 Suite.project() 合同。
        const testCase = { parent: { project: () => ({ outputDir }) } };
        const result = { attachments: [attachment(owned), attachment(owned), attachment(shared), attachment(neighboring)] };
        const reporter = new JpegScreenshotReporter();
        await reporter.onTestEnd(testCase, result);
        if (reporter.onEnd) await reporter.onEnd({});
        assert.equal(result.attachments[0].contentType, 'image/jpeg');
        assert.equal(result.attachments[1].path, result.attachments[0].path);
        assert.equal((await sharp(result.attachments[0].path).metadata()).format, 'jpeg');
        await assert.rejects(readFile(owned), { code: 'ENOENT' });
        for (const path of [unreferenced, shared, neighboring]) assert.deepEqual(await readFile(path), png);
        assert.equal(result.attachments[2].contentType, 'image/png');
        assert.equal(result.attachments[3].path, neighboring);
        await reporter.onTestEnd(testCase, result);
    } finally {
        // 仅删除本测试通过 mkdtemp 创建的隔离目录。
        await rm(root, { recursive: true, force: true });
    }
});
