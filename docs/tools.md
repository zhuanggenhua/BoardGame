# 项目工具脚本

适用目录：`scripts/`。命令默认在项目根目录执行。

## 目录结构

```
scripts/
├── audio/              # 音频相关（压缩/注册表/翻译/迁移）
├── assets/             # 图片/图集/资源（压缩/扫描/打包/上传）
├── deploy/             # 部署脚本
├── db/                 # 数据库（清理/初始化/诊断）
├── game/               # 游戏相关（清单生成/卡牌国际化/修复）
├── ugc/                # UGC 预览与发布
├── infra/              # 基础设施（端口/架构检查/模拟/验证/PDF）
├── verify/             # 验证类脚本
├── alipan_save_tool/   # 阿里云盘分享转存工具
└── image-viewer-mcp/   # MCP 图片查看器
```

## 常用入口

- **图片压缩**：`npm run compress:images --clear`（入口 `scripts/assets/compress_images.js`）
- **音频压缩**：`npm run compress:audio --clear`（入口 `scripts/audio/compress_audio.js`，依赖 `FFMPEG_PATH`）
- **资源清单生成**：`npm run assets:manifest`（入口 `scripts/assets/generate_asset_manifests.js`）
- **资源清单校验**：`npm run assets:validate`（入口 `scripts/assets/generate_asset_manifests.js --validate`）
- **PDF 转 Markdown**：`npm run pdf:md -- <pdf路径> [-o <md路径>]`（入口 `scripts/infra/pdf_to_md.js`）
- **资源提取**：`node scripts/assets/extract_assets.js`（需先在脚本内配置本地路径常量）
- **模拟房主流程**：`npx tsx scripts/infra/simulate-host.ts`（用于快速验证创建/加入/离开流程）
- **图集网格扫描（方案A）**：`npm run atlas:scan -- <image> --rows <rows> --cols <cols>`（输出行/列裁切数据）
- **部署（全量）**：`bash scripts/deploy/deploy-auto.sh`（首次部署/装机）
- **部署（快速更新）**：`bash scripts/deploy/deploy-quick.sh`（已部署后拉取/重建）

## 完整工具清单

### 音频（scripts/audio/）

- `compress_audio.js`：音频压缩（基于 ffmpeg）
- `generate_common_audio_registry.js`：生成 `registry.json`（全量音频注册表）
- `generate_ai_audio_registry.js`：生成精简版 AI 注册表（全仓库通用）
- `generate_ai_audio_registry_dicethrone.js`：生成 DiceThrone 专用精简版（扫描源码中实际使用的 key）
- `generate_audio_assets_md.js`：扫描音频源文件并生成 `public/audio_assets.md`
- `check-audio-assets.cjs`：音频资源检查
- `merge_audio_translations.js`：合并翻译批次到主文件
- `migrate_audio_assets.ps1`：音频资源迁移
- `admin-archive-refactor-audio.ps1`：音频重构归档
- `admin-move-tictactoe-audio.ps1`：井字棋音频迁移

### 资源与资产（scripts/assets/）

- `compress_images.js` / `compress_images.py`：图片压缩（JS 启动器 + Python 实现）
- `atlas_grid_scan.js` / `atlas_grid_scan.py`：图集网格扫描（JS 启动器 + Python 实现）
- `pack_sprite_atlas.js` / `pack_sprite_atlas.py`：图集打包（JS 启动器 + Python 实现）
- `scan_sprite_bounds.py`：精灵图内容边界扫描（识别每帧真实内容区域，裁切黑边/透明边）
- `scan_atlas_to_file.py`：图集扫描输出到文件
- `generate_uniform_atlas.cjs`：生成均匀图集
- `check_edges.py`：边缘检查
- `profile_scan.py`：扫描性能分析
- `extract_assets.js`：资源提取脚本（需在脚本内配置本地路径）
- `generate_asset_manifests.js`：生成/校验 `assets-manifest.json`
- `upload-to-r2.js`：上传资源到 Cloudflare R2

### 游戏（scripts/game/）

- `generate_game_manifests.js`：生成 `src/games/manifest*.generated.*`
- `generate-card-locales.cjs`：从 `cards.ts` 生成/更新卡牌多语言
- `fix_dicethrone_ids_mistake.cjs`：DiceThrone ID 修复（一次性）

### 数据库（scripts/db/）

- `cleanup-db.ts`：数据库清理
- `init_admin.ts`：初始化管理员
- `diagnose-rooms.ts`：房间诊断

### 部署（scripts/deploy/）

- `deploy-auto.sh`：全量部署（安装依赖/配置镜像/生成 .env/启动）
- `deploy-image.sh`：镜像部署（deploy/rollback/status/logs）
- `deploy-quick.sh`：快速更新（git pull + docker compose up -d --build）

### UGC（scripts/ugc/）

- `ugc-generate-preview.mjs`：UGC 预览生成
- `ugc-publish-preview.mjs`：UGC 预览发布

### 基础设施（scripts/infra/）

- `clean_ports.js`：清理端口进程（默认 5173/18000/18001，可配置）
- `wait_for_ports.js`：等待端口就绪（用于脚本/CI 串联）
- `simulate-host.ts`：模拟房主创建/加入/离开流程
- `verify_social_ws.ts`：社交 WebSocket 验证入口（转发到 `scripts/verify/social-ws.ts`）
- `check-architecture.cjs`：架构解耦检查（框架层不得依赖游戏层）
- `pdf_to_md.js`：PDF 转 Markdown

