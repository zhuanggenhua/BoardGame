import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDogTradeReadyRuntimeCore,
    createExchangeReadyRuntimeCore,
    createTradeReadyRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/山屋惊魂-交易完整链路';
const TRADE_INITIAL_SCREENSHOT = `${EVIDENCE_DIR}/01-交易前牌桌可操作.jpg`;
const TRADE_ITEM_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-物品兔脚本体已选中.jpg`;
const TRADE_TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-地图队友目标已选中.jpg`;
const TRADE_CONFIRM_READY_SCREENSHOT = `${EVIDENCE_DIR}/04-确认交易前.jpg`;
const TRADE_REQUEST_SENT_SCREENSHOT = `${EVIDENCE_DIR}/05-提出交易等待同意.jpg`;
const TRADE_AGREEMENT_INCOMING_SCREENSHOT = `${EVIDENCE_DIR}/06-接收方同意交易前.jpg`;
const TRADE_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/07-交易结算结果可见.jpg`;
const TRADE_RETURNED_SCREENSHOT = `${EVIDENCE_DIR}/08-交易后回牌桌状态清空.jpg`;
const NO_RETURN_EVIDENCE_DIR = 'evidence/山屋惊魂-交易只给出完整链路';
const NO_RETURN_TARGET_SELECTED_SCREENSHOT = `${NO_RETURN_EVIDENCE_DIR}/01-选择队友后只给出兔脚.jpg`;
const NO_RETURN_REQUEST_SENT_SCREENSHOT = `${NO_RETURN_EVIDENCE_DIR}/02-提出交易等待同意.jpg`;
const NO_RETURN_SETTLED_SCREENSHOT = `${NO_RETURN_EVIDENCE_DIR}/03-交易结算结果可见.jpg`;
const REQUEST_ONLY_EVIDENCE_DIR = 'evidence/山屋惊魂-交易只选择对方物品完整链路';
const REQUEST_ONLY_TARGET_SELECTED_SCREENSHOT = `${REQUEST_ONLY_EVIDENCE_DIR}/01-选择队友后查看对方持有物.jpg`;
const REQUEST_ONLY_CARD_SELECTED_SCREENSHOT = `${REQUEST_ONLY_EVIDENCE_DIR}/02-选择对方地图.jpg`;
const REQUEST_ONLY_REQUEST_SENT_SCREENSHOT = `${REQUEST_ONLY_EVIDENCE_DIR}/03-提出交易等待同意.jpg`;
const REQUEST_ONLY_SETTLED_SCREENSHOT = `${REQUEST_ONLY_EVIDENCE_DIR}/04-交易结算结果可见.jpg`;
const EXCHANGE_EVIDENCE_DIR = 'evidence/山屋惊魂-交易双方物品完整链路';
const EXCHANGE_INITIAL_SCREENSHOT = `${EXCHANGE_EVIDENCE_DIR}/01-交易前牌桌可操作.jpg`;
const EXCHANGE_TARGET_SELECTED_SCREENSHOT = `${EXCHANGE_EVIDENCE_DIR}/02-选择队友后显示对方持有物.jpg`;
const EXCHANGE_RETURN_SELECTED_SCREENSHOT = `${EXCHANGE_EVIDENCE_DIR}/03-选择对方地图.jpg`;
const EXCHANGE_REQUEST_SENT_SCREENSHOT = `${EXCHANGE_EVIDENCE_DIR}/04-提出交易等待同意.jpg`;
const EXCHANGE_AGREEMENT_INCOMING_SCREENSHOT = `${EXCHANGE_EVIDENCE_DIR}/05-接收方同意交易前.jpg`;
const EXCHANGE_SETTLED_SCREENSHOT = `${EXCHANGE_EVIDENCE_DIR}/06-交易结算结果可见.jpg`;
const EXCHANGE_RETURNED_SCREENSHOT = `${EXCHANGE_EVIDENCE_DIR}/07-交易后回牌桌状态清空.jpg`;
const DOG_TRADE_EVIDENCE_DIR = 'evidence/山屋惊魂-狗远距交易完整链路';
const DOG_TRADE_INITIAL_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/01-狗交易前牌桌可操作.jpg`;
const DOG_TRADE_CARD_SELECTED_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/02-用狗选择要送的持有物.jpg`;
const DOG_TRADE_TARGET_VISIBLE_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/03-切到目标楼层看到4格内队友.jpg`;
const DOG_TRADE_TARGET_SELECTED_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/04-选择远距目标并确认前.jpg`;
const DOG_TRADE_REQUEST_SENT_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/05-发送狗交易请求等待同意.jpg`;
const DOG_TRADE_AGREEMENT_INCOMING_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/06-狗交易接收方同意前.jpg`;
const DOG_TRADE_SETTLED_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/07-狗交易结算结果可见.jpg`;
const DOG_TRADE_RETURNED_SCREENSHOT = `${DOG_TRADE_EVIDENCE_DIR}/08-狗交易后回牌桌状态清空.jpg`;
const TRADE_TARGET_NAME_PATTERN = /丽贝卡·艾伦博士|AI 2 号位|玩家 2|2 号位/;

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
                borderWidth: style.borderTopWidth,
                boxShadow: style.boxShadow,
                filter: style.filter,
                hasVisibleShadow: hasVisibleShadow(style.boxShadow),
                text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                width: rect.width,
            };
        };

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
                borderWidth: style.borderTopWidth,
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
        const buttonsStayInRoomPanelLayer = actionButtons.every((button) => Boolean(button.closest('[data-testid="betrayal-room-panel"]')));
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
            buttonsStayInRoomPanelLayer,
            probeHitsRoomLayer,
            elementsUnderTradeButton,
            actionButtonRoomOverlaps,
            actionButtonsInsideViewport,
            actionButtonCentersHitMap,
        };
    });

    expect(metrics.tradeButton, '交易按钮必须保留在底部动作条里').not.toBeNull();
    expect(metrics.skeletonActionBarExists, '底部按钮不能再用 ActionBarSkeleton 生成整排骨架容器').toBe(false);
    expect(metrics.legacyActionZoneExists, '底部按钮不应再保留 betrayal-actions-zone 这种整排动作区概念').toBe(false);
    expect(metrics.actionItemWrapperCount, '底部每个按钮不能再套 data-action-id 外包层').toBe(0);
    expect(metrics.buttonsStayInRoomPanelLayer, '动作按钮必须留在牌桌主面板内，不能退回页面外层动作区').toBe(true);
    expect(metrics.actionButtonParentTutorialIds, '动作按钮父层不能是 betrayal-actions-zone').not.toContain('betrayal-actions-zone');
    expect(metrics.actionButtonsInsideViewport, `动作按钮必须在当前可视地图区域内，实际：${JSON.stringify(metrics.actionButtonRoomOverlaps)}`).toBe(true);
    expect(metrics.actionButtonCentersHitMap, `动作按钮中心必须落在房间地图内容上，实际：${JSON.stringify(metrics.actionButtonRoomOverlaps)}`).toBe(true);
    expect(metrics.probeHitsRoomLayer, `交易按钮下面必须仍是地图/房间层，实际命中：${JSON.stringify(metrics.elementsUnderTradeButton)}`).toBe(true);
    expect(metrics.flowBannerExists, '交易态必须保留醒目的请求/同意提示条').toBe(true);
    expect(metrics.flowBanner!.backgroundColor, '交易流程提示必须有可辨认的深色压场，不能继续过于隐形').toBe('rgba(18, 17, 13, 0.78)');
    expect(metrics.flowBanner!.backgroundImage, '交易流程提示不应额外叠复杂背景图').toBe('none');
    expect(metrics.flowBanner!.borderWidth, '交易流程提示必须有边界以突出同意步骤').toBe('1px');
    expect(metrics.flowBanner!.hasVisibleShadow, '交易流程提示必须有轻量阴影，但不能侵入地图主交互').toBe(true);
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
            borderWidth: style.borderTopWidth,
            boxShadow: style.boxShadow,
            avatarCount: avatar ? 1 : 0,
            statBadges,
            text: target.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        };
    });

    expect(metrics, '交易目标按钮必须存在').not.toBeNull();
    expect(metrics!.avatarCount, '交易目标按钮必须保留队友头像，不得退成文字按钮').toBe(1);
    expect(metrics!.statBadges, '交易目标按钮必须保留队友属性徽标，不得退成文字按钮').toBe(4);
    expect(metrics!.text, '队友定位卡必须保留当前运行时目标名字').toMatch(TRADE_TARGET_NAME_PATTERN);
    expect(metrics!.text, '交易目标按钮必须保留房间上下文').toContain('门厅');
    expect(metrics!.borderWidth, '交易目标按钮本体不应被改成单独黑边框文字按钮').toBe('0px');
}

