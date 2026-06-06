# FantasyRealms 平板断点首屏行动面板核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在平板横屏 / 中间断点堆叠布局下，首帧仍能直接看到当前回合主操作按钮。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=4`
- 视口：`1024 x 768`
- 浏览器：Playwright / Chromium headless

## 修前现象

- 页面已切到单列堆叠布局；
- 公开弃牌区与手牌区仍排在回合面板之前；
- 主操作按钮落在首屏下方；
- 实测按钮 `y = 792.39`，超出 `768` 高度视口。

## 修后结果

- 当前回合面板被提升到牌桌最上方；
- 原左栏回合面板不再重复显示；
- 当前 4 人基础版首回合实测按钮位置为：
  - `y = 283.84`
  - `height = 44`
  - 按钮底部 `327.84 <= 768`
- 结论：中间断点下的首回合主操作已回到首屏可见范围。

证据：

- `evidence/fantasyrealms/fantasyrealms-tablet-action-panel-2026-06-06.png`

## 结论

`<=1180px` 的堆叠布局现在都能在首帧直接执行当前回合主操作，不再要求玩家先滚到牌桌下方。
