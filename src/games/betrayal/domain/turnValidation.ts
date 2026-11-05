import type { BetrayalCore } from './types';
import type { BetrayalCommand } from '../commandTypes';
import type { ValidationResult } from '../../../engine/types';
import {
    resolvePendingTurnEndRoll,
    resolvePendingEventRollResolutionRequiredPlayerIds,
    resolvePendingEventRollResolutionAcknowledgedPlayerIds,
    resolvePendingCardResolutionRequiredPlayerIds,
    resolvePendingCardResolutionAcknowledgedPlayerIds,
    resolveAcknowledgeableRecentRoll,
    resolveRecentRollRequiredPlayerIds,
    canPlayerAcknowledgeRecentRoll,
} from '../acknowledgementReadModel';
import { BETRAYAL_COMMANDS } from '../commands';
import { canUseBookForPendingEventRoll } from '../possessionActionReadModel';

export function isPlayersTurn(core: BetrayalCore, playerId: string): boolean {
    return core.currentPlayer === playerId;
}

export function validateTurnEndRollAcknowledgement(
    core: BetrayalCore,
    command: BetrayalCommand,
): ValidationResult | null {
    const pendingRoll = resolvePendingTurnEndRoll(core);
    if (!pendingRoll) {
        return command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL
            ? { valid: false, error: '当前没有待确认的回合结束投骰。' }
            : null;
    }
    if (command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL) {
        return command.playerId === pendingRoll.playerId
            ? { valid: true }
            : { valid: false, error: '必须由刚刚投骰的玩家确认结果。' };
    }
    return { valid: false, error: '请先确认回合结束投骰结果。' };
}

export function validateEventRollFinalization(core: BetrayalCore, command: BetrayalCommand): ValidationResult | null {
    const pending = core.pendingEventRollResolution;
    if (!pending) {
        return command.type === BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL
            ? { valid: false, error: '当前没有等待确认最终结果的事件骰。' }
            : null;
    }
    if (command.type !== BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL) {
        if (
            command.type === BETRAYAL_COMMANDS.USE_POSSESSION &&
            canUseBookForPendingEventRoll(core, command.playerId, command.payload.cardId)
        ) {
            return { valid: true };
        }
        if (
            (pending.requiresAcknowledgement === false || pending.requiresPlayerAdvance) &&
            (command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT ||
                command.type === BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM)
        ) {
            return null;
        }
        return { valid: false, error: '请先处理当前事件投掷结果。' };
    }
    if (pending.requiresAcknowledgement === false || pending.requiresPlayerAdvance) {
        if (command.playerId !== pending.playerId) {
            return { valid: false, error: '只有触发事件的玩家可以处理当前检定结果。' };
        }
        if (command.payload.rollId && command.payload.rollId !== pending.rollId) {
            return { valid: false, error: '当前投掷结果已经改变。' };
        }
        return { valid: true };
    }
    const requiredPlayerIds = resolvePendingEventRollResolutionRequiredPlayerIds(core, pending);
    if (!requiredPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '只有本局玩家可以确认事件骰最终结果。' };
    }
    const acknowledgedPlayerIds = resolvePendingEventRollResolutionAcknowledgedPlayerIds(pending);
    if (acknowledgedPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '你已经确认过当前事件骰最终结果。' };
    }
    if (command.payload.rollId && command.payload.rollId !== pending.rollId) {
        return { valid: false, error: '确认的投骰已不是当前事件骰。' };
    }
    return { valid: true };
}

export function validateCardResolutionAcknowledgement(
    core: BetrayalCore,
    command: BetrayalCommand,
): ValidationResult | null {
    if (command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION) {
        return null;
    }
    const pendingResolution = (core.pendingCardResolutionQueue ?? [])[0];
    if (!pendingResolution) {
        return { valid: false, error: '当前没有待确认的翻牌结算。' };
    }
    const requiredPlayerIds = resolvePendingCardResolutionRequiredPlayerIds(pendingResolution);
    if (!requiredPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '只有本局玩家可以确认当前翻牌结算。' };
    }
    const acknowledgedPlayerIds = resolvePendingCardResolutionAcknowledgedPlayerIds(pendingResolution);
    if (acknowledgedPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '你已经确认过当前翻牌结算。' };
    }
    if (command.payload.resolutionId && command.payload.resolutionId !== pendingResolution.id) {
        return { valid: false, error: '必须按当前翻牌顺序确认。' };
    }
    return { valid: true };
}

export function validateRecentRollAcknowledgement(
    core: BetrayalCore,
    command: BetrayalCommand,
): ValidationResult | null {
    if (command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL) {
        return null;
    }
    const recentRoll = resolveAcknowledgeableRecentRoll(core);
    if (!recentRoll) {
        return { valid: false, error: '当前没有待确认的投骰结果。' };
    }
    const requiredPlayerIds = resolveRecentRollRequiredPlayerIds(core, recentRoll);
    if (!requiredPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '只有需要确认的玩家可以确认当前投骰结果。' };
    }
    if (!canPlayerAcknowledgeRecentRoll(core, command.playerId)) {
        return { valid: false, error: '你已经确认过当前投骰结果。' };
    }
    return { valid: true };
}
