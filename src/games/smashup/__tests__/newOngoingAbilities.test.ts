/**
 * 新增 ongoing 能力测试
 *
 * 覆盖：
 * - 黑熊骑兵：general_ivan / polar_commando / superiority / cub_scout / high_ground
 * - 恐龙：tooth_and_claw / upgrade
 * - 克苏鲁：altar / furthering_the_cause
 * - 杀手植物：overgrowth / entangled
 * - 远古之物：dunwich_horror
 * - 框架修复：getEffectiveBreakpoint / processMoveTriggers
 */
 

import { describe, it, expect, beforeAll } from 'vitest';
import type { SmashUpCore, PlayerState, MinionOnBase, BaseInPlay, TempPowerAddedEvent, MinionMovedEvent, MinionDestroyedEvent, MadnessDrawnEvent, MadnessReturnedEvent, CardsDrawnEvent, CardsDiscardedEvent, MinionReturnedEvent, BaseReplacedEvent, CardToDeckBottomEvent, CardInstance, LimitModifiedEvent, TurnStartedEvent } from '../domain/types';
import { countMadnessCards, madnessVpPenalty } from '../domain/abilityHelpers';
import { triggerBaseAbility, triggerExtendedBaseAbility } from '../domain/baseAbilities';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearPowerModifierRegistry, getEffectivePower, getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import {
    clearOngoingEffectRegistry,
    isMinionProtected,
    fireTriggers,
    interceptEvent,
} from '../domain/ongoingEffects';
import { reduce } from '../domain/reducer';
import { resolveAbility } from '../domain/abilityRegistry';
import type { AbilityContext } from '../domain/abilityRegistry';
import { validate } from '../domain/commands';
import { SU_COMMANDS } from '../domain/types';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { RandomFn } from '../../../engine/types';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, talentUsed: false, attachedActions: [],
        ...overrides,
    };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeBase(overrides: Partial<BaseInPlay> = {}): BaseInPlay {
    return { defId: 'test_base', minions: [], ongoingActions: [], ...overrides };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

const dummyRandom: RandomFn = { random: () => 0.5, shuffle: <T>(arr: T[]) => [...arr], d: () => 1, range: (min: number) => min };

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 黑熊骑兵 - 保护
// ============================================================================

describe('bear_cavalry_general_ivan 保护', () => {
    it('伊万将军保护己方其他随从不被对手消灭', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6);
        const ally = makeMinion('ally', 'test_minion', '0', 3);
        const base = makeBase({ minions: [ivan, ally] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, ally, 0, '1', 'destroy')).toBe(true);
    });

    it('不保护伊万将军自身', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6);
        const base = makeBase({ minions: [ivan] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, ivan, 0, '1', 'destroy')).toBe(false);
    });

    it('不保护对手的随从', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6);
        const enemy = makeMinion('enemy', 'test_minion', '1', 3);
        const base = makeBase({ minions: [ivan, enemy] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, enemy, 0, '0', 'destroy')).toBe(false);
    });
});

describe('bear_cavalry_polar_commando 保护', () => {
    it('唯一己方随从时不可消灭', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4);
        const base = makeBase({ minions: [commando] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(true);
    });

    it('有其他己方随从时可被消灭', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4);
        const ally = makeMinion('ally', 'test_minion', '0', 2);
        const base = makeBase({ minions: [commando, ally] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(false);
    });

    it('唯一时 +2 力量', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4);
        const base = makeBase({ minions: [commando] });
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, commando, 0)).toBe(6); // 4 + 2
    });
});

describe('bear_cavalry_superiority 保护', () => {
    it('保护基地上己方随从不被对手消灭', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'sup-1', defId: 'bear_cavalry_superiority', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, myMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
    });

    it('不保护对手的随从', () => {
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3);
        const base = makeBase({
            minions: [enemyMinion],
            ongoingActions: [{ uid: 'sup-1', defId: 'bear_cavalry_superiority', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, enemyMinion, 0, '0', 'destroy')).toBe(false);
    });
});

// ============================================================================
// 黑熊骑兵 - 触发
// ============================================================================

describe('bear_cavalry_cub_scout 触发', () => {
    it('力量低于斥候的对手随从被消灭', () => {
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3);
        const moved = makeMinion('moved', 'test_minion', '1', 2);
        const destBase = makeBase({ minions: [scout] });
        const srcBase = makeBase({ minions: [moved] });
        const state = makeState({ bases: [destBase, srcBase] });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state, playerId: '0', baseIndex: 0,
            triggerMinionUid: 'moved', triggerMinionDefId: 'test_minion',
            random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('力量不低于斥候的随从不被消灭', () => {
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3);
        const moved = makeMinion('moved', 'test_minion', '1', 5);
        const destBase = makeBase({ minions: [scout] });
        const srcBase = makeBase({ minions: [moved] });
        const state = makeState({ bases: [destBase, srcBase] });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state, playerId: '0', baseIndex: 0,
            triggerMinionUid: 'moved', triggerMinionDefId: 'test_minion',
            random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});

describe('bear_cavalry_high_ground 触发', () => {
    it('有己方随从时消灭移入的对手随从', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3);
        const moved = makeMinion('moved', 'test_minion', '1', 5);
        const destBase = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'hg-1', defId: 'bear_cavalry_high_ground', ownerId: '0' }],
        });
        const srcBase = makeBase({ minions: [moved] });
        const state = makeState({ bases: [destBase, srcBase] });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state, playerId: '0', baseIndex: 0,
            triggerMinionUid: 'moved', triggerMinionDefId: 'test_minion',
            random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });
});

// ============================================================================
// 恐龙 - 保护 + 力量修正
// ============================================================================

describe('dino_upgrade 力量修正', () => {
    it('附着 upgrade 的随从不提供消灭保护（仅 +2 力量）', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'up-1', defId: 'dino_upgrade', ownerId: '0' }],
        });
        const base = makeBase({ minions: [minion] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, minion, 0, '1', 'destroy')).toBe(false);
    });

    it('附着 upgrade 的随从 +2 力量', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'up-1', defId: 'dino_upgrade', ownerId: '0' }],
        });
        const base = makeBase({ minions: [minion] });
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, minion, 0)).toBe(5); // 3 + 2
    });
});

describe('dino_tooth_and_claw 保护', () => {
    it('附着此卡的随从不被其他玩家消灭（通过拦截器）', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'tc-1', defId: 'dino_tooth_and_claw', ownerId: '0' }],
        });
        const base = makeBase({ minions: [minion] });
        const state = makeState({ bases: [base] });
        // destroy 保护现在通过 interceptor 实现，不再通过 isMinionProtected
        // 验证 interceptEvent 拦截消灭事件
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'test_minion', fromBaseIndex: 0, ownerId: '1', reason: 'test' },
            timestamp: 0,
        };
        const result = interceptEvent(state, destroyEvt);
        // 拦截器应替换消灭事件为自毁事件
        expect(result).toBeDefined();
        expect(Array.isArray(result) ? result : [result]).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: SU_EVENTS.ONGOING_DETACHED })])
        );
        // affect 保护仍通过 isMinionProtected
        expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, minion, 0, '0', 'affect')).toBe(false);
    });
});

