# 大杀四方反馈修复：老詹金斯!? 计分前消灭最高随从后仍按旧战力计分（2026-04-11）

- 反馈 ID：`69d8b1bc70d52ddbd0c190ea`
- 用户原话：`计分前打出消灭最高随从，我10点对方12点，消灭后对方三点怪，但仍然算对方拿第一得分`
- 结论：**确认为真实 bug，已修复。根因是 `miskatonic_thing_on_the_doorstep` 在“并列最高力量 → 交互选择目标”分支缺少 interaction handler，导致玩家选完目标后没有真正发出 `su:minion_destroyed` 事件，后续计分仍按旧战力结算。**

## 线上事实

### 1. 生产快照证明：玩家已经完成选择，但销毁事件没有发生
生产 `eventStream` 关键序列：

- `id: 358` `su:action_played`：`miskatonic_thing_on_the_doorstep`
- `id: 359` `SYS_INTERACTION_RESOLVED`：玩家已在并列最高力量目标中选中了 `robot_hoverbot`
- `id: 360` `SYS_RESPONSE_WINDOW_CHECK_UNLOCK`
- `id: 361` `RESPONSE_WINDOW_CLOSED`
- `id: 362` `su:before_scoring_triggered`
- `id: 363` `su:base_scored`

在 `359` 与 `363` 之间，**没有**出现预期的 `su:minion_destroyed`。

### 2. 生产计分结果仍然使用了旧战力
同一条快照里的 `su:base_scored` 仍记录：

- AI：`12`
- 玩家：`10`

而用户已经在 `SYS_INTERACTION_RESOLVED` 中选中了一个并列最高力量的 3 力敌方随从；若销毁正确生效，对手应从 `12` 降到 `9`，这局应改为玩家拿第一。

## 根因定位

修复前代码路径：

1. `src/games/smashup/abilities/miskatonic.ts`
   - `miskatonicThingOnTheDoorstep()` 在并列最高力量时通过 `resolveOrPrompt(...)` 创建交互。
2. `src/games/smashup/domain/abilityHelpers.ts`
   - `resolveOrPrompt()` 只负责创建交互，不会保存内联 `resolve` 回调。
3. `src/games/smashup/domain/systems.ts`
   - `SmashUpEventSystem` 在 `SYS_INTERACTION_RESOLVED` 后只会按 `sourceId` 去 `getInteractionHandler()` 查注册表。
4. 修复前 `registerMiskatonicInteractionHandlers()` **没有**注册 `miskatonic_thing_on_the_doorstep` 的 handler。

结果就是：

- 玩家能看到选择交互
- 也能完成选择
- 但后续没有任何真实领域事件落地
- `scoreBases` 继续按旧战力结算

## 修复内容

### 1. 补回缺失的交互处理器
文件：`src/games/smashup/abilities/miskatonic.ts`

新增：

- `registerInteractionHandler('miskatonic_thing_on_the_doorstep', ...)`

处理逻辑：

- 读取玩家选中的 `minionUid / baseIndex / defId`
- 在当前状态重新定位目标
- 若目标仍存在，则发出 `destroyMinion(...)`

### 2. 补回归测试并收紧审计口径
文件：

- `src/games/smashup/__tests__/madnessPromptAbilities.test.ts`
- `src/games/smashup/__tests__/audit-interaction-chain.property.test.ts`
- `src/games/smashup/__tests__/interactionCompletenessAudit.test.ts`

新增/调整：

- 新增测试：并列最高力量时，交互解决后必须真实发出 `MINION_DESTROYED`
- 把 `miskatonic_thing_on_the_doorstep` 从交互 handler 白名单移除，避免以后再次因为“误以为 resolveOrPrompt 会自动兜底”而漏掉 handler

## 本轮验证

- `npx eslint src/games/smashup/abilities/miskatonic.ts src/games/smashup/__tests__/madnessPromptAbilities.test.ts src/games/smashup/__tests__/response-window-skip.test.ts src/games/smashup/__tests__/audit-interaction-chain.property.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --quiet`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/madnessPromptAbilities.test.ts --configLoader native -t "多个并列最高力量时，交互解决后会真正发出消灭事件"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/response-window-skip.test.ts --configLoader native`

结果：通过。

## 收口判断

这条反馈不是误解，也不是“基地锁定后仍然计分”的规则问题；真正的 bug 是：

- 交互完成了
- 销毁没执行
- 计分继续用旧战力

修复后，`老詹金斯!? / miskatonic_thing_on_the_doorstep` 的并列目标交互已经能真实落地销毁事件，可按 `resolved` 收口。
