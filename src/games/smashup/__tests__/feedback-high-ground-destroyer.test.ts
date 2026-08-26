/**
 * 回归：制高点在 onMinionMoved 触发时必须把 destroyerId 透传为制高点拥有者。
 *
 * 说明：
 * - 当前引擎分层下，MINION_MOVED 事件不会直接在 reducer 内自动触发 onMinionMoved。
 * - 拉莱耶（base_rlyeh）的 1VP 只在“拉莱耶自身造成消灭”时触发，不适用于制高点。
 * - 因此这里验证的是：触发器产出的 MINION_DESTROYED 是否带上正确 destroyerId，
 *   以及把移动事件与后续触发事件顺序归约后，最终状态是否正确。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../abilities';
import { fireTriggers } from '../domain/ongoingEffects';
import type { SmashUpCore, MinionDestroyedEvent, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { applyEvents, makeMatchState } from './helpers';

function createState(params: {
    baseDefId: string;
    highGroundDefId: string;
    movedMinionDefId: string;
    player0Factions: [string, string];
    player1Factions: [string, string];
}): SmashUpCore {
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
                factions: params.player0Factions,
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
                factions: params.player1Factions,
            },
        },
        bases: [
            {
                defId: params.baseDefId,
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
                        defId: params.highGroundDefId,
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
                        defId: params.movedMinionDefId,
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
    } as any;
}

function createMoveEvent(minionDefId: string): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_MOVED,
        payload: {
            minionUid: 'm1',
            minionDefId,
            fromBaseIndex: 1,
            toBaseIndex: 0,
            reason: 'test_move',
        },
        timestamp: 1000,
    };
}

describe('反馈2：制高点消灭随从时 destroyerId 应正确透传', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('基础版制高点：触发消灭时 destroyerId 为制高点拥有者，且不会错误触发拉莱耶加分', () => {
        const state = createState({
            baseDefId: 'base_rlyeh',
            highGroundDefId: 'bear_cavalry_high_ground',
            movedMinionDefId: 'robot_zapbot',
            player0Factions: ['bear_cavalry', 'minions_of_cthulhu'],
            player1Factions: ['robots', 'pirates'],
        });
        const moveEvent = createMoveEvent('robot_zapbot');

        const triggerResult = fireTriggers(state, 'onMinionMoved', {
            state,
            matchState: makeMatchState(state),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            triggerMinionDefId: 'robot_zapbot',
            random: { random: () => 0.5, shuffle: <T>(items: T[]) => [...items], d: () => 1, range: (min: number) => min },
            now: 1000,
        });

        expect(triggerResult.events).toHaveLength(1);
        expect(triggerResult.events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);

        const destroyEvent = triggerResult.events[0] as MinionDestroyedEvent;
        expect(destroyEvent.payload.minionUid).toBe('m1');
        expect(destroyEvent.payload.fromBaseIndex).toBe(0);
        expect(destroyEvent.payload.destroyerId).toBe('0');

        const next = applyEvents(state, [moveEvent, ...triggerResult.events]);

        expect(next.bases[0].minions.map(minion => minion.uid)).toEqual(['m0']);
        expect(next.bases[1].minions).toHaveLength(0);
        expect(next.players['0'].vp).toBe(0);
        expect(next.players['1'].vp).toBe(0);
        expect(next.turnDestroyedMinions).toEqual([
            { uid: 'm1', defId: 'robot_zapbot', baseIndex: 0, owner: '1', controller: '1' },
        ]);
        expect(next.destroyedMinionByPlayersThisTurn).toEqual(['0']);
    });

});
