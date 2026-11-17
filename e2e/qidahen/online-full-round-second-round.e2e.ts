import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
} from '../helpers/common';
import { QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD } from '../../src/games/qidahen/roomSetup';
import { getQidahenWheelRecruitTrainChoices } from '../../src/games/qidahen/domain/wheelRecruitTrain';
import type { QidahenCore } from '../../src/games/qidahen/domain/types';
import { getQidahenRuntimeRegionAnchorTargetPoint, QIDAHEN_RUNTIME_REGION_BY_ID } from '../../src/games/qidahen/ui/mapGraph';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../../src/games/qidahen/ui/mapRegions';
import { payRaidCards as paySelectedAction } from './raidTestHelpers';

type PlayerPage = {
    context: BrowserContext;
    page: Page;
    playerId: string;
};

const MAP_REGION_POINTS = {
    songjin: { x: 0.6522, y: 0.5913 },
    shanhaiguan: { x: 0.4292, y: 0.6181 },
    jinzhou: { x: 0.4957, y: 0.5342 },
} as const;

async function captureEvidence(
    page: Page,
    testInfo: TestInfo,
    filename: string,
): Promise<string> {
    const screenshotPath = getEvidenceScreenshotPath(testInfo, filename, {
        subdir: 'qidahen/online-full-round-second-round',
        filename,
    });
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: 'disabled',
    });
    return screenshotPath;
}

