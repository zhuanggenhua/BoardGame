# SmashUp 系统反馈待回写（6a327ea0638b2f426d29505f）

## 范围

- 反馈 ID：`6a327ea0638b2f426d29505f`
- 游戏：`smashup`
- 反馈原文：
  - `[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed:SYS_INTERACTION_RESPOND:无效的选择`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet` -> `boardgame.feedbacks`
- 该条属于**系统自动反馈**，不是玩家直接提交的新业务反馈。

## 当前生产现场

- 当前现场已经锁到：
  - `phase = scoreBases`
  - `sourceId = smashup_reaction_choose`
  - `responseWindow.windowType = afterScoring`
- 当前真实反应窗可见选项只有两项：
  - `时空旅行者跳跃者（time_travelers_jumper）` 的 trigger
  - `pass`
- 但 AI 决策预览（模型输入前的本地决策候选）里，选中的仍是一条旧候选：
  - `base_wizard_academy`
- 现实含义：
  - 当前玩家面前的真实可点选项已经刷新到新的统一反应窗
  - watchdog 却还沿着旧候选 / 旧 tracker 去点，最后才被系统拒成“无效的选择”

## 根因归类

- 这不是《时空旅行者跳跃者》（`time_travelers_jumper`）计分后反应链本体坏了。
- 更准确的结论是：
  - 这是 **shared transport / tracker continuity** 问题
  - 即：visible simple-choice 的候选已漂移，但 watchdog 还没及时丢掉旧候选
- 同家族旧证据：
  - `evidence/feedback-closeout/system-auto-feedback-closeout-2026-06-04-remaining-watchdogs.md`
  - 该证据已经说明同类 `SYS_INTERACTION_RESPOND:无效的选择` 属于 visible simple-choice 候选漂移后的 shared transport 问题，而不是领域规则本身失效

## 当前树验证

- transport / watchdog 回归：
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress|tryRecoverOnlineAiWithLegalAction 在 visible simple-choice 仅 option value 漂移且 progress marker 不变时，也应视为已推进|online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因"`
  - 结果：`3 passed`
- 领域链本体回归：
  - `pnpm vitest run src/games/smashup/__tests__/reactionQueueEventPlayerContext.test.ts --configLoader native -t "sourceController queued onCardReturnedToHand trigger 仍应把 Time Box 的第 5 枚计数 prompt 交给拥有者"`
  - 结果：`1 passed`

## 当前状态

- 反馈本体结论：`resolved（待正式回写）`
- 理由：
  - 生产现场已经证明这是“旧候选没有及时丢掉”的 shared transport 问题
  - 当前树 transport / watchdog 回归已经覆盖这类 option value 漂移
  - 领域链本体也通过了最窄回归，没有证据表明《时空旅行者跳跃者》自身还坏着
- 当前边界：
  - HTTP 正式回写接口当前仍是 `404`
  - 本轮没有拿到“允许直写生产 Mongo”的明确授权

## 收口结论

- 这条反馈不应继续按“SmashUp 计分后反应链仍坏着”推进。
- 更准确的口径是：
  - `当前树已恢复 / 当前实现正常`
  - `剩下的是生产反馈状态尚未正式回写`
