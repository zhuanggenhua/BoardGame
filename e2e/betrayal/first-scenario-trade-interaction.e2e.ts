import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createTradeReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-首剧本核心交互';
const TRADE_INITIAL_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-交易-初始待选择.png`;
const TRADE_ITEM_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-交易-已选物品.png`;
const TRADE_TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-交易-已选目标待确认.png`;
const TRADE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-交易-交出后.png`;

async function assertTradeLayoutDoesNotCoverMap(page: Page) {
    const metrics = await page.evaluate(() => {
        const rectOf = (testId: string) => {
            const element = document.querySelector(`[data-testid="${testId}"]`);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom,
                height: rect.height,
            };
        };
        const rope = document.querySelector('[data-testid="betrayal-inventory-rope"]');
        const ropeImage = rope?.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-rope-front-atlas"]');
        const omenBook = document.querySelector('[data-testid="betrayal-inventory-omen-book"]');
        const omenBookImage = omenBook?.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-omen-book-front-atlas"]');
        const ropeText = rope?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const allInventoryText = document.querySelector('[data-testid="betrayal-inventory-section"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const mobileDockActions = document.querySelectorAll('[data-testid^="betrayal-mobile-dock-"]').length;

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
            mobileDockActions,
        };
    });

    expect(metrics.inventory, '持有区必须存在').not.toBeNull();
    expect(metrics.itemRow, '物品行必须存在').not.toBeNull();
    expect(metrics.omenRow, '预兆行必须存在').not.toBeNull();
    expect(metrics.roomGrid, '地图区域必须存在').not.toBeNull();
    expect(metrics.roomPanel, '地图面板必须存在').not.toBeNull();
    expect(metrics.rope, '兔脚卡必须存在').not.toBeNull();
    expect(metrics.omenBook, '书本预兆卡必须存在').not.toBeNull();
    expect(metrics.rope!.right - metrics.rope!.left, '兔脚交易牌面必须保持原持有区卡牌宽度，不能退成文字按钮').toBeGreaterThanOrEqual(58);
    expect(metrics.omenBook!.right - metrics.omenBook!.left, '预兆交易牌面必须保持原持有区卡牌宽度，不能退成文字按钮').toBeGreaterThanOrEqual(58);
    expect(metrics.ropeImageAsset, '兔脚应挂载正式物品牌面 atlas，不应退回纯文字牌').toContain('item-front-atlas');
    expect(metrics.ropeImageLoaded, '兔脚正式物品牌面必须真实加载完成').toBe(true);
    expect(metrics.omenBookImageAsset, '书本应挂载正式预兆牌面 atlas，不应退回纯文字牌').toContain('omen-front-atlas');
    expect(metrics.omenBookImageLoaded, '书本正式预兆牌面必须真实加载完成').toBe(true);
    expect(metrics.ropeText, '兔脚不应显示“正面缺失”回退文案').not.toContain('正面缺失');
    expect(metrics.allInventoryText, '交易持有区不应出现“缺正面”回退文案').not.toContain('缺正面');
    expect(metrics.mobileDockActions, '交易态不应渲染底部行动 dock，避免形成黑底挡板').toBe(0);

    expect(metrics.inventory!.right, '桌面持有区应留在原左侧栏，不能压进地图列').toBeLessThanOrEqual(metrics.roomPanel!.left + 8);
}

