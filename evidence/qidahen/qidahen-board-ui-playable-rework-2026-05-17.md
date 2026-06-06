# 七大恨 Board UI 基础可玩重做证据（2026-05-17）

## 审计范围

- 代码范围：`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/Board.test.ts`、`src/components/game/framework/widgets/GameHUD.tsx`、`e2e/qidahen-basic-flow.e2e.ts`、`.windsurf/skills/boardgame-ui-imagegen/SKILL.md`。
- 验证范围：桌面 1600x900 的真实 `/play/qidahen/tutorial` Board 入口，覆盖轮盘本体目标格选择、对手手牌数变化、右侧具体势力行动选择与支付态变化。
- 非覆盖范围：完整七大恨规则、完整多人在线对局、移动端横屏最终适配、所有卡牌语义结算。

## 2026-06-04 00:51 +08 增补：新年中立耗损与大漠耗损进入正式结算链

### 本轮新增范围

- 代码范围：
  - `src/games/qidahen/domain/index.ts`
  - `src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 友好标记中立区在新年时不再错误使用当地人口补给；
  - 大明正规军在非汉人区域不再错误使用当地人口补给；
  - 两类耗损都能进入区域 note 与新年摘要。
- 非覆盖范围：
  - 围城耗损；
  - 纪年卡取分/顺位；
  - 人物牌正式出场与人物判定；
  - 地图边值最终真相。

### 关键调整

- `中立耗损`
  - 旧实现问题：新年耗损循环先按 `region.controller === 'neutral'` 直接跳过，导致友好标记中立区不会触发耗损。
  - 新实现：若区域为 `neutral + diplomacyMarkerSide=friendly`，则按 `diplomacyMarkerFaction` 结算耗损，并把当地人口补给视为 `0`。
- `大漠耗损`
  - 旧实现问题：大明正规军在当前非汉人区域仍会与雇佣军一起使用当地人口补给。
  - 新实现：当前先按现有结构化部队数据区分正规军与雇佣军；位于非汉人区域时，大明正规军从可用人口补给中整体扣除，仅雇佣军仍可消耗当地人口。
- 新增回归：
  - `新年会对友好标记中立区执行中立耗损，不吃当地人口补给`
  - `新年大漠耗损只禁止大明正规军吃补给，雇佣军仍可使用当地人口`

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-basic-flow.e2e.ts
```

### 结果

- `payment-selection.test.ts`：`110 passed`
- 七大恨四文件：`239 passed`
- `tsc`：通过
- `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

### 结论边界

- 本轮只证明：地图保持当前可用图谱的前提下，新年耗损链已进一步贴近规则；
- 不代表七大恨新年规则已经全部完成；
- 也不代表人物牌、纪年卡或完整胜利链已经收口。

## 2026-06-04 00:32 +08 增补：新年朝鲜耗损不再被整段跳过

### 本轮新增范围

- 代码范围：
  - `src/games/qidahen/domain/index.ts`
  - `src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 新年阶段，朝鲜运行时区域不再被普通补给循环直接跳过；
  - 朝鲜区域部队必须仅靠手牌支付耗损，手牌不足时按既有减员优先级扣减结构化部队；
  - 新年摘要与区域 note 能区分 `朝鲜耗损` 和普通 `兵力耗损`。
- 非覆盖范围：
  - 围城耗损 / 中立耗损 / 大漠耗损；
  - 纪年卡取分、行动顺位、人物牌正式出场与人物判定；
  - 地图边值最终真相。

### 关键调整

- 旧实现问题：
  - `resolveNewYear()` 遍历运行时区域时，对朝鲜区域直接 `continue`；
  - 结果是规则书明确写的“朝鲜耗损：在朝鲜的部队不接受当地补给，必须全由手牌支付耗损”完全未执行。
- 新实现：
  - 朝鲜区域不再被跳过，而是把补给人口恒视为 `0`；
  - 仍先消耗当前势力手牌支付耗损；
  - 手牌不足时沿用现有 `attritionPriority` 扣减结构化部队；
  - 区域 note 与新年摘要会写明 `朝鲜耗损`，避免继续和普通 `兵力耗损` 混为同一口径。
- 新增回归：
  - `新年会对朝鲜区域执行仅手牌支付的耗损`
  - 样例锁定：汉城 2 个朝鲜雇佣军、0 手牌，新年后减员为 0，摘要包含 `大明 在 汉城 触发朝鲜耗损，无法补足 2 点补给，部队减员 2`。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
```

### 结果

- `payment-selection.test.ts`：`108 passed`
- `tsc`：通过

### 结论边界

- 本轮只证明：朝鲜区域的新年耗损现在已经进入正式结算链，不再被整段跳过；
- 不代表七大恨新年所有耗损规则已经完整实现；
- 也不代表纪年卡、人物牌或地图真相已经收口。

## 2026-06-03 18:18 +08 增补：逻辑区规则迁移后基础 Board 主链仍保持全绿

### 本轮新增范围

- 代码范围：
  - `src/games/qidahen/domain/regionConfig.ts`
  - `src/games/qidahen/domain/index.ts`
  - `src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 新年防线维护依赖从旧 runtime 区号迁到逻辑区口径；
  - 汉城额外威望解锁从 `city-region-29` 迁到 `shou-cheng` 等价判断；
  - 迁移后七大恨基础 Board E2E 仍维持整份 `24/24` 全绿。
- 非覆盖范围：地图真相继续校正、完整人物牌系统、完整军备牌系统、所有未完成正式规则。

### 关键调整

- 防线依赖：
  - `山海关` 维护依赖由 `city-region-28` 改为逻辑区 `ji-zhen`；
  - `宁远 / 锦州` 维护依赖由 `city-region-19` 改为逻辑区 `liao-xi`。
- 规则控制判定：
  - 新增 `getQidahenRuleRegionController()`；
  - 判定顺序改为“优先 runtime 真相，再兜底逻辑区镜像”，避免只改 runtime 区时逻辑区控制方滞后导致误判。
- 汉城威望：
  - 汉城额外威望解锁从写死 `city-region-29` 改为 `shou-cheng` 逻辑区等价判断。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/regionConfig.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

### 结果

- `payment-selection.test.ts`：`107 passed`
- 七大恨四文件：`236 passed`
- `tsc`：通过
- 定向 ESLint：`0 errors`
- `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

## 2026-06-03 19:17 +08 增补：连线边值继续按图面真相定点收紧

### 本轮新增范围

- 数据范围：`src/games/qidahen/data/region-graph.json`
- 测试范围：`src/games/qidahen/__tests__/mapGraph.test.ts`
- 验证范围：
  - 根据当前已画好的区域与现有叠图，继续只改高置信边值，不做全图盲调；
  - 修边后七大恨四文件与基础 Board E2E 继续保持全绿。

### 本轮新增实现

- 当前最硬的高置信候选为 `city-region-16::jinzhou`：
  - 边型仍为 `city`；
  - 双向 `travelCost` 从 `2 -> 3`。
- 判断依据：
  - 当前图谱中心距约 `249px`；
  - 已与现有 `city-region-24::jinzhou = 3`（约 `243px`）、`city-region-15::jinzhou = 3`（约 `282px`）同级；
  - 明显不再像 `city-region-19::jinzhou = 2`（约 `120px`）和 `city-region-25::jinzhou = 2`（约 `113px`）这种短城攻边。
- 同步修正测试真相：
  - `mapGraph.test.ts` 中 `city-region-14::jinzhou` 的断言从旧 `2` 追到当前数据真相 `3`；
  - 新增 `city-region-16::jinzhou = 3` 断言。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

### 结果

- 七大恨四文件：`236 passed`
- `tsc`：通过
- `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

### 仍待继续核的候选

- `city-region-22::city-region-32`：边型是否仍应为 `plain`
- `city-region-24::city-region-28`
- `city-region-27::city-region-28`

当前这些候选还没有足够硬的图面证据，本轮未继续改。

## 2026-06-03 20:07 +08 增补：宣府到顺天的普通边值继续收紧

### 本轮新增范围

- 数据范围：`src/games/qidahen/data/region-graph.json`
- 测试范围：`src/games/qidahen/__tests__/mapGraph.test.ts`
- 验证范围：
  - 继续按当前已画好区域和现有叠图做定点小改，不做全图盲调；
  - 只动 1 条当前剩余最硬的普通长边，不把 `city-region-22::city-region-32` 这种仍带边型疑问的边一起打包修改。

### 本轮新增实现

- 当前最硬的普通长边候选改为 `city-region-24::city-region-28`：
  - 边型仍为 `plain`；
  - 双向 `travelCost` 从 `2 -> 3`。
- 判断依据：
  - 当前图谱中心距约 `138px`；
  - 已与现有这些 `plain=3` 长边同级：
    - `city-region-14::city-region-19 ≈ 136px`
    - `city-region-13::city-region-15 ≈ 145px`
    - `city-region-24::city-region-25 ≈ 148px`
  - 同批剩余候选里，`city-region-27::city-region-28 ≈ 115px` 明显更短；
  - `city-region-22::city-region-32 ≈ 125px` 仍夹着“是否应为水路/海岸”的边型疑问，当前证据不够硬，所以本轮不动。
- 同步修正测试真相：
  - `mapGraph.test.ts` 中 `city-region-24::city-region-28` 的断言从旧 `2` 追到当前数据真相 `3`。

### 结论边界

- 这一步只证明 `宣府 -> 顺天` 这条普通边继续向图面真相收了一格；
- 不代表全图边值已完成；
- `city-region-22::city-region-32` 的边型与 `city-region-27::city-region-28` 是否需再抬，仍留到下一轮继续核图。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

### 结果

- 七大恨四文件：`236 passed`
- `tsc`：通过
- `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

## 2026-06-04 00:18 +08 增补：剩余两条疑边本轮停手，不为改而改

### 本轮新增范围

- 图面证据范围：
  - `temp/southwest-crop.png`
  - `temp/southeast-crop.png`
  - `temp/qidahen-region-crop-east.png`
  - `temp/qidahen-real-map-accepted-region-overlay.png`
  - `temp/qidahen-region-mask-labeled-current.png`
- 规则/测试依赖范围：
  - `src/games/qidahen/__tests__/movementRules.test.ts`
- 非范围：
  - 不新增地图工具工作；
  - 不做“把候选边全改掉”的盲调。

### 本轮核图结论

- `city-region-27::city-region-28`（保定 -> 顺天）
  - 当前中心距约 `115px`；
  - 在 `southwest-crop` 的底图观感上，也没有达到上一批已抬成 `3` 的普通长边量级；
  - 结论：当前证据不足，不继续从 `2 -> 3`。
- `city-region-22::city-region-32`（东江 -> 登莱）
  - 在 `qidahen-region-mask-labeled-current.png` 里，两区在当前 mask 上确实相邻；
  - 但在当前底图与 accepted overlay 上，缺少足够硬的“应改成海岸/水路”证据；
  - 同时 `movementRules.test.ts` 现有用例明确锁住：海路到东江后，不会继续扩到登莱；
  - 结论：当前不贸然改边型，也不继续仅凭距离或接壤关系调值。

### 结论边界

- 当前地图图谱已经达到“粗可用且能支撑现有七大恨流程”的阶段；
- 剩余这两条边在当前证据下不足以继续定型；
- 所以下一步主线应回七大恨玩法实施，而不是继续在这两条边上空转；
- 本轮未改代码，因此没有新的自动化结果；当前可用基线仍是上一轮：
  - 七大恨四文件 `236 passed`
  - `tsc` 通过
  - `e2e/qidahen-basic-flow.e2e.ts` 为 `24 passed`

## 2026-06-03 17:35 +08 增补：基础 Board E2E 已重新拉齐到当前图谱与当前战斗链

### 本轮新增范围

- 代码范围：`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：
  - 旧区名断言已同步到当前地图真相源：`区域 15 -> 辽北`、`区域 20 -> 土默特部`；
  - 两条最容易飘的战斗 E2E 不再依赖默认开局兵力/军备态，而是改成 harness 注入的确定性待结算场景；
  - 七大恨基础 Board 流程重新回到整份 `24/24` 全绿。
- 非覆盖范围：七大恨正式规则新增实现、地图编辑器进一步能力、完整军备牌系统、完整最终玩法闭环。

### 关键调整

- `突袭待结算可收口并推进到下一位势力`
  - 不再依赖默认教程局面的首个 `突袭作战`；
  - 改为直接注入 `resolve-pending` 状态、空守军目标区和 `wheelActionUsed=true / factionActionUsed=true`；
  - 断言 `战后处理 -> 占领` 后直接推进到蒙古行动窗口。
- `结构化战斗可选择低级承伤并继续战后占领`
  - 保留“低级先损”交互目标；
  - 守方从 `2 个 3 级步兵` 收窄为 `1 个 3 级步兵`，与当前固定掷骰结果保持稳定；
  - 断言更新为 `攻方损失 1，幸存 2`。
- 区名同步：
  - `轮盘进攻调度` 与 `轮盘外交雇佣` 的 `city-region-15` 断言统一改为 `辽北`；
  - `战后处理可劫掠人口并显示抽牌收益` 的季节摘要断言改为 `劫掠 土默特部 2 人口`。

### 自动化证据

```powershell
npx eslint e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
$env:NODE_OPTIONS='--max-old-space-size=4096'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
npx tsc --noEmit --pretty false
```

- 结果：
  - ESLint：`0 errors`（保留 44 个既有 `no-explicit-any` warnings）
  - 七大恨基础 Board E2E：`24 passed`
  - `tsc`：通过

### 截图证据

- `temp/qidahen-board-faction-decks-current.png`
- `temp/qidahen-board-battle-resolution-current.png`
- `temp/qidahen-board-wheel-dispatch-selection-current.png`
- `temp/qidahen-board-post-battle-current.png`
- `temp/qidahen-board-wheel-hire-current.png`

### 结论边界

- 本轮收的是 E2E 夹具和断言真相，不是七大恨正式规则新增开发。
- 当前可证明的是：以现有地图数据和现有教程局为基线，七大恨基础 Board 交互流再次整份全绿。
- 仍不能据此宣称七大恨全规则或完整可玩收口已经完成。

## 2026-06-01 14:39 +08 增补：攻方结构化溃败也改为等级损伤

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 攻方未突破且选择 `溃败` 时，已投入特殊部队不会被一律全灭；
  - 先结算战斗损失，再对幸存非炮兵特殊部队执行等级 -1；
  - 未结构化普通部队仍保留当前低保真全灭口径。
- 非覆盖范围：玩家指定承伤、真实随机掷骰、骑兵避战、骑兵劫掠、所有开局部队拆分炮/骑/步。

### 关键断言

- `payment-selection.test.ts`
  - `结构化攻方未突破溃败时会降级幸存步兵，而不是把高等级残部全灭`
  - 样例源区为大明 5 个 2 级步兵；
  - 战斗损失 2 个后，选择 `溃败`；
  - 源区剩余 3 个 1 级步兵，日志显示 `攻方损失 2，撤退溃败损伤 3`。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`78 passed`
  - 七大恨定向四文件：`195 passed`
  - `tsc`：通过
  - ESLint：`0 errors`
  - 七大恨基础 Board E2E：`19 passed`

### 仍未覆盖的风险

- 还没有真实随机掷骰与玩家指定承伤。
- 骑兵避战、骑兵劫掠仍未落成完整交互链。
- 全部开局普通部队还没有完整拆分为炮/骑/步结构化数据。

## 2026-06-01 13:58 +08 增补：调骑投入栈会贯穿战后转移

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - `QidahenPendingTargetAction` 与 `QidahenPostBattleSelection` 携带 `movementProfileId`；
  - 结构化特殊部队的投入栈、幸存栈、源区扣栈、目标区接收栈按调度 profile 过滤；
  - `调骑 4` 占领空区时会实际转移骑兵栈，而不是转移更高等级的步兵栈。
- 非覆盖范围：完整选兵 UI、所有开局兵种拆分、骑兵避战与骑兵劫掠完整链。

### 关键断言

- `payment-selection.test.ts`
  - `调骑 4 占领空区时会转移骑兵栈，而不是转移高等级步兵栈`
  - 样例源区含 `2 个 4 级步兵 + 1 个 2 级骑兵`；
  - 选择 `调骑 4` 占领空区后，源区保留 2 个步兵，目标区接收 1 个骑兵。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`75 passed`
  - 七大恨定向 Vitest：`192 passed`
  - `tsc`：通过
  - ESLint：`0 errors`
  - 七大恨基础 Board E2E：`19 passed`

## 2026-06-01 13:42 +08 增补：调骑 4 已受结构化骑兵数量约束

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 源区已有结构化兵种数据时，`dispatch-cavalry` 只把骑兵计入可投入兵力；
  - 结构化区域只有步兵、没有骑兵时，不会进入 `调骑 4` 目标选择；
  - 尚未结构化的旧总兵数区域保持兼容，基础 Board 调度流程继续可跑。
- 非覆盖范围：完整选兵 UI、所有开局兵种拆分、骑兵避战/劫掠完整链。

### 关键断言

- `payment-selection.test.ts`
  - `调骑 4 在结构化兵种区域只会投入骑兵，不会拿步兵冒充骑兵`
  - `结构化区域没有骑兵时不会进入调骑 4 目标选择`

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`74 passed`
  - 七大恨定向 Vitest：`191 passed`
  - `tsc`：通过
  - ESLint：`0 errors`
  - 七大恨基础 Board E2E：`19 passed`

## 2026-06-01 13:33 +08 增补：炮兵不承伤且不计入胜负判定

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 炮兵仍可在当前等级估算模型中贡献火力；
  - 战斗损伤不会由炮兵承受；
  - 战斗胜负比较不计入炮兵数量；
  - 攻方若战斗后只剩炮兵，不会因为炮兵幸存而进入战后占领。
- 非覆盖范围：真实炮/骑/步攻击顺位、随机掷骰、逐木块士气降级、玩家指定承伤单位。

### 关键断言

- `payment-selection.test.ts`
  - `战斗损伤不会由炮兵承受，炮兵也不计入胜负兵力`
  - `攻方只剩炮兵时不会因为炮兵幸存而赢得战斗`
- 旧回归修正：
  - `结构化守军野战败退时会把幸存特殊部队撤到相邻友方区域` 不再依赖攻方炮兵计入胜负；样例改用非炮兵精锐部队确保测试目标仍是守军特殊部队败退转移。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`72 passed`
  - 七大恨定向 Vitest：`189 passed`
  - `tsc`：通过
  - ESLint：`0 errors`
  - 七大恨基础 Board E2E：`19 passed`

## 2026-06-01 13:15 +08 增补：败退炮兵无步骑掩护会移除

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 战败撤退结算后，若撤退部队只剩炮兵、没有步兵或骑兵掩护，炮兵不会单独撤入友方区域；
  - 攻方未突破撤退后的源区也应用同一兜底，避免败退炮兵作为普通幸存部队保留。
- 非覆盖范围：完整炮兵不能承伤、炮骑步攻击顺位、随机掷骰、逐木块士气降级。

### 关键断言

- `payment-selection.test.ts`
  - `守军败退后若只剩炮兵没有步骑掩护，炮兵不会撤到友方区域`
  - 构造守军撤退损失后只剩 1 个炮兵的野战败退样例；
  - 断言相邻友方区域没有接收该炮兵，日志显示 `守军断后损失 1 后无残部可撤`。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`70 passed`
  - 七大恨定向 Vitest：`187 passed`
  - `tsc`：通过
  - ESLint：`0 errors`
  - 七大恨基础 Board E2E：`19 passed`

## 2026-06-01 12:56 +08 增补：结构化守军败退会保留幸存特殊部队

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：
  - 结构化守军在野战败退时，不再只把总兵数转入撤退区；
  - 守军特殊部队会先承受战斗损失与断后/溃败损失，再把幸存栈随残部撤到相邻友方区域；
  - 皮岛地图点击点改到 mask 内部稳定点，`征召军队 -> 川兵` 的 Board E2E 不再误点到锦州/东江。
- 非覆盖范围：完整逐木块降级、炮骑步攻击顺位、骑兵避战、骑兵劫掠、完整炮兵撤退规则。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`69 passed`
  - 七大恨定向 Vitest：`186 passed`
  - `tsc`：通过
  - ESLint：`0 errors`
  - 七大恨基础 Board E2E：`19 passed`

### 当前结论

- 当前结构化部队不再只服务攻方占领/回退，守方败退也能保留幸存特殊部队数据。
- 这一步仍是低保真战斗模型，不代表完整兵种战斗系统完成。

## 2026-06-01 11:02 +08 增补：朝鲜不可劫掠、不补给与朝鲜牌库已接入

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/regionConfig.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 朝鲜区域初始人口为 `0`
  - 朝鲜区域即使出现异常人口数据，也不会生成劫掠选项
  - 朝鲜区域不参与新年普通补给/兵力耗损
  - 新年朝贡与战后占领朝鲜会扣朝鲜牌库并给控制者加手牌
- 非覆盖范围：朝鲜手牌的独立使用/弃牌流、朝鲜牌具体牌面效果、完整人物判定。

### 当前落地口径

- `getQidahenInitialPopulation()` 对朝鲜运行时区域返回 `0`。
- `buildPostBattleSelection()` 对朝鲜目标使用 `plunderablePopulation = 0`，不再让异常人口数据生成劫掠按钮。
- `resolveNewYear()` 的普通补给循环跳过朝鲜区域；朝鲜朝贡通过 `drawKoreaCardsForFaction()` 扣 `koreaDeckCount`。
- `resolvePostBattleDecision()` 在占领朝鲜区域时，按 `getQidahenKoreaTributeCards()` 从朝鲜牌库抽牌。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/regionConfig.ts src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`64 passed`
  - `tsc`：通过
  - ESLint：`0 errors`，剩余 4 个既有 warnings
  - `movementRules.test.ts + mapGraph.test.ts + Board.test.ts`：`117 passed`
  - 七大恨基础 Board E2E：`19 passed`

### 当前结论

- 朝鲜区域现在不再被普通人口、劫掠、普通补给逻辑误伤。
- 朝鲜牌库已开始参与朝贡与占领奖励，不再只是 UI 上显示的静态牌堆。
- 这一步仍不代表朝鲜牌完整牌面效果完成。

## 2026-06-01 08:23 +08 增补：撤退损失已从自动断后升级成可选断后 / 溃败

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：
  - 待结算面板能显示 `断后结算` 与 `溃败结算` 两个动作按钮
  - `RESOLVE_PENDING_ACTION` 可以携带 `retreatLossMode`
  - 守军战败撤退和攻方未突破撤退都能选择 `溃败`，并让剩余残部按低保真“全灭”处理
- 非覆盖范围：真正按部队等级分别承受 1 点损伤的完整兵种系统、玩家手动选择撤退方向、战败标记、避战

### 本轮新增实现与修正

- `resolvePendingTargetAction()` 新增 `retreatLossMode` 参数，支持：
  - `rear-guard`：继续沿用当前低保真断后，残部先移除 1 再撤退
  - `rout`：把撤退残部按当前简化口径视为全灭
- `Board.tsx` 待结算面板增加两个按钮：
  - `qidahen-resolve-pending-action` = `断后结算`
  - `qidahen-resolve-pending-action-rout` = `溃败结算`
- `RESOLVE_PENDING_ACTION` 的 validate / event payload 保持兼容：不传参数仍默认断后，不破坏既有流程。

### 关键断言

- `payment-selection.test.ts`
  - `野战守军战败撤退时可选择溃败让残部全灭`
  - `野战攻方未突破撤退时可选择溃败让残部全灭`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `突袭待结算可收口并推进到下一位势力` 里已能看到 `qidahen-resolve-pending-action-rout`

### 本轮验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection + movementRules`：`65 passed`
  - `tsc`：通过
  - 七大恨定向 Vitest：`178 passed`
  - 七大恨基础 Board E2E：`17 passed`

### 当前结论

- 当前战斗撤退链已经不是单一自动断后，而是有了可见、可选的两种结算方式。
- 这一步仍是低保真溃败模型，不代表完整兵种级伤害系统完成。

## 2026-05-31 19:14 +08 增补：攻方未突破撤退已接入自动断后损失

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 攻方未按剩余兵力突破、但投入部队仍有残部时，会先自动按“断后”再移除 1 个残部
  - 源区最终扣除值为战斗损失 + 撤退断后损失
  - 守方目标区仍保留战后剩余守军，不进入战后占领处理
- 非覆盖范围：玩家在“断后/溃败”之间手动选择、战败标记、攻方撤退目的地选择、完整兵种级损伤

### 本轮新增实现与修正

- `resolvePendingTargetAction()` 在攻方未突破分支新增 `attackerRetreatRearGuardLoss`。
- 当前低保真口径是：攻方战斗后仍有残部但输掉胜负判定时，自动再移除 1 个残部作为撤退断后。
- 源区扣兵现在使用 `sourceTroopLoss = attackerLoss + attackerRetreatRearGuardLoss`。
- 日志和区域 note 会明确写出 `撤退断后损失 1` / `其中撤退断后 1`，避免只看到总损失而不知道撤退损失已结算。

### 关键断言

- `payment-selection.test.ts`
  - `野战攻方未突破但仍有残部时会自动断后再撤回源区`
  - 样例：`区域 16 -> 区域 14` 的 `4 打 5` 野战
  - 预期：攻方战斗损失 3、撤退断后损失 1，源区归零；目标区后金守军剩 2，且不进入 `post-battle-decision`

### 本轮验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection + movementRules`：`63 passed`
  - `tsc`：通过
  - 七大恨定向 Vitest：`176 passed`
  - 七大恨基础 Board E2E：`17 passed`

### 当前结论

- 当前战败撤退低保真链已经覆盖攻方未突破撤退与守方败退撤退两侧。
- 这一步仍不是完整战斗系统完成；下一步应继续补玩家可选“断后/溃败”、战败标记、避战与炮兵/特殊兵种的完整损伤处理。

## 2026-05-31 19:03 +08 增补：野战败退已接入自动断后损失

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 野战守军被按剩余兵力压倒、仍有残部且可撤退时，会先自动按“断后”移除 1 个残部
  - 断后后仍有残部时，才把剩余守军撤到相邻友方区域
  - 城战守败仍不撤退，维持“城中守军全灭”的规则口径
- 非覆盖范围：玩家在“断后/溃败”之间手动选择、战败标记、避战、炮兵随步骑全灭的完整兵种处理

### 本轮新增实现与修正

- `resolvePendingTargetAction()` 在普通野战守方战败且找到相邻友方撤退区时，新增 `defenderRetreatRearGuardLoss = 1` 的自动断后处理。
- 当前低保真口径是：剩余守军 `remainingTroops` 先扣 1 个断后损失，再把 `remainingTroops - 1` 加到自动选择的友方撤退区。
- 回归样例改为 `区域 16 -> 区域 14` 的 `6 打 5` 野战，确保测试覆盖“守方剩 2、断后后撤 1”的正常撤退链，而不是只覆盖“剩 1 后直接断后归零”的边缘情况。

### 关键断言

- `payment-selection.test.ts`
  - `野战守军战败但未死光时会自动断后并把残部撤到相邻友方区域`
  - `城战守军战败时即使尚有残部也不会自动撤退`

### 本轮验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection + movementRules`：`62 passed`
  - `tsc`：通过
  - 七大恨定向 Vitest：`175 passed`
  - 七大恨基础 Board E2E：`17 passed`

### 当前结论

- 战败撤退已经从“只移动残部”推进为“撤退前必有低保真损失”的可验证链路。
- 这一步仍不是完整战斗系统完成；后续应继续补玩家可选“断后/溃败”、战败标记、避战和兵种级损伤。

## 2026-05-31 17:25 +08 增补：战败守军低保真撤退链已收口到可验证状态

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - 野战中守军战败但未死光时，残部会自动撤到相邻友方区域
  - 城战中守军战败时，即使尚有残部也不会撤退，按城战战败移除
  - 当前战斗胜负仍按战后剩余兵力判定，平手守方赢
- 非覆盖范围：完整避战、断后、溃败、玩家选择撤退路径、完整兵种战斗系统

### 本轮新增实现与修正

- `resolvePendingTargetAction()` 当前在攻方 `survivingAttackers > remainingTroops` 时视为突破；若守军仍有残部：
  - 普通野战：查找相邻友方区域并自动转移残部
  - 城战：守军残部不撤退，直接按城中守军全灭处理
  - 无相邻友方区：残部无处可退，被移除
