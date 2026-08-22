import { test, expect } from '../framework';
import { hideSmashUpDebugPanelForEvidence } from '../helpers/smashup';
import type { Page } from '@playwright/test';

type InteractionOption = {
    id?: string;
    value?: {
        cardUid?: string;
        defId?: string;
    };
};

type SmashUpCardSnapshot = {
    uid: string;
    defId: string;
};

type SmashUpHarnessState = {
    sys?: {
        interaction?: {
            current?: unknown;
        };
    };
    core: {
        players: Record<string, {
            hand: SmashUpCardSnapshot[];
            deck: SmashUpCardSnapshot[];
            discard: SmashUpCardSnapshot[];
        }>;
    };
};

async function waitForCardArtwork(page: Page): Promise<void> {
    await expect.poll(async () => page.evaluate(() => {
        const previews = Array.from(document.querySelectorAll<HTMLElement>('[data-card-atlas-frame="true"], .atlas-shimmer'));
        const loaded = previews.filter(preview => {
            if (preview.classList.contains('atlas-shimmer')) return false;
            const image = preview.querySelector<HTMLImageElement>('img[data-card-atlas-img="true"]');
            return !!image && image.complete && image.naturalWidth > 0;
        });
        return {
            ready: previews.length > 0 && loaded.length === previews.length,
            total: previews.length,
            loaded: loaded.length,
            shimmering: previews.filter(preview => preview.classList.contains('atlas-shimmer')).length,
        };
    }), { timeout: 30000, polling: 250 }).toEqual(expect.objectContaining({
        ready: true,
        total: expect.any(Number),
        loaded: expect.any(Number),
        shimmering: 0,
    }));
}

test.describe('SmashUp - 复仇者选择语义', () => {
    test('J.A.R.V.I.S. 只有一张可弃手牌时也必须等待玩家选择，不自动弃牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', {
            p0: 'avengers,pirates',
            p1: 'ninjas,aliens',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['avengers', 'pirates'],
                hand: [],
                deck: [
                    { uid: 'only-card', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['ninjas', 'aliens'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_the_mothership',
                    minions: [],
                    ongoingActions: [
                        { uid: 'jarvis-live', defId: 'avengers_jarvis', ownerId: '0', talentUsed: false },
                    ],
                },
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
            ],
        });

        const jarvisCard = page.locator('[data-ongoing-uid="jarvis-live"]').first();
        await expect(jarvisCard).toBeVisible({ timeout: 15000 });
        await waitForCardArtwork(page);
        await hideSmashUpDebugPanelForEvidence(page);
        await game.screenshot('01-JARVIS-天赋触发前只有一张牌可弃', testInfo);

        await jarvisCard.click({ force: true });
        await game.waitForInteraction('avengers_jarvis', 10000);
        await expect(page.getByText(/贾维斯|J\.A\.R\.V\.I\.S\./)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/弃掉一张牌|discard one card/i)).toBeVisible({ timeout: 10000 });

        const options = await game.getInteractionOptions() as InteractionOption[];
        expect(options.map(option => option.value?.cardUid)).toEqual(['only-card']);
        const beforeChoice = await game.getState() as SmashUpHarnessState;
        expect(beforeChoice.core.players['0'].hand.map(card => card.uid)).toEqual(['only-card']);
        expect(beforeChoice.core.players['0'].deck.map(card => card.uid)).toEqual([]);
        expect(beforeChoice.core.players['0'].discard.map(card => card.uid)).toEqual([]);
        await game.screenshot('02-JARVIS-单张可弃手牌仍停在选择界面', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.cardUid === 'only-card',
            '贾维斯选择唯一可弃手牌',
        );
        await game.waitForNoInteraction(10000);

        const afterChoice = await game.getState() as SmashUpHarnessState;
        expect(afterChoice.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(afterChoice.core.players['0'].discard.map(card => card.uid)).toEqual(['only-card']);
        expect(Boolean(afterChoice.sys?.interaction?.current)).toBe(false);
        await game.screenshot('03-JARVIS-玩家选择后才弃掉手牌', testInfo);
    });
});
