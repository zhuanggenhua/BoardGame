export const QIDAHEN_DISCARD_HAND_PROMPT = '选择弃置的手牌';

export type QidahenOperationPrompt = {
    kind: 'discard-hand';
    title: typeof QIDAHEN_DISCARD_HAND_PROMPT;
};

export interface QidahenOperationPromptInput {
    handInteractionTrayVisible: boolean;
    gaoDiDiscardPending: boolean;
}

export const isQidahenDiscardHandPromptActive = (
    input: QidahenOperationPromptInput,
): boolean => (
    input.gaoDiDiscardPending && !input.handInteractionTrayVisible
);

export const resolveQidahenOperationPrompt = (
    input: QidahenOperationPromptInput,
): QidahenOperationPrompt | null => {
    if (!isQidahenDiscardHandPromptActive(input)) {
        return null;
    }
    return {
        kind: 'discard-hand',
        title: QIDAHEN_DISCARD_HAND_PROMPT,
    };
};
