/**
 * 大杀四方 - 印斯茅斯“本地人”展示测试
 */

import { join } from 'node:path';
import { test, expect } from '../framework';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
    cleanupTwoPlayerMatch,
    completeFactionSelectionCustom,
    FACTION,
    initContext,
    setupTwoPlayerMatch,
    waitForHandArea,
} from './smashup-helpers';
import { SU_EVENTS } from '../../src/games/smashup/domain/types';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

function normalizeInjectedMatchState(matchId: string, state: any): any {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.core?.turnOrder)
        ? [...next.core.turnOrder]
        : Object.keys(next.core?.players ?? {});
    const currentPlayerIndex = typeof next.sys?.currentPlayerIndex === 'number'
        ? next.sys.currentPlayerIndex
        : typeof next.core?.currentPlayerIndex === 'number'
            ? next.core.currentPlayerIndex
            : 0;

    next.sys = {
        ...next.sys,
        matchId,
        turnOrder: Array.isArray(next.sys?.turnOrder) ? next.sys.turnOrder : fallbackTurnOrder,
        currentPlayerIndex,
        phase: typeof next.sys?.phase === 'string' ? next.sys.phase : next.core?.phase,
    };
    next.core = {
        ...next.core,
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex,
        phase: typeof next.core?.phase === 'string' ? next.core.phase : next.sys.phase,
    };
    return next;
}

