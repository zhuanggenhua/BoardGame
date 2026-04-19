## Context
- 项目已有 `asset-manifest` 规范，为每个资源变体记录 `sha256` 哈希，但该 manifest 主要用于构建侧校验与缓存策略，尚未在移动端包安装链路中直接消费。
- 当前 `GamePackage` 安装流程：拉取发布清单 → 全量下载 asset pack zip → 解压 → 校验 checksum → 完成。每次更新都是全量下载。
- 游戏资源以图片（atlas/webp/avif）和音频（ogg/mp3）为主，单文件粒度已足够节省带宽——通常一次版本更新只变更 10-30% 的文件。
- `@capgo/capacitor-updater` 的 delta update 仅覆盖 web bundle（dist.zip），不覆盖游戏资源包，无法复用。

## Goals / Non-Goals
- Goals:
  - 游戏资源包更新时，客户端仅下载本地未安装或哈希不一致的文件，跳过未变更文件。
  - 增量安装结果与全量安装结果等价——本地文件集合与校验状态完全一致。
  - 增量安装失败时自动回退到全量安装，用户无需手动干预。
  - 支持跨版本跳转（用户从 v1 直接更新到 v3，不需要先装 v2）。
  - 文件级索引由构建侧自动生成，随发布清单一起部署，无需人工维护。
- Non-Goals:
  - 不做字节级 diff（bsdiff/bspatch），文件级粒度对游戏资源已足够。
  - 不改变 module pack 的安装方式（module pack 通常较小，仍走全量）。
  - 不改变 APK 本体的更新方式（APK 更新走应用商店或全量下载）。
  - 不做增量卸载/回滚——回滚走全量重装上一版本。
  - 不引入 Capgo/Capawesome 等第三方增量服务。

## Decisions

### Decision: 文件级哈希索引作为增量依据
- 每个 asset pack 版本发布时，额外生成一份 `file-index.json`，包含：
  - `version`: asset pack 版本
  - `files`: `Array<{ path: string, hash: string, size: number }>`
  - `totalSize`: 所有文件总字节数
- 客户端对比本地已安装文件的 hash，仅下载 `files` 列表中 hash 不匹配或本地缺失的文件。
- 理由：
  - 与现有 `asset-manifest` 的 sha256 体系对齐，无需引入新哈希算法。
  - 文件级粒度对游戏资源（图片/音频）已足够，通常节省 70-90% 带宽。
  - 支持跨版本跳转：只要本地有旧版文件且 hash 匹配，即可复用。

### Decision: 增量下载走单文件 URL 而非 patch 包
- 服务端不需要生成 patch 包，只需将 asset pack 的文件按原始目录结构部署到 CDN。
- 客户端增量下载时，直接请求 `assetsBaseUrl + '/' + file.path`，逐文件下载。
- **已验证 CDN 条件**：R2 已通过 `upload-to-r2.js` 将资源逐文件上传到 `official/` 前缀下，`assetsBaseUrl`（默认 `https://assets.easyboardgame.top/official`）可直接按路径访问单文件，无需调整 CDN 部署。
- 理由：
  - 无需服务端维护多版本 patch 文件，CDN 部署零额外成本。
  - 天然支持跨版本跳转。
  - 单文件下载失败可单独重试，不需要整个 patch 重下。

### Decision: 原生插件负责增量合并
- `GamePackage` 原生插件新增 `installGamePackageIncremental` 方法：
  - 输入：gameId、fileIndex（变更文件列表）、assetBaseUrl
  - 行为：逐文件下载到临时目录，下载完成后与本地已有文件合并，校验后原子切换
- 原生层维护已安装文件的 hash 记录（`installed-files-index.json`），用于增量对比。
- 理由：
  - 原生层有文件系统直接访问权，合并与原子切换更可靠。
  - 避免 JS 层大量文件 I/O 操作的性能瓶颈。

### Decision: 增量失败自动回退全量
- 增量安装过程中若出现以下情况，自动回退到全量安装：
  - 文件索引获取失败
  - 单文件下载连续失败 3 次
  - 合并后校验不通过
  - 本地已安装文件索引缺失（首次安装或索引损坏）
- 回退时清理临时文件，走原有 `installGamePackage` 全量流程。
- 理由：
  - 保证可用性优先——增量是优化，不是必须。
  - 避免增量链路 bug 阻塞用户正常安装。

### Decision: 构建侧自动生成 file-index.json
- 在现有 asset pack 构建脚本后追加一步：遍历 asset pack 目录，计算每个文件的 sha256，输出 `file-index.json`。
- `file-index.json` 与 asset pack zip 一起上传到 CDN，URL 写入发布清单的 `fileIndexUrl` 字段。
- 理由：
  - 自动化，无需人工维护。
  - 与现有构建发布流程无缝衔接。

## Architecture

### 发布清单扩展
```typescript
// ResolvedGamePackageManifest 新增字段
interface ResolvedGamePackageManifest {
  // ... 现有字段
  fileIndexUrl?: string;     // 文件级哈希索引 JSON 的下载 URL
  fileIndexChecksum?: string; // file-index.json 自身的 sha256
}
```

