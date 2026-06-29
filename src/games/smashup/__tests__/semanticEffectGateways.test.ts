import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import {
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedControlChangeEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
} from '../domain/abilityHelpers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { SU_EVENTS } from '../domain/types';
import { makeBase, makeMinion, makeState } from './helpers';

function makeIncorporealProtectedMinion() {
    return makeMinion('prot1', 'test_minion', '1', 2, {
        attachedActions: [{ uid: 'inc1', defId: 'ghost_incorporeal', ownerId: '1', metadata: {} }],
    });
}

describe('SmashUp semantic effect gateways', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    afterEach(() => {
        clearOngoingEffectRegistry();
        resetAbilityInit();
    });

    it('共享回手 gateway 在 builder 层就拦截受保护目标', () => {
        const protectedMinion = makeIncorporealProtectedMinion();
        const state = makeState({
            bases: [makeBase('test_base', [protectedMinion])],
        });

        const events = buildValidatedReturnEvents(state, {
            minionUid: protectedMinion.uid,
            minionDefId: protectedMinion.defId,
            fromBaseIndex: 0,
            toPlayerId: protectedMinion.owner,
            reason: 'alien_abduction',
            now: 123,
            sourcePlayerId: '0',
            sourceCardUid: 'abduction-1',
            sourceDefId: 'alien_abduction',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
        });

        expect(events.some((event) => event.type === SU_EVENTS.MINION_RETURNED)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '0',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });

    it('共享回手 gateway 在目标尚未正式落盘时，仍可基于快照执行保护过滤', () => {
        const state = makeState({
            bases: [makeBase('test_base', [])],
        });

        const events = buildValidatedReturnEvents(state, {
            minionUid: 'played-minion',
            minionDefId: 'test_minion',
            fromBaseIndex: 0,
            toPlayerId: '0',
            reason: 'alien_abduction',
            now: 124,
            sourcePlayerId: '1',
            sourceCardUid: 'abduction-1',
            sourceDefId: 'alien_abduction',
            sourceControllerId: '1',
            sourceBaseIndex: 0,
            targetSnapshot: {
                ownerId: '0',
                controllerId: '0',
                playedThisTurn: true,
                metadata: {
                    tempProtectAffectUntilTurnNumber: 1,
                    tempProtectSourcePlayerId: '0',
                },
            },
        });

        expect(events.some((event) => event.type === SU_EVENTS.MINION_RETURNED)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '1',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });

    it('共享控制权 gateway 在 builder 层就拦截受保护目标', () => {
        const protectedMinion = makeIncorporealProtectedMinion();
        const state = makeState({
            bases: [makeBase('test_base', [protectedMinion])],
        });

        const events = buildValidatedControlChangeEvents(state, {
            minionUid: protectedMinion.uid,
            minionDefId: protectedMinion.defId,
            baseIndex: 0,
            toControllerId: '0',
            sourcePlayerId: '0',
            sourceCardUid: 'make-contact-1',
            sourceDefId: 'ghost_make_contact_pod',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            reason: 'ghost_make_contact_pod',
            now: 456,
        });

        expect(events.some((event) => event.type === SU_EVENTS.MINION_CONTROL_CHANGED)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '0',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });

    it('共享消灭 gateway 在 builder 层就拦截受保护目标', () => {
        const protectedMinion = makeIncorporealProtectedMinion();
        const state = makeState({
            bases: [makeBase('test_base', [protectedMinion])],
        });

        const events = buildValidatedDestroyEvents(state, {
            minionUid: protectedMinion.uid,
            minionDefId: protectedMinion.defId,
            fromBaseIndex: 0,
            destroyerId: '0',
            reason: 'sharks_torn_apart',
            now: 567,
            sourcePlayerId: '0',
            sourceDefId: 'sharks_torn_apart',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
        });

        expect(events.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '0',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });

    it('共享消灭 gateway 在目标尚未正式落盘时，仍可基于快照执行保护过滤', () => {
        const state = makeState({
            bases: [makeBase('test_base', [])],
        });

        const events = buildValidatedDestroyEvents(state, {
            minionUid: 'played-minion',
            minionDefId: 'test_minion',
            fromBaseIndex: 0,
            destroyerId: '0',
            reason: 'trickster_flame_trap',
            now: 568,
            sourcePlayerId: '1',
            sourceDefId: 'trickster_flame_trap',
            sourceControllerId: '1',
            sourceBaseIndex: 0,
            targetSnapshot: {
                ownerId: '0',
                controllerId: '0',
                playedThisTurn: true,
                metadata: {
                    tempProtectAffectUntilTurnNumber: 1,
                    tempProtectSourcePlayerId: '0',
                },
            },
        });

        expect(events.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '1',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });

    it('共享移动 gateway 在 builder 层就拦截受保护目标', () => {
        const protectedMinion = makeIncorporealProtectedMinion();
        const state = makeState({
            bases: [makeBase('test_base', [protectedMinion]), makeBase('other_base')],
        });

        const events = buildValidatedMoveEvents(state, {
            minionUid: protectedMinion.uid,
            minionDefId: protectedMinion.defId,
            fromBaseIndex: 0,
            toBaseIndex: 1,
            sourcePlayerId: '0',
            sourceDefId: 'alien_invasion',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            reason: 'alien_invasion',
            now: 789,
        });

        expect(events.some((event) => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '0',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });

    it('共享移动 gateway 会保留同批移动 batchId', () => {
        const movingMinion = makeMinion('move-1', 'test_minion', '0', 3);
        const state = makeState({
            bases: [makeBase('test_base', [movingMinion]), makeBase('other_base')],
        });

        const events = buildValidatedMoveEvents(state, {
            minionUid: movingMinion.uid,
            minionDefId: movingMinion.defId,
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'geeks_felicia_day',
            now: 790,
            sourcePlayerId: '0',
            sourceDefId: 'geeks_felicia_day',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            batchId: 'batch-1',
        });

        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'move-1',
                    batchId: 'batch-1',
                    reason: 'geeks_felicia_day',
                }),
            }),
        ]);
    });

    it('共享移动 gateway 在目标尚未正式落盘时，仍可基于快照执行保护过滤', () => {
        const state = makeState({
            bases: [makeBase('test_base', []), makeBase('other_base')],
        });

        const events = buildValidatedMoveEvents(state, {
            minionUid: 'played-minion',
            minionDefId: 'test_minion',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'alien_invasion',
            now: 791,
            sourcePlayerId: '1',
            sourceDefId: 'alien_invasion',
            sourceControllerId: '1',
            sourceBaseIndex: 0,
            targetSnapshot: {
                ownerId: '0',
                controllerId: '0',
                playedThisTurn: true,
                metadata: {
                    tempProtectAffectUntilTurnNumber: 1,
                    tempProtectSourcePlayerId: '0',
                },
            },
        });

        expect(events.some((event) => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '1',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });

    it('共享回牌库底 gateway 在 builder 层就拦截受保护目标', () => {
        const protectedMinion = makeIncorporealProtectedMinion();
        const state = makeState({
            bases: [makeBase('test_base', [protectedMinion])],
        });

        const events = buildValidatedCardToDeckBottomEvents(state, {
            cardUid: protectedMinion.uid,
            defId: protectedMinion.defId,
            ownerId: protectedMinion.owner,
            reason: 'samurai_way_of_the_warrior',
            now: 999,
            expectedLocation: 'bases',
            sourcePlayerId: '0',
            sourceCardUid: 'warrior-1',
            sourceDefId: 'samurai_way_of_the_warrior',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
        });

        expect(events.some((event) => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(false);
        expect(events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '0',
                    messageKey: 'feedback.target_protected',
                }),
            }),
        ]);
    });
});
