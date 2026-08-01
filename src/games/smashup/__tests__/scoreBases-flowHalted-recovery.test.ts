/**
 * scoreBases flowHalted 恢复合同
 *
 * 锁定 `onPhaseExit('scoreBases')` 在 flowHalted 场景下的恢复语义：
 * - 若当前交互已解决，应清除 flowHalted，并进入 awaiting-post-reduce 收尾
 *   此时 BASE_CLEARED / BASE_REPLACED 仍保留在后续 continuation，而不是在本次恢复里立刻发出
 * - 若当前交互仍在进行，应继续 halt，不能越过交互
 *
 * 场景素材借用托尔图加 / 海盗王，但真实边界是 scoreBases 阶段恢复合同，不是单张卡修复文件。
 */

import { describe, it, expect } from 'vitest';
import { smashUpFlowHooks } from '../domain';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore } from '../domain/types';
import { createScoringSession, getScoringSession, setScoringSession } from '../domain/scoringSession';
import { expectNoPrompt, getFirstPrompt } from './helpers';

describe('scoreBases flowHalted 恢复', () => {
    it('flowHalted=true 且交互已解决时,应该清除 flowHalted 并进入 awaiting-post-reduce', () => {
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
        const scoringState = setScoringSession(state, createScoringSession(state.core, [0]));

        const result = smashUpFlowHooks.onPhaseExit!({
            state: scoringState,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', timestamp: 1000 },
            random: () => 0.5,
        });

        expect(Array.isArray(result)).toBe(false);
        expect(result).toMatchObject({ halt: true });

        // 当前实现会先恢复计分主事件，然后把清场/换基地延后到后续 continuation
        const events = Array.isArray(result) ? result : result.events ?? [];
        expect(events.map((event) => event.type)).toEqual([
            'su:before_scoring_triggered',
            'su:when_scoring_triggered',
            'su:base_scored',
            'su:after_scoring_triggered',
        ]);

        const baseScoredEvent = events.find((e) => e.type === 'su:base_scored');
        expect(baseScoredEvent).toBeDefined();
        expect(baseScoredEvent?.payload).toMatchObject({
            baseDefId: 'base_tortuga',
            rankings: [
                { playerId: '0', power: 17, vp: 4 },
                { playerId: '1', power: 12, vp: 3 },
            ],
        });

        if (typeof result === 'object' && result && 'updatedState' in result && result.updatedState) {
            expect(result.updatedState.sys.flowHalted).toBe(false);
            expectNoPrompt(result.updatedState);
            expect(result.updatedState.sys.responseWindow?.current).toBeUndefined();
            expect(getScoringSession(result.updatedState)).toMatchObject({
                currentStep: 'awaiting-post-scoring-delay',
                lockedBaseRefs: [{ slotIndex: 0, baseDefId: 'base_tortuga' }],
                completedBaseRefs: [],
            });
        }
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
        const scoringState = setScoringSession(state, createScoringSession(state.core, [0]));

        const result = smashUpFlowHooks.onPhaseExit!({
            state: scoringState,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', timestamp: 1000 },
            random: () => 0.5,
        });

        // 验证: 应该 halt (因为交互仍在进行)
        expect(result).toMatchObject({ events: [], halt: true });
        if (typeof result === 'object' && result && 'updatedState' in result) {
            expect(result.updatedState).toBeDefined();
            if (result.updatedState) {
                expect(result.updatedState.sys.phase).toBe('scoreBases');
                expect(result.updatedState.sys.flowHalted).toBe(true);
                expect(getFirstPrompt(result.updatedState)).toBeTruthy();
                expect(getScoringSession(result.updatedState)).toMatchObject({
                    currentStep: 'idle',
                    lockedBaseRefs: [{ slotIndex: 0, baseDefId: 'base_tortuga' }],
                    completedBaseRefs: [],
                });
            }
        }
    });
});
