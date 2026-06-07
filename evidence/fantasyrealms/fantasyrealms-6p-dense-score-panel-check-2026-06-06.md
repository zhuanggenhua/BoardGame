# FantasyRealms 6 人分数区紧凑态核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在 5~6 人多人局下，分数区是否已经从高权重摘要块切到更紧凑的多人布局。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 视口：`1440 x 1100`
- 浏览器：Playwright / Chromium headless

## 结果

- 6 人页已命中多人紧凑态类：`fr-score-summary--dense`
- 分数区仍显示完整 6 名玩家行，但当前视角总分与拆分已收成更轻的紧凑块
- 当前实测：
  - `rows = 6`
  - `scorePanelHeight = 716`
- 从页面结构看，牌桌主区域仍保持首屏主位，分数区不再像此前那样用大数字和长列表持续抢占视觉重心

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-dense-score-panel-2026-06-06.png`

## 结论

5~6 人多人局下，分数区已经切到更适合多人信息密度的紧凑态，更符合“摘要保持次级”的桌面层级。
