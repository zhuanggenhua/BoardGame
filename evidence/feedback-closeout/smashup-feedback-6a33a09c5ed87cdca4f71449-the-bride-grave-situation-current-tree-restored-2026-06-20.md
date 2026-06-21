# SmashUp 线上反馈 6a33a09c5ed87cdca4f71449 当前树核对

- 时间：2026-06-20
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-20T10-02-27-163Z/6a33a09c5ed87cdca4f71449.md`
- 反馈含义：大杀四方里，“新娘（The Bride）”在起始阶段消灭己方随从时，如果同时命中“身体改造（frankenstein_grave_situation）”的回手替代，服务端报 `buildValidatedReturnEvents is not defined`。

## 本轮结论

- 归类：当前树已恢复
- 现实含义：按真实反馈链路在当前代码复跑，已经能正常把被消灭随从改为回手，没有再出现该异常。

## 验证场景

- The Bride 在回合开始进入第一个效果选择
- 选择“消灭”
- 目标选中同基地、受“身体改造”影响的己方随从
- 预期：不直接消灭离场，而是改为回手

## 验证

- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/frankenstein.test.ts --configLoader native --maxWorkers 1 -t "线上反馈 6a33a09c5ed87cdca4f71449"`
- 结果：
  - 通过
  - 事件里出现 `MINION_RETURNED`
  - 目标随从回到玩家手牌

## 对应回归

- `src/games/smashup/__tests__/abilities/frankenstein.test.ts`
- 用例名：`线上反馈 6a33a09c5ed87cdca4f71449：The Bride 在起始阶段消灭己方随从并命中身体改造时，应改为回手而不是抛 helper 未定义异常`

## 说明

- 本轮没有再为这条反馈改业务逻辑代码。
- 结论是：当前代码按真实症状链路验证通过，这条更像线上旧状态未回写或旧部署现场遗留，不是当前树仍在复现的现存 bug。
