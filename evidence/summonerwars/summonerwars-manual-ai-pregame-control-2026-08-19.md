# Summoner Wars 手动代 AI 赛前选择控制记录

## 基本信息

- 对象：创建房间“替 AI 做赛前选择/准备”开关在 Summoner Wars 的在线桥接与本地热座链路。
- 日期：2026-08-19
- 文档类型：closeout
- 关联入口：`src/pages/onlineManualSetupSelectionBridge.tsx`、`src/pages/matchManualSetup.ts`、`src/engine/transport/followCurrentTurnPlayer.ts`。

## 审计范围

- 本轮覆盖：Summoner Wars 赛前选阵营、AI 座位准备、本地热座操作者接管；同时覆盖通用在线桥接对 `setup-select-faction` / `setup-select-character` 的暂存行为。
- 共享重构范围：把“标准赛前选择状态”的本地代控解析下沉到传输层默认能力，覆盖 `hostStarted=false`、`selectedFactions` / `selectedCharacters`、`readyPlayers`、`hostPlayerId` 这类通用状态。
- 明确不覆盖：Summoner Wars 正式开局后的战斗 AI 策略、在线端到端真实房间 E2E、Smash Up 旧 `select-faction` 蛇形选秀立即提交流程、Dice Throne 现有无勾选也人工选择 AI 角色的本地特化流程。

## 结论等级

- 结论：功能实现已验证。
- 判定理由：Summoner Wars 不再注册单游戏本地赛前代控 resolver；本地局通过 `resolveDefaultLocalPregameControlledPlayerId` 共享默认能力接管已勾选的 AI 座位。在线桥接继续保持“先保留草稿，点准备才提交选择意图”，领域校验仍要求 AI 已选阵营后才能准备，所有非房主已准备后房主才能开始。

## 原始症状与分层

- 现实故障现象：用户勾选“替 AI 做赛前选择/准备”后，Summoner Wars 本地没有接管 AI 选阵营；在线选完 AI 阵营后也不是先走准备流程。
- 直接触发条件：在线桥接曾把 `setup-select-faction` / `setup-select-character` 当作立即提交动作；本地热座只有游戏自定义 resolver，没有共享默认解析标准赛前状态。
- 修复动作：在线选择先进入草稿，点击准备才提交选择意图；本地共享默认先接管未选的手动 AI，再接管已选但未准备的手动 AI，全部手动 AI 准备后回到房主/本地真人。
- 机制说明：底层开关 `manualSetupSelection` / 旧别名 `manualFactionSelection` 现在由共享本地代控解析器消费；标准游戏不需要再逐个补一份。只有真实流程不同的游戏继续保留 override，例如 Smash Up 的蛇形选秀和 Dice Throne 的既有本地选角流程。

## 实现消费

| 对象 | 断言 | 实现消费点 | 验证证据 | 结论 |
| --- | --- | --- | --- | --- |
| 在线桥接 | staged 赛前选择先只更新草稿，准备按钮才提交选择意图 | `src/pages/onlineManualSetupSelectionBridge.tsx` | `src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx` | 通过 |
| 共享本地接管默认 | 手动 AI 未选阵营/角色或未准备时由本地页面代该 AI 座位执行 | `src/engine/transport/followCurrentTurnPlayer.ts` | `src/engine/transport/__tests__/followCurrentTurnPlayer.test.ts` | 通过 |
| Summoner Wars 接入方式 | Summoner Wars 走共享默认，不再保留单游戏 resolver | `src/games/summonerwars/game.ts` | `rg` 未命中 Summoner Wars 私有 resolver 引用 | 通过 |
| 特化边界 | 有游戏特化 resolver 时完全优先；非标准赛前状态不会被共享默认误接管 | `src/engine/transport/followCurrentTurnPlayer.ts`、`src/games/smashup/localPregameControl.ts`、`src/games/dicethrone/localPregameControl.ts` | `src/engine/transport/__tests__/followCurrentTurnPlayer.test.ts`、Dice Throne 本地 setup 代表测试 | 通过 |
| 领域准备规则 | AI 必须先选阵营才能准备；房主必须等待非房主已选并准备后才能开始 | `src/games/summonerwars/domain/validate.ts` | `src/games/summonerwars/__tests__/validate.test.ts` | 通过 |

## AI-only 门禁

- 只接管开启 `manualSetupSelection` / `manualFactionSelection` 的非真人座位。
- 本地 AI 自动执行在 `localPregameControlledPlayerId` 存在时暂停，避免玩家代控时 AI 抢先提交。
- 共享默认只识别标准赛前状态字段：`hostStarted=false` 加 `selectedFactions` 或 `selectedCharacters`；没有这些字段的游戏不会被误接管。
- 在线服务端 `manual-setup-selection` 只接受房主对已勾选 AI 座位的赛前选择意图，不接受真人目标座位或非赛前动作。

## 验证证据

- `npx vitest run src/engine/transport/__tests__/followCurrentTurnPlayer.test.ts --configLoader native`：8 tests passed。
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "本地 AI setup 视角切换" --configLoader native`：1 test passed，149 skipped。
- `npx vitest run src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx src/pages/__tests__/matchManualSetup.test.ts --configLoader native`：10 tests passed。
- `npx vitest run src/games/summonerwars/__tests__/validate.test.ts src/games/summonerwars/__tests__/flow.test.ts --configLoader native`：128 tests passed。
- `npx vitest run src/engine/ai/__tests__/manualFactionSelection.test.ts --configLoader native`：10 tests passed。
- `npx vitest run src/engine/transport/__tests__/server.test.ts -t "manual setup|人工准备|手动代选|manual-setup-selection|manualSetupSelection" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：2 tests passed，279 skipped。
- `npx eslint src/engine/transport/followCurrentTurnPlayer.ts src/engine/transport/__tests__/followCurrentTurnPlayer.test.ts src/games/summonerwars/game.ts src/pages/onlineManualSetupSelectionBridge.tsx src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx`：passed。
- `npm run typecheck`：passed。

## 证据边界

- 本轮没有跑真实浏览器房间 E2E，因此不宣称已覆盖线上真实房间 UI 全链路截图。
- 本轮没有改变 Smash Up `select-faction` 立即提交语义；对应组件测试保留了旧流程断言。
- 本轮保留 Dice Throne 本地 setup override，因为它当前还保护“未勾选时也先让房主人工走选角”的既有流程；这不是标准手动赛前选择默认能力的一部分。
