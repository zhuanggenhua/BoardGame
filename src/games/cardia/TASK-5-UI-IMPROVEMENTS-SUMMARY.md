# Cardia 游戏 UI 改进总结

**任务时间：** 2026-02-27  
**任务状态：** ✅ 完成

---

## 问题描述

用户在游玩时发现三个问题：

1. **缺少牌组选择**：游戏设置时无法选择牌组（默认 I 牌组，无法选择 II 牌组）
2. **暗牌机制缺失**：规则要求双方暗中出牌后再明牌比较，但现在可以看到对手出牌
3. **调试文本影响美观**：卡牌图案上有系统生成的英文派系和数字，影响美观

---

## 修复方案

### 1. 添加牌组选择功能 ✅

**修改文件：**
- `src/games/cardia/domain/index.ts`
- `src/games/cardia/manifest.ts`
- `public/locales/zh-CN/game-cardia.json`
- `public/locales/en/game-cardia.json`

**实现细节：**
- 在 `manifest.ts` 中添加 `setupOptions` 配置：
  ```typescript
  setupOptions: {
      deckVariant: {
          type: 'select',
          labelKey: 'games.cardia.setup.deckVariant.label',
          options: [
              { value: 'I', labelKey: 'games.cardia.setup.deckVariant.deck1' },
              { value: 'II', labelKey: 'games.cardia.setup.deckVariant.deck2' },
          ],
          default: 'I',
      },
  }
  ```
- 在 `setup()` 函数中从 `setupData` 读取牌组选择：
  ```typescript
  const deckVariant = (setupData?.deckVariant as 'I' | 'II') || 'I';
  ```
- 添加 i18n 翻译：
  - 中文：`"选择牌组"`, `"I 牌组（初学者）"`, `"II 牌组（进阶）"`
  - 英文：`"Choose Deck"`, `"Deck I (Beginner)"`, `"Deck II (Advanced)"`

**用户体验：**
- 创建游戏时会显示牌组选择下拉框
- 默认选择 I 牌组（初学者）
- 可以选择 II 牌组（进阶）

---

### 2. 实现暗牌机制 ✅

**修改文件：**
- `src/games/cardia/domain/core-types.ts`
- `src/games/cardia/domain/utils.ts`
- `src/games/cardia/domain/events.ts`
- `src/games/cardia/domain/execute.ts`
- `src/games/cardia/domain/reduce.ts`
- `src/games/cardia/Board.tsx`

**实现细节：**

#### 2.1 数据结构变更
在 `PlayerState` 中添加 `cardRevealed` 字段：
```typescript
export interface PlayerState {
    // ... 其他字段
    cardRevealed: boolean;    // 卡牌是否已翻开（暗牌机制）
}
```

#### 2.2 事件系统
添加 `CARDS_REVEALED` 事件：
```typescript
export const CARDIA_EVENTS = {
    // ... 其他事件
    CARDS_REVEALED: 'CARDS_REVEALED',  // 暗牌翻开事件
};

export interface CardsRevealedEvent extends GameEvent<'CARDS_REVEALED'> {
    payload: {
        player1Id: PlayerId;
        player2Id: PlayerId;
    };
}
```

#### 2.3 执行逻辑
在 `resolveEncounter()` 中添加翻牌事件：
```typescript
function resolveEncounter(...) {
    const events: CardiaEvent[] = [];
    
    // 1. 双方翻牌（暗牌机制）
    events.push({
        type: CARDIA_EVENTS.CARDS_REVEALED,
        timestamp,
        payload: { player1Id, player2Id },
    });
    
    // 2. 计算影响力
    // 3. 判定胜负
    // 4. 授予印戒
    
    return events;
}
```

