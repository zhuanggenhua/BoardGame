/**
 * 伤害计算管线
 *
 * 基于 modifier.ts 的伤害计算专用包装器，提供：
 * - 自动收集修正（Token/状态/护盾）
 * - 生成包含完整链路的 DAMAGE_DEALT 事件
 * - 生成 ActionLog 可用的 breakdown 结构
 *
 * 设计原则：
 * - 复用 modifier.ts 的核心能力，不重复造轮子
 * - 声明式 API，游戏层只需指定基础伤害和规则
 * - 纯函数，不可变，返回新对象
 * - 向后兼容，旧事件格式仍可正常工作
 */

import type { GameEvent, PlayerId } from '../types';
import type { ModifierDef, ModifierStack } from './modifier';
import {
  createModifierStack,
  addModifier,
  applyModifiers,
} from './modifier';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 伤害来源
 */
export interface DamageSource {
  /** 来源玩家 ID */
  playerId: PlayerId;
  /** 来源技能/能力 ID */
  abilityId?: string;
}

/**
 * 伤害目标
 */
export interface DamageTarget {
  /** 目标玩家 ID */
  playerId: PlayerId;
}

/**
 * 伤害计算上下文
 */
export interface DamageContext {
  /** 伤害来源 */
  source: DamageSource;
  /** 伤害目标 */
  target: DamageTarget;
  /** 游戏状态（用于收集修正） */
  state: any;
}

/**
 * 当前伤害所属的攻击上下文。
 *
 * 游戏层负责把自己的攻击账本投影成这个通用合同；引擎层不读取游戏 core 中的
 * pending attack / combat session 等私有字段。
 */
export interface AttackDamageContext {
  attackerId: PlayerId;
  defenderId: PlayerId;
  bonusDamage?: number;
  isUltimate?: boolean;
}

/**
 * PassiveTrigger handler 注入接口
 *
 * 游戏层实现此接口，注入到 DamageCalculationConfig 中，
 * 使引擎层能处理 custom 类型的 PassiveTrigger 动作而不直接依赖游戏层代码。
 */
export interface PassiveTriggerHandler {
  /** 处理 custom 类型的 passiveTrigger 动作 */
  handleCustomAction(
    actionId: string,
    context: {
      targetId: string;
      attackerId: string;
      sourceAbilityId?: string;
      state: Record<string, unknown>;
      timestamp: number;
      random?: any;
      damageAmount: number;
      tokenId: string;
      tokenStacks: number;
    }
  ): { events: GameEvent[]; preventAmount: number };
}

/**
 * 伤害计算配置
 */
export interface DamageCalculationConfig extends DamageContext {
  /** 基础伤害值 */
  baseDamage: number;
  
  /** 额外修正（游戏层手动添加） */
  additionalModifiers?: ModifierDef<DamageContext>[];
  
  /** 是否自动收集 Token 修正（默认 true） */
  autoCollectTokens?: boolean;
  
  /** 是否自动收集状态修正（默认 true） */
  autoCollectStatus?: boolean;
  
  /** 是否自动收集护盾减免（默认 false，护盾由 reducer 统一消耗） */
  autoCollectShields?: boolean;

  /** 当前伤害所属的攻击上下文，用于攻击限定修正、终极攻击判定和显式加伤 */
  attackDamageContext?: AttackDamageContext;

  /** 是否自动收集 attackDamageContext.bonusDamage（默认 true） */
  autoCollectBonusDamage?: boolean;
  
  /** PassiveTrigger handler（游戏层注入） */
  passiveTriggerHandler?: PassiveTriggerHandler;

  /** 伤害来源范围（用于区分攻击伤害与直接伤害） */
  damageScope?: 'attack' | 'direct';

  /** 时间戳 */
  timestamp?: number;
}

/**
 * 伤害明细步骤（用于 ActionLog 展示）
 */
export interface DamageBreakdownStep {
  /** 修正类型 */
  type: string;
  /** 修正值 */
  value: number;
  /** 来源 ID */
  sourceId: string;
  /** 来源名称（i18n key 或显示文本） */
  sourceName?: string;
  /** 是否为 i18n key */
  sourceNameIsI18n?: boolean;
  /** 应用后的累计值 */
  runningTotal: number;
}

/**
 * 伤害明细（ActionLog 展示用）
 */
