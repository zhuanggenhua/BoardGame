import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobile.css', import.meta.url), 'utf8');
const rule = selector => html.slice(html.indexOf(selector + ' {')).split('}')[0];
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