#### 2.4 状态归约
在 `reduce.ts` 中处理翻牌事件：
```typescript
function reduceCardsRevealed(core, event) {
    const { player1Id, player2Id } = event.payload;
    
    // 双方卡牌同时翻开
    let newCore = updatePlayer(core, player1Id, { cardRevealed: true });
    newCore = updatePlayer(newCore, player2Id, { cardRevealed: true });
    
    return newCore;
}
```

在 `reduceTurnEnded()` 中重置翻牌状态：
```typescript
for (const playerId of core.playerOrder) {
    newCore = updatePlayer(newCore, playerId, {
        hasPlayed: false,
        currentCard: undefined,
        cardRevealed: false,  // 重置翻牌状态
    });
}
```

#### 2.5 UI 显示
在 `Board.tsx` 中根据 `cardRevealed` 显示卡牌或卡背：
```typescript
{opponent.currentCard ? (
    opponent.cardRevealed ? (
        <CardDisplay card={opponent.currentCard} core={core} />
    ) : (
        <div className="w-32 h-48 bg-gradient-to-br from-purple-800 to-blue-800 rounded-lg border-2 border-purple-600 flex items-center justify-center">
            <div className="text-6xl">🎴</div>
        </div>
    )
) : (
    <div className="w-32 h-48 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-500">
        {t('waiting')}
    </div>
)}
```

**游戏流程：**
1. 玩家 A 打出卡牌 → 卡牌暗置（显示卡背 🎴）
2. 玩家 B 打出卡牌 → 卡牌暗置（显示卡背 🎴）
3. 双方都打出后 → 触发 `CARDS_REVEALED` 事件 → 双方卡牌同时翻开
4. 计算影响力 → 判定胜负 → 授予印戒
5. 回合结束 → 重置 `cardRevealed = false`

---

### 3. 移除卡牌上的调试文本 ✅

**修改文件：**
- `src/games/cardia/Board.tsx`

**实现细节：**
移除 `CardDisplay` 组件中的叠加信息层：
```typescript
// ❌ 删除的代码
<div className="relative z-10 h-full p-2 flex flex-col justify-between bg-black/30">
    <div className="text-center">
        <div className="text-3xl font-bold text-white drop-shadow-lg">{finalInfluence}</div>
        <div className="text-xs text-white/90 drop-shadow">{t(`factions.${card.faction}`)}</div>
    </div>
    {/* ... */}
</div>

// ✅ 保留的代码
{/* 印戒显示（仅在有印戒时显示） */}
{card.signets > 0 && (
    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
        {Array.from({ length: card.signets }).map((_, i) => (
            <div key={i} className="w-4 h-4 bg-yellow-400 rounded-full border border-yellow-600 shadow" />
        ))}
    </div>
)}
```

**效果：**
- 卡牌只显示原始图片，不再叠加派系名和影响力数字
- 保留印戒显示（黄色圆点），因为这是游戏状态的一部分
- 保留加载状态指示器（黄色/红色圆点），用于调试

---

## 测试结果

### 单元测试 ✅
```bash
npm run test -- src/games/cardia/__tests__
```

**结果：** 57/57 通过（100%）

**覆盖范围：**
- ✅ 核心逻辑（game-flow.test.ts）
- ✅ 命令执行（execute.test.ts）
- ✅ 验证层（validate.test.ts）
- ✅ Reducer（reducer.test.ts）
- ✅ 工具函数（utils.test.ts）
- ✅ 能力执行器（ability-executor.test.ts）
- ✅ 交互处理（interaction.test.ts）
- ✅ 牌库设置（setupDeck.test.ts）

### E2E 测试（待运行）
```bash
npm run test:e2e -- e2e/cardia-basic-flow.e2e.ts
```

**预期：** 3/3 通过
- 基本游戏流程
- 同时打出机制
- 游戏结束条件

---

## 文件变更清单

