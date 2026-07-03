import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioReadyToLearnAboutJackRuntimeCore,
    createFirstScenarioReadyToStudyExorcismRuntimeCore,
    createHeroAttackTraitorReadyRuntimeCore,
    createTradeReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-首剧本核心交互';
const TRADE_INITIAL_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-交易-初始待选择.png`;
const TRADE_ITEM_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-交易-已选物品.png`;
const TRADE_TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-交易-已选目标待确认.png`;
const TRADE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-交易-交出后.png`;
const LEARN_READY_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-调查杰克-执行前.png`;
const LEARN_DONE_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-调查杰克-成功后.png`;
const STUDY_READY_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-研究法阵-执行前.png`;
const STUDY_DONE_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-研究法阵-成功后.png`;
const ATTACK_READY_SCREENSHOT = `${EVIDENCE_DIR}/09-山屋惊魂-英雄攻击叛徒-执行前.png`;
const ATTACK_DONE_SCREENSHOT = `${EVIDENCE_DIR}/10-山屋惊魂-英雄攻击叛徒-命中后.png`;

async function assertTradeLayoutDoesNotCoverMap(page: import('@playwright/test').Page) {
    const metrics = await page.evaluate(() => {
        const rectOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            };
        };
        const rope = document.querySelector('[data-testid="betrayal-inventory-rope"]');
        const ropeImage = rope?.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-rope-front-atlas"]');
        const omenBook = document.querySelector('[data-testid="betrayal-inventory-omen-book"]');
        const omenBookImage = omenBook?.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-omen-book-front-atlas"]');
        const ropeText = rope?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const allInventoryText = document.querySelector('[data-testid="betrayal-inventory-section"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

        return {
            inventory: rectOf('betrayal-inventory-section'),
            itemRow: rectOf('betrayal-inventory-row-item'),
            omenRow: rectOf('betrayal-inventory-row-omen'),
            roomGrid: rectOf('betrayal-room-grid'),
            roomPanel: rectOf('betrayal-room-panel'),
            rope: rectOf('betrayal-inventory-rope'),
            omenBook: rectOf('betrayal-inventory-omen-book'),
            ropeImageAsset: ropeImage?.getAttribute('data-asset-src') ?? '',
            ropeImageLoaded: Boolean(ropeImage?.complete && ropeImage.naturalWidth > 0 && ropeImage.naturalHeight > 0),
            omenBookImageAsset: omenBookImage?.getAttribute('data-asset-src') ?? '',
            omenBookImageLoaded: Boolean(omenBookImage?.complete && omenBookImage.naturalWidth > 0 && omenBookImage.naturalHeight > 0),
            ropeText,
            allInventoryText,
        };
    });

    expect(metrics.inventory, '持有区必须存在').not.toBeNull();
    expect(metrics.itemRow, '物品行必须存在').not.toBeNull();
    expect(metrics.omenRow, '预兆行必须存在').not.toBeNull();
    expect(metrics.roomGrid, '地图区域必须存在').not.toBeNull();
    expect(metrics.roomPanel, '地图面板必须存在').not.toBeNull();
    expect(metrics.rope, '兔脚卡必须存在').not.toBeNull();
    expect(metrics.omenBook, '书本预兆卡必须存在').not.toBeNull();
    expect(metrics.ropeImageAsset, '兔脚应挂载正式物品牌面 atlas，不应退回纯文字牌').toContain('item-front-atlas');
    expect(metrics.ropeImageLoaded, '兔脚正式物品牌面必须真实加载完成').toBe(true);
    expect(metrics.omenBookImageAsset, '书本应挂载正式预兆牌面 atlas，不应退回纯文字牌').toContain('omen-front-atlas');
    expect(metrics.omenBookImageLoaded, '书本正式预兆牌面必须真实加载完成').toBe(true);
    expect(metrics.ropeText, '兔脚不应显示“正面缺失”回退文案').not.toContain('正面缺失');
    expect(metrics.allInventoryText, '交易持有区不应出现“缺正面”回退文案').not.toContain('缺正面');

    const inventory = metrics.inventory!;
    const roomGrid = metrics.roomGrid!;
    const roomPanel = metrics.roomPanel!;
    const itemRow = metrics.itemRow!;
    const omenRow = metrics.omenRow!;
    expect(inventory.right, '桌面持有区应留在左侧栏，不能压进地图列').toBeLessThanOrEqual(roomPanel.left + 8);
    expect(inventory.bottom, '持有区底部不能作为底部挡板覆盖地图下沿').toBeLessThanOrEqual(roomGrid.bottom + 1);
    expect(itemRow.height, '物品行不能撑成底部挡板').toBeLessThanOrEqual(130);
    expect(omenRow.height, '预兆行不能撑成底部挡板').toBeLessThanOrEqual(130);
}

