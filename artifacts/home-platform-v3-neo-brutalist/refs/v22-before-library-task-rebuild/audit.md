# 平台首页第二十二版 · 375 竖屏返工

当前稿源：[index.html](index.html)。这是 Open Design artifact 候选，人工设计验收仍为 `not-approved`，不代表生产页面或 `src/` 实现。

本轮原话：「继续新首页任务吧，可能需要重构，移动端适配完全失败」。用户随后明确选择「按此方向重构移动端」，允许主按钮整行、辅助操作紧凑排列。

## 已修复

- 收藏库旧网格在有限高度内挤压封面，改为自然高度、单个页面滚动窗口。
- 房间/好友列表继承 `flex: 1 1 0` 导致容器裁切；移动端改为自然内容高度。
- 发现页的介绍塞在半宽封面；改为通栏展开，保留两列主体与再次点按详情的语义，网格补齐空洞。
- 详情简介及操作被挤在右侧窄列；改为摘要、通栏简介、整行主按钮与紧凑辅助按钮。
- 顶图从强设宽高改为保比例裁切；三项统计同排，动态保持纵向流。
- 对局条保持叠底，在 375×812 实测为 66px。末项通过原生滚轮可完整停在其上方，中心命中真实对象。
- 收藏星标、列表、人数选择、菜单和主要按钮恢复至少 44px 命中区域。

## 当前验证

- 合同单测：`node scripts/infra/vitest-cli-safe.mjs run --config artifacts/home-platform-v3-neo-brutalist/vitest.config.ts --configLoader native`，1/1 通过。该测试只证明稿源合同。
- 浏览器链路：`node artifacts/home-platform-v3-neo-brutalist/capture.mjs`，1920×1080、375×812、375×540；另增量跑 `--only=m06g`、`--only=m02`，均通过。
- [行为记录](exports/behavioral-verification.json) 和 [实际日志](exports/capture-full.log) 分开记录合同与浏览器证据。
- [逐图账本](exports/.visual-review.json)：当前 38 张整屏原图，16 张 PC、22 张移动，独立视觉审查逐图 PASS。
- [E2E 索引](exports/.e2e-image-index.json) 与 [PASS 清单](exports/open-design-pass-manifest.json) 逐项对应，包含源文件和图片摘要。
- 返工前稿源与证据保存于 [历史目录](refs/v22-before-mobile-rebuild/)，旧 PASS 不作为本轮依据。

## 承载职责

- [index.html](index.html)：同源页面 DOM 与交互，PC 原有视觉。
- [mobile.css](mobile.css)：窄屏样式唯一 owner，不另造移动页面状态。
- [capture.mjs](capture.mjs)：桌面链路与截图编排。
- [mobile-capture.mjs](mobile-capture.mjs)：移动链路、滚动、末项命中与触控几何。

## 证据限制

- 375×540 是缩短可视高度的布局压力，不是原生键盘、输入法、真机触摸或安全区实测。
- 命运支配、井字棋的既有演示封面占位仍保留；本轮不包含新增游戏素材接入。
- 没有实现生产前端、提交、推送或部署。当前设计仍待用户查看确认。
- 本轮不涉及可复用规范变更，无需知识沉淀。
