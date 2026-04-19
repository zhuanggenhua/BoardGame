/**
 * 王权骰铸 - 审计结果输出格式化工具
 *
 * 提供五种格式化函数，将审计结果转换为可读的 Markdown 矩阵和汇总报告。
 * 审计结果分三类：✅ 一致、❌ 差异、⚠️ 需人工验证
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type { Severity, DiscrepancyType } from './auditUtils';

// ============================================================================
// 数据模型类型
// ============================================================================

/** 单条差异记录 */
export interface DiscrepancyRecord {
  heroId: string;
  /** 审计对象类型 */
  objectType: 'ability' | 'token' | 'hero_card' | 'common_card';
  /** 对象名称 */
  objectName: string;
  /** 对象 ID */
  objectId: string;
  /** 能力等级（仅 ability 类型） */
  level?: 1 | 2 | 3;
  /** 差异维度 */
  dimension: string;
  /** 差异类型 */
  type: DiscrepancyType;
  /** Wiki 值 */
  wikiValue: string;
  /** 代码值 */
  codeValue: string;
  /** 严重程度 */
  severity: Severity;
  /** 补充说明 */
  note?: string;
}

/** 角色审计结果 */
export interface HeroAuditResult {
  heroId: string;
  heroName: string;
  /** 能力差异列表 */
  abilityDiscrepancies: DiscrepancyRecord[];
  /** Token 差异列表 */
  tokenDiscrepancies: DiscrepancyRecord[];
  /** 专属卡差异列表 */
  heroCardDiscrepancies: DiscrepancyRecord[];
}

/** 全局审计汇总 */
export interface AuditSummary {
  /** 各角色审计结果 */
  heroResults: HeroAuditResult[];
  /** 通用卡差异列表 */
  commonCardDiscrepancies: DiscrepancyRecord[];
  /** i18n 差异列表 */
  i18nDiscrepancies: DiscrepancyRecord[];
  /** 按严重程度统计 */
  bySeverity: { high: number; medium: number; low: number };
  /** 按角色统计 */
  byHero: Record<string, number>;
}


// ============================================================================
// 辅助工具
// ============================================================================

/** 严重程度中文映射 */
const SEVERITY_LABEL: Record<Severity, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/** 状态图标：根据差异记录数量判断 */
function getStatusIcon(hasDiscrepancy: boolean, needsManualCheck?: boolean): string {
  if (needsManualCheck) return '⚠️';
  return hasDiscrepancy ? '❌' : '✅';
}

/** 转义 Markdown 表格中的管道符和换行 */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** 格式化等级显示 */
function formatLevel(level?: 1 | 2 | 3): string {
  if (!level) return '-';
  return `L${level}`;
}

/** 格式化严重程度显示 */
function formatSeverity(severity: Severity): string {
  return SEVERITY_LABEL[severity];
}

// ============================================================================
// 格式化函数
// ============================================================================

/**
 * 输出能力审计矩阵 Markdown 表格
 *
 * 格式：
 * | 能力名称 | ID | 等级 | 维度 | Wiki 值 | 代码值 | 状态 | 严重程度 |
 */
export function formatAbilityAuditMatrix(results: DiscrepancyRecord[]): string {
  const lines: string[] = [];

  lines.push('| 能力名称 | ID | 等级 | 维度 | Wiki 值 | 代码值 | 状态 | 严重程度 |');
  lines.push('|----------|-----|------|------|---------|--------|------|---------|');

  for (const r of results) {
    const name = escapeCell(r.objectName);
    const id = escapeCell(r.objectId);
    const level = formatLevel(r.level);
    const dimension = escapeCell(r.dimension);
    const wikiVal = escapeCell(r.wikiValue);
    const codeVal = escapeCell(r.codeValue);
    const needsManual = r.type === 'description_mismatch' && r.note?.includes('需人工验证');
    const status = getStatusIcon(true, needsManual);
    const severity = formatSeverity(r.severity);

    lines.push(`| ${name} | ${id} | ${level} | ${dimension} | ${wikiVal} | ${codeVal} | ${status} | ${severity} |`);
  }

  if (results.length === 0) {
    lines.push('| (无差异) | - | - | - | - | - | ✅ | - |');
  }

  return lines.join('\n');
}

/**
 * 输出 Token 审计矩阵 Markdown 表格
 *
 * 格式：
 * | Token 名称 | ID | 维度 | Wiki 值 | 代码值 | 状态 | 严重程度 |
 */
export function formatTokenAuditMatrix(results: DiscrepancyRecord[]): string {
  const lines: string[] = [];

  lines.push('| Token 名称 | ID | 维度 | Wiki 值 | 代码值 | 状态 | 严重程度 |');
  lines.push('|-----------|-----|------|---------|--------|------|---------|');

  for (const r of results) {
    const name = escapeCell(r.objectName);
    const id = escapeCell(r.objectId);
    const dimension = escapeCell(r.dimension);
    const wikiVal = escapeCell(r.wikiValue);
    const codeVal = escapeCell(r.codeValue);
    const needsManual = r.type === 'description_mismatch' && r.note?.includes('需人工验证');
    const status = getStatusIcon(true, needsManual);
    const severity = formatSeverity(r.severity);

    lines.push(`| ${name} | ${id} | ${dimension} | ${wikiVal} | ${codeVal} | ${status} | ${severity} |`);
  }

  if (results.length === 0) {
    lines.push('| (无差异) | - | - | - | - | ✅ | - |');
  }

  return lines.join('\n');
}

