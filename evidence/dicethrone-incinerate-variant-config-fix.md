# DiceThrone 焚灭技能无法选择 - 变体配置问题

## 问题描述

用户反馈：DiceThrone 游戏中无法选择"焚灭"(Incinerate)技能。

## 技能信息

"焚灭"是火法（Pyromancer）的 Hot Streak II 技能的变体：
- **技能 ID**：`incinerate`
- **基础技能 ID**：`fiery-combo`
- **触发条件**：2火 + 2炽魂（diceSet）
- **优先级**：2（高于 fiery-combo-2 的优先级 1）
- **效果**：
  - 获得 2 FM
  - 施加 1 层燃烧
  - 造成 6 点伤害

## Git 历史分析

### 提交历史

1. **提交 7cb4050**：添加了 `soul-burn-5` 变体，没有修改 `incinerate`
2. **提交 6ea1f9f**：**删除了** `incinerate` 和 `fiery-combo-2` 的 `name` 字段
3. **提交 1c8ca12**：**恢复了** `incinerate` 和 `fiery-combo-2` 的 `name` 字段

### 关键差异

```diff
// 提交 6ea1f9f 删除了 name 字段
{
    id: 'incinerate',
-   name: abilityText('incinerate', 'name'),
    trigger: { type: 'diceSet', faces: { ... } },
    ...
}

// 提交 1c8ca12 恢复了 name 字段
{
    id: 'incinerate',
+   name: abilityText('incinerate', 'name'),
    trigger: { type: 'diceSet', faces: { ... } },
    ...
}
```

## 当前状态

当前代码（提交 1c8ca12）中，`incinerate` 变体的定义是正确的：

```typescript
{
    id: 'incinerate',
    name: abilityText('incinerate', 'name'),
    trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 2, [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 2 } },
    effects: [
        grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('incinerate', 'gainFM2')),
        inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('incinerate', 'inflictBurn')),
        damage(6, abilityEffectText('incinerate', 'damage6'))
    ],
    priority: 2
}
```

## 可能的原因

### 1. `name` 字段缺失（已修复）

提交 6ea1f9f 删除了 `name` 字段，可能导致 UI 无法正确显示技能名称。但提交 1c8ca12 已经恢复了 `name` 字段，所以这个问题应该已经修复。

### 2. 触发条件不满足

如果用户的骰子结果不是"2火 + 2炽魂"，则"焚灭"不会出现在可用技能列表中。需要确认用户的骰子结果是否满足触发条件。

### 3. 自动跳过逻辑（最可能）

如果用户开启了"自动跳过"模式（灰色按钮），响应窗口一打开就会立即跳过，用户根本没有机会选择技能。

## 排查步骤

### 第一步：确认骰子结果

确认用户的骰子结果是否满足"2火 + 2炽魂"的触发条件。

### 第二步：确认响应模式

确认用户是否开启了"自动跳过"模式（灰色按钮）。如果是，需要切换到"手动响应"模式（绿色按钮）。

### 第三步：查看控制台日志

打开浏览器开发者工具（F12），查看控制台是否出现 🔴 标记的自动跳过日志：
- `[Board] 🔴 AUTO-SKIP TRIGGERED (User Mode)` - 用户开启了自动跳过模式
- `[Board] 🔴 AUTO-SKIP TRIGGERED (Offline)` - 响应者离线
- `[Board] 🔴 AUTO-SKIP TRIGGERED (Tutorial)` - 教学模式自动跳过

### 第四步：检查可用技能列表

在控制台中查看 `availableAbilityIds` 是否包含 `'incinerate'`。

## 解决方案

### 如果是自动跳过模式

点击右上角的响应模式切换按钮，从灰色"自动跳过"切换到绿色"手动响应"。

### 如果是触发条件不满足

确认骰子结果是否满足"2火 + 2炽魂"的触发条件。如果不满足，"焚灭"不会出现在可用技能列表中。

### 如果是 name 字段缺失

当前代码已经包含 `name` 字段，无需修改。

## 相关文件

- `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 火法技能定义
- `src/games/dicethrone/domain/rules.ts` - 可用技能计算逻辑
- `src/games/dicethrone/Board.tsx` - 自动跳过逻辑
- `evidence/dicethrone-incinerate-selection-debug.md` - 调试日志文档

## 下一步

等待用户反馈：
1. 骰子结果是什么？
2. 响应模式是什么（绿色"手动响应"还是灰色"自动跳过"）？
3. 控制台是否出现 🔴 标记的日志？
