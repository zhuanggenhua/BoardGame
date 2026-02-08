/**
 * 召唤师战争 - 极地矮人技能定义
 * 
 * 核心机制：建筑协同、冰霜增强、结构操控
 * 
 * 技能清单：
 * - structure_shift: 结构变换（召唤师 - 移动后推拉3格内友方建筑1格）
 * - cold_snap: 寒流（奥莱格 - 3格内友方建筑+1生命，被动光环）
 * - imposing: 威势（贾穆德 - 攻击后充能，每回合一次）
 * - ice_shards: 寒冰碎屑（贾穆德 - 建造阶段结束消耗充能对建筑相邻敌方造成1伤）
 * - frost_bolt: 冰霜飞弹（冰霜法师 - 相邻每有一个友方建筑+1战力）
 * - greater_frost_bolt: 高阶冰霜飞弹（纳蒂亚娜 - 2格内每有一个友方建筑+1战力）
 * - trample: 践踏（熊骑兵 - 穿过士兵并造成1伤）
 * - frost_axe: 冰霜战斧（寒冰锻造师 - 移动后充能或消耗充能附加到友方士兵）
 * - living_gate: 活体传送门（寒冰魔像 - 视为传送门）
 * - mobile_structure: 活体结构（寒冰魔像 - 视为建筑但可移动）
 * - slow: 缓慢（寒冰魔像 - 减少移动1格）
 */

import type { AbilityDef } from './abilities';

export const FROST_ABILITIES: AbilityDef[] = [
  // ============================================================================
  // 召唤师 - 丝瓦拉
  // ============================================================================

  {
    id: 'structure_shift',
    name: '结构变换',
    description: '在本单位移动之后，可以指定其3个区格以内一个友方建筑为目标。将目标推拉1个区格。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v1',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'structure_shift_push_pull' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'position',
      count: 1,
    },
  },

  // ============================================================================
  // 冠军 - 奥莱格
  // ============================================================================

  {
    id: 'cold_snap',
    name: '寒流',
    description: '本单位3个区格以内的友方建筑获得生命+1。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v2',
    trigger: 'passive',
    effects: [
      { type: 'custom', actionId: 'cold_snap_aura' },
    ],
  },

  // ============================================================================
  // 冠军 - 贾穆德
  // ============================================================================

  {
    id: 'imposing',
    name: '威势',
    description: '每回合一次，在本单位攻击一个敌方单位之后，将本单位充能。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v3',
    trigger: 'afterAttack',
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
    usesPerTurn: 1,
  },

  {
    id: 'ice_shards',
    name: '寒冰碎屑',
    description: '在你的建造阶段结束时，你可以消耗1点充能，以对每个和你所控制建筑相邻的敌方单位造成1点伤害。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v3',
    trigger: 'onPhaseEnd',
    effects: [
      { type: 'custom', actionId: 'ice_shards_damage' },
    ],
    cost: {
      magic: 0,
    },
  },

  // ============================================================================
  // 冠军 - 纳蒂亚娜
  // ============================================================================

  {
    id: 'greater_frost_bolt',
    name: '高阶冰霜飞弹',
    description: '本单位2个区格以内每有一个友方建筑，则获得战力+1。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v2',
    trigger: 'onDamageCalculation',
    effects: [
      { type: 'custom', actionId: 'greater_frost_bolt_boost' },
    ],
  },

  // ============================================================================
  // 士兵 - 冰霜法师
  // ============================================================================

  {
    id: 'frost_bolt',
    name: '冰霜飞弹',
    description: '本单位相邻每有一个友方建筑，则获得战力+1。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v1',
    trigger: 'onDamageCalculation',
    effects: [
      { type: 'custom', actionId: 'frost_bolt_boost' },
    ],
  },

  // ============================================================================
  // 士兵 - 熊骑兵（践踏 - 共享技能）
  // ============================================================================

  {
    id: 'trample',
    name: '践踏',
    description: '当本单位移动时，可以穿过士兵。在本单位移动之后，对每个被穿过的士兵造成1点伤害。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v2',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: 0, canPassThrough: 'units' },
    ],
  },

  // ============================================================================
  // 士兵 - 寒冰锻造师
  // ============================================================================

  {
    id: 'frost_axe',
    name: '冰霜战斧',
    description: '在本单位移动之后，你可以将其充能，或者消耗其所有充能（至少1点）以将其放置到3个区格以内一个友方士兵的底层。当该士兵攻击时，⚔️=‼️。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v3',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'frost_axe_action' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      count: 1,
    },
  },

  // ============================================================================
  // 士兵 - 寒冰魔像
  // ============================================================================

  {
    id: 'living_gate',
    name: '活体传送门',
    description: '本卡牌视为传送门。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v1',
    trigger: 'passive',
    effects: [],
  },

  {
    id: 'mobile_structure',
    name: '活体结构',
    description: '本卡牌视为建筑，但可以移动。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v2',
    trigger: 'passive',
    effects: [],
  },

  {
    id: 'slow',
    name: '缓慢',
    description: '本单位必须减少移动1个区格。',
    sfxKey: 'fantasy.elemental_sword_iceattack_v3',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: -1 },
    ],
  },
];
