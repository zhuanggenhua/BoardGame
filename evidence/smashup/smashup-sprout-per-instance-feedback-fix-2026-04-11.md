# SmashUp 嫩芽多实例触发修复（反馈 69d9a62970d52ddbd0c196ce）

## 问题概述
- 生产反馈：两个基地同时有“嫩芽”，其中一处嫩芽不消灭却反复在回合开始打出力量≤3随从，另一处正常消灭。

## 结论与修复要点
- `killer_plant_sprout` 触发器需要按实例逐个执行，避免多实例时只触发一个或重复遍历。
- 注册触发器时启用 `perInstance: true`，并在触发器中使用 `triggerMinionUid/sourceCardUid` 精确锁定单个嫩芽实例。
- 新增回归用例确保多个嫩芽分布在不同基地时都会各自消灭。

## 变更摘要
- `registerTrigger('killer_plant_sprout' | '_pod', 'onTurnStart', ..., { perInstance: true })`
- `killerPlantSproutTrigger`：优先使用 `triggerMinionUid/sourceCardUid` 限定单实例执行。
- 新增用例：`多个嫩芽在不同基地会分别消灭自身`

## 验证记录
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionOngoing.test.ts --configLoader native -t "多个嫩芽在不同基地会分别消灭自身"`
- `npx eslint src/games/smashup/abilities/killer_plants.ts src/games/smashup/__tests__/expansionOngoing.test.ts --quiet`
