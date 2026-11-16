import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createRetainedWebAssetsMiddleware } from '../src/retained-web-assets';

describe('发布后旧版静态资源', () => {
    const roots: string[] = [];
    afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

    it('新版本发布后仍为旧页面提供原指纹 CSS，当前版本优先且无指纹文件不会回退', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'boardgame-asset-retention-'));
        roots.push(root);
        const current = path.join(root, 'current');
        const history = path.join(root, 'history');
        await Promise.all([mkdir(current), mkdir(history)]);
        await writeFile(path.join(history, 'HomeEntry-uYa2FQtX.css'), 'old css');
        await writeFile(path.join(history, 'shared-AbCd1234.js'), 'old js');
        await writeFile(path.join(history, 'config.json'), 'old config');
        await writeFile(path.join(current, 'shared-AbCd1234.js'), 'current js');
        const app = express();
        app.use('/assets', express.static(current));
        app.use('/assets', createRetainedWebAssetsMiddleware(history));

        const oldCss = await request(app).get('/assets/HomeEntry-uYa2FQtX.css').expect(200);
        expect(oldCss.text).toBe('old css');
        expect(oldCss.headers['cache-control']).toContain('immutable');
        expect((await request(app).get('/assets/shared-AbCd1234.js').expect(200)).text).toBe('current js');
        await request(app).get('/assets/config.json').expect(404);
        await request(app).get('/assets/missing-AbCd1234.css').expect(404);
    });
});
