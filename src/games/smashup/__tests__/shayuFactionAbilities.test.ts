import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, resolveInteractionChain } from './helpers';
import { runCommand } from './testRunner';

describe('shayu 三派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('鲨鱼：撕裂可通过真实行动入口消灭低力量随从并抽牌，锤头鲨获得指示物', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-torn', 'sharks_torn_apart', 'action', '0')],
                    deck: [makeCard('draw-1', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('hammer', 'sharks_hammerhead', '0', 3),
                makeMinion('victim', 'tornados_dust_devil', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-torn' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const target = prompt.data.options.find((option: any) => option.value?.minionUid === 'victim');
            if (target) return { optionId: target.id };
            const skip = prompt.data.options.find((option: any) => option.value?.skip);
            return { optionId: skip.id };
        });
        const final = resolved.finalState.core;
        expect(final.bases[0].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(final.players['0'].hand.some(card => card.uid === 'draw-1')).toBe(true);
        expect(final.bases[0].minions.find(minion => minion.uid === 'hammer')?.powerCounters).toBe(1);
    });

    it('龙卷风：卷走可通过真实行动入口移动目标随从到另一个基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-carried', 'tornados_carried_away', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_trailer_park', [makeMinion('move-me', 'sharks_mako', '1', 2)]),
                makeBase('base_tornado_alley', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-carried', targetBaseIndex: 0, targetMinionUid: 'move-me' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state, step) => {
            if (step === 0) {
                const target = prompt.data.options.find((option: any) => option.value?.minionUid === 'move-me');
                return { optionId: target.id };
            }
            const targetBase = prompt.data.options.find((option: any) => option.value?.baseIndex === 1);
            return { optionId: targetBase.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'move-me')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'move-me')).toBe(true);
    });

    it('神话希腊：阿波罗的恩惠抽牌并授予额外行动额度', () => {
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

    it('神话希腊：伊阿宋在打出行动后选择一个基地并只强化那里自己的随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-hermes', 'mythic_greeks_favor_of_hermes', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('jason', 'mythic_greeks_jason', '0', 4),
                    makeMinion('own-a', 'mythic_greeks_spartan', '0', 2),
                    makeMinion('enemy-a', 'sharks_mako', '1', 2),
                ]),
                makeBase('base_the_deep', [
                    makeMinion('own-b', 'sharks_hammerhead', '0', 3),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-hermes' },
        } as any);

        expect(played.success).toBe(true);

        const resolved = resolveInteractionChain(played.finalState, (prompt, state) => {
            if (prompt.data?.sourceId === 'smashup_reaction_choose') {
                const triggersById = new Map((state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
                const option = prompt.data.options.find((candidate: any) => {
                    const trigger = triggersById.get(candidate.value?.triggerId);
                    return trigger?.sourceDefId === 'mythic_greeks_jason';
                });
                return { optionId: option.id };
            }
            expect(prompt.data?.sourceId).toBe('mythic_greeks_jason');
            const option = prompt.data.options.find((candidate: any) => candidate.value?.baseIndex === 0);
            return { optionId: option.id };
        });

        const [base0, base1] = resolved.finalState.core.bases;
        expect(base0.minions.find(minion => minion.uid === 'jason')?.tempPowerModifier).toBe(1);
        expect(base0.minions.find(minion => minion.uid === 'own-a')?.tempPowerModifier).toBe(1);
        expect(base0.minions.find(minion => minion.uid === 'enemy-a')?.tempPowerModifier ?? 0).toBe(0);
        expect(base1.minions.find(minion => minion.uid === 'own-b')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('鲨鱼：疯狂进食按玩家多选消灭任意数量低力量随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-feed', 'sharks_feeding_frenzy', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('low-a', 'tornados_dust_devil', '1', 2),
                makeMinion('low-b', 'sharks_mako', '1', 2),
                makeMinion('high', 'sharks_hammerhead', '1', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-feed', targetBaseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const lowA = prompt.data.options.find((option: any) => option.value?.minionUid === 'low-a');
            return { optionIds: [lowA.id] };
        });
        const minionUids = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minionUids).not.toContain('low-a');
        expect(minionUids).toContain('low-b');
        expect(minionUids).toContain('high');
    });

    it('鲨鱼：飞鲨通过真实行动入口先选择己方随从，再选择另一个基地并消灭低力量随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-air', 'sharks_air_jaws', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_deep', [makeMinion('own-shark', 'sharks_mako', '0', 2)]),
                makeBase('base_trailer_park', [makeMinion('victim', 'tornados_dust_devil', '1', 2)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-air', targetBaseIndex: 0, targetMinionUid: 'own-shark' },
        } as any);
        expect(play.success).toBe(true);
        expect((play.finalState.sys.interaction?.current?.data as any)?.sourceId).toBe('sharks_air_jaws_destination');
        expect((play.finalState.sys.interaction?.current?.data as any)?.targetType).toBe('base');

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const targetBase = prompt.data.options.find((option: any) => option.value?.baseIndex === 1);
            return { optionId: targetBase.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'own-shark')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'own-shark')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'victim')).toBe(false);
    });

    it('鲨鱼：激光束第一入口只能选择己方随从，合法后再消灭同基地低战力目标', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-laser', 'sharks_freakin_laser_beam', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('own-source', 'sharks_hammerhead', '0', 3),
                makeMinion('enemy-source', 'sharks_mako', '1', 2),
                makeMinion('victim-low', 'tornados_dust_devil', '1', 2),
                makeMinion('victim-high', 'tornados_twister', '1', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const illegal = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-laser', targetBaseIndex: 0, targetMinionUid: 'enemy-source' },
        } as any);
        expect(illegal.success).toBe(false);

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-laser', targetBaseIndex: 0, targetMinionUid: 'own-source' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const low = prompt.data.options.find((option: any) => option.value?.minionUid === 'victim-low');
            const high = prompt.data.options.find((option: any) => option.value?.minionUid === 'victim-high');
            expect(low).toBeTruthy();
            expect(high).toBeFalsy();
            return { optionId: low.id };
        });
        const minionUids = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minionUids).not.toContain('victim-low');
        expect(minionUids).toContain('victim-high');
        expect(minionUids).toContain('own-source');
    });

    it('鲨鱼：鲨鱼周在回合结束只按拥有者触发一次额外抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'sharks_mako', 'minion', '0'),
                        makeCard('draw-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_deep',
                    minions: [makeMinion('own-a', 'sharks_mako', '0', 2)],
                    ongoingActions: [{ uid: 'week-a', defId: 'sharks_week_of_sharks', ownerId: '0' }],
                }),
                makeBase({
                    defId: 'base_trailer_park',
                    minions: [makeMinion('own-b', 'sharks_mako', '0', 2)],
                    ongoingActions: [{ uid: 'week-b', defId: 'sharks_week_of_sharks', ownerId: '0' }],
                }),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const state = makeMatchState(core);
        state.sys.phase = 'endTurn';
        const result = runCommand(state, { type: 'ADVANCE_PHASE' as any, playerId: '0', payload: undefined } as any);
        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-b']);
    });

    it('龙卷风：龙卷风怪物可把其他基地低力量随从移入自身基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_trailer_park', [makeMinion('monster', 'tornados_monster_tornado', '0', 5)]),
                makeBase('base_tornado_alley', [makeMinion('target', 'sharks_mako', '1', 2)]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster', baseIndex: 0 },
        } as any);
        expect(talent.success).toBe(true);
        const resolved = resolveInteractionChain(talent.finalState, (prompt) => {
            const target = prompt.data.options.find((option: any) => option.value?.minionUid === 'target');
            return { optionId: target.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'target')).toBe(false);
    });

    it('神话希腊：赫拉的恩惠按玩家选择至多两个随从放置指示物', () => {
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
                makeMinion('own-c', 'sharks_hammerhead', '0', 3),
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
            const selectable = prompt.data.options.filter((option: any) => option.value?.minionUid);
            const a = selectable.find((option: any) => option.value?.minionUid === 'own-a') ?? selectable[0];
            const b = selectable.find((option: any) => option.value?.minionUid === 'own-b') ?? selectable[1];
            return { optionIds: [a.id, b.id] };
        });
        const minions = resolved.finalState.core.bases[0].minions;
        expect(minions.find(minion => minion.uid === 'own-a')?.powerCounters).toBe(1);
        expect(minions.find(minion => minion.uid === 'own-b')?.powerCounters).toBe(1);
        expect(minions.find(minion => minion.uid === 'own-c')?.powerCounters).toBeUndefined();
    });

    it('神话希腊：波塞冬的恩惠按玩家选择弃牌洗回牌库', () => {
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
            const a = prompt.data.options.find((option: any) => option.value?.cardUid === 'discard-a');
            const c = prompt.data.options.find((option: any) => option.value?.cardUid === 'discard-c');
            return { optionIds: [a.id, c.id] };
        });
        const player = resolved.finalState.core.players['0'];
        expect(player.deck.map(card => card.uid)).toEqual(['discard-a', 'discard-c', 'deck-1']);
        expect(player.discard.map(card => card.uid)).toEqual(['discard-b', 'a-poseidon']);
    });

    it('神话希腊：波塞冬的恩惠选择被他人拥有的弃牌时，仍应洗回其拥有者牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-poseidon', 'mythic_greeks_favor_of_poseidon', 'action', '0')],
                    deck: [makeCard('p0-deck-a', 'mythic_greeks_spartan', 'minion', '0')],
                    discard: [
                        makeCard('borrowed-discard', 'sharks_mako', 'minion', '1'),
                        makeCard('own-discard', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'sharks_hammerhead', 'minion', '1')],
                }),
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
            const borrowed = prompt.data.options.find((option: any) => option.value?.cardUid === 'borrowed-discard');
            return { optionIds: [borrowed.id] };
        });
        const p0 = resolved.finalState.core.players['0'];
        const p1 = resolved.finalState.core.players['1'];
        expect(p0.deck.map(card => card.uid)).toEqual(['p0-deck-a']);
        expect(p0.discard.map(card => card.uid)).toEqual(['own-discard', 'a-poseidon']);
        expect(p1.deck.map(card => card.uid)).toEqual(['borrowed-discard', 'p1-deck-a']);
    });

    it('神话希腊：雅典娜的恩惠展示牌库顶5张，由玩家选择行动牌并决定其余回顶顺序', () => {
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
        expect((play.finalState.sys.interaction.current?.data as any)?.sourceId).toBe('mythic_greeks_favor_of_athena_pick');

        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                const picked = prompt.data.options.find((option: any) => option.value?.cardUid === 'top-action-pick');
                return { optionId: picked.id };
            }
            const order = ['top-minion-b', 'top-minion-a', 'top-action-a'];
            const target = prompt.data.options.find((option: any) => option.value?.cardUid === order[step - 1]);
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

    it('神话希腊：雅典娜的恩惠回顶剩余揭示牌时，被他人拥有的牌仍应进入其拥有者牌库顶', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-athena', 'mythic_greeks_favor_of_athena', 'action', '0')],
                    deck: [
                        makeCard('borrowed-revealed', 'sharks_mako', 'minion', '1'),
                        makeCard('top-action-pick', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                        makeCard('own-minion-b', 'mythic_greeks_spartan', 'minion', '0'),
                        makeCard('own-action-a', 'mythic_greeks_favor_of_ares', 'action', '0'),
                        makeCard('own-action-c', 'sharks_torn_apart', 'action', '0'),
                        makeCard('deck-rest', 'tornados_dust_devil', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'sharks_mako', 'minion', '1')],
                }),
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

        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                const picked = prompt.data.options.find((option: any) => option.value?.cardUid === 'top-action-pick');
                return { optionId: picked.id };
            }
            const order = ['own-minion-b', 'borrowed-revealed', 'own-action-a'];
            const target = prompt.data.options.find((option: any) => option.value?.cardUid === order[step - 1]);
            return { optionId: target.id };
        });

        const p0 = resolved.finalState.core.players['0'];
        const p1 = resolved.finalState.core.players['1'];
        expect(p0.hand.map(card => card.uid)).toContain('top-action-pick');
        expect(p0.deck.map(card => card.uid)).toEqual(['own-minion-b', 'own-action-a', 'own-action-c', 'deck-rest']);
        expect(p1.deck.map(card => card.uid)).toEqual(['borrowed-revealed', 'p1-deck-a']);
    });

    it('神话希腊：雅典娜的恩惠牌库不足洗入弃牌堆时，应把 borrowed 弃牌分流回真实拥有者牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-athena', 'mythic_greeks_favor_of_athena', 'action', '0')],
                    deck: [
                        makeCard('own-deck-action', 'mythic_greeks_favor_of_apollo', 'action', '0'),
                        makeCard('own-deck-minion', 'mythic_greeks_spartan', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('borrowed-discard', 'sharks_mako', 'minion', '1'),
                        makeCard('own-discard-action', 'mythic_greeks_favor_of_ares', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'sharks_tiger_shark', 'minion', '1')],
                    discard: [],
                }),
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
        expect(play.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
                deckUids: ['p1-deck-a', 'borrowed-discard'],
            }),
        }));
        expect(play.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '0',
                deckUids: expect.arrayContaining(['borrowed-discard']),
            }),
        }));

        const p0 = play.finalState.core.players['0'];
        const p1 = play.finalState.core.players['1'];
        expect(p0.deck.map(card => card.uid)).not.toContain('borrowed-discard');
        expect(p0.discard.map(card => card.uid)).not.toContain('borrowed-discard');
        expect(p1.deck.map(card => card.uid)).toEqual(['p1-deck-a', 'borrowed-discard']);
    });

    it('龙卷风：旋风群为每个被选随从分别选择目标基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-whirl', 'tornados_whirlwinds', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_trailer_park', [makeMinion('own-a', 'tornados_dust_devil', '0', 2)]),
                makeBase('base_tornado_alley', [makeMinion('own-b', 'sharks_mako', '0', 2)]),
                makeBase('base_the_deep', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-whirl' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                const ownA = prompt.data.options.find((option: any) => option.value?.minionUid === 'own-a');
                const ownB = prompt.data.options.find((option: any) => option.value?.minionUid === 'own-b');
                return { optionIds: [ownA.id, ownB.id] };
            }
            const targetBaseIndex = step === 1 ? 2 : 0;
            const target = prompt.data.options.find((option: any) => option.value?.baseIndex === targetBaseIndex);
            return { optionId: target.id };
        });
        expect(resolved.finalState.core.bases[2].minions.some(minion => minion.uid === 'own-a')).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'own-b')).toBe(true);
    });

    it('龙卷风：信风从真实出牌进入两个随从选择，且第二候选必须在另一基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('a-trade', 'tornados_trade_winds', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('first', 'sharks_mako', '0', 2),
                    makeMinion('same-base', 'tornados_dust_devil', '1', 2),
                ]),
                makeBase('base_the_deep', [
                    makeMinion('second', 'mythic_greeks_spartan', '1', 2),
                    makeMinion('too-big', 'sharks_hammerhead', '1', 4),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-trade' },
        } as any);
        expect(play.success).toBe(true);
        expect((play.finalState.sys.interaction.current?.data as any)?.sourceId).toBe('tornados_trade_winds_first');
        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                const first = prompt.data.options.find((option: any) => option.value?.minionUid === 'first');
                return { optionId: first.id };
            }
            expect(prompt.data.options.some((option: any) => option.value?.minionUid === 'same-base')).toBe(false);
            expect(prompt.data.options.some((option: any) => option.value?.minionUid === 'too-big')).toBe(false);
            const second = prompt.data.options.find((option: any) => option.value?.minionUid === 'second');
            return { optionId: second.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'second')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'first')).toBe(true);
    });

    it('龙卷风：扯走把 borrowed 附着行动移到 Brownie 身上时，应保留 sourcePlayerId 并把 queued 事件玩家留给真正行动玩家', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a-ripped', 'tornados_ripped_off', 'action', '0'),
                        makeCard('discard-me', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_trailer_park', [
                    makeMinion('host-a', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'borrowed-sleep', defId: 'trickster_mark_of_sleep', ownerId: '1' }],
                    }),
                    makeMinion('brownie-a', 'trickster_brownie', '1', 2),
                ]),
                makeBase('base_tornado_alley', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-ripped' },
        } as any);
        expect(play.success).toBe(true);
        expect((play.finalState.sys.interaction.current?.data as any)?.sourceId).toBe('tornados_ripped_off');

        const chooseActionPrompt = play.finalState.sys.interaction.current as any;
        const chooseAction = runCommand(play.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: chooseActionPrompt.data.options[0].id },
        } as any);
        expect(chooseAction.success).toBe(true);
        expect((chooseAction.finalState.sys.interaction.current?.data as any)?.sourceId).toBe('tornados_ripped_off_target_minion');

        const chooseTargetPrompt = chooseAction.finalState.sys.interaction.current as any;
        const brownieOption = chooseTargetPrompt.data.options.find((option: any) => option.value?.minionUid === 'brownie-a');
        expect(brownieOption).toBeDefined();

        const resolveTarget = runCommand(chooseAction.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: brownieOption.id },
        } as any);
        expect(resolveTarget.success).toBe(true);

        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-sleep',
                defId: 'trickster_mark_of_sleep',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'brownie-a',
            }),
        }));
        expect(resolveTarget.finalState.core.bases[0].minions.find(minion => minion.uid === 'brownie-a')?.attachedActions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ uid: 'borrowed-sleep', defId: 'trickster_mark_of_sleep', ownerId: '1' }),
            ]),
        );

        const queued = resolveTarget.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        const brownieTrigger = queued?.payload?.triggers?.find((trigger: any) => trigger.sourceDefId === 'trickster_brownie');
        expect(brownieTrigger).toEqual(expect.objectContaining({
            sourceDefId: 'trickster_brownie',
            sourceCardUid: 'brownie-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
        }));
    });

    it('龙卷风：扯走把 borrowed Fairies Enchantment 移到另一基地后，应保留 metadata 与 sourcePlayerId', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-ripped', 'tornados_ripped_off', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    ...makeBase('base_trailer_park', [
                        makeMinion('source-minion', 'sharks_mako', '0', 3),
                    ]),
                    ongoingActions: [{
                        uid: 'borrowed-enchantment',
                        defId: 'fairies_enchantment',
                        ownerId: '1',
                        metadata: {
                            sourceControllerId: '0',
                            fairiesEnchantmentMode: 'minus',
                        },
                    }],
                },
                makeBase('base_tornado_alley', [
                    makeMinion('target-minion', 'sharks_mako', '0', 3, { powerModifier: 0 }),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-ripped' },
        } as any);
        expect(play.success).toBe(true);
        expect((play.finalState.sys.interaction.current?.data as any)?.sourceId).toBe('tornados_ripped_off');

        const chooseActionPrompt = play.finalState.sys.interaction.current as any;
        const enchantmentOption = chooseActionPrompt.data.options.find((option: any) => option.value?.cardUid === 'borrowed-enchantment');
        expect(enchantmentOption).toBeDefined();

        const chooseAction = runCommand(play.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: enchantmentOption.id },
        } as any);
        expect(chooseAction.success).toBe(true);
        expect((chooseAction.finalState.sys.interaction.current?.data as any)?.sourceId).toBe('tornados_ripped_off_target_base');

        const chooseBasePrompt = chooseAction.finalState.sys.interaction.current as any;
        const targetBaseOption = chooseBasePrompt.data.options.find((option: any) => option.value?.baseIndex === 1);
        expect(targetBaseOption).toBeDefined();

        const resolveTarget = runCommand(chooseAction.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: targetBaseOption.id },
        } as any);
        expect(resolveTarget.success).toBe(true);

        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-enchantment',
                defId: 'fairies_enchantment',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 1,
                metadata: expect.objectContaining({
                    fairiesEnchantmentMode: 'minus',
                }),
            }),
        }));

        const movedEnchantment = resolveTarget.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'borrowed-enchantment');
        expect(movedEnchantment?.metadata?.sourceControllerId).toBe('0');
        expect(movedEnchantment?.metadata?.fairiesEnchantmentMode).toBe('minus');

        const targetMinion = resolveTarget.finalState.core.bases[1].minions.find(minion => minion.uid === 'target-minion');
        expect(targetMinion).toBeDefined();
        expect(getEffectivePower(resolveTarget.finalState.core, targetMinion!, 1)).toBe(2);
    });

    it('神话希腊：狄俄尼索斯的恩惠可选择是否放回牌库顶', () => {
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
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const top = prompt.data.options.find((option: any) => option.value?.choice === 'deck-top');
            return { optionId: top.id };
        });
        const player = resolved.finalState.core.players['0'];
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'own-a')?.tempPowerModifier).toBe(1);
        expect(player.actionLimit).toBe(2);
        expect(player.deck[0]?.uid).toBe('a-dionysus');
        expect(player.discard.some(card => card.uid === 'a-dionysus')).toBe(false);
    });

    it('神话希腊：被他人拥有的狄俄尼索斯恩惠选择回顶时，仍应进入其拥有者牌库而不是当前玩家牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('borrowed-dionysus', 'mythic_greeks_favor_of_dionysus', 'action', '1')],
                    deck: [makeCard('p0-deck-1', 'mythic_greeks_spartan', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-1', 'mythic_greeks_favor_of_apollo', 'action', '1')],
                }),
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
            payload: { cardUid: 'borrowed-dionysus', targetBaseIndex: 0, targetMinionUid: 'own-a' },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const top = prompt.data.options.find((option: any) => option.value?.choice === 'deck-top');
            return { optionId: top.id };
        });
        const topEvent = resolved.events.find(event =>
            event.type === SU_EVENTS.CARD_TO_DECK_TOP
            && (event as any).payload?.cardUid === 'borrowed-dionysus'
        ) as any;
        expect(topEvent?.payload).toMatchObject({
            ownerId: '1',
            sourcePlayerId: '0',
            reason: 'mythic_greeks_favor_of_dionysus',
        });
        const p0 = resolved.finalState.core.players['0'];
        const p1 = resolved.finalState.core.players['1'];
        expect(p0.deck.map(card => card.uid)).toEqual(['p0-deck-1']);
        expect(p0.discard.some(card => card.uid === 'borrowed-dionysus')).toBe(false);
        expect(p1.deck.map(card => card.uid)).toEqual(['borrowed-dionysus', 'p1-deck-1']);
        expect(p1.discard.some(card => card.uid === 'borrowed-dionysus')).toBe(false);
    });

    it('神话希腊：阿尔戈英雄触发行动态持续能力', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('argonaut-card', 'mythic_greeks_argonaut', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('odysseus', 'mythic_greeks_odysseus', '0', 5),
                    makeMinion('heracles', 'mythic_greeks_heracles', '0', 4),
                    makeMinion('spartan', 'mythic_greeks_spartan', '0', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'argonaut-card', baseIndex: 0 },
        } as any);
        expect(play.success).toBe(true);
        const resolved = resolveInteractionChain(play.finalState, (prompt, state) => {
            const triggerOption = prompt.data.options.find((option: any) => {
                const triggerId = option.value?.triggerId;
                return triggerId && state.core.triggerQueue?.some(trigger => trigger.id === triggerId);
            });
            if (triggerOption) return { optionId: triggerOption.id };
            const odysseus = prompt.data.options.find((option: any) => option.value?.minionUid === 'odysseus');
            return { optionId: odysseus.id };
        });
        const minions = resolved.finalState.core.bases[0].minions;
        expect(minions.find(minion => minion.uid === 'odysseus')?.powerCounters).toBe(1);
        expect(minions.find(minion => minion.uid === 'heracles')?.tempPowerModifier).toBe(1);
        expect(minions.find(minion => minion.uid === 'spartan')?.powerCounters).toBe(1);
    });

    it('神话希腊基地：特尔斐神谕在打出随从后展示牌库顶，行动牌入手，非行动牌留在牌库顶', () => {
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
});