- 本轮修正了野战撤退回归样板：旧样板使用 `皮岛 -> 辽西` 海岸/水路线，海路 `unitCap=2` 导致实际只投入 2 兵，无法打出突破，不是业务逻辑红灯。当前样板改为 `区域 16 -> 区域 14` 平原宽度 3 野战，并让后金残部撤到相邻友方 `区域 17`。

### 关键断言

- `payment-selection.test.ts`
  - `野战守军战败但未死光时会自动撤到相邻友方区域`
  - `城战守军战败时即使尚有残部也不会自动撤退`
  - `战斗胜负会按剩余部队数判定，攻方即使未杀光守军也可突破进入战后处理`

### 本轮验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection + movementRules`：`62 passed`
  - `tsc`：通过
  - 七大恨定向 Vitest：`175 passed`
  - 七大恨基础 Board E2E：`17 passed`

### 当前结论

- 战败守军撤退已经从“规则待补”推进到低保真可验证链路。
- 这一步只证明当前自动撤退/城战全灭的最小正式链，不代表完整战斗系统完成；下一步仍应继续补避战、断后、溃败和更完整的战后移动/兵种细则。

## 2026-05-31 14:01 +08 增补：地图粗值再收最后一个最明显 outlier，当前已足够继续实施七大恨玩法

### 本轮新增范围

- 代码范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/mapGraph.test.ts`
- 验证范围：
  - `锦州 <-> 区域24` 这条攻城线的移动代价是否仍明显偏低
  - 调整后七大恨当前基础玩法链是否仍能跑通
- 非覆盖范围：所有剩余边值最终真值、整张地图图谱精修完成判定

### 本轮新增实现

- 重新对照 `temp/qidahen-graph-overlay.png` 与 `temp/qidahen-region-centers-annotated.png` 后，当前最明显还偏低的一条边是：
  - `city-region-24::jinzhou`
- 这条边当前属性是：
  - `boundaryType=city`
  - `battleWidth=1`
  - 中心点距离约 `243px`
- 它明显长于其余仍保留 `travelCost=2` 的攻城边，因此这轮把它从：
  - `travelCost 2 -> 3`

### 关键断言

- `mapGraph.test.ts`
  - `getQidahenDirectedPassageBetween('city-region-24', 'jinzhou')?.travelCost === 3`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `163 passed`

```powershell
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
$env:PW_RUNTIME_SCOPE='qidahen-map-edge-fill-20260531'
$env:PW_PORT='6373'
$env:PW_GAME_SERVER_PORT='20200'
$env:GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
$env:API_SERVER_PORT='21200'
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'
npx playwright test e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨基础 Board E2E `16 passed`

### 当前结论

- 这一步说明地图图谱已经不只是“能读”，而是连最后一个最明显的低估 outlier 也被收掉了。
- 当前地图值仍然只是“粗可用”而不是最终真值，但已经足够继续推进七大恨玩法实施，不需要再为了这张图停住主线。

## 2026-05-31 13:51 +08 增补：驱虎吞狼的“需同意才可执行”已接成正式 Board 门禁

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/types.ts`、`src/games/qidahen/domain/commands.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：
  - `驱虎吞狼` 执行后先进入“是否同意受大明指挥”
  - 目标 `同意` 后才抽 `6` 并进入调度目标选择
  - 目标 `拒绝` 后本次效果终止且不抽牌
- 非覆盖范围：完整多人座位授权、真实由目标玩家本人点击确认、完整战术牌/劫掠/撤退系统

### 本轮新增实现

- 规则原文明确写了：
  - `需该玩家同意才可执行`
- 旧实现却是：
  - 执行 `驱虎吞狼`
  - 目标立刻抽 `6` 张牌
  - 直接进入 `dispatch-targeting`
- 当前已改成正式两段链：
  - 先进入 `drive-tiger-consent`
  - UI 显示 `qidahen-drive-tiger-consent-selection`
  - 可选 `同意受指挥 / 拒绝执行`
- 结果分支：
  - `同意`：目标抽 `6`，再进入 `驱虎吞狼 · 指挥后金调度进攻`
  - `拒绝`：本次效果结束，不抽牌，并留下拒绝摘要与日志

### 关键截图核对

#### 驱虎吞狼 · 同意后进入调度

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-drive-tiger-dispatch-current.png`
- 我实际确认到：
  - `驱虎吞狼` 真实链已不再是点击后立刻抽牌
  - 同意后，`后金` 手牌显示为 `14/10`
  - 右侧出现 `驱虎吞狼 · 指挥后金调度进攻`
  - 点击目标后仍可进入 `驱虎吞狼待结算`

### 关键断言

- `payment-selection.test.ts`
  - `驱虎吞狼执行后会先进入目标是否同意的选择状态`
  - `驱虎吞狼在目标同意后会让目标抽 6 张牌并进入指挥调度目标选择`
  - `驱虎吞狼在目标拒绝后会结束且不生效`
  - `驱虎吞狼在同意后锁定目标会进入待结算并保留指挥方为后金`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `驱虎吞狼会先进入同意选择，目标同意后再抽牌并进入指挥调度目标选择`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `163 passed`

```powershell
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
$env:PW_RUNTIME_SCOPE='qidahen-drive-tiger-consent-20260531'
$env:PW_PORT='6373'
$env:PW_GAME_SERVER_PORT='20200'
$env:GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
$env:API_SERVER_PORT='21200'
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'
npx playwright test e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨基础 Board E2E `16 passed`

### 当前结论

- 这一步收的不是摘要，而是把规则明确写出的“需同意才可执行”正式落进了 Board 交互链。
- 当前 `驱虎吞狼` 已不再错误地“先抽牌后问意见”。
- 下一步继续补规则时，应优先找这种已经有清晰规则真相、但当前仍少一层正式门禁的链路。

## 2026-05-31 13:00 +08 增补：联姻诱降的辽西代价特例已纠正到规则真相

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 验证范围：
  - `联姻诱降` 指定 `辽西`
  - 山海关未破败 / 已破败 两种局面下的支付代价裁定
- 非覆盖范围：围城只作用城外部队、炮兵转阵营、完整城战/围城系统

### 本轮新增实现

- 规则原文写的是：
  - `指定辽西时，2 个部队不需要支付（视为存在于蓟镇山海关）`
- 旧实现却把减免误挂在了 `jinzhou（锦州）`，这是明确的规则错误。
- 当前已修正：
  - `computeMarriageSubjugationPayCost()` 只对 `city-region-19（辽西）` 生效减免
  - 且只有在 `山海关` 没有破败时才减免 2 个部队
  - 山海关破败后，辽西恢复全额计算

### 关键断言

- `payment-selection.test.ts`
  - `联姻诱降指定辽西时会按规则少算 2 个部队的支付代价`
  - `联姻诱降指定辽西时若山海关已破败则不再享受 2 部队减免`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `160 passed`

```powershell
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
$env:PW_RUNTIME_SCOPE='qidahen-manual-e2e-20260531-1310'
$env:PW_PORT='6373'
$env:PW_GAME_SERVER_PORT='20200'
$env:GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
$env:API_SERVER_PORT='21200'
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'
npx playwright test e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨基础 Board E2E `15 passed`

### 当前结论

- 这条修正不是“多一个测试”而已，而是把一条明确写错区域的规则裁定纠回了真相。
- 当前七大恨基础链仍保持 `15 passed`，说明该规则修正没有把现有正式流程带坏。
- 下一步继续补规则时，应优先找这类“规则真相明确、当前实现仍有局部写错”的点。

## 2026-05-31 12:56 +08 增补：大汗令箭的外交雇佣不再错接成调度

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：
  - `大汗令箭 -> 外交雇佣`
  - 地图提示与摘要是否真实显示雇佣军建立，而不是错误进入调度
- 非覆盖范围：完整外交标记系统、反/正面控制标记、朝鲜/正规军等完整外交禁用规则

### 本轮新增实现

- 当前最大的语义错位是：`外交雇佣` 以前被接成了 `调骑 4` 的调度目标选择，这和规则原文无关。
- 这轮先把它收成更接近规则、也更诚实的最小正式版：
  - 选择 `外交雇佣` 后，不再进入 `dispatch-targeting`
  - 改为在当前蒙古控制区建立 `2` 个等级 `2` 雇佣军
  - 区域总兵力 `+2`
  - 同时把 `mongol-mercenary-lv2` 正式写入 `specialTroops`
- 摘要和日志明确标注：
  - 当前最小正式实现先结算雇佣军建立
  - 外交标记链后续补齐
- 这一步的目的不是冒充“外交雇佣已完整实现”，而是先把“完全错误的调度链”替换成“规则方向正确的最小雇佣链”。

### 关键截图核对

#### 大汗令箭 · 外交雇佣

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-khan-edict-hire-current.png`
- 我实际看到：
  - 当前玩家为 `蒙古`
  - 选择 `外交雇佣` 后，没有再出现调度目标列表
  - 右侧摘要显示 `大汗令箭`、`外交雇佣` 与 `建立 2 个等级 2 雇佣军`
  - `山海关` 提示显示 `兵力 4`
  - 同一提示框额外显示 `特殊 雇佣军 x2（2级）`

### 关键断言

- `payment-selection.test.ts`
  - `大汗令箭选择外交雇佣后会在当前蒙古控制区建立雇佣军`
  - 直接断言 `specialTroops` 写入 `mongol-mercenary-lv2`
- `e2e/qidahen-basic-flow.e2e.ts`
  - 用例已改为 `大汗令箭选择外交雇佣后会在当前蒙古控制区建立雇佣军`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `158 passed`

```powershell
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
$env:PW_RUNTIME_SCOPE='qidahen-manual-e2e-20260531-1255'
$env:PW_PORT='6373'
$env:PW_GAME_SERVER_PORT='20200'
$env:GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
$env:API_SERVER_PORT='21200'
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'
npx playwright test e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨基础 Board E2E `15 passed`

### 当前结论

- `外交雇佣` 当前不再是明显错误的调度链。
- 当前最小正式语义已经变成“在蒙古控制区建立 2 个等级 2 雇佣军”，并正式落到状态与 UI。
- 下一步若继续补这条链，应优先接 `外交` 标记系统，而不是再回头把它接回调度。

## 2026-05-31 12:46 +08 增补：第二批粗值边正式收口，当前 15 条基础 E2E 继续保持通过

### 本轮新增范围

- 代码范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/mapGraph.test.ts`
- 数据范围：
  - `city-region-14::city-region-19`
  - `city-region-24::city-region-25`
  - `city-region-5::city-region-11`
- 非覆盖范围：整张图谱最终真值、所有剩余移动代价精修、`大汗令箭 -> 外交雇佣` 的完整规则语义

### 本轮新增实现

- 在“每轮只动少量最明显边”的口径下，继续只收 2 条最明显的低耗长边：
  - `city-region-14::city-region-19`：`2 -> 3`
  - `city-region-24::city-region-25`：`2 -> 3`
- 同时把数据里已是 `3`、但此前没写断言的 `city-region-5::city-region-11` 补回回归测试，避免这条已确认的粗值后面再被悄悄打回。

### 关键断言

- `mapGraph.test.ts`
  - `city-region-14 -> city-region-19 = 3`
  - `city-region-24 -> city-region-25 = 3`
  - `city-region-5 -> city-region-11 = 3`
- 并继续复跑七大恨当前玩法基线：
  - `movementRules.test.ts`
  - `payment-selection.test.ts`
  - `Board.test.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `158 passed`

默认 `BG_HEAVY_WAIT_FOR_BUDGET=1 node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts` 本轮没有形成业务红灯，阻塞原因是共享 single-worker 端口 `6273/20100/21100` 被其他运行占用。因此改用显式隔离端口的 legacy bootstrap 路径复跑：

```powershell
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
$env:PW_RUNTIME_SCOPE='qidahen-manual-e2e-20260531-1245'
$env:PW_PORT='6373'
$env:PW_GAME_SERVER_PORT='20200'
$env:GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
$env:API_SERVER_PORT='21200'
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'
npx playwright test e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨基础 Board E2E `15 passed`

### 当前结论

- 这批第二轮粗值边已经从“已改未验证”进入“已验证并留档”。
- 当前七大恨基础正式链仍保持 `15 passed`，说明地图粗值继续收紧后，没有把现有玩法基线带坏。
- 下一步应把主要精力转回明显的玩法语义错位，而不是继续在边值上无休止微调。

## 2026-05-31 12:29 +08 增补：图谱再收 3 条明显低耗长边，玩法基线继续保持绿

### 本轮新增范围

- 代码范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/mapGraph.test.ts`
- 数据范围：当前 `plain/city && travelCost<=2` 的长边候选中，最明显的 3 条普通长平原边
- 非覆盖范围：整张地图图谱最终真值、所有带强城防语义的边、完整七大恨全规则收口

### 本轮新增实现

- 重新按当前图谱的中心点距离筛选 `plain/city && travelCost<=2` 候选，并对照 `temp/qidahen-graph-overlay.png` 与 `temp/qidahen-region-centers-annotated.png`。
- 这轮只再收 3 条最明显的低耗长边：
  - `city-region-5::city-region-9`：`2 -> 3`
  - `city-region-13::city-region-15`：`2 -> 3`
  - `city-region-15::city-region-17`：`2 -> 3`
- 选择口径继续保持克制：
  - 不动 `city-region-24::jinzhou` 这类城防/攻城语义更重的边
  - 不做一轮全图泛调
  - 只把当前最刺眼的普通长边继续往更像地图的粗值推进

### 关键断言

- `mapGraph.test.ts`
  - `city-region-5 -> city-region-9 = 3`
  - `city-region-13 -> city-region-15 = 3`
  - `city-region-15 -> city-region-17 = 3`
- 并继续复跑七大恨当前玩法基线：
  - `movementRules.test.ts`
  - `payment-selection.test.ts`
  - `Board.test.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
BG_HEAVY_WAIT_FOR_BUDGET=1 node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `158 passed`
  - 七大恨基础 E2E `15 passed`

## 2026-05-31 12:14 +08 增补：川兵已从摘要占位补成结构化特殊部队状态

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/types.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：
  - `征召军队 -> 建立 2 个等级 4 川兵`
  - 地图提示与摘要是否真正显示川兵状态，而不是只写一条“低保真近似”文案
- 非覆盖范围：完整兵种/等级战斗系统、川兵专属作战规则、炮骑步完整建模

### 本轮新增实现

- `QidahenRegionSummary` 新增 `specialTroops`，用于记录区域里的特殊部队堆叠。
- `征召军队` 选择 `建立 2 个等级 4 川兵` 后，目标区现在会：
  - 总兵力 `+2`
  - 同时写入 `川兵 x2（4级）`
- `Board.tsx` 的地图提示已开始显示 `特殊 川兵 x2（4级）`，不再只有总兵力。
- 摘要和日志口径也同步改成：
  - 明确是 `建立 2 个等级 4 川兵部队`
  - 明确状态已记录为 `川兵 x2（4级）`

### 关键截图核对

#### 征召军队 · 川兵

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-recruit-chuanbing-current.png`
- 我实际看到：
  - 当前玩家为 `大明`
  - `皮岛` 提示显示 `兵力 4`
  - 同一提示框里额外显示 `特殊 川兵 x2（4级）`
  - 右侧摘要显示 `建立 2 个等级 4 川兵部队`

### 关键断言

- `payment-selection.test.ts`
  - `征召军队选择川兵后会记录特殊部队并保留总兵力 +2`
  - 当前已直接断言 `specialTroops` 写入 `ming-chuanbing-lv4`
- `e2e/qidahen-basic-flow.e2e.ts`
  - 新增 `征召军队选择川兵后会在地图提示里显示特殊部队记录`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
BG_HEAVY_WAIT_FOR_BUDGET=1 node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `158 passed`
  - 七大恨基础 E2E `15 passed`

## 2026-05-31 11:16 +08 增补：大汗令箭外交雇佣分支与战后处理摘要也已进入正式 E2E 基线

### 本轮新增范围

- 代码范围：`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：
  - `大汗令箭 -> 外交雇佣 -> 调度目标选择 -> 锁定目标`
  - `轮盘进攻调度 -> 战后处理 -> 占领` 收口后的正式摘要
- 非覆盖范围：大汗令箭完整多人链、轮盘全部语义定稿、战斗骰与人物系统完整实现

### 本轮新增实现

- 新增正式 Board E2E：
  - `大汗令箭选择外交雇佣后会进入调度目标选择并可锁定目标`
- 这条 E2E 用 test harness 注入“蒙古控制山海关、大明控制宁远”的局面，证明：
  - 点击 `大汗令箭`
  - 选择 `外交雇佣`
  - 进入 `大汗令箭 · 调骑 4（免支付）`
  - 可以在真实 Board 上锁定 `宁远`
  - 并进入正式 `调度进攻待结算`
- 同时把既有 `轮盘进攻调度会按地图连线生成待结算目标` 用例补强为：
  - 在 `战后处理 -> 占领` 后
  - 必须看到 `战后处理` 摘要
  - 不再只证明地图状态变化

### 关键截图核对

#### 大汗令箭 · 外交雇佣

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-khan-edict-hire-current.png`
- 我实际看到：
  - 当前玩家为 `蒙古`
  - 已从 `大汗令箭` 进入 `外交雇佣`
  - 右侧出现 `大汗令箭 · 调骑 4（免支付）`
  - 可锁定 `宁远`

### 关键断言

- `e2e/qidahen-basic-flow.e2e.ts`
  - `大汗令箭选择外交雇佣后会进入调度目标选择并可锁定目标`
  - `轮盘进攻调度会按地图连线生成待结算目标`
    - 当前已继续断言 `战后处理` 摘要必须出现

### 本轮验证

```powershell
BG_HEAVY_WAIT_FOR_BUDGET=1 node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨基础 E2E `14 passed`

## 2026-05-31 11:05 +08 增补：联姻诱降真实 Board 收口与正式摘要补齐

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 验证范围：后金 `联姻诱降` 失败结算在真实 `/play/qidahen/tutorial` Board 上的完整链路，以及 pending / 战后处理类结算在 UI 上的正式摘要收口
- 非覆盖范围：联姻诱降完整多人对抗、围城/兵种细分、轮盘全部语义最终定稿

### 本轮新增实现

- 先补了一条新的正式 Board E2E：`联姻诱降失败时会在真实 Board 上改控并只留下 1 个转阵营部队`。
- 这条 E2E 首次跑时暴露出真实 UI 缺口：`联姻诱降` 在结算后会改地图状态，但没有像其他正式动作一样把结果抬到 `season summary` 面板。
- 当前已在域层统一补齐：
  - `PENDING_ACTION_RESOLVED`
  - `POST_BATTLE_DECISION_RESOLVED`
  这两类正式结算不再只写 `actionLog`，还会统一生成 `lastSeasonSummary`。
- 这样补完后：
  - `联姻诱降` 结算后会出现正式摘要
  - 战后处理收口也会保持同一口径，不再出现“地图变了，但没有正式摘要”的裂缝

### 关键截图核对

#### 联姻诱降失败结算

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-marriage-subjugation-current.png`
- 我实际看到：
  - 当前玩家为 `后金`
  - `山海关` 由 `大明` 变为 `后金`
  - 区域提示兵力变成 `1`
  - 同屏出现 `联姻诱降` 摘要，不再只是地图状态变化

### 关键断言

- `payment-selection.test.ts`
  - `后金联姻诱降会按守军手牌支付结算并保留山海关控制权`
  - `联姻诱降失败时会消灭原守军并只留下 1 个转阵营部队`
  - 上述两条现在都要求产出 `联姻诱降` 摘要
- `e2e/qidahen-basic-flow.e2e.ts`
  - 新增 `联姻诱降失败时会在真实 Board 上改控并只留下 1 个转阵营部队`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
BG_HEAVY_WAIT_FOR_BUDGET=1 node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `157 passed`
  - 七大恨基础 E2E `13 passed`

## 2026-05-31 10:38 +08 增补：图谱再收 4 条最明显长平原边，基础 Board 流程继续保持绿

### 本轮新增范围

- 代码范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/mapGraph.test.ts`
- 数据范围：图谱里当前仍为 `travelCost<=2` 的长平原边中，最容易一眼看出偏低的 4 条候选
- 非覆盖范围：整张地图图谱最终真值、所有带城防/长城特殊语义边的逐条定稿、完整七大恨全规则收口

### 本轮新增实现

- 继续以 `temp/qidahen-graph-overlay.png` 和 `temp/qidahen-region-centers-annotated.png` 为直接依据，不再泛调，只收当前最明显的 4 条长平原边：
  - `city-region-14::city-region-16`：`2 -> 3`
  - `city-region-16::city-region-8`：`2 -> 3`
  - `city-region-24::city-region-27`：`2 -> 3`
  - `city-region-27::city-region-30`：`2 -> 3`
- 选择口径仍然克制：
  - 不动 `city-region-24::jinzhou` 这类明显带攻城语义的边
  - 不动 `city-region-5::city-region-9` 这类仍可能需要更多地图语义判断的长边
- 这一步的目标不是“图谱完全正确”，而是把最影响当前移动手感的剩余低耗长边继续往粗可用方向推。

### 关键断言

- `mapGraph.test.ts`
  - `city-region-14 -> city-region-16 = 3`
  - `city-region-8 -> city-region-16 = 3`
  - `city-region-24 -> city-region-27 = 3`
  - `city-region-27 -> city-region-30 = 3`
- 并继续复跑七大恨当前基础玩法门禁：
  - `movementRules.test.ts`
  - `payment-selection.test.ts`
  - `Board.test.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
BG_HEAVY_WAIT_FOR_BUDGET=1 node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `157 passed`
  - 七大恨基础 E2E `12 passed`

## 2026-05-31 10:15 +08 增补：继续按中心点距离收两条剩余低耗长边

### 本轮新增范围

- 代码范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/mapGraph.test.ts`
- 数据范围：图谱里仍为 `travelCost<=2` 的 `plain/city` 长边剩余候选
- 非覆盖范围：整张图谱最终定稿、所有特殊城防边逐条人工精修、轮盘/人物等完整规则语义

### 本轮新增实现

- 为避免继续凭感觉泛调，本轮先按当前 `region-graph.json` 的中心点距离，把 `plain/city && travelCost<=2` 的边做了剩余长边排序。
- 在排序里，前两条且不涉及明显特殊城防语义的候选是：
  - `city-region-10::city-region-15`：距离约 `182px`
  - `city-region-14::city-region-17`：距离约 `182px`
- 当前把这两条都从 `2 -> 3`。
- 同时继续保留以下候选暂不动：
  - `city-region-24::jinzhou`
  - `city-region-5::city-region-9`
  - 原因是它们更贴近城防/复杂印刷区语义，不适合在没有更多依据时继续硬抬。

### 关键断言

- `mapGraph.test.ts`
  - `city-region-10 -> city-region-15 = 3`
  - `city-region-14 -> city-region-17 = 3`
- 并继续复跑七大恨基础运行时门禁：
  - `movementRules.test.ts`
  - `payment-selection.test.ts`
  - `Board.test.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `157 passed`
  - 七大恨基础 E2E `12 passed`

## 2026-05-31 10:02 +08 增补：图谱再收两条最突兀长边，基础玩法链继续保持跑通

### 本轮新增范围

- 代码范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/mapGraph.test.ts`
- 数据范围：七大恨地图移动图谱中最明显仍偏低的少量平原长边
- 非覆盖范围：整张地图全部边值最终真值、区域工具继续微调、完整 AI/联机对局

### 本轮新增实现

- 重新对照 `temp/qidahen-graph-overlay.png` 与 `temp/qidahen-region-centers-annotated.png` 后，本轮只再抬两条最明显仍偏低的长平原边：
  - `city-region-26::city-region-31`：`2 -> 3`
  - `city-region-32::city-region-33`：`2 -> 3`
- 选择口径仍然克制：
  - 不泛调
  - 不追求一次图谱全对
  - 只收当前一眼最刺眼、且改完后不太容易反悔的粗值边

### 关键断言

- `mapGraph.test.ts`
  - `city-region-26 -> city-region-31 = 3`
  - `city-region-32 -> city-region-33 = 3`
- 同时继续复跑七大恨运行时相关回归，证明现有玩法链没有被带坏：
  - `movementRules.test.ts`
  - `payment-selection.test.ts`
  - `Board.test.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `157 passed`
  - 七大恨基础 E2E `12 passed`

## 2026-05-31 09:56 +08 增补：马市贸易补成真实 1-3 建兵选择链

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/domain/commands.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 规则范围：蒙古 `马市贸易`
- 非覆盖范围：多人联机下真正由大明玩家确认的跨席位交互、完整 AI 决策、其它未落地蒙古势力规则

### 本轮新增实现

- `马市贸易` 不再直接按人口自动结算。
- 当前正式链为：
  - 先弃 1 张牌
  - 进入 `qidahen-ma-shi-trade-selection`
  - 锁定当前大明控制区，并给出 `建立 1 / 2 / 3 个部队` 三个选项
  - 选择后再给目标区增加对应部队，并让蒙古抽取 `2 倍张数` 的手牌
- Board 右侧新增 `马市贸易` 选择面板，允许在同屏直接完成这条规则链。

### 关键断言

- `payment-selection.test.ts`
  - `马市贸易执行后会先进入建立 1-3 部队的选择状态`
  - `马市贸易在选择建立 3 个部队后会给大明加兵，并让蒙古抽 6 张手牌`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `马市贸易会先进入 1-3 建兵选择，再按选择给大明加兵并让蒙古摸牌`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `148 passed`
  - 七大恨基础 E2E `12 passed`

### 截图证据

- `temp/qidahen-board-ma-shi-trade-current.png`
  - 当前能看到 `马市贸易` 摘要已从旧的自动人口结算，切成“建立 3 个部队 / 获得 6 张手牌”的选择后结果
  - 当前截图对应 `皮岛` 被选为目标区、确认 `建立 3` 后的状态
  - 选择面板本身由同条 E2E 断言 `qidahen-ma-shi-trade-selection / qidahen-ma-shi-trade-choice-*` 覆盖

## 2026-05-31 09:40 +08 增补：大汗令箭补成真实二选一交互

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/domain/commands.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 规则范围：蒙古 `大汗令箭`
- 非覆盖范围：蒙古势力其它未落地规则、完整多人联机/AI 对局、完整轮盘全部战斗变体

### 本轮新增实现

- `大汗令箭` 不再直接等同于“调骑 4”。
- 当前正式链为：
  - 先弃 1 张牌
  - 进入 `征兵训练 / 外交雇佣` 二选一
  - 选 `征兵训练`：当前蒙古控制区补 `2` 兵
  - 选 `外交雇佣`：再进入原有 `大汗令箭 · 调骑 4（免支付）` 调度目标选择
- Board 右侧新增 `qidahen-khan-edict-selection` 面板，允许显式点击两条分支。

### 关键断言

- `payment-selection.test.ts`
  - `大汗令箭在蒙古已有控制区时会先进入令箭效果选择`
  - `大汗令箭选择征兵训练后会给当前蒙古控制区增加 2 部队`
  - `大汗令箭选择外交雇佣后会进入地图调度目标选择`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `大汗令箭会先显示二选一，再可执行征兵训练`
  - 通过 test harness 注入“蒙古已控制山海关”的最小局面，证明 UI 真正出现二选一而不是只靠单测自证

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
BG_HEAVY_WAIT_FOR_BUDGET=1 node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts "大汗令箭会先显示二选一，再可执行征兵训练"
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `147 passed`
  - 定向 Board E2E `1 passed`

### 截图证据

- `temp/qidahen-board-khan-edict-current.png`
  - 当前能看到 `大汗令箭` 摘要已回写到右侧季节摘要面板
  - 当前截图对应 `征兵训练` 分支完成后的状态
  - 二选一面板本身由同条 E2E 断言 `qidahen-khan-edict-selection / qidahen-khan-edict-choice-*` 覆盖

## 2026-05-31 09:19 +08 增补：联姻诱降失败结算开始真实同步部队与势力总兵

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 规则范围：后金 `联姻诱降` 在守军无力支付时的最小正式结算
- 非覆盖范围：围城时只影响城外部队、完整兵种/炮兵转阵营细节、首都/长城以南之外的更细目标白名单

### 本轮新增实现

- 守军无法支付联姻代价时，不再只是：
  - 区域翻控
  - 目标区兵力拍成 `1`
- 当前会进一步做最小正式结算：
  - 原守军按该区原兵力全部扣除
  - 区域只留下 `1` 个转阵营后的后金部队
  - 后金势力总兵力同步 `+1`
  - 守方势力总兵力同步扣除该区原兵力
- 这一步仍是低保真版本，但已经不再是“只翻控不结兵”。

### 关键断言

- `payment-selection.test.ts`
  - `联姻诱降失败时会消灭原守军并只留下 1 个转阵营部队`
  - 断言：
    - `山海关` 变为 `后金 / 兵力 1`
    - 守方总兵力按该区原兵力扣减
    - 后金总兵力 `+1`
    - action log 包含 `守军未能支付代价`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `154 passed`
  - 七大恨基础 E2E `11 passed`

## 2026-05-31 09:12 +08 增补：基础 E2E 默认模式补稳定 heap，上轮 OOM 已清除

### 本轮新增范围

- 代码范围：`scripts/infra/run-e2e-command.mjs`
- 验证范围：`e2e/qidahen-basic-flow.e2e.ts` 默认模式 isolated runtime 的 API/bootstrap 稳定性
- 非覆盖范围：业务规则本体；这一步只解决验证运行时的内存稳定性

### 本轮新增实现

- 给 `run-e2e-command.mjs` 的以下模式统一补 `NODE_OPTIONS=--max-old-space-size=8192`：
  - `default`
  - `dev`
  - `isolated`
  - `critical`
  - `parallel`
- 目的不是改业务，而是避免默认模式下 API runtime 在 bootstrap 阶段偶发以小 heap 启动，导致 `code=134` 的 Node OOM。

### 复验结论

- 前一条 09:03 中记录的 `e2e-api-single runtime exited (code=134)` 已确认是运行时配置问题，不是七大恨业务断言失败。
- 本轮补齐默认 heap 后，重新复跑：

```powershell
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果已恢复为：
  - 七大恨基础 E2E `11 passed`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `153 passed`
  - 七大恨基础 E2E `11 passed`

