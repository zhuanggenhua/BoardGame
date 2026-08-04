/**
 * 召唤师战争 - 暗影精灵能力登记
 *
 * 卡面规则已由 shadow-faction-intake.md 锁定。需要玩家选择的规则由
 * InteractionSystem 负责收集参数，再交给 shadow 执行器完成最终状态变化。
 */

import type { AbilityDef } from './abilities';
import { abilityText } from './abilityTextHelper';

const define = (
  id: string,
  trigger: AbilityDef['trigger'],
  extra: Pick<AbilityDef, 'condition' | 'effects'> = { effects: [] },
): AbilityDef => ({
  id,
  name: abilityText(id, 'name'),
  description: abilityText(id, 'description'),
  trigger,
  ...extra,
});

export const SHADOW_ABILITIES: AbilityDef[] = [
  define('shadow_blood_magic', 'passive'),
  {
    ...define('shadow_return_to_shadow', 'activated', {
      effects: [{ type: 'custom', actionId: 'shadow_return_to_shadow' }],
    }),
    requiresTargetSelection: true,
    ui: {
      requiresButton: true,
      buttonLabel: 'abilities.shadow_return_to_shadow.name',
      buttonVariant: 'secondary',
      quickCheck: ({ core, unit, playerId }) => (
        core.currentPlayer === playerId && unit.boosts >= 2
      ),
      useValidateForDisabled: true,
    },
    validation: {
      customValidator: ({ core, playerId, sourceUnit }) => {
        if (core.currentPlayer !== playerId) return { valid: false, error: '只能在自己的回合使用' };
        if (sourceUnit.boosts < 2) return { valid: false, error: '至少需要2点充能' };
        return { valid: true };
      },
    },
  },
  define('shadow_dark_prophecy', 'onUnitDestroyed', {
    condition: { type: 'isOwner', target: 'victim', owner: 'self' },
    effects: [{ type: 'addCharge', target: 'self', value: 1 }],
  }),
  define('shadow_judgment', 'afterMove', {
    effects: [{ type: 'custom', actionId: 'shadow_judgment_request' }],
  }),
  {
    ...define('shadow_tear_the_veil', 'afterMove', {
      effects: [{ type: 'custom', actionId: 'shadow_tear_the_veil_request' }],
    }),
    usesPerTurn: 1,
  },
  define('shadow_inescapable_doom', 'onPhaseEnd', {
    effects: [{ type: 'custom', actionId: 'shadow_inescapable_doom_damage' }],
  }),
  define('shadow_forbidden_knowledge', 'afterMove', {
    effects: [{ type: 'custom', actionId: 'shadow_forbidden_knowledge_request' }],
  }),
  define('shadow_fierce_assault', 'passive'),
  define('shadow_feint', 'afterAttack', {
    effects: [{ type: 'custom', actionId: 'shadow_feint_request' }],
  }),
  define('shadow_shadow_summon', 'onSummon', {
    effects: [{ type: 'custom', actionId: 'shadow_shadow_summon_request' }],
  }),
  define('shadow_death_pact', 'onDeath', {
    effects: [{ type: 'custom', actionId: 'shadow_death_pact_damage' }],
  }),
  define('shadow_piercing_light', 'passive'),
  define('shadow_sudden_assault', 'onSummon', {
    effects: [{ type: 'custom', actionId: 'shadow_sudden_assault_request' }],
  }),
];
