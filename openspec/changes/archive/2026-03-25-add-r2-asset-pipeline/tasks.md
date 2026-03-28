## 1. Implementation
- [x] 1.1 定义官方资源在对象存储中的 key 前缀与目录映射（`official/<gameId>/...`），并明确与 `/assets/<gameId>/...` 的对应关系（部署侧文档即可）。
- [x] 1.2 在 `src/core/AssetLoader.ts` 将资产基址从常量改为可配置（当前默认官方资源域名 `https://assets.easyboardgame.top/official`，同时兼容 `/assets` 本地路径），并确保 `assetsPath()`/`getOptimizedImageUrls()`/`getLocalizedAssetPath()` 行为保持兼容。
- [x] 1.3 新增脚本 `scripts/generate_asset_manifests.*`：扫描官方资源目录，生成 `assets-manifest.json`（稳定排序、包含 hash/bytes/variants）。
- [x] 1.4 新增发布校验步骤：CI/本地命令可验证 manifest 与实际文件集合一致（缺文件/重复 key/变体不一致时报错）。
- [x] 1.5 约定 `.gitignore`：明确哪些资源文件/目录永远不进入 Git（保留少量 demo 资源作为例外需写明规则）。
- [x] 1.6 文档化开发与发布流程：
  - 本地开发使用 `public/assets`（或本地缓存目录）
  - 生产可通过官方资源域名直连 R2，或通过 `/assets` 反代到 R2
  - 发布时产出并上传 manifest

## 2. Optional: UGC (Not Implemented In This Change)
- [x] 2.1 预留 UGC 资源 key 约定（`ugc/<userId>/<packageId>/...`）与 manifest 结构一致性说明。
- [x] 2.2 预留“staging → published”的目录前缀建议与未来审核/上架扩展点说明（不实现）。

## 3. Validation
- [x] 3.1 `openspec validate add-r2-asset-pipeline --strict --no-interactive` 通过。
- [ ] 3.2 本地在不配置 R2 的情况下，应用仍能通过 `public/assets` 访问关键资源（以现有游戏如 dicethrone 为样例）。
- [ ] 3.3 在配置远程资源基址的环境中，关键资源可正常加载（官方资源域名直连或 `/assets` 反代到 R2；图片 avif/webp、atlas json、音频 ogg）。
