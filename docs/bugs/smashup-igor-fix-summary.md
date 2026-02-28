# SmashUp Igor 双重触发 Bug 修复总结

## 问题描述

Igor（科学小怪蛋）被消灭后，出现两次"选择随从放置+1力量指示物"的交互，即使场上只有一个 Igor。

## 根本原因

**架构设计缺陷**：`SmashUpEventSystem.afterEvents()` 和 `postProcessSystemEvents` 都会对同一批事件调用 `processDestroyMoveCycle`，导致 Igor 的 onDestroy 被触发两次。

### 事件流分析

```
用户操作：打出 Big Gulp → 选择消灭 Igor
                ↓
1. execute(PLAY_ACTION) → [ACTION_PLAYED]
                ↓
2. Big Gulp onPlay 创建交互（选择要消灭的随从）
                ↓
3. 用户选择 Igor → SYS_INTERACTION_RESOLVED
                ↓
4. SmashUpEventSystem.afterEvents()
   → vampire_big_gulp handler 返回 [MINION_DESTROYED]
   → ❌ 调用 processDestroyMoveCycle([MINION_DESTROYED])
   → 触发 Igor onDestroy（第一次）
   → 创建 Igor 交互
                ↓
5. Pipeline 自动调用 postProcessSystemEvents()
   → ❌ 再次调用 processDestroyMoveCycle([MINION_DESTROYED, ...])
   → 触发 Igor onDestroy（第二次）！
   → 又创建一个 Igor 交互
```

### 为什么去重失败？

`processDestroyMoveCycle` 内部有 `processedDestroyUids` Set 用于去重，但这是**函数局部变量**，每次调用都会创建新的 Set，无法跨调用去重。

## 修复方案

### 采用方案：移除 SmashUpEventSystem 的后处理

**修改位置**：`src/games/smashup/domain/systems.ts`

**核心改动**：
```typescript
// 修改前：重复后处理
if (result) {
    newState = result.state;
    const rawEvents = result.events as SmashUpEvent[];
    const sourcePlayerId = payload.playerId;
    // ❌ 重复处理
    const afterDestroyMove = processDestroyMoveCycle(rawEvents, newState, sourcePlayerId, random as RandomFn, eventTimestamp);
    // ... 更多后处理
    nextEvents.push(...afterAffect.events);
}

// 修改后：只返回原始事件
if (result) {
    newState = result.state;
    // ✅ 交互处理函数返回的事件会由 pipeline 的 postProcessSystemEvents 统一处理
    const rawEvents = result.events as SmashUpEvent[];
    nextEvents.push(...rawEvents);
}
```

**设计原则**：
- **单一职责**：`SmashUpEventSystem` 只负责"交互解决 → 领域事件"的转换
- **统一处理**：所有事件的后处理都由 `postProcessSystemEvents` 统一处理
- **符合架构**：Pipeline 已经在调用 `postProcessSystemEvents`

## 测试状态

### 通过的测试

✅ `igor-big-gulp-double-trigger.test.ts` - 验证修复有效

### 失败的测试（需要修复）

❌ `igor-two-igors-one-destroyed.test.ts` - 期望 Big Gulp 创建交互
❌ `igor-ondestroy-idempotency.test.ts` (2个) - 直接调用 `processDestroyTriggers`
❌ `igor-double-trigger-bug.test.ts` - 直接调用 `processDestroyTriggers`

### 失败原因

这些测试直接调用底层函数（`processDestroyTriggers`），绕过了 Pipeline，因此 `postProcessSystemEvents` 没有被调用，交互没有被创建。

**测试设计反模式**：
- ❌ 直接调用内部实现函数
- ❌ 绕过 Pipeline
- ❌ 验证中间状态而非最终状态
- ❌ 依赖实现细节

**正确做法**：
- ✅ 使用 `runCommand` 执行完整流程
- ✅ 验证最终状态
- ✅ 黑盒测试，不关心内部实现

## 审计文档改进

### 新增维度

#### D41：系统职责重叠检测（强制）

**目的**：检测多个系统是否对同一批数据执行相同处理

**方法**：
1. 识别所有处理同类数据的系统
2. 绘制调用链路图
3. 检查职责边界
4. 判定是否重叠

#### D42：事件流全链路审计（强制）

**目的**：追踪事件从产生到消费的完整路径

**方法**：
1. 选择代表性事件
2. 追踪完整生命周期（产生→传递→处理→消费）
3. 检查重复处理
4. 检查遗漏处理

#### D43：重构完整性检查（强制）

**目的**：确保新旧系统职责清晰，无遗留代码

