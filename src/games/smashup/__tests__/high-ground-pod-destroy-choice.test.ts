import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../abilities';
import { fireTriggers } from '../domain/ongoingEffects';
import type { MinionDestroyedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { applyEvents, getSimpleChoicePrompt, makeMatchState, respondToPromptOption } from './helpers';

function createPodHighGroundState(): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
                factions: ['bear_cavalry_pod', 'minions_of_cthulhu_pod'],
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['robots_pod', 'pirates_pod'],
            },
        },
        bases: [
            {
                defId: 'base_rlyeh',
                minions: [
                    {
                        uid: 'm0',
                        defId: 'bear_cavalry',
                        controller: '0',
                        owner: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [
                    {
                        uid: 'hg1',
                        defId: 'bear_cavalry_high_ground_pod',
                        ownerId: '0',
                        cardUid: 'hg1',
                    },
                ],
            },
            {
                defId: 'base_the_jungle',
                minions: [
                    {
                        uid: 'm1',
                        defId: 'robot_zapbot_pod',
                        controller: '1',
                        owner: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
        ],
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
    } as SmashUpCore;
}

function createPodMoveEvent(): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_MOVED,
        payload: {
            minionUid: 'm1',
            minionDefId: 'robot_zapbot_pod',
            fromBaseIndex: 1,
            toBaseIndex: 0,
            reason: 'test_move',
        },
        timestamp: 1000,
    };
}

describe('High Ground POD destroy choice', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('选择消灭分支时 destroyerId 仍为制高点拥有者', () => {
        const state = createPodHighGroundState();
        const moveEvent = createPodMoveEvent();
        const movedState = applyEvents(state, [moveEvent]);

        const triggerResult = fireTriggers(movedState, 'onMinionMoved', {
            state: movedState,
            matchState: makeMatchState(movedState),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            triggerMinionDefId: 'robot_zapbot_pod',
            random: { random: () => 0.5, shuffle: <T>(items: T[]) => [...items], d: () => 1, range: (min: number) => min },
            now: 1000,
        });

        expect(triggerResult.events).toEqual([]);
        expect(getSimpleChoicePrompt(triggerResult.matchState!, 'bear_cavalry_high_ground_pod_trigger')).toBeDefined();

        const resolved = respondToPromptOption(
            triggerResult.matchState!,
            option => option.id === 'destroy',
            'High Ground POD destroy option',
            '0',
        );

        expect(resolved.events.map(event => event.type)).toEqual(expect.arrayContaining([
            'SYS_INTERACTION_RESOLVED',
            SU_EVENTS.ONGOING_DETACHED,
            SU_EVENTS.MINION_DESTROYED,
        ]));

        const destroyEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent;
        expect(destroyEvent.payload.minionUid).toBe('m1');
        expect(destroyEvent.payload.fromBaseIndex).toBe(0);
        expect(destroyEvent.payload.destroyerId).toBe('0');

        const domainEvents = resolved.events.filter((event): event is SmashUpEvent => event.type !== 'SYS_INTERACTION_RESOLVED');
        const next = applyEvents(state, [moveEvent, ...domainEvents]);

        expect(next.bases[0].ongoingActions).toHaveLength(0);
        expect(next.bases[0].minions.map(minion => minion.uid)).toEqual(['m0']);
        expect(next.bases[1].minions).toHaveLength(0);
        expect(next.players['0'].vp).toBe(0);
        expect(next.destroyedMinionByPlayersThisTurn).toEqual(['0']);
    });
});