export interface DamageBreakdown {
  /** 基础伤害 */
  base: {
    value: number;
    sourceId: string;
    sourceName?: string;
    sourceNameIsI18n?: boolean;
  };
  /** 修正步骤列表 */
  steps: DamageBreakdownStep[];
}

/**
 * 伤害计算结果
 */
export interface DamageResult {
  /** 基础伤害 */
  baseDamage: number;
  
  /** 应用的修正列表（不含 base） */
  modifiers: Array<{
    type: string;
    value: number;
    sourceId: string;
    sourceName?: string;
  }>;
  
  /** 最终伤害（应用所有修正后） */
  finalDamage: number;
  
  /** 实际伤害（扣除护盾后） */
  actualDamage: number;
  
  /** 计算明细（用于 ActionLog） */
  breakdown: DamageBreakdown;
  
  /** 副作用事件（PassiveTrigger 的 removeStatus/custom 产生） */
  sideEffectEvents: GameEvent[];
}

interface PendingOnDamageReceivedCustomAction {
  def: any;
  action: any;
  stacks: number;
}

// ============================================================================
// 伤害计算类
// ============================================================================


export class DamageCalculation {
  private config: DamageCalculationConfig;
  private modifierStack: ModifierStack<DamageContext>;
  /** 收集阶段累积的副作用事件（removeStatus / custom handler 产生） */
  private collectedSideEffects: GameEvent[] = [];

  /**
   * 统一获取核心状态。
   * - 兼容包装态：{ core, sys }
   * - 兼容直传态：任意游戏 core
   */
  private getCoreState(): any {
    return this.config.state?.core ?? this.config.state;
  }

  private getMatchingAttackDamageContext(): AttackDamageContext | null {
    const attackContext = this.config.attackDamageContext;
    if (!attackContext) return null;
    if (
      attackContext.attackerId !== this.config.source.playerId
      || attackContext.defenderId !== this.config.target.playerId
    ) {
      return null;
    }
    return attackContext;
  }

  /**
   * 检查 onDamageReceived 类型的被动效果是否允许在当前伤害上下文触发。
   * 默认兼容旧行为：未声明 scope 时，仍视为任意伤害触发。
   */
  private shouldApplyOnDamageReceivedTrigger(def: any): boolean {
    const passiveTrigger = def?.passiveTrigger;
    if (passiveTrigger?.timing !== 'onDamageReceived') return true;

    const scope = passiveTrigger.damageTriggerScope ?? 'anyDamage';
    if (scope === 'anyDamage') return true;

    if (scope === 'opponentAttackDamage') {
      if (this.config.damageScope === 'direct') return false;

      const attackContext = this.config.attackDamageContext;
      const matchingAttackContext = this.getMatchingAttackDamageContext();
      if (attackContext && !matchingAttackContext) return false;

      return this.config.source.playerId !== this.config.target.playerId;
    }

    return true;
  }
  
  constructor(config: DamageCalculationConfig) {
    this.config = config;
    this.modifierStack = createModifierStack<DamageContext>();
    this.initializeModifiers();
  }
  
  /**
   * 初始化修正列表
   */
  private initializeModifiers(): void {
    // 1. 添加基础伤害（作为 flat 修正，priority=0）
    this.modifierStack = addModifier(this.modifierStack, {
      id: '__base__',
      type: 'flat',
      value: this.config.baseDamage,
      priority: 0,
      source: this.config.source.abilityId || 'unknown',
      description: 'Base damage',
    });
    
    // 2. 自动收集修正
    if (this.config.autoCollectTokens !== false) {
      this.collectTokenModifiers();
    }
    if (this.config.autoCollectStatus !== false) {
      this.collectSourceStatusModifiers();
    }
    // 护盾默认不收集（由 reducer 统一消耗，避免双重扣减）
    if (this.config.autoCollectShields === true) {
      this.collectShieldModifiers();
    }
    
    // 2.5. 自动收集显式攻击上下文加伤
    if (this.config.autoCollectBonusDamage !== false) {
      this.collectBonusDamage();
    }
    
    // 3. 添加游戏层手动指定的修正
    if (this.config.additionalModifiers) {
      for (const mod of this.config.additionalModifiers) {
        this.modifierStack = addModifier(this.modifierStack, mod);
      }
    }

    // 目标侧的数值修正必须先完整入栈，才能让“受到致死伤害时”这类被动
    // 基于即将结算的总伤害判断。自定义被动本身产生的 PREVENT_DAMAGE 不参与
    // 这次预判，避免把自己的减伤又算回触发条件。
    if (this.config.autoCollectStatus !== false) {
      const customActions = this.collectStatusModifiers();
      this.collectOnDamageReceivedCustomActions(customActions);
    }
  }
  
