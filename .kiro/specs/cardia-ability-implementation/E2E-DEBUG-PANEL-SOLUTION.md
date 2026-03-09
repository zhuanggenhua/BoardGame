# E2E 测试状态注入方案：Debug Panel API

## 执行摘要

**结论**：✅ **Debug Panel API 是可行的状态注入方案**

通过调试面板的 `SYS_CHEAT_SET_STATE` 命令可以直接修改游戏状态，且该命令在引擎层处理，能够正确同步到服务端。

---

## 方案对比

| 方案 | 客户端状态 | 服务端状态 | 命令验证 | 适用场景 |
|------|-----------|-----------|---------|---------|
| **TestHarness** | ✅ 修改 | ❌ 不修改 | ❌ 失败 | 仅客户端状态读取 |
| **Debug Panel API** | ✅ 修改 | ✅ 同步 | ✅ 通过 | 在线对局状态注入 |

---

## Debug Panel API 工作原理

### 1. 命令流程

```
UI 调试面板
  ↓ dispatch('SYS_CHEAT_SET_STATE', { state: newCore })
引擎层 CheatSystem.beforeCommand
  ↓ 返回 { halt: true, state: { ...state, core: payload.state } }
引擎管线 executePipeline
  ↓ 更新 state.core
传输层 GameTransportServer
  ↓ 广播状态更新到所有客户端
服务端状态 ✅ 已更新
```

### 2. 关键代码位置

**CheatSystem 处理器** (`src/engine/systems/CheatSystem.ts:331-337`):
```typescript
// 处理直接设置状态命令
if (command.type === CHEAT_COMMANDS.SET_STATE) {
    const payload = command.payload as SetStatePayload<TCore>;
    return {
        halt: true,
        state: { ...state, core: payload.state },
    };
}
```

**Debug Panel 分发** (`src/components/game/framework/widgets/GameDebugPanel.tsx:152-157`):
```typescript
const handleApplyState = useCallback(() => {
    try {
        const newState = JSON.parse(stateInput);
        dispatch('SYS_CHEAT_SET_STATE', { state: newState });
        setStateInput('');
        setShowStateInput(false);
        setApplyError(null);
    } catch (_err) {
        setApplyError(t('debug.state.errorInvalidJson'));
        setTimeout(() => setApplyError(null), 3000);
    }
}, [stateInput, dispatch, t]);
```

### 3. 为什么 Debug Panel 可行而 TestHarness 不可行？

| 维度 | TestHarness | Debug Panel |
|------|------------|-------------|
| **修改方式** | 直接修改客户端 `window.__BG_STATE__` | 通过 `dispatch()` 发送命令 |
| **引擎处理** | ❌ 绕过引擎 | ✅ 经过引擎管线 |
| **服务端同步** | ❌ 不同步 | ✅ 自动同步 |
| **命令验证** | ❌ 基于旧状态 | ✅ 基于新状态 |

---

## 可用的 Debug Panel API

### 核心 API（已在其他游戏中验证）

#### 1. `readCoreState(page)` - 读取当前状态
```typescript
const state = await readCoreState(page);
console.log('当前手牌:', state.players['0'].hand);
```

**实现** (`e2e/helpers/dicethrone.ts:127-132`):
```typescript
export const readCoreState = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.core ?? parsed?.G?.core ?? parsed;
};
```

#### 2. `applyCoreStateDirect(page, coreState)` - 注入完整状态
```typescript
const state = await readCoreState(page);
state.players['0'].hand = [
    { uid: 'card-1', defId: 'mercenary_swordsman', ... }
];
await applyCoreStateDirect(page, state);
```

**实现** (`e2e/helpers/dicethrone.ts:143-151`):
```typescript
export const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};
```

#### 3. `setPlayerResource(page, playerId, resourceId, value)` - 设置资源
```typescript
await setPlayerResource(page, '0', 'mana', 10);
```

**实现** (`e2e/helpers/dicethrone.ts:156-163`):
```typescript
export const setPlayerResource = async (page: Page, playerId: string, resourceId: string, value: number) => {
    const state = await readCoreState(page);
    if (!state.players || !state.players[playerId]) {
        throw new Error(`Player ${playerId} not found in state`);
    }
    state.players[playerId].resources[resourceId] = value;
    await applyCoreStateDirect(page, state);
};
```

