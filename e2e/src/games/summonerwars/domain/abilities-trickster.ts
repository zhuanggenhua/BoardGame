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
import { getUnitAt } from './helpers';
import { abilityText } from './abilityTextHelper';

export const TRICKSTER_ABILITIES: AbilityDef[] = [
  // ============================================================================
  // 召唤师 - 泰珂露
  // ============================================================================

  {
    id: 'mind_capture',
    name: abilityText('mind_capture', 'name'),
    description: abilityText('mind_capture', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_003',
    trigger: 'passive',
    effects: [
      // 实际逻辑在 execute.ts 的攻击流程中处理：
      // 检查伤害 >= 目标剩余生命 → 提示玩家选择 → 控制权转移
      // trigger 设为 passive 避免 afterAttack 重复触发
      { type: 'custom', actionId: 'mind_capture_check' },
    ],
  },

  {
    id: 'mind_capture_resolve',
    name: abilityText('mind_capture_resolve', 'name'),
    description: abilityText('mind_capture_resolve', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_003',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'mind_capture_resolve' },
    ],
    validation: {
      customValidator: (ctx) => {
        const choice = ctx.payload.choice as string | undefined;
        if (!choice || (choice !== 'control' && choice !== 'damage')) {
          return { valid: false, error: '必须选择控制或伤害' };
        }
        return { valid: true };
      },
    },
  },

  // ============================================================================
  // 冠军 - 葛拉克
  // ============================================================================

  {
    id: 'flying',
    name: abilityText('flying', 'name'),
    description: abilityText('flying', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: 1, canPassThrough: 'all' },
    ],
  },

  {
    id: 'aerial_strike',
    name: abilityText('aerial_strike', 'name'),
    description: abilityText('aerial_strike', 'description'),
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
    name: abilityText('high_telekinesis', 'name'),
    description: abilityText('high_telekinesis', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_002',
    trigger: 'afterAttack',
    usesPerTurn: 1,
    effects: [
      { type: 'pushPull', target: { unitId: 'selectedTarget' }, distance: 1, direction: 'choice' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isInRange', target: 'self', range: 3 },
      count: 1,
    },
    interactionChain: {
      steps: [
        { step: 'selectTarget', inputType: 'position', producesField: 'targetPosition' },
        { step: 'selectDirection', inputType: 'direction', producesField: 'newPosition' },
      ],
      payloadContract: {
        required: ['targetPosition', 'newPosition'],
      },
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择推拉目标' };
        }
        
        const dist = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col);
        if (dist > 3) {
          return { valid: false, error: '目标必须在3格以内' };
        }
        
        const tkTarget = getUnitAt(ctx.core, targetPosition);
        if (!tkTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (tkTarget.card.unitClass === 'summoner') {
          return { valid: false, error: '不能推拉召唤师' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.highTelekinesis',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },

  // 高阶念力（代替攻击）：独立的主动技能，消耗一次攻击行动
  {
    id: 'high_telekinesis_instead',
    name: abilityText('high_telekinesis_instead', 'name'),
    description: abilityText('high_telekinesis_instead', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_002',
    trigger: 'activated',
    costsAttackAction: true,
    effects: [
      { type: 'pushPull', target: { unitId: 'selectedTarget' }, distance: 1, direction: 'choice' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isInRange', target: 'self', range: 3 },
      count: 1,
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        // 检查单位是否已攻击
        if (ctx.sourceUnit.hasAttacked) {
          return { valid: false, error: '本单位已攻击，不能代替攻击使用' };
        }
        // 检查攻击次数
        const player = ctx.core.players[ctx.playerId];
        if (player.attackCount >= 3) {
          return { valid: false, error: '本回合攻击次数已用完' };
        }

        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择推拉目标' };
        }
        
        const dist = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col);
        if (dist > 3) {
          return { valid: false, error: '目标必须在3格以内' };
        }
        
        const tkTarget = getUnitAt(ctx.core, targetPosition);
        if (!tkTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (tkTarget.card.unitClass === 'summoner') {
          return { valid: false, error: '不能推拉召唤师' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.highTelekinesisInstead',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
      // 只在单位未攻击且攻击次数未满时显示
      extraCondition: (ctx) => !ctx.unit.hasAttacked && ctx.core.players[ctx.playerId].attackCount < 3,
    },
  },

  {
    id: 'stable',
    name: abilityText('stable', 'name'),
    description: abilityText('stable', 'description'),
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
    name: abilityText('mind_transmission', 'name'),
    description: abilityText('mind_transmission', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_004',
    trigger: 'afterAttack',
    usesPerTurn: 1,
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
    interactionChain: {
      steps: [
        { step: 'selectTarget', inputType: 'position', producesField: 'targetPosition' },
      ],
      payloadContract: {
        required: ['targetPosition'],
      },
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择额外攻击目标' };
        }
        
        const mtDist = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col);
        if (mtDist > 3) {
          return { valid: false, error: '目标必须在3格以内' };
        }
        
        const mtTarget = getUnitAt(ctx.core, targetPosition);
        if (!mtTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (mtTarget.owner !== ctx.playerId) {
          return { valid: false, error: '必须选择友方单位' };
        }
        
        if (mtTarget.card.unitClass !== 'common') {
          return { valid: false, error: '只能选择士兵' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.mindTransmission',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },

  // ============================================================================
  // 士兵 - 清风弓箭手
  // ============================================================================

  {
    id: 'swift',
    name: abilityText('swift', 'name'),
    description: abilityText('swift', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: 1 },
    ],
  },

  {
    id: 'ranged',
    name: abilityText('ranged', 'name'),
    description: abilityText('ranged', 'description'),
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
    name: abilityText('telekinesis', 'name'),
    description: abilityText('telekinesis', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_001',
    trigger: 'afterAttack',
    usesPerTurn: 1,
    effects: [
      { type: 'pushPull', target: { unitId: 'selectedTarget' }, distance: 1, direction: 'choice' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isInRange', target: 'self', range: 2 },
      count: 1,
    },
    interactionChain: {
      steps: [
        { step: 'selectTarget', inputType: 'position', producesField: 'targetPosition' },
        { step: 'selectDirection', inputType: 'direction', producesField: 'newPosition' },
      ],
      payloadContract: {
        required: ['targetPosition', 'newPosition'],
      },
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择推拉目标' };
        }
        
        const dist = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col);
        if (dist > 2) {
          return { valid: false, error: '目标必须在2格以内' };
        }
        
        const tkTarget = getUnitAt(ctx.core, targetPosition);
        if (!tkTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (tkTarget.card.unitClass === 'summoner') {
          return { valid: false, error: '不能推拉召唤师' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.telekinesis',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },

  // 念力（代替攻击）：独立的主动技能，消耗一次攻击行动
  {
    id: 'telekinesis_instead',
    name: abilityText('telekinesis_instead', 'name'),
    description: abilityText('telekinesis_instead', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_001',
    trigger: 'activated',
    costsAttackAction: true,
    effects: [
      { type: 'pushPull', target: { unitId: 'selectedTarget' }, distance: 1, direction: 'choice' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: { type: 'isInRange', target: 'self', range: 2 },
      count: 1,
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        // 检查单位是否已攻击
        if (ctx.sourceUnit.hasAttacked) {
          return { valid: false, error: '本单位已攻击，不能代替攻击使用' };
        }
        // 检查攻击次数
        const player = ctx.core.players[ctx.playerId];
        if (player.attackCount >= 3) {
          return { valid: false, error: '本回合攻击次数已用完' };
        }

        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须选择推拉目标' };
        }
        
        const dist = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col);
        if (dist > 2) {
          return { valid: false, error: '目标必须在2格以内' };
        }
        
        const tkTarget = getUnitAt(ctx.core, targetPosition);
        if (!tkTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (tkTarget.card.unitClass === 'summoner') {
          return { valid: false, error: '不能推拉召唤师' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.telekinesisInstead',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
      // 只在单位未攻击且攻击次数未满时显示
      extraCondition: (ctx) => !ctx.unit.hasAttacked && ctx.core.players[ctx.playerId].attackCount < 3,
    },
  },

  // ============================================================================
  // 士兵 - 心灵巫女
  // ============================================================================

  {
    id: 'illusion',
    name: abilityText('illusion', 'name'),
    description: abilityText('illusion', 'description'),
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
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const illusionTargetPos = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!illusionTargetPos) {
          return { valid: false, error: '必须选择目标士兵' };
        }
        
        const illusionTarget = getUnitAt(ctx.core, illusionTargetPos);
        if (!illusionTarget) {
          return { valid: false, error: '目标位置没有单位' };
        }
        
        if (illusionTarget.card.unitClass !== 'common') {
          return { valid: false, error: '只能选择士兵' };
        }
        
        const illusionDist = Math.abs(ctx.sourcePosition.row - illusionTargetPos.row) + Math.abs(ctx.sourcePosition.col - illusionTargetPos.col);
        if (illusionDist > 3 || illusionDist === 0) {
          return { valid: false, error: '目标必须在3格以内' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.illusion',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },

  // ============================================================================
  // 士兵 - 掷术师
  // ============================================================================

  {
    id: 'evasion',
    name: abilityText('evasion', 'name'),
    description: abilityText('evasion', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_006',
    trigger: 'onAdjacentEnemyAttack',
    effects: [
      { type: 'reduceDamage', target: 'target', value: 1, condition: 'onSpecialDice' },
    ],
  },

  {
    id: 'rebound',
    name: abilityText('rebound', 'name'),
    description: abilityText('rebound', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_007',
    trigger: 'onAdjacentEnemyLeave',
    effects: [
      { type: 'damage', target: 'target', value: 1 },
    ],
  },
];
