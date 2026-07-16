/**
 * 召唤师战争 - 格子交互逻辑 Hook（编排层）
 *
 * 组合 useEventCardModes 子 hook，处理核心阶段交互（召唤/移动/攻击/建造）
 * 和技能模式交互。事件卡多步骤模式已委托给 useEventCardModes。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAutoSkipPhase } from '../../../components/game/framework';
import { useTranslation } from 'react-i18next';
import type { SummonerWarsCore, CellCoord, UnitCard, GamePhase, EventCard } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import {
  getValidSummonPositionsForCard, getValidBuildPositions,
  getValidMoveTargetsEnhanced, getValidAttackTargetsEnhanced,
  getPlayerUnits, hasAvailableActions,
  manhattanDistance,
  getUnitAbilities,
  normalizeUnitBoosts,
} from '../domain/helpers';
import { isUndeadCard, getBaseCardId, CARD_IDS, isMoguFungalBeastCard } from '../domain/ids';
import { getSummonerWarsUIHints } from '../domain/uiHints';
import { extractPositions } from '../../../engine/primitives/uiHints';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import type { AbilityModeState, SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import { useToast } from '../../../contexts/ToastContext';
import { useEventCardModes, requiresEventInteraction } from './useEventCardModes';
import type { InteractionDescriptor, PromptOption } from '../../../engine/systems/InteractionSystem';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import {
  findSystemAbilityPositionOption,
  findSystemAbilityUnitOptionByPosition,
  getSystemAbilityUiRoute,
  listSystemAbilityPositionTargets,
  resolveBeforeAttackCancellation,
  resolveBeforeAttackCardConfirmation,
  type SwSimpleChoiceInteraction,
} from './systemInteractionAdapter';

// ============================================================================
// 辅助函数
// ============================================================================

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
  /** 当前系统交互（来自 sys.interaction.current） */
  interaction?: InteractionDescriptor | null;
  // 外部模式状态
  abilityMode: AbilityModeState | null;
  setAbilityMode: (mode: AbilityModeState | null) => void;
  soulTransferMode: SoulTransferModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
  rapidFireMode: import('./modeTypes').RapidFireModeState | null;
}

const ADVANCE_PHASE_THROTTLE_MS = 700;
const ADVANCE_PHASE_FALLBACK_RELEASE_MS = 2500;

// ============================================================================
// Hook 实现
// ============================================================================

