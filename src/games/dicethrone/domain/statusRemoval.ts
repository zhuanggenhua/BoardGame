import type { DiceThroneCore } from './types';
import type { TokenDef } from './tokenTypes';
import { STATUS_IDS } from './ids';
import { areTeammates, getTokenStackLimit } from './rules';

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

/**
 * 转移命令必须能在目标玩家身上产生至少一层实际变化。
 * execute 层对 statusEffects 优先于 tokens，容量判断保持同一顺序。
 */
export const canReceiveTransferredStatus = (
    state: DiceThroneCore,
    fromPlayerId: string,
    toPlayerId: string,
    statusId: string,
): boolean => {
    const fromPlayer = state.players[fromPlayerId];
    const toPlayer = state.players[toPlayerId];
    if (!fromPlayer || !toPlayer) return false;

    const fromStatusStacks = fromPlayer.statusEffects[statusId] ?? 0;
    const fromTokenStacks = fromPlayer.tokens[statusId] ?? 0;
    if (fromStatusStacks <= 0 && fromTokenStacks <= 0) return false;

    const sourceKind = fromStatusStacks > 0 ? 'statusEffects' : 'tokens';
    const targetStacks = toPlayer[sourceKind][statusId] ?? 0;
    return targetStacks < getTokenStackLimit(state, toPlayerId, statusId);
};
