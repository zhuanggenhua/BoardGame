import { test, expect } from '../framework';

async function waitForFirstMateSequenceStart(game: {
    getState: () => Promise<any>;
    passResponseWindow: (playerId?: string) => Promise<void>;
}, page: {
    waitForTimeout: (ms: number) => Promise<void>;
}, timeoutMs = 20000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const state = await game.getState();
        const sourceId = state?.sys?.interaction?.current?.data?.sourceId ?? null;
        const windowType = state?.sys?.responseWindow?.current?.windowType ?? null;
        const options = state?.sys?.interaction?.current?.data?.options ?? [];
        const hasRealTriggerOption = options.some((option: any) =>
            option?.id !== 'skip'
            && option?.id !== 'pass'
            && option?.value?.kind !== 'pass'
            && option?.value?.skip !== true,
        );

        if (sourceId === 'pirate_first_mate_choose_base') {
            return;
        }

        if (sourceId === 'smashup_reaction_choose' && hasRealTriggerOption) {
            return;
        }

        if (windowType === 'meFirst' || windowType === 'afterScoring') {
            await game.passResponseWindow();
            continue;
        }

        await page.waitForTimeout(250);
    }

    throw new Error('等待 4P 大副 afterScoring 触发超时');
}

function makePlayer(id: string, factions: [string, string]) {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        factions,
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
    };
}

function makeMinion(uid: string, defId: string, owner: string, basePower: number) {
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
    };
}

async function openFourPlayerTestGame(game: {
    openTestGame: (gameId: string, query?: Record<string, string | number | boolean>) => Promise<void>;
}) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await game.openTestGame('smashup', {
                numPlayers: 4,
                skipInitialization: true,
                seat0: 'human',
                seat1: 'human',
                seat2: 'human',
                seat3: 'human',
            });
            return;
        } catch (error) {
            lastError = error;
            if (attempt === 3) throw error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('openFourPlayerTestGame failed');
}

