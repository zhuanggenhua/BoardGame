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

### 生命周期必须数据驱动（强制）

持续行动卡的到期时机、归属角色和到期动作必须写在行动卡定义的 `lifecycle` 合同中，由 ongoing 运行时统一注册 `perInstance` 触发器。能力回调不得通过固定卡牌 ID 扫描全场、按同名牌批量删除，或把普通版 ID 当作生命周期判断。

```typescript
{
    id: 'time_travelers_stasis_field',
    subtype: 'ongoing',
    lifecycle: {
        expires: { timing: 'onTurnStart', actor: 'sourceController', effect: 'detach', destination: 'discard' },
    },
}
```

运行时始终按触发来源实例 UID 执行；因此普通版与 POD 版规则一致时可共享同一生命周期实现，规则不一致时必须在 POD 数据中显式声明自己的 `lifecycle` 或明确不声明，不能依赖隐式 ID 合并。
`destination: 'hand'` 可用于规则要求到期回到真实拥有者手牌的持续牌（例如剪羊毛）；未声明时默认进入弃牌堆。

生命周期声明只负责生成强制的回合边界触发，不改变 Smash Up 的结算交互：同一时点只有一条生命周期触发时自动结算；同一时点有多条强制触发时，仍进入 reaction queue，由当前玩家选择顺序。排序资源从实际到期事件推导，不能用空资源合同把多条触发错误地收口为自动执行。

**选择性覆盖**：
```typescript
// 如果 POD 版需要不同的能力，显式注册即可
// 自动映射会跳过已注册的 POD 版本
registerRestriction('zombie_overrun_pod', 'play_minion', zombieOverrunRestriction);
// 仅非生命周期的规则差异需要显式注册；生命周期由卡牌数据合同统一注册
```

### Modifier / ongoing 变体语义（强制）

- **POD 变体默认是“继承或显式覆盖”，不是补充一层效果。**
- 若基础版与 POD 版规则完全一致，可走共享 alias。
- 若规则函数内部已经自己区分基础版 / POD，必须标记为自管变体；框架不得再补第二份 `_pod` alias。
- 若基础版有该 ongoing、POD 明确没有，则必须标记为仅基础版；POD 不得继承该规则，且 `_pod` 也不得在 modifier 审计里冒充“已注册”。
- **POD 绝不能反向影响原版。** 显式 `_pod` 注册只覆盖 POD 目标，不得让基础版多吃一层规则。

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

- 当前主源：本文负责 POD 运行时合同、新增卡牌最低要求和基地策略。
- 架构补充：`docs/games/smashup/refactor/pod/pod-system-architecture.md` 负责架构理由、注册层约束、数据审计和选择性覆盖示例。
- 历史记录：`docs/games/smashup/refactor/pod/pod-auto-mapping.md`、`pod-stub-cleanup.md`、`pod-system-summary.md` 只记录历史实现、修复和测试，不作为当前规则正文。
## POD 基地策略（骨架阶段）

- 当选择 `*_pod` 阵营时，选基只使用 `base_*_pod` 变体，不混入基础版 `base_*`。
- 当前采用“骨架先行”：由基础基地自动克隆 POD 基地骨架，复制 `breakpoint`、`vpAwards`、限制与能力相关字段，只把 `id/faction` 加 `_pod` 后缀。
- 软过渡规则：如果某个 POD 阵营基地不足 2 张，补足时也只从 POD 变体池补，不回退基础版基地。
- 后续手工录入正式 POD 基地后，可用同名 `base_*_pod` 定义覆盖骨架数据。
> 2026-03-19 补充：`base_*_pod` 会自动复用 `base_*` 的基地能力注册，并同步支持 reaction queue 执行路径。

> 2026-03-19 行为修正补充（POD 同步生效）：
> - `Field of Honor`（含 `_pod`）：改为“每回合你第一次在此消灭另一位玩家的随从时”才得 1VP。
> - `Tsar's Palace`（含 `_pod`）：仅当你在该基地“严格领先每位其他玩家”时，才可打出力量 `<=2` 的随从。
> - `R'lyeh`（含 `_pod`）：交互只发起消灭；1VP 在“消灭实际成立”后结算，若被保护/替代导致未消灭则不加分。
