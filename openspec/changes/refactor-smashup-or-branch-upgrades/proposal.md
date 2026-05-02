# Change: Refactor Smash Up OR Branch Upgrades

## Why

Smash Up 当前已经有多处“选择 A 或 B 效果”的能力实现，但这些实现把 `OR` 分支语义、Titan 升级语义、后续目标选择交互和一次性额度消耗都硬编码在单卡 handler 中。  
当 `Spirit of the Forest` 这类效果需要把 `OR` 升级为“可两边都做，且顺序由玩家控制”时，真实需要的是：

1. 先选本次要执行哪个分支
2. 先执行该分支
3. 若升级仍可继续，再给一次“剩余分支 + 跳过”

如果把它误实现成“一次性 ordered multi 编号多选”，就会把分支选择、分支内部目标选择和升级消费时机混在一起，导致语义漂移和 UI 误导。

## What Changes

- 为 Smash Up 新增统一的 branching choice / OR 能力 builder，而不是继续在单卡里手写分支 prompt
- 为 branching OR 能力新增 upgrade provider 介入点，用于把“单分支 OR”升级为“首分支执行后可继续剩余分支”
- 明确 `both parts in any order` 在 Smash Up OR 语义里表现为 **串行补选**，而不是一次性 ordered multi
- 让分支内部目标选择与 OR 分支选择严格分离，避免 Titania 这类能力把“回手哪个随从”与“额外打出一个随从”混成同一步
- 保证升级消费只在玩家真的选择第二个剩余分支时发生；若 follow-up 选择跳过，则不消费升级
- 作为配套共享能力，补齐 generic `simple-choice` 的 ordered multi 保序契约，供其他真正需要“按选择顺序提交”的场景使用；但 **Smash Up OR 主链路不再依赖一次性 ordered multi prompt**
- 将 Fairies 中第一批 `OR` 能力迁移到统一抽象，作为首批验证对象

## Impact

- Affected specs:
  - `interaction-system`
  - `game-ai-system`
  - `smashup-or-branch-upgrades`
- Affected code:
  - `src/engine/systems/InteractionSystem.ts`
  - `src/games/smashup/domain/**`
  - `src/games/smashup/abilities/fairies.ts`
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
