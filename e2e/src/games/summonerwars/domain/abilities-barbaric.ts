/**
 * 召唤师战争 - 炽原精灵技能定义
 * 
 * 核心机制：充能协同、力量/生命/速度强化、连续射击
 * 
 * 技能清单：
 * - ancestral_bond: 祖灵羁绊（召唤师 - 移动后充能目标并转移自身充能）
 * - power_up: 力量强化（蒙威尊者 - 每点充能+1战力，最多+5）
 * - trample: 践踏（蒙威尊者/犀牛 - 已在 frost 定义，共享）
 * - prepare: 预备（梅肯达·露/边境弓箭手 - 充能代替移动）
 * - rapid_fire: 连续射击（梅肯达·露/边境弓箭手 - 攻击后消耗1充能额外攻击）
 * - inspire: 启悟（凯鲁尊者 - 移动后将相邻友方单位充能）
 * - withdraw: 撤退（凯鲁尊者 - 攻击后消耗1充能/魔力推拉自身1-2格）
 * - intimidate: 威势（雌狮 - 攻击后充能，每回合一次）
 * - life_up: 生命强化（雌狮 - 每点充能+1生命，最多+5）
 * - speed_up: 速度强化（犀牛 - 每点充能+1移动，最多+5）
 * - gather_power: 聚能（祖灵法师 - 召唤后充能）
 * - spirit_bond: 祖灵交流（祖灵法师 - 移动后充能自身或消耗充能给友方）
 */

import type { AbilityDef } from './abilities';
import { getUnitAt, manhattanDistance, isForceMovePathClear, isInStraightLine } from './helpers';
import type { CellCoord } from './types';
import { abilityText } from './abilityTextHelper';

