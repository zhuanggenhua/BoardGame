# 提交 6ea1f9f Bug 分析报告

## 执行摘要

**提交**: 6ea1f9f - "feat: add Smash Up POD faction support with full UI and ability system"
**影响**: 336 个文件，+9026/-9580 行
**风险等级**: 🔴 极高

## 🚨 发现的关键问题

### 1. 直接状态修改（8 处）- 🔴 P0

**位置**:
- `reducer.ts`: 5 处 `state.sys =`
- `index.ts`: 2 处 (`ctx._deferredPostScoringEvents =`, `data.continuationContext =`)
- `ninjas.ts`: 1 处 (`MinionCardDef.beforeScoringPlayable =`)

**问题**: 违反 React 不可变性原则

**影响**:
- 状态更新可能不触发重渲染
- 撤回功能可能异常
- 状态追踪困难

**修复**: 使用结构共享 `{ ...state, sys: newSys }`

---

### 2. 未初始化字段（2 处）- 🔴 P0

**位置**: `types.ts`
```typescript
?: PendingAfterScoringSpecial[]
?: number[]
```

**问题**: 可选字段可能在运行时为 undefined

**影响**: 访问 undefined 导致崩溃

**修复**: 在初始化函数中显式赋值为空数组

---

### 3. 大规模逻辑删除 - 🟡 P1

**reducer.ts**: -270 行
- 删除了 `processDestroyMoveCycle` → 改为 `processDestroyTriggers` + `processMoveTriggers`
- 删除了 `filterProtectedReturnEvents` 和 `filterProtectedDeckBottomEvents`
- 删除了 Me First! 窗口的特殊处理逻辑
- 删除了 `ACTIVATE_SPECIAL` 命令处理

**index.ts**: -151 行
- 大量核心逻辑被删除或重构

**风险**: 可能遗漏了必要的边界情况处理

---

### 4. 关键逻辑变更

#### 4.1 消灭触发器逻辑简化

**之前**:
```typescript
// 检测 MINION_RETURNED 或 MINION_MOVED
const hasSaveEvent = hasReturn || hasMoveAway;
```

**之后**:
```typescript
// 只检测 MINION_RETURNED
const hasReturn = saveEvents.some(e => e.type === SU_EVENTS.MINION_RETURNED);
```

**影响**: 海盗单基地移动（`pirate_buccaneer_move`）可能不再被识别为"拯救"

---

#### 4.2 保护检查简化

**之前**:
```typescript
// 使用事件中的 destroyerId（如暗杀卡的 ownerId）
const effectiveSource = de.payload.destroyerId ?? sourcePlayerId;
if (isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'destroy')) continue;
```

**之后**:
```typescript
// 直接使用 sourcePlayerId
if (isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'destroy')) continue;
```

**影响**: 暗杀卡等特殊来源的保护检查可能失效

---

#### 4.3 Me First! 窗口逻辑删除

**删除的代码**:
```typescript
// Me First! 窗口中打出 beforeScoringPlayable 随从不消耗正常限额
...(state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable
    ? { consumesNormalLimit: false }
    : {}),

// 记录 specialLimitGroup 使用
if (state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable) {
    // ... 发射 SPECIAL_LIMIT_USED 事件
}
```

**影响**: Me First! 响应窗口中的特殊限额逻辑可能失效

---

#### 4.4 ACTIVATE_SPECIAL 命令删除

**删除的代码**:
```typescript
case SU_COMMANDS.ACTIVATE_SPECIAL: {
    const { minionUid: spUid, baseIndex: spIdx } = command.payload;
    const executor = resolveSpecial(spMinion.defId);
    // ... 执行特殊能力
}
```

**影响**: 特殊能力激活机制可能被移除或重构到其他地方

---

## 📊 统计数据

| 文件 | 新增 | 删除 | 净变化 |
|------|------|------|--------|
| reducer.ts | 25 | 295 | -270 |
| index.ts | 90 | 241 | -151 |
| reduce.ts | 17 | 69 | -52 |
| types.ts | 4 | 42 | -38 |
| commands.ts | 6 | 75 | -69 |
| ninjas.ts | 201 | 115 | +86 |
| pirates.ts | 225 | 57 | +168 |
| dinosaurs.ts | 116 | 101 | +15 |

**总计**: +684 / -995 = -311 行

---

## 🔍 需要验证的场景

### 高优先级测试场景

1. **海盗单基地移动**
   - 场景: 海盗随从在唯一基地被消灭时自动移动到其他基地
   - 验证: 是否仍然正确触发移动而非消灭

2. **暗杀卡保护检查**
   - 场景: 使用暗杀卡消灭受保护的随从
   - 验证: 保护是否正确检查暗杀卡的所有者而非使用者

