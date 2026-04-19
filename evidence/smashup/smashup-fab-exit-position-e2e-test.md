# SmashUp FAB 退出面板位置回归 - E2E 证据

- 日期：2026-04-13
- 用例：`移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大`
- 运行命令：`npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大"`

## 截图证据

1) 退出面板展开（FAB popover）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\04a-mobile-exit-fab-panel.png`
- 观察：
  - 退出面板以贴球 popover 形式展示，右侧 FAB 列仍为原位展开，未出现独立 sheet / backdrop。
  - 主 FAB 蓝色按钮与展开前位置一致（未发生整体漂移/跳位），面板贴近出口按钮所在列，视觉锚点稳定。
  - 面板内容完整可见且无横向溢出/内部滚动，表现为“自然展开”而非弹窗遮罩。

## 备注
- 截图在展开态稳定后采集（避免动画中间帧），用于验证“表现正常”而非仅仅“完全在视口内”。
