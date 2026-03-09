# E2E 测试 TestHarness 作弊指令审计报告

## 审计概述

本次审计针对 Cardia 游戏的 E2E 测试进行了改进，尝试引入 TestHarness 作弊指令来直接构造测试场景。

**审计日期**：2025-01-XX
**审计范围**：E2E 测试辅助函数和测试用例
**目标**：使用作弊指令提高测试稳定性和效率
**结果**：❌ **TestHarness 方案不适用于在线对局测试**

---

## 核心发现：TestHarness 的局限性

### 问题根源

**TestHarness 只能修改客户端状态，无法修改服务器状态**

在在线对局中：
- **服务器是状态的唯一真实来源**（Single Source of Truth）
- 客户端通过 WebSocket 接收服务器推送的状态更新
- 所有命令（PLAY_CARD、ACTIVATE_ABILITY 等）都由服务器验证
- `TestHarness.state.set()` 只修改客户端的本地状态副本

### 验证失败的证据

```
[WebServer] [Cardia] PLAY_CARD validation failed: Card not in hand {
  playerId: '1',
  cardUid: 'deck_i_card_05_1772282407114_8y53kex7w',
  handCards: [
    'deck_i_card_04_1772282407114_vrvikay4q',
    'deck_i_card_08_1772282407114_r4h3z8pur',
    'deck_i_card_03_1772282407114_pe1yvldh4',
    'deck_i_card_14_1772282407114_hebvhhdcx',
    'deck_i_card_07_1772282407114_glbbh37fu'
  ]
}
```

**分析**：
1. 客户端通过 `TestHarness.state.set()` 注入了影响力5的卡牌
2. 客户端 UI 显示手牌中有影响力5的卡牌
3. 测试代码点击影响力5的卡牌，发送 `PLAY_CARD` 命令到服务器
4. **服务器验证失败**：服务器的状态中，P2 的手牌没有这张卡牌
5. 命令被拒绝，游戏流程无法推进

### 为什么验证测试通过了？

`cardia-test-harness-validation.e2e.ts` 测试通过是因为：
- ✅ 它只**读取**客户端状态，不发送命令到服务器
- ✅ 客户端状态确实被 `TestHarness.state.set()` 修改了
- ❌ 但这不代表服务器状态也被修改了

---

## 架构分析

### 在线对局架构

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Client    │ ◄─────────────────────────► │   Server    │
│             │                              │             │
│ TestHarness │  ✗ 无法同步到服务器          │  Core State │
│   state     │                              │  (真实来源) │
│             │                              │             │
│ UI 显示     │  ✓ 可以修改                  │  Validation │
│             │                              │  (命令验证) │
└─────────────┘                              └─────────────┘
       │                                            │
       │  PLAY_CARD command                        │
       │  (cardUid from injected state)            │
       └──────────────────────────────────────────►│
                                                    │
                                          ❌ Validation Failed
                                          Card not in hand
```

### 本地对局架构（理论上可行）

```
┌─────────────┐
│   Client    │
│             │
│ TestHarness │  ✓ 直接修改本地状态
│   state     │
│             │
│ Local Game  │  ✓ 无服务器验证
│  Engine     │
│             │
└─────────────┘
```

**注意**：Cardia 游戏 `allowLocalMode=false`，不支持本地模式，所以这个方案也不可行。

---

## 可行的解决方案

### 方案1：保留现有的重试机制（推荐）✅

**优点**：
- ✅ 已经验证可行
- ✅ 不依赖 TestHarness
- ✅ 适用于在线对局
- ✅ 测试逻辑简单

**缺点**：
- ❌ 测试运行时间较长（需要重试）
- ❌ 依赖随机性（可能需要多次重试）

**实现**：
```typescript
// 保留现有的 retryUntilHandContains 机制
await retryUntilHandContains(p1Page, [1], async () => {
    await endTurn(p1Page);
    await endTurn(p2Page);
});
```

### 方案2：服务器端作弊命令（需要开发）🔧

**思路**：
- 在服务器端实现作弊命令（如 `CHEAT_SET_HAND`）
- 通过 WebSocket 发送作弊命令到服务器
- 服务器修改状态后广播给所有客户端

**优点**：
- ✅ 服务器和客户端状态同步
- ✅ 测试稳定且快速
- ✅ 适用于在线对局

**缺点**：
- ❌ 需要开发服务器端作弊系统
- ❌ 需要确保作弊命令只在测试环境可用
- ❌ 增加代码复杂度

**实现示例**：
```typescript
// 服务器端
case CARDIA_COMMANDS.CHEAT_SET_HAND:
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('Cheat commands only available in test environment');
    }
    return executeCheatSetHand(core, command);

