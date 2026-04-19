# Dice Throne 枪手 The Law 多目标交互 E2E 证据

## 范围

- 目标：验证 `upgrade-deadeye-2` 的升级变体 **`the-law`** 对应的 `selectPlayer + selectCount = 2` 多目标交互链路，已经从 UI 到领域结算闭环。
- 重点：
  - 只选 1 名目标时允许确认；
  - 选择 2 名目标时单次确认即可原子结算两名玩家的 `bounty + knockdown`；
  - 交互完成后 `sys.interaction.current` 被清空。

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player The Law variant: upgraded Deadeye offers all target players in 2v2 and resolves on two selected targets"
```

## Addendum（2026-04-12）：补齐“真实触发入口 + 多模式目标集合”证据（已修订旧结论）

> **修订原因**：早期证据曾把 `The Law` 的目标集合简化成“敌方 only”。但权威卡面用的是“目标玩家 / up to 2 target players”的表述，本轮已统一裁决为：
> - `1v1`：自动退化为唯一对手（无交互弹窗）；
> - `3+` 人：进入多目标交互（最多选择 2 名目标玩家；当前实现的目标集合覆盖 **全部座次玩家**，即包含 self / ally / enemies）；
> - `4 人 2v2`：同样进入多目标交互，目标集合覆盖 **全部座次玩家**（含 self / ally / enemies），并可一次确认原子化结算两名被选目标的 `bounty + knockdown`。
>
> **对象命名修订**：旧口径若把它写成独立手牌对象 `card-the-law`，该结论已失效。当前运行时正确对象是 **`upgrade-deadeye-2` 的升级变体 `the-law`**，不是一张独立可抽/可弃的手牌。

### 1) 1v1：选择升级变体后应直接结算（无多目标弹窗）

截图（成功路径连续证据链）：
- `22` 选择变体前：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-resolve-immediately-in-1v1-after-selecting-the-upgraded-variant\22-the-law-variant-1v1-before-select.png`
- `23` 选择变体后自动结算（无多目标弹窗）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-resolve-immediately-in-1v1-after-selecting-the-upgraded-variant\23-the-law-variant-1v1-after-resolve.png`

### 2) 3 人：多目标弹窗可选至多 2 名目标玩家并完成结算

截图（成功路径连续证据链）：
- `24` 已选 2 名目标（确认按钮 enabled）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-open-multi-target-interaction-after-selecting-the-upgraded-variant-in-3-player-scene\24-the-law-variant-3p-selected-targets.png`
- `25` 确认后原子化结算（交互关闭）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-open-multi-target-interaction-after-selecting-the-upgraded-variant-in-3-player-scene\25-the-law-variant-3p-resolved.png`

### 3) 4 人 2v2：目标集合覆盖全部座次玩家（含 self / ally / enemies）
- `10` 选目标弹窗：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-The-Law-variant-upgraded-Deadeye-offers-all-target-players-in-2v2-and-resolves-on-two-selected-targets\10-four-player-the-law-all-target-selection.png`
- `11` 结算后：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-The-Law-variant-upgraded-Deadeye-offers-all-target-players-in-2v2-and-resolves-on-two-selected-targets\11-four-player-the-law-resolved-on-selected-targets.png`
