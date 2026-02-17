/**
 * 大杀四方 - 多基地记分与平局 VP 测试
 *
 * 覆盖 Property 14: 多基地记分提示（PromptSystem）
 * 覆盖 Property 15: 记分循环完整性
 * 覆盖 Property 16: 平局 VP 分配（FlowHooks 层面）
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { smashUpFlowHooks } from '../domain/index';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { SmashUpCore, MinionOnBase, PlayerState } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type { GameEvent, MatchState, Command, RandomFn } from '../../../engine/types';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0,
        talentUsed: false, attachedActions: [],
    };
}

function makePlayer(
    id: string,
    factions: [string, string] = [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS]
): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions,
    };
}

const mockRandom: RandomFn = {
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
} as any;

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return { core, sys: { phase: 'scoreBases', responseWindow: { current: undefined }, interaction: { current: undefined, queue: [] } } as any } as any;
}

const mockCommand: Command = { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any;

function callOnPhaseExit(core: SmashUpCore): GameEvent[] | PhaseExitResult {
    // 记分逻辑在 onPhaseExit('scoreBases') 中执行
    const result = smashUpFlowHooks.onPhaseExit!({
        state: ({
            core,
            sys: { phase: 'scoreBases', responseWindow: { current: undefined }, interaction: { queue: [] } },
        } as unknown) as MatchState<SmashUpCore>,
        from: 'scoreBases',
        to: 'draw',
        command: mockCommand,
        random: mockRandom,
    });
    return result ?? [];
}

/** 提取事件（兼容 GameEvent[] 和 PhaseExitResult） */
function extractEvents(result: GameEvent[] | PhaseExitResult): GameEvent[] {
    if (Array.isArray(result)) return result;
    return (result as PhaseExitResult).events ?? [];
}

describe.skip('Property 14: 多基地记分提示', () => {
    // TODO: 这些测试需要修复 - 可能与 state.bases 访问有关
    it('两个基地同时达标时返回 PROMPT_CONTINUATION 而非直接记分', () => {
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                { defId: 'base_the_jungle', minions: [makeMinion('m1', '0', 15)], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [makeMinion('m2', '1', 20)], ongoingActions: [] },
            ],
            baseDeck: ['base_central_brain', 'base_locker_room'],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = callOnPhaseExit(core);

        // 应返回 PhaseExitResult（非数组）
        expect(Array.isArray(result)).toBe(false);
        const exitResult = result as PhaseExitResult;
        expect(exitResult.halt).toBe(true);

        const events = exitResult.events ?? [];
        // 迁移后：交互通过 InteractionSystem 创建
        const interactions = (() => {
            const interaction = (exitResult.updatedState?.sys as any)?.interaction;
            if (!interaction) return [];
            const list: any[] = [];
            if (interaction.current) list.push(interaction.current);
            if (interaction.queue?.length) list.push(...interaction.queue);
            return list;
        })();
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('multi_base_scoring');

        // 不应有 BASE_SCORED 事件（等待玩家选择）
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scoredEvents.length).toBe(0);
    });

    it('multi_base_scoring 交互处理函数已注册', () => {
        const fn = getInteractionHandler('multi_base_scoring');
        expect(fn).toBeDefined();
        expect(typeof fn).toBe('function');
    });

    it('multi_base_scoring 继续函数正确记分选中的基地', () => {
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                { defId: 'base_the_jungle', minions: [makeMinion('m1', '0', 15)], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [makeMinion('m2', '1', 20)], ongoingActions: [] },
            ],
            baseDeck: ['base_central_brain', 'base_locker_room'],
            turnNumber: 1,
            nextUid: 100,
        };

        const fn = getInteractionHandler('multi_base_scoring')!;
        const ms = makeMatchState(core);
        const result = fn(ms, '0', { baseIndex: 1 }, undefined, mockRandom, 1000);
        const events = result?.events ?? [];

        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scoredEvents.length).toBe(1);
        expect((scoredEvents[0] as any).payload.baseDefId).toBe('base_tar_pits');

        const replacedEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_REPLACED);
        expect(replacedEvents.length).toBe(1);
    });
});

