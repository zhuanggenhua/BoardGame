/**
 * 召唤师战争 - 命令验证器
 */

import type { ValidationResult } from '../../../engine/types';
import type { MatchState } from '../../../engine/types';
import type {
  SummonerWarsCore,
  PlayerId,
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
  getStructureAt,
  isAdjacent,
  isCellEmpty,
  canMoveToEnhanced,
  canAttackEnhanced,
  getValidSummonPositions,
  getValidBuildPositions,
  hasEnoughMagic,
  manhattanDistance,
  getSummoner,
} from './helpers';
import { getPhaseDisplayName } from './execute';

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
      const validFactions = ['necromancer', 'trickster', 'paladin', 'goblin', 'frost', 'barbaric'];
      if (!validFactions.includes(factionId)) return { valid: false, error: '无效的阵营 ID' };
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
        const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
        return baseId === 'paladin-rekindle-hope';
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
      if ((unit.card.abilities ?? []).includes('immobile')) return { valid: false, error: '该单位不能移动（禁足）' };
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
      // 凶残单位可以作为额外攻击者（不计入3次限制）
      const hasFerocity = (attacker.card.abilities ?? []).includes('ferocity');
      if (core.players[playerId].attackCount >= MAX_ATTACKS_PER_TURN && !hasFerocity) {
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
        const attackerAbilities = attacker.card.abilities ?? [];
        for (const beforeAttack of beforeAttackList) {
          if (!attackerAbilities.includes(beforeAttack.abilityId)) {
            return { valid: false, error: '该单位没有此技能' };
          }
          switch (beforeAttack.abilityId) {
            case 'life_drain': {
              if (!beforeAttack.targetUnitId) return { valid: false, error: '必须选择要消灭的友方单位' };
              let targetUnit: BoardUnit | undefined;
              let targetPos: CellCoord | undefined;
              for (let row = 0; row < BOARD_ROWS; row++) {
                for (let col = 0; col < BOARD_COLS; col++) {
                  const unit = core.board[row]?.[col]?.unit;
                  if (unit && unit.cardId === beforeAttack.targetUnitId) {
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
              if (!discardCardIds || discardCardIds.length === 0) {
                return { valid: false, error: '必须选择要弃除的卡牌' };
              }
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
        const targetHasGuardian = (targetUnit.card.abilities ?? []).includes('guardian');
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
              && (adjUnit.card.abilities ?? []).includes('guardian')
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
      const player = core.players[playerId];
      const card = player.hand.find(c => c.id === cardId);
      if (!card || card.cardType !== 'event') return { valid: false, error: '无效的事件卡' };
      const eventCard = card as EventCard;
      if (!hasEnoughMagic(core, playerId, eventCard.cost)) return { valid: false, error: '魔力不足' };
      if (eventCard.playPhase !== 'any' && eventCard.playPhase !== core.phase) {
        return { valid: false, error: `该事件只能在${getPhaseDisplayName(eventCard.playPhase)}施放` };
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
  const abilityId = payload.abilityId as string;
  const sourceUnitId = payload.sourceUnitId as string;
  const targetCardId = payload.targetCardId as string | undefined;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  const targetUnitId = payload.targetUnitId as string | undefined;
  
  let sourceUnit: BoardUnit | undefined;
  let sourcePosition: CellCoord | undefined;
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = core.board[row]?.[col]?.unit;
      if (unit && unit.cardId === sourceUnitId) {
        sourceUnit = unit;
        sourcePosition = { row, col };
        break;
      }
    }
    if (sourceUnit) break;
  }
  
  if (!sourceUnit || !sourcePosition) return { valid: false, error: '技能源单位未找到' };
  if (sourceUnit.owner !== playerId) return { valid: false, error: '只能发动自己单位的技能' };
  if (!sourceUnit.card.abilities?.includes(abilityId)) return { valid: false, error: '该单位没有此技能' };

  switch (abilityId) {
    case 'revive_undead': {
      if (core.phase !== 'summon') return { valid: false, error: '复活死灵只能在召唤阶段使用' };
      if (!targetCardId) return { valid: false, error: '必须选择弃牌堆中的卡牌' };
      if (!targetPosition) return { valid: false, error: '必须选择放置位置' };
      const player = core.players[playerId];
      const card = player.discard.find(c => c.id === targetCardId);
      if (!card || card.cardType !== 'unit') return { valid: false, error: '弃牌堆中没有该单位卡' };
      const isUndead = card.id.includes('undead') || card.name.includes('亡灵') || (card as UnitCard).faction === '堕落王国';
      if (!isUndead) return { valid: false, error: '只能复活亡灵单位' };
      if (!isAdjacent(sourcePosition, targetPosition)) return { valid: false, error: '必须放置到召唤师相邻的位置' };
      if (!isCellEmpty(core, targetPosition)) return { valid: false, error: '放置位置必须为空' };
      return { valid: true };
    }

    case 'fire_sacrifice_summon': {
      if (!targetUnitId) return { valid: false, error: '必须选择要消灭的友方单位' };
      let targetUnit: BoardUnit | undefined;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (unit && unit.cardId === targetUnitId) { targetUnit = unit; break; }
        }
        if (targetUnit) break;
      }
      if (!targetUnit || targetUnit.owner !== playerId) return { valid: false, error: '必须选择一个友方单位' };
      return { valid: true };
    }

    case 'life_drain': {
      if (core.phase !== 'attack') return { valid: false, error: '吸取生命只能在攻击阶段使用' };
      if (!targetUnitId) return { valid: false, error: '必须选择要消灭的友方单位' };
      let targetUnit: BoardUnit | undefined;
      let targetPos: CellCoord | undefined;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (unit && unit.cardId === targetUnitId) { targetUnit = unit; targetPos = { row, col }; break; }
        }
        if (targetUnit) break;
      }
      if (!targetUnit || !targetPos || targetUnit.owner !== playerId) return { valid: false, error: '必须选择一个友方单位' };
      const dist = Math.abs(sourcePosition.row - targetPos.row) + Math.abs(sourcePosition.col - targetPos.col);
      if (dist > 2) return { valid: false, error: '目标必须在2格以内' };
      return { valid: true };
    }

    case 'infection': {
      if (!targetCardId || !targetPosition) return { valid: false, error: '必须选择弃牌堆中的疫病体和放置位置' };
      const player = core.players[playerId];
      const card = player.discard.find(c => c.id === targetCardId);
      if (!card || card.cardType !== 'unit') return { valid: false, error: '弃牌堆中没有该单位卡' };
      const isPlagueZombie = card.id.includes('plague-zombie') || card.name.includes('疫病体');
      if (!isPlagueZombie) return { valid: false, error: '只能召唤疫病体' };
      if (!isCellEmpty(core, targetPosition)) return { valid: false, error: '放置位置必须为空' };
      return { valid: true };
    }

    case 'soul_transfer': {
      if (!targetPosition) return { valid: false, error: '必须指定目标位置' };
      if (!isCellEmpty(core, targetPosition)) return { valid: false, error: '目标位置必须为空' };
      return { valid: true };
    }

    case 'mind_capture_resolve': {
      const choice = payload.choice as string | undefined;
      if (!choice || (choice !== 'control' && choice !== 'damage')) return { valid: false, error: '必须选择控制或伤害' };
      return { valid: true };
    }

    case 'telekinesis':
    case 'high_telekinesis': {
      if (core.phase !== 'attack') return { valid: false, error: '念力只能在攻击阶段使用' };
      if (!targetPosition) return { valid: false, error: '必须选择推拉目标' };
      const maxRange = abilityId === 'high_telekinesis' ? 3 : 2;
      const dist = Math.abs(sourcePosition.row - targetPosition.row) + Math.abs(sourcePosition.col - targetPosition.col);
      if (dist > maxRange) return { valid: false, error: `目标必须在${maxRange}格以内` };
      const tkTarget = getUnitAt(core, targetPosition);
      if (!tkTarget) return { valid: false, error: '目标位置没有单位' };
      if (tkTarget.card.unitClass === 'summoner') return { valid: false, error: '不能推拉召唤师' };
      return { valid: true };
    }

    case 'mind_transmission': {
      if (core.phase !== 'attack') return { valid: false, error: '读心传念只能在攻击阶段使用' };
      if (!targetPosition) return { valid: false, error: '必须选择额外攻击目标' };
      const mtDist = Math.abs(sourcePosition.row - targetPosition.row) + Math.abs(sourcePosition.col - targetPosition.col);
      if (mtDist > 3) return { valid: false, error: '目标必须在3格以内' };
      const mtTarget = getUnitAt(core, targetPosition);
      if (!mtTarget) return { valid: false, error: '目标位置没有单位' };
      if (mtTarget.owner !== playerId) return { valid: false, error: '必须选择友方单位' };
      if (mtTarget.card.unitClass !== 'common') return { valid: false, error: '只能选择士兵' };
      return { valid: true };
    }

    // ============ 洞穴地精技能验证 ============

    case 'vanish': {
      if (core.phase !== 'attack') return { valid: false, error: '神出鬼没只能在攻击阶段使用' };
      if (!targetPosition) return { valid: false, error: '必须选择交换目标' };
      const vanishTarget = getUnitAt(core, targetPosition);
      if (!vanishTarget) return { valid: false, error: '目标位置没有单位' };
      if (vanishTarget.owner !== playerId) return { valid: false, error: '必须选择友方单位' };
      if (vanishTarget.card.cost !== 0) return { valid: false, error: '只能与费用为0的友方单位交换' };
      if (vanishTarget.cardId === sourceUnitId) return { valid: false, error: '不能与自己交换' };
      return { valid: true };
    }

    case 'blood_rune': {
      if (core.phase !== 'attack') return { valid: false, error: '鲜血符文只能在攻击阶段使用' };
      const brChoice = payload.choice as string | undefined;
      if (!brChoice || (brChoice !== 'damage' && brChoice !== 'charge')) return { valid: false, error: '必须选择自伤或充能' };
      if (brChoice === 'charge' && core.players[playerId].magic < 1) return { valid: false, error: '魔力不足' };
      return { valid: true };
    }

    case 'feed_beast': {
      // 喂养巨食兽：选择相邻友方单位移除，或不选则自毁
      if (core.phase !== 'attack') return { valid: false, error: '喂养巨食兽只能在攻击阶段使用' };
      const fbChoice = payload.choice as string | undefined;
      if (fbChoice === 'self_destroy') return { valid: true };
      if (!targetPosition) return { valid: false, error: '必须选择相邻友方单位或自毁' };
      const fbTarget = getUnitAt(core, targetPosition);
      if (!fbTarget) return { valid: false, error: '目标位置没有单位' };
      if (fbTarget.owner !== playerId) return { valid: false, error: '必须选择友方单位' };
      if (fbTarget.cardId === sourceUnitId) return { valid: false, error: '不能选择自己' };
      const fbDist = Math.abs(sourcePosition.row - targetPosition.row) + Math.abs(sourcePosition.col - targetPosition.col);
      if (fbDist !== 1) return { valid: false, error: '必须选择相邻的友方单位' };
      return { valid: true };
    }

    case 'magic_addiction': {
      // 魔力成瘾：自动处理，无需玩家选择
      return { valid: true };
    }

    case 'grab': {
      // 抓附：将抓附手放置到移动后友方单位相邻的空格
      if (!targetPosition) return { valid: false, error: '必须选择放置位置' };
      if (!isCellEmpty(core, targetPosition)) return { valid: false, error: '目标位置必须为空' };
      return { valid: true };
    }

    // ============ 先锋军团技能验证 ============

    case 'fortress_power': {
      if (core.phase !== 'attack') return { valid: false, error: '城塞之力只能在攻击阶段使用' };
      if (!targetCardId) return { valid: false, error: '必须选择弃牌堆中的城塞单位' };
      // 检查战场上是否有友方城塞单位
      let hasFortressOnBoard = false;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const u = core.board[row]?.[col]?.unit;
          if (u && u.owner === playerId && u.card.id.includes('fortress')) {
            hasFortressOnBoard = true;
            break;
          }
        }
        if (hasFortressOnBoard) break;
      }
      if (!hasFortressOnBoard) return { valid: false, error: '战场上没有友方城塞单位' };
      const fpPlayer = core.players[playerId];
      const fpCard = fpPlayer.discard.find(c => c.id === targetCardId);
      if (!fpCard || fpCard.cardType !== 'unit') return { valid: false, error: '弃牌堆中没有该单位卡' };
      if (!(fpCard as import('./types').UnitCard).id.includes('fortress')) return { valid: false, error: '只能拿取城塞单位' };
      return { valid: true };
    }

    case 'guidance': {
      if (core.phase !== 'summon') return { valid: false, error: '指引只能在召唤阶段使用' };
      const guidancePlayer = core.players[playerId];
      if (guidancePlayer.deck.length === 0) return { valid: false, error: '牌组为空' };
      return { valid: true };
    }

    case 'holy_arrow': {
      if (core.phase !== 'attack') return { valid: false, error: '圣光箭只能在攻击阶段使用' };
      const discardCardIds = payload.discardCardIds as string[] | undefined;
      if (!discardCardIds || discardCardIds.length === 0) return { valid: false, error: '必须选择要弃除的卡牌' };
      const haPlayer = core.players[playerId];
      // 检查所有卡牌是否在手牌中且为非同名单位
      const names = new Set<string>();
      for (const cardId of discardCardIds) {
        const card = haPlayer.hand.find(c => c.id === cardId);
        if (!card || card.cardType !== 'unit') return { valid: false, error: '只能弃除单位卡' };
        const unitCard = card as import('./types').UnitCard;
        if (unitCard.name === sourceUnit!.card.name) return { valid: false, error: '不能弃除同名单位' };
        if (names.has(unitCard.name)) return { valid: false, error: '不能弃除多张同名单位' };
        names.add(unitCard.name);
      }
      return { valid: true };
    }

    case 'healing': {
      if (core.phase !== 'attack') return { valid: false, error: '治疗只能在攻击阶段使用' };
      // 检查手牌中是否有可弃除的卡牌
      const healDiscardId = payload.targetCardId as string | undefined;
      if (!healDiscardId) return { valid: false, error: '必须选择要弃除的手牌' };
      const healPlayer = core.players[playerId];
      const healCard = healPlayer.hand.find(c => c.id === healDiscardId);
      if (!healCard) return { valid: false, error: '手牌中没有该卡牌' };
      // 检查目标是否为友方士兵或英雄（冠军）
      const healTargetPos = payload.targetPosition as CellCoord | undefined;
      if (!healTargetPos) return { valid: false, error: '必须选择攻击目标' };
      const healTarget = getUnitAt(core, healTargetPos);
      if (!healTarget || healTarget.owner !== playerId) return { valid: false, error: '目标必须是友方单位' };
      if (healTarget.card.unitClass !== 'common' && healTarget.card.unitClass !== 'champion') {
        return { valid: false, error: '目标必须是士兵或英雄' };
      }
      return { valid: true };
    }

    case 'judgment': {
      // 裁决是 afterAttack 被动触发，不需要主动验证
      return { valid: true };
    }

    // ============ 极地矮人技能验证 ============

    case 'structure_shift': {
      if (core.phase !== 'move') return { valid: false, error: '结构变换只能在移动阶段使用' };
      const ssTargetPos = payload.targetPosition as CellCoord | undefined;
      if (!ssTargetPos) return { valid: false, error: '必须选择目标建筑' };
      const ssStructure = getStructureAt(core, ssTargetPos);
      if (!ssStructure || ssStructure.owner !== playerId) return { valid: false, error: '必须选择友方建筑' };
      const ssDist = manhattanDistance(sourcePosition!, ssTargetPos);
      if (ssDist > 3) return { valid: false, error: '目标必须在3格以内' };
      return { valid: true };
    }

    case 'ice_shards': {
      if (core.phase !== 'build') return { valid: false, error: '寒冰碎屑只能在建造阶段使用' };
      if ((sourceUnit!.boosts ?? 0) < 1) return { valid: false, error: '没有充能可消耗' };
      return { valid: true };
    }

    // ============ 炽原精灵技能验证 ============

    case 'ancestral_bond': {
      if (core.phase !== 'move') return { valid: false, error: '祖灵羁绊只能在移动阶段使用' };
      if (!targetPosition) return { valid: false, error: '必须选择目标友方单位' };
      const abTarget = getUnitAt(core, targetPosition);
      if (!abTarget) return { valid: false, error: '目标位置没有单位' };
      if (abTarget.owner !== playerId) return { valid: false, error: '必须选择友方单位' };
      if (abTarget.cardId === sourceUnitId) return { valid: false, error: '不能选择自己' };
      const abDist = manhattanDistance(sourcePosition!, targetPosition);
      if (abDist > 3) return { valid: false, error: '目标必须在3格以内' };
      return { valid: true };
    }

    case 'prepare': {
      if (core.phase !== 'move') return { valid: false, error: '预备只能在移动阶段使用' };
      return { valid: true };
    }

    case 'inspire': {
      // 启悟：移动后自动触发，无需额外验证
      if (core.phase !== 'move') return { valid: false, error: '启悟只能在移动阶段使用' };
      return { valid: true };
    }

    case 'withdraw': {
      if (core.phase !== 'attack') return { valid: false, error: '撤退只能在攻击阶段使用' };
      const wdCostType = payload.costType as string | undefined;
      if (!wdCostType || (wdCostType !== 'charge' && wdCostType !== 'magic')) {
        return { valid: false, error: '必须选择消耗充能或魔力' };
      }
      if (wdCostType === 'charge' && (sourceUnit!.boosts ?? 0) < 1) {
        return { valid: false, error: '没有充能可消耗' };
      }
      if (wdCostType === 'magic' && core.players[playerId].magic < 1) {
        return { valid: false, error: '魔力不足' };
      }
      if (!targetPosition) return { valid: false, error: '必须选择移动目标位置' };
      const wdDist = manhattanDistance(sourcePosition!, targetPosition);
      if (wdDist < 1 || wdDist > 2) return { valid: false, error: '必须移动1-2格' };
      if (!isCellEmpty(core, targetPosition)) return { valid: false, error: '目标位置必须为空' };
      return { valid: true };
    }

    case 'spirit_bond': {
      if (core.phase !== 'move') return { valid: false, error: '祖灵交流只能在移动阶段使用' };
      const sbChoice = payload.choice as string | undefined;
      if (!sbChoice || (sbChoice !== 'self' && sbChoice !== 'transfer')) {
        return { valid: false, error: '必须选择充能自身或转移充能' };
      }
      if (sbChoice === 'transfer') {
        if ((sourceUnit!.boosts ?? 0) < 1) return { valid: false, error: '没有充能可消耗' };
        if (!targetPosition) return { valid: false, error: '必须选择目标友方单位' };
        const sbTarget = getUnitAt(core, targetPosition);
        if (!sbTarget) return { valid: false, error: '目标位置没有单位' };
        if (sbTarget.owner !== playerId) return { valid: false, error: '必须选择友方单位' };
        if (sbTarget.cardId === sourceUnitId) return { valid: false, error: '不能选择自己' };
        const sbDist = manhattanDistance(sourcePosition!, targetPosition);
        if (sbDist > 3) return { valid: false, error: '目标必须在3格以内' };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: '未知的技能' };
  }
}
