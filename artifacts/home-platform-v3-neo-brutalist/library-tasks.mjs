import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

// 验收库的主任务：先看到游戏，再查找、进入、返回；不能只验节点和滚动末项。
export async function assertLibraryFirstScreen(page) {
  const facts = await page.evaluate(() => {
    const match = document.querySelector('.match-card').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.owned-tile')].map(el => {
      const b = el.getBoundingClientRect();
      const name = el.querySelector('.owned-name').getBoundingClientRect();
      const hit = document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
      return {name:el.querySelector('.owned-name').textContent,top:b.top,bottom:b.bottom,
        visible:b.top>=56 && b.bottom<match.top && el.contains(hit),nameWidth:name.width};
    });
    const search = document.querySelector('#librarySearch')?.getBoundingClientRect();
    const news = document.querySelector('.whats-row');
    return {rows,visible:rows.filter(r=>r.visible).length,searchVisible:Boolean(search && search.top>=56 && search.bottom<250),
      newsCollapsed:!news || getComputedStyle(news).display==='none'};
  });
  console.log('libraryFirstScreen', facts);
  assert.equal(facts.rows.length,8,'默认库必须承载当前八款收藏');
  assert.equal(facts.visible,8,'默认375首屏八款收藏必须全部可识别且中心可点击');
  assert.ok(facts.searchVisible,'查找入口必须直接可见');
  assert.ok(facts.newsCollapsed,'情报默认不能挤占收藏首屏');
}

export async function captureLibraryTasks(page,shot) {
  await assertLibraryFirstScreen(page);
  await shot('m01-收藏库主页.png',page);

  await page.locator('#librarySearch').fill('战争');
  assert.deepEqual(await page.locator('.owned-name').allTextContents(),['召唤师战争']);
  await shot('m01d-收藏搜索.png',page);
  await page.locator('#librarySort').selectOption('hours');
  await page.locator('.owned-tile[data-select="summonerwars"]').click();
  await page.getByRole('button',{name:'返回收藏库'}).click();
  assert.equal(await page.locator('#librarySearch').inputValue(),'战争');
  assert.equal(await page.locator('#librarySort').inputValue(),'hours');
  assert.deepEqual(await page.locator('.owned-name').allTextContents(),['召唤师战争']);
  await page.locator('#librarySort').selectOption('recent');
  await page.locator('#librarySearch').fill('没有这款游戏');
  assert.equal(await page.locator('.owned-tile').count(),0);
  assert.ok(await page.getByText('没有匹配的收藏。').isVisible());
  assert.ok(await page.locator('#librarySearch').isVisible());
  await shot('m01e-收藏搜索空态.png',page);
  await page.locator('#librarySearch').fill('');
  assert.equal(await page.locator('.owned-tile').count(),8);

  await page.locator('#librarySort').selectOption('hours');
  assert.deepEqual((await page.locator('.owned-name').allTextContents()).slice(0,4),['大杀四方','王权骰铸','召唤师战争','幻想国度']);
  await shot('m01f-收藏排序.png',page);
  await page.locator('#librarySort').selectOption('name');
  assert.deepEqual(await page.locator('.owned-name').allTextContents(),['大杀四方','幻想国度','卡迪亚','七大恨','山屋惊魂','王权骰铸','召唤师战争','纸牌帮']);
  await page.locator('#librarySort').selectOption('recent');

  // 通过实际滚动打开末项，验证返回保留位置，而非重新跳到顶部。
  await page.mouse.move(180,400);
  await page.mouse.wheel(0,240);
  await page.waitForTimeout(180);
  await shot('m01c-收藏库末项.png',page);
  const position=await page.locator('.lib-home').evaluate(el=>el.scrollTop);
  assert.ok(position>0,'位置恢复必须先经历真实滚动');
  await page.locator('.owned-tile[data-select="betrayal"]').click();
  assert.ok(await page.locator('[data-testid="library-game-page"][data-selected="betrayal"]').isVisible(),'封面单次点击直接进入对应游戏');
  await shot('m02b-返回全部游戏.png',page);
  await page.getByRole('button',{name:'返回收藏库'}).click();
  const restored=await page.locator('.lib-home').evaluate(el=>el.scrollTop);
  assert.ok(Math.abs(restored-position)<=2,`返回丢失位置 ${position}→${restored}`);
  assert.equal(await page.locator('#librarySort').inputValue(),'recent');
  await shot('m01g-返回保留位置.png',page);

  await page.locator('[data-library-news]').click();
  assert.equal(await page.locator('[data-library-news]').getAttribute('aria-expanded'),'true');
  await page.locator('.news-card').first().scrollIntoViewIfNeeded();
  await shot('m01h-展开次要情报.png',page);
  await page.locator('[data-library-news]').click();
  await page.locator('[data-testid="bottom-nav"] [data-view="discover"]').click();
  await page.locator('[data-testid="bottom-nav"] [data-view="library"]').click();
  assert.ok(await page.locator('[data-testid="library-hub"]').isVisible(),'底栏收藏入口须返回游戏库');
  await page.locator('.owned-tile[data-select="smashup"]').click();
  assert.ok(await page.locator('[data-testid="library-game-page"][data-selected="smashup"]').isVisible());
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
    await page.goto('http://127.0.0.1:7788/index.html',{waitUntil:'domcontentloaded'});
    await assertLibraryFirstScreen(page);
  } finally {await browser.close();}
}
