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
    collectTriggers,
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
import { defaultTestRandom, runCommand } from './testRunner';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
        ...overrides,
    };
}

describe('suppressed source triggers', () => {
    it('suppressed bear_cavalry_cub_scout should not destroy moved minion', () => {
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 2, { powerModifier: 0 });
        const destBase = makeBase({ minions: [scout] });
        const srcBase = makeBase({ minions: [moved] });
        const state = makeState({
            bases: [destBase, srcBase],
            suppressedCardsUntilTurnStart: [{
                cardUid: 'scout',
                baseIndex: 0,
                suppressorPlayerId: '0',
                cardType: 'minion',
            }],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });

    it('suppressed bear_cavalry_high_ground should not destroy moved minion', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const destBase = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'hg-1', defId: 'bear_cavalry_high_ground', ownerId: '0' }],
        });
        const srcBase = makeBase({ minions: [moved] });
        const state = makeState({
            bases: [destBase, srcBase],
            suppressedCardsUntilTurnStart: [{
                cardUid: 'hg-1',
                baseIndex: 0,
                suppressorPlayerId: '0',
                cardType: 'ongoing',
            }],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});

describe('ancient_egyptians Lost Knowledge normal play regression', () => {
    it('allows Lost Knowledge to be played during playCards and opens the same choice prompt', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'lost', defId: 'ancient_egyptians_lost_knowledge', type: 'action', owner: '0' },
                        { uid: 'bury-target', defId: 'robot_warbot', type: 'minion', owner: '0' },
                    ],
                    factions: ['ancient_egyptians', 'robots'] as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_pyramids' }), makeBase({ defId: 'base_star_portal' })],
        });

        const matchState = {
            core,
            sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any,
        };
        const validation = validate(matchState as any, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'lost' },
        } as any);
        expect(validation.valid).toBe(true);

        const played = runCommand(matchState as any, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'lost' },
        } as any, defaultTestRandom);

        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        const prompt = played.finalState.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_lost_knowledge_bury');
    });
});

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

describe('afterScoring special cardUid identity', () => {
    it('同玩家同基地两张同名 afterScoring special 会按 cardUid 独立保留和消费', () => {
        const armed1 = reduce(makeState(), {
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0, cardUid: 'buffet-1' },
            timestamp: 1,
        } as any);
        const armed2 = reduce(armed1, {
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0, cardUid: 'buffet-2' },
            timestamp: 2,
        } as any);

        expect(armed2.pendingAfterScoringSpecials?.map(s => s.cardUid)).toEqual(['buffet-1', 'buffet-2']);

        const consumed1 = reduce(armed2, {
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
            payload: { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0, cardUid: 'buffet-1' },
            timestamp: 3,
        } as any);

        expect(consumed1.pendingAfterScoringSpecials?.map(s => s.cardUid)).toEqual(['buffet-2']);
    });
});

describe('giant_ant_we_are_the_champions afterScoring per-instance', () => {
    it('同一基地上的多个已 armed 实例会各自创建一个交互', () => {
        const scoringBase = makeBase({
            defId: 'base_a',
            minions: [
                makeMinion('source-a', 'giant_ant_worker', '0', 3, { powerCounters: 2 }),
                makeMinion('source-b', 'giant_ant_soldier', '0', 4, { powerCounters: 1 }),
            ],
        });
        const targetBase = makeBase({
            defId: 'base_b',
            minions: [makeMinion('target-1', 'test_other', '0', 2, { powerCounters: 0 })],
        });
        const state = makeState({
            bases: [scoringBase, targetBase],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'giant_ant_we_are_the_champions',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'champ-1',
                    minionSnapshots: [{ uid: 'source-a', defId: 'giant_ant_worker', baseIndex: 0, counterAmount: 2 }],
                },
                {
                    sourceDefId: 'giant_ant_we_are_the_champions',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'champ-2',
                    minionSnapshots: [{ uid: 'source-b', defId: 'giant_ant_soldier', baseIndex: 0, counterAmount: 1 }],
                },
            ],
        });
        const matchState = { core: state, sys: { phase: 'scoreBases', interaction: { current: undefined, queue: [] } } } as any;

        const result = fireTriggers(state, 'afterScoring', {
            state,
            matchState,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 7, vp: 4 }],
            random: dummyRandom,
            now: 100,
        });

        const current = result.matchState?.sys.interaction?.current;
        const queue = result.matchState?.sys.interaction?.queue ?? [];
        expect(current?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_snapshot_source');
        expect(queue).toHaveLength(1);
        expect(current?.id).not.toBe(queue[0]?.id);
        expect(result.events.filter(e => e.type === SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED)).toHaveLength(2);
    });
});

// ============================================================================
// 黑熊骑兵 - 保护
// ============================================================================

describe('bear_cavalry_general_ivan 保护', () => {
    it('伊万将军保护己方其他随从不被对手消灭', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6, { powerModifier: 0 });
        const ally = makeMinion('ally', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = makeBase({ minions: [ivan, ally] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, ally, 0, '1', 'destroy')).toBe(true);
    });

    it('POD 版伊万将军也会保护己方其他随从', () => {
        const ivan = makeMinion('ivan-pod', 'bear_cavalry_general_ivan_pod', '0', 6, { powerModifier: 0 });
        const ally = makeMinion('ally', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = makeBase({ minions: [ivan, ally] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, ally, 0, '1', 'destroy')).toBe(true);
    });

    it('伊万将军自身也受保护（符合 FAQ）', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6, { powerModifier: 0 });
        const base = makeBase({ minions: [ivan] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, ivan, 0, '1', 'destroy')).toBe(true);
    });

    it('不保护对手的随从', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6, { powerModifier: 0 });
        const enemy = makeMinion('enemy', 'test_minion', '1', 3, { powerModifier: 0 });
        const base = makeBase({ minions: [ivan, enemy] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, enemy, 0, '0', 'destroy')).toBe(false);
    });
});

describe('bear_cavalry_polar_commando 保护', () => {
    it('唯一己方随从时不可消灭', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4, { powerModifier: 0 });
        const base = makeBase({ minions: [commando] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(true);
    });

    it('POD 版唯一己方随从时也不可消灭', () => {
        const commando = makeMinion('pc-pod', 'bear_cavalry_polar_commando_pod', '0', 4, { powerModifier: 0 });
        const base = makeBase({ minions: [commando] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(true);
    });

    it('有其他己方随从时可被消灭', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4, { powerModifier: 0 });
        const ally = makeMinion('ally', 'test_minion', '0', 2, { powerModifier: 0 });
        const base = makeBase({ minions: [commando, ally] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(false);
    });

    it('唯一时 +2 力量', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4, { powerModifier: 0 });
        const base = makeBase({ minions: [commando] });
        const state = makeState({ bases: [base] });
        // getEffectivePower 使用卡牌定义中的 printed power（bear_cavalry_polar_commando 为 6），再叠加唯一随从 +2
        expect(getEffectivePower(state, commando, 0)).toBe(8);
    });
});

