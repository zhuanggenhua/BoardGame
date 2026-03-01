/**
 * 召唤师战争 - 状态归约器
 * 
 * 将事件应用到游戏状态
 */

import type { GameEvent } from '../../../engine/types';
import { FLOW_EVENTS } from '../../../engine';
import type {
  SummonerWarsCore,
  PlayerId,
  GamePhase,
  UnitCard,
  EventCard,
  StructureCard,
  CellCoord,
  BoardCell,
  FactionId,
} from './types';
import { SW_EVENTS, SW_SELECTION_EVENTS } from './types';
import { BOARD_ROWS, BOARD_COLS, HAND_SIZE, clampMagic } from './helpers';
import {
  drawFromTop,
  removeFromHand,
  removeFromDiscard,
  discardFromHand,
} from '../../../engine/primitives';
import { createDeckByFactionId } from '../config/factions';
import { buildGameDeckFromCustom } from '../config/deckBuilder';
import { buildUsageKey } from './utils';
import { getBaseCardId, CARD_IDS } from './ids';

// ============================================================================
// 状态归约
// ============================================================================

/**
 * 应用事件到状态
 */
export function reduceEvent(core: SummonerWarsCore, event: GameEvent): SummonerWarsCore {
  const payload = event.payload as Record<string, unknown>;
  
  switch (event.type) {
    case 'sw:unit_selected': {
      return { ...core, selectedUnit: payload.position as CellCoord };
    }

    case SW_EVENTS.UNIT_SUMMONED: {
      const { playerId, cardId, position, card, fromDiscard, instanceId: payloadInstanceId } = payload as {
        playerId: PlayerId; cardId: string; position: CellCoord; card: UnitCard; fromDiscard?: boolean; instanceId?: string;
      };
      // 优先使用 payload 中的 instanceId（例如回放/兼容链路），否则基于当前棋盘分配下一个可用序号。
      const instanceId = payloadInstanceId || allocateNextInstanceId(core, cardId);
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      newBoard[position.row][position.col].unit = {
        instanceId, cardId, card, owner: playerId, position, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
      };
      const player = core.players[playerId];
      if (fromDiscard) {
        const { discard: newDiscard } = removeFromDiscard(player.discard, cardId);
        return { ...core, board: newBoard, players: { ...core.players, [playerId]: { ...player, discard: newDiscard } } };
      } else {
        const { hand: newHand } = removeFromHand(player.hand, cardId);
        return { ...core, board: newBoard, players: { ...core.players, [playerId]: { ...player, hand: newHand } } };
      }
    }

    case SW_EVENTS.STRUCTURE_BUILT: {
      const { playerId, cardId, position, card } = payload as {
        playerId: PlayerId; cardId: string; position: CellCoord; card: StructureCard;
      };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      newBoard[position.row][position.col].structure = {
        cardId, card, owner: playerId, position, damage: 0,
      };
      const player = core.players[playerId];
      const { hand: newHand } = removeFromHand(player.hand, cardId);
      return { ...core, board: newBoard, players: { ...core.players, [playerId]: { ...player, hand: newHand } } };
    }

    case SW_EVENTS.CARD_DRAWN: {
      const { playerId, count } = payload as { playerId: PlayerId; count: number };
      const player = core.players[playerId];
      const { drawn, remaining } = drawFromTop(player.deck, count);
      return {
        ...core,
        players: { ...core.players, [playerId]: { ...player, hand: [...player.hand, ...drawn], deck: remaining } },
      };
    }

    case SW_EVENTS.CARD_DISCARDED: {
      const { playerId, cardId } = payload as { playerId: PlayerId; cardId: string };
      const player = core.players[playerId];
      const result = discardFromHand(player.hand, player.discard, cardId);
      if (!result.found) return core;
      return {
        ...core,
        players: { ...core.players, [playerId]: { ...player, hand: result.from, discard: result.to } },
      };
    }

    case SW_EVENTS.EVENT_PLAYED: {
      const { playerId, cardId, card, isActive, isAttachment, isStructureEvent } = payload as {
        playerId: PlayerId; cardId: string; card: EventCard; isActive: boolean; isAttachment?: boolean; isStructureEvent?: boolean;
      };
      const player = core.players[playerId];
      const { hand: newHand } = removeFromHand(player.hand, cardId);
      
      // 建筑类事件卡：从手牌移除，但不进入 activeEvents 或 discard（已经变成建筑了）
      if (isStructureEvent) {
        return { ...core, players: { ...core.players, [playerId]: { ...player, hand: newHand } } };
      }
      
      if (isAttachment) {
        return { ...core, players: { ...core.players, [playerId]: { ...player, hand: newHand } } };
      } else if (isActive) {
        return { ...core, players: { ...core.players, [playerId]: { ...player, hand: newHand, activeEvents: [...player.activeEvents, card] } } };
      } else {
        return { ...core, players: { ...core.players, [playerId]: { ...player, hand: newHand, discard: [...player.discard, card] } } };
      }
    }

    case SW_EVENTS.ACTIVE_EVENT_DISCARDED: {
      const { playerId, cardId } = payload as { playerId: PlayerId; cardId: string };
      const player = core.players[playerId];
      const card = player.activeEvents.find(c => c.id === cardId);
      if (!card) return core;
      return {
        ...core,
        players: {
          ...core.players,
          [playerId]: {
            ...player,
            activeEvents: player.activeEvents.filter(c => c.id !== cardId),
            discard: [...player.discard, card],
          },
        },
      };
    }

    case SW_EVENTS.UNIT_MOVED: {
      const { from, to } = payload as { from: CellCoord; to: CellCoord; path?: CellCoord[] };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const unit = newBoard[from.row][from.col].unit;
      if (!unit) return { ...core, board: newBoard };
      newBoard[from.row][from.col].unit = undefined;
      newBoard[to.row][to.col].unit = { ...unit, position: to, hasMoved: true };
      const pid = unit.owner as PlayerId;
      return {
        ...core, board: newBoard, selectedUnit: undefined,
        players: { ...core.players, [pid]: { ...core.players[pid], moveCount: core.players[pid].moveCount + 1 } },
      };
    }

    // 消耗移动次数但不移动单位（技能代替移动，如预备）
    case SW_EVENTS.MOVE_ACTION_CONSUMED: {
      const { position } = payload as { position: CellCoord };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const unit = newBoard[position.row]?.[position.col]?.unit;
      if (!unit) return { ...core, board: newBoard };
      newBoard[position.row][position.col].unit = { ...unit, hasMoved: true };
      const pid = unit.owner as PlayerId;
      return {
        ...core, board: newBoard,
        players: { ...core.players, [pid]: { ...core.players[pid], moveCount: core.players[pid].moveCount + 1 } },
      };
    }

    // 消耗攻击次数（技能代替攻击，如高阶念力）
    case SW_EVENTS.ATTACK_ACTION_CONSUMED: {
      const { position: aacPos } = payload as { position: CellCoord };
      const aacBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const aacUnit = aacBoard[aacPos.row]?.[aacPos.col]?.unit;
      if (!aacUnit) return { ...core, board: aacBoard };
      aacBoard[aacPos.row][aacPos.col].unit = { ...aacUnit, hasAttacked: true };
      const aacPid = aacUnit.owner as PlayerId;
      return {
        ...core, board: aacBoard,
        players: { ...core.players, [aacPid]: { ...core.players[aacPid], attackCount: core.players[aacPid].attackCount + 1 } },
      };
    }

    case SW_EVENTS.UNIT_ATTACKED: {
      const { attacker, target } = payload as { attacker: CellCoord; target: CellCoord };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const unit = newBoard[attacker.row][attacker.col].unit;
      // 判断是否为额外攻击（extraAttacks > 0 时消耗一次，不增加 attackCount）
      const isExtraAttack = (unit?.extraAttacks ?? 0) > 0;
      if (unit) {
        newBoard[attacker.row][attacker.col].unit = {
          ...unit,
          hasAttacked: true,
          healingMode: false,
          extraAttacks: isExtraAttack ? (unit.extraAttacks ?? 1) - 1 : unit.extraAttacks,
        };
      }
      const pid = unit?.owner as PlayerId;
      if (!pid) return { ...core, board: newBoard };
      let hasAttackedEnemy = false;
      const targetCell = core.board[target.row]?.[target.col];
      if (targetCell?.unit && targetCell.unit.owner !== pid) {
        hasAttackedEnemy = true;
      } else if (targetCell?.structure && targetCell.structure.owner !== pid) {
        hasAttackedEnemy = true;
      }
      return {
        ...core, board: newBoard,
        players: {
          ...core.players,
          [pid]: {
            ...core.players[pid],
            // 额外攻击不计入3次攻击限制
            attackCount: isExtraAttack ? core.players[pid].attackCount : core.players[pid].attackCount + 1,
            hasAttackedEnemy: core.players[pid].hasAttackedEnemy || hasAttackedEnemy,
          },
        },
      };
    }

    case SW_EVENTS.UNIT_DAMAGED: {
      const { position, damage } = payload as { position: CellCoord; damage: number };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const cell = newBoard[position.row]?.[position.col];
      if (!cell) return core;
      
      if (cell.unit) {
        const newDamage = cell.unit.damage + damage;
        cell.unit = { ...cell.unit, damage: newDamage, wasAttackedThisTurn: true };
      } else if (cell.structure) {
        const newDamage = cell.structure.damage + damage;
        cell.structure = { ...cell.structure, damage: newDamage };
      } else {
        return core;
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.MAGIC_CHANGED: {
      const { playerId, delta } = payload as { playerId: PlayerId; delta: number };
      return {
        ...core,
        players: {
          ...core.players,
          [playerId]: { ...core.players[playerId], magic: clampMagic(core.players[playerId].magic + delta) },
        },
      };
    }

    case SW_EVENTS.PHASE_CHANGED:
    case FLOW_EVENTS.PHASE_CHANGED: {
      const { to } = payload as { to: GamePhase };
      return { ...core, phase: to, selectedUnit: undefined, attackTargetMode: undefined };
    }

    case SW_EVENTS.TURN_CHANGED: {
      const { to } = payload as { to: PlayerId };
      const newBoard = core.board.map(row => row.map(cell => {
        const newCell = { ...cell };
        if (newCell.unit) {
          // 回合切换：重置移动/攻击状态，清除临时技能（幻化）和额外攻击
          const { tempAbilities: _removed, originalOwner: origOwner, extraAttacks: _ea, ...unitWithoutTemp } = newCell.unit;
          // 心灵操控：归还临时控制的单位
          if (origOwner) {
            newCell.unit = { ...unitWithoutTemp, owner: origOwner, hasMoved: false, hasAttacked: false, wasAttackedThisTurn: false };
          } else {
            newCell.unit = { ...unitWithoutTemp, hasMoved: false, hasAttacked: false, wasAttackedThisTurn: false };
          }
        }
        return newCell;
      }));
      return {
        ...core, board: newBoard, currentPlayer: to, phase: 'summon',
        turnNumber: core.turnNumber + (to === '0' ? 1 : 0),
        players: {
          ...core.players,
          [to]: { ...core.players[to], moveCount: 0, attackCount: 0, hasAttackedEnemy: false },
        },
        // 清空技能使用次数追踪
        abilityUsageCount: {},
        // 清空单位本回合击杀计数
        unitKillCountThisTurn: {},
      };
    }

    // ========== 技能系统事件 ==========

    case SW_EVENTS.UNIT_DESTROYED: {
      const { position, owner: destroyedOwner, reason, killerPlayerId, killerUnitId, skipMagicReward } = payload as {
        position: CellCoord;
        cardId: string;
        cardName: string;
        owner: PlayerId;
        reason?: string;
        killerPlayerId?: PlayerId;
        killerUnitId?: string;
        skipMagicReward?: boolean;
      };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      let cell = newBoard[position.row]?.[position.col];
      let foundUnit = cell?.unit;

      if (!foundUnit) {
        // 优先用 instanceId 查找（唯一匹配），fallback 用 cardId
        const instanceId = (payload as { instanceId?: string }).instanceId;
        for (let row = 0; row < newBoard.length; row++) {
          for (let col = 0; col < newBoard[row].length; col++) {
            const unit = newBoard[row]?.[col]?.unit;
            if (unit && (instanceId ? unit.instanceId === instanceId : unit.cardId === (payload as { cardId: string }).cardId)) {
              foundUnit = unit;
              cell = newBoard[row][col];
              break;
            }
          }
          if (foundUnit) break;
        }
      }

      if (foundUnit && cell) {
        const destroyedCard = foundUnit.card;
        const attachedUnitCards = (foundUnit.attachedUnits ?? []).map(au => au.card);
        // 附加的事件卡（如狱火铸剑）也需要弃置（规则：被摧毁卡牌下的卡牌会被弃置）
        const attachedEventCards = foundUnit.attachedCards ?? [];
        const actualOwner = destroyedOwner ?? foundUnit.owner;
        const ownerPlayer = core.players[actualOwner as PlayerId];
        const rewardPlayerId = killerPlayerId && killerPlayerId !== actualOwner && !skipMagicReward
          ? killerPlayerId
          : undefined;
        const nextKillCountThisTurn = (killerUnitId && killerUnitId !== foundUnit.instanceId)
          ? {
            ...(core.unitKillCountThisTurn ?? {}),
            [killerUnitId]: ((core.unitKillCountThisTurn ?? {})[killerUnitId] ?? 0) + 1,
          }
          : core.unitKillCountThisTurn;

        // 不屈不挠检查：友方士兵被消灭时返回手牌（非自毁原因）
        const hasRelentless = ownerPlayer.activeEvents.some(ev => {
          return getBaseCardId(ev.id) === CARD_IDS.GOBLIN_RELENTLESS;
        });
        const isCommon = destroyedCard.unitClass === 'common';
        const isSelfDestruct = reason === 'feed_beast' || reason === 'feed_beast_self' || reason === 'magic_addiction';

        cell.unit = undefined;

        // 圣洁审判：友方单位被消灭时移除1充能
        let updatedActiveEvents = ownerPlayer.activeEvents;
        const holyJudgmentIdx = updatedActiveEvents.findIndex(ev => {
          return getBaseCardId(ev.id) === CARD_IDS.PALADIN_HOLY_JUDGMENT && (ev.charges ?? 0) > 0;
        });
        if (holyJudgmentIdx >= 0) {
          updatedActiveEvents = updatedActiveEvents.map((ev, i) => {
            if (i === holyJudgmentIdx) {
              const newCharges = Math.max(0, (ev.charges ?? 0) - 1);
              return { ...ev, charges: newCharges };
            }
            return ev;
          });
          // 充能归零时自动弃置
          const hjEvent = updatedActiveEvents[holyJudgmentIdx];
          if ((hjEvent.charges ?? 0) <= 0) {
            const discardedEvent = updatedActiveEvents[holyJudgmentIdx];
            updatedActiveEvents = updatedActiveEvents.filter((_, i) => i !== holyJudgmentIdx);
            const ownerWithUpdatedEvents = {
              ...ownerPlayer,
              activeEvents: updatedActiveEvents,
              discard: [...ownerPlayer.discard, discardedEvent],
            };
            if (hasRelentless && isCommon && !isSelfDestruct) {
              return {
                ...core,
                board: newBoard,
                unitKillCountThisTurn: nextKillCountThisTurn,
                players: {
                  ...core.players,
                  [actualOwner]: { ...ownerWithUpdatedEvents, hand: [...ownerWithUpdatedEvents.hand, destroyedCard], discard: [...ownerWithUpdatedEvents.discard, ...attachedUnitCards, ...attachedEventCards] },
                  ...(rewardPlayerId
                    ? {
                      [rewardPlayerId]: {
                        ...core.players[rewardPlayerId],
                        magic: clampMagic(core.players[rewardPlayerId].magic + 1),
                      },
                    }
                    : {}),
                },
              };
            }
            return {
              ...core,
              board: newBoard,
              unitKillCountThisTurn: nextKillCountThisTurn,
              players: {
                ...core.players,
                [actualOwner]: { ...ownerWithUpdatedEvents, discard: [...ownerWithUpdatedEvents.discard, destroyedCard, ...attachedUnitCards, ...attachedEventCards] },
                ...(rewardPlayerId
                  ? {
                    [rewardPlayerId]: {
                      ...core.players[rewardPlayerId],
                      magic: clampMagic(core.players[rewardPlayerId].magic + 1),
                    },
                  }
                  : {}),
              },
            };
          }
        }

        const ownerWithEvents = { ...ownerPlayer, activeEvents: updatedActiveEvents };

        if (hasRelentless && isCommon && !isSelfDestruct) {
          // 返回手牌而非弃牌堆
          return {
            ...core,
            board: newBoard,
            unitKillCountThisTurn: nextKillCountThisTurn,
            players: {
              ...core.players,
              [actualOwner]: { ...ownerWithEvents, hand: [...ownerWithEvents.hand, destroyedCard], discard: [...ownerWithEvents.discard, ...attachedUnitCards, ...attachedEventCards] },
              ...(rewardPlayerId
                ? {
                  [rewardPlayerId]: {
                    ...core.players[rewardPlayerId],
                    magic: clampMagic(core.players[rewardPlayerId].magic + 1),
                  },
                }
                : {}),
            },
          };
        }
        return {
          ...core,
          board: newBoard,
          unitKillCountThisTurn: nextKillCountThisTurn,
          players: {
            ...core.players,
            [actualOwner]: { ...ownerWithEvents, discard: [...ownerWithEvents.discard, destroyedCard, ...attachedUnitCards, ...attachedEventCards] },
            ...(rewardPlayerId
              ? {
                [rewardPlayerId]: {
                  ...core.players[rewardPlayerId],
                  magic: clampMagic(core.players[rewardPlayerId].magic + 1),
                },
              }
              : {}),
          },
        };
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.STRUCTURE_DESTROYED: {
      const { position, owner, killerPlayerId, skipMagicReward } = payload as {
        position: CellCoord; cardId: string; owner: PlayerId; killerPlayerId?: PlayerId; skipMagicReward?: boolean;
      };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const cell = newBoard[position.row]?.[position.col];
      if (!cell?.structure) return { ...core, board: newBoard };
      const destroyedCard = cell.structure.card;
      const actualOwner = owner ?? cell.structure.owner;
      const ownerPlayer = core.players[actualOwner as PlayerId];
      cell.structure = undefined;
      const rewardPlayerId = killerPlayerId && killerPlayerId !== actualOwner && !skipMagicReward
        ? killerPlayerId
        : undefined;
      return {
        ...core,
        board: newBoard,
        players: {
          ...core.players,
          [actualOwner]: { ...ownerPlayer, discard: [...ownerPlayer.discard, destroyedCard] },
          ...(rewardPlayerId
            ? {
              [rewardPlayerId]: {
                ...core.players[rewardPlayerId],
                magic: clampMagic(core.players[rewardPlayerId].magic + 1),
              },
            }
            : {}),
        },
      };
    }

    case SW_EVENTS.UNIT_HEALED: {
      const { position, amount } = payload as { position: CellCoord; amount: number };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const cell = newBoard[position.row][position.col];
      if (cell.unit) {
        cell.unit = { ...cell.unit, damage: Math.max(0, cell.unit.damage - amount) };
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.STRUCTURE_HEALED: {
      const { position: shPos, amount: shAmount } = payload as { position: CellCoord; amount: number };
      const shBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const shCell = shBoard[shPos.row]?.[shPos.col];
      if (shCell?.structure) {
        shCell.structure = { ...shCell.structure, damage: Math.max(0, shCell.structure.damage - shAmount) };
      }
      return { ...core, board: shBoard };
    }

    case SW_EVENTS.UNIT_CHARGED: {
      const { position, delta, newValue } = payload as { position: CellCoord; delta: number; newValue?: number };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const cell = newBoard[position.row][position.col];
      if (cell.unit) {
        const currentBoosts = cell.unit.boosts ?? 0;
        const finalValue = newValue !== undefined ? newValue : Math.max(0, currentBoosts + delta);
        cell.unit = { ...cell.unit, boosts: finalValue };
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.CARD_RETRIEVED: {
      // 从弃牌堆拿回手牌
      const { playerId: crPlayerId, cardId: crCardId } = payload as { playerId: PlayerId; cardId: string };
      const crPlayer = core.players[crPlayerId];
      const crCard = crPlayer.discard.find(c => c.id === crCardId);
      if (!crCard) return core;
      const { discard: crNewDiscard } = removeFromDiscard(crPlayer.discard, crCardId);
      return {
        ...core,
        players: {
          ...core.players,
          [crPlayerId]: { ...crPlayer, hand: [...crPlayer.hand, crCard], discard: crNewDiscard },
        },
      };
    }

    case SW_EVENTS.HEALING_MODE_SET: {
      // 治疗模式：标记单位下次攻击为治疗
      const { position: hmPos } = payload as { position: CellCoord };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const hmUnit = newBoard[hmPos.row]?.[hmPos.col]?.unit;
      if (hmUnit) {
        newBoard[hmPos.row][hmPos.col].unit = { ...hmUnit, healingMode: true };
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.ABILITY_TRIGGERED: {
      // 记录技能使用次数（用于限制每回合使用次数）
      const abilityPayload = event.payload as {
        abilityId?: string; sourceUnitId?: string;
        sourcePosition?: CellCoord;
        grantedAbility?: string; targetUnitId?: string;
        skipUsageCount?: boolean;
      };

      let updatedCore = core;

      // 力量颂歌等：将 grantedAbility 写入目标单位的 tempAbilities（targetUnitId 为 instanceId）
      if (abilityPayload.grantedAbility && abilityPayload.targetUnitId) {
        const newBoard = updatedCore.board.map(row => row.map(cell => {
          if (cell.unit && cell.unit.instanceId === abilityPayload.targetUnitId) {
            const existing = cell.unit.tempAbilities ?? [];
            if (!existing.includes(abilityPayload.grantedAbility!)) {
              return { ...cell, unit: { ...cell.unit, tempAbilities: [...existing, abilityPayload.grantedAbility!] } };
            }
          }
          return cell;
        }));
        updatedCore = { ...updatedCore, board: newBoard };
      }

      // 交缠颂歌：标记两个目标到主动事件卡
      if (abilityPayload.abilityId === 'chant_of_entanglement') {
        const entPayload = event.payload as {
          targetUnitId1?: string; targetUnitId2?: string;
          sourceUnitId?: string;
        };
        if (entPayload.targetUnitId1 && entPayload.targetUnitId2) {
          // 找到刚放入主动区域的交缠颂歌卡，写入 entanglementTargets
          const newPlayers = { ...updatedCore.players };
          for (const pid of ['0', '1'] as PlayerId[]) {
            const player = newPlayers[pid];
            const hasEntanglement = player.activeEvents.some(ev =>
              getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT && !ev.entanglementTargets
            );
            if (hasEntanglement) {
              newPlayers[pid] = {
                ...player,
                activeEvents: player.activeEvents.map(ev =>
                  getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT && !ev.entanglementTargets
                    ? { ...ev, entanglementTargets: [entPayload.targetUnitId1!, entPayload.targetUnitId2!] as [string, string] }
                    : ev
                ),
              };
              break;
            }
          }
          updatedCore = { ...updatedCore, players: newPlayers };
        }
      }

      if (abilityPayload.abilityId && abilityPayload.sourceUnitId && !abilityPayload.skipUsageCount) {
        const usageKey = buildUsageKey(abilityPayload.sourceUnitId, abilityPayload.abilityId);
        return {
          ...updatedCore,
          abilityUsageCount: {
            ...(updatedCore.abilityUsageCount ?? {}),
            [usageKey]: ((updatedCore.abilityUsageCount ?? {})[usageKey] ?? 0) + 1,
          },
        };
      }
      return updatedCore;
    }

    case SW_EVENTS.STRENGTH_MODIFIED:
    case SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED:
    case SW_EVENTS.SOUL_TRANSFER_REQUESTED:
    case SW_EVENTS.MIND_CAPTURE_REQUESTED:
    case SW_EVENTS.DAMAGE_REDUCED:
    case SW_EVENTS.GRAB_FOLLOW_REQUESTED: {
      // 通知事件，不修改状态（由 UI 消费）
      return core;
    }

    case SW_EVENTS.EXTRA_ATTACK_GRANTED: {
      // 额外攻击：重置目标单位的 hasAttacked 并增加 extraAttacks 计数
      const { targetPosition: eaPos, targetUnitId: _eaUnitId } = payload as { targetPosition: CellCoord; targetUnitId: string };
      const eaBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const eaUnit = eaBoard[eaPos.row]?.[eaPos.col]?.unit;
      if (eaUnit) {
        const oldExtraAttacks = eaUnit.extraAttacks ?? 0;
        const newExtraAttacks = oldExtraAttacks + 1;
        eaBoard[eaPos.row][eaPos.col].unit = {
          ...eaUnit,
          hasAttacked: false,
          extraAttacks: newExtraAttacks,
        };
      } else {
        // 单位不存在，忽略
      }
      return { ...core, board: eaBoard };
    }

    case SW_EVENTS.UNIT_ATTACHED: {
      // 冰霜战斧：将源单位从棋盘移除，附加到目标单位
      const { sourcePosition: uaSource, targetPosition: uaTarget, sourceUnitId: uaSourceId, sourceCard: uaCard, sourceOwner: uaOwner } = payload as {
        sourcePosition: CellCoord; targetPosition: CellCoord;
        sourceUnitId: string; sourceCard: UnitCard; sourceOwner: PlayerId;
      };
      const uaBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const uaSourceCell = uaBoard[uaSource.row]?.[uaSource.col];
      const uaTargetCell = uaBoard[uaTarget.row]?.[uaTarget.col];
      if (uaSourceCell?.unit && uaTargetCell?.unit) {
        uaSourceCell.unit = undefined;
        uaTargetCell.unit = {
          ...uaTargetCell.unit,
          attachedUnits: [...(uaTargetCell.unit.attachedUnits ?? []), { cardId: uaSourceId, card: uaCard, owner: uaOwner }],
        };
      }
      return { ...core, board: uaBoard };
    }

    case SW_EVENTS.ABILITIES_COPIED: {
      // 幻化：将目标技能复制到源单位的 tempAbilities（sourceUnitId 为 instanceId）
      const { sourceUnitId: copySourceId, copiedAbilities: copied } = payload as {
        sourceUnitId: string; copiedAbilities: string[];
      };
      const newBoard = core.board.map(row => row.map(cell => {
        if (cell.unit && cell.unit.instanceId === copySourceId) {
          return { ...cell, unit: { ...cell.unit, tempAbilities: copied } };
        }
        return cell;
      }));
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.HYPNOTIC_LURE_MARKED: {
      // 催眠引诱：在主动事件区的催眠引诱卡上标记目标单位 ID
      const { playerId: lurePlayerId, cardId: lureCardId, targetUnitId } = payload as {
        playerId: PlayerId; cardId: string; targetUnitId: string;
      };
      const lurePlayer = core.players[lurePlayerId];
      const newActiveEvents = lurePlayer.activeEvents.map(ev =>
        ev.id === lureCardId ? { ...ev, targetUnitId } : ev
      );
      return {
        ...core,
        players: { ...core.players, [lurePlayerId]: { ...lurePlayer, activeEvents: newActiveEvents } },
      };
    }

    case SW_EVENTS.UNITS_SWAPPED: {
      // 位置交换（神出鬼没）
      const { positionA, positionB } = payload as {
        positionA: CellCoord; positionB: CellCoord;
      };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const unitA = newBoard[positionA.row]?.[positionA.col]?.unit;
      const unitB = newBoard[positionB.row]?.[positionB.col]?.unit;
      if (unitA && unitB) {
        newBoard[positionA.row][positionA.col].unit = { ...unitB, position: positionA };
        newBoard[positionB.row][positionB.col].unit = { ...unitA, position: positionB };
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.UNIT_PUSHED:
    case SW_EVENTS.UNIT_PULLED: {
      // 推拉：移动目标单位或建筑到新位置
      const { targetPosition, newPosition, isStructure: isStructurePush } = payload as {
        targetPosition: CellCoord;
        newPosition?: CellCoord;
        isStructure?: boolean;
      };
      // newPosition 由 execute 层计算后附加到 payload
      // 如果没有 newPosition，说明推拉被阻挡，不移动
      if (!newPosition) return core;

      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const sourceCell = newBoard[targetPosition.row]?.[targetPosition.col];
      const destCell = newBoard[newPosition.row]?.[newPosition.col];

      if (isStructurePush && sourceCell?.structure && destCell && !destCell.structure && !destCell.unit) {
        // 建筑推拉
        destCell.structure = { ...sourceCell.structure, position: newPosition };
        sourceCell.structure = undefined;
      } else if (sourceCell?.unit && destCell && !destCell.unit) {
        destCell.unit = { ...sourceCell.unit, position: newPosition };
        sourceCell.unit = undefined;
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.CONTROL_TRANSFERRED: {
      // 控制权转移：改变单位的 owner，保存原始拥有者（临时控制用）
      const { targetPosition, newOwner, temporary, originalOwner: origOwner } = payload as {
        targetPosition: CellCoord;
        newOwner: PlayerId;
        temporary?: boolean;
        originalOwner?: PlayerId;
      };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const cell = newBoard[targetPosition.row]?.[targetPosition.col];
      if (cell?.unit) {
        cell.unit = {
          ...cell.unit,
          owner: newOwner,
          // 临时控制时保存原始拥有者，回合结束归还
          ...(temporary && origOwner ? { originalOwner: origOwner } : {}),
        };
      }
      return { ...core, board: newBoard };
    }

    case SW_EVENTS.FUNERAL_PYRE_CHARGED: {
      const { playerId: fpPlayerId, cardId: fpCardId, eventCardId: fpEventCardId, charges: fpAbsoluteCharges } = payload as {
        playerId: PlayerId; cardId?: string; eventCardId?: string; charges?: number;
      };
      const fpPlayer = core.players[fpPlayerId];
      const targetId = fpEventCardId ?? fpCardId;
      const newActiveEvents: EventCard[] = [];
      let newDiscard = fpPlayer.discard;

      for (const ev of fpPlayer.activeEvents) {
        if (ev.id !== targetId) {
          newActiveEvents.push(ev);
          continue;
        }

        // 如果提供了绝对充能值则直接设置，否则+1
        const newCharges = fpAbsoluteCharges !== undefined ? fpAbsoluteCharges : (ev.charges ?? 0) + 1;
        if (getBaseCardId(ev.id) === CARD_IDS.PALADIN_HOLY_JUDGMENT && newCharges <= 0) {
          newDiscard = [...newDiscard, { ...ev, charges: newCharges }];
          continue;
        }

        newActiveEvents.push({ ...ev, charges: newCharges });
      }

      return {
        ...core,
        players: {
          ...core.players,
          [fpPlayerId]: { ...fpPlayer, activeEvents: newActiveEvents, discard: newDiscard },
        },
      };
    }

    case SW_EVENTS.EVENT_ATTACHED: {
      const { card: attachedCard, targetPosition } = payload as {
        playerId: PlayerId; cardId: string; card: EventCard; targetPosition: CellCoord;
      };
      const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
      const targetCell = newBoard[targetPosition.row]?.[targetPosition.col];
      if (targetCell?.unit) {
        targetCell.unit = {
          ...targetCell.unit,
          attachedCards: [...(targetCell.unit.attachedCards ?? []), attachedCard],
        };
      }
      return { ...core, board: newBoard };
    }

    // ========== 阵营选择事件 ==========

    case SW_SELECTION_EVENTS.FACTION_SELECTED: {
      const { playerId: pid, factionId, customDeckData } = payload as {
        playerId: PlayerId; factionId: FactionId;
        customDeckData?: import('./types').SerializedCustomDeck;
      };
      let newCore = { ...core, selectedFactions: { ...core.selectedFactions, [pid]: factionId } };
      if (customDeckData) {
        // 存储自定义牌组数据，供 HOST_START_GAME 时使用
        newCore = {
          ...newCore,
          customDeckData: { ...(newCore.customDeckData ?? {}), [pid]: customDeckData },
        };
      } else {
        // 选择预构筑阵营时，清除该玩家的自定义牌组数据
        if (newCore.customDeckData?.[pid]) {
          const { [pid]: _, ...rest } = newCore.customDeckData;
          newCore = { ...newCore, customDeckData: Object.keys(rest).length > 0 ? rest : undefined };
        }
      }
      return newCore;
    }

    case SW_SELECTION_EVENTS.PLAYER_READY: {
      const { playerId: pid } = payload as { playerId: PlayerId };
      return { ...core, readyPlayers: { ...core.readyPlayers, [pid]: true } };
    }

    case SW_SELECTION_EVENTS.HOST_STARTED: {
      return { ...core, hostStarted: true };
    }

    case SW_SELECTION_EVENTS.SELECTION_COMPLETE: {
      // 选角完成后初始化棋盘和牌组
      // 洗牌由 execute 层使用确定性随机完成，reduce 只做状态写入
      const { factions, shuffledDecks } = payload as {
        factions: Record<PlayerId, FactionId>;
        shuffledDecks: Record<PlayerId, (UnitCard | EventCard | StructureCard)[]>;
      };
      return initializeBoardFromFactions(core, factions, shuffledDecks);
    }

    default:
      return core;
  }
}

// ============================================================================
// 棋盘初始化（选角完成后）
// ============================================================================

const INSTANCE_ID_SUFFIX_RE = /#(\d+)$/;

function collectUsedInstanceIds(core: SummonerWarsCore): Set<string> {
  const usedIds = new Set<string>();
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const instanceId = core.board[row]?.[col]?.unit?.instanceId;
      if (instanceId) {
        usedIds.add(instanceId);
      }
    }
  }
  return usedIds;
}

function allocateNextInstanceId(core: SummonerWarsCore, cardId: string): string {
  const usedIds = collectUsedInstanceIds(core);
  let nextSeq = 1;

  for (const id of usedIds) {
    const matched = id.match(INSTANCE_ID_SUFFIX_RE);
    if (!matched) continue;
    const seq = Number(matched[1]);
    if (Number.isFinite(seq) && seq >= nextSeq) {
      nextSeq = seq + 1;
    }
  }

  let candidate = `${cardId}#${nextSeq}`;
  while (usedIds.has(candidate)) {
    nextSeq += 1;
    candidate = `${cardId}#${nextSeq}`;
  }
  return candidate;
}

function initializeBoardFromFactions(
  core: SummonerWarsCore,
  factions: Record<PlayerId, FactionId>,
  shuffledDecks: Record<PlayerId, (UnitCard | EventCard | StructureCard)[]>
): SummonerWarsCore {
  const newBoard: BoardCell[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({}))
  );
  const newPlayers = { ...core.players };
  let nextSeq = 0;
  const allocateInitInstanceId = (cardId: string): string => {
    nextSeq += 1;
    return `${cardId}#${nextSeq}`;
  };

  for (const pid of ['0', '1'] as PlayerId[]) {
    const factionId = factions[pid];
    if (!factionId) continue;
    
    // 检测自定义牌组：优先使用自定义牌组数据获取棋盘布局
    const customDeckData = core.customDeckData?.[pid];
    const deckData = customDeckData
      ? buildGameDeckFromCustom(customDeckData)
      : createDeckByFactionId(factionId as FactionId);
    const isBottom = pid === '0';
    const player = { ...newPlayers[pid] };
    
    const toArrayCoord = (pos: { row: number; col: number }) => {
      if (isBottom) {
        return { row: BOARD_ROWS - 1 - pos.row, col: pos.col };
      } else {
        return { row: pos.row, col: BOARD_COLS - 1 - pos.col };
      }
    };
    
    // 召唤师
    const summonerCard: UnitCard = { ...deckData.summoner, id: `${deckData.summoner.id}-${pid}` };
    player.summonerId = summonerCard.id;
    const summonerPos = toArrayCoord(deckData.summonerPosition);
    newBoard[summonerPos.row][summonerPos.col].unit = {
      instanceId: allocateInitInstanceId(summonerCard.id),
      cardId: summonerCard.id, card: summonerCard, owner: pid,
      position: summonerPos, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
    };
    
    // 起始城门
    const gateCard: StructureCard = { ...deckData.startingGate, id: `${deckData.startingGate.id}-${pid}` };
    const gatePos = toArrayCoord(deckData.startingGatePosition);
    newBoard[gatePos.row][gatePos.col].structure = {
      cardId: gateCard.id, card: gateCard, owner: pid, position: gatePos, damage: 0,
    };
    
    // 起始单位
    for (const startUnit of deckData.startingUnits) {
      const unitCard: UnitCard = { ...startUnit.unit, id: `${startUnit.unit.id}-${pid}` };
      const unitPos = toArrayCoord(startUnit.position);
      newBoard[unitPos.row][unitPos.col].unit = {
        instanceId: allocateInitInstanceId(unitCard.id),
        cardId: unitCard.id, card: unitCard, owner: pid,
        position: unitPos, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false,
      };
    }
    
    // 使用 execute 层预洗好的牌序（确定性随机）
    const shuffled = shuffledDecks[pid] ?? [];
    player.hand = shuffled.slice(0, HAND_SIZE);
    player.deck = shuffled.slice(HAND_SIZE);
    
    newPlayers[pid] = player;
  }

  return { ...core, board: newBoard, players: newPlayers };
}
