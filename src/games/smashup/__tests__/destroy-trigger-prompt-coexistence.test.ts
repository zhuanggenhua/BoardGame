/**
 * destroy trigger prompt 并存合同
 *
 * 锁定“随从 onDestroy prompt”与“基地 onMinionDestroyed prompt”同时出现时的系统行为：
 * - `frankenstein_igor` 只触发一次
 * - `base_crypt` 也能保留自己的独立 prompt
 * - 两类 prompt 可以并存，但不能被重复处理伪装成双触发
 */

import { getPromptsBySourceId, makeState, makeBase, makeMinion, makeMatchState, makePlayer, resolveDestroyedMinions } from './helpers';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { defaultTestRandom } from './testRunner';

describe('destroy trigger prompt 并存', () => {
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

        const igorInteractions = getPromptsBySourceId(result.matchState!, 'frankenstein_igor');
        const cryptInteractions = getPromptsBySourceId(result.matchState!, 'base_crypt');

        // 预期：Igor 触发一次，base_crypt 触发一次
        expect(igorInteractions.length).toBe(1);
        expect(cryptInteractions.length).toBe(1);
        expect(igorInteractions.length + cryptInteractions.length).toBe(2);
    });
});
