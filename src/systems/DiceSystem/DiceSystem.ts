/**
 * DiceSystem - 骰子系统核心实现
 */

import type {
    DiceDefinition,
    DieFaceDefinition,
    Die,
    CreateDieOptions,
    RollResult,
    RollStats,
    DiceTrigger,
    IDiceSystem,
} from './types';

/**
 * 骰子系统实现
 */
class DiceSystemImpl implements IDiceSystem {
    private definitions: Map<string, DiceDefinition> = new Map();

    /**
     * 注册骰子定义
     */
    registerDefinition(definition: DiceDefinition): void {
        if (definition.faces.length !== definition.sides) {
            console.warn(
                `DiceSystem: Definition '${definition.id}' has ${definition.faces.length} faces but ${definition.sides} sides`
            );
        }
        this.definitions.set(definition.id, definition);
    }

    /**
     * 获取骰子定义
     */
    getDefinition(id: string): DiceDefinition | undefined {
        return this.definitions.get(id);
    }

    /**
     * 获取所有骰子定义
     */
    getAllDefinitions(): DiceDefinition[] {
        return Array.from(this.definitions.values());
    }

    /**
     * 根据点数获取骰面定义
     */
    getFaceByValue(definitionId: string, value: number): DieFaceDefinition | undefined {
        const definition = this.definitions.get(definitionId);
        if (!definition) return undefined;
        return definition.faces.find(f => f.value === value);
    }

    /**
     * 创建骰子实例
     */
    createDie(definitionId: string, options: CreateDieOptions): Die {
        const definition = this.definitions.get(definitionId);
        if (!definition) {
            throw new Error(`DiceSystem: Unknown definition '${definitionId}'`);
        }

        const value = options.initialValue ?? this.randomValue(definition.sides);
        const face = this.getFaceByValue(definitionId, value);
        const symbols = face?.symbols ?? [];

        return {
            id: options.id,
            definitionId,
            value,
            symbol: symbols[0] ?? null,
            symbols,
            isKept: options.isKept ?? false,
        };
    }

    /**
     * 掷单个骰子（返回新骰子，不修改原骰子）
     */
    rollDie(die: Die): Die {
        if (die.isKept) {
            return die; // 锁定的骰子不重掷
        }

        const definition = this.definitions.get(die.definitionId);
        if (!definition) {
            console.warn(`DiceSystem: Unknown definition '${die.definitionId}'`);
            return die;
        }

        const value = this.randomValue(definition.sides);
        const face = this.getFaceByValue(die.definitionId, value);
        const symbols = face?.symbols ?? [];

        return {
            ...die,
            value,
            symbol: symbols[0] ?? null,
            symbols,
        };
    }

    /**
     * 批量掷骰（返回掷骰结果）
     */
    rollDice(dice: Die[]): RollResult {
        const rolledDice = dice.map(die => this.rollDie(die));
        const stats = this.calculateStats(rolledDice);
        return { dice: rolledDice, stats };
    }

    /**
     * 计算统计信息
     */
    calculateStats(dice: Die[]): RollStats {
        const symbolCounts: Record<string, number> = {};
        const valueCounts: Record<number, number> = {};
        let total = 0;

        for (const die of dice) {
            // 累加点数
            total += die.value;

            // 统计点数出现次数
            valueCounts[die.value] = (valueCounts[die.value] ?? 0) + 1;

            // 统计符号出现次数
            for (const symbol of die.symbols) {
                symbolCounts[symbol] = (symbolCounts[symbol] ?? 0) + 1;
            }
        }

        // 计算最大相同数量
        const maxOfAKind = Math.max(0, ...Object.values(valueCounts));

        // 检查顺子
        const values = new Set(dice.map(d => d.value));
        const hasSmallStraight = this.checkStraight(values, 4);
        const hasLargeStraight = this.checkStraight(values, 5);

        return {
            total,
            symbolCounts,
            valueCounts,
            hasSmallStraight,
            hasLargeStraight,
            maxOfAKind,
        };
    }

    /**
     * 检查触发条件
     */
    checkTrigger(dice: Die[], trigger: DiceTrigger): boolean {
        const stats = this.calculateStats(dice);

        switch (trigger.type) {
            case 'symbols':
                return this.checkSymbolsTrigger(stats.symbolCounts, trigger.required);

            case 'values':
                return this.checkValuesTrigger(stats.valueCounts, trigger.required);

            case 'total':
                return this.checkTotalTrigger(stats.total, trigger.min, trigger.max);

            case 'smallStraight':
                return stats.hasSmallStraight;

            case 'largeStraight':
                return stats.hasLargeStraight;

            case 'ofAKind':
                return stats.maxOfAKind >= trigger.count;

            case 'custom':
                return trigger.check(dice);

            default:
                return false;
        }
    }

    // ========================================================================
    // 私有方法
    // ========================================================================

    /**
     * 生成随机点数 (1 到 sides)
     */
    private randomValue(sides: number): number {
        return Math.floor(Math.random() * sides) + 1;
    }

    /**
     * 检查是否有 N 个连续数字
     */
    private checkStraight(values: Set<number>, length: number): boolean {
        const sortedValues = Array.from(values).sort((a, b) => a - b);
        
        for (let i = 0; i <= sortedValues.length - length; i++) {
            let isConsecutive = true;
            for (let j = 1; j < length; j++) {
                if (sortedValues[i + j] !== sortedValues[i] + j) {
                    isConsecutive = false;
                    break;
                }
            }
            if (isConsecutive) return true;
        }
        
        return false;
    }

    /**
     * 检查符号触发条件
     */
    private checkSymbolsTrigger(
        counts: Record<string, number>,
        required: Record<string, number>
    ): boolean {
        for (const [symbol, requiredCount] of Object.entries(required)) {
            if ((counts[symbol] ?? 0) < requiredCount) {
                return false;
            }
        }
        return true;
    }

    /**
     * 检查点数触发条件
     */
    private checkValuesTrigger(
        counts: Record<number, number>,
        required: Record<number, number>
    ): boolean {
        for (const [value, requiredCount] of Object.entries(required)) {
            const numValue = Number(value);
            if ((counts[numValue] ?? 0) < requiredCount) {
                return false;
            }
        }
        return true;
    }

    /**
     * 检查总和触发条件
     */
    private checkTotalTrigger(total: number, min?: number, max?: number): boolean {
        if (min !== undefined && total < min) return false;
        if (max !== undefined && total > max) return false;
        return true;
    }
}

/**
 * 骰子系统单例
 */
export const diceSystem: IDiceSystem = new DiceSystemImpl();

/**
 * 辅助函数：快速创建符号触发条件
 */
export function symbolsTrigger(required: Record<string, number>): DiceTrigger {
    return { type: 'symbols', required };
}

/**
 * 辅助函数：快速创建 N 个相同触发条件
 */
export function ofAKindTrigger(count: number): DiceTrigger {
    return { type: 'ofAKind', count };
}
