# 大杀四方中文覆盖层设置截图核对

## 范围

- 目标：确认大杀四方设置里的“中文覆盖层”状态不再依赖右侧“已开启”文字撑宽，而是以固定宽度 toggle 表达，且不发生换行或横向溢出。
- 代码位置：`src/components/game/framework/widgets/GameHUD.tsx`

## 截图路径

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual-smashup-overlay-toggle\01-smashup-settings-full.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual-smashup-overlay-toggle\02-smashup-settings-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual-smashup-overlay-toggle\03-smashup-overlay-toggle-row.png`

## 人工观察结论

- 整页截图里，设置面板已正常展开，“中文覆盖层”这一项位于大杀四方专属设置区内，右侧显示为单个绿色 toggle，不再出现“已开启”文字 pill。
- 设置面板截图里，“中文覆盖层”标题保持单行，右侧 toggle 固定宽度显示，没有把整行撑出卡片右边界。
- 单行截图里，左侧标题与说明文字区域、右侧 toggle 之间留有明确间距；toggle 自身完整显示，未裁切、未换行，行容器没有横向溢出迹象。

## 补充指标

- `metrics.json` 记录值：
  - `ariaPressed = true`
  - `buttonClientWidth = 244`
  - `buttonScrollWidth = 244`
  - `toggleWidth = 44`
  - `toggleHeight = 24`
- 其中 `buttonScrollWidth === buttonClientWidth`，说明该行未出现横向溢出。

## 说明

- 本轮截图来自构建产物预览链路，用于补充当前 UI 交付证据。
- 标准单用例 E2E 已同步更新断言口径，但执行时被仓库内其他重任务门禁阻塞，未能在同一轮产出 Playwright 显式证据目录。