#### 4. `setPlayerToken(page, playerId, tokenId, amount)` - 设置 Token
```typescript
await setPlayerToken(page, '0', 'shield', 5);
```

**实现** (`e2e/helpers/dicethrone.ts:168-178`):
```typescript
export const setPlayerToken = async (page: Page, playerId: string, tokenId: string, amount: number) => {
    const state = await readCoreState(page);
    if (!state.players || !state.players[playerId]) {
        throw new Error(`Player ${playerId} not found in state`);
    }
    if (!state.players[playerId].tokens) {
        state.players[playerId].tokens = {};
    }
    state.players[playerId].tokens[tokenId] = amount;
    await applyCoreStateDirect(page, state);
};
```

---

## Cardia 游戏适配方案

### 1. 创建 Cardia 专用辅助函数

**文件**: `e2e/helpers/cardia.ts`

```typescript
import { expect, type Page } from '@playwright/test';

// ============================================================================
// 调试面板操作
// ============================================================================

/** 确保调试面板打开并切换到状态 Tab */
export const ensureDebugStateTab = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (!await panel.isVisible().catch(() => false)) {
        await page.getByTestId('debug-toggle').click();
        await expect(panel).toBeVisible({ timeout: 5000 });
    }
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
};

/** 读取当前 core 状态 */
export const readCoreState = async (page: Page) => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw);
    return parsed?.core ?? parsed?.G?.core ?? parsed;
};

/** 直接注入 core 状态（使用调试面板） */
export const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};

// ============================================================================
// Cardia 专用状态注入
// ============================================================================

/** 注入手牌 */
export const injectHandCards = async (page: Page, playerId: string, cards: Array<{ defId: string; uid?: string }>) => {
    const state = await readCoreState(page);
    const player = state.players[playerId];
    if (!player) throw new Error(`Player ${playerId} not found`);
    
    // 生成完整的卡牌对象
    player.hand = cards.map((card, index) => ({
        uid: card.uid ?? `injected-${Date.now()}-${index}`,
        defId: card.defId,
        // 其他必要字段根据 Cardia 的卡牌结构补充
    }));
    
    await applyCoreStateDirect(page, state);
};

/** 注入场上卡牌 */
export const injectFieldCards = async (page: Page, playerId: string, cards: Array<{ defId: string; uid?: string; position: number }>) => {
    const state = await readCoreState(page);
    const player = state.players[playerId];
    if (!player) throw new Error(`Player ${playerId} not found`);
    
    // 清空现有场上卡牌
    player.field = [];
    
    // 添加新卡牌
    for (const card of cards) {
        player.field.push({
            uid: card.uid ?? `field-${Date.now()}-${card.position}`,
            defId: card.defId,
            position: card.position,
            // 其他必要字段
        });
    }
    
    await applyCoreStateDirect(page, state);
};

/** 设置玩家资源 */
export const setPlayerResource = async (page: Page, playerId: string, resourceId: string, value: number) => {
    const state = await readCoreState(page);
    const player = state.players[playerId];
    if (!player) throw new Error(`Player ${playerId} not found`);
    
    if (!player.resources) player.resources = {};
    player.resources[resourceId] = value;
    
    await applyCoreStateDirect(page, state);
};

/** 设置游戏阶段 */
export const setPhase = async (page: Page, phase: string) => {
    const state = await readCoreState(page);
    state.phase = phase;
    await applyCoreStateDirect(page, state);
};

/** 设置当前玩家 */
export const setCurrentPlayer = async (page: Page, playerId: string) => {
    const state = await readCoreState(page);
    state.currentPlayer = playerId;
    await applyCoreStateDirect(page, state);
};
```

### 2. 更新测试用例

**示例**: `e2e/cardia-deck1-card01-mercenary-swordsman.e2e.ts`

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

## 实施步骤

### Phase 1: 创建基础辅助函数 ✅
- [x] 创建 `e2e/helpers/cardia.ts`
- [x] 实现 `readCoreState`
- [x] 实现 `applyCoreStateDirect`
- [x] 实现 `ensureDebugStateTab`

