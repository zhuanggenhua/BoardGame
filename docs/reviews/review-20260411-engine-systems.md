# 代码审查报告：引擎系统/响应窗口/交互链

日期：2026-04-11  
审查人：AI（code-reviewer 汇总）

## 审查范围
- `src/engine/systems/InteractionSystem.ts`
- `src/engine/systems/ResponseWindowSystem.ts`
- `src/engine/systems/resolutionStack.ts`
- 相关交互链路（SmashUp afterScoring 依赖）

## 结论
发现 2 个高风险问题、1 个中风险问题；已在本次改动中修复，但 SmashUp afterScoring 回归测试仍有 1 条失败需确认。

## 发现的问题

### [HIGH] afterScoring 延迟事件链式传递丢失
- **证据**：`resolveInteraction` 未再传递 `_deferredPostScoringEvents`  
  - `src/engine/systems/InteractionSystem.ts:696-724`
- **影响**：当有多个 afterScoring 交互链（如海盗湾/大副等）时，延迟事件只保留在第一个交互，后续交互丢失，导致 BASE_CLEARED/BASE_REPLACED 等事件漏发。
- **修复**：在 `resolveInteraction` 中恢复延迟事件转移逻辑，且仅在下一个交互未设置时复制，避免覆盖。

### [HIGH] 响应窗口关闭后清掉交互阻塞
- **证据**：`closeResponseWindow` 仅同步 responseWindow block，未重新同步交互 block  
  - `src/engine/systems/ResponseWindowSystem.ts:185-198`
- **影响**：若响应窗口关闭后仍有 `interaction.current`，resolution block 会被清空，Flow/auto-advance 可能在交互未完成时推进。
- **修复**：`closeResponseWindow` 在清掉 responseWindow 后，补做 `syncActiveResolutionWithInteraction`。

### [MEDIUM] multi.min + emergency skip 被降级逻辑压掉
- **证据**：`resolveInteraction` / `refreshInteractionOptions` 在 `freshOptions.length < multi.min` 时保留旧选项，哪怕已生成 emergency skip  
  - `src/engine/systems/InteractionSystem.ts:743-748`  
  - `src/engine/systems/InteractionSystem.ts:1050-1056`
- **影响**：当刷新后只剩 emergency skip（例如最小选项不可达）时，旧选项会被保留，导致“已不可选的选项仍展示”，且 emergency skip 丢失。
- **修复**：检测到 emergency skip 时允许刷新落地，避免降级覆盖。

## 验证
- `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/engine/systems/__tests__/InteractionSystem.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` **失败 1 条**
  - 失败用例：`base_greenhouse: 应先换基地，再把牌库随从打到新基地`
  - 实际事件多了 `su:ability_feedback`（期望事件列表未包含）

## 建议
- **COMMENT**：核心修复已完成，但 `afterscoring-window-skip-base-clear` 存在 1 条失败，需要确认是否应更新断言或修复额外事件。
