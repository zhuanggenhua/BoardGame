# Card07 宫廷卫士 - abilityId 显式传递修复完成

## 修复内容

### 1. 修改 `CardiaInteraction` 接口
**文件**：`src/games/cardia/domain/interactionHandlers.ts`

为所有交互接口添加 `abilityId` 字段：
- `CardSelectionInteraction`
- `FactionSelectionInteraction`
- `ModifierSelectionInteraction`

```typescript
export interface FactionSelectionInteraction {
    type: 'faction_selection';
    interactionId: string;
    abilityId: string;  // ← 新增：能力 ID（用于查找交互处理器）
    playerId: PlayerId;
    title: string;
    description: string;
}
```

### 2. 修改工厂函数
**文件**：`src/games/cardia/domain/interactionHandlers.ts`

为所有工厂函数添加 `abilityId` 参数：
- `createCardSelectionInteraction(interactionId, abilityId, playerId, ...)`
- `createFactionSelectionInteraction(interactionId, abilityId, playerId, ...)`
- `createModifierSelectionInteraction(interactionId, abilityId, playerId, ...)`

### 3. 修改 `wrapCardiaInteraction` 函数
**文件**：`src/games/cardia/domain/systems.ts`

使用显式的 `abilityId` 而不是从 `interactionId` 提取：

```typescript
// 修改前（隐式提取）
sourceId: cardiaInteraction.interactionId.replace(/_\d+$/, ''),

// 修改后（显式传递）
sourceId: cardiaInteraction.abilityId,
```

### 4. 修改所有交互创建调用
**涉及文件**：
- `src/games/cardia/domain/abilities/group2-modifiers.ts`（6处）
- `src/games/cardia/domain/abilities/group5-copy.ts`（3处）
- `src/games/cardia/domain/abilities/group7-faction.ts`（2处）

**修改示例**（Court Guard）：
```typescript
// 修改前
const interaction = createFactionSelectionInteraction(
    `${ctx.abilityId}_${ctx.timestamp}`,
    ctx.playerId,
    '选择派系',
    '...'
);

// 修改后
const interaction = createFactionSelectionInteraction(
    `${ctx.abilityId}_${ctx.timestamp}`,
    ctx.abilityId,  // ← 显式传递 abilityId
    ctx.playerId,
    '选择派系',
    '...'
);
```

## 修改统计

- **接口修改**：3个接口
- **工厂函数修改**：3个函数
- **调用点修改**：11处
  - group2-modifiers.ts：6处（Surgeon, Judge, Mediator, Clockmaker x2, Court Guard）
  - group5-copy.ts：3处（Copycat, Spy, Forger）
  - group7-faction.ts：2处（Ambusher, Witch King）
- **系统层修改**：1处（wrapCardiaInteraction）

## 设计原则

### 显式优于隐式
- **修改前**：依赖 `interactionId` 的格式约定（`"${abilityId}_${timestamp}"`），通过正则表达式提取 `abilityId`
- **修改后**：显式传递 `abilityId` 字段，不依赖字符串格式

### 优势
1. **类型安全**：`abilityId` 是接口的必需字段，编译期检查
2. **可维护性**：不依赖隐式约定，代码意图清晰
3. **健壮性**：不会因 `interactionId` 格式变化而失效
4. **可调试性**：可以直接查看 `abilityId` 的值，不需要解析字符串

## 编译检查

所有修改的文件都通过了 TypeScript 编译检查：
- ✅ `src/games/cardia/domain/interactionHandlers.ts`
- ✅ `src/games/cardia/domain/systems.ts`
- ✅ `src/games/cardia/domain/abilities/group2-modifiers.ts`
- ✅ `src/games/cardia/domain/abilities/group5-copy.ts`
- ✅ `src/games/cardia/domain/abilities/group7-faction.ts`

## 测试状态

**当前状态**：测试仍然失败，`modifierTokens` 数组仍然为空。

**可能原因**：
1. 交互处理器没有被调用（`sourceId` 仍然不匹配）
2. 交互处理器被调用但返回了空事件
3. 事件被返回但没有被 reduce
4. 状态没有正确同步到客户端

**下一步**：需要添加更详细的日志来追踪完整的事件流，确定问题的根本原因。

## 相关文档

- `CARD07-ROOT-CAUSE-FOUND.md`：测试环境隔离问题
- `CARD07-NEXT-STEPS.md`：详细的调试计划
- `CARD07-DEBUG-SUMMARY.md`：之前的调试总结
