# add-critical-image-preloading E2E 证据

## 测试目标

验证 `add-critical-image-preloading` 的剩余任务 `2.2 手动验证进入对局无首屏白屏/闪烁` 已可通过真实页面流程复核：

- 进入内置游戏对局前，先出现 `LoadingScreen`
- 页面不是白底空白，而是稳定的黑底加载态
- 加载完成后进入 Smash Up 派系选择界面，说明棋盘已开始渲染

## 执行命令

```bash
npm run test:e2e:ci:file -- smashup-image-loading.e2e.ts "进入本地对局时先显示 LoadingScreen，再进入派系选择界面"
```

结果：通过

## 证据截图

### 1. 关键图片门禁加载态

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\add-critical-image-preloading\critical-image-gate-loading.png`

![critical-image-gate-loading](../test-results/evidence-screenshots/add-critical-image-preloading/critical-image-gate-loading.png)

分析：

- 画面为完整黑底 LoadingScreen，不是白底空白页。
- 底部文案为 `Loading match resources...`，说明进入对局时存在明确加载反馈。
- 该截图对应关闭 `__E2E_SKIP_IMAGE_GATE__` 后的真实门禁路径。

### 2. 加载完成后的派系选择界面

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\add-critical-image-preloading\critical-image-gate-faction-selection.png`

![critical-image-gate-faction-selection](../test-results/evidence-screenshots/add-critical-image-preloading/critical-image-gate-faction-selection.png)

分析：

- `DRAFT YOUR FACTIONS` 标题已出现，说明 LoadingScreen 结束后已进入 Smash Up 对局首屏。
- 页面布局稳定，没有停留在白屏或空容器状态。
- 本用例为了稳定复现门禁显示，对资源请求做了轻微延迟并返回占位图；验证重点是“先加载、后渲染”的流程与首屏稳定性，而不是素材美术内容本身。

## 结论

`add-critical-image-preloading` 的剩余验证项 `2.2` 已具备可复核证据，可以标记完成并进入归档流程。
