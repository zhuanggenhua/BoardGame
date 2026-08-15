/**
 * 学徒 ActionLog 完整链路测试
 * 
 * 验证学徒触发链路的所有操作都被正确记录到 ActionLog
 */

import { describe, expect, it, beforeAll } from 'vitest';
import {
    getSimpleChoicePrompt,
    makeState,
    makePlayer,
    makeCard,
    makeBase,
    makeMatchState,
    respondToPrompt,
} from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities } from '../abilities';

function expectCommandSucceeded<T extends { success: boolean; error?: string }>(
    result: T,
    message: string,
): asserts result is T & { success: true } {
    expect(result.success, result.error ? `${message}: ${result.error}` : message).toBe(true);
    if (!result.success) {
        throw new Error(result.error ? `${message}: ${result.error}` : message);
    }
}

function getActionLogKinds(state: { sys?: { actionLog?: { entries?: Array<{ kind: string }> } } }) {
    return state.sys?.actionLog?.entries?.map(entry => entry.kind) ?? [];
}

describe('学徒 ActionLog 完整链路', () => {
    beforeAll(() => {
        initAllAbilities();
    });
    it('选择"放入手牌"应记录：打出学徒 + 展示牌库顶 + 抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('a1', 'wizard_summon', 'action', '0'),
                        makeCard('m2', 'wizard_chronomage', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {}),
            },
            bases: [makeBase('base_the_homeworld')],
        });
        const state = makeMatchState(core);

        // 1. 打出学徒
        const r1 = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
            timestamp: 1000,
        });
        expectCommandSucceeded(r1, '打出学徒失败');

        const log1 = r1.finalState.sys.actionLog?.entries ?? [];
        expect(getActionLogKinds(r1.finalState)).toEqual([
            'su:minion_played',
            'su:reveal_deck_top',
        ]);

        const revealEntry = log1.find(e => e.kind === 'su:reveal_deck_top');
        expect(revealEntry).toMatchObject({
            actorId: '0',
            kind: 'su:reveal_deck_top',
        });

        expect(getSimpleChoicePrompt(r1.finalState, 'wizard_neophyte')).toBeDefined();
        const r2 = respondToPrompt(r1.finalState, 'to_hand', '0');
        expectCommandSucceeded(r2, '选择放入手牌失败');

        const log2 = r2.finalState.sys.actionLog?.entries ?? [];
        expect(getActionLogKinds(r2.finalState)).toEqual([
            'su:minion_played',
            'su:reveal_deck_top',
            'su:cards_drawn',
            'su:limit_modified',
        ]);
        const drawEntry = log2.find(e => e.kind === 'su:cards_drawn');
        expect(drawEntry).toBeDefined();
        expect(drawEntry?.segments).toBeDefined();
        expect(r2.finalState.core.players['0'].hand.map(card => card.defId)).toEqual(['wizard_summon']);
        expect(r2.finalState.core.players['0'].deck.map(card => card.defId)).toEqual(['wizard_chronomage']);
    });

    it('选择"作为额外行动打出"应记录：打出学徒 + 展示牌库顶 + 抽牌 + 打出行动 + 额度补偿', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('a1', 'wizard_summon', 'action', '0'),
                        makeCard('m2', 'wizard_chronomage', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {}),
            },
            bases: [makeBase('base_the_homeworld')],
        });
        const state = makeMatchState(core);

        // 1. 打出学徒
        const r1 = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
            timestamp: 1000,
        });
        expectCommandSucceeded(r1, '打出学徒失败');

        expect(getActionLogKinds(r1.finalState)).toEqual([
            'su:minion_played',
            'su:reveal_deck_top',
        ]);

        expect(getSimpleChoicePrompt(r1.finalState, 'wizard_neophyte')).toBeDefined();
        const r2 = respondToPrompt(r1.finalState, 'play_extra', '0');
        expectCommandSucceeded(r2, '选择作为额外行动打出失败');

        expect(getActionLogKinds(r2.finalState)).toEqual([
            'su:minion_played',
            'su:reveal_deck_top',
            'su:cards_drawn',
            'su:action_played',
            'su:limit_modified',
            'su:limit_modified',
        ]);
        expect(r2.finalState.core.players['0'].hand).toEqual([]);
        expect(r2.finalState.core.players['0'].deck.map(card => card.defId)).toEqual(['wizard_chronomage']);
    });

    it('打出行动卡后应触发其 onPlay 能力并记录', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('a1', 'wizard_mystic_studies', 'action', '0'), // 抽2张牌
                        makeCard('m2', 'wizard_chronomage', 'minion', '0'),
                        makeCard('m3', 'wizard_enchantress', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {}),
            },
            bases: [makeBase('base_the_homeworld')],
        });
        const state = makeMatchState(core);

        // 1. 打出学徒
        const r1 = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
            timestamp: 1000,
        });
        expectCommandSucceeded(r1, '打出学徒失败');

        expect(getSimpleChoicePrompt(r1.finalState, 'wizard_neophyte')).toBeDefined();
        const r2 = respondToPrompt(r1.finalState, 'play_extra', '0');
        expectCommandSucceeded(r2, '选择作为额外行动打出失败');

        const log2 = r2.finalState.sys.actionLog?.entries ?? [];
        expect(getActionLogKinds(r2.finalState)).toEqual([
            'su:minion_played',
            'su:reveal_deck_top',
            'su:cards_drawn',
            'su:action_played',
            'su:limit_modified',
            'su:cards_drawn',
        ]);
        const drawEntries = log2.filter(e => e.kind === 'su:cards_drawn');
        expect(drawEntries).toHaveLength(2);
        expect(r2.finalState.core.players['0'].hand.map(card => card.defId)).toEqual([
            'wizard_chronomage',
            'wizard_enchantress',
        ]);
        expect(r2.finalState.core.players['0'].deck).toEqual([]);
    });
});
