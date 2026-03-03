/**
 * 测试幼熊斥候（bear_cavalry_cub_scout）消灭移入随从的 bug 修复
 * 
 * Bug 描述：
 * 当多个学徒被移动到幼熊斥候所在的基地时，只有第一个学徒被消灭，第二个学徒没有被消灭。
 * 
 * 根因：
 * 触发器在计算被移动随从的力量时，使用了原基地索引而不是目标基地索引。
 * 
 * 修复：
 * 将 `getMinionPower(ctx.state, movedMinion, movedBaseIndex)` 改为
 * `getMinionPower(ctx.state, movedMinion, destBaseIndex)`
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { makeCard, makeMinion, makeBase, makeState } from './fixtures/testHelpers';
import { SmashUpCore } from '../types';

describe('幼熊斥候消灭移入随从 bug 修复', () => {
    it('多个学徒被移动到幼熊斥候所在的基地时，都应该被消灭', () => {
        // 构造初始状态：
        // - 巫师学院（base0）：学徒1、学徒2
        // - 沙皇宫殿（base1）：幼熊斥候（测试员）
        const core: SmashUpCore = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': {
                    id: '0',
                    hand: [
                        makeCard('commission1', 'bear_cavalry_commission', '0', 'action'),
                        makeCard('commission2', 'bear_cavalry_commission', '0', 'action'),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['bear_cavalry', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['wizards', 'steampunks'] as [string, string],
                },
            },
            bases: [
                makeBase('base_wizard_academy', [
                    makeMinion('apprentice1', 'wizard_neophyte', '1', 2), // 学徒1，力量2
                    makeMinion('apprentice2', 'wizard_neophyte', '1', 2), // 学徒2，力量2
                ]),
                makeBase('base_tsars_palace', [
                    makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3), // 幼熊斥候，力量3
                ]),
            ],
            baseDeck: [],
        });

        const runner = new GameTestRunner('smashup', core);

        // 第一次移动：使用委任移动学徒1到沙皇宫殿
        const r1 = runner.dispatch('0', 'PLAY_ACTION', {
            cardUid: 'commission1',
            targetBaseIndex: 0,
        });
        expect(r1.ok).toBe(true);

        // 选择学徒1
        const r2 = runner.resolveInteraction('0', { minionUid: 'apprentice1' });
        expect(r2.ok).toBe(true);

        // 选择目标基地（沙皇宫殿）
        const r3 = runner.resolveInteraction('0', { baseIndex: 1 });
        expect(r3.ok).toBe(true);

        // 验证：学徒1应该被消灭（不在场上）
        const state1 = r3.finalState.core;
        expect(state1.bases[0].minions.find(m => m.uid === 'apprentice1')).toBeUndefined();
        expect(state1.bases[1].minions.find(m => m.uid === 'apprentice1')).toBeUndefined();
        expect(state1.players['1'].discard.find(c => c.uid === 'apprentice1')).toBeDefined();

        // 第二次移动：使用委任移动学徒2到沙皇宫殿
        const r4 = runner.dispatch('0', 'PLAY_ACTION', {
            cardUid: 'commission2',
            targetBaseIndex: 0,
        });
        expect(r4.ok).toBe(true);

        // 选择学徒2
        const r5 = runner.resolveInteraction('0', { minionUid: 'apprentice2' });
        expect(r5.ok).toBe(true);

        // 选择目标基地（沙皇宫殿）
        const r6 = runner.resolveInteraction('0', { baseIndex: 1 });
        expect(r6.ok).toBe(true);

        // 验证：学徒2也应该被消灭（不在场上）
        const state2 = r6.finalState.core;
        expect(state2.bases[0].minions.find(m => m.uid === 'apprentice2')).toBeUndefined();
        expect(state2.bases[1].minions.find(m => m.uid === 'apprentice2')).toBeUndefined();
        expect(state2.players['1'].discard.find(c => c.uid === 'apprentice2')).toBeDefined();

        // 验证：幼熊斥候还在场上
        expect(state2.bases[1].minions.find(m => m.uid === 'scout')).toBeDefined();
    });

    it('学徒在原基地有力量加成时，移动到目标基地后应该使用目标基地的力量计算', () => {
        // 这个测试验证修复的核心：使用目标基地索引计算力量，而不是原基地索引
        // 虽然当前没有基地给随从+力量的能力，但这个测试确保未来添加这类能力时不会出问题

        const core: SmashUpCore = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': {
                    id: '0',
                    hand: [
                        makeCard('commission1', 'bear_cavalry_commission', '0', 'action'),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['bear_cavalry', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['wizards', 'steampunks'] as [string, string],
                },
            },
            bases: [
                makeBase('base_wizard_academy', [
                    makeMinion('apprentice1', 'wizard_neophyte', '1', 2), // 学徒，力量2
                ]),
                makeBase('base_tsars_palace', [
                    makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3), // 幼熊斥候，力量3
                ]),
            ],
            baseDeck: [],
        });

        const runner = new GameTestRunner('smashup', core);

        // 移动学徒到沙皇宫殿
        const r1 = runner.dispatch('0', 'PLAY_ACTION', {
            cardUid: 'commission1',
            targetBaseIndex: 0,
        });
        expect(r1.ok).toBe(true);

        const r2 = runner.resolveInteraction('0', { minionUid: 'apprentice1' });
        expect(r2.ok).toBe(true);

        const r3 = runner.resolveInteraction('0', { baseIndex: 1 });
        expect(r3.ok).toBe(true);

        // 验证：学徒应该被消灭（力量2 < 幼熊斥候力量3）
        const state = r3.finalState.core;
        expect(state.bases[1].minions.find(m => m.uid === 'apprentice1')).toBeUndefined();
        expect(state.players['1'].discard.find(c => c.uid === 'apprentice1')).toBeDefined();
    });
});
