# Android 发布速查

这份文档只保留日常自己发版最短路径。底层细节、manifest 结构和环境变量全集仍看 [android-app-build.md](./android-app-build.md)。

## 结论先说

- OTA：默认不改 `package.json.version`
- 所有 OTA channel 默认面向**所有已安装版本**；不再按原生版本写 `target/min/max` 门禁
- 如果需要客户端拿到更新后立即切换新 bundle，显式传 `--force-update`
- 原生 APK：建议发版时用 `--bump patch|minor|major` 自动更新版本
- 游戏包：继续走 `package.json.version + gameId + 时间戳` 的派生版本
- 日常入口统一走新的包装脚本，避免再手打多条命令和 npm 参数透传坑

## 常用命令

如果不需要额外参数，直接用 npm 包装脚本也可以：

```bash
npm run mobile:android:release:ota
```

如果要传 `channel`、`bump`、`game` 这类参数，优先直接用 `node` 调统一脚本，避免 npm 在 PowerShell 下误吞参数。

只发 OTA：

```bash
node scripts/mobile/release-android.mjs ota --channel stable
```

说明：
- OTA manifest 不再写 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`
- 当前项目规则是“所有版本都必须更新”，禁止再发“只给某个原生版本”的 OTA
- 如需更新后立即切换 bundle，可显式传 `--force-update`
- 若误传原生版本兼容参数，脚本会直接失败，防止再次误发

预演 OTA，不上传：

```bash
node scripts/mobile/release-android.mjs ota --channel gray --dry-run
```

发原生 APK 更新，并把版本升一个 patch：

```bash
node scripts/mobile/release-android.mjs native --channel stable --bump patch
```

只发游戏包：

```bash
node scripts/mobile/release-android.mjs packages --channel stable --game dicethrone
```

一次跑完整链路：OTA -> 游戏包（可选）-> 原生 APK：

```bash
node scripts/mobile/release-android.mjs full --channel stable --with-packages --bump patch
```

## 包装脚本实际做了什么

`ota`

- 先跑 `doctor`
- 再跑 `typecheck`（防止移动端专用分支漏 import / 漏导出在构建期被放过）
- 再跑 `sync`
- 最后直接调用 `publish-android-ota.mjs`

`native`

- 可选先 bump `package.json` / `package-lock.json`
- 跑 `doctor`
- 跑 `typecheck`
- 跑 `build:release`
- 最后直接调用 `publish-android-native-update.mjs`

`packages`

- 直接调用 `publish-android-game-packages.mjs`

`full`

- 固定顺序是 `OTA -> packages(可选) -> native`
- `--with-packages` 或 `--game <gameId>` 才会带上游戏包阶段

## 版本策略

OTA：

- 默认版本形如 `0.5.1-ota-2026-04-05T08-28-06-621Z`
- 无论走本地脚本还是 GitHub Actions，这个正式命名口径都必须保持一致；未经明确要求，不得擅自改成 `gha-*`、run number 或其他临时别名
- 这是 bundle 版本，不回写仓库版本文件
- 这样做的目的，是避免每次发一个 H5 热更新都污染原生版本号

原生 APK：

- 原生版本必须继续以 `package.json.version` 为单一真实来源
- 因为 Android `versionName` / `versionCode` 就是从这里推导
- 所以包装脚本只支持 `--bump patch|minor|major`，不支持用 `--version` 单独覆盖原生版本

游戏包：

- 继续走 `package.json.version + gameId + 时间戳`
- 如果你需要和某次 native bump 绑定得更紧，就在 bump 后单独再发一次 packages

## channel 建议

- `edge`：日常自测或刚合并后的快速验证
- `gray`：给测试机、小范围用户先吃
- `stable`：正式渠道；与其他 channel 一样，默认面向所有已安装版本

## 常见注意点

- `native --bump ...` 会直接改仓库里的 `package.json` 和 `package-lock.json`
- `--dry-run` 不能和 `native --bump` 同时用；预演不会改版本文件
- `--skip-build` 只能在你确认本地 release APK 已经是最新时再用
- 如果只需要发 H5 修复，优先发 OTA，不要顺手 bump 原生版本
- 禁止再把 `stable` OTA 当成“只给某些原生版本”的分流工具；所有版本默认都要能收到 OTA
- 未经老板明确要求，禁止因为切换发布入口（本地脚本 / GitHub Actions）而改变正式 OTA 的用户可见版本命名或展示口径
