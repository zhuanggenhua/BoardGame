import {assertDetailsActions,assertDetailsLobby} from './details-layout.mjs';
import { captureMobile, MOBILE_SHOTS } from './mobile-capture.mjs';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const root = path.resolve('artifacts/home-platform-v3-neo-brutalist');
const origin = process.env.HOME_V3_ORIGIN || 'http://127.0.0.1:7788';
const html = `${origin}/index.html`;
const outDir = path.join(root, 'exports');
fs.mkdirSync(outDir, { recursive: true });

const PC_SHOTS = [
  '01-收藏库主页.png',
  '01b-收藏库悬停.png',
  '02-收藏库游戏页.png',
  '02b-收藏库排行榜.png',
  '02c-收藏库规则概览.png',
  '03-切发现再回收藏库.png',
  '04-点主页.png',
  '05-发现网格.png',
  '05b-发现悬停.png',
  '06-游戏详情.png',
  '06b-作者弹窗.png',
  '06c-销毁确认.png',
  '06d-创建房间.png',
  '07-上传页.png',
  '07b-上传新游戏.png',
  '08-个人主页.png',
];
const ALL_SHOTS = [...PC_SHOTS, ...MOBILE_SHOTS];

const shotIdOf = (name) => name.replace(/\.png$/i, '').split('-')[0];

const parseShotFilter = (argv = process.argv, envValue = process.env.HOME_V3_SHOTS) => {
  const eq = argv.find((item) => item.startsWith('--only='));
  const flagIndex = argv.indexOf('--only');
  const raw = eq ? eq.slice('--only='.length) : (flagIndex >= 0 ? argv[flagIndex + 1] : envValue);
  if (!raw || raw === 'all') return null;
  if (raw.startsWith('--')) throw new Error('--only requires a comma-separated shot list');
  const tokens = raw.split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  const knownIds = new Set(ALL_SHOTS.map(shotIdOf));
  const knownNames = new Set(ALL_SHOTS);
  for (const token of tokens) {
    if (!knownIds.has(token) && !knownNames.has(token)) {
      throw new Error(`unknown shot filter: ${token}`);
    }
  }
  return new Set(tokens);
};

const shotFilter = parseShotFilter();
if (process.argv.includes('--print-filter')) {
  console.log(JSON.stringify({
    mode: shotFilter ? 'incremental' : 'all',
    shots: shotFilter ? [...shotFilter] : ALL_SHOTS.map(shotIdOf),
  }));
  process.exit(0);
}