async function assertTradeFlowLooksLoose(page: import('@playwright/test').Page) {
    const metrics = await page.evaluate(() => {
        const hasVisibleShadow = (boxShadow: string) => (
            boxShadow !== 'none'
            && !boxShadow.split('),').every((shadow) => /rgba\(0,\s*0,\s*0,\s*0\)/.test(shadow))
        );
        const styleOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
                backgroundColor: style.backgroundColor,
                boxShadow: style.boxShadow,
                hasVisibleShadow: hasVisibleShadow(style.boxShadow),
                borderColor: style.borderColor,
                borderStyle: style.borderStyle,
                borderWidth: style.borderWidth,
                display: style.display,
                text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                rect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                },
            };
        };

        return {
            banner: styleOf('betrayal-trade-flow-banner'),
            itemStep: styleOf('betrayal-trade-flow-item-step'),
            targetStep: styleOf('betrayal-trade-flow-target-step'),
            tradeButton: styleOf('betrayal-action-trade'),
        };
    });

    expect(metrics.banner, '交易流程容器必须存在').not.toBeNull();
    expect(metrics.itemStep, '交易物品步骤按钮必须存在').not.toBeNull();
    expect(metrics.targetStep, '交易目标步骤按钮必须存在').not.toBeNull();
    expect(metrics.tradeButton, '交易确认按钮必须存在').not.toBeNull();
    expect(metrics.banner!.backgroundColor, '交易流程容器不能有黑底挡板').toBe('rgba(0, 0, 0, 0)');
    expect(metrics.banner!.hasVisibleShadow, '交易流程容器不能有整块阴影').toBe(false);
    expect(metrics.itemStep!.hasVisibleShadow, '物品步骤不能有黑色块状阴影').toBe(false);
    expect(metrics.targetStep!.hasVisibleShadow, '目标步骤不能有黑色块状阴影').toBe(false);
    expect(metrics.itemStep!.borderWidth, '物品步骤不能像黑边框块').toBe('0px');
    expect(metrics.targetStep!.borderWidth, '目标步骤不能像黑边框块').toBe('0px');
    expect(metrics.tradeButton!.borderWidth, '确认交易不能像黑边框块').toBe('0px');
    expect(metrics.tradeButton!.text, '确认交易按钮必须显示可读文字').toContain('交易确认');
    expect(metrics.tradeButton!.rect.width, '确认交易按钮不能窄成空胶囊').toBeGreaterThanOrEqual(70);
    expect(metrics.itemStep!.rect.width, '物品步骤应是小胶囊，不是整块横幅').toBeLessThan(190);
    expect(metrics.targetStep!.rect.width, '目标步骤应是小胶囊，不是整块横幅').toBeLessThan(220);
}

async function assertSelectedInventoryCardHasVisibleOutline(page: import('@playwright/test').Page) {
    const metrics = await page.evaluate(() => {
        const rope = document.querySelector('[data-testid="betrayal-inventory-rope"]');
        const selectedRing = document.querySelector('[data-testid="betrayal-inventory-rope-selected-ring"]');
        const selectedHalo = document.querySelector('[data-testid="betrayal-inventory-rope-selected-halo"]');
        const selectedLabel = document.querySelector('[data-testid="betrayal-inventory-rope-selected-label"]');
        if (!rope || !selectedRing || !selectedHalo || !selectedLabel) return null;
        const ringStyle = window.getComputedStyle(selectedRing);
        const haloStyle = window.getComputedStyle(selectedHalo);
        const labelStyle = window.getComputedStyle(selectedLabel);
        const ropeRect = rope.getBoundingClientRect();
        const ringRect = selectedRing.getBoundingClientRect();
        const haloRect = selectedHalo.getBoundingClientRect();
        return {
            ringWidth: ringRect.width,
            ringHeight: ringRect.height,
            ringColor: ringStyle.getPropertyValue('--tw-ring-color') || ringStyle.boxShadow,
            haloWidth: haloRect.width,
            haloHeight: haloRect.height,
            haloBorderWidth: haloStyle.borderTopWidth,
            haloBorderColor: haloStyle.borderTopColor,
            labelText: selectedLabel.textContent?.trim() ?? '',
            labelDisplay: labelStyle.display,
            hasSelectedLabel: rope.textContent?.includes('已选') ?? false,
            ropeTop: ropeRect.top,
        };
    });

    expect(metrics, '必须能读取兔脚选中态').not.toBeNull();
    const isYellow = (color: string) => color.includes('255') || color.toLowerCase().includes('#ffe06e');
    expect(parseFloat(metrics!.haloBorderWidth), '选中物品外描边不能太细').toBeGreaterThanOrEqual(3);
    expect(isYellow(metrics!.haloBorderColor), '选中物品外描边应使用醒目的黄色').toBe(true);
    expect(metrics!.haloWidth, '选中物品外描边必须包住牌面宽度').toBeGreaterThan(metrics!.ringWidth);
    expect(metrics!.haloHeight, '选中物品外描边必须包住牌面高度').toBeGreaterThan(metrics!.ringHeight);
    expect(metrics!.ringWidth, '选中物品内部描边必须覆盖牌面宽度').toBeGreaterThan(40);
    expect(metrics!.ringHeight, '选中物品内部描边必须覆盖牌面高度').toBeGreaterThan(60);
    expect(isYellow(metrics!.ringColor), '选中物品内部描边应使用醒目的黄色').toBe(true);
    expect(metrics!.labelText, '选中物品必须显示“已选”标签').toContain('已选');
    expect(metrics!.labelDisplay, '选中标签不能被隐藏').not.toBe('none');
    expect(metrics!.hasSelectedLabel, '选中物品必须有“已选”标签').toBe(true);
    expect(metrics!.ropeTop, '选中物品上移后仍应完整露出').toBeGreaterThanOrEqual(0);
}