// ============================================================================
// 克苏鲁 - 触发
// ============================================================================

describe('cthulhu_altar 触发', () => {
    it('在祭坛所在基地打出随从时获得额外行动', () => {
        const base = makeBase({
            ongoingActions: [{ uid: 'alt-1', defId: 'cthulhu_altar', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onMinionPlayed', {
            state, playerId: '0', baseIndex: 0,
            triggerMinionUid: 'm1', triggerMinionDefId: 'test',
            random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);
    });

    it('对手打出随从不触发', () => {
        const base = makeBase({
            ongoingActions: [{ uid: 'alt-1', defId: 'cthulhu_altar', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onMinionPlayed', {
            state, playerId: '1', baseIndex: 0,
            triggerMinionUid: 'm1', triggerMinionDefId: 'test',
            random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
    });
});

describe('cthulhu_furthering_the_cause 触发', () => {
    it('本回合该基地有对手随从被消灭→获得 1VP', () => {
        const base = makeBase({
            ongoingActions: [{ uid: 'ftc-1', defId: 'cthulhu_furthering_the_cause', ownerId: '0' }],
        });
        // 模拟本回合在基地 0 消灭了对手随从
        const state = makeState({
            bases: [base],
            turnDestroyedMinions: [{ defId: 'test_minion', baseIndex: 0, owner: '1' }],
        });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state, playerId: '0', random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);
    });

    it('本回合该基地无对手随从被消灭→不获得 VP', () => {
        const enemy = makeMinion('e1', 'test_minion', '1', 3);
        const base = makeBase({
            minions: [enemy],
            ongoingActions: [{ uid: 'ftc-1', defId: 'cthulhu_furthering_the_cause', ownerId: '0' }],
        });
        // turnDestroyedMinions 为空，未消灭任何随从
        const state = makeState({ bases: [base], turnDestroyedMinions: [] });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state, playerId: '0', random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(false);
    });

    it('reducer: MINION_DESTROYED 追踪到 turnDestroyedMinions', () => {
        const minion = makeMinion('m1', 'test_minion', '1', 3);
        const base = makeBase({ minions: [minion] });
        const state = makeState({ bases: [base] });

        const evt: MinionDestroyedEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'test_minion', fromBaseIndex: 0, ownerId: '1', reason: 'test' },
            timestamp: 0,
        };
        const next = reduce(state, evt);
        expect(next.turnDestroyedMinions).toBeDefined();
        expect(next.turnDestroyedMinions!.length).toBe(1);
        expect(next.turnDestroyedMinions![0]).toEqual({ defId: 'test_minion', baseIndex: 0, owner: '1' });
    });

    it('reducer: TURN_CHANGED 清空 turnDestroyedMinions', () => {
        const state = makeState({
            turnDestroyedMinions: [
                { defId: 'test_minion', baseIndex: 0, owner: '1' },
                { defId: 'test_minion2', baseIndex: 1, owner: '1' },
            ],
        });

        const evt: TurnStartedEvent = {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 0,
        };
        const next = reduce(state, evt);
        expect(next.turnDestroyedMinions).toEqual([]);
    });
});

// ============================================================================
// 杀手植物
// ============================================================================

describe('killer_plant_overgrowth 回合开始临界点降为0', () => {
    it('控制者回合开始时产生 BREAKPOINT_MODIFIED 事件', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
        });
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [base],
        });
        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '0', random: dummyRandom, now: 0,
        });
        const bpEvents = events.filter(e => e.type === SU_EVENTS.BREAKPOINT_MODIFIED);
        expect(bpEvents.length).toBe(1);
        const payload = (bpEvents[0] as any).payload;
        expect(payload.baseIndex).toBe(0);
        // base_the_jungle 临界点为 12，delta 应为 -12
        expect(payload.delta).toBe(-12);
    });

    it('非控制者回合不触发', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
        });
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [base],
        });
        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '1', random: dummyRandom, now: 0,
        });
        const bpEvents = events.filter(
            e => e.type === SU_EVENTS.BREAKPOINT_MODIFIED && (e as any).payload.reason === 'killer_plant_overgrowth'
        );
        expect(bpEvents.length).toBe(0);
    });

    it('reduce 后 tempBreakpointModifiers 生效，临界点为0', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
        });
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [base],
        });
        // 模拟 reduce BREAKPOINT_MODIFIED 事件
        const modified = reduce(state, {
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: { baseIndex: 0, delta: -12, reason: 'killer_plant_overgrowth' },
            timestamp: 0,
        });
        const bp = getEffectiveBreakpoint(modified, 0);
        expect(bp).toBe(0);
    });

    it('打出当回合 scoreBases 阶段不生效（未经过 onTurnStart）', () => {
        // 过度生长刚打出，还没经过 onTurnStart，tempBreakpointModifiers 为空
        const base = makeBase({
            defId: 'base_the_jungle',
            ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
        });
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [base],
        });
        // 直接查询临界点——不应该被修正（因为没有触发 onTurnStart）
        const bp = getEffectiveBreakpoint(state, 0);
        expect(bp).toBe(12);
    });
});

describe('killer_plant_entangled 保护 + 自毁', () => {
    it('有己方随从的基地上所有随从不可被移动', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3);
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3);
        const base = makeBase({
            minions: [myMinion, enemyMinion],
            ongoingActions: [{ uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        // 己方和对手随从都受 move 保护
        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, enemyMinion, 0, '0', 'move')).toBe(true);
    });

    it('控制者回合开始时消灭本卡', () => {
        const base = makeBase({
            ongoingActions: [{ uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '0', random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.ONGOING_DETACHED)).toBe(true);
    });

    it('非控制者回合不消灭', () => {
        const base = makeBase({
            ongoingActions: [{ uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '1', random: dummyRandom, now: 0,
        });
        const detachEvents = events.filter(
            e => e.type === SU_EVENTS.ONGOING_DETACHED && (e as any).payload.defId === 'killer_plant_entangled'
        );
        expect(detachEvents.length).toBe(0);
    });
});

// ============================================================================
// 远古之物
// ============================================================================

describe('elder_thing_dunwich_horror', () => {
    it('附着此卡的随从 +5 力量', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror', ownerId: '0' }],
        });
        const base = makeBase({ minions: [minion] });
        const state = makeState({ bases: [base] });
        expect(getEffectivePower(state, minion, 0)).toBe(8); // 3 + 5
    });

    it('回合结束时消灭附着此卡的随从', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror', ownerId: '0' }],
        });
        const base = makeBase({ minions: [minion] });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state, playerId: '0', random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });
});

// ============================================================================
// beforeScoring / afterScoring 触发器
// ============================================================================

