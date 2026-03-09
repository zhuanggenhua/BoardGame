# Phase 3 集成测试失败记录

生成时间：2026-03-05  
审计阶段：Phase 3 - 集成测试  
任务：Task 11 - 运行集成测试验证组合场景

---

## 测试执行总结

### 测试文件执行情况

| 测试文件 | 状态 | 通过/失败 | 备注 |
|---------|------|----------|------|
| `integration-ongoing-abilities.test.ts` | ⚠️ 部分失败 | 部分通过 | 3 个测试失败 |
| `integration-ability-copy.test.ts` | ✅ 通过 | 全部通过 | 无失败 |
| `interaction.test.ts` | ✅ 通过 | 全部通过 | 无失败 |

### 总体统计

- **测试文件总数**：3
- **通过的测试文件**：2
- **部分失败的测试文件**：1
- **失败的测试用例**：3（来自 `integration-ongoing-abilities.test.ts`）

---

## 失败测试详情

### 1. integration-ongoing-abilities.test.ts

#### 失败 1：持续标记放置和移除 - 应该正确放置财务官持续标记

**测试路径**：`持续能力集成测试 > 持续标记放置和移除 > 应该正确放置财务官持续标记`

**错误类型**：AssertionError

**错误信息**：
```
expected undefined to be defined
```

**错误位置**：
```typescript
// src/games/cardia/__tests__/integration-ongoing-abilities.test.ts:259:30
expect(ongoingAbility).toBeDefined();
```

**问题分析**：
- 测试期望在 `ongoingAbilities` 数组中找到财务官的持续标记
- 实际返回 `undefined`，说明持续标记未被正确放置
- 可能原因：
  1. 财务官能力执行器未正确创建持续标记
  2. 持续标记的 `abilityId` 或 `effectType` 不匹配
  3. 持续标记被过早移除

**优先级**：P1（影响持续能力功能）

---

#### 失败 2：持续效果应用 - 应该在遭遇结算时应用调停者效果（强制平局）

**测试路径**：`持续能力集成测试 > 持续效果应用 > 应该在遭遇结算时应用调停者效果（强制平局）`

**错误类型**：AssertionError

**错误信息**：
```
expected 'p2' to be undefined

- Expected: undefined
+ Received: "p2"
```

**错误位置**：
```typescript
// src/games/cardia/__tests__/integration-ongoing-abilities.test.ts:342:50
expect(newCore.currentEncounter?.winnerId).toBeUndefined();
```

**问题分析**：
- 测试期望调停者效果强制平局（winnerId 应为 undefined）
- 实际 winnerId 为 'p2'，说明调停者效果未生效
- 可能原因：
  1. 调停者持续标记未被正确应用到遭遇结算逻辑
  2. 遭遇结算时未检查持续标记
  3. 持续标记的优先级不正确

**优先级**：P1（影响持续能力功能）

---

#### 失败 3：持续效果应用 - 应该在遭遇结算时应用财务官效果（额外印戒）

**测试路径**：`持续能力集成测试 > 持续效果应用 > 应该在遭遇结算时应用财务官效果（额外印戒）`

**错误类型**：AssertionError

**错误信息**：
```
expected 1 to be 2 // Object.is equality

- Expected: 2
+ Received: 1
```

**错误位置**：
```typescript
// src/games/cardia/__tests__/integration-ongoing-abilities.test.ts:512:35
expect(winnerCard?.signets).toBe(2);
```

**问题分析**：
- 测试期望获胜者卡牌获得 2 个印戒（1 个基础 + 1 个财务官额外）
- 实际只有 1 个印戒，说明财务官效果未生效
- 可能原因：
  1. 财务官持续标记未被正确应用到遭遇结算逻辑
  2. 遭遇结算时未检查持续标记
  3. 额外印戒逻辑未实现或未触发

**优先级**：P1（影响持续能力功能）

---

#### 失败 4：持续效果优先级 - 应该优先应用审判官效果而不是调停者效果

**测试路径**：`持续能力集成测试 > 持续效果优先级 > 应该优先应用审判官效果而不是调停者效果`

**错误类型**：AssertionError

**错误信息**：
```
expected 'p2' to be 'p1' // Object.is equality

Expected: "p1"
Received: "p2"
```

