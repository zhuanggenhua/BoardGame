import { test, expect } from '../framework';

test.describe('SmashUp afterScoring 简化验证', () => {
    test('点击 FINISH 后应进入 afterScoring 响应窗口', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await game.openTestGame('smashup');

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [
                    { uid: 'card-afterscoring-1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                ],
                field: [],
                factions: ['giant_ants', 'aliens'],
            },
            player1: {
                field: [],
                factions: ['ninjas', 'wizards'],
            },
            bases: [
                { defId: 'base_the_jungle', minions: [] },
            ],
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    bases: [
                        {
                            defId: 'base_the_jungle',
                            minions: [
                                {
                                    uid: 'minion-p0-1',
                                    defId: 'test_minion',
                                    owner: '0',
                                    controller: '0',
                                    basePower: 13,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'minion-p1-1',
                                    defId: 'test_minion',
                                    owner: '1',
                                    controller: '1',
                                    basePower: 8,
                                    powerModifier: 0,
                                    powerCounters: 0,
                                    tempPowerModifier: 0,
                                    talentUsed: false,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                    ],
                },
            },
        });

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.factionSelection === undefined
                    && state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'card-afterscoring-1')
                    && state?.core?.bases?.[0]?.minions?.length === 2;
            },
            { timeout: 5000 }
        );

        const finishButton = page.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible();
        await finishButton.click();
        await page.waitForTimeout(1000);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
                const windowType = state?.sys?.responseWindow?.current?.windowType;
                return state?.sys?.phase === 'scoreBases'
                    && (windowType === 'afterScoring' || windowType === 'meFirst');
            },
            { timeout: 15000 }
        );

        const responseState = await page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return {
                windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                currentResponder: state?.sys?.responseWindow?.current?.responderQueue?.[
                    state?.sys?.responseWindow?.current?.currentResponderIndex ?? 0
                ] ?? null,
                interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        });

        expect(['afterScoring', 'meFirst']).toContain(responseState.windowType);
        expect(responseState.currentResponder).toBe('0');

        const overlayVisible = await page.getByTestId('me-first-overlay').isVisible().catch(() => false);
        if (overlayVisible) {
            await expect(page.getByTestId('me-first-status')).toBeVisible();
            await expect(page.getByTestId('me-first-pass-button')).toBeVisible();
            await expect(page.locator('[data-card-uid="card-afterscoring-1"]')).toBeVisible();
        } else {
            expect(responseState.interactionSourceId).toBe('smashup_reaction_choose');
            await expect(page.getByRole('button', { name: /让过|Pass|Skip/i }).first()).toBeVisible();
            await expect(page.getByRole('button', { name: /我们乃最强/i }).first()).toBeVisible();
        }

        await game.screenshot('smashup-afterscoring-simple-complete', testInfo);
    });
});
