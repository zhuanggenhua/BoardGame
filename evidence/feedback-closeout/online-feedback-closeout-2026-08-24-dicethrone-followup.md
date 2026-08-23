# 线上反馈收口 - Dice Throne follow-up（2026-08-24）

## 口径

- 口径：线上真实反馈。
- 真相源：`https://api.easyboardgame.top/admin-api/feedback` 拉取包 `temp/feedback-closeout/2026-08-23T16-29-05-453Z/summary.json`。
- 抓取时间：`2026-08-23T16:29:06.845Z`。
- 本轮未执行部署；状态回写只表示当前代码树已经修复 / 覆盖并通过定向验证。

## 反馈组

| 反馈 | 游戏 | 现实症状 | 结论 |
| --- | --- | --- | --- |
| `6a8aa705a857fa79e4f212fd` | Dice Throne | 玩家反复打出“俺也一样！”，进入选骰后无法完成效果 | 已修复 |
| `6a8a8400a857fa79e4f210a1` | Dice Throne | 同类反馈：“俺也一样无法使用” | 已修复 |
| `6a8af702446de293e25ff9fe` | Dice Throne | 自动检测到 `TRANSFER_STATUS` 被“等待对方响应”挡住 | 当前代码已覆盖 |
| `6a8af703446de293e25ffa06` / duplicate `6a8aa1d1a857fa79e4f21221` | Dice Throne | watchdog 恢复时先尝试 `TRANSFER_STATUS`，命令失败 | 当前代码已覆盖 |
| `6a8af704446de293e25ffa0e` | Dice Throne | 同一响应窗口恢复重复 3 次后被压制 | 当前代码已覆盖 |

## 玩家反馈：“俺也一样！”无法完成

- 原始症状：两条线上反馈都停在攻击掷骰阶段，行动日志显示玩家多次打出“俺也一样！”，但没有后续改骰命令落地。
- 真实证据：诊断包里的当前交互是 `multistep-choice`，来源是 `card-me-too`，`minSteps: 2`，`allowedDieIds: [0,1,2,3,4]`，`completedDieIds: []`；这说明不是没有可选骰，而是两步选骰交互没有完成提交。
- 直接触发条件：服务端序列化后的多步交互只带了 `minSteps`，没有带 `maxSteps`；前端重建本地 reducer 时仍保留 `maxSteps` 为空。
- 根本机制：固定两步 copy 交互本应选“源骰 + 目标骰”后自动提交；前端缺少自动提交上限后，`useMultistepInteraction` 无法在第二步触发提交，玩家只能取消并重复打牌。
- 修复：新增 `src/games/dicethrone/ui/clientDiceMultistepInteraction.ts`，把 Dice Throne 多步骰子交互重建逻辑集中起来；对非手动确认的 `modifyDie` 模式补 `maxSteps = explicitMaxSteps ?? selectCount`，保留 `any / adjust` 手动确认模式不变。`Board.tsx` 改为调用该重建入口。
- 回归保护：新增 `src/games/dicethrone/ui/__tests__/clientDiceMultistepInteraction.test.ts`，覆盖线上 `card-me-too` 只有 `minSteps` 时补 `maxSteps=2`，并生成两条 `MODIFY_DIE` 命令；同时覆盖 `adjust` 模式不会自动提交。

## 系统反馈：`TRANSFER_STATUS` 等待对方响应

- 现实影响：在线 AI 在自己的主阶段打出“乾坤大挪移”后进入状态转移交互，但同一时刻还开着真人玩家的响应窗口；AI 直接提交状态转移命令会被响应窗口拦住，导致 watchdog 重复恢复失败。
- 真实证据：诊断包 `matchId: 1ov_hoAsyGg`，`phase: main1`，`currentPlayerId: 1`，当前交互是 AI 座位 `1` 的 `dt:card-interaction / card-transfer-status`，响应窗口是 `afterCardPlayed / card-transfer-status`，当前响应者是真人座位 `0`。
- 触发条件：AI legal actions 里确实有 3 个 `TRANSFER_STATUS`，但当前响应窗口的响应者不是 AI；命令失败原因是“等待对方响应”。
- 根因层级：这是在线 AI 恢复顺序问题，不是 Dice Throne 状态转移规则本身无目标。正确顺序是 AI 当前阶段被真人响应窗口卡住时，先强制关闭响应窗口，再让 AI 继续自己的交互或后续阶段。
- 当前代码覆盖：`resolveForceEndTurnForStalledAi` 已覆盖“AI 可见交互被 human 响应窗口挡住”场景，会返回 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，且不会发送 `RESPONSE_PASS` 或直接执行 `TRANSFER_STATUS`。
- AI-only guard：只有当前阶段归 AI 座位时才强制关闭；human 自己回合且 human 在响应时，自动和手动恢复都返回空，不替真人选择。

## 验证

- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\ui\__tests__\clientDiceMultistepInteraction.test.ts src\games\dicethrone\ui\__tests__\DiceTray.test.tsx --configLoader native`
  - 2 files passed / 15 tests passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\engine\transport\__tests__\onlineAiRecovery-gameover.test.ts src\engine\transport\__tests__\onlineAiRecoveryCandidateResolver.test.ts --configLoader native`
  - 2 files passed / 64 tests passed。

## 状态回写建议

- `6a8aa705a857fa79e4f212fd`、`6a8a8400a857fa79e4f210a1`：`resolved`，说明“已修复固定两步选骰交互，选择源骰和目标骰后会自动提交并结算；本次未部署。”
- `6a8af702446de293e25ff9fe`、`6a8af703446de293e25ffa06`、`6a8aa1d1a857fa79e4f21221`、`6a8af704446de293e25ffa0e`：`resolved`，说明“当前代码已覆盖 AI 当前阶段被真人响应窗口挡住的恢复顺序：先关闭响应窗口，再继续 AI 交互；本次未部署。”
