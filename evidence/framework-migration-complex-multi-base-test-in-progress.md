# 框架迁移 - 复杂多基地计分测试（进行中）

## 测试目标
验证新框架（状态注入模式）能否支持极限复杂度的 E2E 测试场景：
- 两个基地同时达到临界点
- 海盗王 beforeScoring 移动
- 大副 afterScoring 移动
- "我们乃最强" afterScoring 转移力量指示物
- 完整的交互链验证

## 修复历程

### 问题 1：StateInjector 未注册
**错误**：`[StateInjector] 状态访问器未注册，请确保游戏已加载`

**原因**：测试使用了旧的 `game.openTestGame()` 方法

**修复**：
```typescript
// ❌ 旧方式
await game.openTestGame('smashup');

// ✅ 新方式
await page.goto('/play/smashup');
await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
    { timeout: 15000 }
);
```

### 问题 2：基地 breakpoint 为 undefined
**错误**：`expect(initialState.base0Power).toBeGreaterThanOrEqual(initialState.base0Breakpoint)` 失败，`base0Breakpoint` 为 `undefined`

**原因**：`setupScene` 在构建基地时只复制了 `defId`，没有复制 `breakpoint`、`power` 等字段

**修复**：修改 `e2e/framework/GameTestContext.ts`
```typescript
const nextBase: any = {
    ...currentBase,
    defId: baseConfig?.defId ?? currentBase.defId,
};

// 复制基地配置的所有字段（breakpoint, power 等）
if (baseConfig) {
    Object.assign(nextBase, baseConfig);
}
```

**验证**：测试输出显示基地数据正确
```
[TEST] 初始状态: {
  base0Power: 13,
  base1Power: 7,
  base0Breakpoint: 12,
  base1Breakpoint: 15,
  p0Hand: 2
}
```

### 问题 3：Me First! 窗口关闭后计分流程未触发（当前问题）
**错误**：基地没有被替换，分数为 0，阶段卡在 `scoreBases`

**现象**：
- ✅ Me First! 窗口成功打开
- ✅ P0 成功打出 beforeScoring 卡（"承受压力"）
- ✅ P0 成功打出 afterScoring 卡（"我们乃最强"）
- ✅ 成功关闭 Me First! 窗口（通过 ESC 或"完成"按钮）
- ❌ 但计分流程没有触发：
  - 基地 0 仍然是 `base_the_jungle`（没有被替换）
  - 基地 1 仍然是 `base_ninja_dojo`（没有被替换）
  - 玩家分数仍然是 0
  - 阶段仍然是 `scoreBases`

**最终状态**：
```json
{
  "bases": [
    {
      "defId": "base_the_jungle",
      "minions": [...]
    },
    {
      "defId": "base_ninja_dojo",
      "minions": [...]
    },
    {
      "defId": "base_the_factory",
      "minions": []
    }
  ],
  "p0Vp": 0,
  "p1Vp": 0,
  "phase": "scoreBases"
}
```

**可能原因**：
1. Me First! 窗口是响应窗口（ResponseWindow），关闭后需要额外的操作才能触发计分
2. 或者需要 P1 也完成操作（但 P1 是 AI，应该自动处理）
3. 或者游戏逻辑有 bug，关闭响应窗口后没有正确推进到计分流程

**下一步**：
1. 查看 Me First! 窗口的实现，了解关闭后的流程
2. 检查 `scoreBases` 阶段的流程控制逻辑
3. 可能需要在测试中手动触发计分（通过 TestHarness 或其他方式）

## 测试截图

### 成功的截图
1. ![初始状态](../test-results/smashup-complex-multi-base-3f9de-oring-大副-afterScoring-我们乃最强-chromium/01-initial-state.png)
2. ![Me First! 窗口](../test-results/smashup-complex-multi-base-3f9de-oring-大副-afterScoring-我们乃最强-chromium/02-me-first-window.png)
3. ![打出 beforeScoring 卡后](../test-results/smashup-complex-multi-base-3f9de-oring-大副-afterScoring-我们乃最强-chromium/03-after-before-card.png)
4. ![打出 afterScoring 卡后](../test-results/smashup-complex-multi-base-3f9de-oring-大副-afterScoring-我们乃最强-chromium/04-after-after-card.png)
5. ![关闭窗口后](../test-results/smashup-complex-multi-base-3f9de-oring-大副-afterScoring-我们乃最强-chromium/05-after-close-window.png)
6. ![最终状态](../test-results/smashup-complex-multi-base-3f9de-oring-大副-afterScoring-我们乃最强-chromium/07-final-state.png)

### 失败截图
![测试失败](../test-results/smashup-complex-multi-base-3f9de-oring-大副-afterScoring-我们乃最强-chromium/test-failed-1.png)

**截图分析**：（需要用 MCP 工具查看）

## 总结
- ✅ 状态注入模式工作正常
- ✅ 基地数据注入修复完成（`GameTestContext.ts` 中正确复制 breakpoint 等字段）
- ✅ Me First! 窗口交互流程正常（可以打出卡牌并关闭窗口）
- ❌ 计分流程未触发（需要进一步调查游戏逻辑）

## 框架改进

### GameTestContext.ts 修复
修复了 `setupScene` 中基地配置的处理逻辑：

```typescript
// ❌ 错误：会覆盖 minions 数组
if (baseConfig) {
    Object.assign(nextBase, baseConfig);
}

// ✅ 正确：只复制特定字段，不覆盖 minions 和 ongoingActions
if (baseConfig) {
    const { minions: _, ongoingActions: __, ...otherFields } = baseConfig;
    Object.assign(nextBase, otherFields);
}
```

这确保了 `breakpoint`、`power` 等字段被正确注入，同时不会破坏 `fieldMinions` 的逻辑。
