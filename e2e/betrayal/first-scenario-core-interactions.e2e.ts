import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createFirstScenarioReadyToLearnAboutJackRuntimeCore,
    createFirstScenarioReadyToExorciseRuntimeCore,
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
const TRADE_INITIAL_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-交易-初始待选择.jpg`;
const TRADE_ITEM_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-交易-已选物品.jpg`;
const TRADE_TARGET_SELECTED_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-交易-已选目标待确认.jpg`;
const TRADE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-交易-交出后.jpg`;
const LEARN_READY_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-调查杰克-执行前.jpg`;
const LEARN_DONE_SCREENSHOT = `${EVIDENCE_DIR}/06-山屋惊魂-调查杰克-成功后.jpg`;
const STUDY_READY_SCREENSHOT = `${EVIDENCE_DIR}/07-山屋惊魂-研究法阵-执行前.jpg`;
const STUDY_DONE_SCREENSHOT = `${EVIDENCE_DIR}/08-山屋惊魂-研究法阵-成功后.jpg`;
const ATTACK_READY_SCREENSHOT = `${EVIDENCE_DIR}/09-山屋惊魂-英雄攻击叛徒-执行前.jpg`;
const ATTACK_DONE_SCREENSHOT = `${EVIDENCE_DIR}/10-山屋惊魂-英雄攻击叛徒-命中后.jpg`;
const LEARN_TEAMMATE_READY_SCREENSHOT = `${EVIDENCE_DIR}/11-山屋惊魂-调查杰克-帮队友前.jpg`;
const LEARN_TEAMMATE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/12-山屋惊魂-调查杰克-帮队友后.jpg`;
const EXORCISE_NO_CIRCLE_READY_SCREENSHOT = `${EVIDENCE_DIR}/13-山屋惊魂-无 法阵驱魔-执行前.jpg`;
const EXORCISE_NO_CIRCLE_DONE_SCREENSHOT = `${EVIDENCE_DIR}/14-山屋惊魂-无 法阵驱魔-反扑后.jpg`;

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
    expect(metrics.ropeImageAsset, '兔脚应挂载正式物品牌面 atlas，不应退回纯文字牌').toContain('item-front-atlas');
    expect(metrics.ropeImageLoaded, '兔脚正式物品牌面必须真实加载完成').toBe(true);
    expect(metrics.omenBookImageAsset, '书本应挂载正式预兆牌面 atlas，不应退回纯文字牌').toContain('omen-front-atlas');
    expect(metrics.omenBookImageLoaded, '书本正式预兆牌面必须真实加载完成').toBe(true);
    expect(metrics.rope!.right - metrics.rope!.left, '兔脚交易牌面必须保持原持有区卡牌宽度，不能退成文字按钮').toBeGreaterThanOrEqual(58);
    expect(metrics.omenBook!.right - metrics.omenBook!.left, '预兆交易牌面必须保持原持有区卡牌宽度，不能退成文字按钮').toBeGreaterThanOrEqual(58);
    expect(metrics.ropeText, '兔脚不应显示“正面缺失”回退文案').not.toContain('正面缺失');
    expect(metrics.allInventoryText, '交易持有区不应出现“缺正面”回退文案').not.toContain('缺正面');
    const itemRow = metrics.itemRow!;
    const omenRow = metrics.omenRow!;
    expect(itemRow.height, '物品行不能撑成底部挡板').toBeLessThanOrEqual(130);
    expect(omenRow.height, '预兆行不能撑成底部挡板').toBeLessThanOrEqual(130);
    expect(metrics.mobileDockActions, '交易态不应渲染底部行动 dock，避免形成黑底挡板').toBe(0);
}

