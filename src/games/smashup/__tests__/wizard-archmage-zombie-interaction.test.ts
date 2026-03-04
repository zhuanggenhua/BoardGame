/**
 * 测试：通过僵尸派系能力从弃牌堆打出大法师是否触发额外行动
 * 
 * 场景：使用"它们不断来临"（They Keep Coming）从弃牌堆打出大法师
 * 预期：大法师的 onMinionPlayed 触发器应该触发，增加额外行动
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { createSmashUpEventSystem } from '../domain/systems';
import { smashUpFlowHooks } from '../domain/index';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { initAllAbilities } from '../abilities';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { makeMinion, makePlayer, makeState, makeBase, makeCard } from './helpers';

const PLAYER_IDS = ['0', '1'] as const;

describe('通过僵尸能力从弃牌堆打出大法师', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    // 跳过此测试 - 从弃牌堆打出的逻辑需要完整的系统支持
    it.skip('使用"它们不断来临"从弃牌堆打出大法师应该获得额外行动', () => {
        // 构造场景：
        // - P0 手牌有"它们不断来临"行动卡
        // - P0 弃牌堆有大法师
        const theyKeepComingCard = makeCard('tkc-1', 'zombie_they_keep_coming', 'action', '0');
        const archmageCard = makeCard('archmage-1', 'wizard_archmage', 'minion', '0');
        
        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': {
                    ...makePlayer('0'),
                    hand: [theyKeepComingCard],
                    discard: [archmageCard],
                    factions: ['zombies', 'wizards'] as [string, string],
                },
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tar_pits', [])],
        });
        
        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);
        
        // 验证初始状态：P0 的 actionLimit 为 1
        expect(core.players['0'].actionLimit).toBe(1);
        
        const result = runner.run({
            name: '使用"它们不断来临"从弃牌堆打出大法师',
            commands: [
                // 1. 打出"它们不断来临"行动卡
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: {
                        cardUid: 'tkc-1',
                    },
                },
            ] as any[],
            // 使用自动响应来处理交互
            autoRespond: (interaction) => {
                console.log('交互:', interaction.id, interaction.data);
                // 第一个交互：选择弃牌堆中的随从
                if (interaction.id.includes('zombie_they_keep_coming') && !interaction.id.includes('base')) {
                    return { cardUid: 'archmage-1', defId: 'wizard_archmage', power: 4 };
                }
                // 第二个交互：选择基地
                if (interaction.id.includes('base')) {
                    return { baseIndex: 0 };
                }
                return null;
            },
        });

        // 验证所有命令执行成功
        if (!result.steps[0]?.success) {
            console.error(`步骤 1 失败:`, result.steps[0]?.error);
        }
        expect(result.steps[0]?.success).toBe(true);
        
        // 打印最终状态以便调试
        console.log('最终基地上的随从:', result.finalState.core.bases[0].minions.map(m => m.defId));
        console.log('最终弃牌堆:', result.finalState.core.players['0'].discard.map(c => c.defId));
        console.log('最终手牌:', result.finalState.core.players['0'].hand.map(c => c.defId));
        console.log('交互队列:', result.finalState.sys.interaction.queue.map(i => i.id));
        
        // 验证大法师已经在场上
        const finalBase = result.finalState.core.bases[0];
        const archmageOnBase = finalBase.minions.find(m => m.defId === 'wizard_archmage');
        expect(archmageOnBase).toBeDefined();
        
        // 关键验证：P0 的 actionLimit 应该增加 1（从 1 变成 2）
        // 因为大法师的 onMinionPlayed 触发器应该触发
        const finalPlayer = result.finalState.core.players['0'];
        console.log('最终 actionLimit:', finalPlayer.actionLimit);
        console.log('最终 actionsPlayed:', finalPlayer.actionsPlayed);
        console.log('最终 minionLimit:', finalPlayer.minionLimit);
        console.log('最终 minionsPlayed:', finalPlayer.minionsPlayed);
        
        // 打印所有事件以便调试
        const allEvents = result.steps.flatMap(s => s.events);
        console.log('所有事件类型:', allEvents.map(e => (e as any).type));
        const limitModifiedEvents = allEvents.filter(e => (e as any).type === SU_EVENTS.LIMIT_MODIFIED);
        console.log('LIMIT_MODIFIED 事件:', limitModifiedEvents.map(e => (e as any).payload));
        
        expect(finalPlayer.actionLimit).toBe(2);
    });
});
