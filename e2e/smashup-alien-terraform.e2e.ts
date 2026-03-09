/**
 * SmashUp - Alien Terraform E2E 测试
 */

import { test, expect } from './framework';

const SMASHUP_TERRAFORM_QUERY = {
    p0: 'aliens,pirates',
    p1: 'ninjas,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

async function openTerraformScene(
    game: any,
    config: {
        hand?: string[];
        baseDeck: string[];
        bases?: string[];
    },
): Promise<void> {
    await game.openTestGame('smashup', SMASHUP_TERRAFORM_QUERY, 20000);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: config.hand ?? ['alien_terraform'],
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
        bases: (config.bases ?? ['base_the_homeworld', 'base_the_mothership']).map((defId) => ({
            defId,
            minions: [],
            ongoingActions: [],
        })),
        currentPlayer: '0',
        phase: 'playCards',
        extra: {
            core: {
                baseDeck: config.baseDeck,
            },
        },
    });
}

async function selectInteractionOptionBy(
    game: any,
    matcher: (option: any) => boolean,
    description: string,
): Promise<void> {
    const options = await game.getInteractionOptions();
    const option = options.find(matcher);
    expect(option, `交互中未找到 ${description} 对应的选项`).toBeTruthy();
    await game.selectOption(option.id);
}

async function waitForNoInteraction(game: any): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return state.sys.interaction?.current?.data?.sourceId ?? null;
    }).toBe(null);
}

function getCurrentPlayer(state: any): any {
    const currentPlayerId = state.core.turnOrder[state.core.currentPlayerIndex];
    return state.core.players[currentPlayerId];
}

test.describe('Smash Up - Alien Terraform', () => {
    test('应完成三步交互：选旧基地 → 选新基地 → 额外打出随从', async ({ game }, testInfo) => {
        await openTerraformScene(game, {
            hand: ['alien_terraform', 'alien_invader'],
            baseDeck: ['base_the_space_station', 'base_the_wormhole'],
        });

        await game.playCard('alien_terraform');
        await game.waitForInteraction('alien_terraform');
        await game.selectBase(0);

        await game.waitForInteraction('alien_terraform_choose_replacement');
        await game.screenshot('terraform-replacement-prompt', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseDefId === 'base_the_space_station',
            '替换基地 base_the_space_station',
        );

        await game.waitForInteraction('alien_terraform_play_minion');
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.defId === 'alien_invader',
            '额外打出的随从 alien_invader',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(finalState.core.bases[0].defId).toBe('base_the_space_station');
        expect(finalState.core.bases[0].minions).toHaveLength(1);
        expect(finalState.core.bases[0].minions[0].defId).toBe('alien_invader');
        expect(player0.hand.some((card: any) => card.defId === 'alien_invader')).toBe(false);
        expect(player0.discard.some((card: any) => card.defId === 'alien_terraform')).toBe(true);

        await game.screenshot('terraform-after-extra-minion', testInfo);
    });

    test('可跳过额外随从打出', async ({ game }, testInfo) => {
        await openTerraformScene(game, {
            hand: ['alien_terraform', 'alien_invader'],
            baseDeck: ['base_the_space_station'],
            bases: ['base_the_homeworld'],
        });

        await game.playCard('alien_terraform');
        await game.waitForInteraction('alien_terraform');
        await game.selectBase(0);

        await game.waitForInteraction('alien_terraform_choose_replacement');
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseDefId === 'base_the_space_station',
            '替换基地 base_the_space_station',
        );

        await game.waitForInteraction('alien_terraform_play_minion');
        await game.selectOption('skip');
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(finalState.core.bases[0].defId).toBe('base_the_space_station');
        expect(finalState.core.bases[0].minions).toHaveLength(0);
        expect(player0.hand.some((card: any) => card.defId === 'alien_invader')).toBe(true);
        expect(player0.discard.some((card: any) => card.defId === 'alien_terraform')).toBe(true);

        await game.screenshot('terraform-after-skip-minion', testInfo);
    });

    test('基地牌堆为空时应优雅失败', async ({ game }, testInfo) => {
        await openTerraformScene(game, {
            hand: ['alien_terraform'],
            baseDeck: [],
            bases: ['base_the_homeworld'],
        });

        await game.playCard('alien_terraform');
        await game.waitForInteraction('alien_terraform');
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].defId).toBe('base_the_homeworld');
        expect(finalState.sys.interaction?.current).toBeUndefined();

        await game.screenshot('terraform-empty-base-deck', testInfo);
    });
});
