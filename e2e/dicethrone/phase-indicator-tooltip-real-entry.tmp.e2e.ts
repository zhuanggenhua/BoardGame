import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from '../framework';

test('阶段指示 hover 说明 tip 真实截图', async ({ page, game }, testInfo) => {
  test.setTimeout(120000);
  await game.openTestGame('dicethrone');
  await game.setupScene({
    gameId: 'dicethrone',
    currentPlayer: '0',
    phase: 'main1',
    player0: { resources: { CP: 3, HP: 50 } },
    player1: { resources: { CP: 3, HP: 50 } },
    extra: {
      selectedCharacters: { '0': 'monk', '1': 'barbarian' },
      hostStarted: true,
    },
    sys: {
      phase: 'main1',
      currentPlayerIndex: 0,
      interaction: { current: undefined, queue: [] },
      responseWindow: { current: undefined },
    },
  });

  await expect(page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('dt-phase-indicator')).toBeVisible({ timeout: 15000 });
  const phaseItem = page
    .locator('[data-testid="dt-phase-indicator"] [data-dt-phase-item="true"]')
    .filter({ hasText: '3. 主要阶段（1）' })
    .first();
  await expect(phaseItem).toBeVisible({ timeout: 5000 });
  const evidenceDir = join(
    process.cwd(),
    'evidence',
    'dicethrone',
    'phase-indicator-tooltip-real-entry-20261011',
    'media',
  );
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, '01-阶段项-未悬浮.png'), fullPage: false });

  await phaseItem.hover();
  await expect(page.getByTestId('info-tooltip')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(260);

  const stablePath = join(evidenceDir, '02-阶段说明tip-稳定态.png');
  const outputPath = testInfo.outputPath('phase-indicator-tooltip-stable.png');
  await page.screenshot({ path: stablePath, fullPage: false });
  await page.screenshot({ path: outputPath, fullPage: false });

  const metrics = await page.evaluate(() => {
    const item = document.querySelector<HTMLElement>('[data-testid="dt-phase-indicator"] [data-dt-phase-item="true"]');
    const tip = document.querySelector<HTMLElement>('[data-testid="info-tooltip"]');
    if (!item || !tip) return null;
    const itemRect = item.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const style = getComputedStyle(tip);
    return {
      item: { left: itemRect.left, top: itemRect.top, right: itemRect.right, bottom: itemRect.bottom, width: itemRect.width, height: itemRect.height },
      tip: { left: tipRect.left, top: tipRect.top, right: tipRect.right, bottom: tipRect.bottom, width: tipRect.width, height: tipRect.height },
      placement: tip.getAttribute('data-tooltip-placement'),
      className: tip.className,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      transform: style.transform,
      opacity: style.opacity,
      title: tip.querySelector('[data-testid="info-tooltip-title"]')?.textContent?.trim() ?? '',
      content: Array.from(tip.querySelectorAll('[data-testid="info-tooltip-content-line"]')).map((node) => node.textContent?.trim() ?? ''),
    };
  });
  console.log('PHASE_TOOLTIP_METRICS', JSON.stringify(metrics));
  expect(metrics).not.toBeNull();
  expect(metrics?.title).toContain('主要阶段');

  await page.mouse.move(2, 2);
  await expect(page.getByTestId('info-tooltip')).toBeHidden({ timeout: 5000 });
  await page.screenshot({ path: join(evidenceDir, '03-阶段项-移出后.png'), fullPage: false });
});
