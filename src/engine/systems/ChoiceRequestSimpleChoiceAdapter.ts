import {
    buildChoiceRequestDiagnosticSnapshot,
    type ChoiceRequest,
    type ChoiceRequestCandidate,
    type ChoiceRequestSelectionBounds,
} from '../ChoiceRequest';
import type { AiDecisionDescriptor, AiDecisionKind, AiDecisionSkipPolicy } from '../ai/decisionSemantics';
import {
    createSimpleChoice,
    type InteractionDescriptor,
    type PromptMultiConfig,
    type PromptOption,
    type SimpleChoiceButtonIntent,
    type SimpleChoiceData,
    type SimpleChoiceGenericIntent,
    type SimpleChoiceTargetType,
} from './InteractionSystem';

export interface CreateSimpleChoiceFromChoiceRequestOptions<TValue = unknown> {
    title: string;
    titleKey?: string;
    titleParams?: SimpleChoiceData['titleParams'];
    subtitle?: string;
    subtitleKey?: string;
    subtitleParams?: SimpleChoiceData['subtitleParams'];
    targetType?: SimpleChoiceTargetType;
    buttonIntent?: SimpleChoiceButtonIntent;
    genericIntent?: SimpleChoiceGenericIntent;
    autoResolveIfSingle?: boolean;
    autoRefresh?: SimpleChoiceData['autoRefresh'];
    responseValidationMode?: SimpleChoiceData['responseValidationMode'];
    allowedCommands?: SimpleChoiceData['allowedCommands'];
    optionsGenerator?: <TCore>(
        state: { core: TCore; sys: unknown },
        data: SimpleChoiceData<TValue>,
    ) => ChoiceRequestCandidate<TValue>[];
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
        labelKey: candidate.labelKey,
        labelParams: candidate.labelParams,
        description: candidate.description,
        value: candidate.value as TValue,
        disabled: candidate.disabled,
        disabledReason: candidate.disabledReason,
        displayMode: candidate.displayMode,
        _ai: candidate.aiHints?.[0],
    };
}

export function createSimpleChoiceFromChoiceRequest<TValue>(
    request: ChoiceRequest<TValue>,
    options: CreateSimpleChoiceFromChoiceRequestOptions<TValue>,
): InteractionDescriptor<SimpleChoiceData<TValue>> {
    const interaction = createSimpleChoice(
        request.requestId,
        request.playerId,
        options.title,
        request.candidates.map(toPromptOption),
        {
            sourceId: request.sourceId,
            titleKey: options.titleKey,
            titleParams: options.titleParams,
            subtitle: options.subtitle,
            subtitleKey: options.subtitleKey,
            subtitleParams: options.subtitleParams,
            multi: toPromptMultiConfig(request.selection),
            targetType: options.targetType,
            buttonIntent: options.buttonIntent,
            genericIntent: options.genericIntent,
            autoResolveIfSingle: options.autoResolveIfSingle,
            autoRefresh: options.autoRefresh,
            responseValidationMode: options.responseValidationMode,
            allowedCommands: options.allowedCommands,
            ...(options.optionsGenerator
                ? {
                    optionsGenerator: <TCore>(state: { core: TCore; sys: unknown }, data: SimpleChoiceData<TValue>) =>
                        options.optionsGenerator!(state, data).map(toPromptOption),
                }
                : {}),
            ai: {
                status: 'semantic',
                decisions: [toAiDecisionDescriptor(request)],
            },
        },
    );
    interaction.data.choiceRequest = buildChoiceRequestDiagnosticSnapshot(request);
    return interaction;
}
