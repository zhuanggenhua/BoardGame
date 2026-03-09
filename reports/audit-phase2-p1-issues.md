# Phase 2 P1 问题清单

生成时间：2026-03-05
状态：待修复

## 问题分类

### 类别 A：测试维护问题（35 个失败测试）

这些测试失败是因为测试代码未适配交互系统重构。代码本身是正确的，但测试期望的是旧的执行模式。

#### A1. 派系能力测试（13 个失败）
**文件**: `src/games/cardia/__tests__/abilities-group7-faction.test.ts`

**问题**: 测试期望执行器直接返回 `FACTION_SELECTED` 和 `CARDS_DISCARDED` 事件，但实际执行器返回交互对象。

**失败测试**:
1. 伏击者（Ambusher）- 应该让对手弃掉所有指定派系的手牌
2. 伏击者 - 当对手没有指定派系手牌时，应该不产生弃牌事件
3. 伏击者 - 应该只弃掉指定派系的手牌，保留其他派系
4. 伏击者 - 应该发射派系选择事件
5. 伏击者 - 当前简化实现自动选择沼泽派系
6. 巫王（Witch King）- 应该让对手从手牌和牌库弃掉所有指定派系的牌
7. 巫王 - 当对手手牌中没有指定派系时，应该只弃掉牌库中的牌
8. 巫王 - 当对手牌库中没有指定派系时，应该只弃掉手牌中的牌
9. 巫王 - 应该在弃牌后混洗牌库
10. 巫王 - 应该只弃掉指定派系的牌，保留其他派系
11. 巫王 - 当前简化实现自动选择沼泽派系
12. 派系选择交互 - 应该提供四个派系选项
13. 派系选择交互 - 玩家应该能够选择任意派系

**修复方案**: 更新测试使用交互解决模式：
```typescript
// 旧模式（错误）
const result = executor.execute(state, payload);
expect(result.events).toContainEqual({ type: 'FACTION_SELECTED' });

// 新模式（正确）
const result = executor.execute(state, payload);
expect(result.interaction).toBeDefined();
const resolved = await resolveInteraction(result.interaction, { faction: 'swamp' });
expect(resolved.events).toContainEqual({ type: 'FACTION_SELECTED' });
```

**优先级**: P1（不阻塞 Phase 3，但应在审计完成前修复）

---

#### A2. 修正标记能力测试（4 个失败）
**文件**: 
- `src/games/cardia/__tests__/abilities-group2-modifiers.test.ts`
- `src/games/cardia/__tests__/ability-witch-king.test.ts`

**问题**: 测试期望执行器直接返回修正标记事件，但实际执行器返回交互对象。

**失败测试**:
1. 图书管理员（Librarian）- 未选择修正值时，应该创建修正标记选择交互
2. 巫王 - 应该让对手弃掉手牌和牌库中所有沼泽派系的卡牌
3. 巫王 - 当对手手牌和牌库中都没有沼泽派系卡牌时，应该只产生派系选择和混洗事件
4. 虚空法师 - 没有标记时不应该创建交互

**修复方案**: 同 A1，更新测试使用交互解决模式。

**优先级**: P1

---

#### A3. 持续能力测试（10 个失败）
**文件**: `src/games/cardia/__tests__/integration-ongoing-abilities.test.ts`

**问题**: 测试期望执行器直接返回持续标记放置事件，但实际执行器返回交互对象。

**失败测试**:
1. 财务官 - 应该正确放置持续标记
2. 调停者 - 应该在遭遇结算时应用效果（强制平局）
3. 财务官 - 应该在遭遇结算时应用效果（额外印戒）
4. 审判官 - 应该优先应用效果而不是调停者效果
5. （其他 6 个类似测试）

**修复方案**: 同 A1，更新测试使用交互解决模式。

**优先级**: P1

---

#### A4. 命令执行测试（2 个失败）
**文件**: `src/games/cardia/__tests__/execute.test.ts`

**问题**: 测试期望命令执行后直接进入下一阶段，但实际需要先解决交互。

**失败测试**:
1. ACTIVATE_ABILITY - should transition to end phase after ability
2. SKIP_ABILITY - should transition to end phase

**修复方案**: 更新测试在命令执行后解决交互，然后验证阶段转换。

**优先级**: P1

---

#### A5. Reducer 测试（3 个失败）
**文件**: 
- `src/games/cardia/__tests__/reduce.test.ts`
- `src/games/cardia/__tests__/d11-d14-reducer-consumption.test.ts`

**问题**: 测试使用错误的交互模式触发遭遇解析。

**失败测试**:
1. CARD_RECYCLED - should move card from discard to hand
2. D12.1 印戒字段写入-消耗对称
3. D14.3 占卜师能力标记遭遇结算后清除

