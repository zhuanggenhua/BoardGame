import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    disableTutorial,
    setChineseLocale,
} from './helpers/common';

const BOARD_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-board-desktop-current.png';
const MOBILE_LANDSCAPE_SCREENSHOT = 'test-results/evidence-screenshots/_shared/qidahen-board-mobile-landscape-current.png';
const ACTION_FLOW_SCREENSHOT = 'temp/qidahen-board-action-flow-current.png';
const SEASON_FLOW_SCREENSHOT = 'temp/qidahen-board-season-flow-current.png';
const MIDYEAR_DEFEAT_MARKERS_SCREENSHOT = 'temp/qidahen-board-midyear-defeat-markers-current.png';
const FORTIFICATION_MAINTENANCE_SCREENSHOT = 'temp/qidahen-board-fortification-maintenance-current.png';
const MOVEMENT_PREVIEW_SCREENSHOT = 'temp/qidahen-board-movement-preview-current.png';
const WHEEL_DISPATCH_SELECTION_SCREENSHOT = 'temp/qidahen-board-wheel-dispatch-selection-current.png';
const WHEEL_DISPATCH_SCREENSHOT = 'temp/qidahen-board-wheel-dispatch-current.png';
const WHEEL_DISPATCH_SIEGE_REINFORCE_SCREENSHOT = 'temp/qidahen-board-wheel-dispatch-siege-reinforce-current.png';
const POST_BATTLE_SCREENSHOT = 'temp/qidahen-board-post-battle-current.png';
const POST_BATTLE_BESIEGE_SCREENSHOT = 'temp/qidahen-board-post-battle-besiege-current.png';
const DEFEAT_MARKER_SCREENSHOT = 'temp/qidahen-board-defeat-marker-current.png';
const POST_BATTLE_PLUNDER_SCREENSHOT = 'temp/qidahen-board-post-battle-plunder-current.png';
const LOW_CASUALTY_SCREENSHOT = 'temp/qidahen-board-low-casualty-current.png';
const COMMITTED_TROOPS_SCREENSHOT = 'temp/qidahen-board-committed-troops-current.png';
const BATTLE_RESOLUTION_SCREENSHOT = 'temp/qidahen-board-battle-resolution-current.png';
const CAVALRY_PLUNDER_SCREENSHOT = 'temp/qidahen-board-cavalry-plunder-current.png';
const CAVALRY_EVASION_SCREENSHOT = 'temp/qidahen-board-cavalry-evasion-current.png';
const FACTION_DECK_SCREENSHOT = 'temp/qidahen-board-faction-decks-current.png';
const FACTION_HAND_SCREENSHOT = 'temp/qidahen-board-faction-hand-current.png';
const HAND_LIMIT_DISCARD_SCREENSHOT = 'temp/qidahen-board-hand-limit-discard-current.png';
const WHEEL_RECRUIT_TRAIN_SCREENSHOT = 'temp/qidahen-board-wheel-recruit-train-current.png';
const WHEEL_HIRE_SCREENSHOT = 'temp/qidahen-board-wheel-hire-current.png';
const DIPLOMACY_THREE_TARGET_SCREENSHOT = 'temp/qidahen-board-diplomacy-three-target-current.png';
const RECRUIT_SCREENSHOT = 'temp/qidahen-board-recruit-current.png';
const RECRUIT_CHUANBING_SCREENSHOT = 'temp/qidahen-board-recruit-chuanbing-current.png';
const MA_SHI_TRADE_SCREENSHOT = 'temp/qidahen-board-ma-shi-trade-current.png';
const DRIVE_TIGER_SCREENSHOT = 'temp/qidahen-board-drive-tiger-dispatch-current.png';
const KHAN_EDICT_SCREENSHOT = 'temp/qidahen-board-khan-edict-current.png';
const KHAN_EDICT_HIRE_SCREENSHOT = 'temp/qidahen-board-khan-edict-hire-current.png';
const MARRIAGE_SUBJUGATION_SCREENSHOT = 'temp/qidahen-board-marriage-subjugation-current.png';
const MAP_REGION_POINTS = {
    jinzhou: { x: 0.4957, y: 0.5342 },
    dongjiang: { x: 0.6859, y: 0.7815 },
    liaoxi: { x: 0.5613, y: 0.4367 },
    ningyuan: { x: 0.3123, y: 0.6137 },
    songjin: { x: 0.6522, y: 0.5913 },
    shanhaiguan: { x: 0.4292, y: 0.6181 },
    region15: { x: 0.7051, y: 0.4278 },
} as const;

const saveScreenshot = async (page: import('@playwright/test').Page, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
};

const waitForAtlasFrames = async (page: import('@playwright/test').Page, selector: string) => {
    await page.waitForFunction((frameSelector) => {
        const frames = Array.from(document.querySelectorAll<HTMLElement>(frameSelector));
        return frames.length > 0 && frames.every((frame) => {
            const style = window.getComputedStyle(frame);
            const image = frame.querySelector('img');
            if (image) {
                return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
            }
            return style.backgroundImage !== 'none'
                && !frame.className.includes('atlas-shimmer');
        });
    }, selector, { timeout: 15000 });
};

const waitForImage = async (page: import('@playwright/test').Page, selector: string) => {
    await page.waitForFunction((imageSelector) => {
        const image = document.querySelector<HTMLImageElement>(imageSelector);
        return image != null && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }, selector, { timeout: 15000 });
};

const clickMapRegion = async (page: import('@playwright/test').Page, regionId: keyof typeof MAP_REGION_POINTS) => {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.locator('[data-testid="qidahen-map-hitmap-canvas"]');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
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
        element.dispatchEvent(new PointerEvent('pointerleave', init));
    }, point);
};

