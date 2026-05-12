# 七大恨 UI 初版截图验收（2026-05-12）

## 范围

- 路由：`http://127.0.0.1:5173/play/qidahen?numPlayers=3&seed=qidahen-ui`
- 本轮只验收 UI 初版：真实主地图、地图拖拽/缩放壳、桌面 HUD、常驻行动记录、手机横屏 map-shell、底部手牌与确认区。
- 不验收完整规则自动化、精确区域边界、卡牌裁切合同或区域校准工具。

## 截图证据

### 桌面 1920x1080

截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\qidahen-ui\desktop-final-v3.png`

实际看到：

- 主地图使用七大恨真实地图素材，位于中央主舞台，不是生成图替代。
- 左侧有年度、行动轮盘、三势力状态；右侧有待处理、战斗与常驻行动记录。
- 底部有手牌 rail、行动代价、确认/取消与结束行动区。

验收结论：达到本轮桌面 UI 初版目标。行动记录常驻且风格与右侧战斗/待处理面板一致。

### 手机横屏 936x432

截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\qidahen-ui\mobile-landscape-final-v3.png`

实际看到：

- 地图占据上方主区域，没有缩在左上角，也没有被左右侧栏挤压成窄块。
- 底部保留横向手牌 rail 与确认面板。
- 行动记录没有被完全移除，而是在底部确认区保留两条紧凑摘要。

验收结论：达到本轮移动横屏基线。手机横屏路线是 map-shell，而不是竖屏单列或窄布局。

## 控制台说明

- Playwright 捕获到 `http://127.0.0.1:5173/auth/refresh` 返回 500。
- 这是本次只启动前端 Vite、未启动 API 时的认证刷新请求失败；七大恨地图、命名空间与 UI 资源均已加载成功。
