/**
 * 引擎层 - 交互链完整性审计套件工厂
 *
 * 验证多步交互技能的 UI 交互步骤是否完整覆盖了执行器所需的 payload 字段。
 * 解决的核心问题：UI 多步交互链断裂（如"选建筑后缺少选方向步骤"）导致
 * 执行器收到不完整 payload 而静默返回空事件。
 *
 * 三类检查：
 * 1. 声明完整性 — 需要多步交互的技能是否都声明了 interactionChain
 * 2. 步骤覆盖 — interactionChain.steps 产出的字段是否覆盖 payloadContract.required
 * 3. 契约对齐 — AbilityDef 的 payloadContract 与执行器注册的 payloadContract 是否一致
 *
 * 使用方：各游戏的 interactionChainAudit.test.ts
 */

import { describe, expect, it } from 'vitest';
import type { InteractionChain, PayloadContract } from '../primitives/ability';

// ============================================================================
// 通用类型
// ============================================================================

/**
 * 可审计的交互技能最小抽象
 *
 * 游戏层从 AbilityDef 映射到此接口。
 */
export interface AuditableInteractionAbility {
  /** 技能 ID */
  id: string;
  /** 显示名称（用于错误消息） */
  name: string;
  /** 是否需要目标选择 */
  requiresTargetSelection?: boolean;
  /** 交互链声明（多步交互技能必填） */
  interactionChain?: InteractionChain;
  /** 执行器注册的 payload 契约（从 registry.getPayloadContract 获取） */
  executorContract?: PayloadContract;
}

// ============================================================================
// 1. 声明完整性检查
// ============================================================================

export interface DeclarationCompletenessConfig {
  /** describe 块名称 */
  suiteName: string;
  /** 所有可审计技能 */
  abilities: AuditableInteractionAbility[];
  /**
   * 判断技能是否需要多步交互（返回 true 则必须声明 interactionChain）
   * 游戏层提供，因为"多步"的判断标准因游戏而异
   */
  requiresMultiStep: (ability: AuditableInteractionAbility) => boolean;
  /** 白名单：某些技能虽然多步但由特殊系统处理 */
  whitelist?: Set<string>;
}

/**
 * 生成声明完整性测试
 *
 * 确保所有需要多步交互的技能都声明了 interactionChain。
 */
export function createDeclarationCompletenessCheck(config: DeclarationCompletenessConfig): void {
  describe(config.suiteName, () => {
    it('所有多步交互技能都声明了 interactionChain', () => {
      const whitelist = config.whitelist ?? new Set();
      const violations: string[] = [];

      for (const ability of config.abilities) {
        if (whitelist.has(ability.id)) continue;
        if (!config.requiresMultiStep(ability)) continue;
        if (!ability.interactionChain) {
          violations.push(`  [${ability.id}]（${ability.name}）需要多步交互但未声明 interactionChain`);
        }
      }

      if (violations.length > 0) {
        expect(violations, '以下技能缺少 interactionChain 声明').toEqual([]);
      }
    });
  });
}

// ============================================================================
// 2. 步骤覆盖检查
// ============================================================================

export interface StepCoverageConfig {
  /** describe 块名称 */
  suiteName: string;
  /** 所有可审计技能 */
  abilities: AuditableInteractionAbility[];
}

/**
 * 生成步骤覆盖测试
 *
 * 对每个声明了 interactionChain 的技能：
 * - steps 产出的非 optional 字段 ⊇ payloadContract.required
 * - payloadContract.required 中的每个字段都有对应步骤产出
 */
export function createStepCoverageCheck(config: StepCoverageConfig): void {
  describe(config.suiteName, () => {
    const withChain = config.abilities.filter(a => a.interactionChain);

    it('存在已声明 interactionChain 的技能', () => {
      expect(withChain.length).toBeGreaterThan(0);
    });

    it('所有 interactionChain 的步骤产出覆盖 payloadContract.required', () => {
      const violations: string[] = [];

      for (const ability of withChain) {
        const chain = ability.interactionChain!;
        const produced = new Set(chain.steps.map(s => s.producesField));
        for (const field of chain.payloadContract.required) {
          if (!produced.has(field)) {
            violations.push(
              `  [${ability.id}]（${ability.name}）payloadContract 要求 "${field}" 但无步骤产出`
            );
          }
        }
      }

      if (violations.length > 0) {
        expect(violations, '以下技能的交互步骤未覆盖必需字段').toEqual([]);
      }
    });

    it('所有非 optional 步骤产出的字段都在 payloadContract 中声明', () => {
      const violations: string[] = [];

      for (const ability of withChain) {
        const chain = ability.interactionChain!;
        const allDeclared = new Set([
          ...chain.payloadContract.required,
          ...(chain.payloadContract.optional ?? []),
        ]);
        for (const step of chain.steps) {
          if (step.optional) continue;
          if (!allDeclared.has(step.producesField)) {
            violations.push(
              `  [${ability.id}]（${ability.name}）步骤 "${step.step}" 产出 "${step.producesField}" 但 payloadContract 未声明`
            );
          }
        }
      }

      if (violations.length > 0) {
        expect(violations, '以下步骤产出的字段未在 payloadContract 中声明').toEqual([]);
      }
    });
  });
}

