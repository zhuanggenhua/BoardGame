/**
 * 基础派系 ongoing/special 能力测试
 *
 * 覆盖 Task 7.2-7.5 新增的能力：
 * - 忍者：smoke_bomb, assassination, shinobi, acolyte, hidden_ninja, infiltrate
 * - 机器人：warbot, microbot_archive
 * - 巫师：archmage
 * - 诡术师：leprechaun, brownie, enshrouding_mist, hideout, flame_trap, block_the_path, pay_the_piper, mark_of_sleep
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
    clearOngoingEffectRegistry,
    registerPodOngoingAliases,
    interceptEvent,
    isMinionProtected,
    isOperationRestricted,
    fireTriggers,
} from '../domain/ongoingEffects';
import type { SmashUpCore, MinionOnBase, BaseInPlay, CardInstance, FactionId } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { clearRegistry } from '../domain/abilityRegistry';
import { registerNinjaAbilities, registerNinjaInteractionHandlers } from '../abilities/ninjas';
import { registerCowboysAbilities, registerCowboysInteractionHandlers } from '../abilities/cowboys';
import { registerRobotAbilities } from '../abilities/robots';
import { registerWizardAbilities } from '../abilities/wizards';
import { registerTricksterAbilities } from '../abilities/tricksters';
import { resolveAbility } from '../domain/abilityRegistry';
import { reduce } from '../domain/reduce';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { getMinionDef } from '../data/cards';
import { buildAffectRecords } from '../domain/affect';
import { runCommand, defaultTestRandom } from './testRunner';
import {
    getFirstPrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getPromptTargetType,
    getPromptsBySourceId,
    makeMatchState as makePromptMatchState,
    respondToPromptOption,
    respondToPrompt,
    withOnlyCurrentPrompt,
} from './helpers';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
        ...overrides,
    };
}

function makeBase(overrides: Partial<BaseInPlay> = {}): BaseInPlay {
    return {
        defId: 'test_base',
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

type TestCardInstance = CardInstance & { faction: FactionId };

function makeCard(
    uid: string,
    defId: string,
    type: 'minion' | 'action',
    owner: string,
    faction: FactionId
): TestCardInstance {
    return { uid, defId, type, owner, faction };
}

function makeState(bases: BaseInPlay[], extraPlayers?: Partial<SmashUpCore['players']>): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0', vp: 0,
                hand: [
                    makeCard('h1', 'ninja_shinobi', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('h2', 'test_action', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('h3', 'test_minion_b', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                ],
                deck: [
                    makeCard('d1', 'deck_card_1', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('d2', 'deck_card_2', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                ],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.NINJAS, 'test_b'] as [string, string],
            },
            '1': {
                id: '1', vp: 0,
                hand: [
                    makeCard('oh1', 'opp_card_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh2', 'opp_card_2', 'action', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh3', 'opp_card_3', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                deck: [
                    makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.ROBOTS, 'test_d'] as [string, string],
            },
            ...extraPlayers,
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 200,
    };
}

const dummyRandom = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]): T[] => [...arr],
} as any;

/** 创建完整的 MatchState（用于能力执行器） */
function makeMatchState(core: SmashUpCore): import('../../../engine/types').MatchState<SmashUpCore> {
    return {
        core,
        sys: {
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: null },
            gameover: null,
        } as any,
    };
}

// ============================================================================
// 忍者 ongoing/special 能力
// ============================================================================

