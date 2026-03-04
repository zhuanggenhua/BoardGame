# 6ea1f9f 反向分析：你已经修复了什么

## 发现

你已经**恢复了 6ea1f9f 删除的大部分关键代码**！这说明 6ea1f9f 确实删除了必要的逻辑，而你通过后续提交修复了这些问题。

---

## 已恢复的关键代码

### 1. ✅ 恢复了 `processDestroyMoveCycle`

**6ea1f9f 的修改**:
```typescript
// 删除了循环处理
const afterDestroy = processDestroyTriggers(...);
const afterMove = processMoveTriggers(afterDestroy.events, ...);
```

**你的修复**:
```typescript
// 恢复了循环处理，直到稳定
const afterDestroyMove = processDestroyMoveCycle(events, state, ...);
```

**为什么需要**: 消灭和移动触发器可能相互触发，需要循环处理直到稳定。

---

### 2. ✅ 恢复了保护过滤函数

**6ea1f9f 删除了**:
- `filterProtectedReturnEvents` - 返回手牌保护过滤
- `filterProtectedDeckBottomEvents` - 放入牌库底保护过滤

**你的修复**:
```typescript
const afterReturn = filterProtectedReturnEvents(afterDestroyMove.events, state.core, command.playerId);
const afterDeckBottom = filterProtectedDeckBottomEvents(afterReturn, state.core, command.playerId);
```

**为什么需要**: 某些卡牌（如 `deep_roots`、`entangled`、`ghost_incorporeal`）有特殊保护，防止被返回手牌或放入牌库底。

---

### 3. ✅ 恢复了 Me First! 窗口逻辑

**6ea1f9f 删除了**:
```typescript
// Me First! 窗口中打出 beforeScoringPlayable 随从不消耗正常限额
...(state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable
    ? { consumesNormalLimit: false }
    : {}),

// 记录 specialLimitGroup 使用
if (state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable) {
    events.push({ type: SU_EVENTS.SPECIAL_LIMIT_USED, ... });
}
```

**你的修复**: 完全恢复了这段逻辑

**为什么需要**: Me First! 响应窗口中的特殊限额逻辑是游戏规则的一部分。

---

### 4. ✅ 恢复了 ACTIVATE_SPECIAL 命令

**6ea1f9f 删除了**: 整个 `ACTIVATE_SPECIAL` 命令处理

**你的修复**: 恢复了这个命令

**为什么需要**: 某些随从有特殊能力需要激活。

---

### 5. ✅ 恢复了 CardToDeckBottomEvent

**6ea1f9f 删除了**: `CardToDeckBottomEvent` 类型导入

**你的修复**: 重新导入了这个类型

**为什么需要**: 某些卡牌效果需要将卡牌放入牌库底。

---

### 6. ✅ 增强了防御性初始化

**你的改进**:
```typescript
// 处理测试环境可能传递裸 core 的情况
if (!(state as any).core) {
    state = { core: state as any, sys: { interaction: { queue: [] } } as any };
}
// 确保 sys 和 sys.interaction 存在
if (!state.sys) {
    state = { ...state, sys: { interaction: { queue: [] } } as any };
} else if (!state.sys.interaction) {
    state = { ...state, sys: { ...state.sys, interaction: { queue: [] } } };
}
```

**为什么需要**: 测试环境可能传递不完整的状态对象。

---

### 7. ✅ 修复了 Power Modifier 重复应用

**问题**: POD 别名系统为已内置 POD 支持的修正函数创建了重复注册

**你的修复**: 
- 添加了 `handlesPodInternally` 标记
- POD 别名系统跳过已标记的函数
- 详见 `docs/bugs/power-modifier-pod-duplicate-fix.md`

---

## 当前测试失败分析

### 为什么还有 45 个测试失败？

虽然你已经恢复了大部分代码，但仍有测试失败。让我分析原因：

#### 1. ongoingModifiers.test.ts (17 个失败)

**可能原因**:
- ✅ Power Modifier 重复应用已修复（`handlesPodInternally`）
- ❓ 但测试仍然失败，说明可能有其他地方的重复逻辑
- ❓ 或者测试本身需要更新

**需要检查**:
```bash
# 运行单个测试查看详细错误
npm test -- ongoingModifiers.test.ts -t "睡眠孢子" --reporter=verbose

# 检查 ongoingModifiers.ts 的当前实现
git diff 6ea1f9f HEAD -- src/games/smashup/domain/ongoingModifiers.ts
```

---

#### 2. abilityBehaviorAudit.test.ts (3 个失败)

**失败的测试**:
- ❌ 描述含"力量修正"的 ongoing 行动卡必须有 powerModifier 注册
- ❌ 描述含"随从被消灭后"触发效果的持续随从必须有 onDestroy 能力注册
- ❌ 所有 ongoing 行动卡都有对应的效果注册

**可能原因**: POD 版本的能力注册不完整

**需要检查**:
```bash
# 查看哪些 POD 能力缺失注册
npm test -- abilityBehaviorAudit.test.ts --reporter=verbose
```

---

## 下一步行动

### 1. 运行详细测试

```bash
# 查看 ongoingModifiers 测试的详细错误
npm test -- ongoingModifiers.test.ts --reporter=verbose > tmp/ongoing-test-output.txt

# 查看 abilityBehaviorAudit 测试的详细错误
npm test -- abilityBehaviorAudit.test.ts --reporter=verbose > tmp/audit-test-output.txt
```

### 2. 检查 ongoingModifiers.ts 的变更

```bash
git diff 6ea1f9f HEAD -- src/games/smashup/domain/ongoingModifiers.ts > tmp/ongoing-full-diff.txt
```

### 3. 对比测试期望值

可能需要更新测试的期望值，因为：
- POD 系统的引入可能改变了某些行为
- 你的修复可能改变了某些计算逻辑

---

## 总结

### ✅ 你已经做得很好

1. 识别了 6ea1f9f 删除的关键代码
2. 恢复了大部分必要的逻辑
3. 修复了 Power Modifier 重复应用问题
4. 增强了防御性初始化

### ❓ 还需要解决

1. 为什么 ongoingModifiers 测试仍然失败？
   - 可能是测试期望值需要更新
   - 可能是还有其他重复逻辑
   
2. 为什么 abilityBehaviorAudit 测试失败？
   - 可能是 POD 能力注册不完整

### 🎯 建议

不要假设 6ea1f9f 一定错误，而是：
1. 运行详细测试，查看具体错误信息
2. 对比期望值和实际值
3. 判断是代码问题还是测试问题
4. 针对性修复

需要我帮你运行详细测试并分析吗？
