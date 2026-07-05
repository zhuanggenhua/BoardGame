import { expect, test, type Locator } from '@playwright/test';
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
const STEP_00 = `${EVIDENCE_DIR}/00-山屋惊魂-教程-章节目录.jpg`;
const STEP_01 = `${EVIDENCE_DIR}/01-山屋惊魂-教程-恶兆前动作区.jpg`;
const STEP_02 = `${EVIDENCE_DIR}/02-山屋惊魂-教程-剩余移动.jpg`;
const STEP_03 = `${EVIDENCE_DIR}/03-山屋惊魂-教程-房间主视区.jpg`;
const STEP_04 = `${EVIDENCE_DIR}/04-山屋惊魂-教程-持有区与帮助入口.jpg`;
const STEP_05 = `${EVIDENCE_DIR}/05-山屋惊魂-教程-haunt收尾前.jpg`;
const STEP_06 = `${EVIDENCE_DIR}/06-山屋惊魂-教程-驱魔神志检定骰盘.jpg`;
const STEP_06B = `${EVIDENCE_DIR}/06B-山屋惊魂-教程-驱魔成功后的终局页.jpg`;
const STEP_07 = `${EVIDENCE_DIR}/07-山屋惊魂-教程-叛徒视角攻击前.jpg`;
const STEP_08 = `${EVIDENCE_DIR}/08-山屋惊魂-教程-叛徒终局页.jpg`;
const STEP_09 = `${EVIDENCE_DIR}/09-山屋惊魂-教程-第二章使用书本前.jpg`;
const STEP_10 = `${EVIDENCE_DIR}/10-山屋惊魂-教程-第二章使用后移动.jpg`;
const STEP_11 = `${EVIDENCE_DIR}/11-山屋惊魂-教程-房间牌整张承接-点击前.jpg`;
const STEP_12 = `${EVIDENCE_DIR}/12-山屋惊魂-教程-房间牌整张承接-点击后.jpg`;
const STEP_13 = `${EVIDENCE_DIR}/13-山屋惊魂-教程-探索未知房间前.jpg`;
const STEP_14 = `${EVIDENCE_DIR}/14-山屋惊魂-教程-探索后发现牌.jpg`;
const STEP_14A = `${EVIDENCE_DIR}/14A-山屋惊魂-教程-点击兔脚后选择骰子.jpg`;
const STEP_14A1 = `${EVIDENCE_DIR}/14A1-山屋惊魂-教程-兔脚选中改骰高亮.jpg`;
const STEP_14B = `${EVIDENCE_DIR}/14B-山屋惊魂-教程-兔脚重投结束.jpg`;
const STEP_15 = `${EVIDENCE_DIR}/15-山屋惊魂-教程-探索后牌桌结果.jpg`;

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

