import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptSourceId,
    makeBase,
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
});
