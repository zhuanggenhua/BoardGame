# 王权骰铸：奖励骰特写手动关闭（E2E 证据）

## 覆盖范围
- 需求：游戏内奖励骰特写改为**手动关闭**（不再自动消失）。
- 场景：`bonus die spotlight should close on content click in display mode`
- 说明：本证据聚焦“点击特写内容关闭”的手动关闭路径。

## 关键截图与观察

### 1) 特写已出现（点击关闭前）
截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\bonus-die-spotlight-should-close-on-content-click-in-display-mode\05-bonus-die-spotlight-visible-before-click-close.png`

观察：
- 画面中央出现奖励骰特写（可见骰面与效果文案）。
- 右侧 HUD、阶段列表仍可见，说明特写为浮层展示。
- 特写仍停留在画面中，尚未自动消失（等待点击关闭）。

结论：**特写成功出现，符合“等待手动关闭”的前置条件。**

### 2) 点击特写后关闭
截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\bonus-die-spotlight-should-close-on-content-click-in-display-mode\06-bonus-die-spotlight-click-close.png`

观察：
- 画面中不再出现奖励骰特写浮层。
- 棋盘与右侧 HUD 显示正常，未被特写遮挡。

结论：**点击特写内容后可正常收口，手动关闭路径生效。**

## 最终结论
奖励骰特写在游戏内可通过点击内容手动关闭，且关闭后界面恢复正常展示，符合本次需求的“手动关闭”行为。