async function assertTradeActionBarKeepsButtons(page: import('@playwright/test').Page) {
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
                boxShadow: style.boxShadow,
                hasVisibleShadow: hasVisibleShadow(style.boxShadow),
                borderWidth: style.borderWidth,
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
        const actionButtons = Array.from(document.querySelectorAll('button[data-testid^="betrayal-action-"]'));
        const skeletonActionBarExists = Boolean(document.querySelector('[data-component="action-bar"]'));
        const legacyActionZoneExists = Boolean(document.querySelector('[data-tutorial-id="betrayal-actions-zone"]'));
        const actionItemWrapperCount = document.querySelectorAll('[data-action-id]').length;
        const buttonsStayInRoomPanelLayer = actionButtons.every((button) => Boolean(button.closest('[data-testid="betrayal-room-panel"]')));
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

        return {
            tradeButton: styleOf('[data-testid="betrayal-action-trade"]'),
            flowBanner: styleOf('[data-testid="betrayal-trade-flow-banner"]'),
            flowBannerExists: Boolean(document.querySelector('[data-testid="betrayal-trade-flow-banner"]')),
            itemStepExists: Boolean(document.querySelector('[data-testid="betrayal-trade-flow-item-step"]')),
            targetStepExists: Boolean(document.querySelector('[data-testid="betrayal-trade-flow-target-step"]')),
            actionCount: actionButtons.length,
            skeletonActionBarExists,
            legacyActionZoneExists,
            actionItemWrapperCount,
            buttonsStayInRoomPanelLayer,
            actionButtonStyles,
        };
    });

    expect(metrics.tradeButton, '交易按钮必须保留在底部动作条里').not.toBeNull();
    expect(metrics.skeletonActionBarExists, '底部按钮不能再用 ActionBarSkeleton 生成整排骨架容器').toBe(false);
    expect(metrics.legacyActionZoneExists, '底部按钮不应再保留 betrayal-actions-zone 这种整排动作区概念').toBe(false);
    expect(metrics.actionItemWrapperCount, '底部每个按钮不能再套 data-action-id 外包层').toBe(0);
    expect(metrics.buttonsStayInRoomPanelLayer, '动作按钮必须留在牌桌主面板内，不能退回页面外层动作区').toBe(true);
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
    expect(metrics.tradeButton!.text, '交易按钮必须显示原动作文案').toContain('交易');
    expect(metrics.tradeButton!.rect.width, '交易按钮必须保持可点击尺寸').toBeGreaterThanOrEqual(80);
}

