# 线上反馈 6ac3cb228e134ec1dfb102f6：Dice Throne 重复恢复后的强制解卡

## 反馈原文

`[system][online-ai-watchdog] repeated-recovery-force-unblocked visible-interaction:repeat-limit-force-unblock:3/3:commands=SYS_INTERACTION_CANCEL+ADVANCE_PHASE`

来源：2026-10-06 重新读取生产 `https://api.easyboardgame.top/admin-api/feedback` 的反馈记录。

## 发现的问题

- 真实现场与反馈 `6ac3cb218e134ec1dfb102ee` 相同：对局 `mVdDzi2N0ep`、AI 座位 1、`dt:card-interaction` `dt-interaction-card-transfer-status-1791216416534`。
- 该记录是前一条 `legal_action_command_failed` 的下游恢复结果：重复恢复达到 3 次后，watchdog 使用 `SYS_INTERACTION_CANCEL+ADVANCE_PHASE` 强制解除卡点。
- 根因不是 watchdog 的重复计数，而是 AI 选择了目标状态容量已满的 `targeted -> player 0` 转移，前置交互因此没有可执行结果。

## 处理方式 / 修复结果

- 与 `6ac3cb218e134ec1dfb102ee` 共用同一根因修复：目标容量由 `canReceiveTransferredStatus` 统一判断；命令验证拒绝 `invalid_status`；AI 候选过滤已满目标；自定义交互 diagnostics 区分 `options-not-projected` 与真实空选项。
- 这使 watchdog 在进入重复强制解卡前，先得到可执行的转移动作或明确的交互取消路径，避免再次生成同类静默 no-op。

## 验证

- `npm run test:ai:decision-view`：60 个测试文件、649 项通过。
- Dice Throne 基础命令覆盖：166 项通过；watchdog diagnostics：6 项通过；定向 ESLint：0 errors。
- 现场重放与回归覆盖了“目标 `targeted` 已达 stack limit”边界。

## 当前状态与边界

- 本地根因已修复，线上反馈可标记 `resolved`。
- 生产 bundle 尚未在本轮发布；需在发布后复查当前线上版本，确认不再出现相同 transfer-status 交互与重复 force-unblock。

## 漏审复盘

- 该反馈暴露的是同一共享容量合同缺口的二次症状；旧测试只覆盖 watchdog 的恢复策略，没有覆盖其上游 AI 候选必须与领域容量约束一致。
- 本轮用共享容量判断同时修复 AI、命令验证和 diagnostics，避免只削弱 watchdog 或把恢复告警吞掉。
