import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('中文索引、画布和详情的共享标题始终包含当前图组序号', () => {
  const source = readFileSync(new URL('./web/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('const displayTitle =');
  const end = source.indexOf('const displayDescription', start);
  const items = [{ displayTitle: '手机收藏库', relativePath: '02-library.png' }, { displayTitle: '桌面详情', relativePath: '06-detail.png' }];
  const context = vm.createContext({ items });
  vm.runInContext(source.slice(start, end) + ';globalThis.titleFor = displayTitle;', context);
  assert.equal(context.titleFor(items[0]), '01 · 手机收藏库');
  assert.equal(context.titleFor(items[1]), '02 · 桌面详情');
});

test('已有文件序号不会与查看器序号重复，筛选后仍使用当前顺序', () => {
  const source = readFileSync(new URL('./web/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('const displayTitle =');
  const end = source.indexOf('const displayDescription', start);
  const items = [{ displayTitle: '14 · 手机支持作者', relativePath: '14-手机支持作者.png' }, { displayTitle: '02-登录', relativePath: '02-登录.png' }];
  const context = vm.createContext({ items });
  vm.runInContext(source.slice(start, end) + ';globalThis.titleFor = displayTitle;', context);
  assert.equal(context.titleFor(items[0]), '01 · 手机支持作者');
  assert.equal(context.titleFor(items[1]), '02 · 登录');
});
