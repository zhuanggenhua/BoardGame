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
import { MOBILE_LANDSCAPE_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-tutorial');
const STEP_00 = `${EVIDENCE_DIR}/00-山屋惊魂-教程-章节目录.jpg`;
const STEP_01 = `${EVIDENCE_DIR}/01-山屋惊魂-教程-恶兆前动作区.jpg`;
const STEP_02 = `${EVIDENCE_DIR}/02-山屋惊魂-教程-剩余移动.jpg`;
const STEP_03 = `${EVIDENCE_DIR}/03-山屋惊魂-教程-房间主视区.jpg`;
const STEP_04 = `${EVIDENCE_DIR}/04-山屋惊魂-教程-持有区与帮助入口.jpg`;
const STEP_05 = `${EVIDENCE_DIR}/05-山屋惊魂-教程-书本使用前.jpg`;
const STEP_06 = `${EVIDENCE_DIR}/06-山屋惊魂-教程-书本已选中准备使用.jpg`;
const STEP_07 = `${EVIDENCE_DIR}/07-山屋惊魂-教程-已用书本预览清晰.jpg`;
const STEP_08 = `${EVIDENCE_DIR}/08-山屋惊魂-教程-使用后准备移动.jpg`;
const STEP_09 = `${EVIDENCE_DIR}/09-山屋惊魂-教程-房间牌整张承接-点击前.jpg`;
const STEP_10 = `${EVIDENCE_DIR}/10-山屋惊魂-教程-房间牌整张承接-点击后.jpg`;
const STEP_11 = `${EVIDENCE_DIR}/11-山屋惊魂-教程-探索未知房间前.jpg`;
const STEP_12 = `${EVIDENCE_DIR}/12-山屋惊魂-教程-探索后发现牌.jpg`;
const STEP_13 = `${EVIDENCE_DIR}/13-山屋惊魂-教程-点击兔脚后选择骰子.jpg`;
const STEP_14 = `${EVIDENCE_DIR}/14-山屋惊魂-教程-兔脚选中改骰高亮.jpg`;
const STEP_15 = `${EVIDENCE_DIR}/15-山屋惊魂-教程-兔脚重投结束.jpg`;
const STEP_16 = `${EVIDENCE_DIR}/16-山屋惊魂-教程-探索后牌桌结果.jpg`;
const STEP_17 = `${EVIDENCE_DIR}/17-山屋惊魂-教程-作祟目标改变.jpg`;
const STEP_18 = `${EVIDENCE_DIR}/18-山屋惊魂-教程-打开剧本目标页.jpg`;
const STEP_19 = `${EVIDENCE_DIR}/19-山屋惊魂-教程-驱魔前因果说明.jpg`;
const STEP_20 = `${EVIDENCE_DIR}/20-山屋惊魂-教程-驱魔神志检定骰盘.jpg`;
const STEP_21 = `${EVIDENCE_DIR}/21-山屋惊魂-教程-驱魔成功后的终局页.jpg`;
const STEP_22 = `${EVIDENCE_DIR}/22-山屋惊魂-教程-英雄攻击叛徒前.jpg`;
const STEP_23 = `${EVIDENCE_DIR}/23-山屋惊魂-教程-英雄攻击叛徒骰盘.jpg`;
const STEP_24 = `${EVIDENCE_DIR}/24-山屋惊魂-教程-叛徒视角敌方攻击前.jpg`;
const STEP_25 = `${EVIDENCE_DIR}/25-山屋惊魂-教程-叛徒终局页.jpg`;
const STEP_26 = `${EVIDENCE_DIR}/26-山屋惊魂-教程-杰克之灵目标页.jpg`;
const STEP_27 = `${EVIDENCE_DIR}/27-山屋惊魂-教程-杰克之灵攻击英雄前.jpg`;
const STEP_28 = `${EVIDENCE_DIR}/28-山屋惊魂-教程-杰克之灵攻击骰盘.jpg`;
const TECHNICAL_ASSET_GATE_STEP = `${EVIDENCE_DIR}/技术证据-山屋惊魂-教程-素材加载门禁.jpg`;
const MOBILE_EVIDENCE_DIR = resolve(process.cwd(), 'test-results/evidence-screenshots/betrayal/山屋惊魂-教程移动端横屏验收');
const MOBILE_STEP_01 = `${MOBILE_EVIDENCE_DIR}/01-手机横屏-教程书本使用入口.png`;
const PC_REGRESSION_EVIDENCE_DIR = resolve(process.cwd(), 'test-results/evidence-screenshots/betrayal/pc-regression-current');
const PC_REGRESSION_STEP_USE_BOOK = `${PC_REGRESSION_EVIDENCE_DIR}/09-pc-第二章使用书本前-current.png`;
const PC_REGRESSION_STEP_BOARD = `${PC_REGRESSION_EVIDENCE_DIR}/03-pc-房间主视区-current.png`;

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
        const selectedOutline = button.querySelector('[data-testid$="-selected-outline"]') as HTMLElement | null;
        const buttonStyle = window.getComputedStyle(button);
        const shellStyle = shell ? window.getComputedStyle(shell) : null;
        const modifierStyle = modifier ? window.getComputedStyle(modifier) : null;
        const selectedOutlineStyle = selectedOutline ? window.getComputedStyle(selectedOutline) : null;
        const modifierRect = modifier?.getBoundingClientRect();
        const selectedOutlineRect = selectedOutline?.getBoundingClientRect();
        const shellRect = shell?.getBoundingClientRect();
        return {
            buttonShadowLayers: buttonStyle.boxShadow === 'none' ? 0 : buttonStyle.boxShadow.split('),').length,
            buttonOutlineStyle: buttonStyle.outlineStyle,
            buttonOutlineWidth: buttonStyle.outlineWidth,
            buttonRingShadow: buttonStyle.getPropertyValue('--tw-ring-shadow'),
            shellBoxShadow: shellStyle?.boxShadow ?? null,
            modifierExists: Boolean(modifier),
            selectedOutlineExists: Boolean(selectedOutline),
            selectedBorderTop: selectedOutlineStyle?.borderTopWidth ?? null,
            selectedBorderRight: selectedOutlineStyle?.borderRightWidth ?? null,
            selectedBorderBottom: selectedOutlineStyle?.borderBottomWidth ?? null,
            selectedBorderLeft: selectedOutlineStyle?.borderLeftWidth ?? null,
            selectedShape: selectedOutline?.dataset.highlightShape ?? null,
            selectedBorderRadius: selectedOutlineStyle?.borderTopLeftRadius ?? null,
            selectedBorderRadiusNumber: selectedOutlineStyle ? Number.parseFloat(selectedOutlineStyle.borderTopLeftRadius) : null,
            selectedWidth: selectedOutlineRect ? Math.round(selectedOutlineRect.width) : null,
            selectedHeight: selectedOutlineRect ? Math.round(selectedOutlineRect.height) : null,
            modifierBorderTop: modifierStyle?.borderTopWidth ?? null,
            modifierBorderRight: modifierStyle?.borderRightWidth ?? null,
            modifierBorderBottom: modifierStyle?.borderBottomWidth ?? null,
            modifierBorderLeft: modifierStyle?.borderLeftWidth ?? null,
            modifierShape: modifier?.dataset.highlightShape ?? null,
            modifierBorderRadius: modifierStyle?.borderTopLeftRadius ?? null,
            modifierBorderRadiusNumber: modifierStyle ? Number.parseFloat(modifierStyle.borderTopLeftRadius) : null,
            modifierWidth: modifierRect ? Math.round(modifierRect.width) : null,
            modifierHeight: modifierRect ? Math.round(modifierRect.height) : null,
            selectedInsetLeft: selectedOutlineRect && shellRect ? Math.round(selectedOutlineRect.left - shellRect.left) : null,
            selectedInsetRight: selectedOutlineRect && shellRect ? Math.round(shellRect.right - selectedOutlineRect.right) : null,
            selectedInsetTop: selectedOutlineRect && shellRect ? Math.round(selectedOutlineRect.top - shellRect.top) : null,
            selectedInsetBottom: selectedOutlineRect && shellRect ? Math.round(shellRect.bottom - selectedOutlineRect.bottom) : null,
            modifierInsetLeft: modifierRect && shellRect ? Math.round(modifierRect.left - shellRect.left) : null,
            modifierInsetRight: modifierRect && shellRect ? Math.round(shellRect.right - modifierRect.right) : null,
            modifierInsetTop: modifierRect && shellRect ? Math.round(modifierRect.top - shellRect.top) : null,
            modifierInsetBottom: modifierRect && shellRect ? Math.round(shellRect.bottom - modifierRect.bottom) : null,
        };
    });
    expect(outline.buttonShadowLayers, '选中/可改骰按钮外发光不能叠成多圈描边').toBeLessThanOrEqual(2);
    expect(outline.buttonOutlineStyle, '持有物按钮本体不能再出现矩形焦点框').toBe('none');
    expect(outline.buttonOutlineWidth, '持有物按钮本体不能再出现矩形焦点框').toBe('0px');
    expect(outline.buttonRingShadow, '持有物按钮本体不能再叠 Tailwind 矩形 ring').toBe('0 0 #0000');
    expect(outline.shellBoxShadow, '卡牌壳层内部不应额外叠阴影').toBe('none');
    expect(outline.modifierExists, '选中态不能再叠加内部改骰描边，避免左边和下边视觉加粗').toBe(false);
    expect(outline.selectedOutlineExists, '选中态需要一层独立外描边').toBe(true);
    expect(outline.selectedBorderTop).toBe('2px');
    expect(outline.selectedBorderRight).toBe('2px');
    expect(outline.selectedBorderBottom).toBe('2px');
    expect(outline.selectedBorderLeft).toBe('2px');
    expect(outline.selectedShape, '选中态必须使用圆形高亮圈，而不是矩形外框').toBe('circle');
    expect(outline.selectedWidth, '圆形选中圈宽高必须一致').toBe(outline.selectedHeight);
    expect(outline.selectedBorderRadiusNumber ?? 0, '选中态高亮圈圆角半径必须足以形成圆形').toBeGreaterThanOrEqual((outline.selectedWidth ?? 0) / 2 - 1);
    expect(outline.selectedInsetLeft, '选中外描边左侧外扩必须和右侧对称').toBe(outline.selectedInsetRight);
    expect(outline.selectedInsetTop, '选中外描边上侧外扩必须和下侧对称').toBe(outline.selectedInsetBottom);
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

