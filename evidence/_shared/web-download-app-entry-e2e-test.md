# 网页端下载 App 入口 E2E 证据

## 范围

- 页面：网页端大厅首页
- 目标：`下载 App` 入口不再依赖旧的百度网盘环境变量文案，而是优先读取 `VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL` 指向的 `latest.json`，再打开其中的 APK 地址
- 用例：`e2e/_shared/lobby.e2e.ts` `网页端下载 App 入口会读取 native update latest.json 并打开其中 APK 地址`

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/_shared/lobby.e2e.ts "网页端下载 App 入口会读取 native update latest.json 并打开其中 APK 地址"
```

## 截图证据

### 1. 大厅右侧悬浮菜单可见下载入口

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\网页端下载-App-入口会读取-native-update-latest.json-并打开其中-APK-地址\lobby-download-app-entry-visible.png`
- 我实际看到什么：桌面端大厅右侧悬浮菜单已展开，设置主入口右侧同列可见下载箭头图标，说明网页端确实渲染了 `下载 App` 动作入口，而不是原生端的“检查更新”入口。
- 我实际看到什么：截图中没有出现“下载链接待配置，先把百度网盘地址填到环境变量里”这类旧提示 toast。
- 是否达到验收标准：达到。入口位置和网页端分支都正确显示，问题位点已经不再停留在旧的网盘占位语义。

## 运行时断言证据

- 本用例对 `https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json` 做了路由拦截，返回：

```json
{
  "version": "0.5.1",
  "url": "https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk",
  "channel": "stable"
}
```

- 点击 `下载 App` 后，测试没有读取旧的百度网盘直链，而是记录到 `window.open(...)` 被调用且唯一目标 URL 为：

```text
https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk
```

- 是否达到验收标准：达到。网页端下载入口已经按 `latest.json -> APK url` 的链路工作。

## 结论

- 网页端 `下载 App` 已改为优先走 R2 `native-app-updates/android/stable/latest.json`。
- `VITE_ANDROID_APP_DOWNLOAD_URL` 现在只作为兜底直链，不再是主链路。
- 本轮 E2E 已证明：点击下载入口时，实际打开的是 `latest.json` 提供的最新 APK 地址。
