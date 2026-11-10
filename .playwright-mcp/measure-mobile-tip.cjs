const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  const items = page.locator('[data-testid="dt-phase-indicator"] [data-dt-phase-item="true"]');
  console.log('ITEMS', JSON.stringify(await items.evaluateAll(nodes => nodes.map(n => ({text:n.textContent?.trim(), rect:(r=>({x:r.x,y:r.y,width:r.width,height:r.height}))(n.getBoundingClientRect())})))));
  const item = items.first();
  const box = await item.boundingBox();
  if (!box) throw new Error('No phase item box');
  await page.touchscreen.tap(box.x + box.width/2, box.y + box.height/2);
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => {
    const tip = document.querySelector('[data-testid="info-tooltip"]');
    if (!tip) return {visible:false};
    const r = tip.getBoundingClientRect();
    const title=tip.querySelector('[data-testid="info-tooltip-title"]');
    const line=tip.querySelector('[data-testid="info-tooltip-content-line"]');
    return {visible:getComputedStyle(tip).visibility, viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio}, tip:{x:r.x,y:r.y,w:r.width,h:r.height}, fontTitle:title&&getComputedStyle(title).fontSize, fontLine:line&&getComputedStyle(line).fontSize, padding:getComputedStyle(tip).padding, titleText:title?.textContent?.trim(), lineText:line?.textContent?.trim(), parent:tip.parentElement?.outerHTML?.slice(0,180)};
  });
  console.log('TIP', JSON.stringify(metrics));
  await page.screenshot({path:'test-results/evidence-screenshots/dicethrone/dicethrone-left-sidebar-mobile-regression/real-device-round-order-tooltip-current.png'});
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
