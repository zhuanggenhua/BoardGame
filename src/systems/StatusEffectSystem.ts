/**
 * 通用状态效果系统
 * 
 * 支持任意游戏的 Buff/Debuff 管理，可扩展用于王权骰铸、其他桌游等。
 * 设计原则：
 * - 状态效果定义与具体游戏解耦
 * - 支持堆叠、持续时间、触发条件
 * - 提供效果应用/移除的统一 API
 */

// ============================================================================
// 状态效果基础类型
// ============================================================================

/**
 * 效果触发时机
 */
export type EffectTiming =
    | 'onApply'          // 效果被施加时
    | 'onRemove'         // 效果被移除时
    | 'onTurnStart'      // 回合开始时
    | 'onTurnEnd'        // 回合结束时
    | 'onDamageDealt'    // 造成伤害时
    | 'onDamageReceived' // 受到伤害时
    | 'onAbilityUsed'    // 使用技能时
    | 'onPhaseEnter'     // 进入特定阶段时
    | 'manual';          // 手动触发（消耗型）

/**
 * 效果类型
 */
export type EffectType =
    | 'buff'             // 正面效果
    | 'debuff'           // 负面效果
    | 'neutral';         // 中性效果

/**
 * 效果行为定义（可程序化执行）
 */
export interface EffectAction {
    type: 'damage' | 'heal' | 'modifyStat' | 'grantStatus' | 'removeStatus' | 'grantToken' | 'grantDamageShield' | 'choice' | 'rollDie' | 'custom' | 'drawCard' | 'replaceAbility' | 'modifyDie' | 'rerollDie' | 'removeAllStatus' | 'transferStatus' | 'grantExtraRoll';
    /** 目标：self/opponent/all/select（需要选择） */
    target: 'self' | 'opponent' | 'all' | 'select';
    /** 数值（伤害/治疗量/修改值） */
    value?: number;
    /** 对于 grantStatus/removeStatus，指定状态 ID */
    statusId?: string;
    /** 对于 grantToken，指定 Token ID */
    tokenId?: string;
    /** 自定义行为 ID（需要游戏实现对应处理器） */
    customActionId?: string;
    
    // ============ modifyDie 类型参数 ============
    /** 骰子修改模式 */
    dieModifyMode?: 'set' | 'adjust' | 'copy' | 'any';
    /** 设置的目标值（mode=set） */
    dieTargetValue?: number;
    /** 调整范围（mode=adjust） */
    dieAdjustRange?: { min: number; max: number };
    /** 需要选择的骰子数量 */
    dieSelectCount?: number;
    /** 是否针对对手的骰子 */
    targetOpponentDice?: boolean;
    
    // ============ choice 类型参数 ============
    /** 选择项列表（用于 choice 类型，支持 statusId 或 tokenId） */
    choiceOptions?: Array<{ statusId?: string; tokenId?: string; value: number }>;
    /** 选择弹窗标题 key（用于 choice 类型） */
    choiceTitleKey?: string;
    
    // ============ rollDie 类型参数 ============
    /** 投掷骰子数量（用于 rollDie 类型） */
    diceCount?: number;
    /** 根据骰面的条件效果（用于 rollDie 类型） */
    conditionalEffects?: RollDieConditionalEffect[];
    
    // ============ drawCard 类型参数 ============
    /** 抽牌数量（用于 drawCard 类型） */
    drawCount?: number;
    
    // ============ replaceAbility 类型参数 ============
    /** 被替换的技能 ID（用于 replaceAbility 类型） */
    targetAbilityId?: string;
    /** 新技能定义（用于 replaceAbility 类型），需要在游戏层定义具体类型 */
    newAbilityDef?: unknown;
    /** 新技能等级（用于 replaceAbility 类型，升级卡用于标注升级到 II/III 等） */
    newAbilityLevel?: number;
    
    // ============ grantDamageShield 类型参数 ============
    /** 护盾值（用于 grantDamageShield 类型） */
    shieldValue?: number;
}

/**
 * 投掷骰子的条件效果
 */
export interface RollDieConditionalEffect {
    /** 触发条件：骰面类型 */
    face: string;
    /** 增加伤害（加到当前攻击） */
    bonusDamage?: number;
    /** 获得状态（被动状态如击倒） */
    grantStatus?: { statusId: string; value: number };
    /** 获得 Token（太极、闪避、净化） */
    grantToken?: { tokenId: string; value: number };
    /** 触发选择（支持 statusId 或 tokenId） */
    triggerChoice?: { options: Array<{ statusId?: string; tokenId?: string; value: number }>; titleKey: string };
}

/**
 * 通用状态效果定义
 */
export interface StatusEffectDef {
    /** 唯一标识 */
    id: string;
    /** 显示名称 */
    name: string;
    /** 效果类型 */
    type: EffectType;
    /** 图标（emoji 或图片路径） */
    icon: string;
    /** 颜色主题（Tailwind gradient class） */
    colorTheme: string;
    /** 描述文本（供 UI 展示） */
    description: string[];
    
    /** 最大堆叠数（0 = 无限） */
    stackLimit: number;
    /** 持续回合数（undefined = 永久，直到手动移除） */
    duration?: number;
    
    /** 触发时机 */
    timing: EffectTiming;
    /** 效果行为（可选，用于自动执行） */
    actions?: EffectAction[];
    
