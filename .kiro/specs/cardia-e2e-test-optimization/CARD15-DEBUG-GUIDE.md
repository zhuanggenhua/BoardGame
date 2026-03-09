# 发明家（Card15）完整调试指南

## 问题概述

**当前状态**：
- ✅ 第二次交互已成功创建并显示
- ✅ `inventorPending` 标记机制工作正常
- ❌ 第二次交互仍然放置 +3 而不是 -3

**根本原因**：
交互处理器在第二次被调用时，接收到的 `state.core.inventorPending` 为 `undefined`，导致判断逻辑认为这是第一次交互。

**当前实现逻辑**：
```typescript
const isFirstInteraction = !state.core.inventorPending;

if (isFirstInteraction) {
    // 放置 +3，设置 inventorPending
} else {
    // 放置 -3，清理 inventorPending
}
```

**问题**：第二次交互时，`state.core.inventorPending` 为 `undefined`，所以 `isFirstInteraction = true`，错误地放置了 +3。

---

## 手动测试步骤

### 准备工作

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **打开两个浏览器窗口/标签页**
   - 窗口 1（P1）：http://localhost:3000
   - 窗口 2（P2）：http://localhost:3000

3. **创建在线对局**
   - 在两个窗口中分别登录不同账号
   - 创建一个 Cardia 游戏房间
   - 两个玩家加入同一房间

### 步骤 1：注入测试状态

**方法 1：使用调试面板 UI（推荐）**

在 **P1 的浏览器窗口**中：

1. **打开调试面板**
   - 点击右下角的 "Debug" 按钮（或按 `Ctrl+Shift+D`）

2. **切换到 State 标签页**
   - 点击 "State" 标签

3. **打开输入模式**
   - 点击 "Toggle Input" 按钮

4. **粘贴状态 JSON**
   - 打开 `CARD15-INJECT-STATE.json` 文件
   - 复制整个 JSON 内容
   - 粘贴到调试面板的输入框中

5. **应用状态**
   - 点击 "Apply" 按钮
   - 等待状态更新完成（输入框会自动关闭）

**方法 2：使用控制台（备选）**

在 **P1 的浏览器控制台**（F12）中执行：

```javascript
// 1. 定义状态（复制 CARD15-INJECT-STATE.json 的内容）
const state = {
  core: {
    phase: 'play',
    turnNumber: 2,
    currentPlayerId: '0',
    playerOrder: ['0', '1'],
    players: {
      '0': {
        id: '0',
        name: 'Player 1',
        hand: [
          {
            uid: 'p1_hand_inventor',
            defId: 'deck_i_card_15',
            ownerId: '0',
            baseInfluence: 15,
            faction: 'guild',
            abilityIds: ['ability_i_inventor'],
            difficulty: 3,
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck-i/card-15'
          }
        ],
        deck: [],
        discard: [],
        playedCards: [
          {
            uid: 'p1_played_surgeon',
            defId: 'deck_i_card_03',
            ownerId: '0',
            baseInfluence: 3,
            faction: 'academy',
            abilityIds: ['ability_i_surgeon'],
            difficulty: 1,
            signets: 0,
            ongoingMarkers: [],
            encounterIndex: 1,
            imagePath: 'cardia/cards/deck-i/card-03'
          }
        ],
        hasPlayed: false,
        cardRevealed: false
      },
      '1': {
        id: '1',
        name: 'Player 2',
        hand: [
          {
            uid: 'p2_hand_elf',
            defId: 'deck_i_card_16',
            ownerId: '1',
            baseInfluence: 16,
            faction: 'dynasty',
            abilityIds: ['ability_i_elf'],
            difficulty: 4,
            signets: 0,
            ongoingMarkers: [],
            imagePath: 'cardia/cards/deck-i/card-16'
          }
        ],
        deck: [],
        discard: [],
        playedCards: [
          {
            uid: 'p2_played_puppeteer',
            defId: 'deck_i_card_10',
            ownerId: '1',
            baseInfluence: 10,
            faction: 'swamp',
            abilityIds: ['ability_i_puppeteer'],
            difficulty: 3,
            signets: 1,
            ongoingMarkers: [],
            encounterIndex: 1,
            imagePath: 'cardia/cards/deck-i/card-10'
          }
        ],
        hasPlayed: false,
        cardRevealed: false
      }
    },
    modifierTokens: [],
    ongoingAbilities: [],
    delayedEffects: [],
    encounterHistory: [],
    revealFirstNextEncounter: null,
    mechanicalSpiritActive: null,
    deckVariant: 'deck_i',
    targetSignets: 5
  }
};

// 2. 使用调试面板 API 注入状态
const debugPanel = document.querySelector('[data-testid="debug-panel"]');
if (!debugPanel || !debugPanel.style.display || debugPanel.style.display === 'none') {
  document.querySelector('[data-testid="debug-toggle"]').click();
  await new Promise(r => setTimeout(r, 500));
}
document.querySelector('[data-testid="debug-tab-state"]').click();
await new Promise(r => setTimeout(r, 200));
document.querySelector('[data-testid="debug-state-toggle-input"]').click();
await new Promise(r => setTimeout(r, 200));
const input = document.querySelector('[data-testid="debug-state-input"]');
input.value = JSON.stringify(state.core);
document.querySelector('[data-testid="debug-state-apply"]').click();

console.log('✅ 状态注入完成');
```

