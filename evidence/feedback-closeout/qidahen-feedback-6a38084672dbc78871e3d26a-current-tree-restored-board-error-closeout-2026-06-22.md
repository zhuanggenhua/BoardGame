# 七大恨线上反馈 6a38084672dbc78871e3d26a 收口记录

- 时间：2026-06-22
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-21T16-42-37-782Z/6a38084672dbc78871e3d26a.md`
- 反馈含义：七大恨棋盘页在 `/play/qidahen/match/abogeMQTXRz?playerID=0` 报 `ReferenceError: setPreferredPrimaryStage is not defined`，页面进入错误边界。

## 本轮结论

- 归类：当前树已恢复
- 使用的真实证据：
  - 反馈堆栈指向的是 `http://localhost/assets/Board-DSHAV27y.js`，是打包后的旧资产文件，不是当前源码文件
  - 当前源码全文检索 `setPreferredPrimaryStage / preferredPrimaryStage / PrimaryStage`，没有找到 `setPreferredPrimaryStage` 这个符号
  - 当前代码里与这条链路相关的是 `src/games/qidahen/Board.tsx` 的 `primaryStageMode` / `buildQidahenPrimaryStageHeadline` / `buildQidahenPrimaryStageHint`
  - `src/games/qidahen/__tests__/Board.test.ts` 通过，说明当前树的棋盘实现并没有再触发这条 ReferenceError
- 判断说明：
  - 这条反馈更像旧 bundle / 旧资产现场上的错误，而不是当前源码里仍然存在的未修 bug。
  - 因为当前源码里已经没有这个符号，所以本轮不应继续围着 `setPreferredPrimaryStage` 改代码。

## 验证

- 命令：
  - `rg -n "setPreferredPrimaryStage|preferredPrimaryStage|PrimaryStage" src docs test e2e`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts --configLoader native --maxWorkers 1`
- 结果：
  - 当前源码搜索未命中 `setPreferredPrimaryStage`
  - `Board.test.ts`：`174 passed`

## 收口说明

- 该反馈本体在当前树下没有可继续修复的源码命中点，属于“当前树已恢复/已失效”的收口。
- 本轮只做了证据核对和状态收口，没有新增 qidahen 代码改动。
