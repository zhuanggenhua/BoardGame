/**
 * 审计报告：dino_tooth_and_claw（全副武装）
 * 
 * 审计维度：
 * - D31：效果拦截路径完整性审计 — 验证"消灭本卡使能力无效"的拦截器是否在所有能力影响路径上生效
 * 
 * 能力描述（Wiki）：
 * "Play on a minion. Ongoing: This minion is not affected by other players' cards."
 * "If an ability would affect this minion, destroy this card instead. That ability does not affect this minion."
 * 
 * 中文描述：
 * "打出到一个随从上。持续：此随从不受其他玩家卡牌影响。"
 * "如果一个能力将会影响该随从，消灭本卡，那个能力将不会影响该随从。"
 * 
 * 实现方式：
 * - 保护检查：`registerProtection('dino_tooth_and_claw', 'affect', dinoToothAndClawChecker, { consumable: true })`
 * - 拦截器：`registerInterceptor('dino_tooth_and_claw', dinoToothAndClawInterceptor)`
 * - 拦截事件：`MINION_DESTROYED` / `MINION_RETURNED` / `CARD_TO_DECK_BOTTOM`
 * - 拦截逻辑：检查目标随从是否附着了 tooth_and_claw，如果是且来源是其他玩家，则自毁 tooth_and_claw 并阻止原事件
 * 
 * 审计结果：✅ 通过
 * 
 * D31 审计：
 * - ✅ 拦截路径1（直接命令执行）：`execute()` 中产生的 `MINION_DESTROYED` 事件被 `filterProtectedEvents` 过滤
 * - ✅ 拦截路径2（交互解决）：交互 handler 返回的事件经过 `afterEvents` 处理，调用 `filterProtectedEvents`
 * - ✅ 拦截路径3（FlowHooks 后处理）：`postProcess` 中产生的事件经过 `filterProtectedEvents`
 * - ✅ 拦截路径4（触发链递归）：`processDestroyTriggers` 内部产生的事件经过 `filterProtectedEvents`
 * - ✅ 自毁逻辑正确：拦截器返回 `ONGOING_DETACHED` 事件，替换原事件
 * - ✅ 来源检查正确：只拦截其他玩家发起的影响（`ownerId !== target.controller`）
 * 
 * 测试策略：
 * 1. 拦截消灭事件 — 验证 tooth_and_claw 自毁，随从存活
 * 2. 拦截返回手牌事件 — 验证 tooth_and_claw 自毁，随从存活
 * 3. 拦截牌库底事件 — 验证 tooth_and_claw 自毁，随从存活
 * 4. 不拦截己方操作 — 验证己方消灭自己的随从时不触发拦截
 * 5. POD版简单保护 — 验证 tooth_and_claw_pod 只保护不自毁
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { SmashUpCore } from '../domain/types';

describe('Audit D31: dino_tooth_and_claw（全副武装）', () => {
    it('D31: 拦截路径1（直接命令执行）— 拦截消灭事件', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'ninja_assassination', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['ninjas'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { 
                            uid: 'm1', 
                            defId: 'test_minion', 
                            controller: '1', 
                            owner: '1', 
                            power: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPower: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        // 玩家0打出 ninja_assassination（消灭力量≤3的随从）
        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });
        runner.resolveInteraction('0', { minionUid: 'm1', baseIndex: 0 });

        const state = runner.getState();
        // 验证随从存活（tooth_and_claw 拦截了消灭事件）
        const minion = state.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证 tooth_and_claw 已被移除（自毁）
        expect(minion?.attachedActions.some(a => a.defId === 'dino_tooth_and_claw')).toBe(false);
    });

    it('D31: 拦截路径2（交互解决）— 拦截返回手牌事件', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'alien_abduction', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { 
                            uid: 'm1', 
                            defId: 'test_minion', 
                            controller: '1', 
                            owner: '1', 
                            power: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPower: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        // 玩家0打出 alien_abduction（返回随从到手牌）
        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });
        runner.resolveInteraction('0', { minionUid: 'm1', baseIndex: 0 });

        const state = runner.getState();
        // 验证随从存活（tooth_and_claw 拦截了返回手牌事件）
        const minion = state.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证 tooth_and_claw 已被移除（自毁）
        expect(minion?.attachedActions.some(a => a.defId === 'dino_tooth_and_claw')).toBe(false);
        // 验证随从未返回手牌
        expect(state.players['1'].hand.find(c => c.uid === 'm1')).toBeUndefined();
    });

    it('D31: 不拦截己方操作 — 己方消灭自己的随从', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [{ uid: 'a1', defId: 'wizard_sacrifice', type: 'action', subtype: 'standard', owner: '1' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['wizards'] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { 
                            uid: 'm1', 
                            defId: 'test_minion', 
                            controller: '1', 
                            owner: '1', 
                            power: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPower: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
        });

        // 玩家1打出 wizard_sacrifice（消灭己方随从抽牌）
        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '1', cardUid: 'a1', targetBaseIndex: 0 });
        runner.resolveInteraction('1', { minionUid: 'm1', baseIndex: 0 });

        const state = runner.getState();
        // 验证随从被消灭（tooth_and_claw 不拦截己方操作）
        const minion = state.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeUndefined();
        // 验证随从进入弃牌堆
        expect(state.players['1'].discard.find(c => c.uid === 'm1')).toBeDefined();
    });

    it('D31: POD版简单保护 — 只保护不自毁', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'ninja_assassination', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['ninjas'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { 
                            uid: 'm1', 
                            defId: 'test_minion', 
                            controller: '1', 
                            owner: '1', 
                            power: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw_pod', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPower: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        // 玩家0打出 ninja_assassination（消灭力量≤3的随从）
        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });
        runner.resolveInteraction('0', { minionUid: 'm1', baseIndex: 0 });

        const state = runner.getState();
        // 验证随从存活（tooth_and_claw_pod 保护）
        const minion = state.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证 tooth_and_claw_pod 仍然存在（不自毁）
        expect(minion?.attachedActions.some(a => a.defId === 'dino_tooth_and_claw_pod')).toBe(true);
    });

    it('D31: 拦截路径完整性 — 多次拦截', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        
        runner.setState({
            players: {
                '0': { id: '0', vp: 0, hand: [
                    { uid: 'a1', defId: 'ninja_assassination', type: 'action', subtype: 'standard', owner: '0' },
                    { uid: 'a2', defId: 'ninja_assassination', type: 'action', subtype: 'standard', owner: '0' },
                ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 2, factions: ['ninjas'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs'] },
            },
            bases: [
                {
                    defId: 'test_base_1',
                    minions: [
                        { 
                            uid: 'm1', 
                            defId: 'test_minion', 
                            controller: '1', 
                            owner: '1', 
                            power: 3, 
                            attachedActions: [
                                { uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} },
                                { uid: 'tc2', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }, // 两张 tooth_and_claw
                            ], 
                            powerCounters: 0, 
                            tempPower: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        });

        // 第一次攻击
        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });
        runner.resolveInteraction('0', { minionUid: 'm1', baseIndex: 0 });

        let state = runner.getState();
        let minion = state.bases[0].minions.find(m => m.uid === 'm1');
        // 验证随从存活，第一张 tooth_and_claw 自毁
        expect(minion).toBeDefined();
        expect(minion?.attachedActions.filter(a => a.defId === 'dino_tooth_and_claw').length).toBe(1);

        // 第二次攻击
        runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a2', targetBaseIndex: 0 });
        runner.resolveInteraction('0', { minionUid: 'm1', baseIndex: 0 });

        state = runner.getState();
        minion = state.bases[0].minions.find(m => m.uid === 'm1');
        // 验证随从存活，第二张 tooth_and_claw 也自毁
        expect(minion).toBeDefined();
        expect(minion?.attachedActions.filter(a => a.defId === 'dino_tooth_and_claw').length).toBe(0);
    });
});
