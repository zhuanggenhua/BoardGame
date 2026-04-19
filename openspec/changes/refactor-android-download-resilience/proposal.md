# Change: 重构 Android 下载链路韧性与商业化就绪度

## Why
- 当前 Android 原生更新包与游戏资源包下载都依赖进程内 `HttpURLConnection` 顺序下载，缺少后台持续执行、断点续传、任务恢复与统一状态机。
- 现状会把“切后台 / 进程被系统回收 / WebView 重建”直接暴露成用户可见的重新发起、进度丢失与失败重试，这不符合商业化产品对下载稳定性的最低要求。
- 项目现有 `embedded + OTA runtime + 按游戏分包` 方向是正确的，但下载基础设施仍停留在原型级实现，需要补齐“可持久、可恢复、可审计”的底座。

## What Changes
- 新增 Android 统一下载基础设施 capability，覆盖 APK 原生更新包、游戏 asset pack、后续可扩展的 module/runtime 包下载。
- 定义下载任务的持久化状态机：创建、排队、下载中、校验中、已完成、失败、已取消、待安装/待激活。
- 要求下载链路支持后台继续、断点续传、App 重启后恢复、系统回收后重连任务，而不是把进行中任务直接视为失败。
- 要求安装/激活继续保持“先下载到 staging、校验通过后原子切换、失败不破坏旧版本”的策略。
- 增加商业化门禁：错误分类、重试退避、用户可见状态、进度来源一致性、日志与诊断字段。

## Impact
- Affected specs:
  - `android-download-management`
- Affected code:
  - `android/app/src/main/java/top/easyboardgame/app/AppUpdatePlugin.java`
  - `android/app/src/main/java/top/easyboardgame/app/GamePackagePlugin.java`
  - `src/lib/mobile/androidNativeUpdates.ts`
  - `src/features/mobile-packages/nativeGamePackagePlugin.ts`
  - `src/features/mobile-packages/packageManagerService.ts`
  - Android 下载状态持久化、后台任务、恢复与诊断模块（新建）
