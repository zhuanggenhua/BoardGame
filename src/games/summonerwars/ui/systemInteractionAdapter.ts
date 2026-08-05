import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import type { CellCoord } from '../domain/types';
import type {
  AbilityModeState,
  AfterAttackAbilityModeState,
  MindCaptureModeState,
  SoulTransferModeState,
} from './useGameEvents';
import type { RapidFireModeState, TelekinesisTargetModeState, WithdrawModeState } from './modeTypes';

export interface SwSimpleChoiceInteraction {
  id: string;
  type: string;
  meta: Record<string, unknown>;
  options: PromptOption[];
}

export interface InteractionAbilityDraft {
  interactionId: string;
  selectedCardIds: string[];
}

export type InteractionDispatchPlan =
  | { command: 'respond'; optionId: string }
  | { command: 'respondMany'; optionIds: string[] }
  | { command: 'cancel' };

export type SystemAbilityUiRoute =
  | 'status-banner-choice'
  | 'board-cell-unit'
  | 'board-cell-position'
  | 'hand-card-select'
  | 'card-selector';

export const ACTIVATED_ABILITY_IDS = [
  'revive_undead',
  'fortress_power',
  'telekinesis_instead',
  'high_telekinesis_instead',
  'vanish',
  'mogu_blood_infusion',
  'shadow_return_to_shadow',
] as const;

type ActivatedAbilityId = typeof ACTIVATED_ABILITY_IDS[number];
export const SYSTEM_CARD_SELECTOR_ABILITY_IDS = [
  'revive_undead',
  'fortress_power',
] as const;

type SystemCardSelectorAbilityId = typeof SYSTEM_CARD_SELECTOR_ABILITY_IDS[number];
type SystemCardSelectorTitleKey =
  | 'cardSelector.reviveUndead'
  | 'cardSelector.fortressPower';

const SYSTEM_CARD_SELECTOR_TITLE_KEYS: Record<SystemCardSelectorAbilityId, SystemCardSelectorTitleKey> = {
  revive_undead: 'cardSelector.reviveUndead',
  fortress_power: 'cardSelector.fortressPower',
};

const isCellCoord = (value: unknown): value is CellCoord => {
  if (!value || typeof value !== 'object') return false;
  const coord = value as { row?: unknown; col?: unknown };
  return typeof coord.row === 'number' && typeof coord.col === 'number';
};

const SHOUREN_POSITION_INTERACTIONS = {
  after_summon_shouren_bloody_rush: {
    abilityId: 'shouren_bloody_rush',
    action: 'after_summon_shouren_bloody_rush',
  },
  after_attack_shouren_berserk: {
    abilityId: 'shouren_berserk',
    action: 'after_attack_shouren_berserk',
  },
  after_attack_shouren_brute_impact: {
    abilityId: 'shouren_brute_impact',
    action: 'after_attack_shouren_brute_impact',
  },
  after_attack_shouren_primal_fury: {
    abilityId: 'shouren_primal_fury',
    action: 'after_attack_shouren_primal_fury',
  },
} as const;

type ShourenPositionInteractionType = keyof typeof SHOUREN_POSITION_INTERACTIONS;

const getShourenPositionInteraction = (type: string) => (
  SHOUREN_POSITION_INTERACTIONS[type as ShourenPositionInteractionType]
);

const YONGHENG_HAND_CARD_ACTIONS = {
  yongheng_warning: 'yongheng_warning_card',
  yongheng_application: 'yongheng_application_card',
  yongheng_arouse_fear: 'yongheng_forced_discard_card',
  yongheng_punish: 'yongheng_forced_discard_card',
} as const;

const YONGHENG_HAND_CARD_ABILITIES = Object.keys(YONGHENG_HAND_CARD_ACTIONS);

const getYonghengHandCardAction = (abilityId: string): string | null => (
  YONGHENG_HAND_CARD_ACTIONS[abilityId as keyof typeof YONGHENG_HAND_CARD_ACTIONS] ?? null
);

const isActivatedAbilityId = (value: unknown): value is ActivatedAbilityId => (
  typeof value === 'string' && ACTIVATED_ABILITY_IDS.includes(value as ActivatedAbilityId)
);

export const isSystemCardSelectorAbilityId = (value: unknown): value is SystemCardSelectorAbilityId => (
  typeof value === 'string' && SYSTEM_CARD_SELECTOR_ABILITY_IDS.includes(value as SystemCardSelectorAbilityId)
);

export function getSystemCardSelectorAbilityId(
  abilityMode: AbilityModeState | null | undefined,
): SystemCardSelectorAbilityId | null {
  if (!abilityMode || abilityMode.step !== 'selectCard') return null;
  return isSystemCardSelectorAbilityId(abilityMode.abilityId) ? abilityMode.abilityId : null;
}

export function getSystemCardSelectorTitleKey(
  abilityId: SystemCardSelectorAbilityId,
): SystemCardSelectorTitleKey {
  return SYSTEM_CARD_SELECTOR_TITLE_KEYS[abilityId];
}

export function isSwSimpleChoiceType(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  type: string,
): boolean {
  return swInteraction?.type === type;
}

export function deriveInteractionCardsByOptionIds<TCard extends { id: string }>(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  expectedType: string,
  cards: TCard[],
): TCard[] | null {
  if (!isSwSimpleChoiceType(swInteraction, expectedType)) return null;
  const cardLookup = new Map(cards.map((card) => [card.id, card]));
  return swInteraction.options
    .map((option) => cardLookup.get(option.id))
    .filter((card): card is TCard => !!card);
}

export function deriveAfterAttackAbilityMode(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
): AfterAttackAbilityModeState | null {
  if (
    !swInteraction
    || (
      swInteraction.type !== 'after_attack_mind_transmission'
      && swInteraction.type !== 'after_attack_telekinesis_target'
    )
  ) {
    return null;
  }

  const sourceUnitId = typeof swInteraction.meta?.sourceUnitId === 'string' ? swInteraction.meta.sourceUnitId : undefined;
  const sourcePosition = isCellCoord(swInteraction.meta?.sourcePosition) ? swInteraction.meta.sourcePosition : undefined;
  const abilityId = swInteraction.meta?.abilityId;
  if (
    !sourceUnitId
    || !sourcePosition
    || (
      abilityId !== 'telekinesis'
      && abilityId !== 'high_telekinesis'
      && abilityId !== 'mind_transmission'
    )
  ) {
    return null;
  }

  return {
    abilityId,
    sourceUnitId,
    sourcePosition,
  };
}

