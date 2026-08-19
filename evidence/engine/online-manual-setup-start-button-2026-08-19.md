# 在线手动 AI 准备开始按钮修复证据

## 1. 基本信息

- 对象：在线房间开局手动代 AI 选择派系 / 角色时，真人房主页面的开始游戏入口。
- 日期：2026-08-19
- 作者：Codex
- 文档类型：`closeout`
- 用户原始症状：`连开始游戏按钮都没有`；并追问 DiceThrone 是否也按同一通用系统处理。

## 2. 原始症状保真

- 用户反馈的现实问题不是“开始按钮灰掉”，而是房主页面里开始游戏按钮类控件被拿掉。
- 命中的当前证据：旧 `OnlineManualSetupSelectionBridge` 在存在待手动选择的 AI 座位时，把页面 `playerId` 覆盖为 AI 座位。
- 现实后果：SummonerWars 的 `sw-faction-start` 和 DiceThrone 的开始游戏按钮都依赖“当前页面玩家是否是房主”；页面身份被改成 AI 后，房主控件自然不渲染。

## 3. 根因分层

- 现实故障现象：房主正常在开局选择页操作时，看不到开始游戏按钮。
- 直接触发条件：通用桥接层把当前页面玩家从真人房主改成待代选的 AI 座位。
- 止血 / 恢复动作：取消页面身份覆盖，保留真人房主身份；只拦截选择命令，把它转成服务端手动 AI 准备请求。
- 根本机制：旧实现把两个职责混成一个字段：`当前页面真人身份` 和 `本次被代选的 AI 目标座位`。替 AI 选择应只改变命令目标，不应改变整张页面的房主身份。

## 4. 修复覆盖

| 对象 | 实现入口 | 结论 |
| --- | --- | --- |
| 通用桥接层 | `src/pages/onlineManualSetupSelectionBridge.tsx` | 不再覆盖 `playerId`；保留房主身份和房主控件 |
| SummonerWars 手动 AI 选派系 | `src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx` | 房主控件保持可见；点击派系立即请求目标 AI 座位选择 |
| DiceThrone 手动 AI 选角色 | `src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx` | 同一通用桥接路径覆盖；点击角色立即请求目标 AI 座位选择 |
| 多 AI 连续代选 | `src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx` | 第一个 AI 被 shared state 确认后，第二个 AI 的第一次点击不被吞，且房主身份仍保持 |
| 未勾选手动代选 | `src/components/lobby/__tests__/CreateRoomModal.test.tsx` / `src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx` / `src/engine/transport/__tests__/server.test.ts` | 建房默认不写手动代选标记；页面桥不拦截真人选择；服务端拒绝未开启手动代选的 AI 目标座位 |
| 玩家撞到 AI 已选项 | `src/games/dicethrone/domain/commandValidation.ts` / `src/games/dicethrone/domain/reducer.ts` | DiceThrone 与 SummonerWars 对齐：真人选择 AI 已选角色时释放 AI 的旧选择和准备状态，让 AI 后续重新选择 |

## 5. 验证证据

- 红测首跑：`node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx --configLoader native`
  - 结果：2 个失败。
  - 失败形状：测试期待房主身份 `0`，实际为 AI 座位 `1`。
- 修复后同文件：`node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx --configLoader native`
  - 结果：1 个测试文件通过，5 个用例通过。
- 未勾选负向门禁：`node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx src/components/lobby/__tests__/CreateRoomModal.test.tsx src/engine/transport/__tests__/server.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "未勾选|未开启手动代选|玩家选择 AI 已选角色|开启 AI 后默认使用普通难度" --configLoader native`
  - 结果：4 个测试文件通过，4 个目标用例通过。
  - 断言：普通 AI 房未勾选时不请求 `manual-setup-selection`；服务端即使收到手动代选请求也拒绝未开启手动代选的 AI 座位。
- DiceThrone 红测首跑：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "玩家选择 AI 已选角色" --configLoader native`
  - 首次业务失败：`SELECT_CHARACTER` 被验证层拒绝为 `character_already_taken`。
  - 修复后结果：1 个测试文件通过，目标用例通过；玩家角色写入，AI 角色回到 `unselected`，AI 准备状态回到 `false`。
- 相关完整单测：`node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx src/components/lobby/__tests__/CreateRoomModal.test.tsx src/engine/ai/__tests__/manualFactionSelection.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native`
  - 结果：4 个测试文件通过，178 个用例通过。
- 服务端手动代选门禁：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "房主只能请求服务端执行当前权威的 AI 准备选择|非房主不能请求服务端替 AI 执行准备选择|未开启手动代选|服务端拒绝不属于人工准备选择" --configLoader native`
  - 结果：1 个测试文件通过，4 个目标用例通过。