describe('pirate_king beforeScoring', () => {
    it('计分前将不在计分基地的海盗王移过去', () => {
        const king = makeMinion('king', 'pirate_king', '0', 5);
        const otherMinion = makeMinion('m1', 'test_minion', '1', 3);
        const scoringBase = makeBase({ minions: [otherMinion] });
        const otherBase = makeBase({ minions: [king] });
        const state = makeState({ bases: [scoringBase, otherBase] });

        const { events } = fireTriggers(state, 'beforeScoring', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        const moveEvts = events.filter(e => e.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
        expect(moveEvts.length).toBe(1);
        expect(moveEvts[0].payload.minionUid).toBe('king');
        expect(moveEvts[0].payload.fromBaseIndex).toBe(1);
        expect(moveEvts[0].payload.toBaseIndex).toBe(0);
    });

    it('已在计分基地时不产生移动事件', () => {
        const king = makeMinion('king', 'pirate_king', '0', 5);
        const scoringBase = makeBase({ minions: [king] });
        const state = makeState({ bases: [scoringBase] });

        const { events } = fireTriggers(state, 'beforeScoring', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        expect(events.filter(e => e.type === SU_EVENTS.MINION_MOVED).length).toBe(0);
    });
});

describe('pirate_first_mate afterScoring', () => {
    it('计分后将副官移动到其他基地', () => {
        const mate = makeMinion('mate', 'pirate_first_mate', '0', 2);
        const scoringBase = makeBase({ minions: [mate] });
        const otherBase = makeBase({});
        const state = makeState({ bases: [scoringBase, otherBase] });

        const { events } = fireTriggers(state, 'afterScoring', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        const moveEvts = events.filter(e => e.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
        expect(moveEvts.length).toBe(1);
        expect(moveEvts[0].payload.minionUid).toBe('mate');
        expect(moveEvts[0].payload.toBaseIndex).toBe(1);
    });

    it('没有其他基地时不产生事件', () => {
        const mate = makeMinion('mate', 'pirate_first_mate', '0', 2);
        const scoringBase = makeBase({ minions: [mate] });
        const state = makeState({ bases: [scoringBase] });

        const { events } = fireTriggers(state, 'afterScoring', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        expect(events.filter(e => e.type === SU_EVENTS.MINION_MOVED).length).toBe(0);
    });
});

describe('cthulhu_chosen beforeScoring', () => {
    /** 包装为 MatchState */
    function makeMS(core: SmashUpCore) {
        return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
    }

    it('有 matchState 时创建确认交互（"你可以"语义）', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3);
        const scoringBase = makeBase({ minions: [chosen] });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({ uid: `mad-${i}`, defId: MADNESS_CARD_DEF_ID, type: 'madness' as const })),
            nextUid: 200,
        });
        const ms = makeMS(state);

        const result = fireTriggers(state, 'beforeScoring', {
            state, matchState: ms, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        // 有 matchState 时创建交互确认，不直接产生事件
        expect(result.events.length).toBe(0);
        expect(result.matchState).toBeDefined();
    });

    it('无 matchState 时回退自动执行', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3);
        const scoringBase = makeBase({ minions: [chosen] });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({ uid: `mad-${i}`, defId: MADNESS_CARD_DEF_ID, type: 'madness' as const })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state, matchState: undefined as any, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        // 无 matchState 时自动执行
        expect(result.events.some(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
        const powerEvts = result.events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvts.length).toBe(1);
        expect(powerEvts[0].payload.minionUid).toBe('ch1');
        expect(powerEvts[0].payload.amount).toBe(2);
    });

    it('无疯狂牌库时回退自动执行仍获得+2力量', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3);
        const scoringBase = makeBase({ minions: [chosen] });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: [],
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state, matchState: undefined as any, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        // 无疯狂牌库 → 不产生 MADNESS_DRAWN，但仍获得 +2 力量
        expect(result.events.some(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toBe(false);
        const powerEvts = result.events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvts.length).toBe(1);
        expect(powerEvts[0].payload.amount).toBe(2);
    });

    it('多个天选之人时创建链式确认交互', () => {
        const ch1 = makeMinion('ch1', 'cthulhu_chosen', '0', 3);
        const ch2 = makeMinion('ch2', 'cthulhu_chosen', '1', 3);
        const scoringBase = makeBase({ minions: [ch1, ch2] });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({ uid: `mad-${i}`, defId: MADNESS_CARD_DEF_ID, type: 'madness' as const })),
            nextUid: 200,
        });
        const ms = makeMS(state);

        const result = fireTriggers(state, 'beforeScoring', {
            state, matchState: ms, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        // 有 matchState 时创建交互，不直接产生事件
        expect(result.events.length).toBe(0);
        expect(result.matchState).toBeDefined();
    });

    it('不在计分基地上的天选之人也能触发（回退模式）', () => {
        const ch1 = makeMinion('ch1', 'cthulhu_chosen', '0', 3);
        const otherBase = makeBase({ minions: [ch1] });
        const scoringBase = makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 5)] });
        const state = makeState({
            bases: [scoringBase, otherBase],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({ uid: `mad-${i}`, defId: MADNESS_CARD_DEF_ID, type: 'madness' as const })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state, matchState: undefined as any, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        // 天选之人在 base[1]，计分的是 base[0]，仍然触发
        const powerEvts = result.events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvts.length).toBe(1);
        expect(powerEvts[0].payload.minionUid).toBe('ch1');
        expect(powerEvts[0].payload.baseIndex).toBe(1); // 力量加在天选之人所在的基地
    });
});

describe('elder_thing_the_price_of_power special 能力', () => {
    it('对手有随从且手牌有疯狂卡时给己方随从加力量', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3);
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 4);
        const scoringBase = makeBase({
            minions: [myMinion, enemyMinion],
        });
        const state = makeState({
            bases: [scoringBase],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'madness' as any },
                        { uid: 'mad2', defId: MADNESS_CARD_DEF_ID, type: 'madness' as any },
                        { uid: 'normal', defId: 'test_card', type: 'action' as any },
                    ],
                }),
            },
        });

        const executor = resolveAbility('elder_thing_the_price_of_power', 'special');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'scoreBases', interaction: { queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0',
            cardUid: 'pop-1', defId: 'elder_thing_the_price_of_power',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        const powerEvts = result.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED) as PowerCounterAddedEvent[];
        // 对手有2张疯狂卡 → 己方随从获得2次+2力量
        expect(powerEvts.length).toBe(2);
        expect(powerEvts.every(e => e.payload.amount === 2)).toBe(true);
    });

    it('对手在此基地无随从时不触发', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3);
        const scoringBase = makeBase({
            minions: [myMinion],
        });
        const state = makeState({
            bases: [scoringBase],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [{ uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'madness' as any }],
                }),
            },
        });

        const executor = resolveAbility('elder_thing_the_price_of_power', 'special');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'scoreBases', interaction: { queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0',
            cardUid: 'pop-1', defId: 'elder_thing_the_price_of_power',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        expect(result.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBe(0);
    });

    it('对手手牌无疯狂卡时不触发', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3);
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 4);
        const scoringBase = makeBase({
            minions: [myMinion, enemyMinion],
        });
        const state = makeState({
            bases: [scoringBase],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [{ uid: 'normal', defId: 'test_card', type: 'action' as any }],
                }),
            },
        });

        const executor = resolveAbility('elder_thing_the_price_of_power', 'special');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'scoreBases', interaction: { queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0',
            cardUid: 'pop-1', defId: 'elder_thing_the_price_of_power',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        expect(result.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBe(0);
    });
});

