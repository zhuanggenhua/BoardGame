# 项目工具脚本

适用目录：`scripts/`。命令默认在项目根目录执行。

## 常用入口

- **图片压缩**：`npm run compress:images --clear`（入口 `scripts/compress_images.js`）
- **音频压缩**：`npm run compress:audio --clear`（入口 `scripts/compress_audio.js`，依赖 `FFMPEG_PATH`）
- **资源清单生成**：`npm run assets:manifest`（入口 `scripts/generate_asset_manifests.js`）
- **资源清单校验**：`npm run assets:validate`（入口 `scripts/generate_asset_manifests.js --validate`）
- **PDF 转 Markdown**：`npm run pdf:md -- <pdf路径> [-o <md路径>]`（入口 `scripts/pdf_to_md.js`）
- **资源提取**：`node scripts/extract_assets.js`（需先在脚本内配置本地路径常量）
- **模拟房主流程**：`npx tsx scripts/simulate-host.ts`（用于快速验证创建/加入/离开流程）
- **图集网格扫描（方案A）**：`npm run atlas:scan -- <image> --rows <rows> --cols <cols>`（输出行/列裁切数据）
- **部署（全量）**：`bash scripts/deploy-auto.sh`（首次部署/装机）
- **部署（快速更新）**：`bash scripts/deploy-quick.sh`（已部署后拉取/重建）

## 完整工具清单（scripts/）

### 资源与资产

- `atlas_grid_scan.js` / `atlas_grid_scan.py`：图集网格扫描（JS 启动器 + Python 实现）
- `scan_sprite_bounds.py`：精灵图内容边界扫描（识别每帧真实内容区域，裁切黑边/透明边）
- `pack_sprite_atlas.js` / `pack_sprite_atlas.py`：图集打包（JS 启动器 + Python 实现）
- `compress_images.js` / `compress_images.py`：图片压缩（JS 启动器 + Python 实现）
- `compress_audio.js`：音频压缩（基于 ffmpeg）
- `generate_asset_manifests.js`：生成/校验 `assets-manifest.json`
- `generate_audio_assets_md.js`：扫描音频源文件并生成 `public/audio_assets.md`
- `extract_assets.js`：资源提取脚本（需在脚本内配置本地路径）

### Manifest / i18n

- `generate_game_manifests.js`：生成 `src/games/manifest*.generated.*`
- `generate-card-locales.cjs`：从 `cards.ts` 生成/更新卡牌多语言

### 联调 / 验证

- `simulate-host.ts`：模拟房主创建/加入/离开流程
- `verify_social_ws.ts`：社交 WebSocket 验证入口（转发到 `scripts/verify/social-ws.ts`）
- `verify/social-ws.ts`：社交 WebSocket 事件链路验证

### 环境与诊断

- `check-architecture.cjs`：架构解耦检查（框架层不得依赖游戏层）
- `clean_ports.js`：清理端口进程（默认 5173/18000/18001，可配置）
- `wait_for_ports.js`：等待端口就绪（用于脚本/CI 串联）

### 部署 / 运维

- `deploy-auto.sh`：全量部署（安装依赖/配置镜像/生成 .env/启动）
- `deploy-quick.sh`：快速更新（git pull + docker compose up -d --build）

### 文档转换

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

用于“方案A”裁切：给定图集 + 行列数，自动扫描行/列真实起点与尺寸，输出 JSON 供前端裁切使用。

**基础用法**

```bash
npm run atlas:scan -- public/assets/dicethrone/images/monk/compressed/monk-ability-cards.webp --rows 4 --cols 10 --pretty
```

**输出位置**

- 默认输出到图集同目录，文件名为 `<原文件名>.atlas.json`。
- 建议扫描“实际渲染使用”的压缩纹理（如 `compressed/*.webp`），确保输出位置与前端读取路径一致。
- 若需自定义输出路径，使用 `--output <path>`。

**常用参数**

- `--threshold`：亮度阈值（默认 35）
- `--alpha-threshold`：透明阈值（默认 0）
- `--row-ratio` / `--col-ratio`：行/列识别阈值比例（默认 0.2）
- `--row-min-count` / `--col-min-count`：最小像素数阈值（覆盖 ratio）
- `--row-gap` / `--col-gap`：合并相邻行/列带的最大间隔（默认 6）
- `--scan-x-start` / `--scan-x-end`：限制扫描 X 区域
- `--scan-y-start` / `--scan-y-end`：限制扫描 Y 区域
- `--step`：采样步长（默认 1，增大可加速但精度降低）

### 精灵图内容边界扫描（scan_sprite_bounds）

用于“按帧裁切黑边/透明边”：给定图集 + 行列数，输出每帧内容矩形。

**依赖**

- 需要 Pillow：`python -m pip install Pillow`

**基础用法**

```bash
python scripts/scan_sprite_bounds.py --image public/assets/summonerwars/hero/Necromancer/Necromancer.png --cols 2 --rows 1
```
