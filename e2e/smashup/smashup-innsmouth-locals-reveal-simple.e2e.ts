/**
 * 大杀四方 - 印斯茅斯“本地人”展示测试（简化版）
 */

import { join } from 'node:path';
import { test, expect } from '../framework';

async function openScene(game: any): Promise<void> {
    await game.openTestGame('smashup');
}

async function dismissRevealOverlay(page: any): Promise<void> {
    const overlay = page.getByTestId('reveal-overlay');
    await page.getByTestId('reveal-dismiss-btn').click({ force: true });
    await expect(overlay).toBeHidden({ timeout: 3000 });
}

test.describe('印斯茅斯“本地人”展示功能（简化版）', () => {
    test('打出“本地人”后应该显示展示 UI', async ({ page, game }, testInfo) => {
        await openScene(game);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['innsmouth_the_locals'],
                deck: ['innsmouth_the_locals', 'aliens_scout', 'innsmouth_the_locals'],
                factions: ['innsmouth', 'aliens'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{ defId: 'base_the_homeworld', minions: [], ongoingActions: [] }],
        });

        await game.playCard('innsmouth_the_locals', { targetBaseIndex: 0 });
        await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="reveal-overlay"] [data-testid="reveal-card"]')).toHaveCount(3);
        await game.screenshot('innsmouth-locals-reveal', testInfo);

        await dismissRevealOverlay(page);

        const state = await game.getState();
        const handLocals = state.core.players['0'].hand.filter((card: any) => card.defId === 'innsmouth_the_locals').length;
        const baseLocals = state.core.bases[0].minions.filter((minion: any) => minion.defId === 'innsmouth_the_locals' && minion.controller === '0').length;
        expect(handLocals + baseLocals).toBe(3);
    });

    test('本地人打到家园后会继续叠额外低战力额度，但 3 力随从仍然不能继续打出', async ({ page, game }) => {
        const sharedDir = join(process.cwd(), 'test-results', 'evidence-screenshots', '_shared');

        await openScene(game);
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['innsmouth_the_locals', 'alien_invader'],
                deck: ['innsmouth_the_locals', 'aliens_scout', 'innsmouth_the_locals'],
                factions: ['innsmouth', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('innsmouth_the_locals', { targetBaseIndex: 0 });
        await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 });
        await page.screenshot({
            path: join(sharedDir, 'smashup-homeworld-locals-chain-step1-first-reveal.png'),
            fullPage: false,
        });
        await dismissRevealOverlay(page);

        const afterFirstPlay = await game.getState();
        const firstHandLocals = afterFirstPlay.core.players['0'].hand.filter((card: any) => card.defId === 'innsmouth_the_locals');
        expect(firstHandLocals).toHaveLength(2);
        expect(afterFirstPlay.core.players['0'].minionsPlayed).toBe(1);
        expect(afterFirstPlay.core.players['0'].minionLimit).toBe(2);
        expect(afterFirstPlay.core.players['0'].extraMinionPowerMax).toBe(2);

        await game.playCard('innsmouth_the_locals', { targetBaseIndex: 0 });
        await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 });
        await page.screenshot({
            path: join(sharedDir, 'smashup-homeworld-locals-chain-step2-second-reveal.png'),
            fullPage: false,
        });
        await dismissRevealOverlay(page);

        const afterSecondPlay = await game.getState();
        const secondHandLocals = afterSecondPlay.core.players['0'].hand.filter((card: any) => card.defId === 'innsmouth_the_locals');
        expect(secondHandLocals).toHaveLength(1);
        expect(afterSecondPlay.core.players['0'].minionsPlayed).toBe(2);
        expect(afterSecondPlay.core.players['0'].minionLimit).toBe(3);
        expect(afterSecondPlay.core.players['0'].extraMinionPowerMax).toBe(2);

        await game.playCard('innsmouth_the_locals', { targetBaseIndex: 0 });
        await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 5000 });
        await page.screenshot({
            path: join(sharedDir, 'smashup-homeworld-locals-chain-step3-third-reveal.png'),
            fullPage: false,
        });
        await dismissRevealOverlay(page);

        const beforeBigMinionAttempt = await game.getState();
        expect(beforeBigMinionAttempt.core.players['0'].hand.some((card: any) => card.defId === 'innsmouth_the_locals')).toBe(false);
        expect(beforeBigMinionAttempt.core.players['0'].hand.some((card: any) => card.defId === 'alien_invader')).toBe(true);
        expect(beforeBigMinionAttempt.core.players['0'].minionsPlayed).toBe(3);
        expect(beforeBigMinionAttempt.core.players['0'].minionLimit).toBe(4);
        expect(beforeBigMinionAttempt.core.players['0'].extraMinionPowerMax).toBe(2);

        await game.playCard('alien_invader', { targetBaseIndex: 1 });
        await page.waitForTimeout(500);
        await page.screenshot({
            path: join(sharedDir, 'smashup-homeworld-locals-chain-step4-big-minion-blocked.png'),
            fullPage: false,
        });

        const afterBigMinionAttempt = await game.getState();
        expect(afterBigMinionAttempt.core.players['0'].hand.some((card: any) => card.defId === 'alien_invader')).toBe(true);
        expect(afterBigMinionAttempt.core.players['0'].minionsPlayed).toBe(3);
        expect(afterBigMinionAttempt.core.players['0'].extraMinionPowerMax).toBe(2);
        expect(afterBigMinionAttempt.core.bases[0].minions.filter((minion: any) => minion.controller === '0')).toHaveLength(3);
        expect(afterBigMinionAttempt.core.bases[1].minions.filter((minion: any) => minion.controller === '0')).toHaveLength(0);
    });
});
