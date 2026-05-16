/**
 * Bug 测试：科学小怪蛋 (Igor) 被拉莱耶基地消灭时触发两次
 * 
 * 用户报告：在拉莱耶基地（base_rlyeh）上，回合开始时选择消灭 Igor，
 * Igor 的 onDestroy 能力触发了两次，要求玩家两次选择放置+1力量指示物的目标。
 * 
 * 用户确认：实际给两个不同的随从各加了+1力量，说明 Igor 的 onDestroy 确实触发了两次。
 */

import { getPromptsBySourceId, makeState, makeBase, makeMinion, makeMatchState, makePlayer, resolveDestroyedMinions } from './helpers';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { defaultTestRandom } from './testRunner';

describe('Bug: Igor 被 base_rlyeh 消灭时触发两次', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('场景测试：base_crypt + Igor 双重触发（可能的根因）', () => {
        // 假设：如果基地是 base_crypt（地窖），它也会在随从被消灭时创建交互
        // 这可能导致用户看到两个"放置+1指示物"的交互
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [
                makeBase('base_crypt', [
                    makeMinion('igor1', 'frankenstein_igor', '0', 2),
                    makeMinion('monster1', 'frankenstein_the_monster', '0', 4),
                    makeMinion('wolf1', 'werewolf_loup_garou', '0', 4), // 添加第三个随从，使 Igor 创建交互
                ]),
            ],
        });
        
        const ms = makeMatchState(core);
        
        // 创建一个 MINION_DESTROYED 事件（模拟消灭 Igor）
        const destroyEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'igor1',
                minionDefId: 'frankenstein_igor',
                fromBaseIndex: 0,
                ownerId: '0',
                destroyerId: '0',
                reason: 'test',
            },
            timestamp: 1000,
        };
        
        const result = resolveDestroyedMinions(ms, '0', [destroyEvent], defaultTestRandom, 1000);
        
        // 检查：应该有两个业务 prompt
        // 1. Igor 的 onDestroy（选择放置+1指示物的随从）
        // 2. base_crypt 的 onMinionDestroyed（消灭者选择放置+1指示物的随从）
        expect(result.matchState).toBeDefined();
        
        console.log('=== base_crypt + Igor scenario ===');
        const igorInteractions = getPromptsBySourceId(result.matchState!, 'frankenstein_igor');
        const cryptInteractions = getPromptsBySourceId(result.matchState!, 'base_crypt');
        console.log('Total business prompts:', igorInteractions.length + cryptInteractions.length);
        
        console.log('Igor interactions:', igorInteractions.length);
        console.log('Crypt interactions:', cryptInteractions.length);
        
        // 预期：Igor 触发一次，base_crypt 触发一次
        expect(igorInteractions.length).toBe(1);
        expect(cryptInteractions.length).toBe(1);
        expect(igorInteractions.length + cryptInteractions.length).toBe(2);
    });
});
