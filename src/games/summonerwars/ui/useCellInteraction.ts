/**
 * 召唤师战争 - 格子交互逻辑 Hook（编排层）
 *
 * 组合 useEventCardModes 子 hook，处理核心阶段交互（召唤/移动/攻击/建造）
 * 和技能模式交互。事件卡多步骤模式已委托给 useEventCardModes。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAutoSkipPhase } from '../../../components/game/framework';
import { useTranslation } from 'react-i18next';
import type { SummonerWarsCore, CellCoord, UnitCard, GamePhase } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import { FLOW_COMMANDS } from '../../../engine';
import {
  getValidSummonPositions, getValidBuildPositions,
  getValidMoveTargetsEnhanced, getValidAttackTargetsEnhanced,
  getPlayerUnits, hasAvailableActions, isCellEmpty, isImmobile,
  getAdjacentCells, MAX_MOVES_PER_TURN, MAX_ATTACKS_PER_TURN,
  manhattanDistance, getStructureAt, findUnitPositionByInstanceId, getSummoner,
  getUnitAbilities, hasStableAbility, getForceDestinations,
} from '../domain/helpers';
import { isUndeadCard, getBaseCardId, CARD_IDS } from '../domain/ids';
import { getSummonerWarsUIHints } from '../domain/uiHints';
import { extractPositions } from '../../../engine/primitives/uiHints';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import type { AbilityModeState, SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import { useToast } from '../../../contexts/ToastContext';
import { useEventCardModes } from './useEventCardModes';
import type { PendingBeforeAttack } from './modeTypes';
import { abilityRegistry } from '../domain/abilities';
import type { BoardUnit } from '../domain/types';

// 从 modeTypes 重新导出类型（保持 StatusBanners 等消费方的导入路径兼容）
export type {
  EventTargetModeState, MindControlModeState, ChantEntanglementModeState,
  WithdrawModeState, GlacialShiftModeState, SneakModeState,
  StunModeState, HypnoticLureModeState,
} from './modeTypes';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检测单位是否有被动触发的 beforeAttack 能力
 */
function getPassiveBeforeAttackAbilities(
  unit: BoardUnit,
  core: SummonerWarsCore
): Array<{ abilityId: string; def: import('../domain/abilities').AbilityDef }> {
  const abilities = getUnitAbilities(unit, core);
  const passiveAbilities: Array<{ abilityId: string; def: import('../domain/abilities').AbilityDef }> = [];
  
  for (const abilityId of abilities) {
    const def = abilityRegistry.get(abilityId);
    if (
      def &&
      def.trigger === 'beforeAttack' &&
      def.ui?.activationType === 'passiveTrigger'
    ) {
      passiveAbilities.push({ abilityId, def });
    }
  }
  
  return passiveAbilities;
}

// ============================================================================
// 参数
// ============================================================================

interface UseCellInteractionParams {
  core: SummonerWarsCore;
  dispatch: (type: string, payload?: unknown) => void;
  currentPhase: GamePhase;
  isMyTurn: boolean;
  isGameOver: boolean;
  myPlayerId: string;
  activePlayerId: string;
  myHand: import('../domain/types').Card[];
  fromViewCoord: (coord: CellCoord) => CellCoord;
  /** undo 快照数量（通过 getUndoSnapshotCount 获取），框架层撤回保护必传 */
  undoSnapshotCount: number;
  // 外部模式状态
  abilityMode: AbilityModeState | null;
  setAbilityMode: (mode: AbilityModeState | null) => void;
  soulTransferMode: SoulTransferModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  setMindCaptureMode: (mode: MindCaptureModeState | null) => void;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
  setAfterAttackAbilityMode: (mode: AfterAttackAbilityModeState | null) => void;
  rapidFireMode: import('./modeTypes').RapidFireModeState | null;
  grabFollowMode: import('./useGameEvents').GrabFollowModeState | null;
  setGrabFollowMode: (mode: import('./useGameEvents').GrabFollowModeState | null) => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useCellInteraction({
  core, dispatch, currentPhase, isMyTurn, isGameOver,
  myPlayerId, activePlayerId, myHand, fromViewCoord,
  undoSnapshotCount,
  abilityMode, setAbilityMode, soulTransferMode,
  mindCaptureMode, setMindCaptureMode,
  afterAttackAbilityMode, setAfterAttackAbilityMode,
  rapidFireMode,
  grabFollowMode, setGrabFollowMode,
}: UseCellInteractionParams) {
  const { t } = useTranslation('game-summonerwars');
  const showToast = useToast();

  // ---------- 核心状态 ----------
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardsForDiscard, setSelectedCardsForDiscard] = useState<string[]>([]);
  const [pendingBeforeAttack, setPendingBeforeAttack] = useState<PendingBeforeAttack | null>(null);
  const [magicEventChoiceMode, setMagicEventChoiceMode] = useState<{ cardId: string } | null>(null);
  const [endPhaseConfirmPending, setEndPhaseConfirmPending] = useState(false);
  // 火祀召唤：选中伊路特-巴尔手牌后，先选牺牲品单位
  const [fireSacrificeSummonMode, setFireSacrificeSummonMode] = useState<{ handCardId: string } | null>(null);

  // 离开魔力阶段时自动清空弃牌选中和事件卡选择模式
  useEffect(() => {
    if (currentPhase !== 'magic') {
      setSelectedCardsForDiscard([]);
      setMagicEventChoiceMode(null);
    }
  }, [currentPhase]);

  // ---------- 事件卡模式子 hook ----------
  const eventCardModes = useEventCardModes({
    core, dispatch, currentPhase, myPlayerId, myHand, setSelectedHandCardId,
    soulTransferMode, mindCaptureMode,
    afterAttackAbilityMode, setAfterAttackAbilityMode,
  });

  // ---------- 核心阶段高亮 ----------

  const selectedHandCard = useMemo(() => {
    if (!selectedHandCardId) return null;
    return myHand.find(c => c.id === selectedHandCardId) ?? null;
  }, [selectedHandCardId, myHand]);

