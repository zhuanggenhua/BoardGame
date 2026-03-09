# E2E TestHarness 调查结论

## 核心发现

**TestHarness 不适用于在线对局的状态注入测试**

### 问题根源

在 Cardia 的在线对局架构中：
1. **服务器是状态的唯一真实来源**（Single Source of Truth）
2. 客户端通过 WebSocket 接收服务器推送的状态更新
3. 所有游戏命令（PLAY_CARD、ACTIVATE_ABILITY 等）都由服务器验证
4. `TestHarness.state.set()` **只能修改客户端的本地状态副本**

### 失败的证据

```
测试尝试：
1. 使用 TestHarness.state.set() 注入 P2 手牌（影响力5）
2. 客户端 UI 显示手牌中有影响力5的卡牌 ✓
3. 测试代码点击影响力5的卡牌，发送 PLAY_CARD 命令
4. 服务器验证失败：Card not in hand ✗
5. 命令被拒绝，游戏流程无法推进 ✗

服务器日志：
[WebServer] [Cardia] PLAY_CARD validation failed: Card not in hand {
  playerId: '1',
  cardUid: 'deck_i_card_05_...',
  handCards: ['deck_i_card_04_...', 'deck_i_card_08_...', ...]
}
```

**结论**：客户端状态被修改了，但服务器状态没有变化，导致验证失败。

---

## 架构分析

### 在线对局数据流

```
┌─────────────────┐                    ┌─────────────────┐
│   Client (P1)   │                    │   Client (P2)   │
│                 │                    │                 │
│  TestHarness    │                    │  TestHarness    │
│  (本地状态)     │                    │  (本地状态)     │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │  WebSocket                           │  WebSocket
         │  (状态同步)                          │  (状态同步)
         │                                      │
         └──────────────┬───────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │   Game Server   │
              │                 │
              │   Core State    │ ◄─── 唯一真实来源
              │   (真实状态)    │
              │                 │
              │   Validation    │ ◄─── 命令验证
              └─────────────────┘
```

**关键点**：
- TestHarness 修改的是客户端的本地状态副本
- 服务器不知道客户端的本地修改
- 命令验证基于服务器的状态，不是客户端的状态

---

## 为什么验证测试通过了？

`cardia-test-harness-validation.e2e.ts` 测试通过的原因：

```typescript
// 验证测试只读取客户端状态，不发送命令到服务器
const hand = await getPlayerHand(p1Page, '0');
expect(hand).toHaveLength(2);  // ✓ 客户端状态确实被修改了

// 但这不代表服务器状态也被修改了！
```

**误导性**：验证测试通过让我们以为 TestHarness 可以用于状态注入，但实际上它只能用于状态读取。

---

## 可行的解决方案

### 方案1：保留重试机制（推荐）✅

**现状**：现有测试使用 `retryUntilHandContains` 重试机制

```typescript
// 重试直到手牌包含目标卡牌
await retryUntilHandContains(p1Page, [1], async () => {
    await endTurn(p1Page);
    await endTurn(p2Page);
});
```

**优点**：
- ✅ 已验证可行
- ✅ 不依赖 TestHarness
- ✅ 适用于在线对局
- ✅ 实现简单

**缺点**：
- ❌ 测试运行时间较长
- ❌ 依赖随机性

**结论**：这是目前最可靠的方案。

---

### 方案2：开发服务器端作弊命令（需要开发）🔧

**思路**：在服务器端实现作弊命令，通过 WebSocket 发送

```typescript
// 服务器端实现
case CARDIA_COMMANDS.CHEAT_SET_HAND:
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('Cheat commands only in test env');
    }
    // 修改服务器状态
    player.hand = createCardsFromInfluences(payload.influences);
    // 广播状态更新到所有客户端
    broadcastStateUpdate();
    return [];

// 客户端测试使用
await dispatch({
    type: 'cardia:cheat_set_hand',
    playerId: '0',
    payload: { influences: [1, 3, 5] }
});
```

**优点**：
- ✅ 服务器和客户端状态同步
- ✅ 测试稳定且快速
- ✅ 适用于在线对局

**缺点**：
- ❌ 需要开发新功能
- ❌ 需要环境检查（只在测试环境可用）
- ❌ 增加代码复杂度

**工作量估算**：
1. 定义作弊命令类型（1小时）
2. 实现服务器端逻辑（2-3小时）
3. 添加环境检查和安全措施（1小时）
4. 更新测试辅助函数（1小时）
5. 测试和验证（1-2小时）

**总计**：6-8小时

---

