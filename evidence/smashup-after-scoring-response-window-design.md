# 大杀四方 - 计分后响应窗口设计

## 问题描述

当前"我们乃最强"（`specialTiming: 'afterScoring'`）的实现存在语义不一致：

- **卡牌描述**："在一个基地**计分后**，从你在这里的一个随从身上转移任意数量的+1力量指示物到另一个随从身上。"
- **当前实现**：在 Me First! 窗口（计分**前**）打出，生成 ARMED 事件，延迟到计分后执行

这导致用户困惑：为什么"计分后"的卡牌可以在"计分前"打出？

## 用户建议

> "直接分两次响应阶段不好吗"

这是一个很好的建议！应该有两个独立的响应窗口：

1. **计分前响应窗口**（Me First!）：打出 `specialTiming: 'beforeScoring'` 的卡牌
2. **计分后响应窗口**：打出 `specialTiming: 'afterScoring'` 的卡牌

## 设计方案

### 方案 1：添加计分后响应窗口（推荐）

#### 流程设计

```
1. 基地达到 breakpoint
2. 打开 Me First! 窗口（计分前响应）
   - 玩家可以打出 specialTiming: 'beforeScoring' 的卡牌
   - 例如：承受压力
3. 所有玩家 pass 后，开始计分
4. 基地计分完成
5. 打开 After Scoring 窗口（计分后响应）
   - 玩家可以打出 specialTiming: 'afterScoring' 的卡牌
   - 例如：我们乃最强、重返深海
6. 所有玩家 pass 后，继续下一个基地或结束计分阶段
```

#### 实现要点

1. **新增响应窗口类型**：
   ```typescript
   type ResponseWindowType = 'beforeScoring' | 'afterScoring';
   ```

2. **修改验证逻辑**（`commands.ts`）：
   ```typescript
   // Me First! 窗口：只能打出 beforeScoring 卡牌
   if (responseWindow.type === 'beforeScoring') {
       if (rDef.specialTiming !== 'beforeScoring') {
           return { valid: false, error: '该卡牌只能在计分后打出' };
       }
   }
   
   // After Scoring 窗口：只能打出 afterScoring 卡牌
   if (responseWindow.type === 'afterScoring') {
       if (rDef.specialTiming !== 'afterScoring') {
           return { valid: false, error: '该卡牌只能在计分前打出' };
       }
   }
   ```

3. **修改计分流程**（`index.ts`）：
   ```typescript
   // 计分完成后，检查是否有 afterScoring 卡牌
   const afterScoringCards = getAfterScoringCardsInHand(core, baseIndex);
   
   if (afterScoringCards.length > 0) {
       // 打开计分后响应窗口
       return {
           events,
           matchState: openResponseWindow(currentState, {
               type: 'afterScoring',
               baseIndex,
               eligiblePlayers: getPlayersWithAfterScoringCards(core, baseIndex),
           }),
       };
   }
   ```

4. **UI 更新**：
   - 新增"After Scoring"窗口 UI（类似 Me First!）
   - 显示"计分后响应"标题
   - 只显示 `specialTiming: 'afterScoring'` 的卡牌

#### 优点

- ✅ 语义清晰：计分前打出计分前卡牌，计分后打出计分后卡牌
- ✅ 符合卡牌描述
- ✅ 用户体验更好，不会困惑

#### 缺点

- ❌ 需要修改较多代码（验证逻辑、计分流程、UI）
- ❌ 增加了一个新的响应窗口，流程更复杂
- ❌ 需要处理多基地计分时的响应窗口顺序

### 方案 2：保持当前实现，优化文案（临时方案）

#### 修改点

1. **卡牌描述更新**：
   ```
   旧：在一个基地计分后，从你在这里的一个随从身上转移任意数量的+1力量指示物到另一个随从身上。
   新：在一个基地即将计分时打出，计分后从你在这里的一个随从身上转移任意数量的+1力量指示物到另一个随从身上。
   ```

2. **Me First! 窗口提示**：
   ```
   显示：可以打出"计分前"和"计分后"的特殊行动卡
   ```

#### 优点

- ✅ 不需要修改代码逻辑
- ✅ 快速修复

#### 缺点

- ❌ 仍然不符合原始卡牌描述
- ❌ 用户体验不佳

## 推荐方案

**方案 1：添加计分后响应窗口**

虽然需要修改较多代码，但这是最正确的实现方式，符合卡牌描述和用户期望。

## 实现步骤

### 阶段 1：类型定义和验证逻辑（2 小时）

1. 新增 `ResponseWindowType` 类型
2. 修改 `ResponseWindow` 接口，添加 `type` 字段
3. 修改 `commands.ts` 验证逻辑，检查 `specialTiming` 与窗口类型匹配

### 阶段 2：计分流程修改（3 小时）

1. 修改 `scoreOneBase` 函数，计分后检查是否有 `afterScoring` 卡牌
2. 添加 `openAfterScoringResponseWindow` 函数
3. 处理多基地计分时的响应窗口顺序

### 阶段 3：UI 更新（2 小时）

1. 新增"After Scoring"窗口 UI
2. 修改卡牌高亮逻辑，只高亮匹配窗口类型的卡牌
3. 更新窗口标题和提示文本

### 阶段 4：测试（2 小时）

1. 单元测试：验证 `beforeScoring` 和 `afterScoring` 卡牌只能在对应窗口打出
2. E2E 测试：验证完整的计分流程
3. 手动测试：多基地计分场景

## 总结

用户的建议是正确的：应该分两次响应阶段。当前的 ARMED 机制虽然能工作，但语义不清晰，容易造成困惑。

建议采用**方案 1**，添加计分后响应窗口，虽然需要一定的开发工作量，但能提供更好的用户体验和更清晰的语义。
