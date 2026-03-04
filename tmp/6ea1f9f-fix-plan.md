# 提交 6ea1f9f 修复计划

## 策略调整

**原则**: 不假设 6ea1f9f 一定错误，而是：
1. 对比当前代码与 6ea1f9f 的差异
2. 找出你已经修复的问题
3. 找出可能遗漏的问题
4. 基于当前测试失败情况，针对性修复

---

## 当前测试失败分析

### 失败的测试（45 个）

#### 1. ongoingModifiers.test.ts (17 个失败)

**症状**: 力量修正值错误
- 睡眠孢子: 预期 -1，实际 -2
- 旋转弹头发射器: 预期 +2，实际 +4
- 多个 ongoing 叠加: 数值不对

**可能原因**:
- ✅ 已知问题: `docs/bugs/power-modifier-pod-duplicate-fix.md`
- ❓ 是否已修复: 需要检查当前代码
- ❓ 是否有新的重复逻辑

**检查点**:
```bash
# 检查当前 reducer.ts 中的 powerModifier 处理
git diff 6ea1f9f HEAD -- src/games/smashup/domain/reducer.ts | grep -A5 -B5 "powerModifier"

# 检查当前 ongoingModifiers.ts
git diff 6ea1f9f HEAD -- src/games/smashup/domain/ongoingModifiers.ts
```

---

#### 2. abilityBehaviorAudit.test.ts (3 个失败)

**失败的测试**:
- ❌ 描述含"力量修正"的 ongoing 行动卡必须有 powerModifier 注册
- ❌ 描述含"随从被消灭后"触发效果的持续随从必须有 onDestroy 能力注册
- ❌ 所有 ongoing 行动卡都有对应的效果注册

**可能原因**: POD 版本的能力注册不完整

**检查点**:
```bash
# 检查 POD 能力注册
grep -r "POD" src/games/smashup/abilities/
grep -r "powerModifier" src/games/smashup/abilities/*_pod.ts
```

---

#### 3. sleep-spores-e2e.test.ts (2 个失败)

**症状**: 睡眠孢子 -1 变成 -2

**可能原因**: 与 ongoingModifiers 问题相同

---

## 修复策略

### 阶段 1: 对比分析（不修改代码）

1. **对比 reducer.ts**
   ```bash
   git diff 6ea1f9f HEAD -- src/games/smashup/domain/reducer.ts > tmp/reducer-changes-since-6ea1f9f.diff
   ```

2. **对比 ongoingModifiers.ts**
   ```bash
   git diff 6ea1f9f HEAD -- src/games/smashup/domain/ongoingModifiers.ts > tmp/ongoing-changes-since-6ea1f9f.diff
   ```

3. **对比 index.ts**
   ```bash
   git diff 6ea1f9f HEAD -- src/games/smashup/domain/index.ts > tmp/index-changes-since-6ea1f9f.diff
   ```

4. **检查已修复的 bug**
   ```bash
   ls docs/bugs/*pod*.md
   ls docs/bugs/*power*.md
   ls docs/bugs/*modifier*.md
   ```

---

### 阶段 2: 定位当前问题

**目标**: 找出为什么 ongoingModifiers 测试失败

**步骤**:
1. 运行单个失败的测试，查看详细错误
   ```bash
   npm test -- ongoingModifiers.test.ts -t "睡眠孢子"
   ```

2. 添加调试日志，追踪 powerModifier 应用过程
   ```typescript
   // 在 ongoingModifiers.ts 中添加
   console.log('[DEBUG] Applying powerModifier:', modifier);
   console.log('[DEBUG] Current power:', currentPower);
   ```

3. 检查是否有重复注册
   ```typescript
   // 检查 abilityRegistry 中是否有重复
   const allModifiers = getAllPowerModifiers();
   console.log('[DEBUG] Total modifiers:', allModifiers.length);
   ```

---

### 阶段 3: 针对性修复

#### 修复 1: Power Modifier 重复应用

**假设**: 可能在多个地方应用了同一个 modifier

