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
  getPlayerUnits,
  getStructureAt,
  isAdjacent,
  isCellEmpty,
  canMoveToEnhanced,
  canAttackEnhanced,
  getValidSummonPositionsForCard,
  getValidBuildPositions,
  hasEnoughMagic,
  manhattanDistance,
  getSummoner,
  getUnitAbilities,
  getValidShourenFreezeTargets,
  getHuijinScorchTargets,
  isValidCoord,
  isInStraightLine,
} from './helpers';
import { getPhaseDisplayName } from './execute';
import { validateAbilityActivation } from './abilityValidation';
import { VALID_FACTION_IDS, getBaseCardId, CARD_IDS, isMoguFungalBeastCard, isMoguSporePlagueBodyCard } from './ids';

const INTERACTIVE_EVENT_BASE_IDS = new Set<string>([
  CARD_IDS.NECRO_HELLFIRE_BLADE,
  CARD_IDS.NECRO_BLOOD_SUMMON,
  CARD_IDS.NECRO_ANNIHILATE,
  CARD_IDS.TRICKSTER_MIND_CONTROL,
  CARD_IDS.TRICKSTER_STUN,
  CARD_IDS.TRICKSTER_HYPNOTIC_LURE,
  CARD_IDS.BARBARIC_CHANT_OF_POWER,
  CARD_IDS.BARBARIC_CHANT_OF_GROWTH,
  CARD_IDS.BARBARIC_CHANT_OF_WEAVING,
  CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT,
  CARD_IDS.FROST_GLACIAL_SHIFT,
  CARD_IDS.GOBLIN_SNEAK,
  CARD_IDS.MOGU_COMMAND,
  CARD_IDS.MOGU_SYMBIOTIC_SELF_HEALING,
  CARD_IDS.MOGU_RELEASE_SPORES,
  CARD_IDS.SHOUREN_FREEZE,
  CARD_IDS.HUIJIN_SCORCH,
]);

const hasAdjacentEmptyCell = (core: SummonerWarsCore, position: CellCoord): boolean => {
  const adj = [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 },
  ];
  return adj.some((pos) => isValidCoord(pos) && isCellEmpty(core, pos));
};