  const validSummonPositions = useMemo(() => {
    // 火祀召唤模式：先选牺牲品，不显示普通召唤位置
    if (fireSacrificeSummonMode) return [];
    if (!isMyTurn || !selectedHandCard || selectedHandCard.cardType !== 'unit') return [];
    const player = core.players[myPlayerId as '0' | '1'];
    // 重燃希望：允许在任意阶段召唤
    const hasRekindleHope = player.activeEvents.some(ev =>
      getBaseCardId(ev.id) === CARD_IDS.PALADIN_REKINDLE_HOPE
    );
    if (currentPhase !== 'summon' && !hasRekindleHope) return [];

    const positions = getValidSummonPositions(core, myPlayerId as '0' | '1');
    const posSet = new Set(positions.map(p => `${p.row},${p.col}`));
    const addIfEmpty = (pos: CellCoord) => {
      const key = `${pos.row},${pos.col}`;
      if (!posSet.has(key) && isCellEmpty(core, pos)) {
        posSet.add(key);
        positions.push(pos);
      }
    };

    // 重燃希望：召唤师相邻位置
    if (hasRekindleHope) {
      const summoner = getSummoner(core, myPlayerId as '0' | '1');
      if (summoner) {
        for (const adj of getAdjacentCells(summoner.position)) addIfEmpty(adj);
      }
    }

    // 编织颂歌：目标单位相邻位置
    const cwEvent = player.activeEvents.find(ev =>
      getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_WEAVING && ev.targetUnitId
    );
    if (cwEvent) {
      const targetPos = findUnitPositionByInstanceId(core, cwEvent.targetUnitId!);
      if (targetPos) {
        for (const adj of getAdjacentCells(targetPos)) addIfEmpty(adj);
      }
    }

    return positions;
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard, fireSacrificeSummonMode]);

  const validBuildPositions = useMemo(() => {
    if (currentPhase !== 'build' || !isMyTurn || !selectedHandCard) return [];
    if (selectedHandCard.cardType !== 'structure') return [];
    return getValidBuildPositions(core, myPlayerId as '0' | '1');
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard]);

