# P2 Temple of Goju + First Mate 时序测试验证

## 验证结果

### ✅ 功能仍然存在

1. **Temple of Goju（寺庙）**：
   - 位置：`base_temple_of_goju`
   - 功能：afterScoring 基地能力，可以将随从放回牌库底

2. **First Mate（大副）**：
   - 位置：`pirate_first_mate`
   - 功能：afterScoring 触发器，可以移动到其他基地

3. **`_deferredPostScoringEvents` 机制**：
   - 位置：`src/games/smashup/domain/index.ts`（第 403 行）
   - 功能：将 BASE_CLEARED 事件延迟到所有 afterScoring 交互解决后执行
   - 状态：✅ 仍然存在且正常工作

### ❌ 测试缺失

根据 P2 验证报告，以下测试在 POD commit 中被删除：

1. ❌ `describe('集成: base_temple_of_goju + pirate_first_mate 时序', ...)`
   - `it('寺庙 afterScoring 把 first_mate 放牌库底后，大副不再触发移动交互', ...)`
   - `it('寺庙上有多个 first_mate 且未被放牌库底的仍可触发移动', ...)`

### 搜索结果

**搜索命令**：
```bash
grep -r "temple_of_goju.*first_mate\|first_mate.*temple_of_goju" src/games/smashup/__tests__/
```

**结果**：无匹配

**结论**：这些测试确实缺失，未在其他文件中找到。

## 重要性评估

### ⭐⭐⭐ 高优先级（强烈建议恢复）

**理由**：

1. **文档明确提到**：
   - `docs/ai-rules/testing-audit.md` 中提到这是多 afterScoring 交互链式传递的典型案例
   - `docs/ai-rules/engine-systems.md` 中提到多 afterScoring 交互链式传递的 bug 修复

2. **复杂交互场景**：
   - 寺庙基地能力（afterScoring）+ 大副触发器（afterScoring）同时触发
   - 寺庙把大副放回牌库底后，大副不应再触发移动交互
   - 这是 `_deferredPostScoringEvents` 机制的关键测试场景

3. **容易出 bug**：
   - 时序问题：BASE_CLEARED 事件必须延迟到所有交互解决后执行
   - 链式传递：`_deferredPostScoringEvents` 必须从第一个交互传递到最后一个交互
   - 边缘情况：寺庙上有多个大副，部分被放回牌库底，部分仍在场上

4. **已有类似测试**：
   - `mothership-scout-afterscore-bug.test.ts` - 母舰 + 侦察兵时序测试（2 个交互）
   - `miskatonic-scout-afterscore.test.ts` - 密大基地 + 侦察兵时序测试（2 个交互）
   - 但缺少寺庙 + 大副的测试（寺庙会移除随从，更复杂）

5. **通用性**：
   - 这个测试覆盖的场景对所有多 afterScoring 交互都有效
   - 不仅是寺庙 + 大副，还包括其他基地能力 + 随从触发器的组合

## 现有类似测试

### 母舰 + 侦察兵测试（`mothership-scout-afterscore-bug.test.ts`）

**测试场景**：
- 母舰基地能力（afterScoring）：收回随从
- 侦察兵触发器（afterScoring）：返回手牌
- 验证：`_deferredPostScoringEvents` 从母舰交互传递到侦察兵交互

**关键断言**：
```typescript
// 母舰交互应该有 _deferredPostScoringEvents
const ctx1 = (interaction?.data as any)?.continuationContext;
expect(ctx1?._deferredPostScoringEvents).toBeDefined();
expect(ctx1?._deferredPostScoringEvents.length).toBeGreaterThan(0);

// 侦察兵交互应该继承了 _deferredPostScoringEvents
const ctx2 = (interaction?.data as any)?.continuationContext;
expect(ctx2?._deferredPostScoringEvents).toBeDefined();

// 验证：侦察兵仍然在基地上（BASE_CLEARED 还没执行）
expect(base.minions.some(m => m.uid === 'scout1')).toBe(true);
```

