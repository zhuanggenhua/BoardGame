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
const TUTORIAL_CATALOG_SCREENSHOT = `${TUTORIAL_DIR}/00-教程目录-先选择章节.png`;
const TUTORIAL_STEP_01 = `${TUTORIAL_DIR}/01-教程第1步-点下一步开始基础回合.png`;
const TUTORIAL_STEP_02 = `${TUTORIAL_DIR}/02-教程第2步-先看手牌上限.png`;
const TUTORIAL_STEP_03 = `${TUTORIAL_DIR}/03-教程第3步-先看公共轮盘会影响谁抽牌.png`;
const TUTORIAL_STEP_04 = `${TUTORIAL_DIR}/04-教程第4步-点击轮盘免费走1.png`;
const TUTORIAL_STEP_05 = `${TUTORIAL_DIR}/05-教程第5步-看轮盘后本回合还有手牌行动和轮盘落点行动.png`;
const TUTORIAL_STEP_06 = `${TUTORIAL_DIR}/06-教程第6步-先看底部手牌资源.png`;
const TUTORIAL_STEP_07 = `${TUTORIAL_DIR}/07-教程第7步-点击赐印招安进入支付.png`;
const TUTORIAL_STEP_08 = `${TUTORIAL_DIR}/08-教程第8步-弃3张手牌支付赐印招安.png`;
const TUTORIAL_STEP_09 = `${TUTORIAL_DIR}/09-教程第9步-支付后地图高亮选择招安目标.png`;
const TUTORIAL_STEP_10 = `${TUTORIAL_DIR}/10-教程第10步-招安后看到控制权变化.png`;
const TUTORIAL_STEP_11 = `${TUTORIAL_DIR}/11-教程第11步-看地图上的等级与士气.png`;
const TUTORIAL_STEP_12 = `${TUTORIAL_DIR}/12-教程第12步-看当前轮盘会把你推进到哪类行动.png`;
const TUTORIAL_STEP_13 = `${TUTORIAL_DIR}/12a-教程第13步-完成基础回合骨架收口.png`;
const WHEEL_COST_STEP_01 = `${TUTORIAL_DIR}/13-轮盘第1步-先看走3会让两家对手摸牌.png`;
const WHEEL_COST_STEP_02 = `${TUTORIAL_DIR}/14-轮盘第2步-看蒙古后金手牌同时增加.png`;
const WHEEL_COST_STEP_02A = `${TUTORIAL_DIR}/14a-轮盘第2a步-先选择参与进攻的部队.png`;
const WHEEL_COST_STEP_03 = `${TUTORIAL_DIR}/15-轮盘第3步-进入进攻调度落点.png`;
const WHEEL_COST_STEP_04 = `${TUTORIAL_DIR}/15g-轮盘第7步-主章节续到开垦教程.png`;
const WHEEL_RECLAIM_STEP_01 = `${TUTORIAL_DIR}/15a-开垦第1步-先把轮盘推进到开垦.png`;
const WHEEL_RECLAIM_STEP_02 = `${TUTORIAL_DIR}/15b-开垦第2步-看己方控制区人口增加.png`;
const WHEEL_MILITARY_FARM_STEP_01 = `${TUTORIAL_DIR}/15c-军屯第1步-先把轮盘推进到军屯.png`;
const WHEEL_MILITARY_FARM_STEP_02 = `${TUTORIAL_DIR}/15d-军屯第2步-看补牌并建立正规军.png`;
const WHEEL_RECRUIT_TRAIN_STEP_01 = `${TUTORIAL_DIR}/15e-征兵训练第1步-先把轮盘推进到征兵训练.png`;
const WHEEL_RECRUIT_TRAIN_STEP_02 = `${TUTORIAL_DIR}/15f-征兵训练第2步-看加兵并训练炮兵.png`;
const ARMAMENT_STEP_01 = `${TUTORIAL_DIR}/16-军备第1步-先点升级军备.png`;
const ARMAMENT_STEP_02 = `${TUTORIAL_DIR}/17-军备第2步-点击底部手牌支付2张.png`;
const ARMAMENT_STEP_03 = `${TUTORIAL_DIR}/18-军备第3步-看火炮技术升到2级.png`;
const EVENT_STEP_01 = `${TUTORIAL_DIR}/19-事件第1步-先点大汗令箭.png`;
const EVENT_STEP_02 = `${TUTORIAL_DIR}/20-事件第2步-点击底部手牌支付1张.png`;
const EVENT_STEP_03 = `${TUTORIAL_DIR}/21-事件第3步-选择征兵训练效果.png`;
const EVENT_STEP_04 = `${TUTORIAL_DIR}/22-事件第4步-看蒙古兵力增加到4.png`;
const FIELD_BATTLE_STEP_01 = `${TUTORIAL_DIR}/23-进攻第1步-点击突袭作战入口.png`;
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
const DIPLOMACY_STEP_01 = `${TUTORIAL_DIR}/32-外交第1步-从轮盘进入外交雇佣.png`;
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
    await page.getByTestId(`qidahen-post-battle-mode-${mode}`).click();
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