export function deriveSoulTransferMode(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
): SoulTransferModeState | null {
  if (!swInteraction || swInteraction.type !== 'soul_transfer') return null;
  const sourceUnitId = typeof swInteraction.meta?.sourceUnitId === 'string' ? swInteraction.meta.sourceUnitId : undefined;
  const sourcePosition = isCellCoord(swInteraction.meta?.sourcePosition) ? swInteraction.meta.sourcePosition : undefined;
  const victimPosition = isCellCoord(swInteraction.meta?.victimPosition) ? swInteraction.meta.victimPosition : undefined;
  if (!sourceUnitId || !sourcePosition || !victimPosition) return null;
  return {
    sourceUnitId,
    sourcePosition,
    victimPosition,
  };
}

export function deriveMindCaptureMode(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
): MindCaptureModeState | null {
  if (!swInteraction || swInteraction.type !== 'mind_capture') return null;
  const sourceUnitId = typeof swInteraction.meta?.sourceUnitId === 'string' ? swInteraction.meta.sourceUnitId : undefined;
  const sourcePosition = isCellCoord(swInteraction.meta?.sourcePosition) ? swInteraction.meta.sourcePosition : undefined;
  const targetPosition = isCellCoord(swInteraction.meta?.targetPosition) ? swInteraction.meta.targetPosition : undefined;
  const targetUnitId = typeof swInteraction.meta?.targetUnitId === 'string' ? swInteraction.meta.targetUnitId : undefined;
  const hits = typeof swInteraction.meta?.hits === 'number' ? swInteraction.meta.hits : undefined;
  if (!sourceUnitId || !sourcePosition || !targetPosition || !targetUnitId || !hits) return null;
  return {
    sourceUnitId,
    sourcePosition,
    targetPosition,
    targetUnitId,
    hits,
  };
}

export function deriveRapidFireMode(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
): RapidFireModeState | null {
  if (!swInteraction || swInteraction.type !== 'after_attack_rapid_fire') return null;
  const sourceUnitId = typeof swInteraction.meta?.sourceUnitId === 'string' ? swInteraction.meta.sourceUnitId : undefined;
  const sourcePosition = isCellCoord(swInteraction.meta?.sourcePosition) ? swInteraction.meta.sourcePosition : undefined;
  if (!sourceUnitId || !sourcePosition) return null;
  return {
    sourceUnitId,
    sourcePosition,
  };
}

export function deriveWithdrawMode(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
): WithdrawModeState | null {
  if (!swInteraction) return null;
  const sourceUnitId = typeof swInteraction.meta?.sourceUnitId === 'string' ? swInteraction.meta.sourceUnitId : undefined;
  if (!sourceUnitId) return null;

  if (swInteraction.type === 'after_attack_withdraw_cost') {
    return {
      sourceUnitId,
      step: 'selectCost',
    };
  }

  if (swInteraction.type === 'after_attack_withdraw_position') {
    const costType = swInteraction.meta?.costType;
    if (costType !== 'charge' && costType !== 'magic') return null;
    return {
      sourceUnitId,
      step: 'selectPosition',
      costType,
    };
  }

  return null;
}

export function deriveTelekinesisTargetMode(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
): TelekinesisTargetModeState | null {
  if (!swInteraction) return null;
  const isSystemDirectionMode = swInteraction.type === 'after_attack_telekinesis_direction'
    || (swInteraction.type === 'activated_ability_target' && swInteraction.meta?.step === 'selectDirection');
  if (!isSystemDirectionMode) return null;

  const sourceUnitId = typeof swInteraction.meta?.sourceUnitId === 'string' ? swInteraction.meta.sourceUnitId : undefined;
  const sourcePosition = isCellCoord(swInteraction.meta?.sourcePosition) ? swInteraction.meta.sourcePosition : undefined;
  const targetPosition = isCellCoord(swInteraction.meta?.targetPosition) ? swInteraction.meta.targetPosition : undefined;
  const abilityId = swInteraction.meta?.abilityId;
  if (
    !sourceUnitId
    || !targetPosition
    || (
      abilityId !== 'telekinesis'
      && abilityId !== 'high_telekinesis'
      && abilityId !== 'telekinesis_instead'
      && abilityId !== 'high_telekinesis_instead'
    )
  ) {
    return null;
  }

  const destinations = swInteraction.options
    .map((option) => {
      const value = option.value as {
        moveRow?: number;
        moveCol?: number;
      } | undefined;
      const match = typeof option.id === 'string' ? option.id.match(/^pos:(\d+),(\d+)$/) : null;
      if (!match || typeof value?.moveRow !== 'number' || typeof value?.moveCol !== 'number') return null;
      return {
        position: { row: Number(match[1]), col: Number(match[2]) },
        moveRow: value.moveRow,
        moveCol: value.moveCol,
      };
    })
    .filter((item): item is { position: CellCoord; moveRow: number; moveCol: number } => !!item);

  return {
    abilityId,
    sourceUnitId,
    sourcePosition,
    targetPosition,
    destinations,
  };
}

export function isActivatedAbilityInteraction(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityId: ActivatedAbilityId,
  step?: string,
): boolean {
  if (!swInteraction || swInteraction.type !== 'activated_ability_target') return false;
  if (swInteraction.meta?.abilityId !== abilityId) return false;
  if (step && swInteraction.meta?.step !== step) return false;
  return true;
}

export function findActivatedAbilityTargetOptionByPosition(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityId: ActivatedAbilityId,
  position: CellCoord,
  step?: string,
): PromptOption | null {
  if (!isActivatedAbilityInteraction(swInteraction, abilityId, step)) return null;
  return swInteraction.options.find((option) => {
    const value = option.value as {
      action?: string;
      abilityId?: string;
      targetPosition?: CellCoord;
    } | undefined;
    const isDirectActivatedTarget = value?.action === 'activated_ability_target'
      && value.abilityId === abilityId
      && value.targetPosition?.row === position.row
      && value.targetPosition?.col === position.col;
    const isTelekinesisStepTarget = (
      (abilityId === 'telekinesis_instead' || abilityId === 'high_telekinesis_instead')
      && value?.action === 'after_attack_telekinesis_target'
      && value.targetPosition?.row === position.row
      && value.targetPosition?.col === position.col
    );
    return isDirectActivatedTarget || isTelekinesisStepTarget;
  }) ?? null;
}