const stale = [
  '01-我的首页.png',
  '02-首页切游戏.png',
  '03-无最近游玩.png',
  '04-发现网格.png',
  '04b-发现悬停.png',
  '05-游戏详情.png',
  '06-收藏库.png',
  '07-收藏库游戏页.png',
  '07-上传弹窗.png',
  '08-上传弹窗.png',
];
for (const name of stale) {
  const dest = path.join(outDir, name);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(20000);

await page.goto(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => Promise.all([...document.images].map((img) => (
  img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
))));
await page.waitForSelector('[data-testid="library-hub"]');
await page.waitForTimeout(300);

const layout = await page.evaluate(() => {
  const navs = [...document.querySelectorAll('.chrome .nav .nav-btn')].map((el) => el.textContent.trim());
  const list = document.querySelector('[data-testid="library-list"]')?.getBoundingClientRect();
  const names = [...document.querySelectorAll('.list-row:not(.is-hub) .list-name')].map((el) => el.textContent.trim());
  const hours = [...document.querySelectorAll('.list-hours')].map((el) => el.textContent.trim());
  const text = document.querySelector('#homeBody')?.innerText || '';
  const owned = [...document.querySelectorAll('.owned-tile')].map((el) => {
    const art = el.querySelector('.owned-art')?.getBoundingClientRect();
    const name = el.querySelector('.owned-name')?.getBoundingClientRect();
    const hoursChip = el.querySelector('.owned-hours')?.getBoundingClientRect();
    const ratio = art && art.height ? art.width / art.height : 0;
    return {
      name: el.querySelector('.owned-name')?.textContent.trim() || '',
      nameInside: Boolean(art && name && name.top >= art.top - 1 && name.bottom <= art.bottom + 1),
      hoursInside: Boolean(art && hoursChip && hoursChip.top >= art.top - 1 && hoursChip.bottom <= art.bottom + 1),
      captionBelow: Boolean(art && name && name.top >= art.bottom - 1),
      ratio: Number(ratio.toFixed(3)),
      w: Math.round(art?.width || 0),
      h: Math.round(art?.height || 0),
    };
  });
  const news = [...document.querySelectorAll('.news-card')].map((el) => {
    const art = el.getBoundingClientRect();
    const name = el.querySelector('.news-veil b')?.getBoundingClientRect();
    const desc = el.querySelector('.news-veil p')?.getBoundingClientRect();
    const ratio = art.height ? art.width / art.height : 0;
    return {
      name: el.querySelector('.news-veil b')?.textContent.trim() || '',
      ver: el.querySelector('.news-veil em')?.textContent.trim() || '',
      desc: el.querySelector('.news-veil p')?.textContent.trim() || '',
      nameInside: Boolean(name && name.top >= art.top - 1 && name.bottom <= art.bottom + 1),
      descInside: Boolean(desc && desc.top >= art.top - 1 && desc.bottom <= art.bottom + 1),
      hasChip: Boolean(el.querySelector('.news-chip')),
      hasOuterDate: Boolean(el.querySelector('.news-date')),
      ratio: Number(ratio.toFixed(3)),
      w: Math.round(art.width),
      h: Math.round(art.height),
    };
  });
  return {
    navs,
    activeNav: document.querySelector('.chrome .nav .nav-btn.is-active')?.textContent.trim() || '',
    hasHomeRow: Boolean(document.querySelector('.list-row.is-hub.is-on')),
    hasNews: text.includes('新情报速递'),
    hasOwned: text.includes('我的游戏'),
    newsCount: news.length,
    news,
    newsArrows: document.querySelectorAll('[data-news-shift]').length,
    ownedCount: owned.length,
    owned,
    listNames: names,
    hours,
    listWidth: list?.width ?? 0,
    hasDock: Boolean(document.querySelector('.dock')),
    logoSvg: Boolean(document.querySelector('.logo svg')),
    bellSvg: Boolean(document.querySelector('.bell svg path')),
    matchVisible: Boolean(document.querySelector('[data-testid="home-active-match-banner"]:not([hidden])')),
    hasHomeNav: navs.includes('我的首页'),
    hasCarousel: Boolean(document.querySelector('[data-testid="home-recent-carousel"]')),
    uploadIsPage: Boolean(document.querySelector('[data-view="upload"]')),
    uploadIsModal: Boolean(document.querySelector('[data-open="upload"]')),
  };
});
console.log('layout', layout);
if (layout.hasHomeNav) throw new Error('我的首页 still in nav');
if (layout.hasCarousel) throw new Error('homepage carousel still present');
if (layout.activeNav !== '收藏库') throw new Error(`default nav is ${layout.activeNav}`);
if (JSON.stringify(layout.navs) !== JSON.stringify(['发现', '收藏库', '上传'])) {
  throw new Error(`nav ${JSON.stringify(layout.navs)}`);
}
if (!layout.hasHomeRow) throw new Error('library did not default to hub');
if (!layout.hasNews || !layout.hasOwned) throw new Error(`library hub missing: ${JSON.stringify(layout)}`);
if (layout.newsCount < 3) throw new Error(`news cards ${layout.newsCount}`);
if (layout.newsArrows < 2) throw new Error('news arrows missing');
if (layout.news.some((n) => !n.name || !n.ver || !n.desc || !n.nameInside || !n.descInside || n.hasChip || n.hasOuterDate)) {
  throw new Error(`news overlay missing: ${JSON.stringify(layout.news)}`);
}
if (layout.news.some((n) => n.ratio < 1.6 || n.ratio > 1.9)) {
  throw new Error(`news covers not landscape 16:9: ${JSON.stringify(layout.news.map((n) => ({ name: n.name, ratio: n.ratio, w: n.w, h: n.h })))}`);
}
if (layout.ownedCount < 6) throw new Error(`owned tiles ${layout.ownedCount}`);
if (layout.owned.some((t) => !t.name || !t.nameInside || !t.hoursInside || t.captionBelow)) {
  throw new Error(`owned names not inside cover: ${JSON.stringify(layout.owned)}`);
}
if (layout.owned.some((t) => t.ratio < 0.68 || t.ratio > 0.85)) {
  throw new Error(`owned covers not portrait rectangles: ${JSON.stringify(layout.owned.map((t) => ({ name: t.name, ratio: t.ratio, w: t.w, h: t.h })))}`);
}
if (layout.listNames[0] !== '大杀四方') throw new Error(`list not recent-first: ${JSON.stringify(layout.listNames)}`);
if (!layout.hours.some((h) => h.includes('小时'))) throw new Error(`playtime missing: ${JSON.stringify(layout.hours)}`);
if (layout.listWidth < 280) throw new Error(`steam list too narrow: ${layout.listWidth}`);
if (layout.hasDock) throw new Error('tools dock still present');
if (!layout.logoSvg || !layout.bellSvg) throw new Error('missing svg icons');
if (!layout.matchVisible) throw new Error('active match overlay missing');
if (!layout.uploadIsPage) throw new Error('upload nav is not a page');
if (layout.uploadIsModal) throw new Error('upload still opens as modal');

const matchHits = async (selector) => page.evaluate((sel) => {
  const match = document.querySelector('[data-testid="home-active-match-banner"]:not([hidden]) .match-card');
  const nodes = [...document.querySelectorAll(sel)];
  if (!match || !nodes.length) return { overlap: false, hits: 0 };
  const mb = match.getBoundingClientRect();
  const hits = nodes.filter((el) => {
    const b = el.getBoundingClientRect();
    return b.bottom > mb.top + 4 && b.top < mb.bottom && b.left < mb.right && b.right > mb.left;
  }).map((el) => el.innerText.trim().slice(0, 24));
  return { overlap: hits.length > 0, hits, matchTop: Math.round(mb.top) };
}, selector);
const hubOverlap = await matchHits('.owned-tile .owned-art');
console.log('hubOverlap', hubOverlap);
if (hubOverlap.overlap) throw new Error(`match overlaps library hub tiles: ${JSON.stringify(hubOverlap)}`);

const shot = async (name, target = page) => {
  const id = shotIdOf(name);
  if (shotFilter && !shotFilter.has(name) && !shotFilter.has(id)) {
    console.log('skip shot', name);
    return;
  }
  const dest = path.join(outDir, name);
  await target.screenshot({ path: dest, fullPage: false });
  console.log('shot', dest);
};

await shot('01-收藏库主页.png');

const smashOwned = page.locator('.owned-tile[data-select="smashup"]');
await smashOwned.hover();
await page.waitForTimeout(280);
const hover = await page.evaluate(() => {
  const tile = document.querySelector('.owned-tile[data-select="smashup"]');
  const detail = tile?.querySelector('.owned-detail');
  const overlay = tile?.querySelector('.owned-overlay');
  const p = detail?.querySelector('p');
  const cs = tile ? getComputedStyle(tile) : null;
  const dcs = detail ? getComputedStyle(detail) : null;
  const pcs = p ? getComputedStyle(p) : null;
  const art = tile?.querySelector('.owned-art')?.getBoundingClientRect();
  const pb = p?.getBoundingClientRect();
  return {
    transform: cs?.transform || '',
    detailOpacity: Number(dcs?.opacity || 0),
    overlayOpacity: overlay ? Number(getComputedStyle(overlay).opacity) : 1,
    text: detail?.innerText || '',
    descLen: (p?.textContent || '').trim().length,
    descH: Math.round(pb?.height || 0),
    artH: Math.round(art?.height || 0),
    artW: Math.round(art?.width || 0),
    clamp: pcs?.webkitLineClamp || '',
    fontSize: pcs?.fontSize || '',
  };
});
console.log('hover', hover);
if (!hover.transform.includes('matrix') || hover.transform === 'none') throw new Error(`owned tile did not lift: ${hover.transform}`);
if (hover.detailOpacity < 0.9) throw new Error(`owned hover detail hidden: ${hover.detailOpacity}`);
if (hover.overlayOpacity > 0.2) throw new Error(`owned name bar still visible on hover: ${hover.overlayOpacity}`);
if (!hover.text.includes('阵营混搭') || !hover.text.includes('小时')) throw new Error(`owned hover missing details: ${hover.text}`);
if (hover.descLen < 40) throw new Error(`owned hover desc too short: ${hover.descLen}`);
if (hover.descH < 90) throw new Error(`owned hover desc too small: ${JSON.stringify(hover)}`);
if (hover.artW / hover.artH > 0.85 || hover.artW / hover.artH < 0.68) throw new Error(`hover art not portrait: ${hover.artW}x${hover.artH}`);
await shot('01b-收藏库悬停.png');
await page.mouse.move(0, 0);
await page.waitForTimeout(200);

await page.locator('.list-row[data-select="smashup"]').click();
await page.waitForSelector('[data-testid="library-game-page"]');
await page.waitForTimeout(200);
const gamePage = await page.evaluate(() => {
  const text = document.querySelector('[data-testid="library-game-page"]')?.innerText || '';
  const cover = document.querySelector('.steam-cover')?.getBoundingClientRect();
  const hub = [...document.querySelectorAll('[data-testid="library-hub-row"] .hub-link')].map((el) => el.textContent.trim());
  const side = document.querySelector('.steam-side')?.innerText || '';
  const panel = document.querySelector('[data-testid="library-game-panel"]')?.innerText || '';
  return {
    selected: document.querySelector('[data-testid="library-game-page"]')?.dataset.selected || '',
    listOn: document.querySelector('.list-row.is-on:not(.is-hub) .list-name')?.textContent.trim() || '',
    hasStart: text.includes('重连进入'),
    hasCreate: text.includes('创建房间'),
    hasInvite: side.includes('邀请'),
    inviteCount: document.querySelectorAll('[data-invite]').length,
    sideScrolls: document.querySelectorAll('.steam-side .side-scroll').length,
    hasFriends: side.includes('玩过的好友'),
    hasRooms: side.includes('当前房间'),
    hasRoomName: side.includes('A3F2') || side.includes('公开桌'),
    hub,
    tabOn: document.querySelector('[data-testid="library-hub-row"] .hub-link.is-on')?.textContent.trim() || '',
    hasBoard: panel.includes('胜') && (panel.includes('衡') || panel.includes('#')),
    hasLog: panel.includes('0.6.47') || panel.includes('基地计分'),
    hasConfigOnHero: [...document.querySelectorAll('.steam-actions .cta-play .btn')].some((el) => el.textContent.includes('配置表')),
    hasFavOnHero: [...document.querySelectorAll('.steam-actions .cta-play .btn')].some((el) => el.textContent.includes('收藏')),
    hasTutorialOnHero: [...document.querySelectorAll('.steam-actions .cta-play .btn')].some((el) => el.textContent.includes('教程')),
    hasFavOnRooms: [...document.querySelectorAll('.side-head .btn')].some((el) => el.textContent.includes('收藏')),
    hasConfigOnRooms: [...document.querySelectorAll('.side-head .btn')].some((el) => el.textContent.includes('配置表')),
    heroRow: (() => {
      const btns = [...document.querySelectorAll('.steam-actions .cta-play .btn')].map((el) => {
        const b = el.getBoundingClientRect();
        return { text: el.textContent.trim(), top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right) };
      });
      const tops = btns.map((b) => b.top);
      let minGap = 99;
      for (let i = 1; i < btns.length; i += 1) minGap = Math.min(minGap, btns[i].left - btns[i - 1].right);
      return {
        btns,
        oneRow: btns.length >= 3 && Math.max(...tops) - Math.min(...tops) <= 2,
        minGap,
      };
    })(),
    sideBottom: Math.round(document.querySelector('.steam-side')?.getBoundingClientRect().bottom || 0),
    bodyPad: document.querySelector('.steam-body') ? getComputedStyle(document.querySelector('.steam-body')).paddingBottom : '',
    sideCards: document.querySelectorAll('.steam-side .side-card').length,
    roomsFirst: side.indexOf('当前房间') >= 0 && side.indexOf('玩过的好友') > side.indexOf('当前房间'),
    coverHeight: cover?.height ?? 0,
    nav: document.querySelector('.chrome .nav .nav-btn.is-active')?.textContent.trim() || '',
    configBtn: (() => {
      const btn = [...document.querySelectorAll('.steam-actions .cta-play .btn')].find((el) => el.textContent.includes('配置表'));
      const svg = btn?.querySelector('svg');
      const br = svg?.getBoundingClientRect();
      return {
        text: btn?.textContent.trim() || '',
        width: Math.round(btn?.getBoundingClientRect().width || 0),
        svgW: Math.round(br?.width || 0),
        svgH: Math.round(br?.height || 0),
      };
    })(),
  };
});
console.log('gamePage', gamePage);
if (gamePage.selected !== 'smashup' || gamePage.listOn !== '大杀四方') {
  throw new Error(`list did not drive page: ${JSON.stringify(gamePage)}`);
}
if (!gamePage.hasStart || gamePage.hasCreate || !gamePage.hasFriends || !gamePage.hasRooms || !gamePage.hasRoomName || !gamePage.hasLog) {
  throw new Error(`library game page missing: ${JSON.stringify(gamePage)}`);
}
if (!gamePage.hasInvite || gamePage.inviteCount < 4 || gamePage.sideScrolls !== 2) {
  throw new Error(`library invite lists ${JSON.stringify(gamePage)}`);
}
if (JSON.stringify(gamePage.hub) !== JSON.stringify(['更新', '评价', '排行榜', '规则概览'])) {
  throw new Error(`hub row ${JSON.stringify(gamePage.hub)}`);
}
if (gamePage.tabOn !== '更新') throw new Error(`default tab ${gamePage.tabOn}`);
if (gamePage.hasBoard) throw new Error(`leaderboard is default: ${JSON.stringify(gamePage)}`);
if (!gamePage.hasTutorialOnHero || !gamePage.hasFavOnHero || !gamePage.hasConfigOnHero || !gamePage.heroRow.oneRow || gamePage.heroRow.minGap < 14) {
  throw new Error(`cover actions not one row: ${JSON.stringify(gamePage.heroRow)}`);
}
if (gamePage.hasFavOnRooms || gamePage.hasConfigOnRooms) throw new Error(`rooms header still has tools: ${JSON.stringify(gamePage)}`);
if (gamePage.bodyPad !== '0px') throw new Error(`steam-body reserved overlay space: ${gamePage.bodyPad}`);
if (gamePage.sideBottom < 1070) throw new Error(`side does not fill right: ${gamePage.sideBottom}`);
if (gamePage.sideCards !== 2) throw new Error(`side cards ${gamePage.sideCards}`);
if (!gamePage.roomsFirst) throw new Error(`rooms not above friends: ${JSON.stringify(gamePage)}`);
if (gamePage.coverHeight > 360 || gamePage.coverHeight < 280) throw new Error(`cover height ${gamePage.coverHeight}`);
if (gamePage.nav !== '收藏库') throw new Error(`game page nav ${gamePage.nav}`);
if (gamePage.configBtn.text !== '配置表' || gamePage.configBtn.svgW > 20 || gamePage.configBtn.svgH > 20 || gamePage.configBtn.width < 90) {
  throw new Error(`config button not readable: ${JSON.stringify(gamePage.configBtn)}`);
}
await shot('02-收藏库游戏页.png');