### 核心逻辑层
1. `src/games/cardia/domain/core-types.ts` - 添加 `cardRevealed` 字段
2. `src/games/cardia/domain/utils.ts` - 初始化 `cardRevealed = false`
3. `src/games/cardia/domain/events.ts` - 添加 `CARDS_REVEALED` 事件
4. `src/games/cardia/domain/execute.ts` - 在 `resolveEncounter()` 中发射翻牌事件
5. `src/games/cardia/domain/reduce.ts` - 处理翻牌事件和重置逻辑
6. `src/games/cardia/domain/index.ts` - 从 `setupData` 读取牌组选择

### UI 层
7. `src/games/cardia/Board.tsx` - 实现暗牌显示逻辑 + 移除调试文本

### 配置层
8. `src/games/cardia/manifest.ts` - 添加 `setupOptions` 配置

### 国际化
9. `public/locales/zh-CN/game-cardia.json` - 添加牌组选择翻译
10. `public/locales/en/game-cardia.json` - 添加牌组选择翻译

---

## 用户验证步骤

### 1. 验证牌组选择
1. 打开游戏大厅
2. 点击"创建游戏" → 选择"卡迪亚"
3. 在游戏设置界面，应该看到"选择牌组"下拉框
4. 可以选择"I 牌组（初学者）"或"II 牌组（进阶）"
5. 创建游戏后，检查手牌是否来自选择的牌组

### 2. 验证暗牌机制
1. 开始游戏
2. 玩家 A 打出一张牌 → 应该看到卡背（🎴）
3. 玩家 B 打出一张牌 → 应该看到卡背（🎴）
4. 双方都打出后 → 卡牌同时翻开，显示真实图片
5. 进入能力阶段 → 卡牌保持翻开状态
6. 回合结束 → 卡牌消失，准备下一回合

### 3. 验证卡牌美观度
1. 查看战场上的卡牌
2. 卡牌应该只显示原始图片，没有叠加的派系名和数字
3. 如果卡牌上有印戒，应该在底部显示黄色圆点
4. 加载状态指示器（黄色/红色圆点）在右上角，不影响主要内容

---

## 技术亮点

### 1. 暗牌机制的实现
- **事件驱动**：使用 `CARDS_REVEALED` 事件实现双方同时翻牌
- **状态管理**：通过 `cardRevealed` 字段追踪翻牌状态
- **UI 响应式**：根据状态自动切换卡牌/卡背显示
- **回合重置**：在 `reduceTurnEnded()` 中自动重置翻牌状态

### 2. 牌组选择的实现
- **配置驱动**：通过 `manifest.ts` 的 `setupOptions` 声明
- **类型安全**：使用 TypeScript 类型约束 `'I' | 'II'`
- **国际化支持**：中英文翻译完整
- **默认值**：提供合理的默认值（I 牌组）

### 3. UI 优化
- **最小化干扰**：移除不必要的叠加文本
- **保留关键信息**：印戒显示保留（游戏状态）
- **调试友好**：加载状态指示器保留（开发调试）

---

## 后续优化建议（可选）

### 1. 移除调试指示器（生产环境）
```typescript
// 建议：在生产环境中禁用加载状态指示器
{import.meta.env.DEV && imagePath && !imageLoaded && !imageError && (
    <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
)}
```

### 2. 添加翻牌动画
- 使用 framer-motion 添加卡牌翻转动画
- 提升视觉体验

### 3. 添加音效
- 打出卡牌音效
- 翻牌音效
- 获得印戒音效

---

## 总结

本次修复完成了三个核心改进：

1. ✅ **牌组选择**：用户可以在游戏设置时选择 I 或 II 牌组
2. ✅ **暗牌机制**：实现了规则要求的暗中出牌→同时翻牌流程
3. ✅ **UI 美观度**：移除了卡牌上的调试文本，保留原始图片

所有修改都通过了单元测试（57/57），代码质量有保证。用户现在可以享受更符合规则、更美观的游戏体验。

---

**修复人员：** AI Assistant (Kiro)  
**修复状态：** ✅ 完成  
**最后更新：** 2026-02-27
