/**
 * FlowSystem 最简单的调试测试
 * 目标：验证 play → ability → end → play 的完整流程
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { CardiaDomain } from '../domain';
import type { CardiaCore } from '../domain/types';
import { CARDIA_COMMANDS } from '../domain/commands';
import { ABILITY_IDS } from '../domain/ids';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { systems } from '../game';

// 导入所有能力组以注册执行器（必须在测试前执行）
import '../domain/abilities/group1-resources';
import { registerResourceInteractionHandlers } from '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
import { registerModifierInteractionHandlers } from '../domain/abilities/group2-modifiers';
import '../domain/abilities/group3-ongoing';
import '../domain/abilities/group4-card-ops';
import { registerCardOpsInteractionHandlers } from '../domain/abilities/group4-card-ops';
import '../domain/abilities/group5-copy';
import { registerCopyInteractionHandlers } from '../domain/abilities/group5-copy';
import '../domain/abilities/group6-special';
import { registerSpecialInteractionHandlers } from '../domain/abilities/group6-special';
import '../domain/abilities/group7-faction';
import { registerFactionInteractionHandlers } from '../domain/abilities/group7-faction';

// 注册交互处理函数（必须在测试前执行）
registerResourceInteractionHandlers();
registerModifierInteractionHandlers();
registerCardOpsInteractionHandlers();
registerCopyInteractionHandlers();
registerSpecialInteractionHandlers();
registerFactionInteractionHandlers();

describe('FlowSystem 简单调试', () => {
    it('应该正确推进 play → ability → end → play', () => {
        const runner = new GameTestRunner({
            domain: CardiaDomain,
            systems, // 添加系统（包括 FlowSystem）
            playerIds: ['0', '1'],
            setup: (playerIds: PlayerId[], random: RandomFn): MatchState<CardiaCore> => {
                // 使用 domain.setup 创建初始状态
                const core = CardiaDomain.setup(playerIds, random);
                
                // 最简单的初始状态：双方各有1张牌
                core.players['0'].hand = [
                    {
                        uid: 'card1',
                        defId: 'deck_i_card_01', // 雇佣剑士（影响力1，即时能力）
                        ownerId: '0',
                        baseInfluence: 1,
                        faction: 'neutral',
                        abilityIds: [ABILITY_IDS.MERCENARY_SWORDSMAN],
                        difficulty: 1,
                        modifiers: { entries: [], nextOrder: 0 },
                        tags: { tags: {} },
                        signets: 0,
                        ongoingMarkers: [],
                        imageIndex: 0,
                        imagePath: '',
                    },
                ];
                core.players['1'].hand = [
                    {
                        uid: 'card2',
                        defId: 'deck_i_card_03', // 外科医生（影响力3）
                        ownerId: '1',
                        baseInfluence: 3,
                        faction: 'neutral',
                        abilityIds: [ABILITY_IDS.SURGEON],
                        difficulty: 1,
                        modifiers: { entries: [], nextOrder: 0 },
                        tags: { tags: {} },
                        signets: 0,
                        ongoingMarkers: [],
                        imageIndex: 0,
                        imagePath: '',
                    },
                ];
                
                // 确保有牌可抽
                core.players['0'].deck = [
                    { uid: 'deck1', defId: 'deck_i_card_02', ownerId: '0', baseInfluence: 2, faction: 'neutral', abilityIds: [], difficulty: 1, modifiers: { entries: [], nextOrder: 0 }, tags: { tags: {} }, signets: 0, ongoingMarkers: [], imageIndex: 0, imagePath: '' },
                ];
                core.players['1'].deck = [
                    { uid: 'deck2', defId: 'deck_i_card_04', ownerId: '1', baseInfluence: 4, faction: 'neutral', abilityIds: [], difficulty: 1, modifiers: { entries: [], nextOrder: 0 }, tags: { tags: {} }, signets: 0, ongoingMarkers: [], imageIndex: 0, imagePath: '' },
                ];
                
                return {
                    core,
                    sys: {
                        phase: 'play',
                        undo: { snapshots: [], maxSnapshots: 50 },
                        interaction: { queue: [] },
                        tutorial: { active: false },
                        rematch: { requested: false },
                        actionLog: { entries: [] },
                        eventStream: { entries: [], nextId: 0 },
                        responseWindow: {},
                    },
                };
            },
        });

        console.log('\n=== 步骤1：P1 打出卡牌 ===');
        const result1 = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, {
            playerId: '0',
            cardUid: 'card1',
            slotIndex: 0,
        });
        console.log('步骤1结果:', {
            success: result1.success,
            error: result1.error,
            sysPhase: result1.finalState.sys.phase,
            corePhase: result1.finalState.core.phase,
            p1HasPlayed: result1.finalState.core.players['0'].hasPlayed,
            eventsCount: result1.events.length,
            eventTypes: result1.events.map(e => e.type),
        });
        
        expect(result1.success).toBe(true);
        expect(result1.finalState.core.players['0'].hasPlayed).toBe(true);
        expect(result1.finalState.sys.phase).toBe('play'); // 还在 play 阶段，等待 P2

        console.log('\n=== 步骤2：P2 打出卡牌 ===');
        const result2 = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, {
            playerId: '1',
            cardUid: 'card2',
            slotIndex: 0,
        });
        console.log('步骤2结果:', {
            success: result2.success,
            error: result2.error,
            sysPhase: result2.finalState.sys.phase,
            corePhase: result2.finalState.core.phase,
            hasCurrentEncounter: !!result2.finalState.core.currentEncounter,
            loserId: result2.finalState.core.currentEncounter?.loserId,
            eventsCount: result2.events.length,
            eventTypes: result2.events.map(e => e.type),
        });
        
        // 双方都打出卡牌后，应该自动推进到 ability 阶段
        expect(result2.success).toBe(true);
        expect(result2.finalState.sys.phase).toBe('ability');
        expect(result2.finalState.core.phase).toBe('ability');
        expect(result2.finalState.core.currentEncounter?.loserId).toBe('0'); // P1 失败（影响力1 < 3）

        console.log('\n=== 步骤3：P1 激活能力（雇佣剑士 - 即时能力）===');
        const result3 = runner.dispatch(CARDIA_COMMANDS.ACTIVATE_ABILITY, {
            playerId: '0',
            abilityId: ABILITY_IDS.MERCENARY_SWORDSMAN,
            sourceCardUid: result2.finalState.core.players['0'].playedCards[0].uid,
        });
        console.log('步骤3结果:', {
            success: result3.success,
            error: result3.error,
            sysPhase: result3.finalState.sys.phase,
            corePhase: result3.finalState.core.phase,
            p1PlayedCards: result3.finalState.core.players['0'].playedCards.length,
            p2PlayedCards: result3.finalState.core.players['1'].playedCards.length,
            p1DiscardSize: result3.finalState.core.players['0'].discard.length,
            p2DiscardSize: result3.finalState.core.players['1'].discard.length,
            eventsCount: result3.events.length,
            eventTypes: result3.events.map(e => e.type),
        });
        
        // 即时能力执行后，应该自动推进到 end 阶段，然后自动推进到 play 阶段
        expect(result3.success).toBe(true);
        expect(result3.finalState.core.players['0'].playedCards.length).toBe(0); // 卡牌被弃掉
        expect(result3.finalState.core.players['1'].playedCards.length).toBe(0); // 卡牌被弃掉
        expect(result3.finalState.sys.phase).toBe('play'); // 应该推进到 play 阶段（新回合）
        expect(result3.finalState.core.phase).toBe('play');
        
        // 验证回合已推进
        expect(result3.finalState.core.turnNumber).toBeGreaterThan(0); // 回合数增加
        expect(result3.finalState.core.currentPlayerId).toBe('1'); // 切换到对手
        
        // 验证双方都抽了牌
        expect(result3.finalState.core.players['0'].hand.length).toBe(1); // P1 抽了 1 张
        expect(result3.finalState.core.players['1'].hand.length).toBe(1); // P2 抽了 1 张
        
        // 验证 currentEncounter 已清理
        expect(result3.finalState.core.currentEncounter).toBeUndefined();

        console.log('\n=== 测试完成 ===');
        console.log('最终状态:', {
            sysPhase: result3.finalState.sys.phase,
            corePhase: result3.finalState.core.phase,
            turnNumber: result3.finalState.core.turnNumber,
            currentPlayerId: result3.finalState.core.currentPlayerId,
            p1HandSize: result3.finalState.core.players['0'].hand.length,
            p2HandSize: result3.finalState.core.players['1'].hand.length,
            hasCurrentEncounter: !!result3.finalState.core.currentEncounter,
        });
    });
});