**检查位置**:
1. `reducer.ts` - 事件处理时是否重复添加
2. `ongoingModifiers.ts` - 计算时是否重复应用
3. `domain/index.ts` - 命令执行时是否重复处理

**修复模板**:
```typescript
// ❌ 可能的问题
function applyModifiers(minion, modifiers) {
  modifiers.forEach(mod => {
    minion.power += mod.value; // 每次都加
  });
}

// ✅ 正确做法
function applyModifiers(minion, modifiers) {
  // 去重
  const uniqueModifiers = Array.from(new Set(modifiers.map(m => m.id)))
    .map(id => modifiers.find(m => m.id === id));
  
  uniqueModifiers.forEach(mod => {
    minion.power += mod.value;
  });
}
```

---

#### 修复 2: POD 能力注册不完整

**检查**:
```bash
# 找出所有 POD 能力文件
find src/games/smashup/data/factions -name "*_pod.ts"

# 检查是否都在 abilities/index.ts 中注册
grep -r "export.*from.*_pod" src/games/smashup/abilities/
```

**修复**: 补全缺失的注册

---

## 执行计划

### 今天（立即执行）

1. ✅ 创建本修复计划
2. ⏳ 运行对比分析命令
3. ⏳ 查看你已经修复的 bug 文档
4. ⏳ 运行单个失败测试，获取详细错误信息

### 明天（深入修复）

5. ⏳ 定位 Power Modifier 重复应用的具体位置
6. ⏳ 修复重复应用问题
7. ⏳ 补全 POD 能力注册
8. ⏳ 重新运行测试

---

## 检查清单

### 已修复的问题（需要确认）
- [ ] 检查 `docs/bugs/power-modifier-pod-duplicate-fix.md` 的修复是否完整
- [ ] 检查是否有其他相关的 bug 修复文档
- [ ] 对比当前代码与 6ea1f9f，看看你已经改了什么

### 当前问题（需要修复）
- [ ] ongoingModifiers 测试失败（17 个）
- [ ] abilityBehaviorAudit 测试失败（3 个）
- [ ] sleep-spores E2E 测试失败（2 个）

### 验证步骤
- [ ] 修复后运行 `npm test -- ongoingModifiers`
- [ ] 修复后运行 `npm test -- abilityBehaviorAudit`
- [ ] 修复后运行 `npm test -- sleep-spores-e2e`
- [ ] 最后运行 `npm test -- smashup` 确认所有测试通过

---

## 下一步

让我先运行对比分析，看看你已经修了什么：

```bash
# 1. 对比关键文件
git diff 6ea1f9f HEAD -- src/games/smashup/domain/reducer.ts > tmp/reducer-changes.diff
git diff 6ea1f9f HEAD -- src/games/smashup/domain/ongoingModifiers.ts > tmp/ongoing-changes.diff

# 2. 查看已修复的 bug
ls -la docs/bugs/*pod*.md docs/bugs/*power*.md docs/bugs/*modifier*.md

# 3. 运行单个测试查看详细错误
npm test -- ongoingModifiers.test.ts -t "睡眠孢子" --reporter=verbose
```

需要我执行这些命令吗？


---

## 🎯 问题定位完成

### 发现的问题

#### 1. powerCounters 重复计算

**位置**: `src/games/smashup/domain/ongoingModifiers.ts:335`

**问题代码**:
```typescript
export function getEffectivePowerBreakdown(...) {
    const counters = minion.powerCounters ?? 0;
    return {
        basePower: minion.basePower,
        powerCounters: counters,  // 新增字段
        permanentModifier: minion.powerModifier,
        tempModifier: minion.tempPowerModifier ?? 0,
        ongoingDetails,
        finalPower: Math.max(0, 
            minion.basePower + 
            counters +  // ❌ 这里加了 powerCounters
            minion.powerModifier + 
            (minion.tempPowerModifier ?? 0) + 
            ongoingTotal
        ),
    };
}
```

**问题**: `powerCounters` 可能在其他地方已经被计算过了，这里又加了一次。

