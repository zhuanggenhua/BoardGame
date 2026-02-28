/**
 * ActionLog 通用辅助工具
 *
 * 提供跨游戏复用的日志片段构建能力，游戏层只需实现 DamageSourceResolver
 * 接口，无需重复编写 breakdown 构建逻辑。
 *
 * 设计原则（面向百游戏）：
 * - 游戏层声明数据（sourceId、damage、modifiers），框架层负责渲染逻辑
 * - DamageSourceResolver 是唯一需要游戏层实现的接口（约 10-20 行）
 * - 支持三种场景：纯来源标注、带 breakdown tooltip、完整 before+breakdown+after 模式
 */

import type { ActionLogSegment, BreakdownLine } from '../types';
import type { DamageBreakdown } from './damageCalculation';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 来源标签（解析后的可显示标签）
 */
export interface SourceLabel {
    /** 显示文本（纯文本或 i18n key） */
    label: string;
    /** 是否为 i18n key */
    isI18n: boolean;
    /** i18n namespace（isI18n 为 true 时必填） */
    ns?: string;
}

/**
 * 伤害来源解析器接口
 *
 * 游戏层实现此接口，将游戏特定的 sourceId 翻译为可显示标签。
 * 每个游戏只需实现一次，约 10-20 行代码。
 *
 * @example
 * ```ts
 * // SW 游戏层实现
 * const swDamageSourceResolver: DamageSourceResolver = {
 *   resolve(sourceId) {
 *     const ability = abilityRegistry.get(sourceId);
 *     if (ability?.name) return { label: ability.name, isI18n: ability.name.includes('.'), ns: SW_NS };
 *     const reasonLabels: Record<string, string> = {
 *       curse: 'actionLog.damageReason.curse',
 *       entangle: 'actionLog.damageReason.entangle',
 *     };
 *     if (reasonLabels[sourceId]) return { label: reasonLabels[sourceId], isI18n: true, ns: SW_NS };
 *     return null;
 *   }
 * };
 * ```
 */
export interface DamageSourceResolver {
    /**
     * 将 sourceId 解析为可显示标签
     * @param sourceId 来源 ID（技能 ID、reason 字符串等）
     * @returns 标签信息，无法解析时返回 null
     */
    resolve(sourceId: string): SourceLabel | null;
}

/**
 * 标准化伤害事件 payload 接口
 *
 * 游戏层的伤害事件 payload 应包含这些字段（可选），
 * 框架层根据这些字段自动生成来源标注。
 */
export interface DamageLogPayload {
    /** 实际伤害数值 */
    damage?: number;
    /** 来源单位/实体 ID（用于卡牌 segment） */
    sourceEntityId?: string;
    /** 来源技能/能力 ID */
    sourceAbilityId?: string;
    /** 来源原因（如 'curse'、'entangle'、'trample'） */
    reason?: string;
    /** 完整 breakdown（来自 damageCalculation 管线） */
    breakdown?: DamageBreakdown;
    /** 旧格式修改器列表（向后兼容） */
    modifiers?: Array<{
        type: string;
        value: number;
        sourceId: string;
        sourceName?: string;
    }>;
}

// ============================================================================
// 核心工具函数
// ============================================================================

/**
 * 从 payload 中提取来源 ID（优先级：sourceAbilityId > reason > sourceEntityId）
 */
function extractSourceId(payload: DamageLogPayload): string | undefined {
    return payload.sourceAbilityId ?? payload.reason ?? undefined;
}

/**
 * 构建 breakdown segment（带 tooltip 的数值片段）
 *
 * 适用于有修改器明细的伤害（如 DiceThrone 的技能伤害）。
 * 游戏层只需提供 payload + resolver，框架层自动构建 BreakdownLine[]。
 *
 * @param damage 最终伤害数值
 * @param payload 伤害 payload（含 breakdown/modifiers/sourceId）
 * @param resolver 游戏层来源解析器
 * @param fallbackNs 无法解析时的 i18n namespace（用于 fallback 文案）
 * @param options 可选配置（自定义基础值标签，不同游戏可使用不同标签如"基础伤害"/"基础战力"/"基础力量"）
 */
