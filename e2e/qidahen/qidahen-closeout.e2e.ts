import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    setChineseLocale,
} from '../helpers/common';

const CLOSEOUT_DIR = 'test-results/evidence-screenshots/_shared/qidahen-新游戏收口';
const TUTORIAL_ROOT_DIR = 'test-results/evidence-screenshots/_shared/qidahen-教程完成';
const TUTORIAL_RUN_ID = process.env.QIDAHEN_TUTORIAL_SCREENSHOT_RUN_ID
    ?? new Date().toISOString().replace(/[:.]/g, '-');
const TUTORIAL_DIR = `${TUTORIAL_ROOT_DIR}/${TUTORIAL_RUN_ID}`;
const MOBILE_TUTORIAL_DIR = `${TUTORIAL_ROOT_DIR}/${TUTORIAL_RUN_ID}-mobile`;
const TUTORIAL_ENTRY_SCREENSHOT = `${TUTORIAL_DIR}/00-唯一入门入口-直接进入胜利条件.png`;
const TUTORIAL_ENTRY_FIRST_STEP = `${TUTORIAL_DIR}/00a-继续后-选择首个行动.png`;
const TUTORIAL_STEP_01 = `${TUTORIAL_DIR}/01-开场-阅读三种胜利条件.png`;
const TUTORIAL_STEP_02 = `${TUTORIAL_DIR}/02-选择首个行动-轮盘或征召.png`;
const TUTORIAL_STEP_02A = `${TUTORIAL_DIR}/02a-轮盘三格费用与落点说明.png`;
const TUTORIAL_STEP_02B = `${TUTORIAL_DIR}/02b-先轮盘后手牌-轮盘结算结果.png`;
const TUTORIAL_STEP_02C = `${TUTORIAL_DIR}/02c-先轮盘后手牌-行动顺序选择.png`;
const TUTORIAL_STEP_02D = `${TUTORIAL_DIR}/02d-轮盘后选择手牌行动.png`;
const TUTORIAL_STEP_02E = `${TUTORIAL_DIR}/02e-两种行动完成-征召结果.png`;
const TUTORIAL_STEP_03 = `${TUTORIAL_DIR}/03-轮盘选择-三种走法均可选择.png`;
const TUTORIAL_STEP_03A = `${TUTORIAL_DIR}/03a-轮盘两格-选择对手抽牌.png`;
const TUTORIAL_STEP_03B = `${TUTORIAL_DIR}/03b-轮盘两格-进入军屯并结算.png`;
const TUTORIAL_STEP_03_ONE_GRID = `${TUTORIAL_DIR}/03c-轮盘一格-进入开垦并结算.png`;
const TUTORIAL_STEP_03_ONE_GRID_ENTRY = `${TUTORIAL_DIR}/03c-一格开垦前-选择轮盘走法.png`;
const TUTORIAL_STEP_03C = `${TUTORIAL_DIR}/03c-轮盘三格-进入征兵训练弃牌窗口.png`;
const TUTORIAL_STEP_03_THREE_GRID_ENTRY = `${TUTORIAL_DIR}/03c-三格征兵训练前-选择轮盘走法.png`;
const TUTORIAL_STEP_03E = `${TUTORIAL_DIR}/03e-征兵训练选择行动前规则译文.png`;
const TUTORIAL_STEP_03F = `${TUTORIAL_DIR}/03f-训练目标选择与等级提示.png`;
const TUTORIAL_STEP_03G = `${TUTORIAL_DIR}/03g-征兵训练结算结果.png`;
const TUTORIAL_STEP_03H = `${TUTORIAL_DIR}/03h-征兵目标本土限制与候选区域.png`;
const TUTORIAL_STEP_03I = `${TUTORIAL_DIR}/03i-额外训练规则与弃牌.png`;
const TUTORIAL_STEP_03J = `${TUTORIAL_DIR}/03j-额外训练目标与结果.png`;
const TUTORIAL_STEP_03K = `${TUTORIAL_DIR}/03k-征兵训练结果与轮盘结算.png`;
const TUTORIAL_STEP_03L = `${TUTORIAL_DIR}/03l-教程退场后同局继续.png`;
const TUTORIAL_STEP_07 = `${TUTORIAL_DIR}/07-支付1张手牌.png`;
const TUTORIAL_STEP_08 = `${TUTORIAL_DIR}/08-选择宣府建军位置.png`;
const TUTORIAL_STEP_09 = `${TUTORIAL_DIR}/09-选择建军方式.png`;
const TUTORIAL_STEP_10 = `${TUTORIAL_DIR}/10-征召结果-轮盘行动待完成.png`;
const TUTORIAL_STEP_11 = `${TUTORIAL_DIR}/11-教程结束后同局下一位玩家可操作.png`;
const ONE_GRID_CONTINUATION = `${TUTORIAL_DIR}/03d-一格开垦后退出教程并完成下一次轮盘行动.png`;
const WHEEL_COST_STEP_01 = `${TUTORIAL_DIR}/13-轮盘第1步-先看走3会让两家对手摸牌.png`;
const WHEEL_COST_STEP_02 = `${TUTORIAL_DIR}/14-轮盘第2步-看蒙古后金手牌同时增加.png`;
const WHEEL_COST_STEP_02A = `${TUTORIAL_DIR}/14a-进攻调度规则-弃一张手牌.png`;
const WHEEL_COST_PAYMENT_SELECTED = `${TUTORIAL_DIR}/14b-进攻调度支付-手牌已选待确认.png`;
const WHEEL_COST_STEP_03 = `${TUTORIAL_DIR}/15-进攻调度支付完成-地图部队选择可继续.png`;
const WHEEL_RECLAIM_STEP_01 = `${TUTORIAL_DIR}/15a-开垦第1步-点击高亮开垦.png`;
const WHEEL_RECLAIM_STEP_02 = `${TUTORIAL_DIR}/15b-开垦第2步-看己方控制区人口增加.png`;
const WHEEL_RECLAIM_OVERVIEW = `${TUTORIAL_DIR}/15a-00-开垦专题起点-轮盘标记与决策入口.png`;
const WHEEL_MILITARY_FARM_STEP_01 = `${TUTORIAL_DIR}/15c-军屯第1步-点击高亮军屯.png`;
const WHEEL_MILITARY_FARM_STEP_02 = `${TUTORIAL_DIR}/15d-军屯第2步-看补牌并建立正规军.png`;
const WHEEL_MILITARY_FARM_OVERVIEW = `${TUTORIAL_DIR}/15c-00-军屯专题起点-轮盘标记与决策入口.png`;
const WHEEL_RECRUIT_TRAIN_STEP_01 = `${TUTORIAL_DIR}/15e-征兵训练第1步-点击高亮征兵训练.png`;
const WHEEL_RECRUIT_TRAIN_RULE = `${TUTORIAL_DIR}/15e0-费用与次数规则译文.png`;
const WHEEL_RECRUIT_TRAIN_ACTION_RULE = `${TUTORIAL_DIR}/15e1-征兵与训练行动规则译文.png`;
const WHEEL_RECRUIT_TRAIN_ARTILLERY_RULE = `${TUTORIAL_DIR}/15e2-炮兵等级限制规则译文.png`;
const WHEEL_RECRUIT_TRAIN_PAYMENT = `${TUTORIAL_DIR}/15e3-轮盘落点等待支付.png`;
const WHEEL_RECRUIT_TRAIN_TRAINING_TARGET = `${TUTORIAL_DIR}/15f-选择炮兵训练.png`;
const WHEEL_RECRUIT_TRAIN_TRAINING_RESULT = `${TUTORIAL_DIR}/15g-炮兵训练结算结果.png`;
const WHEEL_RECRUIT_TRAIN_HOMELAND_RULE = `${TUTORIAL_DIR}/15h-本土征兵限制规则译文.png`;
const WHEEL_RECRUIT_TRAIN_RECRUIT_TARGET = `${TUTORIAL_DIR}/15i-征兵候选本土区域.png`;
const WHEEL_RECRUIT_TRAIN_RECRUIT_RESULT = `${TUTORIAL_DIR}/15j-征兵结算结果.png`;
const WHEEL_RECRUIT_TRAIN_EXTRA_RULE = `${TUTORIAL_DIR}/15k-额外训练规则译文.png`;
const WHEEL_RECRUIT_TRAIN_EXTRA_PAYMENT = `${TUTORIAL_DIR}/15l-额外训练弃牌.png`;
const WHEEL_RECRUIT_TRAIN_FINAL = `${TUTORIAL_DIR}/15m-征兵训练汇总与继续对局.png`;
const ARMAMENT_STEP_00 = `${TUTORIAL_DIR}/16-军备第0步-四个势力行动总览.png`;
const ARMAMENT_STEP_01 = `${TUTORIAL_DIR}/16-军备第1步-先点升级军备.png`;
const ARMAMENT_STEP_02 = `${TUTORIAL_DIR}/17-军备第2步-点击底部手牌支付2张.png`;
const ARMAMENT_STEP_03 = `${TUTORIAL_DIR}/18-军备第3步-看火炮技术升到2级.png`;
const EVENT_STEP_01 = `${TUTORIAL_DIR}/19-事件第1步-先点大汗令箭.png`;
const EVENT_STEP_00 = `${TUTORIAL_DIR}/18a-事件第0步-蒙古三个势力行动总览.png`;
const EVENT_STEP_02 = `${TUTORIAL_DIR}/20-事件第2步-点击底部手牌支付1张.png`;
const EVENT_STEP_03 = `${TUTORIAL_DIR}/21-事件第3步-选择征兵训练效果.png`;
const EVENT_STEP_04 = `${TUTORIAL_DIR}/22-大汗令箭征兵训练行动规则译文.png`;
const EVENT_STEP_05 = `${TUTORIAL_DIR}/23-大汗令箭选择征兵与本土限制规则译文.png`;
const EVENT_STEP_06 = `${TUTORIAL_DIR}/24-大汗令箭本土目标与征兵结果.png`;
const EVENT_STEP_07 = `${TUTORIAL_DIR}/25-大汗令箭结算摘要.png`;
const FIELD_BATTLE_STEP_01 = `${TUTORIAL_DIR}/23-进攻第1步-点击突袭作战入口.png`;
const FIELD_BATTLE_STEP_00 = `${TUTORIAL_DIR}/22a-进攻第0步-大明四个势力行动总览.png`;
const FIELD_BATTLE_STEP_02 = `${TUTORIAL_DIR}/24-进攻第2步-弃1张手牌支付突袭.png`;
const FIELD_BATTLE_STEP_03 = `${TUTORIAL_DIR}/25-进攻第3步-支付后进入察哈尔野战.png`;
const FIELD_BATTLE_STEP_03A = `${TUTORIAL_DIR}/25a-进攻第3a步-战术牌时机高亮骑兵冲锋.png`;
const FIELD_BATTLE_STEP_03B = `${TUTORIAL_DIR}/25b-进攻第3b步-战术牌选中后显示打出确认.png`;
const FIELD_BATTLE_STEP_04 = `${TUTORIAL_DIR}/26-进攻第4步-打出战术牌后决定承伤顺序.png`;
const FIELD_BATTLE_STEP_04A = `${TUTORIAL_DIR}/26a-进攻第4a步-看断后后的战后处理.png`;
const FIELD_BATTLE_STEP_05 = `${TUTORIAL_DIR}/27-进攻第5步-看战败标记与战后选择.png`;
const FIELD_BATTLE_STEP_06 = `${TUTORIAL_DIR}/27a-进攻第6步-看占领结果摘要.png`;
const ROUT_STEP_01 = `${TUTORIAL_DIR}/28-撤退第1步-先看断后和溃退入口.png`;
const ROUT_STEP_02 = `${TUTORIAL_DIR}/29-撤退第2步-看溃退后的残部清空与战败标记.png`;
const ROUT_OVERVIEW = `${TUTORIAL_DIR}/27-00-撤退专题起点-野战败方待选撤退方式.png`;
const SIEGE_STEP_01 = `${TUTORIAL_DIR}/30-攻城第1步-真实守城宣告入口.png`;
const SIEGE_STEP_01A = `${TUTORIAL_DIR}/30a-攻城第1a步-右侧断后结算城战.png`;
const SIEGE_STEP_02 = `${TUTORIAL_DIR}/31-攻城第2步-选择围城该区.png`;
const SIEGE_OCCUPY_STEP_00 = `${TUTORIAL_DIR}/31a-00-占领对照专题起点-守城决策.png`;
const SIEGE_OCCUPY_STEP_01 = `${TUTORIAL_DIR}/31a-01-攻下城市后-选择占领或围城.png`;
const SIEGE_STEP_03 = `${TUTORIAL_DIR}/31b-围城结算后-山海关仍由守方控制.png`;
const SIEGE_OCCUPY_STEP_02 = `${TUTORIAL_DIR}/31a-02-同章选择占领目标.png`;
const SIEGE_OCCUPY_STEP_03 = `${TUTORIAL_DIR}/31a-03-同章占领结算结果.png`;
const SIEGE_WITHDRAW_STEP_01 = `${TUTORIAL_DIR}/31c-01-攻城战后处理-选择前.png`;
const SIEGE_WITHDRAW_STEP_02 = `${TUTORIAL_DIR}/31c-02-攻城战后处理-撤回确认前.png`;
const SIEGE_WITHDRAW_STEP_03 = `${TUTORIAL_DIR}/31c-03-攻城战后处理-撤回结果.png`;
const DIPLOMACY_STEP_01 = `${TUTORIAL_DIR}/32-外交第1步-点击高亮外交雇佣.png`;
const DIPLOMACY_STEP_02 = `${TUTORIAL_DIR}/33-外交第2步-先放置友好标记.png`;
const DIPLOMACY_STEP_02A = `${TUTORIAL_DIR}/33a-外交第2a步-翻为附庸.png`;
const DIPLOMACY_STEP_02B = `${TUTORIAL_DIR}/33b-外交第2b步-移除他方控制标记.png`;
const DIPLOMACY_STEP_03 = `${TUTORIAL_DIR}/34-外交第3步-结束并结算雇佣军.png`;
const DIPLOMACY_STEP_04 = `${TUTORIAL_DIR}/35-外交第4步-看完外交与雇佣的合并收益.png`;
const SEASON_STEP_01 = `${TUTORIAL_DIR}/36-跨年第1步-推进到年中并查看税赋与人物.png`;
const SEASON_STEP_02 = `${TUTORIAL_DIR}/37-跨年第2步-先看新年朝鲜朝贡.png`;
const SEASON_STEP_03 = `${TUTORIAL_DIR}/38-跨年第3步-进入新年防线维护.png`;
const SEASON_STEP_04 = `${TUTORIAL_DIR}/39-跨年第4步-看纪年卡与争分结果.png`;
const SEASON_STEP_05 = `${TUTORIAL_DIR}/40-跨年第5步-看新顺位与人物刷新.png`;
const SEASON_STEP_06 = `${TUTORIAL_DIR}/41-跨年第6步-看到新年结算与新年份.png`;
const KOREA_STEP_01 = `${TUTORIAL_DIR}/42-朝鲜第1步-先看朝鲜朝贡后的牌库与弃牌堆.png`;
const KOREA_STEP_02 = `${TUTORIAL_DIR}/43-朝鲜第2步-看汉城威望已进入玩家条.png`;
const KOREA_STEP_03 = `${TUTORIAL_DIR}/44-朝鲜第3步-看海路与船锚区域关系.png`;
const KOREA_STEP_04 = `${TUTORIAL_DIR}/45-朝鲜第4步-点击新年维护进入耗损结算.png`;
const KOREA_STEP_05 = `${TUTORIAL_DIR}/46-朝鲜第5步-看朝鲜耗损与山海关结果.png`;
const MOBILE_TUTORIAL_WELCOME = `${MOBILE_TUTORIAL_DIR}/移动-00-开场-胜利条件说明.png`;
const MOBILE_OPENING_ACTION = `${MOBILE_TUTORIAL_DIR}/移动-01-首个行动选择-轮盘或征召.png`;
const MOBILE_HAND_INSPECT_BEFORE = `${MOBILE_TUTORIAL_DIR}/移动-02-征召支付-手牌检视前.png`;
const MOBILE_HAND_INSPECT_OVERLAY = `${MOBILE_TUTORIAL_DIR}/移动-03-征召支付-长按手牌打开检视.png`;
const MOBILE_HAND_INSPECT_RETURN = `${MOBILE_TUTORIAL_DIR}/移动-04-关闭检视-回到征召支付.png`;
const DESKTOP_HAND_INSPECT_OVERLAY = `${TUTORIAL_DIR}/07a-征召支付-点击看查看牌面.png`;
const ENDGAME_SCREENSHOT = `${CLOSEOUT_DIR}/02-终局遮罩-注入胜利后显示.png`;

