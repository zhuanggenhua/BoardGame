# 傀儡师印戒授予修复

## Bug 描述

**问题**：傀儡师（card10）能力发动后，如果胜负反转，新获胜者没有得到印戒。

**场景**：
1. P1 出 card10（傀儡师，影响力 10 - 5 = 5）
2. P0 出 card11（钟表匠，影响力 11）
3. P0 赢，遭遇结算时 card11 获得 1 个印戒
4. P1 的 card10 输了，触发傀儡师能力
5. 傀儡师替换 P0 的 card11 为 P0 手牌中的 card03（影响力 3）
6. 胜负反转：P1 的 card10（影响力 5）> P0 的 card03（影响力 3）
7. **Bug**：P1 的 card10 没有获得印戒

## 根本原因

`reduceCardReplaced` 函数中的印戒转移逻辑有缺陷：

```typescript
// 旧代码
const updatedCard = {
    ...card,
    signets: card.signets + oldCard.signets,  // ❌ 如果 oldCard.signets === 0，不会授予印戒
};
```

**问题分析**：
1. 遭遇结算时，获胜者的卡牌会获得 1 个印戒（`EXTRA_SIGNET_PLACED` 事件）
2. 傀儡师能力在能力阶段执行，此时旧获胜者的卡牌已经有印戒
3. 但是，`reduceCardReplaced` 在替换卡牌时，会将旧卡牌移到弃牌堆，并**清零印戒**（`signets: 0`）
4. 因此，`oldCard.signets` 在印戒转移逻辑中**始终为 0**（因为已经被清零了）
5. 结果：新获胜者不会获得印戒

**实际情况**：
- 旧卡牌在移到弃牌堆前，`signets` 字段会被读取
- 但在某些情况下（如第一次遭遇），旧卡牌可能还没有印戒（`signets === 0`）
- 此时即使胜负反转，新获胜者也不会获得印戒

## 修复方案

修改印戒转移逻辑，当胜负反转时：
1. 如果旧卡牌有印戒（`oldCard.signets > 0`），转移所有印戒到新获胜者
2. 如果旧卡牌没有印戒（`oldCard.signets === 0`），给新获胜者授予 1 个新印戒

```typescript
// 新代码
// 如果旧卡牌有印戒，转移；否则授予 1 个新印戒
const signetsToAdd = oldCard.signets > 0 ? oldCard.signets : 1;
const updatedCard = {
    ...card,
    signets: card.signets + signetsToAdd,
};
```

**修复逻辑**：
- 胜负反转意味着"原本应该授予旧获胜者的印戒，现在应该授予新获胜者"
- 无论旧卡牌是否有印戒，新获胜者都应该至少获得 1 个印戒
- 如果旧卡牌有多个印戒（如之前遭遇累积的），应该全部转移

## 测试验证

### 测试 1：胜负反转时授予印戒

**场景**：
- 初始：P0 的 card11（影响力 11，印戒 1）vs P1 的 card10（影响力 5，印戒 0）
- P0 赢
- 傀儡师替换 card11 为 card03（影响力 3）
- 胜负反转：P1 的 card10（影响力 5）> P0 的 card03（影响力 3）

**预期**：
- P1 的 card10 获得 1 个印戒
- P0 的 card03 没有印戒

**结果**：✅ 通过

```
[reduceCardReplaced] 印戒处理完成: {
  toCardId: 'p1_card10',
  toPlayerId: '1',
  signetsAdded: 1,
  newSignets: 1,
  wasTransfer: true
}
```

### 测试 2：多个印戒全部转移

**场景**：
- 初始：P0 的 card11（影响力 11，印戒 2）vs P1 的 card10（影响力 5，印戒 0）
- P0 赢
- 傀儡师替换 card11 为 card03（影响力 3）
- 胜负反转：P1 的 card10（影响力 5）> P0 的 card03（影响力 3）

**预期**：
- P1 的 card10 获得 2 个印戒（全部转移）

**结果**：✅ 通过

```
[reduceCardReplaced] 印戒处理完成: {
  toCardId: 'p1_card10',
  toPlayerId: '1',
  signetsAdded: 2,
  newSignets: 2,
  wasTransfer: true
}
```

## 影响范围

**修改文件**：
- `src/games/cardia/domain/reduce.ts` - `reduceCardReplaced` 函数

**影响能力**：
- 傀儡师（card10）：弃掉相对的牌，替换为从对手手牌随机抽取的一张

**影响场景**：
- 只影响傀儡师能力导致胜负反转的场景
- 不影响其他能力或正常遭遇结算

## 测试文件

- `src/games/cardia/__tests__/puppeteer-signet-grant-fix.test.ts`

## 总结

修复了傀儡师能力发动后，胜负反转时新获胜者没有获得印戒的 bug。现在：
1. 如果旧获胜者的卡牌有印戒，会全部转移到新获胜者
2. 如果旧获胜者的卡牌没有印戒，会给新获胜者授予 1 个新印戒
3. 确保胜负反转时，印戒分配符合游戏规则