    /** 是否可被净化类效果移除 */
    removable: boolean;
    /** 移除此效果需要的代价（如 CP） */
    removalCost?: { resource: string; amount: number };
}

/**
 * 玩家身上的状态效果实例
 */
export interface StatusEffectInstance {
    /** 效果定义 ID */
    defId: string;
    /** 当前堆叠数 */
    stacks: number;
    /** 剩余持续回合（undefined = 永久） */
    remainingDuration?: number;
    /** 施加者 ID（用于追溯） */
    sourcePlayerId?: string;
    /** 施加时的回合数 */
    appliedOnTurn: number;
}

// ============================================================================
// 状态效果管理器
// ============================================================================

/**
 * 状态效果管理器
 * 管理效果定义注册、效果应用/移除、触发检测
 */
export class StatusEffectManager {
    private definitions = new Map<string, StatusEffectDef>();

    /**
     * 注册效果定义
     */
    registerEffect(def: StatusEffectDef): void {
        if (this.definitions.has(def.id)) {
            console.warn(`[StatusEffectManager] 效果 ${def.id} 已存在，将被覆盖`);
        }
        this.definitions.set(def.id, def);
    }

    /**
     * 批量注册效果定义
     */
    registerEffects(defs: StatusEffectDef[]): void {
        defs.forEach(def => this.registerEffect(def));
    }

    /**
     * 获取效果定义
     */
    getDefinition(id: string): StatusEffectDef | undefined {
        return this.definitions.get(id);
    }

    /**
     * 获取所有效果定义
     */
    getAllDefinitions(): StatusEffectDef[] {
        return Array.from(this.definitions.values());
    }

    /**
     * 应用效果到玩家
     * @returns 应用后的效果实例
     */
    applyEffect(
        currentEffects: StatusEffectInstance[],
        defId: string,
        stacks: number,
        sourcePlayerId: string | undefined,
        currentTurn: number
    ): StatusEffectInstance[] {
        const def = this.definitions.get(defId);
        if (!def) {
            console.warn(`[StatusEffectManager] 未找到效果定义: ${defId}`);
            return currentEffects;
        }

        const existing = currentEffects.find(e => e.defId === defId);
        
        if (existing) {
            // 堆叠效果
            const maxStacks = def.stackLimit || Infinity;
            existing.stacks = Math.min(existing.stacks + stacks, maxStacks);
            // 刷新持续时间
            if (def.duration !== undefined) {
                existing.remainingDuration = def.duration;
            }
            return [...currentEffects];
        }

        // 新增效果
        const newEffect: StatusEffectInstance = {
            defId,
            stacks: Math.min(stacks, def.stackLimit || Infinity),
            remainingDuration: def.duration,
            sourcePlayerId,
            appliedOnTurn: currentTurn,
        };

        return [...currentEffects, newEffect];
    }

    /**
     * 移除效果
     * @param amount 移除的堆叠数（undefined = 全部移除）
     */
    removeEffect(
        currentEffects: StatusEffectInstance[],
        defId: string,
        amount?: number
    ): StatusEffectInstance[] {
        const index = currentEffects.findIndex(e => e.defId === defId);
        if (index === -1) return currentEffects;

        const effect = currentEffects[index];
        
        if (amount === undefined || effect.stacks <= amount) {
            // 完全移除
            return currentEffects.filter((_, i) => i !== index);
        }

        // 减少堆叠
        effect.stacks -= amount;
        return [...currentEffects];
    }

    /**
     * 消耗效果堆叠（用于手动触发型效果）
     */
    consumeStacks(
        currentEffects: StatusEffectInstance[],
        defId: string,
        amount: number
    ): { effects: StatusEffectInstance[]; consumed: number } {
        const effect = currentEffects.find(e => e.defId === defId);
        if (!effect) {
            return { effects: currentEffects, consumed: 0 };
        }

        const consumed = Math.min(effect.stacks, amount);
        const newEffects = this.removeEffect(currentEffects, defId, consumed);
        
        return { effects: newEffects, consumed };
    }

    /**
     * 回合结束时处理持续时间
     */
    tickDurations(currentEffects: StatusEffectInstance[]): StatusEffectInstance[] {
        return currentEffects
            .map(effect => {
                if (effect.remainingDuration === undefined) return effect;
                return {
                    ...effect,
                    remainingDuration: effect.remainingDuration - 1,
                };
            })
            .filter(effect => 
                effect.remainingDuration === undefined || effect.remainingDuration > 0
            );
    }

    /**
     * 获取指定时机触发的效果
     */
    getEffectsByTiming(
        currentEffects: StatusEffectInstance[],
        timing: EffectTiming
    ): Array<{ instance: StatusEffectInstance; def: StatusEffectDef }> {
        return currentEffects
            .map(instance => ({
                instance,
                def: this.definitions.get(instance.defId),
            }))
            .filter((item): item is { instance: StatusEffectInstance; def: StatusEffectDef } =>
                item.def !== undefined && item.def.timing === timing
            );
    }

    /**
     * 获取可被净化移除的负面效果
     */
    getRemovableDebuffs(currentEffects: StatusEffectInstance[]): StatusEffectInstance[] {
        return currentEffects.filter(effect => {
            const def = this.definitions.get(effect.defId);
            return def && def.type === 'debuff' && def.removable;
        });
    }
}

// ============================================================================
// 单例导出
// ============================================================================

/** 全局状态效果管理器实例 */
export const statusEffectManager = new StatusEffectManager();
