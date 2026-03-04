# robot_microbot_fixer 修正器修复

## 问题

`robot_microbot_fixer` 修正器被 POD 别名系统重复注册，导致修正值翻倍。

## 当前实现

```typescript
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
// ❌ 没有标记 handlesPodInternally: true
// ❌ 只检查 'robot_microbot_fixer'，不检查 POD 版本
```

## 问题分析

1. POD 别名系统创建了 `robot_microbot_fixer_pod` 的别名
2. 两个修正器都被调用（原版 + POD）
3. 两个修正器都计算场上的修理者数量
4. 结果翻倍

## 修复方案

### 选项 1: 标记 + 修改检查逻辑（推荐）

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
}, { handlesPodInternally: true }); // ✅ 标记
```

### 选项 2: 使用 baseId 模式

```typescript
registerPowerModifier('robot_microbot_fixer', (ctx: PowerModifierContext) => {
    if (!isMicrobot(ctx.state, ctx.minion)) return 0;
    let fixerCount = 0;
    for (const base of ctx.state.bases) {
        fixerCount += base.minions.filter(m => {
            const baseId = m.defId.replace(/_pod$/, '');
            return baseId === 'robot_microbot_fixer' && m.controller === ctx.minion.controller;
        }).length;
    }
    return fixerCount;
}, { handlesPodInternally: true }); // ✅ 标记
```

## 需要修复的其他修正器

根据测试失败情况，以下修正器也需要同样的修复：

1. `ghost_haunting` - 不散阴魂
2. `ghost_door_to_the_beyond` - 通灵之门
3. `killer_plant_sleep_spores` - 睡眠孢子
4. `steampunk_rotary_slug_thrower` - 旋转弹头发射器
5. 其他未标记的修正器...

## 实施步骤

1. 修改 `src/games/smashup/abilities/ongoing_modifiers.ts`
2. 为所有未标记的修正器添加 POD 检查
3. 添加 `handlesPodInternally: true` 标记
4. 运行测试验证

## 预期结果

修复后日志应显示：
```
[POD Power Modifier Aliases] 自动映射 0 个 POD 版本的力量修正，跳过 16 个已内置 POD 支持的修正
```

所有测试通过 ✅
