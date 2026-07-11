## Context
- 当前发布侧已经不是空白状态：`scripts/mobile/publish-android-game-packages.mjs` 会从 `public/assets` 中筛选 package-managed 游戏资源，生成完整 ZIP、`file-index/*.json`，并把 `fileIndexUrl/fileIndexChecksum` 写入游戏包 manifest。
- 当前 R2 单文件上传链路也已经能识别受影响的 package-managed 游戏：`scripts/assets/upload-to-r2.js` 会把资源上传到 `official/<relativePath>`，并在检测到游戏资源变更后调用 `publish-android-game-packages.mjs --game <gameId> --reuse-shared-audio`。
- 当前客户端 JS 侧已具备增量入口：`nativeGamePackagePlugin.ts` 在 manifest 有 `assetPackFileIndexUrl` 时调用 `installGamePackageIncremental`，旧原生壳不支持该方法时回退全量安装。
- 当前 Android 原生侧已具备任务字段和入口壳：`GamePackagePlugin.installGamePackageIncremental`、`AndroidDownloadTaskRecord.installMode/fileIndexUrl/fileIndexChecksum/assetBaseUrl`、`GamePackageFs.INSTALLED_FILES_INDEX_FILE` 已存在。
- 当前缺口不是“从零新增 file-index”，而是：日常 R2 单文件更新后仍默认重发完整 ZIP；提案、任务和验收没有把“真实差异安装”与“全量兜底刷新”分开。

## Goals / Non-Goals
- Goals:
  - R2 单文件资源更新后，能刷新对应游戏或共享音频包的远端 `file-index` 与最新 manifest，不把完整 ZIP 重发作为默认动作。
  - App 更新 package-managed 游戏素材时，根据远端 `file-index` 与本地 `installed-files-index.json` 只下载新增或哈希变化文件。
  - 差异安装完成后，本地 `current/assets` 的完整文件集合、路径合同和哈希结果必须等价于同版本全量 ZIP 安装。
  - 完整 ZIP 保留为首装、历史客户端兼容、增量不可用、索引损坏、文件下载失败或校验失败时的 fallback。
  - 发布/验收口径必须区分“差异更新已完成”和“全量 ZIP 兜底已刷新”，避免再把兜底当成根因修复。
- Non-Goals:
  - 不做字节级 patch（bsdiff/bspatch）；本轮只做文件级差异。
  - 不改变 APK / AAB 原生应用更新方式。
  - 不改变 OTA web bundle 更新方式。
  - 不删除现有完整 ZIP 发布能力。
  - 不要求一次性迁移所有历史已安装包；没有本地索引或索引损坏的设备继续走全量兜底。

## Decisions

### Decision: 远端 file-index 是 App 素材包更新真相源
- R2 上的单文件对象负责承载实际素材内容，`mobile-packages/android/<channel>/file-index/...json` 负责描述目标版本完整文件集合，`games/<gameId>.json` 负责把 App 指到当前目标版本。
- `assetPack.url` 指向完整 ZIP，但在已有索引和本地安装状态可用时不再代表默认下载路径。
- 理由：
  - 当前发布脚本已经生成 `fileIndexUrl/fileIndexChecksum`，继续使用这条已有链路风险最低。
  - 商业游戏常见做法也是 CDN 内容对象 + 版本 catalog / manifest + 文件或 bundle 级差异更新，完整包只作为 bootstrap/fallback。

### Decision: `assets:upload` 默认触发索引/manifest 差异刷新
- 当 `upload-to-r2.js` 上传 package-managed 游戏资源后，后续动作应按影响范围刷新：
  - 单个游戏资源变化：刷新该游戏的远端 `file-index` 与 `games/<gameId>.json`。
  - 共享音频变化：刷新共享音频索引，并刷新依赖共享音频的游戏 manifest 指针。
  - 强制重建、首次发布、兼容兜底：允许继续生成并上传完整 ZIP。
- 需要为发布脚本提供 index/manifest-only 路径，避免“为了改一张图重新上传 400MB ZIP”成为默认行为。
- 理由：
  - 用户实际资源使用 R2，不是本地文件；只改本地资源不能算修复完成。
  - 如果每次小素材替换都重发完整 ZIP，App 即使能更新，也不是差异化更新。

### Decision: 原生侧负责文件级下载、合并、裁剪和原子切换
- Android 原生层使用远端 `file-index` 与本地 `installed-files-index.json` 生成变更列表。
- 变更文件从 `assetBaseUrl + '/' + file.path` 下载；未变更文件从当前安装目录复制到 staging。
- 合并完成后按远端 `file-index` 校验完整文件集合，删除远端索引中不存在的旧文件，再原子切换到 `current/assets`。
- 理由：
  - 原生层拥有可靠文件系统权限和后台下载队列，适合处理大文件、断点/失败、临时目录和原子切换。
  - JS 层只负责决策、状态订阅和回退，不应承担大量本地文件 I/O。

