import { test, expect } from '../framework';
import type { Page } from '@playwright/test';

type InteractionOption = {
    id: string;
    value?: {
        minionUid?: string;
        mode?: string;
    };
};

type SmashUpCardSnapshot = {
    uid: string;
    defId: string;
};

type SmashUpMinionSnapshot = {
    uid: string;
    powerCounters?: number;
    metadata?: Record<string, unknown>;
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
        turnNumber?: number;
        players: Record<string, {
            hand: SmashUpCardSnapshot[];
            deck: SmashUpCardSnapshot[];
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
            set?: (state: SmashUpHarnessState) => void | Promise<void>;
        };
        command?: {
            dispatch?: (command: { type: string; playerId: string; payload: Record<string, unknown> }) => Promise<void>;
        };
    };
};

async function markMulanReceivedCounterThisTurn(page: Page, minionUid: string): Promise<void> {
    await page.evaluate((uid) => {
        const harness = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state || !harness?.state?.set) {
            throw new Error('TestHarness state is not available');
        }

        const next = structuredClone(state) as SmashUpHarnessState;
        next.core.turnNumber = next.core.turnNumber ?? 1;
        const minion = next.core.bases.flatMap(base => base.minions).find(candidate => candidate.uid === uid);
        if (!minion) {
            throw new Error(`Mulan minion not found: ${uid}`);
        }
        minion.powerCounters = Math.max(1, minion.powerCounters ?? 0);
        minion.metadata = {
            ...(minion.metadata ?? {}),
            mulan_mulan_power_counter_turn: next.core.turnNumber,
        };
        return harness.state.set(next);
    }, minionUid);
}

async function dispatchSmashUpCommand(
    page: Page,
    type: string,
    payload: Record<string, unknown>,
    playerId = '0',
): Promise<void> {
    await page.evaluate(async ({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as SmashUpHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) {
            throw new Error('TestHarness command dispatcher is not available');
        }
        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, { commandType: type, commandPayload: payload, commandPlayerId: playerId });
    await page.waitForTimeout(300);
}

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

    test('花木兰二选一效果必须在真实页面等待玩家选择分支', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('smashup', {
            p0: 'mulan,frozen',
            p1: 'lion_king,aladdin',
            skipFactionSelect: true,
            skipInitialization: false,
        }, 45000);

        await game.setupScene({
            gameId: 'smashup',
            currentPlayer: '0',
            phase: 'playCards',
            player0: {
                factions: ['mulan', 'frozen'],
                hand: [],
                deck: [
                    { uid: 'mulan-draw-card', defId: 'frozen_snowgie', type: 'minion', owner: '0' },
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
            },
            player1: {
                factions: ['lion_king', 'aladdin'],
                hand: [],
                deck: [],
                discard: [],
            },
            bases: [
                {
                    defId: 'base_training_camp',
                    minions: [
                        {
                            uid: 'mulan-choice',
                            defId: 'mulan_mulan',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerCounters: 1,
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
        await markMulanReceivedCounterThisTurn(page, 'mulan-choice');

        await expect(page.locator('[data-minion-uid="mulan-choice"]')).toBeVisible({ timeout: 15000 });
        await game.screenshot('mulan-mode-choice-ready', testInfo);

        await dispatchSmashUpCommand(page, 'su:use_talent', { minionUid: 'mulan-choice', baseIndex: 0 });
        await game.waitForInteraction('disney_four_factions_prompt', 10000);
        await expect(page.getByText('木兰：选择效果')).toBeVisible({ timeout: 10000 });
        await game.screenshot('mulan-mode-choice-prompt', testInfo);

        const modeOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(modeOptions.map(option => option.value?.mode).sort()).toEqual(['draw_card', 'extra_action']);
        const beforeChoice = await game.getState() as SmashUpHarnessState;
        expect(beforeChoice.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(beforeChoice.core.players['0'].deck.map(card => card.uid)).toEqual(['mulan-draw-card']);
        expect(beforeChoice.core.players['0'].actionLimit).toBe(1);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.mode === 'draw_card',
            '木兰选择抽一张牌',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState() as SmashUpHarnessState;
            const player0 = state.core.players['0'];
            return {
                handUids: player0.hand.map(card => card.uid),
                deckUids: player0.deck.map(card => card.uid),
                actionLimit: player0.actionLimit,
                interactionOpen: Boolean(state.sys?.interaction?.current),
            };
        }, { timeout: 10000 }).toEqual({
            handUids: ['mulan-draw-card'],
            deckUids: [],
            actionLimit: 1,
            interactionOpen: false,
        });

        await game.screenshot('mulan-mode-choice-draw-resolved', testInfo);
    });
});