// 任务 3：现有框架直接可做的 ongoing 能力
// ============================================================================

describe('alien_jammed_signal: 无视基地能力', () => {
    it('压制常规基地触发（onActionPlayed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_the_workshop' })],
        });
        const normalResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_the_workshop',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });

    it('压制扩展基地触发（onMinionDestroyed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_cave_of_shinies' })],
        });
        const normalResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_cave_of_shinies',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });
});

describe('cthulhu_complete_the_ritual onTurnStart', () => {
    it('拥有者回合开始时返回随从+移除ongoing+换基地', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const m2 = makeMinion('m2', 'test_minion', '1', 4);
        const base = makeBase({
            minions: [m1, m2],
            ongoingActions: [
                { uid: 'ritual-1', defId: 'cthulhu_complete_the_ritual', ownerId: '0' },
                { uid: 'other-1', defId: 'cthulhu_altar', ownerId: '0' },
            ],
        });
        const state = makeState({ bases: [base], baseDeck: ['new_base_def'] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '0', random: dummyRandom, now: 0,
        });
        // 随从放回拥有者牌库底
        const toDeckBottom = events.filter(e => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM) as CardToDeckBottomEvent[];
        // 2 个随从 + 2 个 ongoing 行动卡 = 4 个 CARD_TO_DECK_BOTTOM 事件
        expect(toDeckBottom.length).toBe(4);
        // 基地清除（BASE_CLEARED 用于删除基地）
        expect(events.some(e => e.type === SU_EVENTS.BASE_CLEARED)).toBe(true);
        // 新基地插入
        const replaced = events.filter(e => e.type === SU_EVENTS.BASE_REPLACED) as BaseReplacedEvent[];
        expect(replaced.length).toBe(1);
        expect(replaced[0].payload.newBaseDefId).toBe('new_base_def');
    });

    it('非拥有者回合不触发', () => {
        const base = makeBase({
            ongoingActions: [{ uid: 'ritual-1', defId: 'cthulhu_complete_the_ritual', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '1', random: dummyRandom, now: 0,
        });
        expect(events.filter(e => e.type === SU_EVENTS.BASE_CLEARED).length).toBe(0);
    });
});

describe('BASE_REPLACED keepCards 模式 (terraform)', () => {
    it('keepCards=true 时保留随从和 ongoing，仅替换 defId', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({
            defId: 'old_base',
            minions: [m1],
            ongoingActions: [{ uid: 'ong-1', defId: 'cthulhu_altar', ownerId: '0' }],
        });
        const state = makeState({ bases: [base], baseDeck: ['new_base', 'another'] });

        const evt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base', keepCards: true },
            timestamp: 0,
        };
        const next = reduce(state, evt);
        // defId 已替换
        expect(next.bases[0].defId).toBe('new_base');
        // 随从保留
        expect(next.bases[0].minions.length).toBe(1);
        expect(next.bases[0].minions[0].uid).toBe('m1');
        // ongoing 保留
        expect(next.bases[0].ongoingActions.length).toBe(1);
        // 旧 defId 回到基地牌库
        expect(next.baseDeck).toContain('old_base');
        // 新 defId 从牌库移除
        expect(next.baseDeck).not.toContain('new_base');
    });

    it('keepCards=false/默认时创建空基地并插入', () => {
        const base = makeBase({ defId: 'old_base' });
        const state = makeState({ bases: [base], baseDeck: ['new_base'] });

        const evt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base' },
            timestamp: 0,
        };
        const next = reduce(state, evt);
        // 插入了新基地（旧基地仍在，总数+1）
        expect(next.bases.length).toBe(2);
        expect(next.bases[0].defId).toBe('new_base');
        expect(next.bases[0].minions.length).toBe(0);
    });
});

// ============================================================================
// 海盗 Buccaneer - onMinionDestroyed 触发器（被消灭→移动）
// ============================================================================

describe('pirate_buccaneer 触发器：被消灭→移动', () => {
    it('两个基地时自动移动（产生 MINION_MOVED）', () => {
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4);
        const base0 = makeBase({ minions: [buccaneer] });
        const base1 = makeBase();
        const state = makeState({ bases: [base0, base1] });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 0,
        });
        // 应产生 MINION_MOVED 事件
        expect(result.events.length).toBe(1);
        const moved = result.events[0] as MinionMovedEvent;
        expect(moved.type).toBe(SU_EVENTS.MINION_MOVED);
        expect(moved.payload.minionUid).toBe('buc-1');
        expect(moved.payload.fromBaseIndex).toBe(0);
        expect(moved.payload.toBaseIndex).toBe(1);
        expect(moved.payload.reason).toBe('pirate_buccaneer');
    });

    it('无其他基地时不触发（正常消灭）', () => {
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4);
        const base = makeBase({ minions: [buccaneer] });
        const state = makeState({ bases: [base] }); // 只有一个基地

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 0,
        });
        expect(result.events.length).toBe(0);
    });

    it('非 buccaneer 随从不触发', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3);
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4);
        const base0 = makeBase({ minions: [minion, buccaneer] });
        const base1 = makeBase();
        const state = makeState({ bases: [base0, base1] });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });
        expect(result.events.length).toBe(0);
    });

    it('buccaneer 不在场时不触发', () => {
        const base0 = makeBase(); // 没有 buccaneer
        const base1 = makeBase();
        const state = makeState({ bases: [base0, base1] });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 0,
        });
        // isSourceActive 检查 buccaneer 不在场，触发器不触发
        expect(result.events.length).toBe(0);
    });

    it('三个以上基地时创建交互（玩家选择目标基地）', () => {
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4);
        const base0 = makeBase({ minions: [buccaneer] });
        const base1 = makeBase();
        const base2 = makeBase();
        const state = makeState({ bases: [base0, base1, base2] });
        // 构造 matchState 以支持交互创建
        const matchState = {
            core: state,
            playerIds: ['0', '1'],
            sys: { interaction: { current: null, queue: [] }, gameover: null, eventStream: { entries: [], nextId: 0 } },
        } as unknown as import('../../../engine/types').MatchState<SmashUpCore>;

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 1,
        });
        // 不产生移动事件（等待玩家选择）
        expect(result.events.length).toBe(0);
        // 应创建交互
        expect(result.matchState).toBeDefined();
        const ms = result.matchState!;
        const pending = ms.sys.interaction.current ?? ms.sys.interaction.queue[0];
        expect(pending).toBeDefined();
        expect((pending!.data as { sourceId?: string }).sourceId).toBe('pirate_buccaneer_move');
    });

    it('交互处理函数已注册', () => {
        const handler = getInteractionHandler('pirate_buccaneer_move');
        expect(handler).toBeDefined();
    });

    it('reducer 验证：MINION_MOVED 正确移动随从', () => {
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4);
        const base0 = makeBase({ minions: [buccaneer] });
        const base1 = makeBase();
        const state = makeState({ bases: [base0, base1] });

        const moveEvt: MinionMovedEvent = {
            type: SU_EVENTS.MINION_MOVED,
            payload: { minionUid: 'buc-1', minionDefId: 'pirate_buccaneer', fromBaseIndex: 0, toBaseIndex: 1, reason: 'pirate_buccaneer' },
            timestamp: 0,
        };
        const next = reduce(state, moveEvt);
        // 基地 0 上没有随从
        expect(next.bases[0].minions.length).toBe(0);
        // 基地 1 上有 buccaneer
        expect(next.bases[1].minions.length).toBe(1);
        expect(next.bases[1].minions[0].uid).toBe('buc-1');
        expect(next.bases[1].minions[0].defId).toBe('pirate_buccaneer');
    });
});

