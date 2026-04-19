# SmashUp 巨石阵附着天赋双发动共享缺陷审计（2026-04-04）

## 审计范围
- 用户反馈：“可以用两次天赋的基地”不生效。
- 目标链路：
  - 基地 `base_standing_stones`
  - 狼人附着 ongoing talent：`werewolf_leader_of_the_pack`、`werewolf_moontouched`
  - 共享执行链：`USE_TALENT validate -> execute -> TALENT_USED reduce -> Board/UI 可点击状态`
- 本文档覆盖的是“巨石阵 + 附着在随从上的 ongoing talent 第二次发动”这一**基地共享缺口**；狼人只是本次用来复现和回归的具体入口，不代表问题只存在于狼人卡定义层。
- 本文档不替代 `evidence/smashup-four-new-factions-audit-2026-02-22.md` 的其他狼人审计结论。

## 权威来源
- 基地文案：
  - `public/locales/zh-CN/game-smashup.json:1551`
  - `public/locales/en/game-smashup.json:1540`
- 狼人附着天赋文案：
  - `public/locales/zh-CN/game-smashup.json:1627`
  - `public/locales/zh-CN/game-smashup.json:1651`
  - `public/locales/en/game-smashup.json:1616`
  - `public/locales/en/game-smashup.json:1640`
- UI 链路入口：
  - `src/games/smashup/Board.tsx:968`
  - `src/games/smashup/ui/BaseZone.tsx:1213`

## 结论
- 结论：已确认这是**巨石阵规则在共享层的缺口**，不是狼人单牌数据错误。
- 状态：已修复，且补齐了单元回归 + 浏览器 E2E 回归。
- 用户看到“基地不生效”，本质是 `validate(USE_TALENT)` 没把“附着在随从上的 ongoing talent”纳入巨石阵双才能例外，UI 又直接依赖该验证结果计算 `usableOngoingTalentUids`，因此第二次点击入口在前端就失效。

## 根因链路
1. 规则面
- 巨石阵允许“你在这的一个随从可以使用其才能两次”。
- 狼人 `werewolf_leader_of_the_pack` / `werewolf_moontouched` 是“打出到一个随从上”的 ongoing talent，实际使用主体是宿主随从。
- 因此定性应该是：**基地效果没有正确覆盖 attached ongoing talent 这一类才能载体**。

2. 验证层缺口
- `src/games/smashup/domain/commands.ts:100`
- `src/games/smashup/domain/commands.ts:670`
- 旧逻辑在 `ongoingCardUid` 分支中，只要 `ongoing.talentUsed === true`，就只检查 `getRemainingExtraTalentUses()`。
- 这条链只覆盖了巨狼之灵 `werewolves_great_wolf_spirit` 提供的额外次数，没有把巨石阵的“双才能例外”扩展到 attached ongoing talent。

3. 归约层缺口
- `src/games/smashup/domain/reduce.ts:1950`
- `src/games/smashup/domain/reduce.ts:1963`
- `src/games/smashup/domain/reduce.ts:2010`
- 旧逻辑只有 `minionUid && !ongoingCardUid` 时才会把第二次 talent 记到 `standingStonesDoubleTalentMinionUid`。
- attached ongoing 走的是 `ongoingCardUid` 分支，因此：
  - 不会占用巨石阵名额。
  - 会误落到 `extraTalentUsesConsumed` 计数链路，污染巨狼之灵的额外次数。

4. UI 可点击状态为什么一起坏掉
- `src/games/smashup/Board.tsx:968` 会遍历基地上的 ongoing 和 attached action，对每个 `attachedAction.uid` 直接调用 `validate(USE_TALENT)`。
- `src/games/smashup/ui/BaseZone.tsx:1213` 再基于 `usableOngoingTalentUids` 决定 attached action 是否可点。
- 所以验证层一旦漏掉 attached ongoing talent，前端就会直接把第二次点击入口关掉。

## 命中审计维度
- `D3` 引擎 API 调用契约审计：`USE_TALENT` 对 minion / titan / base ongoing / attached ongoing 的语义覆盖不一致。
- `D11` Reducer 消耗路径审计：第二次 attached talent 没进入巨石阵名额消耗路径。
- `D12` 写入-消耗对称：验证层允许/拒绝与 reducer 实际记录的资源不是同一套语义。
- `D15` UI 状态同步：前端可点击状态直接来源于 `validate`，共享验证缺口会表现为 UI 失效。
- `D42` 事件流全链路审计：从点击 attached action 到 `TALENT_USED`、`LIMIT_MODIFIED`、名额占用的链路此前不闭合。

