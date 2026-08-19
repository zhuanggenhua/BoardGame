import {
    filterChoiceRequestForPlayer,
    validateChoiceRequest,
    type ChoiceRequest,
    type ChoiceRequestCandidate,
    type ChoiceRequestDiagnostic,
} from '../ChoiceRequest';
import type { AiActionMetadata, AiCommandSpec } from '../ai/types';
import type { PlayerId } from '../types';

export type ChoiceRequestDirectTargetRef = string | number | Record<string, unknown>;

export interface ChoiceRequestDirectSelectionTarget<TValue = unknown> {
    id: string;
    label?: string;
    labelKey?: string;
    labelParams?: Record<string, string | number>;
    description?: string;
    value?: TValue;
    disabled: boolean;
    disabledReason?: string;
    stale: boolean;
    displayMode?: 'card' | 'button';
    targetRef: ChoiceRequestDirectTargetRef;
    commandPreview: AiCommandSpec[];
    metadata?: AiActionMetadata;
}

export interface ChoiceRequestDirectSelectionSurface<TValue = unknown> {
    requestId: string;
    playerId: PlayerId;
    kind: ChoiceRequest['kind'];
    sourceId?: string;
    selection: ChoiceRequest['selection'];
    targets: ChoiceRequestDirectSelectionTarget<TValue>[];
    diagnostics: ChoiceRequestDiagnostic[];
}

export interface ChoiceRequestDirectAdapterOptions<TValue = unknown> {
    playerId?: PlayerId;
    resolveTargetRef?: (
        candidate: ChoiceRequestCandidate<TValue>,
        request: ChoiceRequest<TValue>,
    ) => ChoiceRequestDirectTargetRef | undefined;
}

export interface ChoiceRequestConfirmCurrentAction {
    requestId: string;
    playerId: PlayerId;
    label: string;
    commands: AiCommandSpec[];
    metadata?: AiActionMetadata;
}

export interface ChoiceRequestConfirmCurrentProjection {
    action: ChoiceRequestConfirmCurrentAction | null;
    diagnostics: ChoiceRequestDiagnostic[];
}

export interface ChoiceRequestDiceConfirmationSurface<TValue = unknown> {
    requestId: string;
    playerId: PlayerId;
    sourceId?: string;
    diceTargets: ChoiceRequestDirectSelectionTarget<TValue>[];
    confirmAction: ChoiceRequestConfirmCurrentAction | null;
    diagnostics: ChoiceRequestDiagnostic[];
}

const readRecord = (value: unknown): Record<string, unknown> | null => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
);

const resolveDefaultTargetRef = <TValue>(
    candidate: ChoiceRequestCandidate<TValue>,
): ChoiceRequestDirectTargetRef => {
    const value = readRecord(candidate.value);
    const metadata = readRecord(candidate.metadata);
    const candidateRecord = candidate as unknown as Record<string, unknown>;
    const keys = ['targetId', 'objectId', 'cardId', 'playerId', 'dieId', 'positionId', 'position'];

    for (const source of [candidateRecord, value, metadata]) {
        if (!source) continue;
        for (const key of keys) {
            const targetRef = source[key];
            if (
                typeof targetRef === 'string'
                || typeof targetRef === 'number'
                || readRecord(targetRef)
            ) {
                return targetRef as ChoiceRequestDirectTargetRef;
            }
        }
    }

    return candidate.id;
};

const buildCandidateCommandPreview = <TValue>(
    request: ChoiceRequest<TValue>,
    candidate: ChoiceRequestCandidate<TValue>,
): AiCommandSpec[] => {
    switch (request.resolution.type) {
        case 'candidate-commands':
            return candidate.commands ?? [];
        case 'commands':
            return request.resolution.buildCommands([candidate], request);
        case 'interaction-response': {
            const interactionId = request.resolution.interactionId ?? request.requestId;
            const commandType = request.resolution.commandType ?? 'SYS_INTERACTION_RESPOND';
            return [{
                type: commandType,
                payload: { interactionId, optionId: candidate.id },
            }];
        }
        default:
            return [];
    }
};

export function projectChoiceRequestToDirectSelectionTargets<TValue>(
    request: ChoiceRequest<TValue>,
    options: ChoiceRequestDirectAdapterOptions<TValue> = {},
): ChoiceRequestDirectSelectionSurface<TValue> {
    const visibleRequest = options.playerId
        ? filterChoiceRequestForPlayer(request, options.playerId)
        : request;
    const diagnostics = validateChoiceRequest(visibleRequest);

    return {
        requestId: visibleRequest.requestId,
        playerId: visibleRequest.playerId,
        kind: visibleRequest.kind,
        sourceId: visibleRequest.sourceId,
        selection: visibleRequest.selection,
        diagnostics,
        targets: visibleRequest.candidates.map((candidate) => ({
            id: candidate.id,
            label: candidate.label,
            labelKey: candidate.labelKey,
            labelParams: candidate.labelParams,
            description: candidate.description,
            value: candidate.value,
            disabled: candidate.disabled === true,
            disabledReason: candidate.disabledReason,
            stale: candidate.stale === true,
            displayMode: candidate.displayMode,
            targetRef: options.resolveTargetRef?.(candidate, visibleRequest)
                ?? resolveDefaultTargetRef(candidate),
            commandPreview: buildCandidateCommandPreview(visibleRequest, candidate),
            metadata: candidate.metadata,
        })),
    };
}

export function projectChoiceRequestToConfirmCurrentAction<TValue>(
    request: ChoiceRequest<TValue>,
): ChoiceRequestConfirmCurrentProjection {
    const diagnostics = validateChoiceRequest(request);
    const shouldExposeConfirm = request.kind === 'confirm' || request.skipPolicy === 'confirm-current';
    const recoveryAction = request.recoveryAction;
    if (!shouldExposeConfirm || !recoveryAction || recoveryAction.commands.length === 0) {
        return { action: null, diagnostics };
    }

    return {
        diagnostics,
        action: {
            requestId: request.requestId,
            playerId: request.playerId,
            label: recoveryAction.label,
            commands: recoveryAction.commands,
            metadata: {
                requestId: request.requestId,
                choiceKind: request.kind,
                sourceId: request.sourceId,
                recoveryAction: true,
                ...recoveryAction.metadata,
            },
        },
    };
}

export function projectChoiceRequestToDiceConfirmationSurface<TValue>(
    request: ChoiceRequest<TValue>,
    options: ChoiceRequestDirectAdapterOptions<TValue> = {},
): ChoiceRequestDiceConfirmationSurface<TValue> {
    const directSurface = projectChoiceRequestToDirectSelectionTargets(request, options);
    const confirmProjection = projectChoiceRequestToConfirmCurrentAction(request);

    return {
        requestId: request.requestId,
        playerId: request.playerId,
        sourceId: request.sourceId,
        diceTargets: request.kind === 'select-dice' ? directSurface.targets : [],
        confirmAction: confirmProjection.action,
        diagnostics: directSurface.diagnostics,
    };
}
