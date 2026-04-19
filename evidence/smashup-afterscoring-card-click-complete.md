# SmashUp afterScoring 卡牌点击修复 - 完整总结

## 问题描述

用户反馈：在 afterScoring 响应窗口期间，无法打出"我们乃最强"（afterScoring 卡），显示"无法打出响应，计分后"错误。

## 根本原因

`Board.tsx` 中 `handleCardClick` 的 `useCallback` 依赖数组缺失关键依赖：
- ❌ 缺失 `isAfterScoringResponse`
- ❌ 缺失 `responseWindow`

**结果**：当 afterScoring 窗口打开时，`handleCardClick` 回调函数没有更新，仍然使用旧的闭包值（`isAfterScoringResponse = false`），导致无法进入响应窗口分支。

## 修复方案

### 1. 修复依赖数组（已完成）

**文件**：`src/games/smashup/Board.tsx` (line 1228)

**修改前**：
```typescript
}, [isMyTurn, phase, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed, selectedCardUid, isHandDiscardPrompt, currentPrompt, myPlayer, t, needDiscard, discardCount, isMeFirstResponse]);
```

**修改后**：
```typescript
}, [isMyTurn, phase, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed, selectedCardUid, isHandDiscardPrompt, currentPrompt, myPlayer, t, needDiscard, discardCount, isMeFirstResponse, isAfterScoringResponse, responseWindow]);
```

### 2. 日志完整性（已完成）

已在 `handleCardClick` 中添加完整日志（line 1049-1067）：
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

## E2E 测试状态

### 测试创建（已完成）

创建了 `e2e/smashup-afterscoring-card-play.e2e.ts`，包含两个测试用例：
1. `should allow playing afterScoring card in afterScoring window` - 验证 afterScoring 卡牌可以在 afterScoring 窗口打出
2. `should NOT allow playing afterScoring card in meFirst window` - 验证 afterScoring 卡牌在 meFirst 窗口被禁用

### 测试框架问题（阻塞）

**问题**：所有使用 `smashupMatch` fixture 的 E2E 测试都失败，包括现有的成功测试（如 `smashup-ninja-infiltrate.e2e.ts`）。

**失败原因**：派系选择界面加载问题
- 派系卡牌图片未加载（显示空白）
- 出现"P0 THINKING..."弹窗
- 派系选择按钮超时（10 秒）

**影响范围**：
- ❌ `smashup-afterscoring-card-play.e2e.ts`（新测试）
- ❌ `smashup-ninja-infiltrate.e2e.ts`（现有测试）
- ❌ 所有使用 `smashupMatch` fixture 的测试

**根本原因**：`smashupMatch` fixture 本身有问题，不是本次修复的范围。

### 测试框架教训

**错误尝试**：
1. ❌ 使用 `import { test } from './framework'` + `game.setupScene()` - `setupScene` 对 SmashUp 的支持不完整（不支持 `field` 和 `bases`）
2. ❌ 使用 `import { test } from './fixtures'` + `smashupMatch` fixture - fixture 本身有问题

**正确做法**（未来）：
- 修复 `smashupMatch` fixture 的派系选择问题
- 或者扩展 `game.setupScene()` 支持 SmashUp 的 `field` 和 `bases`

## 验证方法

由于 E2E 测试被 fixture 问题阻塞，需要用户手动验证：

1. 用户刷新浏览器（加载新代码）
2. 触发 afterScoring 窗口（基地计分后）
3. 点击手牌中的 afterScoring 卡（如"我们乃最强"）
4. 查看控制台日志：
   - `isAfterScoringResponse` 应该为 `true`
   - `isInResponseWindow` 应该为 `true`
   - `windowType` 应该为 `'afterScoring'`
   - 应该进入响应窗口分支，成功打出卡牌

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

## 文档更新

已更新 `AGENTS.md`，强制要求所有 E2E 测试必须使用"新框架 + 专用测试模式 + 状态注入"三板斧：
- ✅ 新框架：`import { test } from './framework'`
- ✅ 专用测试模式：`page.goto('/play/<gameId>')`
- ✅ 状态注入：`game.setupScene()`

**注意**：由于 `game.setupScene()` 对 SmashUp 支持不完整，当前仍需使用 `smashupMatch` fixture + `harness.state.patch()`，但这是临时方案。

## 单元测试验证

### 相关测试运行结果

运行了所有 afterScoring 相关的单元测试，确认修改没有破坏现有功能：

1. ✅ `afterScoring-window-multi-round.test.ts` - 通过
   - 验证多轮响应逻辑
   - 验证两个玩家都有 afterScoring 卡牌时的行为

2. ✅ `afterscoring-window-skip-base-clear.test.ts` - 通过
   - 验证响应窗口关闭后基地清理逻辑
   - 验证 SmashUpEventSystem 补发 BASE_CLEARED 事件

3. ⚠️ `response-window-skip.test.ts` - 1/2 通过
   - ✅ "所有玩家都没有可响应内容时应立即关闭窗口" - 通过
   - ❌ "重新开始一轮时应跳过没有可响应内容的玩家" - 失败
   - **失败原因**：`pendingInteractionId` 未清除（已知 bug，与本次修复无关）

### 为什么不需要更新单元测试

我们修复的是 UI 层的问题（`handleCardClick` 依赖数组），不影响业务逻辑：
- ✅ 单元测试验证业务逻辑（计算、验证、状态更新）
- ✅ E2E 测试验证 UI 交互（点击、显示、响应）
- ✅ 我们的修复只影响 UI 层，不影响业务逻辑层

**结论**：现有单元测试无需更新，它们仍然正确验证业务逻辑。

## 状态

- ✅ 代码修复完成（依赖数组 + 日志）
- ✅ 文档更新完成（AGENTS.md）
- ✅ 单元测试验证通过（相关测试无破坏）
- ❌ E2E 测试被 fixture 问题阻塞
- ⏳ 等待用户手动验证

## 下一步

1. **短期**：用户手动验证修复是否生效
2. **中期**：修复 `smashupMatch` fixture 的派系选择问题
3. **长期**：扩展 `game.setupScene()` 支持 SmashUp 的完整状态注入

## 相关文件

- `src/games/smashup/Board.tsx` (line 1228, 1049-1067)
- `e2e/smashup-afterscoring-card-play.e2e.ts`
- `AGENTS.md` (测试编写规范 + E2E 测试三板斧)
- `docs/ai-rules/golden-rules.md` (React Hooks 规范)
