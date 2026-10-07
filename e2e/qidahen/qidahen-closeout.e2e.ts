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
const TUTORIAL_CATALOG_SCREENSHOT = `${TUTORIAL_DIR}/00-教程目录-先选择章节.png`;
const TUTORIAL_STEP_01 = `${TUTORIAL_DIR}/01-开场-阅读三种胜利条件.png`;
const TUTORIAL_STEP_01A = `${TUTORIAL_DIR}/01a-玩家行动流程-轮盘与手牌行动无固定先后.png`;
const TUTORIAL_STEP_02 = `${TUTORIAL_DIR}/02-开局检查-3张手牌未超过15张不弃牌.png`;
const TUTORIAL_STEP_02A = `${TUTORIAL_DIR}/02a-轮盘规则-1格2格3格对应不同轮盘结算.png`;
const TUTORIAL_STEP_03 = `${TUTORIAL_DIR}/03-轮盘选择-点击高亮征兵训练.png`;
const TUTORIAL_STEP_03A = `${TUTORIAL_DIR}/03a-轮盘合法分支自动恢复到选择.png`;
const TUTORIAL_STEP_04 = `${TUTORIAL_DIR}/04-轮盘结算-征兵训练建立部队并训练炮兵.png`;
const TUTORIAL_STEP_04A = `${TUTORIAL_DIR}/04a-手牌行动规则-四个同层行动.png`;
const TUTORIAL_STEP_05 = `${TUTORIAL_DIR}/05-赐印招安规则原文.png`;
const TUTORIAL_STEP_06 = `${TUTORIAL_DIR}/06-手牌行动-现在选择赐印招安.png`;
const TUTORIAL_STEP_07 = `${TUTORIAL_DIR}/07-赐印招安-支付3张手牌.png`;
const TUTORIAL_STEP_08 = `${TUTORIAL_DIR}/08-赐印招安-锦州部队移入山海关.png`;
const TUTORIAL_STEP_09 = `${TUTORIAL_DIR}/09-赐印招安-部队位置与阵营变化.png`;
const TUTORIAL_STEP_10 = `${TUTORIAL_DIR}/10-首回合-规则链完成.png`;
const WHEEL_COST_STEP_01 = `${TUTORIAL_DIR}/13-轮盘第1步-先看走3会让两家对手摸牌.png`;
const WHEEL_COST_STEP_02 = `${TUTORIAL_DIR}/14-轮盘第2步-看蒙古后金手牌同时增加.png`;
const WHEEL_COST_STEP_02A = `${TUTORIAL_DIR}/14a-轮盘第2a步-先选择参与进攻的部队.png`;
const WHEEL_COST_STEP_03 = `${TUTORIAL_DIR}/15-轮盘第3步-进入进攻调度落点.png`;
const WHEEL_RECLAIM_STEP_01 = `${TUTORIAL_DIR}/15a-开垦第1步-点击高亮开垦.png`;
const WHEEL_RECLAIM_STEP_02 = `${TUTORIAL_DIR}/15b-开垦第2步-看己方控制区人口增加.png`;
const WHEEL_MILITARY_FARM_STEP_01 = `${TUTORIAL_DIR}/15c-军屯第1步-点击高亮军屯.png`;
const WHEEL_MILITARY_FARM_STEP_02 = `${TUTORIAL_DIR}/15d-军屯第2步-看补牌并建立正规军.png`;
const WHEEL_RECRUIT_TRAIN_STEP_01 = `${TUTORIAL_DIR}/15e-征兵训练第1步-点击高亮征兵训练.png`;
const WHEEL_RECRUIT_TRAIN_STEP_02 = `${TUTORIAL_DIR}/15f-征兵训练第2步-看加兵并训练炮兵.png`;
const WHEEL_RECRUIT_TRAIN_FEEDBACK_DETAIL = `${TUTORIAL_DIR}/15f-征兵训练第2步-地图区域闪烁与兵牌淡出特写.png`;
const ARMAMENT_STEP_00 = `${TUTORIAL_DIR}/16-军备第0步-四个势力行动总览.png`;
const ARMAMENT_STEP_01 = `${TUTORIAL_DIR}/16-军备第1步-先点升级军备.png`;
const ARMAMENT_STEP_02 = `${TUTORIAL_DIR}/17-军备第2步-点击底部手牌支付2张.png`;
const ARMAMENT_STEP_03 = `${TUTORIAL_DIR}/18-军备第3步-看火炮技术升到2级.png`;
const EVENT_STEP_01 = `${TUTORIAL_DIR}/19-事件第1步-先点大汗令箭.png`;
const EVENT_STEP_00 = `${TUTORIAL_DIR}/18a-事件第0步-蒙古三个势力行动总览.png`;
const EVENT_STEP_02 = `${TUTORIAL_DIR}/20-事件第2步-点击底部手牌支付1张.png`;
const EVENT_STEP_03 = `${TUTORIAL_DIR}/21-事件第3步-选择征兵训练效果.png`;
const EVENT_STEP_04 = `${TUTORIAL_DIR}/22-事件第4步-看蒙古兵力增加到4.png`;
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
const SIEGE_STEP_01 = `${TUTORIAL_DIR}/30-攻城第1步-真实守城宣告入口.png`;
const SIEGE_STEP_01A = `${TUTORIAL_DIR}/30a-攻城第1a步-右侧断后结算城战.png`;
const SIEGE_STEP_02 = `${TUTORIAL_DIR}/31-攻城第2步-选择围城该区.png`;
const SIEGE_STEP_03 = `${TUTORIAL_DIR}/31a-攻城第3步-同章选择占领该区.png`;
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
const MOBILE_HAND_INSPECT_BEFORE = `${MOBILE_TUTORIAL_DIR}/移动-01-移动教程-手牌检视前.png`;
const MOBILE_HAND_INSPECT_OVERLAY = `${MOBILE_TUTORIAL_DIR}/移动-02-移动教程-长按手牌打开检视.png`;
const MOBILE_HAND_INSPECT_AFTER_CLOSE = `${MOBILE_TUTORIAL_DIR}/移动-03-移动教程-关闭检视回到牌桌.png`;
const ENDGAME_SCREENSHOT = `${CLOSEOUT_DIR}/02-终局遮罩-注入胜利后显示.png`;