**检查**:
```bash
# 搜索 powerCounters 的所有使用
grep -r "powerCounters" src/games/smashup/domain/
```

---

#### 2. 测试失败的具体原因

**测试 1**: 睡眠孢子 + 旋转弹头发射器
- 预期: 6 (4 基础 + 2 旋转弹头)
- 实际: 8 (多了 2)
- **可能原因**: powerCounters 被重复加了，或者旋转弹头的修正被重复应用了

**测试 2**: 双方各打一张睡眠孢子
- 预期: 4 (5 基础 - 1 睡眠孢子)
- 实际: 3 (少了 1)
- **可能原因**: 睡眠孢子的 -1 被应用了两次，或者基础力量计算错误

---

## 🔧 修复方案

### 方案 1: 检查 powerCounters 是否应该在这里加

**步骤**:
1. 查看 `minion.powerCounters` 的定义和用途
2. 查看其他地方是否已经计算了 `powerCounters`
3. 确认 `powerCounters` 是否应该包含在 `getEffectivePowerBreakdown` 中

**命令**:
```bash
# 查看 powerCounters 的所有使用
grep -rn "powerCounters" src/games/smashup/domain/ | grep -v "test"

# 查看 minion 类型定义
grep -A10 "interface.*Minion" src/games/smashup/domain/types.ts
```

---

### 方案 2: 检查 ongoing 修正是否重复

**步骤**:
1. 在 `getOngoingPowerModifier` 中添加调试日志
2. 运行失败的测试，查看修正被调用了几次
3. 确认是否有重复调用

**调试代码**:
```typescript
export function getOngoingPowerModifier(...) {
    let total = 0;
    const calledModifiers = new Set<PowerModifierFn>();
    
    for (const entry of modifierRegistry) {
        if (calledModifiers.has(entry.modifier)) {
            console.log('[DUPLICATE] Modifier already called:', entry.sourceDefId);
            continue;
        }
        calledModifiers.add(entry.modifier);
        
        const value = entry.modifier(ctx);
        if (value !== 0) {
            console.log('[MODIFIER]', entry.sourceDefId, '→', value);
        }
        total += value;
    }
    
    console.log('[TOTAL]', total);
    return total;
}
```

---

### 方案 3: 更新测试期望值

**如果**:
- 代码逻辑是正确的
- 只是测试期望值过时了

**那么**: 更新测试期望值

**但是**: 需要先确认代码逻辑确实正确，不能盲目更新测试。

---

## 📋 执行清单

### 立即执行

- [ ] 1. 查看 powerCounters 的定义和用途
  ```bash
  grep -A5 "powerCounters" src/games/smashup/domain/types.ts
  ```

- [ ] 2. 查看 powerCounters 的所有使用
  ```bash
  grep -rn "powerCounters" src/games/smashup/domain/ | grep -v "test" | grep -v ".diff"
  ```

- [ ] 3. 添加调试日志到 getOngoingPowerModifier
  ```typescript
  // 在 ongoingModifiers.ts 中添加 console.log
  ```

- [ ] 4. 运行单个测试查看调试输出
  ```bash
  npm test -- ongoingModifiers.test.ts -t "睡眠孢子 + 旋转弹头" 2>&1 | grep -E "MODIFIER|TOTAL|DUPLICATE"
  ```

### 根据结果修复

- [ ] 5a. 如果 powerCounters 重复，移除重复计算
- [ ] 5b. 如果 ongoing 修正重复，添加去重逻辑
- [ ] 5c. 如果逻辑正确，更新测试期望值

### 验证修复

- [ ] 6. 运行所有 ongoingModifiers 测试
  ```bash
  npm test -- ongoingModifiers.test.ts
  ```

- [ ] 7. 运行所有 SmashUp 测试
  ```bash
  npm test -- smashup
  ```

---

## 🎯 下一步

需要我帮你：
1. 查看 powerCounters 的定义和用途？
2. 添加调试日志并运行测试？
3. 直接修复代码？

请告诉我你想先做哪一步。
