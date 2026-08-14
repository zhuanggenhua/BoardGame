# 网页加载 App 热更 UI 边界分析（2026-04-04）

## 结论

- 当前问题不是单点组件失控，而是 **“安卓构建模式”** 与 **“真实原生安卓运行时”** 两套概念在代码里并存且混用。
- 只要网页拿到 `MODE=android` 的产物，或浏览器环境被某处桥接对象/Capacitor 运行时误判成原生安卓，就可能看到 App 专属 UI。
- 热更 UI 只是最明显的外溢结果；同类冲突还扩散到了游戏注册表、语言能力、Socket 握手策略、包管理入口、屏幕方向锁定等链路。

## 当前工作区事实

- 当前仓库 `dist/android-build-meta.json` 明确记录：
  - `mode: "android"`
  - `builtAt: "2026-04-04T02:10:51.538Z"`，换算为北京时间是 **2026-04-04 10:10:51**
- 这说明当前工作区最新前端产物就是 **安卓构建物**。
- 仅凭仓库内容，**不能直接证明** 线上网页一定正在使用这份 `dist`，但它显著提高了“网页拿错安卓构建物”这条路径的可信度。

## 直接触发链路

### 链路 A：网页被判成原生安卓后，直接挂载热更 UI

1. `src/lib/mobile/androidRuntime.ts`
   - `detectNativeAndroidRuntime()` 只要满足以下任一条件就返回真：
   - `window.androidBridge` 存在
   - `Capacitor.isNativePlatform() === true && getPlatform() === 'android'`
   - `window.Capacitor.isNativePlatform() === true && getPlatform() === 'android'`
2. `src/App.tsx`
   - `AppContent` 中调用 `isNativeAndroidRuntime()`
   - 若结果为真，就挂载：
   - `AndroidBackNavigationBridge`
   - `AndroidNativeUpdateManager`
   - `AndroidLiveUpdateManager`
3. `src/components/system/AndroidLiveUpdateManager.tsx`
   - 进入后立即注册 OTA 监听，并触发 `startAndroidLiveUpdateBackgroundCheck()`
   - 若 manifest 标记 `forceUpdate=true`，就把 `forceUpdateState.blocking=true`
4. `src/components/system/AndroidForceUpdateGate.tsx`
   - 只要 `blocking=true && phase !== 'hidden'`，直接显示整页强制更新 UI

### 链路 B：网页虽然没挂全局 Gate，但仍会看到 App 更新/包管理入口

1. `src/components/system/GlobalHUD.tsx`
   - 非原生安卓：显示“下载 App”
   - 原生安卓：显示“检查更新”
2. `src/components/lobby/GameDetailsModal.tsx`
   - 直接读取 `window.Capacitor`
   - 若判为原生安卓，则启用 `useGamePackageState({ enabled: true })`
   - 进而显示 `GameDetailsMobilePackageCard` / `GamePackageInstallConfirmModal`
   - 若 `requiresAppUpdate=true`，还会显示 `update-required` 呈现
3. `src/pages/Home.tsx`
   - 若判为原生安卓，会读取 `readAndroidLiveUpdateSnapshot()`
   - 当前 bundle 含 `-ota-` 时，首页右下角版本角标会显示 “首页版本 + App 壳版本”

## 冲突点清单

### P0：运行时误判会直接让网页挂上 OTA / 原生更新整页 Gate

- `src/lib/mobile/androidRuntime.ts`
- `src/App.tsx`
- `src/components/system/AndroidLiveUpdateManager.tsx`
- `src/components/system/AndroidNativeUpdateManager.tsx`

风险：
- 一旦网页环境被误判成原生安卓，用户直接看到 App 更新 UI，且可能触发原生插件导入、更新检查、返回桥监听。

### P0：构建模式与运行时边界混用，导致安卓构建物天然带 App 语义

- `src/config/games.config.tsx`
  - `MODE==='android'` 时直接隐藏工具类游戏
