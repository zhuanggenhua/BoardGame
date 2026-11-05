import type { SmashUpCore } from './types';

export const SIGNS_IN_THE_STARS_DEF_ID = 'ancient_incas_signs_in_the_stars';
export const SIGNS_IN_THE_STARS_SOURCE_UID_META = 'signsInTheStarsSourceUid';
export const SIGNS_IN_THE_STARS_FACE_DOWN_UNTIL_TURN_META = 'signsInTheStarsFaceDownUntilTurn';

/**
 * Returns the base definitions whose printed abilities are active at a slot.
 * The physical base identity stays unchanged; Signs in the Stars only adds a
 * temporary ability source from the current base-deck top card.
 */
export function getEffectiveBaseAbilitySourceIds(
    state: SmashUpCore,
    baseIndex: number,
): string[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const sourceIds = [base.defId];
    const sourceUid = base.metadata?.[SIGNS_IN_THE_STARS_SOURCE_UID_META];
    const signsInTheStars = base.ongoingActions.find(action => (
        action.defId === SIGNS_IN_THE_STARS_DEF_ID
        && (typeof sourceUid !== 'string' || action.uid === sourceUid)
    ));
    if (!signsInTheStars) return sourceIds;

    if (base.metadata?.[SIGNS_IN_THE_STARS_FACE_DOWN_UNTIL_TURN_META] === state.turnNumber) {
        return sourceIds;
    }

    const topBaseDefId = state.baseDeck[0];
    if (topBaseDefId && !sourceIds.includes(topBaseDefId)) {
        sourceIds.push(topBaseDefId);
    }
    return sourceIds;
}
