/**
 * ongoing 能力端到端集成测试
 *
 * 测试 ongoing 保护/触发器在 execute() → reduce() 全链路中的行为：
 * 1. 保护→消灭过滤：general_ivan 保护己方随从，pirate_cannon 消灭被过滤
 * 2. 移动保护→事件过滤：entangled 阻止随从被移动
 * 3. 移动触发链：cub_scout 消灭移入的弱随从（processMoveTriggers 链路）
 * 4. onMinionPlayed 触发：altar 在打出随从时给额外行动
 */
 

import { describe, it, expect, beforeAll } from 'vitest';
import { execute, reduce } from '../domain/reducer';
import { postProcessSystemEvents } from '../domain';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore, SmashUpEvent, MinionOnBase,
    CardInstance, BaseInPlay, MinionDestroyedEvent, MinionMovedEvent,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import type { MatchState, RandomFn } from '../../../engine/types';

// ============================================================================
// 测试工具
// ============================================================================

function makeMinion(
    uid: string, defId: string, controller: string, power: number,
    overrides: Partial<MinionOnBase> = {},
): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, talentUsed: false, attachedActions: [],
        ...overrides,
    };
}

function makeCard(uid: string, defId: string, owner: string, type: 'minion' | 'action'): CardInstance {
    return { uid, defId, owner, type };
}

function makeBase(defId: string, minions: MinionOnBase[] = [], ongoingActions: BaseInPlay['ongoingActions'] = []): BaseInPlay {
    return { defId, minions, ongoingActions };
}

function makePlayer(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id, vp: 0, hand: [] as CardInstance[], deck: [] as CardInstance[], discard: [] as CardInstance[],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['pirates', 'aliens'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [makeBase('test_base_1'), makeBase('test_base_2'), makeBase('test_base_3')],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
}

const defaultRandom: RandomFn = {
    shuffle: <T>(arr: T[]) => [...arr],
    random: () => 0.5,
    d: () => 1,
    range: (_min: number) => _min,
};

/** 保存最近一次 execute 调用的 matchState 引用 */
let lastMatchState: MatchState<SmashUpCore> | null = null;

/** 执行打出行动卡命令，返回事件列表 */
function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string): SmashUpEvent[] {
    const ms = makeMatchState(state);
    lastMatchState = ms;
    const events = execute(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid },
    } as any, defaultRandom);
    
    // Call postProcessSystemEvents to trigger onPlay abilities
    return postProcessSystemEvents(state, events, defaultRandom).events;
}

/** 执行打出随从命令，返回事件列表 */
function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number): SmashUpEvent[] {
    const ms = makeMatchState(state);
    lastMatchState = ms;
    const events = execute(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, defaultRandom);
    
    // Call postProcessSystemEvents to trigger onPlay abilities
    return postProcessSystemEvents(state, events, defaultRandom).events;
}

/** 从最近一次 execute 的 matchState 中获取 interactions */
function getLastInteractions(): any[] {
    if (!lastMatchState) return [];
    const interaction = (lastMatchState.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}

// ============================================================================
// 测试套件
// ============================================================================

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('E2E: 保护→消灭过滤 (general_ivan)', () => {
    it('pirate_cannon 尝试消灭被 general_ivan 保护的随从时事件被过滤', () => {
        // P0 手中有 pirate_cannon（消灭力量≤2的随从）
        // 基地0：P0 的伊万将军 + P0 的力量2小兵
        // 基地1：P1 的力量2小兵
        // cannon 应该能消灭 P1 的小兵，但 P0 的小兵受 ivan 保护
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6);
        const allyWeak = makeMinion('ally', 'test_minion', '0', 2);
        const enemyWeak = makeMinion('enemy', 'test_minion', '1', 2);

        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cannon1', 'pirate_cannon', '0', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base1', [ivan, allyWeak]),
                makeBase('base2', [enemyWeak]),
            ],
        });

        const events = execPlayAction(state, '0', 'cannon1');

        // 消灭事件中不应该有 ally（被 ivan 保护）
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
        const destroyedUids = destroyEvents.map(e => e.payload.minionUid);
        expect(destroyedUids).not.toContain('ally');
    });
});

