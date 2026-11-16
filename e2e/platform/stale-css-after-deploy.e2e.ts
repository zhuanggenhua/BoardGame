import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { build } from 'vite';
import { expect, test } from '../framework';
import { createRetainedWebAssetsMiddleware } from '../../apps/api/src/retained-web-assets';
import { retainFingerprintedAssets } from '../../scripts/deploy/preserve-web-assets.mjs';

test('旧页面跨版本按需加载时，保留的 CSS 和模块仍可使用', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const root = testInfo.outputPath('vite-releases');
    const source = path.join(root, 'source');
    const live = path.join(root, 'live');
    const history = path.join(root, 'history');
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'index.html'), '<button id="open">open</button><div id="result"></div><script type="module" src="/main.js"></script>');
    await writeFile(path.join(source, 'main.js'), `document.querySelector('#open').addEventListener('click',async()=>{try{const m=await import('./lazy.js');document.querySelector('#result').textContent=m.value}catch(e){document.querySelector('#result').textContent='ERROR:'+e.message}})`);
    await writeFile(path.join(source, 'lazy.js'), `import './lazy.css'; export const value='old-loaded';`);
    await writeFile(path.join(source, 'lazy.css'), '#result { color: rgb(1, 2, 3); }');
    const compile = () => build({ configFile: false, root: source, logLevel: 'silent', build: { outDir: live, emptyOutDir: true, rollupOptions: { input: path.join(source, 'index.html') } } });
    await compile();

    let historyEnabled = false;
    const app = express();
    app.use('/assets', express.static(path.join(live, 'assets')));
    const retained = createRetainedWebAssetsMiddleware(history);
    app.use('/assets', (req, res, next) => historyEnabled ? retained(req, res, next) : next());
    app.get('/', (_req, res) => res.sendFile(path.join(live, 'index.html')));
    const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('测试服务器未绑定端口');
        const oldPage = await browser.newPage();
        const protectedPage = await browser.newPage();
        const url = `http://127.0.0.1:${address.port}/`;
        await Promise.all([oldPage.goto(url), protectedPage.goto(url)]);
        await retainFingerprintedAssets(path.join(live, 'assets'), history);
        await rename(live, path.join(root, 'prior'));
        await writeFile(path.join(source, 'lazy.js'), `import './lazy.css'; export const value='new-loaded';`);
        await writeFile(path.join(source, 'lazy.css'), '#result { color: rgb(4, 5, 6); }');
        await compile();

        await oldPage.click('#open');
        await expect(oldPage.locator('#result')).toContainText('Unable to preload CSS');
        historyEnabled = true;
        await protectedPage.click('#open');
        await expect(protectedPage.locator('#result')).toHaveText('old-loaded');
        await expect(protectedPage.locator('#result')).toHaveCSS('color', 'rgb(1, 2, 3)');
    } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});
