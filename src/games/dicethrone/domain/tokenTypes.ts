/**
 * TokenSystem - 统一的 Token 系统类型定义（DiceThrone 本地副本）
 */

// ============================================================================
// Token 类型
// ============================================================================

/**
 * Token 类型/分类
 */
export type TokenCategory =
    | 'buff'          // 正面效果
    | 'debuff'        // 负面效果（脑震荡、眩晕、击倒等）
    | 'consumable';   // 可消耗道具（太极、闪避、净化等）

// ============================================================================
// 被动触发时机（原StatusEffect）
// ============================================================================

/**
 * Token 被动触发时机（用于 debuff/buff 类型）
 */
export type PassiveTiming =
    | 'onApply'          // 效果被施加时
    | 'onRemove'         // 效果被移除时
    | 'onTurnStart'      // 回合开始时
    | 'onTurnEnd'        // 回合结束时
    | 'onDamageDealt'    // 造成伤害时
    | 'onDamageReceived' // 受到伤害时
    | 'onAbilityUsed'    // 使用技能时
    | 'onPhaseEnter'     // 进入特定阶段时（脑震荡: 跳过收入阶段）
    | 'onAttackEnd'      // 攻击结束时（眩晕: 触发额外攻击）
    | 'manual';          // 手动触发（消耗型）

// ============================================================================
// 主动使用时机（原Token）
// ============================================================================

/**
 * Token 主动使用时机
 */
export type ActiveTiming =
    | 'beforeDamageDealt'     // 造成伤害前（太极加伤）
    | 'beforeDamageReceived'  // 受到伤害前（太极减伤、闪避）
    | 'onOffensiveRollEnd'    // 攻击掷骰阶段结束时（暴击、精准）
    | 'anytime';              // 任意时点（净化）

// ============================================================================
// Token 使用效果
// ============================================================================

/**
 * Token 使用效果类型
 */
export type TokenUseEffectType =
    | 'modifyDamageDealt'     // 修改造成的伤害
    | 'modifyDamageReceived'  // 修改受到的伤害
    | 'rollToNegate'          // 掷骰尝试免伤（闪避）
    | 'removeDebuff';         // 移除负面状态（净化）

/**
 * Token 使用效果
 */
export interface TokenUseEffect {
    type: TokenUseEffectType;
    /** 数值（伤害修改量等） */
    value?: number;
    /** 掷骰成功条件（用于 rollToNegate） */
    rollSuccess?: {
        /** 成功的骰面范围 [min, max] */
        range: [number, number];
    };
}

// ============================================================================
// Token 效果处理器（可扩展）
// ============================================================================

/**
 * Token 效果处理上下文
 * 包含处理 Token 效果所需的所有信息
 */
export interface TokenEffectContext<TState = unknown> {
    /** 当前游戏状态 */
    state: TState;
    /** Token 定义 */
    tokenDef: TokenDef;
    /** 使用 Token 的玩家 ID */
    playerId: string;
    /** 使用数量 */
    amount: number;
    /** 随机数生成器（用于掷骰） */
    random?: { d: (sides: number) => number };
    /** 待处理伤害信息（伤害相关 Token 使用） */
    pendingDamage?: {
        originalDamage: number;
        currentDamage: number;
        responseType: 'beforeDamageDealt' | 'beforeDamageReceived';
    };
    /** 其他上下文数据 */
    extra?: Record<string, unknown>;
}

/**
 * Token 效果处理结果
 */
export interface TokenEffectResult {
    /** 是否成功 */
    success: boolean;
    /** 伤害修改量（正数加伤，负数减伤） */
    damageModifier?: number;
    /** 是否完全闪避 */
    fullyEvaded?: boolean;
    /** 掷骰结果（用于 rollToNegate） */
    rollResult?: {
        value: number;
        success: boolean;
    };
    /** 其他结果数据 */
    extra?: Record<string, unknown>;
}

/**
 * Token 效果处理器函数类型
 * 根据 TokenUseEffectType 处理对应效果
 */
export type TokenEffectProcessor<TState = unknown> = (
    ctx: TokenEffectContext<TState>
) => TokenEffectResult;

// ============================================================================
// 被动触发配置（用于 debuff/buff 类型）
// ============================================================================

/**
 * 选择选项类型
 */
