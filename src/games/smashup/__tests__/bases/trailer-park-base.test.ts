import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import {
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

describe('base_trailer_park 活动房屋公园', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('在随从移入时自动给该随从 +1', () => {
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
});
