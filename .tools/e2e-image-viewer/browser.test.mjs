import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// 指定真实查看器目录和其中的图片、视频标题，避免用不存在的媒体伪造播放器成功。
const { VIEWER_BROWSER_TEST_URL: url, VIEWER_BROWSER_VIDEO_TITLE: videoTitle, VIEWER_BROWSER_IMAGE_TITLE: imageTitle } = process.env;
test('查看器视频原生控件可见、可播放暂停跳转，切回图片保持缩放', { skip: !(url && videoTitle && imageTitle), timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(url);
    const open = async (title) => {
      const tile = page.locator('.tile').filter({ hasText: title });
      if (!(await tile.count())) await page.locator('.index-item').filter({ hasText: title }).first().click();
      await tile.first().click();
    };
    await open(videoTitle);
    const video = page.locator('#imageDetailViewport video');
    await page.waitForFunction(() => document.querySelector('#imageDetailViewport video')?.readyState >= 1);
    const box = await video.boundingBox();
    assert.ok(box.width >= 250, '视频显示区应容纳原生控制条');
    await page.mouse.move(box.x + 24, box.y + box.height - 48);
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + 24, box.y + box.height - 48);
    await page.waitForTimeout(1200);
    const playing = await video.evaluate(v => ({ time: v.currentTime, paused: v.paused }));
    assert.ok(!playing.paused && playing.time > .5, '真实点击播放后时间须推进');
    await page.mouse.click(box.x + 24, box.y + box.height - 48);
    assert.equal(await video.evaluate(v => v.paused), true);
    await page.mouse.click(box.x + box.width * .5, box.y + box.height - 22);
    assert.ok(await video.evaluate(v => v.currentTime) > 3, '进度条点击须跳转');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(100);
    const zoomed = await video.boundingBox();
    assert.ok(zoomed.width > box.width, '滚轮可放大视频');
    assert.doesNotMatch(await video.getAttribute('style'), /scale\(/, '原生控件不得跟随 transform 缩小');
    await page.locator('.index-item').filter({ hasText: imageTitle }).first().click();
    const image = page.locator('#imageDetailViewport img');
    await image.waitFor({ state: 'visible' });
    assert.match(await image.getAttribute('style'), /scale\(/, '图片应保留缩放路径');
  } finally { await browser.close(); }
});