describe('bear_cavalry_superiority 保护', () => {
    it('保护基地上己方随从不被对手消灭', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'sup-1', defId: 'bear_cavalry_superiority', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, myMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
    });

    it('不保护对手的随从', () => {
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
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
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 2, { powerModifier: 0 });
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

    it('POD 版斥候也会消灭移入的低力量对手随从', () => {
        const scout = makeMinion('scout-pod', 'bear_cavalry_cub_scout_pod', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 2, { powerModifier: 0 });
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
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
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
    it('有己方随从时消灭移入的对手随从，并记录消灭者', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const destBase = makeBase({
            defId: 'base_the_field_of_honor',
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
        const destroyEvent = events.find(e => e.type === SU_EVENTS.MINION_DESTROYED) as any;
        expect(destroyEvent).toBeDefined();
        expect(destroyEvent.payload.destroyerId).toBe('0');
    });

    it('POD 版高地也会消灭移入的对手随从', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const destBase = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'hg-pod-1', defId: 'bear_cavalry_high_ground_pod', ownerId: '0' }],
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
            turnDestroyedMinions: [{ uid: 'destroyed-1', defId: 'test_minion', baseIndex: 0, owner: '1' }],
        });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state, playerId: '0', random: dummyRandom, now: 0,
        });
        expect(events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);
    });

    it('本回合该基地无对手随从被消灭→不获得 VP', () => {
        const enemy = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
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
        const minion = makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 });
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
        expect(next.turnDestroyedMinions![0]).toEqual({ uid: 'm1', defId: 'test_minion', baseIndex: 0, owner: '1' });
    });

    it('reducer: MINION_MOVED 不会把本回合刚被消灭的随从从弃牌堆拉回场上', () => {
        const minion = makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [minion] }), makeBase()],
        });

        const destroyed = reduce(state, {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'test_minion', fromBaseIndex: 0, ownerId: '1', reason: 'bear_cavalry_cub_scout' },
            timestamp: 0,
        } as MinionDestroyedEvent);

        const moved = reduce(destroyed, {
            type: SU_EVENTS.MINION_MOVED,
            payload: { minionUid: 'm1', minionDefId: 'test_minion', fromBaseIndex: 0, toBaseIndex: 1, reason: 'bear_cavalry_bear_cavalry' },
            timestamp: 1,
        } as MinionMovedEvent);

        expect(moved.players['1'].discard.some(card => card.uid === 'm1')).toBe(true);
        expect(moved.bases[1].minions.some(current => current.uid === 'm1')).toBe(false);
    });

    it('reducer: TURN_CHANGED 清空 turnDestroyedMinions', () => {
        const state = makeState({
            turnDestroyedMinions: [
                { uid: 'destroyed-1', defId: 'test_minion', baseIndex: 0, owner: '1' },
                { uid: 'destroyed-2', defId: 'test_minion2', baseIndex: 1, owner: '1' },
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

    it('POD 版控制者回合开始时也产生 BREAKPOINT_MODIFIED 事件', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            ongoingActions: [{ uid: 'og-pod-1', defId: 'killer_plant_overgrowth_pod', ownerId: '0' }],
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
        expect((bpEvents[0] as any).payload.delta).toBe(-12);
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
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
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
        const king = makeMinion('king', 'pirate_king', '0', 5, { powerModifier: 0 });
        const otherMinion = makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 });
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

    it('POD 版计分前也会移动到计分基地', () => {
        const king = makeMinion('king-pod', 'pirate_king_pod', '0', 5, { powerModifier: 0 });
        const otherMinion = makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 });
        const scoringBase = makeBase({ minions: [otherMinion] });
        const otherBase = makeBase({ minions: [king] });
        const state = makeState({ bases: [scoringBase, otherBase] });

        const { events } = fireTriggers(state, 'beforeScoring', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        const moveEvts = events.filter(e => e.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
        expect(moveEvts.length).toBe(1);
        expect(moveEvts[0].payload.minionUid).toBe('king-pod');
        expect(moveEvts[0].payload.minionDefId).toBe('pirate_king_pod');
        expect(moveEvts[0].payload.reason).toBe('pirate_king_pod');
        expect(moveEvts[0].payload.fromBaseIndex).toBe(1);
        expect(moveEvts[0].payload.toBaseIndex).toBe(0);
    });

    it('已在计分基地时不产生移动事件', () => {
        const king = makeMinion('king', 'pirate_king', '0', 5, { powerModifier: 0 });
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
        const mate = makeMinion('mate', 'pirate_first_mate', '0', 2, { powerModifier: 0 });
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

    it('POD 版计分后也会移动自身到其他基地', () => {
        const mate = makeMinion('mate-pod', 'pirate_first_mate_pod', '0', 2, { powerModifier: 0 });
        const scoringBase = makeBase({ minions: [mate] });
        const otherBase = makeBase({});
        const state = makeState({ bases: [scoringBase, otherBase] });

        const { events } = fireTriggers(state, 'afterScoring', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        const moveEvts = events.filter(e => e.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
        expect(moveEvts.length).toBe(1);
        expect(moveEvts[0].payload.minionUid).toBe('mate-pod');
        expect(moveEvts[0].payload.minionDefId).toBe('pirate_first_mate_pod');
        expect(moveEvts[0].payload.reason).toBe('pirate_first_mate_pod');
        expect(moveEvts[0].payload.toBaseIndex).toBe(1);
    });

    it('没有其他基地时不产生事件', () => {
        const mate = makeMinion('mate', 'pirate_first_mate', '0', 2, { powerModifier: 0 });
        const scoringBase = makeBase({ minions: [mate] });
        const state = makeState({ bases: [scoringBase] });

        const { events } = fireTriggers(state, 'afterScoring', {
            state, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        expect(events.filter(e => e.type === SU_EVENTS.MINION_MOVED).length).toBe(0);
    });
});

describe('pirate_first_mate afterScoring - 多实例交互', () => {
    it('多个大副会按实例各自创建 afterScoring 交互', () => {
        const state = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('mate-a', 'pirate_first_mate', '0', 2, { powerModifier: 0 }),
                        makeMinion('mate-b', 'pirate_first_mate_pod', '1', 2, { powerModifier: 0 }),
                    ],
                }),
                makeBase({}),
                makeBase({}),
            ],
        });
        const ms = {
            core: state,
            sys: { phase: 'scoreBases', interaction: { current: undefined, queue: [] } },
        } as any;

        const result = fireTriggers(state, 'afterScoring', {
            state,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 4, vp: 1 }],
            random: dummyRandom,
            now: 0,
        });

        expect(result.events).toHaveLength(0);
        const current = result.matchState?.sys.interaction.current as any;
        const queue = result.matchState?.sys.interaction.queue as any[];
        expect(current?.data?.sourceId).toBe('pirate_first_mate_choose_base');
        expect(current?.data?.continuationContext?.mateUid).toBe('mate-a');
        expect(queue).toHaveLength(1);
        expect(queue[0]?.data?.sourceId).toBe('pirate_first_mate_choose_base');
        expect(queue[0]?.data?.continuationContext?.mateUid).toBe('mate-b');
    });
});

describe('cthulhu_chosen beforeScoring', () => {
    /** 包装为 MatchState */
    function makeMS(core: SmashUpCore) {
        return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
    }

    it('有 matchState 时创建确认交互（"你可以"语义）', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
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
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
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

    it('POD 版无 matchState 时也会回退自动执行', () => {
        const chosen = makeMinion('ch1-pod', 'cthulhu_chosen_pod', '0', 3, { powerModifier: 0 });
        const scoringBase = makeBase({ minions: [chosen] });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({ uid: `mad-${i}`, defId: MADNESS_CARD_DEF_ID, type: 'madness' as const })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state, matchState: undefined as any, playerId: '0', baseIndex: 0, random: dummyRandom, now: 0,
        });
        expect(result.events.some(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
        const powerEvts = result.events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvts.length).toBe(1);
        expect(powerEvts[0].payload.minionUid).toBe('ch1-pod');
    });

    it('无疯狂牌库时回退自动执行仍获得+2力量', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
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
        const ch1 = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
        const ch2 = makeMinion('ch2', 'cthulhu_chosen', '1', 3, { powerModifier: 0 });
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
        const ch1 = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
        const otherBase = makeBase({ minions: [ch1] });
        const scoringBase = makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 5, { powerModifier: 0 })] });
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

