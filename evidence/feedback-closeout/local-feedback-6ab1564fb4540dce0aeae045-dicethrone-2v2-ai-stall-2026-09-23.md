# 本地反馈收口：6ab1564fb4540dce0aeae045

## 本轮口径

- 统计时间：2026-09-24（Asia/Shanghai）
- 处理口径：只按本地源码、真实线上反馈快照的回放和本地回归结果收口。
- 线上服务状态：本轮不等待部署、不调用线上状态写接口；`live-open-20260923.json` 仍是历史抓取的 `open` 快照。
- 本地状态镜像：本轮按本地处理结果更新为 `resolved`；不代表线上接口已回写。

## 反馈内容 / 现实症状

反馈原文：

> 2v2经常卡住动不了

命中的游戏是 Dice Throne，反馈记录指向房间 `Y_d7ePnSxtx`，阶段为 `defensiveRoll`。原始状态同时存在待处理伤害和一组仍阻塞阶段的展示态奖励骰，但没有可供 AI 正式提交的 Token 响应交互；因此页面表现为流程停住，玩家继续不了。

来源：

- `temp/feedback-closeout/20260923-online/6ab1564fb4540dce0aeae045.md`
- `temp/feedback-closeout/live-open-20260923.json`

## 为什么“强制结束”当时没有用

旧的手动入口虽然叫“强制结束”，实际仍复用了“先让 AI 生成当前合法动作，再决定是否恢复”的普通 recovery sequence。这个现场恰好是没有可供 AI 生成的正常动作，结果手动入口没有执行已经明确的恢复命令，最后表现为无进展或 `unavailable`。

这个现场的正确强制收口顺序不是让 AI 再选一次，而是直接按权威状态执行：

```text
CONFIRM_ROLL
SKIP_TOKEN_RESPONSE
ADVANCE_PHASE
```

如果自动 watchdog 已经先占用恢复锁，手动请求仍需等待既有恢复释放；但只要局面仍未收口，手动请求不能再因为“没有合法 AI 动作”而结束在 `unavailable`。

## 根因与修复

本反馈的直接根因是：手动强制入口把“强制收口命令”和“普通 AI 合法动作生成”混成了一条链。展示态奖励骰阻塞时，第一步需要确认骰面；确认后才会出现 Token 跳过交互；这类恢复命令本来可以由服务端根据权威状态直接执行，却被错误地交回 AI 动作生成。

本地修复：

1. `src/engine/transport/onlineAiRecoverySequenceRunner.ts`
   - 新增手动强制命令执行模式：手动入口直接执行当前候选的恢复命令，不调用 AI 合法动作生成。
   - 没有正常合法动作时，继续使用服务端确认过的阶段推进命令；一次手动强制链成功后，后续阶段推进也不再重新交回 AI。
   - 对“AI 阶段里轮到真人响应”的场景保留原链路：先关响应窗口，再让 AI 正常掷骰，避免误跳攻击阶段。
2. `src/engine/transport/onlineAiManualRecoveryCoordinator.ts` / `src/engine/transport/server.ts`
   - 手动按钮显式传递 `forceManualCommandExecution`，只影响手动请求，不放宽自动 watchdog。
3. `src/games/dicethrone/ai.ts` / `src/engine/transport/onlineAiRecoveryDispatch.ts`
   - 保留并覆盖自动 watchdog 的 Dice Throne 恢复顺序：展示态奖励骰先确认，再跳过 Token 响应；transport 不再绕过游戏层动作顺序。

修复后的本地收口顺序：

```text
CONFIRM_ROLL
SKIP_TOKEN_RESPONSE
ADVANCE_PHASE
```

## 验证

- 关键回归：5 个测试文件、`48 passed`
  - `src/games/dicethrone/__tests__/ai-main-phase-turn-gating.test.ts`
  - `src/engine/transport/__tests__/onlineAiDiceThroneWatchdogRecovery.test.ts`
  - `src/engine/transport/__tests__/onlineAiManualRecoveryCoordinator.test.ts`
  - `src/engine/transport/__tests__/onlineAiRecoverySequenceRunner.test.ts`
  - `src/engine/transport/__tests__/server-command-authority.test.ts`
- 真实反馈状态快照的手动协调器回放通过：返回 `accepted: true`，直接执行 `CONFIRM_ROLL → SKIP_TOKEN_RESPONSE → ADVANCE_PHASE`，离开 `defensiveRoll`，最终无交互阻塞、`pendingDamage`、展示态奖励骰和 `currentRollContext` 残留。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

## 漏审复盘 / 规范回代

本轮不是规范缺口，而是已有规范执行时把两条链路混淆了：

- `.spec/skills/feedback-closeout/SKILL.md` 已明确：本地处理结果可以立即同步本地状态镜像，不能把等待线上部署或线上真实回写当成本地收口前置条件。
- `.spec/skills/game-ai-adaptation/SKILL.md` 已明确：先修游戏层合法动作和交互可解性，再由 watchdog 兜底；不能用强制推进掩盖非法 AI 动作。

旧流程漏掉了“手动强制结束必须绕过 AI 合法动作生成”这一执行语义，但现有项目 workflow 已覆盖本地即时收口和 AI 交互闭环要求。本轮补齐实现、回归测试和证据，不新增重复规范；线上部署和线上反馈写接口仍不在本轮范围内。