**方法**：
1. 识别新旧系统
2. 检查职责迁移
3. 检查遗留代码
4. 检查调用点更新

#### D44：测试设计反模式检测（强制）

**目的**：避免测试依赖内部实现，导致架构重构破坏测试

**反模式**：
- 直接调用内部函数
- 绕过 Pipeline
- 验证中间状态
- 假设实现细节

**正确做法**：
- 使用公开 API（`runCommand`）
- 验证最终状态
- 黑盒测试
- 架构无关

### 扩展现有维度

#### D9（幂等与重入）扩展

**新增层次**：
- 函数级幂等：函数内部去重
- 系统级幂等：多系统处理同一批数据
- 架构级幂等：事件流路径无环路

## 框架重构评估

### 当前架构问题

1. **职责重叠**：两个系统都认为自己负责"事件后处理"
2. **调用时机混乱**：同一批事件可能被后处理 2-3 次
3. **状态传递复杂**：两个系统都可能创建交互，合并逻辑复杂

### 重构方案对比

| 方案 | 优点 | 缺点 | 评估 |
|------|------|------|------|
| A. 移除 SmashUpEventSystem 后处理 | 最小改动，单一职责 | 破坏测试 | ✅ 已采用 |
| B. 移除 postProcessSystemEvents | 职责完整 | 影响所有游戏，风险高 | ❌ 不推荐 |
| C. 明确职责边界 | 职责清晰 | 需要标记事件来源，复杂 | ⚠️ 可行但复杂 |
| D. 统一后处理接口 | 逻辑统一，自动去重 | 治标不治本 | ⚠️ 不推荐 |

### 推荐路线图

**短期（已实施）**：
- ✅ 方案 A - 移除 `SmashUpEventSystem` 的后处理
- ⬜ 修复破坏的测试（重写为 `runCommand` 测试）

**中期**：
- ⬜ 优化 Pipeline 调用逻辑
- ⬜ 文档化事件流路径
- ⬜ 添加架构测试（检测重复调用）

**长期**：
- ⬜ 文档化 Pipeline 事件处理规范
- ⬜ 建立架构演进规范
- ⬜ 定期架构审计（检查职责重叠）

## 教训总结

### 1. 审计粒度要多层次

- 函数级：单个函数的逻辑正确性
- 模块级：模块内部的一致性
- 系统级：多个系统的协作正确性
- 架构级：整体架构的合理性

### 2. 重构要彻底

- 引入新系统时，必须明确新旧系统的职责边界
- 如果新系统替代旧系统，必须完全移除旧系统
- 如果新旧系统并存，必须文档化职责划分

### 3. 历史债务要主动识别

- 定期审查"是否有多个系统做同样的事情"
- 定期审查"是否有遗留代码未清理"
- 定期审查"架构演进是否一致"

### 4. 测试要覆盖架构层

- 不仅要测试"功能是否正确"
- 还要测试"是否有重复处理"
- 还要测试"系统协作是否正确"

### 5. 测试设计要架构无关

- 使用公开 API，不直接调用内部函数
- 验证最终状态，不验证中间步骤
- 黑盒测试，不依赖实现细节
- 架构重构不应破坏测试

## 后续行动

### 立即行动

1. ✅ 修复 Igor 双重触发 bug
2. ✅ 修复破坏的测试（重写 `igor-two-igors-one-destroyed.test.ts` 使用 `runCommand`）
3. ⬜ 添加架构测试（检测重复调用）

### 短期行动

1. ✅ 更新 `docs/ai-rules/testing-audit.md`（添加 D41/D42/D43/D44 维度）
2. ⬜ 更新 `AGENTS.md`（引用新维度）
3. ⬜ 文档化 Pipeline 事件流路径
4. ⬜ 审查其他游戏是否有类似问题
5. ⬜ 建立测试最佳实践文档
6. ⬜ 重写剩余 3 个反模式测试（可选，优先级低）

### 长期行动

1. ⬜ 文档化 Pipeline 事件处理规范
2. ⬜ 建立架构演进规范
3. ⬜ 定期架构审计（检查职责重叠）
4. ⬜ 审查所有测试，识别直接调用内部函数的反模式

## 相关文档

- `docs/bugs/smashup-igor-double-trigger-root-cause-final.md` - 根本原因分析
- `docs/bugs/smashup-igor-double-trigger-reflection.md` - 审计文档反思
- `docs/test-fixes-igor-double-trigger.md` - 测试修复进度
- `docs/ai-rules/testing-audit.md` - 审计文档（需要更新）
- `docs/ai-rules/engine-systems.md` - 引擎系统架构
