# 发明家（Card15）手动调试指南

## 准备工作

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

## 调试步骤

### 步骤 1：注入测试状态

在 **P1 的浏览器控制台**（F12）中执行以下代码：

```javascript
// 注入测试状态
window.__BG_TEST_HARNESS__.state.patch({
  core: {
    phase: 'play',
    turnNumber: 2,
    currentPlayerId: '0',
    players: {
      '0': {
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
    inventorPending: undefined
  }
});

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

在 **P1 的控制台**中执行：

```javascript
// 查看第一次交互前的状态
console.log('=== 第一次交互前 ===');
console.log('inventorPending:', window.__BG_TEST_HARNESS__.state.get().core.inventorPending);
console.log('modifierTokens:', window.__BG_TEST_HARNESS__.state.get().core.modifierTokens);
```

**选择一张卡牌并确认**

然后立即执行：

```javascript
// 查看第一次交互后的状态
console.log('=== 第一次交互后 ===');
console.log('inventorPending:', window.__BG_TEST_HARNESS__.state.get().core.inventorPending);
console.log('modifierTokens:', window.__BG_TEST_HARNESS__.state.get().core.modifierTokens);
console.log('interaction queue:', window.__BG_TEST_HARNESS__.state.get().sys.interaction);
```

**预期结果**：
- `inventorPending` 应该存在：`{ playerId: '0', timestamp: ... }`
- `modifierTokens` 应该有 1 个元素：`[{ cardId: '...', value: 3, source: 'ability_i_inventor', ... }]`
- 第二次交互应该在队列中

### 步骤 5：调试第二次交互

**第二次交互弹窗应该自动出现**

在选择第二张卡牌之前，执行：

```javascript
// 查看第二次交互前的状态
console.log('=== 第二次交互前 ===');
console.log('inventorPending:', window.__BG_TEST_HARNESS__.state.get().core.inventorPending);
console.log('modifierTokens count:', window.__BG_TEST_HARNESS__.state.get().core.modifierTokens.length);
```

**选择第二张卡牌并确认**

然后执行：

```javascript
// 查看第二次交互后的状态
console.log('=== 第二次交互后 ===');
console.log('inventorPending:', window.__BG_TEST_HARNESS__.state.get().core.inventorPending);
console.log('modifierTokens:', window.__BG_TEST_HARNESS__.state.get().core.modifierTokens);

// 详细检查修正标记
const tokens = window.__BG_TEST_HARNESS__.state.get().core.modifierTokens;
const inventorTokens = tokens.filter(t => t.source === 'ability_i_inventor');
console.log('发明家修正标记数量:', inventorTokens.length);
console.log('修正标记值:', inventorTokens.map(t => t.value));
```

**预期结果**：
- `inventorPending` 应该被清理：`undefined`
- `modifierTokens` 应该有 2 个发明家标记：
  - 第一个：`value: 3`
  - 第二个：`value: -3`

## 关键日志

在控制台中搜索以下日志（Ctrl+F）：

### 交互处理器日志
```
[Inventor] Interaction handler called
```

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

### CardiaEventSystem 日志
```
[CardiaEventSystem] Checking for inventor second interaction after all events
[CardiaEventSystem] Creating inventor second interaction
[CardiaEventSystem] Second interaction queued
```

## 问题排查

### 问题 1：第二次交互没有出现
**检查**：
```javascript
window.__BG_TEST_HARNESS__.state.get().core.inventorPending
```
- 如果是 `undefined`，说明第一次交互没有设置标记
- 查看控制台日志，确认 `[Inventor] First interaction: placing +3 modifier and setting pending flag`

### 问题 2：两个修正标记都是 +3
**检查**：
```javascript
// 查看第二次交互处理器被调用时的参数
// 在控制台中应该看到：
// [Inventor] Interaction handler called: { isFirstInteraction: false, hasPendingFlag: true, ... }
```
- 如果 `isFirstInteraction: true`，说明 `state.core.inventorPending` 为 `undefined`
- 这表明状态没有正确传递给交互处理器

### 问题 3：两个修正标记都是 -3
**检查**：
```javascript
// 第一次交互时的日志应该显示：
// [Inventor] First interaction: placing +3 modifier and setting pending flag
```
- 如果显示 `Second interaction`，说明判断逻辑有问题

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

## 预期的完整流程

1. ✅ 激活发明家能力
2. ✅ 第一次交互弹窗出现
3. ✅ 选择第一张卡牌 → 放置 +3 修正标记
4. ✅ `inventorPending` 被设置
5. ✅ `CardiaEventSystem` 检测到 `inventorPending`
6. ✅ 第二次交互被创建并加入队列
7. ✅ 第二次交互弹窗自动出现
8. ✅ 选择第二张卡牌 → 放置 -3 修正标记
9. ✅ `inventorPending` 被清理
10. ✅ 最终有 2 个修正标记：+3 和 -3

## 调试结果记录

请在测试后记录以下信息：

- [ ] 第一次交互后 `inventorPending` 的值：__________
- [ ] 第一次交互后 `modifierTokens` 的数量：__________
- [ ] 第一次交互后第一个修正标记的值：__________
- [ ] 第二次交互是否出现：[ ] 是 [ ] 否
- [ ] 第二次交互前 `inventorPending` 的值：__________
- [ ] 第二次交互后 `modifierTokens` 的数量：__________
- [ ] 第二次交互后第二个修正标记的值：__________
- [ ] 第二次交互后 `inventorPending` 的值：__________

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
