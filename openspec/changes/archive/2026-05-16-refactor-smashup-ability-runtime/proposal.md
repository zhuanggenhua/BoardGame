# Change: 重构 Smash Up 声明式能力运行时

## Why
`0b50a89c` 已经把 Smash Up 的 reaction / scoring / response window 主链收束到 resolution frame。下一步如果还继续沿用：

- `registerAbility(...)` 直接返回原始事件；
- 能力内部直接 `queueInteraction(...)`；
- 交互后续靠 `registerInteractionHandler(...) + continuationContext` 串接；
- trigger/base ability 通过“有就执行，没有就静默吞掉”的 executor 注册表兜底；

那么项目只是在新的 frame 主链旁边保留了一整套历史私有流程引擎，技术债反而更深。

当前真实问题已经说明这条路不能继续：

- “是否值得弹排序选择”不能靠零散卡旁标记和临时特判收口；
- `reactionSession` 里仍有大量业务层排序、候选刷新、交互续链逻辑；
- trigger executor 缺失时会静默跳过，属于错误吞没；
- `queueInteraction + handler + continuationContext` 让能力语义散在多处，无法证明“这个能力到底会读写什么、会不会改合法结算结果、会不会打开新交互”。

因此本轮不是补修，而是把 Smash Up 能力执行内核改成**基于 resolution frame 的声明式能力程序**，并禁止继续新增旧出口。

## What Changes
- 新增 `smashup-ability-runtime` capability，定义 Smash Up 能力必须产出声明式 `ability program`，而不是直接操纵交互队列或返回任意事件数组。
- 把 Smash Up 运行时最小原语固定为四类：
  - `effects`
  - `prompts`
  - `flow`（branch / sequence / stop）
  - `system bridges`（reaction / scoring / replacement / duel / titan / deferred follow-up）
- 明确 `resolution frame` 是能力程序的唯一业务 owner：
  - prompt 绑定 frame；
  - prompt 恢复回同一 frame；
  - deferred follow-up 挂在 frame；
  - ability program 不得再依赖第二套 continuation 主链。
- 旧出口列为禁止新增：
  - 新能力不得直接 `queueInteraction(...)`
  - 新能力不得直接注册 `registerInteractionHandler(...)`
  - trigger/base queued execution 不得在 executor 缺失时静默成功
- 本轮只先重构**运行时 contract 与集中入口**：
  - trigger executor registry
  - base ability queued trigger
  - reaction queue 执行入口
  - ability runtime 类型 / 解释器骨架
- 高复杂能力的逐张迁移不在本 proposal 一次性列完，但迁移方向必须是“迁进新 runtime”，而不是再写兼容旁路。

## Impact
- Affected specs:
  - `smashup-ability-runtime`（新增）
  - `interaction-system`
  - `systems-layer`
- Affected code:
  - `src/games/smashup/domain/reactionSession.ts`
  - `src/games/smashup/domain/triggerExecutors.ts`
  - `src/games/smashup/domain/baseAbilityQueue.ts`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/abilityInteractionHandlers.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/__tests__/**`