const hasValidEventInteractionTargets = (
  core: SummonerWarsCore,
  playerId: PlayerId,
  eventCard: EventCard,
): boolean => {
  const baseId = getBaseCardId(eventCard.id);
  const friendlyUnits = getPlayerUnits(core, playerId as PlayerId);
  const summoner = getSummoner(core, playerId as PlayerId);

  switch (baseId) {
    case CARD_IDS.NECRO_HELLFIRE_BLADE: {
      return friendlyUnits.some((unit) => unit.card.unitClass === 'common');
    }
    case CARD_IDS.NECRO_BLOOD_SUMMON: {
      const hasTarget = friendlyUnits.some((unit) => hasAdjacentEmptyCell(core, unit.position));
      const hasCard = core.players[playerId].hand.some((card) => card.cardType === 'unit' && (card as UnitCard).cost <= 2);
      return hasTarget && hasCard;
    }
    case CARD_IDS.NECRO_ANNIHILATE: {
      return friendlyUnits.some((unit) => unit.card.unitClass !== 'summoner');
    }
    case CARD_IDS.TRICKSTER_MIND_CONTROL: {
      if (!summoner) return false;
      const opponentId = playerId === '0' ? '1' : '0';
      const enemyUnits = getPlayerUnits(core, opponentId as PlayerId)
        .filter((unit) => unit.card.unitClass !== 'summoner');
      return enemyUnits.some((unit) => manhattanDistance(summoner.position, unit.position) <= 2);
    }
    case CARD_IDS.TRICKSTER_STUN: {
      if (!summoner) return false;
      const opponentId = playerId === '0' ? '1' : '0';
      const enemyUnits = getPlayerUnits(core, opponentId as PlayerId)
        .filter((unit) => unit.card.unitClass !== 'summoner');
      return enemyUnits.some((unit) => {
        const dist = manhattanDistance(summoner.position, unit.position);
        return dist > 0 && dist <= 3 && isInStraightLine(summoner.position, unit.position);
      });
    }
    case CARD_IDS.TRICKSTER_HYPNOTIC_LURE: {
      const opponentId = playerId === '0' ? '1' : '0';
      return getPlayerUnits(core, opponentId as PlayerId)
        .some((unit) => unit.card.unitClass !== 'summoner');
    }
    case CARD_IDS.BARBARIC_CHANT_OF_POWER: {
      if (!summoner) return false;
      return friendlyUnits.some((unit) => unit.card.unitClass !== 'summoner'
        && manhattanDistance(summoner.position, unit.position) <= 3);
    }
    case CARD_IDS.BARBARIC_CHANT_OF_GROWTH:
    case CARD_IDS.BARBARIC_CHANT_OF_WEAVING: {
      return friendlyUnits.length > 0;
    }
    case CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT: {
      if (!summoner) return false;
      const commons = friendlyUnits.filter((unit) =>
        unit.card.unitClass === 'common' && manhattanDistance(summoner.position, unit.position) <= 3);
      return commons.length >= 2;
    }
    case CARD_IDS.MOGU_COMMAND: {
      if (!summoner) return false;
      return friendlyUnits.some((unit) =>
        unit.card.unitClass === 'common' && manhattanDistance(summoner.position, unit.position) <= 3);
    }
    case CARD_IDS.MOGU_SYMBIOTIC_SELF_HEALING: {
      return friendlyUnits.some((unit) => unit.card.unitClass !== 'summoner');
    }
    case CARD_IDS.MOGU_RELEASE_SPORES: {
      if (!summoner) return false;
      const hasDiscardBody = core.players[playerId].discard
        .some((card) => card.cardType === 'unit' && isMoguSporePlagueBodyCard(card));
      return hasDiscardBody && hasAdjacentEmptyCell(core, summoner.position);
    }
    case CARD_IDS.FROST_GLACIAL_SHIFT: {
      if (!summoner) return false;
      const buildings: CellCoord[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const pos = { row, col };
          const structure = getStructureAt(core, pos);
          const unit = getUnitAt(core, pos);
          const isAllyStructure = (structure && structure.owner === playerId)
            || (unit && unit.owner === playerId && getUnitAbilities(unit, core).includes('mobile_structure'));
          if (isAllyStructure && manhattanDistance(summoner.position, pos) <= 3 && hasAdjacentEmptyCell(core, pos)) {
            buildings.push(pos);
          }
        }
      }
      return buildings.length > 0;
    }
    case CARD_IDS.GOBLIN_SNEAK: {
      return friendlyUnits.some((unit) =>
        unit.card.unitClass !== 'summoner'
        && unit.card.cost === 0
        && hasAdjacentEmptyCell(core, unit.position),
      );
    }
    case CARD_IDS.SHOUREN_FREEZE: {
      return getValidShourenFreezeTargets(core, playerId).length > 0;
    }
    case CARD_IDS.HUIJIN_SCORCH: {
      return getHuijinScorchTargets(core, playerId).length > 0;
    }
    default:
      return false;
  }
};

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
  const isTutorialActive = state.sys?.tutorial?.active === true;
  const playerId = core.currentPlayer;
  const payload = command.payload as Record<string, unknown>;

  if (core.pendingAttackRoll
    && command.type !== SW_COMMANDS.RESOLVE_PENDING_ATTACK
    && Object.values(SW_COMMANDS).includes(command.type as typeof SW_COMMANDS[keyof typeof SW_COMMANDS])) {
    return { valid: false, error: '必须先完成待结算攻击' };
  }

  switch (command.type) {
    case SW_COMMANDS.RESOLVE_PENDING_ATTACK: {
      const pending = core.pendingAttackRoll;
      const choice = payload.choice;
      if (!pending || pending.playerId !== playerId) return { valid: false, error: '没有可结算的攻击' };
      if (choice !== 'reroll' && choice !== 'keep') return { valid: false, error: '无效的激励选择' };
      if (choice === 'reroll') {
        const summoner = getSummoner(core, playerId);
        if (!summoner || summoner.boosts < 1) return { valid: false, error: '召唤师没有充能' };
      }
      return { valid: true };
    }

    case SW_COMMANDS.SELECT_FACTION: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始，无法更改阵营' };
      const factionId = payload.factionId as string;
      if (!VALID_FACTION_IDS.includes(factionId as FactionId)) return { valid: false, error: '无效的阵营 ID' };
      const selectingPlayerId = (command.playerId as PlayerId | undefined) ?? playerId;
      if (!isTutorialActive) {
        const selectedByOtherPlayer = Object.entries(core.selectedFactions)
          .some(([selectedPlayerId, selectedFactionId]) => (
            selectedPlayerId !== selectingPlayerId && selectedFactionId === factionId
          ));
        if (selectedByOtherPlayer) return { valid: false, error: '该阵营已被其他玩家选择' };
      }
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

    case SW_COMMANDS.SWAP_SEAT: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始，无法换位' };
      const requesterId = ((command.playerId as PlayerId | undefined) ?? playerId);
      const targetPlayerId = payload.targetPlayerId;
      if (targetPlayerId !== '0' && targetPlayerId !== '1') {
        return { valid: false, error: '目标座位无效' };
      }
      if (requesterId === targetPlayerId) {
        return { valid: false, error: '不能与自己换位' };
      }
      if (!core.players[targetPlayerId]) {
        return { valid: false, error: '目标玩家不存在' };
      }
      return { valid: true };
    }

    case SW_COMMANDS.PLAYER_READY: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始' };
      const cmdPlayerId = command.playerId as PlayerId;
      const faction = core.selectedFactions[cmdPlayerId];
      if (!faction || faction === 'unselected') return { valid: false, error: '必须先选择阵营' };
      return { valid: true };
    }

    case SW_COMMANDS.PLAYER_UNREADY: {
      if (core.hostStarted) return { valid: false, error: '游戏已开始' };
      const cmdPid = command.playerId as PlayerId;
      if (!core.readyPlayers[cmdPid]) return { valid: false, error: '尚未准备' };
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
      const validPositions = getValidSummonPositionsForCard(core, playerId, unitCard);
      // 火祀召唤：必须额外消灭一个友方单位，伊路特-巴尔替换其位置
      const hasFireSacrifice = (unitCard.abilities ?? []).includes('fire_sacrifice_summon');
      if (hasFireSacrifice) {
        const sacrificeUnitId = payload.sacrificeUnitId as string | undefined;
        if (!sacrificeUnitId) {
          return { valid: false, error: '火祀召唤：必须选择一个友方单位作为牺牲品' };
        }
        // 找到牺牲品
        let sacrificeUnit: BoardUnit | undefined;
        outer: for (let row = 0; row < BOARD_ROWS; row++) {
          for (let col = 0; col < BOARD_COLS; col++) {
            const u = core.board[row]?.[col]?.unit;
            if (u && (u.instanceId === sacrificeUnitId || u.cardId === sacrificeUnitId)) {
              sacrificeUnit = u;
              break outer;
            }
          }
        }
        if (!sacrificeUnit) {
          return { valid: false, error: '火祀召唤：找不到指定的牺牲品单位' };
        }
        if (sacrificeUnit.owner !== playerId) {
          return { valid: false, error: '火祀召唤：只能牺牲自己的单位' };
        }
        if (sacrificeUnit.card.unitClass === 'summoner') {
          return { valid: false, error: '火祀召唤：不能牺牲召唤师' };
        }
        // 牺牲品位置无限制，伊路特-巴尔替换其位置
        return { valid: true };
      }

      const hasMoguFinalForm = (unitCard.abilities ?? []).includes('mogu_final_form');
      if (hasMoguFinalForm) {
        const sacrificeUnitId = payload.sacrificeUnitId as string | undefined;
        if (!sacrificeUnitId) {
          return { valid: false, error: '最终形态：必须选择一个具有5点或更多充能的友方菌化野兽' };
        }
        const replacementTarget = getPlayerUnits(core, playerId)
          .find(unit => unit.instanceId === sacrificeUnitId || unit.cardId === sacrificeUnitId);
        if (!replacementTarget) {
          return { valid: false, error: '最终形态：找不到指定的菌化野兽' };
        }
        if (!isMoguFungalBeastCard(replacementTarget.card)) {
          return { valid: false, error: '最终形态：目标必须是菌化野兽' };
        }
        if ((replacementTarget.boosts ?? 0) < 5) {
          return { valid: false, error: '最终形态：菌化野兽必须具有5点或更多充能' };
        }
        return { valid: true };
      }

      if (!validPositions.some(p => p.row === position.row && p.col === position.col)) {
        return { valid: false, error: '无效的召唤位置' };
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
      
      // ✅ 检查是否有跨阶段攻击权限（群情激愤）
      const player = core.players[playerId];
      const hasRallyingCry = player.activeEvents.some(
        e => getBaseCardId(e.id) === CARD_IDS.BARBARIC_RALLYING_CRY && e.isActive
      );
      
      // ✅ 检查攻击者是否有额外攻击（洞穴地精群情激愤/连续射击等授予的 extraAttacks）
      const attacker = getUnitAt(core, attackerPos);
      const attackerHasExtraAttacks = attacker && (attacker.extraAttacks ?? 0) > 0;
      
      if (core.phase !== 'attack' && !hasRallyingCry && !attackerHasExtraAttacks) {
        return { valid: false, error: '当前不是攻击阶段' };
      }
      
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
      // 治疗模式：已支付治疗代价后，只能选择友方士兵/英雄并改为治疗结算。
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

      // 守卫检查：如果攻击者相邻有敌方守卫单位，目标必须是守卫单位本身。
      // 规则原文限制的是“攻击目标”，因此攻击建筑也不能绕过相邻守卫。
      const targetUnit = getUnitAt(core, targetPos);
      const targetHasGuardian = !!targetUnit && getUnitAbilities(targetUnit, core).includes('guardian');
      if (!targetHasGuardian) {
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

      return { valid: true };
    }

    case SW_COMMANDS.CONFIRM_ATTACK: {
      // 兼容旧客户端缓存：历史上该命令不会独立结算攻击，当前保留为安全 no-op
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
      const baseId = getBaseCardId(eventCard.id);
      if (INTERACTIVE_EVENT_BASE_IDS.has(baseId) && !hasValidEventInteractionTargets(core, playerId, eventCard)) {
        return { valid: false, error: '没有可用目标' };
      }
      if (baseId === CARD_IDS.SHOUREN_FREEZE) {
        const targetPosition = targets?.[0];
        const validTargets = getValidShourenFreezeTargets(core, playerId);
        if (!targetPosition || !validTargets.some(unit => (
          unit.position.row === targetPosition.row && unit.position.col === targetPosition.col
        ))) {
          return { valid: false, error: '冻结目标必须是召唤师3格内未充能的士兵或英雄' };
        }
      }
      if (baseId === CARD_IDS.HUIJIN_SCORCH) {
        const targetPosition = targets?.[0];
        const validTargets = getHuijinScorchTargets(core, playerId);
        if (!targetPosition || !validTargets.some(unit => (
          unit.position.row === targetPosition.row && unit.position.col === targetPosition.col
        ))) {
          return { valid: false, error: '灼烧目标必须是召唤师2格内的士兵或英雄' };
        }
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

    case SW_COMMANDS.REQUEST_EVENT_INTERACTION: {
      const cardId = payload.cardId as string;
      const player = core.players[playerId];
      const card = player.hand.find(c => c.id === cardId);
      if (!card || card.cardType !== 'event') return { valid: false, error: '无效的事件卡' };
      const eventCard = card as EventCard;
      if (!hasEnoughMagic(core, playerId, eventCard.cost)) return { valid: false, error: '魔力不足' };
      if (eventCard.playPhase !== 'any' && eventCard.playPhase !== core.phase) {
        return { valid: false, error: `该事件只能在${getPhaseDisplayName(eventCard.playPhase)}施放` };
      }
      const baseId = getBaseCardId(eventCard.id);
      if (!INTERACTIVE_EVENT_BASE_IDS.has(baseId)) {
        return { valid: false, error: '该事件无需交互' };
      }
      if (!hasValidEventInteractionTargets(core, playerId, eventCard)) {
        return { valid: false, error: '没有可用目标' };
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

    case SW_COMMANDS.REQUEST_MAGIC_EVENT_CHOICE: {
      if (core.phase !== 'magic') return { valid: false, error: '当前不是魔力阶段' };
      const cardId = payload.cardId as string;
      const player = core.players[playerId];
      const card = player.hand.find(c => c.id === cardId);
      if (!card || card.cardType !== 'event') {
        return { valid: false, error: '手牌中没有该事件卡' };
      }
      const eventCard = card as EventCard;
      if (eventCard.playPhase !== 'magic' && eventCard.playPhase !== 'any') {
        return { valid: false, error: '该事件卡不能在魔力阶段打出' };
      }
      if (eventCard.cost > player.magic) {
        return { valid: false, error: '魔力不足' };
      }
      return { valid: true };
    }

    case SW_COMMANDS.END_PHASE: {
      if (state.sys?.interaction?.current) {
        return { valid: false, error: '请先完成当前交互' };
      }
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
  commandPlayerId?: string
): ValidationResult {
  const activationPlayerId = commandPlayerId === '0' || commandPlayerId === '1'
    ? commandPlayerId
    : playerId;
  // 所有技能统一走数据驱动验证
  return validateAbilityActivation(core, activationPlayerId, payload);
}
