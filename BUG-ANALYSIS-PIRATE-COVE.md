# Bug 分析：海盗湾计分问题

## 用户报告
- **游戏**：SmashUp
- **问题**：猫眼石（海盗湾）一直触发，并每次移动都加分
- **时间**：2026/3/1 09:08:25

## 状态快照分析

### 当前状态
```json
{
  "turn": 0,
  "phase": "scoreBases",
  "scoringEligibleBaseIndices": [1],
  "beforeScoringTriggeredBases": [1],
  "players": {
    "0": { "vp": 15, ... },  // 已达15分
    "1": { "vp": 7, ... }
  },
  "bases": [
    { "defId": "base_cave_of_shinies", ... },  // 基地0
    { "defId": "base_pirate_cove", ... },      // 基地1（海盗湾）
    { "defId": "base_wizard_academy", ... }    // 基地2
  ]
}
```

### 关键发现
1. **游戏卡在 scoreBases 阶段**：`phase: "scoreBases"`
2. **海盗湾达到计分条件**：`scoringEligibleBaseIndices: [1]`
3. **beforeScoring 已触发**：`beforeScoringTriggeredBases: [1]`
4. **玩家0已达15分**：应该触发游戏结束，但游戏仍在继续
5. **基地1（海盗湾）的随从**：
   - `robot_hoverbot` (盘旋机器人) - 力量3
   - `robot_zapbot` x2 (高速机器人) - 力量2x2
   - `wizard_chronomage` (时间法师) - 力量3
   - `pirate_king` (海盗王) - 力量5
   - **总力量**：3+2+2+3+5 = 15 < 17（临界点）

### 问题推测

#### 可能性1：海盗湾 afterScoring 交互卡住
- 海盗湾的 `afterScoring` 能力：非冠军玩家可以移动一个随从到其他基地
- 如果交互创建后没有正确处理，可能导致游戏卡住

#### 可能性2：计分流程异常
- `beforeScoring` 已触发，但计分没有继续
- 可能是某个基地能力或 ongoing 效果导致计分流程中断

#### 可能性3：力量计算错误
- 基地1的总力量应该是15，但临界点是17
- 如果力量计算有误（比如 ongoing 效果导致力量波动），可能导致基地反复进入/退出计分状态

## 代码审查

### 海盗湾 afterScoring 能力
```typescript
// src/games/smashup/domain/baseAbilities.ts:968
registerBaseAbility('base_pirate_cove', 'afterScoring', (ctx) => {
    if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
    const winnerId = ctx.rankings[0].playerId;
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    
    // 为每位非冠军玩家创建交互
    for (const [pid, minions] of playerMinions) {
        // ... 创建交互让玩家选择移动随从
    }
});
```

### 交互处理器
```typescript
// src/games/smashup/domain/baseAbilities.ts:1248
registerInteractionHandler('base_pirate_cove', (state, playerId, value, iData, _random, timestamp) => {
    const selected = value as { skip?: boolean; minionUid?: string; ... };
    if (selected.skip) return { state, events: [] };
    
    // 单基地直接移动
    if (baseCandidates.length <= 1) {
        return { state, events: [moveMinion(...)] };
    }
    
    // 多基地→链式选择
    const interaction = createSimpleChoice(...);
    return { state: queueInteraction(state, interaction), events: [] };
});
```

## 复现步骤

1. 创建一个场景：海盗湾达到计分条件
2. 确保有非冠军玩家在海盗湾有随从
3. 触发计分
4. 观察 afterScoring 交互是否正确创建和处理

## 下一步

1. 创建 E2E 测试复现问题
2. 检查计分流程中的交互处理
3. 验证力量计算是否正确
4. 检查游戏结束条件是否正确触发
