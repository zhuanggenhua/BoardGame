# 移动端顶层容器与 LoadingScreen 回归验证

## 目标

- 验证 Dice Throne 选角界面在手机横屏下不会再把顶层容器撑出视口。
- 验证游戏内 `LoadingScreen` 仍能正常出现，并保持在容器内居中显示。

## 执行命令

```bash
npm run test:e2e:ci:file -- character-selection.e2e.ts "手机横屏下选角界面不应出现顶层横向滚动"
npm run test:e2e:ci:file -- smashup-image-loading.e2e.ts "进入本地对局时先显示 LoadingScreen，再进入派系选择界面"
```

## 证据 1：Dice Throne 选角横屏无横向溢出

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\mobile-character-selection\character-selection-mobile-landscape.png`

![Dice Throne 选角横屏截图](../test-results/evidence-screenshots/_shared/mobile-character-selection/character-selection-mobile-landscape.png)

观察结论：

- 选角层限制在当前横屏视口内，没有再出现横向滚动条。
- 左侧角色列表、顶部等待条、底部玩家状态都仍在可视区内。
- 右下角悬浮入口仍停留在容器右下区域，没有因为顶层遮罩逃到视口坐标系而把整页宽度继续撑开。
- E2E 同时断言了 `documentElement`、`body`、`#root`、`[data-game-page]`、`[data-testid="character-selection-overlay"]` 的宽度和边界，没有超出视口。

## 证据 2：SmashUp LoadingScreen 容器内显示正常

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\add-critical-image-preloading\critical-image-gate-loading.png`

![SmashUp LoadingScreen 截图](../test-results/evidence-screenshots/_shared/add-critical-image-preloading/critical-image-gate-loading.png)

观察结论：

- 法阵动画位于容器视觉中心，没有出现倾斜、偏移到视口外或被顶层 fixed 层拉歪的现象。
- 文案位于下方安全区域，未把画面整体向一侧挤偏。
- 截图四周仍保留当前游戏容器的黑色背景边界，说明加载层现在是贴合 board/container，而不是接管整个页面根视口。
- 对应 E2E 已确认能从 `LoadingScreen` 正常过渡到派系选择界面，说明容器锚定没有破坏加载链路。
