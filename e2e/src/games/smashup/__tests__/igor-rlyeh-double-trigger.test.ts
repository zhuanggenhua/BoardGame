/**
 * Bug 重现：Igor 在 base_rlyeh 被消灭时触发两次
 * 
 * 场景：
 * 1. 回合开始，base_rlyeh onTurnStart 触发
 * 2. 玩家选择消灭 Igor
 * 3. Igor onDestroy 应该只触发一次，但实际触发了两次
 * 
 * 根因分析：
 * - base_rlyeh interaction handler 产生 MINION_DESTROYED 事件
 * - SmashUpEventSystem.afterEvents 调用 processDestroyMoveCycle → processDestroyTriggers
 * - 这会触发 Igor onDestroy，创建第一个交互
 * - 但是 base_rlyeh handler 本身也可能创建交互？
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makeBase, makeMinion, makeMatchState, makePlayer } from './helpers';
import { initAllAbilities } from '../abilities';
import { triggerBaseAbility } from '../domain/baseAbilities';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { defaultTestRandom } from './testRunner';
import { processDestroyMoveCycle } from '../domain/reducer';
import type { SmashUpEvent } from '../domain/types';

describe('Bug: Igor 在 base_rlyeh 被消灭时触发两次', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('base_rlyeh handler 产生 MINION_DESTROYED → processDestroyMoveCycle → Igor onDestroy 只触发一次', () => {
        // 初始状态：base_rlyeh 上有 Igor + 其他随从
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [
                makeBase('base_rlyeh', [
                    makeMinion('igor1', 'frankenstein_igor', '0', 2),
                    makeMinion('monster1', 'frankenstein_the_monster', '0', 4),
                    makeMinion('wolf1', 'werewolf_loup_garou', '0', 4),
                ]),
            ],
        });
        
        const ms = makeMatchState(core);
        
        // 第一步：调用 base_rlyeh interaction handler（模拟玩家选择消灭 Igor）
        const handler = getInteractionHandler('base_rlyeh');
        expect(handler).toBeDefined();
        
        const handlerResult = handler!(
            ms,
            '0',
            { minionUid: 'igor1', baseIndex: 0 },
            { sourceId: 'base_rlyeh' },
            defaultTestRandom,
            1000
        );
        
        console.log('Handler result events:', handlerResult.events.map((e: any) => e.type));
        
        // 第二步：调用 processDestroyMoveCycle（模拟 SmashUpEventSystem.afterEvents）
        const afterDestroyMove = processDestroyMoveCycle(
            handlerResult.events as SmashUpEvent[],
            handlerResult.matchState ?? ms,
            '0',
            defaultTestRandom,
            1000
        );
        
        // 检查：应该只有一个 Igor 交互（onDestroy）
        const allInteractions = [];
        if (afterDestroyMove.matchState?.sys.interaction.current) {
            allInteractions.push(afterDestroyMove.matchState.sys.interaction.current);
        }
        if (afterDestroyMove.matchState?.sys.interaction.queue) {
            allInteractions.push(...afterDestroyMove.matchState.sys.interaction.queue);
        }
        
        const igorInteractions = allInteractions.filter(i => (i.data as any)?.sourceId === 'frankenstein_igor');
        
        console.log('All interactions:', allInteractions.map(i => ({
            id: i.id,
            sourceId: (i.data as any)?.sourceId,
            playerId: i.playerId,
        })));
        
        console.log('Igor interactions:', igorInteractions.length);
        
        // ❌ Bug: 这里会失败，因为 Igor 触发了两次
        expect(igorInteractions.length).toBe(1);
    });
});
