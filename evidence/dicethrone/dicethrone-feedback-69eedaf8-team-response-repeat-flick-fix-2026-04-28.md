# Dice Throne 反馈 69eedaf8 修复证据（2026-04-28）

> 2026-06-06 当前有效口径：本文只对应反馈 `69eedaf8039f95a4fe91b1a4` 这一条队友响应窗重复打同一张牌的历史修复证据，不是当前 DiceThrone 所有 team response / flick / response window 场景都已彻底收口的证明，也不是新英雄补审出口。阅读时只能把它理解成单条反馈修复记录。

- 反馈 ID：`69eedaf8039f95a4fe91b1a4`
- 标题：`Dice Throne AI 重复打同一张牌并卡住`
- 来源：生产 `feedbacks`
- 现场对局：`matchId=2MYqRWbYKGT`

## 现场复核

- 直接读取生产反馈包，`actionLog` 显示 `AI 4 号位` 在 `2026-04-27 11:40:03 ~ 11:41:37` 间反复打出 `弹一手！`。
- 同一份 `stateSnapshot` 显示当时仍停在：
  - `phase=offensiveRoll`
  - `responseWindow.windowType=afterRollConfirmed`
  - `responderQueue=['1','3']`
  - `currentResponderIndex=0`
- 事件流尾部可见重复模式：
  1. `PLAY_CARD(card-flick)`
  2. `INTERACTION_REQUESTED(selectPlayer, resolve-card-effects-on-selected-opponent)`
  3. `SYS_INTERACTION_CANCELLED`
  4. `INTERACTION_CANCELLED`
  5. 再次 `PLAY_CARD(card-flick)`

## 根因

- `DiceThrone` 允许 4 人队伍模式下，`afterRollConfirmed` 响应窗中的“非当前 responder 队友”先打直改骰牌。
- 但现有 `ResponseWindowSystem` 只给“当前 responder”放行这类后续交互命令：
  - `RESOLVE_INTERACTION` 不在响应窗 `allowedCommands` 白名单里。
  - `allowNonResponderCommand` 只放行首个 `PLAY_CARD`，没继续放行该队友后续的 `选目标/改骰` 交互命令。
  - 另外，`pendingInteractionId` 只会给当前 responder 的交互写锁，队友提前打出的交互不会写进去，不能拿它当唯一判据。
- 结果就是：
  - 队友能出牌；
  - 但不能继续执行 `RESOLVE_INTERACTION`；
  - 交互被取消、卡牌退回；
  - AI 再次选择同一张牌，形成死循环。

## 代码修复

- 修复文件：`src/games/dicethrone/game.ts`
- 修复内容：
  - 把 `RESOLVE_INTERACTION` 补进响应窗 `allowedCommands`。
  - 扩展 `allowNonResponderCommand`：
    - 在 `afterRollConfirmed` 中，只要该玩家本身就是合法的“队友直改骰响应者”，且当前交互归他所有；
    - 就继续放行它的后续交互命令，而不再只放行第一步 `PLAY_CARD`。

## 回归测试

- 新增回归：
  - `src/games/dicethrone/__tests__/flow.test.ts`
  - 用例：`4 人模式下非当前 responder 队友打出 card-flick 后，应能继续完成选目标与改骰交互`
- 该用例直接覆盖真实故障链：
  - `PLAY_CARD(card-flick)` -> `RESOLVE_INTERACTION(选目标)` -> `MODIFY_DIE` -> `SYS_INTERACTION_CONFIRM`

## 本轮验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism --testNamePattern="4 人模式下攻击方队友不会进入响应队列，但可直接打出改骰牌|4 人模式下非当前 responder 队友打出 card-flick 后，应能继续完成选目标与改骰交互"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
- `npm run typecheck`

## 结论

- 这是已定位并已在工作区修复的真实 bug。
- 当前口径只能记为“工作区已修复待上线验证”；尚未部署生产，也未回写线上反馈状态。

---

**当前阅读说明**：本文只能证明“队友在响应窗重复打 card-flick 并卡住”这条专项问题曾在工作区修复，不能外推为当前所有 team response、所有非当前 responder 交互或 DiceThrone 当前整体审计都已收口。
