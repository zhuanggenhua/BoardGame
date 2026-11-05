import type { MatchState, ValidationResult } from '../../../engine/types';
import type { BetrayalCore } from './types';
import type { BetrayalCommand } from '../commandTypes';
import {
    resolveHelpingHandsPendingAttackReward,
    resolveMummyPendingAttackReward,
    resolveHelpingHandsStealableCards,
    resolveMummyStealableCards,
    resolveHelpingHandsTrollHandMoveOptions,
    resolveHelpingHandsTrollHandAttackOptions,
} from '../hauntAttackRewardReadModel';
import { BETRAYAL_COMMANDS } from '../commands';
import { validateBetrayalRecentRollRerollItemCommand } from '../possessionActionReadModel';
import {
    isPendingDamageAllocationForAttackRoll,
    isDynamiteCardId,
    resolveDynamiteInventoryCard,
    isDynamiteTargetRoom,
    resolveAttackWeaponEffect,
    isAttackTargetInWeaponRange,
    formatAttackRangeLabel,
} from '../attackRules';
import {
    validateEventRollFinalization,
    validateCardResolutionAcknowledgement,
    validateTurnEndRollAcknowledgement,
    validateRecentRollAcknowledgement,
    isPlayersTurn,
} from './turnValidation';
import { validateBetrayalDamageAllocationResolution } from '../damageResolutionModel';
import {
    isBetrayalPlayerControllingMonster,
    resolveControlledRoomId,
    shouldDeadPlayerControlFeverish,
    findHelpingHandsTrollHand,
    isMagicCameraHaunt,
    findPhantomPhotographer,
    isBloodFromStoneHaunt,
    isUponReflectionHaunt,
    isDustHaunt,
    isHelpingHandsHaunt,
    isBetrayalLibraryRoom,
    isMummyHaunt,
    isMummyNameStudyRoom,
    hasOmenBook,
    findMummyMonster,
    hasLivingHeroWithBookInRoom,
} from '../hauntScenarioReadModel';
import { validatePreHauntAction } from './preHauntValidation';
import {
    resolveHelpingHandsMonsterTurnStatus,
    resolveBloodFromStoneMonsterTurnStatus,
    canPlayerControlStandardMonsterTurn,
    resolveMagicCameraPhantomAttackTargets,
} from '../monsterActionReadModel';
import {
    isBetrayalHelpingHandsMonsterTurnCommand,
    isBetrayalBloodFromStoneMonsterTurnCommand,
    isBetrayalStandardMonsterTurnCommand,
    validateBetrayalMonsterActionCommand,
} from '../monsterActionCommandValidation';
import { resolveAcknowledgeableRecentRoll, resolveRecentRollRequiredPlayerIds } from '../acknowledgementReadModel';
import { findExplorerByPlayerId, getAllExplorers } from '../explorerReadModel';
import { roomDistanceByLayout } from '../roomMapModel';
import {
    canUseStalkThePrey,
    resolveStalkThePreyTargets,
    validateHauntSpecialActionBudget,
    canTakeMagicCameraPhoto,
    canSmashMagicCamera,
    resolveBloodFromStonePeekabooSelection,
    canSearchForCure,
    canCureTheDust,
} from '../hauntSpecialActionReadModel';
import {
    hasUsedMirrorHintThisTurn,
    resolveUponReflectionHintEvent,
    resolveUponReflectionOmenSelection,
} from './scenarioResolution';
import { BETRAYAL_TRAIT_KEYS } from '../traitTrackModel';
import { resolveBloodFromStoneSetupPlacementPlan } from '../bloodFromStoneSetupReadModel';
import { resolveBetrayalHauntSetupQueue } from '../hauntSetupModel';
import { findMummyWeddingOmenCard } from '../mummyHauntRules';

