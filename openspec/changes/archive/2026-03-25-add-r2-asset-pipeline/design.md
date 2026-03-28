## Context
- 项目目标包含：兼容主流桌游模拟器（如 TTS）的美术资源，并支持长期扩展与陌生人协作。
- 现有前端资源引用已收口：
  - `src/core/AssetLoader.ts` 已将资源基址抽象为可配置项；当前默认值为 `https://assets.easyboardgame.top/official`，同时对显式 `/assets/...` 本地路径保持兼容，并提供 `.avif/.webp` 变体派生与语言化资源路径。
  - `src/lib/audio/AudioManager.ts` 使用 `assetsPath()` 归一化音频 src，并支持 basePath 拼接。
- 仓库内存在大量资源文件（`public/assets/**`），且存在同一资源的多格式副本（`compressed/` 下 avif/webp/ogg 等），容易触发 Git 仓库体积/历史膨胀。

## Goals / Non-Goals
- Goals:
  - 官方资源从 Git 迁出，发布到 Cloudflare R2；应用默认通过官方资源域名访问，并继续兼容同域 `/assets/*` 访问。
  - 引入统一的资源 manifest（官方必须；UGC 将来也必须），由脚本自动生成，形成可验证的发布闭环。
  - 保持现有业务层资源引用方式尽量不变（继续使用无扩展名 base path + 运行时派生）。
  - 允许后续演进到“受控网关”（Worker）以及 UGC 审核/上架，不在本次实现。
- Non-Goals:
  - 不在本次设计中规定 Cloudflare 的具体配置细节（域名、缓存 TTL、鉴权等）。
  - 不在本次设计中实现 UGC 上传、自动审核、上架流程。

## Key Decisions

### 1) 资源基址配置化；当前默认官方远程域名，同时兼容同域 `/assets/*`
- 理由：
  - 业务层仍然传“逻辑相对路径”，不需要把域名散落进游戏代码。
  - 当前实现已经内置官方远程基址，能直接命中线上资源；同时显式 `/assets` 路径与本地 JSON / atlas 配置仍可继续工作。
- 兼容性：
  - 同域 `/assets` 仍可作为开发环境、本地回退、或部署层反代到 R2 的兼容方案。

### 2) 资源 key 采用“逻辑相对路径”，不在代码里写域名
- 示例：`dicethrone/images/monk/compressed/dice-sprite`。
- `AssetLoader` 负责把相对路径解析成最终 URL（默认 `<assetsBaseUrl>/<rel>`，当前 `assetsBaseUrl=https://assets.easyboardgame.top/official`）。
- 这样开发/生产/回滚/未来 CDN 迁移都能通过配置和部署完成，而无需批量改业务代码。

### 3) Manifest 是自动化与可验证发布的核心（官方与 UGC 统一）
- 仅靠“约定目录”可以跑通，但无法可靠支持：
  - 资源完整性校验（缺文件/错文件的快速定位）
  - 内容哈希驱动的缓存策略（避免缓存污染）
  - 增量发布/回滚（manifest 版本即发布版本）
- Manifest 必须由脚本生成（不手工维护），并做到稳定排序，以便 diff 与审计。

### 4) Manifest 格式与现有代码模式对齐（base path + variants）
- 现有图片使用方式：无扩展名 base path，通过 `getOptimizedImageUrls()` 派生 `.avif/.webp`。
- 因此 manifest 的 key 应为“无扩展名 base path”，并列出可用变体（exts）及其 hash/bytes。
- `.atlas.json`/`.json` 等显式扩展文件按“带扩展的逻辑路径”记录，避免推断歧义。

## Manifest Format (Recommended)
文件：`assets-manifest.json`
- `manifestVersion`: number
- `scope`: `official` | `ugc`
- `id`: `gameId`（official）或 `packageId`（ugc）
- `basePrefix`: 对象存储中的前缀（例如 `official/dicethrone/`）
- `files`: 以逻辑路径为 key 的字典

示例（说明性，非最终实现）：
```json
{
  "manifestVersion": 1,
  "scope": "official",
  "id": "dicethrone",
  "basePrefix": "official/dicethrone/",
  "generatedAt": "2026-01-24T09:00:00Z",
  "files": {
    "images/monk/compressed/dice-sprite": {
      "variants": {
        "avif": { "sha256": "...", "bytes": 123456, "mime": "image/avif" },
        "webp": { "sha256": "...", "bytes": 234567, "mime": "image/webp" }
      }
    },
    "images/monk/compressed/monk-ability-cards.atlas.json": {
      "variants": {
        "json": { "sha256": "...", "bytes": 8910, "mime": "application/json" }
      }
    },
    "audio/compressed/click.ogg": {
      "variants": {
        "ogg": { "sha256": "...", "bytes": 4567, "mime": "audio/ogg" }
      }
    }
  }
}
```

## Risks / Trade-offs
- 初期“既有本地 assets，又有 R2 assets”的双轨会增加排查复杂度。
  - 缓解：manifest + 发布校验（CI）保证线上资源集完整；本地允许 fallback 但显式提示。
- 将来引入 Worker 网关/UGC 审核时，路径与 manifest 设计必须保持兼容。
  - 缓解：从 Day1 使用 `scope` 与 `basePrefix`，并将 UGC 作为独立前缀（如 `ugc/<userId>/<packageId>/`）。

## Migration Plan (High Level)
1) 定义官方资源在 R2 的 key 结构，以及官方资源域名与 `/assets` 兼容路径的映射规则（部署侧）。
2) 引入官方资源 manifest 的生成与校验（CI/脚本）。
3) 调整 `AssetLoader` 的 base 路由配置化（当前默认官方资源域名，同时保留 `/assets` 兼容路径）。
4) 逐步把仓库内的大资源迁出，仓库仅保留少量 demo/占位资源（可选）。

## Open Questions
- 官方资源与 demo 资源的边界：仓库是否允许保留极少量示例资源用于首次启动？
- manifest 的发布版本策略：以 git commit、tag，还是 CI build number 作为版本号？
- 音频与图片的压缩产物是否全部由 CI 生成并发布，还是允许提交压缩产物到仓库（不推荐）？
