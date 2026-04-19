# 召唤师战争 手牌无交互点击放大 E2E 证据

- 测试用例：e2e/summonerwars/summonerwars.e2e.ts :: 非当前玩家操作：guest 在 host 回合无法操作
- 运行命令：npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "非当前玩家操作：guest 在 host 回合无法操作"
- 执行时间：2026-04-12

## 关键截图与观察

### 1) D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\非当前玩家操作：guest-在-host-回合无法操作\guest-hand-click-magnify-open.png
- 观察：顶部 action banner 显示“等待对手行动...”，说明当前为非当前玩家回合（无交互）。
- 观察：放大预览弹窗已打开，卡牌“风暴侵袭”大图完整显示，文字清晰可读。
- 观察：右上角可见“关闭”按钮，弹窗具备明确可关闭入口，未遮挡核心 UI。

结论：在无交互（等待对手）状态下，单击手牌可以打开放大预览，满足“无按键冲突时允许点击放大”的需求。
