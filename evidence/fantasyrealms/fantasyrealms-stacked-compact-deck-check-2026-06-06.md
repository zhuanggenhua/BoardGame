# FantasyRealms 堆叠布局牌库紧凑态核对（2026-06-06）

> 历史阶段说明：
> 本文记录的是 2026-06-06 当时 `<=1180px` 横屏断点候选里，牌库是否收成紧凑态的中间核对。
> 文中的“堆叠布局”只是当时命名，不代表今天仍保留独立 `stacked` 正式家族。
> 今天应将其理解为：**历史紧凑横屏候选证据**，不能直接当成当前正式桌面合同。

## 目标

核对 `FantasyRealms` 在 `<=1180px` 历史横屏断点候选下，牌库面板是否已经从桌面端的大号竖卡堆切到更紧凑的高度。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 视口：`1024 x 768`
- 浏览器：Playwright / Chromium headless

## 修前现象

- 页面已经切到堆叠布局；
- 牌库区域仍保留桌面端竖向大卡堆视觉；
- 牌库信息只有剩余张数，但占用了明显过高的垂直空间。

## 修后结果

- 堆叠布局下已命中 `fr-stack--deck-compact`
- 当前实测牌库高度：`120px`
- 牌库仍保留实体桌面材质，但不再用大面积空白占据后续信息区之前的位置

证据：

- `evidence/fantasyrealms/fantasyrealms-stacked-compact-deck-2026-06-06.png`

## 结论

这份历史横屏候选里的牌库面板当时已经收成紧凑态。
它只证明当时的断点收口方向，不再直接等同于今天的正式 live 方向。
