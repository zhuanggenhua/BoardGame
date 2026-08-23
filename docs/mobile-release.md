# Android 发布速查

本文只保留日常发布的最短入口和验收口径。更完整的执行流程由项目 skill 维护：[`android-app-release`](../.spec/skills/android-app-release/SKILL.md) 与 [`deploy-after-ci`](../.spec/skills/deploy-after-ci/SKILL.md)。底层环境变量、manifest 和包体事实见 [`android-app-build`](android-app-build.md)。

## 先判目标

| 用户目标 | 默认交付 |
| --- | --- |
| 只改 H5 / 页面 / 规则前端 | Android stable OTA |
| 改原生壳、插件、权限、系统栏、返回键、方向映射 | native APK / AAB |
| 更新部署 / 发线上 / 部署最新 | 服务器生产部署 + Android stable OTA |
| 只更新服务器 / 不发 OTA | 服务器部署，必须显式说明缩小范围 |
| 游戏素材包、共享音频包 | 游戏包 / 共享包发布，不等同 OTA |

发布前把目标拆成 `server / OTA / native / game package / device`。哪一项没做，最终汇报就不能说那一项完成。

## 常用命令

只发 OTA：

```bash
node scripts/mobile/release-android.mjs ota --channel stable
```

完整更新部署：

```bash
node scripts/release/deploy-and-ota.mjs --skip-wait
```

正式商业产品版本或原生壳版本发布才自增版本：

```bash
node scripts/release/deploy-and-ota.mjs --prepare-version
# 提交并 push package.json / package-lock.json
```

只更新服务器或不发 OTA：

```bash
node scripts/release/deploy-and-ota.mjs --skip-ota
```

发原生 APK 并自增版本：

```bash
node scripts/mobile/release-android.mjs native --channel stable --bump patch
```

只发游戏包：

```bash
node scripts/mobile/release-android.mjs packages --channel stable --game <gameId>
```

本地等待超时但 GitHub workflow 仍在跑时，续等已有 run，不要重新触发：

```bash
node scripts/release/deploy-and-ota.mjs --resume-ci-run-id <id> --resume-ota-run-id <id> --workflow-timeout-minutes 45
```

## 当前固定口径

- `stable` OTA 面向所有已安装版本，全部强制更新；不再使用 native version 的 `target / min / max` 分流。
- Android OTA 内部游标最低按 `6.0.0` 处理，避免历史高游标客户端拒绝更新。
- OTA `version` 是客户端比较用内部游标；`displayVersion` 是用户可见更新号；`productVersion` 是商业产品版本展示值；`publishedAt` 只用于展示和审计。
- “更新部署 / 发线上”不要求自增产品版本；服务器部署版本看 git ref / 镜像，OTA 包版本在上传时生成或显式传入。
- Web 和 Android 业务后端统一使用 `VITE_BACKEND_URL`；迁移期旧别名不得与它分叉。
- 真机测试默认也使用正式壳：`appId = top.easyboardgame.app`，`appName = 易桌游`。测试壳只能在用户明确要求并存安装时使用。
- Docker 镜像构建、服务器部署、Android stable OTA、native workflow 的单轮等待上限按 30 分钟处理；确定性参数错误必须直接失败。

## 验收口径

OTA 发布后至少回查：

- 域名控制入口 `latest.json` 返回本次新正文，无 30x。
- bundle URL 可读，`checksum`、`size` 和发布脚本输出一致。
- `OPTIONS latest.json` 允许客户端实际请求头。
- 必要时下载线上 OTA zip，确认包内含本次改动的关键代码或日志点。

native 发布后至少回查：

- 线上 `native-app-updates/android/<channel>/latest.json` 的 `version / versionCode / url / checksum / size`。
- 下载 `latest.json.url` 指向的 APK，确认正式 appId、正式应用名和目标原生内容。
- 设备验收前读取已安装 App 的 `versionCode / versionName`；设备仍是旧版本时只能说“设备尚未升级”。

完整更新部署完成必须同时具备：

- 目标提交或镜像来源明确。
- 生产容器和健康接口通过。
- Android stable OTA workflow 成功。
- OTA 控制入口和 bundle 回查通过。
- 回到用户原始失败位点验证。

## 常见误判

- 本地构建成功不等于已上传、已发包或旧设备可更新。
- `latest.json` 指向新版本不等于 APK 是正式壳，必须验包。
- OTA 不会更新原生插件、权限、方向映射、系统栏和返回键。
- IP 下载源可作为新客户端兜底；旧客户端控制入口仍看固定域名直返 JSON。
- 发布成功只证明产物交付，不能替代用户原始问题的现实验收。
