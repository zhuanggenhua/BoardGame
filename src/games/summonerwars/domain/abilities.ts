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
import { isCellEmpty, getPlayerUnits } from './helpers';
import { isUndeadCard, isPlagueZombieCard } from './ids';
import { TRICKSTER_ABILITIES } from './abilities-trickster';
import { GOBLIN_ABILITIES } from './abilities-goblin';
import { PALADIN_ABILITIES } from './abilities-paladin';
import { FROST_ABILITIES } from './abilities-frost';
import { BARBARIC_ABILITIES } from './abilities-barbaric';
import { abilityText } from './abilityTextHelper';
import type { InteractionChain } from '../../../engine/primitives/ability';

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
  | { type: 'extraMove'; target: TargetRef; value: number; canPassThrough?: 'units' | 'structures' | 'all'; damageOnPassThrough?: number }
  // 光环：增加友方建筑生命
  | { type: 'auraStructureLife'; range: number; value: number }
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
// UI 上下文类型
// ============================================================================

/**
 * 技能 UI 按钮可用性检查上下文
 */
export interface AbilityUIContext {
  core: import('./types').SummonerWarsCore;
  unit: import('./types').BoardUnit;
  playerId: import('./types').PlayerId;
  myHand: Array<{ cardType: string; name: string; id: string }>;
}

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
  /** 消耗一次移动行动（技能代替移动，如预备） */
  costsMoveAction?: boolean;
  /** 消耗一次攻击行动（技能代替攻击，如高阶念力） */
  costsAttackAction?: boolean;
  /** 交互链声明（多步交互技能必填，用于契约校验） */
  interactionChain?: InteractionChain;
  /** 验证规则（用于主动技能） */
  validation?: {
    /** 必须在指定阶段使用 */
    requiredPhase?: 'summon' | 'move' | 'attack' | 'build';
    /** 自定义验证函数 */
    customValidator?: (ctx: ValidationContext) => ValidationResult;
  };
  /** UI 元数据（用于按钮渲染） */
  ui?: {
    /** 是否需要按钮 */
    requiresButton?: boolean;
    /** 按钮显示的阶段 */
    buttonPhase?: 'summon' | 'move' | 'attack' | 'build';
    /** 按钮文本（i18n key） */
    buttonLabel?: string;
    /** 按钮样式 */
    buttonVariant?: 'primary' | 'secondary' | 'danger';
    /** 快速可用性检查（返回 false 则不显示按钮） */
    quickCheck?: (ctx: AbilityUIContext) => boolean;
    /** 激活模式的初始步骤（默认 'selectUnit'） */
    activationStep?: string;
    /** 激活模式的上下文标记 */
    activationContext?: string;
    /** 激活类型：'abilityMode'（默认）| 'directExecute' | 'withdrawMode' */
    activationType?: 'abilityMode' | 'directExecute' | 'withdrawMode';
    /** 是否使用 validate 结果控制 disabled 状态（而非隐藏） */
    useValidateForDisabled?: boolean;
    /** 额外的前置条件（如 !unit.hasMoved），返回 false 则不显示 */
    extraCondition?: (ctx: AbilityUIContext) => boolean;
  };
}

/**
 * 验证上下文
 */