### 其他工具目录

- `alipan_save_tool/`：阿里云盘分享转存工具
  - `README.txt`：使用说明与常见问题
  - `alipan_save.py`：主程序（云端转存）
  - `alipan_secrets.example.json`：配置模板（token/接口域名）
  - `run.bat`：Windows CMD 启动脚本
  - `run.ps1`：PowerShell 启动脚本
- `verify/`：验证类脚本目录
  - `social-ws.ts`：社交 WebSocket 事件链路验证

## 输出位置

- **图片/音频压缩产物**：各资源目录下的 `compressed/`
- **规则 Markdown**：默认输出到 `public/assets/rules/`
- **官方资源清单**：`public/assets/<gameId>/assets-manifest.json`（包含 common 等公共目录）

## 关键参数

### 图片压缩（compress_images）

- `IMAGE_MAX_EDGE`：最大边长
- `IMAGE_WEBP_QUALITY`：WebP 质量
- `IMAGE_AVIF_QUALITY`：AVIF 质量
- `--clean` / `IMAGE_CLEAN=1`：清理 `compressed/`

### 音频压缩（compress_audio）

- `FFMPEG_PATH`：ffmpeg 路径（支持相对路径，以项目根目录为基准）
  - 项目已内置 ffmpeg：`BordGameAsset/工具/ffmpeg-7.1.1-essentials_build/bin`
  - 示例：`$env:FFMPEG_PATH = "BordGameAsset/工具/ffmpeg-7.1.1-essentials_build/bin"; npm run compress:audio`
- `AUDIO_OGG_BITRATE`：输出码率（默认 96k）
- `--clean` / `AUDIO_CLEAN=1`：清理 `compressed/` 内的 `.ogg`
- **UGC 上传说明**：仅保存压缩变体；服务端音频压缩目前为占位实现（需 ffmpeg 落地）

### 模拟房主（simulate-host）

- 该脚本用于本地联机流程联调，实际访问地址以脚本内常量为准；当前项目游戏服务默认端口为 `18000`（同域入口见 `docs/deploy.md`）。

### 图集网格扫描（atlas_grid_scan）

用于"方案A"裁切：自动扫描图集真实行/列起点与尺寸，输出 JSON 供前端裁切使用。支持**非均匀行列**与**存在间距**的精灵图。

**执行环境说明（避免贴错解释器）**

- 请在 **PowerShell / CMD** 执行 `node scripts/assets/atlas_grid_scan.js ...`
- **不要**在 Python 交互 (`>>>`) 中执行 Node 命令
- 若不小心进入 Python 交互，先输入 `exit()` 退出再执行命令

**基础用法（均匀网格）**

```bash
npm run atlas:scan -- public/assets/dicethrone/images/monk/compressed/monk-ability-cards.webp --rows 4 --cols 10 --pretty
```

**非均匀/有间距图集（推荐）**

```bash
node scripts/assets/atlas_grid_scan.js --image public/assets/smashup/cards/compressed/cards2.webp \
  --metric variance --auto-threshold 0.12 \
  --row-metric variance --row-auto-threshold 0.12 \
  --col-metric mean --col-auto-threshold 0.18 \
  --col-scan-from-row -1 \
  --gap-merge 2 --min-segment 20 \
  --output public/assets/smashup/cards/compressed/cards2.atlas.json --pretty
```

**输出说明**

- 默认输出到控制台（stdout）。
- 若需写文件，使用 `--output <path>`。
- 建议扫描"实际渲染使用"的压缩纹理（如 `compressed/*.webp`），确保输出位置与前端读取路径一致。

**常用参数（新版）**

- `--metric`：扫描指标（`max`/`mean`/`variance`）
- `--threshold`：阈值（亮度/均值/方差）
- `--auto-threshold`：自动阈值比例 (0-1)
- `--row-metric` / `--col-metric`：行/列单独指定指标
- `--row-threshold` / `--col-threshold`：行/列单独阈值
- `--row-auto-threshold` / `--col-auto-threshold`：行/列单独自动阈值比例
- `--row-detect-mode` / `--col-detect-mode`：检测模式（`content`=高值为内容，`gap`=低值为间隙）
- `--row-gap-min-segment` / `--col-gap-min-segment`：间隙最小长度（仅 detect-mode=gap 生效）
- `--col-scan-from-row`：列扫描基于某一行段（`-1`=最长行，适合识别列间距）
- `--row-gap-merge` / `--col-gap-merge`：行/列合并相邻段的最大间隔
- `--row-min-segment` / `--col-min-segment`：行/列最小内容段长度
- `--uniform-rows` / `--uniform-cols`：强制均分行/列（覆盖扫描）
- `--scan-x-start` / `--scan-x-end`：限制扫描 X 区域
- `--scan-y-start` / `--scan-y-end`：限制扫描 Y 区域
- `--row-scan-*` / `--col-scan-*`：行/列独立扫描区域
- `--gap-merge`：合并相邻段的最大间隔
- `--min-segment`：最小内容段长度

### 精灵图内容边界扫描（scan_sprite_bounds）

用于"按帧裁切黑边/透明边"：给定图集 + 行列数，输出每帧内容矩形。

**依赖**

- 需要 Pillow：`python -m pip install Pillow`

**基础用法**

```bash
python scripts/assets/scan_sprite_bounds.py --image public/assets/summonerwars/hero/Necromancer/Necromancer.png --cols 2 --rows 1
```
