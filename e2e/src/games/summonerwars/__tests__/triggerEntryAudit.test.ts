/**
 * 触发入口一致性审计
 *
 * 检查通过 EventStream 自动触发 UI 交互的技能不能同时有 requiresButton: true，
 * 否则撤回后 EventStream 被清空，玩家仍可通过按钮重复激活技能。
 *
 * 三类 EventStream 自动触发来源：
 * 1. afterMove — execute.ts 中 MOVE_UNIT 产生 ABILITY_TRIGGERED(afterMove:xxx)
 * 2. afterAttack — triggerAbilities('afterAttack') 产生 ABILITY_TRIGGERED
 * 3. onPhaseStart/onPhaseEnd — flowHooks 中 triggerPhaseAbilities 产生 ABILITY_TRIGGERED
 *
 * 这些技能的 UI 交互由 useGameEvents.ts 消费 EventStream 事件驱动，
 * 不应该同时在 AbilityButtonsPanel 中显示按钮（双入口）。
 */

import { describe, it, expect } from 'vitest';
import { abilityRegistry } from '../domain/abilities';
import { PHASE_START_ABILITIES, PHASE_END_ABILITIES } from '../domain/flowHooks';

/**
 * 通过 EventStream 自动触发 UI 交互的技能 ID。
 *
 * 维护规则：新增技能时，如果在 useGameEvents.ts 中通过
 * ABILITY_TRIGGERED 事件消费并设置 abilityMode / afterAttackAbilityMode，
 * 必须将其 ID 添加到此列表。
 */
const EVENT_STREAM_TRIGGERED_ABILITIES = [
  // afterMove（execute.ts afterMoveChoiceAbilities）
  'spirit_bond',
  'ancestral_bond',
  'structure_shift',
  'frost_axe',
  // afterAttack（triggerAbilities('afterAttack') → useGameEvents.ts 消费）
  'telekinesis',
  'high_telekinesis',
  'mind_transmission',
  'withdraw',
  // afterMove 自动效果（execute.ts 硬编码，无需玩家选择但有按钮入口）
  'inspire',
];

/**
 * 从 flowHooks 配置中提取所有 onPhaseStart/onPhaseEnd 自动触发的技能 ID
 */
function getPhaseTriggeredAbilities(): string[] {
  const ids: string[] = [];
  for (const phaseAbilities of Object.values(PHASE_START_ABILITIES)) {
    ids.push(...phaseAbilities);
  }
  for (const phaseAbilities of Object.values(PHASE_END_ABILITIES)) {
    ids.push(...phaseAbilities);
  }
  return ids;
}

describe('触发入口一致性审计', () => {
  const allAutoTriggered = [
    ...EVENT_STREAM_TRIGGERED_ABILITIES,
    ...getPhaseTriggeredAbilities(),
  ];
  // 去重
  const uniqueIds = [...new Set(allAutoTriggered)];

  it.each(uniqueIds)(
    '%s — EventStream 自动触发的技能 requiresButton 必须为 false',
    (abilityId) => {
      const def = abilityRegistry.get(abilityId);
      expect(def).toBeDefined();
      if (!def) return;

      const requiresButton = def.ui?.requiresButton ?? false;
      expect(
        requiresButton,
        `技能 "${abilityId}" 通过 EventStream 自动触发 UI 交互，` +
        `但 requiresButton=${requiresButton}。` +
        `双入口会导致撤回后可通过按钮重复激活。` +
        `应设为 requiresButton: false。`
      ).toBe(false);
    }
  );

  it('纯按钮技能（requiresButton: true）不在 EventStream 自动触发列表中', () => {
    const autoSet = new Set(uniqueIds);
    const violations: string[] = [];

    for (const def of abilityRegistry.getAll()) {
      if (def.ui?.requiresButton && autoSet.has(def.id)) {
        violations.push(def.id);
      }
    }

    expect(
      violations,
      `以下技能同时出现在 EventStream 自动触发列表和 requiresButton: true 中：${violations.join(', ')}`
    ).toEqual([]);
  });
});
