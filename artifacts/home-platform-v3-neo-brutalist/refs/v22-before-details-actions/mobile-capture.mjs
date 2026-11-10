import {captureLibraryTasks} from './library-tasks.mjs';
export const MOBILE_SHOTS = [
  'm01-收藏库主页.png',
  'm02-收藏库游戏页.png',
  'm02b-返回全部游戏.png',
  'm05-发现两列.png',
  'm05b-发现点开展开.png',
  'm06-游戏详情.png',
  'm06c-销毁确认.png',
  'm06d-创建房间.png',
  'm07-上传页.png',
  'm08-个人主页.png',
  'm08b-顶栏抽屉.png',
  'm01c-收藏库末项.png',
  'm01d-收藏搜索.png',
  'm01e-收藏搜索空态.png',
  'm01f-收藏排序.png',
  'm01g-返回保留位置.png',
  'm01h-展开次要情报.png',
  'm02c-完整房间列表.png',
  'm02d-完整好友列表.png',
  'm05c-发现末项.png',
  'm06b-作者弹窗.png',
  'm06e-规则原文.png',
  'm06f-创建AI展开.png',
  'm06g-AI创建按钮可达.png',
  'm07b-上传提交区.png',
  'm07c-短视口填写.png',
  'm08c-个人动态末项.png',
];

