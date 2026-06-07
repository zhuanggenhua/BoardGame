# SmashUp 反馈 `6a221fc87d14bb74e8214d6e` 状态注入复核（2026-06-06）

## 反馈原文

- `6a221fc87d14bb74e8214d6e`
- 内容：
  - `三角恐龙给把这个拍的效果无视了，消了我一个超人里面的2费`

## 本轮方法

- 先不用主观描述替代现场，而是直接读取反馈原始包：
  - `temp/feedback-6a221fc87d14bb74e8214d6e.raw.json`
- 再做两层验证：
  1. 现有合同测试是否已经覆盖《激光三角龙》对《秘密基地》与《全副武装》的保护边界
  2. 用原始包里的 `stateSnapshot` 做状态注入，看看当前树从该状态继续打《激光三角龙》时是否还能出现同症状

## 合同测试证据

- `src/games/smashup/__tests__/specialInteractionChain.test.ts`
  - 用例：`tooth_and_claw 拦截消灭事件并自毁`
- `src/games/smashup/__tests__/abilities/dinosaurs.test.ts`
  - 用例：`激光三角龙不会越过秘密基地去消灭受保护的 2 力量随从`
- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/specialInteractionChain.test.ts src/games/smashup/__tests__/abilities/dinosaurs.test.ts --config vitest.config.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testNamePattern "tooth_and_claw|laser_triceratops|Laser Triceratops|全副武装"`
- 结果：
  - `2 passed`

## 状态注入证据

- 注入脚本：
  - `temp/feedback-closeout/replay-feedback-6a221fc87d14bb74e8214d6e-current-state.ts`
- 注入命令：
  - `npx tsx temp/feedback-closeout/replay-feedback-6a221fc87d14bb74e8214d6e-current-state.ts`

## 注入结果

- 原始包里的 `stateSnapshot` 只有**事后 current state**，没有用户报错前一拍的 undo 快照。
- 当前快照里的关键事实：
  - `base_tortuga` 上只有两张 4 力量超人随从
  - `base_the_nexus` 上是两张海盗《大副》，其中一张附着《全副武装》
  - `base_the_nexus` 同时有《秘密基地》
  - 当前玩家 `1` 手牌里有《激光三角龙》（`c63`）
- 直接从这份 snapshot 注入，令当前玩家在 `base_the_nexus` 打出 `c63` 后：
  - 命令成功
  - **没有出现目标选择 prompt**
  - 也没有出现“消灭一个超人 2 费随从”的现场
- 这说明：
  - 反馈原始包保存的是**事后态**，不是报错发生前的精确现场
  - 用这份状态注入，当前树无法重现用户原始症状

## 收口判断

- 本轮没有证据支持“当前树里这条 bug 仍然活着”。
- 也没有足够现场支持把这条归因为一个当前仍可稳定重现的领域缺口。
- 更准确的口径是：
  - 原始包只保留了事后态
  - 当前版本对《秘密基地》与《全副武装》的保护合同测试已通过
  - 按原始包现状注入也未复现同症状

## 结论

- 这条反馈不按 `resolved` 收口。
- 这条反馈应按 `closed` 归档，关闭理由：
  - `反馈原始包仅含事后 current state；当前版本按状态注入与合同测试均未复现同症状，归档关闭。`
