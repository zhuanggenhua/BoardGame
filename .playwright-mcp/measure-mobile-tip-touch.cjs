const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const items = page.locator('[data-testid="dt-phase-indicator"] [data-dt-phase-item="true"]');
  const box = await items.first().boundingBox();
  if (!box) throw new Error('No phase item box');
  const x = box.x + box.width/2, y = box.y + box.height/2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await page.waitForTimeout(400);
  const metrics = await page.evaluate(() => {
    const tip = document.querySelector('[data-testid="info-tooltip"]');
    if (!tip) return {visible:false};
    const r = tip.getBoundingClientRect();
    const title=tip.querySelector('[data-testid="info-tooltip-title"]');
    const line=tip.querySelector('[data-testid="info-tooltip-content-line"]');
    return {visible:getComputedStyle(tip).visibility, viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio}, tip:{x:r.x,y:r.y,w:r.width,h:r.height}, fontTitle:title&&getComputedStyle(title).fontSize, fontLine:line&&getComputedStyle(line).fontSize, padding:getComputedStyle(tip).padding, titleText:title?.textContent?.trim(), lineText:line?.textContent?.trim()};
  });
  console.log('TIP', JSON.stringify(metrics));
  await page.screenshot({path:'test-results/evidence-screenshots/dicethrone/dicethrone-left-sidebar-mobile-regression/real-device-round-order-tooltip-current.png'});
  process.exit(0);
})().catch(e=>{console.error(e);process.exitCode=1});
