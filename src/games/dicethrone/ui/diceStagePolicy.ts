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
    boardDice3dEnabled: boolean;
    isRollPhase: boolean;
    rollCount: number;
    isRolling: boolean;
    hasPassiveRerollSelection: boolean;
    hasDiceMultistepInteraction: boolean;
}

export function canInteractDiceForCurrentBoard(params: DiceStagePolicyParams): boolean {
    const canOperateOwnRoll = !params.isSpectator && params.isSelfView && params.isViewRolling;
    const canOperateResponseDice = !params.isSpectator
        && params.diceInteractionPlayerId === params.rootPid
        && (params.isManualSelfResponseWindow || params.isDirectDiceActor || params.currentResponderId === params.rootPid);

    return (canOperateOwnRoll || canOperateResponseDice)
        && !params.isAttackShowcaseVisible
        && !params.isDuelDirectDefenseOnly;
}

export function shouldUseBoardDiceStage(params: DiceStagePolicyParams): boolean {
    if (!params.boardDice3dEnabled) return false;

    const shouldShowForRolling = params.boardDice3dEnabled
        && params.isRollPhase
        && params.isViewRolling
        && (params.rollCount > 0 || params.isRolling || params.hasPassiveRerollSelection);

    const shouldShowForResponseDice = params.diceInteractionPlayerId === params.rootPid
        && !params.isSpectator
        && (params.isManualSelfResponseWindow || params.isDirectDiceActor || params.currentResponderId === params.rootPid);

    const shouldShowForInteraction = params.hasDiceMultistepInteraction
        && (params.isViewRolling || shouldShowForResponseDice);

    return shouldShowForRolling || shouldShowForInteraction;
}

export function shouldShowRailDiceTray(params: {
    useBoardDiceStage: boolean;
    hasKeptDice: boolean;
}): boolean {
    return !params.useBoardDiceStage || params.hasKeptDice;
}

export function getRailDiceForCurrentBoard(dice: Die[], useBoardDiceStage: boolean): Die[] {
    return useBoardDiceStage ? dice.filter((die) => die.isKept) : dice;
}