// ============================================================================
// 远古之物 Elder Thing - 保护 + onPlay
// ============================================================================

describe('elder_thing_elder_thing 保护', () => {
    it('对手消灭远古之物被保护', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10);
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, elderThing, 0, '1', 'destroy')).toBe(true);
    });

    it('对手移动远古之物被保护', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10);
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, elderThing, 0, '1', 'move')).toBe(true);
    });

    it('己方消灭远古之物不被保护', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10);
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, elderThing, 0, '0', 'destroy')).toBe(false);
    });

    it('非 elder_thing_elder_thing 随从不被保护', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10);
        const other = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({ minions: [elderThing, other] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, other, 0, '1', 'destroy')).toBe(false);
    });
});

describe('elder_thing_elder_thing onPlay', () => {
    it('不足2个其他随从→产生 Interaction（消灭选项置灰）', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10);
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const executor = resolveAbility('elder_thing_elder_thing', 'onPlay');
        expect(executor).toBeDefined();
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'et-1', defId: 'elder_thing_elder_thing',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        // 始终走 Interaction，不足时消灭选项 disabled
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('elder_thing_elder_thing_choice');
        // 消灭选项应该被禁用
        const destroyOption = current?.data?.options?.find((o: any) => o.id === 'destroy');
        expect(destroyOption?.disabled).toBe(true);
    });

    it('≥2个其他随从→产生 Interaction 选择', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10);
        const ally1 = makeMinion('a1', 'test_minion', '0', 3);
        const ally2 = makeMinion('a2', 'test_minion', '0', 3);
        const base = makeBase({ minions: [elderThing, ally1, ally2] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const executor = resolveAbility('elder_thing_elder_thing', 'onPlay');
        expect(executor).toBeDefined();
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'et-1', defId: 'elder_thing_elder_thing',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        // 迁移后通过 Interaction 而非 CHOICE_REQUESTED 事件
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('elder_thing_elder_thing_choice');
    });

    it('CARD_TO_DECK_BOTTOM reducer 从基地移除随从到牌库底', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10);
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });

        const evt: CardToDeckBottomEvent = {
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: { cardUid: 'et-1', defId: 'elder_thing_elder_thing', ownerId: '0', reason: 'elder_thing_elder_thing' },
            timestamp: 0,
        };
        const next = reduce(state, evt);
        // 基地上不再有该随从
        expect(next.bases[0].minions.length).toBe(0);
        // 玩家牌库底多了一张
        expect(next.players['0'].deck.length).toBe(1);
        expect(next.players['0'].deck[0].uid).toBe('et-1');
    });
});

// ============================================================================
// 修格斯 (Shoggoth) - 打出限制 + onPlay
// ============================================================================

describe('elder_thing_shoggoth 打出限制', () => {
    it('己方力量<6的基地不能打出修格斯', () => {
        const ally = makeMinion('a1', 'test_minion', '0', 3);
        const base = makeBase({ minions: [ally] });
        const shoggothCard: CardInstance = { uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [base],
            players: {
                '0': makePlayer('0', { hand: [shoggothCard] }),
                '1': makePlayer('1'),
            },
        });
        const matchState = { core: state, sys: { phase: 'playCards' } } as any;
        const cmd = { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sh-1', baseIndex: 0 } } as any;
        const result = validate(matchState, cmd);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('6点力量');
    });

    it('己方力量≥6的基地可以打出修格斯', () => {
        const bigMinion = makeMinion('big', 'test_minion', '0', 6);
        const base = makeBase({ minions: [bigMinion] });
        const shoggothCard: CardInstance = { uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [base],
            players: {
                '0': makePlayer('0', { hand: [shoggothCard] }),
                '1': makePlayer('1'),
            },
        });
        const matchState = { core: state, sys: { phase: 'playCards' } } as any;
        const cmd = { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sh-1', baseIndex: 0 } } as any;
        const result = validate(matchState, cmd);
        expect(result.valid).toBe(true);
    });
});

describe('elder_thing_shoggoth onPlay', () => {
    it('产生第一个对手的 Interaction', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const base = makeBase({ minions: [shoggoth] });
        const state = makeState({
            bases: [base],
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
        });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const executor = resolveAbility('elder_thing_shoggoth', 'onPlay');
        expect(executor).toBeDefined();
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'sh-1', defId: 'elder_thing_shoggoth',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        // 迁移后通过 Interaction
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('elder_thing_shoggoth_opponent');
    });

    it('无对手时不产生事件', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const base = makeBase({ minions: [shoggoth] });
        const state = makeState({
            bases: [base],
            turnOrder: ['0'],
            players: { '0': makePlayer('0') },
        });

        const executor = resolveAbility('elder_thing_shoggoth', 'onPlay');
        expect(executor).toBeDefined();
        const result = executor!({
            state, playerId: '0', cardUid: 'sh-1', defId: 'elder_thing_shoggoth',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        expect(result.events.length).toBe(0);
    });
});

// ============================================================================
// 食人花 (Killer Plants) - 完善测试
// ============================================================================

describe('killer_plant_venus_man_trap 搜索牌库', () => {
    it('牌库有多个力量≤2随从→产生 Interaction', () => {
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5);
        const base = makeBase({ minions: [trap] });
        // 牌库中放入两个 power≤2 的随从卡
        const deckCard1: CardInstance = { uid: 'd1', defId: 'killer_plant_sprout', type: 'minion', owner: '0' };
        const deckCard2: CardInstance = { uid: 'd2', defId: 'killer_plant_sprout', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [base],
            players: { '0': makePlayer('0', { deck: [deckCard1, deckCard2] }), '1': makePlayer('1') },
        });

        const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'trap', defId: 'killer_plant_venus_man_trap',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        // 迁移后通过 Interaction 而非 CHOICE_REQUESTED 事件
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
    });

    it('牌库只有一个力量≤2随从→自动抽取+额外随从+洗牌', () => {
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5);
        const base = makeBase({ minions: [trap] });
        const deckCard: CardInstance = { uid: 'd1', defId: 'killer_plant_sprout', type: 'minion', owner: '0' };
        const bigCard: CardInstance = { uid: 'd2', defId: 'killer_plant_venus_man_trap', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [base],
            players: { '0': makePlayer('0', { deck: [deckCard, bigCard] }), '1': makePlayer('1') },
        });

        const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');
        const result = executor!({
            state, playerId: '0', cardUid: 'trap', defId: 'killer_plant_venus_man_trap',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        // 应产生 4 个事件：CARDS_DRAWN + LIMIT_MODIFIED + MINION_PLAYED + DECK_REORDERED
        expect(result.events.length).toBe(4);
        expect(result.events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect(result.events[1].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        expect(result.events[2].type).toBe(SU_EVENTS.MINION_PLAYED);
        // 验证随从被打出到此基地（baseIndex=0）
        expect((result.events[2] as any).payload.baseIndex).toBe(0);
        expect(result.events[3].type).toBe(SU_EVENTS.DECK_REORDERED);
    });

    it('牌库无合格随从→不产生事件', () => {
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5);
        const base = makeBase({ minions: [trap] });
        // 牌库中只有 power>2 的卡
        const bigCard: CardInstance = { uid: 'd1', defId: 'killer_plant_venus_man_trap', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [base],
            players: { '0': makePlayer('0', { deck: [bigCard] }), '1': makePlayer('1') },
        });

        const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');
        const result = executor!({
            state, playerId: '0', cardUid: 'trap', defId: 'killer_plant_venus_man_trap',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        // 搜索不到合格随从，但规则仍要求重洗牌库，并发送反馈提示
        expect(result.events.length).toBe(2);
        expect(result.events[0].type).toBe('su:deck_reordered');
        expect(result.events[1].type).toBe(SU_EVENTS.ABILITY_FEEDBACK);
    });
});

