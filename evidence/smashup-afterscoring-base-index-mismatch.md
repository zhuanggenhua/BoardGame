# SmashUp afterScoring 基地索引错配问题

## 问题描述

用户反馈："打出计分后响应窗口出来的时候，已经没有目标基地了"

## 问题分析

从用户提供的状态快照：

```json
{
  "bases": [
    {"defId": "base_egg_chamber", "minions": [], "ongoingActions": []},
    {"defId": "base_the_hill", "minions": [], "ongoingActions": []},  // ← 新基地，已经空了
    {"defId": "base_ninja_dojo", "minions": [...], "ongoingActions": []}
  ],
  "afterScoringTriggeredBases": [1]  // ← 记录的是基地索引 1
}
```

从 Action Log：

```
[08:00:00] 基地结算： 灰色猫眼石/海盗湾 管理员1 +3VP 游客6118 +1VP
[08:00:00] 清空灰色猫眼石/海盗湾
[08:00:00] 基地替换： 灰色猫眼石/海盗湾 → 印斯茅斯
[08:00:00] 基地结算： 印斯茅斯
[08:00:00] 清空印斯茅斯
[08:00:00] 基地替换： 印斯茅斯 → 蚁丘
```

**问题根因**：

1. 基地索引 1 原本是"灰色猫眼石/海盗湾"，计分后触发 afterScoring
2. `afterScoringTriggeredBases` 记录了索引 `[1]`
3. 基地被替换为"印斯茅斯"，然后又被替换为"蚁丘"（可能是多基地计分）
4. 现在基地索引 1 指向的是"蚁丘"（新基地），已经是空的了
5. 但是 `afterScoringTriggeredBases: [1]` 仍然记录着索引 1
6. 当玩家打出 afterScoring 卡牌时，系统认为目标基地是索引 1（"蚁丘"），但这个基地是空的，没有随从可以操作

## 根本原因

`afterScoringTriggeredBases` 使用基地索引而不是基地 defId 来标记"已触发 afterScoring"的基地。这在基地替换后会导致索引错配：

- **设计意图**：记录"灰色猫眼石/海盗湾"已触发 afterScoring
- **实际效果**：记录"索引 1"已触发 afterScoring
- **问题**：基地替换后，索引 1 指向的是新基地"蚁丘"，而不是原来的"灰色猫眼石/海盗湾"

## 解决方案

有两种可能的解决方案：

### 方案 1：使用基地 defId 而不是索引

修改 `afterScoringTriggeredBases` 的数据结构，记录基地 defId 而不是索引：

```typescript
// 当前（错误）
afterScoringTriggeredBases: number[]  // [1]

// 修改后（正确）
afterScoringTriggeredBases: string[]  // ['base_grey_opal']
```

**优点**：
- 基地替换后，defId 仍然指向原来的基地
- 逻辑清晰，不会混淆

**缺点**：
- 需要修改多处代码（标记、检查、清理）
- 可能影响其他使用 `afterScoringTriggeredBases` 的地方

### 方案 2：在基地替换时清除 afterScoringTriggeredBases

在 `BASE_REPLACED` 事件的 reducer 中，清除 `afterScoringTriggeredBases` 中对应的基地索引：

```typescript
case SU_EVENT_TYPES.BASE_REPLACED: {
    const { baseIndex } = payload as { baseIndex: number };
    return {
        ...core,
        // 清除该基地的 afterScoring 触发标记（因为基地已经替换了）
        afterScoringTriggeredBases: (core.afterScoringTriggeredBases ?? [])
            .filter(idx => idx !== baseIndex),
    };
}
```

**优点**：
- 修改最小，只需要在一个地方添加代码
- 不影响其他逻辑

**缺点**：
- 逻辑不够直观（为什么基地替换要清除 afterScoring 标记？）
- 可能遗漏其他需要清理的地方

### 方案 3：在响应窗口中记录目标基地 defId

在打开 afterScoring 响应窗口时，将目标基地的 defId 存储到响应窗口的 `sourceId` 字段中：

```typescript
const afterScoringWindowEvt = openAfterScoringWindow(
    'scoreBases',
    pid,
    afterScoringCore.turnOrder,
    now,
    base.defId  // ← 传递基地 defId
);
```

然后在 afterScoring 卡牌的执行逻辑中，使用 `sourceId` 来查找目标基地：

```typescript
// 当前（错误）：使用 afterScoringTriggeredBases 中的索引
const targetBaseIndex = state.afterScoringTriggeredBases[0];

// 修改后（正确）：使用响应窗口的 sourceId 查找基地
const targetBaseDefId = responseWindow.sourceId;
const targetBaseIndex = state.bases.findIndex(b => b.defId === targetBaseDefId);
```

**优点**：
- 不需要修改 `afterScoringTriggeredBases` 的数据结构
- 逻辑清晰，响应窗口明确记录了目标基地
- 基地替换后，仍然可以通过 defId 找到原来的基地（如果还在场上）

**缺点**：
- 需要修改 afterScoring 卡牌的执行逻辑
- 如果基地已经被替换，`findIndex` 会返回 -1，需要处理这种情况

## 推荐方案

**方案 3** 是最合理的解决方案，因为：

1. **语义正确**：响应窗口的 `sourceId` 本来就是用来记录"触发源"的，这里的触发源就是计分的基地
2. **不破坏现有逻辑**：`afterScoringTriggeredBases` 仍然用于防止重复触发，不需要修改
3. **处理基地替换**：如果基地已经被替换，可以给出明确的反馈（"目标基地已不存在"）

## 实现步骤

1. 修改 `openAfterScoringWindow` 函数，接受 `baseDefId` 参数并存储到 `sourceId`
2. 修改 afterScoring 卡牌的执行逻辑，使用 `responseWindow.sourceId` 查找目标基地
3. 处理基地已被替换的情况（返回错误或生成 ABILITY_FEEDBACK 事件）
4. 添加测试验证修复

## 相关文件

- `src/games/smashup/domain/index.ts` - `scoreOneBase` 函数，打开 afterScoring 响应窗口
- `src/games/smashup/domain/responseWindow.ts` - `openAfterScoringWindow` 函数
- `src/games/smashup/abilities/innsmouth.ts` - "重返深海"等 afterScoring 卡牌
- `src/games/smashup/abilities/giant_ants.ts` - "我们乃最强"等 afterScoring 卡牌

## 总结

这是一个**数据引用错配**问题：使用基地索引而不是基地 defId 来标记目标基地，导致基地替换后索引指向了错误的基地。

推荐使用**方案 3**：在响应窗口中记录目标基地 defId，afterScoring 卡牌通过 defId 查找目标基地，处理基地已被替换的情况。
