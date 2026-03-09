# Card15 发明家 - 下一步操作指南

## 当前状态

✅ **代码修改完成**  
✅ **ESLint 检查通过**（0 errors）  
⏳ **待测试验证**

## 立即操作

### 1. 运行测试

```bash
# 运行发明家测试
npx playwright test cardia-deck1-card15-inventor.e2e.ts

# 或者运行所有 Cardia 测试
npx playwright test cardia-deck1-*.e2e.ts
```

### 2. 验证修复

测试通过后，检查以下内容：

#### Bug 1 修复验证（修正标记重复）
- ✅ 第一次交互后：`modifierTokens.length === 1`（只有一个 +3）
- ✅ 第二次交互后：`modifierTokens.length === 2`（一个 +3 和一个 -3）
- ✅ 没有重复的修正标记

#### Bug 2 修复验证（无限弹窗）
- ✅ 第一次交互完成后，第二次交互弹窗自动显示
- ✅ 第二次交互完成后，弹窗关闭
- ✅ 第二次交互正确放置 -3 修正标记

### 3. 查看服务器日志

如果测试失败，查看 `logs/` 目录中的日志文件：

```bash
# 查看最新的应用日志
tail -f logs/app-$(date +%Y-%m-%d).log

# 查看最新的错误日志
tail -f logs/error-$(date +%Y-%m-%d).log
```

确认以下日志出现：
- `[CardiaEventSystem] INVENTOR_PENDING_SET detected`
- `[CardiaEventSystem] Creating inventor second interaction`
- `[CardiaEventSystem] Second interaction queued`

## 如果测试失败

### 调试步骤

1. **检查 `inventorPending` 标记是否被设置**：
   - 查看日志中的 `[CardiaEventSystem] After event processing`
   - 确认 `hasPending: true` 和 `pending: { playerId, timestamp }`

2. **检查第二次交互是否被创建**：
   - 查看日志中的 `[CardiaEventSystem] Creating inventor second interaction`
   - 如果没有这条日志，说明检测逻辑有问题

3. **检查事件是否被正确应用**：
   - 查看日志中的 `[CardiaEventSystem] Applying event`
   - 确认 `INVENTOR_PENDING_SET` 事件被应用

4. **检查交互处理器是否被调用**：
   - 查看日志中的 `[Inventor] Interaction handler called`
   - 确认 `isFirstInteraction` 和 `hasPendingFlag` 的值

### 常见问题

#### 问题 1：第二次交互没有创建

**可能原因**：
- `INVENTOR_PENDING_SET` 事件没有被应用
- `appliedEvents` 数组为空
- `newState.core.inventorPending` 为 undefined

**解决方法**：
1. 在 `systems.ts` 中添加更多调试日志
2. 确认 `appliedEvents.push(evt)` 被执行
3. 确认 `reduce` 函数正确处理了 `INVENTOR_PENDING_SET` 事件

#### 问题 2：修正标记仍然重复

**可能原因**：
- Reducer 的去重逻辑没有生效
- 事件被应用了两次（不同的 timestamp）

**解决方法**：
1. 在 `reduce.ts` 的 `reduceModifierTokenPlaced` 中添加调试日志
2. 确认去重检查被执行
3. 检查 `timestamp` 是否相同

#### 问题 3：交互处理器没有被调用

**可能原因**：
- `sourceId` 不匹配
- 交互处理器没有注册

**解决方法**：
1. 确认 `registerModifierInteractionHandlers()` 被调用
2. 确认 `ABILITY_IDS.INVENTOR` 的值正确
3. 在 `systems.ts` 中添加日志，打印 `payload.sourceId`

## 后续工作

### 1. 修复其他受影响的卡牌

Card15 的修复是一个模板，可以用于修复其他受影响的卡牌：
- card09 (伏击者)
- card13 (沼泽守卫)
- card14 (女导师)

修复步骤：
1. 定义事件类型（如果需要跨交互传递状态）
2. 添加 Reducer 函数
3. 修改交互处理器，发射事件而不是返回修改后的 `state`
4. 如果需要自动创建后续交互，在 CardiaEventSystem 中添加检测逻辑

### 2. 系统性审查

搜索所有 `registerInteractionHandler` 调用，检查是否有其他卡牌也受影响：

```bash
# 搜索所有交互处理器注册
grep -r "registerInteractionHandler" src/games/cardia/domain/
```

对于每个交互处理器，检查是否返回修改后的 `state`。

### 3. 创建修复清单

创建一个清单文档，记录：
- 所有使用交互处理器的卡牌
- 每个卡牌是否受影响
- 修复状态（待修复/进行中/已完成）

### 4. 更新测试文档

测试通过后，更新以下文档：
- `tasks.md` - 标记 Task 3 为完成
- `AUDIT-REPORT.md` - 更新审计报告
- `E2E-FULL-TURN-FLOW-PROGRESS.md` - 更新进度

## 相关文档

### 修复文档
- `CARD15-BUG-FIX-COMPLETE.md` - 详细修复文档
- `CARD15-FINAL-SUMMARY.md` - 修复总结
- `INTERACTION-HANDLER-BUG.md` - 框架层 bug 文档

### 调试文档
- `CARD15-DEBUG-RESULT.md` - 手动调试结果
- `CARD15-DEBUG-GUIDE.md` - 调试指南
- `CARD15-MANUAL-DEBUG.md` - 手动调试步骤

### 测试文件
- `e2e/cardia-deck1-card15-inventor.e2e.ts` - 发明家测试

### 代码文件
- `src/games/cardia/domain/events.ts` - 事件类型定义
- `src/games/cardia/domain/reduce.ts` - Reducer 实现
- `src/games/cardia/domain/abilities/group2-modifiers.ts` - 交互处理器
- `src/games/cardia/domain/systems.ts` - CardiaEventSystem

## 总结

### 已完成 ✅
- 代码修改完成
- ESLint 检查通过
- 文档更新完成

### 待完成 ⏳
- 运行测试验证修复
- 查看服务器日志确认逻辑正确
- 修复其他受影响的卡牌
- 系统性审查所有交互处理器

### 预期结果
- 测试通过
- 修正标记不再重复
- 第二次交互自动创建
- 弹窗正确关闭

---

**文档创建时间**：2025-01-XX  
**状态**：待测试验证  
**优先级**：高