**测试覆盖**：
- ✅ 2 个交互（母舰 + 侦察兵）
- ✅ 4 个交互（母舰 + 2 侦察兵 + 大副）
- ❌ 寺庙场景（移除随从后不应再触发）

### 密大基地 + 侦察兵测试（`miskatonic-scout-afterscore.test.ts`）

**测试场景**：
- 密大基地能力（afterScoring）：返回疯狂卡
- 侦察兵触发器（afterScoring）：返回手牌
- 验证：`_deferredPostScoringEvents` 从密大基地交互传递到侦察兵交互

**关键断言**：
```typescript
// 密大基地交互应该有 _deferredPostScoringEvents
let ctx = (interaction?.data as any)?.continuationContext;
expect(ctx?._deferredPostScoringEvents).toBeDefined();
expect(ctx?._deferredPostScoringEvents.length).toBeGreaterThan(0);

// 侦察兵交互应该继承了 _deferredPostScoringEvents
ctx = (interaction?.data as any)?.continuationContext;
expect(ctx?._deferredPostScoringEvents).toBeDefined();

// 验证：侦察兵仍然在基地上（BASE_CLEARED 还没执行）
expect(base.minions.some(m => m.uid === 'scout1')).toBe(true);
```

**测试覆盖**：
- ✅ 2 个交互（密大基地 + 侦察兵）
- ❌ 寺庙场景（移除随从后不应再触发）

## 寺庙 + 大副的独特性

### 与现有测试的差异

| 维度 | 母舰/密大基地 + 侦察兵 | 寺庙 + 大副 |
|------|---------------------|-----------|
| 基地能力效果 | 收回随从/返回疯狂卡 | **移除随从（放回牌库底）** |
| 随从触发器 | 侦察兵返回手牌 | 大副移动到其他基地 |
| 关键差异 | 随从仍在场上 | **随从被移除后不应再触发** |
| 测试重点 | `_deferredPostScoringEvents` 传递 | **移除后的触发器过滤** |

### 寺庙场景的特殊性

1. **移除随从后不应再触发**：
   - 寺庙把大副放回牌库底后，大副不应再触发移动交互
   - 这是母舰/密大基地测试没有覆盖的场景

2. **部分移除的情况**：
   - 寺庙上有多个大副，部分被放回牌库底，部分仍在场上
   - 只有仍在场上的大副应该触发移动交互

3. **触发器过滤逻辑**：
   - 需要在创建交互时检查随从是否仍在场上
   - 或者在解决交互时检查随从是否仍然有效

## 恢复建议

### 测试用例设计

#### 测试 1：寺庙移除大副后不再触发

**场景**：
- 寺庙基地达标，上面有 1 个大副
- 寺庙 afterScoring 交互：选择把大副放回牌库底
- 预期：大副不再触发移动交互

**关键断言**：
```typescript
// 解决寺庙交互：选择把大副放回牌库底
const r2 = runCommand(r1.finalState, 'RESOLVE_INTERACTION', {
    playerId: '0',
    interactionId: interaction1.id,
    choice: { cardUid: 'first_mate_1' }
});

// 验证：大副已被移除
const base = r2.finalState.core.bases[0];
expect(base.minions.some(m => m.uid === 'first_mate_1')).toBe(false);

// 验证：没有大副的移动交互
const interaction2 = r2.finalState.sys.interaction.current;
expect(interaction2).toBeNull(); // 或者是其他交互，但不是大副的移动交互
```

#### 测试 2：寺庙上有多个大副，部分被移除

**场景**：
- 寺庙基地达标，上面有 2 个大副（first_mate_1 和 first_mate_2）
- 寺庙 afterScoring 交互：选择把 first_mate_1 放回牌库底
- 预期：只有 first_mate_2 触发移动交互

**关键断言**：
```typescript
// 解决寺庙交互：选择把 first_mate_1 放回牌库底
const r2 = runCommand(r1.finalState, 'RESOLVE_INTERACTION', {
    playerId: '0',
    interactionId: interaction1.id,
    choice: { cardUid: 'first_mate_1' }
});

// 验证：first_mate_1 已被移除，first_mate_2 仍在场上
const base = r2.finalState.core.bases[0];
expect(base.minions.some(m => m.uid === 'first_mate_1')).toBe(false);
expect(base.minions.some(m => m.uid === 'first_mate_2')).toBe(true);

// 验证：只有 first_mate_2 的移动交互
const interaction2 = r2.finalState.sys.interaction.current;
expect(interaction2?.data.sourceId).toBe('pirate_first_mate');
expect((interaction2?.data as any).minionUid).toBe('first_mate_2');
```