  /**
   * 收集 Token 修正
   * 
   * 从攻击方收集加伤 Token
   */
  private collectTokenModifiers(): void {
    const { source } = this.config;
    const coreState = this.getCoreState();
    
    // 兼容包装态（state.core.players）与直传态（state.players）
    const sourcePlayer = coreState?.players?.[source.playerId];
    if (!sourcePlayer?.tokens) return;
    
    // 从 tokenDefinitions 查找有 damageBonus 的 Token
    const tokenDefs = coreState?.tokenDefinitions || [];
    
    Object.entries(sourcePlayer.tokens).forEach(([tokenId, amount]) => {
      if (typeof amount !== 'number' || amount <= 0) return;
      
      const tokenDef = tokenDefs.find((t: any) => t.id === tokenId);
      if (!tokenDef?.damageBonus) return;
      
      this.modifierStack = addModifier(this.modifierStack, {
        id: `token-${tokenId}`,
        type: 'flat',
        value: tokenDef.damageBonus * amount,
        priority: 10,
        source: tokenId,
        description: `Token: ${tokenDef.name || tokenId}`,
      });
    });
  }

  /**
   * 收集伤害来源身上的出伤修正状态。
   *
   * 某些出伤修正状态挂在攻击者身上，修正的是该玩家造成的攻击伤害，
   * 不能走目标侧 onDamageReceived 收集逻辑。
   */
  private collectSourceStatusModifiers(): void {
    if (this.config.damageScope === 'direct') return;

    const { source, target } = this.config;
    if (source.playerId === target.playerId) return;

    const coreState = this.getCoreState();
    const sourcePlayer = coreState?.players?.[source.playerId];
    if (!sourcePlayer) return;

    const tokenDefs = coreState?.tokenDefinitions || [];
    const timestamp = this.config.timestamp || Date.now();
    for (const def of tokenDefs) {
      if (def.passiveTrigger?.timing !== 'onDamageDealt') continue;

      const statusStacks = sourcePlayer.statusEffects?.[def.id] ?? 0;
      const tokenStacks = sourcePlayer.tokens?.[def.id] ?? 0;
      const stacks = def.category === 'debuff'
        ? Math.max(statusStacks, tokenStacks)
        : tokenStacks;

      if (typeof stacks !== 'number' || stacks <= 0) continue;

      const scope = def.passiveTrigger.damageTriggerScope ?? 'anyDamage';
      if (scope === 'opponentAttackDamage') {
        const attackContext = this.config.attackDamageContext;
        if (attackContext && !this.getMatchingAttackDamageContext()) {
          continue;
        }
      }

      for (const action of def.passiveTrigger.actions || []) {
        if (action.type !== 'modifyStat' || typeof action.value !== 'number') continue;
        if (def.passiveTrigger.ignoreModifierOnUltimateDamage && this.getMatchingAttackDamageContext()?.isUltimate === true) {
          continue;
        }
        const value = action.value * stacks;
        if (value === 0) continue;
        this.modifierStack = addModifier(this.modifierStack, {
          id: `source-status-${def.id}-passive`,
          type: 'flat',
          value,
          priority: 18,
          source: def.id,
          description: `Status: ${def.name || def.id}`,
        });
      }

      if (!def.passiveTrigger.consumeOnTrigger) continue;

      if (statusStacks >= tokenStacks && statusStacks > 0) {
        this.collectedSideEffects.push({
          type: 'STATUS_REMOVED',
          payload: {
            targetId: source.playerId,
            statusId: def.id,
            stacks: Math.min(statusStacks, stacks),
          },
          sourceCommandType: 'ABILITY_EFFECT',
          timestamp,
        } as GameEvent);
        continue;
      }

      if (tokenStacks > 0) {
        const removedAmount = Math.min(tokenStacks, stacks);
        this.collectedSideEffects.push({
          type: 'TOKEN_CONSUMED',
          payload: {
            playerId: source.playerId,
            tokenId: def.id,
            amount: removedAmount,
            newTotal: Math.max(0, tokenStacks - removedAmount),
          },
          sourceCommandType: 'ABILITY_EFFECT',
          timestamp,
        } as GameEvent);
      }
    }
  }
  