await page.locator('[data-gametab="leaderboard"]').click();
await page.waitForTimeout(200);
const boardTab = await page.evaluate(() => {
  const panel = document.querySelector('[data-testid="library-game-panel"]')?.innerText || '';
  return {
    tabOn: document.querySelector('[data-testid="library-hub-row"] .hub-link.is-on')?.textContent.trim() || '',
    hasBoard: panel.includes('胜') && (panel.includes('衡') || panel.includes('#')),
  };
});
console.log('boardTab', boardTab);
if (boardTab.tabOn !== '排行榜' || !boardTab.hasBoard) throw new Error(`leaderboard tab ${JSON.stringify(boardTab)}`);
await shot('02b-收藏库排行榜.png');

await page.locator('[data-gametab="rules"]').click();
await page.waitForTimeout(200);
const rulesTab = await page.evaluate(() => {
  const panel = document.querySelector('[data-testid="library-game-panel"]')?.innerText || '';
  return {
    tabOn: document.querySelector('[data-testid="library-hub-row"] .hub-link.is-on')?.textContent.trim() || '',
    hasOriginal: panel.includes('初始设置') && panel.includes('每位玩家选择') && panel.includes('2个派系'),
    hasSummary: panel.includes('规则概览') && panel.includes('混洗成 40'),
    hasConfig: panel.includes('配置表'),
  };
});
console.log('rulesTab', rulesTab);
if (rulesTab.tabOn !== '规则概览' || !rulesTab.hasOriginal || rulesTab.hasSummary || rulesTab.hasConfig) {
  throw new Error(`rules tab ${JSON.stringify(rulesTab)}`);
}
await shot('02c-收藏库规则概览.png');
await page.locator('[data-gametab="changelog"]').click();
await page.waitForTimeout(150);

