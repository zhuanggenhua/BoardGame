import type { ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import type { CreateSimpleChoiceFromChoiceRequestOptions } from '../../../engine/systems/ChoiceRequestSimpleChoiceAdapter';
import { createSimpleChoiceFromTimingOpportunity } from '../../../engine/systems/TimingOpportunitySystem';
import type { InteractionDescriptor, SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import type {
    Opportunity,
    TimingOpportunityDiscoveryArgs,
} from '../../../engine/TimingOpportunity';
import { createTimingPoint } from '../../../engine/TimingOpportunity';
import type { MatchState } from '../../../engine/types';
import { FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE } from './fieldInteractionOptions';
import type { ReactionChoiceValue, ReactionOption } from './reactionSession';
import { SU_COMMANDS, type SmashUpCommand, type SmashUpCore, type SmashUpEvent, type SmashUpReactionSession } from './types';

export const SMASHUP_REACTION_CHOOSE_SOURCE_ID = 'smashup_reaction_choose';
export const SMASHUP_REACTION_AI_POLICY_ID = 'smashup-reaction-choice';

export function isNonPassSmashUpReactionOption(option: ReactionOption): boolean {
    return option.id !== 'pass' && option.value.kind !== 'pass';
}

export function buildSmashUpReactionOpportunityId(session: SmashUpReactionSession): string {
    return `smashup:reaction:${session.frameId}:${session.phase}:${session.activePlayerId}`;
}

export function buildSmashUpReactionChoiceCandidate(
    option: ReactionOption,
    index: number,
    session: SmashUpReactionSession,
): ChoiceRequestCandidate<ReactionChoiceValue> {
    return {
        id: option.id,
        label: option.label,
        labelKey: option.labelKey,
        labelParams: option.labelParams,
        value: option.value,
        displayMode: option.displayMode,
        actionKind: option.value.kind === 'pass'
            ? 'smashup-reaction-pass'
            : `smashup-reaction-${option.value.kind.replaceAll('_', '-')}`,
        actionKeyParts: [
            'smashup-reaction',
            session.frameId,
            session.phase,
            session.activePlayerId,
            option.id,
        ],
        metadata: {
            optionValue: option.value,
            optionOrder: index,
            frameId: session.frameId,
            frameKind: session.frameKind,
            phase: session.phase,
            responseWindowType: session.responseWindowType,
        },
    };
}

export function buildSmashUpReactionChoiceRequestOptions(
    phase: SmashUpReactionSession['phase'],
    optionsGenerator?: CreateSimpleChoiceFromChoiceRequestOptions<ReactionChoiceValue>['optionsGenerator'],
): CreateSimpleChoiceFromChoiceRequestOptions<ReactionChoiceValue> {
    return {
        title: phase === 'mandatory'
            ? 'ui.reaction_choose_mandatory_title'
            : 'ui.reaction_choose_optional_title',
        targetType: FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE,
        responseValidationMode: 'live',
        autoResolveIfSingle: false,
        allowedCommands: [SU_COMMANDS.REACTION_PASS],
        ...(optionsGenerator ? { optionsGenerator } : {}),
    };
}

export function buildSmashUpReactionOpportunity(
    args: TimingOpportunityDiscoveryArgs<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    session: SmashUpReactionSession,
    options: ReactionOption[],
): Opportunity<ReactionChoiceValue> {
    const opportunityId = buildSmashUpReactionOpportunityId(session);
    const timing = args.timing.parentFrameId
        ? args.timing
        : {
            ...args.timing,
            parentFrameId: session.frameId,
        };

    const metadata = {
        frameId: session.frameId,
        frameKind: session.frameKind,
        phase: session.phase,
        responseWindowType: session.responseWindowType,
        sourceBaseIndex: session.sourceBaseIndex,
        optionCount: options.length,
        nonPassOptionCount: options.filter(isNonPassSmashUpReactionOption).length,
        priority: session.phase === 'mandatory' ? 100 : 50,
    };

    return {
        id: opportunityId,
        timing,
        sourceRef: {
            kind: 'system',
            id: SMASHUP_REACTION_CHOOSE_SOURCE_ID,
            controllerId: session.activePlayerId,
            metadata,
        },
        controllerId: session.activePlayerId,
        class: session.phase === 'mandatory' ? 'mandatory' : 'optional',
        condition: true,
        resolution: { type: 'choice-request' },
        ordering: session.phase === 'mandatory' ? 'nested-body' : 'responder-round',
        visibility: { scope: 'controller' },
        aiSupport: {
            status: 'game-policy',
            policyId: SMASHUP_REACTION_AI_POLICY_ID,
        },
        choice: {
            requestId: opportunityId,
            playerId: session.activePlayerId,
            kind: 'choose-option',
            candidates: options.map((option, index) => buildSmashUpReactionChoiceCandidate(option, index, session)),
            selection: { min: 1, max: 1 },
            resolution: {
                type: 'interaction-response',
                interactionId: opportunityId,
            },
            ai: {
                status: 'game-policy',
                policyId: SMASHUP_REACTION_AI_POLICY_ID,
            },
            metadata,
        },
        metadata,
    };
}

export type SmashUpReactionChoiceRefresh = (
    state: { core: unknown; sys: unknown },
) => { session: SmashUpReactionSession; options: ReactionOption[] } | undefined;

export interface CreateSmashUpReactionChoiceInteractionArgs {
    state: MatchState<SmashUpCore>;
    session: SmashUpReactionSession;
    now: number;
    options: ReactionOption[];
    interactionId?: string;
    refresh?: SmashUpReactionChoiceRefresh;
}

export function createSmashUpReactionChoiceInteraction(
    args: CreateSmashUpReactionChoiceInteractionArgs,
): InteractionDescriptor<SimpleChoiceData<ReactionChoiceValue>> {
    const { state, session, now, options } = args;
    const interactionId = args.interactionId ?? `smashup_reaction_${session.frameId}_${session.activePlayerId}_${now}`;
    const timing = createTimingPoint<SmashUpCommand, SmashUpEvent>({
        gameId: 'smashup',
        position: 'postCommit',
        factKind: session.responseWindowType ?? session.frameKind,
        source: {
            kind: 'system',
            id: SMASHUP_REACTION_CHOOSE_SOURCE_ID,
            controllerId: session.activePlayerId,
        },
        parentFrameId: session.frameId,
        timestamp: now,
        metadata: {
            frameId: session.frameId,
            frameKind: session.frameKind,
            phase: session.phase,
            responseWindowType: session.responseWindowType,
        },
    });
    const opportunity = buildSmashUpReactionOpportunity(
        { state, timing },
        session,
        options,
    );
    return createSimpleChoiceFromTimingOpportunity(
        opportunity,
        buildSmashUpReactionChoiceRequestOptions(
            session.phase,
            args.refresh
                ? (latestState) => {
                    const refreshed = args.refresh?.(latestState);
                    if (!refreshed) return [];
                    return refreshed.options
                        .map((option, index) => buildSmashUpReactionChoiceCandidate(option, index, refreshed.session));
                }
                : undefined,
        ),
        {
            requestId: interactionId,
            interactionId,
            metadata: {
                legacyInteractionId: interactionId,
            },
        },
    );
}
