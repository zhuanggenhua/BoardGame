# 七大恨教程与移动端收口端到端验收

## 验收边界

- 当前实现现场：`D:\gongzuo\webgame\BoardGame` 根目录当前工作区。
- 教程真实截图批次：`test-results/evidence-screenshots/_shared/qidahen-教程完成/current-closeout-final-20260711`。
- 本记录只证明教程流程、棋盘视觉、轮盘交互和移动端手牌展示链路，不证明《七大恨》全部规则已完成。
- OpenSpec `2.4 / 4.5` 仍有事件效果全集和完整战术时机缺口，不能因本次截图通过而勾选完成。

## 端到端结果

执行命令：

```powershell
$env:QIDAHEN_TUTORIAL_SCREENSHOT_RUN_ID='current-closeout-final-20260711'
node scripts/infra/run-e2e-single.mjs ci e2e/qidahen/qidahen-closeout.e2e.ts
```

- 结果：`16/16` 通过。
- 桌面最终截图：61 张。
- 截图范围：`00-教程目录-先选择章节.png` 到 `46-朝鲜第5步-看朝鲜耗损与山海关结果.png`。
- 覆盖内容：教程目录、基础回合、轮盘、军备、事件、进攻、战斗、撤退、攻城、外交、跨年和朝鲜流程。

## 图面核验

61 张桌面截图被整理为 8 张轻量核验拼图，逐张核对后通过：

- `temp/qidahen-closeout-final-visual-audit/01-教程当前批次-01-08.webp`
- `temp/qidahen-closeout-final-visual-audit/02-教程当前批次-09-16.webp`
- `temp/qidahen-closeout-final-visual-audit/03-教程当前批次-17-24.webp`
- `temp/qidahen-closeout-final-visual-audit/04-教程当前批次-25-32.webp`
- `temp/qidahen-closeout-final-visual-audit/05-教程当前批次-33-40.webp`
- `temp/qidahen-closeout-final-visual-audit/06-教程当前批次-41-48.webp`
- `temp/qidahen-closeout-final-visual-audit/07-教程当前批次-49-56.webp`
- `temp/qidahen-closeout-final-visual-audit/08-教程当前批次-57-61.webp`

核验结论：

- 没有加载页、黑页或空白页。
- 教程文案存在，没有被主界面改动吞掉。
- 地区高亮、部队选中、轮盘当前位置和合法落点、移动路径、战斗、撤退、攻城、外交、跨年及朝鲜状态均有对应真实截图。

移动端最终图：

- `test-results/evidence-screenshots/qidahen/mobile-layout.e2e/手机横屏下主地图、手牌和底部操作区应保持可见且不出现顶层横向溢出/01-手机横屏-四张手牌完整可见.png`
- `test-results/evidence-screenshots/qidahen/mobile-layout.e2e/手机横屏下主地图、手牌和底部操作区应保持可见且不出现顶层横向溢出/02-手机横屏-手牌放大查看.png`

移动端结论：

- 横屏四张手牌完整可见，首尾不再被裁成半张。
- 手牌放大层显示完整，关闭入口可见。

## 服务器交付

- 公开地址：`http://8.148.71.102:18080/#/boardgame/qidahen-tutorial-closeout`
- `GET /api/tasks` 返回的任务列表包含：
  - 项目：`boardgame`
  - 任务：`qidahen-tutorial-closeout`
  - 标题：`七大恨教程与移动端收口验收`
  - 状态：`passed`
  - 图片数：63
- `GET /api/tasks/boardgame/qidahen-tutorial-closeout` 返回的清单包含 61 张教程桌面图和 2 张移动端最终图，共 63 张。
- 根地址返回任务产物预览应用，不是单独图片页面。

本次恢复现场没有可用浏览器实例，因此没有重新完成手机视口下 63 张逐张滑动的交互回查；没有用本地截图、接口清单或临时页面冒充这项浏览器交互验证。服务器任务存在、标题和 63 张清单已通过公开接口直接核对。

## 完成边界

- 教程端到端与视觉证据链：通过。
- 移动端手牌完整显示与放大：通过。
- 服务器任务和 63 张交付清单：通过。
- 服务器手机轮播逐张滑动：本次恢复现场未重新验证。
- 《七大恨》整体规则完成：未通过，继续受 OpenSpec `2.4 / 4.5` 缺口约束。
