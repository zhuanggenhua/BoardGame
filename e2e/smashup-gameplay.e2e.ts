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

const WEREWOLF_STANDING_STONES_QUERY = {
    p0: 'werewolves,ghosts',
    p1: 'aliens,pirates',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 24680,
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

    test('巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', WEREWOLF_STANDING_STONES_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                factions: ['werewolves', 'ghosts'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['aliens', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [
                        {
                            uid: 'wolf-host',
                            defId: 'werewolf_pack_alpha',
                            owner: '0',
                            controller: '0',
                            attachedActions: [
                                { uid: 'oa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: true },
                            ],
                        },
                        {
                            uid: 'enemy-minion',
                            defId: 'ghosts_spectre',
                            owner: '1',
                            controller: '1',
                        },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    standingStonesDoubleTalentMinionUid: undefined,
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const hostMinion = page.locator('[data-minion-uid="wolf-host"]');
        const attachedAction = page.locator('[data-attached-action-uid="oa1"]');

        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'wolf-host');
        }, { timeout: 5000 }).toBe(true);

        await page.waitForFunction(
            (uid) => !!document.querySelector(`[data-minion-uid="${uid}"]`),
            'wolf-host',
            { timeout: 10000, polling: 200 },
        );
        await expect(hostMinion).toBeVisible({ timeout: 5000 });
        await hostMinion.hover();
        await expect(attachedAction).toBeVisible({ timeout: 5000 });

        const beforeState = await game.getState();
        const beforeHost = beforeState.core.bases[0].minions.find((minion: any) => minion.uid === 'wolf-host');
        expect(beforeHost?.attachedActions?.find((action: any) => action.uid === 'oa1')?.talentUsed).toBe(true);
        expect(beforeState.core.standingStonesDoubleTalentMinionUid).toBeUndefined();
        expect(beforeState.core.players['0'].extraTalentUsesConsumed).toBeUndefined();
        expect(beforeState.core.players['0'].actionLimit).toBe(1);

        await game.screenshot('werewolf-standing-stones-before-second-talent', testInfo);

        await attachedAction.click({ force: true });

        await expect.poll(async () => {
            const state = await game.getState();
            const player0 = state.core.players['0'];
            const host = state.core.bases[0].minions.find((minion: any) => minion.uid === 'wolf-host');
            const attached = host?.attachedActions?.find((action: any) => action.uid === 'oa1');
            return {
                actionLimit: player0.actionLimit,
                extraTalentUsesConsumed: player0.extraTalentUsesConsumed ?? null,
                standingStonesDoubleTalentMinionUid: state.core.standingStonesDoubleTalentMinionUid ?? null,
                attachedTalentUsed: attached?.talentUsed ?? false,
            };
        }, { timeout: 5000 }).toEqual({
            actionLimit: 2,
            extraTalentUsesConsumed: null,
            standingStonesDoubleTalentMinionUid: 'wolf-host',
            attachedTalentUsed: true,
        });

        await hostMinion.hover();
        await expect(attachedAction).toBeVisible({ timeout: 5000 });
        await game.screenshot('werewolf-standing-stones-after-second-talent', testInfo);
    });

    test('主动基地能力徽记应保持底部居中，不再向右偏', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', SMASHUP_GAMEPLAY_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'hand-bury-card', defId: 'ancient_egyptians_you_can_take_it_with_you', type: 'action' },
                ],
                factions: ['ancient_egyptians', 'robots'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['ninjas', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                { defId: 'base_pyramids' },
                { defId: 'base_the_homeworld' },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const baseCard = page.getByTestId('base-zone-0');
        const badge = page.getByTestId('base-ability-badge-0');

        await expect(baseCard).toBeVisible({ timeout: 5000 });
        await expect(badge).toBeVisible({ timeout: 5000 });

        const centerOffsetPx = await page.evaluate(() => {
            const base = document.querySelector<HTMLElement>('[data-testid="base-zone-0"]');
            const badgeEl = document.querySelector<HTMLElement>('[data-testid="base-ability-badge-0"]');
            if (!base || !badgeEl) return null;
            const baseRect = base.getBoundingClientRect();
            const badgeRect = badgeEl.getBoundingClientRect();
            const baseCenter = baseRect.left + baseRect.width / 2;
            const badgeCenter = badgeRect.left + badgeRect.width / 2;
            return Math.abs(baseCenter - badgeCenter);
        });

        expect(centerOffsetPx).not.toBeNull();
        expect(centerOffsetPx!).toBeLessThan(2);

        await game.screenshot('active-base-ability-badge-centered', testInfo);
    });

    test('适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            numPlayers: 2,
            skipInitialization: true,
        });

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'p0-sotf', defId: 'dino_survival_of_the_fittest_pod', type: 'action' },
                ],
                factions: ['dinosaurs_pod', 'innsmouth_pod'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['robots', 'wizards'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            bases: [
                {
                    defId: 'base_innsmouth_base',
                    minions: [
                        { uid: 'b0-strong', defId: 'dino_king_rex_pod', owner: '0', controller: '0', power: 7 },
                        { uid: 'b0-weak', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', power: 2 },
                        { uid: 'b0-enemy', defId: 'wizard_enchantress', owner: '1', controller: '1', power: 2 },
                    ],
                },
                {
                    defId: 'base_wizard_academy',
                    minions: [
                        { uid: 'b1-weak', defId: 'robot_microbot_guard', owner: '1', controller: '1', power: 1 },
                        { uid: 'b1-mid-a', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', power: 2 },
                        { uid: 'b1-mid-b', defId: 'innsmouth_the_locals_pod', owner: '0', controller: '0', power: 2 },
                    ],
                },
                {
                    defId: 'base_the_factory',
                    minions: [
                        { uid: 'b2-only', defId: 'robot_microbot_alpha', owner: '1', controller: '1', power: 1 },
                    ],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const handCard = page.locator('[data-card-uid="p0-sotf"]');
        const base0 = page.locator('[data-base-index="0"]');
        const base1 = page.locator('[data-base-index="1"]');

        await expect(handCard).toBeVisible();
        await expect(base0).toBeVisible();
        await expect(base1).toBeVisible();

        await handCard.click();
        await page.waitForTimeout(300);

        await expect(handCard, '点卡后应进入选基地态，不能直接弹“场上没有符合条件的目标”').toBeVisible();
        await expect(page.getByText('场上没有符合条件的目标')).toHaveCount(0);
        await game.screenshot('sotf-after-card-click-awaiting-base', testInfo);

        await base0.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                inHand: state.core.players['0'].hand.some((card: any) => card.uid === 'p0-sotf'),
                base1WeakAlive: state.core.bases[1].minions.some((minion: any) => minion.uid === 'b1-weak'),
                base2OnlyAlive: state.core.bases[2].minions.some((minion: any) => minion.uid === 'b2-only'),
                interactionSourceId: state.sys.interaction?.current?.data?.sourceId ?? null,
                tieBreakOptions: (state.sys.interaction?.current?.data?.options ?? []).map((option: any) => option?.value?.minionUid ?? null),
            };
        }, { timeout: 5000 }).toEqual({
            inHand: false,
            base1WeakAlive: false,
            base2OnlyAlive: true,
            interactionSourceId: 'dino_survival_tiebreak',
            tieBreakOptions: expect.arrayContaining(['b0-weak', 'b0-enemy']),
        });

        await expect(page.getByText('场上没有符合条件的目标')).toHaveCount(0);
        await expect(page.getByText('选择要消灭的最低力量随从')).toBeVisible();
        await game.screenshot('sotf-after-base-selection-awaiting-tiebreak', testInfo);

        await expect(page.locator('[data-minion-uid="b0-weak"]')).toBeVisible();
        await expect(page.locator('[data-minion-uid="b0-enemy"]')).toBeVisible();
        await game.screenshot('sotf-tiebreak-candidates-visible', testInfo);
    });
});
