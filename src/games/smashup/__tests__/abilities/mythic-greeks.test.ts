import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getEffectiveBreakpoint } from '../../domain/ongoingModifiers';
import { SU_COMMANDS } from '../../domain/types';
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
} from '../helpers';
import { runCommand } from '../testRunner';

function chooseOptionBySource(prompt: any, sourceId: string, predicate: (option: any) => boolean) {
    expect(getPromptSourceId(prompt)).toBe(sourceId);
    const option = getPromptOption(prompt, predicate, `option for ${sourceId}`);
    return { optionId: option.id };
}

describe('神话希腊代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('阿波罗的恩惠抽牌并授予额外行动额度', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-apollo', 'mythic_greeks_favor_of_apollo', 'action', '0')],
                    deck: [makeCard('draw-1', 'mythic_greeks_spartan', 'minion', '0')],
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
        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-apollo' },
        } as any);
        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('赫拉的恩惠可对任意玩家的至多两个随从放置指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-hera', 'mythic_greeks_favor_of_hera', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_oracle_at_delphi', [
                makeMinion('own-a', 'sharks_mako', '0', 2),
                makeMinion('own-b', 'tornados_dust_devil', '0', 2),
                makeMinion('enemy-a', 'sharks_hammerhead', '1', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-hera' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const selectable = getPromptOptions(prompt).filter((option: any) => option.value?.minionUid);
            const a = selectable.find((option: any) => option.value?.minionUid === 'own-a') ?? selectable[0];
            const b = selectable.find((option: any) => option.value?.minionUid === 'enemy-a') ?? selectable[1];
            return { optionIds: [a.id, b.id] };
        });
        const minions = resolved.finalState.core.bases[0].minions;
        expect(minions.find(minion => minion.uid === 'own-a')?.powerCounters).toBe(1);
        expect(minions.find(minion => minion.uid === 'enemy-a')?.powerCounters).toBe(1);
        expect(minions.find(minion => minion.uid === 'own-b')?.powerCounters ?? 0).toBe(0);
    });

    it('波塞冬的恩惠按玩家选择弃牌洗回牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-poseidon', 'mythic_greeks_favor_of_poseidon', 'action', '0')],
                    deck: [makeCard('deck-1', 'mythic_greeks_spartan', 'minion', '0')],
                    discard: [
                        makeCard('discard-a', 'mythic_greeks_favor_of_ares', 'action', '0'),
                        makeCard('discard-b', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                        makeCard('discard-c', 'mythic_greeks_argonaut', 'minion', '0'),
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
            payload: { cardUid: 'a-poseidon' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const a = getPromptOption(prompt, option => option.value?.cardUid === 'discard-a', 'Poseidon discard-a option');
            const c = getPromptOption(prompt, option => option.value?.cardUid === 'discard-c', 'Poseidon discard-c option');
            return { optionIds: [a.id, c.id] };
        });
        const player = resolved.finalState.core.players['0'];
        expect(player.deck.map(card => card.uid)).toEqual(['discard-a', 'discard-c', 'deck-1']);
        expect(player.discard.map(card => card.uid)).toEqual(['discard-b', 'a-poseidon']);
    });

    it('雅典娜的恩惠展示牌库顶5张，由玩家选择行动牌并决定其余回顶顺序', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-athena', 'mythic_greeks_favor_of_athena', 'action', '0')],
                    deck: [
                        makeCard('top-minion-a', 'mythic_greeks_spartan', 'minion', '0'),
                        makeCard('top-action-a', 'mythic_greeks_favor_of_ares', 'action', '0'),
                        makeCard('top-action-pick', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                        makeCard('top-minion-b', 'sharks_mako', 'minion', '0'),
                        makeCard('top-action-c', 'sharks_torn_apart', 'action', '0'),
                        makeCard('deck-rest', 'tornados_dust_devil', 'minion', '0'),
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
            payload: { cardUid: 'a-athena' },
        } as any);
        expect(play.success).toBe(true);
        expect(getSimpleChoicePrompt(play.finalState, 'mythic_greeks_favor_of_athena_pick')).toBeDefined();

        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                const picked = getPromptOption(prompt, option => option.value?.cardUid === 'top-action-pick', 'Athena picked action option');
                return { optionId: picked.id };
            }
            const order = ['top-minion-b', 'top-minion-a', 'top-action-a'];
            const target = getPromptOption(prompt, option => option.value?.cardUid === order[step - 1], 'Athena deck reorder option');
            return { optionId: target.id };
        });

        const player = resolved.finalState.core.players['0'];
        expect(player.hand.map(card => card.uid)).toContain('top-action-pick');
        expect(player.deck.map(card => card.uid)).toEqual([
            'top-minion-b',
            'top-minion-a',
            'top-action-a',
            'top-action-c',
            'deck-rest',
        ]);
    });

    it('狄俄尼索斯的恩惠可选择是否放回牌库顶', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-dionysus', 'mythic_greeks_favor_of_dionysus', 'action', '0')],
                    deck: [makeCard('deck-1', 'mythic_greeks_spartan', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_oracle_at_delphi', [makeMinion('own-a', 'mythic_greeks_spartan', '0', 2)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-dionysus', targetBaseIndex: 0, targetMinionUid: 'own-a' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };
            if (getPromptSourceId(prompt) === 'mythic_greeks_spartan') {
                const skip = getPromptOption(prompt, option => option.value?.skip === true, 'Spartan skip option');
                return { optionId: skip.id };
            }
            if (getPromptSourceId(prompt) === 'mythic_greeks_favor_of_dionysus_minion') {
                const target = getPromptOption(prompt, option => option.value?.minionUid === 'own-a', 'Dionysus minion option');
                return { optionId: target.id };
            }
            const top = getPromptOption(prompt, option => option.value?.choice === 'deck-top', 'Dionysus deck-top option');
            return { optionId: top.id };
        });
        const player = resolved.finalState.core.players['0'];
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'own-a')?.tempPowerModifier).toBe(1);
        expect(player.actionLimit).toBe(2);
        expect(player.deck[0]?.uid).toBe('a-dionysus');
        expect(player.discard.some(card => card.uid === 'a-dionysus')).toBe(false);
    });

    it('阿尔戈英雄可替代行动额度打出，并触发行动态持续能力', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('argonaut-card', 'mythic_greeks_argonaut', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('odysseus', 'mythic_greeks_odysseus', '0', 5),
                    makeMinion('jason', 'mythic_greeks_jason', '0', 4),
                    makeMinion('heracles', 'mythic_greeks_heracles', '0', 4),
                    makeMinion('spartan', 'mythic_greeks_spartan', '0', 2),
                ]),
                makeBase('base_wooden_horse', [
                    makeMinion('jason-target', 'sharks_mako', '0', 2),
                    makeMinion('enemy-target', 'tornados_dust_devil', '1', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'argonaut-card', baseIndex: 0, playAsAction: true },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state, step) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };
            if (step === 1) {
                expect(getPromptSourceId(prompt)).toBe('mythic_greeks_jason');
                const jasonBase = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'Jason target base option');
                expect(jasonBase).toBeTruthy();
                return { optionId: jasonBase.id };
            }
            const odysseus = getPromptOption(prompt, option => option.value?.minionUid === 'odysseus', 'Odysseus counter target option');
            return { optionId: odysseus.id };
        });
        const minions = resolved.finalState.core.bases[0].minions;
        expect(resolved.finalState.core.players['0'].minionsPlayed).toBe(1);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(minions.some(minion => minion.uid === 'argonaut-card')).toBe(true);
        expect(minions.find(minion => minion.uid === 'odysseus')?.powerCounters).toBe(1);
        expect(minions.find(minion => minion.uid === 'heracles')?.tempPowerModifier).toBe(1);
        expect(minions.find(minion => minion.uid === 'spartan')?.powerCounters).toBe(1);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'jason-target')?.tempPowerModifier).toBe(1);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'enemy-target')?.tempPowerModifier ?? 0).toBe(0);
        expect(minions.find(minion => minion.uid === 'jason')?.metadata?.mythicGreeksJasonTriggeredTurn).toBe(1);
    });

    it('特尔斐神谕在打出随从后展示牌库顶，行动牌入手，非行动牌留在牌库顶', () => {
        const actionTopCore = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-a', 'mythic_greeks_spartan', 'minion', '0')],
                    deck: [
                        makeCard('top-action', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                        makeCard('next-card', 'sharks_mako', 'minion', '0'),
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
        const actionTop = runCommand(makeMatchState(actionTopCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'minion-a', baseIndex: 0 },
        } as any);
        expect(actionTop.success).toBe(true);
        expect(actionTop.finalState.core.players['0'].hand.map(card => card.uid)).toContain('top-action');
        expect(actionTop.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['next-card']);

        const minionTopCore = {
            ...actionTopCore,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-b', 'mythic_greeks_spartan', 'minion', '0')],
                    deck: [
                        makeCard('top-minion', 'sharks_mako', 'minion', '0'),
                        makeCard('next-action', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        };
        const minionTop = runCommand(makeMatchState(minionTopCore), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'minion-b', baseIndex: 0 },
        } as any);
        expect(minionTop.success).toBe(true);
        expect(minionTop.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('top-minion');
        expect(minionTop.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-minion', 'next-action']);
    });

    it('赫尔墨斯的恩惠无目标结算两个额外行动且不创建交互', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('hermes', 'mythic_greeks_favor_of_hermes', 'action', '0')] }),
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
            payload: { cardUid: 'hermes' },
        } as any);

        expect(play.success).toBe(true);
        expectNoPrompt(play.finalState);
        expect(play.finalState.core.players['0'].actionLimit).toBe(3);
    });

    it('宙斯的恩惠使用第一入口基地直接降低爆破点，不再二次弹基地选择', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('zeus', 'mythic_greeks_favor_of_zeus', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', []),
                makeBase('base_wooden_horse', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'zeus', targetBaseIndex: 1 },
        } as any);

        expect(play.success).toBe(true);
        expectNoPrompt(play.finalState);
        expect(play.finalState.core.tempBreakpointModifiers?.[1]).toBe(-5);
        expect(getEffectiveBreakpoint(play.finalState.core, 1)).toBe(16);
        expect(play.finalState.core.tempBreakpointModifiers?.[0] ?? 0).toBe(0);
    });

    it('特洛伊木马由行动玩家选择这里一个随从并可给任意归属目标 +2', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', { hand: [makeCard('dangerous', 'sharks_dangerous_waters', 'action', '1')] }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [
                makeBase('base_wooden_horse', [
                    makeMinion('p0-minion', 'mythic_greeks_spartan', '0', 2),
                    makeMinion('p1-minion', 'sharks_mako', '1', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'dangerous', targetBaseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);

        let woodenHorsePromptPlayer: string | undefined;
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            if (getPromptSourceId(prompt) === 'base_wooden_horse') {
                woodenHorsePromptPlayer = getPromptPlayerId(prompt);
                const p0 = getPromptOption(prompt, option => option.value?.minionUid === 'p0-minion', 'Wooden Horse p0 minion option');
                return { optionId: p0.id };
            }

            const skip = getPromptOption(prompt, option => option.value?.skip, 'Wooden Horse skip option');
            return { optionId: skip.id };
        });

        expect(woodenHorsePromptPlayer).toBe('1');
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'p0-minion')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'p1-minion')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('阿佛洛狄忒的恩惠授予额外随从额度，能在已打出一个随从后再打出第二个随从', () => {
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

    it('伊阿宋触发后选择基地给己方随从 +1，且跨基地选择也会标记本回合已用', () => {
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

    it('伊阿宋上一回合的 once metadata 不会挡住下一回合再次触发', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hermes', 'mythic_greeks_favor_of_hermes', 'action', '0')],
                    actionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('jason', 'mythic_greeks_jason', '0', 3, {
                        metadata: { mythicGreeksJasonTriggeredTurn: 1 },
                    }),
                ]),
                makeBase('base_wooden_horse', [
                    makeMinion('own-target', 'sharks_mako', '0', 2),
                    makeMinion('enemy-target', 'tornados_dust_devil', '1', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hermes' },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            return chooseOptionBySource(prompt, 'mythic_greeks_jason', option => option.value?.baseIndex === 1);
        }).finalState;

        expect(resolved.core.bases[1].minions.find(minion => minion.uid === 'own-target')?.tempPowerModifier).toBe(1);
        expect(resolved.core.bases[1].minions.find(minion => minion.uid === 'enemy-target')?.tempPowerModifier ?? 0).toBe(0);
        expect(resolved.core.bases[0].minions.find(minion => minion.uid === 'jason')?.metadata?.mythicGreeksJasonTriggeredTurn).toBe(2);
    });

    it('斯巴达人上一回合的 once metadata 不会挡住下一回合再次触发', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hermes', 'mythic_greeks_favor_of_hermes', 'action', '0')],
                    actionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('spartan', 'mythic_greeks_spartan', '0', 2, {
                        metadata: { mythicGreeksSpartanTriggeredTurn: 1 },
                    }),
                ]),
            ],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hermes' },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            return chooseOptionBySource(prompt, 'mythic_greeks_spartan', option => option.value?.apply === true);
        }).finalState;

        expectNoPrompt(resolved);
        expect(resolved.core.bases[0].minions.find(minion => minion.uid === 'spartan')?.powerCounters).toBe(1);
        expect(resolved.core.bases[0].minions.find(minion => minion.uid === 'spartan')?.metadata?.mythicGreeksSpartanTriggeredTurn).toBe(2);
    });

    it('斯巴达人触发后可以跳过，不自动放置 +1 指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hermes', 'mythic_greeks_favor_of_hermes', 'action', '0')],
                    actionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('spartan', 'mythic_greeks_spartan', '0', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hermes' },
        } as any);

        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = getPromptOptions(prompt).find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };

            return chooseOptionBySource(prompt, 'mythic_greeks_spartan', option => option.value?.skip === true);
        }).finalState;

        expectNoPrompt(resolved);
        const spartan = resolved.core.bases[0].minions.find(minion => minion.uid === 'spartan');
        expect(spartan?.powerCounters ?? 0).toBe(0);
        expect(spartan?.metadata?.mythicGreeksSpartanTriggeredTurn).toBeUndefined();
    });

    it('哈迪斯的恩惠从弃牌堆行动牌中选择一张回手', () => {
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
});
