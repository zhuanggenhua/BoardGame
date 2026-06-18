## Context
- 幻想国度现有实现把“玩家人数”“双人变体”“基础版牌组”硬编码在不同层：manifest、建房 UI、服务端校验、domain setup 和 scoring 各自持有一份假设。
- 本轮同时引入 `二人变体开关` 与 `新花色扩展开关`，如果不先统一 setup 读取与人数解析，前端和服务端会继续出现同一个房间配置两边口径不同的问题。
- 官方 `Cursed Hoard` 有两部分：
  - `ch_suits`：新增 `building / outsider / undead` 23 张牌，并替换 8 张基础牌
  - `ch_items`：新增独立时机与物品牌堆

## Goals / Non-Goals
- Goals:
  - 让幻想国度房间层可以显式表达 `规则模式` 与 `扩展内容`
  - 让建房、本地页、测试页、服务端与 domain 使用同一份 setup 真相
  - 接入 `ch_suits` 的牌组、阈值和计分
- Non-Goals:
  - 不实现 `ch_items`
  - 不引入新的房间外产品入口
  - 不补扩展卡图 atlas

## Decisions

### Decision: 用 `roomSetup.ts` 持有幻想国度 setup 真相
- Why:
  - SmashUp、七大恨已经在项目内采用 game-specific room setup 文件承载 setup 读取、公开摘要和运行时配置。
  - 幻想国度的 setup 需要同时被 manifest、本地页、测试页、服务端和 domain 读取，单独文件最稳。

### Decision: 新增通用“按 setup 解析允许人数”入口，但仅接线当前有需要的调用方
- Why:
  - 人数联动不该再散落在 `CreateRoomModal`、`LocalMatchRoom`、`TestMatchRoom` 和 `server.ts` 各自手写。
  - 现阶段只有少数游戏需要 setup 驱动人数，做一个 registry 式扩展点即可，不必重构整套 manifest。

### Decision: domain core 持有标准化 `setupConfig`
- Why:
  - 手牌上限、双人摸牌数、终局阈值、可用牌组与计分语义都要依赖 setup。
  - 把 setupConfig 放进 core 后，validate / execute / reduce / Board / isGameOver 都能读同一份已解析结果。

### Decision: 本轮只补 `ch_suits`
- Why:
  - `ch_items` 需要独立牌堆、面朝下状态、回合替换时机与行动选择，明显超出当前 runtime 复杂度。
  - 先把 `ch_suits` 接成稳定真相源，后续再为 `ch_items` 单开 change 更清晰。

## Risks / Trade-offs
- `ch_suits` 中的 `Angel / Demon / Lich / Necromancer` 会扩展当前 blanking 与 scoring 搜索空间。
  - Mitigation: 只在 scoring 引擎里补最小必要的额外 choice/blanking 逻辑，不顺手重写整套数据驱动引擎。
- 双人变体与扩展阈值组合规则容易误读。
  - Mitigation: 统一走 `roomSetup.ts` 的标准化 runtime config，并在测试中显式锁住基础版 / 双人 / 扩展三种阈值。

## Migration Plan
1. 创建新 change 与 spec deltas。
2. 先接 room setup 与人数解析，避免前后端口径继续分裂。
3. 再扩 domain/foundation/scoring。
4. 最后补测试与本地化。

## Open Questions
- 无。本轮明确不实现 `ch_items`，因此不会再把物品时机带入当前变更。