describe('ancient_egyptians audit regressions', () => {
    function makeMS(core: SmashUpCore) {
        return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
    }

    it('Priest of Anubis 只在你有埋葬牌时获得 +2 力量', () => {
        const priest = makeMinion('priest', 'ancient_egyptians_priest_of_anubis', '0', 4, { powerModifier: 0 });
        const withOpponentBuried = makeState({
            bases: [makeBase({
                minions: [priest],
                buriedCards: [{
                    uid: 'opp-buried',
                    defId: 'robot_warbot',
                    trueOwnerId: '1',
                    controllerId: '1',
                    buriedFrom: 'hand',
                }],
            })],
        });
        expect(getEffectivePower(withOpponentBuried, priest, 0)).toBe(4);

        const ownPriest = makeMinion('priest-own', 'ancient_egyptians_priest_of_anubis', '0', 4, { powerModifier: 0 });
        const withOwnBuried = makeState({
            bases: [makeBase({
                minions: [ownPriest],
                buriedCards: [{
                    uid: 'own-buried',
                    defId: 'robot_warbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
        });
        expect(getEffectivePower(withOwnBuried, ownPriest, 0)).toBe(6);
    });

    it('Priest of Anubis does not buff other minions on the base, and each Priest only gets its own +2', () => {
        const priestA = makeMinion('priest-a', 'ancient_egyptians_priest_of_anubis', '0', 4, { powerModifier: 0 });
        const priestB = makeMinion('priest-b', 'ancient_egyptians_priest_of_anubis', '0', 4, { powerModifier: 0 });
        const ally = makeMinion('ally', 'ghost_apparition', '0', 3, { powerModifier: 0 });
        const enemy = makeMinion('enemy', 'robot_warbot', '1', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({
                minions: [priestA, priestB, ally, enemy],
                buriedCards: [{
                    uid: 'own-buried-shared',
                    defId: 'robot_microbot_alpha',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
        });

        expect(getEffectivePower(state, priestA, 0)).toBe(6);
        expect(getEffectivePower(state, priestB, 0)).toBe(6);
        expect(getEffectivePower(state, ally, 0)).toBe(3);
        expect(getEffectivePower(state, enemy, 0)).toBe(5);
    });

    it('Priest of Anubis POD 也只在你有埋葬牌时获得 +2 力量', () => {
        const priest = makeMinion('priest-pod', 'ancient_egyptians_priest_of_anubis_pod', '0', 4, { powerModifier: 0 });
        const withOpponentBuried = makeState({
            bases: [makeBase({
                minions: [priest],
                buriedCards: [{
                    uid: 'opp-buried-pod',
                    defId: 'robot_warbot',
                    trueOwnerId: '1',
                    controllerId: '1',
                    buriedFrom: 'hand',
                }],
            })],
        });
        expect(getEffectivePower(withOpponentBuried, priest, 0)).toBe(4);

        const ownPriest = makeMinion('priest-own-pod', 'ancient_egyptians_priest_of_anubis_pod', '0', 4, { powerModifier: 0 });
        const withOwnBuried = makeState({
            bases: [makeBase({
                minions: [ownPriest],
                buriedCards: [{
                    uid: 'own-buried-pod',
                    defId: 'robot_warbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
        });
        expect(getEffectivePower(withOwnBuried, ownPriest, 0)).toBe(6);
    });

    it('Pyramid Engineer onPlay 只允许翻开这里你的一张埋葬牌', () => {
        const executor = resolveAbility('ancient_egyptians_pyramid_engineer', 'onPlay');
        expect(executor).toBeDefined();

        const engineer = makeMinion('engineer', 'ancient_egyptians_pyramid_engineer', '0', 3, { powerModifier: 0 });
        const core = makeState({
            bases: [makeBase({
                minions: [engineer],
                buriedCards: [
                    {
                        uid: 'own-buried',
                        defId: 'robot_warbot',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    },
                    {
                        uid: 'opp-buried',
                        defId: 'robot_zapbot',
                        trueOwnerId: '1',
                        controllerId: '1',
                        buriedFrom: 'hand',
                    },
                ],
            })],
        });

        const result = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'engineer',
            defId: 'ancient_egyptians_pyramid_engineer',
            baseIndex: 0,
            random: dummyRandom,
            now: 1,
        });
        const prompt = result.matchState?.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_pyramid_engineer_uncover');
        const optionCardUids = prompt.data.options.map((option: any) => option.value?.cardUid).filter(Boolean);
        expect(optionCardUids).toContain('own-buried');
        expect(optionCardUids).not.toContain('opp-buried');
        const ownOption = prompt.data.options.find((option: any) => option.value?.cardUid === 'own-buried');
        expect(ownOption?.displayMode).toBe('card');
    });

    it('Pharaoh 在计分前只提示翻开这里你的一张埋葬牌', () => {
        const pharaoh = makeMinion('pharaoh', 'ancient_egyptians_pharaoh', '0', 5, { powerModifier: 0 });
        const core = makeState({
            bases: [makeBase({
                minions: [pharaoh],
                buriedCards: [
                    {
                        uid: 'own-buried',
                        defId: 'ancient_egyptians_you_can_take_it_with_you',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'play',
                    },
                    {
                        uid: 'opp-buried',
                        defId: 'robot_warbot',
                        trueOwnerId: '1',
                        controllerId: '1',
                        buriedFrom: 'hand',
                    },
                ],
            })],
        });

        const triggered = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 2,
        });
        const prompt = triggered.matchState?.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_pharaoh_before_scoring');
        const optionCardUids = prompt.data.options.map((option: any) => option.value?.cardUid).filter(Boolean);
        expect(optionCardUids).toContain('own-buried');
        expect(optionCardUids).not.toContain('opp-buried');
        const ownPromptOption = prompt.data.options.find((option: any) => option.value?.cardUid === 'own-buried');
        expect(ownPromptOption?.displayMode).toBe('card');

        const handler = getInteractionHandler('ancient_egyptians_pharaoh_before_scoring');
        expect(handler).toBeDefined();
        const ownOption = ownPromptOption;
        const resolved = handler!(triggered.matchState!, '0', ownOption.value, prompt.data, dummyRandom, 3);
        expect(resolved?.events.some((event: any) => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED)).toBe(true);
    });

    it('Ancient Curse 在目标有 +1 指示物时提供可选交互，只有确认才会移除', () => {
        const executor = resolveAbility('ancient_egyptians_ancient_curse', 'onPlay');
        expect(executor).toBeDefined();

        const target = makeMinion('curse-target', 'robot_warbot', '1', 4, { powerModifier: 0, powerCounters: 2 });
        const core = makeState({
            bases: [makeBase({ minions: [target] })],
        });

        const result = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'curse-card',
            defId: 'ancient_egyptians_ancient_curse',
            baseIndex: 0,
            targetMinionUid: 'curse-target',
            random: dummyRandom,
            now: 4,
        });
        const prompt = result.matchState?.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_ancient_curse_confirm');

        const handler = getInteractionHandler('ancient_egyptians_ancient_curse_confirm');
        expect(handler).toBeDefined();

        const skipOption = prompt.data.options.find((option: any) => option.value?.skip);
        const skipped = handler!(result.matchState!, '0', skipOption.value, prompt.data, dummyRandom, 5);
        expect(skipped.events).toHaveLength(0);

        const applyOption = prompt.data.options.find((option: any) => option.value?.apply);
        const applied = handler!(result.matchState!, '0', applyOption.value, prompt.data, dummyRandom, 6);
        const removed = applied.events.find((event: any) => event.type === SU_EVENTS.POWER_COUNTER_REMOVED) as any;
        expect(removed).toBeDefined();
        expect(removed.payload.minionUid).toBe('curse-target');
        expect(removed.payload.amount).toBe(1);
    });

    it('Pharaoh 在计分前翻开普通行动时会直接弃置而不打出', () => {
        const pharaoh = makeMinion('pharaoh-plain', 'ancient_egyptians_pharaoh', '0', 5, { powerModifier: 0 });
        const core = makeState({
            bases: [makeBase({
                minions: [pharaoh],
                buriedCards: [
                    {
                        uid: 'curse-buried',
                        defId: 'ancient_egyptians_ancient_curse',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    },
                ],
            })],
        });

        const triggered = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState: { core, sys: { phase: 'scoreBases', interaction: { current: undefined, queue: [] } } } as any,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 7,
        });
        const prompt = triggered.matchState?.sys.interaction.current as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'curse-buried');
        const handler = getInteractionHandler('ancient_egyptians_pharaoh_before_scoring');
        expect(handler).toBeDefined();

        const resolved = handler!(triggered.matchState!, '0', option.value, prompt.data, dummyRandom, 8);
        const uncoverEvent = resolved.events.find((event: any) => event.type === SU_EVENTS.BURIED_CARD_UNCOVERED) as any;
        expect(uncoverEvent?.payload?.discardWithoutPlay).toBe(true);
        expect(resolved.events.some((event: any) => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);
        expect(resolved.events.some((event: any) => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(false);
        expect(resolved.events.some((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);
    });

    it('Lost Knowledge 埋葬模式会排除自己并要求单独选择目标基地', () => {
        const executor = resolveAbility('ancient_egyptians_lost_knowledge', 'special');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'lost', defId: 'ancient_egyptians_lost_knowledge', type: 'action', owner: '0' },
                        { uid: 'bury-target', defId: 'robot_warbot', type: 'minion', owner: '0' },
                    ],
                    factions: ['ancient_egyptians', 'robots'] as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_pyramids' }), makeBase({ defId: 'base_star_portal' })],
        });

        const initial = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'lost',
            defId: 'ancient_egyptians_lost_knowledge',
            baseIndex: 0,
            random: dummyRandom,
            now: 4,
        });
        const handPrompt = initial.matchState?.sys.interaction.current as any;
        expect(handPrompt?.data?.sourceId).toBe('ancient_egyptians_lost_knowledge_bury');
        const handOptionUids = handPrompt.data.options.map((option: any) => option.value?.cardUid).filter(Boolean);
        expect(handOptionUids).toEqual(['bury-target']);

        const buryHandler = getInteractionHandler('ancient_egyptians_lost_knowledge_bury');
        expect(buryHandler).toBeDefined();
        const buryOption = handPrompt.data.options.find((option: any) => option.value?.cardUid === 'bury-target');
        const chooseBase = buryHandler!(initial.matchState!, '0', buryOption.value, handPrompt.data, dummyRandom, 5);
        const basePrompt = chooseBase.state.sys.interaction.queue[0] as any;
        expect(basePrompt?.data?.sourceId).toBe('ancient_egyptians_lost_knowledge_bury_base');
        expect(basePrompt.data.options.map((option: any) => option.value?.baseIndex)).toEqual([0, 1]);

        const baseHandler = getInteractionHandler('ancient_egyptians_lost_knowledge_bury_base');
        expect(baseHandler).toBeDefined();
        const baseOption = basePrompt.data.options.find((option: any) => option.value?.baseIndex === 1);
        const buried = baseHandler!(chooseBase.state, '0', baseOption.value, basePrompt.data, dummyRandom, 6);
        const buriedEvent = buried?.events.find((event: any) => event.type === SU_EVENTS.CARD_BURIED) as any;
        expect(buriedEvent).toBeDefined();
        expect(buriedEvent.payload.cardUid).toBe('bury-target');
        expect(buriedEvent.payload.baseIndex).toBe(1);
    });

    it('Mummy 在基地结算后可改为埋到另一个基地，而不是进入弃牌堆', () => {
        const mummy = makeMinion('mummy', 'ancient_egyptians_mummy', '0', 2, { powerModifier: 0 });
        const core = makeState({
            bases: [
                makeBase({ defId: 'base_pyramids', minions: [mummy] }),
                makeBase({ defId: 'base_star_portal' }),
            ],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 7,
        });
        const prompt = triggered.matchState?.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_mummy_after_scoring');
        expect(prompt.data.options.map((option: any) => option.value?.baseIndex).filter((index: unknown) => index !== undefined)).toEqual([1]);

        const handler = getInteractionHandler('ancient_egyptians_mummy_after_scoring');
        expect(handler).toBeDefined();
        const otherBaseOption = prompt.data.options.find((option: any) => option.value?.baseIndex === 1);
        const resolved = handler!(triggered.matchState!, '0', otherBaseOption.value, prompt.data, dummyRandom, 8);
        const buriedEvent = resolved.events.find((event: any) => event.type === SU_EVENTS.CARD_BURIED) as any;
        expect(buriedEvent).toBeDefined();
        expect(buriedEvent.payload.cardUid).toBe('mummy');
        expect(buriedEvent.payload.baseIndex).toBe(1);
    });

    it('Plague of Locusts 只让所选基地上的其他玩家随从 -1 力量', () => {
        const executor = resolveAbility('ancient_egyptians_plague_of_locusts', 'special');
        expect(executor).toBeDefined();

        const allied = makeMinion('ally', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const enemyA = makeMinion('enemy-a', 'robot_warbot', '1', 4, { powerModifier: 0 });
        const enemyB = makeMinion('enemy-b', 'robot_zapbot', '1', 2, { powerModifier: 0 });
        const untouchedEnemy = makeMinion('enemy-c', 'robot_microbot_alpha', '1', 1, { powerModifier: 0 });
        const core = makeState({
            bases: [
                makeBase({ defId: 'base_pyramids', minions: [allied, enemyA, enemyB] }),
                makeBase({ defId: 'base_star_portal', minions: [untouchedEnemy] }),
            ],
        });

        const initial = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'plague',
            defId: 'ancient_egyptians_plague_of_locusts',
            baseIndex: 0,
            random: dummyRandom,
            now: 9,
        });
        const prompt = initial.matchState?.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_plague_of_locusts');

        const handler = getInteractionHandler('ancient_egyptians_plague_of_locusts');
        expect(handler).toBeDefined();
        const targetBaseOption = prompt.data.options.find((option: any) => option.value?.baseIndex === 0);
        const resolved = handler!(initial.matchState!, '0', targetBaseOption.value, prompt.data, dummyRandom, 10);
        const tempPowerEvents = resolved.events.filter((event: any) => event.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(tempPowerEvents).toHaveLength(2);
        expect(tempPowerEvents.map(event => event.payload.minionUid).sort()).toEqual(['enemy-a', 'enemy-b']);
        expect(tempPowerEvents.every(event => event.payload.amount === -1 && event.payload.baseIndex === 0)).toBe(true);
    });

    it('Mummy Strength 先选随从，再按所选随从所在基地是否有埋葬牌决定 +4 或 +2', () => {
        const executor = resolveAbility('ancient_egyptians_mummy_strength', 'onPlay');
        expect(executor).toBeDefined();

        const empowered = makeMinion('empowered', 'ancient_egyptians_mummy', '0', 2, { powerModifier: 0 });
        const other = makeMinion('other', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 });
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_pyramids',
                    minions: [empowered],
                    buriedCards: [{
                        uid: 'opp-buried',
                        defId: 'robot_warbot',
                        trueOwnerId: '1',
                        controllerId: '1',
                        buriedFrom: 'hand',
                    }],
                }),
                makeBase({ defId: 'base_star_portal', minions: [other] }),
            ],
        });

        const initial = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'mummy-strength',
            defId: 'ancient_egyptians_mummy_strength',
            baseIndex: 0,
            random: dummyRandom,
            now: 11,
        });
        const targetPrompt = initial.matchState?.sys.interaction.current as any;
        expect(targetPrompt?.data?.sourceId).toBe('ancient_egyptians_mummy_strength_target');
        expect(targetPrompt.data.options.map((option: any) => option.value?.minionUid).filter(Boolean).sort()).toEqual(['empowered', 'other']);

        const targetHandler = getInteractionHandler('ancient_egyptians_mummy_strength_target');
        expect(targetHandler).toBeDefined();
        const empoweredOption = targetPrompt.data.options.find((option: any) => option.value?.minionUid === 'empowered');
        const empoweredResolved = targetHandler!(initial.matchState!, '0', empoweredOption.value, targetPrompt.data, dummyRandom, 12);
        const empoweredEvent = empoweredResolved.events.find((event: any) => event.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent | undefined;
        expect(empoweredEvent?.payload.amount).toBe(4);
        expect(empoweredEvent?.payload.minionUid).toBe('empowered');
        expect(empoweredEvent?.payload.baseIndex).toBe(0);

        const otherOption = targetPrompt.data.options.find((option: any) => option.value?.minionUid === 'other');
        const otherResolved = targetHandler!(initial.matchState!, '0', otherOption.value, targetPrompt.data, dummyRandom, 13);
        const otherEvent = otherResolved.events.find((event: any) => event.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent | undefined;
        expect(otherEvent?.payload.amount).toBe(2);
        expect(otherEvent?.payload.minionUid).toBe('other');
        expect(otherEvent?.payload.baseIndex).toBe(1);
    });

    it('Tomb Trap 翻开后可消灭所选的力量≤4随从', () => {
        const executor = resolveAbility('ancient_egyptians_tomb_trap', 'onUncover');
        expect(executor).toBeDefined();

        const doomed = makeMinion('doomed', 'test_small_minion', '1', 4, { powerModifier: 0 });
        const tooLarge = makeMinion('too-large', 'test_big_minion', '1', 5, { powerModifier: 0 });
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_pyramids',
                    minions: [doomed, tooLarge],
                }),
            ],
        });

        const initial = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'tomb-trap',
            defId: 'ancient_egyptians_tomb_trap',
            baseIndex: 0,
            random: dummyRandom,
            now: 14,
        });
        const prompt = initial.matchState?.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_tomb_trap');
        expect(prompt.data.options.map((option: any) => option.value?.minionUid).filter(Boolean)).toEqual(['doomed']);

        const handler = getInteractionHandler('ancient_egyptians_tomb_trap');
        expect(handler).toBeDefined();
        const targetOption = prompt.data.options.find((option: any) => option.value?.minionUid === 'doomed');
        const resolved = handler!(initial.matchState!, '0', targetOption.value, prompt.data, dummyRandom, 15);
        const destroyEvent = resolved.events.find((event: any) => event.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent | undefined;
        expect(destroyEvent?.payload.minionUid).toBe('doomed');
        expect(destroyEvent?.payload.fromBaseIndex).toBe(0);
    });

    it('Seal the Tomb 埋葬模式不会把自己也当成可埋葬手牌', () => {
        const executor = resolveAbility('ancient_egyptians_seal_the_tomb', 'onPlay');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'seal', defId: 'ancient_egyptians_seal_the_tomb', type: 'action', owner: '0' } as any,
                        { uid: 'bury-me', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' } as any,
                    ],
                    factions: ['ancient_egyptians', 'robots'] as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_pyramids' })],
        });

        const initial = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'seal',
            defId: 'ancient_egyptians_seal_the_tomb',
            baseIndex: 0,
            random: dummyRandom,
            now: 16,
        });
        const modePrompt = initial.matchState?.sys.interaction.current as any;
        expect(modePrompt?.data?.sourceId).toBe('ancient_egyptians_seal_the_tomb_mode');

        const modeHandler = getInteractionHandler('ancient_egyptians_seal_the_tomb_mode');
        expect(modeHandler).toBeDefined();
        const buryOption = modePrompt.data.options.find((option: any) => option.value?.mode === 'bury');
        const chooseHand = modeHandler!(initial.matchState!, '0', buryOption.value, modePrompt.data, dummyRandom, 17);
        const buryPrompt = chooseHand.state.sys.interaction.queue[0] as any;
        expect(buryPrompt?.data?.sourceId).toBe('ancient_egyptians_seal_the_tomb_bury');
        expect(buryPrompt.data.options.map((option: any) => option.value?.cardUid).filter(Boolean)).toEqual(['bury-me']);
    });

    it('Seal the Tomb 翻开模式只提供同一基地且属于你的埋葬牌', () => {
        const executor = resolveAbility('ancient_egyptians_seal_the_tomb', 'onPlay');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['ancient_egyptians', 'robots'] as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_pyramids',
                    buriedCards: [
                        {
                            uid: 'own-here',
                            defId: 'ancient_egyptians_you_can_take_it_with_you',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'play',
                        },
                        {
                            uid: 'opp-here',
                            defId: 'robot_warbot',
                            trueOwnerId: '1',
                            controllerId: '1',
                            buriedFrom: 'hand',
                        },
                    ],
                }),
                makeBase({
                    defId: 'base_star_portal',
                    buriedCards: [
                        {
                            uid: 'own-there',
                            defId: 'robot_microbot_alpha',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'hand',
                        },
                    ],
                }),
            ],
        });

        const initial = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'seal',
            defId: 'ancient_egyptians_seal_the_tomb',
            baseIndex: 0,
            random: dummyRandom,
            now: 14,
        });
        const modePrompt = initial.matchState?.sys.interaction.current as any;
        expect(modePrompt?.data?.sourceId).toBe('ancient_egyptians_seal_the_tomb_mode');

        const modeHandler = getInteractionHandler('ancient_egyptians_seal_the_tomb_mode');
        expect(modeHandler).toBeDefined();
        const uncoverOption = modePrompt.data.options.find((option: any) => option.value?.mode === 'uncover');
        const chooseBuried = modeHandler!(initial.matchState!, '0', uncoverOption.value, modePrompt.data, dummyRandom, 15);
        const buriedPrompt = chooseBuried.state.sys.interaction.queue[0] as any;
        expect(buriedPrompt?.data?.sourceId).toBe('ancient_egyptians_seal_the_tomb_uncover');
        const optionCardUids = buriedPrompt.data.options.map((option: any) => option.value?.cardUid).filter(Boolean);
        expect(optionCardUids).toEqual(['own-here']);
        expect(buriedPrompt.data.options.every((option: any) => option.displayMode === 'card')).toBe(true);
    });
});

