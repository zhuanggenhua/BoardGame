/**
 * 大杀四方 - 审计结果输出格式化工具
 *
 * 提供三种格式化函数，将审计结果转换为可读的 Markdown 矩阵和汇总报告。
 * 审计结果分三类：✅ 一致、⚠️ 偏差、❌ 缺失
 *
 * Requirements: 10.2, 10.4, 10.5
 */

import type { AbilityTag } from '../../domain/types';

// ============================================================================
// 数据模型类型
// ============================================================================

/** 偏差记录 */
export interface DeviationRecord {
    type: 'missing_impl' | 'wrong_impl' | 'extra_impl' | 'value_error' | 'description_mismatch';
    /** 涉及的能力标签或字段 */
    field: string;
    /** 描述侧的值/行为 */
    expected: string;
    /** 实现侧的值/行为 */
    actual: string;
    /** 补充说明 */
    note?: string;
}

/** 单张卡牌的审计结果 */
export interface CardAuditResult {
    defId: string;
    cardName: string;
    cardType: 'minion' | 'action';
    faction: string;
    abilityTags: AbilityTag[];
    i18nDescription: string;
    wikiDescription?: string;
    status: 'consistent' | 'deviation' | 'missing';
    deviations: DeviationRecord[];
}

/** 基地卡审计结果 */
export interface BaseAuditResult {
    defId: string;
    baseName: string;
    faction?: string;
    breakpoint: { expected: number; actual: number; match: boolean };
    vpAwards: { expected: [number, number, number]; actual: [number, number, number]; match: boolean };
    minionPowerBonus?: { expected: number; actual: number; match: boolean };
    abilityStatus: 'consistent' | 'deviation' | 'missing' | 'no_ability';
    deviations: DeviationRecord[];
}

/** 跨派系交叉验证结果 */
export interface CrossFactionResult {
    abilityCategory: string;
    involvedCards: { defId: string; faction: string; description: string }[];
    implementationPaths: { defId: string; path: string }[];
    consistent: boolean;
    inconsistencyNote?: string;
}

/** 交互链审计结果 */
export interface InteractionChainResult {
    sourceId: string;
    defId: string;
    creationSite: string;
    hasHandler: boolean;
    chainSteps?: string[];
}

/** 派系审计汇总 */
export interface FactionAuditSummary {
    factionId: string;
    factionName: string;
    totalCards: number;
    consistent: number;
    deviations: number;
    missing: number;
    cardResults: CardAuditResult[];
}

/** 全局审计汇总 */
export interface GlobalAuditSummary {
    totalCards: number;
    totalBases: number;
    audited: number;
    consistent: number;
    deviations: number;
    missing: number;
    crossFactionIssues: number;
    interactionChainBreaks: number;
    factionSummaries: FactionAuditSummary[];
    baseSummaries: BaseAuditResult[];
    crossFactionResults: CrossFactionResult[];
    interactionChainResults: InteractionChainResult[];
}


// ============================================================================
// 状态图标映射
// ============================================================================

/** 审计状态 → 显示图标 */
const STATUS_ICON: Record<string, string> = {
    consistent: '✅ 一致',
    deviation: '⚠️ 偏差',
    missing: '❌ 缺失',
    no_ability: '➖ 无能力',
};

/** 获取状态图标文本 */
function getStatusIcon(status: string): string {
    return STATUS_ICON[status] ?? status;
}

// ============================================================================
// 偏差说明格式化
// ============================================================================

/** 偏差类型中文标签 */
const DEVIATION_TYPE_LABEL: Record<DeviationRecord['type'], string> = {
    missing_impl: '缺失实现',
    wrong_impl: '错误实现',
    extra_impl: '多余实现',
    value_error: '数值错误',
    description_mismatch: '描述不一致',
};

/** 格式化单条偏差记录为简短说明 */
function formatDeviation(d: DeviationRecord): string {
    const label = DEVIATION_TYPE_LABEL[d.type];
    const detail = d.note
        ? `${label}: ${d.field} (${d.note})`
        : `${label}: ${d.field} [期望: ${d.expected}, 实际: ${d.actual}]`;
    return detail;
}

/** 格式化偏差列表为单元格内容（多条用分号分隔） */
function formatDeviations(deviations: DeviationRecord[]): string {
    if (deviations.length === 0) return '-';
    return deviations.map(formatDeviation).join('; ');
}

// ============================================================================
// 辅助工具
// ============================================================================

/** 截断文本到指定长度，超出部分用省略号替代 */
function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
}

