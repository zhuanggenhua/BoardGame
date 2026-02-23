# 音频资源使用规范

> 本文用于补齐“音频文件如何接入/压缩/注册”的完整流程，与图片资源规范保持一致。
> 新增音频的全链路流程详见：`docs/audio/add-audio.md`


## 音频资源架构（强制）

**三层架构**：
1. **通用注册表**（`src/assets/audio/registry.json`，构建时从 `public/assets/common/audio/` 生成）：所有音效资源的唯一来源，包含 key 和物理路径映射。代码中通过静态 import 加载，Vite 会自动打包。
2. **游戏配置**（`src/games/<gameId>/audio.config.ts`）：定义事件音效的映射规则（`feedbackResolver`），使用通用注册表中的 key。
3. **FX 系统**（`src/games/<gameId>/ui/fxSetup.ts`）：直接使用通用注册表中的 key 定义 `FeedbackPack`，不依赖游戏配置常量。

**核心原则**：
- **禁止重复定义**：音效 key 只在通用注册表中定义一次，游戏层和 FX 层直接引用 key 字符串，不再定义常量。
- **禁止**在游戏层定义音频资源（`audio.config.ts` 不得声明 `basePath/sounds`）。
- **禁止**在 `src/games/<gameId>/` 下放音频文件或自建音频目录。
- **禁止**使用旧短 key（如 `click` / `dice_roll` / `card_draw`）。
- **必须**使用 registry 的完整 key（如 `ui.general....uiclick_dialog_choice_01_krst_none`）。

## 1. 目录与来源（强制）
- **唯一音频资源目录**：`public/assets/common/audio/`
- **禁止**在 `src/games/<gameId>/` 下放音频文件或自建音频目录。
- **禁止**在游戏层 `audio.config.ts` 中声明 `basePath/sounds` 或手写音频路径。

## 2. 压缩与生成（强制）
### 2.1 压缩音频
使用脚本：`scripts/audio/compress_audio.js`

示例：
```bash
# 压缩指定目录（会在每个目录生成 compressed/）
npm run compress:audio -- public/assets/common/audio

# 清理旧压缩后再压缩
AUDIO_CLEAN=1 npm run compress:audio -- public/assets/common/audio

# 可选：调整压缩码率（默认 96k）
AUDIO_OGG_BITRATE=96k npm run compress:audio -- public/assets/common/audio
```

### 2.2 生成 registry.json
使用脚本：`scripts/audio/generate_common_audio_registry.js`

```bash
node scripts/audio/generate_common_audio_registry.js
```

- 产出：`public/assets/common/audio/registry.json`（生成后需复制到 `src/assets/audio/registry.json`）
- **注意**：生成脚本会优先使用 `compressed/` 变体；若同 key 同时存在原始与压缩版本，将自动保留压缩版本并跳过原始文件。
- **部署说明**：
  - 开发环境：代码从 `src/assets/audio/registry.json` 静态 import，修改后刷新即可生效
  - 生产环境：Vite 构建时自动打包 JSON 到产物中
  - 音频文件本身仍从 CDN 加载（通过 `VITE_ASSETS_BASE_URL` 配置）

### 2.3 生成音频清单文档
使用脚本：`scripts/audio/generate_audio_assets_md.js`

```bash
node scripts/audio/generate_audio_assets_md.js
```

- 产出：`docs/audio/common-audio-assets.md`

### 2.4 生成 AI 精简 registry（强烈推荐）
用于减少 AI 查找音效时的 token 消耗（不影响运行时）。

> 说明：AI 在挑选/替换音效时**优先**使用精简 registry（`registry.ai*.json`）+ 语义目录（`audio-catalog.md`）定位候选 key。
> 仅当目录/精简库不足以定位时，再回退到全量 `public/assets/common/audio/registry.json`。

**全量精简版（全仓库通用）**
```bash
node scripts/audio/generate_ai_audio_registry.js
```
- 产出：`docs/audio/registry.ai.json`
- 内容：仅保留 `key/type/category`，去掉 `src`

**DiceThrone 专用精简版（仅扫描该游戏源码）**
```bash
node scripts/audio/generate_ai_audio_registry_dicethrone.js
```
- 产出：`docs/audio/registry.ai.dicethrone.json`
- 内容：仅包含 `src/games/dicethrone` 中实际使用的 key

### 2.5 AI 查找/筛选音效（推荐流程）
**目标**：在挑选音效时，用最小 token 成本定位合适 key。

**首选方法：语义目录（强制执行，除非明确说明不需要）**

1. 打开 `docs/audio/audio-catalog.md`（42 KB，531 个语义组，AI 可一次性读取）
2. 搜索场景关键词（如 `negative`、`click`、`sword`、`heal`、`alert`）
3. 找到组后，复制 grep 模式列的值（如 `puzzle.*negative_pop`）
4. 在 `registry.json` 中 grep 该模式获取完整 key
5. 变体替换末尾数字/字母（`_01` → `_02`）

