# SmashUp 线上反馈 6a36cbe60bd730b192833d8e 修复记录

- 时间：2026-06-21
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-20T23-48-02-475Z/6a36cbe60bd730b192833d8e.md`
- 反馈含义：大杀四方在 `vikings_ransack` 选择附着行动后，服务端处理玩家响应时报 `state is not defined`，导致交互命令失败。

## 本轮结论

- 归类：已用真实反馈状态快照定位并修复
- 根因：`src/games/smashup/abilities/vikings.ts` 的 `vikings_ransack` 响应回调只解构了 `context/value/timestamp`，却在拆附着行动时调用 `buildValidatedOngoingDetachEvents(state, ...)`，运行时直接命中未定义变量 `state`。
- 解决方式：给 `vikings_ransack` 的 `onResolve` 补回 `state` 参数，并新增一条只覆盖“选中附着行动”链路的回归测试。

## 代码落点

- `src/games/smashup/abilities/vikings.ts`
- `src/games/smashup/__tests__/abilities/vikings.test.ts`

## 验证

- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/vikings.test.ts --configLoader native --maxWorkers 1 -t "6a36cbe60bd730b192833d8e"`
- 结果：
  - 通过
- 现象结论：
  - `vikings_ransack` 现在可以正常拿走敌方随从上的附着行动，不再在响应阶段抛出 `state is not defined`。

## 收口说明

- 该反馈本体已被当前代码直接覆盖，属于真实 bug 修复，不是只补通用防线。
