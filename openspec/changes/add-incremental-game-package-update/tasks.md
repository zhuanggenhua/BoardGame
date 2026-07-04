## 1. 现状确认
- [x] 1.1 确认 `publish-android-game-packages.mjs` 已生成完整 ZIP、`file-index` 和带 `fileIndexUrl/fileIndexChecksum` 的游戏包 manifest
- [x] 1.2 确认 `upload-to-r2.js` 已能识别 package-managed 游戏资源变更并触发游戏包刷新
- [x] 1.3 确认 JS 侧已有 `assetPackFileIndexUrl -> installGamePackageIncremental` 调用入口
- [x] 1.4 确认 Android 原生侧已有增量安装入口、下载任务字段和 `installed-files-index.json` 文件名

## 2. 发布侧：R2 单文件更新驱动差异 manifest
- [x] 2.1 为 `publish-android-game-packages.mjs` 增加 index/manifest-only 或等价模式，允许刷新 `file-index` 与 latest manifest 而不默认上传完整 ZIP
- [x] 2.2 调整 `upload-to-r2.js` 的 package-managed 后续动作：普通游戏素材变更默认触发差异索引刷新，不默认重发完整 ZIP
- [x] 2.3 保留完整 ZIP 显式重建路径，用于首次发布、强制修复、旧客户端兼容和增量失败 fallback
- [ ] 2.4 生成 manifest 前校验 R2 单文件对象与目标 `file-index` 路径合同一致

## 3. 客户端：真实文件级差异安装
- [x] 3.1 Android 原生层读取远端 `file-index` 并校验 `fileIndexChecksum`
- [x] 3.2 Android 原生层读取本地 `installed-files-index.json`，计算 changed/reused/removed 文件集合
- [x] 3.3 Android 原生层只下载 changed 文件，并从当前安装目录复用 reused 文件
- [x] 3.4 Android 原生层按远端 `file-index` 裁剪 removed 文件并校验完整 staging 文件集合
- [x] 3.5 Android 原生层写入新的 `installed-files-index.json` 并原子切换到 `current/assets`
- [x] 3.6 增量失败时回退完整 ZIP，并在状态/日志中标注为 full fallback

## 4. 状态、文档与验收
- [x] 4.1 JS/原生日志区分 incremental、full bootstrap、full fallback
- [ ] 4.2 安装进度展示变更文件数、变更字节数和 fallback 状态
- [x] 4.3 更新 `asset-pipeline` / Android 发布文档，固化“R2 单文件 + file-index + App 素材包 manifest”单一真相链
- [x] 4.4 增加发布侧测试：单文件变更只刷新目标游戏索引/manifest，不默认生成新 ZIP
- [ ] 4.5 增加客户端测试或真机验收：DiceThrone 火法面板单图替换只下载变更文件，本地哈希与远端 file-index 一致
