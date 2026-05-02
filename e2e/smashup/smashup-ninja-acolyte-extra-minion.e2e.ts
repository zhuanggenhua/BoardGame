/**
 * 忍者侍从 - 额外随从 E2E 测试
 */

import { test, expect } from '../framework';

async function openScene(game: any): Promise<void> {
    await game.openTestGame('smashup');
}

test.describe('忍者侍从 - 额外随从', () => {
    test('应该授予基地限定随从额度并允许打出额外随从', async ({ page, game }, testInfo) => {
        await openScene(game);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_shinobi', 'pirate_first_mate'],
                field: [
                    { uid: 'acolyte-test', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                ],
            },
            player1: { hand: [], deck: [] },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_the_homeworld' },
            ],
        });

        await expect(page.locator('[data-minion-uid="acolyte-test"]')).toBeVisible();
        await page.locator('[data-minion-uid="acolyte-test"]').click({ force: true });
        await game.waitForInteraction('ninja_acolyte_play');
        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'ninja_shinobi',
            '选择影舞者',
        );
        await game.waitForNoInteraction();
        await game.screenshot('ninja-acolyte-play-extra-minion', testInfo);

        const state = await game.getState();
        expect(state.core.players['0'].hand.some((card: any) => card.defId === 'ninja_acolyte')).toBe(true);
        expect(state.core.bases[0].minions.some((minion: any) => minion.defId === 'ninja_shinobi')).toBe(true);
        expect(state.core.players['0'].minionsPlayed).toBe(0);
        expect(state.core.players['0'].baseLimitedMinionQuota?.[0]).toBeUndefined();
    });

    test('应该允许选择跳过', async ({ page, game }, testInfo) => {
        await openScene(game);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_shinobi'],
                field: [
                    { uid: 'acolyte-test', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                ],
            },
            player1: { hand: [], deck: [] },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_the_homeworld' },
            ],
        });

        await expect(page.locator('[data-minion-uid="acolyte-test"]')).toBeVisible();
        await page.locator('[data-minion-uid="acolyte-test"]').click({ force: true });
        await game.waitForInteraction('ninja_acolyte_play');
        await game.selectOption('skip');
        await game.waitForNoInteraction();
        await game.screenshot('ninja-acolyte-skip', testInfo);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.some((card: any) => card.defId === 'ninja_acolyte')).toBe(true);
        expect(finalState.core.bases[0].minions.every((minion: any) => minion.defId !== 'ninja_shinobi')).toBe(true);
        expect(finalState.core.players['0'].minionsPlayed).toBe(0);
    });

    test('本回合已打出随从时应该无法使用', async ({ page, game }, testInfo) => {
        await openScene(game);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_shinobi'],
                minionsPlayed: 1,
                field: [
                    { uid: 'acolyte-test', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                    { uid: 'mate-test', defId: 'pirate_first_mate', baseIndex: 0, owner: '0', controller: '0', power: 3 },
                ],
            },
            player1: { hand: [], deck: [] },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_the_homeworld' },
            ],
        });

        await expect(page.locator('[data-minion-uid="acolyte-test"]')).toBeVisible();
        await page.locator('[data-minion-uid="acolyte-test"]').click({ force: true });
        await page.waitForTimeout(500);
        const state = await game.getState();
        expect(state.sys.interaction?.current).toBeUndefined();
        await game.screenshot('ninja-acolyte-disabled-after-minion', testInfo);
    });

    test('同一基地不能使用两次', async ({ page, game }, testInfo) => {
        await openScene(game);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_shinobi', 'pirate_first_mate'],
                field: [
                    { uid: 'acolyte-1', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                    { uid: 'acolyte-2', defId: 'ninja_acolyte', baseIndex: 0, owner: '0', controller: '0', power: 2 },
                ],
            },
            player1: { hand: [], deck: [] },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_the_homeworld' },
            ],
        });

        await expect(page.locator('[data-minion-uid="acolyte-1"]')).toBeVisible();
        await page.locator('[data-minion-uid="acolyte-1"]').click({ force: true });
        await game.waitForInteraction('ninja_acolyte_play');
        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'ninja_shinobi',
            '选择影舞者',
        );
        await game.waitForNoInteraction();

        const remainingAcolyte = page.locator('[data-minion-def-id="ninja_acolyte"]').first();
        await expect(remainingAcolyte).toBeVisible();
        await remainingAcolyte.click({ force: true });
        await page.waitForTimeout(500);
        const state = await game.getState();
        expect(state.sys.interaction?.current).toBeUndefined();
        await game.screenshot('ninja-acolyte-cannot-use-twice', testInfo);
    });
});
