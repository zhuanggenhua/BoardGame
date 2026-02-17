/**
 * 聚宝盆端到端测试
 * 验证弃牌效果是否生效
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { diceThroneSystemsForTest } from '../game';
import { createQueuedRandom, cmd, assertState } from './test-utils';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';

const shadowThiefSetupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'shadow_thief' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'shadow_thief' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createShadowThiefState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, diceThroneSystemsForTest, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: diceThroneSystemsForTest };
    for (const c of shadowThiefSetupCommands) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    return state;
}

describe('聚宝盆弃牌效果端到端测试', () => {
    it('聚宝盆 I 级：2 Card + 1 Shadow → 抽1牌 + 对手弃1牌', () => {
        // 骰子序列：进攻掷骰 5 次 → [5,5,6,1,2] = 2 Card + 1 Shadow + 2 Dagger
        const queuedRandom = createQueuedRandom([5, 5, 6, 1, 2]);
        
        let player1InitialHandCount = 0;

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createShadowThiefState(playerIds, random);
                // 清空玩家0手牌（避免响应窗口干扰）
                state.core.players['0'].hand = [];
                // 记录玩家1初始手牌数
                player1InitialHandCount = state.core.players['1'].hand.length;
                return state;
            },
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '聚宝盆 I 级弃牌效果',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),     // 掷骰 → [5,5,6,1,2]
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'cornucopia' }),
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll → main2（触发聚宝盆）
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': {
                        // 玩家0应该抽了1张牌（Level I 固定抽 1 张）
                        handCount: 1,
                    },
                    '1': {
                        // 玩家1应该弃了1张牌（1个Shadow面）
                        handCount: player1InitialHandCount - 1,
                    },
                },
            },
        });

        expect(result.assertionErrors).toHaveLength(0);

        // 额外验证：检查事件流
        const eventStream = result.finalState.sys.eventStream?.entries || [];
        const cardDrawnEvents = eventStream.filter(e => e.event.type === 'CARD_DRAWN');
        const cardDiscardedEvents = eventStream.filter(e => e.event.type === 'CARD_DISCARDED');

        console.log(`CARD_DRAWN 事件数: ${cardDrawnEvents.length}`);
        console.log(`CARD_DISCARDED 事件数: ${cardDiscardedEvents.length}`);

        expect(cardDrawnEvents.length).toBe(1); // 抽1张牌（Level I 固定）
        expect(cardDiscardedEvents.length).toBe(1); // 弃1张牌

        // 验证弃牌事件的 playerId 是玩家1
        const discardEvent = cardDiscardedEvents[0].event;
        expect(discardEvent.payload.playerId).toBe('1');

        console.log(`✅ 聚宝盆弃牌效果正常工作`);
    });

    it('聚宝盆 I 级：2 Card + 0 Shadow → 抽1牌 + 不弃牌', () => {
        // 骰子序列：进攻掷骰 5 次 → [5,5,1,2,3] = 2 Card + 0 Shadow + 3 其他
        const queuedRandom = createQueuedRandom([5, 5, 1, 2, 3]);
        
        let player1InitialHandCount = 0;

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createShadowThiefState(playerIds, random);
                state.core.players['0'].hand = [];
                player1InitialHandCount = state.core.players['1'].hand.length;
                return state;
            },
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '聚宝盆 I 级无Shadow不弃牌',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'cornucopia' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { handCount: 1 }, // Level I 固定抽 1 张
                    '1': { handCount: player1InitialHandCount }, // 手牌数不变
                },
            },
        });

        expect(result.assertionErrors).toHaveLength(0);

        // 验证没有弃牌事件
        const eventStream = result.finalState.sys.eventStream?.entries || [];
        const cardDiscardedEvents = eventStream.filter(e => e.event.type === 'CARD_DISCARDED');
        expect(cardDiscardedEvents.length).toBe(0);

        console.log(`✅ 无Shadow时不弃牌`);
    });
});
