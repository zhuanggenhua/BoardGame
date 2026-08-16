/**
 * SummonerWars 交互系统扩展
 *
 * 将领域事件映射为 InteractionSystem 交互，
 * 并在交互完成后执行对应的领域命令。
 */

import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import type { EngineSystem, HookResult } from '../../../engine/systems/types';
import {
  INTERACTION_EVENTS,
  createSimpleChoice as createEngineSimpleChoice,
  queueInteraction,
} from '../../../engine/systems/InteractionSystem';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';
import type {
  InteractionDescriptor,
  PromptOption,
  PromptMultiConfig,
  SimpleChoiceConfig,
} from '../../../engine/systems/InteractionSystem';
import type { SummonerWarsCore, CellCoord, EventCard, UnitCard, StructureCard, BoardUnit, PlayerId } from './types';
import { SW_COMMANDS, SW_EVENTS } from './types';
import { executeCommand } from './execute';
import { validateCommand } from './validate';
import {
  getAdjacentCells,
  getUnitAt,
  isCellEmpty,
  getPlayerUnits,
  getSummoner,
  manhattanDistance,
  isInStraightLine,
  getStructureAt,
  getUnitAbilities,
  getValidShourenFreezeTargets,
  getHuijinScorchTargets,
  findUnitPositionByInstanceId,
  hasStableAbility,
  getStunDestinations,
  getForceDestinations,
  isValidCoord,
  normalizeUnitBoosts,
  isRangedPathClear,
  BOARD_ROWS,
  BOARD_COLS,
} from './helpers';
import { canActivateAbility } from './abilityHelpers';
import { getBaseCardId, CARD_IDS, isPlagueZombieCard, isFortressUnit, isUndeadCard, isMoguSporePlagueBodyCard } from './ids';
import { getPhaseEndAbilityResolved, withPhaseEndAbilityResolved } from './phaseEndResolution';

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
  CARD_IDS.SHADOW_HIDE_IN_DARKNESS,
  CARD_IDS.SHADOW_MARL_GRIMOIRE,
  CARD_IDS.SHADOW_SHADOW_PULSE,
]);

function buildBloodRuneOptions(core: SummonerWarsCore, owner: PlayerId): PromptOption<SwInteractionValue>[] {
  const options: PromptOption<SwInteractionValue>[] = [
    {
      id: 'damage',
      label: '自伤',
      labelKey: 'actions.bloodRuneDamage',
      value: { action: 'on_phase_start_blood_rune', choice: 'damage' },
    },
  ];
  if (core.players[owner]?.magic >= 1) {
    options.push({
      id: 'charge',
      label: '充能',
      labelKey: 'actions.bloodRuneCharge',
      value: { action: 'on_phase_start_blood_rune', choice: 'charge' },
    });
  }
  return options;
}

type SwInteractionMeta =
  | {
      type: 'infection';
      sourceUnitId: string;
      targetPosition: CellCoord;
    }
  | {
      type: 'shouren_encourage';
      attackerId: string;
    }
  | {
      type: 'event_target';
      cardId: string;
      baseId: string;
    }
  | {
      type: 'shadow_marl_select_card';
      cardId: string;
    }
  | {
      type: 'shadow_marl_select_damage';
      cardId: string;
      targetCardId: string;
      damageTargets: CellCoord[];
      damageCount: number;
    }
  | {
      type: 'shadow_pulse_select_targets';
      cardId: string;
    }
  | {
      type: 'shadow_lightning_step';
      cardId: string;
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'shadow_judgment_select_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'shadow_judgment_select_amount';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
  }
  | {
      type: 'shadow_tear_the_veil_select_unit';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'shadow_tear_the_veil_select_gate';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetUnitId: string;
    }
  | {
      type: 'shadow_tear_the_veil_select_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetUnitId: string;
      gatePosition: CellCoord;
  }
  | {
      type: 'shadow_forbidden_knowledge_select_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
  }
  | {
      type: 'shadow_feint_select_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
  }
  | {
      type: 'shadow_shadow_summon_select_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'shadow_shadow_summon_select_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
  }
  | {
      type: 'shadow_sudden_assault_select_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'magic_event_choice';
      cardId: string;
      baseId: string;
      interaction: boolean;
    }
  | {
      type: 'funeral_pyre';
      cardId: string;
      charges: number;
    }
  | {
      type: 'blood_summon_select_target';
      cardId: string;
      completedCount: number;
    }
  | {
      type: 'blood_summon_select_card';
      cardId: string;
      targetPosition: CellCoord;
      completedCount: number;
    }
  | {
      type: 'blood_summon_select_position';
      cardId: string;
      targetPosition: CellCoord;
      summonCardId: string;
      completedCount: number;
    }
  | {
      type: 'blood_summon_confirm';
      cardId: string;
      completedCount: number;
    }
  | {
      type: 'annihilate_select_targets';
      cardId: string;
    }
  | {
      type: 'annihilate_select_damage';
      cardId: string;
      selectedTargets: CellCoord[];
      currentTargetIndex: number;
      damageTargets: (CellCoord | null)[];
    }
  | {
      type: 'mind_control_select_targets';
      cardId: string;
    }
  | {
      type: 'stun_select_target';
      cardId: string;
    }
  | {
      type: 'stun_select_destination';
      cardId: string;
      targetPosition: CellCoord;
    }
  | {
      type: 'hypnotic_lure_select_target';
      cardId: string;
    }
  | {
      type: 'chant_entanglement_select_targets';
      cardId: string;
    }
  | {
      type: 'mogu_symbiotic_self_healing_select_targets';
      cardId: string;
    }
  | {
      type: 'mogu_release_spores_select_positions';
      cardId: string;
    }
  | {
      type: 'sneak_select_unit';
      cardId: string;
      recorded: { position: CellCoord; newPosition: CellCoord }[];
    }
  | {
      type: 'sneak_select_direction';
      cardId: string;
      currentUnit: CellCoord;
      recorded: { position: CellCoord; newPosition: CellCoord }[];
    }
  | {
      type: 'glacial_shift_select_building';
      cardId: string;
      recorded: { position: CellCoord; newPosition: CellCoord }[];
    }
  | {
      type: 'glacial_shift_select_destination';
      cardId: string;
      currentBuilding: CellCoord;
      recorded: { position: CellCoord; newPosition: CellCoord }[];
    }
  | {
      type: 'grab_follow';
      grabberUnitId: string;
      movedUnitId: string;
      movedTo: CellCoord;
    }
  | {
      type: 'soul_transfer';
      sourceUnitId: string;
      sourcePosition?: CellCoord;
      victimPosition: CellCoord;
    }
  | {
      type: 'mind_capture';
      sourceUnitId: string;
      sourcePosition?: CellCoord;
      targetPosition: CellCoord;
      targetUnitId: string;
      hits: number;
    }
  | {
      type: 'ice_shards';
      sourceUnitId: string;
    }
  | {
      type: 'feed_beast';
      sourceUnitId: string;
    }
  | {
      type: 'mogu_parasite';
      sourceUnitId: string;
    }
  | {
      type: 'mogu_decay_select_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'before_attack_life_drain';
      sourceUnitId: string;
      attackerPosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'before_attack_holy_arrow';
      sourceUnitId: string;
      attackerPosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'before_attack_healing';
      sourceUnitId: string;
      attackerPosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'after_attack_telekinesis_target';
      abilityId: 'telekinesis' | 'high_telekinesis';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_telekinesis_direction';
      abilityId: 'telekinesis' | 'high_telekinesis';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'after_attack_mind_transmission';
      abilityId: 'mind_transmission';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_huijin_ram_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_huijin_ram_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'after_attack_rapid_fire';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_shouren_brute_impact';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
      newPosition: CellCoord;
    }
  | {
      type: 'after_summon_shouren_bloody_rush';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_shouren_berserk';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_shouren_primal_fury';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_withdraw_cost';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_attack_withdraw_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      costType: 'charge' | 'magic';
    }
  | {
      type: 'on_phase_start_illusion';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'on_phase_start_blood_rune';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_move_spirit_bond';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_move_ancestral_bond';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_move_structure_shift_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_move_structure_shift_direction';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'after_move_frost_axe';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'after_move_mogu_transmission';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      step: 'selectMode' | 'selectSource' | 'selectTarget' | 'selectAmount';
      mode?: 'self_to_target' | 'target_to_target';
      fromPosition?: CellCoord;
      toPosition?: CellCoord;
    }
  | {
      type: 'after_move_mogu_fanatical_fungus';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'after_move_huijin_quick_shot';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'yongheng_draw';
      abilityId: 'yongheng_intelligence' | 'yongheng_wisdom' | 'yongheng_analysis' | 'yongheng_search';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'yongheng_mental_invasion';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'yongheng_collision_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'yongheng_collision_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'yongheng_warning_card';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'yongheng_warning_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
      targetCardId: string;
    }
  | {
      type: 'yongheng_application_card';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'yongheng_application_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetCardId: string;
    }
  | {
      type: 'yongheng_forced_discard';
      abilityId: 'yongheng_arouse_fear' | 'yongheng_punish';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetOwner: PlayerId;
    }
  | {
      type: 'yongheng_continuance';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetOwner: PlayerId;
      targetCardId: string;
    }
  | {
      type: 'huijin_call_guards_select_target';
      sourceUnitId: string;
      sourcePosition: CellCoord;
    }
  | {
      type: 'huijin_call_guards_select_position';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      targetPosition: CellCoord;
    }
  | {
      type: 'activated_ability_target';
      abilityId:
        | 'revive_undead'
        | 'fortress_power'
        | 'telekinesis_instead'
        | 'high_telekinesis_instead'
        | 'vanish'
        | 'mogu_blood_infusion'
        | 'shadow_return_to_shadow';
      sourceUnitId: string;
      sourcePosition: CellCoord;
      step?: 'selectCard' | 'selectPosition' | 'selectUnit' | 'selectDirection';
      targetCardId?: string;
      targetPosition?: CellCoord;
    }
  | {
      type: 'fire_sacrifice_summon';
      cardId: string;
      summonPosition: CellCoord;
    }
  | {
      type: 'ice_ram_target';
      structurePosition: CellCoord;
      ownerId: PlayerId;
    }
  | {
      type: 'ice_ram_push';
      structurePosition: CellCoord;
      targetPosition: CellCoord;
    };

type SwInteractionValue =
  | { action: 'infection'; cardId: string; sourceUnitId: string; targetPosition: CellCoord }
  | { action: 'shouren_encourage'; choice: 'reroll' | 'keep' }
  | { action: 'event_target'; targetPosition: CellCoord }
  | { action: 'shadow_marl_card'; targetCardId: string }
  | { action: 'shadow_marl_damage'; targetPosition: CellCoord }
  | { action: 'shadow_marl_finish'; skip?: boolean }
  | { action: 'shadow_pulse_target'; targetPosition: CellCoord }
  | { action: 'shadow_pulse_finish'; skip?: boolean }
  | { action: 'shadow_lightning_step_replace'; targetPosition: CellCoord }
  | { action: 'shadow_judgment_target'; targetPosition: CellCoord }
  | { action: 'shadow_judgment'; targetPosition: CellCoord; amount: number }
  | { action: 'shadow_tear_the_veil_target_unit'; targetUnitId: string; targetPosition: CellCoord }
  | { action: 'shadow_tear_the_veil_target_gate'; gatePosition: CellCoord }
  | { action: 'shadow_tear_the_veil'; targetUnitId: string; gatePosition: CellCoord; newPosition: CellCoord }
  | { action: 'shadow_forbidden_knowledge'; targetPosition: CellCoord }
  | { action: 'shadow_feint'; newPosition: CellCoord }
  | { action: 'shadow_shadow_summon_target'; targetPosition: CellCoord }
  | { action: 'shadow_shadow_summon'; targetPosition: CellCoord; newPosition: CellCoord }
  | { action: 'shadow_sudden_assault'; newPosition: CellCoord }
  | { action: 'magic_event_play' }
  | { action: 'magic_event_discard' }
  | { action: 'funeral_pyre_heal'; targetPosition: CellCoord }
  | { action: 'funeral_pyre_skip'; skip?: boolean }
  | { action: 'blood_summon_target'; targetPosition: CellCoord }
  | { action: 'blood_summon_card'; summonCardId: string }
  | { action: 'blood_summon_position'; summonPosition: CellCoord }
  | { action: 'blood_summon_continue' }
  | { action: 'blood_summon_finish'; skip?: boolean }
  | { action: 'annihilate_target'; targetPosition: CellCoord }
  | { action: 'annihilate_damage'; targetPosition: CellCoord }
  | { action: 'annihilate_damage_skip'; skip?: boolean }
  | { action: 'mind_control_target'; targetPosition: CellCoord }
  | { action: 'stun_target'; targetPosition: CellCoord }
  | { action: 'stun_destination'; targetPosition: CellCoord; moveRow: number; moveCol: number; distance: number }
  | { action: 'hypnotic_lure_target'; targetPosition: CellCoord }
  | { action: 'chant_entanglement_target'; targetPosition: CellCoord }
  | { action: 'mogu_symbiotic_self_healing_target'; targetPosition: CellCoord }
  | { action: 'mogu_symbiotic_self_healing_finish'; skip?: boolean }
  | { action: 'mogu_release_spores_position'; targetPosition: CellCoord }
  | { action: 'mogu_release_spores_finish'; skip?: boolean }
  | { action: 'sneak_unit'; position: CellCoord }
  | { action: 'sneak_destination'; newPosition: CellCoord; targetPosition: CellCoord }
  | { action: 'sneak_finish'; skip?: boolean }
  | { action: 'glacial_shift_building'; position: CellCoord }
  | { action: 'glacial_shift_destination'; newPosition: CellCoord; targetPosition: CellCoord }
  | { action: 'glacial_shift_finish'; skip?: boolean }
  | { action: 'grab_follow'; sourceUnitId: string; targetPosition: CellCoord }
  | { action: 'soul_transfer'; sourceUnitId: string; targetPosition: CellCoord }
  | { action: 'mind_capture'; sourceUnitId: string; targetPosition: CellCoord; hits: number; choice: 'control' | 'damage' }
  | { action: 'ice_shards'; sourceUnitId: string; skip?: boolean }
  | { action: 'feed_beast'; sourceUnitId: string; choice: 'destroy_adjacent' | 'self_destroy'; targetPosition?: CellCoord }
  | { action: 'mogu_parasite'; sourceUnitId: string; choice: 'consume_charge' | 'take_damage' }
  | { action: 'mogu_decay_target'; targetPosition: CellCoord }
  | { action: 'before_attack_life_drain'; targetUnitId: string; targetPosition?: CellCoord }
  | { action: 'before_attack_holy_arrow'; cardId: string }
  | { action: 'before_attack_healing'; cardId: string }
  | { action: 'before_attack_skip'; skip?: boolean }
  | { action: 'after_attack_telekinesis_target'; targetPosition: CellCoord }
  | { action: 'after_attack_telekinesis_direction'; targetPosition: CellCoord; moveRow: number; moveCol: number }
  | { action: 'after_attack_mind_transmission'; targetPosition: CellCoord }
  | { action: 'after_attack_huijin_ram_target'; targetPosition: CellCoord }
  | { action: 'after_attack_huijin_ram_position'; targetPosition: CellCoord; newPosition: CellCoord }
  | { action: 'after_attack_rapid_fire'; confirm?: boolean }
  | { action: 'after_attack_shouren_brute_impact'; targetPosition: CellCoord; newPosition: CellCoord }
  | { action: 'after_summon_shouren_bloody_rush'; newPosition: CellCoord }
  | { action: 'after_attack_shouren_berserk'; newPosition: CellCoord }
  | { action: 'after_attack_shouren_primal_fury'; newPosition: CellCoord }
  | { action: 'after_attack_withdraw_cost'; costType: 'charge' | 'magic' }
  | { action: 'after_attack_withdraw_position'; targetPosition: CellCoord; costType: 'charge' | 'magic' }
  | { action: 'on_phase_start_illusion'; targetPosition: CellCoord }
  | { action: 'on_phase_start_blood_rune'; choice: 'damage' | 'charge' }
  | { action: 'after_move_spirit_bond'; choice: 'self' | 'transfer'; targetPosition?: CellCoord }
  | { action: 'after_move_ancestral_bond'; targetPosition: CellCoord }
  | { action: 'after_move_structure_shift_target'; targetPosition: CellCoord }
  | { action: 'after_move_structure_shift_direction'; targetPosition: CellCoord; newPosition: CellCoord }
  | { action: 'after_move_frost_axe'; choice: 'self' | 'attach'; targetPosition?: CellCoord }
  | { action: 'after_move_mogu_transmission_mode'; mode: 'self_to_target' | 'target_to_target' }
  | { action: 'after_move_mogu_transmission_source'; targetPosition: CellCoord }
  | { action: 'after_move_mogu_transmission_target'; targetPosition: CellCoord }
  | { action: 'after_move_mogu_transmission_amount'; amount: number }
  | { action: 'after_move_mogu_fanatical_fungus_target'; targetPosition: CellCoord; newPosition?: CellCoord }
  | { action: 'after_move_huijin_quick_shot'; targetPosition: CellCoord }
  | { action: 'yongheng_draw'; abilityId: 'yongheng_intelligence' | 'yongheng_wisdom' | 'yongheng_analysis' | 'yongheng_search' }
  | { action: 'yongheng_mental_invasion'; targetPosition: CellCoord }
  | { action: 'yongheng_collision_target'; targetPosition: CellCoord }
  | { action: 'yongheng_collision_position'; targetPosition: CellCoord; newPosition: CellCoord }
  | { action: 'yongheng_warning_card'; targetCardId: string; defId: string }
  | { action: 'yongheng_warning_position'; targetPosition: CellCoord; newPosition: CellCoord; targetCardId: string }
  | { action: 'yongheng_application_card'; targetCardId: string; defId: string }
  | { action: 'yongheng_application_target'; targetPosition: CellCoord; targetCardId: string }
  | { action: 'yongheng_forced_discard_card'; targetOwner: PlayerId; targetCardId: string; defId: string }
  | { action: 'yongheng_continuance_retain'; targetOwner: PlayerId; targetCardId: string }
  | { action: 'huijin_call_guards_target'; targetPosition: CellCoord }
  | { action: 'huijin_call_guards_position'; targetPosition: CellCoord; position: CellCoord }
  | { action: 'activated_ability_target'; abilityId: string; targetPosition?: CellCoord; targetCardId?: string }
  | { action: 'fire_sacrifice_summon'; sacrificeUnitId: string }
  | { action: 'ice_ram_target'; targetPosition: CellCoord }
  | { action: 'ice_ram_push'; targetPosition: CellCoord; pushNewPosition?: CellCoord }
  | { skip: true; action?: undefined };

type SwActionValue = Exclude<SwInteractionValue, { skip: true }>;

type SwSimpleChoiceData<T = unknown> = Record<string, unknown> & {
  options?: PromptOption<T>[];
  optionsGenerator?: (state: MatchState<SummonerWarsCore>, data: SwSimpleChoiceData<T>) => PromptOption<T>[];
  sw?: SwInteractionMeta;
};
type SwSimpleChoiceInteraction<T = unknown> = InteractionDescriptor<SwSimpleChoiceData<T>>;
type SwSimpleChoiceConfig<T = unknown> = SimpleChoiceConfig & {
  optionsGenerator?: (state: MatchState<SummonerWarsCore>, data: SwSimpleChoiceData<T>) => PromptOption<T>[];
};

function createSimpleChoice<T>(
  id: string,
  playerId: PlayerId,
  title: string,
  options: PromptOption<T>[],
  sourceIdOrConfig?: string | SwSimpleChoiceConfig<T>,
  timeout?: number,
  multi?: PromptMultiConfig,
): SwSimpleChoiceInteraction<T> {
  const interaction = createEngineSimpleChoice(
    id,
    playerId,
    title,
    options,
    sourceIdOrConfig,
    timeout,
    multi,
  ) as unknown as SwSimpleChoiceInteraction<T>;
  if (typeof sourceIdOrConfig === 'object' && sourceIdOrConfig?.optionsGenerator) {
    interaction.data = {
      ...interaction.data,
      optionsGenerator: sourceIdOrConfig.optionsGenerator,
    };
  }
  return interaction;
}

type InteractionResolutionPayload = {
  interactionId: string;
  playerId: PlayerId;
  optionId?: string | null;
  value?: SwInteractionValue | null;
  interactionData?: unknown;
  reason?: string;
};

const buildPhaseEndResolutionKey = (
  core: SummonerWarsCore,
  abilityId: string,
  sourceUnitId: string,
): string => `${core.turnNumber}:${core.phase}:${abilityId}:${sourceUnitId}`;

function resolveSwInteractionMeta(data: unknown): SwInteractionMeta | null {
  if (!data || typeof data !== 'object') return null;
  const sw = (data as { sw?: unknown }).sw;
  if (!sw || typeof sw !== 'object') return null;
  return sw as SwInteractionMeta;
}

function isSkipValue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { skip?: boolean; __cancel__?: boolean };
  return candidate.skip === true || candidate.__cancel__ === true;
}

function formatCellCoord(pos: CellCoord): string {
  return `${pos.row + 1},${pos.col + 1}`;
}

function buildGrabFollowOptions(
  core: SummonerWarsCore,
  movedTo: CellCoord,
  grabberUnitId: string,
): PromptOption<SwInteractionValue>[] {
  const positions = getAdjacentCells(movedTo).filter((pos) => isCellEmpty(core, pos));
  return [
    ...buildPositionOptions(positions, (pos) => ({
      action: 'grab_follow',
      sourceUnitId: grabberUnitId,
      targetPosition: pos,
    })),
    {
      id: 'skip',
      label: '跳过',
      labelKey: 'actions.skip',
      value: { skip: true },
    },
  ];
}

function getHuijinCallGuardTargets(core: SummonerWarsCore, owner: PlayerId, sourceUnitId: string): BoardUnit[] {
  return getPlayerUnits(core, owner).filter((unit) =>
    unit.instanceId !== sourceUnitId && unit.card.unitClass === 'common'
  );
}

function getHuijinCallGuardPositions(core: SummonerWarsCore, sourcePosition: CellCoord): CellCoord[] {
  return getAdjacentCells(sourcePosition).filter((pos) => isCellEmpty(core, pos));
}

