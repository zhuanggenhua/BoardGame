import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { buildSmashUpAiLegalActions } from '../ai';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { SU_COMMANDS } from '../domain/types';
import { validate } from '../domain/commands';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('buildSmashUpAiLegalActions borrowed talent parity', () => {
    it('应包含 borrowed base ongoing talent 的 use-talent 动作', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mist-1', 'trickster_enshrouding_mist_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{
                        uid: 'hideout-pod-borrowed',
                        defId: 'trickster_hideout_pod',
                        ownerId: '1',
                        talentUsed: false,
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
            ],
        }));

        const validation = validate(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'hideout-pod-borrowed', baseIndex: 0 },
        } as any);
        expect(validation.valid).toBe(true);

        const legalActions = buildSmashUpAiLegalActions({ playerId: '0', state });
        expect(legalActions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                commands: [expect.objectContaining({
                    type: SU_COMMANDS.USE_TALENT,
                    payload: { ongoingCardUid: 'hideout-pod-borrowed', baseIndex: 0 },
                })],
            }),
        ]));
        expect(legalActions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'use-talent',
                metadata: expect.objectContaining({
                    ongoingCardUid: 'hideout-pod-borrowed',
                    sourceType: 'ongoing',
                    baseIndex: 0,
                }),
            }),
        ]));
    });

    it('应包含 borrowed attached ongoing talent 的 use-talent 动作', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_fairy_circle',
                    minions: [
                        makeMinion('host-a', 'robot_microbot_alpha', '0', 3, {
                            attachedActions: [{
                                uid: 'ladybug-borrowed',
                                defId: 'fairies_ladybug',
                                ownerId: '1',
                                talentUsed: false,
                                metadata: { sourceControllerId: '0' },
                            } as any],
                        }),
                        makeMinion('host-b', 'robot_microbot_beta', '0', 2, '0'),
                    ],
                }),
            ],
        }));

        const validation = validate(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'ladybug-borrowed', baseIndex: 0 },
        } as any);
        expect(validation.valid).toBe(true);

        const legalActions = buildSmashUpAiLegalActions({ playerId: '0', state });
        expect(legalActions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                commands: [expect.objectContaining({
                    type: SU_COMMANDS.USE_TALENT,
                    payload: { ongoingCardUid: 'ladybug-borrowed', baseIndex: 0 },
                })],
            }),
        ]));
        expect(legalActions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'use-talent',
                metadata: expect.objectContaining({
                    ongoingCardUid: 'ladybug-borrowed',
                    sourceType: 'attached',
                    baseIndex: 0,
                }),
            }),
        ]));
    });
});
