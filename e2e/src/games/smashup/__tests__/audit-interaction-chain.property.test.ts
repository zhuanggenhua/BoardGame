// Feature: smashup-full-faction-audit, Property 6: 交互链完整性
/**
 * 大杀四方 - 交互链完整性属性测试
 *
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
 *
 * Property 6: 交互链完整性
 * 对于任意能力执行器中调用 `createSimpleChoice` 或 `queueInteraction` 时使用的 sourceId，
 * interactionHandlers 注册表中必须存在对应的处理函数。
 * 对于多步交互，每个后续步骤的 sourceId 也必须有对应的 handler。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { getInteractionHandlerIds, checkInteractionHandler } from './helpers/auditUtils';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { collectSmashupInteractionAuditAuto } from './helpers/interactionAuditAuto';

// ============================================================================
// 初始化：注册所有能力
// ============================================================================

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 常量
// ============================================================================

/**
 * 已知白名单：这些 sourceId 通过特殊机制处理，不需要标准 handler 注册。
 * - miskatonic_mandatory_reading: resolveOrPrompt 内联回调处理
 */
const HANDLER_WHITELIST = new Set<string>([
    'miskatonic_mandatory_reading',
]);

// ============================================================================
// 数据准备：收集所有 sourceId
// ============================================================================

interface SourceIdEntry {
    sourceId: string;
    /** 来源类型：ability（能力执行器）或 chain（handler 链产出） */
    origin: 'ability' | 'chain';
}

/**
 * 收集所有需要检查的 sourceId。
 * 包括：
 * 1. 能力执行器中 createSimpleChoice/resolveOrPrompt 等调用产生的 sourceId
 * 2. handler 链中后续步骤产生的 sourceId
 */
function collectAllSourceIds(): SourceIdEntry[] {
    const autoResult = collectSmashupInteractionAuditAuto();
    const entries: SourceIdEntry[] = [];
    const seen = new Set<string>();

    // 1. 能力执行器中直接创建的 sourceId
    for (const source of autoResult.sources) {
        for (const id of source.interactionSourceIds) {
            if (HANDLER_WHITELIST.has(id)) continue;
            if (seen.has(id)) continue;
            seen.add(id);
            entries.push({ sourceId: id, origin: 'ability' });
        }
    }

    // 2. handler 链中后续步骤产生的 sourceId
    for (const chain of autoResult.chains) {
        for (const nextId of chain.producesSourceIds) {
            if (HANDLER_WHITELIST.has(nextId)) continue;
            if (seen.has(nextId)) continue;
            seen.add(nextId);
            entries.push({ sourceId: nextId, origin: 'chain' });
        }
    }

    return entries;
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 6: 交互链完整性', () => {
    it('所有能力执行器中创建的 sourceId 在 interactionHandlers 注册表中有对应 handler', () => {
        const entries = collectAllSourceIds();

        // 确保有足够的测试数据
        expect(entries.length).toBeGreaterThan(0);

        fc.assert(
            fc.property(
                fc.constantFrom(...entries),
                (entry: SourceIdEntry) => {
                    const hasHandler = checkInteractionHandler(entry.sourceId);
                    expect(
                        hasHandler,
                        `sourceId "${entry.sourceId}" (来源: ${entry.origin === 'ability' ? '能力执行器' : 'handler 链'}) ` +
                        `未在 interactionHandlers 注册表中注册`,
                    ).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('handler 链中每个后续步骤的 sourceId 也有对应 handler', () => {
        const autoResult = collectSmashupInteractionAuditAuto();
        const chainsWithNext = autoResult.chains.filter(c => c.producesSourceIds.length > 0);

        if (chainsWithNext.length === 0) {
            // 没有多步交互链，跳过
            return;
        }

        interface ChainStep {
            parentSourceId: string;
            nextSourceId: string;
        }

        const steps: ChainStep[] = [];
        for (const chain of chainsWithNext) {
            for (const nextId of chain.producesSourceIds) {
                if (HANDLER_WHITELIST.has(nextId)) continue;
                steps.push({
                    parentSourceId: chain.sourceId,
                    nextSourceId: nextId,
                });
            }
        }

        if (steps.length === 0) return;

        fc.assert(
            fc.property(
                fc.constantFrom(...steps),
                (step: ChainStep) => {
                    const hasHandler = checkInteractionHandler(step.nextSourceId);
                    expect(
                        hasHandler,
                        `多步交互链断裂: handler "${step.parentSourceId}" 产出的后续 sourceId "${step.nextSourceId}" ` +
                        `未在 interactionHandlers 注册表中注册`,
                    ).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });
});