### 步骤 2：打出卡牌

1. **P1 打出发明家（影响力 15）**
2. **P2 打出精灵（影响力 16）**
3. 游戏进入能力阶段，P1 失败（15 < 16）

### 步骤 3：激活发明家能力

1. **P1 点击"激活能力"按钮**
2. **第一次交互出现**：选择第一张卡牌

### 步骤 4：调试第一次交互

**在选择卡牌之前**，在 P1 的控制台中执行：

```javascript
// 查看第一次交互前的状态
console.log('=== 第一次交互前 ===');
console.log('inventorPending:', window.__BG_TEST_HARNESS__.state.get().core.inventorPending);
console.log('modifierTokens:', window.__BG_TEST_HARNESS__.state.get().core.modifierTokens);
```

**预期结果**：
- `inventorPending`: `undefined`
- `modifierTokens`: `[]`

**选择一张卡牌并确认**

**立即执行**：

```javascript
// 查看第一次交互后的状态
console.log('=== 第一次交互后 ===');
const state = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', state.core.inventorPending);
console.log('modifierTokens:', state.core.modifierTokens);
console.log('modifierTokens count:', state.core.modifierTokens.length);
if (state.core.modifierTokens.length > 0) {
  console.log('第一个修正标记值:', state.core.modifierTokens[0].value);
}
console.log('interaction queue:', state.sys.interaction);
```

**预期结果**：
- `inventorPending`: `{ playerId: '0', timestamp: ... }`
- `modifierTokens`: 1 个元素
- 第一个修正标记值: `3`
- 第二次交互应该在队列中

### 步骤 5：调试第二次交互

**第二次交互弹窗应该自动出现**

**在选择第二张卡牌之前**，执行：

```javascript
// 查看第二次交互前的状态
console.log('=== 第二次交互前 ===');
const state = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', state.core.inventorPending);
console.log('modifierTokens count:', state.core.modifierTokens.length);
console.log('第一个修正标记值:', state.core.modifierTokens[0]?.value);
```

**预期结果**：
- `inventorPending`: `{ playerId: '0', timestamp: ... }` （应该仍然存在）
- `modifierTokens count`: `1`
- 第一个修正标记值: `3`

**选择第二张卡牌并确认**

**立即执行**：

```javascript
// 查看第二次交互后的状态
console.log('=== 第二次交互后 ===');
const state = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', state.core.inventorPending);
console.log('modifierTokens:', state.core.modifierTokens);
console.log('modifierTokens count:', state.core.modifierTokens.length);

// 详细检查修正标记
const tokens = state.core.modifierTokens;
const inventorTokens = tokens.filter(t => t.source === 'ability_i_inventor');
console.log('发明家修正标记数量:', inventorTokens.length);
console.log('修正标记值:', inventorTokens.map(t => t.value));
```

**预期结果**：
- `inventorPending`: `undefined` （应该被清理）
- `modifierTokens count`: `2`
- 发明家修正标记数量: `2`
- 修正标记值: `[3, -3]` 或 `[-3, 3]`

---

## 关键日志

在控制台中搜索以下日志（Ctrl+F）：

### 1. 交互处理器日志

搜索：`[Inventor] Interaction handler called`

**第一次调用应该显示**：
```javascript
{
  isFirstInteraction: true,
  hasPendingFlag: false,  // 第一次交互时还没有设置
  selectedCardUid: '...'
}
```

**第二次调用应该显示**：
```javascript
{
  isFirstInteraction: false,
  hasPendingFlag: true,   // 第一次交互后已设置
  selectedCardUid: '...'
}
```

### 2. CardiaEventSystem 日志

搜索：`[CardiaEventSystem]`

应该看到：
```
[CardiaEventSystem] Checking for inventor second interaction after all events
[CardiaEventSystem] Creating inventor second interaction
[CardiaEventSystem] Second interaction queued
```

### 3. 修正标记放置日志

搜索：`MODIFIER_TOKEN_PLACED`

应该看到两次：
- 第一次：`value: 3`
- 第二次：`value: -3`

---

## 问题排查

### 问题 1：第二次交互没有出现

**检查**：
```javascript
window.__BG_TEST_HARNESS__.state.get().core.inventorPending
```

