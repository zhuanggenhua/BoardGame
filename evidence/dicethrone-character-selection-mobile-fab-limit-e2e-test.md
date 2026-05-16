# DiceThrone 选角移动端悬浮球上限 E2E 证据

## 范围

- 页面：DiceThrone 在线对局选角 / setup 阶段
- 位点：手机横屏下的 GameHUD / FabMenu 悬浮球轨道
- 目标：选角阶段不显示“强制结束/强制操作”，且展开后同时可见悬浮球数量不超过 7 个；新增换位入口后不挤爆移动端轨道。

## 验证

- 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/character-selection.e2e.ts "手机横屏选角悬浮球不显示强制结束且不超过 7 个"`
- 结果：通过
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\手机横屏选角悬浮球不显示强制结束且不超过7个\character-selection-fab-mobile-landscape.png`

## 肉眼观察

- 截图右侧展开了选角页悬浮球轨道，可见聊天主球、设置、换位、全屏、反馈、退出等入口，未看到“强制结束 AI 阶段”或强制操作警告按钮。
- 换位入口可见，说明选角阶段新增的 seat-swap 入口没有被误删。
- 右侧悬浮球列整体仍在 812x375 横屏视口内，没有顶出屏幕上下边界；本用例同时断言可见 `data-fab-id` 数量不超过 7。

## 未覆盖风险

- 本轮只验证 2 人在线选角链路的移动横屏 HUD 数量；登录用户额外社交入口的极限组合由 `FabMenu` 的移动端数量超限 warn 兜底。
