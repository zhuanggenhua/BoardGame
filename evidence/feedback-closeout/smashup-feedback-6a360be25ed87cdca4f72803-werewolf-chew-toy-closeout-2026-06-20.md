# SmashUp 线上反馈 6a360be25ed87cdca4f72803 修复记录

- 时间：2026-06-20
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-20T10-02-27-163Z/6a360be25ed87cdca4f72803.md`
- 反馈含义：大杀四方里，玩家在处理“咬咬玩具（werewolf_chew_toy）”第二步目标选择时，服务端直接报错，导致交互无法继续。

## 命中症状

- 真实反馈报错：`SYS_INTERACTION_RESPOND pipeline_error: context is not defined`
- 真实链路：先选己方随从，再选要消灭的目标随从。

## 根因

- 文件：`src/games/smashup/abilities/werewolves.ts`
- 现实含义：第二步“选目标并执行消灭”的回调里，代码要读取“上一轮选择留下的上下文”，但函数签名没有接住这份上下文，运行时直接引用了未定义变量 `context`。

## 修复

- 给 `werewolfChewToyPromptProgram` 的 `onResolve` 显式补回 `context` 参数。
- 新增定向回归，强制走“先选来源、再选目标”的两步路径。

## 验证

- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/werewolves.test.ts --configLoader native --maxWorkers 1 -t "线上反馈 6a360be25ed87cdca4f72803"`
- 结果：
  - 通过，确认不会再抛 `context is not defined`
  - 目标随从正常进入 `MINION_DESTROYED` 结算

## 对应回归

- `src/games/smashup/__tests__/abilities/werewolves.test.ts`
- 用例名：`线上反馈 6a360be25ed87cdca4f72803：werewolf_chew_toy 选择来源后继续选择目标时不应抛出 context is not defined`
