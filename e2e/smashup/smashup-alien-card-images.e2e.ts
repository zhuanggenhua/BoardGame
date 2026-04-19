import type { Page } from '@playwright/test';
import { test, expect, type GameTestContext } from '../framework';
import { computeSpriteStyle, generateUniformAtlasConfig } from '../src/engine/primitives/spriteAtlas';
import { getCardDef } from '../src/games/smashup/data/cards';
import { SMASHUP_ATLAS_DEFINITIONS } from '../src/games/smashup/domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS } from '../src/games/smashup/domain/ids';

const ALIEN_CARD_IDS = ['alien_probe', 'alien_terraform', 'alien_crop_circles'] as const;
const BASES = ['base_the_homeworld', 'base_the_mothership'] as const;
const SMASHUP_OPEN_TIMEOUT_MS = 20_000;
const HAND_VISIBLE_TIMEOUT_MS = 10_000;
const CARD_VISIBLE_TIMEOUT_MS = 5_000;
const STYLE_POLL_TIMEOUT_MS = 5_000;

const cards1Atlas = SMASHUP_ATLAS_DEFINITIONS.find((atlas) => atlas.id === SMASHUP_ATLAS_IDS.CARDS1);
if (!cards1Atlas) {
    throw new Error('Missing SmashUp cards1 atlas definition');
}

const cards1UniformConfig = generateUniformAtlasConfig(
    cards1Atlas.grid.cols,
    cards1Atlas.grid.rows,
    cards1Atlas.grid.rows,
    cards1Atlas.grid.cols,
);

const ALIEN_CARDS = ALIEN_CARD_IDS.map((defId) => {
    const def = getCardDef(defId);
    if (!def) {
        throw new Error(`Missing card definition: ${defId}`);
    }
    if (!def.previewRef || def.previewRef.type !== 'atlas') {
        throw new Error(`Card ${defId} is missing an atlas previewRef`);
    }

    return {
        defId,
        name: def.name,
        expectedStyle: computeSpriteStyle(def.previewRef.index, cards1UniformConfig),
    };
});

function parsePercentPair(value: string): [number, number] {
    const matches = value.match(/-?\d+(?:\.\d+)?/g);
    if (!matches || matches.length < 2) {
        throw new Error(`Unable to parse percent pair: ${value}`);
    }
    return [Number(matches[0]), Number(matches[1])];
}

function expectPercentPair(actual: string, expected: string, label: string): void {
    const [actualX, actualY] = parsePercentPair(actual);
    const [expectedX, expectedY] = parsePercentPair(expected);

    expect(actualX, `${label} X mismatch`).toBeCloseTo(expectedX, 4);
    expect(actualY, `${label} Y mismatch`).toBeCloseTo(expectedY, 4);
}

async function readRenderedAtlasStyle(page: Page, cardUid: string): Promise<{
    backgroundImage: string;
    backgroundPosition: string;
    backgroundSize: string;
} | null> {
    return page.locator(`[data-card-uid="${cardUid}"]`).evaluate((root) => {
        const atlasNode = root.querySelector('[style*="background-image"]') as HTMLElement | null;
        if (!atlasNode) {
            return null;
        }

        return {
            backgroundImage: atlasNode.style.backgroundImage,
            backgroundPosition: atlasNode.style.backgroundPosition,
            backgroundSize: atlasNode.style.backgroundSize,
        };
    });
}

async function openAlienHandScene(game: GameTestContext, page: Page): Promise<void> {
    await game.openTestGame('smashup', {}, SMASHUP_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [...ALIEN_CARD_IDS],
            deck: [],
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
        return player?.hand?.map((card: { defId: string }) => card.defId) ?? [];
    }).toEqual([...ALIEN_CARD_IDS]);
}

test.describe('SmashUp alien card images', () => {
    test('renders the expected atlas slices for key alien actions', async ({ page, game }, testInfo) => {
        await openAlienHandScene(game, page);

        const player = await game.getPlayerState('0');

        for (const card of ALIEN_CARDS) {
            const handCard = player.hand.find((entry: { defId: string; uid: string }) => entry.defId === card.defId);
            expect(handCard, `Card missing from hand: ${card.defId}`).toBeTruthy();
            const cardLocator = page.locator(`[data-card-uid="${handCard.uid}"]`);
            await expect(cardLocator).toBeVisible({ timeout: CARD_VISIBLE_TIMEOUT_MS });

            await expect.poll(
                () => readRenderedAtlasStyle(page, handCard.uid),
                {
                    timeout: STYLE_POLL_TIMEOUT_MS,
                },
            ).not.toBeNull();

            const rendered = await readRenderedAtlasStyle(page, handCard.uid);
            if (!rendered) {
                throw new Error(`Atlas node missing for ${card.defId}`);
            }
            expect(rendered.backgroundImage).toContain('cards1');

            expectPercentPair(
                rendered.backgroundPosition,
                String(card.expectedStyle.backgroundPosition),
                `${card.name} backgroundPosition`,
            );
            expectPercentPair(
                rendered.backgroundSize,
                String(card.expectedStyle.backgroundSize),
                `${card.name} backgroundSize`,
            );
        }

        await game.screenshot('alien-card-images-hand', testInfo);
    });
});
