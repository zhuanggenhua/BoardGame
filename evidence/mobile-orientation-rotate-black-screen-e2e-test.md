# 手机横竖屏切换黑屏修复 E2E 证据

## 用例

- 文件：`e2e/smashup-tutorial.e2e.ts`
- 用例：`手机从竖屏旋转到横屏后教程画布不应塌成黑屏`

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机从竖屏旋转到横屏后教程画布不应塌成黑屏"
```

## 证据截图

- 截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\手机从竖屏旋转到横屏后教程画布不应塌成黑屏\tutorial-rotate-to-landscape.png`

## 看图结论

- 横屏后页面主体仍正常渲染，没有只剩黑色背景。
- 教程卡片位于画面中央，`NEXT` 按钮可见，说明交互层没有塌陷。
- 左上回合提示、右上分数板、右侧结束回合按钮、左下牌堆与右下弃牌堆都仍可见，说明 `board-shell` 缩放容器在旋转后仍有有效宽高。
- 该截图没有教程外的遮挡层、报错层或空白覆盖，可作为有效主状态证据。

## 根因说明

- 问题来自移动端横竖屏切换时，部分 WebView 会在瞬间上报 `0` 高度或异常视口尺寸。
- 旧实现直接用这一帧尺寸参与 `board-shell` 的缩放计算，导致容器高度被算成接近 `0`，页面只剩黑色背景。
- 修复后会保留“最后一次有效视口尺寸”，并让横屏缩放统一消费这组稳定尺寸，避免瞬时错误值把页面压塌。
