## Rollout Inventory

本文件记录 `refactor-domain-object-provenance-model` 的跨游戏 rollout 盘点结果，用于指导后续批次迁移。

它不是游戏规则文档，也不表示这些游戏已经完成迁移；它只回答三件事：

- 哪些游戏已经开始迁移
- 哪些游戏仍存在高风险 provenance / deferred seam
- 后续应按什么批次推进，而不是继续散点热修

## 当前完成态

- 已落地的底层 seam：
  - engine 统一 `sessionContext`
  - SmashUp 统一 `objectRef / provenance` 第一批
  - SmashUp 统一 `deferredSnapshot` 第一批
- 已验证的范围：
  - 仅 engine seam 与 SmashUp 首批 family
- 未完成的范围：
  - 其余游戏尚未迁移到统一 provenance / deferred contract

## 粗粒度热区

以下统计只用于 rollout 优先级，不代表精确需求规模：

| 游戏 | cross-boundary 热区文件数 | deferred/UI 热区文件数 | 结论 |
| --- | ---: | ---: | --- |
| `smashup` | 237 | 158 | 已开始迁移，仍是最大存量 |
| `dicethrone` | 44 | 61 | deferred/UI 风险最高 |
| `summonerwars` | 49 | 18 | 对象生命周期风险最高 |
| `cardia` | 49 | 18 | 中等规模，但事件/交互自足性较弱 |
| `tictactoe` | 0 | 1 | watchlist |
| `qidahen` | 0 | 0 | 暂无明显信号 |
| `splendor` | 0 | 0 | 暂无明显信号 |

## 4.1 跨边界对象事件盘点

### 已开始迁移：SmashUp

- 第一批已改到统一 seam：跨区转移、来源对象不可见时的重建、默认终点按 provenance 结算。
- 后续仍需继续把剩余 family 收口，但不再属于“零起点游戏”。

### 第一优先级：SummonerWars

风险不是单个字段，而是棋盘单位、附着事件卡、附着单位、临时控制权与销毁归区同时存在。

- `BoardUnit` 直接同时承载 `owner`、`originalOwner`、`attachedCards`、`attachedUnits`
  - 见 `src/games/summonerwars/domain/types.ts:123`
- `CONTROL_TRANSFERRED` 只改 `owner`，临时控制时额外写 `originalOwner`
  - 见 `src/games/summonerwars/domain/reduce.ts:738`
- `UNIT_DESTROYED` 归区时依赖 `destroyedOwner ?? foundUnit.owner`，并同时分发本体、附着单位、附着事件卡
  - 见 `src/games/summonerwars/domain/reduce.ts:325`
- `UNIT_ATTACHED` / `EVENT_ATTACHED` 把原对象从棋盘转成宿主上的附着投影
  - 见 `src/games/summonerwars/domain/reduce.ts:648`
  - 见 `src/games/summonerwars/domain/reduce.ts:793`
- `MIND_CAPTURE_REQUESTED` / `CONTROL_TRANSFERRED` / `SOUL_TRANSFER_REQUESTED` / `GRAB_FOLLOW_REQUESTED` 把后续归约依赖分散在多条事件链里
  - 见 `src/games/summonerwars/domain/execute.ts:570`
  - 见 `src/games/summonerwars/domain/customActionHandlers.ts:48`
  - 见 `src/games/summonerwars/domain/execute.ts:256`

结论：

- SummonerWars 是下一批 provenance primitive 的首要迁移对象。
- 需要把 `board unit / attached event / attached unit / temporary control` 提升到统一 `ObjectRef + ProvenanceSnapshot` 语义，而不是继续靠 `owner/originalOwner/position` 组合猜。

### 第二优先级：Cardia

Cardia 没有明显“控制权转移”，但有稳定卡牌身份跨容器、跨遭遇历史、跨延迟结算反复重建的问题。

- `CardInstance` 只有 `uid / defId / ownerId`，缺少独立 provenance 或默认终点语义
  - 见 `src/games/cardia/domain/core-types.ts:25`
- `CARD_REPLACED` 仅靠 `oldCardId / newCardId / playerId / encounterIndex` 驱动替换，reducer 再从 `playedCards / hand / encounterHistory` 反查
  - 见 `src/games/cardia/domain/reduce.ts:964`