async function createQidahenPlayerContext(
    browser: Browser,
    baseURL: string | undefined,
    storageKey: string,
): Promise<PlayerPage> {
    const context = await browser.newContext({ baseURL });
    await initContext(context, {
        storageKey,
        skipImageGate: true,
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    return { context, page, playerId: storageKey };
}

async function createQidahenMatchViaApi(hostPage: Page): Promise<{ matchId: string; ownerGuestId: string }> {
    const gameServerBaseURL = getGameServerBaseURL();
    const guestId = `qidahen-full-round-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const response = await hostPage.request.post(`${gameServerBaseURL}/games/qidahen/create`, {
        data: {
            numPlayers: 3,
            setupData: {
                guestId,
                [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
            },
        },
    });
    if (!response.ok()) {
        throw new Error(`七大恨建房失败: ${response.status()}`);
    }
    const payload = (await response.json().catch(() => null)) as { matchID?: string } | null;
    if (!payload?.matchID) {
        throw new Error('七大恨建房响应缺少 matchID');
    }
    return { matchId: payload.matchID, ownerGuestId: guestId };
}

async function joinSeat(
    page: Page,
    context: BrowserContext,
    matchId: string,
    playerId: string,
    playerName: string,
    guestId: string,
): Promise<void> {
    const credentials = await joinMatchViaAPI(page, 'qidahen', matchId, playerId, playerName, guestId);
    if (!credentials) {
        throw new Error(`席位 ${playerId} 加入失败`);
    }
    await seedMatchCredentials(context, 'qidahen', matchId, playerId, credentials);
    await page.goto(`/play/qidahen/match/${matchId}?playerID=${playerId}`, {
        waitUntil: 'domcontentloaded',
    });
}

async function claimSeat(
    page: Page,
    context: BrowserContext,
    matchId: string,
    playerId: string,
    playerName: string,
    guestId: string,
): Promise<void> {
    const gameServerBaseURL = getGameServerBaseURL();
    const response = await page.request.post(`${gameServerBaseURL}/games/qidahen/${matchId}/claim-seat`, {
        data: {
            playerID: playerId,
            playerName,
            guestId,
        },
    });
    if (!response.ok()) {
        throw new Error(`席位 ${playerId} 认领失败: ${response.status()}`);
    }
    const payload = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
    if (!payload?.playerCredentials) {
        throw new Error(`席位 ${playerId} 认领后缺少 playerCredentials`);
    }
    await seedMatchCredentials(context, 'qidahen', matchId, playerId, payload.playerCredentials);
    await page.goto(`/play/qidahen/match/${matchId}?playerID=${playerId}`, {
        waitUntil: 'domcontentloaded',
    });
}

async function waitForScenarioVoteScreen(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-faction-selection-screen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-action-wheel')).toHaveCount(0);
    const overlay = page.getByTestId('qidahen-scenario-vote-screen');
    if (!(await overlay.isVisible().catch(() => false))) {
        await page.getByTestId('qidahen-scenario-menu-open').click();
    }
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('qidahen-scenario-vote-option-dingmao-rebellion-1627')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('qidahen-scenario-vote-option-dingmao-rebellion-1627')).toBeDisabled({ timeout: 15000 });
    await expect(page.getByTestId('qidahen-scenario-vote-locked-dingmao-rebellion-1627')).toContainText('当前 3 人房不可投', { timeout: 15000 });
}

async function waitForInMatchSetupOverlay(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-inmatch-setup-overlay')).toBeVisible({ timeout: 30000 });
}

async function waitForFactionSelectionScreen(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-faction-selection-screen')).toBeVisible({ timeout: 30000 });
}

async function selectFaction(page: Page, factionId: 'ming' | 'mongol' | 'jin'): Promise<void> {
    await page.getByTestId(`qidahen-faction-option-${factionId}`).click();
    await page.getByTestId('qidahen-faction-selection-confirm').click();
}

async function waitForActionWindow(page: Page, factionId: 'ming' | 'mongol' | 'jin'): Promise<void> {
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-action-wheel')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId(`qidahen-player-${factionId}`)).toHaveAttribute('data-current', 'true', { timeout: 30000 });
    await expect(page.getByTestId('qidahen-turn-banner')).toHaveCount(0);
}

async function expectViewerPrivateHand(page: Page, factionName: '大明' | '蒙古' | '后金'): Promise<void> {
    await expect(page.getByTestId('qidahen-draw-pile')).toContainText(`${factionName}抽牌`, { timeout: 15000 });
    await expect(page.getByTestId('qidahen-discard-pile')).toContainText(`${factionName}弃牌`, { timeout: 15000 });
    for (const otherFactionName of ['大明', '蒙古', '后金'] as const) {
        if (otherFactionName === factionName) {
            continue;
        }
        await expect(page.getByTestId('qidahen-bottom-dock')).not.toContainText(`${otherFactionName}抽牌`);
        await expect(page.getByTestId('qidahen-bottom-dock')).not.toContainText(`${otherFactionName}弃牌`);
    }
}

async function hostPickScenario(page: Page, scenarioId: 'post-sarhu-1619' | 'shanhaiguan-1622'): Promise<void> {
    await page.getByTestId(`qidahen-scenario-vote-option-${scenarioId}`).click();
    await page.getByTestId('qidahen-scenario-vote-confirm').click();
}

async function resolveMingSetup(hostPage: Page): Promise<void> {
    await hostPage.getByTestId('qidahen-inmatch-setup-character-option-shanhaiguan-1622:ming:character:0-ming-xiong-tingbi').click();
    await hostPage.getByTestId('qidahen-inmatch-setup-character-confirm-shanhaiguan-1622:ming:character:0').click();
    await hostPage.getByTestId('qidahen-inmatch-setup-armament-option-shanhaiguan-1622:ming:armament:0-artillery-tech').click();
    await hostPage.getByTestId('qidahen-inmatch-setup-armament-confirm-shanhaiguan-1622:ming:armament:0').click();
    await hostPage.getByTestId('qidahen-inmatch-setup-armament-option-shanhaiguan-1622:ming:armament:1-long-barreled-musket').click();
    await hostPage.getByTestId('qidahen-inmatch-setup-armament-confirm-shanhaiguan-1622:ming:armament:1').click();
}

async function resolveJinSetup(jinPage: Page): Promise<void> {
    await jinPage.getByTestId('qidahen-inmatch-setup-character-option-shanhaiguan-1622:jin:character:0-jin-fan-wencheng').click();
    await jinPage.getByTestId('qidahen-inmatch-setup-character-confirm-shanhaiguan-1622:jin:character:0').click();
    await jinPage.getByTestId('qidahen-inmatch-setup-character-option-shanhaiguan-1622:jin:character:1-jin-manggultai').click();
    await jinPage.getByTestId('qidahen-inmatch-setup-character-confirm-shanhaiguan-1622:jin:character:1').click();
}

async function clickMapRegion(
    page: Page,
    regionId: keyof typeof MAP_REGION_POINTS,
): Promise<void> {
    const region = regionId === 'jinzhou' ? QIDAHEN_RUNTIME_REGION_BY_ID.get(regionId) : undefined;
    const point = region?.center
        ? { x: region.center.x / QIDAHEN_MAP_WIDTH, y: region.center.y / QIDAHEN_MAP_HEIGHT }
        : MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    const box = await canvas.boundingBox();
    expect(box, '地图点击区域应存在').not.toBeNull();
    const x = box!.x + box!.width * point.x;
    const y = box!.y + box!.height * point.y;
    const hit = await page.evaluate(({ x: hitX, y: hitY }) => {
        const element = document.elementFromPoint(hitX, hitY);
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const current = state?.sys?.interaction?.current;
        return {
            tag: element?.tagName, testId: element?.getAttribute('data-testid'),
            phase: state?.core?.turnPhase, player: state?.core?.currentPlayer,
            interaction: current && { playerId: current.playerId, sourceId: current.data?.sourceId,
                options: current.data?.options?.map((option: { id: string }) => option.id) },
        };
    }, { x, y });
    console.log('[QIDAHEN_MAP_CLICK]', JSON.stringify({ regionId, x, y, hit }));
    await page.mouse.click(x, y);
}

async function clickGuidedMapTarget(page: Page, targetRegionId: string): Promise<void> {
    const guideHitTarget = page.getByTestId(`qidahen-map-guide-hit-target-${targetRegionId}`);
    if (await guideHitTarget.count()) {
        await guideHitTarget.click();
        return;
    }
    await page.evaluate((guidedTargetRegionId) => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="qidahen-map-hitmap-canvas"]');
        const targetCircle = document.querySelector<SVGCircleElement>(`[data-testid="qidahen-map-guide-route-${guidedTargetRegionId}"] circle`);
        if (!canvas || !targetCircle) {
            throw new Error(`missing guided map target for ${guidedTargetRegionId}`);
        }
        const circleRect = targetCircle.getBoundingClientRect();
        const clientX = circleRect.left + circleRect.width / 2;
        const clientY = circleRect.top + circleRect.height / 2;
        const init: PointerEventInit = {
            clientX,
            clientY,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        canvas.dispatchEvent(new PointerEvent('pointermove', init));
        canvas.dispatchEvent(new PointerEvent('pointerdown', init));
        canvas.dispatchEvent(new PointerEvent('pointerleave', init));
    }, targetRegionId);
}

async function dumpVisibleActionIds(page: Page): Promise<string[]> {
    return page.locator('[data-testid^="qidahen-action-"]').evaluateAll((elements) => (
        elements
            .map((element) => element.getAttribute('data-testid'))
            .filter((value): value is string => Boolean(value))
    ));
}

async function performWheelStep(page: Page, moveId: 'move-1-free' | 'move-2-one-opponent' | 'move-3-all-opponents'): Promise<void> {
    const target = page.getByTestId(`qidahen-wheel-move-target-${moveId}`);
    await expect(target).toBeVisible({ timeout: 15000 });
    const before = await page.evaluate(() => {
        const core = (window as any).__BG_TEST_HARNESS__.state.get().core;
        return { selected: core.selectedWheelMoveId, marker: document.querySelector('[data-testid="qidahen-wheel-current-marker"]')?.getAttribute('data-wheel-current-position') };
    });
    await target.click({ timeout: 15000 });
    if (moveId === 'move-2-one-opponent') {
        const opponent = page.locator('button[data-testid^="qidahen-wheel-opponent-"]').first();
        await expect(opponent).toBeVisible({ timeout: 10000 });
        await opponent.click();
        return;
    }
    await expect.poll(async () => page.evaluate(({ selected, marker, move }) => {
        const core = (window as any).__BG_TEST_HARNESS__.state.get().core;
        return document.querySelector('[data-testid="qidahen-wheel-current-marker"]')?.getAttribute('data-wheel-current-position') !== marker
            || selected !== move && core.selectedWheelMoveId === move;
    }, { ...before, move: moveId }), { timeout: 15000, message: '等待轮盘执行或选中步数' }).toBe(true);
    const markerAfter = await page.getByTestId('qidahen-wheel-current-marker').getAttribute('data-wheel-current-position');
    if (markerAfter === before.marker) {
        await target.click({ timeout: 15000 });
    }
}

async function selectVisibleRaidRegion(page: Page, field: 'lockedSourceRegionId' | 'currentTargetRegionId'): Promise<string> {
    const overlay = page.getByTestId('qidahen-map-region-mask-overlay');
    await expect(overlay).toHaveAttribute('data-qidahen-candidate-region-ids', /.+/, { timeout: 15000 });
    const candidateIds = (await overlay.getAttribute('data-qidahen-candidate-region-ids'))!.split('|');
    const content = page.getByTestId('qidahen-map-content');
    const rect = await content.boundingBox();
    const size = await content.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight }));
    expect(rect).not.toBeNull();
    const candidates = candidateIds.flatMap(id => {
        const point = getQidahenRuntimeRegionAnchorTargetPoint(id);
        return point ? [{ id, x: rect!.x + point.x * rect!.width / size.width, y: rect!.y + point.y * rect!.height / size.height }] : [];
    });
    const target = await page.evaluate(items => items.find(({ x, y }) => (
        x >= 0 && y >= 0 && x < innerWidth && y < innerHeight
        && document.elementFromPoint(x, y)?.getAttribute('data-testid') === 'qidahen-map-hitmap-canvas'
    )), candidates);
    expect(target, `突袭应有屏幕内可点击的合法地区，候选: ${candidateIds.join(', ')}`).toBeTruthy();
    await page.mouse.click(target!.x, target!.y);
    await expect.poll(async () => page.evaluate(key => (window as any).__BG_TEST_HARNESS__.state.get().core.regionFocusState[key], field),
        { timeout: 15000, message: `等待设置 ${field}: ${target!.id}` }).toBe(target!.id);
    return target!.id;
}

async function resolvePendingBattleByDefault(page: Page, opponents: Page[]): Promise<void> {
    await expect.poll(async () => {
        if (await page.getByTestId('qidahen-resolve-pending-action').isVisible().catch(() => false)) return true;
        for (const opponent of opponents) {
            if (await opponent.getByTestId('qidahen-resolve-pending-action-defender-fight').isVisible().catch(() => false)) return true;
        }
        return false;
    }, { timeout: 15000, message: '等待守方应战或进攻方战斗确认' }).toBe(true);
    for (const opponent of opponents) {
        const defend = opponent.getByTestId('qidahen-resolve-pending-action-defender-fight');
        if (await defend.isVisible().catch(() => false) && await defend.isEnabled()) {
            await defend.click({ timeout: 15000 });
            break;
        }
    }
    const troop = page.locator('[data-testid^="qidahen-map-token-"][data-pending-committed-selectable="true"]').first();
    if (await troop.isVisible().catch(() => false)) {
        await troop.click({ timeout: 15000 });
        await expect(troop).toHaveAttribute('data-pending-committed-selected', 'true', { timeout: 15000 });
    }
    await logHostPendingState(page, 'before-click-rear-guard');
    const rearGuard = page.getByTestId('qidahen-resolve-pending-action');
    await expect(rearGuard).toBeEnabled({ timeout: 15000 });
    await rearGuard.click({ timeout: 15000 });
    await expect(page.getByTestId('qidahen-raid-intent')).toHaveCount(0, { timeout: 15000 });
}

async function resolvePostBattleByDefault(page: Page): Promise<void> {
    const occupyMode = page.getByTestId('qidahen-post-battle-mode-occupy');
    const availableMode = await occupyMode.count()
        ? occupyMode
        : page.locator('[data-testid^="qidahen-post-battle-mode-"]').first();
    if (await availableMode.count()) {
        await availableMode.click();
    }
    const firstChoice = page.locator('[data-testid^="qidahen-post-battle-choice-"]').first();
    if (await firstChoice.count()) {
        await firstChoice.click();
        await page.getByTestId('qidahen-post-battle-confirm').click();
        return;
    }
    throw new Error('未找到可执行的待结算按钮');
}

async function openUpgradeArmamentPaymentFlow(
    page: Page,
    options?: { selectSongjin?: boolean },
): Promise<string> {
    if (options?.selectSongjin) {
        await clickMapRegion(page, 'songjin');
    }
    await performWheelStep(page, 'move-1-free');
    const core = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core) as QidahenCore;
    const factionId = Object.values(core.factions).find(faction => faction.playerId === core.currentPlayer)?.id;
    const source = core.handCards.find(card => card.faction === factionId && card.cardKind === 'armament' && card.armamentId && card.status !== 'disabled');
    expect(source, '当前行动方须有可使用的军备手牌').toBeTruthy();
    await page.getByTestId(`qidahen-hand-card-${source!.id}`).click();
    await expect(page.getByTestId('qidahen-action-payment-panel')).toBeVisible({ timeout: 15000 });
    return source!.id;
}

async function payUpgradeArmament(page: Page, sourceId: string): Promise<void> {
    const core = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core) as QidahenCore;
    const factionId = Object.values(core.factions).find(faction => faction.playerId === core.currentPlayer)?.id;
    const discardId = core.handCards.find(card => card.faction === factionId && card.id !== sourceId && card.status !== 'disabled')?.id;
    expect(discardId, '军备行动须有另一张手牌用于支付').toBeTruthy();
    const candidate = page.getByTestId(`qidahen-hand-card-${discardId!}`);
    await expect(candidate).toBeVisible({ timeout: 15000 });
    await candidate.click({ timeout: 15000 });
    const confirm = page.getByTestId('qidahen-action-payment-confirm');
    await expect(confirm).toBeEnabled();
    await confirm.click();
}

async function finishTurn(page: Page): Promise<void> {
    const finishSlot = page.getByTestId('qidahen-turn-option-finish-slot');
    await expect(finishSlot).toBeVisible({ timeout: 15000 });
    const currentPlayer = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.currentPlayer);
    await finishSlot.click();
    const skipHand = page.getByTestId('qidahen-turn-option-skip-hand');
    const declineBonus = page.getByTestId('qidahen-turn-option-decline-bonus');
    await expect.poll(async () => (await skipHand.isVisible()) || (await declineBonus.isVisible()) || await page.evaluate((previous) =>
        (window as any).__BG_TEST_HARNESS__.state.get().core.currentPlayer !== previous, currentPlayer),
    { timeout: 15000, message: '等待奖励选择、手牌阶段或回合交接' }).toBe(true).catch(async error => {
        const snapshot = await page.evaluate(() => ({
            core: (window as any).__BG_TEST_HARNESS__.state.get().core,
            buttons: Array.from(document.querySelectorAll('button')).filter(button => button.offsetWidth && button.offsetHeight)
                .map(button => ({ testId: button.getAttribute('data-testid'), text: button.textContent?.trim(), disabled: button.disabled })),
        }));
        console.log('[QIDAHEN_FINISH_TURN]', JSON.stringify(snapshot));
        throw error;
    });
    if (await declineBonus.isVisible()) {
        await declineBonus.click();
        await expect.poll(async () => (await skipHand.isVisible()) || await page.evaluate((previous) =>
            (window as any).__BG_TEST_HARNESS__.state.get().core.currentPlayer !== previous, currentPlayer),
        { timeout: 15000, message: '等待放弃奖励后的手牌阶段或回合交接' }).toBe(true);
    }
    if (await skipHand.isVisible()) await skipHand.click();
}

async function performKhanEdictTurn(page: Page): Promise<void> {
    await performWheelStep(page, 'move-1-free');
    const actionIds = await dumpVisibleActionIds(page);
    const actionButton = page.getByTestId('qidahen-action-khan-edict');
    await expect(actionButton, `蒙古行动按钮缺失，当前可见动作: ${actionIds.join(', ')}`).toBeVisible({ timeout: 15000 });
    await actionButton.click();
    await expect(page.getByTestId('qidahen-action-payment-panel')).toBeVisible({ timeout: 15000 });
    await paySelectedAction(page, 1);
    await expect(page.getByTestId('qidahen-khan-edict-selection')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('qidahen-khan-edict-choice-recruit-train').click();
    await page.getByTestId('qidahen-wheel-recruit-train-choice-action%3Arecruit').click();
    await expect.poll(async () => page.evaluate(() =>
        (window as any).__BG_TEST_HARNESS__.state.get().core.wheelRecruitTrainProgress?.phase,
    ), { timeout: 15000 }).toBe('choose-recruit-target');
    const core = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core) as QidahenCore;
    const target = getQidahenWheelRecruitTrainChoices(core).find(choice => choice.kind === 'recruit-target' && choice.regionId);
    expect(target?.regionId, '征兵应有合法本土目标').toBeTruthy();
    const region = QIDAHEN_RUNTIME_REGION_BY_ID.get(target!.regionId!);
    expect(region?.center, '征兵地点应有地图坐标').toBeTruthy();
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * region!.center!.x / QIDAHEN_MAP_WIDTH,
        box!.y + box!.height * region!.center!.y / QIDAHEN_MAP_HEIGHT);
    await page.getByTestId('qidahen-wheel-recruit-train-choice-finish').click();
    await finishTurn(page);
}

async function logVisibleHostActions(page: Page, label: string): Promise<void> {
    const actions = await page.locator('[data-testid^="qidahen-action-"]').evaluateAll((elements) => (
        elements
            .map((element) => ({
                testId: element.getAttribute('data-testid'),
                text: (element.textContent ?? '').trim(),
                disabled: element.getAttribute('disabled') != null || element.getAttribute('aria-disabled') === 'true',
            }))
            .filter((entry) => entry.testId?.startsWith('qidahen-action-'))
    ));
    console.log(`[QIDAHEN_HOST_ACTIONS:${label}]`, JSON.stringify(actions));
}

async function logHostPendingState(page: Page, label: string): Promise<void> {
    const snapshot = await page.evaluate(() => {
        const state = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => any;
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.() ?? null;
        if (!state) {
            return null;
        }
        return {
            currentPlayer: state.core?.currentPlayer ?? null,
            turnPhase: state.core?.turnPhase ?? null,
            selectedRegionId: state.core?.selectedRegionId ?? null,
            pendingTargetAction: state.core?.pendingTargetAction
                ? {
                    actionId: state.core.pendingTargetAction.actionId,
                    title: state.core.pendingTargetAction.title,
                    sourceRegionId: state.core.pendingTargetAction.sourceRegionId,
                    targetRegionId: state.core.pendingTargetAction.targetRegionId,
                    targetRuntimeRegionId: state.core.pendingTargetAction.targetRuntimeRegionId,
                }
                : null,
            postBattleSelection: state.core?.postBattleSelection
                ? {
                    title: state.core.postBattleSelection.title,
                    targetRuntimeRegionId: state.core.postBattleSelection.targetRuntimeRegionId,
                    choiceIds: Array.isArray(state.core.postBattleSelection.choices)
                        ? state.core.postBattleSelection.choices.map((choice: { id: string }) => choice.id)
                        : [],
                }
                : null,
            interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
        };
    });
    console.log(`[QIDAHEN_HOST_PENDING:${label}]`, JSON.stringify(snapshot));
}

test.describe('七大恨联机完整首轮到第二回合开始', () => {
    test('真实联机 match 从房主局内选择剧本走到第二回合开始', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const host = await createQidahenPlayerContext(browser, baseURL, '__qidahen_full_round_host__');
        const mongol = await createQidahenPlayerContext(browser, baseURL, '__qidahen_full_round_mongol__');
        const jin = await createQidahenPlayerContext(browser, baseURL, '__qidahen_full_round_jin__');
        const diagnostics = [
            { label: 'host', diagnostics: attachPageDiagnostics(host.page) },
            { label: 'mongol', diagnostics: attachPageDiagnostics(mongol.page) },
            { label: 'jin', diagnostics: attachPageDiagnostics(jin.page) },
        ];

        try {
            if (!(await ensureGameServerAvailable(host.page))) {
                test.skip(true, '游戏服务器不可用，无法执行七大恨完整首轮 E2E');
            }

            const { matchId, ownerGuestId } = await createQidahenMatchViaApi(host.page);
            await claimSeat(host.page, host.context, matchId, '0', 'Host-QDH', ownerGuestId);
            await joinSeat(mongol.page, mongol.context, matchId, '1', 'Mongol-QDH', `qidahen-mongol-${Date.now()}`);
            await joinSeat(jin.page, jin.context, matchId, '2', 'Jin-QDH', `qidahen-jin-${Date.now()}`);

            await Promise.all([
                waitForScenarioVoteScreen(host.page),
                waitForScenarioVoteScreen(mongol.page),
                waitForScenarioVoteScreen(jin.page),
            ]);
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-01-房主局内选择剧本页.png');

            await expect(mongol.page.getByTestId('qidahen-scenario-vote-actions')).toContainText('等待房主');
            await hostPickScenario(host.page, 'shanhaiguan-1622');

            await Promise.all([
                waitForFactionSelectionScreen(host.page),
                waitForFactionSelectionScreen(mongol.page),
                waitForFactionSelectionScreen(jin.page),
            ]);
            await selectFaction(host.page, 'ming');
            await selectFaction(mongol.page, 'mongol');
            await selectFaction(jin.page, 'jin');

            await Promise.all([
                waitForInMatchSetupOverlay(host.page),
                waitForInMatchSetupOverlay(mongol.page),
                waitForInMatchSetupOverlay(jin.page),
            ]);
            await resolveMingSetup(host.page);
            await resolveJinSetup(jin.page);

            await Promise.all([
                expect(host.page.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0, { timeout: 30000 }),
                expect(mongol.page.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0, { timeout: 30000 }),
                expect(jin.page.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0, { timeout: 30000 }),
            ]);

            await waitForActionWindow(host.page, 'mongol');
            await expectViewerPrivateHand(host.page, '大明');
            await expect(host.page.getByTestId('qidahen-fortification-strip')).toHaveCount(0);
            await expect(host.page.getByTestId('qidahen-shared-printed-runtime-switcher')).toHaveCount(0);
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-03-大明视角-蒙古行动中仍显示大明手牌.png');
            await performKhanEdictTurn(mongol.page);

            await waitForActionWindow(host.page, 'jin');
            await expectViewerPrivateHand(host.page, '大明');
            await expect(host.page.getByTestId('qidahen-fortification-strip')).toHaveCount(0);
            await expect(host.page.getByTestId('qidahen-shared-printed-runtime-switcher')).toHaveCount(0);
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-04-大明视角-后金行动中仍显示大明手牌.png');
            await performWheelStep(jin.page, 'move-1-free');
            await finishTurn(jin.page);

            await waitForActionWindow(host.page, 'ming');
            await expectViewerPrivateHand(host.page, '大明');
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-02-第1轮-大明行动窗口.png');
            const hasArmament = await host.page.evaluate(() => {
                const core = (window as any).__BG_TEST_HARNESS__.state.get().core as QidahenCore;
                const faction = Object.values(core.factions).find(item => item.playerId === core.currentPlayer)?.id;
                const cards = core.handCards.filter(card => card.faction === faction && card.status !== 'disabled');
                return cards.length >= 2 && cards.some(card => card.cardKind === 'armament' && card.armamentId);
            });
            if (hasArmament) {
                const hostUpgradeCard = await openUpgradeArmamentPaymentFlow(host.page, { selectSongjin: true });
                await captureEvidence(host.page, testInfo, '七大恨-完整首轮-02A-大明选中一级行动-主入口明文提示.png');
                await expect(host.page.getByTestId('qidahen-action-payment-panel')).toBeVisible({ timeout: 15000 });
                await captureEvidence(host.page, testInfo, '七大恨-完整首轮-02B-大明弃牌确认条固定在手牌上方.png');
                await payUpgradeArmament(host.page, hostUpgradeCard);
            } else {
                console.log('[QIDAHEN_FULL_ROUND] 自然发牌无可支付军备，走轮盘并结束本回合；军备入口需独立场景验证');
                await performWheelStep(host.page, 'move-1-free');
            }
            await finishTurn(host.page);

            await waitForActionWindow(host.page, 'mongol');
            await expect.poll(async () => host.page.evaluate(() => (
                (window as Window & {
                    __BG_TEST_HARNESS__?: { state?: { get?: () => { core?: { roundNumber?: number } } } };
                }).__BG_TEST_HARNESS__?.state?.get?.()?.core?.roundNumber ?? null
            )), { timeout: 30000 }).toBe(2);
            await performKhanEdictTurn(mongol.page);
            await waitForActionWindow(host.page, 'jin');
            await captureEvidence(jin.page, testInfo, '七大恨-第二轮-后金轮盘停格候选.png');
            await performWheelStep(jin.page, 'move-1-free');
            await finishTurn(jin.page);
            await waitForActionWindow(host.page, 'ming');
            await expectViewerPrivateHand(host.page, '大明');
            await performWheelStep(host.page, 'move-1-free');
            await logVisibleHostActions(host.page, 'round-2-ming');
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-05-第2轮开始-回到大明行动窗口.png');

            await host.page.getByTestId('qidahen-action-raid').click();
            await expect(host.page.getByTestId('qidahen-action-payment-panel')).toBeVisible({ timeout: 15000 });
            await selectVisibleRaidRegion(host.page, 'lockedSourceRegionId');
            await selectVisibleRaidRegion(host.page, 'currentTargetRegionId');
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-06-第2轮大明-选中合法攻打目标.png');
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-07-第2轮大明-点击突袭作战后进入弃牌确认.png');
            await paySelectedAction(host.page, 1);
            await expect(host.page.getByTestId('qidahen-raid-intent')).toBeVisible({ timeout: 15000 });
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-08-第2轮大明-弃牌后进入攻打待结算.png');
            await resolvePendingBattleByDefault(host.page, [mongol.page, jin.page]);
            const postBattleSelection = host.page.getByTestId('qidahen-post-battle-selection');
            const postBattleVisible = await postBattleSelection.isVisible().catch(() => false);
            if (postBattleVisible) {
                await captureEvidence(host.page, testInfo, '七大恨-完整首轮-09-第2轮大明-点击断后后进入战后处理.png');
                await resolvePostBattleByDefault(host.page);
                await captureEvidence(host.page, testInfo, '七大恨-完整首轮-10-第2轮大明-点击占领完成攻打收口.png');
            } else {
                await captureEvidence(host.page, testInfo, '七大恨-完整首轮-09-第2轮大明-点击断后后返回主流程.png');
            }

            assertNoFatalFrontendErrors(diagnostics);
        } finally {
            await Promise.allSettled([
                host.context.close(),
                mongol.context.close(),
                jin.context.close(),
            ]);
        }
    });
});