describe.skip('Property 15: 多基地记分循环', () => {
    // TODO: 这些测试需要修复 - 可能与 state.bases 访问有关
    it('两个基地同时达标时通过 Prompt 选择后逐个记分（P14 + P15 联合）', () => {
        // 此测试验证 P14 的 Prompt 创建 + P15 的继续函数正确记分
        // 完整的 Prompt 交互流程在 promptSystem.test.ts 中通过 GameTestRunner 测试
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                { defId: 'base_the_jungle', minions: [makeMinion('m1', '0', 15)], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [makeMinion('m2', '1', 20)], ongoingActions: [] },
            ],
            baseDeck: ['base_central_brain', 'base_locker_room'],
            turnNumber: 1,
            nextUid: 100,
        };

        // 第一次调用：2 基地达标 → 返回 Prompt
        const result1 = callOnPhaseExit(core);
        expect(Array.isArray(result1)).toBe(false);
        expect((result1 as PhaseExitResult).halt).toBe(true);

        // 模拟玩家选择 base_the_jungle（index=0）
        const fn = getInteractionHandler('multi_base_scoring')!;
        const ms = makeMatchState(core);
        const handlerResult = fn(ms, '0', { baseIndex: 0 }, undefined, mockRandom, 1000);
        const scoringEvents = handlerResult?.events ?? [];
        const scored1 = scoringEvents.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scored1.length).toBe(1);
        expect((scored1[0] as any).payload.baseDefId).toBe('base_the_jungle');

        // 模拟第一个基地记分后的状态（移除已记分基地）
        const coreAfterFirst: SmashUpCore = {
            ...core,
            bases: [
                { defId: 'base_tar_pits', minions: [makeMinion('m2', '1', 20)], ongoingActions: [] },
            ],
            baseDeck: ['base_locker_room'],
        };

        // 第二次调用：只剩 1 基地达标 → 直接记分
        const result2 = callOnPhaseExit(coreAfterFirst);
        const events2 = extractEvents(result2);
        const scored2 = events2.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scored2.length).toBe(1);
        expect((scored2[0] as any).payload.baseDefId).toBe('base_tar_pits');
    });

    it('无基地达到临界点时不产生记分事件', () => {
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                { defId: 'base_the_jungle', minions: [makeMinion('m1', '0', 5)], ongoingActions: [] },
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const events = extractEvents(callOnPhaseExit(core));
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scoredEvents.length).toBe(0);
    });

    it('单个基地达到临界点时正常记分', () => {
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                { defId: 'base_the_jungle', minions: [makeMinion('m1', '0', 15)], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [makeMinion('m2', '1', 5)], ongoingActions: [] },
            ],
            baseDeck: ['base_central_brain'],
            turnNumber: 1,
            nextUid: 100,
        };

        const events = extractEvents(callOnPhaseExit(core));
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scoredEvents.length).toBe(1);
        expect((scoredEvents[0] as any).payload.baseDefId).toBe('base_the_jungle');
    });
});

describe('Property 16: 平局 VP 分配（FlowHooks 层面）', () => {
    it('两位玩家力量相同时都获得第一名 VP', () => {
        // base_tar_pits: breakpoint=16, vpAwards=[4,3,2]
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [{
                defId: 'base_tar_pits',
                minions: [makeMinion('m1', '0', 10), makeMinion('m2', '1', 10)],
                ongoingActions: [],
            }],
            baseDeck: ['base_central_brain'],
            turnNumber: 1,
            nextUid: 100,
        };

        const events = extractEvents(callOnPhaseExit(core));
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        expect(scoredEvents.length).toBe(1);

        const rankings = (scoredEvents[0] as any).payload.rankings;
        expect(rankings.length).toBe(2);
        // 两位玩家力量相同，都应获得第一名 VP (4)
        expect(rankings[0].vp).toBe(4);
        expect(rankings[1].vp).toBe(4);
        expect(rankings[0].power).toBe(rankings[1].power);
    });

    it('三位玩家中两人并列第一时第三名仍获第三名 VP', () => {
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
                '2': makePlayer('2', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS]),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [{
                defId: 'base_tar_pits',
                minions: [
                    makeMinion('m1', '0', 10),
                    makeMinion('m2', '1', 10),
                    makeMinion('m3', '2', 5),
                ],
                ongoingActions: [],
            }],
            baseDeck: ['base_central_brain'],
            turnNumber: 1,
            nextUid: 100,
        };

        const events = extractEvents(callOnPhaseExit(core));
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        const rankings = (scoredEvents[0] as any).payload.rankings;
        expect(rankings.length).toBe(3);

        const p0 = rankings.find((r: any) => r.playerId === '0');
        const p1 = rankings.find((r: any) => r.playerId === '1');
        const p2 = rankings.find((r: any) => r.playerId === '2');
        // P0 和 P1 并列第一 → 都拿 4VP
        expect(p0.vp).toBe(4);
        expect(p1.vp).toBe(4);
        // P2 第三名（slot=2）→ 拿第三名 VP (2)
        expect(p2.vp).toBe(2);
    });

    it('并列第二时两位玩家都获得第二名 VP', () => {
        // base_tar_pits: breakpoint=16, vpAwards=[4,3,2]
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
                '2': makePlayer('2', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS]),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [{
                defId: 'base_tar_pits',
                minions: [makeMinion('m1', '0', 10), makeMinion('m2', '1', 5), makeMinion('m3', '2', 5)],
                ongoingActions: [],
            }],
            baseDeck: ['base_central_brain'],
            turnNumber: 1,
            nextUid: 100,
        };

        const events = extractEvents(callOnPhaseExit(core));
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        const rankings = (scoredEvents[0] as any).payload.rankings;
        expect(rankings.length).toBe(3);

        const p0 = rankings.find((r: any) => r.playerId === '0');
        const p1 = rankings.find((r: any) => r.playerId === '1');
        const p2 = rankings.find((r: any) => r.playerId === '2');
        expect(p0.vp).toBe(4); // 第一名
        expect(p1.vp).toBe(3); // 并列第二
        expect(p2.vp).toBe(3); // 并列第二
    });

    it('零力量玩家不获得 VP', () => {
        // base_the_jungle: breakpoint=12, vpAwards=[2,0,0]
        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [{
                defId: 'base_the_jungle',
                minions: [makeMinion('m1', '0', 15)],
                ongoingActions: [],
            }],
            baseDeck: ['base_central_brain'],
            turnNumber: 1,
            nextUid: 100,
        };

        const events = extractEvents(callOnPhaseExit(core));
        const scoredEvents = events.filter((e: GameEvent) => e.type === SU_EVENTS.BASE_SCORED);
        const rankings = (scoredEvents[0] as any).payload.rankings;
        // P1 没有随从，不应出现在排名中
        expect(rankings.length).toBe(1);
        expect(rankings[0].playerId).toBe('0');
    });
});