const seedRegionCavalry = async (
    page: import('@playwright/test').Page,
    regionId: string,
    faction: 'ming' | 'mongol' | 'jin',
    count: number,
    level = 1,
) => {
    await page.waitForFunction(() => (window as Window & {
        __BG_TEST_HARNESS__?: {
            state?: { isRegistered?: () => boolean };
        };
    }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
    await page.evaluate(({ regionId: targetRegionId, faction: targetFaction, count: troopCount, level: troopLevel }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get: () => { core: { regions: Array<Record<string, unknown>> } } | null;
                    set: (state: unknown) => Promise<void> | void;
                };
            };
        }).__BG_TEST_HARNESS__;
        const snapshot = harness?.state?.get();
        if (!snapshot || !harness?.state?.set) {
            throw new Error('qidahen test harness state injector unavailable');
        }
        const factionLabel = targetFaction === 'ming' ? '大明' : targetFaction === 'mongol' ? '蒙古' : '后金';
        const next = structuredClone(snapshot);
        next.core.regions = next.core.regions.map((region: Record<string, unknown>) => (
            region.id === targetRegionId
                ? {
                    ...region,
                    controller: targetFaction,
                    controlLabel: factionLabel,
                    troops: troopCount,
                    specialTroops: [
                        {
                            id: `${targetFaction}-${targetRegionId}-cavalry-lv${troopLevel}`,
                            label: `${factionLabel}骑兵`,
                            faction: targetFaction,
                            troopKind: 'cavalry',
                            count: troopCount,
                            level: troopLevel,
                        },
                    ],
                }
                : region
        ));
        return harness.state.set(next);
    }, { regionId, faction, count, level });
};

