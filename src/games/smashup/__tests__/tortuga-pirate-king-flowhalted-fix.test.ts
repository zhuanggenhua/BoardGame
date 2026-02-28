/**
 * 测试：托尔图加计分 - 海盗王移动后 flowHalted 清除
 * 
 * Bug: 海盗王 beforeScoring 移动后,flowHalted 标志没有清除,
 * 导致托尔图加 afterScoring 永远不会执行,用户卡住。
 * 
 * 修复: onPhaseExit('scoreBases') 的 flowHalted 守卫增加交互状态检查:
 * `if (state.sys.flowHalted && state.sys.interaction.current)`
 * 
 * 相关文档: docs/bugs/smashup-tortuga-pirate-king-卡住-2026-02-28-16-53.md
 */

import { describe, it, expect } from 'vitest';
import { smashUpFlowHooks } from '../domain';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore } from '../domain/types';

describe('托尔图加计分 - 海盗王移动后 flowHalted 清除', () => {
    it('flowHalted=true 且交互已解决时,应该继续执行计分逻辑', () => {
        // 构造场景: flowHalted=true, 但交互已解决 (current=null)
        const state: MatchState<SmashUpCore> = {
            core: {
                players: {
                    '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates'], sameNameMinionDefId: null },
                    '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens'], sameNameMinionDefId: null },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_tortuga',
                        minions: [
                            // 玩家0: 17 力量
                            { uid: 'm1', defId: 'pirate_king', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'm2', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'm3', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'm4', defId: 'pirate_buccaneer', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            // 玩家1: 10 力量
                            { uid: 'm5', defId: 'alien_scout', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'm6', defId: 'alien_scout', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'm7', defId: 'alien_scout', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'm8', defId: 'alien_invader', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: ['base_the_mothership'],
                turnNumber: 1,
                nextUid: 100,
                turnDestroyedMinions: [],
                scoringEligibleBaseIndices: [0], // 托尔图加达到临界点
            },
            sys: {
                phase: 'scoreBases',
                flowHalted: true, // ← 关键: flowHalted=true (海盗王交互解决后)
                interaction: {
                    current: null, // ← 关键: 交互已解决
                    queue: [],
                },
                responseWindow: {
                    current: null,
                },
            },
        };

        // 调用 onPhaseExit('scoreBases')
        const result = smashUpFlowHooks.onPhaseExit!({
            state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', timestamp: 1000 },
            random: () => 0.5,
        });

        // 验证: 不应该 halt (因为交互已解决)
        if (typeof result === 'object' && 'halt' in result) {
            expect(result.halt).toBe(false);
        }

        // 验证: 应该有 BASE_SCORED 事件 (托尔图加计分)
        const events = Array.isArray(result) ? result : result.events ?? [];
        const baseScoredEvent = events.find((e: any) => e.type === 'su:base_scored');
        expect(baseScoredEvent).toBeDefined();
        expect((baseScoredEvent as any)?.payload?.baseDefId).toBe('base_tortuga');
    });

    it('flowHalted=true 且交互仍在进行时,应该继续 halt', () => {
        // 构造场景: flowHalted=true, 交互仍在进行 (current !== null)
        const state: MatchState<SmashUpCore> = {
            core: {
                players: {
                    '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates'], sameNameMinionDefId: null },
                    '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens'], sameNameMinionDefId: null },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_tortuga',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
                turnDestroyedMinions: [],
                scoringEligibleBaseIndices: [0],
            },
            sys: {
                phase: 'scoreBases',
                flowHalted: true, // ← flowHalted=true
                interaction: {
                    current: { // ← 交互仍在进行
                        id: 'pirate_king_move_1000',
                        playerId: '0',
                        data: {
                            title: '海盗王：是否移动？',
                            options: [],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: null,
                },
            },
        };

        // 调用 onPhaseExit('scoreBases')
        const result = smashUpFlowHooks.onPhaseExit!({
            state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', timestamp: 1000 },
            random: () => 0.5,
        });

        // 验证: 应该 halt (因为交互仍在进行)
        expect(result).toEqual({ events: [], halt: true });
    });
});
