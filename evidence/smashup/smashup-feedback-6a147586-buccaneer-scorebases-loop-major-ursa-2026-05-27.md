# SmashUp 反馈 6a147586 计分阶段死循环修复（2026-05-27）

- 反馈 ID：`6a14758694b5e7f2607c25c2`
- 游戏：`smashup`
- 来源：`feedback-modal`
- 反馈原文：`用决斗 把海盗消灭触发它的转移效果，然后AI就开始无线触发效果，并且熊骑兵种族的泰坦开始一直刷战力了`

## 生产现场

- 现场快照：`temp/feedback-closeout/query-feedback-6a147586-detail-20260527.raw.json`
- 解析状态：`temp/feedback-closeout/query-feedback-6a147586-state-20260527.json`
- 现场关键事实：
  - `turnPhase = scoreBases`
  - `scoringEligibleBaseIndices = [1]`
  - `beforeScoringTriggeredBases = [1]`
  - `base 0 = base_tortuga`
  - `base 1 = base_the_homeworld`
  - `flowHalted = true`
  - 当前阻塞交互：`buccaneer_move_c63_1779725694865`
  - `minionsMovedToBaseThisTurn = { "2": { "0": 54 } }`
- 场上对应对象：
  - `pirate_buccaneer` 在反复从 `家园` 移到 `托尔图加`
  - `bear_cavalry_major_ursa` 在 `托尔图加`
  - 熊骑兵的 `bear_cavalry_cub_scout` 分别出现在 `托尔图加` 和 `家园`

## 根因

- 这不是 `scoreBases` 总线本身的推进问题，而是 `onMinionMoved` 的消费者语义太宽。
- 现场 event stream 显示，一次 `pirate_buccaneer` 从 `base_the_homeworld(1)` 移到 `base_tortuga(0)` 后：
  - 目标基地 `base_tortuga` 正常收到 `onMinionMoved`
  - 来源基地 `base_the_homeworld` 也收到了一次 `onMinionMoved`
- `processMoveTriggers` 之所以同时给来源基地和目标基地发 `onMinionMoved`，是为了兼容 `Very Large Boulder` 这类“移出基地”效果；这条全局行为本身是有用的。
- 真正出错的是熊骑兵这几类“只应响应移入”的效果没有过滤来源基地调用：
  - `bear_cavalry_cub_scout`
  - `bear_cavalry_cub_scout_pod`
  - `bear_cavalry_high_ground`
  - `bear_cavalry_high_ground_pod`
- 来源基地上的 `bear_cavalry_cub_scout` 误把“已经离开家园的海盗”再次当成家园上的被移动随从处理，于是重复生成 `pirate_buccaneer_move`。
- 于是链路变成：
  - `buccaneer move -> fromBase 误触发 cub scout -> 再次生成 buccaneer move -> 再次进入 onMinionMoved`
  - 每轮目标基地上的 `Major Ursa` 都会合法吃到一次“有随从移入托尔图加”，所以 power counter 一直涨，最终现场里累计到了 `54`。

## 修复

- 修改文件：`src/games/smashup/abilities/bear_cavalry.ts`
- 修复方式：给上述 4 个熊骑兵 `onMinionMoved` 触发器统一加“只处理真正移入目标基地”的门禁：

```ts
if (ctx.moveToBaseIndex !== undefined && destBaseIndex !== ctx.moveToBaseIndex) return events;
```

- 这样保留了全局 move pipeline 对“来源基地触发器”的支持，同时把熊骑兵能力精确收窄到自己的规则语义，不会影响依赖“移出基地”回调的别的卡。

## 测试

- 修改测试文件：`src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`
- 新增回归：
  - `随从离开幼熊斥候所在基地时，不应由原基地斥候误触发`
  - `随从离开制高点所在基地时，不应由原基地制高点误触发`

## 验证

命令：

```bash
npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts --configLoader native --environment node
```

结果：

- `1` 个测试文件通过
- `37` 条测试通过
- 新增两条回归均通过，确认“来源基地误吃 onMinionMoved”不再发生

## 结论

- 该反馈是真 bug。
- 根因是熊骑兵的“移入触发器”错误响应了来源基地的 `onMinionMoved`。
- 本轮修复后，`pirate_buccaneer` 不会再在 `scoreBases` 阶段被来源基地重复拉起移动交互，`Major Ursa` 也不会再随死循环无限加战力。
