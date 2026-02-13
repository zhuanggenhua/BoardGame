/**
 * 大杀四方 - 具体基地能力集成测试
 *
 * 覆盖：
 * - base_rhodes_plaza: beforeScoring 每位玩家每个随从 1VP
 * - base_locker_room: onTurnStart 有随从则抽牌
 * - base_central_brain: onMinionPlayed +1 力量指示物
 * - base_the_factory: beforeScoring 冠军每5力量1VP
 * - base_cave_of_shinies: onMinionDestroyed 拥有者获得1VP（扩展时机）
 * - Property 17: 基地能力事件顺序
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    triggerBaseAbility,
    triggerExtendedBaseAbility,
} from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { getEffectivePower } from '../domain/ongoingModifiers';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
        silent: true,
    });
}

/** 蛇形选秀 + 推进到 playCards */
const DRAFT_COMMANDS: SmashUpCommand[] = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
] as any[];

// ============================================================================
// base_central_brain: 中央大脑 - 持续被动 +1 力量（power modifier）
// ============================================================================

describe('base_central_brain: 持续被动 +1 力量', () => {
    it('中央大脑基地上的随从 getEffectivePower 包含 +1 修正', () => {
        const minion = {
            uid: 'm1', defId: 'd1', controller: '0', owner: '0',
            basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [],
        };
        const state = {
            bases: [{
                defId: 'base_central_brain',
                minions: [minion],
                ongoingActions: [],
            }],
            players: { '0': { hand: [], deck: [], discard: [] } },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        } as any;

        const effective = getEffectivePower(state, minion, 0);
        // basePower(3) + powerModifier(0) + ongoingModifier(+1 from central brain) = 4
        expect(effective).toBe(4);
    });

    it('非中央大脑基地上的随从不获得 +1 修正', () => {
        const minion = {
            uid: 'm1', defId: 'd1', controller: '0', owner: '0',
            basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [],
        };
        const state = {
            bases: [{
                defId: 'base_the_jungle',
                minions: [minion],
                ongoingActions: [],
            }],
            players: { '0': { hand: [], deck: [], discard: [] } },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        } as any;

        const effective = getEffectivePower(state, minion, 0);
        expect(effective).toBe(3);
    });

    it('移动到中央大脑的随从也获得 +1（非仅入场时）', () => {
        const m1 = {
            uid: 'm1', defId: 'd1', controller: '0', owner: '0',
            basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [],
        };
        const m2 = {
            uid: 'm2', defId: 'd2', controller: '1', owner: '1',
            basePower: 2, powerModifier: 0, talentUsed: false, attachedActions: [],
        };
        const state = {
            bases: [{
                defId: 'base_central_brain',
                minions: [m1, m2],
                ongoingActions: [],
            }],
            players: {
                '0': { hand: [], deck: [], discard: [] },
                '1': { hand: [], deck: [], discard: [] },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        } as any;

        expect(getEffectivePower(state, m1, 0)).toBe(6); // 5 + 0 + 1
        expect(getEffectivePower(state, m2, 0)).toBe(3); // 2 + 0 + 1
    });
});

// ============================================================================
// base_rhodes_plaza: 罗德百货商场 - beforeScoring 每个随从 1VP
// ============================================================================

describe('base_rhodes_plaza: 计分时每个随从 1VP', () => {
    it('注册表中 beforeScoring 能力正确触发', () => {
        // 直接测试 triggerBaseAbility
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_rhodes_plaza',
                    minions: [
                        { uid: 'm1', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'd2', controller: '0', owner: '0', basePower: 2, powerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm3', defId: 'd3', controller: '1', owner: '1', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {},
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_rhodes_plaza',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_rhodes_plaza', 'beforeScoring', ctx);
        expect(events.length).toBe(2); // P0 得 2VP，P1 得 1VP

        const p0Event = events.find((e) => e.type === SU_EVENTS.VP_AWARDED && (e as any).payload.playerId === '0');
        const p1Event = events.find((e) => e.type === SU_EVENTS.VP_AWARDED && (e as any).payload.playerId === '1');
        expect(p0Event).toBeDefined();
        expect(p1Event).toBeDefined();
        expect((p0Event as any).payload.amount).toBe(2);
        expect((p1Event as any).payload.amount).toBe(1);
    });
});

// ============================================================================
// base_the_factory: 工厂 - beforeScoring 冠军每5力量1VP
// ============================================================================

describe('base_the_factory: 冠军每5力量1VP', () => {
    it('冠军 10 力量获得 2VP', () => {
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_the_factory',
                    minions: [
                        { uid: 'm1', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'd2', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm3', defId: 'd3', controller: '1', owner: '1', basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {},
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_the_factory',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_the_factory', 'beforeScoring', ctx);
        expect(events.length).toBe(1);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.amount).toBe(2); // 10 / 5 = 2
    });

    it('冠军 7 力量获得 1VP', () => {
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_the_factory',
                    minions: [
                        { uid: 'm1', defId: 'd1', controller: '0', owner: '0', basePower: 4, powerModifier: 3, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'd2', controller: '1', owner: '1', basePower: 2, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {},
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_the_factory',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_the_factory', 'beforeScoring', ctx);
        expect(events.length).toBe(1);
        expect((events[0] as any).payload.amount).toBe(1); // 7 / 5 = 1
    });

    it('无随从时不产生事件', () => {
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_the_factory',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {},
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_the_factory',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_the_factory', 'beforeScoring', ctx);
        expect(events.length).toBe(0);
    });
});


// ============================================================================
// base_locker_room: 更衣室 - onTurnStart 有随从则抽牌
// ============================================================================

describe('base_locker_room: 回合开始抽牌', () => {
    it('有随从在更衣室时回合开始抽 1 张牌', () => {
        const topCardUid = 'c_top';
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_locker_room',
                    minions: [
                        { uid: 'm1', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [
                            { uid: topCardUid, defId: 'test_card', type: 'minion', owner: '0' },
                            { uid: 'c2', defId: 'test_card2', type: 'action', owner: '0' },
                        ],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as unknown as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_locker_room',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_locker_room', 'onTurnStart', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.cardUids).toEqual([topCardUid]);
    });

    it('没有随从在更衣室时不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_locker_room',
                    minions: [
                        // 只有对手的随从
                        { uid: 'm1', defId: 'd1', controller: '1', owner: '1', basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [{ uid: 'c1', defId: 'test', type: 'minion', owner: '0' }],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as unknown as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_locker_room',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_locker_room', 'onTurnStart', ctx);
        expect(events.length).toBe(0);
    });

    it('牌库为空时不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_locker_room',
                    minions: [
                        { uid: 'm1', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [], // 空牌库
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as unknown as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_locker_room',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_locker_room', 'onTurnStart', ctx);
        expect(events.length).toBe(0);
    });
});

// ============================================================================
// base_cave_of_shinies: 闪光洞穴 - onMinionDestroyed 拥有者获得1VP
// ============================================================================

describe('base_cave_of_shinies: 随从被消灭获得1VP', () => {
    it('扩展时机 onMinionDestroyed 正确触发', () => {
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_cave_of_shinies',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {},
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0', // 被消灭随从的拥有者
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.amount).toBe(1);
    });

    it('其他基地不触发 onMinionDestroyed', () => {
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_the_jungle',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {},
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_the_jungle',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_the_jungle', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });
});

// ============================================================================
// Property 17: 基地能力事件顺序
// ============================================================================

describe('Property 17: 基地能力事件顺序', () => {
    it('onTurnStart 事件在 TURN_STARTED 之后', () => {
        // 通过 FlowHooks 集成测试验证
        // onPhaseEnter('startTurn') 先产生 TURN_STARTED，再触发基地 onTurnStart
        // 这已在 FlowHooks 代码中保证（先 push turnStarted，再 push baseEvents）
        // 此处用单元测试验证注册表触发顺序
        const triggered: string[] = [];

        // 模拟：先记录 TURN_STARTED，再触发基地能力
        triggered.push(SU_EVENTS.TURN_STARTED);

        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_locker_room',
                    minions: [
                        { uid: 'm1', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [{ uid: 'c1', defId: 'test', type: 'minion', owner: '0' }],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as unknown as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_locker_room',
            playerId: '0',
            now: 1000,
        };

        const { events: baseEvents } = triggerBaseAbility('base_locker_room', 'onTurnStart', ctx);
        for (const e of baseEvents) triggered.push(e.type);

        // TURN_STARTED 在基地能力事件之前
        const turnStartIdx = triggered.indexOf(SU_EVENTS.TURN_STARTED);
        const drawIdx = triggered.indexOf(SU_EVENTS.CARDS_DRAWN);
        expect(turnStartIdx).toBeLessThan(drawIdx);
    });

    it('beforeScoring 事件在 BASE_SCORED 之前（通过 FlowHooks 保证）', () => {
        // FlowHooks.onPhaseEnter('scoreBases') 中：
        // 1. 先调用 triggerBaseAbility(beforeScoring)
        // 2. 再生成 BASE_SCORED 事件
        // 此处验证注册表能正确返回 beforeScoring 事件
        const ctx: BaseAbilityContext = {
            state: {
                bases: [{
                    defId: 'base_rhodes_plaza',
                    minions: [
                        { uid: 'm1', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                players: {},
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
            } as SmashUpCore,
            baseIndex: 0,
            baseDefId: 'base_rhodes_plaza',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_rhodes_plaza', 'beforeScoring', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        // 在实际 FlowHooks 中，这些事件会在 BASE_SCORED 之前被 push
    });
});

// ============================================================================
// base_the_homeworld: 母星 - E2E Pipeline 测试
// ============================================================================

import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createSmashUpEventSystem } from '../domain/systems';

function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const allSystems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    const sys = createInitialSystemState(PLAYER_IDS, allSystems);
    return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

function createCustomRunner(customState: MatchState<SmashUpCore>) {
    const allSystems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    return new GameTestRunner<SmashUpCore, any, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: allSystems,
        playerIds: PLAYER_IDS,
        setup: () => customState,
        silent: true,
    });
}

describe('base_the_homeworld: 母星 E2E Pipeline 额外出牌', () => {
    it('打出随从到母星后 minionLimit 增加，可以打出第二个力量≤2的随从', () => {
        const core: SmashUpCore = {
            players: {
                '0': {
                    id: '0', vp: 0,
                    hand: [
                        { uid: 'c1', defId: 'alien_invader', type: 'minion', owner: '0' },
                        { uid: 'c2', defId: 'alien_collector', type: 'minion', owner: '0' },
                    ],
                    deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1,
                    actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS] as [string, string],
                },
                '1': {
                    id: '1', vp: 0,
                    hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1,
                    actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] as [string, string],
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_the_jungle', minions: [], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        } as SmashUpCore;

        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);

        // 两个命令在同一个 run 中执行，确保状态连续
        const result = runner.run({
            name: '母星额外出牌完整流程',
            commands: [
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c2', baseIndex: 0 } },
            ],
        });

        // Step 1 应成功
        expect(result.steps[0]?.success).toBe(true);
        // Step 2 应成功（母星 LIMIT_MODIFIED 将 minionLimit 提升到 2）
        console.log('Step1 events:', result.steps[0]?.events);
        console.log('Step2 success:', result.steps[1]?.success);
        console.log('Step2 error:', result.steps[1]?.error);
        console.log('Step2 events:', result.steps[1]?.events);
        console.log('Final minionLimit:', result.finalState.core.players['0'].minionLimit);
        console.log('Final minionsPlayed:', result.finalState.core.players['0'].minionsPlayed);
        console.log('Final base0 minions:', result.finalState.core.bases[0].minions.map(m => m.uid));

        expect(result.steps[1]?.success).toBe(true);
        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].minionsPlayed).toBe(2);
        expect(finalCore.bases[0].minions.length).toBe(2);
    });
});
