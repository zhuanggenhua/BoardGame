## Context

当前 Android 发包链围绕“内嵌 H5 资源”设计：

- `capacitor.config.json` 只声明 `webDir = dist`
- `npm run mobile:android:sync` 会构建 Android 专用 `dist`
- 构建产物会复制到 `android/app/src/main/assets/public`
- `android/app/build.gradle` 会阻止任何“`dist` 与 `assets/public` 不一致”的构建

这套链路对稳定发行是合理的，但它把 Android 壳和一次具体的前端构建强绑定。对当前“不开商店、前端更新频率高”的场景，这会把每次 Web 发布都放大成一次 APK 重发。

## Goals / Non-Goals

- Goals:
  - 为 Android 壳提供正式的 `embedded` / `remote` 双模式
  - 保持 H5 仍然是唯一前端运行时，不新增第二套 App UI
  - 让 `remote` 模式可以直接加载已部署的 HTTPS 页面，减少 APK 重发频率
  - 保留 `embedded` 模式，作为离线与稳定发版路径

- Non-Goals:
  - 不在本次变更中实现热更新/OTA 资源包下载
  - 不引入 App 专属页面或 App 专属路由
  - 不修改游戏级移动适配框架
  - 不承诺 `remote` 模式下的离线可用性

## Decisions

### 1. Android 壳采用显式双模式，而不是隐式推断

最正确方案是用单一配置源显式声明 Android 壳当前处于：

- `embedded`
- `remote`

而不是靠开发者手动改 `capacitor.config.json`、临时注释 Gradle 校验或手动判断要不要执行 `mobile:android:sync`。

建议配置至少包含：

- `ANDROID_WEBVIEW_MODE=embedded | remote`
- `ANDROID_REMOTE_WEB_URL=https://...`（仅 `remote` 模式必填）

### 2. `remote` 模式直接使用 Capacitor `server.url`

`remote` 模式下，Android 壳应直接加载线上 HTTPS 页面，而不是把远程页面再下载到本地目录伪装成本地资源。

原因：

- 这是最短路径，能立刻消除“每次前端更新都要重发 APK”的问题
- 与项目“App WebView 只是 H5 容器”的定位一致
- 实现复杂度显著低于热更/OTA

### 3. `embedded` 模式继续保留现有同步校验

当前 `dist/android-build-meta.json` 与 `assets/public/android-build-meta.json` 的一致性校验是有价值的，不能因为新增 `remote` 模式就整体删除。

因此最正确方案不是“放松所有校验”，而是：

- `embedded` 模式保留现有严格校验
- `remote` 模式跳过这组只对内嵌资源有意义的校验

### 4. 不在本次变更中实现热更

热更不是当前最短路径。

它需要额外解决：

- 资源包签名与完整性校验
- 本地版本切换与回滚
- 包下载失败恢复
- 私有目录解压与清理
- 内嵌版本与热更版本的优先级

这些都比“直接远程加载线上 H5”复杂得多。当前需求的核心是减少 APK 更新频率，因此先做 `remote` 模式是更正确的顺序。

## Risks / Trade-offs

- `remote` 模式下，Android 端会与线上 Web 同步更新，错误发布会立刻影响手机端
- `remote` 模式依赖网络与 HTTPS，可用性不如 `embedded`
- 如果线上入口、API 域名或 `WEB_ORIGINS` 配置不一致，会直接暴露为 WebView 加载失败或接口/CORS 问题

## Migration Plan

1. 定义 Android 壳加载模式配置与校验规则
2. 调整移动脚本与 Capacitor 配置生成逻辑，使其支持两种模式
3. 让 Gradle 仅在 `embedded` 模式执行资源同步校验
4. 补充文档，明确两种模式的构建、部署与回滚方式
5. 用一次 `embedded` 构建和一次 `remote` 构建验证两条链路

## Open Questions

- `remote` 模式是否需要保留一个最小本地兜底页，用于线上站点不可达时提示用户
- Android 壳的当前模式是否需要在构建元数据或 App 设置页中显式展示