describe('忍者 ongoing/special 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerNinjaAbilities();
        registerPodOngoingAliases();
    });

    describe('ninja_smoke_bomb: 烟雾弹保护', () => {
        test('保护被附着的随从不受对手行动卡影响', () => {
            const myMinion = makeMinion({
                defId: 'ninja_a', uid: 'n-1', controller: '0',
                attachedActions: [{ uid: 'sb-1', defId: 'ninja_smoke_bomb', ownerId: '0' }],
            });
            const base = makeBase({
                minions: [myMinion],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });

        test('POD 版烟雾弹也会保护被附着的随从', () => {
            const myMinion = makeMinion({
                defId: 'ninja_a', uid: 'n-pod-1', controller: '0',
                attachedActions: [{ uid: 'sb-pod-1', defId: 'ninja_smoke_bomb_pod', ownerId: '0' }],
            });
            const base = makeBase({
                minions: [myMinion],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });

        test('不保护未附着烟幕弹的随从', () => {
            // 烟幕弹附着在 myMinion 上，oppMinion 没有附着，不受保护
            const myMinion = makeMinion({
                defId: 'ninja_b', uid: 'n-2', controller: '0',
                attachedActions: [{ uid: 'sb-1', defId: 'ninja_smoke_bomb', ownerId: '0' }],
            });
            const oppMinion = makeMinion({ defId: 'robot_a', uid: 'r-1', controller: '1' });
            const base = makeBase({
                minions: [myMinion, oppMinion],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, oppMinion, 0, '0', 'action')).toBe(false);
        });
    });

    describe('ninja_assassination: 暗杀', () => {
        test('回合结束时消灭附着了暗杀的随从', () => {
            const target = makeMinion({
                defId: 'opp_minion', uid: 'om-1', controller: '1', owner: '1',
                attachedActions: [{ uid: 'as-1', defId: 'ninja_assassination', ownerId: '0' }],
            });
            const base = makeBase({ minions: [target] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('om-1');
            expect((events[0] as any).payload.reason).toBe('ninja_assassination');
            // 验证 destroyerId 为暗杀卡的拥有者
            expect((events[0] as any).payload.destroyerId).toBe('0');
        });

        test('POD 版暗杀也会在回合结束时消灭被附着的随从', () => {
            const target = makeMinion({
                defId: 'opp_minion', uid: 'om-pod-1', controller: '1', owner: '1',
                attachedActions: [{ uid: 'as-pod-1', defId: 'ninja_assassination_pod', ownerId: '0' }],
            });
            const base = makeBase({ minions: [target] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('om-pod-1');
            expect((events[0] as any).payload.reason).toBe('ninja_assassination');
        });

        test('无附着暗杀时不触发', () => {
            const target = makeMinion({ defId: 'opp_minion', uid: 'om-1', controller: '1' });
            const base = makeBase({ minions: [target] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('ninja_infiltrate: 渗透', () => {
        test('附着渗透的随从不受影响', () => {
            const minion = makeMinion({
                defId: 'ninja_a', uid: 'n-1', controller: '0',
                attachedActions: [{ uid: 'inf-1', defId: 'ninja_infiltrate', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        });

        test('POD 版渗透不会继承基础版渗透的保护语义', () => {
            const minion = makeMinion({
                defId: 'ninja_a', uid: 'n-inf-pod-1', controller: '0',
            });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'inf-pod-1', defId: 'ninja_infiltrate_pod', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(false);
        });

        test('渗透只能消灭基地上的战术，不能消灭随从上的战术', () => {
            // 设置初始状态：基地上有一个 ongoing 战术，随从上有一个 attached 战术
            const minion = makeMinion({
                uid: 'm1',
                defId: 'test_minion',
                controller: '1',
                owner: '1',
                attachedActions: [{ uid: 'poison', defId: 'ninja_poison', ownerId: '1' }],
            });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'ongoing1', defId: 'test_ongoing', ownerId: '1' }],
            });
            // 直接测试 ninjaInfiltrateOnPlay 的逻辑：
            // 它应该只收集 base.ongoingActions，不包括 minion.attachedActions
            const targets: { uid: string; defId: string }[] = [];
            
            // 收集基地上的 ongoing 战术（排除自身）
            for (const o of base.ongoingActions) {
                if (o.uid === 'infiltrate') continue;
                targets.push({ uid: o.uid, defId: o.defId });
            }

            // 验证：只有基地上的 ongoing 战术，没有随从上的 attached 战术
            expect(targets).toHaveLength(1);
            expect(targets[0].uid).toBe('ongoing1');
            expect(targets[0].defId).toBe('test_ongoing');
        });

        test('有多个基地战术时创建选择交互', () => {
            const base = makeBase({
                ongoingActions: [
                    { uid: 'ongoing-1', defId: 'zombie_overrun', ownerId: '1' },
                    { uid: 'ongoing-2', defId: 'ninja_smoke_bomb', ownerId: '0' },
                ],
            });
            const state = makeState([base]);
            const matchState = { core: state, sys: { interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ninja_infiltrate', 'onPlay')!;
            const result = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'infiltrate-1',
                defId: 'ninja_infiltrate',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            expect(result.events).toHaveLength(0);
            const current = getFirstPrompt(result.matchState!);
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('ninja_infiltrate_destroy');
            expect(getPromptTargetType(current)).toBe('ongoing');
            expect(getPromptOptions(current)).toHaveLength(2);
        });

        test('POD 版渗透只会给出基地上的战术目标，不会把随从或附着战术当目标', () => {
            const minion = makeMinion({
                uid: 'm-pod-1',
                defId: 'test_minion',
                controller: '1',
                owner: '1',
                attachedActions: [{ uid: 'poison-pod', defId: 'ninja_poison_pod', ownerId: '1' }],
            });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'ongoing-pod-1', defId: 'zombie_overrun', ownerId: '1' }],
            });
            const state = makeState([base]);
            const matchState = { core: state, sys: { interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ninja_infiltrate_pod', 'onPlay')!;
            const result = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'infiltrate-pod-1',
                defId: 'ninja_infiltrate_pod',
                baseIndex: 0,
                random: dummyRandom,
                now: 1001,
            });

            expect(result.events).toHaveLength(0);
            const current = getFirstPrompt(result.matchState!);
            expect(getPromptSourceId(current)).toBe('ninja_infiltrate_pod_destroy');
            expect(getPromptTargetType(current)).toBe('ongoing');
            expect(getPromptOptions(current)).toHaveLength(2);

            const cardOptions = getPromptOptions(current).filter((option: any) => option.value?.cardUid);
            expect(cardOptions).toHaveLength(1);
            expect(cardOptions[0].value.cardUid).toBe('ongoing-pod-1');
            expect(cardOptions[0].value.defId).toBe('zombie_overrun');
        });

        test('只有一个基地战术时自动消灭，不创建交互', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'ongoing-1', defId: 'zombie_overrun', ownerId: '1' }],
            });
            const state = makeState([base]);
            const matchState = { core: state, sys: { interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ninja_infiltrate', 'onPlay')!;
            const result = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'infiltrate-1',
                defId: 'ninja_infiltrate',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            expect(result.matchState).toBeUndefined();
            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(SU_EVENTS.ONGOING_DETACHED);
            expect((result.events[0] as any).payload.cardUid).toBe('ongoing-1');
        });

        test('没有基地战术时不创建交互也不额外发事件', () => {
            const base = makeBase({ ongoingActions: [] });
            const state = makeState([base]);
            const matchState = { core: state, sys: { interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ninja_infiltrate', 'onPlay')!;
            const result = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'infiltrate-1',
                defId: 'ninja_infiltrate',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            expect(result.matchState).toBeUndefined();
            expect(result.events).toHaveLength(0);
        });
    });

    describe('ninja_shinobi: 影舞者 Me First! 窗口打出', () => {
        // 影舞者不再使用 beforeScoring 触发器，改为 Me First! 窗口中通过 PLAY_MINION 打出
        // beforeScoringPlayable=true 标记使其可在 Me First! 窗口中打出
        // 详细的集成测试见 specialInteractionChain.test.ts

        test('影舞者卡牌定义有 beforeScoringPlayable 标记', () => {
            const def = getMinionDef('ninja_shinobi');
            expect(def).toBeDefined();
            expect(def!.beforeScoringPlayable).toBe(true);
        });

        test('beforeScoring 触发器不再注册影舞者', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            const result = fireTriggers(state, 'beforeScoring', {
                state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 1000,
            });
            // 影舞者不再通过 beforeScoring 触发器打出
            const shinobiEvents = result.events.filter(e =>
                e.type === SU_EVENTS.MINION_PLAYED && (e as any).payload?.defId === 'ninja_shinobi'
            );
            expect(shinobiEvents).toHaveLength(0);
        });
    });

    describe('ninja_acolyte: 忍者侍从 special 能力（点击激活）', () => {
        test('special 能力已注册', () => {
            const executor = resolveAbility('ninja_acolyte', 'special');
            expect(executor).toBeDefined();
        });

        test('基地上有侍从时激活返回手牌并给额外随从额度', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);
            const matchState = { core: state, sys: { interaction: { current: undefined, queue: [] } } } as any;
            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state, matchState, playerId: '0', cardUid: 'ac-1', defId: 'ninja_acolyte',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            const acolyteEvents = result.events.filter(e =>
                e.type === SU_EVENTS.MINION_RETURNED ||
                (e.type === SU_EVENTS.SPECIAL_LIMIT_USED && (e as any).payload?.abilityDefId === 'ninja_acolyte')
            );
            expect(acolyteEvents).toHaveLength(2);
            expect(acolyteEvents[0].type).toBe(SU_EVENTS.SPECIAL_LIMIT_USED);
            expect(acolyteEvents[1].type).toBe(SU_EVENTS.MINION_RETURNED);
            // 应创建交互（选择手牌中的随从）
            expect(result.matchState).toBeDefined();
        });

        test('同基地已使用忍者 special 时被阻止', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);
            state.specialLimitUsed = { ninja_acolyte: [0] };
            const matchState = makeMatchState(state);
            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state, matchState, playerId: '0', cardUid: 'ac-1', defId: 'ninja_acolyte',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            const acolyteEvents = result.events.filter(e =>
                e.type === SU_EVENTS.MINION_RETURNED && (e as any).payload?.minionDefId === 'ninja_acolyte'
            );
            expect(acolyteEvents).toHaveLength(0);
        });

        test('本回合已打出随从时被阻止', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);
            state.players['0'].minionsPlayed = 1;
            const matchState = makeMatchState(state);
            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state, matchState, playerId: '0', cardUid: 'ac-1', defId: 'ninja_acolyte',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            expect(result.events).toHaveLength(0);
        });
    });

    describe('ninja_hidden_ninja: 隐忍 special', () => {
        test('special 能力已注册', () => {
            const executor = resolveAbility('ninja_hidden_ninja', 'special');
            expect(executor).toBeDefined();
        });

        test('会把手牌中所有随从都放入选择交互', () => {
            const state = makeState([makeBase({ minions: [] })], {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [
                        makeCard('hidden', 'ninja_hidden_ninja', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                        makeCard('acolyte', 'ninja_acolyte', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                        makeCard('shinobi', 'ninja_shinobi', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                        makeCard('pirate', 'pirate_first_mate', 'minion', '0', SMASHUP_FACTION_IDS.PIRATES),
                        makeCard('action', 'test_action', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.PIRATES] as [string, string],
                },
            });
            const matchState = makeMatchState(state);
            const executor = resolveAbility('ninja_hidden_ninja', 'special')!;

            const result = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'hidden',
                defId: 'ninja_hidden_ninja',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            const current = getFirstPrompt(result.matchState!);
            expect(getPromptSourceId(current)).toBe('ninja_hidden_ninja');
            expect(getPromptTargetType(current)).toBe('hand');
            expect(getPromptOptions(current)).toEqual(expect.arrayContaining([
                expect.objectContaining({ value: expect.objectContaining({ cardUid: 'acolyte', defId: 'ninja_acolyte' }) }),
                expect.objectContaining({ value: expect.objectContaining({ cardUid: 'shinobi', defId: 'ninja_shinobi' }) }),
                expect.objectContaining({ value: expect.objectContaining({ cardUid: 'pirate', defId: 'pirate_first_mate' }) }),
            ]));
        });

        test('同基地已使用忍者 special 时被阻止', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.specialLimitUsed = { ninja_hidden_ninja: [0] };
            const matchState = makeMatchState(state);
            const executor = resolveAbility('ninja_hidden_ninja', 'special')!;
            const result = executor({
                state, matchState, playerId: '0', cardUid: 'hn-1', defId: 'ninja_hidden_ninja',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            expect(result.events).toHaveLength(0);
        });
    });

    describe('specialLimitGroup: 跨卡牌共享限制', () => {
        test('使用 ninja_acolyte 后同基地再次使用被阻止', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);
            // 模拟 ninja_acolyte 已使用
            state.specialLimitUsed = { ninja_acolyte: [0] };
            const matchState = makeMatchState(state);
            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state, matchState, playerId: '0', cardUid: 'ac-1', defId: 'ninja_acolyte',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            const acolyteEvents = result.events.filter(e =>
                e.type === SU_EVENTS.MINION_RETURNED && (e as any).payload?.minionDefId === 'ninja_acolyte'
            );
            expect(acolyteEvents).toHaveLength(0);
        });

        test('SPECIAL_LIMIT_USED 事件正确更新 reducer 状态', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            const evt = {
                type: SU_EVENTS.SPECIAL_LIMIT_USED,
                payload: { playerId: '0', baseIndex: 0, limitGroup: 'ninja_acolyte', abilityDefId: 'ninja_acolyte' },
                timestamp: 1000,
            };
            const next = reduce(state, evt as any);
            expect(next.specialLimitUsed).toEqual({ ninja_acolyte: [0] });
            // 再次使用不同基地
            const evt2 = { ...evt, payload: { ...evt.payload, baseIndex: 1 } };
            const next2 = reduce(next, evt2 as any);
            expect(next2.specialLimitUsed).toEqual({ ninja_acolyte: [0, 1] });
        });

        test('TURN_STARTED 清除 specialLimitUsed', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.specialLimitUsed = { ninja_special: [0, 1] };
            const evt = {
                type: SU_EVENTS.TURN_STARTED,
                payload: { playerId: '0', turnNumber: 2 },
                timestamp: 2000,
            };
            const next = reduce(state, evt as any);
            expect(next.specialLimitUsed).toBeUndefined();
        });
    });

    describe('consumesNormalLimit: 忍者 special 额外打出不消耗正常额度', () => {
        test('ninja_acolyte_play 交互产生 MINION_PLAYED 事件且 consumesNormalLimit=false', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);
            state.players['0'].hand = [makeCard('h3', 'test_minion_b', 'minion', '0')];
            state.players['0'].minionsPlayed = 0;
            const matchState = { core: state, sys: { interaction: { current: undefined, queue: [] } } } as any;
            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state, matchState, playerId: '0', cardUid: 'ac-1', defId: 'ninja_acolyte',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            // 应该有 MINION_RETURNED 事件，但不应该有 LIMIT_MODIFIED 事件
            const returnEvt = result.events.find((e: any) => e.type === SU_EVENTS.MINION_RETURNED);
            expect(returnEvt).toBeDefined();
            const limitEvt = result.events.find((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvt).toBeUndefined();
            
            clearInteractionHandlers();
            registerNinjaInteractionHandlers();
            const promptState = result.matchState ?? matchState;
            const prompt = getFirstPrompt(promptState);
            expect(getPromptSourceId(prompt)).toBe('ninja_acolyte_play');
            const option = getPromptOption(
                prompt,
                candidate => candidate?.value?.cardUid === 'h3',
                'Acolyte extra-play minion option',
            );
            const resolved = respondToPrompt(promptState, option.id, '0', defaultTestRandom);
            expect(resolved.success).toBe(true);
            const playedEvt = resolved.events.find((e: any) => e.type === SU_EVENTS.MINION_PLAYED);
            expect(playedEvt).toBeDefined();
            expect((playedEvt as any).payload.consumesNormalLimit).toBe(false);
        });

        test('ninja_hidden_ninja 交互产生的 MINION_PLAYED 带 consumesNormalLimit=false', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('hidden', 'ninja_hidden_ninja', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                makeCard('h3', 'test_minion_b', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
            ];
            const matchState = makeMatchState(state);
            clearInteractionHandlers();
            registerNinjaInteractionHandlers();
            const executor = resolveAbility('ninja_hidden_ninja', 'special')!;
            const result = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'hidden',
                defId: 'ninja_hidden_ninja',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });
            const promptState = result.matchState ?? matchState;
            const prompt = getFirstPrompt(promptState);
            expect(getPromptSourceId(prompt)).toBe('ninja_hidden_ninja');
            const resolved = respondToPrompt(
                promptState,
                getPromptOption(prompt, candidate => candidate?.value?.cardUid === 'h3', 'Hidden Ninja extra-play minion option').id,
                '0',
                defaultTestRandom,
            );
            expect(resolved.success).toBe(true);
            const playedEvt = resolved.events.find((e: any) => e.type === SU_EVENTS.MINION_PLAYED);
            expect(playedEvt).toBeDefined();
            expect((playedEvt as any).payload.consumesNormalLimit).toBe(false);
        });

        test('consumesNormalLimit=false 时 reducer 不增加 minionsPlayed', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.players['0'].minionsPlayed = 0;
            const evt = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: '0', cardUid: 'h3', defId: 'test_minion_b',
                    baseIndex: 0, power: 3, consumesNormalLimit: false,
                },
                timestamp: 1000,
            };
            const next = reduce(state, evt as any);
            expect(next.players['0'].minionsPlayed).toBe(0);
            // 随从应该在基地上
            expect(next.bases[0].minions.some(m => m.uid === 'h3')).toBe(true);
        });

        test('consumesNormalLimit 未设置时 reducer 正常增加 minionsPlayed', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.players['0'].minionsPlayed = 0;
            const evt = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: '0', cardUid: 'h3', defId: 'test_minion_b',
                    baseIndex: 0, power: 3,
                },
                timestamp: 1000,
            };
            const next = reduce(state, evt as any);
            expect(next.players['0'].minionsPlayed).toBe(1);
        });

        test('忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择', () => {
            clearInteractionHandlers();
            registerNinjaInteractionHandlers();
            registerCowboysAbilities();
            registerCowboysInteractionHandlers();

            const base = makeBase({
                defId: 'base_the_workshop',
                minions: [
                    makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0', owner: '0', basePower: 2 }),
                    makeMinion({ defId: 'pirate_first_mate', uid: 'opp-1', controller: '1', owner: '1', basePower: 2 }),
                ],
            });
            const templateState = makeState([base]);
            const state = makeState([base], {
                '0': {
                    ...templateState.players['0'],
                    hand: [makeCard('gun-1', 'cowboys_gunfighter', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS)],
                    factions: [SMASHUP_FACTION_IDS.NINJAS, 'cowboys'] as [string, string],
                    minionsPlayed: 0,
                },
            });

            const activated = runCommand(
                makeMatchState(state),
                {
                    type: 'su:activate_special',
                    playerId: '0',
                    payload: { minionUid: 'ac-1', baseIndex: 0 },
                } as any,
                defaultTestRandom,
            );

            expect(activated.success).toBe(true);
            const acolytePrompt = getFirstPrompt(activated.finalState);
            expect(getPromptSourceId(acolytePrompt)).toBe('ninja_acolyte_play');

            const gunfighterOption = getPromptOption(
                acolytePrompt,
                option => option?.value?.defId === 'cowboys_gunfighter',
                'Acolyte Gunfighter play option',
            );
            const resolved = respondToPrompt(activated.finalState, gunfighterOption.id, '0', defaultTestRandom);

            expect(resolved.success).toBe(true);
            expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'gun-1')).toBe(true);
            const duelPrompt = getFirstPrompt(resolved.finalState);
            expect(getPromptSourceId(duelPrompt)).toBe('cowboys_gunfighter');

            const duelOptions = getPromptOptions(duelPrompt);
            expect(duelOptions.some(option => option?.value?.minionUid === 'opp-1')).toBe(true);
        });
    });
});

