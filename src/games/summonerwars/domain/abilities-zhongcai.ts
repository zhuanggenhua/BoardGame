/**
 * 召唤师战争 - 仲裁派系技能定义
 *
 * 规则型能力尽量接入现有的阶段、攻击、推拉和技能注册链；需要玩家
 * 选择的能力只声明交互入口，具体结算由 systems / executors 完成。
 */

import type { AbilityDef } from './abilities';
import { abilityText } from './abilityTextHelper';

export const ZHONGCAI_ABILITIES: AbilityDef[] = [
  {
    id: 'zhongcai_word',
    name: abilityText('zhongcai_word', 'name'),
    description: abilityText('zhongcai_word', 'description'),
    trigger: 'afterAttack',
    effects: [{ type: 'custom', actionId: 'zhongcai_word' }],
  },
  {
    id: 'zhongcai_high_gate',
    name: abilityText('zhongcai_high_gate', 'name'),
    description: abilityText('zhongcai_high_gate', 'description'),
    trigger: 'onAdjacentEnemyLeave',
    effects: [],
  },
  {
    id: 'zhongcai_radiant_healing',
    name: abilityText('zhongcai_radiant_healing', 'name'),
    description: abilityText('zhongcai_radiant_healing', 'description'),
    trigger: 'onPhaseEnd',
    effects: [{ type: 'custom', actionId: 'zhongcai_radiant_healing' }],
  },
  {
    id: 'zhongcai_erase',
    name: abilityText('zhongcai_erase', 'name'),
    description: abilityText('zhongcai_erase', 'description'),
    trigger: 'onPhaseStart',
    effects: [{ type: 'custom', actionId: 'zhongcai_erase' }],
  },
  {
    id: 'zhongcai_repentance',
    name: abilityText('zhongcai_repentance', 'name'),
    description: abilityText('zhongcai_repentance', 'description'),
    trigger: 'afterAttack',
    effects: [],
  },
  {
    id: 'zhongcai_sturdy',
    name: abilityText('zhongcai_sturdy', 'name'),
    description: abilityText('zhongcai_sturdy', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'zhongcai_support',
    name: abilityText('zhongcai_support', 'name'),
    description: abilityText('zhongcai_support', 'description'),
    trigger: 'onSummon',
    effects: [],
  },
  {
    id: 'zhongcai_inspire',
    name: abilityText('zhongcai_inspire', 'name'),
    description: abilityText('zhongcai_inspire', 'description'),
    trigger: 'onSummon',
    effects: [{ type: 'custom', actionId: 'zhongcai_inspire' }],
  },
  {
    id: 'zhongcai_strong',
    name: abilityText('zhongcai_strong', 'name'),
    description: abilityText('zhongcai_strong', 'description'),
    trigger: 'onDamageCalculation',
    effects: [
      { type: 'modifyStrength', target: 'self', value: 1 },
    ],
  },
];
