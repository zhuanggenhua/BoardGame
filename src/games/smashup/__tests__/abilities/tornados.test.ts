import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
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

describe('龙卷风代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('卷走可通过真实行动入口移动目标随从到另一个基地', () => {
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
        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const targetBase = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'Carried Away destination base option');
            return { optionId: targetBase.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'move-me')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'move-me')).toBe(true);
    });

    it('龙卷风怪物可把其他基地低力量随从移入自身基地', () => {
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
            const target = getPromptOption(prompt, option => option.value?.minionUid === 'target', 'Monster Tornado target minion option');
            return { optionId: target.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'target')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'target')).toBe(false);
    });

    it('旋风群为每个被选随从分别选择目标基地', () => {
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
                const ownA = getPromptOption(prompt, option => option.value?.minionUid === 'own-a', 'Whirlwinds own-a option');
                const ownB = getPromptOption(prompt, option => option.value?.minionUid === 'own-b', 'Whirlwinds own-b option');
                return { optionIds: [ownA.id, ownB.id] };
            }
            const targetBaseIndex = step === 1 ? 2 : 0;
            const target = getPromptOption(prompt, option => option.value?.baseIndex === targetBaseIndex, 'Whirlwinds destination base option');
            return { optionId: target.id };
        });
        expect(resolved.finalState.core.bases[2].minions.some(minion => minion.uid === 'own-a')).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'own-b')).toBe(true);
    });

    it('信风从真实出牌进入两个随从选择，且第二候选必须在另一基地', () => {
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
        expect(getSimpleChoicePrompt(play.finalState, 'tornados_trade_winds_first')).toBeDefined();
        const resolved = resolveInteractionChain(play.finalState, (prompt, _state, step) => {
            if (step === 0) {
                const first = getPromptOption(prompt, option => option.value?.minionUid === 'first', 'Trade Winds first minion option');
                return { optionId: first.id };
            }
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'same-base')).toBe(false);
            expect(getPromptOptions(prompt).some((option: any) => option.value?.minionUid === 'too-big')).toBe(false);
            const second = getPromptOption(prompt, option => option.value?.minionUid === 'second', 'Trade Winds second minion option');
            return { optionId: second.id };
        });
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'second')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'first')).toBe(true);
    });

    it('气旋天赋以自身为源，只选择目标基地并移动自身', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_trailer_park', [makeMinion('cyclone', 'tornados_cyclone', '0', 4)]),
                makeBase('base_tornado_alley', []),
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
        const cyclonePrompt = getSimpleChoicePrompt(talent.finalState, 'tornados_cyclone');
        expect(cyclonePrompt.targetType).toBe('base');

        const resolved = resolveInteractionChain(talent.finalState, (prompt) => {
            const targetBase = getPromptOption(prompt, option => option.value?.baseIndex === 1, 'Cyclone target base option');
            return { optionId: targetBase.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'cyclone')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'cyclone')).toBe(true);
    });

    it('旋风出场可将力量≤3随从从本基地移出或从其他基地移入', () => {
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

    it('旋风和龙卷风怪物的“你可以移动”效果必须允许跳过', () => {
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
});
