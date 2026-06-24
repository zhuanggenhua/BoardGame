# SmashUp 线上反馈 6a393e63ed8f4043405dc03b 修复记录

- 时间：2026-06-23
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-23T12-07-33-970Z/6a393e63ed8f4043405dc03b.md`
- 反馈含义：SmashUp 里翻开《墓穴陷阱》后，玩家响应目标选择时，服务端直接报错，交互无法继续。

## 命中症状

- 真实反馈报错：`SYS_INTERACTION_RESPOND pipeline_error: context is not defined`
- 真实链路：翻开《墓穴陷阱》后，选择一个力量 4 或以下的随从执行消灭。

## 根因

- 文件：`src/games/smashup/abilities/ancient_egyptians.ts`
- 现实含义：这段“选完目标后执行消灭”的回调需要读取上一轮 prompt 上下文里的基地索引，但函数签名没有接住这份上下文，运行时直接引用了未定义变量 `context`。

## 修复

- 给 `ancientEgyptiansTombTrapOnUncoverProgram` 的 `onResolve` 显式补回 `context` 参数。
- 新增定向回归，真实走“翻开《墓穴陷阱》 -> 选目标随从 -> 完成消灭”的路径，防止再次出现同类未定义上下文错误。

## 验证

- 命令：
  - `npx vitest run src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts src/engine/ai/__tests__/onlineDecisionView.test.ts`
- 结果：
  - 通过
  - `ancient_egyptians_tomb_trap 翻开后选择目标随从时不应再抛 context 未定义错误` 已通过
  - 目标随从正常进入 `MINION_DESTROYED` 结算

## 对应回归

- `src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts`
- 用例名：`ancient_egyptians_tomb_trap 翻开后选择目标随从时不应再抛 context 未定义错误`
