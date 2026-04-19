
import { describe, it, expect, beforeAll } from 'vitest';
import { makeMinion, makeState } from './helpers';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_EVENTS } from '../domain/types';
import { steampunkOrnateDomeOnPlay, steampunkEscapeHatchTrigger } from '../abilities/steampunks';
import { AbilityContext } from '../domain/abilityRegistry';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('Steampunk POD Card Logic Verification', () => {
    it('steampunk_ornate_dome_pod should destroy opponent actions but NOT itself', () => {
        const myDome = { uid: 'dome-pod', defId: 'steampunk_ornate_dome_pod', ownerId: '0' };
        const opponentAction = { uid: 'opp-act', defId: 'some_action', ownerId: '1' };

        const base = {
            defId: 'base1',
            minions: [],
            ongoingActions: [myDome, opponentAction],
        } as any;
        const state = makeState({ bases: [base] });

        const ctx: AbilityContext = {
            state,
            matchState: { core: state, config: {} as any, status: 'active', history: [], sys: {} as any },
            playerId: '0',
            cardUid: 'dome-pod',
            defId: 'steampunk_ornate_dome_pod',
            baseIndex: 0,
            random: () => 0.5,
            now: Date.now(),
        };

        const result = steampunkOrnateDomeOnPlay(ctx);

        // Should have one ONGOING_DETACHED event for the opponent action
        const detachedEvents = result.events.filter(e => e.type === SU_EVENTS.ONGOING_DETACHED) as any[];
        expect(detachedEvents.length).toBe(1);
        expect(detachedEvents[0].payload.cardUid).toBe('opp-act');

        // Should NOT have an event for dome-pod
        const selfDetached = detachedEvents.find(e => e.payload.cardUid === 'dome-pod');
        expect(selfDetached).toBeUndefined();
    });

    it('steampunk_escape_hatch_pod should trigger for owner minions', () => {
        const hatch = { uid: 'hatch-pod', defId: 'steampunk_escape_hatch_pod', ownerId: '0' };
        const myMinion = makeMinion('m1', 'minion1', '0', 3);

        const base = {
            defId: 'base1',
            minions: [myMinion],
            ongoingActions: [hatch],
        } as any;
        const state = makeState({ bases: [base] });

        const ctx: any = {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            now: Date.now(),
        };

        const events = steampunkEscapeHatchTrigger(ctx) as any[];

        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
        expect(events[0].payload.minionUid).toBe('m1');
    });
});