#### 测试 3：`_deferredPostScoringEvents` 传递

**场景**：
- 寺庙基地达标，上面有 1 个大副
- 寺庙 afterScoring 交互：选择跳过（不移除大副）
- 预期：大副触发移动交互，`_deferredPostScoringEvents` 正确传递

**关键断言**：
```typescript
// 寺庙交互应该有 _deferredPostScoringEvents
const ctx1 = (interaction1?.data as any)?.continuationContext;
expect(ctx1?._deferredPostScoringEvents).toBeDefined();
expect(ctx1?._deferredPostScoringEvents.length).toBeGreaterThan(0);

// 解决寺庙交互：选择跳过
const r2 = runCommand(r1.finalState, 'RESOLVE_INTERACTION', {
    playerId: '0',
    interactionId: interaction1.id,
    choice: { skip: true }
});

// 大副交互应该继承了 _deferredPostScoringEvents
const interaction2 = r2.finalState.sys.interaction.current;
const ctx2 = (interaction2?.data as any)?.continuationContext;
expect(ctx2?._deferredPostScoringEvents).toBeDefined();

// 验证：大副仍在基地上（BASE_CLEARED 还没执行）
const base = r2.finalState.core.bases[0];
expect(base.minions.some(m => m.uid === 'first_mate_1')).toBe(true);
```

### 文件位置

**建议文件名**：`src/games/smashup/__tests__/temple-firstmate-afterscore.test.ts`

**理由**：
- 与现有的 `mothership-scout-afterscore-bug.test.ts` 和 `miskatonic-scout-afterscore.test.ts` 命名一致
- 清晰表明测试的是 afterScoring 时序问题

## 下一步行动

### 立即执行（今天）

1. **[ ] 创建测试文件**：`src/games/smashup/__tests__/temple-firstmate-afterscore.test.ts`

2. **[ ] 实现 3 个测试用例**：
   - 测试 1：寺庙移除大副后不再触发
   - 测试 2：寺庙上有多个大副，部分被移除
   - 测试 3：`_deferredPostScoringEvents` 传递

3. **[ ] 运行测试验证**：
   ```bash
   npm run test -- temple-firstmate-afterscore.test.ts
   ```

4. **[ ] 如果测试失败，分析原因**：
   - 如果是功能 bug → 修复代码
   - 如果是测试编写问题 → 修复测试

### 后续执行（本周）

5. **[ ] 验证剩余 5 个中优先级测试**：
   - Monk dodge tests (`monk-coverage.test.ts`)
   - Paladin tests (`paladin-coverage.test.ts`)
   - View mode tests (`viewMode.test.ts`)
   - Pyromancer tests (`pyromancer-behavior.test.ts`)
   - Zombie interaction chain tests (`zombieInteractionChain.test.ts`)

6. **[ ] 创建 P2 最终恢复总结**

## 总结

**Temple of Goju + First Mate 时序测试状态**：
- ✅ 功能完整：寺庙、大副、`_deferredPostScoringEvents` 机制仍然存在且正常工作
- ❌ 测试缺失：寺庙 + 大副的时序测试确实缺失，未在其他文件中找到
- ⭐⭐⭐ 高优先级：这是多 afterScoring 交互链式传递的典型案例，文档中明确提到
- 🎯 独特性：寺庙会移除随从，测试覆盖了"移除后不应再触发"的场景，现有测试未覆盖

**建议**：
- 立即恢复这 3 个测试用例（高优先级）
- 参考现有的 `mothership-scout-afterscore-bug.test.ts` 和 `miskatonic-scout-afterscore.test.ts`
- 重点测试"移除后不应再触发"的场景（寺庙的独特性）