async function assertSelectedInventoryCardHasVisibleOutline(page: import('@playwright/test').Page) {
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
        await expect(page.getByTestId('betrayal-trade-flow-banner')).toContainText('交易：先选持有物，再选同房间目标');
        await expect(page.getByTestId('betrayal-trade-flow-item-step')).toBeVisible();
        await expect(page.getByTestId('betrayal-trade-flow-target-step')).toContainText('先选物品和目标');
        await expect(page.getByText('首剧本开始：恶兆前探索')).toBeHidden();
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-trade-shortcut')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-room-trade-status-cue')).toHaveCount(0);
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await saveScreenshot(page, TRADE_INITIAL_SCREENSHOT);

        await page.getByTestId('betrayal-inventory-rope').click();
        await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toContainText('兔脚');
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
        await assertSelectedInventoryCardHasVisibleOutline(page);
        await saveScreenshot(page, TRADE_ITEM_SELECTED_SCREENSHOT);

        const mapTeammateTarget = page.getByTestId('betrayal-room-occupant-hallway-1');
        await expect(mapTeammateTarget, '交易目标主路径必须点击地图上的队友 token 本体').toBeVisible();
        await expect(mapTeammateTarget, '地图队友 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-hallway-1'), '地图队友 token 必须有贴合本体的五边形高亮').toHaveAttribute('data-highlight-shape', 'pentagon');
        await mapTeammateTarget.click();
        await expect(page.getByTestId('betrayal-selected-inventory-card-name')).toContainText('兔脚');
        await expect(page.getByTestId('betrayal-trade-target-1')).toHaveCount(0);
        await expect(page.getByTestId('betrayal-trade-status')).toContainText('可交易给');
        await expect(page.getByTestId('betrayal-trade-status')).toContainText('AI 2 号位');
        await assertTradeLayoutDoesNotCoverMap(page);
        await assertTradeActionBarKeepsButtons(page);
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
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveAttribute('data-role', 'status');
        await expect(page.getByTestId('betrayal-room-upper-west')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-focus-card-highlight-upper-west')).toHaveAttribute('data-highlight-shape', 'room');
        await saveScreenshot(page, LEARN_READY_SCREENSHOT);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-room-upper-west').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/Crimson Jack|线索|查到/);
        await saveScreenshot(page, LEARN_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-learn-jack-interaction', diagnostics }]);
    });

    test('真实页面允许已掌握线索的英雄继续调查并把线索交给队友', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-learn-jack-for-teammate-interaction');

        await openBetrayalBoard(page, context);
        const core = createFirstScenarioReadyToLearnAboutJackRuntimeCore();
        core.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        core.usedCardIdsThisTurn = [];
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('调查杰克');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText('调查杰克');
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveAttribute('data-role', 'status');
        await expect(page.getByTestId('betrayal-room-upper-west')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-focus-card-highlight-upper-west')).toHaveAttribute('data-highlight-shape', 'room');
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                scenarioRuntime?: { knowledgeOfJackPlayerIds?: string[] };
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.scenarioRuntime?.knowledgeOfJackPlayerIds ?? [];
        })).toEqual(['0']);
        await saveScreenshot(page, LEARN_TEAMMATE_READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-room-upper-west').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/Crimson Jack|线索|交给|丽贝卡/);
        await expect.poll(async () => page.evaluate(() => {
            const state = (window as typeof window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => {
                            core?: {
                                scenarioRuntime?: { knowledgeOfJackPlayerIds?: string[] };
                            };
                        };
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.scenarioRuntime?.knowledgeOfJackPlayerIds ?? [];
        })).toEqual(['0', '1']);
        await expect(page.getByTestId('betrayal-bottom-teammate-knowledge-1')).toContainText('掌握杰克线索');
        await saveScreenshot(page, LEARN_TEAMMATE_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-learn-jack-for-teammate-interaction', diagnostics }]);
    });

    test('真实页面可研究驱魔法阵', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-study-exorcism-interaction');

        await openBetrayalBoard(page, context);
        await injectCore(page, createFirstScenarioReadyToStudyExorcismRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('研究法阵');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText('研究法阵');
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveAttribute('data-role', 'status');
        await expect(page.getByTestId('betrayal-room-upper-north')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-focus-card-highlight-upper-north')).toHaveAttribute('data-highlight-shape', 'room');
        await saveScreenshot(page, STUDY_READY_SCREENSHOT);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
        await page.getByTestId('betrayal-room-upper-north').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/法阵|驱魔|研究/);
        await saveScreenshot(page, STUDY_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-study-exorcism-interaction', diagnostics }]);
    });

    test('真实页面允许没有法阵时尝试驱魔并结算失败反扑', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-exorcise-without-circle-interaction');

        await openBetrayalBoard(page, context);
        const core = createFirstScenarioReadyToExorciseRuntimeCore();
        core.scenarioRuntime.exorcismCircleRoomIds = [];
        core.currentExplorer.traits.sanity = 1;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        await injectCore(page, core);
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-action-use')).toContainText('驱魔');
        await expect(page.getByTestId('betrayal-room-focus-target')).toContainText(/驱魔|驱散杰克之灵/);
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveAttribute('data-role', 'status');
        await expect(page.getByTestId('betrayal-room-basement-landing')).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-focus-card-highlight-basement-landing')).toHaveAttribute('data-highlight-shape', 'room');
        await saveScreenshot(page, EXORCISE_NO_CIRCLE_READY_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.01]);
        await page.getByTestId('betrayal-room-basement-landing').click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/驱魔失败|反扑/);
        await saveScreenshot(page, EXORCISE_NO_CIRCLE_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-exorcise-without-circle-interaction', diagnostics }]);
    });

    test('真实页面可由英雄攻击叛徒', async ({ page, context }) => {
        test.setTimeout(120000);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario-hero-attack-traitor-interaction');

        await openBetrayalBoard(page, context);
        await injectCore(page, createHeroAttackTraitorReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-room-focus-target')).toHaveCount(0);
        await saveScreenshot(page, ATTACK_READY_SCREENSHOT);
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01]);
        const traitorMapTarget = page.getByTestId('betrayal-room-occupant-basement-east-2');
        await expect(traitorMapTarget, '英雄攻击叛徒主路径必须点击地图上的叛徒 token 本体').toBeVisible();
        await expect(traitorMapTarget, '叛徒 token 必须标记为直选目标').toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId('betrayal-room-occupant-target-outline-basement-east-2'), '叛徒 token 必须有贴合本体的五边形高亮').toHaveAttribute('data-highlight-shape', 'pentagon');
        await traitorMapTarget.click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/攻击|造成|physical damage|击倒/);
        await saveScreenshot(page, ATTACK_DONE_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario-hero-attack-traitor-interaction', diagnostics }]);
    });
});
