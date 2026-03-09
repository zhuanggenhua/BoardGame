# Card10 (傀儡师) 印戒继承问题调试清单

## 问题现象

用户报告：傀儡师能力可以发动，但是替换卡牌后印戒没有改变。

## 调试步骤

### 1. 检查浏览器控制台日志

打开浏览器控制台（F12），激活傀儡师能力后，查找以下日志：

#### 预期日志输出：

```
[Puppeteer] 能力执行器被调用
[Puppeteer] 准备替换卡牌: { oldCard: { uid: "...", defId: "deck_i_card_12" }, newCard: { uid: "...", defId: "..." }, encounterIndex: 0 }
[reduceCardReplaced] 开始处理卡牌替换事件: { oldCardId: "...", newCardId: "...", playerId: "1", encounterIndex: 0, suppressAbility: true }
[reduceCardReplaced] 找到卡牌: { oldCard: { uid: "...", defId: "deck_i_card_12", signets: 1 }, newCard: { uid: "...", defId: "..." } }
[reduceCardReplaced] 替换完成: { handSize: 1, discardSize: 1, playedCardsCount: 1, newCardSignets: 1 }
```

#### 关键检查点：

**A. 如果没有看到 `[Puppeteer]` 日志**：
- 问题：能力执行器没有被调用
- 可能原因：能力 ID 不匹配或注册表问题
- 解决方案：检查 `abilityRegistry` 和 `abilityExecutorRegistry`

**B. 如果看到 `[Puppeteer]` 但没有 `[reduceCardReplaced]` 日志**：
- 问题：`CARD_REPLACED` 事件没有被 reduce
- 可能原因：
  1. 事件没有被发射
  2. 事件类型不匹配
  3. Reducer switch-case 中缺少该事件
- 解决方案：检查 `reduce.ts` 中的 switch-case

**C. 如果看到 `[reduceCardReplaced]` 但 `oldCard.signets` 为 0**：
- 问题：旧卡牌本身就没有印戒
- 可能原因：
  1. 遭遇解析时印戒没有被正确放置
  2. 印戒被其他逻辑清除了
- 解决方案：检查遭遇解析逻辑和印戒放置逻辑

**D. 如果看到 `newCardSignets: 1` 但 UI 显示为 0**：
- 问题：状态更新了但 UI 没有刷新
- 可能原因：
  1. React 状态没有触发重新渲染
  2. UI 组件读取了错误的数据源
- 解决方案：检查 UI 组件的数据绑定

### 2. 检查游戏状态

在调试面板中查看状态（State 标签），确认：

#### 替换前（ability 阶段）：

```json
{
  "players": {
    "1": {
      "playedCards": [
        {
          "uid": "...",
          "defId": "deck_i_card_12",
          "signets": 1,  // ← 应该是 1
          "encounterIndex": 0
        }
      ],
      "hand": [
        { "uid": "...", "defId": "deck_i_card_05" },
        { "uid": "...", "defId": "deck_i_card_07" }
      ]
    }
  }
}
```

#### 替换后（play 阶段）：

```json
{
  "players": {
    "1": {
      "playedCards": [
        {
          "uid": "...",
          "defId": "deck_i_card_05",  // ← 新卡牌（学者或宫廷卫士）
          "signets": 1,  // ← 应该继承印戒
          "encounterIndex": 0
        }
      ],
      "hand": [
        { "uid": "...", "defId": "deck_i_card_07" }  // ← 手牌减少 1 张
      ],
      "discard": [
        {
          "uid": "...",
          "defId": "deck_i_card_12",  // ← 旧卡牌（财务官）
          "signets": 0  // ← 印戒已清零
        }
      ]
    }
  }
}
```

### 3. 常见问题排查

#### 问题 1：旧卡牌没有印戒

**症状**：`oldCard.signets` 为 0

**排查步骤**：
1. 检查遭遇解析时是否正确放置印戒
2. 查看 `EXTRA_SIGNET_PLACED` 事件是否被发射
3. 查看 `reduceExtraSignetPlaced` 是否被调用

**可能原因**：
- 遭遇解析逻辑有 bug
- 印戒放置事件没有被 reduce
- 印戒被其他逻辑清除（如回合结束清理）

#### 问题 2：新卡牌没有继承印戒

**症状**：`newCardSignets` 为 0 但 `oldCard.signets` 为 1

**排查步骤**：
1. 确认 `reduceCardReplaced` 第 768 行代码：`signets: oldCard.signets`
2. 检查 `replacedCard` 对象是否正确构建
3. 检查 `updatePlayer` 是否正确更新状态

**可能原因**：
- 代码逻辑错误（但从代码看是正确的）
- TypeScript 类型不匹配导致字段丢失
- 状态更新被覆盖

#### 问题 3：UI 没有更新

**症状**：状态正确但 UI 显示错误

**排查步骤**：
1. 刷新页面看是否更新
2. 检查 UI 组件是否订阅了正确的状态
3. 检查是否有缓存问题

**可能原因**：
- React 状态没有触发重新渲染
- UI 组件读取了旧的状态快照
- 浏览器缓存问题

### 4. 验证修复

修复后，再次运行测试，确认：

1. ✅ 浏览器控制台显示完整的日志链
2. ✅ `oldCard.signets` 为 1
3. ✅ `newCardSignets` 为 1
4. ✅ UI 显示新卡牌有 1 枚印戒
5. ✅ 弃牌堆中的旧卡牌印戒为 0

## 下一步

请按照上述步骤检查，并提供以下信息：

1. **浏览器控制台的完整日志**（从激活能力到替换完成）
2. **替换前的游戏状态**（调试面板 State 标签）
3. **替换后的游戏状态**（调试面板 State 标签）
4. **UI 显示的印戒数量**（新卡牌和旧卡牌）

有了这些信息，我们就能准确定位问题所在。