describe('killer_plant_budding 选择场上随从', () => {
    it('场上有随从→产生 Interaction', () => {
        const ally = makeMinion('a1', 'test_minion', '0', 3);
        const base = makeBase({ minions: [ally] });
        const state = makeState({ bases: [base] });

        const executor = resolveAbility('killer_plant_budding', 'onPlay');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'bud-1', defId: 'killer_plant_budding',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
    });

    it('场上无随从→不产生事件', () => {
        const base = makeBase();
        const state = makeState({ bases: [base] });

        const executor = resolveAbility('killer_plant_budding', 'onPlay');
        const result = executor!({
            state, playerId: '0', cardUid: 'bud-1', defId: 'killer_plant_budding',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        expect(result.events.length).toBe(0);
    });
});

describe('killer_plant_deep_roots 保护修复', () => {
    it('基地上有 deep_roots 且随从属于拥有者→对手不可移动', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
    });

    it('对手的随从不受 deep_roots 保护', () => {
        const enemy = makeMinion('e1', 'test_minion', '1', 3);
        const base = makeBase({
            minions: [enemy],
            ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, enemy, 0, '0', 'move')).toBe(false);
    });

    it('己方移动自己的随从不被保护', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, myMinion, 0, '0', 'move')).toBe(false);
    });
});

describe('killer_plant_choking_vines 触发修复', () => {
    it('消灭附着了 choking_vines 的随从', () => {
        const target = makeMinion('m1', 'test_minion', '1', 5, {
            attachedActions: [{ uid: 'cv-1', defId: 'killer_plant_choking_vines', ownerId: '0' }],
        });
        const other = makeMinion('m2', 'test_minion', '1', 2);
        const base = makeBase({ minions: [target, other] });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        const destroyEvts = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvts.length).toBe(1);
        expect((destroyEvts[0] as MinionDestroyedEvent).payload.minionUid).toBe('m1');
    });

    it('无附着 choking_vines 的随从不被消灭', () => {
        const m1 = makeMinion('m1', 'test_minion', '1', 5);
        const base = makeBase({ minions: [m1] });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        const destroyEvts = events.filter(e =>
            e.type === SU_EVENTS.MINION_DESTROYED
            && (e as MinionDestroyedEvent).payload.minionUid === 'm1'
        );
        expect(destroyEvts.length).toBe(0);
    });
});

// ============================================================================
// 海盗 - pirate_full_sail 全速航行
// ============================================================================

describe('pirate_full_sail special', () => {
    it('有己方随从→产生 Prompt（含完成选项）', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({ minions: [m1] });
        const state = makeState({ bases: [base, makeBase()] });

        const executor = resolveAbility('pirate_full_sail', 'special');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'fs-1', defId: 'pirate_full_sail',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        expect(result.events.length).toBe(0);
        // 迁移后直接创建 Interaction
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_full_sail_choose_minion');
        // 应包含 "完成移动" 选项
        const promptOptions = (current?.data as any)?.options;
        expect(promptOptions.some((o: any) => o.value.done === true)).toBe(true);
    });

    it('无己方随从→不产生事件', () => {
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3);
        const base = makeBase({ minions: [enemyMinion] });
        const state = makeState({ bases: [base, makeBase()] });

        const executor = resolveAbility('pirate_full_sail', 'special');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'fs-1', defId: 'pirate_full_sail',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        expect(result.events.length).toBe(0);
        expect(result.matchState).toBeUndefined();
    });

    it('选择完成→不产生移动事件', () => {
        // 模拟 continuation 执行"完成"选择
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({ minions: [m1] });
        const state = makeState({ bases: [base, makeBase()] });

        const handler = getInteractionHandler('pirate_full_sail_choose_minion');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { queue: [] } } } as any;
        const result = handler!(ms, '0', { done: true }, { continuationContext: { movedUids: [] } }, dummyRandom, 0);
        // 选择完成时不产生移动事件
        expect(result?.events.length).toBe(0);
    });
});

// ============================================================================
// 克苏鲁 - special_madness 疯狂卡 onPlay + 终局 VP 扣减
// ============================================================================

describe('special_madness onPlay', () => {
    it('产生2选1 Interaction（抽卡 / 返回牌堆）', () => {
        const state = makeState();
        const executor = resolveAbility('special_madness', 'onPlay');
        expect(executor).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = executor!({
            state, matchState: ms, playerId: '0', cardUid: 'mad-1', defId: 'special_madness',
            baseIndex: 0, random: dummyRandom, now: 0,
        } as AbilityContext);
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('special_madness');
        const options = current?.data?.options;
        expect(options.length).toBe(2);
        expect(options.some((o: any) => o.value.action === 'draw')).toBe(true);
        expect(options.some((o: any) => o.value.action === 'return')).toBe(true);
    });

    it('选择抽卡→产生 CARDS_DRAWN 事件', () => {
        const card1: CardInstance = { uid: 'd1', defId: 'test_action', type: 'action' };
        const card2: CardInstance = { uid: 'd2', defId: 'test_minion', type: 'minion' };
        const state = makeState({
            players: {
                '0': makePlayer('0', { deck: [card1, card2] }),
                '1': makePlayer('1'),
            },
        });
        const handler = getInteractionHandler('special_madness');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { action: 'draw' }, { continuationContext: { cardUid: 'mad-1' } }, dummyRandom, 0);
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        const drawEvt = result.events[0] as CardsDrawnEvent;
        expect(drawEvt.payload.count).toBe(2);
        expect(drawEvt.payload.cardUids).toEqual(['d1', 'd2']);
    });

    it('选择返回→产生 MADNESS_RETURNED 事件', () => {
        const state = makeState();
        const handler = getInteractionHandler('special_madness');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { action: 'return' }, { continuationContext: { cardUid: 'mad-1' } }, dummyRandom, 0);
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.MADNESS_RETURNED);
        const retEvt = result.events[0] as MadnessReturnedEvent;
        expect(retEvt.payload.playerId).toBe('0');
        expect(retEvt.payload.cardUid).toBe('mad-1');
    });
});

