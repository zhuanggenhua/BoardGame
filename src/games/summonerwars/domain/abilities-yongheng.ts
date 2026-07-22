/**
 * 召唤师战争 - 永恒议会技能定义
 *
 * 本文件先登记永恒议会所有卡面能力 ID 与触发时机。
 * 具体机制按录入合同逐项接入，未接执行器的能力保留 effects: []，避免伪装为已实现。
 */

import type { AbilityDef } from './abilities';
import { abilityText } from './abilityTextHelper';

export const YONGHENG_ABILITIES: AbilityDef[] = [
  {
    id: 'yongheng_kinetic_siphon',
    name: abilityText('yongheng_kinetic_siphon', 'name'),
    description: abilityText('yongheng_kinetic_siphon', 'description'),
    trigger: 'afterAttack',
    condition: { type: 'isOwner', target: 'target', owner: 'opponent' },
    usesPerTurn: 1,
    effects: [{ type: 'addCharge', target: 'self', value: 1 }],
  },
  {
    id: 'yongheng_continuance',
    name: abilityText('yongheng_continuance', 'name'),
    description: abilityText('yongheng_continuance', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'yongheng_intelligence',
    name: abilityText('yongheng_intelligence', 'name'),
    description: abilityText('yongheng_intelligence', 'description'),
    trigger: 'afterMove',
    effects: [{ type: 'custom', actionId: 'yongheng_intelligence_draw' }],
  },
  {
    id: 'yongheng_warning',
    name: abilityText('yongheng_warning', 'name'),
    description: abilityText('yongheng_warning', 'description'),
    trigger: 'afterAttack',
    effects: [{ type: 'custom', actionId: 'yongheng_warning_move_summoner' }],
  },
  {
    id: 'yongheng_arouse_fear',
    name: abilityText('yongheng_arouse_fear', 'name'),
    description: abilityText('yongheng_arouse_fear', 'description'),
    trigger: 'afterMove',
    effects: [{ type: 'custom', actionId: 'yongheng_arouse_fear_discard' }],
  },
  {
    id: 'yongheng_collision',
    name: abilityText('yongheng_collision', 'name'),
    description: abilityText('yongheng_collision', 'description'),
    trigger: 'afterAttack',
    effects: [{ type: 'custom', actionId: 'yongheng_collision_push_pull' }],
  },
  {
    id: 'yongheng_punish',
    name: abilityText('yongheng_punish', 'name'),
    description: abilityText('yongheng_punish', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'yongheng_wisdom',
    name: abilityText('yongheng_wisdom', 'name'),
    description: abilityText('yongheng_wisdom', 'description'),
    trigger: 'onSummon',
    effects: [{ type: 'custom', actionId: 'yongheng_wisdom_draw' }],
  },
  {
    id: 'yongheng_analysis',
    name: abilityText('yongheng_analysis', 'name'),
    description: abilityText('yongheng_analysis', 'description'),
    trigger: 'afterAttack',
    effects: [{ type: 'custom', actionId: 'yongheng_analysis_draw' }],
  },
  {
    id: 'yongheng_scheme',
    name: abilityText('yongheng_scheme', 'name'),
    description: abilityText('yongheng_scheme', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'yongheng_tenacity',
    name: abilityText('yongheng_tenacity', 'name'),
    description: abilityText('yongheng_tenacity', 'description'),
    trigger: 'onTurnEnd',
    condition: { type: 'deckEmpty', target: 'owner' },
    effects: [{ type: 'addCharge', target: 'self', value: 1 }],
  },
  {
    id: 'yongheng_power_reinforcement',
    name: abilityText('yongheng_power_reinforcement', 'name'),
    description: abilityText('yongheng_power_reinforcement', 'description'),
    trigger: 'passive',
    effects: [
      {
        type: 'modifyStrength',
        target: 'self',
        value: { type: 'attribute', target: 'self', attr: 'charge' },
        maxBonus: 5,
      },
    ],
  },
  {
    id: 'yongheng_search',
    name: abilityText('yongheng_search', 'name'),
    description: abilityText('yongheng_search', 'description'),
    trigger: 'onPhaseStart',
    effects: [{ type: 'custom', actionId: 'yongheng_search_draw' }],
  },
  {
    id: 'yongheng_mental_invasion',
    name: abilityText('yongheng_mental_invasion', 'name'),
    description: abilityText('yongheng_mental_invasion', 'description'),
    trigger: 'afterDraw',
    effects: [{ type: 'custom', actionId: 'yongheng_mental_invasion_damage' }],
  },
  {
    id: 'yongheng_application',
    name: abilityText('yongheng_application', 'name'),
    description: abilityText('yongheng_application', 'description'),
    trigger: 'afterAttack',
    effects: [{ type: 'custom', actionId: 'yongheng_application_discard_damage' }],
  },
];
