import type { ChoiceRequest, ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import { createSimpleChoiceFromChoiceRequest } from '../../../engine/systems/ChoiceRequestSimpleChoiceAdapter';
import type {
    InteractionDescriptor,
    PromptMultiConfig,
    SimpleChoiceData,
    SimpleChoiceTargetType,
} from '../../../engine/systems/InteractionSystem';

const QIDAHEN_CHOICE_REQUEST_AI_POLICY_ID = 'qidahen-button-options';

export function createQidahenChoiceRequestInteraction<TValue>(args: {
    requestId: string;
    playerId: string;
    title: string;
    titleKey?: string;
    sourceId: string;
    candidates: ChoiceRequestCandidate<TValue>[];
    targetType?: SimpleChoiceTargetType;
    multi?: PromptMultiConfig;
    subtitle?: string;
    allowedCommands?: string[];
    autoResolveIfSingle?: boolean;
}): InteractionDescriptor<SimpleChoiceData<TValue>> {
    const min = args.multi?.min ?? 1;
    const max = args.multi?.max ?? min;
    const request: ChoiceRequest<TValue> = {
        requestId: args.requestId,
        gameId: 'qidahen',
        playerId: args.playerId,
        kind: 'choose-option',
        sourceId: args.sourceId,
        candidates: args.candidates,
        selection: {
            min,
            max,
            ordered: args.multi?.ordered,
        },
        skipPolicy: 'forbidden',
        resolution: { type: 'interaction-response', interactionId: args.requestId },
        ai: { status: 'shared-policy', policyId: QIDAHEN_CHOICE_REQUEST_AI_POLICY_ID },
    };

    return createSimpleChoiceFromChoiceRequest(request, {
        title: args.title,
        titleKey: args.titleKey,
        targetType: args.targetType ?? 'button',
        autoResolveIfSingle: args.autoResolveIfSingle ?? false,
        subtitle: args.subtitle,
        allowedCommands: args.allowedCommands,
    });
}
