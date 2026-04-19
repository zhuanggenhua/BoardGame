# Dice Throne WebView 91 游戏画布黑屏修复验证

## 背景

- 用户反馈：进入 `王权骰铸` 的创建房间页和教程页时，其他 HUD/UI 仍存在，但**游戏界面黑屏**。
- 复现环境：Android 模拟器 `emulator-5560`
- 系统版本：Android 12（SDK 31）
- WebView：`com.google.android.webview 91.0.4472.114`

## 根因

旧 WebView 91 无法稳定解析 board-shell 这套 CSS 里的除法变量：

- `--mobile-board-shell-scale: calc(var(--runtime-viewport-width) / var(--mobile-board-shell-design-width))`
- `--mobile-board-shell-inverse-scale: calc(1 / var(--mobile-board-shell-scale))`

结果是 `.mobile-board-shell` / `.mobile-board-shell__canvas` / `.mobile-board-shell__content` 高度塌成 `0`，表现为：

- 对局 HUD 还在
- 游戏主画布黑掉
- 不是兼容页拦截，也不是整页没加载

## 修复

- 在 `src/hooks/ui/useRuntimeViewport.ts` 里用 JS 直接预计算 board-shell 缩放值
- 写入旧 WebView 可消费的纯数字 CSS 变量，例如 `0.853385` / `1.1718`
- 在 `src/index.css` 里让高度依赖 `--mobile-board-shell-inverse-scale`，不再依赖 CSS 除法

## 验证命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/components/system/__tests__/GlobalErrorBoundary.test.tsx src/lib/__tests__/androidCompatSmoke.test.ts --configLoader native --maxWorkers 1
npm.cmd run mobile:android:build:debug
$env:ANDROID_SDK_ROOT='C:\Users\zhuagenbao\AppData\Local\Android\Sdk'
npm.cmd run mobile:android:compat:smoke -- --serial emulator-5560 --route /play/dicethrone/local --launch-delay-ms 30000 --output-dir test-results/android-compat-smoke/dicethrone-local-after-shell-fix
npm.cmd run mobile:android:compat:smoke -- --serial emulator-5560 --route /play/dicethrone/tutorial --launch-delay-ms 30000 --output-dir test-results/android-compat-smoke/dicethrone-tutorial-after-shell-fix
```

## 截图证据

### Local 房间页

- 截图：`test-results/android-compat-smoke/dicethrone-local-after-shell-fix/screen.png`
- 观察结论：
  - 左侧英雄列表正常显示，不是黑底。
  - 中间技能板与右侧说明板完整显示，说明主游戏画布已经恢复。
  - 底部 `P1/P2` 选择区正常显示，没有被 rescue gate 友好提示覆盖。

### Tutorial 教程页

- 截图：`test-results/android-compat-smoke/dicethrone-tutorial-after-shell-fix/screen.png`
- 观察结论：
  - 左侧阶段列表、中央技能板、右侧状态区同时可见，说明不是只有悬浮 UI。
  - 教程弹窗显示在真实游戏画布上方，而不是黑底上方。
  - `下一步` 教程按钮可见，页面处于可继续操作状态。

## Smoke 结果

### `/play/dicethrone/local`

- `status=visible-ui`
- `blackScreenSuspected=false`
- `friendlyPromptDetected=false`
- `cdpFinalUrl=http://localhost/play/dicethrone/local?seed=1775231665155-5dcfcysu`

### `/play/dicethrone/tutorial`

- `status=visible-ui`
- `blackScreenSuspected=false`
- `friendlyPromptDetected=false`
- `cdpFinalUrl=http://localhost/play/dicethrone/tutorial`

## CDP 实测尺寸

### Tutorial 页

```json
{
  "viewport": { "width": 802.182, "height": 393.091 },
  "shell": { "width": 940, "height": 393.091 },
  "canvas": { "width": 940, "height": 393.091 },
  "content": { "width": 940, "height": 393.091 },
  "transform": "matrix(1, 0, 0, 1, 0, 0)",
  "scale": "0.853385",
  "inverseScale": "1.1718"
}
```

### Local 页

```json
{
  "viewport": { "width": 802.182, "height": 393.091 },
  "shell": { "width": 940, "height": 393.091 },
  "canvas": { "width": 940, "height": 393.091 },
  "content": { "width": 940, "height": 393.091 },
  "transform": "matrix(1, 0, 0, 1, 0, 0)",
  "scale": "0.853385",
  "inverseScale": "1.1718"
}
```

## 结论

- 这次修复命中了根因，不是只靠友好提示兜底。
- 在 Android 12 + WebView 91 环境下，`王权骰铸` 的教程页和本地房间页都不再出现“主游戏画布黑屏、只剩 HUD”的问题。
- 关键证据不是“页面能打开”，而是 board-shell 的实际高度已从 `0` 恢复为和 viewport 对齐的非零值。
