import type { MatchState } from '../types';

const TUTORIAL_INTERACTION_COMMANDS = new Set([
    'SYS_INTERACTION_RESPOND',
    'SYS_INTERACTION_CONFIRM',
    'SYS_INTERACTION_CANCEL',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

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

    if (!isTutorialAiCommand || !TUTORIAL_INTERACTION_COMMANDS.has(commandType)) {
        return payload;
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

    if (isRecord(payload)) {
        const existingInteractionId = payload.interactionId;
        if (typeof existingInteractionId === 'string' && existingInteractionId.length > 0) {
            return payload;
        }
        return {
            ...payload,
            interactionId: currentInteraction.id,
        };
    }

    return {
        interactionId: currentInteraction.id,
    };
}
