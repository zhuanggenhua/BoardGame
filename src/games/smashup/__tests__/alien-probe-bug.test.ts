/**
 * Bug 修复：alien_probe（探究）效果错误
 * 
 * 问题描述：
 * - 代码实现的效果：查看手牌 → 查看牌库顶 → 选择放回顶部或底部
 * - 正确的效果：查看手牌 → 选择一张随从 → 对手弃掉那张随从
 * 
 * 官方效果（Wiki）：
 * "Look at another player's hand and choose a minion in it. That player discards that minion."
 * 
 * 预期行为：
 * 1. 打出探究 → 选择对手（多对手时）
 * 2. 直接在 PromptOverlay 中查看对手手牌并选择随从（单步操作）
 * 3. 对手弃掉那张随从
 * 
 * UX 改进：
 * - 不使用 REVEAL_HAND 事件（避免两步操作：先关闭展示 → 再选择）
 * - 参考 zombieWalker 模式：直接在交互中展示卡牌并允许选择
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runCommand } from './testRunner';
import { makeState, makePlayer, makeCard, makeBase, makeMatchState } from './helpers';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { asSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { initAllAbilities } from '../abilities';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

describe('Bug: alien_probe（探究）效果错误', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('单对手场景：打出探究应该创建选择随从的交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                    factions: ['aliens', 'dinosaurs'] as [string, string],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('h1-1', 'pirate_first_mate', 'minion', '1'),
                        makeCard('h1-2', 'pirate_buccaneer', 'minion', '1'),
                        makeCard('h1-3', 'pirate_broadside', 'action', '1'),
                    ],
                    factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                }),
            },
            bases: [
                makeBase('base_the_mothership'),
                makeBase('base_tar_pits'),
            ],
        });
        const state = makeMatchState(core);

        // 玩家 0 打出探究
        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'probe1' },
        });

        // 断言：命令应该成功
        expect(result.success).toBe(true);
        
        // 断言：应该创建交互（选择随从）
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        const interaction = asSimpleChoice(result.finalState.sys.interaction?.current);
        expect(interaction?.sourceId).toBe('alien_probe');
        
        // 断言：选项应该是对手手牌中的随从（2 张）
        expect(interaction?.options.length).toBe(2);
        expect(interaction?.options[0].value).toHaveProperty('cardUid');
        expect(interaction?.options[0].value).toHaveProperty('targetPlayerId', '1');
        
        // 断言：探究应该从手牌移除
        const player0 = result.finalState.core.players['0'];
        expect(player0.hand.find(c => c.uid === 'probe1')).toBeUndefined();
        expect(player0.discard.find(c => c.uid === 'probe1')).toBeDefined();
    });

    it('选择随从后，对手应该弃掉那张随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                    factions: ['aliens', 'dinosaurs'] as [string, string],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('h1-1', 'pirate_first_mate', 'minion', '1'),
                        makeCard('h1-2', 'pirate_buccaneer', 'minion', '1'),
                    ],
                    factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                }),
            },
            bases: [
                makeBase('base_the_mothership'),
            ],
        });
        const state = makeMatchState(core);

        // 玩家 0 打出探究
        const result1 = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'probe1' },
        });

        // 断言：应该创建交互
        expect(result1.success).toBe(true);
        expect(result1.finalState.sys.interaction?.current).toBeDefined();
        
        // 玩家 0 选择弃掉 pirate_first_mate
        const result2 = runCommand(result1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'h1-1' },
        });

        // 断言：命令应该成功
        expect(result2.success).toBe(true);
        
        // 断言：应该有 CARDS_DISCARDED 事件
        const discardEvent = result2.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvent).toBeDefined();
        expect((discardEvent as any).payload.playerId).toBe('1');
        expect((discardEvent as any).payload.cardUids).toContain('h1-1');
        
        // 断言：随从应该从手牌移到弃牌堆
        const player1 = result2.finalState.core.players['1'];
        expect(player1.hand.find(c => c.uid === 'h1-1')).toBeUndefined();
        expect(player1.discard.find(c => c.uid === 'h1-1')).toBeDefined();
        expect(player1.hand.length).toBe(1); // 只剩 1 张
        expect(player1.discard.length).toBe(1); // 弃牌堆有 1 张
    });

    it('对手手牌中没有随从时，效果结束', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                    factions: ['aliens', 'dinosaurs'] as [string, string],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('h1-1', 'pirate_broadside', 'action', '1'),
                        makeCard('h1-2', 'pirate_powderkeg', 'action', '1'),
                    ],
                    factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                }),
            },
            bases: [
                makeBase('base_the_mothership'),
            ],
        });
        const state = makeMatchState(core);

        // 玩家 0 打出探究
        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'probe1' },
        });

        // 断言：命令应该成功
        expect(result.success).toBe(true);
        
        // 断言：不应该创建交互（因为没有随从可选）
        expect(result.finalState.sys.interaction?.current).toBeUndefined();
        
        // 断言：应该有反馈事件
        expect(result.events.some(e => e.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
    });

    it('多对手场景：打出探究应该先选择对手', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                    factions: ['aliens', 'dinosaurs'] as [string, string],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('h1-1', 'pirate_first_mate', 'minion', '1')],
                    factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('h2-1', 'ninja_tiger_assassin', 'minion', '2')],
                    factions: ['ninjas', 'wizards'] as [string, string],
                }),
            },
            bases: [
                makeBase('base_the_mothership'),
                makeBase('base_tar_pits'),
            ],
            turnOrder: ['0', '1', '2'],
        });
        const state = makeMatchState(core);

        // 玩家 0 打出探究
        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'probe1' },
        });

        // 断言：命令应该成功
        expect(result.success).toBe(true);
        
        // 断言：应该创建选择对手的交互
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        const interaction = asSimpleChoice(result.finalState.sys.interaction?.current);
        expect(interaction?.sourceId).toBe('alien_probe_choose_target');
        
        // 断言：应该有 2 个对手可选
        expect(interaction?.options.length).toBe(2);
    });
});