## 2026-05-31 09:03 +08 增补：南侧长边粗值再收两条，联姻诱降补首都/朝鲜禁用门禁

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`。
- 数据范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/mapGraph.test.ts`。
- 规则范围：图谱南侧/西南侧最突兀的两条低耗长边，以及后金 `联姻诱降` 的高确定禁用目标。
- 非覆盖范围：联姻诱降“长城以南”全量区域枚举、围城只影响城外部队、完整多人协商与更细的兵种/炮兵转阵营处理。

### 本轮新增实现

- 图谱只做最小粗值修正，不再泛调：
  - `city-region-27::city-region-33`：`2 -> 3`
  - `city-region-30::city-region-31`：`2 -> 3`
- `联姻诱降` 当前补回两条高确定门禁：
  - 不能指定 `首都区域`
  - 不能指定 `朝鲜区域`
- 被门禁拦下时：
  - 不再消耗后金手牌
  - 不会错误进入 `联姻待结算`
  - 摘要与 action log 会明确提示被拦截原因

### 关键断言

- `mapGraph.test.ts`
  - `city-region-27::city-region-33 = 3`
  - `city-region-30::city-region-31 = 3`
- `payment-selection.test.ts`
  - `联姻诱降不能指定首都区域，且不会消耗手牌`
  - `联姻诱降不能指定朝鲜区域，且不会消耗手牌`
  - `联姻诱降不能指定长城以南区域，且不会消耗手牌`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `153 passed`
  - 七大恨基础 E2E 已在 09:12 增补中复跑恢复为 `11 passed`

## 2026-05-31 08:46 +08 增补：征召军队从固定 +2 改成更像规则的 +6 低保真版

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：大明势力行动 `征召军队` 的最小正式区域状态变化。
- 非覆盖范围：完整正规军/川兵兵种分流、真实“6 个等级 2 vs 2 个等级 4 川兵”选择链、部队配件上限与训练上限联动。

### 本轮新增实现

- `征召军队` 不再只是固定 `+2` 部队：
  - 当前会在选中的己方区域直接补入 `6` 个等级 2 部队；
  - 同步把大明总兵力一起增加 `6`；
  - 摘要里会明确写出“当前以低保真近似补入 6 个等级 2 部队”，不把粗实现冒充成完整兵种系统。
- 域层回归已更新：
  - 支付确认链与直接执行链现在都要求大明总兵力 `18 -> 24`
  - 样板区域兵力 `2 -> 8`
- 新增正式 Board E2E：
  - `征召军队会给当前己方区域补入 6 个部队`

### 关键截图核对

#### 征召军队直接把皮岛兵力补到 8

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-recruit-current.png`
- 我实际看到：在正式 `/play/qidahen/tutorial` Board 上选中 `皮岛` 后执行 `征召军队`，右侧摘要标题直接显示 `征召军队`。
- 我实际看到：摘要正文明确写有 `皮岛` 与 `低保真近似补入 6 个等级 2 部队`。
- 我实际看到：地图提示框里 `皮岛 · 大明` 的兵力已经从 `2` 变成 `8`，同时大明玩家条手牌显示为 `4/15`。
- 是否达到本轮验收：达到“征召军队不再是明显失真的 +2 临时值，而是开始真实改区域状态”的当前标准。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `150 passed`
  - 七大恨基础 E2E `11 passed`

## 2026-05-31 08:38 +08 增补：赐印招安从整区翻控改成真实拉兵转阵营

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：大明势力行动 `赐印招安` 的最小正式区域状态变化。
- 非覆盖范围：完整“必须由被指定玩家选择部队”的多人选择链、围城特例、多人在线同步。

### 本轮新增实现

- `赐印招安` 不再直接把整块区域改成大明控制：
  - 若当前选中的是相邻于大明控制区且有部队的敌方区域；
  - 则从该区域拉 `1` 个部队进入相邻的大明控制区；
  - 该部队转阵营成为大明部队；
  - 源区减 `1` 兵，目的区加 `1` 兵，同时同步大明/敌方势力兵力统计。
- 当前目的区按相邻大明控制区中的最高优先区自动确定，先保证正式地图状态变化能跑通。
- 新增域层回归：
  - `赐印招安执行后会把 1 个相邻敌军转入大明控制区域`
- 现有正式 Board E2E `可执行操作与支付仍走真实 Board 交互` 已按新语义改完。

### 关键截图核对

#### 赐印招安把锦州 1 兵拉入山海关

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-action-flow-current.png`
- 我实际看到：在正式 `/play/qidahen/tutorial` Board 上选中 `锦州` 后执行 `赐印招安`，右侧摘要卡会出现 `赐印招安`，正文包含 `锦州` 与 `山海关`。
- 我实际看到：随后选中 `山海关`，提示框仍显示 `山海关 · 大明`，兵力已经从 `2` 变成 `3`。
- 我实际看到：这条链不再把 `锦州` 直接翻成大明控制，说明当前正式语义已经从“整区翻控”拉回到“拉 1 兵转阵营”。
- 是否达到本轮验收：达到“赐印招安不再明显违背规则核心语义”的当前标准。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `150 passed`
  - 七大恨基础 E2E `10 passed`

## 2026-05-31 08:30 +08 增补：驱虎吞狼开始真正进入地图调度与待结算链

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：大明势力行动 `驱虎吞狼` 的最小正式指挥链。
- 非覆盖范围：完整“需该玩家同意才可执行”协商链、完整战术牌/撤退/劫掠细则、多人在线同步。

### 本轮新增实现

- `驱虎吞狼` 不再只让目标对手抽 6 张牌：
  - 若当前选中的是对手控制区，则先让该对手抽 6 张牌；
  - 随后直接进入 `dispatch-targeting`；
  - 由大明为该对手锁定 `调度进攻` 目标；
  - 待结算链已正式使用 `actionId=drive-tiger`，并复用现有地图可达、边界限制、战斗与战后处理主链。
- 本轮顺手修正了调度目标选择里的一个真实错位：
  - 以前 `大汗令箭 / 驱虎吞狼` 在切换源区时会错误按“当前玩家势力”重建候选；
  - 现在会保持各自真实攻击方口径，不会退回普通轮盘口径。
- 新增域层回归：
  - `驱虎吞狼执行后会让目标对手抽 6 张牌并进入指挥调度目标选择`
  - `驱虎吞狼在锁定目标后会进入待结算并保留指挥方为后金`
- 新增正式 Board E2E：
  - `驱虎吞狼会让目标对手抽牌并进入指挥调度目标选择`

### 关键截图核对

#### 驱虎吞狼进入指挥调度并可转入待结算

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-drive-tiger-dispatch-current.png`
- 我实际看到：当前在正式 `/play/qidahen/tutorial` Board 上选中 `锦州` 后，执行 `驱虎吞狼`，顶部后金手牌数从 `8/10` 变成 `14/10`。
- 我实际看到：右侧不再只是结束在一条日志，而是直接出现 `驱虎吞狼 · 指挥后金调度进攻` 的目标选择卡。
- 我实际看到：点击一个候选目标后，右侧进入 `驱虎吞狼待结算`，并显示 `源兵 / 投入 / 压力`，说明这条链已经正式吃到地图连线和战斗待结算结构。
- 是否达到本轮验收：达到“驱虎吞狼不再是抽牌空壳，而是开始真正消费地图调度与战斗链”的当前标准。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `150 passed`
  - 七大恨基础 E2E `10 passed`

## 2026-05-31 08:18 +08 增补：马市贸易开始真正改区域与手牌状态

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：蒙古势力行动 `马市贸易` 的最小正式效果。
- 非覆盖范围：完整蒙古行动树、真实“大明选择 1-3”交互、完整驱虎吞狼指挥链、多人联机同步。

### 本轮新增实现

- `马市贸易` 不再只是动作目录里的文案：
  - 若当前选中的是大明控制区，则按该区人口给大明该区增加 `1-3` 个部队；
  - 当前粗规则为 `min(3, max(1, 人口))`，目的是先把玩法链跑通，而不是一次把精细平衡做死；
  - 蒙古获得双倍数量的手牌；
  - 若当前未选中有效大明区，则回退到当前最优大明控制区结算。
- 结果会复用现有摘要面板即时显示，不再只写 action log。
- 新增域层回归：
  - `马市贸易会按目标区人口给大明加兵，并让蒙古抽双倍手牌`
- 新增正式 Board E2E：
  - `马市贸易会给选中的大明区域加兵，并让蒙古获得双倍手牌`

### 关键截图核对

#### 马市贸易直接改皮岛兵力并让蒙古摸牌

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-ma-shi-trade-current.png`
- 我实际看到：先推进到蒙古回合，再选中 `皮岛` 执行 `马市贸易` 后，右侧摘要卡标题直接显示 `马市贸易`。
- 我实际看到：摘要正文明确写到 `蒙古在 皮岛 发动马市贸易，大明该区部队 +2`，并写到 `蒙古因马市贸易获得 4 张手牌`。
- 我实际看到：地图提示框里 `皮岛 · 大明` 的兵力已经从 `2` 变成 `4`，同时蒙古玩家条手牌显示为 `9/10`。
- 是否达到本轮验收：达到“第二条蒙古势力行动开始正式消费区域与手牌状态”的当前标准。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `149 passed`
  - 七大恨基础 E2E `9 passed`

## 2026-05-31 07:12 +08 增补：战后处理复验收口、候选列表遮挡修复、开局配置再下沉

### 本轮新增范围

- 代码范围：`src/games/qidahen/Board.tsx`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/regionConfig.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：调度进攻后的战后处理样例、低保真互损但未突破的负例、右侧调度目标列表的可点击性，以及开局关键区初始数据的配置化。
- 非覆盖范围：完整战术牌、围城、兵种差异、完整撤退链和多人在线同步。

### 本轮新增实现

- 修正了战后处理验收样例：当前低保真战斗下，`皮岛 2` 打 `辽西 2` 会互损后不突破，因此不应再把 `辽西` 当作进入 `战后处理` 的正例；E2E 现改为选择真正可突破的 `东江`。
- 域层新增负向回归：`调度进攻打入有守军区域时会互损但未突破，不进入战后处理`，把当前互损语义锁住，防止后续又靠错误样例把断言写绿。
- 修掉了真实 UI 阻塞：`ActionsZone` 从 `z-30` 提到 `z-40`，右侧 `轮盘进攻/调度` 目标列表和 `战后处理` 卡片不再被底部手牌 dock 压住；此前 `东江/中立` 候选按钮会被 `qidahen-bottom-dock` 拦截 pointer。
- 继续把规则数据往配置层收：`regionConfig.ts` 新增 `initialTroops / initialPopulation / initialNote`，`辽西 / 锦州 / 皮岛 / 山海关 / 咸兴` 等开局关键区的控制权、兵力、人口和说明统一回到配置入口，`domain/index.ts` 不再维护多组平行 override 常量。

### 关键截图核对

#### 调度目标选择恢复可点击

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-selection-current.png`
- 我实际看到：右侧候选列表现在完整浮在底部 hand dock 之上，`辽西 / 东江 / 中立` 三个目标项都处于同一块调度目标卡内，不再被底部手牌带吃掉下半截。
- 我实际看到：地图仍高亮 `皮岛` 的可达区，右侧文案保持 `轮盘进攻/调度 · 调骑 4 / 源区 皮岛`，说明这次修的是层级和可点性，不是把交互路线改没了。

#### 进入战后处理并占领东江

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-post-battle-current.png`
- 我实际看到：当前正式样例已从 `辽西` 切到 `东江`；右侧出现 `战后处理`，并给出 `占领该区` 与回退选项。
- 我实际看到：战后处理摘要里能直接读到损失/幸存信息，说明这次复验覆盖的是“攻方损伤已经真正接进运行时”之后的版本，不是旧的零损伤样例。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `144 passed`
  - 七大恨基础 E2E `7 passed`

## 2026-05-31 07:32 +08 增补：轮盘开垦/军屯/征兵训练开始真正改区域状态

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/wheelRules.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：轮盘 `开垦`、`军屯`、`征兵训练` 三个此前仍偏空壳的扇区最小正式效果。
- 非覆盖范围：完整征兵上限、兵种等级、完整外交/雇佣/攻击扇区、真实人物牌与完整战斗链。

### 本轮新增实现

- 新增 `wheelRules.ts` 作为轮盘效果最小配置入口，不再把这些效果继续散写在 `domain/index.ts` 里：
  - `wheel-reclaim`：己方区人口 `+1`
  - `wheel-military-farm`：己方区部队 `+1`，并摸 `2` 张牌
  - `wheel-recruit-train`：己方区部队 `+2`
- `domain/index.ts` 新增 `applyWheelImmediateEffect()`：
  - 优先对当前选中的己方区域结算；
  - 若当前选中区不是己方区，则回退到当前势力首选己方区；
  - 结果会复用现有摘要面板即时显示，不再只有 action log。
- 域层回归新增 3 条，分别锁住开垦加人口、军屯加兵摸牌、征兵训练加兵。
- E2E 新增 `轮盘征兵训练会直接给当前己方区域增加部队`，作为非调度轮盘格已正式可玩的最小证据。

### 关键截图核对

#### 轮盘征兵训练直接改区域兵力

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-recruit-train-current.png`
- 我实际看到：当前在正式 `/play/qidahen/tutorial` Board 上选中 `皮岛` 后，执行 `免费走 1`，轮盘落点进入 `征兵/训练`。
- 我实际看到：右侧摘要卡标题直接显示 `轮盘征兵/训练`，正文写明 `大明在 皮岛 执行征兵训练，部队 +2`。
- 我实际看到：地图提示框里 `皮岛 · 大明` 的兵力已经从 `2` 变成 `4`，说明这不是只记一条日志，而是区域状态真的改了。
- 是否达到本轮验收：达到“轮盘非调度扇区开始正式消费区域数据并反馈到 Board”的当前标准。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `147 passed`
  - 七大恨基础 E2E `8 passed`

## 2026-05-31 07:46 +08 增补：继续按底图收最突兀的剩余长边

### 本轮新增范围

- 数据范围：`src/games/qidahen/data/region-graph.json`
- 测试范围：`src/games/qidahen/__tests__/mapGraph.test.ts`
- 验证范围：七大恨当前 Board 最小玩法链是否仍保持通过

### 本轮新增实现

- 重新对当前图谱做“长边且仍低耗”的定向复核，只收最突兀的两条，不泛调整表：
  - `city-region-22::city-region-28`：`2 -> 3`
  - `city-region-5::xian-xing`：`2 -> 3`
- 这两条一条横跨东江至区域 28，一条贯通区域 5 至咸兴，在当前 `plain/city && travelCost<=2` 的列表里最容易一眼看出过低。
- 对应回归已补到 `mapGraph.test.ts`，避免后续又回退成默认值。

### 当前图谱复核结论

- 本轮补完后，当前 `plain/city && travelCost<=2` 的最长可疑边首位已经变成 `city-region-16::city-region-20 = 2`。
- 也就是说，上一轮还最突兀的两条超长低耗边已经从这份列表里退下去。
- 这不等于图谱已经完全正确，只能证明：当前又向“更像地图的一版粗值”推进了一步。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `147 passed`
  - 七大恨基础 E2E `8 passed`

## 2026-05-31 07:58 +08 增补：大汗令箭开始正式消费地图调度链

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`
- 规则范围：蒙古势力行动 `大汗令箭`
- 非覆盖范围：完整蒙古势力行动树、`马市贸易`、更完整蒙古开局与人物链

### 本轮新增实现

- 新增 `buildKhanEdictDispatchSelection()`：
  - 当蒙古已有控制区且存在可达目标时，
  - `khan-edict` 不再只是支付后记日志，
  - 会直接进入现有 `dispatch-targeting` 状态，
  - 复用当前 `wheelDispatchSelection` 候选列表与地图高亮链。
- 当前约束文案为：`大汗令箭 · 调骑 4（免支付）`。
- 这意味着七大恨当前至少已经有一条非轮盘来源的势力行动，开始正式消费地图连线与可达搜索。

### 关键断言

- 新增域层回归：
  - 将 `山海关` 调成蒙古控制、`宁远` 调成大明控制后，
  - 执行 `大汗令箭` 会进入 `dispatch-targeting`
  - 并能在候选目标里读到 `宁远`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `148 passed`
  - 七大恨基础 E2E `8 passed`

## 2026-05-31 05:58 +08 增补：调度目标选择与第四轮边值粗调

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`src/games/qidahen/__tests__/mapGraph.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：轮盘 `进攻/调度` 的最小正式目标选择链，以及当前图谱第 4 轮明显长平原边粗值修正。
- 非覆盖范围：完整 6 部队调度、步兵/骑兵混编、进入中立后自动生成中立军、围城/战后移动、完整战斗与战术牌链。

### 本轮新增实现

- 轮盘 `进攻/调度` 不再自动替玩家挑目标；现在会先进入 `选择调度目标` 状态，右侧列出候选目标，地图同步高亮可达区域。
- 候选目标支持两种入口：点击右侧候选按钮，或直接点击地图高亮区域；两条入口都走同一个 `SELECT_REGION` 链，不再分叉出第二套命令。
- 候选排序修正为：`敌方优先 -> 移动耗费更低优先 -> 路径更短优先`。旧实现里排序方向反了，会把更远敌区排到前面；这一轮已经纠正。
- 图谱又补了一轮粗值，把 6 条明显超长但仍是 `plain=1` 的边抬成 `2`：`city-region-14::city-region-16`、`city-region-16::city-region-8`、`city-region-24::city-region-25`、`city-region-24::city-region-27`、`city-region-26::city-region-31`、`city-region-27::city-region-30`。

### 关键截图核对

#### 进入调度目标选择

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-selection-current.png`
- 我实际看到：当前源区是 `皮岛 · 大明`，地图上有高亮候选区，右侧明确出现 `轮盘进攻/调度 · 调骑 4` 和 `源区 皮岛`。
- 我实际看到：右侧候选列表至少给出 `辽西 / 东江 / 中立` 三个目标项，并直接显示 `耗 2` 与完整路径摘要，不再是自动跳过选择直接进入待结算。
- 是否达到本轮验收：达到“先选源区，再选目标”的当前正式链路标准。

#### 选中目标后进入待结算

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-current.png`
- 我实际看到：点击地图目标后，右侧进入 `调度进攻待结算`，明确显示 `目标 辽西 · 防守 后金`。
- 我实际看到：提示文案里能直接读到 `皮岛 → 辽西 · 耗2 · 海岸/水路 2`，说明待结算信息来自当前图谱与运行时移动 helper，而不是静态假文案。
- 是否达到本轮验收：达到“选目标后进入正式待结算”的当前标准。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `137 passed`
  - 七大恨基础 E2E `7 passed`

## 本轮修复

- 生图 skill 补强：用户布局草图是坐标合同；“非 UI 部分空白”不能产生底部/侧边无效留白；真实素材中已有的轮盘、牌堆、槽位、轨道、玩家板或 token 必须优先抽离、裁切、放大或贴合复用，禁止手绘近似控件冒充一致。
- 动作目录从单一 Ming 列表补成阵营化目录：Ming / Mongol / Jin 的具体行动都能从规则文本里找到对应来源；目前 UI 仍展示 Ming 当前行动列，但规则目录已经可按阵营取值，不再只有一份空泛动作表。
- 轮盘实现改为从真实 `main-board` 裁出左上轮盘本体，再叠可点击 SVG 扇区、当前位标记和短摘要；不再只靠抽象 SVG 画一个相似轮盘。
- 轮盘移动可视化继续收口：三种移动方式仍是规则上的三种选择，但不再用三块厚重扇区盖住完整轮盘；现在改成更轻的可点击目标标记，尽量把真实 8 格轮盘还给底图。
- 纪年卡从单卡改为两张同位展示：今年与下一年同时可见，不再误看成只有一张。
- 底部手牌区域去掉了额外半透明罩层，只保留布局承载，不再在手牌后面铺一整块发亮托盘。
- 底部改为一个贴底实体簇：`牌库 | 手牌 | 弃牌` 共用底座和中心线，抽牌/弃牌不再分别贴到屏幕左右角。
- 纪年卡保留一个可见位置；右侧只保留朝鲜牌库/弃牌和具体行动 rail，不显示行动记录、流程说明、结束行动等无关 UI。
- 七大恨页面隐藏共享 `FabMenu`，避免聊天/设置/反馈悬浮球进入本轮 UI 白名单外的画面；E2E 断言 `data-testid="fab-menu"` 不存在。
- 结构单测增加 `qidahen-wheel-board-crop`、`qidahen-bottom-dock`，并禁止旧的左右角牌堆锚点字符串回流。

## 关键截图核对

### 初始桌面 Board

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-current.png`
- 我实际看到：主地图铺满舞台，顶部为大明/蒙古/后金薄状态条；左上轮盘是主棋盘真实轮盘裁切出的本体，红色当前位标记和 `+1/+2/+3` 命中扇区叠在轮盘上，不再有轮盘旁按钮板。
- 我实际看到：轮盘高亮已经明显变轻，真实 8 格轮盘底图比上一版更清楚，不再像三块厚扇区把轮盘盖住。
- 我实际看到：右上是朝鲜牌库和朝鲜弃牌，右侧中段是具体行动 `突袭作战 / 征召军队 / 赐印招安 / 驱虎吞狼`，没有行动记录、流程条、地图工具或全局聊天悬浮球。
- 我实际看到：左下现在能同时看到今年纪年卡和下一年纪年卡，不再只剩一张；底部牌库、手牌、弃牌仍在同一条底部带，但手牌后面那层半透明罩子已经收掉，视觉更接近“牌实体直接落在桌面上”。
- 是否达到本轮验收：达到“真实轮盘本体、两张纪年卡、底部去罩层、去无关 UI”的基础桌面验收。截图仍只证明 1600x900 桌面主链路，移动端和完整规则结算未覆盖。

### 轮盘移动与行动选择后

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-wheel-flow-current.png`
- 我实际看到：最终稳定图里，点击轮盘本体上的 `+3` 扇区后，轮盘当前位标记已经移动，摘要为“所有对手抽 2，走 3：蒙古、后金各抽 2”；顶部蒙古从 `6/10` 变为 `8/10`，后金从 `8/10` 变为 `10/10`。
- 我实际看到：这次轮盘上的三种移动目标从厚重扇区降成了轻目标标记，轮盘本体本身更像原图，不再像只剩三个大选项。
- E2E 断言确认：点击右侧“征召军队”后，支付提示先变为 `需弃 1 / 已选 0`；这一步只作为流程断言，不单独保留到 `test-results` 版本链。
- 是否达到本轮验收：达到基础玩家流程标准：真实入口进入、点击核心交互对象、状态可见变化、下一步支付态可继续。

### 支付手牌执行前（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-flow-before-execute.png`
- 我实际看到：在已选中 `征召军队` 后，再点击底部手牌 `hand-4`，支付提示从 `需弃 1 / 已选 0` 变成 `需弃 1 / 已选 1`，说明支付牌确实写入了当前状态。
- 我实际看到：被点中的手牌卡面出现 `已选` 标记，而不是只改了顶部提示；这证明“支付选择”和“状态显示”是同一条链路，不是单独飘一个文案。
- 是否达到本轮验收：达到。这里证明的是“选牌”本身已经生效，但它是临时核对图，不作为对外稳定交付物。

### 支付执行后（稳定交付）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-wheel-flow-current.png`
- 我实际看到：执行后支付提示回到 `需弃 1 / 已选 0`，说明已选牌被清空，流程回到了下一轮可继续推进的状态。
- 我实际看到：大明手牌数从 `5/15` 变为 `4/15`，弃牌堆从 `7` 变为 `8`，底部手牌从 6 张变为 5 张，`手城` 区域提示里部队数从 `3` 变为 `5`，说明“支付执行”真的改了资源状态，而不是只改提示文案。
- 是否达到本轮验收：达到。当前稳定交付物已经能证明整条链路从选行动、选支付牌到执行结算都闭合了。

### 赐印招安目标执行（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-grant-pardon-after-execute.png`
- 我实际看到：点击 `锦州` 后，区域提示先显示 `控制 后金`；选择 `赐印招安`、支付 3 张手牌并执行后，区域提示改为 `控制 大明`，部队数为 `2`。
- 我实际看到：执行后顶部大明手牌数变为 `2/15`，弃牌堆变为 `10`；这说明目标选择和支付执行已经真的把区域控制与手牌资源一起改掉了。
- 是否达到本轮验收：达到。这个临时核对图证明了 `赐印招安` 的目标路径不是空壳。

### 驱虎吞狼目标执行（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-drive-tiger-after-execute.png`
- 我实际看到：点击 `锦州` 后，区域提示保持 `控制 后金`；选择 `驱虎吞狼`、支付 3 张手牌并执行后，顶部后金手牌数从 `8/10` 变为 `14/10`。
- 我实际看到：执行后顶部大明手牌数变为 `2/15`，弃牌堆变为 `10`；这说明目标对手抽牌和支付弃牌同时生效。
- 是否达到本轮验收：达到。这个临时核对图证明了 `驱虎吞狼` 的目标对手抽牌路径不是空壳。

### 突袭作战待结算（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-raid-after-execute.png`
- 我实际看到：点击 `锦州` 后，区域提示保持 `控制 后金`；选择 `突袭作战`、支付 1 张手牌并执行后，锦州提示里新增了 `突袭待结算 / 目标 锦州 / 防守 后金 / 仅进攻行动`。
- 我实际看到：顶部大明手牌数从 `5/15` 变为 `4/15`，弃牌堆从 `7` 变为 `8`；这说明突袭不是只写了日志，而是真的进入了一个可见的进攻待结算状态。
- 是否达到本轮验收：达到。这个临时核对图证明了 `突袭作战` 的真实入口和可见状态已经接通。

### 手机横屏 Board（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-mobile-landscape-current.png`
- 我实际看到：手机横屏下主地图仍是中心主画布，不是缩在左上角；顶部三方状态条、右侧动作 rail、右上朝鲜牌堆、左上轮盘和底部 dock 都还在同一套坐标关系里。
- 我实际看到：底部 `牌库 + 手牌 + 弃牌` 仍作为完整簇出现，手牌不是被压成窄栏或竖排列表；右侧动作区仍能直接看见 `突袭作战 / 征召军队 / 赐印招安 / 驱虎吞狼`。
- 是否达到本轮验收：达到手机横屏的基础可读/可操作门槛。它还不是“完整规则结算完结”证据，但已经证明当前移动端不是坏掉的桌面缩略图。

## 验证命令