describe('疯狂卡终局 VP 扣减', () => {
    it('每2张疯狂卡扣1VP', () => {
        expect(madnessVpPenalty(0)).toBe(0);
        expect(madnessVpPenalty(1)).toBe(0);
        expect(madnessVpPenalty(2)).toBe(1);
        expect(madnessVpPenalty(3)).toBe(1);
        expect(madnessVpPenalty(4)).toBe(2);
        expect(madnessVpPenalty(5)).toBe(2);
    });

    it('countMadnessCards 统计手牌+牌库+弃牌堆', () => {
        const player = makePlayer('0', {
            hand: [
                { uid: 'h1', defId: 'special_madness', type: 'minion' },
                { uid: 'h2', defId: 'test_action', type: 'action' },
            ],
            deck: [
                { uid: 'dk1', defId: 'special_madness', type: 'minion' },
            ],
            discard: [
                { uid: 'dis1', defId: 'special_madness', type: 'minion' },
                { uid: 'dis2', defId: 'test_minion', type: 'minion' },
            ],
        });
        // 手牌1 + 牌库1 + 弃牌堆1 = 3张疯狂卡
        expect(countMadnessCards(player)).toBe(3);
        expect(madnessVpPenalty(countMadnessCards(player))).toBe(1);
    });
});

// ============================================================================
// 基地能力 Prompt 化测试
// ============================================================================

describe('base_haunted_house_al9000 鬼屋 Interaction 化', () => {
    it('多张手牌→产生 Interaction', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'h1', defId: 'test_a', type: 'action' },
                        { uid: 'h2', defId: 'test_b', type: 'action' },
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_haunted_house_al9000' })],
        });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_haunted_house_al9000',
            playerId: '0', minionUid: 'm1', now: 0,
        });
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('base_haunted_house_al9000');
        expect(current?.data?.options.length).toBe(2);
    });

    it('只有1张手牌→自动弃掉', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'h1', defId: 'test_a', type: 'action' }],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_haunted_house_al9000' })],
        });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_haunted_house_al9000',
            playerId: '0', minionUid: 'm1', now: 0,
        });
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
        expect((result.events[0] as CardsDiscardedEvent).payload.cardUids).toEqual(['h1']);
    });

    it('handler 执行弃牌', () => {
        const handler = getInteractionHandler('base_haunted_house_al9000');
        expect(handler).toBeDefined();
        const ms = { core: makeState(), sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { cardUid: 'h2' }, undefined, dummyRandom, 0);
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
        expect((result.events[0] as CardsDiscardedEvent).payload.cardUids).toEqual(['h2']);
    });
});

describe('base_rlyeh 拉莱耶 onTurnStart', () => {
    it('有己方随从→产生 Interaction（含不消灭选项）', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({ defId: 'base_rlyeh', minions: [m1] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_rlyeh', 'onTurnStart', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_rlyeh', playerId: '0', now: 0,
        });
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('base_rlyeh');
        // 应有 skip + 1个随从选项
        expect(current?.data?.options.length).toBe(2);
        expect(current?.data?.options[0].value.skip).toBe(true);
    });

    it('无己方随从→不产生事件', () => {
        const enemy = makeMinion('e1', 'test_minion', '1', 3);
        const base = makeBase({ defId: 'base_rlyeh', minions: [enemy] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_rlyeh', 'onTurnStart', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_rlyeh', playerId: '0', now: 0,
        });
        expect(result.events.length).toBe(0);
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeUndefined();
    });

    it('handler 选择消灭→产生 MINION_DESTROYED + VP_AWARDED', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const base = makeBase({ defId: 'base_rlyeh', minions: [m1] });
        const state = makeState({ bases: [base] });
        const handler = getInteractionHandler('base_rlyeh');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { minionUid: 'm1', baseIndex: 0 }, undefined, dummyRandom, 0);
        expect(result.events.length).toBe(2);
        expect(result.events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
        expect(result.events[1].type).toBe(SU_EVENTS.VP_AWARDED);
    });

    it('handler 选择不消灭→不产生事件', () => {
        const state = makeState({ bases: [makeBase({ defId: 'base_rlyeh' })] });
        const handler = getInteractionHandler('base_rlyeh');
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { skip: true }, undefined, dummyRandom, 0);
        expect(result.events.length).toBe(0);
    });
});

describe('base_mountains_of_madness 疯狂之山', () => {
    it('随从入场后抽疯狂卡（有疯狂牌库时）', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_mountains_of_madness' })],
            madnessDeck: ['madness_1', 'madness_2'],
            nextUid: 100,
        } as Partial<SmashUpCore>);
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_mountains_of_madness',
            playerId: '0', minionUid: 'm1', now: 0,
        });
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.MADNESS_DRAWN);
        expect((result.events[0] as MadnessDrawnEvent).payload.count).toBe(1);
    });

    it('无疯狂牌库→不产生事件', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_mountains_of_madness' })],
        });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_mountains_of_madness',
            playerId: '0', minionUid: 'm1', now: 0,
        });
        expect(result.events.length).toBe(0);
    });
});

describe('base_the_homeworld 母星', () => {
    it('随从入场后授予额外随从出牌次数', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'base_the_homeworld' })],
        });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_the_homeworld', 'onMinionPlayed', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_the_homeworld',
            playerId: '0', minionUid: 'm1', now: 0,
        });
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        const evt = result.events[0] as LimitModifiedEvent;
        expect(evt.payload.limitType).toBe('minion');
        expect(evt.payload.delta).toBe(1);
    });
});

describe('base_the_mothership 母舰 afterScoring', () => {
    it('冠军有力量≤3随从→产生 Interaction', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 2);
        const m2 = makeMinion('m2', 'test_minion', '0', 5);
        const base = makeBase({ defId: 'base_the_mothership', minions: [m1, m2] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_the_mothership',
            playerId: '0', rankings: [{ playerId: '0', power: 7, vp: 3 }], now: 0,
        });
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('base_the_mothership');
        // skip + m1(力量2) — m2(力量5) 不符合条件
        expect(current?.data?.options.length).toBe(2);
    });

    it('handler 收回随从→产生 MINION_RETURNED', () => {
        const state = makeState({ bases: [makeBase({ defId: 'base_the_mothership' })] });
        const handler = getInteractionHandler('base_the_mothership');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { minionUid: 'm1', minionDefId: 'test_minion' }, { continuationContext: { baseIndex: 0 } }, dummyRandom, 0);
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
        const ret = result.events[0] as MinionReturnedEvent;
        expect(ret.payload.minionUid).toBe('m1');
        expect(ret.payload.toPlayerId).toBe('0');
    });
});