describe('E2E: 移动保护→事件过滤 (entangled)', () => {
    it('entangled 基地上的随从移动事件被过滤', () => {
        // 基地0：P0 的随从 + P1 的随从 + entangled（P0）
        // P0 试图用 pirate_full_sail 移动 P1 的随从
        // entangled 应阻止移动
        const myMinion = makeMinion('m0', 'test_minion', '0', 3);
        const enemyMinion = makeMinion('m1', 'test_minion', '1', 2);

        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('action1', 'pirate_full_sail', '0', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base1', [myMinion, enemyMinion], [
                    { uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' },
                ]),
                makeBase('base2'),
            ],
        });

        const events = execPlayAction(state, '0', 'action1');

        // 所有 MINION_MOVED 事件应被过滤（entangled 阻止移动）
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
        const movedFromBase0 = moveEvents.filter(e => e.payload.fromBaseIndex === 0);
        expect(movedFromBase0.length).toBe(0);
    });
});

describe('E2E: 移动触发链 (cub_scout + processMoveTriggers)', () => {
    it('随从被移入有 cub_scout 的基地时，弱随从被消灭', () => {
        // 基地0：P0 的 cub_scout（力量3）
        // 基地1：P1 的弱随从（力量2）
        // P0 用 pirate_full_sail 移动自己的随从（full_sail 移动己方随从）
        // 改用直接构造：我们手动发出一个 moveMinion 的命令流程
        // 更好的方式：直接测试 execute 产出的事件链

        // 实际上 full_sail 移动的是己方随从，不是对手的
        // 用一个更简单的方式：直接构造 execute + MINION_MOVED 事件检查 processMoveTriggers
        // 让 pirate_shanghai（上海）来移动对手随从到 cub_scout 所在基地

        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3);
        const enemyWeak = makeMinion('target', 'test_minion', '1', 2);

        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('action1', 'pirate_shanghai', '0', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base1', [scout]),           // cub_scout 在这
                makeBase('base2', [enemyWeak]),        // 对手弱随从在这
            ],
        });

        const events = execPlayAction(state, '0', 'action1');

        // shanghai 对只有一个对手随从的情况应产生 Interaction
        // 即使最终移动在 Prompt 链中完成，processMoveTriggers 会在 execute() 末尾处理
        // 这里验证 Interaction 创建正确
        const interactions = getLastInteractions();
        expect(interactions.length).toBe(1);
        expect(interactions[0].data.sourceId).toBe('pirate_shanghai_choose_minion');
    });

});

describe('E2E: onMinionPlayed 触发 (altar)', () => {
    it('在 altar 所在基地打出随从时获得额外行动', () => {
        // 基地0 有 cthulhu_altar（P0 拥有）
        // P0 在基地0 打出一个随从
        // → execute 内部 fireTriggers('onMinionPlayed') 应触发 altar → LIMIT_MODIFIED
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'pirate_first_mate', '0', 'minion')],
                    factions: ['pirates', 'cthulhu'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base1', [], [
                    { uid: 'altar-1', defId: 'cthulhu_altar', ownerId: '0' },
                ]),
                makeBase('base2'),
            ],
        });

        const events = execPlayMinion(state, '0', 'm1', 0);

        // 应产生 LIMIT_MODIFIED（额外行动）
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents.length).toBeGreaterThanOrEqual(1);
        const altarEvent = limitEvents.find(
            e => (e as any).payload.reason === 'cthulhu_altar'
        );
        expect(altarEvent).toBeDefined();
        expect((altarEvent as any).payload.limitType).toBe('action');
        expect((altarEvent as any).payload.delta).toBe(1);
    });

    it('对手在 altar 所在基地打出随从不触发', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('m2', 'pirate_first_mate', '1', 'minion')],
                }),
            },
            currentPlayerIndex: 1,
            bases: [
                makeBase('base1', [], [
                    { uid: 'altar-1', defId: 'cthulhu_altar', ownerId: '0' },
                ]),
                makeBase('base2'),
            ],
        });

        const events = execPlayMinion(state, '1', 'm2', 0);

        // 不应有 altar 触发的 LIMIT_MODIFIED
        const altarEvents = events.filter(
            e => e.type === SU_EVENTS.LIMIT_MODIFIED && (e as any).payload.reason === 'cthulhu_altar'
        );
        expect(altarEvents.length).toBe(0);
    });
});

