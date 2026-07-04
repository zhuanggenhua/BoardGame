# Change: 接通游戏资源包文件级差异更新

## Why
- DiceThrone 这次素材问题暴露出一个发布链路缺口：只改本地资源或只上传 R2 单文件，不等于 App 已安装素材包会同步更新。
- 当前仓库已经具备一部分基础设施：`publish-android-game-packages.mjs` 会生成并上传 `file-index`，游戏包 manifest 已携带 `fileIndexUrl/fileIndexChecksum`，JS 侧也会在有文件索引时调用原生增量安装入口。
- 但当前日常资源上传链路仍会在 package-managed 游戏资源变更后触发完整游戏 ZIP 重发；这只能兜底刷新 App 素材包，不能满足“R2 更新时 App 资源包差异化更新”的目标。
- 目标是把 R2 单文件对象、移动端 file-index 和 App 本地已安装文件索引接成同一条真相链：小素材替换只更新索引和变更文件，App 只下载缺失或哈希变化文件；完整 ZIP 只作为首装、兼容和失败回退。

## What Changes
- 将现有 `add-incremental-game-package-update` 提案从“新增索引能力”校准为“接通已存在索引基础设施的差异更新闭环”。
- 明确 R2 单文件对象 + `file-index` 是 App 素材包更新的单一真相源；`assetPack.url` 的完整 ZIP 保留为 bootstrap/fallback，不作为每次素材替换的默认更新载体。
- 调整 `assets:upload` 后续行为：检测到 package-managed 游戏资源变更时，默认刷新对应游戏的远端 `file-index` 与最新 manifest；只有首发、强制重建、共享音频或兼容兜底才重发完整 ZIP。
- 补齐客户端验收合同：App 必须根据远端 `file-index` 与本地 `installed-files-index.json` 比对，只下载新增/变更文件，合并后校验完整文件集合等价于全量包。
- 增量失败仍必须自动回退全量 ZIP，但回复、日志和文档必须称为“回退/兜底”，不能把全量重发描述为差异化更新已完成。

## Impact
- Affected specs:
  - `game-package-incremental-update`
  - `asset-manifest`
  - `game-asset-preloading`
- Affected code:
  - `scripts/assets/upload-to-r2.js` — R2 单文件上传后识别受影响游戏，并触发索引/manifest 差异刷新而非默认全量 ZIP 重发。
  - `scripts/mobile/publish-android-game-packages.mjs` — 保留现有 ZIP + file-index 发布能力，新增或明确 manifest/index-only 路径。
  - `src/features/mobile-packages/nativeGamePackagePlugin.ts` — 继续以 `assetPackFileIndexUrl` 调用原生增量入口，并准确区分增量不可用回退与真实差异安装。
  - `src/features/mobile-packages/packageManagerService.ts` — 安装状态和进度需要能表达文件级差异更新，不只表达整包下载。
  - Android 原生层 `GamePackagePlugin` / `AndroidDownloadForegroundService` / `GamePackageFs` — 用远端 file-index 与本地 installed-files-index 完成文件级下载、合并、裁剪、校验和原子切换。
  - `docs/ai-rules/asset-pipeline.md` / `docs/android-app-build.md` — 固化“本地资源、R2 对象、App 素材包 manifest/file-index 必须同步”的发布口径。
