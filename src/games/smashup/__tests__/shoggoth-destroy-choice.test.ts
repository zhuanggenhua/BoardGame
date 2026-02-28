/**
 * 修格斯 (Shoggoth) 消灭随从选择权测试
 *
 * 验证：对手拒绝抽疯狂卡时，由修格斯控制者（而非自动选最弱）选择消灭哪个随从
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { SmashUpCore, PlayerState, MinionOnBase, BaseInPlay, MinionDestroyedEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, resolveAbility } from '../domain/abilityRegistry';
import type { AbilityContext } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
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

/** 触发修格斯 onPlay 并返回第一个对手交互 */
function triggerShoggothOnPlay(state: SmashUpCore, baseIndex = 0) {
    const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
    const executor = resolveAbility('elder_thing_shoggoth', 'onPlay')!;
    return executor({
        state, matchState: ms, playerId: '0', cardUid: 'sh-1', defId: 'elder_thing_shoggoth',
        baseIndex, random: dummyRandom, now: 0,
    } as AbilityContext);
}

describe('修格斯消灭随从选择权', () => {
    it('对手拒绝且有多个随从时，产生由修格斯控制者选择的 Interaction', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 2);
        const opM2 = makeMinion('op-2', 'test_minion_b', '1', 5);
        const base = makeBase({ minions: [shoggoth, opM1, opM2] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const i1 = (r1.matchState?.sys as any)?.interaction?.current;
        expect(i1?.playerId).toBe('1');

        // 对手拒绝 → 产生由 P0 选择消灭随从的交互
        const handler = getInteractionHandler('elder_thing_shoggoth_opponent')!;
        const ms2 = { ...r1.matchState!, sys: { ...r1.matchState!.sys, interaction: { current: undefined, queue: [] } } };
        const r2 = handler(ms2, '1', { choice: 'decline' }, i1?.data, dummyRandom, 1)!;

        // 不应直接产生消灭事件
        expect(r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);

        // 应产生由 P0（修格斯控制者）选择的交互
        const i2 = (r2.state?.sys as any)?.interaction?.current;
        expect(i2?.data?.sourceId).toBe('elder_thing_shoggoth_destroy');
        expect(i2?.playerId).toBe('0');
    });

    it('对手拒绝且只有1个随从时，直接消灭', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 3);
        const base = makeBase({ minions: [shoggoth, opM1] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const i1 = (r1.matchState?.sys as any)?.interaction?.current;

        const handler = getInteractionHandler('elder_thing_shoggoth_opponent')!;
        const ms2 = { ...r1.matchState!, sys: { ...r1.matchState!.sys, interaction: { current: undefined, queue: [] } } };
        const r2 = handler(ms2, '1', { choice: 'decline' }, i1?.data, dummyRandom, 1)!;

        // 只有1个随从，直接消灭
        const destroyEvents = r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect((destroyEvents[0] as MinionDestroyedEvent).payload.minionUid).toBe('op-1');
    });

    it('控制者选择消灭指定随从后产生正确事件', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 2);
        const opM2 = makeMinion('op-2', 'test_minion_b', '1', 5);
        const base = makeBase({ minions: [shoggoth, opM1, opM2] });
        const state = makeState({ bases: [base] });
        const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

        const destroyHandler = getInteractionHandler('elder_thing_shoggoth_destroy')!;
        const iData = {
            continuationContext: { casterPlayerId: '0', baseIndex: 0, opponents: ['1'], opponentIdx: 0 },
        };
        const result = destroyHandler(ms, '0', { minionUid: 'op-2', baseIndex: 0, defId: 'test_minion_b' }, iData, dummyRandom, 2)!;

        const destroyEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        // 验证消灭的是控制者选择的 op-2，而非自动选的最弱 op-1
        expect((destroyEvents[0] as MinionDestroyedEvent).payload.minionUid).toBe('op-2');
    });

    it('对手选择抽疯狂卡时不触发消灭', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 3);
        const base = makeBase({ minions: [shoggoth, opM1] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const i1 = (r1.matchState?.sys as any)?.interaction?.current;

        const handler = getInteractionHandler('elder_thing_shoggoth_opponent')!;
        const ms2 = { ...r1.matchState!, sys: { ...r1.matchState!.sys, interaction: { current: undefined, queue: [] } } };
        const r2 = handler(ms2, '1', { choice: 'draw_madness' }, i1?.data, dummyRandom, 1)!;

        expect(r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
    });

    it('多对手链式处理：P1拒绝后P0选择消灭，然后继续询问P2', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const p1m1 = makeMinion('p1-1', 'test_a', '1', 2);
        const p1m2 = makeMinion('p1-2', 'test_b', '1', 4);
        const p2m1 = makeMinion('p2-1', 'test_c', '2', 3);
        const base = makeBase({ minions: [shoggoth, p1m1, p1m2, p2m1] });
        const state = makeState({
            bases: [base],
            turnOrder: ['0', '1', '2'],
            players: { '0': makePlayer('0'), '1': makePlayer('1'), '2': makePlayer('2') },
        });

        // 1. onPlay → 询问 P1
        const r1 = triggerShoggothOnPlay(state);
        const i1 = (r1.matchState?.sys as any)?.interaction?.current;
        expect(i1?.playerId).toBe('1');

        // 2. P1 拒绝 → 产生 P0 选择消灭交互
        const opHandler = getInteractionHandler('elder_thing_shoggoth_opponent')!;
        // 模拟引擎清除 current（引擎在调用 handler 前会清除 current）
        const ms2 = { ...r1.matchState!, sys: { ...r1.matchState!.sys, interaction: { current: undefined, queue: [] } } };
        const r2 = opHandler(ms2, '1', { choice: 'decline' }, i1?.data, dummyRandom, 1)!;
        const i2 = (r2.state?.sys as any)?.interaction?.current;
        expect(i2?.data?.sourceId).toBe('elder_thing_shoggoth_destroy');
        expect(i2?.playerId).toBe('0');

        // 3. P0 选择消灭 p1-2 → 继续询问 P2
        const destroyHandler = getInteractionHandler('elder_thing_shoggoth_destroy')!;
        const ms3 = { ...r2.state, sys: { ...r2.state.sys, interaction: { current: undefined, queue: [] } } };
        const r3 = destroyHandler(ms3, '0', { minionUid: 'p1-2', baseIndex: 0, defId: 'test_b' }, i2?.data, dummyRandom, 2)!;

        const destroyEvents = r3.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect((destroyEvents[0] as MinionDestroyedEvent).payload.minionUid).toBe('p1-2');

        // 应继续询问 P2
        const i3 = (r3.state?.sys as any)?.interaction?.current;
        expect(i3?.data?.sourceId).toBe('elder_thing_shoggoth_opponent');
        expect(i3?.playerId).toBe('2');
    });

    it('对手在基地没有随从时，拒绝不产生任何消灭', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6);
        const base = makeBase({ minions: [shoggoth] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const i1 = (r1.matchState?.sys as any)?.interaction?.current;

        const handler = getInteractionHandler('elder_thing_shoggoth_opponent')!;
        const ms2 = { ...r1.matchState!, sys: { ...r1.matchState!.sys, interaction: { current: undefined, queue: [] } } };
        const r2 = handler(ms2, '1', { choice: 'decline' }, i1?.data, dummyRandom, 1)!;

        expect(r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
    });
});
