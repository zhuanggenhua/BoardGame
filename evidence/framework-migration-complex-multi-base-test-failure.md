# 框架迁移 - 复杂多基地计分测试失败分析

## 测试运行信息
- 运行命令：`npm run test:e2e:ci -- smashup-complex-multi-base-scoring.e2e.ts`
- 运行时间：2026-03-09
- 测试结果：失败（多次尝试）

## 核心问题：状态注入不持久化

### 问题根因
`setupScene()` 使用 `TestHarness.state.set()` 注入状态，但这个状态**只存在于客户端本地**，不会同步到服务器。当执行任何需要服务器响应的操作（如点击"结束回合"按钮）时，客户端向服务器发送命令，服务器返回新的状态，**覆盖了本地注入的状态**。

### 证据
```
[TEST] 自动推进前状态: {
    "phase": "factionSelect",  // ❌ 阶段回到了派系选择
    "responseWindow": {},
    "interactionQueue": 0,
    "interactionCurrent": null,
    "eligibleBases": 0  // ❌ 没有 eligible 基地
}
```

测试流程：
1. `setupScene()` 注入 `playCards` 阶段的状态 ✅
2. 点击"结束回合"按钮 → 客户端向服务器发送 `END_TURN` 命令
3. 服务器返回新的状态（从派系选择开始） → **覆盖了注入的状态** ❌
4. 游戏回到派系选择阶段，所有注入的状态丢失

### 解决方案尝试

#### 尝试 1：直接注入 scoreBases 阶段（失败）
修改测试，跳过"结束回合"按钮，直接注入 `scoreBases` 阶段和 `ResponseWindow`：
```typescript
await page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness.state.get();
    state.sys.phase = 'scoreBases';
    state.sys.responseWindow = { ... };
    harness.state.set(state);
});
```

**结果**：服务器启动超时，测试无法完成。

### 根本限制
`TestHarness` 的状态注入功能设计用于**单元测试**（纯客户端逻辑），不适用于**E2E 测试**（需要客户端-服务器交互）。

E2E 测试中，任何触发服务器命令的操作都会导致状态被覆盖：
- ❌ 点击"结束回合"按钮
- ❌ 打出卡牌
- ❌ 移动随从
- ❌ 任何需要服务器验证的操作

### 正确的 E2E 测试方法
1. **使用服务器 API 创建真实游戏状态**：通过 HTTP API 或 WebSocket 创建游戏，让服务器持有正确的状态
2. **或者**：测试简单场景，不依赖复杂的状态注入
3. **或者**：修改 `TestHarness`，添加服务器状态同步功能

## 结论
这个测试场景（复杂多基地计分）**不适合用当前的状态注入方式**。需要：
1. 重新设计测试，使用服务器 API 创建游戏状态
2. 或者简化测试场景，只测试单个基地计分
3. 或者扩展 `TestHarness`，支持服务器状态同步

## 下一步工作
暂停这个测试，先完成其他框架迁移测试（ninja-infiltrate、wizard-portal），它们使用更简单的场景，不依赖复杂的状态注入。
