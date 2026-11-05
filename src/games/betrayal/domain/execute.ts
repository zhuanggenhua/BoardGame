import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type { BetrayalCore } from './types';
import type { BetrayalCommand } from '../commandTypes';
import { type BetrayalEvent, EVENTS } from '../events';
import { BETRAYAL_COMMANDS } from '../commands';
import { getBetrayalScenarioCardCandidate, resolveImplementedScenarioIdForCard } from '../scenarioConfig';
import { resolveBetrayalExplorerMovedPayload } from '../movementResolutionModel';
import { resolveBetrayalRoomExploredPayload } from '../roomDiscoveryEventModel';
import {
    resolveBetrayalEventRolledPayload,
    resolveBetrayalCardResolutionAcknowledgedPayload,
    resolveBetrayalRecentRollAcknowledgedPayload,
    resolveBetrayalEventRollFinalizedPayload,
    resolveBetrayalEventChoiceCommandEvents,
} from '../eventCommandResolutionModel';
import { resolveBetrayalPossessionUsedPayload } from '../possessionUseResolution';
import { resolveBetrayalRecentRollRerollPayload } from '../recentRollRerollResolutionModel';
import { createBetrayalRoomEffectUsedPayload } from '../roomEnterEffectModel';
import { createBetrayalTradeRequestedPayload, resolveBetrayalTradeAgreementEventPayload } from '../trade';
import { createBetrayalCorpseLootedPayload } from '../deathStateReadModel';
import { resolveBetrayalEndTurnCommandEvents } from '../turnEndCommandResolutionModel';
import { resolvePendingTurnEndRoll } from '../acknowledgementReadModel';
import { findExplorerByPlayerId, getAllExplorers } from '../explorerReadModel';
import {
    createBetrayalHelpingHandsMonsterTurnStartedEvent,
    resolveBetrayalMonsterDamageResolvedPayload,
    resolveBetrayalMonsterTurnStartResolvedPayload,
    resolveBetrayalMonsterMovementGroupRolledPayload,
    resolveBetrayalMonsterMovedPayload,
    resolveBloodFromStoneMonsterTurnEndedPayload,
    resolveBetrayalMonsterAttackHeroResolvedPayload,
} from '../monsterActionResolutionModel';
import {
    resolveBetrayalDamageAllocationResolvedPayload,
    wouldExplorerDieFromAttackDamage,
    rollDeathPrevention,
    formatDeathPreventionLog,
    wouldExplorerDieFromMentalDamage,
} from '../damageResolutionModel';
import { resolveBetrayalHauntAttackCommandEvents } from '../attackResolutionModel';
import {
    resolveBloodFromStoneSetupPlacementPlan,
    resolveBloodFromStoneSelectedExtraStoneCherubPlacements,
} from '../bloodFromStoneSetupReadModel';
import {
    resolveHelpingHandsPendingAttackReward,
    resolveMummyPendingAttackReward,
    MUMMY_GIRL_STEAL_CARD_ID,
    resolveMummyGirlStealCard,
    resolveHelpingHandsTrollHandMoveCost,
    resolveHelpingHandsTrollHandAttackOptions,
} from '../hauntAttackRewardReadModel';
import {
    findHelpingHandsTrollHand,
    findPhantomPhotographer,
    hasBloodFromStoneMirror,
    resolveControlledRoomId,
    findMummyMonster,
} from '../hauntScenarioReadModel';
import { rollBetrayalDicePips } from '../diceRules';
import {
    rollTrait,
    rollNonCombatTraitCheckWithDice,
    rollNonCombatTraitCheck,
    rollTraitCheckWithDice,
} from '../traitRollModel';
import { rotateToNextLivingPlayer, resolveNextLivingPlayerIdInTurnOrder } from '../turnOrderReadModel';
import { resolveDustSicknessSwap } from '../dustHauntRules';
import { BETRAYAL_TRAIT_LABEL as TRAIT_LABEL, resolveInventoryEffectId } from '../possessionEffects';
import { resolveBloodFromStonePeekabooSelection, countExorcismCirclesInRegion } from '../hauntSpecialActionReadModel';
import {
    resolveUponReflectionHintEvent,
    resolveUponReflectionOmenSelection,
    roomMatchesUponReflectionSecret,
} from './scenarioResolution';
import { resolveMonsterTrait } from '../monsterReadModel';
import { findMummyWeddingOmenCard } from '../mummyHauntRules';

export const nowEvent = <TType extends string, TPayload>(
    type: TType,
    payload: TPayload,
    timestamp: number,
): GameEvent<TType, TPayload> => ({
    type,
    payload,
    timestamp,
});

