import { buildChoiceRequestDiagnosticSnapshot, type ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import { queueInteraction, type InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { syncActiveResolutionWithInteraction } from '../../../engine/systems/resolutionStack';
import type { TimingOpportunitySystemConfig } from '../../../engine/systems/TimingOpportunitySystem';
import type {
    Opportunity,
    TimingOpportunityDiscoveryArgs,
    TimingOpportunityDiscoveryResult,
} from '../../../engine/TimingOpportunity';
import type { MatchState } from '../../../engine/types';
import { getTokenUseOptions } from './tokenTypes';
import { getUsableTokenAmountForTiming, getUsableTokensForTiming } from './tokenResponse';
import {
    buildDiceThroneDamageShieldPreventionOpportunityId,
    buildDiceThroneTokenResponseFrameIdFromPendingDamageId,
    DICETHRONE_DAMAGE_SHIELD_PREVENTION_SOURCE_ID,
    resolveDiceThroneTokenResponseFramePendingDamageId,
} from './timingOpportunityIdentities';
import type { DamageDealtEvent, DiceThroneCommand, DiceThroneCore, DiceThroneEvent, PendingDamage } from './types';
import type { DamageShield } from './types';

export const DICETHRONE_TOKEN_RESPONSE_SOURCE_ID = 'dicethrone_token_response';
export const DICETHRONE_TOKEN_RESPONSE_AI_POLICY_ID = 'dicethrone-token-response';

export type DiceThroneTokenResponseChoiceValue =
    | {
        kind: 'use-token';
        tokenId: string;
        amount: number;
    }
    | {
        kind: 'skip';
    };

interface DamagePreventionSubject {
    id: string;
    sourcePlayerId?: string;
    targetPlayerId: string;
    originalDamage: number;
    currentDamage: number;
    sourceAbilityId?: string;
    damageScope?: 'attack' | 'direct';
    bypassShields?: boolean;
    isUltimateDamage?: boolean;
}

export function buildDiceThroneTokenResponseOpportunityId(pendingDamage: PendingDamage): string {
    return [
        'dicethrone:token-response',
        pendingDamage.id,
        pendingDamage.responseType,
        pendingDamage.responderId,
    ].join(':');
}

export function buildDiceThroneTokenResponseFrameId(pendingDamage: PendingDamage): string {
    return buildDiceThroneTokenResponseFrameIdFromPendingDamageId(pendingDamage.id);
}

function buildDiceThroneTokenResponseFrameOpportunityId(pendingDamage: PendingDamage): string {
    return ['dicethrone:token-response-frame-opportunity', pendingDamage.id].join(':');
}

function buildTokenResponseCandidate(
    state: DiceThroneCore,
    pendingDamage: PendingDamage,
    tokenId: string,
    tokenName: string,
    amount: number,
): ChoiceRequestCandidate<DiceThroneTokenResponseChoiceValue> {
    return {
        id: `use-token:${tokenId}:${amount}`,
        label: amount === 1 ? tokenName : `${tokenName} x${amount}`,
        value: {
            kind: 'use-token',
            tokenId,
            amount,
        },
        displayMode: 'button',
        commands: [{
            type: 'USE_TOKEN',
            payload: { tokenId, amount, pendingDamageId: pendingDamage.id },
        }],
        actionKind: 'token-response',
        actionKeyParts: [
            'dicethrone-token-response',
            pendingDamage.id,
            pendingDamage.responseType,
            pendingDamage.responderId,
            tokenId,
            amount,
        ],
        metadata: {
            pendingDamageId: pendingDamage.id,
            responseType: pendingDamage.responseType,
            responderId: pendingDamage.responderId,
            currentDamage: pendingDamage.currentDamage,
            originalDamage: pendingDamage.originalDamage,
            tokenId,
            amount,
            availableAmount: getUsableTokenAmountForTiming(
                state,
                pendingDamage.responderId,
                tokenId,
                pendingDamage.responseType,
                {
                    damageScope: pendingDamage.damageScope,
                    originalDamageOverride: pendingDamage.originalDamage,
                },
            ),
        },
    };
}

function buildSkipCandidate(
    pendingDamage: PendingDamage,
): ChoiceRequestCandidate<DiceThroneTokenResponseChoiceValue> {
    return {
        id: 'skip',
        label: 'Skip token response',
        labelKey: 'tokenResponse.skipResponse',
        value: { kind: 'skip' },
        displayMode: 'button',
        commands: [{
            type: 'SKIP_TOKEN_RESPONSE',
            payload: { pendingDamageId: pendingDamage.id },
        }],
        actionKind: 'skip-token-response',
        actionKeyParts: [
            'dicethrone-token-response',
            pendingDamage.id,
            pendingDamage.responseType,
            pendingDamage.responderId,
            'skip',
        ],
        metadata: {
            pendingDamageId: pendingDamage.id,
            responseType: pendingDamage.responseType,
            responderId: pendingDamage.responderId,
            currentDamage: pendingDamage.currentDamage,
            originalDamage: pendingDamage.originalDamage,
            skip: true,
        },
    };
}

export function buildDiceThroneTokenResponseChoiceCandidates(
    state: DiceThroneCore,
    pendingDamage: PendingDamage,
): ChoiceRequestCandidate<DiceThroneTokenResponseChoiceValue>[] {
    const tokenCandidates = getUsableTokensForTiming(
        state,
        pendingDamage.responderId,
        pendingDamage.responseType,
        {
            damageScope: pendingDamage.damageScope,
            originalDamageOverride: pendingDamage.originalDamage,
        },
    ).flatMap((tokenDef) => {
        const availableAmount = getUsableTokenAmountForTiming(
            state,
            pendingDamage.responderId,
            tokenDef.id,
            pendingDamage.responseType,
            {
                damageScope: pendingDamage.damageScope,
                originalDamageOverride: pendingDamage.originalDamage,
            },
        );
        return getTokenUseOptions(tokenDef, availableAmount)
            .map((amount) => buildTokenResponseCandidate(
                state,
                pendingDamage,
                tokenDef.id,
                tokenDef.name,
                amount,
            ));
    });

    return [
        ...tokenCandidates,
        buildSkipCandidate(pendingDamage),
    ];
}

export function buildDiceThroneTokenResponseOpportunity(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
    pendingDamage: PendingDamage,
): Opportunity<DiceThroneTokenResponseChoiceValue> {
    const opportunityId = buildDiceThroneTokenResponseOpportunityId(pendingDamage);
    const resolutionFrameId = buildDiceThroneTokenResponseFrameId(pendingDamage);
    const metadata = {
        pendingDamageId: pendingDamage.id,
        resolutionFrameId,
        sourcePlayerId: pendingDamage.sourcePlayerId,
        targetPlayerId: pendingDamage.targetPlayerId,
        responderId: pendingDamage.responderId,
        responseType: pendingDamage.responseType,
        sourceAbilityId: pendingDamage.sourceAbilityId,
        damageScope: pendingDamage.damageScope,
        originalDamage: pendingDamage.originalDamage,
        currentDamage: pendingDamage.currentDamage,
        priority: pendingDamage.responseType === 'beforeDamageDealt' ? 80 : 70,
    };

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'system',
            id: DICETHRONE_TOKEN_RESPONSE_SOURCE_ID,
            controllerId: pendingDamage.responderId,
            metadata,
        },
        controllerId: pendingDamage.responderId,
        class: 'optional',
        condition: true,
        resolution: { type: 'choice-request' },
        ordering: 'explicit',
        visibility: { scope: 'controller' },
        aiSupport: {
            status: 'game-policy',
            policyId: DICETHRONE_TOKEN_RESPONSE_AI_POLICY_ID,
        },
        choice: {
            requestId: opportunityId,
            playerId: pendingDamage.responderId,
            kind: 'choose-option',
            candidates: buildDiceThroneTokenResponseChoiceCandidates(args.state.core, pendingDamage),
            selection: { min: 1, max: 1 },
            resolution: { type: 'candidate-commands' },
            ai: {
                status: 'game-policy',
                policyId: DICETHRONE_TOKEN_RESPONSE_AI_POLICY_ID,
            },
            metadata,
        },
        metadata,
    };
}

