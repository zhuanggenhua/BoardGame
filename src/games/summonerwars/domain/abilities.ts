/**
 * 召唤师战争 - 技能系统
 * 
 * 基于 GAS 风格设计，使用事件驱动的技能效果解析
 * 
 * 设计原则：
 * 1. 技能定义为数据（AbilityDef），不包含逻辑
 * 2. 技能效果通过事件触发和解析
 * 3. 支持多种触发时机（攻击前/后、被消灭时、回合开始/结束等）
 * 4. 支持条件判断和目标选择
 */

import type { CellCoord } from './types';

// ============================================================================
// 技能触发时机
// ============================================================================

/**
 * 技能触发时机
 */
export type AbilityTrigger =
  | 'onSummon'           // 召唤时（火祀召唤）
  | 'beforeAttack'       // 攻击前（吸取生命）
  | 'afterAttack'        // 攻击后（读心传念、念力、高阶念力）
  | 'onDamageDealt'      // 造成伤害后
  | 'onKill'             // 消灭敌方单位后（感染、灵魂转移、心灵捕获）
  | 'onDeath'            // 被消灭时（献祭）
  | 'onUnitDestroyed'    // 任意单位被消灭时（血腥狂怒）
  | 'onTurnStart'        // 回合开始时
  | 'onTurnEnd'          // 回合结束时（血腥狂怒充能衰减）
  | 'onPhaseStart'       // 阶段开始时（幻化）
  | 'onPhaseEnd'         // 阶段结束时
  | 'activated'          // 主动激活（复活死灵）
  | 'passive'            // 被动效果（暴怒）
  | 'onDamageCalculation' // 伤害计算时（暴怒加成）
  | 'onMove'             // 移动时（飞行、迅捷等移动增强）
  | 'onAdjacentEnemyAttack' // 相邻敌方攻击时（迷魂减伤）
  | 'onAdjacentEnemyLeave'; // 相邻敌方离开时（缠斗）

// ============================================================================
// 技能效果类型
// ============================================================================

/**
 * 目标引用
 */
export type TargetRef =
  | 'self'              // 技能拥有者
  | 'attacker'          // 攻击者
  | 'target'            // 攻击目标
  | 'killer'            // 击杀者
  | 'victim'            // 被击杀者
  | 'owner'             // 单位所有者（玩家）
  | 'opponent'          // 对手
  | 'adjacentEnemies'   // 相邻敌方单位
  | 'adjacentAllies'    // 相邻友方单位
  | 'allAllies'         // 所有友方单位
  | 'allEnemies'        // 所有敌方单位
  | { position: CellCoord }  // 指定位置
  | { unitId: string };      // 指定单位

/**
 * 效果操作
 */
export type AbilityEffect =
  // 伤害/治疗
  | { type: 'damage'; target: TargetRef; value: number | Expression }
  | { type: 'heal'; target: TargetRef; value: number | Expression }
  // 属性修改
  | { type: 'modifyStrength'; target: TargetRef; value: number | Expression }
  | { type: 'modifyLife'; target: TargetRef; value: number | Expression }
  // 充能/Token
  | { type: 'addCharge'; target: TargetRef; value: number }
  | { type: 'removeCharge'; target: TargetRef; value: number }
  | { type: 'setCharge'; target: TargetRef; value: number }
  // 单位操作
  | { type: 'destroyUnit'; target: TargetRef }
  | { type: 'moveUnit'; target: TargetRef; to: CellCoord | 'victimPosition' }
  | { type: 'summonFromDiscard'; cardType: 'undead' | 'plagueZombie'; position: TargetRef }
  | { type: 'replaceUnit'; target: TargetRef; with: TargetRef }
  // 魔力操作
  | { type: 'modifyMagic'; target: 'owner' | 'opponent'; value: number }
  | { type: 'preventMagicGain'; target: 'owner' | 'opponent' }
  // 攻击修改
  | { type: 'setUnblockable' }
  | { type: 'doubleStrength'; target: TargetRef }
  // 推拉（欺心巫族核心机制）
  | { type: 'pushPull'; target: TargetRef; distance: number; direction: 'push' | 'pull' | 'choice' }
  // 移动增强
  | { type: 'extraMove'; target: TargetRef; value: number; canPassThrough?: 'units' | 'structures' | 'all' }
  // 控制权转移（心灵捕获）
  | { type: 'takeControl'; target: TargetRef; duration?: 'permanent' | 'untilEndOfTurn' }
  // 减伤
  | { type: 'reduceDamage'; target: TargetRef; value: number; condition?: 'onSpecialDice' }
  // 额外攻击（读心传念）
  | { type: 'grantExtraAttack'; target: TargetRef }
  // 自定义
  | { type: 'custom'; actionId: string; params?: Record<string, unknown> };

/**
 * 表达式（用于动态计算）
 */