**错误位置**：
```typescript
// src/games/cardia/__tests__/integration-ongoing-abilities.test.ts:611:50
expect(newCore.currentEncounter?.winnerId).toBe('p1');
```

**问题分析**：
- 测试期望审判官效果优先于调停者效果（p1 应获胜）
- 实际 p2 获胜，说明持续效果优先级不正确
- 预期逻辑：p2 初始获胜（10 > 5）→ 调停者强制平局 → 审判官赢得平局（p1 获胜）
- 可能原因：
  1. 持续效果优先级未实现
  2. 审判官效果未生效
  3. 调停者效果未生效

**优先级**：P1（影响持续能力功能）

---

## 问题分类

### 按维度分类

| 维度 | 问题数量 | 问题 ID |
|------|---------|---------|
| D10: 持续能力组合 | 4 | 失败 1-4 |
| D19: 组合场景 | 4 | 失败 1-4 |

### 按优先级分类

| 优先级 | 问题数量 | 占比 |
|--------|---------|------|
| P0 | 0 | 0% |
| P1 | 4 | 100% |
| P2 | 0 | 0% |

---

## 根本原因分析

### 共同模式

所有失败的测试都与**持续能力（ongoing abilities）**相关，具体表现为：

1. **持续标记未正确放置**：财务官持续标记未出现在 `ongoingAbilities` 数组中
2. **持续效果未应用到遭遇结算**：调停者和财务官的持续效果在遭遇结算时未生效
3. **持续效果优先级未实现**：审判官和调停者的优先级关系未正确处理

### 可能的根本原因

1. **持续标记创建逻辑缺失**：
   - 能力执行器未正确创建持续标记
   - 持续标记的数据结构不完整

2. **遭遇结算未检查持续标记**：
   - `reduceEncounterResolved` 或相关 reducer 未读取 `ongoingAbilities`
   - 遭遇结算逻辑未应用持续效果

3. **持续效果优先级系统缺失**：
   - 没有实现持续效果的优先级排序
   - 多个持续效果同时生效时的处理逻辑不正确

---

## 修复建议

### 短期修复（P1）

1. **修复持续标记创建**：
   - 检查财务官和调停者的能力执行器
   - 确保正确创建持续标记并添加到 `ongoingAbilities` 数组

2. **修复遭遇结算逻辑**：
   - 在 `reduceEncounterResolved` 中添加持续标记检查
   - 应用持续效果到遭遇结果（平局、额外印戒等）

3. **实现持续效果优先级**：
   - 定义持续效果的优先级规则
   - 在遭遇结算时按优先级应用持续效果

### 长期改进（P2）

1. **补充持续能力测试**：
   - 为每个持续能力卡牌添加单元测试
   - 测试持续标记的创建、应用、移除全流程

2. **文档化持续能力系统**：
   - 记录持续标记的数据结构
   - 记录持续效果的优先级规则
   - 记录遭遇结算的持续效果应用流程

---

## 下一步行动

### 立即行动（Task 14.1）

1. 修复持续标记创建逻辑
2. 修复遭遇结算逻辑
3. 实现持续效果优先级
4. 重新运行 `integration-ongoing-abilities.test.ts` 验证修复

### 后续行动（Task 12-13）

1. 识别缺失的组合场景测试
2. 补充缺失的集成测试
3. 补充边界条件测试

---

## 附录

### 测试运行命令

```bash
# 运行所有集成测试
npm run test:games -- cardia integration

# 运行单个集成测试文件
npm run test:games -- cardia/__tests__/integration-ongoing-abilities.test.ts
npm run test:games -- cardia/__tests__/integration-ability-copy.test.ts
npm run test:games -- cardia/__tests__/interaction.test.ts
```

### 相关文件

- 测试文件：`src/games/cardia/__tests__/integration-ongoing-abilities.test.ts`
- 能力执行器：`src/games/cardia/domain/abilities/group3-ongoing.ts`
- 遭遇结算：`src/games/cardia/domain/reduce.ts` (reduceEncounterResolved)
- 持续标记类型：`src/games/cardia/types.ts` (OngoingAbility)

---

**报告生成人员**：Kiro AI  
**生成时间**：2026-03-05  
**审计阶段**：Phase 3 - 集成测试  
**下一阶段**：Task 12 - 识别缺失的组合场景测试