### 方案3：支持本地模式（需要架构调整）🏗️

**思路**：允许 Cardia 游戏在本地模式运行（`allowLocalMode=true`）

**优点**：
- ✅ TestHarness 可以直接修改状态
- ✅ 测试快速且稳定
- ✅ 不需要服务器

**缺点**：
- ❌ 需要架构调整
- ❌ 本地模式和在线模式可能有差异
- ❌ 无法测试网络相关功能

**工作量估算**：
1. 修改 manifest.ts（`allowLocalMode=true`）（5分钟）
2. 确保本地模式下所有功能正常（1-2小时）
3. 更新测试以支持本地模式（1小时）
4. 验证本地模式和在线模式的一致性（2-3小时）

**总计**：4-6小时

**风险**：本地模式和在线模式可能有细微差异，导致测试不可靠。

---

## 推荐方案

### 短期（立即执行）
**保留现有的重试机制**

- 不需要额外开发
- 测试已经可以运行
- 虽然慢，但可靠

### 中期（如果测试数量增加）
**开发服务器端作弊命令**

- 投入 6-8 小时开发
- 大幅提升测试效率
- 适用于所有在线对局测试

### 长期（如果需要快速迭代）
**支持本地模式**

- 投入 4-6 小时调整
- 最快的测试速度
- 需要确保本地/在线一致性

---

## TestHarness 的正确用途

### ✅ 适用场景

1. **状态读取**
   ```typescript
   const hand = await getPlayerHand(p1Page, '0');
   const encounter = await getCurrentEncounter(p1Page);
   ```

2. **随机数控制**
   ```typescript
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
       window.__BG_TEST_HARNESS__!.random.setQueue([0.5, 0.8, 0.2]);
   });
   ```

3. **本地模式状态注入**（如果游戏支持）
   ```typescript
   // 仅在 allowLocalMode=true 时可用
   await injectHandCards(page, '0', ['card_01', 'card_03']);
   ```

4. **UI 交互辅助**
   ```typescript
   await clickAbilityButton(p1Page);
   await playCardByIndex(p1Page, 0);
   ```

### ❌ 不适用场景

1. **在线对局的状态注入**
   ```typescript
   // ❌ 不会同步到服务器
   await injectHandCards(p1Page, '0', ['card_01']);
   await playCardByInfluence(p1Page, 1);  // 验证失败
   ```

2. **绕过服务器验证**
   ```typescript
   // ❌ 服务器仍然会验证
   await page.evaluate(() => {
       const state = window.__BG_STATE__;
       state.core.players['0'].hand = [...];  // 无效
   });
   ```

---

## 总结

### 核心结论
1. ❌ **TestHarness 不适用于在线对局的状态注入**
2. ✅ TestHarness 适用于状态读取和随机数控制
3. ✅ 在线对局测试应使用重试机制或服务器端作弊命令

### 下一步行动
1. ✅ 更新审计报告，记录 TestHarness 的局限性
2. ⏳ 恢复使用重试机制的测试
3. ⏳ 评估是否值得开发服务器端作弊命令
4. ⏳ 如果测试数量增加，考虑投入开发作弊命令系统

### 教训
1. **验证测试的有效性**：测试通过不代表功能正确
2. **理解架构限制**：客户端-服务器架构的测试必须考虑状态同步
3. **选择合适的工具**：不是所有工具都适用于所有场景

---

## 附录：相关文件

- `e2e/helpers/cardia-test-helpers.ts` - TestHarness 辅助函数（状态读取部分仍然有用）
- `e2e/cardia-test-harness-validation.e2e.ts` - 验证测试（证明客户端状态可以修改）
- `e2e/cardia-deck1-card01-mercenary-swordsman-improved.e2e.ts` - 失败的测试（证明服务器状态无法修改）
- `.kiro/specs/cardia-ability-implementation/E2E-TEST-HARNESS-AUDIT.md` - 完整审计报告



---

## 更新：Debug Panel API 方案已实施 ✅

**日期**：2025-02-28  
**状态**：✅ 方案已成功实施

### 实施摘要

经过进一步调查，发现其他游戏（DiceThrone、SmashUp、SummonerWars）使用 **Debug Panel API** 进行状态注入，该方案通过 `SYS_CHEAT_SET_STATE` 命令在引擎层处理，能够正确同步到服务端。

### Debug Panel API vs TestHarness

