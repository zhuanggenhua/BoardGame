# 王权骰铸 AI 卡死历史专项审计（响应窗口/强制推进/无解交互）

> 2026-06-06 当前有效口径：本文只对应 2026-04-11 那轮围绕 `response window / force skip / 无解交互` 的 AI 卡死专项审计，不是当前 DiceThrone online AI/watchdog 总收口文档，也不是新英雄补审出口。阅读时必须把它理解成历史专项审计与当时验证留档。

## 审计范围
- AI 卡死兜底链路（online-ai-watchdog 强制推进/响应跳过）
- `CONFIRM_ROLL → RESPONSE_WINDOW_OPENED → RESPONSE_PASS → ADVANCE_PHASE` 交互链
- 无解交互自动反馈（unsatisfiable-interaction）
- 仅针对 `dicethrone` 与引擎 transport 层 AI 恢复链路

**涉及文件：**
- `src/games/dicethrone/domain/execute.ts`
- `src/games/dicethrone/domain/commandValidation.ts`
- `src/games/dicethrone/domain/rules.ts`
- `src/engine/transport/onlineAiRecovery.ts`
- `src/engine/transport/server.ts`

## 权威来源
- 本轮用户复现与需求描述（AI 卡死/响应循环/无解交互自动反馈）
- Dice Throne 规则注释（规则 4.4 终极技能行动锁定，见 `rules.ts` 注释）
- 项目审计规范：`.spec/knowledge/standards/testing-audit.md`

## 选定维度与理由
- **D5 交互完整**：响应窗口与交互链是否完整可达、可关闭。
- **D8 时序正确**：确认骰面后响应窗口触发与 rollConfirmed 状态时序。
- **D9 幂等与重入**：重复确认骰面是否会引发重复响应窗口/音效循环。
- **D39 操作后卡住**：无解交互/响应窗口卡死是否能自动推进。
- **D3 数据流闭环**：交互状态 → 取消/反馈 → 诊断上报的闭环完整性。

## 逐项结论（按交互链）

### 1) `CONFIRM_ROLL` → 响应窗口 → 跳过关闭 → 继续推进
**结论：✅ 通过（已修复幂等）**
- 证据：
  - `execute.ts`：`CONFIRM_ROLL` 先生成 `ROLL_CONFIRMED`，再基于 `stateAfterConfirm` 判断响应窗口，避免时序错误（D8 ✅）。
  - `commandValidation.ts`：新增 `rollConfirmed` 幂等校验，避免重复确认导致响应窗口反复打开（D9 ✅）。
  - `onlineAiRecovery.ts`：响应窗口 responder 轮到 AI 时会执行 `RESPONSE_PASS`，并跟进 `ADVANCE_PHASE`（D5/D39 ✅）。

### 2) 无解交互自动跳过 + 反馈原因
**结论：✅ 通过（已补全原因推断）**
- 证据：
  - `onlineAiRecovery.ts`：无可选项时 `SYS_INTERACTION_CANCEL`，且可携带 `reason`。
  - `server.ts`：`CANCELLED` 事件会生成 `unsatisfiable-interaction-auto-skipped` 反馈，新增基于 `selectability` 的原因推断（D3/D39 ✅）。

### 3) 强制推进只作用 AI，不影响真人
**结论：✅ 通过**
- 证据：
  - `resolveForceEndTurnForStalledAi`/`resolveForceEndTurnRecoveryStep` 仅对 `seatControllers[playerId].type !== 'human'` 生效（D39 ✅）。
  - `resolveCurrentPlayerId` 强制要求当前回合属于 AI，避免“代替真人执行命令”（D5 ✅）。

## 维度检查明细（✅/❌ + 证据）

| 维度 | 结论 | 证据 |
|---|---|---|
| D5 交互完整 | ✅ | `execute.ts` 响应窗创建；`onlineAiRecovery.ts` 响应跳过/推进 |
| D8 时序正确 | ✅ | `execute.ts` 使用 `stateAfterConfirm` 决定响应窗口 |
| D9 幂等与重入 | ✅ | `commandValidation.ts` `rollConfirmed` 防重复确认 |
| D39 操作后卡住 | ✅ | `onlineAiRecovery.ts` 强制跳过/推进；`server.ts` 反馈 |
| D3 数据流闭环 | ✅ | `server.ts` 反馈携带 selectability 诊断与 reason |

## 问题清单（文件 + 修复方案）

1. **已修复**：无解交互取消时 `reason` 为空导致不上报  
   - 文件：`src/engine/transport/server.ts`  
   - 修复：基于 `InteractionSelectabilityDiagnostic` 推断 `empty-options / all-options-disabled / min-selection-unreachable` 并上报  

## 验证证据
- E2E 用例：`Online 2-player afterRollConfirmed: response pass should not reopen window after repeated confirm`
  - 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player afterRollConfirmed: response pass should not reopen window after repeated confirm"`
  - 截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterRollConfirmed-response-pass-should-not-reopen-window-after-repeated-confirm\04-two-player-after-roll-response-open.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterRollConfirmed-response-pass-should-not-reopen-window-after-repeated-confirm\05-two-player-after-roll-response-closed.png`
- E2E 用例：`Online 2-player afterAttackResolved: response pass should close and not reopen`
  - 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player afterAttackResolved: response pass should close and not reopen"`
  - 截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-response-pass-should-close-and-not-reopen\06-two-player-after-attack-response-open.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-response-pass-should-close-and-not-reopen\07-two-player-after-attack-response-closed.png`
- E2E 用例：`Online 2-player afterCardPlayed: response pass should close and not reopen`
  - 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player afterCardPlayed: response pass should close and not reopen"`
  - 截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterCardPlayed-response-pass-should-close-and-not-reopen\08-two-player-after-card-response-open.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterCardPlayed-response-pass-should-close-and-not-reopen\09-two-player-after-card-response-closed.png`
- 证据文档：`evidence/dicethrone/dicethrone-ai-stall-e2e-test.md`

## 未覆盖风险
- 其他 responseWindow 类型（如 `afterAttackResolved`、`afterCardPlayed`）仍需专项卡死场景回归。
- 非 `simple-choice`/`dt:card-interaction` 的交互类型，若 UI 层规则改变，需更新 `selectability` 推断逻辑。

## 修订记录
- 2026-04-11：新增专项审计文档；补全无解交互 reason 推断。

---

**当前阅读说明**：本文只能证明当时这批 `response-window / force-skip / 无解交互` 卡死问题曾被专项核对和验证，不能外推成当前 DiceThrone AI/watchdog 全链路已经无残余。
