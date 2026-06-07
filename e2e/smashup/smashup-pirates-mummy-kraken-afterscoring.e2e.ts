import { test, expect } from '../framework';

function makeMinion(
    uid: string,
    defId: string,
    owner: string,
    basePower: number,
    extra: Record<string, unknown> = {},
) {
    return {
        uid,
        defId,
        owner,
        controller: owner,
        basePower,
        powerModifier: 0,
        powerCounters: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
        ...extra,
    };
}

async function waitForInteractionSourceIn(
    page: Parameters<typeof test>[0] extends never ? never : any,
    sourceIds: string[],
    timeout = 20000,
): Promise<string> {
    await page.waitForFunction(
        (expectedSourceIds: string[]) => {
            const sourceId = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? null;
            return typeof sourceId === 'string' && expectedSourceIds.includes(sourceId);
        },
        sourceIds,
        { timeout, polling: 200 },
    );

    return page.evaluate(() =>
        (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? null,
    );
}

async function settleAfterScoringChain(game: {
    getState: () => Promise<any>;
    passResponseWindow: (playerId?: string) => Promise<void>;
}, page: { waitForTimeout: (ms: number) => Promise<void> }) {
    for (let step = 0; step < 12; step += 1) {
        const state = await game.getState();
        const windowType = state?.sys?.responseWindow?.current?.windowType ?? null;
        const sourceId = state?.sys?.interaction?.current?.data?.sourceId ?? null;

        if (!windowType && !sourceId) {
            return;
        }

        if (windowType === 'meFirst' || windowType === 'afterScoring') {
            await game.passResponseWindow();
            continue;
        }

        await page.waitForTimeout(250);
    }

    throw new Error('afterScoring 链路未能在预期步数内收口');
}

test.describe('SmashUp 海盗 + 木乃伊 + 海怪克拉肯 afterScoring 链路', () => {
    test('真实端到端：大副与海怪克拉肯结算后，木乃伊仍会出现，且旧基地未提前消失', async ({ game, page }, testInfo) => {
        test.setTimeout(180000);

        await game.openTestGame('smashup');
        await game.setupScene({
            gameId: 'smashup',
            phase: 'playCards',
            currentPlayer: '0',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'ancient_egyptians'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['robots', 'ninjas'],
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        makeMinion('mate-0', 'pirate_first_mate', '0', 2),
                        makeMinion('mummy-0', 'ancient_egyptians_mummy', '0', 4),
                        makeMinion('ally-big', 'robot_warbot', '0', 5, { powerCounters: 10 }),
                        makeMinion('enemy-big', 'pirate_king', '1', 5, { powerCounters: 8 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_mothership',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_factory',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            extra: {
                core: {
                    baseDeck: ['base_secret_garden'],
                    enabledExpansions: ['titans'],
                    titans: [
                        {
                            uid: 't-kraken-setaside',
                            defId: 'pirates_the_kraken',
                            faction: 'pirates',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'setaside' },
                        },
                    ],
                    nextUid: 9000,
                },
            },
        });

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.bases?.[0]?.defId === 'base_the_homeworld'
                    && state?.core?.bases?.[0]?.minions?.length === 4;
            },
            { timeout: 10000, polling: 200 },
        );

        await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-base-index]')).toHaveCount(3);
        await game.screenshot('01-pirates-mummy-kraken-scene-ready', testInfo);

        await game.advancePhase();
        await game.waitForInteraction('smashup_reaction_choose', 20000);

        const firstReactionState = await game.getState();
        const firstReactionOptions = firstReactionState?.sys?.interaction?.current?.data?.options ?? [];
        const firstReactionOptionIds = firstReactionOptions.map((option: any) => String(option.id ?? ''));

        expect(firstReactionOptionIds).toEqual(expect.arrayContaining([
            expect.stringContaining('pirate_first_mate'),
            expect.stringContaining('pirates_the_kraken'),
        ]));
        expect(firstReactionOptionIds.some((id: string) => id.includes('ancient_egyptians_mummy'))).toBe(false);
        expect(
            (firstReactionState?.core?.triggerQueue ?? []).some((trigger: any) => trigger?.sourceDefId === 'ancient_egyptians_mummy'),
        ).toBe(true);
        expect(firstReactionState?.core?.bases?.[0]?.defId).toBe('base_the_homeworld');
        await expect(page.getByTestId('base-zone-0')).toBeVisible();
        await expect(page.locator('[data-base-index]')).toHaveCount(3);
        await game.screenshot('02-initial-reaction-choose-no-mummy-yet', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => String(option.id ?? '').includes('pirate_first_mate'),
            '大副 afterScoring trigger',
        );
        await game.waitForInteraction('pirate_first_mate_choose_base', 20000);
        await game.screenshot('03-first-mate-choose-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1 || option.value?.baseDefId === 'base_the_mothership',
            '大副移动到第二个基地',
        );

        await game.waitForInteraction('titan_pirates_the_kraken_play_replacement', 20000);
        const krakenPromptState = await game.getState();
        expect(krakenPromptState?.core?.bases?.[0]?.defId).toBe('base_the_homeworld');
        await expect(page.getByTestId('base-zone-0')).toBeVisible();
        await expect(page.locator('[data-base-index]')).toHaveCount(3);
        await game.screenshot('04-kraken-prompt-old-base-still-visible', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.id === 'play' || option.value?.play === true,
            '打出海怪克拉肯到替换基地',
        );

        const nextSourceId = await waitForInteractionSourceIn(page, [
            'smashup_reaction_choose',
            'ancient_egyptians_mummy_after_scoring',
        ]);
        expect(nextSourceId).toBe('smashup_reaction_choose');

        const secondReactionState = await game.getState();
        const secondReactionOptions = secondReactionState?.sys?.interaction?.current?.data?.options ?? [];
        const secondReactionOptionIds = secondReactionOptions.map((option: any) => String(option.id ?? ''));
        expect(secondReactionOptionIds).toEqual(expect.arrayContaining([
            expect.stringContaining('ancient_egyptians_mummy'),
        ]));
        expect(secondReactionOptionIds.some((id: string) => id.includes('pirate_first_mate'))).toBe(false);
        expect(secondReactionOptionIds.some((id: string) => id.includes('pirates_the_kraken'))).toBe(false);
        expect(secondReactionState?.core?.bases?.[0]?.defId).toBe('base_the_homeworld');
        await expect(page.getByTestId('base-zone-0')).toBeVisible();
        await expect(page.locator('[data-base-index]')).toHaveCount(3);
        await game.screenshot('05-mummy-trigger-appears-before-base-replaced', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => String(option.id ?? '').includes('ancient_egyptians_mummy'),
            '木乃伊 afterScoring trigger',
        );
        await game.waitForInteraction('ancient_egyptians_mummy_after_scoring', 20000);

        const mummyPromptState = await game.getState();
        const mummyTargetOptions = mummyPromptState?.sys?.interaction?.current?.data?.options ?? [];
        expect(mummyTargetOptions.some((option: any) => option.value?.baseIndex === 0)).toBe(false);
        expect(mummyPromptState?.core?.bases?.[0]?.defId).toBe('base_the_homeworld');
        await expect(page.getByTestId('base-zone-0')).toBeVisible();
        await game.screenshot('06-mummy-choose-target-base', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 2 || option.value?.baseDefId === 'base_the_factory',
            '木乃伊埋到第三个基地',
        );

        await settleAfterScoringChain(game, page);
        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.turnOrder?.[state?.core?.currentPlayerIndex] === '1'
                    && !state?.sys?.interaction?.current
                    && !state?.sys?.responseWindow?.current;
            },
            { timeout: 15000, polling: 200 },
        );

        const finalState = await game.getState();
        const replacementBase = finalState?.core?.bases?.[0];
        const kraken = (finalState?.core?.titans ?? []).find((titan: any) => titan?.uid === 't-kraken-setaside');
        const factoryBuried = finalState?.core?.bases?.[2]?.buriedCards ?? [];
        const mothershipMinions = finalState?.core?.bases?.[1]?.minions ?? [];

        expect(replacementBase?.defId).toBe('base_secret_garden');
        expect(kraken?.location).toEqual(expect.objectContaining({ zone: 'base', baseIndex: 0 }));
        expect(factoryBuried.some((card: any) => card.uid === 'mummy-0' && card.defId === 'ancient_egyptians_mummy')).toBe(true);
        expect(mothershipMinions.some((minion: any) => minion.uid === 'mate-0')).toBe(true);
        expect((finalState?.core?.triggerQueue ?? []).length).toBe(0);

        await game.screenshot('07-final-replacement-base-with-kraken', testInfo);
    });
});