async function assertTradeTargetUsesMapToken(page: Page) {
    const mapTeammateTarget = page.getByTestId('betrayal-room-occupant-hallway-1');
    await expect(mapTeammateTarget, '交易目标主路径必须点击地图上的队友 token 本体').toBeVisible();
    await expect(mapTeammateTarget, '地图队友 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
    await expect(
        page.getByTestId('betrayal-room-occupant-target-outline-hallway-1'),
        '地图队友 token 必须有贴合本体的五边形高亮',
    ).toHaveAttribute('data-highlight-shape', 'pentagon');
}

async function assertSelectedInventoryCardHasVisibleOutline(page: Page) {
    const metrics = await page.evaluate(() => {
        const rope = document.querySelector('[data-testid="betrayal-inventory-rope"]');
        const selectedShell = document.querySelector('[data-testid="betrayal-inventory-rope-shell"]');
        const selectedOutline = document.querySelector('[data-testid="betrayal-inventory-rope-selected-outline"]');
        const selectedRing = document.querySelector('[data-testid="betrayal-inventory-rope-selected-ring"]');
        const selectedLabel = document.querySelector('[data-testid="betrayal-inventory-rope-selected-label"]');
        const selectedHalo = document.querySelector('[data-testid="betrayal-inventory-rope-selected-halo"]');
        if (!rope || !selectedShell) return null;
        const shellStyle = window.getComputedStyle(selectedShell);
        const selectedOutlineStyle = selectedOutline ? window.getComputedStyle(selectedOutline) : null;
        const ropeStyle = window.getComputedStyle(rope);
        const ropeRect = rope.getBoundingClientRect();
        return {
            buttonBoxShadow: ropeStyle.boxShadow,
            selectedOutlineBoxShadow: selectedOutlineStyle?.boxShadow ?? '',
            selectedOutlineBorderColor: selectedOutlineStyle?.borderTopColor ?? '',
            selectedOutlineBorderWidth: selectedOutlineStyle?.borderTopWidth ?? '',
            shellBoxShadow: shellStyle.boxShadow,
            shellBorderColor: shellStyle.borderTopColor,
            shellBorderWidth: shellStyle.borderTopWidth,
            hasSelectedOutline: Boolean(selectedOutline),
            hasSelectedRing: Boolean(selectedRing),
            hasSelectedLabelNode: Boolean(selectedLabel),
            hasSelectedHalo: Boolean(selectedHalo),
            hasSelectedLabel: rope.textContent?.includes('已选') ?? false,
            ropeTop: ropeRect.top,
        };
    });

    expect(metrics, '必须能读取兔脚选中态').not.toBeNull();
    expect(metrics!.hasSelectedOutline, '选中物品必须有一眼可见的外层描边').toBe(true);
    expect(metrics!.selectedOutlineBorderWidth, '选中物品外层描边必须足够清楚').toBe('2px');
    expect(metrics!.selectedOutlineBorderColor, '选中物品外层描边必须使用金色高亮').toBe('rgb(238, 204, 126)');
    expect(metrics!.selectedOutlineBoxShadow, '选中物品外层描边必须带发光').toContain('238, 204, 126');
    expect(metrics!.shellBorderWidth, '选中物品牌面本体必须有明确描边').toBe('1px');
    expect(metrics!.shellBorderColor, '选中物品牌面本体描边必须明显区别于未选中卡').toBe('rgb(238, 204, 126)');
    expect(metrics!.shellBoxShadow, '选中物品牌面壳层不应额外叠内部阴影').toBe('none');
    expect(metrics!.hasSelectedRing, '选中物品不能再叠内部 selected-ring').toBe(false);
    expect(metrics!.hasSelectedHalo, '选中物品不能再叠外扩 halo').toBe(false);
    expect(metrics!.hasSelectedLabelNode, '选中物品不能再叠“已选”角标节点').toBe(false);
    expect(metrics!.hasSelectedLabel, '选中物品不能显示“已选”角标文案').toBe(false);
    expect(metrics!.ropeTop, '选中物品上移后仍应完整露出').toBeGreaterThanOrEqual(0);
}

async function assertInventoryCandidateCardRendered(page: Page, testId: string) {
    const metrics = await page.getByTestId(testId).evaluate((node, currentTestId) => {
        const button = node as HTMLElement;
        const rect = button.getBoundingClientRect();
        const shell = button.querySelector(`[data-testid="${currentTestId}-shell"]`) as HTMLElement | null;
        const frontAtlas = button.querySelector(`[data-testid="${currentTestId}-front-atlas"]`) as HTMLImageElement | null;
        return {
            text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            width: rect.width,
            height: rect.height,
            hasShell: Boolean(shell),
            frontAsset: frontAtlas?.getAttribute('data-asset-src') ?? '',
            frontLoaded: Boolean(frontAtlas?.complete && frontAtlas.naturalWidth > 0 && frontAtlas.naturalHeight > 0),
        };
    }, testId);

    expect(metrics.width, `${testId} 必须是卡牌本体宽度，不能退成文字按钮`).toBeGreaterThanOrEqual(58);
    expect(metrics.height, `${testId} 必须是卡牌本体高度，不能退成文字按钮`).toBeGreaterThanOrEqual(70);
    expect(metrics.hasShell, `${testId} 必须渲染持有物牌面壳层`).toBe(true);
    expect(metrics.frontAsset, `${testId} 必须挂载正式牌面 atlas`).toMatch(/(?:item|omen)-front-atlas/);
    expect(metrics.frontLoaded, `${testId} 正式牌面必须真实加载完成`).toBe(true);
    expect(metrics.text, `${testId} 不应显示正面缺失回退文案`).not.toContain('正面缺失');
}

async function assertTradeCandidateTrayAnchoredToFlow(page: Page, selectorTestId: string) {
    const metrics = await page.evaluate((testId) => {
        const selector = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
        const banner = document.querySelector('[data-testid="betrayal-trade-flow-banner"]') as HTMLElement | null;
        const topPrompt = document.querySelector('.absolute.left-1\\/2.top-\\[86px\\]') as HTMLElement | null;
        if (!selector || !banner) return null;
        const selectorRect = selector.getBoundingClientRect();
        const bannerRect = banner.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        return {
            selectorTop: selectorRect.top,
            selectorBottom: selectorRect.bottom,
            selectorCenterX: selectorRect.left + selectorRect.width / 2,
            bannerTop: bannerRect.top,
            bannerCenterX: bannerRect.left + bannerRect.width / 2,
            viewportHeight,
            topPromptText: topPrompt?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        };
    }, selectorTestId);

    expect(metrics, `${selectorTestId} 必须和交易流程条同时存在`).not.toBeNull();
    expect(metrics!.selectorTop, `${selectorTestId} 不能放到顶部角落或牌堆旁`).toBeGreaterThan(metrics!.viewportHeight * 0.52);
    expect(metrics!.selectorBottom, `${selectorTestId} 必须贴在交易流程条上方`).toBeLessThanOrEqual(metrics!.bannerTop + 4);
    expect(Math.abs(metrics!.selectorCenterX - metrics!.bannerCenterX), `${selectorTestId} 必须和交易流程条水平对齐`).toBeLessThanOrEqual(120);
    expect(metrics!.topPromptText, `${selectorTestId} 不得再出现在顶部提示带`).not.toContain('对方物品');
    expect(metrics!.topPromptText, `${selectorTestId} 不得再出现在顶部提示带`).not.toContain('狗');
}

async function assertTradeConfirmAnchoredToFlow(page: Page) {
    const metrics = await page.evaluate(() => {
        const confirm = document.querySelector('[data-testid="betrayal-action-trade"]') as HTMLElement | null;
        const banner = document.querySelector('[data-testid="betrayal-trade-flow-banner"]') as HTMLElement | null;
        const allConfirmButtons = Array.from(document.querySelectorAll('[data-testid="betrayal-action-trade"]'));
        if (!confirm || !banner) return null;
        const confirmRect = confirm.getBoundingClientRect();
        const bannerRect = banner.getBoundingClientRect();
        return {
            count: allConfirmButtons.length,
            placement: confirm.getAttribute('data-trade-confirm-placement') ?? '',
            insideBanner: Boolean(confirm.closest('[data-testid="betrayal-trade-flow-banner"]')),
            confirmCenterY: confirmRect.top + confirmRect.height / 2,
            bannerTop: bannerRect.top,
            bannerBottom: bannerRect.bottom,
        };
    });

    expect(metrics, '交易确认按钮必须存在').not.toBeNull();
    expect(metrics!.count, '交易确认只能有一个，不能流程条和底部动作栏各放一个').toBe(1);
    expect(metrics!.placement, '交易确认必须声明在流程条里，而不是底部导航或角落').toBe('flow-banner');
    expect(metrics!.insideBanner, '交易确认按钮必须和交易摘要处在同一个流程条里').toBe(true);
    expect(metrics!.confirmCenterY, '交易确认按钮必须落在交易流程条高度范围内').toBeGreaterThanOrEqual(metrics!.bannerTop);
    expect(metrics!.confirmCenterY, '交易确认按钮必须落在交易流程条高度范围内').toBeLessThanOrEqual(metrics!.bannerBottom);
}

async function assertTradeSelectionClearedAfterSettlement(page: Page) {
    await expect(page.getByTestId('betrayal-selected-inventory-card-name'), '交易结算后不能残留已选物品').toHaveCount(0);
    await expect(page.getByTestId('betrayal-inventory-rope'), '兔脚交易后必须从当前玩家持有区消失').toHaveCount(0);
    await expect(page.getByTestId('betrayal-trade-status'), '交易结算后目标选择必须清空，状态回到可交易对象提示').toContainText('同房间可交易对象：1人');
    const flowBannerCount = await page.getByTestId('betrayal-trade-flow-banner').count();
    if (flowBannerCount > 0) {
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '交易结算后提示若仍显示，必须回到从头选择物品').toContainText('先选持有物');
        await expect(page.getByTestId('betrayal-trade-flow-target-step'), '交易结算后确认提示若仍显示，必须回到待选择状态').toContainText('先选物品和目标');
    }
    const targetState = await page.evaluate(() => {
        const outline = document.querySelector('[data-testid="betrayal-room-occupant-target-outline-hallway-1"]');
        const teammateCard = document.querySelector('[data-testid="betrayal-bottom-teammate-1"]');
        const outlineStyle = outline ? window.getComputedStyle(outline) : null;
        const teammateStyle = teammateCard ? window.getComputedStyle(teammateCard) : null;
        return {
            outlineBorderColor: outlineStyle?.borderTopColor ?? '',
            teammateBorderColor: teammateStyle?.borderTopColor ?? '',
            teammateText: teammateCard?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        };
    });
    expect(targetState.outlineBorderColor, '交易结算后地图目标不能继续保持已选金色实线').not.toBe('rgb(209, 176, 95)');
    expect(targetState.teammateBorderColor, '交易结算后侧边队友卡不能继续保持已选目标态').not.toBe('rgb(238, 204, 126)');
    expect(targetState.teammateText, '交易结算后队友仍应保留在牌桌上下文里').toMatch(TRADE_TARGET_NAME_PATTERN);
}

