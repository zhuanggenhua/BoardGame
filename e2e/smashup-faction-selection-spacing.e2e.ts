import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';
import { setChineseLocale } from './helpers/common';

const MOBILE_VIEWPORT = { width: 800, height: 450 } as const;
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 } as const;

function createPlayerState(
  playerId: string,
  vp: number,
  factions: [string, string],
) {
  return {
    id: playerId,
    vp,
    hand: [],
    deck: [],
    discard: [],
    factions,
    minionsPlayed: 1,
    minionLimit: 1,
    actionsPlayed: 1,
    actionLimit: 1,
  };
}

function buildFactionSelectionScene() {
  return {
    gameId: 'smashup',
    currentPlayer: '0' as const,
    phase: 'factionSelect' as const,
    extra: {
      core: {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        turnNumber: 1,
        nextUid: 1000,
        players: {
          '0': createPlayerState('0', 0, ['aliens', 'pirates']),
          '1': createPlayerState('1', 0, ['ninjas', 'dinosaurs']),
        },
        factionSelection: {
          takenFactions: [],
          playerSelections: {
            '0': [],
            '1': [],
          },
          completedPlayers: [],
        },
      },
    },
  };
}

async function waitForFactionSelectionReady(page: Page) {
  const title = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
  await expect(title).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(() => {
    const bodyText = document.body?.innerText ?? '';
    return !bodyText.includes('Loading match resources...')
      && !bodyText.includes('正在加载对局资源...');
  }, { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function readFactionSelectionMetrics(page: Page) {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid^="faction-option-"]'),
    ).slice(0, 15);
    const boxes = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });
    const uniqueRowTops = boxes.reduce<number[]>((rows, box) => {
      if (!rows.some((rowTop) => Math.abs(rowTop - box.top) < 6)) {
        rows.push(box.top);
      }
      return rows;
    }, []);
    const stage = document.querySelector<HTMLElement>('[data-testid="faction-selection-main-stage"]');
    const stageRect = stage?.getBoundingClientRect() ?? null;
    const rail = document.querySelector<HTMLElement>('[data-testid="faction-selection-player-rail"]');
    const railRect = rail?.getBoundingClientRect() ?? null;
    const playerCard = document.querySelector<HTMLElement>('[data-testid="faction-selection-player-card-0"]');
    const playerCardRect = playerCard?.getBoundingClientRect() ?? null;
    const otherPlayerCard = document.querySelector<HTMLElement>('[data-testid="faction-selection-player-card-1"]');
    const otherPlayerCardRect = otherPlayerCard?.getBoundingClientRect() ?? null;
    const contentBounds = boxes.length
      ? boxes.reduce(
          (acc, box) => ({
            left: Math.min(acc.left, box.left),
            right: Math.max(acc.right, box.right),
            top: Math.min(acc.top, box.top),
            bottom: Math.max(acc.bottom, box.bottom),
          }),
          {
            left: Number.POSITIVE_INFINITY,
            right: Number.NEGATIVE_INFINITY,
            top: Number.POSITIVE_INFINITY,
            bottom: Number.NEGATIVE_INFINITY,
          },
        )
      : null;
    const firstTop = boxes[0]?.top ?? 0;

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      firstWidth: boxes[0]?.width ?? 0,
      row1Aligned: boxes.slice(1, 5).every((box) => Math.abs(box.top - firstTop) < 6),
      sixthWrapped: (boxes[5]?.top ?? 0) > firstTop + 6,
      visibleRowCount: uniqueRowTops.length,
      thirdRowVisible: (boxes[10]?.bottom ?? Number.POSITIVE_INFINITY) <= window.innerHeight + 1,
      stageRect: stageRect
        ? {
            left: stageRect.left,
            top: stageRect.top,
            right: stageRect.right,
            bottom: stageRect.bottom,
            width: stageRect.width,
            height: stageRect.height,
          }
        : null,
      railRect: railRect
        ? {
            left: railRect.left,
            top: railRect.top,
            right: railRect.right,
            bottom: railRect.bottom,
            width: railRect.width,
            height: railRect.height,
          }
        : null,
      playerCardWidth: playerCardRect?.width ?? 0,
      playerCardHeight: playerCardRect?.height ?? 0,
      playerCardBottom: playerCardRect?.bottom ?? 0,
      otherPlayerCardWidth: otherPlayerCardRect?.width ?? 0,
      otherPlayerCardHeight: otherPlayerCardRect?.height ?? 0,
      playerCardToFactionCardRatio: playerCardRect && boxes[0] ? playerCardRect.width / boxes[0].width : 0,
      playerRailHeightRatio: railRect ? railRect.height / window.innerHeight : 0,
      playerCardAspectRatio: playerCardRect ? playerCardRect.height / Math.max(playerCardRect.width, 1) : 0,
      otherPlayerCardAspectRatio: otherPlayerCardRect ? otherPlayerCardRect.height / Math.max(otherPlayerCardRect.width, 1) : 0,
      playerCardWidthDeltaRatio: playerCardRect && otherPlayerCardRect
        ? Math.abs(playerCardRect.width - otherPlayerCardRect.width) / Math.max(playerCardRect.width, otherPlayerCardRect.width, 1)
        : 0,
      playerRailGapRatio: playerCardRect && otherPlayerCardRect && boxes[0]
        ? Math.max(0, otherPlayerCardRect.left - playerCardRect.right) / Math.max(boxes[0].width, 1)
        : 0,
      contentCenterOffsetRatio: contentBounds
        ? Math.abs(((contentBounds.left + contentBounds.right) / 2) - (window.innerWidth / 2)) / window.innerWidth
        : 0,
    };
  });
}

