import type { Die } from '../types';
import type { CharacterId } from '../domain/core-types';
import { createCharacterDice } from '../domain/characters';

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

export function shouldUseReplayOnlyRollContextAsActiveSurface(params: {
    replayOnlyRollDice: Die[] | null;
    isCurrentPhaseMainRollPhase: boolean;
}): boolean {
    return Boolean(params.replayOnlyRollDice) && !params.isCurrentPhaseMainRollPhase;
}

export function getInteractionDiceForRightSidebar(params: {
    currentRollDice: Die[];
    replayOnlyRollDice: Die[] | null;
    attackSnapshotInteractionDice?: Die[] | null;
    bonusDiceTrayDice?: Die[] | null;
    isCurrentPhaseMainRollPhase: boolean;
}): Die[] {
    if (params.bonusDiceTrayDice) return params.bonusDiceTrayDice;

    const visibleRollDice = shouldUseReplayOnlyRollContextAsActiveSurface({
        replayOnlyRollDice: params.replayOnlyRollDice,
        isCurrentPhaseMainRollPhase: params.isCurrentPhaseMainRollPhase,
    })
        ? params.replayOnlyRollDice ?? []
        : params.currentRollDice;

    if (params.attackSnapshotInteractionDice) {
        return [...visibleRollDice, ...params.attackSnapshotInteractionDice];
    }
    return visibleRollDice;
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

/**
 * 非投骰阶段的右侧骰盘仍显示当前角色的常态骰子。
 * 测试代表态或旧存档可能暂时没有 core.dice，此时回到角色定义而不是空白。
 */
export function getDefaultDiceForCharacter(characterId?: CharacterId): Die[] {
    if (!characterId || characterId === 'unselected') return [];
    return getReadOnlyNormalDicePool(createCharacterDice(characterId));
}