describe('samurai_pod audit regressions', () => {
    function makeMS(core: SmashUpCore) {
        return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
    }

    it('Ronin POD 在自己是该基地唯一己方随从时会提供可选的两个 +1 指示物交互', () => {
        const executor = resolveAbility('samurai_ronin_pod', 'onPlay');
        expect(executor).toBeDefined();

        const ronin = makeMinion('ronin-pod', 'samurai_ronin_pod', '0', 3, { powerModifier: 0 });
        const core = makeState({
            bases: [makeBase({ minions: [ronin] })],
        });

        const prompted = executor!({
            state: core,
            matchState: makeMS(core),
            playerId: '0',
            cardUid: 'ronin-pod',
            defId: 'samurai_ronin_pod',
            baseIndex: 0,
            random: dummyRandom,
            now: 101,
        });
        const prompt = prompted.matchState?.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('samurai_ronin_pod');

        const yesOption = prompt.data.options.find((option: any) => option.value?.apply === true);
        expect(yesOption).toBeDefined();

        const handler = getInteractionHandler('samurai_ronin_pod');
        expect(handler).toBeDefined();
        const resolved = handler!(prompted.matchState!, '0', yesOption.value, prompt.data, dummyRandom, 102);
        const counterEvents = resolved.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any[];

        expect(counterEvents).toHaveLength(1);
        expect(counterEvents[0]?.payload?.amount).toBe(2);
        expect(counterEvents.every(event => event.payload.minionUid === 'ronin-pod')).toBe(true);
    });

    it('Samurai-Chan POD 在自己从场上进入弃牌堆后会抓一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [{ uid: 'draw-pod-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_a',
                minions: [makeMinion('chan-pod-1', 'samurai_samurai_chan_pod', '0', 2, { powerModifier: 0 })],
            })],
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMS(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('chan-pod-1', 'samurai_samurai_chan_pod', '0', 2, { powerModifier: 0 }),
            triggerMinionUid: 'chan-pod-1',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            random: dummyRandom,
            now: 103,
        });

        const drawEvent = result.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(1);
    });
});