type HarnessWindow = Window & {
    __E2E_TEST_MODE__?: boolean;
    __BG_HIDE_DEBUG_PANEL__?: boolean;
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => { core: unknown; sys: Record<string, unknown> };
            set?: (state: { core: unknown; sys: Record<string, unknown> }) => Promise<void> | void;
            isRegistered?: () => boolean;
        };
    };
};

const QIDAHEN_TUTORIAL_CATALOG_URL = '/play/qidahen/tutorial';
const QIDAHEN_BASIC_TUTORIAL_URL = '/play/qidahen/tutorial/basic-opening';

const resetScreenshotDir = (path: string) => {
    const targetDir = resolve(path);
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    const remainingFiles = readdirSync(targetDir);
    if (remainingFiles.length > 0) {
        throw new Error(`qidahen tutorial screenshot directory was not cleared: ${targetDir}`);
    }
};

const saveScreenshot = async (page: Page, path: string) => {
    const targetPath = resolve(path);
    mkdirSync(dirname(targetPath), { recursive: true });
    await page.screenshot({ path: targetPath, fullPage: false, animations: 'disabled' });
};

const expectTutorialOverlayFullyVisible = async (page: Page, stepId: string) => {
    const metrics = await page.locator('[data-testid="tutorial-overlay-card"]').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            width: rect.width,
        };
    });
    expect(metrics.width, `${stepId} tutorial card width`).toBeGreaterThan(80);
    expect(metrics.height, `${stepId} tutorial card height`).toBeGreaterThan(40);
    expect(metrics.left, `${stepId} tutorial card left edge`).toBeGreaterThanOrEqual(0);
    expect(metrics.top, `${stepId} tutorial card top edge`).toBeGreaterThanOrEqual(0);
    expect(metrics.right, `${stepId} tutorial card right edge`).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.bottom, `${stepId} tutorial card bottom edge`).toBeLessThanOrEqual(metrics.viewportHeight);
};

const readLocatorRect = async (locator: Locator) => (
    locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
        };
    })
);

const getRectOverlapArea = (
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number },
) => {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
};

const expectTutorialOverlayNotToCover = async (
    page: Page,
    target: Locator,
    label: string,
) => {
    await expect.poll(async () => {
        const [overlayRect, targetRect] = await Promise.all([
            readLocatorRect(page.locator('[data-testid="tutorial-overlay-card"]')),
            readLocatorRect(target),
        ]);
        return getRectOverlapArea(overlayRect, targetRect);
    }, { message: label, timeout: 2500 }).toBeLessThanOrEqual(1);
};

const expectWheelRecruitTrainTargetListFullyVisible = async (
    page: Page,
    stepId: string,
    choiceTestIdPrefix: string,
) => {
    const panel = page.getByTestId('qidahen-wheel-recruit-train-selection');
    const measurements = await panel.evaluate((element, testIdPrefix) => {
        const slot = element.parentElement;
        const choices = Array.from(element.querySelectorAll<HTMLElement>('button[data-testid]'))
            .filter((choice) => choice.dataset.testid?.startsWith(testIdPrefix));
        if (!slot || choices.length === 0) throw new Error('征兵训练目标面板或候选项不存在');
        const rect = (target: Element) => {
            const bounds = target.getBoundingClientRect();
            return { bottom: bounds.bottom, left: bounds.left, right: bounds.right, top: bounds.top };
        };
        return {
            panel: rect(element),
            slot: rect(slot),
            choiceCount: choices.length,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            viewportHeight: window.innerHeight,
        };
    }, choiceTestIdPrefix);
    const highlightRect = await readLocatorRect(page.getByTestId('tutorial-highlight-ring'));
    const discardPileRect = await readLocatorRect(page.getByTestId('qidahen-discard-anchor'));
    const scrollHint = page.getByTestId('qidahen-wheel-recruit-train-scroll-hint');

    expect(measurements.panel.top, `${stepId} 候选面板顶部`).toBeGreaterThanOrEqual(0);
    expect(measurements.panel.bottom, `${stepId} 候选面板未被操作栏裁切`)
        .toBeLessThanOrEqual(measurements.slot.bottom + 1);
    expect(measurements.panel.bottom, `${stepId} 候选面板未超出视口`)
        .toBeLessThanOrEqual(measurements.viewportHeight);
    expect(getRectOverlapArea(measurements.panel, discardPileRect), `${stepId} 候选面板不遮挡右下弃牌堆`)
        .toBeLessThanOrEqual(1);
    expect(measurements.choiceCount, `${stepId} 实际训练候选`).toBeGreaterThan(0);
    expect(Math.abs(highlightRect.top - measurements.panel.top), `${stepId} 高亮框贴合面板顶部`)
        .toBeLessThanOrEqual(1);
    expect(Math.abs(highlightRect.bottom - measurements.panel.bottom), `${stepId} 高亮框贴合面板底部`)
        .toBeLessThanOrEqual(1);
    await expect(scrollHint, `${stepId} 需要滚动时显示操作提示`).toBeVisible();

    if (measurements.scrollHeight > measurements.clientHeight) {
        const lastChoice = page.locator(`[data-testid^="${choiceTestIdPrefix}"]`).last();
        await panel.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
        });
        await expect.poll(async () => {
            const [panelRect, lastChoiceRect] = await Promise.all([
                readLocatorRect(panel),
                readLocatorRect(lastChoice),
            ]);
            return lastChoiceRect.top >= panelRect.top && lastChoiceRect.bottom <= panelRect.bottom;
        }, { message: `${stepId} 可滚动到完整候选末项` }).toBe(true);
        await panel.evaluate((element) => {
            element.scrollTop = 0;
        });
    }
};

const expectElementsNotToOverlap = async (
    page: Page,
    first: Locator,
    second: Locator,
    label: string,
) => {
    const [firstRect, secondRect] = await Promise.all([
        readLocatorRect(first),
        readLocatorRect(second),
    ]);
    expect(getRectOverlapArea(firstRect, secondRect), label).toBeLessThanOrEqual(1);
};

const readQidahenCore = async (page: Page) => (
    page.evaluate(() => {
        const stateApi = (window as HarnessWindow).__BG_TEST_HARNESS__?.state;
        const snapshot = stateApi?.get?.();
        if (!snapshot) {
            throw new Error('qidahen test harness state snapshot unavailable');
        }
        return snapshot.core as Record<string, unknown>;
    })
);

