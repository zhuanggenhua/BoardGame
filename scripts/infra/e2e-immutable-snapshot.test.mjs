import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createImmutableSnapshot } from './e2e-immutable-snapshot.mjs';
import { calculateSnapshotRevision } from './e2e-snapshot-revision.mjs';

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'boardgame-snapshot-test-'));
    t.after(async () => {
        // These are exclusively files created by this test.
        await fs.rm(root, { recursive: true, force: true });
    });
    const sourceRoot = path.join(root, 'source');
    await fs.mkdir(path.join(sourceRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(sourceRoot, 'src', 'lazy.ts'), 'old');
    await fs.writeFile(path.join(sourceRoot, 'src', 'style.css'), 'old css');
    return { root, sourceRoot };
}

test('副本固定文件字节且不与工作区共享文件节点', async t => {
    const { root, sourceRoot } = await fixture(t);
    const snapshot = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'snapshot'), entries: ['src'] });
    await fs.writeFile(path.join(sourceRoot, 'src', 'lazy.ts'), 'new');
    assert.equal(await fs.readFile(path.join(snapshot.root, 'src', 'lazy.ts'), 'utf8'), 'old');
    assert.equal(snapshot.files.length, 2);
    assert.equal(await calculateSnapshotRevision(snapshot.root), snapshot.revision, '创建器和消费者必须识别同一快照版本');
    const second = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'snapshot2'), entries: ['src'] });
    assert.notEqual(snapshot.revision, second.revision);
});

test('含测试资源及 Vite 缓存的副本与重新计算的版本一致', async t => {
    const { root, sourceRoot } = await fixture(t);
    await fs.mkdir(path.join(sourceRoot, 'node_modules', '.vite'), { recursive: true });
    await fs.mkdir(path.join(sourceRoot, 'android', 'app'), { recursive: true });
    await fs.writeFile(path.join(sourceRoot, 'node_modules', '.vite', 'cache'), 'cache');
    await fs.writeFile(path.join(sourceRoot, 'android', 'app', 'fixture.xml'), 'fixture');
    await fs.writeFile(path.join(sourceRoot, 'playwright.config.ts'), 'config');
    const snapshot = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'snapshot'),
        entries: ['src', 'node_modules', 'android', 'playwright.config.ts'],
        onCopied: async name => {
            if (name === 'src/lazy.ts') await fs.writeFile(path.join(sourceRoot, 'node_modules', '.vite', 'cache'), 'updated cache');
        } });
    assert.equal(await calculateSnapshotRevision(snapshot.root), snapshot.revision);
    await assert.rejects(fs.stat(path.join(snapshot.root, 'node_modules', '.vite')), { code: 'ENOENT' });
});

test('嵌套入口的隐式父目录参与相同的版本计算', async t => {
    const { root, sourceRoot } = await fixture(t);
    await fs.mkdir(path.join(sourceRoot, 'src', 'deep'));
    await fs.writeFile(path.join(sourceRoot, 'src', 'deep', 'file.ts'), 'nested');
    for (const [name, entry] of [['file', 'src/deep/file.ts'], ['dir', 'src/deep']]) {
        const snapshot = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, name), entries: [entry] });
        assert.equal(await calculateSnapshotRevision(snapshot.root), snapshot.revision);
    }
});

test('Windows 大小写不同的重叠入口只复制一次且不会复制 Vite 缓存', async t => {
    if (process.platform !== 'win32') return t.skip('仅 Windows 路径规则');
    const { root, sourceRoot } = await fixture(t);
    await fs.mkdir(path.join(sourceRoot, 'node_modules', '.vite'), { recursive: true });
    await fs.writeFile(path.join(sourceRoot, 'node_modules', '.vite', 'cache'), 'cache');
    const snapshot = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'snapshot'),
        entries: ['SRC', 'src/LAZY.ts', 'NODE_MODULES'] });
    assert.equal(snapshot.files.filter(file => file.path === 'src/lazy.ts').length, 1);
    assert.equal(await calculateSnapshotRevision(snapshot.root), snapshot.revision);
    await assert.rejects(fs.stat(path.join(snapshot.root, 'node_modules', '.vite')), { code: 'ENOENT' });
});

test('Windows 文件夹保留混合大小写时也排除 Vite 缓存', async t => {
    if (process.platform !== 'win32') return t.skip('仅 Windows 路径规则');
    const { root, sourceRoot } = await fixture(t);
    await fs.mkdir(path.join(sourceRoot, 'Node_Modules', '.Vite'), { recursive: true });
    await fs.writeFile(path.join(sourceRoot, 'Node_Modules', '.Vite', 'cache'), 'cache');
    const snapshot = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'snapshot'), entries: ['node_modules'] });
    await assert.rejects(fs.stat(path.join(snapshot.root, 'Node_Modules', '.Vite')), { code: 'ENOENT' });
    assert.equal(await calculateSnapshotRevision(snapshot.root), snapshot.revision);
    await assert.rejects(createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'only-cache'),
        entries: ['node_modules/.vite/cache'] }), /均为可写缓存/);
});