await page.locator('.chrome .nav [data-view="discover"]').click();
await page.waitForSelector('#grid .tile');
await page.waitForTimeout(150);
await page.locator('.chrome .nav [data-view="library"]').click();
await page.waitForSelector('[data-testid="library-game-page"]');
await page.waitForTimeout(200);
const remembered = await page.evaluate(() => ({
  selected: document.querySelector('[data-testid="library-game-page"]')?.dataset.selected || '',
  hub: Boolean(document.querySelector('[data-testid="library-hub"]')),
  listOn: document.querySelector('.list-row.is-on:not(.is-hub) .list-name')?.textContent.trim() || '',
  nav: document.querySelector('.chrome .nav .nav-btn.is-active')?.textContent.trim() || '',
}));
console.log('remembered', remembered);
if (remembered.hub) throw new Error('收藏库 nav reset to hub');
if (remembered.selected !== 'smashup' || remembered.listOn !== '大杀四方') {
  throw new Error(`did not remember last pick: ${JSON.stringify(remembered)}`);
}
if (remembered.nav !== '收藏库') throw new Error(`remembered nav ${remembered.nav}`);
await shot('03-切发现再回收藏库.png');

await page.locator('.list-row.is-hub').click();
await page.waitForSelector('[data-testid="library-hub"]');
await page.waitForTimeout(200);
const backHub = await page.evaluate(() => ({
  hubOn: Boolean(document.querySelector('.list-row.is-hub.is-on')),
  hasNews: (document.querySelector('#homeBody')?.innerText || '').includes('新情报速递'),
  gamePage: Boolean(document.querySelector('[data-testid="library-game-page"]')),
}));
console.log('backHub', backHub);
if (!backHub.hubOn || !backHub.hasNews || backHub.gamePage) throw new Error(`hub click failed: ${JSON.stringify(backHub)}`);
await shot('04-点主页.png');

await page.locator('.chrome .nav [data-view="discover"]').click();
await page.waitForSelector('#grid .tile');
await page.mouse.move(0, 0);
await page.waitForTimeout(200);
const discover = await page.evaluate(() => {
  const grid = document.querySelector('#grid');
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
  const tiles = [...document.querySelectorAll('#grid .tile')].map((el) => {
    const art = el.querySelector('.art')?.getBoundingClientRect();
    const name = el.querySelector('.tile-name')?.getBoundingClientRect();
    const ratio = art && art.height ? art.width / art.height : 0;
    return {
      name: el.querySelector('.tile-name')?.textContent.trim() || '',
      nameInside: Boolean(art && name && name.top >= art.top - 1 && name.bottom <= art.bottom + 1),
      captionBelow: Boolean(art && name && name.top >= art.bottom - 1),
      ratio: Number(ratio.toFixed(3)),
    };
  });
  return {
    cols,
    tiles: tiles.length,
    names: tiles.filter((t) => t.name).length,
    inside: tiles.filter((t) => t.nameInside).length,
    below: tiles.filter((t) => t.captionBelow).length,
    portrait: tiles.filter((t) => t.ratio >= 0.68 && t.ratio <= 0.85).length,
    sample: tiles.slice(0, 2),
  };
});
console.log('discover', discover);
if (discover.cols !== 6) throw new Error(`discover cols ${discover.cols}`);
if (discover.names !== discover.tiles) throw new Error(`discover names ${discover.names}/${discover.tiles}`);
if (discover.inside !== discover.tiles || discover.below !== 0) throw new Error(`discover names not inside cover: ${JSON.stringify(discover)}`);
if (discover.portrait !== discover.tiles) throw new Error(`discover covers not portrait rectangles: ${JSON.stringify(discover)}`);
const matchOverlap = await page.evaluate(() => {
  const match = document.querySelector('[data-testid="home-active-match-banner"]:not([hidden]) .match-card');
  const tiles = [...document.querySelectorAll('#grid .tile')];
  if (!match || !tiles.length) return { overlap: false };
  const mb = match.getBoundingClientRect();
  const hits = tiles.filter((el) => {
    const b = el.getBoundingClientRect();
    return b.bottom > mb.top + 4 && b.top < mb.bottom && b.left < mb.right && b.right > mb.left;
  }).length;
  return { overlap: hits > 0, hits, matchTop: Math.round(mb.top), tileBottom: Math.round(Math.max(...tiles.map((el) => el.getBoundingClientRect().bottom))) };
});
console.log('matchOverlap', matchOverlap);
if (matchOverlap.overlap) throw new Error(`match overlaps discover tiles: ${JSON.stringify(matchOverlap)}`);
await shot('05-发现网格.png');