  /**
   * 收集状态修正
   * 
   * 从目标收集减伤状态（如护甲），并处理 PassiveTrigger 的全部动作类型：
   * - modifyStat: 转为 flat modifier（已有逻辑）
   * - removeStatus: 生成 STATUS_REMOVED 事件
   * - custom: 调用 passiveTriggerHandler，将 preventAmount 转为负值 flat modifier
   * - consumeOnTrigger: 触发后移除自身状态 / 消耗自身 token
   */
  private collectStatusModifiers(): PendingOnDamageReceivedCustomAction[] {
    const { target } = this.config;
    const coreState = this.getCoreState();
    
    const targetPlayer = coreState?.players?.[target.playerId];
    if (!targetPlayer) return [];
    
    const tokenDefs = coreState?.tokenDefinitions || [];
    const timestamp = this.config.timestamp || Date.now();
    const customActions: PendingOnDamageReceivedCustomAction[] = [];
    
    // 1. 处理 damageReduction 字段（旧机制）—— 仅从 statusEffects 收集
    if (targetPlayer.statusEffects) {
      Object.entries(targetPlayer.statusEffects).forEach(([statusId, stacks]) => {
        if (typeof stacks !== 'number' || stacks <= 0) return;
        
        const statusDef = tokenDefs.find((t: any) => t.id === statusId);
        if (!statusDef?.damageReduction) return;
        
        this.modifierStack = addModifier(this.modifierStack, {
          id: `status-${statusId}`,
          type: 'flat',
          value: -statusDef.damageReduction * stacks,
          priority: 20,
          source: statusId,
          description: `Status: ${statusDef.name || statusId}`,
        });
      });
    }
    
    // 2. 处理 passiveTrigger.timing === 'onDamageReceived'（新机制）
    //    遍历所有 tokenDefinitions，根据 category 从 statusEffects 或 tokens 取层数
    for (const def of tokenDefs) {
      if (def.passiveTrigger?.timing !== 'onDamageReceived') continue;
      if (!this.shouldApplyOnDamageReceivedTrigger(def)) continue;
      
      // 根据 category 决定从 statusEffects 还是 tokens 取层数
      const statusStacks = targetPlayer.statusEffects?.[def.id] ?? 0;
      const tokenStacks = targetPlayer.tokens?.[def.id] ?? 0;
      const stacks = def.category === 'debuff'
        ? Math.max(statusStacks, tokenStacks)
        : tokenStacks;
      
      if (typeof stacks !== 'number' || stacks <= 0) continue;
      
      const actions = def.passiveTrigger.actions || [];
      for (const action of actions) {
        switch (action.type) {
          case 'modifyStat': {
            if (typeof action.value !== 'number') break;
            const value = action.value * stacks;
            if (value !== 0) {
              this.modifierStack = addModifier(this.modifierStack, {
                id: `status-${def.id}-passive`,
                type: 'flat',
                value,
                priority: 20,
                source: def.id,
                description: `Status: ${def.name || def.id}`,
              });
            }
            break;
          }
          
          case 'removeStatus': {
            if (!action.statusId) break;
            const currentStacks = targetPlayer.statusEffects?.[action.statusId] ?? 0;
            if (currentStacks <= 0) break;
            const removeStacks = Math.min(currentStacks, action.value ?? currentStacks);
            this.collectedSideEffects.push({
              type: 'STATUS_REMOVED',
              payload: {
                targetId: target.playerId,
                statusId: action.statusId,
                stacks: removeStacks,
              },
              sourceCommandType: 'ABILITY_EFFECT',
              timestamp,
            } as GameEvent);
            break;
          }
          
          case 'custom': {
            if (action.customActionId) {
              customActions.push({ def, action, stacks });
            }
            break;
          }
          
          default:
            break;
        }
      }

      if (!def.passiveTrigger.consumeOnTrigger) continue;

      if (statusStacks >= tokenStacks && statusStacks > 0) {
        this.collectedSideEffects.push({
          type: 'STATUS_REMOVED',
          payload: {
            targetId: target.playerId,
            statusId: def.id,
            stacks: Math.min(statusStacks, stacks),
          },
          sourceCommandType: 'ABILITY_EFFECT',
          timestamp,
        } as GameEvent);
        continue;
      }

      if (tokenStacks > 0) {
        const removedAmount = Math.min(tokenStacks, stacks);
        this.collectedSideEffects.push({
          type: 'TOKEN_CONSUMED',
          payload: {
            playerId: target.playerId,
            tokenId: def.id,
            amount: removedAmount,
            newTotal: Math.max(0, tokenStacks - removedAmount),
          },
          sourceCommandType: 'ABILITY_EFFECT',
          timestamp,
        } as GameEvent);
      }
    }

    return customActions;
  }

