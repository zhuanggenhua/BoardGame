import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    initBetrayalContext,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-tutorial');
const STEP_00 = `${EVIDENCE_DIR}/00-山屋惊魂-教程-章节目录.png`;
const STEP_01 = `${EVIDENCE_DIR}/01-山屋惊魂-教程-恶兆前动作区.png`;
const STEP_02 = `${EVIDENCE_DIR}/02-山屋惊魂-教程-剩余移动.png`;
const STEP_03 = `${EVIDENCE_DIR}/03-山屋惊魂-教程-房间主视区.png`;
const STEP_04 = `${EVIDENCE_DIR}/04-山屋惊魂-教程-持有区与帮助入口.png`;
const STEP_05 = `${EVIDENCE_DIR}/05-山屋惊魂-教程-haunt收尾前.png`;
const STEP_06 = `${EVIDENCE_DIR}/06-山屋惊魂-教程-终局页.png`;
const STEP_07 = `${EVIDENCE_DIR}/07-山屋惊魂-教程-叛徒视角攻击前.png`;
const STEP_08 = `${EVIDENCE_DIR}/08-山屋惊魂-教程-叛徒终局页.png`;
const STEP_09 = `${EVIDENCE_DIR}/09-山屋惊魂-教程-第二章使用书本前.png`;
const STEP_10 = `${EVIDENCE_DIR}/10-山屋惊魂-教程-第二章使用后移动.png`;
const STEP_11 = `${EVIDENCE_DIR}/11-山屋惊魂-教程-房间牌整张承接-点击前.png`;
const STEP_12 = `${EVIDENCE_DIR}/12-山屋惊魂-教程-房间牌整张承接-点击后.png`;
const STEP_13 = `${EVIDENCE_DIR}/13-山屋惊魂-教程-探索未知房间前.png`;
const STEP_14 = `${EVIDENCE_DIR}/14-山屋惊魂-教程-探索后发现牌.png`;
const STEP_15 = `${EVIDENCE_DIR}/15-山屋惊魂-教程-探索后牌桌结果.png`;

const waitForStep = async (page: Parameters<typeof test>[0]['page'], stepId: string, timeout = 15000) => {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({ timeout });
};

const waitForHauntRuntime = async (page: Parameters<typeof test>[0]['page'], timeout = 30000) => {
    await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout });
    await expect(page.getByTestId('betrayal-runtime-header-grid')).toContainText(/恶兆后|Haunt/i, { timeout });
};

const expectImageLoaded = async (locator: ReturnType<Parameters<typeof test>[0]['page']['locator']>) => {
    await expect.poll(async () => locator.evaluate((node) => {
        const image = node instanceof HTMLImageElement ? node : node.querySelector('img');
        return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    })).toBe(true);
};

const clickNext = async (page: Parameters<typeof test>[0]['page']) => {
    const nextButton = page.getByTestId('tutorial-next-button');
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await nextButton.click();
};

