# Card02 虚空法师 - 手动调试指南

## 测试场景

**目标**：测试虚空法师（影响力2）的能力：从任一张牌上弃掉所有修正标记和持续标记

**场景设置**：
- **第一回合**：
  - P1 打出 Card03（外科医生，影响力3）
  - P2 打出 Card08（审判官，影响力8）
  - P2 获胜，审判官放置持续标记 `ability_i_judge`
- **假设之前有发明家能力**：
  - P1 的外科医生获得 +5 修正标记（来源：发明家）
  - P2 的审判官获得 -3 修正标记（来源：发明家）
- **第二回合**：
  - P1 打出影响力2（虚空法师）
  - P2 打出影响力6（占卜师）
  - P1 失败（2 < 6），激活虚空法师能力
  - P1 可以选择移除：
    - **选项1**：P1 的外科医生上的 +5 修正标记
    - **选项2**：P2 的审判官上的 -3 修正标记和持续标记
  - 验证：选中的卡牌上的所有标记被移除

**测试价值**：
- ✅ 测试虚空法师能力同时检测修正标记和持续标记
- ✅ 测试玩家可以选择移除己方或对手的标记
- ✅ 测试一次性移除多个标记（审判官有修正标记+持续标记）

## 手动调试步骤

### 1. 启动游戏服务器

```bash
npm run dev
```

### 2. 创建在线对局

1. 打开浏览器：`http://localhost:5173`
2. 点击"Cardia"游戏
3. 点击"创建房间"
4. 复制房间链接

### 3. 打开两个玩家窗口

1. **P1 窗口**：在第一个浏览器窗口中打开房间链接
2. **P2 窗口**：在第二个浏览器窗口（或隐私模式）中打开房间链接

### 4. 注入测试状态

在 **P1 窗口** 中：

1. 按 `Ctrl+Shift+D`（或 `Cmd+Shift+D`）打开调试面板
2. 切换到 "State" 标签
3. 点击 "Toggle Input" 按钮
4. 复制 `CARD02-INJECT-STATE.json` 的内容
5. 粘贴到输入框中
6. 点击 "Apply" 按钮

在 **P2 窗口** 中：

1. 重复上述步骤（注入相同的状态）

### 5. 验证初始状态

在 **P1 窗口** 的调试面板中，检查：

```json
{
  "players": {
    "0": {
      "hand": [
        { "defId": "deck_i_card_02", "baseInfluence": 2 }  // 虚空法师
      ],
      "playedCards": [
        {
          "defId": "deck_i_card_03",  // 外科医生
          "baseInfluence": 3,
          "uid": "p1_played_surgeon"
        }
      ]
    },
    "1": {
      "hand": [
        { "defId": "deck_i_card_06", "baseInfluence": 6 }  // 占卜师
      ],
      "playedCards": [
        {
          "defId": "deck_i_card_08",  // 审判官
          "baseInfluence": 8,
          "ongoingMarkers": ["ability_i_judge"],  // ← 持续标记
          "uid": "p2_played_judge"
        }
      ]
    }
  },
  "ongoingAbilities": [
    {
      "abilityId": "ability_i_judge",
      "cardId": "p2_played_judge",  // ← 对应 P2 的审判官
      "playerId": "1"
    }
  ],
  "modifierTokens": [
    {
      "cardId": "p1_played_surgeon",  // ← P1 的外科医生有 +5 修正
      "value": 5,
      "source": "ability_i_inventor"
    },
    {
      "cardId": "p2_played_judge",  // ← P2 的审判官有 -3 修正
      "value": -3,
      "source": "ability_i_inventor"
    }
  ]
}
```

**关键检查点**：
- ✅ P1 的 `playedCards` 中有外科医生（Card03）
- ✅ P2 的 `playedCards` 中有审判官（Card08）
- ✅ 审判官的 `ongoingMarkers` 包含 `ability_i_judge`
- ✅ `core.ongoingAbilities` 包含审判官的持续能力
- ✅ `core.modifierTokens` 包含两个修正标记（外科医生 +5，审判官 -3）

### 6. 执行测试流程

#### 步骤 1：打出卡牌

1. **P1 窗口**：点击手牌中的虚空法师（影响力2）
2. **P2 窗口**：点击手牌中的占卜师（影响力6）

#### 步骤 2：等待能力阶段

- 游戏应该自动进入 "Ability" 阶段
- P1 应该看到 "Activate Ability" 按钮（因为 P1 失败了）

#### 步骤 3：激活虚空法师能力

1. **P1 窗口**：点击 "Activate Ability" 按钮
2. **预期**：应该弹出卡牌选择弹窗，显示所有有标记的卡牌：
   - **P1 的外科医生**（有 +5 修正标记）
   - **P2 的审判官**（有 -3 修正标记 + 持续标记）

#### 步骤 4：选择目标卡牌

**测试选项 A：移除 P2 审判官的所有标记**

1. **P1 窗口**：在弹窗中点击 P2 的审判官（Card08）
2. **P1 窗口**：点击 "Confirm" 按钮
3. **预期**：弹窗关闭，能力执行

**测试选项 B：移除 P1 外科医生的修正标记**

1. **P1 窗口**：在弹窗中点击 P1 的外科医生（Card03）
2. **P1 窗口**：点击 "Confirm" 按钮
3. **预期**：弹窗关闭，能力执行

#### 步骤 5：验证结果

