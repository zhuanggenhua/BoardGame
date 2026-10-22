import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobile.css', import.meta.url), 'utf8');
const rule = selector => html.slice(html.indexOf(selector + ' {')).split('}')[0];
test('手机详情默认让开房间空间，介绍与次要操作仍可展开', () => {
 assert.match(html, /data-compact-toggle="summary"/);
 assert.match(css, /\.details-hero:not\(\.is-expanded\) \.details-desc/);
 assert.match(css, /\.details-hero:not\(\.is-expanded\) \.details-secondary/);
 assert.match(html, /aria-controls="\$\{prefix\}-description \$\{prefix\}-secondary \$\{prefix\}-author"/);
 assert.match(html, /function toggleCompactSection\(button\)/);
});
test('好友降为可展开区，房间不被折叠', () => {
 assert.match(html, /data-compact-toggle="friends"/);
 assert.match(css, /\.friends-section:not\(\.is-expanded\) \.side-scroll/);
 assert.doesNotMatch(css, /\[data-testid=["']?library-rooms[^}]*display:\s*none/);
});
test('收藏入口展开/收起不会丢失介绍、人数、房间或返回位置', async () => {
 const dom = new JSDOM(html, {
  url: 'https://example.test/design/home/', runScripts: 'dangerously',
  beforeParse(window) {
   window.matchMedia = () => ({ matches: true });
   window.fetch = async () => ({ ok: false });
  },
 });
 try {
  await new Promise(resolve => setTimeout(resolve, 0));
  const doc = dom.window.document;
  doc.querySelector('[data-view="library"]').click();
  const library = doc.querySelector('.lib-home');
  assert.ok(library);
  assert.equal(doc.querySelectorAll('.owned-tile').length, 8);
  library.scrollTop = 120;
  doc.querySelector('.owned-tile[data-select="smashup"]').click();
  const section = doc.querySelector('.library-summary');
  const toggle = section.querySelector('[data-compact-toggle="summary"]');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  const description = section.querySelector('.details-desc').textContent;
  assert.ok(description.includes('阵营'));
  assert.deepEqual([...section.querySelectorAll('.player-count')].map(el => el.textContent), ['2', '3', '4']);
  assert.equal(section.querySelector('.player-count.is-best').textContent, '3');
  assert.equal(section.querySelectorAll('button.player-count').length, 0);
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(section.classList.contains('is-expanded'), true);
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(section.querySelector('.details-desc').textContent, description);
  assert.equal(doc.querySelectorAll('[data-testid="library-rooms"] .room-row').length, 4);
  const friends = doc.querySelector('[data-compact-toggle="friends"]');
  friends.click();
  assert.equal(friends.getAttribute('aria-expanded'), 'true');
  assert.equal(doc.querySelectorAll('[data-testid="library-friends"] .friend').length, 6);
  doc.querySelector('[data-library-back]').click();
  assert.equal(doc.querySelector('.lib-home').scrollTop, 120);
 } finally { dom.window.close(); }
});
test('收藏列表独立滚动且不压缩条目', () => {
 assert.match(rule('.list-rows'), /overflow-y:\s*auto/);
 assert.match(rule('.list-row'), /flex-shrink:\s*0/);
});
test('中屏收藏采用四列自然高度，保留卡面比例', () => {
 const mid = html.match(/@media \(min-width: 1024px\) and \(max-width: 1599px\)([\s\S]*?)<\/style>/)?.[1] ?? '';
 assert.match(mid, /\.owned-grid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
 assert.match(mid, /\.owned-art \{ height: auto; aspect-ratio: 3 \/ 4;/);
 assert.match(mid, /\.lib-home \{[^}]*overflow-y: auto/);
});
test('两处房间加入共享相同可用性判定', () => {
 const match = html.match(/function roomJoinButton\(g, room\) \{([\s\S]*?)\n    \}/);
 assert.ok(match);
 const join = new Function('g', 'room', match[1]);
 assert.match(join({id:'game'}, {count:4,seats:4}), /disabled[^>]*>已满/);
 assert.doesNotMatch(join({id:'game'}, {count:4,seats:4}), /data-enter/);
 assert.match(join({id:'game'}, {count:2,seats:4}), /data-enter="game"[^>]*>加入/);
 assert.equal((html.match(/\$\{roomJoinButton\(g, room\)\}/g) ?? []).length, 2);
});
test('详情保留新结构并受中屏视口约束', () => {
 assert.match(rule('.modal'), /width:\s*min\(1280px, calc\(100vw - 48px\)\)/);
 assert.match(html, /grid-template-areas: "cover copy close" "cover actions actions"/);
 assert.match(html, /class="[^"]*\bdetails-secondary\b[^"]*"/);
});
test('手机保留游戏优先、搜索排序和返回位置语义', () => {
 assert.match(css, /\.owned-grid \{ grid-template-columns: repeat\(3,/);
 assert.match(css, /\.whats-new \{ order: 2;/);
 assert.match(css, /\.my-games \{ order: 1;/);
 assert.match(html, /id="librarySearch"/);
 assert.match(html, /id="librarySort"/);
 assert.match(html, /scrollTop = state.libraryScrollTop/);
 assert.match(html, /data-library-back="1"/);
});
test('低高度桌面游戏页允许整页滚动，房间区不被均分压成窄缝', () => {
 const low = html.match(/@media \(min-width: 1024px\) and \(max-height: 800px\)([\s\S]*?)<\/style>/)?.[1] ?? '';
 assert.match(low, /\.steam-page \{ display: block; overflow-y: auto/);
 assert.match(low, /\.steam-cover \{ height: 220px/);
 assert.match(low, /\.steam-side \.side-card, \.steam-side \.side-scroll \{ flex: none/);
});
