const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.mouse.move(2, 2);
  const info = await page.evaluate(() => {
    const visible = el => { const r=el.getBoundingClientRect(), s=getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0; };
    const selectors=['[data-testid="fab-menu"]','[data-testid="global-hud"]','[data-testid*="floating"]','[data-testid*="chat"]','[data-testid*="support"]'];
    return selectors.map(sel=>({selector:sel, elements:[...document.querySelectorAll(sel)].filter(visible).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {testid:el.getAttribute('data-testid'),tag:el.tagName,cls:String(el.className).slice(0,160),text:el.innerText?.trim().slice(0,80),rect:{x:r.x,y:r.y,w:r.width,h:r.height},position:s.position,font:s.fontSize,transform:s.transform,svg:[...el.querySelectorAll('svg')].map(svg=>{const z=svg.getBoundingClientRect();return {w:z.width,h:z.height,viewBox:svg.getAttribute('viewBox')}}).slice(0,5)}})}));
  });
  console.log('FLOATING',JSON.stringify(info));
  process.exit(0);
})().catch(e=>{console.error(e);process.exitCode=1});
