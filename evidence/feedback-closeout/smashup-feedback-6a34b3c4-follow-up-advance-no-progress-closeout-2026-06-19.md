# SmashUp 线上反馈 6a34b3c45ed87cdca4f71dbf 收口证据

## 时间与口径

- 处理时间：`2026-06-19 20:36 +08:00`
- 反馈来源：线上真实反馈接口 `https://api.easyboardgame.top/admin/feedback`
- 反馈 ID：`6a34b3c45ed87cdca4f71dbf`
- 游戏：大杀四方（SmashUp）

## 原始症状

- 系统自动反馈记录的是：在线 AI watchdog 在计分阶段尝试替当前座位继续推进，但最后报成“补最后一步结束阶段时没有进度”（`active-turn:follow-up-advance:no_progress`）。
- 反馈自带的真实状态快照显示：
  - 当前阶段是计分阶段（`scoreBases`）
  - 当前 AI 座位是 `3`
  - 可见合法动作总数只有 1 个，就是“结束当前阶段”（`advance-phase:scoreBases:3`）
  - 没有额外交互窗口，也没有其他合法动作

## 根因

- 这次不是 transport watchdog 主循环本体坏掉。
- 真正问题在于：`smashup_reaction_choose` 这类统一响应交互从持久化恢复后，如果当前按钮列表只是旧快照、又没有自己的动态刷新器，AI 仍会把里面已经失效的 special 选项当成真实候选。
- 结果是：
  - AI 侧看到的候选集合比真实 live reaction session 更脏；
  - 本该只剩 `Pass` 或直接收口的响应链没有被及时清掉；
  - 后续只剩自然推进时，watchdog 统计到的进度链路会落成这组 `no_progress` 反馈。

## 修复

- 文件：`src/games/smashup/ai.ts`
- 改动：
  - 在 `buildInteractionActions` 里，针对 `smashup_reaction_choose` 增加分流：
    - 如果当前交互本身已经带 `optionsGenerator` 或 `autoRefresh`，继续信当前交互自己的 live 刷新；
    - 如果当前交互只是持久化回来的旧按钮快照，没有动态刷新能力，则改为直接使用 SmashUp reaction live session 重新生成候选。
- 这样可以把“旧 special 还挂在按钮上，但 live session 里已经失效”的场景收敛到真实候选集，不再把脏快照继续喂给 AI。

## 验证

已通过定向回归：

```powershell
pnpm vitest run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native -t "smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass|smashup_reaction_choose 响应持久化后的失效 special 快照时，应按当前 live 语义正规化并直接收口|wizards_arcane_protector 已进场后，afterScoring live 反应不应继续暴露其 special"
pnpm vitest run src/games/smashup/__tests__/aiReactionChoiceValidation.test.ts --configLoader native
pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"
```

验证结果：

- 持久化恢复后只剩失效 special 快照时，AI 只再暴露 `pass`
- 响应失效 special 时，当前 live 语义会直接正规化并收口，不再继续挂脏选项
- 已有“当前交互自己带 live 刷新器时优先信当前交互”的保护测试仍通过
- watchdog 在“交互恢复后只剩自然过阶段”的服务端回归仍通过，没有把 transport 现有防线打坏

## 结论

- 该反馈属于**已用真实反馈状态快照锁定根因，并以本地定向回归覆盖修复**。
- 当前代码已修复 SmashUp 统一响应入口里的旧 special 快照污染问题。
- 本证据只证明“代码修复 + 本地验证”成立，不代表已经部署上线，也不代表远端反馈状态已成功回写。
