/**
 * 引擎层 - 交互完整性审计套件工厂
 *
 * 通用交互完整性检查，覆盖两种交互模式：
 *
 * 模式 A（UI 状态机）：SummonerWars 风格
 *   UI 逐步收集 payload 字段 → 最终发送给执行器
 *   → 使用 interactionChainAudit.ts 的三类检查
 *
 * 模式 B（Interaction 链）：SmashUp 风格
 *   执行器创建 createSimpleChoice(sourceId) → 玩家选择 → InteractionHandler 处理
 *   → 使用本文件的 Handler 注册覆盖检查
 *
 * 两种模式可交叉使用：一个游戏可能同时有两种交互模式。
 *
 * 检查项：
 * 1. Handler 注册覆盖 — 所有声明的 interactionSourceId 都有对应 handler
 * 2. 链式完整性 — handler 产出的后续 sourceId 也有对应 handler
 * 3. 孤儿 Handler — 注册了 handler 但没有能力引用（可选警告）
 */

import { describe, expect, it } from 'vitest';

// ============================================================================
// 通用类型
// ============================================================================

/**
 * 可审计的交互能力（模式 B：Interaction 链）
 *
 * 游戏层从卡牌/能力定义映射到此接口。
 */
export interface AuditableInteractionSource {
  /** 能力/卡牌 ID */
  id: string;
  /** 显示名称（用于错误消息） */
  name: string;
  /**
   * 该能力创建的 Interaction sourceId 列表
   *
   * 从代码中提取：createSimpleChoice(..., sourceId) 的第 5 个参数。
   * 一个能力可能创建多个不同 sourceId 的 Interaction。
   */
  interactionSourceIds: string[];
}

/**
 * Handler 链声明
 *
 * 描述一个 InteractionHandler 处理后可能创建的后续 Interaction。
 * 用于检测多步链的完整性（如 zombie_lord_choose_minion → zombie_lord_choose_base）。
 */
export interface HandlerChainLink {
  /** 当前 handler 的 sourceId */
  sourceId: string;
  /** 该 handler 可能创建的后续 Interaction sourceId 列表 */
  producesSourceIds: string[];
}

// ============================================================================
// 1. Handler 注册覆盖检查
// ============================================================================

export interface HandlerCoverageConfig {
  /** describe 块名称 */
  suiteName: string;
  /** 所有可审计的交互能力 */
  sources: AuditableInteractionSource[];
  /** 已注册的 handler sourceId 集合 */
  registeredHandlerIds: Set<string>;
  /** 白名单：某些 sourceId 由特殊系统处理 */
  whitelist?: Set<string>;
}

/**
 * 生成 Handler 注册覆盖测试
 *
 * 确保所有能力创建的 Interaction sourceId 都有对应的 handler 注册。
 */
export function createHandlerCoverageCheck(config: HandlerCoverageConfig): void {
  describe(config.suiteName, () => {
    it('存在需要审计的交互能力', () => {
      const total = config.sources.reduce((n, s) => n + s.interactionSourceIds.length, 0);
      expect(total).toBeGreaterThan(0);
    });

    it('所有 Interaction sourceId 都有对应 handler', () => {
      const whitelist = config.whitelist ?? new Set();
      const violations: string[] = [];

      for (const source of config.sources) {
        for (const sourceId of source.interactionSourceIds) {
          if (whitelist.has(sourceId)) continue;
          if (!config.registeredHandlerIds.has(sourceId)) {
            violations.push(
              `  [${source.id}]（${source.name}）创建了 sourceId="${sourceId}" 但无对应 handler`
            );
          }
        }
      }

      if (violations.length > 0) {
        expect(violations, '以下 Interaction sourceId 缺少 handler 注册').toEqual([]);
      }
    });
  });
}

// ============================================================================
// 2. 链式完整性检查
// ============================================================================

export interface ChainCompletenessConfig {
  /** describe 块名称 */
  suiteName: string;
  /** Handler 链声明列表 */
  chains: HandlerChainLink[];
  /** 已注册的 handler sourceId 集合 */
  registeredHandlerIds: Set<string>;
}

/**
 * 生成链式完整性测试
 *
 * 确保 handler 内部创建的后续 Interaction 也有对应 handler。
 * 检测多步链断裂（如 zombie_lord_choose_minion → zombie_lord_choose_base 缺失）。
 */
