import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { defaultTestRandom } from '../testRunner';
import {
    getReactionPrompt,
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('World Champs queued source-controller runtime context', () => {
    it('world_champs_mummy 在对手计分时仍应把 queued afterScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('wc-mummy-1', 'world_champs_mummy', '1', 4)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4201,
        });

        expect(queued).toBeDefined();
        const mummyTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-mummy-1');
        expect(mummyTrigger).toBeDefined();
        expect(mummyTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4201,
        );
        expect(queuedState).toBeDefined();
        expect(getReactionPrompt(queuedState!.state)?.playerId).toBe('1');
    });

    it('world_champs_mummy_pod 在对手计分时仍应把 queued afterScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('wc-mummy-pod-1', 'world_champs_mummy_pod', '1', 4)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4203,
        });

        expect(queued).toBeDefined();
        const mummyTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-mummy-pod-1');
        expect(mummyTrigger).toBeDefined();
        expect(mummyTrigger.ownerPlayerId).toBe('1');
    });

    it('world_champs_sheriff 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('wc-sheriff-1', 'world_champs_sheriff', '1', 4),
                        makeMinion('enemy-1', 'robot_microbot_alpha', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4202,
        });

        expect(queued).toBeDefined();
        const sheriffTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-sheriff-1');
        expect(sheriffTrigger).toBeDefined();
        expect(sheriffTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4202,
        );
        expect(queuedState).toBeDefined();
        expect(getReactionPrompt(queuedState!.state)?.playerId).toBe('1');
    });

    it('world_champs_sheriff_pod 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('wc-sheriff-pod-1', 'world_champs_sheriff_pod', '1', 4),
                        makeMinion('enemy-pod-1', 'robot_microbot_alpha', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4204,
        });

        expect(queued).toBeDefined();
        const sheriffTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-sheriff-pod-1');
        expect(sheriffTrigger).toBeDefined();
        expect(sheriffTrigger.ownerPlayerId).toBe('1');
    });
});
