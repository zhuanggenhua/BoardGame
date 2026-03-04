# AI 测试策略

## 核心原则

**AI 测试应该优先使用单元测试（GameTestRunner），只在必要时使用 E2E 测试。**

## 测试金字塔（AI 优化版）

```
        E2E (5%)
       /        \
      /  集成 (15%) \
     /              \
    /   单元 (80%)    \
   /                  \
  ----------------------
```

### 1. 单元测试（80% - 首选）

**适用场景**：
- ✅ 卡牌能力逻辑
- ✅ 技能效果验证
- ✅ 回合流程
- ✅ 计分规则
- ✅ 状态变更
- ✅ 事件触发

**工具**：`GameTestRunner` + `makeState` + `runCommand`

**优势**：
- 毫秒级执行
- 100% 可重复
- 精确控制随机数
- 无 UI/网络依赖
- 易于调试

**示例**：
```typescript
import { runCommand, makeState, makePlayer } from './testRunner';

test('巫师传送门应该召唤随从', () => {
    const state = makeState({
        players: {
            '0': makePlayer('0', {
                hand: [
                    makeCard('portal-1', 'wizard_portal', 'action', '0'),
                    makeCard('minion-1', 'wizard_chronomage', 'minion', '0'),
                ],
            }),
        },
    });
    
    // 打出传送门
    const result = runCommand(state, {
        type: 'su:play_action',
        playerId: '0',
        payload: { cardUid: 'portal-1' },
    });
    
    // 验证交互创建
    expect(result.finalState.sys.interaction.current).toBeDefined();
    
    // 选择随从
    const result2 = runCommand(result.finalState, {
        type: 'SYS_INTERACTION_RESPOND',
        playerId: '0',
        payload: { optionId: 'play', value: { cardUid: 'minion-1' } },
    });
    
    // 验证随从在场上
    const base = result2.finalState.core.bases[0];
    expect(base.minions.some(m => m.uid === 'minion-1')).toBe(true);
});
```

### 2. 集成测试（15%）

**适用场景**：
- 多系统协作（InteractionSystem + FlowSystem）
- 复杂的事件链
- 跨模块交互

**工具**：`GameTestRunner` + 完整引擎系统

### 3. E2E 测试（5% - 仅关键路径）

**适用场景**：
- ❌ **不要用于**：测试卡牌逻辑、技能效果、规则验证
- ✅ **只用于**：
  - 关键用户流程（创建房间 → 加入 → 游戏结束）
  - UI 交互（点击、拖拽、动画）
  - 跨端通信（WebSocket、多玩家同步）

**原则**：
- 每个游戏最多 3-5 个 E2E 测试
- 测试"能玩"，不测试"玩法正确"
- 使用 TestHarness 快速构造场景

## AI 开发工作流

### 新增卡牌/技能

```bash
# 1. 先写单元测试（快速验证逻辑）
npm run test -- wizard-portal.test.ts

# 2. 通过后再考虑是否需要 E2E（通常不需要）
```

### 修复 Bug

```bash
# 1. 用单元测试复现 bug
npm run test -- robot-hoverbot-chain.test.ts

# 2. 修复后验证
npm run test -- robot-hoverbot-chain.test.ts

# 3. 只有 UI 相关 bug 才需要 E2E
```

### 重构

```bash
# 1. 单元测试保证逻辑不变
npm run test

# 2. 最后跑一次 E2E 确保集成正常
npm run test:e2e -- smashup-smoke.e2e.ts
```

## E2E 测试优化指南

### 使用 TestHarness 快速构造场景

```typescript
// ❌ 不要：完整走派系选择流程（30-60秒）
await selectFaction(hostPage, 0);
await selectFaction(guestPage, 0);
// ...

// ✅ 推荐：使用 TestHarness 注入状态（<1秒）
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({
        // 直接设置游戏中期状态
        players: { ... },
        bases: [ ... ],
    });
});
```

### 只测试关键路径

```typescript
// ❌ 不要：为每个卡牌写 E2E 测试
test('传送门应该召唤随从', ...);
test('时空法师应该抽牌', ...);
test('盘旋机器人应该...', ...);

// ✅ 推荐：一个冒烟测试覆盖基本流程
test('应该能完成一局游戏', async ({ page }) => {
    // 创建房间 → 加入 → 打出一张牌 → 结束回合 → 游戏结束
});
```

## 测试选型决策树

```
需要测试什么？
│
├─ 卡牌逻辑/技能效果？
│  └─ 单元测试 ✅
│
├─ 回合流程/计分规则？
│  └─ 单元测试 ✅
│
├─ 多系统协作？
│  └─ 集成测试（单元测试 + 完整系统）✅
│
├─ UI 交互/动画？
│  └─ E2E 测试（但先问：真的需要吗？）⚠️
│
└─ 跨端通信/多玩家同步？
   └─ E2E 测试 ✅
```

## 常见误区

### ❌ 误区 1：用 E2E 测试业务逻辑

```typescript
// ❌ 错误：用 E2E 测试传送门逻辑
test('传送门应该召唤随从', async ({ page }) => {
    await page.click('[data-card-uid="portal-1"]');
    await page.click('[data-option-id="play"]');
    const minions = await page.locator('.minion').count();
    expect(minions).toBe(1);
});

// ✅ 正确：用单元测试
test('传送门应该召唤随从', () => {
    const result = runCommand(state, playPortalCommand);
    expect(result.finalState.core.bases[0].minions.length).toBe(1);
});
```

### ❌ 误区 2：E2E 测试覆盖所有边界情况

```typescript
// ❌ 错误：E2E 测试边界情况
test('传送门手牌无随从时应该跳过', ...);
test('传送门选择后取消应该不召唤', ...);
test('传送门多基地应该选择基地', ...);

// ✅ 正确：单元测试覆盖边界，E2E 只测主流程
test('传送门基本流程', ...); // E2E
test('传送门边界情况', ...); // 单元测试
```

### ❌ 误区 3：依赖 E2E 测试调试

```typescript
// ❌ 错误：E2E 测试失败后反复运行调试
npm run test:e2e -- wizard-portal.e2e.ts
// 失败 → 修改 → 再运行 → 又失败 → ...（每次 30 秒）

// ✅ 正确：先用单元测试快速迭代
npm run test -- wizard-portal.test.ts
// 失败 → 修改 → 再运行（毫秒级）→ 通过
// 最后跑一次 E2E 确认集成
```

## 总结

**AI 测试的黄金法则**：

1. **默认用单元测试** - 快速、稳定、易调试
2. **E2E 测试是奢侈品** - 只用于关键路径
3. **TestHarness 是好朋友** - 快速构造场景
4. **测试金字塔要倒过来看** - 80% 单元，5% E2E

**记住**：E2E 测试不是为了测试"功能正确"，而是为了测试"能玩"。功能正确性应该由单元测试保证。
