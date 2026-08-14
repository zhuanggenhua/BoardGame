# DiceThrone AI 交互审计（2026-04-11）

## 审计范围
- AI 交互入口与兜底：`src/games/dicethrone/ai.ts`
- 交互状态系统与收口：`src/games/dicethrone/domain/systems.ts`、`src/games/dicethrone/domain/execute.ts`
- 交互合法性与状态可选性：`src/games/dicethrone/domain/commandValidation.ts`
- 在线 AI watchdog / 强制推进：`src/engine/transport/onlineAiRecovery.ts`、`src/engine/transport/server.ts`

## 权威来源
- `.spec/knowledge/standards/testing-audit.md`（D3/D5/D8/D15/D39 维度）
- `src/games/dicethrone/domain/core-types.ts`（交互类型定义）
- `src/games/dicethrone/rule/*.md`（交互语义与阶段规则）

## 逐项结论（交互链 × 关键维度）

### 1) simple-choice / compare-roll-choice 交互
- **D5 交互完整**：AI 对 `simple-choice`/`compare-roll-choice` 都能生成响应动作；禁用选项会被过滤。
- **D39 卡死兜底**：`simple-choice` 在可选项为空且 `min>0` 时会下发 `SYS_INTERACTION_CANCEL`；`compare-roll-choice` 无可选项时走 `SYS_INTERACTION_CONFIRM`。
- **D8 时序正确**：交互命令由 InteractionSystem 处理，确认/取消均可推进。
- 证据：`src/games/dicethrone/ai.ts`（`buildInteractionActions`）

### 2) dt:card-interaction（selectPlayer / selectStatus / selectTargetStatus）
- **D5 交互完整**：AI 覆盖三种交互类型，并生成 `RESOLVE_INTERACTION` / `REMOVE_STATUS` / `TRANSFER_STATUS`。
- **D3 数据流闭环**：交互由 `systems.ts` 创建 → AI 选择 → `execute.ts` 完成 `INTERACTION_COMPLETED` → `systems.ts` resolve。
- **D39 兜底**：目标玩家/状态集合为空时，AI 会 `SYS_INTERACTION_CANCEL`，避免卡死。
- **D8 时序正确**：`selectPlayer` 结算补发 `INTERACTION_COMPLETED`，避免 custom action 无事件导致交互不收口。
- 证据：`src/games/dicethrone/ai.ts`、`src/games/dicethrone/domain/execute.ts`、`src/games/dicethrone/domain/systems.ts`

### 3) multistep-choice（骰子重掷/修改）
- **D5 交互完整**：AI 对 `selectDie`/`modifyDie` 生成 `REROLL_DIE`/`MODIFY_DIE` + `SYS_INTERACTION_CONFIRM`。
- **D39 兜底**：无可选骰时自动 `SYS_INTERACTION_CANCEL`。
- 证据：`src/games/dicethrone/ai.ts`