function getMoguDecayTargets(core: SummonerWarsCore, owner: PlayerId, sourcePosition: CellCoord): BoardUnit[] {
  return getAdjacentCells(sourcePosition)
    .map((pos) => getUnitAt(core, pos))
    .filter((unit): unit is BoardUnit => !!unit && unit.owner === owner);
}

function getHuijinRamTargets(
  core: SummonerWarsCore,
  sourceUnit: { owner: PlayerId },
  sourcePosition: CellCoord,
  preferredTarget?: CellCoord,
): CellCoord[] {
  const candidates = preferredTarget ? [preferredTarget] : getAdjacentCells(sourcePosition);
  return candidates.filter((pos) => {
    if (manhattanDistance(sourcePosition, pos) !== 1) return false;
    const unit = getUnitAt(core, pos);
    return !!unit
      && unit.owner !== sourceUnit.owner
      && (unit.card.unitClass === 'common' || unit.card.unitClass === 'champion');
  });
}

function getHuijinRamDestinations(core: SummonerWarsCore, targetPosition: CellCoord): CellCoord[] {
  return getAdjacentCells(targetPosition).filter((pos) => isCellEmpty(core, pos));
}

function getHuijinQuickShotTargets(
  core: SummonerWarsCore,
  sourceUnitId: string,
  owner: PlayerId,
  sourcePosition: CellCoord,
): CellCoord[] {
  const targets: CellCoord[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const pos = { row, col };
      const unit = getUnitAt(core, pos);
      if (!unit || unit.instanceId === sourceUnitId) continue;
      const dist = manhattanDistance(sourcePosition, pos);
      if (dist <= 0 || dist > 3) continue;
      if (!isInStraightLine(sourcePosition, pos)) continue;
      if (!isRangedPathClear(core, sourcePosition, pos, owner)) continue;
      targets.push(pos);
    }
  }
  return targets;
}

function createConfirmSkipOptions<T extends SwInteractionValue>(
  confirm: T,
): PromptOption<SwInteractionValue>[] {
  return [
    {
      id: 'confirm',
      label: '确认',
      labelKey: 'actions.confirm',
      value: confirm,
    },
    {
      id: 'skip',
      label: '跳过',
      labelKey: 'actions.skip',
      value: { skip: true },
    },
  ];
}

function buildYonghengHandOptions(
  core: SummonerWarsCore,
  playerId: PlayerId,
  buildValue: (card: UnitCard | EventCard | StructureCard) => SwInteractionValue,
): PromptOption<SwInteractionValue>[] {
  return core.players[playerId].hand.map((card) => ({
    id: `card:${card.id}`,
    label: card.name,
    value: buildValue(card as UnitCard | EventCard | StructureCard),
    displayMode: 'card',
  }));
}

function getYonghengMentalInvasionTargets(
  core: SummonerWarsCore,
  owner: PlayerId,
  summonerPosition: CellCoord,
): CellCoord[] {
  const targets: CellCoord[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const position = { row, col };
      const unit = getUnitAt(core, position);
      if (!unit || unit.owner === owner) continue;
      if (unit.card.unitClass !== 'common' && unit.card.unitClass !== 'champion') continue;
      if (manhattanDistance(summonerPosition, position) <= 2) {
        targets.push(position);
      }
    }
  }
  return targets;
}

function getYonghengAdjacentUnitTargets(
  core: SummonerWarsCore,
  sourcePosition: CellCoord,
  owner?: PlayerId,
  enemyOnly = false,
): CellCoord[] {
  return getAdjacentCells(sourcePosition).filter((pos) => {
    const unit = getUnitAt(core, pos);
    if (!unit) return false;
    if (enemyOnly && unit.owner === owner) return false;
    return unit.card.unitClass === 'common' || unit.card.unitClass === 'champion';
  });
}

type YonghengDrawAbilityId = 'yongheng_intelligence' | 'yongheng_wisdom' | 'yongheng_analysis' | 'yongheng_search';

function createYonghengDrawInteraction(
  timestamp: number | undefined,
  owner: PlayerId,
  abilityId: YonghengDrawAbilityId,
  sourceUnitId: string,
  sourcePosition: CellCoord,
): SwSimpleChoiceInteraction<SwInteractionValue> {
  const interaction = createSimpleChoice(
    `sw-yongheng-draw-${abilityId}-${timestamp ?? 0}-${sourceUnitId}`,
    owner,
    'interaction.sw.yonghengDraw',
    createConfirmSkipOptions({ action: 'yongheng_draw', abilityId }),
    { sourceId: abilityId, targetType: 'button', autoResolveIfSingle: false },
  );
  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
  interaction.data = {
    ...interactionData,
    sw: {
      type: 'yongheng_draw',
      abilityId,
      sourceUnitId,
      sourcePosition,
    } satisfies SwInteractionMeta,
  };
  return interaction;
}

function createYonghengForcedDiscardInteraction(
  timestamp: number | undefined,
  core: SummonerWarsCore,
  targetOwner: PlayerId,
  abilityId: 'yongheng_arouse_fear' | 'yongheng_punish',
  sourceUnitId: string,
  sourcePosition: CellCoord,
): SwSimpleChoiceInteraction<SwInteractionValue> | null {
  const options = buildYonghengHandOptions(core, targetOwner, (card) => ({
    action: 'yongheng_forced_discard_card',
    targetOwner,
    targetCardId: card.id,
    defId: getBaseCardId(card.id),
  }));
  if (options.length === 0) return null;
  const interaction = createSimpleChoice(
    `sw-yongheng-forced-discard-${abilityId}-${timestamp ?? 0}-${sourceUnitId}`,
    targetOwner,
    'interaction.sw.yonghengForcedDiscard',
    options,
    { sourceId: abilityId, targetType: 'hand', autoResolveIfSingle: false },
  );
  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
  interaction.data = {
    ...interactionData,
    sw: {
      type: 'yongheng_forced_discard',
      abilityId,
      sourceUnitId,
      sourcePosition,
      targetOwner,
    } satisfies SwInteractionMeta,
  };
  return interaction;
}

function createYonghengContinuanceInteraction(
  timestamp: number | undefined,
  owner: PlayerId,
  targetCardId: string,
  sourceUnitId: string,
  sourcePosition: CellCoord,
): SwSimpleChoiceInteraction<SwInteractionValue> {
  const interaction = createSimpleChoice(
    `sw-yongheng-continuance-${timestamp ?? 0}-${sourceUnitId}-${targetCardId}`,
    owner,
    'interaction.sw.yonghengContinuance',
    createConfirmSkipOptions({
      action: 'yongheng_continuance_retain',
      targetOwner: owner,
      targetCardId,
    }),
    { sourceId: 'yongheng_continuance', targetType: 'button', autoResolveIfSingle: false },
  );
  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
  interaction.data = {
    ...interactionData,
    sw: {
      type: 'yongheng_continuance',
      sourceUnitId,
      sourcePosition,
      targetOwner: owner,
      targetCardId,
    } satisfies SwInteractionMeta,
  };
  return interaction;
}

function buildMoguTransmissionModeInteraction(
  timestamp: number | undefined,
  sourceUnit: NonNullable<ReturnType<typeof getUnitAt>>,
  sourceUnitId: string,
  sourcePosition: CellCoord,
): SwSimpleChoiceInteraction<SwInteractionValue> {
  const options: PromptOption<SwInteractionValue>[] = [
    {
      id: 'self_to_target',
      label: '从自身传输',
      labelKey: 'actions.moguTransmissionSelf',
      value: { action: 'after_move_mogu_transmission_mode', mode: 'self_to_target' },
    },
    {
      id: 'target_to_target',
      label: '从友方传输',
      labelKey: 'actions.moguTransmissionAlly',
      value: { action: 'after_move_mogu_transmission_mode', mode: 'target_to_target' },
    },
    {
      id: 'skip',
      label: '跳过',
      labelKey: 'actions.skip',
      value: { skip: true },
    },
  ];
  const interaction = createSimpleChoice(
    `sw-mogu-transmission-mode-${timestamp ?? 0}-${sourceUnitId}`,
    sourceUnit.owner,
    'interaction.sw.moguTransmission',
    options,
    { sourceId: 'mogu_transmission', targetType: 'minion', autoResolveIfSingle: false },
  );
  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
  interaction.data = {
    ...interactionData,
    sw: {
      type: 'after_move_mogu_transmission',
      sourceUnitId,
      sourcePosition,
      step: 'selectMode',
    } satisfies SwInteractionMeta,
  };
  return interaction;
}

function createMoguTransmissionInteraction(
  timestamp: number | undefined,
  owner: PlayerId,
  sourceUnitId: string,
  sourcePosition: CellCoord,
  step: 'selectMode' | 'selectSource' | 'selectTarget' | 'selectAmount',
  options: PromptOption<SwInteractionValue>[],
  meta: Pick<Extract<SwInteractionMeta, { type: 'after_move_mogu_transmission' }>, 'mode' | 'fromPosition' | 'toPosition'> = {},
): SwSimpleChoiceInteraction<SwInteractionValue> {
  const interaction = createSimpleChoice(
    `sw-mogu-transmission-${step}-${timestamp ?? 0}-${sourceUnitId}`,
    owner,
    'interaction.sw.moguTransmission',
    options,
    { sourceId: 'mogu_transmission', targetType: 'minion', autoResolveIfSingle: false },
  );
  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
  interaction.data = {
    ...interactionData,
    sw: {
      type: 'after_move_mogu_transmission',
      sourceUnitId,
      sourcePosition,
      step,
      ...meta,
    } satisfies SwInteractionMeta,
  };
  return interaction;
}

function applyPhaseEndResolution(
  state: MatchState<SummonerWarsCore>,
  abilityId: string,
  sourceUnitId: string,
): MatchState<SummonerWarsCore> {
  const key = buildPhaseEndResolutionKey(state.core, abilityId, sourceUnitId);
  const resolved = getPhaseEndAbilityResolved(state) ?? {};
  if (resolved[key]) return state;
  return withPhaseEndAbilityResolved(state, {
    ...resolved,
    [key]: true,
  });
}

function clearPhaseEndResolution(state: MatchState<SummonerWarsCore>): MatchState<SummonerWarsCore> {
  if (!getPhaseEndAbilityResolved(state)) return state;
  return withPhaseEndAbilityResolved(state, {});
}

function executeSwCommand(
  state: MatchState<SummonerWarsCore>,
  random: RandomFn,
  command: { type: string; payload: Record<string, unknown>; playerId?: PlayerId; timestamp?: number },
): GameEvent[] {
  const validation = validateCommand(state, {
    type: command.type,
    payload: command.payload,
    playerId: command.playerId ?? state.core.currentPlayer,
  });
  if (!validation.valid) {
    console.warn('[SW-InteractionSystem] Command rejected:', validation.error, command);
    return [];
  }
  return executeCommand(state, {
    type: command.type,
    payload: command.payload,
    playerId: command.playerId ?? state.core.currentPlayer,
    timestamp: 0,
  }, random);
}

function buildPositionOptions<T extends SwActionValue>(
  positions: CellCoord[],
  buildValue: (pos: CellCoord) => T,
): PromptOption<T>[] {
  return positions.map((pos) => ({
    id: `pos:${pos.row},${pos.col}`,
    label: `(${pos.row},${pos.col})`,
    labelKey: 'actions.position',
    labelParams: { row: pos.row, col: pos.col },
    value: buildValue(pos),
  }));
}

function getWithdrawDestinations(
  core: SummonerWarsCore,
  sourcePosition: CellCoord,
): CellCoord[] {
  const result: CellCoord[] = [];
  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  for (const { dr, dc } of dirs) {
    for (let step = 1; step <= 2; step++) {
      const pos = { row: sourcePosition.row + dr * step, col: sourcePosition.col + dc * step };
      if (!isValidCoord(pos) || !isCellEmpty(core, pos)) break;
      result.push(pos);
    }
  }
  return result;
}

function normalizeInteractionValues(value: unknown): SwInteractionValue[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is SwInteractionValue => typeof item === 'object');
  }
  if (typeof value === 'object') {
    return [value as SwInteractionValue];
  }
  return [];
}

function hasQueuedInteraction(state: MatchState<SummonerWarsCore>, interactionId: string): boolean {
  const interaction = state.sys.interaction;
  return interaction.current?.id === interactionId || interaction.queue.some((queued) => queued.id === interactionId);
}