export function useCellInteraction({
  core, dispatch, currentPhase, isMyTurn, isGameOver,
  myPlayerId, activePlayerId, myHand, fromViewCoord,
  undoSnapshotCount,
  interaction,
  abilityMode, setAbilityMode, soulTransferMode,
  mindCaptureMode,
  afterAttackAbilityMode,
  rapidFireMode,
}: UseCellInteractionParams) {
  const { t } = useTranslation('game-summonerwars');
  const showToast = useToast();

  // ---------- 核心状态 ----------
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardsForDiscard, setSelectedCardsForDiscard] = useState<string[]>([]);
  const [endPhaseConfirmPending, setEndPhaseConfirmPending] = useState(false);
  const [isPhaseAdvanceLocked, setIsPhaseAdvanceLocked] = useState(false);
  const phaseAdvanceCooldownUntilRef = useRef(0);
  const phaseAdvanceReleaseTimerRef = useRef<number | null>(null);

  // 离开魔力阶段时自动清空弃牌选中和事件卡选择模式
  useEffect(() => {
    if (currentPhase !== 'magic') {
      queueMicrotask(() => {
        setSelectedCardsForDiscard([]);
      });
    }
  }, [currentPhase]);

  // ---------- InteractionSystem（SummonerWars） ----------
  const swInteraction = useMemo(() => {
    if (!interaction || interaction.kind !== 'simple-choice') return null;
    if (interaction.playerId !== (myPlayerId as '0' | '1')) return null;
    const data = interaction.data as { sw?: { type?: string } & Record<string, unknown>; options?: PromptOption[] };
    if (!data?.sw || typeof data.sw !== 'object') return null;
    return {
      id: interaction.id,
      type: (data.sw as { type?: string }).type ?? '',
      meta: data.sw as Record<string, unknown>,
      options: (data.options ?? []) as PromptOption[],
    } satisfies SwSimpleChoiceInteraction;
  }, [interaction, myPlayerId]);

  const respondInteractionOption = useCallback((optionId: string | null, optionIds?: string[]) => {
    if (!swInteraction) return;
    if (Array.isArray(optionIds) && optionIds.length > 0) {
      dispatch(INTERACTION_COMMANDS.RESPOND, {
        interactionId: swInteraction.id,
        optionIds,
      });
      return;
    }
    if (!optionId) return;
    dispatch(INTERACTION_COMMANDS.RESPOND, {
      interactionId: swInteraction.id,
      optionId,
    });
  }, [dispatch, swInteraction]);

  const magicEventChoiceMode = useMemo(() => {
    if (!swInteraction || swInteraction.type !== 'magic_event_choice') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : undefined;
    if (!cardId) return null;
    return { cardId };
  }, [swInteraction]);

  const fireSacrificeSummonMode = useMemo(() => {
    if (swInteraction?.type === 'fire_sacrifice_summon') {
      const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : undefined;
      if (cardId) return { handCardId: cardId };
    }
    return null;
  }, [swInteraction]);

  // ---------- 事件卡模式子 hook ----------
  const eventCardModes = useEventCardModes({
    core, dispatch, currentPhase, myPlayerId, myHand, setSelectedHandCardId,
    swInteraction,
    respondInteractionOption,
    soulTransferMode, mindCaptureMode,
    afterAttackAbilityMode,
  });

  const interactionPositionOptions = useMemo(() => {
    if (!swInteraction) return [];
    if (swInteraction.type !== 'grab_follow' && swInteraction.type !== 'feed_beast') return [];
    return swInteraction.options.filter((opt) => {
      const val = opt.value as { targetPosition?: CellCoord; choice?: string } | undefined;
      if (!val?.targetPosition) return false;
      if (swInteraction.type === 'feed_beast' && val.choice !== 'destroy_adjacent') return false;
      return true;
    });
  }, [swInteraction]);

  const interactionPositions = useMemo(() => (
    interactionPositionOptions
      .map((opt) => (opt.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
      .filter((pos): pos is CellCoord => !!pos)
  ), [interactionPositionOptions]);

  // ---------- 核心阶段高亮 ----------

  const selectedHandCard = useMemo(() => {
    if (!selectedHandCardId) return null;
    return myHand.find(c => c.id === selectedHandCardId) ?? null;
  }, [selectedHandCardId, myHand]);

  const selectedStructureEventCard = useMemo(() => {
    if (!selectedHandCard || selectedHandCard.cardType !== 'event') return null;
    const eventCard = selectedHandCard as EventCard;
    if (eventCard.life === undefined || eventCard.playPhase !== 'build') return null;
    return eventCard;
  }, [selectedHandCard]);

  const validSummonPositions = useMemo(() => {
    // 火祀召唤模式：先选牺牲品，不显示普通召唤位置
    if (fireSacrificeSummonMode) return [];
    if (!isMyTurn || !selectedHandCard || selectedHandCard.cardType !== 'unit') return [];
    if ((selectedHandCard.abilities ?? []).includes('mogu_final_form')) {
      if (currentPhase !== 'summon') return [];
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(unit => isMoguFungalBeastCard(unit.card) && normalizeUnitBoosts(unit.boosts) >= 5)
        .map(unit => unit.position);
    }
    const player = core.players[myPlayerId as '0' | '1'];
    // 重燃希望：允许在任意阶段召唤
    const hasRekindleHope = player.activeEvents.some(ev =>
      getBaseCardId(ev.id) === CARD_IDS.PALADIN_REKINDLE_HOPE
    );
    if (currentPhase !== 'summon' && !hasRekindleHope) return [];
    return getValidSummonPositionsForCard(core, myPlayerId as '0' | '1', selectedHandCard);
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard, fireSacrificeSummonMode]);

  const validBuildPositions = useMemo(() => {
    if (currentPhase !== 'build' || !isMyTurn || !selectedHandCard) return [];
    if (selectedHandCard.cardType !== 'structure' && !selectedStructureEventCard) return [];
    return getValidBuildPositions(core, myPlayerId as '0' | '1');
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard, selectedStructureEventCard]);

  // 技能目标位置（系统交互分支优先使用 InteractionSystem options 作为权威真相源）
  const validAbilityPositions = useMemo(() => {
    if (interactionPositions.length > 0) return interactionPositions;
    if (!abilityMode || !swInteraction) return [];
    return listSystemAbilityPositionTargets(swInteraction, abilityMode);
  }, [abilityMode, interactionPositions, swInteraction]);

  // 技能可选单位（系统交互分支优先使用 InteractionSystem options 作为权威真相源）
  const validAbilityUnits = useMemo(() => {
    if (swInteraction?.type === 'fire_sacrifice_summon') {
      return swInteraction.options
        .map((opt) => {
          const value = opt.value as { action?: string; sacrificeUnitId?: string } | undefined;
          if (value?.action !== 'fire_sacrifice_summon' || !value.sacrificeUnitId) return null;
          const unit = core.board.flatMap((row) => row.map((cell) => cell.unit))
            .find((u) => u?.instanceId === value.sacrificeUnitId);
          return unit?.position ?? null;
        })
        .filter((pos): pos is CellCoord => !!pos);
    }
    // 火祀召唤：选中伊路特-巴尔手牌后，高亮所有可牺牲的友方单位（非召唤师，任意位置）
    if (fireSacrificeSummonMode) {
      return getPlayerUnits(core, myPlayerId as '0' | '1')
        .filter(u => u.card.unitClass !== 'summoner')
        .map(u => u.position);
    }
    if (!abilityMode || abilityMode.step !== 'selectUnit' || !swInteraction) return [];

    const targets: CellCoord[] = [];
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const targetPosition = { row, col };
        const targetUnitId = core.board[row]?.[col]?.unit?.instanceId;
        const option = findSystemAbilityUnitOptionByPosition(
          swInteraction,
          abilityMode,
          targetPosition,
          targetUnitId,
        );
        if (option) {
          targets.push(targetPosition);
        }
      }
    }
    return targets;
  }, [abilityMode, core, fireSacrificeSummonMode, myPlayerId, swInteraction]);

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
    if (!selectedUnit || !selectedUnit.healingMode) {
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
  }, [core, currentPhase, isMyTurn, myPlayerId]);

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

  // ---------- 格子点击 ----------

  const handleCellClick = (row: number, col: number) => {
    const { row: gameRow, col: gameCol } = fromViewCoord({ row, col });

    // 任何格子交互都重置结束阶段确认状态
     
    setEndPhaseConfirmPending(false);

    const selectedCard = selectedHandCardId
      ? myHand.find((card) => card.id === selectedHandCardId)
      : undefined;
    const isSelectedInteractiveEvent = !!selectedCard
      && selectedCard.cardType === 'event'
      && requiresEventInteraction(selectedCard.id);
    const isArmedNonInteractiveEvent = !!selectedCard
      && selectedCard.cardType === 'event'
      && !isSelectedInteractiveEvent
      && !(currentPhase === 'build' && (selectedCard as EventCard).life !== undefined)
      && !eventCardModes.hasActiveEventMode
      && !swInteraction;
    if (isArmedNonInteractiveEvent) {
      setSelectedHandCardId(null);
      return;
    }

    // InteractionSystem：抓附跟随 / 喂养巨食兽（相邻吞噬）
    if (swInteraction && (swInteraction.type === 'grab_follow' || swInteraction.type === 'feed_beast')) {
      const option = interactionPositionOptions.find((opt) => {
        const pos = (opt.value as { targetPosition?: CellCoord } | undefined)?.targetPosition;
        return pos?.row === gameRow && pos?.col === gameCol;
      });
      if (option) {
        dispatch(INTERACTION_COMMANDS.RESPOND, {
          interactionId: swInteraction.id,
          optionId: option.id,
        });
      }
      return;
    }

    // 事件卡/多步骤模式优先处理
    if (eventCardModes.handleEventModeClick(gameRow, gameCol)) return;
    if (isSelectedInteractiveEvent) return;

    // 技能选卡模式（圣光箭/治疗弃牌选择）：拦截格子点击，防止重复触发
    if (abilityMode && abilityMode.step === 'selectCards') {
      return; // 选卡模式下只允许手牌交互，不响应棋盘点击
    }

    if (swInteraction?.type === 'fire_sacrifice_summon') {
      const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
      if (!clickedUnit) return;
      const optionId = swInteraction.options.find((opt) => {
        const value = opt.value as { action?: string; sacrificeUnitId?: string } | undefined;
        return value?.action === 'fire_sacrifice_summon' && value.sacrificeUnitId === clickedUnit.instanceId;
      })?.id ?? null;
      if (!optionId) return;
      respondInteractionOption(optionId);
      setSelectedHandCardId(null);
      return;
    }

    // 技能单位选择模式（火祀召唤、吸取生命、幻化、结构变换等）
    if (abilityMode && abilityMode.step === 'selectUnit') {
      const isValid = validAbilityUnits.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        const targetUnit = core.board[gameRow]?.[gameCol]?.unit;
        const option = findSystemAbilityUnitOptionByPosition(
          swInteraction,
          abilityMode,
          { row: gameRow, col: gameCol },
          targetUnit?.instanceId,
        );
        if (option) {
          respondInteractionOption(option.id);
          setAbilityMode(null);
          return;
        }

        if (abilityMode.context === 'beforeAttack') {
          // 现役 beforeAttack 选目标分支已由 useGameEvents.test.ts 的路由矩阵门禁覆盖；
          // 落到这里说明新增了系统交互分支，但没有同步补齐棋盘点击消费逻辑。
          console.warn('[SummonerWars] 未处理的系统攻击前选目标分支', {
            abilityId: abilityMode.abilityId,
            swInteractionType: swInteraction?.type ?? null,
            targetUnitId: targetUnit?.instanceId ?? null,
            targetPosition: { row: gameRow, col: gameCol },
          });
          return;
        }

        // 现役 selectUnit 分支已由 useGameEvents.test.ts 的路由矩阵门禁覆盖；
        // 落到这里说明新增 abilityMode 路由后，没有同步补齐单位点击消费逻辑。
        console.warn('[SummonerWars] 未处理的系统能力单位选择分支', {
          abilityId: abilityMode.abilityId,
          step: abilityMode.step,
          context: abilityMode.context,
          swInteractionType: swInteraction?.type ?? null,
          targetUnitId: targetUnit?.instanceId ?? null,
          targetPosition: { row: gameRow, col: gameCol },
        });
        return;
      }
      return;
    }

    if (
      abilityMode
      && getSystemAbilityUiRoute(abilityMode) === 'board-cell-position'
      && abilityMode.step !== 'selectUnit'
    ) {
      const isValid = validAbilityPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        const option = findSystemAbilityPositionOption(swInteraction, abilityMode, { row: gameRow, col: gameCol });
        if (option) {
          respondInteractionOption(option.id);
          setAbilityMode(null);
        } else {
          console.warn('[SummonerWars] 未处理的系统能力位置选择分支', {
            abilityId: abilityMode.abilityId,
            step: abilityMode.step,
            structurePosition: abilityMode.structurePosition ?? null,
            targetPosition: abilityMode.targetPosition ?? null,
            selectedPosition: { row: gameRow, col: gameCol },
            swInteractionType: swInteraction?.type ?? null,
            route: getSystemAbilityUiRoute(abilityMode),
          });
        }
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
            dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
              abilityId: 'revive_undead',
              sourceUnitId: clickedUnit.instanceId,
            });
            return;
          }
        }
      }
    }

    // 召唤阶段：执行召唤
    if (currentPhase === 'summon' && selectedHandCardId) {
      const isValidPosition = validSummonPositions.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidPosition) {
        const selectedUnitCard = selectedHandCard?.cardType === 'unit' ? selectedHandCard : null;
        const replacementTarget = core.board[gameRow]?.[gameCol]?.unit;
        const isMoguFinalFormSummon = !!selectedUnitCard
          && (selectedUnitCard.abilities ?? []).includes('mogu_final_form');
        dispatch(SW_COMMANDS.SUMMON_UNIT, {
          cardId: selectedHandCardId,
          position: { row: gameRow, col: gameCol },
          ...(isMoguFinalFormSummon && replacementTarget
            ? { sacrificeUnitId: replacementTarget.instanceId }
            : {}),
        });
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
        if (selectedStructureEventCard) {
          dispatch(SW_COMMANDS.PLAY_EVENT, {
            cardId: selectedHandCardId,
            targets: [{ row: gameRow, col: gameCol }],
          });
        } else {
          dispatch(SW_COMMANDS.BUILD_STRUCTURE, { cardId: selectedHandCardId, position: { row: gameRow, col: gameCol } });
        }
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
          // 被动触发技能已迁移到 InteractionSystem：直接声明攻击，由 domain 决定是否先拦截成交互
          dispatch(SW_COMMANDS.DECLARE_ATTACK, {
            attacker: core.selectedUnit,
            target: { row: gameRow, col: gameCol },
          });
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
  };

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
          // 进入系统交互：打出或弃牌
          dispatch(SW_COMMANDS.REQUEST_MAGIC_EVENT_CHOICE, { cardId });
          return;
        }
      }
    }

    if (abilityMode && abilityMode.step === 'selectCards') {
      const card = myHand.find(c => c.id === cardId);
      if (!card) return;
      const route = getSystemAbilityUiRoute(abilityMode);
      if (route !== 'hand-card-select') {
        console.warn('[SummonerWars] 未处理的系统能力选牌分支', {
          abilityId: abilityMode.abilityId,
          step: abilityMode.step,
          context: abilityMode.context,
          swInteractionType: swInteraction?.type ?? null,
          cardId,
          route,
        });
        return;
      }
      const selected = abilityMode.selectedCardIds ?? [];
      const isSelected = selected.includes(cardId);
      if (
        abilityMode.selectableCardIds
        && abilityMode.selectableCardIds.length > 0
        && !abilityMode.selectableCardIds.includes(cardId)
      ) {
        return;
      }
      if (isSelected) {
        setAbilityMode({ ...abilityMode, selectedCardIds: selected.filter(id => id !== cardId) });
        return;
      }
      if (abilityMode.abilityId === 'holy_arrow') {
        if (card.cardType !== 'unit') {
          showToast.warning(t('handArea.holyArrowUnitOnly'));
          return;
        }
        if (swInteraction?.type === 'before_attack_holy_arrow') {
          const hasMatchingInteractionOption = swInteraction.options.some((opt) => {
            const value = opt.value as { action?: string; cardId?: string } | undefined;
            return value?.action === 'before_attack_holy_arrow' && value.cardId === cardId;
          });
          if (!hasMatchingInteractionOption) {
            return;
          }
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
  }, [abilityMode, core, currentPhase, dispatch, isMyTurn, myHand, myPlayerId, setAbilityMode, showToast, swInteraction, t]);

  // 手牌选中（召唤/建造阶段单选）
  const handleCardSelect = (cardId: string | null) => {
    setEndPhaseConfirmPending(false);

    // 血契召唤 selectCard 步骤：选中要召唤的单位卡
    if (eventCardModes.bloodSummonMode?.step === 'selectCard' && cardId) {
      const card = myHand.find(c => c.id === cardId);
      if (card && card.cardType === 'unit' && (card as UnitCard).cost <= 2) {
        if (swInteraction?.type === 'blood_summon_select_card') {
          const option = swInteraction.options.find((opt) => {
            const value = opt.value as { action?: string; summonCardId?: string } | undefined;
            return value?.action === 'blood_summon_card' && value.summonCardId === cardId;
          });
          if (option) {
            respondInteractionOption(option.id);
            setSelectedHandCardId(cardId);
          }
          return;
        }
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
  };

  // 确认弃牌换魔力
  const handleConfirmDiscard = useCallback(() => {
    if (selectedCardsForDiscard.length > 0) {
      dispatch(SW_COMMANDS.DISCARD_FOR_MAGIC, { cardIds: selectedCardsForDiscard });
      setSelectedCardsForDiscard([]);
    }
  }, [dispatch, selectedCardsForDiscard]);

  // ---------- 阶段控制 ----------

  useEffect(() => { queueMicrotask(() => setEndPhaseConfirmPending(false)); }, [currentPhase]);

  useEffect(() => {
    if (!isPhaseAdvanceLocked) return;
    queueMicrotask(() => {
      setIsPhaseAdvanceLocked(false);
      phaseAdvanceCooldownUntilRef.current = 0;
      if (phaseAdvanceReleaseTimerRef.current !== null) {
        window.clearTimeout(phaseAdvanceReleaseTimerRef.current);
        phaseAdvanceReleaseTimerRef.current = null;
      }
    });
  }, [currentPhase, isMyTurn, isPhaseAdvanceLocked]);

  useEffect(() => () => {
    if (phaseAdvanceReleaseTimerRef.current !== null) {
      window.clearTimeout(phaseAdvanceReleaseTimerRef.current);
      phaseAdvanceReleaseTimerRef.current = null;
    }
  }, []);

  // 强制技能模式：这些技能没有"跳过"选项，必须完成后才能推进阶段
  const isMandatoryAbilityActive = !!abilityMode && ['blood_rune'].includes(abilityMode.abilityId);

  const advancePhaseSafely = useCallback(() => {
    const now = Date.now();
    if (isPhaseAdvanceLocked || now < phaseAdvanceCooldownUntilRef.current) return false;
    phaseAdvanceCooldownUntilRef.current = now + ADVANCE_PHASE_THROTTLE_MS;
    setIsPhaseAdvanceLocked(true);
    if (phaseAdvanceReleaseTimerRef.current !== null) {
      window.clearTimeout(phaseAdvanceReleaseTimerRef.current);
    }
    phaseAdvanceReleaseTimerRef.current = window.setTimeout(() => {
      setIsPhaseAdvanceLocked(false);
      phaseAdvanceCooldownUntilRef.current = 0;
      phaseAdvanceReleaseTimerRef.current = null;
    }, ADVANCE_PHASE_FALLBACK_RELEASE_MS);
    dispatch(SW_COMMANDS.END_PHASE, {});
    return true;
  }, [dispatch, isPhaseAdvanceLocked]);

  const handleEndPhase = () => {
    // 强制技能激活时禁止推进阶段（如鲜血符文必须二选一）
    if (isMandatoryAbilityActive) return;
    // 非自己回合时禁止操作（防止快速点击越过回合边界）
    if (!isMyTurn) return;
    // 防连点/重复提交保护（包含按钮连点和异步阶段自动推进重叠）
    if (isPhaseAdvanceLocked || Date.now() < phaseAdvanceCooldownUntilRef.current) return;
    // 系统交互未完成时禁止推进阶段（避免真相源被清空）
    if (swInteraction) return;
    if (eventCardModes.hasActiveEventMode) {
      eventCardModes.clearAllEventModes();
    }
    if (endPhaseConfirmPending) {
      setEndPhaseConfirmPending(false);
      advancePhaseSafely();
      return;
    }
    if ((currentPhase === 'move' || currentPhase === 'attack') && actionableUnitPositions.length > 0) {
      setEndPhaseConfirmPending(true);
      return;
    }
    advancePhaseSafely();
  };

  // ---------- 外部技能确认 ----------

  const handleConfirmMindCapture = useCallback((choice: 'control' | 'damage') => {
    if (swInteraction && swInteraction.type === 'mind_capture') {
      const option = swInteraction.options.find((opt) => {
        const val = opt.value as { action?: string; choice?: string } | undefined;
        return val?.action === 'mind_capture' && val.choice === choice;
      });
      if (option) {
        dispatch(INTERACTION_COMMANDS.RESPOND, {
          interactionId: swInteraction.id,
          optionId: option.id,
        });
      }
      return;
    }
  }, [dispatch, swInteraction]);

  const handleConfirmBeforeAttackCards = () => {
    if (!abilityMode || abilityMode.step !== 'selectCards') return;
    const selectableCardIds = new Set(abilityMode.selectableCardIds ?? []);
    const selected = (abilityMode.selectedCardIds ?? []).filter((cardId) =>
      selectableCardIds.size === 0 || selectableCardIds.has(cardId)
    );
    const route = getSystemAbilityUiRoute(abilityMode);
    const plan = resolveBeforeAttackCardConfirmation(swInteraction, abilityMode, selected);

    if (plan?.command === 'respondMany' && swInteraction) {
      dispatch(INTERACTION_COMMANDS.RESPOND, {
        interactionId: swInteraction.id,
        optionIds: plan.optionIds,
      });
      setAbilityMode(null);
      return;
    }

    if (plan?.command === 'respond' && swInteraction) {
      dispatch(INTERACTION_COMMANDS.RESPOND, {
        interactionId: swInteraction.id,
        optionId: plan.optionId,
      });
      setAbilityMode(null);
      return;
    }
    
    if (route === 'hand-card-select' || abilityMode.context === 'beforeAttack') {
      // 当前 selectCards 现役系统路由已由 useGameEvents.test.ts 门禁锁定；
      // 落到这里说明系统交互类型和 abilityMode 已经失配，或新增了未接线的选牌确认分支。
      console.warn('[SummonerWars] 未处理的系统攻击前选牌确认分支', {
        abilityId: abilityMode.abilityId,
        step: abilityMode.step,
        context: abilityMode.context,
        swInteractionType: swInteraction?.type ?? null,
        selectedCardIds: selected,
        route,
      });
      return;
    }
  };

  const handleCancelBeforeAttack = () => {
    const plan = resolveBeforeAttackCancellation(swInteraction);
    if (plan?.command === 'respond' && swInteraction) {
      dispatch(INTERACTION_COMMANDS.RESPOND, {
        interactionId: swInteraction.id,
        optionId: plan.optionId,
      });
      setAbilityMode(null);
      return;
    }
    if (plan?.command === 'cancel' && swInteraction) {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      setAbilityMode(null);
      return;
    }
    if (abilityMode) {
      // 现役 beforeAttack 取消/跳过路由已由 useGameEvents.test.ts 门禁锁定；
      // 落到这里说明出现了新的系统攻击前分支，但还没有接入取消或跳过语义。
      console.warn('[SummonerWars] 未处理的系统攻击前取消分支', {
        abilityId: abilityMode.abilityId,
        swInteractionType: swInteraction?.type ?? null,
      });
      setAbilityMode(null);
      return;
    }
  };

  // ---------- 自动跳过 ----------

  // 存在活跃的交互模式时禁止自动跳过（玩家正在进行多步骤操作）
  const hasActiveInteraction = eventCardModes.hasActiveEventMode
    || !!eventCardModes.funeralPyreMode
    || !!soulTransferMode
    || !!mindCaptureMode
    || !!afterAttackAbilityMode
    || !!abilityMode
    || !!rapidFireMode
    || !!magicEventChoiceMode
    || !!swInteraction;

  // 全局禁用开关（调试用）
  const debugDisabled = typeof window !== 'undefined'
    && (window as Window & { __SW_DISABLE_AUTO_SKIP__?: boolean }).__SW_DISABLE_AUTO_SKIP__;

  const advancePhase = useCallback(() => {
    // 自动跳阶段走同一套防重逻辑，避免与手动点击同时重复提交
    void advancePhaseSafely();
  }, [advancePhaseSafely]);

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
    if (!swInteraction || swInteraction.type !== 'magic_event_choice') return;
    const option = swInteraction.options.find((opt) => {
      const val = opt.value as { action?: string } | undefined;
      return val?.action === 'magic_event_play';
    });
    if (option) {
      respondInteractionOption(option.id);
    }
  }, [respondInteractionOption, swInteraction]);

  const handleDiscardMagicEvent = useCallback(() => {
    if (!swInteraction || swInteraction.type !== 'magic_event_choice') return;
    const option = swInteraction.options.find((opt) => {
      const val = opt.value as { action?: string } | undefined;
      return val?.action === 'magic_event_discard';
    });
    if (option) {
      respondInteractionOption(option.id);
    }
  }, [respondInteractionOption, swInteraction]);

  const handleCancelMagicEventChoice = useCallback(() => {
    if (!swInteraction || swInteraction.type !== 'magic_event_choice') return;
    dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
  }, [dispatch, swInteraction]);

  const handleCancelEventTargetInteraction = useCallback(() => {
    if (!swInteraction || swInteraction.type !== 'event_target') return;
    dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
  }, [dispatch, swInteraction]);

  const handleSystemAbilityChoice = useCallback((choice: string) => {
    if (!swInteraction) return;
    const option = swInteraction.options.find((opt) => opt.id === choice);
    if (!option) return;
    dispatch(INTERACTION_COMMANDS.RESPOND, {
      interactionId: swInteraction.id,
      optionId: option.id,
    });
    setAbilityMode(null);
  }, [dispatch, setAbilityMode, swInteraction]);

  // ---------- 返回 ----------

  return {
    // 状态
    selectedHandCardId, selectedCardsForDiscard,
    endPhaseConfirmPending, setEndPhaseConfirmPending,
    magicEventChoiceMode,
    abilitySelectedCardIds: abilityMode?.step === 'selectCards' ? (abilityMode.selectedCardIds ?? []) : [],
    // 事件卡模式（透传）
    eventTargetMode: eventCardModes.eventTargetMode,
    bloodSummonMode: eventCardModes.bloodSummonMode,
    annihilateMode: eventCardModes.annihilateMode,
    funeralPyreMode: eventCardModes.funeralPyreMode,
    mindControlMode: eventCardModes.mindControlMode,
    stunMode: eventCardModes.stunMode,
    hypnoticLureMode: eventCardModes.hypnoticLureMode,
    chantEntanglementMode: eventCardModes.chantEntanglementMode,
    moguSymbioticSelfHealingMode: eventCardModes.moguSymbioticSelfHealingMode,
    moguReleaseSporesMode: eventCardModes.moguReleaseSporesMode,
    sneakMode: eventCardModes.sneakMode,
    glacialShiftMode: eventCardModes.glacialShiftMode,
    withdrawMode: eventCardModes.withdrawMode,
    telekinesisTargetMode: eventCardModes.telekinesisTargetMode,
    // 计算值
    validSummonPositions, validBuildPositions, validMovePositions, validAttackPositions,
    validAbilityPositions, validAbilityUnits, actionableUnitPositions, abilityReadyPositions,
    fireSacrificeSummonMode,
    validEventTargets: eventCardModes.validEventTargets,
    bloodSummonHighlights: eventCardModes.bloodSummonHighlights,
    annihilateHighlights: eventCardModes.annihilateHighlights,
    mindControlHighlights: eventCardModes.mindControlHighlights,
    entanglementHighlights: eventCardModes.entanglementHighlights,
    moguSymbioticSelfHealingHighlights: eventCardModes.moguSymbioticSelfHealingHighlights,
    moguReleaseSporesHighlights: eventCardModes.moguReleaseSporesHighlights,
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
    handleConfirmEntanglement: eventCardModes.handleConfirmEntanglement,
    handleConfirmMoguSymbioticSelfHealing: eventCardModes.handleConfirmMoguSymbioticSelfHealing,
    handleSkipMoguSymbioticSelfHealing: eventCardModes.handleSkipMoguSymbioticSelfHealing,
    handleConfirmMoguReleaseSpores: eventCardModes.handleConfirmMoguReleaseSpores,
    handleSkipMoguReleaseSpores: eventCardModes.handleSkipMoguReleaseSpores,
    handleConfirmSneak: eventCardModes.handleConfirmSneak,
    handleConfirmGlacialShift: eventCardModes.handleConfirmGlacialShift,
    handleConfirmMindCapture,
    handleConfirmBeforeAttackCards, handleCancelBeforeAttack,
    handlePlayMagicEvent, handleDiscardMagicEvent, handleCancelMagicEventChoice, handleCancelEventTargetInteraction, handleSystemAbilityChoice,
    clearAllEventModes: eventCardModes.clearAllEventModes,
    hasActiveEventMode: eventCardModes.hasActiveEventMode,
    isMandatoryAbilityActive,
    isPhaseAdvanceLocked,
    hasSystemInteraction: !!swInteraction,
  };
}