async function assertDogTradeSelectorOpenAndReachable(page: Page) {
    await expect(page.getByTestId('betrayal-dog-trade-selector'), '狗远距交易必须显示独立的狗交易选择器').toBeVisible();
    await assertTradeCandidateTrayAnchoredToFlow(page, 'betrayal-dog-trade-selector');
    await expect(page.getByTestId('betrayal-trade-status'), '狗交易状态必须说明是 4 格内目标，不是同房间交易').toContainText('狗可交易对象');
    await expect(page.getByTestId('betrayal-trade-status')).toContainText('4格内');
    await expect(page.getByTestId('betrayal-trade-status')).not.toContainText('同房间');
    await expect(page.getByTestId('betrayal-dog-trade-card-dog'), '狗本身不能作为要送出的持有物').toHaveCount(0);
    const metrics = await page.evaluate(() => {
        const selector = document.querySelector('[data-testid="betrayal-dog-trade-selector"]');
        const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-testid^="betrayal-dog-trade-card-"]:not([data-testid$="-magnify"])')).map((button) => ({
            id: button.getAttribute('data-testid') ?? '',
            text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        }));
        return {
            selectorText: selector?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            cards,
        };
    });
    expect(metrics.selectorText, '狗交易选择器必须写明狗和可送物品').toContain('狗');
    expect(metrics.cards.map((card) => card.text), '狗交易必须能选择急救包和地图').toEqual(expect.arrayContaining(['急救包', '地图']));
    await assertInventoryCandidateCardRendered(page, 'betrayal-dog-trade-card-medical-kit');
    await assertInventoryCandidateCardRendered(page, 'betrayal-dog-trade-card-map');
}