export interface ValidationContext {
  core: import('./types').SummonerWarsCore;
  playerId: import('./types').PlayerId;
  sourceUnit: import('./types').BoardUnit;
  sourcePosition: import('./types').CellCoord;
  payload: Record<string, unknown>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// 技能注册表（使用引擎层 AbilityRegistry）
// ============================================================================

import { AbilityRegistry } from '../../../engine/primitives/ability';

/**
 * 技能注册表
 *
 * 使用引擎层通用 AbilityRegistry 替代自建实现，
 * 获得 has/getByTag/getRegisteredIds 等能力。
 *
 * 注：SW 的 AbilityDef 与引擎层 AbilityDef 的 condition/cost 类型不兼容，
 * 因此使用 `as any` 实例化。运行时行为完全一致（registry 内部只用 id/trigger/tags）。
 */
export const abilityRegistry = new AbilityRegistry<AbilityDef>('sw-abilities') as AbilityRegistry<AbilityDef> & {
  register(def: AbilityDef): void;
  registerAll(defs: AbilityDef[]): void;
  get(id: string): AbilityDef | undefined;
  getAll(): AbilityDef[];
  getByTrigger(trigger: AbilityTrigger): AbilityDef[];
};

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
    name: abilityText('revive_undead', 'name'),
    description: abilityText('revive_undead', 'description'),
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
    interactionChain: {
      steps: [
        { step: 'selectCard', inputType: 'card', producesField: 'targetCardId' },
        { step: 'selectPosition', inputType: 'position', producesField: 'targetPosition' },
      ],
      payloadContract: {
        required: ['targetCardId', 'targetPosition'],
      },
    },
    validation: {
      requiredPhase: 'summon',
      customValidator: (ctx) => {
        const targetCardId = ctx.payload.targetCardId as string | undefined;
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        
        if (!targetCardId) return { valid: false, error: '必须选择弃牌堆中的卡牌' };
        if (!targetPosition) return { valid: false, error: '必须选择放置位置' };
        
        const player = ctx.core.players[ctx.playerId];
        const card = player.discard.find(c => c.id === targetCardId);
        if (!card || card.cardType !== 'unit') {
          return { valid: false, error: '弃牌堆中没有该单位卡' };
        }
        
        if (!isUndeadCard(card)) return { valid: false, error: '只能复活亡灵单位' };
        
        // 检查是否相邻
        const isAdjacent = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col) === 1;
        if (!isAdjacent) {
          return { valid: false, error: '必须放置到召唤师相邻的位置' };
        }
        
        // 检查位置是否为空
        const isCellEmpty = !ctx.core.board[targetPosition.row]?.[targetPosition.col]?.unit;
        if (!isCellEmpty) {
          return { valid: false, error: '放置位置必须为空' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'summon',
      buttonLabel: 'abilityButtons.reviveUndead',
      buttonVariant: 'primary',
      activationStep: 'selectCard',
      quickCheck: ({ core, playerId }) =>
        core.players[playerId]?.discard.some(c => c.cardType === 'unit' && isUndeadCard(c)) ?? false,
    },
  },

  // 伊路特-巴尔 - 火祀召唤（被动描述：被召唤时替换友方单位）
  // 注意：实际执行逻辑由下方主动版本 fire_sacrifice_summon 的 custom actionId 驱动
  {
    id: 'fire_sacrifice_passive',
    name: abilityText('fire_sacrifice_passive', 'name'),
    description: abilityText('fire_sacrifice_passive', 'description'),
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
    name: abilityText('life_drain', 'name'),
    description: abilityText('life_drain', 'description'),
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
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const targetUnitId = ctx.payload.targetUnitId as string | undefined;
        if (!targetUnitId) {
          return { valid: false, error: '必须选择要消灭的友方单位' };
        }
        
        // 查找目标单位
        let targetUnit: import('./types').BoardUnit | undefined;
        let targetPos: import('./types').CellCoord | undefined;
        for (let row = 0; row < ctx.core.board.length; row++) {
          for (let col = 0; col < (ctx.core.board[0]?.length ?? 0); col++) {
            const unit = ctx.core.board[row]?.[col]?.unit;
            if (unit && unit.cardId === targetUnitId) {
              targetUnit = unit;
              targetPos = { row, col };
              break;
            }
          }
          if (targetUnit) break;
        }
        
        if (!targetUnit || !targetPos || targetUnit.owner !== ctx.playerId) {
          return { valid: false, error: '必须选择一个友方单位' };
        }
        
        // 计算曼哈顿距离
        const dist = Math.abs(ctx.sourcePosition.row - targetPos.row) + Math.abs(ctx.sourcePosition.col - targetPos.col);
        if (dist > 2) {
          return { valid: false, error: '目标必须在2格以内' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.lifeDrain',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
      activationContext: 'beforeAttack',
      quickCheck: ({ core, unit, playerId }) => {
        const pos = core.selectedUnit;
        if (!pos) return false;
        return getPlayerUnits(core, playerId).some(u => {
          if (u.cardId === unit.cardId) return false;
          const dist = Math.abs(u.position.row - pos.row) + Math.abs(u.position.col - pos.col);
          return dist <= 2;
        });
      },
    },
  },

  // 古尔-达斯 - 暴怒
  {
    id: 'rage',
    name: abilityText('rage', 'name'),
    description: abilityText('rage', 'description'),
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
    name: abilityText('blood_rage', 'name'),
    description: abilityText('blood_rage', 'description'),
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
    name: abilityText('power_boost', 'name'),
    description: abilityText('power_boost', 'description'),
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
    name: abilityText('blood_rage_decay', 'name'),
    description: abilityText('blood_rage_decay', 'description'),
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
    name: abilityText('sacrifice', 'name'),
    description: abilityText('sacrifice', 'description'),
    sfxKey: 'fantasy.elemental_sword_fireattack_02',
    trigger: 'onDeath',
    effects: [
      { type: 'damage', target: 'adjacentEnemies', value: 1 },
    ],
  },

  // 亡灵疫病体 - 无魂
  {
    id: 'soulless',
    name: abilityText('soulless', 'name'),
    description: abilityText('soulless', 'description'),
    sfxKey: 'magic.dark.32.dark_spell_03',
    trigger: 'onKill',
    effects: [
      { type: 'preventMagicGain', target: 'owner' },
    ],
  },

  // 亡灵疫病体 - 感染
  {
    id: 'infection',
    name: abilityText('infection', 'name'),
    description: abilityText('infection', 'description'),
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
    interactionChain: {
      steps: [
        { step: 'selectPosition', inputType: 'position', producesField: 'targetPosition' },
        { step: 'selectCard', inputType: 'card', producesField: 'targetCardId' },
      ],
      payloadContract: {
        required: ['targetCardId', 'targetPosition'],
      },
    },
    validation: {
      customValidator: (ctx) => {
        const targetCardId = ctx.payload.targetCardId as string | undefined;
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        
        if (!targetCardId || !targetPosition) {
          return { valid: false, error: '必须选择弃牌堆中的疫病体和放置位置' };
        }
        
        const player = ctx.core.players[ctx.playerId];
        const card = player.discard.find(c => c.id === targetCardId);
        if (!card || card.cardType !== 'unit') {
          return { valid: false, error: '弃牌堆中没有该单位卡' };
        }
        
        if (!isPlagueZombieCard(card)) {
          return { valid: false, error: '只能召唤疫病体' };
        }
        
        if (!isCellEmpty(ctx.core, targetPosition)) {
          return { valid: false, error: '放置位置必须为空' };
        }
        
        return { valid: true };
      },
    },
  },

  // 亡灵弓箭手 - 灵魂转移
  {
    id: 'soul_transfer',
    name: abilityText('soul_transfer', 'name'),
    description: abilityText('soul_transfer', 'description'),
    sfxKey: 'magic.general.spells_variations_vol_2.unholy_echo.magevil_unholy_echo_01_krst_none',
    trigger: 'onKill',
    condition: { type: 'isInRange', target: 'victim', range: 3 },
    effects: [
      // 改为请求事件，由 UI 确认后执行
      { type: 'custom', actionId: 'soul_transfer_request' },
    ],
    requiresTargetSelection: false, // 可选触发，UI 确认
    validation: {
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须指定目标位置' };
        }
        
        if (!isCellEmpty(ctx.core, targetPosition)) {
          return { valid: false, error: '目标位置必须为空' };
        }
        
        return { valid: true };
      },
    },
  },