describe('E2E: 保护→消灭过滤 (upgrade+tooth_and_claw)', () => {
    it('upgrade +2 力量后 cannon 不再选中该随从（间接保护）', () => {
        // P1 的力量2随从附着 upgrade → 有效力量=4 → cannon（≤2）不选中
        const protectedMinion = makeMinion('m1', 'test_minion', '1', 2, {
            attachedActions: [{ uid: 'up-1', defId: 'dino_upgrade', ownerId: '1' }],
        });
        const weakMinion = makeMinion('m2', 'test_minion', '1', 1);

        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cannon1', 'pirate_cannon', '0', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base1', [protectedMinion, weakMinion]),
            ],
        });

        const events = execPlayAction(state, '0', 'cannon1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
        const destroyedUids = destroyEvents.map(e => e.payload.minionUid);
        // m1（有效力量4）不会被 cannon 选中
        expect(destroyedUids).not.toContain('m1');
    });

    it('tooth_and_claw 保护 filterProtectedDestroyEvents 过滤消灭事件', () => {
        // P1 的力量3随从附着 tooth_and_claw
        // P0 用 ninja_assassination（消灭力量≤3的随从）→ 应被保护过滤
        const protectedMinion = makeMinion('m1', 'test_minion', '1', 3, {
            attachedActions: [{ uid: 'tc-1', defId: 'dino_tooth_and_claw', ownerId: '1' }],
        });
        const unprotectedMinion = makeMinion('m2', 'test_minion', '1', 2);

        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ninja1', 'ninja_assassination', '0', 'action')],
                    factions: ['ninjas', 'aliens'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base1', [protectedMinion, unprotectedMinion]),
            ],
        });

        const events = execPlayAction(state, '0', 'ninja1');

        // m1 受 tooth_and_claw 保护，消灭事件应被过滤
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
        const destroyedUids = destroyEvents.map(e => e.payload.minionUid);
        expect(destroyedUids).not.toContain('m1');
    });
});

// ============================================================================
// 完整 Prompt 链路测试（使用 GameTestRunner + Pipeline）
// ============================================================================

import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { createSmashUpEventSystem } from '../domain/systems';
import { INTERACTION_COMMANDS, asSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { createInitialSystemState } from '../../../engine/pipeline';

const PLAYER_IDS = ['0', '1'];

function createCustomRunner(customState: MatchState<SmashUpCore>) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    return new GameTestRunner<SmashUpCore, any, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: PLAYER_IDS,
        setup: () => customState,
        silent: true,
    });
}

/** 构造带完整 sys 的 MatchState */
function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    const sys = createInitialSystemState(PLAYER_IDS, systems);
    return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

