# 提交 6ea1f9f 问题修复总结

## 🎯 问题根源

**不是提交 6ea1f9f 引入的 bug**，而是 POD 系统与 ongoing modifier 的交互问题。

### 核心问题

`registerOngoingPowerModifier` 函数内部调用 `registerPowerModifier` 时，**没有传递** `handlesPodInternally: true` 选项，导致：

1. POD 别名系统为所有 ongoing 修正器创建重复注册
2. 修正器被调用两次（原版 + POD）
3. 修正值翻倍

## ✅ 修复方案

### 修复 1: 添加辅助函数

在 `src/games/smashup/abilities/ongoing_modifiers.ts` 中添加：

```typescript
/**
 * 检查随从是否匹配指定的 defId（包括 POD 版本）
 */
function matchesDefId(minion: MinionOnBase, baseDefId: string): boolean {
    return minion.defId === baseDefId || minion.defId === baseDefId + '_pod';
}

/**
 * 计算场上匹配指定 defId 的随从数量（包括 POD 版本）
 */
function countMinionsWithDefId(
    state: SmashUpCore,
    baseDefId: string,
    controller?: PlayerId
): number {
    let count = 0;
    for (const base of state.bases) {
        count += base.minions.filter(
            m => matchesDefId(m, baseDefId) && (controller === undefined || m.controller === controller)
        ).length;
    }
    return count;
}
```

### 修复 2: 修改 `registerOngoingPowerModifier`

在 `src/games/smashup/domain/ongoingModifiers.ts` 中：

```typescript
export function registerOngoingPowerModifier(
    defId: string,
    location: OngoingLocation,
    target: OngoingTarget,
    delta: number,
    condition?: (ctx: PowerModifierContext) => boolean,
): void {
    registerPowerModifier(defId, (ctx: PowerModifierContext) => {
        // 处理 POD 版本：检查基础 defId
        const baseDefId = defId.replace(/_pod$/, '');
        
        if (location === 'minion') {
            // 检查基础版和 POD 版
            const count = ctx.minion.attachedActions.filter(a => 
                a.defId === baseDefId || a.defId === baseDefId + '_pod'
            ).length;
            // ...
        }

        // 附着在基地上
        const cards = ctx.base.ongoingActions.filter(a => 
            a.defId === baseDefId || a.defId === baseDefId + '_pod'
        );
        // ...
    }, { handlesPodInternally: true }); // ✅ 标记已处理 POD
}
```

### 修复 3: 修改 `robot_microbot_fixer`

```typescript
registerPowerModifier('robot_microbot_fixer', (ctx: PowerModifierContext) => {
    if (!isMicrobot(ctx.state, ctx.minion)) return 0;
    // 使用辅助函数计算修理者数量（包括 POD 版本）
    return countMinionsWithDefId(ctx.state, 'robot_microbot_fixer', ctx.minion.controller);
}, { handlesPodInternally: true }); // ✅ 标记
```

### 修复 4: 修改 `ghost_haunting`

```typescript
registerPowerModifier('ghost_haunting', (ctx: PowerModifierContext) => {
    if (!matchesDefId(ctx.minion, 'ghost_haunting')) return 0; // ✅ 使用辅助函数
    const player = ctx.state.players[ctx.minion.controller];
    if (!player) return 0;
    return player.hand.length <= 2 ? 3 : 0;
}, { handlesPodInternally: true }); // ✅ 标记
```

## 📊 修复效果

### 测试结果对比

| 指标 | 修复前 | 修复后 | 改善 |
|------|--------|--------|------|
| 失败测试 | 45 | 19 | ✅ -26 (-58%) |
| ongoingModifiers.test.ts | 21 失败 | 0 失败 | ✅ 100% 通过 |
| POD 别名映射 | 12 个 | 3 个 | ✅ -9 |
| POD 内置支持 | 4 个 | 13 个 | ✅ +9 |

### 日志对比

**修复前**:
```
[POD Power Modifier Aliases] 自动映射 12 个 POD 版本的力量修正，跳过 4 个已内置 POD 支持的修正
```

**修复后**:
```
[POD Power Modifier Aliases] 自动映射 3 个 POD 版本的力量修正，跳过 13 个已内置 POD 支持的修正
```

## 🔍 剩余问题

还有 19 个测试失败，但这些与 ongoing modifier 无关：

1. **审计测试** (6 个)
   - 能力注册完整性
   - 关键词映射一致性
   - ongoing 效果覆盖

2. **特定功能测试** (13 个)
   - `alien_disintegrator` - CARD_TO_DECK_BOTTOM 事件
   - `alien_crop_circles` - D1 审计
   - `base_fairy_ring` - D8/D19 审计
   - `base_central_brain` - 力量修正
   - `bear_cavalry_polar_commando` - 保护
   - 等等...

这些需要单独分析和修复。

## 📝 修复的文件

1. `src/games/smashup/abilities/ongoing_modifiers.ts`
   - 添加辅助函数 `matchesDefId` 和 `countMinionsWithDefId`
   - 修改 `robot_microbot_fixer` 和 `ghost_haunting`

2. `src/games/smashup/domain/ongoingModifiers.ts`
   - 修改 `registerOngoingPowerModifier` 函数
   - 添加 POD 版本检查
   - 添加 `handlesPodInternally: true` 标记

## 🎓 教训

1. **辅助函数的价值**: 创建 `matchesDefId` 和 `countMinionsWithDefId` 大大简化了代码
2. **标记的重要性**: `handlesPodInternally: true` 明确表达设计意图
3. **测试驱动修复**: 测试失败模式帮助快速定位问题
4. **逐步验证**: 修复一个问题后立即运行测试，确认效果

## 🚀 下一步

1. **分析剩余 19 个失败测试**
2. **逐个修复特定功能问题**
3. **更新相关文档**
4. **运行完整测试套件**

## 📂 相关文档

- 本次修复: `tmp/6ea1f9f-final-fix-summary.md`
- 问题分析: `tmp/ongoing-modifier-test-analysis.md`
- 修复计划: `tmp/ongoing-modifier-fix-plan.md`
- 之前的修复: `docs/bugs/power-modifier-pod-duplicate-fix.md`