export type Expression =
  | number
  | { type: 'attribute'; target: TargetRef; attr: 'damage' | 'life' | 'strength' | 'charge' }
  | { type: 'multiply'; left: Expression; right: Expression }
  | { type: 'add'; left: Expression; right: Expression };

/**
 * 条件
 */
export type AbilityCondition =
  | { type: 'always' }
  | { type: 'hasCharge'; target: TargetRef; minStacks?: number }
  | { type: 'isUnitType'; target: TargetRef; unitType: 'undead' | 'summoner' | 'champion' | 'common' }
  | { type: 'isInRange'; target: TargetRef; range: number }
  | { type: 'isOwner'; target: TargetRef; owner: 'self' | 'opponent' }
  | { type: 'hasCardInDiscard'; cardType: string }
  | { type: 'and'; conditions: AbilityCondition[] }
  | { type: 'or'; conditions: AbilityCondition[] }
  | { type: 'not'; condition: AbilityCondition };

// ============================================================================
// 技能定义
// ============================================================================

/**
 * 技能定义
 */
export interface AbilityDef {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述文本 */
  description: string;
  /** 触发时机 */
  trigger: AbilityTrigger;
  /** 触发条件（可选） */
  condition?: AbilityCondition;
  /** 效果列表 */
  effects: AbilityEffect[];
  /** 是否需要玩家选择目标 */
  requiresTargetSelection?: boolean;
  /** 目标选择配置 */
  targetSelection?: {
    type: 'unit' | 'position' | 'card';
    filter?: AbilityCondition;
    count?: number;
  };
  /** 消耗（如自伤） */
  cost?: {
    selfDamage?: number;
    magic?: number;
    destroyAlly?: boolean;
  };
  /** 每回合使用次数限制 */
  usesPerTurn?: number;
  /** 音效 key */
  sfxKey?: string;
}

// ============================================================================
// 技能注册表
// ============================================================================

/**
 * 技能注册表
 */
class AbilityRegistry {
  private definitions = new Map<string, AbilityDef>();

  register(def: AbilityDef): void {
    this.definitions.set(def.id, def);
  }

  registerAll(defs: AbilityDef[]): void {
    defs.forEach(def => this.register(def));
  }

  get(id: string): AbilityDef | undefined {
    return this.definitions.get(id);
  }

  getAll(): AbilityDef[] {
    return Array.from(this.definitions.values());
  }

  getByTrigger(trigger: AbilityTrigger): AbilityDef[] {
    return this.getAll().filter(def => def.trigger === trigger);
  }
}

export const abilityRegistry = new AbilityRegistry();

// ============================================================================
// 亡灵法师阵营技能定义
// ============================================================================

/**
 * 亡灵法师阵营技能
 */