export function findActivatedAbilityTargetOptionByCardId(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityId: ActivatedAbilityId,
  targetCardId: string,
  step?: string,
): PromptOption | null {
  if (!isActivatedAbilityInteraction(swInteraction, abilityId, step)) return null;
  return swInteraction.options.find((option) => {
    const value = option.value as {
      action?: string;
      abilityId?: string;
      targetCardId?: string;
    } | undefined;
    return value?.action === 'activated_ability_target'
      && value.abilityId === abilityId
      && value.targetCardId === targetCardId;
  }) ?? null;
}

export function listActivatedAbilityTargetCardIds(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityId: ActivatedAbilityId,
  step?: string,
): string[] {
  if (!isActivatedAbilityInteraction(swInteraction, abilityId, step)) return [];
  return swInteraction.options
    .map((option) => {
      const value = option.value as {
        action?: string;
        abilityId?: string;
        targetCardId?: string;
      } | undefined;
      return value?.action === 'activated_ability_target'
        && value.abilityId === abilityId
        && typeof value.targetCardId === 'string'
        ? value.targetCardId
        : null;
    })
    .filter((targetCardId): targetCardId is string => !!targetCardId);
}

export function listSystemCardSelectorTargetCardIds(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityId: SystemCardSelectorAbilityId,
): string[] {
  if (!swInteraction) return [];
  return listActivatedAbilityTargetCardIds(swInteraction, abilityId, 'selectCard');
}

export function findSystemCardSelectorOptionByCardId(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityId: SystemCardSelectorAbilityId,
  targetCardId: string,
): PromptOption | null {
  return findActivatedAbilityTargetOptionByCardId(swInteraction, abilityId, targetCardId, 'selectCard');
}

export function findSystemHandCardOptionByCardId(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityMode: AbilityModeState | null | undefined,
  targetCardId: string,
): PromptOption | null {
  if (!swInteraction || !abilityMode || abilityMode.step !== 'selectCards') return null;
  const expectedAction = getYonghengHandCardAction(abilityMode.abilityId);
  if (!expectedAction) return null;
  return swInteraction.options.find((option) => {
    const value = option.value as { action?: string; targetCardId?: string } | undefined;
    return value?.action === expectedAction && value.targetCardId === targetCardId;
  }) ?? null;
}

export function resolveBeforeAttackCardConfirmation(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityMode: AbilityModeState | null | undefined,
  selectedCardIds: string[],
): InteractionDispatchPlan | null {
  if (!swInteraction || !abilityMode || abilityMode.context !== 'beforeAttack' || abilityMode.step !== 'selectCards') {
    return null;
  }

  if (abilityMode.abilityId === 'holy_arrow' && swInteraction.type === 'before_attack_holy_arrow') {
    const optionIds = selectedCardIds
      .map((cardId) => swInteraction.options.find((opt) => {
        const value = opt.value as { action?: string; cardId?: string } | undefined;
        return value?.action === 'before_attack_holy_arrow' && value.cardId === cardId;
      })?.id ?? null)
      .filter((id): id is string => !!id);
    return { command: 'respondMany', optionIds };
  }

  if (abilityMode.abilityId === 'healing' && swInteraction.type === 'before_attack_healing') {
    const pickedCardId = selectedCardIds[0];
    if (!pickedCardId) {
      const skipOption = swInteraction.options.find((opt) => {
        const value = opt.value as { skip?: boolean } | undefined;
        return opt.id === 'skip' || value?.skip === true;
      });
      return skipOption ? { command: 'respond', optionId: skipOption.id } : null;
    }
    const option = swInteraction.options.find((opt) => {
      const value = opt.value as { action?: string; cardId?: string } | undefined;
      return value?.action === 'before_attack_healing' && value.cardId === pickedCardId;
    });
    return option ? { command: 'respond', optionId: option.id } : null;
  }

  return null;
}

export function resolveBeforeAttackCancellation(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
): InteractionDispatchPlan | null {
  if (
    swInteraction?.type !== 'before_attack_life_drain'
    && swInteraction?.type !== 'before_attack_holy_arrow'
    && swInteraction?.type !== 'before_attack_healing'
  ) {
    return null;
  }

  const skipOption = swInteraction.options.find((opt) => {
    const value = opt.value as { skip?: boolean } | undefined;
    return opt.id === 'skip' || value?.skip === true;
  });
  return skipOption
    ? { command: 'respond', optionId: skipOption.id }
    : { command: 'cancel' };
}

export function findActivatedAbilityDirectionOptionByPosition(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityId: Extract<ActivatedAbilityId, 'telekinesis_instead' | 'high_telekinesis_instead'>,
  position: CellCoord,
): PromptOption | null {
  if (!isActivatedAbilityInteraction(swInteraction, abilityId, 'selectDirection')) return null;
  return swInteraction.options.find((option) => {
    const value = option.value as {
      action?: string;
    } | undefined;
    const match = typeof option.id === 'string' ? option.id.match(/^pos:(\d+),(\d+)$/) : null;
    return value?.action === 'after_attack_telekinesis_direction'
      && !!match
      && Number(match[1]) === position.row
      && Number(match[2]) === position.col;
  }) ?? null;
}

export function findStructureShiftDirectionOption(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  targetPosition: CellCoord,
  newPosition: CellCoord,
): PromptOption | null {
  if (swInteraction?.type !== 'after_move_structure_shift_direction') return null;
  return swInteraction.options.find((option) => {
    const value = option.value as {
      action?: string;
      targetPosition?: CellCoord;
      newPosition?: CellCoord;
    } | undefined;
    return value?.action === 'after_move_structure_shift_direction'
      && value.targetPosition?.row === targetPosition.row
      && value.targetPosition?.col === targetPosition.col
      && value.newPosition?.row === newPosition.row
      && value.newPosition?.col === newPosition.col;
  }) ?? null;
}