```powershell
npx eslint src/games/qidahen/Board.tsx src/games/qidahen/__tests__/Board.test.ts src/components/game/framework/widgets/GameHUD.tsx e2e/qidahen-basic-flow.e2e.ts
npx vitest run src/games/qidahen/__tests__/Board.test.ts src/components/__tests__/GameHUDChatPreview.test.ts
npx tsc --noEmit --pretty false
npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/shared/__tests__/node-module-resolver.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx eslint scripts/infra/node-module-resolver.mjs scripts/infra/run-e2e-command.mjs scripts/infra/e2e-server-launcher.js scripts/infra/vitest-cli-safe.mjs scripts/infra/build-node-bundle.mjs scripts/infra/dev-bundle-runner.mjs src/shared/__tests__/node-module-resolver.test.ts
```

2026-05-17 15:29 复跑：`e2e/qidahen-basic-flow.e2e.ts` 当前为 5 tests passed，新增覆盖 `突袭作战` 执行后 `qidahen-raid-intent` 可见，以及手机横屏基础可读性。
2026-05-17 15:42 复跑：`src/games/qidahen/__tests__/payment-selection.test.ts` 现在 8 passed，补进阵营动作目录测试，`Ming / Mongol / Jin` 的规则来源已经能从同一 catalog 取值。
2026-05-17 16:27 复跑：`npx eslint src/games/qidahen/Board.tsx src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts` 通过；`npx tsc --noEmit --pretty false` 通过；`node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过；`npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts` 仍为 5 passed。
2026-05-31 03:00 +08 复跑：`npx tsc --noEmit --pretty false` 通过；`node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，当前为 `123 passed`；`node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts` 通过，当前为 `6 passed`。

## 2026-05-31 增补：年中/新年与防线维护

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/regionConfig.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：年中土地税赋、新年朝鲜朝贡、防线维护、兵力耗损，以及山海关/锦州/宁远/长城的最小破败降级。
- 非覆盖范围：完整人物判定掷骰链、围城耗损、中立耗损、大漠耗损、完整首都/霸权/威望胜利裁定。

### 本轮新增实现

- 正式补了七大恨区域元数据层：把朝鲜区域、维护目标、维护依赖、逻辑兼容区从 `index.ts` 杂糅常量里拆到 `regionConfig.ts`。
- 运行时新增防线状态：`外长城 / 内长城 / 山海关 / 宁远 / 锦州` 现在都有 `完整 / 破败` 状态，Board 右侧有常驻状态条。
- 轮盘走到 `年中` 时，当前会自动结算土地税赋，并在右侧结果面板展示 `年中结算` 摘要。
- 轮盘走到 `新年` 时，当前会自动结算朝鲜朝贡、防线维护与兵力耗损，并把年份推进到下一年。
- 山海关、锦州、宁远、长城破败后，运行时使用的区域边界会按当前状态降级，不再死读静态图谱。

### 关键截图核对

#### 年中/新年结算链路

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-season-flow-current.png`
- 我实际看到：右侧新增防线状态条，至少能直接读到 `山海关 · 破败` 与 `内长城 · 完整`。
- 我实际看到：右侧结果面板显示 `新年结算`，顶部年份已推进到 `天命五年 1620`。
- 我实际看到：整条链仍运行在正式 `/play/qidahen/tutorial` Board 上，不是单独工具页或假数据页。
- 是否达到本轮验收：达到“地图运行时 + 最小岁时流程 + 防线状态可见”的当前收口标准。

### 关键断言

- 域层新增回归：
  - `轮盘进入年中时会结算土地税赋并留下摘要`
  - `轮盘进入新年时会结算朝鲜朝贡、防线维护与兵力耗损`
- E2E 新增回归：
  - `轮盘跨过年中与新年时会显示结算摘要和防线状态`


补充说明：此前当前 worktree 缺少本地 `node_modules/playwright/cli.js`，标准 `npm run test:e2e:ci:file -- ...` 入口需要手工 `NODE_PATH` 和主仓库 Playwright CLI 才能跑通。现已补 `scripts/infra/node-module-resolver.mjs`，E2E / Vitest / tsx / esbuild-wasm 启动入口会优先使用当前 worktree 的依赖；当前 worktree 缺失时自动回退到上层仓库 `node_modules`，并把该回退行为纳入 `src/shared/__tests__/node-module-resolver.test.ts`。

本轮复跑标准入口时，日志明确输出：`当前 worktree 未找到本地 Playwright CLI，已回退到上级 node_modules: D:\gongzuo\webgame\BoardGame\node_modules\playwright\cli.js`，随后 `e2e/qidahen-basic-flow.e2e.ts` 通过。该结果证明当前不再需要为运行 E2E 临时修改业务代码或手工指定 Playwright CLI。

## 清理记录

- `test-results/evidence-screenshots/_shared/` 中本轮只保留两个稳定交付物：
  - `qidahen-board-desktop-current.png`
  - `qidahen-board-wheel-flow-current.png`
- 已删除 Playwright 本轮临时状态文件：`test-results/playwright-artifacts/.last-run.json`。
- 中间截图 `temp/qidahen-board-wheel-flow-before-execute.png`、`temp/qidahen-board-grant-pardon-after-execute.png`、`temp/qidahen-board-drive-tiger-after-execute.png`、`temp/qidahen-board-raid-after-execute.png`、`temp/qidahen-board-mobile-landscape-current.png` 和 prompt 仍位于 `temp/`，不作为对外 E2E 稳定交付物。

## 2026-05-31 03:40 +08 增补：移动代价与战场宽度正式拆分

### 本轮新增范围

- 代码范围：`src/games/qidahen/ui/mapGraph.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/regionConfig.ts`、`src/games/qidahen/Board.tsx`。
- 数据范围：`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/data/region-mask-regions.json`。
- 测试范围：`src/games/qidahen/__tests__/mapGraph.test.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。

### 本轮新增实现

- 不再把“移动代价”和“战场宽度”混在同一个字段里：
  - `travelCostByRegionId` 现在表示真实移动代价；
  - `movementCostByRegionId` 继续承载战场宽度，避免现有攻城/关隘/长城规则回退。
- `region-graph.json` 的边界元数据新增 `travelCost`，默认按边界类型给出一版低保真值：
  - `平原/攻城/关隘/长城 = 1`
  - `山脉/河流/海岸 = 2`
- 对当前最确定的点对点与海路线补了显式覆盖：
  - `平壤 ↔ 汉城 = 3`
  - `平壤 ↔ 咸兴 = 3`
  - `皮岛 ↔ 东江 = 2`
  - `皮岛 ↔ 辽西侧海路 = 2`
- 运行时高确定命名已收正：
  - `city-region-18 -> 平壤`
  - `city-region-22 -> 东江`
  - `song-jin -> 皮岛`
  - `city-region-29 -> 汉城`
- Board 区域提示现在直接显示：
  - `移X/宽Y`
  - 即同一条边同时可见移动代价和战场宽度，不再误把宽度当作移动代价。
- 新增最小胜利状态：
  - `威望胜利`：任一势力 `VP >= 3`
  - `霸权胜利`：新年阶段控制 `16+` 个非朝鲜区域
  - 当前先不宣称完整覆盖军事胜利和汉城纪年卡特例。

### 本轮截图与链路证据

- `node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts`
  - 当前为 `6 passed`
  - 稳定截图继续落在：
    - `test-results/evidence-screenshots/_shared/qidahen-board-desktop-current.png`
    - `temp/qidahen-board-season-flow-current.png`
- 我实际看到：
  - 地图提示仍在正式 Board 上工作；
  - 右侧流程区新增胜利状态卡时不会压坏已有 HUD；
  - 年中/新年链路、区域点击、动作执行、手机横屏仍全部通过。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `125 passed`
  - 七大恨基础 E2E `6 passed`

## 2026-05-31 04:26 +08 增补：通路代价编辑与运行时读值闭环

### 本轮新增范围

- 代码范围：`src/pages/devtools/QidahenRegionMaskTool.tsx`、`src/pages/devtools/QidahenRuntimePreview.tsx`、`src/games/qidahen/data/region-graph.json`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-region-mask.e2e.ts`。
- 数据范围：工作区 `region-graph.json` 的 `edges[*].travelCost` 开始作为独立字段保存，不再只靠 `boundaryType` 间接推导。
- 非覆盖范围：完整七大恨移动行动规则、所有 53 条边的人工精调、完整军事胜利和人物结算。

### 本轮新增实现

- 编辑器通路数据补齐：`PassageEdge` 现在带 `travelCost`，紧凑通路面板和完整通路面板都能直接改移动代价。
- 工作区保存补齐：`保存连线` 现在会把 `travelCost` 一起写入 `region-graph.json`；重开工作区后会回读该值，不再退回边界类型默认值。
- 运行时预览补齐：`QidahenRuntimePreview.tsx` 读取工作区图谱时，会把 `data-travel-cost` 挂到边元素，并在右侧列表展示 `移动代价 X / 战场宽度 Y`。
- 海路规则落地后的旧测试已修：`payment-selection.test.ts` 里原本错误假设“后金可经皮岛海路联姻”的用例，改成非海路的山海关样例；海路限制继续由 `非大明势力不会把船锚海路当作普通相邻进攻线` 单独覆盖。
- 当前先给 6 条明显长边补一版粗估值，便于后续人工微调：

## 2026-05-31 05:10 +08 增补：移动代价开始进入正式运行时

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/movement.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/movementRules.test.ts`、`src/games/qidahen/__tests__/Board.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。
- 规则范围：运行时相邻边读取、海路可用性、按 `travelCost` 做可达搜索、水路后不可转陆路、要塞破败后的移动代价刷新。
- 非覆盖范围：完整“进攻调度”命令链、单位类型与 6 部队调度上限、围城/友好国/炮兵等完整移动细则。

### 本轮新增实现

- 新增正式移动 helper：`getQidahenDirectedPassageRule / getQidahenDirectedTravelCost / getQidahenAdjacentRuntimeRegions / findQidahenReachableRuntimeRegions`。
- 补了四档预算入口，后续可直接给正式调度行动复用：
  - `步 1`
  - `骑 2`
  - `调步 2`
  - `调骑 4`
- 海路继续严格限制为“大明可用”，并在可达搜索里额外落地 `使用水路后，不能再接陆路扩展`。
- 修掉运行时破败规则的旧 bug：之前 `refreshRuntimeRegionRules()` 只会更新 `boundaryType + battleWidth`，不会同步更新 `travelCost`；现在边界降级为平原时，移动代价也会一起降回 `1`。
- Board 区域提示开始正式消费移动 helper：当前玩家点到自己控制区时，除了原本的 `接边 移X/宽Y`，还会额外看到 `调度可达 ...` 粗预览，说明 `travelCost` 已经进入运行时 UI，而不是只停留在工具页或图谱 JSON。

### 关键截图核对

#### 运行时移动预览

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-movement-preview-current.png`
- 我实际看到：点击 `皮岛` 后，区域提示里新增 `调度可达`，且能直接列出 `东江 / 辽西 / 区域 15` 这类可达结果；同时边标签继续显示 `海岸/水路 移2/宽2`。
- 我实际看到：这不是工具页，而是正式 `/play/qidahen/tutorial` Board 运行时截图；右侧动作 rail、顶部玩家条、轮盘和底部手牌都仍在同一张图里。
- 是否达到本轮验收：达到“移动代价已进入正式运行时读数”的当前验收标准。它仍不是完整进攻调度玩法，但已经证明地图连线不再只是编辑器数据。

### 关键断言

- 新增域层回归：
  - `只允许大明把海路当作正式可用相邻边`
  - `防线破败后会把运行时边界与移动代价一起刷新到最新规则`
  - `可达搜索会消费 travelCost，并阻止水路后再接陆路扩展`
- 新增 E2E 断言：
  - 点击 `皮岛` 后，`qidahen-map-region-movement-preview` 必须出现 `调度可达`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `134 passed`
  - 七大恨基础 E2E `6 passed`

## 2026-05-31 05:19 +08 增补：按底图补第二批粗值边 + 水路上限配置

### 本轮新增范围

- 数据范围：`src/games/qidahen/data/region-graph.json`
- 代码范围：`src/games/qidahen/ui/mapGraph.ts`、`src/games/qidahen/domain/movement.ts`、`src/games/qidahen/Board.tsx`
- 测试范围：`src/games/qidahen/__tests__/mapGraph.test.ts`、`src/games/qidahen/__tests__/movementRules.test.ts`

### 本轮新增实现

- 重新按当前图谱距离审计后，把 6 条明显超长的 `plain=1` 边先抬成更像地图的一版粗值：
  - `city-region-10::city-region-15 = 2`
  - `city-region-14::city-region-17 = 2`
  - `city-region-20::city-region-26 = 2`
  - `city-region-30::city-region-31 = 2`
  - `city-region-32::city-region-33 = 2`
  - `city-region-5::city-region-9 = 2`
- 把“水路最多 2 部队”从 note 文案正式提成边界元数据：
  - `QidahenPassageBoundaryMeta.unitCap`
  - 当前 `coast.unitCap = 2`
- 运行时 helper `getQidahenDirectedPassageRule()` 已开始带出 `unitCap`，Board 接边摘要也开始显示 `限2`，不再只靠人读注释推断。

### 关键截图核对

#### 运行时移动预览（更新后）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-movement-preview-current.png`
- 我实际看到：点击 `皮岛` 后，区域提示里除了 `调度可达`，接边摘要现在也明确写出 `海岸/水路 移2/宽2/限2`。
- 我实际看到：这张图仍是正式 Board 运行时，不是工具页；说明 `unitCap` 已经被正式界面消费。

### 关键断言

- `mapGraph.test.ts`
  - `coast.unitCap = 2`
  - 第二批 6 条粗值边均为 `travelCost = 2`
- `movementRules.test.ts`
  - 水路 helper 返回 `unitCap = 2`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `134 passed`
  - 七大恨基础 E2E `6 passed`

## 2026-05-31 05:32 +08 增补：轮盘进攻调度最小正式链

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`
- 测试范围：`src/games/qidahen/__tests__/payment-selection.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`
- 规则范围：轮盘 `进攻/调度` 扇区的最小正式进入链，正式消费 `travelCost`

### 本轮新增实现

- 当前把轮盘 `进攻/调度` 扇区接成最小可用命令链：
  - `wheel-diplomacy -> 调步2`
  - `wheel-hire -> 调骑4`
- 当轮盘走到上述扇区，且当前选中的是己方控制区时，运行时会：
  1. 调用 `findQidahenReachableRuntimeRegions()`
  2. 按 `travelCost` 找可达区
  3. 优先挑可达敌方区，没有敌方才看中立区
  4. 生成 `调度进攻待结算`
- `resolvePendingTargetAction()` 已开始处理 `wheel-dispatch`，因此这不是只显示一个预览框，而是能正式进入待结算并点击 `完成当前结算` 收口。

### 关键截图核对

#### 轮盘进攻调度待结算

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-current.png`
- 我实际看到：在正式 Board 上，选中 `皮岛` 后执行轮盘 `走3`，右侧会出现 `调度进攻待结算 · 目标 辽西 · 防守 后金`。
- 我实际看到：提示里明确写出路径 `皮岛 → 辽西` 和 `耗2 · 海岸/水路 2`，说明这条链已经不是静态摘要，而是正式按图谱边值进入玩法。
- 我实际看到：轮盘、顶部玩家条、右侧 rail、底部手牌都仍在正式运行时界面上，没有退回工具页。

### 关键断言

- `payment-selection.test.ts`
  - `轮盘走到进攻调度时会按 travelCost 生成调度进攻待结算`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `轮盘进攻调度会按地图连线生成待结算目标`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `135 passed`
  - 七大恨基础 E2E `7 passed`
  - `city-region-1::city-region-2 = 2`
  - `city-region-16::city-region-20 = 2`
  - `city-region-22::city-region-28 = 2`
  - `city-region-22::city-region-29 = 3`
  - `city-region-24::jinzhou = 2`
  - `city-region-5::xian-xing = 2`

### 关键链路证据

#### 通路代价可编辑并保存回读

- 用例：`best-available-move-cost-ready 可直接编辑路径类型并保存回读`
- 我实际验证到：
  - 在 `best-available-move-cost-ready-edit` 工作区中，`jinzhou::song-jin` 可以从 `平原` 改成 `山脉`，并把移动代价从 `1` 改到 `4`；
  - 点击 `保存连线` 后，落盘 `region-graph.json` 中该 edge 已同时写入 `boundaryType=mountain`、`battleWidth=2`、`travelCost=4`；
  - 刷新重开后，编辑器仍回读到 `山脉` 和 `移动代价 4`，不是重新退回默认值。
- 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-move-cost-ready-edited-current.png`

#### 运行时预览能读到通路代价

- 用例：`best-available-move-cost-ready 可直接打开运行时预览并读到当前通路规则`
- 我实际验证到：
  - 运行时预览页读取同一工作区后，`qidahen-runtime-preview-edge-jinzhou::song-jin` 带 `data-boundary-type=mountain`、`data-travel-cost=4`；
  - 右侧通路说明直接显示 `移动代价 4` 与 `战场宽度 2`，不再只显示边界类型。
- 截图：`test-results/evidence-screenshots/_shared/qidahen-runtime-preview-best-available-move-cost-current.png`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "best-available-move-cost-ready 可直接编辑路径类型并保存回读"
node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "best-available-move-cost-ready 可直接打开运行时预览并读到当前通路规则"
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `126 passed`
  - 七大恨基础 Board E2E `6 passed`
  - 区域工具两条定向 E2E 均通过

## 2026-05-31 04:42 +08 增补：汉城额外威望、首都配置与第二批粗值边

### 本轮新增范围

- 代码范围：`src/games/qidahen/domain/regionConfig.ts`、`src/games/qidahen/domain/index.ts`、`src/games/qidahen/domain/types.ts`、`src/games/qidahen/Board.tsx`。
- 数据范围：`src/games/qidahen/data/region-graph.json`。
- 测试范围：`src/games/qidahen/__tests__/mapGraph.test.ts`、`src/games/qidahen/__tests__/payment-selection.test.ts`、`src/games/qidahen/__tests__/Board.test.ts`、`e2e/qidahen-basic-flow.e2e.ts`。

### 本轮新增实现

- 再补 6 条明显偏低的粗值边，避免运行时继续把几条长边/攻城边按最低档处理：
  - `city-region-14::jinzhou = 2`
  - `city-region-19::jinzhou = 2`
  - `city-region-20::city-region-24 = 2`（双向）
  - `city-region-25::jinzhou = 2`
  - `city-region-27::city-region-33 = 2`
  - `city-region-3::city-region-4 = 3`
- 规则数据层不再只停在 `tags / tribute / maintenance`，而是正式补了：
  - `initialController`
  - `capitalOf`
  - `prestigeCardBonus`
  - `prestigeCardBonusUnlock`
- 当前先把汉城接成正式配置入口：
  - 开局默认由大明控制；
  - 大明失去初始汉城控制后，当前控制汉城的一方按配置获得 `+1 VP`；
  - 已配置首都被敌方控制时，运行时立即标记 `军事胜利`。
- Board 顶部玩家条开始显示实际生效 VP；汉城加成存在时会直接显示 `汉城+1`，不再只能从胜利状态猜出来。

### 关键断言

- `保留本轮补齐后的关键粗值通路消耗`
- `当前样板开局会把朝鲜三地初始化为大明控制，汉城额外威望默认未解锁`
- `汉城额外威望在解锁后会给当前控制者 +1，并可触发威望胜利`
- `攻下已配置首都时会立刻标记军事胜利`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `130 passed`
  - 七大恨基础 Board E2E `6 passed`

## 2026-05-31 06:26 +08 增补：进攻压力已从“边界宽度近似”推进到“真实可投入兵力”

### 本轮新增范围

- 代码范围：
  - `src/games/qidahen/domain/attackRules.ts`
  - `src/games/qidahen/domain/index.ts`
  - `src/games/qidahen/domain/types.ts`
  - `src/games/qidahen/Board.tsx`
- 数据范围：
  - `src/games/qidahen/data/region-graph.json`
- 测试范围：
  - `src/games/qidahen/__tests__/payment-selection.test.ts`
  - `src/games/qidahen/__tests__/mapGraph.test.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`

### 本轮新增实现

- 第 6 轮粗值边继续补齐：
  - `city-region-14::city-region-19 = 2`
  - `city-region-17::city-region-19 = 2`
  - `city-region-27::city-region-28 = 2`
- 新增 `attackRules.ts`，把这批规则从临时逻辑改成正式配置：
  - `最多 6 部队`
  - `中立守军最多 3`
  - 海路 `unitCap=2`
- `调度进攻 / 突袭` 待结算正式携带：
  - `sourceAvailableTroops`
  - `committedTroops`
  - `attackPressure`
  - `boundaryUnitCap`
- 结算不再只按 `battleWidth` 生砍：
  - 现在会先计算“当前源区实际能投入几部队”
  - 再与 `battleWidth` 取最小值得到 `attackPressure`
  - 因此海路上限和源区剩余兵力都会直接进入玩法结果

### 关键截图核对

#### 轮盘进攻调度选择态

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-selection-current.png`
- 我实际看到：
  - `皮岛 -> 辽西` 候选仍存在；
  - 候选项正文已经直接显示 `源兵 2 · 投入 2 · 压力 2`；
  - 这说明“能打多狠”已经不是隐藏在 reducer 里的默认值，而是进入正式 Board。

#### 轮盘进攻调度待结算

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-current.png`
- 我实际看到：
  - `调度进攻待结算 · 目标 辽西 · 防守 后金`
  - 提示链里仍能看到 `皮岛 -> 辽西 · 耗2`
  - 待结算正文新增 `源兵 2 · 投入 2 · 压力 2 · 边界上限 2`
  - 说明海路限制已经被正式抬到了运行时交互面

### 关键断言

- `payment-selection.test.ts`
  - `轮盘走到进攻调度时会先进入目标选择，再按 travelCost 生成待结算`
  - `进攻压力会受实际可投入兵力截断，而不是只看边界宽度`
- `mapGraph.test.ts`
  - `保留本轮补齐后的关键粗值通路消耗`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `139 passed`
  - 七大恨基础 E2E `7 passed`

## 2026-05-31 06:27 +08 增补：攻下后源区扣兵、目标区进驻

### 本轮新增实现

- 继续把地图与区域状态压进正式玩法：
  - 当前 `raid / wheel-dispatch` 若打下空区或攻破守军，不再只是“目标区改控 + 固定 1 兵”；
  - 现在会把 `committedTroops` 从源区实际扣除，并把同数量部队进驻到目标区。
- 当前最小结算语义：
  - 没打下：先只处理守军减员
  - 打下：源区扣兵，目标区进驻
- 这一步虽然还没到完整双边战损，但已经让“地图行动 -> 区域兵力变化”开始闭环，不再只是演示层。

### 关键断言

- `payment-selection.test.ts`
  - `调度进攻攻下空区后会把已投入部队从源区移入目标区`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `140 passed`
  - 七大恨基础 E2E `7 passed`

## 2026-05-31 06:42 +08 增补：战后处理已进入真实 Board

### 本轮新增实现

- 继续把“地图战斗链”从自动结果推进到可操作状态：
  - `resolve pending` 后，若目标区被突破，现在不再直接自动占领；
  - 会进入正式 `post-battle-decision` 阶段。
- 当前真实可选项：
  - `占领该区`
  - `退回相邻友方区域`
- 当前最小正式语义：
  - 选 `占领`：源区扣除投入部队，目标区改控并进驻
  - 选 `退回源区`：目标区不改控，源区兵力保持原样

### 关键截图核对

#### 战后处理

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-post-battle-current.png`
- 我实际看到：
  - `战后处理 · 辽西`
  - 提示正文写明 `辽西 已被突破，决定是否占领或回退`
  - 下方真实出现 `占领该区` 按钮
  - 这说明链路已经从“待结算点一下就结束”推进到“突破后还要做战后决定”

### 关键断言

- `payment-selection.test.ts`
  - `调度进攻攻下空区后会进入战后处理，并在占领后把已投入部队从源区移入目标区`
  - `战后可选择放弃占领并退回相邻友方区域`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `轮盘进攻调度会按地图连线生成待结算目标`
  - 同一用例现已继续覆盖：`待结算 -> 战后处理 -> 占领收口`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `143 passed`
  - 七大恨基础 E2E `7 passed`

## 2026-05-31 11:56 +08 增补：征召军队已进入真实 Board 二选一

### 本轮新增实现

- 把大明 `征召军队` 从“点击后直接 +6”的单路径低保真，改成了真实 Board 可操作的二选一：
  - 新增 `recruit-choice` 阶段
  - 新增 `RESOLVE_RECRUIT_CHOICE`
  - Board 右侧先显示 `建立 6 个等级 2 部队 / 建立 2 个等级 4 川兵`
- 当前最小正式语义：
  - `6 个等级 2 部队`：目标区 `+6`
  - `2 个等级 4 川兵`：当前以低保真近似目标区 `+2`，摘要明确标注“低保真近似”
- 同步修复了一处真实 UI 接线问题：
  - `ActionsZone` 之前漏解构 `onResolveRecruitChoice`
  - 表现是选项按钮显示正常，但点击后不会推进
  - 修复后已由真实 Board E2E 证明可操作

### 关键截图核对

#### 征召军队二选一

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-recruit-current.png`
- 我实际看到：
  - 地图右侧先出现 `征召军队` 面板
  - 面板内真实出现 `建立 6 个等级 2 部队` 与 `建立 2 个等级 4 川兵`
  - 选择前者后，摘要区出现 `征召军队`
  - `皮岛` 提示中的兵力从 `2 -> 8`
  - 这说明当前链路已经不是“点按钮直接拍状态”，而是先选择建军方式，再进入正式结算

### 关键断言

- `payment-selection.test.ts`
  - `确认执行征召军队后会先进入建军方式选择`
  - `征召军队选择等级 2 部队后会给目标区增加 6 兵`
  - `征召军队选择川兵后会以低保真近似增加 2 兵`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `征召军队会先进入建军选择，再按选择补入 6 个部队`
  - `马市贸易会先进入 1-3 建兵选择，再按选择给大明加兵并让蒙古摸牌`
  - `轮盘跨过年中与新年时会显示结算摘要和防线状态`
  - 上面两条旧 E2E 也已同步改成经过新的征召军队选择链

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'; node scripts/infra/run-e2e-single.mjs default e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `158 passed`
  - 七大恨基础 E2E `14 passed`

## 2026-05-31 13:20 +08 增补：轮盘外交/雇佣已进入真实 Board 最小正式链

### 本轮新增实现

- 把轮盘 `外交/雇佣` 从“轮盘转到这里但没有正式即时效果”补成了最小正式版：
  - 当轮盘从 `wheel-hire` 进入 `wheel-attack` 时，当前己方区域会建立 `2` 个等级 `2` 雇佣军
  - 区域总兵力同步 `+2`
  - `specialTroops` 正式写入 `*-mercenary-lv2`
- 当前刻意没有虚报完成的部分：
  - 摘要与日志都明确写出“当前最小正式实现先结算雇佣军建立；外交标记后续补齐”
  - 也就是说，这一轮只收了“建雇佣军”这条高确定主效果，外交标记链仍未宣称完成

### 关键截图核对

#### 轮盘外交/雇佣

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-hire-current.png`
- 我实际看到：
  - 右侧摘要面板标题为 `轮盘外交/雇佣`
  - 摘要正文包含 `建立 2 个等级 2 雇佣军`
  - 同一摘要明确写着 `当前最小正式实现先结算雇佣军建立；外交标记后续补齐`
  - 地图提示中，`皮岛 · 大明` 的兵力已经从 `2 -> 4`
  - 地图提示额外显示 `特殊 雇佣军 x2（2级）`
- 这张图说明当前链路已经不是“轮盘文字变化但地图无状态”，而是正式会改区域兵力并落特殊部队数据

### 关键断言

- `payment-selection.test.ts`
  - `轮盘进入外交雇佣时会在当前己方区域建立 2 个等级 2 雇佣军`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `轮盘外交雇佣会在当前己方区域建立雇佣军`
- 同时复跑整份 `qidahen-basic-flow.e2e.ts`，确认这条新链没有把现有 15 条基础玩法链带坏

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
$env:PW_PORT='6373'
$env:PW_GAME_SERVER_PORT='20200'
$env:GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
$env:API_SERVER_PORT='21200'
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'
npx playwright test e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `161 passed`
  - 七大恨基础 E2E `16 passed`

