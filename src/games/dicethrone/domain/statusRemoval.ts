import type { DiceThroneCore } from './types';
import type { TokenDef } from './tokenTypes';
import { STATUS_IDS } from './ids';
import { areTeammates } from './rules';

const findTokenDefinition = (state: DiceThroneCore, statusId: string): TokenDef | undefined =>
    (state.tokenDefinitions ?? []).find((definition) => definition.id === statusId);

export const isRemovableStatusId = (state: DiceThroneCore, statusId: string): boolean => {
    const def = findTokenDefinition(state, statusId);
    return def?.passiveTrigger?.removable ?? true;
};

export const isTransferableStatusId = (state: DiceThroneCore, statusId: string): boolean => {
    const def = findTokenDefinition(state, statusId);
    return def?.passiveTrigger?.transferable ?? true;
};

export const isPurifiableDebuffId = (state: DiceThroneCore, statusId: string): boolean => {
    const def = findTokenDefinition(state, statusId);
    return def?.category === 'debuff' && isRemovableStatusId(state, statusId);
};

/**
 * 眩晕类状态只能由持有者本人或同队玩家移除/转移。
 * 其他状态仍沿用通用卡牌的任意目标规则。
 */
export const canRemoveStatusFromPlayer = (
    state: DiceThroneCore,
    sourcePlayerId: string,
    targetPlayerId: string,
    statusId: string,
): boolean => {
    if (statusId !== STATUS_IDS.DAZE && statusId !== STATUS_IDS.STUN) {
        return true;
    }
    return areTeammates(state, sourcePlayerId, targetPlayerId);
};

export const canTransferStatus = (
    state: DiceThroneCore,
    sourcePlayerId: string,
    fromPlayerId: string,
    statusId: string,
): boolean => isTransferableStatusId(state, statusId)
    && isRemovableStatusId(state, statusId)
    && canRemoveStatusFromPlayer(state, sourcePlayerId, fromPlayerId, statusId);