const smash = page.locator('.tile[data-game="smashup"]');
await smash.hover();
await page.waitForTimeout(200);
const dHover = await page.evaluate(() => {
  const tile = document.querySelector('.tile[data-game="smashup"]');
  const veil = tile?.querySelector('.tile-veil');
  const p = veil?.querySelector('p');
  const pb = p?.getBoundingClientRect();
  const art = tile?.querySelector('.art')?.getBoundingClientRect();
  return {
    opacity: veil ? Number(getComputedStyle(veil).opacity) : 0,
    desc: p?.textContent?.trim() || '',
    descH: Math.round(pb?.height || 0),
    ratio: art && art.height ? Number((art.width / art.height).toFixed(3)) : 0,
  };
});
console.log('discoverHover', dHover);
if (dHover.opacity < 0.9) throw new Error(`discover hover veil hidden: ${JSON.stringify(dHover)}`);
if (!dHover.desc.includes('阵营混搭')) throw new Error(`discover hover desc missing: ${dHover.desc}`);
if (dHover.descH < 80) throw new Error(`discover hover desc too small: ${JSON.stringify(dHover)}`);
if (dHover.ratio > 0.85 || dHover.ratio < 0.68) throw new Error(`discover hover not portrait: ${JSON.stringify(dHover)}`);
await shot('05b-发现悬停.png');

await smash.click();
await page.waitForSelector('[data-testid="game-details-modal-root"]');
await page.waitForTimeout(200);
const details = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="game-details-modal-root"]');
  const cover = root?.querySelector('[data-testid="game-details-cover"]')?.getBoundingClientRect();
  const title = root?.querySelector('[data-testid="game-details-title"]')?.getBoundingClientRect();
  const descEl = root?.querySelector('[data-testid="game-details-description"]');
  const author = root?.querySelector('.author-btn');
  const tabs = [...root?.querySelectorAll('[data-testid="game-details-tab-row"] .tab') || []].map((el) => el.textContent.trim());
  const radius = author ? getComputedStyle(author).borderRadius : '';
  const descCs = descEl ? getComputedStyle(descEl) : null;
  const text = root?.innerText || '';
  return {
    title: root?.querySelector('[data-testid="game-details-title"]')?.textContent.trim() || '',
    desc: descEl?.textContent.trim() || '',
    descSize: descCs?.fontSize || '',
    descClamp: descCs?.webkitLineClamp || '',
    tabs,
    hasCreate: text.includes('创建房间'),
    hasReconnect: text.includes('重连进入'),
    ctaPlay: Boolean(root?.querySelector('.cta-play')),
    ctaMeta: Boolean(root?.querySelector('.cta-meta')),
    hasFav: [...root?.querySelectorAll('.details-cta .btn') || []].some((el) => el.textContent.includes('收藏')),
    hasTutorial: [...root?.querySelectorAll('.details-cta .btn') || []].some((el) => el.textContent.includes('教程')),
    hasConfigOnHero: [...root?.querySelectorAll('.details-cta .btn') || []].some((el) => el.textContent.includes('配置表')),
    hasAuthor: text.includes('电子化作者'),
    heroRow: (() => {
      const btns = [...root?.querySelectorAll('.details-cta .btn') || []].map((el) => {
        const b = el.getBoundingClientRect();
        return { text: el.textContent.trim(), top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right), bottom: Math.round(b.bottom) };
      });
      const tops = btns.map((b) => b.top);
      let minGap = 99;
      for (let i = 1; i < btns.length; i += 1) minGap = Math.min(minGap, btns[i].left - btns[i - 1].right);
      const author = root?.querySelector('.author-btn')?.getBoundingClientRect();
      return {
        btns,
        oneRow: btns.length >= 3 && Math.max(...tops) - Math.min(...tops) <= 2,
        minGap,
        authorAbove: Boolean(author && author.bottom <= Math.min(...tops) - 8),
      };
    })(),
    roomGap: (() => {
      const row = root?.querySelector('.details-main .room-actions');
      return row ? Number.parseFloat(getComputedStyle(row).gap) || 0 : 0;
    })(),
    hasHours: Boolean(root?.querySelector('[data-testid="game-details-playtime"]')?.textContent.includes('小时')),
    hasEst: (root?.querySelector('[data-testid="game-details-playtime"]')?.textContent || '').includes('估计') &&
      (root?.querySelector('[data-testid="game-details-playtime"]')?.textContent || '').includes('分钟'),
    playerChips: [...root?.querySelectorAll('.stat-chip') || []].filter((el) => /人/.test(el.textContent)).length,
    playerSquares: root?.querySelectorAll('[data-testid="game-details-player-recommendation"] .player-sq').length || 0,
    hasPlayers: Boolean(root?.querySelector('[data-testid="game-details-player-recommendation"]')),
    titleBeside: Boolean(cover && title && title.left >= cover.right - 4),
    ratio: cover && cover.height ? Number((cover.width / cover.height).toFixed(3)) : 0,
    w: Math.round(cover?.width || 0),
    h: Math.round(cover?.height || 0),
    authorRadius: radius,
    close: Boolean(root?.querySelector('[data-testid="game-details-close-button"]')),
    tutorialVisible: (() => {
      const btn = [...root.querySelectorAll('.details-cta .btn, .author-btn')].find((el) => el.textContent.includes('教程'));
      const box = root.getBoundingClientRect();
      const b = btn?.getBoundingClientRect();
      return Boolean(b && b.bottom <= box.bottom + 1 && b.height > 20);
    })(),
    authorVisible: (() => {
      const btn = root.querySelector('.author-btn');
      const box = root.getBoundingClientRect();
      const b = btn?.getBoundingClientRect();
      return Boolean(b && b.bottom <= box.bottom + 1 && b.height > 20);
    })(),
  };
});
console.log('details', details);
if (details.title !== '大杀四方' || !details.desc.includes('阵营混搭')) throw new Error(`details copy ${JSON.stringify(details)}`);
if (JSON.stringify(details.tabs) !== JSON.stringify(['在线大厅', '更新', '评价', '排行榜', '规则概览'])) {
  throw new Error(`details tabs ${JSON.stringify(details.tabs)}`);
}
if (details.hasCreate || !details.hasReconnect || !details.ctaPlay || !details.ctaMeta || !details.hasFav || !details.hasTutorial || !details.hasConfigOnHero || !details.hasAuthor || !details.hasPlayers || !details.close) {
  throw new Error(`details missing chrome: ${JSON.stringify(details)}`);
}
if (!details.heroRow.oneRow || details.heroRow.minGap < 14 || !details.heroRow.authorAbove) {
  throw new Error(`details actions cramped: ${JSON.stringify(details.heroRow)}`);
}
if (details.roomGap < 12) throw new Error(`details room actions cramped: ${details.roomGap}`);
if (!details.tutorialVisible || !details.authorVisible) {
  throw new Error(`details actions clipped: ${JSON.stringify(details)}`);
}
if (details.hasHours || !details.hasEst) throw new Error(`details playtime ${JSON.stringify(details)}`);
if (details.playerChips > 0 || details.playerSquares !== 0) throw new Error(`details player UI duplicated: ${JSON.stringify(details)}`);
if (Number.parseFloat(details.descSize) < 16 || details.descClamp === '4') {
  throw new Error(`details desc not primary: ${JSON.stringify(details)}`);
}
if (!details.titleBeside || details.ratio < 0.68 || details.ratio > 0.85 || details.w < 140) {
  throw new Error(`details cover layout: ${JSON.stringify(details)}`);
}
if (details.authorRadius && details.authorRadius !== '0px') throw new Error(`author still rounded: ${details.authorRadius}`);
await assertDetailsActions(page);
await assertDetailsLobby(page);
await shot('06-游戏详情.png');