export function executeCommand(
    state: MatchState<BetrayalCore>,
    command: BetrayalCommand,
    random: RandomFn,
): BetrayalEvent[] {
    const core = state.core;
    const timestamp = command.timestamp ?? 0;

    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER:
            return [
                nowEvent(
                    EVENTS.EXPLORER_SELECTED,
                    {
                        playerId: command.playerId,
                        explorerId: command.payload.explorerId,
                    },
                    timestamp,
                ),
            ];
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            return [nowEvent(EVENTS.EXPLORER_CONFIRMED, { playerId: command.playerId }, timestamp)];
        case BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD: {
            const candidate = getBetrayalScenarioCardCandidate(command.payload.candidateId);
            return [
                nowEvent(
                    EVENTS.SCENARIO_CARD_PROPOSED,
                    {
                        playerId: command.playerId,
                        candidateId: candidate.id,
                        title: candidate.title,
                        logText: `玩家 ${command.playerId} 提议剧本卡：${candidate.title}`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD: {
            const candidate = getBetrayalScenarioCardCandidate(core.proposedScenarioCardId);
            return [
                nowEvent(
                    EVENTS.SCENARIO_CARD_CONFIRMED,
                    {
                        playerId: command.playerId,
                        candidateId: candidate.id,
                        title: candidate.title,
                        logText: `玩家 ${command.playerId} 确认剧本卡：${candidate.title}`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.START_SCENARIO:
            return [
                nowEvent(
                    EVENTS.SCENARIO_STARTED,
                    {
                        playerIds: core.playerIds,
                        scenarioId:
                            command.payload.scenarioId ??
                            resolveImplementedScenarioIdForCard(core.proposedScenarioCardId) ??
                            core.scenarioId,
                    },
                    timestamp,
                ),
            ];
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const payload = resolveBetrayalExplorerMovedPayload(core, command, random);
            return payload ? [nowEvent(EVENTS.EXPLORER_MOVED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const payload = resolveBetrayalRoomExploredPayload(
                core,
                {
                    playerId: command.playerId,
                    payload: command.payload,
                },
                random,
                timestamp,
            );
            return payload ? [nowEvent(EVENTS.ROOM_EXPLORED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.ROLL_EVENT: {
            const payload = resolveBetrayalEventRolledPayload(core, command.playerId, random, timestamp);
            return payload ? [nowEvent(EVENTS.EVENT_ROLLED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION: {
            const payload = resolveBetrayalCardResolutionAcknowledgedPayload(core, command.playerId);
            return payload ? [nowEvent(EVENTS.CARD_RESOLUTION_ACKNOWLEDGED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL: {
            const payload = resolveBetrayalRecentRollAcknowledgedPayload(core, command.playerId);
            return payload ? [nowEvent(EVENTS.RECENT_ROLL_ACKNOWLEDGED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL: {
            const payload = resolveBetrayalEventRollFinalizedPayload(core, command.playerId, random);
            return payload ? [nowEvent(EVENTS.EVENT_ROLL_FINALIZED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            const eventPayload = resolveBetrayalPossessionUsedPayload(core, command.playerId, command.payload, {
                random,
                timestamp,
            });
            return eventPayload ? [nowEvent(EVENTS.POSSESSION_USED, eventPayload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT:
        case BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM: {
            const payload = resolveBetrayalRecentRollRerollPayload(core, command, random);
            return payload ? [nowEvent(EVENTS.RABBIT_FOOT_USED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE:
            return resolveBetrayalEventChoiceCommandEvents(core, command, random, timestamp);
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT: {
            const payload = createBetrayalRoomEffectUsedPayload(core, command.playerId, random);
            if (!payload) {
                return [];
            }
            return [nowEvent(EVENTS.ROOM_EFFECT_USED, payload, timestamp)];
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION: {
            const tradeRequestPayload = createBetrayalTradeRequestedPayload(core, command.playerId, command.payload);
            return tradeRequestPayload
                ? [nowEvent(EVENTS.POSSESSION_TRADE_REQUESTED, tradeRequestPayload, timestamp)]
                : [];
        }
        case BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT: {
            const tradeAgreementEvent = resolveBetrayalTradeAgreementEventPayload(core, command.payload.accept);
            if (!tradeAgreementEvent) {
                return [];
            }
            return tradeAgreementEvent.kind === 'accepted'
                ? [nowEvent(EVENTS.POSSESSION_TRADED, tradeAgreementEvent.payload, timestamp)]
                : [nowEvent(EVENTS.POSSESSION_TRADE_DECLINED, tradeAgreementEvent.payload, timestamp)];
        }
        case BETRAYAL_COMMANDS.LOOT_CORPSE: {
            const corpseLootPayload = createBetrayalCorpseLootedPayload(core, command.playerId, command.payload);
            return corpseLootPayload ? [nowEvent(EVENTS.CORPSE_LOOTED, corpseLootPayload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.END_TURN:
            return resolveBetrayalEndTurnCommandEvents(core, random, timestamp);
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL: {
            const pendingRoll = resolvePendingTurnEndRoll(core);
            const roomEndTurn = pendingRoll?.roomEndTurn;
            const deathPreventionTurnEnd = pendingRoll?.deathPrevention?.nextPlayerId
                ? pendingRoll.deathPrevention
                : null;
            const nextPlayerId = roomEndTurn?.nextPlayerId ?? deathPreventionTurnEnd?.nextPlayerId;
            if (!pendingRoll || !nextPlayerId) {
                return [];
            }
            const monsterMovementRoll =
                roomEndTurn?.monsterMovementRoll ?? deathPreventionTurnEnd?.monsterMovementRoll ?? null;
            const helpingHandsMonsterTurnControllerPlayerId =
                roomEndTurn?.helpingHandsMonsterTurnControllerPlayerId ??
                deathPreventionTurnEnd?.helpingHandsMonsterTurnControllerPlayerId;
            const skipBloodFromStoneMonsterTurnStart =
                roomEndTurn?.skipBloodFromStoneMonsterTurnStart ??
                deathPreventionTurnEnd?.skipBloodFromStoneMonsterTurnStart;
            const nextExplorer = findExplorerByPlayerId(core, nextPlayerId);
            const turnLogText =
                roomEndTurn?.turnLogText ??
                deathPreventionTurnEnd?.turnLogText ??
                (nextExplorer ? `轮到${nextExplorer.displayName}` : '进入下一位玩家回合');
            return [
                nowEvent(
                    EVENTS.TURN_END_ROLL_ACKNOWLEDGED,
                    {
                        previousPlayerId: pendingRoll.playerId,
                        nextPlayerId,
                        monsterMovementRoll,
                        helpingHandsMonsterTurnControllerPlayerId,
                        skipBloodFromStoneMonsterTurnStart,
                        logText: turnLogText,
                    },
                    timestamp,
                ),
                ...(helpingHandsMonsterTurnControllerPlayerId
                    ? [
                          createBetrayalHelpingHandsMonsterTurnStartedEvent(
                              helpingHandsMonsterTurnControllerPlayerId,
                              random,
                              timestamp,
                          ),
                      ]
                    : []),
            ];
        }
        case BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION: {
            const damageAllocationPayload = resolveBetrayalDamageAllocationResolvedPayload(
                core,
                command.payload,
                random,
            );
            if (!damageAllocationPayload) {
                return [];
            }
            return [nowEvent(EVENTS.DAMAGE_ALLOCATION_RESOLVED, damageAllocationPayload, timestamp)];
        }
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
            return resolveBetrayalHauntAttackCommandEvents(core, command, random, timestamp);
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE: {
            const payload = resolveBetrayalMonsterDamageResolvedPayload(core, {
                playerId: command.playerId,
                payload: command.payload,
            });
            return payload ? [nowEvent(EVENTS.MONSTER_DAMAGE_RESOLVED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START: {
            const payload = resolveBetrayalMonsterTurnStartResolvedPayload(core, {
                playerId: command.playerId,
                payload: command.payload,
            });
            return payload ? [nowEvent(EVENTS.MONSTER_TURN_START_RESOLVED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP: {
            const payload = resolveBetrayalMonsterMovementGroupRolledPayload(
                core,
                {
                    playerId: command.playerId,
                    payload: command.payload,
                },
                random,
            );
            return payload ? [nowEvent(EVENTS.MONSTER_MOVEMENT_GROUP_ROLLED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM: {
            const payload = resolveBetrayalMonsterMovedPayload(core, {
                playerId: command.playerId,
                payload: command.payload,
            });
            return payload ? [nowEvent(EVENTS.MONSTER_MOVED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN: {
            const payload = resolveBloodFromStoneMonsterTurnEndedPayload(
                core,
                {
                    playerId: command.playerId,
                },
                random,
            );
            return payload ? [nowEvent(EVENTS.BLOOD_FROM_STONE_MONSTER_TURN_ENDED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS: {
            const plan = resolveBloodFromStoneSetupPlacementPlan(core);
            const existingExtraPlacementCount =
                plan.automaticExtraPlacements.length + plan.playerChoicePlacements.length;
            const placements = resolveBloodFromStoneSelectedExtraStoneCherubPlacements(
                core,
                command.payload.roomIds ?? [],
                existingExtraPlacementCount,
            );
            if (placements.length === 0) {
                return [];
            }
            const roomNames = placements.map((placement) => placement.roomName).join('、');
            return [
                nowEvent(
                    EVENTS.BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED,
                    {
                        playerId: command.playerId,
                        placements,
                        logText: `补放 ${placements.length} 个石像小天使：${roomNames}`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO: {
            const payload = resolveBetrayalMonsterAttackHeroResolvedPayload(
                core,
                {
                    playerId: command.playerId,
                    payload: command.payload,
                },
                random,
            );
            return payload ? [nowEvent(EVENTS.MONSTER_ATTACK_HERO_RESOLVED, payload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD: {
            const pending = resolveHelpingHandsPendingAttackReward(core);
            const attacker = pending ? findExplorerByPlayerId(core, pending.attackerPlayerId) : null;
            const defender = pending ? findExplorerByPlayerId(core, pending.defenderPlayerId) : null;
            if (!pending || !attacker || !defender) {
                return [];
            }
            if (command.payload.choice === 'steal') {
                const card = defender.inventory.find((item) => item.id === command.payload.cardId);
                if (!card || (card.kind !== 'item' && card.kind !== 'omen')) {
                    return [];
                }
                return [
                    nowEvent(
                        EVENTS.HELPING_HANDS_ATTACK_REWARD_RESOLVED,
                        {
                            attackerPlayerId: attacker.playerId,
                            defenderPlayerId: defender.playerId,
                            choice: 'steal',
                            stolenCardId: card.id,
                            stolenCardName: card.name,
                            logText: `${attacker.displayName}没有造成伤害，改为从${defender.displayName}手中偷走${card.name}`,
                        },
                        timestamp,
                    ),
                ];
            }
            const deathPreventionRoll = wouldExplorerDieFromAttackDamage(
                defender,
                pending.damageToDefender,
                pending.damageKind,
            )
                ? rollDeathPrevention(random, defender)
                : null;
            const defenderDefeated =
                wouldExplorerDieFromAttackDamage(defender, pending.damageToDefender, pending.damageKind) &&
                !deathPreventionRoll?.prevented;
            const deathPrevention = deathPreventionRoll
                ? {
                      ...deathPreventionRoll,
                      damageAmount: pending.damageToDefender,
                      damageKind: pending.damageKind,
                      traitsBeforeDamage: { ...pending.defenderTraitsBeforeDamage },
                  }
                : undefined;
            const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
            return [
                nowEvent(
                    EVENTS.HELPING_HANDS_ATTACK_REWARD_RESOLVED,
                    {
                        attackerPlayerId: attacker.playerId,
                        defenderPlayerId: defender.playerId,
                        choice: 'damage',
                        damageToDefender: pending.damageToDefender,
                        damageKind: pending.damageKind,
                        defeatedPlayerId: defenderDefeated ? defender.playerId : undefined,
                        deathPrevention,
                        logText: `${attacker.displayName}选择造成 ${pending.damageToDefender} 点 ${pending.damageKind} damage${deathPreventionLog}`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD: {
            const pending = resolveMummyPendingAttackReward(core);
            const defender = pending ? findExplorerByPlayerId(core, pending.defenderPlayerId) : null;
            if (!pending || !defender) {
                return [];
            }
            if (command.payload.choice === 'steal') {
                const cardId = command.payload.cardId;
                const stolenCard =
                    cardId === MUMMY_GIRL_STEAL_CARD_ID
                        ? resolveMummyGirlStealCard()
                        : defender.inventory.find((item) => item.id === cardId);
                if (!stolenCard || (stolenCard.kind !== 'item' && stolenCard.kind !== 'omen')) {
                    return [];
                }
                return [
                    nowEvent(
                        EVENTS.MUMMY_ATTACK_REWARD_RESOLVED,
                        {
                            controllerPlayerId: pending.controllerPlayerId,
                            monsterId: pending.monsterId,
                            monsterName: pending.monsterName,
                            defenderPlayerId: defender.playerId,
                            choice: 'steal',
                            stolenCardId: stolenCard.id,
                            stolenCardName: stolenCard.name,
                            logText: `${pending.monsterName}没有造成伤害，改为从${defender.displayName}手中夺走${stolenCard.name}`,
                        },
                        timestamp,
                    ),
                ];
            }
            return [
                nowEvent(
                    EVENTS.MUMMY_ATTACK_REWARD_RESOLVED,
                    {
                        controllerPlayerId: pending.controllerPlayerId,
                        monsterId: pending.monsterId,
                        monsterName: pending.monsterName,
                        defenderPlayerId: defender.playerId,
                        choice: 'damage',
                        damageToHero: pending.damageToHero,
                        damageKind: 'physical',
                        logText: `${pending.monsterName}选择造成 ${pending.damageToHero} 点 physical damage`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND: {
            const monster = findHelpingHandsTrollHand(core, command.payload.monsterId);
            const targetRoom = command.payload.roomId
                ? core.rooms.find((room) => room.id === command.payload.roomId)
                : null;
            if (!monster || !targetRoom) {
                return [];
            }
            const moveCost = resolveHelpingHandsTrollHandMoveCost(core, monster.id);
            const helpingHands = core.scenarioRuntime.helpingHands;
            const moveRemaining = Math.max(0, (helpingHands?.trollHandMoveRemainingById[monster.id] ?? 0) - moveCost);
            return [
                nowEvent(
                    EVENTS.HELPING_HANDS_TROLL_HAND_MOVED,
                    {
                        controllerPlayerId: command.playerId,
                        monsterId: monster.id,
                        fromRoomId: monster.roomId,
                        toRoomId: targetRoom.id,
                        moveCost,
                        moveRemaining,
                        logText: `${monster.name}从${core.rooms.find((room) => room.id === monster.roomId)?.name ?? monster.roomId}移动到${targetRoom.name}，消耗 ${moveCost} 点移动`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK: {
            const options = resolveHelpingHandsTrollHandAttackOptions(core);
            const option = command.payload.combined
                ? options.find((item) => item.combined)
                : options.find((item) => !item.combined && item.trollHandIds[0] === command.payload.monsterId);
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!option || !target) {
                return [];
            }
            const defenderTraitsBeforeDamage = { ...target.traits };
            const dice = rollBetrayalDicePips(random, option.might);
            const attackerRoll = dice.reduce((sum, pip) => sum + pip, 0);
            const defenderRoll = rollTrait(random, target.traits.might);
            const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
            return [
                nowEvent(
                    EVENTS.HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED,
                    {
                        controllerPlayerId: command.playerId,
                        targetPlayerId: target.playerId,
                        trollHandIds: option.trollHandIds,
                        combined: option.combined,
                        attackDice: dice,
                        attackerRoll,
                        defenderRoll,
                        damageToDefender: damageToDefender || undefined,
                        defenderTraitsBeforeDamage,
                        logText:
                            damageToDefender > 0
                                ? `${option.label}攻击${target.displayName}，造成 ${damageToDefender} 点 physical damage`
                                : `${option.label}攻击${target.displayName}，但没有造成伤害`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN: {
            const helpingHands = core.scenarioRuntime.helpingHands;
            if (!helpingHands) {
                return [];
            }
            const nextPlayerId = rotateToNextLivingPlayer(core, helpingHands.monsterTurnAfterPlayerId);
            const nextExplorer = findExplorerByPlayerId(core, nextPlayerId);
            return [
                nowEvent(
                    EVENTS.HELPING_HANDS_MONSTER_TURN_ENDED,
                    {
                        controllerPlayerId: command.playerId,
                        nextPlayerId,
                        logText: `巨魔手怪物回合结束${nextExplorer ? `，轮到${nextExplorer.displayName}` : ''}`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.SEARCH_FOR_CURE: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId)!;
            const trait = command.payload.trait ?? 'knowledge';
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, trait);
            const success = roll.total >= 5;
            const leftPlayerId = success ? null : resolveNextLivingPlayerIdInTurnOrder(core, actor.playerId);
            const swap =
                !success && leftPlayerId && core.scenarioRuntime.dust
                    ? (resolveDustSicknessSwap(core.scenarioRuntime.dust, actor.playerId, leftPlayerId, random) ??
                      undefined)
                    : undefined;
            return [
                nowEvent(
                    EVENTS.DUST_SEARCH_RESOLVED,
                    {
                        playerId: actor.playerId,
                        roomId: room.id,
                        trait,
                        rollTotal: roll.total,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        success,
                        swap,
                        logText: success
                            ? `${actor.displayName}寻找解药成功，在${room.name}放置了研究标记`
                            : `${actor.displayName}寻找解药失败${swap ? '，与左侧玩家随机交换了疾病标记' : ''}`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.CURE_THE_DUST: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId)!;
            const trait = command.payload.trait ?? 'knowledge';
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, trait);
            const researchBonus = (core.scenarioRuntime.dust?.researchRoomIds.length ?? 0) * 2;
            const rollTotal = roll.total + researchBonus;
            const success = rollTotal >= 13;
            const leftPlayerId = success ? null : resolveNextLivingPlayerIdInTurnOrder(core, actor.playerId);
            const swap =
                !success && leftPlayerId && core.scenarioRuntime.dust
                    ? (resolveDustSicknessSwap(core.scenarioRuntime.dust, actor.playerId, leftPlayerId, random) ??
                      undefined)
                    : undefined;
            return [
                nowEvent(
                    EVENTS.DUST_CURE_RESOLVED,
                    {
                        playerId: actor.playerId,
                        roomId: room.id,
                        trait,
                        rollTotal,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        researchBonus,
                        success,
                        swap,
                        logText: success
                            ? `${actor.displayName}完成治愈灰尘，英雄阵营胜利`
                            : `${actor.displayName}尝试治愈灰尘失败${swap ? '，与左侧玩家随机交换了疾病标记' : ''}`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE: {
            const requester = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const target = findExplorerByPlayerId(core, command.payload.targetPlayerId ?? '');
            return [
                nowEvent(
                    EVENTS.SICKNESS_EXCHANGE_REQUESTED,
                    {
                        requesterPlayerId: requester.playerId,
                        targetPlayerId: target?.playerId ?? command.payload.targetPlayerId ?? '',
                        logText: `${requester.displayName}请求交换疾病标记`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE: {
            const pending = core.scenarioRuntime.dust?.pendingSicknessExchange;
            if (!pending) {
                return [];
            }
            const requester = findExplorerByPlayerId(core, pending.requesterPlayerId);
            const target = findExplorerByPlayerId(core, pending.targetPlayerId);
            const accepted = command.payload.accept;
            const swap =
                accepted && core.scenarioRuntime.dust
                    ? (resolveDustSicknessSwap(
                          core.scenarioRuntime.dust,
                          pending.requesterPlayerId,
                          pending.targetPlayerId,
                          random,
                      ) ?? undefined)
                    : undefined;
            return [
                nowEvent(
                    EVENTS.SICKNESS_EXCHANGE_RESOLVED,
                    {
                        requesterPlayerId: pending.requesterPlayerId,
                        targetPlayerId: pending.targetPlayerId,
                        accepted,
                        swap,
                        logText:
                            accepted && swap
                                ? `${target?.displayName ?? '目标玩家'}同意了${requester?.displayName ?? '请求者'}的疾病标记交换`
                                : `${target?.displayName ?? '目标玩家'}拒绝了疾病标记交换`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY: {
            const entryId = command.payload.entryId!;
            return [
                nowEvent(
                    EVENTS.HAUNT_SETUP_ENTRY_CONFIRMED,
                    {
                        playerId: command.playerId,
                        entryId,
                        logText:
                            entryId === 'monster-card-left-of-revealer'
                                ? '确认怪物参考卡已放在作祟揭秘者左侧。'
                                : '确认已准备 8 个研究 token，后续由寻找解药行动放置到对应房间。',
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.TAKE_PHOTO: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const target = findExplorerByPlayerId(core, command.payload.targetPlayerId ?? '');
            if (!target) {
                return [];
            }
            const trait = command.payload.trait ?? 'speed';
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'speed');
            const success = roll.total >= 6;
            return [
                nowEvent(
                    EVENTS.PHOTO_TAKEN,
                    {
                        playerId: actor.playerId,
                        targetPlayerId: target.playerId,
                        trait,
                        rollTotal: roll.total,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        success,
                        logText: success
                            ? `${actor.displayName}拍下${target.displayName}，夺取本质并提升${TRAIT_LABEL[trait]}`
                            : `${actor.displayName}尝试拍下${target.displayName}，但照片失焦了`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'sanity');
            const success = roll.total >= 6;
            return [
                nowEvent(
                    EVENTS.MAGIC_CAMERA_SMASHED,
                    {
                        playerId: actor.playerId,
                        rollTotal: roll.total,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        success,
                        logText: success
                            ? `${actor.displayName}砸毁了魔法相机`
                            : `${actor.displayName}尝试砸毁魔法相机，但没能成功`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK: {
            const monster = findPhantomPhotographer(core, command.payload.monsterId);
            const target = findExplorerByPlayerId(core, command.payload.targetPlayerId ?? '');
            if (!monster || !target) {
                return [];
            }
            const dice = rollBetrayalDicePips(random, monster.sanity ?? 6);
            const monsterRoll = dice.reduce((sum, pip) => sum + pip, 0);
            const heroRoll = rollTrait(random, target.traits.sanity);
            const damageToHero = Math.max(0, monsterRoll - heroRoll);
            const defeated = wouldExplorerDieFromMentalDamage(target, damageToHero);
            return [
                nowEvent(
                    EVENTS.PHANTOM_PHOTOGRAPHER_ATTACK_RESOLVED,
                    {
                        monsterId: monster.id,
                        targetPlayerId: target.playerId,
                        monsterRoll,
                        heroRoll,
                        damageToHero: damageToHero || undefined,
                        defeatedPlayerId: defeated ? target.playerId : undefined,
                        dice,
                        logText:
                            damageToHero > 0
                                ? `幻影摄影师用闪光攻击${target.displayName}，造成 ${damageToHero} 点精神伤害`
                                : `幻影摄影师拍向${target.displayName}，但没造成精神伤害`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const selection = resolveBloodFromStonePeekabooSelection(
                core,
                actor,
                command.payload.sameRoomMonsterId,
                command.payload.lineOfSightMonsterId,
            );
            if (!selection.option) {
                return [];
            }
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'knowledge');
            const mirrorBonus = hasBloodFromStoneMirror(actor) ? 2 : 0;
            const rollTotal = roll.total + mirrorBonus;
            const success = rollTotal >= 4;
            const damageDice = success ? undefined : rollBetrayalDicePips(random, 2);
            const damageAmount = damageDice?.reduce((sum, pip) => sum + pip, 0);
            return [
                nowEvent(
                    EVENTS.BLOOD_FROM_STONE_PEEKABOO_RESOLVED,
                    {
                        playerId: actor.playerId,
                        sameRoomMonsterId: selection.option.sameRoomMonsterId,
                        lineOfSightMonsterId: selection.option.lineOfSightMonsterId,
                        rollTotal,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        mirrorBonus,
                        success,
                        damageDice,
                        damageAmount,
                        logText: success
                            ? `${actor.displayName}玩躲猫猫成功，移除了两只石像小天使`
                            : `${actor.displayName}玩躲猫猫失败，承受 ${damageAmount ?? 0} 点一般伤害`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.GIVE_MIRROR_HINT: {
            const revealer = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            const eventCard = resolveUponReflectionHintEvent(core, command.payload.eventName);
            if (!target || !eventCard) {
                return [];
            }
            return [
                nowEvent(
                    EVENTS.UPON_REFLECTION_EVENT_HINT_GIVEN,
                    {
                        revealerPlayerId: revealer.playerId,
                        targetPlayerId: target.playerId,
                        eventName: eventCard.name,
                        eventText: eventCard.text,
                        turnNumber: core.turnNumber,
                        logText: `作祟揭秘者用事件牌「${eventCard.name}」给${target.displayName}作镜中提示；该事件不结算并放到一边`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const trait = command.payload.trait!;
            const selectedOmen = resolveUponReflectionOmenSelection(actor, command.payload);
            const secret = core.scenarioRuntime.uponReflection?.secretCombination;
            if (!selectedOmen || !secret) {
                return [];
            }
            const roomId = resolveControlledRoomId(core, actor);
            const room = core.rooms.find((item) => item.id === roomId);
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, trait);
            const successRoll = roll.total >= 5;
            const omenMatches =
                resolveInventoryEffectId(selectedOmen.id) === secret.omenId || selectedOmen.name === secret.omenName;
            const combinationCorrect = Boolean(
                successRoll && trait === secret.trait && omenMatches && roomMatchesUponReflectionSecret(room, secret),
            );
            return [
                nowEvent(
                    EVENTS.UPON_REFLECTION_CURSE_BREAK_ATTEMPTED,
                    {
                        playerId: actor.playerId,
                        roomId,
                        roomName: room?.name ?? '当前房间',
                        trait,
                        omenId: resolveInventoryEffectId(selectedOmen.id),
                        omenName: selectedOmen.name,
                        rollTotal: roll.total,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        successRoll,
                        combinationCorrect,
                        logText: combinationCorrect
                            ? `${actor.displayName}完成破咒，镜中诅咒被打破`
                            : successRoll
                              ? `${actor.displayName}尝试破咒，作祟揭秘者给出否定反馈`
                              : `${actor.displayName}尝试破咒，但没有得到镜中反馈`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK: {
            const actor = core.currentExplorer;
            const rollTotal = rollNonCombatTraitCheck(random, core, actor, 'knowledge');
            const grantedToExplorer =
                rollTotal >= 5
                    ? (getAllExplorers(core).find(
                          (explorer) =>
                              explorer.playerId !== core.scenarioRuntime.traitorPlayerId &&
                              !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId) &&
                              !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(explorer.playerId),
                      ) ?? actor)
                    : null;
            const grantedToPlayerId = grantedToExplorer?.playerId ?? null;
            return [
                nowEvent(
                    EVENTS.JACK_LEARNED,
                    {
                        playerId: command.playerId,
                        grantedToPlayerId,
                        rollTotal,
                        success: rollTotal >= 5,
                        logText:
                            rollTotal >= 5
                                ? `${actor.displayName}在图书馆查到了 Crimson Jack 的线索，交给${grantedToExplorer?.displayName ?? actor.displayName}`
                                : `${actor.displayName}翻遍了图书馆，但还没找到足够线索`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.STUDY_EXORCISM: {
            const actor = core.currentExplorer;
            const rollTotal = rollNonCombatTraitCheck(random, core, actor, 'knowledge');
            return [
                nowEvent(
                    EVENTS.EXORCISM_STUDIED,
                    {
                        playerId: command.playerId,
                        roomId: actor.roomId,
                        rollTotal,
                        success: rollTotal >= 5,
                        logText:
                            rollTotal >= 5
                                ? `${actor.displayName}布置了一处驱魔法阵`
                                : `${actor.displayName}研究驱魔失败，精神受到了反噬`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.EXORCISE_JACK: {
            const actor = core.currentExplorer;
            const regionBonus = countExorcismCirclesInRegion(core, actor.roomId);
            const sanityRoll = rollNonCombatTraitCheckWithDice(random, core, actor, 'sanity');
            const rollTotal = sanityRoll.total + regionBonus;
            return [
                nowEvent(
                    EVENTS.JACK_EXORCISED,
                    {
                        playerId: command.playerId,
                        roomId: actor.roomId,
                        rollTotal,
                        dice: sanityRoll.dice,
                        passiveBonus: sanityRoll.passiveBonus,
                        regionBonus,
                        success: rollTotal >= 7,
                        logText:
                            rollTotal >= 7
                                ? `${actor.displayName}成功驱散了杰克之灵`
                                : `${actor.displayName}尝试驱魔失败，杰克之灵反扑了所有英雄`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId);
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'knowledge');
            const success = roll.total >= 6;
            return [
                nowEvent(
                    EVENTS.MUMMY_NAME_STUDIED,
                    {
                        playerId: actor.playerId,
                        roomId: actor.roomId,
                        rollTotal: roll.total,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        success,
                        logText: success
                            ? `${actor.displayName}在${room?.name ?? '当前房间'}找到了木乃伊真名，取得第 1 枚知识标记`
                            : `${actor.displayName}寻找木乃伊真名失败，暂未取得知识标记`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'knowledge');
            const success = roll.total >= 6;
            return [
                nowEvent(
                    EVENTS.MUMMY_BANISHMENT_LEARNED,
                    {
                        playerId: actor.playerId,
                        roomId: actor.roomId,
                        rollTotal: roll.total,
                        dice: roll.dice,
                        passiveBonus: roll.passiveBonus,
                        success,
                        logText: success
                            ? `${actor.displayName}用书本学会驱逐木乃伊的法术，取得第 2 枚知识标记`
                            : `${actor.displayName}翻查书本失败，尚未学会驱逐法术`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.BANISH_MUMMY: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const mummy = findMummyMonster(core);
            if (!mummy) {
                return [];
            }
            const heroRoll = rollTraitCheckWithDice(random, actor, 'sanity', core);
            const mummyDice = rollBetrayalDicePips(random, resolveMonsterTrait(mummy, 'sanity'));
            const mummyRoll = mummyDice.reduce((sum, pip) => sum + pip, 0);
            const success = heroRoll.total > mummyRoll;
            return [
                nowEvent(
                    EVENTS.MUMMY_BANISHED,
                    {
                        playerId: actor.playerId,
                        roomId: actor.roomId,
                        heroRoll: heroRoll.total,
                        mummyRoll,
                        heroDice: heroRoll.dice,
                        mummyDice,
                        passiveBonus: heroRoll.passiveBonus,
                        success,
                        logText: success
                            ? `${actor.displayName}以神志压过木乃伊，将木乃伊驱逐回亡者之国`
                            : `${actor.displayName}驱逐木乃伊失败，木乃伊仍在宅邸中`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId);
            return [
                nowEvent(
                    EVENTS.MUMMY_GIRL_PICKED_UP,
                    {
                        playerId: actor.playerId,
                        roomId: actor.roomId,
                        logText: `${actor.displayName}在${room?.name ?? '当前房间'}拾起了女孩`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const mummy = findMummyMonster(core);
            if (!mummy) {
                return [];
            }
            const room = core.rooms.find((item) => item.id === actor.roomId);
            return [
                nowEvent(
                    EVENTS.MUMMY_GIRL_GIVEN,
                    {
                        playerId: actor.playerId,
                        monsterId: mummy.id,
                        roomId: actor.roomId,
                        logText: `${actor.displayName}在${room?.name ?? '当前房间'}把女孩交给了木乃伊`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const mummy = findMummyMonster(core);
            const card = findMummyWeddingOmenCard(actor, command.payload.cardId);
            if (!mummy || !card) {
                return [];
            }
            const room = core.rooms.find((item) => item.id === actor.roomId);
            return [
                nowEvent(
                    EVENTS.MUMMY_OMEN_GIVEN,
                    {
                        playerId: actor.playerId,
                        monsterId: mummy.id,
                        roomId: actor.roomId,
                        cardId: card.id,
                        cardName: card.name,
                        logText: `${actor.displayName}在${room?.name ?? '当前房间'}把${card.name}交给了木乃伊`,
                    },
                    timestamp,
                ),
            ];
        }
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return [];
        default:
            return [];
    }
}
