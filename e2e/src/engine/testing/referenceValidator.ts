/**
 * 引用完整性验证器
 *
 * 通用于任何游戏：给定「引用链」和「已注册 ID 集合」，报告所有断裂。
 *
 * 设计原则：
 * - 引擎层通用，与具体游戏无关
 * - 纯函数，无副作用
 * - 可在测试中使用，也可在 setup 阶段调用做运行时检查
 *
 * 使用示例：
 * ```
 * const errors = validateReferences({
 *   chains: [
 *     { sourceLabel: 'TokenDef.passiveTrigger', sourceId: 'burn', refType: 'handler', refId: 'burn-apply-damage' },
 *     { sourceLabel: 'CardDef.effects', sourceId: 'card-fireball', refType: 'handler', refId: 'pyro-dmg-per-fm' },
 *   ],
 *   registries: {
 *     handler: new Set(['burn-apply-damage']),  // pyro-dmg-per-fm 未注册 → 报错
 *   },
 * });
 * // errors: [{ sourceLabel: 'CardDef.effects', sourceId: 'card-fireball', refType: 'handler', refId: 'pyro-dmg-per-fm', message: '...' }]
 * ```
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 单条引用链
 */
export interface RefChain {
    /** 来源标签（用于错误消息）：如 "TokenDef.passiveTrigger" / "AbilityDef.effect" */
    sourceLabel: string;
    /** 来源实体 ID：如 token/ability/card 的 ID */
    sourceId: string;
    /** 引用类型：'handler' | 'atlas' | 'i18n' | 'visual' 或自定义 */
    refType: string;
    /** 被引用的 ID */
    refId: string;
}

/**
 * 验证配置
 */
export interface RefValidationConfig {
    /** 所有需要验证的引用链 */
    chains: RefChain[];
    /** refType → 已注册 ID 集合 */
    registries: Record<string, Set<string>>;
}

/**
 * 引用错误
 */
export interface RefError {
    /** 来源标签 */
    sourceLabel: string;
    /** 来源实体 ID */
    sourceId: string;
    /** 引用类型 */
    refType: string;
    /** 缺失的 ID */
    refId: string;
    /** 人类可读的错误消息 */
    message: string;
}

// ============================================================================
// 验证函数
// ============================================================================

/**
 * 验证所有引用链的完整性
 *
 * 对每条 RefChain，检查 refId 是否存在于对应 refType 的 registry 中。
 * 返回所有断裂的引用。
 */
export function validateReferences(config: RefValidationConfig): RefError[] {
    const errors: RefError[] = [];

    for (const chain of config.chains) {
        const registry = config.registries[chain.refType];
        if (!registry) {
            errors.push({
                ...chain,
                message: `No registry provided for refType "${chain.refType}"`,
            });
            continue;
        }
        if (!registry.has(chain.refId)) {
            errors.push({
                ...chain,
                message: `${chain.sourceLabel} [${chain.sourceId}] references ${chain.refType} "${chain.refId}", but it is not registered`,
            });
        }
    }

    return errors;
}

// ============================================================================
// 辅助：从定义数组中提取引用链
// ============================================================================

/**
 * 从实体定义数组中批量提取引用链
 *
 * @param defs 实体定义数组
 * @param extractor 从单个定义中提取 RefChain 数组的函数
 */
export function extractRefChains<TDef>(
    defs: TDef[],
    extractor: (def: TDef) => RefChain[],
): RefChain[] {
    return defs.flatMap(extractor);
}