> 强制说明：凡是“找音效 key / 给候选列表 / 替换音效”的任务，AI 必须优先使用：
> 1) `docs/audio/audio-catalog.md`（语义目录）
> 2) `docs/audio/registry.ai.json` 或 `docs/audio/registry.ai.<gameId>.json`（精简 registry，如存在）
> 仅当以上信息不足以定位 key，才允许回退到全量 `public/assets/common/audio/registry.json`。

**生成/更新目录：**
```bash
node scripts/audio/generate_audio_catalog.js
```

**备选方法（精简 registry）：**
- `docs/audio/registry.ai.json`（全量精简，仅保留 key/type/category）
- `docs/audio/registry.ai.dicethrone.json`（DiceThrone 专用，最小）

**AI 查询示例（grep_search）：**
```json
{
  "SearchPath": "docs/audio/audio-catalog.md",
  "Query": "negative|denied|fail|error",
  "CaseSensitive": false
}
```

**如果目录中未找到合适的，再搜全量 registry：**
```json
{
  "SearchPath": "public/assets/common/audio/registry.json",
  "Query": "negative_pop",
  "CaseSensitive": false
}
```

### 2.6 音效预览（/dev/audio）
用于在浏览器内快速试听、复制 key、检查分类与翻译。

**入口**：访问 `/dev/audio`。

**功能**：
- 左侧分类树（group/sub）筛选
- 关键词搜索（key / src / 友好名称）
- 类型过滤（音效/音乐）
- 点击名称复制 key，点击播放按钮试听

**注意事项**：
- 预览依赖 `public/assets/common/audio/registry.json`，新增音效后需先重新生成 registry。
- 友好中文名来自 `public/assets/common/audio/phrase-mappings.zh-CN.json`，如翻译更新需同步生成并刷新页面。

## 3. 代码使用规范（强制）
### 3.1 使用 registry key
- **必须**使用 `registry.json` 中的唯一 key。
- **禁止**写 `compressed/` 路径，`getOptimizedAudioUrl()` 会自动处理。

示例：
```ts
// 事件解析直接返回 registry key
return 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
```

### 3.2 事件音 vs UI 音 vs 拒绝音（统一标准）
- **游戏态事件音**：通过事件流触发（`feedbackResolver` / `audioKey` / `audioCategory`）。
- **UI 点击音**：仅用于纯 UI 操作（面板/Tab 切换），通过 `GameButton`。
- **操作拒绝音**：用户尝试不合法操作时（非自己回合、条件不满足等），通过 `playDeniedSound()` 播放（key: `puzzle.18.negative_pop_01`）。
- **单一来源原则**：同一动作只能由"事件音"、"按钮音"或"拒绝音"其中之一触发，禁止重复。

示例：
```ts
// 事件元数据（优先级最高）
event.audioKey = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
event.audioCategory = { group: 'ui', sub: 'click' };
```

### 3.3 音效预加载策略（新增）
- **criticalSounds**：进入游戏后立即预加载的“首回合高频音效”。数量建议 5~15。
- **contextualPreloadKeys**：基于上下文增量预热（如选派系/卡组后加载对应音效）。
- **UI 层提前预热**：在 UI 即将出现前手动调用 `AudioManager.preloadKeys()`，用于单个按钮/步骤的点击音。

示例：
```ts
// 游戏配置：上下文预加载
contextualPreloadKeys: (context) => {
  return context.G?.selectedFactions ? ['ui.general.menu_click_01'] : [];
}

// UI 层：进入教程后预热按钮音效
AudioManager.preloadKeys(['ui.general.menu_click_01']);
```

### 3.4 派系/阵营卡牌音效选择策略（SmashUp 适用）
- **通用音效池优先**：每个派系在 `audio.config.ts` 中配置通用音效池（随从池 + 行动池），所有卡牌默认使用通用音效池随机播放。
- **专属 soundKey 仅用于语义明显更匹配的卡牌**：只有当卡牌名称/描述的语义与某个音效高度匹配，且该音效比通用音效池更合适时，才在卡牌数据中配置 `soundKey`。
- **判断标准**：
  - ✅ 配置 soundKey：卡牌名称/描述直接对应某种声音（如"咀嚼"→撕咬音效，"魔法"→魔法音效）
  - ❌ 不配置 soundKey：卡牌描述是游戏机制（如"放置力量指示物"、"抽卡"、"弃牌"），没有比通用音效更匹配的
- **目标**：减少音效文件加载量，保持派系风格统一，只在真正有意义的地方做差异化。
- **优先级**：`resolveFactionSound()` 先检查卡牌 `soundKey`，没有则 fallback 到通用音效池。