const expectInventoryPreviewCardReadable = async (previewOverlay: Locator) => {
    const readability = await previewOverlay.getByTestId('betrayal-inventory-preview-card-shell').evaluate((node) => {
        const shell = node as HTMLElement;
        const shellStyle = window.getComputedStyle(shell);
        const button = shell.closest('button') as HTMLElement | null;
        const buttonStyle = button ? window.getComputedStyle(button) : null;
        const rect = shell.getBoundingClientRect();
        return {
            shellOpacity: Number(shellStyle.opacity),
            buttonOpacity: Number(buttonStyle?.opacity ?? '1'),
            shellFilter: shellStyle.filter,
            buttonFilter: buttonStyle?.filter ?? 'none',
            width: rect.width,
            height: rect.height,
        };
    });
    expect(readability.width, '放大预览必须保留可读卡面宽度').toBeGreaterThan(220);
    expect(readability.height, '放大预览必须保留可读卡面高度').toBeGreaterThan(300);
    expect(readability.shellOpacity, '已使用卡牌的放大预览不得继承持有区灰化透明度').toBeGreaterThanOrEqual(0.99);
    expect(readability.buttonOpacity, '已使用卡牌的放大预览外层不得变灰').toBeGreaterThanOrEqual(0.99);
    expect(readability.shellFilter, '已使用卡牌的放大预览不得灰阶/模糊').toBe('none');
    expect(readability.buttonFilter, '已使用卡牌的放大预览外层不得灰阶/模糊').toBe('none');
};