const assert = (condition, message, facts) => {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(facts)}`);
};

// 使用浏览器原生滚轮穿过当前页面；同时检查固定条上方的真实命中，避免截图掩盖不可操作末项。
async function reveal(page, selector, {end = false} = {}) {
  const target = page.locator(selector).last();
  const b = await target.boundingBox();
  const delta = end ? 10000 : b.y - 160;
  await page.mouse.move(180, 350);
  await page.mouse.wheel(0, delta);
  await page.waitForTimeout(220);
  const facts = await target.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const match = document.querySelector('.match-card')?.getBoundingClientRect();
    const ceiling = el.closest('.overlay') ? innerHeight - 8 : match?.top;
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return {top: b.top, bottom: b.bottom, matchTop: ceiling, hit: Boolean(hit && el.contains(hit)), width: b.width};
  });
  assert(facts.top >= 56 && facts.bottom < facts.matchTop && facts.hit, `末项不可见或被遮挡 ${selector}`, facts);
}

async function checkPage(page, name) {
  const facts = await page.evaluate(() => {
    const main = document.querySelector('#homeBody');
    const match = document.querySelector('.match-card')?.getBoundingClientRect();
    return {
      width: innerWidth,
      bodyWidth: document.documentElement.scrollWidth,
      mainWidth: main.scrollWidth,
      mainClient: main.clientWidth,
      matchHeight: match?.height,
      failedImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
    };
  });
  assert(facts.bodyWidth <= facts.width && facts.mainWidth <= facts.mainClient + 1 && facts.matchHeight <= 88 && !facts.failedImages.length, `移动页面溢出/图片失败 ${name}`, facts);
  console.log('mobilePage', name, facts);
}

export async function captureMobile({browser, html, shot}) {
  const mobile = await browser.newPage({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.setDefaultTimeout(20000);
  await mobile.goto(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mobile.evaluate(() => Promise.all([...document.images].map((img) => (
    img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
  ))));
  await mobile.waitForSelector('[data-testid="library-hub"]');
  await mobile.waitForTimeout(300);

  await captureLibraryTasks(mobile, shot);
  const game = await mobile.evaluate(() => {
    const btns = [...document.querySelectorAll('.steam-actions .cta-play .btn')].map((el) => {
      const b = el.getBoundingClientRect();
      return { text: el.textContent.trim(), top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width) };
    });
    const rooms = document.querySelector('[data-testid="library-rooms"]')?.getBoundingClientRect();
    const roomTitle = [...document.querySelectorAll('.steam-side .block-title')].find((el) => el.textContent.includes('当前房间'))?.getBoundingClientRect();
    const friends = document.querySelector('[data-testid="library-friends"]')?.getBoundingClientRect();
    const cover = document.querySelector('.steam-cover img, .steam-cover .fallback')?.getBoundingClientRect();
    const list = document.querySelector('[data-testid="library-list"]')?.getBoundingClientRect();
    const match = document.querySelector('[data-testid="home-active-match-banner"]:not([hidden]) .match-card')?.getBoundingClientRect();
    return {
      primaryFull: btns[0]?.w >= 330,
      auxiliaryCompact: btns.length >= 3 && Math.abs(btns[1].top - btns[2].top) <= 1 && btns[2].left - btns[1].right >= 12,
      hit: btns.every((b) => b.h >= 44),
      roomsBelowCover: Boolean(cover && rooms && rooms.top >= cover.bottom - 1),
      friendsBelowRooms: Boolean(rooms && friends && friends.top >= rooms.bottom - 8),
      roomsAboveMatch: Boolean(roomTitle && match && roomTitle.bottom <= match.top - 4),
      listClosed: Boolean(list && list.width === 0),
    };
  });
  console.log('mobileGame', game);
  if (!game.primaryFull || !game.auxiliaryCompact || !game.hit || !game.roomsBelowCover || !game.friendsBelowRooms || !game.roomsAboveMatch || !game.listClosed) {
    throw new Error(`mobile game page ${JSON.stringify(game)}`);
  }
  await shot('m02-收藏库游戏页.png', mobile);
  await checkPage(mobile, '收藏游戏页');
  const side = await mobile.locator('.side-scroll').evaluateAll(els => els.map(el => {
    const b = el.getBoundingClientRect();
    return {height:b.height, content:el.scrollHeight, clipped: el.scrollHeight > el.clientHeight + 1};
  }));
  assert(side.every(s => !s.clipped && s.height > 100), '房间/好友被父级 flex 高度截断', side);
  await reveal(mobile, '[data-testid="library-rooms"]');
  await shot('m02c-完整房间列表.png', mobile);
  await reveal(mobile, '[data-testid="library-friends"]');
  await shot('m02d-完整好友列表.png', mobile);

  await mobile.locator('[data-testid="bottom-nav"] [data-view="discover"]').click();
  await mobile.waitForSelector('#grid .tile');
  await mobile.waitForTimeout(200);
  const discoverM = await mobile.evaluate(() => {
    const grid = document.querySelector('#grid');
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    return { cols, tiles: document.querySelectorAll('#grid .tile').length };
  });
  console.log('mobileDiscover', discoverM);
  if (discoverM.cols !== 2 || discoverM.tiles < 6) throw new Error(`mobile discover ${JSON.stringify(discoverM)}`);
  await shot('m05-发现两列.png', mobile);
  await checkPage(mobile, '发现');
  const stars = await mobile.locator('.star').evaluateAll(els => els.map(el => ({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));
  assert(stars.every(s=>s.w>=44 && s.h>=44), '收藏触控区不足', stars);

  await mobile.locator('.tile[data-game="smashup"]').click();
  await mobile.waitForTimeout(220);
  const tapped = await mobile.evaluate(() => {
    const tile = document.querySelector('.tile[data-game="smashup"]');
    const veil = tile?.querySelector('.tile-veil');
    return {
      open: tile?.classList.contains('is-open') || false,
      opacity: veil ? Number(getComputedStyle(veil).opacity) : 0,
      details: Boolean(document.querySelector('[data-testid="game-details-modal-root"]')),
    };
  });
  console.log('mobileTap', tapped);
  if (!tapped.open || tapped.opacity < 0.9 || tapped.details) throw new Error(`mobile tap expand ${JSON.stringify(tapped)}`);
  await shot('m05b-发现点开展开.png', mobile);
  const expanded = await mobile.locator('.tile.is-open').evaluate(el => {
    const b = el.getBoundingClientRect(), p = el.querySelector('p'), veil = el.querySelector('.tile-veil');
    return {width:b.width, contentW:veil.getBoundingClientRect().width, clipped:p.scrollHeight>p.clientHeight+1, hint:el.innerText.includes('再次点按查看详情')};
  });
  assert(expanded.width>340 && expanded.contentW>240 && !expanded.clipped && expanded.hint, '展开介绍未完整承载', expanded);

  await mobile.locator('.tile[data-game="smashup"]').click();
  await mobile.waitForSelector('[data-testid="game-details-modal-root"]');
  await mobile.waitForTimeout(200);
  const detailsM = await mobile.evaluate(() => {
    const root = document.querySelector('[data-testid="game-details-modal-root"]');
    const box = root?.getBoundingClientRect();
    const x = root?.querySelector('[data-testid="game-details-close-button"]')?.getBoundingClientRect();
    return {
      full: Boolean(box && box.width >= 370 && box.height >= 800),
      xRight: Boolean(x && box && x.right <= box.right + 1 && x.top >= box.top - 1),
      xHit: Boolean(x && x.width >= 44 && x.height >= 44),
    };
  });
  console.log('mobileDetails', detailsM);
  if (!detailsM.full || !detailsM.xRight || !detailsM.xHit) throw new Error(`mobile details ${JSON.stringify(detailsM)}`);
  await shot('m06-游戏详情.png', mobile);
  const description = await mobile.locator('.details-desc').evaluate(el => ({w:el.getBoundingClientRect().width,clipped:el.scrollHeight>el.clientHeight+1}));
  assert(description.w>340 && !description.clipped, '详情简介仍被压进窄列', description);
  await mobile.locator('[data-author="smashup"]').click();
  await shot('m06b-作者弹窗.png', mobile);
  await mobile.locator('[data-close="author"]').click();
  await mobile.locator('[data-tab="rules"]').click();
  await shot('m06e-规则原文.png', mobile);
  await mobile.locator('[data-tab="lobby"]').click();

  await mobile.locator('.room-btn[data-destroy="smashup"]').click();
  await mobile.waitForSelector('.confirm');
  await mobile.waitForTimeout(150);
  const confirmM = await mobile.evaluate(() => {
    const el = document.querySelector('.confirm');
    const box = el?.getBoundingClientRect();
    const yes = document.querySelector('#confirmYes')?.getBoundingClientRect();
    const x = el?.querySelector('.close-x')?.getBoundingClientRect();
    const cx = yes && box ? Math.abs((yes.left + yes.right) / 2 - (box.left + box.right) / 2) : 99;
    return {
      width: Math.round(box?.width || 0),
      confirmCentered: cx <= 8,
      xHit: Boolean(x && x.width >= 44 && x.height >= 44),
      yesHit: Boolean(yes && yes.height >= 44),
    };
  });
  console.log('mobileConfirm', confirmM);
  if (confirmM.width < 330 || confirmM.width > 355 || !confirmM.confirmCentered || !confirmM.xHit || !confirmM.yesHit) {
    throw new Error(`mobile confirm ${JSON.stringify(confirmM)}`);
  }
  await shot('m06c-销毁确认.png', mobile);
  await mobile.locator('[data-close="confirm"]').click();
  await mobile.waitForTimeout(80);
  await mobile.locator('[data-testid="game-details-close-button"]').click();
  await mobile.waitForTimeout(80);

  await mobile.locator('.tile[data-game="dicethrone"]').click();
  await mobile.waitForTimeout(160);
  await mobile.locator('.tile[data-game="dicethrone"]').click();
  await mobile.waitForSelector('[data-testid="game-details-open-create-room"]');
  await mobile.locator('[data-testid="game-details-open-create-room"]').click();
  await mobile.waitForSelector('[data-testid="create-room-modal"]');
  await mobile.waitForTimeout(150);
  const createM = await mobile.evaluate(() => {
    const el = document.querySelector('[data-testid="create-room-modal"]');
    const box = el?.getBoundingClientRect();
    const yes = document.querySelector('#createConfirm')?.getBoundingClientRect();
    const cx = yes && box ? Math.abs((yes.left + yes.right) / 2 - (box.left + box.right) / 2) : 99;
    return {
      width: Math.round(box?.width || 0),
      confirmCentered: cx <= 8,
      hasX: Boolean(el?.querySelector('.close-x')),
    };
  });
  console.log('mobileCreate', createM);
  if (createM.width < 330 || createM.width > 355 || !createM.confirmCentered || !createM.hasX) {
    throw new Error(`mobile create ${JSON.stringify(createM)}`);
  }
  await shot('m06d-创建房间.png', mobile);
  await mobile.locator('[data-ai-toggle]').click();
  await shot('m06f-创建AI展开.png', mobile);
  await mobile.locator('[data-ai-seat="2"]').click();
  await reveal(mobile, '#createConfirm', {end: true});
  await shot('m06g-AI创建按钮可达.png', mobile);
  await mobile.locator('[data-close="createRoom"]').click();
  await mobile.waitForTimeout(80);
  await mobile.locator('[data-testid="game-details-close-button"]').click();
  await mobile.waitForTimeout(80);
  await reveal(mobile, '#grid .tile', {end: true});
  await shot('m05c-发现末项.png', mobile);

  await mobile.locator('[data-testid="bottom-nav"] [data-view="upload"]').click();
  await mobile.waitForSelector('[data-testid="upload-page"]');
  await mobile.waitForTimeout(200);
  await mobile.locator('[data-list-drawer]').click();
  await mobile.waitForTimeout(120);
  await mobile.locator('[data-upload-pick="new"]').click();
  await mobile.waitForTimeout(200);
  const uploadM = await mobile.evaluate(() => {
    const form = document.querySelector('.upload-form')?.getBoundingClientRect();
    const logs = document.querySelector('.upload-logs')?.getBoundingClientRect();
    const range = document.querySelector('.player-range')?.getBoundingClientRect();
    const minBox = document.querySelector('#upMin')?.getBoundingClientRect();
    const check = document.querySelector('[data-testid="url-check"]')?.textContent || '';
    const min = document.querySelector('#upMin');
    const max = document.querySelector('#upMax');
    return {
      stacked: Boolean(form && logs && logs.top >= form.bottom - 8),
      rangeAboveLogs: Boolean(range && logs && range.bottom <= logs.top + 2),
      minInView: Boolean(minBox && minBox.top >= 56 && minBox.bottom <= 756),
      hint: check.includes('粘贴后自动检测'),
      selects: min?.tagName === 'SELECT' && max?.tagName === 'SELECT',
    };
  });
  console.log('mobileUpload', uploadM);
  if (!uploadM.stacked || !uploadM.rangeAboveLogs || !uploadM.minInView || !uploadM.hint || !uploadM.selects) {
    throw new Error(`mobile upload ${JSON.stringify(uploadM)}`);
  }
  await shot('m07-上传页.png', mobile);
  await checkPage(mobile, '上传');
  await reveal(mobile, '#upSubmit', {end: true});
  await shot('m07b-上传提交区.png', mobile);
  // 这是软键盘压缩可视高度的布局压力替身，不宣称真机键盘验收。
  await mobile.setViewportSize({width:375, height:540});
  await mobile.locator('#upRules').fill('移动端规则填写验证');
  await reveal(mobile, '#upSubmit', {end: true});
  await shot('m07c-短视口填写.png', mobile);
  await mobile.setViewportSize({width:375, height:812});

  await mobile.locator('#userBtn').click();
  await mobile.waitForTimeout(80);
  await mobile.locator('[data-profile="open"]').click();
  await mobile.waitForSelector('[data-testid="profile-page"]');
  await mobile.waitForTimeout(200);
  const profileM = await mobile.evaluate(() => {
    const root = document.querySelector('[data-testid="profile-page"]');
    const feed = document.querySelector('.profile-feed')?.getBoundingClientRect();
    const rail = document.querySelector('.profile-rail')?.getBoundingClientRect();
    const id = document.querySelector('.profile-id-band')?.getBoundingClientRect();
    const body = document.querySelector('#homeBody');
    const text = root?.innerText || '';
    const em = document.querySelector('.feed-row em')?.getBoundingClientRect();
    const match = document.querySelector('[data-testid="home-active-match-banner"]:not([hidden]) .match-card')?.getBoundingClientRect();
    return {
      stacked: Boolean(id && rail && feed && rail.top >= id.bottom - 8 && feed.top >= rail.bottom - 8),
      wellW: Math.round(root?.getBoundingClientRect().width || 0),
      topBg: Boolean(body && getComputedStyle(body, '::before').backgroundSize === 'cover' && getComputedStyle(body, '::before').height === '120px'),
      hasFeedRank: text.includes('排行') && text.includes('分数'),
      hasRailRank: Boolean(document.querySelector('.profile-rail')?.innerText.includes('排行')),
      hasNow: text.includes('当前正在游戏'),
      rankAboveMatch: Boolean(em && match && em.bottom <= match.top - 4 && em.top >= 56),
    };
  });
  console.log('mobileProfile', profileM);
  if (!profileM.stacked || profileM.wellW < 360 || !profileM.topBg || !profileM.hasFeedRank || profileM.hasRailRank || profileM.hasNow || !profileM.rankAboveMatch) {
    throw new Error(`mobile profile ${JSON.stringify(profileM)}`);
  }
  await shot('m08-个人主页.png', mobile);
  await checkPage(mobile, '个人主页');
  await reveal(mobile, '.feed-row', {end: true});
  await shot('m08c-个人动态末项.png', mobile);

  await mobile.locator('[data-testid="chrome-menu"]').click();
  await mobile.waitForTimeout(160);
  const extras = await mobile.evaluate(() => {
    const box = document.querySelector('[data-testid="chrome-drawer"]');
    const search = box?.querySelector('.search')?.getBoundingClientRect();
    return {
      open: box ? getComputedStyle(box).display !== 'none' : false,
      searchHit: Boolean(search && search.height >= 44),
      hasGuide: (box?.innerText || '').includes('操作指南'),
    };
  });
  console.log('mobileExtras', extras);
  if (!extras.open || !extras.searchHit || !extras.hasGuide) throw new Error(`mobile chrome drawer ${JSON.stringify(extras)}`);
  await shot('m08b-顶栏抽屉.png', mobile);
  await mobile.close();
}
