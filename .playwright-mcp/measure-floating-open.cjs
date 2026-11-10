const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const root=document.querySelector('[data-testid="fab-menu"]');
    const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0};
    const rect=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {id:el.getAttribute('data-fab-id'),visual:el.getAttribute('data-fab-visual-id'),label:el.getAttribute('aria-label'),testid:el.getAttribute('data-testid'),x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontSize,transform:s.transform,svg:[...el.querySelectorAll('svg')].map(v=>{const q=v.getBoundingClientRect();return {w:q.width,h:q.height}})}};
    return {viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},root:root&&rect(root),buttons:root&&[...root.querySelectorAll('button')].filter(visible).map(rect),visuals:root&&[...root.querySelectorAll('[data-fab-visual-id]')].filter(visible).map(rect)};
  });
  console.log('FAB_OPEN',JSON.stringify(info));
  await page.screenshot({path:'test-results/evidence-screenshots/dicethrone/dicethrone-left-sidebar-mobile-regression/real-device-fab-open-current.png'});
  process.exit(0);
})().catch(e=>{console.error(e);process.exitCode=1});