const clickNext = async (page: Parameters<typeof test>[0]['page']) => {
    const nextButton = page.getByTestId('tutorial-next-button');
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await nextButton.click();
};

const advanceToStep = async (
    page: Parameters<typeof test>[0]['page'],
    targetStepId: string,
    maxClicks = 12,
) => {
    const activeStep = page.locator('[data-tutorial-step]').first();
    for (let index = 0; index < maxClicks; index += 1) {
        const currentStepId = await activeStep.getAttribute('data-tutorial-step').catch(() => null);
        if (currentStepId === targetStepId) {
            await waitForStep(page, targetStepId);
            return;
        }
        await clickNext(page);
    }
    await waitForStep(page, targetStepId);
};

test.describe('山屋惊魂教程最小真实链路', () => {
    test('教程驱魔步骤必须点击房间本体进入驱魔结算', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-exorcise-room-direct-target');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal/tutorial/haunt-actions-and-finish', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await waitForHauntRuntime(page, 30000);
        await advanceToStep(page, 'haunt-actions');
        await expect(page.getByTestId('betrayal-action-use')).toContainText(/驱魔|Exorcise/i);
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveAttribute('data-role', 'status');
        await expect(page.getByTestId('betrayal-room-basement-landing')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-focus-card-highlight-basement-landing')).toHaveAttribute('data-highlight-shape', 'room');
        await saveScreenshot(page, STEP_19);

        await clickNext(page);
        await waitForStep(page, 'exorcise-jack');
        const readyRollBackdrop = page.getByTestId('betrayal-roll-result-backdrop');
        await expect(readyRollBackdrop).toHaveAttribute('data-backdrop-dismiss', 'enabled');
        await readyRollBackdrop.click({ position: { x: 16, y: 16 } });
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-room-basement-landing').click();

        const exorciseRollReview = page.getByTestId('betrayal-exorcise-roll-review');
        await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
        await expect(exorciseRollReview.getByTestId('betrayal-recent-roll-panel')).toContainText('驱魔');
        await expect(exorciseRollReview.getByTestId('betrayal-recent-roll-panel')).toContainText('神志检定');
        await expect(exorciseRollReview.getByTestId('betrayal-recent-roll-total')).toContainText('总点数');
        await saveScreenshot(page, STEP_20);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-exorcise-room-direct-target', diagnostics }]);
    });

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
        await expect(page.getByTestId('tutorial-catalog-entry-move-explore-use')).toHaveCount(0);
        await expect(page.getByTestId('tutorial-catalog-entry-crimson-jack-objective')).toHaveCount(0);
        await expect(page.getByText('教程目录')).toBeVisible();
        await saveScreenshot(page, STEP_00);
        await basicTutorialEntry.click();
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForStep(page, 'objective-and-turn');
        await expect(page.locator('[data-tutorial-id="betrayal-actions-zone"]')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-action-move')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('底部动作');
        await saveScreenshot(page, STEP_01);

        await clickNext(page);
        await waitForStep(page, 'traits-and-speed');
        await expect(page.locator('[data-testid="betrayal-current-traits"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('速度');

        await clickNext(page);
        await waitForStep(page, 'moves-remaining');
        await expect(page.locator('[data-tutorial-id="betrayal-moves-remaining"]')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('移动圆牌');
        await saveScreenshot(page, STEP_02);

        await clickNext(page);
        await waitForStep(page, 'room-board');
        await expect(page.locator('[data-tutorial-id="betrayal-room-board"]')).toBeVisible();
        await saveScreenshot(page, STEP_03);

        await clickNext(page);
        await waitForStep(page, 'inventory-and-help');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('物品和预兆会留在这里');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('帮助入口');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('主界面');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('替代');
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

        await page.goto('/play/betrayal/tutorial/haunt-actions-and-finish', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await waitForHauntRuntime(page, 30000);
        await waitForStep(page, 'help-entry');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('作祟后目标已经变了');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('确认双方怎么赢');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('帮助入口');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('底部动作按钮');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('替代');
        await expect(page.locator('[data-tutorial-id="betrayal-reference-entry"]')).toBeVisible();
        const jackSpiritToken = page.getByTestId('betrayal-monster-board-token-jack-spirit');
        await expect(jackSpiritToken).toBeVisible();
        await expect(jackSpiritToken.locator('img')).toHaveAttribute('data-debug-current-src', /tokens\/monsters\/compressed\/ghost\.webp/);
        await expectImageLoaded(jackSpiritToken);
        await saveScreenshot(page, STEP_17);
        await page.getByTestId('betrayal-open-scenario').click();
        const scenarioObjectivePage = page.getByTestId('betrayal-scenario-objective-page');
        await expect(scenarioObjectivePage).toBeVisible();
        await expect(scenarioObjectivePage).toContainText('赤红杰克归来');
        await expect(scenarioObjectivePage).toContainText('英雄目标');
        await expect(scenarioObjectivePage).toContainText('叛徒目标');
        await expect(scenarioObjectivePage).toContainText('杰克之灵');
        await saveScreenshot(page, STEP_18);
        await page.getByTestId('betrayal-reference-toggle').click();
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
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('驱魔不是凭空出现');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('最后一步');
        await expect(page.getByTestId('betrayal-action-use')).toContainText(/驱魔|Exorcise/i);
        await expect(page.getByTestId('betrayal-room-basement-landing')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-focus-card-highlight-basement-landing')).toHaveAttribute('data-highlight-shape', 'room');
        await saveScreenshot(page, STEP_19);
        await clickNext(page);

        await waitForStep(page, 'exorcise-jack');
        await page.getByTestId('betrayal-room-basement-landing').click();

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
        await saveScreenshot(page, STEP_20);
        const exorciseRollBackdrop = page.getByTestId('betrayal-roll-review-backdrop');
        await expect(exorciseRollBackdrop).toHaveAttribute('data-backdrop-dismiss', 'enabled');
        await exorciseRollBackdrop.click({ position: { x: 16, y: 16 } });

        await waitForStep(page, 'endgame-review', 30000);
        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('幸存者逃脱');
        await expect(exorciseRollReview).toBeHidden();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toBeHidden();
        await saveScreenshot(page, STEP_21);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial', diagnostics }]);
    });

    test('移动探索教程会使用持有物、整张房间牌移动并探索出发现牌', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-move-explore-use');

        await page.setViewportSize({ width: 1600, height: 900 });
        let releaseCriticalEventAtlas!: () => void;
        let criticalEventAtlasReleased = false;
        const criticalEventAtlasGate = new Promise<void>((resolve) => {
            releaseCriticalEventAtlas = () => {
                criticalEventAtlasReleased = true;
                resolve();
            };
        });
        let markCriticalEventAtlasRequested!: () => void;
        const criticalEventAtlasRequested = new Promise<void>((resolve) => {
            markCriticalEventAtlasRequested = resolve;
        });
        await page.route('**/*event-front-atlas*', async (route) => {
            markCriticalEventAtlasRequested();
            if (!criticalEventAtlasReleased) {
                await criticalEventAtlasGate;
            }
            await route.continue();
        });
        await page.goto('/play/betrayal/tutorial/basic-setup-and-turn', { waitUntil: 'domcontentloaded' });
        await criticalEventAtlasRequested;
        await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('betrayal-board')).not.toBeVisible();
        await saveScreenshot(page, TECHNICAL_ASSET_GATE_STEP);
        releaseCriticalEventAtlas();
        await waitForBetrayalPageReady(page);

        await advanceToStep(page, 'use-book');
        await waitForStep(page, 'use-book');
        await expect(page.getByTestId('betrayal-action-use')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('先选择持有区里的书本');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('再点“使用”');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('非战斗检定');
        await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('放大镜');
        await expect(page.getByTestId('betrayal-inventory-omen-book')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-omen-book-shell')).toHaveAttribute('data-tutorial-target-outline', 'true');
        await expect(page.getByTestId('tutorial-highlight-ring')).toHaveAttribute('data-tutorial-highlight-target', 'betrayal-inventory-omen-book');
        await expect(page.getByTestId('tutorial-highlight-ring')).toHaveAttribute('data-tutorial-highlight-shape', 'rect');
        await expect(page.getByTestId('betrayal-inventory-omen-book-magnify')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
        await saveScreenshot(page, STEP_05);

        await page.getByTestId('betrayal-inventory-omen-book').click();
        await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toContainText('书本');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await expect(page.getByTestId('betrayal-inventory-omen-book')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('betrayal-inventory-omen-book-selected-outline')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('再点“使用”');
        await saveScreenshot(page, STEP_06);
        await page.getByTestId('betrayal-action-use').click();
        await waitForStep(page, 'open-move-targets');
        await expect(page.getByTestId('betrayal-action-move')).toBeVisible();
        await page.getByTestId('betrayal-inventory-omen-book-magnify').click();
        const usedBookPreview = page.getByTestId('betrayal-inventory-preview-overlay');
        await expect(usedBookPreview).toBeVisible();
        await expect(usedBookPreview.getByTestId('betrayal-inventory-preview-card-shell')).toBeVisible();
        await expectInventoryPreviewCardReadable(usedBookPreview);
        await saveScreenshot(page, STEP_07);
        await usedBookPreview.click({ position: { x: 8, y: 8 } });
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
        await page.getByTestId('betrayal-action-move').click();
        await waitForStep(page, 'move-to-hallway');
        await expect(page.getByTestId('betrayal-room-hallway')).toBeVisible();
        await expect(page.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();
        await saveScreenshot(page, STEP_08);
        await saveScreenshot(page, STEP_09);
        await page.getByTestId('betrayal-room-hallway').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('移动到门厅');
        await saveScreenshot(page, STEP_10);
        await waitForStep(page, 'explore-upper');
        await expect(page.getByTestId('betrayal-action-explore')).toBeVisible();
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('立刻抽取对应的发现牌');
        await page.getByTestId('betrayal-action-explore').click();
        const exploreTargetMarker = page.locator('[data-testid^="betrayal-room-explore-target-"]').first();
        await expect(exploreTargetMarker).toBeVisible({ timeout: 10000 });
        const targetRoomTestId = await exploreTargetMarker.evaluate((node) => node.getAttribute('data-testid')?.replace('betrayal-room-explore-target-', 'betrayal-room-'));
        expect(targetRoomTestId).toBeTruthy();
        const exploreTargetRoom = page.getByTestId(targetRoomTestId!);
        await expect(exploreTargetRoom).toBeVisible();
        await expect(page.getByTestId(`betrayal-room-explore-card-highlight-${targetRoomTestId!.replace('betrayal-room-', '')}`)).toBeVisible();
        await saveScreenshot(page, STEP_11);
        await exploreTargetRoom.click();
        await waitForStep(page, 'finish', 30000);
        const latestDiscovery = page.locator('[data-tutorial-id="betrayal-latest-discovery"]');
        await expect(latestDiscovery).toBeVisible({ timeout: 30000 });
        const tutorialOverlayCard = page.getByTestId('tutorial-overlay-card');
        await expect(tutorialOverlayCard).toHaveAttribute('data-tutorial-placement', 'center');
        await expect(tutorialOverlayCard).not.toContainText('使用持有物 -> 移动 -> 探索 -> 抽发现牌');
        await expect(tutorialOverlayCard).toContainText('兔脚');
        await expect(tutorialOverlayCard).toContainText('重投一颗骰子');
        await expect(tutorialOverlayCard).toContainText('不想改时继续结算');
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
        await saveScreenshot(page, STEP_12);
        await rabbitFootCard.click();
        const rabbitFootDice = page.getByTestId('betrayal-rabbit-foot-dice');
        await expect(rabbitFootDice).toBeVisible();
        await expect(rabbitFootDice).toHaveAttribute('data-reroll-target-count', /^[1-9]\d*$/);
        await expect(page.getByTestId('betrayal-rabbit-foot-die-1')).toHaveCount(0);
        const rerollTargetDie = page.getByTestId('betrayal-house-dice-reroll-target-1');
        await expect(rerollTargetDie).toBeVisible();
        await expect(rerollTargetDie).toHaveAttribute('role', 'button');
        await expect(rerollTargetDie).toHaveAttribute('data-reroll-target-shape', 'circle');
        const rerollTargetBox = await rerollTargetDie.boundingBox();
        expect(Math.round(rerollTargetBox?.width ?? 0), '选骰命中区必须是正圆，不是横竖不等的矩形').toBe(Math.round(rerollTargetBox?.height ?? 0));
        const rerollTargetRotateZ = Number(await rerollTargetDie.getAttribute('data-reroll-target-rotate-z'));
        expect(Number.isFinite(rerollTargetRotateZ), '选骰框必须记录物理骰当前旋转角').toBe(true);
        expect(Math.abs(rerollTargetRotateZ), '选骰框必须跟随被选骰子的旋转，而不是固定正矩形').toBeGreaterThan(0.05);
        await expect.poll(async () => rerollTargetDie.evaluate((node) => getComputedStyle(node as HTMLElement).transform))
            .not.toBe('none');
        await expect(rabbitFootCard).toHaveAttribute('aria-pressed', 'true');
        await expectInventoryCardHasSingleSymmetricOutline(rabbitFootCard);
        await expectBetrayalRollMetricsToMatchVisibleSummary(discoveryRollPanel);
        await expectTutorialNextDoesNotStealRollModifierFocus(page);
        await saveScreenshot(page, STEP_13);
        await saveScreenshot(page, STEP_14);
        const rollDetail = discoveryReveal.getByTestId('betrayal-recent-roll-detail');
        await setHarnessRandomQueue(page, [0.99]);
        await rerollTargetDie.click();
        await expect(rabbitFootDice).toBeHidden();
        await expect(discoveryRollPanel.getByTestId('betrayal-house-dice-physics-source')).toHaveAttribute('data-dice-settled', 'false');
        await waitForPhysicalDiceSettled(discoveryRollPanel);
        await expect(discoveryReveal.getByTestId('betrayal-recent-roll-subtotal')).toContainText(/骰面合计\s+\d+/);
        await expect(discoveryReveal.getByTestId('betrayal-recent-roll-passive-bonus')).toContainText(/加值\s+[+-]\d+/);
        await expectBetrayalRollMetricsToMatchVisibleSummary(discoveryRollPanel);
        await expect(rollDetail).toContainText(/骰子合计\s+\d+｜加值\s+[+-]\d+/);
        await expect(rollDetail).not.toContainText(/骰面|\d+\s+\+\s+\d+/);
        await saveScreenshot(page, STEP_15);
        await clickNext(page);
        await expect(page.locator('[data-tutorial-step]')).toHaveCount(0, { timeout: 10000 });
        await expect(exploreTargetRoom).toBeVisible();
        await expect(page.locator('[data-testid^="betrayal-room-explore-target-"]')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-discovery-panel')).toBeVisible();
        await expect(page.getByTestId('betrayal-discovery-card-front-atlas')).toBeVisible();
        await saveScreenshot(page, STEP_16);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-move-explore-use', diagnostics }]);
    });

    test('手机横屏下教程真实入口应保持 PC 同构布局并由 board-shell 缩放', async ({ page, context }) => {
        test.setTimeout(90000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-phone-landscape');

        await page.setViewportSize(MOBILE_LANDSCAPE_REFERENCE_VIEWPORT);
        await page.goto('/play/betrayal/tutorial/basic-setup-and-turn?bgForceCoarsePointer=1', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await expect(page.getByTestId('mobile-orientation-game-gate')).toHaveCount(0);
        await expect(page.locator('html')).toHaveAttribute('data-game-id', 'betrayal');
        await expect(page.locator('html')).toHaveAttribute('data-preferred-orientation', 'landscape');
        await expect(page.locator('html')).toHaveAttribute('data-mobile-layout-preset', 'board-shell');
        await expect(page.getByTestId('mobile-orientation-game-banner')).toHaveCount(0);
        await advanceToStep(page, 'use-book');
        await waitForStep(page, 'use-book');
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await expect(page.getByTestId('betrayal-desktop-layout')).toBeVisible();
        await expect(page.getByTestId('betrayal-desktop-layout')).toHaveAttribute('data-layout-mode', 'desktop-board');
        await expect(page.getByTestId('betrayal-mobile-landscape-layout')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mobile-stage-status')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mobile-traits-strip')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mobile-context-strip')).toHaveCount(0);
        await expect(page.locator('[data-fab-id="chat"]')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-grid')).toBeVisible();
        await expect(page.getByTestId('betrayal-left-status-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-status-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-action-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-panel')).not.toHaveAttribute('data-mobile-role', /primary-board-stage/);
        await expect(page.getByTestId('betrayal-inventory-section')).not.toHaveAttribute('data-mobile-role', /possession-rail/);
        await expect(page.getByTestId('betrayal-action-rail')).not.toHaveAttribute('data-mobile-role', /pc-action-rail-adapted/);
        await expect(page.getByTestId('betrayal-inventory-omen-book')).toBeVisible();
        await expect(page.locator('button[data-testid^="betrayal-action-"]').first()).toBeVisible();

        const mobileLayout = await page.evaluate(() => {
            const pcActionButton = document.querySelector<HTMLElement>('button[data-testid^="betrayal-action-"]');
            const board = document.querySelector<HTMLElement>('[data-testid="betrayal-board"]');
            const layout = document.querySelector<HTMLElement>('[data-testid="betrayal-desktop-layout"]');
            const shell = document.querySelector<HTMLElement>('.mobile-board-shell');
            const roomGrid = document.querySelector<HTMLElement>('[data-testid="betrayal-room-grid"]');
            const roomPanel = document.querySelector<HTMLElement>('[data-testid="betrayal-room-panel"]');
            const inventoryRail = document.querySelector<HTMLElement>('[data-testid="betrayal-inventory-section"]');
            const actionRail = document.querySelector<HTMLElement>('[data-testid="betrayal-action-rail"]');
            const floatingChatButton = document.querySelector<HTMLElement>('[data-fab-id="chat"]');
            const desktopActionButtons = Array.from(document.querySelectorAll<HTMLElement>('button[data-testid^="betrayal-action-"]'));
            const mobileDockButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="betrayal-mobile-dock-"]'));
            const roomCanvas = document.querySelector<HTMLElement>('[data-testid="betrayal-room-canvas"]');
            const leftRail = document.querySelector<HTMLElement>('[data-testid="betrayal-left-status-rail"]');
            const statusRail = document.querySelector<HTMLElement>('[data-testid="betrayal-status-rail"]');
            const tutorialCard = document.querySelector<HTMLElement>('[data-testid="tutorial-overlay-card"]');
            const boardRect = board?.getBoundingClientRect();
            const shellRect = shell?.getBoundingClientRect();
            const roomGridRect = roomGrid?.getBoundingClientRect();
            const inventoryRailRect = inventoryRail?.getBoundingClientRect();
            const actionRailRect = actionRail?.getBoundingClientRect();
            const leftRailRect = leftRail?.getBoundingClientRect();
            const statusRailRect = statusRail?.getBoundingClientRect();
            const tutorialRect = tutorialCard?.getBoundingClientRect();
            const visibleElementCount = (elements: HTMLElement[]) => elements.filter((element) => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && Number(style.opacity || '1') > 0.01;
            }).length;
            const isVisible = (element: HTMLElement | null) => {
                if (!element) return false;
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && Number(style.opacity || '1') > 0.01;
            };

            return {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                layoutMode: layout?.dataset.layoutMode ?? null,
                roomPanelRole: roomPanel?.dataset.mobileRole ?? null,
                inventoryRole: inventoryRail?.dataset.mobileRole ?? null,
                actionRole: actionRail?.dataset.mobileRole ?? null,
                shellTransform: shell ? getComputedStyle(shell).transform : null,
                shellLeft: shellRect?.left ?? null,
                shellRight: shellRect?.right ?? null,
                boardWidth: boardRect?.width ?? 0,
                boardHeight: boardRect?.height ?? 0,
                roomGridWidth: roomGridRect?.width ?? 0,
                roomGridHeight: roomGridRect?.height ?? 0,
                roomCanvasTransform: roomCanvas ? getComputedStyle(roomCanvas).transform : null,
                inventoryRailBottomGap: inventoryRailRect ? window.innerHeight - inventoryRailRect.bottom : null,
                inventoryRailLeft: inventoryRailRect?.left ?? null,
                actionRailBottomGap: actionRailRect ? window.innerHeight - actionRailRect.bottom : null,
                actionRailLeft: actionRailRect?.left ?? null,
                actionRailWidth: actionRailRect?.width ?? 0,
                floatingChatButtonVisible: isVisible(floatingChatButton),
                visibleDesktopActionCount: visibleElementCount(desktopActionButtons),
                visibleMobileDockCount: visibleElementCount(mobileDockButtons),
                firstDesktopActionVisible: isVisible(pcActionButton),
                roomPanelBottomPadding: roomPanel ? Number.parseFloat(getComputedStyle(roomPanel).paddingBottom || '0') : 0,
                leftRailDisplay: leftRail ? getComputedStyle(leftRail).display : null,
                statusRailDisplay: statusRail ? getComputedStyle(statusRail).display : null,
                leftRailWidth: leftRailRect?.width ?? 0,
                statusRailWidth: statusRailRect?.width ?? 0,
                tutorialCenterOffset: tutorialRect
                    ? Math.abs((tutorialRect.left + tutorialRect.width / 2) - window.innerWidth / 2)
                    : null,
            };
        });

        expect(mobileLayout.viewportWidth).toBeGreaterThan(mobileLayout.viewportHeight);
        expect(mobileLayout.layoutMode).toBe('desktop-board');
        expect(mobileLayout.roomPanelRole).toBeNull();
        expect(mobileLayout.inventoryRole).toBeNull();
        expect(mobileLayout.actionRole).toBeNull();
        expect(mobileLayout.shellTransform).not.toBeNull();
        expect(mobileLayout.shellTransform).not.toBe('none');
        expect(mobileLayout.shellLeft ?? 999).toBeGreaterThanOrEqual(-1);
        expect(mobileLayout.shellRight ?? -999).toBeLessThanOrEqual(mobileLayout.viewportWidth + 1);
        expect(mobileLayout.boardWidth).toBeGreaterThan(800);
        expect(mobileLayout.boardHeight).toBeGreaterThan(360);
        expect(mobileLayout.roomGridWidth).toBeGreaterThan(760);
        expect(mobileLayout.roomGridHeight).toBeGreaterThan(300);
        expect(mobileLayout.roomPanelBottomPadding).toBeGreaterThanOrEqual(80);
        expect(mobileLayout.floatingChatButtonVisible).toBe(true);
        expect(mobileLayout.inventoryRailBottomGap).not.toBeNull();
        expect(mobileLayout.inventoryRailBottomGap ?? 999).toBeLessThanOrEqual(112);
        expect(mobileLayout.inventoryRailLeft ?? 999).toBeLessThanOrEqual(12);
        expect(mobileLayout.actionRailBottomGap ?? 999).toBeLessThanOrEqual(8);
        expect(mobileLayout.actionRailLeft ?? 999).toBeGreaterThanOrEqual(-1);
        expect(mobileLayout.actionRailWidth).toBeGreaterThan(760);
        expect(mobileLayout.visibleDesktopActionCount).toBeGreaterThan(0);
        expect(mobileLayout.visibleMobileDockCount).toBe(0);
        expect(mobileLayout.firstDesktopActionVisible).toBe(true);
        expect(mobileLayout.roomCanvasTransform).not.toBe('none');
        expect(mobileLayout.leftRailDisplay).toBe('grid');
        expect(mobileLayout.statusRailDisplay).toBe('flex');
        expect(mobileLayout.leftRailWidth).toBeGreaterThan(180);
        expect(mobileLayout.statusRailWidth).toBeGreaterThan(140);
        expect(mobileLayout.tutorialCenterOffset).not.toBeNull();
        expect(mobileLayout.tutorialCenterOffset ?? 999).toBeLessThanOrEqual(96);

        await saveScreenshot(page, MOBILE_STEP_01);
        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-phone-landscape', diagnostics }]);
    });

    test('PC 教程布局不应被手机横屏分支改写', async ({ page, context }) => {
        test.setTimeout(90000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-pc-layout-regression');

        await page.setViewportSize({ width: 1600, height: 900 });
        await page.goto('/play/betrayal/tutorial/basic-setup-and-turn', { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await advanceToStep(page, 'use-book');
        await waitForStep(page, 'use-book');
        await expect(page.getByTestId('betrayal-board')).toBeVisible();
        await expect(page.getByTestId('betrayal-desktop-layout')).toBeVisible();
        await expect(page.getByTestId('betrayal-desktop-layout')).toHaveAttribute('data-layout-mode', 'desktop-board');
        await expect(page.getByTestId('betrayal-mobile-landscape-layout')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mobile-stage-status')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mobile-context-strip')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-mobile-traits-strip')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-left-status-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-status-rail')).toBeVisible();
        await expect(page.getByTestId('betrayal-room-panel')).not.toHaveAttribute('data-mobile-role', /primary-board-stage/);
        await expect(page.getByTestId('betrayal-inventory-section')).not.toHaveAttribute('data-mobile-role', /possession-rail/);

        const pcLayout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector<HTMLElement>(selector);
                if (!element) return null;
                const box = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                return {
                    display: style.display,
                    left: Math.round(box.left),
                    width: Math.round(box.width),
                    height: Math.round(box.height),
                };
            };

            const roomCanvas = document.querySelector<HTMLElement>('[data-testid="betrayal-room-canvas"]');
            const roomCanvasScale = (() => {
                if (!roomCanvas) return null;
                const transform = window.getComputedStyle(roomCanvas).transform;
                if (!transform || transform === 'none') return { scaleX: 1, scaleY: 1 };
                const match = transform.match(/^matrix\(([^)]+)\)$/);
                if (!match) return null;
                const parts = match[1].split(',').map((part) => Number(part.trim()));
                return { scaleX: parts[0], scaleY: parts[3] };
            })();

            return {
                viewport: { width: window.innerWidth, height: window.innerHeight },
                leftRail: rect('[data-testid="betrayal-left-status-rail"]'),
                rightRail: rect('[data-testid="betrayal-status-rail"]'),
                phaseChip: rect('[data-testid="betrayal-phase-chip"]'),
                inventory: rect('[data-testid="betrayal-inventory-section"]'),
                mobileActionRail: rect('[data-testid="betrayal-mobile-action-rail"]'),
                mobileStage: rect('[data-testid="betrayal-mobile-stage-status"]'),
                roomCanvasScale,
            };
        });

        expect(pcLayout.viewport).toEqual({ width: 1600, height: 900 });
        expect(pcLayout.leftRail?.display).toBe('grid');
        expect(pcLayout.rightRail?.display).toBe('flex');
        expect(pcLayout.phaseChip?.display).toBe('flex');
        expect(pcLayout.phaseChip).not.toBeNull();
        if (pcLayout.phaseChip) {
            const phaseChipCenter = pcLayout.phaseChip.left + pcLayout.phaseChip.width / 2;
            expect(Math.abs(phaseChipCenter - pcLayout.viewport.width / 2)).toBeLessThanOrEqual(2);
        }
        expect(pcLayout.leftRail?.width).toBeGreaterThan(250);
        expect(pcLayout.rightRail?.width).toBeGreaterThan(190);
        expect(pcLayout.inventory?.left).toBeLessThanOrEqual(12);
        expect(pcLayout.inventory?.width).toBeGreaterThan(330);
        expect(pcLayout.roomCanvasScale?.scaleX).toBeCloseTo(1, 3);
        expect(pcLayout.roomCanvasScale?.scaleY).toBeCloseTo(1, 3);
        expect(pcLayout.mobileActionRail === null || (
            pcLayout.mobileActionRail.width === 0
            && pcLayout.mobileActionRail.height === 0
        )).toBe(true);
        expect(pcLayout.mobileStage).toBeNull();

        await saveScreenshot(page, PC_REGRESSION_STEP_USE_BOOK);

        await page.getByTestId('betrayal-inventory-omen-book').click();
        await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toContainText('书本');
        await expect(page.getByTestId('betrayal-action-use')).toBeEnabled();
        await page.getByTestId('betrayal-action-use').click();
        await waitForStep(page, 'open-move-targets');
        await expect(page.getByTestId('betrayal-action-move')).toBeVisible();
        await page.getByTestId('betrayal-action-move').click();
        await waitForStep(page, 'move-to-hallway');
        await expect(page.getByTestId('betrayal-room-hallway')).toBeVisible();
        await saveScreenshot(page, PC_REGRESSION_STEP_BOARD);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-pc-layout-regression', diagnostics }]);
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
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('所有英雄倒下');
        await clickNext(page);

        await waitForStep(page, 'attack-hero');
        const attackTarget = page.getByTestId('betrayal-room-occupant-ground-north-1');
        await expect(attackTarget, '叛徒教程攻击英雄主路径必须点击地图上的英雄 token 本体').toBeVisible();
        await expect(attackTarget, '教程英雄 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-ground-north-1'), '教程英雄 token 必须有贴合本体的五边形高亮').toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, STEP_24);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
        await attackTarget.click();

        await waitForStep(page, 'traitor-finish', 30000);
        const traitorEndgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(traitorEndgameScreen).toBeVisible({ timeout: 30000 });
        await expect(traitorEndgameScreen).toContainText('叛徒得逞');
        await saveScreenshot(page, STEP_25);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-traitor-path', diagnostics }]);
    });

    test('英雄攻击教程会打开剧本并进入真实攻击骰盘', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-hero-attack-path');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal/tutorial', { waitUntil: 'domcontentloaded' });

        const heroAttackTutorialEntry = page.getByTestId('tutorial-catalog-entry-hero-attack-path');
        await expect(heroAttackTutorialEntry).toBeVisible({ timeout: 30000 });
        await heroAttackTutorialEntry.click();
        await waitForBetrayalPageReady(page);
        await waitForHauntRuntime(page, 30000);

        await waitForStep(page, 'hero-attack-objective');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('打开剧本提示');
        await page.getByTestId('betrayal-open-scenario').click();
        const heroAttackScenarioPage = page.getByTestId('betrayal-scenario-objective-page');
        await expect(heroAttackScenarioPage).toBeVisible();
        await expect(heroAttackScenarioPage).toContainText('英雄目标');
        await expect(heroAttackScenarioPage).toContainText('杰克之灵');
        await page.getByTestId('betrayal-reference-close').click();
        await expect(page.getByTestId('betrayal-reference-overlay')).toBeHidden();
        await clickNext(page);

        await waitForStep(page, 'attack-traitor');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('攻击叛徒');
        const attackTraitorTarget = page.getByTestId('betrayal-room-occupant-basement-east-2');
        await expect(attackTraitorTarget, '英雄攻击教程主路径必须点击地图上的叛徒 token 本体').toBeVisible();
        await expect(attackTraitorTarget, '教程叛徒 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-basement-east-2'), '教程叛徒 token 必须有贴合本体的五边形高亮').toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, STEP_22);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
        await attackTraitorTarget.click();

        await waitForStep(page, 'hero-attack-review', 30000);
        const heroAttackReview = page.getByTestId('betrayal-attack-roll-review');
        await expect(heroAttackReview).toBeVisible({ timeout: 30000 });
        const heroAttackRollPanel = heroAttackReview.getByTestId('betrayal-recent-roll-panel');
        await expect(heroAttackRollPanel).toBeVisible({ timeout: 30000 });
        await expect(heroAttackRollPanel).toContainText(/攻击|叛徒|杰克之灵/);
        await expect(heroAttackRollPanel).toContainText(/总点数|Total/i);
        await expect(heroAttackRollPanel).toHaveAttribute('data-roll-panel-style', 'open-table-transparent');
        await expectVisiblePhysicalDiceBox(heroAttackRollPanel);
        await waitForPhysicalDiceSettled(heroAttackRollPanel);
        await saveScreenshot(page, STEP_23);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-hero-attack-path', diagnostics }]);
    });

    test('杰克之灵教程会打开剧本并用同一攻击骰盘结算怪物攻击', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context, { skipTutorial: false });
        const diagnostics = attachPageDiagnostics(page, 'betrayal-tutorial-jack-spirit-path');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal/tutorial', { waitUntil: 'domcontentloaded' });

        const jackSpiritTutorialEntry = page.getByTestId('tutorial-catalog-entry-jack-spirit-path');
        await expect(jackSpiritTutorialEntry).toBeVisible({ timeout: 30000 });
        await jackSpiritTutorialEntry.click();
        await waitForBetrayalPageReady(page);
        await waitForHauntRuntime(page, 30000);

        await waitForStep(page, 'jack-spirit-objective');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('杰克之灵的目标');
        await page.getByTestId('betrayal-open-scenario').click();
        const jackSpiritScenarioPage = page.getByTestId('betrayal-scenario-objective-page');
        await expect(jackSpiritScenarioPage).toBeVisible();
        await expect(jackSpiritScenarioPage).toContainText('杰克之灵');
        await expect(jackSpiritScenarioPage).toContainText('回到尸体房间');
        await saveScreenshot(page, STEP_26);
        await page.getByTestId('betrayal-reference-close').click();
        await expect(page.getByTestId('betrayal-reference-overlay')).toBeHidden();
        await clickNext(page);

        await waitForStep(page, 'jack-spirit-attack');
        await expect(page.getByTestId('tutorial-overlay-card')).toContainText('怪物攻击');
        const jackSpiritAttackTarget = page.getByTestId('betrayal-room-occupant-basement-east-0');
        await expect(jackSpiritAttackTarget, '杰克之灵教程攻击主路径必须点击地图上的英雄 token 本体').toBeVisible();
        await expect(jackSpiritAttackTarget, '教程英雄 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-basement-east-0'), '教程英雄 token 必须有贴合本体的五边形高亮').toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, STEP_27);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01]);
        await jackSpiritAttackTarget.click();

        await waitForStep(page, 'jack-spirit-review', 30000);
        const jackSpiritAttackReview = page.getByTestId('betrayal-attack-roll-review');
        await expect(jackSpiritAttackReview).toBeVisible({ timeout: 30000 });
        const jackSpiritRollPanel = jackSpiritAttackReview.getByTestId('betrayal-recent-roll-panel');
        await expect(jackSpiritRollPanel).toBeVisible();
        await expect(jackSpiritRollPanel).toContainText(/攻击|杰克之灵|英雄/);
        await expect(jackSpiritRollPanel).toHaveAttribute('data-roll-panel-style', 'open-table-transparent');
        const jackSpiritDiceGroup = jackSpiritRollPanel.getByTestId('betrayal-house-dice-3d-group');
        await expect(jackSpiritDiceGroup).toBeVisible();
        await expect(jackSpiritDiceGroup).toHaveAttribute('data-render-mode', 'betrayal-house-dice-box-visible');
        await expect(jackSpiritDiceGroup).toHaveAttribute('data-dice-tray-style', 'transparent-virtual');
        await expect(jackSpiritDiceGroup).toHaveAttribute('data-dice-count', /[1-9]/);
        await expect(jackSpiritRollPanel.getByTestId('betrayal-recent-roll-total')).toContainText(/总点数|Total/i);
        await saveScreenshot(page, STEP_28);

        assertNoFatalFrontendErrors([{ label: 'betrayal-tutorial-jack-spirit-path', diagnostics }]);
    });
});