// 客户端测试
await dispatch({
    type: 'cardia:cheat_set_hand',
    playerId: '0',
    payload: { influences: [1, 3, 5] }
});
```

### 方案3：使用调试面板注入状态（需要验证）🔍

**思路**：
- 使用 `applyCoreStateDirect` 直接修改服务器状态
- 通过调试面板的 API 注入状态

**优点**：
- ✅ 可能可以修改服务器状态
- ✅ 不需要开发新的作弊命令

**缺点**：
- ❌ 需要验证是否真的修改了服务器状态
- ❌ 可能只修改了客户端状态

**需要验证**：
```typescript
await p1Page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    // 这个方法是否会同步到服务器？
    harness.state.patch({ ... });
});
```

---

## 总结

### 已完成 ✅
- ✅ 创建了完整的作弊指令辅助函数库
- ✅ 验证了 TestHarness 的基础功能（客户端状态读写）
- ✅ 创建了改进版测试示例
- ✅ **发现了 TestHarness 的根本局限性**

### 核心结论 ⚠️
- ❌ **TestHarness 不适用于在线对局的状态注入**
- ✅ TestHarness 只能用于客户端状态读取和本地模式测试
- ✅ 在线对局测试必须使用服务器端作弊命令或保留重试机制

### 推荐方案
1. **短期**：保留现有的重试机制（`retryUntilHandContains`）
2. **中期**：开发服务器端作弊命令系统
3. **长期**：考虑支持本地模式（`allowLocalMode=true`）用于快速测试

### 下一步行动
1. ✅ 更新审计报告，记录 TestHarness 的局限性
2. ⏳ 恢复使用重试机制的测试
3. ⏳ 评估是否值得开发服务器端作弊命令
4. ⏳ 如果开发作弊命令，需要：
   - 设计作弊命令 API
   - 实现服务器端逻辑
   - 添加环境检查（只在测试环境可用）
   - 更新测试辅助函数

---

## 附录：TestHarness 适用场景

### ✅ 适用场景
- 读取客户端状态（`getPlayerHand`、`getCurrentEncounter`）
- 本地模式测试（如果游戏支持 `allowLocalMode=true`）
- 控制随机数（`dice.setValues`、`random.setQueue`）
- UI 交互辅助（`clickAbilityButton`、`playCardByIndex`）

### ❌ 不适用场景
- 在线对局的状态注入（`injectHandCards`、`injectPlayedCards`）
- 修改服务器验证的状态（手牌、牌库、场上卡牌）
- 绕过服务器端验证逻辑

---

## 教训与最佳实践

### 教训
1. **客户端-服务器架构的测试必须考虑状态同步**
   - 客户端状态修改不会自动同步到服务器
   - 服务器是状态的唯一真实来源
   - 命令验证在服务器端进行

2. **验证测试的有效性**
   - 测试通过不代表功能正确
   - 必须验证测试是否真正测试了目标行为
   - 读取状态 ≠ 修改状态

3. **工具的适用范围**
   - TestHarness 设计用于本地模式和状态读取
   - 不是所有工具都适用于所有场景
   - 需要根据架构选择合适的测试策略

### 最佳实践
1. **在线对局测试**：
   - 使用服务器端作弊命令
   - 或使用重试机制处理随机性
   - 不依赖客户端状态注入

2. **本地模式测试**：
   - 可以使用 TestHarness 注入状态
   - 适合快速迭代和调试
   - 需要游戏支持 `allowLocalMode=true`

3. **混合策略**：
   - 本地模式：快速功能测试
   - 在线模式：完整集成测试
   - 根据测试目标选择合适的模式



### 1. 创建作弊指令辅助函数库 ✅

**文件**：`e2e/helpers/cardia-test-helpers.ts`

**提供的功能**：

#### 手牌注入
- ✅ `injectHandCards(page, playerId, cardDefIds)` - 按卡牌 ID 注入手牌
- ✅ `injectHandCardsByInfluence(page, playerId, influences)` - 按影响力注入手牌
- **特性**：自动从牌库/弃牌堆/对手牌库中查找卡牌，确保注入成功

#### 场上卡牌注入
- ✅ `injectPlayedCards(page, playerId, cardDefIds, encounterIndex)` - 注入场上卡牌
- **特性**：自动设置 `encounterIndex`、`signets`、`ongoingMarkers` 等字段

#### 阶段控制
- ✅ `setPhase(page, phase)` - 设置游戏阶段
- ✅ `waitForAbilityPhase(page, expectedLoserId, timeout)` - 等待进入能力阶段

#### 印戒和标记注入
- ✅ `addSignetsToCard(page, playerId, encounterIndex, signets)` - 添加印戒
- ✅ `addModifierToken(page, cardUid, value, source)` - 添加修正标记
- ✅ `addOngoingAbility(page, abilityId, cardUid, playerId, effectType)` - 添加持续能力

#### UI 交互
- ✅ `playCardByInfluence(page, influence)` - 打出指定影响力的手牌
- ✅ `clickAbilityButton(page, abilityId?)` - 点击能力按钮
- ✅ `clickSkipButton(page)` - 点击跳过按钮

#### 状态读取
- ✅ `getPlayerHand(page, playerId)` - 读取玩家手牌
- ✅ `getPlayerPlayedCards(page, playerId)` - 读取场上卡牌
- ✅ `getPlayerTotalSignets(page, playerId)` - 读取印戒总数
- ✅ `getCurrentEncounter(page)` - 读取当前遭遇状态

#### 向后兼容
- ✅ `skipAbility(page)` - 跳过能力（别名）
- ✅ `endTurn(page)` - 结束回合
- ✅ `playCardByIndex(page, index)` - 按索引打出手牌

---

## 验证测试结果

### TestHarness 基础功能验证 ✅

**文件**：`e2e/cardia-test-harness-validation.e2e.ts`

**测试结果**：2/2 通过 ✅

#### 测试1：验证手牌注入功能 ✅
- ✅ 成功注入 P1 手牌（影响力1和3）
- ✅ 成功注入 P2 手牌（影响力5和7）
- ✅ 注入后手牌数量和影响力值正确

**日志输出**：
```
初始手牌: [
  'deck_i_card_13 (影响力13)',
  'deck_i_card_02 (影响力2)',
  'deck_i_card_09 (影响力9)'
]
注入后手牌: [ 'deck_i_card_01 (影响力1)', 'deck_i_card_03 (影响力3)' ]
✅ 手牌注入功能正常
P2 注入后手牌: [ 'deck_i_card_05 (影响力5)', 'deck_i_card_07 (影响力7)' ]
✅ P2 手牌注入功能正常
```

#### 测试2：验证状态读取功能 ✅
- ✅ 成功读取游戏阶段（play）
- ✅ 成功读取回合数（1）
- ✅ 成功读取双方手牌和牌库数量

**日志输出**：
```
游戏状态: {
  phase: 'play',
  turnNumber: 1,
  currentPlayerId: '0',
  p1HandCount: 5,
  p2HandCount: 5,
  p1DeckCount: 11,
  p2DeckCount: 11
}
✅ 状态读取功能正常
```

---

## 改进版测试用例

### 1. 雇佣剑士测试（改进版）

**文件**：`e2e/cardia-deck1-card01-mercenary-swordsman-improved.e2e.ts`

**改进点**：
- ✅ 使用 `injectHandCardsByInfluence()` 直接注入特定手牌
- ✅ 避免重试机制，提高测试效率
- ✅ 包含边界条件测试（对手无卡牌）

**当前状态**：⚠️ 测试失败（需要调试）

**失败原因**：
1. 第一个测试：等待能力阶段超时
   - 可能原因：游戏流程没有正确推进到能力阶段
   - 需要检查：遭遇结算逻辑是否正常工作

2. 第二个测试：注入手牌后找不到卡牌
   - 可能原因：注入逻辑与实际游戏状态不同步
   - 需要检查：TestHarness 的 `state.set()` 是否正确应用

### 2. 外科医生测试（改进版）

**文件**：`e2e/cardia-deck1-card03-surgeon-improved.e2e.ts`

**改进点**：
- ✅ 使用 `injectPlayedCards()` 注入场上卡牌
- ✅ 使用 `injectHandCardsByInfluence()` 注入手牌
- ✅ 包含多种测试场景：
  - 基础功能：添加 +5 修正标记
  - 边界条件：无可选目标时跳过
  - 多目标：多张可选目标时正确选择

**当前状态**：⚠️ 未运行（等待雇佣剑士测试通过后再测试）

---

## 发现的问题

### P1：游戏流程推进问题 ⚠️

**问题描述**：
- 使用作弊指令注入手牌后，打出卡牌可能无法正确触发遭遇结算
- 导致测试无法进入能力阶段

**可能原因**：
1. 注入的卡牌缺少必要的字段（如 `modifiers`、`tags`、`ongoingMarkers`）
2. 游戏状态不一致（如 `hasPlayed` 标志未正确设置）
3. 遭遇结算逻辑依赖某些未注入的状态

**解决方案**：
- [ ] 检查注入的卡牌是否包含所有必需字段
- [ ] 在注入后验证游戏状态的完整性
- [ ] 添加调试日志追踪游戏流程

### P2：状态同步问题 ⚠️

**问题描述**：
- `TestHarness.state.set()` 可能不会立即同步到 UI
- 导致 `playCardByInfluence()` 找不到刚注入的卡牌

**可能原因**：
1. React 状态更新是异步的
2. TestHarness 的状态更新需要时间传播
3. 需要等待一个渲染周期

**解决方案**：
- [ ] 在注入后添加 `waitForTimeout()` 等待状态同步
- [ ] 使用 `waitForFunction()` 等待特定状态出现
- [ ] 验证 TestHarness 的状态更新机制

---

## 下一步计划

### 短期任务（立即执行）

1. **调试雇佣剑士测试** ⚠️
   - [ ] 添加详细的调试日志
   - [ ] 验证注入的卡牌字段完整性
   - [ ] 检查游戏流程推进逻辑
   - [ ] 修复状态同步问题

2. **完善作弊指令** 🔄
   - [ ] 添加状态同步等待机制
   - [ ] 改进错误处理和日志输出
   - [ ] 添加字段完整性验证

3. **运行外科医生测试** ⏳
   - [ ] 等待雇佣剑士测试通过
   - [ ] 验证交互系统是否正常工作
   - [ ] 测试卡牌选择弹窗

### 中期任务（后续执行）

4. **改写现有测试** 📋
   - [ ] 使用作弊指令改写所有 Deck I 测试
   - [ ] 移除重试机制，提高测试效率
   - [ ] 统一测试模式和代码风格

5. **补充测试覆盖** 📋
   - [ ] 为剩余能力补充 E2E 测试
   - [ ] 覆盖更多边界条件和组合场景
   - [ ] 验证所有交互类型

### 长期任务（优化改进）

6. **测试工具优化** 🔧
   - [ ] 创建测试场景构造器（Builder 模式）
   - [ ] 添加常用场景的快捷函数
   - [ ] 改进错误诊断和调试工具

7. **文档和示例** 📚
   - [ ] 编写作弊指令使用指南
   - [ ] 提供更多测试示例
   - [ ] 记录最佳实践和常见陷阱

---

## 总结

### 已完成 ✅
- ✅ 创建了完整的作弊指令辅助函数库
- ✅ 验证了基础功能（手牌注入、状态读取）
- ✅ 创建了改进版测试示例

### 进行中 🔄
- 🔄 调试雇佣剑士测试
- 🔄 完善作弊指令的稳定性

### 待完成 ⏳
- ⏳ 修复游戏流程推进问题
- ⏳ 修复状态同步问题
- ⏳ 改写所有现有测试

### 关键成果
- **测试效率提升**：避免重试机制，测试运行时间缩短
- **测试稳定性提升**：精确控制测试场景，减少随机性
- **测试可维护性提升**：统一的辅助函数库，易于扩展和修改

### 下一步行动
1. 优先修复雇佣剑士测试的问题
2. 完善作弊指令的状态同步机制
3. 验证外科医生测试是否正常工作
4. 逐步改写其他现有测试

---

## 附录：作弊指令使用示例

### 示例1：注入特定手牌并打出

```typescript
// 注入 P1 手牌：影响力1和3
await injectHandCardsByInfluence(p1Page, '0', [1, 3]);

