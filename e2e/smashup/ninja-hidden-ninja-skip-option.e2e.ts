import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import type { Page } from '@playwright/test';
import { initAllAbilities } from '../../src/games/smashup/abilities/index.ts';
import {
    advanceSmashUpReactionSession,
    startSmashUpReactionSession,
} from '../../src/games/smashup/domain/reactionSession.ts';
import {
    createScoringBaseRef,
    createScoringSession,
    setScoringSession,
} from '../../src/games/smashup/domain/scoringSession.ts';

const FIXED_SMASHUP_RANDOM = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function getPlayer(state: any, playerId: '0' | '1') {
    return state.core.players[playerId];
}

async function openHiddenNinjaGame(game: GameTestContext): Promise<void> {
    await game.openTestGame('smashup');
}

async function setHarnessState(page: Page, nextState: any): Promise<void> {
    await page.evaluate(async (state) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.state?.set) {
            throw new Error('TestHarness state.set 不可用');
        }
        await harness.state.set(state);
    }, nextState);
    await page.waitForTimeout(500);
}

function createHiddenNinjaReactionChooseState(baseState: any, frameId: string): any {
    initAllAbilities();

    let state = {
        ...baseState,
        core: {
            ...baseState.core,
            scoringEligibleBaseIndices: [0],
            triggerQueue: baseState.core?.triggerQueue ?? [],
        },
        sys: {
            ...baseState.sys,
            phase: 'scoreBases',
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
    };

    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
        throw new Error('无法构造便衣忍者计分基地引用');
    }

    state = setScoringSession(state, {
        ...createScoringSession(state.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    state = startSmashUpReactionSession(state, {
        frameId,
        frameKind: 'score-before',
        phase: 'optional',
        currentPlayerId: '0',
        activePlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'meFirst',
    });

    return advanceSmashUpReactionSession(state, FIXED_SMASHUP_RANDOM as any, 1)?.state ?? state;
}

async function playHiddenNinjaFromReactionHand(page: Page, game: GameTestContext): Promise<void> {
    const hiddenNinjaCard = page.locator('[data-testid="su-hand-area"] [data-card-uid="hand-hidden-ninja"]');
    await expect(hiddenNinjaCard).toBeVisible({ timeout: 10000 });
    await hiddenNinjaCard.click({ force: true });
    await game.selectBase(0);
}

async function setupHiddenNinjaMeFirstScene(
    page: Page,
    game: GameTestContext,
    options?: {
        hand?: Array<{ uid: string; defId: string; type: 'action' | 'minion' }>;
        deck?: Array<{ uid: string; defId: string; type: 'action' | 'minion' }>;
        baseMinions?: Array<{ uid: string; defId: string; owner: '0' | '1'; controller: '0' | '1'; basePower: number }>;
    },
): Promise<void> {
    const hand = options?.hand ?? [
        { uid: 'hand-hidden-ninja', defId: 'ninja_hidden_ninja', type: 'action' },
        { uid: 'hand-acolyte-a', defId: 'ninja_acolyte', type: 'minion' },
        { uid: 'hand-acolyte-b', defId: 'ninja_acolyte', type: 'minion' },
    ];
    const deck = options?.deck ?? [
        { uid: 'deck-buffer-a', defId: 'pirate_first_mate', type: 'minion' },
        { uid: 'deck-buffer-b', defId: 'pirate_buccaneer', type: 'minion' },
    ];

    const baseMinions = options?.baseMinions ?? [
        { uid: 'base-buccaneer-a', defId: 'pirate_buccaneer', owner: '0', controller: '0', basePower: 4 },
        { uid: 'base-buccaneer-b', defId: 'pirate_buccaneer', owner: '0', controller: '0', basePower: 4 },
    ];
    const frameId = 'score-before:hidden-ninja-me-first';

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand,
            deck,
            field: baseMinions.map((minion) => ({
                ...minion,
                baseIndex: 0,
            })),
            factions: ['ninjas', 'pirates'],
        },
        player1: {
            hand: [],
            field: [],
            factions: ['robots', 'aliens'],
        },
        bases: [
            {
                defId: 'base_tortuga',
                breakpoint: 8,
                minions: [],
            },
        ],
        currentPlayer: '0',
        phase: 'scoreBases',
    });

    const baseState = await game.getState();
    await setHarnessState(page, createHiddenNinjaReactionChooseState(baseState, frameId));

    await expect.poll(async () => {
        const state = await game.getState();
        const session = state.sys.resolution?.frames?.find((frame: any) => frame.id === frameId)
            ?.metadata?.smashupReactionSession;
        return {
            phase: state.sys.phase,
            interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
            responseWindow: session?.responseWindowType ?? null,
            currentResponder: session?.activePlayerId ?? null,
            hand: getPlayer(state, '0').hand.map((card: any) => card.defId),
            base0Minions: state.core.bases[0].minions.length,
        };
    }).toEqual({
        phase: 'scoreBases',
        interactionSource: 'smashup_reaction_choose',
        responseWindow: 'meFirst',
        currentResponder: '0',
        hand: hand.map((card) => card.defId),
        base0Minions: baseMinions.length,
    });
}