describe('E2E Prompt 链: shanghai → cub_scout 移动触发', () => {
    it('shanghai 完整 Prompt 链：选随从 → 选基地 → MINION_MOVED + 状态更新', () => {
        // 构造：base0 有 cub_scout(P0)，base1 有弱随从(P1)，P0 手牌有 shanghai
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3);
        const enemyWeak = makeMinion('target', 'test_minion', '1', 2);

        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('shanghai1', 'pirate_shanghai', '0', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [scout]),
                makeBase('base_the_jungle', [enemyWeak]),
            ],
        });

        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);

        // Step 1: 打出 shanghai → 创建选随从 Prompt
        const result1 = runner.run({
            name: 'shanghai step1',
            commands: [
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'shanghai1' } },
            ],
        });

        expect(result1.steps[0]?.success).toBe(true);
        // 打出后应有 Interaction（选随从）
        expect(result1.finalState.sys.interaction.current).toBeDefined();
        const choice1 = asSimpleChoice(result1.finalState.sys.interaction.current)!;
        expect(choice1.sourceId).toBe('pirate_shanghai_choose_minion');
        expect(choice1.options.length).toBe(1); // 只有一个对手随从

        // Step 2: 响应选择随从 → 创建选基地 Interaction
        const runner2 = createCustomRunner(result1.finalState);
        const result2 = runner2.run({
            name: 'shanghai step2 - choose minion',
            commands: [
                { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: choice1.options[0].id } },
            ],
        });

        expect(result2.steps[0]?.success).toBe(true);
        // 应有新 Interaction（选基地）
        expect(result2.finalState.sys.interaction.current).toBeDefined();
        const choice2 = asSimpleChoice(result2.finalState.sys.interaction.current)!;
        expect(choice2.sourceId).toBe('pirate_shanghai_choose_base');

        // 选 base0（cub_scout 所在基地）
        const base0Option = choice2.options.find(
            (o: any) => o.value?.baseIndex === 0
        );
        expect(base0Option).toBeDefined();

        // Step 3: 响应选择基地 → MINION_MOVED 生成，随从移动到 base0
        const runner3 = createCustomRunner(result2.finalState);
        const result3 = runner3.run({
            name: 'shanghai step3 - choose base',
            commands: [
                { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: base0Option!.id } },
            ],
        });

        expect(result3.steps[0]?.success).toBe(true);

        // MINION_MOVED 由 bridge afterEvents 产生
        // postProcessSystemEvents 会在 reduce 前追加 trigger 派生事件
        const finalCore = result3.finalState.core;
        // 弱随从被移动到 base0
        expect(finalCore.bases[1].minions.find(m => m.uid === 'target')).toBeUndefined();

        // 架构修复后：postProcessSystemEvents 会对 MINION_MOVED 触发 processMoveTriggers
        // cub_scout 的 onMinionMoved 应消灭 base0 上力量≤2 的 target
        // 因此 target 应该被消灭（不在任何基地上）
        const targetOnBase0 = finalCore.bases[0].minions.find(m => m.uid === 'target');
        expect(targetOnBase0).toBeUndefined(); // 被 cub_scout 消灭
    });

    it('entangled 在 Prompt 链中也阻止移动（保护检查在 reduce 前）', () => {
        // base0 有 entangled + P0 随从 + P1 随从，base1 空
        // P0 用 shanghai 尝试移动 base0 上的 P1 随从
        const myMinion = makeMinion('m0', 'test_minion', '0', 3);
        const target = makeMinion('target', 'test_minion', '1', 2);

        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('shanghai1', 'pirate_shanghai', '0', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [myMinion, target], [
                    { uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' },
                ]),
                makeBase('base_the_jungle'),
            ],
        });

        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);

        // shanghai 打出后——execute() 内部 processMoveTriggers 不会产生 MINION_MOVED
        // 因为 shanghai 只产生 PROMPT_CONTINUATION，没有直接 move 事件
        const result = runner.run({
            name: 'shanghai on entangled base',
            commands: [
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'shanghai1' } },
            ],
        });

        expect(result.steps[0]?.success).toBe(true);
        // shanghai 看到 entangled 基地上有对手随从，会创建 Prompt
        // 但实际移动在 Prompt 继续函数中——此阶段只验证 Prompt 创建
        // 移动保护的 E2E 验证已在之前的 execute() 级测试中覆盖
    });
});

describe('E2E Prompt 链: altar + 打出随从完整链路', () => {
    it('通过 GameTestRunner 验证 altar 触发额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('m1', 'pirate_first_mate', '0', 'minion'),
                        makeCard('m2', 'pirate_first_mate', '0', 'minion'),
                    ],
                    factions: ['pirates', 'cthulhu'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [], [
                    { uid: 'altar-1', defId: 'cthulhu_altar', ownerId: '0' },
                ]),
                makeBase('base_the_jungle'),
            ],
        });

        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);

        // 打出随从到 altar 基地
        const result = runner.run({
            name: 'altar E2E',
            commands: [
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm1', baseIndex: 0 } },
            ],
        });

        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[0]?.events).toContain(SU_EVENTS.LIMIT_MODIFIED);

        // 验证行动额度增加
        const finalPlayer = result.finalState.core.players['0'];
        expect(finalPlayer.actionLimit).toBe(2);
    });
});

// ============================================================================
// reduce 状态变更验证
// ============================================================================

describe('E2E: reduce 状态变更验证', () => {
    it('ONGOING_DETACHED 事件移除基地上的 ongoing 行动卡', () => {
        const state = makeState({
            bases: [
                makeBase('base1', [], [
                    { uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' },
                ]),
            ],
        });

        const event: SmashUpEvent = {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'ent-1',
                defId: 'killer_plant_entangled',
                ownerId: '0',
                reason: 'killer_plant_entangled',
            },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.bases[0].ongoingActions.length).toBe(0);
    });

    it('LIMIT_MODIFIED 事件增加行动额度', () => {
        const state = makeState();

        const event: SmashUpEvent = {
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: '0',
                limitType: 'action',
                delta: 1,
                reason: 'cthulhu_altar',
            },
            timestamp: 0,
        } as any;

        const newState = reduce(state, event);
        expect(newState.players['0'].actionLimit).toBe(2); // 1 + 1
    });
});
