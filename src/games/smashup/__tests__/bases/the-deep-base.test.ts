import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import {
    getPromptOption,
    getPromptOptions,
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

describe('base_the_deep 海渊', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('在力量 4+ 随从打入后，只允许消灭同基地更低力量随从', () => {
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
});
