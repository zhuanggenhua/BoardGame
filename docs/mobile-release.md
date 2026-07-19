# Android 发布速查

这份文档只保留日常自己发版最短路径。底层细节、manifest 结构和环境变量全集仍看 [android-app-build.md](./android-app-build.md)。

## 结论先说

- 单独 OTA：可不改 `package.json.version`；但“更新部署 / 发线上”必须先主动自增产品版本
- OTA 新旧判断：客户端按单调递增的 OTA 内部游标判断；`publishedAt` 只用于审计和展示
- 所有 OTA channel 面向**所有已安装版本**，并且全部强制更新；不再按原生版本写 `target/min/max` 门禁
- Android OTA 内部游标永久下限为 `6.0.0`；默认发布会自动取 `max(package.json.version, 6.0.0)`，禁止再次降回 `0.6.x` 导致历史客户端无法更新
- 客户端发现新 OTA 后必须阻塞下载并立即切换；`--no-force-update` 已禁用
- 已上线问题默认走“修代码 -> 提交 push -> stable OTA -> 回查线上”；除非用户明确要求，不操作连接设备、不走 ADB 安装
- 更新部署：默认必须走 `node scripts/release/deploy-and-ota.mjs --prepare-version` → 提交 push → `node scripts/release/deploy-and-ota.mjs`；脚本默认触发 CI 构建并由 CI 直接把镜像 tar 输送到服务器后走 `update-local`，再触发 `Android OTA Publish` workflow 发布 Android stable OTA；禁止只跑服务器 `deploy-image.sh update` 或只等普通 push workflow 后汇报完成
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
- 所有 OTA 都会写入 `forceUpdate: true`；`--force-update` 仅作为旧命令兼容参数，可省略
- OTA zip 不携带嵌套游戏图片、图集配置、状态图集 JSON、缩略图和支付二维码；这些资源继续走服务器资源主源或移动游戏包
- 若误传原生版本兼容参数，脚本会直接失败，防止再次误发

完整更新部署：

```bash
node scripts/release/deploy-and-ota.mjs --prepare-version
# 提交并 push 版本改动
node scripts/release/deploy-and-ota.mjs
```

说明：
- “更新部署 / 发线上 / 部署最新”默认指完整更新部署，不是单独服务器更新。
- 完整更新部署必须包含 CI 构建后直传服务器、服务器 `latest` 镜像本地导入并 `update-local`、`Android OTA Publish` workflow 成功发布 `stable` OTA；任一步没执行或失败，都只能汇报“完整上线未完成”。
- 如果用户明确说“不发 OTA / 只更新服务器 / 本次不改版本”，才允许加 `--skip-ota` 或 `--allow-current-version`；汇报时必须说明这是用户缩小后的发布范围。只有用户明确要求“本机输送”时，才加 `--deploy-mode stream` 使用本机拉 GHCR 后上传的 fallback；只有用户明确要求“服务器直接拉镜像”时，才加 `--deploy-mode remote` 使用旧的 GHCR 直拉链路。

超时与续等：

```bash
# 单次 workflow 等待时间不够时，显式提高等待上限
node scripts/release/deploy-and-ota.mjs --workflow-timeout-minutes 45

# 如果上次只是本地等待超时，workflow 还在 GitHub 跑，不要重新触发；按报错里的 run id 续等
node scripts/release/deploy-and-ota.mjs --resume-ci-run-id <id> --resume-ota-run-id <id> --workflow-timeout-minutes 45
```

- `--workflow-timeout-minutes` 也可用 `BG_DEPLOY_WORKFLOW_TIMEOUT_MINUTES` 设置，默认 30 分钟。
- 等待超时只说明本地编排器没等到完成，不等于 GitHub workflow 失败；再次操作前先续等已有 run，避免重复构建、重复上传或重复发 OTA。

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
- `--ota-version-base` 只影响内部游标生成，可与产品版本解耦。Android 默认下限固定为 `6.0.0`；遇到旧客户端已经记住 `5.9.0` 这类错误大版本时，`6.0.0-ota-...` 桥接包才能被识别，后续发布必须继续保持单调递增。
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
- 用户反馈线上 OTA 没更新时，先读取线上 `latest.json`，再核对客户端版本比较规则和内部游标；禁止默认转去安装设备包。若当前 stable 游标低于历史已发高游标，直接发布满足永久下限的桥接 OTA。
- 禁止再把 `stable` OTA 当成“只给某些原生版本”的分流工具；所有版本都要能收到并强制应用 OTA
- 未经老板明确要求，禁止因为切换发布入口（本地脚本 / GitHub Actions）而改变正式 OTA 的用户可见版本命名或展示口径
- 发布前必须把用户点名的现实结果逐项归类到 `server / OTA / game package / native`。横竖屏、方向映射、原生权限、插件、系统栏和返回键属于 native；不能因为本轮没有新增 Android diff，就跳过线上 APK 与目标提交的内容对比。
- 若线上 APK 内的 `assets/game-orientation-map.json` 缺少目标游戏，或线上壳仍使用旧的缺省方向策略，必须发布新 stable native APK；只发 OTA 不能宣称方向问题已修复。
- 发布成功只证明产物已交付。最终必须回到用户原始失败位点验收；例如纸牌帮横屏问题要以更新后的真实 App 页面为准，不能用 workflow、manifest 或 APK 文件存在替代。
- 真机验收前必须读取已安装 App 的 `versionCode / versionName`。线上 native manifest 已更新但设备仍是旧版本时，应明确结论为“设备没有完成原生升级”，不能把 OTA 更新误认成原生壳更新。
- 移动端游戏素材包下载/清理/校验类修复，发布 OTA 后不能只看 `latest.json`、显示更新号或发布说明。必须直接下载线上 OTA zip，反查 bundle 内包含本次修复的关键日志点或代码特征；然后回到原始失败入口点“清理并重新下载”，用 logcat 证明原生调用已走预期分支。例如清理重下修复必须同时看到：H5 清理重下日志、服务层改走完整包日志、原生桥 `install-native-call-dispatch` 里 `fileIndexUrl` 为空，并且不再出现 `incrementalMode=true` / `incremental-file ...`。缺任一项时只能说“发布/验收未闭合”，不得说素材包修好了。
- `adb install -r` 出现 `INSTALL_FAILED_ABORTED: User rejected permissions` 后禁止原样反复重试；应把已验签、已校验 checksum 的正式 APK 放入设备下载目录并打开系统安装器，等待用户解锁和确认。用户未确认前只能标记为真机验收阻塞，不得修改安全设置或绕过锁屏。
- 横竖屏验收必须同时证明目标游戏页面、目标原生 `versionCode` 和系统实际 rotation/orientation；缺少任一项都不能宣称原始问题已修复。
- Docker 镜像构建、Android stable OTA 与 native workflow 总运行时间最多 30 分钟；服务器主源传播验证和镜像部署整步保护同样最多 30 分钟。部署脚本必须限制整次变更操作的总耗时，不能把 game-server 与 web 两个串行镜像各自等待 30 分钟后仍称为“整步 30 分钟”。URL、目标结构、预期大小或摘要等确定性参数错误必须首轮失败，禁止伪装成传播慢持续重试。
