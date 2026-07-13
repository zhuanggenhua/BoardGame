/**
 * 召唤师战争 - 莫古技能定义
 *
 * 莫古核心机制：友军死亡触发充能、充能作为代价/增幅、疫病体与菌化野兽互相替换。
 */

import type { AbilityDef } from './abilities';
import type { CellCoord } from './types';
import {
  getUnitAt,
  manhattanDistance,
  normalizeUnitBoosts,
  isCellEmpty,
  isValidCoord,
} from './helpers';
import { isMoguFungalBeastCard, isMoguSporePlagueBodyCard } from './ids';
import { abilityText } from './abilityTextHelper';

export const MOGU_ABILITIES: AbilityDef[] = [
  {
    id: 'mogu_blood_bloom',
    name: abilityText('mogu_blood_bloom', 'name'),
    description: abilityText('mogu_blood_bloom', 'description'),
    trigger: 'onUnitDestroyed',
    effects: [
      { type: 'custom', actionId: 'mogu_blood_bloom_charge' },
    ],
  },
  {
    id: 'mogu_blood_rage',
    name: abilityText('mogu_blood_rage', 'name'),
    description: abilityText('mogu_blood_rage', 'description'),
    trigger: 'onUnitDestroyed',
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
  },
  {
    id: 'mogu_blood_rage_decay',
    name: abilityText('mogu_blood_rage_decay', 'name'),
    description: abilityText('mogu_blood_rage_decay', 'description'),
    trigger: 'onTurnEnd',
    effects: [
      { type: 'removeCharge', target: 'self', value: 2 },
    ],
  },
  {
    id: 'mogu_final_form',
    name: abilityText('mogu_final_form', 'name'),
    description: abilityText('mogu_final_form', 'description'),
    trigger: 'onSummon',
    effects: [
      { type: 'custom', actionId: 'mogu_final_form_replace' },
    ],
  },
  {
    id: 'mogu_blood_infusion',
    name: abilityText('mogu_blood_infusion', 'name'),
    description: abilityText('mogu_blood_infusion', 'description'),
    trigger: 'activated',
    usesPerTurn: 1,
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      count: 1,
    },
    effects: [
      { type: 'custom', actionId: 'mogu_blood_infusion' },
    ],
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
        if (!targetPosition) return { valid: false, error: '必须选择目标友方单位' };
        const target = getUnitAt(ctx.core, targetPosition);
        if (!target) return { valid: false, error: '目标位置没有单位' };
        if (target.owner !== ctx.playerId) return { valid: false, error: '必须选择友方单位' };
        if (manhattanDistance(ctx.sourcePosition, targetPosition) > 2) {
          return { valid: false, error: '目标必须在2格以内' };
        }
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.moguBloodInfusion',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },
  {
    id: 'mogu_transmission',
    name: abilityText('mogu_transmission', 'name'),
    description: abilityText('mogu_transmission', 'description'),
    trigger: 'afterMove',
    usesPerTurn: 1,
    requiresTargetSelection: true,
    interactionChain: {
      steps: [
        { step: 'selectChoice', inputType: 'choice', producesField: 'mode' },
        { step: 'selectUnit', inputType: 'position', producesField: 'fromPosition', optional: true },
        { step: 'selectUnit', inputType: 'position', producesField: 'toPosition' },
        { step: 'selectChoice', inputType: 'choice', producesField: 'amount' },
      ],
      payloadContract: {
        required: ['mode', 'toPosition', 'amount'],
        optional: ['fromPosition'],
      },
    },
    effects: [
      { type: 'custom', actionId: 'mogu_transmission' },
    ],
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const mode = ctx.payload.mode as string | undefined;
        const fromPosition = ctx.payload.fromPosition as CellCoord | undefined;
        const toPosition = ctx.payload.toPosition as CellCoord | undefined;
        const amount = Number(ctx.payload.amount ?? 0);
        if (mode !== 'self_to_target' && mode !== 'target_to_target') {
          return { valid: false, error: '必须选择传输模式' };
        }
        if (!toPosition) return { valid: false, error: '必须选择接收目标' };
        if (!Number.isFinite(amount) || amount <= 0) return { valid: false, error: '必须选择正数充能' };

        const toUnit = getUnitAt(ctx.core, toPosition);
        if (!toUnit || toUnit.owner !== ctx.playerId) return { valid: false, error: '接收目标必须是友方单位' };
        if (manhattanDistance(ctx.sourcePosition, toPosition) > 2) {
          return { valid: false, error: '接收目标必须在2格以内' };
        }

        const source = mode === 'self_to_target'
          ? ctx.sourceUnit
          : fromPosition ? getUnitAt(ctx.core, fromPosition) : undefined;
        if (!source || source.owner !== ctx.playerId) return { valid: false, error: '来源必须是友方单位' };
        if (mode === 'target_to_target') {
          if (!fromPosition) return { valid: false, error: '必须选择充能来源目标' };
          if (manhattanDistance(ctx.sourcePosition, fromPosition) > 2) {
            return { valid: false, error: '来源目标必须在2格以内' };
          }
        }
        if (normalizeUnitBoosts(source.boosts) < amount) return { valid: false, error: '来源充能不足' };
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.moguTransmission',
      buttonVariant: 'secondary',
      activationStep: 'selectChoice',
    },
  },
  {
    id: 'mogu_decay',
    name: abilityText('mogu_decay', 'name'),
    description: abilityText('mogu_decay', 'description'),
    trigger: 'onPhaseEnd',
    effects: [
      { type: 'custom', actionId: 'mogu_decay' },
    ],
  },
  {
    id: 'mogu_infection',
    name: abilityText('mogu_infection', 'name'),
    description: abilityText('mogu_infection', 'description'),
    trigger: 'onKill',
    condition: {
      type: 'hasCardInDiscard',
      cardType: 'mogu_spore_plague_body',
    },
    effects: [
      { type: 'custom', actionId: 'mogu_infection_replace' },
    ],
  },
  {
    id: 'mogu_parasite',
    name: abilityText('mogu_parasite', 'name'),
    description: abilityText('mogu_parasite', 'description'),
    trigger: 'onPhaseEnd',
    effects: [
      { type: 'custom', actionId: 'mogu_parasite' },
    ],
  },
  {
    id: 'mogu_burst',
    name: abilityText('mogu_burst', 'name'),
    description: abilityText('mogu_burst', 'description'),
    trigger: 'onPhaseEnd',
    condition: { type: 'hasCharge', target: 'self', minStacks: 3 },
    effects: [
      { type: 'destroyUnit', target: 'self' },
    ],
  },
  {
    id: 'mogu_fungal_mutation',
    name: abilityText('mogu_fungal_mutation', 'name'),
    description: abilityText('mogu_fungal_mutation', 'description'),
    trigger: 'onDeath',
    condition: { type: 'hasCharge', target: 'self', minStacks: 3 },
    effects: [
      { type: 'custom', actionId: 'mogu_fungal_mutation_replace' },
    ],
  },
  {
    id: 'mogu_fanatical_fungus',
    name: abilityText('mogu_fanatical_fungus', 'name'),
    description: abilityText('mogu_fanatical_fungus', 'description'),
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'mogu_fanatical_fungus' },
    ],
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
        const newPosition = ctx.payload.newPosition as CellCoord | undefined;
        if (!targetPosition) return { valid: false, error: '必须选择刚移动的单位' };
        const target = getUnitAt(ctx.core, targetPosition);
        if (!target || target.owner !== ctx.playerId) return { valid: false, error: '目标必须是友方单位' };
        if (newPosition) {
          if (!isValidCoord(newPosition) || !isCellEmpty(ctx.core, newPosition)) {
            return { valid: false, error: '推拉目标格必须为空' };
          }
          if (manhattanDistance(targetPosition, newPosition) !== 1) {
            return { valid: false, error: '只能推拉1格' };
          }
        }
        return { valid: true };
      },
    },
  },
];

export function hasMoguSporePlagueBodyInDiscard(cards: Array<{ id: string; name: string; faction?: string }>): boolean {
  return cards.some(isMoguSporePlagueBodyCard);
}

export function hasMoguFungalBeastInDiscard(cards: Array<{ id: string; name: string; faction?: string }>): boolean {
  return cards.some(isMoguFungalBeastCard);
}
