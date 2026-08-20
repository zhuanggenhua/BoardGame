import type { MatchState, ValidationResult } from '../../../engine/types';
import { getMinionDef } from '../data/cards';
import { validate } from '../domain/commands';
import { SU_COMMANDS } from '../domain/types';
import type { CardInstance, SmashUpCore } from '../domain/types';

export type MinionUiPlayIntent = 'auto' | 'regular-minion' | 'replacement';

export type MinionUiPlayPlan = {
    validation: ValidationResult;
    playAsAction: boolean;
    replacementHandCardUid?: string;
};

export type MinionReplacementActionChoiceArgs = {
    matchState: MatchState<SmashUpCore>;
    playerId: string;
    card: CardInstance;
    regularPlayableBaseIndices: Set<number>;
};

export function getRegularMinionPlayableBaseIndices(
    state: MatchState<SmashUpCore>,
    playerId: string,
    cardUid: string,
): Set<number> {
    const result = new Set<number>();
    for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
        const validation = validate(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex },
        });
        if (validation.valid) {
            result.add(baseIndex);
        }
    }
    return result;
}

function findReplacementHandCard(
    state: MatchState<SmashUpCore>,
    playerId: string,
    card: CardInstance,
): CardInstance | undefined {
    return state.core.players[playerId]?.hand.find(candidate =>
        candidate.uid !== card.uid
        && candidate.defId === 'penguins_dancing_penguin'
        && candidate.type === 'minion'
    );
}

export function getMinionReplacementPlayableBaseIndices(
    state: MatchState<SmashUpCore>,
    playerId: string,
    card: CardInstance,
): Set<number> {
    const result = new Set<number>();
    for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
        const plan = resolveMinionUiPlayPlan(state, playerId, card, baseIndex, { intent: 'replacement' });
        if (plan.validation.valid) {
            result.add(baseIndex);
        }
    }
    return result;
}

export function shouldOfferMinionReplacementActionChoice(args: MinionReplacementActionChoiceArgs): boolean {
    if (args.card.type !== 'minion') return false;
    if (args.card.defId === 'penguins_dancing_penguin') return false;
    if (args.regularPlayableBaseIndices.size === 0) return false;
    return getMinionReplacementPlayableBaseIndices(args.matchState, args.playerId, args.card).size > 0;
}

export function shouldPreferMinionReplacementSelection(args: Omit<MinionReplacementActionChoiceArgs, 'regularPlayableBaseIndices'> & {
    regularPlayableBaseIndices: Set<number>;
}): boolean {
    if (args.card.type !== 'minion') return false;
    if (args.card.defId === 'penguins_dancing_penguin') return false;
    if (args.regularPlayableBaseIndices.size > 0) return false;
    return getMinionReplacementPlayableBaseIndices(args.matchState, args.playerId, args.card).size > 0;
}

export function resolveMinionUiPlayPlan(
    state: MatchState<SmashUpCore>,
    playerId: string,
    card: CardInstance,
    baseIndex: number,
    options: { intent?: MinionUiPlayIntent } = {},
): MinionUiPlayPlan {
    const intent = options.intent ?? 'auto';
    const normalValidation = validate(state, {
        type: SU_COMMANDS.PLAY_MINION,
        playerId,
        payload: { cardUid: card.uid, baseIndex },
    });
    const canPlayAsAction = card.type === 'minion' && getMinionDef(card.defId)?.playAsAction === true;
    if (intent === 'regular-minion') {
        return {
            validation: normalValidation,
            playAsAction: false,
        };
    }

    const replacementCard = findReplacementHandCard(state, playerId, card);
    const replacementValidation = replacementCard
        ? validate(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid: card.uid, baseIndex, replacementHandCardUid: replacementCard.uid },
        })
        : null;
    if (intent === 'replacement') {
        return {
            validation: replacementValidation ?? { valid: false, error: '没有可替代打出的手牌能力' },
            playAsAction: false,
            ...(replacementValidation?.valid ? { replacementHandCardUid: replacementCard?.uid } : {}),
        };
    }

    if (normalValidation.valid) {
        return {
            validation: normalValidation,
            playAsAction: false,
        };
    }

    if (replacementValidation?.valid) {
        return {
            validation: replacementValidation,
            playAsAction: false,
            replacementHandCardUid: replacementCard?.uid,
        };
    }

    if (!canPlayAsAction) {
        return {
            validation: normalValidation,
            playAsAction: false,
        };
    }

    const playAsActionValidation = validate(state, {
        type: SU_COMMANDS.PLAY_MINION,
        playerId,
        payload: { cardUid: card.uid, baseIndex, playAsAction: true },
    });
    if (playAsActionValidation.valid) {
        return {
            validation: playAsActionValidation,
            playAsAction: true,
        };
    }

    return {
        validation: playAsActionValidation,
        playAsAction: false,
    };
}
