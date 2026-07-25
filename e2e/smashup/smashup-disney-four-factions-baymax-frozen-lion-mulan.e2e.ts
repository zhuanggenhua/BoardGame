import { test, expect } from '../framework';

type InteractionOption = {
    id: string;
    value?: {
        minionUid?: string;
    };
};

type SmashUpCardSnapshot = {
    uid: string;
    defId: string;
};

type SmashUpMinionSnapshot = {
    uid: string;
    powerCounters?: number;
};

type SmashUpHarnessState = {
    sys?: {
        phase?: string;
        interaction?: {
            current?: {
                data?: {
                    sourceId?: string;
                    targetType?: string;
                    options?: InteractionOption[];
                };
            };
        };
    };
    core: {
        players: Record<string, {
            hand: SmashUpCardSnapshot[];
            discard: SmashUpCardSnapshot[];
            actionsPlayed: number;
            actionLimit: number;
        }>;
        bases: Array<{
            minions: SmashUpMinionSnapshot[];
        }>;
    };
};

type SmashUpHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => SmashUpHarnessState;
        };
    };
};

test.describe('SmashUp - 迪士尼四派系代表性交互', () => {
    test('超能陆战队升级应从真实打牌入口打开 Disney 选择并给角色放力量标记', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            p0: 'big_hero_6,frozen',
            p1: 'lion_king,mulan',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['big_hero_6', 'frozen'],
                hand: [
                    { uid: 'hand-upgrades', defId: 'big_hero_6_upgrades', type: 'action', owner: '0' },
                ],
                deck: [
                    { uid: 'draw-after-counter', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['lion_king', 'mulan'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_sfit_robotics_lab',
                    minions: [
                        {
                            uid: 'microbot-target',
                            defId: 'big_hero_6_microbot_swarm',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                        {
                            uid: 'enemy-anchor',
                            defId: 'mulan_mushu',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await page.waitForFunction(
            () => {
                const state = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'playCards'
                    && state?.core?.players?.['0']?.hand?.some(card => card.uid === 'hand-upgrades')
                    && state?.core?.bases?.[0]?.minions?.some(minion => minion.uid === 'microbot-target');
            },
            { timeout: 5000 },
        );
        await game.screenshot('disney-upgrades-ready', testInfo);

        await game.playCard('big_hero_6_upgrades');
        await game.waitForInteraction('disney_four_factions_prompt', 10000);

        await page.waitForFunction(
            () => {
                const state = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                const current = state?.sys?.interaction?.current;
                return current?.data?.sourceId === 'disney_four_factions_prompt'
                    && current?.data?.targetType === 'minion'
                    && current?.data?.options?.some(option => option?.value?.minionUid === 'microbot-target');
            },
            { timeout: 5000 },
        );
        await game.screenshot('disney-upgrades-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'microbot-target',
            '升级目标微型机器群',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as SmashUpHarnessState;
            const player0 = state.core.players['0'];
            const microbot = state.core.bases[0].minions.find(minion => minion.uid === 'microbot-target');
            return {
                microbotCounters: microbot?.powerCounters ?? 0,
                cardStillInHand: player0.hand.some(card => card.uid === 'hand-upgrades'),
                drewSeedCard: player0.hand.some(card => card.uid === 'draw-after-counter'),
                discardHasUpgrades: player0.discard.some(card => card.defId === 'big_hero_6_upgrades'),
                actionsPlayed: player0.actionsPlayed,
                actionLimit: player0.actionLimit,
                interactionOpen: Boolean(state.sys.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            microbotCounters: 2,
            cardStillInHand: false,
            drewSeedCard: true,
            discardHasUpgrades: true,
            actionsPlayed: 1,
            actionLimit: 2,
            interactionOpen: false,
        });

        await game.screenshot('disney-upgrades-resolved', testInfo);
    });
});