describe('base_ninja_dojo 忍者道场 afterScoring', () => {
    it('基地有随从→产生 Interaction（含不消灭选项）', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const m2 = makeMinion('m2', 'test_minion', '1', 4);
        const base = makeBase({ defId: 'base_ninja_dojo', minions: [m1, m2] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = triggerBaseAbility('base_ninja_dojo', 'afterScoring', {
            state, matchState: ms, baseIndex: 0, baseDefId: 'base_ninja_dojo',
            playerId: '0', rankings: [{ playerId: '0', power: 3, vp: 3 }], now: 0,
        });
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('base_ninja_dojo');
        // skip + 2个随从
        expect(current?.data?.options.length).toBe(3);
    });

    it('handler 消灭随从→产生 MINION_DESTROYED', () => {
        const m1 = makeMinion('m1', 'test_minion', '1', 4);
        const base = makeBase({ defId: 'base_ninja_dojo', minions: [m1] });
        const state = makeState({ bases: [base] });
        const handler = getInteractionHandler('base_ninja_dojo');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { minionUid: 'm1', baseIndex: 0, minionDefId: 'test_minion', ownerId: '1' }, undefined, dummyRandom, 0);
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
        expect((result.events[0] as MinionDestroyedEvent).payload.minionUid).toBe('m1');
    });
});

// ============================================================================
// 科学小怪蛋 (Igor) - onMinionDiscardedFromBase 弃置触发
// ============================================================================

describe('frankenstein_igor: 基地结算弃置触发', () => {
    it('非 Igor 随从被弃时不触发（仅本随从被弃才触发）', () => {
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2);
        const target = makeMinion('t1', 'test_minion', '0', 3);
        const scoredBase = makeBase({ defId: 'base_a', minions: [igor, makeMinion('enemy1', 'enemy', '1', 5)] });
        const otherBase = makeBase({ defId: 'base_b', minions: [target] });
        const state = makeState({ bases: [scoredBase, otherBase] });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy1',
            triggerMinionDefId: 'enemy',
            random: dummyRandom,
            now: 100,
        });
        expect(result.events.length).toBe(0);
    });

    it('Igor 自身被弃时触发，自动在其他基地己方唯一随从上放指示物', () => {
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2);
        const ally = makeMinion('ally1', 'test_minion', '0', 3);
        const target = makeMinion('t1', 'test_minion', '0', 4);
        const scoredBase = makeBase({ defId: 'base_a', minions: [igor, ally] });
        const otherBase = makeBase({ defId: 'base_b', minions: [target] });
        const state = makeState({ bases: [scoredBase, otherBase] });

        // 被弃的随从是 igor1 自身 → 触发
        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor1',
            triggerMinionDefId: 'frankenstein_igor',
            random: dummyRandom,
            now: 100,
        });
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.POWER_COUNTER_ADDED);
        expect((result.events[0] as any).payload.minionUid).toBe('t1');
        expect((result.events[0] as any).payload.baseIndex).toBe(1);
    });

    it('其他基地有多个己方随从时创建交互', () => {
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2);
        const t1 = makeMinion('t1', 'test_a', '0', 3);
        const t2 = makeMinion('t2', 'test_b', '0', 4);
        const scoredBase = makeBase({ defId: 'base_a', minions: [igor] });
        const otherBase = makeBase({ defId: 'base_b', minions: [t1, t2] });
        const state = makeState({ bases: [scoredBase, otherBase] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor1',
            triggerMinionDefId: 'frankenstein_igor',
            random: dummyRandom,
            now: 100,
        });
        expect(result.events.length).toBe(0);
        expect(result.matchState).toBeDefined();
        const current = (result.matchState?.sys as any)?.interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('frankenstein_igor');
        expect(current?.data?.options.length).toBe(2);
    });

    it('被弃基地上的己方随从不作为候选目标', () => {
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2);
        const allyOnSameBase = makeMinion('ally1', 'test_minion', '0', 3);
        const scoredBase = makeBase({ defId: 'base_a', minions: [igor, allyOnSameBase] });
        const state = makeState({ bases: [scoredBase] });

        // 只有被弃基地上有己方随从，其他基地无候选 → 不触发
        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ally1',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 100,
        });
        expect(result.events.length).toBe(0);
    });

    it('雄蜂 giant_ant_drone 不会被 onMinionDiscardedFromBase 触发', () => {
        const drone = makeMinion('drone1', 'giant_ant_drone', '0', 1);
        const ally = makeMinion('ally1', 'test_minion', '0', 3);
        const scoredBase = makeBase({ defId: 'base_a', minions: [drone, ally] });
        const otherBase = makeBase({ defId: 'base_b', minions: [makeMinion('t1', 'test_b', '0', 4)] });
        const state = makeState({ bases: [scoredBase, otherBase] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ally1',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 100,
        });
        // 雄蜂仅注册 onMinionDestroyed，不应在弃置时触发防消灭交互
        const current = (result.matchState?.sys as any)?.interaction?.current;
        const hasDroneInteraction = current?.data?.sourceId === 'giant_ant_drone_prevent_destroy';
        expect(hasDroneInteraction).toBeFalsy();
    });
});

// ============================================================================
// 吸血鬼 - 自助餐 afterScoring
// ============================================================================

describe('vampire_buffet afterScoring', () => {
    it('赢家拥有 buffet 时，所有己方随从获得+1指示物', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3);
        const m2 = makeMinion('m2', 'test_minion', '0', 2);
        const m3 = makeMinion('m3', 'test_minion', '1', 1);
        const scoringBase = makeBase({
            defId: 'test_base',
            minions: [m1, m3],
        });
        const otherBase = makeBase({
            defId: 'test_base2',
            minions: [m2],
        });
        const state = makeState({
            bases: [scoringBase, otherBase],
            pendingAfterScoringSpecials: [
                { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0 },
            ],
        });

        const rankings = [
            { playerId: '0', power: 3, vp: 4 },
            { playerId: '1', power: 1, vp: 2 },
        ];

        const { events } = fireTriggers(state, 'afterScoring', {
            state, playerId: '0', baseIndex: 0, rankings, random: dummyRandom, now: 100,
        });

        const pcEvents = events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        // 应该给 m1 和 m2 各+1（m1 在计分基地，m2 在其他基地）
        expect(pcEvents.length).toBe(2);
        const uids = pcEvents.map(e => (e as any).payload.minionUid);
        expect(uids).toContain('m1');
        expect(uids).toContain('m2');
    });

    it('非赢家拥有 buffet 时不触发效果（仅 CONSUMED）', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 1);
        const m2 = makeMinion('m2', 'test_minion', '1', 5);
        const scoringBase = makeBase({
            defId: 'test_base',
            minions: [m1, m2],
        });
        const state = makeState({
            bases: [scoringBase],
            pendingAfterScoringSpecials: [
                { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0 },
            ],
        });

        const rankings = [
            { playerId: '1', power: 5, vp: 4 },
            { playerId: '0', power: 1, vp: 2 },
        ];

        const { events } = fireTriggers(state, 'afterScoring', {
            state, playerId: '0', baseIndex: 0, rankings, random: dummyRandom, now: 100,
        });

        const pcEvents = events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcEvents.length).toBe(0);
    });
});
