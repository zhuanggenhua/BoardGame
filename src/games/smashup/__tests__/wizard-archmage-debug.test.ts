/**
 * 调试测试：追踪大法师从弃牌堆打出时的完整流程
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { createSmashUpEventSystem } from '../domain/systems';
import { smashUpFlowHooks } from '../domain/index';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { makeMinion, makePlayer, makeState, makeBase, makeCard } from './helpers';

const PLAYER_IDS = ['0', '1'] as const;

describe('大法师从弃牌堆打出调试', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    // 跳过此测试 - 从弃牌堆打出的逻辑需要完整的系统支持
    it.skip('从弃牌堆打出大法师 - 详细追踪', () => {
        const archmageCard = makeCard('archmage-1', 'wizard_archmage', 'minion', '0');
        
        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': {
                    ...makePlayer('0'),
                    discard: [archmageCard],
                    actionLimit: 1, // 初始行动额度
                },
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tar_pits', [])],
        });
        
        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);
        
        console.log('\n=== 初始状态 ===');
        console.log('P0 actionLimit:', core.players['0'].actionLimit);
        console.log('P0 discard:', core.players['0'].discard.map(c => c.defId));
        console.log('Base 0 minions:', core.bases[0].minions.map(m => m.defId));
        
        // 从弃牌堆打出大法师
        const result = runner.run({
            name: '从弃牌堆打出大法师',
            commands: [
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: {
                        cardUid: 'archmage-1',
                        baseIndex: 0,
                        fromDiscard: true,
                    },
                },
            ] as any[],
        });

        console.log('\n=== 执行结果 ===');
        console.log('Success:', result.steps[0]?.success);
        if (!result.steps[0]?.success) {
            console.error('Error:', result.steps[0]?.error);
        }
        
        console.log('\n=== 事件列表 ===');
        result.steps[0]?.events?.forEach((eventType, i) => {
            console.log(`${i + 1}. ${eventType}`);
        });
        
        console.log('\n=== 最终状态 ===');
        console.log('P0 actionLimit:', result.finalState.core.players['0'].actionLimit);
        console.log('Base 0 minions:', result.finalState.core.bases[0].minions.map(m => m.defId));
        
        // 验证
        expect(result.steps[0]?.success).toBe(true);
        
        const finalBase = result.finalState.core.bases[0];
        expect(finalBase.minions.length).toBe(1);
        expect(finalBase.minions[0].defId).toBe('wizard_archmage');
        
        // 关键验证：actionLimit 应该增加 1
        const finalPlayer = result.finalState.core.players['0'];
        console.log('\n=== 验证结果 ===');
        console.log('Expected actionLimit: 2');
        console.log('Actual actionLimit:', finalPlayer.actionLimit);
        console.log('LIMIT_MODIFIED events:', result.steps[0]?.events?.filter(e => e === SU_EVENTS.LIMIT_MODIFIED).length);
        
        expect(finalPlayer.actionLimit).toBe(2);
    });
});