await page.locator('[data-tab="rules"]').click();
await page.waitForTimeout(150);
const detailsRules = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="game-details-modal-root"]');
  const text = root?.innerText || '';
  return {
    hasOriginal: text.includes('初始设置') && text.includes('每位玩家选择') && text.includes('2个派系'),
    hasConfig: text.includes('配置表'),
  };
});
console.log('detailsRules', detailsRules);
if (!detailsRules.hasOriginal || !detailsRules.hasConfig) throw new Error(`details rules ${JSON.stringify(detailsRules)}`);

await page.locator('.author-btn').click();
await page.waitForSelector('[data-testid="game-details-author-modal"]');
await page.waitForTimeout(150);
const authorModal = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="game-details-author-modal"]');
  const text = el?.innerText || '';
  const btn = el?.querySelector('.close-x');
  const mark = btn?.querySelector('svg') || btn;
  const bb = btn?.getBoundingClientRect();
  const mb = mark?.getBoundingClientRect();
  const dx = bb && mb ? Math.abs((mb.left + mb.right) / 2 - (bb.left + bb.right) / 2) : 99;
  const dy = bb && mb ? Math.abs((mb.top + mb.bottom) / 2 - (bb.top + bb.bottom) / 2) : 99;
  return {
    visible: Boolean(el),
    hasKicker: text.includes('电子化作者'),
    hasWork: text.includes('大杀四方'),
    hasClose: text.includes('关闭'),
    hasX: Boolean(btn),
    square: Boolean(bb && Math.abs(bb.width - bb.height) <= 1),
    centered: dx <= 1.5 && dy <= 1.5,
    dx: Number(dx.toFixed(2)),
    dy: Number(dy.toFixed(2)),
  };
});
console.log('authorModal', authorModal);
if (!authorModal.visible || !authorModal.hasKicker || !authorModal.hasWork || authorModal.hasClose || !authorModal.hasX || !authorModal.square || !authorModal.centered) {
  throw new Error(`author modal ${JSON.stringify(authorModal)}`);
}
await shot('06b-作者弹窗.png');
await page.locator('[data-close="author"]').click();
await page.waitForTimeout(120);

await page.locator('[data-tab="lobby"]').click();
await page.waitForTimeout(120);
await page.locator('.room-btn[data-destroy="smashup"]').click();
await page.waitForSelector('.confirm');
await page.waitForTimeout(150);
const confirmModal = await page.evaluate(() => {
  const el = document.querySelector('.confirm');
  const text = el?.innerText || '';
  const btn = el?.querySelector('.close-x');
  const mark = btn?.querySelector('svg') || btn;
  const bb = btn?.getBoundingClientRect();
  const mb = mark?.getBoundingClientRect();
  const dx = bb && mb ? Math.abs((mb.left + mb.right) / 2 - (bb.left + bb.right) / 2) : 99;
  const dy = bb && mb ? Math.abs((mb.top + mb.bottom) / 2 - (bb.top + bb.bottom) / 2) : 99;
  const yes = document.querySelector('#confirmYes')?.getBoundingClientRect();
  const sr = el?.getBoundingClientRect();
  const cx = yes && sr ? Math.abs((yes.left + yes.right) / 2 - (sr.left + sr.right) / 2) : 99;
  const footGap = yes && sr ? sr.bottom - yes.bottom : 99;
  return {
    visible: Boolean(el) && el.offsetParent !== null,
    hasTitle: text.includes('销毁当前房间'),
    hasYes: text.includes('销毁'),
    hasNo: text.includes('取消'),
    hasX: Boolean(btn),
    square: Boolean(bb && Math.abs(bb.width - bb.height) <= 1),
    centered: dx <= 1.5 && dy <= 1.5,
    confirmCentered: cx <= 6,
    confirmNearBottom: footGap >= 8 && footGap <= 40,
    dx: Number(dx.toFixed(2)),
    dy: Number(dy.toFixed(2)),
    cx: Number(cx.toFixed(2)),
    footGap: Number(footGap.toFixed(2)),
  };
});
console.log('confirmModal', confirmModal);
if (!confirmModal.visible || !confirmModal.hasTitle || !confirmModal.hasYes || confirmModal.hasNo || !confirmModal.hasX || !confirmModal.square || !confirmModal.centered || !confirmModal.confirmCentered || !confirmModal.confirmNearBottom) {
  throw new Error(`confirm modal ${JSON.stringify(confirmModal)}`);
}
await shot('06c-销毁确认.png');
await page.locator('[data-close="confirm"]').click();
await page.waitForTimeout(120);