- SummonerWars 对照：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/reduce.test.ts src/engine/transport/__tests__/localDispatchExecution.test.ts -t "FACTION_SELECTED 释放|接管 AI 已选派系|玩家接管 AI 已选派系" --configLoader native`
  - 结果：2 个测试文件通过，2 个目标用例通过。
- 代表性回归：`node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx src/engine/ai/__tests__/manualFactionSelection.test.ts src/games/summonerwars/__tests__/validate.test.ts src/games/summonerwars/__tests__/reduce.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`
  - 结果：5 个测试文件通过，158 个用例通过。
- 服务端手动准备 / 进展标记回归：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "buildAiProgressMarker|manual setup|manual-setup|房主只能请求服务端执行当前权威的 AI 准备选择" --configLoader native`
  - 结果：1 个测试文件通过，6 个目标用例通过。
- 静态检查：`npx eslint src/pages/onlineManualSetupSelectionBridge.tsx src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/server.test.ts`
  - 结果：通过。
- 本轮静态检查：`npx eslint src/pages/onlineManualSetupSelectionBridge.tsx src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx src/components/lobby/CreateRoomModal.tsx src/components/lobby/__tests__/CreateRoomModal.test.tsx src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts src/games/dicethrone/domain/commandValidation.ts src/games/dicethrone/domain/reducer.ts src/games/dicethrone/domain/utils.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
  - 结果：0 个错误；保留既有 lint 警告（CreateRoomModal effect 写法、fast-refresh 导出警告、DiceThrone reducer 既有未用变量）。
- 类型检查：`npm run typecheck -- --pretty false`
  - 结果：通过。

## 6. DiceThrone 覆盖口径

- DiceThrone 已接入通用 `CharacterSelectionSystem`、`manualSetupSelection` 座位配置和 `onlineAiRecovery.resolveManualSetupSelectionTakeoverPlayerId`。
- 本轮不是给 SummonerWars 私有补丁，而是在 `OnlineManualSetupSelectionBridge` 里修通用身份 / 目标座位分离。
- DiceThrone 覆盖用例断言：真人房主身份保持为 `0`，房主开始控件保持可见，点击角色后发送 `setup-select-character` 到目标 AI 座位。
- DiceThrone 角色冲突现在也按通用语义处理：如果真人选中 AI 已选角色，只释放 AI；如果其它真人已选该角色，仍按重复角色拒绝。

## 7. 最新用户质疑：未勾选也触发？

- 用户原话：`“正在替 AI 选派系/角色”的目标座位  不是吧，我没有勾选未ai选择派系也触发？`
- 现实断言：未勾选“玩家选择 AI 派系 / 角色”时，普通 AI 房不应进入“正在替 AI 选”的手动代选路径。
- 当前证据：
  - 建房默认：开启 AI 后提交的 AI 座位不含 `manualSetupSelection` / `manualFactionSelection`。
  - 页面桥：未带手动代选标记的 AI 座位不会被 `OnlineManualSetupSelectionBridge` 接管；点击派系仍走真人页面自己的 dispatch，不请求服务端替 AI 选择。
  - 服务端：即使客户端发了手动代选请求，只要目标 AI 座位没有手动代选标记，也会拒绝，不执行 AI 选择命令。
- 结论口径：当前代码链路没有放开“未勾选也触发”。如果真实房间现场仍看到“正在替 AI 选”，下一步必须看该房间创建时的 `setupData.seatControllers` 是否已经带了手动代选标记，不能把它归因为玩家误点或缓存。

## 8. 残余范围

- 未做真实浏览器在线房间 E2E / 截图验收；本轮证据是桥接层、AI 手动选择、SummonerWars / DiceThrone 代表性状态测试和服务端目标用例。
- 扩展回归时曾运行 `src/pages/__tests__/matchSeatValidation.test.ts`，其中 `DiceThrone 右侧奖励骰普通确认应允许在线 AI 基于共享状态收口` 失败；失败原因是该测试构造里的玩家 1 没有角色，报错为“奖励骰缺少掷骰者角色”。这不是本轮开始按钮缺失链路，未作为本轮修复范围收口。