/**
 * 输出卡牌审计矩阵 Markdown 表格（专属卡+通用卡共用）
 *
 * 格式：
 * | 卡牌名称 | ID | 维度 | Wiki 值 | 代码值 | 状态 | 严重程度 |
 */
export function formatCardAuditMatrix(results: DiscrepancyRecord[]): string {
  const lines: string[] = [];

  lines.push('| 卡牌名称 | ID | 维度 | Wiki 值 | 代码值 | 状态 | 严重程度 |');
  lines.push('|----------|-----|------|---------|--------|------|---------|');

  for (const r of results) {
    const name = escapeCell(r.objectName);
    const id = escapeCell(r.objectId);
    const dimension = escapeCell(r.dimension);
    const wikiVal = escapeCell(r.wikiValue);
    const codeVal = escapeCell(r.codeValue);
    const needsManual = r.type === 'description_mismatch' && r.note?.includes('需人工验证');
    const status = getStatusIcon(true, needsManual);
    const severity = formatSeverity(r.severity);

    lines.push(`| ${name} | ${id} | ${dimension} | ${wikiVal} | ${codeVal} | ${status} | ${severity} |`);
  }

  if (results.length === 0) {
    lines.push('| (无差异) | - | - | - | - | ✅ | - |');
  }

  return lines.join('\n');
}


/**
 * 输出单角色完整审计报告 Markdown
 *
 * 包含：角色标题、能力审计矩阵、Token 审计矩阵、专属卡审计矩阵
 */
export function formatHeroAuditReport(heroResult: HeroAuditResult): string {
  const lines: string[] = [];

  // 角色标题
  lines.push(`# ${heroResult.heroName}（${heroResult.heroId}）审计报告`);
  lines.push('');

  // 能力审计
  const abilityCount = heroResult.abilityDiscrepancies.length;
  lines.push(`## 能力审计（差异: ${abilityCount}）`);
  lines.push('');
  lines.push(formatAbilityAuditMatrix(heroResult.abilityDiscrepancies));
  lines.push('');

  // Token 审计
  const tokenCount = heroResult.tokenDiscrepancies.length;
  lines.push(`## Token 审计（差异: ${tokenCount}）`);
  lines.push('');
  lines.push(formatTokenAuditMatrix(heroResult.tokenDiscrepancies));
  lines.push('');

  // 专属卡审计
  const cardCount = heroResult.heroCardDiscrepancies.length;
  lines.push(`## 专属卡审计（差异: ${cardCount}）`);
  lines.push('');
  lines.push(formatCardAuditMatrix(heroResult.heroCardDiscrepancies));
  lines.push('');

  // 角色汇总
  const total = abilityCount + tokenCount + cardCount;
  lines.push(`## 角色汇总`);
  lines.push('');
  lines.push(`- 能力差异: ${abilityCount}`);
  lines.push(`- Token 差异: ${tokenCount}`);
  lines.push(`- 专属卡差异: ${cardCount}`);
  lines.push(`- 总计: ${total}`);

  return lines.join('\n');
}

/**
 * 输出全局审计汇总统计 Markdown
 *
 * 包含：角色差异汇总表、通用卡差异数、按严重程度统计
 */
export function formatGlobalSummary(summary: AuditSummary): string {
  const lines: string[] = [];

  lines.push('## 汇总');
  lines.push('');

  // 角色差异汇总表
  lines.push('| 角色 | 能力差异 | Token 差异 | 专属卡差异 | 总计 |');
  lines.push('|------|---------|-----------|-----------|------|');

  for (const hero of summary.heroResults) {
    const abilityCount = hero.abilityDiscrepancies.length;
    const tokenCount = hero.tokenDiscrepancies.length;
    const cardCount = hero.heroCardDiscrepancies.length;
    const total = abilityCount + tokenCount + cardCount;

    lines.push(
      `| ${hero.heroName} | ${abilityCount} | ${tokenCount} | ${cardCount} | ${total} |`,
    );
  }

  lines.push('');

  // 通用卡差异
  lines.push(`通用卡差异: ${summary.commonCardDiscrepancies.length}`);
  lines.push('');

  // i18n 差异
  if (summary.i18nDiscrepancies.length > 0) {
    lines.push(`i18n 差异: ${summary.i18nDiscrepancies.length}`);
    lines.push('');
  }

  // 按严重程度统计
  lines.push('按严重程度:');
  lines.push(`- 高: ${summary.bySeverity.high}`);
  lines.push(`- 中: ${summary.bySeverity.medium}`);
  if (summary.bySeverity.low > 0) {
    lines.push(`- 低: ${summary.bySeverity.low}`);
  }

  return lines.join('\n');
}