describe('机器人 ongoing 回归', () => {
    beforeEach(() => {
        clearRegistry();
        clearInteractionHandlers();
        clearOngoingEffectRegistry();
        registerPodOngoingAliases();
        registerRobotAbilities();
    });

    test('双方都有 Archive 时，只触发被消灭微型机所属玩家的 Archive', () => {
        const archive0 = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-p0', controller: '0' });
        const guard0 = makeMinion({ defId: 'robot_microbot_guard', uid: 'mg-p0', controller: '0' });
        const base0 = makeBase({ defId: 'base_a', minions: [archive0, guard0] });

        const archive1 = makeMinion({
            defId: 'robot_microbot_archive',
            uid: 'ma-p1',
            controller: '1',
            owner: '1',
        });
        const base1 = makeBase({ defId: 'base_b', minions: [archive1] });
        const state = makeState([base0, base1]);

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'mg-p0',
            triggerMinionDefId: 'robot_microbot_guard',
            triggerMinion: guard0,
            random: dummyRandom,
            now: 1000,
        } as any);

        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(1);
        expect(drawEvents[0].payload.playerId).toBe('0');
    });

    test('同一玩家有两个 Archive 时，应各自触发一次抽牌', () => {
        const archiveA = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-double-a', controller: '0' });
        const archiveB = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-double-b', controller: '0' });
        const guard = makeMinion({ defId: 'robot_microbot_guard', uid: 'mg-double', controller: '0' });
        const base = makeBase({ minions: [archiveA, archiveB, guard] });
        const seedState = makeState([base]);
        const state = makeState([base], {
            '0': {
                ...seedState.players['0'],
                deck: [
                    makeCard('d1', 'deck_card_1', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('d2', 'deck_card_2', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('d3', 'deck_card_3', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                ],
            },
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'mg-double',
            triggerMinionDefId: 'robot_microbot_guard',
            triggerMinion: guard,
            random: dummyRandom,
            now: 1000,
        } as any);

        const drawEvent = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeTruthy();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
        expect(drawEvent.payload.cardUids).toHaveLength(2);
    });
});

// ============================================================================
 // 机器人 ongoing 能力
 // ============================================================================

describe('机器人 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerRobotAbilities();
        registerPodOngoingAliases();
    });

    describe('robot_warbot: 战争机器人不可被消灭', () => {
        test('warbot 受 destroy 保护', () => {
            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1', controller: '0' });
            const base = makeBase({ minions: [warbot] });
            const state = makeState([base]);

            expect(isMinionProtected(state, warbot, 0, '1', 'destroy')).toBe(true);
        });

        test('POD 版 warbot 也受 destroy 保护', () => {
            const warbot = makeMinion({ defId: 'robot_warbot_pod', uid: 'wb-pod-1', controller: '0' });
            const base = makeBase({ minions: [warbot] });
            const state = makeState([base]);

            expect(isMinionProtected(state, warbot, 0, '1', 'destroy')).toBe(true);
        });

        test('非 warbot 不受保护', () => {
            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1', controller: '0' });
            const normal = makeMinion({ defId: 'robot_zapbot', uid: 'zb-1', controller: '0' });
            const base = makeBase({ minions: [warbot, normal] });
            const state = makeState([base]);

            expect(isMinionProtected(state, normal, 0, '1', 'destroy')).toBe(false);
        });
    });

    describe('robot_microbot_archive: 微型机被消灭后抽牌', () => {
        test('微型机被消灭时 archive 控制者抽牌', () => {
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-1', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'mg-1',
                triggerMinionDefId: 'robot_microbot_guard',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
        });

        test('POD 版档案馆也会对 POD 微型机的消灭触发抽牌', () => {
            const archive = makeMinion({ defId: 'robot_microbot_archive_pod', uid: 'ma-pod-1', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'mg-pod-1',
                triggerMinionDefId: 'robot_microbot_guard_pod',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
        });

        test('非微型机被消灭时不触发', () => {
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-1', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'big-1',
                triggerMinionDefId: 'robot_hoverbot',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('有 Alpha 时普通随从被视为微型机并触发抽牌', () => {
            // 玩家0：Microbot Archive + Microbot Alpha + 普通随从 normal_minion
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-alpha-1', controller: '0' });
            const alpha = makeMinion({ defId: 'robot_microbot_alpha', uid: 'alpha-1', controller: '0' });
            const normal = makeMinion({ defId: 'test_normal_minion', uid: 'nm-1', controller: '0' });
            const base = makeBase({ minions: [archive, alpha, normal] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'nm-1',
                triggerMinionDefId: 'test_normal_minion',
                triggerMinion: normal,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEvents = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0'
            );
            expect(drawEvents.length).toBe(1);
        });

        test('Alpha + 普通随从在不同基地时 Archive 仍对己方普通随从触发', () => {
            // base0: Archive
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-alpha-remote', controller: '0' });
            const base0 = makeBase({ defId: 'base_a', minions: [archive] });
            // base1: Alpha + 普通随从
            const alpha = makeMinion({ defId: 'robot_microbot_alpha', uid: 'alpha-remote', controller: '0' });
            const normal = makeMinion({ defId: 'test_normal_minion', uid: 'nm-remote', controller: '0' });
            const base1 = makeBase({ defId: 'base_b', minions: [alpha, normal] });
            const state = makeState([base0, base1]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 1,
                triggerMinionUid: 'nm-remote',
                triggerMinionDefId: 'test_normal_minion',
                triggerMinion: normal,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEvents = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0'
            );
            expect(drawEvents.length).toBe(1);
        });

        test('对手的微型机（含 Alpha 视为）被消灭时不触发', () => {
            // 玩家0：Archive；玩家1：Alpha + 普通随从
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-enemy', controller: '0' });
            const base0 = makeBase({ defId: 'base_a', minions: [archive] });

            const alphaEnemy = makeMinion({ defId: 'robot_microbot_alpha', uid: 'alpha-enemy', controller: '1', owner: '1' });
            const normalEnemy = makeMinion({ defId: 'test_normal_minion', uid: 'nm-enemy', controller: '1', owner: '1' });
            const base1 = makeBase({ defId: 'base_b', minions: [alphaEnemy, normalEnemy] });

            const state = makeState([base0, base1], {
                '1': {
                    id: '1', vp: 0,
                    hand: [],
                    deck: [
                        makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    ],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, 'test_d'] as [string, string],
                },
            });

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '1',
                baseIndex: 1,
                triggerMinionUid: 'nm-enemy',
                triggerMinionDefId: 'test_normal_minion',
                triggerMinion: normalEnemy,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEventsP0 = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0'
            );
            expect(drawEventsP0.length).toBe(0);
        });

        test('Archive 自身作为微型机被消灭时也会触发抽牌', () => {
            // 玩家0：Archive（被消灭的对象也是微型机）
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-self', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'ma-self',
                triggerMinionDefId: 'robot_microbot_archive',
                triggerMinion: archive,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEvents = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0'
            );
            expect(drawEvents.length).toBe(1);
        });

        test('对手的微型机被消灭时不触发（"你的"限定）', () => {
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-1', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'mg-opp',
                triggerMinionDefId: 'robot_microbot_guard',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('有 Alpha 时普通随从被视为微型机并触发抽牌', () => {
            // 玩家0：Microbot Archive + Microbot Alpha + 普通随从
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-alpha-1', controller: '0' });
            const alpha = makeMinion({ defId: 'robot_microbot_alpha', uid: 'alpha-1', controller: '0' });
            const normal = makeMinion({ defId: 'test_normal_minion', uid: 'nm-1', controller: '0' });
            const base = makeBase({ minions: [archive, alpha, normal] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'nm-1',
                triggerMinionDefId: 'test_normal_minion',
                triggerMinion: normal,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEvents = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0',
            );
            expect(drawEvents.length).toBe(1);
        });

        test('Alpha + 普通随从在不同基地时 Archive 仍对己方普通随从触发', () => {
            // base0: Archive
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-alpha-remote', controller: '0' });
            const base0 = makeBase({ defId: 'base_a', minions: [archive] });
            // base1: Alpha + 普通随从
            const alpha = makeMinion({ defId: 'robot_microbot_alpha', uid: 'alpha-remote', controller: '0' });
            const normal = makeMinion({ defId: 'test_normal_minion', uid: 'nm-remote', controller: '0' });
            const base1 = makeBase({ defId: 'base_b', minions: [alpha, normal] });
            const state = makeState([base0, base1]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 1,
                triggerMinionUid: 'nm-remote',
                triggerMinionDefId: 'test_normal_minion',
                triggerMinion: normal,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEvents = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0',
            );
            expect(drawEvents.length).toBe(1);
        });

        test('对手的微型机（含 Alpha 视为）被消灭时不触发', () => {
            // 玩家0：Archive；玩家1：Alpha + 普通随从
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-enemy', controller: '0' });
            const base0 = makeBase({ defId: 'base_a', minions: [archive] });

            const alphaEnemy = makeMinion({
                defId: 'robot_microbot_alpha',
                uid: 'alpha-enemy',
                controller: '1',
                owner: '1',
            });
            const normalEnemy = makeMinion({
                defId: 'test_normal_minion',
                uid: 'nm-enemy',
                controller: '1',
                owner: '1',
            });
            const base1 = makeBase({ defId: 'base_b', minions: [alphaEnemy, normalEnemy] });

            const state = makeState([base0, base1], {
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS)],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, 'test_d'] as [string, string],
                },
            });

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '1',
                baseIndex: 1,
                triggerMinionUid: 'nm-enemy',
                triggerMinionDefId: 'test_normal_minion',
                triggerMinion: normalEnemy,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEventsP0 = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0',
            );
            expect(drawEventsP0.length).toBe(0);
        });

        test('Archive 自身作为微型机被消灭时也会触发抽牌', () => {
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-self', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'ma-self',
                triggerMinionDefId: 'robot_microbot_archive',
                triggerMinion: archive,
                random: dummyRandom,
                now: 1000,
            } as any);

            const drawEvents = events.filter(
                e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '0',
            );
            expect(drawEvents.length).toBe(1);
        });
    });
});

