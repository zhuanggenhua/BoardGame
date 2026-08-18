# DiceThrone：response-window 重触发（重复提示/音效循环）专项审计（2026-04-12）

> 2026-06-06 当前有效口径：本文是 2026-04-12 那轮关于 `response-window` 重触发/重复提示/音效循环的历史专项审计，不是当前 DiceThrone 所有 response-window 重开问题都已收口的证明，也不是新英雄补审出口。阅读时只能把它理解成历史链路审计文档。
>
> 2026-08-14 修订：本文旧版把“当前响应者是 human”写成 watchdog 一律不出手，这个口径过宽。当前有效口径是：human 自己回合 + human 响应窗口不出手；AI 当前阶段 + human 响应窗口应先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，再继续 AI 阶段收口，且不得替 human 发 `RESPONSE_PASS`。

## 用户现象（来自线上反馈的复述）
- 我方（human）正在响应窗口中“跳过/让过”；
- 跳过后很快又再次弹出响应提示，且 `RESPONSE_WINDOW_OPENED` 音效疑似反复播放；
- 同时偶发看到 `AI 强制结束失败 / AI 自动跳过失败` 之类提示，感知为“兜底失效/卡死”。

## 强口径事实拆解（不靠猜）

### A. watchdog 对 human 响应窗口必须分场景处理
当 responseWindow 存在且当前响应者是 human：
- 如果当前阶段属于 human，这是真人正常响应流程；watchdog 和手动强制都不得关闭窗口。
- 如果当前阶段属于 AI，这是真人响应窗口把 AI 阶段卡住；watchdog 和手动强制应先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，再继续 AI 阶段收口。
- 禁止项保持不变：任何场景都不得替 human 发 `RESPONSE_PASS` 或替 human 选择响应动作。

旧版“一律返回 null”虽然能避免误替真人 pass，但会造成 AI 阶段卡在 human 响应窗口时无法自动结束，前端强制入口也容易被误判为不可用。

**2026-08-14 已落地修正：**
- `src/engine/transport/onlineAiRecovery.ts`：human responder 分支改为先判断当前阶段归属；AI 当前阶段返回 `SYS_RESPONSE_WINDOW_FORCE_CLOSE` 候选，human 当前阶段仍返回 `null`。
- `src/engine/transport/__tests__/server.test.ts`：新增服务端协作覆盖，验证 AI 阶段先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE` 再 `ADVANCE_PHASE`，human 自己回合不动。
- `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`：新增 resolver 层覆盖，验证自动和手动恢复都遵守同一分场景口径。

### B. response-window “重触发”更可能来自 AI 行为链，而不是 UI 点击
DiceThrone 的响应窗口来源（领域事件）主要有：
- `afterRollConfirmed`（`CONFIRM_ROLL` 后打开）
- `afterCardPlayed`（对手生效的卡牌在非窗口内打出后打开）
- `afterAttackResolved`（攻击结算后条件触发打开）

如果 AI 在 roll 阶段出现“确认后又反复重掷/修改骰面”的行为，会导致多次 `CONFIRM_ROLL` 被执行，进而多次打开 `afterRollConfirmed` 响应窗口，使真人被重复打断（听到反复音效）。

**已落地的 AI 行为约束：**
- `src/games/dicethrone/ai.ts`：当 `rollConfirmed=true` 时，不再产出 `rerollDie` 类型的 `use-passive-ability` 动作。  
  口径：不改变真人规则，只减少 AI 对真人的重复打扰，要求 AI 尽量把“重掷决策”放在确认前做完。

**新增（本轮补齐）：AI 非当前响应者不再生成 response 动作**
- 旧行为：只要 `responseWindow` 存在，AI 就会产出 `RESPONSE_PASS` / `response-play-card`。  
  当当前响应者是 human 时，这些命令会被 ResponseWindowSystem 拒绝，造成“AI 一直在点/失败提示反复弹”的错觉。
- 修复：`buildResponseActions()` 增加 `currentResponderId` 判断：  
  - 仅当 **当前响应者 == AI** 时生成 `RESPONSE_PASS`；  
  - 仅当 **当前响应者 == AI** 或 **team 模式下允许 direct dice interference** 时生成 `response-play-card`；  
  - 否则直接返回空动作，不干扰真人响应。
- 已有单测用例（本轮未跑）：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`  
  用例：`本地 AI 在响应窗口但不是当前响应者时不应生成响应动作`

### C. 三类响应窗口的“去重门禁”链路（源码事实）

#### 1) afterRollConfirmed（`CONFIRM_ROLL` → `RESPONSE_WINDOW_OPENED`）
- 触发入口：`src/games/dicethrone/domain/execute.ts` → `CONFIRM_ROLL` 分支  
  - `applyEvents` 后计算 `rollSignature`  
  - `hasAfterRollConfirmedWindowBeenHandled(stateAfterConfirm, rollSignature)` 为真则不再打开
