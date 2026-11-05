# 七大恨教程与移动端收口端到端验收

## 验收边界

- 当前实现现场：`D:\gongzuo\webgame\BoardGame` 根目录当前工作区。
- 当前最终用户展示目录：`test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-20-qidahen-tutorial-final-user-view`。
- 本记录证明七大恨教程按真实玩家流程完成端到端截图，并覆盖移动端手牌检视闭环；不证明《七大恨》全部规则已完成。
- OpenSpec `2.4 / 4.5` 仍有事件效果全集和完整战术时机缺口，不能因本次教程截图通过而勾选整体规则完成。

## 2026-09-20 教程重构记录

本轮按正式规则顺序重构教程，基础主线固定为 9 步：

`welcome → wheel-first → wheel-move → wheel-result → pick-action → pay-cards → choose-grant-pardon-target → action-result → finish`

- 正式大明起手为 3 张手牌，手牌上限为 15 张；当前起手未超上限，因此基础教程不加入弃牌步骤，也不制造与当前局面无关的弃牌动作。
- 基础流程改为：公共轮盘推进 → 落点即时结算 → 手牌行动 → 支付 → 地图目标 → 结果。
- 删除基础主线中与当前局面无关的手牌上限弃牌、额外手牌检视、士气、重复轮盘说明等步骤。
- 隐藏专题改为独立入口；专题完成后停留在当前专题结束态，不再通过 `nextTutorialId` 自动跳到另一套不连续的预设局面。
- 移动端保留真实手牌长按检视；长按后的合成 click 被抑制，关闭放大层后回到牌桌，不会误触支付、正式行动或弃牌。
- 基础教程首步 `welcome` 只借真实公共轮盘作为排版锚点，教程卡固定在轮盘右侧；首步不启用整屏遮罩、整轮盘高亮或可走落点强调，也不遮挡手牌区。
- 截图查看器目录索引新增“复制”按钮，直接复制当前截图的本地原始路径；原有双击图片复制行为继续保留。
- 最终混合展示目录中的移动端截图统一使用 `移动-01/02/03` 前缀，并由目录内精确索引覆盖父目录旧批次索引，避免桌面端与移动端按数字前缀串号或串标题。

## 静态与领域验证

- 七大恨教程定向单测：`tutorialFlow.test.ts` 的 `19/19 passed`。
- `npm run typecheck`：通过。
- `npm run spec:lint`：通过。
- `npm run i18n:check -- --game qidahen`：命令可运行，但被既有 `game-summonerwars.factions.zhongcai` 缺失中英文键阻断；该缺口不属于七大恨本轮改动。

## 端到端结果

执行命令：

```powershell
npm run test:e2e:file -- e2e/qidahen/qidahen-closeout.e2e.ts
```

- 结果：`17/17 passed`。
- 桌面端最终截图：59 张。
- 移动端最终截图：3 张。
- 合计：62 张原始 PNG。
- 当前展示目录：`test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-20-qidahen-tutorial-final-user-view`。
- 当前 PASS 清单：`evidence/qidahen/pass-manifest-20260920-tutorial-final-user-view.json`。
- PASS 清单 dry-run：通过，确认 62 张图片全部存在且路径匹配。
- 截图范围：`00-教程目录-先选择章节.png` 到 `46-朝鲜第5步-看朝鲜耗损与山海关结果.png`，另含 3 张移动端手牌检视图。
- 覆盖内容：教程目录、基础回合、轮盘、军备、事件、进攻、战斗、撤退、攻城、外交、跨年和朝鲜流程。

## 图面核验

当前 PASS 清单将这组图片标记为最终用户展示图，覆盖的关键压力态包括：公共轮盘首个决策、手牌区与教程卡同屏、手牌支付、战术确认条、攻城选择、跨年结果、朝鲜结果和移动端手牌放大层。

核验结论：

- 没有把历史截图批次或旧服务器清单作为本轮最终证据。
- 基础教程从公共轮盘的真实首个决策开始，没有把未触发的起手弃牌写成第一步。
- 基础教程首步与下一步都围绕公共轮盘布局；`01-教程第1步-点下一步开始基础回合.png` 已用 v4 视觉修复后的新截图替换旧图。v4 focused E2E 为 `1/1 passed`，并补充验证首步无高亮环、轮盘不强调、教程卡不覆盖手牌区。
- 轮盘落点结算、手牌行动、支付、地图目标和结果反馈均有对应截图。
- 隐藏专题使用独立预设局面；专题结束后不自动串入另一套专题。
- 移动端横屏三张正式起手手牌完整可见；长按检视层显示完整，关闭入口可见，关闭后回到牌桌。

移动端最终图：

- `test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-20-qidahen-tutorial-final-user-view/移动-01-移动教程-手牌检视前.png`
- `test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-20-qidahen-tutorial-final-user-view/移动-02-移动教程-长按手牌打开检视.png`
- `test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-20-qidahen-tutorial-final-user-view/移动-03-移动教程-关闭检视回到牌桌.png`

## 用户展示入口

使用项目唯一查看器入口生成网址：

```powershell
node scripts/verify/open-verified-image.mjs `
  --dir "test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-20-qidahen-tutorial-final-user-view"
```

本记录中的最终网址以该命令本次实际输出的 `VIEWER_URL` 为准，不沿用历史服务器地址。

- `DIRECTORY_KEY`：`0dae8699e3e9`
- `VIEWER_URL`：`http://127.0.0.1:4867/?key=0dae8699e3e9`
- 离线入口：`test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-20-qidahen-tutorial-final-user-view/index.html`

## 完成边界

- 七大恨教程按真实流程的端到端 E2E 与最终截图证据链：通过。
- 移动端手牌完整显示、长按检视、关闭回桌：通过。
- 隐藏专题独立入口、独立结束、不自动跳转：通过。
- 《七大恨》整体规则完成：未通过，继续受 OpenSpec `2.4 / 4.5` 缺口约束。