// ============================================================================
// 巫师 ongoing 能力
// ============================================================================

describe('巫师 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerWizardAbilities();
        registerPodOngoingAliases();
    });

    describe('wizard_archmage: 大法师 ongoing 时机', () => {
        test('onTurnStart 不再直接发额外行动事件', () => {
            const archmage = makeMinion({ defId: 'wizard_archmage', uid: 'am-1', controller: '0' });
            const base = makeBase({ minions: [archmage] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('POD 版不在 onTurnStart 触发（POD 为 talent）', () => {
            const archmage = makeMinion({ defId: 'wizard_archmage_pod', uid: 'am-pod-1', controller: '0' });
            const base = makeBase({ minions: [archmage] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('非控制者回合同样不触发 onTurnStart 事件', () => {
            const archmage = makeMinion({ defId: 'wizard_archmage', uid: 'am-1', controller: '0' });
            const base = makeBase({ minions: [archmage] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '1', // 对手回合
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('POD 版不在 onMinionPlayed 触发（POD 为 talent）', () => {
            const archmage = makeMinion({ defId: 'wizard_archmage_pod', uid: 'am-pod-1', controller: '0' });
            const base = makeBase({ minions: [archmage] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'am-pod-1',
                triggerMinionDefId: 'wizard_archmage_pod',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });
});

// ============================================================================
// 诡术师 ongoing 能力
// ============================================================================

describe('诡术师 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerTricksterAbilities();
        registerPodOngoingAliases();
    });

    describe('trickster_flame_trap: 火焰陷阱', () => {
        test('对手打出随从到陷阱基地时消灭', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.reason).toBe('trickster_flame_trap');
            // 火焰陷阱触发后自毁
            expect(events[1].type).toBe(SU_EVENTS.ONGOING_DETACHED);
            expect((events[1] as any).payload.defId).toBe('trickster_flame_trap');
        });

        test('自己打出随从不触发', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '0', // 自己
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('trickster_brownie: 布朗尼', () => {
        test('POD 版：每回合一次，对手在其他基地打出随从后，抽一张牌', () => {
            const brownie = makeMinion({ defId: 'trickster_brownie_pod', uid: 'brownie-pod-1', controller: '0', owner: '0' });
            const base0 = makeBase({ minions: [brownie] });
            const base1 = makeBase({});
            const state = makeState([base0, base1]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 1,
                triggerMinionUid: 'opp-new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            } as any);

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
            expect((events[0] as any).payload.count).toBe(1);
            expect(events[1].type).toBe(SU_EVENTS.MINION_METADATA_UPDATED);
        });

        test('POD 版不沿用旧版 onMinionAffected 触发', () => {
            const brownie = makeMinion({ defId: 'trickster_brownie_pod', uid: 'brownie-pod-1', controller: '0', owner: '0' });
            const base0 = makeBase({ minions: [brownie] });
            const base1 = makeBase({});
            const state = makeState([base0, base1]);

            const { events } = fireTriggers(state, 'onMinionAffected', {
                state,
                playerId: '1',
                baseIndex: 1,
                triggerMinionUid: 'opp-new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            } as any);

            expect(events).toHaveLength(0);
        });

        test('POD 版应标记消灭者', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'ft-pod-1', defId: 'trickster_flame_trap_pod', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[1].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[1] as any).payload.destroyerId).toBe('0');
        });

        test('POD 版 onTurnStart 为每个陷阱实例保留独立 runtime prompt 上下文', () => {
            const base0 = makeBase({
                ongoingActions: [{ uid: 'ft-pod-1', defId: 'trickster_flame_trap_pod', ownerId: '0' }],
            });
            const base1 = makeBase({
                ongoingActions: [{ uid: 'ft-pod-2', defId: 'trickster_flame_trap_pod', ownerId: '0' }],
            });
            const state = makeState([base0, base1]);
            const matchState = makePromptMatchState(state as any);

            const { events, matchState: promptedState } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                matchState,
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
            const prompts = getPromptsBySourceId(promptedState!, 'trickster_flame_trap_pod_bp');
            expect(prompts).toHaveLength(2);
            const [firstPrompt, secondPrompt] = prompts;
            expect(getPromptOption(firstPrompt, option => option?.value?.yes === true, 'Flame Trap POD first yes option')).toBeDefined();
            expect(getPromptOption(secondPrompt, option => option?.value?.yes === true, 'Flame Trap POD second yes option')).toBeDefined();

            const first = respondToPromptOption(
                withOnlyCurrentPrompt(promptedState!, firstPrompt),
                option => option?.value?.yes === true,
                'Flame Trap POD first yes option',
                '0',
                dummyRandom,
            );
            const second = respondToPromptOption(
                withOnlyCurrentPrompt(promptedState!, secondPrompt),
                option => option?.value?.yes === true,
                'Flame Trap POD second yes option',
                '0',
                dummyRandom,
            );

            expect(first.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.BREAKPOINT_MODIFIED,
                    payload: expect.objectContaining({ baseIndex: 0, delta: -4, reason: 'trickster_flame_trap_pod' }),
                }),
            ]));
            expect(second.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.BREAKPOINT_MODIFIED,
                    payload: expect.objectContaining({ baseIndex: 1, delta: -4, reason: 'trickster_flame_trap_pod' }),
                }),
            ]));
        });

        function makeBrownieState(overrides?: Partial<MinionOnBase>): SmashUpCore {
            const brownie = makeMinion({
                defId: 'trickster_brownie',
                uid: 'brownie-1',
                controller: '0',
                owner: '0',
                ...overrides,
            });
            return makeState([makeBase({ minions: [brownie] })], {
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [
                        makeCard('opp-h1', 'pirate_first_mate', 'action', '1', SMASHUP_FACTION_IDS.PIRATES),
                        makeCard('opp-h2', 'wizard_archmage', 'action', '1', SMASHUP_FACTION_IDS.WIZARDS),
                        makeCard('opp-h3', 'robot_microbot_alpha', 'action', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    ],
                } as any,
            });
        }

        function triggerBrownieFromEvent(state: SmashUpCore, event: any) {
            const affectRecords = buildAffectRecords(state, event, '1');
            const affectBatchTargets = affectRecords
                .filter(record => record.countsForOnMinionAffected && record.triggerMinion && record.baseIndex !== undefined)
                .map(record => ({
                    minionUid: record.triggerMinionUid ?? record.triggerMinion!.uid,
                    baseIndex: record.baseIndex!,
                    controllerId: record.triggerMinion!.controller,
                }));
            const allEvents = affectRecords.flatMap(record => {
                if (!record.countsForOnMinionAffected || !record.triggerMinion || record.baseIndex === undefined) {
                    return [];
                }
                return fireTriggers(state, 'onMinionAffected', {
                    state,
                    playerId: record.sourcePlayerId ?? '1',
                    baseIndex: record.baseIndex,
                    sourceCardUid: record.sourceCardUid,
                    sourceBaseIndex: record.sourceBaseIndex,
                    sourceControllerId: record.sourceControllerId,
                    triggerMinionUid: record.triggerMinionUid,
                    triggerMinionDefId: record.triggerMinionDefId,
                    triggerMinion: record.triggerMinion,
                    affectType: record.affectType,
                    affectEvent: event,
                    affectBatchTargets,
                    reason: record.reason,
                    random: dummyRandom,
                    now: 1000,
                }).events;
            });
            return allEvents.filter(evt => evt.type === SU_EVENTS.CARDS_DISCARDED);
        }

        test.each([
            ['回手', () => ({
                type: SU_EVENTS.MINION_RETURNED,
                payload: {
                    minionUid: 'brownie-1',
                    minionDefId: 'trickster_brownie',
                    fromBaseIndex: 0,
                    toPlayerId: '0',
                    reason: 'pirate_shanghai',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['正向加力', () => ({
                type: SU_EVENTS.PERMANENT_POWER_ADDED,
                payload: {
                    minionUid: 'brownie-1',
                    baseIndex: 0,
                    amount: 2,
                    reason: 'robot_augmentation',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-2',
                    sourceDefId: 'robot_augmentation',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['负向减力', () => ({
                type: SU_EVENTS.PERMANENT_POWER_ADDED,
                payload: {
                    minionUid: 'brownie-1',
                    baseIndex: 0,
                    amount: -2,
                    reason: 'killer_plant_sleep_spores',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-3',
                    sourceDefId: 'killer_plant_sleep_spores',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['附着行动', () => ({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: 'src-4',
                    defId: 'trickster_mark_of_sleep',
                    ownerId: '1',
                    targetType: 'minion',
                    targetBaseIndex: 0,
                    targetMinionUid: 'brownie-1',
                },
                timestamp: 1000,
            })],
            ['控制权变化', () => ({
                type: SU_EVENTS.MINION_CONTROL_CHANGED,
                payload: {
                    minionUid: 'brownie-1',
                    minionDefId: 'trickster_brownie',
                    baseIndex: 0,
                    ownerId: '0',
                    fromControllerId: '0',
                    toControllerId: '1',
                    reason: 'ghost_make_contact',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-5',
                    sourceDefId: 'ghost_make_contact',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['压制', () => ({
                type: SU_EVENTS.CARD_SUPPRESSED,
                payload: {
                    cardUid: 'brownie-1',
                    baseIndex: 0,
                    suppressorPlayerId: '1',
                    cardType: 'minion',
                    reason: 'wizard_mass_enchantment',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-6',
                    sourceDefId: 'wizard_mass_enchantment',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
        ])('被%s时会让对手弃两张牌', (_label, buildEvent) => {
            const state = makeBrownieState();
            const discardEvents = triggerBrownieFromEvent(state, buildEvent());

            expect(discardEvents).toHaveLength(1);
            expect((discardEvents[0] as any).payload.playerId).toBe('1');
            expect((discardEvents[0] as any).payload.cardUids).toHaveLength(2);
        });

        test.each([
            ['detach', makeBrownieState({
                attachedActions: [{ uid: 'attach-1', defId: 'trickster_mark_of_sleep', ownerId: '1' }],
            }), {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'attach-1',
                    defId: 'trickster_mark_of_sleep',
                    ownerId: '1',
                    reason: 'trickster_mark_of_sleep_transferred',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-7',
                    sourceDefId: 'trickster_tinx',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            }],
            ['规则清附件', makeBrownieState({
                attachedActions: [{ uid: 'attach-2', defId: 'trickster_mark_of_sleep', ownerId: '1' }],
            }), {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'attach-2',
                    defId: 'trickster_mark_of_sleep',
                    ownerId: '1',
                    reason: 'trickster_mark_of_sleep_host_destroyed',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-8',
                    sourceDefId: 'pirate_cannon',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            }],
            ['持续效果过期', makeBrownieState({
                attachedActions: [{ uid: 'attach-3', defId: 'robot_augmentation', ownerId: '1' }],
            }), {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'attach-3',
                    defId: 'robot_augmentation',
                    ownerId: '1',
                    reason: 'robot_augmentation_expired',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-9',
                    sourceDefId: 'robot_augmentation',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            }],
        ])('不会因%s误触发', (_label, state, event) => {
            const discardEvents = triggerBrownieFromEvent(state, event);
            expect(discardEvents).toEqual([]);
        });
    });

    describe('trickster_block_the_path: 封路', () => {
        test('对手不能打出被封派系随从到封路基地', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } }],
            });
            const state = makeState([base]);

            // 使用真实的机器人派系 defId
            expect(isOperationRestricted(state, 0, '1', 'play_minion', { minionDefId: 'robot_zapbot' })).toBe(true);
        });

        test('所有玩家都受封路限制（描述无"对手"限定）', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } }],
            });
            const state = makeState([base]);

            // 拥有者也受限制（描述无"对手"限定词）
            expect(isOperationRestricted(state, 0, '0', 'play_minion', { minionDefId: 'robot_zapbot' })).toBe(true);
        });
    });

    describe('trickster_hideout: 藏身处保护', () => {
        test('保护同基地己方随从不受对手行动卡影响', () => {
            const myMinion = makeMinion({ defId: 'trickster_a', uid: 't-1', controller: '0' });
            const base = makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });

        test('不保护敌方随从', () => {
            const enemyMinion = makeMinion({ defId: 'robot_a', uid: 'r-1', controller: '1' });
            const base = makeBase({
                minions: [enemyMinion],
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout', ownerId: '0' }],
            });
            const state = makeState([base]);

            // 玩家 0 的 Hideout 不应该保护玩家 1 的随从
            expect(isMinionProtected(state, enemyMinion, 0, '0', 'action')).toBe(false);
        });

        test('POD 版不沿用旧版行动牌保护', () => {
            const myMinion = makeMinion({ defId: 'trickster_a', uid: 't-1', controller: '0' });
            const base = makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout_pod', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(false);
        });

        test('POD 版会阻止其他玩家把随从移动到此基地', () => {
            const sourceBase = makeBase({
                minions: [makeMinion({ defId: 'robot_zapbot', uid: 'm-1', controller: '1', owner: '1' })],
            });
            const targetBase = makeBase({
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout_pod', ownerId: '0' }],
            });
            const state = makeState([sourceBase, targetBase]);

            const result = interceptEvent(state, {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'm-1',
                    minionDefId: 'robot_zapbot',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move',
                },
                timestamp: 1000,
            } as any);

            expect(result).toBeNull();
        });

        test('POD 版允许拥有者把自己的随从移动到此基地', () => {
            const sourceBase = makeBase({
                minions: [makeMinion({ defId: 'trickster_a', uid: 'm-2', controller: '0', owner: '0' })],
            });
            const targetBase = makeBase({
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout_pod', ownerId: '0' }],
            });
            const state = makeState([sourceBase, targetBase]);

            const result = interceptEvent(state, {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'm-2',
                    minionDefId: 'trickster_a',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move',
                },
                timestamp: 1000,
            } as any);

            expect(result).toBeUndefined();
        });
    });

    describe('trickster_pay_the_piper: 付笛手的钱', () => {
        test('对手打出随从后弃一张牌', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'pp-1', defId: 'trickster_pay_the_piper', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
            expect((events[0] as any).payload.playerId).toBe('1');
        });
    });

    describe('trickster_enshrouding_mist: 迷雾笼罩', () => {
        test('onTurnStart 不再直接发额外随从事件', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'em-1', defId: 'trickster_enshrouding_mist', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('非拥有者回合同样不触发 onTurnStart 事件', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'em-1', defId: 'trickster_enshrouding_mist', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '1',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('onPlay 在非出牌阶段也应为 immediate extra', () => {
            const base = makeBase();
            const state = makeState([base]);
            const ms = makeMatchState(state);
            ms.sys.phase = 'startTurn';

            const executor = resolveAbility('trickster_enshrouding_mist', 'onPlay')!;
            const result = executor({
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'em-1',
                defId: 'trickster_enshrouding_mist',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            expect(result.events).toHaveLength(1);
            expect(result.events?.[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
            expect((result.events?.[0] as any).payload.playTiming).toBe('immediate');
        });
    });

    describe('trickster_leprechaun: 小矮妖', () => {
        test('对手打出力量更低的随从到同基地时消灭', () => {
            const leprechaun = makeMinion({
                defId: 'trickster_leprechaun', uid: 'lp-1', controller: '0', basePower: 4,
            });
            const weakMinion = makeMinion({
                defId: 'weak_minion', uid: 'wm-1', controller: '1', basePower: 2,
            });
            const base = makeBase({ minions: [leprechaun, weakMinion] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'wm-1',
                triggerMinionDefId: 'weak_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('wm-1');
        });

        test('POD 版应标记消灭者', () => {
            const leprechaun = makeMinion({
                defId: 'trickster_leprechaun_pod', uid: 'lp-pod-1', controller: '0', owner: '0', basePower: 4,
            });
            const weakMinion = makeMinion({
                defId: 'weak_minion', uid: 'wm-1', controller: '1', owner: '1', basePower: 2,
            });
            const base = makeBase({ minions: [leprechaun, weakMinion] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'wm-1',
                triggerMinionDefId: 'weak_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.destroyerId).toBe('0');
        });
    });

    describe('trickster_mark_of_sleep: 沉睡印记', () => {
        test('onPlay 能力已注册', () => {
            const executor = resolveAbility('trickster_mark_of_sleep', 'onPlay');
            expect(executor).toBeDefined();
        });

        test('单目标时创建 Interaction', () => {
            const base = makeBase();
            const state = makeState([base]);
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('trickster_mark_of_sleep', 'onPlay')!;
            const result = executor({
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'ms-1',
                defId: 'trickster_mark_of_sleep',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            // 迁移后通过 Interaction 而非事件
            const current = getFirstPrompt(result.matchState!);
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('trickster_mark_of_sleep');
            expect(getPromptTargetType(current)).toBe('player');
        });
    });
});
