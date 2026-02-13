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
  manhattanDistance, getStructureAt, findUnitPosition, getSummoner,
} from '../domain/helpers';
import { isUndeadCard, getBaseCardId, CARD_IDS } from '../domain/ids';
import { getSummonerWarsUIHints } from '../domain/uiHints';
import { extractPositions } from '../../../engine/primitives/uiHints';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import type { AbilityModeState, SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import { useToast } from '../../../contexts/ToastContext';
import { useEventCardModes } from './useEventCardModes';
import type { PendingBeforeAttack } from './modeTypes';

// 从 modeTypes 重新导出类型（保持 StatusBanners 等消费方的导入路径兼容）
export type {
  EventTargetModeState, MindControlModeState, ChantEntanglementModeState,
  WithdrawModeState, GlacialShiftModeState, SneakModeState,
  StunModeState, HypnoticLureModeState,
} from './modeTypes';

// ============================================================================
// 参数
// ============================================================================

interface UseCellInteractionParams {
  core: SummonerWarsCore;
  moves: Record<string, (payload?: unknown) => void>;
  currentPhase: GamePhase;
  isMyTurn: boolean;
  isGameOver: boolean;
  myPlayerId: string;
  activePlayerId: string;
  myHand: import('../domain/types').Card[];
  fromViewCoord: (coord: CellCoord) => CellCoord;
  // 外部模式状态
  abilityMode: AbilityModeState | null;
  setAbilityMode: (mode: AbilityModeState | null) => void;
  soulTransferMode: SoulTransferModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  setMindCaptureMode: (mode: MindCaptureModeState | null) => void;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
  setAfterAttackAbilityMode: (mode: AfterAttackAbilityModeState | null) => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useCellInteraction({
  core, moves, currentPhase, isMyTurn, isGameOver,
  myPlayerId, activePlayerId, myHand, fromViewCoord,
  abilityMode, setAbilityMode, soulTransferMode,
  mindCaptureMode, setMindCaptureMode,
  afterAttackAbilityMode, setAfterAttackAbilityMode,
}: UseCellInteractionParams) {
  const { t } = useTranslation('game-summonerwars');
  const showToast = useToast();

  // ---------- 核心状态 ----------
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardsForDiscard, setSelectedCardsForDiscard] = useState<string[]>([]);
  const [pendingBeforeAttack, setPendingBeforeAttack] = useState<PendingBeforeAttack | null>(null);

  // 离开魔力阶段时自动清空弃牌选中
  useEffect(() => {
    if (currentPhase !== 'magic') setSelectedCardsForDiscard([]);
  }, [currentPhase]);

  // ---------- 事件卡模式子 hook ----------
  const eventCardModes = useEventCardModes({
    core, moves, currentPhase, myPlayerId, myHand, setSelectedHandCardId,
    soulTransferMode, mindCaptureMode,
    afterAttackAbilityMode, setAfterAttackAbilityMode,
  });

  // ---------- 核心阶段高亮 ----------

  const selectedHandCard = useMemo(() => {
    if (!selectedHandCardId) return null;
    return myHand.find(c => c.id === selectedHandCardId) ?? null;
  }, [selectedHandCardId, myHand]);

  const validSummonPositions = useMemo(() => {
    if (!isMyTurn || !selectedHandCard || selectedHandCard.cardType !== 'unit') return [];
    const player = core.players[myPlayerId];
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
      const targetPos = findUnitPosition(core, cwEvent.targetUnitId!);
      if (targetPos) {
        for (const adj of getAdjacentCells(targetPos)) addIfEmpty(adj);
      }
    }

    return positions;
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard]);

  const validBuildPositions = useMemo(() => {
    if (currentPhase !== 'build' || !isMyTurn || !selectedHandCard) return [];
    if (selectedHandCard.cardType !== 'structure') return [];
    return getValidBuildPositions(core, myPlayerId as '0' | '1');
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard]);

  // 技能目标位置（复活死灵、感染、结构变换推拉方向）
  const validAbilityPositions = useMemo(() => {
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
      const sourcePos = findUnitPosition(core, abilityMode.sourceUnitId);
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
  }, [abilityMode, core]);

  // 技能可选单位（火祀召唤、吸取生命、幻化、结构变换等）
  const validAbilityUnits = useMemo(() => {
    // frost_axe selectAttachTarget: 3格内友方士兵（非自身）
    if (abilityMode?.abilityId === 'frost_axe' && abilityMode.step === 'selectAttachTarget') {
      const sourcePos = findUnitPosition(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => {
          if (u.cardId === abilityMode.sourceUnitId) return false;
          if (u.card.unitClass !== 'common') return false;
          return manhattanDistance(sourcePos, u.position) <= 3;
        })
        .map(u => u.position);
    }
    if (!abilityMode || abilityMode.step !== 'selectUnit') return [];
    if (abilityMode.abilityId === 'fire_sacrifice_summon') {
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => u.cardId !== abilityMode.sourceUnitId)
        .map(u => u.position);
    }
    if (abilityMode.abilityId === 'life_drain') {
      const sourcePos = findUnitPosition(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => {
          if (u.cardId === abilityMode.sourceUnitId) return false;
          return manhattanDistance(sourcePos, u.position) <= 2;
        })
        .map(u => u.position);
    }
    // 幻化：3格内的士兵（任意阵营）
    if (abilityMode.abilityId === 'illusion') {
      const sourcePos = findUnitPosition(core, abilityMode.sourceUnitId);
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
      const sourcePos = findUnitPosition(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const adj = getAdjacentCells(sourcePos);
      return adj.filter(p => {
        const unit = core.board[p.row]?.[p.col]?.unit;
        return unit && unit.owner === (myPlayerId as '0' | '1') && unit.cardId !== abilityMode.sourceUnitId;
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
      const sourcePos = findUnitPosition(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      const targets: CellCoord[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const pos = { row, col };
          const structure = getStructureAt(core, pos);
          const unit = core.board[row]?.[col]?.unit;
          const isAllyStructure = (structure && structure.owner === (myPlayerId as '0' | '1'))
            || (unit && unit.owner === (myPlayerId as '0' | '1')
              && (unit.card.abilities ?? []).includes('mobile_structure'));
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
        .filter(u => u.cardId !== abilityMode.sourceUnitId && u.card.cost === 0)
        .map(u => u.position);
    }
    // 祖灵羁绊 / 祖灵交流(transfer)：3格内友方单位（非自身）
    if (abilityMode.abilityId === 'ancestral_bond' || abilityMode.abilityId === 'spirit_bond') {
      const sourcePos = findUnitPosition(core, abilityMode.sourceUnitId);
      if (!sourcePos) return [];
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => {
          if (u.cardId === abilityMode.sourceUnitId) return false;
          return manhattanDistance(sourcePos, u.position) <= 3;
        })
        .map(u => u.position);
    }
    return [];
  }, [abilityMode, core, myPlayerId]);

  // 获取可移动位置
  const validMovePositions = useMemo(() => {
    if (currentPhase !== 'move' || !isMyTurn || !core.selectedUnit) return [];
    return getValidMoveTargetsEnhanced(core, core.selectedUnit);
  }, [core, currentPhase, isMyTurn]);

  // 获取可攻击位置
  const validAttackPositions = useMemo(() => {
    if (currentPhase !== 'attack' || !isMyTurn || !core.selectedUnit) return [];
    const baseTargets = getValidAttackTargetsEnhanced(core, core.selectedUnit);
    const selectedUnit = core.board[core.selectedUnit.row]?.[core.selectedUnit.col]?.unit;
    const hasHealingBeforeAttack = pendingBeforeAttack
      && selectedUnit
      && pendingBeforeAttack.sourceUnitId === selectedUnit.cardId
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
    if (unit.cardId !== pendingBeforeAttack.sourceUnitId) return null;
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
    if (!unit || unit.cardId !== pendingBeforeAttack.sourceUnitId) {
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

    // frost_axe 附加目标选择
    if (abilityMode && abilityMode.abilityId === 'frost_axe' && abilityMode.step === 'selectAttachTarget') {
      const isValid = validAbilityUnits.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
          abilityId: 'frost_axe',
          sourceUnitId: abilityMode.sourceUnitId,
          choice: 'attach',
          targetPosition: { row: gameRow, col: gameCol },
        });
        setAbilityMode(null);
      }
      return;
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
            setPendingBeforeAttack({
              abilityId: abilityMode.abilityId as PendingBeforeAttack['abilityId'],
              sourceUnitId: abilityMode.sourceUnitId,
              targetUnitId: targetUnit.cardId,
            });
          } else if (abilityMode.abilityId === 'illusion') {
            moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
              abilityId: 'illusion',
              sourceUnitId: abilityMode.sourceUnitId,
              targetPosition: { row: gameRow, col: gameCol },
            });
          } else if (abilityMode.abilityId === 'ancestral_bond') {
            moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
              abilityId: 'ancestral_bond',
              sourceUnitId: abilityMode.sourceUnitId,
              targetPosition: { row: gameRow, col: gameCol },
            });
          } else if (abilityMode.abilityId === 'spirit_bond') {
            moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
              abilityId: 'spirit_bond',
              sourceUnitId: abilityMode.sourceUnitId,
              choice: 'transfer',
              targetPosition: { row: gameRow, col: gameCol },
            });
          } else if (abilityMode.abilityId === 'feed_beast') {
            moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
              abilityId: 'feed_beast',
              sourceUnitId: abilityMode.sourceUnitId,
              targetPosition: { row: gameRow, col: gameCol },
            });
          } else if (abilityMode.abilityId === 'vanish') {
            moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
              abilityId: 'vanish',
              sourceUnitId: abilityMode.sourceUnitId,
              targetPosition: { row: gameRow, col: gameCol },
            });
          } else {
            moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
              abilityId: abilityMode.abilityId,
              sourceUnitId: abilityMode.sourceUnitId,
              targetUnitId: targetUnit.cardId,
            });
          }
          setAbilityMode(null);
        }
      }
      return;
    }

    // 结构变换第二步：选择推拉方向
    if (abilityMode && abilityMode.abilityId === 'structure_shift' && abilityMode.step === 'selectNewPosition') {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid && abilityMode.targetPosition) {
        moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
          abilityId: 'structure_shift',
          sourceUnitId: abilityMode.sourceUnitId,
          targetPosition: abilityMode.targetPosition,
          newPosition: { row: gameRow, col: gameCol },
        });
        setAbilityMode(null);
      }
      return;

    // 寒冰冲撞第二步：选择推拉方向（或跳过）
    } else if (abilityMode && abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection') {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid && abilityMode.targetPosition && abilityMode.structurePosition) {
        moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
          abilityId: 'ice_ram',
          sourceUnitId: 'ice_ram',
          targetPosition: abilityMode.targetPosition,
          structurePosition: abilityMode.structurePosition,
          pushNewPosition: { row: gameRow, col: gameCol },
        });
        setAbilityMode(null);
      }
      return;
    }

    // 技能目标选择模式（复活死灵、感染）
    if (abilityMode && abilityMode.step === 'selectPosition') {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
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
        const abilities = clickedUnit.card.abilities ?? [];
        if (abilities.includes('revive_undead')) {
          const hasUndeadInDiscard = core.players[myPlayerId]?.discard.some(c =>
            isUndeadCard(c)
          );
          if (hasUndeadInDiscard) {
            setAbilityMode({ abilityId: 'revive_undead', step: 'selectCard', sourceUnitId: clickedUnit.cardId });
            return;
          }
        }
      }
    }

    // 召唤阶段：执行召唤
    if (currentPhase === 'summon' && selectedHandCardId) {
      const isValidPosition = validSummonPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidPosition) {
        moves[SW_COMMANDS.SUMMON_UNIT]?.({ cardId: selectedHandCardId, position: { row: gameRow, col: gameCol } });
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
        moves[SW_COMMANDS.BUILD_STRUCTURE]?.({ cardId: selectedHandCardId, position: { row: gameRow, col: gameCol } });
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
          moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: -1, col: -1 } });
          return;
        }
        const isValidMove = validMovePositions.some(p => p.row === gameRow && p.col === gameCol);
        if (isValidMove) {
          moves[SW_COMMANDS.MOVE_UNIT]?.({ from: core.selectedUnit, to: { row: gameRow, col: gameCol } });
        } else {
          const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
          if (clickedUnit && clickedUnit.owner === myPlayerId) {
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
          } else {
            if (!clickedUnit || clickedUnit.owner !== myPlayerId) {
              showToast.warning(t('interaction.cannotMoveThere'));
            }
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: -1, col: -1 } });
          }
        }
      } else {
        moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
      }
      return;
    }

    // 攻击阶段
    if (currentPhase === 'attack') {
      if (core.selectedUnit) {
        if (gameRow === core.selectedUnit.row && gameCol === core.selectedUnit.col) {
          moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: -1, col: -1 } });
          return;
        }
        const isValidAttack = validAttackPositions.some(p => p.row === gameRow && p.col === gameCol);
        if (isValidAttack) {
          moves[SW_COMMANDS.DECLARE_ATTACK]?.({
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
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
          } else {
            if (clickedUnit && clickedUnit.owner !== myPlayerId) {
              showToast.warning(t('interaction.cannotAttackThere'));
            }
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: -1, col: -1 } });
          }
        }
      } else {
        moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
      }
      return;
    }

    // 其他阶段：普通选择
    moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
  }, [core, moves, currentPhase, selectedHandCardId, validSummonPositions, validBuildPositions,
    validMovePositions, validAttackPositions, myPlayerId, fromViewCoord,
    abilityMode, validAbilityPositions, validAbilityUnits,
    eventCardModes.handleEventModeClick,
    activeBeforeAttack]);

  // ---------- 手牌交互 ----------

  // 手牌点击（魔力阶段弃牌多选/攻击前弃牌）
  const handleCardClick = useCallback((cardId: string) => {
    setEndPhaseConfirmPending(false);

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
        const sourceUnit = core.board.flat().map(c => c.unit).find(u => u?.cardId === abilityMode.sourceUnitId);
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
  }, [abilityMode, core, currentPhase, isMyTurn, myHand, showToast]);

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
      return;
    }

    // 选中其他手牌时，自动取消所有多步骤事件卡模式
    if (eventCardModes.hasActiveEventMode && cardId) {
      eventCardModes.clearAllEventModes();
    }

    setSelectedHandCardId(cardId);
  }, [eventCardModes.bloodSummonMode, myHand, eventCardModes.hasActiveEventMode, eventCardModes.clearAllEventModes, selectedHandCardId]);

  // 确认弃牌换魔力
  const handleConfirmDiscard = useCallback(() => {
    if (selectedCardsForDiscard.length > 0) {
      moves[SW_COMMANDS.DISCARD_FOR_MAGIC]?.({ cardIds: selectedCardsForDiscard });
      setSelectedCardsForDiscard([]);
    }
  }, [moves, selectedCardsForDiscard]);

  // ---------- 阶段控制 ----------

  const [endPhaseConfirmPending, setEndPhaseConfirmPending] = useState(false);

  useEffect(() => { setEndPhaseConfirmPending(false); }, [currentPhase]);

  const handleEndPhase = useCallback(() => {
    if (eventCardModes.hasActiveEventMode) {
      eventCardModes.clearAllEventModes();
    }
    if (endPhaseConfirmPending) {
      setEndPhaseConfirmPending(false);
      moves[FLOW_COMMANDS.ADVANCE_PHASE]?.({});
      return;
    }
    if ((currentPhase === 'move' || currentPhase === 'attack') && actionableUnitPositions.length > 0) {
      setEndPhaseConfirmPending(true);
      return;
    }
    moves[FLOW_COMMANDS.ADVANCE_PHASE]?.({});
  }, [moves, currentPhase, actionableUnitPositions.length, endPhaseConfirmPending,
    eventCardModes.hasActiveEventMode, eventCardModes.clearAllEventModes]);

  // ---------- 外部技能确认 ----------

  const handleConfirmMindCapture = useCallback((choice: 'control' | 'damage') => {
    if (!mindCaptureMode) return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
      abilityId: 'mind_capture_resolve',
      sourceUnitId: mindCaptureMode.sourceUnitId,
      choice,
      targetPosition: mindCaptureMode.targetPosition,
      hits: mindCaptureMode.hits,
    });
    setMindCaptureMode(null);
  }, [moves, mindCaptureMode, setMindCaptureMode]);

  const handleConfirmBeforeAttackCards = useCallback(() => {
    if (!abilityMode || abilityMode.step !== 'selectCards') return;
    const selected = abilityMode.selectedCardIds ?? [];
    if (abilityMode.abilityId === 'holy_arrow') {
      if (selected.length === 0) {
        showToast.warning(t('handArea.holyArrowAtLeastOne'));
        return;
      }
      setPendingBeforeAttack({
        abilityId: 'holy_arrow',
        sourceUnitId: abilityMode.sourceUnitId,
        discardCardIds: selected,
      });
      setAbilityMode(null);
      return;
    }
    if (abilityMode.abilityId === 'healing') {
      if (selected.length === 0) {
        showToast.warning(t('handArea.healingNeedsDiscard'));
        return;
      }
      setPendingBeforeAttack({
        abilityId: 'healing',
        sourceUnitId: abilityMode.sourceUnitId,
        targetCardId: selected[0],
      });
      setAbilityMode(null);
    }
  }, [abilityMode, showToast]);

  const handleCancelBeforeAttack = useCallback(() => {
    setPendingBeforeAttack(null);
  }, []);

  // ---------- 自动跳过 ----------

  // 存在活跃的交互模式时禁止自动跳过（玩家正在进行多步骤操作）
  const hasActiveInteraction = eventCardModes.hasActiveEventMode
    || !!eventCardModes.funeralPyreMode
    || !!soulTransferMode
    || !!mindCaptureMode
    || !!afterAttackAbilityMode
    || !!abilityMode;

  // 全局禁用开关（调试用）
  const debugDisabled = typeof window !== 'undefined'
    && (window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean }).__SW_DISABLE_AUTO_SKIP__;

  const advancePhase = useCallback(() => {
    moves[FLOW_COMMANDS.ADVANCE_PHASE]?.({});
  }, [moves]);

  useAutoSkipPhase({
    isMyTurn,
    isGameOver,
    hasAvailableActions: hasAvailableActions(core, activePlayerId as '0' | '1'),
    hasActiveInteraction,
    advancePhase,
    enabled: !!core.hostStarted && !debugDisabled,
  });

  // ---------- 返回 ----------

  return {
    // 状态
    selectedHandCardId, selectedCardsForDiscard,
    endPhaseConfirmPending, setEndPhaseConfirmPending,
    pendingBeforeAttack,
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
    clearAllEventModes: eventCardModes.clearAllEventModes,
  };
}