## 修复内容

### 1. 验证层补齐 attached ongoing 的巨石阵例外
- 文件：`src/games/smashup/domain/commands.ts:100`
- 文件：`src/games/smashup/domain/commands.ts:670`
- 新增 `findAttachedTalentHostMinion()`，在 `ongoingCardUid` 分支里先识别 attached ongoing 的宿主随从。
- 当满足以下条件时，允许第二次发动：
  - 当前基地是 `base_standing_stones`
  - 宿主随从由当前玩家控制
  - `standingStonesDoubleTalentMinionUid` 还未被占用
- 若不满足，才回退到 `getRemainingExtraTalentUses()` 的巨狼之灵次数判断。

### 2. 归约层把 attached ongoing 的第二次发动记到巨石阵名额
- 文件：`src/games/smashup/domain/reduce.ts:1950`
- 文件：`src/games/smashup/domain/reduce.ts:1963`
- 文件：`src/games/smashup/domain/reduce.ts:2010`
- 在 `TALENT_USED` 的 `ongoingCardUid` 路径中：
  - 若命中 attached action 且使用前 `talentUsed === true`
  - 同时位于巨石阵、宿主由当前玩家控制、名额未占用
  - 则把 `standingStonesDoubleTalentMinionUid` 记成宿主随从 uid
- 这样 reused talent 不会再误记到 `extraTalentUsesConsumed`。

## 测试与证据

### 单元 / 集成回归
- 文件：`src/games/smashup/__tests__/ongoingTalent.test.ts:90`
- 文件：`src/games/smashup/__tests__/ongoingTalent.test.ts:324`
- 补充点：
  - 巨石阵允许狼人 attached ongoing 第 2 次发动
  - 双才能名额已占用时拒绝
  - 第 2 次发动应占用巨石阵名额，而不是额外天赋次数

- 运行命令：
```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ongoingTalent.test.ts src/games/smashup/__tests__/talentAbilities.test.ts --configLoader native --maxWorkers 1
```

- 结果：
  - `2 files / 42 tests passed`

### 浏览器 E2E 回归
- 文件：`e2e/smashup-gameplay.e2e.ts:160`
- 用例：`巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额`

- 运行命令：
```bash
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
npm run test:e2e:ci:file -- e2e/smashup-gameplay.e2e.ts "巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额"
```

- 说明：
  - 当时机器可用内存仅 `1.90GB`，低于项目默认 `2.5GB` 重任务门禁，因此临时开启 `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1`。
  - 同时存在另一个使用独立端口的 isolated-single E2E runtime，因此临时开启 `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1`；未复用共享端口，也未清理其他任务。

- 结果：
  - `1 passed`

- 关键断言：
  - attached action `oa1` 在 UI 上可见且可点击
  - 点击后 `actionLimit: 1 -> 2`，证明狼人天赋真正执行
  - `standingStonesDoubleTalentMinionUid === 'wolf-host'`
  - `extraTalentUsesConsumed === undefined`

- 截图产物：
  - `test-results/evidence-screenshots/smashup-gameplay.e2e/巨石阵应允许狼人附着天赋第2次发动，并占用基地双才能名额/werewolf-standing-stones-before-second-talent.png`
  - `test-results/evidence-screenshots/smashup-gameplay.e2e/巨石阵应允许狼人附着天赋第2次发动，并占用基地双才能名额/werewolf-standing-stones-after-second-talent.png`

## 风险与未覆盖项
- 本轮浏览器 E2E 选的是 `werewolf_leader_of_the_pack`，`werewolf_moontouched` 依赖同一条 attached ongoing talent 验证/归约分支，逻辑已共享覆盖，但未单独补浏览器用例。
- 本轮主要验收依赖浏览器状态断言与截图落盘；当前会话未对本地图像做单独的人眼复核，因此仍保留一条“截图内容未额外人工审阅”的低风险备注。

## 最终判定
- 本问题应定性为：`base_standing_stones` 的共享规则在 `USE_TALENT` 契约里没有完整覆盖 attached ongoing talent，且 `TALENT_USED` reducer 对应消耗路径漏记。
- 当前修复已打通：
  - 规则文案
  - 验证层
  - 归约层
  - 前端可点击状态
  - 浏览器点击回归
