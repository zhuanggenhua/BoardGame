# POD 系统架构与最佳实践

## 概述

POD (Print-on-Demand) 版本是大杀四方的最新英文版卡牌。本文档说明 POD 系统的架构设计、数据管理和能力注册机制。

## 核心原则

### 1. 数据层：完整定义，不继承

**POD 版本的卡牌数据必须完整定义所有字段，不自动继承基础版。**

**原因**：
- POD 版本可能与基础版**卡名相同但效果完全不同**
- 无法自动判断哪些字段应该继承，哪些不应该
- 完整定义更清晰、更易维护

**示例**：
```typescript
// 基础版
{
    id: 'ninja_acolyte',
    type: 'minion',
    name: '忍者侍从',
    faction: 'ninjas',
    power: 2,
    abilityTags: ['special'],
    specialLimitGroup: 'ninja_acolyte',
    count: 4,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 15 },
}

// POD 版（完整定义，不继承）
{
    id: 'ninja_acolyte_pod',
    type: 'minion',
    name: '忍者侍从',
    faction: 'ninjas_pod',
    power: 2,
    abilityTags: ['special'],
    specialLimitGroup: 'ninja_acolyte',
    count: 4,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 15 },
}
```

### 2. 能力层：自动映射 + 选择性覆盖

**POD 版本的能力注册（trigger/restriction/protection/ability/interaction）自动从基础版复制，除非显式覆盖。**

**原因**：
- 大部分 POD 卡与基础版能力相同，自动映射避免代码重复
- 能力注册按 `defId` 索引，可以精确控制是否覆盖
- 符合 DRY 原则，减少维护成本

**自动映射机制**：
```typescript
// 在 src/games/smashup/abilities/index.ts 中
registerPodAbilityAliases();           // 自动映射 ability
registerPodInteractionAliases();       // 自动映射 interaction handler
registerPodOngoingAliases();           // 自动映射 trigger/restriction/protection
registerPodPowerModifierAliases();     // 自动映射力量修正（跳过已内置 POD 支持的）
```

**力量修正的特殊处理**：

力量修正系统支持两种模式：

1. **自动映射模式（默认）**：修正函数精确匹配 `defId`，POD 版本由自动映射创建
   ```typescript
   registerPowerModifier('ghost_haunting', (ctx) => {
       if (ctx.minion.defId !== 'ghost_haunting') return 0;
       // ...
   });
   // POD 版本自动创建：ghost_haunting_pod
   ```

2. **内置 POD 支持模式**：修正函数内部处理 POD 版本，不需要自动映射
   ```typescript
   registerPowerModifier('steampunk_steam_man', (ctx) => {
       const baseId = ctx.minion.defId.replace(/_pod$/, '');
       if (baseId !== 'steampunk_steam_man') return 0;
       // ...
   }, { handlesPodInternally: true }); // 标记：已内置 POD 支持
   // 自动映射会跳过此函数
   ```

**何时使用内置 POD 支持**：
- POD 版本与基础版行为不同（如 `dino_armor_stego_pod` 需要 `talentUsed` 标记）
- 需要在函数内部区分 POD 版本和基础版本

**当前使用内置 POD 支持的修正**：
- `dino_armor_stego` - POD 版需要 talentUsed 才生效
- `dino_war_raptor` - 需要统计基础版和 POD 版的总数
- `robot_microbot_alpha` - 需要统计基础版和 POD 版的总数
- `steampunk_steam_man` - 需要统计基础版和 POD 版的总数

**选择性覆盖**：
```typescript
// 如果 POD 版需要不同的能力，显式注册即可
// 自动映射会跳过已注册的 POD 版本

// 示例：zombie_overrun_pod 有不同的能力
registerRestriction('zombie_overrun_pod', 'play_minion', zombieOverrunRestriction);
registerTrigger('zombie_overrun_pod', 'onTurnStart', zombieOverrunSelfDestruct);
// 自动映射会检测到已注册，跳过 zombie_overrun_pod
```

## 架构对比

| 层级 | 基础版 | POD 版 | 映射方式 |
|------|--------|--------|----------|
| **数据定义** | 完整定义 | 完整定义 | ❌ 不自动映射 |
| **能力注册** | 显式注册 | 自动映射 + 选择性覆盖 | ✅ 自动映射 |

## 为什么不统一？

### 为什么数据层不自动映射？

**问题**：POD 版本可能与基础版卡名相同但效果完全不同

**示例场景**：
```typescript
// 基础版：Ninja Acolyte - 力量 2，special 能力
{ id: 'ninja_acolyte', power: 2, abilityTags: ['special'] }

// POD 版：Ninja Acolyte - 力量 3，talent 能力（假设）
{ id: 'ninja_acolyte_pod', power: 3, abilityTags: ['talent'] }
```

如果自动继承，无法判断：
- `power` 应该继承吗？（可能不同）
- `abilityTags` 应该继承吗？（可能不同）
- `specialLimitGroup` 应该继承吗？（可能不同）

**结论**：数据层必须完整定义，避免歧义。

### 为什么能力层可以自动映射？

**关键**：能力注册是按 `defId` 索引的，可以精确控制

**工作原理**：
1. 基础版注册：`registerTrigger('ninja_acolyte', 'afterScoring', callback)`
2. 自动映射检查：POD 版 `ninja_acolyte_pod` 是否已注册？
3. 如果未注册 → 自动复制：`registerTrigger('ninja_acolyte_pod', 'afterScoring', callback)`
4. 如果已注册 → 跳过（保留显式覆盖）

