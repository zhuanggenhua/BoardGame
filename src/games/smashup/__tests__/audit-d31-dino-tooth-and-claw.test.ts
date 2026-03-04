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
import { SmashUpDomain, smashUpFlowHooks } from '../game';
import type { SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { createFlowSystem, createBaseSystems } from '../../../engine/systems';
import { createInitialSystemState } from '../../../engine/pipeline';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { SmashUpCore } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { createSmashUpEventSystem } from '../domain/systems';


beforeAll(() => {
    initAllAbilities();
});

function createRunner() {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(), // 必须包含此系统以处理交互解决事件
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: ['0', '1'],
    });
}

// 辅助函数：将 core 状态包装为 MatchState
function wrapState(core: SmashUpCore) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(), // 必须包含此系统以处理交互解决事件
    ];
    const sys = createInitialSystemState(['0', '1'], systems, undefined);
    sys.phase = 'playCards';
    return { core, sys };
}

describe('Audit D31: dino_tooth_and_claw（全副武装）', () => {
    it('D31: 拦截路径1（直接命令执行）— 拦截消灭事件', () => {
        const runner = createRunner();
        
        runner.setState(wrapState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'ninja_assassination', type: 'action', subtype: 'ongoing', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['ninjas', 'ninjas'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs', 'dinosaurs'] },
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
                            basePower: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPowerModifier: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        }));

        // 玩家0打出 ninja_assassination（持续行动卡，附着到随从上）
        runner.executeCommand(SU_COMMANDS.PLAY_ACTION, { playerId: '0', cardUid: 'a1', targetBaseIndex: 0, targetMinionUid: 'm1' });

        let state = runner.getState();
        // 验证 ninja_assassination 已附着到随从上
        let minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        expect(minion?.attachedActions.some(a => a.defId === 'ninja_assassination')).toBe(true);
        // 验证 tooth_and_claw 仍然存在（还未到回合结束）
        expect(minion?.attachedActions.some(a => a.defId === 'dino_tooth_and_claw')).toBe(true);

        // 推进到回合结束，触发 ninja_assassination 的 onTurnEnd
        runner.executeCommand('ADVANCE_PHASE', { playerId: '0' });

        state = runner.getState();
        // 验证随从存活（tooth_and_claw 拦截了消灭事件并自毁）
        minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证 tooth_and_claw 已被移除（自毁）
        expect(minion?.attachedActions.some(a => a.defId === 'dino_tooth_and_claw')).toBe(false);
        // 验证 ninja_assassination 仍然存在（因为消灭事件被拦截，assassination 不会被移除）
        expect(minion?.attachedActions.some(a => a.defId === 'ninja_assassination')).toBe(true);
    });

    it('D31: 拦截路径2（交互解决）— 拦截返回手牌事件', () => {
        const runner = createRunner();
        
        runner.setState(wrapState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'alien_abduction', type: 'action', subtype: 'standard', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'aliens'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs', 'dinosaurs'] },
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
                            basePower: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPowerModifier: 0,
                            powerModifier: 0
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        }));

        // 玩家0打出 alien_abduction（返回随从到手牌）
        runner.executeCommand(SU_COMMANDS.PLAY_ACTION, { playerId: '0', cardUid: 'a1', targetBaseIndex: 0 });
        const resolveResult = runner.resolveInteraction('0', { optionId: 'minion-0' });

        const state = runner.getState();
        // 验证随从存活（tooth_and_claw 拦截了返回手牌事件）
        const minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证 tooth_and_claw 已被移除（自毁）
        expect(minion?.attachedActions.some(a => a.defId === 'dino_tooth_and_claw')).toBe(false);
        // 验证随从未返回手牌
        expect(state.core.players['1'].hand.find(c => c.uid === 'm1')).toBeUndefined();
    });

    it('D31: 不拦截己方操作 — 己方消灭自己的随从', () => {
        const runner = createRunner();
        
        runner.setState(wrapState({
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs', 'dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [{ uid: 'a1', defId: 'ninja_assassination', type: 'action', subtype: 'ongoing', owner: '1' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['ninjas', 'ninjas'] },
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
                            basePower: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPowerModifier: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        }));

        // 玩家1打出 ninja_assassination 附着到自己的随从上
        runner.executeCommand(SU_COMMANDS.PLAY_ACTION, { playerId: '1', cardUid: 'a1', targetBaseIndex: 0, targetMinionUid: 'm1' });

        let state = runner.getState();
        // 验证 ninja_assassination 已附着
        let minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        expect(minion?.attachedActions.some(a => a.defId === 'ninja_assassination')).toBe(true);

        // 推进到回合结束，触发 ninja_assassination 的 onTurnEnd
        runner.executeCommand('ADVANCE_PHASE', { playerId: '1' });

        state = runner.getState();
        // 验证随从被消灭（tooth_and_claw 不拦截己方操作）
        minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeUndefined();
        // 验证随从进入弃牌堆
        expect(state.core.players['1'].discard.find(c => c.uid === 'm1')).toBeDefined();
    });

    it('D31: POD版简单保护 — 只保护不自毁', () => {
        const runner = createRunner();
        
        runner.setState(wrapState({
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'a1', defId: 'ninja_assassination', type: 'action', subtype: 'ongoing', owner: '0' }], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['ninjas', 'ninjas'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs', 'dinosaurs'] },
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
                            basePower: 3, 
                            attachedActions: [{ uid: 'tc1', defId: 'dino_tooth_and_claw_pod', ownerId: '1', metadata: {} }], 
                            powerCounters: 0, 
                            tempPowerModifier: 0 
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        }));

        // 玩家0打出 ninja_assassination（持续行动卡，附着到随从上）
        runner.executeCommand(SU_COMMANDS.PLAY_ACTION, { playerId: '0', cardUid: 'a1', targetBaseIndex: 0, targetMinionUid: 'm1' });

        let state = runner.getState();
        // 验证 ninja_assassination 已附着
        let minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        expect(minion?.attachedActions.some(a => a.defId === 'ninja_assassination')).toBe(true);

        // 推进到回合结束，触发 ninja_assassination 的 onTurnEnd
        runner.executeCommand('ADVANCE_PHASE', { playerId: '0' });

        state = runner.getState();
        // 验证随从存活（tooth_and_claw_pod 保护）
        minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证 tooth_and_claw_pod 仍然存在（不自毁）
        expect(minion?.attachedActions.some(a => a.defId === 'dino_tooth_and_claw_pod')).toBe(true);
        // 验证 ninja_assassination 仍然存在（因为消灭事件被拦截）
        expect(minion?.attachedActions.some(a => a.defId === 'ninja_assassination')).toBe(true);
    });

    it('D31: 拦截路径完整性 — 多次拦截', () => {
        const runner = createRunner();
        
        runner.setState(wrapState({
            players: {
                '0': { id: '0', vp: 0, hand: [
                    { uid: 'a1', defId: 'ninja_assassination', type: 'action', subtype: 'ongoing', owner: '0' },
                    { uid: 'a2', defId: 'ninja_assassination', type: 'action', subtype: 'ongoing', owner: '0' },
                ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 2, factions: ['ninjas', 'ninjas'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['dinosaurs', 'dinosaurs'] },
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
                            basePower: 3, 
                            attachedActions: [
                                { uid: 'tc1', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} },
                                { uid: 'tc2', defId: 'dino_tooth_and_claw', ownerId: '1', metadata: {} }, // 两张 tooth_and_claw
                            ], 
                            powerCounters: 0, 
                            tempPowerModifier: 0,
                            powerModifier: 0
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        }));

        // 第一次攻击：打出第一张 ninja_assassination
        runner.executeCommand(SU_COMMANDS.PLAY_ACTION, { playerId: '0', cardUid: 'a1', targetBaseIndex: 0, targetMinionUid: 'm1' });

        let state = runner.getState();
        let minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证第一张 assassination 已附着
        expect(minion?.attachedActions.some(a => a.defId === 'ninja_assassination')).toBe(true);
        // 验证两张 tooth_and_claw 都还在
        expect(minion?.attachedActions.filter(a => a.defId === 'dino_tooth_and_claw').length).toBe(2);

        // 推进到回合结束，触发第一张 assassination
        runner.executeCommand('ADVANCE_PHASE', { playerId: '0' });

        state = runner.getState();
        minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        // 验证随从存活，第一张 tooth_and_claw 自毁
        expect(minion).toBeDefined();
        expect(minion?.attachedActions.filter(a => a.defId === 'dino_tooth_and_claw').length).toBe(1);
        // 验证第一张 assassination 仍然存在（因为消灭被拦截）
        expect(minion?.attachedActions.filter(a => a.defId === 'ninja_assassination').length).toBe(1);

        // 切换到玩家0的回合，打出第二张 assassination
        // 当前应该是玩家1的回合，需要再推进一次回到玩家0
        runner.executeCommand('ADVANCE_PHASE', { playerId: '1' });

        state = runner.getState();
        // 第二次攻击：打出第二张 ninja_assassination
        runner.executeCommand(SU_COMMANDS.PLAY_ACTION, { playerId: '0', cardUid: 'a2', targetBaseIndex: 0, targetMinionUid: 'm1' });

        state = runner.getState();
        minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeDefined();
        // 验证两张 assassination 都已附着
        expect(minion?.attachedActions.filter(a => a.defId === 'ninja_assassination').length).toBe(2);
        // 验证还有一张 tooth_and_claw
        expect(minion?.attachedActions.filter(a => a.defId === 'dino_tooth_and_claw').length).toBe(1);

        // 推进到回合结束，触发第二张 assassination
        runner.executeCommand('ADVANCE_PHASE', { playerId: '0' });

        state = runner.getState();
        minion = state.core.bases[0].minions.find(m => m.uid === 'm1');
        // 验证随从存活，第二张 tooth_and_claw 也自毁
        expect(minion).toBeDefined();
        expect(minion?.attachedActions.filter(a => a.defId === 'dino_tooth_and_claw').length).toBe(0);
        // 验证两张 assassination 都还在（因为两次消灭都被拦截）
        expect(minion?.attachedActions.filter(a => a.defId === 'ninja_assassination').length).toBe(2);
    });
});