async function assertDogTradeTargetUsesRemoteMapToken(page: Page) {
    await page.getByTestId('betrayal-room-floor-up').click();
    const remoteTarget = page.getByTestId('betrayal-room-occupant-upper-landing-1');
    await expect(remoteTarget, '狗交易目标主路径必须点击地图上的 4 格内队友 token 本体').toBeVisible();
    await expect(remoteTarget).toHaveAttribute('data-direct-target', 'true');
    await expect(
        page.getByTestId('betrayal-room-occupant-target-outline-upper-landing-1'),
        '狗交易目标必须有贴合 token 的五边形高亮',
    ).toHaveAttribute('data-highlight-shape', 'pentagon');
}

async function assertDogTradeSelectionClearedAfterSettlement(page: Page) {
    await expect(page.getByTestId('betrayal-dog-trade-selector'), '狗使用后狗交易选择器必须消失，不能继续残留可交易态').toHaveCount(0);
    await expect(page.getByTestId('betrayal-dog-trade-card-medical-kit'), '急救包已交易后不能继续留在狗交易选择器').toHaveCount(0);
    await expect(page.getByTestId('betrayal-dog-trade-card-map'), '地图已交易后不能继续留在狗交易选择器').toHaveCount(0);
    await expect(page.getByTestId('betrayal-room-occupant-target-outline-upper-landing-1'), '狗交易结算后远距目标高亮必须清空').toHaveCount(0);
}

