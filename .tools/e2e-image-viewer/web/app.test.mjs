import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('目录读取未完成时，自动刷新和手动刷新复用同一请求，完成后仍能刷新', async (t) => {
  const dom = new JSDOM(html, { url: 'http://127.0.0.1/?key=fixture', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const intervals = [];
  const requests = [];
  dom.window.setInterval = callback => { intervals.push(callback); return 1; };
  dom.window.requestAnimationFrame = () => 1;
  dom.window.cancelAnimationFrame = () => {};
  dom.window.ResizeObserver = class { observe() {} disconnect() {} };
  dom.window.fetch = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  dom.window.eval(source);
  assert.equal(requests.length, 1);
  for (let index = 0; index < 5; index++) intervals.forEach(callback => callback());
  dom.window.document.querySelector('#refresh').click();
  assert.equal(requests.length, 1, '慢请求期间不能积累自动或手动刷新请求');
  requests[0].resolve({ ok: true, json: async () => ({ directory: '/fixture', directoryTitle: '已读取的截图', items: [], indexMatchedCount: 0 }) });
  await new Promise(resolve => setImmediate(resolve));
  intervals.forEach(callback => callback());
  assert.equal(requests.length, 2, '已完成后继续正常刷新');
  assert.equal(dom.window.document.querySelector('#directory').textContent, '已读取的截图');
  requests[1].reject(new Error('测试断网'));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(dom.window.document.querySelector('#summary').textContent, /测试断网/);
  intervals.forEach(callback => callback());
  assert.equal(requests.length, 3, '失败后仍释放读取并允许重试');
});
