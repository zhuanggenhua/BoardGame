# Ongoing Modifier 测试失败修复方案

## 问题确认

**根本原因**: 修正器被重复应用

**证据**:
1. 日志显示：`[POD Power Modifier Aliases] 自动映射 12 个 POD 版本的力量修正`
2. 测试失败模式：实际值 = 预期值 × 1.5 或 × 2
   - `expected 3 to be 2` (多了 1，即 50%)
   - `expected 5 to be 3` (多了 2，即 67%)
   - `expected 9 to be 6` (多了 3，即 50%)

**机制**:
1. `registerPowerModifier('robot_microbot_fixer', ...)` 注册原版修正器
2. `registerPodPowerModifierAliases()` 创建 `robot_microbot_fixer_pod` 别名
3. `getOngoingPowerModifier()` 遍历所有修正器（原版 + POD）
4. 两个修正器都被调用，都计算场上的修理者数量
5. 结果翻倍

## 修复方案

### 方案 A: 修正器内部处理 POD（推荐）✅

修改所有修正器，使其同时检查原版和 POD 版本，并标记 `handlesPodInternally: true`

**优点**:
- 彻底解决问题
- 性能更好（只调用一次）
- 逻辑清晰

**缺点**:
- 需要修改所有修正器（约 12 个）

**实施步骤**:

1. 修改 `src/games/smashup/abilities/ongoing_modifiers.ts` 中的所有修正器
2. 为每个 `defId` 检查添加 POD 版本
3. 添加 `handlesPodInternally: true` 选项

**示例**:

```typescript
// ❌ 修改前
registerPowerModifier('robot_microbot_fixer', (ctx: PowerModifierContext) => {
    if (!isMicrobot(ctx.state, ctx.minion)) return 0;
    let fixerCount = 0;
    for (const base of ctx.state.bases) {
        fixerCount += base.minions.filter(
            m => m.defId === 'robot_microbot_fixer' && m.controller === ctx.minion.controller
        ).length;
    }
    return fixerCount;
});

// ✅ 修改后
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

---

### 方案 B: 创建辅助函数简化修改

创建一个辅助函数来检查 defId（包括 POD 版本）

**优点**:
- 减少重复代码
- 更容易维护

**实施步骤**:

1. 在 `ongoingModifiers.ts` 中添加辅助函数：

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

2. 修改修正器使用辅助函数：

```typescript
registerPowerModifier('robot_microbot_fixer', (ctx: PowerModifierContext) => {
    if (!isMicrobot(ctx.state, ctx.minion)) return 0;
    return countMinionsWithDefId(ctx.state, 'robot_microbot_fixer', ctx.minion.controller);
}, { handlesPodInternally: true });
```

---

### 方案 C: 修改 POD 别名系统（不推荐）

修改 `registerPodPowerModifierAliases()` 使其智能处理 defId 检查

**优点**:
- 不需要修改每个修正器

**缺点**:
- 逻辑复杂
- 可能有副作用
- 难以调试

---

## 推荐方案：方案 B

使用辅助函数简化修改，既减少重复代码，又保持逻辑清晰。

## 需要修改的修正器列表

根据日志 `自动映射 12 个 POD 版本`，需要修改约 12 个修正器：

1. `robot_microbot_fixer` - 微型机修理者
2. `robot_microbot_alpha` - 微型机阿尔法号
3. `dino_armor_stego` - 重装剑龙
4. `dino_war_raptor` - 战争猛禽
5. `ghost_haunting` - 不散阴魂
6. `ghost_door_to_the_beyond` - 通灵之门（ongoing 行动卡）
7. `killer_plant_sleep_spores` - 睡眠孢子（ongoing 行动卡）
8. `steampunk_rotary_slug_thrower` - 旋转弹头发射器（ongoing 行动卡）
9. 其他...（需要查看完整列表）

## 实施计划

1. **创建辅助函数** (5 分钟)
   - 在 `ongoingModifiers.ts` 中添加 `matchesDefId` 和 `countMinionsWithDefId`

2. **修改所有修正器** (30 分钟)
   - 逐个修改，使用辅助函数
   - 添加 `handlesPodInternally: true` 选项

3. **运行测试验证** (5 分钟)
   ```bash
   npm test -- ongoingModifiers.test.ts
   ```

4. **检查日志** (2 分钟)
   - 确认日志显示 `跳过 12 个已内置 POD 支持的修正`（而不是 4 个）

5. **运行完整测试** (10 分钟)
   ```bash
   npm test -- smashup
   ```

## 预期结果

修复后：
- 所有 `ongoingModifiers.test.ts` 测试通过
- 日志显示：`跳过 12 个已内置 POD 支持的修正`
- 不再有修正器被重复应用

## 下一步

开始实施方案 B？
