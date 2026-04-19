import { test, expect } from '../framework';

const SMASHUP_CHAMPIONS_QUERY = {
    p0: 'giant_ants,vampires',
    p1: 'pirates,ninjas',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 24680,
};

test.describe('SmashUp - 我们乃最强 afterScoring 回归', () => {
    test('计分后应通过快照来源完成 source -> target -> amount 链，并把指示物转移给存活随从', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', SMASHUP_CHAMPIONS_QUERY, 45000);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'champ-card', defId: 'giant_ant_we_are_the_champions', type: 'action' },
                ],
                factions: ['giant_ants', 'vampires'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['pirates', 'ninjas'],
            },
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'scoring-source', defId: 'giant_ant_worker', baseIndex: 0, owner: '0', controller: '0', basePower: 25, powerCounters: 2 },
                        { uid: 'scoring-rival', defId: 'ninja_shinobi', baseIndex: 0, owner: '1', controller: '1', basePower: 5, powerCounters: 0 },
                    ],
                },
                {
                    defId: 'base_central_brain',
                    minions: [
                        { uid: 'support-minion', defId: 'giant_ant_soldier', baseIndex: 1, owner: '0', controller: '0', basePower: 3, powerCounters: 0 },
                    ],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');
        await game.advancePhase();

        await game.waitForPhase('scoreBases', 10000);
        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const windowType = state?.sys?.responseWindow?.current?.windowType;
                return state?.sys?.phase === 'scoreBases' && (windowType === 'meFirst' || windowType === 'afterScoring');
            },
            { timeout: 10000, polling: 200 },
        );
        await expect(page.getByTestId('me-first-overlay')).toBeVisible();

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const windowType = await page.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.responseWindow?.current?.windowType ?? null;
            });
            if (windowType === 'afterScoring') {
                break;
            }
            if (windowType !== 'meFirst') {
                throw new Error(`推进到 afterScoring 前遇到意外响应窗口: ${windowType}`);
            }
            await game.passResponseWindow();
        }

        await game.waitForResponseWindow('afterScoring', 10000);
        await game.screenshot('champions-after-scoring-window', testInfo);

        await game.playCard('giant_ant_we_are_the_champions', { targetBaseIndex: 0 });

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const state = await game.getState();
            if (!state.sys.responseWindow?.current) {
                break;
            }
            await game.passResponseWindow();
        }

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const sourceId = state?.sys?.interaction?.current?.data?.sourceId;
                return sourceId === 'giant_ant_we_are_the_champions_choose_snapshot_source'
                    || sourceId === 'giant_ant_we_are_the_champions_choose_source';
            },
            { timeout: 10000, polling: 200 },
        );
        await game.screenshot('champions-choose-source', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option?.value?.minionUid === 'scoring-source',
            '计分后离场的来源随从',
        );

        await game.waitForInteraction('giant_ant_we_are_the_champions_choose_target', 10000);
        await game.selectInteractionOptionBy(
            (option: any) => option?.value?.minionUid === 'support-minion',
            '接收指示物的存活随从',
        );

        await game.waitForInteraction('giant_ant_we_are_the_champions_choose_amount', 10000);
        const slider = page.getByLabel('slider-choice');
        await expect(slider).toBeVisible();
        await slider.evaluate((element) => {
            const input = element as HTMLInputElement;
            input.value = '2';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await game.screenshot('champions-choose-amount', testInfo);

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const interaction = state?.sys?.interaction?.current;
            if (!interaction) {
                throw new Error('choose_amount interaction not found');
            }
            harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: interaction.playerId,
                payload: { optionId: 'confirm-transfer', mergedValue: { amount: 2, value: 2 } },
            });
        });
        await game.waitForNoInteraction(10000);

        const player0 = await game.getPlayerState('0');
        const supportMinion = (await game.getState()).core.bases[1].minions.find((minion: any) => minion.uid === 'support-minion');

        expect(player0.discard.some((card: any) => card.defId === 'giant_ant_we_are_the_champions')).toBe(true);
        expect(supportMinion?.powerCounters).toBe(2);

        await game.screenshot('champions-final-state', testInfo);
    });
});
