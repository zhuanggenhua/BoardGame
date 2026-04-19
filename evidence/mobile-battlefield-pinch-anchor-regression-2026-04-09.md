# 移动端战场 pinch / pan 回归验证（2026-04-09）

- 变更范围：
  - `src/games/smashup/Board.tsx`
  - `src/components/game/framework/__tests__/MobileBoardShell.test.tsx`
- 目标：修正 SmashUp 在 content 模式下把 zoom target 挂到内层 `min-w-max` 后，首次双指 pinch 更容易固定左偏的问题；这轮把 target 收回到外层 scroll 容器，并补对应单测。
- 相关截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏-Chromium-真实多触点-pinch-pan-事件链路应正常驱动战场缩放\04g-mobile-battlefield-real-touch-pinch-pan.png`

## 我实际看到什么

1. 截图里战场已经处于放大后的横向平移状态，三块基地和中部卡牌整体一起缩放/平移，说明这次 transform 仍只作用在战场层，没有把右侧 HUD 一起带跑。
2. 右侧“结束回合”按钮和右上角计分板仍停留在壳层固定位置，说明把 zoom target 移回外层 scroll 容器后，HUD 与战场仍保持分层。
3. 我肉眼看到当前画面主体仍落在屏幕中部，没有出现“整个战场被先甩到最左边、主体瞬间丢到边缘”的明显异常；浏览器链路下这轮回归图是达标的。

## 是否达到本轮验收标准

- 对“Chromium 真实多触点 pinch/pan 基本链路不回归”这一项：达到。
- 对“SmashUp content target 收回外层 scroll 容器后，浏览器侧结构性左偏回归是否收住”这一项：当前证据支持已收住。
- 对“真机首次 pinch 首帧固定左偏已彻底消失”这一项：仅凭这张浏览器截图还不能完全替代真机结论，仍需安装最新 debug 包在真机上再复测一次。
