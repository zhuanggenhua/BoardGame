# SmashUp 线上反馈 `6a143f93` 鲜血领主 `minionDefId` 修复证据

## 反馈来源

- 来源类别：线上 Mongo 直读
- 连接入口：`ssh admin@8.148.71.102` -> `docker exec boardgame-mongodb mongosh boardgame`
- 数据库 / collection：`boardgame.feedbacks`
- 查询时间：`2026-05-25T15:17:31.291Z`
- 查询条件：`status in ["open", "in_progress"]`，`gameName = "smashup"`，`errorContext.message` 包含 `minionDefId is not defined`

## 覆盖反馈

- `6a1180e8ec9ada4841ed5a5d`
- `6a11811dec9ada4841ed5a76`
- `6a128725ec9ada4841ed5e15`
- `6a1287deec9ada4841ed5e22`
- `6a12cfe3ec9ada4841ed65e2`
- `6a143f9394b5e7f2607c23a1`
- `6a143f9994b5e7f2607c23a3`
- `6a143fae94b5e7f2607c23a5`

## 原始症状

- 玩家命令失败：`[system][command-failed] SYS_INTERACTION_RESPOND pipeline_error: minionDefId is not defined`
- watchdog 恢复失败：`visible-interaction:recover-interaction:legal_action_command_failed:SYS_INTERACTION_RESPOND:pipeline_error: minionDefId is not defined`
- 生产快照显示当前交互为 `smashup_reaction_choose`，触发源为 `vampires_ancient_lord`，触发事件为随从获得力量指示物。

## 根因

`queueVampireAncientLordSpecialInteraction` 在构造 `skip/store/store-and-play` 选项时写入 `minionDefId`，但函数参数中没有接收该变量，导致玩家或 watchdog 对鲜血领主反应选项执行 `SYS_INTERACTION_RESPOND` 时抛出 `ReferenceError`。

## 修复

- `src/games/smashup/abilities/titans.ts`
  - 为 `queueVampireAncientLordSpecialInteraction` 增加 `minionDefId` 参数。
  - 从 `ctx.triggerMinion.defId` 传入真实目标随从定义 ID。

## 回归验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 -t "6a143f93"` -> 1 passed
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 -t "鲜血领主"` -> 4 passed
- `npx eslint src/games/smashup/abilities/titans.ts src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors, 3 existing warnings in `titans.ts`

## 状态说明

本轮只完成本地代码修复、定向回归与 evidence 留档。线上 HTTP 反馈接口 `/feedback/open` 返回 404；生产 Mongo 直写状态属于越过业务接口的正式写路径，未在本轮擅自执行。