**如果选择了 P2 的审判官**：

在 **P1 窗口** 的调试面板中，检查：

```json
{
  "players": {
    "1": {
      "playedCards": [
        {
          "defId": "deck_i_card_08",
          "ongoingMarkers": []  // ← 应该为空
        }
      ]
    }
  },
  "ongoingAbilities": [],  // ← 应该为空
  "modifierTokens": [
    {
      "cardId": "p1_played_surgeon",  // ← P1 的外科医生的修正标记保留
      "value": 5
    }
    // P2 审判官的 -3 修正标记应该被移除
  ]
}
```

**如果选择了 P1 的外科医生**：

在 **P1 窗口** 的调试面板中，检查：

```json
{
  "players": {
    "1": {
      "playedCards": [
        {
          "defId": "deck_i_card_08",
          "ongoingMarkers": ["ability_i_judge"]  // ← 保留
        }
      ]
    }
  },
  "ongoingAbilities": [
    {
      "abilityId": "ability_i_judge",
      "cardId": "p2_played_judge"  // ← 保留
    }
  ],
  "modifierTokens": [
    {
      "cardId": "p2_played_judge",  // ← P2 审判官的修正标记保留
      "value": -3
    }
    // P1 外科医生的 +5 修正标记应该被移除
  ]
}
```

**预期结果**：
- ✅ 选中卡牌的所有标记被移除
- ✅ 未选中卡牌的标记保留
- ✅ 游戏进入下一回合（phase: "play"）

## 调试检查点

### 如果弹窗没有出现

**检查 1：虚空法师能力是否正确检测到标记**

在浏览器控制台中查看日志：
```
[VoidMage] Found cards with markers: ["p1_played_surgeon", "p2_played_judge"]
```

如果没有这条日志，说明能力没有检测到标记。检查：
- `core.ongoingAbilities` 是否包含审判官的持续能力
- `core.modifierTokens` 是否包含两个修正标记

**检查 2：交互是否正确创建**

在浏览器控制台中查看日志：
```
[CardiaEventSystem] Creating interaction: card_selection
```

如果没有这条日志，说明交互没有创建。检查：
- 虚空法师的能力执行器是否正确注册
- `CardiaEventSystem` 是否正确处理交互

**检查 3：交互是否正确传递到 UI**

在 React DevTools 中检查 `Board` 组件的 state：
```javascript
{
  currentInteraction: {
    type: 'card_selection',
    availableCards: ['p1_played_surgeon', 'p2_played_judge'],  // ← 两张卡牌
    // ...
  }
}
```

如果 `currentInteraction` 为 `null`，说明交互没有传递到 UI。

### 如果弹窗出现但标记没有移除

**检查 1：交互处理器是否正确执行**

在浏览器控制台中查看日志：
```
[VoidMage] Removing markers from card: p2_played_judge
```

**检查 2：事件是否正确发射**

在浏览器控制台中查看日志：
```
[Cardia] Event emitted: ONGOING_ABILITY_REMOVED
[Cardia] Event emitted: MODIFIER_TOKEN_REMOVED
```

**检查 3：Reducer 是否正确处理事件**

在调试面板中检查状态变化：
- 如果选择了审判官：
  - `ongoingAbilities` 应该从 1 个变为 0 个
  - `modifierTokens` 应该从 2 个变为 1 个（只剩外科医生的）
  - `playedCards[0].ongoingMarkers` 应该从 1 个变为 0 个
- 如果选择了外科医生：
  - `ongoingAbilities` 应该保持 1 个
  - `modifierTokens` 应该从 2 个变为 1 个（只剩审判官的）

## 常见问题

### Q1: 为什么需要同时设置 `card.ongoingMarkers` 和 `core.ongoingAbilities`？

A: 这是两个不同的数据结构：
- `card.ongoingMarkers`：卡牌实例上的标记数组（用于 UI 显示）
- `core.ongoingAbilities`：全局的持续能力列表（用于规则判定）

虚空法师的能力检查的是 `core.ongoingAbilities`，所以必须同时设置两者。

### Q2: 为什么 E2E 测试中弹窗没有出现？

A: 可能的原因：
1. `core.ongoingAbilities` 没有正确生成（已修复）
2. 虚空法师的能力逻辑有 bug
3. `CardiaEventSystem` 没有正确处理交互
4. UI 没有正确渲染交互弹窗

### Q3: 如何验证 `core.ongoingAbilities` 是否正确？

A: 在调试面板中检查：
```json
{
  "ongoingAbilities": [
    {
      "abilityId": "ability_i_judge",
      "cardId": "p2_played_judge",  // ← 必须与 playedCards 中的 uid 一致
      "playerId": "1"
    }
  ]
}
```

## 相关文件

- 测试文件：`e2e/cardia-deck1-card02-void-mage.e2e.ts`
- 能力定义：`src/games/cardia/domain/abilities/group4-card-ops.ts`
- 交互处理器：`src/games/cardia/domain/abilities/group4-card-ops.ts` (registerCardOpsInteractionHandlers)
- 事件系统：`src/games/cardia/domain/systems.ts` (CardiaEventSystem)
- UI 组件：`src/games/cardia/ui/CardSelectionModal.tsx`

## 下一步

如果手动调试成功，说明问题在 E2E 测试的状态注入或时序上。
如果手动调试失败，说明问题在游戏逻辑本身，需要修复能力代码。
