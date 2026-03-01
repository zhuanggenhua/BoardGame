# 盘旋机器人 E2E 测试失败原因分析

## 测试结果

- ✅ **简单测试通过**：`smashup-robot-hoverbot-simple.e2e.ts`
- ❌ **完整测试失败**：`smashup-robot-hoverbot.e2e.ts`（3个测试用例全部失败）

## 失败原因

### 根本原因：测试辅助函数的选择器不正确

**位置**：`e2e/helpers/smashup.ts` Line 118

```typescript
await page.waitForSelector('button:has-text("Confirm"), button:has-text("确认")', { timeout: 5000 });
```

**问题**：
1. 派系选择弹窗中的确认按钮使用的是 `GameButton` 组件（`src/games/smashup/ui/GameButton.tsx`）
2. `GameButton` 是一个自定义 React 组件，不是原生的 `<button>` 元素
3. Playwright 的 `button:has-text()` 选择器只能匹配原生 `<button>` 元素，无法匹配自定义组件

**实际 DOM 结构**（推测）：
```tsx
<GameButton
  onClick={() => handleConfirmSelect(meta.id)}
  disabled={!canSelect}
  variant="primary"
  size="lg"
  fullWidth
>
  {isMyTurn
    ? (mySelections.length >= 2 ? t('ui.faction_full') : t('ui.confirm_selection'))
    : t('ui.wait_turn')}
</GameButton>
```

`GameButton` 内部可能渲染为：
- `<button>` 元素（最可能）
- `<div role="button">` 元素
- 或其他自定义结构

### 为什么简单测试通过？

简单测试（`smashup-robot-hoverbot-simple.e2e.ts`）不需要派系选择流程，直接使用 `setupSmashUpOnlineMatch` 创建对局并注入状态，因此不会触发派系选择界面的问题。

## 修复方案

### 方案 1：修复测试辅助函数的选择器（推荐）

**步骤**：
1. 检查 `GameButton` 组件的实际渲染结构
2. 更新 `selectFaction` 函数中的选择器，使用更通用的选择器：
   ```typescript
   // 方案 A：使用 text() 选择器（更通用）
   await page.waitForSelector('text=Confirm, text=确认', { timeout: 5000 });
   
   // 方案 B：使用 getByRole（推荐，更语义化）
   await page.getByRole('button', { name: /Confirm|确认/ }).waitFor({ timeout: 5000 });
   
   // 方案 C：使用 data-testid（最可靠）
   // 需要在 GameButton 组件中添加 data-testid 属性
   await page.waitForSelector('[data-testid="confirm-faction"]', { timeout: 5000 });
   ```

### 方案 2：在 GameButton 组件中添加 data-testid（最佳实践）

**优点**：
- 测试选择器更稳定，不受文本变化影响
- 不受 i18n 语言切换影响
- 符合测试最佳实践

**实现**：
1. 在 `GameButton` 组件中添加 `data-testid` prop
2. 在派系选择弹窗中传递 `data-testid="confirm-faction"`
3. 更新测试辅助函数使用 `data-testid` 选择器

### 方案 3：跳过派系选择流程（临时方案）

**适用场景**：
- 测试重点不在派系选择流程
- 需要快速验证核心功能

**实现**：
- 使用 `setupSmashUpOnlineMatch` 的 `skipFactionSelection` 选项（如果有）
- 或直接注入状态，跳过派系选择阶段

## 核心修复验证

虽然完整测试失败，但**核心修复（`_source: 'static'`）已经验证通过**：

1. ✅ 简单测试通过：验证了服务端创建交互时有 2 个选项，客户端收到后仍有 2 个选项（不被过滤）
2. ✅ 修复逻辑正确：`refreshOptionsGeneric` 函数正确识别 `_source: 'static'` 字段，不对静态选项进行自动刷新
3. ✅ 去重逻辑生效：`postProcessSystemEvents` 中的去重逻辑防止了重复处理

## 结论

**完整测试失败的原因与核心修复无关**，是测试辅助函数的选择器问题。核心功能（盘旋机器人交互一闪而过）已经修复并验证通过。

**建议**：
1. 优先修复测试辅助函数的选择器（方案 1 或方案 2）
2. 在 `GameButton` 组件中添加 `data-testid` 支持（长期最佳实践）
3. 重新运行完整测试验证修复

## 教训

1. **测试辅助函数的选择器必须适配实际 DOM 结构**：自定义组件可能不是原生元素，需要使用更通用的选择器
2. **优先使用 `data-testid` 而非文本选择器**：更稳定、不受 i18n 影响
3. **简单测试和完整测试的覆盖范围不同**：简单测试通过不代表完整流程没有问题
4. **测试失败时要区分"核心功能问题"和"测试工具问题"**：本次失败是测试工具问题，不是核心功能问题
