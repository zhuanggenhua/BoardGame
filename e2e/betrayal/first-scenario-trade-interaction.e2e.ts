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

async function waitForTradeInventoryAtlas(page: Page) {
    await expect.poll(async () => page.evaluate(() => {
        const ropeImage = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-rope-front-atlas"]');
        const omenBookImage = document.querySelector<HTMLImageElement>('[data-testid="betrayal-inventory-omen-book-front-atlas"]');
        return {
            ropeAsset: ropeImage?.getAttribute('data-asset-src') ?? '',
            ropeLoaded: Boolean(ropeImage?.complete && ropeImage.naturalWidth > 0 && ropeImage.naturalHeight > 0),
            omenBookAsset: omenBookImage?.getAttribute('data-asset-src') ?? '',
            omenBookLoaded: Boolean(omenBookImage?.complete && omenBookImage.naturalWidth > 0 && omenBookImage.naturalHeight > 0),
        };
    }), {
        message: '交易持有区正式牌面 atlas 必须加载完成后再验 UI',
        timeout: 15000,
    }).toEqual({
        ropeAsset: expect.stringContaining('item-front-atlas'),
        ropeLoaded: true,
        omenBookAsset: expect.stringContaining('omen-front-atlas'),
        omenBookLoaded: true,
    });
}

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
}