await page.locator('[data-testid="game-details-close-button"]').click();
await page.waitForTimeout(120);
await page.locator('.tile[data-game="dicethrone"]').click();
await page.waitForSelector('[data-testid="game-details-open-create-room"]');
await page.locator('[data-testid="game-details-open-create-room"]').click();
await page.waitForSelector('[data-testid="create-room-modal"]');
await page.locator('[data-ai-toggle]').click();
await page.waitForTimeout(150);
const createModal = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="create-room-modal"]');
  const text = el?.innerText || '';
  const yes = document.querySelector('#createConfirm')?.getBoundingClientRect();
  const sr = el?.getBoundingClientRect();
  const cx = yes && sr ? Math.abs((yes.left + yes.right) / 2 - (sr.left + sr.right) / 2) : 99;
  const footGap = yes && sr ? sr.bottom - yes.bottom : 99;
  return {
    visible: Boolean(el),
    hasName: Boolean(document.querySelector('#createName')),
    hasPassword: Boolean(document.querySelector('#createPassword')),
    hasSeats: (el?.querySelectorAll('[data-create-seats]') || []).length >= 2,
    hasRetention: text.includes('房间保存'),
    hasAi: text.includes('加入 AI'),
    hasDiff: text.includes('难度') && text.includes('AI 思考时长') && text.includes('AI 占位'),
    hasConfirm: text.includes('创建'),
    hasCancel: text.includes('取消'),
    hasX: Boolean(el?.querySelector('.close-x')),
    nestedBox: Boolean(el?.querySelector('.ai-box')) && getComputedStyle(el.querySelector('.ai-box')).display !== 'none',
    submitW: Math.round(yes?.width || 0),
    sheetW: Math.round(sr?.width || 0),
    confirmCentered: cx <= 6,
    confirmNearBottom: footGap >= 8 && footGap <= 40,
    cx: Number(cx.toFixed(2)),
    footGap: Number(footGap.toFixed(2)),
  };
});
console.log('createModal', createModal);
if (!createModal.visible || !createModal.hasName || !createModal.hasPassword || !createModal.hasSeats || !createModal.hasRetention || !createModal.hasAi || !createModal.hasDiff || !createModal.hasConfirm) {
  throw new Error(`create room ${JSON.stringify(createModal)}`);
}
if (createModal.hasCancel || !createModal.hasX || createModal.nestedBox || createModal.submitW < 220 || createModal.submitW > createModal.sheetW - 80 || !createModal.confirmCentered || !createModal.confirmNearBottom) {
  throw new Error(`create room chrome ${JSON.stringify(createModal)}`);
}
await shot('06d-创建房间.png');
await page.locator('[data-close="createRoom"]').click();
await page.waitForTimeout(80);
await page.locator('[data-testid="game-details-close-button"]').click();
await page.waitForTimeout(120);

await page.locator('.chrome .nav [data-view="upload"]').click();
await page.waitForSelector('[data-testid="upload-page"]');
await page.waitForTimeout(200);
const uploadPage = await page.evaluate(() => {
  const text = document.querySelector('#homeBody')?.innerText || '';
  return {
    nav: document.querySelector('.chrome .nav .nav-btn.is-active')?.textContent.trim() || '',
    hasList: Boolean(document.querySelector('[data-testid="upload-list"]')),
    hasPage: Boolean(document.querySelector('[data-testid="upload-page"]')),
    hasManage: text.includes('阵营混搭桌') && text.includes('保存资料'),
    hasMeta: text.includes('人数') && text.includes('估计时长') && text.includes('作者'),
    hasRange: Boolean(document.querySelector('#editMin')) && Boolean(document.querySelector('#editMax')),
    hasLog: text.includes('发布更新日志') && text.includes('0.2.1') && text.includes('标题') && text.includes('置顶'),
    hasHistory: text.includes('历史'),
    hasUrlCheck: Boolean(document.querySelector('[data-testid="url-check"]')),
    urlOk: (document.querySelector('[data-testid="url-check"]')?.textContent || '').includes('可以打开'),
    noModal: !document.querySelector('.modal.upload:not([hidden])'),
  };
});
console.log('uploadPage', uploadPage);
if (uploadPage.nav !== '上传') throw new Error(`upload nav ${uploadPage.nav}`);
if (!uploadPage.hasList || !uploadPage.hasPage || !uploadPage.hasManage || !uploadPage.hasMeta || !uploadPage.hasLog || !uploadPage.hasHistory || !uploadPage.hasRange) {
  throw new Error(`upload page missing: ${JSON.stringify(uploadPage)}`);
}
if (!uploadPage.hasUrlCheck || !uploadPage.urlOk) throw new Error(`upload url check missing: ${JSON.stringify(uploadPage)}`);
if (!uploadPage.noModal) throw new Error('upload still a modal');
await shot('07-上传页.png');

await page.locator('[data-upload-pick="new"]').click();
await page.waitForTimeout(200);
const uploadNew = await page.evaluate(() => {
  const text = document.querySelector('[data-testid="upload-page"]')?.innerText || '';
  return {
    hasForm: text.includes('游戏名称') && text.includes('游戏链接') && text.includes('介绍'),
    hasMeta: text.includes('人数') && text.includes('估计时长') && text.includes('作者') && text.includes('规则文档'),
    hasSubmit: text.includes('提交审核'),
    hasDrop: text.includes('封面'),
    hasMin: Boolean(document.querySelector('#upMin')),
    hasMax: Boolean(document.querySelector('#upMax')),
    minIsSelect: document.querySelector('#upMin')?.tagName === 'SELECT',
    maxIsSelect: document.querySelector('#upMax')?.tagName === 'SELECT',
    freeText: Boolean(document.querySelector('#upPlayers')),
    urlHint: (document.querySelector('[data-testid="url-check"]')?.textContent || '').includes('粘贴后自动检测'),
  };
});
console.log('uploadNew', uploadNew);
if (!uploadNew.hasForm || !uploadNew.hasMeta || !uploadNew.hasSubmit || !uploadNew.hasDrop) {
  throw new Error(`upload new form missing: ${JSON.stringify(uploadNew)}`);
}
if (!uploadNew.urlHint) throw new Error(`upload new url hint missing: ${JSON.stringify(uploadNew)}`);
if (!uploadNew.hasMin || !uploadNew.hasMax || !uploadNew.minIsSelect || !uploadNew.maxIsSelect || uploadNew.freeText) {
  throw new Error(`upload players not structured: ${JSON.stringify(uploadNew)}`);
}
const uploadOverlap = await page.evaluate(() => {
  const match = document.querySelector('[data-testid="home-active-match-banner"]:not([hidden]) .match-card');
  const drop = document.querySelector('#upDrop')?.getBoundingClientRect();
  const submit = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('提交审核'))?.getBoundingClientRect();
  const rules = document.querySelector('#upRules')?.getBoundingClientRect();
  const desc = document.querySelector('#upDesc')?.getBoundingClientRect();
  const form = document.querySelector('.upload-form')?.getBoundingClientRect();
  const mb = match?.getBoundingClientRect();
  const hit = (b) => Boolean(mb && b && b.bottom > mb.top + 4 && b.top < mb.bottom && b.left < mb.right && b.right > mb.left);
  return {
    descH: Math.round(desc?.height || 0),
    leftover: Math.round((form?.bottom || 0) - (desc?.bottom || 0)),
    dropH: Math.round(drop?.height || 0),
    rulesH: Math.round(rules?.height || 0),
    dropVisible: Boolean(drop && drop.height > 80 && drop.bottom <= 1080),
    submitVisible: Boolean(submit && submit.height > 20 && submit.bottom <= 1080),
    dropHit: hit(drop),
    submitHit: hit(submit),
    dropBottom: Math.round(drop?.bottom || 0),
    submitBottom: Math.round(submit?.bottom || 0),
    matchTop: Math.round(mb?.top || 0),
    gap: Math.round((submit?.top || 0) - (drop?.bottom || 0)),
  };
});
console.log('uploadOverlap', uploadOverlap);
if (!uploadOverlap.dropVisible || !uploadOverlap.submitVisible) {
  throw new Error(`upload new cover/submit clipped: ${JSON.stringify(uploadOverlap)}`);
}
if (uploadOverlap.dropHit || uploadOverlap.submitHit) {
  throw new Error(`match overlaps upload new cover: ${JSON.stringify(uploadOverlap)}`);
}
if (uploadOverlap.dropH < 120 || uploadOverlap.rulesH < 120) {
  throw new Error(`upload new still sparse: ${JSON.stringify(uploadOverlap)}`);
}
if (uploadOverlap.gap > 40) {
  throw new Error(`submit too far from drop: ${JSON.stringify(uploadOverlap)}`);
}
if (uploadOverlap.descH < 180) {
  throw new Error(`upload intro still short: ${JSON.stringify(uploadOverlap)}`);
}
if (uploadOverlap.leftover > 48) {
  throw new Error(`upload left column leftover: ${JSON.stringify(uploadOverlap)}`);
}
await shot('07b-上传新游戏.png');

