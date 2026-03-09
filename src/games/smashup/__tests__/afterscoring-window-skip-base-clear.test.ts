/**
 * afterScoring 延迟清场 / 替换相关回归测试
 *
 * 覆盖两类问题：
 * - 交互链结束后，BASE_CLEARED / BASE_REPLACED 仍需被补发
 * - 像温室 / 托尔图加这类“作用于替换后基地”的效果，必须在补发后再落地
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createFlowSystem, createBaseSystems } from '../../../engine/systems';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { createSmashUpEventSystem } from '../domain/systems';
import { smashUpFlowHooks } from '../domain/index';
import { reduce } from '../domain/reduce';
import type { SmashUpCore, SmashUpEvent, PlayerState, BaseInPlay, MinionOnBase, CardInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
        ...overrides,
    };
}

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return {
        defId,
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner = '0'): CardInstance {
    return { uid, defId, type, owner };
}

function makeCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': makePlayer('0'),
            '1': makePlayer('1'),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

function wrapState(core: SmashUpCore) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    const sys = createInitialSystemState(['0', '1'], systems, undefined);
    sys.phase = 'scoreBases';
    sys.interaction.current = undefined;
    sys.interaction.queue = [];
    return { core, sys };
}

describe('afterScoring 延迟清场回归', () => {
    it('base_greenhouse: 应先换基地，再把牌库随从打到新基地', () => {
        const system = createSmashUpEventSystem();
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk1', 'alien_collector', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_greenhouse')],
            baseDeck: ['base_secret_garden'],
        }));

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-greenhouse',
                    playerId: '0',
                    optionId: 'minion-0',
                    value: { cardUid: 'dk1', defId: 'alien_collector', power: 4 },
                    sourceId: 'base_greenhouse',
                    interactionData: {
                        sourceId: 'base_greenhouse',
                        continuationContext: {
                            baseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                                    timestamp: 2100,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_greenhouse',
                                        newBaseDefId: 'base_secret_garden',
                                    },
                                    timestamp: 2100,
                                },
                            ],
                        },
                    },
                },
                timestamp: 2100,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.MINION_PLAYED,
        ]);

        const finalCore = emittedEvents?.reduce((core, event) => reduce(core, event), state.core as SmashUpCore);
        expect(finalCore?.bases[0].defId).toBe('base_secret_garden');
        expect(finalCore?.bases[0].minions.map(minion => minion.uid)).toEqual(['dk1']);
        expect(finalCore?.players['0'].deck).toHaveLength(0);
    });

    it('base_tortuga: 应先换基地，再把亚军随从移到新基地', () => {
        const system = createSmashUpEventSystem();
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tortuga', {
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '1', 3),
                    ],
                }),
                makeBase('base_other', {
                    minions: [makeMinion('m3', '1', 2)],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-tortuga',
                    playerId: '1',
                    optionId: 'minion-0',
                    value: { minionUid: 'm3', minionDefId: 'd1', fromBaseIndex: 1 },
                    sourceId: 'base_tortuga',
                    interactionData: {
                        sourceId: 'base_tortuga',
                        continuationContext: {
                            baseIndex: 0,
                            _deferredPostScoringEvents: [
                                {
                                    type: SU_EVENTS.BASE_CLEARED,
                                    payload: { baseIndex: 0, baseDefId: 'base_tortuga' },
                                    timestamp: 2200,
                                },
                                {
                                    type: SU_EVENTS.BASE_REPLACED,
                                    payload: {
                                        baseIndex: 0,
                                        oldBaseDefId: 'base_tortuga',
                                        newBaseDefId: 'base_secret_garden',
                                    },
                                    timestamp: 2200,
                                },
                            ],
                        },
                    },
                },
                timestamp: 2200,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.MINION_MOVED,
        ]);

        const finalCore = emittedEvents?.reduce((core, event) => reduce(core, event), state.core as SmashUpCore);
        expect(finalCore?.bases[0].defId).toBe('base_secret_garden');
        expect(finalCore?.bases[0].minions.map(minion => minion.uid)).toEqual(['m3']);
        expect(finalCore?.bases[1].minions).toHaveLength(0);
    });
});
