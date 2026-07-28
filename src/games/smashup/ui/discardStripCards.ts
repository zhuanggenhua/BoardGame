import type { DiscardActionPlayOption } from '../domain/discardActionPlayability';
import type { DiscardPlayOption } from '../domain/discardPlayability';
import type { DiscardSpecialOption } from '../domain/discardSpecialAbilities';

export type DiscardStripCardMode =
    | 'interaction'
    | 'play_minion'
    | 'play_action'
    | 'play_action_minion'
    | 'activate_special_base'
    | 'activate_special_minion';

export type DiscardStripCard = {
    uid: string;
    defId: string;
    label: string;
    optionId?: string;
    optionValue?: unknown;
    mode: DiscardStripCardMode;
};

type InteractionPromptCardOption = {
    id: string;
    label: string;
    value: unknown;
};

export function buildDiscardStripCards(params: {
    isDiscardMinionPrompt: boolean;
    currentPromptOptions?: InteractionPromptCardOption[];
    discardPlayOptions: DiscardPlayOption[];
    discardActionPlayOptions: DiscardActionPlayOption[];
    discardSpecialOptions: DiscardSpecialOption[];
}): DiscardStripCard[] {
    const {
        isDiscardMinionPrompt,
        currentPromptOptions,
        discardPlayOptions,
        discardActionPlayOptions,
        discardSpecialOptions,
    } = params;

    if (isDiscardMinionPrompt && currentPromptOptions) {
        return currentPromptOptions
            .filter(opt => !(opt.value as Record<string, unknown>)?.done)
            .map(opt => {
                const val = opt.value as { cardUid: string; defId: string };
                return {
                    uid: val.cardUid,
                    defId: val.defId,
                    label: opt.label,
                    optionId: opt.id,
                    optionValue: opt.value,
                    mode: 'interaction' as const,
                };
            });
    }

    if (discardPlayOptions.length === 0 && discardActionPlayOptions.length === 0 && discardSpecialOptions.length === 0) {
        return [];
    }

    return [
        ...discardPlayOptions.map(opt => ({
            uid: opt.card.uid,
            defId: opt.defId,
            label: opt.name,
            mode: 'play_minion' as const,
        })),
        ...discardActionPlayOptions.map(opt => ({
            uid: opt.card.uid,
            defId: opt.defId,
            label: opt.name,
            mode: opt.targetMode === 'none' ? 'play_action' as const : 'play_action_minion' as const,
        })),
        ...discardSpecialOptions.map(opt => ({
            uid: opt.card.uid,
            defId: opt.defId,
            label: opt.name,
            mode: opt.allowedMinionUids?.length ? 'activate_special_minion' as const : 'activate_special_base' as const,
        })),
    ];
}
