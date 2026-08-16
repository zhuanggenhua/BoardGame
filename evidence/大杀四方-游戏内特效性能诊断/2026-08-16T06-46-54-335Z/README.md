# 大杀四方游戏内特效性能复测

- 入口：本地 E2E TestHarness 打开 `/play/smashup`。
- 场景：普通棋盘空闲、触发器导致随从销毁、触发器导致力量增加。
- 采样：Chrome trace、页面 RAF 帧间隔、Long Task、DOM/CSS inventory。
- 口径：这是删减来源动画和连线后的同入口复测证据，用于验证本轮性能优化收益。
- 边界：测试入口跳过关键图片门禁；只代表页面/特效渲染性能，不代表图片预加载链路健康。

summary: D:\gongzuo\webgame\BoardGame\evidence\大杀四方-游戏内特效性能诊断\2026-08-16T06-46-54-335Z\summary.json
screenshot: D:\gongzuo\webgame\BoardGame\evidence\大杀四方-游戏内特效性能诊断\2026-08-16T06-46-54-335Z\smashup-triggered-fx-after-sampling.png