- 如果是 `undefined`，说明第一次交互没有设置标记
- 查看控制台日志，确认 `[Inventor] First interaction: placing +3 modifier and setting pending flag`

### 问题 2：两个修正标记都是 +3（当前问题）

**检查**：
```javascript
// 查看第二次交互处理器被调用时的参数
// 在控制台中应该看到：
// [Inventor] Interaction handler called: { isFirstInteraction: ?, hasPendingFlag: ?, ... }
```

**如果 `isFirstInteraction: true`**：
- 说明 `state.core.inventorPending` 为 `undefined`
- 这表明状态没有正确传递给交互处理器
- **这就是当前的问题**

**如果 `isFirstInteraction: false`**：
- 说明判断逻辑正确
- 检查是否正确放置了 -3 修正标记

### 问题 3：两个修正标记都是 -3

**检查**：
```javascript
// 第一次交互时的日志应该显示：
// [Inventor] First interaction: placing +3 modifier and setting pending flag
```

- 如果显示 `Second interaction`，说明判断逻辑有问题

---

## 完整状态检查命令

```javascript
// 一键检查所有关键状态
const state = window.__BG_TEST_HARNESS__.state.get();
console.log('=== 完整状态检查 ===');
console.log('阶段:', state.core.phase);
console.log('当前玩家:', state.core.currentPlayerId);
console.log('inventorPending:', state.core.inventorPending);
console.log('修正标记数量:', state.core.modifierTokens.length);
console.log('发明家修正标记:', state.core.modifierTokens.filter(t => t.source === 'ability_i_inventor'));
console.log('交互队列长度:', state.sys.interaction?.queue?.length || 0);
console.log('当前交互:', state.sys.interaction?.current);
```

---

## 预期的完整流程

1. ✅ 激活发明家能力
2. ✅ 第一次交互弹窗出现
3. ✅ 选择第一张卡牌 → 放置 +3 修正标记
4. ✅ `inventorPending` 被设置
5. ✅ `CardiaEventSystem` 检测到 `inventorPending`
6. ✅ 第二次交互被创建并加入队列
7. ✅ 第二次交互弹窗自动出现
8. ❌ 选择第二张卡牌 → **应该**放置 -3 修正标记（当前放置的是 +3）
9. ❌ `inventorPending` **应该**被清理（当前可能没有被清理）
10. ❌ 最终**应该**有 2 个修正标记：+3 和 -3（当前是 +3 和 +3）

---

## 调试结果记录表

请在测试后记录以下信息：

### 第一次交互
- [ ] 交互前 `inventorPending` 的值：__________
- [ ] 交互前 `modifierTokens` 的数量：__________
- [ ] 交互后 `inventorPending` 的值：__________
- [ ] 交互后 `modifierTokens` 的数量：__________
- [ ] 第一个修正标记的值：__________
- [ ] 控制台日志显示的 `isFirstInteraction`：__________
- [ ] 控制台日志显示的 `hasPendingFlag`：__________

### 第二次交互
- [ ] 第二次交互是否出现：[ ] 是 [ ] 否
- [ ] 交互前 `inventorPending` 的值：__________
- [ ] 交互前 `modifierTokens` 的数量：__________
- [ ] 交互后 `inventorPending` 的值：__________
- [ ] 交互后 `modifierTokens` 的数量：__________
- [ ] 第二个修正标记的值：__________
- [ ] 控制台日志显示的 `isFirstInteraction`：__________
- [ ] 控制台日志显示的 `hasPendingFlag`：__________

### 最终状态
- [ ] `inventorPending` 是否被清理：[ ] 是 [ ] 否
- [ ] 修正标记总数：__________
- [ ] 修正标记值列表：__________

---

## 服务端日志

如果需要查看服务端日志，执行：

```bash
# 查看最新的应用日志
tail -f logs/app-$(date +%Y-%m-%d).log | grep -i inventor

# 或查看所有日志
tail -f logs/app-$(date +%Y-%m-%d).log
```

关键日志标记：
- `[Inventor]` - 交互处理器日志
- `[CardiaEventSystem]` - 事件系统日志
- `MODIFIER_TOKEN_PLACED` - 修正标记放置事件

---

## 下一步行动

根据调试结果，我们需要确认：

1. **第二次交互处理器被调用时**，`state.core.inventorPending` 的值是什么？
   - 如果是 `undefined`，说明状态传递有问题
   - 如果存在，说明判断逻辑有问题

2. **如果状态传递有问题**，我们需要修改方案：
   - 方案 E：第一次交互时**不清理** `inventorPending`，只在第二次交互时清理
   - 或者使用 `interactionId` 判断（检查 ID 中是否包含 `_first_` 或 `_second_`）

请完成手动测试并记录结果，然后我们可以根据实际情况选择最合适的解决方案。