// ============================================================================
// 3. 契约对齐检查
// ============================================================================

export interface ContractAlignmentConfig {
  /** describe 块名称 */
  suiteName: string;
  /** 所有可审计技能 */
  abilities: AuditableInteractionAbility[];
}

/**
 * 生成契约对齐测试
 *
 * 对同时有 interactionChain.payloadContract 和 executorContract 的技能：
 * - 执行器 required ⊆ 定义 required ∪ optional
 * - 定义 required ⊆ 执行器 required ∪ optional（双向校验）
 */
export function createContractAlignmentCheck(config: ContractAlignmentConfig): void {
  describe(config.suiteName, () => {
    const withBoth = config.abilities.filter(a => a.interactionChain && a.executorContract);

    it('存在同时声明了两端契约的技能', () => {
      expect(withBoth.length).toBeGreaterThan(0);
    });

    it('执行器 required 字段被 AbilityDef payloadContract 覆盖', () => {
      const violations: string[] = [];

      for (const ability of withBoth) {
        const defContract = ability.interactionChain!.payloadContract;
        const execContract = ability.executorContract!;
        const defAll = new Set([
          ...defContract.required,
          ...(defContract.optional ?? []),
        ]);

        for (const field of execContract.required) {
          if (!defAll.has(field)) {
            violations.push(
              `  [${ability.id}]（${ability.name}）执行器需要 "${field}" 但 AbilityDef payloadContract 未声明`
            );
          }
        }
      }

      if (violations.length > 0) {
        expect(violations, '以下执行器字段未被 AbilityDef 覆盖').toEqual([]);
      }
    });

    it('AbilityDef required 字段被执行器 payloadContract 覆盖', () => {
      const violations: string[] = [];

      for (const ability of withBoth) {
        const defContract = ability.interactionChain!.payloadContract;
        const execContract = ability.executorContract!;
        const execAll = new Set([
          ...execContract.required,
          ...(execContract.optional ?? []),
        ]);

        for (const field of defContract.required) {
          if (!execAll.has(field)) {
            violations.push(
              `  [${ability.id}]（${ability.name}）AbilityDef 声明 "${field}" 但执行器 payloadContract 未包含`
            );
          }
        }
      }

      if (violations.length > 0) {
        expect(violations, '以下 AbilityDef 字段未被执行器覆盖').toEqual([]);
      }
    });
  });
}

// ============================================================================
// 组合工厂：一键创建完整交互链审计套件
// ============================================================================

export interface InteractionChainAuditConfig {
  /** 顶层 describe 名称 */
  suiteName: string;
  /** 所有可审计技能 */
  abilities: AuditableInteractionAbility[];
  /** 判断技能是否需要多步交互 */
  requiresMultiStep: (ability: AuditableInteractionAbility) => boolean;
  /** 声明完整性白名单 */
  declarationWhitelist?: Set<string>;
}

/**
 * 一键创建完整的交互链审计套件
 *
 * 包含三类检查：声明完整性、步骤覆盖、契约对齐。
 */
export function createInteractionChainAuditSuite(config: InteractionChainAuditConfig): void {
  describe(config.suiteName, () => {
    createDeclarationCompletenessCheck({
      suiteName: '声明完整性',
      abilities: config.abilities,
      requiresMultiStep: config.requiresMultiStep,
      whitelist: config.declarationWhitelist,
    });

    createStepCoverageCheck({
      suiteName: '步骤覆盖',
      abilities: config.abilities,
    });

    createContractAlignmentCheck({
      suiteName: '契约对齐',
      abilities: config.abilities,
    });
  });
}
