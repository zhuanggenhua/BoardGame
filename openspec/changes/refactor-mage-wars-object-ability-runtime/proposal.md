# Change: 重构法师战争能力运行时边界

## Why
Mage Wars 的法术能力已经进入引擎 `AbilityRegistry`，但魔物、装备和法师相关的主动能力仍在 `validate.ts` / `execute.ts` 里按 `abilityId` 写分支；同时法术能力目录、配置能力目录和执行器注册表之间缺少明确同步合同。两法师流程已经跑通后，继续扩展全派系能力前需要先把能力定义、验证和执行入口收敛，避免后续每张牌继续堆硬编码。

## What Changes
- 为首批预设法术能力补执行器注册同步测试，确保配置 ability catalog、法术能力注册表和执行器注册表一致。
- 为 Mage Wars 场上对象主动能力建立游戏层能力定义注册表和执行器注册表，继续复用 `engine/primitives/ability.ts`。
- 首批迁移流程相关或代表性能力：兽王的群兽法杖、女祭司体系的治疗之光，以及移动/牺牲/绑定类对象能力的注册合同。
- 让 `USE_ARENA_OBJECT_ABILITY` 通过注册表查询能力、验证能力约束并分发执行器，减少顶层 `abilityId` 分支。
- 保留现有事件、状态字段和 UI 布局，不在本 change 中重写 buff/tag 存储或视觉交互。
- 将仍未迁移到 TagContainer/ModifierStack 的状态字段记录为后续能力债务，不把两法师 MVP 扩大成全量 Mage Wars。

## Impact
- Affected specs: `mage-wars`
- Affected code:
  - `src/games/mage-wars/domain/abilityCatalog.ts`
  - `src/games/mage-wars/domain/validate.ts`
  - `src/games/mage-wars/domain/execute.ts`
  - `src/games/mage-wars/domain/ids.ts`
  - `src/games/mage-wars/__tests__/ability-catalog.test.ts`
  - `src/games/mage-wars/__tests__/domain-flow.test.ts`

## Scope Boundary
本 change 只做 Mage Wars 游戏层能力运行时边界，不修改共享引擎、不重做 UI、不录入全 322 张法术、不完成所有派系能力。完成口径是：首批预设法术和对象能力可以通过注册表被发现、验证和执行，未知能力 fail-close，并且现有两法师流程不回退。