- `src/features/mobile-packages/nativeGamePackagePlugin.ts`
  - 先用 `MODE==='android'` 决定是否继续走原生插件检查
- `src/lib/i18n/types.ts`
  - `MODE==='android'` 时直接把语言能力降成只支持 `zh-CN`
- `src/lib/socketConnectionConfig.ts`
  - `MODE==='android'` 时直接切到更宽松的 polling 策略

风险：
- 即使网页没有被判成原生安卓，只要它跑的是安卓构建物，也会出现 App 专属能力裁剪或行为偏移。

### P1：共享组件没有统一走 `androidRuntime` helper

- `src/components/lobby/GameDetailsModal.tsx`
  - 手写 `window.Capacitor` 探测
- `src/components/common/MobileOrientationGuard.tsx`
  - 手写 `hasCapacitorRuntime()` + 动态 import `@capacitor/core`

风险：
- 同一项目里出现多套运行时判定标准，未来很容易出现 A 组件判网页、B 组件判 App 的分裂状态。

### P1：原生插件注册点与调试链路默认存在

- `src/lib/mobile/androidNativeUpdates.ts`
  - 顶层 `registerPlugin('AppUpdate')`
- `src/features/mobile-packages/nativeGamePackagePlugin.ts`
  - 顶层 `registerPlugin('GamePackage')`
- `src/lib/mobile/mobileRuntimeDebug.ts`
  - 顶层 `registerPlugin('GamePackage')` 用于日志上报

风险：
- 虽然真正调用前有部分门禁，但共享 Web 包里已经包含壳层专属插件接入代码，后续一旦门禁放松就会继续外溢。

## 根因归纳

### 根因 1：系统同时使用了两套边界定义

- 一套是“构建时边界”：`MODE==='android'`
- 一套是“运行时边界”：`Capacitor.isNativePlatform()` / `window.Capacitor` / `window.androidBridge`

两套边界分别被用在不同模块里，没有单一真实来源。

### 根因 2：共享组件没有强制复用统一探测函数

- `App.tsx` 和更新管理器走 `isNativeAndroidRuntime()`
- `GameDetailsModal`、`MobileOrientationGuard` 另写一套探测
- 结果是同一次访问里，不同模块可能得出不同结论

### 根因 3：代码默认假设“安卓构建物不会被网页直接使用”

- 但仓库里已有多处 `MODE==='android'` 的用户可见逻辑
- 这说明当前实现默认相信“安卓构建产物只会跑在壳里”
- 一旦部署链路、远程 WebView、预览环境、静态托管、调试入口让浏览器拿到该产物，就会外溢

## 规范判断

- 现有规范 **已经提出方向**：
  - `AGENTS.md` 已写“App/网页边界隔离（强制）”
  - `.spec/knowledge/standards/global-systems.md` 已写“构建模式不是运行时边界”
- 但当前规范 **还不够可执行**：
  - 没有明确列出禁止模式
  - 没有要求共享组件必须只走统一 helper
  - 没有要求“安卓构建物即使落到网页也必须网页安全”
  - 没有上线前 grep 审计清单

## 建议收口原则

1. 用户可见 UI、自动副作用、原生插件调用，一律只看真实运行时，不看 `MODE==='android'`
2. `MODE==='android'` 只能用于构建裁剪、静态资源裁剪、仅壳内可见的调试入口剔除
3. 所有共享组件必须只复用 `src/lib/mobile/androidRuntime.ts` 的统一 helper
4. 若网页有机会拿到安卓构建物，则该构建物也必须保持网页安全默认值
5. 合并前必须扫一遍：
   - `MODE === 'android'`
   - `window.Capacitor`
   - `registerPlugin(`
   - `isNativePlatform(`
   - `getPlatform(`

## 本轮处理建议

- 不先动业务代码时，优先补规范，明确：
  - 禁止在共享 UI 里手写 `window.Capacitor`
  - 禁止用 `MODE==='android'` 控制用户可见行为
  - 安卓构建物默认也必须是网页安全
  - 新增边界审计清单