test.describe('山屋惊魂教程最小真实链路', () => {
    test('教程路由会从真实运行时主入口开始，并复用真实终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal/tutorial', { waitUntil: 'domcontentloaded' });

        const basicTutorialEntry = page.getByTestId('tutorial-catalog-entry-basic-setup-and-turn');
        const hauntTutorialEntry = page.getByTestId('tutorial-catalog-entry-haunt-actions-and-finish');
        const traitorTutorialEntry = page.getByTestId('tutorial-catalog-entry-traitor-path');
        await expect(basicTutorialEntry).toBeVisible({ timeout: 30000 });
        await expect(hauntTutorialEntry).toBeVisible();
        await expect(traitorTutorialEntry).toBeVisible();
        await expect(page.getByText('教程目录')).toBeVisible();
        await saveScreenshot(page, STEP_00);
        await basicTutorialEntry.click();
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForStep(page, 'objective-and-turn');
        await expect(page.locator('[data-tutorial-id="betrayal-actions-zone"]')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-move')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('底部 5 个主动作');
        await saveScreenshot(page, STEP_01);

        await clickNext(page);
        await waitForStep(page, 'traits-and-speed');
        await expect(page.locator('[data-testid="betrayal-current-traits"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('速度');

        await clickNext(page);
        await waitForStep(page, 'moves-remaining');
        await expect(page.locator('[data-tutorial-id="betrayal-moves-remaining"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('剩余移动');
        await saveScreenshot(page, STEP_02);

        await clickNext(page);
        await waitForStep(page, 'room-board');
        await expect(page.locator('[data-tutorial-id="betrayal-room-board"]')).toBeVisible();
        await saveScreenshot(page, STEP_03);

        await clickNext(page);
        await waitForStep(page, 'inventory-and-help');
        await expect(page.locator('[data-tutorial-id="betrayal-inventory-zone"]')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="betrayal-reference-entry"]')).toBeVisible();
        await page.getByTestId('betrayal-open-scenario').click();
        const preHauntReferenceImage = page.getByTestId('betrayal-reference-card-image');
        await expect(preHauntReferenceImage).toBeVisible();
        await expect(preHauntReferenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/player-reference-zh-front');
        await expectImageLoaded(preHauntReferenceImage);
        await page.getByTestId('betrayal-reference-toggle').click();
        await expect(preHauntReferenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/player-reference-zh-back');
        await expectImageLoaded(preHauntReferenceImage);
        await page.getByTestId('betrayal-reference-close').click();
        await expect(page.getByTestId('betrayal-reference-overlay')).toBeHidden();
        await saveScreenshot(page, STEP_04);

        await clickNext(page);
        await waitForStep(page, 'finish');
        await clickNext(page);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0, { timeout: 10000 });

        await page.goto('/play/betrayal/tutorial/haunt-actions-and-finish', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await waitForHauntRuntime(page, 30000);
        await waitForStep(page, 'help-entry');
        await expect(page.locator('[data-tutorial-id="betrayal-reference-entry"]')).toBeVisible();
        const jackSpiritToken = page.getByTestId('betrayal-monster-board-token-jack-spirit');
        await expect(jackSpiritToken).toBeVisible();
        await expect(jackSpiritToken.locator('img')).toHaveAttribute('data-debug-current-src', /tokens\/monsters\/compressed\/ghost\.webp/);
        await expectImageLoaded(jackSpiritToken);
        await page.getByTestId('betrayal-open-scenario').click();
        const hauntReferenceImage = page.getByTestId('betrayal-reference-card-image');
        await expect(hauntReferenceImage).toBeVisible();
        await expect(hauntReferenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/player-reference-zh-front');
        await expectImageLoaded(hauntReferenceImage);
        await page.getByTestId('betrayal-reference-toggle').click();
        await expect(hauntReferenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/player-reference-zh-back');
        await expectImageLoaded(hauntReferenceImage);
        await page.getByTestId('betrayal-reference-toggle').click();
        await expect(hauntReferenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/traitor-reference-zh');
        await expectImageLoaded(hauntReferenceImage);
        await page.getByTestId('betrayal-reference-toggle').click();
        await expect(hauntReferenceImage).toHaveAttribute('data-asset-src', 'betrayal/cards/monster-reference-zh');
        await expectImageLoaded(hauntReferenceImage);
        await page.getByTestId('betrayal-reference-close').click();
        await expect(page.getByTestId('betrayal-reference-overlay')).toBeHidden();
        await clickNext(page);

        await waitForStep(page, 'haunt-actions');
        await expect(page.getByTestId('betrayal-action-use')).toContainText(/驱魔|Exorcise/i);
        await clickNext(page);

        await waitForStep(page, 'exorcise-jack');
        await saveScreenshot(page, STEP_05);
        await page.getByTestId('betrayal-action-use').click();

        await waitForStep(page, 'endgame-review', 30000);
        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('幸存者逃脱');
        const exorciseRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(exorciseRollPanel).toBeVisible();
        await expect(exorciseRollPanel).toContainText('驱魔');
        await expect(exorciseRollPanel).toContainText('神志检定');
        await expect(page.getByTestId('betrayal-recent-roll-total')).toContainText('总点数');
        const recentRollDice = page.locator('[data-testid^="betrayal-recent-roll-die-"]');
        await expect(recentRollDice.first()).toBeVisible();
        await expect(recentRollDice.first()).toHaveAttribute('data-asset-src', /betrayal\/dice\/house-die-[0-2]/);
        const loadedDiceAssets = await recentRollDice.evaluateAll((diceNodes) => diceNodes.map((node) => {
            const image = node.querySelector('img');
            return {
                asset: node.getAttribute('data-asset-src'),
                imageSrc: image?.getAttribute('src') ?? '',
                naturalWidth: image?.naturalWidth ?? 0,
                naturalHeight: image?.naturalHeight ?? 0,
            };
        }));
        expect(loadedDiceAssets.length).toBeGreaterThan(0);
        for (const die of loadedDiceAssets) {
            expect(die.asset).toMatch(/^betrayal\/dice\/house-die-[0-2]$/);
            expect(die.imageSrc.length).toBeGreaterThan(0);
            expect(die.naturalWidth).toBeGreaterThan(0);
            expect(die.naturalHeight).toBeGreaterThan(0);
        }
        await saveScreenshot(page, STEP_06);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial', diagnostics }]);
    });

    test('移动探索教程会使用持有物、整张房间牌移动并探索出发现牌', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-move-explore-use');

        await page.setViewportSize({ width: 1600, height: 900 });
        await page.goto('/play/betrayal/tutorial/move-explore-use', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        const setupStepVisible = await page.locator('[data-tutorial-step="setup-runtime"]')
            .waitFor({ state: 'visible', timeout: 5000 })
            .then(() => true)
            .catch(() => false);
        if (setupStepVisible) {
            await clickNext(page);
        }
        await waitForStep(page, 'use-book');
        await expect(page.getByTestId('betrayal-action-use')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('书本');
        await expect(page.getByTestId('betrayal-inventory-omen-book')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-omen-book-magnify')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
        await saveScreenshot(page, STEP_09);

        await page.getByTestId('betrayal-action-use').click();
        await waitForStep(page, 'open-move-targets');
        await expect(page.getByTestId('betrayal-action-move')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
        await page.getByTestId('betrayal-action-move').click();
        await waitForStep(page, 'move-to-hallway');
        await expect(page.getByTestId('betrayal-room-hallway')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
        await saveScreenshot(page, STEP_10);
        await saveScreenshot(page, STEP_11);
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('移动到门厅');
        await saveScreenshot(page, STEP_12);
        await waitForStep(page, 'explore-upper');
        await expect(page.getByTestId('betrayal-action-explore')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('房间会翻开');
        await page.getByTestId('betrayal-action-explore').click();
        const exploreTargetMarker = page.locator('[data-testid^="betrayal-room-explore-target-"]').first();
        await expect(exploreTargetMarker).toBeVisible({ timeout: 10000 });
        const targetRoomTestId = await exploreTargetMarker.evaluate((node) => node.getAttribute('data-testid')?.replace('betrayal-room-explore-target-', 'betrayal-room-'));
        expect(targetRoomTestId).toBeTruthy();
        const exploreTargetRoom = page.getByTestId(targetRoomTestId!);
        await expect(exploreTargetRoom).toBeVisible();
        await saveScreenshot(page, STEP_13);
        await exploreTargetRoom.click();
        await waitForStep(page, 'finish', 30000);
        const latestDiscovery = page.locator('[data-tutorial-id="betrayal-latest-discovery"]');
        await expect(latestDiscovery).toBeVisible({ timeout: 30000 });
        const tutorialOverlayCard = page.getByTestId('tutorial-overlay-card');
        await expect(tutorialOverlayCard).toHaveAttribute('data-tutorial-placement', 'center');
        await expect(tutorialOverlayCard).not.toContainText('使用持有物 -> 移动 -> 探索 -> 抽发现牌');
        await expect.poll(async () => tutorialOverlayCard.evaluate((node) => (node as HTMLElement).innerText)).toBe('下一步');
        const discoveryReveal = page.getByTestId('betrayal-discovery-panel');
        await expect(discoveryReveal).toBeVisible();
        const discoveryGeometry = await discoveryReveal.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return {
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
                viewportCenterX: window.innerWidth / 2,
                viewportCenterY: window.innerHeight / 2,
                width: rect.width,
                height: rect.height,
            };
        });
        expect(Math.abs(discoveryGeometry.centerX - discoveryGeometry.viewportCenterX)).toBeLessThanOrEqual(24);
        expect(Math.abs(discoveryGeometry.centerY - discoveryGeometry.viewportCenterY)).toBeLessThanOrEqual(48);
        expect(discoveryGeometry.width).toBeGreaterThan(300);
        expect(discoveryGeometry.height).toBeGreaterThan(320);
        const discoveryFrontAtlas = discoveryReveal.getByTestId('betrayal-discovery-card-front-atlas');
        await expect(discoveryFrontAtlas).toBeVisible();
        await expect(discoveryFrontAtlas).toHaveAttribute('data-asset-src', /betrayal\/cards\/(event-front-atlas|item-front-atlas|omen-front-atlas)/);
        await expect(discoveryFrontAtlas).toHaveAttribute('data-atlas-frame-index', '24');
        await expect(discoveryFrontAtlas).toHaveAttribute('alt', /外星几何|事件|物品|预兆/);
        await expect.poll(async () => discoveryFrontAtlas.evaluate((node) => {
            const image = node as HTMLImageElement;
            return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
        })).toBe(true);
        await saveScreenshot(page, STEP_14);
        await clickNext(page);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0, { timeout: 10000 });
        await expect(exploreTargetRoom).toBeVisible();
        await expect(page.locator('[data-testid^="betrayal-room-explore-target-"]')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-card-front-atlas')).toBeVisible();
        await saveScreenshot(page, STEP_15);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-move-explore-use', diagnostics }]);
    });

    test('叛徒视角教程会从独立章节进入真实攻击和终局', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-traitor-path');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal/tutorial', { waitUntil: 'domcontentloaded' });

        const traitorTutorialEntry = page.getByTestId('tutorial-catalog-entry-traitor-path');
        await expect(traitorTutorialEntry).toBeVisible({ timeout: 30000 });
        await traitorTutorialEntry.click();
        await waitForBetrayalPageReady(page);
        await waitForHauntRuntime(page, 30000);
        await waitForStep(page, 'traitor-objective');
        await expect(page.getByTestId('betrayal-status-chip')).toContainText('达里尔·海拉');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('击倒全部英雄');
        await clickNext(page);

        await waitForStep(page, 'attack-hero');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText(/攻击/);
        await saveScreenshot(page, STEP_07);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
        await page.getByTestId('betrayal-room-focus-target').click();

        await waitForStep(page, 'traitor-finish', 30000);
        const traitorEndgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(traitorEndgameScreen).toBeVisible({ timeout: 30000 });
        await expect(traitorEndgameScreen).toContainText('叛徒得逞');
        await saveScreenshot(page, STEP_08);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-traitor-path', diagnostics }]);
    });
});
