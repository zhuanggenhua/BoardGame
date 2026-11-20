import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { build, preview } from 'vite';
import { localPreviewPublicPlugin } from './local-preview-public.mjs';

test('临时预览复用公共文件，保留每个版本的资源内容', async t => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'boardgame-preview-test-'));
    const ci = process.env.CI;
    delete process.env.CI;
    t.after(() => {
        if (ci !== undefined) process.env.CI = ci;
        fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
    });
    const publicDir = path.join(root, 'public', 'assets');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<main>Preview</main>');
    const media = path.join(publicDir, 'sample.ogg');
    fs.writeFileSync(media, 'OggS version one');
    const config = { root, configFile: false, logLevel: 'silent' };
    const buildAt = async outDir => {
        await build({ ...config, plugins: [localPreviewPublicPlugin(root)], build: { outDir } });
        return path.join(root, outDir, 'assets', 'sample.ogg');
    };

    const first = await buildAt('temp/first');
    const second = await buildAt('temp/second');
    const sameFile = fs.statSync(first, { bigint: true });
    assert.equal(fs.statSync(second, { bigint: true }).ino, sameFile.ino);
    assert.equal(sameFile.nlink, 3n);
    assert.notEqual(fs.statSync(media, { bigint: true }).ino, sameFile.ino);

    fs.writeFileSync(media, 'OggS version two');
    const third = await buildAt('temp/third');
    assert.equal(fs.readFileSync(first, 'utf8'), 'OggS version one');
    assert.equal(fs.readFileSync(third, 'utf8'), 'OggS version two');
    const server = await preview({ ...config, build: { outDir: 'temp/first' }, preview: { host: '127.0.0.1', port: 0 } });
    try {
        const response = await fetch(new URL('/assets/sample.ogg', server.resolvedUrls.local[0]), {
            headers: { Range: 'bytes=0-3' },
        });
        assert.equal(response.status, 206);
        assert.equal(await response.text(), 'OggS');
    } finally {
        await server.close();
    }

    const release = await buildAt('dist');
    assert.equal(fs.statSync(release).nlink, 1);
    assert.equal(fs.readFileSync(release, 'utf8'), 'OggS version two');
});