await page.locator('#userBtn').click();
await page.waitForTimeout(120);
await page.locator('[data-profile="open"]').click();
await page.waitForSelector('[data-testid="profile-page"]');
await page.waitForTimeout(200);
const profile = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="profile-page"]');
  const text = root?.innerText || '';
  const feed = root?.querySelector('.profile-feed');
  const rail = root?.querySelector('.profile-rail');
  const avatar = document.querySelector('#profileAvatar')?.getBoundingClientRect();
  const edit = [...(rail?.querySelectorAll('button') || [])].find((el) => el.textContent.includes('编辑个人资料'))?.getBoundingClientRect();
  const match = document.querySelector('[data-testid="home-active-match-banner"]:not([hidden]) .match-card')?.getBoundingClientRect();
  const cs = root ? getComputedStyle(root) : null;
  const padL = cs ? Number.parseFloat(cs.paddingLeft) : 0;
  const padR = cs ? Number.parseFloat(cs.paddingRight) : 0;
  const feedBox = feed?.getBoundingClientRect();
  const railBox = rail?.getBoundingClientRect();
  const art = document.querySelector('.feed-art')?.getBoundingClientRect();
  const body = document.querySelector('#homeBody') || document.querySelector('.body');
  const bodyBox = body?.getBoundingClientRect();
  const rootBox = root?.getBoundingClientRect();
  return {
    hasName: text.includes('衡'),
    hasEdit: text.includes('编辑个人资料'),
    hasNick: text.includes('昵称'),
    hasSave: text.includes('保存资料'),
    hasFeed: text.includes('最新动态') && text.includes('大杀四方') && text.includes('过去 2 周'),
    hasHours: Boolean(rail?.innerText.includes('游玩时长')),
    hasPlays: Boolean(rail?.innerText.includes('局数')),
    hasFeedRank: Boolean(feed?.innerText.includes('排行')),
    hasFeedScore: Boolean(feed?.innerText.includes('分数')),
    hasRailRank: Boolean(rail?.innerText.includes('排行')),
    hasRailScore: Boolean(rail?.innerText.includes('评分') || rail?.innerText.includes('分数')),
    hasMatchScore: text.includes('对局分数'),
    hasFavCount: Boolean(rail?.innerText.includes('收藏')),
    hasNow: text.includes('当前正在游戏'),
    sideL: Math.round(rootBox && bodyBox ? rootBox.left - bodyBox.left : 0),
    sideR: Math.round(rootBox && bodyBox ? bodyBox.right - rootBox.right : 0),
    bgImage: body ? getComputedStyle(body).backgroundImage : '',
    hasLevel: text.includes('等级') || /\d+级/.test(text),
    hasAchieve: text.includes('成就'),
    tableRows: document.querySelectorAll('.play-table tbody tr').length,
    feedRows: document.querySelectorAll('.feed-row').length,
    gridTiles: document.querySelectorAll('.play-tile').length,
    favTiles: document.querySelectorAll('.fav-tile').length,
    artW: Math.round(art?.width || 0),
    artH: Math.round(art?.height || 0),
    landscape: Boolean(art && art.width / art.height > 1.8),
    twoCol: Boolean(feedBox && railBox && railBox.left >= feedBox.right - 8),
    avatarW: Math.round(avatar?.width || 0),
    picks: document.querySelectorAll('[data-avatar]').length,
    padBottom: cs ? cs.paddingBottom : '',
    evenPad: Math.abs(padL - padR) <= 1 && padL >= 20,
    padL: Math.round(padL),
    editInRail: Boolean(edit && railBox && edit.left >= railBox.left - 2),
    editAboveMatch: Boolean(edit && match && edit.bottom < match.top - 8),
  };
});
console.log('profile', profile);
if (!profile.hasName || !profile.hasEdit || profile.hasNick || profile.hasSave || !profile.hasFeed || profile.tableRows !== 0 || profile.feedRows < 4 || profile.gridTiles !== 0 || profile.favTiles !== 0 || profile.avatarW < 112 || profile.picks !== 0) {
  throw new Error(`profile ${JSON.stringify(profile)}`);
}
if (!profile.hasHours || !profile.hasPlays || !profile.hasFeedRank || !profile.hasFeedScore || profile.hasRailRank || profile.hasRailScore || !profile.hasFavCount || profile.hasNow || profile.hasMatchScore || profile.hasLevel || profile.hasAchieve) {
  throw new Error(`profile stats ${JSON.stringify(profile)}`);
}
if (!profile.evenPad || !profile.landscape || !profile.twoCol || !profile.editInRail) {
  throw new Error(`profile spacing ${JSON.stringify(profile)}`);
}
if (profile.sideL < 160 || profile.sideR < 160 || !String(profile.bgImage).includes('smashup')) {
  throw new Error(`profile side background ${JSON.stringify(profile)}`);
}
if (Number.parseInt(profile.padBottom, 10) > 40) throw new Error(`profile reserved overlay space: ${profile.padBottom}`);
if (!profile.editAboveMatch) throw new Error(`profile edit buried by match float: ${JSON.stringify(profile)}`);
await shot('08-个人主页.png');

const wantsMobile = !shotFilter || MOBILE_SHOTS.some((name) => shotFilter.has(name) || shotFilter.has(shotIdOf(name)));
if (wantsMobile) await captureMobile({browser, html, shot});

await browser.close();
