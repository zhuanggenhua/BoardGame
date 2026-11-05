import type { MatchState, ValidationResult } from '../../../engine/types';
import type { BetrayalCore } from './types';
import type { BetrayalCommand } from '../commandTypes';
import { BETRAYAL_COMMANDS } from '../commands';
import { validateBetrayalEventChoiceResolution } from '../eventChoiceResolutionModel';
import {
    validateBetrayalRecentRollRerollItemCommand,
    canUseBookForPendingEventRoll,
    canUseSkeletonKeyForMove,
    canUseHolySymbolForDiscovery,
    canUseIdolToSkipEvent,
    validateBetrayalPossessionSpecialActionCommand,
} from '../possessionActionReadModel';
import { validateBetrayalDamageAllocationResolution } from '../damageResolutionModel';
import {
    validateEventRollFinalization,
    validateCardResolutionAcknowledgement,
    validateRecentRollAcknowledgement,
    validateTurnEndRollAcknowledgement,
    isPlayersTurn,
} from './turnValidation';
import { resolveAcknowledgeableRecentRoll, resolveRecentRollRequiredPlayerIds } from '../acknowledgementReadModel';
import { resolveMoveTargetRooms, resolveBetrayalMoveCost } from '../movementReadModel';
import {
    resolveExplorableRoomSlots,
    resolveRoomPlacementContext,
    resolveRoomDraw,
    resolveRoomTemplateDiscoveryDeckKind,
    resolveRoomPlacementOrientationOptions,
    isRoomOrientationTurns,
    canConnectDoorwaysToEntry,
    orientDoorwaysForPlacement,
    resolveRoomTileAdjustmentOptionsForPlacement,
} from '../roomDiscoveryModel';
import { canUseBetrayalTraitorPowers } from '../traitorPowerRules';
import { roomTileAdjustmentSelectionsMatch } from '../roomMapModel';
import { resolveBetrayalRoomSpecialActionStatus } from '../roomActionReadModel';
import {
    resolveTradeCardIds,
    resolveDogTradeTargets,
    resolveTradeTargets,
    canUseDogForTrade,
    resolveBetrayalTradeCardStatus,
} from '../trade';
import { resolveCorpseLootTargets } from '../deathStateReadModel';