test.describe('SmashUp 4P First Mate afterScoring 顺序', () => {
    test('真实端到端：四个大副在同一计分基地上时，会按 0/1/2/3 顺序依次移动', async ({ game, page }, testInfo) => {
        test.setTimeout(180000);

        const expectedPlayers = ['0', '1', '2', '3'];
        const expectedMates = ['mate-p0', 'mate-p1', 'mate-p2', 'mate-p3'];
        const destinationByPlayer: Record<string, string> = {
            '0': 'base_secret_garden',
            '1': 'base_the_factory',
            '2': 'base_secret_garden',
            '3': 'base_central_brain',
        };

        await openFourPlayerTestGame(game);
        await game.setupScene({
            gameId: 'smashup',
            phase: 'playCards',
            currentPlayer: '0',
            extra: {
                core: {
                    turnOrder: ['0', '1', '2', '3'],
                    currentPlayerIndex: 0,
                    turnNumber: 9,
                    players: {
                        '0': makePlayer('0', ['pirates', 'ninjas']),
                        '1': makePlayer('1', ['aliens', 'wizards']),
                        '2': makePlayer('2', ['robots', 'ghosts']),
                        '3': makePlayer('3', ['dinosaurs', 'zombies']),
                    },
                    bases: [
                        {
                            defId: 'base_the_jungle',
                            minions: [
                                makeMinion('mate-p0', 'pirate_first_mate', '0', 2),
                                makeMinion('body-p0', 'test_minion', '0', 6),
                                makeMinion('mate-p1', 'pirate_first_mate', '1', 2),
                                makeMinion('body-p1', 'test_minion', '1', 5),
                                makeMinion('mate-p2', 'pirate_first_mate', '2', 2),
                                makeMinion('body-p2', 'test_minion', '2', 4),
                                makeMinion('mate-p3', 'pirate_first_mate', '3', 2),
                                makeMinion('body-p3', 'test_minion', '3', 3),
                            ],
                            ongoingActions: [],
                        },
                        {
                            defId: 'base_secret_garden',
                            minions: [],
                            ongoingActions: [],
                        },
                        {
                            defId: 'base_the_factory',
                            minions: [],
                            ongoingActions: [],
                        },
                        {
                            defId: 'base_central_brain',
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    baseDeck: ['base_tar_pits'],
                    factionSelection: undefined,
                    scoringEligibleBases: undefined,
                },
            },
        });

        await expect.poll(async () => {
            const text = await page.evaluate(() => document.body?.innerText ?? '');
            return text.includes('Loading match resources...');
        }, { timeout: 20000 }).toBe(false);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.turnOrder?.length === 4
                    && state?.core?.bases?.[0]?.defId === 'base_the_jungle'
                    && state?.core?.bases?.[0]?.minions?.length === 8;
            },
            { timeout: 30000, polling: 200 },
        );

        await game.screenshot('01-initial-4p-first-mates', testInfo);

        await game.advancePhase();
        await waitForFirstMateSequenceStart(game, page, 20000);

        let reactionChooseCount = 0;
        const matePromptPlayers: string[] = [];

        for (let step = 0; step < 16; step += 1) {
            const state = await game.getState();
            const current = state?.sys?.interaction?.current;
            if (!current) break;

            const sourceId = current?.data?.sourceId ?? '';
            if (sourceId === 'smashup_reaction_choose') {
                reactionChooseCount += 1;

                const triggerOption = (current.data?.options ?? []).find((option: any) =>
                    option.id !== 'skip'
                    && option.id !== 'pass'
                    && option.value?.kind === 'trigger',
                );
                expect(triggerOption, `未找到第 ${reactionChooseCount} 个大副 trigger`).toBeTruthy();
                await game.selectOption(triggerOption.id);
                continue;
            }

            if (sourceId === 'pirate_first_mate_choose_base') {
                const promptPlayerId = current.playerId;
                expect(promptPlayerId).toBe(expectedPlayers[matePromptPlayers.length]);
                matePromptPlayers.push(promptPlayerId);

                if (matePromptPlayers.length === 1) {
                    await game.screenshot('02-first-mate-first-prompt', testInfo);
                }
                if (matePromptPlayers.length === 4) {
                    await game.screenshot('03-first-mate-last-prompt', testInfo);
                }

                const destinationOption = (current.data?.options ?? []).find((option: any) =>
                    option.value?.baseDefId === destinationByPlayer[promptPlayerId],
                );
                expect(destinationOption, `未找到玩家 ${promptPlayerId} 的目标基地`).toBeTruthy();
                await game.selectOption(destinationOption.id);
                continue;
            }

            throw new Error(`未预期的交互 sourceId: ${sourceId}`);
        }

        expect(matePromptPlayers).toEqual(expectedPlayers);

        await game.waitForNoInteraction(20000);
        await game.waitForPhase('playCards', 20000);
        await game.waitForCurrentPlayer('1', 20000);

        const finalState = await game.getState();
        const mateMoveEvents = (finalState?.sys?.eventStream?.entries ?? []).filter((entry: any) =>
            entry?.event?.type === 'su:minion_moved'
            && entry?.event?.payload?.reason === 'pirate_first_mate',
        );

        expect(mateMoveEvents).toHaveLength(4);
        expect(mateMoveEvents.map((entry: any) => entry.event.payload.minionUid)).toEqual(expectedMates);
        expect(mateMoveEvents.map((entry: any) => entry.event.payload.toBaseIndex)).toEqual([1, 2, 1, 3]);

        expect(finalState?.core?.bases?.[0]?.defId).toBe('base_tar_pits');
        expect((finalState?.core?.bases?.[0]?.minions ?? []).map((minion: any) => minion.uid)).not.toEqual(
            expect.arrayContaining(expectedMates),
        );
        expect((finalState?.core?.bases?.[1]?.minions ?? []).map((minion: any) => minion.uid)).toEqual(
            expect.arrayContaining(['mate-p0', 'mate-p2']),
        );
        expect((finalState?.core?.bases?.[2]?.minions ?? []).map((minion: any) => minion.uid)).toEqual(
            expect.arrayContaining(['mate-p1']),
        );
        expect((finalState?.core?.bases?.[3]?.minions ?? []).map((minion: any) => minion.uid)).toEqual(
            expect.arrayContaining(['mate-p3']),
        );

        await game.screenshot('04-final-4p-first-mates-resolved', testInfo);
    });
});