async function assertTradeFlowLooksLoose(page: Page) {
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
                backgroundImage: style.backgroundImage,
                borderWidth: style.borderWidth,
                boxShadow: style.boxShadow,
                filter: style.filter,
                hasVisibleShadow: hasVisibleShadow(style.boxShadow),
                text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                width: rect.width,
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
    expect(metrics.itemStep!.backgroundColor, '物品步骤不能有黑底').toBe('rgba(0, 0, 0, 0)');
    expect(metrics.targetStep!.backgroundColor, '目标步骤不能有黑底').toBe('rgba(0, 0, 0, 0)');
    expect(metrics.tradeButton!.backgroundColor, '确认交易不能有黑底').toBe('rgba(0, 0, 0, 0)');
    expect(metrics.itemStep!.backgroundImage, '物品步骤不能有背景图或原生按钮底').toBe('none');
    expect(metrics.targetStep!.backgroundImage, '目标步骤不能有背景图或原生按钮底').toBe('none');
    expect(metrics.tradeButton!.backgroundImage, '确认交易不能有背景图或原生按钮底').toBe('none');
    expect(metrics.itemStep!.boxShadow, '物品步骤不能带黑色块阴影').toBe('none');
    expect(metrics.targetStep!.boxShadow, '目标步骤不能带黑色块阴影').toBe('none');
    expect(metrics.tradeButton!.boxShadow, '确认交易不能带黑色块阴影').toBe('none');
    expect(metrics.itemStep!.filter, '物品步骤不能靠黑色投影伪装成块').toBe('none');
    expect(metrics.targetStep!.filter, '目标步骤不能靠黑色投影伪装成块').toBe('none');
    expect(metrics.tradeButton!.filter, '确认交易不能靠黑色投影伪装成块').toBe('none');
    expect(metrics.itemStep!.borderWidth, '物品步骤不能像黑边框块').toBe('0px');
    expect(metrics.targetStep!.borderWidth, '目标步骤不能像黑边框块').toBe('0px');
    expect(metrics.tradeButton!.borderWidth, '确认交易不能像黑边框块').toBe('0px');
    expect(metrics.tradeButton!.text, '确认交易按钮必须显示可读文字').toContain('交易确认');
    expect(metrics.tradeButton!.width, '确认交易按钮不能窄成空胶囊').toBeGreaterThanOrEqual(60);
    expect(metrics.itemStep!.width, '物品步骤应是松散小按钮，不是整块横幅').toBeLessThan(190);
    expect(metrics.targetStep!.width, '目标步骤应是松散小按钮，不是整块横幅').toBeLessThan(220);
}

async function assertTradeTargetLooksLoose(page: Page) {
    const metrics = await page.evaluate(() => {
        const target = document.querySelector('[data-testid="betrayal-bottom-teammate-1"]');
        if (!target) return null;
        const style = window.getComputedStyle(target);
        const avatar = target.querySelector('img');
        const statBadges = target.querySelectorAll('[title^="力量"], [title^="速度"], [title^="知识"], [title^="理智"]').length;
        return {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            borderWidth: style.borderWidth,
            boxShadow: style.boxShadow,
            avatarCount: avatar ? 1 : 0,
            statBadges,
            text: target.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        };
    });

    expect(metrics, '交易目标按钮必须存在').not.toBeNull();
    expect(metrics!.backgroundColor, '交易目标按钮不能有黑底').toBe('rgba(0, 0, 0, 0)');
    expect(metrics!.backgroundImage, '交易目标按钮不能有背景图').toBe('none');
    expect(metrics!.borderWidth, '交易目标按钮不能像黑边框卡片').toBe('0px');
    expect(metrics!.boxShadow, '交易目标按钮不能带黑色块阴影').toBe('none');
    expect(metrics!.avatarCount, '交易目标按钮不应在交易态显示头像块').toBe(0);
    expect(metrics!.statBadges, '交易目标按钮不应在交易态显示属性小黑底').toBe(0);
    expect(metrics!.text, '交易目标按钮必须保留目标名字').toContain('丽贝卡·艾伦博士');
}

