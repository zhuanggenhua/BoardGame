# 2026-06-27 线上开放反馈收口补充证据

## 范围

- 时间口径：`2026-06-27 20:28 +08:00`
- 真相源：
  - 线上反馈读取：`https://api.easyboardgame.top/admin/feedback`
  - 正式回写入口：生产 `boardgame.feedbacks`
- 本轮处理对象：
  - `6a3f46f26ee79f45eb0a789e`
  - `6a3f4b166ee79f45eb0a7904`
  - `6a3f7c8c6ee79f45eb0a7a22`
  - `6a3f81f96ee79f45eb0a7a30`
  - `6a3f52cb6ee79f45eb0a7923`
  - `6a3f8a646ee79f45eb0a7a34`

## 反馈 1：DiceThrone watchdog `active-turn-legal-only:follow-up-advance:blocker_persisted`

- 反馈 ID：`6a3f46f26ee79f45eb0a789e`
- 归类：当前树已恢复
- 真实反馈证据：
  - 诊断包 `temp/feedback-closeout/2026-06-27T12-19-21-676Z/6a3f46f26ee79f45eb0a789e.md`
  - 反馈自带真实 `legalActions` 与 `aiDecisionPreview`
  - 现场是 `offensiveRoll`，只剩 `ADVANCE_PHASE` 合法推进
- 当前树验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE 而不是提前报 legal_action_unavailable"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/localRunner.attemptKey.test.ts --configLoader native`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "本地 AI 在紧缚且 0CP 无法继续重投时，不应继续锁骰循环"`
- 结论：
  - 当前代码已经能把同类 `legal-only` follow-up 链路继续推进，不再把这类场景留成旧 blocker。
  - 这条系统反馈应按“当前树已恢复”收口，不再作为现存未修 bug 挂在开放队列。

## 反馈 2：DiceThrone watchdog `visible-interaction:recover-interaction:blocker_persisted`

- 反馈 ID：
  - `6a3f81f96ee79f45eb0a7a30`
  - 重复项：`6a3f7c8c6ee79f45eb0a7a22`、`6a3f4b166ee79f45eb0a7904`
- 归类：当前树已恢复
- 真实反馈证据：
  - 诊断包 `temp/feedback-closeout/2026-06-27T12-19-21-676Z/6a3f81f96ee79f45eb0a7a30.md`
  - 反馈现场是咒缚海盗 `走跳板`（`walk-the-plank`）二选一提示已经出现，且 AI 可见交互、可选项、合法动作都完整存在
- 当前树验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/monk-coverage.test.ts --configLoader native -t "触发禅忘二选一后应关闭当前提示并标记前置选择已完成"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 compare-roll visible interaction 尝试恢复后若同一 incident 仍持续，应明确上报 blocker_persisted|online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死"`
  - 仓内既有真实入口证据：
    - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 其中 `121-123` 已覆盖 `走跳板` 真实入口、二选一提示、以及弃牌分支收口
- 结论：
  - 当前仓库下，同类“前置选择已生效但提示残留”的交互恢复链已有定向回归与真实入口证据。
  - 这 3 条属于旧现场系统反馈，按“当前树已恢复”统一关闭。

## 反馈 3：SmashUp 前端自动反馈 `[auto][unhandledrejection] 4`

- 反馈 ID：`6a3f52cb6ee79f45eb0a7923`
- 归类：反馈噪音已收口
- 真实反馈证据：
  - 诊断包 `temp/feedback-closeout/2026-06-27T12-19-21-676Z/6a3f52cb6ee79f45eb0a7923.md`
  - 栈里明确包含 `vendor-howler-Bp1HXCiM.js`
  - 同一栈簇落在前端音频加载链，不是 SmashUp 规则或交互逻辑
- 本轮修复：
  - `src/lib/feedback/clientAutoReport.ts`
  - 对 Howler 音频错误码 `4` 增加自动反馈噪音过滤
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts --configLoader native`
  - 新增回归：`Howler 音频错误码噪音会被过滤，不进入自动反馈`
- 结论：
  - 这条不是现存业务 bug，而是前端音频库噪音误上报。
  - 当前已在自动反馈链过滤，应关闭。

## 反馈 4：Client 前端自动反馈 `No codec support for selected audio sources.`

- 反馈 ID：`6a3f8a646ee79f45eb0a7a34`
- 归类：反馈噪音已收口
- 真实反馈证据：
  - 诊断包 `temp/feedback-closeout/2026-06-27T12-19-21-676Z/6a3f8a646ee79f45eb0a7a34.md`
  - 现场位于 DiceThrone 房间 `setup`，报错文案直接是音频源编解码不支持
- 本轮修复：
  - `src/lib/feedback/clientAutoReport.ts`
  - 对 `No codec support for selected audio sources.` 与 `Decoding audio data failed.` 增加自动反馈噪音过滤
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts --configLoader native`
  - `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/errorContext.autoReport.test.ts --configLoader native`
  - 新增回归：
    - `音频编解码不支持噪音会被过滤，不进入自动反馈`
    - `音频解码失败噪音会被过滤，不进入自动反馈`
- 结论：
  - 这条属于客户端音频兼容噪音，不再作为业务故障继续保留在开放反馈队列。

## 本轮代码改动

- `src/lib/feedback/clientAutoReport.ts`
  - 新增音频编解码噪音与 Howler 数字错误码噪音过滤
- `src/lib/__tests__/clientAutoReport.test.ts`
  - 补 3 条自动反馈过滤回归

## 本轮验证汇总

- `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/errorContext.autoReport.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 compare-roll visible interaction 尝试恢复后若同一 incident 仍持续，应明确上报 blocker_persisted|online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死"`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE 而不是提前报 legal_action_unavailable"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/monk-coverage.test.ts --configLoader native -t "触发禅忘二选一后应关闭当前提示并标记前置选择已完成"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "本地 AI 在紧缚且 0CP 无法继续重投时，不应继续锁骰循环"`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/localRunner.attemptKey.test.ts --configLoader native`
