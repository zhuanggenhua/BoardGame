/**
 * 召唤师战争 - 格子交互逻辑 Hook
 * 
 * 处理棋盘格子点击、手牌选择、事件卡打出等交互
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SummonerWarsCore, CellCoord, EventCard, UnitCard, GamePhase } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import { FLOW_COMMANDS } from '../../../engine';
import {
  getValidSummonPositions, getValidBuildPositions,
  getValidMoveTargetsEnhanced, getValidAttackTargetsEnhanced,
  getPlayerUnits, hasAvailableActions, isCellEmpty,
  getAdjacentCells, MAX_MOVES_PER_TURN, MAX_ATTACKS_PER_TURN,
  getSummoner, manhattanDistance, isInStraightLine,
} from '../domain/helpers';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import type { AbilityModeState, SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import type { BloodSummonModeState, AnnihilateModeState, FuneralPyreModeState } from './StatusBanners';
import { useToast } from '../../../contexts/ToastContext';

// ============================================================================
// 类型
// ============================================================================

export interface EventTargetModeState {
  cardId: string;
  card: EventCard;
  validTargets: CellCoord[];
}

/** 心灵操控多目标选择模式 */
export interface MindControlModeState {
  cardId: string;
  validTargets: CellCoord[]; // 召唤师2格内的敌方士兵/冠军
  selectedTargets: CellCoord[];
}

/** 震慑目标+方向选择模式 */
export interface StunModeState {
  step: 'selectTarget' | 'selectDirection';
  cardId: string;
  validTargets: CellCoord[]; // 召唤师3格直线内的敌方士兵/冠军
  targetPosition?: CellCoord;
}

/** 催眠引诱目标选择模式 */
export interface HypnoticLureModeState {
  cardId: string;
  validTargets: CellCoord[]; // 所有敌方士兵/冠军
}