**优势**：
- 90% 的 POD 卡能力相同 → 自动映射，0 行代码
- 10% 的 POD 卡能力不同 → 显式注册，覆盖自动映射

## 数据一致性保证

### 问题

手动维护 POD 数据时，容易出现不一致：
- 忘记同步某个字段（如 `specialLimitGroup`）
- 字段值写错（如 `abilityTags: ['talent']` 应该是 `['special']`）

### 解决方案：审计脚本

**脚本**：`scripts/audit-pod-data-consistency.mjs`

**功能**：
- 检查所有 POD 版本与基础版的数据定义是否一致
- 检查字段：`power`、`abilityTags`、`specialLimitGroup`、`beforeScoringPlayable`、`ongoingTarget`、`subtype`
- 输出不一致的卡牌和字段

**运行**：
```bash
node scripts/audit-pod-data-consistency.mjs
```

**输出示例**：
```
🔍 开始 POD 数据一致性审计...

✅ 检查完成：共检查 70 张 POD 卡牌

❌ 发现 2 个不一致问题：

📦 ninjas (2 个问题):
  ❌ ninja_acolyte_pod (minion)
     字段: abilityTags
     基础版: ["special"]
     POD 版: ["talent"]
  ❌ ninja_acolyte_pod (minion)
     字段: specialLimitGroup
     基础版: "ninja_acolyte"
     POD 版: undefined
```

### CI 集成（推荐）

将审计脚本集成到 CI 流程：

```json
// package.json
{
  "scripts": {
    "audit:pod": "node scripts/audit-pod-data-consistency.mjs",
    "test:ci": "npm run audit:pod && npm run test"
  }
}
```

## 新增 POD 卡牌的工作流

### 1. 数据定义（必须）

在 `src/games/smashup/data/factions/<faction>_pod.ts` 中完整定义：

```typescript
{
    id: 'new_card_pod',
    type: 'minion',
    name: '新卡牌',
    nameEn: 'New Card',
    faction: 'faction_pod',
    power: 3,
    abilityTags: ['onPlay'],
    count: 4,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 20 },
}
```

**检查清单**：
- ✅ 所有必需字段都已定义
- ✅ 与基础版对比，确认字段值正确
- ✅ 运行审计脚本验证

### 2. 能力注册（按需）

**情况 A：与基础版能力相同**
- ✅ 不需要任何代码
- ✅ 自动映射会处理

**情况 B：与基础版能力不同**
- ✅ 在 `src/games/smashup/abilities/<faction>.ts` 中显式注册
- ✅ 自动映射会跳过已注册的 POD 版本

```typescript
// 示例：POD 版有不同的能力
registerAbility('new_card_pod', 'onPlay', newCardPodOnPlay);
registerInteractionHandler('new_card_pod_choice', newCardPodChoiceHandler);
```

### 3. 验证（必须）

```bash
# 1. 运行审计脚本
node scripts/audit-pod-data-consistency.mjs

# 2. 运行测试
npm run test

# 3. 启动游戏验证
npm run dev
```

## 常见问题

### Q1: 为什么 POD 版数据要完整定义？不能简化吗？

**A**: 不能。POD 版本可能与基础版卡名相同但效果完全不同，无法自动判断哪些字段应该继承。完整定义更清晰、更安全。

### Q2: 如果 POD 版与基础版完全相同，还要重复定义吗？

**A**: 是的。虽然看起来重复，但这是为了：
1. 避免歧义（未来 POD 版可能改变）
2. 保持一致性（所有 POD 卡都用相同的定义方式）
3. 类型安全（TypeScript 会检查所有字段）

### Q3: 能力注册会自动映射，为什么数据不会？

**A**: 因为能力注册是按 `defId` 索引的，可以精确控制是否覆盖。数据定义是卡牌的完整描述，无法判断哪些字段应该继承。

### Q4: 如何知道 POD 版需要显式注册能力？

**A**: 
1. 查看卡牌描述，判断效果是否与基础版不同
2. 运行游戏测试，验证能力是否正确触发
3. 如果能力不生效，检查是否需要显式注册

### Q5: 审计脚本报告不一致，但我确认 POD 版就是要不同，怎么办？

**A**: 这是正常的。审计脚本只是提醒你检查，不是强制要求一致。如果 POD 版确实需要不同的字段值，忽略审计报告即可。

## 相关文档

- `docs/refactor/pod-auto-mapping.md` - POD 能力自动映射系统设计
- `docs/refactor/pod-stub-cleanup.md` - POD stub 清理（历史问题）
- `docs/bugs/ninja-acolyte-pod-ability-tags-fix.md` - Ninja Acolyte 数据不一致修复案例
- `scripts/audit-pod-data-consistency.mjs` - 数据一致性审计脚本

## 总结

| 方面 | 策略 | 原因 |
|------|------|------|
| **数据定义** | 完整定义，不继承 | POD 版可能完全不同，避免歧义 |
| **能力注册** | 自动映射 + 选择性覆盖 | 90% 相同，10% 不同，DRY 原则 |
| **一致性保证** | 审计脚本 | 自动检查，避免人为错误 |
| **新增卡牌** | 数据必须完整，能力按需注册 | 清晰、安全、易维护 |