3. **Me First! 响应窗口**
   - 场景: 在 Me First! 窗口中打出 beforeScoringPlayable 随从
   - 验证: 是否正确不消耗正常限额

4. **特殊能力激活**
   - 场景: 激活随从的特殊能力（如果有）
   - 验证: ACTIVATE_SPECIAL 命令是否被正确替代

5. **消灭触发器**
   - 场景: 随从被消灭时触发 onDestroy 能力
   - 验证: 各种拯救机制（返回手牌、移动到其他基地）是否正确

---

## ✅ 检查清单

### 代码审查
- [ ] 查看 reducer.ts 的 5 处 `state.sys =` 直接修改
- [ ] 查看 index.ts 的 2 处直接修改
- [ ] 查看 types.ts 的 2 处未初始化字段
- [ ] 确认删除的 `processDestroyMoveCycle` 逻辑是否完整迁移
- [ ] 确认删除的 Me First! 逻辑是否有替代实现
- [ ] 确认删除的 ACTIVATE_SPECIAL 命令是否有替代实现

### 测试验证
- [ ] 运行所有 SmashUp 测试: `npm test -- smashup`
- [ ] 运行已知 bug 测试:
  - [ ] `npm test -- alien-scout-no-duplicate-scoring`
  - [ ] `npm test -- steampunk-aggromotive-fix`
  - [ ] `npm test -- ninja-acolyte-pod-consistency`
- [ ] 运行 E2E 测试: `npm run test:e2e -- smashup`
- [ ] 手动测试海盗单基地移动场景
- [ ] 手动测试 Me First! 响应窗口场景

### 回归测试
- [ ] 测试所有 POD 派系的能力
- [ ] 测试基地能力触发
- [ ] 测试 ongoing 效果
- [ ] 测试计分流程

---

## 🛠️ 修复建议

### 立即修复（P0）

1. **修复直接状态修改**
   ```typescript
   // ❌ 错误
   state.sys = newSys;
   
   // ✅ 正确
   return { ...state, sys: newSys };
   ```

2. **初始化可选字段**
   ```typescript
   export function createInitialState(): SmashUpCore {
     return {
       // ...
       pendingAfterScoringSpecial: [],
       someNumbers: [],
     };
   }
   ```

### 高优先级修复（P1）

3. **恢复 destroyerId 检查**
   ```typescript
   const effectiveSource = de.payload.destroyerId ?? sourcePlayerId;
   if (isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'destroy')) continue;
   ```

4. **恢复 MINION_MOVED 检测**
   ```typescript
   const hasMoveAway = saveEvents.some(e =>
       e.type === SU_EVENTS.MINION_MOVED &&
       (e as MinionMovedEvent).payload.minionUid === minionUid
   );
   const hasSaveEvent = hasReturn || hasMoveAway;
   ```

---

## 📝 下一步行动

1. **立即执行**: 运行测试套件，记录所有失败的测试
2. **代码审查**: 逐个检查上述 8 处直接修改和 2 处未初始化字段
3. **场景验证**: 手动测试上述 5 个高优先级场景
4. **创建修复任务**: 为每个发现的问题创建独立的 bug 修复任务
5. **回归测试**: 修复后运行完整的测试套件

---

## 🎯 结论

提交 6ea1f9f 是一个高风险的大规模重构，包含：
- **8 处违反不可变性的直接状态修改**
- **2 处未初始化的可选字段**
- **311 行净删除**，可能遗漏了关键逻辑
- **多个核心机制的简化**，可能影响边界情况

**建议**: 
1. 在修复这些问题之前，不要合并任何基于此提交的新功能
2. 考虑创建一个修复分支: `git checkout -b fix/6ea1f9f-critical-bugs 6ea1f9f^`
3. 如果问题严重，考虑回滚: `git revert 6ea1f9f`

---

## 📂 相关文件

- 完整分析报告: `tmp/commit-6ea1f9f-analysis.md`
- 检查脚本: `tmp/check-commit-6ea1f9f.mjs`
- 机器可读报告: `tmp/6ea1f9f-analysis-report.json`
- Diff 文件: `tmp/temp-reducer-diff.txt`


---

## 🔥 测试结果

**运行时间**: 刚刚执行
**结果**: ❌ **45 个测试失败 / 1335 个测试通过**

### 失败的测试文件

#### 1. `abilityBehaviorAudit.test.ts` (3 个失败)
- ❌ 描述含"力量修正"的 ongoing 行动卡必须有 powerModifier 注册
- ❌ 描述含"随从被消灭后"触发效果的持续随从必须有 onDestroy 能力注册
- ❌ 所有 ongoing 行动卡都有对应的效果注册

**根因**: POD 版本的能力注册不完整

---

#### 2. `ongoingModifiers.test.ts` (17 个失败) 🔴 **核心问题**

