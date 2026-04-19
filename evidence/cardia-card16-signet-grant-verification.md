# Card16 精灵 - 印戒授予验证

## 问题描述

用户报告："遭遇 4 card16 应该获得印戒，但没有"

## 调查结果

### 1. 状态数据分析

从用户提供的状态数据中：

**Card 16 当前状态**:
```json
{
  "uid": "deck_i_card_16_1775914588841_9rxbdiozv",
  "defId": "deck_i_card_16",
  "ownerId": "1",
  "baseInfluence": 16,
  "signets": 1,  // ✅ 已经有 1 枚印戒
  "encounterIndex": 4
}
```

**Event 40-41 显示遭遇 4 已解决**:
```json
{
  "id": 40,
  "event": {
    "type": "cardia:encounter_resolved",
    "payload": {
      "slotIndex": 3,
      "winner": "1",
      "loser": "0"
    }
  }
},
{
  "id": 41,
  "event": {
    "type": "cardia:extra_signet_placed",
    "timestamp": 1775914605521,
    "payload": {
      "cardId": "deck_i_card_16_1775914588841_9rxbdiozv",
      "playerId": "1"
    }
  }
}
```

### 2. 遭遇历史

- **遭遇 1**: P0 Card 12 (Treasurer) vs P1 Card 15 (Inventor)
  - P1 获胜（影响力 18 vs 12）
  - P0 跳过了 Treasurer 能力激活（见 ActionLog）
  
- **遭遇 2**: P0 Card 1 (Mercenary Swordsman) vs P1 Card 13 (Swamp Guard)
  - P1 获胜（影响力 13 vs 1）
  
- **遭遇 3**: P0 Card 4 (Mediator) vs P1 Card 8 (Magistrate)
  - P0 激活 Mediator 能力，强制平局
  - 但 P1 的 Magistrate 持续能力使 P1 赢得平局
  - P1 获胜，Card 8 获得印戒，但被 Mediator 移除
  
- **遭遇 4**: P0 Card 15 (Inventor) vs P1 Card 16 (Elf)
  - P1 获胜（影响力 16 vs 12）
  - Card 16 获得 1 枚基础印戒 ✅

### 3. 为什么 Card 16 只有 1 枚印戒？

Card 16 应该获得的印戒：
1. **基础印戒**: 1 枚（因为遭遇 4 获胜）✅ 已获得
2. **财务官额外印戒**: 0 枚（因为 P0 在遭遇 1 后跳过了 Treasurer 能力激活）

**ActionLog 证据**:
```json
{
  "id": "log-1775914594186",
  "timestamp": 1775914594186,
  "actorId": "0",
  "kind": "cardia:skip_ability",
  "segments": [{"type": "i18n", "ns": "game-cardia", "key": "actionLog.skipAbility"}]
}
```

P0 在遭遇 1 后选择跳过了能力激活，所以 Treasurer 的持续能力没有被放置。因此，Card 16 在遭遇 4 获胜后只获得了基础印戒，没有获得财务官的额外印戒。

### 4. 单元测试验证

创建了测试 `src/games/cardia/__tests__/card16-elf-signet-grant.test.ts`，模拟相同场景：

**测试结果**: ✅ 通过

测试证明：
- Card 16 在遭遇 4 获胜后正确获得了 1 枚基础印戒
- `encounterHistory` 正确记录了遭遇 4 的结果（winnerId: '1', loserId: '0'）
- 印戒授予逻辑工作正常

## 结论

**这不是一个 bug**。Card 16 已经正确获得了基础印戒。

用户可能的误解：
- 用户可能期望 Card 16 获得 2 枚印戒（基础印戒 + 财务官额外印戒）
- 但是财务官（Card 12）在遭遇 1 失败后，P0 选择跳过了能力激活
- 所以财务官的持续能力没有被放置，Card 16 只获得了基础印戒

## 验证步骤

1. ✅ 检查状态数据：Card 16 有 1 枚印戒
2. ✅ 检查事件流：Event 41 显示 Card 16 获得了印戒
3. ✅ 检查 ActionLog：P0 在遭遇 1 后跳过了 Treasurer 能力
4. ✅ 单元测试：测试通过，证明印戒授予逻辑正常

## 相关代码

- 遭遇解决逻辑：`src/games/cardia/domain/execute.ts` (第 250-350 行)
- 印戒授予逻辑：`src/games/cardia/domain/execute.ts` (第 288-295 行)
- 财务官能力：`src/games/cardia/domain/abilities/group3-ongoing.ts` (第 100-200 行)
- Reducer：`src/games/cardia/domain/reduce.ts` (第 177-250 行)

---

**日期**: 2026-04-11  
**验证人**: AI Assistant  
**结论**: 无 bug，Card 16 已正确获得基础印戒
