# 移动端横屏滚动条修复 E2E 证据

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/cardia/cardia-smoke-test.e2e.ts "真实对局页在 iPhone XR 横屏下不应触发整页缩放"
npm run test:e2e:ci:file -- e2e/cardia/cardia-smoke-test.e2e.ts "手机横屏布局应完整展示战场与手牌"
npm run test:e2e:ci:file -- e2e/smashup/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

## 有效截图

### 1. Cardia 手机横屏主态图

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-smoke-test.e2e\手机横屏布局应完整展示战场与手牌\cardia-mobile-landscape-layout.png`
- 判定：有效
- 看图结论：
  - 画面左右边界都完整落在视口内，没有出现浏览器整页横向滚动条对应的“内容被撑出一截”现象。
  - 顶部信息条、右侧阶段/回合卡片、底部手牌区都还在同一屏内，没有因为壳层缩放产生额外外溢。
  - 底部手牌区保持在游戏内局部滚动区域里，没有把整页文档高度或宽度撑爆。

### 2. Smash Up 教程手机横屏图

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`
- 判定：有效
- 看图结论：
  - 教程弹层完整处于视口内，右侧结束回合按钮、日志按钮、记分板也都没有跑出边界。
  - 画面四周没有出现被整页滚动带出来的额外留白或截断。
  - 说明这次 `board-shell` 根层处理没有破坏另一条已接入横屏壳层的游戏链路。

## 无效截图

- 本次未引用无效截图。

## 结论

- Cardia 的紧凑横屏场景已经不再对白名单放过横向溢出，E2E 现在强制校验：
  - `documentElement.scrollWidth <= innerWidth + 1`
  - 游戏页容器边界在视口内
  - `.mobile-board-shell` 边界在视口内
- Smash Up 教程横屏回归通过，说明全局 `board-shell` 修复未引入明显回归。