### 仍未覆盖的风险

- `外交标记` 与相关控制标记链仍未正式接上
- 当前“雇佣军”仍先按总兵力与特殊部队展示层处理，未进入更细的兵种/等级战斗语义
- 这一步说明轮盘玩法链继续往前推了一格，但不等于七大恨已完整实现

## 2026-05-31 16:02 +08 增补：外交雇佣已从单目标扩成“最多 3 次外交 + 雇佣收口”

### 本轮新增实现

- 不再把 `轮盘外交/雇佣` / `大汗令箭 -> 外交雇佣` 写成“选 1 个目标就立刻结束”的单目标假链。
- 现在同一次外交雇佣会进入持续选择态：
  - 最多可连续执行 `3` 次外交操作；
  - 每次操作仍只针对一个邻近己方控制区的区域；
  - 支持同一区域重复操作，因此可以在同一次行动内完成 `友好 -> 附庸`；
  - 任意时点都可点击 `结束并结算雇佣` 收口；
  - 当第 `3` 次外交操作完成后，会自动结算雇佣并退出阶段。
- 新状态/UI：
  - `diplomacySelection.remainingTargetCount`
  - `diplomacySelection.resolvedSteps`
  - Board 右侧新增已执行历史与剩余次数提示

### 当前最小正式语义

- `place-friendly`：目标区放置己方友好标记
- `flip-vassal`：己方友好区翻为附庸，并视为控制区域
- `remove-marker`：移除现有标记；若移除的是友好区且区内有雇佣军，会一并移除对应雇佣军
- `hire-only / 结束并结算雇佣`：在源区建立 `2` 个等级 `2` 雇佣军并结束本次外交

### 关键截图核对

#### 三次外交后自动收口

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-diplomacy-three-target-current.png`
- 我实际看到：
  - 右侧摘要中同时出现 `外交 1 / 外交 2 / 外交 3`
  - 摘要明确保留了 `建立 2 个等级 2 雇佣军`
  - 同一轮里已经能看到 `蒙古附庸` 与 `控制标记已移除` 两类结果并存

### 关键断言

- `payment-selection.test.ts`
  - `大汗令箭选择外交雇佣后会进入外交目标选择，并可同时放友好标记与建立雇佣军`
  - `轮盘进入外交雇佣时会先进入外交目标选择，并可同时放友好标记与建立雇佣军`
  - `同一次外交雇佣最多可连续处理 3 个相邻区域后自动结算雇佣`
- `e2e/qidahen-basic-flow.e2e.ts`
  - `轮盘外交雇佣会进入外交目标选择，并可同时放友好标记与建立雇佣军`
  - `大汗令箭选择外交雇佣后会进入外交目标选择，并可同时放友好标记与建立雇佣军`
  - `外交雇佣同一次行动最多可连续处理 3 个目标后自动完成`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `165 passed`
  - 七大恨基础 E2E `17 passed`

### 仍未覆盖的风险

- 当前“外交雇佣”仍是标记/雇佣主链，尚未进入更细的兵种等级战斗语义
- `正规军存在` 目前仍按“总兵力 - 雇佣军数”近似识别
- 这次修的是“外交次数与状态流正确”，不代表七大恨整套战斗系统已经完成

## 2026-05-31 16:22 +08 增补：友好/附庸开始真实影响调度与战后回退

### 本轮新增实现

- 当前不再把 `友好区` 只当显示层语义。
- 已正式接上的两条规则影响：
  1. 友好区不会再被列为 `突袭 / 调度进攻` 的攻击目标；
  2. 战后选择 `不占领` 时，可回退到相邻 `友好区`，不再只认己方控制区。

### 当前落地口径

- 目标判定：
  - `buildPendingTargetAction()` 现在会把 `controller === 自己` 或 `diplomacyMarkerFaction === 自己` 都视为友方，不再生成待结算目标。
  - `buildWheelDispatchSelection()` 现在会把友好区从候选目标里剔除，只保留真实可攻击区。
- 战后回退：
  - `buildPostBattleSelection()` 现在把相邻友好区也纳入 `withdraw:*` 选择。
  - 也就是说，外交做出的友好标记开始真正改变后续进攻链的可选退路。

### 关键断言

- `payment-selection.test.ts`
  - `突袭作战不能把己方友好区当成进攻目标`
  - `调度目标选择不会把己方友好区列为可攻击目标`
  - `战后处理会把相邻友好区也列为可回退目标`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `168 passed`
  - 七大恨基础 E2E `17 passed`

### 证据说明

- 本轮未单独新增截图；因为改动点主要是“候选目标是否出现”和“回退选项是否出现”，当前以域层回归为主证据。
- 同时复跑整份 `qidahen-basic-flow.e2e.ts`，确认真实 Board 基线没有被这条规则接线带坏。

## 2026-05-31 16:36 +08 增补：战斗胜负从“必须杀光守军”收成按剩余兵力判定

### 本轮新增实现

- 当前战斗结算不再要求“守军必须被清零，攻方才算赢”。
- `resolvePendingTargetAction()` 已改成按战后剩余兵力判胜：
  - 攻方幸存兵力 `>` 守方剩余兵力：视为守军被压退，进入 `战后处理`；
  - 平手或攻方更少：守方守住，攻方只结算损失，不进入 `战后处理`。
- 为了保持当前低保真战斗系统可跑，这一版先把“守军兵力劣势撤退”粗化为目标区清空并等待攻方决定是否占领，而不是现在就展开完整的守方撤退选择。

### 当前落地口径

- 旧口径：
  - 只有 `remainingTroops === 0 && survivingAttackers > 0` 才会判成攻方突破。
- 新口径：
  - `survivingAttackers > remainingTroops && survivingAttackers > 0` 即判成攻方突破。
  - 若守军并未被杀光，但兵力比较已经落后，也会被记为“兵力劣势被迫撤退”。

### 关键断言

- `payment-selection.test.ts`
  - `战斗胜负会按剩余部队数判定，攻方即使未杀光守军也可突破进入战后处理`
  - 该样例锁的是：`宁远 6 打 4`，结算后形成 `攻方 3 / 守方 1`，因此应进入 `post-battle-decision`。

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `169 passed`
  - 七大恨基础 E2E `17 passed`

### 仍未覆盖的风险

- 这次只把“胜负判定门槛”拉回更像规则的一版，还没有补完整 `避战 / 断后 / 溃败 / 城战守方战败不可撤`。
- 当前“守军兵力劣势撤退”仍是自动粗化，不代表守方完整撤退选择系统已经完成。

## 2026-05-31 16:48 +08 增补：附庸区不能建立正规军，已正式接回运行时

### 本轮新增实现

- 规则原文明确写了两层：
  - 中立区可被外交影响，成为任意势力的控制区；
  - 但在成为控制区之后，`可以建立雇佣军部队，但是不能建立正规军部队`。
- 旧实现的问题是：
  - 只要一个区域当前 `controller === 某势力`，就会被 `征召军队`、`马市贸易`、`轮盘征兵/训练`、`大汗令箭 -> 征兵训练` 当成可直接建正规军的目标。
  - 这会让附庸区也被塞进正规军，明显偏离规则。
- 当前已新增共享筛选：
  - `canPlaceRegularTroopsInRegion(...)`
  - 若区域是该势力附庸（`diplomacyMarkerSide === 'vassal'`），则不能作为正规军建军目标；
  - 相关链路会自动回退到同势力的合法本土控制区。

### 当前落地口径

- 已收紧的正规军建军入口：
  - `征召军队`
  - `马市贸易`
  - `轮盘军屯/征兵训练` 中的加兵链
  - `大汗令箭 -> 征兵训练`
- 保持不受此限制的入口：
  - `外交雇佣`
  - 原因很直接：这条链结算的是雇佣军，本来就允许在附庸/外交控制区建立。

### 关键断言

- `payment-selection.test.ts`
  - `征召军队不会把正规军建在附庸区，而会回退到本土控制区`
  - `马市贸易不会把正规军建在大明附庸区，而会回退到大明本土控制区`
  - `大汗令箭的征兵训练不会把正规军建在蒙古附庸区，而会回退到蒙古本土控制区`
  - `轮盘征兵训练不会把正规军加到附庸区，而会回退到本土控制区`

### 本轮验证

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过
  - 七大恨定向 Vitest `173 passed`
  - 七大恨基础 E2E `17 passed`

### 仍未覆盖的风险

- 当前只是先守住“附庸区不能建正规军”，还没有把“占领的敌方本土区”“事件转成本土区”等更细的建军权限全部做完。
- 雇佣军/正规军/本土区/占领区的长期权限模型，后续仍建议继续抽成更明确的区域类型合同。

## 2026-06-01 08:49 +08 增补：战败标记已接入野战结算与 Board 可见状态

### 本轮范围

- 按用户最新指令，停止继续把时间花在地图连线细抠；地图工具/连线只保留“大概初值 + 用户后续人工调整”的定位。
- 本轮回到七大恨正式玩法主线，补规则原文已明确、对后续人物判定有直接影响的 `战败标记`。

### 规则依据

- `src/games/qidahen/rule/七大恨规则.md` 战败撤退段写明：
  - 败方拿取一个战败标记；
  - 城战战败时不拿取战败标记。

### 当前落地口径

- 新增 `QidahenFactionState.defeatMarkers`，当前先作为势力级低保真计数：
  - 后续人物系统完成后，再细化到“放在自己场上数字最低的玩家人物上”；
  - 当前不会伪装成完整人物判定系统已完成。
- `resolvePendingTargetAction()` 中接入：
  - 野战守方战败：守方 `defeatMarkers +1`；
  - 野战攻方未突破：攻方 `defeatMarkers +1`；
  - 城战战败：不加战败标记。
- Board 右上势力条新增 `败×N` 独立徽记。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-defeat-marker-current.png`
- 我实际看图结论：
  - 截图里右上 `后金` 势力条能直接看到独立 `败×1` 徽记；
  - 中央战场提示显示 `区域14 · 后金`，右侧日志显示后金战败撤退并获得战败标记；
  - 右下 `战后处理` 面板仍显示 `占领该区 / 退回 区域16`，说明战败标记显示没有打断后续操作链。

### 自动化证据

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过；
  - `payment-selection.test.ts`：`61 passed`；
  - `movementRules.test.ts + mapGraph.test.ts + Board.test.ts`：`117 passed`；
  - 七大恨基础 Board E2E：`18 passed`。

### 仍未覆盖的风险

- 当前 `defeatMarkers` 仍是势力级计数，没有按人物数字、人物是否允许放战败标记做分配。
- 战败标记的后续掷骰判定、弃标记、人物离场联动尚未实现。
- 当前战斗仍是总兵力低保真，炮兵 / 骑兵 / 步兵等级伤害、断后最高等部队、溃败全员受伤仍需要后续细化。

## 2026-06-01 09:17 +08 增补：战胜劫掠已接入战后处理

### 本轮范围

- 继续停止地图连线细抠，把开发重心放回七大恨可玩流程。
- 本轮补规则原文中的 `战胜劫掠`，让战斗获胜后的战后处理不只停在“占领/退回”。

### 规则依据

- `src/games/qidahen/rule/七大恨规则.md` 战胜劫掠段写明：
  - 攻方发动进攻且守方全数撤退、被歼灭或避战后，可以进行劫掠；
  - 可移除被占领或被围城区域的人口；
  - 1 人口方块抽自己普通牌堆时，抽 2 张，1 张进手牌，1 张进弃牌堆。

### 当前落地口径

- `QidahenPostBattleChoice` 新增 `plunderPopulation`。
- `buildPostBattleSelection()` 在目标区 `population > 0` 时，为原有战后选项追加：
  - `劫掠并占领`
  - `劫掠并退回 ...`
- `resolvePostBattleDecision()` 当前低保真处理：
  - 固定劫掠 1 人口；
  - 目标区 `population -1`；
  - 攻方 `handCount +1`；
  - 当前客户端手牌 `handCards +1`；
  - `drawPileCount -2`；
  - `discardPileCount +1`；
  - 战后摘要与行动日志写明劫掠。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-post-battle-plunder-current.png`
- 我实际看图结论：
  - 右侧 `战后处理` 摘要能看到 `劫掠东江 1 人口，获得 1 张手牌，弃牌堆 +1`；
  - 东江已显示为大明附庸占领状态；
  - 下方手牌区新增了 1 张手牌；
  - 页面没有卡在战后选择面板，说明劫掠后战后处理能收口。

### 自动化证据

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过；
  - `payment-selection.test.ts`：`62 passed`；
  - `movementRules.test.ts + mapGraph.test.ts + Board.test.ts`：`117 passed`；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 当前劫掠数量固定为 1，还没有实现“移除任意数量人口”。
- 当前只实现“抽自己普通牌堆”的低保真收益，没有做“抽被占领者普通牌堆”的选择。
- 围城区域只能移除城外人口这一点尚未区分。

## 2026-06-01 09:38 +08 增补：劫掠已支持按目标人口选择数量

### 本轮范围

- 延续上一节战胜劫掠实现，把“固定劫掠 1 人口”升级为“按目标区人口生成劫掠数量选项”。
- 这一步直接补齐规则中“移除任意数量人口”的核心操作面。

### 当前落地口径

- `buildPostBattleSelection()`：
  - 若目标区人口为 `N`，会为原有战后选项生成 `1..N` 个劫掠数量选择；
  - 例如目标区人口为 `3` 时，Board 会出现 `劫掠 1 人口并占领`、`劫掠 2 人口并占领`、`劫掠 3 人口并占领`；
  - 回退选项同样会生成对应数量版本。
- `resolvePostBattleDecision()`：
  - 目标区人口减少选择的劫掠数量；
  - 按 `1 人口 = 抽 2 张，1 张进手牌、1 张进弃牌堆` 结算；
  - 当前仍只实现“抽自己普通牌堆”的收益方向；
  - 若抽牌堆不足，按实际可抽张数截断，不会产生负数牌堆。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-post-battle-plunder-current.png`
- 我实际看图结论：
  - 右侧 `战后处理` 摘要显示 `劫掠 区域 20 3 人口，获得 3 张手牌，弃牌堆 +3`；
  - 下方手牌区已增加到能直观看出抽牌收益；
  - 战后处理面板已消失，说明劫掠数量选择后流程可以收口。

### 自动化证据

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过；
  - `payment-selection.test.ts`：`62 passed`；
  - `movementRules.test.ts + mapGraph.test.ts + Board.test.ts`：`117 passed`；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 当前只实现“抽自己普通牌堆”，还没有做“抽被占领者普通牌堆”的选择。
- 围城区域只能移除城外人口这一点仍未区分。
- 当前仍未进入完整兵种/等级伤害系统，所以劫掠前置战斗结果仍基于总兵力低保真结算。

## 2026-06-01 09:58 +08 增补：劫掠已区分抽自己牌堆与被占领者牌堆

### 本轮范围

- 延续战胜劫掠实现，补上规则中的第二类抽牌来源：被占领者普通牌堆。
- 目标是让战后处理按钮和结算收益不再只有“抽自己牌堆”一种路线。

### 当前落地口径

- `QidahenPostBattleChoice` 新增 `plunderSource`：
  - `attacker`：抽自己普通牌堆；
  - `defender`：抽被占领者普通牌堆；
  - `null`：不劫掠。
- 中立区：
  - 只生成抽自己普通牌堆的劫掠选项。
- 敌方控制区：
  - 生成抽自己普通牌堆选项；
  - 额外生成抽被占领者普通牌堆选项，例如 `劫掠 2 人口，抽后金牌堆并占领`。
- 收益差异：
  - 抽自己普通牌堆：每 1 人口抽 2，攻方手牌 +1、弃牌堆 +1；
  - 抽被占领者普通牌堆：每 1 人口抽 1，攻方手牌 +1，弃牌堆不增加。

### 低保真边界

- 当前七大恨仍没有每势力独立普通牌堆/弃牌堆数据结构。
- 因此被占领者牌堆暂时仍消耗全局 `drawPileCount`；但 UI 文案、收益差异和日志已按被占领者来源区分。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-post-battle-plunder-current.png`
- 我实际看图结论：
  - 右侧 `战后处理` 摘要显示 `劫掠 区域 20 2 人口，抽后金牌堆获得 2 张手牌`；
  - 下方手牌区增加；
  - 战后处理面板已收口；
  - 后金势力条仍能看到战败标记，说明这条链没有破坏战败标记显示。

### 自动化证据

```powershell
npx tsc --noEmit --pretty false
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过；
  - `payment-selection.test.ts`：`63 passed`；
  - `movementRules.test.ts + mapGraph.test.ts + Board.test.ts`：`117 passed`；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 每势力独立牌堆 / 弃牌堆尚未建模，被占领者牌堆仍是低保真全局扣牌。
- 围城区域只能移除城外人口这一点仍未区分。
- 当前仍未进入完整兵种/等级伤害系统，所以劫掠前置战斗结果仍基于总兵力低保真结算。

## 2026-06-01 10:35 +08 增补：劫掠已改用势力级普通牌堆

### 本轮范围

- 按用户最新指令，停止继续细抠地图连线；地图连线保留粗可用，后续由用户人工调整。
- 本轮只补七大恨可玩流程里已经暴露的牌堆真相：战后劫掠抽被占领者牌堆时，不应继续把所有势力混在一个全局普通牌堆里。

### 当前落地口径

- `QidahenFactionState` 新增：
  - `drawPileCount`
  - `discardPileCount`
- 当前写入这些势力级牌堆的链路：
  - 行动支付：当前行动势力弃牌堆增加；
  - 轮盘摸牌：扣当前势力普通牌堆；
  - 马市贸易：扣蒙古普通牌堆；
  - 驱虎吞狼同意后摸牌：扣被指挥目标势力普通牌堆；
  - 战后劫掠抽自己牌堆：扣攻方普通牌堆，额外牌进入攻方弃牌堆；
  - 战后劫掠抽被占领者牌堆：扣原控制者普通牌堆，攻方获得手牌，攻方弃牌堆不增加。
- 旧 `core.drawPileCount / discardPileCount` 暂时保留，用于现有 Board 牌堆显示兼容；规则真相开始迁移到 `core.factions.<势力>.drawPileCount / discardPileCount`。

### 关键断言

- `payment-selection.test.ts`
  - `马市贸易在选择建立 3 个部队后会给大明加兵，并让蒙古抽 6 张手牌`
    - 蒙古 `drawPileCount` 从 `20` 到 `14`
    - 大明 `drawPileCount` 保持 `20`
  - `战后处理可选择抽被占领者牌堆进行劫掠`
    - 大明手牌 `+2`
    - 后金 `drawPileCount` 从 `20` 到 `18`
    - 大明 `drawPileCount / discardPileCount` 不变

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-post-battle-plunder-current.png`
- 我实际看图结论：
  - 右侧战后摘要显示 `抽后金牌堆获得 2 张手牌`；
  - 战后处理已收口；
  - 这张图证明 UI 链仍可操作，势力级扣牌由域层断言锁住。

### 自动化证据

```powershell
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/types.ts src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过；
  - ESLint：`0 errors`，剩余 5 个既有 warnings；
  - `payment-selection.test.ts`：`63 passed`；
  - `movementRules.test.ts + mapGraph.test.ts + Board.test.ts`：`117 passed`；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- Board 牌堆 UI 还没有展开显示三势力各自的普通牌堆/弃牌堆，本轮只保持旧 UI 兼容。
- 围城区域只能移除城外人口仍未区分。
- 兵种/等级伤害、人物判定与战败标记消解仍是后续主线。

## 2026-06-01 11:22 +08 增补：年中战败标记消解已接入

### 本轮范围

- 按“连线只要大概，主要继续实施游戏”的口径，本轮不再继续调地图边权。
- 只补已经影响可玩闭环的一段：战斗中已经会产生 `战败标记`，Board 也会显示 `败×N`，所以年中不能继续只留下旧的占位摘要。

### 当前落地口径

- `resolveMidyear()` 在土地税赋后处理势力级 `defeatMarkers`。
- 年中会把各势力已有战败标记清零。
- 年中摘要新增 `年中战败标记`：
  - 有标记时写明哪些势力处理了多少个；
  - 无标记时写明本次没有需要处理的战败标记；
  - 同一行明确“人物离场与人物牌额外判定仍以低保真摘要保留”。
- 这一步仍不是完整人物牌系统：
  - 没有按人物数字分配战败标记；
  - 没有展开每个人物的额外掷骰；
  - 没有人物离场或人物牌效果联动。

### 关键断言

- `payment-selection.test.ts`
  - `轮盘进入年中时会处理并移除已有战败标记`
  - 测试设置大明 `2` 个、后金 `1` 个战败标记；
  - 轮盘进入年中后，大明/后金 `defeatMarkers` 均为 `0`；
  - 当时摘要包含 `大明处理 2 个战败标记`、`后金处理 1 个战败标记`、`标记已移除`；2026-06-01 17:42 已升级为逐标记掷骰摘要，见本文后续证据增补。
- `e2e/qidahen-basic-flow.e2e.ts`
  - `轮盘跨过年中与新年时会显示结算摘要和防线状态`
  - 旧断言从 `人物判定暂以低保真摘要处理` 更新为 `年中战败标记` 与 `人物离场与人物牌额外判定仍以低保真摘要保留`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-season-flow-current.png`
- 我实际看图结论：
  - 画面停在 `新年结算`，说明年中结算后可以继续推进到新年；
  - 右侧摘要显示朝鲜朝贡、防线维护结果；
  - 防线条能看到山海关、锦州、宁远等破败/完整状态；
  - 该截图证明季节链仍能跑通，不单独证明完整人物牌判定已经完成。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`65 passed`；
  - `movementRules.test.ts + mapGraph.test.ts + Board.test.ts`：`117 passed`；
  - `tsc` 通过；
  - ESLint：`0 errors`，剩既有 warnings；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 人物牌数据、人物数字、人物战败标记承载位置尚未建模。
- 战败标记目前仍是势力级计数，不是人物卡上的实体标记。
- 年中人物判定仍没有展开掷骰结果、人物离场和人物牌额外效果。

## 2026-06-01 11:35 +08 增补：年中江南漕运已接入

### 本轮范围

- 延续年中结算主链，补规则原文中的 `江南漕运：大明额外抽取 5 张手牌`。
- 不继续调整地图连线，也不展开完整人物牌系统。

### 当前落地口径

- `resolveMidyear()` 顺序调整为：
  - 土地税赋；
  - 江南漕运；
  - 战败标记/人物判定低保真摘要；
  - 各势力控制区域统计。
- 江南漕运使用势力级普通牌堆：
  - `factions.ming.drawPileCount` 最多扣 `5`；
  - `factions.ming.handCount` 增加实际抽到张数；
  - 牌堆不足时按实际可抽张数结算，不会变成负数。
- Board 年中/新年摘要可见行从 `4` 行增到 `5` 行，确保土地税赋、江南漕运、战败标记摘要都能在真实 UI 中被 E2E 断言看到。

### 关键断言

- `payment-selection.test.ts`
  - `轮盘进入年中时会结算土地税赋并留下摘要`
  - 样例中大明因土地税赋 `+1`，因江南漕运 `+5`；
  - 大明 `handCount` 从 `5` 变为 `11`；
  - 大明 `drawPileCount` 从 `20` 变为 `15`；
  - 摘要包含 `大明因江南漕运获得 5 张手牌`。
- `e2e/qidahen-basic-flow.e2e.ts`
  - 季节链 E2E 继续断言年中摘要包含 `年中战败标记` 与人物低保真边界；
  - 随后继续推进到新年并检查防线状态。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-season-flow-current.png`
- 我实际看图结论：
  - 画面停在 `新年结算`，说明年中土地税赋、江南漕运、战败标记摘要之后仍能继续推进到新年；
  - 右侧防线状态仍可读，山海关/锦州/宁远等破败标记没有被新增摘要行挤出或遮挡；
  - 顶部大明手牌显示为 `4/15`，符合经历江南漕运加手牌后又支付防线维护费的链路结果。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts + Board.test.ts`：`172 passed`；
  - `movementRules.test.ts + mapGraph.test.ts`：`10 passed`；
  - `tsc` 通过；
  - ESLint：`0 errors`，剩既有 warnings；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 江南漕运当前只接普通牌堆数量与手牌数，没有接具体卡实例/弃牌堆洗牌。
- 年中人物牌额外判定仍是低保真摘要。
- 防线维护仍是自动支付口径，还不是玩家逐项选择支付/放弃维护。

## 2026-06-01 14:07 +08 增补：调步防回归与结构化守军溃败降级

### 本轮范围

- 按用户“连线大概就行，主要完成游戏”的口径，不再继续细抠地图连线设置。
- 本轮只推进七大恨战斗/调度主链里已经有数据承载的部分：
  - `调步 2` 不得搬走骑兵；
  - 结构化守军选择 `溃败` 时按等级损伤，而不是高等级残部直接全灭。

### 当前落地口径

- `dispatch-infantry` 已由回归锁住：
  - 源区有 1 个骑兵栈 + 2 个步兵栈时；
  - `调步 2` 候选只显示可投入 2 个非骑兵；
  - 战后占领只把步兵栈移入目标区，骑兵栈留在源区。
- 结构化守军溃败：
  - 先按战斗损失移除部队；
  - 再对剩余非炮兵特殊部队执行等级 -1；
  - 等级降到 0 的木块才移除；
  - 炮兵仍走已有“无步骑掩护则移除”的撤退兜底。
- 未结构化普通部队仍保持原低保真“溃败全灭”口径，本轮没有扩大到完整逐木块系统。

### 关键断言

- `payment-selection.test.ts`
  - `调步 2 占领空区时不会把骑兵栈当作步兵转移`
  - `结构化守军溃败时会降级幸存步兵，而不是把高等级残部全灭`
- 第二条样例中，后金 4 个 2 级步兵守军被打剩 2 个后选择溃败，撤到相邻友方区域时变为 2 个 1 级步兵，日志显示 `守军溃败损伤 2 后撤至 区域 17`。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`77 passed`；
  - 七大恨定向四文件：`194 passed`；
  - `tsc`：通过；
  - ESLint：`0 errors`；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 攻方溃败仍是低保真，尚未按结构化部队逐栈降级。
- 仍未完成完整随机掷骰、玩家指定承伤、骑兵避战、骑兵劫掠、全部开局普通部队拆分炮/骑/步。

## 2026-06-01 12:16 +08 增补：新年防线维护选择已接入

### 本轮范围

- 按“完成游戏最重要”的主线，补新年结算中玩家必须能决定防线维护的入口。
- 不继续调整地图连线，也不展开逐防线逐项支付细节。

### 当前落地口径

- 轮盘停到 `新年` 时，不再立刻完整结算新年。
- `core.fortificationMaintenanceSelection` 会进入 `新年防线维护`：
  - `尽量维护防线`：沿当前优先级支付可负担维护费；
  - `放弃维护全部防线`：外长城、内长城、山海关、宁远、锦州全部破败。
- 防线选择完成后才继续朝鲜朝贡、兵力耗损、年份推进与边界刷新。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-fortification-maintenance-current.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-season-flow-current.png`
- 我实际看图结论：
  - `新年防线维护` 面板可见；
  - `尽量维护防线` 与 `放弃维护全部防线` 两个按钮可见；
  - 点击维护后能继续进入 `新年结算`，右侧摘要和防线状态仍正常。

### 自动化证据

```powershell
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts e2e/qidahen-basic-flow.e2e.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过；
  - ESLint：`0 errors`，剩既有 warnings；
  - 七大恨定向 Vitest：`183 passed`；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 防线维护仍是全局粗选，不是逐防线逐项支付/放弃。
- 新年兵力耗损仍是低保真自动支付/减员，不是玩家选择具体移除部队。

## 2026-06-01 12:32 +08 增补：川兵/雇佣军开始进入战斗等级估算

### 本轮范围

- 按用户最新要求停止继续细抠连线，把主线切回七大恨本体可玩性。
- 只推进已经落盘的结构化部队进入当前战斗估算，不宣称完整木块战斗系统完成。

### 当前落地口径

- `QidahenSpecialTroopStack` 新增 `troopKind`。
- 已有结构化部队写入兵种：
  - 川兵：`infantry`，等级 `4`；
  - 雇佣军：当前默认 `infantry`，等级 `2`。
- 当前低保真战斗在任一方存在结构化部队时：
  - 参战战力按部队等级估算；
  - 每 `3` 点战力折算 `1` 点损伤；
  - 战斗日志写出 `等级损伤估算`；
  - 伤亡优先消耗最高等级特殊部队，避免特殊部队只作为 UI 提示存在。

### 关键断言

- `payment-selection.test.ts`
  - `结构化川兵会按等级估算战斗损伤，而不是只按总兵力处理`
  - 样例中大明 6 兵里含 2 个 4 级川兵；
  - 当前估算结果为：攻方战力 `10`，造成 `4` 损伤；守方战力 `6`，造成 `2` 损伤；
  - 战后进入 `post-battle-decision`，幸存攻方为 `4`，攻方损失为 `2`。

### 自动化证据

```powershell
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/__tests__/payment-selection.test.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `tsc` 通过；
  - ESLint：`0 errors`，剩既有 warnings；
  - 七大恨定向 Vitest：`184 passed`；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 还没有完整逐木块士气降级；当前仍把损伤折算为部队损失。
