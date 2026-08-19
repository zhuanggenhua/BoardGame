import { test, expect } from '../framework';

async function openBannedListScene(game: any): Promise<void> {
    await game.openTestGame('smashup', {
        p0: 'geeks,dragons',
        p1: 'aliens,pirates',
        skipFactionSelect: true,
    }, 90000);

    await game.setupScene({
        gameId: 'smashup',
        currentPlayer: '0',
        phase: 'playCards',
        player0: {
            hand: [{ uid: 'banned', defId: 'geeks_banned_list', type: 'action', owner: '0' }],
            deck: [],
            discard: [],
            factions: ['geeks', 'dragons'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            hand: [
                { uid: 'enemy-collector', defId: 'alien_collector', type: 'minion', owner: '1' },
                { uid: 'enemy-broadside', defId: 'pirate_broadside', type: 'action', owner: '1' },
            ],
            deck: [],
            discard: [],
            factions: ['aliens', 'pirates'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        bases: [
            { defId: 'base_dragons_lair', minions: [] },
            { defId: 'base_converted_cave', minions: [] },
            { defId: 'base_tabletop', minions: [] },
        ],
    });
}

async function dispatchSmashUpCommand(page: any, type: string, payload: Record<string, unknown>, playerId = '0'): Promise<void> {
    await page.evaluate(({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, { commandType: type, commandPayload: payload, commandPlayerId: playerId });
    await page.waitForTimeout(300);
}

async function readCoreState(page: any): Promise<any> {
    return page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        return state?.core ?? null;
    });
}

test.describe('大杀四方 - 极客禁卡表交互面板', () => {
    test('禁卡表面板应提供卡图搜索并只展示当前对局派系候选', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        await openBannedListScene(game);
        await dispatchSmashUpCommand(page, 'su:play_action', { cardUid: 'banned' });
        await game.waitForInteraction('geeks_banned_list', 10000);

        const searchInput = page.getByTestId('prompt-card-search-input');
        const cardGrid = page.getByTestId('prompt-card-grid');
        const cardOptions = cardGrid.locator('[data-testid^="prompt-card-"][data-option-id]');

        await expect(searchInput).toBeVisible({ timeout: 5000 });
        const initialCount = await cardOptions.count();
        expect(initialCount).toBeGreaterThan(4);
        await game.screenshot('geeks-banned-list-01-initial-panel', testInfo);

        await searchInput.fill('行尸');
        await expect(cardGrid.getByText('没有匹配的卡牌')).toBeVisible({ timeout: 5000 });
        await expect(cardOptions).toHaveCount(0);
        await game.screenshot('geeks-banned-list-02-empty-search', testInfo);

        await searchInput.fill('收集者');
        await expect(cardOptions).toHaveCount(1);
        await expect(cardGrid.getByText('收集者')).toBeVisible({ timeout: 5000 });
        await expect(cardGrid.getByText('行尸')).toHaveCount(0);
        await game.screenshot('geeks-banned-list-03-filtered-search', testInfo);

        await cardOptions.first().click();
        await game.waitForNoInteraction(10000);

        const core = await readCoreState(page);
        expect(core.players['1'].hand.map((card: any) => card.uid)).toEqual(['enemy-broadside']);
        expect(core.players['1'].deck.at(-1)?.uid).toBe('enemy-collector');
        await game.screenshot('geeks-banned-list-04-resolved', testInfo);
    });
});
