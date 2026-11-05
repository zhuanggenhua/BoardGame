import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { captureSourceIdentity, sourceIdentityMatches, getFrontendSourceHash, createSourceSessionTracker, selectRuntimeSourceIdentity, selectFrontendEvidenceIdentity } from './e2e-source-identity.mjs';
import { buildSync } from 'esbuild';
import { createServer } from 'vite';
import { e2eSourceIdentityPlugin, getActualModuleImports } from '../../vite-plugins/e2e-source-identity.mjs';

test('后端输入改变或删除即失效，未打包的 UI 改动不会令服务失效', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'source-identity-test-'));
    try {
        fs.writeFileSync(path.join(cwd, 'domain.ts'), 'export const damage = 1;');
        const identity = captureSourceIdentity(['domain.ts'], cwd);
        assert.equal(sourceIdentityMatches(identity), true);
        fs.writeFileSync(path.join(cwd, 'ui.tsx'), 'new display');
        assert.equal(sourceIdentityMatches(identity), true);
        fs.writeFileSync(path.join(cwd, 'domain.ts'), 'export const damage = 2;');
        assert.equal(sourceIdentityMatches(identity), false);
        fs.unlinkSync(path.join(cwd, 'domain.ts'));
        assert.equal(sourceIdentityMatches(identity), false);
        assert.equal(sourceIdentityMatches(null), false);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('非 bundle runtime 没有构建图时按完整文件身份保守核验', () => {
    const identity = { files: [{ path: 'server.ts', hash: 'source-hash' }] };
    assert.equal(selectRuntimeSourceIdentity(identity, 'dicethrone'), identity);
});

test('启动配置按构建导入图核对，未加载页面与其它游戏文件不触发服务刷新', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-identity-test-'));
    fs.mkdirSync(path.join(cwd, 'src'));
    try {
        fs.writeFileSync(path.join(cwd, 'vite.config.mjs'), 'import {setting} from "./plugin.mjs";export default {setting};');
        fs.writeFileSync(path.join(cwd, 'plugin.mjs'), 'export const setting = 1;');
        fs.writeFileSync(path.join(cwd, 'src/tutorial.ts'), 'old tutorial');
        const first = getFrontendSourceHash(cwd);
        fs.writeFileSync(path.join(cwd, 'src/tutorial.test.ts'), 'new test');
        assert.equal(getFrontendSourceHash(cwd), first);
        fs.writeFileSync(path.join(cwd, 'src/tutorial.ts'), 'new tutorial');
        assert.equal(getFrontendSourceHash(cwd), first);
        fs.writeFileSync(path.join(cwd, 'src/other-game.ts'), 'unrelated change');
        assert.equal(getFrontendSourceHash(cwd), first);
        fs.writeFileSync(path.join(cwd, 'plugin.mjs'), 'export const setting = 2;');
        assert.notEqual(getFrontendSourceHash(cwd), first);
        fs.unlinkSync(path.join(cwd, 'src/tutorial.ts'));
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('前端 runtime 身份覆盖 Vite 代理与公开运行开关环境变量', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-env-identity-test-'));
    try {
        fs.writeFileSync(path.join(cwd, 'vite.config.mjs'), 'export default {};');
        fs.writeFileSync(path.join(cwd, '.env.development'), 'VITE_BACKEND_URL=https://api-one.example');
        const env = {
            VITE_DEV_SKIP_API: 'false',
            GAME_SERVER_PROXY_TARGET: 'http://127.0.0.1:2567',
        };
        const first = getFrontendSourceHash(cwd, env);
        assert.equal(getFrontendSourceHash(cwd, { ...env }), first);
        assert.notEqual(getFrontendSourceHash(cwd, { ...env, VITE_DEV_SKIP_API: 'true' }), first);
        assert.notEqual(getFrontendSourceHash(cwd, { ...env, GAME_SERVER_PROXY_TARGET: 'http://127.0.0.1:3001' }), first);
        fs.writeFileSync(path.join(cwd, '.env.development'), 'VITE_BACKEND_URL=https://api-two.example');
        assert.notEqual(getFrontendSourceHash(cwd, env), first);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('浏览器会话的依赖互相隔离；实际依赖换版本会被拒绝', () => {
    const tracker = createSourceSessionTracker();
    tracker.record('first', { files: [{ path: 'first.ts', hash: 'one' }] });
    tracker.record('second', { files: [{ path: 'second.ts', hash: 'two' }] });
    assert.deepEqual(tracker.read('first').files.map(file => file.path), ['first.ts']);
    tracker.record('first', { files: [{ path: 'first.ts', hash: 'changed' }] });
    assert.deepEqual(tracker.read('first').conflicts, ['first.ts']);
    assert.deepEqual(tracker.read('second').conflicts, []);
    tracker.release('first');
    assert.deepEqual(tracker.read('first').files, []);
});

test('CSS 源码依赖图排除 Tailwind 扫描项并保留真实样式导入', () => {
    const cssFile = path.resolve('src/index.css');
    const importedStyle = path.resolve('src/fonts.css');
    const scannedGameSource = path.resolve('src/games/betrayal/manifest.ts');
    const imports = getActualModuleImports(cssFile, {
        importedModules: new Set([{ file: importedStyle }, { file: scannedGameSource }]),
    }, { files: [{ path: importedStyle }] });
    assert.deepEqual(imports, [importedStyle]);
    assert.deepEqual(getActualModuleImports(cssFile, {
        importedModules: new Set([{ file: scannedGameSource }]),
    }, undefined), [], '缺少真實 CSS import 时不能把 Tailwind 扫描文件当成运行时依赖');
});

test('权威依赖按真实构建图跨过游戏注册边界，保留共享输入并排除未消费的游戏分支', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-graph-'));
    const put = (file, content) => { fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true }); fs.writeFileSync(path.join(cwd, file), content); };
    try {
        put('server.ts', 'import "./src/games/manifest.server.generated";import "./src/games/roomSetupRegistry";import "./shared";');
        put('shared.ts', 'export const version=1;');
        put('src/games/manifest.server.generated.ts', 'import "./first/game";import "./second/game";');
        put('src/games/first/game.ts', 'import "../../../shared";console.log("first");');
        put('src/games/second/game.ts', 'console.log("second");');
        put('src/games/roomSetupRegistry.ts', 'import "./first/roomSetup";import "./second/roomSetup";');
        put('src/games/first/roomSetup.ts', 'export const room="first";');
        put('src/games/second/roomSetup.ts', 'export const room="second";');
        const result = buildSync({ absWorkingDir: cwd, entryPoints: ['server.ts'], bundle: true, write: false, metafile: true });
        const absolute = file => path.resolve(cwd, file);
        const identity = { ...captureSourceIdentity(Object.keys(result.metafile.inputs), cwd), graphs: [{ entry: absolute('server.ts'), configuration: [],
            imports: Object.fromEntries(Object.entries(result.metafile.inputs).map(([file, data]) => [absolute(file), data.imports.map(item => absolute(item.path))])) }] };
        const selected = selectRuntimeSourceIdentity(identity, 'first');
        const registryBoundary = selected.scope.registrationBranches.find(entry => entry.boundary === 'public-room-setup-registry');
        assert.deepEqual(registryBoundary.availableImports.map(file => path.relative(path.dirname(absolute('src/games/roomSetupRegistry.ts')), file).split(path.sep)[0]), ['first', 'second']);
        assert.deepEqual(registryBoundary.selectedImports.map(file => path.relative(path.dirname(absolute('src/games/roomSetupRegistry.ts')), file).split(path.sep)[0]), ['first']);
        put('src/games/second/game.ts', 'console.log("changed other game");');
        put('src/games/second/roomSetup.ts', 'export const room="changed other game";');
        assert.equal(sourceIdentityMatches(selected), true);
        put('shared.ts', 'export const version=2;');
        assert.equal(sourceIdentityMatches(selected), false);
        put('shared.ts', 'export const version=1;');
        put('src/games/first/game.ts', 'console.log("changed actual game");');
        assert.equal(sourceIdentityMatches(selected), false);
        put('src/games/first/game.ts', 'import "../../../shared";console.log("first");');
        put('src/games/first/roomSetup.ts', 'export const room="changed target game";');
        assert.equal(sourceIdentityMatches(selected), false);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('前端证据按 index.html 的真实图裁剪生成游戏注册分支并保留共享 UI 和实际 public 素材', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-game-graph-'));
    const put = (file, content) => { fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true }); fs.writeFileSync(path.join(cwd, file), content); };
    try {
        const files = [
            'index.html', 'src/main.ts', 'src/index.css', 'src/fonts.css', 'src/shared.ts', 'src/games/manifest.generated.ts', 'src/games/manifest.client.generated.tsx', 'src/games/cursorRegistry.ts',
            'src/games/first/manifest.ts', 'src/games/first/board.ts', 'src/games/first/thumbnail.ts', 'src/games/first/cursor.ts',
            'src/games/second/manifest.ts', 'src/games/second/board.ts', 'src/games/second/thumbnail.ts', 'src/games/second/thumbnail.css', 'src/games/second/cursor.ts',
            'src/components/SharedTray.ts', 'public/assets/first-board.webp', 'vite.config.ts',
        ];
        put('index.html', '<html></html>');
        put('src/main.ts', 'import "./shared";import "./index.css";import "./games/manifest.generated";import "./games/manifest.client.generated";import "./components/SharedTray";');
        put('src/index.css', '@import "./fonts.css";\n@source ".";');
        put('src/fonts.css', '@font-face { font-family: Test; src: url(/fonts/test.woff2); }');
        put('src/shared.ts', 'export const shared=1;');
        put('src/games/manifest.generated.ts', 'import "./first/manifest";import "./second/manifest";');
        put('src/games/manifest.client.generated.tsx', 'import "./first/manifest";import "./first/thumbnail";import "./second/manifest";import "./second/thumbnail";');
        put('src/games/cursorRegistry.ts', 'import "./first/cursor";import "./second/cursor";');
        put('src/games/first/manifest.ts', 'import "./board";');
        put('src/games/first/board.ts', 'export const board="first";');
        put('src/games/first/thumbnail.ts', 'export const thumbnail="first";');
        put('src/games/first/cursor.ts', 'export const cursor="first";');
        put('src/games/second/manifest.ts', 'import "./board";');
        put('src/games/second/board.ts', 'export const board="second";');
        put('src/games/second/thumbnail.ts', 'export const thumbnail="second";');
        put('src/games/second/thumbnail.css', '.second-game-thumbnail { color: red; }');
        put('src/games/second/cursor.ts', 'export const cursor="second";');
        put('src/components/SharedTray.ts', 'export const tray="shared";');
        put('public/assets/first-board.webp', 'actual requested asset');
        put('vite.config.ts', 'export default {};');
        const absolute = file => path.resolve(cwd, file);
        const identity = {
            files: captureSourceIdentity(files, cwd).files,
            graphs: [{ root: cwd, entry: absolute('index.html'), configuration: [absolute('vite.config.ts')], imports: {
                [absolute('index.html')]: [absolute('src/main.ts')],
                [absolute('src/main.ts')]: [absolute('src/shared.ts'), absolute('src/index.css'), absolute('src/games/manifest.generated.ts'), absolute('src/games/manifest.client.generated.tsx'), absolute('src/games/cursorRegistry.ts'), absolute('src/components/SharedTray.ts')],
                [absolute('src/games/cursorRegistry.ts')]: [absolute('src/games/first/cursor.ts'), absolute('src/games/second/cursor.ts')],
                [absolute('src/index.css')]: [absolute('src/fonts.css'), absolute('src/games/second/manifest.ts'), absolute('src/games/second/thumbnail.css')],
                [absolute('src/games/manifest.generated.ts')]: [absolute('src/games/first/manifest.ts'), absolute('src/games/second/manifest.ts')],
                [absolute('src/games/manifest.client.generated.tsx')]: [absolute('src/games/first/manifest.ts'), absolute('src/games/first/thumbnail.ts'), absolute('src/games/second/manifest.ts'), absolute('src/games/second/thumbnail.ts')],
                [absolute('src/games/first/manifest.ts')]: [absolute('src/games/first/board.ts')],
                [absolute('src/games/second/manifest.ts')]: [absolute('src/games/second/board.ts')],
            } }],
        };
        const selected = selectFrontendEvidenceIdentity(identity, 'first');
        const clientBoundary = selected.scope.registrationBranches.find(entry => entry.file.endsWith('manifest.client.generated.tsx'));
        assert.equal(clientBoundary.availableImports.length, 4);
        assert.equal(clientBoundary.selectedImports.length, 2);
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('components', 'SharedTray.ts'))), true);
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('src', 'fonts.css'))), true,
            'CSS 声明的真实字体样式导入仍保留');
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('games', 'first', 'board.ts'))), true);
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('games', 'first', 'thumbnail.ts'))), true);
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('games', 'first', 'cursor.ts'))), true);
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('games', 'second', 'cursor.ts'))), false,
            '统一光标注册表只保留目标游戏主题');
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('games', 'second', 'board.ts'))), false);
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('games', 'second', 'thumbnail.ts'))), false);
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('games', 'second', 'thumbnail.css'))), false,
            'Tailwind @source 扫描到的其它游戏样式不算运行时 CSS import');
        assert.equal(selected.files.some(file => file.path.endsWith(path.join('assets', 'first-board.webp'))), true);
        assert.equal(selected.scope.foreignGameFiles.length, 0,
            'CSS 扫描边不能把其它游戏文件带入目标游戏依赖范围');
        assert.equal(selected.scope.registrationBranches.some(branch => branch.boundary === 'game-cursor-registry'), true);
        put('src/games/second/board.ts', 'export const board="changed unrelated game";');
        put('src/games/second/thumbnail.css', '.second-game-thumbnail { color: blue; }');
        assert.equal(sourceIdentityMatches(selected), true);
        put('src/components/SharedTray.ts', 'export const tray="changed shared UI";');
        assert.equal(sourceIdentityMatches(selected), false);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('同端口并发会话只采集各自响应，模块变更可按请求刷新且旧会话仍判为失效', async () => {
    const cwd = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'source-server-')));
    let server;
    let finishDelayedResponse;
    try {
        fs.writeFileSync(path.join(cwd, 'index.html'), '<html><script type="module" src="/entry.js"></script></html>');
        fs.writeFileSync(path.join(cwd, 'entry.js'), 'import "./src/components/home/HomeStyleSettings.js";export const value="old";');
        fs.writeFileSync(path.join(cwd, 'other.js'), 'export const other="separate";');
        fs.writeFileSync(path.join(cwd, 'delayed.js'), 'export const delayed="ready";');
        fs.writeFileSync(path.join(cwd, 'entry.css'), '@import "./colors.css";');
        fs.writeFileSync(path.join(cwd, 'generated.css'), 'body {}');
        fs.writeFileSync(path.join(cwd, 'scan-only.css'), '.unrelated { color: pink; }');
        fs.writeFileSync(path.join(cwd, 'colors.css'), 'body { color: red; }');
        fs.mkdirSync(path.join(cwd, 'public/locales'), { recursive: true });
        fs.writeFileSync(path.join(cwd, 'public/locales/ui.json'), '{"label":"before"}');
        const sharedSettings = path.join(cwd, 'src/components/home/HomeStyleSettings.js');
        fs.mkdirSync(path.dirname(sharedSettings), { recursive: true });
        fs.writeFileSync(sharedSettings, 'export const setting="old";');
        server = await createServer({ root: cwd, configFile: false, plugins: [e2eSourceIdentityPlugin(), {
            name: 'test-content-generated-css',
            enforce: 'pre',
            configureServer(currentServer) {
                currentServer.middlewares.use((request, response, next) => {
                    if (request.url !== '/delayed.js') return next();
                    response.writeHead(200, { 'Content-Type': 'application/javascript' });
                    response.write('export const delayed="');
                    finishDelayedResponse = () => response.end('ready";');
                });
            },
            transform(code, id) {
                if (id.split('?')[0].replaceAll(path.sep, '/').endsWith('/generated.css')) {
                    this.addWatchFile(path.join(cwd, 'scan-only.css'));
                    return `${code}\nbody { --source: ${fs.readFileSync(path.join(cwd, 'entry.js'), 'utf8').includes('"new"') ? 'new' : 'old'}; }`;
                }
            },
        }],
            server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'silent' });
        await server.listen();
        const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
        const get = (session, url) => fetch(origin + url, { headers: { 'x-e2e-source-session': session,
            ...(url.endsWith('.css') ? { accept: 'text/css' } : {}) } });
        const delayedResponse = await get('delayed', '/delayed.js');
        const headersSent = await (await get('delayed', '/__e2e/source-identity')).json();
        assert.equal(headersSent.files.some(file => file.path.endsWith('delayed.js')), true,
            '浏览器收到响应后立即查询时必须已登记依赖，无须等待 finish');
        finishDelayedResponse();
        await delayedResponse.text();
        await (await get('shared-settings', '/')).text();
        await (await get('shared-settings', '/entry.js')).text();
        await (await get('shared-settings', '/src/components/home/HomeStyleSettings.js')).text();
        const frontendIdentity = await (await get('shared-settings', '/__e2e/source-identity')).json();
        const settings = selectFrontendEvidenceIdentity(frontendIdentity, 'dicethrone');
        assert.equal(settings.files.some(file => file.path.endsWith('HomeStyleSettings.js')), true,
            '真实收到的共享设置组件沿应用入口共享导入图保留');
        fs.writeFileSync(sharedSettings, 'export const setting="new";');
        assert.equal(sourceIdentityMatches(settings), false);
        await Promise.all([get('first', '/entry.js').then(r => r.text()), get('second', '/other.js').then(r => r.text())]);
        const first = await (await get('first', '/__e2e/source-identity')).json();
        assert.match(await (await get('first', '/generated.css')).text(), /--source: old/);
        assert.equal(first.files.some(file => file.path.endsWith('entry.js')), true);
        assert.equal(first.files.some(file => file.path.endsWith('other.js')), false);
        const generated = await (await get('first', '/__e2e/source-identity')).json();
        assert.equal(generated.files.some(file => file.path.endsWith('scan-only.css')), false, '扫描观察文件不能冒充实际样式导入');
        const styleText = await (await get('style', '/entry.css')).text();
        const localeResponse = await fetch(origin + '/locales/ui.json', { headers: { cookie: 'bg_e2e_source_session=style' } });
        const localeText = await localeResponse.text();
        assert.equal(localeResponse.status, 200, localeText);
        const style = await (await get('style', '/__e2e/source-identity')).json();
        const cssModule = await server.moduleGraph.getModuleByUrl('/entry.css');
        const cssImportedFiles = cssModule ? [...cssModule.importedModules].map(module => module.file) : [];
        assert.equal(style.files.some(file => file.path.endsWith('colors.css')), true,
            `内联 CSS 依赖也必须登记: ${JSON.stringify(cssImportedFiles)} ${styleText}`);
        assert.equal(style.files.some(file => file.path.endsWith('ui.json')), true, `语言资源必须登记: ${localeText} ${JSON.stringify(style.files)}`);
        fs.writeFileSync(path.join(cwd, 'colors.css'), 'body { color: blue; }');
        assert.equal(sourceIdentityMatches(style), false);
        const changedStyle = await (await get('new-style', '/entry.css')).text();
        assert.match(changedStyle, /blue/);
        fs.writeFileSync(path.join(cwd, 'other.js'), 'export const other="changed";');
        assert.equal(sourceIdentityMatches(first), true);
        fs.writeFileSync(path.join(cwd, 'entry.js'), 'export const value="new";');
        assert.equal(sourceIdentityMatches(first), false);
        assert.match(await (await get('style-before-script', '/generated.css')).text(), /--source: new/,
            '新会话先请求 CSS 时也要包含变更模块所需样式');
        const freshText = await (await get('fresh', '/entry.js')).text();
        assert.match(freshText, /"new"/);
        const fresh = await (await get('fresh', '/__e2e/source-identity')).json();
        assert.equal(sourceIdentityMatches(fresh), true);
        await (await get('first', '/entry.js')).text();
        const old = await (await get('first', '/__e2e/source-identity')).json();
        assert.equal(old.conflicts.some(file => file.endsWith('entry.js')), true);
    } finally { finishDelayedResponse?.(); if (server) await server.close(); fs.rmSync(cwd, { recursive: true, force: true }); }
});
