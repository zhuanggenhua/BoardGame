---
name: audio-integration
description: "BoardGame 项目的音效对接 overlay。先使用全局 `$audio-integration` skill，再补充本仓库的语义目录、registry、中文友好名、/dev/audio 试听入口和新增素材命令。只在当前仓库内做音效接线时使用。"
---

# BoardGame 音效 Overlay

## 先用全局 skill

先按全局 `$audio-integration` 执行：

- 区分 `generic-pool` 与 `object-specific`
- 准备两张表：
  - 通用音效表：`音效中文名 + 音效 id/key`
  - 非通用音效表：额外带 `目标对象中文名`
- 明确是否复用现有库、是否新增素材
- 高频出牌/附着/召唤音效默认优先 `短促 one-shot`，避免长拖尾、loop 感、环境氛围类候选
- 默认以 `4 秒` 为上限，超过 `4 秒` 的候选一般不采用；若保留，汇报里必须说明例外理由
- 主动询问是否启动试听工具

本 overlay 只补 BoardGame 仓库内的真实入口。

## BoardGame 对应入口

### 语义检索与 registry

- 语义目录：`docs/audio/audio-catalog.md`
- 精简 registry：`docs/audio/registry.ai.json`
- 全量 registry：`public/assets/common/audio/registry.json`
- 源码静态副本：`src/assets/audio/registry.json`
- 具体游戏如有更小范围 registry，优先用游戏专用文件
- 若本地存在 `public/assets/common/audio/**` 实体素材，最终候选必须再核实“磁盘上确实存在”；不能只凭 registry 选 key

### 中文友好名

- 首选：`public/assets/common/audio/phrase-mappings.zh-CN.json`
- 若缺少友好名，汇报里仍要补一个可读中文名，并标记 `中文友好名待补`

### 试听入口

- 预览页：`/dev/audio`
- 进入后至少可做：
  - 搜索 key
  - 试听
  - 复制 id
  - 检查分类
  - 检查中文名

### 新增素材命令

只有本次真的新增外部素材时才跑：

1. `npm run compress:audio -- public/assets/common/audio`
2. `node scripts/audio/generate_common_audio_registry.js`
3. 同步确认 `src/assets/audio/registry.json` 已更新到当前 registry 版本
4. `node scripts/audio/generate_audio_assets_md.js`
5. 必要时 `node scripts/audio/generate_ai_audio_registry.js`
6. 必要时 `node scripts/audio/generate_audio_catalog.js`

### 本仓库常见配置落点

- 总配置 / 共享注册表：
  - `public/assets/common/audio/registry.json`
  - `src/assets/audio/registry.json`
- `src/games/<gameId>/audio.config.ts`
- `src/games/<gameId>/data/**/*.ts` 中的 `soundKey`
- 具体 FX / 动画接线文件

## BoardGame 额外要求

- 汇报业务对象时优先用中文名
- 汇报时要明确区分：
  - `总配置是否变化`：`public/assets/common/audio/registry.json`
  - `实际静态配置是否变化`：`src/assets/audio/registry.json`
  - `游戏层实际接线是否变化`：`src/games/<gameId>/audio.config.ts` / `soundKey`
- 只要本轮做了音效对接，最终都要问：
  - `是否现在启动服务器并打开 /dev/audio 做一轮试听？`
