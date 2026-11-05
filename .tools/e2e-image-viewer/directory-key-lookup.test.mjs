import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { directoryIdFromRealPath, recoverDirectoryByKey } from './directory-key-lookup.mjs';

test('旧目录身份不变，恢复期间事件循环可响应，同键查找合并且失败后可重新恢复', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'viewer-key-test-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('viewer-key-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const target = path.join(root, '层级', '截图');
  await mkdir(target, { recursive: true });
  const real = await realpath(target);
  const key = createHash('sha1').update(real.toLowerCase()).digest('hex').slice(0, 12);
  assert.equal(directoryIdFromRealPath(real), key);
  const first = recoverDirectoryByKey(key, [root]);
  assert.strictEqual(recoverDirectoryByKey(key, [root]), first);
  let settled = false;
  first.then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, '遍历未完成时事件循环仍能处理其它工作');
  assert.equal(await first, real);
  const missing = directoryIdFromRealPath(path.join(real, '新增'));
  await assert.rejects(recoverDirectoryByKey(missing, [root]), /找不到目录 key/);
  await mkdir(path.join(real, '新增'));
  assert.equal(await recoverDirectoryByKey(missing, [root]), await realpath(path.join(real, '新增')));
});