  /**
   * 在全部常规数值修正入栈后，执行 onDamageReceived 的自定义被动。
   * 每个被动看到的是同一份“自定义减伤介入前”的总伤害，避免触发顺序
   * 改变致死判定，也避免被动把自身 PREVENT_DAMAGE 算进触发条件。
   */
  private collectOnDamageReceivedCustomActions(
    customActions: PendingOnDamageReceivedCustomAction[],
  ): void {
    if (customActions.length === 0) return;

    const handler = this.config.passiveTriggerHandler;
    if (!handler) return;

    const { target, source } = this.config;
    const timestamp = this.config.timestamp || Date.now();
    const predictedDamage = Math.max(
      0,
      Math.round(applyModifiers(this.modifierStack, 0, this.config).finalValue),
    );

    for (const { def, action, stacks } of customActions) {
      const actionId = action.customActionId;
      try {
        const handlerResult = handler.handleCustomAction(actionId, {
          targetId: target.playerId,
          attackerId: source.playerId,
          sourceAbilityId: source.abilityId,
          state: this.config.state,
          timestamp,
          damageAmount: predictedDamage,
          tokenId: def.id,
          tokenStacks: stacks,
        });

        if (handlerResult.preventAmount > 0) {
          this.modifierStack = addModifier(this.modifierStack, {
            id: `custom-prevent-${def.id}-${actionId}`,
            type: 'flat',
            value: -handlerResult.preventAmount,
            priority: 25,
            source: def.id,
            description: `Status: ${def.name || def.id}`,
          });
        }

        if (handlerResult.events.length > 0) {
          this.collectedSideEffects.push(...handlerResult.events);
        }
      } catch (err) {
        console.error(`[DamageCalculation] custom handler "${actionId}" 执行异常:`, err);
      }
    }
  }
  
  /**
   * 收集护盾修正
   * 
   * 从目标收集护盾减免
   */
  private collectShieldModifiers(): void {
    const { target } = this.config;
    const coreState = this.getCoreState();
    
    const targetPlayer = coreState?.players?.[target.playerId];
    if (!targetPlayer?.damageShields) return;
    
    const totalShield = targetPlayer.damageShields.reduce(
      (sum: number, shield: any) => sum + (shield.value || 0),
      0
    );
    
    if (totalShield > 0) {
      this.modifierStack = addModifier(this.modifierStack, {
        id: '__shield__',
        type: 'flat',
        value: -totalShield,
        priority: 100,  // 护盾最后应用
        source: 'shield',
        description: 'actionLog.damageSource.shieldReduction',
      });
    }
  }
  
  /**
   * 收集显式攻击上下文中的加伤。
   */
  private collectBonusDamage(): void {
    const attackContext = this.getMatchingAttackDamageContext();
    
    if (!attackContext) return;

    const bonusDamage = attackContext.bonusDamage ?? 0;
    if (bonusDamage === 0) return;
    
    this.modifierStack = addModifier(this.modifierStack, {
      id: '__bonus_damage__',
      type: 'flat',
      value: bonusDamage,
      priority: 15,  // 在 Token 修正之后，状态修正之前
      source: 'attack_modifier',
      description: 'actionLog.damageSource.attackModifier',
    });
  }
  