async function assertSelectedInventoryCardHasVisibleOutline(page: Page) {
    const metrics = await page.evaluate(() => {
        const rope = document.querySelector('[data-testid="betrayal-inventory-rope"]');
        const selectedShell = document.querySelector('[data-testid="betrayal-inventory-rope-shell"]');
        const selectedRing = document.querySelector('[data-testid="betrayal-inventory-rope-selected-ring"]');
        const selectedLabel = document.querySelector('[data-testid="betrayal-inventory-rope-selected-label"]');
        if (!rope || !selectedShell || !selectedRing || !selectedLabel) return null;
        const shellStyle = window.getComputedStyle(selectedShell);
        const ringStyle = window.getComputedStyle(selectedRing);
        const labelStyle = window.getComputedStyle(selectedLabel);
        const ropeStyle = window.getComputedStyle(rope);
        const ropeRect = rope.getBoundingClientRect();
        const shellRect = selectedShell.getBoundingClientRect();
        const ringRect = selectedRing.getBoundingClientRect();
        return {
            buttonBoxShadow: ropeStyle.boxShadow,
            shellBoxShadow: shellStyle.boxShadow,
            shellBorderColor: shellStyle.borderTopColor,
            shellWidth: shellRect.width,
            shellHeight: shellRect.height,
            ringWidth: ringRect.width,
            ringHeight: ringRect.height,
            ringColor: ringStyle.getPropertyValue('--tw-ring-color') || ringStyle.boxShadow,
            labelText: selectedLabel.textContent?.trim() ?? '',
            labelDisplay: labelStyle.display,
            hasSelectedLabel: rope.textContent?.includes('已选') ?? false,
            ropeTop: ropeRect.top,
        };
    });

    expect(metrics, '必须能读取兔脚选中态').not.toBeNull();
    const isYellow = (color: string) => color.includes('255') || color.toLowerCase().includes('#ffe06e');
    expect(metrics!.buttonBoxShadow, '选中物品按钮本身必须有可见外描边阴影').not.toBe('none');
    expect(isYellow(metrics!.buttonBoxShadow), '选中物品按钮外描边应使用醒目的黄色').toBe(true);
    expect(metrics!.shellBoxShadow, '选中物品牌面壳层必须有内部粗描边').not.toBe('none');
    expect(isYellow(metrics!.shellBoxShadow), '选中物品牌面壳层内部描边应使用醒目的黄色').toBe(true);
    expect(isYellow(metrics!.shellBorderColor), '选中物品牌面边框应使用醒目的黄色').toBe(true);
    expect(metrics!.ringWidth, '选中物品内部描边必须覆盖牌面宽度').toBeGreaterThan(metrics!.shellWidth - 8);
    expect(metrics!.ringHeight, '选中物品内部描边必须覆盖牌面高度').toBeGreaterThan(metrics!.shellHeight - 8);
    expect(isYellow(metrics!.ringColor), '选中物品内部描边应使用醒目的黄色').toBe(true);
    expect(metrics!.labelText, '选中物品必须显示“已选”标签').toContain('已选');
    expect(metrics!.labelDisplay, '选中标签不能被隐藏').not.toBe('none');
    expect(metrics!.hasSelectedLabel, '选中物品必须有“已选”标签').toBe(true);
    expect(metrics!.ropeTop, '选中物品上移后仍应完整露出').toBeGreaterThanOrEqual(0);
}

test.describe('山屋惊魂首剧本交易交互', () => {
    test('真实页面可选物品、选目标并确认交易', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-trade-interaction');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createTradeReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('交易');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText('同房间可交易对象：1人');
        await expect(page.getByTestId('betrayal-trade-flow-banner')).toHaveAttribute('aria-label', '交易：先选持有物，再选同房间目标');
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText('待选');
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('待选');
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeFlowLooksLoose(page);
        await assertTradeTargetLooksLoose(page);
        await saveScreenshot(page, TRADE_INITIAL_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-rope').click();
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText('兔脚');
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('待选');
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeFlowLooksLoose(page);
        await assertTradeTargetLooksLoose(page);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_ITEM_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-bottom-teammate-1').click();
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toContainText('兔脚');
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('丽贝卡·艾伦博士');
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeFlowLooksLoose(page);
        await assertTradeTargetLooksLoose(page);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_TARGET_SELECTED_SCREENSHOT);

        const tradeButton = page.getByTestId('betrayal-action-trade');
        await expect(tradeButton, '确认交易按钮必须已经可点击').toBeEnabled();
        await tradeButton.click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                currentExplorer?: { inventory?: Array<{ name: string }> };
                                otherExplorers?: Array<{ playerId: string; inventory?: Array<{ name: string }> }>;
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
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.not.arrayContaining(['兔脚']),
            teammateInventory: expect.arrayContaining(['兔脚']),
            latestLog: expect.stringMatching(/交给|兔脚|丽贝卡·艾伦博士/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/交给|兔脚|丽贝卡·艾伦博士/);
        await saveScreenshot(page, TRADE_DONE_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-trade-interaction', diagnostics }]);
    });
});