- 去重信号：
  - `rollConfirmedSequence`：`ROLL_CONFIRMED` reducer 自增  
  - `afterRollResponseWindowSequence` + `afterRollResponseWindowSignature`：在 `RESPONSE_WINDOW_OPENED` reducer 写入  
  - `buildAfterRollConfirmedSignature` 包含：骰子 id/value/symbol + turnNumber + activePlayerId

**含义**：  
同一骰面即使再次 `CONFIRM_ROLL`，签名相同也会被去重；  
只有骰面发生变化（签名变化）且再次确认时，才会重新打开窗口。

#### 2) afterCardPlayed（`PLAY_CARD`/`RESOLVE_INTERACTION` → `RESPONSE_WINDOW_OPENED`）
- 触发入口：`src/games/dicethrone/domain/executeCards.ts`  
  - 普通卡：`CARD_PLAYED` + 立即解析效果 → 检测 `hasAfterCardPlayedWindowBeenHandled(stateAfterCard)`  
  - 需要选对手卡：`RESOLVE_INTERACTION` 结束后再检测  
- 去重信号：  
  - `cardPlayedSequence`：`CARD_PLAYED` reducer 自增  
  - `afterCardResponseWindowSequence`：`RESPONSE_WINDOW_OPENED` reducer 写入  
  - `hasAfterCardPlayedWindowBeenHandled()` 仅依赖 sequence（无签名）

**含义**：  
同一张卡产生的 response-window 只开一次；  
若出现“关闭后立刻重开”，通常意味着**序列号被重置或重新触发了 CARD_PLAYED**（或同一张卡被回滚/重放）。  

#### 3) afterAttackResolved（`ATTACK_RESOLVED` → `RESPONSE_WINDOW_OPENED`）
- 触发入口：`src/games/dicethrone/domain/flowHooks.ts`  
  - 多处 `checkAfterAttackResponseWindow()`（不同攻击流程分支）  
- 去重信号：  
  - `attackResolvedSequence`：`ATTACK_RESOLVED` reducer 自增  
  - `afterAttackResponseWindowSequence`：`RESPONSE_WINDOW_OPENED` reducer 写入  
  - `checkAfterAttackResponseWindow()` 在 applyEvents 后做 sequence 对比

**含义**：  
同一次攻击结算只会打开一次 `afterAttackResolved` 窗口；  
若重复弹窗，需优先排查 **ATTACK_RESOLVED 是否重复发射** 或 **序列在 Undo/回滚后被重新触发**。
## 未覆盖项（必须继续审计）
1) 是否仍存在“AI 在确认骰面后通过其它命令链路重置 rollConfirmed，再次确认”的路径  
   - 例如：`MODIFY_DIE / DIE_REROLLED` 由**投掷方本人**触发会把 `rollConfirmed` 置回 false，随后再次 `CONFIRM_ROLL` → reopen。  
   - 当前仅约束了 AI 的 `use-passive-ability` 重掷，不排除其他链路（卡牌交互、系统交互）仍能触发该重置。  
2) 是否存在“responseWindow 在关闭后立刻被同一源事件再次打开”的领域层去重缺口  
   - 已有 sequence/signature 去重，但若出现 **Undo/回滚后序列重置** 或 **同一事件被重新发射**，仍可能复现。  
3) 音效循环是否来自 UI 侧事件消费指针问题（需要单独对 audio/eventStream consumer 做审计）。

## 本轮收口裁决（明确结论）
- **结论：未收口。**
- 原因：
  1. rollConfirmed 重置链仍可能触发 reopen，边界未完全闭环；
  2. responseWindow 去重在 Undo/回滚/重放场景下仍可能失效；
  3. 音效循环是否源于 UI 侧消费指针仍未审计。
- 口径：**2026-08-14 只收口 watchdog 分场景门禁回归；DiceThrone response-window 重触发 / 音效循环整体仍未收口。**

## 关联证据
- 引擎层统一审计：`evidence/engine/online-ai-watchdog-strong-audit-2026-04-12.md`
- DiceThrone AI 总审计：`evidence/dicethrone/dicethrone-ai-interaction-audit-2026-04-11.md`

## 2026-08-14 验证

1) watchdog 分场景门禁：
- `npx vitest run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native`
  - 54 passed，覆盖 resolver 层自动 / 手动恢复。
- `npx vitest run src/engine/transport/__tests__/server.test.ts -t "human 响应窗口" --configLoader native`
  - 2 passed，覆盖服务端实际命令序列：AI 阶段先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE` 再 `ADVANCE_PHASE`；human 自己回合不动。

2) DiceThrone AI 行为收敛（rollConfirmed=true 后不再产出重掷被动动作）：
- 旧验证仍在 `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`，本次未复跑该专项。

**当前阅读说明**：本文只能作为“response-window 重触发/重复提示/音效循环”的历史专项审计，不能外推为当前所有 response-window 重开、watchdog 误触发或 DiceThrone 当前整体审计都已收口。
