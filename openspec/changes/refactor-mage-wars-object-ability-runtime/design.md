## Context

当前 Mage Wars 已经具备两层能力实现：

- 法术卡能力：`abilityCatalog.ts` 用 `createAbilityRegistry` 注册 91 张预设法术，并由 `spellAbilityExecutors.ts` 的执行器注册表分发。
- 场上对象主动能力：蓝色精怪、阿希拉牧师、灰衣天使、群兽法杖和元素魔杖仍由 `validate.ts` / `execute.ts` 直接按 `abilityId` 分支。

后一类能力横跨多个派系和牌型。若继续按 ID 分支扩展，后续兽王、女祭司、巫师、邪术师和扩展法师都会把验证、消耗、目标、结算散落在同一命令分支里。

## Goals

- 建立 Mage Wars 游戏层对象能力定义注册表，承载来源、行动速度、费用、目标模式、代码支持状态和扩展元数据。
- 建立对象能力执行器注册表，`execute.ts` 只负责构造上下文并调用执行器。
- 让 `validate.ts` 通过能力定义先做通用存在性和 fail-close，再按能力定义委托验证。
- 首批保留现有事件语义和测试行为不变。

## Non-Goals

- 不修改 `engine/primitives/ability.ts` 或能力约束系统 API。
- 不把 `statusTokens`、`temporaryTraits`、`abilityUseRoundNumbers` 一次性迁移成 `TagContainer` / `ModifierStack`。
- 不改变既定 Board/UI 布局，也不新增截图验收。
- 不承诺全量法术、自由构筑、四人模式或完整 AI。

## Decisions

### Decision: 游戏层注册表先接管主动能力入口

对象主动能力先落在 Mage Wars 游戏层，而不是升级共享引擎。原因是这些能力仍依赖 Mage Wars 的区域、行动阶段、魔力、魔物类型、装备附着和现有事件。共享引擎只提供注册表和执行器原语。

### Decision: 定义注册表覆盖全部已知对象能力

本 change 的注册表必须覆盖当前 `MAGE_WARS_OBJECT_ABILITY_IDS` 中全部 ID，即使首批只迁移部分执行逻辑。这样后续能力缺口会在注册表里显式暴露，而不是在 `validate` / `execute` 里靠漏分支发现。

### Decision: 首批执行迁移优先覆盖两法师和代表机制

首批执行器至少覆盖群兽法杖和治疗之光，分别代表装备主动能力与魔物主动治疗能力。若迁移成本可控，同步覆盖蓝色精怪、灰衣天使和元素魔杖，减少同一命令的旧分支残留。

## Risks / Trade-offs

- 风险：一次迁移所有对象能力会影响现有领域测试。缓解：保持事件 payload 不变，先补注册表完整性测试，再跑 Mage Wars 定向 Vitest。
- 风险：`temporaryTraits` 和 `statusTokens` 仍是旧字段。缓解：本 change 只消除能力入口硬编码，状态原语迁移单列后续 debt，不用半迁移造成双真相。
- 风险：装备能力来源规则比魔物能力复杂。缓解：能力定义记录 `sourceKind`，验证上下文仍可使用现有 `spellRules` helper。

## Migration Plan

1. 新增 Mage Wars 对象能力定义、注册表、执行器上下文和注册表完整性测试。
2. 将 `validateArenaObjectAbility` 改为通过定义和验证器分发，未知能力 fail-close。
3. 将 `USE_ARENA_OBJECT_ABILITY` 执行改为通过执行器分发，保留既有事件行为。
4. 跑 Mage Wars 定向单测和 OpenSpec 校验。
