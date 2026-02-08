/**
 * 召唤师战争 - 洞穴地精技能定义
 * 
 * 核心机制：低费海量、凶残额外攻击、冲锋直线移动
 * 
 * 技能清单（11个，power_boost 复用亡灵法师已有定义）：
 * - vanish: 神出鬼没（召唤师 - 攻击阶段与0费友方交换位置）
 * - blood_rune: 鲜血符文（布拉夫 - 攻击阶段开始自伤1或花1魔力充能）
 * - power_boost: 力量强化（布拉夫 - 复用亡灵法师定义）
 * - magic_addiction: 魔力成瘾（史米革 - 回合结束花1魔力或自毁）
 * - ferocity: 凶残（史米革/投石手 - 可作为额外攻击单位）
 * - feed_beast: 喂养巨食兽（巨食兽 - 攻击阶段结束未击杀则吃友方或自毁）
 * - climb: 攀爬（攀爬手 - 额外移动1格+穿过建筑）
 * - charge: 冲锋（野兽骑手 - 1-4格直线移动，3+格时+1战力）
 * - immobile: 禁足（抓附手 - 不能移动）
 * - grab: 抓附（抓附手 - 友方从相邻开始移动后可跟随）
 */

import type { AbilityDef } from './abilities';

export const GOBLIN_ABILITIES: AbilityDef[] = [
  // ============================================================================
  // 召唤师 - 思尼克斯
  // ============================================================================

  {
    id: 'vanish',
    name: '神出鬼没',
    description: '每回合一次，在你的攻击阶段，本单位可以和一个费用为0点的友方单位交换位置。',
    sfxKey: 'magic.rock.35.earth_magic_whoosh_01',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'vanish_swap' },
    ],
    usesPerTurn: 1,
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: {
        type: 'and',
        conditions: [
          { type: 'isOwner', target: 'self', owner: 'self' },
        ],
      },
      count: 1,
    },
  },

  // ============================================================================
  // 冠军 - 布拉夫
  // ============================================================================

  {
    id: 'blood_rune',
    name: '鲜血符文',
    description: '在你的攻击阶段开始时，对本单位造成1点伤害，或者消耗1点魔力以将本单位充能。',
    sfxKey: 'fantasy.dark_sword_attack_withblood_01',
    trigger: 'onPhaseStart',
    effects: [
      // 二选一：自伤1 或 花1魔力充能
      // 实际逻辑在 execute.ts 中处理，需要玩家选择
      { type: 'custom', actionId: 'blood_rune_choice' },
    ],
    requiresTargetSelection: true,
  },

  // power_boost 已在亡灵法师定义中注册，无需重复

  // ============================================================================
  // 冠军 - 史米革
  // ============================================================================

  {
    id: 'magic_addiction',
    name: '魔力成瘾',
    description: '在你的回合结束时，消耗1点魔力，或者弃除本单位。',
    sfxKey: 'magic.rock.35.earth_magic_whoosh_02',
    trigger: 'onTurnEnd',
    effects: [
      // 自动触发：有魔力则扣1，无魔力则自毁
      // 实际逻辑在 flowHooks 或 execute 的 END_PHASE 中处理
      { type: 'custom', actionId: 'magic_addiction_check' },
    ],
  },

  {
    id: 'ferocity',
    name: '凶残',
    description: '在你的攻击阶段，你可以选择本单位作为额外的攻击单位。',
    sfxKey: 'fantasy.dark_sword_attack_withblood_02',
    trigger: 'passive',
    effects: [
      // 被动效果：攻击阶段允许额外攻击（不计入3次限制）
      // 实际逻辑在 validate.ts 的攻击验证中检查
      { type: 'custom', actionId: 'ferocity_extra_attack' },
    ],
  },

  // ============================================================================
  // 冠军 - 巨食兽
  // ============================================================================

  {
    id: 'feed_beast',
    name: '喂养巨食兽',
    description: '在你的攻击阶段结束时，如果本单位在本回合没有消灭任何单位，则移除一个相邻友方单位，或者弃除本单位。',
    sfxKey: 'fantasy.dark_sword_attack_withblood_03',
    trigger: 'onPhaseEnd',
    effects: [
      // 攻击阶段结束时触发，需要检查本回合是否击杀
      // 实际逻辑在 execute.ts 的 END_PHASE 中处理
      { type: 'custom', actionId: 'feed_beast_check' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isOwner', target: 'self', owner: 'self' },
      count: 1,
    },
  },

  // ============================================================================
  // 士兵 - 部落攀爬手
  // ============================================================================

  {
    id: 'climb',
    name: '攀爬',
    description: '当本单位移动时，可以额外移动1个区格，并且可以穿过建筑。',
    sfxKey: 'fantasy.elemental_sword_earthattack_01',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: 1, canPassThrough: 'structures' },
    ],
  },

  // ============================================================================
  // 士兵 - 野兽骑手
  // ============================================================================

  {
    id: 'charge',
    name: '冲锋',
    description: '本单位可以移动1至4个直线视野区格，以代替正常移动。如果本单位移动了至少3个直线区格，则获得战力+1，直到回合结束。',
    sfxKey: 'magic.rock.35.earth_magic_whoosh_01',
    trigger: 'onMove',
    effects: [
      // 冲锋替代正常移动：1-4格直线
      // 实际逻辑在 helpers.ts 的移动验证中处理
      { type: 'custom', actionId: 'charge_line_move', params: { maxDistance: 4 } },
    ],
  },

  // ============================================================================
  // 士兵 - 部落抓附手
  // ============================================================================

  {
    id: 'immobile',
    name: '禁足',
    description: '本单位不能移动。',
    sfxKey: 'magic.rock.35.earth_magic_whoosh_02',
    trigger: 'passive',
    effects: [
      // 被动效果：在移动验证时检查
      { type: 'custom', actionId: 'immobile_check' },
    ],
  },

  {
    id: 'grab',
    name: '抓附',
    description: '当一个友方单位从本单位相邻的区格开始移动时，你可以在本次移动结束之后，将本单位放置到该单位相邻的区格。',
    sfxKey: 'fantasy.elemental_sword_earthattack_01',
    trigger: 'passive',
    effects: [
      // 被动效果：在友方移动后触发，需要 UI 交互
      { type: 'custom', actionId: 'grab_follow' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'position',
      count: 1,
    },
  },
];
