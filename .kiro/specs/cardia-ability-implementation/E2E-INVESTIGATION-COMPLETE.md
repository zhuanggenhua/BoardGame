# E2E 测试状态注入调查完成报告

## 执行摘要

✅ **调查完成，方案已实施**

经过完整的调查和实施，成功为 Cardia E2E 测试找到了可行的状态注入方案：**Debug Panel API**。

---

## 调查时间线

### 2025-02-28 上午：TestHarness 探索
- **目标**：使用 TestHarness 作弊指令直接构造测试场景
- **实施**：创建了完整的辅助函数库（`e2e/helpers/cardia-test-helpers.ts`）
- **结果**：验证测试通过，但实际测试失败

### 2025-02-28 中午：根因分析
- **发现**：TestHarness 只修改客户端状态，不同步到服务端
- **证据**：服务端日志显示 "Card not in hand" 验证失败
- **结论**：TestHarness 不适用于在线对局的状态注入

### 2025-02-28 下午：Debug Panel API 方案
- **发现**：其他游戏使用 Debug Panel API 进行状态注入
- **验证**：`SYS_CHEAT_SET_STATE` 命令在引擎层处理，自动同步到服务端
- **实施**：在 `e2e/helpers/cardia.ts` 中实现完整的 Debug Panel API
- **结果**：✅ 方案可行，已完成实施

---

## 关键发现

### 1. TestHarness 的局限性

**问题**：TestHarness 只能修改客户端状态，无法同步到服务端

```
TestHarness.state.set({ ... })
  ↓ 直接修改 window.__BG_STATE__
  ↓ 客户端 UI 更新 ✅
  ↓ 服务端状态不变 ❌
  ↓
dispatch('PLAY_CARD', { cardUid: 'injected-card' })
  ↓ 发送到服务端
  ↓ 服务端验证：cardUid 是否在 serverState.players['0'].hand 中？
  ↓ 验证失败：Card not in hand ❌
```

**结论**：TestHarness 不适用于在线对局的状态注入

### 2. Debug Panel API 的优势

**原理**：通过 `SYS_CHEAT_SET_STATE` 命令在引擎层处理，自动同步到服务端

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

**结论**：Debug Panel API 是正确的解决方案

---

## 实施成果

### 代码实现

**文件**：`e2e/helpers/cardia.ts`（+200 行）

#### 核心 API（5 个函数）
1. `ensureDebugPanelOpen(page)` - 确保调试面板打开
2. `ensureDebugPanelClosed(page)` - 确保调试面板关闭
3. `ensureDebugStateTab(page)` - 切换到状态 Tab
4. `readCoreState(page)` - 读取当前状态
5. `applyCoreStateDirect(page, coreState)` - 注入完整状态

#### Cardia 专用函数（7 个函数）
1. `injectHandCards(page, playerId, cards)` - 注入手牌
2. `injectFieldCards(page, playerId, cards)` - 注入场上卡牌
3. `setPlayerResource(page, playerId, resourceId, value)` - 设置资源
4. `setPhase(page, phase)` - 设置游戏阶段
5. `setCurrentPlayer(page, playerId)` - 设置当前玩家
6. `setPlayerToken(page, playerId, tokenId, amount)` - 设置 Token
7. `setPlayerMarker(page, playerId, markerId, amount)` - 设置 Marker

### 文档产出

1. ✅ **E2E-TEST-HARNESS-AUDIT.md** - 完整的 TestHarness 调查报告
2. ✅ **E2E-TESTHARNESS-CONCLUSION.md** - TestHarness 结论和建议
3. ✅ **E2E-DEBUG-PANEL-SOLUTION.md** - Debug Panel API 方案文档
4. ✅ **E2E-DEBUG-PANEL-IMPLEMENTATION.md** - 实施完成报告
5. ✅ **E2E-INVESTIGATION-COMPLETE.md** - 调查完成报告（本文件）

---

## 使用示例

