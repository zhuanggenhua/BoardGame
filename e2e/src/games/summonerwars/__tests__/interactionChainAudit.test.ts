/**
 * SummonerWars 交互链完整性审计测试
 *
 * 验证多步交互技能的 UI 交互步骤是否完整覆盖了执行器所需的 payload 字段。
 * 使用引擎层 interactionChainAudit 工厂函数。
 *
 * 三类检查：
 * 1. 声明完整性 — 多步交互技能是否都声明了 interactionChain
 * 2. 步骤覆盖 — steps 产出 ⊇ payloadContract.required
 * 3. 契约对齐 — AbilityDef 的 payloadContract 与执行器注册的 payloadContract 一致
 */

import { abilityRegistry } from '../domain/abilities';
import type { AbilityDef } from '../domain/abilities';
import type { AuditableInteractionAbility } from '../../../engine/testing/interactionChainAudit';
import { createInteractionChainAuditSuite } from '../../../engine/testing/interactionChainAudit';

// ============================================================================
// 执行器 payload 契约（手动声明，与执行器代码中的 payload 解构保持同步）
//
// 为什么不从 abilityExecutorRegistry 动态读取？
// executors/index.ts 使用副作用导入模式，与 abilities.ts 存在模块初始化顺序问题。
// 手动声明作为"第二来源"，测试会校验它与 AbilityDef.interactionChain 的一致性。
// ============================================================================

const EXECUTOR_CONTRACTS = new Map<string, { required: string[]; optional?: string[] }>([
  // 亡灵法师
  ['revive_undead', { required: ['targetCardId', 'targetPosition'] }],
  // 极地矮人
  ['structure_shift', { required: ['targetPosition', 'newPosition'] }],
  ['frost_axe', { required: ['choice'], optional: ['targetPosition'] }],
  // 炽原精灵
  ['withdraw', { required: ['costType', 'targetPosition'] }],
  ['spirit_bond', { required: ['choice'], optional: ['targetPosition'] }],
  // 洞穴地精
  ['feed_beast', { required: ['choice'], optional: ['targetPosition'] }],
  // 欺心巫族
  ['high_telekinesis', { required: ['targetPosition', 'newPosition'] }],
  ['telekinesis', { required: ['targetPosition', 'newPosition'] }],
  ['mind_transmission', { required: ['targetPosition'] }],
]);

// ============================================================================
// 辅助：从 AbilityDef 构建可审计对象
// ============================================================================

function buildAuditableAbilities(): AuditableInteractionAbility[] {
  return abilityRegistry.getAll().map((def: AbilityDef) => ({
    id: def.id,
    name: def.name,
    requiresTargetSelection: def.requiresTargetSelection,
    interactionChain: def.interactionChain,
    executorContract: EXECUTOR_CONTRACTS.get(def.id),
  }));
}

/**
 * 判断技能是否需要多步交互
 *
 * 规则：
 * - 已声明 interactionChain → 一定是多步
 * - 执行器声明了 2+ 字段（required + optional）→ 多步
 */
function requiresMultiStep(ability: AuditableInteractionAbility): boolean {
  if (ability.interactionChain) return true;
  if (ability.executorContract) {
    const totalFields = ability.executorContract.required.length
      + (ability.executorContract.optional?.length ?? 0);
    if (totalFields >= 2) return true;
  }
  return false;
}

// ============================================================================
// 白名单
// ============================================================================

/**
 * 由特殊系统处理的多步技能（不走标准 interactionChain）
 * - mind_capture_resolve: Modal 决策驱动
 * - infection: onKill 触发，交互流程由事件驱动而非按钮激活
 */
const DECLARATION_WHITELIST = new Set([
  'mind_capture_resolve',
]);

// ============================================================================
// 测试套件
// ============================================================================

createInteractionChainAuditSuite({
  suiteName: 'SummonerWars 交互链完整性',
  abilities: buildAuditableAbilities(),
  requiresMultiStep,
  declarationWhitelist: DECLARATION_WHITELIST,
});
