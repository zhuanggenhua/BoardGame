# Implementation Readiness Audit

> 用途：记录正式实现前已经确认的代码落点、可复用能力和硬阻塞。2026-07-18 回写：剧本 3（灰尘）已从本文的“待实现”状态推进到正式代表链验证状态；剧本 12/33 已从本文的门禁口径推进到正式代表链验证状态。

## Current Code Facts

| 现实含义 | 当前代码证据 | 对 3/12/33 的影响 |
| --- | --- | --- |
| 当前正式剧本类型只允许首剧本 | `src/games/betrayal/scenarioConfig.ts:5` 的 `BetrayalScenarioId = 'first-scenario'` | 必须先扩展剧本 id，不能把 3/12/33 塞进首剧本 |
| 当前正式作祟编号开放 1 和 3 | `src/games/betrayal/scenarioConfig.ts` 的 `BETRAYAL_IMPLEMENTED_HAUNT_CARD_NUMBERS = [1, 3]` | 剧本 3 已开放；12/33 对应事件继续保持门禁，直到单剧本完整通过 |
| 事件牌运行池根据作祟编号过滤 | `src/games/betrayal/scenarioConfig.ts:297` 与 `:307` | 可以复用该门禁逐剧本放开事件牌，不需要重建事件池 |
| 当前剧本配置写死首剧本 haunt id | `src/games/betrayal/scenarioConfig.ts:338` 到 `:341` | `hauntId` 需要从单值扩为多剧本联合类型或结构化 id |
| 当前终局结果写死首剧本 haunt id | `src/games/betrayal/game.ts:267` 到 `:282` | 3/12/33 需要扩展 `BetrayalEndgameResult`，剧本 12 还需要支持自由混战赢家 |
| 当前运行时状态主要是首剧本字段 | `src/games/betrayal/game.ts:289` 到 `:307` | 需要新增按剧本分支的 runtime 子结构，避免把 Sickness / Ritual / Essence 混进 Jack 字段 |
| 当前 `playerView` 已过滤灰尘隐藏信息 | `src/games/betrayal/game.ts` 的 `createBetrayalPlayerView` / `maskDustRuntimeForPlayer` | 剧本 3 的 Sickness token 数字只在本人视图可见；后续 12/33 若有私有信息仍需单独补过滤 |
| 当前已有直线视线判断 | `src/games/betrayal/game.ts:2869` | 剧本 33 的摄影师视线攻击可先复用现有函数，但要补测试确认与规则一致 |
| 当前已有怪物与尸体基础能力 | `src/games/betrayal/game.ts:99`、`:1420`、`:3179`，`src/games/betrayal/Board.tsx:781` | 剧本 12 已复用 monster token 与尸体基础并补出邪教徒尸体/献祭代表链；剧本 33 已复用持有物与阵营基础并补出魔法相机叛徒归属代表链；Phantom kill/stun 深分支仍按后续扩展单独补证 |
| 当前 AI 视图仍按首剧本字段建模 | `src/games/betrayal/ai.ts:75` 到 `:112` | 新剧本要扩展 AI 可见状态；剧本 3 尤其不能让 AI 读取隐藏 token |

## Reusable Seams

- 事件可选作祟成功分支已有逐剧本放开入口；新增剧本必须先完成代表链验证，再写入正式运行口径。
- `core.monsters`、怪物 token 渲染和怪物移动投骰已有基础结构，可承接 Cultists、Feverish、Phantom Photographers。
- `deadExplorerPlayerIds`、尸体搜刮和死亡处理已有基础结构，可扩展为剧本 12 的尸体携带/献祭。
- `isStraightLineVisible` 已能按同楼层同行/同列且中间房间连续判断视线，可作为剧本 33 的第一版视线规则候选。
- `activityLog`、recentRoll、trait check 与 E2E helper 已有首剧本基线，可复用来记录新增动作。

## Hard Blockers Before Code Completion

1. **隐藏信息视图**：剧本 3 已补 `playerView` 过滤和测试；后续 12/33 若引入私有信息，仍必须走同一玩家视图门禁。
2. **自由混战胜负结构**：剧本 12 不是首剧本式英雄/叛徒二分，当前 `BetrayalEndgameResult` 和 AI 阵营判断需要先支持单人/多人自由混战结果。
3. **剧本 runtime 分层**：当前 `scenarioRuntime` 是首剧本字段集合，新增剧本必须改成可扩展结构，否则后续审计无法判断字段属于哪个剧本。
4. **AI 可见状态**：AI 不能消费全量隐藏状态；新增剧本前要定义 AI 只能看到玩家可见信息。
5. **事件牌回归门禁**：剧本 3、12、33 通过代表链后已开放对应事件；后续新增深分支仍必须先补完整链路和验证，不能只靠事件合同进入正式声明。

## Suggested Implementation Order

1. 剧本 3 已完成隐藏信息过滤、灰尘 runtime 子结构、代表领域测试和真实页面链路验证。
2. 接着实现剧本 33，复用/验证现有视线函数和怪物结构。
3. 最后实现剧本 12，因为自由混战结果结构对当前二元阵营模型冲击最大。
4. 每完成一个剧本，单独开放对应作祟编号，回归事件牌数量和审计口径。
