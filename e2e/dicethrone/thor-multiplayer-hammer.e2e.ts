import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch, closeDebugPanelIfOpen, readyMultiplePlayersAndStartGame, selectCharacter,
    setupDTOnlineMatchWithPlayers, waitForDiceThroneHarness, waitForGameBoard,
} from '../helpers/dicethrone';
import { getMatchState } from '../helpers/state-injection';
import { finalizeThorEvidenceSourceIdentity, shot, waitForDamageNumbersToSettle } from '../helpers/dicethroneThorEvidence';

test('索尔四人真实开局弃牌飞锤并选择敌方目标', async ({ browser, baseURL }, info) => {
    test.setTimeout(360000);
    await clearEvidenceScreenshotsForTest(info);
    const match = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
        numPlayers: 4, gameServerBaseURL: getGameServerBaseURL(), skipImageGate: true,
        characterSelectionTimeout: 240000, sourceIdentityStartAtMatchRoute: true,
    });
    if (!match || match.players.length !== 4) {
        if (match) await cleanupDTMatch(match);
        throw new Error('未能建立四人 DiceThrone 对局');
    }
    const root = async () => {
        const stored = await getMatchState(match.matchId, match.hostPage) as any;
        return stored.G ?? stored;
    };
    try {
        for (const [index, hero] of ['thor', 'monk', 'treant', 'paladin'].entries()) {
            await selectCharacter(match.players[index]!.page, hero);
        }
        await readyMultiplePlayersAndStartGame(match.hostPage, match.players.slice(1).map(player => player.page));
        await Promise.all(match.players.map(async player => {
            await waitForGameBoard(player.page);
            await waitForDiceThroneHarness(player.page);
            await player.page.setViewportSize({ width: 1920, height: 1080 });
            await closeDebugPanelIfOpen(player.page);
        }));
        const host = match.hostPage;
        await expect.poll(async () => {
            const state = await root();
            return { phase: state.sys.phase, active: state.core.activePlayerId, holder: state.core.players['0'].tokens.mjolnir };
        }).toEqual({ phase: 'main1', active: '0', holder: 1 });
        await shot(host, info, '01-四人真实开局索尔持锤及手牌');
        await host.getByTestId('passive-action-thor-mjolnir-0').click();
        await expect(host.getByTestId('dicethrone-hand-discard-hint')).toBeVisible();
        await shot(host, info, '02-原手牌区选择飞锤成本');
        await host.locator('[data-testid="hand-area"] [data-card-id]').first().click();
        await expect.poll(async () => (await root()).sys.interaction.current?.data?.options?.length ?? 0).toBe(2);
        const beforeChoice = await root();
        const interaction = beforeChoice.sys.interaction.current;
        expect(interaction.playerId).toBe('0');
        const options = interaction.data.options as Array<{ id: string; value: { customId: string; value: number } }>;
        expect(options.map(option => option.value.value).sort()).toEqual([1, 3]);
        for (const player of match.players.slice(1)) {
            await expect(player.page.getByTestId('dt-player-target-1')).toHaveCount(0);
            await expect(player.page.getByTestId('dt-player-target-3')).toHaveCount(0);
        }
        await shot(host, info, '03-原目标选择显示两名敌人');
        const target = options.find(option => option.value.customId === 'thor-mjolnir-move' && option.value.value === 1);
        expect(target).toBeDefined();
        await host.getByTestId('dt-player-target-1').click();
        await shot(host, info, '03b-选中敌人后原确认可用');
        await host.locator('#modal-root').getByRole('button', { name: '确认', exact: true }).last().click();
        await expect.poll(async () => {
            const state = await root();
            return { holder: state.core.players['1'].tokens.mjolnir ?? 0, owner: state.core.players['0'].tokens.mjolnir ?? 0,
                hp: state.core.players['1'].resources.hp, count: state.core.mjolnirThrowsThisTurn?.['0'], interaction: state.sys.interaction.current ?? null };
        }).toEqual({ holder: 1, owner: 0, hp: 49, count: 1, interaction: null });
        await waitForDamageNumbersToSettle(host);
        await shot(host, info, '04-所选敌人持锤并受到一次独立伤害');
        await finalizeThorEvidenceSourceIdentity(host);
    } finally {
        await cleanupDTMatch(match);
    }
});
