# 音频资源使用参考

> 本文只承载 BoardGame 音频资源的目录、生成命令、查找/试听、BGM 分配和项目接入参考。
> 跨游戏运行时架构、共享音频包路径和音效触发时机以 `.spec/knowledge/standards/audio-assets.md` 为准；本文只提供命令、目录和示例。

## 1. 运行时架构合同入口

跨游戏的三层架构、registry 唯一来源、FX `FeedbackPack`、完整 key 和 `compressed/` 路径禁令统一见 `.spec/knowledge/standards/audio-assets.md` 的“音频架构 / 音频资源架构”。

本文件只补充项目级资源使用细节：命令入口、候选查找、BGM 分配、游戏专用音效池、预加载和浏览器试听；若本文件与运行时主合同冲突，以 `audio-assets.md` 为准。

## 2. 目录与产物（强制）

- 唯一音频资源目录：`public/assets/common/audio/`
- 运行时注册表：`public/assets/common/audio/registry.json`
- 源码静态副本：`src/assets/audio/registry.json`
- AI 精简注册表：`docs/audio/registry.ai.json`
- 语义目录：`docs/audio/audio-catalog.md`
- 资源清单：`docs/audio/common-audio-assets.md`
- 中文友好名：`public/assets/common/audio/phrase-mappings.zh-CN.json`
- 全局来源排除清单：`scripts/audio/registry-exclusions.json`
- 排除清单应用脚本：`scripts/audio/apply_registry_exclusions.mjs`

## 3. 常用命令入口

### 3.1 压缩音频

```bash
npm run compress:audio -- public/assets/common/audio
```

可选参数：

```bash
AUDIO_CLEAN=1 npm run compress:audio -- public/assets/common/audio
AUDIO_OGG_BITRATE=96k npm run compress:audio -- public/assets/common/audio
FFMPEG_PATH=tools/ffmpeg/bin/ffmpeg.exe npm run compress:audio -- public/assets/common/audio
```

### 3.2 生成运行时 registry

```bash
node scripts/audio/generate_common_audio_registry.js
```

- 若某些历史音频不希望再出现在全局候选库、AI registry、语义目录或 `/dev/audio` 中：
  - 先把 key 写入 `scripts/audio/registry-exclusions.json`
  - 先执行 `node scripts/audio/apply_registry_exclusions.mjs`
  - 再重跑 AI registry / catalog / slim registry 生成链
  - 这属于“隐藏来源候选”，不是删除物理素材文件
  - 若该 key 属于用户刚点名要替换的语义槽位，同一轮还必须补：
    - 新接线，或
    - 新候选矩阵
  - 禁止只删旧 key，不补替代项

### 3.3 生成资源清单

```bash
node scripts/audio/generate_audio_assets_md.js
```

### 3.4 生成 AI 精简 registry

```bash
node scripts/audio/generate_ai_audio_registry.js
```

DiceThrone 专用精简版：

```bash
node scripts/audio/generate_ai_audio_registry_dicethrone.js
```

### 3.5 生成语义目录

```bash
node scripts/audio/generate_audio_catalog.js
```

### 3.6 浏览器试听入口

访问：

```text
/dev/audio
```

## 4. 查找音效 key 的工具合同

执行步骤见 `audio-integration` skill，这里只保留工具层合同：

1. **全量语义目录优先**
   先用 `docs/audio/audio-catalog.md` 在整个公共音频库里找语义组和 `grep pattern`
2. **全库精简 registry 第二层**
   用 `docs/audio/registry.ai.json` 缩小候选 key
3. **现有游戏用例只作对照，不作默认候选池**
   `src/games/**/audio.config.ts`、既有测试和旧配置默认只用于：
   - 检查复用语义是否成熟
   - 检查 BGM 是否重复
   - 评估迁移成本
   不得把“别的游戏已用 key 列表”当作默认挑选池
   - 对 `mini_games_sound_effects_and_music_pack` 的胜利/失败提示，若仓内已大量复用，默认视为低优先级族群
4. **全量 registry 最后回退**
   仅当前两层不足时，才回退到 `public/assets/common/audio/registry.json`
5. **/dev/audio 最终确认**
   用于试听、复制 key、检查分类与中文友好名

### 4.2 候选矩阵必须有跨族群信息量

- 当任务不是“直接定案”，而是“给我挑选 / 给我候选 / 给我试听矩阵”时：
  - 默认应给跨族群候选
  - 至少跨 `2` 个不同语义家族、音频包或 naming line
- 禁止只给同一包里 `traditional_success_a/b/c...`、`failure_d/e/f...` 这类微变体，就宣称已经给了有意义的挑选矩阵
- 若因用户明确要求或语义约束，只做单一家族内细挑：
  - 必须明确标记为 `同族群收窄对比`
  - 不能冒充完整替换矩阵

### 4.1 中英双语命名合同

- 任何最终入选的音效 / BGM，都必须同时保留：
  - `中文名`
  - `英文本体`：原始曲名 / 原始短语 / 英文语义名
  - `完整 key`
- 禁止只交中文名，导致用户无法搜索
- 禁止只交 key，导致用户无法理解语义
- 若 `phrase-mappings.zh-CN.json` 暂无中文友好名：
  - 汇报中仍必须补一个可读中文名
  - 同时保留英文本体
  - 明确标记 `中文友好名待补`
- 若用户明确要在 `/dev/audio` 里按中文搜索：
  - 需要同步补 `public/assets/common/audio/phrase-mappings.zh-CN.json`
  - 以及 `src/assets/audio/phrase-mappings.zh-CN.json`
  - 不能只在汇报里补中文名，导致浏览器仍搜不到