export interface ChoiceOption {
    statusId?: string;
    tokenId?: string;
    value: number;
    customId?: string;
    labelKey?: string;
}

/**
 * RollDie 条件效果类型
 */
export interface RollDieConditionalEffect {
    face: string;
    bonusDamage?: number;
    heal?: number;
    cp?: number;
    /** 抽牌数量 */
    drawCard?: number;
    /** 授予伤害护盾 */
    grantDamageShield?: { value: number; preventStatus?: boolean };
    grantStatus?: { 
        statusId: string; 
        value: number;
        /** 目标：self=施法者，opponent=对手。如果未指定，根据 statusId 的 category 自动推断（debuff→opponent, buff→self） */
        target?: 'self' | 'opponent';
    };
    grantToken?: { 
        tokenId: string; 
        value: number;
        /** 目标：self=施法者，opponent=对手。如果未指定，默认为 self */
        target?: 'self' | 'opponent';
    };
    /** 授予多个 Token（当单个 grantToken 不够时使用） */
    grantTokens?: Array<{
        tokenId: string;
        value: number;
        target?: 'self' | 'opponent';
    }>;
    triggerChoice?: {
        titleKey: string;
        options: ChoiceOption[];
    };
    /** 
     * 自定义效果描述 i18n key（用于 displayOnly 面板）
     * 如果未指定，使用通用的 `bonusDie.effect.${face}` key
     * 用于同一骰面在不同技能中有不同效果的情况（如 holy-light-2 的剑面给暴击 token 而非 +2 伤害）
     */
    effectKey?: string;
}

/**
 * rollDie 的"否则/默认"分支效果
 * 当所有 conditionalEffects 都不匹配时触发
 */
export interface RollDieDefaultEffect {
    /** 抽牌数量 */
    drawCard?: number;
    heal?: number;
    cp?: number;
    grantToken?: { tokenId: string; value: number; target?: 'self' | 'opponent' };
    grantStatus?: { statusId: string; value: number; target?: 'self' | 'opponent' };
}

/**
 * 被动效果行为定义（可程序化执行）
 * 从 StatusEffectSystem 迁移而来
 */
export interface EffectAction {
    type: 'damage' | 'heal' | 'modifyStat' | 'grantStatus' | 'removeStatus' | 'grantToken' | 'grantDamageShield' | 'choice' | 'rollDie' | 'custom' | 'drawCard' | 'replaceAbility' | 'modifyDie' | 'rerollDie' | 'removeAllStatus' | 'transferStatus' | 'grantExtraRoll' | 'skipPhase' | 'extraAttack';
    target: 'self' | 'opponent' | 'all' | 'allOpponents' | 'select';
    value?: number;
    statusId?: string;
    tokenId?: string;
    customActionId?: string;
    // choice 相关
    choiceTitleKey?: string;
    choiceOptions?: ChoiceOption[];
    // rollDie 相关
    diceCount?: number;
    conditionalEffects?: RollDieConditionalEffect[];
    /** rollDie 的"否则/默认"分支：当所有 conditionalEffects 都不匹配时触发 */
    defaultEffect?: RollDieDefaultEffect;
    damageMode?: 'sumValues' | 'conditional';
    // drawCard 相关
    drawCount?: number;
    // replaceAbility 相关
    targetAbilityId?: string;
    newAbilityDef?: unknown;
    newAbilityLevel?: number;
    // grantDamageShield 相关
    shieldValue?: number;
    /** 是否用于防止本次攻击的状态效果（grantDamageShield） */
    preventStatus?: boolean;
    // damage 相关
    unblockable?: boolean;
    // 其他可选参数
    [key: string]: unknown;
}

/**
 * 被动触发配置
 * 用于 debuff/buff 类型的 Token，在特定时机自动触发
 */
export interface PassiveTriggerConfig {
    /** 触发时机 */
    timing: PassiveTiming;
    /** 效果行为（可自动执行） */
    actions?: EffectAction[];
    /** 持续回合数（undefined = 永久，直到手动移除） */
    duration?: number;
    /** 是否可被净化/移除类效果移除 */
    removable: boolean;
    /** 移除此效果需要的代价（如 CP） */
    removalCost?: { resource: string; amount: number };
}

// ============================================================================
// 主动使用配置（用于 consumable 类型）
// ============================================================================

