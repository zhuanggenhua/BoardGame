/**
 * 学徒 ActionLog 完整链路测试
 * 
 * 验证学徒触发链路的所有操作都被正确记录到 ActionLog
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { makeState, makePlayer, makeCard, makeBase, makeMatchState } from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

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
        expect(r1.success).toBe(true);
        if (!r1.success) return;

        // 检查 ActionLog：应该有 MINION_PLAYED
        const log1 = r1.finalState.sys.actionLog?.entries ?? [];
        expect(log1.length).toBeGreaterThan(0);
        const minionPlayedEntry = log1.find(e => e.kind === 'su:minion_played');
        expect(minionPlayedEntry).toBeDefined();
        console.log('Step 1 - 打出学徒:', log1.map(e => e.kind));

        // 检查是否有 REVEAL_DECK_TOP
        const revealEntry = log1.find(e => e.kind === 'su:reveal_deck_top');
        expect(revealEntry).toBeDefined();
        console.log('Step 1 - 展示牌库顶:', revealEntry);

        // 2. 选择"放入手牌"
        const interaction = r1.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data?.sourceId).toBe('wizard_neophyte');

        const r2 = runCommand(r1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { interactionId: interaction!.id, optionId: 'to_hand' },
            timestamp: 2000,
        });
        expect(r2.success).toBe(true);
        if (!r2.success) {
            console.error('Command failed:', r2.error);
            return;
        }

        // 检查 ActionLog：应该有 CARDS_DRAWN
        const log2 = r2.finalState.sys.actionLog?.entries ?? [];
        console.log('Step 2 - 选择放入手牌后的日志:', log2.map(e => e.kind));
        
        const drawEntry = log2.find(e => e.kind === 'su:cards_drawn');
        expect(drawEntry).toBeDefined();
        expect(drawEntry?.segments).toBeDefined();
        
        // 验证日志条目数量增加
        expect(log2.length).toBeGreaterThan(log1.length);
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
        expect(r1.success).toBe(true);
        if (!r1.success) return;

        const log1 = r1.finalState.sys.actionLog?.entries ?? [];
        console.log('Step 1 - 打出学徒:', log1.map(e => e.kind));

        // 2. 选择"作为额外行动打出"
        const interaction = r1.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();

        const r2 = runCommand(r1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { interactionId: interaction!.id, optionId: 'play_extra' },
            timestamp: 2000,
        });
        expect(r2.success).toBe(true);
        if (!r2.success) return;

        // 检查 ActionLog：应该有完整链路
        const log2 = r2.finalState.sys.actionLog?.entries ?? [];
        console.log('Step 2 - 选择作为额外行动打出后的日志:', log2.map(e => e.kind));
        
        // 应该包含：
        // 1. MINION_PLAYED (学徒)
        // 2. REVEAL_DECK_TOP (展示牌库顶)
        // 3. CARDS_DRAWN (抽到手牌)
        // 4. ACTION_PLAYED (打出行动卡)
        // 5. LIMIT_MODIFIED (补偿额度)
        
        const kinds = log2.map(e => e.kind);
        expect(kinds).toContain('su:minion_played');
        expect(kinds).toContain('su:reveal_deck_top');
        expect(kinds).toContain('su:cards_drawn');
        expect(kinds).toContain('su:action_played');
        expect(kinds).toContain('su:limit_modified');
        
        // 验证日志条目数量
        expect(log2.length).toBeGreaterThanOrEqual(5);
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
        expect(r1.success).toBe(true);
        if (!r1.success) return;

        // 2. 选择"作为额外行动打出"（秘术学习：抽2张）
        const interaction = r1.finalState.sys.interaction?.current;
        const r2 = runCommand(r1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { interactionId: interaction!.id, optionId: 'play_extra' },
            timestamp: 2000,
        });
        expect(r2.success).toBe(true);
        if (!r2.success) return;

        const log2 = r2.finalState.sys.actionLog?.entries ?? [];
        console.log('打出秘术学习后的日志:', log2.map(e => e.kind));
        
        // 应该包含秘术学习的 onPlay 效果（抽2张牌）
        const drawEntries = log2.filter(e => e.kind === 'su:cards_drawn');
        expect(drawEntries.length).toBeGreaterThanOrEqual(2); // 至少2次抽牌（学徒抽1张 + 秘术学习抽2张）
    });
});
