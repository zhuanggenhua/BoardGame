const { chromium } = require('playwright');
(async () => {
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9222'); const page=browser.contexts()[0].pages()[0]; await page.waitForTimeout(400);
 const data=await page.evaluate(()=>{const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0};const rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {testid:e.getAttribute('data-testid'),role:e.getAttribute('role'),cls:String(e.className).slice(0,120),text:e.innerText?.trim().slice(0,100),x:r.x,y:r.y,w:r.width,h:r.height,position:s.position,font:s.fontSize}};return [...document.querySelectorAll('[role="dialog"],[data-testid*="panel"],[data-testid*="chat"],[data-testid*="fab"]')].filter(visible).map(rect)});
 console.log('PANELS',JSON.stringify(data)); await page.screenshot({path:'test-results/evidence-screenshots/dicethrone/dicethrone-left-sidebar-mobile-regression/real-device-floating-window-current.png'}); process.exit(0);
})().catch(e=>{console.error(e);process.exitCode=1});
