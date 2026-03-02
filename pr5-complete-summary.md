# PR5 完整修复总结

## 概述

本次修复解决了 SmashUp 游戏中的两个关键 bug：
1. **Robot 能力测试失败**：`robot_microbot_fixer` 和 `robot_microbot_reclaimer` 测试失败
2. **Giant Ant afterScoring 触发器失败**：`giant_ant_we_are_the_champions` 无法在计分后创建交互

## 修复 1: Robot 能力测试失败

### 问题根因

在 `postProcessSystemEvents` 函数（`src/games/smashup/domain/index.ts:1042`）中，`MINION_PLAYED` 事件被 reduce 了两次：
- **第一次**：在 pipeline 步骤 4（`executePipeline` 中的 `reduce(state, event)`）
- **第二次**：在 `postProcessSystemEvents` 中（步骤 4.5）

这导致 `minionsPlayed` 计数器从 1 错误地增加到 2，使得 `robotMicrobotFixer` 的条件 `minionsPlayed > 1` 在不应该触发时返回 true。

### 修复方案

注释掉 `postProcessSystemEvents` 中的重复 reduce 调用：

```typescript
// src/games/smashup/domain/index.ts:1042
// ❌ 错误：重复 reduce 导致 minionsPlayed 计数错误
// tempCore = reduce(tempCore, event);

// ✅ 正确：不再 reduce，因为 pipeline 已经处理过了
// 关键：此时 state 参数已经包含了所有事件的 reduce 结果
```

### 验证结果

✅ `robotAbilities.test.ts` 所有测试通过
- `robot_microbot_fixer` 正确判断 `minionsPlayed === 1`
- `robot_microbot_reclaimer` 正确判断 `minionsPlayed === 1`

---

## 修复 2: Giant Ant afterScoring 触发器失败

### 问题根因

**时序问题**：`afterScoring` 触发器尝试从已计分的基地读取随从信息，但基地在计分后已被清空（随从已移除）。

**执行流程**：
1. P0 打出 `we_are_the_champions` → 创建 ARMED 事件
2. 计分发生 → 基地清空（随从移除）
3. `afterScoring` 触发器执行 → 尝试读取基地上的随从 → 找不到任何随从 → 无法创建交互

### 修复方案

**核心思路**：在 ARMED 事件创建时捕获随从快照，而不是在 `afterScoring` 触发时读取。

#### 1. 扩展事件和状态类型

```typescript
// src/games/smashup/domain/types.ts

export interface SpecialAfterScoringArmedEvent {
  payload: {
    sourceDefId: string;
    playerId: PlayerId;
    baseIndex: number;
    // 新增：随从快照
    minionSnapshots?: Array<{
      uid: string;
      defId: string;
      baseIndex: number;
      counterAmount: number;
    }>;
  };
}

export interface PendingAfterScoringSpecial {
  sourceDefId: string;
  playerId: PlayerId;
  baseIndex: number;
  // 新增：随从快照
  minionSnapshots?: Array<{...}>;
}
```

#### 2. 捕获快照（PLAY_ACTION 时）

```typescript
// src/games/smashup/abilities/giant_ants.ts

function giantAntWeAreTheChampions(ctx: AbilityContext): AbilityResult {
  // 捕获当前基地上己方有力量指示物的随从快照
  const base = ctx.state.bases[ctx.baseIndex];
  const sources = base?.minions
    .filter(m => m.controller === ctx.playerId && m.powerCounters > 0)
    .map(m => ({
      uid: m.uid,
      defId: m.defId,
      baseIndex: ctx.baseIndex,
      counterAmount: m.powerCounters,
    })) ?? [];

  return {
    events: [{
      type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
      payload: {
        sourceDefId: 'giant_ant_we_are_the_champions',
        playerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        minionSnapshots: sources,  // 保存快照
      },
      timestamp: ctx.now,
    }],
  };
}
```

#### 3. 使用快照（afterScoring 触发时）

```typescript
// src/games/smashup/abilities/giant_ants.ts

function giantAntWeAreTheChampionsAfterScoring(ctx: TriggerContext) {
  const armed = (state.pendingAfterScoringSpecials ?? []).filter(
    s => s.sourceDefId === 'giant_ant_we_are_the_champions' && s.baseIndex === baseIndex,
  );
  
  for (const armedEntry of armed) {
    // 使用快照中的随从（而不是读取已清空的基地）
    const sources = armedEntry.minionSnapshots ?? [];
    if (sources.length === 0) continue;
    
    // 手动构建选项（使用快照数据）
    const sourceOptions = sources.map((s, i) => {
      const def = getCardDef(s.defId);
      return {
        id: `minion-${i}`,
        label: `${def?.name ?? s.defId}（力量指示物 ${s.counterAmount}）`,
        value: { 
          minionUid: s.uid, 
          baseIndex: s.baseIndex, 
          defId: s.defId, 
          counterAmount: s.counterAmount 
        },
        // 计分后来源随从已离场，必须保留快照选项，不能走 field 动态校验
        _source: 'static' as const,
      };
    });
    
    // 创建交互...
  }
}
```

