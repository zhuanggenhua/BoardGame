# Change: 接通游戏资源包文件级差异更新

## Why
- DiceThrone 素材更新暴露出一个发布链路缺口：只改本地资源，或只证明远端旧对象可读，都不等于 App 已安装素材包会同步更新。
- 当前目标已经从对象存储迁移到服务器资源主源；因此增量素材包也必须以服务器单文件对象、远端 `file-index` 和 App 本地已安装索引作为同一条真相链。
- 差异更新失败不能静默变成“没有更新”，也不能把完整 ZIP 兜底说成差异更新成功。

## What Changes
- 将现有提案从“对象存储单文件更新驱动差异 manifest”改为“服务器单文件对象驱动差异 manifest”。
- 明确服务器单文件对象 + `file-index` 是 App 素材包更新真相源；`assetPack.url` 的完整 ZIP 只作为首装、旧客户端兼容和失败兜底。
- 调整 `assets:upload` 后续行为：检测到 package-managed 游戏资源变更时，默认刷新对应游戏的远端 `file-index` 与最新 manifest；只有首发、强制重建、旧客户端兼容或明确兜底才重发完整 ZIP。
- 补齐客户端验收合同：App 必须根据远端 `file-index` 与本地 `installed-files-index.json` 比对，只下载新增或哈希变化文件，合并后校验完整文件集合等价于全量包。
- 增量失败仍可回退完整 ZIP，但 UI、日志、文档和汇报必须称为“全量兜底 / full fallback”，不能称为“差异更新完成”。
- 发布验收必须回到服务器公开域名、清单正文大小、SHA-256 和必要 CORS 预检，不能用旧完整包或旧清单可读替代。

## Impact
- Affected specs:
  - `game-package-incremental-update`
  - `asset-manifest`
  - `game-asset-preloading`
- Affected code:
  - `scripts/assets/upload-to-server.js` — 服务器单文件发布后识别受影响游戏，并触发索引/manifest 差异刷新而非默认全量 ZIP 重发。
  - `scripts/mobile/publish-android-game-packages.mjs` — 保留 ZIP + file-index 发布能力，新增或明确 manifest/index-only 路径。
  - `src/features/mobile-packages/nativeGamePackagePlugin.ts` — 继续以 `assetPackFileIndexUrl` 调用原生增量入口，并准确区分增量不可用回退与真实差异安装。
  - `src/features/mobile-packages/packageManagerService.ts` — 安装状态和进度需要能表达文件级差异更新，不只表达整包下载。
  - Android 原生层 `GamePackagePlugin` / `AndroidDownloadForegroundService` / `GamePackageFs` — 用远端 file-index 与本地 installed-files-index 完成文件级下载、合并、裁剪、校验和原子切换。
  - `docs/ai-rules/asset-pipeline.md` / `docs/android-app-build.md` — 固化“本地资源、服务器对象、App 素材包 manifest/file-index 必须同步”的发布口径。
