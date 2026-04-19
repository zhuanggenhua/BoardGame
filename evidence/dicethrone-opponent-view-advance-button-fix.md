# 王权骰铸对手视角下一阶段按钮修复

## 问题描述
用户反馈：切换到对手视角时，下一阶段按钮不显示了。

## 根因分析

### 调用链检查报告
- **问题位置**：`src/games/dicethrone/Board.tsx` 第 589 行
- **错误逻辑**：`const showAdvancePhaseButton = isSelfView && !isSpectator;`
- **问题**：当 `isSelfView = false`（对手视角）时，按钮被隐藏

### Git 历史追溯
1. **正确版本**（`afcd494`）：
   ```typescript
   // 切换到对手视角时也显示下一阶段按钮（禁用状态），保持 UI 一致性
   const showAdvancePhaseButton = !isSpectator;
   ```
   - 注释明确说明：对手视角也应该显示按钮（禁用状态）
   - 逻辑：只要不是观察者，就显示按钮

2. **错误版本**（`6ea1f9f` - feat: add Smash Up POD faction support）：
   ```typescript
   const showAdvancePhaseButton = isSelfView && !isSpectator;
   ```
   - 逻辑：只有自己视角且不是观察者才显示按钮
   - 导致对手视角时按钮消失

### 为什么对手视角也应该显示按钮？
1. **UI 一致性**：无论哪个视角，UI 布局应该保持一致，避免元素跳动
2. **状态反馈**：按钮的禁用状态可以告诉玩家"当前不是你的回合"
3. **空间占位**：`RightSidebar.tsx` 中按钮使用 `invisible` 隐藏而非移除，就是为了保持布局稳定

## 修复方案

### 修改内容
恢复到正确的逻辑：
```typescript
// 切换到对手视角时也显示下一阶段按钮（禁用状态），保持 UI 一致性
const showAdvancePhaseButton = !isSpectator;
```

### 修改文件
- `src/games/dicethrone/Board.tsx`

## 验证

### 预期行为
1. **自己视角**：
   - 自己回合：按钮显示且可点击
   - 对手回合：按钮显示但禁用
2. **对手视角**：
   - 自己回合：按钮显示但禁用（因为 `canAdvancePhase` 依赖 `isFocusPlayer`）
   - 对手回合：按钮显示但禁用
3. **观察者模式**：按钮不显示

### 按钮状态控制
- **显示/隐藏**：`showAdvancePhaseButton = !isSpectator`
- **启用/禁用**：`isAdvanceButtonEnabled = canAdvancePhase`
  - `canAdvancePhase = isFocusPlayer && access.canAdvancePhase && !isAttackShowcaseVisible`
  - `isFocusPlayer = !isSpectator && access.focusPlayerId === rootPid`

## 总结

### 问题根源
`6ea1f9f` 提交（feat: add Smash Up POD faction support）错误地将 `showAdvancePhaseButton` 从 `!isSpectator` 改成了 `isSelfView && !isSpectator`，导致对手视角时按钮消失。

### 修复方法
恢复到 `afcd494` 提交的正确逻辑：`showAdvancePhaseButton = !isSpectator`。

### 百游戏自检
- ✅ 不涉及游戏特化硬编码
- ✅ 不破坏框架复用性
- ✅ 符合 UI 一致性原则（对手视角也显示按钮，通过禁用状态区分操作权限）
- ✅ 通用处理：所有游戏的视角切换都应该保持 UI 布局一致


## 为什么还有遗留问题？

### POD 提交审计历史

根据 `evidence/pod-commit-scope-audit.md` 和 `evidence/POD-RECOVERY-FINAL-STATUS.md`，`6ea1f9f` 提交（feat: add Smash Up POD faction support）包含了大量非 POD 相关的修改：

**统计**：
- **总文件数**: 336 个
- **POD 相关**: ~25 个（应该保留）
- **非 POD 相关**: ~311 个（应该回滚）
- **回滚比例**: 92.5%

**已完成的恢复工作**（Phase 1-8）：
1. ✅ 太极令牌本回合限制（taijiTokenLimit）
2. ✅ 自动响应功能（autoResponse）
3. ✅ RematchActions renderButton prop
4. ✅ 引擎层关键功能（~667 行代码）
5. ✅ 测试文件恢复
6. ⚠️ 响应窗口视角自动切换（被注释掉，可能有意禁用）

### 为什么 showAdvancePhaseButton 没有被发现？

1. **审计范围限制**：
   - Phase 1-8 审计了 19 个文件（18 引擎层 + 1 存储层）
   - `Board.tsx` 的其他功能（taijiTokenLimit、autoResponse）已恢复
   - 但 `showAdvancePhaseButton` 这个小改动被遗漏了

2. **审计方法问题**：
   - 之前的审计主要关注"被删除的代码"（大段删除）
   - `showAdvancePhaseButton` 只是一行逻辑修改（`!isSpectator` → `isSelfView && !isSpectator`）
   - 不是删除，而是修改，容易被忽略

3. **测试覆盖不足**：
   - 没有 E2E 测试覆盖"对手视角下一阶段按钮显示"场景
   - 单元测试无法发现 UI 显示问题

### 其他可能的遗留问题

根据审计文档，以下类型的修改可能还有遗漏：

1. **小的逻辑修改**（不是删除，而是改变）：
   - 条件判断的修改（如本次的 `showAdvancePhaseButton`）
   - 参数传递的修改
   - 默认值的修改

2. **被误判为"合理清理"的删除**：
   - `hasDivergentVariants` effect 类型比较逻辑（已在之前的对话中恢复）
   - 可能还有其他类似的误判

3. **未审计的文件**：
   - POD 提交修改了 336 个文件
   - Phase 1-8 只审计了 19 个文件（5.6%）
   - 还有 317 个文件未审计（94.4%）

### 建议

1. **短期**：
   - ✅ 本次修复已完成
   - 测试验证修复有效

2. **中期**：
   - 补充 E2E 测试：对手视角 UI 显示
   - 重新审查 `Board.tsx` 的所有修改（不只是删除，还包括修改）

3. **长期**：
   - 完全回滚 `6ea1f9f` 提交的非 POD 修改（推荐）
   - 或者完成剩余 317 个文件的审计（工作量巨大）

## 总结

### 问题根源
`6ea1f9f` 提交（feat: add Smash Up POD faction support）错误地将 `showAdvancePhaseButton` 从 `!isSpectator` 改成了 `isSelfView && !isSpectator`，导致对手视角时按钮消失。

### 修复方法
恢复到 `afcd494` 提交的正确逻辑：`showAdvancePhaseButton = !isSpectator`。

### 为什么有遗留
- POD 提交修改了 336 个文件（92.5% 非 POD 相关）
- Phase 1-8 只审计了 19 个文件（5.6%）
- 小的逻辑修改（不是删除）容易被忽略
- 测试覆盖不足

### 百游戏自检
- ✅ 不涉及游戏特化硬编码
- ✅ 不破坏框架复用性
- ✅ 符合 UI 一致性原则（对手视角也显示按钮，通过禁用状态区分操作权限）
- ✅ 通用处理：所有游戏的视角切换都应该保持 UI 布局一致
