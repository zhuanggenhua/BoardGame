# SmashUp 线上反馈 6a3789c672dbc78871e3cf0f 收口记录

- 时间：2026-06-22
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-21T16-42-37-782Z/6a3789c672dbc78871e3cf0f.md`
- 重复反馈：`6a37708672dbc78871e3ce9b`
- 反馈含义：大杀四方在 `vikings_ransack` 响应附着行动选择时，服务端处理 `SYS_INTERACTION_RESPOND` 报 `state is not defined`。

## 本轮结论

- 归类：当前树已恢复
- 使用的真实证据：
  - 真实反馈快照里，当前交互就是 `vikings_ransack` 的附着行动选择
  - 真实报错文案是 `pipeline_error: state is not defined`
  - 当前源码 `src/games/smashup/abilities/vikings.ts:585` 的 `onResolve` 已明确补回 `state`
- 关联已修链路：
  - 同根因反馈 `6a36cbe60bd730b192833d8e` 的修复证据已记录在 `evidence/feedback-closeout/smashup-feedback-6a36cbe60bd730b192833d8e-vikings-ransack-closeout-2026-06-21.md`
  - 本条与其错误签名、能力来源和失败位点一致，都是 `vikings_ransack` 选择附着行动时，回调里调用 `buildValidatedOngoingDetachEvents(state, ...)` 却缺少 `state` 参数
- 当前树判断：
  - 本轮没有再新增 SmashUp 代码修改。
  - 当前代码已经包含该修复，且定向回归测试通过，说明这条反馈在当前树下属于“已被既有修复覆盖”，不是仍需继续改实现的现存 bug。

## 验证

- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/vikings.test.ts --configLoader native --maxWorkers 1 -t "6a36cbe60bd730b192833d8e|vikings_ransack 选择附着行动时不应抛出 state is not defined"`
- 结果：
  - `1 passed`
- 现象结论：
  - `vikings_ransack` 现在可以正常处理附着行动选择，不再在 `SYS_INTERACTION_RESPOND` 阶段抛出 `state is not defined`。

## 收口说明

- 这组反馈对应的现象已经被当前代码直接覆盖，因此本轮按“当前树已恢复”收口。
- 这不是“本轮重新复现后又修了一次”；本轮做的是基于真实反馈重新核对当前树、补新 evidence，并把仍停留在未收口队列里的代表项与重复项正式关闭。