- 替换后胜负与印戒转移依赖当前历史遭遇与 live modifier 重新计算
  - 见 `src/games/cardia/domain/reduce.ts:1010`
  - 见 `src/games/cardia/domain/reduce.ts:1235`
- `DelayedEffect` / `DelayedEffectTriggered` 仅保存 `effectType / target / sourcePlayerId / condition`
  - 见 `src/games/cardia/domain/core-types.ts:138`
  - 见 `src/games/cardia/domain/events.ts:384`

结论：

- Cardia 的主要风险是“对象跨容器与跨遭遇历史时，事件不自足、结算依赖 live 查找”。
- 应把 `card replacement / delayed effect target / encounter-history card ref` 收到统一对象引用模型。

### 第三优先级：DiceThrone

DiceThrone 的 cross-boundary 风险主要不是棋盘对象，而是状态/token 在玩家间迁移时仍使用弱事件协议。

- `TRANSFER_STATUS` 命令只包含 `fromPlayerId / toPlayerId / statusId`
  - 见 `src/games/dicethrone/domain/commands.ts:181`
- `InteractionDescriptor.transferConfig` 只约束 `sourcePlayerId / statusId`
  - 见 `src/games/dicethrone/domain/core-types.ts:281`
- `execute.ts` 在归约时重新读取源玩家当前 status/token 栈并决定如何迁移
  - 见 `src/games/dicethrone/domain/execute.ts:744`

结论：

- DiceThrone 的 provenance 问题比 SummonerWars/Cardia 轻，但仍属于“业务层提供弱参数，底层现查 live state”的家族。
- 适合作为第二批或第三批的 value-object 收口对象，不应继续扩散新的 `from/to/statusId` 变体。

### 当前不进首批的游戏

- `qidahen`、`splendor`：当前未发现足够强的 cross-boundary 对象事件信号。
- `tictactoe`：无对象生命周期复杂度，不进入本 change 的首批 rollout。

## 4.2 deferred interaction / snapshot / payload-driven UI 盘点

### 已开始迁移：SmashUp

- 第一批已把部分 afterScoring / extra play 链路收口到 `deferredSnapshot`。
- 仍有大量历史交互待继续分批迁移，但方向已经明确。

### 第一优先级：DiceThrone

DiceThrone 的主要风险是 choice family 很深，当前仍大量依赖 `currentChoiceSourceAbilityId`、payload 选项形状和 core 上的 pending state 联动。

- `DiceThroneCore` 直接暴露 `currentChoiceSourceAbilityId`、`pendingDamage`、`pendingBonusDiceSettlement`
  - 见 `src/games/dicethrone/domain/core-types.ts:588`
- `CHOICE_REQUESTED` payload 直接承载 `compareRoll`、slider、options 形状
  - 见 `src/games/dicethrone/domain/events.ts:584`
- 系统层把 `CHOICE_REQUESTED` 转成 `simple-choice / compare-roll-choice / multistep-choice`，并同步回 `currentChoiceSourceAbilityId`
  - 见 `src/games/dicethrone/domain/systems.ts:113`
  - 见 `src/games/dicethrone/domain/systems.ts:336`
  - 见 `src/games/dicethrone/domain/systems.ts:455`
- token response 与 bonus dice 交互以 core.pending state 为唯一业务真相，interaction 只做阻塞壳层
  - 见 `src/games/dicethrone/domain/systems.ts:650`
  - 见 `src/games/dicethrone/domain/systems.ts:691`
- Treant 等复杂英雄把大量 choice 语义编码进 `customId + value`，并依赖当前 choice anchor 解码
  - 见 `src/games/dicethrone/domain/customActions/treant.ts:30`

结论：

- DiceThrone 是下一批 deferred snapshot / interaction descriptor 的首要迁移对象。
- 首批目标不是重写全部 choice UI，而是把 `currentChoiceSourceAbilityId + pending settlement + payload-shaped compareRoll` 收口到显式 snapshot / descriptor seam。

### 第二优先级：SummonerWars

SummonerWars 的主要风险是大量 `createSimpleChoice` 交互使用 `interaction.data.sw` 携带 ad hoc meta，且多步交互要靠这份 meta 继续派生后续交互。