export const BARBARIC_ABILITIES: AbilityDef[] = [
  // ============================================================================
  // 召唤师 - 阿布亚·石
  // ============================================================================

  {
    id: 'ancestral_bond',
    name: abilityText('ancestral_bond', 'name'),
    description: abilityText('ancestral_bond', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_01',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'ancestral_bond_transfer' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      count: 1,
    },
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择目标友方单位' };
        }
        
        const abTarget = getUnitAt(ctx.core, targetPosition);
        if (!abTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (abTarget.owner !== ctx.playerId) {
          return { valid: false, error: '必须选择友方单位' };
        }
        
        if (abTarget.instanceId === ctx.sourceUnit.instanceId) {
          return { valid: false, error: '不能选择自己' };
        }
        
        const abDist = manhattanDistance(ctx.sourcePosition, targetPosition);
        if (abDist > 3) {
          return { valid: false, error: '目标必须在3格以内' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.ancestralBond',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },

  // ============================================================================
  // 冠军 - 蒙威尊者
  // ============================================================================

  {
    id: 'power_up',
    name: abilityText('power_up', 'name'),
    description: abilityText('power_up', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_02',
    trigger: 'onDamageCalculation',
    effects: [
      {
        type: 'modifyStrength',
        target: 'self',
        value: { type: 'attribute', target: 'self', attr: 'charge' },
        maxBonus: 5, // 规则：最多+5
      },
    ],
  },

  // 践踏已在 frost 定义，共享（trample）

  // ============================================================================
  // 冠军 - 梅肯达·露 / 边境弓箭手
  // ============================================================================

  {
    id: 'prepare',
    name: abilityText('prepare', 'name'),
    description: abilityText('prepare', 'description'),
    sfxKey: 'fantasy.elemental_sword_earthattack_01',
    trigger: 'activated',
    costsMoveAction: true,
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
    usesPerTurn: 1,
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        if (ctx.sourceUnit.hasMoved) {
          return { valid: false, error: '该单位本回合已移动' };
        }
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.prepare',
      buttonVariant: 'secondary',
      activationType: 'directExecute',
      useValidateForDisabled: true,
      extraCondition: ({ unit }) => !unit.hasMoved,
    },
  },

  {
    id: 'rapid_fire',
    name: abilityText('rapid_fire', 'name'),
    description: abilityText('rapid_fire', 'description'),
    sfxKey: 'fantasy.elemental_bow_fireattack_01',
    trigger: 'afterAttack',
    effects: [
      { type: 'custom', actionId: 'rapid_fire_extra_attack' },
    ],
    usesPerTurn: 1,
    validation: {
      customValidator: (ctx) => {
        // 检查充能是否足够
        if ((ctx.sourceUnit.boosts ?? 0) < 1) {
          return { valid: false, error: '没有充能可消耗' };
        }
        return { valid: true };
      },
    },
  },

  // ============================================================================
  // 冠军 - 凯鲁尊者
  // ============================================================================

  {
    id: 'inspire',
    name: abilityText('inspire', 'name'),
    description: abilityText('inspire', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_01',
    trigger: 'activated',
    effects: [
      { type: 'addCharge', target: 'adjacentAllies', value: 1 },
    ],
    validation: {
      requiredPhase: 'move',
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.inspire',
      buttonVariant: 'secondary',
      activationType: 'directExecute',
    },
  },

  {
    id: 'withdraw',
    name: abilityText('withdraw', 'name'),
    description: abilityText('withdraw', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_02',
    trigger: 'afterAttack',
    usesPerTurn: 1,
    effects: [
      { type: 'custom', actionId: 'withdraw_push_pull' },
    ],
    interactionChain: {
      steps: [
        { step: 'selectCostType', inputType: 'choice', producesField: 'costType' },
        { step: 'selectPosition', inputType: 'position', producesField: 'targetPosition' },
      ],
      payloadContract: {
        required: ['costType', 'targetPosition'],
      },
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const wdCostType = ctx.payload.costType as string | undefined;
        if (!wdCostType || (wdCostType !== 'charge' && wdCostType !== 'magic')) {
          return { valid: false, error: '必须选择消耗充能或魔力' };
        }
        
        if (wdCostType === 'charge' && (ctx.sourceUnit.boosts ?? 0) < 1) {
          return { valid: false, error: '没有充能可消耗' };
        }
        
        if (wdCostType === 'magic' && ctx.core.players[ctx.playerId].magic < 1) {
          return { valid: false, error: '魔力不足' };
        }
        
        const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择移动目标位置' };
        }
        
        const wdDist = manhattanDistance(ctx.sourcePosition, targetPosition);
        if (wdDist < 1 || wdDist > 2) {
          return { valid: false, error: '必须移动1-2格' };
        }
        
        // 强制移动必须沿直线
        if (!isInStraightLine(ctx.sourcePosition, targetPosition)) {
          return { valid: false, error: '强制移动必须沿直线方向' };
        }
        
        // 路径上每一格（含终点）都必须为空
        if (!isForceMovePathClear(ctx.core, ctx.sourcePosition, targetPosition)) {
          return { valid: false, error: '移动路径被阻挡' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.withdraw',
      buttonVariant: 'secondary',
      activationType: 'withdrawMode',
      quickCheck: ({ core, unit, playerId }) => {
        const hasCharge = (unit.boosts ?? 0) >= 1;
        const hasMagic = core.players[playerId].magic >= 1;
        return hasCharge || hasMagic;
      },
    },
  },

  // ============================================================================
  // 雌狮
  // ============================================================================

  {
    id: 'intimidate',
    name: abilityText('intimidate', 'name'),
    description: abilityText('intimidate', 'description'),
    sfxKey: 'fantasy.elemental_sword_earthattack_01',
    trigger: 'afterAttack',
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
    usesPerTurn: 1,
  },

  {
    id: 'life_up',
    name: abilityText('life_up', 'name'),
    description: abilityText('life_up', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_01',
    trigger: 'passive',
    effects: [
      {
        type: 'modifyLife',
        target: 'self',
        value: { type: 'attribute', target: 'self', attr: 'charge' },
        maxBonus: 5, // 规则：最多+5
      },
    ],
  },

  // ============================================================================
  // 犀牛
  // ============================================================================

  {
    id: 'speed_up',
    name: abilityText('speed_up', 'name'),
    description: abilityText('speed_up', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_02',
    trigger: 'onMove',
    effects: [
      { type: 'custom', actionId: 'speed_up_extra_move', params: { maxBonus: 5 } },
    ],
  },

  // ============================================================================
  // 祖灵法师
  // ============================================================================

  {
    id: 'gather_power',
    name: abilityText('gather_power', 'name'),
    description: abilityText('gather_power', 'description'),
    sfxKey: 'magic.rock.35.earth_magic_whoosh_01',
    trigger: 'onSummon',
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
  },

  {
    id: 'spirit_bond',
    name: abilityText('spirit_bond', 'name'),
    description: abilityText('spirit_bond', 'description'),
    sfxKey: 'fantasy.elemental_sword_earthattack_01',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'spirit_bond_action' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
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
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const sbChoice = ctx.payload.choice as string | undefined;
        if (!sbChoice || (sbChoice !== 'self' && sbChoice !== 'transfer')) {
          return { valid: false, error: '必须选择充能自身或转移充能' };
        }
        
        if (sbChoice === 'transfer') {
          if ((ctx.sourceUnit.boosts ?? 0) < 1) {
            return { valid: false, error: '没有充能可消耗' };
          }
          
          const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
          if (!targetPosition) {
            return { valid: false, error: '必须选择目标友方单位' };
          }
          
          const sbTarget = getUnitAt(ctx.core, targetPosition);
          if (!sbTarget) {
            return { valid: false, error: '目标位置没有单位' };
          }
          
          if (sbTarget.owner !== ctx.playerId) {
            return { valid: false, error: '必须选择友方单位' };
          }
          
          if (sbTarget.instanceId === ctx.sourceUnit.instanceId) {
            return { valid: false, error: '不能选择自己' };
          }
          
          const sbDist = manhattanDistance(ctx.sourcePosition, targetPosition);
          if (sbDist > 3) {
            return { valid: false, error: '目标必须在3格以内' };
          }
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.spiritBond',
      buttonVariant: 'secondary',
      activationStep: 'selectChoice',
    },
  },
];