export function createSummonerWarsInteractionSystem(): EngineSystem<SummonerWarsCore> {
  return {
    id: 'summonerwars-interactions',
    name: 'SummonerWars 交互映射',
    priority: 22,

    beforeCommand: ({ state, command }): HookResult<SummonerWarsCore> | void => {
      const payload = command.payload as Record<string, unknown>;
      const playerId = (command.playerId ?? state.core.currentPlayer) as PlayerId;

      if (command.type === SW_COMMANDS.DECLARE_ATTACK) {
        if (payload.beforeAttack || payload.skipBeforeAttack) return;
        const attacker = payload.attacker as CellCoord | undefined;
        const target = payload.target as CellCoord | undefined;
        if (!attacker || !target) return;
        const attackerUnit = getUnitAt(state.core, attacker);
        if (!attackerUnit || attackerUnit.owner !== playerId) return;

        const abilityIds = getUnitAbilities(attackerUnit, state.core);
        const beforeAttackAbility = ['life_drain', 'holy_arrow', 'healing']
          .find((id) => abilityIds.includes(id));
        if (!beforeAttackAbility) return;

        if (beforeAttackAbility === 'life_drain') {
          const candidates = getPlayerUnits(state.core, playerId)
            .filter((unit) => unit.instanceId !== attackerUnit.instanceId
              && manhattanDistance(attacker, unit.position) <= 2);
          if (candidates.length === 0) return;
          const options: PromptOption<SwInteractionValue>[] = [
            ...candidates.map((unit) => ({
              id: `unit:${unit.instanceId}`,
              label: unit.card.name,
              value: {
                action: 'before_attack_life_drain' as const,
                targetUnitId: unit.instanceId,
                targetPosition: unit.position,
              },
            })),
            {
              id: 'skip',
              label: '跳过',
              labelKey: 'actions.skip',
              value: { action: 'before_attack_skip' as const, skip: true },
            },
          ];
          const interaction = createSimpleChoice(
            `sw-before-attack-life-drain-${state.core.turnNumber}-${attackerUnit.instanceId}`,
            playerId,
            'interaction.sw.beforeAttack.lifeDrain',
            options,
            { sourceId: 'before_attack', targetType: 'minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'before_attack_life_drain',
              sourceUnitId: attackerUnit.instanceId,
              attackerPosition: attacker,
              targetPosition: target,
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }

        if (beforeAttackAbility === 'holy_arrow') {
          const player = state.core.players[playerId];
          const options: PromptOption<SwInteractionValue>[] = [];
          const usedNames = new Set<string>();
          for (const card of player.hand) {
            if (card.cardType !== 'unit') continue;
            if (card.name === attackerUnit.card.name) continue;
            if (usedNames.has(card.name)) continue;
            usedNames.add(card.name);
            options.push({
              id: card.id,
              label: card.name,
              value: { action: 'before_attack_holy_arrow', cardId: card.id },
              displayMode: 'card',
            });
          }
          if (options.length === 0) return;
          options.push({
            id: 'skip',
            label: '跳过',
            labelKey: 'actions.skip',
            value: { action: 'before_attack_skip', skip: true },
          });
          const interaction = createSimpleChoice(
            `sw-before-attack-holy-arrow-${state.core.turnNumber}-${attackerUnit.instanceId}`,
            playerId,
            'interaction.sw.beforeAttack.holyArrow',
            options,
            {
              sourceId: 'before_attack',
              targetType: 'hand',
              autoResolveIfSingle: false,
              multi: { min: 0 },
            },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'before_attack_holy_arrow',
              sourceUnitId: attackerUnit.instanceId,
              attackerPosition: attacker,
              targetPosition: target,
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }

        if (beforeAttackAbility === 'healing') {
          const healTargetUnit = getUnitAt(state.core, target);
          if (!healTargetUnit || healTargetUnit.owner !== playerId) return;
          if (healTargetUnit.card.unitClass !== 'common' && healTargetUnit.card.unitClass !== 'champion') return;

          const player = state.core.players[playerId];
          const options: PromptOption<SwInteractionValue>[] = player.hand.map((card) => ({
            id: card.id,
            label: card.name,
            value: { action: 'before_attack_healing', cardId: card.id },
            displayMode: 'card',
          }));
          if (options.length === 0) return;
          options.push({
            id: 'skip',
            label: '跳过',
            labelKey: 'actions.skip',
            value: { action: 'before_attack_skip', skip: true },
          });
          const interaction = createSimpleChoice(
            `sw-before-attack-healing-${state.core.turnNumber}-${attackerUnit.instanceId}`,
            playerId,
            'interaction.sw.beforeAttack.healing',
            options,
            { sourceId: 'before_attack', targetType: 'hand', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'before_attack_healing',
              sourceUnitId: attackerUnit.instanceId,
              attackerPosition: attacker,
              targetPosition: target,
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }
      }

      if (command.type === SW_COMMANDS.ACTIVATE_ABILITY) {
        const abilityId = payload.abilityId as string | undefined;
        const sourceUnitId = payload.sourceUnitId as string | undefined;
        if (!abilityId || !sourceUnitId) return;
        const sourcePosition = findUnitPositionByInstanceId(state.core, sourceUnitId);
        const sourceUnit = sourcePosition ? getUnitAt(state.core, sourcePosition) : undefined;
        if (!sourcePosition || !sourceUnit || sourceUnit.owner !== playerId) return;
        if (!canActivateAbility(state.core, sourceUnit, abilityId, playerId)) return;

        if (abilityId === 'shadow_return_to_shadow') {
          const targetPosition = payload.targetPosition as CellCoord | undefined;
          if (targetPosition) return;
          const candidates = getPlayerUnits(state.core, playerId)
            .filter((unit) => unit.instanceId !== sourceUnitId
              && unit.card.unitClass !== 'summoner'
              && manhattanDistance(sourcePosition, unit.position) <= 3);
          if (candidates.length === 0) return;
          const options: PromptOption<SwInteractionValue>[] = candidates.map((unit) => ({
            id: `pos:${unit.position.row},${unit.position.col}`,
            label: unit.card.name,
            value: {
              action: 'activated_ability_target',
              abilityId: 'shadow_return_to_shadow',
              targetPosition: unit.position,
            },
          }));
          const interaction = createSimpleChoice(
            `sw-activate-shadow-return-to-shadow-${state.core.turnNumber}-${sourceUnitId}`,
            playerId,
            'interaction.sw.shadowReturnToShadow',
            options,
            { sourceId: 'shadow_return_to_shadow', targetType: 'minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'activated_ability_target',
              abilityId: 'shadow_return_to_shadow',
              sourceUnitId,
              sourcePosition,
              step: 'selectUnit',
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }

        if (abilityId === 'revive_undead') {
          const targetCardId = payload.targetCardId as string | undefined;
          const targetPosition = payload.targetPosition as CellCoord | undefined;
          if (targetCardId && targetPosition) return;
          const player = state.core.players[playerId];
          const discardCards = player.discard.filter((card) => card.cardType === 'unit' && isUndeadCard(card));
          if (discardCards.length === 0) return;
          const options: PromptOption<SwInteractionValue>[] = discardCards.map((card) => ({
            id: card.id,
            label: card.name,
            value: { action: 'activated_ability_target', abilityId: 'revive_undead', targetCardId: card.id },
            displayMode: 'card',
          }));
          const interaction = createSimpleChoice(
            `sw-activate-revive-undead-${state.core.turnNumber}-${sourceUnitId}`,
            playerId,
            'interaction.sw.reviveUndead',
            options,
            { sourceId: 'revive_undead', targetType: 'discard_minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'activated_ability_target',
              abilityId: 'revive_undead',
              sourceUnitId,
              sourcePosition,
              step: 'selectCard',
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }

        if (abilityId === 'fortress_power') {
          const targetCardId = payload.targetCardId as string | undefined;
          if (targetCardId) return;
          const player = state.core.players[playerId];
          const discardCards = player.discard.filter((card) => card.cardType === 'unit' && isFortressUnit(card));
          if (discardCards.length === 0) return;
          const options: PromptOption<SwInteractionValue>[] = discardCards.map((card) => ({
            id: card.id,
            label: card.name,
            value: { action: 'activated_ability_target', abilityId: 'fortress_power', targetCardId: card.id },
            displayMode: 'card',
          }));
          const interaction = createSimpleChoice(
            `sw-activate-fortress-power-${state.core.turnNumber}-${sourceUnitId}`,
            playerId,
            'interaction.sw.fortressPower',
            options,
            { sourceId: 'fortress_power', targetType: 'discard_minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'activated_ability_target',
              abilityId: 'fortress_power',
              sourceUnitId,
              sourcePosition,
              step: 'selectCard',
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }

        if (abilityId === 'vanish') {
          const targetPosition = payload.targetPosition as CellCoord | undefined;
          if (targetPosition) return;
          const candidates = getPlayerUnits(state.core, playerId)
            .filter((unit) => unit.instanceId !== sourceUnitId && unit.card.cost === 0);
          if (candidates.length === 0) return;
          const options: PromptOption<SwInteractionValue>[] = candidates.map((unit) => ({
            id: `pos:${unit.position.row},${unit.position.col}`,
            label: unit.card.name,
            value: {
              action: 'activated_ability_target',
              abilityId: 'vanish',
              targetPosition: unit.position,
            },
          }));
          const interaction = createSimpleChoice(
            `sw-activate-vanish-${state.core.turnNumber}-${sourceUnitId}`,
            playerId,
            'interaction.sw.vanish',
            options,
            { sourceId: 'vanish', targetType: 'minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'activated_ability_target',
              abilityId: 'vanish',
              sourceUnitId,
              sourcePosition,
              step: 'selectUnit',
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }

        if (abilityId === 'mogu_blood_infusion') {
          const targetPosition = payload.targetPosition as CellCoord | undefined;
          if (targetPosition) return;
          const candidates = getPlayerUnits(state.core, playerId)
            .filter((unit) => manhattanDistance(sourcePosition, unit.position) <= 2);
          if (candidates.length === 0) return;
          const options: PromptOption<SwInteractionValue>[] = candidates.map((unit) => ({
            id: `pos:${unit.position.row},${unit.position.col}`,
            label: unit.card.name,
            value: {
              action: 'activated_ability_target',
              abilityId: 'mogu_blood_infusion',
              targetPosition: unit.position,
            },
          }));
          const interaction = createSimpleChoice(
            `sw-activate-mogu-blood-infusion-${state.core.turnNumber}-${sourceUnitId}`,
            playerId,
            'interaction.sw.moguBloodInfusion',
            options,
            { sourceId: 'mogu_blood_infusion', targetType: 'minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'activated_ability_target',
              abilityId: 'mogu_blood_infusion',
              sourceUnitId,
              sourcePosition,
              step: 'selectUnit',
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }

        if (abilityId === 'telekinesis_instead' || abilityId === 'high_telekinesis_instead') {
          const targetPosition = payload.targetPosition as CellCoord | undefined;
          const moveRow = payload.moveRow as number | undefined;
          const moveCol = payload.moveCol as number | undefined;
          if (targetPosition && moveRow !== undefined && moveCol !== undefined) return;
          const maxRange = abilityId === 'high_telekinesis_instead' ? 3 : 2;
          const candidates: CellCoord[] = [];
          for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
              const unit = state.core.board[row]?.[col]?.unit;
              if (!unit || unit.card.unitClass === 'summoner') continue;
              if (hasStableAbility(unit, state.core)) continue;
              const dist = manhattanDistance(sourcePosition, { row, col });
              if (dist > 0 && dist <= maxRange) {
                candidates.push({ row, col });
              }
            }
          }
          if (candidates.length === 0) return;
          const options: PromptOption<SwInteractionValue>[] = [
            ...buildPositionOptions(candidates, (pos) => ({
              action: 'after_attack_telekinesis_target',
              targetPosition: pos,
            })),
            {
              id: 'skip',
              label: '跳过',
              labelKey: 'actions.skip',
              value: { skip: true },
            },
          ];
          const interaction = createSimpleChoice(
            `sw-activate-${abilityId}-target-${state.core.turnNumber}-${sourceUnitId}`,
            playerId,
            'interaction.sw.telekinesisTarget',
            options,
            { sourceId: abilityId, targetType: 'minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'activated_ability_target',
              abilityId,
              sourceUnitId,
              sourcePosition,
              step: 'selectUnit',
            } satisfies SwInteractionMeta,
          };
          return { halt: true, state: queueInteraction(state, interaction) };
        }
      }

      if (command.type === SW_COMMANDS.SUMMON_UNIT) {
        const cardId = payload.cardId as string | undefined;
        const position = payload.position as CellCoord | undefined;
        const sacrificeUnitId = payload.sacrificeUnitId as string | undefined;
        if (!cardId || !position || sacrificeUnitId) return;
        const player = state.core.players[playerId];
        const card = player.hand.find((c) => c.id === cardId);
        if (!card || card.cardType !== 'unit') return;
        const unitCard = card as UnitCard;
        const hasFireSacrifice = (unitCard.abilities ?? []).includes('fire_sacrifice_summon');
        if (!hasFireSacrifice) return;
        const candidates = getPlayerUnits(state.core, playerId)
          .filter((unit) => unit.card.unitClass !== 'summoner');
        if (candidates.length === 0) return;
        const options: PromptOption<SwInteractionValue>[] = candidates.map((unit) => ({
          id: `unit:${unit.instanceId}`,
          label: unit.card.name,
          value: { action: 'fire_sacrifice_summon', sacrificeUnitId: unit.instanceId },
        }));
        const interaction = createSimpleChoice(
          `sw-fire-sacrifice-${state.core.turnNumber}-${cardId}`,
          playerId,
          'interaction.sw.fireSacrificeSummon',
          options,
          { sourceId: 'fire_sacrifice_summon', targetType: 'minion', autoResolveIfSingle: false },
        );
        const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
        interaction.data = {
          ...interactionData,
          sw: {
            type: 'fire_sacrifice_summon',
            cardId,
            summonPosition: position,
          } satisfies SwInteractionMeta,
        };
        return { halt: true, state: queueInteraction(state, interaction) };
      }
    },

    afterEvents: ({ state, events, random }): HookResult<SummonerWarsCore> | void => {
      let newState = state;
      const nextEvents: GameEvent[] = [];

      for (const event of events) {
        // 阶段变化时清理 phaseEnd 解析缓存
        if (event.type === FLOW_EVENTS.PHASE_CHANGED) {
          newState = clearPhaseEndResolution(newState);
        }

        if (event.type === FLOW_EVENTS.PHASE_CHANGED || event.type === SW_EVENTS.PHASE_CHANGED) {
          const payload = event.payload as { to?: string; activePlayerId?: PlayerId };
          if (payload.to === 'move' || payload.to === 'build' || payload.to === 'attack') {
            const activePlayerId = payload.activePlayerId ?? newState.core.currentPlayer;
            const player = newState.core.players[activePlayerId];
            const hasSearch = player?.activeEvents.some(card =>
              getBaseCardId(card.id) === CARD_IDS.YONGHENG_SEARCH && card.isActive
            );
            const summoner = hasSearch ? getSummoner(newState.core, activePlayerId) : undefined;
            if (player && player.deck.length > 0 && summoner) {
              const interaction = createYonghengDrawInteraction(
                event.timestamp,
                activePlayerId,
                'yongheng_search',
                summoner.instanceId,
                summoner.position,
              );
              if (!hasQueuedInteraction(newState, interaction.id)) {
                newState = queueInteraction(newState, interaction);
              }
            }
          }
        }

        if (event.type === SW_EVENTS.UNIT_DESTROYED || event.type === SW_EVENTS.UNIT_RETURNED_TO_HAND) {
          const payload = event.payload as { position?: CellCoord; instanceId?: string; unitId?: string };
          const activePlayerId = newState.core.currentPlayer;
          const player = newState.core.players[activePlayerId];
          const lightningStep = player?.activeEvents.find((card) =>
            card.isActive && getBaseCardId(card.id) === CARD_IDS.SHADOW_LIGHTNING_STEP,
          );
          const summoner = getSummoner(newState.core, activePlayerId);
          const targetPosition = payload.position;
          if (!lightningStep || !summoner || newState.core.phase !== 'attack' || !targetPosition) continue;
          if (manhattanDistance(summoner.position, targetPosition) > 3
            || !isCellEmpty(newState.core, targetPosition)) continue;

          const interactionId = `sw-shadow-lightning-step-${event.timestamp ?? 0}-${lightningStep.id}-${payload.instanceId ?? payload.unitId ?? `${targetPosition.row}-${targetPosition.col}`}`;
          if (hasQueuedInteraction(newState, interactionId)) continue;
          const interaction = createSimpleChoice(
            interactionId,
            activePlayerId,
            'interaction.sw.shadowLightningStep',
            [
              {
                id: 'replace',
                label: '迅闪步',
                labelKey: 'actions.shadowLightningStepReplace',
                value: { action: 'shadow_lightning_step_replace', targetPosition },
              },
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ],
            { sourceId: CARD_IDS.SHADOW_LIGHTNING_STEP, targetType: 'button', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'shadow_lightning_step',
              cardId: lightningStep.id,
              sourceUnitId: summoner.instanceId,
              sourcePosition: summoner.position,
              targetPosition,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction, { urgent: true });
        }

        if (event.type === SW_EVENTS.ATTACK_ROLL_PENDING) {
          const pending = newState.core.pendingAttackRoll;
          if (!pending) continue;
          const interactionId = `sw-shouren-encourage-${event.timestamp ?? 0}-${pending.attackerId}`;
          if (hasQueuedInteraction(newState, interactionId)) continue;
          const options: PromptOption<SwInteractionValue>[] = [
            {
              id: 'reroll',
              label: '重掷全部骰子',
              labelKey: 'actions.shourenRerollAll',
              value: { action: 'shouren_encourage', choice: 'reroll' },
            },
            {
              id: 'keep',
              label: '保留当前结果',
              labelKey: 'actions.shourenKeepRoll',
              value: { action: 'shouren_encourage', choice: 'keep' },
            },
          ];
          const interaction = createSimpleChoice(
            interactionId,
            pending.playerId,
            'interaction.sw.shourenEncourage',
            options,
            { sourceId: 'shouren_encourage', targetType: 'button', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'shouren_encourage',
              attackerId: pending.attackerId,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction, { urgent: true });
        }

        if (event.type === SW_EVENTS.EVENT_INTERACTION_REQUESTED) {
          const payload = event.payload as { playerId: PlayerId; cardId: string };
          const player = newState.core.players[payload.playerId];
          if (!player) continue;
          const card = player.hand.find((c) => c.id === payload.cardId);
          if (!card || card.cardType !== 'event') continue;
          const eventCard = card as EventCard;
          const baseId = getBaseCardId(eventCard.id);
          const interactionBaseId = event.timestamp ?? 0;
          const summoner = getSummoner(newState.core, payload.playerId);
          const friendlyUnits = getPlayerUnits(newState.core, payload.playerId);
          const opponentId = payload.playerId === '0' ? '1' : '0';

          const queueEventInteraction = (
            idSuffix: string,
            title: string,
            options: PromptOption<SwInteractionValue>[],
            swMeta: SwInteractionMeta,
            config?: {
              sourceId?: string;
              targetType?: 'minion' | 'hand' | 'generic' | 'button';
              multi?: PromptMultiConfig;
              autoResolveIfSingle?: boolean;
              autoCancelOption?: boolean;
            },
          ) => {
            if (options.length === 0) return;
            const interaction = createSimpleChoice(
              `sw-event-${idSuffix}-${interactionBaseId}-${payload.cardId}`,
              payload.playerId,
              title,
              options,
              {
                sourceId: config?.sourceId ?? idSuffix,
                targetType: config?.targetType,
                multi: config?.multi,
                autoResolveIfSingle: config?.autoResolveIfSingle,
                autoCancelOption: config?.autoCancelOption ?? true,
              },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: swMeta,
            };
            newState = queueInteraction(newState, interaction);
          };

          switch (baseId) {
            case CARD_IDS.SHADOW_HIDE_IN_DARKNESS: {
              if (!summoner) break;
              const targets: CellCoord[] = [];
              for (let row = 0; row < BOARD_ROWS; row += 1) {
                for (let col = 0; col < BOARD_COLS; col += 1) {
                  const position = { row, col };
                  const unit = getUnitAt(newState.core, position);
                  if (unit?.card.unitClass === 'common'
                    && unit.card.life - unit.damage <= 5
                    && manhattanDistance(summoner.position, position) <= 3) {
                    targets.push(position);
                  }
                }
              }
              for (let row = 0; row < BOARD_ROWS; row += 1) {
                for (let col = 0; col < BOARD_COLS; col += 1) {
                  const position = { row, col };
                  const gate = getStructureAt(newState.core, position);
                  if (gate?.card.isGate
                    && gate.card.life - gate.damage <= 5
                    && manhattanDistance(summoner.position, position) <= 3) {
                    targets.push(position);
                  }
                }
              }
              queueEventInteraction(
                'shadow-hide-in-darkness-target',
                'interaction.sw.shadowHideInDarkness',
                buildPositionOptions(targets, (pos) => ({ action: 'event_target', targetPosition: pos })),
                { type: 'event_target', cardId: payload.cardId, baseId },
                { sourceId: baseId, targetType: 'minion', autoResolveIfSingle: false },
              );
              break;
            }
            case CARD_IDS.SHADOW_MARL_GRIMOIRE: {
              const cards = player.discard.filter((discarded) =>
                getBaseCardId(discarded.id) !== CARD_IDS.SHADOW_MARL_GRIMOIRE
                && !(discarded.cardType === 'event' && discarded.eventType === 'legendary'),
              );
              queueEventInteraction(
                'shadow-marl-select-card',
                'interaction.sw.shadowMarlGrimoireCard',
                cards.map((card) => ({
                  id: card.id,
                  label: card.name,
                  value: { action: 'shadow_marl_card', targetCardId: card.id },
                  displayMode: 'card',
                })),
                { type: 'shadow_marl_select_card', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'hand', autoResolveIfSingle: false },
              );
              break;
            }
            case CARD_IDS.SHADOW_SHADOW_PULSE: {
              const isAdjacentToWoundedGate = (position: CellCoord): boolean => getAdjacentCells(position).some((gatePosition) => {
                const gate = getStructureAt(newState.core, gatePosition);
                return !!gate?.card.isGate && gate.damage > 0;
              });
              const targets: CellCoord[] = [];
              for (let row = 0; row < BOARD_ROWS; row += 1) {
                for (let col = 0; col < BOARD_COLS; col += 1) {
                  const position = { row, col };
                  if (getUnitAt(newState.core, position) && isAdjacentToWoundedGate(position)) {
                    targets.push(position);
                  }
                }
              }
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(targets, (pos) => ({
                  action: 'shadow_pulse_target',
                  targetPosition: pos,
                })),
                {
                  id: 'finish',
                  label: '完成',
                  labelKey: 'actions.finish',
                  value: { action: 'shadow_pulse_finish', skip: true },
                },
              ];
              queueEventInteraction(
                'shadow-pulse-targets',
                'interaction.sw.shadowPulse',
                options,
                { type: 'shadow_pulse_select_targets', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'minion', multi: { min: 0 } },
              );
              break;
            }
            case CARD_IDS.NECRO_HELLFIRE_BLADE:
            case CARD_IDS.BARBARIC_CHANT_OF_POWER:
            case CARD_IDS.BARBARIC_CHANT_OF_GROWTH:
            case CARD_IDS.BARBARIC_CHANT_OF_WEAVING:
            case CARD_IDS.MOGU_COMMAND:
            case CARD_IDS.SHOUREN_FREEZE:
            case CARD_IDS.HUIJIN_SCORCH: {
              const targets = (() => {
                if (baseId === CARD_IDS.NECRO_HELLFIRE_BLADE) {
                  return friendlyUnits.filter((unit) => unit.card.unitClass === 'common').map((unit) => unit.position);
                }
                if (baseId === CARD_IDS.MOGU_COMMAND) {
                  if (!summoner) return [];
                  return friendlyUnits
                    .filter((unit) => unit.card.unitClass === 'common'
                      && manhattanDistance(summoner.position, unit.position) <= 3)
                    .map((unit) => unit.position);
                }
                if (baseId === CARD_IDS.SHOUREN_FREEZE) {
                  return getValidShourenFreezeTargets(newState.core, payload.playerId)
                    .map((unit) => unit.position);
                }
                if (baseId === CARD_IDS.HUIJIN_SCORCH) {
                  return getHuijinScorchTargets(newState.core, payload.playerId)
                    .map((unit) => unit.position);
                }
                if (baseId === CARD_IDS.BARBARIC_CHANT_OF_POWER) {
                  if (!summoner) return [];
                  return friendlyUnits
                    .filter((unit) => unit.card.unitClass !== 'summoner'
                      && manhattanDistance(summoner.position, unit.position) <= 3)
                    .map((unit) => unit.position);
                }
                return friendlyUnits.map((unit) => unit.position);
              })();
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'event_target',
                targetPosition: pos,
              }));
              queueEventInteraction(
                'event-target',
                'interaction.sw.eventTarget',
                options,
                { type: 'event_target', cardId: payload.cardId, baseId },
                // 交互事件牌进入交互后不应因单候选自动结算，需允许玩家取消。
                { sourceId: baseId, targetType: 'minion', autoResolveIfSingle: false },
              );
              break;
            }
            case CARD_IDS.NECRO_BLOOD_SUMMON: {
              const targets = friendlyUnits
                .filter((unit) => {
                  const pos = unit.position;
                  const adj = getAdjacentCells(pos);
                  return adj.some((p) => isValidCoord(p) && isCellEmpty(newState.core, p));
                })
                .map((unit) => unit.position);
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'blood_summon_target',
                targetPosition: pos,
              }));
              queueEventInteraction(
                'blood-summon-target',
                'interaction.sw.bloodSummonTarget',
                options,
                { type: 'blood_summon_select_target', cardId: payload.cardId, completedCount: 0 },
                { sourceId: baseId, targetType: 'minion', autoResolveIfSingle: false },
              );
              break;
            }
            case CARD_IDS.NECRO_ANNIHILATE: {
              const targets = friendlyUnits
                .filter((unit) => unit.card.unitClass !== 'summoner')
                .map((unit) => unit.position);
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'annihilate_target',
                targetPosition: pos,
              }));
              queueEventInteraction(
                'annihilate-targets',
                'interaction.sw.annihilateTargets',
                options,
                { type: 'annihilate_select_targets', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'minion', multi: { min: 1 } },
              );
              break;
            }
            case CARD_IDS.TRICKSTER_MIND_CONTROL: {
              if (!summoner) break;
              const targets = getPlayerUnits(newState.core, opponentId)
                .filter((unit) => unit.card.unitClass !== 'summoner'
                  && manhattanDistance(summoner.position, unit.position) <= 2)
                .map((unit) => unit.position);
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'mind_control_target',
                targetPosition: pos,
              }));
              queueEventInteraction(
                'mind-control',
                'interaction.sw.mindControl',
                options,
                { type: 'mind_control_select_targets', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'minion', multi: { min: 1 } },
              );
              break;
            }
            case CARD_IDS.TRICKSTER_STUN: {
              if (!summoner) break;
              const targets = getPlayerUnits(newState.core, opponentId)
                .filter((unit) => unit.card.unitClass !== 'summoner')
                .filter((unit) => {
                  const dist = manhattanDistance(summoner.position, unit.position);
                  return dist > 0 && dist <= 3 && isInStraightLine(summoner.position, unit.position);
                })
                .map((unit) => unit.position);
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'stun_target',
                targetPosition: pos,
              }));
              queueEventInteraction(
                'stun-target',
                'interaction.sw.stunTarget',
                options,
                { type: 'stun_select_target', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'minion', autoResolveIfSingle: false },
              );
              break;
            }
            case CARD_IDS.TRICKSTER_HYPNOTIC_LURE: {
              const targets = getPlayerUnits(newState.core, opponentId)
                .filter((unit) => unit.card.unitClass !== 'summoner')
                .map((unit) => unit.position);
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'hypnotic_lure_target',
                targetPosition: pos,
              }));
              queueEventInteraction(
                'hypnotic-lure',
                'interaction.sw.hypnoticLure',
                options,
                { type: 'hypnotic_lure_select_target', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'minion', autoResolveIfSingle: false },
              );
              break;
            }
            case CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT: {
              if (!summoner) break;
              const targets = friendlyUnits
                .filter((unit) => unit.card.unitClass === 'common'
                  && manhattanDistance(summoner.position, unit.position) <= 3)
                .map((unit) => unit.position);
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'chant_entanglement_target',
                targetPosition: pos,
              }));
              queueEventInteraction(
                'chant-entanglement',
                'interaction.sw.chantEntanglement',
                options,
                { type: 'chant_entanglement_select_targets', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'minion', multi: { min: 2, max: 2 } },
              );
              break;
            }
            case CARD_IDS.MOGU_SYMBIOTIC_SELF_HEALING: {
              const targets = friendlyUnits
                .filter((unit) => unit.card.unitClass !== 'summoner')
                .map((unit) => unit.position);
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(targets, (pos) => ({
                  action: 'mogu_symbiotic_self_healing_target',
                  targetPosition: pos,
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { action: 'mogu_symbiotic_self_healing_finish', skip: true },
                },
              ];
              queueEventInteraction(
                'mogu-symbiotic-self-healing',
                'interaction.sw.moguSymbioticSelfHealing',
                options,
                { type: 'mogu_symbiotic_self_healing_select_targets', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'minion', multi: { min: 0 } },
              );
              break;
            }
            case CARD_IDS.MOGU_RELEASE_SPORES: {
              if (!summoner) break;
              const hasDiscardBody = player.discard.some((card) => card.cardType === 'unit' && isMoguSporePlagueBodyCard(card));
              if (!hasDiscardBody) break;
              const targets = getAdjacentCells(summoner.position)
                .filter((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(targets, (pos) => ({
                  action: 'mogu_release_spores_position',
                  targetPosition: pos,
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { action: 'mogu_release_spores_finish', skip: true },
                },
              ];
              queueEventInteraction(
                'mogu-release-spores',
                'interaction.sw.moguReleaseSpores',
                options,
                { type: 'mogu_release_spores_select_positions', cardId: payload.cardId },
                { sourceId: baseId, targetType: 'generic', multi: { min: 0, max: 2 } },
              );
              break;
            }
            case CARD_IDS.GOBLIN_SNEAK: {
              const targets = friendlyUnits
                .filter((unit) => unit.card.unitClass !== 'summoner' && unit.card.cost === 0)
                .filter((unit) => {
                  const adj = getAdjacentCells(unit.position);
                  return adj.some((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
                })
                .map((unit) => unit.position);
              const options = buildPositionOptions(targets, (pos) => ({
                action: 'sneak_unit',
                position: pos,
              }));
              queueEventInteraction(
                'sneak-unit',
                'interaction.sw.sneakUnit',
                options,
                { type: 'sneak_select_unit', cardId: payload.cardId, recorded: [] },
                { sourceId: baseId, targetType: 'minion', autoResolveIfSingle: false },
              );
              break;
            }
            case CARD_IDS.FROST_GLACIAL_SHIFT: {
              if (!summoner) break;
              const validBuildings: CellCoord[] = [];
              for (let row = 0; row < BOARD_ROWS; row++) {
                for (let col = 0; col < BOARD_COLS; col++) {
                  const pos = { row, col };
                  const structure = getStructureAt(newState.core, pos);
                  const unit = getUnitAt(newState.core, pos);
                  const isAllyStructure = (structure && structure.owner === payload.playerId)
                    || (unit && unit.owner === payload.playerId && getUnitAbilities(unit, newState.core).includes('mobile_structure'));
                  if (isAllyStructure && manhattanDistance(summoner.position, pos) <= 3) {
                    const adj = getAdjacentCells(pos);
                    const hasDest = adj.some((p) => isValidCoord(p) && isCellEmpty(newState.core, p));
                    if (hasDest) {
                      validBuildings.push(pos);
                    }
                  }
                }
              }
              const options = buildPositionOptions(validBuildings, (pos) => ({
                action: 'glacial_shift_building',
                position: pos,
              }));
              queueEventInteraction(
                'glacial-shift-building',
                'interaction.sw.glacialShiftBuilding',
                options,
                { type: 'glacial_shift_select_building', cardId: payload.cardId, recorded: [] },
                { sourceId: baseId, targetType: 'minion', autoResolveIfSingle: false },
              );
              break;
            }
            default:
              break;
          }
        }

        if (event.type === SW_EVENTS.MAGIC_EVENT_CHOICE_REQUESTED) {
          const payload = event.payload as { playerId: PlayerId; cardId: string };
          const player = newState.core.players[payload.playerId];
          if (!player) continue;
          const card = player.hand.find((c) => c.id === payload.cardId);
          if (!card || card.cardType !== 'event') continue;
          const baseId = getBaseCardId(card.id);
          const hasInteraction = INTERACTIVE_EVENT_BASE_IDS.has(baseId);
          const options: PromptOption<SwInteractionValue>[] = [
            {
              id: 'play',
              label: '打出',
              labelKey: 'actions.playEvent',
              value: { action: 'magic_event_play' },
            },
            {
              id: 'discard',
              label: '弃为魔力',
              labelKey: 'actions.discardForMagic',
              value: { action: 'magic_event_discard' },
            },
          ];
          const interaction = createSimpleChoice(
            `sw-magic-event-choice-${event.timestamp ?? 0}-${payload.cardId}`,
            payload.playerId,
            'interaction.sw.magicEventChoice',
            options,
            { sourceId: 'magic_event_choice', targetType: 'button', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'magic_event_choice',
              cardId: payload.cardId,
              baseId,
              interaction: hasInteraction,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction);
        }

        if (event.type === SW_EVENTS.FUNERAL_PYRE_PROMPTED) {
          const payload = event.payload as { playerId: PlayerId; cardId: string; charges: number };
          const targets = getPlayerUnits(newState.core, payload.playerId)
            .filter((unit) => unit.damage > 0)
            .map((unit) => unit.position);
          const options: PromptOption<SwInteractionValue>[] = [
            ...buildPositionOptions(targets, (pos) => ({
              action: 'funeral_pyre_heal',
              targetPosition: pos,
            })),
            {
              id: 'skip',
              label: '跳过',
              labelKey: 'actions.skip',
              value: { action: 'funeral_pyre_skip', skip: true },
            },
          ];
          const interaction = createSimpleChoice(
            `sw-funeral-pyre-${event.timestamp ?? 0}-${payload.cardId}`,
            payload.playerId,
            'interaction.sw.funeralPyre',
            options,
            { sourceId: 'funeral_pyre', targetType: 'minion', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'funeral_pyre',
              cardId: payload.cardId,
              charges: payload.charges,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction);
        }

        if (event.type === SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED) {
          const payload = event.payload as {
            playerId: PlayerId;
            cardType: string;
            position: CellCoord;
            sourceUnitId?: string;
          };
          const player = newState.core.players[payload.playerId];
          if (!player) continue;
          const discardCards = player.discard.filter((card) => {
            if (payload.cardType === 'plagueZombie') {
              return card.cardType === 'unit' && isPlagueZombieCard(card);
            }
            return false;
          });
          if (discardCards.length === 0 || !payload.sourceUnitId) continue;

          const options: PromptOption<SwInteractionValue>[] = [
            ...discardCards.map((card) => ({
              id: card.id,
              label: card.name,
              value: {
                action: 'infection' as const,
                cardId: card.id,
                sourceUnitId: payload.sourceUnitId!,
                targetPosition: payload.position,
              },
              displayMode: 'card' as const,
            })),
            {
              id: 'skip',
              label: '跳过',
              labelKey: 'actions.skip',
              value: { skip: true },
            },
          ];

          const interaction = createSimpleChoice(
            `sw-infection-${event.timestamp ?? 0}-${payload.sourceUnitId}`,
            payload.playerId,
            'interaction.sw.infection',
            options,
            { sourceId: 'infection', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'infection',
              sourceUnitId: payload.sourceUnitId,
              targetPosition: payload.position,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction);
        }

        if (event.type === SW_EVENTS.GRAB_FOLLOW_REQUESTED) {
          const payload = event.payload as {
            grabberUnitId: string;
            grabberPosition: CellCoord;
            movedUnitId: string;
            movedTo: CellCoord;
          };
          const grabber = getUnitAt(newState.core, payload.grabberPosition);
          if (!grabber) continue;
          const playerId = grabber.owner;
          const options = buildGrabFollowOptions(newState.core, payload.movedTo, payload.grabberUnitId);
          const hasFollowPosition = options.some((option) => {
            const value = option.value as SwInteractionValue;
            return value && 'action' in value && value.action === 'grab_follow';
          });
          if (!hasFollowPosition) continue;

          const interaction = createSimpleChoice(
            `sw-grab-follow-${event.timestamp ?? 0}-${payload.grabberUnitId}`,
            playerId,
            'interaction.sw.grabFollow',
            options,
            {
              sourceId: 'grab',
              titleKey: 'interaction.sw.grabFollowWithSource',
              titleParams: {
                unit: grabber.card.name,
                position: formatCellCoord(payload.grabberPosition),
              },
              autoResolveIfSingle: false,
              responseValidationMode: 'live',
              optionsGenerator: (state) => buildGrabFollowOptions(
                state.core as SummonerWarsCore,
                payload.movedTo,
                payload.grabberUnitId,
              ),
            },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'grab_follow',
              grabberUnitId: payload.grabberUnitId,
              movedUnitId: payload.movedUnitId,
              movedTo: payload.movedTo,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction);
        }

        if (event.type === SW_EVENTS.SOUL_TRANSFER_REQUESTED) {
          const payload = event.payload as {
            sourceUnitId: string;
            sourcePosition: CellCoord;
            victimPosition: CellCoord;
            ownerId: PlayerId;
          };
          const options: PromptOption<SwInteractionValue>[] = [
            {
              id: 'confirm',
              label: '确认移动',
              labelKey: 'actions.confirmMove',
              value: {
                action: 'soul_transfer',
                sourceUnitId: payload.sourceUnitId,
                targetPosition: payload.victimPosition,
              },
            },
            {
              id: 'skip',
              label: '跳过',
              labelKey: 'actions.skip',
              value: { skip: true },
            },
          ];
          const interaction = createSimpleChoice(
            `sw-soul-transfer-${event.timestamp ?? 0}-${payload.sourceUnitId}`,
            payload.ownerId,
            'interaction.sw.soulTransfer',
            options,
            { sourceId: 'soul_transfer', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'soul_transfer',
              sourceUnitId: payload.sourceUnitId,
              sourcePosition: payload.sourcePosition,
              victimPosition: payload.victimPosition,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction);
        }

        if (event.type === SW_EVENTS.MIND_CAPTURE_REQUESTED) {
          const payload = event.payload as {
            sourceUnitId: string;
            sourcePosition?: CellCoord;
            targetPosition: CellCoord;
            targetUnitId: string;
            ownerId: PlayerId;
            hits: number;
          };
          const options: PromptOption<SwInteractionValue>[] = [
            {
              id: 'control',
              label: '控制',
              labelKey: 'actions.control',
              value: {
                action: 'mind_capture',
                sourceUnitId: payload.sourceUnitId,
                targetPosition: payload.targetPosition,
                hits: payload.hits,
                choice: 'control',
              },
            },
            {
              id: 'damage',
              label: '伤害',
              labelKey: 'actions.damage',
              value: {
                action: 'mind_capture',
                sourceUnitId: payload.sourceUnitId,
                targetPosition: payload.targetPosition,
                hits: payload.hits,
                choice: 'damage',
              },
            },
          ];
          const interaction = createSimpleChoice(
            `sw-mind-capture-${event.timestamp ?? 0}-${payload.sourceUnitId}`,
            payload.ownerId,
            'interaction.sw.mindCapture',
            options,
            { sourceId: 'mind_capture_resolve', autoResolveIfSingle: false },
          );
          const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
          interaction.data = {
            ...interactionData,
            sw: {
              type: 'mind_capture',
              sourceUnitId: payload.sourceUnitId,
              sourcePosition: payload.sourcePosition,
              targetPosition: payload.targetPosition,
              targetUnitId: payload.targetUnitId,
              hits: payload.hits,
            } satisfies SwInteractionMeta,
          };
          newState = queueInteraction(newState, interaction);
        }

        if (event.type === SW_EVENTS.ABILITY_TRIGGERED) {
          const payload = event.payload as {
            actionId?: string;
            abilityId?: string;
            sourceUnitId?: string;
            sourcePosition?: CellCoord;
            targetPosition?: CellCoord;
            targetUnitId?: string;
            targetCardId?: string;
            newPosition?: CellCoord;
            specialCount?: number;
            targetOwner?: PlayerId;
            interactionResolved?: boolean;
            iceRamOwner?: PlayerId;
            structurePosition?: CellCoord;
          };
          if (payload.interactionResolved) continue;
          const actionId = payload.actionId ?? payload.abilityId;
          const sourceUnitId = payload.sourceUnitId;
          const sourcePosition = payload.sourcePosition;
          if (!actionId || !sourceUnitId || !sourcePosition) continue;

          const shadowSourceUnit = getUnitAt(newState.core, sourcePosition);

          if ((actionId === 'shadow_judgment_request' || actionId === 'afterMove:shadow_judgment') && shadowSourceUnit) {
            const targets = getAdjacentCells(sourcePosition)
              .map((pos) => getUnitAt(newState.core, pos))
              .filter((unit): unit is BoardUnit => !!unit
                && (unit.card.unitClass === 'common' || unit.card.unitClass === 'champion'));
            const options: PromptOption<SwInteractionValue>[] = targets.map((target) => ({
              id: `target:${target.instanceId}`,
              label: target.card.name,
              value: { action: 'shadow_judgment_target', targetPosition: target.position },
            }));
            if (options.length > 0) {
              const interaction = createSimpleChoice(
                `sw-shadow-judgment-target-${event.timestamp ?? 0}-${sourceUnitId}`,
                shadowSourceUnit.owner,
                'interaction.sw.shadowJudgment',
                options,
                { sourceId: 'shadow_judgment', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: { type: 'shadow_judgment_select_target', sourceUnitId, sourcePosition } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }
          }

          if ((actionId === 'shadow_tear_the_veil_request' || actionId === 'afterMove:shadow_tear_the_veil')
            && shadowSourceUnit
            && canActivateAbility(newState.core, shadowSourceUnit, 'shadow_tear_the_veil', shadowSourceUnit.owner)) {
            const gates = getAdjacentCells(sourcePosition).filter((pos) => {
              const gate = getStructureAt(newState.core, pos);
              return !!gate?.card.isGate && gate.owner !== shadowSourceUnit.owner && gate.damage > 0
                && getAdjacentCells(pos).some((destination) => isCellEmpty(newState.core, destination));
            });
            const friendlySoldiers = gates.length > 0
              ? getPlayerUnits(newState.core, shadowSourceUnit.owner)
                .filter((unit) => unit.card.unitClass === 'common')
              : [];
            const options: PromptOption<SwInteractionValue>[] = friendlySoldiers.map((unit) => ({
              id: `unit:${unit.instanceId}`,
              label: unit.card.name,
              value: {
                action: 'shadow_tear_the_veil_target_unit',
                targetUnitId: unit.instanceId,
                targetPosition: unit.position,
              },
            }));
            if (options.length > 0) {
              const interaction = createSimpleChoice(
                `sw-shadow-tear-the-veil-unit-${event.timestamp ?? 0}-${sourceUnitId}`,
                shadowSourceUnit.owner,
                'interaction.sw.shadowTearTheVeil',
                options,
                { sourceId: 'shadow_tear_the_veil', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: { type: 'shadow_tear_the_veil_select_unit', sourceUnitId, sourcePosition } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }
          }

          if ((actionId === 'shadow_forbidden_knowledge_request' || actionId === 'afterMove:shadow_forbidden_knowledge')
            && shadowSourceUnit) {
            const targetPositions = [
              sourcePosition,
              ...getAdjacentCells(sourcePosition).filter((pos) => getStructureAt(newState.core, pos)?.card.isGate),
            ];
            const options: PromptOption<SwInteractionValue>[] = targetPositions.map((targetPosition) => ({
              id: `target:${targetPosition.row},${targetPosition.col}`,
              label: targetPosition.row === sourcePosition.row && targetPosition.col === sourcePosition.col
                ? shadowSourceUnit.card.name
                : getStructureAt(newState.core, targetPosition)?.card.name ?? formatCellCoord(targetPosition),
              value: { action: 'shadow_forbidden_knowledge', targetPosition },
            }));
            if (options.length > 0) {
              const interaction = createSimpleChoice(
                `sw-shadow-forbidden-knowledge-${event.timestamp ?? 0}-${sourceUnitId}`,
                shadowSourceUnit.owner,
                'interaction.sw.shadowForbiddenKnowledge',
                options,
                { sourceId: 'shadow_forbidden_knowledge', targetType: 'generic', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: { type: 'shadow_forbidden_knowledge_select_target', sourceUnitId, sourcePosition } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }
          }

          if (actionId === 'shadow_feint_request' && shadowSourceUnit) {
            const destinations = [
              ...getForceDestinations(newState.core, sourcePosition, 1),
              ...getForceDestinations(newState.core, sourcePosition, 2),
            ];
            const options: PromptOption<SwInteractionValue>[] = destinations.map((destination) => ({
              id: `pos:${destination.position.row},${destination.position.col}`,
              label: formatCellCoord(destination.position),
              value: { action: 'shadow_feint', newPosition: destination.position },
            }));
            if (options.length > 0) {
              const interaction = createSimpleChoice(
                `sw-shadow-feint-${event.timestamp ?? 0}-${sourceUnitId}`,
                shadowSourceUnit.owner,
                'interaction.sw.shadowFeint',
                options,
                { sourceId: 'shadow_feint', targetType: 'generic', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: { type: 'shadow_feint_select_position', sourceUnitId, sourcePosition } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }
          }

          if (actionId === 'shadow_shadow_summon_request' && shadowSourceUnit) {
            const options: PromptOption<SwInteractionValue>[] = [];
            const friendlyTargets = getPlayerUnits(newState.core, shadowSourceUnit.owner)
              .filter((unit) => unit.instanceId !== sourceUnitId
                && !(unit.card.abilities ?? []).includes('shadow_shadow_summon'))
              .filter((unit) => getAdjacentCells(unit.position).some((pos) => isCellEmpty(newState.core, pos)));
            for (const target of friendlyTargets) {
              options.push({
                id: `unit:${target.instanceId}`,
                label: target.card.name,
                value: { action: 'shadow_shadow_summon_target', targetPosition: target.position },
              });
            }
            for (let row = 0; row < BOARD_ROWS; row += 1) {
              for (let col = 0; col < BOARD_COLS; col += 1) {
                const targetPosition = { row, col };
                const targetStructure = getStructureAt(newState.core, targetPosition);
                if (!targetStructure || targetStructure.owner !== shadowSourceUnit.owner
                  || !getAdjacentCells(targetPosition).some((pos) => isCellEmpty(newState.core, pos))) continue;
                options.push({
                  id: `structure:${row},${col}`,
                  label: targetStructure.card.name,
                  value: { action: 'shadow_shadow_summon_target', targetPosition },
                });
              }
            }
            if (options.length > 0) {
              const interaction = createSimpleChoice(
                `sw-shadow-summon-target-${event.timestamp ?? 0}-${sourceUnitId}`,
                shadowSourceUnit.owner,
                'interaction.sw.shadowSummon',
                options,
                { sourceId: 'shadow_shadow_summon', targetType: 'generic', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: { type: 'shadow_shadow_summon_select_target', sourceUnitId, sourcePosition } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }
          }

          if (actionId === 'shadow_sudden_assault_request' && shadowSourceUnit) {
            const destinations = getForceDestinations(newState.core, sourcePosition, 1);
            const options: PromptOption<SwInteractionValue>[] = destinations.map((destination) => ({
              id: `pos:${destination.position.row},${destination.position.col}`,
              label: formatCellCoord(destination.position),
              value: { action: 'shadow_sudden_assault', newPosition: destination.position },
            }));
            if (options.length > 0) {
              const interaction = createSimpleChoice(
                `sw-shadow-sudden-assault-${event.timestamp ?? 0}-${sourceUnitId}`,
                shadowSourceUnit.owner,
                'interaction.sw.shadowSuddenAssault',
                options,
                { sourceId: 'shadow_sudden_assault', targetType: 'generic', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: { type: 'shadow_sudden_assault_select_position', sourceUnitId, sourcePosition } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }
          }

          if (actionId === 'yongheng_continuance_retain') {
            const owner = payload.targetOwner;
            const targetCardId = payload.targetCardId;
            if (!owner || !targetCardId) continue;
            const actualSourcePosition = findUnitPositionByInstanceId(newState.core, sourceUnitId) ?? sourcePosition;
            const sourceUnit = getUnitAt(newState.core, actualSourcePosition);
            const stillActive = newState.core.players[owner]?.activeEvents.some(card => card.id === targetCardId);
            if (!sourceUnit || sourceUnit.owner !== owner || !stillActive) continue;
            if (normalizeUnitBoosts(sourceUnit.boosts) < 2) continue;
            const interaction = createYonghengContinuanceInteraction(
              event.timestamp,
              owner,
              targetCardId,
              sourceUnitId,
              actualSourcePosition,
            );
            if (!hasQueuedInteraction(newState, interaction.id)) {
              newState = queueInteraction(newState, interaction);
            }
            continue;
          }

          if (actionId === 'shouren_brute_impact') {
            const shourenSourceUnit = getUnitAt(newState.core, sourcePosition);
            const targetPosition = payload.targetPosition;
            const newPosition = payload.newPosition;
            const targetUnit = targetPosition ? getUnitAt(newState.core, targetPosition) : undefined;
            if (!shourenSourceUnit || !targetPosition || !newPosition || !targetUnit
              || targetUnit.instanceId !== payload.targetUnitId) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              {
                id: `pos:${newPosition.row},${newPosition.col}`,
                label: `(${newPosition.row},${newPosition.col})`,
                labelKey: 'actions.position',
                labelParams: { row: newPosition.row, col: newPosition.col },
                value: { action: 'after_attack_shouren_brute_impact', targetPosition, newPosition },
              },
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-shouren-brute-impact-${event.timestamp ?? 0}-${sourceUnitId}`,
              shourenSourceUnit.owner,
              'interaction.sw.shourenBruteImpact',
              options,
              { sourceId: 'shouren_brute_impact', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_shouren_brute_impact',
                sourceUnitId,
                sourcePosition,
                targetPosition,
                newPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'shouren_bloody_rush') {
            const summonedUnit = getUnitAt(newState.core, sourcePosition);
            if (!summonedUnit || !getUnitAbilities(summonedUnit, newState.core).includes('shouren_bloody_rush')) continue;
            const destinations = getForceDestinations(newState.core, sourcePosition, 1);
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...destinations.map(destination => ({
                id: `pos:${destination.position.row},${destination.position.col}`,
                label: `(${destination.position.row},${destination.position.col})`,
                labelKey: 'actions.position',
                labelParams: { row: destination.position.row, col: destination.position.col },
                value: { action: 'after_summon_shouren_bloody_rush' as const, newPosition: destination.position },
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-shouren-bloody-rush-${event.timestamp ?? 0}-${summonedUnit.instanceId}`,
              summonedUnit.owner,
              'interaction.sw.shourenBloodyRush',
              options,
              { sourceId: 'shouren_bloody_rush', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_summon_shouren_bloody_rush',
                sourceUnitId: summonedUnit.instanceId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'shouren_berserk_roll') {
            const berserkUnit = getUnitAt(newState.core, sourcePosition);
            if (!berserkUnit || payload.specialCount === undefined || payload.specialCount < 1) continue;
            const destinations = getForceDestinations(newState.core, sourcePosition, 1);
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...destinations.map(destination => ({
                id: `pos:${destination.position.row},${destination.position.col}`,
                label: `(${destination.position.row},${destination.position.col})`,
                labelKey: 'actions.position',
                labelParams: { row: destination.position.row, col: destination.position.col },
                value: { action: 'after_attack_shouren_berserk' as const, newPosition: destination.position },
              })),
              { id: 'skip', label: '跳过', labelKey: 'actions.skip', value: { skip: true } },
            ];
            const interaction = createSimpleChoice(
              `sw-shouren-berserk-${event.timestamp ?? 0}-${berserkUnit.instanceId}`,
              berserkUnit.owner,
              'interaction.sw.shourenBerserkPosition',
              options,
              { sourceId: 'shouren_berserk', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_shouren_berserk',
                sourceUnitId: berserkUnit.instanceId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'shouren_primal_fury') {
            const summoner = getUnitAt(newState.core, sourcePosition);
            if (!summoner
              || summoner.card.unitClass !== 'summoner'
              || !getUnitAbilities(summoner, newState.core).includes('shouren_primal_fury')) continue;
            const destinations = [
              ...getForceDestinations(newState.core, sourcePosition, 1),
              ...getForceDestinations(newState.core, sourcePosition, 2),
            ];
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...destinations.map(destination => ({
                id: `pos:${destination.position.row},${destination.position.col}`,
                label: `(${destination.position.row},${destination.position.col})`,
                labelKey: 'actions.position',
                labelParams: { row: destination.position.row, col: destination.position.col },
                value: { action: 'after_attack_shouren_primal_fury' as const, newPosition: destination.position },
              })),
              { id: 'skip', label: '跳过', labelKey: 'actions.skip', value: { skip: true } },
            ];
            const interaction = createSimpleChoice(
              `sw-shouren-primal-fury-${event.timestamp ?? 0}-${summoner.instanceId}`,
              summoner.owner,
              'interaction.sw.shourenPrimalFuryPosition',
              options,
              { sourceId: 'shouren_primal_fury', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_shouren_primal_fury',
                sourceUnitId: summoner.instanceId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'ice_ram_trigger') {
            const ownerId = payload.iceRamOwner;
            const structurePosition = payload.structurePosition ?? sourcePosition;
            if (!ownerId || !structurePosition) continue;
            const adj = getAdjacentCells(structurePosition).filter((pos) => {
              const unit = getUnitAt(newState.core, pos);
              return !!unit && (unit.card.unitClass === 'common' || unit.card.unitClass === 'champion');
            });
            if (adj.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(adj, (pos) => ({
                action: 'ice_ram_target',
                targetPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-ice-ram-target-${event.timestamp ?? 0}-${ownerId}`,
              ownerId,
              'interaction.sw.iceRam',
              options,
              { sourceId: 'ice_ram', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'ice_ram_target',
                structurePosition,
                ownerId,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
            continue;
          }

          if (actionId === 'mogu_decay') {
            const sourceUnit = getUnitAt(newState.core, sourcePosition);
            if (!sourceUnit || sourceUnit.instanceId !== sourceUnitId) {
              newState = applyPhaseEndResolution(newState, 'mogu_decay', sourceUnitId);
              continue;
            }
            const targets = getMoguDecayTargets(newState.core, sourceUnit.owner, sourcePosition);
            if (targets.length === 0) {
              newState = applyPhaseEndResolution(newState, 'mogu_decay', sourceUnitId);
              continue;
            }
            const interactionId = `sw-mogu-decay-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...targets.map((unit) => ({
                id: `unit:${unit.instanceId}`,
                label: unit.card.name,
                value: { action: 'mogu_decay_target' as const, targetPosition: unit.position },
                displayMode: 'button' as const,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.moguDecayTarget',
              options,
              { sourceId: 'mogu_decay', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'mogu_decay_select_target',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
            continue;
          }

          const sourceUnit = getUnitAt(newState.core, sourcePosition);
          if (!sourceUnit) continue;

          const yonghengDrawAbilityByAction: Partial<Record<string, YonghengDrawAbilityId>> = {
            'afterMove:yongheng_intelligence': 'yongheng_intelligence',
            yongheng_intelligence_draw: 'yongheng_intelligence',
            yongheng_wisdom_draw: 'yongheng_wisdom',
            yongheng_analysis_draw: 'yongheng_analysis',
            yongheng_search_draw: 'yongheng_search',
          };
          const yonghengDrawAbility = yonghengDrawAbilityByAction[actionId];
          if (yonghengDrawAbility) {
            if (newState.core.players[sourceUnit.owner]?.deck.length <= 0) continue;
            const interaction = createYonghengDrawInteraction(
              event.timestamp,
              sourceUnit.owner,
              yonghengDrawAbility,
              sourceUnitId,
              sourcePosition,
            );
            if (!hasQueuedInteraction(newState, interaction.id)) {
              newState = queueInteraction(newState, interaction);
            }
            continue;
          }

          if (actionId === 'yongheng_mental_invasion_damage' || actionId === 'yongheng_mental_invasion') {
            const targets = getYonghengMentalInvasionTargets(newState.core, sourceUnit.owner, sourcePosition);
            if (targets.length === 0) continue;
            const interactionId = `sw-yongheng-mental-invasion-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(targets, (pos) => ({
                action: 'yongheng_mental_invasion',
                targetPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.yonghengMentalInvasion',
              options,
              { sourceId: 'yongheng_mental_invasion', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'yongheng_mental_invasion',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
            continue;
          }

          if (actionId === 'yongheng_collision_push_pull') {
            const targets = getYonghengAdjacentUnitTargets(newState.core, sourcePosition, sourceUnit.owner, true);
            if (targets.length === 0) continue;
            const interactionId = `sw-yongheng-collision-target-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(targets, (pos) => ({
                action: 'yongheng_collision_target',
                targetPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.yonghengCollisionTarget',
              options,
              { sourceId: 'yongheng_collision', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'yongheng_collision_target',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
            continue;
          }

          if (actionId === 'yongheng_warning_move_summoner') {
            const player = newState.core.players[sourceUnit.owner];
            const summoner = getSummoner(newState.core, sourceUnit.owner);
            const destinations = summoner ? getAdjacentCells(summoner.position).filter((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos)) : [];
            if (!summoner || player.hand.length === 0 || destinations.length === 0) continue;
            const interactionId = `sw-yongheng-warning-card-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildYonghengHandOptions(newState.core, sourceUnit.owner, (card) => ({
                action: 'yongheng_warning_card',
                targetCardId: card.id,
                defId: getBaseCardId(card.id),
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.yonghengWarningCard',
              options,
              { sourceId: 'yongheng_warning', targetType: 'hand', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'yongheng_warning_card',
                sourceUnitId,
                sourcePosition,
                targetPosition: summoner.position,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
            continue;
          }

          if (actionId === 'yongheng_application_discard_damage') {
            const player = newState.core.players[sourceUnit.owner];
            const targets = getYonghengAdjacentUnitTargets(newState.core, sourcePosition);
            if (player.hand.length === 0 || targets.length === 0) continue;
            const interactionId = `sw-yongheng-application-card-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildYonghengHandOptions(newState.core, sourceUnit.owner, (card) => ({
                action: 'yongheng_application_card',
                targetCardId: card.id,
                defId: getBaseCardId(card.id),
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.yonghengApplicationCard',
              options,
              { sourceId: 'yongheng_application', targetType: 'hand', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'yongheng_application_card',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
            continue;
          }

          if (actionId === 'yongheng_arouse_fear_discard' || actionId === 'yongheng_punish_discard') {
            if (!payload.targetOwner) continue;
            const abilityId = actionId === 'yongheng_arouse_fear_discard' ? 'yongheng_arouse_fear' : 'yongheng_punish';
            const interaction = createYonghengForcedDiscardInteraction(
              event.timestamp,
              newState.core,
              payload.targetOwner,
              abilityId,
              sourceUnitId,
              sourcePosition,
            );
            if (interaction && !hasQueuedInteraction(newState, interaction.id)) {
              newState = queueInteraction(newState, interaction);
            }
            continue;
          }

          if (actionId === 'huijin_call_guards') {
            if (!getUnitAbilities(sourceUnit, newState.core).includes('huijin_call_guards')) continue;
            if (!canActivateAbility(newState.core, sourceUnit, 'huijin_call_guards', sourceUnit.owner)) continue;
            const targets = getHuijinCallGuardTargets(newState.core, sourceUnit.owner, sourceUnit.instanceId);
            const positions = getHuijinCallGuardPositions(newState.core, sourcePosition);
            if (targets.length === 0 || positions.length === 0) continue;
            const interactionId = `sw-huijin-call-guards-target-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...targets.map((unit) => ({
                id: `unit:${unit.instanceId}`,
                label: unit.card.name,
                value: { action: 'huijin_call_guards_target' as const, targetPosition: unit.position },
                displayMode: 'button' as const,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.huijinCallGuardsTarget',
              options,
              { sourceId: 'huijin_call_guards', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'huijin_call_guards_select_target',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'fortress_power_retrieve') {
            const player = newState.core.players[sourceUnit.owner];
            const discardCards = player.discard.filter((card) => card.cardType === 'unit' && isFortressUnit(card));
            if (discardCards.length === 0) continue;
            const interactionId = `sw-after-attack-fortress-power-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = discardCards.map((card) => ({
              id: card.id,
              label: card.name,
              value: { action: 'activated_ability_target', abilityId: 'fortress_power', targetCardId: card.id },
              displayMode: 'card',
            }));
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.fortressPower',
              options,
              { sourceId: 'fortress_power', targetType: 'discard_minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'activated_ability_target',
                abilityId: 'fortress_power',
                sourceUnitId,
                sourcePosition,
                step: 'selectCard',
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
            continue;
          }

          if (actionId === 'ice_shards_damage') {
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              playerId: sourceUnit.owner,
              payload: {
                abilityId: 'ice_shards',
                sourceUnitId,
                _noSnapshot: true,
              },
            }));
            continue;
          }

          if (actionId === 'feed_beast_check') {
            const adj = getAdjacentCells(sourcePosition);
            const positions = adj.filter((pos) => {
              const unit = getUnitAt(newState.core, pos);
              return !!unit && unit.owner === sourceUnit.owner && unit.instanceId !== sourceUnitId;
            });
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(positions, (pos) => ({
                action: 'feed_beast',
                sourceUnitId,
                choice: 'destroy_adjacent',
                targetPosition: pos,
              })),
              {
                id: 'self_destroy',
                label: '自毁',
                labelKey: 'actions.feedBeastSelfDestroy',
                value: { action: 'feed_beast', sourceUnitId, choice: 'self_destroy' },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-feed-beast-${event.timestamp ?? 0}-${sourceUnitId}`,
              sourceUnit.owner,
              'interaction.sw.feedBeast',
              options,
              { sourceId: 'feed_beast', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'feed_beast',
                sourceUnitId,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'mogu_parasite') {
            if (normalizeUnitBoosts(sourceUnit.boosts) <= 0) continue;
            const interactionId = `sw-mogu-parasite-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              {
                id: 'consume_charge',
                label: '消耗1点充能',
                labelKey: 'actions.moguParasiteConsumeCharge',
                value: { action: 'mogu_parasite', sourceUnitId, choice: 'consume_charge' },
              },
              {
                id: 'take_damage',
                label: '受到1点伤害',
                labelKey: 'actions.moguParasiteTakeDamage',
                value: { action: 'mogu_parasite', sourceUnitId, choice: 'take_damage' },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.moguParasite',
              options,
              { sourceId: 'mogu_parasite', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'mogu_parasite',
                sourceUnitId,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'rapid_fire_extra_attack') {
            const hasCharge = normalizeUnitBoosts(sourceUnit.boosts) >= 1;
            if (!hasCharge) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              {
                id: 'confirm',
                label: '确认',
                labelKey: 'actions.confirm',
                value: { action: 'after_attack_rapid_fire', confirm: true },
              },
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-rapid-fire-${event.timestamp ?? 0}-${sourceUnitId}`,
              sourceUnit.owner,
              'interaction.sw.rapidFire',
              options,
              { sourceId: 'rapid_fire', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_rapid_fire',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'withdraw_push_pull') {
            const hasCharge = normalizeUnitBoosts(sourceUnit.boosts) >= 1;
            const hasMagic = newState.core.players[sourceUnit.owner]?.magic >= 1;
            if (!hasCharge && !hasMagic) continue;
            const options: PromptOption<SwInteractionValue>[] = [];
            if (hasCharge) {
              options.push({
                id: 'charge',
                label: '消耗充能',
                labelKey: 'actions.withdrawCharge',
                value: { action: 'after_attack_withdraw_cost', costType: 'charge' },
              });
            }
            if (hasMagic) {
              options.push({
                id: 'magic',
                label: '消耗魔力',
                labelKey: 'actions.withdrawMagic',
                value: { action: 'after_attack_withdraw_cost', costType: 'magic' },
              });
            }
            options.push({
              id: 'skip',
              label: '跳过',
              labelKey: 'actions.skip',
              value: { skip: true },
            });
            const interaction = createSimpleChoice(
              `sw-withdraw-cost-${event.timestamp ?? 0}-${sourceUnitId}`,
              sourceUnit.owner,
              'interaction.sw.withdraw',
              options,
              { sourceId: 'withdraw', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_withdraw_cost',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'blood_rune_choice') {
            const options = buildBloodRuneOptions(newState.core, sourceUnit.owner);
            const interaction = createSimpleChoice(
              `sw-blood-rune-${event.timestamp ?? 0}-${sourceUnitId}`,
              sourceUnit.owner,
              'interaction.sw.bloodRune',
              options,
              { sourceId: 'blood_rune', autoResolveIfSingle: true },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              optionsGenerator: (state) => buildBloodRuneOptions(state.core as SummonerWarsCore, sourceUnit.owner),
              sw: {
                type: 'on_phase_start_blood_rune',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'illusion_copy') {
            const options: PromptOption<SwInteractionValue>[] = [];
            for (let row = 0; row < BOARD_ROWS; row++) {
              for (let col = 0; col < BOARD_COLS; col++) {
                const unit = newState.core.board[row]?.[col]?.unit;
                if (!unit || unit.card.unitClass !== 'common') continue;
                const dist = manhattanDistance(sourcePosition, { row, col });
                if (dist > 0 && dist <= 3) {
                  options.push({
                    id: `pos:${row},${col}`,
                    label: unit.card.name,
                    value: { action: 'on_phase_start_illusion', targetPosition: { row, col } },
                  });
                }
              }
            }
            if (options.length === 0) continue;
            options.push({
              id: 'skip',
              label: '跳过',
              labelKey: 'actions.skip',
              value: { skip: true },
            });
            const interaction = createSimpleChoice(
              `sw-illusion-${event.timestamp ?? 0}-${sourceUnitId}`,
              sourceUnit.owner,
              'interaction.sw.illusion',
              options,
              { sourceId: 'illusion', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'on_phase_start_illusion',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'telekinesis' || actionId === 'high_telekinesis') {
            const maxRange = actionId === 'high_telekinesis' ? 3 : 2;
            const targets: CellCoord[] = [];
            for (let row = 0; row < BOARD_ROWS; row++) {
              for (let col = 0; col < BOARD_COLS; col++) {
                const unit = newState.core.board[row]?.[col]?.unit;
                if (!unit || unit.card.unitClass === 'summoner') continue;
                if (hasStableAbility(unit, newState.core)) continue;
                const dist = manhattanDistance(sourcePosition, { row, col });
                if (dist > 0 && dist <= maxRange) {
                  targets.push({ row, col });
                }
              }
            }
            if (targets.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(targets, (pos) => ({
                action: 'after_attack_telekinesis_target',
                targetPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-telekinesis-target-${event.timestamp ?? 0}-${sourceUnitId}`,
              sourceUnit.owner,
              'interaction.sw.telekinesisTarget',
              options,
              { sourceId: actionId, targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_telekinesis_target',
                abilityId: actionId,
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'mind_transmission') {
            if (!payload.targetOwner || payload.targetOwner === sourceUnit.owner) continue;
            const targets: CellCoord[] = [];
            for (let row = 0; row < BOARD_ROWS; row++) {
              for (let col = 0; col < BOARD_COLS; col++) {
                const unit = newState.core.board[row]?.[col]?.unit;
                if (!unit || unit.owner !== sourceUnit.owner || unit.card.unitClass !== 'common') continue;
                const dist = manhattanDistance(sourcePosition, { row, col });
                if (dist > 0 && dist <= 3) {
                  targets.push({ row, col });
                }
              }
            }
            if (targets.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(targets, (pos) => ({
                action: 'after_attack_mind_transmission',
                targetPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-mind-transmission-${event.timestamp ?? 0}-${sourceUnitId}`,
              sourceUnit.owner,
              'interaction.sw.mindTransmission',
              options,
              { sourceId: 'mind_transmission', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_mind_transmission',
                abilityId: 'mind_transmission',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId === 'huijin_ram') {
            if (!getUnitAbilities(sourceUnit, newState.core).includes('huijin_ram')) continue;
            const targets = getHuijinRamTargets(
              newState.core,
              sourceUnit,
              sourcePosition,
              payload.targetPosition,
            );
            if (targets.length === 0) continue;
            const interactionId = `sw-huijin-ram-target-${event.timestamp ?? 0}-${sourceUnitId}`;
            if (hasQueuedInteraction(newState, interactionId)) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(targets, (pos) => ({
                action: 'after_attack_huijin_ram_target',
                targetPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              interactionId,
              sourceUnit.owner,
              'interaction.sw.huijinRamTarget',
              options,
              { sourceId: 'huijin_ram', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_huijin_ram_target',
                sourceUnitId,
                sourcePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (actionId.startsWith('afterMove:')) {
            const abilityId = actionId.split(':')[1] ?? '';
            if (abilityId === 'spirit_bond') {
              const options: PromptOption<SwInteractionValue>[] = [
                {
                  id: 'self',
                  label: '充能自身',
                  labelKey: 'actions.chargeSelf',
                  value: { action: 'after_move_spirit_bond', choice: 'self' },
                },
              ];
              if (normalizeUnitBoosts(sourceUnit.boosts) >= 1) {
                const targets = getPlayerUnits(newState.core, sourceUnit.owner)
                  .filter((unit) => unit.instanceId !== sourceUnitId
                    && manhattanDistance(sourcePosition, unit.position) <= 3)
                  .map((unit) => unit.position);
                options.push(...buildPositionOptions(targets, (pos) => ({
                  action: 'after_move_spirit_bond',
                  choice: 'transfer',
                  targetPosition: pos,
                })));
              }
              const interaction = createSimpleChoice(
                `sw-spirit-bond-${event.timestamp ?? 0}-${sourceUnitId}`,
                sourceUnit.owner,
                'interaction.sw.spiritBond',
                options,
                { sourceId: 'spirit_bond', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'after_move_spirit_bond',
                  sourceUnitId,
                  sourcePosition,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }

            if (abilityId === 'ancestral_bond') {
              const targets = getPlayerUnits(newState.core, sourceUnit.owner)
                .filter((unit) => unit.instanceId !== sourceUnitId
                  && manhattanDistance(sourcePosition, unit.position) <= 3)
                .map((unit) => unit.position);
              if (targets.length === 0) continue;
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(targets, (pos) => ({
                  action: 'after_move_ancestral_bond',
                  targetPosition: pos,
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { skip: true },
                },
              ];
              const interaction = createSimpleChoice(
                `sw-ancestral-bond-${event.timestamp ?? 0}-${sourceUnitId}`,
                sourceUnit.owner,
                'interaction.sw.ancestralBond',
                options,
                { sourceId: 'ancestral_bond', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'after_move_ancestral_bond',
                  sourceUnitId,
                  sourcePosition,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }

            if (abilityId === 'structure_shift') {
              const structures: CellCoord[] = [];
              for (let row = 0; row < BOARD_ROWS; row++) {
                for (let col = 0; col < BOARD_COLS; col++) {
                  const structure = getStructureAt(newState.core, { row, col });
                  const unit = getUnitAt(newState.core, { row, col });
                  const isAllyStructure = (structure && structure.owner === sourceUnit.owner)
                    || (unit && unit.owner === sourceUnit.owner && getUnitAbilities(unit, newState.core).includes('mobile_structure'));
                  if (!isAllyStructure) continue;
                  const dist = manhattanDistance(sourcePosition, { row, col });
                  if (dist > 0 && dist <= 3) {
                    structures.push({ row, col });
                  }
                }
              }
              if (structures.length === 0) continue;
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(structures, (pos) => ({
                  action: 'after_move_structure_shift_target',
                  targetPosition: pos,
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { skip: true },
                },
              ];
              const interaction = createSimpleChoice(
                `sw-structure-shift-${event.timestamp ?? 0}-${sourceUnitId}`,
                sourceUnit.owner,
                'interaction.sw.structureShift',
                options,
                { sourceId: 'structure_shift', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'after_move_structure_shift_target',
                  sourceUnitId,
                  sourcePosition,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }

            if (abilityId === 'frost_axe') {
              const options: PromptOption<SwInteractionValue>[] = [
                {
                  id: 'self',
                  label: '充能自身',
                  labelKey: 'actions.chargeSelf',
                  value: { action: 'after_move_frost_axe', choice: 'self' },
                },
              ];
              if (normalizeUnitBoosts(sourceUnit.boosts) >= 1) {
                const targets = getPlayerUnits(newState.core, sourceUnit.owner)
                  .filter((unit) => unit.instanceId !== sourceUnitId
                    && unit.card.unitClass === 'common'
                    && manhattanDistance(sourcePosition, unit.position) <= 3)
                  .map((unit) => unit.position);
                options.push(...buildPositionOptions(targets, (pos) => ({
                  action: 'after_move_frost_axe',
                  choice: 'attach',
                  targetPosition: pos,
                })));
              }
              options.push({
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              });
              const interaction = createSimpleChoice(
                `sw-frost-axe-${event.timestamp ?? 0}-${sourceUnitId}`,
                sourceUnit.owner,
                'interaction.sw.frostAxe',
                options,
                { sourceId: 'frost_axe', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'after_move_frost_axe',
                  sourceUnitId,
                  sourcePosition,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }

            if (abilityId === 'mogu_transmission') {
              newState = queueInteraction(newState, buildMoguTransmissionModeInteraction(
                event.timestamp,
                sourceUnit,
                sourceUnitId,
                sourcePosition,
              ));
            }

            if (abilityId === 'huijin_quick_shot') {
              if (!getUnitAbilities(sourceUnit, newState.core).includes('huijin_quick_shot')) continue;
              const targets = getHuijinQuickShotTargets(newState.core, sourceUnitId, sourceUnit.owner, sourcePosition);
              if (targets.length === 0) continue;
              const interactionId = `sw-huijin-quick-shot-${event.timestamp ?? 0}-${sourceUnitId}`;
              if (hasQueuedInteraction(newState, interactionId)) continue;
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(targets, (pos) => ({
                  action: 'after_move_huijin_quick_shot',
                  targetPosition: pos,
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { skip: true },
                },
              ];
              const interaction = createSimpleChoice(
                interactionId,
                sourceUnit.owner,
                'interaction.sw.huijinQuickShot',
                options,
                { sourceId: 'huijin_quick_shot', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'after_move_huijin_quick_shot',
                  sourceUnitId,
                  sourcePosition,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }

            if (abilityId === 'mogu_fanatical_fungus') {
              const destinations: PromptOption<SwInteractionValue>[] = [
                {
                  id: 'stay',
                  label: '不推拉',
                  labelKey: 'actions.moguFanaticalFungusStay',
                  value: {
                    action: 'after_move_mogu_fanatical_fungus_target' as const,
                    targetPosition: sourcePosition,
                  },
                },
                ...getAdjacentCells(sourcePosition)
                  .filter((pos) => isCellEmpty(newState.core, pos))
                  .map((pos) => ({
                    id: `pos:${pos.row},${pos.col}`,
                    label: `(${pos.row},${pos.col})`,
                    value: {
                      action: 'after_move_mogu_fanatical_fungus_target' as const,
                      targetPosition: sourcePosition,
                      newPosition: pos,
                    },
                  })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { skip: true },
                },
              ];
              const interaction = createSimpleChoice(
                `sw-mogu-fanatical-fungus-${event.timestamp ?? 0}-${sourceUnitId}`,
                sourceUnit.owner,
                'interaction.sw.moguFanaticalFungus',
                destinations,
                { sourceId: 'mogu_fanatical_fungus', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'after_move_mogu_fanatical_fungus',
                  sourceUnitId,
                  sourcePosition,
                  targetPosition: sourcePosition,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }
          }
        }

        if (event.type === INTERACTION_EVENTS.RESOLVED || event.type === INTERACTION_EVENTS.CANCELLED) {
          const payload = event.payload as InteractionResolutionPayload;
          const sw = resolveSwInteractionMeta(payload.interactionData);
          if (!sw) continue;
          const value = payload.value ?? null;
          const values = normalizeInteractionValues(value);

          if (sw.type === 'shouren_encourage') {
            const picked = values.find((item) => item.action === 'shouren_encourage') as
              { action: 'shouren_encourage'; choice: 'reroll' | 'keep' } | undefined;
            if (picked) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.RESOLVE_PENDING_ATTACK,
                payload: { choice: picked.choice, _noSnapshot: true },
                playerId: payload.playerId,
              }));
            }
          }

          if (sw.type === 'event_target') {
            const target = values.find((item) => item.action === 'event_target') as { action: 'event_target'; targetPosition: CellCoord } | undefined;
            if (target?.targetPosition) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: [target.targetPosition],
                },
              }));
            }
          }

          if (sw.type === 'shadow_marl_select_card') {
            const picked = values.find((item) => item.action === 'shadow_marl_card') as
              { action: 'shadow_marl_card'; targetCardId: string } | undefined;
            if (!picked?.targetCardId) continue;
            const friendlyUnits = getPlayerUnits(newState.core, payload.playerId)
              .filter((unit) => unit.card.unitClass !== 'summoner');
            if (friendlyUnits.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = friendlyUnits.map((unit) => ({
              id: `pos:${unit.position.row},${unit.position.col}`,
              label: unit.card.name,
              value: { action: 'shadow_marl_damage', targetPosition: unit.position },
            }));
            const interaction = createSimpleChoice(
              `sw-shadow-marl-damage-${event.timestamp ?? 0}-${sw.cardId}-0`,
              payload.playerId,
              'interaction.sw.shadowMarlGrimoireDamage',
              options,
              { sourceId: 'shadow_marl_damage', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'shadow_marl_select_damage',
                cardId: sw.cardId,
                targetCardId: picked.targetCardId,
                damageTargets: [],
                damageCount: 2,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction, { urgent: true });
          }

          if (sw.type === 'shadow_marl_select_damage') {
            const picked = values.find((item) => item.action === 'shadow_marl_damage') as
              { action: 'shadow_marl_damage'; targetPosition: CellCoord } | undefined;
            if (!picked?.targetPosition) continue;
            const damageTargets = [...(sw.damageTargets ?? []), picked.targetPosition];
            const damageCount = Math.max(1, sw.damageCount ?? 2);
            if (damageTargets.length < damageCount) {
              const friendlyUnits = getPlayerUnits(newState.core, payload.playerId)
                .filter((unit) => unit.card.unitClass !== 'summoner');
              const options: PromptOption<SwInteractionValue>[] = friendlyUnits.map((unit) => ({
                id: `pos:${unit.position.row},${unit.position.col}`,
                label: unit.card.name,
                value: { action: 'shadow_marl_damage', targetPosition: unit.position },
              }));
              const interaction = createSimpleChoice(
                `sw-shadow-marl-damage-${event.timestamp ?? 0}-${sw.cardId}-${damageTargets.length}`,
                payload.playerId,
                'interaction.sw.shadowMarlGrimoireDamage',
                options,
                { sourceId: 'shadow_marl_damage', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'shadow_marl_select_damage',
                  cardId: sw.cardId,
                  targetCardId: sw.targetCardId,
                  damageTargets,
                  damageCount,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction, { urgent: true });
            } else {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targetCardId: sw.targetCardId,
                  damageTargets,
                },
              }));
            }
          }

          if (sw.type === 'shadow_pulse_select_targets') {
            const selectedTargets = values
              .filter((item) => item.action === 'shadow_pulse_target')
              .map((item) => item.targetPosition);
            const finished = values.some((item) => item.action === 'shadow_pulse_finish')
              || selectedTargets.length > 0;
            if (finished) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: selectedTargets,
                },
              }));
            }
          }

          if (sw.type === 'shadow_lightning_step') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            if (hasSkip) continue;
            const picked = values.find((item) => item.action === 'shadow_lightning_step_replace') as
              { action: 'shadow_lightning_step_replace'; targetPosition?: CellCoord } | undefined;
            const sourceUnit = getUnitAt(newState.core, sw.sourcePosition);
            const activeEvent = newState.core.players[payload.playerId]?.activeEvents.some((card) =>
              card.id === sw.cardId && card.isActive && getBaseCardId(card.id) === CARD_IDS.SHADOW_LIGHTNING_STEP,
            );
            if (!picked?.targetPosition || !activeEvent || !sourceUnit
              || sourceUnit.instanceId !== sw.sourceUnitId
              || sourceUnit.owner !== payload.playerId
              || sourceUnit.card.unitClass !== 'summoner'
              || newState.core.currentPlayer !== payload.playerId
              || newState.core.phase !== 'attack'
              || picked.targetPosition.row !== sw.targetPosition.row
              || picked.targetPosition.col !== sw.targetPosition.col
              || !isCellEmpty(newState.core, picked.targetPosition)) continue;
            nextEvents.push({
              type: SW_EVENTS.UNIT_MOVED,
              payload: {
                from: sw.sourcePosition,
                to: picked.targetPosition,
                unitId: sourceUnit.instanceId,
                reason: 'shadow_lightning_step',
                path: [sw.sourcePosition, picked.targetPosition],
              },
              timestamp: event.timestamp,
            });
          }

          if (sw.type === 'shadow_judgment_select_target') {
            const picked = values.find((item) => item.action === 'shadow_judgment_target') as
              { action: 'shadow_judgment_target'; targetPosition?: CellCoord } | undefined;
            const target = picked?.targetPosition ? getUnitAt(newState.core, picked.targetPosition) : undefined;
            const sourceUnit = getUnitAt(newState.core, sw.sourcePosition);
            if (!picked?.targetPosition || !target || !sourceUnit
              || (target.card.unitClass !== 'common' && target.card.unitClass !== 'champion')) continue;
            const chargeCount = normalizeUnitBoosts(sourceUnit.boosts);
            const options: PromptOption<SwInteractionValue>[] = [];
            for (let amount = 1; amount <= chargeCount; amount += 1) {
              options.push({
                id: `amount:${amount}`,
                label: `${amount}点`,
                value: { action: 'shadow_judgment', targetPosition: picked.targetPosition, amount },
              });
            }
            if (options.length === 0) continue;
            const interaction = createSimpleChoice(
              `sw-shadow-judgment-amount-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.shadowJudgment',
              options,
              { sourceId: 'shadow_judgment', targetType: 'button', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'shadow_judgment_select_amount',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition: picked.targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'shadow_tear_the_veil_select_unit') {
            const picked = values.find((item) => item.action === 'shadow_tear_the_veil_target_unit') as
              { action: 'shadow_tear_the_veil_target_unit'; targetUnitId?: string } | undefined;
            const sourceUnit = getUnitAt(newState.core, sw.sourcePosition);
            const target = picked?.targetUnitId ? findUnitPositionByInstanceId(newState.core, picked.targetUnitId) : undefined;
            if (!picked?.targetUnitId || !sourceUnit || !target) continue;
            const gates = getAdjacentCells(sw.sourcePosition).filter((pos) => {
              const gate = getStructureAt(newState.core, pos);
              return !!gate?.card.isGate && gate.owner !== sourceUnit.owner && gate.damage > 0
                && getAdjacentCells(pos).some((destination) => isCellEmpty(newState.core, destination));
            });
            const options: PromptOption<SwInteractionValue>[] = gates.map((gatePosition) => ({
              id: `gate:${gatePosition.row},${gatePosition.col}`,
              label: getStructureAt(newState.core, gatePosition)?.card.name ?? formatCellCoord(gatePosition),
              value: { action: 'shadow_tear_the_veil_target_gate', gatePosition },
            }));
            if (options.length === 0) continue;
            const interaction = createSimpleChoice(
              `sw-shadow-tear-the-veil-gate-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.shadowTearTheVeil',
              options,
              { sourceId: 'shadow_tear_the_veil', targetType: 'generic', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'shadow_tear_the_veil_select_gate',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetUnitId: picked.targetUnitId,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'shadow_tear_the_veil_select_gate') {
            const picked = values.find((item) => item.action === 'shadow_tear_the_veil_target_gate') as
              { action: 'shadow_tear_the_veil_target_gate'; gatePosition?: CellCoord } | undefined;
            const sourceUnit = getUnitAt(newState.core, sw.sourcePosition);
            const gate = picked?.gatePosition ? getStructureAt(newState.core, picked.gatePosition) : undefined;
            if (!picked?.gatePosition || !sourceUnit || !gate
              || !gate.card.isGate || gate.owner === sourceUnit.owner || gate.damage <= 0) continue;
            const gatePosition = picked.gatePosition;
            const positions = getAdjacentCells(gatePosition).filter((pos) => isCellEmpty(newState.core, pos));
            const options: PromptOption<SwInteractionValue>[] = positions.map((newPosition) => ({
              id: `pos:${newPosition.row},${newPosition.col}`,
              label: formatCellCoord(newPosition),
              value: {
                action: 'shadow_tear_the_veil',
                targetUnitId: sw.targetUnitId,
                gatePosition,
                newPosition,
              },
            }));
            if (options.length === 0) continue;
            const interaction = createSimpleChoice(
              `sw-shadow-tear-the-veil-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.shadowTearTheVeil',
              options,
              { sourceId: 'shadow_tear_the_veil', targetType: 'generic', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'shadow_tear_the_veil_select_position',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetUnitId: sw.targetUnitId,
                gatePosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'shadow_shadow_summon_select_target') {
            const picked = values.find((item) => item.action === 'shadow_shadow_summon_target') as
              { action: 'shadow_shadow_summon_target'; targetPosition?: CellCoord } | undefined;
            const sourceUnit = getUnitAt(newState.core, sw.sourcePosition);
            const targetUnit = picked?.targetPosition ? getUnitAt(newState.core, picked.targetPosition) : undefined;
            const targetStructure = picked?.targetPosition ? getStructureAt(newState.core, picked.targetPosition) : undefined;
            const targetIsValid = (targetUnit
              && targetUnit.owner === payload.playerId
              && targetUnit.instanceId !== sw.sourceUnitId
              && !(targetUnit.card.abilities ?? []).includes('shadow_shadow_summon'))
              || (targetStructure && targetStructure.owner === payload.playerId);
            if (!picked?.targetPosition || !sourceUnit || !targetIsValid) continue;
            const targetPosition = picked.targetPosition;
            const positions = getAdjacentCells(targetPosition).filter((pos) => isCellEmpty(newState.core, pos));
            const options: PromptOption<SwInteractionValue>[] = positions.map((newPosition) => ({
              id: `pos:${newPosition.row},${newPosition.col}`,
              label: formatCellCoord(newPosition),
              value: {
                action: 'shadow_shadow_summon',
                targetPosition,
                newPosition,
              },
            }));
            if (options.length === 0) continue;
            const interaction = createSimpleChoice(
              `sw-shadow-summon-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.shadowSummon',
              options,
              { sourceId: 'shadow_shadow_summon', targetType: 'generic', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'shadow_shadow_summon_select_position',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          const shadowAbilityId = sw.type === 'shadow_judgment_select_amount'
            ? 'shadow_judgment'
            : sw.type === 'shadow_tear_the_veil_select_position'
              ? 'shadow_tear_the_veil'
              : sw.type === 'shadow_forbidden_knowledge_select_target'
                ? 'shadow_forbidden_knowledge'
                : sw.type === 'shadow_feint_select_position'
                  ? 'shadow_feint'
                  : sw.type === 'shadow_shadow_summon_select_position'
                    ? 'shadow_shadow_summon'
                    : sw.type === 'shadow_sudden_assault_select_position'
                      ? 'shadow_sudden_assault'
                      : null;
          if (shadowAbilityId) {
            const picked = values.find((item) => (
              item.action === shadowAbilityId
            )) as {
              action: 'shadow_judgment'
                | 'shadow_tear_the_veil'
                | 'shadow_forbidden_knowledge'
                | 'shadow_feint'
                | 'shadow_shadow_summon'
                | 'shadow_sudden_assault';
              targetPosition?: CellCoord;
              amount?: number;
              targetUnitId?: string;
              gatePosition?: CellCoord;
              newPosition?: CellCoord;
            } | undefined;
            if (!picked) continue;
            if (!('sourceUnitId' in sw)) continue;
            const abilityPayload: Record<string, unknown> = {
              abilityId: shadowAbilityId,
              sourceUnitId: sw.sourceUnitId,
              _noSnapshot: true,
            };
            if (picked.targetPosition) abilityPayload.targetPosition = picked.targetPosition;
            if (picked.amount !== undefined) abilityPayload.amount = picked.amount;
            if (picked.targetUnitId) abilityPayload.targetUnitId = picked.targetUnitId;
            if (picked.gatePosition) abilityPayload.gatePosition = picked.gatePosition;
            if (picked.newPosition) abilityPayload.newPosition = picked.newPosition;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: abilityPayload,
              playerId: payload.playerId,
            }));
          }

          if (sw.type === 'magic_event_choice') {
            const picked = values.find((item) => item.action === 'magic_event_play' || item.action === 'magic_event_discard');
            if (picked?.action === 'magic_event_play') {
              const playCommandType = sw.interaction ? SW_COMMANDS.REQUEST_EVENT_INTERACTION : SW_COMMANDS.PLAY_EVENT;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: playCommandType,
                payload: {
                  cardId: sw.cardId,
                },
              }));
            }
            if (picked?.action === 'magic_event_discard') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.DISCARD_FOR_MAGIC,
                payload: {
                  cardIds: [sw.cardId],
                },
              }));
            }
          }

          if (sw.type === 'funeral_pyre') {
            const picked = values.find((item) => item.action === 'funeral_pyre_heal') as { action: 'funeral_pyre_heal'; targetPosition: CellCoord } | undefined;
            const hasSkip = isSkipValue(value) || values.some((item) => item.action === 'funeral_pyre_skip');
            if (picked?.targetPosition) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
                payload: {
                  cardId: sw.cardId,
                  targetPosition: picked.targetPosition,
                },
              }));
            } else if (hasSkip) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.FUNERAL_PYRE_HEAL,
                payload: {
                  cardId: sw.cardId,
                  skip: true,
                },
              }));
            }
          }

          if (sw.type === 'blood_summon_select_target') {
            const target = values.find((item) => item.action === 'blood_summon_target') as { action: 'blood_summon_target'; targetPosition: CellCoord } | undefined;
            if (target?.targetPosition) {
              const handCards = newState.core.players[payload.playerId].hand
                .filter((card) => card.cardType === 'unit' && (card as UnitCard).cost <= 2);
              const options: PromptOption<SwInteractionValue>[] = handCards.map((card) => ({
                id: card.id,
                label: card.name,
                value: { action: 'blood_summon_card', summonCardId: card.id },
                displayMode: 'card',
              }));
              if (options.length > 0) {
                const interaction = createSimpleChoice(
                  `sw-blood-summon-card-${event.timestamp ?? 0}-${sw.cardId}`,
                  payload.playerId,
                  'interaction.sw.bloodSummonCard',
                  options,
                  { sourceId: 'blood_summon', targetType: 'hand', autoResolveIfSingle: false },
                );
                const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                interaction.data = {
                  ...interactionData,
                  sw: {
                    type: 'blood_summon_select_card',
                    cardId: sw.cardId,
                    targetPosition: target.targetPosition,
                    completedCount: sw.completedCount ?? 0,
                  } satisfies SwInteractionMeta,
                };
                newState = queueInteraction(newState, interaction, { urgent: true });
              }
            }
          }

          if (sw.type === 'blood_summon_select_card') {
            const picked = values.find((item) => item.action === 'blood_summon_card') as { action: 'blood_summon_card'; summonCardId: string } | undefined;
            if (picked?.summonCardId && sw.targetPosition) {
              const adj = getAdjacentCells(sw.targetPosition);
              const positions = adj.filter((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
              const options = buildPositionOptions(positions, (pos) => ({
                action: 'blood_summon_position',
                summonPosition: pos,
              }));
              if (options.length > 0) {
                const interaction = createSimpleChoice(
                  `sw-blood-summon-pos-${event.timestamp ?? 0}-${sw.cardId}`,
                  payload.playerId,
                  'interaction.sw.bloodSummonPosition',
                  options,
                  { sourceId: 'blood_summon', targetType: 'minion', autoResolveIfSingle: false },
                );
                const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                interaction.data = {
                  ...interactionData,
                  sw: {
                    type: 'blood_summon_select_position',
                    cardId: sw.cardId,
                    targetPosition: sw.targetPosition,
                    summonCardId: picked.summonCardId,
                    completedCount: sw.completedCount ?? 0,
                  } satisfies SwInteractionMeta,
                };
                newState = queueInteraction(newState, interaction, { urgent: true });
              }
            }
          }

          if (sw.type === 'blood_summon_select_position') {
            const picked = values.find((item) => item.action === 'blood_summon_position') as { action: 'blood_summon_position'; summonPosition: CellCoord } | undefined;
            if (picked?.summonPosition && sw.targetPosition && sw.summonCardId) {
              if ((sw.completedCount ?? 0) === 0) {
                nextEvents.push(...executeSwCommand(newState, random, {
                  type: SW_COMMANDS.PLAY_EVENT,
                  payload: {
                    cardId: sw.cardId,
                  },
                }));
              }
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.BLOOD_SUMMON_STEP,
                payload: {
                  targetUnitPosition: sw.targetPosition,
                  summonCardId: sw.summonCardId,
                  summonPosition: picked.summonPosition,
                },
              }));

              const options: PromptOption<SwInteractionValue>[] = [
                {
                  id: 'continue',
                  label: '继续',
                  labelKey: 'actions.continue',
                  value: { action: 'blood_summon_continue' },
                },
                {
                  id: 'finish',
                  label: '完成',
                  labelKey: 'actions.finish',
                  value: { action: 'blood_summon_finish' },
                },
              ];
              const interaction = createSimpleChoice(
                `sw-blood-summon-confirm-${event.timestamp ?? 0}-${sw.cardId}`,
                payload.playerId,
                'interaction.sw.bloodSummonConfirm',
                options,
                { sourceId: 'blood_summon', targetType: 'button', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'blood_summon_confirm',
                  cardId: sw.cardId,
                  completedCount: (sw.completedCount ?? 0) + 1,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction, { urgent: true });
            }
          }

          if (sw.type === 'blood_summon_confirm') {
            if (isSkipValue(value)) {
              // do nothing
            } else {
              const picked = values.find((item) => item.action === 'blood_summon_continue' || item.action === 'blood_summon_finish');
              if (picked?.action === 'blood_summon_continue') {
                const targets = getPlayerUnits(newState.core, payload.playerId)
                  .filter((unit) => {
                    const adj = getAdjacentCells(unit.position);
                    return adj.some((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
                  })
                  .map((unit) => unit.position);
                const options = buildPositionOptions(targets, (pos) => ({
                  action: 'blood_summon_target',
                  targetPosition: pos,
                }));
                if (options.length > 0) {
                  const interaction = createSimpleChoice(
                    `sw-blood-summon-target-${event.timestamp ?? 0}-${sw.cardId}`,
                    payload.playerId,
                    'interaction.sw.bloodSummonTarget',
                    options,
                    { sourceId: 'blood_summon', targetType: 'minion', autoResolveIfSingle: false },
                  );
                  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                  interaction.data = {
                    ...interactionData,
                    sw: {
                      type: 'blood_summon_select_target',
                      cardId: sw.cardId,
                      completedCount: sw.completedCount ?? 0,
                    } satisfies SwInteractionMeta,
                  };
                  newState = queueInteraction(newState, interaction, { urgent: true });
                }
              }
            }
          }

          if (sw.type === 'annihilate_select_targets') {
            const selectedTargets = values
              .filter((item) => item.action === 'annihilate_target')
              .map((item) => item.targetPosition);
            if (selectedTargets.length > 0) {
              const damageTargets = selectedTargets.map(() => null as CellCoord | null);
              const currentTarget = selectedTargets[0];
              const adj = getAdjacentCells(currentTarget).filter((pos) => {
                return !!getUnitAt(newState.core, pos) || !!getStructureAt(newState.core, pos);
              });
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(adj, (pos) => ({
                  action: 'annihilate_damage',
                  targetPosition: pos,
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { action: 'annihilate_damage_skip', skip: true },
                },
              ];
              const interaction = createSimpleChoice(
                `sw-annihilate-damage-${event.timestamp ?? 0}-${sw.cardId}`,
                payload.playerId,
                'interaction.sw.annihilateDamage',
                options,
                { sourceId: 'annihilate', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'annihilate_select_damage',
                  cardId: sw.cardId,
                  selectedTargets,
                  currentTargetIndex: 0,
                  damageTargets,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction, { urgent: true });
            }
          }

          if (sw.type === 'annihilate_select_damage') {
            if (!sw.selectedTargets || sw.selectedTargets.length === 0) continue;
            const currentIndex = sw.currentTargetIndex ?? 0;
            const updatedDamageTargets = [...(sw.damageTargets ?? [])];
            const pickedDamage = values.find((item) => item.action === 'annihilate_damage') as { action: 'annihilate_damage'; targetPosition: CellCoord } | undefined;
            if (pickedDamage?.targetPosition) {
              updatedDamageTargets[currentIndex] = pickedDamage.targetPosition;
            } else {
              updatedDamageTargets[currentIndex] = null;
            }
            const nextIndex = currentIndex + 1;
            if (nextIndex < sw.selectedTargets.length) {
              const nextTarget = sw.selectedTargets[nextIndex];
              const adj = getAdjacentCells(nextTarget).filter((pos) => {
                return !!getUnitAt(newState.core, pos) || !!getStructureAt(newState.core, pos);
              });
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(adj, (pos) => ({
                  action: 'annihilate_damage',
                  targetPosition: pos,
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { action: 'annihilate_damage_skip', skip: true },
                },
              ];
              const interaction = createSimpleChoice(
                `sw-annihilate-damage-${event.timestamp ?? 0}-${sw.cardId}`,
                payload.playerId,
                'interaction.sw.annihilateDamage',
                options,
                { sourceId: 'annihilate', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'annihilate_select_damage',
                  cardId: sw.cardId,
                  selectedTargets: sw.selectedTargets,
                  currentTargetIndex: nextIndex,
                  damageTargets: updatedDamageTargets,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction, { urgent: true });
            } else {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: sw.selectedTargets,
                  damageTargets: updatedDamageTargets,
                },
              }));
            }
          }

          if (sw.type === 'mind_control_select_targets') {
            const selectedTargets = values
              .filter((item) => item.action === 'mind_control_target')
              .map((item) => item.targetPosition);
            if (selectedTargets.length > 0) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: selectedTargets,
                },
              }));
            }
          }

          if (sw.type === 'stun_select_target') {
            const target = values.find((item) => item.action === 'stun_target') as { action: 'stun_target'; targetPosition: CellCoord } | undefined;
            if (target?.targetPosition) {
              const dests = getStunDestinations(newState.core, target.targetPosition);
              if (dests.length === 0) {
                nextEvents.push(...executeSwCommand(newState, random, {
                  type: SW_COMMANDS.PLAY_EVENT,
                  payload: {
                    cardId: sw.cardId,
                    targets: [target.targetPosition],
                    direction: 'push',
                    distance: 1,
                  },
                }));
              } else {
                const options: PromptOption<SwInteractionValue>[] = dests.map((dest) => ({
                  id: `pos:${dest.position.row},${dest.position.col}`,
                  label: `(${dest.position.row},${dest.position.col})`,
                  labelKey: 'actions.position',
                  labelParams: { row: dest.position.row, col: dest.position.col },
                  value: {
                    action: 'stun_destination',
                    targetPosition: dest.position,
                    moveRow: dest.moveRow,
                    moveCol: dest.moveCol,
                    distance: dest.distance,
                  },
                }));
                const interaction = createSimpleChoice(
                  `sw-stun-destination-${event.timestamp ?? 0}-${sw.cardId}`,
                  payload.playerId,
                  'interaction.sw.stunDestination',
                  options,
                  { sourceId: 'stun', targetType: 'minion', autoResolveIfSingle: false },
                );
                const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                interaction.data = {
                  ...interactionData,
                  sw: {
                    type: 'stun_select_destination',
                    cardId: sw.cardId,
                    targetPosition: target.targetPosition,
                  } satisfies SwInteractionMeta,
                };
                newState = queueInteraction(newState, interaction, { urgent: true });
              }
            }
          }

          if (sw.type === 'stun_select_destination') {
            const picked = values.find((item) => item.action === 'stun_destination') as {
              action: 'stun_destination';
              targetPosition: CellCoord;
              moveRow: number;
              moveCol: number;
              distance: number;
            } | undefined;
            if (picked && sw.targetPosition) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: [sw.targetPosition],
                  moveRow: picked.moveRow,
                  moveCol: picked.moveCol,
                  distance: picked.distance,
                },
              }));
            }
          }

          if (sw.type === 'hypnotic_lure_select_target') {
            const target = values.find((item) => item.action === 'hypnotic_lure_target') as { action: 'hypnotic_lure_target'; targetPosition: CellCoord } | undefined;
            if (target?.targetPosition) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: [target.targetPosition],
                },
              }));
            }
          }

          if (sw.type === 'chant_entanglement_select_targets') {
            const selectedTargets = values
              .filter((item) => item.action === 'chant_entanglement_target')
              .map((item) => item.targetPosition);
            if (selectedTargets.length === 2) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: selectedTargets,
                },
              }));
            }
          }

          if (sw.type === 'mogu_symbiotic_self_healing_select_targets') {
            const finish = values.find((item) => item.action === 'mogu_symbiotic_self_healing_finish');
            const selectedTargets = values
              .filter((item) => item.action === 'mogu_symbiotic_self_healing_target')
              .map((item) => item.targetPosition);
            if (finish || selectedTargets.length > 0) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  targets: finish ? [] : selectedTargets,
                },
              }));
            }
          }

          if (sw.type === 'mogu_release_spores_select_positions') {
            const finish = values.find((item) => item.action === 'mogu_release_spores_finish');
            const selectedTargets = values
              .filter((item) => item.action === 'mogu_release_spores_position')
              .map((item) => item.targetPosition)
              .slice(0, 2);
            if (finish || selectedTargets.length > 0) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.PLAY_EVENT,
                payload: {
                  cardId: sw.cardId,
                  cardIds: finish ? [] : undefined,
                  targets: finish ? [] : selectedTargets,
                },
              }));
            }
          }

          if (sw.type === 'sneak_select_unit') {
            const finish = values.find((item) => item.action === 'sneak_finish');
            if (finish) {
              if (sw.recorded && sw.recorded.length > 0) {
                nextEvents.push(...executeSwCommand(newState, random, {
                  type: SW_COMMANDS.PLAY_EVENT,
                  payload: {
                    cardId: sw.cardId,
                    sneakDirections: sw.recorded,
                  },
                }));
              }
            } else {
              const unitPick = values.find((item) => item.action === 'sneak_unit') as { action: 'sneak_unit'; position: CellCoord } | undefined;
              if (unitPick?.position) {
                const adj = getAdjacentCells(unitPick.position)
                  .filter((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
                if (adj.length > 0) {
                  const options = buildPositionOptions(adj, (pos) => ({
                    action: 'sneak_destination',
                    newPosition: pos,
                    targetPosition: pos,
                  }));
                  const interaction = createSimpleChoice(
                    `sw-sneak-direction-${event.timestamp ?? 0}-${sw.cardId}`,
                    payload.playerId,
                    'interaction.sw.sneakDirection',
                    options,
                    { sourceId: 'sneak', targetType: 'minion', autoResolveIfSingle: false },
                  );
                  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                  interaction.data = {
                    ...interactionData,
                    sw: {
                      type: 'sneak_select_direction',
                      cardId: sw.cardId,
                      currentUnit: unitPick.position,
                      recorded: sw.recorded ?? [],
                    } satisfies SwInteractionMeta,
                  };
                  newState = queueInteraction(newState, interaction, { urgent: true });
                }
              }
            }
          }

          if (sw.type === 'sneak_select_direction') {
            const picked = values.find((item) => item.action === 'sneak_destination') as {
              action: 'sneak_destination';
              newPosition: CellCoord;
              targetPosition: CellCoord;
            } | undefined;
            if (picked?.newPosition && sw.currentUnit) {
              const recorded = [...(sw.recorded ?? []), { position: sw.currentUnit, newPosition: picked.newPosition }];
              const remainingUnits = getPlayerUnits(newState.core, payload.playerId)
                .filter((unit) => unit.card.unitClass !== 'summoner' && unit.card.cost === 0)
                .filter((unit) => {
                  const key = `${unit.position.row}-${unit.position.col}`;
                  return !recorded.some((entry) => `${entry.position.row}-${entry.position.col}` === key);
                })
                .filter((unit) => {
                  const adj = getAdjacentCells(unit.position);
                  return adj.some((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
                })
                .map((unit) => unit.position);
              const options: PromptOption<SwInteractionValue>[] = [
                ...buildPositionOptions(remainingUnits, (pos) => ({
                  action: 'sneak_unit',
                  position: pos,
                })),
                ...(recorded.length > 0 ? [{
                  id: 'finish',
                  label: '确认选择',
                  labelKey: 'actions.confirmSelection',
                  value: { action: 'sneak_finish' as const },
                }] : []),
              ];
              if (options.length > 0) {
                const interaction = createSimpleChoice(
                  `sw-sneak-unit-${event.timestamp ?? 0}-${sw.cardId}`,
                  payload.playerId,
                  'interaction.sw.sneakUnit',
                  options,
                  { sourceId: 'sneak', targetType: 'minion', autoResolveIfSingle: false },
                );
                const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                interaction.data = {
                  ...interactionData,
                  sw: {
                    type: 'sneak_select_unit',
                    cardId: sw.cardId,
                    recorded,
                  } satisfies SwInteractionMeta,
                };
                newState = queueInteraction(newState, interaction, { urgent: true });
              }
            }
          }

          if (sw.type === 'glacial_shift_select_building') {
            const finish = values.find((item) => item.action === 'glacial_shift_finish');
            if (finish) {
              if (sw.recorded && sw.recorded.length > 0) {
                nextEvents.push(...executeSwCommand(newState, random, {
                  type: SW_COMMANDS.PLAY_EVENT,
                  payload: {
                    cardId: sw.cardId,
                    shiftDirections: sw.recorded,
                  },
                }));
              }
            } else {
              const picked = values.find((item) => item.action === 'glacial_shift_building') as { action: 'glacial_shift_building'; position: CellCoord } | undefined;
              if (picked?.position) {
                const { row, col } = picked.position;
                const options: PromptOption<SwInteractionValue>[] = [];
                const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
                for (const { dr, dc } of dirs) {
                  for (let step = 1; step <= 2; step++) {
                    const pos = { row: row + dr * step, col: col + dc * step };
                    if (!isValidCoord(pos) || !isCellEmpty(newState.core, pos)) break;
                    options.push({
                      id: `pos:${pos.row},${pos.col}`,
                      label: `(${pos.row},${pos.col})`,
                      labelKey: 'actions.position',
                      labelParams: { row: pos.row, col: pos.col },
                      value: { action: 'glacial_shift_destination', newPosition: pos, targetPosition: pos },
                    });
                  }
                }
                if (options.length > 0) {
                  const interaction = createSimpleChoice(
                    `sw-glacial-shift-destination-${event.timestamp ?? 0}-${sw.cardId}`,
                    payload.playerId,
                    'interaction.sw.glacialShiftDestination',
                    options,
                    { sourceId: 'glacial_shift', targetType: 'minion', autoResolveIfSingle: false },
                  );
                  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                  interaction.data = {
                    ...interactionData,
                    sw: {
                      type: 'glacial_shift_select_destination',
                      cardId: sw.cardId,
                      currentBuilding: picked.position,
                      recorded: sw.recorded ?? [],
                    } satisfies SwInteractionMeta,
                  };
                  newState = queueInteraction(newState, interaction, { urgent: true });
                }
              }
            }
          }

          if (sw.type === 'glacial_shift_select_destination') {
            const picked = values.find((item) => item.action === 'glacial_shift_destination') as {
              action: 'glacial_shift_destination';
              newPosition: CellCoord;
              targetPosition: CellCoord;
            } | undefined;
            if (picked?.newPosition && sw.currentBuilding) {
              const recorded = [...(sw.recorded ?? []), { position: sw.currentBuilding, newPosition: picked.newPosition }];
              if (recorded.length >= 3) {
                nextEvents.push(...executeSwCommand(newState, random, {
                  type: SW_COMMANDS.PLAY_EVENT,
                  payload: {
                    cardId: sw.cardId,
                    shiftDirections: recorded,
                  },
                }));
              } else {
                const summoner = getSummoner(newState.core, payload.playerId);
                const validBuildings: CellCoord[] = [];
                if (summoner) {
                  for (let row = 0; row < BOARD_ROWS; row++) {
                    for (let col = 0; col < BOARD_COLS; col++) {
                      const pos = { row, col };
                      const structure = getStructureAt(newState.core, pos);
                      const unit = getUnitAt(newState.core, pos);
                      const isAllyStructure = (structure && structure.owner === payload.playerId)
                        || (unit && unit.owner === payload.playerId && getUnitAbilities(unit, newState.core).includes('mobile_structure'));
                      if (!isAllyStructure) continue;
                      if (manhattanDistance(summoner.position, pos) > 3) continue;
                      const key = `${pos.row}-${pos.col}`;
                      if (recorded.some((entry) => `${entry.position.row}-${entry.position.col}` === key)) continue;
                      const adj = getAdjacentCells(pos);
                      const hasDest = adj.some((p) => isValidCoord(p) && isCellEmpty(newState.core, p));
                      if (hasDest) {
                        validBuildings.push(pos);
                      }
                    }
                  }
                }
                const options: PromptOption<SwInteractionValue>[] = [
                  ...buildPositionOptions(validBuildings, (pos) => ({
                    action: 'glacial_shift_building',
                    position: pos,
                  })),
                  ...(recorded.length > 0 ? [{
                    id: 'finish',
                    label: '确认选择',
                    labelKey: 'actions.confirmSelection',
                    value: { action: 'glacial_shift_finish' as const },
                  }] : []),
                ];
                if (options.length > 0) {
                  const interaction = createSimpleChoice(
                    `sw-glacial-shift-building-${event.timestamp ?? 0}-${sw.cardId}`,
                    payload.playerId,
                    'interaction.sw.glacialShiftBuilding',
                    options,
                    { sourceId: 'glacial_shift', targetType: 'minion', autoResolveIfSingle: false },
                  );
                  const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
                  interaction.data = {
                    ...interactionData,
                    sw: {
                      type: 'glacial_shift_select_building',
                      cardId: sw.cardId,
                      recorded,
                    } satisfies SwInteractionMeta,
                  };
                  newState = queueInteraction(newState, interaction, { urgent: true });
                }
              }
            }
          }

          if (sw.type === 'infection') {
            if (value && value.action === 'infection') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'infection',
                  sourceUnitId: value.sourceUnitId,
                  targetCardId: value.cardId,
                  targetPosition: value.targetPosition,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'grab_follow') {
            if (value && value.action === 'grab_follow') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'grab',
                  sourceUnitId: value.sourceUnitId,
                  targetPosition: value.targetPosition,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'soul_transfer') {
            if (value && value.action === 'soul_transfer') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'soul_transfer',
                  sourceUnitId: value.sourceUnitId,
                  targetPosition: value.targetPosition,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'mind_capture') {
            if (value && value.action === 'mind_capture') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'mind_capture_resolve',
                  sourceUnitId: value.sourceUnitId,
                  choice: value.choice,
                  targetPosition: value.targetPosition,
                  hits: value.hits,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'ice_shards') {
            if (!isSkipValue(value)) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'ice_shards',
                  sourceUnitId: sw.sourceUnitId,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'feed_beast') {
            newState = applyPhaseEndResolution(newState, 'feed_beast', sw.sourceUnitId);
            if (value && value.action === 'feed_beast') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'feed_beast',
                  sourceUnitId: value.sourceUnitId,
                  choice: value.choice,
                  targetPosition: value.targetPosition,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'mogu_parasite') {
            newState = applyPhaseEndResolution(newState, 'mogu_parasite', sw.sourceUnitId);
            if (value && value.action === 'mogu_parasite') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'mogu_parasite',
                  sourceUnitId: value.sourceUnitId,
                  choice: value.choice,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'mogu_decay_select_target') {
            newState = applyPhaseEndResolution(newState, 'mogu_decay', sw.sourceUnitId);
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'mogu_decay_target') as
              { action: 'mogu_decay_target'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            const sourceUnit = getUnitAt(newState.core, sw.sourcePosition);
            const target = getUnitAt(newState.core, picked.targetPosition);
            if (!sourceUnit || sourceUnit.instanceId !== sw.sourceUnitId || !target || target.owner !== sourceUnit.owner) continue;
            if (manhattanDistance(sw.sourcePosition, picked.targetPosition) !== 1) continue;
            nextEvents.push({
              type: SW_EVENTS.UNIT_CHARGED,
              payload: { position: picked.targetPosition, delta: 2, sourceAbilityId: 'mogu_decay' },
              timestamp: event.timestamp,
            });
          }

          if (sw.type === 'huijin_call_guards_select_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'huijin_call_guards_target') as
              { action: 'huijin_call_guards_target'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) {
              newState = applyPhaseEndResolution(newState, 'huijin_call_guards', sw.sourceUnitId);
              continue;
            }
            const target = getUnitAt(newState.core, picked.targetPosition);
            if (!target || target.owner !== payload.playerId || target.card.unitClass !== 'common') {
              newState = applyPhaseEndResolution(newState, 'huijin_call_guards', sw.sourceUnitId);
              continue;
            }
            const positions = getHuijinCallGuardPositions(newState.core, sw.sourcePosition);
            if (positions.length === 0) {
              newState = applyPhaseEndResolution(newState, 'huijin_call_guards', sw.sourceUnitId);
              continue;
            }
            const options: PromptOption<SwInteractionValue>[] = buildPositionOptions(positions, (pos) => ({
              action: 'huijin_call_guards_position',
              targetPosition: picked.targetPosition,
              position: pos,
            }));
            const interaction = createSimpleChoice(
              `sw-huijin-call-guards-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.huijinCallGuardsPosition',
              options,
              { sourceId: 'huijin_call_guards', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'huijin_call_guards_select_position',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition: picked.targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction, { urgent: true });
          }

          if (sw.type === 'huijin_call_guards_select_position') {
            newState = applyPhaseEndResolution(newState, 'huijin_call_guards', sw.sourceUnitId);
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'huijin_call_guards_position') as
              { action: 'huijin_call_guards_position'; targetPosition: CellCoord; position: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'huijin_call_guards',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                position: picked.position,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'before_attack_life_drain') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'before_attack_life_drain') as
              { action: 'before_attack_life_drain'; targetUnitId: string } | undefined;
            if (!picked || hasSkip) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: {
                  attacker: sw.attackerPosition,
                  target: sw.targetPosition,
                  skipBeforeAttack: true,
                  _noSnapshot: true,
                },
              }));
            } else {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: {
                  attacker: sw.attackerPosition,
                  target: sw.targetPosition,
                  beforeAttack: { abilityId: 'life_drain', targetUnitId: picked.targetUnitId },
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'before_attack_holy_arrow') {
            const discardCardIds = values
              .filter((item) => item.action === 'before_attack_holy_arrow')
              .map((item) => item.cardId)
              .filter((id): id is string => typeof id === 'string');
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            if (hasSkip) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: {
                  attacker: sw.attackerPosition,
                  target: sw.targetPosition,
                  skipBeforeAttack: true,
                  _noSnapshot: true,
                },
              }));
            } else {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: {
                  attacker: sw.attackerPosition,
                  target: sw.targetPosition,
                  beforeAttack: { abilityId: 'holy_arrow', discardCardIds },
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'before_attack_healing') {
            const picked = values.find((item) => item.action === 'before_attack_healing') as
              { action: 'before_attack_healing'; cardId: string } | undefined;
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            if (!picked || hasSkip) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: {
                  attacker: sw.attackerPosition,
                  target: sw.targetPosition,
                  skipBeforeAttack: true,
                  _noSnapshot: true,
                },
              }));
            } else {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.DECLARE_ATTACK,
                payload: {
                  attacker: sw.attackerPosition,
                  target: sw.targetPosition,
                  beforeAttack: { abilityId: 'healing', targetCardId: picked.cardId },
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'after_attack_telekinesis_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_telekinesis_target') as
              { action: 'after_attack_telekinesis_target'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) {
              continue;
            }
            const destinations = getForceDestinations(newState.core, picked.targetPosition, 1);
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...destinations.map((dest) => ({
                id: `pos:${dest.position.row},${dest.position.col}`,
                label: `(${dest.position.row},${dest.position.col})`,
                labelKey: 'actions.position',
                labelParams: { row: dest.position.row, col: dest.position.col },
                value: {
                  action: 'after_attack_telekinesis_direction' as const,
                  targetPosition: picked.targetPosition,
                  moveRow: dest.moveRow,
                  moveCol: dest.moveCol,
                },
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-telekinesis-direction-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.telekinesisDirection',
              options,
              { sourceId: sw.abilityId, targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_telekinesis_direction',
                abilityId: sw.abilityId,
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition: picked.targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'after_attack_shouren_brute_impact') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_shouren_brute_impact') as
              { action: 'after_attack_shouren_brute_impact'; targetPosition: CellCoord; newPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'shouren_brute_impact',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
              playerId: payload.playerId,
            }));
          }

          if (sw.type === 'after_summon_shouren_bloody_rush') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_summon_shouren_bloody_rush') as
              { action: 'after_summon_shouren_bloody_rush'; newPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'shouren_bloody_rush',
                sourceUnitId: sw.sourceUnitId,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
              playerId: payload.playerId,
            }));
          }

          if (sw.type === 'after_attack_shouren_berserk') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_shouren_berserk') as
              { action: 'after_attack_shouren_berserk'; newPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'shouren_berserk',
                sourceUnitId: sw.sourceUnitId,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
              playerId: payload.playerId,
            }));
          }

          if (sw.type === 'after_attack_shouren_primal_fury') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_shouren_primal_fury') as
              { action: 'after_attack_shouren_primal_fury'; newPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'shouren_primal_fury',
                sourceUnitId: sw.sourceUnitId,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
              playerId: payload.playerId,
            }));
          }

          if (sw.type === 'after_attack_telekinesis_direction') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_telekinesis_direction') as
              { action: 'after_attack_telekinesis_direction'; moveRow: number; moveCol: number } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: sw.abilityId,
                sourceUnitId: sw.sourceUnitId,
                targetPosition: sw.targetPosition,
                moveRow: picked.moveRow,
                moveCol: picked.moveCol,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_attack_mind_transmission') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_mind_transmission') as
              { action: 'after_attack_mind_transmission'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'mind_transmission',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_attack_huijin_ram_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_huijin_ram_target') as
              { action: 'after_attack_huijin_ram_target'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            const destinations = getHuijinRamDestinations(newState.core, picked.targetPosition);
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(destinations, (pos) => ({
                action: 'after_attack_huijin_ram_position',
                targetPosition: picked.targetPosition,
                newPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-huijin-ram-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.huijinRamPosition',
              options,
              { sourceId: 'huijin_ram', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_huijin_ram_position',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition: picked.targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'after_attack_huijin_ram_position') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_huijin_ram_position') as
              { action: 'after_attack_huijin_ram_position'; targetPosition: CellCoord; newPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'huijin_ram',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_attack_rapid_fire') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            if (hasSkip) continue;
            if (value && value.action === 'after_attack_rapid_fire') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'rapid_fire',
                  sourceUnitId: sw.sourceUnitId,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'after_attack_withdraw_cost') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_withdraw_cost') as
              { action: 'after_attack_withdraw_cost'; costType: 'charge' | 'magic' } | undefined;
            if (!picked || hasSkip) continue;
            const destinations = getWithdrawDestinations(newState.core, sw.sourcePosition);
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(destinations, (pos) => ({
                action: 'after_attack_withdraw_position',
                targetPosition: pos,
                costType: picked.costType,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-withdraw-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.withdrawPosition',
              options,
              { sourceId: 'withdraw', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_attack_withdraw_position',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                costType: picked.costType,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'after_attack_withdraw_position') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_attack_withdraw_position') as
              { action: 'after_attack_withdraw_position'; targetPosition: CellCoord; costType: 'charge' | 'magic' } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'withdraw',
                sourceUnitId: sw.sourceUnitId,
                costType: picked.costType,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'on_phase_start_illusion') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'on_phase_start_illusion') as
              { action: 'on_phase_start_illusion'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'illusion',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'on_phase_start_blood_rune') {
            if (value && value.action === 'on_phase_start_blood_rune') {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'blood_rune',
                  sourceUnitId: sw.sourceUnitId,
                  choice: value.choice,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'after_move_spirit_bond') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_move_spirit_bond') as
              { action: 'after_move_spirit_bond'; choice: 'self' | 'transfer'; targetPosition?: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'spirit_bond',
                sourceUnitId: sw.sourceUnitId,
                choice: picked.choice,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_move_ancestral_bond') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_move_ancestral_bond') as
              { action: 'after_move_ancestral_bond'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'ancestral_bond',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_move_structure_shift_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_move_structure_shift_target') as
              { action: 'after_move_structure_shift_target'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            const adj = getAdjacentCells(picked.targetPosition).filter((pos) => isCellEmpty(newState.core, pos));
            if (adj.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(adj, (pos) => ({
                action: 'after_move_structure_shift_direction',
                targetPosition: picked.targetPosition,
                newPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-structure-shift-direction-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.structureShiftDirection',
              options,
              { sourceId: 'structure_shift', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'after_move_structure_shift_direction',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition: picked.targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'after_move_structure_shift_direction') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_move_structure_shift_direction') as
              { action: 'after_move_structure_shift_direction'; targetPosition: CellCoord; newPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'structure_shift',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_move_frost_axe') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_move_frost_axe') as
              { action: 'after_move_frost_axe'; choice: 'self' | 'attach'; targetPosition?: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'frost_axe',
                sourceUnitId: sw.sourceUnitId,
                choice: picked.choice,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_move_mogu_transmission') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            if (hasSkip) continue;

            if (sw.step === 'selectMode') {
              const picked = values.find((item) => item.action === 'after_move_mogu_transmission_mode') as
                { action: 'after_move_mogu_transmission_mode'; mode: 'self_to_target' | 'target_to_target' } | undefined;
              if (!picked) continue;
              if (picked.mode === 'target_to_target') {
                const sources = getPlayerUnits(newState.core, payload.playerId)
                  .filter((unit) => unit.instanceId !== sw.sourceUnitId
                    && normalizeUnitBoosts(unit.boosts) > 0
                    && manhattanDistance(sw.sourcePosition, unit.position) <= 2)
                  .map((unit) => unit.position);
                if (sources.length === 0) continue;
                newState = queueInteraction(newState, createMoguTransmissionInteraction(
                  event.timestamp,
                  payload.playerId,
                  sw.sourceUnitId,
                  sw.sourcePosition,
                  'selectSource',
                  buildPositionOptions(sources, (pos) => ({
                    action: 'after_move_mogu_transmission_source',
                    targetPosition: pos,
                  })),
                  { mode: picked.mode },
                ));
                continue;
              }

              const targets = getPlayerUnits(newState.core, payload.playerId)
                .filter((unit) => unit.instanceId !== sw.sourceUnitId
                  && manhattanDistance(sw.sourcePosition, unit.position) <= 2)
                .map((unit) => unit.position);
              if (targets.length === 0) continue;
              newState = queueInteraction(newState, createMoguTransmissionInteraction(
                event.timestamp,
                payload.playerId,
                sw.sourceUnitId,
                sw.sourcePosition,
                'selectTarget',
                buildPositionOptions(targets, (pos) => ({
                  action: 'after_move_mogu_transmission_target',
                  targetPosition: pos,
                })),
                { mode: picked.mode },
              ));
              continue;
            }

            if (sw.step === 'selectSource') {
              const picked = values.find((item) => item.action === 'after_move_mogu_transmission_source') as
                { action: 'after_move_mogu_transmission_source'; targetPosition: CellCoord } | undefined;
              if (!picked?.targetPosition || !sw.mode) continue;
              const targets = getPlayerUnits(newState.core, payload.playerId)
                .filter((unit) => unit.position.row !== picked.targetPosition.row
                  || unit.position.col !== picked.targetPosition.col)
                .filter((unit) => manhattanDistance(sw.sourcePosition, unit.position) <= 2)
                .map((unit) => unit.position);
              if (targets.length === 0) continue;
              newState = queueInteraction(newState, createMoguTransmissionInteraction(
                event.timestamp,
                payload.playerId,
                sw.sourceUnitId,
                sw.sourcePosition,
                'selectTarget',
                buildPositionOptions(targets, (pos) => ({
                  action: 'after_move_mogu_transmission_target',
                  targetPosition: pos,
                })),
                { mode: sw.mode, fromPosition: picked.targetPosition },
              ));
              continue;
            }

            if (sw.step === 'selectTarget') {
              const picked = values.find((item) => item.action === 'after_move_mogu_transmission_target') as
                { action: 'after_move_mogu_transmission_target'; targetPosition: CellCoord } | undefined;
              if (!picked?.targetPosition || !sw.mode) continue;
              const sourcePosition = sw.mode === 'self_to_target' ? sw.sourcePosition : sw.fromPosition;
              if (!sourcePosition) continue;
              const source = getUnitAt(newState.core, sourcePosition);
              const maxAmount = normalizeUnitBoosts(source?.boosts ?? 0);
              if (maxAmount <= 0) continue;
              const options: PromptOption<SwInteractionValue>[] = Array.from({ length: maxAmount }, (_, index) => {
                const amount = index + 1;
                return {
                  id: `amount:${amount}`,
                  label: `${amount}`,
                  value: { action: 'after_move_mogu_transmission_amount', amount },
                };
              });
              newState = queueInteraction(newState, createMoguTransmissionInteraction(
                event.timestamp,
                payload.playerId,
                sw.sourceUnitId,
                sw.sourcePosition,
                'selectAmount',
                options,
                { mode: sw.mode, fromPosition: sw.fromPosition, toPosition: picked.targetPosition },
              ));
              continue;
            }

            if (sw.step === 'selectAmount') {
              const picked = values.find((item) => item.action === 'after_move_mogu_transmission_amount') as
                { action: 'after_move_mogu_transmission_amount'; amount: number } | undefined;
              if (!picked || !sw.mode || !sw.toPosition) continue;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'mogu_transmission',
                  sourceUnitId: sw.sourceUnitId,
                  mode: sw.mode,
                  fromPosition: sw.fromPosition,
                  toPosition: sw.toPosition,
                  amount: picked.amount,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'after_move_mogu_fanatical_fungus') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_move_mogu_fanatical_fungus_target') as
              { action: 'after_move_mogu_fanatical_fungus_target'; targetPosition: CellCoord; newPosition?: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'mogu_fanatical_fungus',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'after_move_huijin_quick_shot') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'after_move_huijin_quick_shot') as
              { action: 'after_move_huijin_quick_shot'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'huijin_quick_shot',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'yongheng_draw') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_draw') as
              { action: 'yongheng_draw'; abilityId: YonghengDrawAbilityId } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              playerId: payload.playerId,
              payload: {
                abilityId: sw.abilityId,
                sourceUnitId: sw.sourceUnitId,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'yongheng_mental_invasion') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_mental_invasion') as
              { action: 'yongheng_mental_invasion'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              playerId: payload.playerId,
              payload: {
                abilityId: 'yongheng_mental_invasion',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'yongheng_collision_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_collision_target') as
              { action: 'yongheng_collision_target'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            const destinations = getAdjacentCells(picked.targetPosition).filter((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(destinations, (pos) => ({
                action: 'yongheng_collision_position',
                targetPosition: picked.targetPosition,
                newPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-yongheng-collision-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.yonghengCollisionPosition',
              options,
              { sourceId: 'yongheng_collision', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'yongheng_collision_position',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition: picked.targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'yongheng_collision_position') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_collision_position') as
              { action: 'yongheng_collision_position'; targetPosition: CellCoord; newPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              playerId: payload.playerId,
              payload: {
                abilityId: 'yongheng_collision',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                newPosition: picked.newPosition,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'yongheng_warning_card') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_warning_card') as
              { action: 'yongheng_warning_card'; targetCardId: string } | undefined;
            if (!picked || hasSkip) continue;
            const summoner = getSummoner(newState.core, payload.playerId);
            if (!summoner) continue;
            const destinations = getAdjacentCells(summoner.position).filter((pos) => isValidCoord(pos) && isCellEmpty(newState.core, pos));
            if (destinations.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(destinations, (pos) => ({
                action: 'yongheng_warning_position',
                targetPosition: summoner.position,
                newPosition: pos,
                targetCardId: picked.targetCardId,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-yongheng-warning-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.yonghengWarningPosition',
              options,
              { sourceId: 'yongheng_warning', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'yongheng_warning_position',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetPosition: summoner.position,
                targetCardId: picked.targetCardId,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'yongheng_warning_position') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_warning_position') as
              { action: 'yongheng_warning_position'; targetPosition: CellCoord; newPosition: CellCoord; targetCardId: string } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              playerId: payload.playerId,
              payload: {
                abilityId: 'yongheng_warning',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                newPosition: picked.newPosition,
                targetCardId: picked.targetCardId,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'yongheng_application_card') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_application_card') as
              { action: 'yongheng_application_card'; targetCardId: string } | undefined;
            if (!picked || hasSkip) continue;
            const targets = getYonghengAdjacentUnitTargets(newState.core, sw.sourcePosition);
            if (targets.length === 0) continue;
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(targets, (pos) => ({
                action: 'yongheng_application_target',
                targetPosition: pos,
                targetCardId: picked.targetCardId,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-yongheng-application-target-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
              payload.playerId,
              'interaction.sw.yonghengApplicationTarget',
              options,
              { sourceId: 'yongheng_application', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'yongheng_application_target',
                sourceUnitId: sw.sourceUnitId,
                sourcePosition: sw.sourcePosition,
                targetCardId: picked.targetCardId,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'yongheng_application_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_application_target') as
              { action: 'yongheng_application_target'; targetPosition: CellCoord; targetCardId: string } | undefined;
            if (!picked || hasSkip) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              playerId: payload.playerId,
              payload: {
                abilityId: 'yongheng_application',
                sourceUnitId: sw.sourceUnitId,
                targetPosition: picked.targetPosition,
                targetCardId: picked.targetCardId,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'yongheng_forced_discard') {
            const picked = values.find((item) => item.action === 'yongheng_forced_discard_card') as
              { action: 'yongheng_forced_discard_card'; targetOwner: PlayerId; targetCardId: string } | undefined;
            if (!picked) continue;
            const sourceUnit = getUnitAt(newState.core, sw.sourcePosition);
            if (!sourceUnit || sourceUnit.instanceId !== sw.sourceUnitId) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              playerId: sourceUnit.owner,
              payload: {
                abilityId: sw.abilityId,
                sourceUnitId: sw.sourceUnitId,
                targetOwner: sw.targetOwner,
                targetCardId: picked.targetCardId,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'yongheng_continuance') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'yongheng_continuance_retain') as
              { action: 'yongheng_continuance_retain'; targetOwner: PlayerId; targetCardId: string } | undefined;
            const sourcePosition = findUnitPositionByInstanceId(newState.core, sw.sourceUnitId) ?? sw.sourcePosition;
            const sourceUnit = getUnitAt(newState.core, sourcePosition);
            const stillActive = newState.core.players[sw.targetOwner]?.activeEvents.some(card => card.id === sw.targetCardId);
            const canRetain = !!picked
              && !hasSkip
              && !!sourceUnit
              && sourceUnit.owner === sw.targetOwner
              && normalizeUnitBoosts(sourceUnit.boosts) >= 2
              && stillActive;
            if (canRetain) {
              nextEvents.push({
                type: SW_EVENTS.UNIT_CHARGED,
                payload: {
                  position: sourcePosition,
                  delta: -2,
                  sourceAbilityId: 'yongheng_continuance',
                  targetCardId: sw.targetCardId,
                },
                timestamp: event.timestamp,
              });
            } else if (stillActive) {
              nextEvents.push({
                type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
                payload: {
                  playerId: sw.targetOwner,
                  cardId: sw.targetCardId,
                  yonghengContinuanceResolved: true,
                },
                timestamp: event.timestamp,
              });
            }
          }

          if (sw.type === 'activated_ability_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            if (hasSkip) continue;

            if (sw.abilityId === 'shadow_return_to_shadow' && sw.step === 'selectUnit') {
              const picked = values.find((item) => item.action === 'activated_ability_target') as
                { action: 'activated_ability_target'; targetPosition?: CellCoord } | undefined;
              if (!picked?.targetPosition) continue;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'shadow_return_to_shadow',
                  sourceUnitId: sw.sourceUnitId,
                  targetPosition: picked.targetPosition,
                  _noSnapshot: true,
                },
                playerId: payload.playerId,
              }));
            }

            if (sw.abilityId === 'revive_undead' && sw.step === 'selectCard') {
              const picked = values.find((item) => item.action === 'activated_ability_target') as
                { action: 'activated_ability_target'; targetCardId?: string } | undefined;
              if (!picked?.targetCardId) continue;
              const adj = getAdjacentCells(sw.sourcePosition).filter((pos) => isCellEmpty(newState.core, pos));
              if (adj.length === 0) continue;
              const options: PromptOption<SwInteractionValue>[] = buildPositionOptions(adj, (pos) => ({
                action: 'activated_ability_target',
                abilityId: 'revive_undead',
                targetPosition: pos,
                targetCardId: picked.targetCardId,
              }));
              const interaction = createSimpleChoice(
                `sw-revive-undead-position-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
                payload.playerId,
                'interaction.sw.reviveUndeadPosition',
                options,
                { sourceId: 'revive_undead', targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'activated_ability_target',
                  abilityId: 'revive_undead',
                  sourceUnitId: sw.sourceUnitId,
                  sourcePosition: sw.sourcePosition,
                  step: 'selectPosition',
                  targetCardId: picked.targetCardId,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }

            if (sw.abilityId === 'revive_undead' && sw.step === 'selectPosition') {
              const picked = values.find((item) => item.action === 'activated_ability_target') as
                { action: 'activated_ability_target'; targetPosition?: CellCoord; targetCardId?: string } | undefined;
              const targetCardId = picked?.targetCardId ?? sw.targetCardId;
              if (!picked?.targetPosition || !targetCardId) continue;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'revive_undead',
                  sourceUnitId: sw.sourceUnitId,
                  targetCardId,
                  targetPosition: picked.targetPosition,
                  _noSnapshot: true,
                },
              }));
            }

            if (sw.abilityId === 'fortress_power' && sw.step === 'selectCard') {
              const picked = values.find((item) => item.action === 'activated_ability_target') as
                { action: 'activated_ability_target'; targetCardId?: string } | undefined;
              if (!picked?.targetCardId) continue;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'fortress_power',
                  sourceUnitId: sw.sourceUnitId,
                  targetCardId: picked.targetCardId,
                  _noSnapshot: true,
                },
              }));
            }

            if (sw.abilityId === 'vanish' && sw.step === 'selectUnit') {
              const picked = values.find((item) => item.action === 'activated_ability_target') as
                { action: 'activated_ability_target'; targetPosition?: CellCoord } | undefined;
              if (!picked?.targetPosition) continue;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'vanish',
                  sourceUnitId: sw.sourceUnitId,
                  targetPosition: picked.targetPosition,
                  _noSnapshot: true,
                },
              }));
            }

            if (sw.abilityId === 'mogu_blood_infusion' && sw.step === 'selectUnit') {
              const picked = values.find((item) => item.action === 'activated_ability_target') as
                { action: 'activated_ability_target'; targetPosition?: CellCoord } | undefined;
              if (!picked?.targetPosition) continue;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'mogu_blood_infusion',
                  sourceUnitId: sw.sourceUnitId,
                  targetPosition: picked.targetPosition,
                  _noSnapshot: true,
                },
              }));
            }

            if ((sw.abilityId === 'telekinesis_instead' || sw.abilityId === 'high_telekinesis_instead')
              && sw.step === 'selectUnit') {
              const picked = values.find((item) => item.action === 'after_attack_telekinesis_target') as
                { action: 'after_attack_telekinesis_target'; targetPosition: CellCoord } | undefined;
              if (!picked?.targetPosition) continue;
              const destinations = getForceDestinations(newState.core, picked.targetPosition, 1);
              if (destinations.length === 0) continue;
              const options: PromptOption<SwInteractionValue>[] = [
                ...destinations.map((dest) => ({
                  id: `pos:${dest.position.row},${dest.position.col}`,
                  label: `(${dest.position.row},${dest.position.col})`,
                  labelKey: 'actions.position',
                  labelParams: { row: dest.position.row, col: dest.position.col },
                  value: {
                    action: 'after_attack_telekinesis_direction' as const,
                    targetPosition: picked.targetPosition,
                    moveRow: dest.moveRow,
                    moveCol: dest.moveCol,
                  },
                })),
                {
                  id: 'skip',
                  label: '跳过',
                  labelKey: 'actions.skip',
                  value: { skip: true },
                },
              ];
              const interaction = createSimpleChoice(
                `sw-telekinesis-instead-dir-${event.timestamp ?? 0}-${sw.sourceUnitId}`,
                payload.playerId,
                'interaction.sw.telekinesisDirection',
                options,
                { sourceId: sw.abilityId, targetType: 'minion', autoResolveIfSingle: false },
              );
              const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
              interaction.data = {
                ...interactionData,
                sw: {
                  type: 'activated_ability_target',
                  abilityId: sw.abilityId,
                  sourceUnitId: sw.sourceUnitId,
                  sourcePosition: sw.sourcePosition,
                  step: 'selectDirection',
                  targetPosition: picked.targetPosition,
                } satisfies SwInteractionMeta,
              };
              newState = queueInteraction(newState, interaction);
            }

            if ((sw.abilityId === 'telekinesis_instead' || sw.abilityId === 'high_telekinesis_instead')
              && sw.step === 'selectDirection') {
              const picked = values.find((item) => item.action === 'after_attack_telekinesis_direction') as
                { action: 'after_attack_telekinesis_direction'; moveRow: number; moveCol: number } | undefined;
              if (!picked || !sw.targetPosition) continue;
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: sw.abilityId,
                  sourceUnitId: sw.sourceUnitId,
                  targetPosition: sw.targetPosition,
                  moveRow: picked.moveRow,
                  moveCol: picked.moveCol,
                  _noSnapshot: true,
                },
              }));
            }
          }

          if (sw.type === 'fire_sacrifice_summon') {
            const picked = values.find((item) => item.action === 'fire_sacrifice_summon') as
              { action: 'fire_sacrifice_summon'; sacrificeUnitId: string } | undefined;
            if (!picked) continue;
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.SUMMON_UNIT,
              payload: {
                cardId: sw.cardId,
                position: sw.summonPosition,
                sacrificeUnitId: picked.sacrificeUnitId,
                _noSnapshot: true,
              },
            }));
          }

          if (sw.type === 'ice_ram_target') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'ice_ram_target') as
              { action: 'ice_ram_target'; targetPosition: CellCoord } | undefined;
            if (!picked || hasSkip) continue;
            const adj = getAdjacentCells(picked.targetPosition).filter((pos) => isCellEmpty(newState.core, pos));
            if (adj.length === 0) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'ice_ram',
                  sourceUnitId: 'ice_ram',
                  targetPosition: picked.targetPosition,
                  structurePosition: sw.structurePosition,
                  _noSnapshot: true,
                },
              }));
              continue;
            }
            const options: PromptOption<SwInteractionValue>[] = [
              ...buildPositionOptions(adj, (pos) => ({
                action: 'ice_ram_push',
                targetPosition: picked.targetPosition,
                pushNewPosition: pos,
              })),
              {
                id: 'skip',
                label: '跳过',
                labelKey: 'actions.skip',
                value: { skip: true },
              },
            ];
            const interaction = createSimpleChoice(
              `sw-ice-ram-push-${event.timestamp ?? 0}-${sw.ownerId}`,
              sw.ownerId,
              'interaction.sw.iceRamPush',
              options,
              { sourceId: 'ice_ram', targetType: 'minion', autoResolveIfSingle: false },
            );
            const interactionData = (interaction.data ?? {}) as Record<string, unknown>;
            interaction.data = {
              ...interactionData,
              sw: {
                type: 'ice_ram_push',
                structurePosition: sw.structurePosition,
                targetPosition: picked.targetPosition,
              } satisfies SwInteractionMeta,
            };
            newState = queueInteraction(newState, interaction);
          }

          if (sw.type === 'ice_ram_push') {
            const hasSkip = isSkipValue(value) || values.some((item) => isSkipValue(item));
            const picked = values.find((item) => item.action === 'ice_ram_push') as
              { action: 'ice_ram_push'; targetPosition: CellCoord; pushNewPosition?: CellCoord } | undefined;
            if (!picked || hasSkip) {
              nextEvents.push(...executeSwCommand(newState, random, {
                type: SW_COMMANDS.ACTIVATE_ABILITY,
                payload: {
                  abilityId: 'ice_ram',
                  sourceUnitId: 'ice_ram',
                  targetPosition: sw.targetPosition,
                  structurePosition: sw.structurePosition,
                  _noSnapshot: true,
                },
              }));
              continue;
            }
            nextEvents.push(...executeSwCommand(newState, random, {
              type: SW_COMMANDS.ACTIVATE_ABILITY,
              payload: {
                abilityId: 'ice_ram',
                sourceUnitId: 'ice_ram',
                targetPosition: picked.targetPosition,
                structurePosition: sw.structurePosition,
                pushNewPosition: picked.pushNewPosition,
                _noSnapshot: true,
              },
            }));
          }
        }
      }

      if (newState !== state || nextEvents.length > 0) {
        return {
          state: newState,
          events: nextEvents.length > 0 ? nextEvents : undefined,
        };
      }
    },
  };
}
