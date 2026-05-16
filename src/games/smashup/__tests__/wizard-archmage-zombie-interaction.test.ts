/**
 * 通过僵尸行动卡从弃牌堆打出大法师的回归。
 *
 * 不变量：`zombie_they_keep_coming` 额外打出的随从仍要走真实 `MINION_PLAYED`
 * 后处理链，因此大法师应在上场当回合授予额外行动。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS } from '../domain/types';
import {
    getPromptOption,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makePlayer,
    makeState,
    respondToPromptWithMergedValue,
} from './helpers';
import { runCommand } from './testRunner';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('通过僵尸能力从弃牌堆打出大法师', () => {
    it('使用“它们不断来临”从弃牌堆打出大法师会获得额外行动', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: ['zombies', 'wizards'] as [string, string],
                    hand: [makeCard('tkc-1', 'zombie_they_keep_coming', 'action', '0')],
                    discard: [makeCard('archmage-1', 'wizard_archmage', 'minion', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayed: 1,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tar_pits', [])],
        });
        const state = makeMatchState(core);

        const playedAction = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'tkc-1' },
        } as any);

        expect(playedAction.success).toBe(true);

        const prompt = getSimpleChoicePrompt(playedAction.finalState, 'zombie_they_keep_coming');
        const archmageOption = getPromptOption(
            prompt,
            option => option.value?.cardUid === 'archmage-1',
            'archmage discard option',
        );

        const resolved = respondToPromptWithMergedValue(
            playedAction.finalState,
            archmageOption.id,
            { baseIndex: 0 },
            '0',
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.defId === 'wizard_archmage')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'archmage-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
    });
});
