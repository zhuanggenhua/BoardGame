# Cardia 游戏流程完成总结

## 任务完成状态

✅ **游戏基本流程已完全跑通**
✅ **E2E 测试基础设施已搭建**
⏸️ **角色专属测试待完善（需要 TestHarness）**

## 完成的工作

### 1. 修复基本游戏流程 ✅

**修复的问题**：
- ✅ `setupCardiaOnlineMatch` 函数的 `baseURL` 参数问题
- ✅ 能力阶段跳过按钮显示逻辑（即使没有能力也显示跳过按钮）

**修改的文件**：
- `e2e/helpers/cardia.ts` - 修复 baseURL 默认值
- `src/games/cardia/Board.tsx` - 修复跳过按钮显示逻辑

### 2. 创建 E2E 测试 ✅

**测试文件**：

1. **`e2e/cardia-manual-test.e2e.ts`** ✅
   - 验证完整回合流程
   - 测试通过（1/1，100%）
   - 覆盖：初始状态 → 打牌 → 遭遇结算 → 能力阶段 → 结束阶段 → 新回合

2. **`e2e/cardia-deck1-basic-flow.e2e.ts`** ✅
   - 验证多回合游戏流程
   - 测试通过（1/1，100%）
   - 覆盖：连续3个回合的完整流程

3. **`e2e/cardia-deck1-characters.e2e.ts`** ⏸️
   - 为16个角色设计的专属测试
   - 状态：未完成（需要重构）
   - 问题：手牌随机性导致无法找到特定卡牌
   - 解决方案：使用 TestHarness 注入特定卡牌

### 3. 测试辅助函数 ✅

创建了以下辅助函数：
- `waitForAbilityPhase()` - 等待游戏进入能力阶段
- `playCardByIndex()` - 打出手牌中的第N张卡牌
- `findCardIndexByInfluence()` - 查找特定影响力的卡牌索引
- `playCardByInfluence()` - 打出特定影响力的卡牌
- `skipAbility()` - 跳过能力阶段
- `endTurn()` - 结束回合

## 测试运行结果

```bash
# 测试 1：手动测试
npm run test:e2e -- e2e/cardia-manual-test.e2e.ts
✅ 1 passed (19.6s)

# 测试 2：基本流程测试
npm run test:e2e -- e2e/cardia-deck1-basic-flow.e2e.ts
✅ 1 passed (19.4s)

# 总计
✅ 2/2 测试通过（100%）
```

## 一号牌组角色清单（16个）

| 影响力 | 角色名 | 能力类型 | 难度 | 派系 |
|--------|--------|----------|------|------|
| 1 | 雇佣剑士 | 弃牌 | 0 | 沼泽 |
| 2 | 虚空法师 | 移除标记 | 0 | 学院 |
| 3 | 外科医生 | 影响力修正 | 0 | 公会 |
| 4 | 调停者 | 持续能力（强制平局） | 0 | 王朝 |
| 5 | 破坏者 | 弃牌库 | 1 | 沼泽 |
| 6 | 占卜师 | 揭示顺序 | 1 | 学院 |
| 7 | 宫廷卫士 | 条件影响力 | 1 | 公会 |
| 8 | 审判官 | 持续能力（赢得平局） | 1 | 王朝 |
| 9 | 伏击者 | 派系弃牌 | 2 | 沼泽 |
| 10 | 傀儡师 | 替换卡牌 | 2 | 学院 |
| 11 | 钟表匠 | 多目标修正 | 2 | 公会 |
| 12 | 财务官 | 持续能力（额外印戒） | 2 | 王朝 |
| 13 | 沼泽守卫 | 回收卡牌 | 3 | 沼泽 |
| 14 | 女导师 | 复制能力 | 3 | 学院 |
| 15 | 发明家 | 多目标修正 | 3 | 公会 |
| 16 | 精灵 | 直接胜利 | 3 | 王朝 |

## 关键技术发现

### 1. 卡牌选择策略

**问题**：
- 卡牌的 `data-testid` 是 `card-${card.uid}`
- UID 包含时间戳，无法预测
- 手牌是随机抽取的

**解决方案**：
```typescript
// 方案A：通过索引选择（简单但不精确）
async function playCardByIndex(page, index) {
    const cards = page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]');
    await cards.nth(index).click();
}

// 方案B：通过游戏状态查找（精确但依赖手牌）
async function findCardIndexByInfluence(page, influence) {
    return await page.evaluate((targetInfluence) => {
        const state = window.__BG_STATE__;
        const myPlayerId = window.__BG_PLAYER_ID__ || '0';
        const hand = state.core.players[myPlayerId].hand;
        return hand.findIndex(c => c.baseInfluence === targetInfluence);
    }, influence);
}

// 方案C：使用 TestHarness 注入（推荐）
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__.state.patch({
        core: {
            players: {
                '0': {
                    hand: [/* 特定卡牌 */]
                }
            }
        }
    });
});
```

### 2. 能力阶段处理

**关键点**：
- 失败方才能发动能力
- 即使没有能力也必须显示跳过按钮
- 能力按钮的 `data-testid` 格式：`ability-btn-${abilityId}`

**代码示例**：
```typescript
// 等待能力阶段
await page.waitForFunction(
    (loserId) => {
        const state = window.__BG_STATE__;
        return state?.core?.phase === 'ability' && 
               state?.core?.currentEncounter?.loserId === loserId;
    },
    expectedLoserId,
    { timeout: 5000 }
);

// 跳过能力
const skipButton = page.locator('[data-testid="cardia-skip-ability-btn"]');
await skipButton.click();
```

### 3. 游戏状态访问

**可用的全局变量**：
- `window.__BG_STATE__` - 游戏状态
- `window.__BG_PLAYER_ID__` - 当前玩家ID
- `window.__BG_DISPATCH__` - 命令分发函数
- `window.__BG_TEST_HARNESS__` - 测试工具（需要集成）

## 下一步计划

### 优先级 P0：完善角色测试

1. **集成 TestHarness** ⏸️
   - 在 `Board.tsx` 中调用 `exposeDebugTools()`
   - 验证 `window.__BG_TEST_HARNESS__` 可用
   - 创建卡牌注入辅助函数

2. **重构角色测试** ⏸️
   - 使用 TestHarness 注入特定卡牌
   - 为每个角色创建独立测试
   - 验证能力效果正确执行

### 优先级 P1：扩展测试覆盖

1. **能力组合测试** ⏸️
   - 测试多个能力连续触发
   - 测试能力效果叠加
   - 测试能力冲突和优先级

2. **边界条件测试** ⏸️
   - 测试空牌库情况
   - 测试无有效目标情况
   - 测试资源不足情况

### 优先级 P2：性能和稳定性

1. **测试稳定性** ⏸️
   - 减少 `waitForTimeout` 使用
   - 使用 `waitForFunction` 等待状态变化
   - 添加重试机制

2. **测试性能** ⏸️
   - 优化测试执行时间
   - 并行运行独立测试
   - 复用浏览器上下文

## 总结

✅ **游戏基本流程已完全跑通**，可以正常进行多个回合的游戏。

✅ **E2E 测试基础设施已搭建**，包括辅助函数和测试模板。

⏸️ **角色专属测试需要使用 TestHarness**，以便精确控制测试场景。

建议下一步优先集成 TestHarness，然后为每个角色创建专属测试，确保所有能力都能被正确测试。

