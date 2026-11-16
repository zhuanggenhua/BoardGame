import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getPublishedWebPorts, retainFingerprintedAssets, verifyRetainedAssetsMount } from './preserve-web-assets.mjs';

test('预检使用 Compose 中 web 服务实际发布的 TCP / UDP 端口', () => {
  const config = ports => ({ services: { web: { ports } } });
  assert.deepEqual(getPublishedWebPorts(config([
    { target: 80, published: '18081', protocol: 'tcp' },
    { target: 80, published: '18081', protocol: 'tcp' },
    { target: 9000, published: '19000', protocol: 'udp' },
    { target: 8080, protocol: 'tcp' },
  ])), ['tcp 18081', 'udp 19000']);
  assert.throws(() => getPublishedWebPorts(config([{ target: 80, published: '70000' }])), /无法检查/);
  assert.throws(() => getPublishedWebPorts({ services: {} }), /缺少 web/);
});

test('部署配置必须把保留目录以只读方式挂载到 web 容器', () => {
  const destination = path.resolve('runtime/retained-web-assets');
  const makeConfig = volume => ({ services: { web: { volumes: volume ? [volume] : [] } } });
  const valid = { type: 'bind', source: destination, target: '/app/retained-web-assets', read_only: true };

  assert.doesNotThrow(() => verifyRetainedAssetsMount(makeConfig(valid), destination));
  assert.throws(() => verifyRetainedAssetsMount(makeConfig(), destination), /历史资源挂载/);
  assert.throws(() => verifyRetainedAssetsMount(makeConfig({ ...valid, source: path.resolve('runtime/other') }), destination), /历史资源挂载/);
  assert.throws(() => verifyRetainedAssetsMount(makeConfig({ ...valid, read_only: false }), destination), /历史资源挂载/);
});

test('保留旧版指纹资源，不覆盖既有内容且不保留无指纹配置', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'boardgame-web-archive-'));
  try {
    const source = path.join(root, 'source');
    const dest = path.join(root, 'dest');
    await Promise.all([mkdir(source), mkdir(dest)]);
    await writeFile(path.join(source, 'HomeEntry-uYa2FQtX.css'), 'old css');
    await writeFile(path.join(source, 'index-AbCd1234.js'), 'old script');
    await writeFile(path.join(source, 'config.json'), 'not versioned');
    await retainFingerprintedAssets(source, dest);
    await retainFingerprintedAssets(source, dest);
    assert.equal(await readFile(path.join(dest, 'HomeEntry-uYa2FQtX.css'), 'utf8'), 'old css');
    await assert.rejects(readFile(path.join(dest, 'config.json')), { code: 'ENOENT' });
    await writeFile(path.join(source, 'index-AbCd1234.js'), 'different content');
    await assert.rejects(retainFingerprintedAssets(source, dest), /指纹资源内容冲突/);
    assert.equal(await readFile(path.join(dest, 'index-AbCd1234.js'), 'utf8'), 'old script');
  } finally { await rm(root, { recursive: true, force: true }); }
});