test.describe('七大恨新游戏收口', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(() => {
        resetScreenshotDir(TUTORIAL_DIR);
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('七大恨有三种赢法');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('控制 16 个区域');
        await saveScreenshot(page, TUTORIAL_STEP_01);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="hand-limit"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('每回合开始先检查手牌上限');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('检查手牌上限');
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toBeVisible({ timeout: 10000 });
        await expectTutorialOverlayFullyVisible(page, 'hand-limit');
        await saveScreenshot(page, TUTORIAL_STEP_02);
        const handLimitCards = page.locator('button[data-testid^="qidahen-hand-card-hand-"]');
        await expect(handLimitCards.nth(0)).toBeVisible({ timeout: 15000 });
        await handLimitCards.nth(0).click();
        await expect(page.locator('[data-testid="qidahen-resolve-hand-limit-discard"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-resolve-hand-limit-discard"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-first"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在轮到公共轮盘');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘还没推进');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('轮盘推进');
        await expect(page.locator('[data-testid="qidahen-top-action-banner"]')).toHaveCount(0);
        await expectTutorialOverlayFullyVisible(page, 'wheel-first');
        await saveScreenshot(page, TUTORIAL_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('现在选择公共轮盘推进几格');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('轮盘推进');
        await expect(page.locator('[data-testid="qidahen-top-action-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择推进几格');
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expectTutorialOverlayFullyVisible(page, 'wheel-move');
        await saveScreenshot(page, TUTORIAL_STEP_04);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="after-wheel"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('一次手牌行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('一次轮盘落点行动');
        await saveScreenshot(page, TUTORIAL_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="hand-resource"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌就是主要资源');
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]')).toHaveCount(3);
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]').nth(0)).toContainText(/事件|军备|战术|银两/);
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]').nth(1)).toContainText(/事件|军备|战术|银两/);
        await expect(page.locator('[data-testid^="qidahen-hand-card-kind-"]').nth(2)).toContainText(/事件|军备|战术|银两/);
        await expect(page.locator('[data-testid="qidahen-hand-zone"]')).not.toContainText(/人物牌|纪年卡|朝鲜牌/);
        await expect(page.locator('[data-testid="qidahen-hand-zone"] [data-card-atlas-id="qidahen:atlas05-ordinary-hand-preview"]')).toHaveCount(3);
        await saveScreenshot(page, TUTORIAL_STEP_06);

        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="pick-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌行动：赐印招安');
        await saveScreenshot(page, TUTORIAL_STEP_07);

        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先弃 3 张手牌支付赐印招安');
        await saveScreenshot(page, TUTORIAL_STEP_08);

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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('费用已经付完');
        await saveScreenshot(page, TUTORIAL_STEP_09);

        const grantPardonTargetBox = await grantPardonMapTarget.boundingBox();
        if (!grantPardonTargetBox) {
            throw new Error('grant pardon map target anchor missing');
        }
        await page.mouse.click(
            grantPardonTargetBox.x + grantPardonTargetBox.width / 2,
            grantPardonTargetBox.y + grantPardonTargetBox.height / 2,
        );
        await expect(page.locator('[data-tutorial-step="action-result"]')).toBeVisible({ timeout: 10000 });
        await saveScreenshot(page, TUTORIAL_STEP_10);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="morale-level"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('木块顶部的数字既是部队等级，也是士气');
        await saveScreenshot(page, TUTORIAL_STEP_11);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘落点行动已经完成');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('开垦军屯、外交雇佣、进攻调度或征兵训练');
        await saveScreenshot(page, TUTORIAL_STEP_12);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('首回合骨架就是');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('检查手牌上限');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('推进公共轮盘');
        await saveScreenshot(page, TUTORIAL_STEP_13);

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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘不是白走');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('选择推进几格');
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-wheel-current-marker"]')).toHaveAttribute(
            'data-wheel-current-position',
            'wheel-military-farm',
        );
        await expect(page.locator('[data-testid="qidahen-wheel-sector"][data-wheel-candidate="true"]')).toHaveCount(1);
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('各补了 2 张手牌');
        await saveScreenshot(page, WHEEL_COST_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="dispatch-ready"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('进攻目标');
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')).toHaveCount(0);
        const committedTroopToken = page.locator('[data-testid^="qidahen-map-token-"][data-pending-committed-selectable="true"]').first();
        await expect(committedTroopToken).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘落点是进攻调度');
        await saveScreenshot(page, WHEEL_COST_STEP_02A);

        await committedTroopToken.click();
        await expect(committedTroopToken).toHaveAttribute('data-pending-committed-selected', 'true');
        await expect(page.locator('[data-testid^="qidahen-map-guide-hit-target-"][data-action="wheel-dispatch"]')).toHaveCount(3);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('轮盘落点是进攻调度');
        await saveScreenshot(page, WHEEL_COST_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('进入哪一种落点行动');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('推进补回手牌');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page).toHaveURL(/\/play\/qidahen\/tutorial\/wheel-reclaim$/, { timeout: 10000 });
        await expect(page.locator('[data-tutorial-step="overview"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('开垦不是回合外奖励');
        await saveScreenshot(page, WHEEL_COST_STEP_04);
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('开垦不是回合外奖励');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('推进到开垦');
        await saveScreenshot(page, WHEEL_RECLAIM_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('加 1 人口');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        const reclaimCore = await readQidahenCore(page) as {
            regions: Array<{ id: string; population: number }>;
        };
        expect(reclaimCore.regions.find((region) => region.id === 'city-region-24')?.population).toBe(7);
        await saveScreenshot(page, WHEEL_RECLAIM_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('税赋和补给底子');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('军屯和开垦不同');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('推进到军屯');
        await saveScreenshot(page, WHEEL_MILITARY_FARM_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('抽 2 张牌');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('建立 1 个等级 2 正规军');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('手牌变多');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('正规军也跟着上来');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('会吃到你已经研发好的军备等级');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-move"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('推进到征兵训练');
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('建立 2 个等级 2 正规军');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('炮兵也会一起被训练');
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
        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('军备、兵力和当前战线');
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
        const artilleryTechCard = page.locator('[data-tutorial-id="qidahen-atlas05-1626-artillery-tech"]').first();
        await expect(artilleryTechCard).toBeVisible();
        await saveScreenshot(page, ARMAMENT_STEP_01);
        await artilleryTechCard.click();

        await expect(page.locator('[data-tutorial-step="pay-cards"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-action-payment-panel"]')).toContainText('需弃 2');
        await saveScreenshot(page, ARMAMENT_STEP_02);

        const handCards = page.locator('button[data-testid^="qidahen-hand-card-hand-"]');
        await handCards.nth(0).click();
        await handCards.nth(1).click();
        await expect(page.locator('[data-testid="qidahen-action-payment-confirm"]')).toBeEnabled();
        await page.locator('[data-testid="qidahen-action-payment-confirm"]').click();

        await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-armaments-ming"]')).toContainText('火炮技术2');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('火炮技术从 1 级升到了 2 级');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await saveScreenshot(page, ARMAMENT_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('后面战斗会继续吃到的军备等级');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('蒙古的势力行动也要靠手牌支付');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-tutorial-id="qidahen-action-khan-edict"]')).toBeVisible();
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('蒙古兵力从 2 提到 4');
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).not.toContainText('选择轮盘行动');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('5/10');
        await saveScreenshot(page, EVENT_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('先弃牌发动');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('大明的正常行动窗口');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('突袭作战');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-action"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击「突袭作战」');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('弃 1 张');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('突袭作战已经把战场带到察哈尔');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('双方公开出来的部队');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="tactic-window"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击「骑兵冲锋」选中');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('再点“打出战术牌”确认');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('点击右侧战斗面板里的「断后」');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('战败标记');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('败×1');
        await saveScreenshot(page, FIELD_BATTLE_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="battle-finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('选择突袭作战');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('弃牌支付');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('处理胜负和撤退');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await selectPostBattleChoice(page, 'occupy');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('断后和溃退');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="choose-rout"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toContainText('断后');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃退');
        await saveScreenshot(page, ROUT_STEP_01);
        await page.locator('[data-testid="qidahen-resolve-pending-action-rout"]').click();

        await expect(page.locator('[data-tutorial-step="rout-result"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('源区残部清空');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('围城该区');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
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
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('最后选择围城还是占领');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('战后围城');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('山海关');
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
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');
        await selectPostBattleChoice(page, 'occupy');

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('最后选择围城还是占领');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('战后占领');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('山海关');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交决定的是地区关系');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('雇佣决定的是新兵力能落到哪里');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="wheel-entry"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]')).toBeVisible();
        await saveScreenshot(page, DIPLOMACY_STEP_01);
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-tutorial-step="choose-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('外交目标');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('邻近 山海关');
        await expect(page.locator('[data-testid^="qidahen-diplomacy-target-"]')).toHaveCount(4);
        await expect(page.locator('[data-testid="qidahen-map-guide-hit-target-city-region-24"][data-action="select-region"]')).toBeVisible();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('外交目标是地图地区');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('只能点邻近己方控制区的目标');
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
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 1：宁远 已放置 大明友好标记');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 2：宁远 已翻为 大明附庸');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 3：东江 的控制标记已移除');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('雇佣军');
        await saveScreenshot(page, DIPLOMACY_STEP_03);
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('地图关系变了');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('兵力结构也变了');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('公共轮盘走到年中和新年时');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('整年的后果会一起追上来');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="advance-midyear"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-wheel-next-step-banner"]')).toContainText('公共轮盘推进');
        await expect(page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]')).toBeVisible();
        await clickWheelMoveUntilTutorialStep(page, 'move-2-one-opponent', 'midyear-tax');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('税赋');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('年中结算');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('新年朝鲜朝贡');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('分数最高的人要付出一半手牌');
        await saveScreenshot(page, SEASON_STEP_04);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="turn-order-refresh"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('天命五年 1620');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('新顺位和新人物会一起刷新');
        await saveScreenshot(page, SEASON_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('天命五年 1620');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('新年结算');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝鲜、汉城、水路、山海关都不是边角料');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="korea-region"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('新年朝鲜朝贡');
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
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('谁控制汉城');
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toContainText('汉城+1');
        await saveScreenshot(page, KOREA_STEP_02);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="water-limit"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('船锚区域之间的水路');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('一次最多只能运 2 个部队');
        await saveScreenshot(page, KOREA_STEP_03);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="new-year-maintenance"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('新年维护结算后，朝鲜上的部队也会一起进入耗损结算。');
        await saveScreenshot(page, KOREA_STEP_04);
        await page.locator('[data-testid="qidahen-fortification-maintenance-choice-auto-pay"]').click();

        await expect(page.locator('[data-tutorial-step="korea-attrition"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('朝鲜耗损');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('朝鲜耗损');
        const koreaAttritionCore = await readQidahenCore(page);
        const koreaAttritionSummaryText = ((koreaAttritionCore.lastSeasonSummary as { lines?: string[] } | null)?.lines ?? []).join(' ');
        expect(koreaAttritionSummaryText).toContain('朝鲜耗损');
        expect(koreaAttritionSummaryText).toContain('非朝鲜区域');
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="shanhaiguan"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('边界就窄');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('塌成平原');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('山海关');
        await saveScreenshot(page, KOREA_STEP_05);
        await page.locator('[data-testid="tutorial-next-button"]').click();

        await expect(page.locator('[data-tutorial-step="finish"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('直接改掉你能不能守住');
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toContainText('正式规则');
        await page.locator('[data-testid="tutorial-next-button"]').click();
        await expect(page.locator('[data-testid="tutorial-overlay-card"]')).toHaveCount(0, { timeout: 10000 });
    });
});