const completeBasicRecruitAction = async (
    page: Page,
    screenshots: Partial<Record<'action' | 'payment' | 'target' | 'formation' | 'result', string>> = {},
) => {
    await expect(page.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('本回合各进行一次手牌行动和轮盘行动');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先后由你决定');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选一个先做');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('弃 1 张手牌');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('费用和落点');
    await expect(page.locator('[data-testid="tutorial-highlight-ring"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('移动端长按手牌');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('手牌上限');
    for (const moveId of ['move-1-free', 'move-2-one-opponent', 'move-3-all-opponents']) {
        await expect(page.getByTestId(`qidahen-wheel-move-target-${moveId}`)).toBeEnabled();
    }
    if (screenshots.action) {
        const alternateAction = page.getByTestId('qidahen-action-grant-pardon');
        await expect(alternateAction).toBeVisible();
        await expect(alternateAction).toBeDisabled();
        const coreBeforeBlockedAlternate = await readQidahenCore(page);
        const alternateActionBox = await alternateAction.boundingBox();
        expect(alternateActionBox).toBeTruthy();
        await page.mouse.click(
            alternateActionBox!.x + alternateActionBox!.width / 2,
            alternateActionBox!.y + alternateActionBox!.height / 2,
        );
        await expect(page.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible();
        const coreAfterBlockedAlternate = await readQidahenCore(page);
        expect({
            selectedActionId: coreAfterBlockedAlternate.selectedActionId,
            confirmedActionId: coreAfterBlockedAlternate.confirmedActionId,
            factionActionUsed: coreAfterBlockedAlternate.factionActionUsed,
            payment: coreAfterBlockedAlternate.payment,
            selectedPaymentCardIds: coreAfterBlockedAlternate.selectedPaymentCardIds,
        }).toEqual({
            selectedActionId: coreBeforeBlockedAlternate.selectedActionId,
            confirmedActionId: coreBeforeBlockedAlternate.confirmedActionId,
            factionActionUsed: coreBeforeBlockedAlternate.factionActionUsed,
            payment: coreBeforeBlockedAlternate.payment,
            selectedPaymentCardIds: coreBeforeBlockedAlternate.selectedPaymentCardIds,
        });

        await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        });
        const keyboardReachableActions: string[] = [];
        for (let index = 0; index < 64; index += 1) {
            await page.keyboard.press('Tab');
            const actionId = await page.evaluate(() => {
                const testId = document.activeElement instanceof HTMLElement
                    ? document.activeElement.dataset.testid
                    : undefined;
                return testId?.startsWith('qidahen-action-')
                    ? testId.slice('qidahen-action-'.length)
                    : null;
            });
            if (actionId) keyboardReachableActions.push(actionId);
            if (actionId === 'recruit') break;
        }
        expect(keyboardReachableActions).toContain('recruit');
        expect(keyboardReachableActions).not.toContain('grant-pardon');
        await expect(page.getByTestId('qidahen-action-recruit')).toBeFocused();
    }
    if (screenshots.action) await saveScreenshot(page, screenshots.action);

    if (screenshots.action) {
        await page.keyboard.press('Enter');
    } else {
        await page.getByTestId('qidahen-action-recruit').click();
    }
    await expect(page.locator('[data-tutorial-step="pay-recruit"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('qidahen-action-payment-panel')).toBeVisible();
    const paymentConfirmButton = page.getByTestId('qidahen-action-payment-confirm');
    await expect(page.getByTestId('tutorial-highlight-ring'))
        .toHaveAttribute('data-tutorial-highlight-target', 'qidahen-action-payment-confirm');
    await expectTutorialOverlayFullyVisible(page, 'pay-recruit');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选牌前可点“看”查看牌面');
    await expectTutorialOverlayNotToCover(page, paymentConfirmButton, '支付提示必须让确认按钮保持可见');
    const mingHandBefore = (await readQidahenCore(page)).factions as Record<string, { handCount: number }>;
    const handCountBefore = mingHandBefore.ming.handCount;
    const selectedPaymentsBeforeInspect = (await readQidahenCore(page)).selectedPaymentCardIds;
    if (screenshots.payment) {
        const inspectCardButton = page.locator('button[data-testid^="qidahen-hand-card-magnify-"]').first();
        await expect(inspectCardButton).toBeVisible();
        await inspectCardButton.click();
        await expect(page.locator('[data-testid="qidahen-card-magnify-overlay"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-tutorial-step="pay-recruit"]')).toBeVisible();
        await expect(page.getByTestId('qidahen-action-payment-status')).toContainText('已选 0 / 1 张');
        await expect(page.getByTestId('qidahen-action-payment-panel')).toBeVisible();
        const afterInspect = await readQidahenCore(page);
        expect((afterInspect.factions as Record<string, { handCount: number }>).ming.handCount).toBe(handCountBefore);
        expect(afterInspect.selectedPaymentCardIds).toEqual(selectedPaymentsBeforeInspect);
        await saveScreenshot(page, DESKTOP_HAND_INSPECT_OVERLAY);
        await page.getByTestId('qidahen-card-magnify-overlay-close').click();
        await expect(page.locator('[data-testid="qidahen-card-magnify-overlay"]')).toBeHidden({ timeout: 10000 });
        await expect(page.locator('[data-tutorial-step="pay-recruit"]')).toBeVisible();
    }
    const paymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
    await paymentCard.click();
    await expect(page.getByTestId('qidahen-action-payment-status')).toContainText('1 / 1');
    await expect(paymentConfirmButton).toBeEnabled();
    if (screenshots.payment) await saveScreenshot(page, screenshots.payment);
    await paymentConfirmButton.click();

    await expect(page.locator('[data-tutorial-step="choose-recruit-target"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('qidahen-recruit-selection')).toBeVisible();
    await expect(page.getByTestId('qidahen-map-guide-target-focus-city-region-24')).toBeVisible();
    await expect(page.getByTestId('tutorial-highlight-ring'))
        .toHaveAttribute('data-tutorial-highlight-target', 'qidahen-map-guide-target-focus-city-region-24');
    await expect(page.getByTestId('qidahen-map-guide-target-focus-city-region-24')).toContainText('宣府');
    await expectTutorialOverlayNotToCover(
        page,
        page.getByTestId('qidahen-map-guide-target-focus-city-region-24'),
        '征召提示不得遮住宣府地图焦点',
    );
    const recruitTarget = page.getByTestId('qidahen-map-guide-hit-target-city-region-24');
    await expect(recruitTarget).toBeVisible();
    if (screenshots.target) await saveScreenshot(page, screenshots.target);
    await recruitTarget.click();

    await expect(page.locator('[data-tutorial-step="choose-recruit-formation"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选择 6 支等级 2 正规军');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('川兵');
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵');
    await expect(page.getByTestId('qidahen-recruit-choice-level-2-troops')).toBeVisible();
    await expect(page.getByTestId('qidahen-recruit-choice-level-4-chuanbing')).toBeVisible();
    await expect(page.getByTestId('qidahen-recruit-choice-level-1-artillery')).toBeVisible();
    await expectTutorialOverlayNotToCover(
        page,
        page.getByTestId('qidahen-recruit-selection'),
        '征召建军方式提示不得遮挡真实选项',
    );
    if (screenshots.formation) await saveScreenshot(page, screenshots.formation);
    const coreBeforeRecruit = await readQidahenCore(page);
    const xuanfuBefore = (coreBeforeRecruit.regions as Array<{ id: string; troops: number }>)
        .find((region) => region.id === 'city-region-24');
    await page.getByTestId('qidahen-recruit-choice-level-2-troops').click();

    await expect(page.locator('[data-tutorial-step="action-result"]')).toBeVisible({ timeout: 10000 });
    const recruitSummary = page.getByTestId('qidahen-season-summary');
    await expect(recruitSummary).toBeVisible();
    await expect(recruitSummary).toContainText('征召军队');
    await expect(recruitSummary).toContainText('建立 6 个等级 2 部队');
    await expectTutorialOverlayNotToCover(page, recruitSummary, '征召结果提示不得遮挡真实建军摘要');
    const coreAfterRecruit = await readQidahenCore(page);
    const xuanfuAfter = (coreAfterRecruit.regions as Array<{ id: string; troops: number }>)
        .find((region) => region.id === 'city-region-24');
    expect(xuanfuBefore).toBeTruthy();
    expect(xuanfuAfter?.troops).toBe((xuanfuBefore?.troops ?? 0) + 6);
    const mingHandAfter = (coreAfterRecruit.factions as Record<string, { handCount: number }>).ming.handCount;
    expect(mingHandAfter).toBe(handCountBefore - 1);
    expect((coreAfterRecruit as Record<string, unknown>).lastSeasonSummary
        && ((coreAfterRecruit as Record<string, unknown>).lastSeasonSummary as { title?: string }).title).toBe('征召军队');
    expect((coreAfterRecruit as Record<string, unknown>).currentPlayer).toBe('0');
    expect(coreAfterRecruit.wheelActionUsed).toBe(false);
    expect(coreAfterRecruit.factionActionUsed).toBe(true);
    if (screenshots.result) await saveScreenshot(page, screenshots.result);

    await page.locator('[data-testid="tutorial-next-button"]').click();
    await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
};

const completeBasicTutorialAndProveContinuation = async (
    page: Page,
    screenshot?: string,
) => {
    await expect(page.locator('[data-tutorial-step="wheel-result"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="tutorial-overlay-card"]'))
        .toContainText('两种行动都已完成');
    const completedTurn = await readQidahenCore(page);
    expect(completedTurn.currentPlayer).not.toBe('0');
    expect(completedTurn.wheelRecruitTrainProgress).toBeNull();
    await page.locator('[data-testid="tutorial-next-button"]').click();
    await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
    await expect(page.getByTestId('qidahen-board')).toBeVisible();
    await page.waitForTimeout(750);
    expect(new URL(page.url()).pathname).toContain('/tutorial/');

    const nextTurnBefore = await readQidahenCore(page);
    expect(nextTurnBefore.turnPhase).toBe('action-window');
    expect(nextTurnBefore.wheelActionUsed).toBe(false);
    expect(nextTurnBefore.factionActionUsed).toBe(false);
    const nextPlayerId = nextTurnBefore.currentPlayer;
    const wheelPositionBefore = nextTurnBefore.actionWheelPosition;
    await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();
    const nextTurnAfter = await readQidahenCore(page);
    expect(nextTurnAfter.currentPlayer).toBe(nextPlayerId);
    expect(nextTurnAfter.wheelActionUsed).toBe(true);
    expect(nextTurnAfter.actionWheelPosition).not.toBe(wheelPositionBefore);
    if (screenshot) await saveScreenshot(page, screenshot);
};

const selectPostBattleChoice = async (page: Page, choiceId: string) => {
    const mode = choiceId.startsWith('besiege')
        ? 'besiege'
        : choiceId.startsWith('withdraw')
            ? 'withdraw'
            : 'occupy';
    const modeButton = page.getByTestId(`qidahen-post-battle-mode-${mode}`);
    if (await modeButton.count() > 0) {
        await modeButton.click();
    }
    await page.getByTestId(`qidahen-post-battle-choice-${choiceId}`).click();
    await page.getByTestId('qidahen-post-battle-confirm').click();
};

const resolvePendingActionByCommand = async (
    page: Page,
    payload: Record<string, unknown>,
) => {
    await page.evaluate(async (nextPayload) => {
        const commandApi = (window as HarnessWindow).__BG_TEST_HARNESS__?.command;
        if (!commandApi?.dispatch) {
            throw new Error('qidahen test harness command dispatcher unavailable');
        }
        await commandApi.dispatch({
            type: 'RESOLVE_PENDING_ACTION',
            playerId: '0',
            payload: nextPayload,
        });
    }, payload);
};

const clickWheelMoveUntilTutorialStep = async (
    page: Page,
    moveId: string,
    nextStepId: string,
) => {
    const moveTarget = page.locator(`[data-testid="qidahen-wheel-move-target-${moveId}"]`);
    const nextStep = page.locator(`[data-tutorial-step="${nextStepId}"]`);
    await expect(moveTarget).toBeVisible();
    await moveTarget.click();
    if (moveId === 'move-2-one-opponent') {
        const opponentTarget = page.getByTestId('qidahen-wheel-opponent-ming');
        await expect(opponentTarget).toBeVisible({ timeout: 10000 });
        await opponentTarget.click();
        await expect(nextStep).toBeVisible({ timeout: 10000 });
        return;
    }
    const advanced = await nextStep.waitFor({ state: 'visible', timeout: 2500 })
        .then(() => true)
        .catch(() => false);
    if (!advanced) {
        await moveTarget.click();
    }
    await expect(nextStep).toBeVisible({ timeout: 10000 });
};

const expectWheelPrimaryMove = async (page: Page, moveId: string) => {
    const primaryMove = page.locator('[data-testid^="qidahen-wheel-move-target-"][data-wheel-primary="true"]');
    await expect(primaryMove).toHaveCount(1);
    await expect(page.locator(`[data-testid="qidahen-wheel-move-target-${moveId}"]`)).toHaveAttribute('data-wheel-primary', 'true');
    await expect(page.locator('[data-testid^="qidahen-wheel-move-target-"][data-wheel-candidate-level="secondary"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="qidahen-wheel-sector"][data-wheel-primary="true"]')).toHaveCount(1);
};

const dispatchTouchLongPress = async (locator: Locator, durationMs = 700) => {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('qidahen touch long-press target bounding box missing');
    }
    const point = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
    };
    await locator.dispatchEvent('pointerdown', {
        pointerType: 'touch',
        pointerId: 1,
        isPrimary: true,
        buttons: 1,
        clientX: point.x,
        clientY: point.y,
    });
    await locator.page().waitForTimeout(durationMs);
    await locator.dispatchEvent('pointerup', {
        pointerType: 'touch',
        pointerId: 1,
        isPrimary: true,
        buttons: 0,
        clientX: point.x,
        clientY: point.y,
    });
};

test.describe('七大恨新游戏收口', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            (window as HarnessWindow).__BG_HIDE_DEBUG_PANEL__ = true;
        });
    });

    test.beforeAll(() => {
        resetScreenshotDir(TUTORIAL_DIR);
        resetScreenshotDir(MOBILE_TUTORIAL_DIR);
    });

    test('唯一入门入口直接进入连续教程主线', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_TUTORIAL_CATALOG_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('tutorial-catalog-stage')).toHaveCount(0);
        await expect(page.getByTestId('debug-toggle-container')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('七大恨有三种胜利条件');
        await saveScreenshot(page, TUTORIAL_ENTRY_SCREENSHOT);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible({ timeout: 10000 });
        await saveScreenshot(page, TUTORIAL_ENTRY_FIRST_STEP);
    });

    test('教程模式会带玩家走完真实回合主路，并在关键视觉节点截图', async ({ page }) => {
        test.setTimeout(60_000);
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('七大恨有三种胜利条件');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('控制 16 个区域');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveAttribute('data-tutorial-placement', 'center');
        await expect(page.locator('[data-testid="tutorial-highlight-ring"]')).toHaveCount(0);
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-hand-zone'),
            'welcome tutorial card must not cover the hand zone',
        );
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-action-wheel'),
            'welcome tutorial card must not cover the shared action wheel',
        );
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            'welcome tutorial card must not cover the hand-action panel',
        );
        const yearCards = page.locator('[data-testid^="qidahen-year-card-slot-"]');
        for (let index = 0; index < await yearCards.count(); index += 1) {
            await expectTutorialOverlayNotToCover(
                page,
                yearCards.nth(index),
                `welcome tutorial card must not cover year card ${index + 1}`,
            );
        }
        const playerStatusPanels = page.locator('[data-testid^="qidahen-player-"]:not([data-testid="qidahen-player-float"])');
        for (let index = 0; index < await playerStatusPanels.count(); index += 1) {
            await expectTutorialOverlayNotToCover(
                page,
                playerStatusPanels.nth(index),
                `welcome tutorial card must not cover player status panel ${index + 1}`,
            );
        }
        await saveScreenshot(page, TUTORIAL_STEP_01);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先后由你决定');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选一个先做');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('手牌上限');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('3 张手牌');
        await expect(page.locator('[data-testid="tutorial-highlight-ring"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本教程');
        await expectTutorialOverlayFullyVisible(page, 'choose-opening-action');
        const recruitActionButton = page.getByTestId('qidahen-action-recruit');
        await expect(recruitActionButton).toBeEnabled();
        for (const moveId of ['move-1-free', 'move-2-one-opponent', 'move-3-all-opponents']) {
            await expect(page.getByTestId(`qidahen-wheel-move-target-${moveId}`)).toBeEnabled();
        }
        await expectTutorialOverlayNotToCover(page, recruitActionButton, '行动顺序提示必须保留征召按钮');
        await expectTutorialOverlayNotToCover(page, page.getByTestId('qidahen-action-wheel'), '行动顺序提示必须保留轮盘');
        const openingCore = await readQidahenCore(page);
        expect(openingCore.turnPhase).toBe('action-window');
        expect(openingCore.handLimitDiscardSelection).toBeNull();
        expect(openingCore.factions.ming.handCount).toBe(3);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-top-action-banner"]')).toHaveCount(0);
        await completeBasicRecruitAction(page, {
            action: TUTORIAL_STEP_02,
            payment: TUTORIAL_STEP_07,
            target: TUTORIAL_STEP_08,
            formation: TUTORIAL_STEP_09,
            result: TUTORIAL_STEP_10,
        });

        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘标记由所有玩家共用');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('每位玩家只选一种走法');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('费用和落点效果见各格提示');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('征兵训练');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-top-action-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-current-marker"]')).toHaveAttribute('data-wheel-current-position', 'wheel-new-year');
        for (const moveId of ['move-1-free', 'move-2-one-opponent', 'move-3-all-opponents']) {
            const target = page.locator(`[data-testid="qidahen-wheel-move-target-${moveId}"]`);
            await expect(target).toBeVisible();
            await expect(target).toHaveAttribute('aria-disabled', 'false');
        }
        const sectorDetails = [
            ['move-1-free', '每个己方控制区可放置 1 人口'],
            ['move-2-one-opponent', '抽 2 张手牌，并在己方本土建立 1 个等级 2 正规军'],
            ['move-3-all-opponents', '每额外弃 1 张牌，可额外进行 1 次训练'],
        ] as const;
        for (const [moveId, expectedDetail] of sectorDetails) {
            await page.locator(`[data-testid="qidahen-wheel-move-target-${moveId}"]`).hover();
            await expect(page.getByTestId('qidahen-wheel-tip')).toContainText(expectedDetail);
            if (moveId === 'move-3-all-opponents') {
                await expectTutorialOverlayNotToCover(
                    page,
                    page.getByTestId('qidahen-wheel-tip'),
                    '轮盘教程卡不得遮挡当前扇区的费用与效果说明',
                );
                await saveScreenshot(page, TUTORIAL_STEP_02A);
            }
        }
        await expectWheelPrimaryMove(page, 'move-2-one-opponent');
        await page.mouse.move(5, 5);
        await expectTutorialOverlayFullyVisible(page, 'wheel-move');
        await saveScreenshot(page, TUTORIAL_STEP_03);
        const wheelBeforeMove = await readQidahenCore(page);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').click();
        await expect(page.getByTestId('qidahen-wheel-opponent-picker')).toBeVisible();
        await expect(page.getByTestId('qidahen-wheel-opponent-jin')).toBeVisible();
        await expect(page.locator('[data-tutorial-step="wheel-move-opponent"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]'))
            .toContainText('所选对手抽 2 张牌。选择后金。');
        await expect(page.getByTestId('tutorial-highlight-ring'))
            .toHaveAttribute('data-tutorial-highlight-target', 'qidahen-wheel-opponent-picker');
        await expect(page.getByTestId('qidahen-wheel-tip')).toHaveCount(0);
        await saveScreenshot(page, TUTORIAL_STEP_03A);
        await page.getByTestId('qidahen-wheel-opponent-jin').click();

        await expect(page.locator('[data-tutorial-step="wheel-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('右侧结果显示刚才行动的实际变化');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘军屯');
        const wheelAfterMove = await readQidahenCore(page);
        const xuanfuBefore = (wheelBeforeMove.regions as Array<{ id: string; troops: number }>).find((region) => region.id === 'city-region-24');
        const xuanfuAfter = (wheelAfterMove.regions as Array<{ id: string; troops: number }>).find((region) => region.id === 'city-region-24');
        expect(wheelAfterMove.actionWheelPosition).toBe('wheel-military-farm');
        expect(wheelAfterMove.currentPlayer).not.toBe(wheelBeforeMove.currentPlayer);
        expect(wheelAfterMove.wheelActionUsed).toBe(false);
        expect(wheelAfterMove.factions.ming.handCount).toBe(wheelBeforeMove.factions.ming.handCount + 2);
        expect(wheelAfterMove.factions.jin.handCount).toBe(wheelBeforeMove.factions.jin.handCount + 2);
        expect(xuanfuBefore).toBeTruthy();
        expect(xuanfuAfter?.troops).toBe((xuanfuBefore?.troops ?? 0) + 1);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-season-summary"]'),
            'wheel-result tutorial card must not cover the actual wheel summary',
        );
        await saveScreenshot(page, TUTORIAL_STEP_03B);
        await completeBasicTutorialAndProveContinuation(page, TUTORIAL_STEP_11);
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-complete', diagnostics }]);
    });

    test('基础教程的 1 格走法会进入开垦，并能继续同一局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible({ timeout: 10000 });
        await completeBasicRecruitAction(page);
        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });

        const beforeMove = await readQidahenCore(page);
        await expectWheelPrimaryMove(page, 'move-2-one-opponent');
        await saveScreenshot(page, TUTORIAL_STEP_03_ONE_GRID_ENTRY);
        await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();
        await expect(page.locator('[data-tutorial-step="wheel-result"]')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('轮盘开垦');
        const afterMove = await readQidahenCore(page);
        expect(afterMove.actionWheelPosition).toBe('wheel-reclaim');
        const mingRegionBefore = (beforeMove.regions as Array<{ id: string; population: number }>).find((region) => region.id === 'city-region-24');
        const mingRegionAfter = (afterMove.regions as Array<{ id: string; population: number }>).find((region) => region.id === 'city-region-24');
        expect(mingRegionAfter?.population).toBe((mingRegionBefore?.population ?? 0) + 1);
        await saveScreenshot(page, TUTORIAL_STEP_03_ONE_GRID);
        await completeBasicTutorialAndProveContinuation(page, ONE_GRID_CONTINUATION);
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-wheel-two-step-target', diagnostics }]);
    });

    test('玩家可先做轮盘行动，再完成同回合手牌行动', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
        await page.getByTestId('tutorial-next-button').click();
        await expect(page.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible({ timeout: 10000 });

        const beforeWheel = await readQidahenCore(page);
        const xuanfuBefore = (beforeWheel.regions as Array<{ id: string; population: number }>).find((region) => (
            region.id === 'city-region-24'
        ));
        await saveScreenshot(page, TUTORIAL_STEP_02C);
        await page.getByTestId('qidahen-wheel-move-target-move-1-free').click();

        await expect(page.locator('[data-tutorial-step="wheel-first-result"]')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('轮盘开垦');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('还剩一次手牌行动');
        await expect(page.getByTestId('tutorial-highlight-ring'))
            .toHaveAttribute('data-tutorial-highlight-target', 'qidahen-season-summary');
        const afterWheel = await readQidahenCore(page);
        const xuanfuAfterWheel = (afterWheel.regions as Array<{ id: string; population: number }>).find((region) => (
            region.id === 'city-region-24'
        ));
        expect(afterWheel.currentPlayer).toBe('0');
        expect(afterWheel.wheelActionUsed).toBe(true);
        expect(afterWheel.factionActionUsed).toBe(false);
        expect(afterWheel.actionWheelPosition).toBe('wheel-reclaim');
        expect(xuanfuAfterWheel?.population).toBe((xuanfuBefore?.population ?? 0) + 1);
        await saveScreenshot(page, TUTORIAL_STEP_02B);

        await page.getByTestId('tutorial-next-button').click();
        await expect(page.locator('[data-tutorial-step="pick-action-after-wheel"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('本回合还剩一次手牌行动');
        await saveScreenshot(page, TUTORIAL_STEP_02D);
        await page.getByTestId('qidahen-action-recruit').click();
        await expect(page.locator('[data-tutorial-step="pay-recruit-after-wheel"]')).toBeVisible({ timeout: 10000 });
        const handBeforeRecruit = (afterWheel.factions as Record<string, { handCount: number }>).ming.handCount;
        const recruitCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await recruitCard.click();
        const payConfirm = page.getByTestId('qidahen-action-payment-confirm');
        await expect(payConfirm).toBeEnabled();
        await payConfirm.click();
        await expect(page.locator('[data-tutorial-step="choose-recruit-target-after-wheel"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-map-guide-hit-target-city-region-24').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit-formation-after-wheel"]')).toBeVisible({ timeout: 10000 });
        const xuanfuBeforeRecruit = (await readQidahenCore(page).then((core) => core.regions as Array<{ id: string; troops: number }>))
            .find((region) => region.id === 'city-region-24');
        await page.getByTestId('qidahen-recruit-choice-level-2-troops').click();

        await expect(page.locator('[data-tutorial-step="wheel-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('两种行动都已完成');
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('建立 6 个等级 2 部队');
        const afterRecruit = await readQidahenCore(page);
        const xuanfuAfterRecruit = (afterRecruit.regions as Array<{ id: string; troops: number }>).find((region) => (
            region.id === 'city-region-24'
        ));
        const handAfterRecruit = (afterRecruit.factions as Record<string, { handCount: number }>).ming.handCount;
        expect(afterRecruit.currentPlayer).not.toBe('0');
        expect(xuanfuAfterRecruit?.troops).toBe((xuanfuBeforeRecruit?.troops ?? 0) + 6);
        expect(handAfterRecruit).toBe(handBeforeRecruit - 1);
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('征召军队');
        await saveScreenshot(page, TUTORIAL_STEP_02E);
        await completeBasicTutorialAndProveContinuation(page);
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-wheel-first-branch', diagnostics }]);
    });

    test('基础教程的 3 格走法会让对手抽牌，逐项选择训练、征兵和额外训练后继续同一局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible({ timeout: 10000 });
        await completeBasicRecruitAction(page);
        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });

        const beforeMove = await readQidahenCore(page);
        await expect(page.getByTestId('qidahen-wheel-move-target-move-3-all-opponents')).toBeVisible();
        await expect(page.getByTestId('qidahen-wheel-move-target-move-3-all-opponents')).toHaveAttribute('aria-disabled', 'false');
        await saveScreenshot(page, TUTORIAL_STEP_03_THREE_GRID_ENTRY);
        await page.getByTestId('qidahen-wheel-move-target-move-3-all-opponents').click();
        await expect(page.locator('[data-tutorial-step="recruit-train-payment"]')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-payment-panel')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('征兵训练先弃 1 张手牌');
        await expect(page.getByTestId('qidahen-wheel-tip')).toHaveCount(0);
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-draw-pile'),
            '征兵训练支付提示不得遮住当前行动人的抽牌堆',
        );

        const afterMove = await readQidahenCore(page);
        expect(afterMove.actionWheelPosition).toBe('wheel-recruit-train');
        expect(afterMove.wheelActionUsed).toBe(true);
        expect(afterMove.factions.mongol.handCount).toBe(beforeMove.factions.mongol.handCount + 2);
        expect(afterMove.factions.jin.handCount).toBe(beforeMove.factions.jin.handCount + 2);
        expect(afterMove.factions.ming.handCount).toBe(beforeMove.factions.ming.handCount);
        const mingRegionBefore = (beforeMove.regions as Array<{ id: string; troops: number }>).find((region) => region.id === 'city-region-24');
        const mingRegionAfter = (afterMove.regions as Array<{ id: string; troops: number }>).find((region) => region.id === 'city-region-24');
        expect(afterMove.wheelRecruitTrainProgress).toMatchObject({ phase: 'payment', paymentPurpose: 'initial' });
        expect(afterMove.lastSeasonSummary).toBeNull();
        expect(mingRegionAfter?.troops).toBe(mingRegionBefore?.troops);
        await saveScreenshot(page, TUTORIAL_STEP_03C);

        const initialPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await expect(initialPaymentCard).toBeVisible();
        await initialPaymentCard.click();
        await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();

        await expect(page.locator('[data-tutorial-step="recruit-train-decision-0"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('直接建立 1 个等级 2 的正规军部队');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('每个部队只能各提升 1 级');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本土');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵');
        await saveScreenshot(page, TUTORIAL_STEP_03E);
        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Atrain').click();

        await expect(page.locator('[data-tutorial-step="recruit-train-training-target-0"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('当前等级和目标等级');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本土');
        const firstTrainingTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-train%3A"]').first();
        await expect(firstTrainingTarget).toBeVisible();
        await expectWheelRecruitTrainTargetListFullyVisible(
            page,
            'recruit-train-training-target-0',
            'qidahen-wheel-recruit-train-choice-train%3A',
        );
        const firstTrainingTargetId = await firstTrainingTarget.getAttribute('data-testid');
        await saveScreenshot(page, TUTORIAL_STEP_03F);
        const beforeTraining = await readQidahenCore(page);
        await firstTrainingTarget.click();
        await expect(page.locator('[data-tutorial-step="recruit-train-decision-1"]')).toBeVisible();
        const afterTraining = await readQidahenCore(page);
        expect(afterTraining.wheelRecruitTrainProgress).toMatchObject({ phase: 'choose-action', actionsCompleted: 1 });
        expect((afterTraining.trainedTroopPieceIdsThisTurn as string[]).length)
            .toBeGreaterThan((beforeTraining.trainedTroopPieceIdsThisTurn as string[]).length);
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('训练至');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('每额外弃 1 张手牌，可再训练 1 支部队');
        const firstAvailableExtraTraining = page.getByTestId('qidahen-wheel-recruit-train-choice-extra-training');
        await expect(firstAvailableExtraTraining).toBeVisible();
        await expect(firstAvailableExtraTraining).toContainText('额外训练 · 弃 1 张手牌');
        await saveScreenshot(page, TUTORIAL_STEP_03G);

        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Arecruit').click();
        await expect(page.locator('[data-tutorial-step="recruit-train-recruit-target-1"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('正规军必须在本土（深色）区域建立');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('当前等级和目标等级');
        const recruitTargets = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-recruit%3A"]');
        expect(await recruitTargets.count()).toBeGreaterThan(0);
        const recruitTargetListFits = await page.getByTestId('qidahen-wheel-recruit-train-selection').evaluate((element) => (
            element.scrollHeight <= element.clientHeight
        ));
        expect(recruitTargetListFits, '征兵候选区域列表应完整显示，无需滚动才能看到末项').toBe(true);
        await saveScreenshot(page, TUTORIAL_STEP_03H);
        await recruitTargets.first().click();
        await expect(page.locator('[data-tutorial-step="recruit-train-decision-2"]')).toBeVisible();
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result'))
            .toContainText('建立 1 个等级 2 正规军部队');

        const extraTrainingChoice = page.getByTestId('qidahen-wheel-recruit-train-choice-extra-training');
        await expect(extraTrainingChoice).toBeVisible();
        await expect(extraTrainingChoice).toContainText('额外训练 · 弃 1 张手牌');
        await extraTrainingChoice.click();
        await expect(page.locator('[data-tutorial-step="recruit-train-extra-payment-2"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]'))
            .toContainText('每额外弃 1 张手牌，可额外进行 1 次训练');
        const mingBeforeExtra = (await readQidahenCore(page)).factions as Record<string, { handCount: number }>;
        expect(mingBeforeExtra.ming.handCount).toBe(1);
        await saveScreenshot(page, TUTORIAL_STEP_03I);
        const extraPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await extraPaymentCard.click();
        await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();
        await expect(page.locator('[data-tutorial-step="recruit-train-training-target-2"]')).toBeVisible();
        const extraTrainingTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-train%3A"]').first();
        await expect(extraTrainingTarget).toBeVisible();
        await expectWheelRecruitTrainTargetListFullyVisible(
            page,
            'recruit-train-training-target-2',
            'qidahen-wheel-recruit-train-choice-train%3A',
        );
        const extraTrainingTargetId = await extraTrainingTarget.getAttribute('data-testid');
        expect(extraTrainingTargetId).not.toBe(firstTrainingTargetId);
        await saveScreenshot(page, TUTORIAL_STEP_03J);
        await extraTrainingTarget.click();

        await expect(page.locator('[data-tutorial-step="recruit-train-decision-3"]')).toBeVisible();
        const afterExtraTraining = await readQidahenCore(page);
        expect(afterExtraTraining.factions.ming.handCount).toBe(0);
        expect(afterExtraTraining.wheelRecruitTrainProgress).toMatchObject({
            phase: 'choose-action',
            actionsCompleted: 2,
            extraTrainingsCompleted: 1,
        });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-choice-extra-training')).toHaveCount(0);
        await page.getByTestId('qidahen-wheel-recruit-train-choice-finish').click();
        await expect(page.locator('[data-tutorial-step="wheel-result"]')).toBeVisible({ timeout: 10000 });
        expect((await readQidahenCore(page)).wheelRecruitTrainProgress).toBeNull();
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('轮盘征兵/训练');
        await saveScreenshot(page, TUTORIAL_STEP_03K);
        await completeBasicTutorialAndProveContinuation(page, TUTORIAL_STEP_03L);
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-wheel-three-step-branch', diagnostics }]);
    });

    test('移动横屏真实教程支持长按手牌检视，关闭后回到牌桌且不提交正式行动', async ({ browser, baseURL }) => {
        test.setTimeout(90_000);
        const touchContext = await browser.newContext({
            baseURL,
            viewport: { width: 844, height: 390 },
            hasTouch: true,
            isMobile: false,
        });
        await setChineseLocale(touchContext);
        await disableAudio(touchContext);
        await touchContext.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
            (window as HarnessWindow).__BG_HIDE_DEBUG_PANEL__ = true;
        });
        const touchPage = await touchContext.newPage();
        const diagnostics = attachPageDiagnostics(touchPage);

        try {
            await touchPage.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
            await expect(touchPage.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
            await expect(touchPage.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
            await expect(touchPage.getByTestId('debug-toggle-container')).toHaveCount(0);
            await expectTutorialOverlayNotToCover(
                touchPage,
                touchPage.getByTestId('qidahen-hand-zone'),
                'mobile welcome tutorial card must not cover the hand zone',
            );
            await expectTutorialOverlayNotToCover(
                touchPage,
                touchPage.getByTestId('qidahen-actions-zone'),
                'mobile welcome tutorial card must not cover the hand-action panel',
            );
            const mobileYearCards = touchPage.locator('[data-testid^="qidahen-year-card-slot-"]');
            for (let index = 0; index < await mobileYearCards.count(); index += 1) {
                await expectTutorialOverlayNotToCover(
                    touchPage,
                    mobileYearCards.nth(index),
                    `mobile welcome tutorial card must not cover year card ${index + 1}`,
                );
            }
            const mobilePlayerStatusPanels = touchPage.locator('[data-testid^="qidahen-player-"]:not([data-testid="qidahen-player-float"])');
            for (let index = 0; index < await mobilePlayerStatusPanels.count(); index += 1) {
                await expectTutorialOverlayNotToCover(
                    touchPage,
                    mobilePlayerStatusPanels.nth(index),
                    `mobile welcome tutorial card must not cover player status panel ${index + 1}`,
                );
            }
            await touchPage.screenshot({ path: resolve(MOBILE_TUTORIAL_WELCOME), fullPage: false });

            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="choose-opening-action"]')).toBeVisible({ timeout: 10000 });
            await expect(touchPage.locator('[data-testid="tutorial-highlight-ring"]')).toHaveCount(0);
            await expect(touchPage.locator('[data-testid="tutorial-overlay-card"]')).toContainText('征召军队');
            await expect(touchPage.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先后由你决定');
            await expect(touchPage.locator('[data-testid="tutorial-overlay-card"]'))
                .not.toContainText('长按手牌');
            const mobileActionWheel = touchPage.getByTestId('qidahen-action-wheel');
            const mobileActionZone = touchPage.getByTestId('qidahen-actions-zone');
            const mobileRecruitAction = touchPage.getByTestId('qidahen-action-recruit');
            const mobileHandZone = touchPage.getByTestId('qidahen-hand-zone');
            const mobileFabMenu = touchPage.getByTestId('fab-menu');
            await expectTutorialOverlayNotToCover(
                touchPage,
                mobileActionWheel,
                'mobile action tutorial must keep the wheel visible',
            );
            await expectTutorialOverlayNotToCover(
                touchPage,
                mobileHandZone,
                'mobile action tutorial must keep the hand visible',
            );
            await expectTutorialOverlayNotToCover(
                touchPage,
                mobileActionZone,
                'mobile action tutorial must keep the hand-action list visible',
            );
            await expectTutorialOverlayNotToCover(
                touchPage,
                mobileRecruitAction,
                'mobile action tutorial must keep the highlighted recruit action visible',
            );
            await expectTutorialOverlayNotToCover(
                touchPage,
                mobileFabMenu,
                'mobile action tutorial must keep the chat menu control visible and its label unobstructed',
            );
            for (let index = 0; index < await mobileYearCards.count(); index += 1) {
                await expectTutorialOverlayNotToCover(
                    touchPage,
                    mobileYearCards.nth(index),
                    `mobile action tutorial must not cover year card ${index + 1}`,
                );
            }
            for (let index = 0; index < await mobilePlayerStatusPanels.count(); index += 1) {
                await expectTutorialOverlayNotToCover(
                    touchPage,
                    mobilePlayerStatusPanels.nth(index),
                    `mobile action tutorial must not cover player status panel ${index + 1}`,
                );
            }

            await touchPage.screenshot({ path: resolve(MOBILE_OPENING_ACTION), fullPage: false });
            await mobileRecruitAction.click();
            await expect(touchPage.locator('[data-tutorial-step="pay-recruit"]')).toBeVisible({ timeout: 10000 });
            await expect(touchPage.locator('[data-testid="tutorial-overlay-card"]')).toContainText('征召军队需弃 1 张手牌');
            await expect(touchPage.locator('[data-testid="tutorial-overlay-card"]')).toContainText('移动端长按');
            await expect(touchPage.getByTestId('qidahen-action-payment-panel')).toBeVisible();
            await expectTutorialOverlayFullyVisible(touchPage, 'pay-recruit');
            const mobilePaymentConfirm = touchPage.getByTestId('qidahen-action-payment-confirm');
            await expect(touchPage.getByTestId('tutorial-highlight-ring'))
                .toHaveAttribute('data-tutorial-highlight-target', 'qidahen-action-payment-confirm');
            await expectTutorialOverlayNotToCover(touchPage, mobilePaymentConfirm, '移动端征召支付提示必须让确认按钮可见');

            const touchHandCard = touchPage.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
            await expect(touchHandCard).toBeVisible({ timeout: 10000 });
            await expect(touchHandCard).toHaveAttribute('data-qidahen-hand-card-touch-inspect', 'long-press');
            await touchPage.screenshot({ path: resolve(MOBILE_HAND_INSPECT_BEFORE), fullPage: false });

            const beforeLongPress = await readQidahenCore(touchPage);
            expect(beforeLongPress.turnPhase).toBe('action-window');
            expect(beforeLongPress.factionActionUsed).toBe(false);
            const handCountBeforeLongPress = (beforeLongPress.factions as Record<string, { handCount: number }>).ming.handCount;
            const selectedPaymentsBeforeLongPress = beforeLongPress.selectedPaymentCardIds;

            await dispatchTouchLongPress(touchHandCard);
            await expect(touchPage.locator('[data-testid="qidahen-card-magnify-overlay"]')).toBeVisible({ timeout: 10000 });
            await expect(touchPage.locator('[data-testid="qidahen-card-magnify-content"]')).toBeVisible();
            await expect(touchPage.locator('[data-tutorial-step="pay-recruit"]')).toBeVisible();
            await expect(touchPage.getByTestId('qidahen-action-payment-panel')).toBeVisible();
            await expect(touchPage.getByTestId('qidahen-action-payment-status')).toContainText('已选 0 / 1 张');
            const magnifiedCardBounds = await touchPage.getByTestId('qidahen-card-magnify-content').boundingBox();
            expect(magnifiedCardBounds?.height).toBeGreaterThanOrEqual(350);
            const afterLongPress = await readQidahenCore(touchPage);
            expect(afterLongPress.turnPhase).toBe('action-window');
            expect(afterLongPress.factionActionUsed).toBe(false);
            expect((afterLongPress.factions as Record<string, { handCount: number }>).ming.handCount).toBe(handCountBeforeLongPress);
            expect(afterLongPress.selectedPaymentCardIds).toEqual(selectedPaymentsBeforeLongPress);
            await touchPage.screenshot({ path: resolve(MOBILE_HAND_INSPECT_OVERLAY), fullPage: false });

            await touchPage.getByTestId('qidahen-card-magnify-overlay-close').click();
            await expect(touchPage.locator('[data-testid="qidahen-card-magnify-overlay"]')).toBeHidden({ timeout: 10000 });
            await expect(touchPage.locator('[data-tutorial-step="pay-recruit"]')).toBeVisible();
            await expect(touchPage.locator('[data-testid="qidahen-hand-zone"]')).toBeVisible();
            await expectTutorialOverlayNotToCover(touchPage, touchHandCard, '支付提示不得遮住可查看的手牌');
            await expectTutorialOverlayNotToCover(touchPage, mobilePaymentConfirm, '支付提示不得遮住确认按钮');
            const afterClose = await readQidahenCore(touchPage);
            expect(afterClose.turnPhase).toBe(beforeLongPress.turnPhase);
            expect(afterClose.factionActionUsed).toBe(beforeLongPress.factionActionUsed);
            expect(afterClose.confirmedActionId).toBe(beforeLongPress.confirmedActionId);
            expect((afterClose.factions as Record<string, { handCount: number }>).ming.handCount).toBe(handCountBeforeLongPress);
            expect(afterClose.selectedPaymentCardIds).toEqual(selectedPaymentsBeforeLongPress);
            await expect(touchPage.getByTestId('qidahen-action-payment-status')).toContainText('已选 0 / 1 张');
            await touchPage.screenshot({ path: resolve(MOBILE_HAND_INSPECT_RETURN), fullPage: false });
            assertNoFatalFrontendErrors([{ label: 'qidahen-mobile-hand-inspect', diagnostics }]);
        } finally {
            await touchContext.close();
        }
    });

    test('注入终局状态后会真实显示终局遮罩', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="endgame-overlay"]')).toHaveCount(0);
        await page.waitForFunction(() => (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);

        await page.evaluate(async () => {
            const stateApi = (window as HarnessWindow).__BG_TEST_HARNESS__?.state;
            const snapshot = stateApi?.get?.();
            if (!snapshot || !stateApi?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.sys = {
                ...next.sys,
                phase: 'end',
                gameover: { winner: '0' },
            };
            await stateApi.set(next);
        });

        await expect(page.locator('[data-testid="endgame-overlay"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="endgame-overlay-content"]')).toContainText('胜利');
        await saveScreenshot(page, ENDGAME_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-closeout-endgame-overlay', diagnostics }]);
    });

    test('轮盘代价教程会展示调度费用并实际弃牌，完成后可进入常规对局创建入口', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-shared-cost', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入公共轮盘的 3 格分支');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-current-marker"]')).toHaveAttribute(
            'data-wheel-current-position',
            'wheel-military-farm',
        );
        await expect(page.locator('[data-testid="qidahen-wheel-sector"][data-wheel-candidate="true"]')).toHaveCount(3);
        await expectWheelPrimaryMove(page, 'move-3-all-opponents');
        await expect(page.locator('[data-wheel-sector-id="wheel-hire"]')).toHaveAttribute('data-wheel-candidate', 'true');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('6/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');
        await saveScreenshot(page, WHEEL_COST_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();

        await expect(page.locator('[data-tutorial-step="draw-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-current-marker"]')).toHaveAttribute(
            'data-wheel-current-position',
            'wheel-hire',
        );
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('8/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('12/10');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌数各增加 2');
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="fab-menu"]'),
            '轮盘三格抽牌结果提示不得覆盖聊天悬浮菜单',
        );
        await expectElementsNotToOverlap(
            page,
            page.locator('[data-testid="fab-menu"]'),
            page.locator('[data-testid="tutorial-next-button"]'),
            '轮盘三格抽牌结果的聊天悬浮菜单不得遮挡下一步按钮',
        );
        await saveScreenshot(page, WHEEL_COST_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="dispatch-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-status"]')).toContainText('需弃 1 张');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进攻调度：弃 1 张手牌。');
        await saveScreenshot(page, WHEEL_COST_STEP_02A);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="pay-dispatch"]')).toBeVisible({ timeout: 10000 });
        const beforeDispatchPayment = await readQidahenCore(page) as {
            currentPlayer: string;
            factions: Record<string, { discardPileCount?: number; handCount: number; playerId: string }>;
            handCards: Array<{ faction: string; id: string; status: string }>;
        };
        const payingFactionId = Object.entries(beforeDispatchPayment.factions)
            .find(([, faction]) => faction.playerId === beforeDispatchPayment.currentPlayer)?.[0];
        expect(payingFactionId).toBeTruthy();
        const handCountBeforePayment = beforeDispatchPayment.factions[payingFactionId!].handCount;
        const discardCountBeforePayment = beforeDispatchPayment.factions[payingFactionId!].discardPileCount ?? 0;
        const dispatchPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await expect(dispatchPaymentCard).toBeVisible();
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-wheel-dispatch-payment-panel'),
            '进攻调度支付提示不得遮挡支付面板',
        );
        await expectTutorialOverlayNotToCover(
            page,
            dispatchPaymentCard,
            '进攻调度支付提示不得遮挡可选手牌',
        );
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-wheel-dispatch-payment-confirm'),
            '进攻调度支付提示不得遮挡弃牌确认按钮',
        );
        await dispatchPaymentCard.click();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-status"]')).toContainText('已选 1 张');
        await expect(page.getByTestId('qidahen-wheel-dispatch-payment-confirm')).toBeEnabled();
        await saveScreenshot(page, WHEEL_COST_PAYMENT_SELECTED);
        await page.getByTestId('qidahen-wheel-dispatch-payment-confirm').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-payment-panel"]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-wheel-dispatch-selection')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图上的部队调度选择已可继续');
        const afterDispatchPayment = await readQidahenCore(page) as {
            actionWheelPosition: string;
            currentPlayer: string;
            factions: Record<string, { discardPileCount?: number; handCount: number; playerId: string }>;
            handCards: Array<{ faction: string; id: string; status: string }>;
            payment: { required: number };
            selectedPaymentCardIds: string[];
            turnPhase: string;
        };
        expect(afterDispatchPayment.currentPlayer).toBe(beforeDispatchPayment.currentPlayer);
        expect(afterDispatchPayment.factions[payingFactionId!].handCount).toBe(handCountBeforePayment - 1);
        expect(afterDispatchPayment.factions[payingFactionId!].discardPileCount).toBe(discardCountBeforePayment + 1);
        expect(afterDispatchPayment.payment.required).toBe(0);
        expect(afterDispatchPayment.selectedPaymentCardIds).toEqual([]);
        expect(afterDispatchPayment.turnPhase).toBe('dispatch-targeting');
        expect(afterDispatchPayment.actionWheelPosition).toBe('wheel-hire');
        await saveScreenshot(page, WHEEL_COST_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page).toHaveURL(/\/\?game=qidahen(?:&|$)/, { timeout: 10000 });
        const qidahenLobbyEntry = page.locator('a[href="/?game=qidahen"]');
        await expect(qidahenLobbyEntry).toBeVisible();
        const visibleGameDetailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').first();
        await expect(visibleGameDetailsModal).toBeVisible({ timeout: 10000 });
        const openCreateRoomButton = visibleGameDetailsModal.locator('[data-testid="game-details-open-create-room"]:visible').first();
        await expect(openCreateRoomButton).toBeVisible();
        await openCreateRoomButton.click();
        await expect(page.locator('[data-testid="create-room-modal"]:visible').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
    });

    test('轮盘开垦教程会真实展示人口增加的结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-reclaim', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入轮盘开垦结算');
        await saveScreenshot(page, WHEEL_RECLAIM_OVERVIEW);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“开垦”区域');
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, WHEEL_RECLAIM_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('人口增加 1');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        const reclaimCore = await readQidahenCore(page) as {
            regions: Array<{ id: string; population: number }>;
        };
        expect(reclaimCore.regions.find((region) => region.id === 'city-region-24')?.population).toBe(7);
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '开垦结果提示不得遮挡右侧行动选项',
        );
        await saveScreenshot(page, WHEEL_RECLAIM_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('开垦已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('轮盘军屯教程会真实展示补牌并建立正规军', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-military-farm', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入轮盘军屯结算');
        await saveScreenshot(page, WHEEL_MILITARY_FARM_OVERVIEW);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“军屯”区域');
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, WHEEL_MILITARY_FARM_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌已补充');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('出现 1 个等级 2 正规军');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        const militaryFarmCore = await readQidahenCore(page) as {
            factions: {
                ming: { handCount: number };
            };
            regions: Array<{ id: string; troops: number }>;
        };
        expect(militaryFarmCore.factions.ming.handCount).toBe(5);
        expect(militaryFarmCore.regions.find((region) => region.id === 'city-region-24')?.troops).toBe(3);
        await saveScreenshot(page, WHEEL_MILITARY_FARM_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('军屯已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('轮盘征兵训练教程会让玩家支付、选择两种行动、加付训练并继续对局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-recruit-train', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('从军屯再前进 1 格，会进入征兵训练');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="rule-payment"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('弃一张手牌，最多可进行4 次的征兵或训练行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('额外的训练行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵的等级上限须由军备来提升');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText(/原文|原句/);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('当前点击');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“征兵训练”区域');
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_STEP_01);
        const beforeWheelLanding = await readQidahenCore(page) as {
            regions: Array<{ id: string; troops: number }>;
            factions: { ming: { handCount: number } };
        };
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="pay-initial"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-payment-panel')).toBeVisible();
        await expect(page.getByTestId('qidahen-season-summary')).toHaveCount(0);
        const afterWheelLanding = await readQidahenCore(page) as typeof beforeWheelLanding & {
            wheelRecruitTrainProgress: { phase: string; paymentPurpose: string };
        };
        expect(afterWheelLanding.wheelRecruitTrainProgress).toEqual({
            source: 'wheel',
            phase: 'payment',
            paymentPurpose: 'initial',
            actionsCompleted: 0,
            extraTrainingsCompleted: 0,
            trainingOnly: false,
            summaryLines: [],
        });
        expect(afterWheelLanding.factions.ming.handCount).toBe(beforeWheelLanding.factions.ming.handCount);
        expect(afterWheelLanding.regions.find((region) => region.id === 'city-region-24')?.troops)
            .toBe(beforeWheelLanding.regions.find((region) => region.id === 'city-region-24')?.troops);
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_PAYMENT);
        const initialPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await expect(initialPaymentCard).toBeVisible();
        await initialPaymentCard.click();
        await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();

        await expect(page.locator('[data-tutorial-step="actions-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('-  征兵行动：直接建立 1 个等级 2 的正规军部队。');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('-  训练行动：将部队向上转 1 级，在一回合中每个部队只能各提升 1 级。');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵的等级上限须由军备来提升');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_ACTION_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-training"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Atrain').click();

        await expect(page.locator('[data-tutorial-step="artillery-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('(注意炮兵的等级上限须由军备来提升)');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本土(深色)');
        const artilleryTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-train%3A"]')
            .filter({ hasText: '宣府' })
            .filter({ hasText: '炮兵' })
            .first();
        const expectArtilleryTargetFullyVisible = async () => {
            const fullyVisible = await artilleryTarget.evaluate((target) => {
                const panel = target.closest<HTMLElement>('[data-testid="qidahen-wheel-recruit-train-selection"]');
                if (!panel) return false;
                const targetRect = target.getBoundingClientRect();
                const panelRect = panel.getBoundingClientRect();
                return targetRect.top >= panelRect.top
                    && targetRect.bottom <= panelRect.bottom
                    && targetRect.left >= panelRect.left
                    && targetRect.right <= panelRect.right;
            });
            expect(fullyVisible, '宣府炮兵训练选项应完整显示在征兵训练候选面板内').toBe(true);
        };
        await expect(artilleryTarget).toBeVisible();
        await expect(artilleryTarget).toContainText('炮兵 1级 → 2级');
        await expect(artilleryTarget).not.toContainText('{{targetLevel}}');
        await expectArtilleryTargetFullyVisible();
        await expectTutorialOverlayNotToCover(page, artilleryTarget, '炮兵训练教学提示不得覆盖当前目标');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_ARTILLERY_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-training-target"]')).toBeVisible({ timeout: 10000 });
        await expect(artilleryTarget).toBeVisible();
        await expectArtilleryTargetFullyVisible();
        await expectTutorialOverlayNotToCover(page, artilleryTarget, '炮兵训练操作提示不得覆盖当前目标');
        const artilleryBefore = await readQidahenCore(page) as {
            regions: Array<{ id: string; troops: number; specialTroops?: Array<{ troopKind: string; level: number }> }>;
        };
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_TRAINING_TARGET);
        await artilleryTarget.click();
        await expect(page.locator('[data-tutorial-step="training-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('炮兵从 1 级训练至 2 级');
        const artilleryAfter = await readQidahenCore(page) as typeof artilleryBefore;
        expect(artilleryAfter.regions.find((region) => region.id === 'city-region-24')?.troops)
            .toBe(artilleryBefore.regions.find((region) => region.id === 'city-region-24')?.troops);
        expect(artilleryAfter.regions.find((region) => region.id === 'city-region-24')?.specialTroops)
            .toEqual(expect.arrayContaining([expect.objectContaining({ troopKind: 'artillery', level: 2 })]));
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_TRAINING_RESULT);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Arecruit').click();
        await expect(page.locator('[data-tutorial-step="recruit-homeland-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('且必须在本土(深色)区域才能建立。');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('炮兵的等级上限');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_HOMELAND_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit-target"]')).toBeVisible({ timeout: 10000 });
        const recruitTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-recruit%3A"]').first();
        await expect(recruitTarget).toBeVisible();
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_RECRUIT_TARGET);
        const recruitBefore = await readQidahenCore(page) as {
            factions: { ming: { troops: number } };
            regions: Array<{ id: string; troops: number }>;
        };
        await recruitTarget.click();
        await expect(page.locator('[data-tutorial-step="recruit-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('建立 1 个等级 2 正规军部队');
        const recruitAfter = await readQidahenCore(page) as typeof recruitBefore;
        expect(recruitAfter.factions.ming.troops).toBe(recruitBefore.factions.ming.troops + 1);
        expect(recruitAfter.regions.filter((region) => (
            region.troops === (recruitBefore.regions.find((before) => before.id === region.id)?.troops ?? 0) + 1
        ))).toHaveLength(1);
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_RECRUIT_RESULT);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="extra-training-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('可透过弃手牌进行额外的训练行动，每张弃牌可额外进行 1 次训练。');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_EXTRA_RULE);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-extra-training"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-extra-training').click();
        await expect(page.locator('[data-tutorial-step="pay-extra"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-payment-panel')).toContainText('额外训练 · 弃牌');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_EXTRA_PAYMENT);
        const extraPaymentCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
        await expect(extraPaymentCard).toBeVisible();
        await extraPaymentCard.click();
        await page.getByTestId('qidahen-wheel-recruit-train-payment-confirm').click();
        await expect(page.locator('[data-tutorial-step="choose-extra-training-target"]')).toBeVisible({ timeout: 10000 });
        const extraTrainingTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-train%3A"]')
            .filter({ hasText: '宣府' })
            .filter({ hasText: '正规军' })
            .first();
        await expect(extraTrainingTarget).toBeVisible();
        await extraTrainingTarget.click();
        await expect(page.locator('[data-tutorial-step="extra-training-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-progress')).toContainText('已完成 2 / 4 次；额外训练 1 次');
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('训练至 3 级');

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-recruit-train-choice-finish"]')).toBeVisible();
        await page.getByTestId('qidahen-wheel-recruit-train-choice-finish').click();
        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('轮盘征兵/训练');
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('建立 1 个等级 2 正规军部队');
        const recruitTrainCore = await readQidahenCore(page) as {
            wheelRecruitTrainProgress: unknown;
            wheelActionUsed: boolean;
            factionActionUsed: boolean;
            lastSeasonSummary: { lines: string[] } | null;
            regions: Array<{ id: string; troops: number; specialTroops?: Array<{ troopKind: string; level: number }> }>;
        };
        expect(recruitTrainCore.wheelRecruitTrainProgress).toBeNull();
        expect(recruitTrainCore.wheelActionUsed).toBe(true);
        expect(recruitTrainCore.factionActionUsed).toBe(false);
        expect(recruitTrainCore.lastSeasonSummary?.lines).toHaveLength(3);
        expect(recruitTrainCore.regions.find((region) => region.id === 'city-region-24')?.specialTroops)
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ troopKind: 'artillery', level: 2 }),
                expect.objectContaining({ troopKind: 'infantry', level: 3 }),
            ]));
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_FINAL);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('征兵训练已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page.getByTestId('qidahen-actions-zone')).toBeVisible();
        await expect(page.getByTestId('qidahen-action-raid')).toBeEnabled();
    });

    test('升级军备教程会从真实手牌行动入口进入，并看到军备等级提升', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/armament-upgrade', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入大明手牌行动');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="action-overview"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('升级军备：打出军备牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('示例顺序');
        for (const actionId of ['raid', 'recruit', 'grant-pardon', 'drive-tiger']) {
            await expect(page.getByTestId(`qidahen-action-${actionId}`)).toBeVisible();
        }
        await saveScreenshot(page, ARMAMENT_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        const artilleryTechCard = page.locator('[data-tutorial-id="qidahen-atlas05-1626-artillery-tech"]').first();
        await expect(artilleryTechCard).toBeVisible();
        await saveScreenshot(page, ARMAMENT_STEP_01);
        await artilleryTechCard.click();

        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('弃 1 张手牌');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await saveScreenshot(page, ARMAMENT_STEP_02);

        const discardCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]:not([data-tutorial-id="qidahen-atlas05-1626-artillery-tech"])').first();
        await expect(discardCard).toBeVisible();
        await discardCard.click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).not.toContainText('军备详情');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('火炮技术从 1 级升到 2 级');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await saveScreenshot(page, ARMAMENT_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('升级军备完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('大汗令箭教程会真实选择征兵、本土目标、完成效果并继续对局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/event-action', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入蒙古手牌行动');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="action-overview"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('右侧列出蒙古的三个同层势力行动');
        for (const actionId of ['raid', 'ma-shi-trade', 'khan-edict']) {
            await expect(page.getByTestId(`qidahen-action-${actionId}`)).toBeVisible();
        }
        await saveScreenshot(page, EVENT_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-tutorial-id="qidahen-action-khan-edict"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-player-mongol')).toContainText('当前');
        await saveScreenshot(page, EVENT_STEP_01);
        await page.locator('[data-tutorial-id="qidahen-action-khan-edict"]').click();

        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('已选 0 / 1 张');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        await saveScreenshot(page, EVENT_STEP_02);

        const handCards = page.locator('button[data-testid^="qidahen-hand-card-hand-"]');
        await expect(handCards.nth(0)).toBeVisible({ timeout: 15000 });
        const firstCardBox = await handCards.nth(0).boundingBox();
        if (!firstCardBox) {
            throw new Error('first mongol hand card box missing');
        }
        await page.mouse.click(firstCardBox.x + 20, firstCardBox.y + firstCardBox.height / 2);
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="choose-effect"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]')).toContainText('征兵训练');
        const khanEdictMapTarget = page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-25"][data-action="select-region"]');
        await expect(khanEdictMapTarget).toBeVisible();
        await saveScreenshot(page, EVENT_STEP_03);
        await khanEdictMapTarget.click();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]').click();

        await expect(page.locator('[data-tutorial-step="recruit-train-actions-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('直接建立 1 个等级 2 的正规军部队');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('一回合中每个部队只能各提升 1 级');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await saveScreenshot(page, EVENT_STEP_04);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Arecruit').click();
        await expect(page.locator('[data-tutorial-step="recruit-homeland-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('且必须在本土(深色)区域才能建立。');
        await saveScreenshot(page, EVENT_STEP_05);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-recruit-target"]')).toBeVisible({ timeout: 10000 });
        const recruitTarget = page.locator('[data-testid^="qidahen-wheel-recruit-train-choice-recruit%3A"]').first();
        await expect(recruitTarget).toBeVisible();
        const beforeRecruit = await readQidahenCore(page) as {
            factions: { mongol: { troops: number } };
        };
        await recruitTarget.click();
        await expect(page.locator('[data-tutorial-step="recruit-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-wheel-recruit-train-last-result')).toContainText('建立 1 个等级 2 正规军部队');
        const afterRecruit = await readQidahenCore(page) as typeof beforeRecruit;
        expect(afterRecruit.factions.mongol.troops).toBe(beforeRecruit.factions.mongol.troops + 1);
        await saveScreenshot(page, EVENT_STEP_06);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish-recruit-train"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-wheel-recruit-train-choice-finish').click();
        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('大汗令箭 · 征兵训练');
        await expect(page.getByTestId('qidahen-season-summary')).toContainText('建立 1 个等级 2 正规军部队');
        expect((await readQidahenCore(page)).wheelRecruitTrainProgress).toBeNull();
        await saveScreenshot(page, EVENT_STEP_07);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('大汗令箭的征兵训练效果已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page.getByTestId('qidahen-actions-zone')).toBeVisible();
        const continuedCore = await readQidahenCore(page) as {
            currentPlayer: string;
            turnPhase: string;
            factionActionUsed: boolean;
            wheelActionUsed: boolean;
            wheelRecruitTrainProgress: unknown;
            roundNumber: number;
            wheelMoveChoices: Array<{ id: string }>;
            factions: Record<string, { playerId: string }>;
        };
        const activeFaction = Object.entries(continuedCore.factions)
            .find(([, faction]) => faction.playerId === continuedCore.currentPlayer)?.[0];
        expect(activeFaction).toBeTruthy();
        expect(continuedCore.turnPhase).toBe('action-window');
        expect(continuedCore.factionActionUsed).toBe(true);
        expect(continuedCore.wheelActionUsed).toBe(false);
        expect(continuedCore.wheelRecruitTrainProgress).toBeNull();
        expect(continuedCore.wheelMoveChoices.some((choice) => choice.id === 'move-1-free')).toBe(true);
        const continueWheelAction = page.getByTestId('qidahen-wheel-move-target-move-1-free');
        await expect(continueWheelAction).toBeVisible();
        await expect(continueWheelAction).toHaveAttribute('aria-disabled', 'false');
        await continueWheelAction.click();
        const afterContinuedWheelAction = await readQidahenCore(page) as {
            currentPlayer: string;
            roundNumber: number;
            wheelActionUsed: boolean;
            wheelRecruitTrainProgress: unknown;
        };
        expect(
            afterContinuedWheelAction.wheelActionUsed
            || afterContinuedWheelAction.currentPlayer !== continuedCore.currentPlayer
            || afterContinuedWheelAction.roundNumber > continuedCore.roundNumber,
        ).toBe(true);
        expect(afterContinuedWheelAction.wheelRecruitTrainProgress).toBeNull();
    });

    test('进攻与野战教程会从真实突袭作战入口支付后进入战斗与战后处理', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/attack-and-battle', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在进入大明手牌行动');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="action-overview"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('右侧列出大明的四个同层势力行动');
        for (const actionId of ['raid', 'recruit', 'grant-pardon', 'drive-tiger']) {
            await expect(page.getByTestId(`qidahen-action-${actionId}`)).toBeVisible();
        }
        await saveScreenshot(page, FIELD_BATTLE_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选择「突袭作战」');
        await expect(page.locator('[data-tutorial-id="qidahen-action-raid"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')).toHaveCount(0);
        const initialAttackCore = await readQidahenCore(page) as {
            turnPhase: string;
            factionActionUsed: boolean;
            selectedActionId: string | null;
            pendingTargetAction: unknown | null;
        };
        expect(initialAttackCore.turnPhase).toBe('action-window');
        expect(initialAttackCore.factionActionUsed).toBe(false);
        expect(initialAttackCore.selectedActionId).toBe('raid');
        expect(initialAttackCore.pendingTargetAction).toBeNull();
        await saveScreenshot(page, FIELD_BATTLE_STEP_01);
        await page.locator('[data-tutorial-id="qidahen-action-raid"]').click();

        await expect(page.locator('[data-tutorial-step="pay-raid"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选择 1 张手牌');
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('已选 0 / 1 张');
        await expect(page.locator('[data-testid="qidahen-operation-banner"]')).toHaveCount(0);
        const beforePaymentCore = await readQidahenCore(page) as {
            handCards: Array<{
                cardKind?: string;
                faction?: string;
                id: string;
                status?: string;
            }>;
        };
        const paymentCard = beforePaymentCore.handCards.find((card) => (
            card.faction === 'ming'
            && card.status !== 'disabled'
            && card.cardKind !== 'tactic'
        ));
        expect(paymentCard).toBeTruthy();
        await page.locator(`[data-testid="qidahen-hand-card-${paymentCard!.id}"]`).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText('已选 1 / 1 张');
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-action-payment-panel'),
            '突袭支付教程提示不得覆盖支付面板',
        );
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-action-payment-confirm'),
            '突袭支付教程提示不得覆盖确认执行按钮',
        );
        await saveScreenshot(page, FIELD_BATTLE_STEP_02);
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="border-width"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('察哈尔');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进攻从克什克腾部进入察哈尔部');
        const afterPaymentCore = await readQidahenCore(page) as {
            pendingTargetAction?: {
                actionId?: string;
                committedTroops?: number;
                sourceRegionId?: string;
                targetRegionId?: string;
            } | null;
            turnPhase: string;
        };
        expect(afterPaymentCore.turnPhase).toBe('resolve-pending');
        expect(afterPaymentCore.pendingTargetAction?.actionId).toBe('raid');
        expect(afterPaymentCore.pendingTargetAction?.sourceRegionId).toBe('city-region-16');
        expect(afterPaymentCore.pendingTargetAction?.targetRegionId).toBe('city-region-14');
        expect(afterPaymentCore.pendingTargetAction?.committedTroops ?? 0).toBeGreaterThan(0);
        await saveScreenshot(page, FIELD_BATTLE_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="battle-open"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭待结算');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('双方公开部队');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="tactic-window"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击「骑兵冲锋」');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('再点击「打出战术牌」确认');
        const pendingGuideGeometry = await page.evaluate(() => {
            const selectedTokens = Array.from(document.querySelectorAll<HTMLElement>(
                '[data-testid^="qidahen-map-token-"][data-pending-committed-selected="true"]',
            ));
            const targetTokens = Array.from(document.querySelectorAll<HTMLElement>(
                '[data-qidahen-map-token-type="army"][data-qidahen-map-token-region="city-region-14"]',
            ));
            const routeLine = document.querySelector<SVGPathElement>(
                '[data-testid="qidahen-map-guide-line-city-region-14"]',
            );
            const matrix = routeLine?.getScreenCTM() ?? null;
            if (selectedTokens.length <= 0 || targetTokens.length <= 0 || !routeLine || !matrix) {
                return null;
            }
            const sourceCenter = selectedTokens.reduce(
                (center, token) => {
                    const rect = token.getBoundingClientRect();
                    return {
                        x: center.x + (rect.left + rect.width / 2) / selectedTokens.length,
                        y: center.y + (rect.top + rect.height / 2) / selectedTokens.length,
                    };
                },
                { x: 0, y: 0 },
            );
            const pathStartPoint = routeLine.getPointAtLength(0);
            const pathStart = new DOMPoint(pathStartPoint.x, pathStartPoint.y).matrixTransform(matrix);
            const pathEndPoint = routeLine.getPointAtLength(routeLine.getTotalLength());
            const pathEnd = new DOMPoint(pathEndPoint.x, pathEndPoint.y).matrixTransform(matrix);
            const targetTokenRects = targetTokens.map((token) => token.getBoundingClientRect());
            const nearestTargetTokenDistance = Math.min(...targetTokenRects.map((rect) => (
                Math.hypot(
                    pathEnd.x - (rect.left + rect.width / 2),
                    pathEnd.y - (rect.top + rect.height / 2),
                )
            )));
            const overlapsTargetToken = targetTokenRects.some((rect) => (
                pathEnd.x >= rect.left - 6
                && pathEnd.x <= rect.right + 6
                && pathEnd.y >= rect.top - 6
                && pathEnd.y <= rect.bottom + 6
            ));
            return {
                startToSelectedTroops: Math.hypot(
                    pathStart.x - sourceCenter.x,
                    pathStart.y - sourceCenter.y,
                ),
                nearestTargetTokenDistance,
                overlapsTargetToken,
            };
        });
        expect(pendingGuideGeometry).not.toBeNull();
        expect(pendingGuideGeometry!.startToSelectedTroops).toBeLessThan(40);
        expect(pendingGuideGeometry!.nearestTargetTokenDistance).toBeGreaterThan(28);
        expect(pendingGuideGeometry!.overlapsTargetToken).toBe(false);
        await saveScreenshot(page, FIELD_BATTLE_STEP_03A);
        const beforeTacticCore = await readQidahenCore(page) as {
            discardPileCount: number;
            handCards: Array<{ id: string; cardDefId?: string | null }>;
        };
        const tacticCard = beforeTacticCore.handCards.find((card) => card.cardDefId === 'qidahen-atlas05-1618-cavalry-charge');
        expect(tacticCard).toBeTruthy();
        const tacticCardButton = page.locator(`[data-testid="qidahen-hand-card-${tacticCard!.id}"]`);
        const tacticCardTopBeforeSelection = await tacticCardButton.evaluate((element) => element.getBoundingClientRect().top);
        await tacticCardButton.click();
        await expect(page.locator('[data-tutorial-step="tactic-window"]')).toBeVisible({ timeout: 10000 });
        await expect(tacticCardButton).toHaveAttribute('data-game-object-selected', 'true');
        await expect.poll(async () => {
            const selectedTop = await tacticCardButton.evaluate((element) => element.getBoundingClientRect().top);
            return Math.round(tacticCardTopBeforeSelection - selectedTop);
        }).toBeGreaterThanOrEqual(38);
        await expect(page.locator('[data-testid="qidahen-tactic-card-selection-panel"]')).toContainText('骑兵冲锋');
        await expect(page.locator('[data-testid="qidahen-confirm-tactic-card"]')).toContainText('打出战术牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveAttribute('data-tutorial-placement', 'left');
        await expectTutorialOverlayNotToCover(page, tacticCardButton, 'tactic tutorial overlay should not cover selected tactic card');
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-tactic-card-selection-panel"]'),
            'tactic tutorial overlay should not cover tactic confirmation strip',
        );
        await saveScreenshot(page, FIELD_BATTLE_STEP_03B);
        await tacticCardButton.click();
        await expect(tacticCardButton).not.toHaveAttribute('data-game-object-selected', 'true');
        await expect.poll(async () => {
            const unselectedTop = await tacticCardButton.evaluate((element) => element.getBoundingClientRect().top);
            return Math.abs(Math.round(unselectedTop - tacticCardTopBeforeSelection));
        }).toBeLessThanOrEqual(4);
        await expect(page.locator('[data-testid="qidahen-tactic-card-selection-panel"]')).toBeHidden();
        await tacticCardButton.click();
        await expect(tacticCardButton).toHaveAttribute('data-game-object-selected', 'true');
        await page.locator('[data-testid="qidahen-confirm-tactic-card"]').click();

        await expect(page.locator('[data-tutorial-step="battle-damage"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击「断后」结算野战');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action"]')).toContainText('断后');
        const afterTacticCore = await readQidahenCore(page) as {
            discardPileCount: number;
            handCards: Array<{ id: string }>;
            lastSeasonSummary?: { title?: string; lines?: string[] } | null;
        };
        expect(afterTacticCore.handCards.some((card) => card.id === tacticCard?.id)).toBe(false);
        expect(afterTacticCore.discardPileCount).toBe(beforeTacticCore.discardPileCount + 1);
        expect(afterTacticCore.lastSeasonSummary?.title).toBe('战术牌');
        expect(afterTacticCore.lastSeasonSummary?.lines?.join(' ')).toContain('打出战术牌');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('攻方承伤');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('低级先损');
        await saveScreenshot(page, FIELD_BATTLE_STEP_04);
        await resolvePendingActionByCommand(page, {
            retreatLossMode: 'rear-guard',
            attackerCasualtyPriority: 'lowest-level',
            defenderCasualtyPriority: 'highest-level',
            committedTroops: 5,
        });

        await expect(page.locator('[data-tutorial-step="battle-result"]')).toBeVisible({ timeout: 10000 });
        const battleResultCore = await readQidahenCore(page) as {
            lastSeasonSummary?: { lines?: string[] } | null;
        };
        const battleResultSummary = battleResultCore.lastSeasonSummary?.lines?.join(' ') ?? '';
        expect(battleResultSummary).toContain('战斗掷骰（野战）');
        expect(battleResultSummary).toContain('骑兵');
        expect(battleResultSummary).toContain('步兵');
        expect(battleResultSummary).toContain('损伤');
        const battleMapResult = page.locator('[data-testid="qidahen-map-result-feedback"]');
        await expect(battleMapResult).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback-text"]'))
            .toContainText('察哈尔部队：1 → 0');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存');
        await saveScreenshot(page, FIELD_BATTLE_STEP_04A);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="retreat-and-defeat"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('战败方要在');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('败×1');
        await saveScreenshot(page, FIELD_BATTLE_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="post-battle-choice"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在查看战后面板，选择战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await selectPostBattleChoice(page, 'occupy');
        await expect(page.locator('[data-tutorial-step="battle-finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('野战、撤退和战后处理已完成');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await saveScreenshot(page, FIELD_BATTLE_STEP_06);
    });

    test('战败撤退教程会真实展示断后与溃退入口，并结算一次溃退代价', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/retreat-and-rout', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入野战败方的撤退选择');
        await saveScreenshot(page, ROUT_OVERVIEW);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-rout"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '溃退提示不得遮挡断后与溃退两个选项',
        );
        await saveScreenshot(page, ROUT_STEP_01);
        await page.locator('[data-testid="qidahen-resolve-pending-action-rout"]').click();

        await expect(page.locator('[data-tutorial-step="rout-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图出发区不再保留这支部队');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="fab-menu"]'),
            '撤退结果提示不得覆盖聊天悬浮菜单',
        );
        await expectElementsNotToOverlap(
            page,
            page.locator('[data-testid="fab-menu"]'),
            page.locator('[data-testid="tutorial-next-button"]'),
            '撤退结果的聊天悬浮菜单不得遮挡下一步按钮',
        );
        await saveScreenshot(page, ROUT_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('攻城教程会从真实守城宣告入口进入，再进入围城选择', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/siege-and-occupation', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_00);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="defend-city"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('守城宣告');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('守城避战');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-defender-sortie"]')).toContainText('出城野战');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '守城提示不得遮挡守城与出城野战选择',
        );
        await saveScreenshot(page, SIEGE_STEP_01);
        await page.locator('[data-testid="qidahen-resolve-pending-action-defender-hold-city"]').click();

        await expect(page.locator('[data-tutorial-step="city-battle"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('城战待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('本次出兵 4');
        const committedTroopTokens = page.locator('[data-testid^="qidahen-map-token-"][data-pending-committed-selectable="true"]');
        await expect(committedTroopTokens).toHaveCount(4);
        await expect(committedTroopTokens.nth(0)).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(committedTroopTokens.nth(3)).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击右侧战斗面板里的「断后」');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toHaveCount(0);
        await saveScreenshot(page, SIEGE_STEP_01A);
        await page.locator('[data-testid="qidahen-resolve-pending-action"]').click();

        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback-text"]')).toContainText('山海关部队：2 → 0');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('已被突破');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存 1');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城保留后金控制和城内守军');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('占领改由大明控制并清除守军');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回会放弃占领');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '战后处理提示不得遮挡围城、占领和撤回入口',
        );
        const besiegeModeButton = page.getByTestId('qidahen-post-battle-mode-besiege');
        await expect(besiegeModeButton).toContainText('围城');
        await expect(page.getByTestId('qidahen-post-battle-mode-occupy')).toBeVisible();
        await expect(page.getByTestId('qidahen-post-battle-mode-withdraw')).toBeVisible();
        await expect(page.locator('[data-tutorial-id="qidahen-post-battle-choice-entry"]')).toHaveCount(1);
        await expectTutorialOverlayNotToCover(page, besiegeModeButton, 'siege tutorial overlay should not cover besiege mode entry');
        await besiegeModeButton.click();
        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选择一种处理方式');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-post-battle-choice-list'),
            '围城目标列表不得被教程提示遮挡',
        );
        await expect(page.locator('[data-tutorial-id="qidahen-post-battle-choice-entry"]')).toHaveCount(1);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-post-battle-choice-besiege"]'),
            'siege tutorial overlay should not cover besiege choice',
        );
        const besiegeChoiceListFits = await page.getByTestId('qidahen-post-battle-choice-list').evaluate((element) => (
            element.scrollHeight <= element.clientHeight
        ));
        expect(besiegeChoiceListFits, '围城选项列表应完整显示，无需滚动才能读完末项').toBe(true);
        const postBattlePanelFits = await page.getByTestId('qidahen-actions-zone').evaluate((zone) => {
            const slot = zone.querySelector<HTMLElement>('[data-testid="qidahen-action-slot"]');
            const list = zone.querySelector<HTMLElement>('[data-testid="qidahen-post-battle-choice-list"]');
            const confirm = zone.querySelector<HTMLElement>('[data-testid="qidahen-post-battle-confirm"]');
            if (!slot || !list || !confirm) return false;
            const slotRect = slot.getBoundingClientRect();
            const options = Array.from(list.querySelectorAll<HTMLElement>('button'));
            const allOptionsVisible = options.length > 0 && options.every((option) => {
                const rect = option.getBoundingClientRect();
                return rect.top >= slotRect.top && rect.bottom <= slotRect.bottom;
            });
            const confirmRect = confirm.getBoundingClientRect();
            const confirmVisible = confirmRect.top >= slotRect.top && confirmRect.bottom <= slotRect.bottom;
            const zoneRect = zone.getBoundingClientRect();
            return allOptionsVisible && confirmVisible && zoneRect.bottom <= window.innerHeight;
        });
        expect(postBattlePanelFits, '围城选项和确认按钮应完整位于右侧面板可视范围内').toBe(true);
        const beforeBesiegeCore = await readQidahenCore(page);
        const beforeBesiegeRegions = beforeBesiegeCore.regions as Array<{
            id: string;
            controller?: string;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const beforeBesiegeShanhaiguan = beforeBesiegeRegions.find((region) => region.id === 'city-region-25');
        expect(beforeBesiegeShanhaiguan?.controller).toBe('jin');
        expect(beforeBesiegeShanhaiguan?.cityState).not.toBeNull();
        expect(beforeBesiegeShanhaiguan?.cityState?.population).toBeGreaterThan(0);
        await saveScreenshot(page, SIEGE_STEP_02);
        await selectPostBattleChoice(page, 'besiege');
        await expect(page.locator('[data-tutorial-step="besiege-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城完成：山海关仍由后金控制');
        await saveScreenshot(page, SIEGE_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toHaveCount(0);
        const afterBesiegeCore = await readQidahenCore(page);
        const afterBesiegeRegions = afterBesiegeCore.regions as Array<{
            id: string;
            controller?: string;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const afterBesiegeShanhaiguan = afterBesiegeRegions.find((region) => region.id === 'city-region-25');
        expect(afterBesiegeShanhaiguan?.controller).toBe('jin');
        expect(afterBesiegeShanhaiguan?.cityState).not.toBeNull();
        expect(afterBesiegeShanhaiguan?.cityState?.population).toBeGreaterThan(0);
        expect(afterBesiegeShanhaiguan?.siegeState?.attackerFactionId).toBe('ming');
        expect(afterBesiegeShanhaiguan?.siegeState?.attackerTroops).toBeGreaterThan(0);
    });

    test('攻城教程同章占领对照会在攻下城市后真正改控制权', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/siege-and-occupation', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="defend-city"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('守城避战');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await page.locator('[data-testid="qidahen-resolve-pending-action-defender-hold-city"]').click();

        await expect(page.locator('[data-tutorial-step="city-battle"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击右侧战斗面板里的「断后」');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action"]')).toContainText('断后');
        await page.locator('[data-testid="qidahen-resolve-pending-action"]').click();

        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('已被突破');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('占领改由大明控制并清除守军');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-actions-zone'),
            '战后选项不得被教程提示遮挡',
        );
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_01);
        const occupyModeButton = page.getByTestId('qidahen-post-battle-mode-occupy');
        await expect(occupyModeButton).toContainText('占领');
        await occupyModeButton.click();
        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回会放弃占领');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-post-battle-choice-list'),
            '占领候选列表不得被教程提示遮挡',
        );
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');
        await expect(page.getByTestId('qidahen-post-battle-scroll-hint')).toHaveText('滚动列表查看全部选项。');
        const occupyChoiceList = page.getByTestId('qidahen-post-battle-choice-list');
        const occupyChoiceContentFits = await occupyChoiceList.locator('button').evaluateAll((buttons) => (
            buttons.every((button) => getComputedStyle(button).flexShrink === '0' && button.scrollHeight <= button.clientHeight)
        ));
        expect(occupyChoiceContentFits, '占领选项说明卡不得被列表高度压缩截断').toBe(true);
        const occupyLastChoice = occupyChoiceList.locator('button').last();
        await occupyLastChoice.scrollIntoViewIfNeeded();
        const occupyLastChoiceFullyVisible = await occupyChoiceList.evaluate((list) => {
            const choice = list.querySelector<HTMLElement>('button:last-child');
            if (!choice) return false;
            const listRect = list.getBoundingClientRect();
            const choiceRect = choice.getBoundingClientRect();
            return choiceRect.top >= listRect.top && choiceRect.bottom <= listRect.bottom;
        });
        expect(occupyLastChoiceFullyVisible, '占领方式列表滚动到底部后，末项说明卡应完整可读').toBe(true);
        await occupyChoiceList.evaluate((list) => { list.scrollTop = 0; });
        await expect(page.getByTestId('qidahen-discard-anchor')).toHaveCount(0);
        const occupyConfirm = page.getByTestId('qidahen-post-battle-confirm');
        if (await occupyConfirm.count() > 0) {
            await expect(occupyConfirm).toBeVisible();
            await expectTutorialOverlayNotToCover(
                page,
                occupyConfirm,
                '占领确认按钮不得被教程卡遮挡',
            );
            const chatFabButton = page.locator('[data-testid="fab-menu"] button[aria-label="聊天"]');
            await expect(chatFabButton).toBeVisible();
            const [fabRect, confirmRect] = await Promise.all([
                readLocatorRect(chatFabButton),
                readLocatorRect(occupyConfirm),
            ]);
            expect(getRectOverlapArea(fabRect, confirmRect), '教程中的聊天悬浮按钮不得压住占领确认操作').toBeLessThanOrEqual(1);
        }
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_02);
        await selectPostBattleChoice(page, 'occupy');

        await expect(page.locator('[data-tutorial-step="occupy-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('占领完成：山海关改由大明控制');
        await saveScreenshot(page, SIEGE_OCCUPY_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城、占领或撤回分别决定山海关控制权、城市状态和幸存部队去向');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        const afterOccupyCore = await readQidahenCore(page);
        const afterOccupyRegions = afterOccupyCore.regions as Array<{
            id: string;
            controller?: string;
            troops?: number;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const occupiedShanhaiguan = afterOccupyRegions.find((region) => region.id === 'city-region-25');
        expect(occupiedShanhaiguan?.controller).toBe('ming');
        expect(occupiedShanhaiguan?.troops).toBeGreaterThan(0);
        expect(occupiedShanhaiguan?.cityState).toBeNull();
        expect(occupiedShanhaiguan?.siegeState).toBeNull();
    });

    test('攻城教程允许撤回幸存部队并保留山海关原控制权', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/siege-and-occupation', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="defend-city"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-resolve-pending-action-defender-hold-city').click();
        await expect(page.locator('[data-tutorial-step="city-battle"]')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('qidahen-resolve-pending-action').click();
        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-post-battle-outcome"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回会放弃占领');
        await saveScreenshot(page, SIEGE_WITHDRAW_STEP_01);
        const withdrawModeButton = page.getByTestId('qidahen-post-battle-mode-withdraw');
        await expect(withdrawModeButton).toBeVisible();
        await expectTutorialOverlayNotToCover(page, withdrawModeButton, '战后处理提示不得遮挡撤回入口');
        await withdrawModeButton.click();

        const withdrawChoice = page.getByTestId('qidahen-post-battle-choice-withdraw:city-region-24');
        await expect(withdrawChoice).toContainText('退回');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-post-battle-choice-list'),
            '撤回目标列表不得被教程提示遮挡',
        );
        await withdrawChoice.click();
        await saveScreenshot(page, SIEGE_WITHDRAW_STEP_02);
        await page.getByTestId('qidahen-post-battle-confirm').click();

        await expect(page.locator('[data-tutorial-step="withdraw-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('撤回完成：山海关仍由后金控制');
        await saveScreenshot(page, SIEGE_WITHDRAW_STEP_03);

        const afterWithdrawCore = await readQidahenCore(page);
        const afterWithdrawRegions = afterWithdrawCore.regions as Array<{
            id: string;
            controller?: string;
            troops?: number;
            cityState?: { troops?: number; population?: number } | null;
            siegeState?: { attackerFactionId?: string; attackerTroops?: number } | null;
        }>;
        const withdrawnShanhaiguan = afterWithdrawRegions.find((region) => region.id === 'city-region-25');
        const withdrawDestination = afterWithdrawRegions.find((region) => region.id === 'city-region-24');
        expect(withdrawnShanhaiguan?.controller).toBe('jin');
        expect(withdrawnShanhaiguan?.cityState).not.toBeNull();
        expect(withdrawnShanhaiguan?.siegeState).toBeNull();
        expect(withdrawDestination?.controller).toBe('ming');
        expect(withdrawDestination?.troops).toBeGreaterThan(0);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
    });

    test('外交雇佣教程会从真实轮盘入口进入，并完成一次友好标记与雇佣结算', async ({ page }) => {
        const diagnostics = attachPageDiagnostics(page);
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/diplomacy-and-hire', { waitUntil: 'domcontentloaded' });

        await page.waitForFunction(() => {
            return Boolean(
                document.querySelector('[data-testid="qidahen-board"]')
                || document.querySelector('[data-bg-friendly-screen="true"]'),
            );
        }, { timeout: 30000 });
        const friendlyErrorScreen = page.locator('[data-bg-friendly-screen="true"]');
        if (await friendlyErrorScreen.isVisible().catch(() => false)) {
            const errorScreenText = await friendlyErrorScreen.innerText().catch(() => '游戏加载失败');
            const diagnosticTail = diagnostics.errors.slice(-8).join('\n') || 'EMPTY';
            throw new Error([
                '外交雇佣教程在进入棋盘前命中前端错误屏。',
                `错误屏文案: ${errorScreenText}`,
                `最近页面错误:\n${diagnosticTail}`,
            ].join('\n'));
        }
        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await assertNoFatalFrontendErrors([{ label: 'qidahen-diplomacy-and-hire', diagnostics }]);
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入轮盘外交雇佣');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expectWheelPrimaryMove(page, 'move-1-free');
        await saveScreenshot(page, DIPLOMACY_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="choose-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('外交目标');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('邻近 山海关');
        await expect(page.locator('[data-testid^="qidahen-diplomacy-target-"]')).toHaveCount(4);
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="select-region"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交目标必须与己方控制区相邻');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="friendly-mark"]')).toBeVisible({ timeout: 10000 });
        const friendlyMarkTarget = page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="select-region"]');
        await expect(friendlyMarkTarget).toBeInViewport();
        await friendlyMarkTarget.click();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
        await saveScreenshot(page, DIPLOMACY_STEP_02);
        await page.locator('[data-testid="qidahen-diplomacy-choice-place-friendly"]').click();

        await expect(page.locator('[data-tutorial-step="tribute-mark"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('翻为附庸');
        await expect(page.locator('[data-testid="qidahen-diplomacy-choice-flip-vassal"]')).toContainText('翻为附庸');
        await saveScreenshot(page, DIPLOMACY_STEP_02A);
        await page.locator('[data-testid="qidahen-diplomacy-choice-flip-vassal"]').click();

        await expect(page.locator('[data-tutorial-step="remove-mark"]')).toBeVisible({ timeout: 10000 });
        const removeMarkTarget = page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-22"][data-action="select-region"]');
        await expect(removeMarkTarget).toBeVisible();
        await expect(removeMarkTarget).toBeInViewport();
        await removeMarkTarget.click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('移除控制标记');
        await expect(page.locator('[data-testid="qidahen-diplomacy-choice-remove-marker"]')).toContainText('移除控制标记');
        await saveScreenshot(page, DIPLOMACY_STEP_02B);
        await page.locator('[data-testid="qidahen-diplomacy-choice-remove-marker"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        const diplomacyCore = await readQidahenCore(page) as {
            regions: Array<{
                id: string;
                controller?: string;
                diplomacyMarkerFaction?: string | null;
                diplomacyMarkerSide?: string | null;
                specialTroops?: Array<{
                    label?: string;
                    faction?: string;
                    count?: number;
                    level?: number;
                }>;
            }>;
            lastSeasonSummary?: { title?: string; lines?: string[] } | null;
        };
        const ningyuan = diplomacyCore.regions.find((region) => region.id === 'city-region-24');
        expect(ningyuan?.controller).toBe('ming');
        expect(ningyuan?.diplomacyMarkerFaction).toBe('ming');
        expect(ningyuan?.diplomacyMarkerSide).toBe('vassal');
        const dongjiang = diplomacyCore.regions.find((region) => region.id === 'city-region-22');
        expect(dongjiang?.diplomacyMarkerFaction).toBeNull();
        expect(dongjiang?.diplomacyMarkerSide).toBeNull();
        const hireRegion = diplomacyCore.regions.find((region) => region.id === 'city-region-25');
        expect(
            hireRegion?.specialTroops?.some((troop) => (
                troop.label?.includes('雇佣军')
                && troop.faction === 'ming'
                && troop.count === 2
                && troop.level === 2
            )),
        ).toBe(true);
        expect(diplomacyCore.lastSeasonSummary?.title).toBe('轮盘外交/雇佣');
        const diplomacySummaryText = diplomacyCore.lastSeasonSummary?.lines?.join(' ') ?? '';
        expect(diplomacySummaryText).toContain('建立 2 个等级 2 雇佣军');
        expect(diplomacySummaryText).toContain('宁远');
        expect(diplomacySummaryText).toContain('东江');
        expect(diplomacySummaryText).toContain('控制标记已移除');
        await saveScreenshot(page, DIPLOMACY_STEP_03);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交标记和雇佣部队已结算');
        await saveScreenshot(page, DIPLOMACY_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('年中新年教程会从年中摘要继续推进到新年维护，再看到跨年结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/year-and-characters', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入年中与新年结算');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-midyear"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('指定一个对手抽 2 张牌并向前走 2 格');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]')).toBeVisible();
        await expectWheelPrimaryMove(page, 'move-2-one-opponent');
        await clickWheelMoveUntilTutorialStep(page, 'move-2-one-opponent', 'midyear-tax');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('税赋');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        const midyearCore = await readQidahenCore(page);
        const midyearSummaryText = ((midyearCore.lastSeasonSummary as { lines?: string[] } | null)?.lines ?? []).join(' ');
        const midyearFactions = midyearCore.factions as Record<string, { defeatMarkers?: number; handCount?: number }>;
        expect(midyearSummaryText).toContain('土地税赋');
        expect(midyearSummaryText).toContain('战败标记');
        expect(midyearSummaryText).toContain('非朝鲜区域');
        expect(midyearFactions.ming.defeatMarkers).toBe(0);
        expect(midyearFactions.mongol.defeatMarkers).toBe(0);
        expect(midyearFactions.jin.defeatMarkers).toBe(0);
        await saveScreenshot(page, SEASON_STEP_01);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="midyear-characters"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('战败标记');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-new-year"]')).toBeVisible({ timeout: 10000 });
        await clickWheelMoveUntilTutorialStep(page, 'move-1-free', 'new-year-tribute');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('新年朝贡');
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜牌库');
        await saveScreenshot(page, SEASON_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="new-year-maintenance"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        const beforeNewYearMaintenanceCore = await readQidahenCore(page);
        const beforeNewYearFactions = beforeNewYearMaintenanceCore.factions as Record<string, { handCount?: number; vp?: number }>;
        const beforeNewYearOrder = beforeNewYearMaintenanceCore.currentFactionOrder as string[];
        const beforeNewYearIndex = beforeNewYearMaintenanceCore.currentYearIndex as number;
        await saveScreenshot(page, SEASON_STEP_03);
        await page.locator('[data-testid="qidahen-fortification-maintenance-choice-auto-pay"]').click();
        await expect(page.locator('[data-tutorial-step="new-year-attrition"]')).toBeVisible({ timeout: 10000 });
        const afterNewYearMaintenanceCore = await readQidahenCore(page);
        const afterNewYearFactions = afterNewYearMaintenanceCore.factions as Record<string, { handCount?: number; vp?: number; characters?: Array<{ inPlay?: boolean }> }>;
        const afterNewYearSummary = afterNewYearMaintenanceCore.lastSeasonSummary as { title?: string; lines?: string[] } | null;
        const afterNewYearSummaryText = (afterNewYearSummary?.lines ?? []).join(' ');
        const afterNewYearOrder = afterNewYearMaintenanceCore.currentFactionOrder as string[];
        const afterNewYearCards = afterNewYearMaintenanceCore.yearCards as unknown[];
        expect(afterNewYearSummary?.title).toBe('新年结算');
        expect(afterNewYearSummaryText).toContain('维护');
        expect(afterNewYearSummaryText).toContain('兵力耗损');
        expect(afterNewYearSummaryText).toContain('获得本年纪年卡');
        expect(afterNewYearSummaryText).toContain('威望 +1');
        expect(afterNewYearSummaryText).toContain('非朝鲜区域');
        expect(afterNewYearMaintenanceCore.currentYearIndex).toBe(beforeNewYearIndex + 1);
        expect(afterNewYearMaintenanceCore.currentYear).toBe('天命五年 1620');
        expect(afterNewYearOrder).toEqual(expect.arrayContaining(['ming', 'mongol', 'jin']));
        expect(afterNewYearOrder).toHaveLength(beforeNewYearOrder.length);
        expect(afterNewYearCards.length).toBeGreaterThan(0);
        expect(afterNewYearFactions.ming.handCount).toBeLessThan(beforeNewYearFactions.ming.handCount ?? 0);
        expect(afterNewYearFactions.mongol.handCount).toBeLessThan(beforeNewYearFactions.mongol.handCount ?? 0);
        expect(afterNewYearFactions.mongol.vp).toBe((beforeNewYearFactions.mongol.vp ?? 0) + 1);
        expect(afterNewYearFactions.ming.characters?.some((character) => character.inPlay)).toBe(true);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="chronology-score"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-chronology-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('纪年卡结算');
        await saveScreenshot(page, SEASON_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="turn-order-refresh"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-chronology-zone')).toBeVisible();
        await expect(page.getByTestId('qidahen-year-card-slot-current-year')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-year-card-slot-current-year"] [data-card-atlas-frame]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-ming"], [data-testid="qidahen-player-mongol"], [data-testid="qidahen-player-jin"]').filter({ hasText: '当前' })).toHaveCount(1);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('纪年结算完成');
        await saveScreenshot(page, SEASON_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('qidahen-chronology-zone')).toBeVisible();
        await expect(page.getByTestId('qidahen-year-card-slot-current-year')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-year-card-slot-current-year"] [data-card-atlas-frame]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-ming"], [data-testid="qidahen-player-mongol"], [data-testid="qidahen-player-jin"]').filter({ hasText: '当前' })).toHaveCount(1);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await saveScreenshot(page, SEASON_STEP_06);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('朝鲜与地图特例教程会从真实新年入口看到朝鲜朝贡，再通过维护结算看到朝鲜耗损与山海关结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/korea-and-special-map-rules', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入朝鲜、汉城、水路和山海关特例');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="korea-region"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝贡图标决定新年抽牌数');
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜牌库');
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜弃牌');
        await expect(page.locator('[data-testid="qidahen-korea-draw-pile"]')).toContainText('9');
        await expect(page.locator('[data-testid="qidahen-korea-discard-pile"]')).toContainText('3');
        const initialKoreaCore = await readQidahenCore(page);
        const initialKoreaRegions = initialKoreaCore.regions as { id: string; population?: number }[];
        const findInitialKoreaRegion = (regionId: string) => initialKoreaRegions.find((region) => region.id === regionId);
        expect(initialKoreaCore.koreaDeckCount).toBe(9);
        expect(initialKoreaCore.koreaDiscardCount).toBe(3);
        expect(findInitialKoreaRegion('xian-xing')?.population).toBe(0);
        expect(findInitialKoreaRegion('city-region-18')?.population).toBe(0);
        expect(findInitialKoreaRegion('city-region-29')?.population).toBe(0);
        await saveScreenshot(page, KOREA_STEP_01);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="hanseong-vp"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('汉城控制权对应 1 点威望');
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toContainText('汉城+1');
        await saveScreenshot(page, KOREA_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="water-limit"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('船锚水路一次最多移动 2 个部队');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('骑兵不能用水路避战');
        await saveScreenshot(page, KOREA_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="new-year-maintenance"]')).toBeVisible({ timeout: 10000 });
        const autoPayChoice = page.getByTestId('qidahen-fortification-maintenance-choice-auto-pay');
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        await expect(autoPayChoice).toContainText('尽量维护防线');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击“尽量维护防线”，进入新年维护');
        await saveScreenshot(page, KOREA_STEP_04);
        await autoPayChoice.click();

        await expect(page.locator('[data-tutorial-step="korea-attrition"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝鲜部队耗损');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
        const koreaAttritionCore = await readQidahenCore(page);
        const koreaAttritionSummaryText = ((koreaAttritionCore.lastSeasonSummary as { lines?: string[] } | null)?.lines ?? []).join(' ');
        expect(koreaAttritionSummaryText).toContain('朝鲜耗损');
        expect(koreaAttritionSummaryText).toContain('非朝鲜区域');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="shanhaiguan"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('完整时边界窄');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await saveScreenshot(page, KOREA_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝贡、汉城、水路和山海关特例');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });
});
