/**
 * 召唤师战争 - 事件卡交互模式子 Hook
 *
 * 管理所有事件卡多步骤交互模式的状态、高亮计算、点击处理和确认回调。
 * 由 useCellInteraction 编排层调用。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SummonerWarsCore, CellCoord, EventCard, GamePhase, UnitCard } from '../domain/types';
import { SW_COMMANDS } from '../domain/types';
import {
  getPlayerUnits, isCellEmpty, getAdjacentCells,
  manhattanDistance, isInStraightLine,
  getStructureAt, isValidCoord, getSummoner, findUnitPositionByInstanceId,
  getValidShourenFreezeTargets, hasStableAbility, getUnitAt, getUnitAbilities,
} from '../domain/helpers';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import { getBaseCardId, CARD_IDS, isMoguSporePlagueBodyCard } from '../domain/ids';
import { useToast } from '../../../contexts/ToastContext';
import { playDeniedSound } from '../../../lib/audio/useGameAudio';
import type { SoulTransferModeState, MindCaptureModeState, AfterAttackAbilityModeState } from './useGameEvents';
import type { BloodSummonModeState, AnnihilateModeState, FuneralPyreModeState } from './StatusBanners';
import type {
  EventTargetModeState, MindControlModeState, ChantEntanglementModeState,
  MoguSymbioticSelfHealingModeState, MoguReleaseSporesModeState,
  WithdrawModeState, GlacialShiftModeState, SneakModeState,
  StunModeState, HypnoticLureModeState, TelekinesisTargetModeState,
} from './modeTypes';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import {
  deriveTelekinesisTargetMode,
  deriveWithdrawMode,
  findActivatedAbilityDirectionOptionByPosition,
} from './systemInteractionAdapter';

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
  CARD_IDS.MOGU_COMMAND,
  CARD_IDS.MOGU_SYMBIOTIC_SELF_HEALING,
  CARD_IDS.MOGU_RELEASE_SPORES,
  CARD_IDS.GOBLIN_SNEAK,
  CARD_IDS.FROST_GLACIAL_SHIFT,
  CARD_IDS.SHOUREN_FREEZE,
]);

export function requiresEventInteraction(cardId: string): boolean {
  return INTERACTIVE_EVENT_BASE_IDS.has(getBaseCardId(cardId));
}

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
  swInteraction: {
    id: string;
    type: string;
    meta: Record<string, unknown>;
    options: PromptOption[];
  } | null;
  respondInteractionOption: (optionId: string | null, optionIds?: string[]) => void;
  // 外部模式（仅用于 click 早期返回判断，不由本 hook 管理）
  soulTransferMode: SoulTransferModeState | null;
  mindCaptureMode: MindCaptureModeState | null;
  afterAttackAbilityMode: AfterAttackAbilityModeState | null;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useEventCardModes({
  core, dispatch, currentPhase, myPlayerId, myHand, setSelectedHandCardId,
  swInteraction, respondInteractionOption,
  soulTransferMode, mindCaptureMode,
  afterAttackAbilityMode,
}: UseEventCardModesParams) {
  const { t } = useTranslation('game-summonerwars');
  const showToast = useToast();

  const [selectedMultiTargetOptionIds, setSelectedMultiTargetOptionIds] = useState<string[]>([]);
  const [selectedAnnihilateOptionIds, setSelectedAnnihilateOptionIds] = useState<string[]>([]);

  // ---------- 派生 ----------
  const clearAllEventModes = useCallback(() => {
    setSelectedMultiTargetOptionIds([]);
    setSelectedAnnihilateOptionIds([]);
    setSelectedHandCardId(null);
  }, [setSelectedHandCardId]);

  const findInteractionOptionId = useCallback((matcher: (option: PromptOption) => boolean) => {
    return swInteraction?.options.find(matcher)?.id ?? null;
  }, [swInteraction]);

  const respondPositionOption = useCallback((pos: CellCoord): boolean => {
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as {
        targetPosition?: CellCoord;
        summonPosition?: CellCoord;
        position?: CellCoord;
      } | undefined;
      const target = value?.targetPosition ?? value?.summonPosition ?? value?.position;
      return !!target && target.row === pos.row && target.col === pos.col;
    });
    if (!optionId) return false;
    respondInteractionOption(optionId);
    return true;
  }, [findInteractionOptionId, respondInteractionOption]);

  const extractTargetPositionOptions = useCallback((
    type: string,
    action: string,
  ): Array<{ optionId: string; position: CellCoord }> => {
    if (!swInteraction || swInteraction.type !== type) return [];
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
        if (value?.action !== action || !value.targetPosition) return null;
        return { optionId: option.id, position: value.targetPosition };
      })
      .filter((item): item is { optionId: string; position: CellCoord } => !!item);
  }, [swInteraction]);

  const selectedMultiTargetOptionIdSet = useMemo(
    () => new Set(selectedMultiTargetOptionIds),
    [selectedMultiTargetOptionIds],
  );

  const selectedAnnihilateOptionIdSet = useMemo(
    () => new Set(selectedAnnihilateOptionIds),
    [selectedAnnihilateOptionIds],
  );

  const eventTargetMode = useMemo<EventTargetModeState | null>(() => {
    if (!swInteraction || swInteraction.type !== 'event_target') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : undefined;
    if (!cardId) return null;
    const card = myHand.find((item) => item.id === cardId);
    if (!card || card.cardType !== 'event') return null;
    const validTargets = swInteraction.options
      .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
      .filter((pos): pos is CellCoord => !!pos);
    return {
      cardId,
      card: card as EventCard,
      validTargets,
    };
  }, [myHand, swInteraction]);

  const funeralPyreMode = useMemo<FuneralPyreModeState | null>(() => {
    if (!swInteraction || swInteraction.type !== 'funeral_pyre') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : undefined;
    if (!cardId) return null;
    return {
      cardId,
      charges: (swInteraction.meta?.charges as number | undefined) ?? 0,
    };
  }, [swInteraction]);

  const mindControlOptions = useMemo(
    () => extractTargetPositionOptions('mind_control_select_targets', 'mind_control_target'),
    [extractTargetPositionOptions],
  );

  const mindControlMode = useMemo<MindControlModeState | null>(() => {
    if (!swInteraction || swInteraction.type !== 'mind_control_select_targets') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '';
    const selectedTargets = mindControlOptions
      .filter((option) => selectedMultiTargetOptionIdSet.has(option.optionId))
      .map((option) => option.position);
    return {
      cardId,
      validTargets: mindControlOptions.map((option) => option.position),
      selectedTargets,
    };
  }, [mindControlOptions, selectedMultiTargetOptionIdSet, swInteraction]);

  const hypnoticLureMode = useMemo<HypnoticLureModeState | null>(() => {
    if (!swInteraction || swInteraction.type !== 'hypnotic_lure_select_target') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '';
    const validTargets = swInteraction.options
      .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
      .filter((pos): pos is CellCoord => !!pos);
    return {
      cardId,
      validTargets,
    };
  }, [swInteraction]);

  const chantEntanglementOptions = useMemo(
    () => extractTargetPositionOptions('chant_entanglement_select_targets', 'chant_entanglement_target'),
    [extractTargetPositionOptions],
  );

  const chantEntanglementMode = useMemo<ChantEntanglementModeState | null>(() => {
    if (!swInteraction || swInteraction.type !== 'chant_entanglement_select_targets') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '';
    const selectedTargets = chantEntanglementOptions
      .filter((option) => selectedMultiTargetOptionIdSet.has(option.optionId))
      .map((option) => option.position);
    return {
      cardId,
      validTargets: chantEntanglementOptions.map((option) => option.position),
      selectedTargets,
    };
  }, [chantEntanglementOptions, selectedMultiTargetOptionIdSet, swInteraction]);

  const moguSymbioticSelfHealingOptions = useMemo(
    () => extractTargetPositionOptions('mogu_symbiotic_self_healing_select_targets', 'mogu_symbiotic_self_healing_target'),
    [extractTargetPositionOptions],
  );

  const moguSymbioticSelfHealingMode = useMemo<MoguSymbioticSelfHealingModeState | null>(() => {
    if (!swInteraction || swInteraction.type !== 'mogu_symbiotic_self_healing_select_targets') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '';
    const selectedTargets = moguSymbioticSelfHealingOptions
      .filter((option) => selectedMultiTargetOptionIdSet.has(option.optionId))
      .map((option) => option.position);
    return {
      cardId,
      validTargets: moguSymbioticSelfHealingOptions.map((option) => option.position),
      selectedTargets,
    };
  }, [moguSymbioticSelfHealingOptions, selectedMultiTargetOptionIdSet, swInteraction]);

  const moguReleaseSporesOptions = useMemo(
    () => extractTargetPositionOptions('mogu_release_spores_select_positions', 'mogu_release_spores_position'),
    [extractTargetPositionOptions],
  );

  const moguReleaseSporesMode = useMemo<MoguReleaseSporesModeState | null>(() => {
    if (!swInteraction || swInteraction.type !== 'mogu_release_spores_select_positions') return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '';
    const selectedTargets = moguReleaseSporesOptions
      .filter((option) => selectedMultiTargetOptionIdSet.has(option.optionId))
      .map((option) => option.position);
    return {
      cardId,
      validTargets: moguReleaseSporesOptions.map((option) => option.position),
      selectedTargets,
    };
  }, [moguReleaseSporesOptions, selectedMultiTargetOptionIdSet, swInteraction]);

  const bloodSummonMode = useMemo<BloodSummonModeState | null>(() => {
    if (!swInteraction) return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : undefined;
    switch (swInteraction.type) {
      case 'blood_summon_select_target':
        return {
          step: 'selectTarget',
          cardId,
          completedCount: (swInteraction.meta?.completedCount as number | undefined) ?? 0,
        };
      case 'blood_summon_select_card':
        return {
          step: 'selectCard',
          cardId,
          targetPosition: swInteraction.meta?.targetPosition as CellCoord | undefined,
          completedCount: (swInteraction.meta?.completedCount as number | undefined) ?? 0,
        };
      case 'blood_summon_select_position':
        return {
          step: 'selectPosition',
          cardId,
          targetPosition: swInteraction.meta?.targetPosition as CellCoord | undefined,
          summonCardId: swInteraction.meta?.summonCardId as string | undefined,
          completedCount: (swInteraction.meta?.completedCount as number | undefined) ?? 0,
        };
      case 'blood_summon_confirm':
        return {
          step: 'confirm',
          cardId,
          completedCount: (swInteraction.meta?.completedCount as number | undefined) ?? 1,
        };
      default:
        return null;
    }
  }, [swInteraction]);

  const annihilateOptions = useMemo(
    () => extractTargetPositionOptions('annihilate_select_targets', 'annihilate_target'),
    [extractTargetPositionOptions],
  );

  const annihilateMode = useMemo<AnnihilateModeState | null>(() => {
    if (!swInteraction) return null;
    if (swInteraction.type === 'annihilate_select_targets') {
      return {
        step: 'selectTargets',
        cardId: typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '',
        selectedTargets: annihilateOptions
          .filter((option) => selectedAnnihilateOptionIdSet.has(option.optionId))
          .map((option) => option.position),
        currentTargetIndex: 0,
        damageTargets: [],
      };
    }
    if (swInteraction.type === 'annihilate_select_damage') {
      return {
        step: 'selectDamageTarget',
        cardId: typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '',
        selectedTargets: (swInteraction.meta?.selectedTargets as CellCoord[] | undefined) ?? [],
        currentTargetIndex: (swInteraction.meta?.currentTargetIndex as number | undefined) ?? 0,
        damageTargets: (swInteraction.meta?.damageTargets as (CellCoord | null)[] | undefined) ?? [],
      };
    }
    return null;
  }, [annihilateOptions, selectedAnnihilateOptionIdSet, swInteraction]);

  const stunMode = useMemo<StunModeState | null>(() => {
    if (!swInteraction) return null;
    const cardId = typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '';
    if (swInteraction.type === 'stun_select_target') {
      const validTargets = swInteraction.options
        .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
        .filter((pos): pos is CellCoord => !!pos);
      return { step: 'selectTarget', cardId, validTargets };
    }
    if (swInteraction.type === 'stun_select_destination') {
      const targetPosition = swInteraction.meta?.targetPosition as CellCoord | undefined;
      const destinations = swInteraction.options
        .map((option) => {
          const value = option.value as {
            moveRow?: number;
            moveCol?: number;
            distance?: number;
            targetPosition?: CellCoord;
          } | undefined;
          const position = value?.targetPosition;
          if (!position) return null;
          return {
            position,
            moveRow: value.moveRow ?? 0,
            moveCol: value.moveCol ?? 0,
            distance: value.distance ?? 1,
          };
        })
        .filter((item): item is { position: CellCoord; moveRow: number; moveCol: number; distance: number } => !!item);
      return {
        step: 'selectDestination',
        cardId,
        validTargets: [],
        targetPosition,
        destinations,
      };
    }
    return null;
  }, [swInteraction]);

  const systemWithdrawMode = useMemo<WithdrawModeState | null>(() => {
    return deriveWithdrawMode(swInteraction);
  }, [swInteraction]);

  const withdrawMode = systemWithdrawMode;

  const systemTelekinesisTargetMode = useMemo<TelekinesisTargetModeState | null>(() => {
    return deriveTelekinesisTargetMode(swInteraction);
  }, [swInteraction]);

  const telekinesisTargetMode = systemTelekinesisTargetMode;

  const sneakMode = useMemo<SneakModeState | null>(() => {
    if (!swInteraction) return null;
    if (swInteraction.type === 'sneak_select_unit') {
      const validUnits = swInteraction.options
        .filter((option) => option.id !== 'finish')
        .map((option) => (option.value as { position?: CellCoord } | undefined)?.position)
        .filter((pos): pos is CellCoord => !!pos);
      return {
        cardId: typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '',
        step: 'selectUnit',
        validUnits,
        recorded: (swInteraction.meta?.recorded as { position: CellCoord; newPosition: CellCoord }[] | undefined) ?? [],
      };
    }
    if (swInteraction.type === 'sneak_select_direction') {
      return {
        cardId: typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '',
        step: 'selectDirection',
        validUnits: [],
        currentUnit: swInteraction.meta?.currentUnit as CellCoord | undefined,
        recorded: (swInteraction.meta?.recorded as { position: CellCoord; newPosition: CellCoord }[] | undefined) ?? [],
      };
    }
    return null;
  }, [swInteraction]);

  const glacialShiftMode = useMemo<GlacialShiftModeState | null>(() => {
    if (!swInteraction) return null;
    if (swInteraction.type === 'glacial_shift_select_building') {
      const validBuildings = swInteraction.options
        .filter((option) => option.id !== 'finish')
        .map((option) => (option.value as { position?: CellCoord } | undefined)?.position)
        .filter((pos): pos is CellCoord => !!pos);
      return {
        cardId: typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '',
        step: 'selectBuilding',
        validBuildings,
        recorded: (swInteraction.meta?.recorded as { position: CellCoord; newPosition: CellCoord }[] | undefined) ?? [],
      };
    }
    if (swInteraction.type === 'glacial_shift_select_destination') {
      return {
        cardId: typeof swInteraction.meta?.cardId === 'string' ? swInteraction.meta.cardId : '',
        step: 'selectDestination',
        currentBuilding: swInteraction.meta?.currentBuilding as CellCoord | undefined,
        validBuildings: [],
        recorded: (swInteraction.meta?.recorded as { position: CellCoord; newPosition: CellCoord }[] | undefined) ?? [],
      };
    }
    return null;
  }, [swInteraction]);

  const hasActiveEventMode = !!(eventTargetMode || bloodSummonMode || annihilateMode
    || funeralPyreMode || mindControlMode || stunMode || hypnoticLureMode || chantEntanglementMode
    || moguSymbioticSelfHealingMode || moguReleaseSporesMode
    || sneakMode || glacialShiftMode || withdrawMode || telekinesisTargetMode);

  const lastInteractionIdRef = useRef<string | null>(null);

  // InteractionSystem 驱动事件卡模式：交互切换时同步本地模式状态
  useEffect(() => {
    if (!swInteraction) {
      if (lastInteractionIdRef.current) {
        lastInteractionIdRef.current = null;
        queueMicrotask(() => {
          clearAllEventModes();
        });
      }
      return;
    }
    if (swInteraction.id === lastInteractionIdRef.current) return;
    lastInteractionIdRef.current = swInteraction.id;
    queueMicrotask(() => {
      clearAllEventModes();
    });

    const meta = swInteraction.meta ?? {};
    const cardId = typeof meta.cardId === 'string' ? meta.cardId : undefined;
    if (cardId) {
      setSelectedHandCardId(cardId);
    }

    switch (swInteraction.type) {
      case 'after_attack_mind_transmission':
      case 'after_attack_telekinesis_target':
      case 'after_attack_telekinesis_direction':
      case 'after_attack_withdraw_cost':
      case 'after_attack_withdraw_position': {
        break;
      }
      case 'event_target': {
        break;
      }
      case 'funeral_pyre': {
        break;
      }
      case 'blood_summon_select_target':
      case 'blood_summon_select_card':
      case 'blood_summon_select_position':
      case 'blood_summon_confirm':
      case 'annihilate_select_targets':
      case 'annihilate_select_damage': {
        break;
      }
      case 'mind_control_select_targets': {
        break;
      }
      case 'stun_select_target':
      case 'stun_select_destination': {
        break;
      }
      case 'hypnotic_lure_select_target': {
        break;
      }
      case 'chant_entanglement_select_targets': {
        break;
      }
      case 'mogu_symbiotic_self_healing_select_targets':
      case 'mogu_release_spores_select_positions': {
        break;
      }
      case 'sneak_select_unit':
      case 'sneak_select_direction':
      case 'glacial_shift_select_building':
      case 'glacial_shift_select_destination': {
        break;
      }
      default:
        break;
    }
  }, [clearAllEventModes, myHand, setSelectedHandCardId, swInteraction]);

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
      if (swInteraction?.type !== 'blood_summon_select_target') return [];
      return swInteraction.options
        .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
        .filter((pos): pos is CellCoord => !!pos);
    }
    if (bloodSummonMode.step === 'selectPosition' && bloodSummonMode.targetPosition) {
      if (swInteraction?.type !== 'blood_summon_select_position') return [];
      return swInteraction.options
        .map((option) => (option.value as { summonPosition?: CellCoord } | undefined)?.summonPosition)
        .filter((pos): pos is CellCoord => !!pos);
    }
    return [];
  }, [bloodSummonMode, swInteraction]);

  const annihilateHighlights = useMemo(() => {
    if (!annihilateMode) return [];
    if (annihilateMode.step === 'selectTargets') {
      if (swInteraction?.type !== 'annihilate_select_targets') return [];
      return swInteraction.options
        .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
        .filter((pos): pos is CellCoord => !!pos);
    }
    if (annihilateMode.step === 'selectDamageTarget') {
      if (swInteraction?.type !== 'annihilate_select_damage') return [];
      return swInteraction.options
        .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
        .filter((pos): pos is CellCoord => !!pos);
    }
    return [];
  }, [annihilateMode, swInteraction]);

  const mindControlHighlights = useMemo(() => {
    if (!mindControlMode) return [];
    return mindControlMode.validTargets;
  }, [mindControlMode]);

  const entanglementHighlights = useMemo(() => {
    if (!chantEntanglementMode) return [];
    return chantEntanglementMode.validTargets;
  }, [chantEntanglementMode]);

  const moguSymbioticSelfHealingHighlights = useMemo(() => {
    if (!moguSymbioticSelfHealingMode) return [];
    return moguSymbioticSelfHealingMode.validTargets;
  }, [moguSymbioticSelfHealingMode]);

  const moguReleaseSporesHighlights = useMemo(() => {
    if (!moguReleaseSporesMode) return [];
    return moguReleaseSporesMode.validTargets;
  }, [moguReleaseSporesMode]);

  const glacialShiftHighlights = useMemo(() => {
    if (!glacialShiftMode) return [];
    if (glacialShiftMode.step === 'selectBuilding') {
      const recordedKeys = new Set(glacialShiftMode.recorded.map(r => `${r.position.row}-${r.position.col}`));
      return glacialShiftMode.validBuildings.filter(p => !recordedKeys.has(`${p.row}-${p.col}`));
    }
    if (glacialShiftMode.step === 'selectDestination') {
      if (swInteraction?.type !== 'glacial_shift_select_destination') return [];
      return swInteraction.options
        .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
        .filter((pos): pos is CellCoord => !!pos);
    }
    return [];
  }, [glacialShiftMode, swInteraction]);

  const sneakHighlights = useMemo(() => {
    if (!sneakMode) return [];
    if (sneakMode.step === 'selectUnit') {
      const recordedKeys = new Set(sneakMode.recorded.map(r => `${r.position.row}-${r.position.col}`));
      return sneakMode.validUnits.filter(p => !recordedKeys.has(`${p.row}-${p.col}`));
    }
    if (sneakMode.step === 'selectDirection') {
      if (swInteraction?.type !== 'sneak_select_direction') return [];
      return swInteraction.options
        .map((option) => (option.value as { targetPosition?: CellCoord } | undefined)?.targetPosition)
        .filter((pos): pos is CellCoord => !!pos);
    }
    return [];
  }, [sneakMode, swInteraction]);

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
      if (swInteraction?.type === 'funeral_pyre') {
        respondPositionOption({ row: gameRow, col: gameCol });
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
        if (swInteraction?.type === 'after_attack_mind_transmission') {
          respondPositionOption({ row: gameRow, col: gameCol });
        } else if (swInteraction?.type === 'after_attack_telekinesis_target') {
          respondPositionOption({ row: gameRow, col: gameCol });
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
        if (
          swInteraction?.type === 'after_attack_telekinesis_direction'
          || (swInteraction?.type === 'activated_ability_target'
            && (swInteraction.meta.step === 'selectDirection'))
        ) {
          if (swInteraction?.type === 'activated_ability_target') {
            const option = findActivatedAbilityDirectionOptionByPosition(
              swInteraction,
              telekinesisTargetMode.abilityId,
              { row: gameRow, col: gameCol },
            );
            respondInteractionOption(option?.id ?? null);
          } else {
            const optionId = findInteractionOptionId((option) => option.id === `pos:${gameRow},${gameCol}`);
            respondInteractionOption(optionId);
          }
        }
      }
      return true;
    }

    // 血契召唤多步骤模式
    if (bloodSummonMode) {
      if (bloodSummonMode.step === 'selectTarget') {
        const isValid = bloodSummonHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      } else if (bloodSummonMode.step === 'selectPosition' && bloodSummonMode.targetPosition && bloodSummonMode.summonCardId) {
        const isValid = bloodSummonHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      }
      return true;
    }

    // 除灭多步骤模式
    if (annihilateMode) {
      if (annihilateMode.step === 'selectTargets') {
        const option = annihilateOptions.find((item) => item.position.row === gameRow && item.position.col === gameCol);
        if (option) {
          setSelectedAnnihilateOptionIds((current) => (
            current.includes(option.optionId)
              ? current.filter((optionId) => optionId !== option.optionId)
              : [...current, option.optionId]
          ));
        }
      } else if (annihilateMode.step === 'selectDamageTarget') {
        const isValid = annihilateHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      }
      return true;
    }

    // 心灵操控多目标选择模式
    if (mindControlMode) {
      const option = mindControlOptions.find((item) => item.position.row === gameRow && item.position.col === gameCol);
      if (option) {
        setSelectedMultiTargetOptionIds((current) => (
          current.includes(option.optionId)
            ? current.filter((optionId) => optionId !== option.optionId)
            : [...current, option.optionId]
        ));
      }
      return true;
    }

    // 震慑目标+终点选择模式
    if (stunMode) {
      if (stunMode.step === 'selectTarget') {
        const isValid = stunMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      } else if (stunMode.step === 'selectDestination' && stunMode.destinations && stunMode.targetPosition) {
        const dest = stunMode.destinations.find(d => d.position.row === gameRow && d.position.col === gameCol);
        if (dest) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      }
      return true;
    }

    // 撤退位置选择模式
    if (withdrawMode && withdrawMode.step === 'selectPosition') {
      const isValid = withdrawHighlights.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid && swInteraction?.type === 'after_attack_withdraw_position') {
        const optionId = findInteractionOptionId((option) => option.id === `pos:${gameRow},${gameCol}`);
        respondInteractionOption(optionId);
      }
      return true;
    }

    // 冰川位移目标选择模式
    if (glacialShiftMode) {
      if (glacialShiftMode.step === 'selectBuilding') {
        const isValid = glacialShiftHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      } else if (glacialShiftMode.step === 'selectDestination' && glacialShiftMode.currentBuilding) {
        const isValid = glacialShiftHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      }
      return true;
    }

    // 潜行目标选择模式
    if (sneakMode) {
      if (sneakMode.step === 'selectUnit') {
        const isValid = sneakHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      } else if (sneakMode.step === 'selectDirection' && sneakMode.currentUnit) {
        const isValid = sneakHighlights.some(p => p.row === gameRow && p.col === gameCol);
        if (isValid) {
          respondPositionOption({ row: gameRow, col: gameCol });
        }
      }
      return true;
    }

    // 交缠颂歌目标选择模式
    if (chantEntanglementMode) {
      const option = chantEntanglementOptions.find((item) => item.position.row === gameRow && item.position.col === gameCol);
      if (option) {
        setSelectedMultiTargetOptionIds((current) => {
          if (current.includes(option.optionId)) {
            return current.filter((optionId) => optionId !== option.optionId);
          }
          if (current.length >= 2) {
            return current;
          }
          return [...current, option.optionId];
        });
      }
      return true;
    }

    // 莫古：共生自愈目标选择模式
    if (moguSymbioticSelfHealingMode) {
      const option = moguSymbioticSelfHealingOptions.find((item) => item.position.row === gameRow && item.position.col === gameCol);
      if (option) {
        setSelectedMultiTargetOptionIds((current) => (
          current.includes(option.optionId)
            ? current.filter((optionId) => optionId !== option.optionId)
            : [...current, option.optionId]
        ));
      }
      return true;
    }

    // 莫古：释放菌袍落位选择模式
    if (moguReleaseSporesMode) {
      const option = moguReleaseSporesOptions.find((item) => item.position.row === gameRow && item.position.col === gameCol);
      if (option) {
        setSelectedMultiTargetOptionIds((current) => {
          if (current.includes(option.optionId)) {
            return current.filter((optionId) => optionId !== option.optionId);
          }
          if (current.length >= 2) return current;
          return [...current, option.optionId];
        });
      }
      return true;
    }

    // 催眠引诱目标选择模式
    if (hypnoticLureMode) {
      const isValid = hypnoticLureMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
      if (isValid) {
        respondPositionOption({ row: gameRow, col: gameCol });
      }
      return true;
    }

    // 事件目标选择模式
    if (eventTargetMode) {
      const isValidTarget = eventTargetMode.validTargets.some(p => p.row === gameRow && p.col === gameCol);
      if (isValidTarget) {
        respondPositionOption({ row: gameRow, col: gameCol });
      }
      return true;
    }

    // 未匹配任何事件模式
    return false;
  }, [
    funeralPyreMode, soulTransferMode, mindCaptureMode,
    afterAttackAbilityMode, afterAttackAbilityHighlights,
    telekinesisTargetMode,
    bloodSummonMode, bloodSummonHighlights,
    annihilateHighlights,
    annihilateMode, mindControlMode, stunMode,
    withdrawMode, withdrawHighlights,
    glacialShiftMode, glacialShiftHighlights,
    sneakMode, sneakHighlights,
    chantEntanglementMode,
    moguSymbioticSelfHealingMode, moguReleaseSporesMode,
    hypnoticLureMode, eventTargetMode,
    chantEntanglementOptions, moguSymbioticSelfHealingOptions, moguReleaseSporesOptions, mindControlOptions, annihilateOptions,
    findInteractionOptionId, respondInteractionOption,
    respondPositionOption, swInteraction]);

  // ---------- 打出事件卡 ----------

  const handlePlayEvent = useCallback((cardId: string) => {
    const card = myHand.find(c => c.id === cardId);
    if (!card || card.cardType !== 'event') return;
    const eventCard = card as EventCard;
    const baseId = getBaseCardId(eventCard.id);
    const hasAdjacentEmptyCell = (pos: CellCoord) => (
      getAdjacentCells(pos).some(adj => isValidCoord(adj) && isCellEmpty(core, adj))
    );

    // 每个 case 成功进入模式时设 activated=true；条件不满足时可设 failReason 覆盖通用提示
    let activated = false;
    let failReason: string | undefined;

    switch (baseId) {
      case CARD_IDS.NECRO_HELLFIRE_BLADE: {
        const friendlyCommons = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass === 'common');
        if (friendlyCommons.length === 0) break;
        activated = true;
        break;
      }
      case CARD_IDS.NECRO_BLOOD_SUMMON: {
        const friendlyUnits = getPlayerUnits(core, myPlayerId as '0' | '1');
        const hasTarget = friendlyUnits.some((unit) => hasAdjacentEmptyCell(unit.position));
        const hasCard = myHand.some((card) => card.cardType === 'unit' && (card as UnitCard).cost <= 2);
        if (!hasTarget || !hasCard) break;
        activated = true;
        break;
      }
      case CARD_IDS.NECRO_ANNIHILATE: {
        const friendlyUnits = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        if (friendlyUnits.length === 0) break;
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
        activated = true;
        break;
      }
      case CARD_IDS.TRICKSTER_HYPNOTIC_LURE: {
        const lureOpponentId = myPlayerId === '0' ? '1' : '0';
        const lureTargets = getPlayerUnits(core, lureOpponentId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        if (lureTargets.length === 0) break;
        activated = true;
        break;
      }
      case CARD_IDS.BARBARIC_CHANT_OF_POWER: {
        const cpSummoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!cpSummoner) { failReason = t('eventCard.noSummoner'); break; }
        const cpTargets = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner' && manhattanDistance(cpSummoner.position, u.position) <= 3);
        if (cpTargets.length === 0) {
          failReason = t('eventCard.chantPowerNeedFriendlyInRange');
          break;
        }
        activated = true;
        break;
      }
      case CARD_IDS.BARBARIC_CHANT_OF_GROWTH: {
        const cgTargets = getPlayerUnits(core, myPlayerId as '0' | '1');
        if (cgTargets.length === 0) break;
        activated = true;
        break;
      }
      case CARD_IDS.BARBARIC_CHANT_OF_WEAVING: {
        const cwTargets = getPlayerUnits(core, myPlayerId as '0' | '1');
        if (cwTargets.length === 0) break;
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
              && manhattanDistance(gsSummoner.position, pos) <= 3
              && hasAdjacentEmptyCell(pos)) {
              gsBuildings.push(pos);
            }
          }
        }
        if (gsBuildings.length === 0) break;
        activated = true;
        break;
      }
      case CARD_IDS.GOBLIN_SNEAK: {
        const sneakUnits = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.cost === 0 && u.card.unitClass !== 'summoner')
          .filter(u => hasAdjacentEmptyCell(u.position));
        if (sneakUnits.length === 0) break;
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
        activated = true;
        break;
      }
      case CARD_IDS.MOGU_COMMAND: {
        const summoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!summoner) { failReason = t('eventCard.noSummoner'); break; }
        const friendlyCommons = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass === 'common' && manhattanDistance(summoner.position, u.position) <= 3);
        if (friendlyCommons.length === 0) break;
        activated = true;
        break;
      }
      case CARD_IDS.MOGU_SYMBIOTIC_SELF_HEALING: {
        const targets = getPlayerUnits(core, myPlayerId as '0' | '1')
          .filter(u => u.card.unitClass !== 'summoner');
        if (targets.length === 0) break;
        activated = true;
        break;
      }
      case CARD_IDS.MOGU_RELEASE_SPORES: {
        const summoner = getSummoner(core, myPlayerId as '0' | '1');
        if (!summoner) { failReason = t('eventCard.noSummoner'); break; }
        const player = core.players[myPlayerId as '0' | '1'];
        const hasDiscardBody = player.discard.some((card) => card.cardType === 'unit' && isMoguSporePlagueBodyCard(card));
        if (!hasDiscardBody) break;
        const hasOpenSpace = getAdjacentCells(summoner.position).some(adj => isValidCoord(adj) && isCellEmpty(core, adj));
        if (!hasOpenSpace) break;
        activated = true;
        break;
      }
      case CARD_IDS.SHOUREN_FREEZE: {
        const targets = getValidShourenFreezeTargets(core, myPlayerId as '0' | '1');
        if (targets.length === 0) break;
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
      if (requiresEventInteraction(cardId)) {
        dispatch(SW_COMMANDS.REQUEST_EVENT_INTERACTION, { cardId });
      }
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
    if (swInteraction?.type !== 'mind_control_select_targets') return;
    respondInteractionOption(null, selectedMultiTargetOptionIds);
  }, [mindControlMode, respondInteractionOption, selectedMultiTargetOptionIds, swInteraction]);

  const handleConfirmGlacialShift = useCallback(() => {
    if (!glacialShiftMode || glacialShiftMode.recorded.length === 0) return;
    if (swInteraction?.type !== 'glacial_shift_select_building') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string } | undefined;
      return value?.action === 'glacial_shift_finish';
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, glacialShiftMode, respondInteractionOption, swInteraction]);

  const handleConfirmSneak = useCallback(() => {
    if (!sneakMode || sneakMode.recorded.length === 0) return;
    if (swInteraction?.type !== 'sneak_select_unit') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string } | undefined;
      return value?.action === 'sneak_finish';
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, sneakMode, swInteraction]);

  const handleConfirmEntanglement = useCallback(() => {
    if (!chantEntanglementMode || chantEntanglementMode.selectedTargets.length < 2) return;
    if (swInteraction?.type !== 'chant_entanglement_select_targets') return;
    respondInteractionOption(null, selectedMultiTargetOptionIds);
  }, [chantEntanglementMode, respondInteractionOption, selectedMultiTargetOptionIds, swInteraction]);

  const handleConfirmMoguSymbioticSelfHealing = useCallback(() => {
    if (!moguSymbioticSelfHealingMode || moguSymbioticSelfHealingMode.selectedTargets.length === 0) return;
    if (swInteraction?.type !== 'mogu_symbiotic_self_healing_select_targets') return;
    respondInteractionOption(null, selectedMultiTargetOptionIds);
  }, [moguSymbioticSelfHealingMode, respondInteractionOption, selectedMultiTargetOptionIds, swInteraction]);

  const handleSkipMoguSymbioticSelfHealing = useCallback(() => {
    if (swInteraction?.type !== 'mogu_symbiotic_self_healing_select_targets') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; skip?: boolean } | undefined;
      return value?.action === 'mogu_symbiotic_self_healing_finish' || value?.skip === true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);

  const handleConfirmMoguReleaseSpores = useCallback(() => {
    if (!moguReleaseSporesMode || moguReleaseSporesMode.selectedTargets.length === 0) return;
    if (swInteraction?.type !== 'mogu_release_spores_select_positions') return;
    respondInteractionOption(null, selectedMultiTargetOptionIds);
  }, [moguReleaseSporesMode, respondInteractionOption, selectedMultiTargetOptionIds, swInteraction]);

  const handleSkipMoguReleaseSpores = useCallback(() => {
    if (swInteraction?.type !== 'mogu_release_spores_select_positions') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; skip?: boolean } | undefined;
      return value?.action === 'mogu_release_spores_finish' || value?.skip === true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);

  // ---------- 副作用 ----------

  // ---------- 返回 ----------

  return {
    // 模式状态
    eventTargetMode, bloodSummonMode,
    annihilateMode,
    funeralPyreMode,
    mindControlMode,
    stunMode,
    hypnoticLureMode,
    chantEntanglementMode,
    moguSymbioticSelfHealingMode,
    moguReleaseSporesMode,
    sneakMode,
    glacialShiftMode,
    withdrawMode,
    telekinesisTargetMode,
    // 派生
    clearAllEventModes, hasActiveEventMode,
    // 高亮
    validEventTargets, bloodSummonHighlights, annihilateHighlights,
    mindControlHighlights, entanglementHighlights, moguSymbioticSelfHealingHighlights, moguReleaseSporesHighlights, glacialShiftHighlights,
    sneakHighlights, stunHighlights, hypnoticLureHighlights,
    withdrawHighlights, afterAttackAbilityHighlights, telekinesisHighlights,
    // 回调
    handleEventModeClick, handlePlayEvent,
    handleConfirmMindControl,
    handleConfirmGlacialShift, handleConfirmSneak,
    handleConfirmEntanglement,
    handleConfirmMoguSymbioticSelfHealing, handleSkipMoguSymbioticSelfHealing,
    handleConfirmMoguReleaseSpores, handleSkipMoguReleaseSpores,
  };
}