### 完整测试用例

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
        
        // 4. 打出卡牌
        await handCard.click();
        
        // 5. 验证卡牌进入场上
        const fieldCard = hostPage.locator('[data-field-card-id="mercenary_swordsman"]');
        await expect(fieldCard).toBeVisible();
        
        // 6. 激活能力
        const abilityButton = fieldCard.locator('button:has-text("激活能力")');
        await abilityButton.click();
        
        // 7. 验证能力效果
        const state = await readCoreState(hostPage);
        expect(state.players['0'].resources.attack).toBeGreaterThan(0);
    });
});
```

---

## 下一步工作

### Phase 3: 更新测试用例 ⏳
- [ ] 更新 `e2e/cardia-deck1-card01-mercenary-swordsman.e2e.ts`
- [ ] 更新 `e2e/cardia-deck1-card03-surgeon.e2e.ts`
- [ ] 验证所有测试通过

### Phase 4: 清理遗留代码 ⏳
- [ ] 删除 `e2e/helpers/cardia-test-helpers.ts`（TestHarness 方案）
- [ ] 删除 `e2e/cardia-test-harness-validation.e2e.ts`
- [ ] 删除 `e2e/cardia-deck1-card01-mercenary-swordsman-improved.e2e.ts`
- [ ] 删除 `e2e/cardia-deck1-card03-surgeon-improved.e2e.ts`
- [ ] 更新审计文档

---

## 技术对比

### TestHarness vs Debug Panel API

| 维度 | TestHarness | Debug Panel API |
|------|------------|----------------|
| **修改方式** | 直接修改 `window.__BG_STATE__` | 通过 `dispatch()` 发送命令 |
| **引擎处理** | ❌ 绕过引擎 | ✅ 经过引擎管线 |
| **服务端同步** | ❌ 不同步 | ✅ 自动同步 |
| **命令验证** | ❌ 基于旧状态 | ✅ 基于新状态 |
| **适用场景** | 仅客户端状态读取 | 在线对局状态注入 |
| **已验证游戏** | - | DiceThrone, SmashUp, SummonerWars |

### TestHarness 的正确定位

✅ **适用场景**：
- 状态读取（`readCoreState`）
- 随机数控制（`dice.setValues`, `random.setQueue`）
- 本地模式状态注入（如果游戏支持 `allowLocalMode=true`）

❌ **不适用场景**：
- 在线对局状态注入（使用 Debug Panel API 替代）
- 绕过服务端验证

---

## 经验教训

### 1. 架构理解的重要性
- 在线对局使用客户端-服务端架构
- 服务端是单一真实来源
- 客户端状态仅用于 UI 显示

### 2. 工具选择需要验证
- TestHarness 设计用于客户端测试（随机数控制、状态读取）
- 不适用于需要服务端验证的场景
- 需要完整的端到端测试验证

### 3. 参考现有实现
- DiceThrone、SmashUp、SummonerWars 已有成熟方案
- Debug Panel API 是经过验证的解决方案
- 避免重复造轮子

### 4. 完整的调查流程
- 探索 → 验证 → 根因分析 → 方案对比 → 实施
- 每个阶段都有明确的产出（代码、文档、结论）
- 失败的方案也有价值（排除法、经验教训）

---

## 代码质量

### JSDoc 文档 ✅
所有函数都包含完整的 JSDoc 文档：
- 参数说明
- 返回值说明
- 使用示例
- 注意事项

### 类型安全 ✅
- 所有参数都有明确的类型定义
- 使用 TypeScript 类型检查
- 错误处理（玩家不存在时抛出异常）

### 一致性 ✅
- API 设计与 DiceThrone/SmashUp 保持一致
- 命名规范统一
- 参数顺序一致（page, playerId, ...）

---

## 文件清单

### 新增文件 ✅
1. ✅ `.kiro/specs/cardia-ability-implementation/E2E-TEST-HARNESS-AUDIT.md`
2. ✅ `.kiro/specs/cardia-ability-implementation/E2E-TESTHARNESS-CONCLUSION.md`
3. ✅ `.kiro/specs/cardia-ability-implementation/E2E-DEBUG-PANEL-SOLUTION.md`
4. ✅ `.kiro/specs/cardia-ability-implementation/E2E-DEBUG-PANEL-IMPLEMENTATION.md`
5. ✅ `.kiro/specs/cardia-ability-implementation/E2E-INVESTIGATION-COMPLETE.md`（本文件）

### 修改文件 ✅
1. ✅ `e2e/helpers/cardia.ts`（+200 行 Debug Panel API）

### 待删除文件 ⏳
1. ⏳ `e2e/helpers/cardia-test-helpers.ts`（TestHarness 方案，已废弃）
2. ⏳ `e2e/cardia-test-harness-validation.e2e.ts`（验证测试，已废弃）
3. ⏳ `e2e/cardia-deck1-card01-mercenary-swordsman-improved.e2e.ts`（改进测试，已废弃）
4. ⏳ `e2e/cardia-deck1-card03-surgeon-improved.e2e.ts`（改进测试，已废弃）

---

## 总结

✅ **调查完成，方案已实施**

经过完整的调查和实施，成功为 Cardia E2E 测试找到了可行的状态注入方案：**Debug Panel API**。

### 核心成果
- **调查报告**：完整记录了 TestHarness 的局限性和 Debug Panel API 的优势
- **代码实现**：12 个辅助函数（5 个核心 API + 7 个 Cardia 专用函数）
- **文档产出**：5 个完整的文档（审计、结论、方案、实施、总结）
- **代码质量**：完整的 JSDoc 文档、类型安全、错误处理

### 下一步行动
1. 更新现有测试用例
2. 验证所有测试通过
3. 清理遗留代码
4. 更新文档

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

**文档版本**: 1.0  
**创建日期**: 2025-02-28  
**最后更新**: 2025-02-28  
**状态**: ✅ 调查完成，方案已实施
