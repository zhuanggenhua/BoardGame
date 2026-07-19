import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    dismissLobbyConfirmIfNeeded,
    dismissViteOverlay,
    ensureGameServerAvailable,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForFrontendAssets,
    waitForHomeGameList,
} from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';

type PlayerPage = {
    context: BrowserContext;
    page: Page;
};

type QidahenCoreHarnessPatch = Record<string, unknown> & {
    factions: Record<string, Record<string, unknown>>;
    handCards: Array<Record<string, unknown>>;
    playerIds?: unknown;
    currentPlayer?: unknown;
};

const E2E_ARTILLERY_TECH_CARD_ID = 'qidahen-e2e-artillery-tech';

async function captureEvidence(
    page: Page,
    testInfo: TestInfo,
    filename: string,
): Promise<string> {
    const screenshotPath = getEvidenceScreenshotPath(testInfo, filename, {
        subdir: 'qidahen/online-inmatch-setup',
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

async function ensureLobbyReady(page: Page): Promise<void> {
    await page.goto('/', { waitUntil: 'commit', timeout: 15000 });
    await waitForFrontendAssets(page, 45000);
    await waitForHomeGameList(page, 45000);
    await expect(page.locator('[data-game-id="qidahen"]')).toBeVisible({ timeout: 15000 });
}

async function openQidahenCreateRoomModal(page: Page): Promise<void> {
    await page.locator('[data-game-id="qidahen"]').first().click();
    await expect(page).toHaveURL(/game=qidahen/);

    const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
    await expect(detailsModal).toBeVisible({ timeout: 15000 });

    const openCreateRoomButton = detailsModal.getByTestId('game-details-open-create-room');
    await expect(openCreateRoomButton).toBeVisible({ timeout: 10000 });
    await openCreateRoomButton.click();

    await expect(page.getByTestId('create-room-modal').last()).toBeVisible({ timeout: 10000 });
}

async function ensureHostPlayerId(page: Page): Promise<void> {
    const url = new URL(page.url());
    if (!url.searchParams.get('playerID')) {
        url.searchParams.set('playerID', '0');
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    }
}

async function createQidahenRoom(hostPage: Page): Promise<string> {
    await openQidahenCreateRoomModal(hostPage);

    const createRoomModal = hostPage.getByTestId('create-room-modal').last();
    await expect(createRoomModal).toBeVisible();
    await expect(createRoomModal.getByTestId('qidahen-pregame-choice-fields')).toHaveCount(0);
    await expect(createRoomModal.getByTestId('qidahen-pregame-choice-inline-note')).toHaveCount(0);

    await createRoomModal.getByTestId('create-room-confirm-button').click();
    await hostPage.waitForURL(/\/play\/qidahen\/match\//, { timeout: 30000 });
    await ensureHostPlayerId(hostPage);

    const url = new URL(hostPage.url());
    const matchId = url.pathname.split('/').pop();
    if (!matchId) {
        throw new Error('未能从房主 URL 解析出 matchId');
    }

    return matchId;
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
    return { context, page };
}

async function joinAsSeat(
    browser: Browser,
    baseURL: string | undefined,
    matchId: string,
    playerId: string,
): Promise<PlayerPage> {
    const playerPage = await createQidahenPlayerContext(
        browser,
        baseURL,
        `__qidahen_online_inmatch_setup_${playerId}__`,
    );
    const guestId = `qidahen-online-${playerId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const credentials = await joinMatchViaAPI(
        playerPage.page,
        'qidahen',
        matchId,
        playerId,
        `Guest-${playerId}-${Date.now()}`,
        guestId,
    );
    if (!credentials) {
        throw new Error(`玩家 ${playerId} 加入房间失败`);
    }

    await seedMatchCredentials(playerPage.context, 'qidahen', matchId, playerId, credentials);
    await playerPage.page.goto(`/play/qidahen/match/${matchId}?playerID=${playerId}`, {
        waitUntil: 'domcontentloaded',
    });
    return playerPage;
}

async function waitForScenarioVoteScreen(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-scenario-vote-screen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-scenario-vote-title')).toContainText('房主选择', { timeout: 15000 });
    await expect(page.getByTestId('qidahen-action-wheel')).toHaveCount(0);
}

async function waitForInMatchSetupOverlay(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-inmatch-setup-overlay')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-inmatch-setup-scenario')).toContainText('山海关之议', { timeout: 15000 });
    await expect(page.getByTestId('qidahen-scenario-pregame-screen')).toHaveCount(0);
}

async function waitForFactionSelectionScreen(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-faction-selection-screen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-faction-selection-title')).toContainText('选择你的阵营');
    await expect(page.getByTestId('qidahen-action-wheel')).toHaveCount(0);
}

async function assertVoteOverlay(page: Page, playerId: string): Promise<void> {
    await expect(page.getByTestId('qidahen-scenario-vote-option-post-sarhu-1619')).toBeVisible();
    await expect(page.getByTestId('qidahen-scenario-vote-option-shanhaiguan-1622')).toBeVisible();
    await expect(page.getByTestId(`qidahen-scenario-vote-status-${playerId}`)).toContainText('你');
}

async function hostPickScenario(
    page: Page,
    scenarioId: 'post-sarhu-1619' | 'shanhaiguan-1622',
    beforeConfirm?: () => Promise<void>,
): Promise<void> {
    await page.getByTestId(`qidahen-scenario-vote-option-${scenarioId}`).click();
    await expect(page.getByTestId(`qidahen-scenario-vote-option-${scenarioId}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('qidahen-scenario-vote-confirm')).toBeEnabled();
    await beforeConfirm?.();
    await page.getByTestId('qidahen-scenario-vote-confirm').click();
}

async function selectFaction(
    page: Page,
    factionId: 'ming' | 'mongol' | 'jin',
    beforeConfirm?: () => Promise<void>,
): Promise<void> {
    await page.getByTestId(`qidahen-faction-option-${factionId}`).click();
    await expect(page.getByTestId(`qidahen-faction-option-${factionId}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('qidahen-faction-selection-confirm')).toBeEnabled();
    await beforeConfirm?.();
    await page.getByTestId('qidahen-faction-selection-confirm').click();
}

async function assertHostMingView(hostPage: Page): Promise<void> {
    await expect(hostPage.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:ming:character:0')).toBeVisible();
    await expect(hostPage.getByTestId('qidahen-inmatch-setup-armament-shanhaiguan-1622:ming:armament:0')).toBeVisible();
    await expect(hostPage.getByTestId('qidahen-inmatch-setup-armament-shanhaiguan-1622:ming:armament:1')).toBeVisible();
    await expect(hostPage.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:jin:character:0')).toHaveCount(0);
    await expect(hostPage.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:jin:character:1')).toHaveCount(0);
    await expect(hostPage.getByTestId('qidahen-inmatch-setup-waiting')).toContainText('后金');
}

async function assertMongolWaitingOnly(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-inmatch-setup-waiting')).toBeVisible();
    await expect(page.locator('[data-testid^="qidahen-inmatch-setup-character-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="qidahen-inmatch-setup-armament-"]')).toHaveCount(0);
}

async function assertJinView(page: Page): Promise<void> {
    await expect(page.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:jin:character:0')).toBeVisible();
    await expect(page.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:jin:character:1')).toBeVisible();
    await expect(page.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:ming:character:0')).toHaveCount(0);
    await expect(page.locator('[data-testid^="qidahen-inmatch-setup-armament-"]')).toHaveCount(0);
    await expect(page.getByTestId('qidahen-inmatch-setup-waiting')).toContainText('大明');
}

async function resolveMingSetup(hostPage: Page): Promise<void> {
    const setupPage = hostPage.getByTestId('qidahen-inmatch-setup-book-page-player');
    const beforeBox = await setupPage.boundingBox();
    await hostPage.getByTestId('qidahen-inmatch-setup-character-option-shanhaiguan-1622:ming:character:0-ming-xiong-tingbi').click();
    await hostPage.getByTestId('qidahen-inmatch-setup-character-confirm-shanhaiguan-1622:ming:character:0').click();
    const completedCharacterGroup = hostPage.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:ming:character:0');
    await expect(completedCharacterGroup).toBeVisible();
    await expect(completedCharacterGroup).toHaveAttribute('data-completed', 'true');
    const afterBox = await setupPage.boundingBox();
    expect(afterBox?.width).toBe(beforeBox?.width);
    expect(afterBox?.height).toBe(beforeBox?.height);

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

async function injectMingArmamentHandCard(matchId: string, page: Page): Promise<void> {
    const state = await getMatchState(matchId, page);
    const next = structuredClone(state);
    const core = next.core as QidahenCoreHarnessPatch;
    const withoutDuplicate = core.handCards.filter((card) => card.id !== E2E_ARTILLERY_TECH_CARD_ID);
    core.handCards = [
        {
            id: E2E_ARTILLERY_TECH_CARD_ID,
            label: '火炮技术',
            faction: 'ming',
            previewRef: {
                type: 'atlas',
                atlasId: 'qidahen:atlas05-ordinary-hand-preview',
                index: 26,
            },
            accent: 'ming',
            status: 'payable',
            cardKind: 'armament',
            armamentId: 'artillery-tech',
            cardDefId: 'qidahen-atlas05-1626-artillery-tech',
            rulesSummary: '炮兵可训练等级 +1，原始值为 0；每个炮兵战斗掷骰数 +1；后金、蒙古可选择同上或建立 1 个 Lv1 炮兵。',
            previewKind: 'unknown',
            previewIdentityId: 'qidahen-atlas05-1626-artillery-tech',
        },
        ...withoutDuplicate,
    ];
    core.factions.ming.handCount = core.handCards.filter((card) => card.faction === 'ming').length;
    const playerIds = Array.isArray(core.playerIds)
        ? core.playerIds.filter((playerId): playerId is string => typeof playerId === 'string')
        : ['0', '1', '2'];
    const currentPlayer = typeof core.currentPlayer === 'string'
        ? core.currentPlayer
        : playerIds[0] ?? '0';
    next.sys = {
        ...next.sys,
        turnOrder: playerIds,
        currentPlayerIndex: Math.max(0, playerIds.indexOf(currentPlayer)),
    };
    await injectMatchState(matchId, next, page);
}

test.describe('七大恨联机局内前置选择', () => {
    test('在线房间先由房主在局内选择剧本，再进入各席位自己的前置项', async ({ browser, page }, testInfo) => {
        test.setTimeout(240000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const guests: PlayerPage[] = [];
        const hostDiagnostics = attachPageDiagnostics(page);

        await initContext(page.context(), {
            storageKey: '__qidahen_online_inmatch_setup_host__',
            skipImageGate: true,
        });

        try {
            await ensureLobbyReady(page);
            await dismissViteOverlay(page);
            await dismissLobbyConfirmIfNeeded(page);

            if (!(await ensureGameServerAvailable(page))) {
                test.skip(true, '游戏服务器不可用，无法执行七大恨联机局内前置 E2E');
            }

            const matchId = await createQidahenRoom(page);
            guests.push(await joinAsSeat(browser, baseURL, matchId, '1'));
            guests.push(await joinAsSeat(browser, baseURL, matchId, '2'));

            const mongolPage = guests[0].page;
            const jinPage = guests[1].page;
            const mongolDiagnostics = attachPageDiagnostics(mongolPage);
            const jinDiagnostics = attachPageDiagnostics(jinPage);

            await Promise.all([
                waitForScenarioVoteScreen(page),
                waitForScenarioVoteScreen(mongolPage),
                waitForScenarioVoteScreen(jinPage),
            ]);

            await assertVoteOverlay(page, '0');
            await assertVoteOverlay(mongolPage, '1');
            await assertVoteOverlay(jinPage, '2');

            await captureEvidence(page, testInfo, '七大恨-联机局内剧本选择-01-房主进入剧本书页并可点选.png');

            await expect(mongolPage.getByTestId('qidahen-scenario-vote-actions')).toContainText('等待房主');
            await hostPickScenario(page, 'shanhaiguan-1622', async () => {
                await expect(page.getByTestId('qidahen-scenario-vote-screen')).toBeVisible();
                await expect(page.getByTestId('qidahen-faction-selection-screen')).toHaveCount(0);
                await captureEvidence(page, testInfo, '七大恨-联机局内剧本选择-01b-山海关之议已暂选待确认.png');
            });

            await Promise.all([
                waitForFactionSelectionScreen(page),
                waitForFactionSelectionScreen(mongolPage),
                waitForFactionSelectionScreen(jinPage),
            ]);
            await captureEvidence(page, testInfo, '七大恨-联机局内阵营选择-02-三阵营可见且未被占用.png');

            await selectFaction(page, 'ming', async () => {
                await expect(page.getByTestId('qidahen-faction-selection-status')).toContainText('待确认 大明');
                await expect(page.getByTestId('qidahen-faction-selection-screen')).toContainText('已确认 0 / 3');
                await expect(page.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0);
                await captureEvidence(page, testInfo, '七大恨-联机局内阵营选择-02b-大明已暂选待确认.png');
            });
            await expect(page.getByTestId('qidahen-faction-option-ming')).toHaveAttribute('data-selected', 'true');
            await selectFaction(mongolPage, 'mongol');
            await expect(mongolPage.getByTestId('qidahen-faction-option-mongol')).toHaveAttribute('data-selected', 'true');
            await selectFaction(jinPage, 'jin');

            await Promise.all([
                waitForInMatchSetupOverlay(page),
                waitForInMatchSetupOverlay(mongolPage),
                waitForInMatchSetupOverlay(jinPage),
            ]);

            await assertHostMingView(page);
            await assertMongolWaitingOnly(mongolPage);
            await assertJinView(jinPage);

            await captureEvidence(page, testInfo, '七大恨-联机局内前置-02-房主只看到大明前置并等待后金.png');
            await captureEvidence(mongolPage, testInfo, '七大恨-联机局内前置-03-蒙古席位仅显示等待不暴露他人私有前置.png');
            await captureEvidence(jinPage, testInfo, '七大恨-联机局内前置-04-后金席位只看到后金人物前置.png');

            await resolveMingSetup(page);
            await expect(mongolPage.getByTestId('qidahen-inmatch-setup-waiting')).toContainText('后金', { timeout: 15000 });
            await expect(jinPage.getByTestId('qidahen-inmatch-setup-character-shanhaiguan-1622:jin:character:0')).toBeVisible({ timeout: 15000 });

            await resolveJinSetup(jinPage);

            await Promise.all([
                expect(page.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0, { timeout: 30000 }),
                expect(mongolPage.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0, { timeout: 30000 }),
                expect(jinPage.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0, { timeout: 30000 }),
            ]);

            await expect(page.getByTestId('qidahen-action-wheel')).toBeVisible({ timeout: 30000 });
            await captureEvidence(page, testInfo, '七大恨-联机局内前置-05-全部前置完成后进入联机棋盘.png');

            await injectMingArmamentHandCard(matchId, page);
            const artilleryTechCard = page.locator('[data-tutorial-id="qidahen-atlas05-1626-artillery-tech"]').first();
            await expect(artilleryTechCard).toBeVisible({ timeout: 15000 });
            await artilleryTechCard.click();
            await expect(page.locator('[data-qidahen-hand-card-selected="true"]')).toBeVisible({ timeout: 15000 });
            await expect(page.getByTestId('qidahen-action-payment-panel')).toContainText('使用并升级', { timeout: 15000 });
            await captureEvidence(page, testInfo, '七大恨-联机局内前置-06-手牌选中完整描边与使用后弃牌文案.png');

            assertNoFatalFrontendErrors([
                { label: 'qidahen-online-host', diagnostics: hostDiagnostics },
                { label: 'qidahen-online-mongol', diagnostics: mongolDiagnostics },
                { label: 'qidahen-online-jin', diagnostics: jinDiagnostics },
            ]);
        } finally {
            await Promise.allSettled(guests.map((guest) => guest.context.close()));
        }
    });
});