test('准备期间输入内容或目录成员变化时不发布快照', async t => {
    const { root, sourceRoot } = await fixture(t);
    const destination = path.join(root, 'snapshot');
    await assert.rejects(createImmutableSnapshot({
        sourceRoot, destination, entries: ['src'],
        onCopied: async name => {
            if (name === 'src/lazy.ts') await fs.writeFile(path.join(sourceRoot, 'src', 'lazy.ts'), 'changed');
        },
    }), /文件发生变化/);
    await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
    await assert.rejects(createImmutableSnapshot({
        sourceRoot, destination, entries: ['src'],
        onCopied: async name => {
            if (name === 'src/lazy.ts') await fs.writeFile(path.join(sourceRoot, 'src', 'new.json'), '{}');
        },
    }), /目录成员发生变化/);
    await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
});

test('复制期间内容变化后恢复仍拒绝发布', async t => {
    const { root, sourceRoot } = await fixture(t);
    const filename = path.join(sourceRoot, 'src', 'lazy.ts');
    await assert.rejects(createImmutableSnapshot({
        sourceRoot, destination: path.join(root, 'snapshot'), entries: ['src'],
        onCopied: async name => {
            if (name === 'src/lazy.ts') {
                await fs.writeFile(filename, 'new');
                await fs.writeFile(filename, 'old');
            }
        },
    }), /文件发生变化/);
});

test('拒绝目标嵌套在输入中及越界入口', async t => {
    const { root, sourceRoot } = await fixture(t);
    await assert.rejects(createImmutableSnapshot({ sourceRoot, destination: path.join(sourceRoot, 'src', 'snapshot'), entries: ['src'] }), /目标不能/);
    if (process.platform === 'win32') {
        await assert.rejects(createImmutableSnapshot({ sourceRoot, destination: path.join(sourceRoot, 'SRC', 'nested', 'snapshot'), entries: ['src'] }), /目标不能/);
        await assert.rejects(fs.stat(path.join(sourceRoot, 'src', 'nested')), { code: 'ENOENT' });
    }
    await assert.rejects(createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'snapshot'), entries: ['../outside'] }), /越界/);
});

test('已有目标不会被覆盖，入口父目录不能穿过链接', async t => {
    const { root, sourceRoot } = await fixture(t);
    const destination = path.join(root, 'existing');
    await fs.mkdir(destination);
    await fs.writeFile(path.join(destination, 'keep'), 'keep');
    await assert.rejects(createImmutableSnapshot({ sourceRoot, destination, entries: ['src'] }), { code: 'EEXIST' });
    assert.equal(await fs.readFile(path.join(destination, 'keep'), 'utf8'), 'keep');
    await fs.symlink(path.join(sourceRoot, 'src'), path.join(sourceRoot, 'linked'), 'junction');
    await assert.rejects(createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'other'), entries: ['linked/lazy.ts'] }), /符号链接/);
});

test('真实 Vite 服务在工作区修改后仍从各自副本读取未加载的模块和资源', async t => {
    const { createServer } = await import('vite');
    const { root, sourceRoot } = await fixture(t);
    await fs.mkdir(path.join(sourceRoot, 'public'));
    await fs.writeFile(path.join(sourceRoot, 'src', 'data.json'), '{"version":"old"}');
    await fs.writeFile(path.join(sourceRoot, 'public', 'asset.txt'), 'old asset');
    const oldSnapshot = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'old'), entries: ['src', 'public'] });
    const start = async snapshot => {
        const server = await createServer({
            configFile: false,
            root: snapshot.root,
            logLevel: 'silent',
            server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/*'] } },
        });
        await server.listen();
        t.after(() => server.close());
        return `http://127.0.0.1:${server.httpServer.address().port}`;
    };
    const oldUrl = await start(oldSnapshot);
    await fs.writeFile(path.join(sourceRoot, 'src', 'lazy.ts'), 'export default "new"');
    await fs.writeFile(path.join(sourceRoot, 'src', 'style.css'), 'body { color: red }');
    await fs.writeFile(path.join(sourceRoot, 'src', 'data.json'), '{"version":"new"}');
    await fs.writeFile(path.join(sourceRoot, 'public', 'asset.txt'), 'new asset');
    const newSnapshot = await createImmutableSnapshot({ sourceRoot, destination: path.join(root, 'new'), entries: ['src', 'public'] });
    const newUrl = await start(newSnapshot);
    for (const [url, expected] of [[oldUrl, 'old'], [newUrl, 'new']]) {
        for (const file of ['/src/lazy.ts', '/src/data.json', '/asset.txt']) {
            const response = await fetch(url + file);
            assert.equal(response.status, 200);
            assert.match(await response.text(), new RegExp(expected));
        }
    }
    assert.match(await (await fetch(`${oldUrl}/src/style.css`)).text(), /old css/);
    assert.match(await (await fetch(`${newUrl}/src/style.css`)).text(), /color: red/);
});
