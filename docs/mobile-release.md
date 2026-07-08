# Android 发布速查

这份文档只保留日常自己发版最短路径。底层细节、manifest 结构和环境变量全集仍看 [android-app-build.md](./android-app-build.md)。

## 结论先说

- 单独 OTA：可不改 `package.json.version`；但“更新部署 / 发线上”必须先主动自增产品版本
- OTA 新旧判断：客户端按单调递增的 OTA 内部游标判断；`publishedAt` 只用于审计和展示
- 所有 OTA channel 默认面向**所有已安装版本**；不再按原生版本写 `target/min/max` 门禁
- 如果需要客户端拿到更新后立即切换新 bundle，显式传 `--force-update`
- 更新部署：默认用 `scripts/release/deploy-and-ota.mjs --prepare-version` 同步增加 `package.json.version` 与 Android `androidVersionCode`
- 原生 APK：发版时用 `--bump patch|minor|major` 自动更新版本
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
- 这条命令适合“只补发 OTA / 灰度预演 / 桥接包”这类单独 OTA 场景；如果目标是“更新部署 / 发线上”，应先走 `node scripts/release/deploy-and-ota.mjs --prepare-version`
- OTA manifest 不再写 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`
- 当前项目规则是“所有版本都必须更新”，禁止再发“只给某个原生版本”的 OTA
- 如需修复曾经误发过高 bundle 版本号的旧客户端，使用桥接游标，例如 `--ota-version-base 6.0.0` 或显式 `--version 6.0.0-ota-bridge-...`
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

- 真机测试默认也使用正式包名与正式应用名：
  - `appId = top.easyboardgame.app`
  - `appName = 易桌游`
  - 禁止为了“测试方便”默认改成 `top.easyboardgame.app.debug` 或“易桌游测试”。只有明确需要与正式包并存安装时，才允许单独走测试壳。

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

- `version` 是 bundle 内部游标，不回写仓库版本文件；默认形如 `0.6.0-ota-2026-06-16T01-22-25-293Z`。
- `publishedAt` 是发布时间元数据，只用于审计和展示，不作为客户端升级主判断。
- `--expected-base-version` 仍必须等于 `package.json.version`，用于防止拿错 ref 或拿错产品基线。
- 单独 OTA 可以沿用当前 `package.json.version`，但“更新部署 / 发线上”不再沿用旧产品版本；必须先通过 `deploy-and-ota --prepare-version` 或等价版本 bump 让 `package.json.version` 与 `androidVersionCode` 同步增加，再提交 push。
- `--ota-version-base` 只影响内部游标生成，可与产品版本解耦。遇到旧客户端已经记住 `5.9.0` 这类错误大版本时，发一次 `6.0.0-ota-...` 桥接包，旧逻辑才能收到；后续发布继续让内部游标单调递增。
- 无论走本地脚本还是 GitHub Actions，正式命名口径都必须是 `<ota-version-base>-ota-UTC时间戳` 或人工显式 `--version`；不得改成 `gha-*`、run number 或其他临时别名。
- 这样做的目的，是让 OTA 内部游标继续保持单调递增，同时让正式上线批次有清晰的产品版本基线。

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
- `stable`：正式渠道；与其他 channel 一样，默认面向所有已安装版本，但只能由人工/后台发布动作切换最新包，不能由普通 push 自动触发
- 发布中心里的部署回滚只做控制面，实际执行依赖宿主机上的独立 `boardgame-deploy-runner`；没配 runner 时只能预览，不能执行

## 常见注意点

- `native --bump ...` 会直接改仓库里的 `package.json` 和 `package-lock.json`
- `deploy-and-ota --prepare-version` 会直接改仓库里的 `package.json` 和 `package-lock.json`，其中 `package.json.version` 与 `androidVersionCode` 会同步增加
- `--dry-run` 不能和 `native --bump` 同时用；预演不会改版本文件
- `--skip-build` 只能在你确认本地 release APK 已经是最新时再用
- 如果只是补发某个已上线版本的 H5 修复，可以单独发 OTA；如果口径是“更新部署 / 发线上”，必须先 bump 版本
- 发布 OTA 时，本地存在无关未提交改动不应阻塞已经推送的版本发布；应显式指定已推送的 `git_ref` / `--ref`，并说明这些本地改动不包含在本次 OTA 内。只有未提交改动就是要发的 H5 内容或发布配置时，才必须先提交推送。
- 禁止再把 `stable` OTA 当成“只给某些原生版本”的分流工具；所有版本默认都要能收到 OTA
- 未经老板明确要求，禁止因为切换发布入口（本地脚本 / GitHub Actions）而改变正式 OTA 的用户可见版本命名或展示口径
