import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 936, height: 432 } });
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  await page.goto('http://127.0.0.1:4273/dev/home-v2-preview', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'test-results/home-v2-dev.png' });
  await browser.close();
})();
