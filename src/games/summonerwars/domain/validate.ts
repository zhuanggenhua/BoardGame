/**
 * 召唤师战争 - 命令验证器
 */

import type { ValidationResult } from '../../../engine/types';
import type { MatchState } from '../../../engine/types';
import type {
  SummonerWarsCore,
  PlayerId,
  FactionId,
  UnitCard,
  EventCard,
  StructureCard,
  CellCoord,
  BoardUnit,
} from './types';
import { SW_COMMANDS } from './types';
import {
  BOARD_ROWS,
  BOARD_COLS,
  MAX_MOVES_PER_TURN,
  MAX_ATTACKS_PER_TURN,
  getUnitAt,
  isAdjacent,
  isCellEmpty,
  canMoveToEnhanced,
  canAttackEnhanced,
  getValidSummonPositions,
  getValidBuildPositions,
  hasEnoughMagic,
  manhattanDistance,
  getSummoner,
  getUnitAbilities,
  findUnitPositionByInstanceId,
  isValidCoord,
} from './helpers';
import { getPhaseDisplayName } from './execute';
import { validateAbilityActivation } from './abilityValidation';
import { VALID_FACTION_IDS, getBaseCardId, CARD_IDS } from './ids';

// ============================================================================
// 命令验证
// ============================================================================

/**
 * 验证命令合法性
 */