export function buildDiceThroneTokenResponseFrameOpportunity(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
    pendingDamage: PendingDamage,
): Opportunity<DiceThroneTokenResponseChoiceValue> {
    const frameId = buildDiceThroneTokenResponseFrameId(pendingDamage);
    const metadata = {
        pendingDamageId: pendingDamage.id,
        resolutionFrameId: frameId,
        sourcePlayerId: pendingDamage.sourcePlayerId,
        targetPlayerId: pendingDamage.targetPlayerId,
        responderId: pendingDamage.responderId,
        responseType: pendingDamage.responseType,
        sourceAbilityId: pendingDamage.sourceAbilityId,
        damageScope: pendingDamage.damageScope,
        originalDamage: pendingDamage.originalDamage,
        currentDamage: pendingDamage.currentDamage,
        priority: 95,
    };

    return {
        id: buildDiceThroneTokenResponseFrameOpportunityId(pendingDamage),
        timing: args.timing,
        sourceRef: {
            kind: 'system',
            id: DICETHRONE_TOKEN_RESPONSE_SOURCE_ID,
            controllerId: pendingDamage.responderId,
            metadata,
        },
        controllerId: pendingDamage.responderId,
        class: 'mandatory',
        condition: true,
        resolution: {
            type: 'child-frame',
            frameId,
            frameKind: 'dicethrone-token-response',
            ordering: 'explicit',
            phaseGate: 'block-advance-when-blocked',
            metadata,
        },
        ordering: 'explicit',
        visibility: { scope: 'controller' },
        metadata,
    };
}

