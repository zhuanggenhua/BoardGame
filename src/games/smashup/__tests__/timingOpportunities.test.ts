import { describe, expect, it } from 'vitest';
import {
    buildChoiceRequestFromOpportunity,
    createTimingPoint,
    discoverTimingOpportunities,
} from '../../../engine/TimingOpportunity';
import { createTimingOpportunitySystem } from '../../../engine/systems/TimingOpportunitySystem';
import { SYSTEM_IDS } from '../../../engine/systems/types';
import { makeMatchState, makeState } from './helpers';
import { defaultTestRandom } from './testRunner';
import { SmashUpDomain, SU_COMMANDS, SU_EVENTS } from '../domain';
import { advanceSmashUpReactionSession, startSmashUpReactionSession } from '../domain/reactionSession';
import { createSmashUpTimingOpportunitySystemConfig } from '../domain/timingOpportunities';
import { smashUpSystemsForTest } from '../game';
import type { SmashUpCore, TriggerInstance } from '../domain/types';

function makeTrigger(overrides: Partial<TriggerInstance> = {}): TriggerInstance {
    return {
        id: 'trigger-1',
        timing: 'afterScoring',
        sourceDefId: 'pirate_first_mate',
        sourceCardUid: 'minion-1',
        sourceControllerId: '0',
        sourceOwnerPlayerId: '0',
        sourceBaseIndex: 0,
        mandatory: true,
        resolutionClass: 'mandatory',
        frameId: 'score-after:base-0',
        ownerPlayerId: '0',
        eventPlayerId: '0',
        witnessRequirement: 'inPlayAtTriggerTime',
        witnessed: true,
        baseIndex: 0,
        ...overrides,
    } as TriggerInstance;
}

function makeTimingPoint() {
    return createTimingPoint({
        gameId: 'smashup',
        position: 'postCommit',
        factKind: 'scoring',
        event: {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0,
                baseDefId: 'test_base',
                rankings: [],
            },
            timestamp: 42,
        },
        timestamp: 42,
    });
}

function withReactionSession(core: SmashUpCore, phase: 'mandatory' | 'optional') {
    return startSmashUpReactionSession(makeMatchState(core), {
        frameId: 'score-after:base-0',
        frameKind: 'score-after',
        phase,
        activePlayerId: '0',
        currentPlayerId: '0',
        sourceBaseIndex: 0,
        responseWindowType: 'afterScoring',
    });
}

