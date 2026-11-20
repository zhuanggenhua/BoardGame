import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import { getFirstPrompt, getPromptOptions, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

describe('Muchoslam 的额外行动', () => {
    beforeEach(() => { resetAbilityInit(); initAllAbilities(); });

    function buildState(includeAttachment: boolean) {
        return makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ordinary', 'luchadors_tag_team', 'action', '0'), ...(includeAttachment ? [makeCard('attach', 'mounties_bring_em_in', 'action', '0')] : [])],
                    actionsPlayed: 1, actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('muchoslam', 'luchadors_senor_muchoslam', '0', 5),
                makeMinion('enemy', 'ninja_acolyte', '1', 2),
            ])],
        }));
    }

    it('不能用天赋打出不附着随从的普通行动', () => {
        const talent = runCommand(buildState(false), { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'muchoslam', baseIndex: 0 } });
        expect(talent.success, talent.error).toBe(true);
        expect(talent.finalState.sys.interaction?.current).toBeUndefined();
        const played = runCommand(talent.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ordinary' } });
        expect(played.success).toBe(false);
    });

    it('只提供可打在对手随从上的行动和合法目标', () => {
        const talent = runCommand(buildState(true), { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'muchoslam', baseIndex: 0 } });
        expect(talent.success, talent.error).toBe(true);
        const actions = getPromptOptions(getFirstPrompt(talent.finalState)).map(option => option.value?.cardUid);
        expect(actions).toContain('attach');
        expect(actions).not.toContain('ordinary');
        const card = respondToPromptOption(talent.finalState, option => option.value?.cardUid === 'attach', '选择附着行动', '0');
        expect(card.success, card.error).toBe(true);
        const targets = getPromptOptions(getFirstPrompt(card.finalState)).map(option => option.value?.minionUid);
        expect(targets).toContain('enemy');
        expect(targets).not.toContain('muchoslam');
        const target = respondToPromptOption(card.finalState, option => option.value?.minionUid === 'enemy', '选择对手随从', '0');
        expect(target.success, target.error).toBe(true);
        expect(target.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.attachedActions.map(action => action.uid)).toContain('attach');
    });
});
