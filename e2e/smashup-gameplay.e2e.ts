import { test, expect } from './framework';

const SMASHUP_GAMEPLAY_QUERY = {
    p0: 'aliens,pirates',
    p1: 'ninjas,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

const NINJA_DIRECT_CLICK_QUERY = {
    p0: 'ninjas,pirates',
    p1: 'robots,zombies',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 67890,
};

test.describe('SmashUp - 核心流程与交互稳定性', () => {
    test('主流程：打出随从到基地后结束回合，应切到对手的出牌阶段', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', SMASHUP_GAMEPLAY_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-pirate-first-mate', defId: 'pirate_first_mate', type: 'minion' },
                    { uid: 'hand-alien-scout', defId: 'alien_scout', type: 'minion' },
                ],
                factions: ['aliens', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [
                    { uid: 'opponent-hand-ninja-shinobi', defId: 'ninja_shinobi', type: 'minion' },
                ],
                factions: ['ninjas', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_the_homeworld' },
                { defId: 'base_the_mothership' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const handArea = page.getByTestId('su-hand-area');
        await expect(handArea.locator('[data-card-uid="hand-pirate-first-mate"]')).toBeVisible();
        await expect(page.locator('[data-base-index="0"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i })).toBeVisible();

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await page.waitForFunction(
            (cardUid) => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === cardUid) === true;
            },
            'hand-pirate-first-mate',
            { timeout: 5000, polling: 200 },
        );

        await expect(handArea.locator('[data-card-uid="hand-pirate-first-mate"]')).toHaveCount(0);
        await expect(page.locator('[data-minion-uid="hand-pirate-first-mate"]')).toBeVisible();
        const stateAfterPlay = await game.getState();
        expect(stateAfterPlay.core.bases[0]?.defId).toBe('base_the_homeworld');
        expect(stateAfterPlay.core.bases[0]?.minions?.some((minion: any) => minion.uid === 'hand-pirate-first-mate')).toBe(true);
        await game.screenshot('main-flow-after-play-minion', testInfo);

        await game.advancePhase();
        await game.waitForCurrentPlayer('1', 10000);
        await game.waitForPhase('playCards', 10000);

        const currentPlayerId = await game.getCurrentPlayerId();
        expect(currentPlayerId).toBe('1');

        const player0 = await game.getPlayerState('0');
        expect(player0.hand.some((card: any) => card.uid === 'hand-alien-scout')).toBe(true);

        await game.screenshot('main-flow-next-player-turn', testInfo);
    });

    test('交互稳定性：ninja_acolyte_play 应直点手牌，不应退化成 PromptOverlay 卡牌面板', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', NINJA_DIRECT_CLICK_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-shinobi', defId: 'ninja_shinobi', type: 'minion' },
                    { uid: 'hand-first-mate', defId: 'pirate_first_mate', type: 'minion' },
                ],
                field: [
                    { uid: 'acolyte-direct', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                ],
                factions: ['ninjas', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'zombies'],
            },
            bases: [
                { defId: 'base_the_mothership' },
                { defId: 'base_tortuga' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await expect(page.locator('[data-minion-uid="acolyte-direct"]')).toBeVisible();

        await page.locator('[data-minion-uid="acolyte-direct"]').click({ force: true });
        await game.waitForInteraction('ninja_acolyte_play', 10000);

        await expect(page.locator('[data-card-uid="hand-shinobi"]')).toBeVisible();
        await expect(page.getByTestId('prompt-card-0')).not.toBeVisible();
        await game.screenshot('ninja-acolyte-hand-direct-click', testInfo);

        await page.click('[data-card-uid="hand-shinobi"]');
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) =>
            minion.defId === 'ninja_shinobi' && minion.owner === '0'
        )).toBe(true);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'acolyte-direct')).toBe(false);
        expect(finalState.core.players['0'].hand.some((card: any) => card.uid === 'acolyte-direct')).toBe(true);
        expect(finalState.core.players['0'].minionsPlayed).toBe(0);

        await game.screenshot('ninja-acolyte-after-direct-click', testInfo);
    });
});
