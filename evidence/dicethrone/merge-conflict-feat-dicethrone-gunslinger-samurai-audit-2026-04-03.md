# 冲突解决汇报：feat/dicethrone-gunslinger-samurai 审计收口

> 2026-06-05 当前有效口径：本文是历史 merge/cherry-pick 冲突处理记录，只说明当时如何保留或吸收 `feat/dicethrone-gunslinger-samurai` 分支内容，不构成当前枪手/武士审计完成证明。当前若要判断对象级残余或整批发布口径，应以现行单英雄主审计与新英雄总汇总文档为准。

## 1. 背景
- base: `main`
- head: `feat/dicethrone-gunslinger-samurai`
- 触发命令: `git cherry-pick e2eddcaebcc007c63952962a208ae4a7a4412702`

## 2. 冲突文件
- `findings.md`
- `progress.md`
- `task_plan.md`
- `src/games/dicethrone/__tests__/cross-hero.test.ts`
- `src/games/dicethrone/rule/枪手录入核对.md`

## 3. 解决策略
### `findings.md`
- 策略：保留主线版本。
- 原因：任务发现记录不应由历史审计分支覆盖。

### `progress.md`
- 策略：保留主线版本。
- 原因：当前工作树进度文件继续由主线现场维护。

### `task_plan.md`
- 策略：保留主线版本。
- 原因：正式计划入口不混入旧分支计划。

### `src/games/dicethrone/__tests__/cross-hero.test.ts`
- 策略：保留主线已更新的交互步序，只吸收这次提交新增的王权骰铸审计测试主体。
- 合并要点：`upgrade-masamune-2` 大顺分支继续使用主线里的 `cmd('SKIP_TOKEN_RESPONSE', '1')`。
- 原因：主线该用例已经按当前交互流修正为由防守方完成 token 响应，旧分支里的 `player 0` 已过时。

### `src/games/dicethrone/rule/枪手录入核对.md`
- 策略：保留主线更完整的终极技/Loaded/Bounty 审计口径。
- 原因：主线文本已经额外登记了 Loaded 例外裁定和 Bounty 立即生效口径，比分支版本更完整。

## 4. 风险与验证
- 风险点：枪手/武士跨英雄测试新增较多，仍需在依赖完整的环境下跑回归。
- 验证命令：
  - 未执行自动化；当前临时主线 worktree 缺少完整依赖与钩子环境。
- 结论：本次保留主线已有的较新交互口径，同时合入审计提交的大部分业务与测试增量。
