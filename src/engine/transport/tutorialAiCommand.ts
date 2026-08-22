import type { MatchState } from '../types';

const TUTORIAL_INTERACTION_COMMANDS = new Set([
    'SYS_INTERACTION_RESPOND',
    'SYS_INTERACTION_CONFIRM',
    'SYS_INTERACTION_CANCEL',
]);

const TUTORIAL_CHOICE_CANDIDATE_ID_KEY = '__tutorialChoiceCandidateId';
const TUTORIAL_CHOICE_COMMAND_TYPE_KEY = '__tutorialChoiceCommandType';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

function omitTutorialChoicePayloadMeta(payload: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(payload).filter(([key]) => (
            key !== TUTORIAL_CHOICE_CANDIDATE_ID_KEY
            && key !== TUTORIAL_CHOICE_COMMAND_TYPE_KEY
        )),
    );
}

function readCurrentChoiceRequestContract<TCore>(
    state: MatchState<TCore>,
): Record<string, unknown> | null {
    const currentInteraction = state.sys?.interaction?.current as {
        data?: unknown;
    } | undefined;
    const data = isRecord(currentInteraction?.data) ? currentInteraction.data : null;
    const contract = isRecord(data?.choiceRequestContract) ? data.choiceRequestContract : null;
    if (!contract || !Array.isArray(contract.candidates)) return null;
    return contract;
}

function resolveTutorialChoiceCandidatePayload<TCore>(args: {
    state: MatchState<TCore>;
    commandType: string;
    payload: unknown;
    tutorialPlayerId?: string;
    isTutorialAiCommand: boolean;
}): unknown {
    const {
        state,
        commandType,
        payload,
        tutorialPlayerId,
        isTutorialAiCommand,
    } = args;
    const payloadRecord = isRecord(payload) ? payload : null;
    const candidateId = typeof payloadRecord?.[TUTORIAL_CHOICE_CANDIDATE_ID_KEY] === 'string'
        ? payloadRecord[TUTORIAL_CHOICE_CANDIDATE_ID_KEY]
        : undefined;
    if (!candidateId) return payload;
    if (!isTutorialAiCommand) return payload;

    const currentInteraction = state.sys?.interaction?.current as {
        id?: unknown;
        playerId?: unknown;
    } | undefined;
    if (!currentInteraction) {
        throw new Error(`教程 AI 候选 ${candidateId} 需要当前 ChoiceRequest 交互，但当前没有活动交互`);
    }
    if (
        tutorialPlayerId
        && typeof currentInteraction.playerId === 'string'
        && currentInteraction.playerId !== tutorialPlayerId
    ) {
        throw new Error(
            `教程 AI 候选 ${candidateId} 属于玩家 ${tutorialPlayerId}，但当前交互属于玩家 ${currentInteraction.playerId}`,
        );
    }

    const contract = readCurrentChoiceRequestContract(state);
    if (!contract) {
        throw new Error(`教程 AI 候选 ${candidateId} 需要当前交互携带 ChoiceRequest 合同`);
    }
    if (
        tutorialPlayerId
        && typeof contract.playerId === 'string'
        && contract.playerId !== tutorialPlayerId
    ) {
        throw new Error(
            `教程 AI 候选 ${candidateId} 属于玩家 ${tutorialPlayerId}，但 ChoiceRequest 属于玩家 ${contract.playerId}`,
        );
    }

    const commandTypeOverride = typeof payloadRecord?.[TUTORIAL_CHOICE_COMMAND_TYPE_KEY] === 'string'
        ? payloadRecord[TUTORIAL_CHOICE_COMMAND_TYPE_KEY]
        : commandType;
    const candidates = contract.candidates
        .filter(isRecord);
    const candidate = candidates.find((item) => (
        item.id === candidateId
        && item.disabled !== true
        && item.stale !== true
    ));
    if (!candidate) {
        throw new Error(`教程 AI 候选 ${candidateId} 不属于当前可用 ChoiceRequest`);
    }

    const commands = Array.isArray(candidate.commands)
        ? candidate.commands.filter(isRecord)
        : [];
    const candidateCommand = commands.find((item) => item.type === commandTypeOverride);
    if (!candidateCommand) {
        throw new Error(`教程 AI 候选 ${candidateId} 没有 ${commandTypeOverride} 命令`);
    }

    const passthroughPayload = omitTutorialChoicePayloadMeta(payloadRecord ?? {});
    const commandPayload = candidateCommand.payload;
    if (!isRecord(commandPayload)) return commandPayload ?? passthroughPayload;
    return {
        ...passthroughPayload,
        ...commandPayload,
    };
}

export function injectTutorialInteractionId<TCore>(args: {
    state: MatchState<TCore>;
    commandType: string;
    payload: unknown;
    tutorialPlayerId?: string;
    isTutorialAiCommand: boolean;
}): unknown {
    const {
        state,
        commandType,
        payload,
        tutorialPlayerId,
        isTutorialAiCommand,
    } = args;

    const choiceResolvedPayload = resolveTutorialChoiceCandidatePayload({
        state,
        commandType,
        payload,
        tutorialPlayerId,
        isTutorialAiCommand,
    });

    if (!isTutorialAiCommand || !TUTORIAL_INTERACTION_COMMANDS.has(commandType)) {
        return choiceResolvedPayload;
    }

    const currentInteraction = state.sys?.interaction?.current as {
        id?: unknown;
        playerId?: unknown;
    } | undefined;
    if (!currentInteraction || typeof currentInteraction.id !== 'string' || currentInteraction.id.length === 0) {
        return payload;
    }

    if (
        tutorialPlayerId
        && typeof currentInteraction.playerId === 'string'
        && currentInteraction.playerId !== tutorialPlayerId
    ) {
        return payload;
    }

    if (isRecord(choiceResolvedPayload)) {
        const existingInteractionId = choiceResolvedPayload.interactionId;
        if (typeof existingInteractionId === 'string' && existingInteractionId.length > 0) {
            return choiceResolvedPayload;
        }
        return {
            ...choiceResolvedPayload,
            interactionId: currentInteraction.id,
        };
    }

    return {
        interactionId: currentInteraction.id,
    };
}
