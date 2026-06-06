import type { MatchState, ValidationResult } from '../../../engine/types';
import { getMinionDef } from '../data/cards';
import { validate } from '../domain/commands';
import { SU_COMMANDS } from '../domain/types';
import type { CardInstance, SmashUpCore } from '../domain/types';

export type MinionUiPlayPlan = {
    validation: ValidationResult;
    playAsAction: boolean;
};

export function resolveMinionUiPlayPlan(
    state: MatchState<SmashUpCore>,
    playerId: string,
    card: CardInstance,
    baseIndex: number,
): MinionUiPlayPlan {
    const normalValidation = validate(state, {
        type: SU_COMMANDS.PLAY_MINION,
        playerId,
        payload: { cardUid: card.uid, baseIndex },
    });
    const canPlayAsAction = card.type === 'minion' && getMinionDef(card.defId)?.playAsAction === true;
    if (normalValidation.valid || !canPlayAsAction) {
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