interface PendingBeforeAttack {
  abilityId: 'life_drain' | 'holy_arrow' | 'healing';
  sourceUnitId: string;
  targetUnitId?: string;
  targetCardId?: string;
  discardCardIds?: string[];
}

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
  const showToast = useToast();
  // 手牌选中状态
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardsForDiscard, setSelectedCardsForDiscard] = useState<string[]>([]);
  const [pendingBeforeAttack, setPendingBeforeAttack] = useState<PendingBeforeAttack | null>(null);

  // 离开魔力阶段时自动清空弃牌选中
  useEffect(() => {
    if (currentPhase !== 'magic') setSelectedCardsForDiscard([]);
  }, [currentPhase]);

  // 事件卡目标选择模式
  const [eventTargetMode, setEventTargetMode] = useState<EventTargetModeState | null>(null);

  // 血契召唤多步骤模式
  const [bloodSummonMode, setBloodSummonMode] = useState<BloodSummonModeState | null>(null);

  // 殉葬火堆治疗模式
  const [funeralPyreMode, setFuneralPyreMode] = useState<FuneralPyreModeState | null>(null);

  // 除灭多步骤模式
  const [annihilateMode, setAnnihilateMode] = useState<AnnihilateModeState | null>(null);

  // 心灵操控多目标选择模式
  const [mindControlMode, setMindControlMode] = useState<MindControlModeState | null>(null);

  // 震慑目标+方向选择模式
  const [stunMode, setStunMode] = useState<StunModeState | null>(null);

  // 催眠引诱目标选择模式
  const [hypnoticLureMode, setHypnoticLureMode] = useState<HypnoticLureModeState | null>(null);

  // 念力推拉方向选择模式（目标已选，等待方向）
  const [telekinesisTargetMode, setTelekinesisTargetMode] = useState<{
    abilityId: 'telekinesis' | 'high_telekinesis';
    sourceUnitId: string;
    targetPosition: CellCoord;
  } | null>(null);

  // 获取选中的手牌
  const selectedHandCard = useMemo(() => {
    if (!selectedHandCardId) return null;
    return myHand.find(c => c.id === selectedHandCardId) ?? null;
  }, [selectedHandCardId, myHand]);

  // 获取可召唤位置
  const validSummonPositions = useMemo(() => {
    if (currentPhase !== 'summon' || !isMyTurn || !selectedHandCard) return [];
    if (selectedHandCard.cardType !== 'unit') return [];
    return getValidSummonPositions(core, myPlayerId as '0' | '1');
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard]);

  // 获取可建造位置
  const validBuildPositions = useMemo(() => {
    if (currentPhase !== 'build' || !isMyTurn || !selectedHandCard) return [];
    if (selectedHandCard.cardType !== 'structure') return [];
    return getValidBuildPositions(core, myPlayerId as '0' | '1');
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard]);

  // 获取技能目标位置（复活死灵、感染）
  const validAbilityPositions = useMemo(() => {
    if (!abilityMode || abilityMode.step !== 'selectPosition') return [];
    if (abilityMode.abilityId === 'revive_undead') {
      let sourcePos: CellCoord | null = null;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (unit && unit.cardId === abilityMode.sourceUnitId) {
            sourcePos = { row, col };
            break;
          }
        }
        if (sourcePos) break;
      }
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

  // 获取技能可选单位（火祀召唤、吸取生命）
  const validAbilityUnits = useMemo(() => {
    if (!abilityMode || abilityMode.step !== 'selectUnit') return [];
    if (abilityMode.abilityId === 'fire_sacrifice_summon') {
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => u.cardId !== abilityMode.sourceUnitId)
        .map(u => u.position);
    }
    if (abilityMode.abilityId === 'life_drain') {
      let sourcePos: CellCoord | null = null;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (unit && unit.cardId === abilityMode.sourceUnitId) {
            sourcePos = { row, col };
            break;
          }
        }
        if (sourcePos) break;
      }
      if (!sourcePos) return [];
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => {
          if (u.cardId === abilityMode.sourceUnitId) return false;
          const dist = Math.abs(u.position.row - sourcePos!.row) + Math.abs(u.position.col - sourcePos!.col);
          return dist <= 2;
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

  // 可操作单位高亮
  const actionableUnitPositions = useMemo(() => {
    if (!isMyTurn) return [];
    const pid = myPlayerId as '0' | '1';
    const player = core.players[pid];
    const units = getPlayerUnits(core, pid);
    const positions: CellCoord[] = [];
    switch (currentPhase) {
      case 'summon': {
        for (const u of units) {
          const abilities = u.card.abilities ?? [];
          if (abilities.includes('revive_undead')) {
            const hasUndead = player.discard.some(c =>
              c.cardType === 'unit' && (c.id.includes('undead') || c.name.includes('亡灵') || (c as UnitCard).faction === '堕落王国')
            );
            if (hasUndead) positions.push(u.position);
          }
        }
        break;
      }
      case 'move': {
        if (player.moveCount < MAX_MOVES_PER_TURN) {
          for (const u of units) {
            if (!u.hasMoved && getValidMoveTargetsEnhanced(core, u.position).length > 0) {
              positions.push(u.position);
            }
          }
        }
        break;
      }
      case 'attack': {
        if (player.attackCount < MAX_ATTACKS_PER_TURN) {
          for (const u of units) {
            if (!u.hasAttacked && getValidAttackTargetsEnhanced(core, u.position).length > 0) {
              positions.push(u.position);
            }
          }
        }
        break;
      }
    }
    return positions;
  }, [core, currentPhase, isMyTurn, myPlayerId]);

  // 事件目标位置
  const validEventTargets = useMemo(() => {
    if (!eventTargetMode) return [];
    return eventTargetMode.validTargets;
  }, [eventTargetMode]);

  // 血契召唤有效位置
  const bloodSummonHighlights = useMemo(() => {
    if (!bloodSummonMode) return [];
    if (bloodSummonMode.step === 'selectTarget') {
      return getPlayerUnits(core, myPlayerId as '0' | '1').map(u => u.position);
    }
    if (bloodSummonMode.step === 'selectPosition' && bloodSummonMode.targetPosition) {
      const tp = bloodSummonMode.targetPosition;
      const adj: CellCoord[] = [
        { row: tp.row - 1, col: tp.col },
        { row: tp.row + 1, col: tp.col },
        { row: tp.row, col: tp.col - 1 },
        { row: tp.row, col: tp.col + 1 },
      ];
      return adj.filter(p => isCellEmpty(core, p));
    }
    return [];
  }, [bloodSummonMode, core, myPlayerId]);

  // 除灭有效位置
  const annihilateHighlights = useMemo(() => {
    if (!annihilateMode) return [];
    if (annihilateMode.step === 'selectTargets') {
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => u.card.unitClass !== 'summoner')
        .map(u => u.position);
    }
    if (annihilateMode.step === 'selectDamageTarget') {
      const currentTarget = annihilateMode.selectedTargets[annihilateMode.currentTargetIndex];
      if (currentTarget) {
        return getAdjacentCells(currentTarget).filter(adj => {
          const unit = core.board[adj.row]?.[adj.col]?.unit;
          return unit !== undefined;
        });
      }
    }
    return [];
  }, [annihilateMode, core, myPlayerId]);

  // 心灵操控有效位置
  const mindControlHighlights = useMemo(() => {
    if (!mindControlMode) return [];
    return mindControlMode.validTargets;
  }, [mindControlMode]);

  // 震慑有效位置
  const stunHighlights = useMemo(() => {
    if (!stunMode) return [];
    return stunMode.validTargets;
  }, [stunMode]);

  // 催眠引诱有效位置
  const hypnoticLureHighlights = useMemo(() => {
    if (!hypnoticLureMode) return [];
    return hypnoticLureMode.validTargets;
  }, [hypnoticLureMode]);

  // 攻击后技能有效位置（念力/高阶念力/读心传念）
  const afterAttackAbilityHighlights = useMemo(() => {
    if (!afterAttackAbilityMode) return [];
    const { abilityId, sourcePosition } = afterAttackAbilityMode;
    const positions: CellCoord[] = [];
    
    if (abilityId === 'telekinesis' || abilityId === 'high_telekinesis') {
      // 念力：范围内的士兵/冠军（非召唤师）
      const maxRange = abilityId === 'high_telekinesis' ? 3 : 2;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (!unit || unit.card.unitClass === 'summoner') continue;
          if ((unit.card.abilities ?? []).includes('stable')) continue;
          const dist = manhattanDistance(sourcePosition, { row, col });
          if (dist > 0 && dist <= maxRange) {
            positions.push({ row, col });
          }
        }
      }
    } else if (abilityId === 'mind_transmission') {
      // 读心传念：3格内友方士兵
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (!unit || unit.owner !== myPlayerId || unit.card.unitClass !== 'common') continue;
          const dist = manhattanDistance(sourcePosition, { row, col });
          if (dist > 0 && dist <= 3) {
            positions.push({ row, col });
          }
        }
      }
    }
    return positions;
  }, [afterAttackAbilityMode, core, myPlayerId]);

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

  // 点击格子
  const handleCellClick = useCallback((row: number, col: number) => {
    const { row: gameRow, col: gameCol } = fromViewCoord({ row, col });

    // 殉葬火堆治疗目标选择
    if (funeralPyreMode) {
      const targetUnit = core.board[gameRow]?.[gameCol]?.unit;
      if (targetUnit && targetUnit.damage > 0) {
        moves[SW_COMMANDS.FUNERAL_PYRE_HEAL]?.({
          cardId: funeralPyreMode.cardId,
          targetPosition: { row: gameRow, col: gameCol },
        });
        setFuneralPyreMode(null);
      }
      return;
    }

    // 灵魂转移确认模式下不处理其他点击
    if (soulTransferMode) return;

    // 心灵捕获选择模式下不处理其他点击（由 StatusBanners 按钮处理）
    if (mindCaptureMode) return;

    // 攻击后技能目标选择模式
    if (afterAttackAbilityMode) {
      const isValid = afterAttackAbilityHighlights.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        if (afterAttackAbilityMode.abilityId === 'mind_transmission') {
          // 读心传念：直接执行
          moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
            abilityId: 'mind_transmission',
            sourceUnitId: afterAttackAbilityMode.sourceUnitId,
            targetPosition: { row: gameRow, col: gameCol },
          });
          setAfterAttackAbilityMode(null);
        } else {
          // 念力/高阶念力：进入推拉方向选择（由 StatusBanners 处理）
          setAfterAttackAbilityMode(null);
          // 使用 stunMode 类似的模式：先选目标，再选方向
          setTelekinesisTargetMode({
            abilityId: afterAttackAbilityMode.abilityId,
            sourceUnitId: afterAttackAbilityMode.sourceUnitId,
            targetPosition: { row: gameRow, col: gameCol },
          });
        }
      }
      return;
    }

    // 念力推拉方向选择模式下不处理其他点击（由 StatusBanners 按钮处理）
    if (telekinesisTargetMode) return;

    // 血契召唤多步骤模式
    if (bloodSummonMode) {
      if (bloodSummonMode.step === 'selectTarget') {
        const isValid = bloodSummonHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          setBloodSummonMode({ ...bloodSummonMode, step: 'selectCard', targetPosition: { row: gameRow, col: gameCol } });
        }
      } else if (bloodSummonMode.step === 'selectPosition' && bloodSummonMode.targetPosition && bloodSummonMode.summonCardId) {
        const isValid = bloodSummonHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          const isFirstUse = (bloodSummonMode.completedCount ?? 0) === 0;
          if (isFirstUse && bloodSummonMode.cardId) {
            moves[SW_COMMANDS.PLAY_EVENT]?.({ cardId: bloodSummonMode.cardId });
          }
          moves[SW_COMMANDS.BLOOD_SUMMON_STEP]?.({
            targetUnitPosition: bloodSummonMode.targetPosition,
            summonCardId: bloodSummonMode.summonCardId,
            summonPosition: { row: gameRow, col: gameCol },
          });
          setBloodSummonMode({
            step: 'confirm', cardId: bloodSummonMode.cardId,
            completedCount: (bloodSummonMode.completedCount ?? 0) + 1,
          });
        }
      }
      return;
    }

    // 除灭多步骤模式
    if (annihilateMode) {
      if (annihilateMode.step === 'selectTargets') {
        const friendlyUnits = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        const isValid = friendlyUnits.some(u => u.position.row === gameRow && u.position.col === gameCol);
        if (isValid) {
          const alreadySelected = annihilateMode.selectedTargets.some(p => p.row === gameRow && p.col === gameCol);
          if (alreadySelected) {
            setAnnihilateMode({
              ...annihilateMode,
              selectedTargets: annihilateMode.selectedTargets.filter(p => !(p.row === gameRow && p.col === gameCol)),
            });
          } else {
            setAnnihilateMode({
              ...annihilateMode,
              selectedTargets: [...annihilateMode.selectedTargets, { row: gameRow, col: gameCol }],
            });
          }
        }
      } else if (annihilateMode.step === 'selectDamageTarget') {
        const currentTarget = annihilateMode.selectedTargets[annihilateMode.currentTargetIndex];
        if (currentTarget) {
          const adjacentUnits = getAdjacentCells(currentTarget)
            .filter(adj => core.board[adj.row]?.[adj.col]?.unit !== undefined);
          const isValid = adjacentUnits.some(p => p.row === gameRow && p.col === gameCol);
          if (isValid) {
            const newDamageTargets = [...annihilateMode.damageTargets];
            newDamageTargets[annihilateMode.currentTargetIndex] = { row: gameRow, col: gameCol };
            const nextIndex = annihilateMode.currentTargetIndex + 1;
            if (nextIndex < annihilateMode.selectedTargets.length) {
              setAnnihilateMode({ ...annihilateMode, damageTargets: newDamageTargets, currentTargetIndex: nextIndex });
            } else {
              moves[SW_COMMANDS.PLAY_EVENT]?.({
                cardId: annihilateMode.cardId,
                targets: annihilateMode.selectedTargets,
                damageTargets: newDamageTargets,
              });
              setAnnihilateMode(null);
            }
          }
        }
      }
      return;
    }

    // 心灵操控多目标选择模式
    if (mindControlMode) {
      const isValid = mindControlMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        const alreadySelected = mindControlMode.selectedTargets.some(p => p.row === gameRow && p.col === gameCol);
        if (alreadySelected) {
          setMindControlMode({
            ...mindControlMode,
            selectedTargets: mindControlMode.selectedTargets.filter(p => !(p.row === gameRow && p.col === gameCol)),
          });
        } else {
          setMindControlMode({
            ...mindControlMode,
            selectedTargets: [...mindControlMode.selectedTargets, { row: gameRow, col: gameCol }],
          });
        }
      }
      return;
    }

    // 震慑目标选择模式
    if (stunMode) {
      if (stunMode.step === 'selectTarget') {
        const isValid = stunMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          setStunMode({ ...stunMode, step: 'selectDirection', targetPosition: { row: gameRow, col: gameCol } });
        }
      }
      // selectDirection 步骤由 StatusBanners 的 UI 按钮处理（推/拉 + 距离选择）
      return;
    }

    // 催眠引诱目标选择模式
    if (hypnoticLureMode) {
      const isValid = hypnoticLureMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        moves[SW_COMMANDS.PLAY_EVENT]?.({
          cardId: hypnoticLureMode.cardId,
          targets: [{ row: gameRow, col: gameCol }],
        });
        setHypnoticLureMode(null);
      }
      return;
    }

    // 技能单位选择模式（火祀召唤、吸取生命）
    if (abilityMode && abilityMode.step === 'selectUnit') {
      const isValid = validAbilityUnits.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        const targetUnit = core.board[gameRow]?.[gameCol]?.unit;
        if (targetUnit) {
          if (abilityMode.context === 'beforeAttack') {
            setPendingBeforeAttack({
              abilityId: abilityMode.abilityId as PendingBeforeAttack['abilityId'],
              sourceUnitId: abilityMode.sourceUnitId,
              targetUnitId: targetUnit.cardId,
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

    // 事件目标选择模式
    if (eventTargetMode) {
      const isValidTarget = eventTargetMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidTarget) {
        moves[SW_COMMANDS.PLAY_EVENT]?.({ cardId: eventTargetMode.cardId, targets: [{ row: gameRow, col: gameCol }] });
      }
      setEventTargetMode(null);
      return;
    }

    // 召唤阶段：点击拥有复活死灵技能的单位
    if (currentPhase === 'summon' && !selectedHandCardId) {
      const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
      if (clickedUnit && clickedUnit.owner === myPlayerId) {
        const abilities = clickedUnit.card.abilities ?? [];
        if (abilities.includes('revive_undead')) {
          const hasUndeadInDiscard = core.players[myPlayerId]?.discard.some(c =>
            c.cardType === 'unit' && (c.id.includes('undead') || c.name.includes('亡灵') || (c as UnitCard).faction === '堕落王国')
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
      }
      setSelectedHandCardId(null);
      return;
    }

    // 建造阶段
    if (currentPhase === 'build' && selectedHandCardId) {
      const isValidPosition = validBuildPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidPosition) {
        moves[SW_COMMANDS.BUILD_STRUCTURE]?.({ cardId: selectedHandCardId, position: { row: gameRow, col: gameCol } });
      }
      setSelectedHandCardId(null);
      return;
    }

    // 移动阶段
    if (currentPhase === 'move') {
      if (core.selectedUnit) {
        const isValidMove = validMovePositions.some(p => p.row === gameRow && p.col === gameCol);
        if (isValidMove) {
          moves[SW_COMMANDS.MOVE_UNIT]?.({ from: core.selectedUnit, to: { row: gameRow, col: gameCol } });
        } else {
          const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
          if (clickedUnit && clickedUnit.owner === myPlayerId) {
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
          } else {
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
    validMovePositions, validAttackPositions, myPlayerId, fromViewCoord, eventTargetMode,
    bloodSummonMode, bloodSummonHighlights, abilityMode, validAbilityPositions, validAbilityUnits,
    annihilateMode, funeralPyreMode, soulTransferMode,
    mindControlMode, stunMode, hypnoticLureMode,
    afterAttackAbilityMode, afterAttackAbilityHighlights, telekinesisTargetMode, mindCaptureMode,
    activeBeforeAttack]);

  // 手牌点击（魔力阶段弃牌多选/攻击前弃牌）
  const handleCardClick = useCallback((cardId: string) => {
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
          showToast.warning('圣光箭只能弃除单位卡');
          return;
        }
        const sourceUnit = core.board.flat().map(c => c.unit).find(u => u?.cardId === abilityMode.sourceUnitId);
        if (sourceUnit && card.name === sourceUnit.card.name) {
          showToast.warning('不能弃除同名单位');
          return;
        }
        const names = new Set(
          selected
            .map(id => myHand.find(c => c.id === id))
            .filter((c): c is UnitCard => !!c && c.cardType === 'unit')
            .map(c => c.name)
        );
        if (card.cardType === 'unit' && names.has(card.name)) {
          showToast.warning('不能弃除多张同名单位');
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
    if (bloodSummonMode?.step === 'selectCard' && cardId) {
      const card = myHand.find(c => c.id === cardId);
      if (card && card.cardType === 'unit' && (card as UnitCard).cost <= 2) {
        setBloodSummonMode({ ...bloodSummonMode, step: 'selectPosition', summonCardId: cardId });
        return;
      }
    }
    setSelectedHandCardId(cardId);
  }, [bloodSummonMode, myHand]);

  // 确认弃牌换魔力
  const handleConfirmDiscard = useCallback(() => {
    if (selectedCardsForDiscard.length > 0) {
      moves[SW_COMMANDS.DISCARD_FOR_MAGIC]?.({ cardIds: selectedCardsForDiscard });
      setSelectedCardsForDiscard([]);
    }
  }, [moves, selectedCardsForDiscard]);

  // 打出事件卡
  const handlePlayEvent = useCallback((cardId: string) => {
    const card = myHand.find(c => c.id === cardId);
    if (!card || card.cardType !== 'event') return;
    const eventCard = card as EventCard;
    const baseId = eventCard.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');

    switch (baseId) {
      case 'necro-hellfire-blade': {
        const friendlyCommons = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass === 'common');
        if (friendlyCommons.length === 0) return;
        setEventTargetMode({ cardId, card: eventCard, validTargets: friendlyCommons.map(u => u.position) });
        setSelectedHandCardId(null);
        return;
      }
      case 'necro-blood-summon': {
        const friendlyUnits = getPlayerUnits(core, myPlayerId as '0' | '1');
        if (friendlyUnits.length === 0) return;
        setBloodSummonMode({ step: 'selectTarget', cardId });
        setSelectedHandCardId(null);
        return;
      }
      case 'necro-annihilate': {
        const friendlyUnits = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        if (friendlyUnits.length === 0) return;
        setAnnihilateMode({ step: 'selectTargets', cardId, selectedTargets: [], currentTargetIndex: 0, damageTargets: [] });
        setSelectedHandCardId(null);
        return;
      }
      case 'trickster-mind-control': {
        // 心灵操控：选择召唤师2格内的敌方士兵/冠军
        const summoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!summoner) return;
        const opponentId = myPlayerId === '0' ? '1' : '0';
        const enemyUnits = getPlayerUnits(core, opponentId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner' && manhattanDistance(summoner.position, u.position) <= 2);
        if (enemyUnits.length === 0) return;
        setMindControlMode({ cardId, validTargets: enemyUnits.map(u => u.position), selectedTargets: [] });
        setSelectedHandCardId(null);
        return;
      }
      case 'trickster-stun': {
        // 震慑：选择召唤师3格直线内的敌方士兵/冠军
        const stunSummoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!stunSummoner) return;
        const stunOpponentId = myPlayerId === '0' ? '1' : '0';
        const stunTargets = getPlayerUnits(core, stunOpponentId as '0' | '1')
          .filter(u => {
            if (u.card.unitClass === 'summoner') return false;
            const dist = manhattanDistance(stunSummoner.position, u.position);
            return dist <= 3 && dist > 0 && isInStraightLine(stunSummoner.position, u.position);
          });
        if (stunTargets.length === 0) return;
        setStunMode({ step: 'selectTarget', cardId, validTargets: stunTargets.map(u => u.position) });
        setSelectedHandCardId(null);
        return;
      }
      case 'trickster-hypnotic-lure': {
        // 催眠引诱：选择任意敌方士兵/冠军
        const lureOpponentId = myPlayerId === '0' ? '1' : '0';
        const lureTargets = getPlayerUnits(core, lureOpponentId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        if (lureTargets.length === 0) return;
        setHypnoticLureMode({ cardId, validTargets: lureTargets.map(u => u.position) });
        setSelectedHandCardId(null);
        return;
      }
      default: {
        moves[SW_COMMANDS.PLAY_EVENT]?.({ cardId });
        return;
      }
    }
  }, [core, myHand, myPlayerId, moves]);

  // 结束阶段
  const handleEndPhase = useCallback(() => {
    moves[FLOW_COMMANDS.ADVANCE_PHASE]?.({});
  }, [moves]);

  // 确认心灵操控（多目标选择完成）
  const handleConfirmMindControl = useCallback(() => {
    if (!mindControlMode || mindControlMode.selectedTargets.length === 0) return;
    moves[SW_COMMANDS.PLAY_EVENT]?.({
      cardId: mindControlMode.cardId,
      targets: mindControlMode.selectedTargets,
    });
    setMindControlMode(null);
  }, [moves, mindControlMode]);

  // 确认震慑（方向+距离选择完成）
  const handleConfirmStun = useCallback((direction: 'push' | 'pull', distance: number) => {
    if (!stunMode || !stunMode.targetPosition) return;
    moves[SW_COMMANDS.PLAY_EVENT]?.({
      cardId: stunMode.cardId,
      targets: [stunMode.targetPosition],
      stunDirection: direction,
      stunDistance: distance,
    });
    setStunMode(null);
  }, [moves, stunMode]);

  // 确认念力推拉（方向选择完成）
  const handleConfirmTelekinesis = useCallback((direction: 'push' | 'pull') => {
    if (!telekinesisTargetMode) return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
      abilityId: telekinesisTargetMode.abilityId,
      sourceUnitId: telekinesisTargetMode.sourceUnitId,
      targetPosition: telekinesisTargetMode.targetPosition,
      direction,
    });
    setTelekinesisTargetMode(null);
  }, [moves, telekinesisTargetMode]);

  // 确认心灵捕获选择
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
        showToast.warning('圣光箭至少弃除一张单位卡');
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
        showToast.warning('治疗需要弃除一张手牌');
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

  // 自动跳过无可用操作的阶段
  useEffect(() => {
    if (!isMyTurn || isGameOver) return;
    if (!core.hostStarted) return;
    if (typeof window !== 'undefined') {
      const holder = window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean };
      if (holder.__SW_DISABLE_AUTO_SKIP__) return;
    }
    const hasActions = hasAvailableActions(core, activePlayerId as '0' | '1');
    if (!hasActions) {
      const timer = setTimeout(() => { moves[FLOW_COMMANDS.ADVANCE_PHASE]?.({}); }, 300);
      return () => clearTimeout(timer);
    }
  }, [core, isMyTurn, isGameOver, activePlayerId, moves]);

  // 检测殉葬火堆充能
  useEffect(() => {
    if (funeralPyreMode) return;
    const player = core.players[myPlayerId as '0' | '1'];
    if (!player) return;
    for (const ev of player.activeEvents) {
      const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
      if (baseId === 'necro-funeral-pyre' && (ev.charges ?? 0) > 0) {
        setFuneralPyreMode({ cardId: ev.id, charges: ev.charges ?? 0 });
        return;
      }
    }
  }, [core.players, myPlayerId, funeralPyreMode]);

  return {
    // 状态
    selectedHandCardId, selectedCardsForDiscard,
    eventTargetMode, bloodSummonMode, setBloodSummonMode,
    annihilateMode, setAnnihilateMode,
    funeralPyreMode, setFuneralPyreMode,
    mindControlMode, setMindControlMode,
    stunMode, setStunMode,
    hypnoticLureMode, setHypnoticLureMode,
    telekinesisTargetMode, setTelekinesisTargetMode,
    pendingBeforeAttack,
    abilitySelectedCardIds: abilityMode?.step === 'selectCards' ? (abilityMode.selectedCardIds ?? []) : [],
    // 计算值
    validSummonPositions, validBuildPositions, validMovePositions, validAttackPositions,
    validAbilityPositions, validAbilityUnits, actionableUnitPositions,
    validEventTargets, bloodSummonHighlights, annihilateHighlights,
    mindControlHighlights, stunHighlights, hypnoticLureHighlights,
    afterAttackAbilityHighlights,
    // 回调
    handleCellClick, handleCardClick, handleCardSelect,
    handleConfirmDiscard, handlePlayEvent, handleEndPhase,
    handleConfirmMindControl, handleConfirmStun,
    handleConfirmTelekinesis, handleConfirmMindCapture,
    handleConfirmBeforeAttackCards, handleCancelBeforeAttack,
  };
}
