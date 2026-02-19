/**
 * 召唤师战争 - 事件卡交互模式子 Hook
 *
 * 管理所有事件卡多步骤交互模式的状态、高亮计算、点击处理和确认回调。
 * 由 useCellInteraction 编排层调用。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SummonerWarsCore, CellCoord, EventCard, GamePhase } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import {
  getPlayerUnits, isCellEmpty, getAdjacentCells,
  manhattanDistance, isInStraightLine,
  getStructureAt, isValidCoord, getSummoner, findUnitPositionByInstanceId,
  hasStableAbility, getUnitAt, getUnitAbilities, getStunDestinations, getForceDestinations,
} from '../domain/helpers';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import { getBaseCardId, CARD_IDS } from '../domain/ids';
import { useToast } from '../../../contexts/ToastContext';
import { playDeniedSound } from '../../../lib/audio/useGameAudio';
import type { SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import type { BloodSummonModeState, AnnihilateModeState, FuneralPyreModeState } from './StatusBanners';
import type {
  EventTargetModeState, MindControlModeState, ChantEntanglementModeState,
  WithdrawModeState, GlacialShiftModeState, SneakModeState,
  StunModeState, HypnoticLureModeState, TelekinesisTargetModeState,
} from './modeTypes';

// ============================================================================
// 参数
// ============================================================================

interface UseEventCardModesParams {
  core: SummonerWarsCore;
  dispatch: (type: string, payload?: unknown) => void;
  currentPhase: GamePhase;
  myPlayerId: string;
  myHand: import('../domain/types').Card[];
  setSelectedHandCardId: (id: string | null) => void;
  // 外部模式（仅用于 click 早期返回判断，不由本 hook 管理）
  soulTransferMode: SoulTransferModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
  setAfterAttackAbilityMode: (mode: AfterAttackAbilityModeState | null) => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useEventCardModes({
  core, dispatch, currentPhase, myPlayerId, myHand, setSelectedHandCardId,
  soulTransferMode, mindCaptureMode,
  afterAttackAbilityMode, setAfterAttackAbilityMode,
}: UseEventCardModesParams) {
  const { t } = useTranslation('game-summonerwars');
  const showToast = useToast();

  // ---------- 状态 ----------
  const [eventTargetMode, setEventTargetMode] = useState<EventTargetModeState | null>(null);
  const [bloodSummonMode, setBloodSummonMode] = useState<BloodSummonModeState | null>(null);
  const [funeralPyreMode, setFuneralPyreMode] = useState<FuneralPyreModeState | null>(null);
  const [annihilateMode, setAnnihilateMode] = useState<AnnihilateModeState | null>(null);
  const [mindControlMode, setMindControlMode] = useState<MindControlModeState | null>(null);
  const [stunMode, setStunMode] = useState<StunModeState | null>(null);
  const [hypnoticLureMode, setHypnoticLureMode] = useState<HypnoticLureModeState | null>(null);
  const [chantEntanglementMode, setChantEntanglementMode] = useState<ChantEntanglementModeState | null>(null);
  const [sneakMode, setSneakMode] = useState<SneakModeState | null>(null);
  const [glacialShiftMode, setGlacialShiftMode] = useState<GlacialShiftModeState | null>(null);
  const [withdrawMode, setWithdrawMode] = useState<WithdrawModeState | null>(null);
  const [telekinesisTargetMode, setTelekinesisTargetMode] = useState<TelekinesisTargetModeState | null>(null);

  // ---------- 派生 ----------
  const clearAllEventModes = useCallback(() => {
    setEventTargetMode(null);
    setBloodSummonMode(null);
    setAnnihilateMode(null);
    setFuneralPyreMode(null);
    setMindControlMode(null);
    setStunMode(null);
    setHypnoticLureMode(null);
    setChantEntanglementMode(null);
    setSneakMode(null);
    setGlacialShiftMode(null);
    setWithdrawMode(null);
    setTelekinesisTargetMode(null);
    setSelectedHandCardId(null);
  }, [setSelectedHandCardId]);

  const hasActiveEventMode = !!(eventTargetMode || bloodSummonMode || annihilateMode
    || funeralPyreMode || mindControlMode || stunMode || hypnoticLureMode || chantEntanglementMode
    || sneakMode || glacialShiftMode || withdrawMode || telekinesisTargetMode);

  // 阶段切换时自动取消所有多步骤事件卡模式
  // eslint-disable-next-line react-hooks/set-state-in-effect -- phase change batch reset internal state
  useEffect(() => { clearAllEventModes(); }, [currentPhase, clearAllEventModes]);

  // ---------- 高亮计算 ----------

  const validEventTargets = useMemo(() => {
    if (!eventTargetMode) return [];
    return eventTargetMode.validTargets;
  }, [eventTargetMode]);

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

  const mindControlHighlights = useMemo(() => {
    if (!mindControlMode) return [];
    return mindControlMode.validTargets;
  }, [mindControlMode]);

  const entanglementHighlights = useMemo(() => {
    if (!chantEntanglementMode) return [];
    return chantEntanglementMode.validTargets;
  }, [chantEntanglementMode]);

  const glacialShiftHighlights = useMemo(() => {
    if (!glacialShiftMode) return [];
    if (glacialShiftMode.step === 'selectBuilding') {
      const recordedKeys = new Set(glacialShiftMode.recorded.map(r => `${r.position.row}-${r.position.col}`));
      return glacialShiftMode.validBuildings.filter(p => !recordedKeys.has(`${p.row}-${p.col}`));
    }
    if (glacialShiftMode.step === 'selectDestination' && glacialShiftMode.currentBuilding) {
      const result: CellCoord[] = [];
      const { row, col } = glacialShiftMode.currentBuilding;
      // 强制移动只能沿直线（上下左右），逐格检查路径可通行
      const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
      for (const { dr, dc } of dirs) {
        for (let step = 1; step <= 2; step++) {
          const pos = { row: row + dr * step, col: col + dc * step };
          if (!isValidCoord(pos) || !isCellEmpty(core, pos)) break;
          result.push(pos);
        }
      }
      return result;
    }
    return [];
  }, [glacialShiftMode, core]);

  const sneakHighlights = useMemo(() => {
    if (!sneakMode) return [];
    if (sneakMode.step === 'selectUnit') {
      const recordedKeys = new Set(sneakMode.recorded.map(r => `${r.position.row}-${r.position.col}`));
      return sneakMode.validUnits.filter(p => !recordedKeys.has(`${p.row}-${p.col}`));
    }
    if (sneakMode.step === 'selectDirection' && sneakMode.currentUnit) {
      return getAdjacentCells(sneakMode.currentUnit).filter(p => isCellEmpty(core, p));
    }
    return [];
  }, [sneakMode, core]);

  const stunHighlights = useMemo(() => {
    if (!stunMode) return [];
    if (stunMode.step === 'selectDestination' && stunMode.destinations) {
      return stunMode.destinations.map(d => d.position);
    }
    return stunMode.validTargets;
  }, [stunMode]);

  const hypnoticLureHighlights = useMemo(() => {
    if (!hypnoticLureMode) return [];
    return hypnoticLureMode.validTargets;
  }, [hypnoticLureMode]);

  const withdrawHighlights = useMemo(() => {
    if (!withdrawMode || withdrawMode.step !== 'selectPosition') return [];
    const sourcePos = findUnitPositionByInstanceId(core, withdrawMode.sourceUnitId);
    if (!sourcePos) return [];
    const result: CellCoord[] = [];
    // 强制移动只能沿直线（上下左右），逐格检查路径可通行
    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    for (const { dr, dc } of dirs) {
      for (let step = 1; step <= 2; step++) {
        const pos = { row: sourcePos.row + dr * step, col: sourcePos.col + dc * step };
        if (!isValidCoord(pos) || !isCellEmpty(core, pos)) break; // 被阻挡则该方向后续格也不可达
        result.push(pos);
      }
    }
    return result;
  }, [withdrawMode, core]);

  // 念力终点高亮（棋盘点击终点模式）
  const telekinesisHighlights = useMemo(() => {
    if (!telekinesisTargetMode) return [];
    return telekinesisTargetMode.destinations.map(d => d.position);
  }, [telekinesisTargetMode]);

  // 攻击后技能有效位置（念力/高阶念力/读心传念）
  const afterAttackAbilityHighlights = useMemo(() => {
    if (!afterAttackAbilityMode) return [];
    const { abilityId, sourcePosition } = afterAttackAbilityMode;
    const positions: CellCoord[] = [];
    if (abilityId === 'telekinesis' || abilityId === 'high_telekinesis') {
      const maxRange = abilityId === 'high_telekinesis' ? 3 : 2;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (!unit || unit.card.unitClass === 'summoner') continue;
          if (hasStableAbility(unit, core)) continue;
          const dist = manhattanDistance(sourcePosition, { row, col });
          if (dist > 0 && dist <= maxRange) {
            positions.push({ row, col });
          }
        }
      }
    } else if (abilityId === 'mind_transmission') {
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

  // ---------- 事件模式点击处理 ----------

  /**
   * 尝试处理事件卡/多步骤模式的格子点击。
   * 返回 true 表示已处理（调用方应 return），false 表示未匹配任何模式。
   */
  const handleEventModeClick = useCallback((gameRow: number, gameCol: number): boolean => {
    // 殉葬火堆治疗目标选择
    if (funeralPyreMode) {
      const targetUnit = core.board[gameRow]?.[gameCol]?.unit;
      if (targetUnit && targetUnit.damage > 0) {
        dispatch(SW_COMMANDS.FUNERAL_PYRE_HEAL, {
          cardId: funeralPyreMode.cardId,
          targetPosition: { row: gameRow, col: gameCol },
        });
        setFuneralPyreMode(null);
      }
      return true;
    }

    // 灵魂转移确认模式下不处理其他点击
    if (soulTransferMode) return true;

    // 心灵捕获选择模式下不处理其他点击
    if (mindCaptureMode) return true;

    // 攻击后技能目标选择模式
    if (afterAttackAbilityMode) {
      const isValid = afterAttackAbilityHighlights.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        if (afterAttackAbilityMode.abilityId === 'mind_transmission') {
          dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
            abilityId: 'mind_transmission',
            sourceUnitId: afterAttackAbilityMode.sourceUnitId,
            targetPosition: { row: gameRow, col: gameCol },
            _noSnapshot: true,
          });
          setAfterAttackAbilityMode(null);
        } else {
          setAfterAttackAbilityMode(null);
          const tkTargetPos = { row: gameRow, col: gameCol };
          const tkDests = getForceDestinations(core, tkTargetPos, 1);
          setTelekinesisTargetMode({
            abilityId: afterAttackAbilityMode.abilityId,
            sourceUnitId: afterAttackAbilityMode.sourceUnitId,
            sourcePosition: afterAttackAbilityMode.sourcePosition,
            targetPosition: tkTargetPos,
            destinations: tkDests,
          });
        }
      }
      return true;
    }

    // 念力终点点击（棋盘点击终点模式）
    if (telekinesisTargetMode) {
      const dest = telekinesisTargetMode.destinations.find(
        d => d.position.row === gameRow && d.position.col === gameCol
      );
      if (dest) {
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
          abilityId: telekinesisTargetMode.abilityId,
          sourceUnitId: telekinesisTargetMode.sourceUnitId,
          targetPosition: telekinesisTargetMode.targetPosition,
          moveRow: dest.moveRow,
          moveCol: dest.moveCol,
          _noSnapshot: true,
        });
        setTelekinesisTargetMode(null);
      }
      return true;
    }

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
            dispatch(SW_COMMANDS.PLAY_EVENT, { cardId: bloodSummonMode.cardId });
          }
          dispatch(SW_COMMANDS.BLOOD_SUMMON_STEP, {
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
      return true;
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
              dispatch(SW_COMMANDS.PLAY_EVENT, {
                cardId: annihilateMode.cardId,
                targets: annihilateMode.selectedTargets,
                damageTargets: newDamageTargets,
              });
              setAnnihilateMode(null);
            }
          }
        }
      }
      return true;
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
      return true;
    }

    // 震慑目标+终点选择模式
    if (stunMode) {
      if (stunMode.step === 'selectTarget') {
        const isValid = stunMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          const targetPos = { row: gameRow, col: gameCol };
          const summoner = getSummoner(core, myPlayerId as '0' | '1');
          if (summoner) {
            const dests = getStunDestinations(core, targetPos);
            if (dests.length > 0) {
              setStunMode({ ...stunMode, step: 'selectDestination', targetPosition: targetPos, destinations: dests });
            } else {
              // 无可达终点（四面被建筑堵死），仍然可以打出（只造成伤害不推拉）
              dispatch(SW_COMMANDS.PLAY_EVENT, {
                cardId: stunMode.cardId,
                targets: [targetPos],
                direction: 'push',
                distance: 1,
              });
              setStunMode(null);
              setSelectedHandCardId(null);
            }
          }
        }
      } else if (stunMode.step === 'selectDestination' && stunMode.destinations && stunMode.targetPosition) {
        const dest = stunMode.destinations.find(d => d.position.row === gameRow && d.position.col === gameCol);
        if (dest) {
          dispatch(SW_COMMANDS.PLAY_EVENT, {
            cardId: stunMode.cardId,
            targets: [stunMode.targetPosition],
            moveRow: dest.moveRow,
            moveCol: dest.moveCol,
            distance: dest.distance,
          });
          setStunMode(null);
          setSelectedHandCardId(null);
        }
      }
      return true;
    }

    // 撤退位置选择模式
    if (withdrawMode && withdrawMode.step === 'selectPosition') {
      const isValid = withdrawHighlights.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
          abilityId: 'withdraw',
          sourceUnitId: withdrawMode.sourceUnitId,
          costType: withdrawMode.costType,
          targetPosition: { row: gameRow, col: gameCol },
          _noSnapshot: true,
        });
        setWithdrawMode(null);
      }
      return true;
    }

    // 冰川位移目标选择模式
    if (glacialShiftMode) {
      if (glacialShiftMode.step === 'selectBuilding') {
        const isValid = glacialShiftHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          setGlacialShiftMode({ ...glacialShiftMode, step: 'selectDestination', currentBuilding: { row: gameRow, col: gameCol } });
        }
      } else if (glacialShiftMode.step === 'selectDestination' && glacialShiftMode.currentBuilding) {
        const isValid = glacialShiftHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          const newRecorded = [...glacialShiftMode.recorded, { position: glacialShiftMode.currentBuilding, newPosition: { row: gameRow, col: gameCol } }];
          if (newRecorded.length >= 3) {
            dispatch(SW_COMMANDS.PLAY_EVENT, {
              cardId: glacialShiftMode.cardId,
              shiftDirections: newRecorded,
            });
            setGlacialShiftMode(null);
            setSelectedHandCardId(null);
          } else {
            setGlacialShiftMode({ ...glacialShiftMode, step: 'selectBuilding', currentBuilding: undefined, recorded: newRecorded });
          }
        }
      }
      return true;
    }

    // 潜行目标选择模式
    if (sneakMode) {
      if (sneakMode.step === 'selectUnit') {
        const isValid = sneakHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          setSneakMode({ ...sneakMode, step: 'selectDirection', currentUnit: { row: gameRow, col: gameCol } });
        }
      } else if (sneakMode.step === 'selectDirection' && sneakMode.currentUnit) {
        const isValid = sneakHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          const newRecorded = [...sneakMode.recorded, { position: sneakMode.currentUnit, newPosition: { row: gameRow, col: gameCol } }];
          setSneakMode({ ...sneakMode, step: 'selectUnit', currentUnit: undefined, recorded: newRecorded });
        }
      }
      return true;
    }

    // 交缠颂歌目标选择模式
    if (chantEntanglementMode) {
      const isValid = entanglementHighlights.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        const key = `${gameRow}-${gameCol}`;
        const selectedKeys = new Set(chantEntanglementMode.selectedTargets.map(p => `${p.row}-${p.col}`));
        if (selectedKeys.has(key)) {
          setChantEntanglementMode({
            ...chantEntanglementMode,
            selectedTargets: chantEntanglementMode.selectedTargets.filter(p => !(p.row === gameRow && p.col === gameCol)),
          });
        } else if (chantEntanglementMode.selectedTargets.length < 2) {
          setChantEntanglementMode({
            ...chantEntanglementMode,
            selectedTargets: [...chantEntanglementMode.selectedTargets, { row: gameRow, col: gameCol }],
          });
        }
      }
      return true;
    }

    // 催眠引诱目标选择模式
    if (hypnoticLureMode) {
      const isValid = hypnoticLureMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        dispatch(SW_COMMANDS.PLAY_EVENT, {
          cardId: hypnoticLureMode.cardId,
          targets: [{ row: gameRow, col: gameCol }],
        });
        setHypnoticLureMode(null);
        setSelectedHandCardId(null);
      }
      return true;
    }

    // 事件目标选择模式
    if (eventTargetMode) {
      const isValidTarget = eventTargetMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidTarget) {
        dispatch(SW_COMMANDS.PLAY_EVENT, { cardId: eventTargetMode.cardId, targets: [{ row: gameRow, col: gameCol }] });
      }
      setEventTargetMode(null);
      setSelectedHandCardId(null);
      return true;
    }

    // 未匹配任何事件模式
    return false;
  }, [core, dispatch, myPlayerId, setSelectedHandCardId,
    funeralPyreMode, soulTransferMode, mindCaptureMode,
    afterAttackAbilityMode, afterAttackAbilityHighlights, setAfterAttackAbilityMode,
    telekinesisTargetMode,
    bloodSummonMode, bloodSummonHighlights,
    annihilateMode, mindControlMode, stunMode,
    withdrawMode, withdrawHighlights,
    glacialShiftMode, glacialShiftHighlights,
    sneakMode, sneakHighlights,
    chantEntanglementMode, entanglementHighlights,
    hypnoticLureMode, eventTargetMode]);

  // ---------- 打出事件卡 ----------

  const handlePlayEvent = useCallback((cardId: string) => {
    const card = myHand.find(c => c.id === cardId);
    if (!card || card.cardType !== 'event') return;
    const eventCard = card as EventCard;
    const baseId = getBaseCardId(eventCard.id);

    // 每个 case 成功进入模式时设 activated=true；条件不满足时可设 failReason 覆盖通用提示
    let activated = false;
    let failReason: string | undefined;

    switch (baseId) {
      case CARD_IDS.NECRO_HELLFIRE_BLADE: {
        const friendlyCommons = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass === 'common');
        if (friendlyCommons.length === 0) break;
        setEventTargetMode({ cardId, card: eventCard, validTargets: friendlyCommons.map(u => u.position) });
        activated = true;
        break;
      }
      case CARD_IDS.NECRO_BLOOD_SUMMON: {
        const friendlyUnits = getPlayerUnits(core, myPlayerId as '0' | '1');
        if (friendlyUnits.length === 0) break;
        setBloodSummonMode({ step: 'selectTarget', cardId });
        activated = true;
        break;
      }
      case CARD_IDS.NECRO_ANNIHILATE: {
        const friendlyUnits = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        if (friendlyUnits.length === 0) break;
        setAnnihilateMode({ step: 'selectTargets', cardId, selectedTargets: [], currentTargetIndex: 0, damageTargets: [] });
        activated = true;
        break;
      }
      case CARD_IDS.TRICKSTER_MIND_CONTROL: {
        const summoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!summoner) { failReason = t('eventCard.noSummoner'); break; }
        const opponentId = myPlayerId === '0' ? '1' : '0';
        const enemyUnits = getPlayerUnits(core, opponentId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner' && manhattanDistance(summoner.position, u.position) <= 2);
        if (enemyUnits.length === 0) break;
        setMindControlMode({ cardId, validTargets: enemyUnits.map(u => u.position), selectedTargets: [] });
        activated = true;
        break;
      }
      case CARD_IDS.TRICKSTER_STUN: {
        const stunSummoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!stunSummoner) { failReason = t('eventCard.noSummoner'); break; }
        const stunOpponentId = myPlayerId === '0' ? '1' : '0';
        const stunTargets = getPlayerUnits(core, stunOpponentId as '0' | '1')
          .filter(u => {
            if (u.card.unitClass === 'summoner') return false;
            const dist = manhattanDistance(stunSummoner.position, u.position);
            return dist <= 3 && dist > 0 && isInStraightLine(stunSummoner.position, u.position);
          });
        if (stunTargets.length === 0) break;
        setStunMode({ step: 'selectTarget', cardId, validTargets: stunTargets.map(u => u.position) });
        activated = true;
        break;
      }
      case CARD_IDS.TRICKSTER_HYPNOTIC_LURE: {
        const lureOpponentId = myPlayerId === '0' ? '1' : '0';
        const lureTargets = getPlayerUnits(core, lureOpponentId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        if (lureTargets.length === 0) break;
        setHypnoticLureMode({ cardId, validTargets: lureTargets.map(u => u.position) });
        activated = true;
        break;
      }
      case CARD_IDS.BARBARIC_CHANT_OF_POWER: {
        const cpSummoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!cpSummoner) { failReason = t('eventCard.noSummoner'); break; }
        const cpTargets = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner' && manhattanDistance(cpSummoner.position, u.position) <= 3);
        if (cpTargets.length === 0) break;
        setEventTargetMode({ cardId, card: eventCard, validTargets: cpTargets.map(u => u.position) });
        activated = true;
        break;
      }
      case CARD_IDS.BARBARIC_CHANT_OF_GROWTH: {
        const cgTargets = getPlayerUnits(core, myPlayerId as '0' | '1');
        if (cgTargets.length === 0) break;
        setEventTargetMode({ cardId, card: eventCard, validTargets: cgTargets.map(u => u.position) });
        activated = true;
        break;
      }
      case CARD_IDS.BARBARIC_CHANT_OF_WEAVING: {
        const cwTargets = getPlayerUnits(core, myPlayerId as '0' | '1');
        if (cwTargets.length === 0) break;
        setEventTargetMode({ cardId, card: eventCard, validTargets: cwTargets.map(u => u.position) });
        activated = true;
        break;
      }
      case CARD_IDS.FROST_GLACIAL_SHIFT: {
        const gsSummoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!gsSummoner) { failReason = t('eventCard.noSummoner'); break; }
        const gsBuildings: CellCoord[] = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
          for (let c = 0; c < BOARD_COLS; c++) {
            const pos = { row: r, col: c };
            const structure = getStructureAt(core, pos);
            const unit = getUnitAt(core, pos);
            const isAllyStructure = (structure && structure.owner === (myPlayerId as '0' | '1'))
              || (unit && unit.owner === (myPlayerId as '0' | '1')
                && getUnitAbilities(unit, core).includes('mobile_structure'));
            if (isAllyStructure
              && manhattanDistance(gsSummoner.position, pos) <= 3) {
              gsBuildings.push(pos);
            }
          }
        }
        if (gsBuildings.length === 0) break;
        setGlacialShiftMode({ cardId, step: 'selectBuilding', validBuildings: gsBuildings, recorded: [] });
        activated = true;
        break;
      }
      case CARD_IDS.GOBLIN_SNEAK: {
        const sneakUnits = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.cost === 0 && u.card.unitClass !== 'summoner');
        if (sneakUnits.length === 0) break;
        setSneakMode({ cardId, step: 'selectUnit', validUnits: sneakUnits.map(u => u.position), recorded: [] });
        activated = true;
        break;
      }
      case CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT: {
        const summoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!summoner) { failReason = t('eventCard.noSummoner'); break; }
        const friendlyCommons = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass === 'common' && manhattanDistance(summoner.position, u.position) <= 3);
        if (friendlyCommons.length < 2) {
          failReason = t('eventCard.entanglementNeedTwoCommons');
          break;
        }
        setChantEntanglementMode({ cardId, validTargets: friendlyCommons.map(u => u.position), selectedTargets: [] });
        activated = true;
        break;
      }
      default: {
        // 无需多步骤交互的事件卡，直接 dispatch
        dispatch(SW_COMMANDS.PLAY_EVENT, { cardId });
        return; // 直接返回，不走统一的 activated 逻辑
      }
    }

    if (activated) {
      setSelectedHandCardId(cardId);
    } else {
      // 统一失败反馈：拒绝音 + toast
      playDeniedSound();
      showToast.warning(failReason ?? t('eventCard.noValidTarget'));
    }
  }, [core, myHand, myPlayerId, dispatch, setSelectedHandCardId, showToast, t]);

  // ---------- 确认回调 ----------

  const handleConfirmMindControl = useCallback(() => {
    if (!mindControlMode || mindControlMode.selectedTargets.length === 0) return;
    dispatch(SW_COMMANDS.PLAY_EVENT, {
      cardId: mindControlMode.cardId,
      targets: mindControlMode.selectedTargets,
    });
    setMindControlMode(null);
    setSelectedHandCardId(null);
  }, [dispatch, mindControlMode, setSelectedHandCardId]);

  const handleConfirmStun = useCallback(() => {
    // 不再需要：dispatch 已在 handleEventModeClick 中直接完成
  }, []);

  const handleConfirmGlacialShift = useCallback(() => {
    if (!glacialShiftMode || glacialShiftMode.recorded.length === 0) return;
    dispatch(SW_COMMANDS.PLAY_EVENT, {
      cardId: glacialShiftMode.cardId,
      shiftDirections: glacialShiftMode.recorded,
    });
    setGlacialShiftMode(null);
    setSelectedHandCardId(null);
  }, [dispatch, glacialShiftMode, setSelectedHandCardId]);

  const handleConfirmSneak = useCallback(() => {
    if (!sneakMode || sneakMode.recorded.length === 0) return;
    dispatch(SW_COMMANDS.PLAY_EVENT, {
      cardId: sneakMode.cardId,
      sneakDirections: sneakMode.recorded,
    });
    setSneakMode(null);
    setSelectedHandCardId(null);
  }, [dispatch, sneakMode, setSelectedHandCardId]);

  const handleConfirmEntanglement = useCallback(() => {
    if (!chantEntanglementMode || chantEntanglementMode.selectedTargets.length < 2) return;
    dispatch(SW_COMMANDS.PLAY_EVENT, {
      cardId: chantEntanglementMode.cardId,
      targets: chantEntanglementMode.selectedTargets,
    });
    setChantEntanglementMode(null);
    setSelectedHandCardId(null);
  }, [dispatch, chantEntanglementMode, setSelectedHandCardId]);

  const handleConfirmTelekinesis = useCallback((_direction?: 'push' | 'pull', _axis?: 'row' | 'col') => {
    // 念力已改为棋盘点击终点模式，dispatch 在 handleEventModeClick 中完成
    // 此回调保留为空实现，供 StatusBanners 向后兼容
  }, []);

  // ---------- 副作用 ----------

  // 检测殉葬火堆充能
  useEffect(() => {
    if (funeralPyreMode) return;
    const player = core.players[myPlayerId as '0' | '1'];
    if (!player) return;
    for (const ev of player.activeEvents) {
      const baseId = getBaseCardId(ev.id);
      if (baseId === CARD_IDS.NECRO_FUNERAL_PYRE && (ev.charges ?? 0) > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync game state to UI mode
        setFuneralPyreMode({ cardId: ev.id, charges: ev.charges ?? 0 });
        return;
      }
    }
  }, [core.players, myPlayerId, funeralPyreMode]);

  // ---------- 返回 ----------

  return {
    // 模式状态
    eventTargetMode, bloodSummonMode, setBloodSummonMode,
    annihilateMode, setAnnihilateMode,
    funeralPyreMode, setFuneralPyreMode,
    mindControlMode, setMindControlMode,
    stunMode, setStunMode,
    hypnoticLureMode, setHypnoticLureMode,
    chantEntanglementMode, setChantEntanglementMode,
    sneakMode, setSneakMode,
    glacialShiftMode, setGlacialShiftMode,
    withdrawMode, setWithdrawMode,
    telekinesisTargetMode, setTelekinesisTargetMode,
    // 派生
    clearAllEventModes, hasActiveEventMode,
    // 高亮
    validEventTargets, bloodSummonHighlights, annihilateHighlights,
    mindControlHighlights, entanglementHighlights, glacialShiftHighlights,
    sneakHighlights, stunHighlights, hypnoticLureHighlights,
    withdrawHighlights, afterAttackAbilityHighlights, telekinesisHighlights,
    // 回调
    handleEventModeClick, handlePlayEvent,
    handleConfirmMindControl, handleConfirmStun,
    handleConfirmGlacialShift, handleConfirmSneak,
    handleConfirmEntanglement, handleConfirmTelekinesis,
  };
}
