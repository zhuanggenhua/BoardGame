import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS } from '../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    resolveInteractionChain,
} from './helpers';
import { runCommand } from './testRunner';

function chooseOptionBySource(prompt: any, sourceId: string, predicate: (option: any) => boolean) {
    expect(getPromptSourceId(prompt)).toBe(sourceId);
    const option = getPromptOption(prompt, predicate, `option for ${sourceId}`);
    return { optionId: option.id };
}

describe('shayu 全面审计补充 L2 行为覆盖', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('鲨鱼：巨齿鲨从真实随从入口打出后，可选择消灭同基地力量≤4随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('mega', 'sharks_megalodon', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_wooden_horse', [
                makeMinion('low-target', 'tornados_twister', '1', 4),
                makeMinion('high-target', 'tornados_monster_tornado', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'mega', baseIndex: 0 },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'high-target')).toBe(false);
            return chooseOptionBySource(prompt, 'sharks_megalodon', (option) => option.value?.minionUid === 'low-target');
        });

        const minions = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minions).toContain('mega');
        expect(minions).not.toContain('low-target');
        expect(minions).toContain('high-target');
    });

    it('鲨鱼：大白鲨天赋移动自身到另一个基地，并只消灭移动后基地力量≤2目标', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [makeMinion('great-white', 'sharks_great_white', '0', 4)]),
                makeBase('base_the_deep', [
                    makeMinion('low-target', 'tornados_dust_devil', '1', 2),
                    makeMinion('high-target', 'tornados_twister', '1', 4),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'great-white', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const resolved = resolveInteractionChain(talent.finalState, (prompt) =>
            chooseOptionBySource(prompt, 'sharks_great_white', (option) => option.value?.baseIndex === 1));

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'great-white')).toBe(false);
        const targetBaseMinions = resolved.finalState.core.bases[1].minions.map(minion => minion.uid);
        expect(targetBaseMinions).toContain('great-white');
        expect(targetBaseMinions).not.toContain('low-target');
        expect(targetBaseMinions).toContain('high-target');
    });

    it('鲨鱼：灰鲭鲨在你消灭随从后，只允许立即额外打出手牌中的灰鲭鲨到该基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('torn', 'sharks_torn_apart', 'action', '0'),
                        makeCard('mako-extra', 'sharks_mako', 'minion', '0'),
                        makeCard('other-minion', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [makeMinion('victim', 'tornados_dust_devil', '1', 2)]),
                makeBase('base_the_deep', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        let chosenExtra = false;
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }
            if (sourceId === 'smashup_immediate_extra_minion_base') {
                expect(getPromptOptions(prompt).some((option: any) => option.value?.baseIndex === 1)).toBe(false);
                return chooseOptionBySource(prompt, 'smashup_immediate_extra_minion_base', option => option.value?.baseIndex === 0);
            }
            expect(sourceId).toBe('smashup_immediate_extra_minion');
            if (chosenExtra) {
                return { optionId: getPromptOption(prompt, (option: any) => option.value?.skip, 'skip extra minion option').id };
            }
            chosenExtra = true;
            expect(getPromptOptions(prompt).some((option: any) => option.value?.cardUid === 'other-minion')).toBe(false);
            const mako = getPromptOption(prompt, (option: any) => option.value?.cardUid === 'mako-extra', 'Mako extra minion option');
            return { optionId: mako.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'mako-extra')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'mako-extra')).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'other-minion')).toBe(true);
    });

    it('鲨鱼：血腥水域在该基地有随从被消灭后，只允许立即额外打出力量≤3随从到该基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('torn', 'sharks_torn_apart', 'action', '0'),
                        makeCard('small-extra', 'mythic_greeks_spartan', 'minion', '0'),
                        makeCard('big-extra', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_shark_reef',
                    minions: [makeMinion('victim', 'tornados_dust_devil', '1', 2)],
                    ongoingActions: [{ uid: 'blood', defId: 'sharks_blood_in_the_water', ownerId: '0' }],
                }),
                makeBase('base_the_deep', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        let chosenExtra = false;
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }
            if (sourceId === 'smashup_immediate_extra_minion_base') {
                expect(getPromptOptions(prompt).some((option: any) => option.value?.baseIndex === 1)).toBe(false);
                return chooseOptionBySource(prompt, 'smashup_immediate_extra_minion_base', option => option.value?.baseIndex === 0);
            }
            expect(sourceId).toBe('smashup_immediate_extra_minion');
            if (chosenExtra) {
                return { optionId: getPromptOption(prompt, (option: any) => option.value?.skip, 'skip extra minion option').id };
            }
            chosenExtra = true;
            expect(getPromptOptions(prompt).some((option: any) => option.value?.cardUid === 'big-extra')).toBe(false);
            const small = getPromptOption(prompt, (option: any) => option.value?.cardUid === 'small-extra', 'small extra minion option');
            return { optionId: small.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'small-extra')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'small-extra')).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'big-extra')).toBe(true);
    });

    it('鲨鱼：鲨鱼领地按 destroyerId 让消灭者给自己的任意随从放置指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('torn', 'sharks_torn_apart', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [
                    makeMinion('victim', 'tornados_dust_devil', '1', 2),
                    makeMinion('enemy-other', 'sharks_mako', '1', 2),
                ]),
                makeBase('base_the_deep', [makeMinion('destroyer-minion', 'sharks_hammerhead', '0', 3)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            if (getPromptSourceId(prompt) === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }

            expect(getPromptSourceId(prompt)).toBe('base_shark_reef');
            expect(getPromptPlayerId(prompt)).toBe('0');
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'enemy-other')).toBe(false);
            return chooseOptionBySource(prompt, 'base_shark_reef', option => option.value?.minionUid === 'destroyer-minion');
        });

        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'destroyer-minion')?.powerCounters).toBe(1);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-other')?.powerCounters ?? 0).toBe(0);
    });

    it('神话希腊：阿佛洛狄忒的恩惠授予额外随从额度，能在已打出一个随从后再打出第二个随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('aphrodite', 'mythic_greeks_favor_of_aphrodite', 'action', '0'),
                        makeCard('extra-minion', 'mythic_greeks_spartan', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_oracle_at_delphi', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const playAction = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'aphrodite' },
        } as any);

        expect(playAction.success).toBe(true);
        expect(playAction.finalState.core.players['0'].minionLimit).toBe(2);

        const playMinion = runCommand(playAction.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'extra-minion', baseIndex: 0 },
        } as any);

        expect(playMinion.success).toBe(true);
        expect(playMinion.finalState.core.bases[0].minions.some(minion => minion.uid === 'extra-minion')).toBe(true);
    });

    it('神话希腊：伊阿宋触发后选择基地给己方随从+1，且跨基地选择也会标记本回合已用', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hermes-a', 'mythic_greeks_favor_of_hermes', 'action', '0'),
                        makeCard('hermes-b', 'mythic_greeks_favor_of_hermes', 'action', '0'),
                    ],
                    actionLimit: 3,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [makeMinion('jason', 'mythic_greeks_jason', '0', 3)]),
                makeBase('base_wooden_horse', [
                    makeMinion('own-target', 'sharks_mako', '0', 2),
                    makeMinion('enemy-target', 'tornados_dust_devil', '1', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const firstAction = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hermes-a' },
        } as any);

        expect(firstAction.success).toBe(true);
        const afterJason = resolveInteractionChain(firstAction.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            return chooseOptionBySource(prompt, 'mythic_greeks_jason', option => option.value?.baseIndex === 1);
        }).finalState;

        expect(afterJason.core.bases[1].minions.find(minion => minion.uid === 'own-target')?.tempPowerModifier).toBe(1);
        expect(afterJason.core.bases[1].minions.find(minion => minion.uid === 'enemy-target')?.tempPowerModifier ?? 0).toBe(0);
        expect(afterJason.core.bases[0].minions.find(minion => minion.uid === 'jason')?.metadata?.mythicGreeksJasonTriggeredTurn).toBe(1);

        const secondAction = runCommand(afterJason, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hermes-b' },
        } as any);

        expect(secondAction.success).toBe(true);
        expect(secondAction.finalState.core.triggerQueue ?? []).toEqual([]);
        expectNoPrompt(secondAction.finalState);
    });

    it('鲨鱼：鲨鱼诱饵附着随从后，该基地任意随从被消灭会给附着随从+1', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('torn', 'sharks_torn_apart', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('baited', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'chum', defId: 'sharks_chum', ownerId: '0' }],
                }),
                makeMinion('victim', 'tornados_dust_devil', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'torn' },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            if (getPromptSourceId(prompt) === 'sharks_torn_apart') {
                return chooseOptionBySource(prompt, 'sharks_torn_apart', option => option.value?.minionUid === 'victim');
            }
            const skip = getPromptOption(prompt, (option: any) => option.value?.skip, 'skip option');
            return { optionId: skip.id };
        });

        const base = resolved.finalState.core.bases[0];
        expect(base.minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(base.minions.find(minion => minion.uid === 'baited')?.powerCounters).toBe(1);
    });

    it('鲨鱼基地：海渊在力量4+随从打入后，只允许消灭同基地更低力量随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('big', 'sharks_great_white', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('lower', 'tornados_dust_devil', '1', 2),
                makeMinion('equal-or-higher', 'tornados_monster_tornado', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'big', baseIndex: 0 },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            expect(getPromptSourceId(prompt)).toBe('base_the_deep');
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'big')).toBe(false);
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'equal-or-higher')).toBe(false);
            return chooseOptionBySource(prompt, 'base_the_deep', option => option.value?.minionUid === 'lower');
        });

        const minions = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minions).toContain('big');
        expect(minions).not.toContain('lower');
        expect(minions).toContain('equal-or-higher');
    });

    it('神话希腊：哈迪斯的恩惠从弃牌堆行动牌中选择一张回手', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hades', 'mythic_greeks_favor_of_hades', 'action', '0')],
                    discard: [
                        makeCard('recover-me', 'sharks_torn_apart', 'action', '0'),
                        makeCard('stay-action', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                        makeCard('not-action', 'mythic_greeks_spartan', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_oracle_at_delphi', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hades' },
        } as any);

        expect(play.success).toBe(true);
        const hadesPrompt = getSimpleChoicePrompt(play.finalState, 'mythic_greeks_favor_of_hades');
        expect(getPromptOptions(hadesPrompt).some((option: any) => option.value?.cardUid === 'not-action')).toBe(false);

        const resolved = resolveInteractionChain(play.finalState, (prompt) =>
            chooseOptionBySource(prompt, 'mythic_greeks_favor_of_hades', option => option.value?.cardUid === 'recover-me'));

        const player = resolved.finalState.core.players['0'];
        expect(player.hand.map(card => card.uid)).toContain('recover-me');
        expect(player.discard.map(card => card.uid)).toContain('stay-action');
        expect(player.discard.map(card => card.uid)).toContain('not-action');
        expect(player.discard.map(card => card.uid)).toContain('hades');
    });

    it('龙卷风：旋风出场可将力量≤3随从从本基地移出或从其他基地移入', () => {
        const pullCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('twister', 'tornados_twister', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', []),
                makeBase('base_wooden_horse', [
                    makeMinion('pull-low', 'sharks_mako', '1', 2),
                    makeMinion('pull-high', 'tornados_monster_tornado', '1', 4),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const pullPlay = runCommand(makeMatchState(pullCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'twister', baseIndex: 0 },
        } as any);

        expect(pullPlay.success).toBe(true);
        const pulled = resolveInteractionChain(pullPlay.finalState, (prompt) => {
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'pull-high')).toBe(false);
            return chooseOptionBySource(prompt, 'tornados_twister', option => option.value?.minionUid === 'pull-low');
        });
        expect(pulled.finalState.core.bases[0].minions.some(minion => minion.uid === 'pull-low')).toBe(true);
        expect(pulled.finalState.core.bases[1].minions.some(minion => minion.uid === 'pull-low')).toBe(false);

        const pushCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('twister', 'tornados_twister', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [makeMinion('push-low', 'sharks_mako', '0', 2)]),
                makeBase('base_wooden_horse', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const pushPlay = runCommand(makeMatchState(pushCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'twister', baseIndex: 0 },
        } as any);

        expect(pushPlay.success).toBe(true);
        const pushed = resolveInteractionChain(pushPlay.finalState, (prompt, _state, step) => {
            if (step === 0) {
                return chooseOptionBySource(prompt, 'tornados_twister', option => option.value?.minionUid === 'push-low');
            }
            return chooseOptionBySource(prompt, 'tornados_twister_dest', option => option.value?.baseIndex === 1);
        });
        expect(pushed.finalState.core.bases[0].minions.some(minion => minion.uid === 'push-low')).toBe(false);
        expect(pushed.finalState.core.bases[1].minions.some(minion => minion.uid === 'push-low')).toBe(true);
    });

    it('龙卷风：旋风和龙卷风怪物的“你可以移动”效果必须允许跳过', () => {
        const twisterCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('twister', 'tornados_twister', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', []),
                makeBase('base_wooden_horse', [makeMinion('pull-low', 'sharks_mako', '1', 2)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const twisterPlay = runCommand(makeMatchState(twisterCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'twister', baseIndex: 0 },
        } as any);

        expect(twisterPlay.success).toBe(true);
        const skippedTwister = resolveInteractionChain(twisterPlay.finalState, (prompt) => {
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'pull-low')).toBe(true);
            return chooseOptionBySource(prompt, 'tornados_twister', option => option.value?.skip === true);
        });
        expect(skippedTwister.finalState.core.bases[0].minions.some(minion => minion.uid === 'pull-low')).toBe(false);
        expect(skippedTwister.finalState.core.bases[1].minions.some(minion => minion.uid === 'pull-low')).toBe(true);
        expectNoPrompt(skippedTwister.finalState);

        const monsterCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_shark_reef', [makeMinion('monster', 'tornados_monster_tornado', '0', 5)]),
                makeBase('base_wooden_horse', [makeMinion('pull-low-4', 'tornados_cyclone', '1', 4)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const monsterTalent = runCommand(makeMatchState(monsterCore), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster', baseIndex: 0 },
        } as any);

        expect(monsterTalent.success).toBe(true);
        const skippedMonster = resolveInteractionChain(monsterTalent.finalState, (prompt) => {
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'pull-low-4')).toBe(true);
            return chooseOptionBySource(prompt, 'tornados_monster_tornado', option => option.value?.skip === true);
        });
        expect(skippedMonster.finalState.core.bases[0].minions.some(minion => minion.uid === 'pull-low-4')).toBe(false);
        expect(skippedMonster.finalState.core.bases[1].minions.some(minion => minion.uid === 'pull-low-4')).toBe(true);
        expectNoPrompt(skippedMonster.finalState);
    });

    it('龙卷风基地：活动房屋公园在随从移入时自动给该随从+1', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_wooden_horse', [makeMinion('cyclone', 'tornados_cyclone', '0', 4)]),
                makeBase('base_trailer_park', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'cyclone', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const resolved = resolveInteractionChain(talent.finalState, (prompt) =>
            chooseOptionBySource(prompt, 'tornados_cyclone', option => option.value?.baseIndex === 1));

        const moved = resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'cyclone');
        expect(moved).toBeTruthy();
        expect(moved?.powerCounters).toBe(1);
    });

    it('龙卷风基地：龙卷风走廊每回合只触发一次，且自身移动原因不递归再触发', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_wooden_horse', [makeMinion('cyclone', 'tornados_cyclone', '0', 4)]),
                makeBase('base_tornado_alley', []),
                makeBase('base_the_deep', [makeMinion('pulled-once', 'sharks_mako', '1', 2)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'cyclone', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const resolved = resolveInteractionChain(talent.finalState, (prompt, _state, step) => {
            if (step === 0) {
                return chooseOptionBySource(prompt, 'tornados_cyclone', option => option.value?.baseIndex === 1);
            }
            expect(getPromptSourceId(prompt)).toBe('base_tornado_alley');
            return chooseOptionBySource(prompt, 'base_tornado_alley', option => option.value?.minionUid === 'pulled-once');
        });

        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'cyclone')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'pulled-once')).toBe(true);
        expect(resolved.finalState.core.usedBaseAbilitiesThisTurn).toContainEqual({
            playerId: '0',
            baseIndex: 1,
            baseDefId: 'base_tornado_alley',
        });
        expectNoPrompt(resolved.finalState);
    });
});
