import type {
    ChoiceRequest,
    ChoiceRequestCandidate,
    ChoiceRequestSelectionBounds,
} from '../ChoiceRequest';
import type { AiDecisionDescriptor, AiDecisionKind, AiDecisionSkipPolicy } from '../ai/decisionSemantics';
import { createSimpleChoice, type InteractionDescriptor, type PromptMultiConfig, type PromptOption, type SimpleChoiceData, type SimpleChoiceTargetType } from './InteractionSystem';

export interface CreateSimpleChoiceFromChoiceRequestOptions {
    title: string;
    titleKey?: string;
    targetType?: SimpleChoiceTargetType;
    autoRefresh?: SimpleChoiceData['autoRefresh'];
    responseValidationMode?: SimpleChoiceData['responseValidationMode'];
}

function toPromptMultiConfig(selection: ChoiceRequestSelectionBounds): PromptMultiConfig | undefined {
    if (selection.min === 1 && selection.max === 1 && selection.ordered !== true) return undefined;
    return {
        min: selection.min,
        max: selection.max,
        ordered: selection.ordered,
    };
}

function toAiDecisionSkipPolicy(skipPolicy: ChoiceRequest['skipPolicy']): AiDecisionSkipPolicy {
    if (skipPolicy === 'optional' || skipPolicy === 'cancel-only' || skipPolicy === 'confirm-current') {
        return 'optional';
    }
    if (skipPolicy === 'required') return 'required';
    return 'forbidden';
}

function toAiDecisionKind(kind: ChoiceRequest['kind']): AiDecisionKind {
    if (kind === 'pass') return 'optional-skip';
    return kind;
}

function toAiDecisionDescriptor<TValue>(request: ChoiceRequest<TValue>): AiDecisionDescriptor {
    return {
        kind: toAiDecisionKind(request.kind),
        interactionId: request.requestId,
        actorPlayerId: request.playerId,
        sourceId: request.sourceId,
        selection: {
            min: request.selection.min,
            max: request.selection.max,
            ordered: request.selection.ordered,
            maxGeneratedSelections: request.selection.maxGeneratedSelections,
        },
        skipPolicy: toAiDecisionSkipPolicy(request.skipPolicy),
        candidates: request.candidates.map((candidate) => ({
            id: candidate.id,
            label: candidate.label,
            disabled: candidate.disabled,
            disabledReason: candidate.disabledReason,
            aiHints: candidate.aiHints,
            metadata: candidate.metadata,
            actionKeyParts: candidate.actionKeyParts,
            value: candidate.value,
        })),
        metadata: request.metadata,
    } as AiDecisionDescriptor;
}

function toPromptOption<TValue>(candidate: ChoiceRequestCandidate<TValue>): PromptOption<TValue> {
    return {
        id: candidate.id,
        label: candidate.label ?? candidate.id,
        value: candidate.value as TValue,
        disabled: candidate.disabled,
        disabledReason: candidate.disabledReason,
        _ai: candidate.aiHints?.[0],
    };
}

export function createSimpleChoiceFromChoiceRequest<TValue>(
    request: ChoiceRequest<TValue>,
    options: CreateSimpleChoiceFromChoiceRequestOptions,
): InteractionDescriptor<SimpleChoiceData<TValue>> {
    return createSimpleChoice(
        request.requestId,
        request.playerId,
        options.title,
        request.candidates.map(toPromptOption),
        {
            sourceId: request.sourceId,
            titleKey: options.titleKey,
            multi: toPromptMultiConfig(request.selection),
            targetType: options.targetType,
            autoRefresh: options.autoRefresh,
            responseValidationMode: options.responseValidationMode,
            autoResolveIfSingle: false,
            ai: {
                status: 'semantic',
                decisions: [toAiDecisionDescriptor(request)],
            },
        },
    );
}
