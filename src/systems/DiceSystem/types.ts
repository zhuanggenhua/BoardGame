/**
 * DiceSystem - 通用骰子系统类型定义
 * 
 * 支持各类桌游骰子机制：
 * - 自定义符号骰（DiceThrone）
 * - 标准数值骰（Catan, D&D）
 * - 骰子池/袋抽取（Zombie Dice）
 */

// ============================================================================
// 骰子定义（模板）
// ============================================================================

/**
 * 骰面定义
 */
export interface DieFaceDefinition {
    /** 点数（1-N，用于数值计算、顺子判断） */
    value: number;
    /** 符号列表（可多个，同符号重复表示数量） */
    symbols: string[];
    /** 图标资源路径（可选） */
    icon?: string;
}

/**
 * 骰子定义（模板）
 */
export interface DiceDefinition {
    /** 唯一标识，如 'monk-dice', 'd6-standard' */
    id: string;
    /** 显示名称 */
    name: string;
    /** 面数（6, 8, 10, 12, 20 等） */
    sides: number;
    /** 各面定义（长度应等于 sides） */
    faces: DieFaceDefinition[];
    /** 分类标签（用于骰子池筛选），如 'hero', 'standard', 'attack' */
    category?: string;
    /** 视觉资源 */
    assets?: {
        /** 精灵图/贴图 */
        spriteSheet?: string;
    };
}

// ============================================================================
// 骰子实例（运行时）
// ============================================================================

/**
 * 骰子实例
 */
export interface Die {
    /** 实例 ID（同一局游戏内唯一） */
    id: number;
    /** 骰子定义 ID */
    definitionId: string;
    /** 当前点数 */
    value: number;
    /** 当前符号（从定义解析，取第一个符号作为主符号） */
    symbol: string | null;
    /** 当前所有符号 */
    symbols: string[];
    /** 是否锁定（保留不重掷） */
    isKept: boolean;
}

/**
 * 创建骰子实例的配置
 */
export interface CreateDieOptions {
    /** 实例 ID */
    id: number;
    /** 初始值（可选，不提供则随机） */
    initialValue?: number;
    /** 初始锁定状态 */
    isKept?: boolean;
}

// ============================================================================
// 骰子池
// ============================================================================

/**
 * 骰子池类型
 */
export type DicePoolType = 
    | 'hand'    // 玩家持有（如 DiceThrone 的 5 颗骰子）
    | 'bag'     // 随机抽取袋（如 Zombie Dice）
    | 'shared'; // 公共骰子池

/**
 * 骰子池
 */
export interface DicePool {
    /** 池 ID */
    id: string;
    /** 池类型 */
    poolType: DicePoolType;
    /** 骰子实例列表 */
    dice: Die[];
}

// ============================================================================
// 掷骰结果
// ============================================================================

/**
 * 掷骰统计
 */
export interface RollStats {
    /** 点数总和 */
    total: number;
    /** 符号计数 */
    symbolCounts: Record<string, number>;
    /** 点数计数（用于判断 N 个相同） */
    valueCounts: Record<number, number>;
    /** 是否有小顺（4 个连续） */
    hasSmallStraight: boolean;
    /** 是否有大顺（5 个连续） */
    hasLargeStraight: boolean;
    /** 最大相同点数数量 */
    maxOfAKind: number;
}

/**
 * 掷骰结果
 */
export interface RollResult {
    /** 掷骰后的骰子列表 */
    dice: Die[];
    /** 统计信息 */
    stats: RollStats;
}

// ============================================================================
// 触发条件
// ============================================================================

/**
 * 符号组合触发条件
 */
export interface SymbolsTrigger {
    type: 'symbols';
    /** 所需符号及数量 */
    required: Record<string, number>;
}

/**
 * 点数组合触发条件
 */
export interface ValuesTrigger {
    type: 'values';
    /** 所需点数及数量 */
    required: Record<number, number>;
}

/**
 * 点数总和触发条件
 */
export interface TotalTrigger {
    type: 'total';
    min?: number;
    max?: number;
}

/**
 * 小顺触发条件（4 个连续数字）
 */
export interface SmallStraightTrigger {
    type: 'smallStraight';
}

/**
 * 大顺触发条件（5 个连续数字）
 */
export interface LargeStraightTrigger {
    type: 'largeStraight';
}

/**
 * N 个相同触发条件
 */
export interface OfAKindTrigger {
    type: 'ofAKind';
    /** 所需相同数量 */
    count: number;
}

/**
 * 自定义触发条件
 */
export interface CustomTrigger {
    type: 'custom';
    /** 自定义检查函数 */
    check: (dice: Die[]) => boolean;
}

/**
 * 骰子触发条件（联合类型）
 */
export type DiceTrigger =
    | SymbolsTrigger
    | ValuesTrigger
    | TotalTrigger
    | SmallStraightTrigger
    | LargeStraightTrigger
    | OfAKindTrigger
    | CustomTrigger;

// ============================================================================
// DiceSystem 接口
// ============================================================================

/**
 * 骰子系统接口
 */
export interface IDiceSystem {
    /** 注册骰子定义 */
    registerDefinition(definition: DiceDefinition): void;
    
    /** 获取骰子定义 */
    getDefinition(id: string): DiceDefinition | undefined;
    
    /** 获取所有骰子定义 */
    getAllDefinitions(): DiceDefinition[];
    
    /** 创建骰子实例 */
    createDie(definitionId: string, options: CreateDieOptions): Die;
    
    /** 掷单个骰子 */
    rollDie(die: Die): Die;
    
    /** 批量掷骰（支持保留） */
    rollDice(dice: Die[]): RollResult;
    
    /** 计算统计信息 */
    calculateStats(dice: Die[]): RollStats;
    
    /** 检查触发条件 */
    checkTrigger(dice: Die[], trigger: DiceTrigger): boolean;
    
    /** 根据点数获取骰面定义 */
    getFaceByValue(definitionId: string, value: number): DieFaceDefinition | undefined;
}
