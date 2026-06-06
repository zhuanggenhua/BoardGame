import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { defaultTestRandom, runCommand } from '../testRunner';
import {
    getReactionPrompt,
    getPromptOption,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOptions,
} from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('ancient_egyptians_plague_of_locusts onPlay', () => {
    it('正常打出时会创建选基地交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('plague-1', 'ancient_egyptians_plague_of_locusts', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
        });
        const matchState = makeMatchState(state);
        const result = runCommand(
            matchState,
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'plague-1', targetBaseIndex: 0 },
            } as any,
            defaultTestRandom,
        );

        expect(result.success).toBe(true);
        const current = getSimpleChoicePrompt(result.finalState, 'ancient_egyptians_plague_of_locusts');
        expect(getPromptSourceId(current)).toBe('ancient_egyptians_plague_of_locusts');
        expect(getPromptTargetType(current)).toBe('base');
    });
});

describe('Ancient Egyptians queued source-controller runtime context', () => {
    it('ancient_egyptians_mummy 在对手计分时仍应把 queued afterScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('mummy-1', 'ancient_egyptians_mummy', '1', 4)],
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
            now: 4101,
        });

        expect(queued).toBeDefined();
        const mummyTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'mummy-1');
        expect(mummyTrigger).toBeDefined();
        expect(mummyTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4101,
        );
        expect(queuedState).toBeDefined();
        expect(getReactionPrompt(queuedState!.state)?.playerId).toBe('1');
    });

    it('ancient_egyptians_mummy_pod 在对手计分时仍应把 queued afterScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('mummy-pod-1', 'ancient_egyptians_mummy_pod', '1', 4)],
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
            now: 4103,
        });

        expect(queued).toBeDefined();
        const mummyTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'mummy-pod-1');
        expect(mummyTrigger).toBeDefined();
        expect(mummyTrigger.ownerPlayerId).toBe('1');
    });

    it('ancient_egyptians_pharaoh 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('pharaoh-1', 'ancient_egyptians_pharaoh', '1', 5)],
                    buriedCards: [makeCard('buried-1', 'robot_microbot_alpha', 'minion', '1')],
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
            now: 4102,
        });

        expect(queued).toBeDefined();
        const pharaohTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'pharaoh-1');
        expect(pharaohTrigger).toBeDefined();
        expect(pharaohTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4102,
        );
        expect(queuedState).toBeDefined();
        expect(getReactionPrompt(queuedState!.state)?.playerId).toBe('1');
    });

    it('ancient_egyptians_pharaoh_pod 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('pharaoh-pod-1', 'ancient_egyptians_pharaoh_pod', '1', 5)],
                    buriedCards: [makeCard('buried-2', 'robot_microbot_alpha', 'minion', '1')],
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
            now: 4104,
        });

        expect(queued).toBeDefined();
        const pharaohTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'pharaoh-pod-1');
        expect(pharaohTrigger).toBeDefined();
        expect(pharaohTrigger.ownerPlayerId).toBe('1');
    });

    it('ancient_egyptians_seal_the_tomb 真实 uncover 多选若先翻开随从再翻开 Blessing of Anubis，后者也应看到新翻开的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('seal-1', 'ancient_egyptians_seal_the_tomb', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    buriedCards: [
                        {
                            uid: 'buried-mummy',
                            defId: 'ancient_egyptians_mummy',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'play',
                        } as any,
                        {
                            uid: 'buried-blessing',
                            defId: 'ancient_egyptians_blessing_of_anubis',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'play',
                        } as any,
                    ],
                }),
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'seal-1', targetBaseIndex: 0 },
            } as any,
            defaultTestRandom,
        );
        expect(played.success).toBe(true);

        const modePrompt = getSimpleChoicePrompt(played.finalState, 'ancient_egyptians_seal_the_tomb_mode');
        const uncoverOption = getPromptOption(modePrompt, entry => entry.value?.mode === 'uncover', 'seal the tomb uncover mode');
        const choseMode = respondToPrompt(played.finalState, uncoverOption.id, '0', defaultTestRandom);
        expect(choseMode.success).toBe(true);

        const uncoverPrompt = getSimpleChoicePrompt(choseMode.finalState, 'ancient_egyptians_seal_the_tomb_uncover');
        const selectedOptionIds = [
            getPromptOption(uncoverPrompt, entry => entry.value?.cardUid === 'buried-mummy', 'seal uncover buried mummy').id,
            getPromptOption(uncoverPrompt, entry => entry.value?.cardUid === 'buried-blessing', 'seal uncover buried blessing').id,
        ];
        const resolved = respondToPromptOptions(choseMode.finalState, selectedOptionIds, '0', defaultTestRandom);
        expect(resolved.success).toBe(true);

        const mummy = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'buried-mummy');
        expect(mummy).toBeDefined();
        expect(mummy?.tempPowerModifier).toBe(2);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'buried-mummy',
                baseIndex: 0,
                amount: 2,
                reason: 'ancient_egyptians_blessing_of_anubis',
            }),
        }));
    });
});
