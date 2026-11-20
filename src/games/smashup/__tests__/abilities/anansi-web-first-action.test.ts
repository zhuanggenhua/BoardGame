import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS } from '../../domain/types';
import { getFirstPrompt, getPromptOptions, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from '../helpers';
import { runCommand } from '../testRunner';

describe('阿南西之网每回合第一次标准行动', () => {
    beforeEach(() => { resetAbilityInit(); initAllAbilities(); });

    it('首次标准行动后让过，不应在第二次标准行动后再次提供反应', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('first', 'wizard_mystic_studies', 'action', '0'), makeCard('second', 'wizard_mystic_studies', 'action', '0')],
                    deck: Array.from({ length: 5 }, (_, index) => makeCard(`deck-${index}`, 'wizard_neophyte', 'minion', '0')),
                    actionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_anansis_web', [makeMinion('ally', 'wizard_neophyte', '0', 2)])],
        }));
        const first = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'first' } });
        expect(first.success, first.error).toBe(true);
        expect(first.finalState.core.players['0'].actionCardsPlayedThisTurn).toBe(1);
        expect(getPromptOptions(getFirstPrompt(first.finalState)).some(option => String(option.value?.triggerId).includes('base_anansis_web'))).toBe(true);
        const passed = respondToPromptOption(first.finalState, option => option.value?.kind === 'pass', '让过阿南西之网', '0');
        expect(passed.success, passed.error).toBe(true);
        const second = runCommand(passed.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'second' } });
        expect(second.success, second.error).toBe(true);
        expect(getPromptOptions(getFirstPrompt(second.finalState)).some(option => String(option.value?.triggerId).includes('base_anansis_web'))).toBe(false);
    });
});