async function assertTradeActionBarKeepsButtons(page: Page) {
    const metrics = await page.evaluate(() => {
        const hasVisibleShadow = (boxShadow: string) => (
            boxShadow !== 'none'
            && !boxShadow.split('),').every((shadow) => /rgba\(0,\s*0,\s*0,\s*0\)/.test(shadow))
        );
        const styleOf = (selector: string) => {
            const element = document.querySelector(selector);
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

        const roomGrid = document.querySelector('[data-testid="betrayal-room-grid"]');
        const actionButtons = Array.from(document.querySelectorAll('button[data-testid^="betrayal-action-"]'));
        const skeletonActionBarExists = Boolean(document.querySelector('[data-component="action-bar"]'));
        const legacyActionZoneExists = Boolean(document.querySelector('[data-tutorial-id="betrayal-actions-zone"]'));
        const actionItemWrapperCount = document.querySelectorAll('[data-action-id]').length;
        const actionButtonParentTutorialIds = actionButtons.map((button) => (
            button.parentElement?.getAttribute('data-tutorial-id') ?? ''
        ));
        const actionButtonStyles = actionButtons.map((button) => {
            const style = window.getComputedStyle(button);
            return {
                id: button.getAttribute('data-testid') ?? '',
                backgroundColor: style.backgroundColor,
                backgroundImage: style.backgroundImage,
                borderWidth: style.borderWidth,
                boxShadow: style.boxShadow,
                filter: style.filter,
                hasVisibleShadow: hasVisibleShadow(style.boxShadow),
            };
        });
        const tradeButton = document.querySelector('[data-testid="betrayal-action-trade"]');
        const tradeButtonRect = tradeButton?.getBoundingClientRect();
        const roomShells = Array.from(document.querySelectorAll('[data-testid^="betrayal-room-shell-"]')).map((room) => {
            const rect = room.getBoundingClientRect();
            return {
                testId: room.getAttribute('data-testid') ?? '',
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            };
        });
        const buttonsWithinRoomGrid = actionButtons.every((button) => Boolean(roomGrid?.contains(button)));
        const buttonsDirectlyUnderRoomGrid = actionButtons.every((button) => button.parentElement?.getAttribute('data-testid') === 'betrayal-room-grid');
        const probeX = tradeButtonRect ? tradeButtonRect.left + tradeButtonRect.width / 2 : 0;
        const probeY = tradeButtonRect ? tradeButtonRect.top + tradeButtonRect.height / 2 : 0;
        const elementsUnderTradeButton = tradeButtonRect
            ? document.elementsFromPoint(probeX, probeY).map((element) => ({
                testId: element.getAttribute('data-testid') ?? '',
                tutorialId: element.getAttribute('data-tutorial-id') ?? '',
                component: element.getAttribute('data-component') ?? '',
                id: element.id,
            }))
            : [];
        const probeHitsRoomLayer = elementsUnderTradeButton.some((entry) => (
            entry.testId === 'betrayal-room-grid'
            || entry.testId === 'betrayal-room-canvas'
            || entry.testId.startsWith('betrayal-room-')
        ));
        const actionButtonRoomOverlaps = actionButtons.map((button) => {
            const rect = button.getBoundingClientRect();
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            const centerElements = document.elementsFromPoint(centerX, centerY).map((element) => ({
                testId: element.getAttribute('data-testid') ?? '',
            }));
            const centerHitsRoomLayer = centerElements.some((entry) => (
                entry.testId === 'betrayal-room-grid'
                || entry.testId === 'betrayal-room-canvas'
                || entry.testId.startsWith('betrayal-room-')
            ));
            return {
                id: button.getAttribute('data-testid') ?? '',
                top: rect.top,
                bottom: rect.bottom,
                centerX,
                centerY,
                centerHitsRoomLayer,
                overlappingRooms: roomShells
                    .filter((room) => !(room.right < rect.left || room.left > rect.right || room.bottom < rect.top || room.top > rect.bottom))
                    .map((room) => room.testId),
            };
        });
        const actionButtonsOverlapMap = actionButtonRoomOverlaps.every((entry) => entry.overlappingRooms.length > 0);
        const actionButtonsInsideViewport = actionButtonRoomOverlaps.every((entry) => entry.top >= 0 && entry.bottom <= window.innerHeight);
        const actionButtonCentersHitMap = actionButtonRoomOverlaps.every((entry) => entry.centerHitsRoomLayer);

        return {
            tradeButton: styleOf('[data-testid="betrayal-action-trade"]'),
            flowBannerExists: Boolean(document.querySelector('[data-testid="betrayal-trade-flow-banner"]')),
            itemStepExists: Boolean(document.querySelector('[data-testid="betrayal-trade-flow-item-step"]')),
            targetStepExists: Boolean(document.querySelector('[data-testid="betrayal-trade-flow-target-step"]')),
            actionCount: actionButtons.length,
            skeletonActionBarExists,
            legacyActionZoneExists,
            actionItemWrapperCount,
            actionButtonParentTutorialIds,
            actionButtonStyles,
            flowBanner: styleOf('[data-testid="betrayal-trade-flow-banner"]'),
            buttonsWithinRoomGrid,
            buttonsDirectlyUnderRoomGrid,
            probeHitsRoomLayer,
            elementsUnderTradeButton,
            actionButtonRoomOverlaps,
            actionButtonsOverlapMap,
            actionButtonsInsideViewport,
            actionButtonCentersHitMap,
        };
    });

    expect(metrics.tradeButton, '交易按钮必须保留在底部动作条里').not.toBeNull();
    expect(metrics.skeletonActionBarExists, '底部按钮不能再用 ActionBarSkeleton 生成整排骨架容器').toBe(false);
    expect(metrics.legacyActionZoneExists, '底部按钮不应再保留 betrayal-actions-zone 这种整排动作区概念').toBe(false);
    expect(metrics.actionItemWrapperCount, '底部每个按钮不能再套 data-action-id 外包层').toBe(0);
    expect(metrics.buttonsWithinRoomGrid, '动作按钮必须直接落在真实地图容器内').toBe(true);
    expect(metrics.buttonsDirectlyUnderRoomGrid, '动作按钮不能再被整排动作区容器包裹，必须直接挂在可视地图层').toBe(true);
    expect(metrics.actionButtonParentTutorialIds, '动作按钮父层不能是 betrayal-actions-zone').not.toContain('betrayal-actions-zone');
    expect(metrics.actionButtonsInsideViewport, `动作按钮必须在当前可视地图区域内，实际：${JSON.stringify(metrics.actionButtonRoomOverlaps)}`).toBe(true);
    expect(metrics.actionButtonsOverlapMap, `动作按钮必须压在房间地图内容上，不得浮在黑色空白区，实际：${JSON.stringify(metrics.actionButtonRoomOverlaps)}`).toBe(true);
    expect(metrics.actionButtonCentersHitMap, `动作按钮中心必须落在房间地图内容上，实际：${JSON.stringify(metrics.actionButtonRoomOverlaps)}`).toBe(true);
    expect(metrics.probeHitsRoomLayer, `交易按钮下面必须仍是地图/房间层，实际命中：${JSON.stringify(metrics.elementsUnderTradeButton)}`).toBe(true);
    expect(metrics.flowBannerExists, '交易态必须保留轻量操作提示').toBe(true);
    expect(metrics.flowBanner!.backgroundColor, '操作提示不能有黑底').toBe('rgba(0, 0, 0, 0)');
    expect(metrics.flowBanner!.backgroundImage, '操作提示不能有背景层').toBe('none');
    expect(metrics.flowBanner!.borderWidth, '操作提示不能有边框').toBe('0px');
    expect(metrics.flowBanner!.hasVisibleShadow, '操作提示不能有挡板阴影').toBe(false);
    expect(metrics.itemStepExists, '交易提示必须显示对象选择步骤').toBe(true);
    expect(metrics.targetStepExists, '交易提示必须显示目标/确认步骤').toBe(true);
    expect(metrics.actionCount, '交易态仍应保留一组原动作按钮').toBeGreaterThanOrEqual(5);
    for (const actionButton of metrics.actionButtonStyles) {
        expect(actionButton.backgroundColor, `${actionButton.id} 不能再有独立黑底按钮框`).toBe('rgba(0, 0, 0, 0)');
        expect(actionButton.backgroundImage, `${actionButton.id} 不能再有独立背景层`).toBe('none');
        expect(actionButton.borderWidth, `${actionButton.id} 不能再有独立边框`).toBe('0px');
        expect(actionButton.hasVisibleShadow, `${actionButton.id} 不能再有可见独立框阴影`).toBe(false);
        expect(actionButton.filter, `${actionButton.id} 不能靠投影形成按钮框`).toBe('none');
    }
    expect(metrics.tradeButton!.text, '交易按钮必须更醒目但仍保留原动作文案').toContain('交易');
    expect(metrics.tradeButton!.text, '交易按钮必须显示原动作文案').toContain('交易');
    expect(metrics.tradeButton!.width, '交易按钮必须保持可点击尺寸').toBeGreaterThanOrEqual(80);
}

async function assertTradeTargetKeepsTeammateCard(page: Page) {
    const metrics = await page.evaluate(() => {
        const target = document.querySelector('[data-testid="betrayal-bottom-teammate-1"]');
        if (!target) return null;
        const style = window.getComputedStyle(target);
        const avatar = target.querySelector('img');
        const statBadges = target.querySelectorAll('[title^="力量"], [title^="速度"], [title^="知识"], [title^="神志"]').length;
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
    expect(metrics!.avatarCount, '交易目标按钮必须保留队友头像，不得退成文字按钮').toBe(1);
    expect(metrics!.statBadges, '交易目标按钮必须保留队友属性徽标，不得退成文字按钮').toBe(4);
    expect(metrics!.text, '交易目标按钮必须保留目标名字').toContain('丽贝卡·艾伦博士');
    expect(metrics!.text, '交易目标按钮必须保留房间上下文').toContain('门厅');
    expect(metrics!.borderWidth, '交易目标按钮本体不应被改成单独黑边框文字按钮').toBe('0px');
}

async function assertSelectedInventoryCardHasVisibleOutline(page: Page) {
    const metrics = await page.evaluate(() => {
        const rope = document.querySelector('[data-testid="betrayal-inventory-rope"]');
        const selectedShell = document.querySelector('[data-testid="betrayal-inventory-rope-shell"]');
        const selectedRing = document.querySelector('[data-testid="betrayal-inventory-rope-selected-ring"]');
        const selectedLabel = document.querySelector('[data-testid="betrayal-inventory-rope-selected-label"]');
        const selectedHalo = document.querySelector('[data-testid="betrayal-inventory-rope-selected-halo"]');
        if (!rope || !selectedShell) return null;
        const shellStyle = window.getComputedStyle(selectedShell);
        const ropeStyle = window.getComputedStyle(rope);
        const ropeRect = rope.getBoundingClientRect();
        return {
            buttonBoxShadow: ropeStyle.boxShadow,
            shellBoxShadow: shellStyle.boxShadow,
            shellBorderColor: shellStyle.borderTopColor,
            shellBorderWidth: shellStyle.borderTopWidth,
            hasSelectedRing: Boolean(selectedRing),
            hasSelectedLabelNode: Boolean(selectedLabel),
            hasSelectedHalo: Boolean(selectedHalo),
            hasSelectedLabel: rope.textContent?.includes('已选') ?? false,
            ropeTop: ropeRect.top,
        };
    });

    expect(metrics, '必须能读取兔脚选中态').not.toBeNull();
    expect(metrics!.buttonBoxShadow, '选中物品必须有一眼可见的外层描边/发光').toContain('238, 204, 126');
    expect(metrics!.shellBorderWidth, '选中物品牌面本体必须有明确描边').toBe('1px');
    expect(metrics!.shellBorderColor, '选中物品牌面本体描边必须明显区别于未选中卡').toBe('rgb(238, 204, 126)');
    expect(metrics!.shellBoxShadow, '选中物品牌面壳层不应额外叠内部阴影').toBe('none');
    expect(metrics!.hasSelectedRing, '选中物品不能再叠内部 selected-ring').toBe(false);
    expect(metrics!.hasSelectedHalo, '选中物品不能再叠外扩 halo').toBe(false);
    expect(metrics!.hasSelectedLabelNode, '选中物品不能再叠“已选”角标节点').toBe(false);
    expect(metrics!.hasSelectedLabel, '选中物品不能显示“已选”角标文案').toBe(false);
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
        await waitForTradeInventoryAtlas(page);
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await assertTradeTargetKeepsTeammateCard(page);
        await saveScreenshot(page, TRADE_INITIAL_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-rope').click();
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await assertTradeTargetKeepsTeammateCard(page);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_ITEM_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-bottom-teammate-1').click();
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await assertTradeTargetKeepsTeammateCard(page);
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
