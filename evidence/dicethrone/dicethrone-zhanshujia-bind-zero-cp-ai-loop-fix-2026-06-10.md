# DiceThrone 战术家紧缚 0CP 锁骰循环修复记录（2026-06-10）

## 反馈对象

- 业务反馈：`6a26a66b52a24b6de8402763`
  - 内容：`有绳缚对手没有cp时卡死`
  - 状态：`open`
- 系统反馈：`6a26a4a952a24b6de840274f`
  - 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:blocker_persisted`
  - 状态：`open`

## 真相源

- 生产库 `feedbacks` 中这两条真实反馈。
- 业务反馈自带 `stateSnapshot`。
- 系统反馈自带 `legalActions` 与 `aiDecisionPreview`。

## 现场结论

- 卡死发生在 `offensiveRoll`。
- 当前行动位是 `3` 号位。
- `3` 号位身上有 `紧缚（bind）=1`，`CP=0`。
- 当时 `rollCount=2`、`rollLimit=3`、`rollConfirmed=false`。
- 系统反馈显示本地 AI 当时还能看到这些合法动作：
  - `toggle-die-lock`
  - `confirm-roll`
  - `advance-phase`
- 但 AI 预选动作是 `toggle-die-lock`，并且生产快照的最近事件尾部持续刷出 `DIE_LOCK_TOGGLED`，符合“反复锁骰但不收口”的症状。

## 根因判断

- 不是领域层把 `紧缚 + 0CP` 误判成“还能继续重投”。
  - 领域校验已经会拒绝 `ROLL_DICE`：`bind > 0 && rollCount > 0 && cp < 1 -> not_enough_cp`。
- 真正的问题在本地 AI 的骰面规划打分：
  - 在 `紧缚 + 0CP + 已经掷过` 的场景下，AI 仍把“继续锁/解锁骰子”当成高分微操作。
  - 结果是一直做锁骰微调，而不是走“确认骰面”收口。

## 修复

- 文件：`src/games/dicethrone/ai.ts`
- 修法：
  - 抽出 `offensiveRoll + bind>0 + rollCount>0 + cp<1` 的统一判断。
  - 该场景下从合法动作枚举层直接移除：
    - `toggle-die-lock`
    - `roll-dice`
  - 同时在 `dicePlanScorer` 中继续保留收口偏好：
    - `confirm-roll` 明确升为高分收口动作。

## 第二层保险

- 文件：
  - `src/engine/ai/types.ts`
  - `src/engine/ai/localRunner.ts`
  - `src/engine/ai/__tests__/localRunner.attemptKey.test.ts`
- 修法：
  - 给游戏 AI runtime 增加轻量钩子 `refineAiAction(...)`。
  - `localRunner` 在本地策略返回动作后、以及本地 fallback / 远端 fallback 返回动作后，统一允许 runtime 做最终收口修正。
  - DiceThrone runtime 在 `紧缚 + 0CP + offensiveRoll + 已经掷过` 时：
    - 若策略或 fallback 仍返回 `toggle-die-lock` / `roll-dice`
    - 则统一改成 `confirm-roll`
- 作用：
  - 第一层仍是 DiceThrone 合法动作层直接去掉无意义微操作。
  - 第二层则确保即便以后某条策略分支又把微操作放回来，runner 也会在真正派发前收口，不再靠 watchdog 超时兜底。

## 回归

- 新增测试：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
  - 用例：`本地 AI 在紧缚且 0CP 无法继续重投时，不应继续锁骰循环`
  - 断言：
    - 不再产出 `toggle-die-lock`
    - 不再产出 `roll-dice`
    - AI 直接选择 `confirm-roll`
- 既有规则测试复跑：
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`
  - 用例：`紧缚让额外进攻投掷每次消耗 1CP，CP 不足时拒绝并在阶段结束移除`

## 验证结果

- `pnpm vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "本地 AI 在紧缚且 0CP 无法继续重投时，不应继续锁骰循环" --configLoader native`
  - 通过
- `pnpm vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "紧缚让额外进攻投掷每次消耗 1CP，CP 不足时拒绝并在阶段结束移除" --configLoader native`
  - 通过
- `pnpm vitest run src/engine/ai/__tests__/localRunner.attemptKey.test.ts --configLoader native`
  - 通过
  - 新增 runner 回归：即使策略仍返回 `toggle-die-lock`，runtime 也能把最终动作改成 `confirm-roll`
- 额外本地探针：
  - 用同等场景调用 `resolveNextLocalAiAction`
  - 返回动作：`confirm-roll`

## 扩大回归说明

- 执行：
  - `pnpm vitest run src/engine/ai/__tests__/localRunner.attemptKey.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native`
- 结果：
  - 本轮新增的 runner 回归通过
  - 本轮目标的 DiceThrone AI 回归通过
  - 但 `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` 中已有 4 条“human 面惊魂动魄在多人局……”测试失败
- 结论：
  - 这 4 条失败位于当前工作区原有脏改文件里，症状是“移除诅咒金币选择后又多结算了一次 7 点伤害”
  - 与本轮 AI runner 收口修复命中的症状不同，当前不能把它们归为本轮 AI 卡死修复的一部分

## 当前状态说明

- 代码侧修复已完成，并有定向回归。
- 这两条生产反馈当前还未改状态。
- 原因：本轮只完成代码修复与本地验证，尚未随正式部署验证线上新版本生效。
