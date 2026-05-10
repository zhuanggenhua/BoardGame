import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS } from '../domain/types';
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
});
