import type { Die } from '../types';

export interface DiceStagePolicyParams {
    isSpectator: boolean;
    isSelfView: boolean;
    isViewRolling: boolean;
    isAttackShowcaseVisible: boolean;
    isDuelDirectDefenseOnly: boolean;
    isManualSelfResponseWindow: boolean;
    isDirectDiceActor: boolean;
    currentResponderId?: string;
    rootPid: string;
    diceInteractionPlayerId?: string;
    canOperateOwnedCompareRoll: boolean;
    isRollPhase: boolean;
    rollCount: number;
    isRolling: boolean;
    hasPassiveRerollSelection: boolean;
    hasDiceMultistepInteraction: boolean;
}

export function canInteractDiceForCurrentBoard(params: DiceStagePolicyParams): boolean {
    const canOperateOwnRoll = !params.isSpectator && params.isSelfView && params.isViewRolling;
    const canOperateOwnedDiceInteraction = !params.isSpectator
        && params.hasDiceMultistepInteraction
        && params.diceInteractionPlayerId === params.rootPid;
    const canOperateOwnedCompareRoll = !params.isSpectator
        && params.canOperateOwnedCompareRoll;
    const canOperateResponseDice = !params.isSpectator
        && params.diceInteractionPlayerId === params.rootPid
        && (params.isManualSelfResponseWindow || params.isDirectDiceActor || params.currentResponderId === params.rootPid);

    return (canOperateOwnRoll || canOperateOwnedDiceInteraction || canOperateOwnedCompareRoll || canOperateResponseDice)
        && !params.isAttackShowcaseVisible
        && !params.isDuelDirectDefenseOnly;
}

export function shouldShowRailDiceTray(params: {
    hasKeptDice: boolean;
}): boolean {
    return true;
}

export function getReadOnlyNormalDicePool(dice: Die[]): Die[] {
    return dice.map((die, index) => ({
        ...die,
        id: die.id ?? index,
        isKept: false,
        displayOnly: true,
    }));
}

export function getRailDiceForCurrentBoard(dice: Die[], normalDicePool: Die[] = []): Die[] {
    if (dice.length > 0) return dice;
    return getReadOnlyNormalDicePool(normalDicePool);
}
