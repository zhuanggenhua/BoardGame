import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { reduce } from '../../domain/reducer';
import { SU_EVENTS } from '../../domain/types';
import {
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';
import { defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Vikings abilities', () => {
    it('vikings_viking_funeral 在宿主进入弃牌堆后仍会通过 queued discard trigger 结算 VP 与移出游戏', () => {
        const preDiscardCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('host-1', 'samurai_bushi', '0', 4, {
                        attachedActions: [{ uid: 'funeral-1', defId: 'vikings_viking_funeral', ownerId: '0' }] as any,
                    }),
                ],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(preDiscardCore, 'onMinionDiscardedFromBase', {
            state: preDiscardCore,
            matchState: makeMatchState(preDiscardCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: preDiscardCore.bases[0].minions[0],
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'samurai_bushi',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();

        const queuedCore = makeState({
            players: preDiscardCore.players,
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
            triggerQueue: (queued as any).payload.triggers,
        });

        const resolved = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload.playerId === '0'
            && (event as any).payload.reason === 'vikings_viking_funeral',
        )).toBe(true);
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.CARD_REMOVED_FROM_GAME
            && (event as any).payload.cardUid === 'host-1'
            && (event as any).payload.reason === 'vikings_viking_funeral',
        )).toBe(true);
    });

    it('vikings_viking_funeral 的 borrowed 宿主被自己控制时仍应移出其拥有者弃牌堆', () => {
        const preDiscardCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('borrowed-host', 'samurai_bushi', '0', 4, {
                        owner: '1',
                        attachedActions: [{ uid: 'funeral-borrowed', defId: 'vikings_viking_funeral', ownerId: '0' }] as any,
                    }),
                ],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(preDiscardCore, 'onMinionDiscardedFromBase', {
            state: preDiscardCore,
            matchState: makeMatchState(preDiscardCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: preDiscardCore.bases[0].minions[0],
            triggerMinionUid: 'borrowed-host',
            triggerMinionDefId: 'samurai_bushi',
            random: defaultTestRandom,
            now: 1001,
        });

        expect(queued).toBeDefined();

        const queuedCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('borrowed-host', 'samurai_bushi', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
            triggerQueue: (queued as any).payload.triggers,
        });

        const resolved = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 1001);
        expect(resolved).toBeDefined();
        expect(resolved!.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({
                playerId: '0',
                reason: 'vikings_viking_funeral',
            }),
        }));
        expect(resolved!.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
            payload: expect.objectContaining({
                cardUid: 'borrowed-host',
                playerId: '1',
                reason: 'vikings_viking_funeral',
            }),
        }));

        const finalCore = resolved!.events.reduce((acc, event) => reduce(acc, event), queuedCore);
        expect(finalCore.players['1'].discard.some(card => card.uid === 'borrowed-host')).toBe(false);
        expect(finalCore.players['1'].removedFromGame.some(card => card.uid === 'borrowed-host')).toBe(true);
    });
});