export function findIceRamPushOption(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  pushNewPosition: CellCoord,
): PromptOption | null {
  if (swInteraction?.type !== 'ice_ram_push') return null;
  return swInteraction.options.find((option) => {
    const value = option.value as {
      action?: string;
      pushNewPosition?: CellCoord;
    } | undefined;
    return value?.action === 'ice_ram_push'
      && value.pushNewPosition?.row === pushNewPosition.row
      && value.pushNewPosition?.col === pushNewPosition.col;
  }) ?? null;
}

export function listSystemAbilityPositionTargets(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityMode: AbilityModeState | null | undefined,
): CellCoord[] {
  if (!swInteraction || !abilityMode) return [];

  const shadowPositionValues = swInteraction.options
    .map((option) => option.value as {
      action?: string;
      targetPosition?: CellCoord;
      gatePosition?: CellCoord;
      newPosition?: CellCoord;
    } | undefined)
    .filter((value): value is {
      action?: string;
      targetPosition?: CellCoord;
      gatePosition?: CellCoord;
      newPosition?: CellCoord;
    } => !!value);

  if (abilityMode.abilityId === 'shadow_tear_the_veil' && swInteraction.type === 'shadow_tear_the_veil_select_gate') {
    return shadowPositionValues
      .filter((value) => value.action === 'shadow_tear_the_veil_target_gate' && isCellCoord(value.gatePosition))
      .map((value) => value.gatePosition as CellCoord);
  }

  if (abilityMode.abilityId === 'shadow_tear_the_veil' && swInteraction.type === 'shadow_tear_the_veil_select_position') {
    return shadowPositionValues
      .filter((value) => value.action === 'shadow_tear_the_veil' && isCellCoord(value.newPosition))
      .map((value) => value.newPosition as CellCoord);
  }

  if (abilityMode.abilityId === 'shadow_forbidden_knowledge' && swInteraction.type === 'shadow_forbidden_knowledge_select_target') {
    return shadowPositionValues
      .filter((value) => value.action === 'shadow_forbidden_knowledge' && isCellCoord(value.targetPosition))
      .map((value) => value.targetPosition as CellCoord);
  }

  if (abilityMode.abilityId === 'shadow_feint' && swInteraction.type === 'shadow_feint_select_position') {
    return shadowPositionValues
      .filter((value) => value.action === 'shadow_feint' && isCellCoord(value.newPosition))
      .map((value) => value.newPosition as CellCoord);
  }

  if (abilityMode.abilityId === 'shadow_shadow_summon' && swInteraction.type === 'shadow_shadow_summon_select_target') {
    return shadowPositionValues
      .filter((value) => value.action === 'shadow_shadow_summon_target' && isCellCoord(value.targetPosition))
      .map((value) => value.targetPosition as CellCoord);
  }

  if (abilityMode.abilityId === 'shadow_shadow_summon' && swInteraction.type === 'shadow_shadow_summon_select_position') {
    return shadowPositionValues
      .filter((value) => value.action === 'shadow_shadow_summon' && isCellCoord(value.newPosition))
      .map((value) => value.newPosition as CellCoord);
  }

  if (abilityMode.abilityId === 'shadow_sudden_assault' && swInteraction.type === 'shadow_sudden_assault_select_position') {
    return shadowPositionValues
      .filter((value) => value.action === 'shadow_sudden_assault' && isCellCoord(value.newPosition))
      .map((value) => value.newPosition as CellCoord);
  }

  if (abilityMode.abilityId === 'structure_shift' && abilityMode.step === 'selectNewPosition') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
        return value?.action === 'after_move_structure_shift_direction' && isCellCoord(value.newPosition)
          ? value.newPosition
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  if (abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; pushNewPosition?: CellCoord } | undefined;
        return value?.action === 'ice_ram_push' && isCellCoord(value.pushNewPosition)
          ? value.pushNewPosition
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  if (abilityMode.abilityId === 'revive_undead' && abilityMode.step === 'selectPosition') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as {
          action?: string;
          abilityId?: string;
          targetPosition?: CellCoord;
        } | undefined;
        return value?.action === 'activated_ability_target'
          && value.abilityId === 'revive_undead'
          && isCellCoord(value.targetPosition)
          ? value.targetPosition
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  if (abilityMode.abilityId === 'mogu_fanatical_fungus' && abilityMode.step === 'selectPosition') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as {
          action?: string;
          targetPosition?: CellCoord;
          newPosition?: CellCoord;
        } | undefined;
        if (value?.action !== 'after_move_mogu_fanatical_fungus_target') return null;
        return isCellCoord(value.newPosition) ? value.newPosition : value.targetPosition;
      })
      .filter((position): position is CellCoord => !!position);
  }

  if (abilityMode.abilityId === 'huijin_call_guards' && abilityMode.step === 'selectPosition') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; position?: CellCoord } | undefined;
        return value?.action === 'huijin_call_guards_position' && isCellCoord(value.position)
          ? value.position
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  if (abilityMode.abilityId === 'huijin_ram' && abilityMode.step === 'selectPushDirection') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
        return value?.action === 'after_attack_huijin_ram_position' && isCellCoord(value.newPosition)
          ? value.newPosition
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  if (abilityMode.abilityId === 'yongheng_collision' && abilityMode.step === 'selectPushDirection') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
        return value?.action === 'yongheng_collision_position' && isCellCoord(value.newPosition)
          ? value.newPosition
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  if (abilityMode.abilityId === 'yongheng_warning' && abilityMode.step === 'selectPosition') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
        return value?.action === 'yongheng_warning_position' && isCellCoord(value.newPosition)
          ? value.newPosition
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  const shourenInteraction = getShourenPositionInteraction(swInteraction.type);
  if (shourenInteraction?.abilityId === abilityMode.abilityId && abilityMode.step === 'selectPosition') {
    return swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
        return value?.action === shourenInteraction.action && isCellCoord(value.newPosition)
          ? value.newPosition
          : null;
      })
      .filter((position): position is CellCoord => !!position);
  }

  return [];
}

