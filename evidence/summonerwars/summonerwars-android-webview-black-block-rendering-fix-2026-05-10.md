# 召唤师战争 Android WebView 黑块闪烁修复证据

## 背景

- 反馈：App 内召唤师战争教程中，选中卡牌和部分操作会导致黑色闪屏、局部黑块，尤其下半部分；棋盘区域也会出现黑块。
- 范围：仅调整召唤师战争移动横屏/App 场景的视觉合成压力，不改规则、不改桌面端表现。

## 原因判断

排查后未发现手牌选中会触发关键图片门禁或重建整局状态。更符合现象的是 Android WebView/Chromium 合成层在多层 `transform`、常驻 `will-change: transform`、混合模式和重阴影/滤镜叠加时出现的重绘/合成异常。

本项目对应触发点：

- 移动 App 横屏外层已有整体缩放壳层。
- 召唤师战争地图内容层长期 `transform: translate(...) scale(...)`，且常驻 `will-change: transform`。
- 棋盘 UI 暗角使用 `mix-blend-mode: multiply`。
- 移动紧凑手牌选中/可打出状态叠加较重的阴影、ring offset、hover scale、不可用灰度滤镜。

## 官方依据

- Chrome Developers：`will-change: transform` 应在需要高速 transform 动画时使用，否则应避免常驻；可在动画开始/结束时增删。
  - https://developer.chrome.com/blog/re-rastering-composite?hl=en
- MDN：`will-change` 是最后手段，不应提前滥用；过度使用会消耗资源，并可能让浏览器长期保留优化。
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change
- web.dev：动画优先使用 `transform` / `opacity`，但强制建层可能带来其他性能问题；不频繁变化时应只在变化前后启用 `will-change`。
  - https://web.dev/articles/animations-guide
- Android Developers：硬件加速默认开启，异常通常表现为不可见元素或错误像素；正确做法是定位绘制/合成问题，而不是默认关闭硬件加速。
  - https://developer.android.com/develop/ui/views/graphics/hardware-accel

## 改动

- `src/games/summonerwars/Board.tsx`
  - 移动横屏下暗角不再使用 `mix-blend-mode: multiply`，改为普通透明径向遮罩并降低强度。
  - 桌面端保留原暗角混合模式。
- `src/games/summonerwars/ui/MapContainer.tsx`
  - 地图内容层不再常驻 `will-change: transform`。
  - 仅拖拽或教程/聚焦动画期间启用 `will-change: transform`，静止时恢复 `auto`。
- `src/games/summonerwars/ui/HandArea.tsx`
  - 紧凑布局下取消 hover scale。
  - 紧凑布局下选中/可打出提示改为轻量边框与单层阴影。
  - 紧凑布局下不可用卡不再使用 `grayscale` 滤镜，改为透明度提示。

## 验证

### 静态检查

命令：

```bash
npx eslint src/games/summonerwars/Board.tsx src/games/summonerwars/ui/MapContainer.tsx src/games/summonerwars/ui/HandArea.tsx
```

结果：0 error。输出中仍有既有 warning：

- `Board.tsx` 既有 React hook warning。
- `HandArea.tsx` 既有 fast-refresh warning。

### 移动横屏截图

自带 `capture:mobile:evidence` 在当前环境未成功产物：

- 首次失败原因：默认 `6173` 端口占用。
- 换端口后包装器 Vite 日志管道出现 `EPIPE`，未稳定写出截图文件。

因此使用独立隐藏 Vite 进程 `6180` + Playwright Chromium，真实访问：

```text
http://127.0.0.1:6180/play/summonerwars/tutorial?bgForceCoarsePointer=1
```

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\webview-black-block-fix-2026-05-10\03-phone-landscape-board-before-playable-select.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\webview-black-block-fix-2026-05-10\04-phone-landscape-board-after-playable-select.png`

肉眼观察：

- 选中前：棋盘主体、下半手牌区、右侧阶段栏可见，没有整块黑屏或下半部黑块。
- 选中可打出手牌后：`亡灵弓箭手` 选中并抬升，棋盘可落点高亮出现；棋盘主体、下半手牌区、右侧阶段栏仍可见，没有新增黑块遮挡。
- 截图中教程说明浮层仍遮挡部分棋盘，这是当前教程状态本身，不是本次黑块问题。

运行时样式检查：

```json
{
  "viewport": { "width": 936, "height": 432 },
  "vignetteMixBlendMode": "normal",
  "mapWillChange": "auto",
  "selectedCardTransform": "matrix(1, 0, 0, 1, 0, -20)",
  "selectedAttr": "true",
  "selectedCanPlay": "true"
}
```

## 局限

这次本地验证证明移动横屏 H5 页面与选牌链路未被改坏，并且关键合成样式已按修复目标生效。Android WebView 的黑块闪烁属于设备 GPU/WebView 合成表现，仍需要安装到真机 App 后做最终肉眼复核。
