---
name: audio-integration
description: "BoardGame 项目的音效对接 overlay。先使用全局 `$audio-integration` skill，再补充本仓库的语义目录、registry、中文友好名、/dev/audio 试听入口和新增素材命令。只在当前仓库内做音效接线时使用。"
---

# BoardGame 音效 Overlay

## 先用全局 skill

先按全局 `$audio-integration` 执行：

- 区分 `generic-pool` 与 `object-specific`
- 准备两张表：
  - 通用音效表：`音效中文名 + 英文本体 + 音效 id/key`
  - 非通用音效表：额外带 `目标对象中文名`
- 所有最终候选与最终汇报都必须同时保留：
  - `中文名`
  - `英文本体`：原始曲名 / 原始短语 / registry 里的英文语义体
  - `完整 key`
  不能只交中文，也不能只交 key；必须让用户既能按中文理解，也能按英文搜索
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
- 默认候选池必须先覆盖**整个公共音频库**：
  - 先看 `docs/audio/audio-catalog.md` 的全量语义目录
  - 再看 `docs/audio/registry.ai.json` 的全库精简索引
  - 不足时再回退 `public/assets/common/audio/registry.json`
- **禁止**默认只在“其他游戏已经用过的 key”里挑，或只在“当前游戏附近文件”里挑
- 具体游戏如有更小范围 registry / 既有音频配置，只能用于：
  - 理解当前项目已有语义
  - 检查是否重复
  - 对照复用成本
  不能把它当默认候选池
- 当用户要“挑选 / 换一个 / 给我试听矩阵”时：
  - 默认必须给**跨族群候选**
  - 也就是至少跨 `2` 个不同语义家族 / 包 / naming line
  - 不能只给同一包里 `A/B/C/D` 这种微变体列表冒充完整矩阵
- 若本轮确实只在单一包内细挑：
  - 必须明确写这是 `同族群收窄对比`
  - 并说明为什么不做跨族群矩阵
- 若本地存在 `public/assets/common/audio/**` 实体素材，最终候选必须再核实“磁盘上确实存在”；不能只凭 registry 选 key

### 重复检查

- **BGM 默认先去重**：定案前必须检查目标 BGM key 是否已被其他游戏使用
- 检查范围至少包括：`src/games/**/audio.config.ts`
- 若发现重复：
  - 默认继续找全库里的未复用候选
  - 只有在语义高度贴合、且替代候选明显更差时，才允许复用
  - 复用时必须在汇报中写清：`重复到哪些游戏 + 为什么本次仍保留`
- **音效不要求零重复**：通用操作音（如摸牌、弃牌、胜负提示）可跨游戏复用；但仍要说明它属于 `generic-pool`
- **`mini_games_sound_effects_and_music_pack` 的胜负提示默认低优先级**：
  - 尤其是 `stinger`、`success` 这类胜利/失败/结算提示
  - 若仓内已被多游戏重复使用，且全库还有语义合适候选，默认先找别的家族
  - 只有在节奏、时长、气质明显更合适时，才回退到它

### 中文友好名

- 首选：`public/assets/common/audio/phrase-mappings.zh-CN.json`
- 英文本体来源优先级：
  - registry / 文件原名中的英文曲名或英文短语
  - `public/locales/*/game.json` 已有英文标题
- 若缺少中文友好名，汇报里仍要补一个可读中文名，并标记 `中文友好名待补`
- 若缺少明确英文本体，不能只写 key；要从曲名/短语中提炼一个可搜索的英文名
- 若用户要在 `/dev/audio` 里直接按中文搜到某类候选，且当前映射表缺词：
  - 要同步补 `public/assets/common/audio/phrase-mappings.zh-CN.json`
  - 以及 `src/assets/audio/phrase-mappings.zh-CN.json`
  - 不能只在汇报里写中文，结果浏览器里还是搜不到

### 试听入口

- 预览页：`/dev/audio`
- 若用户要求“把某条音频从全局候选库删除 / 不要以后再搜到它”，默认落点是：
  - `scripts/audio/registry-exclusions.json`
  - 先执行 `node scripts/audio/apply_registry_exclusions.mjs`
  - 再重跑 `registry.ai.json` / `audio-catalog.md` / `registry-slim.json`
  - 这是移出来源候选池，不等于删除物理素材文件
- **删除来源候选不等于留空语义槽位**：
  - 若删掉的是某个正在使用或刚被用户点名嫌弃的 `胜利 / 失败 / 摸牌 / 弃牌 / UI` 候选
  - 同一轮必须补上 `替代接线` 或 `替代候选矩阵`
  - 不能只删旧 key，不给新备选，导致用户在 `/dev/audio` 里这类语义“像没了一样”
- 当用户说“打开预览 / 打开音效浏览器 / 打开试听页”时，默认动作是：
  - **只打开一个** `/dev/audio` 页面
  - 优先用 query 参数把它定位到当前任务的候选集合
  - 不能默认一条音频开一个新标签页
- 只有用户明确要求“把每条都单独打开”或“多开几个对比页”时，才允许开多个页面
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

### 私有流程音接线

- 只要事件 payload 里带 `playerId`，就必须判断这条音是不是：
  - `本地私有流程音`
  - 还是 `全桌公共反馈音`
- 默认规则：
  - `摸进自己手牌`
  - `从弃牌区拿进自己手牌`
  - `从自己手牌打出/弃掉`
  这类默认优先按 `本地私有流程音` 处理
- 不能因为事件是 `immediate` 就自动广播给所有玩家
- 若是私有流程音，汇报里要写明：
  - `只给当前操作者自己播放`
  - `其他玩家 / 观战保持静默`

## BoardGame 额外要求

- 汇报业务对象时优先用中文名
- 最终交付矩阵至少包含：
  - `中文名`
  - `英文本体`
  - `key`
  - `类别`：音效 / BGM
  - `用途`
  - `是否复用现有游戏`
- 汇报时要明确区分：
  - `总配置是否变化`：`public/assets/common/audio/registry.json`
  - `实际静态配置是否变化`：`src/assets/audio/registry.json`
  - `游戏层实际接线是否变化`：`src/games/<gameId>/audio.config.ts` / `soundKey`
- 只要改了 BGM，汇报里必须额外写：
  - `是否与其他游戏重复`
  - 若重复，`重复游戏清单 + 保留理由`
- 只要本轮做了音效对接，最终都要问：
  - `是否现在启动服务器并打开 /dev/audio 做一轮试听？`
- 只要本轮修了音频加载/播放失败，最终还要明确：
  - `失败是否会给用户可见提示，而不是只打日志或静默失败`
- 只要本轮动了私有流程音，最终还要明确：
  - `哪些是本地私有播放`
  - `哪些仍然是全桌公共播放`
- 只要本轮交的是“候选矩阵”而不是直接定案，最终还要明确：
  - `这是跨族群矩阵，还是同族群收窄对比`
  - 若是后者，`为什么这样收窄仍然有意义`