export function findSystemAbilityPositionOption(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityMode: AbilityModeState | null | undefined,
  position: CellCoord,
): PromptOption | null {
  if (!swInteraction || !abilityMode) return null;

  const matchesShadowPosition = (
    action: string,
    field: 'targetPosition' | 'gatePosition' | 'newPosition',
  ): PromptOption | null => swInteraction.options.find((option) => {
    const value = option.value as {
      action?: string;
      targetPosition?: CellCoord;
      gatePosition?: CellCoord;
      newPosition?: CellCoord;
    } | undefined;
    const candidate = value?.[field];
    return value?.action === action
      && candidate?.row === position.row
      && candidate.col === position.col;
  }) ?? null;

  if (abilityMode.abilityId === 'shadow_tear_the_veil' && swInteraction.type === 'shadow_tear_the_veil_select_gate') {
    return matchesShadowPosition('shadow_tear_the_veil_target_gate', 'gatePosition');
  }

  if (abilityMode.abilityId === 'shadow_tear_the_veil' && swInteraction.type === 'shadow_tear_the_veil_select_position') {
    return matchesShadowPosition('shadow_tear_the_veil', 'newPosition');
  }

  if (abilityMode.abilityId === 'shadow_forbidden_knowledge' && swInteraction.type === 'shadow_forbidden_knowledge_select_target') {
    return matchesShadowPosition('shadow_forbidden_knowledge', 'targetPosition');
  }

  if (abilityMode.abilityId === 'shadow_feint' && swInteraction.type === 'shadow_feint_select_position') {
    return matchesShadowPosition('shadow_feint', 'newPosition');
  }

  if (abilityMode.abilityId === 'shadow_shadow_summon' && swInteraction.type === 'shadow_shadow_summon_select_target') {
    return matchesShadowPosition('shadow_shadow_summon_target', 'targetPosition');
  }

  if (abilityMode.abilityId === 'shadow_shadow_summon' && swInteraction.type === 'shadow_shadow_summon_select_position') {
    return matchesShadowPosition('shadow_shadow_summon', 'newPosition');
  }

  if (abilityMode.abilityId === 'shadow_sudden_assault' && swInteraction.type === 'shadow_sudden_assault_select_position') {
    return matchesShadowPosition('shadow_sudden_assault', 'newPosition');
  }

  if (abilityMode.abilityId === 'structure_shift' && abilityMode.step === 'selectNewPosition') {
    return abilityMode.targetPosition
      ? findStructureShiftDirectionOption(swInteraction, abilityMode.targetPosition, position)
      : null;
  }

  if (abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection') {
    return findIceRamPushOption(swInteraction, position);
  }

  if (abilityMode.abilityId === 'revive_undead' && abilityMode.step === 'selectPosition') {
    return findActivatedAbilityTargetOptionByPosition(swInteraction, 'revive_undead', position, 'selectPosition');
  }

  if (abilityMode.abilityId === 'mogu_fanatical_fungus' && abilityMode.step === 'selectPosition') {
    return swInteraction.options.find((option) => {
      const value = option.value as {
        action?: string;
        targetPosition?: CellCoord;
        newPosition?: CellCoord;
      } | undefined;
      if (value?.action !== 'after_move_mogu_fanatical_fungus_target') return false;
      const target = isCellCoord(value.newPosition) ? value.newPosition : value.targetPosition;
      return target?.row === position.row && target.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'huijin_call_guards' && abilityMode.step === 'selectPosition') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; position?: CellCoord } | undefined;
      return value?.action === 'huijin_call_guards_position'
        && value.position?.row === position.row
        && value.position?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'huijin_ram' && abilityMode.step === 'selectPushDirection') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
      return value?.action === 'after_attack_huijin_ram_position'
        && value.newPosition?.row === position.row
        && value.newPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'yongheng_collision' && abilityMode.step === 'selectPushDirection') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
      return value?.action === 'yongheng_collision_position'
        && value.newPosition?.row === position.row
        && value.newPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'yongheng_warning' && abilityMode.step === 'selectPosition') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
      return value?.action === 'yongheng_warning_position'
        && value.newPosition?.row === position.row
        && value.newPosition?.col === position.col;
    }) ?? null;
  }

  const shourenInteraction = getShourenPositionInteraction(swInteraction.type);
  if (shourenInteraction?.abilityId === abilityMode.abilityId && abilityMode.step === 'selectPosition') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; newPosition?: CellCoord } | undefined;
      return value?.action === shourenInteraction.action
        && value.newPosition?.row === position.row
        && value.newPosition?.col === position.col;
    }) ?? null;
  }

  return null;
}

