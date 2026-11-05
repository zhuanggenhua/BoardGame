import type { CellCoord } from './types';
import type { InteractionChain } from '../../../engine/primitives/ability';

// ============================================================================
// 技能触发时机
// ============================================================================

/**
 * 技能触发时机
 */
export type AbilityTrigger =
    | 'onSummon' // 召唤时（火祀召唤）
    | 'beforeAttack' // 攻击前（吸取生命）
    | 'afterAttack' // 攻击后（读心传念、念力、高阶念力）
    | 'onDamageDealt' // 造成伤害后
    | 'onKill' // 消灭单位后（感染、心灵捕获）
    | 'onDeath' // 被消灭时（献祭）
    | 'onUnitDestroyed' // 任意单位被消灭时（血腥狂怒、灵魂转移）
    | 'onTurnStart' // 回合开始时
    | 'onTurnEnd' // 回合结束时（血腥狂怒充能衰减）
    | 'onPhaseStart' // 阶段开始时（幻化）
    | 'onPhaseEnd' // 阶段结束时
    | 'afterDraw' // 抓牌后（永恒议会主动事件）
    | 'activated' // 主动激活（复活死灵）
    | 'passive' // 被动效果（暴怒）
    | 'onDamageCalculation' // 伤害计算时（暴怒加成）
    | 'onMove' // 移动时（飞行、迅捷等移动增强）
    | 'afterMove' // 移动后（祖灵羁绊、祖灵交流等）
    | 'onAdjacentEnemyAttack' // 相邻敌方攻击时（迷魂减伤）
    | 'onAdjacentEnemyLeave';

// 相邻敌方离开时（缠斗）

// ============================================================================
// 技能效果类型
// ============================================================================

/**
 * 目标引用
 */
export type TargetRef =
    | 'self' // 技能拥有者
    | 'attacker' // 攻击者
    | 'target' // 攻击目标
    | 'killer' // 击杀者
    | 'victim' // 被击杀者
    | 'owner' // 单位所有者（玩家）
    | 'opponent' // 对手
    | 'adjacentEnemies' // 相邻敌方单位
    | 'adjacentAllies' // 相邻友方单位
    | 'allAllies' // 所有友方单位
    | 'allEnemies' // 所有敌方单位
    | { position: CellCoord } // 指定位置
    | { unitId: string };

// 指定单位

/**
 * 效果操作
 */
export type AbilityEffect =
    // 伤害/治疗
    | { type: 'damage'; target: TargetRef; value: number | Expression }
    | { type: 'heal'; target: TargetRef; value: number | Expression }
    // 属性修改（maxBonus：加成上限，如 power_up 最多+5；未指定则无上限）
    | { type: 'modifyStrength'; target: TargetRef; value: number | Expression; maxBonus?: number }
    | { type: 'modifyLife'; target: TargetRef; value: number | Expression; maxBonus?: number }
    // 充能/Token
    | { type: 'addCharge'; target: TargetRef; value: number }
    | { type: 'removeCharge'; target: TargetRef; value: number }
    | { type: 'setCharge'; target: TargetRef; value: number }
    // 单位操作
    | { type: 'destroyUnit'; target: TargetRef }
    | { type: 'moveUnit'; target: TargetRef; to: CellCoord | 'victimPosition' }
    | { type: 'summonFromDiscard'; cardType: 'undead' | 'carrier' | 'plagueZombie'; position: TargetRef }
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
    | {
          type: 'extraMove';
          target: TargetRef;
          value: number;
          canPassThrough?: 'units' | 'structures' | 'all';
          damageOnPassThrough?: number;
      }
    // 光环：增加友方建筑生命
    | { type: 'auraStructureLife'; range?: number; value: number }
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
    | { type: 'isUnitType'; target: TargetRef; unitType: 'undead' | 'carrier' | 'summoner' | 'champion' | 'common' }
    | { type: 'isInRange'; target: TargetRef; range: number }
    | { type: 'isOwner'; target: TargetRef; owner: 'self' | 'opponent' }
    | { type: 'hasCardInDiscard'; cardType: string }
    | { type: 'deckEmpty'; target: 'owner' | 'opponent' }
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

export type AbilityActivationStep =
    | 'selectCard'
    | 'selectPosition'
    | 'selectUnit'
    | 'selectCards'
    | 'selectChoice'
    | 'selectAttachTarget'
    | 'selectNewPosition'
    | 'selectPushDirection';

export type AbilityActivationContext = 'beforeAttack' | 'activated';

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
    /**
     * @deprecated 推荐使用引擎层的通用约束系统（engine/primitives/abilityConstraints）
     *
     * 迁移方式：
     * 旧代码：costsMoveAction: true
     * 新代码：constraints: { actionCost: { type: 'move', count: 1 }, entityState: { notMoved: true } }
     *
     * 消耗一次移动行动（技能代替移动，如预备）
     */
    costsMoveAction?: boolean;
    /**
     * @deprecated 推荐使用引擎层的通用约束系统（engine/primitives/abilityConstraints）
     *
     * 迁移方式：
     * 旧代码：costsAttackAction: true
     * 新代码：constraints: { actionCost: { type: 'attack', count: 1 } }
     *
     * 消耗一次攻击行动（技能代替攻击，如高阶念力）
     */
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
        activationStep?: AbilityActivationStep;
        /** 激活模式的上下文标记 */
        activationContext?: AbilityActivationContext;
        /** 激活类型：'abilityMode'（默认）| 'directExecute' | 'passiveTrigger' */
        activationType?: 'abilityMode' | 'directExecute' | 'passiveTrigger';
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