/** 转义 Markdown 表格中的管道符 */
function escapeCell(text: string): string {
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** 计算百分比并格式化为字符串 */
function pct(count: number, total: number): string {
    if (total === 0) return '0%';
    return `${((count / total) * 100).toFixed(1)}%`;
}

// ============================================================================
// 格式化函数
// ============================================================================

/**
 * 输出派系审计矩阵（Markdown 表格）。
 *
 * 格式：
 * | 卡牌名称 | defId | 类型 | 能力标签 | 描述摘要 | 实现状态 | 偏差说明 |
 */
export function formatFactionAuditMatrix(results: CardAuditResult[]): string {
    const lines: string[] = [];

    // 表头
    lines.push('| 卡牌名称 | defId | 类型 | 能力标签 | 描述摘要 | 实现状态 | 偏差说明 |');
    lines.push('|----------|-------|------|---------|---------|---------|---------|');

    for (const r of results) {
        const name = escapeCell(r.cardName || r.defId);
        const defId = escapeCell(r.defId);
        const cardType = r.cardType === 'minion' ? '随从' : '行动';
        const tags = r.abilityTags.length > 0 ? r.abilityTags.join(', ') : '-';
        const desc = escapeCell(truncate(r.i18nDescription || '(无描述)', 40));
        const status = getStatusIcon(r.status);
        const devNote = escapeCell(formatDeviations(r.deviations));

        lines.push(`| ${name} | ${defId} | ${cardType} | ${tags} | ${desc} | ${status} | ${devNote} |`);
    }

    return lines.join('\n');
}

/**
 * 输出基地审计矩阵（Markdown 表格）。
 *
 * 格式：
 * | 基地名称 | defId | BP | VP | 能力描述 | 数值状态 | 能力状态 | 偏差说明 |
 */
export function formatBaseAuditMatrix(results: BaseAuditResult[]): string {
    const lines: string[] = [];

    // 表头
    lines.push('| 基地名称 | defId | BP | VP | 能力描述 | 数值状态 | 能力状态 | 偏差说明 |');
    lines.push('|----------|-------|----|----|---------|---------|---------|---------|');

    for (const r of results) {
        const name = escapeCell(r.baseName || r.defId);
        const defId = escapeCell(r.defId);

        // BP 列：显示实际值，不匹配时标注
        const bpText = r.breakpoint.match
            ? String(r.breakpoint.actual)
            : `${r.breakpoint.actual} (期望${r.breakpoint.expected})`;

        // VP 列：显示实际值，不匹配时标注
        const vpActual = r.vpAwards.actual.join('/');
        const vpText = r.vpAwards.match
            ? vpActual
            : `${vpActual} (期望${r.vpAwards.expected.join('/')})`;

        // 能力描述：从偏差中提取或标记无能力
        const abilityDesc = r.abilityStatus === 'no_ability' ? '(无特殊能力)' : '-';

        // 数值状态：BP + VP + minionPowerBonus 综合判定
        const bpOk = r.breakpoint.match;
        const vpOk = r.vpAwards.match;
        const bonusOk = r.minionPowerBonus ? r.minionPowerBonus.match : true;
        const numericStatus = (bpOk && vpOk && bonusOk) ? '✅' : '⚠️';

        const abilityStatusText = getStatusIcon(r.abilityStatus);
        const devNote = escapeCell(formatDeviations(r.deviations));

        lines.push(
            `| ${name} | ${defId} | ${bpText} | ${vpText} | ${abilityDesc} | ${numericStatus} | ${abilityStatusText} | ${devNote} |`,
        );
    }

    return lines.join('\n');
}

/**
 * 输出全局审计汇总报告。
 *
 * 格式：
 * ```
 * 总卡牌数: N
 * 已审计数: N
 * ├── ✅ 一致: N (xx%)
 * ├── ⚠️ 偏差: N (xx%)
 * └── ❌ 缺失: N (xx%)
 * 交叉不一致: N 处
 * 交互链断裂: N 处
 * ```
 */
export function formatGlobalSummary(summary: GlobalAuditSummary): string {
    const lines: string[] = [];

    lines.push(`总卡牌数: ${summary.totalCards}`);
    lines.push(`总基地数: ${summary.totalBases}`);
    lines.push(`已审计数: ${summary.audited}`);
    lines.push(`├── ✅ 一致: ${summary.consistent} (${pct(summary.consistent, summary.audited)})`);
    lines.push(`├── ⚠️ 偏差: ${summary.deviations} (${pct(summary.deviations, summary.audited)})`);
    lines.push(`└── ❌ 缺失: ${summary.missing} (${pct(summary.missing, summary.audited)})`);
    lines.push(`交叉不一致: ${summary.crossFactionIssues} 处`);
    lines.push(`交互链断裂: ${summary.interactionChainBreaks} 处`);

    // 派系明细
    if (summary.factionSummaries.length > 0) {
        lines.push('');
        lines.push('## 派系明细');
        lines.push('| 派系 | 总数 | ✅ 一致 | ⚠️ 偏差 | ❌ 缺失 |');
        lines.push('|------|------|--------|--------|--------|');
        for (const fs of summary.factionSummaries) {
            lines.push(
                `| ${fs.factionName} | ${fs.totalCards} | ${fs.consistent} | ${fs.deviations} | ${fs.missing} |`,
            );
        }
    }

    return lines.join('\n');
}
