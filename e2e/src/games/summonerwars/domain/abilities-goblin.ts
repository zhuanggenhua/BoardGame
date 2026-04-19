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
import { getUnitAt, isCellEmpty, getPlayerUnits, hasUnitKilledThisTurn } from './helpers';
import { abilityText } from './abilityTextHelper';

export const GOBLIN_ABILITIES: AbilityDef[] = [
  // ============================================================================
  // 召唤师 - 思尼克斯
  // ============================================================================

  {
    id: 'vanish',
    name: abilityText('vanish', 'name'),
    description: abilityText('vanish', 'description'),
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
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择交换目标' };
        }
        
        const vanishTarget = getUnitAt(ctx.core, targetPosition);
        if (!vanishTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (vanishTarget.owner !== ctx.playerId) {
          return { valid: false, error: '必须选择友方单位' };
        }
        
        if (vanishTarget.card.cost !== 0) {
          return { valid: false, error: '只能与费用为0的友方单位交换' };
        }
        
        if (vanishTarget.instanceId === ctx.sourceUnit.instanceId) {
          return { valid: false, error: '不能与自己交换' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.vanish',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
      quickCheck: ({ core, unit, playerId }) =>
        getPlayerUnits(core, playerId).some(u => u.instanceId !== unit.instanceId && u.card.cost === 0),
    },
  },

  // ============================================================================
  // 冠军 - 布拉夫
  // ============================================================================

  {
    id: 'blood_rune',
    name: abilityText('blood_rune', 'name'),
    description: abilityText('blood_rune', 'description'),
    sfxKey: 'fantasy.dark_sword_attack_withblood_01',
    trigger: 'onPhaseStart',
    effects: [
      // 二选一：自伤1 或 花1魔力充能
      // 实际逻辑在 execute.ts 中处理，需要玩家选择
      { type: 'custom', actionId: 'blood_rune_choice' },
    ],
    requiresTargetSelection: true,
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const brChoice = ctx.payload.choice as string | undefined;
        if (!brChoice || (brChoice !== 'damage' && brChoice !== 'charge')) {
          return { valid: false, error: '必须选择自伤或充能' };
        }
        
        if (brChoice === 'charge' && ctx.core.players[ctx.playerId].magic < 1) {
          return { valid: false, error: '魔力不足' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.bloodRune',
      buttonVariant: 'secondary',
      activationStep: 'selectChoice',
    },
  },

  // power_boost 已在亡灵法师定义中注册，无需重复

  // ============================================================================
  // 冠军 - 史米革
  // ============================================================================

  {
    id: 'magic_addiction',
    name: abilityText('magic_addiction', 'name'),
    description: abilityText('magic_addiction', 'description'),
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
    name: abilityText('ferocity', 'name'),
    description: abilityText('ferocity', 'description'),
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
    name: abilityText('feed_beast', 'name'),
    description: abilityText('feed_beast', 'description'),
    sfxKey: 'fantasy.dark_sword_attack_withblood_03',
    trigger: 'onPhaseEnd',
    effects: [
      // 仅在本回合未击杀时才应进入确认流程；前置条件由 canActivateAbility/customValidator 双重门控
      { type: 'custom', actionId: 'feed_beast_check' },
    ],
    usesPerTurn: 1,
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isOwner', target: 'self', owner: 'self' },
      count: 1,
    },
    interactionChain: {
      steps: [
        { step: 'selectChoice', inputType: 'choice', producesField: 'choice' },
        { step: 'selectTarget', inputType: 'position', producesField: 'targetPosition', optional: true },
      ],
      payloadContract: {
        required: ['choice'],
        optional: ['targetPosition'],
      },
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        if (hasUnitKilledThisTurn(ctx.core, ctx.sourceUnit.instanceId)) {
          return { valid: false, error: '本回合已消灭单位，不能发动喂养巨食兽' };
        }

        const fbChoice = ctx.payload.choice as string | undefined;
        if (fbChoice === 'self_destroy') {
          return { valid: true };
        }
        if (fbChoice !== 'destroy_adjacent') {
          return { valid: false, error: '必须选择吞噬相邻友方或自毁' };
        }
        
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '吞噬相邻友方时必须选择目标单位' };
        }
        
        const fbTarget = getUnitAt(ctx.core, targetPosition);
        if (!fbTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (fbTarget.owner !== ctx.playerId) {
          return { valid: false, error: '必须选择友方单位' };
        }
        
        if (fbTarget.instanceId === ctx.sourceUnit.instanceId) {
          return { valid: false, error: '不能选择自己' };
        }
        
        const fbDist = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col);
        if (fbDist !== 1) {
          return { valid: false, error: '必须选择相邻的友方单位' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.feedBeast',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },

  // ============================================================================
  // 士兵 - 部落攀爬手
  // ============================================================================

  {
    id: 'climb',
    name: abilityText('climb', 'name'),
    description: abilityText('climb', 'description'),
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
    name: abilityText('charge', 'name'),
    description: abilityText('charge', 'description'),
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
    name: abilityText('immobile', 'name'),
    description: abilityText('immobile', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_02',
    trigger: 'passive',
    effects: [
      // 被动效果：在移动验证时检查
      { type: 'custom', actionId: 'immobile_check' },
    ],
  },

  {
    id: 'grab',
    name: abilityText('grab', 'name'),
    description: abilityText('grab', 'description'),
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
    validation: {
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择放置位置' };
        }
        
        if (!isCellEmpty(ctx.core, targetPosition)) {
          return { valid: false, error: '目标位置必须为空' };
        }
        
        return { valid: true };
      },
    },
  },
];
