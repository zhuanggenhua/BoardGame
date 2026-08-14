# 新游戏收尾与启用清单

> 来源：从 `SKILL.md` 无损拆出。本文档承载 i18n、教学、音频、关键图片预加载、debug 配置、资源落盘和最终验证。

## 完成判断前置门禁（强制）

新游戏不得先用 E2E、截图或提案倒推“已经闭环”。进入最终完成判断前，必须先回查：

- 规则数据录入文件已存在，且能回到规则来源。
- 规则对象素材矩阵覆盖所有基础版必需对象。
- 矩阵中每个基础版必需对象都是 `pass`、`approved-programmatic`、`out-of-scope` 或带明确解阻动作的 `blocked`。
- 任何 `blocked` 或未裁定对象都已经同步写入 proposal/tasks/spec，且最终状态不能标为 complete。
- 运行时 UI 没有用 HTML/CSS、文字占位、程序化图形或 mock 图片冒充规则要求的正式素材，除非矩阵有明确批准。
- 游戏专属风格合同已存在，且真实截图能证明该游戏不是通用壳层、其它游戏换皮、TTS/BGG/DOM 原样照搬或多层框体堆叠。
- 用户点名的 DOM、BGG 电子版、结算界面、截图、规则书、素材文件已经读取并写入来源合同；任一未命中或不可用时，最终状态只能是 `blocked/in_progress`，不能用其它来源或 E2E 绿灯顶替。
- 桌面端真实页面、桌面结算/终局态和移动端目标姿态已按顺序截图复看；桌面未过不得宣称手机阶段完成，手机重叠或裁切不得宣称端到端闭环。
- 完成前已重新读取任务状态、OpenSpec tasks、规则对象素材矩阵、UI 截图 verdict 和完成状态文件；只要还有可本地推进的未完成项，就继续执行下一步，不发送完成式汇报。

如果收尾阶段才发现缺素材、缺数据、缺规则对象或缺正式 UI 承载，默认动作不是补一句说明后继续验收，而是退回 intake / OpenSpec / 实现阶段补齐，再重新执行验证。

## 不得完成的一票否决

以下任一情况成立时，只能汇报 `in_progress` 或 `blocked`，不得写“完成”“闭环”“基础版已交付”：

- 规则数据录入、素材矩阵、来源合同、布局合同或风格合同缺任一项。
- 用户点名的素材/DOM/BGG/截图未找到、未读取、为空、不可解析，或没有写明最小解阻动作。
- 真实截图中仍有主对象遮挡、重叠、手机裁切、过多框体、风格不像本游戏、主操作不可读等已知问题。
- E2E 只证明流程能点通，但基础玩法截图链、AI 复看、素材/布局/风格证据仍缺。
- 下一步仍可通过本地文件、脚本、截图、E2E、素材处理或文档更新继续推进，却只准备发送状态汇报。

## 阶段 6：收尾与启用

**目标**：补齐 i18n、测试、教学、音效。

### 6.1 i18n 文案

补齐 `public/locales/{zh-CN,en}/game-<gameId>.json` 中的所有文案：
- 阶段名称
- 命令/事件描述
- UI 文本
- 教学步骤文案

### 6.2 教学配置

参考 smashup/tutorial.ts 的模式：
1. setup 步骤：AI 自动完成选角 + 作弊设置手牌
2. UI 介绍步骤：逐个高亮 UI 元素（`highlightTarget` + `blockedCommands`）
3. 操作教学步骤：`requireAction: true` + `allowedCommands` + `advanceOnEvents`

### 6.3 音频配置（已重构，避免重复造轮子）

**强制先读**（权威单一来源，避免本文档过时）：
- `AGENTS.md`「音频资源架构（强制）」
- `.spec/knowledge/standards/asset-pipeline.md`「🔊 音频资源规范」
- 项目 skill `.spec/skills/audio-integration/SKILL.md`（workflow） + `.spec/knowledge/standards/audio-assets.md`（运行时主合同）；`docs/audio/audio-usage.md` 与 `docs/audio/add-audio.md` 只作命令、目录和产物示例参考

**你在新游戏里只需要做这些（最小闭环）**：
1. 创建 `src/games/<gameId>/audio.config.ts`，导出 `GameAudioConfig`：
   - `feedbackResolver(event): SoundKey | null`：无动画事件返回 SoundKey；有动画事件返回 `null`，音效交给动画层 `onImpact()` 播放
   - `criticalSounds`：进入游戏后立即预加载的高频音效 key（建议 5~15）
   - （可选）`contextualPreloadKeys`：根据上下文增量预热
   - BGM 列表按 `.spec/skills/audio-integration/SKILL.md` 配置；既有命令和目录示例可参考 `docs/audio/audio-usage.md`
