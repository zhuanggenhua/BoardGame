# SmashUp afterScoring 卡牌点击修复 - 依赖数组缺失

## 问题描述

用户反馈：在 afterScoring 响应窗口期间，无法打出"我们乃最强"（afterScoring 卡），显示"无法打出响应，计分后"错误。

## 根本原因

`Board.tsx` 中 `handleCardClick` 的 `useCallback` 依赖数组缺失关键依赖：
- ❌ 缺失 `isAfterScoringResponse`
- ❌ 缺失 `responseWindow`

**结果**：当 afterScoring 窗口打开时，`handleCardClick` 回调函数没有更新，仍然使用旧的闭包值（`isAfterScoringResponse = false`），导致无法进入响应窗口分支。

## 修复方案

### 修改文件：`src/games/smashup/Board.tsx`

**修改前**（line 1228）：
```typescript
}, [isMyTurn, phase, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed, selectedCardUid, isHandDiscardPrompt, currentPrompt, myPlayer, t, needDiscard, discardCount, isMeFirstResponse]);
```

**修改后**：
```typescript
}, [isMyTurn, phase, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed, selectedCardUid, isHandDiscardPrompt, currentPrompt, myPlayer, t, needDiscard, discardCount, isMeFirstResponse, isAfterScoringResponse, responseWindow]);
```

## 验证方法

1. 用户刷新浏览器（加载新代码）
2. 触发 afterScoring 窗口（基地计分后）
3. 点击手牌中的 afterScoring 卡（如"我们乃最强"）
4. 查看控制台日志：
   - `isAfterScoringResponse` 应该为 `true`
   - `isInResponseWindow` 应该为 `true`
   - `windowType` 应该为 `'afterScoring'`
   - 应该进入响应窗口分支，成功打出卡牌

## 日志完整性

已添加完整日志（line 1049-1067）：
```typescript
console.log('[DEBUG] handleCardClick:', {
    cardUid: card.uid,
    cardDefId: card.defId,
    cardType: card.type,
    isHandDiscardPrompt,
    isMeFirstResponse,
    isAfterScoringResponse,  // ✅ 已添加
    isInResponseWindow: isMeFirstResponse || isAfterScoringResponse,  // ✅ 已添加
    windowType: responseWindow?.windowType,  // ✅ 已添加
    hasCurrentPrompt: !!currentPrompt,
    currentPromptId: currentPrompt?.id,
    promptPlayerId: currentPrompt?.playerId,
    myPlayerId: playerID,
    targetType: (currentInteraction?.data as any)?.targetType,
    hasCurrentInteraction: !!currentInteraction,
    currentInteractionId: currentInteraction?.id,
    optionsCount: currentPrompt?.options.length ?? 0,
});
```

## React Hooks 教训

**核心问题**：`useCallback` 依赖数组不完整导致闭包陈旧。

**规则**：
- ✅ 回调函数中使用的所有 state/props 必须在依赖数组中声明
- ✅ 派生状态（如 `isAfterScoringResponse`）也必须在依赖数组中
- ✅ 对象引用（如 `responseWindow`）也必须在依赖数组中
- ❌ 不能假设"这个值不会变"就省略依赖

**检查方法**：
1. 阅读回调函数体，列出所有使用的变量
2. 检查依赖数组是否包含所有变量
3. 特别注意条件分支中使用的变量

## 相关文件

- `src/games/smashup/Board.tsx` (line 1228)
- `docs/ai-rules/golden-rules.md` (React Hooks 规范)

## 状态

✅ 已修复，等待用户刷新浏览器验证
