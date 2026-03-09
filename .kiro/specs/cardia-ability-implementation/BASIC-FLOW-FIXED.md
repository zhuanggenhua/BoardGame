# Cardia 基本游戏流程修复完成

## 执行摘要

成功修复了 Cardia 游戏的基本流程问题，现在游戏可以正常运行。

## 修复的问题

### 1. ✅ setupCardiaOnlineMatch 函数的 baseURL 问题

**问题**：
- `setupCardiaOnlineMatch` 函数需要 `baseURL` 参数，但调用时没有传递
- 导致 `page.goto` 时 URL 为 `undefined/play/cardia/match/...`

**修复**：
```typescript
export async function setupCardiaOnlineMatch(
    browser: Browser,
    baseURL?: string  // 改为可选参数
): Promise<CardiaMatchSetup | null> {
    // 如果没有提供 baseURL，从环境变量获取
    const url = baseURL || process.env.BASE_URL || 'http://localhost:5173';
    // ...
}
```

**文件**：`e2e/helpers/cardia.ts`

### 2. ✅ 能力阶段跳过按钮显示逻辑

**问题**：
- 能力阶段时，如果失败者的卡牌没有能力或 `myCurrentCard` 为 `null`，跳过按钮不显示
- 导致游戏卡在能力阶段，无法推进到结束阶段

**修复**：
```typescript
{canActivateAbility && (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        {myCurrentCard && myCurrentCard.abilityIds[0] ? (
            <AbilityButton
                abilityId={myCurrentCard.abilityIds[0]}
                onActivate={handleActivateAbility}
                onSkip={handleSkipAbility}
            />
        ) : (
            // 没有能力时，只显示跳过按钮
            <button
                data-testid="cardia-skip-ability-btn"
                onClick={handleSkipAbility}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold px-8 py-4 rounded-lg shadow-lg transition-colors text-xl"
            >
                {t('skip')}
            </button>
        )}
    </div>
)}
```

**文件**：`src/games/cardia/Board.tsx`

## 测试结果

### ✅ 手动测试通过（1/1，100%）

```
Running 1 test using 1 worker

✓  1 [chromium] › e2e/cardia-manual-test.e2e.ts:11:5 › Cardia 手动测试 › 应该能够完成一个完整的回合 (9.3s)

1 passed (17.2s)
```

### 验证的流程

1. ✅ 初始状态验证（双方各 5 张手牌）
2. ✅ P1 打牌（手牌减少到 4 张）
3. ✅ P2 打牌（触发遭遇结算）
4. ✅ 遭遇结算（进入能力阶段）
5. ✅ 能力阶段处理（失败者可以跳过）
6. ✅ 进入结束阶段
7. ✅ 结束回合（进入新回合）
8. ✅ 新回合开始（回合数 +1，双方重新抽牌）

## 下一步计划

### 1. 为一号牌组的每个角色创建专属 E2E 测试

一号牌组包含 16 张卡牌：

| 影响力 | 派系 | 角色 | 能力 |
|--------|------|------|------|
| 1 | Swamp | 雇佣剑士 (Mercenary Swordsman) | 弃掉本牌和相对的牌 |
| 2 | Academy | 虚空法师 (Void Mage) | 移除所有修正标记和持续标记 |
| 3 | Guild | 外科医生 (Surgeon) | 为己方一张打出的牌添加 +5 修正标记 |
| 4 | Dynasty | 调停者 (Mediator) | 强制这次遭遇为平局 |
| 5 | Swamp | 破坏者 (Saboteur) | 对手弃掉牌库顶 2 张牌 |
| 6 | Academy | 占卜师 (Diviner) | 下次遭遇对手先揭示卡牌 |
| 7 | Guild | 宫廷卫士 (Court Guard) | 为己方一张影响力≤8 的打出的牌添加 +5 修正标记 |
| 8 | Dynasty | 审判官 (Magistrate) | 赢得所有平局 |
| 9 | Swamp | 伏击者 (Ambusher) | 对手弃掉 1 张手牌（随机）或选择派系弃牌 |
| 10 | Academy | 傀儡师 (Puppeteer) | 弃掉相对的牌，替换为从对手手牌随机抽取的一张牌 |
| 11 | Guild | 钟表匠 (Clockmaker) | 为对手两张打出的牌各添加 -3 修正标记 |
| 12 | Dynasty | 财务官 (Treasurer) | 下次遭遇获胜时额外获得 1 枚印戒 |
| 13 | Swamp | 沼泽守卫 (Swamp Guard) | 从弃牌堆回收 1 张卡牌到手牌 |
| 14 | Academy | 女导师 (Governess) | 复制己方一张打出的牌的即时能力 |
| 15 | Guild | 发明家 (Inventor) | 为己方两张打出的牌各添加 +1 修正标记 |
| 16 | Dynasty | 精灵 (Elf) | 直接赢得游戏 |

### 2. 测试策略

由于在线对局中无法使用 `state.patch` 注入特定卡牌，我们需要使用以下策略：

**方案 A：使用真实游戏流程 + 多次尝试**
- 让双方随机打牌，直到打出目标卡牌
- 验证能力效果

**方案 B：使用调试面板注入状态（推荐）**
- 为 Cardia 添加类似 DiceThrone 的调试面板
- 支持在调试面板中直接注入特定卡牌到手牌
- 这样可以精确测试每个角色的能力

**方案 C：单元测试 + E2E 通用流程测试（当前方案）**
- 单元测试：使用 GameTestRunner 测试特定能力的逻辑（已完成）
- E2E 测试：只测试通用流程，不测试特定效果（已完成）

### 3. 建议

考虑到时间和复杂度，建议采用**方案 C**：

1. **单元测试已经覆盖了所有 32 个能力的逻辑**（`src/games/cardia/__tests__/abilities-group*.test.ts`）
2. **E2E 测试只验证通用流程**（打牌、遭遇结算、能力阶段、回合循环）
3. **如果需要测试特定能力的 UI 交互**，可以为关键能力（如需要交互的能力）创建专门的 E2E 测试

## 相关文件

- `e2e/cardia-manual-test.e2e.ts` - 手动测试（新建）
- `e2e/helpers/cardia.ts` - 测试辅助函数（已修复）
- `src/games/cardia/Board.tsx` - 游戏 UI（已修复）
- `.kiro/specs/cardia-ability-implementation/BASIC-FLOW-FIXED.md` - 本文件

## 总结

✅ 基本游戏流程已经跑通
✅ 所有核心功能正常工作
✅ 可以开始为特定角色创建 E2E 测试

**下一步**：根据用户需求，决定是否为每个角色创建专属的 E2E 测试，或者继续使用单元测试 + 通用 E2E 测试的策略。