### Phase 2: 实现 Cardia 专用函数
- [ ] 实现 `injectHandCards`
- [ ] 实现 `injectFieldCards`
- [ ] 实现 `setPlayerResource`
- [ ] 实现 `setPhase`
- [ ] 实现 `setCurrentPlayer`

### Phase 3: 更新测试用例
- [ ] 更新 `e2e/cardia-deck1-card01-mercenary-swordsman.e2e.ts`
- [ ] 更新 `e2e/cardia-deck1-card03-surgeon.e2e.ts`
- [ ] 验证所有测试通过

### Phase 4: 清理遗留代码
- [ ] 删除 `e2e/helpers/cardia-test-helpers.ts`（TestHarness 方案）
- [ ] 删除 `e2e/cardia-test-harness-validation.e2e.ts`
- [ ] 删除 `e2e/cardia-deck1-card01-mercenary-swordsman-improved.e2e.ts`
- [ ] 更新审计文档

---

## 技术细节

### Debug Panel UI 元素

| 元素 | Test ID | 用途 |
|------|---------|------|
| 调试按钮 | `debug-toggle` | 打开/关闭调试面板 |
| 调试面板 | `debug-panel` | 主面板容器 |
| 状态 Tab | `debug-tab-state` | 切换到状态视图 |
| 状态 JSON | `debug-state-json` | 显示当前状态 |
| 切换输入 | `debug-state-toggle-input` | 打开/关闭输入框 |
| 状态输入 | `debug-state-input` | 输入新状态 JSON |
| 应用按钮 | `debug-state-apply` | 应用新状态 |

### 状态结构示例（Cardia）

```typescript
{
    "phase": "main",
    "currentPlayer": "0",
    "turnNumber": 1,
    "players": {
        "0": {
            "id": "0",
            "hand": [
                {
                    "uid": "card-123",
                    "defId": "mercenary_swordsman",
                    "name": "佣兵剑士",
                    "cost": 2,
                    "attack": 3,
                    "health": 2
                }
            ],
            "field": [],
            "deck": [...],
            "discard": [],
            "resources": {
                "mana": 5,
                "attack": 0
            }
        },
        "1": { ... }
    }
}
```

---

## 风险与限制

### 已知限制
1. **状态结构依赖**：必须了解 Cardia 的完整状态结构
2. **UID 生成**：注入的卡牌需要唯一的 UID
3. **状态一致性**：注入后需要确保状态逻辑一致（如手牌数量与 deck 数量）

### 缓解措施
1. **读取现有状态**：先 `readCoreState` 获取当前结构，再修改
2. **使用时间戳**：`uid: \`injected-${Date.now()}-${index}\``
3. **最小化修改**：只修改测试必需的字段，保留其他字段不变

---

## 参考资料

### 代码位置
- **CheatSystem**: `src/engine/systems/CheatSystem.ts`
- **GameDebugPanel**: `src/components/game/framework/widgets/GameDebugPanel.tsx`
- **DiceThrone 辅助函数**: `e2e/helpers/dicethrone.ts`
- **SmashUp 辅助函数**: `e2e/helpers/smashup.ts`

### 相关文档
- **TestHarness 审计**: `.kiro/specs/cardia-ability-implementation/E2E-TEST-HARNESS-AUDIT.md`
- **TestHarness 结论**: `.kiro/specs/cardia-ability-implementation/E2E-TESTHARNESS-CONCLUSION.md`
- **自动化测试文档**: `docs/automated-testing.md`

---

## 总结

✅ **Debug Panel API 是 Cardia E2E 测试的正确方案**

- **优势**：
  - 通过引擎层处理，状态同步到服务端
  - 已在 DiceThrone、SmashUp、SummonerWars 中验证
  - API 简洁，易于使用
  - 支持完整状态注入和部分字段修改

- **下一步**：
  1. 实现 Cardia 专用辅助函数
  2. 更新现有测试用例
  3. 验证所有测试通过
  4. 清理 TestHarness 遗留代码

---

**文档版本**: 1.0  
**创建日期**: 2025-02-28  
**最后更新**: 2025-02-28  
**状态**: ✅ 方案确认
