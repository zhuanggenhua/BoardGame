# Ongoing Modifier 测试失败分析

## 问题根源

测试失败的根本原因是：**POD 版本的卡牌与原版卡牌共享同一个 power modifier 注册**

### 当前实现逻辑

1. `registerPowerModifier('robot_microbot_fixer', ...)` 注册修正器
2. `getOngoingPowerModifier()` 遍历**所有注册的修正器**
3. 修正器内部检查场上是否有 `defId === 'robot_microbot_fixer'` 的随从

### 问题场景

当场上有 POD 版本的修理者（`robot_microbot_fixer_pod`）时：

1. 修正器注册表中有 `robot_microbot_fixer` 的修正器
2. 修正器被调用，检查场上 `defId === 'robot_microbot_fixer'` 的随从
3. **找不到**（因为场上是 `robot_microbot_fixer_pod`）
4. 返回 0

但是，如果 POD 系统创建了别名注册：

1. 修正器注册表中有 `robot_microbot_fixer` 和 `robot_microbot_fixer_pod` 两个修正器
2. 两个修正器都被调用
3. 第一个修正器检查 `defId === 'robot_microbot_fixer'`（找不到）
4. 第二个修正器检查 `defId === 'robot_microbot_fixer_pod'`（找到了）
5. **但是第一个修正器可能也在计算场上的修理者数量时重复计算了 POD 版本**

## 测试失败模式

### 模式 1: 实际值 > 预期值

```
expected 3 to be 2  // 实际 3，预期 2，多了 1
expected 5 to be 3  // 实际 5，预期 3，多了 2
expected 9 to be 6  // 实际 9，预期 6，多了 3
```

**原因**: 修正器被重复应用（原版 + POD 版本）

### 模式 2: 实际值 < 预期值

```
expected 3 to be 4  // 实际 3，预期 4，少了 1
expected 1 to be 3  // 实际 1，预期 3，少了 2
```

**原因**: 修正器检查的 defId 不匹配（场上是 POD 版本，但修正器检查原版）

## 解决方案

### 方案 1: 修正器内部处理 POD 版本（推荐）

修改修正器实现，使其同时检查原版和 POD 版本：

```typescript
registerPowerModifier('robot_microbot_fixer', (ctx: PowerModifierContext) => {
    if (!isMicrobot(ctx.state, ctx.minion)) return 0;
    
    let fixerCount = 0;
    for (const base of ctx.state.bases) {
        fixerCount += base.minions.filter(
            m => (m.defId === 'robot_microbot_fixer' || m.defId === 'robot_microbot_fixer_pod') 
                && m.controller === ctx.minion.controller
        ).length;
    }
    return fixerCount;
}, { handlesPodInternally: true }); // 标记已处理 POD
```

**优点**:
- 修正器逻辑清晰
- 不会重复计算
- 性能更好（只调用一次）

**缺点**:
- 需要修改每个修正器

### 方案 2: POD 别名系统自动处理

在 POD 别名创建时，自动修改修正器的 defId 检查逻辑：

```typescript
// 在 POD 别名创建时
if (entry.handlesPodInternally) {
    // 跳过，修正器已经内部处理了 POD
} else {
    // 创建 POD 版本的修正器
    registerPowerModifier(podDefId, (ctx) => {
        // 将 ctx.minion.defId 临时替换为原版 defId
        const originalDefId = ctx.minion.defId;
        ctx.minion.defId = baseDefId;
        const result = originalModifier(ctx);
        ctx.minion.defId = originalDefId;
        return result;
    });
}
```

**优点**:
- 不需要修改每个修正器
- 自动化处理

**缺点**:
- 逻辑复杂
- 可能有副作用

### 方案 3: 测试使用原版卡牌

修改测试，使用原版卡牌而非 POD 版本：

```typescript
const fixer = makeMinion('fixer', 'robot_microbot_fixer', '0', 1, { powerModifier: 0 });
// 而不是 'robot_microbot_fixer_pod'
```

**优点**:
- 最简单
- 不需要修改实现

**缺点**:
- 没有测试 POD 版本
- 不是真正的修复

## 当前状态检查

需要检查以下内容：

1. **POD 别名是否被创建？**
   - 查看 `initAllAbilities()` 是否创建了 POD 别名
   - 查看 `modifierRegistry` 中是否有重复的修正器

2. **修正器是否标记了 `handlesPodInternally`？**
   - 查看 `registerPowerModifier` 调用是否传递了此选项

3. **测试使用的是原版还是 POD 版本？**
   - 查看测试中的 `makeMinion` 调用

## 下一步行动

1. **检查 POD 别名创建逻辑**
   ```bash
   grep -r "handlesPodInternally" src/games/smashup/
   ```

2. **检查修正器注册**
   ```bash
   grep -A10 "registerPowerModifier.*robot_microbot_fixer" src/games/smashup/
   ```

3. **运行单个测试并打印调试信息**
   ```bash
   npm test -- ongoingModifiers.test.ts -t "修理者在场时己方微型机"
   ```

4. **添加调试日志**
   ```typescript
   export function getOngoingPowerModifier(...) {
       console.log('modifierRegistry.length:', modifierRegistry.length);
       console.log('modifierRegistry:', modifierRegistry.map(e => e.sourceDefId));
       // ...
   }
   ```
