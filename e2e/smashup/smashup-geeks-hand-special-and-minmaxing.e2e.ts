import { test, expect } from '../framework';

async function openGeeksScene(game: any, scene: Record<string, any>): Promise<void> {
    await game.openTestGame('smashup', {
        p0: 'geeks,dragons',
        p1: 'superheroes,aliens',
        skipFactionSelect: true,
    }, 90000);

    await game.setupScene({
        gameId: 'smashup',
        currentPlayer: scene.currentPlayer ?? '0',
        phase: scene.phase ?? 'playCards',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['geeks', 'dragons'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            ...(scene.player0 ?? {}),
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            factions: ['superheroes', 'aliens'],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            ...(scene.player1 ?? {}),
        },
        bases: scene.bases ?? [
            { defId: 'base_dragons_lair', minions: [] },
            { defId: 'base_converted_cave', minions: [] },
        ],
        extra: scene.extra,
    });
}

test.describe('SmashUp 极客真实手牌入口回归', () => {
    test('粉丝在随从额度已满时，仍可从真实手牌点击后走 special 链弃掉并摸 1 张', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        await openGeeksScene(game, {
            player0: {
                hand: [
                    { uid: 'fan-1', defId: 'geeks_fan', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'wizard_zap', type: 'action', owner: '0' },
                ],
                minionsPlayed: 1,
                minionLimit: 1,
            },
            bases: [
                { defId: 'base_dragons_lair', minions: [] },
                { defId: 'base_converted_cave', minions: [] },
            ],
        });

        await expect(page.locator('[data-testid="su-hand-area"] [data-card-uid="fan-1"]')).toBeVisible({ timeout: 10000 });
        await game.screenshot('geeks-fan-01-ready', testInfo);

        await page.locator('[data-testid="su-hand-area"] [data-card-uid="fan-1"]').click();
        await page.waitForTimeout(300);
        await game.screenshot('geeks-fan-02-selected', testInfo);

        await game.selectBase(1);
        await game.waitForNoInteraction(10000);

        const state = await game.getState();
        expect(state.core.players['0'].hand.map((card: any) => card.uid)).toEqual(['draw-1']);
        expect(state.core.players['0'].discard.map((card: any) => card.uid)).toEqual(['fan-1']);
        expect(state.core.bases[1].minions).toHaveLength(0);
        expect(state.core.players['0'].minionsPlayed).toBe(1);
        expect(state.core.players['0'].actionsPlayed).toBe(0);

        await game.screenshot('geeks-fan-03-resolved', testInfo);
    });

    test('粉丝普通打出和 special 同时合法时，先弹出打出/使用能力/取消仲裁', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        await openGeeksScene(game, {
            player0: {
                hand: [
                    { uid: 'fan-1', defId: 'geeks_fan', type: 'minion', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-1', defId: 'wizard_zap', type: 'action', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
            },
            bases: [
                { defId: 'base_dragons_lair', minions: [] },
                { defId: 'base_converted_cave', minions: [] },
            ],
        });

        const fanCard = page.locator('[data-testid="su-hand-area"] [data-card-uid="fan-1"]');
        const playAsMinionButton = page.getByRole('button', { name: /打出为随从|Play as Minion/ });
        const useAbilityButton = page.getByRole('button', { name: /使用能力|Use Ability/ });
        const cancelButton = page.getByRole('button', { name: /取消 \/ 跳过|Cancel \/ Skip/ });

        await expect(fanCard).toBeVisible({ timeout: 10000 });
        await fanCard.click();

        await expect(playAsMinionButton).toBeVisible({ timeout: 10000 });
        await expect(useAbilityButton).toBeVisible();
        await expect(cancelButton).toBeVisible();
        await expect(page.getByText(/选择要对|Choose what to do with/)).toHaveCount(0);
        await expect(page.getByText(/既可以正常打出|can be played normally/)).toHaveCount(0);
        await game.screenshot('geeks-fan-choice-01-options', testInfo);

        await cancelButton.click();
        await expect(playAsMinionButton).toHaveCount(0);
        let state = await game.getState();
        expect(state.core.players['0'].hand.map((card: any) => card.uid)).toEqual(['fan-1']);
        expect(state.core.players['0'].discard).toHaveLength(0);
        expect(state.core.bases[0].minions).toHaveLength(0);
        expect(state.core.bases[1].minions).toHaveLength(0);

        await fanCard.click();
        await expect(useAbilityButton).toBeVisible({ timeout: 10000 });
        await useAbilityButton.click();
        await game.selectBase(1);
        await game.waitForNoInteraction(10000);

        state = await game.getState();
        expect(state.core.players['0'].hand.map((card: any) => card.uid)).toEqual(['draw-1']);
        expect(state.core.players['0'].discard.map((card: any) => card.uid)).toEqual(['fan-1']);
        expect(state.core.bases[1].minions).toHaveLength(0);
        expect(state.core.players['0'].minionsPlayed).toBe(0);
        expect(state.core.players['0'].actionsPlayed).toBe(0);

        await game.screenshot('geeks-fan-choice-02-special-resolved', testInfo);
    });

    test('粉丝动作仲裁选择打出为随从后，应继续走普通出牌基地选择', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        await openGeeksScene(game, {
            player0: {
                hand: [
                    { uid: 'fan-1', defId: 'geeks_fan', type: 'minion', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
            },
            bases: [
                { defId: 'base_dragons_lair', minions: [] },
                { defId: 'base_converted_cave', minions: [] },
            ],
        });

        await expect(page.locator('[data-testid="su-hand-area"] [data-card-uid="fan-1"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="su-hand-area"] [data-card-uid="fan-1"]').click();
        await page.getByRole('button', { name: /打出为随从|Play as Minion/ }).click();
        await game.selectBase(0);
        await game.waitForNoInteraction(10000);

        const state = await game.getState();
        expect(state.core.players['0'].hand).toHaveLength(0);
        expect(state.core.players['0'].discard).toHaveLength(0);
        expect(state.core.bases[0].minions.map((minion: any) => minion.uid)).toEqual(['fan-1']);
        expect(state.core.players['0'].minionsPlayed).toBe(1);
        expect(state.core.players['0'].actionsPlayed).toBe(0);

        await game.screenshot('geeks-fan-choice-03-play-minion-resolved', testInfo);
    });

    test('平衡从真实手牌打出时，应展示对手手牌并可借打附着行动到己方随从', async ({ page, game }, testInfo) => {
        test.setTimeout(180000);

        await openGeeksScene(game, {
            player0: {
                hand: [
                    { uid: 'minmax-1', defId: 'geeks_min_maxing', type: 'action', owner: '0' },
                    { uid: 'own-action-1', defId: 'wizard_zap', type: 'action', owner: '0' },
                ],
            },
            player1: {
                hand: [
                    { uid: 'expand-1', defId: 'superheroes_expanded_power', type: 'action', owner: '1' },
                ],
            },
            bases: [
                {
                    defId: 'base_dragons_lair',
                    minions: [
                        { uid: 'fan-1', defId: 'geeks_fan', owner: '0', controller: '0', basePower: 2 },
                    ],
                },
                { defId: 'base_converted_cave', minions: [] },
            ],
        });

        await expect(page.locator('[data-testid="su-hand-area"] [data-card-uid="minmax-1"]')).toBeVisible({ timeout: 10000 });
        await game.screenshot('geeks-minmax-01-ready', testInfo);

        await game.playCard('geeks_min_maxing');
        await game.waitForInteraction('geeks_min_maxing_action', 10000);

        const interactionOptions = await game.getInteractionOptions();
        expect(interactionOptions.some((option: any) => option?.value?.cardUid === 'expand-1')).toBe(true);
        expect(interactionOptions.some((option: any) => option?.value?.cardUid === 'own-action-1')).toBe(false);
        await expect(page.locator('[data-card-def-id="superheroes_expanded_power"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-card-def-id="wizard_zap"]')).toHaveCount(0);
        await game.screenshot('geeks-minmax-02-opponent-hand', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option?.value?.cardUid === 'expand-1',
            '平衡选择对手手牌中的扩大力量',
        );

        await game.waitForInteraction('geeks_min_maxing_minion', 10000);
        await expect(page.locator('[data-minion-uid="fan-1"]')).toBeVisible({ timeout: 5000 });
        await game.screenshot('geeks-minmax-03-target-minion', testInfo);

        await page.locator('[data-minion-uid="fan-1"]').click({ force: true });
        await game.waitForNoInteraction(10000);

        const state = await game.getState();
        const fan = state.core.bases[0].minions.find((minion: any) => minion.uid === 'fan-1');
        expect(fan).toBeTruthy();
        expect(fan.attachedActions.map((action: any) => action.uid)).toEqual(['expand-1']);
        expect(state.core.players['1'].hand).toHaveLength(0);
        expect(state.core.players['1'].discard).toHaveLength(0);
        expect(state.core.players['0'].discard.map((card: any) => card.uid)).toContain('minmax-1');

        await game.screenshot('geeks-minmax-04-resolved', testInfo);
    });
});