describe('werewolf beforeScoring - 多实例触发', () => {
    it('loup_garou 在触发时即使战力被降到 0 也仍会正常结算', () => {
        const wolf = makeMinion('wolf-zero', 'werewolf_loup_garou', '0', 4, { powerModifier: -4 });
        const ally = makeMinion('ally-1', 'werewolf_howler', '0', 2, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [wolf, ally] })],
        });

        expect(getEffectivePower(state, wolf, 0)).toBe(0);

        const queued = collectTriggers(state, 'beforeScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 100,
        });

        expect(queued).toBeDefined();
        const wolfTriggers = (queued as any).payload.triggers.filter((t: any) => t.sourceDefId === 'werewolf_loup_garou');
        expect(wolfTriggers).toHaveLength(1);
        expect(wolfTriggers[0]?.sourceCardUid).toBe('wolf-zero');

        const { events } = fireTriggers(state, 'beforeScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 100,
        });

        const buffEvent = events.find((event) =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && (event as TempPowerAddedEvent).payload.minionUid === 'wolf-zero'
        ) as TempPowerAddedEvent | undefined;

        expect(buffEvent).toBeDefined();
        expect(buffEvent?.payload.amount).toBe(2);

        const resolvedState = events.reduce((core, event) => reduce(core, event), state);
        const resolvedWolf = resolvedState.bases[0].minions.find((minion) => minion.uid === 'wolf-zero');
        expect(resolvedWolf).toBeDefined();
        expect(getEffectivePower(resolvedState, resolvedWolf!, 0)).toBe(2);
    });

    it('多个 loup_garou 会各自产生独立 beforeScoring trigger', () => {
        const wolf1 = makeMinion('wolf1', 'werewolf_loup_garou', '0', 4, { powerModifier: 0 });
        const wolf2 = makeMinion('wolf2', 'werewolf_loup_garou', '1', 4, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [wolf1, wolf2] })],
        });

        const queued = collectTriggers(state, 'beforeScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 100,
        });

        expect(queued).toBeDefined();
        const triggers = (queued as any).payload.triggers;
        expect(triggers).toHaveLength(2);
        expect(triggers.map((t: any) => t.sourceCardUid)).toEqual(['wolf1', 'wolf2']);
    });

    it('多个 pack_alpha 会各自产生独立 beforeScoring trigger', () => {
        const alpha1 = makeMinion('alpha1', 'werewolf_pack_alpha', '0', 3, { powerModifier: 0 });
        const alpha2 = makeMinion('alpha2', 'werewolf_pack_alpha', '0', 3, { powerModifier: 0 });
        const ally = makeMinion('ally1', 'werewolf_howler', '0', 2, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [alpha1, alpha2, ally] })],
        });

        const queued = collectTriggers(state, 'beforeScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 100,
        });

        expect(queued).toBeDefined();
        const triggers = (queued as any).payload.triggers.filter((t: any) => t.sourceDefId === 'werewolf_pack_alpha');
        expect(triggers).toHaveLength(2);
        expect(triggers.map((t: any) => t.sourceCardUid)).toEqual(['alpha1', 'alpha2']);
    });
});

