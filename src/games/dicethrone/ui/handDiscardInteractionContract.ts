import type { PlayerId } from '../../../engine/types';
import type { InteractionDescriptor } from '../domain/types';
import type { InteractionPresentationContract } from './interactionPresentationContract';

type HandDiscardInteractionSource = Pick<
    InteractionDescriptor,
    'id' | 'playerId' | 'type' | 'titleKey' | 'selectCount' | 'candidateCardIds' | 'allowCancel'
>;

export type HandDiscardInteractionContract = InteractionPresentationContract<'hand-discard'> & {
    interactionId: string;
    playerId: PlayerId;
    candidates: {
        region: 'hand';
        cardIds: string[];
        selectCount: 1;
    };
    actions: {
        selectCard: (cardId: string) => void;
        cancel?: {
            kind: 'cancel';
            labelKey: 'common.cancel';
            onActivate: () => void;
        };
    };
};

export function createHandDiscardInteractionContract(input: {
    interaction?: HandDiscardInteractionSource;
    handCardIds: readonly string[];
    currentPlayerId: PlayerId;
    canOperate: boolean;
    onSelectCard: (interactionId: string, cardId: string) => void;
    onCancel: () => void;
}): HandDiscardInteractionContract | undefined {
    const { interaction } = input;
    if (
        !interaction
        || interaction.type !== 'selectHandCard'
        || (interaction.selectCount ?? 1) !== 1
        || interaction.titleKey !== 'interaction.selectHandCardToDiscard'
        || interaction.playerId !== input.currentPlayerId
        || !input.canOperate
    ) {
        return undefined;
    }

    const currentHandCardIds = Array.from(new Set(input.handCardIds));
    const candidateCardIds = interaction.candidateCardIds === undefined
        ? currentHandCardIds
        : currentHandCardIds.filter(cardId => interaction.candidateCardIds?.includes(cardId));

    if (candidateCardIds.length === 0) {
        throw new Error(`[DiceThrone] Hand discard interaction has no current hand candidate: ${interaction.id}`);
    }

    return {
        kind: 'hand-discard',
        interactionId: interaction.id,
        playerId: interaction.playerId,
        candidates: {
            region: 'hand',
            cardIds: candidateCardIds,
            selectCount: 1,
        },
        hint: { key: 'interaction.selectHandCardToDiscard' },
        actions: {
            selectCard: cardId => {
                if (candidateCardIds.includes(cardId)) {
                    input.onSelectCard(interaction.id, cardId);
                }
            },
            ...(interaction.allowCancel ? {
                cancel: {
                    kind: 'cancel' as const,
                    labelKey: 'common.cancel' as const,
                    onActivate: input.onCancel,
                },
            } : {}),
        },
    };
}
