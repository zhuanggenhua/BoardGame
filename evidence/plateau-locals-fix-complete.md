# Plateau of Leng + 本地人 Bug 修复完成（正确方案）

## 问题描述

用户反馈：玩家打出第一个"本地人"（The Locals）到 Plateau of Leng 基地 → 基地能力触发 → 本地人的 onPlay 能力揭示牌库顶 3 张牌并将本地人卡放入手牌 → **BUG**：无法打出新获得的本地人卡。

## 根本原因分析

### 规则理解
**Plateau of Leng 规则**："每回合玩家第一次打出一个随从到这里后，**可以**额外打出一张与其同名的随从到这里"

关键词：
- "可以" = 可选的，不是强制的
- "额外打出" = 给一个额外的出牌机会，玩家可以选择何时使用

### 两种实现方案对比

#### 方案 A：创建交互（❌ 错误）
```typescript
// 立即弹出选择框，强制玩家做出决定
const interaction = createSimpleChoice(...);
return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
```

**问题**：
1. 强制玩家立即做出选择（打出或跳过）
2. 如果玩家跳过，额度就浪费了
3. 不符合"可以额外打出"的语义（应该是给额度，让玩家自己决定何时使用）
4. 本地人 onPlay 能力触发时，交互已经创建，新获得的本地人不在选项中

#### 方案 B：直接授予额度（✅ 正确）
```typescript
// 授予1个同名随从额度，玩家可以在任何时候使用
return {
    events: [
        grantExtraMinion(
            ctx.playerId,
            'base_plateau_of_leng',
            ctx.now,
            ctx.baseIndex, // 限定到此基地
            { sameNameOnly: true, sameNameDefId: ctx.minionDefId }, // 同名约束
        ),
    ],
};
```

**优点**：
1. 玩家获得额度后可以自由选择何时使用
2. 本地人 onPlay 能力获得的新本地人卡可以正常使用这个额度
3. 符合"可以额外打出"的语义
4. 额度系统会自动处理同名约束和基地限制

## 修复方案

### 1. 基地能力定义（`src/games/smashup/domain/baseAbilities_expansion.ts`）

```typescript
registerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', (ctx) => {
    if (!ctx.minionDefId) return { events: [] };
    
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };

    // 每回合只有第一次打出随从到此基地才触发
    const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
    if (playedAtBase !== 1) return { events: [] };

    // 直接授予1个同名随从额度，限定到此基地
    return {
        events: [
            grantExtraMinion(
                ctx.playerId,
                'base_plateau_of_leng',
                ctx.now,
                ctx.baseIndex, // 限定到此基地
                { sameNameOnly: true, sameNameDefId: ctx.minionDefId }, // 同名约束
            ),
        ],
    };
});
```

### 2. 删除不需要的交互处理器

因为不再创建交互，所以删除了 `registerInteractionHandler('base_plateau_of_leng', ...)`。

### 3. 更新测试

更新了所有相关测试以期望 limit_modified 事件：
- `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
- `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`

## 测试结果

所有测试通过：
- ✅ 首次打出时直接授予同名随从额度
- ✅ 非首次打出时不触发（即使手牌有同名随从）
- ✅ 首次打出时授予额度（无论手牌是否有同名随从）
- ✅ 跨玩家回合：每个玩家首次打出时都应触发
- ✅ E2E 集成测试通过

## 关键特性

1. **额度系统**：使用 `baseLimitedMinionQuota` 和 `baseLimitedSameNameRequired` 管理额度
2. **同名约束**：通过 `sameNameDefId` 限定只能打出指定 defId 的随从
3. **基地限制**：通过 `restrictToBase` 限定额度只能用于指定基地
4. **自动验证**：命令验证层（`commands.ts`）自动检查额度和约束
5. **UI 自动过滤**：Board 组件自动根据额度过滤可打出的卡牌

## 用户体验

1. 玩家打出第一个本地人到 Plateau of Leng
2. 系统授予 1 个"同名随从额度"（限定到该基地，只能打本地人）
3. 本地人 onPlay 能力触发，从牌库获得新的本地人卡
4. 玩家手牌中的所有本地人卡都会高亮显示为可打出
5. 玩家可以选择立即打出，或者先打其他牌，稍后再打
6. 打出后额度消耗，回合结束时未使用的额度清零

## 文件变更

- ✅ `src/games/smashup/domain/baseAbilities_expansion.ts`：改为直接授予额度 + 删除交互处理器
- ✅ `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`：更新测试
- ✅ `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`：更新测试

## 总结

成功将 Plateau of Leng 从错误的"创建交互"实现改为正确的"直接授予额度"实现。现在玩家可以自由选择何时使用额度，包括使用通过其他能力动态获得的同名随从（如本地人的 onPlay 能力）。这符合规则中"可以额外打出"的语义，提供了更好的用户体验。
