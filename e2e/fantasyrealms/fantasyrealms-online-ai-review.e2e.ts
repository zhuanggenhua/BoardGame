import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    clearEvidenceScreenshotsForTest,
    createAiDiscardToGameOverCore,
    createOnlineAiNearReviewCore,
    createPlayerContext,
    expectFinalStandingsVisible,
    FantasyRealmsDomain,
    GAME_NAME,
    getEvidenceScreenshotPath,
    injectMatchState,
    injectOnlineAiCore,
    openFantasyRealmsOnlineAiRoom,
    readOnlineAiCore,
    readOnlineAiMatchState,
    waitForFantasyRealmsPlayerReviewBoard,
    waitForFantasyRealmsSpectatorReviewBoard,
    waitForNearReviewInjectionOrImmediateGameOver,
} from './helpers/fantasyrealmsOnlineAi';

test.describe('FantasyRealms online AI flow', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

test('在线房里 seat1 local AI 可在近终局 discard 代表态下完成最后一弃，并真实推进到终局排名', async ({ browser }, testInfo) => {
        test.setTimeout(120000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL);
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms online AI gameover test.');
        }

        const { context, page, matchId, hostPlayerName, aiPlayerName } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);

            const currentState = await readOnlineAiMatchState(matchId, page);
            const injectedCore = createAiDiscardToGameOverCore();
            await injectMatchState(matchId, {
                ...currentState,
                sys: {
                    ...(currentState.sys ?? {}),
                    matchId,
                    gameover: null,
                    turnOrder: [...injectedCore.playerIds],
                    currentPlayerIndex: injectedCore.playerIds.indexOf(injectedCore.currentPlayer),
                },
                core: injectedCore,
            }, page);

            await expect.poll(async () => {
                const state = await readOnlineAiMatchState(matchId, page);
                const record = state as { core?: FantasyRealmsCore; G?: { core?: FantasyRealmsCore }; sys?: { gameover?: unknown } };
                const core = record.core ?? record.G?.core;
                return {
                    gameover: Boolean(record.sys?.gameover),
                    currentPlayer: core?.currentPlayer ?? null,
                    turn: typeof core?.turn === 'number' ? core.turn : null,
                    stage: core?.stage ?? null,
                    discardCount: Array.isArray(core?.discardPile) ? core.discardPile.length : -1,
                    aiHandCount: Array.isArray(core?.players?.['1']?.hand) ? core.players['1']!.hand.length : -1,
                };
            }, {
                timeout: 35000,
                message: '等待 seat1 local AI 在近终局 discard 代表态下完成最后一弃并真实触发 gameover',
            }).toEqual({
                gameover: true,
                currentPlayer: '0',
                turn: 9,
                stage: 'draw',
                discardCount: 12,
                aiHandCount: 7,
            });

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('最终排名')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const finalState = await readOnlineAiMatchState(matchId, page);
            const finalCore = await readOnlineAiCore(matchId, page);
            const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected real online AI near-end discard branch to end in Fantasy Realms gameOver');
            }

            const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0'
                        ? hostPlayerName
                        : playerId === '1'
                            ? aiPlayerName
                            : finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));
            await expectFinalStandingsVisible(page, sortedStandings);

            const evidencePath = getEvidenceScreenshotPath(testInfo, 'online-ai-near-end-discard-gameover');
            await mkdir(dirname(evidencePath), { recursive: true });
            await page.screenshot({ path: evidencePath, fullPage: false });

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-near-end-discard-gameover', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人在线房里 host 在 AI 自然终局后刷新同一 match，仍保持最终排名与公开焦点', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 3,
            aiSeatIds: ['1', '2'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 3-player online AI host review reload test.');
        }

        const { context, page, matchId, hostPlayerName, aiPlayerNames } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            const injectedCore = createOnlineAiNearReviewCore(['0', '1', '2'], '2');
            await injectOnlineAiCore(matchId, page, injectedCore);

            await waitForNearReviewInjectionOrImmediateGameOver({
                matchId,
                page,
                currentPlayer: '2',
                turn: 8,
                discardCount: 9,
                currentHandCount: 8,
                message: '等待 3 人 host review 页进入终局前最后一弃代表态，或 AI 已直接完成最后一弃进入终局',
            });

            await expect.poll(async () => {
                const state = await readOnlineAiMatchState(matchId, page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 90000,
                message: '等待 3 人注入态里的 seat2 local AI 完成最后一弃并打进终局',
            }).toBe(true);

            const finalState = await readOnlineAiMatchState(matchId, page);
            const finalCore = await readOnlineAiCore(matchId, page);
            const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected host reload review online AI game to reach Fantasy Realms gameOver');
            }

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('最终排名')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0'
                        ? hostPlayerName
                        : aiPlayerNames[playerId] ?? finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));
            await expectFinalStandingsVisible(page, sortedStandings);

            const focusNameBeforeReload = (await page.locator('.fr-focus-name').textContent())?.trim() ?? '';
            const focusAtlasCardIdBeforeReload = await page.getByTestId('fantasyrealms-focus-preview').getAttribute('data-atlas-card-id') ?? '';
            expect(focusNameBeforeReload).not.toBe('');
            expect(focusAtlasCardIdBeforeReload).not.toBe('');

            await expect(page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            const hostReviewPath = getEvidenceScreenshotPath(testInfo, 'online-ai-three-player-host-review-after-gameover');
            await mkdir(dirname(hostReviewPath), { recursive: true });
            await page.screenshot({ path: hostReviewPath, fullPage: false });

            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsPlayerReviewBoard(page, matchId, '0');
            await expectFinalStandingsVisible(page, sortedStandings);
            await expect(page.locator('.fr-focus-name')).toHaveText(focusNameBeforeReload);
            await expect(page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', focusAtlasCardIdBeforeReload);
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-three-player-host-review-page', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('3人在线房里 spectator 在 AI 自然终局后进入并刷新同一 match，仍保持最终排名与公开焦点', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 3,
            aiSeatIds: ['1', '2'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 3-player online AI spectator review test.');
        }

        const { context, page, matchId, hostPlayerName, aiPlayerNames } = match!;
        const spectator = await createPlayerContext(browser, baseURL, '__fantasyrealms_online_ai_spectator_review__');
        const diagnostics = attachPageDiagnostics(page);
        const spectatorDiagnostics = attachPageDiagnostics(spectator.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            const injectedCore = createOnlineAiNearReviewCore(['0', '1', '2'], '2');
            await injectOnlineAiCore(matchId, page, injectedCore);

            await waitForNearReviewInjectionOrImmediateGameOver({
                matchId,
                page,
                currentPlayer: '2',
                turn: 8,
                discardCount: 9,
                currentHandCount: 8,
                message: '等待 3 人 spectator review 链进入终局前最后一弃代表态，或 AI 已直接完成最后一弃进入终局',
            });

            await expect.poll(async () => {
                const state = await readOnlineAiMatchState(matchId, page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 90000,
                message: '等待 3 人注入态里的 seat2 local AI 完成最后一弃并打进终局',
            }).toBe(true);

            const finalState = await readOnlineAiMatchState(matchId, page);
            const finalCore = await readOnlineAiCore(matchId, page);
            const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected spectator review online AI game to reach Fantasy Realms gameOver');
            }

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('最终排名')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0'
                        ? hostPlayerName
                        : aiPlayerNames[playerId] ?? finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));
            await expectFinalStandingsVisible(page, sortedStandings);

            await spectator.page.goto(`/play/${GAME_NAME}/match/${matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorReviewBoard(spectator.page, matchId);
            await expectFinalStandingsVisible(spectator.page, sortedStandings);

            const spectatorFocusNameBeforeReload = (await spectator.page.locator('.fr-focus-name').textContent())?.trim() ?? '';
            const spectatorFocusAtlasCardIdBeforeReload = await spectator.page.getByTestId('fantasyrealms-focus-preview').getAttribute('data-atlas-card-id') ?? '';
            expect(spectatorFocusNameBeforeReload).not.toBe('');
            expect(spectatorFocusAtlasCardIdBeforeReload).not.toBe('');

            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(spectator.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const spectatorReviewPath = getEvidenceScreenshotPath(testInfo, 'online-ai-three-player-spectator-review-after-gameover');
            await mkdir(dirname(spectatorReviewPath), { recursive: true });
            await spectator.page.screenshot({ path: spectatorReviewPath, fullPage: false });

            await spectator.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorReviewBoard(spectator.page, matchId);
            await expectFinalStandingsVisible(spectator.page, sortedStandings);
            await expect(spectator.page.locator('.fr-focus-name')).toHaveText(spectatorFocusNameBeforeReload);
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', spectatorFocusAtlasCardIdBeforeReload);

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-three-player-spectator-review-host', diagnostics },
                { label: 'fantasyrealms-online-ai-three-player-spectator-review-page', diagnostics: spectatorDiagnostics },
            ]);
        } finally {
            await spectator.context.close().catch(() => {});
            await context.close().catch(() => {});
        }
    });

    test('6人在线房里 host 在 AI 自然终局后刷新同一 match，仍保持最终排名与公开焦点', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '2', '3', '4', '5'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player online AI host review reload test.');
        }

        const { context, page, matchId, hostPlayerName, aiPlayerNames } = match!;
        const diagnostics = attachPageDiagnostics(page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            const injectedCore = createOnlineAiNearReviewCore(['0', '1', '2', '3', '4', '5'], '5');
            await injectOnlineAiCore(matchId, page, injectedCore);

            await waitForNearReviewInjectionOrImmediateGameOver({
                matchId,
                page,
                currentPlayer: '5',
                turn: 8,
                discardCount: 9,
                currentHandCount: 8,
                message: '等待 6 人 host review 页进入终局前最后一弃代表态，或 AI 已直接完成最后一弃进入终局',
            });

            await expect.poll(async () => {
                const state = await readOnlineAiMatchState(matchId, page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 90000,
                message: '等待 6 人注入态里的 seat5 local AI 完成最后一弃并打进终局',
            }).toBe(true);

            const finalState = await readOnlineAiMatchState(matchId, page);
            const finalCore = await readOnlineAiCore(matchId, page);
            const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected high-player host reload review online AI game to reach Fantasy Realms gameOver');
            }

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('最终排名')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0'
                        ? hostPlayerName
                        : aiPlayerNames[playerId] ?? finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));
            await expectFinalStandingsVisible(page, sortedStandings);

            const focusNameBeforeReload = (await page.locator('.fr-focus-name').textContent())?.trim() ?? '';
            const focusAtlasCardIdBeforeReload = await page.getByTestId('fantasyrealms-focus-preview').getAttribute('data-atlas-card-id') ?? '';
            expect(focusNameBeforeReload).not.toBe('');
            expect(focusAtlasCardIdBeforeReload).not.toBe('');

            await expect(page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');

            const hostReviewPath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-host-review-after-gameover');
            await mkdir(dirname(hostReviewPath), { recursive: true });
            await page.screenshot({ path: hostReviewPath, fullPage: false });

            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsPlayerReviewBoard(page, matchId, '0');
            await expectFinalStandingsVisible(page, sortedStandings);
            await expect(page.locator('.fr-focus-name')).toHaveText(focusNameBeforeReload);
            await expect(page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', focusAtlasCardIdBeforeReload);
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            assertNoFatalFrontendErrors([{ label: 'fantasyrealms-online-ai-six-player-host-review-page', diagnostics }]);
        } finally {
            await context.close().catch(() => {});
        }
    });

    test('6人在线房里 spectator 在 AI 自然终局后进入并刷新同一 match，仍保持最终排名与公开焦点', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const match = await openFantasyRealmsOnlineAiRoom(browser, baseURL, {
            numPlayers: 6,
            aiSeatIds: ['1', '2', '3', '4', '5'],
        });
        if (!match) {
            test.skip(true, 'Game server unavailable for Fantasy Realms 6-player online AI spectator review test.');
        }

        const { context, page, matchId, hostPlayerName, aiPlayerNames } = match!;
        const spectator = await createPlayerContext(browser, baseURL, '__fantasyrealms_online_ai_spectator_review_high_player__');
        const diagnostics = attachPageDiagnostics(page);
        const spectatorDiagnostics = attachPageDiagnostics(spectator.page);

        try {
            await clearEvidenceScreenshotsForTest(testInfo);
            const injectedCore = createOnlineAiNearReviewCore(['0', '1', '2', '3', '4', '5'], '5');
            await injectOnlineAiCore(matchId, page, injectedCore);

            await waitForNearReviewInjectionOrImmediateGameOver({
                matchId,
                page,
                currentPlayer: '5',
                turn: 8,
                discardCount: 9,
                currentHandCount: 8,
                message: '等待 6 人 spectator review 链进入终局前最后一弃代表态，或 AI 已直接完成最后一弃进入终局',
            });

            await expect.poll(async () => {
                const state = await readOnlineAiMatchState(matchId, page);
                return Boolean(state.sys?.gameover);
            }, {
                timeout: 90000,
                message: '等待 6 人注入态里的 seat5 local AI 完成最后一弃并打进终局',
            }).toBe(true);

            const finalState = await readOnlineAiMatchState(matchId, page);
            const finalCore = await readOnlineAiCore(matchId, page);
            const gameOverResult = finalState.sys?.gameover ?? FantasyRealmsDomain.isGameOver?.(finalCore);
            if (!gameOverResult) {
                throw new Error('Expected high-player spectator review online AI game to reach Fantasy Realms gameOver');
            }

            await expect(page.getByText('终局复盘').first()).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('最终排名')).toBeVisible();
            await expect(page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const sortedStandings: FinalStanding[] = Object.entries((gameOverResult as { scores?: Record<string, number> }).scores ?? {})
                .sort((left, right) => right[1] - left[1])
                .map(([playerId, score], index) => ({
                    rank: index + 1,
                    playerName: playerId === '0'
                        ? hostPlayerName
                        : aiPlayerNames[playerId] ?? finalCore.players[playerId]?.name ?? `玩家${Number(playerId) + 1}`,
                    score,
                }));
            await expectFinalStandingsVisible(page, sortedStandings);

            await spectator.page.goto(`/play/${GAME_NAME}/match/${matchId}?spectate=1`, { waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorReviewBoard(spectator.page, matchId);
            await expectFinalStandingsVisible(spectator.page, sortedStandings);

            const spectatorFocusNameBeforeReload = (await spectator.page.locator('.fr-focus-name').textContent())?.trim() ?? '';
            const spectatorFocusAtlasCardIdBeforeReload = await spectator.page.getByTestId('fantasyrealms-focus-preview').getAttribute('data-atlas-card-id') ?? '';
            expect(spectatorFocusNameBeforeReload).not.toBe('');
            expect(spectatorFocusAtlasCardIdBeforeReload).not.toBe('');

            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(spectator.page.getByTestId('fantasyrealms-live-action-button')).toHaveCount(0);

            const spectatorReviewPath = getEvidenceScreenshotPath(testInfo, 'online-ai-six-player-spectator-review-after-gameover');
            await mkdir(dirname(spectatorReviewPath), { recursive: true });
            await spectator.page.screenshot({ path: spectatorReviewPath, fullPage: false });

            await spectator.page.reload({ waitUntil: 'domcontentloaded' });
            await waitForFantasyRealmsSpectatorReviewBoard(spectator.page, matchId);
            await expectFinalStandingsVisible(spectator.page, sortedStandings);
            await expect(spectator.page.locator('.fr-focus-name')).toHaveText(spectatorFocusNameBeforeReload);
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'atlas');
            await expect(spectator.page.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-atlas-card-id', spectatorFocusAtlasCardIdBeforeReload);

            assertNoFatalFrontendErrors([
                { label: 'fantasyrealms-online-ai-six-player-spectator-review-host', diagnostics },
                { label: 'fantasyrealms-online-ai-six-player-spectator-review-page', diagnostics: spectatorDiagnostics },
            ]);
        } finally {
            await spectator.context.close().catch(() => {});
            await context.close().catch(() => {});
        }
    });

});
