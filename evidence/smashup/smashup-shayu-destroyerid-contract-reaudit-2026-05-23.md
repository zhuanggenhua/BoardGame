# SmashUp shayu destroyerId 共享合同补审（2026-05-23）

## 结论等级

- 本文是 **destroyerId / onMinionDestroyed 共享归因专项补审**，不是重新宣称 shayu 全量全面审计完成。
- 本轮结论：**shayu 新派系中依赖 destroyerId 的对象已完成专项补审并补齐否定链证据；旧 destroy trigger 收口结论已按本文回写降级后重新收口。**

## 触发原因

用户反馈：`sharks_mako` 在没有明确“谁消灭了随从”的情况下，也会直接触发额外打出。

排查结果：

- 不是数据录入问题。
- 不是 `sharks_mako` 自身 trigger 条件写错。
- 真正根因在共享 destroy 后处理：`src/games/smashup/domain/reducer.ts` 旧逻辑会把缺失 `destroyerId` 的消灭事件兜底成当前操作者/目标控制者，误把“中性或未归因消灭”当成“你消灭了它”。

## 权威来源

1. 规则/文案：
   - `public/locales/zh-CN/game-smashup.json`
   - `src/games/smashup/data/factions/sharks.ts`
2. 实现：
   - `src/games/smashup/abilities/sharks.ts`
   - `src/games/smashup/domain/reducer.ts`
3. 旧审计入口：
   - `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`
   - `evidence/smashup/smashup-shayu-full-chain-audit-2026-05-12.md`
   - `evidence/smashup/smashup-shayu-faction-audit.md`

## 本轮对象清单

只纳入 shayu 三派系与 6 基地中**真正依赖 destroyerId 归因**的对象：

| 对象 | 依赖点 | 是否依赖 destroyerId | 结论 |
| --- | --- | --- | --- |
| `sharks_mako` | `onMinionDestroyed` 后“你消灭后”额外打出 | 是 | 本轮主修复对象；已补正向 + 否定链。 |
| `base_shark_reef` | “摧毁这里仆从的玩家”可给自己随从 +1 | 是 | 已补正向 + 缺失 destroyerId 否定链。 |
| `sharks_hammerhead` | 本基地有仆从被消灭后自身 +1 | 否 | 只依赖 destroy 发生；本轮复核无需补改。 |
| `sharks_chum` | 本基地任意仆从被消灭后宿主 +1 | 否 | 只依赖 destroy 发生；本轮复核无需补改。 |
| `sharks_blood_in_the_water` | 本基地有仆从被消灭后额外打 3- | 否 | 只依赖 destroy 发生；本轮复核无需补改。 |

结论边界：`tornados` 与 `mythic_greeks` 本批没有直接消费 `destroyerId` 的对象，本轮只做排除式复核，不强行扩成无关专项。

静态排查证据：

- `src/games/smashup/abilities/tornados.ts`：无 `destroyerId` / `onMinionDestroyed` 消费点。
- `src/games/smashup/abilities/mythic_greeks.ts`：无 `destroyerId` / `onMinionDestroyed` 消费点。
- `src/games/smashup/abilities/sharks.ts`：本批 `onMinionDestroyed` 家族全部落在 `sharks_hammerhead`、`sharks_chum`、`sharks_blood_in_the_water`、`sharks_mako`、`base_shark_reef`。

## 共享链反查

### `sharks_mako`

- 文案语义：只有“**你**消灭了一个随从”才应触发。
- trigger 实现：`src/games/smashup/abilities/sharks.ts` 中 `sharksMakoTrigger`
  - 已显式要求 `ctx.destroyerId !== undefined`
  - 真正消费的是 `ctx.destroyerId` 和 `ctx.baseIndex`
- 旧漏审点：审计只证明了“有 destroyerId 时可触发”，没有反查到共享 reducer 在 `ctx.destroyerId` 进入 trigger 前就已经被错误兜底。

### `base_shark_reef`

- 文案语义：只有“摧毁这里仆从的玩家”才能选自己随从放 +1。
- base ability 实现：`src/games/smashup/abilities/sharks.ts` 中 `baseSharkReef`
  - 已显式要求 `ctx.destroyerId`
  - 目标候选限定为 `controller === destroyerId`
- 旧漏审点：审计只证明了显式 destroyerId 时归属正确，没有补“缺失 destroyerId 时不应错误给当前玩家 prompt”。

### 共享根因

- 文件：`src/games/smashup/domain/reducer.ts`
- 修复点：`processDestroyTriggers` 内 `destroyerId` 归因
- 新口径：`you destroyed` 类触发只信任事件显式声明的 `destroyerId`；缺失时按“无明确消灭者”处理，不做当前玩家兜底。