### 3.5 骰子游戏通用音效选择策略
- **目标**：掷骰音效按骰子数量分流，避免单骰与多骰混用。
- **规则**：
  - `diceCount = 1`：固定使用单骰 key（`dice_roll_velvet_001`）。
  - `diceCount >= 2`：从多骰池随机（建议 `minGap=1` 防止连续重复）。
- **统一入口**：使用 `pickDiceRollSoundKey()`，禁止游戏内重复实现。
- **接入点**：事件流（如 `DICE_ROLLED` / `UNIT_ATTACKED`）或 UI 掷骰展示时。

## 4. BGM 选曲与分配规范（强制）

### 4.1 核心原则
- **游戏间 BGM 零重叠**：每首 BGM 只能分配给一个游戏，禁止跨游戏共用。测试会自动检查。
- **语义匹配优先**：曲目名称/风格必须与游戏主题契合，不能为了凑数随意分配。
- **混响时间（RT）参考**：RT 值越小节奏越紧凑（适合战斗），RT 值越大越空灵舒缓（适合策略/探索）。

### 4.2 分组规则
每个游戏的 BGM 分为 `normal`（普通阶段）和 `battle`（战斗阶段）两组：
- **normal 组**：main 版本为主，可包含少量 intense 版本增加变化
- **battle 组**：intense 版本为主，也可包含 main 版本（节奏本身够快的曲目）
- 每组必须指定一个**默认曲目**（`bgmRules` 中的 `key` 字段）

### 4.3 各游戏风格定位

| 游戏 | 风格关键词 | 适合的曲目特征 | 不适合的曲目特征 |
|------|-----------|---------------|----------------|
| Summoner Wars | 军事策略、召唤魔法、棋盘战争 | 史诗/军事/魔法/吟游诗人、中等混响 | 纯休闲、过于空灵冥想、英雄冒险 |
| DiceThrone | 英雄对决、骰子战斗、快节奏 | 英雄/冒险/战斗/命运、短混响高能量 | 渔村休闲、空灵冥想、缓慢沉思 |
| SmashUp | 派对卡牌、轻松搞怪、多阵营混战 | 休闲/放克/派对/欢快 | 严肃史诗、黑暗沉重 |

### 4.4 当前分配总览（需随配置同步更新）

**SW（16 首）**：To The Wall(默认普通), Stone Chant(默认战斗), Corsair, Lonely Bard, Luminesce, Wind Chime, Elder Awakening, Feysong Fields + 各自 intense 版本

**DT（16 首）**：Stormborn Destiny(默认普通), Dragon Dance(默认战斗), Hang Them, My Kingdom, Shields and Spears, Ogres, Nock!, Fireborn + 各自 intense 版本

**SmashUp（17 首）**：Nobody Knows(默认普通), Move Your Feet(默认战斗), Tiki Party, Bubblegum, Field Day, Lizards, Sunset, Sunny Days, Big Shot + 各自 intense 版本

### 4.5 新增/调整 BGM 检查清单
1. 确认曲目语义与目标游戏风格匹配（参考 §4.3）
2. 确认不与其他游戏重复（grep 全部 `audio.config.ts` 的 BGM key）
3. 确认 registry 中存在该 key（`registry.json`）
4. 更新 `bgm` 数组、`bgmGroups`、`bgmRules`（如改默认）
5. 更新对应测试（BGM 数量断言、no-overlap 断言）
6. 更新本文档 §4.4 的分配总览

## 5. 运行时 AudioContext 规范（强制）

> 详细代码示例见 `docs/ai-rules/golden-rules.md` § AudioContext 异步解锁规范

- **禁止在 `ctx.resume()` 后同步检查 context 状态并据此跳过播放**。`resume()` 是异步的，必须等待完成。
- **BGM 使用 `html5: true`**，禁止用 WebAudio 的 `isContextSuspended()` 来阻止 HTML5 Audio 播放。
- **用户手势解锁处理器**必须在 `ctx.resume().then()` 回调中播放音频，而非同步调用。
- **单独的 AudioContext**（如 `SynthAudio.ts`）也需遵守同样规则。

## 6. 质量检查清单
- [ ] 音频文件仅存在于 `public/assets/common/audio/`
- [ ] 已执行 `compress:audio`
- [ ] 已重新生成 `registry.json`
- [ ] 已更新 `common-audio-assets.md`
- [ ] 代码中不出现 `compressed/`
- [ ] 游戏层 `audio.config.ts` 不含 `basePath/sounds`
- [ ] 音频播放代码不在 `ctx.resume()` 后同步检查 context 状态
- [ ] BGM 播放不用 `isContextSuspended()` 拦截

