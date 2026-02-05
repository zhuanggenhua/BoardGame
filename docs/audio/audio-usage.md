# 音频资源使用规范

> 本文用于补齐“音频文件如何接入/压缩/注册”的完整流程，与图片资源规范保持一致。

## 1. 目录与来源（强制）
- **唯一音频资源目录**：`public/assets/common/audio/`
- **禁止**在 `src/games/<gameId>/` 下放音频文件或自建音频目录。
- **禁止**在游戏层 `audio.config.ts` 中声明 `basePath/sounds` 或手写音频路径。

## 2. 压缩与生成（强制）
### 2.1 压缩音频
使用脚本：`scripts/compress_audio.js`

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
使用脚本：`scripts/generate_common_audio_registry.js`

```bash
node scripts/generate_common_audio_registry.js
```

- 产出：`public/assets/common/audio/registry.json`
- **注意**：生成脚本会自动忽略 `compressed/` 目录，并基于路径生成 key。

### 2.3 生成音频清单文档
使用脚本：`scripts/generate_audio_assets_md.js`

```bash
node scripts/generate_audio_assets_md.js
```

- 产出：`docs/audio/common-audio-assets.md`

## 3. 代码使用规范（强制）
### 3.1 使用 registry key
- **必须**使用 `registry.json` 中的唯一 key。
- **禁止**写 `compressed/` 路径，`getOptimizedAudioUrl()` 会自动处理。

示例：
```ts
// 事件解析直接返回 registry key
return 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
```

### 3.2 事件音 vs UI 音（统一标准）
- **游戏态事件音**：通过事件流触发（`eventSoundResolver` / `audioKey` / `audioCategory`）。
- **UI 点击音**：仅用于纯 UI 操作（面板/Tab 切换），通过 `GameButton`。
- **单一来源原则**：同一动作只能由“事件音”或“按钮音”二选一，禁止重复。

示例：
```ts
// 事件元数据（优先级最高）
event.audioKey = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
event.audioCategory = { group: 'ui', sub: 'click' };
```

## 4. 质量检查清单
- [ ] 音频文件仅存在于 `public/assets/common/audio/`
- [ ] 已执行 `compress:audio`
- [ ] 已重新生成 `registry.json`
- [ ] 已更新 `common-audio-assets.md`
- [ ] 代码中不出现 `compressed/`
- [ ] 游戏层 `audio.config.ts` 不含 `basePath/sounds`