function shouldDiscoverTokenResponseOpportunity(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
): boolean {
    return args.timing.position !== 'prevent' && args.timing.position !== 'replace';
}

function isDamageShieldPreventionTiming(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
): boolean {
    return args.timing.position === 'prevent' && args.timing.factKind === 'damage';
}

function isDamagePreventingShield(shield: DamageShield): boolean {
    return (typeof shield.value === 'number' && shield.value > 0)
        || (typeof shield.reductionPercent === 'number' && shield.reductionPercent > 0);
}

function buildDamageShieldPreventionOpportunity(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
    pendingDamage: DamagePreventionSubject,
    shield: DamageShield,
    shieldIndex: number,
): Opportunity {
    const metadata = {
        pendingDamageId: pendingDamage.id,
        sourcePlayerId: pendingDamage.sourcePlayerId,
        targetPlayerId: pendingDamage.targetPlayerId,
        sourceAbilityId: pendingDamage.sourceAbilityId,
        damageScope: pendingDamage.damageScope,
        originalDamage: pendingDamage.originalDamage,
        currentDamage: pendingDamage.currentDamage,
        shieldSourceId: shield.sourceId,
        shieldIndex,
        shieldValue: shield.value,
        shieldReductionPercent: shield.reductionPercent,
        preventStatus: shield.preventStatus === true,
        priority: 90,
    };

    return {
        id: buildDiceThroneDamageShieldPreventionOpportunityId({
            pendingDamageId: pendingDamage.id,
            targetPlayerId: pendingDamage.targetPlayerId,
            shieldIndex,
            shieldSourceId: shield.sourceId,
        }),
        timing: args.timing,
        sourceRef: {
            kind: 'status',
            id: DICETHRONE_DAMAGE_SHIELD_PREVENTION_SOURCE_ID,
            controllerId: pendingDamage.targetPlayerId,
            metadata,
        },
        controllerId: pendingDamage.targetPlayerId,
        class: 'prevention',
        condition: true,
        resolution: { type: 'none' },
        ordering: 'explicit',
        visibility: { scope: 'controller' },
        metadata,
    };
}

function discoverDamageShieldPreventionOpportunities(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
    pendingDamage: DamagePreventionSubject,
): Opportunity[] {
    if (
        !isDamageShieldPreventionTiming(args)
        || pendingDamage.currentDamage <= 0
        || pendingDamage.bypassShields
        || pendingDamage.isUltimateDamage
    ) {
        return [];
    }

    const target = args.state.core.players[pendingDamage.targetPlayerId];
    if (!target?.damageShields?.length) return [];

    return target.damageShields
        .map((shield, index) => ({ shield, index }))
        .filter(({ shield }) => isDamagePreventingShield(shield))
        .map(({ shield, index }) => buildDamageShieldPreventionOpportunity(args, pendingDamage, shield, index));
}

function isDamageDealtEvent(event: DiceThroneEvent | undefined): event is DamageDealtEvent {
    return event?.type === 'DAMAGE_DEALT';
}

function buildDamagePreventionSubjectFromDamageEvent(
    state: DiceThroneCore,
    event: DamageDealtEvent,
): DamagePreventionSubject | undefined {
    const pendingDamageId = resolveDiceThroneTokenResponseFramePendingDamageId(event.payload.resolutionFrameId);
    if (!pendingDamageId) return undefined;

    return {
        id: pendingDamageId,
        sourcePlayerId: event.payload.sourcePlayerId,
        targetPlayerId: event.payload.targetId,
        originalDamage: event.payload.amount,
        currentDamage: event.payload.amount,
        sourceAbilityId: event.payload.sourceAbilityId,
        damageScope: event.payload.damageScope,
        bypassShields: event.payload.bypassShields,
        isUltimateDamage: state.pendingAttack?.isUltimate === true,
    };
}

