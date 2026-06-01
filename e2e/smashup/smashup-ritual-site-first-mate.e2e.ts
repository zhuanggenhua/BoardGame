import { test, expect } from '../framework';

test.describe('仪式场所 + 大副计分后链路', () => {
    test('真实端到端：仪式场所先把大副洗回牌库后，大副仍能移动到其他基地', async ({ game, page }, testInfo) => {
        test.setTimeout(120000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                vp: 0,
                factions: ['pirates', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                vp: 0,
                factions: ['wizards', 'tricksters'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_ritual_site',
                    minions: [
                        { uid: 'mate-ritual', defId: 'pirate_first_mate', owner: '0', controller: '0', baseIndex: 0, basePower: 2 },
                        { uid: 'robot-body', defId: 'robot_hoverbot', owner: '0', controller: '0', baseIndex: 0, basePower: 8 },
                        { uid: 'wizard-body', defId: 'wizard_chronomage', owner: '1', controller: '1', baseIndex: 0, basePower: 6 },
                        { uid: 'trickster-body', defId: 'trickster_brownie', owner: '1', controller: '1', baseIndex: 0, basePower: 5 },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
                { defId: 'base_secret_garden', minions: [], ongoingActions: [] },
            ],
            extra: {
                core: {
                    baseDeck: ['base_tar_pits', 'base_cave_of_shinies'],
                    baseDiscard: [],
                    nextUid: 9000,
                },
            },
        });

        await game.screenshot('01-ritual-site-first-mate-before-scoring', testInfo);

        await game.advancePhase();
        await game.waitForInteraction('smashup_reaction_choose', 20000);
        await expect(page.getByRole('button', { name: '仪式场所' })).toBeVisible();
        await expect(page.getByRole('button', { name: '大副' })).toBeVisible();

        const firstReactionOptions = await game.getInteractionOptions();
        const ritualSiteOption = firstReactionOptions.find((option: any) =>
            option.value?.trigger?.sourceDefId === 'base_ritual_site'
            || option.value?.sourceDefId === 'base_ritual_site'
            || String(option.label ?? '').includes('仪式场所'),
        ) ?? firstReactionOptions.find((option: any) => option.id !== 'skip' && option.id !== 'pass');
        expect(ritualSiteOption, '未找到仪式场所的计分后触发').toBeTruthy();

        await game.selectOption(ritualSiteOption.id);
        await game.screenshot('02-after-ritual-site-resolved', testInfo);

        const afterRitualState = await game.getState();
        expect(afterRitualState.core.players['0'].deck.some((card: any) => card.uid === 'mate-ritual')).toBe(true);
        expect(afterRitualState.core.bases.some((base: any) =>
            (base.minions ?? []).some((minion: any) => minion.uid === 'mate-ritual'),
        )).toBe(false);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const sourceId = state?.sys?.interaction?.current?.data?.sourceId;
                return sourceId === 'smashup_reaction_choose' || sourceId === 'pirate_first_mate_choose_base';
            },
            { timeout: 20000, polling: 200 },
        );

        const interactionAfterRitual = await game.getState();
        if (interactionAfterRitual.sys.interaction?.current?.data?.sourceId === 'smashup_reaction_choose') {
            await expect(page.getByRole('button', { name: '大副' })).toBeVisible();
            const secondReactionOptions = await game.getInteractionOptions();
            const firstMateOption = secondReactionOptions.find((option: any) =>
                option.value?.trigger?.sourceDefId === 'pirate_first_mate'
                || option.value?.sourceDefId === 'pirate_first_mate'
                || String(option.label ?? '').includes('大副'),
            ) ?? secondReactionOptions.find((option: any) => option.id !== 'skip' && option.id !== 'pass');
            expect(firstMateOption, '仪式场所先结算后，大副触发不应丢失').toBeTruthy();
            await game.selectOption(firstMateOption.id);
            await game.waitForInteraction('pirate_first_mate_choose_base', 20000);
        } else {
            expect(interactionAfterRitual.sys.interaction?.current?.data?.sourceId).toBe('pirate_first_mate_choose_base');
        }
        await game.screenshot('03-first-mate-target-prompt-after-ritual', testInfo);

        const targetOptions = await game.getInteractionOptions();
        const factoryOption = targetOptions.find((option: any) => option.value?.baseDefId === 'base_the_factory');
        expect(factoryOption, '未找到大副移动目标基地').toBeTruthy();

        await game.selectOption(factoryOption.id);
        await game.waitForNoInteraction(20000);

        const finalState = await game.getState();
        const factoryMinions = finalState.core.bases[1].minions ?? [];
        expect(factoryMinions.some((minion: any) => minion.uid === 'mate-ritual')).toBe(true);
        expect(finalState.core.players['0'].deck.some((card: any) => card.uid === 'mate-ritual')).toBe(false);

        const mateMoveEvents = (finalState.sys.eventStream?.entries ?? []).filter((entry: any) =>
            entry.event?.type === 'su:minion_moved'
            && entry.event?.payload?.minionUid === 'mate-ritual'
            && entry.event?.payload?.reason === 'pirate_first_mate',
        );
        expect(mateMoveEvents).toHaveLength(1);

        await game.screenshot('04-first-mate-moved-after-ritual', testInfo);
    });
});