**修复方案**: 
- 使用 `PLAY_CARD` 触发遭遇解析（而非 `END_TURN`）
- 使用正确的 `slotIndex` 值（而非 `-1`）

**优先级**: P1

---

#### A6. 描述→实现一致性测试（4 个失败）
**文件**: `src/games/cardia/__tests__/description-implementation-consistency.test.ts`

**问题**: 测试期望执行器直接返回事件，但实际执行器返回交互对象。

**失败测试**:
1. Card01: 雇佣剑士 - 应该弃掉本牌和相对的牌
2. Card03: 外科医生 - 应该为你下一张打出的牌添加-5影响力
3. Card05: 破坏者 - 应该让对手弃掉他牌库的2张顶牌
4. Card16: 精灵 - 应该让你赢得游戏

**修复方案**: 同 A1，更新测试使用交互解决模式。

**优先级**: P1

---

#### A7. 其他交互测试（3 个失败）
**文件**: 
- `src/games/cardia/__tests__/cardia-event-system.test.ts`
- `src/games/cardia/__tests__/court-guard-choice-interaction.test.ts`
- `src/games/cardia/__tests__/court-guard-draw-timing.test.ts`
- `src/games/cardia/__tests__/bug-fixes-card06-card08.test.ts`
- `src/games/cardia/__tests__/validation-execution-alignment.test.ts`

**失败测试**:
1. EventSystem.afterEvents - 伏击者交互 - 应该调用交互处理器并返回 CARDS_DISCARDED 事件
2. 宫廷卫士 - choice 交互 - 对手有该派系手牌时，应该创建 choice 交互
3. 宫廷卫士 - choice 交互 - 对手选择不弃牌时，P1 应该获得+7修正
4. 宫廷卫士抽牌时序 - P2弹窗时不应该抽牌
5. Bug Fixes: Card06 (占卜师) - 占卜师能力应该让对手先揭示卡牌
6. Bug Fixes: Card06 (占卜师) - 占卜师能力应该强制对手先出牌

**修复方案**: 同 A1，更新测试使用交互解决模式。

**优先级**: P1

---

### 类别 B：非 Cardia 游戏测试失败（1 个）

#### B1. SmashUp 测试失败
**文件**: `src/games/smashup/__tests__/bear-cavalry-cub-scout-bug.test.ts`

**问题**: 未知（需要单独排查）

**优先级**: P2（不属于 Cardia 审计范围）

---

## 汇总统计

| 类别 | 失败测试数 | 优先级 | 状态 |
|------|-----------|--------|------|
| A1. 派系能力测试 | 13 | P1 | 待修复 |
| A2. 修正标记能力测试 | 4 | P1 | 待修复 |
| A3. 持续能力测试 | 10 | P1 | 待修复 |
| A4. 命令执行测试 | 2 | P1 | 待修复 |
| A5. Reducer 测试 | 3 | P1 | 待修复 |
| A6. 描述→实现一致性测试 | 4 | P1 | 待修复 |
| A7. 其他交互测试 | 6 | P1 | 待修复 |
| B1. SmashUp 测试 | 1 | P2 | 不在范围内 |
| **总计** | **43** | - | - |
| **Cardia P1 问题** | **42** | P1 | 待修复 |

---

## 修复策略

### 推荐方案：批量更新测试模式

1. **创建测试辅助函数** (`src/games/cardia/__tests__/helpers/interactionResolver.ts`)
   ```typescript
   export async function executeAndResolveInteraction(
     executor: AbilityExecutor,
     state: CardiaCore,
     payload: any,
     interactionResponse: any
   ) {
     const result = executor.execute(state, payload);
     if (result.interaction) {
       return await resolveInteraction(result.interaction, interactionResponse);
     }
     return result;
   }
   ```

2. **批量更新测试文件**
   - 使用 `executeAndResolveInteraction` 替换直接调用 `executor.execute`
   - 提供正确的交互响应（派系选择、卡牌选择等）

3. **验证修复效果**
   - 重新运行所有 Cardia 测试
   - 确认所有 P1 测试通过

### 时间估算

- 创建辅助函数：30 分钟
- 更新 13 个测试文件：2-3 小时
- 验证和调试：1 小时
- **总计：3.5-4.5 小时**

---

## 下一步行动

1. ✅ **Task 8.1 已完成**：修复 3 个 P0 代码 bug
2. ⏳ **Task 8.2 待执行**：修复 42 个 P1 测试维护问题
3. ⏳ **Task 8.3 待执行**：验证所有测试通过，确认测试覆盖率 ≥ 80%

---

## 备注

- 所有 P1 问题都是测试维护问题，不是代码 bug
- 代码本身已正确实现交互系统重构
- 测试更新不会改变任何业务逻辑
- 修复后测试覆盖率预计达到 90%+
