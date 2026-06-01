import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { reduce } from '../../domain/reduce';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptSourceId,
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

describe('base_tornado_alley 龙卷风走廊', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('每回合只触发一次，且自身移动原因不递归再触发', () => {
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

    it('上一位玩家回合留下的 once 记录不应阻止新回合首次移入触发', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('carried-away', 'tornados_carried_away', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [
                makeBase('base_wooden_horse', [makeMinion('move-me', 'sharks_mako', '0', 2)]),
                makeBase('base_tornado_alley', []),
                makeBase('base_the_deep', [makeMinion('other-target', 'sharks_hammerhead', '0', 4)]),
            ],
            usedBaseAbilitiesThisTurn: [
                { playerId: '0', baseIndex: 1, baseDefId: 'base_tornado_alley' },
            ],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const nextTurnCore = reduce(core as any, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 0,
        } as any);

        const played = runCommand(makeMatchState(nextTurnCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'carried-away', targetBaseIndex: 0, targetMinionUid: 'move-me' },
        } as any);

        expect(played.success).toBe(true);
        const resolved = resolveInteractionChain(played.finalState, (prompt, _state, step) => {
            if (step === 0) {
                return chooseOptionBySource(prompt, 'tornados_carried_away_dest', option => option.value?.baseIndex === 1);
            }
            expect(getPromptSourceId(prompt)).toBe('base_tornado_alley');
            return chooseOptionBySource(prompt, 'base_tornado_alley', option => option.value?.minionUid === 'other-target');
        });

        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['move-me', 'other-target']),
        );
        expectNoPrompt(resolved.finalState);
    });
});
