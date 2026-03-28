import type { Page } from '@playwright/test';
import { test, expect, type GameTestContext } from './framework';
import { getCardDef } from '../src/games/smashup/data/cards';

const ALIEN_CARD_IDS = ['alien_terraform', 'alien_probe', 'alien_crop_circles'] as const;
const BASES = ['base_the_homeworld', 'base_the_mothership'] as const;
const SMASHUP_OPEN_TIMEOUT_MS = 20_000;
const HAND_VISIBLE_TIMEOUT_MS = 10_000;
const CARD_VISIBLE_TIMEOUT_MS = 5_000;

const ALIEN_CARDS = ALIEN_CARD_IDS.map((defId) => {
    const def = getCardDef(defId);
    if (!def) {
        throw new Error(`Missing card definition: ${defId}`);
    }
    return { defId };
});

interface DispatchCommandHarness {
    command?: {
        dispatch?: (command: {
            type: 'SYS_CHEAT_DEAL_CARD_BY_INDEX';
            payload: { playerId: '0'; deckIndex: number };
        }) => void;
    };
}

async function openAlienDeckScene(game: GameTestContext, page: Page): Promise<void> {
    await game.openTestGame('smashup', {}, SMASHUP_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [],
            deck: [...ALIEN_CARD_IDS],
            discard: [],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
        },
        bases: BASES.map((defId) => ({
            defId,
            minions: [],
            ongoingActions: [],
        })),
        currentPlayer: '0',
        phase: 'playCards',
    });

    await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: HAND_VISIBLE_TIMEOUT_MS });
    await expect.poll(async () => {
        const player = await game.getPlayerState('0');
        return player?.deck?.map((card: { defId: string }) => card.defId) ?? [];
    }).toEqual([...ALIEN_CARD_IDS]);
}

async function findDeckIndex(game: GameTestContext, defId: string): Promise<number> {
    const player = await game.getPlayerState('0');
    return player.deck.findIndex((card: { defId: string }) => card.defId === defId);
}

async function dispatchDealCardByIndex(page: Page, deckIndex: number): Promise<void> {
    await page.evaluate((index) => {
        const harness = (window as Window & { __BG_TEST_HARNESS__?: DispatchCommandHarness }).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) {
            throw new Error('TestHarness command.dispatch is unavailable');
        }

        harness.command.dispatch({
            type: 'SYS_CHEAT_DEAL_CARD_BY_INDEX',
            payload: { playerId: '0', deckIndex: index },
        });
    }, deckIndex);
}

test.describe('SmashUp alien card dispatch', () => {
    test('deals the targeted alien card from the current deck index into hand', async ({ page, game }, testInfo) => {
        await openAlienDeckScene(game, page);

        for (const card of ALIEN_CARDS) {
            const playerBefore = await game.getPlayerState('0');
            const deckIndex = await findDeckIndex(game, card.defId);

            expect(deckIndex, `Card not found in deck: ${card.defId}`).toBeGreaterThanOrEqual(0);

            await dispatchDealCardByIndex(page, deckIndex);

            await expect.poll(async () => {
                const playerAfter = await game.getPlayerState('0');
                const lastHandCard = playerAfter.hand[playerAfter.hand.length - 1];

                return {
                    handLength: playerAfter.hand.length,
                    deckLength: playerAfter.deck.length,
                    lastCardDefId: lastHandCard?.defId ?? null,
                    remainingInDeck: playerAfter.deck.some((entry: { defId: string }) => entry.defId === card.defId),
                };
            }).toEqual({
                handLength: playerBefore.hand.length + 1,
                deckLength: playerBefore.deck.length - 1,
                lastCardDefId: card.defId,
                remainingInDeck: false,
            });

            const currentPlayer = await game.getPlayerState('0');
            const dispatchedCard = currentPlayer.hand.find((entry: { defId: string; uid: string }) => entry.defId === card.defId);
            expect(dispatchedCard, `Card missing from hand after dispatch: ${card.defId}`).toBeTruthy();
            await expect(page.locator(`[data-card-uid="${dispatchedCard.uid}"]`)).toBeVisible({
                timeout: CARD_VISIBLE_TIMEOUT_MS,
            });
        }

        await game.screenshot('alien-card-dispatch-final', testInfo);
    });
});
