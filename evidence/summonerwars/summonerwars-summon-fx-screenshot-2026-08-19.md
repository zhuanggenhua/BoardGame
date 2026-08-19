# Summoner Wars 召唤特效端到端截图验收

- 时间：2026-08-19 20:49 +08:00
- 目标：撤回 Summoner Wars 召唤特效的错误通用化表现，恢复旧 Canvas 召唤光柱的局部棋盘反馈合同。
- 入口：真实 Summoner Wars 页面测试入口，固定普通单位 `瘟疫僵尸` 执行召唤。
- E2E：`e2e/summonerwars/summonerwars-summon-fx-screenshot.e2e.ts`

## 原图

- 召唤前选择态：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-summon-fx-screenshot.e2e\召唤特效过程帧应贴近目标格且不回到混合大特效\召唤前-选中单位和合法召唤格.jpg`
- 爆发过程帧：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-summon-fx-screenshot.e2e\召唤特效过程帧应贴近目标格且不回到混合大特效\召唤特效-爆发过程帧.jpg`
- 持续过程帧：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-summon-fx-screenshot.e2e\召唤特效过程帧应贴近目标格且不回到混合大特效\召唤特效-持续过程帧.jpg`

## 图面结论

- 召唤前选择态：手牌中只有一张普通单位，棋盘上合法召唤格可见；截图能证明玩家先选中单位，再点目标格。
- 爆发过程帧：蓝色召唤光柱出现在目标单位位置，没有全屏暗角、没有回到混合大特效；目标单位仍可见，特效主体没有横跨整片棋盘。
- 持续过程帧：光柱收敛在目标格附近，持续阶段不是大面积白色幕布，玩家仍能识别目标格和周边单位。
- AI 审计裁决：`PASS`。本轮要求只覆盖 Summoner Wars 召唤特效是否恢复局部旧表现，不代表整局 UI、其它游戏或线上环境已验收。

## 自动指标

- 爆发帧：`fx.summon` 活动中，Canvas 数量 `1`，固定暗角遮罩数量 `0`。
- 爆发帧可见像素盒：宽度 `2.12` 个目标格，高度 `4.09` 个目标格；低于门槛 `4.20`。
- 持续帧：`fx.summon` 活动中，Canvas 数量 `1`，固定暗角遮罩数量 `0`。
- 持续帧可见像素盒：宽度 `0.57` 个目标格，高度 `2.23` 个目标格。

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/ui/__tests__/compatSource.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：通过。
- `npm run typecheck`：通过。
- `npm run spec:lint`：通过。
- `git diff --check -- src/components/common/animations/SummonEffect.tsx src/games/summonerwars/ui/fxSetup.ts src/games/summonerwars/ui/__tests__/compatSource.test.ts e2e/summonerwars/summonerwars-summon-fx-screenshot.e2e.ts src/games/summonerwars/Board.tsx`：通过，仅提示 Git 换行转换。
- `$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars-summon-fx-screenshot.e2e.ts`：通过，`1 passed`。

## 备注

- 本轮只修本地代码与本地 E2E 截图验收，未部署线上。
- 当前工作区有其它无关改动，本轮没有清理、回滚、切分支或改动那些文件。
