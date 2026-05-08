# Change: Refactor Smash Up base ability effect contract enforcement

## Why

当前 Smash Up 的 trigger effect contract 已覆盖普通 trigger 路径，但 queued base ability / extended base ability 仍存在未纳入同一硬约束的缺口。结果是：

- 一部分基地能力即使没有声明 `effectContract`，仍能进入 queued reaction 流程；
- 一部分会打开真实交互的基地能力没有显式声明 `opensInteraction`；
- 结算顺序系统会被不精确或缺失的基地能力 footprint 污染，继续把本不该排序的基地能力拉进 `smashup_reaction_choose`。

用户要求是“先声明，再使用；未声明直接报错；不留兼容兜底”。因此必须把基地能力路径也提升到与普通 trigger 相同的声明式硬约束。

## What Changes

- 对 queued base ability / extended base ability 增加与普通 trigger 一致的 effect contract 强制校验与运行时守卫
- 禁止缺少 `effectContract` 的基地能力进入 reaction queue
- 禁止会打开交互的基地能力缺少 `opensInteraction: true`
- 补齐现有 Smash Up 基地能力的 `reads/writes/opensInteraction` 声明，确保只有真实冲突才会触发排序选择

## Impact

- Affected specs:
  - `smashup-trigger-effect-contract`
  - `smashup-reaction-ordering`
- Affected code:
  - `src/games/smashup/domain/baseAbilityQueue.ts`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `src/games/smashup/abilities/ancient_egyptians.ts`
  - `src/games/smashup/abilities/cowboys.ts`
  - `src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts`
  - `src/games/smashup/__tests__/reactionQueueOrdering.test.ts`
  - `src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts`