- 炮兵支援、炮兵不能承伤、野战/城战骑兵步兵攻击顺位、骑兵避战/劫掠仍未完整实现。
- 结构化部队在战后移动中的精确转移仍是低保真，后续需要把幸存特殊部队从源区转移到占领/回退区域。

## 2026-06-01 15:14 +08 增补：守方骑兵野战避战最小闭环

### 本轮范围

- 按用户最新口径停止继续细抠地图连线与移动代价；当前连线只保持粗可用，后续允许人工调整。
- 本轮只补正式玩法主链里的守方结构化骑兵避战，不宣称完整骑兵系统完成。

### 当前落地口径

- `RESOLVE_PENDING_ACTION` 与 `PENDING_ACTION_RESOLVED` 透传 `defenderCavalryEvasion`。
- Board 待结算面板在可用场景显示 `骑兵避战后结算`。
- 避战可用条件：
  - 行动为 `突袭 / 轮盘调度 / 驱虎吞狼`；
  - 守方不是中立；
  - 目标运行时区域不是城市；
  - 目标区存在结构化骑兵栈；
  - 目标区存在相邻守方控制区或守方友好区。
- 当前避战目标为自动选择第一个相邻友方区；骑兵移走后，再按剩余守军继续结算。

### 关键断言

- `payment-selection.test.ts`
  - `结构化守方骑兵可在野战避战并撤到相邻友方区且不视为战败`
  - 样例中后金骑兵从目标区撤到相邻后金友方区；
  - 目标区剩余守军继续承接战斗；
  - 避战本身不会直接给守方战败标记。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`79 passed`；
  - 七大恨定向四文件：`196 passed`；
  - `tsc`：通过；
  - ESLint：`0 errors`，剩 `Board.tsx` 一个 React Compiler memo warning；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 避战目标仍是自动选择，不是玩家手选。
- 骑兵劫掠还未接入。
- 全部开局普通部队还未拆分为炮兵/骑兵/步兵。
- 真实掷骰、玩家指定承伤、完整逐木块士气仍未完成。

## 2026-06-01 15:33 +08 增补：骑兵宣告劫掠最小闭环

### 本轮范围

- 继续按用户口径停止地图连线细抠，推进七大恨正式游戏流程。
- 本轮只补骑兵宣告劫掠的最小可玩结算，不重写完整战斗骰、完整承伤或完整牌堆选择。

### 当前落地口径

- `RESOLVE_PENDING_ACTION` 与 `PENDING_ACTION_RESOLVED` 增加 `attackerCavalryPlunder`。
- Board 待结算面板新增 `骑兵劫掠后撤`。
- 按钮出现条件：
  - 行动为 `突袭 / 轮盘调度 / 驱虎吞狼`；
  - 攻方源区存在参与本次行动的结构化骑兵；
  - 目标区有人口；
  - 目标区不是城市，也不是朝鲜区域。
- 结算口径：
  - 攻方骑兵不进行普通攻坚；
  - 先承受守方炮兵/骑兵反击估算损失；
  - 存活骑兵数量限制可劫掠人口；
  - 劫掠后撤回源区；
  - 不进入战后占领选择，不产生战败标记；
  - 当前先固定抽自己普通牌堆：每 1 人口抽 2，手牌 +1、弃牌堆 +1。

### 关键断言

- `payment-selection.test.ts`
  - `结构化攻方骑兵可宣告劫掠并按存活骑兵移除人口后撤`
  - 样例中大明 3 个 2 级骑兵宣告劫掠；
  - 后金 1 个 2 级骑兵反击造成 1 个骑兵损失；
  - 存活 2 个骑兵劫掠 2 人口并撤回源区；
  - 目标守军仍留在原地，双方都不拿战败标记。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`80 passed`；
  - 七大恨定向四文件：`197 passed`；
  - `tsc`：通过；
  - ESLint：`0 errors`，剩 `Board.tsx` 一个 React Compiler memo warning；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 骑兵劫掠还不能手选抽自己牌堆或被占领者牌堆。
- 反击和承伤仍为估算，不是真实掷骰与玩家指定承伤。
- 攻方参与劫掠的具体骑兵栈仍按当前提交顺位自动选择。

## 2026-06-01 15:46 +08 增补：骑兵劫掠牌堆来源选择

### 本轮范围

- 继续补骑兵宣告劫掠，不切回地图连线细抠。
- 本轮只补规则原文中的牌堆来源选择，不重写真实掷骰、玩家指定承伤或具体选兵 UI。

### 当前落地口径

- `RESOLVE_PENDING_ACTION` 与 `PENDING_ACTION_RESOLVED` 增加 `attackerCavalryPlunderSource`。
- Board 待结算面板：
  - 可劫掠时显示 `骑兵劫掠己方牌堆`；
  - 目标是敌方控制区时额外显示 `骑兵劫掠守方牌堆`。
- 结算口径：
  - 抽己方牌堆：每 1 人口抽 2，手牌 +1、弃牌堆 +1；
  - 抽守方牌堆：每 1 人口抽 1，进入进攻方手牌，不增加弃牌堆；
  - 中立目标不会出现守方牌堆分支。

### 关键断言

- `payment-selection.test.ts`
  - `结构化攻方骑兵劫掠可选择抽守方普通牌堆`
  - 样例中大明骑兵劫掠后金控制区；
  - 反击后存活 2 个骑兵，移除 2 人口；
  - 大明手牌 +2，大明弃牌堆不变；
  - 后金普通牌堆 -2；
  - 日志写明 `抽后金牌堆获得 2 张手牌`。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`81 passed`；
  - 七大恨定向四文件：`198 passed`；
  - `tsc`：通过；
  - ESLint：`0 errors`，剩 `Board.tsx` 一个 React Compiler memo warning；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 骑兵劫掠的反击和承伤仍为估算，不是真实掷骰与玩家指定承伤。
- 具体参与劫掠的骑兵栈仍自动选择。
- 避战目标仍自动选择。

## 2026-06-01 16:07 +08 增补：守方骑兵避战目标选择

### 本轮范围

- 继续补骑兵避战交互，不切回地图连线细抠。
- 本轮只把避战撤退目标从自动选择升级为可指定目标，不重写真实移动力路径、真实掷骰或玩家逐木块承伤。

### 当前落地口径

- `RESOLVE_PENDING_ACTION` 与 `PENDING_ACTION_RESOLVED` 增加 `defenderCavalryEvasionRegionId`。
- 领域层：
  - 指定目标必须是当前战场相邻的守方控制区或守方友好区；
  - 指定目标合法时，骑兵撤到该区域；
  - 未指定目标时保留旧自动兜底。
- Board：
  - 根据相邻守方控制区/友好区生成 `骑兵避战至...` 按钮；
  - 每个按钮携带明确撤退目标 id。

### 关键断言

- `payment-selection.test.ts`
  - `结构化守方骑兵避战可指定相邻友方撤退目标`
  - 样例中区域 17 的排序权重高于辽西；
  - payload 指定 `city-region-19` 后，2 个后金骑兵撤到辽西；
  - 区域 17 不接收避战骑兵。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`82 passed`；
  - 七大恨定向四文件：`199 passed`；
  - `tsc`：通过；
  - ESLint：`0 errors`，剩 `Board.tsx` 一个 React Compiler memo warning；
  - 七大恨基础 Board E2E：`19 passed`。

### 仍未覆盖的风险

- 真实掷骰与玩家指定承伤仍未完成。
- 具体参与劫掠或避战的木块仍按当前自动栈顺位处理。
- 全部开局普通部队仍未完整拆分为炮兵/骑兵/步兵。

## 2026-06-01 16:50 +08 证据增补：开局关键区域结构化部队

### 审计范围

- 本轮不继续细抠七大恨地图连线/移动代价；连线只保持粗可用。
- 审计对象为开局关键区域普通部队结构化、调骑/驱虎测试 fixture、以及基础 Board E2E 是否仍可跑通。

### 实现结论

- `initialSpecialTroops` 已接入区域配置和运行时 setup。
- 当前样板开局结构化范围：
  - 皮岛：大明步兵 x2（1级）；
  - 山海关：大明步兵 x2（1级）；
  - 锦州、辽西：后金步兵 x2（2级）；
  - 咸兴、平壤、汉城：朝鲜雇佣军 x1（2级）。
- 旧的调骑/驱虎测试不再默认普通兵可当骑兵；需要骑兵的局面显式注入骑兵栈。
- E2E 已更新为新语义：调骑/驱虎显式准备骑兵源区；川兵/雇佣军提示接受与开局步兵共存。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`83 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`200 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/domain/regionConfig.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`19 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-selection-current.png`
  - 实际看到：轮盘调骑候选面板显示 `轮盘进攻/调度 · 调骑 4`，源区为皮岛，并列出辽西、东江、区域 15 等目标；该截图证明调骑 E2E 已通过显式骑兵局面跑通。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-recruit-chuanbing-current.png`
  - 实际看到：皮岛提示为大明控制、兵力 4，特殊部队行同时显示 `大明步兵 x2（1级）` 与 `川兵 x2（4级）`；该截图证明新增川兵没有覆盖开局结构化步兵。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-drive-tiger-dispatch-current.png`
  - 实际看到：后金同意驱虎吞狼后进入 `驱虎吞狼待结算`，右侧待结算面板可见 `断后结算 / 溃败结算`；该截图证明驱虎调度链在显式骑兵局面下可继续推进。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-khan-edict-hire-current.png`
  - 实际看到：山海关为蒙古控制、兵力 4，特殊部队行同时显示大明步兵与雇佣军；该截图证明大汗令箭外交雇佣链在开局结构化后仍可完成。

### 边界

- 这不是“七大恨完整完成”的声明。
- 全图普通部队尚未完整拆成炮兵/骑兵/步兵。
- 真实掷骰、玩家指定承伤、具体选择参与劫掠/避战的木块仍未完成。

## 2026-06-01 17:17 +08 证据增补：结构化战斗低级承伤优先

### 本轮范围

- 按用户最新口径，不再继续细抠地图连线/移动代价。
- 本轮只补“结构化部队承伤不完全自动”的最小可玩入口，不宣称完成逐木块手选承伤或真实掷骰。

### 实现结论

- `QidahenCasualtyPriority` 新增 `highest-level / lowest-level`。
- `RESOLVE_PENDING_ACTION` 与 `PENDING_ACTION_RESOLVED` 透传攻方/守方承伤优先级。
- 默认仍为高等级优先，保持旧链路和既有回归不变。
- Board 在待结算局面存在结构化非炮兵木块时显示：
  - `低级承伤断后`
  - `低级承伤溃败`
- 选择低级承伤后，攻方战斗损失会优先扣低级特殊部队，并把该选择带入后续战后占领，避免占领时重新按默认高等级承伤。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`84 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`202 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts`
  - 结果：`0 errors`；仍有既有 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`20 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-low-casualty-current.png`
  - 实际看到：右侧 `突袭作战待结算` 面板可见 `低级承伤断后`、`低级承伤溃败`、`断后结算`、`溃败结算` 四个按钮；按钮未被遮挡，地图与手牌 HUD 正常显示。

### 边界

- 这不是“七大恨完整完成”的声明。
- 当前仍不是逐木块点击选择具体承伤单位，只是给出低级优先/默认高等级优先两类可操作口径。
- 真实掷骰、具体选择参与劫掠/避战木块、全图普通部队完整拆分仍未完成。

## 2026-06-01 17:42 +08 证据增补：年中战败标记逐标记掷骰摘要

### 本轮范围

- 继续按用户最新口径，连线/移动代价只保留粗可用，不再作为当前阻塞。
- 本轮只推进年中战败标记与人物判定的低保真可验证链，不宣称完整人物牌系统完成。

### 实现结论

- 年中处理现在会按势力逐个读取 `defeatMarkers`。
- 每个战败标记生成一枚确定性骰值，并写入年中摘要。
- 摘要标题更新为 `年中战败标记与人物判定`。
- 处理后该势力 `defeatMarkers` 清零。
- 当前骰值仍是可复现的低保真判定记录，不是真实随机骰与完整人物离场系统。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`84 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`202 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`20 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-midyear-defeat-markers-current.png`
  - 实际看到：右侧年中摘要可见 `年中战败标记与人物判定`，并显示 `大明处理 1 个战败标记，掷骰 4`、`后金处理 1 个战败标记，掷骰 4`；页面仍保留人物离场与人物牌额外判定的低保真边界说明。

### 边界

- 这不是“七大恨完整完成”的声明。
- 当前还没有完整人物牌离场、死亡、额外人物判定与真实随机掷骰流程。
- 战败标记已经能在年中被逐标记处理、展示掷骰并清零，后续人物牌系统可以在这个入口上继续替换低保真摘要。

## 2026-06-01 18:06 +08 证据增补：普通建兵入口结构化

### 本轮范围

- 继续停止细抠地图连线/移动代价。
- 本轮只处理“普通建兵只加总数、不写结构化兵种”的数据缺口。

### 实现结论

- 大明 `征召军队 -> 6 个等级 2 部队` 现在会同步写入 `大明步兵 x6（2级）` 结构化栈。
- 蒙古 `马市贸易` 给大明建立 1-3 个部队时，会同步写入对应数量的 `大明步兵（2级）`。
- 轮盘 `军屯 / 征兵训练` 等普通加兵效果会同步写入对应势力的结构化步兵栈。
- 川兵与雇佣军入口保持既有结构化写法。
- 这让新建普通兵可以继续参与后续战斗等级估算、承伤优先级、调度兵种过滤与撤退处理。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`84 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`202 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 --grep "征召军队|马市贸易|轮盘征兵训练"`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`4 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`20 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-recruit-current.png`
  - 实际看到：皮岛提示显示 `大明步兵 x2（1级）` 与新增 `大明步兵 x6（2级）`。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-ma-shi-trade-current.png`
  - 实际看到：皮岛提示在已有步兵后额外显示 `大明步兵 x3（2级）`，证明马市贸易新兵不再只是总兵数。

### 边界

- 这不是“七大恨完整完成”的声明。
- 当前仍未提供逐木块手选建兵 UI，也未完成全部历史剧本开局部队录入。
- 但普通建兵后的部队已经进入结构化兵种数据，后续规则不再被这条入口拖回总兵数低保真。

## 2026-06-01 18:29 +08 证据增补：大汗令箭征兵结构化蒙古骑兵

### 本轮范围

- 继续停止细抠地图连线/移动代价。
- 本轮只修正 `大汗令箭 -> 征兵训练` 没有写入结构化部队的遗漏。

### 实现结论

- 普通建兵 helper 统一为 `buildRegularTroopStack()`。
- 蒙古普通建兵默认生成 `蒙古骑兵`，其他势力默认生成步兵。
- `大汗令箭 -> 征兵训练` 现在会同步写入：
  - `id: mongol-khan-edict-recruit-train-regular-cavalry-lv2`
  - `label: 蒙古骑兵`
  - `troopKind: cavalry`
  - `count: 2`
  - `level: 2`
- 摘要、日志与区域 note 都显示建立 2 个等级 2 蒙古骑兵。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`84 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`202 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 --grep "大汗令箭会先显示二选一"`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`1 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`20 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-khan-edict-current.png`
  - 实际看到：右侧大汗令箭摘要可见 `山海关建立 2 个等级 2 蒙古骑兵`；地图、轮盘、手牌与右侧 HUD 正常显示。

### 边界

- 这不是“七大恨完整完成”的声明。
- 连线/移动代价仍按粗可用处理，后续可由用户人工调整。
- 当前仍未完成真实掷骰、逐木块手选承伤/参战和全图全部普通部队历史拆分。

## 2026-06-01 19:08 +08 证据增补：战斗掷骰与真实战后/调度链

### 本轮范围

- 按用户最新口径，停止继续细抠地图连线/移动代价。
- 本轮只推进战斗掷骰、平局破胜与真实 Board E2E 链路，不宣称七大恨整体完成。

### 实现结论

- `PENDING_ACTION_RESOLVED` 事件现在携带 `battleRolls`。
- 执行层用 `RandomFn.d(6)` 生成攻方/守方骰值，reducer 只消费事件里的骰值。
- 当战后双方非炮兵剩余兵力相同且攻方骰值更高时，攻方靠掷骰胜出，进入战后处理。
- 摘要显示 `战斗掷骰：攻方 X / 守方 Y`，便于玩家知道平局为什么被打破。
- 旧 E2E `突袭待结算可收口并推进到下一位势力` 已改为真实链路：突袭结算后先处理战后占领，再执行轮盘调步、选择调度目标、结算待处理和战后占领，最后推进到蒙古。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`85 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`203 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 --grep "结构化战斗可选择低级承伤"`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`1 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 --grep "突袭待结算可收口"`
  - 环境变量同上。
  - 结果：`1 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`20 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-battle-dice-current.png`
  - 实际看到：右侧摘要可见 `战斗掷骰：攻方 4 / 守方 2`；同屏可见 `战后处理` 选择区，说明掷骰破平后进入可操作后续链，而不是只写日志。

### 边界

- 这不是“七大恨完整完成”的声明。
- 连线/移动代价保持粗可用，后续由用户按地图手调。
- 当前仍未完成逐木块手选参战/承伤、完整人物牌系统、全图全部普通部队历史拆分。

## 2026-06-01 19:27 +08 证据增补：当前势力牌堆/弃牌堆 UI

### 本轮范围

- 继续停止细抠地图连线/移动代价。
- 本轮只处理当前势力牌堆/弃牌堆显示与轮盘抽牌扣牌堆，不宣称完整三势力手牌 UI 完成。

### 实现结论

- Board 底部抽牌堆现在显示当前势力自己的 `drawPileCount`。
- Board 底部弃牌堆现在显示当前势力自己的 `discardPileCount`。
- 牌堆标签带势力名，例如 `大明抽牌`、`蒙古抽牌`、`蒙古弃牌`。
- 轮盘 `走 2` 不再只让蒙古手牌 +2，也会扣蒙古牌堆 2 张。
- 轮盘 `走 3` 会同步扣蒙古/后金各自牌堆 2 张。
- E2E 已覆盖：初始大明底部牌堆为 `20/7`；大明完成行动推进到蒙古后，底部牌堆切到蒙古 `18/0`。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`111 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`206 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`20 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-faction-decks-current.png`
  - 实际看到：顶部玩家条显示蒙古为当前势力；底部左侧牌堆标签为 `蒙古抽牌` 且数量为 `18`；底部右侧弃牌标签为 `蒙古弃牌` 且数量为 `0`。这证明底部牌堆已跟随当前势力切换，并且轮盘抽牌扣掉了蒙古牌堆。

### 边界

- 这不是“七大恨完整完成”的声明。
- 本轮没有实现完整三势力实体手牌 UI，也没有处理逐木块手选参战/承伤。
- 连线/移动代价仍保持粗可用，后续由用户人工调整。

## 2026-06-01 20:03 +08 证据增补：当前势力实体手牌隔离

### 本轮范围

- 按用户最新口径停止继续细抠地图连线/移动代价。
- 本轮只处理当前势力实体手牌错位，不宣称七大恨整体完成。

### 实现结论

- `QidahenHandCard` 增加 `faction` 字段。
- setup 现在为大明、蒙古、后金建立各自实体手牌；大明仍保留原先 6 张可见手牌。
- Board 底部手牌区按 `currentFactionId` 过滤，只显示当前势力手牌。
- 支付选择、自动支付和命令校验均过滤当前势力，防止蒙古/后金回合误消费大明剩牌。
- 轮盘 `走 2 / 走 3` 的对手抽牌会同步生成蒙古/后金实体手牌，实体手牌数量与势力 `handCount` 对齐。
- 蒙古与后金手牌预览图集已注册，后续不会继续强制复用大明牌面图集。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`86 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`207 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/ui/cardAtlas.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts -g "可执行操作与支付仍走真实 Board 交互" --workers=1`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`1 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`20 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-faction-hand-current.png`
  - 实际看到：顶部玩家条显示蒙古为当前势力；底部左侧为 `蒙古抽牌 18`，右侧为 `蒙古弃牌 0`；中间手牌区显示 8 张蒙古实体手牌。大明 `hand-1` 这类剩牌没有继续出现在蒙古回合手牌区，说明手牌展示与当前势力已经对齐。

### 边界

- 这不是“七大恨完整完成”的声明。
- 连线/移动代价仍保持粗可用，后续由用户人工调整。
- 当前仍未完成逐木块手选参战/承伤、完整人物牌系统、全图全部普通部队历史拆分。

## 2026-06-01 20:28 +08 证据增补：外交旧占位移除与骑兵劫掠 Board 链

### 本轮范围

- 按用户最新要求，停止继续细抠地图连线/移动代价。
- 本轮只处理七大恨可玩流程里的两处硬边界：轮盘外交雇佣旧占位路径，以及攻方骑兵劫掠在真实 Board 上的可操作证据。

### 实现结论

- `QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIGS` 不再把 `wheel-attack` 当即时效果配置。
- `applyWheelImmediateEffect()` 已删除 `specialTroopKind === 'mercenary-lv2'` 的旧死分支。
- 运行代码里不再出现 `外交标记后续补齐`、`当前最小正式实现` 这类旧占位摘要。
- 轮盘外交雇佣仍通过 `buildDiplomacySelection()` 进入 `diplomacy-choice`，可放友好/附庸/移除标记，并在结束时建立 2 个等级 2 雇佣军。
- 新增真实 Board E2E 覆盖攻方骑兵劫掠守方牌堆：待结算面板显示 `骑兵劫掠守方牌堆`，点击后摘要显示抽后金牌堆收益，并推进到下一势力行动窗口。
- 领域回归补充断言：骑兵劫掠抽守方牌堆时，除了势力 `handCount` 增加，`handCards` 实体手牌数量也同步增加。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`86 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`207 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/wheelRules.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 -g "攻方骑兵可在真实 Board 待结算中选择劫掠守方牌堆"`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`1 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`21 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-cavalry-plunder-current.png`
  - 实际看到：右侧摘要显示 `大明 自 区域 16 以 2 个骑兵劫掠 区域 14`、`抽后金牌堆获得 2 张手牌`、`守军仍留在原地`；顶部已推进到蒙古行动窗口，说明没有卡在待结算。

### 边界

- 这不是“七大恨完整完成”的声明。
- 连线/移动代价保持粗可用，后续由用户人工调整。
- 当前仍未完成完整人物牌系统、逐木块手选参战/承伤、全图全部普通部队历史拆分。

## 2026-06-01 20:41 +08 证据增补：守方骑兵避战 Board 链

### 本轮范围

- 继续停止细抠地图连线/移动代价。
- 本轮只把守方骑兵避战从领域层覆盖推进到真实 Board 端到端证据，不宣称完整战斗系统完成。

### 实现结论

- 真实 Board 待结算面板可以显示守方骑兵避战目标按钮。
- 点击 `骑兵避战至辽西` 后，右侧摘要显示守方骑兵避战转移。
- 避战后不会给守方后金增加战败标记。
- 目标区域辽西会接收避战骑兵，地图提示显示 `后金骑兵 x2（2级）`。
- 避战导致原战场无守军时，会进入战后处理，让攻方继续决定是否占领或回退。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`207 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 -g "守方骑兵可在真实 Board 待结算中选择避战目标"`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`1 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`22 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-cavalry-evasion-current.png`
  - 实际看到：右侧摘要包含 `守方骑兵避战 2 撤至 辽西`，下方显示 `战后处理 · 区域 14`；地图提示为 `辽西 · 后金`，显示 `兵力 3` 与 `特殊 后金骑兵 x2（2级）`。顶部后金玩家条没有 `败×1`。

### 边界

- 这不是“七大恨完整完成”的声明。
- 当前仍未完成完整人物牌系统、逐木块手选参战/承伤、全图全部普通部队历史拆分。

## 2026-06-01 21:12 +08 证据增补：战败标记人物槽最小闭环

### 本轮范围

- 继续停止细抠地图连线/移动代价。
- 本轮只补战败标记与人物槽的最小可玩关系：标记要能落到人物上、UI 能看见、年中能逐标记结算并清空。
- 不展开完整人物牌系统，不实现人物牌具体能力、人物离场或人物额外判定。

### 实现结论

- `QidahenFactionState` 新增 `characters`，记录场上人物的最小状态：人物名、数字、是否可承载战败标记、当前战败标记数。
- 野战战败时，`addDefeatMarkerToFaction()` 会同步增加势力 `defeatMarkers`，并把标记放到人物槽。
- 分配顺序按最小可玩规则执行：优先可承载标记、当前标记数更少、数字更低的人物；这能覆盖“场上人物都有战败标记时重新从数字最小的开始放”的规则方向。
- 年中结算兼容旧状态：如果只有势力 `defeatMarkers` 而人物槽没有对应标记，会先补到人物槽，再生成掷骰摘要。
- Board 顶部势力条新增人物标记行，战败后能看到 `努尔哈赤(1)败×1`。
- 年中摘要会显示人物明细，例如 `大明人物 1(1) 掷 4`、`努尔哈赤(1) 掷 4`，随后清空势力与人物槽战败标记。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`86 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`207 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 -g "野战战败会给败方显示战败标记|轮盘跨过年中与新年时会显示结算摘要和防线状态"`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`2 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`22 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-defeat-marker-current.png`
  - 实际看到：顶部后金势力条显示 `败×1`；同一势力条的人物行显示 `努尔哈赤(1)败×1`。右侧仍在 `战后处理`，可继续选择占领或回退，说明人物标记显示没有打断战后流程。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-midyear-defeat-markers-current.png`
  - 实际看到：右侧年中摘要显示 `大明处理 1 个战败标记，掷骰 4（大明人物 1(1) 掷 4）` 与 `后金处理 1 个战败标记，掷骰 4（努尔哈赤(1) 掷 4）`；顶部后金势力条已经没有 `败×1`，说明年中清空生效。

### 边界

- 这不是“七大恨完整完成”的声明。
- 这也不是完整人物牌系统：人物牌具体能力、人物离场、人物额外判定仍未实现。
- 当前仍未完成逐木块手选参战/承伤、全图普通部队拆分。

## 2026-06-01 21:55 +08 证据增补：年中战败标记人物离场

### 本轮范围

- 继续停止细抠地图连线/移动代价。
- 本轮只把战败标记的人物判定推进到“掷出人物数字会离场”的最小规则闭环。
- 不展开完整人物牌能力系统，不实现人物牌额外判定。

### 实现结论

- 年中处理战败标记时，会按人物槽逐人物、逐标记掷骰。
- 若骰值等于人物数字，该人物 `inPlay=false`，人物槽战败标记清空。
- 若人物因本次骰值离场，不再继续处理该人物剩余战败标记。
- 年中摘要显示离场明细，例如 `林丹·乎图克图(1) 掷 1 离场`。
- Board 顶部人物数会反映离场后的在场人物数量，E2E 中蒙古显示为 `人物 2`。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`86 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`207 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts`
  - 结果：`0 errors`；仍有既有 E2E `no-explicit-any` warnings。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 -g "轮盘跨过年中与新年时会显示结算摘要和防线状态"`
  - 环境变量：`PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true`、`PW_ISOLATE_PORTS=true`、`PW_HAS_EXPLICIT_TARGET=true`、`PW_TEST_TARGET=e2e/qidahen-basic-flow.e2e.ts`。
  - 结果：`1 passed`。
- `npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1`
  - 环境变量同上。
  - 结果：`22 passed`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-midyear-defeat-markers-current.png`
  - 实际看到：右侧年中摘要包含 `蒙古处理 1 个战败标记，掷骰 1（林丹·乎图克图(1) 掷 1 离场）`；顶部蒙古玩家条显示 `人物 2`，说明人物离场已反映到 Board。