/**
 * 主动使用配置
 * 用于 consumable 类型的 Token，玩家主动消耗使用
 */
export interface ActiveUseConfig {
    /** 可使用的时机 */
    timing: ActiveTiming[];
    /** 使用时消耗的数量（默认 1） */
    consumeAmount: number;
    /** 使用效果 */
    effect: TokenUseEffect;
}

// ============================================================================
// Token 定义（统一架构）
// ============================================================================

/**
 * 统一的 Token 定义
 * 支持三种类型：buff、debuff、consumable
 */
export interface TokenDef {
    /** 唯一标识 */
    id: string;
    /** 显示名称（或 i18n key） */
    name: string;
    /** 图标（已废弃，精灵图优先） */
    icon?: string;
    /** 颜色主题（Tailwind gradient class） */
    colorTheme: string;
    /** 描述文本（供 UI 展示） */
    description: string[];
    /** 状态/Token 施加时的音效 key（可选） */
    sfxKey?: string;
    /** 最大堆叠数（0 = 无限） */
    stackLimit: number;
    
    /**
     * Token 类型/分类
     * - buff: 正面效果
     * - debuff: 负面效果（脑震荡、眩晕、击倒等）
     * - consumable: 可消耗道具（太极、闪避、净化等）
     */
    category: TokenCategory;
    
    /**
     * 被动触发配置（用于 debuff/buff 类型）
     * 在特定时机自动触发效果
     */
    passiveTrigger?: PassiveTriggerConfig;
    
    /**
     * 主动使用配置（用于 consumable 类型）
     * 玩家主动消耗使用
     */
    activeUse?: ActiveUseConfig;
    
    /** 图集帧 ID（用于图标显示） */
    frameId?: string;
    
    /** 图集 ID（用于图标图集查找，如 'dicethrone:monk-status'） */
    atlasId?: string;
}

// ============================================================================
// Token 实例（运行时状态）
// ============================================================================

/**
 * 玩家持有的 Token 状态
 * 简化为 Record<tokenId, stacks> 结构
 */
export type TokenState = Record<string, number>;

/**
 * Token 实例（带额外信息，用于 debuff/buff 追踪）
 */
export interface TokenInstance {
    /** Token 定义 ID */
    defId: string;
    /** 当前堆叠数 */
    stacks: number;
    /** 剩余持续回合（undefined = 永久） */
    remainingDuration?: number;
    /** 施加者 ID（用于追溯） */
    sourcePlayerId?: string;
    /** 施加时的回合数 */
    appliedOnTurn?: number;
}

// ============================================================================
// Token 系统接口（保留类型，便于迁移）
// ============================================================================

/**
 * Token 系统接口
 */
export interface ITokenSystem {
    // ============ 定义管理 ============
    
    /** 注册 Token 定义 */
    registerDefinition(def: TokenDef): void;
    /** 批量注册 Token 定义 */
    registerDefinitions(defs: TokenDef[]): void;
    /** 获取 Token 定义 */
    getDefinition(id: string): TokenDef | undefined;
    /** 获取所有 Token 定义 */
    getAllDefinitions(): TokenDef[];
    /** 获取指定类型的 Token 定义 */
    getDefinitionsByCategory(category: TokenCategory): TokenDef[];
    
    // ============ 状态管理 ============
    
    /** 授予 Token */
    grant(tokens: TokenState, tokenId: string, amount: number, def?: TokenDef): TokenState;
    /** 消耗 Token */
    consume(tokens: TokenState, tokenId: string, amount?: number): { tokens: TokenState; consumed: number };
    /** 检查是否有足够的 Token */
    hasEnough(tokens: TokenState, tokenId: string, amount?: number): boolean;
    
    // ============ debuff/buff 特有操作 ============
    
    /** 获取指定时机触发的 Token */
    getTokensByTiming(tokens: TokenState, timing: PassiveTiming): Array<{ def: TokenDef; stacks: number }>;
    /** 获取可被移除的负面 Token */
    getRemovableDebuffs(tokens: TokenState): Array<{ def: TokenDef; stacks: number }>;
    /** 回合结束时处理持续时间（返回到期的 Token ID 列表） */
    tickDurations(instances: TokenInstance[]): { updated: TokenInstance[]; expired: string[] };
}
