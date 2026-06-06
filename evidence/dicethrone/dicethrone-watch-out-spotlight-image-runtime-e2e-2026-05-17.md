# DiceThrone 视角切换后玩家面板图片链路验证

> 2026-06-05 当前有效口径：本文只保留“移动端一次视角切换后玩家面板图片不再空白”这条单链路 E2E 证据，不代表枪手/武士整英雄、也不代表 DiceThrone 图片运行时全量收口。当前若要判断枪手/武士对象级残余或图片链路更广范围口径，应回到对应英雄审计文档与相关 runtime 专项 evidence。

## 范围
- 目标用例：`mobile player board image should survive one view switch without remount blanking`
- 重点验证：移动端切换一次视角后，玩家面板图片仍然显示，不出现 remount 空白或重新回到慢加载链路。

## 证据
- E2E 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile player board image should survive one view switch without remount blanking"`
- 结果：通过

## 截图观察

### [16-mobile-board-view-switch-before.png](<D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/mobile-player-board-image-should-survive-one-view-switch-without-remount-blanking/16-mobile-board-view-switch-before.png>)
- 我实际看到的是：Samurai 玩家面板完整显示，中心主图、能力槽、右侧信息栏都在。
- 未见：左上角缩成一块、整块面板空白、只剩骨架层。
- 结论：达标，作为切换前基线有效。

### [17-mobile-board-view-switch-after.png](<D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/mobile-player-board-image-should-survive-one-view-switch-without-remount-blanking/17-mobile-board-view-switch-after.png>)
- 我实际看到的是：切到 Gunslinger 后，玩家面板仍完整显示，主图不是空白块。
- 视角确实发生了切换，且面板未丢失。
- 结论：达标，说明一次视角切换没有把玩家面板打没。

### [18-mobile-board-view-switch-restored.png](<D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/mobile-player-board-image-should-survive-one-view-switch-without-remount-blanking/18-mobile-board-view-switch-restored.png>)
- 我实际看到的是：切回 Samurai 后，面板又恢复为 Samurai 对应画面，仍然是完整大图，不是空白。
- 结论：达标，说明切换链路可逆，图片没有在重挂载时丢失。

## 结论
- 这条“单次视角切换后面板图片空白”问题已拿到单链路修复证据。
- 当前残留风险主要是图片运行时仍有较复杂的候选/回退/缓存逻辑；本文不能外推成图片运行时全量收口，只能说明这次验证没有再出现视角切换后的空白或重复慢加载现象。