## 5. 代码接入合同（强制）

### 5.1 统一使用 registry key

```ts
return 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
```

- 必须返回 registry 的完整 key
- `getOptimizedAudioUrl()` 会自动选择压缩产物
- 禁止手写 `compressed/` 路径

### 5.2 事件音 / UI 音 / 拒绝音

- **游戏态事件音**：走 `feedbackResolver` / `audioKey` / `audioCategory`
- **UI 点击音**：只用于纯 UI 操作，通过 `GameButton`
- **操作拒绝音**：通过 `playDeniedSound()` 播放
- **单一来源原则**：同一动作只能由事件音、按钮音或拒绝音其中之一触发

### 5.2.1 私有流程音与公共流程音

- 只要事件 payload 自带 `playerId`，接线时必须明确它属于：
  - `本地私有流程音`
  - 或 `全桌公共流程音`
- 默认规则：
  - 摸进自己手牌
  - 从弃牌区拿回自己手牌
  - 从自己手牌弃牌/打牌后只表示“我这边手牌变动”的短反馈
  这类优先按 `本地私有流程音` 处理
- 不能因为事件策略写成 `immediate`，就默认所有玩家都听到
- 若该音效涉及隐藏信息或私人手感，其他玩家与观战应保持静默

### 5.3 预加载策略

- `criticalSounds`
  进入游戏后立即预加载的高频音效
- `contextualPreloadKeys`
  基于上下文增量预热
- `AudioManager.preloadKeys()`
  UI 即将出现前的手动预热入口

### 5.4 SmashUp 派系/卡牌音效策略

- 默认优先使用派系通用音效池
- 只有语义高度匹配时，才给单卡补 `soundKey`
- `resolveFactionSound()` 先查卡牌 `soundKey`，没有再回退到通用音效池

### 5.5 骰子游戏掷骰音策略

- `diceCount = 1`：固定单骰 key
- `diceCount >= 2`：从多骰池随机
- 统一使用 `pickDiceRollSoundKey()`

## 6. BGM 分配合同（强制）

### 6.1 核心原则

- 游戏间 BGM 默认优先避开重复；“零重叠”是优先目标，不是压过主题贴合度的硬性要求
- 语义匹配和游戏主题贴合优先
- 普通阶段和战斗阶段分组明确
- 已有游戏 BGM 清单默认是**去重审计源**，不是默认候选池
- 当曲目确实贴合当前游戏主题、场景或情绪，且重复范围可解释时，允许少量复用已有游戏 BGM
- 禁止为了省事、包体已包含、别的游戏已配置、或没有做全库候选对比而直接复用

### 6.2 配置落点

- `bgm`
- `bgmGroups`
- `bgmRules`

只改其中一处不算完整接入。

### 6.3 新增/调整 BGM 最低检查

1. 曲目语义与目标游戏风格匹配
2. 已检查是否与其他游戏重复；若重复，已判断它是否确实贴合当前游戏主题、场景或情绪
3. registry 中存在对应 key
4. 已同步更新 `bgm`、`bgmGroups`、`bgmRules`
5. 已更新对应测试和文档说明
6. 已记录 `中文名 + 英文本体 + key`

### 6.4 重复允许条件与记录合同

- 若 BGM 与其他游戏重复，汇报中必须同时写明：
  - 重复的具体 key
  - 已复用到哪些游戏
  - 它为什么贴合当前游戏主题、场景或情绪
  - 为什么重复范围可以接受，以及为什么未选其他全库候选
- 如果写不出这些依据，就不得把重复 BGM 当作最终定案

## 7. 运行时 AudioContext 合同（强制）

- 禁止在 `ctx.resume()` 后同步检查 context 状态并据此跳过播放
- BGM 使用 `html5: true` 时，禁止用 WebAudio 的 suspend 状态拦截
- 用户手势解锁处理器必须在 `ctx.resume().then()` 回调中继续播放
- 单独的 AudioContext 也要遵守同样规则

详细代码示例见 `.spec/knowledge/standards/golden-rules.md`。

## 8. 已安装包 / 本地包 / 共享音频路径合同入口

Android 已安装包、共享音频包和 `common-audio` 的相对路径合同统一见 `.spec/knowledge/standards/audio-assets.md` 的“共享音频包路径合同”。本文件不再复制本地读取、blob URL、播放续接和四层路径同构规则；这里只记录项目接入时应回查该主合同。

## 9. 质量检查清单

- [ ] 音频文件仅存在于 `public/assets/common/audio/`
- [ ] 若本轮要求“从全局候选库移除某个 key”，已更新 `scripts/audio/registry-exclusions.json`
- [ ] 代码中不出现 `compressed/`
- [ ] 游戏层 `audio.config.ts` 不含 `basePath/sounds`
- [ ] 查 key 时优先使用 `audio-catalog.md` 和 `registry.ai.json`
- [ ] 最终交付包含 `中文名 + 英文本体 + key`
- [ ] 若交付的是候选矩阵，已明确它是否跨族群
- [ ] BGM 已做跨游戏重复检查；若重复，已写明例外理由
- [ ] 新增素材时已按 `docs/audio/add-audio.md` 生成产物
- [ ] 音效对接时已留查询证据和汇报
- [ ] 运行时失败已提供可见反馈，不能只留控制台日志或静默 `return null`
- [ ] 若删了旧候选来源，已同步补新接线或新候选矩阵
- [ ] 若用户要中文搜索，`public` 与 `src` 两份 phrase mapping 都已补齐
- [ ] 私有流程音未误广播给其他玩家或观战
