# 移动端退出悬浮球 Sheet E2E 证据

## 测试目标

验证移动端横屏下，退出悬浮球不再使用贴边 popover，而是使用底部 sheet，且退出面板里的按钮首屏全部可见、可点，不依赖内部滚动补救。

## 执行命令

```bash
npm run test:e2e:ci:file -- smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌"
```

结果：通过

## 证据截图

### 1. 移动端横屏主界面

绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`

![04-mobile-landscape-layout](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/04-mobile-landscape-layout.png)

分析：
- 主棋盘、记分板、结束回合区域都在首屏内，没有被退出入口挤压。
- 退出 FAB 保持在底部操作区，不再提前展开占用主视口。

### 2. 退出 Sheet 展开态

绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`

![04a-mobile-exit-fab-panel](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/04a-mobile-exit-fab-panel.png)

分析：
- 退出面板已经改成底部 sheet，而不是从悬浮球旁边横向/纵向贴边展开。
- `Back to Lobby` 按钮完整落在首屏视口内，按钮文案与副文案都没有被裁掉。
- 背景加了遮罩，但按钮本身仍保持首屏可点击；测试同时校验了按钮可见、可用、位于视口内。
- 面板自身没有依赖内部滚动：测试断言了 `scrollHeight <= clientHeight` 与 `scrollWidth <= clientWidth`。
- 页面本身也被锁住：测试会校验 `html/body` 的 `overflow-y` 为 `hidden`、`overscroll-behavior-y` 为 `none`，避免继续出现页面级滚动条。

## 结论

这次修复已经满足“移动端退出展开框里的按钮必须首屏全部可点，不接受靠滚动补救”这条验收线。
