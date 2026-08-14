---
name: audio-assets
description: 音频资源标准：共享包、registry、触发路径和迁移策略——接入或排查音效时查
metadata:
  type: doc
  status: 已交付
---

# 音频资源规范

> 来源：从 `.spec/knowledge/standards/asset-pipeline.md` 无损拆出。本文档承载跨游戏音频运行时架构、共享音频包路径合同和音效触发路径；具体工作流优先走项目 [`audio-integration`](../../skills/audio-integration/SKILL.md)，命令、查找与试听入口见 `docs/audio/audio-usage.md`。

## 音频资源规范

> 音频 workflow 优先走项目 [`audio-integration`](../../skills/audio-integration/SKILL.md)；新增外部素材的产物合同详见：`docs/audio/add-audio.md`

### 音频架构 / 音频资源架构（强制）

**三层架构**：
1. **通用注册表**（`src/assets/audio/registry.json`，构建时从 `public/assets/common/audio/` 生成）：所有音效资源的唯一来源，包含 key 和物理路径映射。代码中通过静态 import 加载，Vite 会自动打包。
2. **事件与游戏配置**（`src/games/<gameId>/domain/events.ts` + `src/games/<gameId>/audio.config.ts`）：用 `defineEvents()` 定义事件音频策略，再用 `createFeedbackResolver(EVENTS)` 或少量高级覆盖生成 `feedbackResolver`，使用通用注册表中的 key。
3. **FX 系统**（`src/games/<gameId>/ui/fxSetup.ts`）：直接使用通用注册表中的 key 定义 `FeedbackPack`，不依赖游戏配置常量。

**核心原则**：
- **策略显式优先**：事件音频策略只允许在 `ui`（本地交互）、`immediate`（即时反馈）、`fx`（动画驱动）、`silent`（无音效）中选择；新增即时事件默认写完整形式 `{ audio: 'immediate', sound: KEY }`，不要依赖字符串简写或命名猜测来决定正式音效。
- **自动基线 + 可覆盖**：基础事件用 `createFeedbackResolver(EVENTS)` 生成；需要动态选择、条件静音或特殊逻辑时，在高级 `feedbackResolver` 中先调用基础 resolver，再做最小覆盖。
- **百游戏标准**：新增游戏事件定义应保持短小集中，`feedbackResolver` 优先 1 行生成；确需高级覆盖时也应只保留特殊逻辑。UI 组件默认不直接写游戏态音效代码。
- **禁止重复定义**：音效 key 只在通用注册表中定义一次，游戏层和 FX 层直接引用 key 字符串，不再定义常量。
- **禁止**在游戏层定义音频资源（`audio.config.ts` 不得声明 `basePath/sounds`）。
- **禁止**使用旧短 key（如 `click` / `dice_roll` / `card_draw`）。
- **必须**使用 registry 的完整 key（如 `ui.general....uiclick_dialog_choice_01_krst_none`）。
- **路径规则**：`getOptimizedAudioUrl()` 自动插入 `compressed/`，配置中**不得**手写 `compressed/`。
- **移动端已安装包音频直链禁令（强制）**：当音频资源来自 Android 已安装游戏包 / 共享音频包（`/_capacitor_file_/.../game-packages/.../current/assets/...`）时，**禁止**只依赖浏览器直接解码该本地 URL 并在失败后“换个 URL 就算修好”。必须保证：
  1. 首个本地候选失败后，优先走原生 `readInstalledAsset -> blob URL` 或等价桥接读取；
  2. 当前这一次播放请求会续到新候选实例上（BGM / SFX 都一样），不能只替换 `Howl` 实例却不重放；
  3. 官方远端 URL 只能作为最后一道兜底，不能充当对本地包媒体兼容问题的主修复。

### 共享音频包路径合同（强制）

- **单一真相源**：共享音频包 `common-audio` 的运行时相对路径，唯一真相源是 `public/assets` 下的相对路径，例如 `common/audio/bgm/...`、`common/audio/sfx/...`。
- **四层必须同构**：以下四层必须使用同一份相对路径合同，禁止任意一层私自裁前缀、改根目录或只改其中一处：
  1. 打包脚本写入 zip entry 的路径
  2. file index / installed-files-index 中记录的路径
  3. 原生 `current/assets` 下的实际落盘路径
  4. H5 运行时传给 `readInstalledAsset` 的 `relativePath`
- **BGM / SFX 不得各自发明目录语义**：`bgm/...`、`sfx/...` 只是 `common/audio/...` 下的子树，不是独立根路径。禁止因为“只有 BGM 挂了”就单独改 BGM 调用链去迁就目录错位。
- **先确认合同落点，再决定修复层**：当真实机出现“已安装共享音频包但读不到本地文件”时，必须先确认失配发生在上面四层中的哪一层，再决定修打包、原生、索引还是 H5 兼容。禁止在还没确认合同宿主前，直接把问题归因到 BGM 选择逻辑、自动播放策略或 Howler 参数。
- **兼容补丁的适用边界**：只有在已确认问题来自历史已发包与当前合同不一致、且短期内不能要求所有设备重装/重下资源包时，才允许在 H5 / bridge 层补“历史路径兼容读取”。这种兼容必须：
  1. 明确标注兼容的是哪一版历史目录布局
  2. 优先保留当前标准合同不变
  3. 补回归测试锁住“标准路径 + 历史路径”两条读取链
