import { mkdir, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { build } from 'vite';
import { webkit, type Browser, type TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import { createRetainedWebAssetsMiddleware } from '../../apps/api/src/retained-web-assets';
import { retainFingerprintedAssets } from '../../scripts/deploy/preserve-web-assets.mjs';
import { preloadRecoveryBootstrapPlugin } from '../../vite-plugins/preload-recovery-bootstrap.mjs';

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

async function verifyPreloadRecovery(browser: Browser, testInfo: TestInfo) {
    const root = testInfo.outputPath('vite-preload-recovery');
    const source = path.join(root, 'source');
    const output = path.join(root, 'build');
    const guardPath = path.resolve('src/lib/staleChunkReloadGuard.ts').replaceAll('\\', '/');
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'index.html'), '<div id="root"></div><script type="module" src="/main.jsx"></script>');
    await writeFile(path.join(source, 'main.jsx'), `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { installVitePreloadRecovery, isStaleChunkError, reloadForStaleChunkOnce } from ${JSON.stringify(guardPath)};
        const recoveryMode = new URLSearchParams(location.search).get('mode') || '';
        installVitePreloadRecovery(window, () => !recoveryMode.includes('-late-'));
        const Lazy = React.lazy(() => import('./lazy.jsx'));
        class Boundary extends React.Component {
            constructor(props) { super(props); this.state = { error: null }; }
            static getDerivedStateFromError(error) { return { error }; }
            componentDidCatch(error) { if (isStaleChunkError(error)) reloadForStaleChunkOnce('react-error-boundary', window, { failure: error }); }
            render() { return this.state.error ? <pre id="error">{this.state.error.message}</pre> : this.props.children; }
        }
        createRoot(document.getElementById('root')).render(<Boundary><React.Suspense fallback="loading"><Lazy /></React.Suspense></Boundary>);
    `);
    await writeFile(path.join(source, 'lazy.jsx'), `import React from 'react'; import './lazy.css'; import { label } from './dependency.js'; export default function Lazy() { return <p id="success">{label}</p>; }`);
    await writeFile(path.join(source, 'dependency.js'), `export const label = 'loaded';`);
    await writeFile(path.join(source, 'lazy.css'), '#success { color: rgb(1, 2, 3); }');
    await build({ configFile: false, root: source, logLevel: 'silent', plugins: [preloadRecoveryBootstrapPlugin()], build: { outDir: output, emptyOutDir: true, rollupOptions: { output: { manualChunks(id) { return id.endsWith('/dependency.js') ? 'dependency' : undefined; } } } } });
    const app = express();
    let activeMode = '';
    let failedResources = 0;
    const failedPaths = new Set<string>();
    app.use((req, res, next) => {
        if (activeMode === 'off') return next();
        const target = activeMode.startsWith('multi-js-') ? /\/assets\/(?:lazy|dependency)-.*\.js$/
            : activeMode.startsWith('js-') ? /\/assets\/lazy-.*\.js$/ : /\/assets\/lazy-.*\.css$/;
        if (target.test(req.path) && (activeMode.endsWith('-persistent') || !failedPaths.has(req.path))) {
            failedResources++;
            failedPaths.add(req.path);
            const fail = () => {
                res.setHeader('Cache-Control', 'no-store');
                res.status(404).send('missing');
            };
            if (activeMode === 'multi-js-delayed-recovers' && req.path.includes('/dependency-')) {
                setTimeout(fail, 200);
            } else {
                fail();
            }
            return;
        }
        next();
    });
    app.use(express.static(output));
    const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('测试服务器未绑定端口');
        for (const mode of ['js-recovers', 'js-persistent', 'js-late-recovers', 'js-storage-recovers', 'js-storage-persistent', 'js-storage-late-recovers', 'css-recovers', 'css-persistent', 'multi-js-recovers', 'multi-js-delayed-recovers'] as const) {
            activeMode = mode;
            failedResources = 0;
            failedPaths.clear();
            const page = await browser.newPage(browser.browserType().name() === 'webkit'
                ? { viewport: { width: 402, height: 714 } }
                : {});
            let navigations = 0;
            const requests: string[] = [];
            const browserLogs: string[] = [];
            page.on('console', message => browserLogs.push(message.text()));
            if (mode.startsWith('js-storage-')) {
                await page.addInitScript(() => {
                    if (history.state === null) history.replaceState({ usr: { screen: 'room' }, key: 'test-route', idx: 2 }, '');
                    Object.defineProperty(window, 'sessionStorage', {
                        configurable: true,
                        get() { throw new DOMException('blocked', 'SecurityError'); },
                    });
                });
            }
            await page.addInitScript(() => {
                window.addEventListener('error', event => {
                    const target = event.target as HTMLLinkElement | null;
                    if (target?.tagName === 'LINK') console.log('preload-test-error', target.rel, target.href);
                }, true);
            });
            page.on('request', request => {
                const url = new URL(request.url());
                if (request.isNavigationRequest()) navigations++;
                if (url.pathname.startsWith('/assets/')) requests.push(`${url.pathname}${url.search}`);
            });
            await page.goto(`http://127.0.0.1:${address.port}/?mode=${mode}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
            if (mode.endsWith('-recovers')) {
                try {
                    await expect(page.locator('#success'), `${mode} 恢复加载`).toHaveText('loaded', { timeout: 15000 });
                } catch (error) {
                    const maps = await page.locator('script[type="importmap"]').allTextContents();
                    const recovery = await page.evaluate(() => {
                        let pending: string | null = null;
                        try { pending = sessionStorage.getItem('bg_failed_module_preload'); } catch { pending = 'unavailable'; }
                        return {
                            userAgent: navigator.userAgent,
                            installed: Boolean((window as Window & { __BG_MODULE_PRELOAD_RECOVERY__?: unknown }).__BG_MODULE_PRELOAD_RECOVERY__),
                            pending,
                            historyState: history.state,
                        };
                    });
                    console.error(JSON.stringify({ mode, navigations, failedResources, requests, maps, recovery, browserLogs, body: await page.locator('body').innerText() }));
                    throw error;
                }
            } else {
                const expected = mode.startsWith('js-')
                    ? browser.browserType().name() === 'webkit' ? 'Importing a module script failed' : 'dynamically imported module'
                    : 'Unable to preload CSS';
                await expect(page.locator('#error')).toContainText(expected, { timeout: 15000 });
                await expect(page.locator('#error')).not.toContainText('undefined');
            }
            await page.waitForTimeout(1000);
            expect(navigations).toBe(2);
            if (mode === 'js-persistent' || mode === 'js-storage-persistent') {
                expect(failedResources).toBeGreaterThanOrEqual(2);
                expect(failedResources).toBeLessThanOrEqual(3);
                // 服务恢复后，用户手动刷新必须绕开之前两次失败的模块缓存。
                activeMode = 'off';
                await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
                await expect(page.locator('#success')).toHaveText('loaded', { timeout: 15000 });
                expect(navigations).toBe(3);
            } else {
                expect(failedResources).toBe(mode.endsWith('-persistent') || mode.startsWith('multi-js-') ? 2 : 1);
            }
            if (mode.startsWith('js-storage-')) {
                expect(await page.evaluate(() => history.state)).toMatchObject({ usr: { screen: 'room' }, key: 'test-route', idx: 2 });
            }
            await page.close();
        }
    } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
}

test('预加载失败保留原始错误且最多刷新一次：Chromium', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    await verifyPreloadRecovery(browser, testInfo);
});

test('预加载失败保留原始错误且最多刷新一次：WebKit', async ({ browser: defaultBrowser }, testInfo) => {
    test.setTimeout(180_000);
    expect(defaultBrowser.isConnected()).toBe(true);
    test.skip(!existsSync(webkit.executablePath()), '本机未安装 Playwright WebKit');
    const browser = await webkit.launch({ headless: true });
    try {
        await verifyPreloadRecovery(browser, testInfo);
    } finally {
        await browser.close();
    }
});
