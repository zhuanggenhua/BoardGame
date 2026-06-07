const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:43111/?homeV2Draft=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: '登录' }).first().click({ force: true });
  await page.waitForTimeout(1200);
  fs.mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/homepage-v2-auth-inline.png', fullPage: true });
  await page.getByTestId('home-v2-auth-mode-register').click({ force: true });
  await page.waitForTimeout(800);
  await page.locator('[data-testid="auth-embedded-panel"] .overflow-y-auto').evaluate((el) => {
    el.scrollTop = 120;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/homepage-v2-auth-register-scroll.png', fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
