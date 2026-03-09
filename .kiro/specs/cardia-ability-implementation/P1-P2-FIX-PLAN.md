# P1 和 P2 问题修复计划

## P1 问题（高优先级）

### 1. 特殊胜利条件测试不完整

**文件**：`src/games/cardia/__tests__/integration-victory-conditions.test.ts`

**当前问题**：
- 机械精灵测试：只验证持续标记存在，未测试条件胜利触发
- 精灵测试：只验证能力 ID 存在，未测试直接胜利触发

**修复方案**：

#### 机械精灵测试
```typescript
it('应该在机械精灵持续标记存在且玩家遭遇获胜时触发游戏胜利', () => {
  // 1. 构造场景：p1 有机械精灵持续标记
  // 2. 构造遭遇：p1 的卡牌影响力更高
  // 3. 执行遭遇结算命令
  // 4. reduce 所有事件
  // 5. 验证游戏结束，p1 获胜
});
```

**实现细节**：
- 机械精灵的条件胜利在 `execute.ts` 的遭遇结算逻辑中检查
- 检查代码位置：`src/games/cardia/domain/execute.ts` 第 223-228 行
- 需要构造一个完整的遭遇场景并执行 `RESOLVE_ENCOUNTER` 命令

#### 精灵测试
```typescript
it('应该在精灵能力发动时直接触发游戏胜利', () => {
  // 1. 构造场景：p1 有精灵卡牌，p1 失败
  // 2. 执行精灵能力
  // 3. reduce 所有事件
  // 4. 验证游戏结束，p1 获胜
});
```

**实现细节**：
- 精灵能力执行器在 `src/games/cardia/domain/abilities/group6-special.ts` 第 118 行
- 精灵能力会产生 `GAME_WON` 事件
- 需要验证 `isGameOver` 返回 p1 获胜

**预计时间**：30 分钟

---

### 2. 多能力触发时序测试缺失

**文件**：`src/games/cardia/__tests__/integration-ability-trigger.test.ts`

**当前问题**：
- 文件注释说明"测试多个能力连续触发"，但实际没有这类测试
- 无法验证多个能力的触发顺序

**修复方案**：

```typescript
describe('多能力触发时序', () => {
  it('应该按正确顺序触发同一玩家的多个能力', () => {
    // 1. 构造场景：p1 有两张卡牌，都有能力，p1 失败
    // 2. 执行第一个能力
    // 3. 验证第一个能力的效果
    // 4. 执行第二个能力
    // 5. 验证第二个能力的效果
    // 6. 验证两个能力的效果都生效且互不干扰
  });
});
```

**实现细节**：
- 当前游戏设计中，能力是玩家手动触发的，不是自动连续触发
- 测试应该验证：玩家可以依次触发多个能力，且效果正确叠加
- 可以使用破坏者（弃对手牌库）+ 革命者（抽己方牌库）测试

**预计时间**：20 分钟

---

## P2 问题（长期改进）

### 1. 手动模拟 vs 实际测试

**影响文件**：
- `src/games/cardia/__tests__/integration-influence-modifiers.test.ts`
- `src/games/cardia/__tests__/integration-ongoing-abilities.test.ts`

**当前问题**：
- 部分测试手动模拟遭遇结算逻辑（手动计算影响力、手动判定获胜方）
- 手动模拟可能与实际实现不一致

**修复方案**：

#### integration-influence-modifiers.test.ts
```typescript
// 当前（手动模拟）
const p1Influence = calculateInfluence(p1Card, modifiers);
const p2Influence = calculateInfluence(p2Card, modifiers);
const winnerId = p1Influence > p2Influence ? 'p1' : 'p2';

// 修复后（使用实际命令）
const command: CardiaCommand = {
  type: CARDIA_COMMANDS.RESOLVE_ENCOUNTER,
  playerId: 'p1',
  payload: {}
};
const events = CardiaDomain.execute(state, command, { random: () => 0.5 });
let newCore = state.core;
for (const event of events) {
  newCore = CardiaDomain.reduce(newCore, event);
}
// 验证遭遇结果
expect(newCore.currentEncounter?.winnerId).toBe('p1');
```

#### integration-ongoing-abilities.test.ts
```typescript
// 类似的修复方案
// 使用 RESOLVE_ENCOUNTER 命令替代手动模拟
```

**预计时间**：1 小时

---

### 2. 能力复制测试依赖交互系统

**影响文件**：`src/games/cardia/__tests__/integration-ability-copy.test.ts`

**当前问题**：
- 复制能力需要选择目标卡牌
- 当前测试无法完整验证交互流程

**修复方案**：

**方案 A：等待交互系统实现**（推荐）
- 等待 InteractionSystem 完全实现后补充完整测试
- 测试完整的能力复制 → 交互选择 → 递归执行流程

**方案 B：使用 mock 交互**（临时方案）
- 在测试中 mock 交互响应
- 验证能力复制的核心逻辑

**预计时间**：等待交互系统实现

---

## 修复优先级

1. **立即修复**（今天完成）：
   - P1.1：特殊胜利条件测试（30 分钟）
   - P1.2：多能力触发时序测试（20 分钟）

2. **短期修复**（本周完成）：
   - P2.1：替换手动模拟为实际流程测试（1 小时）

3. **长期改进**（等待依赖）：
   - P2.2：补充交互系统集成测试（等待交互系统实现）

---

## 预期成果

修复完成后，集成测试质量评分预计从 65.6/100 提升到 85/100：

| 维度 | 修复前 | 修复后 | 改进 |
|------|--------|--------|------|
| D1 语义保真 | 65% | 85% | +20% |
| D3 数据流闭环 | 75% | 90% | +15% |
| D8 时序正确 | 55% | 75% | +20% |
| D12 写入-消耗对称 | 40% | 70% | +30% |
| D18 否定路径 | 75% | 80% | +5% |
| D19 组合场景 | 60% | 80% | +20% |

**总体评分**：65.6/100 → 85/100 (+19.4)