describe('elder_thing_the_price_of_power special 能力', () => {
    it('对手有随从且手牌有疯狂卡时给己方随从加力量', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 4, { powerModifier: 0 });
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
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 4, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_minion', '1', 4, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
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

    it('基地替换后应清除该位置残留的 before/afterScoring 标记', () => {
        const state = makeState({
            bases: [makeBase({ defId: 'old_base' })],
            baseDeck: ['new_base'],
            beforeScoringTriggeredBases: [0],
            afterScoringTriggeredBases: [0],
        });

        const evt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base' },
            timestamp: 0,
        };

        const next = reduce(state, evt);
        expect(next.beforeScoringTriggeredBases).toBeUndefined();
        expect(next.afterScoringTriggeredBases).toBeUndefined();
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

    it('计分清场后插入替换基地时，后续基地上的泰坦索引应跟随回补', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'old_base' }),
                makeBase({ defId: 'follow_base' }),
            ],
            baseDeck: ['new_base'],
            titans: [{
                uid: 't-mergacon',
                defId: 'changerbots_mergacon',
                faction: 'changerbots' as any,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            }],
        });

        const afterClear = reduce(state, {
            type: SU_EVENTS.BASE_CLEARED,
            payload: { baseIndex: 0, baseDefId: 'old_base' },
            timestamp: 0,
        } as any);
        expect(afterClear.titans?.find(t => t.uid === 't-mergacon')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });

        const afterReplace = reduce(afterClear, {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'old_base', newBaseDefId: 'new_base' },
            timestamp: 1,
        } as any);

        expect(afterReplace.titans?.find(t => t.uid === 't-mergacon')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
        expect(afterReplace.bases[1].defId).toBe('follow_base');
    });
});

// ============================================================================
// 海盗 Buccaneer - onMinionDestroyed 触发器（被消灭→移动）
// ============================================================================