function resolveDamagePreventionSubject(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
): DamagePreventionSubject | undefined {
    if (args.state.core.pendingDamage) {
        return {
            ...args.state.core.pendingDamage,
            isUltimateDamage: args.state.core.pendingAttack?.isUltimate === true,
        };
    }
    if (!isDamageShieldPreventionTiming(args)) return undefined;
    return isDamageDealtEvent(args.timing.event)
        ? buildDamagePreventionSubjectFromDamageEvent(args.state.core, args.timing.event)
        : undefined;
}

export function discoverDiceThroneTimingOpportunities(
    args: TimingOpportunityDiscoveryArgs<DiceThroneCore, DiceThroneCommand, DiceThroneEvent>,
): TimingOpportunityDiscoveryResult<DiceThroneTokenResponseChoiceValue> {
    const pendingDamage = args.state.core.pendingDamage;
    const damagePreventionSubject = resolveDamagePreventionSubject(args);
    if (!pendingDamage && !damagePreventionSubject) {
        return { opportunities: [] };
    }

    return {
        opportunities: [
            ...(pendingDamage && shouldDiscoverTokenResponseOpportunity(args)
                ? [
                    buildDiceThroneTokenResponseFrameOpportunity(args, pendingDamage),
                    buildDiceThroneTokenResponseOpportunity(args, pendingDamage),
                ]
                : []),
            ...(damagePreventionSubject
                ? discoverDamageShieldPreventionOpportunities(args, damagePreventionSubject)
                : []),
        ],
    };
}

function clearDiceThroneChoiceAnchor(state: MatchState<DiceThroneCore>): MatchState<DiceThroneCore> {
    if (state.core.currentChoiceSourceAbilityId === undefined) return state;
    return {
        ...state,
        core: {
            ...state.core,
            currentChoiceSourceAbilityId: undefined,
        },
    };
}

function queueDiceThroneTokenResponseInteraction(args: {
    state: MatchState<DiceThroneCore>;
    interaction: InteractionDescriptor;
}): MatchState<DiceThroneCore> {
    const { state, interaction } = args;
    const interactionWithFrame = interaction.resolutionFrameId
        ? interaction
        : {
            ...interaction,
            resolutionFrameId: state.sys.resolution?.activeFrameId,
        };
    const current = state.sys.interaction.current;
    const currentIsTokenResponse = current?.kind === 'dt:token-response' && interactionWithFrame.kind === 'dt:token-response';
    const queuedIndex = state.sys.interaction.queue.findIndex((item) => item.id === interactionWithFrame.id);
    const queued = currentIsTokenResponse
        ? syncActiveResolutionWithInteraction({
            ...state,
            sys: {
                ...state.sys,
                interaction: {
                    ...state.sys.interaction,
                    current: interactionWithFrame,
                },
            },
        })
        : queuedIndex >= 0
            ? {
                ...state,
                sys: {
                    ...state.sys,
                    interaction: {
                        ...state.sys.interaction,
                        queue: state.sys.interaction.queue.map((item, index) => (
                            index === queuedIndex ? interactionWithFrame : item
                        )),
                    },
                },
            }
            : queueInteraction(state, interactionWithFrame);
    return clearDiceThroneChoiceAnchor(queued);
}

export function createDiceThroneTimingOpportunitySystemConfig(): TimingOpportunitySystemConfig<
    DiceThroneTokenResponseChoiceValue,
    DiceThroneCore
> {
    return {
        choiceRequestInteraction: ({ opportunity, choiceRequest }) => {
            if (opportunity.sourceRef.id !== DICETHRONE_TOKEN_RESPONSE_SOURCE_ID) {
                return null;
            }

            const pendingDamageId = typeof choiceRequest.metadata?.pendingDamageId === 'string'
                ? choiceRequest.metadata.pendingDamageId
                : choiceRequest.requestId;
            return {
                id: `dt-token-response-${pendingDamageId}`,
                kind: 'dt:token-response',
                playerId: choiceRequest.playerId,
                resolutionFrameId: typeof choiceRequest.metadata?.resolutionFrameId === 'string'
                    ? choiceRequest.metadata.resolutionFrameId
                    : undefined,
                data: {
                    choiceRequest: buildChoiceRequestDiagnosticSnapshot(choiceRequest),
                    choiceRequestContract: choiceRequest,
                },
            };
        },
        queueChoiceInteraction: ({ state, interaction }) => (
            interaction.kind === 'dt:token-response'
                ? queueDiceThroneTokenResponseInteraction({ state, interaction })
                : queueInteraction(state, interaction)
        ),
    };
}