### 边界

- 这不是“七大恨完整完成”的声明。
- 这也不是完整人物牌系统：人物牌额外判定与具体牌面能力仍未实现。
- 当前仍未完成逐木块手选参战/承伤、全图普通部队拆分。

## 2026-06-01 22:40 +08 证据增补：新年兵力耗损同步扣结构化部队

### 本轮范围

- 按用户最新口径停止继续细抠地图连线/移动代价。
- 本轮只修新年领域结算账本：兵力耗损不能只扣区域总兵力，还要同步扣结构化部队栈。
- 不新增 Board UI，也不宣称七大恨完整完成。

### 实现结论

- `resolveNewYear()` 在无法补足补给、需要部队减员时，会调用 `applyUpkeepAttritionToRegion()`。
- 兵力耗损先消耗未结构化普通兵；若损失超过普通兵，再按低等级优先扣 `specialTroops`。
- 区域 `troops` 总数和 `specialTroops` 栈现在会一起变化，避免地图提示/战斗结算继续看到已经被新年耗损移除的木块。

### 自动化证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`87 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`208 passed`。
- `npx tsc --noEmit --pretty false`
  - 结果：通过。
- `npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts`
  - 结果：`0 errors`。

### 关键断言

- `payment-selection.test.ts`
  - `新年兵力耗损会同步扣除结构化部队栈`
  - 场景屏蔽朝鲜朝贡干扰，皮岛为大明控制，`troops=4`、`population=1`、大明手牌为 `0`。
  - 新年选择放弃维护后，皮岛无法补足 3 点补给：总兵力变为 `1`，低级步兵栈被清空，等级 4 步兵剩 `1`。

### 边界

- 本轮没有新增截图，因为没有新增可操作 UI 或视觉链路，只修改领域新年结算。
- 连线/移动代价仍保持粗可用，后续由用户手调。
- 当前仍未完成完整人物牌能力、逐木块手选参战/承伤、全图普通部队拆分。

## 2026-06-01 23:16 +08 证据增补：待结算进攻实际投入数量选择

### 本轮范围

- 按用户“连线大概就行，主要完成游戏”的最新口径，本轮不再继续调地图连线/移动代价。
- 本轮只补待结算进攻里“实际投入多少部队”的最小可玩交互。
- 不宣称完整逐木块手选、完整承伤 UI 或完整七大恨规则完成。

### 实现结论

- `RESOLVE_PENDING_ACTION` 与 `PENDING_ACTION_RESOLVED` 支持可选 `committedTroops`。
- 未传 `committedTroops` 时保持旧行为，继续使用 `pendingTargetAction.committedTroops`。
- 传入 `committedTroops` 时，会按 `1..原待结算投入` 夹取，并结合源区当前可用兵力、调度兵种 profile 与边界上限，重算实际投入和进攻压力。
- Board 待结算面板新增 `实际投入 1..N` 选择条；断后、溃败、低级承伤、骑兵劫掠、骑兵避战都会带当前选择进入结算。
- 空守军分支的日志补充 `投入 N 部队`，避免回看时不知道实际投入数。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 -g "待结算面板可选择实际投入数量并按选择占领"
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`88 passed`
  - 七大恨定向四文件：`209 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 `Board.tsx` React Compiler memo warning
  - 聚焦 E2E：`1 passed`
  - 整份七大恨 Board E2E：`23 passed`

### 关键断言

- `payment-selection.test.ts`
  - `待结算进攻可选择少投入部队并按选择数量进入战后处理`
  - 构造待结算原投入 `4`，执行 `RESOLVE_PENDING_ACTION` 传 `committedTroops: 2`。
  - 战后选择显示 `committedTroops=2 / survivingTroops=2`，占领后源区剩 `2`，目标区进驻 `2`。
- `e2e/qidahen-basic-flow.e2e.ts`
  - `待结算面板可选择实际投入数量并按选择占领`
  - 真实 Board 中点击 `实际投入 2` 后断后结算，战后面板显示 `投入 2`，占领后领域状态源区/目标区各为 `2`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-committed-troops-current.png`
  - 实际看到：右侧待结算面板显示 `实际投入` 按钮组，`2` 已被选中；下方 `断后结算 / 溃败结算` 可见且未被遮挡。

### 边界

- 这是逐木块参战/承伤的最小一步，不是完整逐木块手选 UI。
- 连线/移动代价仍保持粗可用，后续由用户手调。
- 当前仍未完成完整人物牌能力、全图普通部队拆分和完整战斗系统。

## 2026-06-02 00:15 +08 证据增补：地图连线粗补冻结与剧本一人物在场状态

### 本轮范围

- 用户明确要求停止继续在连线设置上耗时，连线/移动代价只需要大概可用，主线转向完成七大恨游戏。
- 本轮不继续追求地图代价百分比正确，只补记已有粗补证据，并修一个直接影响年中/战败标记链的剧本一人物在场状态。

### 地图粗补结论

- `region-graph.json` 当前为 33 个节点、53 条边。
- `region-mask-regions.json` 中所有区域 `links` 都能通过 `getQidahenDirectedPassageBetween()` 找到图边。
- 水路/海岸边显式设置 `boundaryType: coast` 与 `unitCap: 2`，覆盖 `song-jin`、`xian-xing`、平壤、汉城等相关水路/海岸连接。
- 这部分只作为粗可用基线，后续由用户按实际地图继续手调。

### 人物状态实现结论

- 剧本一开局人物在场状态改为：
  - 大明：无人在场；
  - 蒙古：`林丹·乎图克图` 在场；
  - 后金：`努尔哈赤` 与 `额亦都` 在场，`范文程` 不在场。
- 大明人物候选从占位名改为 `毛文龙 / 王化贞 / 熊廷弼`，但剧本一均不在场。
- 年中战败标记测试不再依赖错误的“大明开局有人物在场”；需要验证大明人物掷骰时，测试会显式把 `毛文龙` 等人物放入场。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts -g "轮盘跨过年中与新年时会显示结算摘要和防线状态" --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`89 passed`
  - 七大恨定向四文件：`211 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；仍有既有 E2E `no-explicit-any` warnings
  - 聚焦 E2E：`1 passed`
  - 整份七大恨 Board E2E 曾跑到输出 `23 passed`，但命令外层 180 秒超时导致退出码 124，因此不作为严格通过门禁。

### 关键断言

- `payment-selection.test.ts`
  - `剧本一开局人物在场状态遵循规则设置`
  - 断言大明在场人物为空、蒙古只有 `林丹·乎图克图`、后金为 `努尔哈赤 / 额亦都`，且 `范文程` 不在场。
- `e2e/qidahen-basic-flow.e2e.ts`
  - 年中摘要断言 `毛文龙(1) 掷 4`、`林丹·乎图克图(1) 掷 1 离场`、`努尔哈赤(1) 掷 4`。
  - 林丹离场后，蒙古顶部人物数显示为 `人物 0`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-midyear-defeat-markers-current.png`
  - 实际看到：右侧年中摘要包含 `毛文龙(1) 掷 4`、`林丹·乎图克图(1) 掷 1 离场`、`努尔哈赤(1) 掷 4`。
  - 实际看到：顶部大明 `人物 1` 是 E2E 为验证大明战败标记掷骰而注入的测试人物；蒙古林丹离场后显示 `人物 0`；后金仍显示 `人物 2`。

### 边界

- 地图连线/移动代价不再作为当前主阻塞，仅保持粗可用。
- 这不是完整人物牌系统；人物牌额外判定和具体牌面能力仍未实现。
- 当前仍未完成真实掷骰、玩家指定承伤、全图普通部队结构化。

## 2026-06-02 00:35 +08 证据增补：待结算战斗可分别设置攻守承伤优先级

### 本轮范围

- 继续按用户要求，不再把地图连线/移动代价作为当前主阻塞。
- 本轮推进七大恨可玩主链中的“玩家指定承伤”切片。
- 不改战斗主算法，不宣称完整逐木块掷骰已经完成。

### 实现结论

- 待结算战斗面板新增两组独立控件：
  - `攻方承伤`：`高级先损` / `低级先损`
  - `守方承伤`：`高级先损` / `低级先损`
- `断后结算`、`溃败结算`、骑兵避战、骑兵劫掠都会把当前攻守承伤选择传入 `RESOLVE_PENDING_ACTION`。
- 旧的 `低级承伤断后 / 低级承伤溃败` 粗按钮已移除，避免只能同时改变攻守双方承伤口径。
- Board 结构门禁已改为锁住新的承伤优先级控件 testId。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/Board.tsx src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts -g "结构化战斗可选择低级承伤并继续战后占领" --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`90 passed`
  - 七大恨定向四文件：`214 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；仍有既有 E2E `no-explicit-any` warnings 与 Board memo warning
  - 聚焦 E2E：`1 passed`

### 关键断言

- `payment-selection.test.ts`
  - `结构化守方可选择低级部队优先承伤以保留守方精锐木块`
  - 场景里后金守方同时有 `后金精锐步兵` 与 `后金低级步兵`；传入 `defenderCasualtyPriority: 'lowest-level'` 后，低级步兵被移除，精锐步兵保留。
- `e2e/qidahen-basic-flow.e2e.ts`
  - `结构化战斗可选择低级承伤并继续战后占领`
  - 真实 Board 中待结算面板可见攻守承伤控件；点击攻方 `低级先损` 后执行断后结算，进入战后处理。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-low-casualty-current.png`
  - 实际看到：右侧待结算面板显示 `攻方承伤`、`守方承伤` 两组选择；攻方 `低级先损` 处于选中态；`断后结算`、`溃败结算` 按钮可见。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-battle-dice-current.png`
  - 实际看到：结算后进入 `战后处理`；右侧摘要可见攻方投入 3、损失 2、幸存 1，等待占领/返回决策。

### 边界

- 本轮是“玩家指定承伤优先级”切片，不是完整逐木块手选每一个受损木块。
- 战斗损伤仍是当前低保真估算模型；真实逐木块掷骰/按兵种阶段结算仍待继续。

## 2026-06-02 00:48 +08 证据增补：东江/蓟镇剧本一开局兵力结构化

### 本轮范围

- 用户明确要求停止继续把时间耗在连线/移动代价设置上；当前地图图数据按“粗可用、后续人工手调”冻结。
- 本轮只补游戏可玩性相关的开局兵力数据，不继续猜全图连线，也不硬猜地图编号不可靠的区域。

### 实现结论

- 东江（`city-region-22`）补为剧本一大明本土开局：
  - 大明控制；
  - 1 个 Lv1 大明步兵；
  - 2 人口。
- 蓟镇（`city-region-28`）补为剧本一大明本土开局：
  - 大明控制；
  - 1 个 Lv1 大明步兵；
  - 2 人口；
  - 继续作为山海关维护依赖区域。
- 受影响规则测试同步按新开局口径更新：
  - 年中土地税赋会把东江/蓟镇人口计入，大明税赋为 3；
  - 新年自动维护时，蓟镇受控会让山海关可以维护；
  - 外交雇佣测试显式构造中立目标，不再依赖东江默认中立；
  - 蓟镇移除控制标记后回到大明基础控制，而不是中立。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/regionConfig.ts src/games/qidahen/__tests__/payment-selection.test.ts
```

- 结果：
  - `payment-selection.test.ts`：`90 passed`
  - 七大恨定向四文件：`214 passed`
  - `tsc`：通过
  - ESLint：`0 errors`

### 关键断言

- `payment-selection.test.ts`
  - `当前样板开局会把关键前线普通部队初始化为结构化兵种`
  - 新增断言东江含 `ming-dongjiang-infantry-lv1`，蓟镇含 `ming-jizhen-infantry-lv1`。
- `轮盘进入年中时会结算土地税赋并留下摘要`
  - 大明土地税赋摘要更新为 `获得 3 张手牌`。
- `轮盘进入新年时会结算朝鲜朝贡、防线维护与兵力耗损`
  - 山海关在蓟镇受控且自动维护时保持未破败。

### 边界

- 本轮没有 UI 变更，因此未新增 E2E 截图。
- 建州、长白、察哈尔等区域编号尚未可靠确认，本轮未硬猜。
- 连线/移动代价不再作为当前主阻塞，后续由用户手调；主线继续补七大恨游戏本体。

## 2026-06-02 00:59 +08 证据增补：战斗平局改回守方获胜

### 本轮范围

- 继续停止地图连线细调；本轮只修七大恨战斗裁定。
- 修正对象是战斗胜负判定中的平局规则，不改地图、不改战后 UI 主结构。

### 实现结论

- 规则书口径：战斗后剩余部队数较多的一方为胜方；若剩余部队数相同，守方获胜，攻方必须撤退。
- 已修正：
  - 攻方必须在非炮兵剩余数量上严格大于守方才算突破；
  - 平局不再进入战后占领；
  - 平局时攻方按断后/溃败撤退规则结算，并在野战拿战败标记；
  - 移除 `PENDING_ACTION_RESOLVED` 的额外 `battleRolls` 载荷与额外战斗掷骰日志。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/regionConfig.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 -g "结构化战斗可选择低级承伤并继续战后占领"
```

- 结果：
  - `payment-selection.test.ts`：`90 passed`
  - 七大恨定向四文件：`214 passed`
  - `tsc`：通过
  - ESLint：`0 errors`，仍有既有 E2E `no-explicit-any` warnings
  - 聚焦 E2E：`1 passed`

### 关键断言

- `payment-selection.test.ts`
  - `战斗双方剩余兵力相同时守方获胜，攻方必须撤退`
  - 4 打 4 后双方非炮兵剩余都是 1；
  - 目标区守军保留 1，不进入战后占领；
  - 源区攻方因战斗损失 3 + 断后损失 1 清空；
  - 大明获得 1 个战败标记。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-battle-resolution-current.png`
  - 实际看到：真实 Board 仍能从待结算进入战后处理；
  - 右侧摘要显示 `等级损伤估算`，不再显示额外 `战斗掷骰`。

### 边界

- 这不是完整逐木块掷骰/按兵种阶段结算；当前损伤仍是现有等级估算模型。
- 本轮只纠正平局胜负规则和移除误导性额外战斗掷骰。

## 2026-06-02 01:26 +08 证据增补：结构化战斗按兵种阶段掷骰

### 本轮范围

- 按用户“停止连线设置，完成游戏最重要”的要求，继续冻结地图连线/移动代价细调。
- 本轮只推进七大恨战斗主链，不改地图工具、不宣称完整游戏完成。

### 实现结论

- 结构化战斗不再用旧 `等级损伤估算` 作为主伤害来源。
- `RESOLVE_PENDING_ACTION` 执行阶段生成 `battleRolls` 事件载荷，reducer 只消费事件内骰值：
  - 野战：炮兵、骑兵、步兵阶段；
  - 城战：炮兵、骑步阶段；
  - Lv1/Lv2/Lv3/Lv4 对应 d6/d8/d10/d12；
  - 每 3 点造成 1 损伤；
  - 城战骑兵骰值 -1；
  - 炮兵仍不承伤、不计胜负。
- 攻守承伤优先级继续沿用待结算面板的 `高级先损 / 低级先损`。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'
npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 -g "结构化战斗可选择低级承伤并继续战后占领"
```

- 结果：
  - `payment-selection.test.ts`：`90 passed`
  - 七大恨四文件：`214 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；仍有既有 E2E `no-explicit-any` warnings
  - 聚焦 E2E：`1 passed`

### 关键断言

- `payment-selection.test.ts`
  - `结构化川兵会按兵种阶段掷骰结算战斗损伤，而不是只按总兵力处理`
  - 断言战斗日志包含 `战斗掷骰（野战）`，并按掷骰结果写出攻守造成损伤。
- `e2e/qidahen-basic-flow.e2e.ts`
  - `结构化战斗可选择低级承伤并继续战后占领`
  - 真实 Board 上点击攻方 `低级先损` 后执行断后结算，右侧摘要必须显示 `战斗掷骰`，再进入战后占领选择。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-battle-resolution-current.png`
  - 实际看到：右侧摘要显示 `战斗掷骰（野战）`。
  - 实际看到：步兵阶段显示攻方 `10/2/4=16`、守方 `4/3=7`，摘要写明攻方造成 5 损伤、守方造成 2 损伤。
  - 实际看到：战斗后进入 `战后处理`，可选 `占领该区` 或 `返回 区域 16`，没有卡死。

### 边界

- 骑兵避战、骑兵劫掠仍暂走旧低保真专门结算。
- 这还不是完整逐木块手选每一枚骰或每一枚木块承伤 UI。
- 地图连线/移动代价继续只作为粗可用数据，后续由用户手调。

## 2026-06-02 01:42 +08 证据增补：步骑全灭后孤立炮兵同步移除

### 本轮范围

- 按用户“停止继续设置连线，完成游戏最重要”的要求，地图连线/移动代价继续冻结为粗可用数据。
- 本轮只修七大恨战斗领域规则，不改地图工具、不改 Board UI。

### 实现结论

- 规则书口径：炮兵不承受战斗损伤，也不列入胜负部队数；但撤退损失结算后若步兵或骑兵全数阵亡，炮兵也会阵亡。
- 已修正：
  - 结构化战斗承伤写回区域后，会检查剩余特殊部队；
  - 如果剩余总兵力只由炮兵构成，直接移除这些无掩护炮兵；
  - 目标区与源区都不再留下“步骑已死光但炮兵还站在区域里”的状态。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
```

- 结果：
  - `payment-selection.test.ts`：`91 passed`
  - 七大恨四文件：`215 passed`
  - `tsc`：通过
  - ESLint：`0 errors`

### 关键断言

- `payment-selection.test.ts`
  - `战斗后步骑全灭时不会留下孤立炮兵`
  - `战斗损伤不会由炮兵承受，炮兵也不计入胜负兵力，步骑全灭后炮兵一并移除`
- 覆盖场景：
  - 守方原有 1 个步兵与 1 个炮兵；
  - 战斗后守方步兵被消灭，炮兵不承伤、不计胜负；
  - 因步骑全灭，守方目标区最终 `troops=0`、`specialTroops=[]`，不会留下孤立炮兵。

### 边界

- 本轮没有 UI 改动，未新增 E2E 截图。
- 骑兵避战、骑兵劫掠仍暂走旧低保真专门结算。
- 完整人物牌能力、全图普通部队拆分、逐木块手选承伤仍未完成。

## 2026-06-02 01:55 +08 证据增补：势力行动窗口手牌上限

### 本轮范围

- 按用户“停止继续设置连线，完成游戏最重要”的要求，地图连线/移动代价继续冻结为粗可用数据。
- 本轮只修七大恨领域层手牌流程，不改地图工具、不改 Board UI。

### 实现结论

- 玩家行动开始时应先检查手牌是否超过上限。
- 已修正：
  - `advanceTurnIfReady()` 推进到下一势力行动窗口后执行手牌上限；
  - 若该势力 `handCount > handLimit`，会把超出数量弃入该势力弃牌堆；
  - 同步把 `handCount` 裁到上限，并从 `handCards` 中移除对应势力实体手牌；
  - 日志写出 `手牌超过上限`，避免自动裁牌不可追踪。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
```

- 结果：
  - `payment-selection.test.ts`：`92 passed`
  - 七大恨四文件：`216 passed`
  - `tsc`：通过
  - ESLint：`0 errors`

### 关键断言

- `payment-selection.test.ts`
  - `进入势力行动窗口时会按手牌上限弃掉多余手牌`
- 覆盖场景：
  - 蒙古进入行动窗口前有 12 张手牌，上限为 10；
  - 大明完成势力行动和轮盘行动后推进到蒙古；
  - 蒙古 `handCount=10`、弃牌堆 `+2`、实体蒙古手牌为 10 张；
  - 日志包含 `手牌超过上限 10，自动弃掉 2 张牌`。

### 边界

- 本轮没有 UI 改动，未新增 E2E 截图。
- 当前是自动弃牌的最小可玩口径，不是完整的玩家手动选择弃牌交互。
- 地图连线/移动代价继续只作为粗可用数据，后续由用户手调。
## 2026-06-02 02:35 +08 粗图谱回填后 Board E2E 恢复全绿

- 按用户最新口径，停止继续细调地图连线/移动代价；当前连线只作为粗可用数据，后续由用户人工手调。
- 本轮只修因用户手绘 `region-mask.png` 回填图谱和剧本一开局口径变化导致的 E2E 过时断言：
  - 轮盘调度不再把东江当作大明可攻击目标，改测皮岛到 `区域 15` 的调骑 4 链路：候选目标、待结算、战后占领都能在真实 Board 操作完成。
  - 轮盘外交雇佣不再要求对有大明正规军的东江放友好标记，改测相邻中立无正规军的 `区域 15`。
  - 新年防线维护断言改成当前规则事实：山海关与内长城完整，锦州与宁远因失去辽西破败。
- 验证结果：
  - `npx eslint e2e/qidahen-basic-flow.e2e.ts`：`0 errors`，保留既有 `38 warnings`。
  - 聚焦三条修复用例：`3 passed`。
  - 整份 `e2e/qidahen-basic-flow.e2e.ts`：`23 passed`。
  - `npx tsc --noEmit --pretty false`：通过。
  - 七大恨定向 `payment-selection + movementRules + Board + mapGraph`：`217 passed`。
- 已实际看图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-selection-current.png`：皮岛调骑 4 出现辽西与区域 15 候选，地图高亮与候选列表一致。
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-dispatch-current.png`：点击区域 15 后进入调度进攻待结算，显示实际投入、承伤和断后/溃败按钮。
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-post-battle-current.png`：区域 15 进入战后处理，可占领或退回。
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-season-flow-current.png`：新年摘要显示山海关/内长城完整，锦州/宁远破败。
- 边界：
  - 这不是七大恨完整完成声明；
  - 地图移动代价仍是粗可用；
  - 仍需继续推进完整人物牌能力、逐木块手选参战/承伤、全图普通部队结构化等游戏本体缺口。

## 2026-06-02 03:46 +08 证据增补：手牌上限由玩家手动选择弃牌

### 本轮范围

- 按用户最新要求，停止继续细调地图连线/移动代价；当前图谱只作为粗可用底座。
- 本轮只收七大恨游戏本体中的手牌上限交互，不继续改地图工具。

### 实现结论

- 进入下一势力行动窗口时，如果该势力 `handCount > handLimit`：
  - 进入 `hand-limit-discard` 阶段；
  - 创建 `handLimitDiscardSelection`，记录需要弃牌数量、候选实体手牌和已选择牌；
  - 阻塞轮盘、行动、地图目标等其它操作；
  - 玩家点击底部当前势力手牌选择要弃掉的牌；
  - 确认后仅移除玩家选择的实体手牌，并增加该势力弃牌堆。
- UI 面板文案使用 `已择` 而不是 `已选`，保留旧 payment 半成品结构门禁，不通过放宽门禁过测。
- 手牌 dock 支持横向滚动，避免超限场景下 12 张牌溢出导致左侧牌不可点击。

### 自动化证据

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\games\qidahen\__tests__\payment-selection.test.ts src\games\qidahen\__tests__\movementRules.test.ts src\games\qidahen\__tests__\Board.test.ts src\games\qidahen\__tests__\mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨四文件：`217 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；保留既有 E2E `no-explicit-any` warnings 与 Board React Compiler memo warning
  - 整份 `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

### 关键断言

- `payment-selection.test.ts`
  - `进入势力行动窗口时会要求玩家选择超限弃牌`
  - 覆盖蒙古 12/10 进入 `hand-limit-discard`，选择两张候选牌，确认后回到 `action-window`，手牌数变 10，弃牌堆 +2，所选实体手牌消失。
- `e2e/qidahen-basic-flow.e2e.ts`
  - `进入新势力行动窗口时可手动选择超限弃牌`
  - 覆盖真实 Board 上从大明行动推进到蒙古行动窗口、点击底部两张手牌、确认弃牌、蒙古弃牌堆变 3、手牌回到 10 张。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-hand-limit-discard-current.png`
  - 实际看到：右侧面板显示 `蒙古 · 检查手牌上限`。
  - 实际看到：状态行显示 `手牌 12/10 · 需弃 2 · 已择 2`，说明已经手动选够两张。
  - 实际看到：底部前两张蒙古手牌有高亮白框，确认弃牌按钮可见，没有被遮挡。
  - 实际看到：画面为当前七大恨新版 Board，地图、轮盘、手牌 dock、右侧行动区同时存在，不是旧 UI 回滚截图。

### 边界

- 本轮不继续调整地图连线/移动代价；当前图谱只作为粗可用数据。
- 这不是完整七大恨完成声明。
- 仍未完成完整人物牌能力、逐木块手选参战/承伤、全图普通部队结构化。

## 2026-06-02 04:12 +08 证据增补：地图粗值冻结与新年耗损移除明细

### 本轮范围

- 按用户最新要求，停止继续细调连线/移动代价；当前地图图谱只作为粗可用底座，后续由用户人工手调。
- 本轮不再改地图工具 UI，不新增连线编辑能力，只把已有粗图谱证据和游戏本体小切片收口。

### 地图粗图谱证据

- `src/games/qidahen/data/region-graph.json` 当前为 `33 nodes / 77 edges`。
- `src/games/qidahen/data/region-mask-regions.json` 的 links 与 graph 边集合对齐。
- 本轮保留 8 条明显长距离 `plain` 边的粗代价 `travelCost=3 / reverseTravelCost=3`，作为可手调初稿。
- 已实际查看 `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-graph-overlay-current.png`：
  - 8 条粗补边以红线标出，标号为 `3`；
  - 山海关方向关键边仍保留 `1`，没有被本轮误抬高。

### 游戏本体实现结论

- 新年兵力耗损的自动兜底不再是黑箱摘要：
  - `applyUpkeepAttritionToRegion()` 返回实际移除明细；
  - `resolveNewYear()` 将明细写入区域 note 与新年摘要；
  - 示例：`移除：大明低级步兵 x2、大明精锐步兵 x1`。
- 当前仍不是完整“控制玩家逐木块选择耗损”的交互；本轮只先把自动兜底结果变成可审计文本。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts
```

- 结果：
  - `payment-selection.test.ts`：`92 passed`
  - 七大恨四文件：`217 passed`
  - `tsc`：通过
  - ESLint：`0 errors`

### E2E 状态

- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-basic-flow.e2e.ts` 未进入业务，原因是未登记 runtime 占用 `6273/20100/21100`。
- 改走 `PW_WORKERS=1` legacy/global setup 后，heavy-budget 拦截：`freeMemory=1.49GB < 1.5GB`。
- 本轮不把这两次记为七大恨业务失败，也不宣称整份 E2E 已通过。

### 边界

- 地图移动代价冻结为粗可用，不再继续细抠。
- 新年耗损仍未提供逐木块手选 UI，只补了可审计明细。
- 七大恨仍未完整完成；下一步继续优先做本体流程，而不是地图工具。

## 2026-06-02 04:26 +08 证据增补：新年兵力耗损优先级选择

### 本轮范围

- 按用户最新要求，停止继续细调地图连线/移动代价；当前图谱只作为粗可用底座。
- 本轮只收七大恨游戏本体中的新年兵力耗损选择，不继续改地图工具。

### 实现结论

- 新年防线维护选择时，玩家现在可以同时选择兵力耗损优先级：
  - `低级先损`：优先移除低等级结构化部队；
  - `高级先损`：优先移除高等级结构化部队。
- `RESOLVE_FORTIFICATION_MAINTENANCE` payload 携带 `attritionPriority`。
- `resolveNewYear()` 按所选优先级处理新年兵力耗损，并在区域 note 与新年摘要里写出所选口径和实际移除明细。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/domain/commands.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - `payment-selection.test.ts`：`93 passed`
  - `Board.test.ts`：`115 passed`
  - 七大恨四文件：`220 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；保留既有 Board memo warning 与 E2E `no-explicit-any` warnings
  - 整份 `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

### 关键断言

- `payment-selection.test.ts`
  - `新年兵力耗损会同步扣除结构化部队栈`
  - `新年兵力耗损可选择高级先损并保留低级部队`
- `Board.test.ts`
  - 结构门禁包含 `qidahen-upkeep-attrition-priority`、`qidahen-upkeep-attrition-lowest-level`、`qidahen-upkeep-attrition-highest-level`。
