import { mkdirSync } from 'node:fs';
import { test, expect } from '../framework';
import { join } from 'node:path';
import { gotoLocalSmashUp } from './smashup-debug-helpers';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

async function assertFactionCardsClearPlayerRail(page: import('@playwright/test').Page) {
  const PLAYER_RAIL_CLEARANCE_PX = 12;
    const metrics = await page.evaluate(() => {
      const viewportHeight = window.innerHeight;
      const rail = document.querySelector('[data-testid="faction-selection-player-rail"]') as HTMLElement | null;
    const cards = Array.from(document.querySelectorAll('[data-testid^="faction-option-"]')) as HTMLElement[];
    const playerCards = Array.from(document.querySelectorAll('[data-testid^="faction-selection-player-card-"]')) as HTMLElement[];
    if (!rail || cards.length === 0 || playerCards.length === 0) {
      return { skippedBecausePlayerRailNotVisible: true };
    }

    const railRect = rail.getBoundingClientRect();
    const railVisibleHeight = Math.min(railRect.bottom, viewportHeight) - Math.max(railRect.top, 0);
    if (railRect.bottom <= 0 || railRect.top >= viewportHeight || railVisibleHeight < 24) {
      return { skippedBecausePlayerRailNotVisible: true };
    }

    const cardRects = cards
      .map((card) => {
        const rect = card.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
        const visibleHeightAboveRail = Math.min(rect.bottom, railRect.top) - Math.max(rect.top, 0);
        return { rect, visibleHeight, visibleHeightAboveRail };
      })
      .filter(({ rect, visibleHeight, visibleHeightAboveRail }) =>
        rect.bottom > 0
        && rect.top < railRect.top
        && rect.top < viewportHeight
        && visibleHeight >= Math.min(rect.height * 0.5, 24)
        && visibleHeightAboveRail >= Math.min(rect.height * 0.72, 96))
      .map(({ rect }) => rect);
    if (cardRects.length === 0) {
      return { skippedBecausePlayerRailNotVisible: true };
    }

    const playerCardRects = playerCards
      .map((card) => {
        const rect = card.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
        return { rect, visibleHeight };
      })
      .filter(({ rect, visibleHeight }) => rect.bottom > 0 && rect.top < viewportHeight && visibleHeight >= Math.min(rect.height * 0.5, 24));
    if (playerCardRects.length === 0) {
      return { skippedBecausePlayerRailNotVisible: true };
    }

    return {
      maxCardBottom: Math.max(...cardRects.map((rect) => rect.bottom)),
      minPlayerCardTop: Math.min(...playerCardRects.map(({ rect }) => rect.top)),
    };
  });

  expect(metrics, '派系选择页几何断言至少应返回有效结果或显式跳过理由').not.toBeNull();
  if ('skippedBecausePlayerRailNotVisible' in metrics!) {
    return;
  }
  expect(metrics!.maxCardBottom, '候选卡底边必须位于玩家状态卡上方，不能被底部玩家状态卡遮挡').toBeLessThanOrEqual(metrics!.minPlayerCardTop + PLAYER_RAIL_CLEARANCE_PX);
}

test.describe('SmashUp 派系选择页移动端间距', () => {
  test('移动端横屏应保持桌面化主布局并输出移动端/桌面端参考截图', async ({ page }, testInfo) => {
    const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'smashup-faction-selection-spacing');
    mkdirSync(evidenceDir, { recursive: true });

    const title = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    const grid = page.locator('.grid').first();
    const cards = grid.locator('> div');

    await page.setViewportSize({ width: 800, height: 450 });
    await gotoLocalSmashUp(page);
    await expect(title).toBeVisible({ timeout: 30000 });
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const mobileMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.grid > div')) as HTMLElement[];
      const first = cards[0]?.getBoundingClientRect();
      const second = cards[1]?.getBoundingClientRect();
      const third = cards[2]?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        firstWidth: first?.width ?? 0,
        horizontalGap: first && second ? second.left - first.right : 0,
        firstTop: first?.top ?? 0,
        thirdTop: third?.top ?? 0,
        thirdLeft: third?.left ?? 0,
        firstLeft: first?.left ?? 0,
      };
    });

    expect(mobileMetrics.docScrollWidth, '移动端不应横向溢出').toBeLessThanOrEqual(mobileMetrics.innerWidth + 1);
    expect(mobileMetrics.firstWidth, '移动端派系卡应成功渲染').toBeGreaterThan(0);
    expect(mobileMetrics.horizontalGap, '移动端派系卡之间应保留可见间距').toBeGreaterThanOrEqual(0);
    expect(Math.abs(mobileMetrics.thirdTop - mobileMetrics.firstTop), '手机横屏主布局不应被误改成窄屏双列，前三张卡应仍在同一行').toBeLessThanOrEqual(4);
    expect(mobileMetrics.thirdLeft, '第三张卡应位于第一张卡右侧，证明仍是横屏桌面化排布').toBeGreaterThan(mobileMetrics.firstLeft + mobileMetrics.firstWidth);
    await assertFactionCardsClearPlayerRail(page);

    await page.screenshot({ path: join(evidenceDir, 'mobile-landscape.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('mobile-landscape.png'), fullPage: false });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoLocalSmashUp(page);
    await expect(title).toBeVisible({ timeout: 30000 });
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    await assertFactionCardsClearPlayerRail(page);

    await page.screenshot({ path: join(evidenceDir, 'desktop-reference.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('desktop-reference.png'), fullPage: false });
  });

  test('回合状态提示不应触发派系详情', async ({ page }, testInfo) => {
    const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'smashup-faction-selection-waiting');
    mkdirSync(evidenceDir, { recursive: true });

    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoLocalSmashUp(page);

    const title = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    await expect(title).toBeVisible({ timeout: 30000 });

    // 本地对局页启用了 followCurrentTurnPlayer，当前视角会跟随 currentPlayerIndex 自动切换。
    // 因此这里验证“顶部回合提示贴纸不可点穿到派系详情”，不再强造一个本地模式下不存在的 waiting 视角。
    const turnStatusBadge = page.locator('text=/现在轮到你了|It.?s your turn now|正在等待 P\\d+|Waiting for P\\d+/i').first();
    await expect(turnStatusBadge).toBeVisible({ timeout: 5000 });

    await turnStatusBadge.click();
    await expect(page.getByTestId('faction-detail-panel')).toHaveCount(0);
    await expect(page.locator('text=/未知命令|Unknown command/i')).toHaveCount(0);

    await page.screenshot({ path: join(evidenceDir, 'turn-status-badge-click.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('turn-status-badge-click.png'), fullPage: false });
  });
});
