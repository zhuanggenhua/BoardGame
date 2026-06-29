import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    setChineseLocale,
} from '../helpers/common';

const CLOSEOUT_DIR = 'test-results/evidence-screenshots/_shared/qidahen-新游戏收口';
const TUTORIAL_DIR = 'test-results/evidence-screenshots/_shared/qidahen-教程完成';
const TUTORIAL_STEP_01 = `${TUTORIAL_DIR}/01-教程第1步-点下一步开始基础回合.png`;
const TUTORIAL_STEP_02 = `${TUTORIAL_DIR}/02-教程第2步-开局先看右侧行动区.png`;
const TUTORIAL_STEP_03 = `${TUTORIAL_DIR}/03-教程第3步-先看底部手牌资源.png`;
const TUTORIAL_STEP_04 = `${TUTORIAL_DIR}/04-教程第4步-点击地图上的皮岛.png`;
const TUTORIAL_STEP_05 = `${TUTORIAL_DIR}/05-教程第5步-点击右侧赐印招安.png`;
const TUTORIAL_STEP_06 = `${TUTORIAL_DIR}/06-教程第6步-点击底部手牌支付3张.png`;
const TUTORIAL_STEP_07 = `${TUTORIAL_DIR}/07-教程第7步-招安后看到控制权变化.png`;
const TUTORIAL_STEP_08 = `${TUTORIAL_DIR}/08-教程第8步-看地图上的等级与士气.png`;
const TUTORIAL_STEP_09 = `${TUTORIAL_DIR}/09-教程第9步-点击轮盘免费走1.png`;
const TUTORIAL_STEP_10 = `${TUTORIAL_DIR}/10-教程第10步-点击完成关闭教程.png`;
const WHEEL_COST_STEP_01 = `${TUTORIAL_DIR}/11-轮盘第1步-先看走3会让两家对手摸牌.png`;
const WHEEL_COST_STEP_02 = `${TUTORIAL_DIR}/12-轮盘第2步-看蒙古后金手牌同时增加.png`;
const WHEEL_COST_STEP_03 = `${TUTORIAL_DIR}/13-轮盘第3步-进入进攻调度入口.png`;
const ARMAMENT_STEP_01 = `${TUTORIAL_DIR}/14-军备第1步-先点升级军备.png`;
const ARMAMENT_STEP_02 = `${TUTORIAL_DIR}/15-军备第2步-点击底部手牌支付2张.png`;
const ARMAMENT_STEP_03 = `${TUTORIAL_DIR}/16-军备第3步-看火炮技术升到2级.png`;
const FIELD_BATTLE_STEP_01 = `${TUTORIAL_DIR}/17-进攻第1步-先看可攻目标.png`;
const FIELD_BATTLE_STEP_02 = `${TUTORIAL_DIR}/18-进攻第2步-进入战斗并决定承伤顺序.png`;
const FIELD_BATTLE_STEP_03 = `${TUTORIAL_DIR}/19-进攻第3步-看战败标记与战后选择.png`;
const ROUT_STEP_01 = `${TUTORIAL_DIR}/20-撤退第1步-先看断后和溃退入口.png`;
const ROUT_STEP_02 = `${TUTORIAL_DIR}/21-撤退第2步-看溃退后的残部清空与战败标记.png`;
const SIEGE_STEP_01 = `${TUTORIAL_DIR}/22-攻城第1步-先看城战待结算入口.png`;
const SIEGE_STEP_02 = `${TUTORIAL_DIR}/23-攻城第2步-选择围城该区.png`;
const DIPLOMACY_STEP_01 = `${TUTORIAL_DIR}/24-外交第1步-从轮盘进入外交雇佣.png`;
const DIPLOMACY_STEP_02 = `${TUTORIAL_DIR}/25-外交第2步-先放置友好标记.png`;
const DIPLOMACY_STEP_03 = `${TUTORIAL_DIR}/26-外交第3步-结束并结算雇佣军.png`;
const DIPLOMACY_STEP_04 = `${TUTORIAL_DIR}/27-外交第4步-看完外交与雇佣的合并收益.png`;
const SEASON_STEP_01 = `${TUTORIAL_DIR}/28-跨年第1步-推进到年中并查看税赋与人物.png`;
const SEASON_STEP_02 = `${TUTORIAL_DIR}/29-跨年第2步-进入新年防线维护.png`;
const SEASON_STEP_03 = `${TUTORIAL_DIR}/30-跨年第3步-看纪年卡与争分结果.png`;
const SEASON_STEP_04 = `${TUTORIAL_DIR}/31-跨年第4步-看新顺位与人物刷新.png`;
const SEASON_STEP_05 = `${TUTORIAL_DIR}/32-跨年第5步-看到新年结算与新年份.png`;
const KOREA_STEP_01 = `${TUTORIAL_DIR}/33-朝鲜第1步-先看朝鲜牌库与弃牌堆.png`;
const KOREA_STEP_02 = `${TUTORIAL_DIR}/34-朝鲜第2步-看汉城威望已进入玩家条.png`;
const KOREA_STEP_03 = `${TUTORIAL_DIR}/35-朝鲜第3步-看海路与船锚区域关系.png`;
const KOREA_STEP_04 = `${TUTORIAL_DIR}/36-朝鲜第4步-看山海关特殊边界.png`;
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

