# Dice Throne 低版本布局回退本地核对

## 范围

- 目标：验证 Dice Throne 在移动横屏下，关键布局容器不再依赖旧 WebView 的原始 `vw` 计算结果而塌缩。
- 本轮改动范围：
  - `src/games/dicethrone/ui/CenterBoard.tsx`
  - `src/games/dicethrone/ui/DiceThroneHeroSelection.tsx`

## 验证命令

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/dicethrone-tutorial-simple.e2e.ts "Tutorial starts and shows initial steps"
```

## 截图证据

- 本地教程棋盘截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\manual-screenshots\dicethrone-tutorial-board-after-runtime-unit.png`
- 选角横屏 E2E 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\mobile-character-selection\character-selection-mobile-landscape.png`
- 历史旧 Android/WebView 兼容烟测截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\android-compat-smoke\dicethrone-local-after-shell-fix\screen.png`

## 人工观察结论

### `dicethrone-tutorial-board-after-runtime-unit.png`

- 页面没有退化为“只有悬浮控件、中央整块纯黑空白”的完全黑屏；左侧步骤栏、顶部对手条、右侧操作区、中央双板容器都已挂载。
- 中央玩家板与提示板容器仍然居中并保持成对关系，没有出现宽高被算成 0 的塌缩状态。
- 本地开发环境下美术资源没有完整渲染，中央板面显示为深色占位块；因此这张图只能证明“布局骨架仍在、页面未整体黑掉”，不能作为贴图细节验收图。

### `mobile-character-selection/character-selection-mobile-landscape.png`

- 选角页在手机横屏宽度下没有顶层横向滚动，左侧英雄栏、中央玩家板、右侧提示板、底部玩家条都完整落在视口内。
- 玩家板与提示板之间的主布局关系稳定，没有出现提示板被压缩到不可读、飞出屏幕、或被底部玩家条挤歪的现象。
- 底部玩家条保持居中，右下角放大按钮与右侧提示板均仍可见，说明这次 runtime 单位替换没有把交互热区挤出屏幕。

### `android-compat-smoke/.../screen.png`

- 旧 Android/WebView 历史截图里，左侧英雄栏、中央玩家板/提示板、底部玩家条三块主布局关系完整。
- 中央提示板保持在玩家板右侧，没有明显飞出视口或被压到不可见。
- 这张图说明低版本环境不是必然全黑，真正风险点更像是关键容器的 `vw`/位移计算不稳，而不是整页无法渲染。

## 当前结论

- 这轮改动已经把 Dice Throne 两个真实命中的核心布局容器继续切到 runtime 单位，优先兜住“中央棋盘/提示板尺寸与位移”以及“选角主容器/底部玩家条”的旧 WebView 回退。
- 目前可确认：
  - 类型检查通过。
  - 现成教程 E2E 通过。
  - 现成手机横屏选角 E2E 通过，并拿到带素材的稳定截图。
  - 本地教程棋盘截图未出现整体黑屏，布局骨架仍在。
- 目前仍未拿到“改动后真实旧 WebView 设备”的新截图，因为本机 Android Emulator 到 adb 的桥接仍卡在 `Unable to connect to adb daemon on port: 5037`。
