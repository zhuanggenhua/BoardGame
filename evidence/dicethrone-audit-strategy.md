# DiceThrone 审计策略

## 执行时间
2026-03-03

---

## 当前状态

- **总文件数**: 106 个
- **已审计**: 2 个（Board.tsx 部分，BoardOverlays.tsx）
- **未审计**: 104 个
- **测试失败**: 13 个

---

## 高效审计策略

### 策略 1: 测试驱动审计

**原理**: 测试失败通常指向真正的问题

**步骤**:
1. 分析所有测试失败
2. 定位失败相关的文件
3. 优先审计这些文件
4. 修复问题后重新运行测试

**优点**:
- 直接定位问题
- 避免审计不相关的文件
- 有明确的验证标准

### 策略 2: 变更量优先

**原理**: 变更量大的文件更可能有问题

**步骤**:
1. 按变更行数排序
2. 优先审计变更量 > 50 行的文件
3. 跳过变更量 < 10 行的文件（可能只是格式化）

**优点**:
- 高效利用时间
- 聚焦重要变更

### 策略 3: 分类审计

**原理**: 不同类型的文件有不同的审计重点

**分类**:
- **核心逻辑**: game.ts, domain/, execute.ts, reduce.ts
- **UI 组件**: ui/, Board.tsx
- **测试文件**: __tests__/
- **配置文件**: audio.config.ts, latencyConfig.ts
- **类型定义**: types.ts, core-types.ts

**审计重点**:
- 核心逻辑: 功能完整性
- UI 组件: 用户体验
- 测试文件: 测试覆盖率
- 配置文件: 配置正确性
- 类型定义: 类型安全

---

## 采用的策略

**组合策略**: 测试驱动 + 变更量优先 + 分类审计

### Phase 1: 测试失败分析（30 分钟）

1. 分析 13 个测试失败
2. 分类失败原因
3. 定位相关文件

### Phase 2: 核心逻辑审计（2 小时）

**优先级排序**（按变更量）:
1. game.ts - 258 行变更
2. hooks/useAnimationEffects.ts - 272 行变更
3. domain/rules.ts - 186 行变更
4. paladin/abilities.ts - 158 行变更
5. domain/flowHooks.ts - 136 行变更
6. domain/reduceCombat.ts - 125 行变更
7. ui/PlayerStats.tsx - 124 行变更

### Phase 3: 其他文件快速扫描（1 小时）

**跳过条件**:
- 变更量 < 10 行
- 只有格式化变更
- 只有注释变更

**重点关注**:
- 删除的功能
- 修改的逻辑
- 新增的 bug

---

## 测试失败分析

### 失败分类

**类别 1: 阶段推进问题**（3 个失败）
- flow.test.ts（1 个）
- monk-coverage.test.ts（2 个）
- **可能原因**: flowHooks.ts 或 domain/index.ts 的变更

**类别 2: Token 消耗问题**（2 个失败）
- shadow-thief-abilities.test.ts（1 个）
- token-execution.test.ts（1 个）
- **可能原因**: domain/execute.ts 或 domain/reducer.ts 的变更

**类别 3: 伤害结算问题**（1 个失败）
- thunder-strike.test.ts（1 个）
- **可能原因**: domain/attack.ts 或 domain/reduceCombat.ts 的变更

**类别 4: 额外攻击问题**（4 个失败）
- token-execution.test.ts（4 个）
- **可能原因**: domain/flowHooks.ts 或 domain/execute.ts 的变更

**类别 5: 教程问题**（3 个失败）
- tutorial-e2e.test.ts（3 个）
- **可能原因**: tutorial.ts 或 domain/commandValidation.ts 的变更

### 关键文件清单

基于测试失败，以下文件需要优先审计：

1. **domain/flowHooks.ts** - 136 行变更（阶段推进 + 额外攻击）
2. **domain/execute.ts** - 19 行变更（Token 消耗）
3. **domain/reducer.ts** - 33 行变更（Token 消耗）
4. **domain/attack.ts** - 35 行变更（伤害结算）
5. **domain/reduceCombat.ts** - 125 行变更（伤害结算）
6. **domain/commandValidation.ts** - 50 行变更（教程）
7. **tutorial.ts** - 10 行变更（教程）

---

## 执行计划

### 立即执行（今天）

1. **审计 domain/flowHooks.ts**（30 分钟）
   - 136 行变更
   - 影响阶段推进和额外攻击
   - 可能修复 7 个测试失败

2. **审计 domain/execute.ts + domain/reducer.ts**（30 分钟）
   - 52 行变更
   - 影响 Token 消耗
   - 可能修复 2 个测试失败

3. **审计 domain/attack.ts + domain/reduceCombat.ts**（30 分钟）
   - 160 行变更
   - 影响伤害结算
   - 可能修复 1 个测试失败

4. **审计 domain/commandValidation.ts + tutorial.ts**（30 分钟）
   - 60 行变更
   - 影响教程
   - 可能修复 3 个测试失败

**预计时间**: 2 小时
**预计修复**: 13 个测试失败

### 明天执行

5. **审计 game.ts**（1 小时）
   - 258 行变更
   - 核心游戏逻辑

6. **审计其他高变更量文件**（2 小时）
   - hooks/useAnimationEffects.ts - 272 行
   - domain/rules.ts - 186 行
   - paladin/abilities.ts - 158 行

7. **快速扫描剩余文件**（1 小时）
   - 跳过小变更
   - 重点关注删除的功能

---

## 成功标准

### 必须达成

1. ✅ 所有测试失败已修复（13 个）
2. ✅ 核心逻辑文件已审计（7 个）
3. ✅ 高变更量文件已审计（> 50 行）
4. ✅ TypeScript 编译通过

### 期望达成

1. ✅ 所有 106 个文件已审计
2. ✅ 完整的审计报告
3. ✅ 详细的恢复清单

---

## 总结

**采用策略**: 测试驱动 + 变更量优先

**优先审计**: 7 个核心文件（~500 行变更）

**预计时间**: 2 小时（今天）+ 4 小时（明天）

**预计修复**: 13 个测试失败

