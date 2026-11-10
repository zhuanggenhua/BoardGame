# Dice Throne 线上反馈修复证据

- 日期：2026-09-25
- 反馈原文：`2v2经常卡住动不了`、`卡顿`、`飞行判定后ai卡死而且无法强制跳过回合`
- 对应反馈：`6ab1564fb4540dce0aeae045`、`6ab22ff3f327d9e3e562931d`、`6ab4cab153f9291a46438c9f`

## 线上现场

生产反馈快照 `temp/feedback-closeout/20260925-online-recheck/6ab1564fb4540dce0aeae045.md` 显示：

- 阶段停在 `defensiveRoll`
- AI 仍有 `pendingDamage`
- 飞行奖励骰是 `displayOnly=true`
- `currentRollContext.status=open`
- `currentRollContext.policy.blocksPhaseFlow=true`
- 共享状态没有当前可见交互，但仍标记为阻塞
- 事件流反复记录 AI Token 响应因 `no-legal-actions` 被取消

这解释了原始症状：AI 私有视图里的 Token 交互取消后，真正阻塞阶段流的飞行展示骰没有先完成确认，阶段继续被锁住。

## 本地修复

在 `src/engine/transport/onlineAiRecovery.ts` 中，若共享状态明确阻塞、共享交互已为空，则先执行引擎从权威状态推导出的合法收口动作，再检查 AI 私有交互。这样 Dice Throne 会先执行：

`CONFIRM_ROLL -> SKIP_TOKEN_RESPONSE -> ADVANCE_PHASE`

而不会让残留的私有 `dt:token-response` 交互先抢走恢复机会。

新增回归覆盖：

- 共享状态 `interaction.current=undefined`
- `interaction.isBlocked=true`
- AI 私有视图仍残留 `dt:token-response`
- `pendingBonusDiceSettlement.displayOnly=true`
- `currentRollContext.status=open`
- `blocksPhaseFlow=true`

## 验证

- `onlineAiDiceThroneWatchdogRecovery.test.ts`：17 项通过
- Dice Throne / transport 针对性测试：5 个文件、49 项通过
- `npm run typecheck`：通过
- Smash Up 相关保护与粗鲁少妇回归：2 个文件、31 项通过

## 线上边界

本轮只完成本地源码修复和测试验证，没有执行 CI 镜像构建、生产部署或同一真实房间回放。因此三条 Dice Throne 反馈仍保持 `in_progress`，不能称为线上已解决。
