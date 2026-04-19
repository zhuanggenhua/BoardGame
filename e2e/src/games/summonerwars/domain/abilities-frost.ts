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
import { getStructureAt, getUnitAt, getUnitAbilities, BOARD_ROWS, BOARD_COLS, isValidCoord } from './helpers';
import { abilityText } from './abilityTextHelper';
import type { SummonerWarsCore, PlayerId, CellCoord } from './types';

/** 检查棋盘上是否存在友方建筑且其相邻有敌方单位 */
function hasEnemyAdjacentToAllyStructure(core: SummonerWarsCore, playerId: PlayerId): boolean {
  const adjDirs: CellCoord[] = [
    { row: -1, col: 0 }, { row: 1, col: 0 },
    { row: 0, col: -1 }, { row: 0, col: 1 },
  ];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const structure = getStructureAt(core, { row: r, col: c });
      const structureUnit = getUnitAt(core, { row: r, col: c });
      const isAlly = (structure && structure.owner === playerId)
        || (structureUnit && structureUnit.owner === playerId
          && getUnitAbilities(structureUnit, core).includes('mobile_structure'));
      if (!isAlly) continue;
      for (const d of adjDirs) {
        const adjPos = { row: r + d.row, col: c + d.col };
        if (!isValidCoord(adjPos)) continue;
        const adjUnit = getUnitAt(core, adjPos);
        if (adjUnit && adjUnit.owner !== playerId) return true;
      }
    }
  }
  return false;
}