- before-attack、能力、事件卡三类交互都在 `systems.ts` 里手工构造 `createSimpleChoice + interaction.data.sw`
  - 见 `src/games/summonerwars/domain/systems.ts:531`
  - 见 `src/games/summonerwars/domain/systems.ts:656`
  - 见 `src/games/summonerwars/domain/systems.ts:875`
- `revive_undead` 等两步交互先存 `step: 'selectCard'`，再在 resolve 后继续生成位置交互
  - 见 `src/games/summonerwars/domain/systems.ts:656`
  - 见 `src/games/summonerwars/domain/systems.ts:3076`
- `mind_capture`、`soul_transfer`、`grab_follow`、`ice_ram` 等都通过 `interaction.data.sw` 保存 live 继续所需字段
  - 见 `src/games/summonerwars/domain/systems.ts:1232`
  - 见 `src/games/summonerwars/domain/systems.ts:1280`
  - 见 `src/games/summonerwars/domain/systems.ts:1325`
  - 见 `src/games/summonerwars/domain/systems.ts:1397`

结论：

- SummonerWars 需要把 `interaction.data.sw` 从 ad hoc payload 升级成统一 snapshot envelope。
- 它与对象生命周期问题高度耦合，适合和 provenance batch 连续推进。

### 第三优先级：Cardia

Cardia 的问题不是交互数量多，而是交互封装过弱：`interaction: any`、`context` 自由透传、UI 通过 `availableCards` 与 owner 分布推断展示。

- `ABILITY_INTERACTION_REQUESTED` 直接携带 `interaction: any`
  - 见 `src/games/cardia/domain/events.ts:155`
- `wrapCardiaInteraction` 会把 `availableCards` 转成卡牌对象，再拼进 `interaction.data.cards/context/cardId/myPlayerId/opponentId`
  - 见 `src/games/cardia/domain/systems.ts:204`
- `INTERACTION_RESOLVED` 后再按 `payload.sourceId` 找 handler，并可能继续返回下一段 interaction
  - 见 `src/games/cardia/domain/systems.ts:382`
  - 见 `src/games/cardia/domain/systems.ts:520`
- `inventorPending` 这种链式交互仍靠 core 临时状态 + 第二次 `queueInteraction`
  - 见 `src/games/cardia/domain/systems.ts:618`

结论：

- Cardia 需要的不是复杂 compare-roll seam，而是“交互 envelope 自足化 + snapshot/context 收敛”。
- 它应作为 deferred 第三批，优先消除 `interaction:any` 与 `context` 漂移。

### 当前不进首批的游戏

- `qidahen`、`splendor`：当前未发现显著 deferred 风险簇。
- `tictactoe`：只有极轻量交互，不值得纳入本次统一 seam rollout。

## 4.3 分批迁移清单

### Batch 0（已完成）

- engine `sessionContext`
- SmashUp `objectRef / provenance` 第一批
- SmashUp `deferredSnapshot` 第一批

### Batch 1（下一批最高优先）

- SummonerWars 对象生命周期 primitive
  - 目标：`CONTROL_TRANSFERRED / UNIT_DESTROYED / UNIT_ATTACHED / EVENT_ATTACHED`
  - 目标：统一 `BoardUnit / attached object / temporary control` 的 provenance model
- DiceThrone deferred snapshot / descriptor primitive
  - 目标：`CHOICE_REQUESTED / compareRoll / token response / bonus dice`
  - 目标：减少 `currentChoiceSourceAbilityId + payload shape` 的隐藏耦合

### Batch 2

- Cardia 对象与交互 envelope 收口
  - 目标：`CARD_REPLACED / delayedEffects / ABILITY_INTERACTION_REQUESTED`
- SummonerWars 多步交互 snapshot 化
  - 目标：`interaction.data.sw` family

### Batch 3

- DiceThrone 状态迁移 value object 化
  - 目标：`TRANSFER_STATUS` family
- SmashUp 剩余历史 family 继续按同一 seam 扩面，不再引入新的 ad hoc 参数

### Watchlist

- `qidahen`
- `splendor`
- `tictactoe`

这些游戏当前不进入首批，但新功能若引入跨区对象、临时控制、延迟交互或 payload-driven UI，必须直接复用本次 seam，而不是重新发明一套。
