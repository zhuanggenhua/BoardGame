/**
 * 选择权审计修复测试
 *
 * Bug #1: elder_thing_elder_thing_choice — 选择"消灭"时应让玩家选择哪两个随从
 * Bug #2: base_temple_of_goju — 多个随从力量并列最高时应让拥有者选择
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { SmashUpCore, PlayerState, MinionOnBase, BaseInPlay, CardToDeckBottomEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility } from '../domain/baseAbilities';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { RandomFn } from '../../../engine/types';

function makeMinion(uid: string, defId: string, controller: string, power: number, overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
        ...overrides,
    };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['elder_things', 'test_b'] as [string, string],
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
// Bug #1: elder_thing_elder_thing_choice — 消灭两个随从时应让玩家选择
// ============================================================================

describe('远古之物：消灭两个随从选择权', () => {
    it('有 >2 个己方随从时，选择"消灭"应产生多选交互而非自动选前两个', () => {
        const etMinion = makeMinion('et-1', 'elder_thing_elder_thing', '0', 5);
        const m1 = makeMinion('m-1', 'test_a', '0', 2);
        const m2 = makeMinion('m-2', 'test_b', '0', 3);
        const m3 = makeMinion('m-3', 'test_c', '0', 4);
        const base = makeBase({ minions: [etMinion, m1, m2, m3] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const handler = getInteractionHandler('elder_thing_elder_thing_choice')!;
        const iData = { continuationContext: { cardUid: 'et-1', defId: 'elder_thing_elder_thing', baseIndex: 0 } };
        const result = handler(ms, '0', { choice: 'destroy' }, iData, dummyRandom, 1)!;

        // 不应直接产生消灭事件
        const destroyEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(0);

        // 应产生单选交互让玩家选择第一个要消灭的随从
        const interaction = (result.state?.sys as any)?.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data?.sourceId).toBe('elder_thing_elder_thing_destroy_first');
        expect(interaction?.playerId).toBe('0');
    });

    it('恰好 2 个己方随从时，选择"消灭"直接消灭全部（无需选择）', () => {
        const etMinion = makeMinion('et-1', 'elder_thing_elder_thing', '0', 5);
        const m1 = makeMinion('m-1', 'test_a', '0', 2);
        const m2 = makeMinion('m-2', 'test_b', '0', 3);
        const base = makeBase({ minions: [etMinion, m1, m2] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const handler = getInteractionHandler('elder_thing_elder_thing_choice')!;
        const iData = { continuationContext: { cardUid: 'et-1', defId: 'elder_thing_elder_thing', baseIndex: 0 } };
        const result = handler(ms, '0', { choice: 'destroy' }, iData, dummyRandom, 1)!;

        // 恰好 2 个，直接消灭
        const destroyEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(2);
    });

    it('只有 1 个己方随从时，选择"消灭"直接消灭该随从', () => {
        const etMinion = makeMinion('et-1', 'elder_thing_elder_thing', '0', 5);
        const m1 = makeMinion('m-1', 'test_a', '0', 2);
        const base = makeBase({ minions: [etMinion, m1] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const handler = getInteractionHandler('elder_thing_elder_thing_choice')!;
        const iData = { continuationContext: { cardUid: 'et-1', defId: 'elder_thing_elder_thing', baseIndex: 0 } };
        const result = handler(ms, '0', { choice: 'destroy' }, iData, dummyRandom, 1)!;

        const destroyEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
    });

    it('两步单选交互处理：玩家依次选择 2 个随从后正确消灭', () => {
        const m1 = makeMinion('m-1', 'test_a', '0', 2);
        const m2 = makeMinion('m-2', 'test_b', '0', 3);
        const m3 = makeMinion('m-3', 'test_c', '0', 4);
        const base = makeBase({ minions: [m1, m2, m3] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        // 第一步：选择第一个随从
        const handler1 = getInteractionHandler('elder_thing_elder_thing_destroy_first')!;
        const result1 = handler1(ms, '0', { minionUid: 'm-1', defId: 'test_a', baseIndex: 0 }, undefined, dummyRandom, 2)!;

        const destroyEvents1 = result1.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents1).toHaveLength(1);
        expect(destroyEvents1[0].payload.minionUid).toBe('m-1');

        // 应产生第二步交互
        const interaction2 = (result1.state?.sys as any)?.interaction?.current;
        expect(interaction2).toBeDefined();
        expect(interaction2?.data?.sourceId).toBe('elder_thing_elder_thing_destroy_second');

        // 第二步：选择第二个随从
        const handler2 = getInteractionHandler('elder_thing_elder_thing_destroy_second')!;
        const result2 = handler2(result1.state!, '0', { minionUid: 'm-3', defId: 'test_c', baseIndex: 0 }, interaction2?.data, dummyRandom, 3)!;

        const destroyEvents2 = result2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents2).toHaveLength(1);
        expect(destroyEvents2[0].payload.minionUid).toBe('m-3');
    });

    it('选择"放牌库底"时不消灭随从', () => {
        const etMinion = makeMinion('et-1', 'elder_thing_elder_thing', '0', 5);
        const m1 = makeMinion('m-1', 'test_a', '0', 2);
        const m2 = makeMinion('m-2', 'test_b', '0', 3);
        const m3 = makeMinion('m-3', 'test_c', '0', 4);
        const base = makeBase({ minions: [etMinion, m1, m2, m3] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const handler = getInteractionHandler('elder_thing_elder_thing_choice')!;
        const iData = { continuationContext: { cardUid: 'et-1', defId: 'elder_thing_elder_thing', baseIndex: 0 } };
        const result = handler(ms, '0', { choice: 'deckbottom' }, iData, dummyRandom, 1)!;

        const destroyEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(0);
        const deckBottomEvents = result.events.filter((e: any) => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect(deckBottomEvents).toHaveLength(1);
    });
});


// ============================================================================
// Bug #2: base_temple_of_goju — 力量并列最高时应让拥有者选择
// ============================================================================

describe('刚柔流寺庙：力量并列最高时拥有者选择', () => {
    it('某玩家有多个力量并列最高的随从时，产生选择交互', () => {
        const m1 = makeMinion('m-1', 'test_a', '0', 5);
        const m2 = makeMinion('m-2', 'test_b', '0', 5);
        const m3 = makeMinion('m-3', 'test_c', '0', 3);
        const p1m = makeMinion('p1-1', 'test_d', '1', 4);
        const base = makeBase({ defId: 'base_temple_of_goju', minions: [m1, m2, m3, p1m] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'scoring', interaction: { current: undefined, queue: [] } } } as any;

        const result = triggerBaseAbility('base_temple_of_goju', 'afterScoring', {
            state, matchState: ms, playerId: '0', baseIndex: 0, now: 1,
        });

        // P1 只有一个最强随从（力量4），直接放牌库底
        const deckBottomEvents = result.events.filter((e: any) => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect(deckBottomEvents).toHaveLength(1);
        expect((deckBottomEvents[0] as CardToDeckBottomEvent).payload.cardUid).toBe('p1-1');

        // P0 有两个力量5并列，应产生选择交互
        const interaction = (result.matchState?.sys as any)?.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data?.sourceId).toBe('base_temple_of_goju_tiebreak');
        expect(interaction?.playerId).toBe('0');
    });

    it('所有玩家都只有唯一最强随从时，直接放牌库底（无交互）', () => {
        const m1 = makeMinion('m-1', 'test_a', '0', 5);
        const m2 = makeMinion('m-2', 'test_b', '0', 3);
        const p1m = makeMinion('p1-1', 'test_c', '1', 4);
        const base = makeBase({ defId: 'base_temple_of_goju', minions: [m1, m2, p1m] });
        const state = makeState({ bases: [base] });

        const result = triggerBaseAbility('base_temple_of_goju', 'afterScoring', {
            state, matchState: undefined, playerId: '0', baseIndex: 0, now: 1,
        });

        const deckBottomEvents = result.events.filter((e: any) => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect(deckBottomEvents).toHaveLength(2);
        const uids = deckBottomEvents.map((e: any) => e.payload.cardUid);
        expect(uids).toContain('m-1');
        expect(uids).toContain('p1-1');
    });

    it('平局选择交互处理：玩家选择后正确放入牌库底', () => {
        const m1 = makeMinion('m-1', 'test_a', '0', 5);
        const m2 = makeMinion('m-2', 'test_b', '0', 5);
        const base = makeBase({ defId: 'base_temple_of_goju', minions: [m1, m2] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'scoring', interaction: { current: undefined, queue: [] } } } as any;

        const handler = getInteractionHandler('base_temple_of_goju_tiebreak')!;
        const iData = { continuationContext: { baseIndex: 0, remainingPlayers: [] } };
        const result = handler(ms, '0', { minionUid: 'm-2', baseIndex: 0, defId: 'test_b' }, iData, dummyRandom, 2)!;

        const deckBottomEvents = result.events.filter((e: any) => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect(deckBottomEvents).toHaveLength(1);
        expect((deckBottomEvents[0] as CardToDeckBottomEvent).payload.cardUid).toBe('m-2');
    });

    it('多个玩家都有平局时，链式处理', () => {
        const p0m1 = makeMinion('p0-1', 'test_a', '0', 5);
        const p0m2 = makeMinion('p0-2', 'test_b', '0', 5);
        const p1m1 = makeMinion('p1-1', 'test_c', '1', 4);
        const p1m2 = makeMinion('p1-2', 'test_d', '1', 4);
        const base = makeBase({ defId: 'base_temple_of_goju', minions: [p0m1, p0m2, p1m1, p1m2] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'scoring', interaction: { current: undefined, queue: [] } } } as any;

        const result = triggerBaseAbility('base_temple_of_goju', 'afterScoring', {
            state, matchState: ms, playerId: '0', baseIndex: 0, now: 1,
        });

        // 两个玩家都有平局，第一个交互应该是其中一个玩家
        const interaction = (result.matchState?.sys as any)?.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data?.sourceId).toBe('base_temple_of_goju_tiebreak');

        // continuationContext 应包含剩余玩家
        const ctx = interaction?.data?.continuationContext;
        expect(ctx?.remainingPlayers).toHaveLength(1);
    });
});