- **远端可读不是合同修复**：`官方资源域名 / 服务器资源主源` 只负责在线可用性，不能作为“本地包路径合同已经正确”的证明。只要真实机日志里仍出现本地 `readInstalledAsset` 找不到文件，就不得把问题表述成“音频链路已完全修好”。

### 音效触发与迁移策略（主源）

> **决策背景**：事件生成时刻与动画冲击帧不是同一时刻；若所有音效都在事件生成时播放，视听会错位。旧方案因此把“是否有动画”和“实际播放音效”拆在两个入口，容易出现重复配置和漏接线。当前以 `FeedbackPack.sound.timing` 作为有 FX 事件的播放时机声明，逐步收敛到单一配置源。

#### 当前架构（过渡期）

**音效两条路径 + UI 交互音**：
1. **路径① 即时播放（feedbackResolver）**：无动画的事件音（投骰子/出牌/阶段切换/魔法值变化）走 EventStream，`feedbackResolver` 返回 `SoundKey`（纯字符串）即时播放。有动画的事件（伤害/状态/Token）`feedbackResolver` 返回 `null`，由动画层在 `onImpact` 回调中直接 `playSound(key)` 播放。
2. **路径② 动画驱动（params.soundKey / onImpact）**：有 FX 特效的事件音（召唤光柱/攻击气浪/充能旋涡）通过 `FeedbackPack` 在 `fxSetup.ts` 注册时声明，`useFxBus` 在 push 时从 `event.params.soundKey` 读取 key。飞行动画（伤害数字/状态增减/Token 获得消耗）在 `onImpact` 回调中直接 `playSound(resolvedKey)` 播放。
3. **UI 交互音**：UI 点击音走 `GameButton`，拒绝音走 `playDeniedSound()`，key 来自通用注册表。

**选择原则**：有 FX 特效 → 路径②（FeedbackPack）；有飞行动画无特效 → 路径②（onImpact 回调）；无动画 → 路径①；UI 交互 → UI 交互音。

**避免重复**：同一事件只能选择一条路径，有动画的事件 `feedbackResolver` 必须返回 `null`。

**已废弃**：`DeferredSoundMap` 已删除，`AudioTiming`/`EventSoundResult` 已移除，`feedbackResolver` 不再返回 `{ key, timing }` 对象。

**过渡方案（未迁移到 FX 引擎的游戏）**：
- 创建 `domain/animationSoundConfig.ts` 集中管理所有 `onImpact` 音效配置
- 提供音效解析函数（如 `resolveDamageImpactKey`）
- 在 `useAnimationEffects.ts` 中从配置读取音效 key，而不是硬编码
- 迁移完成后删除该过渡配置，改由 `fxSetup.ts` 的 `FeedbackPack` 承担播放时机和 key 声明。

#### 目标架构（FeedbackPack 单一配置源）

> 目标架构、迁移边界和当前正确示例统一由本节承载，不再另设重复的“音效架构改进方案”入口。

**核心变化**：
- `feedbackResolver` 只处理"无动画的即时音效"（如投骰子、阶段切换）
- 所有有动画的事件音效统一在 `fxSetup.ts` 的 `FeedbackPack` 中声明
- 删除动画层的硬编码 `playSound()` 调用，由 FxLayer 自动触发

**迁移状态**：
- ✅ SummonerWars：已完成迁移，参考实现
- ✅ DiceThrone：已完成迁移到 FX 引擎
- ⏸️ SmashUp：无事件音效系统，暂不处理

**新游戏规范**：新增游戏必须直接采用长期架构，禁止使用过渡期的"两条路径"模式。

### 当前正确示例（音频）

```typescript
// ===== 路径① 示例：feedbackResolver 返回 SoundKey =====
feedbackResolver: (event): SoundKey | null => {
  if (event.type === 'CELL_OCCUPIED') {
    return 'system.general.casual_mobile_sound_fx_pack_vol.interactions.puzzles.heavy_object_move';
  }
  // 有动画的事件返回 null，音效由动画层 onImpact 播放
  if (event.type === 'DAMAGE_DEALT') return null;
  return null;
}

// ===== 路径② 示例：FX 系统 FeedbackPack（source: 'params'）=====
// src/games/summonerwars/ui/fxSetup.ts
const COMBAT_DAMAGE_FEEDBACK: FeedbackPack = {
  sound: {
    source: 'params',   // 从 event.params.soundKey 读取
  },
  shake: { intensity: 'normal', type: 'impact', timing: 'on-impact' },
};

// ===== 路径② 示例：飞行动画 onImpact 直接播放 =====
const impactKey = resolveDamageImpactKey(damage, targetId, currentPlayerId);
pushFlyingEffect({
  type: 'damage',
  content: `-${damage}`,
  onImpact: () => { playSound(impactKey); },
});
```

### 音频执行入口

- 具体 workflow 走项目 [`audio-integration`](../../skills/audio-integration/SKILL.md)。
- 压缩、registry / 语义目录生成、查找、试听和项目接入命令见 `docs/audio/audio-usage.md`。
- 本文档只承载运行时合同；新增外部素材的目录、命名、产物和浏览器验收见 `docs/audio/add-audio.md`。

**相关提案**：`openspec/changes/refactor-audio-common-layer/specs/audio-path-auto-compression.md`