export function validatePreHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    const canReuseDuringHaunt =
        core.phase === 'haunt' &&
        (command.type === BETRAYAL_COMMANDS.EXPLORE_ROOM ||
            command.type === BETRAYAL_COMMANDS.USE_ROOM_EFFECT ||
            command.type === BETRAYAL_COMMANDS.USE_POSSESSION ||
            command.type === BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE);
    if (core.phase !== 'preHaunt' && !canReuseDuringHaunt) {
        return { valid: false, error: '当前不在运行时阶段。' };
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT) {
        const pendingTrade = core.pendingTradeAgreement;
        if (!pendingTrade) {
            return { valid: false, error: '当前没有待同意的交易。' };
        }
        if (pendingTrade.targetPlayerId !== command.playerId) {
            return { valid: false, error: '必须由交易接收方回应。' };
        }
        if (typeof command.payload.accept !== 'boolean') {
            return { valid: false, error: '交易回应必须选择同意或拒绝。' };
        }
        return { valid: true };
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE) {
        return validateBetrayalEventChoiceResolution(core, command.playerId, command.payload);
    }
    const recentRollRerollValidation =
        command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT || command.type === BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM
            ? validateBetrayalRecentRollRerollItemCommand(core, command.playerId, command.payload, {
                  legacyRabbitFoot: command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
              })
            : null;
    if (recentRollRerollValidation) {
        return recentRollRerollValidation;
    }
    const pendingDamageAllocationValidation = validateBetrayalDamageAllocationResolution(core, command);
    if (pendingDamageAllocationValidation) {
        return pendingDamageAllocationValidation;
    }
    const eventRollFinalization = validateEventRollFinalization(core, command);
    if (eventRollFinalization) {
        return eventRollFinalization;
    }
    const cardResolutionAcknowledgement = validateCardResolutionAcknowledgement(core, command);
    if (cardResolutionAcknowledgement) {
        return cardResolutionAcknowledgement;
    }
    if (command.type === BETRAYAL_COMMANDS.ROLL_EVENT) {
        const pending = core.pendingEventRollStart;
        if (!pending) {
            return { valid: false, error: '当前没有等待投掷的事件。' };
        }
        if (pending.playerId !== command.playerId) {
            return { valid: false, error: '只有触发事件的玩家可以投掷。' };
        }
        if (command.payload.sourceTitle && command.payload.sourceTitle !== pending.sourceTitle) {
            return { valid: false, error: '当前事件已经改变。' };
        }
        return { valid: true };
    }
    if (core.pendingEventRollStart) {
        return {
            valid: false,
            error:
                core.pendingEventRollStart.playerId === command.playerId
                    ? '请先投掷当前事件。'
                    : '请等待触发事件的玩家投掷。',
        };
    }
    const recentRollAcknowledgement = validateRecentRollAcknowledgement(core, command);
    if (recentRollAcknowledgement?.valid) {
        return recentRollAcknowledgement;
    }
    if (core.pendingEventChoice) {
        return { valid: false, error: '请先处理当前事件。' };
    }
    if ((core.pendingCardResolutionQueue ?? []).length > 0) {
        return { valid: false, error: '请先确认当前翻牌结算。' };
    }
    if (core.pendingTradeAgreement) {
        return { valid: false, error: '请先等待交易接收方回应。' };
    }
    const pendingTurnEndRollValidation = validateTurnEndRollAcknowledgement(core, command);
    if (pendingTurnEndRollValidation) {
        return pendingTurnEndRollValidation;
    }
    const pendingRecentRollAcknowledgement =
        command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL ? resolveAcknowledgeableRecentRoll(core) : null;
    const isRecentRollAcknowledgementParticipant = Boolean(
        pendingRecentRollAcknowledgement &&
        resolveRecentRollRequiredPlayerIds(core, pendingRecentRollAcknowledgement).includes(command.playerId),
    );
    if (!isPlayersTurn(core, command.playerId) && !isRecentRollAcknowledgementParticipant) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }
    if (
        core.turnEndedByDiscovery &&
        command.type !== BETRAYAL_COMMANDS.END_TURN &&
        command.type !== BETRAYAL_COMMANDS.USE_RABBIT_FOOT &&
        command.type !== BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM &&
        !(
            command.type === BETRAYAL_COMMANDS.USE_POSSESSION &&
            canUseBookForPendingEventRoll(core, command.playerId, command.payload.cardId)
        ) &&
        command.type !== BETRAYAL_COMMANDS.ROLL_EVENT &&
        command.type !== BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL &&
        command.type !== BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE &&
        command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION &&
        command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
    ) {
        return { valid: false, error: '探索新房间后回合已经结束。' };
    }

    switch (command.type) {
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const payload = command.payload;
            const targetRooms = new Set(resolveMoveTargetRooms(core).map((room) => room.id));
            if (payload.useSkeletonKey && canUseSkeletonKeyForMove(core, payload.roomId)) {
                return { valid: true };
            }
            if (core.movesRemaining < resolveBetrayalMoveCost(core) || !targetRooms.has(payload.roomId)) {
                return { valid: false, error: '目标房间不可移动。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const explorableSlots = resolveExplorableRoomSlots(core);
            const nextSlot = command.payload.roomId
                ? (explorableSlots.find((room) => room.id === command.payload.roomId) ?? null)
                : (explorableSlots[0] ?? null);
            if (!nextSlot) {
                return { valid: false, error: '当前没有可探索房间。' };
            }
            if (command.payload.roomId && !explorableSlots.some((room) => room.id === command.payload.roomId)) {
                return { valid: false, error: '指定房间不是当前开放门位。' };
            }
            if (command.payload.useHolySymbol && !canUseHolySymbolForDiscovery(core)) {
                return { valid: false, error: '当前探索者不能使用圣符替换发现板块。' };
            }
            const placement = resolveRoomPlacementContext(core, nextSlot);
            const roomDraw = resolveRoomDraw(core, nextSlot.floor, {
                useHolySymbol: command.payload.useHolySymbol && canUseHolySymbolForDiscovery(core),
                placement,
            });
            const roomTemplate = roomDraw.roomTemplate;
            if (!roomTemplate) {
                return { valid: false, error: '当前区域没有可发现房间。' };
            }
            const deckKind = resolveRoomTemplateDiscoveryDeckKind(roomTemplate);
            const orientationOptions = resolveRoomPlacementOrientationOptions(
                core,
                roomTemplate,
                placement,
                roomDraw.selectedRoomRequiresOpenFrontier,
            );
            if (command.payload.useIdol) {
                if (!canUseIdolToSkipEvent(core)) {
                    return { valid: false, error: '当前探索者不能使用雕像跳过事件抽取。' };
                }
                if (deckKind !== 'event') {
                    return { valid: false, error: '雕像只能在发现事件符号板块时使用。' };
                }
            }
            if (command.payload.ignoreEventSymbolWithTraitorPower) {
                if (command.payload.useIdol) {
                    return { valid: false, error: '事件符号只能选择一种跳过方式。' };
                }
                if (!canUseBetrayalTraitorPowers(core, command.playerId)) {
                    return { valid: false, error: '只有作祟开始后的存活叛徒能忽略事件符号。' };
                }
                if (deckKind !== 'event') {
                    return { valid: false, error: '叛徒只能在发现事件符号板块时忽略事件符号。' };
                }
            }
            if (command.payload.orientationTurns !== undefined) {
                if (!isRoomOrientationTurns(command.payload.orientationTurns)) {
                    return { valid: false, error: '房间朝向无效。' };
                }
                if (
                    !orientationOptions.some((option) => option.orientationTurns === command.payload.orientationTurns)
                ) {
                    return {
                        valid: false,
                        error: canConnectDoorwaysToEntry(
                            roomTemplate.doorways,
                            placement.entryEdge,
                            command.payload.orientationTurns,
                        )
                            ? '此朝向会封死当前区域。'
                            : '此朝向没有走廊连接入口。',
                    };
                }
            }
            if (roomDraw.resolution.requiresTileAdjustment) {
                const placementOrientationTurns =
                    command.payload.orientationTurns ??
                    orientationOptions[0]?.orientationTurns ??
                    orientDoorwaysForPlacement(roomTemplate.doorways, placement.entryEdge).orientationTurns;
                const adjustmentOptions = resolveRoomTileAdjustmentOptionsForPlacement(
                    core,
                    roomTemplate,
                    placement,
                    placementOrientationTurns,
                );
                if (!command.payload.roomTileAdjustment) {
                    return { valid: false, error: '需要先调整该区域已有板块，保留至少一个开放走廊。' };
                }
                if (
                    !adjustmentOptions.some((option) =>
                        roomTileAdjustmentSelectionsMatch(option, command.payload.roomTileAdjustment!),
                    )
                ) {
                    return { valid: false, error: '该房间板块调整不能保留开放走廊。' };
                }
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            return validateBetrayalPossessionSpecialActionCommand(core, command.playerId, command.payload);
        }
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT: {
            const actionStatus = resolveBetrayalRoomSpecialActionStatus(core);
            if (!actionStatus.canUse) {
                return { valid: false, error: actionStatus.reason ?? '当前房间没有可使用的房间效果。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION: {
            if (core.pendingTradeAgreement) {
                return { valid: false, error: '已有待同意的交易。' };
            }
            if (core.tradeUsedThisTurnPlayerIds.includes(core.currentExplorer.playerId)) {
                return { valid: false, error: '本回合已经完成过交易。' };
            }
            const cardIds = resolveTradeCardIds(command.payload);
            const tradeTargets = command.payload.useDog ? resolveDogTradeTargets(core) : resolveTradeTargets(core);
            const targetPlayerId = command.payload.targetPlayerId;
            const targetCardIds = command.payload.targetCardIds ?? [];
            const target = tradeTargets.find((explorer) => explorer.playerId === targetPlayerId);
            if ((cardIds.length === 0 && targetCardIds.length === 0) || !targetPlayerId) {
                return { valid: false, error: '缺少交易对象或持有物。' };
            }
            if (command.payload.useDog && !canUseDogForTrade(core)) {
                return { valid: false, error: '当前探索者不能使用狗进行远距交易。' };
            }
            const requesterCardStatuses = cardIds.map((cardId) =>
                resolveBetrayalTradeCardStatus(core, cardId, {
                    ownerPlayerId: core.currentExplorer.playerId,
                    ownerRole: 'requester',
                    useDogTrade: command.payload.useDog,
                }),
            );
            const invalidRequesterCard = requesterCardStatuses.find((status) => !status.canTrade);
            if (invalidRequesterCard) {
                return { valid: false, error: invalidRequesterCard.reason ?? '当前探索者没有这件持有物。' };
            }
            if (!target) {
                return {
                    valid: false,
                    error: command.payload.useDog ? '狗只能和 4 格以内的玩家交易。' : '只能和同房间队友交易。',
                };
            }
            const targetCardStatuses = targetCardIds.map((cardId) =>
                resolveBetrayalTradeCardStatus(core, cardId, {
                    ownerPlayerId: target.playerId,
                    ownerRole: 'target',
                }),
            );
            const invalidTargetCard = targetCardStatuses.find((status) => !status.canTrade);
            if (invalidTargetCard) {
                return { valid: false, error: invalidTargetCard.reason ?? '交易对象没有这件持有物。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.LOOT_CORPSE: {
            const corpseTargets = resolveCorpseLootTargets(core);
            const sourcePlayerId = command.payload.sourcePlayerId;
            const sourceExplorer = corpseTargets.find((explorer) => explorer.playerId === sourcePlayerId);
            const cardId = command.payload.cardId;
            if (!sourcePlayerId || !sourceExplorer || !cardId) {
                return { valid: false, error: '搜刮尸体必须先选择尸体和具体持有物。' };
            }
            if (!sourceExplorer.inventory.some((card) => card.id === cardId)) {
                return { valid: false, error: '该尸体上没有这件物品或预兆。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.END_TURN:
            return { valid: true };
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL: {
            return recentRollAcknowledgement ?? { valid: false, error: '当前没有待确认的投骰结果。' };
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return { valid: false, error: '当前没有待确认的回合结束投骰。' };
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION:
            return { valid: false, error: '当前没有待确认的翻牌结算。' };
        case BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION:
            return { valid: false, error: '当前没有待分配的伤害。' };
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE:
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START:
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP:
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM:
        case BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO:
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN:
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS:
        case BETRAYAL_COMMANDS.GIVE_MIRROR_HINT:
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD:
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND:
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK:
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN:
        case BETRAYAL_COMMANDS.TAKE_PHOTO:
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA:
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK:
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO:
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK:
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME:
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT:
        case BETRAYAL_COMMANDS.BANISH_MUMMY:
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL:
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY:
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY:
        case BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD:
        case BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY:
            return { valid: false, error: '当前还未进入 haunt 阶段。' };
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return { valid: false, error: '真实首剧本不能通过手工结算完成。' };
        default:
            return { valid: false, error: '未知运行时命令。' };
    }
}