  // ============================================================================
  // 主动技能（需要玩家手动激活）
  // ============================================================================

  {
    id: 'fire_sacrifice_summon',
    name: abilityText('fire_sacrifice_summon', 'name'),
    description: abilityText('fire_sacrifice_summon', 'description'),
    sfxKey: 'fantasy.elemental_sword_fireattack_01',
    trigger: 'activated',
    effects: [
      { type: 'custom', actionId: 'fire_sacrifice_summon' },
    ],
    validation: {
      requiredPhase: 'summon',
      customValidator: (ctx) => {
        const targetUnitId = ctx.payload.targetUnitId as string | undefined;
        if (!targetUnitId) {
          return { valid: false, error: '必须选择要消灭的友方单位' };
        }
        
        let targetUnit: import('./types').BoardUnit | undefined;
        for (let row = 0; row < ctx.core.board.length; row++) {
          for (let col = 0; col < (ctx.core.board[0]?.length ?? 0); col++) {
            const unit = ctx.core.board[row]?.[col]?.unit;
            if (unit && unit.cardId === targetUnitId) {
              targetUnit = unit;
              break;
            }
          }
          if (targetUnit) break;
        }
        
        if (!targetUnit || targetUnit.owner !== ctx.playerId) {
          return { valid: false, error: '必须选择一个友方单位' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'summon',
      buttonLabel: 'abilityButtons.fireSacrificeSummon',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
      quickCheck: ({ core, unit, playerId }) =>
        getPlayerUnits(core, playerId).some(u => u.cardId !== unit.cardId),
    },
  },
];

// 注册所有技能
abilityRegistry.registerAll(NECROMANCER_ABILITIES);

// 注册欺心巫族技能
abilityRegistry.registerAll(TRICKSTER_ABILITIES);

// 注册洞穴地精技能
abilityRegistry.registerAll(GOBLIN_ABILITIES);

// 注册先锋军团技能
abilityRegistry.registerAll(PALADIN_ABILITIES);

// 注册极地矮人技能
abilityRegistry.registerAll(FROST_ABILITIES);

// 注册炽原精灵技能
abilityRegistry.registerAll(BARBARIC_ABILITIES);