test.describe('七大恨 Board 地图交互与 HUD 布局', () => {
    test('桌面端显示真实地图并保持轮盘/手牌/牌堆布局', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-hitmap-canvas"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-region-mask-overlay"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-armaments-ming"]')).toContainText('军备 火炮技术1');
        await expect(page.locator('[data-testid="qidahen-armaments-mongol"]')).toContainText('军备 骑兵铁甲1');
        await expect(page.locator('[data-testid="qidahen-armaments-jin"]')).toContainText('军备 步兵铁甲1');
        await expect(page.locator('[data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-map-layer"] [data-testid="qidahen-action-wheel"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-wheel-sector"]')).toHaveCount(8);
        await expect(page.locator('[data-testid="qidahen-chronology-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-year-card-slot-"]')).toHaveCount(2);
        await expect(page.locator('[data-testid="qidahen-chronology-deck"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-korea-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-actions-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('大明抽牌');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('20');
        await expect(page.locator('[data-testid="qidahen-hand-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]')).toHaveCount(4);
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('大明弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('7');
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');

        await expect(page.locator('[data-testid="fab-menu"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        for (const wheelLabel of ['开垦', '军屯', '征兵', '训练', '外交', '雇佣', '进攻', '调度', '新年', '年中']) {
            await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toContainText(wheelLabel);
        }

        const drawBox = await page.locator('[data-testid="qidahen-draw-pile"]').boundingBox();
        const handBox = await page.locator('[data-testid="qidahen-hand-zone"]').boundingBox();
        const discardBox = await page.locator('[data-testid="qidahen-discard-pile"]').boundingBox();
        const stageBox = await page.locator('[data-testid="qidahen-desktop-stage"]').boundingBox();
        const mapLayerBox = await page.locator('[data-testid="qidahen-map-layer"]').boundingBox();
        const wheelTip = page.locator('[data-testid="qidahen-wheel-tip"]');
        const actionBox = await page.locator('[data-testid="qidahen-action-raid"]').boundingBox();
        expect(drawBox).not.toBeNull();
        expect(handBox).not.toBeNull();
        expect(discardBox).not.toBeNull();
        expect(stageBox).not.toBeNull();
        expect(mapLayerBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-layout', 'full-bleed-cover');
        expect(Math.abs((mapLayerBox?.width ?? 0) - (stageBox?.width ?? 0))).toBeLessThan(4);
        expect(Math.abs((mapLayerBox?.height ?? 0) - (stageBox?.height ?? 0))).toBeLessThan(4);
        expect(actionBox?.width ?? 9999).toBeLessThan(180);
        expect(drawBox?.x ?? 9999).toBeLessThan(220);
        expect(drawBox?.y ?? 0).toBeGreaterThan(840);
        expect(discardBox?.x ?? 0).toBeGreaterThan(1680);
        expect(discardBox?.y ?? 0).toBeGreaterThan(840);
        expect(handBox?.width ?? 0).toBeGreaterThan(900);
        expect(Math.abs(((handBox?.x ?? 0) + (handBox?.width ?? 0) / 2) - 960)).toBeLessThan(90);
        await expect(page.locator('[data-testid="qidahen-wheel-step-controls"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-payment-panel"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-execute-action"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-payment-state"]')).toHaveCount(0);
        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');
        await expect(wheelTip).toBeHidden();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').hover();
        await expect(wheelTip).toBeVisible();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').hover();
        await expect(wheelTip).toContainText('所有对手抽 2，走 3');

        await saveScreenshot(page, BOARD_SCREENSHOT);
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-movement-preview"]')).toContainText('调度可达');
        await saveScreenshot(page, MOVEMENT_PREVIEW_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-hud-desktop', diagnostics }]);
    });

    test('可执行操作与支付仍走真实 Board 交互', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').hover();
        await expect(page.locator('[data-testid="qidahen-wheel-tip"]')).toContainText('一名对手抽 2，走 2');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').hover();
        await expect(page.locator('[data-testid="qidahen-wheel-tip"]')).toContainText('所有对手抽 2，走 3');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('6/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('8/10');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('12/10');

        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');
        await page.getByRole('button', { name: /赐印招安/ }).click();
        await expect(page.locator('[data-testid="qidahen-payment-state"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-execute-action"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('0/15');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('蒙古抽牌');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('18');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('蒙古弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('0');
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]')).toHaveCount(8);
        await expect(page.locator('[data-testid="qidahen-hand-card-hand-1"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-hand-card-hand-7"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('赐印招安');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('锦州');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('山海关');
        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 3');

        await saveScreenshot(page, FACTION_HAND_SCREENSHOT);
        await saveScreenshot(page, ACTION_FLOW_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-action-flow', diagnostics }]);
    });

    test('进入新势力行动窗口时可手动选择超限弃牌', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            const mongolCards = next.core.handCards.filter((card: any) => card.faction === 'mongol');
            const extraCards = Array.from({ length: 6 }, (_, index) => ({
                ...mongolCards[index % mongolCards.length],
                id: `mongol-over-limit-e2e-${index + 1}`,
                label: `蒙古超限手牌 ${index + 1}`,
                status: 'payable',
            }));
            next.core.factions.mongol.handCount = 12;
            next.core.factions.mongol.discardPileCount = 1;
            next.core.handCards = [...next.core.handCards, ...extraCards];
            return harness.state.set(next);
        });

        await page.getByRole('button', { name: /征召军队/ }).click();
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('征召军队');
        await page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('检查手牌上限');
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('手牌 12/10');
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('需弃 2');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]')).toHaveCount(12);
        await page.locator('[data-testid^="qidahen-hand-card-"]').nth(0).click();
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('已择 1');
        await page.locator('[data-testid^="qidahen-hand-card-"]').nth(1).click();
        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toContainText('已择 2');
        await saveScreenshot(page, HAND_LIMIT_DISCARD_SCREENSHOT);
        await page.locator('[data-testid="qidahen-resolve-hand-limit-discard"]').click();

        await expect(page.locator('[data-testid="qidahen-hand-limit-discard-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('蒙古抽牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('蒙古弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('3');
        await expect(page.locator('[data-testid^="qidahen-hand-card-"]')).toHaveCount(10);
    });

    test('突袭待结算可收口并推进到下一位势力', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 待结算';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = true;
            next.core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '区域 16',
                targetRegionId: 'city-region-14',
                targetRegionName: '察哈尔',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'neutral',
                defenderLabel: '中立',
                restriction: '测试',
                battleWidth: 3,
                boundaryUnitCap: null,
                sourceAvailableTroops: 3,
                committedTroops: 3,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '测试：战后处理收口',
                defenderPayCost: null,
            };
            next.core.postBattleSelection = null;
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        population: 0,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('战后处理收口');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-rout"]')).toContainText('溃败结算');

        await page.click('[data-testid="qidahen-resolve-pending-action"]');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');
        await page.click('[data-testid="qidahen-post-battle-choice-occupy"]');

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await expect(page.locator('[data-testid="qidahen-action-khan-edict"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('蒙古抽牌');
        await expect(page.locator('[data-testid="qidahen-draw-pile"]')).toContainText('20');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('蒙古弃牌');
        await expect(page.locator('[data-testid="qidahen-discard-pile"]')).toContainText('0');
        await saveScreenshot(page, FACTION_DECK_SCREENSHOT);
    });

    test('结构化战斗可选择低级承伤并继续战后占领', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-14';
            next.core.factions.jin.characters = next.core.factions.jin.characters.map((character: any) => ({
                ...character,
                inPlay: false,
            }));
            next.core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '区域 16',
                targetRegionId: 'city-region-14',
                targetRegionName: '区域 14',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '测试',
                battleWidth: 3,
                boundaryUnitCap: null,
                sourceAvailableTroops: 3,
                committedTroops: 3,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '测试：低级承伤优先',
                defenderPayCost: null,
            };
            next.core.postBattleSelection = null;
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        specialTroops: [
                            { id: 'ming-elite-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 4 },
                            { id: 'ming-militia-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                        ],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 0,
                        specialTroops: [
                            { id: 'jin-infantry-lv3', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 1, level: 3 },
                        ],
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('低级承伤优先');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('攻方承伤');
        await expect(page.locator('[data-testid="qidahen-pending-casualty-priority"]')).toContainText('守方承伤');
        await expect(page.locator('[data-testid="qidahen-attacker-casualty-highest-level"]')).toContainText('高级先损');
        await expect(page.locator('[data-testid="qidahen-attacker-casualty-lowest-level"]')).toContainText('低级先损');
        await page.locator('[data-testid="qidahen-attacker-casualty-lowest-level"]').click();
        await saveScreenshot(page, LOW_CASUALTY_SCREENSHOT);

        await page.click('[data-testid="qidahen-resolve-pending-action"]');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('攻方损失 1，幸存 2');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-14');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('战斗掷骰');
        await saveScreenshot(page, BATTLE_RESOLUTION_SCREENSHOT);
        await page.click('[data-testid="qidahen-post-battle-choice-occupy"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
    });

    test('城战突破后可在真实 Board 上选择围城而不改控制权', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnPhase = 'post-battle-decision';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'raid';
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = {
                actionId: 'raid',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-24',
                sourceRegionName: '辽西',
                targetRegionId: 'city-region-25',
                targetRegionName: '山海关',
                targetRuntimeRegionId: 'city-region-25',
                committedTroops: 3,
                survivingTroops: 2,
                attackerLosses: 1,
                movementProfileId: null,
                attackerCasualtyPriority: 'highest-level',
                originalController: 'jin',
                originalControlLabel: '后金',
                title: '战后处理',
                summary: '山海关 已被突破，攻方损失 1，幸存 2，决定是否占领、围城或回退。',
                choices: [
                    {
                        id: 'besiege',
                        mode: 'besiege',
                        regionId: 'city-region-25',
                        plunderPopulation: 0,
                        plunderSource: null,
                        label: '围城该区',
                        detail: '2 个幸存部队留在 山海关 外围围城，区域仍由守方控制。',
                    },
                    {
                        id: 'occupy',
                        mode: 'occupy',
                        regionId: 'city-region-25',
                        plunderPopulation: 0,
                        plunderSource: null,
                        label: '占领该区',
                        detail: '2 个幸存部队留在 山海关',
                    },
                ],
            };
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 3,
                        population: 6,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                if (region.id === 'city-region-25') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                        siegeState: null,
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-besiege"]')).toContainText('围城该区');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await saveScreenshot(page, POST_BATTLE_BESIEGE_SCREENSHOT);
        await page.click('[data-testid="qidahen-post-battle-choice-besiege"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('围城');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('仍由后金控制');
    });

    test('待结算面板可选择实际投入数量并按选择占领', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 待结算';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = true;
            next.core.postBattleSelection = null;
            next.core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '区域 16',
                targetRegionId: 'city-region-14',
                targetRegionName: '区域 14',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '测试',
                battleWidth: 3,
                boundaryUnitCap: null,
                sourceAvailableTroops: 4,
                committedTroops: 4,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '测试：选择实际投入',
                defenderPayCost: null,
            };
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 0,
                        population: 0,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-pending-committed-troops"]')).toContainText('实际投入');
        await page.click('[data-testid="qidahen-pending-committed-2"]');
        await saveScreenshot(page, COMMITTED_TROOPS_SCREENSHOT);
        await page.click('[data-testid="qidahen-resolve-pending-action"]');

        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('投入 2');
        await page.click('[data-testid="qidahen-post-battle-choice-occupy"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
        const finalState = await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get: () => any };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.state?.get();
        });
        const sourceRegion = finalState.core.regions.find((region: any) => region.id === 'city-region-16');
        const targetRegion = finalState.core.regions.find((region: any) => region.id === 'city-region-14');
        expect(sourceRegion.troops).toBe(2);
        expect(targetRegion.controller).toBe('ming');
        expect(targetRegion.troops).toBe(2);
    });

    test('野战战败会给败方显示战败标记', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-14';
            next.core.selectedActionId = 'raid';
            next.core.selectedPaymentCardIds = [];
            next.core.lastSeasonSummary = null;
            next.core.recruitSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.driveTigerConsentSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.factions.ming.defeatMarkers = 0;
            next.core.factions.jin.defeatMarkers = 0;
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 6,
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 5,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-17') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 2,
                    };
                }
                if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        population: 0,
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-player-jin"]')).not.toContainText('败×1');
        await page.getByRole('button', { name: /突袭作战/ }).click();
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭待结算');
        await page.click('[data-testid="qidahen-resolve-pending-action"]');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('败×1');
        await expect(page.locator('[data-testid="qidahen-character-markers-jin"]')).toContainText('努尔哈赤(1)败×1');

        await saveScreenshot(page, DEFEAT_MARKER_SCREENSHOT);
    });

    test('轮盘进攻调度会按地图连线生成待结算目标', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await seedRegionCavalry(page, 'song-jin', 'ming', 2);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => { core: { regions: Array<Record<string, unknown>> } } | null;
                        set: (state: unknown) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.regions = next.core.regions.map((region: Record<string, unknown>) => (
                region.id === 'city-region-22'
                    ? {
                        ...region,
                        siegeState: {
                            attackerFactionId: 'jin',
                            attackerTroops: 2,
                            attackerSpecialTroops: [],
                            sourceRegionId: 'city-region-19',
                        },
                    }
                    : region
            ));
            return harness.state.set(next);
        });

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-movement-preview"]')).toContainText('调度可达');

        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('轮盘进攻/调度 · 调骑 4');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('源区 皮岛');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-target-city-region-22"]')).toContainText('东江');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-target-city-region-22"]')).toContainText('解围');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-target-city-region-32"]')).toContainText('登莱');

        await saveScreenshot(page, WHEEL_DISPATCH_SELECTION_SCREENSHOT);

        await page.click('[data-testid="qidahen-wheel-dispatch-target-city-region-32"]');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('登莱');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('耗4');

        await saveScreenshot(page, WHEEL_DISPATCH_SCREENSHOT);

        await page.click('[data-testid="qidahen-resolve-pending-action"]');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy"]')).toContainText('占领该区');

        await saveScreenshot(page, POST_BATTLE_SCREENSHOT);

        await page.click('[data-testid="qidahen-post-battle-choice-occupy"]');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('登莱');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('占领');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('大明');
    });

    test('轮盘调度可从真实 Board 增援己方围城区域且不进入战斗', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-24';
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-25') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                        siegeState: {
                            attackerFactionId: 'ming',
                            attackerTroops: 2,
                            attackerSpecialTroops: [],
                            sourceRegionId: 'city-region-20',
                        },
                        cityState: {
                            troops: 0,
                            population: 2,
                            specialTroops: [],
                        },
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-3-all-opponents"]').click();
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('轮盘进攻/调度 · 调骑 4');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-target-city-region-25"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-target-city-region-25"]')).toContainText('增援围城');

        await page.click('[data-testid="qidahen-wheel-dispatch-target-city-region-25"]');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('增援围城');
        const pendingSnapshot = await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get?.() ?? null;
            if (!snapshot?.core?.pendingTargetAction) {
                return null;
            }
            const sourceRegionId = snapshot.core.pendingTargetAction.sourceRegionId;
            const sourceRegion = snapshot.core.regions.find((region: any) => region.id === sourceRegionId) ?? null;
            return {
                sourceRegionId,
                sourceRegionName: snapshot.core.pendingTargetAction.sourceRegionName,
                committedTroops: snapshot.core.pendingTargetAction.committedTroops,
                sourceTroopsBefore: sourceRegion?.troops ?? null,
            };
        });
        expect(pendingSnapshot).not.toBeNull();
        expect(pendingSnapshot?.committedTroops).not.toBeNull();

        await saveScreenshot(page, WHEEL_DISPATCH_SIEGE_REINFORCE_SCREENSHOT);

        await page.click('[data-testid="qidahen-resolve-pending-action"]');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('增援');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('不进入战斗');

        const resolvedSnapshot = await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                    };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.state?.get?.() ?? null;
        });
        expect(resolvedSnapshot?.core?.turnPhase).toBe('action-window');
        const sourceRegion = resolvedSnapshot?.core?.regions?.find((region: any) => region.id === pendingSnapshot?.sourceRegionId);
        const targetRegion = resolvedSnapshot?.core?.regions?.find((region: any) => region.id === 'city-region-25');
        expect(sourceRegion?.troops).toBe((pendingSnapshot?.sourceTroopsBefore ?? 0) - (pendingSnapshot?.committedTroops ?? 0));
        expect(targetRegion?.siegeState?.attackerFactionId).toBe('ming');
        expect(targetRegion?.siegeState?.attackerTroops).toBe(2 + (pendingSnapshot?.committedTroops ?? 0));
        expect(targetRegion?.controller).toBe('jin');
    });

    test('战后处理可劫掠人口并显示抽牌收益', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.actionWheelPosition = 'wheel-recruit-train';
            next.core.selectedRegionId = 'city-region-24';
            next.core.lastSeasonSummary = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 6,
                        population: 0,
                    };
                }
                if (region.id === 'city-region-20') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 2,
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.click('[data-testid="qidahen-wheel-dispatch-target-city-region-20"]');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await page.click('[data-testid="qidahen-resolve-pending-action"]');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy-plunder-2"]')).toContainText('劫掠 2 人口并占领');
        await expect(page.locator('[data-testid="qidahen-post-battle-choice-occupy-plunder-defender-2"]')).toContainText('抽后金牌堆');

        await page.click('[data-testid="qidahen-post-battle-choice-occupy-plunder-defender-2"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('劫掠');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('劫掠 土默特部 2 人口');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('抽后金牌堆获得 2 张手牌');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('5/15');

        await saveScreenshot(page, POST_BATTLE_PLUNDER_SCREENSHOT);
    });

    test('攻方骑兵可在真实 Board 待结算中选择劫掠守方牌堆', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 待结算';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = true;
            next.core.selectedRegionId = 'city-region-14';
            next.core.lastSeasonSummary = null;
            next.core.recruitSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.driveTigerConsentSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.postBattleSelection = null;
            next.core.pendingTargetAction = {
                actionId: 'wheel-dispatch',
                title: '调度进攻待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '区域 16',
                targetRegionId: 'city-region-14',
                targetRegionName: '区域 14',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '调骑 4',
                battleWidth: 3,
                boundaryUnitCap: 3,
                sourceAvailableTroops: 2,
                committedTroops: 2,
                movementProfileId: 'dispatch-cavalry',
                attackPressure: 2,
                attackBoundaryType: 'plain',
                resolutionHint: '骑兵可选择劫掠后撤退。',
                defenderPayCost: null,
            };
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 2,
                        population: 0,
                        specialTroops: [
                            {
                                id: 'ming-cavalry-lv2',
                                label: '大明骑兵',
                                faction: 'ming',
                                troopKind: 'cavalry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 2,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('调度进攻待结算');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-cavalry-plunder-defender"]')).toContainText('骑兵劫掠守方牌堆');
        await page.click('[data-testid="qidahen-resolve-pending-action-cavalry-plunder-defender"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('骑兵劫掠');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('抽后金牌堆获得 2 张手牌');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('守军仍留在原地');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('5/15');

        await saveScreenshot(page, CAVALRY_PLUNDER_SCREENSHOT);
    });

    test('守方骑兵可在真实 Board 待结算中选择避战目标', async ({ page }) => {
        test.setTimeout(45000);
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 待结算';
            next.core.turnPhase = 'resolve-pending';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = true;
            next.core.selectedRegionId = 'city-region-14';
            next.core.lastSeasonSummary = null;
            next.core.recruitSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.driveTigerConsentSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.postBattleSelection = null;
            next.core.factions.jin.defeatMarkers = 0;
            next.core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '区域 16',
                targetRegionId: 'city-region-14',
                targetRegionName: '区域 14',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '突袭',
                battleWidth: 3,
                boundaryUnitCap: 3,
                sourceAvailableTroops: 4,
                committedTroops: 4,
                movementProfileId: null,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '守方骑兵可先避战。',
                defenderPayCost: null,
            };
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) {
                    return region;
                }
                if (region.id === 'city-region-16') {
                    return {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                        troops: 4,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-14') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 2,
                        population: 0,
                        specialTroops: [
                            {
                                id: 'jin-cavalry-lv2',
                                label: '后金骑兵',
                                faction: 'jin',
                                troopKind: 'cavalry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    };
                }
                if (region.id === 'city-region-17') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 5,
                        population: 0,
                        specialTroops: [],
                    };
                }
                if (region.id === 'city-region-19') {
                    return {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                        troops: 1,
                        population: 0,
                        specialTroops: [],
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('突袭作战待结算');
        await expect(page.locator('[data-testid="qidahen-resolve-pending-action-cavalry-evasion-city-region-19"]')).toContainText('骑兵避战至辽西');
        await page.click('[data-testid="qidahen-resolve-pending-action-cavalry-evasion-city-region-19"]');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('守方骑兵避战 2 撤至 辽西');
        await expect(page.locator('[data-testid="qidahen-post-battle-selection"]')).toContainText('战后处理');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).not.toContainText('败×1');
        await clickMapRegion(page, 'liaoxi');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('辽西 · 后金');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 3');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('后金骑兵 x2（2级）');

        await saveScreenshot(page, CAVALRY_EVASION_SCREENSHOT);
    });

    test('轮盘征兵训练会直接给当前己方区域增加部队', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘征兵/训练');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');

        await saveScreenshot(page, WHEEL_RECRUIT_TRAIN_SCREENSHOT);
    });

    test('轮盘外交雇佣会进入外交目标选择，并可同时放友好标记与建立雇佣军', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '0';
            next.core.turnLabel = '第 1 轮 · 大明 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.actionWheelPosition = 'wheel-hire';
            next.core.selectedRegionId = 'song-jin';
            next.core.lastSeasonSummary = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('大明');
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();

        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('源区 皮岛');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await expect(page.locator('[data-testid="qidahen-diplomacy-target-city-region-15"]')).toContainText('辽北');

        await page.locator('[data-testid="qidahen-diplomacy-target-city-region-15"]').click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('当前目标 辽北');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-15');
        await page.locator('[data-testid="qidahen-diplomacy-choice-place-friendly"]').click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 1');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('还可继续 2 次');
        await page.locator('[data-testid="qidahen-diplomacy-choice-hire-only"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('轮盘外交/雇佣');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 2 雇佣军');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 1：');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('大明友好');
        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('雇佣军 x2（2级）');

        await saveScreenshot(page, WHEEL_HIRE_SCREENSHOT);
    });

    test('征召军队会先进入建军选择，再按选择补入 6 个部队', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await page.getByRole('button', { name: /征召军队/ }).click();
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('征召军队');
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await expect(page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]')).toContainText('建立 6 个等级 2 部队');
        await expect(page.locator('[data-testid="qidahen-recruit-choice-level-4-chuanbing"]')).toContainText('建立 2 个等级 4 川兵');
        await page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('征召军队');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 6 个等级 2 部队');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 8');
        await expect(page.locator('[data-testid="qidahen-player-ming"]')).toContainText('2/15');

        await saveScreenshot(page, RECRUIT_SCREENSHOT);
    });

    test('征召军队选择川兵后会在地图提示里显示特殊部队记录', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');

        await page.getByRole('button', { name: /征召军队/ }).click();
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('征召军队');
        await page.locator('[data-testid="qidahen-recruit-choice-level-4-chuanbing"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 4 川兵部队');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('川兵 x2（4级）');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('川兵 x2（4级）');

        await saveScreenshot(page, RECRUIT_CHUANBING_SCREENSHOT);
    });

    test('马市贸易会先进入 1-3 建兵选择，再按选择给大明加兵并让蒙古摸牌', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });

        await page.getByRole('button', { name: /征召军队/ }).click();
        await expect(page.locator('[data-testid="qidahen-recruit-selection"]')).toContainText('征召军队');
        await page.locator('[data-testid="qidahen-recruit-choice-level-2-troops"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');

        await clickMapRegion(page, 'songjin');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('皮岛 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 10');

        await page.getByRole('button', { name: /马市贸易/ }).click();
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-selection"]')).toContainText('马市贸易');
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-selection"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await expect(page.locator('[data-testid="qidahen-ma-shi-trade-choice-3"]')).toContainText('建立 3 个部队');
        await page.locator('[data-testid="qidahen-ma-shi-trade-choice-3"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('马市贸易');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('皮岛');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 3 个部队');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('获得 6 张手牌');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 13');
        await expect(page.locator('[data-testid="qidahen-player-mongol"]')).toContainText('12/10');

        await saveScreenshot(page, MA_SHI_TRADE_SCREENSHOT);
    });

    test('驱虎吞狼会先进入同意选择，目标同意后再抽牌并进入指挥调度目标选择', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await seedRegionCavalry(page, 'jinzhou', 'jin', 2, 2);

        await clickMapRegion(page, 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('锦州 · 后金');

        await page.getByRole('button', { name: /驱虎吞狼/ }).click();

        await expect(page.locator('[data-testid="qidahen-drive-tiger-consent-selection"]')).toContainText('驱虎吞狼');
        await expect(page.locator('[data-testid="qidahen-drive-tiger-consent-selection"]')).toContainText('后金');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'jinzhou');
        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('10/10');
        await page.locator('[data-testid="qidahen-drive-tiger-consent-choice-accept"]').click();

        await expect(page.locator('[data-testid="qidahen-player-jin"]')).toContainText('16/10');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('驱虎吞狼');
        await expect(page.locator('[data-testid="qidahen-wheel-dispatch-selection"]')).toContainText('指挥后金调度进攻');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'jinzhou');
        await expect(page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]').first()).toBeVisible();

        await page.locator('[data-testid^="qidahen-wheel-dispatch-target-"]').first().click();
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('驱虎吞狼待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('源兵');

        await saveScreenshot(page, DRIVE_TIGER_SCREENSHOT);
    });

    test('大汗令箭会先显示二选一，再可执行征兵训练', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '打出军备牌并弃 1 张手牌，当前低保真先升级己方已开发军备。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
                }
                if (region.id === 'city-region-24') {
                    return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
                }
                return region;
            });
            return harness.state.set(next);
        });
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');

        await page.getByRole('button', { name: /大汗令箭/ }).click();
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await expect(page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]')).toContainText('征兵训练');
        await expect(page.locator('[data-testid="qidahen-khan-edict-choice-hire-dispatch"]')).toContainText('外交雇佣');

        await page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]').click();
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('征兵训练');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('蒙古骑兵');

        await saveScreenshot(page, KHAN_EDICT_SCREENSHOT);
    });

    test('大汗令箭选择外交雇佣后会进入外交目标选择，并可同时放友好标记与建立雇佣军', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '打出军备牌并弃 1 张手牌，当前低保真先升级己方已开发军备。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
                }
                if (region.id === 'city-region-24') {
                    return { ...region, controller: 'neutral', controlLabel: '中立', troops: 0 };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');

        await page.getByRole('button', { name: /大汗令箭/ }).click();
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await page.locator('[data-testid="qidahen-khan-edict-choice-hire-dispatch"]').click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('源区 山海关');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-25');
        await page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]').click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('当前目标 宁远');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'city-region-24');
        await page.locator('[data-testid="qidahen-diplomacy-choice-place-friendly"]').click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 1');
        await page.locator('[data-testid="qidahen-diplomacy-choice-hire-only"]').click();

        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('大汗令箭');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 2 雇佣军');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 1：');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('蒙古友好');
        await clickMapRegion(page, 'ningyuan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('宁远 · 蒙古友好');
        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 蒙古');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('雇佣军 x2（2级）');

        await saveScreenshot(page, KHAN_EDICT_HIRE_SCREENSHOT);
    });

    test('外交雇佣同一次行动最多可连续处理 3 个目标后自动完成', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = true;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.diplomacySelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '打出军备牌并弃 1 张手牌，当前低保真先升级己方已开发军备。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
                }
                if (region.id === 'city-region-24' || region.id === 'jinzhou') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        diplomacyMarkerFaction: null,
                        diplomacyMarkerSide: null,
                    };
                }
                if (region.id === 'city-region-28') {
                    return {
                        ...region,
                        controller: 'neutral',
                        controlLabel: '中立',
                        troops: 0,
                        diplomacyMarkerFaction: 'jin',
                        diplomacyMarkerSide: 'friendly',
                    };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await page.getByRole('button', { name: /大汗令箭/ }).click();
        await page.locator('[data-testid="qidahen-khan-edict-choice-hire-dispatch"]').click();

        await page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]').click();
        await page.locator('[data-testid="qidahen-diplomacy-choice-place-friendly"]').click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 1');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('还可继续 2 次');

        await page.locator('[data-testid="qidahen-diplomacy-target-city-region-24"]').click();
        await page.locator('[data-testid="qidahen-diplomacy-choice-flip-vassal"]').click();
        await expect(page.locator('[data-testid="qidahen-diplomacy-history"]')).toContainText('外交 2');
        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toContainText('还可继续 1 次');

        await page.locator('[data-testid="qidahen-diplomacy-target-city-region-28"]').click();
        await page.locator('[data-testid="qidahen-diplomacy-choice-remove-marker"]').click();

        await expect(page.locator('[data-testid="qidahen-diplomacy-selection"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 1：');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 2：');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('外交 3：');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('建立 2 个等级 2 雇佣军');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('蒙古附庸');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('控制标记已移除');

        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 蒙古');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 4');
        await clickMapRegion(page, 'ningyuan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('蒙古附庸');

        await saveScreenshot(page, DIPLOMACY_THREE_TARGET_SCREENSHOT);
    });

    test('联姻诱降失败时会在真实 Board 上改控并只留下 1 个转阵营部队', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '2';
            next.core.turnLabel = '第 1 轮 · 后金 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'marriage-subjugation';
            next.core.selectedPaymentCardIds = [];
            next.core.khanEdictSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.payment = { required: 2, selected: 0, prompt: '需弃 2 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '打出军备牌并弃 1 张手牌，当前低保真先升级己方已开发军备。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'marriage-subjugation', label: '联姻诱降', cost: 2, detail: '弃 2 张手牌，指定邻近控制区域，触发对手支付或转控判定。' },
            ];
            next.core.factions.ming.handCount = 0;
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'ming', controlLabel: '大明', troops: 2, note: '当前守军无法支付联姻诱降代价。' };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('后金');
        await clickMapRegion(page, 'shanhaiguan');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 大明');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 2');

        await page.getByRole('button', { name: /联姻诱降/ }).click();
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('联姻待结算');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('山海关');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('防守 大明');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toContainText('守方需付 4');

        await page.click('[data-testid="qidahen-resolve-pending-action"]');
        await expect(page.locator('[data-testid="qidahen-raid-intent"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('联姻诱降');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('守军未能支付代价');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('山海关 · 后金');
        await expect(page.locator('[data-testid="qidahen-map-region-tip"]')).toContainText('兵力 1');

        await saveScreenshot(page, MARRIAGE_SUBJUGATION_SCREENSHOT);
    });

    test('轮盘跨过年中与新年时会显示结算摘要和防线状态', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        await page.addInitScript(() => {
            (window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__ = true;
        });
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-fortification-strip"]')).toBeVisible();
        await page.waitForFunction(() => (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: { isRegistered?: () => boolean };
            };
        }).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true);
        await page.evaluate(() => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get: () => any;
                        set: (state: any) => Promise<void> | void;
                    };
                };
            }).__BG_TEST_HARNESS__;
            const snapshot = harness?.state?.get();
            if (!snapshot || !harness?.state?.set) {
                throw new Error('qidahen test harness state injector unavailable');
            }
            const next = structuredClone(snapshot);
            next.core.currentPlayer = '1';
            next.core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
            next.core.turnPhase = 'action-window';
            next.core.wheelActionUsed = false;
            next.core.factionActionUsed = false;
            next.core.actionWheelPosition = 'wheel-hire';
            next.core.selectedWheelMoveId = 'move-2-one-opponent';
            next.core.selectedRegionId = 'city-region-25';
            next.core.selectedActionId = 'khan-edict';
            next.core.selectedPaymentCardIds = [];
            next.core.recruitSelection = null;
            next.core.khanEdictSelection = null;
            next.core.maShiTradeSelection = null;
            next.core.wheelDispatchSelection = null;
            next.core.pendingTargetAction = null;
            next.core.postBattleSelection = null;
            next.core.lastSeasonSummary = null;
            next.core.factions.ming.defeatMarkers = 1;
            next.core.factions.ming.characters = next.core.factions.ming.characters.map((character) => ({
                ...character,
                inPlay: character.id === 'ming-mao-wenlong',
            }));
            next.core.factions.mongol.defeatMarkers = 1;
            next.core.factions.jin.defeatMarkers = 1;
            next.core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
            next.core.actionChoices = [
                { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '打出军备牌并弃 1 张手牌，当前低保真先升级己方已开发军备。' },
                { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
                { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
                { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
            ];
            next.core.regions = next.core.regions.map((region: any) => {
                if (region.isLogicalRegion) return region;
                if (region.id === 'city-region-25') {
                    return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
                }
                if (region.id === 'city-region-24') {
                    return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
                }
                return region;
            });
            return harness.state.set(next);
        });

        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('蒙古');
        await page.getByRole('button', { name: /大汗令箭/ }).click();
        await expect(page.locator('[data-testid="qidahen-khan-edict-selection"]')).toContainText('大汗令箭');
        await page.locator('[data-testid="qidahen-khan-edict-choice-recruit-train"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-2-one-opponent"]').click();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('年中结算');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('年中战败标记与人物判定');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('大明处理 1 个战败标记，掷骰 4');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('毛文龙(1) 掷 4');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('蒙古处理 1 个战败标记，掷骰 1');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('林丹·乎图克图(1) 掷 1 离场');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('后金处理 1 个战败标记，掷骰 4');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('努尔哈赤(1) 掷 4');
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('人物牌额外判定仍以低保真摘要保留');
        await expect(page.locator('[data-testid="qidahen-character-markers-mongol"]')).toContainText('人物 0');
        await saveScreenshot(page, MIDYEAR_DEFEAT_MARKERS_SCREENSHOT);
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('后金');
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await page.locator('[data-testid="qidahen-wheel-move-target-move-1-free"]').click();
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-selection"]')).toContainText('新年防线维护');
        await expect(page.locator('[data-testid="qidahen-upkeep-attrition-priority"]')).toContainText('兵力耗损');
        await expect(page.locator('[data-testid="qidahen-upkeep-attrition-lowest-level"]')).toContainText('低级先损');
        await expect(page.locator('[data-testid="qidahen-upkeep-attrition-highest-level"]')).toContainText('高级先损');
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toHaveAttribute('data-map-selected', 'song-jin');
        await page.locator('[data-testid="qidahen-upkeep-attrition-highest-level"]').click();
        await expect(page.locator('[data-testid="qidahen-fortification-maintenance-choice-auto-pay"]')).toContainText('尽量维护防线');
        await saveScreenshot(page, FORTIFICATION_MAINTENANCE_SCREENSHOT);
        await page.locator('[data-testid="qidahen-fortification-maintenance-choice-auto-pay"]').click();
        await expect(page.locator('[data-testid="qidahen-season-summary"]')).toContainText('新年结算');
        await expect(page.locator('[data-testid="qidahen-turn-banner"]')).toContainText('天命五年 1620');
        await expect(page.locator('[data-testid="qidahen-fortification-shanhaiguan"]')).toContainText('完整');
        await expect(page.locator('[data-testid="qidahen-fortification-jinzhou"]')).toContainText('破败');
        await expect(page.locator('[data-testid="qidahen-fortification-ningyuan"]')).toContainText('破败');
        await expect(page.locator('[data-testid="qidahen-fortification-inner-wall"]')).toContainText('完整');

        await saveScreenshot(page, SEASON_FLOW_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-season-flow', diagnostics }]);
    });

    test('手机横屏下地图与 HUD 布局不缩在左上角', async ({ page }) => {
        await setChineseLocale(page);
        await disableAudio(page);
        await disableTutorial(page);
        const diagnostics = attachPageDiagnostics(page);

        await page.setViewportSize({ width: 936, height: 432 });
        await page.goto('/play/qidahen/tutorial', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('[data-testid="qidahen-board"]')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('[data-testid="qidahen-map-layer"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-player-float"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-actions-zone"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-bottom-dock"]')).toBeVisible();
        await expect(page.locator('[data-testid="qidahen-action-wheel-asset"] svg')).toBeVisible();
        await waitForAtlasFrames(page, '[data-testid^="qidahen-year-card-slot-"] [data-card-atlas-frame], [data-testid^="qidahen-hand-card-"] [data-card-atlas-frame]');
        await waitForImage(page, '[data-testid="qidahen-map-layer"] img[alt="七大恨主地图"]');

        const stageBox = await page.locator('[data-testid="qidahen-desktop-stage"]').boundingBox();
        const drawBox = await page.locator('[data-testid="qidahen-draw-pile"]').boundingBox();
        const handBox = await page.locator('[data-testid="qidahen-hand-zone"]').boundingBox();
        const discardBox = await page.locator('[data-testid="qidahen-discard-pile"]').boundingBox();
        expect(stageBox).not.toBeNull();
        expect(stageBox?.x ?? 0).toBeGreaterThanOrEqual(0);
        expect(stageBox?.y ?? 0).toBeGreaterThanOrEqual(0);
        expect(stageBox?.width ?? 0).toBeGreaterThan(760);
        expect(stageBox?.height ?? 0).toBeGreaterThan(390);
        expect(drawBox?.x ?? 9999).toBeLessThan(160);
        expect(drawBox?.y ?? 0).toBeGreaterThan(330);
        expect(handBox).not.toBeNull();
        expect(Math.abs(((handBox?.x ?? 0) + (handBox?.width ?? 0) / 2) - 468)).toBeLessThan(80);
        expect(discardBox).not.toBeNull();
        expect(((discardBox?.x ?? 9999) + (discardBox?.width ?? 0))).toBeLessThanOrEqual(936);
        expect(discardBox?.x ?? 0).toBeGreaterThan(680);
        expect(discardBox?.y ?? 0).toBeGreaterThan(330);

        await saveScreenshot(page, MOBILE_LANDSCAPE_SCREENSHOT);
        assertNoFatalFrontendErrors([{ label: 'qidahen-map-hud-mobile-landscape', diagnostics }]);
    });

    test('区域涂色工具可加载并显示导出入口', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.goto('/dev/qidahen-region-mask', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText('七大恨地图编辑器')).toBeVisible({ timeout: 30000 });
        await expect(page.getByRole('button', { name: '生成区域' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: '保存边界' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: '保存区域' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: '保存连线' }).first()).toBeVisible();
        await expect(page.getByTestId('qidahen-bg-canvas')).toBeVisible();
        await expect(page.getByTestId('qidahen-region-canvas')).toBeVisible();
        await expect(page.locator('input[value="锦州"]').first()).toBeVisible();
    });
});