const saveScreenshot = async (page: Page, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false, animations: 'disabled' });
};

const MAP_REGION_POINTS = {
    songjin: { x: 0.6522, y: 0.5913 },
} as const;

const clickMapRegion = async (
    page: Page,
    regionId: keyof typeof MAP_REGION_POINTS,
) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((element, targetPoint) => {
        const rect = element.getBoundingClientRect();
        const init: PointerEventInit = {
            clientX: rect.left + rect.width * targetPoint.x,
            clientY: rect.top + rect.height * targetPoint.y,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        element.dispatchEvent(new PointerEvent('pointermove', init));
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('pointerup', {
            ...init,
            buttons: 0,
        }));
    }, point);
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

test.describe('七大恨新游戏收口', () => {
    test('教程模式会带玩家走完一个最基本的真实回合片段，并在每步留下可指认操作点的截图', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="welcome"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('七大恨有三种赢法');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('控制 16 个区域');
        await saveScreenshot(page, TUTORIAL_STEP_01);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="hand-limit"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('每回合开始先检查手牌上限');
        await saveScreenshot(page, TUTORIAL_STEP_02);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="opening-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('一次手牌行动、一次轮盘行动');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="hand-resource"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌就是资源');
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]')).toHaveCount(4);
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]').nth(0)).toContainText(/事件|军备|战术|银两/);
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]').nth(1)).toContainText(/事件|军备|战术|银两/);
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]').nth(2)).toContainText(/事件|军备|战术|银两/);
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]').nth(3)).toContainText(/事件|军备|战术|银两/);
        await saveScreenshot(page, TUTORIAL_STEP_03);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="select-region"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-action-hint"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('这次要先定地区');
        await saveScreenshot(page, TUTORIAL_STEP_04);

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-tutorial-step="pick-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选赐印招安');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('改成大明控制');
        await saveScreenshot(page, TUTORIAL_STEP_05);

        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先弃 3 张牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('再执行赐印招安');
        await saveScreenshot(page, TUTORIAL_STEP_06);

        const handCards = page.locator('[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-kind-"])');
        await expect(handCards.nth(0)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(1)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(2)).toBeVisible({ timeout: 15000 });
        await handCards.nth(0).click();
        await handCards.nth(1).click();
        await handCards.nth(2).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="action-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('换成了版图上的控制力');
        await saveScreenshot(page, TUTORIAL_STEP_07);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="morale-level"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('木块上的数字既是等级，也是士气');
        await saveScreenshot(page, TUTORIAL_STEP_08);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('轮盘行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌行动完了');
        await saveScreenshot(page, TUTORIAL_STEP_09);

        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('这一回合结束');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌换来地图变化');
        await saveScreenshot(page, TUTORIAL_STEP_10);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0);
        assertNoFatalFrontendErrors([{ label: 'qidahen-tutorial-complete', diagnostics }]);
    });

    test('注入终局状态后会真实显示终局遮罩', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘不是白走');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('6/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');
        await saveScreenshot(page, WHEEL_COST_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();

        await expect(page.locator('[data-tutorial-step="draw-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('8/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('12/10');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('各补了 2 张手牌');
        await saveScreenshot(page, WHEEL_COST_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="dispatch-ready"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('宁远');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('可攻');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进攻调度入口');
        await saveScreenshot(page, WHEEL_COST_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('决定对手拿回多少手牌');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('军备不是常驻被动词条');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-upgrade-armament"]')).toContainText('升级军备');
        await saveScreenshot(page, ARMAMENT_STEP_01);
        await page.locator('[data-testid="qidahen-action-upgrade-armament"]').click();

        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('需弃 2');
        await saveScreenshot(page, ARMAMENT_STEP_02);

        const handCards = page.locator('[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-kind-"])');
        await handCards.nth(0).click();
        await handCards.nth(1).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-armaments-ming"]')).toContainText('火炮技术2');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await saveScreenshot(page, ARMAMENT_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('后面战斗会继续吃到的军备等级');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('进攻与野战教程会从真实进攻调度入口进入，再进入战斗与战后处理', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/attack-and-battle', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进攻先走到位');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="move-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('可攻目标');
        await saveScreenshot(page, FIELD_BATTLE_STEP_01);
        await page.getByRole('button', { name: '选择目标：察哈尔' }).click();

        await expect(page.locator('[data-tutorial-step="battle-open"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="battle-damage"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('攻方承伤');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('低级先损');
        await saveScreenshot(page, FIELD_BATTLE_STEP_02);
        await resolvePendingActionByCommand(page, {
            retreatLossMode: 'rear-guard',
            attackerCasualtyPriority: 'lowest-level',
            defenderCasualtyPriority: 'highest-level',
            committedTroops: 5,
        });

        await expect(page.locator('[data-tutorial-step="battle-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="retreat-and-defeat"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('败×1');
        await saveScreenshot(page, FIELD_BATTLE_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="battle-finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('再做战后处理');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await page.locator('[data-testid="qidahen-post-battle-choice-occupy"]').click();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('断后和溃退');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-rout"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await saveScreenshot(page, ROUT_STEP_01);
        await page.locator('[data-testid="qidahen-resolve-pending-action-rout"]').click();

        await expect(page.locator('[data-tutorial-step="rout-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('撤退溃败损失');
        await saveScreenshot(page, ROUT_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('攻城教程会从真实城战待结算入口进入，再进入围城选择', async ({ page }) => {
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
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('城战待结算');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="city-battle"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('本次出兵 4');
        await expect(page.locator('[data-testid="qidahen-pending-committed-1"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-pending-committed-2"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-pending-committed-3"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-pending-committed-4"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await saveScreenshot(page, SIEGE_STEP_01);
        await resolvePendingActionByCommand(page, {
            attackerCasualtyPriority: 'highest-level',
            defenderCasualtyPriority: 'highest-level',
            committedTroops: 4,
        });

        await expect(page.locator('[data-tutorial-step="city-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('已被突破');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('幸存 1');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="besiege-choice"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
        await saveScreenshot(page, SIEGE_STEP_02);
        await page.locator('[data-testid="qidahen-post-battle-choice-besiege"]').click();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('围城');
    });

    test('外交雇佣教程会从真实轮盘入口进入，并完成一次友好标记与雇佣结算', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/diplomacy-and-hire', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交改地区关系');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('雇佣改新兵落点');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await saveScreenshot(page, DIPLOMACY_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="choose-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('从 山海关 出发');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('从哪块己方地区向外施加影响');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="friendly-mark"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]').click();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
        await saveScreenshot(page, DIPLOMACY_STEP_02);
        await page.locator('[data-testid="qidahen-diplomacy-choice-place-friendly"]').click();

        await expect(page.locator('[data-tutorial-step="tribute-mark"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="remove-mark"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="hire-only"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 1');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('还可继续 2 次');
        await saveScreenshot(page, DIPLOMACY_STEP_03);
        await page.locator('[data-testid="qidahen-diplomacy-choice-hire-only"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 2 雇佣军');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地区关系变了');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('整年的后果会一起结算');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-midyear"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').click();

        await expect(page.locator('[data-tutorial-step="midyear-tax"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('年中结算');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('税赋');
        await saveScreenshot(page, SEASON_STEP_01);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="midyear-characters"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('战败压力');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-new-year"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="new-year-maintenance"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        await saveScreenshot(page, SEASON_STEP_02);
        await page.evaluate(async () => {
            const harness = (window as HarnessWindow).__BG_TEST_HARNESS__;
            if (!harness?.command?.dispatch) {
                throw new Error('qidahen test harness command dispatcher unavailable');
            }
            await harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '2',
                payload: {
                    optionId: 'auto-pay',
                    mergedValue: { attritionPriority: 'lowest-level' },
                },
            });
        });
        await expect(page.locator('[data-tutorial-step="new-year-attrition"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="chronology-score"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-chronology-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('领先者要付牌');
        await saveScreenshot(page, SEASON_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="turn-order-refresh"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('天命五年 1620');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('顺位和人物一起刷新');
        await saveScreenshot(page, SEASON_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('新年结算');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('天命五年 1620');
        await saveScreenshot(page, SEASON_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });

    test('朝鲜与地图特例教程会真实展示朝鲜牌库、汉城威望、水路限制与山海关特殊边界', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/korea-and-special-map-rules', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝鲜、汉城、水路和山海关');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="korea-region"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜牌库');
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toContainText('朝鲜弃牌');
        await expect(page.locator('[data-testid="qidahen-korea-draw-pile"]')).toContainText('9');
        await expect(page.locator('[data-testid="qidahen-korea-discard-pile"]')).toContainText('3');
        await saveScreenshot(page, KOREA_STEP_01);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="hanseong-vp"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('谁控汉城');
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toContainText('汉城+1');
        await saveScreenshot(page, KOREA_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="water-limit"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('两块船锚之间一次最多运 2 个部队');
        await saveScreenshot(page, KOREA_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="shanhaiguan"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('边界狭窄');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('塌成平原');
        await saveScreenshot(page, KOREA_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('直接改掉得分、移动和防线');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });
});
