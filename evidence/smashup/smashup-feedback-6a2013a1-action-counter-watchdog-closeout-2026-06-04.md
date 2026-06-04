# SmashUp 线上反馈 `6a2013a178c1ecf399a6793a` 行动反制 watchdog 收口证据

## 反馈来源

- 反馈 ID：`6a2013a178c1ecf399a6793a`
- 游戏：`smashup`
- 反馈类型：`player-command-failure`
- 线上症状摘要：
  - `SYS_INTERACTION_RESPOND pipeline_error: Maximum call stack size exceeded`
  - `progressMarker` 明确包含 `smashup_action_counter_choose`
- 本轮目标：
  - 判断这是不是 SmashUp 领域反制链自身死循环；
  - 若不是，则在 transport / watchdog 层补足可复查回归与修复证据。

## 现场分诊

- 已先用最小领域脚本核对 `行动 -> 玩家 1 维尔的力量 -> 玩家 2 维尔的力量`：
  - 标准三人链路下，第二层反制后 prompt 会正常清空；
  - 若后续玩家手里还有另一张新的 `维尔的力量`，再次出现 `smashup_action_counter_choose` 属于合法新候选，不是把已打出的旧牌重复拿出来。
- 因此，本条反馈不应继续归因到 `src/games/smashup/domain/actionCounter.ts` 的纯领域反制顺位本身。
- 真正的 shared seam 在 transport：
  - `tryRecoverOnlineAiWithLegalAction(...)` 旧逻辑只用 `buildAiProgressMarker(...)` 判定“legal action 是否推进”；
  - 但 `buildAiProgressMarker(...)` 对 visible `simple-choice` 只记录 `optionId + disabled`，不记录 `option.value`；
  - 当 `smashup_action_counter_choose` 沿用同一个 prompt 外壳、同一个 `counter-0/pass` 选项 id，但候选实际从 `force-1` 漂移为 `force-1b` 时，
    watchdog 旧逻辑会把“已切到新 prompt 语义”误判成“没有推进”，继而重复代答同一 visible interaction；
  - 这与线上 `SYS_INTERACTION_RESPOND` 连发、最终堆栈溢出的症状形状一致。

## 根因

- 文件：[src/engine/transport/server.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts:3375)
- 根因位置：`tryRecoverOnlineAiWithLegalAction(...)`
- 旧逻辑：
  - 记录 `markerBefore = buildAiProgressMarker(match.state)`
  - AI legal action 执行后，若 `markerAfter === markerBefore`，直接判成 `legal-action-command-failed`
- 问题：
  - 对 `smashup_action_counter_choose` 这类 visible `simple-choice`，`progress marker` 不含 `option.value`
  - 所以即使 prompt 语义已变，新旧 marker 仍可能完全相同
  - watchdog 会把合法推进误诊成“没推进”，进一步制造重复 `RESPOND`

## 本轮修复

- 文件：[src/engine/transport/server.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts:3375)
- 调整：
  - 在 `tryRecoverOnlineAiWithLegalAction(...)` 中，除了 `markerBefore/markerAfter`，额外计算：
    - `recoveryFingerprintBefore = buildOnlineAiRecoveryFingerprint(match, candidate, markerBefore)`
    - `recoveryFingerprintAfter = buildOnlineAiRecoveryFingerprint(match, candidate, markerAfter)`
  - 只有在
    - `markerAfter === markerBefore`
    - 且 `recoveryFingerprintAfter === recoveryFingerprintBefore`
    - 两者同时成立时，才继续判定为 `legal-action-command-failed`
- 含义：
  - 若 visible interaction 的语义指纹已经变化，即使 `progress marker` 不变，也应视为 watchdog 已经推进到新的 prompt 现场
  - 对 `smashup_action_counter_choose`，这会阻止 transport 把“新候选反制牌”误当成“同一 prompt 原地未动”

## 回归测试

### 1. Visible simple-choice value drift 指纹变化

- 文件：[src/engine/transport/__tests__/server.test.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts:8932)
- 用例：
  - `buildOnlineAiRecoveryFingerprint 在 visible simple-choice 的 option id/disabled 相同但 value 漂移时，也必须变化`
- 目的：
  - 先证明 `simple-choice` 的 recovery fingerprint 确实能区分 `force-1` 与 `force-1b` 这类候选语义变化

### 2. Legal-action seam 直接锁定

- 文件：[src/engine/transport/__tests__/server.test.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts:15579)
- 用例：
  - `tryRecoverOnlineAiWithLegalAction 在 visible simple-choice 仅 option value 漂移且 progress marker 不变时，也应视为已推进`
- 目的：
  - 直接锁住本次修复 seam：
  - `markerBefore === markerAfter`
  - 但 `smashup_action_counter_choose` 的 `option.value.cardUid` 从 `force-1` 漂到 `force-1b`
  - 结果必须仍判为 `applied: true`

### 3. Watchdog sequence 层回归

- 文件：[src/engine/transport/__tests__/server.test.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/engine/transport/__tests__/server.test.ts:11219)
- 用例：
  - `online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress`
- 目的：
  - 锁住更贴近线上的完整 watchdog 行为：
  - 第一轮 legal action 后现场切到新的 `smashup_action_counter_choose`
  - 第二轮应继续沿新 prompt 收口
  - 不应吞成 `no_progress`

## 实际验证

### 定向 Vitest

命令：

```bash
npx vitest run src/engine/transport/__tests__/server.test.ts -t "online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress|tryRecoverOnlineAiWithLegalAction 在 visible simple-choice 仅 option value 漂移且 progress marker 不变时，也应视为已推进|buildOnlineAiRecoveryFingerprint 在 visible simple-choice 的 option id/disabled 相同但 value 漂移时，也必须变化"
```

结果：

- `1 file passed`
- `3 passed`

关键日志形状：

- `online-ai-watchdog recovered stalled AI`
- `reason = visible-interaction`
- `markerBefore = 4|scoreBases|1|0|...|smashup_action_counter_choose|counter-0:0,pass:0`
- `markerAfter = 4|scoreBases|1|0|...` 或同 marker
- 即使 marker 不变，`tryRecoverOnlineAiWithLegalAction` 也不再把它误判成失败

### 静态检查

命令：

```bash
npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts
```

结果：

- 通过

## 结论

- `6a2013a178c1ecf399a6793a` 的高价值根因不在 SmashUp 纯领域反制链，而在 transport / watchdog 对 visible interaction 进展的误判。
- 当前修复已把 `smashup_action_counter_choose` 这类“`optionId` 不变但 `option.value` 已漂移”的场景纳入合法推进判定。
- 本轮已补：
  - shared transport 修复
  - legal-action seam 回归
  - watchdog sequence 回归
- 现有证据已足以支持：这条 feedback 在当前 worktree 下已被针对性覆盖，不再停留在“疑似 transport 死循环”的未证实状态。

## 边界

- 本轮未执行：
  - 生产 Mongo 状态回写
  - 生产部署
  - `feedbacks` 集合正式关闭
- 本文档只证明：
  - 当前代码对这条 open 反馈对应的 transport seam 已有明确修复与回归证据