async function openBetrayalBoard(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
    await initBetrayalContext(context);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/play/betrayal', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await waitForBetrayalPageReady(page);
}

test.describe('山屋惊魂首剧本核心交互补充', () => {
    test('真实页面可完成活玩家交易', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-trade-interaction');

        await openBetrayalBoard(page, context);
        await injectCore(page, createTradeReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('交易');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText('同房间可交易对象：1人');
        await expect(page.getByText('请选择交易目标')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-trade-flow-banner')).toHaveAttribute('aria-label', '交易：先选持有物，再选同房间目标');
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText('物品');
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText('待选');
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('目标');
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('待选');
        await expect(page.getByText('首剧本开始：恶兆前探索')).toBeHidden();
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-trade-shortcut')).toHaveCount(0);
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeFlowLooksLoose(page);
        await saveScreenshot(page, TRADE_INITIAL_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-rope').click();
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText('兔脚');
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('待选');
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeFlowLooksLoose(page);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_ITEM_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-bottom-teammate-1').click();
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText('兔脚');
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('丽贝卡·艾伦博士');
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeFlowLooksLoose(page);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_TARGET_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                currentExplorer?: { inventory?: Array<{ id: string; name: string }> };
                                otherExplorers?: Array<{ playerId: string; inventory?: Array<{ id: string; name: string }> }>;
                                activityLog?: Array<{ text: string }>;
                            };
                        };
                    };
                };
                __BG_LAST_COMMAND_REJECTED__?: { error: string; commandType: string };
            };
            const state = holder.__BG_TEST_HARNESS__?.state?.get?.();
            return {
                currentInventory: state?.core?.currentExplorer?.inventory?.map((item) => item.name) ?? [],
                teammateInventory: state?.core?.otherExplorers?.find((explorer) => explorer.playerId === '1')?.inventory?.map((item) => item.name) ?? [],
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '交易点击后应把物品移到目标玩家，并写入活动日志',
        }).toMatchObject({
            currentInventory: expect.not.arrayContaining(['兔脚']),
            teammateInventory: expect.arrayContaining(['兔脚']),
            latestLog: expect.stringMatching(/交给|兔脚|丽贝卡·艾伦博士/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/交给|兔脚|丽贝卡·艾伦博士/);
        await saveScreenshot(page, TRADE_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-trade-interaction', diagnostics }]);
    });

    test('真实页面可调查杰克并获得线索', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-learn-jack-interaction');

        await openBetrayalBoard(page, context);
        await injectCore(page, createFirstScenarioReadyToLearnAboutJackRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('调查杰克');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText('调查杰克');
        await saveScreenshot(page, LEARN_READY_SCREENSHOT);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-action-use').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/Crimson Jack|线索|查到/);
        await saveScreenshot(page, LEARN_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-learn-jack-interaction', diagnostics }]);
    });

    test('真实页面可研究驱魔法阵', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-study-exorcism-interaction');

        await openBetrayalBoard(page, context);
        await injectCore(page, createFirstScenarioReadyToStudyExorcismRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('研究法阵');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText('研究法阵');
        await saveScreenshot(page, STUDY_READY_SCREENSHOT);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-action-use').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/法阵|驱魔|研究/);
        await saveScreenshot(page, STUDY_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-study-exorcism-interaction', diagnostics }]);
    });

    test('真实页面可由英雄攻击叛徒', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-hero-attack-traitor-interaction');

        await openBetrayalBoard(page, context);
        await injectCore(page, createHeroAttackTraitorReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText('攻击叛徒');
        await saveScreenshot(page, ATTACK_READY_SCREENSHOT);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01]);
        await page.getByTestId('betrayal-room-focus-target').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/攻击|造成|physical damage|击倒/);
        await saveScreenshot(page, ATTACK_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-hero-attack-traitor-interaction', diagnostics }]);
    });
});
