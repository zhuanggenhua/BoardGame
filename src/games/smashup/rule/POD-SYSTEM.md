# 大杀四方 POD 系统说明

## 什么是 POD？

POD (Print-on-Demand) 版本是大杀四方的最新英文版卡牌。POD 版本的卡牌 ID 带有 `_pod` 后缀（如 `ninja_acolyte_pod`），派系 ID 也带有 `_pod` 后缀（如 `ninjas_pod`）。

## 架构设计

### 数据层：完整定义，不继承

**POD 版本的卡牌数据必须完整定义所有字段，不自动继承基础版。**

**位置**：`src/games/smashup/data/factions/<faction>_pod.ts`

**示例**：
```typescript
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

### 能力层：自动映射 + 选择性覆盖

**POD 版本的能力注册自动从基础版复制，除非显式覆盖。**

**位置**：`src/games/smashup/abilities/index.ts`

**自动映射**：
```typescript
registerPodAbilityAliases();           // 自动映射 ability
registerPodInteractionAliases();       // 自动映射 interaction handler
registerPodOngoingAliases();           // 自动映射 trigger/restriction/protection
registerPodPowerModifierAliases();     // 自动映射力量修正
```

**选择性覆盖**：
```typescript
// 如果 POD 版需要不同的能力，显式注册即可
// 自动映射会跳过已注册的 POD 版本
registerRestriction('zombie_overrun_pod', 'play_minion', zombieOverrunRestriction);
registerTrigger('zombie_overrun_pod', 'onTurnStart', zombieOverrunSelfDestruct);
```

## 新增 POD 卡牌

### 1. 数据定义（必须）

在 `src/games/smashup/data/factions/<faction>_pod.ts` 中完整定义所有字段。

### 2. 能力注册（按需）

- **与基础版相同**：不需要任何代码，自动映射会处理
- **与基础版不同**：在 `src/games/smashup/abilities/<faction>.ts` 中显式注册

### 3. 验证（必须）

```bash
# 运行数据一致性审计
node scripts/audit-pod-data-consistency.mjs

# 运行测试
npm run test
```

## 数据一致性审计

**脚本**：`scripts/audit-pod-data-consistency.mjs`

**检查项**：
- power（力量值）
- abilityTags（能力标签）
- specialLimitGroup（special 限制组）
- beforeScoringPlayable（计分前可打出）
- ongoingTarget（ongoing 目标类型）
- subtype（行动卡子类型）

**运行**：
```bash
node scripts/audit-pod-data-consistency.mjs
```

## 常见问题

### Q: 为什么数据层不自动映射？

**A**: POD 版本可能与基础版卡名相同但效果完全不同，无法自动判断哪些字段应该继承。完整定义更清晰、更安全。

### Q: 如果 POD 版与基础版完全相同，还要重复定义吗？

**A**: 是的。虽然看起来重复，但这是为了避免歧义和保持一致性。

### Q: 能力注册会自动映射，为什么数据不会？

**A**: 能力注册是按 `defId` 索引的，可以精确控制是否覆盖。数据定义是卡牌的完整描述，无法判断哪些字段应该继承。

## 相关文档

- `docs/refactor/pod-system-architecture.md` - POD 系统架构详细说明
- `docs/refactor/pod-auto-mapping.md` - 能力自动映射系统设计
- `docs/refactor/pod-system-summary.md` - POD 系统完整修复总结
