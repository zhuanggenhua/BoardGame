# 冲突解决汇报：feat/dicethrone-gunslinger-samurai

> 2026-06-05 当前有效口径：本文是历史 merge/cherry-pick 冲突处理记录，只说明当时如何保留主线并吸收分支增量，不构成当前枪手/武士审计完成证明。当前若要判断对象级残余或整批发布口径，应以现行单英雄主审计与新英雄总汇总文档为准。

## 1. 背景
- base: `main`
- head: `feat/dicethrone-gunslinger-samurai`
- 触发命令: `git cherry-pick 9b48cd271cdc1e535d100adaf23f4c65e552b497`

## 2. 冲突文件
- `findings.md`
- `progress.md`
- `task_plan.md`
- `src/games/dicethrone/domain/core-types.ts`
- `src/games/dicethrone/heroes/gunslinger/cards.ts`
- `src/games/dicethrone/heroes/samurai/cards.ts`

## 3. 解决策略
### `findings.md`
- 策略：保留主线版本。
- 原因：这是当前工作树的阶段性规划/发现文件，不应被角色分支的历史规划覆盖。

### `progress.md`
- 策略：保留主线版本。
- 原因：同上，避免把旧任务进度混入当前主线现场。

### `task_plan.md`
- 策略：保留主线版本。
- 原因：正式计划文件不能被旧分支计划覆盖。

### `src/games/dicethrone/domain/core-types.ts`
- 策略：保留主线的 `diceOwnerId?: PlayerId;`。
- 原因：主线已经有更新后的交互目标骰池归属字段，本次分支未提供更强的新语义。

### `src/games/dicethrone/heroes/gunslinger/cards.ts`
- 策略：保留主线的 atlas 预览与公共卡注入实现。
- 原因：主线已经完成卡图预览体系升级；本次分支在这里的目标是四人局定向牌修复，不需要回退到旧导入形式。

### `src/games/dicethrone/heroes/samurai/cards.ts`
- 策略：保留主线 atlas 预览，合入分支的定向自定义动作效果。
- 合并要点：继续使用 `previewRef: atlasPreview(SAMURAI_CARD_ATLAS_BASE_INDEX + 10)`，同时保留 `samurai-card-you-should-be-ashamed` 的定向交互效果。
- 原因：主线预览资源映射较新；分支真正的业务增量是把“羞辱”行动牌改为选择敌方玩家。

## 4. 风险与验证
- 风险点：四人局定向牌逻辑涉及交互目标选择链，仍需回归相关测试。
- 验证命令：
  - 未完成，当前先完成 cherry-pick 收口。
- 结论：本次先确保主线不丢现有卡图/规划文件，并只吸收四人局目标选择相关增量。