const expectVisiblePhysicalDiceBox = async (rollPanel: Locator) => {
    const diceGroup = rollPanel.getByTestId('betrayal-house-dice-3d-group');
    await expect(diceGroup).toBeVisible();
    await expect(diceGroup).toHaveAttribute('data-render-mode', 'betrayal-house-dice-box-visible');
    await expect(diceGroup).toHaveAttribute('data-dice-tray-style', 'transparent-virtual');
    await expect(diceGroup).toHaveAttribute('data-dice-count', /[1-9]/);
    await expect.poll(async () => diceGroup.getAttribute('data-dice-physics-ready'), { timeout: 10000 }).toBe('true');

    const physicsSource = rollPanel.getByTestId('betrayal-house-dice-physics-source');
    await expect(physicsSource).toHaveAttribute('data-dice-physics-source', 'dice-box-threejs');
    await expect(physicsSource).toHaveAttribute('data-dice-physics-mode', 'debug-visible');
    await expect(physicsSource).toHaveAttribute('data-dice-face-system', 'betrayal-house-0-1-2-per-die-skin');
    await expect.poll(async () => diceGroup.evaluate((node) => {
        const canvases = Array.from(node.querySelectorAll('canvas'))
            .filter((canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement);
        const source = node.querySelector('[data-testid="betrayal-house-dice-physics-source"]') as HTMLElement | null;
        if (source?.dataset.dicePhysicsSource !== 'dice-box-threejs') return false;
        if (source?.dataset.diceFaceSystem !== 'betrayal-house-0-1-2-per-die-skin') return false;

        return canvases.some((canvas) => {
            const rect = canvas.getBoundingClientRect();
            const style = window.getComputedStyle(canvas);
            return rect.width >= 160
                && rect.height >= 120
                && canvas.dataset.skinsReady === 'true'
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && Number(style.opacity || '1') > 0.5;
        });
    }), { timeout: 10000 }).toBe(true);
};

const waitForPhysicalDiceSettled = async (rollPanel: Locator) => {
    const physicsSource = rollPanel.getByTestId('betrayal-house-dice-physics-source');
    await expect.poll(async () => physicsSource.getAttribute('data-dice-settled'), { timeout: 15000 }).toBe('true');
    await rollPanel.page().waitForTimeout(450);
};

const readBetrayalRollMetrics = async (rollPanel: Locator) => {
    return rollPanel.evaluate((node) => {
        const panel = node as HTMLElement;
        const diceGroup = panel.querySelector('[data-testid="betrayal-house-dice-3d-group"]') as HTMLElement | null;
        const subtotal = panel.querySelector('[data-testid="betrayal-recent-roll-subtotal"]')?.textContent ?? '';
        const total = panel.querySelector('[data-testid="betrayal-recent-roll-total"]')?.textContent ?? '';
        const bonus = panel.querySelector('[data-testid="betrayal-recent-roll-passive-bonus"]')?.textContent ?? '';
        const ruleValues = (diceGroup?.dataset.diceRuleValues ?? '')
            .split(',')
            .filter(Boolean)
            .map((value) => Number(value));
        const visibleRuleValues = (diceGroup?.dataset.diceVisibleRuleValues ?? '')
            .split(',')
            .filter(Boolean)
            .map((value) => Number(value));
        const readableOverlayCount = panel.querySelectorAll('[data-testid^="betrayal-house-readable-die-"]').length;
        const dieValueOverlayCount = panel.querySelectorAll('[data-testid^="betrayal-house-die-value-overlay-"]').length;
        const skinCanvasCount = Array.from(panel.querySelectorAll('canvas'))
            .filter((canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement)
            .filter((canvas) => canvas.dataset.skinsReady === 'true').length;
        const physicalFaces = (diceGroup?.dataset.dicePhysicalD6Faces ?? '')
            .split(',')
            .filter(Boolean)
            .map((value) => Number(value));
        const subtotalNumber = Number(subtotal.match(/-?\d+/)?.[0] ?? Number.NaN);
        const totalNumber = Number(total.match(/-?\d+/)?.[0] ?? Number.NaN);
        const bonusNumber = Number(bonus.match(/[+-]?\d+/)?.[0] ?? Number.NaN);
        return {
            ruleValues,
            visibleRuleValues,
            readableOverlayCount,
            dieValueOverlayCount,
            skinCanvasCount,
            physicalFaces,
            ruleSubtotal: Number(diceGroup?.dataset.diceRuleSubtotal ?? Number.NaN),
            expectedSubtotal: ruleValues.reduce((sum, value) => sum + value, 0),
            expectedPhysicalFaces: ruleValues.map((value) => (value * 2) + 1),
            subtotalNumber,
            totalNumber,
            bonusNumber,
        };
    });
};

const expectBetrayalRollMetricsToMatchVisibleSummary = async (rollPanel: Locator) => {
    const metrics = await readBetrayalRollMetrics(rollPanel);
    expect(metrics.ruleValues.length, '山屋骰必须暴露每颗 0/1/2 规则骰面').toBeGreaterThan(0);
    expect(metrics.ruleSubtotal, '骰子组件记录的规则骰面合计必须等于逐骰求和').toBe(metrics.expectedSubtotal);
    expect(metrics.subtotalNumber, '信息区“骰面合计”必须等于山屋 0/1/2 规则骰面合计').toBe(metrics.expectedSubtotal);
    expect(metrics.visibleRuleValues, '物理骰本体使用的山屋 0/1/2 规则值必须与结算骰一致').toEqual(metrics.ruleValues);
    expect(metrics.readableOverlayCount, '不能用额外小骰面列替代物理骰本体可读性').toBe(0);
    expect(metrics.dieValueOverlayCount, '不能用 DOM 数字叠层替代骰子素材本体').toBe(0);
    expect(metrics.skinCanvasCount, '山屋 0/1/2 规则值必须由 dice-box 骰子皮肤承载').toBeGreaterThan(0);
    expect(metrics.physicalFaces, '物理 d6 目标面必须和山屋规则骰一一对应').toEqual(metrics.expectedPhysicalFaces);
    expect(metrics.totalNumber, '信息区“总点数”必须等于规则骰面合计 + 加值').toBe(metrics.expectedSubtotal + metrics.bonusNumber);
};

const expectInventoryCardHasSingleSymmetricOutline = async (card: Locator) => {
    const outline = await card.evaluate((node) => {
        const button = node as HTMLElement;
        const shell = button.querySelector('[data-testid$="-shell"]') as HTMLElement | null;
        const modifier = button.querySelector('[data-testid$="-roll-modifier"]') as HTMLElement | null;
        const buttonStyle = window.getComputedStyle(button);
        const shellStyle = shell ? window.getComputedStyle(shell) : null;
        const modifierStyle = modifier ? window.getComputedStyle(modifier) : null;
        const modifierRect = modifier?.getBoundingClientRect();
        const shellRect = shell?.getBoundingClientRect();
        return {
            buttonShadowLayers: buttonStyle.boxShadow === 'none' ? 0 : buttonStyle.boxShadow.split('),').length,
            shellBoxShadow: shellStyle?.boxShadow ?? null,
            modifierBorderTop: modifierStyle?.borderTopWidth ?? null,
            modifierBorderRight: modifierStyle?.borderRightWidth ?? null,
            modifierBorderBottom: modifierStyle?.borderBottomWidth ?? null,
            modifierBorderLeft: modifierStyle?.borderLeftWidth ?? null,
            modifierInsetLeft: modifierRect && shellRect ? Math.round(modifierRect.left - shellRect.left) : null,
            modifierInsetRight: modifierRect && shellRect ? Math.round(shellRect.right - modifierRect.right) : null,
            modifierInsetTop: modifierRect && shellRect ? Math.round(modifierRect.top - shellRect.top) : null,
            modifierInsetBottom: modifierRect && shellRect ? Math.round(shellRect.bottom - modifierRect.bottom) : null,
        };
    });
    expect(outline.buttonShadowLayers, '选中/可改骰按钮外发光不能叠成多圈描边').toBeLessThanOrEqual(2);
    expect(outline.shellBoxShadow, '卡牌壳层内部不应额外叠阴影').toBe('none');
    expect(outline.modifierBorderTop).toBe('2px');
    expect(outline.modifierBorderRight).toBe('2px');
    expect(outline.modifierBorderBottom).toBe('2px');
    expect(outline.modifierBorderLeft).toBe('2px');
    expect(outline.modifierInsetLeft, '可改骰内描边左侧内缩必须和右侧对称').toBe(outline.modifierInsetRight);
    expect(outline.modifierInsetTop, '可改骰内描边上侧内缩必须和下侧对称').toBe(outline.modifierInsetBottom);
    expect(outline.modifierInsetLeft, '可改骰内描边必须留在卡面内，不能向左外溢叠边').toBeGreaterThanOrEqual(1);
    expect(outline.modifierInsetTop, '可改骰内描边必须留在卡面内，不能向下被持有区裁切').toBeGreaterThanOrEqual(1);
};

const expectTutorialNextDoesNotStealRollModifierFocus = async (page: Parameters<typeof test>[0]['page']) => {
    const geometry = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="tutorial-next-button"]') as HTMLElement | null;
        const dice = document.querySelector('[data-testid="betrayal-rabbit-foot-dice"]') as HTMLElement | null;
        if (!button || !dice) {
            return {
                visible: false,
                verticalGap: Number.POSITIVE_INFINITY,
                buttonCenterX: 0,
                diceCenterX: 0,
            };
        }
        const buttonRect = button.getBoundingClientRect();
        const diceRect = dice.getBoundingClientRect();
        return {
            visible: buttonRect.width > 0 && buttonRect.height > 0 && window.getComputedStyle(button).visibility !== 'hidden',
            verticalGap: buttonRect.top - diceRect.bottom,
            buttonCenterX: buttonRect.left + buttonRect.width / 2,
            diceCenterX: diceRect.left + diceRect.width / 2,
        };
    });
    if (!geometry.visible) return;
    expect(geometry.verticalGap, '选择重投骰子时，“下一步”不能贴着骰子选择控件抢主焦点').toBeGreaterThanOrEqual(18);
};