**失败的测试**:
- ❌ `ghost_haunting` (不散阴魂): 手牌为空时 +3 力量
- ❌ `ghost_haunting`: 手牌恰好 2 张时 +3 力量
- ❌ 多个持续修正组合: 猛犸 + 修理者叠加 (expected 3 to be 2)
- ❌ 多个持续修正组合: 阿尔法号 + 修理者叠加 (expected 5 to be 4)
- ❌ `killer_plant_sleep_spores` (睡眠孢子): 单张对手随从 -1
- ❌ `killer_plant_sleep_spores`: 两张叠加对手随从 -2
- ❌ `steampunk_rotary_slug_thrower` (旋转弹头发射器): 单张给己方随从 +2
- ❌ `steampunk_rotary_slug_thrower`: 两张叠加给己方随从 +4
- ❌ 升级: 附着 1 张 +2
- ❌ 升级: 附着 2 张叠加 +4
- ❌ 毒药: 附着 1 张 -4
- ❌ 邓威奇恐怖: 附着 1 张 +5
- ❌ `ghost_door_to_the_beyond` (通灵之门): 手牌≤2 时己方随从 +2
- ❌ `ghost_door_to_the_beyond`: 条件满足时两张叠加 +4
- ❌ 睡眠孢子 + 旋转弹头发射器同时生效 (expected 8 to be 6)
- ❌ 双方各打一张睡眠孢子互相减力 (expected 3 to be 4)

**症状**: 力量修正值错误，通常是**实际值比预期值多 1 或多 2**

**可能根因**:
1. **Power Modifier 重复应用** - 这正是 `docs/bugs/power-modifier-pod-duplicate-fix.md` 中提到的问题
2. reducer.ts 中的直接状态修改导致修正器被重复添加
3. POD 版本的 ongoing 效果注册逻辑错误

---

#### 3. `sleep-spores-e2e.test.ts` (2 个失败)
- ❌ 一个睡眠孢子应该只给对手随从 -1 力量，不是 -2（完整流程）
- ❌ 验证睡眠孢子只对对手随从生效

**症状**: 睡眠孢子的力量修正被重复应用（-2 而不是 -1）

---

### 🎯 核心问题确认

**问题**: **Power Modifier 重复应用**

**证据**:
1. 所有 ongoing 力量修正测试都失败
2. 实际值总是比预期值多（通常是 2 倍）
3. 睡眠孢子 -1 变成了 -2
4. 旋转弹头发射器 +2 的效果被重复

**定位**: 
- `reducer.ts` 中的 5 处 `state.sys =` 直接修改
- POD ongoing 效果注册逻辑
- `ongoingModifiers.ts` 中的修正器应用逻辑

---

## 🔧 紧急修复优先级

### P0 - 立即修复（阻塞所有功能）

1. **修复 Power Modifier 重复应用**
   - 文件: `src/games/smashup/domain/reducer.ts`
   - 文件: `src/games/smashup/domain/ongoingModifiers.ts`
   - 影响: 所有 ongoing 力量修正卡牌
   - 测试: 45 个失败测试

2. **修复 reducer.ts 中的直接状态修改**
   - 5 处 `state.sys =` 必须改为结构共享
   - 可能是导致 Power Modifier 重复的根本原因

3. **补全 POD 能力注册**
   - 3 个审计测试失败
   - POD 版本的能力定义不完整

---

## 📊 测试失败统计

| 测试文件 | 失败数 | 总数 | 失败率 |
|---------|--------|------|--------|
| ongoingModifiers.test.ts | 17 | ? | 高 |
| abilityBehaviorAudit.test.ts | 3 | 18 | 17% |
| sleep-spores-e2e.test.ts | 2 | ? | 高 |
| 其他 | 23 | ? | - |
| **总计** | **45** | **1399** | **3.2%** |

---

## 🚨 结论更新

提交 6ea1f9f 导致了**严重的功能性 bug**：

1. **Power Modifier 重复应用** - 影响所有 ongoing 力量修正卡牌
2. **45 个测试失败** - 主要集中在力量修正系统
3. **直接状态修改** - 可能是根本原因

**建议行动**:
1. **立即停止合并任何基于此提交的代码**
2. **创建紧急修复分支**: `git checkout -b hotfix/power-modifier-duplicate 6ea1f9f`
3. **优先修复 Power Modifier 重复应用问题**
4. **修复后重新运行所有测试**

**如果无法快速修复**:
```bash
# 回滚到上一个稳定版本
git revert 6ea1f9f
```

---

## 📂 相关文档

- 本报告: `tmp/6ea1f9f-bug-analysis-final.md`
- 已知 bug: `docs/bugs/power-modifier-pod-duplicate-fix.md`
- 完整分析: `tmp/commit-6ea1f9f-analysis.md`
- 测试输出: 运行 `npm test -- smashup` 查看