### Decision: fallback 必须显式标注为兜底
- 以下情况走完整 ZIP：
  - 远端 manifest 缺少 `fileIndexUrl`。
  - 本地没有可用 `installed-files-index.json`。
  - 远端 `file-index` 下载或 `fileIndexChecksum` 校验失败。
  - 单文件下载失败超过重试上限。
  - 合并后完整校验失败。
  - 当前原生壳不支持 `installGamePackageIncremental`。
- 文档、日志、用户汇报里必须称为“回退全量 / 兜底刷新”，不能称为“差异更新完成”。
- 理由：
  - 全量 ZIP 能恢复可用性，但不能证明差异链路生效。
  - 这次 DiceThrone 素材事故的关键教训就是不能把本地或兜底结果当成真实 App 更新链路已闭环。

## Architecture

### 当前已存在链路
```text
public/assets
  ├─ upload-to-r2.js -> official/<relativePath> 单文件对象
  └─ publish-android-game-packages.mjs
       ├─ bundles/<gameId>/<version>.zip
       ├─ file-index/<gameId>/<version>.json
       └─ games/<gameId>.json assetPack.fileIndexUrl

App JS
  └─ nativeGamePackagePlugin.ts
       ├─ 有 assetPackFileIndexUrl -> installGamePackageIncremental
       └─ 增量接口不可用 -> installGamePackage 全量

Android native
  ├─ AndroidDownloadTaskRecord installMode/fileIndexUrl/fileIndexChecksum/assetBaseUrl
  ├─ GamePackageFs installed-files-index.json
  └─ 需要补强真实文件级下载、合并、裁剪、校验、原子切换验收
```

### 目标发布流
```text
替换一张 DiceThrone 火法玩家面板
  1. 压缩并上传 R2 单文件对象
  2. 检测到该路径属于 dicethrone
  3. 重新生成 dicethrone 目标 file-index
  4. 更新 mobile-packages/android/<channel>/games/dicethrone.json
  5. 不默认上传新的完整 ZIP
  6. App 拉取 manifest 后只下载火法面板相关变更文件
```

### 目标安装流
```text
远端 file-index + 本地 installed-files-index
  -> 计算 changedFiles / removedFiles / reusedFiles
  -> changedFiles 从 R2 单文件 URL 下载到 staging/assets
  -> reusedFiles 从 current/assets 复制到 staging/assets
  -> removedFiles 不进入 staging
  -> 按远端 file-index 校验完整 staging/assets
  -> 写 staging/installed-files-index.json
  -> 原子切换 staging -> current
```

### 路径合同
- `file-index.files[].path` 必须继续使用相对于 `public/assets` 的路径，例如：
  - `i18n/zh-CN/dicethrone/images/pyromancer/compressed/player-board.webp`
  - `atlas-configs/dicethrone/ability-cards-common.atlas.json`
  - `common/audio/bgm/...`
- R2 单文件对象 key 必须是 `official/` + 上述相对路径。
- 原生落盘必须是 `current/assets/` + 上述相对路径。
- H5 通过 `readInstalledAsset(gameId, relativePath)` 读取时也必须传同一份相对路径。

## Risks / Trade-offs
- `assets:upload` 触发 manifest/index-only 后，如果没有同时保留完整 ZIP 兜底，旧客户端可能无法更新；因此完整 ZIP 不能删除，只是不作为默认小素材更新路径。
- 对大量小文件变更，文件级下载可能比单 ZIP 慢；需要限制并发数并保留全量 fallback。
- 本地 `installed-files-index.json` 是差异更新关键状态，必须原子写入；损坏时应清楚回退全量。
- 如果远端单文件对象和 `file-index` 不一致，App 可能下载到错误版本；发布脚本必须把变更对象、file-index 和 manifest 原子写入服务器 release，并在报告成功前读取本次 file-index 正文校验大小和 SHA-256，不能用旧 fallback ZIP 代替。

## Migration Plan
1. 调整 OpenSpec 与文档口径：明确当前已有 `file-index` 基础设施，目标是接通差异更新闭环。
2. 扩展发布脚本：增加 index/manifest-only 或等价模式，允许 R2 单文件更新后刷新目标 manifest 而不上传完整 ZIP。
3. 调整 `upload-to-r2.js`：默认对 package-managed 资源变更触发差异索引刷新；只有显式参数或必要场景才重发完整 ZIP。
4. 补强 Android 原生安装：实现或核准真实文件级 diff、单文件下载、复用、裁剪、完整校验和原子切换。
5. 补状态与日志：区分 `incremental`、`full fallback`、`full bootstrap`，让用户和日志能看出这次到底下载了多少变更文件。
6. 验证 DiceThrone 单图替换：替换火法玩家面板后，R2 单文件、远端 manifest/file-index、App 安装日志和本地文件哈希都证明只下载差异文件。

## Open Questions
- index/manifest-only 是否仍生成一个“逻辑版本号”，还是使用 file-index checksum 作为素材包内容版本？
- 单文件下载并发数默认设为多少，才能兼顾弱网稳定性和速度？
- 共享音频变化时，是否允许只刷新共享音频包 manifest，并让游戏 manifest 指针复用最新共享音频版本，而不刷新每个游戏的独立 assetPack 版本？