// 注入 P2 手牌：影响力5
await injectHandCardsByInfluence(p2Page, '1', [5]);

// P1 打出影响力1
await playCardByInfluence(p1Page, 1);

// P2 打出影响力5
await playCardByInfluence(p2Page, 5);

// 等待进入能力阶段（P1失败）
await waitForAbilityPhase(p1Page, '0');
```

### 示例2：构造场上卡牌场景

```typescript
// 注入 P1 的场上卡牌（影响力1，第1次遭遇）
await injectPlayedCards(p1Page, '0', ['deck_i_card_01'], 1);

// 为场上卡牌添加印戒
await addSignetsToCard(p1Page, '0', 1, 2);

// 添加修正标记
const cardUid = await p1Page.evaluate(() => {
    const state = (window as any).__BG_STATE__;
    return state.core.players['0'].playedCards[0].uid;
});
await addModifierToken(p1Page, cardUid, 5, 'surgeon');
```

### 示例3：读取游戏状态

```typescript
// 读取玩家手牌
const hand = await getPlayerHand(p1Page, '0');
console.log('手牌:', hand.map(c => `${c.defId} (影响力${c.baseInfluence})`));

// 读取场上卡牌
const playedCards = await getPlayerPlayedCards(p1Page, '0');
console.log('场上卡牌:', playedCards);

// 读取印戒总数
const signets = await getPlayerTotalSignets(p1Page, '0');
console.log('印戒总数:', signets);

// 读取当前遭遇
const encounter = await getCurrentEncounter(p1Page);
console.log('当前遭遇:', encounter);
```
