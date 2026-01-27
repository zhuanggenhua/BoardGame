/**
 * TokenSystem - 可消耗道具系统类型定义
 * 
 * Token 是可主动消耗使用的道具标记，与被动状态效果（StatusEffect）区分：
 * - Token：太极、闪避、净化 - 玩家选择时机主动消耗
 * - StatusEffect：击倒、灼烧、中毒 - 在特定时机被动生效
 */

// ============================================================================
// Token 使用时机
// ============================================================================

/**
 * Token 可使用的时机
 */
export type TokenTiming =
    | 'beforeDamageDealt'     // 造成伤害前（太极加伤）
    | 'beforeDamageReceived'  // 受到伤害前（太极减伤、闪避）
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
// Token 定义
// ============================================================================

/**
 * Token 定义
 */
export interface TokenDef {
    /** 唯一标识 */
    id: string;
    /** 显示名称（或 i18n key） */
    name: string;
    /** 图标（emoji 或图片路径） */
    icon: string;
    /** 颜色主题（Tailwind gradient class） */
    colorTheme: string;
    /** 描述文本（供 UI 展示） */
    description: string[];
    /** 最大堆叠数（0 = 无限） */
    stackLimit: number;
    /** 可使用的时机 */
    usableTiming: TokenTiming[];
    /** 使用时消耗的数量（默认 1） */
    consumeAmount?: number;
    /** 使用效果 */
    useEffect: TokenUseEffect;
    /** 图集帧 ID（用于图标显示） */
    frameId?: string;
}

// ============================================================================
// Token 实例（运行时状态）
// ============================================================================

/**
 * 玩家持有的 Token 状态
 * 简化为 Record<tokenId, stacks> 结构
 */
export type TokenState = Record<string, number>;

// ============================================================================
// Token 系统接口
// ============================================================================

/**
 * Token 系统接口
 */
export interface ITokenSystem {
    /** 注册 Token 定义 */
    registerDefinition(def: TokenDef): void;
    /** 批量注册 Token 定义 */
    registerDefinitions(defs: TokenDef[]): void;
    /** 获取 Token 定义 */
    getDefinition(id: string): TokenDef | undefined;
    /** 获取所有 Token 定义 */
    getAllDefinitions(): TokenDef[];
    
    /** 授予 Token */
    grant(tokens: TokenState, tokenId: string, amount: number, def?: TokenDef): TokenState;
    /** 消耗 Token */
    consume(tokens: TokenState, tokenId: string, amount?: number): { tokens: TokenState; consumed: number };
    /** 检查是否有足够的 Token */
    hasEnough(tokens: TokenState, tokenId: string, amount?: number): boolean;
}