2. **音效 key 的唯一来源**：`public/assets/common/audio/registry.json`。
   - 禁止在游戏层声明 `basePath/sounds`
   - 禁止手写 `compressed/`
   - 禁止定义短 key（如 `click/dice_roll`），必须使用 registry 的完整 key
3. **避免重复播放**：同一动作只能走一条路径（`feedbackResolver` / FX `FeedbackPack` / 动画 `onImpact` / UI `GameButton` / `playDeniedSound()`）。

> 参考实现：`src/games/smashup/audio.config.ts` / `src/games/summonerwars/audio.config.ts`。

### 6.4 关键图片预加载（若游戏有精灵图/图集）

**强制先读（权威单一来源）**：
- `.spec/knowledge/standards/asset-pipeline.md`（critical/warm 规则、路径格式、门禁与验收清单）

**你在新游戏里只需要做这些（最小闭环）**：
1. 实现 `criticalImageResolver.ts`，返回 `{ critical, warm }`，并按“选择阶段 vs 游戏阶段”动态解析。
2. 在 `game.ts`（或游戏入口约定的位置）注册 resolver。

> 参考实现：`src/games/smashup/criticalImageResolver.ts` / `src/games/summonerwars/criticalImageResolver.ts` / `src/games/dicethrone/criticalImageResolver.ts`。

### 6.5 debug-config（可选）

若需要调试面板，创建 `debug-config.tsx` 提供游戏专属调试选项。

**调试面板规范**：
- 调试入口统一使用 `GameDebugPanel` 组件挂载在 Board 内，不得创建新的全局入口。
- 调试操作必须通过 `SYS_CHEAT_*` 指令（依赖 CheatSystem），禁止直接修改 core。
- 若包含“发牌/出牌”类调试：
  - **必须以精灵图索引为发牌依据**（或等价的稳定索引），保证可复现。
  - **必须提供索引对照表**（索引 → 名称/类型），支持快速查找与一键发牌。
- 面板内状态复制/赋值需校验 JSON，失败给出明确提示。
- 重要调试动作尽量提供快捷按钮（如“清零/满值/切换阶段”）。

### 6.6 资源命名与落盘（缩略图 / 图集 / 插图）

1. 若用户已给素材类型或图片位置，AI 默认负责：
   - 先读图，再判断是否属于明显随机文件名；只有这类文件才按图片内容语义自动命名（如 `cover`、`<batch>`、`<entityId>-board`）
   - 自动移动到正确目录
   - 自动运行最小必要范围的压缩命令
2. 缩略图默认流程：
   - 原图放入 `public/assets/i18n/zh-CN/<gameId>/thumbnails/cover.png`
   - 运行 `npm run compress:images -- public/assets/i18n/zh-CN/<gameId>/thumbnails`
   - `manifest.ts` 中 `thumbnailPath` 使用 `<gameId>/thumbnails/cover`
   - `thumbnail.tsx` 使用 `ManifestGameThumbnail`，禁止自写 `<img src="/assets/...">`
3. 图集 / 运行时图片默认流程：
   - 若原图本身是单对象运行时资源，按业务语义落到 `public/assets/i18n/zh-CN/<gameId>/<category>/`
   - 若原图本身是大拼版、整版房间图、整版楼层图、扫描页或多对象说明页，必须先裁成单对象资源，再进入正式目录
   - 图集配置落到 `public/assets/atlas-configs/<gameId>/`
   - 切片顺序、索引和命名先写合同，再接入代码
4. 若当前环境依赖远端默认资源基址：
   - 启动前主动询问是否先 `npm run assets:download -- --game <gameId> --dry-run` 检查本地缺失运行时素材
   - 交付前必须执行 `npm run assets:check`
   - 若检查到本轮新增/变更的运行时资源远端缺失，必须继续上传并用远端 URL 复核到 `200/206`，再算交付完成

### 6.7 最终验证

```bash
npm run generate:manifests          # 清单生成成功
npx vitest run src/games/<gameId>   # 所有测试通过
npm run typecheck                   # 类型检查通过
npm run assets:check                # 若本轮新增了运行时资源，检查远端缺口
npm run assets:upload               # check 发现本轮运行时资源远端缺失时必须执行
npm run dev                         # 大厅可见、可创建对局、可完整游玩
```

### 验收

- 清单生成成功
- 所有测试通过
- 游戏可从大厅进入并完成完整游玩流程
- i18n 双语齐全
- 若本轮新增/修改了运行时资源：远端对象已上传，并已用实际远端 URL 复核可访问

---