发布清单 JSON 示例（`publish-android-game-packages.mjs` 的 `buildGameManifestPayload` 输出）：
```json
{
  "gameId": "dicethrone",
  "assetPack": {
    "id": "dicethrone",
    "version": "1.2.0-dicethrone-pkg-2026-04-18",
    "url": "https://assets.easyboardgame.top/official/mobile-packages/android/stable/bundles/dicethrone/1.2.0-dicethrone-pkg-2026-04-18.zip",
    "checksum": "sha256-abc...",
    "bytes": 52428800,
    "fileCount": 320,
    "fileIndexUrl": "https://assets.easyboardgame.top/official/mobile-packages/android/stable/file-index/dicethrone/1.2.0-dicethrone-pkg-2026-04-18.json",
    "fileIndexChecksum": "sha256-def..."
  }
}
```

### 文件级索引格式
```json
{
  "version": "1.0.0",
  "assetPackVersion": "2.3.0",
  "files": [
    { "path": "dicethrone/images/monk/ability-cards/01.avif", "hash": "sha256-abc123", "size": 12345 },
    { "path": "dicethrone/images/monk/ability-cards/01.webp", "hash": "sha256-def456", "size": 23456 }
  ],
  "totalSize": 52428800
}
```

### 已安装文件索引格式
```json
{
  "assetPackVersion": "2.2.0",
  "files": {
    "dicethrone/images/monk/ability-cards/01.avif": "sha256-abc123",
    "dicethrone/images/monk/ability-cards/01.webp": "sha256-def456"
  },
  "updatedAt": 1713456789000
}
```

### 增量安装流程
1. 客户端拉取发布清单，发现 `fileIndexUrl` 存在且本地有已安装文件索引。
2. 下载 `file-index.json`，与本地已安装文件索引对比，生成变更文件列表（新增 + hash 变更）。
3. 调用 `installGamePackageIncremental`，传入变更文件列表 + `assetsBaseUrl`。
4. 原生层逐文件下载到临时目录，下载 URL 为 `assetsBaseUrl + '/' + file.path`（与 `upload-to-r2.js` 上传路径一致）。
5. 下载完成后与本地已有文件合并（复用未变更文件）。
6. 合并完成后校验所有文件 hash，通过则原子切换到新版本。
7. 校验失败或下载失败 → 清理临时文件 → 回退到全量安装。

### 增量下载 URL 映射
| file-index.json 中的 path | 增量下载 URL |
|---|---|
| `dicethrone/images/monk/compressed/ability-cards/01.avif` | `https://assets.easyboardgame.top/official/dicethrone/images/monk/compressed/ability-cards/01.avif` |
| `atlas-configs/dicethrone/ability-cards-common.atlas.json` | `https://assets.easyboardgame.top/official/atlas-configs/dicethrone/ability-cards-common.atlas.json` |
| `i18n/zh-CN/dicethrone/cards.json` | `https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/cards.json` |

这与 `shouldIncludeInGamePackage` 的路径匹配规则一致，也与 `upload-to-r2.js` 的 R2 key（`official/` + relativePath）一致。

### 全量安装兼容
- 若发布清单无 `fileIndexUrl`，或本地无已安装文件索引，直接走全量安装。
- 全量安装完成后，原生层自动生成已安装文件索引，为后续增量更新做准备。

## Risks / Trade-offs
- 文件级索引本身有体积（大型游戏可能数千文件，索引 JSON 约 50-200KB），但相比节省的下载带宽可忽略。
- 增量安装的文件下载是串行的（逐文件），首次全量安装的 zip 下载是并行的（单连接大文件）。对于大量小文件变更的场景，增量可能比全量慢。缓解：原生层可并发下载多个文件。
- 已安装文件索引损坏会导致回退全量，需要确保索引写入的原子性。
- ~~CDN 需要支持按文件路径直接访问 asset pack 内容~~ **已确认 R2 支持按路径直接访问，无需调整。**

## Migration Plan
1. 构建侧：新增 file-index.json 生成脚本，随 asset pack 一起发布到 CDN。
2. 发布清单：新增 `fileIndexUrl` / `fileIndexChecksum` 字段，向后兼容（缺失时走全量）。
3. 原生插件：新增 `installGamePackageIncremental` + 已安装文件索引管理。
4. JS 层：`packageManagerService` 增量/全量决策逻辑。
5. 验证：先在单个游戏（如 tictactoe，资源最少）上端到端验证增量安装。
6. 推广：逐步为所有 package-managed 游戏启用增量更新。

## Open Questions
- ~~CDN 当前是否已将 asset pack 内容按原始目录结构暴露为可逐文件访问？~~ **已确认：R2 已逐文件上传到 `official/` 前缀，支持按路径直接访问。**
- 是否需要为增量下载设置并发数上限，避免大量并发请求冲击 CDN？
- 已安装文件索引的存储位置：跟随 asset pack 本地目录，还是独立存储？
