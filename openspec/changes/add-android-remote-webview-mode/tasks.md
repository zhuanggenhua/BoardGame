## 1. Contract

- [x] 1.1 定义 Android 壳 `embedded` / `remote` 双模式的配置契约与必填项
- [x] 1.2 约束 `remote` 模式必须提供绝对 HTTPS URL，`embedded` 模式继续使用本地 `dist`

## 2. Build Chain

- [x] 2.1 调整移动构建脚本，使其按模式生成 Capacitor 配置并输出清晰的模式信息
- [x] 2.2 调整 Android Gradle 校验逻辑，仅在 `embedded` 模式要求 `dist` 与 `assets/public` 同步
- [x] 2.3 保持 `mobile:android:build:release` 在两种模式下都可直接完成正式发包

## 3. Documentation

- [x] 3.1 更新 `docs/android-app-build.md`，说明两种模式的构建入口、适用场景与限制
- [x] 3.2 更新 `docs/deploy.md`，说明 `remote` 模式对 HTTPS、同域/CORS 与回滚流程的依赖

## 4. Verification

- [ ] 4.1 验证 `embedded` 模式仍会阻止过期前端资源被打进 APK
- [x] 4.2 验证 `remote` 模式可在不执行 `mobile:android:sync` 的情况下完成 Android 发包