describe('SmashUp timing opportunities', () => {
    it('production systems opt into the timing opportunity system', () => {
        expect(smashUpSystemsForTest.map(system => system.id))
            .toContain(SYSTEM_IDS.TIMING_OPPORTUNITY);
    });

    it('returns no opportunities when no reaction session is active', () => {
        const state = makeMatchState(makeState());
        const result = discoverTimingOpportunities(SmashUpDomain, {
            state,
            timing: makeTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.opportunities).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it('maps an active mandatory reaction session to a choice-request opportunity', () => {
        const state = withReactionSession(
            makeState({
                triggerQueue: [makeTrigger()],
            }),
            'mandatory',
        );

        const result = discoverTimingOpportunities(SmashUpDomain, {
            state,
            timing: makeTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
        expect(result.opportunities).toHaveLength(1);
        expect(result.opportunities[0]).toMatchObject({
            id: 'smashup:reaction:score-after:base-0:mandatory:0',
            controllerId: '0',
            class: 'mandatory',
            sourceRef: {
                kind: 'system',
                id: 'smashup_reaction_choose',
                metadata: {
                    frameId: 'score-after:base-0',
                    frameKind: 'score-after',
                    phase: 'mandatory',
                    responseWindowType: 'afterScoring',
                },
            },
            resolution: { type: 'choice-request' },
        });

        const choice = buildChoiceRequestFromOpportunity(result.opportunities[0]);
        expect(choice).toMatchObject({
            requestId: 'smashup:reaction:score-after:base-0:mandatory:0',
            gameId: 'smashup',
            playerId: '0',
            kind: 'choose-option',
            sourceId: 'smashup_reaction_choose',
            selection: { min: 1, max: 1 },
            resolution: {
                type: 'interaction-response',
                interactionId: 'smashup:reaction:score-after:base-0:mandatory:0',
            },
            ai: {
                status: 'game-policy',
                policyId: 'smashup-reaction-choice',
            },
        });
        expect(choice.candidates).toEqual([
            expect.objectContaining({
                id: 'trigger:trigger-1',
                value: { kind: 'trigger', triggerId: 'trigger-1' },
                displayMode: 'button',
            }),
        ]);
    });

    it('does not create a fake optional response when only pass is available', () => {
        const state = withReactionSession(makeState(), 'optional');

        const result = discoverTimingOpportunities(SmashUpDomain, {
            state,
            timing: makeTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.opportunities).toEqual([]);
        expect(state.sys.interaction.current).toBeUndefined();
    });

    it('projects SmashUp reaction opportunities through the generic timing opportunity system', () => {
        const state = withReactionSession(
            makeState({
                triggerQueue: [makeTrigger()],
            }),
            'mandatory',
        );
        const system = createTimingOpportunitySystem(
            SmashUpDomain,
            createSmashUpTimingOpportunitySystemConfig(),
        );

        const result = system.afterEvents?.({
            state,
            events: [makeTimingPoint().event!],
            command: {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'action-1' },
                timestamp: 42,
            },
            random: defaultTestRandom,
            playerIds: ['0', '1'],
        });
        const current = result?.state?.sys.interaction.current;

        expect(current).toMatchObject({
            id: 'smashup:reaction:score-after:base-0:mandatory:0',
            kind: 'simple-choice',
            playerId: '0',
            resolutionFrameId: 'score-after:base-0',
            data: {
                title: 'ui.reaction_choose_mandatory_title',
                sourceId: 'smashup_reaction_choose',
                targetType: 'field-source-action',
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
                allowedCommands: [SU_COMMANDS.REACTION_PASS],
                choiceRequest: {
                    requestId: 'smashup:reaction:score-after:base-0:mandatory:0',
                    choiceKind: 'choose-option',
                    sourceId: 'smashup_reaction_choose',
                    aiStatus: 'game-policy',
                },
            },
        });
        expect(current?.data.options).toEqual([
            expect.objectContaining({
                id: 'trigger:trigger-1',
                value: { kind: 'trigger', triggerId: 'trigger-1' },
                displayMode: 'button',
            }),
        ]);
        expect(current?.data.optionsGenerator).toBeTypeOf('function');
    });

    it('builds the production reaction prompt from the ChoiceRequest contract while keeping the legacy interaction id', () => {
        const state = withReactionSession(
            makeState({
                triggerQueue: [
                    makeTrigger(),
                    makeTrigger({
                        id: 'trigger-2',
                        sourceDefId: 'pirate_king',
                        sourceCardUid: 'minion-2',
                    }),
                ].map(trigger => ({
                    ...trigger,
                    derivedFootprint: {
                        reads: [],
                        writes: [{ kind: 'global' as const, key: 'timing-opportunity-test' }],
                    },
                })),
            }),
            'mandatory',
        );

        const advanced = advanceSmashUpReactionSession(state, defaultTestRandom, 99);
        const current = advanced?.state.sys.interaction.current;

        expect(current).toMatchObject({
            id: 'smashup_reaction_score-after:base-0_0_99',
            kind: 'simple-choice',
            playerId: '0',
            data: {
                sourceId: 'smashup_reaction_choose',
                targetType: 'field-source-action',
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
                allowedCommands: [SU_COMMANDS.REACTION_PASS],
                choiceRequest: {
                    requestId: 'smashup_reaction_score-after:base-0_0_99',
                    choiceKind: 'choose-option',
                    sourceId: 'smashup_reaction_choose',
                    aiStatus: 'game-policy',
                    metadata: {
                        opportunityId: 'smashup:reaction:score-after:base-0:mandatory:0',
                        legacyInteractionId: 'smashup_reaction_score-after:base-0_0_99',
                    },
                },
            },
        });
        expect(current?.data.options).toEqual([
            expect.objectContaining({
                id: 'trigger:trigger-1',
                value: { kind: 'trigger', triggerId: 'trigger-1' },
            }),
            expect.objectContaining({
                id: 'trigger:trigger-2',
                value: { kind: 'trigger', triggerId: 'trigger-2' },
            }),
        ]);
        expect(current?.data.optionsGenerator).toBeTypeOf('function');
        expect(current?.data.runtimePrompt).toBeUndefined();
        expect((current?.data.ai as { decisions?: Array<{ metadata?: Record<string, unknown> }> } | undefined)
            ?.decisions?.[0]?.metadata).toMatchObject({
            opportunityId: 'smashup:reaction:score-after:base-0:mandatory:0',
            legacyInteractionId: 'smashup_reaction_score-after:base-0_0_99',
        });
    });

    it('does not double-queue when the legacy production prompt already carries the same opportunity id', () => {
        const state = withReactionSession(
            makeState({
                triggerQueue: [
                    makeTrigger(),
                    makeTrigger({
                        id: 'trigger-2',
                        sourceDefId: 'pirate_king',
                        sourceCardUid: 'minion-2',
                    }),
                ].map(trigger => ({
                    ...trigger,
                    derivedFootprint: {
                        reads: [],
                        writes: [{ kind: 'global' as const, key: 'timing-opportunity-test' }],
                    },
                })),
            }),
            'mandatory',
        );
        const legacyPrompted = advanceSmashUpReactionSession(state, defaultTestRandom, 99);
        const timingSystem = smashUpSystemsForTest.find(system => system.id === SYSTEM_IDS.TIMING_OPPORTUNITY);

        const result = timingSystem?.afterEvents?.({
            state: legacyPrompted!.state,
            events: [makeTimingPoint().event!],
            command: {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'action-1' },
                timestamp: 42,
            },
            random: defaultTestRandom,
            playerIds: ['0', '1'],
        });

        expect(result).toBeUndefined();
        expect(legacyPrompted?.state.sys.interaction.current?.id)
            .toBe('smashup_reaction_score-after:base-0_0_99');
        expect(legacyPrompted?.state.sys.interaction.queue).toEqual([]);
    });
});