type HarnessWindow = Window & {
    __E2E_TEST_MODE__?: boolean;
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
    const [overlayRect, targetRect] = await Promise.all([
        readLocatorRect(page.locator('[data-testid="tutorial-overlay-card"]')),
        readLocatorRect(target),
    ]);
    expect(getRectOverlapArea(overlayRect, targetRect), label).toBeLessThanOrEqual(1);
};

const expectResultTroopSizeToMatchMapToken = async (page: Page) => {
    const feedback = page.locator('[data-testid="qidahen-map-result-feedback"]');
    const regionId = await feedback.getAttribute('data-qidahen-map-result-region');
    if (!regionId) {
        throw new Error('征兵训练地图反馈缺少区域标识');
    }
    const resultTroop = page.locator('[data-testid="qidahen-map-result-troop-fade"]').first();
    const mapTroop = page.locator(
        `[data-qidahen-map-token-type="army"][data-qidahen-map-token-region="${regionId}"]`,
    ).first();
    await expect(resultTroop).toBeVisible();
    await expect(mapTroop).toBeVisible();
    const [resultTroopSize, mapTroopSize] = await Promise.all([
        resultTroop.evaluate((element) => {
            const style = getComputedStyle(element);
            return { height: Number.parseFloat(style.height), width: Number.parseFloat(style.width) };
        }),
        mapTroop.evaluate((element) => {
            const style = getComputedStyle(element);
            return { height: Number.parseFloat(style.height), width: Number.parseFloat(style.width) };
        }),
    ]);
    expect(Math.abs(resultTroopSize.width - mapTroopSize.width), '新增兵牌宽度必须匹配地图原兵牌').toBeLessThanOrEqual(0.01);
    expect(Math.abs(resultTroopSize.height - mapTroopSize.height), '新增兵牌高度必须匹配地图原兵牌').toBeLessThanOrEqual(0.01);
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

    test.beforeAll(() => {
        resetScreenshotDir(TUTORIAL_DIR);
        resetScreenshotDir(MOBILE_TUTORIAL_DIR);
    });

    test('教程入口会先显示章节目录，再进入指定教程章节', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(QIDAHEN_TUTORIAL_CATALOG_URL, { waitUntil: 'domcontentloaded' });

        await expect(page.getByTestId('tutorial-catalog-entry-basic-opening')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('tutorial-catalog-entry-attack-and-battle')).toBeVisible();
        await expect(page.getByTestId('tutorial-catalog-entry-siege-and-occupation')).toBeVisible();
        await expect(page.getByTestId('tutorial-catalog-entry-wheel-shared-cost')).toBeVisible();
        await expect(page.getByTestId('tutorial-catalog-entry-year-and-characters')).toBeVisible();
        await expect(page.getByTestId('tutorial-catalog-entry-korea-and-special-map-rules')).toBeVisible();
        await expect(page.getByTestId('tutorial-catalog-entry-retreat-and-rout')).toHaveCount(0);
        await expect(page.getByTestId('tutorial-catalog-entry-armament-upgrade')).toHaveCount(0);
        await expect(page.getByTestId('tutorial-catalog-entry-event-action')).toHaveCount(0);
        await expect(page.getByTestId('tutorial-catalog-entry-diplomacy-and-hire')).toHaveCount(0);
        await saveScreenshot(page, TUTORIAL_CATALOG_SCREENSHOT);

        await page.getByTestId('tutorial-catalog-entry-basic-opening').click();
        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
    });

    test('教程模式会带玩家走完一个最基本的真实回合片段，并在每步留下可指认操作点的截图', async ({ page }) => {
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveAttribute('data-tutorial-placement', 'right');
        await expect(page.locator('[data-testid="tutorial-highlight-ring"]')).toHaveCount(0);
        await expect(page.getByTestId('qidahen-action-wheel')).toHaveAttribute('data-wheel-emphasized', 'false');
        await expectTutorialOverlayNotToCover(
            page,
            page.getByTestId('qidahen-hand-zone'),
            'welcome tutorial card must not cover the hand zone',
        );
        await saveScreenshot(page, TUTORIAL_STEP_01);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="turn-flow"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('玩家行动流程是');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('顺序由玩家决定');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本教程');
        await expectTutorialOverlayFullyVisible(page, 'turn-flow');
        await saveScreenshot(page, TUTORIAL_STEP_01A);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="wheel-first"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌上限检查已自动完成');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('3 张手牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('15 张');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('不需要弃牌');
        const openingCore = await readQidahenCore(page);
        expect(openingCore.turnPhase).toBe('action-window');
        expect(openingCore.handLimitDiscardSelection).toBeNull();
        expect(openingCore.factions.ming.handCount).toBeLessThanOrEqual(openingCore.factions.ming.handLimit);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在进入轮盘行动');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-top-action-banner"]')).toHaveCount(0);
        await expectTutorialOverlayFullyVisible(page, 'wheel-first');
        await saveScreenshot(page, TUTORIAL_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('前进 1、2 或 3 格');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本教程');
        await saveScreenshot(page, TUTORIAL_STEP_02A);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“征兵训练”区域');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-top-action-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        for (const moveId of ['move-1-free', 'move-2-one-opponent', 'move-3-all-opponents']) {
            const target = page.locator(`[data-testid="qidahen-wheel-move-target-${moveId}"]`);
            await expect(target).toBeVisible();
            await expect(target).toHaveAttribute('aria-disabled', 'false');
        }
        await expectWheelPrimaryMove(page, 'move-1-free');
        await expectTutorialOverlayFullyVisible(page, 'wheel-move');
        await saveScreenshot(page, TUTORIAL_STEP_03);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图上的新增部队');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toHaveAttribute('data-qidahen-map-result-troop-delta', '2');
        await expect(page.locator('[data-testid="qidahen-map-result-troop-fade"]')).toHaveCount(2);
        await expect(page.locator('[data-testid="qidahen-map-result-troop-delta"]')).toHaveCount(0);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-map-result-feedback-safe-zone"]'),
            'wheel-result tutorial card must not cover map feedback safe zone',
        );
        await expectResultTroopSizeToMatchMapToken(page);
        await saveScreenshot(page, TUTORIAL_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="hand-action-order"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌行动每回合选 1 项');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('四个同层势力行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('没有固定先后');
        await expectTutorialOverlayFullyVisible(page, 'hand-action-order');
        await saveScreenshot(page, TUTORIAL_STEP_04A);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="grant-pardon-rule"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('赐印招安：弃 3 张手牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('由被指定的玩家选择一支与大明控制区相邻的部队');
        await saveScreenshot(page, TUTORIAL_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="pick-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选择赐印招安');
        await saveScreenshot(page, TUTORIAL_STEP_06);

        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选择 3 张手牌');
        await saveScreenshot(page, TUTORIAL_STEP_07);

        const handCards = page.locator('button[data-testid^="qidahen-hand-card-hand-"]');
        await expect(handCards.nth(0)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(1)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(2)).toBeVisible({ timeout: 15000 });
        await handCards.nth(0).click();
        await handCards.nth(1).click();
        await handCards.nth(2).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="choose-grant-pardon-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-grant-pardon-selection"]')).toBeVisible();
        const grantPardonMapTarget = page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-25"][data-grant-pardon-map-choice="jinzhou->city-region-25"]');
        await expect(grantPardonMapTarget).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击地图上高亮的山海关接收区');
        await expect(page.locator('[data-testid="qidahen-map-selection-banner"]')).toContainText('当前目标：山海关');
        await expect(page.locator('[data-testid="qidahen-map-guide-route-foreground-city-region-25"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-guide-line-city-region-25"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-guide-arrow-head-city-region-25"]')).toBeVisible();
        const sourceToken = page.locator('[data-testid^="qidahen-map-token-"][data-qidahen-map-token-region="jinzhou"][data-qidahen-map-token-faction="jin"]').first();
        const sourceFocus = page.locator('[data-testid="qidahen-map-guide-source-focus-city-region-25"]');
        const targetFocus = page.locator('[data-testid="qidahen-map-guide-target-focus-city-region-25"]');
        await expect(sourceToken).toBeVisible();
        await expect(sourceFocus).toBeVisible();
        await expect(targetFocus).toBeVisible();
        const sourceTokenBox = await sourceToken.boundingBox();
        const sourceFocusBox = await sourceFocus.boundingBox();
        const targetFocusBox = await targetFocus.boundingBox();
        if (!sourceTokenBox || !sourceFocusBox || !targetFocusBox) {
            throw new Error('grant pardon source/target visual anchors missing');
        }
        expect(sourceFocusBox.x).toBeLessThanOrEqual(sourceTokenBox.x + 2);
        expect(sourceFocusBox.y).toBeLessThanOrEqual(sourceTokenBox.y + 2);
        expect(sourceFocusBox.x + sourceFocusBox.width).toBeGreaterThanOrEqual(sourceTokenBox.x + sourceTokenBox.width - 2);
        expect(sourceFocusBox.y + sourceFocusBox.height).toBeGreaterThanOrEqual(sourceTokenBox.y + sourceTokenBox.height - 2);
        const relationLineBox = await page.locator('[data-testid="qidahen-map-guide-line-city-region-25"]').boundingBox();
        if (!relationLineBox) {
            throw new Error('grant pardon relation line bounding box missing');
        }
        expect(relationLineBox.x).toBeLessThanOrEqual(sourceTokenBox.x + sourceTokenBox.width);
        expect(relationLineBox.x + relationLineBox.width).toBeGreaterThanOrEqual(targetFocusBox.x);
        await expect(page.locator('[data-testid^="qidahen-map-guide-route-foreground-"]')).toHaveCount(1);
        await expect(page.locator('[data-testid="qidahen-map-region-mask-overlay"]')).toHaveAttribute('data-qidahen-tutorial-primary-target', 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-map-region-mask-overlay"]')).toHaveAttribute('data-qidahen-tutorial-source-region', 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-mask-overlay"]')).toHaveAttribute('data-qidahen-tutorial-candidate-count', /[2-9]/);
        await expect(page.locator('[data-testid="qidahen-grant-pardon-visual-relation"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-grant-pardon-source-label"]')).toContainText('锦州部队');
        await expect(page.locator('[data-testid="qidahen-grant-pardon-target-label"]')).toContainText('山海关接收区');
        await expect(page.locator('[data-testid="qidahen-map-guide-route-city-region-25"]')).toHaveAttribute('data-guide-source-x', /\d+/);
        await expect(page.locator('[data-testid="qidahen-map-guide-route-city-region-25"]')).toHaveAttribute('data-guide-target-x', /\d+/);
        await saveScreenshot(page, TUTORIAL_STEP_08);

        const grantPardonTargetBox = await grantPardonMapTarget.boundingBox();
        if (!grantPardonTargetBox) {
            throw new Error('grant pardon map target anchor missing');
        }
        await page.mouse.click(
            grantPardonTargetBox.x + grantPardonTargetBox.width / 2,
            grantPardonTargetBox.y + grantPardonTargetBox.height / 2,
        );
        await expect(page.locator('[data-tutorial-step="action-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('锦州部队已转为大明部队');
        await saveScreenshot(page, TUTORIAL_STEP_09);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('首回合这段行动已完成');
        await saveScreenshot(page, TUTORIAL_STEP_10);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-complete', diagnostics }]);
    });

    test('基础教程选择合法的 2 或 3 格时不进入征兵训练链，并自动恢复到轮盘选择', async ({ page }) => {
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
        await expect(page.locator('[data-tutorial-step="turn-flow"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="wheel-first"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="wheel-rule"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });

        await page.getByTestId('qidahen-wheel-move-target-move-3-all-opponents').click();
        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-tutorial-step="wheel-branch-recovery"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('本示范');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('当前路径');
        const wrongPathCore = await readQidahenCore(page);
        expect(wrongPathCore.wheelActionUsed).toBe(false);
        expect(wrongPathCore.turnPhase).toBe('action-window');
        await saveScreenshot(page, TUTORIAL_STEP_03A);
        await expect(page.getByTestId('qidahen-wheel-move-target-move-1-free')).toBeVisible();
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-wheel-path-recovery', diagnostics }]);
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
        });
        const touchPage = await touchContext.newPage();
        const diagnostics = attachPageDiagnostics(touchPage);

        try {
            await touchPage.goto(QIDAHEN_BASIC_TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
            await expect(touchPage.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
            await expect(touchPage.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });

            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="turn-flow"]')).toBeVisible({ timeout: 10000 });
            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="wheel-first"]')).toBeVisible({ timeout: 10000 });
            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="wheel-rule"]')).toBeVisible({ timeout: 10000 });
            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
            await touchPage.getByTestId('qidahen-wheel-move-target-move-1-free').click();
            await expect(touchPage.locator('[data-tutorial-step="wheel-result"]')).toBeVisible({ timeout: 10000 });
            await expect(touchPage.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图上的新增部队');
            await expect(touchPage.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="hand-action-order"]')).toBeVisible({ timeout: 10000 });
            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="grant-pardon-rule"]')).toBeVisible({ timeout: 10000 });
            await touchPage.locator('[data-testid="tutorial-next-button"]').click();
            await expect(touchPage.locator('[data-tutorial-step="pick-action"]')).toBeVisible({ timeout: 10000 });

            const touchHandCard = touchPage.locator('button[data-testid^="qidahen-hand-card-hand-"]').first();
            await expect(touchHandCard).toBeVisible({ timeout: 10000 });
            await expect(touchHandCard).toHaveAttribute('data-qidahen-hand-card-touch-inspect', 'long-press');
            await touchPage.screenshot({ path: resolve(MOBILE_HAND_INSPECT_BEFORE), fullPage: false });

            const beforeLongPress = await readQidahenCore(touchPage);
            expect(beforeLongPress.turnPhase).toBe('action-window');
            expect(beforeLongPress.factionActionUsed).toBe(false);

            await dispatchTouchLongPress(touchHandCard);
            await expect(touchPage.locator('[data-testid="qidahen-card-magnify-overlay"]')).toBeVisible({ timeout: 10000 });
            await expect(touchPage.locator('[data-testid="qidahen-card-magnify-content"]')).toBeVisible();
            await expect(touchPage.locator('[data-tutorial-step="pick-action"]')).toBeVisible();
            await expect(touchPage.locator('[data-testid="qidahen-action-payment-panel"]')).toHaveCount(0);
            const afterLongPress = await readQidahenCore(touchPage);
            expect(afterLongPress.turnPhase).toBe('action-window');
            expect(afterLongPress.factionActionUsed).toBe(false);
            await touchPage.screenshot({ path: resolve(MOBILE_HAND_INSPECT_OVERLAY), fullPage: false });

            await touchPage.getByTestId('qidahen-card-magnify-overlay-close').click();
            await expect(touchPage.locator('[data-testid="qidahen-card-magnify-overlay"]')).toBeHidden({ timeout: 10000 });
            await expect(touchPage.locator('[data-tutorial-step="pick-action"]')).toBeVisible();
            await expect(touchPage.locator('[data-testid="qidahen-hand-zone"]')).toBeVisible();
            await touchPage.screenshot({ path: resolve(MOBILE_HAND_INSPECT_AFTER_CLOSE), fullPage: false });
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

    test('轮盘代价教程会真实展示走3格后的两家对手抽牌结果，并进入进攻调度', async ({ page }) => {
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
        await saveScreenshot(page, WHEEL_COST_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="dispatch-ready"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('进攻目标');
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')).toHaveCount(0);
        const committedTroopToken = page.locator('[data-testid^="qidahen-map-token-"][data-pending-committed-selectable="true"]').first();
        await expect(committedTroopToken).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘落点进入进攻调度');
        await saveScreenshot(page, WHEEL_COST_STEP_02A);

        await committedTroopToken.click();
        await expect(committedTroopToken).toHaveAttribute('data-pending-committed-selected', 'true');
        const wheelDispatchTargetIds = await page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')
            .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid')));
        expect(wheelDispatchTargetIds).toEqual(expect.arrayContaining([
            'qidahen-map-guide-hit-target-jinzhou',
            'qidahen-map-guide-hit-target-city-region-20',
        ]));
        expect(wheelDispatchTargetIds).toHaveLength(2);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘落点进入进攻调度');
        await saveScreenshot(page, WHEEL_COST_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘结算已完成');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('下一入口是进攻调度');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page).toHaveURL(/\/\?game=qidahen(?:&|$)/, { timeout: 10000 });
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
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“开垦”区域');
        await saveScreenshot(page, WHEEL_RECLAIM_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('人口增加 1');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        const reclaimCore = await readQidahenCore(page) as {
            regions: Array<{ id: string; population: number }>;
        };
        expect(reclaimCore.regions.find((region) => region.id === 'city-region-24')?.population).toBe(7);
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
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“军屯”区域');
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

    test('轮盘征兵训练教程会真实展示加兵并按军备等级训练炮兵', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/wheel-recruit-train', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入轮盘征兵训练结算');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击轮盘上高亮的“征兵训练”区域');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图新增 2 个等级 2 正规军');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('轮盘征兵/训练');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).not.toContainText('+2');
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-result-feedback-canvas"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toHaveAttribute('data-qidahen-map-result-region', 'city-region-24');
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toHaveAttribute('data-qidahen-map-result-troop-delta', '2');
        await expect(page.locator('[data-testid="qidahen-map-result-troop-fade"]')).toHaveCount(2);
        await expect(page.locator('[data-testid="qidahen-map-result-troop-delta"]')).toHaveCount(0);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-map-result-feedback-safe-zone"]'),
            'recruit-train tutorial card must not cover map feedback safe zone',
        );
        await expectResultTroopSizeToMatchMapToken(page);
        const feedbackBox = await page.locator('[data-testid="qidahen-map-result-feedback"]').boundingBox();
        if (!feedbackBox) {
            throw new Error('征兵训练地图反馈特写缺少真实地图锚点');
        }
        await page.screenshot({
            path: WHEEL_RECRUIT_TRAIN_FEEDBACK_DETAIL,
            clip: {
                x: Math.max(0, feedbackBox.x - 180),
                y: Math.max(0, feedbackBox.y - 150),
                width: 360,
                height: 320,
            },
            fullPage: false,
        });
        await page.waitForTimeout(300);
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_STEP_02);
        await expect(page.locator('[data-testid="qidahen-armaments-ming"]')).toContainText('火炮技术2');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        const recruitTrainCore = await readQidahenCore(page) as {
            factions: {
                ming: { armaments: Array<{ id: string; level: number }> };
            };
            regions: Array<{ id: string; troops: number; specialTroops?: Array<{ troopKind: string; level: number }> }>;
        };
        expect(recruitTrainCore.regions.find((region) => region.id === 'city-region-24')?.troops).toBe(4);
        expect(
            recruitTrainCore.regions
                .find((region) => region.id === 'city-region-24')
                ?.specialTroops?.some((troop) => troop.troopKind === 'artillery' && troop.level >= 2),
            ).toBe(true);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('征兵训练已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
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
        await saveScreenshot(page, ARMAMENT_STEP_02);

        const discardCard = page.locator('button[data-testid^="qidahen-hand-card-hand-"]:not([data-tutorial-id="qidahen-atlas05-1626-artillery-tech"])').first();
        await expect(discardCard).toBeVisible();
        await discardCard.click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-armaments-ming"]')).toContainText('火炮技术2');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('火炮技术从 1 级升到 2 级');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await saveScreenshot(page, ARMAMENT_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('升级军备完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('事件行动教程会从真实手牌行动入口进入，并把大汗令箭结算成一次征兵训练', async ({ page }) => {
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
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('需弃 1');
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

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('蒙古兵力从 2 增至 4');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('5/10');
        await saveScreenshot(page, EVENT_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('大汗令箭已完成');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
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
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('需弃 1');
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
        await expect(page.locator('[data-testid="qidahen-action-payment-status"]')).toContainText('已选 1 张');
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
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
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
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
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-rout"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await saveScreenshot(page, ROUT_STEP_01);
        await page.locator('[data-testid="qidahen-resolve-pending-action-rout"]').click();

        await expect(page.locator('[data-tutorial-step="rout-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图出发区不再保留这支部队');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
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
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="defend-city"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('守城宣告');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('守城避战');
        await expect(page.locator('[data-tutorial-id="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-defender-hold-city"]')).toContainText('守城避战');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-defender-sortie"]')).toContainText('出城野战');
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
        await saveScreenshot(page, SIEGE_STEP_01A);
        await page.locator('[data-testid="qidahen-resolve-pending-action"]').click();

        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('已被突破');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存 1');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="besiege-choice"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选择「围城」');
        const besiegeModeButton = page.getByTestId('qidahen-post-battle-mode-besiege');
        await expect(besiegeModeButton).toContainText('围城');
        await expect(page.locator('[data-tutorial-id="qidahen-post-battle-choice-entry"]')).toHaveCount(1);
        await expectTutorialOverlayNotToCover(page, besiegeModeButton, 'siege tutorial overlay should not cover besiege mode entry');
        await besiegeModeButton.click();
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
        await expect(page.locator('[data-tutorial-id="qidahen-post-battle-choice-entry"]')).toHaveCount(1);
        await expectTutorialOverlayNotToCover(
            page,
            page.locator('[data-testid="qidahen-post-battle-choice-besiege"]'),
            'siege tutorial overlay should not cover besiege choice',
        );
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
        await expect(page.locator('[data-tutorial-step="occupy-choice"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城保留守方控制');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
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

        await expect(page.locator('[data-tutorial-step="besiege-choice"]')).toBeVisible({ timeout: 10000 });
        const occupyModeButton = page.getByTestId('qidahen-post-battle-mode-occupy');
        await expect(occupyModeButton).toContainText('占领');
        await occupyModeButton.click();
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');
        await selectPostBattleChoice(page, 'occupy');

        await expect(page.locator('[data-tutorial-step="occupy-choice"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('占领改为大明控制并清除城内守军');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('城战完成；围城或占领决定山海关的控制权和城市状态');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
        await saveScreenshot(page, SIEGE_STEP_03);
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
        await expect(page.locator('[data-testid="qidahen-map-result-feedback"]')).toBeVisible({ timeout: 10000 });
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
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]')).toBeVisible();
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
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击自动支付，进入新年维护');
        await saveScreenshot(page, KOREA_STEP_04);
        await page.locator('[data-testid="qidahen-fortification-maintenance-choice-auto-pay"]').click();

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