describe('pirate_buccaneer 触发器：被消灭→移动', () => {
    it('两个基地时自动移动（产生 MINION_MOVED）', () => {
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 });
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

    it('POD 版两个基地时也会自动移动', () => {
        const buccaneer = makeMinion('buc-pod-1', 'pirate_buccaneer_pod', '0', 4, { powerModifier: 0 });
        const base0 = makeBase({ minions: [buccaneer] });
        const base1 = makeBase();
        const state = makeState({ bases: [base0, base1] });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-pod-1',
            triggerMinionDefId: 'pirate_buccaneer_pod',
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.length).toBe(1);
        const moved = result.events[0] as MinionMovedEvent;
        expect(moved.type).toBe(SU_EVENTS.MINION_MOVED);
        expect(moved.payload.minionUid).toBe('buc-pod-1');
        expect(moved.payload.minionDefId).toBe('pirate_buccaneer_pod');
        expect(moved.payload.fromBaseIndex).toBe(0);
        expect(moved.payload.toBaseIndex).toBe(1);
        expect(moved.payload.reason).toBe('pirate_buccaneer_pod');
    });

    it('无其他基地时不触发（正常消灭）', () => {
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 });
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
        const minion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 });
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
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 });
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
        const buccaneer = makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 });
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
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, elderThing, 0, '1', 'destroy')).toBe(true);
    });

    it('对手移动远古之物被保护', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, elderThing, 0, '1', 'move')).toBe(true);
    });

    it('己方消灭远古之物不被保护', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const base = makeBase({ minions: [elderThing] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, elderThing, 0, '0', 'destroy')).toBe(false);
    });

    it('非 elder_thing_elder_thing 随从不被保护', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const other = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = makeBase({ minions: [elderThing, other] });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, other, 0, '1', 'destroy')).toBe(false);
    });
});

describe('elder_thing_elder_thing onPlay', () => {
    it('不足2个其他随从→产生 Interaction（消灭选项置灰）', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
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
        expect(current?.data?.targetType).toBe('button');
        // 消灭选项应该被禁用
        const destroyOption = current?.data?.options?.find((o: any) => o.id === 'destroy');
        expect(destroyOption?.disabled).toBe(true);
    });

    it('≥2个其他随从→产生 Interaction 选择', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const ally1 = makeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 });
        const ally2 = makeMinion('a2', 'test_minion', '0', 3, { powerModifier: 0 });
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
        expect(current?.data?.targetType).toBe('button');
    });

    it('CARD_TO_DECK_BOTTOM reducer 从基地移除随从到牌库底', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
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
        const ally = makeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        const bigMinion = makeMinion('big', 'test_minion', '0', 6, { powerModifier: 0 });
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
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
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
        expect(current?.data?.targetType).toBe('button');
    });

    it('无对手时不产生事件', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
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
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5, { powerModifier: 0 });
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
        expect(current?.data?.sourceId).toBe('killer_plant_venus_man_trap_search');
        expect(current?.data?.targetType).toBe('generic');
        expect(current?.data?.autoRefresh).toBe('deck');
    });

    it('牌库只有一个力量≤2随从→自动抽取+额外随从+洗牌', () => {
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5, { powerModifier: 0 });
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
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5, { powerModifier: 0 });
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
        const ally = makeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = makeBase({
            minions: [myMinion],
            ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
    });

    it('对手的随从不受 deep_roots 保护', () => {
        const enemy = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const base = makeBase({
            minions: [enemy],
            ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
        });
        const state = makeState({ bases: [base] });
        expect(isMinionProtected(state, enemy, 0, '0', 'move')).toBe(false);
    });

    it('己方移动自己的随从不被保护', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        const other = makeMinion('m2', 'test_minion', '1', 2, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '1', 5, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        expect(current?.data?.targetType).toBe('button');
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

    it('选择返回→返回疯狂牌并获得 1 个额外行动额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });
        const handler = getInteractionHandler('special_madness');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { action: 'return' }, { continuationContext: { cardUid: 'mad-1' } }, dummyRandom, 0);
        expect(result.events.length).toBe(2);
        expect(result.events[0].type).toBe(SU_EVENTS.MADNESS_RETURNED);
        const retEvt = result.events[0] as MadnessReturnedEvent;
        expect(retEvt.payload.playerId).toBe('0');
        expect(retEvt.payload.cardUid).toBe('mad-1');
        expect(result.events[1].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        expect((result.events[1] as LimitModifiedEvent).payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            delta: 1,
            reason: 'special_madness',
        });

        const next = result.events.reduce((core, event) => reduce(core, event as any), state);
        expect(next.players['0'].actionLimit).toBe(state.players['0'].actionLimit + 1);
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
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        const enemy = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const base = makeBase({ defId: 'base_rlyeh', minions: [m1] });
        const state = makeState({ bases: [base] });
        const handler = getInteractionHandler('base_rlyeh');
        expect(handler).toBeDefined();
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(ms, '0', { minionUid: 'm1', baseIndex: 0 }, undefined, dummyRandom, 0);
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
        const followup = triggerExtendedBaseAbility('base_rlyeh', 'onMinionDestroyed', {
            state,
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
            playerId: '0',
            destroyerId: '0',
            controllerId: '0',
            reason: 'base_rlyeh',
            now: 1,
        });
        expect(followup.events).toHaveLength(1);
        expect(followup.events[0].type).toBe(SU_EVENTS.VP_AWARDED);
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
        const m1 = makeMinion('m1', 'test_minion', '0', 2, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_minion', '0', 5, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_minion', '1', 4, { powerModifier: 0 });
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
        const m1 = makeMinion('m1', 'test_minion', '1', 4, { powerModifier: 0 });
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
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 });
        const target = makeMinion('t1', 'test_minion', '0', 3, { powerModifier: 0 });
        const scoredBase = makeBase({ defId: 'base_a', minions: [igor, makeMinion('enemy1', 'enemy', '1', 5, { powerModifier: 0 })] });
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
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 });
        const ally = makeMinion('ally1', 'test_minion', '0', 3, { powerModifier: 0 });
        const target = makeMinion('t1', 'test_minion', '0', 4, { powerModifier: 0 });
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

    it('POD 版 Igor 自身被弃时也会触发放置指示物', () => {
        const igor = makeMinion('igor-pod-1', 'frankenstein_igor_pod', '0', 2, { powerModifier: 0 });
        const ally = makeMinion('ally1', 'test_minion', '0', 3, { powerModifier: 0 });
        const target = makeMinion('t1', 'test_minion', '0', 4, { powerModifier: 0 });
        const scoredBase = makeBase({ defId: 'base_a', minions: [igor, ally] });
        const otherBase = makeBase({ defId: 'base_b', minions: [target] });
        const state = makeState({ bases: [scoredBase, otherBase] });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor-pod-1',
            triggerMinionDefId: 'frankenstein_igor_pod',
            random: dummyRandom,
            now: 100,
        });
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe(SU_EVENTS.POWER_COUNTER_ADDED);
        expect((result.events[0] as any).payload.minionUid).toBe('t1');
        expect((result.events[0] as any).payload.baseIndex).toBe(1);
        expect((result.events[0] as any).payload.reason).toBe('frankenstein_igor_pod');
    });

    it('其他基地有多个己方随从时创建交互', () => {
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 });
        const t1 = makeMinion('t1', 'test_a', '0', 3, { powerModifier: 0 });
        const t2 = makeMinion('t2', 'test_b', '0', 4, { powerModifier: 0 });
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
        const igor = makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerModifier: 0 });
        const allyOnSameBase = makeMinion('ally1', 'test_minion', '0', 3, { powerModifier: 0 });
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
        const drone = makeMinion('drone1', 'giant_ant_drone', '0', 1, { powerModifier: 0 });
        const ally = makeMinion('ally1', 'test_minion', '0', 3, { powerModifier: 0 });
        const scoredBase = makeBase({ defId: 'base_a', minions: [drone, ally] });
        const otherBase = makeBase({ defId: 'base_b', minions: [makeMinion('t1', 'test_b', '0', 4, { powerModifier: 0 })] });
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

