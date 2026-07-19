import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
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
    await expect(page.getByTestId('qidahen-scenario-vote-screen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-action-wheel')).toHaveCount(0);
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

async function waitForActionWindow(page: Page, factionName: string): Promise<void> {
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-action-wheel')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-turn-banner')).toContainText(factionName, { timeout: 30000 });
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
        element.dispatchEvent(new PointerEvent('pointerup', init));
        element.dispatchEvent(new PointerEvent('pointerleave', init));
    }, point);
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
    await target.click();
    await page.waitForTimeout(200);
    const turnBanner = page.getByTestId('qidahen-turn-banner');
    const wheelAlreadyUsed = (await turnBanner.textContent())?.includes('轮盘 已用') ?? false;
    const targetDisabled = (await target.getAttribute('aria-disabled')) === 'true';
    if (!wheelAlreadyUsed && !targetDisabled) {
        await target.click();
    }
}

async function paySelectedAction(page: Page, count: number): Promise<void> {
    const handCards = page.locator('[data-testid^="qidahen-hand-card-"]');
    for (let index = 0; index < count; index += 1) {
        await expect(handCards.nth(index)).toBeVisible({ timeout: 15000 });
        await handCards.nth(index).click();
    }
    const confirmButton = page.getByTestId('qidahen-action-payment-confirm');
    await expect(confirmButton).toBeEnabled({ timeout: 15000 });
    await confirmButton.click();
}

async function resolvePendingBattleByDefault(page: Page): Promise<void> {
    const committedPanel = page.getByTestId('qidahen-pending-committed-troops');
    if (await committedPanel.count()) {
        const defaultCommitted = page.getByTestId('qidahen-pending-committed-1');
        if (await defaultCommitted.count()) {
            await defaultCommitted.click();
        }
    }
    await logHostPendingState(page, 'before-click-rear-guard');
    const rearGuard = page.getByTestId('qidahen-resolve-pending-action');
    await expect(rearGuard).toBeVisible({ timeout: 15000 });
    await rearGuard.click({ force: true });
    await page.waitForTimeout(300);
    if (await rearGuard.count()) {
        const stillVisible = await rearGuard.isVisible().catch(() => false);
        if (stillVisible) {
            await rearGuard.evaluate((button) => {
                (button as HTMLButtonElement).click();
            });
        }
    }
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
): Promise<Locator> {
    if (options?.selectSongjin) {
        await clickMapRegion(page, 'songjin');
    }
    await performWheelStep(page, 'move-1-free');
    const actionButton = page.getByTestId('qidahen-action-upgrade-armament');
    await expect(actionButton).toBeVisible({ timeout: 15000 });
    await actionButton.click();
    await expect(page.getByTestId('qidahen-action-upgrade-armament')).toContainText('升级军备', { timeout: 15000 });
    return actionButton;
}

async function performUpgradeArmamentTurn(
    page: Page,
    options?: { selectSongjin?: boolean },
): Promise<void> {
    const actionButton = await openUpgradeArmamentPaymentFlow(page, options);
    await actionButton.click();
    await paySelectedAction(page, 2);
}

async function performKhanEdictTurn(page: Page): Promise<void> {
    await performWheelStep(page, 'move-1-free');
    const actionIds = await dumpVisibleActionIds(page);
    const actionButton = page.getByTestId('qidahen-action-khan-edict');
    await expect(actionButton, `蒙古行动按钮缺失，当前可见动作: ${actionIds.join(', ')}`).toBeVisible({ timeout: 15000 });
    await actionButton.click();
    await expect(page.getByTestId('qidahen-action-khan-edict')).toContainText('大汗令箭', { timeout: 15000 });
    await actionButton.click();
    await paySelectedAction(page, 1);
    await expect(page.getByTestId('qidahen-khan-edict-selection')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('qidahen-khan-edict-choice-recruit-train').click();
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

            await waitForActionWindow(host.page, '大明');
            await expectViewerPrivateHand(host.page, '大明');
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-02-第1轮开始-大明行动窗口.png');
            const hostUpgradeActionButton = await openUpgradeArmamentPaymentFlow(host.page, { selectSongjin: true });
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-02A-大明选中一级行动-主入口明文提示.png');
            await hostUpgradeActionButton.click();
            await expect(host.page.getByTestId('qidahen-action-payment-panel')).toBeVisible({ timeout: 15000 });
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-02B-大明弃牌确认条固定在手牌上方.png');
            await paySelectedAction(host.page, 2);

            await waitForActionWindow(host.page, '蒙古');
            await expectViewerPrivateHand(host.page, '大明');
            await expect(host.page.getByTestId('qidahen-turn-banner')).toContainText('蒙古', { timeout: 30000 });
            await expect(host.page.getByTestId('qidahen-fortification-strip')).toHaveCount(0);
            await expect(host.page.getByTestId('qidahen-shared-printed-runtime-switcher')).toHaveCount(0);
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-03-大明视角-蒙古行动中仍显示大明手牌.png');
            await performKhanEdictTurn(mongol.page);

            await waitForActionWindow(host.page, '后金');
            await expectViewerPrivateHand(host.page, '大明');
            await expect(host.page.getByTestId('qidahen-turn-banner')).toContainText('后金', { timeout: 30000 });
            await expect(host.page.getByTestId('qidahen-fortification-strip')).toHaveCount(0);
            await expect(host.page.getByTestId('qidahen-shared-printed-runtime-switcher')).toHaveCount(0);
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-04-大明视角-后金行动中仍显示大明手牌.png');
            await performUpgradeArmamentTurn(jin.page);

            await waitForActionWindow(host.page, '大明');
            await expect(host.page.getByTestId('qidahen-turn-banner')).toContainText('第 2 轮', { timeout: 30000 });
            await expectViewerPrivateHand(host.page, '大明');
            await logVisibleHostActions(host.page, 'round-2-ming');
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-05-第2轮开始-回到大明行动窗口.png');

            await clickMapRegion(host.page, 'jinzhou');
            await expect(host.page.getByTestId('qidahen-map-layer')).toHaveAttribute('data-map-selected', 'jinzhou', { timeout: 15000 });
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-06-第2轮大明-点击锦州作为攻打目标.png');
            await host.page.getByTestId('qidahen-action-raid').click();
            await expect(host.page.getByTestId('qidahen-action-payment-panel')).toBeVisible({ timeout: 15000 });
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-07-第2轮大明-点击突袭作战后进入弃牌确认.png');
            await paySelectedAction(host.page, 1);
            await expect(host.page.getByTestId('qidahen-raid-intent')).toBeVisible({ timeout: 15000 });
            await captureEvidence(host.page, testInfo, '七大恨-完整首轮-08-第2轮大明-弃牌后进入攻打待结算.png');
            await resolvePendingBattleByDefault(host.page);
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
