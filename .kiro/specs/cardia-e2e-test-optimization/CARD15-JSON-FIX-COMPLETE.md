# Card15 发明家 - JSON 修复完成

## 修复时间
2025-01-XX

## 问题描述
用户尝试注入状态时遇到错误：
```
TypeError: core.playerOrder is not iterable
```

错误发生在 `src/games/cardia/domain/index.ts:103` 的 `isGameOver` 函数中。

## 根本原因

### 1. JSON 结构错误
- **CARD15-FULL-STATE.json**：包含了完整的 `{ sys, core }` 结构，但 `applyCoreStateDirect` 只接受 `core` 对象
- **CARD15-INJECT-STATE.json**：包含了 `{ core: {...} }` 包装，但应该直接是 core 对象

### 2. 字段格式错误
- **modifiers**：某些卡牌缺少 `modifiers` 字段，或格式不正确
  - ❌ 错误：`"modifiers": []`（数组）
  - ✅ 正确：`"modifiers": { "entries": [], "nextOrder": 0 }`（ModifierStack 对象）

- **tags**：某些卡牌缺少 `tags` 字段，或格式不正确
  - ❌ 错误：`"tags": {}`（空对象）
  - ✅ 正确：`"tags": { "tags": {} }`（TagContainer 对象）

- **ongoingMarkers**：某些卡牌缺少此字段
  - ✅ 必须包含：`"ongoingMarkers": []`

### 3. 必需字段缺失
- **currentCard**：PlayerState 必须包含 `currentCard: null`
- **encounterHistory**：某些卡牌实例缺少 `ongoingMarkers` 字段

## 修复内容

### CARD15-FULL-STATE.json
1. **移除 sys 包装**：直接导出 core 对象
2. **修复所有 modifiers 字段**：改为 `{ entries: [], nextOrder: 0 }` 格式
3. **修复所有 tags 字段**：改为 `{ tags: {} }` 格式
4. **添加 ongoingMarkers**：所有卡牌实例都添加 `ongoingMarkers: []`
5. **添加 currentCard**：两个玩家都添加 `currentCard: null`
6. **保留完整历史**：包含 `encounterHistory` 和 `previousEncounter`

### CARD15-INJECT-STATE.json
1. **移除 core 包装**：直接导出 core 对象（不是 `{ core: {...} }`）
2. **修复所有 modifiers 字段**：改为 `{ entries: [], nextOrder: 0 }` 格式
3. **修复所有 tags 字段**：改为 `{ tags: {} }` 格式
4. **添加 ongoingMarkers**：所有卡牌实例都添加 `ongoingMarkers: []`
5. **添加 currentCard**：两个玩家都添加 `currentCard: null`
6. **简化历史**：`encounterHistory: []`（不包含历史遭遇）

## 验证步骤

### 1. 使用调试面板 UI（推荐）
```
1. 打开游戏页面
2. 点击右上角调试按钮（🐛）
3. 切换到 "State" 标签
4. 点击 "Edit" 按钮
5. 复制 CARD15-INJECT-STATE.json 的内容
6. 粘贴到输入框
7. 点击 "Apply" 按钮
```

### 2. 使用控制台 API（备选）
```javascript
// 读取 JSON 文件内容
const coreState = { /* 粘贴 CARD15-INJECT-STATE.json 的内容 */ };

// 注入状态
await window.__BG_DEBUG_PANEL__.applyCoreStateDirect(coreState);
```

## 预期结果
- ✅ 状态注入成功，不再报错 "playerOrder is not iterable"
- ✅ P1 手牌显示发明家（15）
- ✅ P2 手牌显示精灵（16）
- ✅ P1 场上有外科医生（3，0 印戒）
- ✅ P2 场上有傀儡师（10，1 印戒）
- ✅ 当前阶段为 "Play Card"
- ✅ 当前玩家为 P1

## 关键学习点

### applyCoreStateDirect 的正确用法
```typescript
// ❌ 错误：传递完整的 { sys, core } 结构
await applyCoreStateDirect(page, { sys: {...}, core: {...} });

// ❌ 错误：传递 { core: {...} } 包装
await applyCoreStateDirect(page, { core: {...} });

// ✅ 正确：直接传递 core 对象
await applyCoreStateDirect(page, { players: {...}, playerOrder: [...], ... });
```

### 必需的字段格式
```typescript
// CardInstance / PlayedCard 必需字段
{
  uid: string,
  defId: string,
  ownerId: string,
  baseInfluence: number,
  faction: string,
  abilityIds: string[],
  difficulty: number,
  modifiers: { entries: [], nextOrder: 0 },  // ModifierStack
  tags: { tags: {} },                        // TagContainer
  signets: number,
  ongoingMarkers: string[],
  imagePath: string,
  encounterIndex?: number  // PlayedCard 特有
}

// PlayerState 必需字段
{
  id: string,
  name: string,
  hand: CardInstance[],
  deck: CardInstance[],
  discard: CardInstance[],
  playedCards: PlayedCard[],
  signets: number,
  tags: { tags: {} },
  hasPlayed: boolean,
  cardRevealed: boolean,
  currentCard: CardInstance | null  // 必须包含
}

// CardiaCore 必需字段
{
  players: Record<string, PlayerState>,
  playerOrder: [string, string],
  currentPlayerId: string,
  turnNumber: number,
  phase: string,
  encounterHistory: EncounterState[],
  deckVariant: string,
  targetSignets: number,
  ongoingAbilities: OngoingAbility[],
  modifierTokens: ModifierToken[],
  delayedEffects: DelayedEffect[],
  revealFirstNextEncounter: string | null,
  mechanicalSpiritActive: object | null,
  previousEncounter?: EncounterState  // 可选
}
```

## 下一步
1. 使用修复后的 JSON 进行手动调试
2. 验证发明家能力的两次交互
3. 确认第二次交互是否正确放置 -3 修正标记
4. 根据调试结果决定是否需要实施方案 E

## 相关文档
- `CARD15-DEBUG-GUIDE.md` - 完整调试指南
- `CARD15-QUICK-DEBUG.md` - 速查卡
- `CARD15-READY-TO-TEST.md` - 准备就绪指南
- `CARD15-CURRENT-STATUS.md` - 当前状态总结
- `e2e/helpers/cardia.ts` - `applyCoreStateDirect` 实现
- `src/games/cardia/domain/core-types.ts` - 类型定义