export const NECROMANCER_ABILITIES: AbilityDef[] = [
  // 召唤师 - 复活死灵
  {
    id: 'revive_undead',
    name: '复活死灵',
    description: '每回合一次，在你的召唤阶段，你可以对本单位造成2点伤害，以从你的弃牌堆中拿取一张亡灵单位并且放置到本单位相邻的区格。',
    sfxKey: 'magic.dark.29.dark_resurrection',
    trigger: 'activated',
    condition: {
      type: 'and',
      conditions: [
        { type: 'hasCardInDiscard', cardType: 'undead' },
      ],
    },
    effects: [
      { type: 'damage', target: 'self', value: 2 },
      { type: 'summonFromDiscard', cardType: 'undead', position: 'self' },
    ],
    cost: { selfDamage: 2 },
    usesPerTurn: 1,
    requiresTargetSelection: true,
    targetSelection: {
      type: 'card',
      filter: { type: 'isUnitType', target: 'self', unitType: 'undead' },
    },
  },

  // 伊路特-巴尔 - 火祀召唤
  {
    id: 'fire_sacrifice_summon',
    name: '火祀召唤',
    description: '当你为召唤本单位支付费用时，还必须消灭一个友方单位，并且使用本单位替换被消灭的单位。',
    sfxKey: 'fantasy.elemental_sword_fireattack_01',
    trigger: 'onSummon',
    effects: [
      { type: 'destroyUnit', target: { unitId: 'selectedAlly' } },
      { type: 'moveUnit', target: 'self', to: 'victimPosition' },
    ],
    cost: { destroyAlly: true },
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isOwner', target: 'self', owner: 'self' },
      count: 1,
    },
  },

  // 德拉戈斯 - 吸取生命
  {
    id: 'life_drain',
    name: '吸取生命',
    description: '在本单位攻击之前，可以消灭其2个区格以内的一个友方单位。如果你这样做，则本次攻击战力翻倍。',
    sfxKey: 'fantasy.dark_sword_steallife',
    trigger: 'beforeAttack',
    condition: { type: 'always' },
    effects: [
      { type: 'destroyUnit', target: { unitId: 'selectedAlly' } },
      { type: 'doubleStrength', target: 'self' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: {
        type: 'and',
        conditions: [
          { type: 'isOwner', target: 'self', owner: 'self' },
          { type: 'isInRange', target: 'self', range: 2 },
        ],
      },
      count: 1,
    },
  },

  // 古尔-达斯 - 暴怒
  {
    id: 'rage',
    name: '暴怒',
    description: '本单位每有1点伤害，则获得战力+1。',
    sfxKey: 'magic.dark.32.dark_spell_01',
    trigger: 'onDamageCalculation',
    effects: [
      { 
        type: 'modifyStrength', 
        target: 'self', 
        value: { type: 'attribute', target: 'self', attr: 'damage' },
      },
    ],
  },

  // 亡灵战士 - 血腥狂怒
  {
    id: 'blood_rage',
    name: '血腥狂怒',
    description: '每当一个单位在你的回合中被消灭时，将本单位充能。在你的回合结束时，从本单位上移除2点充能。',
    sfxKey: 'fantasy.dark_sword_attack_withblood_01',
    trigger: 'onUnitDestroyed',
    condition: { type: 'always' }, // 任意单位被消灭
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
  },

  // 亡灵战士 - 力量强化（被动）
  {
    id: 'power_boost',
    name: '力量强化',
    description: '本单位每有1点充能，则获得战力+1，至多为+5。',
    sfxKey: 'magic.dark.32.dark_spell_02',
    trigger: 'onDamageCalculation',
    effects: [
      {
        type: 'modifyStrength',
        target: 'self',
        value: {
          type: 'attribute',
          target: 'self',
          attr: 'charge',
        },
      },
    ],
  },

  // 亡灵战士 - 回合结束充能衰减
  {
    id: 'blood_rage_decay',
    name: '血腥狂怒衰减',
    description: '在你的回合结束时，从本单位上移除2点充能。',
    sfxKey: 'fantasy.dark_sword_attack_withblood_02',
    trigger: 'onTurnEnd',
    condition: { type: 'hasCharge', target: 'self', minStacks: 1 },
    effects: [
      { type: 'removeCharge', target: 'self', value: 2 },
    ],
  },

  // 地狱火教徒 - 献祭
  {
    id: 'sacrifice',
    name: '献祭',
    description: '在本单位被消灭之后，对其相邻的每个敌方单位造成1点伤害。',
    sfxKey: 'fantasy.elemental_sword_fireattack_02',
    trigger: 'onDeath',
    effects: [
      { type: 'damage', target: 'adjacentEnemies', value: 1 },
    ],
  },

  // 亡灵疫病体 - 无魂
  {
    id: 'soulless',
    name: '无魂',
    description: '当本单位消灭敌方单位时，你不会获得魔力。',
    sfxKey: 'magic.dark.32.dark_spell_03',
    trigger: 'onKill',
    effects: [
      { type: 'preventMagicGain', target: 'owner' },
    ],
  },

  // 亡灵疫病体 - 感染
  {
    id: 'infection',
    name: '感染',
    description: '在本单位消灭一个单位之后，你可以使用你的弃牌堆中一个疫病体单位替换被消灭的单位。',
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001',
    trigger: 'onKill',
    condition: { type: 'hasCardInDiscard', cardType: 'plagueZombie' },
    effects: [
      { type: 'summonFromDiscard', cardType: 'plagueZombie', position: 'victim' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'card',
      filter: { type: 'isUnitType', target: 'self', unitType: 'common' },
    },
  },

  // 亡灵弓箭手 - 灵魂转移
  {
    id: 'soul_transfer',
    name: '灵魂转移',
    description: '当本单位消灭3个区格以内的一个单位后，你可使用本单位替换被消灭的单位。',
    sfxKey: 'magic.general.spells_variations_vol_2.unholy_echo.magevil_unholy_echo_01_krst_none',
    trigger: 'onKill',
    condition: { type: 'isInRange', target: 'victim', range: 3 },
    effects: [
      // 改为请求事件，由 UI 确认后执行
      { type: 'custom', actionId: 'soul_transfer_request' },
    ],
    requiresTargetSelection: false, // 可选触发，UI 确认
  },
];

// 注册所有技能
abilityRegistry.registerAll(NECROMANCER_ABILITIES);

// 注册欺心巫族技能
import { TRICKSTER_ABILITIES } from './abilities-trickster';
abilityRegistry.registerAll(TRICKSTER_ABILITIES);

// 注册洞穴地精技能
import { GOBLIN_ABILITIES } from './abilities-goblin';
abilityRegistry.registerAll(GOBLIN_ABILITIES);

// 注册先锋军团技能
import { PALADIN_ABILITIES } from './abilities-paladin';
abilityRegistry.registerAll(PALADIN_ABILITIES);

// 注册极地矮人技能
import { FROST_ABILITIES } from './abilities-frost';
abilityRegistry.registerAll(FROST_ABILITIES);

// 注册炽原精灵技能
import { BARBARIC_ABILITIES } from './abilities-barbaric';
abilityRegistry.registerAll(BARBARIC_ABILITIES);