describe('innsmouth_return_to_the_sea afterScoring per-instance', () => {
    it('creates one interaction per armed cardUid without merging instances', () => {
        const scoringBase = makeBase({
            defId: 'base_crypt',
            minions: [
                makeMinion('locals-a', 'innsmouth_the_locals', '0', 2),
                makeMinion('locals-b', 'innsmouth_the_locals', '0', 2),
            ],
        });
        const state = makeState({
            bases: [scoringBase, makeBase({ defId: 'base_other' })],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'innsmouth_return_to_the_sea',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'return-sea-1',
                },
                {
                    sourceDefId: 'innsmouth_return_to_the_sea_pod',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'return-sea-2',
                },
            ],
        });
        const matchState = { core: state, sys: { phase: 'scoreBases', interaction: { current: undefined, queue: [] } } } as any;

        const result = fireTriggers(state, 'afterScoring', {
            state,
            matchState,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 4, vp: 4 }],
            random: dummyRandom,
            now: 200,
        });

        const current = result.matchState?.sys.interaction?.current;
        const queue = result.matchState?.sys.interaction?.queue ?? [];
        const interactionIds = [current?.id, queue[0]?.id].filter((id): id is string => typeof id === 'string');

        expect(current).toBeDefined();
        expect(queue).toHaveLength(1);
        expect(current?.id).not.toBe(queue[0]?.id);
        expect(interactionIds).toHaveLength(2);
        expect(interactionIds.some(id => id.includes('return-sea-1'))).toBe(true);
        expect(interactionIds.some(id => id.includes('return-sea-2'))).toBe(true);
        expect(result.events.filter(e => e.type === SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED)).toHaveLength(2);
    });
});

describe('vampire_buffet afterScoring', () => {
    it('赢家拥有 buffet 时，所有己方随从获得+1指示物', () => {
        const m1 = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_minion', '0', 2, { powerModifier: 0 });
        const m3 = makeMinion('m3', 'test_minion', '1', 1, { powerModifier: 0 });
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
                { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0, cardUid: 'buffet-1' },
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
        const m1 = makeMinion('m1', 'test_minion', '0', 1, { powerModifier: 0 });
        const m2 = makeMinion('m2', 'test_minion', '1', 5, { powerModifier: 0 });
        const scoringBase = makeBase({
            defId: 'test_base',
            minions: [m1, m2],
        });
        const state = makeState({
            bases: [scoringBase],
            pendingAfterScoringSpecials: [
                { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0, cardUid: 'buffet-1' },
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

describe('bear_cavalry_bear_necessities_pod 限制', () => {
    it('激活后会禁止受影响对手打出额外随从和额外行动', () => {
        const restrictedBase = makeBase({
            minions: [makeMinion('enemy-on-base', 'test_minion', '1', 3, { powerModifier: 0 })],
            ongoingActions: [{ uid: 'bn-1', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any],
        });
        const state = makeState({
            currentPlayerIndex: 1,
            bases: [restrictedBase, makeBase()],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    minionsPlayed: 1,
                    minionLimit: 2,
                    actionsPlayed: 1,
                    actionLimit: 2,
                    hand: [
                        { uid: 'm-extra', defId: 'dino_war_raptor', type: 'minion', owner: '1' } as CardInstance,
                        { uid: 'a-extra', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '1' } as CardInstance,
                    ],
                }),
            },
        });
        const matchState = { core: state, sys: { phase: 'playCards' } } as any;

        const minionResult = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'm-extra', baseIndex: 1 },
        } as any);
        expect(minionResult.valid).toBe(false);
        expect(minionResult.error).toContain('额外牌');

        const actionResult = validate(matchState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'a-extra' },
        } as any);
        expect(actionResult.valid).toBe(false);
        expect(actionResult.error).toContain('额外牌');
    });

    it('拥有者下回合开始时会销毁已激活的口粮POD', () => {
        const state = makeState({
            bases: [makeBase({
                ongoingActions: [{ uid: 'bn-1', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any],
            })],
        });

        const ownerTurnStart = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 12,
        });
        expect(ownerTurnStart.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({ cardUid: 'bn-1' }),
            }),
        ]));

        const opponentTurnStart = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: dummyRandom,
            now: 13,
        });
        const detachedCount = opponentTurnStart.events.filter(e => e.type === SU_EVENTS.ONGOING_DETACHED).length;
        expect(detachedCount).toBe(0);
    });
});

describe('bear_cavalry_superiority_pod 保护模式', () => {
    it('protect 分支开启保护，且在拥有者下回合开始后失效', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'sup-1', defId: 'bear_cavalry_superiority_pod', ownerId: '0', talentUsed: true, metadata: {} } as any],
            })],
        });
        const handler = getInteractionHandler('bear_cavalry_superiority_pod_talent');
        expect(handler).toBeDefined();

        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const protectResult = handler!(ms, '0', 'protect', { cardUid: 'sup-1' }, dummyRandom, 0);
        expect(isMinionProtected(protectResult.state.core, myMinion, 0, '1', 'destroy')).toBe(true);

        const afterTurnStart = reduce(protectResult.state.core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: 1,
        } as TurnStartedEvent);
        expect(isMinionProtected(afterTurnStart, myMinion, 0, '1', 'destroy')).toBe(false);
    });

    it('draw 分支会关闭保护标记并正常摸牌', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const drawCard: CardInstance = { uid: 'd1', defId: 'test_action', type: 'action' } as any;
        const state = makeState({
            players: {
                '0': makePlayer('0', { deck: [drawCard] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'sup-1', defId: 'bear_cavalry_superiority_pod', ownerId: '0', talentUsed: true, metadata: { superiorityProtect: true } } as any],
            })],
        });
        const handler = getInteractionHandler('bear_cavalry_superiority_pod_talent');
        expect(handler).toBeDefined();

        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const drawResult = handler!(ms, '0', 'draw', { cardUid: 'sup-1' }, dummyRandom, 0);
        expect(drawResult.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(isMinionProtected(drawResult.state.core, myMinion, 0, '1', 'destroy')).toBe(false);
    });
});

describe('bear_cavalry_bear_rides_you_pod 交互选项', () => {
    it('移动己方随从后仅提供基地压制与跳过两个有效选项', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const fromBase = makeBase({ minions: [myMinion] });
        const toBase = makeBase({
            minions: [makeMinion('e1', 'test_minion', '1', 2, { powerModifier: 0 })],
            ongoingActions: [{ uid: 'oa1', defId: 'bear_cavalry_superiority_pod', ownerId: '1' } as any],
        });
        const state = makeState({ bases: [fromBase, toBase] });
        const handler = getInteractionHandler('bear_cavalry_bear_rides_you_pod_choose_base');
        expect(handler).toBeDefined();

        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
        const result = handler!(
            ms,
            '0',
            { baseIndex: 1 },
            { continuationContext: { minionUid: 'm1', minionDefId: 'test_minion', fromBase: 0, isMyMinion: true } },
            dummyRandom,
            0,
        );
        expect(result.events.some(e => e.type === SU_EVENTS.MINION_MOVED)).toBe(true);

        const pending = result.state.sys.interaction.current ?? result.state.sys.interaction.queue[0];
        expect(pending).toBeDefined();
        const kinds = (pending?.data?.options ?? [])
            .map((option: any) => option?.value?.kind)
            .filter((kind: unknown) => typeof kind === 'string');

        expect(kinds).toContain('base');
        expect(kinds).toContain('minion');
        expect(kinds).toContain('ongoing');
        expect(kinds).toContain('skip');
        expect(kinds).not.toContain('attached');
        expect(kinds).not.toContain('titan');
    });
});
