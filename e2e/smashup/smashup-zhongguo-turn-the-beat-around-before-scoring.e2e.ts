import { test, expect } from '../framework';

type InteractionOption = {
    value?: {
        minionUid?: string;
    };
};

async function closeMagnifyOverlayIfVisible(page: any): Promise<void> {
    const overlay = page.getByTestId('su-card-magnify-overlay');
    if (!(await overlay.isVisible().catch(() => false))) return;

    const closeButton = overlay.getByRole('button').first();
    if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
    } else {
        await page.keyboard.press('Escape');
    }
    await expect(overlay).toBeHidden({ timeout: 5000 });
}

test.describe('SmashUp - zhongguo 节拍一转 beforeScoring 链路', () => {
    test('计分前从真实响应窗口打出节拍一转，先给己方随从 +1 再让同基地一个随从 -1', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'beat-card', defId: 'truckers_turn_the_beat_around', type: 'action', owner: '0' },
                ],
                factions: ['truckers', 'vigilantes'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['disco_dancers', 'kung_fu_fighters'],
            },
            bases: [
                {
                    defId: 'base_the_greasy_spoon',
                    minions: [],
                },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    bases: [
                        {
                            defId: 'base_the_greasy_spoon',
                            minions: [
                                {
                                    uid: 'ally-target',
                                    defId: 'truckers_good_buddy',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 18,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'ally-penalty',
                                    defId: 'truckers_rubber_chicken',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 2,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'ally-filler-1',
                                    defId: 'truckers_skinny_minnie',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 1,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'ally-filler-2',
                                    defId: 'vigilantes_foxy_green',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 1,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [
                                { uid: 'convoy-1', defId: 'truckers_convoy', ownerId: '0' },
                            ],
                        },
                    ],
                },
            },
        });

        await game.waitForPhase('playCards');
        await game.waitForCurrentPlayer('0');

        const finishButton = page.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible();
        await finishButton.click();
        await page.waitForTimeout(1000);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const windowType = state?.sys?.responseWindow?.current?.windowType;
                return state?.sys?.phase === 'scoreBases' && (windowType === 'meFirst' || windowType === 'afterScoring');
            },
            { timeout: 10000, polling: 200 },
        );

        const meFirstVisible = await page.getByTestId('me-first-overlay').isVisible().catch(() => false);
        if (meFirstVisible) {
            await expect(page.getByTestId('me-first-pass-button')).toBeVisible();
        }

        await game.playCard('truckers_turn_the_beat_around', { targetBaseIndex: 0 });
        await game.waitForInteraction('truckers_turn_the_beat_around', 10000);
        await game.screenshot('zhongguo-turn-the-beat-around-window', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'ally-target',
            '节拍一转选择增益目标',
        );

        await game.waitForInteraction('truckers_turn_the_beat_around_penalty', 10000);
        await game.screenshot('zhongguo-turn-the-beat-around-penalty', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'ally-filler-2',
            '节拍一转选择减益目标',
        );

        await closeMagnifyOverlayIfVisible(page);
        await page.mouse.move(8, 8);
        await page.waitForTimeout(250);
        await game.screenshot('zhongguo-turn-the-beat-around-resolved-before-pass', testInfo);

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const state = await game.getState();
            if (!state.sys.responseWindow?.current && !state.sys.interaction?.current) {
                break;
            }
            if (state.sys.interaction?.current) {
                await page.waitForTimeout(300);
                continue;
            }
            await game.passResponseWindow();
        }
        await game.waitForNoInteraction(10000);

        const finalState = await game.getState();
        const targetBase = finalState.core.bases[0];
        const ally = targetBase.minions.find((minion: any) => minion.uid === 'ally-target');
        const penaltyTarget = targetBase.minions.find((minion: any) => minion.uid === 'ally-filler-2');

        expect(ally?.tempPowerModifier).toBe(1);
        expect(penaltyTarget?.tempPowerModifier).toBe(-1);
        expect(finalState.core.pendingAfterScoringSpecials ?? []).toHaveLength(0);
        expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
        expect(finalState.sys.interaction?.current ?? null).toBeNull();
        expect(finalState.sys.responseWindow?.current ?? null).toBeNull();

        await closeMagnifyOverlayIfVisible(page);
        await page.mouse.move(8, 8);
        await page.waitForTimeout(250);
        await game.screenshot('zhongguo-turn-the-beat-around-final-state', testInfo);
    });
});