- `e2e/qidahen-basic-flow.e2e.ts`
  - 季节链在真实 Board 上看到新年防线维护面板；
  - 面板包含 `兵力耗损` 控件；
  - 点击 `高级先损` 后继续完成维护选择。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-fortification-maintenance-current.png`
  - 实际看到：右侧为当前七大恨新版 Board 的新年防线维护面板。
  - 实际看到：面板中存在 `兵力耗损`、`低级先损`、`高级先损` 三个可见文本。
  - 实际看到：`高级先损` 已处于选中状态，维护按钮仍可继续点击。

### 边界

- 当前是耗损优先级选择，不是逐木块手选每一个耗损部队。
- 地图移动代价保持粗可用，不继续细抠。
- 七大恨仍未完整完成；下一步继续推进游戏本体，优先补全开局普通兵力结构化或更完整的人物牌能力。

## 2026-06-02 04:49 +08 证据增补：剧本一初始牌数基线

### 本轮范围

- 按用户要求停止继续细调地图连线/移动代价；当前图谱只作为粗可用底座。
- 本轮只修七大恨剧本一初始手牌数量，不展开完整剧本设置卡录入。

### 实现结论

- 规则书剧本一基线：
  - 大明：3 张手牌；
  - 蒙古：6 张手牌；
  - 后金：10 张手牌。
- 已修正 `createFactionState()` 的初始牌数：
  - 旧：大明 5、蒙古 6、后金 8；
  - 新：大明 3、蒙古 6、后金 10。
- 同步更新真实 Board / E2E 里依赖旧基线的手牌数断言。
- 大明 UI 仍保留 1 张不可支付展示牌，因此初始底部可见 4 张大明牌，其中 3 张是可支付手牌。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'; $env:PW_ISOLATE_PORTS='true'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'; npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1
```

- 结果：
  - `payment-selection.test.ts`：`94 passed`
  - 七大恨四文件：`221 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；保留既有 E2E `no-explicit-any` warnings
  - 整份 `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

### 关键断言

- `payment-selection.test.ts`
  - `剧本一开局手牌数量遵循规则设置`
  - 大明 `handCount=3`，蒙古 `handCount=6`，后金 `handCount=10`。
  - 大明实体手牌中可支付牌为 3 张，保留额外不可支付展示牌。
- `e2e/qidahen-basic-flow.e2e.ts`
  - 桌面主链初始手牌区显示 4 张大明牌；
  - 赐印招安后大明为 `0/15`；
  - 轮盘给后金抽 2 后显示 `12/10`；
  - 征召军队后大明为 `2/15`。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-current.png`
  - 实际看到：底部大明手牌区显示 4 张牌。
  - 实际看到：后金顶部显示 `10/10`，不再是旧的 `8/10`。
  - 实际看到：界面为当前新版七大恨 Board，地图、轮盘、势力条、牌堆和手牌 dock 同屏存在。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-action-flow-current.png`
  - 实际看到：赐印招安后大明为 `0/15`。
  - 实际看到：后金经轮盘抽牌后为 `12/10`。
  - 实际看到：当前轮到蒙古，底部显示蒙古手牌。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-recruit-current.png`
  - 实际看到：征召军队后大明为 `2/15`。
  - 实际看到：右侧摘要显示 `建立 6 个等级 2 部队`。
  - 实际看到：地图提示中皮岛兵力为 `8`，说明征召落地后状态可见。

### 边界

- 本轮不是完整剧本设置卡录入；开局区域、人物牌能力、军备开发等仍需继续推进。
- 地图连线/移动代价保持粗可用，不作为当前主阻塞。
- 后续若补全完整剧本设置，应继续以规则书和设置卡为真相源，不再沿用旧的手牌基线。

## 2026-06-02 05:25 +08 证据增补：剧本一核心本土结构化

### 本轮范围

- 按用户最新要求停止继续设置连线/移动代价；当前地图图谱只作为粗可用底座。
- 本轮只补规则书剧本一中与地图图面能同时确认的核心本土，不展开完整剧本设置卡录入。

### 实现结论

- 建州（`city-region-13`）：
  - 后金控制，标记为后金首都；
  - 2 个 Lv4 后金精锐步兵、1 个 Lv2 后金步兵；
  - 2 人口。
- 长白（`city-region-11`）：
  - 后金控制；
  - 2 个 Lv2 后金步兵；
  - 2 人口。
- 察哈尔（`city-region-14`）：
  - 蒙古控制；
  - 3 个 Lv3 蒙古骑兵；
  - 3 人口。
- Board 初始地图新增对应控制/兵力/人口 token，避免规则状态只存在于 tooltip 或领域数据里。
- 受影响的测试夹具已修正：旧用例临时把察哈尔当后金测试战场时同步清空原蒙古骑兵；旧联姻诱降链路按真实大汗令箭选择态结算。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/regionConfig.ts src/games/qidahen/__tests__/payment-selection.test.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'; $env:PW_ISOLATE_PORTS='true'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'; npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 --reporter=line
```

- 结果：
  - 七大恨定向四文件：`221 passed`
  - `tsc`：通过
  - ESLint：`0 errors`
  - 整份 `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-current.png`
  - 实际看到：新增本土数值 token 可见。
  - 实际看到：顶部势力条仍显示大明、蒙古、后金，蒙古为 `6/10`，后金为 `10/10`。
  - 实际看到：界面仍是当前新版七大恨 Board，地图、轮盘、牌堆和底部手牌 dock 同屏存在。

### 边界

- 本轮只补建州、长白、察哈尔三个高置信区域。
- 完整剧本设置卡仍未完成；辉发/哈达/叶赫/辽东/辽北/顺天等区域编号需要继续确认后再结构化。
- 地图连线/移动代价继续保持粗可用，不再作为当前主阻塞。

## 2026-06-02 06:18 +08 证据增补：剧本一已开发军备状态

### 本轮范围

- 按用户最新要求，继续停止细调地图连线/移动代价；当前地图图谱只作为粗可用底座。
- 本轮只补剧本一规则书已经明确的已开发军备/科技状态，不一次性接完整军备效果。

### 实现结论

- `QidahenFactionState` 增加 `armaments`，作为后续火炮建立/训练和铁甲战斗效果的正式数据源。
- 剧本一初始化：
  - 大明：`火炮技术1`
  - 蒙古：`骑兵铁甲1`
  - 后金：`步兵铁甲1`
- Board 顶部势力条新增军备摘要：
  - `qidahen-armaments-ming`
  - `qidahen-armaments-mongol`
  - `qidahen-armaments-jin`
- E2E 地图点击 helper 同步修稳：
  - 对真实 hitmap canvas 派发 `pointermove/pointerdown/pointerleave`；
  - `songjin / liaoxi / region15` 使用 mask seed 点；
  - 避免透明层拦截、hover 残留和隐式选区导致的误判。

### 自动化证据

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/types.ts src/games/qidahen/domain/index.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'; $env:PW_ISOLATE_PORTS='true'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:PW_TEST_TARGET='e2e/qidahen-basic-flow.e2e.ts'; npx playwright test e2e/qidahen-basic-flow.e2e.ts --workers=1 --reporter=line
```

- 结果：
  - 七大恨定向四文件：`223 passed`
  - `tsc`：通过
  - ESLint：`0 errors`；保留既有 E2E `no-explicit-any` warnings 与 Board React Compiler memo warning
  - 整份 `e2e/qidahen-basic-flow.e2e.ts`：`24 passed`

### 关键断言

- `payment-selection.test.ts`
  - `剧本一开局已开发军备遵循规则设置`
  - 锁住大明 `火炮技术1`、蒙古 `骑兵铁甲1`、后金 `步兵铁甲1`。
- `Board.test.ts`
  - 结构门禁包含 `data-testid={\`qidahen-armaments-${faction.id}\`}`。
- `e2e/qidahen-basic-flow.e2e.ts`
  - 首屏真实 Board 断言三势力军备摘要可见。

### 截图证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-current.png`
  - 实际看到：大明顶部势力条显示 `军备 火炮技术1`。
  - 实际看到：蒙古顶部势力条显示 `军备 骑兵铁甲1`。
  - 实际看到：后金顶部势力条显示 `军备 步兵铁甲1`。
  - 实际看到：三条军备摘要都在势力条内部，没有跑出边界；画面仍是当前新版七大恨 Board。

### 边界

- 本轮只把规则书剧本一已开发军备落为状态和可见摘要。
- 火炮技术对炮兵建立/训练等级上限、步兵/骑兵铁甲对战斗素质的效果尚未接入。
- 不能据此宣称七大恨完整完成；后续仍需继续补军备效果、人物能力和更多剧本设置。

## 2026-06-02 06:35 +08 证据增补：后金步兵铁甲进入结构化战斗掷骰

### 本轮范围

- 按用户最新要求，停止继续细抠地图连线/移动代价；当前图谱只作为粗可用底座。
- 本轮只把已开发军备中的 `步兵铁甲` 接入已有结构化战斗掷骰链，不扩展地图工具和 UI。

### 实现结论

- 结构化战斗单位现在携带所属势力和 `structured` 标记。
- 只有明确结构化的步兵/骑兵木块会吃铁甲加成；未结构化兵力不吃加成，避免旧区域被隐式增强。
- 后金 `步兵铁甲1` 会让后金结构化步兵掷骰 `+1`。
- 战斗日志通过 `4->5` 这种格式显示军备修正，损伤结算使用修正后的点数。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
```

- 结果：
  - 七大恨定向四文件：`224 passed`
  - `tsc`：通过
  - ESLint：`0 errors`

### 关键断言

- `payment-selection.test.ts`
  - `后金步兵铁甲会增强结构化步兵掷骰并进入战斗损伤`
  - 锁住后金结构化步兵固定掷 `4` 时显示 `守4->5/4->5=10`，并按修正后总点数造成 `3` 点攻方损伤。

### E2E 与截图状态

- 本轮没有新的有效 E2E 截图。
- 尝试运行整份 `e2e/qidahen-basic-flow.e2e.ts`：
  - 首次在第 1 条用例后 Node OOM；
  - 带 4GB `NODE_OPTIONS` 的整份 E2E 超过 4 分钟未返回；
  - 聚焦首屏用例在 bootstrap 阶段失败，日志显示 API/Vite runtime OOM；
  - 清理结果显示 `6174 / 20000 / 21000` 均已释放。
- 由于本轮没有 UI 改动，不能把旧截图冒充本轮视觉验收；后续需要 E2E 视觉证据时，应先处理 bootstrap OOM。

### 边界

- 本轮只接入 `步兵铁甲` 对结构化步兵的战斗掷骰加成。
- `骑兵铁甲` 已复用同一加成入口，但还需要专门战斗回归。
- `火炮技术` 对炮兵建立/训练等级上限仍待接入建兵/训练动作。
- 不能据此宣称七大恨完整完成；后续主线仍是游戏本体规则补齐。

## 2026-06-02 06:51 +08 证据增补：蒙古骑兵铁甲进入野战骑兵掷骰

### 本轮范围

- 按用户最新要求，继续停止细抠地图连线/移动代价；当前图谱只作为粗可用底座。
- 本轮只补 `骑兵铁甲` 的专门域层回归，不改 UI。

### 实现结论

- `骑兵铁甲` 复用 `getBattleRollArmamentBonus()` 通用入口。
- 蒙古结构化骑兵在野战骑兵阶段掷骰时，会按蒙古已开发 `骑兵铁甲1` 获得 `+1` 修正。
- 日志保留 `4->5` 格式，方便后续人工核对军备是否生效。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts -t "骑兵铁甲" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 --reporter verbose
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/__tests__/payment-selection.test.ts
```

- 结果：
  - 聚焦骑兵铁甲用例：`1 passed`
  - 七大恨定向四文件：`225 passed`
  - `tsc`：通过
  - ESLint：`0 errors`

### 关键断言

- `payment-selection.test.ts`
  - `蒙古骑兵铁甲会增强结构化骑兵野战掷骰并进入战斗损伤`
  - 锁住察哈尔野战场景中蒙古结构化骑兵固定掷 `4` 时显示 `骑兵 攻-=0/守4->5/4->5=10`，并按修正后总点数造成 `3` 点攻方损伤。

### E2E 与截图状态

- 本轮没有 UI 改动。
- 当前 E2E bootstrap OOM 仍是已知阻塞，未新增有效截图。
- 不把旧截图当成本轮视觉验收。

### 边界

- 步兵铁甲与骑兵铁甲现在都有结构化战斗掷骰回归。
- `火炮技术` 对炮兵建立/训练等级上限仍未接入。
- 不能据此宣称七大恨完整完成；后续主线仍是游戏本体规则补齐。

## 2026-06-02 07:00 +08 证据增补：火炮技术允许建立炮兵并训练到技术等级

### 本轮范围

- 按用户最新口径，地图连线/移动代价只保留粗可用，不再作为当前主阻塞。
- 本轮把大明已开发 `火炮技术` 接入炮兵建立/训练入口，不改战斗掷骰加成。

### 实现结论

- `QidahenRecruitChoice` 增加 `level-1-artillery`。
- `buildRecruitSelection()` 在当前势力拥有 `火炮技术` 时追加 `建立 1 个等级 1 炮兵`；无火炮技术时不追加。
- `RECRUIT_CHOICE_RESOLVED` 结算炮兵选择后：
  - 目标区总兵力 +1；
  - 写入结构化 `大明炮兵 x1（1级）`；
  - 摘要和日志写明 `火炮技术允许建立炮兵`。
- 轮盘 `征兵训练` 保留既有 `部队 +2`，同时若目标区已有炮兵且火炮技术等级更高，会把炮兵训练到当前技术等级上限。
- 火炮技术没有被接成战斗掷骰加成；炮兵仍沿用既有 `不能承伤 / 不计胜负` 规则。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts -t "火炮技术|征兵训练" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 --reporter verbose
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/types.ts src/games/qidahen/Board.tsx src/games/qidahen/__tests__/payment-selection.test.ts
```

- 结果：
  - 聚焦 `火炮技术|征兵训练` 用例：`7 passed`
  - 七大恨定向四文件：`228 passed`
  - `tsc`：通过
  - ESLint：`0 errors`，保留既有 `Board.tsx` React Compiler memo warning

### 关键断言

- `payment-selection.test.ts`
  - `没有火炮技术时征召军队不会出现炮兵选项`
  - `火炮技术允许征召军队建立等级 1 炮兵`
  - `轮盘征兵训练会按火炮技术等级训练已有炮兵`
  - `确认执行征召军队后会先进入建军方式选择`
- 断言锁住：
  - 剧本一大明默认有 `火炮技术1`，征召面板包含 `level-1-artillery`；
  - 移除大明火炮技术后，征召面板不包含 `level-1-artillery`；
  - 选择炮兵后，皮岛写入 `ming-recruit-regular-artillery-lv1 / 大明炮兵 / artillery / count 1 / level 1`。
  - 人工设为 `火炮技术2` 且皮岛已有 1 个 1 级炮兵时，轮盘 `征兵训练` 会把该炮兵训练成 `ming-recruit-regular-artillery-lv2 / level 2`，同时保留原有 `部队 +2`。

### E2E 与截图状态

- 本轮复用现有数据驱动征召面板，没有新增独立 UI 组件。
- 当前 E2E bootstrap OOM 仍是已知阻塞，未新增有效截图。
- 不把旧截图当成本轮视觉验收。

### 边界

- 本轮完成“有火炮技术可建立等级 1 炮兵”和“已有炮兵可训练到火炮技术等级”。
- 研发更多火炮技术、玩家手选训练目标/数量仍未接入。
- 不能据此宣称七大恨完整完成；后续主线仍是游戏本体规则补齐。

## 2026-06-02 07:45 +08 证据增补：升级军备低保真研发入口

### 本轮范围

- 按用户最新口径，地图连线/移动代价只保留粗可用，不再作为当前主阻塞。
- 本轮补规则书手牌行动 `升级军备` 的最小可玩入口，让已接入的火炮/铁甲效果能通过游戏流程继续提升。

### 实现结论

- 三势力行动目录均新增 `升级军备`。
- `升级军备` 花费为 2 张手牌，代表规则书中的“打出军备牌 + 弃 1 张手牌”。
- 当前低保真不做真实军备牌目标选择，先升级当前势力第一项已开发且未到上限的军备。
- 低保真上限先设为 2 级，不硬猜完整军备牌库：
  - 大明：`火炮技术1 -> 火炮技术2`；
  - 蒙古：`骑兵铁甲1 -> 骑兵铁甲2`；
  - 后金：`步兵铁甲1 -> 步兵铁甲2`。
- 升级后的等级复用既有规则入口：
  - `火炮技术2` 会让轮盘 `征兵训练` 把已有炮兵训练到 2 级；
  - `骑兵铁甲2` / `步兵铁甲2` 会继续通过结构化战斗掷骰加成入口生效。
- E2E 中手写的蒙古/后金行动目录夹具已同步增加 `升级军备`，避免测试注入旧三项目录。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts -t "升级军备|行动目录" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 --reporter verbose
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/__tests__/payment-selection.test.ts
npx eslint e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 聚焦 `升级军备|行动目录` 用例：`3 passed`
  - 七大恨四文件：`230 passed`
  - `tsc`：通过
  - 领域相关 ESLint：`0 errors`
  - E2E 文件 ESLint：`0 errors`，保留既有 `no-explicit-any` warnings

### 关键断言

- `payment-selection.test.ts`
  - `按当前阵营保留规则来源中的具体势力行动目录`
  - `升级军备需要按军备牌加弃牌支付 2 张手牌`
  - `升级军备会消耗 2 张手牌并提升当前势力已开发军备`
- 断言锁住：
  - 三势力行动目录都包含 `升级军备`；
  - 选择 `升级军备` 时支付提示为 `需弃 2 / 已选 0`；
  - 大明执行后 `火炮技术` 从 1 级变为 2 级；
  - 大明手牌从 3 变 1，弃牌堆从 7 变 9；
  - 摘要为 `升级军备`，行动日志显示 `大明 执行 升级军备，弃 2 张牌`。

### E2E 与截图状态

- 尝试运行最小 smoke：

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-basic-flow.e2e.ts --grep "桌面端显示真实地图并保持轮盘/手牌/牌堆布局" *> temp/qidahen-upgrade-armament-e2e-smoke-output.txt
```

- 结果：未产出有效 UI 验收截图。
- 失败信号：
  - `page.goto('/play/qidahen/tutorial')` 时 `net::ERR_CONNECTION_REFUSED`；
  - 随后托管 runtime OOM：`FATAL ERROR: Committing semi space failed`；
  - 完整输出已留在 `temp/qidahen-upgrade-armament-e2e-smoke-output.txt`；
  - Playwright 失败截图位于 `test-results/playwright-artifacts/.../test-failed-1.png`，但只证明页面未连上，不是本轮 UI 验收证据。
- 因此本轮不能声明 E2E 通过，也不能使用旧截图冒充本轮视觉验收。

### 边界

- 本轮只完成 `升级军备` 的最小研发入口。
- 尚未实现真实军备牌目标选择、完整军备牌库、更高等级上限。
- 七大恨仍未完整完成；后续主线仍是游戏本体规则补齐。

## 2026-06-02 07:55 +08 证据增补：升级军备上限门禁

### 本轮范围

- 按用户最新口径，地图连线/移动代价不再继续细抠，只保留粗可用与后续人工调整空间。
- 本轮只补 `升级军备` 低保真研发入口的防卡死/防空支付门禁。

### 实现结论

- `commands.ts` 增加 `hasUpgradableArmament()` 校验。
- 当前势力没有任何低于 2 级的军备时：
  - `EXECUTE_ACTION` 执行 `upgrade-armament` 返回 `noUpgradableArmament`；
  - `EXECUTE_SELECTED_ACTION` 在已选中 `升级军备` 且支付已满时同样返回 `noUpgradableArmament`。
- 这避免了玩家支付 2 张手牌后没有军备可升级、流程看似执行但实际无收益的死体验。

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts -t "升级军备" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 --reporter verbose
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false
npx eslint src/games/qidahen/domain/index.ts src/games/qidahen/domain/commands.ts src/games/qidahen/__tests__/payment-selection.test.ts
npx eslint e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 聚焦 `升级军备` 用例：`3 passed`
  - 七大恨定向四文件：`231 passed`
  - `tsc`：通过
  - 领域相关 ESLint：`0 errors`
  - E2E 文件 ESLint：`0 errors`，保留既有 `no-explicit-any` warnings

### 关键断言

- `payment-selection.test.ts`
  - `升级军备到低保真上限后会被校验拦截，避免白白弃牌`
- 断言锁住：
  - 大明 `火炮技术` 已为 2 级时，直接执行 `升级军备` 被拒绝；
  - 已选中 `升级军备` 且已选满 2 张支付牌时，执行也被拒绝；
  - 校验错误统一为 `noUpgradableArmament`；
  - 原核心状态里的手牌数、可支付手牌数、军备等级保持不变。

### 边界

- 本轮仍不是完整军备牌系统。
- 真实军备牌目标选择、完整军备牌库、更高等级上限仍未实现。
- 七大恨仍未完整完成；下一步继续补游戏本体可玩缺口。

## 2026-06-03 16:18 +08 证据增补：地图高置信区名回写

### 本轮范围

- 不再继续编辑边界线；直接把已经通过底图叠图与局部裁图确认的高置信区域名固化到运行时图谱数据。
- 本轮目标是降低后续七大恨规则实现继续依赖 `区域 N` 的成本，而不是宣称地图规则层已经全部正式化。

### 实现结论

- 已回写到 `region-graph.json` 与 `region-mask-regions.json` 的高置信区域名包括：
  - `外喀尔喀部 / 科尔沁部 / 乌喇部 / 辉发部 / 扎鲁特部 / 叶赫部 / 巴林部 / 哈达部 / 内喀尔喀部 / 长白 / 建州 / 察哈尔部 / 辽北 / 克什克腾部 / 奈曼部 / 敖汉部 / 土默特部 / 宣府 / 鄂尔多斯部 / 保定 / 顺天 / 山西 / 延绥 / 登莱 / 山东`
- 已新增结构化映射留档：
  - `src/games/qidahen/data/region-authoritative-guides.json`
- 已补图谱回归：
  - `src/games/qidahen/__tests__/mapGraph.test.ts`
  - 新增断言，锁住图谱节点名与 mask 区域名同步回写。

### 图面证据

- 本轮确认区名所依赖的叠图 / 裁图：
  - `temp/qidahen-region-node-labels.png`
  - `temp/qidahen-map-crop-top_center_clean.png`
  - `temp/qidahen-map-crop-center_left_clean.png`
  - `temp/qidahen-map-crop-center_right_clean.png`
  - `temp/qidahen-top-right-crop.png`
  - `temp/qidahen-r17-r19-crop.png`
  - `temp/qidahen-r15-jinzhou-clean-crop.png`
  - `temp/r24-precise-clean.png`
  - `temp/r28-precise-clean.png`

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 --reporter verbose
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
```

- 结果：
  - `mapGraph.test.ts`：`9 passed`
  - 七大恨定向四文件：`232 passed`
  - `tsc`：通过

### 本轮边界

- 本轮只固化了“地图区名真相”。
- 尚未把 `regionConfig.ts` 里的历史粗映射全部改成正式规则对应关系。
- 当前仍需继续核对的关键借位/合并风险：
  - `辽北 / 辽东`
  - `辽西 / 锦州 / 山海关 / 宁远`
  - `顺天 / 蓟镇 / 宣府`
- 因此本轮不能把“区名已回写”表述成“七大恨正式图谱已完成”或“游戏流程已因此全部跑通”。

## 2026-06-03 16:56 +08 规则逻辑区兼容层

### 变更范围

- `src/games/qidahen/domain/regionConfig.ts`
- `src/games/qidahen/domain/index.ts`
- `src/games/qidahen/__tests__/payment-selection.test.ts`

### 本轮落实

- 把现有逻辑区收敛到统一构造器，不再只零散保留 `shan-hai-guan / shou-cheng`。
- 新增逻辑区兼容层：
  - 旧规则借位名：`liao-xi / ning-yuan / ji-zhen`
  - 高置信图区名：`liao-bei / liao-dong / xuan-fu / shun-tian`
- `联姻诱降` 的辽西减免不再直接比较 `city-region-19`，而是走逻辑区等价判断：
  - `isQidahenRuleRegionEquivalent(targetRegion.id, 'liao-xi')`

### 自动化证据

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1 --reporter verbose
$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx tsc --noEmit --pretty false
```

- 结果：
  - `payment-selection.test.ts`：`105 passed`
  - 七大恨定向四文件：`234 passed`
  - `tsc`：通过

### 本轮结论

- 这一步已经把“规则逻辑区”正式从 runtime 区号中抽出一层，后续不必继续把所有规则语义直接绑死在 `city-region-*`。
- 但当前仍只是兼容层，不是正式规则图谱完成：
  - `city-region-19 / 24 / 28 / 22` 的旧借位玩法语义还没有全部迁出；
  - runtime 图面显示与逻辑区语义仍可能同时存在旧名/真名并行；
  - 因此本轮不能宣称“七大恨规则图谱已经全部收口”。

## 2026-06-04 01:02 +08 新年纪年卡归属最小正式链

### 变更范围

- `src/games/qidahen/domain/index.ts`
- `src/games/qidahen/__tests__/payment-selection.test.ts`

### 本轮落实

- 在 `resolveNewYear()` 中新增“本年纪年卡归属”结算：
  - 先按当前**有效威望**比较资格；
  - 若同分，则按**当年顺位较后**者优先；
  - 获得资格者支付当前手牌一半（向上取整），获得本年纪年卡并 `VP +1`；
  - 若无人可支付，则记为“本年纪年卡无人获得”。
- 该实现明确复用了现有 `getQidahenEffectiveVpByFaction()`，因此区域额外威望也会参与新年纪年卡资格排序。
- 当前仍刻意维持最小边界，没有硬编不存在的年卡细表：
  - **未实现** 年卡逐张文本条件；
  - **未实现** 由新年纪年卡决定行动顺位；
  - **未实现** 依纪年卡内容正式打出人物牌。

### 自动化证据

```powershell
npx vitest run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/Board.test.ts
npx tsc --noEmit --pretty false
node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨定向四文件：`240 passed`
  - `tsc`：通过
  - 基础 E2E：`24/24 passed`

### 本轮边界

- 这次只把“新年纪年卡归属 / 支付 / VP”接进正式结算链。
- 不能把这一步表述成“纪年卡系统完成”或“七大恨已完整可玩”，因为以下缺口仍在：
  - 围城耗损还没有以明确围城状态进入新年耗损链；
  - 纪年卡逐张条件与新年顺位还没有正式数据化；
  - 人物牌仍未按纪年卡条件完整出场。

## 2026-06-04 01:24 +08 围城状态与围城耗损最小正式链

### 变更范围

- `src/games/qidahen/domain/types.ts`
- `src/games/qidahen/domain/index.ts`
- `src/games/qidahen/__tests__/payment-selection.test.ts`
- `e2e/qidahen-basic-flow.e2e.ts`

### 本轮落实

- 新增区域级 `siegeState`，使“围城”第一次成为可持续结算的正式状态，而不是只存在于规则文本。
- 城市战后处理新增 `围城该区` 分支：
  - 攻方不改控制权；
  - 围城兵力留在目标区外围；
  - 守方继续控制该区。
- 年中土地税赋已接入围城判断：
  - 被围城的控制区域不再获得土地税赋。
- 新年耗损已接入围城判断：
  - 围城区域不再按守方普通人口补给结算攻方；
  - 围城攻方单独按 `围城耗损` 支付/减员。

### 自动化证据

```powershell
npx vitest run src/games/qidahen/__tests__/payment-selection.test.ts src/games/qidahen/__tests__/movementRules.test.ts src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts
npx tsc --noEmit --pretty false
node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-basic-flow.e2e.ts
```

- 结果：
  - 七大恨定向四文件：`243 passed`
  - `tsc`：通过
  - 基础 E2E：`25/25 passed`

### 视觉证据

- 新增真实 Board 围城流程截图：
  - `temp/qidahen-board-post-battle-besiege-current.png`

### 本轮边界

- 当前只证明了“围城状态可进入、可显示、可在年中/新年被正式结算读取”。
- 尚未完成以下围城扩展语义：
  - 围城状态下的完整行动限制；
  - 水路仅在围城时启用；
  - 守城避战与城内 2 人口单独建模；
  - 围城状态下更细的人口区分（城内/城外）。
- 因此，本轮不能表述成“七大恨城市/围城系统已完整实现”，只能表述成“围城已进入最小正式规则链”。
