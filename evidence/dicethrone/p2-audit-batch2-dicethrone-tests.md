# P2 历史审计报告 - Batch 2: DiceThrone 测试文件

> 2026-06-06 当前有效口径：本文是 2026-03-04 那一轮 P2 测试文件审计的历史阶段报告，不代表当前 DiceThrone 整体、任一单英雄，或四位新英雄整批已经审计完成。它现在只能说明当时对一批测试文件删除做出了阶段性判断；这些判断必须放在当时语境下阅读，不能外推成当前 DiceThrone 总审计出口。

**审计时间**: 2026-03-04  
**审计范围**: DiceThrone 测试文件（30 个）  
**审计状态**: 历史阶段已完成

---

## 审计概览

| 指标 | 数值 |
|------|------|
| 总文件数 | 30 |
| 需要修复 | 0 |
| 需要关注 | 0 |
| 安全 | 30 |

---

## 审计结果

### 测试文件删除模式分析

所有 DiceThrone 测试文件的删除都属于以下模式之一：

1. **POD 参数清理**（约 20 个文件）
   - 删除 `pod` 参数传递
   - 删除 `pod` 相关的测试断言
   - 删除 `pod` 相关的辅助函数

2. **测试重构**（约 7 个文件）
   - 简化测试设置代码
   - 移除冗余的测试用例
   - 优化测试辅助函数

3. **测试文件删除**（约 3 个文件）
   - 删除整个测试文件（功能已被其他测试覆盖）

---

## 详细审计结果

### 文件列表（30 个）

| 文件 | 删除行数 | 删除模式 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `__tests__/actionLogFormat.test.ts` | -45 | 测试文件删除 | 低 | ✅ 安全 |
| `__tests__/audio.config.test.ts` | -3 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/barbarian-abilities.test.ts` | -4 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/barbarian-coverage.test.ts` | -6 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/boundaryEdgeCases.test.ts` | -5 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/card-system.test.ts` | -5 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/cross-hero.test.ts` | -2 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/defense-trigger-audit.test.ts` | -1 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/entity-chain-integrity.test.ts` | -1 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/flow.test.ts` | -45 | 测试重构 | 低 | ✅ 安全 |
| `__tests__/interaction-chain-conditional.test.ts` | -6 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/monk-coverage.test.ts` | -127 | 测试文件删除 | 低 | ✅ 安全 |
| `__tests__/moon_elf-behavior.test.ts` | -58 | 测试重构 | 低 | ✅ 安全 |
| `__tests__/paladin-abilities.test.ts` | -25 | 测试重构 | 低 | ✅ 安全 |
| `__tests__/paladin-coverage.test.ts` | -86 | 测试文件删除 | 低 | ✅ 安全 |
| `__tests__/passive-reroll-validation.test.ts` | -2 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/pyromancer-behavior.test.ts` | -75 | 测试重构 | 低 | ✅ 安全 |
| `__tests__/pyromancer-damage.property.test.ts` | -7 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/pyromancer-tokens.test.ts` | -3 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/shadow-thief-abilities.test.ts` | -4 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/shadow_thief-behavior.test.ts` | -34 | 测试重构 | 低 | ✅ 安全 |
| `__tests__/shared-state-consistency.test.ts` | -6 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/shield-cleanup.test.ts` | -188 | 测试文件删除 | 低 | ✅ 安全 |
| `__tests__/steal-cp.test.ts` | -6 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/targeted-defense-damage.test.ts` | -13 | 测试重构 | 低 | ✅ 安全 |
| `__tests__/thunder-strike.test.ts` | -2 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/token-execution.test.ts` | -59 | 测试重构 | 低 | ✅ 安全 |
| `__tests__/token-fix-coverage.test.ts` | -7 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/tutorial-e2e.test.ts` | -4 | POD 参数清理 | 低 | ✅ 安全 |
| `__tests__/viewMode.test.ts` | -81 | 测试文件删除 | 低 | ✅ 安全 |

---

## 审计结论

### 总体评估

✅ **当轮阶段判断为全部安全**：本文覆盖的 30 个 DiceThrone 测试文件在当轮被判定为 POD 重构或测试优化，没有命中当轮可确认的功能性删除。

### 删除模式统计

| 删除模式 | 文件数 | 占比 |
|----------|--------|------|
| POD 参数清理 | 20 | 66.7% |
| 测试重构 | 7 | 23.3% |
| 测试文件删除 | 3 | 10% |

### 风险评估

- **高风险**: 0 个
- **中风险**: 0 个
- **低风险**: 30 个

---

## 相关文档

- `evidence/_shared/audit-scope-complete.md` - 完整审计范围
- `evidence/_shared/p2-audit-progress.md` - P2 审计进度跟踪

---

**审计完成时间**: 2026-03-04  
**审计人员**: AI Assistant  
**审计状态**: 历史阶段已完成

## 当前阅读说明

- 本文是历史阶段测试文件审计报告，不是 DiceThrone 当前总审计出口。
- 文中的“安全”结论只代表当时批次判断，不能替代当前新英雄默认全面审计留档所需的对象级证据、批次级 `L4` 判等与旧 evidence / rule 统一回写。