export const FROST_ABILITIES: AbilityDef[] = [
  // ============================================================================
  // 召唤师 - 丝瓦拉
  // ============================================================================

  {
    id: 'structure_shift',
    name: abilityText('structure_shift', 'name'),
    description: abilityText('structure_shift', 'description'),
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
    interactionChain: {
      steps: [
        { step: 'selectBuilding', inputType: 'position', producesField: 'targetPosition' },
        { step: 'selectDirection', inputType: 'direction', producesField: 'newPosition' },
      ],
      payloadContract: {
        required: ['targetPosition', 'newPosition'],
      },
    },
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const ssTargetPos = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!ssTargetPos) {
          return { valid: false, error: '必须选择目标建筑' };
        }
        
        // 检查真实建筑或活体结构单位（如寒冰魔像）
        const ssStructure = getStructureAt(ctx.core, ssTargetPos);
        const ssUnit = getUnitAt(ctx.core, ssTargetPos);
        const isAllyStructure = (ssStructure && ssStructure.owner === ctx.playerId)
          || (ssUnit && ssUnit.owner === ctx.playerId
            && getUnitAbilities(ssUnit, ctx.core).includes('mobile_structure'));
        if (!isAllyStructure) {
          return { valid: false, error: '必须选择友方建筑' };
        }
        
        const ssDist = Math.abs(ctx.sourcePosition.row - ssTargetPos.row) + Math.abs(ctx.sourcePosition.col - ssTargetPos.col);
        if (ssDist > 3) {
          return { valid: false, error: '目标必须在3格以内' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.structureShift',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
    },
  },

  // ============================================================================
  // 冠军 - 奥莱格
  // ============================================================================

  {
    id: 'cold_snap',
    name: abilityText('cold_snap', 'name'),
    description: abilityText('cold_snap', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v2',
    trigger: 'passive',
    effects: [
      { type: 'auraStructureLife', range: 3, value: 1 },
    ],
  },

  // ============================================================================
  // 冠军 - 贾穆德
  // ============================================================================

  {
    id: 'imposing',
    name: abilityText('imposing', 'name'),
    description: abilityText('imposing', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v3',
    trigger: 'afterAttack',
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
    usesPerTurn: 1,
  },

  {
    id: 'ice_shards',
    name: abilityText('ice_shards', 'name'),
    description: abilityText('ice_shards', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v3',
    trigger: 'onPhaseEnd',
    effects: [
      { type: 'custom', actionId: 'ice_shards_damage' },
    ],
    cost: {
      magic: 0,
    },
    validation: {
      requiredPhase: 'build',
      customValidator: (ctx) => {
        if ((ctx.sourceUnit.boosts ?? 0) < 1) {
          return { valid: false, error: '没有充能可消耗' };
        }
        // 检查是否存在友方建筑旁有敌方单位
        if (!hasEnemyAdjacentToAllyStructure(ctx.core, ctx.playerId)) {
          return { valid: false, error: '没有友方建筑相邻的敌方单位' };
        }
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'build',
      buttonLabel: 'abilityButtons.iceShards',
      buttonVariant: 'secondary',
      activationType: 'directExecute',
      quickCheck: ({ unit, core, playerId }) =>
        (unit.boosts ?? 0) >= 1 && hasEnemyAdjacentToAllyStructure(core, playerId),
    },
  },

  // ============================================================================
  // 冠军 - 纳蒂亚娜
  // ============================================================================

  {
    id: 'greater_frost_bolt',
    name: abilityText('greater_frost_bolt', 'name'),
    description: abilityText('greater_frost_bolt', 'description'),
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
    name: abilityText('frost_bolt', 'name'),
    description: abilityText('frost_bolt', 'description'),
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
    name: abilityText('trample', 'name'),
    description: abilityText('trample', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v2',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: 0, canPassThrough: 'units', damageOnPassThrough: 1 },
    ],
  },

  // ============================================================================
  // 士兵 - 寒冰锻造师
  // ============================================================================

  {
    id: 'frost_axe',
    name: abilityText('frost_axe', 'name'),
    description: abilityText('frost_axe', 'description'),
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
    interactionChain: {
      steps: [
        { step: 'selectChoice', inputType: 'choice', producesField: 'choice' },
        { step: 'selectAttachTarget', inputType: 'position', producesField: 'targetPosition', optional: true },
      ],
      payloadContract: {
        required: ['choice'],
        optional: ['targetPosition'],
      },
    },
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const fxChoice = ctx.payload.choice as string | undefined;
        if (fxChoice === 'self') {
          return { valid: true };
        }
        
        if (fxChoice === 'attach') {
          if ((ctx.sourceUnit.boosts ?? 0) < 1) {
            return { valid: false, error: '充能不足' };
          }
          
          const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
          if (!targetPosition) {
            return { valid: false, error: '必须选择目标士兵' };
          }
          
          const fxDist = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col);
          if (fxDist > 3) {
            return { valid: false, error: '目标必须在3格以内' };
          }
          
          const fxTarget = getUnitAt(ctx.core, targetPosition);
          if (!fxTarget) {
            return { valid: false, error: '目标位置没有单位' };
          }
          
          if (fxTarget.owner !== ctx.playerId) {
            return { valid: false, error: '必须选择友方单位' };
          }
          
          if (fxTarget.card.unitClass !== 'common') {
            return { valid: false, error: '只能附加到士兵' };
          }
          
          if (fxTarget.instanceId === ctx.sourceUnit.instanceId) {
            return { valid: false, error: '不能附加到自身' };
          }
          
          return { valid: true };
        }
        
        return { valid: false, error: '无效选择' };
      },
    },
    ui: {
      requiresButton: false,
      buttonPhase: 'move',
      buttonLabel: 'abilityButtons.frostAxe',
      buttonVariant: 'secondary',
      activationStep: 'selectChoice',
    },
  },

  // ============================================================================
  // 士兵 - 寒冰魔像
  // ============================================================================

  {
    id: 'living_gate',
    name: abilityText('living_gate', 'name'),
    description: abilityText('living_gate', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v1',
    trigger: 'passive',
    effects: [],
  },

  {
    id: 'mobile_structure',
    name: abilityText('mobile_structure', 'name'),
    description: abilityText('mobile_structure', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v2',
    trigger: 'passive',
    effects: [],
  },

  {
    id: 'slow',
    name: abilityText('slow', 'name'),
    description: abilityText('slow', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v3',
    trigger: 'onMove',
    effects: [
      { type: 'extraMove', target: 'self', value: -1 },
    ],
  },

  // ============================================================================
  // 事件卡 - 寒冰冲撞（持续事件，非单位技能）
  // ============================================================================

  {
    id: 'ice_ram',
    name: abilityText('ice_ram', 'name'),
    description: abilityText('ice_ram', 'description'),
    sfxKey: 'fantasy.elemental_sword_iceattack_v1',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'ice_ram_action' },
    ],
  },
];