test.describe('SmashUp 派系选择页移动端等比缩放', () => {
  test('手机横屏应保持与 PC 同构的五列选派布局，并输出移动端/桌面端对照截图', async ({ page, game }, testInfo) => {
    const evidenceDir = join(process.cwd(), 'test-results', 'evidence-screenshots', 'smashup-faction-selection-spacing');
    mkdirSync(evidenceDir, { recursive: true });

    await setChineseLocale(page.context());

    await page.setViewportSize(MOBILE_VIEWPORT);
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene(buildFactionSelectionScene());
    await waitForFactionSelectionReady(page);

    const mobileMetrics = await readFactionSelectionMetrics(page);
    await page.screenshot({ path: join(evidenceDir, 'mobile-landscape-800x450.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('mobile-landscape-800x450.png'), fullPage: false });
    expect(mobileMetrics.docScrollWidth, '移动端不应横向溢出').toBeLessThanOrEqual(mobileMetrics.innerWidth + 1);
    expect(mobileMetrics.firstWidth, '移动端派系卡应成功渲染').toBeGreaterThan(0);
    expect(mobileMetrics.row1Aligned, '移动端首行前五张卡应保持同一行').toBe(true);
    expect(mobileMetrics.sixthWrapped, '移动端第六张卡应落到下一行，保持与 PC 一致的五列布局').toBe(true);
    expect(mobileMetrics.stageRect, '移动端应启用主选派缩放舞台').not.toBeNull();
    expect(mobileMetrics.stageRect?.left ?? -1, '移动端缩放舞台左侧不应出屏').toBeGreaterThanOrEqual(-1);
    expect(mobileMetrics.stageRect?.right ?? 9999, '移动端缩放舞台右侧不应出屏').toBeLessThanOrEqual(mobileMetrics.innerWidth + 1);
    expect(mobileMetrics.railRect, '移动端玩家卡片栏应存在').not.toBeNull();
    expect(mobileMetrics.railRect?.bottom ?? 9999, '移动端玩家卡片栏底部不应被裁剪').toBeLessThanOrEqual(mobileMetrics.innerHeight + 1);
    expect(mobileMetrics.playerCardWidth, '移动端玩家卡片应成功渲染').toBeGreaterThan(0);
    expect(mobileMetrics.playerCardHeight, '移动端玩家卡片高度应成功渲染').toBeGreaterThan(0);
    expect(mobileMetrics.otherPlayerCardWidth, '移动端另一名玩家卡片应成功渲染').toBeGreaterThan(0);
    expect(mobileMetrics.otherPlayerCardHeight, '移动端另一名玩家卡片高度应成功渲染').toBeGreaterThan(0);
    expect(mobileMetrics.playerCardBottom, '移动端玩家卡片底边最多只允许保留变换带来的 5px 内尾差').toBeLessThanOrEqual(mobileMetrics.innerHeight + 5);
    expect(mobileMetrics.visibleRowCount, '移动端应至少保留与桌面一致的三行派系构图').toBeGreaterThanOrEqual(3);
    expect(mobileMetrics.thirdRowVisible, '移动端第三行派系卡不应被底部 rail 或视口裁掉').toBe(true);
    expect(mobileMetrics.playerRailHeightRatio, '移动端底部玩家区不能被压缩到只剩图标条').toBeGreaterThanOrEqual(0.055);
    expect(mobileMetrics.playerCardToFactionCardRatio, '移动端当前玩家卡相对主卡阵不能再缩到近似图标贴片').toBeGreaterThanOrEqual(0.44);
    expect(mobileMetrics.playerCardAspectRatio, '移动端当前玩家卡应保留桌面端的竖向卡片语义，而不是变成扁平横条').toBeGreaterThanOrEqual(1.15);
    expect(mobileMetrics.otherPlayerCardAspectRatio, '移动端非当前玩家卡也应保留同一套竖向卡片语义').toBeGreaterThanOrEqual(1.1);
    expect(mobileMetrics.playerCardWidthDeltaRatio, '移动端左右玩家卡不能再被硬改成两套差异过大的 UI').toBeLessThanOrEqual(0.1);
    expect(mobileMetrics.playerRailGapRatio, '移动端玩家区间距不能被拉得过散').toBeLessThanOrEqual(0.24);
    expect(mobileMetrics.playerRailGapRatio, '移动端玩家区间距也不能挤得过死').toBeGreaterThanOrEqual(0.055);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene(buildFactionSelectionScene());
    await waitForFactionSelectionReady(page);

    const desktopMetrics = await readFactionSelectionMetrics(page);
    expect(desktopMetrics.docScrollWidth, 'PC 端不应横向溢出').toBeLessThanOrEqual(desktopMetrics.innerWidth + 1);
    expect(desktopMetrics.row1Aligned, 'PC 端首行前五张卡应保持同一行').toBe(true);
    expect(desktopMetrics.sixthWrapped, 'PC 端第六张卡应落到下一行').toBe(true);
    expect(desktopMetrics.visibleRowCount, 'PC 端应展示三行派系构图').toBeGreaterThanOrEqual(3);
    expect(desktopMetrics.stageRect, 'PC 端不应启用移动缩放舞台').toBeNull();
    expect(desktopMetrics.contentCenterOffsetRatio, 'PC 主卡阵中心应与视口中心保持对齐').toBeLessThanOrEqual(0.03);

    expect(
      mobileMetrics.playerCardWidth,
      '移动端底部玩家 rail 必须明显小于桌面版，不能再维持桌面原尺寸把底部顶出视口',
    ).toBeLessThan(desktopMetrics.playerCardWidth * 0.75);
    expect(
      mobileMetrics.playerCardToFactionCardRatio,
      '移动端底部玩家卡片不能只求“还在屏内”，其相对主卡阵的比例不能被压得明显低于桌面版',
    ).toBeGreaterThanOrEqual(desktopMetrics.playerCardToFactionCardRatio * 0.62);
    expect(
      mobileMetrics.playerRailHeightRatio,
      '移动端底部玩家区高度占比不能低到远离桌面构图关系',
    ).toBeGreaterThanOrEqual(desktopMetrics.playerRailHeightRatio * 0.35);
    expect(
      mobileMetrics.playerCardAspectRatio,
      '移动端当前玩家卡的纵横比不能偏离桌面太多，避免把桌面竖卡改成另一套横条 UI',
    ).toBeGreaterThanOrEqual(desktopMetrics.playerCardAspectRatio * 0.7);

    await page.screenshot({ path: join(evidenceDir, 'desktop-reference-1920x1080.png'), fullPage: false });
    await page.screenshot({ path: testInfo.outputPath('desktop-reference-1920x1080.png'), fullPage: false });
  });

  test('海盗派系详情中的泰坦预览应加载真实卡图', async ({ page, game }, testInfo) => {
    await clearEvidenceScreenshotsForTest(testInfo);
    await setChineseLocale(page.context());

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene(buildFactionSelectionScene());
    await waitForFactionSelectionReady(page);

    const piratesOption = page.getByTestId('faction-option-pirates');
    await expect(piratesOption).toBeVisible({ timeout: 10000 });
    await piratesOption.click();

    const titanSection = page.getByTestId('faction-titan-section');
    await expect(titanSection).toBeVisible({ timeout: 10000 });
    const titanCard = titanSection.getByTestId('faction-titan-card').first();
    await expect(titanCard).toBeVisible({ timeout: 10000 });

    await expect
      .poll(
        async () =>
          titanCard.evaluate((node) => {
            const previewNode = Array.from(node.querySelectorAll<HTMLElement>('div')).find((candidate) => {
              const { backgroundImage } = window.getComputedStyle(candidate);
              return backgroundImage.includes('url(') && !backgroundImage.includes('none');
            });
            return previewNode
              ? window.getComputedStyle(previewNode).backgroundImage
              : '';
          }),
        { timeout: 10000 },
      )
      .toContain('url(');

    const evidencePath = getEvidenceScreenshotPath(testInfo, 'pirates-titan-preview-loaded');
    await page.screenshot({ path: evidencePath, fullPage: false });
  });
});
