/**
 * 大杀四方 - 交互完整性审计测试
 *
 * 验证 Interaction 链的完整性：
 * 1. Handler 注册覆盖 — 所有能力创建的 sourceId 都有对应 handler
 * 2. 链式完整性 — handler 产出的后续 sourceId 也有对应 handler
 * 3. 孤儿 Handler — 注册了 handler 但无能力引用
 *
 * 使用引擎层 interactionCompletenessAudit 工厂函数。
 */

import { describe, expect, it } from 'vitest';
import type {
  AuditableInteractionSource,
  HandlerChainLink,
} from '../../../engine/testing/interactionCompletenessAudit';
import { createInteractionCompletenessAuditSuite } from '../../../engine/testing/interactionCompletenessAudit';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { getRegisteredInteractionHandlerIds, clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { collectSmashupInteractionAuditAuto } from './helpers/interactionAuditAuto';

// ============================================================================
// 初始化
// ============================================================================

let _initialized = false;

function ensureInit(): void {
  if (_initialized) return;
  _initialized = true;
  clearRegistry();
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  resetAbilityInit();
  initAllAbilities();
}

function getHandlerIds(): Set<string> {
  ensureInit();
  return getRegisteredInteractionHandlerIds();
}

// ============================================================================
// 自动提取 + 手工补充
// ============================================================================

const AUTO_AUDIT = collectSmashupInteractionAuditAuto();

/**
 * 允许的自动提取告警：
 * - resolveOrPrompt 内部 createSimpleChoice 使用 config.sourceId（变量），
 *   非字符串字面量，属于设计内动态模式。
 */
const AUTO_WARNING_ALLOWLIST = new Set([
  'domain/abilityHelpers.ts::createSimpleChoice 的第5参数(sourceId)不是字符串字面量，无法自动审计',
  'abilities/pirates.ts::createSimpleChoice 的第5参数(sourceId)不是字符串字面量，无法自动审计',
]);

const MANUAL_SOURCE_SUPPLEMENTS: AuditableInteractionSource[] = [];

const MANUAL_CHAIN_SUPPLEMENTS: HandlerChainLink[] = [
  // 多基地计分通过系统阶段推进复用同一 handler，非 handler 内 createSimpleChoice 产出
  { sourceId: 'multi_base_scoring', producesSourceIds: ['multi_base_scoring'] },
];

function mergeSources(
  autoSources: AuditableInteractionSource[],
  supplements: AuditableInteractionSource[],
): AuditableInteractionSource[] {
  const merged = new Map<string, { name: string; ids: Set<string> }>();
  for (const src of [...autoSources, ...supplements]) {
    const existing = merged.get(src.id);
    if (!existing) {
      merged.set(src.id, { name: src.name, ids: new Set(src.interactionSourceIds) });
      continue;
    }
    for (const id of src.interactionSourceIds) existing.ids.add(id);
  }
  return Array.from(merged.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, data]) => ({
      id,
      name: data.name,
      interactionSourceIds: Array.from(data.ids).sort((a, b) => a.localeCompare(b)),
    }));
}

function mergeChains(
  autoChains: HandlerChainLink[],
  supplements: HandlerChainLink[],
): HandlerChainLink[] {
  const merged = new Map<string, Set<string>>();
  for (const chain of [...autoChains, ...supplements]) {
    const set = merged.get(chain.sourceId) ?? new Set<string>();
    for (const id of chain.producesSourceIds) set.add(id);
    merged.set(chain.sourceId, set);
  }
  return Array.from(merged.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sourceId, ids]) => ({
      sourceId,
      producesSourceIds: Array.from(ids).sort((a, b) => a.localeCompare(b)),
    }));
}

const INTERACTION_SOURCES = mergeSources(AUTO_AUDIT.sources, MANUAL_SOURCE_SUPPLEMENTS);
const HANDLER_CHAINS = mergeChains(AUTO_AUDIT.chains, MANUAL_CHAIN_SUPPLEMENTS);

describe('交互自动提取健康检查', () => {
  it('仅存在允许的动态 sourceId 提取告警', () => {
    const warningKeys = AUTO_AUDIT.warnings.map(w => `${w.file}::${w.detail}`);
    const unexpected = warningKeys.filter(k => !AUTO_WARNING_ALLOWLIST.has(k));
    expect(unexpected).toEqual([]);
  });
});

// ============================================================================
// 测试套件
// ============================================================================

ensureInit();

createInteractionCompletenessAuditSuite({
  suiteName: 'SmashUp 交互完整性',
  sources: INTERACTION_SOURCES,
  registeredHandlerIds: getHandlerIds(),
  chains: HANDLER_CHAINS,
  // resolveOrPrompt 内联回调处理：单候选自动执行，多候选时由后续 handler 链处理
  // TODO: 考虑让 resolveOrPrompt 自动注册 handler
  handlerWhitelist: new Set([
    'miskatonic_mandatory_reading',
  ]),
});