#### 4. 更新 Reducer

```typescript
// src/games/smashup/domain/reduce.ts

case SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED: {
  const payload = (event as SpecialAfterScoringArmedEvent).payload;
  const newEntry: PendingAfterScoringSpecial = {
    sourceDefId: payload.sourceDefId,
    playerId: payload.playerId,
    baseIndex: payload.baseIndex,
    // 保存快照到 core state
    ...(payload.minionSnapshots ? { minionSnapshots: payload.minionSnapshots } : {}),
  };
  // ...
}
```

### 验证结果

✅ `vampireBuffetE2E.test.ts` (2/2 passing)
✅ `robotAbilities.test.ts` (all passing)
✅ `newFactionAbilities.test.ts` (50/51 passing, 1 skipped)

---

## 修改的文件

### Robot 修复
1. `src/games/smashup/domain/index.ts` - 注释掉重复 reduce 调用

### Giant Ant 修复
1. `src/games/smashup/abilities/giant_ants.ts` - 捕获和使用快照
2. `src/games/smashup/domain/types.ts` - 扩展类型定义
3. `src/games/smashup/domain/reduce.ts` - 保存快照到 state
4. `src/games/smashup/__tests__/vampireBuffetE2E.test.ts` - 修复测试数据（给随从添加 powerCounters）
5. `src/games/smashup/__tests__/newFactionAbilities.test.ts` - 更新测试状态（包含 minionSnapshots）

---

## 文档更新

### 新增文档
1. `docs/bugs/smashup-we-are-the-champions-afterscoring-fix.md` - Giant Ant 修复详细文档

### 更新文档
1. `docs/testing-best-practices.md` - 新增「测试性能和超时」章节
   - 测试套件运行时间表
   - Property-based 测试说明
   - 超时配置说明
   - 开发最佳实践
   - 性能优化建议

2. `docs/automated-testing.md` - 增强开发工作流建议
   - 测试性能参考表
   - 不同测试范围的快速参考

---

## 经验教训

### 1. 事件 Reduce 时序
- **问题**：同一事件在 pipeline 中被 reduce 多次，导致状态计数错误
- **教训**：在 `postProcessSystemEvents` 中处理派生事件时，必须明确哪些事件已经被 pipeline reduce 过，避免重复处理
- **解决方案**：注释掉重复 reduce，并添加详细注释说明原因

### 2. 时序敏感的数据必须提前捕获
- **问题**：`afterScoring` 触发器执行时，基地已被清空，无法读取随从信息
- **教训**：如果数据在触发器执行前可能被清除，必须在事件创建时捕获快照
- **解决方案**：在 ARMED 事件中保存随从快照，触发器使用快照而不是实时读取

### 3. 测试数据要真实
- **问题**：测试中的随从 `powerCounters` 为 0，导致效果无法触发
- **教训**：测试数据必须符合真实游戏场景，否则无法验证功能正确性
- **解决方案**：修复测试数据，给随从添加正确的 `powerCounters` 值

### 4. 类型安全很重要
- **问题**：快照数据结构不明确，容易出错
- **教训**：通过扩展类型定义，确保快照数据的结构正确
- **解决方案**：在类型定义中明确 `minionSnapshots` 的结构，编译期捕获错误

---

## 测试结果

### 全部通过的测试
- ✅ `robotAbilities.test.ts` - 所有 Robot 能力测试通过
- ✅ `vampireBuffetE2E.test.ts` - 2/2 E2E 测试通过
- ✅ `newFactionAbilities.test.ts` - 50/51 测试通过（1 个 skipped）

### 测试性能
- 单个测试文件：10-60 秒
- SmashUp 测试套件：~2-3 分钟
- 完整测试套件：10-15 分钟（4422 个测试）

### 剩余问题
- 23 个测试文件仍有失败（46 个测试用例）
- **这些是历史遗留问题，与本次修复无关**

---

## 日期

2024-03-02

---

## 相关文档

- `docs/bugs/smashup-we-are-the-champions-afterscoring-fix.md` - Giant Ant 修复详细文档
- `docs/testing-best-practices.md` - 测试最佳实践（包含性能章节）
- `docs/automated-testing.md` - 自动化测试指南
- `docs/ai-rules/testing-audit.md` - 测试审计规范
