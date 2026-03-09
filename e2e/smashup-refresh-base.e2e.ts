/**
 * 大杀四方 - 刷新基地功能 E2E 测试
 */

import { test, expect } from './framework';

const SMASHUP_REFRESH_BASE_QUERY = {
    p0: 'aliens,dinosaurs',
    p1: 'ghosts,bear_cavalry',
    skipFactionSelect: true,
    skipInitialization: false,
};

async function openRefreshBaseDebugPanel(page: any, game: any): Promise<void> {
    await game.openTestGame('smashup', SMASHUP_REFRESH_BASE_QUERY, 20000);

    await expect(page.locator('[data-testid="debug-toggle"]')).toBeVisible();
    await page.click('[data-testid="debug-toggle"]');
    await expect(page.locator('[data-testid="debug-panel"]')).toBeVisible();

    await page.click('[data-testid="debug-tab-controls"]');
    await expect(page.locator('[data-testid="su-debug-refresh-base"]')).toBeVisible();
}

test.describe('SmashUp 刷新基地功能', () => {
    test('应该能通过调试面板刷新所有基地', async ({ page, game }, testInfo) => {
        await openRefreshBaseDebugPanel(page, game);

        const initialState = await game.getState();
        const baseCount = initialState.core.bases.length;
        const oldBaseDefIds = initialState.core.bases.map((base: any) => base.defId);
        const nextBaseDefIds = initialState.core.baseDeck.slice(0, baseCount);

        expect(baseCount).toBeGreaterThan(0);
        expect(initialState.core.baseDeck.length).toBeGreaterThanOrEqual(baseCount);
        expect(nextBaseDefIds.length).toBe(baseCount);

        await page.click('[data-testid="su-debug-refresh-all-bases-apply"]');

        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.baseDeck.length;
        }).toBe(initialState.core.baseDeck.length - baseCount);

        const updatedState = await game.getState();
        for (let i = 0; i < baseCount; i += 1) {
            expect(updatedState.core.bases[i].defId).toBe(nextBaseDefIds[i]);
            expect(updatedState.core.bases[i].defId).not.toBe(oldBaseDefIds[i]);
            expect(updatedState.core.bases[i].minions.length).toBe(0);
            expect(updatedState.core.bases[i].ongoingActions.length).toBe(0);
        }

        await game.screenshot('refresh-all-bases-after-apply', testInfo);
    });

    test('基地牌库不足时应只刷新可用数量的基地', async ({ page, game }, testInfo) => {
        await openRefreshBaseDebugPanel(page, game);

        const initialState = await game.getState();
        const truncatedBaseDeck = initialState.core.baseDeck.slice(0, 2);
        const expectedBaseDefIds = [...truncatedBaseDeck];

        await game.setupScene({
            gameId: 'smashup',
            extra: {
                core: {
                    baseDeck: truncatedBaseDeck,
                },
            },
        });

        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.baseDeck.length;
        }).toBe(2);

        await expect(page.locator('[data-testid="su-debug-refresh-all-bases-apply"]')).toBeEnabled();
        await page.click('[data-testid="su-debug-refresh-all-bases-apply"]');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                basesLength: state.core.bases.length,
                baseDeckLength: state.core.baseDeck.length,
            };
        }).toEqual({
            basesLength: expectedBaseDefIds.length,
            baseDeckLength: 0,
        });

        const updatedState = await game.getState();
        expect(updatedState.core.bases.map((base: any) => base.defId)).toEqual(expectedBaseDefIds);
        updatedState.core.bases.forEach((base: any) => {
            expect(base.minions.length).toBe(0);
            expect(base.ongoingActions.length).toBe(0);
        });

        await game.screenshot('refresh-all-bases-partial-refresh', testInfo);
    });
});
