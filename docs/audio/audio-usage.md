# 音频资源使用合同

> 本文是 BoardGame 音频系统的“架构 + 运行时合同 + 命令入口”。
> 执行型 workflow 已下沉到项目 skill：`./.codex/skill/audio-integration/SKILL.md`。
> 如果任务是“对接音效 / 查匹配 key / 新增素材 / 补预加载 / 做试听收口”，先走该 skill，再回到本文查具体合同。

## 0. 文档分工

- `./.codex/skill/audio-integration/SKILL.md`
  承担执行步骤、查找链路、汇报模板、/dev/audio 收口动作
- `docs/audio/add-audio.md`
  承担新增外部音频素材的目录、命名、产物和验收合同
- `docs/audio/audio-catalog.md`
  承担语义目录检索入口
- `docs/audio/registry.ai.json`
  承担 AI 精简检索入口
- `public/assets/common/audio/registry.json`
  承担运行时完整注册表

## 1. 音频资源架构（强制）

**三层架构**：

1. **通用注册表**
   `src/assets/audio/registry.json`
   构建来源是 `public/assets/common/audio/`，是所有音效资源的唯一来源。
2. **游戏配置**
   `src/games/<gameId>/audio.config.ts`
   定义事件音效映射、预加载策略、BGM 分组和派系/角色音效池。
3. **FX 系统**
   `src/games/<gameId>/ui/fxSetup.ts`
   直接使用 registry key 定义 `FeedbackPack`，不依赖游戏配置常量。

**核心原则**：

- 音效 key 只在通用注册表中定义一次
- 游戏层和 FX 层直接引用完整 registry key
- 禁止在 `src/games/<gameId>/` 下放音频文件或自建音频目录
- 禁止在 `audio.config.ts` 中声明 `basePath/sounds`
- 禁止使用旧短 key，如 `click`、`dice_roll`、`card_draw`
- 禁止在代码里手写 `compressed/` 路径

## 2. 目录与产物（强制）

- 唯一音频资源目录：`public/assets/common/audio/`
- 运行时注册表：`public/assets/common/audio/registry.json`
- 源码静态副本：`src/assets/audio/registry.json`
- AI 精简注册表：`docs/audio/registry.ai.json`
- 语义目录：`docs/audio/audio-catalog.md`
- 资源清单：`docs/audio/common-audio-assets.md`
- 中文友好名：`public/assets/common/audio/phrase-mappings.zh-CN.json`

## 3. 常用命令入口

### 3.1 压缩音频

```bash
npm run compress:audio -- public/assets/common/audio
```

### 3.2 生成运行时 registry

```bash
node scripts/audio/generate_common_audio_registry.js
```

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
node scripts/games/dicethrone/audio/generate_ai_audio_registry_dicethrone.js
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

1. **语义目录优先**
   先用 `docs/audio/audio-catalog.md` 找语义组和 `grep pattern`
2. **精简 registry 第二层**
   用 `docs/audio/registry.ai.json` 或游戏专用精简 registry 缩小候选 key
3. **全量 registry 最后回退**
   仅当前两层不足时，才回退到 `public/assets/common/audio/registry.json`
4. **/dev/audio 最终确认**
   用于试听、复制 key、检查分类与中文友好名

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

- 游戏间 BGM 零重叠
- 语义匹配优先
- 普通阶段和战斗阶段分组明确

### 6.2 配置落点

- `bgm`
- `bgmGroups`
- `bgmRules`

只改其中一处不算完整接入。

### 6.3 新增/调整 BGM 最低检查

1. 曲目语义与目标游戏风格匹配
2. 不与其他游戏重复
3. registry 中存在对应 key
4. 已同步更新 `bgm`、`bgmGroups`、`bgmRules`
5. 已更新对应测试和文档说明

## 7. 运行时 AudioContext 合同（强制）

- 禁止在 `ctx.resume()` 后同步检查 context 状态并据此跳过播放
- BGM 使用 `html5: true` 时，禁止用 WebAudio 的 suspend 状态拦截
- 用户手势解锁处理器必须在 `ctx.resume().then()` 回调中继续播放
- 单独的 AudioContext 也要遵守同样规则

详细代码示例见 `docs/ai-rules/golden-rules.md`。

## 8. 已安装包 / 本地包 / 共享音频路径合同（强制）

当音频来自 Android 已安装游戏包或共享音频包时：

- 首个本地候选失败后，优先走 `readInstalledAsset -> blob URL` 或等价桥接读取
- 当前播放请求必须续到新候选实例
- 官方远端 URL 只能做最后兜底，不能充当本地主链修复
- `common-audio` 的单一真相源是 `public/assets` 下的相对路径，如 `common/audio/bgm/...`
- 打包脚本、索引、原生落盘和 H5 `relativePath` 必须使用同一相对路径合同

## 9. 质量检查清单

- [ ] 音频文件仅存在于 `public/assets/common/audio/`
- [ ] 代码中不出现 `compressed/`
- [ ] 游戏层 `audio.config.ts` 不含 `basePath/sounds`
- [ ] 查 key 时优先使用 `audio-catalog.md` 和 `registry.ai.json`
- [ ] 新增素材时已按 `docs/audio/add-audio.md` 生成产物
- [ ] 音效对接时已按 `audio-integration` skill 留查询证据和汇报