const expectDiscoveryPanelDoesNotCoverRollModifier = async (discoveryReveal: Locator, modifierCard: Locator) => {
    await expect(modifierCard).toBeVisible();
    await expect(discoveryReveal).toHaveAttribute('data-allows-inventory-roll-modifiers', 'true');
    const hitTarget = await modifierCard.evaluate((node) => {
        const card = node as HTMLElement;
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtCenter = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
        const cardAtCenter = elementAtCenter?.closest('[data-testid="betrayal-inventory-rope"]');
        const discoveryAtCenter = elementAtCenter?.closest('[data-testid="betrayal-discovery-panel"]');
        return {
            cardWidth: rect.width,
            cardHeight: rect.height,
            cardHit: cardAtCenter === card,
            discoveryHit: Boolean(discoveryAtCenter),
            topTestId: elementAtCenter?.dataset.testid ?? null,
        };
    });
    expect(hitTarget.cardWidth).toBeGreaterThan(24);
    expect(hitTarget.cardHeight).toBeGreaterThan(24);
    expect(hitTarget.discoveryHit).toBe(false);
    expect(hitTarget.cardHit).toBe(true);
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

        const exorciseRollReview = page.getByTestId('betrayal-exorcise-roll-review');
        await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
        const exorciseRollPanel = exorciseRollReview.getByTestId('betrayal-recent-roll-panel');
        await expect(exorciseRollPanel).toBeVisible();
        await expect(exorciseRollPanel).toContainText('驱魔');
        await expect(exorciseRollPanel).toContainText('神志检定');
        await expect(exorciseRollReview.getByTestId('betrayal-recent-roll-total')).toContainText('总点数');
        await expect(page.getByTestId('betrayal-endgame-screen')).toBeHidden();
        await expectVisiblePhysicalDiceBox(exorciseRollPanel);
        await waitForPhysicalDiceSettled(exorciseRollPanel);
        await saveScreenshot(page, STEP_06);
        await page.getByTestId('betrayal-exorcise-roll-continue').click();

        await waitForStep(page, 'endgame-review', 30000);
        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('幸存者逃脱');
        await expect(exorciseRollReview).toBeHidden();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toBeHidden();
        await saveScreenshot(page, STEP_06B);

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
        await expect(discoveryReveal).toHaveAttribute('data-allows-inventory-roll-modifiers', 'true');
        const rabbitFootCard = page.getByTestId('betrayal-inventory-rope');
        await expect(rabbitFootCard).toBeVisible();
        await expect(rabbitFootCard).toHaveAttribute('data-roll-modifier-available', 'true');
        const rollModifierHighlight = page.getByTestId('betrayal-inventory-rope-roll-modifier');
        await expect(rollModifierHighlight).toBeVisible();
        await expect(rollModifierHighlight).toBeEmpty();
        await expectDiscoveryPanelDoesNotCoverRollModifier(discoveryReveal, rabbitFootCard);
        const discoveryRollPanel = discoveryReveal.getByTestId('betrayal-recent-roll-panel');
        await expect(discoveryRollPanel).toBeVisible();
        await expect(discoveryRollPanel).toContainText('外星几何');
        await expect(discoveryRollPanel).toContainText('知识检定');
        await expect(discoveryReveal.getByTestId('betrayal-recent-roll-total')).toContainText('总点数');
        const initialRollDetail = discoveryReveal.getByTestId('betrayal-recent-roll-detail');
        await expect(discoveryReveal.getByTestId('betrayal-recent-roll-subtotal')).toContainText(/骰面合计\s+\d+/);
        await expect(discoveryReveal.getByTestId('betrayal-recent-roll-passive-bonus')).toContainText(/加值\s+[+-]\d+/);
        await expect(initialRollDetail).toContainText(/骰子合计\s+\d+｜加值\s+[+-]\d+/);
        await expect(initialRollDetail).not.toContainText(/骰面|\d+\s+\+\s+\d+/);
        await expect(discoveryRollPanel).toHaveAttribute('data-roll-panel-style', 'open-table-transparent');
        await expectVisiblePhysicalDiceBox(discoveryRollPanel);
        await waitForPhysicalDiceSettled(discoveryRollPanel);
        const rollPanelLayout = await discoveryRollPanel.evaluate((node) => {
            const panel = node as HTMLElement;
            const dice = panel.querySelector('[data-testid="betrayal-house-dice-3d-group"]') as HTMLElement | null;
            const canvas = Array.from(dice?.querySelectorAll('canvas') ?? [])
                .filter((candidate): candidate is HTMLCanvasElement => candidate instanceof HTMLCanvasElement)
                .sort((left, right) => {
                    const leftRect = left.getBoundingClientRect();
                    const rightRect = right.getBoundingClientRect();
                    return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
                })[0] ?? null;
            const total = panel.querySelector('[data-testid="betrayal-recent-roll-total"]') as HTMLElement | null;
            const panelRect = panel.getBoundingClientRect();
            const diceRect = dice?.getBoundingClientRect();
            const canvasRect = canvas?.getBoundingClientRect();
            const totalRect = total?.getBoundingClientRect();
            return {
                panelHeight: panelRect.height,
                panelBackground: window.getComputedStyle(panel).backgroundColor,
                diceWidth: diceRect?.width ?? 0,
                diceHeight: diceRect?.height ?? 0,
                canvasWidth: canvasRect?.width ?? 0,
                canvasHeight: canvasRect?.height ?? 0,
                totalTop: totalRect ? totalRect.top - panelRect.top : 0,
                staticDiceImages: panel.querySelectorAll('[data-testid^="betrayal-recent-roll-die-"] img').length,
            };
        });
        expect(rollPanelLayout.diceHeight / rollPanelLayout.panelHeight).toBeGreaterThan(0.54);
        expect(rollPanelLayout.totalTop / rollPanelLayout.panelHeight).toBeGreaterThan(0.58);
        expect(rollPanelLayout.panelBackground).toBe('rgba(0, 0, 0, 0)');
        expect(rollPanelLayout.diceWidth).toBeGreaterThanOrEqual(600);
        expect(rollPanelLayout.canvasWidth).toBeGreaterThanOrEqual(300);
        expect(rollPanelLayout.canvasHeight).toBeGreaterThanOrEqual(210);
        expect(rollPanelLayout.staticDiceImages).toBe(0);
        const discoveryGeometry = await discoveryReveal.evaluate((node) => {
            const panel = node as HTMLElement;
            const rect = panel.getBoundingClientRect();
            const content = panel.querySelector('[data-testid="betrayal-discovery-panel-content"]') as HTMLElement | null;
            const contentRect = content?.getBoundingClientRect();
            const rollPanel = panel.querySelector('[data-testid="betrayal-recent-roll-panel"]') as HTMLElement | null;
            const rollPanelRect = rollPanel?.getBoundingClientRect();
            const rightPanel = document.querySelector('[data-testid="betrayal-status-rail"], [data-testid="betrayal-player-panel"], [data-testid="betrayal-deck-status"]') as HTMLElement | null;
            const rightPanelRect = rightPanel?.getBoundingClientRect();
            const leftPanelRects = Array.from(
                document.querySelectorAll('[data-testid="betrayal-left-status-rail"], [data-testid="betrayal-inventory-section"]'),
            )
                .map((candidate) => (candidate as HTMLElement).getBoundingClientRect())
                .filter((candidate) => candidate.width > 0 && candidate.height > 0);
            return {
                panelCenterX: rect.left + rect.width / 2,
                panelCenterY: rect.top + rect.height / 2,
                contentCenterX: contentRect ? contentRect.left + contentRect.width / 2 : 0,
                contentCenterY: contentRect ? contentRect.top + contentRect.height / 2 : 0,
                contentLeft: contentRect?.left ?? 0,
                contentRight: contentRect?.right ?? 0,
                rollPanelRight: rollPanelRect?.right ?? 0,
                rightPanelLeft: rightPanelRect?.left ?? window.innerWidth,
                leftPanelRight: leftPanelRects.reduce((maxRight, candidate) => Math.max(maxRight, candidate.right), 0),
                viewportCenterX: window.innerWidth / 2,
                viewportCenterY: window.innerHeight / 2,
                width: rect.width,
                height: rect.height,
                contentWidth: contentRect?.width ?? 0,
                contentHeight: contentRect?.height ?? 0,
            };
        });
        const tableAreaCenterX = (discoveryGeometry.leftPanelRight + discoveryGeometry.rightPanelLeft) / 2;
        expect(Math.abs(discoveryGeometry.contentCenterX - tableAreaCenterX)).toBeLessThanOrEqual(24);
        expect(discoveryGeometry.contentLeft).toBeGreaterThanOrEqual(discoveryGeometry.leftPanelRight + 12);
        expect(discoveryGeometry.rollPanelRight).toBeLessThanOrEqual(discoveryGeometry.rightPanelLeft - 12);
        expect(Math.abs(discoveryGeometry.panelCenterY - discoveryGeometry.viewportCenterY)).toBeLessThanOrEqual(48);
        expect(discoveryGeometry.width).toBeGreaterThan(900);
        expect(discoveryGeometry.height).toBeGreaterThan(320);
        expect(discoveryGeometry.contentWidth).toBeGreaterThanOrEqual(900);
        expect(discoveryGeometry.contentHeight).toBeGreaterThan(320);
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
        await rabbitFootCard.click();
        const rabbitFootDice = page.getByTestId('betrayal-rabbit-foot-dice');
        await expect(rabbitFootDice).toBeVisible();
        const rerollTargetDie = page.getByTestId('betrayal-rabbit-foot-die-1');
        await expect(rerollTargetDie).toBeVisible();
        await expect(rabbitFootCard).toHaveAttribute('aria-pressed', 'true');
        await expectInventoryCardHasSingleSymmetricOutline(rabbitFootCard);
        await expectBetrayalRollMetricsToMatchVisibleSummary(discoveryRollPanel);
        await expectTutorialNextDoesNotStealRollModifierFocus(page);
        await saveScreenshot(page, STEP_14A);
        await saveScreenshot(page, STEP_14A1);
        const rollTotal = discoveryReveal.getByTestId('betrayal-recent-roll-total');
        const rollDetail = discoveryReveal.getByTestId('betrayal-recent-roll-detail');
        const totalBeforeRabbitFoot = await rollTotal.innerText();
        await setHarnessRandomQueue(page, [0.99]);
        await rerollTargetDie.click();
        await expect(rabbitFootDice).toBeHidden();
        await expect.poll(async () => rollTotal.innerText()).not.toBe(totalBeforeRabbitFoot);
        await waitForPhysicalDiceSettled(discoveryRollPanel);
        await expect(discoveryReveal.getByTestId('betrayal-recent-roll-subtotal')).toContainText(/骰面合计\s+\d+/);
        await expect(discoveryReveal.getByTestId('betrayal-recent-roll-passive-bonus')).toContainText(/加值\s+[+-]\d+/);
        await expectBetrayalRollMetricsToMatchVisibleSummary(discoveryRollPanel);
        await expect(rollDetail).toContainText(/骰子合计\s+\d+｜加值\s+[+-]\d+/);
        await expect(rollDetail).not.toContainText(/骰面|\d+\s+\+\s+\d+/);
        await saveScreenshot(page, STEP_14B);
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
