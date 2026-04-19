# Change: 游戏资源包文件级增量更新

## Why
- 当前 `GamePackage` 安装流程每次全量下载整个 asset pack zip，游戏资源（图集 + 音频）单包可达几十 MB，更新时用户必须重新下载完整包体。
- 全量下载导致：下载耗时长、流量消耗大、弱网环境失败率高（此前 "no package / download failed" 问题部分根因即包体过大）。
- 项目 `asset-manifest` 规范已为每个资源变体记录 `sha256` 哈希，具备文件级 diff 的基础条件，但尚未在包安装链路中利用。

## What Changes
- 新增游戏资源包文件级增量更新能力：发布清单扩展文件级哈希索引，客户端对比本地已安装文件哈希，仅下载变更文件。
- `ResolvedGamePackageManifest` 扩展 `fileIndexUrl` 字段，指向文件级哈希索引 JSON。
- 原生 `GamePackage` 插件新增"按文件列表下载并合并到已有安装"的增量安装模式。
- 增量安装失败时自动回退到全量安装，保证可用性。
- 构建侧新增文件级索引生成脚本，随 asset pack 一起发布。

## Impact
- Affected specs:
  - game-package-incremental-update（新增）
  - asset-manifest（可能扩展 manifest 格式以支持 fileIndexUrl）
  - game-asset-preloading（安装链路变更可能影响门禁时机）
- Affected code:
  - `src/features/mobile-packages/types.ts` — `ResolvedGamePackageManifest` 新增字段
  - `src/features/mobile-packages/nativeGamePackagePlugin.ts` — 新增增量安装接口
  - `src/features/mobile-packages/packageManagerService.ts` — 增量/全量安装决策逻辑
  - `src/features/mobile-packages/storage.ts` — 存储已安装文件哈希记录
  - Android 原生层 `GamePackagePlugin` — 新增增量合并安装能力
  - 构建脚本 — 新增文件级索引生成