async function injectInnsmouthRevealScene(matchId: string, page: any, deck: string[]): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const nextState = normalizeInjectedMatchState(matchId, {
        ...currentState,
        core: {
            ...currentState.core,
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            players: {
                ...currentState.core.players,
                '0': {
                    ...currentState.core.players['0'],
                    hand: [{ uid: 'h1', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' }],
                    deck: deck.map((defId: string, index: number) => ({ uid: `deck-${index + 1}`, defId, type: 'minion', owner: '0' })),
                    discard: [],
                    factions: ['innsmouth', 'aliens'],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
                '1': {
                    ...currentState.core.players['1'],
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: ['pirates', 'dinosaurs'],
                },
            },
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
        },
        sys: {
            ...currentState.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    });
    await injectMatchState(matchId, nextState, page);
}

async function injectInnsmouthHomeworldChainScene(matchId: string, page: any): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const nextState = normalizeInjectedMatchState(matchId, {
        ...currentState,
        core: {
            ...currentState.core,
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            players: {
                ...currentState.core.players,
                '0': {
                    ...currentState.core.players['0'],
                    hand: [
                        { uid: 'h-local-1', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
                        { uid: 'h-big-1', defId: 'alien_invader', type: 'minion', owner: '0' },
                    ],
                    deck: [
                        { uid: 'deck-local-1', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
                        { uid: 'deck-scout-1', defId: 'aliens_scout', type: 'minion', owner: '0' },
                        { uid: 'deck-local-2', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
                    ],
                    discard: [],
                    factions: ['innsmouth', 'aliens'],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayedPerBase: undefined,
                    baseLimitedMinionQuota: undefined,
                    baseLimitedMinionPowerCaps: undefined,
                    baseLimitedSameNameRequired: undefined,
                    baseLimitedSameNameDefId: undefined,
                    sameNameMinionRemaining: undefined,
                    sameNameMinionDefId: undefined,
                    extraMinionPowerCaps: undefined,
                    extraMinionPowerMax: undefined,
                },
                '1': {
                    ...currentState.core.players['1'],
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: ['pirates', 'dinosaurs'],
                },
            },
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
        },
        sys: {
            ...currentState.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    });
    await injectMatchState(matchId, nextState, page);
}

async function injectPrivateRevealVisibilityScene(matchId: string, page: any): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const existingEntries = Array.isArray(currentState.sys?.eventStream?.entries)
        ? currentState.sys.eventStream.entries
        : [];
    const nextId = typeof currentState.sys?.eventStream?.nextId === 'number'
        ? currentState.sys.eventStream.nextId
        : existingEntries.length + 1;

    const nextState = normalizeInjectedMatchState(matchId, {
        ...currentState,
        sys: {
            ...currentState.sys,
            eventStream: {
                ...(currentState.sys?.eventStream ?? {}),
                entries: [
                    ...existingEntries,
                    {
                        id: nextId,
                        event: {
                            type: SU_EVENTS.REVEAL_HAND,
                            payload: {
                                targetPlayerId: '1',
                                viewerPlayerId: '1',
                                cards: [{ uid: 'private-reveal-1', defId: 'pirate_first_mate' }],
                                reason: 'private_reveal_visibility_regression',
                            },
                            timestamp: Date.now(),
                        },
                    },
                ],
                nextId: nextId + 1,
            },
        },
    });

    await injectMatchState(matchId, nextState, page);
}

async function withOnlineMatch(browser: any, baseURL: string | undefined, run: (setup: any) => Promise<void>): Promise<void> {
    const setup = await setupTwoPlayerMatch(browser, baseURL, { skipImageGate: true });
    if (!setup) {
        test.skip(true, '游戏服务器不可用或创建房间失败');
        return;
    }

    try {
        await completeFactionSelectionCustom(
            setup.hostPage,
            setup.guestPage,
            [FACTION.INNSMOUTH, FACTION.ALIENS],
            [FACTION.PIRATES, FACTION.DINOSAURS],
        );
        await waitForHandArea(setup.hostPage);
        await waitForHandArea(setup.guestPage);
        await run(setup);
    } finally {
        await cleanupTwoPlayerMatch(setup);
    }
}

async function dismissRevealOverlay(page: any): Promise<void> {
    const overlay = page.getByTestId('reveal-overlay');
    await page.getByTestId('reveal-dismiss-btn').click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 3000 });
}

test.describe('印斯茅斯“本地人”展示功能', () => {
    test('打出“本地人”后，两个玩家都能看到展示 UI', async ({ browser }, testInfo) => {
        await withOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, async ({ hostPage, guestPage, matchId }) => {
            await injectInnsmouthRevealScene(matchId, hostPage, [
                'innsmouth_the_locals',
                'aliens_scout',
                'innsmouth_the_locals',
            ]);

            await hostPage.click('[data-card-uid="h1"]');
            await hostPage.click('[data-base-index="0"]');

            await Promise.all([
                expect(hostPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
                expect(guestPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
            ]);
            await expect(hostPage.locator('[data-testid="reveal-overlay"] [data-testid="reveal-card"]')).toHaveCount(3);
            await expect(guestPage.locator('[data-testid="reveal-overlay"] [data-testid="reveal-card"]')).toHaveCount(3);

            await Promise.all([
                dismissRevealOverlay(hostPage),
                dismissRevealOverlay(guestPage),
            ]);

            const finalState = await getMatchState(matchId, hostPage);
            const handLocals = finalState.core.players['0'].hand.filter((card: any) => card.defId === 'innsmouth_the_locals').length;
            const baseLocals = finalState.core.bases[0].minions.filter((minion: any) => minion.defId === 'innsmouth_the_locals' && minion.controller === '0').length;
            expect(handLocals + baseLocals).toBe(3);
        });
    });

    test('牌库顶没有同名卡时，展示后全部放牌库底', async ({ browser }, testInfo) => {
        await withOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, async ({ hostPage, guestPage, matchId }) => {
            await injectInnsmouthRevealScene(matchId, hostPage, [
                'aliens_scout',
                'aliens_invader',
                'aliens_supreme_overlord',
            ]);

            await hostPage.click('[data-card-uid="h1"]');
            await hostPage.click('[data-base-index="0"]');

            await Promise.all([
                expect(hostPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
                expect(guestPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
            ]);
            await expect(hostPage.locator('[data-testid="reveal-overlay"] [data-testid="reveal-card"]')).toHaveCount(3);

            await dismissRevealOverlay(hostPage);

            const finalState = await getMatchState(matchId, hostPage);
            const handLocals = finalState.core.players['0'].hand.filter((card: any) => card.defId === 'innsmouth_the_locals').length;
            const baseLocals = finalState.core.bases[0].minions.filter((minion: any) => minion.defId === 'innsmouth_the_locals' && minion.controller === '0').length;
            expect(handLocals).toBe(0);
            expect(baseLocals).toBe(1);
        });
    });

    test('本地人打到家园后只能有限连打低战力随从，不能继续打 3 力随从', async ({ browser }, testInfo) => {
        await withOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, async ({ hostPage, guestPage, matchId }) => {
            const sharedDir = join(process.cwd(), 'test-results', 'evidence-screenshots', '_shared');

            await injectInnsmouthHomeworldChainScene(matchId, hostPage);

            await hostPage.click('[data-card-uid="h-local-1"]');
            await hostPage.click('[data-base-index="0"]');
            await Promise.all([
                expect(hostPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
                expect(guestPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
            ]);
            await hostPage.screenshot({
                path: join(sharedDir, 'smashup-homeworld-locals-chain-step1-first-reveal.png'),
                fullPage: false,
            });
            await Promise.all([
                dismissRevealOverlay(hostPage),
                dismissRevealOverlay(guestPage),
            ]);

            const afterFirstPlay = await getMatchState(matchId, hostPage);
            const firstBonusLocalsUids = afterFirstPlay.core.players['0'].hand
                .filter((card: any) => card.defId === 'innsmouth_the_locals')
                .map((card: any) => card.uid);
            expect(firstBonusLocalsUids).toHaveLength(2);
            expect(afterFirstPlay.core.players['0'].minionsPlayed).toBe(1);
            expect(afterFirstPlay.core.players['0'].minionLimit).toBe(2);
            expect(afterFirstPlay.core.players['0'].extraMinionPowerMax).toBe(2);

            await hostPage.click(`[data-card-uid="${firstBonusLocalsUids[0]}"]`);
            await hostPage.click('[data-base-index="0"]');
            await Promise.all([
                expect(hostPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
                expect(guestPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
            ]);
            await hostPage.screenshot({
                path: join(sharedDir, 'smashup-homeworld-locals-chain-step2-second-reveal.png'),
                fullPage: false,
            });
            await Promise.all([
                dismissRevealOverlay(hostPage),
                dismissRevealOverlay(guestPage),
            ]);

            const afterSecondPlay = await getMatchState(matchId, hostPage);
            const remainingLocalUid = afterSecondPlay.core.players['0'].hand.find(
                (card: any) => card.defId === 'innsmouth_the_locals',
            )?.uid;
            expect(remainingLocalUid).toBeTruthy();
            expect(afterSecondPlay.core.players['0'].minionsPlayed).toBe(2);
            expect(afterSecondPlay.core.players['0'].minionLimit).toBe(3);
            expect(afterSecondPlay.core.players['0'].extraMinionPowerMax).toBe(2);

            await hostPage.click(`[data-card-uid="${remainingLocalUid}"]`);
            await hostPage.click('[data-base-index="0"]');
            await Promise.all([
                expect(hostPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
                expect(guestPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 }),
            ]);
            await hostPage.screenshot({
                path: join(sharedDir, 'smashup-homeworld-locals-chain-step3-third-reveal.png'),
                fullPage: false,
            });
            await Promise.all([
                dismissRevealOverlay(hostPage),
                dismissRevealOverlay(guestPage),
            ]);

            const beforeBigMinionAttempt = await getMatchState(matchId, hostPage);
            expect(beforeBigMinionAttempt.core.players['0'].hand.some((card: any) => card.uid === 'h-big-1')).toBe(true);
            expect(beforeBigMinionAttempt.core.players['0'].hand.some((card: any) => card.defId === 'innsmouth_the_locals')).toBe(false);
            expect(beforeBigMinionAttempt.core.players['0'].minionsPlayed).toBe(3);
            expect(beforeBigMinionAttempt.core.players['0'].minionLimit).toBe(4);
            expect(beforeBigMinionAttempt.core.players['0'].extraMinionPowerMax).toBe(2);

            await hostPage.click('[data-card-uid="h-big-1"]');
            await hostPage.click('[data-base-index="1"]');
            await hostPage.waitForTimeout(500);
            await hostPage.screenshot({
                path: join(sharedDir, 'smashup-homeworld-locals-chain-step4-big-minion-blocked.png'),
                fullPage: false,
            });

            const afterBigMinionAttempt = await getMatchState(matchId, hostPage);
            expect(afterBigMinionAttempt.core.players['0'].hand.some((card: any) => card.uid === 'h-big-1')).toBe(true);
            expect(afterBigMinionAttempt.core.players['0'].minionsPlayed).toBe(3);
            expect(afterBigMinionAttempt.core.bases[0].minions.filter((minion: any) => minion.controller === '0')).toHaveLength(3);
            expect(afterBigMinionAttempt.core.players['0'].extraMinionPowerMax).toBe(2);
        });
    });

    test('私有展示只应显示给归属玩家，旁观页不应误判为 0 号位', async ({ browser }, testInfo) => {
        await withOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, async ({ hostPage, guestPage, matchId }) => {
            const spectatorContext = await initContext(await browser.newContext());
            const spectatorPage = await spectatorContext.newPage();
            const sharedDir = join(process.cwd(), 'test-results', 'evidence-screenshots', '_shared');

            try {
                await spectatorPage.goto(`/play/smashup/match/${matchId}`, { waitUntil: 'domcontentloaded' });
                await waitForHandArea(spectatorPage);

                await injectPrivateRevealVisibilityScene(matchId, hostPage);

                await expect(guestPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 });
                await expect(guestPage.locator('[data-testid="reveal-overlay"] [data-testid="reveal-card"]')).toHaveCount(1);
                await expect(hostPage.locator('[data-testid="reveal-overlay"]')).toHaveCount(0);
                await expect(spectatorPage.locator('[data-testid="reveal-overlay"]')).toHaveCount(0);

                await guestPage.screenshot({
                    path: join(sharedDir, 'smashup-feedback-69a435761eb921c6091f113b-guest-private-reveal-visible.png'),
                    fullPage: false,
                });
                await hostPage.screenshot({
                    path: join(sharedDir, 'smashup-feedback-69a435761eb921c6091f113b-host-private-reveal-hidden.png'),
                    fullPage: false,
                });
                await spectatorPage.screenshot({
                    path: join(sharedDir, 'smashup-feedback-69a435761eb921c6091f113b-spectator-private-reveal-hidden.png'),
                    fullPage: false,
                });
            } finally {
                await spectatorContext.close();
            }
        });
    });
});
