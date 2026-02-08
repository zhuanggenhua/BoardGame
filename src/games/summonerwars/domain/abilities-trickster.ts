/**
 * 召唤师战争 - 欺心巫族技能定义
 * 
 * 核心机制：念力推拉、飞行、心灵控制
 * 
 * 技能清单（12个）：
 * - mind_capture: 心灵捕获（召唤师 - 攻击时控制目标代替伤害）
 * - flying: 飞行（葛拉克 - 额外移动+穿越）
 * - aerial_strike: 浮空术（葛拉克 - 给附近士兵飞行）
 * - high_telekinesis: 高阶念力（卡拉 - 攻击后推拉3格内目标）
 * - stable: 稳固（卡拉 - 免疫推拉）
 * - mind_transmission: 读心传念（古尔壮 - 攻击后给友方士兵额外攻击）
 * - swift: 迅捷（清风弓箭手 - 额外移动1格）
 * - ranged: 远射（清风弓箭手 - 攻击范围4格）
 * - telekinesis: 念力（清风法师 - 攻击后推拉2格内目标）
 * - illusion: 幻化（心灵巫女 - 复制附近士兵技能）
 * - evasion: 迷魂（掷术师 - 相邻敌方攻击掷出✦时减伤1）
 * - rebound: 缠斗（掷术师 - 相邻敌方离开时造成1伤害）
 */

import type { AbilityDef } from './abilities';

export const TRICKSTER_ABILITIES: AbilityDef[] = [
  // ============================================================================
  // 召唤师 - 泰珂露
  // ============================================================================

  {
    id: 'mind_capture',
    name: '心灵捕获',
    description: '当本单位攻击一个敌方单位时，如果造成的伤害足够消灭目标，则你可以忽略本次伤害并且获得目标的控制权，以代替造成伤害。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_003',
    trigger: 'passive',
    effects: [
      // 实际逻辑在 execute.ts 的攻击流程中处理：
      // 检查伤害 >= 目标剩余生命 → 提示玩家选择 → 控制权转移
      // trigger 设为 passive 避免 afterAttack 重复触发
      { type: 'custom', actionId: 'mind_capture_check' },
    ],
  },

  // ============================================================================
  // 冠军 - 葛拉克
  // ============================================================================

  {
    id: 'flying',
    name: '飞行',
    description: '当本单位移动时，可以额外移动1个区格，并且可以穿过其它卡牌。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: 1, canPassThrough: 'all' },
    ],
  },

  {
    id: 'aerial_strike',
    name: '浮空术',
    description: '本单位2个区格以内开始移动的友方士兵，在本次移动时获得飞行技能。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_002',
    trigger: 'passive',
    effects: [
      // 被动光环效果：在移动验证时检查
      // 2格内友方士兵获得飞行（额外移动+穿越）
      { type: 'custom', actionId: 'aerial_strike_aura' },
    ],
  },

  // ============================================================================
  // 冠军 - 卡拉
  // ============================================================================

  {
    id: 'high_telekinesis',
    name: '高阶念力',
    description: '在本单位攻击之后，或代替本单位的攻击，可以指定其最多3个区格以内的一个士兵或英雄为目标，将目标推拉1个区格。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_002',
    trigger: 'afterAttack',
    effects: [
      { type: 'pushPull', target: { unitId: 'selectedTarget' }, distance: 1, direction: 'choice' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isInRange', target: 'self', range: 3 },
      count: 1,
    },
  },

  {
    id: 'stable',
    name: '稳固',
    description: '本单位不能被推拉。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_003',
    trigger: 'passive',
    effects: [
      // 被动标记：在推拉解析时检查目标是否有 stable 技能
      { type: 'custom', actionId: 'stable_immunity' },
    ],
  },

  // ============================================================================
  // 冠军 - 古尔壮
  // ============================================================================

  {
    id: 'mind_transmission',
    name: '读心传念',
    description: '在本单位攻击一张敌方卡牌之后，可以指定本单位3个区格以内的一个友方士兵为目标，目标进行一次额外的攻击。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_004',
    trigger: 'afterAttack',
    effects: [
      { type: 'grantExtraAttack', target: { unitId: 'selectedTarget' } },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: {
        type: 'and',
        conditions: [
          { type: 'isOwner', target: 'self', owner: 'self' },
          { type: 'isInRange', target: 'self', range: 3 },
          { type: 'isUnitType', target: 'self', unitType: 'common' },
        ],
      },
      count: 1,
    },
  },

  // ============================================================================
  // 士兵 - 清风弓箭手
  // ============================================================================

  {
    id: 'swift',
    name: '迅捷',
    description: '当本单位移动时，可以额外移动1个区格。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: 1 },
    ],
  },

  {
    id: 'ranged',
    name: '远射',
    description: '本单位可以攻击至多4个直线区格的目标。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_002',
    trigger: 'passive',
    effects: [
      // 被动效果：在攻击范围计算时检查
      // 将 attackRange 从 3 扩展到 4
      { type: 'custom', actionId: 'extended_range', params: { range: 4 } },
    ],
  },

  // ============================================================================
  // 士兵 - 清风法师
  // ============================================================================

  {
    id: 'telekinesis',
    name: '念力',
    description: '在本单位攻击之后，或代替本单位的攻击，可以指定其2个区格以内的一个士兵或英雄为目标，将目标推拉1个区格。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_001',
    trigger: 'afterAttack',
    effects: [
      { type: 'pushPull', target: { unitId: 'selectedTarget' }, distance: 1, direction: 'choice' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isInRange', target: 'self', range: 2 },
      count: 1,
    },
  },

  // ============================================================================
  // 士兵 - 心灵巫女
  // ============================================================================

  {
    id: 'illusion',
    name: '幻化',
    description: '在你的移动阶段开始时，可以指定本单位3个区格以内的一个士兵为目标。本单位获得目标的所有技能，直到回合结束。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_005',
    trigger: 'onPhaseStart',
    effects: [
      // 在移动阶段开始时触发，需要玩家选择目标士兵
      { type: 'custom', actionId: 'illusion_copy', params: { phase: 'move' } },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: {
        type: 'and',
        conditions: [
          { type: 'isInRange', target: 'self', range: 3 },
          { type: 'isUnitType', target: 'self', unitType: 'common' },
        ],
      },
      count: 1,
    },
  },

  // ============================================================================
  // 士兵 - 掷术师
  // ============================================================================

  {
    id: 'evasion',
    name: '迷魂',
    description: '当一个相邻敌方单位攻击时，如果掷出一个或更多✦，则本次攻击造成的伤害减少1点。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_006',
    trigger: 'onAdjacentEnemyAttack',
    effects: [
      { type: 'reduceDamage', target: 'target', value: 1, condition: 'onSpecialDice' },
    ],
  },

  {
    id: 'rebound',
    name: '缠斗',
    description: '每当一个相邻敌方单位因为移动或被推拉而远离本单位时，立刻对该单位造成1点伤害。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_007',
    trigger: 'onAdjacentEnemyLeave',
    effects: [
      { type: 'damage', target: 'target', value: 1 },
    ],
  },
];
