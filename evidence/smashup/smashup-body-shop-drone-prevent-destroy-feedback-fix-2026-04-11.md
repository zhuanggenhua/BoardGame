# 大杀四方：尸体商店 + 雄蜂防止消灭反馈修复（2026-04-11）

> 2026-05-23 失效说明：
> 本文原“只有在消灭最终确认后才进入指示物分配”的规则结论已失效。用户已明确裁定：`尸体商店` 文案是句号分句，不应默认脑补“若如此 / if you do”。因此，防止消灭或改为移动并不取消第二句分配；当前文档仅保留 2026-04-11 当时修复“提前入队导致错链”的历史背景，规则口径以后续实现与新验证为准。

## 反馈信息
- 反馈 ID：69d91c4f70d52ddbd0c19613
- 标题：使用《尸体商店》消灭自己的随从来放置+1指示物时选择用雄蜂移除指示物代替消灭，结果依旧会消灭掉
- 游戏：smashup（大杀四方）

## 问题结论
**属实**。雄蜂“防止消灭”交互出现后，《尸体商店》仍提前进入指示物分配队列，导致玩家选择防止消灭后目标随从依然被消灭，且分配交互顺序与规则不一致。

## 根因摘要
- 《尸体商店》在选择牺牲目标时**立即入队** `frankenstein_body_shop_distribute` 交互。
- 雄蜂防止消灭依赖 `processDestroyTriggers` 的 pendingSave 机制：消灭事件被暂缓，待玩家选择是否防止后再决定是否真正消灭。
- 因分配交互提前排队，**消灭是否确认尚未完成**时就进入分配流程，最终导致“防止消灭”与“分配 +1 指示物”并发/错链，出现“已防止但仍消灭”的结果。

## 修复方案
1. **延迟分配交互创建**：
   - 《尸体商店》不再直接 `queueInteraction` 分配交互，而是把 `{ playerId, targetMinionUid, totalCounters }` 写入 `sys._pendingBodyShopDistributions`。
2. **消灭确认后再补发分配**：
   - 在 SmashUp 事件系统中，当检测到目标 `MINION_DESTROYED`（且未被 save/return/move 替代）时，才 materialize 分配交互或直接放置指示物。
3. **防止成功时清理 pending**：
   - 雄蜂选择“防止消灭”后，移除对应 pending 条目，确保不会再进入分配流程。

## 关键改动
- `src/games/smashup/abilities/frankenstein.ts`
  - 新增 `_pendingBodyShopDistributions` 缓存结构
  - 《尸体商店》先触发 destroy，再挂起分配
- `src/games/smashup/domain/systems.ts`
  - 基于最终事件流判定是否补发分配交互
  - 修正事件类型判断使用 `SU_EVENT_TYPES`
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - 新增两条用例覆盖“防止消灭”与“跳过防止”的分支

## 验证记录
- 通过定向单测：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native -t "尸体商店"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native -t "雄蜂：选择防止消灭时|雄蜂：选择跳过时"`
- ESLint：
  - `npx eslint src/games/smashup/abilities/frankenstein.ts src/games/smashup/domain/systems.ts src/games/smashup/__tests__/newFactionAbilities.test.ts --quiet`

## 结论（已失效）
2026-04-11 当时的工程修复结论是：避免在防止消灭选择前提前入队分配交互。

其中“只有在消灭**最终确认**后才进入指示物分配流程；当雄蜂成功防止消灭时，不再触发分配交互”这一**规则层结论已于 2026-05-23 被推翻**，不得继续作为当前规则依据引用。
