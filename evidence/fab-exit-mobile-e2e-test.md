# 悬浮球退出（移动端）E2E 证据

- 测试用例：`e2e/smashup/smashup-4p-layout-test.e2e.ts`  
  `移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大`
- 运行时间：2026-04-12

## 关键截图与结论

1. `04a-mobile-exit-fab-panel.png`  
   绝对路径：  
   `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\04a-mobile-exit-fab-panel.png`
   - **观察**：退出面板以悬浮面板形式贴近悬浮球展开，整体处于视口内，但与 2026-04-06 的老截图对比后，当前位置仍偏移（更靠下/更贴近右下），与期望位置不一致。  
   - **结论**：**未达到验收标准**（位置回归未消除），需要继续定位与修复。