export function findSystemAbilityUnitOptionByPosition(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  abilityMode: AbilityModeState | null | undefined,
  position: CellCoord,
  targetUnitId?: string,
): PromptOption | null {
  if (!swInteraction || !abilityMode || abilityMode.step !== 'selectUnit') return null;

  if (abilityMode.abilityId === 'shadow_judgment' && swInteraction.type === 'shadow_judgment_select_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'shadow_judgment_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'shadow_tear_the_veil' && swInteraction.type === 'shadow_tear_the_veil_select_unit') {
    return swInteraction.options.find((option) => {
      const value = option.value as {
        action?: string;
        targetUnitId?: string;
        targetPosition?: CellCoord;
      } | undefined;
      return value?.action === 'shadow_tear_the_veil_target_unit'
        && ((typeof targetUnitId === 'string' && value.targetUnitId === targetUnitId)
          || (value.targetPosition?.row === position.row && value.targetPosition?.col === position.col));
    }) ?? null;
  }

  if (abilityMode.abilityId === 'ice_ram' && swInteraction.type === 'ice_ram_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'ice_ram_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'structure_shift' && swInteraction.type === 'after_move_structure_shift_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_structure_shift_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.context === 'beforeAttack' && swInteraction.type === 'before_attack_life_drain') {
    return swInteraction.options.find((option) => {
      const value = option.value as {
        action?: string;
        targetUnitId?: string;
        targetPosition?: CellCoord;
      } | undefined;
      return value?.action === 'before_attack_life_drain'
        && (
          (typeof targetUnitId === 'string' && value.targetUnitId === targetUnitId)
          || (value.targetPosition?.row === position.row && value.targetPosition?.col === position.col)
        );
    }) ?? null;
  }

  if (abilityMode.abilityId === 'illusion' && swInteraction.type === 'on_phase_start_illusion') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'on_phase_start_illusion'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'ancestral_bond' && swInteraction.type === 'after_move_ancestral_bond') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_ancestral_bond'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'spirit_bond' && swInteraction.type === 'after_move_spirit_bond') {
    return swInteraction.options.find((option) => {
      const value = option.value as {
        action?: string;
        choice?: string;
        targetPosition?: CellCoord;
      } | undefined;
      return value?.action === 'after_move_spirit_bond'
        && value.choice === 'transfer'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'frost_axe' && swInteraction.type === 'after_move_frost_axe') {
    return swInteraction.options.find((option) => {
      const value = option.value as {
        action?: string;
        choice?: string;
        targetPosition?: CellCoord;
      } | undefined;
      return value?.action === 'after_move_frost_axe'
        && value.choice === 'attach'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'mogu_transmission' && swInteraction.type === 'after_move_mogu_transmission') {
    return swInteraction.options.find((option) => {
      const value = option.value as {
        action?: string;
        targetPosition?: CellCoord;
      } | undefined;
      return (
        (value?.action === 'after_move_mogu_transmission_source'
          || value?.action === 'after_move_mogu_transmission_target')
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col
      );
    }) ?? null;
  }

  if (abilityMode.abilityId === 'vanish') {
    return findActivatedAbilityTargetOptionByPosition(
      swInteraction,
      'vanish',
      position,
      'selectUnit',
    );
  }

  if (abilityMode.abilityId === 'high_telekinesis_instead') {
    return findActivatedAbilityTargetOptionByPosition(
      swInteraction,
      'high_telekinesis_instead',
      position,
      'selectUnit',
    );
  }

  if (abilityMode.abilityId === 'telekinesis_instead') {
    return findActivatedAbilityTargetOptionByPosition(
      swInteraction,
      'telekinesis_instead',
      position,
      'selectUnit',
    );
  }

  if (abilityMode.abilityId === 'mogu_blood_infusion') {
    return findActivatedAbilityTargetOptionByPosition(
      swInteraction,
      'mogu_blood_infusion',
      position,
      'selectUnit',
    );
  }

  if (abilityMode.abilityId === 'shadow_return_to_shadow') {
    return findActivatedAbilityTargetOptionByPosition(
      swInteraction,
      'shadow_return_to_shadow',
      position,
      'selectUnit',
    );
  }

  if (abilityMode.abilityId === 'huijin_ram' && swInteraction.type === 'after_attack_huijin_ram_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_attack_huijin_ram_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'huijin_quick_shot' && swInteraction.type === 'after_move_huijin_quick_shot') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'after_move_huijin_quick_shot'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'huijin_call_guards' && swInteraction.type === 'huijin_call_guards_select_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'huijin_call_guards_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'mogu_decay' && swInteraction.type === 'mogu_decay_select_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'mogu_decay_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'yongheng_mental_invasion' && swInteraction.type === 'yongheng_mental_invasion') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'yongheng_mental_invasion'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'yongheng_collision' && swInteraction.type === 'yongheng_collision_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'yongheng_collision_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  if (abilityMode.abilityId === 'yongheng_application' && swInteraction.type === 'yongheng_application_target') {
    return swInteraction.options.find((option) => {
      const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
      return value?.action === 'yongheng_application_target'
        && value.targetPosition?.row === position.row
        && value.targetPosition?.col === position.col;
    }) ?? null;
  }

  return null;
}

export function getSystemAbilityUiRoute(
  abilityMode: AbilityModeState | null | undefined,
): SystemAbilityUiRoute | null {
  if (!abilityMode) return null;

  if (abilityMode.context === 'beforeAttack') {
    if (abilityMode.abilityId === 'life_drain' && abilityMode.step === 'selectUnit') {
      return 'board-cell-unit';
    }
    if (
      (abilityMode.abilityId === 'holy_arrow' || abilityMode.abilityId === 'healing')
      && abilityMode.step === 'selectCards'
    ) {
      return 'hand-card-select';
    }
    return null;
  }

  if (abilityMode.step === 'selectCard') {
    if (isSystemCardSelectorAbilityId(abilityMode.abilityId)) {
      return 'card-selector';
    }
    return null;
  }

  if (
    (abilityMode.abilityId === 'structure_shift' && abilityMode.step === 'selectUnit')
    || (abilityMode.abilityId === 'structure_shift' && abilityMode.step === 'selectNewPosition')
    || (abilityMode.abilityId === 'revive_undead' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'mogu_fanatical_fungus' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'huijin_call_guards' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectUnit')
    || (abilityMode.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection')
    || (abilityMode.abilityId === 'huijin_ram' && abilityMode.step === 'selectPushDirection')
    || (abilityMode.abilityId === 'yongheng_collision' && abilityMode.step === 'selectPushDirection')
    || (abilityMode.abilityId === 'yongheng_warning' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'shadow_tear_the_veil' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'shadow_tear_the_veil' && abilityMode.step === 'selectNewPosition')
    || (abilityMode.abilityId === 'shadow_forbidden_knowledge' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'shadow_feint' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'shadow_shadow_summon' && abilityMode.step === 'selectPosition')
    || (abilityMode.abilityId === 'shadow_shadow_summon' && abilityMode.step === 'selectNewPosition')
    || (abilityMode.abilityId === 'shadow_sudden_assault' && abilityMode.step === 'selectPosition')
    || (
      abilityMode.step === 'selectPosition'
      && Object.values(SHOUREN_POSITION_INTERACTIONS).some(({ abilityId }) => abilityId === abilityMode.abilityId)
    )
  ) {
    return 'board-cell-position';
  }

  if (
    abilityMode.step === 'selectUnit'
    && (
      abilityMode.abilityId === 'illusion'
      || abilityMode.abilityId === 'spirit_bond'
      || abilityMode.abilityId === 'ancestral_bond'
      || abilityMode.abilityId === 'frost_axe'
      || abilityMode.abilityId === 'mogu_transmission'
      || abilityMode.abilityId === 'vanish'
      || abilityMode.abilityId === 'telekinesis_instead'
      || abilityMode.abilityId === 'high_telekinesis_instead'
      || abilityMode.abilityId === 'mogu_blood_infusion'
      || abilityMode.abilityId === 'mogu_decay'
      || abilityMode.abilityId === 'huijin_call_guards'
      || abilityMode.abilityId === 'huijin_ram'
      || abilityMode.abilityId === 'huijin_quick_shot'
      || abilityMode.abilityId === 'yongheng_mental_invasion'
      || abilityMode.abilityId === 'yongheng_collision'
      || abilityMode.abilityId === 'yongheng_application'
      || abilityMode.abilityId === 'shadow_return_to_shadow'
      || abilityMode.abilityId === 'shadow_judgment'
      || abilityMode.abilityId === 'shadow_tear_the_veil'
    )
  ) {
    return 'board-cell-unit';
  }

  if (abilityMode.step === 'selectCards' && YONGHENG_HAND_CARD_ABILITIES.includes(abilityMode.abilityId)) {
    return 'hand-card-select';
  }

  if (
    abilityMode.step === 'selectChoice'
    && (
      abilityMode.abilityId === 'yongheng_draw'
      || abilityMode.abilityId === 'yongheng_continuance'
      || abilityMode.abilityId === 'shadow_judgment'
    )
  ) {
    return 'status-banner-choice';
  }

  if (abilityMode.abilityId === 'blood_rune' && abilityMode.step === 'selectUnit') {
    return 'status-banner-choice';
  }

  if (abilityMode.abilityId === 'mogu_transmission' && abilityMode.step === 'selectChoice') {
    return 'status-banner-choice';
  }

  return null;
}

export function deriveSystemAbilityMode(
  swInteraction: SwSimpleChoiceInteraction | null | undefined,
  interactionAbilityDraft: InteractionAbilityDraft | null | undefined,
): AbilityModeState | null {
  if (!swInteraction) return null;
  const meta = swInteraction.meta as {
    sourceUnitId?: string;
    sourcePosition?: CellCoord;
    structurePosition?: CellCoord;
    targetPosition?: CellCoord;
    gatePosition?: CellCoord;
    cardId?: string;
    targetCardId?: string;
    abilityId?: string;
    step?: string;
  };

  if (swInteraction.type === 'ice_ram_target') {
    return {
      abilityId: 'ice_ram',
      step: 'selectUnit',
      sourceUnitId: 'ice_ram',
      structurePosition: isCellCoord(meta.structurePosition) ? meta.structurePosition : undefined,
    };
  }

  if (swInteraction.type === 'ice_ram_push') {
    return {
      abilityId: 'ice_ram',
      step: 'selectPushDirection',
      sourceUnitId: 'ice_ram',
      structurePosition: isCellCoord(meta.structurePosition) ? meta.structurePosition : undefined,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
    };
  }

  if (!meta.sourceUnitId) return null;

  if (swInteraction.type === 'shadow_judgment_select_target') {
    return {
      abilityId: 'shadow_judgment',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'shadow_judgment_select_amount') {
    return {
      abilityId: 'shadow_judgment',
      step: 'selectChoice',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
      systemChoiceOptions: swInteraction.options.map((option) => ({
        id: option.id,
        label: typeof option.label === 'string' ? option.label : undefined,
        labelKey: typeof option.labelKey === 'string' ? option.labelKey : undefined,
      })),
    };
  }

  if (swInteraction.type === 'shadow_tear_the_veil_select_unit') {
    return {
      abilityId: 'shadow_tear_the_veil',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'shadow_tear_the_veil_select_gate') {
    return {
      abilityId: 'shadow_tear_the_veil',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'shadow_tear_the_veil_select_position') {
    return {
      abilityId: 'shadow_tear_the_veil',
      step: 'selectNewPosition',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.gatePosition) ? meta.gatePosition : undefined,
    };
  }

  if (swInteraction.type === 'shadow_forbidden_knowledge_select_target') {
    return {
      abilityId: 'shadow_forbidden_knowledge',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'shadow_feint_select_position') {
    return {
      abilityId: 'shadow_feint',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'shadow_shadow_summon_select_target') {
    return {
      abilityId: 'shadow_shadow_summon',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'shadow_shadow_summon_select_position') {
    return {
      abilityId: 'shadow_shadow_summon',
      step: 'selectNewPosition',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
    };
  }

  if (swInteraction.type === 'shadow_sudden_assault_select_position') {
    return {
      abilityId: 'shadow_sudden_assault',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  const shourenPositionInteraction = getShourenPositionInteraction(swInteraction.type);
  if (shourenPositionInteraction) {
    return {
      abilityId: shourenPositionInteraction.abilityId,
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'on_phase_start_illusion') {
    return {
      abilityId: 'illusion',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'on_phase_start_blood_rune') {
    return {
      abilityId: 'blood_rune',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'after_move_spirit_bond') {
    return {
      abilityId: 'spirit_bond',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'after_move_ancestral_bond') {
    return {
      abilityId: 'ancestral_bond',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'after_move_structure_shift_target') {
    return {
      abilityId: 'structure_shift',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'after_move_structure_shift_direction') {
    return {
      abilityId: 'structure_shift',
      step: 'selectNewPosition',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
    };
  }

  if (swInteraction.type === 'after_move_frost_axe') {
    return {
      abilityId: 'frost_axe',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'after_move_mogu_transmission') {
    return {
      abilityId: 'mogu_transmission',
      step: meta.step === 'selectSource' || meta.step === 'selectTarget' ? 'selectUnit' : 'selectChoice',
      sourceUnitId: meta.sourceUnitId,
      systemStep: meta.step,
      systemChoiceOptions: swInteraction.options.map((option) => ({
        id: option.id,
        label: typeof option.label === 'string' ? option.label : undefined,
        labelKey: typeof option.labelKey === 'string' ? option.labelKey : undefined,
      })),
    };
  }

  if (swInteraction.type === 'after_move_mogu_fanatical_fungus') {
    return {
      abilityId: 'mogu_fanatical_fungus',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
      systemChoiceOptions: swInteraction.options.map((option) => ({
        id: option.id,
        label: typeof option.label === 'string' ? option.label : undefined,
        labelKey: typeof option.labelKey === 'string' ? option.labelKey : undefined,
      })),
    };
  }

  if (swInteraction.type === 'after_move_huijin_quick_shot') {
    return {
      abilityId: 'huijin_quick_shot',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'huijin_call_guards_select_target') {
    return {
      abilityId: 'huijin_call_guards',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'mogu_decay_select_target') {
    return {
      abilityId: 'mogu_decay',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'huijin_call_guards_select_position') {
    return {
      abilityId: 'huijin_call_guards',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
    };
  }

  if (swInteraction.type === 'after_attack_huijin_ram_target') {
    return {
      abilityId: 'huijin_ram',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'after_attack_huijin_ram_position') {
    return {
      abilityId: 'huijin_ram',
      step: 'selectPushDirection',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
    };
  }

  if (swInteraction.type === 'yongheng_draw') {
    return {
      abilityId: 'yongheng_draw',
      step: 'selectChoice',
      sourceUnitId: meta.sourceUnitId,
      systemStep: typeof meta.abilityId === 'string' ? meta.abilityId : undefined,
      systemChoiceOptions: swInteraction.options.map((option) => ({
        id: option.id,
        label: typeof option.label === 'string' ? option.label : undefined,
        labelKey: typeof option.labelKey === 'string' ? option.labelKey : undefined,
      })),
    };
  }

  if (swInteraction.type === 'yongheng_continuance') {
    return {
      abilityId: 'yongheng_continuance',
      step: 'selectChoice',
      sourceUnitId: meta.sourceUnitId,
      systemChoiceOptions: swInteraction.options.map((option) => ({
        id: option.id,
        label: typeof option.label === 'string' ? option.label : undefined,
        labelKey: typeof option.labelKey === 'string' ? option.labelKey : undefined,
      })),
    };
  }

  if (swInteraction.type === 'yongheng_mental_invasion') {
    return {
      abilityId: 'yongheng_mental_invasion',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'yongheng_collision_target') {
    return {
      abilityId: 'yongheng_collision',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'yongheng_collision_position') {
    return {
      abilityId: 'yongheng_collision',
      step: 'selectPushDirection',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
    };
  }

  if (swInteraction.type === 'yongheng_warning_card') {
    return {
      abilityId: 'yongheng_warning',
      step: 'selectCards',
      sourceUnitId: meta.sourceUnitId,
      selectableCardIds: swInteraction.options
        .map((option) => {
          const value = option.value as { action?: string; targetCardId?: string } | undefined;
          return value?.action === 'yongheng_warning_card' ? value.targetCardId : null;
        })
        .filter((cardId): cardId is string => !!cardId),
    };
  }

  if (swInteraction.type === 'yongheng_warning_position') {
    return {
      abilityId: 'yongheng_warning',
      step: 'selectPosition',
      sourceUnitId: meta.sourceUnitId,
      targetPosition: isCellCoord(meta.targetPosition) ? meta.targetPosition : undefined,
    };
  }

  if (swInteraction.type === 'yongheng_application_card') {
    return {
      abilityId: 'yongheng_application',
      step: 'selectCards',
      sourceUnitId: meta.sourceUnitId,
      selectableCardIds: swInteraction.options
        .map((option) => {
          const value = option.value as { action?: string; targetCardId?: string } | undefined;
          return value?.action === 'yongheng_application_card' ? value.targetCardId : null;
        })
        .filter((cardId): cardId is string => !!cardId),
    };
  }

  if (swInteraction.type === 'yongheng_application_target') {
    return {
      abilityId: 'yongheng_application',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
    };
  }

  if (swInteraction.type === 'yongheng_forced_discard') {
    const abilityId = meta.abilityId === 'yongheng_punish' ? 'yongheng_punish' : 'yongheng_arouse_fear';
    return {
      abilityId,
      step: 'selectCards',
      sourceUnitId: meta.sourceUnitId,
      selectableCardIds: swInteraction.options
        .map((option) => {
          const value = option.value as { action?: string; targetCardId?: string } | undefined;
          return value?.action === 'yongheng_forced_discard_card' ? value.targetCardId : null;
        })
        .filter((cardId): cardId is string => !!cardId),
    };
  }

  if (swInteraction.type === 'activated_ability_target' && isActivatedAbilityId(meta.abilityId)) {
    if (meta.abilityId === 'shadow_return_to_shadow' && meta.step === 'selectUnit') {
      return {
        abilityId: 'shadow_return_to_shadow',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (meta.abilityId === 'vanish' && meta.step === 'selectUnit') {
      return {
        abilityId: 'vanish',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (meta.abilityId === 'mogu_blood_infusion' && meta.step === 'selectUnit') {
      return {
        abilityId: 'mogu_blood_infusion',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if ((meta.abilityId === 'telekinesis_instead' || meta.abilityId === 'high_telekinesis_instead')
      && meta.step === 'selectUnit') {
      return {
        abilityId: meta.abilityId,
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (meta.abilityId === 'fortress_power' && meta.step === 'selectCard') {
      return {
        abilityId: 'fortress_power',
        step: 'selectCard',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (meta.abilityId === 'revive_undead' && meta.step === 'selectCard') {
      return {
        abilityId: 'revive_undead',
        step: 'selectCard',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (meta.abilityId === 'revive_undead' && meta.step === 'selectPosition') {
      return {
        abilityId: 'revive_undead',
        step: 'selectPosition',
        sourceUnitId: meta.sourceUnitId,
        selectedCardId: typeof meta.targetCardId === 'string' ? meta.targetCardId : undefined,
      };
    }
  }

  if (!isCellCoord(meta.targetPosition)) return null;

  if (swInteraction.type === 'before_attack_life_drain') {
    return {
      abilityId: 'life_drain',
      step: 'selectUnit',
      sourceUnitId: meta.sourceUnitId,
      context: 'beforeAttack',
      pendingAttackTarget: meta.targetPosition,
    };
  }

  if (swInteraction.type === 'before_attack_holy_arrow' || swInteraction.type === 'before_attack_healing') {
    const expectedAction = swInteraction.type;
    const selectableCardIds = swInteraction.options
      .map((option) => {
        const value = option.value as { action?: string; cardId?: string } | undefined;
        return value?.action === expectedAction && typeof value.cardId === 'string' ? value.cardId : null;
      })
      .filter((cardId): cardId is string => !!cardId);
    const selectedCardIds = interactionAbilityDraft?.interactionId === swInteraction.id
      ? interactionAbilityDraft.selectedCardIds.filter((cardId) => selectableCardIds.includes(cardId))
      : [];
    return {
      abilityId: swInteraction.type === 'before_attack_holy_arrow' ? 'holy_arrow' : 'healing',
      step: 'selectCards',
      sourceUnitId: meta.sourceUnitId,
      context: 'beforeAttack',
      selectedCardIds,
      selectableCardIds,
      pendingAttackTarget: meta.targetPosition,
    };
  }

  return null;
}