### 4) Response Window / Token 响应
- **D5 交互完整**：有响应窗口时必有 `RESPONSE_PASS`；存在 token 响应时必有 `SKIP_TOKEN_RESPONSE`。
- **D39 兜底**：online-ai-watchdog 对连续失败的响应窗口（且队列全 AI）会 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`。
- **D8 时序**：响应窗口处理后，强制推进只在 AI 角色上触发，避免影响真人。
- 证据：`src/games/dicethrone/ai.ts`、`src/engine/transport/server.ts`、`src/engine/transport/onlineAiRecovery.ts`

### 5) 行为循环检测（卖牌/撤销/弃牌等）
- **D39 兜底**：online-ai-watchdog 在 `main1/main2/discard/income/upkeep` 监测重复/交替动作并触发 `ADVANCE_PHASE`。
- **风险**：`UNDO_SELL_CARD`/`DISCARD_CARD` 未进入 ActionLog 时，循环检测可能仅感知到 `SELL_CARD`，触发滞后。
- **建议**：补 ActionLog 记录或补充 AI 行为历史，用于更快识别“卖↔撤销/弃↔撤销”循环。
- 证据：`src/engine/transport/onlineAiRecovery.ts`、`src/games/dicethrone/game.ts`

## 发现的问题 / 风险清单
1. **行动循环检测依赖 ActionLog**：`UNDO_SELL_CARD`/`DISCARD_CARD` 未记录，可能导致循环识别滞后（D39）。
   - 建议：补 ActionLog 条目或在 watchdog 中引入命令历史/交互 fingerprint。

## 已验证证据
- 详见 `evidence/dicethrone/dicethrone-ai-stall-fixes-e2e-test.md`（响应窗口卡死兜底 E2E 证据）。

## 未覆盖风险
- 非常规交互链（自定义新交互类型）若未在 AI 中登记，仍可能出现“有交互但无动作”的风险。
- 依赖 ActionLog 的循环检测仍需扩充覆盖范围。

## 2026-04-11 第二轮追加审计（DiceThrone 只读复盘）

### 本轮追加审计范围
- `src/games/dicethrone/ai.ts`
- `src/games/dicethrone/game.ts`
- `src/games/dicethrone/domain/systems.ts`
- `src/games/dicethrone/domain/commandValidation.ts`
- `src/games/dicethrone/domain/flowHooks.ts`
- `src/engine/transport/onlineAiRecovery.ts`
- `src/engine/transport/server.ts`
- `src/engine/systems/InteractionSystem.ts`

### 命中的维度
- **D3 数据流闭环**：AI 可选性判定与 watchdog 无解诊断口径不一致。
- **D5 交互完整**：状态移除/转移交互的“为什么无解”反馈仍可能失真。
- **D8 时序正确**：Dice 阶段循环没有进入 action-loop 检测，且 tracker 容易因 eventStream 变化重置。
- **D15 UI/交互状态同步**：simple-choice 仍主要使用创建时快照，尚未接入 live refresh。
- **D39 卡死/流程控制**：discard / sell / undo / confirm / selectAbility 一类循环仍有漏检面。

### 新增发现 1：经济循环检测仍不完整，Dice 阶段循环更是完全未进入 action-loop 监测
**证据链**
- `src/engine/transport/onlineAiRecovery.ts:158-186`：`AI_LOOP_PHASES` 只覆盖 `main1/main2/discard/income/upkeep`。
- `src/engine/transport/onlineAiRecovery.ts:160-205`：循环识别只读取 `sys.actionLog.entries` 的最近 kind。
- `src/games/dicethrone/game.ts:247-273`：当前 formatter 明确只为 `SELL_CARD` 追加 ActionLog 条目；未见 `DISCARD_CARD` / `UNDO_SELL_CARD` 分支。
- `src/games/dicethrone/ai.ts:1636-1648,1772-1779`：AI 在 `discard` 阶段会发 `DISCARD_CARD`，在主阶段会发 `UNDO_SELL_CARD`。
- `src/engine/transport/server.ts:858-918`：watchdog tracker key 依赖 `buildAiProgressMarker()`；只要 eventStream id 变化，就可能被视为新进度重新起计时。

**审计结论**
- `SELL_CARD ↔ UNDO_SELL_CARD` / `DISCARD_CARD` 相关循环目前只能部分被看见；
- `offensiveRoll / targetingRoll / defensiveRoll` 内部的有效命令循环（如选技能、确认骰面、锁骰反复）根本不在 `action-loop` 相位白名单内；
- 因为这些循环通常会持续产生 eventStream 新事件，`active-turn` 恢复计时会不断被 progress marker 刷新，存在“永远卡着但 watchdog 总觉得有进度”的结构性风险。

**建议修复文件**
- `src/engine/transport/onlineAiRecovery.ts`
- `src/engine/transport/server.ts`
- `src/games/dicethrone/game.ts`

**建议方向**
1. 把 loop 检测从“只看 ActionLog”升级为“命令历史 / 行为指纹”。
2. 把 dice 相关 phase 纳入循环识别；对 `CONFIRM_ROLL / SELECT_ABILITY / TOGGLE_DIE_LOCK / RESPONSE_PASS / SKIP_TOKEN_RESPONSE` 建稳定 fingerprint。
3. 若短期继续依赖 ActionLog，则必须补 `DISCARD_CARD` / `UNDO_SELL_CARD` 条目。

### 新增发现 2：无解交互的自动反馈并未完全携带“为什么不能选”，尤其是不可移除状态场景
**证据链**
- `src/games/dicethrone/ai.ts:509-533`：AI 只把 removable 的 status/token 视为可选项。
- `src/games/dicethrone/ai.ts:1137-1138`：`selectTargetStatus` 遇到不可移除状态时直接走 `empty-options` 紧急取消。
- `src/engine/transport/onlineAiRecovery.ts:44-49,425-499`：watchdog 的 `hasAnyStatusOrToken()` / `resolveUnsatisfiableReasonFromInteraction()` 只检查“是否有任意 status/token”，未复用 removable 过滤。
- `src/games/dicethrone/domain/systems.ts:398-415`：系统层前置“有无状态”检查已经是 removable-aware，说明当前至少存在三套口径：systems / ai / watchdog。

**审计结论**
- 当某个交互之所以无解，是因为目标只剩“不可移除”的状态/Token 时：
  - AI 会视为无解并取消；
  - watchdog 自动反馈可能看见“还有状态”，从而不给出准确 reason。
- 这会直接削弱用户要的“自动反馈为什么无法选择”的价值。

**建议修复文件**
- `src/engine/transport/onlineAiRecovery.ts`
- `src/games/dicethrone/ai.ts`
- `src/games/dicethrone/domain/systems.ts`

**建议方向**
1. 把 removable 判定提成共享 helper，AI / systems / watchdog 统一使用。
2. 自动反馈 reason 至少新增：`only-nonremovable-options` / `source-status-nonremovable` 之类的细分原因。
3. 补 server 测试：构造“只剩不可移除状态”的 `dt:card-interaction`，断言上报 reason 正确。

### 新增发现 3：DiceThrone 生产路径下尚未启用 simple-choice 动态刷新，属于已知结构性未覆盖风险
**证据链**
- `src/games/dicethrone/domain/systems.ts:268-293`：`CHOICE_REQUESTED` 直接把 `payload.options` 快照映射成 `createSimpleChoice(...)`。
- `src/engine/systems/InteractionSystem.ts:163-169,691-738,1001-1045`：引擎层已支持 `optionsGenerator / autoRefresh / responseValidationMode='live'`，并能在交互弹出/响应时重算候选。
- 本轮检索 `src/games/dicethrone/**` 生产代码，未见 DiceThrone 使用这些能力。

**审计结论**
- 当前 DiceThrone 大多数 simple-choice 仍是“创建时快照”。
- 在常规单步流程里问题不一定立刻暴露，但一旦某条 choice 被排队到后面，或其候选依赖可变状态（资源/目标/Token/玩家列表），就存在“交互弹出来了，但选项已过期”的结构性风险。
- 这条目前记为**未覆盖风险**，不是已复现 bug；但它正好命中用户要求重点关注的“交互选项动态刷新”。

**建议修复文件**
- `src/games/dicethrone/domain/systems.ts`
- `src/engine/systems/InteractionSystem.ts`（若需要补更细的刷新挂钩）

**建议方向**
1. 给依赖运行时状态的 choice 显式标注 `responseValidationMode: 'live'`。
2. 对目标列表、资源额度、可移除状态这类候选，补 `optionsGenerator` 或 declarative refresh metadata。
3. 补 1 条回归：先制造前置交互/连锁状态变化，再断言后弹出的 choice 已按最新 core 重算。

### 本轮新增未覆盖风险
1. 未看到覆盖“Dice 阶段有效命令循环仍被 watchdog 收敛”的服务端测试。
2. 未看到覆盖“不可移除状态导致 AI 无法选择时，自动反馈 reason 正确”的测试。
3. 未看到 DiceThrone 生产路径对 `optionsGenerator / autoRefresh` 的回归样例。

### 需主代理优先修复的文件与建议
1. `src/engine/transport/onlineAiRecovery.ts`
   - 扩大循环检测面；
   - 统一无解诊断与 removable 语义。
2. `src/engine/transport/server.ts`
   - 收紧 tracker reset 条件，不要把 eventStream 自增直接等同于“有效进度”。
3. `src/games/dicethrone/game.ts`
   - 补 `DISCARD_CARD` / `UNDO_SELL_CARD` ActionLog，或明确让 watchdog 脱离 ActionLog。
4. `src/games/dicethrone/domain/systems.ts`
   - 为 simple-choice 桥接补 live revalidate / optionsGenerator。