  /**
   * 计算最终伤害
   */
  public resolve(): DamageResult {
    // 应用所有修正（从 0 开始累加）
    const result = applyModifiers(this.modifierStack, 0, this.config);
    
    // 构建 breakdown
    const breakdown = this.buildBreakdown(result.appliedIds);
    
    // 最终伤害不能为负
    const finalDamage = Math.max(0, Math.round(result.finalValue));
    
    // 提取非 base 的修正
    const modifiers = result.appliedIds
      .filter(id => id !== '__base__')
      .map(id => {
        const mod = this.modifierStack.entries.find(e => e.def.id === id)?.def;
        return {
          type: mod?.type || 'flat',
          value: mod?.value || 0,
          sourceId: mod?.source || id,
          sourceName: this.resolveModifierName(mod),
        };
      });
    
    return {
      baseDamage: this.config.baseDamage,
      modifiers,
      finalDamage,
      actualDamage: finalDamage,
      breakdown,
      sideEffectEvents: [...this.collectedSideEffects],
    };
  }
  
  /**
   * 构建 breakdown 结构
   */
  private buildBreakdown(appliedIds: string[]): DamageBreakdown {
    const steps: DamageBreakdownStep[] = [];
    let runningTotal = 0;
    
    for (const id of appliedIds) {
      const entry = this.modifierStack.entries.find(e => e.def.id === id);
      if (!entry) continue;
      
      const { def } = entry;
      
      if (def.id === '__base__') {
        // 基础伤害
        runningTotal = def.value || 0;
      } else {
        // 修正
        if (def.type === 'flat') {
          runningTotal += def.value || 0;
        } else if (def.type === 'percent') {
          runningTotal *= 1 + (def.value || 0) / 100;
        }
        
        steps.push({
          type: def.type,
          value: def.value || 0,
          sourceId: def.source || def.id,
          sourceName: this.resolveModifierName(def),
          sourceNameIsI18n: this.isI18nKey(this.resolveModifierName(def)),
          runningTotal: Math.round(runningTotal),
        });
      }
    }
    
    return {
      base: {
        value: this.config.baseDamage,
        sourceId: this.config.source.abilityId || 'unknown',
        sourceName: this.resolveAbilityName(this.config.source.abilityId),
        sourceNameIsI18n: this.isI18nKey(this.resolveAbilityName(this.config.source.abilityId)),
      },
      steps,
    };
  }
  
  /**
   * 生成 DAMAGE_DEALT 事件
   */
  public toEvents(): GameEvent[] {
    const result = this.resolve();
    
    return [{
      type: 'DAMAGE_DEALT',
      payload: {
        targetId: this.config.target.playerId,
        amount: result.finalDamage,
        actualDamage: result.actualDamage,
        sourceAbilityId: this.config.source.abilityId,
        modifiers: result.modifiers.map(m => ({
          type: m.type as any,
          value: m.value,
          sourceId: m.sourceId,
          sourceName: m.sourceName,
        })),
        breakdown: result.breakdown,
      },
      sourceCommandType: 'ABILITY_EFFECT',
      timestamp: this.config.timestamp || Date.now(),
    }];
  }
  
  // ========================================================================
  // 辅助方法
  // ========================================================================
  
  /**
   * 解析技能名称
   */
  private resolveAbilityName(abilityId?: string): string | undefined {
    if (!abilityId) return undefined;
    
    // 尝试从游戏状态中查找技能定义
    // 这里简化处理，游戏层可以通过 additionalModifiers 提供更准确的名称
    return abilityId;
  }
  
  /**
   * 解析修正器名称
   */
  private resolveModifierName(mod?: ModifierDef<DamageContext>): string | undefined {
    if (!mod) return undefined;
    
    // 优先使用 description
    if (mod.description) return mod.description;
    
    // 尝试从 tokenDefinitions 查找
    const tokenDefs = this.getCoreState()?.tokenDefinitions || [];
    const tokenDef = tokenDefs.find((t: any) => t.id === mod.source);
    if (tokenDef?.name) return tokenDef.name;
    
    return mod.source;
  }
  
  /**
   * 判断是否为 i18n key
   */
  private isI18nKey(text?: string): boolean {
    return !!text?.includes('.');
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建伤害计算实例
 */
export function createDamageCalculation(
  config: DamageCalculationConfig
): DamageCalculation {
  return new DamageCalculation(config);
}

/**
 * 批量计算多个目标的伤害（AOE 技能优化）
 */
export function createBatchDamageCalculation(
  config: Omit<DamageCalculationConfig, 'target'> & {
    targets: DamageTarget[];
  }
): DamageCalculation[] {
  return config.targets.map(target => 
    new DamageCalculation({
      ...config,
      target,
    })
  );
}
