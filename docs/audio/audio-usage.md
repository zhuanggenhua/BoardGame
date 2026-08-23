# 音频资源使用参考

本文只记录音频资源的项目入口、命令和查找路径。运行时合同看 [音频资源标准](../../.spec/knowledge/standards/audio-assets.md)，接入 workflow 看 [audio-integration](../../.spec/skills/audio-integration/SKILL.md)，新增外部素材看 [add-audio](add-audio.md)。

## 当前资源

| 对象 | 位置 |
| --- | --- |
| 唯一音频资源目录 | `public/assets/common/audio/` |
| 运行时注册表 | `public/assets/common/audio/registry.json` |
| 源码静态副本 | `src/assets/audio/registry.json` |
| AI 精简注册表 | `docs/audio/registry.ai.json` |
| 语义目录 | `docs/audio/audio-catalog.md` |
| 资源摘要 | `docs/audio/common-audio-assets.md` |
| 中文友好名 | `public/assets/common/audio/phrase-mappings.zh-CN.json` |
| 来源排除清单 | `scripts/audio/registry-exclusions.json` |

具体游戏的音效池、BGM 策略和对象绑定不写在本文；应放在对应 `audio.config.ts`、游戏文档、任务记录或 evidence。

## 常用命令

| 动作 | 命令 |
| --- | --- |
| 压缩公共音频 | `npm run compress:audio -- public/assets/common/audio` |
| 清理后重压缩 | `AUDIO_CLEAN=1 npm run compress:audio -- public/assets/common/audio` |
| 指定 ogg 码率 | `AUDIO_OGG_BITRATE=96k npm run compress:audio -- public/assets/common/audio` |
| 指定 ffmpeg | `FFMPEG_PATH=tools/ffmpeg/bin/ffmpeg.exe npm run compress:audio -- public/assets/common/audio` |
| 生成运行时 registry | `node scripts/audio/generate_common_audio_registry.js` |
| 生成资源摘要 | `node scripts/audio/generate_audio_assets_md.js` |
| 生成 AI 精简 registry | `node scripts/audio/generate_ai_audio_registry.js` |
| 生成语义目录 | `node scripts/audio/generate_audio_catalog.js` |
| 应用排除清单 | `node scripts/audio/apply_registry_exclusions.mjs` |
| 浏览器试听 | `/dev/audio` |

## 查找音效 key

按以下顺序查，不直接从完整 registry 盲翻：

1. `docs/audio/audio-catalog.md`：先找语义组和检索关键词。
2. `docs/audio/registry.ai.json`：缩小候选 key。
3. `src/games/**/audio.config.ts`：只看成熟用例、重复 BGM 和迁移成本，不当默认候选池。
4. `public/assets/common/audio/registry.json`：前几层不足时再回退。
5. `/dev/audio`：最终试听、复制 key、核对中文友好名。

候选矩阵默认要跨至少两个语义家族、音频包或 naming line。若用户明确只要同族群细挑，报告中标成“同族群收窄对比”。

## 最终选择记录

每个最终音效 / BGM 至少记录：

- 中文名。
- 英文本体：原始曲名、原始短语或英文语义名。
- 完整 registry key。
- 搜索关键词和命中的语义组。
- 被拒候选或被拒语义组。
- 选择理由。

若需要在 `/dev/audio` 支持中文搜索，同步更新：

- `public/assets/common/audio/phrase-mappings.zh-CN.json`
- `src/assets/audio/phrase-mappings.zh-CN.json`

## 代码接入

- 代码只使用 registry 完整 key。
- 禁止手写 `compressed/` 路径；优化路径由统一加载函数选择。
- 游戏态事件音走 `feedbackResolver` / `audioKey` / `audioCategory`。
- 纯 UI 点击音走 `GameButton`。
- 拒绝音走 `playDeniedSound()`。
- 同一动作只能有一个正式播放路径：事件音、按钮音或拒绝音三选一。

私有信息相关声音必须先判断传播范围：

| 类型 | 现实含义 |
| --- | --- |
| 本地私有流程音 | 只让当前玩家听到，例如手牌变化、自己弃牌、自己从弃牌区拿回手牌 |
| 全桌公共流程音 | 所有玩家和观战都应听到的公开事件 |

不能因为事件策略写成 `immediate` 就默认广播给所有人。

## BGM 检查

- `bgm`、`bgmGroups`、`bgmRules` 必须同步。
- 游戏间 BGM 默认优先避开重复；主题贴合度更强时才允许少量复用。
- 重复复用时，报告写明重复 key、已复用游戏、复用理由和未选其它候选的原因。
- 若写不出上述依据，不把重复 BGM 定为最终方案。

## AudioContext 注意项

- 禁止在 `ctx.resume()` 后同步检查 context 状态并据此跳过播放。
- BGM 使用 `html5: true` 时，禁止用 WebAudio 的 suspend 状态拦截。
- 用户手势解锁后续播放必须接在 `ctx.resume().then()` 回调里。

## 收口检查

- [ ] 音频文件只来自 `public/assets/common/audio/`。
- [ ] 代码中没有手写 `compressed/`。
- [ ] 游戏层 `audio.config.ts` 不维护私有 `basePath/sounds`。
- [ ] 最终交付含中文名、英文本体和完整 key。
- [ ] 新素材已按 [add-audio](add-audio.md) 更新 registry、摘要、中文名和试听证据。
- [ ] 候选矩阵注明是否跨族群。
- [ ] BGM 做过跨游戏重复检查。
- [ ] 私有流程音没有误广播。
- [ ] 播放失败有可见反馈，不能只留控制台日志或静默返回。
