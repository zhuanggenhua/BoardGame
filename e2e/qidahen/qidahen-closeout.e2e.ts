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
const FIELD_BATTLE_STEP_01 = `${TUTORIAL_DIR}/11-野战第1步-先看战场与目标.png`;
const FIELD_BATTLE_STEP_02 = `${TUTORIAL_DIR}/12-野战第2步-选择承伤顺序并结算.png`;
const FIELD_BATTLE_STEP_03 = `${TUTORIAL_DIR}/13-野战第3步-进入战后处理并占领.png`;
const SIEGE_STEP_01 = `${TUTORIAL_DIR}/14-攻城第1步-先看城战结果.png`;
const SIEGE_STEP_02 = `${TUTORIAL_DIR}/15-攻城第2步-选择围城该区.png`;
const DIPLOMACY_STEP_01 = `${TUTORIAL_DIR}/16-外交第1步-从轮盘进入外交雇佣.png`;
const DIPLOMACY_STEP_02 = `${TUTORIAL_DIR}/17-外交第2步-先放置友好标记.png`;
const DIPLOMACY_STEP_03 = `${TUTORIAL_DIR}/18-外交第3步-结束并结算雇佣军.png`;
const SEASON_STEP_01 = `${TUTORIAL_DIR}/19-季节第1步-推进到年中并查看摘要.png`;
const SEASON_STEP_02 = `${TUTORIAL_DIR}/20-季节第2步-进入新年防线维护.png`;
const SEASON_STEP_03 = `${TUTORIAL_DIR}/21-季节第3步-看到跨年后的新年结算.png`;
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('要靠扩地、攻下首都，或先拿到 3 个威望取胜');
        await saveScreenshot(page, TUTORIAL_STEP_01);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="opening-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先看右侧行动区');
        await saveScreenshot(page, TUTORIAL_STEP_02);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="hand-resource"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('底部手牌是主要资源');
        await saveScreenshot(page, TUTORIAL_STEP_03);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="select-region"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-action-hint"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先点地图上的皮岛');
        await saveScreenshot(page, TUTORIAL_STEP_04);

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-tutorial-step="pick-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在点“赐印招安”');
        await saveScreenshot(page, TUTORIAL_STEP_05);

        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('赐印招安要弃 3 张牌');
        await saveScreenshot(page, TUTORIAL_STEP_06);

        const handCards = page.locator('[data-testid^="qidahen-hand-card-"]');
        await expect(handCards.nth(0)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(1)).toBeVisible({ timeout: 15000 });
        await expect(handCards.nth(2)).toBeVisible({ timeout: 15000 });
        await handCards.nth(0).click();
        await handCards.nth(1).click();
        await handCards.nth(2).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="action-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('换成了地图上的控制力');
        await saveScreenshot(page, TUTORIAL_STEP_07);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="morale-level"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('顶部的数字就是部队等级，也代表士气');
        await saveScreenshot(page, TUTORIAL_STEP_08);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('轮盘行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('这回合还剩一次轮盘行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('免费走 1');
        await saveScreenshot(page, TUTORIAL_STEP_09);

        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('你已经走完一个基础回合');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('真正打起来时怎么算');
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

    test('野战教程会直接进入真实野战战后局面', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/field-battle', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="battle-overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('野战');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="battle-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        await saveScreenshot(page, FIELD_BATTLE_STEP_01);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="casualty-priority"]')).toBeVisible({ timeout: 10000 });
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
        await saveScreenshot(page, FIELD_BATTLE_STEP_03);
        await page.locator('[data-testid="qidahen-post-battle-choice-occupy"]').click();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
    });

    test('攻城教程会直接进入真实围城选择局面', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/siege-and-occupation', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="siege-overview"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="siege-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="siege-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('山海关已被突破');
        await saveScreenshot(page, SIEGE_STEP_01);
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交和雇佣');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await saveScreenshot(page, DIPLOMACY_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="choose-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('从 山海关 出发');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先处理一个相邻地区的控制标记');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="place-friendly"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]').click();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
        await saveScreenshot(page, DIPLOMACY_STEP_02);
        await page.locator('[data-testid="qidahen-diplomacy-choice-place-friendly"]').click();

        await expect(page.locator('[data-tutorial-step="hire-only"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 1');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('还可继续 2 次');
        await saveScreenshot(page, DIPLOMACY_STEP_03);
        await page.locator('[data-testid="qidahen-diplomacy-choice-hire-only"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 2 雇佣军');
    });

    test('年中新年教程会从年中摘要继续推进到新年维护，再看到跨年结果', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await page.addInitScript(() => {
            (window as HarnessWindow).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial/season-flow', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('季节结算');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-midyear"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择轮盘行动');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').click();

        await expect(page.locator('[data-tutorial-step="midyear-summary"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('年中结算');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('人物判定');
        await saveScreenshot(page, SEASON_STEP_01);
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
        await expect(page.locator('[data-tutorial-step="season-finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('新年结算');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('天命五年 1620');
        await saveScreenshot(page, SEASON_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });
});
