import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { expect, test } from '../framework';

test('React 并发渲染恢复错误上报底层错误类型和构建位置', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const root = testInfo.outputPath('react-recoverable-feedback');
    const out = path.join(root, 'dist');
    const capture = path.resolve('src/lib/feedback/errorContext.ts').replaceAll('\\', '/');
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, 'index.html'), '<div id="root"></div><script type="module" src="/main.jsx"></script>');
    await writeFile(path.join(root, 'main.jsx'), `
        import React, { startTransition, useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { installGlobalErrorContextCapture } from ${JSON.stringify(capture)};
        installGlobalErrorContextCapture();
        let first = true;
        function View() {
            const [active, setActive] = useState(false);
            if (active && first) { first = false; throw new TypeError('test concurrent failure'); }
            return <button onClick={() => startTransition(() => setActive(true))}>{active ? 'recovered' : 'start'}</button>;
        }
        createRoot(document.getElementById('root')).render(<View />);
    `);
    await build({ configFile: false, root, logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
    const reports: Array<{ content?: string; errorContext?: { name?: string; causeName?: string; causeSource?: string } }> = [];
    await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() === 'POST') {
            reports.push(request.postDataJSON());
            await route.fulfill({ status: 200, json: { _id: '000000000000000000000001' } });
            return;
        }
        const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        if (!/^(index\.html|assets\/[\w.-]+)$/.test(relative)) {
            await route.abort();
            return;
        }
        const body = await readFile(path.join(out, relative));
        await route.fulfill({ status: 200, body, contentType: relative.endsWith('.html') ? 'text/html' : 'text/javascript' });
    });
    await page.goto('http://8.148.71.102/');
    await page.getByRole('button', { name: 'start' }).click();
    await expect(page.getByRole('button', { name: 'recovered' })).toBeVisible();
    await expect.poll(() => reports.length).toBe(1);
    expect(reports[0].content).toContain('Minified React error #520');
    expect(reports[0].errorContext).toMatchObject({ name: 'Error', causeName: 'TypeError' });
    expect(reports[0].errorContext?.causeSource).toMatch(/^http:\/\/8\.148\.71\.102\/assets\/[\w.-]+\.js:\d+:\d+$/);
});
