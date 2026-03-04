# SmashUp 测试最终修复方案 (2026-02-28)

## 剩余 9 个失败

1. ✅ **cthulhu-chosen-display-mode.test.ts** - 已修复（移除 baseDefId）
2. ✅ **igor-double-trigger-bug.test.ts** - 已修复（添加第三个随从）
3. ✅ **igor-ondestroy-idempotency.test.ts** (1个) - 已修复（添加第三个随从）
4. ❌ **igor-ondestroy-idempotency.test.ts** (D8测试) - 需要修复期望
5. ❌ **interactionChainE2E.test.ts** - sourceId undefined
6. ❌ **interactionDefIdAudit.test.ts** - 还有2个地方缺少 defId
7. ❌ **multi-base-afterscoring-bug.test.ts** - 计分链中断
8. ❌ **newFactionAbilities.test.ts** - Opportunist 未触发
9. ❌ **ninja-hidden-ninja-interaction-bug.test.ts** - 交互未创建
10. ❌ **wizard-archmage-debug.test.ts** - 从弃牌堆打出失败
11. ❌ **wizard-archmage-zombie-interaction.test.ts** - Archmage 不在基地上

## 修复策略

### 1. Igor D8 测试 - 修改期望
九命之屋会创建防止消灭交互，但 Igor 的 onDestroy 不会触发（因为消灭被防止）。
测试期望正确，无需修改。

### 2-11. 其他测试
这些测试失败的根本原因需要逐个分析代码逻辑。

## 快速修复清单

所有问题都需要修改代码逻辑，不是测试问题：
- Ninja Hidden Ninja: 能力未正确注册或执行
- Wizard Archmage: fromDiscard 逻辑有问题
- Multi-base scoring: afterScoring 链中断
- Opportunist: ongoing 触发器未生效
- Alien Probe: sourceId 传递丢失
- interactionDefIdAudit: 还有2个地方需要补 defId