  // 技能目标位置（复活死灵、感染、结构变换推拉方向、抓附跟随）
  const validAbilityPositions = useMemo(() => {
    // 抓附跟随：移动后的单位相邻的空格
    if (grabFollowMode) {
      const adj = getAdjacentCells(grabFollowMode.movedTo);
      return adj.filter(p => isCellEmpty(core, p));
    }
    if (!abilityMode) return [];
    // 结构变换第二步：选择推拉方向（目标建筑相邻的空格）
    if (abilityMode.abilityId === 'structure_shift' && abilityMode.step === 'selectNewPosition' && abilityMode.targetPosition) {
      const adj = getAdjacentCells(abilityMode.targetPosition);
      return adj.filter(p => isCellEmpty(core, p));
    }
    // 寒冰冲撞第二步：选择推拉方向（目标单位相邻的空格）
    if (abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection' && abilityMode.targetPosition) {
      const adj = getAdjacentCells(abilityMode.targetPosition);
      return adj.filter(p => isCellEmpty(core, p));
    }
    if (abilityMode.step !== 'selectPosition') return [];
    if (abilityMode.abilityId === 'revive_undead') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const adj: CellCoord[] = [
        { row: sourcePos.row - 1, col: sourcePos.col },
        { row: sourcePos.row + 1, col: sourcePos.col },
        { row: sourcePos.row, col: sourcePos.col - 1 },
        { row: sourcePos.row, col: sourcePos.col + 1 },
      ];
      return adj.filter(p => isCellEmpty(core, p));
    }
    if (abilityMode.abilityId === 'infection' && abilityMode.targetPosition) {
      return [abilityMode.targetPosition];
    }
    return [];
  }, [abilityMode, core, grabFollowMode]);

  // 技能可选单位（火祀召唤、吸取生命、幻化、结构变换等）
  const validAbilityUnits = useMemo(() => {
    // 火祀召唤：选中伊路特-巴尔手牌后，高亮所有可牺牲的友方单位（非召唤师，任意位置）
    if (fireSacrificeSummonMode) {
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => u.card.unitClass !== 'summoner')
        .map(u => u.position);
    }
    if (!abilityMode || abilityMode.step !== 'selectUnit') return [];
    if (abilityMode.abilityId === 'life_drain') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => {
          if (u.instanceId === abilityMode.sourceUnitId) return false;
          return manhattanDistance(sourcePos, u.position) <= 2;
        })
        .map(u => u.position);
    }
    // 幻化：3格内的士兵（任意阵营）
    if (abilityMode.abilityId === 'illusion') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const targets: CellCoord[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (!unit) continue;
          if (unit.card.unitClass !== 'common') continue;
          const dist = manhattanDistance(sourcePos, { row, col });
          if (dist > 0 && dist <= 3) {
            targets.push({ row, col });
          }
        }
      }
      return targets;
    }
    // 喂养巨食兽：相邻友方单位（非自身）
    if (abilityMode.abilityId === 'feed_beast') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const adj = getAdjacentCells(sourcePos);
      return adj.filter(p => {
        const unit = core.board[p.row]?.[p.col]?.unit;
        return unit && unit.owner === (myPlayerId as '0' | '1') && unit.instanceId !== abilityMode.sourceUnitId;
      });
    }
    // 寒冰冲撞：建筑新位置相邻的所有单位（任意阵营）
    if (abilityMode.abilityId === 'ice_ram' && abilityMode.structurePosition) {
      const sp = abilityMode.structurePosition;
      const adj = getAdjacentCells(sp);
      return adj.filter(p => !!core.board[p.row]?.[p.col]?.unit);
    }
    // 结构变换：3格内友方建筑（含活体结构单位如寒冰魔像）
    if (abilityMode.abilityId === 'structure_shift') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const targets: CellCoord[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const pos = { row, col };
          const structure = getStructureAt(core, pos);
          const unit = core.board[row]?.[col]?.unit;
          const isAllyStructure = (structure && structure.owner === (myPlayerId as '0' | '1'))
            || (unit && unit.owner === (myPlayerId as '0' | '1')
              && getUnitAbilities(unit, core).includes('mobile_structure'));
          if (isAllyStructure) {
            const dist = manhattanDistance(sourcePos, pos);
            if (dist > 0 && dist <= 3) targets.push(pos);
          }
        }
      }
      return targets;
    }
    // 神出鬼没：全场0费友方单位（非自身）
    if (abilityMode.abilityId === 'vanish') {
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => u.instanceId !== abilityMode.sourceUnitId && u.card.cost === 0)
        .map(u => u.position);
    }
    // 冰霜战斧：3格内友方士兵（非自身），充能不足时不高亮（禁止点击释放）
    if (abilityMode.abilityId === 'frost_axe') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const sourceUnit = core.board[sourcePos.row]?.[sourcePos.col]?.unit;
      if (!sourceUnit || (sourceUnit.boosts ?? 0) < 1) return [];
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => {
          if (u.instanceId === abilityMode.sourceUnitId) return false;
          if (u.card.unitClass !== 'common') return false;
          return manhattanDistance(sourcePos, u.position) <= 3;
        })
        .map(u => u.position);
    }
    // 祖灵羁绊 / 祖灵交流(transfer)：3格内友方单位（非自身）
    if (abilityMode.abilityId === 'ancestral_bond' || abilityMode.abilityId === 'spirit_bond') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      // spirit_bond 转移需要充能，充能不足时不高亮目标
      if (abilityMode.abilityId === 'spirit_bond') {
        const sourceUnit = core.board[sourcePos.row]?.[sourcePos.col]?.unit;
        if (!sourceUnit || (sourceUnit.boosts ?? 0) < 1) return [];
      }
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => {
          if (u.instanceId === abilityMode.sourceUnitId) return false;
          return manhattanDistance(sourcePos, u.position) <= 3;
        })
        .map(u => u.position);
    }
    // 高阶念力（代替攻击）：3格内非召唤师单位（排除稳固）
    if (abilityMode.abilityId === 'high_telekinesis_instead') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const targets: CellCoord[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (!unit || unit.card.unitClass === 'summoner') continue;
          if (hasStableAbility(unit, core)) continue;
          const dist = manhattanDistance(sourcePos, { row, col });
          if (dist > 0 && dist <= 3) {
            targets.push({ row, col });
          }
        }
      }
      return targets;
    }
    // 念力（代替攻击）：2格内非召唤师单位（排除稳固）
    if (abilityMode.abilityId === 'telekinesis_instead') {
      const sourcePos = findUnitPositionByInstanceId(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const targets: CellCoord[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (!unit || unit.card.unitClass === 'summoner') continue;
          if (hasStableAbility(unit, core)) continue;
          const dist = manhattanDistance(sourcePos, { row, col });
          if (dist > 0 && dist <= 2) {
            targets.push({ row, col });
          }
        }
      }
      return targets;
    }
    return [];
  }, [abilityMode, core, myPlayerId, fireSacrificeSummonMode]);

  // 获取可移动位置
  const validMovePositions = useMemo(() => {
    if (currentPhase !== 'move' || !isMyTurn || !core.selectedUnit) return [];
    return getValidMoveTargetsEnhanced(core, core.selectedUnit);
  }, [core, currentPhase, isMyTurn]);

  // 获取可攻击位置
  const validAttackPositions = useMemo(() => {
    if (!isMyTurn || !core.selectedUnit) return [];
    const selectedUnit = core.board[core.selectedUnit.row]?.[core.selectedUnit.col]?.unit;
    // 非攻击阶段：只有拥有 extraAttacks 的单位或有跨阶段攻击权限时才计算攻击目标
    if (currentPhase !== 'attack') {
      const hasExtraAttacks = selectedUnit && (selectedUnit.extraAttacks ?? 0) > 0;
      const player = core.players[myPlayerId as '0' | '1'];
      const hasRallyingCry = player?.activeEvents.some(
        e => getBaseCardId(e.id) === CARD_IDS.BARBARIC_RALLYING_CRY && e.isActive
      );
      if (!hasExtraAttacks && !hasRallyingCry) return [];
    }
    const baseTargets = getValidAttackTargetsEnhanced(core, core.selectedUnit);
    const hasHealingBeforeAttack = pendingBeforeAttack
      && selectedUnit
      && pendingBeforeAttack.sourceUnitId === selectedUnit.instanceId
      && pendingBeforeAttack.abilityId === 'healing';
    if (!selectedUnit || (!selectedUnit.healingMode && !hasHealingBeforeAttack)) {
      return baseTargets;
    }
    const extendedTargets = [...baseTargets];
    const seen = new Set(extendedTargets.map(p => `${p.row}-${p.col}`));
    const candidates = getPlayerUnits(core, myPlayerId as '0' | '1');
    for (const u of candidates) {
      if (u.owner !== (myPlayerId as '0' | '1')) continue;
      if (u.card.unitClass !== 'common' && u.card.unitClass !== 'champion') continue;
      const dist = manhattanDistance(core.selectedUnit, u.position);
      if (dist !== 1) continue;
      const key = `${u.position.row}-${u.position.col}`;
      if (!seen.has(key)) {
        seen.add(key);
        extendedTargets.push(u.position);
      }
    }
    return extendedTargets;
  }, [core, currentPhase, isMyTurn, myPlayerId, pendingBeforeAttack]);

  // 可以使用技能的单位（青色 + 波纹）
  const abilityReadyPositions = useMemo(() => {
    if (!isMyTurn) return [];
    
    const hints = getSummonerWarsUIHints(core, {
      types: ['ability'],
      playerId: myPlayerId,
      phase: currentPhase,
    });
    
    return extractPositions(hints);
  }, [core, currentPhase, isMyTurn, myPlayerId]);

  // 可以移动/攻击的单位（绿色边框）
  const actionableUnitPositions = useMemo(() => {
    if (!isMyTurn) return [];
    
    const hints = getSummonerWarsUIHints(core, {
      types: ['actionable'],
      playerId: myPlayerId,
      phase: currentPhase,
    });
    
    return extractPositions(hints);
  }, [core, currentPhase, isMyTurn, myPlayerId]);

  // 攻击前技能状态
  const activeBeforeAttack = useMemo(() => {
    if (!pendingBeforeAttack || !core.selectedUnit) return null;
    const unit = core.board[core.selectedUnit.row]?.[core.selectedUnit.col]?.unit;
    if (!unit) return null;
    if (unit.instanceId !== pendingBeforeAttack.sourceUnitId) return null;
    return pendingBeforeAttack;
  }, [core, pendingBeforeAttack]);

  useEffect(() => {
    if (!pendingBeforeAttack) return;
    if (currentPhase !== 'attack') {
      setPendingBeforeAttack(null);
      return;
    }
    if (!core.selectedUnit) {
      setPendingBeforeAttack(null);
      return;
    }
    const unit = core.board[core.selectedUnit.row]?.[core.selectedUnit.col]?.unit;
    if (!unit || unit.instanceId !== pendingBeforeAttack.sourceUnitId) {
      setPendingBeforeAttack(null);
    }
  }, [currentPhase, core, pendingBeforeAttack]);

  // ---------- 格子点击 ----------

  const handleCellClick = useCallback((row: number, col: number) => {
    const { row: gameRow, col: gameCol } = fromViewCoord({ row, col });

    // 任何格子交互都重置结束阶段确认状态
     
    setEndPhaseConfirmPending(false);

    // 事件卡/多步骤模式优先处理
    if (eventCardModes.handleEventModeClick(gameRow, gameCol)) return;

    // 技能选卡模式（圣光箭/治疗弃牌选择）：拦截格子点击，防止重复触发
    if (abilityMode && abilityMode.step === 'selectCards') {
      return; // 选卡模式下只允许手牌交互，不响应棋盘点击
    }

    // 技能单位选择模式（火祀召唤、吸取生命、幻化、结构变换等）
    if (abilityMode && abilityMode.step === 'selectUnit') {
      const isValid = validAbilityUnits.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        // 寒冰冲撞：选择目标后进入推拉方向选择
        if (abilityMode.abilityId === 'ice_ram') {
          setAbilityMode({
            ...abilityMode,
            step: 'selectPushDirection',
            targetPosition: { row: gameRow, col: gameCol },
          });
          return;
        }
        // 结构变换目标是建筑，进入选择推拉方向步骤
        if (abilityMode.abilityId === 'structure_shift') {
          setAbilityMode({
            ...abilityMode,
            step: 'selectNewPosition',
            targetPosition: { row: gameRow, col: gameCol },
          });
          return;
        }
        const targetUnit = core.board[gameRow]?.[gameCol]?.unit;
        if (targetUnit) {
          if (abilityMode.context === 'beforeAttack') {
            // ✅ 被动触发模式：选择目标后立即发送攻击命令
            if (abilityMode.pendingAttackTarget && core.selectedUnit) {
              dispatch(SW_COMMANDS.DECLARE_ATTACK, {
                attacker: core.selectedUnit,
                target: abilityMode.pendingAttackTarget,
                beforeAttack: {
                  abilityId: abilityMode.abilityId as PendingBeforeAttack['abilityId'],
                  targetUnitId: targetUnit.instanceId,
                },
              });
              setAbilityMode(null);
              setPendingBeforeAttack(null);
            } else {
              // 旧流程：设置 pendingBeforeAttack（等待玩家点击攻击目标）
              setPendingBeforeAttack({
                abilityId: abilityMode.abilityId as PendingBeforeAttack['abilityId'],
                sourceUnitId: abilityMode.sourceUnitId,
                targetUnitId: targetUnit.instanceId,
              });
            }
          } else if (abilityMode.abilityId === 'illusion') {
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: 'illusion',
              sourceUnitId: abilityMode.sourceUnitId,
              targetPosition: { row: gameRow, col: gameCol },
              _noSnapshot: true,
            });
          } else if (abilityMode.abilityId === 'ancestral_bond') {
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: 'ancestral_bond',
              sourceUnitId: abilityMode.sourceUnitId,
              targetPosition: { row: gameRow, col: gameCol },
              _noSnapshot: true,
            });
          } else if (abilityMode.abilityId === 'spirit_bond') {
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: 'spirit_bond',
              sourceUnitId: abilityMode.sourceUnitId,
              choice: 'transfer',
              targetPosition: { row: gameRow, col: gameCol },
              _noSnapshot: true,
            });
          } else if (abilityMode.abilityId === 'frost_axe') {
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: 'frost_axe',
              sourceUnitId: abilityMode.sourceUnitId,
              choice: 'attach',
              targetPosition: { row: gameRow, col: gameCol },
              _noSnapshot: true,
            });
          } else if (abilityMode.abilityId === 'feed_beast') {
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: 'feed_beast',
              sourceUnitId: abilityMode.sourceUnitId,
              choice: 'destroy_adjacent',
              targetPosition: { row: gameRow, col: gameCol },
              _noSnapshot: true,
            });
          } else if (abilityMode.abilityId === 'vanish') {
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: 'vanish',
              sourceUnitId: abilityMode.sourceUnitId,
              targetPosition: { row: gameRow, col: gameCol },
            });
          } else if (abilityMode.abilityId === 'high_telekinesis_instead') {
            // 高阶念力（代替攻击）：选择目标后计算所有可达终点，进入棋盘点击终点模式
            const htTargetPos = { row: gameRow, col: gameCol };
            const htDests = getForceDestinations(core, htTargetPos, 1);
            setAbilityMode(null);
            eventCardModes.setTelekinesisTargetMode({
              abilityId: 'high_telekinesis_instead',
              sourceUnitId: abilityMode.sourceUnitId,
              sourcePosition: findUnitPositionByInstanceId(core, abilityMode.sourceUnitId) ?? undefined,
              targetPosition: htTargetPos,
              destinations: htDests,
            });
            return;
          } else if (abilityMode.abilityId === 'telekinesis_instead') {
            // 念力（代替攻击）：选择目标后计算所有可达终点，进入棋盘点击终点模式
            const tkTargetPos = { row: gameRow, col: gameCol };
            const tkDests = getForceDestinations(core, tkTargetPos, 1);
            setAbilityMode(null);
            eventCardModes.setTelekinesisTargetMode({
              abilityId: 'telekinesis_instead',
              sourceUnitId: abilityMode.sourceUnitId,
              sourcePosition: findUnitPositionByInstanceId(core, abilityMode.sourceUnitId) ?? undefined,
              targetPosition: tkTargetPos,
              destinations: tkDests,
            });
            return;
          } else {
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: abilityMode.abilityId,
              sourceUnitId: abilityMode.sourceUnitId,
              targetUnitId: targetUnit.instanceId,
            });
          }
          setAbilityMode(null);
        }
      }
      return;
    }

    // 抓附跟随：选择跟随目标位置
    if (grabFollowMode) {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
          abilityId: 'grab',
          sourceUnitId: grabFollowMode.grabberUnitId,
          targetPosition: { row: gameRow, col: gameCol },
          _noSnapshot: true,
        });
        setGrabFollowMode(null);
      }
      return;
    }

    // 结构变换第二步：选择推拉方向
    if (abilityMode && abilityMode.abilityId === 'structure_shift' && abilityMode.step === 'selectNewPosition') {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid && abilityMode.targetPosition) {
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
          abilityId: 'structure_shift',
          sourceUnitId: abilityMode.sourceUnitId,
          targetPosition: abilityMode.targetPosition,
          newPosition: { row: gameRow, col: gameCol },
          _noSnapshot: true,
        });
        setAbilityMode(null);
      }
      return;

    // 寒冰冲撞第二步：选择推拉方向（或跳过）
    } else if (abilityMode && abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection') {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid && abilityMode.targetPosition && abilityMode.structurePosition) {
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
          abilityId: 'ice_ram',
          sourceUnitId: 'ice_ram',
          targetPosition: abilityMode.targetPosition,
          structurePosition: abilityMode.structurePosition,
          pushNewPosition: { row: gameRow, col: gameCol },
          _noSnapshot: true,
        });
        setAbilityMode(null);
      }
      return;
    }

    // 技能目标选择模式（复活死灵、感染）
    if (abilityMode && abilityMode.step === 'selectPosition') {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
          abilityId: abilityMode.abilityId,
          sourceUnitId: abilityMode.sourceUnitId,
          targetCardId: abilityMode.selectedCardId,
          targetPosition: { row: gameRow, col: gameCol },
        });
        setAbilityMode(null);
      }
      return;
    }

    // 召唤阶段：点击拥有复活死灵技能的单位
    if (currentPhase === 'summon' && !selectedHandCardId) {
      const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
      if (clickedUnit && clickedUnit.owner === myPlayerId) {
        const abilities = getUnitAbilities(clickedUnit, core);
        if (abilities.includes('revive_undead')) {
          const hasUndeadInDiscard = core.players[myPlayerId]?.discard.some(c =>
            isUndeadCard(c)
          );
          if (hasUndeadInDiscard) {
            setAbilityMode({ abilityId: 'revive_undead', step: 'selectCard', sourceUnitId: clickedUnit.instanceId });
            return;
          }
        }
      }
    }

    // 火祀召唤：选中牺牲品单位后，直接召唤到牺牲品位置
    if (currentPhase === 'summon' && fireSacrificeSummonMode) {
      const isValidSacrifice = validAbilityUnits.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidSacrifice) {
        const sacrificeUnit = core.board[gameRow]?.[gameCol]?.unit;
        if (sacrificeUnit) {
          // 位置传牺牲品位置（validate/execute 会用 sacrificeUnitId 覆盖）
          dispatch(SW_COMMANDS.SUMMON_UNIT, {
            cardId: fireSacrificeSummonMode.handCardId,
            position: { row: gameRow, col: gameCol },
            sacrificeUnitId: sacrificeUnit.instanceId,
          });
          setFireSacrificeSummonMode(null);
          setSelectedHandCardId(null);
        }
      } else {
        showToast.warning(t('interaction.fireSacrifice.mustSelectAlly'));
      }
      return;
    }

    // 召唤阶段：执行召唤
    if (currentPhase === 'summon' && selectedHandCardId) {
      const isValidPosition = validSummonPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidPosition) {
        dispatch(SW_COMMANDS.SUMMON_UNIT, { cardId: selectedHandCardId, position: { row: gameRow, col: gameCol } });
      } else {
        showToast.warning(t('interaction.cannotSummonThere'));
      }
      setSelectedHandCardId(null);
      return;
    }

    // 建造阶段
    if (currentPhase === 'build' && selectedHandCardId) {
      const isValidPosition = validBuildPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidPosition) {
        dispatch(SW_COMMANDS.BUILD_STRUCTURE, { cardId: selectedHandCardId, position: { row: gameRow, col: gameCol } });
      } else {
        showToast.warning(t('interaction.cannotBuildThere'));
      }
      setSelectedHandCardId(null);
      return;
    }

    // 移动阶段
    if (currentPhase === 'move') {
      if (core.selectedUnit) {
        if (gameRow === core.selectedUnit.row && gameCol === core.selectedUnit.col) {
          dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: -1, col: -1 } });
          return;
        }
        const isValidMove = validMovePositions.some(p => p.row === gameRow && p.col === gameCol);
        if (isValidMove) {
          dispatch(SW_COMMANDS.MOVE_UNIT, { from: core.selectedUnit, to: { row: gameRow, col: gameCol } });
        } else {
          const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
          if (clickedUnit && clickedUnit.owner === myPlayerId) {
            dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: gameRow, col: gameCol } });
          } else {
            if (!clickedUnit || clickedUnit.owner !== myPlayerId) {
              showToast.warning(t('interaction.cannotMoveThere'));
            }
            dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: -1, col: -1 } });
          }
        }
      } else {
        dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: gameRow, col: gameCol } });
      }
      return;
    }

    // 攻击阶段（或有跨阶段攻击权限时）
    const hasExtraAttackTargets = validAttackPositions.length > 0;
    if (currentPhase === 'attack' || hasExtraAttackTargets) {
      if (core.selectedUnit) {
        if (gameRow === core.selectedUnit.row && gameCol === core.selectedUnit.col) {
          dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: -1, col: -1 } });
          return;
        }
        const isValidAttack = validAttackPositions.some(p => p.row === gameRow && p.col === gameCol);
        if (isValidAttack) {
          const attackerUnit = core.board[core.selectedUnit.row]?.[core.selectedUnit.col]?.unit;
          
          // ✅ 检测被动触发能力（仅当没有已激活的 beforeAttack 时）
          if (attackerUnit && !activeBeforeAttack) {
            const passiveAbilities = getPassiveBeforeAttackAbilities(attackerUnit, core);
            
            if (passiveAbilities.length > 0) {
              // 自动进入被动触发模式（暂时只处理第一个能力）
              const firstAbility = passiveAbilities[0];
              
              // 根据能力类型设置 abilityMode
              if (firstAbility.abilityId === 'holy_arrow' || firstAbility.abilityId === 'healing') {
                setAbilityMode({
                  abilityId: firstAbility.abilityId,
                  sourceUnitId: attackerUnit.instanceId,
                  step: 'selectCards',
                  context: 'beforeAttack',
                  selectedCardIds: [],
                  pendingAttackTarget: { row: gameRow, col: gameCol }, // ✅ 记住攻击目标
                });
              } else if (firstAbility.abilityId === 'life_drain') {
                setAbilityMode({
                  abilityId: firstAbility.abilityId,
                  sourceUnitId: attackerUnit.instanceId,
                  step: 'selectUnit',
                  context: 'beforeAttack',
                  pendingAttackTarget: { row: gameRow, col: gameCol }, // ✅ 记住攻击目标
                });
              }
              return; // ✅ 不立即发送攻击命令
            }
          }
          
          // 没有被动触发能力，或已处理完毕，直接攻击
          dispatch(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: core.selectedUnit,
            target: { row: gameRow, col: gameCol },
            beforeAttack: activeBeforeAttack
              ? {
                abilityId: activeBeforeAttack.abilityId,
                targetUnitId: activeBeforeAttack.targetUnitId,
                targetCardId: activeBeforeAttack.targetCardId,
                discardCardIds: activeBeforeAttack.discardCardIds,
              }
              : undefined,
          });
          if (activeBeforeAttack) {
            setPendingBeforeAttack(null);
          }
        } else {
          const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
          if (clickedUnit && clickedUnit.owner === myPlayerId) {
            dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: gameRow, col: gameCol } });
          } else {
            if (clickedUnit && clickedUnit.owner !== myPlayerId) {
              showToast.warning(t('interaction.cannotAttackThere'));
            }
            dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: -1, col: -1 } });
          }
        }
      } else {
        dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: gameRow, col: gameCol } });
      }
      return;
    }

    // 其他阶段：普通选择
    dispatch(SW_COMMANDS.SELECT_UNIT, { position: { row: gameRow, col: gameCol } });
  }, [core, dispatch, currentPhase, selectedHandCardId, validSummonPositions, validBuildPositions,
    validMovePositions, validAttackPositions, myPlayerId, fromViewCoord,
    abilityMode, validAbilityPositions, validAbilityUnits,
    fireSacrificeSummonMode,
    eventCardModes.handleEventModeClick,
    eventCardModes.setTelekinesisTargetMode,
    activeBeforeAttack]);

  // ---------- 手牌交互 ----------

  // 手牌点击（魔力阶段弃牌多选/攻击前弃牌）
  const handleCardClick = useCallback((cardId: string) => {
    setEndPhaseConfirmPending(false);

    // 魔力阶段事件卡选择模式：点击事件卡进入选择模式
    if (currentPhase === 'magic' && isMyTurn) {
      const card = myHand.find(c => c.id === cardId);
      if (card && card.cardType === 'event') {
        const event = card as import('../domain/types').EventCard;
        const cost = event.cost;
        const currentMagic = core.players[myPlayerId as '0' | '1'].magic;
        const canAfford = cost <= currentMagic;
        if ((event.playPhase === 'magic' || event.playPhase === 'any') && canAfford) {
          // 进入选择模式：打出或弃牌
          setMagicEventChoiceMode({ cardId });
          return;
        }
      }
    }

    if (abilityMode && abilityMode.step === 'selectCards') {
      const card = myHand.find(c => c.id === cardId);
      if (!card) return;
      const selected = abilityMode.selectedCardIds ?? [];
      const isSelected = selected.includes(cardId);
      if (isSelected) {
        setAbilityMode({ ...abilityMode, selectedCardIds: selected.filter(id => id !== cardId) });
        return;
      }
      if (abilityMode.abilityId === 'holy_arrow') {
        if (card.cardType !== 'unit') {
          showToast.warning(t('handArea.holyArrowUnitOnly'));
          return;
        }
        const sourceUnit = core.board.flat().map(c => c.unit).find(u => u?.instanceId === abilityMode.sourceUnitId);
        if (sourceUnit && card.name === sourceUnit.card.name) {
          showToast.warning(t('handArea.noSameNameDiscard'));
          return;
        }
        const names = new Set(
          selected
            .map(id => myHand.find(c => c.id === id))
            .filter((c): c is UnitCard => !!c && c.cardType === 'unit')
            .map(c => c.name)
        );
        if (card.cardType === 'unit' && names.has(card.name)) {
          showToast.warning(t('handArea.noDuplicateNameDiscard'));
          return;
        }
        setAbilityMode({ ...abilityMode, selectedCardIds: [...selected, cardId] });
        return;
      }
      if (abilityMode.abilityId === 'healing') {
        setAbilityMode({ ...abilityMode, selectedCardIds: [cardId] });
        return;
      }
      setAbilityMode({ ...abilityMode, selectedCardIds: [...selected, cardId] });
      return;
    }
    if (currentPhase === 'magic' && isMyTurn) {
      setSelectedCardsForDiscard(prev =>
        prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
      );
    }
  }, [abilityMode, core, currentPhase, isMyTurn, myHand, myPlayerId, setAbilityMode, setMagicEventChoiceMode, showToast, t]);

  // 手牌选中（召唤/建造阶段单选）
  const handleCardSelect = useCallback((cardId: string | null) => {
    setEndPhaseConfirmPending(false);

    // 血契召唤 selectCard 步骤：选中要召唤的单位卡
    if (eventCardModes.bloodSummonMode?.step === 'selectCard' && cardId) {
      const card = myHand.find(c => c.id === cardId);
      if (card && card.cardType === 'unit' && (card as UnitCard).cost <= 2) {
        eventCardModes.setBloodSummonMode({ ...eventCardModes.bloodSummonMode, step: 'selectPosition', summonCardId: cardId });
        setSelectedHandCardId(cardId);
        return;
      }
    }

    // 如果点击的是已选中的卡牌，取消选中
    if (cardId && selectedHandCardId === cardId) {
      setSelectedHandCardId(null);
      setFireSacrificeSummonMode(null);
      return;
    }

    // 选中其他手牌时，自动取消所有多步骤事件卡模式
    if (eventCardModes.hasActiveEventMode && cardId) {
      eventCardModes.clearAllEventModes();
    }

    // 火祀召唤：选中伊路特-巴尔时，进入牺牲品选择模式
    if (cardId && currentPhase === 'summon' && isMyTurn) {
      const card = myHand.find(c => c.id === cardId);
      if (card && card.cardType === 'unit' && (card as UnitCard).abilities?.includes('fire_sacrifice_summon')) {
        const hasAlly = getPlayerUnits(core, myPlayerId as '0' | '1').some(u => u.card.unitClass !== 'summoner');
        if (hasAlly) {
          setFireSacrificeSummonMode({ handCardId: cardId });
          setSelectedHandCardId(cardId);
          return;
        }
      }
    }

    setFireSacrificeSummonMode(null);
    setSelectedHandCardId(cardId);
  }, [eventCardModes.bloodSummonMode, myHand, eventCardModes.hasActiveEventMode, eventCardModes.clearAllEventModes, selectedHandCardId, currentPhase, isMyTurn, core, myPlayerId]);

  // 确认弃牌换魔力
  const handleConfirmDiscard = useCallback(() => {
    if (selectedCardsForDiscard.length > 0) {
      dispatch(SW_COMMANDS.DISCARD_FOR_MAGIC, { cardIds: selectedCardsForDiscard });
      setSelectedCardsForDiscard([]);
    }
  }, [dispatch, selectedCardsForDiscard]);

  // ---------- 阶段控制 ----------

  useEffect(() => { setEndPhaseConfirmPending(false); }, [currentPhase]);

  // 强制技能模式：这些技能没有"跳过"选项，必须完成后才能推进阶段
  const isMandatoryAbilityActive = !!abilityMode && ['blood_rune', 'feed_beast'].includes(abilityMode.abilityId);

  const handleEndPhase = useCallback(() => {
    // 强制技能激活时禁止推进阶段（如鲜血符文必须二选一）
    if (isMandatoryAbilityActive) return;
    // 非自己回合时禁止操作（防止快速点击越过回合边界）
    if (!isMyTurn) return;
    if (eventCardModes.hasActiveEventMode) {
      eventCardModes.clearAllEventModes();
    }
    if (magicEventChoiceMode) {
      setMagicEventChoiceMode(null);
    }
    if (endPhaseConfirmPending) {
      setEndPhaseConfirmPending(false);
      dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {});
      return;
    }
    if ((currentPhase === 'move' || currentPhase === 'attack') && actionableUnitPositions.length > 0) {
      setEndPhaseConfirmPending(true);
      return;
    }
    dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {});
  }, [dispatch, currentPhase, actionableUnitPositions.length, endPhaseConfirmPending,
    eventCardModes.hasActiveEventMode, eventCardModes.clearAllEventModes, magicEventChoiceMode,
    isMandatoryAbilityActive, isMyTurn]);

  // ---------- 外部技能确认 ----------

  const handleConfirmMindCapture = useCallback((choice: 'control' | 'damage') => {
    if (!mindCaptureMode) return;
    dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'mind_capture_resolve',
      sourceUnitId: mindCaptureMode.sourceUnitId,
      choice,
      targetPosition: mindCaptureMode.targetPosition,
      hits: mindCaptureMode.hits,
      _noSnapshot: true,
    });
    setMindCaptureMode(null);
  }, [dispatch, mindCaptureMode, setMindCaptureMode]);

  const handleConfirmBeforeAttackCards = useCallback(() => {
    if (!abilityMode || abilityMode.step !== 'selectCards') return;
    const selected = abilityMode.selectedCardIds ?? [];
    
    if (abilityMode.abilityId === 'holy_arrow') {
      // "任意数量"包括 0，允许不选择任何卡直接确认
      
      // 有 pendingAttackTarget 时立即发送攻击命令
      if (abilityMode.pendingAttackTarget && core.selectedUnit) {
        dispatch(SW_COMMANDS.DECLARE_ATTACK, {
          attacker: core.selectedUnit,
          target: abilityMode.pendingAttackTarget,
          beforeAttack: selected.length > 0 ? {
            abilityId: 'holy_arrow',
            discardCardIds: selected,
          } : undefined,
        });
        setAbilityMode(null);
        setPendingBeforeAttack(null);
        return;
      }
      
      // 旧流程（无 pendingAttackTarget）
      if (selected.length > 0) {
        setPendingBeforeAttack({
          abilityId: 'holy_arrow',
          sourceUnitId: abilityMode.sourceUnitId,
          discardCardIds: selected,
        });
      }
    }
    
    if (abilityMode.abilityId === 'healing') {
      // "你可以"弃牌，允许不选择任何卡直接确认
      
      // 有 pendingAttackTarget 时立即发送攻击命令
      if (abilityMode.pendingAttackTarget && core.selectedUnit) {
        dispatch(SW_COMMANDS.DECLARE_ATTACK, {
          attacker: core.selectedUnit,
          target: abilityMode.pendingAttackTarget,
          beforeAttack: selected.length > 0 ? {
            abilityId: 'healing',
            targetCardId: selected[0],
          } : undefined,
        });
        setAbilityMode(null);
        setPendingBeforeAttack(null);
        return;
      }
      
      // 旧流程（无 pendingAttackTarget）
      if (selected.length > 0) {
        setPendingBeforeAttack({
          abilityId: 'healing',
          sourceUnitId: abilityMode.sourceUnitId,
          targetCardId: selected[0],
        });
      }
    }
    
    setAbilityMode(null);
  }, [abilityMode, core, dispatch, showToast, t]);

  const handleCancelBeforeAttack = useCallback(() => {
    // ✅ 如果是被动触发模式（有 pendingAttackTarget），跳过能力并直接攻击
    if (abilityMode && abilityMode.pendingAttackTarget && core.selectedUnit) {
      dispatch(SW_COMMANDS.DECLARE_ATTACK, {
        attacker: core.selectedUnit,
        target: abilityMode.pendingAttackTarget,
      });
      setAbilityMode(null);
      setPendingBeforeAttack(null);
      return;
    }
    
    // 否则只是取消 pendingBeforeAttack
    setPendingBeforeAttack(null);
  }, [abilityMode, core, dispatch]);

  // ---------- 自动跳过 ----------

  // 存在活跃的交互模式时禁止自动跳过（玩家正在进行多步骤操作）
  const hasActiveInteraction = eventCardModes.hasActiveEventMode
    || !!eventCardModes.funeralPyreMode
    || !!soulTransferMode
    || !!mindCaptureMode
    || !!afterAttackAbilityMode
    || !!abilityMode
    || !!rapidFireMode
    || !!magicEventChoiceMode;

  // 全局禁用开关（调试用）
  const debugDisabled = typeof window !== 'undefined'
    && (window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean }).__SW_DISABLE_AUTO_SKIP__;

  const advancePhase = useCallback(() => {
    dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {});
  }, [dispatch]);

  useAutoSkipPhase({
    isMyTurn,
    isGameOver,
    hasAvailableActions: hasAvailableActions(core, activePlayerId as '0' | '1'),
    hasActiveInteraction,
    advancePhase,
    enabled: !!core.hostStarted && !debugDisabled,
    undoSnapshotCount,
  });

  // 魔力阶段事件卡选择回调
  const handlePlayMagicEvent = useCallback(() => {
    if (!magicEventChoiceMode) return;
    eventCardModes.handlePlayEvent(magicEventChoiceMode.cardId);
    setMagicEventChoiceMode(null);
  }, [magicEventChoiceMode, eventCardModes.handlePlayEvent]);

  const handleDiscardMagicEvent = useCallback(() => {
    if (!magicEventChoiceMode) return;
    dispatch(SW_COMMANDS.DISCARD_FOR_MAGIC, { cardIds: [magicEventChoiceMode.cardId] });
    setMagicEventChoiceMode(null);
  }, [magicEventChoiceMode, dispatch]);

  const handleCancelMagicEventChoice = useCallback(() => {
    setMagicEventChoiceMode(null);
  }, []);

  // ---------- 返回 ----------

  return {
    // 状态
    selectedHandCardId, selectedCardsForDiscard,
    endPhaseConfirmPending, setEndPhaseConfirmPending,
    pendingBeforeAttack,
    magicEventChoiceMode,
    setMagicEventChoiceMode,
    abilitySelectedCardIds: abilityMode?.step === 'selectCards' ? (abilityMode.selectedCardIds ?? []) : [],
    // 事件卡模式（透传）
    eventTargetMode: eventCardModes.eventTargetMode,
    bloodSummonMode: eventCardModes.bloodSummonMode,
    setBloodSummonMode: eventCardModes.setBloodSummonMode,
    annihilateMode: eventCardModes.annihilateMode,
    setAnnihilateMode: eventCardModes.setAnnihilateMode,
    funeralPyreMode: eventCardModes.funeralPyreMode,
    setFuneralPyreMode: eventCardModes.setFuneralPyreMode,
    mindControlMode: eventCardModes.mindControlMode,
    setMindControlMode: eventCardModes.setMindControlMode,
    stunMode: eventCardModes.stunMode,
    setStunMode: eventCardModes.setStunMode,
    hypnoticLureMode: eventCardModes.hypnoticLureMode,
    setHypnoticLureMode: eventCardModes.setHypnoticLureMode,
    chantEntanglementMode: eventCardModes.chantEntanglementMode,
    setChantEntanglementMode: eventCardModes.setChantEntanglementMode,
    sneakMode: eventCardModes.sneakMode,
    setSneakMode: eventCardModes.setSneakMode,
    glacialShiftMode: eventCardModes.glacialShiftMode,
    setGlacialShiftMode: eventCardModes.setGlacialShiftMode,
    withdrawMode: eventCardModes.withdrawMode,
    setWithdrawMode: eventCardModes.setWithdrawMode,
    telekinesisTargetMode: eventCardModes.telekinesisTargetMode,
    setTelekinesisTargetMode: eventCardModes.setTelekinesisTargetMode,
    // 计算值
    validSummonPositions, validBuildPositions, validMovePositions, validAttackPositions,
    validAbilityPositions, validAbilityUnits, actionableUnitPositions, abilityReadyPositions,
    fireSacrificeSummonMode,
    validEventTargets: eventCardModes.validEventTargets,
    bloodSummonHighlights: eventCardModes.bloodSummonHighlights,
    annihilateHighlights: eventCardModes.annihilateHighlights,
    mindControlHighlights: eventCardModes.mindControlHighlights,
    entanglementHighlights: eventCardModes.entanglementHighlights,
    sneakHighlights: eventCardModes.sneakHighlights,
    glacialShiftHighlights: eventCardModes.glacialShiftHighlights,
    withdrawHighlights: eventCardModes.withdrawHighlights,
    stunHighlights: eventCardModes.stunHighlights,
    hypnoticLureHighlights: eventCardModes.hypnoticLureHighlights,
    afterAttackAbilityHighlights: eventCardModes.afterAttackAbilityHighlights,
    telekinesisHighlights: eventCardModes.telekinesisHighlights,
    // 回调
    handleCellClick, handleCardClick, handleCardSelect,
    handleConfirmDiscard, handlePlayEvent: eventCardModes.handlePlayEvent, handleEndPhase,
    handleConfirmMindControl: eventCardModes.handleConfirmMindControl,
    handleConfirmStun: eventCardModes.handleConfirmStun,
    handleConfirmEntanglement: eventCardModes.handleConfirmEntanglement,
    handleConfirmSneak: eventCardModes.handleConfirmSneak,
    handleConfirmGlacialShift: eventCardModes.handleConfirmGlacialShift,
    handleConfirmTelekinesis: eventCardModes.handleConfirmTelekinesis,
    handleConfirmMindCapture,
    handleConfirmBeforeAttackCards, handleCancelBeforeAttack,
    handlePlayMagicEvent, handleDiscardMagicEvent, handleCancelMagicEventChoice,
    clearAllEventModes: eventCardModes.clearAllEventModes,
    hasActiveEventMode: eventCardModes.hasActiveEventMode,
    isMandatoryAbilityActive,
  };
}