| 维度 | TestHarness | Debug Panel API |
|------|------------|----------------|
| **修改方式** | 直接修改 `window.__BG_STATE__` | 通过 `dispatch()` 发送命令 |
| **引擎处理** | ❌ 绕过引擎 | ✅ 经过引擎管线 |
| **服务端同步** | ❌ 不同步 | ✅ 自动同步 |
| **命令验证** | ❌ 基于旧状态 | ✅ 基于新状态 |
| **适用场景** | 仅客户端状态读取 | 在线对局状态注入 |

### 已实施功能

#### 核心 API（5 个函数）
- `ensureDebugPanelOpen(page)` - 确保调试面板打开
- `ensureDebugPanelClosed(page)` - 确保调试面板关闭
- `ensureDebugStateTab(page)` - 切换到状态 Tab
- `readCoreState(page)` - 读取当前状态
- `applyCoreStateDirect(page, coreState)` - 注入完整状态

#### Cardia 专用函数（7 个函数）
- `injectHandCards(page, playerId, cards)` - 注入手牌
- `injectFieldCards(page, playerId, cards)` - 注入场上卡牌
- `setPlayerResource(page, playerId, resourceId, value)` - 设置资源
- `setPhase(page, phase)` - 设置游戏阶段
- `setCurrentPlayer(page, playerId)` - 设置当前玩家
- `setPlayerToken(page, playerId, tokenId, amount)` - 设置 Token
- `setPlayerMarker(page, playerId, markerId, amount)` - 设置 Marker

### 使用示例

```typescript
import { test, expect } from './fixtures';
import { 
    readCoreState, 
    applyCoreStateDirect,
    injectHandCards,
    setPlayerResource,
    setPhase 
} from './helpers/cardia';

test.describe('Cardia - Deck 1 - Card 01: Mercenary Swordsman', () => {
    test('should activate ability correctly', async ({ hostPage, guestPage, matchId }) => {
        // 1. 注入测试场景
        await injectHandCards(hostPage, '0', [
            { defId: 'mercenary_swordsman' }
        ]);
        await setPlayerResource(hostPage, '0', 'mana', 5);
        await setPhase(hostPage, 'main');
        
        // 2. 等待 UI 更新
        await hostPage.waitForTimeout(500);
        
        // 3. 验证手牌显示
        const handCard = hostPage.locator('[data-card-id="mercenary_swordsman"]');
        await expect(handCard).toBeVisible();
        
        // 4. 打出卡牌并验证效果
        await handCard.click();
        const state = await readCoreState(hostPage);
        expect(state.players['0'].resources.attack).toBeGreaterThan(0);
    });
});
```

### 工作原理

```
applyCoreStateDirect(page, newState)
  ↓ 填充到调试面板输入框
  ↓ 点击 Apply 按钮
  ↓ dispatch('SYS_CHEAT_SET_STATE', { state: newState })
  ↓ CheatSystem.beforeCommand 处理
  ↓ 返回 { halt: true, state: { ...state, core: newState } }
  ↓ 引擎管线更新状态
  ↓ 传输层广播到所有客户端
  ↓ 服务端状态已更新 ✅
```

### 相关文档

- **方案文档**：`.kiro/specs/cardia-ability-implementation/E2E-DEBUG-PANEL-SOLUTION.md`
- **实施报告**：`.kiro/specs/cardia-ability-implementation/E2E-DEBUG-PANEL-IMPLEMENTATION.md`
- **代码实现**：`e2e/helpers/cardia.ts`（+200 行）

### 下一步工作

- [ ] 更新 `e2e/cardia-deck1-card01-mercenary-swordsman.e2e.ts`
- [ ] 更新 `e2e/cardia-deck1-card03-surgeon.e2e.ts`
- [ ] 验证所有测试通过
- [ ] 删除 TestHarness 遗留代码
  - [ ] `e2e/helpers/cardia-test-helpers.ts`
  - [ ] `e2e/cardia-test-harness-validation.e2e.ts`
  - [ ] `e2e/cardia-deck1-card01-mercenary-swordsman-improved.e2e.ts`
  - [ ] `e2e/cardia-deck1-card03-surgeon-improved.e2e.ts`

### 最终结论

✅ **Debug Panel API 是 Cardia E2E 测试的正确方案**

- 通过引擎层处理，状态同步到服务端
- 已在 DiceThrone、SmashUp、SummonerWars 中验证
- API 简洁，易于使用
- 支持完整状态注入和部分字段修改

**TestHarness 的正确定位**：
- ✅ 状态读取
- ✅ 随机数控制
- ❌ 在线对局状态注入（使用 Debug Panel API 替代）

---

**更新版本**: 2.0  
**更新日期**: 2025-02-28  
**更新状态**: ✅ Debug Panel API 方案已实施
