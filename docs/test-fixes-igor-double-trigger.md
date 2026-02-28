# Igor 双重触发 Bug 修复 - 测试修复进度

## 背景

修复 Igor 双重触发 bug 后（移除 `SmashUpEventSystem` 的重复后处理），4 个测试失败。这些测试直接调用内部函数（`processDestroyTriggers`），绕过了 Pipeline，导致 `postProcessSystemEvents` 没有被调用，交互没有被创建。

## 测试状态

### ✅ 已修复

1. **igor-two-igors-one-destroyed.test.ts**
   - 问题：使用错误的 `makeBase` 调用方式（传对象而非两个参数）
   - 问题：使用错误的命令类型（`RESOLVE` 而非 `RESPOND`）
   - 修复：改为正确的函数调用和命令类型
   - 状态：✅ 通过

### ⬜ 需要重写（反模式）

以下测试直接调用内部函数，违反了测试最佳实践（D44：测试设计反模式检测）：

2. **igor-ondestroy-idempotency.test.ts** (3个测试)
   - 反模式：直接调用 `processDestroyTriggers`
   - 应该：使用 `runCommand` 执行完整流程
   - 优先级：低（这些是单元测试，验证内部函数行为）

3. **igor-double-trigger-bug.test.ts** (1个测试)
   - 反模式：直接调用 `processDestroyTriggers`
   - 应该：使用 `runCommand` 执行完整流程
   - 优先级：低（已有 `igor-big-gulp-double-trigger.test.ts` 覆盖相同场景）

## 修复策略

### 短期（已完成）

- ✅ 修复 `igor-two-igors-one-destroyed.test.ts`（使用 `runCommand`）
- ✅ 验证修复有效（Igor onDestroy 只触发一次）

### 中期（可选）

- ⬜ 重写 `igor-ondestroy-idempotency.test.ts`（使用 `runCommand`）
- ⬜ 删除或重写 `igor-double-trigger-bug.test.ts`（已有重复覆盖）

### 长期

- ⬜ 审查所有 SmashUp 测试，识别直接调用内部函数的反模式
- ⬜ 建立测试最佳实践文档（禁止直接调用内部函数）

## 教训

### 测试设计反模式（D44）

**反模式**：
- ❌ 直接调用内部函数（`processDestroyTriggers`）
- ❌ 绕过 Pipeline
- ❌ 验证中间状态而非最终状态
- ❌ 依赖实现细节

**正确做法**：
- ✅ 使用公开 API（`runCommand`）
- ✅ 验证最终状态
- ✅ 黑盒测试
- ✅ 架构无关

### 为什么这些测试失败了？

1. **架构变更**：移除 `SmashUpEventSystem` 的后处理后，交互创建被延迟到 `postProcessSystemEvents`
2. **测试绕过 Pipeline**：直接调用 `processDestroyTriggers` 不会触发 `postProcessSystemEvents`
3. **测试依赖实现细节**：假设交互在 `processDestroyTriggers` 中创建

### 如果测试使用 `runCommand`

- ✅ 架构变更不会破坏测试
- ✅ 测试验证完整流程
- ✅ 测试更接近真实使用场景

## 相关文档

- `docs/bugs/smashup-igor-fix-summary.md` — 修复总结
- `docs/bugs/smashup-igor-double-trigger-reflection.md` — 反思
- `docs/ai-rules/testing-audit.md` — D44：测试设计反模式检测