export function buildDamageBreakdownSegment(
    damage: number,
    payload: DamageLogPayload,
    resolver: DamageSourceResolver,
    fallbackNs?: string,
    options?: {
        /** 自定义基础值标签（默认 'actionLog.damageSource.original'） */
        baseLabel?: string;
        baseLabelIsI18n?: boolean;
        baseLabelNs?: string;
    },
): ActionLogSegment {
    const lines: BreakdownLine[] = [];
    const sourceId = extractSourceId(payload);
    const source = sourceId ? resolver.resolve(sourceId) : null;

    if (payload.breakdown) {
        // 新管线格式：base + steps
        const { breakdown } = payload;
        let baseLabel = breakdown.base.sourceName || breakdown.base.sourceId;
        let baseLabelIsI18n = breakdown.base.sourceNameIsI18n ?? false;
        let baseLabelNs: string | undefined;

        if (!baseLabelIsI18n && source) {
            baseLabel = source.label;
            baseLabelIsI18n = source.isI18n;
            baseLabelNs = source.ns;
        }

        lines.push({
            label: baseLabel,
            labelIsI18n: baseLabelIsI18n,
            labelNs: baseLabelNs,
            value: breakdown.base.value,
            color: 'neutral',
        });

        breakdown.steps.forEach(step => {
            lines.push({
                label: step.sourceName || step.sourceId,
                labelIsI18n: step.sourceNameIsI18n ?? false,
                labelNs: step.sourceNameIsI18n ? fallbackNs : undefined,
                value: step.value,
                color: step.value > 0 ? 'positive' : 'negative',
            });
        });
    } else if (payload.modifiers && payload.modifiers.length > 0) {
        // 旧格式（向后兼容）：推算基础伤害 + 各修改器
        const modTotal = payload.modifiers.reduce((sum, m) => sum + m.value, 0);
        const baseDamage = damage - modTotal;

        // 使用自定义基础值标签或默认标签
        const effectiveBaseLabel = options?.baseLabel ?? 'actionLog.damageSource.original';
        const effectiveBaseLabelIsI18n = options?.baseLabel ? (options.baseLabelIsI18n ?? false) : true;
        const effectiveBaseLabelNs = options?.baseLabel ? options.baseLabelNs : fallbackNs;

        lines.push({
            label: effectiveBaseLabel,
            labelIsI18n: effectiveBaseLabelIsI18n,
            labelNs: effectiveBaseLabelNs,
            value: baseDamage,
            color: 'neutral',
        });
        payload.modifiers.forEach(mod => {
            const isI18n = !!mod.sourceName?.includes('.');
            lines.push({
                label: mod.sourceName || mod.sourceId || mod.type,
                labelIsI18n: isI18n,
                labelNs: isI18n ? fallbackNs : undefined,
                value: mod.value,
                color: mod.value > 0 ? 'positive' : 'negative',
            });
        });
    } else if (source) {
        // 无修改器但有来源：显示来源名 + 数值
        lines.push({
            label: source.label,
            labelIsI18n: source.isI18n,
            labelNs: source.ns,
            value: damage,
            color: 'neutral',
        });
    }

    return {
        type: 'breakdown',
        displayText: String(damage),
        lines,
    };
}



/**
 * 构建伤害来源标注 segments（轻量版，无 breakdown tooltip）
 *
 * 适用于不需要 breakdown 明细的场景（如 SW 的单位伤害）。
 * 返回 0-2 个 segment：来源前缀 + 来源标签（或卡牌 segment）。
 *
 * @param payload 伤害 payload
 * @param resolver 游戏层来源解析器
 * @param ns i18n namespace（用于"来自"前缀文案）
 * @param prefixKey "来自"前缀的 i18n key（默认 'actionLog.damageFrom'）
 * @param buildCardSegment 可选：将 sourceEntityId 转为 card segment 的函数
 */
export function buildDamageSourceAnnotation(
    payload: DamageLogPayload,
    resolver: DamageSourceResolver,
    ns: string,
    prefixKey = 'actionLog.damageFrom',
    buildCardSegment?: (entityId: string) => ActionLogSegment | null,
): ActionLogSegment[] {
    const segments: ActionLogSegment[] = [];

    // 优先：来源实体（卡牌 segment）
    if (payload.sourceEntityId && buildCardSegment) {
        const cardSeg = buildCardSegment(payload.sourceEntityId);
        if (cardSeg) {
            segments.push({ type: 'i18n', ns, key: prefixKey });
            segments.push(cardSeg);
            return segments;
        }
    }

    // 其次：来源技能/reason（文本 segment）
    const sourceId = extractSourceId(payload);
    if (sourceId) {
        const source = resolver.resolve(sourceId);
        if (source) {
            segments.push({ type: 'i18n', ns, key: prefixKey });
            if (source.isI18n) {
                segments.push({ type: 'i18n', ns: source.ns ?? ns, key: source.label });
            } else {
                segments.push({ type: 'text', text: source.label });
            }
        }
    }

    return segments;
}