test.describe('山屋惊魂首剧本交易交互', () => {
    test('真实页面可选物品、选目标并确认交易', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-trade-interaction');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human', { waitUntil: 'commit', timeout: 30000 });
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
        await assertTradeTargetUsesMapToken(page);
        await saveScreenshot(page, TRADE_INITIAL_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-rope').click();
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await assertTradeTargetKeepsTeammateCard(page);
        await assertTradeTargetUsesMapToken(page);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_ITEM_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await assertTradeTargetKeepsTeammateCard(page);
        await expect(page.getByTestId('betrayal-trade-target-1')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-trade-status')).toContainText('可交易给');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText(TRADE_TARGET_NAME_PATTERN);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_TARGET_SELECTED_SCREENSHOT);

        const tradeButton = page.getByTestId('betrayal-action-trade');
        await expect(tradeButton, '确认交易按钮必须已经可点击').toBeEnabled();
        await expect(page.getByTestId('betrayal-trade-flow-target-step'), '确认前必须明确进入提出交易阶段').toContainText('提出交易');
        await saveScreenshot(page, TRADE_CONFIRM_READY_SCREENSHOT);

        await tradeButton.click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                activePlayerId?: string | null;
                pendingTradeAgreement?: { targetPlayerId?: string; cardIds?: string[] } | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTarget: state?.core?.pendingTradeAgreement?.targetPlayerId ?? null,
                pendingCards: state?.core?.pendingTradeAgreement?.cardIds ?? [],
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '交易点击后应先生成等待接收方同意的请求，不能立刻转移',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['兔脚']),
            teammateInventory: [],
            activePlayerId: '1',
            pendingTarget: '1',
            pendingCards: ['rope'],
            latestLog: expect.stringMatching(/同意|交易请求|兔脚/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/同意|交易请求|兔脚/);
        await expect(page.getByTestId('betrayal-trade-agreement-panel'), '接收方视角必须显示交易同意面板').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-agreement-accept'), '接收方必须能点击同意交易').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-agreement-decline'), '接收方必须能点击拒绝交易').toBeVisible();
        await saveScreenshot(page, TRADE_REQUEST_SENT_SCREENSHOT);
        await saveScreenshot(page, TRADE_AGREEMENT_INCOMING_SCREENSHOT);

        await page.getByTestId('betrayal-trade-agreement-accept').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: unknown | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTradeAgreement: state?.core?.pendingTradeAgreement ?? null,
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '接收方同意后才应把物品移到目标玩家，并写入活动日志',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.not.arrayContaining(['兔脚']),
            teammateInventory: expect.arrayContaining(['兔脚']),
            activePlayerId: null,
            pendingTradeAgreement: null,
            latestLog: expect.stringMatching(/同意交易|给出.*兔脚/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/同意交易|给出.*兔脚/);
        await saveScreenshot(page, TRADE_SETTLED_SCREENSHOT);
        await assertTradeSelectionClearedAfterSettlement(page);
        await expect(page.getByTestId('betrayal-board'), '交易结算后必须回到可操作牌桌').toBeVisible();
        await expect(page.getByTestId('betrayal-action-trade'), '交易后仍在牌桌动作区，可继续下一步').toContainText('交易');
        await saveScreenshot(page, TRADE_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-trade-interaction', diagnostics }]);
    });

    test('真实页面只选择己方物品时一个确认按钮即可提出交易', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-no-return-trade-interaction');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createExchangeReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForTradeInventoryAtlas(page);

        await page.getByTestId('betrayal-inventory-rope').click();
        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await expect(page.getByTestId('betrayal-trade-return-selector'), '选中队友后对方持有物区必须出现').toBeVisible();
        await assertTradeCandidateTrayAnchoredToFlow(page, 'betrayal-trade-return-selector');
        await expect(page.getByTestId('betrayal-trade-return-skip'), '空选择不能做成与地图、头骨并列的伪候选按钮').toHaveCount(0);
        await expect(page.getByTestId('betrayal-trade-return-card-map'), '对方持有物区必须只展示真实对方持有物卡牌').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-return-card-skull'), '对方持有物区必须只展示真实对方持有物卡牌').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '未选对方物品时摘要只需要列出己方给出物').toContainText(/你给出.*兔脚/);
        await expect(page.getByTestId('betrayal-action-trade'), '只选择己方物品时，一个提出交易按钮就必须足够').toBeEnabled();
        await assertTradeConfirmAnchoredToFlow(page);
        await saveScreenshot(page, NO_RETURN_TARGET_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: { targetPlayerId?: string; cardIds?: string[]; targetCardIds?: string[] } | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTarget: state?.core?.pendingTradeAgreement?.targetPlayerId ?? null,
                pendingCards: state?.core?.pendingTradeAgreement?.cardIds ?? [],
                pendingReturnCards: state?.core?.pendingTradeAgreement?.targetCardIds ?? [],
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '只选择己方物品时，请求必须保留空对方物品数组，不能强迫选择对方物品',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['兔脚', '书本']),
            teammateInventory: expect.arrayContaining(['地图', '头骨']),
            activePlayerId: '1',
            pendingTarget: '1',
            pendingCards: ['rope'],
            pendingReturnCards: [],
            latestLog: expect.stringMatching(/同意|交易请求|兔脚/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '接收方同意前必须看到发起方给出兔脚').toContainText(/给出.*兔脚/);
        await expect(page.getByTestId('betrayal-trade-agreement-panel'), '只选择己方物品的交易仍必须进入接收方同意面板').toBeVisible();
        await saveScreenshot(page, NO_RETURN_REQUEST_SENT_SCREENSHOT);

        await page.getByTestId('betrayal-trade-agreement-accept').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: unknown | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTradeAgreement: state?.core?.pendingTradeAgreement ?? null,
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '接收方同意后只转移兔脚，地图和头骨仍留在接收方持有区',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['书本']),
            teammateInventory: expect.arrayContaining(['地图', '头骨', '兔脚']),
            activePlayerId: null,
            pendingTradeAgreement: null,
            latestLog: expect.stringMatching(/同意交易|兔脚/),
            rejected: null,
        });
        await saveScreenshot(page, NO_RETURN_SETTLED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-no-return-trade-interaction', diagnostics }]);
    });

    test('真实页面允许只选择对方持有物并等待同意', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-request-only-trade-interaction');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createExchangeReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForTradeInventoryAtlas(page);

        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await expect(page.getByTestId('betrayal-trade-return-selector'), '只选择对方物品时也必须先显示对方可给出的真实持有物').toBeVisible();
        await assertTradeCandidateTrayAnchoredToFlow(page, 'betrayal-trade-return-selector');
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '只选队友但未选任何持有物时不能形成空交易请求').toContainText(/选择自己或对方持有物|选择/);
        await expect(page.locator('[data-testid="betrayal-action-trade"][data-trade-confirm-placement="flow-banner"]'), '双方都没选持有物时不能出现流程条内提出交易确认').toHaveCount(0);
        await saveScreenshot(page, REQUEST_ONLY_TARGET_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-trade-return-card-map').click();
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '只选对方物品时摘要必须写成对方给出，不能写成模式名').toContainText(/对方给出.*地图/);
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).not.toContainText('你给出 无');
        await expect(page.getByTestId('betrayal-trade-return-card-map-selected-outline'), '选择对方地图后必须在卡牌本体上显示金色外框').toBeVisible();
        await expect(page.getByTestId('betrayal-action-trade'), '只选择对方物品时必须能提出交易').toBeEnabled();
        await assertTradeConfirmAnchoredToFlow(page);
        await saveScreenshot(page, REQUEST_ONLY_CARD_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: { targetPlayerId?: string; cardIds?: string[]; targetCardIds?: string[] } | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTarget: state?.core?.pendingTradeAgreement?.targetPlayerId ?? null,
                pendingCards: state?.core?.pendingTradeAgreement?.cardIds ?? [],
                pendingReturnCards: state?.core?.pendingTradeAgreement?.targetCardIds ?? [],
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '只选择对方物品时请求必须保留 cardIds=[]、targetCardIds=[map]，并等待对方同意',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['兔脚', '书本']),
            teammateInventory: expect.arrayContaining(['地图', '头骨']),
            activePlayerId: '1',
            pendingTarget: '1',
            pendingCards: [],
            pendingReturnCards: ['map'],
            latestLog: expect.stringMatching(/给出地图/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '接收方同意前必须看到对方给出摘要').toContainText(/你给出.*地图/);
        await expect(page.getByTestId('betrayal-trade-agreement-panel'), '只选择对方物品的交易仍必须进入接收方同意面板').toBeVisible();
        await saveScreenshot(page, REQUEST_ONLY_REQUEST_SENT_SCREENSHOT);

        await page.getByTestId('betrayal-trade-agreement-accept').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: unknown | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTradeAgreement: state?.core?.pendingTradeAgreement ?? null,
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '接收方同意后地图转给发起方，发起方自己的兔脚和书本保持不变',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['兔脚', '书本', '地图']),
            teammateInventory: expect.arrayContaining(['头骨']),
            activePlayerId: null,
            pendingTradeAgreement: null,
            latestLog: expect.stringMatching(/同意交易|给出地图/),
            rejected: null,
        });
        await saveScreenshot(page, REQUEST_ONLY_SETTLED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-request-only-trade-interaction', diagnostics }]);
    });

    test('真实页面可选择双方持有物并完成同意交易', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-exchange-interaction');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createExchangeReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('交易');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText('同房间可交易对象：1人');
        await waitForTradeInventoryAtlas(page);
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await assertTradeTargetKeepsTeammateCard(page);
        await assertTradeTargetUsesMapToken(page);
        await saveScreenshot(page, EXCHANGE_INITIAL_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-rope').click();
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await page.getByTestId('betrayal-room-occupant-hallway-1').click();
        await expect(page.getByTestId('betrayal-trade-return-selector'), '选中队友后必须显示对方持有物区').toBeVisible();
        await assertTradeCandidateTrayAnchoredToFlow(page, 'betrayal-trade-return-selector');
        await expect(page.getByTestId('betrayal-trade-return-skip'), '空选择不是一个候选按钮，没选对方持有物就只提交己方已选内容').toHaveCount(0);
        await expect(page.getByTestId('betrayal-trade-return-card-map'), '队友地图必须能作为对方给出的对象选择').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-return-card-skull'), '队友头骨必须能作为对方给出的对象选择').toBeVisible();
        await assertInventoryCandidateCardRendered(page, 'betrayal-trade-return-card-map');
        await assertInventoryCandidateCardRendered(page, 'betrayal-trade-return-card-skull');
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '未选对方物品前，摘要只显示己方给出物').toContainText(/你给出.*兔脚/);
        await saveScreenshot(page, EXCHANGE_TARGET_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-trade-return-card-map').click();
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '选择对方物品后交易摘要必须同时显示双方给出物').toContainText(/你给出.*兔脚.*对方给出.*地图/);
        await expect(page.getByTestId('betrayal-trade-return-card-map-selected-outline'), '选择对方地图后必须在卡牌本体上显示金色外框').toBeVisible();
        await page.getByTestId('betrayal-trade-return-card-map').click();
        await expect(page.getByTestId('betrayal-trade-return-card-map-selected-outline'), '再次点击地图必须能取消对方物品选择').toHaveCount(0);
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '取消对方物品选择后摘要回到只列己方给出物').toContainText(/你给出.*兔脚/);
        await page.getByTestId('betrayal-trade-return-card-map').click();
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '重新选择地图后交易摘要必须回到双方给出物').toContainText(/你给出.*兔脚.*对方给出.*地图/);
        await expect(page.getByTestId('betrayal-trade-flow-steps'), '流程短标签必须显示对方物品步骤').toContainText('对方物品');
        await expect(page.getByTestId('betrayal-action-trade'), '选双方物品后必须能提出交易').toBeEnabled();
        await assertTradeConfirmAnchoredToFlow(page);
        await saveScreenshot(page, EXCHANGE_RETURN_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: { targetPlayerId?: string; cardIds?: string[]; targetCardIds?: string[] } | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTarget: state?.core?.pendingTradeAgreement?.targetPlayerId ?? null,
                pendingCards: state?.core?.pendingTradeAgreement?.cardIds ?? [],
                pendingReturnCards: state?.core?.pendingTradeAgreement?.targetCardIds ?? [],
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '交易请求发出后必须等待接收方同意，双方持有物暂不转移',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['兔脚', '书本']),
            teammateInventory: expect.arrayContaining(['地图', '头骨']),
            activePlayerId: '1',
            pendingTarget: '1',
            pendingCards: ['rope'],
            pendingReturnCards: ['map'],
            latestLog: expect.stringMatching(/同意|交易请求|兔脚|地图/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/同意|交易请求|兔脚|地图/);
        await expect(page.getByTestId('betrayal-trade-agreement-panel'), '交易接收方必须看到同意面板').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-agreement-accept'), '交易接收方必须能同意').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-agreement-decline'), '交易接收方必须能拒绝').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '接收方同意前必须看到双方给出物摘要').toContainText(/给出.*兔脚.*给出.*地图/);
        await saveScreenshot(page, EXCHANGE_REQUEST_SENT_SCREENSHOT);
        await saveScreenshot(page, EXCHANGE_AGREEMENT_INCOMING_SCREENSHOT);

        await page.getByTestId('betrayal-trade-agreement-accept').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: unknown | null;
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
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTradeAgreement: state?.core?.pendingTradeAgreement ?? null,
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '接收方同意后必须双向转移：发起方得到地图，接收方得到兔脚',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['书本', '地图']),
            teammateInventory: expect.arrayContaining(['头骨', '兔脚']),
            activePlayerId: null,
            pendingTradeAgreement: null,
            latestLog: expect.stringMatching(/同意交易|兔脚|地图/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-inventory-rope'), '交易后兔脚应从发起方持有区消失').toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/同意交易|兔脚|地图/);
        await saveScreenshot(page, EXCHANGE_SETTLED_SCREENSHOT);
        await assertTradeSelectionClearedAfterSettlement(page);
        await expect(page.getByTestId('betrayal-trade-return-selector'), '交易结算后对方持有物区必须退场').toHaveCount(0);
        await expect(page.getByTestId('betrayal-board'), '交易结算后必须回到可操作牌桌').toBeVisible();
        await saveScreenshot(page, EXCHANGE_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-exchange-interaction', diagnostics }]);
    });

    test('狗远距交易真实链路可选择多张持有物、4格内目标并收口', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-dog-trade-interaction');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human', { waitUntil: 'commit', timeout: 30000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(page);
        await injectCore(page, createDogTradeReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-trade')).toContainText('交易');
        await assertDogTradeSelectorOpenAndReachable(page);
        await expect(page.getByTestId('betrayal-trade-target-1'), '狗交易不应退回同房间队友列表按钮').toHaveCount(0);
        await saveScreenshot(page, DOG_TRADE_INITIAL_SCREENSHOT);

        await page.getByTestId('betrayal-dog-trade-card-medical-kit').click();
        await page.getByTestId('betrayal-dog-trade-card-map').click();
        await assertDogTradeSelectorOpenAndReachable(page);
        await expect(page.getByTestId('betrayal-dog-trade-card-medical-kit-selected-outline'), '急救包选中后必须在卡牌本体上显示金色外框').toBeVisible();
        await expect(page.getByTestId('betrayal-dog-trade-card-map-selected-outline'), '地图选中后必须在卡牌本体上显示金色外框').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-flow-item-step'), '选择物品后必须显示狗交易已选物品').toContainText(/急救包|地图/);
        await saveScreenshot(page, DOG_TRADE_CARD_SELECTED_SCREENSHOT);

        await assertDogTradeTargetUsesRemoteMapToken(page);
        await saveScreenshot(page, DOG_TRADE_TARGET_VISIBLE_SCREENSHOT);

        await page.getByTestId('betrayal-room-occupant-upper-landing-1').click();
        await expect(page.getByTestId('betrayal-trade-status'), '选中远距队友后必须进入可交易给该玩家的状态').toContainText('可交易给');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText(TRADE_TARGET_NAME_PATTERN);
        await expect(page.getByTestId('betrayal-trade-flow-target-step'), '确认前必须明确进入提出交易阶段').toContainText('提出交易');
        await expect(page.getByTestId('betrayal-action-trade'), '狗交易确认按钮必须可点').toBeEnabled();
        await assertTradeConfirmAnchoredToFlow(page);
        await saveScreenshot(page, DOG_TRADE_TARGET_SELECTED_SCREENSHOT);

        await page.getByTestId('betrayal-action-trade').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: { targetPlayerId?: string; cardIds?: string[] } | null;
                                currentExplorer?: { inventory?: Array<{ id: string; name: string }> };
                                otherExplorers?: Array<{ playerId: string; inventory?: Array<{ id: string; name: string }> }>;
                                usedCardIdsThisTurn?: string[];
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
                usedCardIdsThisTurn: state?.core?.usedCardIdsThisTurn ?? [],
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTarget: state?.core?.pendingTradeAgreement?.targetPlayerId ?? null,
                pendingCards: state?.core?.pendingTradeAgreement?.cardIds ?? [],
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '狗交易确认后应先生成等待接收方同意的请求，不能立刻转移',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: expect.arrayContaining(['狗', '急救包', '地图']),
            teammateInventory: [],
            usedCardIdsThisTurn: expect.not.arrayContaining(['dog']),
            activePlayerId: '1',
            pendingTarget: '1',
            pendingCards: ['medical-kit', 'map'],
            latestLog: expect.stringMatching(/同意|狗交易|急救包|地图/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/同意|狗交易|急救包|地图/);
        await expect(page.getByTestId('betrayal-trade-agreement-panel'), '狗交易接收方必须看到同意面板').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-agreement-accept'), '狗交易接收方必须能同意').toBeVisible();
        await expect(page.getByTestId('betrayal-trade-agreement-decline'), '狗交易接收方必须能拒绝').toBeVisible();
        await saveScreenshot(page, DOG_TRADE_REQUEST_SENT_SCREENSHOT);
        await saveScreenshot(page, DOG_TRADE_AGREEMENT_INCOMING_SCREENSHOT);

        await page.getByTestId('betrayal-trade-agreement-accept').click();
        await expect.poll(async () => page.evaluate(() => {
            const holder = window as unknown as {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                activePlayerId?: string | null;
                                pendingTradeAgreement?: unknown | null;
                                currentExplorer?: { inventory?: Array<{ id: string; name: string }> };
                                otherExplorers?: Array<{ playerId: string; inventory?: Array<{ id: string; name: string }> }>;
                                usedCardIdsThisTurn?: string[];
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
                usedCardIdsThisTurn: state?.core?.usedCardIdsThisTurn ?? [],
                activePlayerId: state?.core?.activePlayerId ?? null,
                pendingTradeAgreement: state?.core?.pendingTradeAgreement ?? null,
                latestLog: state?.core?.activityLog?.[0]?.text ?? null,
                rejected: holder.__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        }), {
            message: '狗交易必须在接收方同意后才转移多张持有物，并记录狗已使用',
            timeout: 10000,
        }).toMatchObject({
            currentInventory: ['狗'],
            teammateInventory: expect.arrayContaining(['急救包', '地图']),
            usedCardIdsThisTurn: expect.arrayContaining(['dog']),
            activePlayerId: null,
            pendingTradeAgreement: null,
            latestLog: expect.stringMatching(/同意交易|使用狗|急救包|地图/),
            rejected: null,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/同意交易|使用狗|急救包|地图/);
        await saveScreenshot(page, DOG_TRADE_SETTLED_SCREENSHOT);
        await assertDogTradeSelectionClearedAfterSettlement(page);
        await expect(page.getByTestId('betrayal-board'), '狗交易结算后必须回到可操作牌桌').toBeVisible();
        await expect(page.getByTestId('betrayal-action-trade'), '狗交易后仍回到牌桌动作区').toContainText('交易');
        await saveScreenshot(page, DOG_TRADE_RETURNED_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-dog-trade-interaction', diagnostics }]);
    });
});
