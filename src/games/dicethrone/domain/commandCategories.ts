/**
 * DiceThrone 命令分类系统
 * 
 * 为每个命令定义明确的分类，用于权限控制和系统性管理。
 * 
 * 设计原则：
 * - 显式优于隐式：每个命令都有明确的分类
 * - 可维护性：新增命令时必须分类，否则编译错误
 * - 自文档化：分类本身就说明了命令的用途
 */

/**
 * 命令分类
 */
export enum CommandCategory {
    /** 回合流程控制（不应该在响应窗口期间允许） */
    PHASE_CONTROL = 'phase_control',
    
    /** 战略决策（不应该在响应窗口期间允许） */
    STRATEGIC = 'strategic',
    
    /** 战术响应（应该在响应窗口期间允许） */
    TACTICAL = 'tactical',
    
    /** UI 交互（应该在响应窗口期间允许） */
    UI_INTERACTION = 'ui_interaction',
    
    /** 状态管理（应该在响应窗口期间允许） */
    STATE_MANAGEMENT = 'state_management',
    
    /** 系统命令（总是允许，由引擎自动处理） */
    SYSTEM = 'system',
}

/**
 * 命令分类映射表
 * 
 * 每个命令都必须有明确的分类。
 * 新增命令时必须在此处添加分类，否则会导致运行时错误。
 */
export const COMMAND_CATEGORIES: Record<string, CommandCategory> = {
    // ============================================================================
    // 回合流程控制（PHASE_CONTROL）
    // 这些命令控制游戏的回合流程，不应该在响应窗口期间允许
    // ============================================================================
    'ROLL_DICE': CommandCategory.PHASE_CONTROL,
    'CONFIRM_ROLL': CommandCategory.PHASE_CONTROL,
    'ADVANCE_PHASE': CommandCategory.PHASE_CONTROL,
    
    // ============================================================================
    // 战略决策（STRATEGIC）
    // 这些命令是重要的战略决策，不应该在响应窗口期间允许
    // ============================================================================
    'SELECT_ABILITY': CommandCategory.STRATEGIC,
    'SELECT_CHARACTER': CommandCategory.STRATEGIC,
    'HOST_START_GAME': CommandCategory.STRATEGIC,
    'PLAYER_READY': CommandCategory.STRATEGIC,
    
    // ============================================================================
    // 战术响应（TACTICAL）
    // 这些命令是战术响应操作，应该在响应窗口期间允许
    // ============================================================================
    'PLAY_CARD': CommandCategory.TACTICAL,
    'PLAY_UPGRADE_CARD': CommandCategory.TACTICAL,
    'USE_TOKEN': CommandCategory.TACTICAL,
    'SKIP_TOKEN_RESPONSE': CommandCategory.TACTICAL,
    'USE_PASSIVE_ABILITY': CommandCategory.TACTICAL,
    'USE_PURIFY': CommandCategory.TACTICAL,
    'PAY_TO_REMOVE_KNOCKDOWN': CommandCategory.TACTICAL,
    
    // ============================================================================
    // UI 交互（UI_INTERACTION）
    // 这些命令是纯 UI 操作，不影响游戏状态，应该总是允许
    // ============================================================================
    'TOGGLE_DIE_LOCK': CommandCategory.UI_INTERACTION,
    'DRAW_CARD': CommandCategory.UI_INTERACTION,
    'DISCARD_CARD': CommandCategory.UI_INTERACTION,
    'SELL_CARD': CommandCategory.UI_INTERACTION,
    'UNDO_SELL_CARD': CommandCategory.UI_INTERACTION,
    'REORDER_CARD_TO_END': CommandCategory.UI_INTERACTION,
    
    // ============================================================================
    // 状态管理（STATE_MANAGEMENT）
    // 这些命令管理游戏状态（骰子、状态效果等），应该在响应窗口期间允许
    // ============================================================================
    'MODIFY_DIE': CommandCategory.STATE_MANAGEMENT,
    'REROLL_DIE': CommandCategory.STATE_MANAGEMENT,
    'REROLL_BONUS_DIE': CommandCategory.STATE_MANAGEMENT,
    'SKIP_BONUS_DICE_REROLL': CommandCategory.STATE_MANAGEMENT,
    'REMOVE_STATUS': CommandCategory.STATE_MANAGEMENT,
    'TRANSFER_STATUS': CommandCategory.STATE_MANAGEMENT,
    'RESOLVE_CHOICE': CommandCategory.STATE_MANAGEMENT,
    
    // ============================================================================
    // 系统命令（SYSTEM）
    // 这些命令由引擎自动处理，不需要在游戏层配置
    // ============================================================================
    'RESPONSE_PASS': CommandCategory.SYSTEM,
    // SYS_* 前缀的命令由引擎自动识别，不需要在此列出
};

/**
 * 获取命令的分类
 * @param commandType 命令类型
 * @returns 命令分类，如果命令未分类则返回 undefined
 */
export function getCommandCategory(commandType: string): CommandCategory | undefined {
    // SYS_ 前缀的命令自动归类为 SYSTEM
    if (commandType.startsWith('SYS_')) {
        return CommandCategory.SYSTEM;
    }
    
    return COMMAND_CATEGORIES[commandType];
}

/**
 * 检查命令是否属于指定分类
 * @param commandType 命令类型
 * @param category 要检查的分类
 * @returns 是否属于指定分类
 */
export function isCommandInCategory(commandType: string, category: CommandCategory): boolean {
    return getCommandCategory(commandType) === category;
}

/**
 * 检查命令是否属于任一指定分类
 * @param commandType 命令类型
 * @param categories 要检查的分类列表
 * @returns 是否属于任一指定分类
 */
export function isCommandInAnyCategory(commandType: string, categories: CommandCategory[]): boolean {
    const commandCategory = getCommandCategory(commandType);
    return commandCategory !== undefined && categories.includes(commandCategory);
}

/**
 * 获取所有属于指定分类的命令
 * @param category 分类
 * @returns 属于该分类的所有命令类型
 */
export function getCommandsByCategory(category: CommandCategory): string[] {
    return Object.entries(COMMAND_CATEGORIES)
        .filter(([_, cat]) => cat === category)
        .map(([type, _]) => type);
}

/**
 * 验证所有命令都已分类
 * 
 * 在开发环境中调用此函数，确保所有命令都有分类。
 * 如果有未分类的命令，会在控制台输出警告。
 * 
 * @param allCommandTypes 所有命令类型列表
 */
export function validateCommandCategories(allCommandTypes: string[]): void {
    const uncategorized: string[] = [];
    
    for (const commandType of allCommandTypes) {
        // 跳过系统命令（SYS_ 前缀）
        if (commandType.startsWith('SYS_')) {
            continue;
        }
        
        if (!COMMAND_CATEGORIES[commandType]) {
            uncategorized.push(commandType);
        }
    }
    
    if (uncategorized.length > 0) {
        console.warn(
            '[CommandCategories] 以下命令未分类，请在 commandCategories.ts 中添加分类：',
            uncategorized
        );
    }
}