test.describe('便衣忍者跳过与手牌选择', () => {
    test('便衣忍者交互应允许跳过且不额外打出随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await openHiddenNinjaGame(game);
        await setupHiddenNinjaMeFirstScene(page, game);
        await page.waitForTimeout(2000);

        await playHiddenNinjaFromReactionHand(page, game);
        await game.waitForInteraction('ninja_hidden_ninja');

        const hiddenNinjaSkipButton = page.getByRole('button', { name: /^(跳过|Skip)(?:\s*\(\d+\))?$/i }).first();
        await expect(hiddenNinjaSkipButton).toBeVisible();
        await game.screenshot('hidden-ninja-skip-prompt', testInfo);

        await hiddenNinjaSkipButton.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys.interaction?.current?.data?.sourceId ?? null;
        }).not.toBe('ninja_hidden_ninja');

        const finalState = await game.getState();
        const base0Minions = finalState.core.bases[0].minions;
        const player0 = getPlayer(finalState, '0');
        const player0HandDefIds = player0.hand.map((card: any) => card.defId);

        expect(base0Minions).toHaveLength(2);
        expect(base0Minions.some((minion: any) => minion.defId === 'ninja_acolyte')).toBe(false);
        expect(player0HandDefIds).not.toContain('ninja_hidden_ninja');
        expect(player0HandDefIds).toEqual(expect.arrayContaining(['ninja_acolyte', 'pirate_first_mate', 'pirate_buccaneer']));
        expect(player0.discard.map((card: any) => card.defId)).toContain('ninja_hidden_ninja');

        await game.screenshot('hidden-ninja-skip-after', testInfo);
    });

    test('便衣忍者交互应允许从手牌打出随从到计分基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await openHiddenNinjaGame(game);
        await setupHiddenNinjaMeFirstScene(page, game, {
            hand: [
                { uid: 'hand-hidden-ninja', defId: 'ninja_hidden_ninja', type: 'action' },
                { uid: 'hand-acolyte-a', defId: 'ninja_acolyte', type: 'minion' },
            ],
        });
        await page.waitForTimeout(2000);

        await playHiddenNinjaFromReactionHand(page, game);
        await game.waitForInteraction('ninja_hidden_ninja');
        await game.screenshot('hidden-ninja-play-prompt', testInfo);

        const acolyteCard = page.locator('[data-testid="su-hand-area"] [data-card-uid="hand-acolyte-a"]');
        await expect(acolyteCard).toBeVisible({ timeout: 10000 });
        await acolyteCard.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            return state.sys.interaction?.current?.data?.sourceId ?? null;
        }).not.toBe('ninja_hidden_ninja');

        const finalState = await game.getState();
        const player0 = getPlayer(finalState, '0');
        const base0Minions = finalState.core.bases[0].minions;
        const player0HandDefIds = player0.hand.map((card: any) => card.defId);

        expect(base0Minions).toHaveLength(3);
        expect(base0Minions.some((minion: any) => minion.defId === 'ninja_acolyte')).toBe(true);
        expect(player0HandDefIds).not.toContain('ninja_hidden_ninja');
        expect(player0HandDefIds).toContain('pirate_first_mate');
        expect(player0HandDefIds).toContain('pirate_buccaneer');
        expect(player0.discard.map((card: any) => card.defId)).toContain('ninja_hidden_ninja');
        expect(player0.minionsPlayed).toBe(0);

        await game.screenshot('hidden-ninja-play-after', testInfo);
    });
});