export function createChainCompletenessCheck(config: ChainCompletenessConfig): void {
  describe(config.suiteName, () => {
    if (config.chains.length === 0) {
      it('无链式交互声明（跳过）', () => {
        expect(true).toBe(true);
      });
      return;
    }

    it('所有链式 handler 产出的后续 sourceId 都有对应 handler', () => {
      const violations: string[] = [];

      for (const link of config.chains) {
        for (const nextId of link.producesSourceIds) {
          if (!config.registeredHandlerIds.has(nextId)) {
            violations.push(
              `  handler "${link.sourceId}" 产出后续 sourceId="${nextId}" 但无对应 handler`
            );
          }
        }
      }

      if (violations.length > 0) {
        expect(violations, '以下链式 Interaction 缺少后续 handler').toEqual([]);
      }
    });
  });
}

// ============================================================================
// 3. 孤儿 Handler 检查（可选）
// ============================================================================

export interface OrphanHandlerConfig {
  /** describe 块名称 */
  suiteName: string;
  /** 所有可审计的交互能力 */
  sources: AuditableInteractionSource[];
  /** Handler 链声明列表 */
  chains: HandlerChainLink[];
  /** 已注册的 handler sourceId 集合 */
  registeredHandlerIds: Set<string>;
  /** 白名单：某些 handler 由外部系统触发 */
  whitelist?: Set<string>;
}

/**
 * 生成孤儿 Handler 检查测试
 *
 * 检测注册了 handler 但没有任何能力或链式 handler 引用的 sourceId。
 * 这通常意味着死代码或重构遗留。
 */
export function createOrphanHandlerCheck(config: OrphanHandlerConfig): void {
  describe(config.suiteName, () => {
    it('所有注册的 handler 都被引用', () => {
      const whitelist = config.whitelist ?? new Set();
      // 收集所有被引用的 sourceId
      const referenced = new Set<string>();
      for (const source of config.sources) {
        for (const id of source.interactionSourceIds) referenced.add(id);
      }
      for (const link of config.chains) {
        for (const id of link.producesSourceIds) referenced.add(id);
      }

      const orphans: string[] = [];
      for (const id of config.registeredHandlerIds) {
        if (whitelist.has(id)) continue;
        if (!referenced.has(id)) {
          orphans.push(`  handler "${id}" 已注册但无能力或链式 handler 引用`);
        }
      }

      if (orphans.length > 0) {
        expect(orphans, '以下 handler 为孤儿（无引用）').toEqual([]);
      }
    });
  });
}

// ============================================================================
// 组合工厂：一键创建完整交互完整性审计套件
// ============================================================================

export interface InteractionCompletenessAuditConfig {
  /** 顶层 describe 名称 */
  suiteName: string;
  /** 所有可审计的交互能力 */
  sources: AuditableInteractionSource[];
  /** 已注册的 handler sourceId 集合 */
  registeredHandlerIds: Set<string>;
  /** Handler 链声明列表（多步链） */
  chains?: HandlerChainLink[];
  /** Handler 覆盖白名单 */
  handlerWhitelist?: Set<string>;
  /** 孤儿 Handler 白名单 */
  orphanWhitelist?: Set<string>;
  /** 是否启用孤儿检查（默认 true） */
  checkOrphans?: boolean;
}

/**
 * 一键创建完整的交互完整性审计套件（模式 B：Interaction 链）
 *
 * 包含三类检查：Handler 注册覆盖、链式完整性、孤儿 Handler。
 */
export function createInteractionCompletenessAuditSuite(config: InteractionCompletenessAuditConfig): void {
  describe(config.suiteName, () => {
    createHandlerCoverageCheck({
      suiteName: 'Handler 注册覆盖',
      sources: config.sources,
      registeredHandlerIds: config.registeredHandlerIds,
      whitelist: config.handlerWhitelist,
    });

    createChainCompletenessCheck({
      suiteName: '链式完整性',
      chains: config.chains ?? [],
      registeredHandlerIds: config.registeredHandlerIds,
    });

    if (config.checkOrphans !== false) {
      createOrphanHandlerCheck({
        suiteName: '孤儿 Handler',
        sources: config.sources,
        chains: config.chains ?? [],
        registeredHandlerIds: config.registeredHandlerIds,
        whitelist: config.orphanWhitelist,
      });
    }
  });
}
