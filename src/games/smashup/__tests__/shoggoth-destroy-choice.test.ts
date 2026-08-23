/**
 * 修格斯 (Shoggoth) 消灭随从选择权测试
 *
 * 验证：对手拒绝抽疯狂卡时，由修格斯控制者（而非自动选最弱）选择消灭哪个随从
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { SmashUpCore, PlayerState, MinionOnBase, BaseInPlay, MinionDestroyedEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import type { AbilityContext } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import type { RandomFn } from '../../../engine/types';
import {
    getFirstPrompt,
    invokeRegisteredAbilityContract,
    getPromptPlayerId,
    getPromptSourceId,
    makeMatchState,
    respondToPromptOption,
} from './helpers';

function makeMinion(uid: string, defId: string, controller: string, power: number, overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
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
    const ms = makeMatchState(state);
    return invokeRegisteredAbilityContract('elder_thing_shoggoth', 'onPlay', {
        state, matchState: ms, playerId: '0', cardUid: 'sh-1', defId: 'elder_thing_shoggoth',
        baseIndex, random: dummyRandom, now: 0,
    } as AbilityContext);
}

describe('修格斯消灭随从选择权', () => {
    it('对手拒绝且有多个随从时，产生由修格斯控制者选择的 Interaction', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 2, { powerModifier: 0 });
        const opM2 = makeMinion('op-2', 'test_minion_b', '1', 5, { powerModifier: 0 });
        const base = makeBase({ minions: [shoggoth, opM1, opM2] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const i1 = getFirstPrompt(r1.matchState!);
        expect(getPromptPlayerId(i1)).toBe('1');

        // 对手拒绝 → 产生由 P0 选择消灭随从的交互
        const r2 = respondToPromptOption(
            r1.matchState!,
            option => option.value?.choice === 'decline',
            'Shoggoth decline option',
            '1',
            dummyRandom,
        );

        // 不应直接产生消灭事件
        expect(r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);

        // 应产生由 P0（修格斯控制者）选择的交互
        const i2 = getFirstPrompt(r2.finalState);
        expect(getPromptSourceId(i2)).toBe('elder_thing_shoggoth_destroy');
        expect(getPromptPlayerId(i2)).toBe('0');
    });

    it('对手拒绝且只有1个随从时，仍由修格斯控制者确认消灭', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 3, { powerModifier: 0 });
        const base = makeBase({ minions: [shoggoth, opM1] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const r2 = respondToPromptOption(
            r1.matchState!,
            option => option.value?.choice === 'decline',
            'Shoggoth decline option',
            '1',
            dummyRandom,
        );

        expect(r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        const destroyPrompt = getFirstPrompt(r2.finalState);
        expect(getPromptSourceId(destroyPrompt)).toBe('elder_thing_shoggoth_destroy');
        expect(getPromptPlayerId(destroyPrompt)).toBe('0');

        const resolved = respondToPromptOption(
            r2.finalState,
            option => option.value?.minionUid === 'op-1',
            'Shoggoth single destroy target op-1',
            '0',
            dummyRandom,
        );

        const destroyEvents = resolved.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect((destroyEvents[0] as MinionDestroyedEvent).payload.minionUid).toBe('op-1');
    });

    it('控制者选择消灭指定随从后产生正确事件', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 2, { powerModifier: 0 });
        const opM2 = makeMinion('op-2', 'test_minion_b', '1', 5, { powerModifier: 0 });
        const base = makeBase({ minions: [shoggoth, opM1, opM2] });
        const state = makeState({ bases: [base] });
        const first = triggerShoggothOnPlay(state);
        const afterDecline = respondToPromptOption(
            first.matchState!,
            option => option.value?.choice === 'decline',
            'Shoggoth decline option',
            '1',
            dummyRandom,
        );
        const result = respondToPromptOption(
            afterDecline.finalState,
            option => option.value?.minionUid === 'op-2',
            'Shoggoth destroy target op-2',
            '0',
            dummyRandom,
        );

        const destroyEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        // 验证消灭的是控制者选择的 op-2，而非自动选的最弱 op-1
        expect((destroyEvents[0] as MinionDestroyedEvent).payload.minionUid).toBe('op-2');
    });

    it('对手选择抽疯狂卡时不触发消灭', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
        const opM1 = makeMinion('op-1', 'test_minion_a', '1', 3, { powerModifier: 0 });
        const base = makeBase({ minions: [shoggoth, opM1] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const r2 = respondToPromptOption(
            r1.matchState!,
            option => option.value?.choice === 'draw_madness',
            'Shoggoth draw madness option',
            '1',
            dummyRandom,
        );

        expect(r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
    });

    it('多对手链式处理：P1拒绝后P0选择消灭，然后继续询问P2', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
        const p1m1 = makeMinion('p1-1', 'test_a', '1', 2, { powerModifier: 0 });
        const p1m2 = makeMinion('p1-2', 'test_b', '1', 4, { powerModifier: 0 });
        const p2m1 = makeMinion('p2-1', 'test_c', '2', 3, { powerModifier: 0 });
        const base = makeBase({ minions: [shoggoth, p1m1, p1m2, p2m1] });
        const state = makeState({
            bases: [base],
            turnOrder: ['0', '1', '2'],
            players: { '0': makePlayer('0'), '1': makePlayer('1'), '2': makePlayer('2') },
        });

        // 1. onPlay → 询问 P1
        const r1 = triggerShoggothOnPlay(state);
        const i1 = getFirstPrompt(r1.matchState!);
        expect(getPromptPlayerId(i1)).toBe('1');

        // 2. P1 拒绝 → 产生 P0 选择消灭交互
        const r2 = respondToPromptOption(
            r1.matchState!,
            option => option.value?.choice === 'decline',
            'Shoggoth decline option',
            '1',
            dummyRandom,
        );
        const i2 = getFirstPrompt(r2.finalState);
        expect(getPromptSourceId(i2)).toBe('elder_thing_shoggoth_destroy');
        expect(getPromptPlayerId(i2)).toBe('0');

        // 3. P0 选择消灭 p1-2 → 继续询问 P2
        const r3 = respondToPromptOption(
            r2.finalState,
            option => option.value?.minionUid === 'p1-2',
            'Shoggoth destroy target p1-2',
            '0',
            dummyRandom,
        );

        const destroyEvents = r3.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect((destroyEvents[0] as MinionDestroyedEvent).payload.minionUid).toBe('p1-2');

        // 应继续询问 P2
        const i3 = getFirstPrompt(r3.finalState);
        expect(getPromptSourceId(i3)).toBe('elder_thing_shoggoth_opponent');
        expect(getPromptPlayerId(i3)).toBe('2');
    });

    it('对手在基地没有随从时，拒绝不产生任何消灭', () => {
        const shoggoth = makeMinion('sh-1', 'elder_thing_shoggoth', '0', 6, { powerModifier: 0 });
        const base = makeBase({ minions: [shoggoth] });
        const state = makeState({ bases: [base] });

        const r1 = triggerShoggothOnPlay(state);
        const r2 = respondToPromptOption(
            r1.matchState!,
            option => option.value?.choice === 'decline',
            'Shoggoth decline option',
            '1',
            dummyRandom,
        );

        expect(r2.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
    });
});