## 修复与测试

### 代码修复

- `src/games/smashup/domain/reducer.ts`
  - 删除 `eventDestroyerId` 缺失时 fallback 到当前操作者/目标控制者的逻辑。

### 新增/补强回归

- `src/games/smashup/__tests__/abilities/sharks.test.ts`

| 用例 | 覆盖对象 | 证明内容 |
| --- | --- | --- |
| `灰鲭鲨在消灭被防止时不会错误出现额外打出提示` | `sharks_mako` | 被防止的 destroy 不应触发。 |
| `灰鲭鲨不会把缺少 destroyerId 的消灭事件默认算成当前玩家消灭` | `sharks_mako` | 缺失 destroyerId 的 destroy 不应触发。 |
| `鲨鱼领地不会把缺少 destroyerId 的消灭事件默认算成当前玩家触发` | `base_shark_reef` | 缺失 destroyerId 的 destroy 不应给当前玩家 prompt。 |
| `鲨鱼领地按 destroyerId 让消灭者给自己的任意随从放置指示物` | `base_shark_reef` | 显式 destroyerId 的正向归属链成立。 |

## 审计维度命中

- `D8`：共享 reducer 真实状态/触发链行为错误。
- `D12`：只看事件发射/卡牌自身 trigger 不足，必须看最终触发消费。
- `D18`：否定链缺失，旧审计只覆盖正向链。
- `D40`：共享事件上下文在后处理阶段被错误兜底，属于共享消费合同问题。
- `D49`：必须从共享消费点反查 `destroyerId`，不能只看定义层字段存在。

## 旧结论失效与回写

已回写：

- `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`
- `evidence/smashup/smashup-shayu-full-chain-audit-2026-05-12.md`
- `evidence/smashup/smashup-shayu-faction-audit.md`

回写口径：

1. 旧 `sharks_mako` 结论降级为“只证明了显式 destroyerId 的正向链”。
2. 旧 `base_shark_reef` 结论降级为“只证明了显式 destroyerId 的正向归属”。
3. 旧 destroy trigger 家族“destroyer/基地上下文已收口”结论降级为“缺失 destroyerId 的否定链当时未审到”，并由本文替换。

## 验证记录

- `npx vitest run src/games/smashup/__tests__/abilities/sharks.test.ts`
- `npx vitest run src/games/smashup/__tests__/abilities/giant-ants.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts src/games/smashup/__tests__/madMonsterPartyPreventedDestroy.test.ts src/games/smashup/__tests__/feedback-high-ground-destroyer.test.ts`

实际结果：

- `src/games/smashup/__tests__/abilities/sharks.test.ts` → 15 passed
- 共享 destroyerId 相关 4 个文件：
  - `giant-ants.test.ts`
  - `reactionQueueDestroyerId.test.ts`
  - `madMonsterPartyPreventedDestroy.test.ts`
  - `feedback-high-ground-destroyer.test.ts`
  → 合计 35 passed
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-shayu-factions.e2e.ts "Sharks 灰鲭鲨不会把火焰陷阱的无归因消灭误判成自己消灭"` → 1 passed

浏览器级补证：

- 用对手的 `Flame Trap / 火焰陷阱` 从真实入场链制造**缺失 destroyerId 的消灭事件**，验证：
  - `sharks_hammerhead` 被陷阱消灭，说明 destroy 真实发生；
  - `enemy-trap` 同步自毁，说明触发链完整执行；
  - 手牌中的 `sharks_mako` 仍在手里；
  - 没有进入 `smashup_immediate_extra_minion` 额外打出窗口。
- 对应截图：
  - `shayu-sharks-mako-flame-trap-no-extra-play`

结论：

- Sharks 定向回归已实际覆盖 `Mako / Shark Reef / prevented destroy / missing destroyerId`。
- 共享 destroyerId 相关旧回归继续通过，说明本次收窄归因没有打坏 reaction queue、prevented destroy、触发器透传链。

## 当前残余范围

1. 本文只覆盖 shayu 批次 destroyerId 专项，不替代其它审计维度。
2. 本轮没有发现 `tornados` / `mythic_greeks` 新对象依赖 destroyerId；若未来新增 “you destroyed” 类对象，需要直接复用本文门禁。
3. 仓库里其他老派系仍存在若干 `destroyMinion(..., undefined, ...)` 调用点；它们不属于本轮“新派系补审”范围，但后续如继续做共享 destroy 合同治理，应单独开全局专项。