export function validateCommand(
  state: MatchState<SummonerWarsCore>,
  command: { type: string; payload: unknown; playerId?: string }
): ValidationResult {
  const core = state.core;
  const playerId = core.currentPlayer;
  const payload = command.payload as Record<string, unknown>;

  switch (command.type) {
    case SW_COMMANDS.SELECT_FACTION: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始，无法更改阵营' };
      const factionId = payload.factionId as string;
      if (!VALID_FACTION_IDS.includes(factionId as FactionId)) return { valid: false, error: '无效的阵营 ID' };
      return { valid: true };
    }

    case SW_COMMANDS.SELECT_CUSTOM_DECK: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始，无法更改牌组' };
      const deckData = payload.deckData as Record<string, unknown> | undefined;
      if (!deckData) return { valid: false, error: '缺少牌组数据' };
      if (!deckData.summonerId || typeof deckData.summonerId !== 'string') return { valid: false, error: '缺少召唤师 ID' };
      if (!deckData.summonerFaction || typeof deckData.summonerFaction !== 'string') return { valid: false, error: '缺少召唤师阵营' };
      if (!Array.isArray(deckData.cards)) return { valid: false, error: '缺少卡牌列表' };
      return { valid: true };
    }

    case SW_COMMANDS.PLAYER_READY: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始' };
      const cmdPlayerId = command.playerId as PlayerId;
      const faction = core.selectedFactions[cmdPlayerId];
      if (!faction || faction === 'unselected') return { valid: false, error: '必须先选择阵营' };
      return { valid: true };
    }

    case SW_COMMANDS.HOST_START_GAME: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始' };
      const cmdPid = command.playerId as PlayerId;
      if (cmdPid !== core.hostPlayerId) return { valid: false, error: '只有房主可以开始游戏' };
      const hostFaction = core.selectedFactions[cmdPid];
      if (!hostFaction || hostFaction === 'unselected') return { valid: false, error: '房主必须先选择阵营' };
      const allReady = (['0', '1'] as PlayerId[]).every(pid =>
        pid === core.hostPlayerId || (core.selectedFactions[pid] !== 'unselected' && core.readyPlayers[pid])
      );
      if (!allReady) return { valid: false, error: '等待所有玩家准备' };
      return { valid: true };
    }

    case SW_COMMANDS.SUMMON_UNIT: {
      const cardId = payload.cardId as string;
      const position = payload.position as CellCoord;
      const player = core.players[playerId];
      // 重燃希望：允许在任意阶段召唤
      const hasRekindleHope = player.activeEvents.some(ev => {
        return getBaseCardId(ev.id) === CARD_IDS.PALADIN_REKINDLE_HOPE;
      });
      if (core.phase !== 'summon' && !hasRekindleHope) return { valid: false, error: '当前不是召唤阶段' };
      const card = player.hand.find(c => c.id === cardId);
      if (!card || card.cardType !== 'unit') return { valid: false, error: '无效的单位卡牌' };
      const unitCard = card as UnitCard;
      if (!hasEnoughMagic(core, playerId, unitCard.cost)) return { valid: false, error: '魔力不足' };
      // 重燃希望：额外允许召唤到召唤师相邻位置
      let validPositions = getValidSummonPositions(core, playerId);
      if (hasRekindleHope) {
        const summoner = getSummoner(core, playerId);
        if (summoner) {
          const dirs = [
            { row: -1, col: 0 }, { row: 1, col: 0 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
          ];
          for (const d of dirs) {
            const adjPos = { row: summoner.position.row + d.row, col: summoner.position.col + d.col };
            if (adjPos.row >= 0 && adjPos.row < BOARD_ROWS && adjPos.col >= 0 && adjPos.col < BOARD_COLS
              && isCellEmpty(core, adjPos)
              && !validPositions.some(p => p.row === adjPos.row && p.col === adjPos.col)) {
              validPositions = [...validPositions, adjPos];
            }
          }
        }
      }
      // 编织颂歌：允许在目标单位相邻位置召唤
      const chantOfWeaving = player.activeEvents.find(ev =>
        getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_WEAVING && ev.targetUnitId
      );
      if (chantOfWeaving) {
        const targetPos = findUnitPositionByInstanceId(core, chantOfWeaving.targetUnitId!);
        if (targetPos) {
          const dirs = [
            { row: -1, col: 0 }, { row: 1, col: 0 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
          ];
          for (const d of dirs) {
            const adjPos = { row: targetPos.row + d.row, col: targetPos.col + d.col };
            if (adjPos.row >= 0 && adjPos.row < BOARD_ROWS && adjPos.col >= 0 && adjPos.col < BOARD_COLS
              && isCellEmpty(core, adjPos)
              && !validPositions.some(p => p.row === adjPos.row && p.col === adjPos.col)) {
              validPositions = [...validPositions, adjPos];
            }
          }
        }
      }
      if (!validPositions.some(p => p.row === position.row && p.col === position.col)) {
        return { valid: false, error: '无效的召唤位置（必须在城门相邻的空格）' };
      }
      return { valid: true };
    }

    case SW_COMMANDS.BUILD_STRUCTURE: {
      const cardId = payload.cardId as string;
      const position = payload.position as CellCoord;
      if (core.phase !== 'build') return { valid: false, error: '当前不是建造阶段' };
      const player = core.players[playerId];
      const card = player.hand.find(c => c.id === cardId);
      if (!card || card.cardType !== 'structure') return { valid: false, error: '无效的建筑卡牌' };
      const structureCard = card as StructureCard;
      if (!hasEnoughMagic(core, playerId, structureCard.cost)) return { valid: false, error: '魔力不足' };
      const validPositions = getValidBuildPositions(core, playerId);
      if (!validPositions.some(p => p.row === position.row && p.col === position.col)) {
        return { valid: false, error: '无效的建造位置（必须在后3排或召唤师相邻的空格）' };
      }
      return { valid: true };
    }

    case SW_COMMANDS.MOVE_UNIT: {
      const from = payload.from as CellCoord;
      const to = payload.to as CellCoord;
      if (core.phase !== 'move') return { valid: false, error: '当前不是移动阶段' };
      if (core.players[playerId].moveCount >= MAX_MOVES_PER_TURN) return { valid: false, error: '本回合移动次数已用完' };
      const unit = getUnitAt(core, from);
      if (!unit || unit.owner !== playerId) return { valid: false, error: '无法移动该单位' };
      if (unit.hasMoved) return { valid: false, error: '该单位本回合已移动' };
      if ((getUnitAbilities(unit, core)).includes('immobile')) return { valid: false, error: '该单位不能移动（禁足）' };
      if (!canMoveToEnhanced(core, from, to)) return { valid: false, error: '无法移动到目标位置' };
      return { valid: true };
    }

    case SW_COMMANDS.DECLARE_ATTACK: {
      const attackerPos = payload.attacker as CellCoord;
      const targetPos = payload.target as CellCoord;
      if (core.phase !== 'attack') return { valid: false, error: '当前不是攻击阶段' };
      const attacker = getUnitAt(core, attackerPos);
      if (!attacker || attacker.owner !== playerId) return { valid: false, error: '无法使用该单位攻击' };
      if (attacker.hasAttacked) return { valid: false, error: '该单位本回合已攻击' };
      // 凶残单位或有额外攻击的单位不受3次攻击限制
      const hasFerocity = getUnitAbilities(attacker, core).includes('ferocity');
      const hasExtraAttacks = (attacker.extraAttacks ?? 0) > 0;
      if (core.players[playerId].attackCount >= MAX_ATTACKS_PER_TURN && !hasFerocity && !hasExtraAttacks) {
        return { valid: false, error: '本回合攻击次数已用完' };
      }
      const rawBeforeAttack = payload.beforeAttack as
        | { abilityId: string; targetUnitId?: string; targetCardId?: string; discardCardIds?: string[] }
        | Array<{ abilityId: string; targetUnitId?: string; targetCardId?: string; discardCardIds?: string[] }>
        | undefined;
      const beforeAttackList = rawBeforeAttack
        ? (Array.isArray(rawBeforeAttack) ? rawBeforeAttack : [rawBeforeAttack])
        : [];
      let hasHealingBeforeAttack = false;
      if (beforeAttackList.length > 0) {
        const attackerAbilities = getUnitAbilities(attacker, core);
        for (const beforeAttack of beforeAttackList) {
          if (!attackerAbilities.includes(beforeAttack.abilityId)) {
            return { valid: false, error: '该单位没有此技能' };
          }
          switch (beforeAttack.abilityId) {
            case 'life_drain': {
              if (!beforeAttack.targetUnitId) return { valid: false, error: '必须选择要消灭的友方单位' };
              let targetUnit: BoardUnit | undefined;
              let targetPos: CellCoord | undefined;
              // 优先用 instanceId 匹配，兼容旧的 cardId
              for (let row = 0; row < BOARD_ROWS; row++) {
                for (let col = 0; col < BOARD_COLS; col++) {
                  const unit = core.board[row]?.[col]?.unit;
                  if (unit && (unit.instanceId === beforeAttack.targetUnitId || unit.cardId === beforeAttack.targetUnitId)) {
                    targetUnit = unit;
                    targetPos = { row, col };
                    break;
                  }
                }
                if (targetUnit) break;
              }
              if (!targetUnit || !targetPos || targetUnit.owner !== playerId) {
                return { valid: false, error: '必须选择一个友方单位' };
              }
              const dist = Math.abs(attackerPos.row - targetPos.row) + Math.abs(attackerPos.col - targetPos.col);
              if (dist > 2) return { valid: false, error: '目标必须在2格以内' };
              break;
            }

            case 'holy_arrow': {
              const discardCardIds = beforeAttack.discardCardIds as string[] | undefined;
              // 圣光箭允许弃任意数量手牌（含 0）
              if (!discardCardIds || discardCardIds.length === 0) break;
              const haPlayer = core.players[playerId];
              const names = new Set<string>();
              for (const cardId of discardCardIds) {
                const card = haPlayer.hand.find(c => c.id === cardId);
                if (!card || card.cardType !== 'unit') return { valid: false, error: '只能弃除单位卡' };
                const unitCard = card as UnitCard;
                if (unitCard.name === attacker.card.name) return { valid: false, error: '不能弃除同名单位' };
                if (names.has(unitCard.name)) return { valid: false, error: '不能弃除多张同名单位' };
                names.add(unitCard.name);
              }
              break;
            }

            case 'healing': {
              const healDiscardId = beforeAttack.targetCardId as string | undefined;
              if (!healDiscardId) return { valid: false, error: '必须选择要弃除的手牌' };
              const healPlayer = core.players[playerId];
              const healCard = healPlayer.hand.find(c => c.id === healDiscardId);
              if (!healCard) return { valid: false, error: '手牌中没有该卡牌' };
              const healTarget = getUnitAt(core, targetPos);
              if (!healTarget || healTarget.owner !== playerId) return { valid: false, error: '目标必须是友方单位' };
              if (healTarget.card.unitClass !== 'common' && healTarget.card.unitClass !== 'champion') {
                return { valid: false, error: '目标必须是士兵或英雄' };
              }
              hasHealingBeforeAttack = true;
              break;
            }

            default:
              return { valid: false, error: '无效的攻击前技能' };
          }
        }
      }
      const isHealingAttack = attacker.healingMode || hasHealingBeforeAttack;
      // 治疗模式允许攻击友方单位（圣殿牧师）
      if (isHealingAttack) {
        const healTarget = getUnitAt(core, targetPos);
        if (!healTarget || healTarget.owner !== playerId) {
          return { valid: false, error: '治疗模式只能攻击友方单位' };
        }
        if (healTarget.card.unitClass !== 'common' && healTarget.card.unitClass !== 'champion') {
          return { valid: false, error: '治疗目标必须是士兵或英雄' };
        }
        const healDist = manhattanDistance(attackerPos, targetPos);
        if (healDist !== 1) return { valid: false, error: '治疗目标必须相邻' };
        return { valid: true };
      }
      if (!canAttackEnhanced(core, attackerPos, targetPos)) return { valid: false, error: '无法攻击该目标' };

      // 守卫检查：如果攻击者相邻有敌方守卫单位，必须攻击守卫单位
      const targetUnit = getUnitAt(core, targetPos);
      if (targetUnit) {
        const targetHasGuardian = getUnitAbilities(targetUnit, core).includes('guardian');
        if (!targetHasGuardian) {
          // 目标不是守卫，检查攻击者相邻是否有敌方守卫
          const adjDirs = [
            { row: -1, col: 0 }, { row: 1, col: 0 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
          ];
          for (const d of adjDirs) {
            const adjPos = { row: attackerPos.row + d.row, col: attackerPos.col + d.col };
            if (adjPos.row < 0 || adjPos.row >= BOARD_ROWS || adjPos.col < 0 || adjPos.col >= BOARD_COLS) continue;
            const adjUnit = getUnitAt(core, adjPos);
            if (adjUnit && adjUnit.owner !== playerId
              && getUnitAbilities(adjUnit, core).includes('guardian')
              && canAttackEnhanced(core, attackerPos, adjPos)) {
              return { valid: false, error: '相邻有守卫单位，必须攻击守卫单位' };
            }
          }
        }
      }

      return { valid: true };
    }

    case SW_COMMANDS.PLAY_EVENT: {
      const cardId = payload.cardId as string;
      const targets = payload.targets as CellCoord[] | undefined;
      const player = core.players[playerId];
      const card = player.hand.find(c => c.id === cardId);
      if (!card || card.cardType !== 'event') return { valid: false, error: '无效的事件卡' };
      const eventCard = card as EventCard;
      if (!hasEnoughMagic(core, playerId, eventCard.cost)) return { valid: false, error: '魔力不足' };
      if (eventCard.playPhase !== 'any' && eventCard.playPhase !== core.phase) {
        return { valid: false, error: `该事件只能在${getPhaseDisplayName(eventCard.playPhase)}施放` };
      }
      
      // 建筑类事件卡验证
      if (eventCard.life !== undefined) {
        if (!targets || targets.length === 0) {
          return { valid: false, error: '必须选择放置位置' };
        }
        const position = targets[0];
        if (!isValidCoord(position)) {
          return { valid: false, error: '放置位置无效' };
        }
        if (!isCellEmpty(core, position)) {
          return { valid: false, error: '放置位置必须为空' };
        }
        // 建筑类事件卡必须在建造阶段打出
        if (eventCard.playPhase !== 'build') {
          return { valid: false, error: '建筑类事件卡只能在建造阶段打出' };
        }
      }
      
      return { valid: true };
    }

    case SW_COMMANDS.BLOOD_SUMMON_STEP: {
      if (core.phase !== 'summon') return { valid: false, error: '血契召唤只能在召唤阶段使用' };
      const bsTargetPos = payload.targetUnitPosition as CellCoord;
      const bsSummonCardId = payload.summonCardId as string;
      const bsSummonPos = payload.summonPosition as CellCoord;
      const bsPlayer = core.players[playerId];
      const bsTargetUnit = getUnitAt(core, bsTargetPos);
      if (!bsTargetUnit || bsTargetUnit.owner !== playerId) return { valid: false, error: '必须选择一个友方单位作为目标' };
      const bsSummonCard = bsPlayer.hand.find(c => c.id === bsSummonCardId);
      if (!bsSummonCard || bsSummonCard.cardType !== 'unit') return { valid: false, error: '必须从手牌选择一个单位卡' };
      if ((bsSummonCard as UnitCard).cost > 2) return { valid: false, error: '血契召唤只能放置费用≤2的单位' };
      if (!isAdjacent(bsTargetPos, bsSummonPos)) return { valid: false, error: '必须放置到目标相邻的区格' };
      if (!isCellEmpty(core, bsSummonPos)) return { valid: false, error: '放置位置必须为空' };
      return { valid: true };
    }

    case SW_COMMANDS.DISCARD_FOR_MAGIC: {
      if (core.phase !== 'magic') return { valid: false, error: '当前不是魔力阶段' };
      const dmCardIds = payload.cardIds as string[] | undefined;
      if (!dmCardIds || !Array.isArray(dmCardIds) || dmCardIds.length === 0) {
        return { valid: false, error: '必须选择至少一张卡牌弃置' };
      }
      const dmPlayer = core.players[playerId];
      for (const cardId of dmCardIds) {
        if (!dmPlayer.hand.some(c => c.id === cardId)) {
          return { valid: false, error: '手牌中没有该卡牌' };
        }
      }
      return { valid: true };
    }

    case SW_COMMANDS.END_PHASE: {
      return { valid: true };
    }

    case SW_COMMANDS.ACTIVATE_ABILITY: {
      return validateActivateAbility(core, playerId, payload, command.playerId);
    }

    case SW_COMMANDS.FUNERAL_PYRE_HEAL: {
      const fpCardId = payload.cardId as string;
      const fpSkip = payload.skip as boolean | undefined;
      const fpPlayer = core.players[playerId];
      const fpEvent = fpPlayer.activeEvents.find(c => c.id === fpCardId);
      if (!fpEvent) return { valid: false, error: '主动事件区没有该卡牌' };
      if (fpSkip) return { valid: true };
      const fpTargetPos = payload.targetPosition as CellCoord;
      if ((fpEvent.charges ?? 0) <= 0) return { valid: false, error: '殉葬火堆没有充能' };
      const fpTarget = getUnitAt(core, fpTargetPos);
      if (!fpTarget) return { valid: false, error: '目标位置没有单位' };
      if (fpTarget.damage <= 0) return { valid: false, error: '目标单位没有伤害' };
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

// ============================================================================
// ACTIVATE_ABILITY 验证
// ============================================================================

function validateActivateAbility(
  core: SummonerWarsCore,
  playerId: PlayerId,
  payload: Record<string, unknown>,
  _commandPlayerId?: string
): ValidationResult {
  // 所有技能统一走数据驱动验证
  return validateAbilityActivation(core, playerId, payload);
}