export function validateHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase !== 'haunt') {
        return { valid: false, error: '当前不在 haunt 阶段。' };
    }
    const pendingHelpingHandsReward = resolveHelpingHandsPendingAttackReward(core);
    if (
        pendingHelpingHandsReward &&
        command.type !== BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD &&
        command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
    ) {
        return { valid: false, error: '请先选择造成伤害或偷取物品/预兆。' };
    }
    const pendingMummyReward = resolveMummyPendingAttackReward(core);
    if (
        pendingMummyReward &&
        command.type !== BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD &&
        command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
    ) {
        return { valid: false, error: '请先选择木乃伊造成伤害或偷取物品/预兆。' };
    }
    const recentRollRerollValidation =
        command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT || command.type === BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM
            ? validateBetrayalRecentRollRerollItemCommand(core, command.playerId, command.payload, {
                  legacyRabbitFoot: command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
              })
            : null;
    if (recentRollRerollValidation) {
        if (core.pendingDamageAllocation && !isPendingDamageAllocationForAttackRoll(core)) {
            return { valid: false, error: '请先分配当前伤害。' };
        }
        return recentRollRerollValidation;
    }
    const eventRollFinalization = validateEventRollFinalization(core, command);
    if (eventRollFinalization) {
        return eventRollFinalization;
    }
    const pendingDamageAllocationValidation = validateBetrayalDamageAllocationResolution(core, command);
    if (pendingDamageAllocationValidation) {
        return pendingDamageAllocationValidation;
    }
    const cardResolutionAcknowledgement = validateCardResolutionAcknowledgement(core, command);
    if (cardResolutionAcknowledgement) {
        return cardResolutionAcknowledgement;
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT) {
        if (isBetrayalPlayerControllingMonster(core, command.playerId)) {
            return { valid: false, error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。' };
        }
        return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE) {
        const pendingExchange = core.scenarioRuntime.dust?.pendingSicknessExchange;
        if (!pendingExchange) {
            return { valid: false, error: '当前没有待回应的疾病标记交换。' };
        }
        if (pendingExchange.targetPlayerId !== command.playerId) {
            return { valid: false, error: '必须由交换目标玩家回应。' };
        }
        if (typeof command.payload.accept !== 'boolean') {
            return { valid: false, error: '交换回应必须选择同意或拒绝。' };
        }
        return { valid: true };
    }
    if (core.scenarioRuntime.dust?.pendingSicknessExchange) {
        return { valid: false, error: '请先等待疾病标记交换回应。' };
    }
    const pendingTurnEndRollValidation = validateTurnEndRollAcknowledgement(core, command);
    if (pendingTurnEndRollValidation) {
        return pendingTurnEndRollValidation;
    }
    const recentRollAcknowledgement = validateRecentRollAcknowledgement(core, command);
    if (recentRollAcknowledgement?.valid) {
        return recentRollAcknowledgement;
    }
    if ((core.pendingCardResolutionQueue ?? []).length > 0) {
        return { valid: false, error: '请先确认当前翻牌结算。' };
    }
    const helpingHandsMonsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);
    const isHelpingHandsMonsterCommand = isBetrayalHelpingHandsMonsterTurnCommand(command);
    if (helpingHandsMonsterTurnStatus.active && !isHelpingHandsMonsterCommand) {
        return { valid: false, error: '当前正在进行巨魔手怪物回合，请先完成巨魔手行动。' };
    }
    const bloodFromStoneMonsterTurnStatus = resolveBloodFromStoneMonsterTurnStatus(core);
    const isBloodFromStoneMonsterCommand = isBetrayalBloodFromStoneMonsterTurnCommand(core, command);
    if (bloodFromStoneMonsterTurnStatus.active && !isBloodFromStoneMonsterCommand) {
        return { valid: false, error: '当前正在进行石像小天使怪物回合，请先完成石像小天使行动。' };
    }
    if (
        bloodFromStoneMonsterTurnStatus.active &&
        isBloodFromStoneMonsterCommand &&
        bloodFromStoneMonsterTurnStatus.controllerPlayerId !== command.playerId
    ) {
        return { valid: false, error: '只有当前石像小天使怪物回合控制者能执行怪物行动。' };
    }
    if (!bloodFromStoneMonsterTurnStatus.active && isBloodFromStoneMonsterCommand) {
        return { valid: false, error: '石像小天使怪物回合尚未开始。' };
    }
    const isStandardMonsterTurnCommand = isBetrayalStandardMonsterTurnCommand(core, command);
    const pendingRecentRollAcknowledgement =
        command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL ? resolveAcknowledgeableRecentRoll(core) : null;
    const isRecentRollAcknowledgementParticipant = Boolean(
        pendingRecentRollAcknowledgement &&
        resolveRecentRollRequiredPlayerIds(core, pendingRecentRollAcknowledgement).includes(command.playerId),
    );
    if (
        !isPlayersTurn(core, command.playerId) &&
        !(helpingHandsMonsterTurnStatus.active && isHelpingHandsMonsterCommand) &&
        !(bloodFromStoneMonsterTurnStatus.active && isBloodFromStoneMonsterCommand) &&
        !(isStandardMonsterTurnCommand && canPlayerControlStandardMonsterTurn(core, command.playerId)) &&
        !isRecentRollAcknowledgementParticipant
    ) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }

    const actor = findExplorerByPlayerId(core, command.playerId);
    if (!actor) {
        return { valid: false, error: '当前行动者不存在。' };
    }
    const actorRoomId = resolveControlledRoomId(core, actor);
    const isTraitor = core.scenarioRuntime.traitorPlayerId === command.playerId;
    const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(command.playerId);
    if (isStandardMonsterTurnCommand && !canPlayerControlStandardMonsterTurn(core, command.playerId)) {
        return { valid: false, error: '只有当前叛徒能执行普通怪物回合动作。' };
    }

    if (command.type === BETRAYAL_COMMANDS.HAUNT_ATTACK && core.usedCardIdsThisTurn.includes('haunt-attack')) {
        return { valid: false, error: '本回合已经攻击过。' };
    }

    if (
        isBetrayalPlayerControllingMonster(core, actor.playerId) &&
        (command.type === BETRAYAL_COMMANDS.USE_POSSESSION ||
            command.type === BETRAYAL_COMMANDS.TRADE_POSSESSION ||
            command.type === BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT ||
            command.type === BETRAYAL_COMMANDS.LOOT_CORPSE)
    ) {
        return { valid: false, error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。' };
    }

    const monsterActionValidation = validateBetrayalMonsterActionCommand(core, command);
    if (monsterActionValidation) {
        return monsterActionValidation;
    }

    switch (command.type) {
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM:
            if (isDead) {
                if (shouldDeadPlayerControlFeverish(core, actor.playerId)) {
                    if (core.movesRemaining <= 0) {
                        return { valid: false, error: '狂热病患本回合没有剩余移动点。' };
                    }
                    const targetRoom = core.rooms.find((room) => room.id === command.payload.roomId);
                    const currentRoom = core.rooms.find((room) => room.id === actorRoomId);
                    if (!targetRoom || targetRoom.state !== 'discovered') {
                        return { valid: false, error: '目标房间不可移动。' };
                    }
                    if (targetRoom.id === actorRoomId || roomDistanceByLayout(currentRoom, targetRoom) !== 1) {
                        return { valid: false, error: '狂热病患只能移动到相邻房间。' };
                    }
                    return { valid: true };
                }
                if (
                    !core.scenarioRuntime.jackSpiritReleased ||
                    actor.playerId !== core.scenarioRuntime.traitorPlayerId
                ) {
                    return { valid: false, error: '该角色已死亡，当前不能移动。' };
                }
                if (core.movesRemaining <= 0) {
                    return { valid: false, error: '杰克之灵本回合没有剩余移动点。' };
                }
                const targetRoom = core.rooms.find((room) => room.id === command.payload.roomId);
                if (!targetRoom || targetRoom.state !== 'discovered') {
                    return { valid: false, error: '目标房间不可移动。' };
                }
                const currentRoom = core.rooms.find((room) => room.id === actorRoomId);
                if (targetRoom.id === actorRoomId) {
                    return { valid: false, error: '杰克之灵必须移动到相邻房间。' };
                }
                if (roomDistanceByLayout(currentRoom, targetRoom) !== 1) {
                    return { valid: false, error: '杰克之灵只能移动到相邻房间。' };
                }
                return { valid: true };
            }
            if (isTraitor && canUseStalkThePrey(core, actor)) {
                const target = core.rooms.find((room) => room.id === command.payload.roomId);
                if (target && resolveStalkThePreyTargets(core, actor).some((room) => room.id === target.id)) {
                    return { valid: true };
                }
            }
            return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
        case BETRAYAL_COMMANDS.EXPLORE_ROOM:
            if (isDead) {
                return { valid: false, error: '死亡探索者不能探索新房间。' };
            }
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT:
            if (isDead) {
                return { valid: false, error: '死亡探索者不能使用房间效果。' };
            }
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.USE_POSSESSION:
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.ROLL_EVENT: {
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
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT:
        case BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM:
        case BETRAYAL_COMMANDS.TRADE_POSSESSION:
        case BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT:
        case BETRAYAL_COMMANDS.LOOT_CORPSE:
            return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
        case BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE:
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.END_TURN:
            return { valid: true };
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL: {
            return (
                validateRecentRollAcknowledgement(core, command) ?? {
                    valid: false,
                    error: '当前没有待确认的投骰结果。',
                }
            );
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return { valid: false, error: '当前没有待确认的回合结束投骰。' };
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD: {
            const pending = pendingHelpingHandsReward;
            if (!pending) {
                return { valid: false, error: '当前没有待选择的援手攻击奖励。' };
            }
            if (pending.attackerPlayerId !== actor.playerId) {
                return { valid: false, error: '必须由攻击获胜者选择伤害或偷牌。' };
            }
            if (command.payload.choice === 'damage') {
                return { valid: true };
            }
            if (command.payload.choice !== 'steal') {
                return { valid: false, error: '必须选择造成伤害或偷取物品/预兆。' };
            }
            const cardId = command.payload.cardId;
            if (!cardId) {
                return { valid: false, error: '偷取时必须选择一张物品或预兆。' };
            }
            if (!resolveHelpingHandsStealableCards(core, pending.defenderPlayerId).some((card) => card.id === cardId)) {
                return { valid: false, error: '只能偷取防守者持有的物品或预兆。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD: {
            const pending = pendingMummyReward;
            if (!pending) {
                return { valid: false, error: '当前没有待选择的木乃伊攻击奖励。' };
            }
            if (pending.controllerPlayerId !== actor.playerId) {
                return { valid: false, error: '必须由木乃伊控制者选择伤害或偷取。' };
            }
            if (command.payload.choice === 'damage') {
                return { valid: true };
            }
            if (command.payload.choice !== 'steal') {
                return { valid: false, error: '必须选择造成伤害或偷取物品/预兆。' };
            }
            const cardId = command.payload.cardId;
            if (!cardId) {
                return { valid: false, error: '偷取时必须选择一张物品或预兆。' };
            }
            if (!pending.stealableCardIds.includes(cardId)) {
                return { valid: false, error: '只能偷取防守者当前可被木乃伊夺取的物品或预兆。' };
            }
            if (!resolveMummyStealableCards(core, pending.defenderPlayerId).some((card) => card.id === cardId)) {
                return { valid: false, error: '该木乃伊奖励目标已经不再可偷。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND: {
            const status = resolveHelpingHandsMonsterTurnStatus(core);
            if (!status.active || status.controllerPlayerId !== actor.playerId) {
                return { valid: false, error: '只有当前奇异护符持有人能控制巨魔手移动。' };
            }
            const monster = findHelpingHandsTrollHand(core, command.payload.monsterId);
            if (!monster) {
                return { valid: false, error: '必须选择一个巨魔手。' };
            }
            if (
                !command.payload.roomId ||
                !resolveHelpingHandsTrollHandMoveOptions(core, monster.id).some(
                    (room) => room.id === command.payload.roomId,
                )
            ) {
                return { valid: false, error: '巨魔手只能移动到已发现且真实连接的房间。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK: {
            const status = resolveHelpingHandsMonsterTurnStatus(core);
            if (!status.active || status.controllerPlayerId !== actor.playerId) {
                return { valid: false, error: '只有奇异护符持有人能控制巨魔手攻击。' };
            }
            const options = resolveHelpingHandsTrollHandAttackOptions(core);
            const option = command.payload.combined
                ? options.find((item) => item.combined)
                : options.find((item) => !item.combined && item.trollHandIds[0] === command.payload.monsterId);
            if (!option) {
                return {
                    valid: false,
                    error: command.payload.combined
                        ? '两个巨魔手必须同板块且未行动才能合击。'
                        : '必须选择一个可行动的巨魔手。',
                };
            }
            if (!command.payload.targetPlayerId || !option.targetPlayerIds.includes(command.payload.targetPlayerId)) {
                return { valid: false, error: '巨魔手只能攻击同板块的存活探索者。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN: {
            const status = resolveHelpingHandsMonsterTurnStatus(core);
            return status.active && status.controllerPlayerId === actor.playerId
                ? { valid: true }
                : { valid: false, error: '只有当前奇异护符持有人能结束巨魔手怪物回合。' };
        }
        case BETRAYAL_COMMANDS.TAKE_PHOTO: {
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            const trait = command.payload.trait ?? 'speed';
            if (!isMagicCameraHaunt(core) || isDead || !isTraitor) {
                return { valid: false, error: '只有魔法相机剧本中的存活叛徒能拍照。' };
            }
            if (!target || target.playerId === actor.playerId) {
                return { valid: false, error: '拍照必须选择一名英雄。' };
            }
            if (!Object.prototype.hasOwnProperty.call(actor.traits, trait)) {
                return { valid: false, error: '拍照成功后必须选择一个有效属性提升。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'take-photo', actor);
            if (actionBudget) {
                return actionBudget;
            }
            if (!canTakeMagicCameraPhoto(core, actor, target.playerId)) {
                return { valid: false, error: '目标英雄没有本质，或不在叛徒同板块/魔法相机视线内。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA:
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'smash-magic-camera', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            if (!canSmashMagicCamera(core, actor)) {
                return { valid: false, error: '必须由同板块的存活英雄砸毁叛徒持有的魔法相机。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK: {
            const monster = findPhantomPhotographer(core, command.payload.monsterId);
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!isMagicCameraHaunt(core) || !monster) {
                return { valid: false, error: '当前没有可行动的幻影摄影师。' };
            }
            if (core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds.includes(monster.id)) {
                return { valid: false, error: '该幻影摄影师已被眩晕，当前不能攻击。' };
            }
            if (!target || target.playerId === core.scenarioRuntime.traitorPlayerId) {
                return { valid: false, error: '幻影摄影师必须选择一名英雄。' };
            }
            if (
                !resolveMagicCameraPhantomAttackTargets(core, monster).some(
                    (explorer) => explorer.playerId === target.playerId,
                )
            ) {
                return { valid: false, error: '目标英雄不在幻影摄影师视线内。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO: {
            if (!isBloodFromStoneHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有第5号作祟《顽石之血》中的存活英雄能玩躲猫猫。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'play-peekaboo', actor);
            if (actionBudget) {
                return actionBudget;
            }
            const selection = resolveBloodFromStonePeekabooSelection(
                core,
                actor,
                command.payload.sameRoomMonsterId,
                command.payload.lineOfSightMonsterId,
            );
            if (!selection.option) {
                return { valid: false, error: selection.reason ?? '当前没有合法的玩躲猫猫目标组合。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.GIVE_MIRROR_HINT: {
            const uponReflection = core.scenarioRuntime.uponReflection;
            if (!isUponReflectionHaunt(core) || !uponReflection) {
                return { valid: false, error: '当前不是怪异的镜子作祟。' };
            }
            if (actor.playerId !== uponReflection.revealerPlayerId) {
                return { valid: false, error: '只有作祟揭秘者能给出镜中提示。' };
            }
            if (isDead) {
                return { valid: false, error: '死亡探索者不能给出镜中提示。' };
            }
            if (hasUsedMirrorHintThisTurn(core, actor.playerId)) {
                return { valid: false, error: '作祟揭秘者本回合已经给过镜中提示。' };
            }
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!target || core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)) {
                return { valid: false, error: '镜中提示必须交给一名存活玩家。' };
            }
            if (!command.payload.eventName?.trim()) {
                return { valid: false, error: '镜中提示必须选择一张事件牌。' };
            }
            if (core.deckCounts.event <= 0 || core.eventOrder.length === 0) {
                return { valid: false, error: '事件牌堆没有可用于镜中提示的事件牌。' };
            }
            if (!resolveUponReflectionHintEvent(core, command.payload.eventName)) {
                return { valid: false, error: '镜中提示只能选择当前事件牌堆中的事件牌。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE: {
            const uponReflection = core.scenarioRuntime.uponReflection;
            if (!isUponReflectionHaunt(core) || !uponReflection?.secretCombination) {
                return { valid: false, error: '当前不是怪异的镜子作祟，或秘密组合尚未记录。' };
            }
            if (actor.playerId === uponReflection.revealerPlayerId) {
                return { valid: false, error: '作祟揭秘者被困镜中，不能执行破咒。' };
            }
            if (isDead) {
                return { valid: false, error: '死亡探索者不能破咒。' };
            }
            const trait = command.payload.trait;
            if (!trait || !BETRAYAL_TRAIT_KEYS.includes(trait)) {
                return { valid: false, error: '破咒必须选择一个有效属性。' };
            }
            if (!command.payload.omenId && !command.payload.omenName?.trim()) {
                return { valid: false, error: '破咒必须报出自己持有的一张预兆。' };
            }
            const selectedOmen = resolveUponReflectionOmenSelection(actor, command.payload);
            if (!selectedOmen) {
                return { valid: false, error: '破咒只能报出当前行动者持有的预兆。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'break-mirror-curse', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS: {
            if (!isBloodFromStoneHaunt(core) || isDead) {
                return { valid: false, error: '只有第5号作祟《顽石之血》中的存活英雄能补放石像小天使。' };
            }
            const plan = resolveBloodFromStoneSetupPlacementPlan(core);
            if (plan.pendingPlayerChoiceCount <= 0) {
                return { valid: false, error: '当前没有需要玩家选择房间的石像小天使。' };
            }
            const roomIds = command.payload.roomIds;
            if (!Array.isArray(roomIds) || roomIds.length !== plan.pendingPlayerChoiceCount) {
                return {
                    valid: false,
                    error: `必须选择 ${plan.pendingPlayerChoiceCount} 个房间来补放石像小天使。`,
                };
            }
            const legalRoomIds = new Set(plan.playerChoiceCandidateRoomIds);
            const invalidRoomId = roomIds.find((roomId) => !legalRoomIds.has(roomId));
            if (invalidRoomId) {
                return { valid: false, error: '石像小天使只能补放到屋内已发现房间。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY: {
            const entryId = command.payload.entryId;
            const setupQueue = resolveBetrayalHauntSetupQueue(core);
            const entry = setupQueue.find((candidate) => candidate.id === entryId);
            if (!entryId || !entry) {
                return { valid: false, error: '当前 setup 队列没有这个条目。' };
            }
            if (entry.status === 'resolved') {
                return { valid: false, error: '该 setup 条目已经确认。' };
            }
            if (
                !isDustHaunt(core) ||
                (entryId !== 'monster-card-left-of-revealer' && entryId !== 'prepare-research-tokens')
            ) {
                return { valid: false, error: '当前只支持确认灰尘 setup 条目。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
            if (command.payload.target === 'dynamite-room' || isDynamiteCardId(command.payload.weaponCardId)) {
                const dynamiteCard = resolveDynamiteInventoryCard(actor, command.payload.weaponCardId);
                if (command.payload.target !== 'dynamite-room' || !isDynamiteCardId(command.payload.weaponCardId)) {
                    return { valid: false, error: '炸药必须作为攻击使用，并选择当前或相邻板块作为目标。' };
                }
                if (isDead) {
                    return { valid: false, error: '死亡探索者不能使用炸药。' };
                }
                if (!dynamiteCard) {
                    return { valid: false, error: '当前探索者没有可用于攻击的炸药。' };
                }
                if (!core.turnStartInventoryCardIds.includes(dynamiteCard.id)) {
                    return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                }
                if (core.usedCardIdsThisTurn.includes(dynamiteCard.id)) {
                    return { valid: false, error: '这把武器本回合已经使用。' };
                }
                const targetRoomId = command.payload.targetRoomId;
                if (!targetRoomId) {
                    return { valid: false, error: '炸药攻击必须选择当前或相邻板块。' };
                }
                const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
                if (!targetRoom || targetRoom.state !== 'discovered') {
                    return { valid: false, error: '炸药只能选择已发现板块。' };
                }
                if (!isDynamiteTargetRoom(core, actorRoomId, targetRoom.id)) {
                    return { valid: false, error: '炸药只能选择你所在的板块或相邻板块。' };
                }
                return { valid: true };
            }
            if (isDustHaunt(core)) {
                const weaponEffect = command.payload.weaponCardId
                    ? resolveAttackWeaponEffect(actor, command.payload.weaponCardId)
                    : null;
                if (command.payload.weaponCardId) {
                    if (!weaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                const target = command.payload.targetPlayerId
                    ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                    : null;
                if (!target || target.playerId === actor.playerId) {
                    return { valid: false, error: '灰尘剧本必须选择另一名探索者作为攻击目标。' };
                }
                if (core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)) {
                    return { valid: false, error: '不能攻击已经死亡的探索者。' };
                }
                if (!isAttackTargetInWeaponRange(core, actorRoomId, target.roomId, weaponEffect)) {
                    return { valid: false, error: `灰尘剧本只能攻击${formatAttackRangeLabel(weaponEffect)}的探索者。` };
                }
                return { valid: true };
            }
            if (isHelpingHandsHaunt(core)) {
                if (isDead) {
                    return { valid: false, error: '死亡探索者不能在第12号作祟《援手》中攻击。' };
                }
                const weaponEffect = command.payload.weaponCardId
                    ? resolveAttackWeaponEffect(actor, command.payload.weaponCardId)
                    : null;
                if (command.payload.weaponCardId) {
                    if (!weaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                if (command.payload.target === 'troll-hand') {
                    const trollHand = findHelpingHandsTrollHand(core, command.payload.targetMonsterId);
                    if (!trollHand || trollHand.roomId !== actorRoomId) {
                        return { valid: false, error: '必须和巨魔手处于同一房间才能攻击。' };
                    }
                    return { valid: true };
                }
                if (command.payload.target !== 'hero') {
                    return { valid: false, error: '自由混战只能攻击另一名探索者。' };
                }
                const target = command.payload.targetPlayerId
                    ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                    : null;
                if (
                    !target ||
                    target.playerId === actor.playerId ||
                    core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId) ||
                    !isAttackTargetInWeaponRange(core, actorRoomId, target.roomId, weaponEffect)
                ) {
                    return {
                        valid: false,
                        error: `自由混战只能攻击${formatAttackRangeLabel(weaponEffect)}的其他存活探索者。`,
                    };
                }
                return { valid: true };
            }
            if (isMagicCameraHaunt(core)) {
                if (command.payload.weaponCardId) {
                    const weaponEffect = resolveAttackWeaponEffect(actor, command.payload.weaponCardId);
                    if (!weaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                if (command.payload.target === 'phantom-photographer') {
                    const monster = findPhantomPhotographer(core, command.payload.targetMonsterId);
                    if (isTraitor || isDead) {
                        return { valid: false, error: '只有存活英雄能攻击幻影摄影师。' };
                    }
                    if (!monster || monster.roomId !== actorRoomId) {
                        return { valid: false, error: '必须和幻影摄影师同板块才能攻击。' };
                    }
                    return { valid: true };
                }
                if (command.payload.target === 'traitor') {
                    const traitor = core.scenarioRuntime.traitorPlayerId
                        ? findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId)
                        : null;
                    if (isTraitor || isDead || !traitor || traitor.roomId !== actorRoomId) {
                        return { valid: false, error: '只有同板块的存活英雄能攻击叛徒。' };
                    }
                    return { valid: true };
                }
                if (command.payload.target === 'hero') {
                    const target = command.payload.targetPlayerId
                        ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                        : null;
                    if (!isTraitor || isDead || !target) {
                        return { valid: false, error: '只有存活叛徒能攻击指定英雄。' };
                    }
                    if (
                        target.playerId === actor.playerId ||
                        target.playerId === core.scenarioRuntime.traitorPlayerId ||
                        core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId) ||
                        target.roomId !== actorRoomId
                    ) {
                        return { valid: false, error: '叛徒只能攻击同板块的存活英雄。' };
                    }
                    return { valid: true };
                }
            }
            {
                const attackWeaponEffect = command.payload.weaponCardId
                    ? resolveAttackWeaponEffect(actor, command.payload.weaponCardId)
                    : null;
                if (command.payload.weaponCardId) {
                    if (!attackWeaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                if (command.payload.target === 'traitor') {
                    const traitor = core.scenarioRuntime.traitorPlayerId
                        ? findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId)
                        : null;
                    if (
                        !traitor ||
                        !isAttackTargetInWeaponRange(core, actorRoomId, traitor.roomId, attackWeaponEffect)
                    ) {
                        return {
                            valid: false,
                            error: attackWeaponEffect
                                ? `${attackWeaponEffect.card.name}只能攻击${formatAttackRangeLabel(attackWeaponEffect)}的叛徒。`
                                : '必须和叛徒处于同一房间才能攻击。',
                        };
                    }
                }
                if (command.payload.target === 'hero') {
                    const livingHeroesInAttackRange = getAllExplorers(core).filter(
                        (explorer) =>
                            explorer.playerId !== core.scenarioRuntime.traitorPlayerId &&
                            !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId) &&
                            isAttackTargetInWeaponRange(core, actorRoomId, explorer.roomId, attackWeaponEffect),
                    );
                    if (livingHeroesInAttackRange.length === 0) {
                        return {
                            valid: false,
                            error: `当前${formatAttackRangeLabel(attackWeaponEffect)}没有可攻击的英雄。`,
                        };
                    }
                    if (!command.payload.targetPlayerId) {
                        return { valid: false, error: '必须选择要攻击的英雄。' };
                    }
                    if (
                        command.payload.targetPlayerId &&
                        !livingHeroesInAttackRange.some(
                            (explorer) => explorer.playerId === command.payload.targetPlayerId,
                        )
                    ) {
                        return {
                            valid: false,
                            error: `指定的英雄不在当前${formatAttackRangeLabel(attackWeaponEffect)}。`,
                        };
                    }
                }
            }
            if (command.payload.target === 'traitor' && isTraitor) {
                return { valid: false, error: '叛徒不能攻击自己。' };
            }
            if (command.payload.target === 'jack-spirit' && !core.scenarioRuntime.jackSpiritReleased) {
                return { valid: false, error: '杰克之灵尚未出现。' };
            }
            if (command.payload.target === 'jack-spirit' && actor.roomId !== core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '必须和杰克之灵处于同一房间。' };
            }
            if (command.payload.target === 'hero' && !isTraitor && !isDead) {
                return { valid: false, error: '当前只有叛徒侧可主动攻击英雄。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.SEARCH_FOR_CURE: {
            const trait = command.payload.trait;
            if (!isDustHaunt(core) || isDead) {
                return { valid: false, error: '只有灰尘剧本中的存活探索者能寻找解药。' };
            }
            if (trait !== 'knowledge' && trait !== 'sanity') {
                return { valid: false, error: '寻找解药必须选择知识或神志。' };
            }
            if (!canSearchForCure(core, actor)) {
                return { valid: false, error: '必须在带有恶兆符号且没有研究标记的板块才能寻找解药。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'search-for-cure', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.CURE_THE_DUST: {
            const trait = command.payload.trait;
            if (!isDustHaunt(core) || isDead) {
                return { valid: false, error: '只有灰尘剧本中的存活探索者能尝试治愈灰尘。' };
            }
            if (!trait || !Object.prototype.hasOwnProperty.call(actor.traits, trait)) {
                return { valid: false, error: '治愈灰尘必须选择一个有效属性。' };
            }
            if (!canCureTheDust(core, actor)) {
                return { valid: false, error: '必须在可研究板块或带研究标记的板块才能治愈灰尘。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'cure-the-dust', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE: {
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!isDustHaunt(core) || isDead) {
                return { valid: false, error: '只有灰尘剧本中的存活探索者能请求交换疾病标记。' };
            }
            if (!target || target.playerId === actor.playerId) {
                return { valid: false, error: '必须选择另一名探索者交换疾病标记。' };
            }
            if (
                core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId) ||
                target.roomId !== actor.roomId
            ) {
                return { valid: false, error: '只能请求同板块的存活探索者交换疾病标记。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'sickness-exchange', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK: {
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能调查杰克。' };
            }
            if (!isBetrayalLibraryRoom(core.rooms.find((room) => room.id === actor.roomId))) {
                return { valid: false, error: '必须在图书馆才能调查杰克。' };
            }
            const livingHeroWithoutKnowledge = getAllExplorers(core).some(
                (explorer) =>
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId &&
                    !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId) &&
                    !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(explorer.playerId),
            );
            if (!livingHeroWithoutKnowledge) {
                return { valid: false, error: '所有存活英雄都已经掌握杰克线索。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'learn-about-jack', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能研究驱魔法阵。' };
            }
            if (core.rooms.find((room) => room.id === actor.roomId)?.discoveryReward !== 'event') {
                return { valid: false, error: '必须在带有事件标记的房间才能研究驱魔法阵。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'study-exorcism', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能驱魔。' };
            }
            if (!core.scenarioRuntime.jackSpiritReleased || !core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '杰克之灵尚未出现。' };
            }
            if (actor.roomId !== core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '必须与杰克之灵处于同一房间。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'exorcise-jack', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME:
            if (!isMummyHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活英雄能寻找木乃伊真名。' };
            }
            if (!isMummyNameStudyRoom(core, actor.roomId)) {
                return { valid: false, error: '必须在石棺房、书房或图书馆才能寻找木乃伊真名。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'study-mummy-name', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT:
            if (!isMummyHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活英雄能学习驱逐法术。' };
            }
            if (!core.scenarioRuntime.mummy?.trueNameFound) {
                return { valid: false, error: '必须先找到木乃伊真名。' };
            }
            if (!hasOmenBook(actor)) {
                return { valid: false, error: '必须由持有书本的英雄学习驱逐法术。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'learn-mummy-banishment', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.BANISH_MUMMY: {
            const mummy = findMummyMonster(core);
            if (!isMummyHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活英雄能驱逐木乃伊。' };
            }
            if (
                !core.scenarioRuntime.mummy?.banishmentSpellLearned ||
                core.scenarioRuntime.mummy.knowledgeTokenCount < 2
            ) {
                return { valid: false, error: '必须先取得两枚知识标记并学会驱逐法术。' };
            }
            if (!mummy || actor.roomId !== mummy.roomId) {
                return { valid: false, error: '行动英雄必须与木乃伊处于同一房间。' };
            }
            if (!hasLivingHeroWithBookInRoom(core, mummy.roomId)) {
                return { valid: false, error: '木乃伊所在房间必须有一名存活英雄持有书本。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'banish-mummy', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL: {
            const mummy = core.scenarioRuntime.mummy;
            if (!isMummyHaunt(core) || !mummy || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活探索者能拾起女孩。' };
            }
            if (mummy.girlHeldByMummy || mummy.girlHolderPlayerId) {
                return { valid: false, error: '女孩已经被持有。' };
            }
            if (!mummy.girlRoomId || actorRoomId !== mummy.girlRoomId) {
                return { valid: false, error: '必须与女孩标记处于同一房间。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY: {
            const mummy = core.scenarioRuntime.mummy;
            const mummyMonster = findMummyMonster(core);
            if (!isMummyHaunt(core) || !mummy || !mummyMonster || !isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活叛徒能把女孩交给木乃伊。' };
            }
            if (mummy.girlHolderPlayerId !== actor.playerId) {
                return { valid: false, error: '必须由当前持有女孩的探索者交给木乃伊。' };
            }
            if (actorRoomId !== mummyMonster.roomId) {
                return { valid: false, error: '必须与木乃伊处于同一房间才能交出女孩。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY: {
            const mummy = core.scenarioRuntime.mummy;
            const mummyMonster = findMummyMonster(core);
            const card = findMummyWeddingOmenCard(actor, command.payload.cardId);
            if (!isMummyHaunt(core) || !mummy || !mummyMonster || !isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活叛徒能把圣符或指环交给木乃伊。' };
            }
            if (!card) {
                return { valid: false, error: '必须持有圣符或指环。' };
            }
            if (mummy.mummyCarriedOmenIds.includes(card.id)) {
                return { valid: false, error: '木乃伊已经携带这张预兆。' };
            }
            if (actorRoomId !== mummyMonster.roomId) {
                return { valid: false, error: '必须与木乃伊处于同一房间才能交出圣符或指环。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return { valid: false, error: '真实首剧本不能通过手工结算完成。' };
        default:
            return { valid: false, error: '未知 haunt 命令。' };
    }
}
