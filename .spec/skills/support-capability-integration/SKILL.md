---
name: support-capability-integration
description: "BoardGame 游戏支撑能力接入 workflow。用于用户要求接入可选能力，或接入/排查操作日志、撤回、音效、AI、教程、调试配置、HUD 支撑能力。"
---

# 游戏支撑能力接入 Workflow

## 角色

本 skill 是 `workflow / adapter`，负责把“接入可选能力、操作日志、撤回、音效、AI、教程、调试配置”等用户要求落到可执行步骤。它不替代底层规范正文。

主源：

- 操作日志：[`../../knowledge/standards/engine-action-log.md`](../../knowledge/standards/engine-action-log.md)
- 撤回：[`../../../docs/architecture.md`](../../../docs/architecture.md) §5.5、[`../../knowledge/standards/undo-auto-advance.md`](../../knowledge/standards/undo-auto-advance.md)
- 音效：[`../../knowledge/standards/audio-assets.md`](../../knowledge/standards/audio-assets.md)、[`../audio-integration/SKILL.md`](../audio-integration/SKILL.md)
- AI：[`../game-ai-adaptation/SKILL.md`](../game-ai-adaptation/SKILL.md)
- 教程：[`../tutorial-workflow/SKILL.md`](../tutorial-workflow/SKILL.md)、[`../../knowledge/standards/tutorial-design.md`](../../knowledge/standards/tutorial-design.md)
- 调试配置：项目现有 `debug-config.tsx` / `createCheatSystem` / `CheatModifier` 模式；本 skill 只做开发态接入检查，不新建第二套调试规范。
- HUD / FAB 承载：[`../../knowledge/standards/ui-ux.md`](../../knowledge/standards/ui-ux.md)

## 触发语义

用户说“接入可选能力 / 接入可选 / 可选都接 / 把可选接上 / 附加能力 / 日志 / 撤回 / 音效 / 日志没东西 / 撤回没有 / 音效没响”时，默认先按**游戏支撑能力**处理，而不是按规则文本里的“可选分支 / optional choice”处理。只有用户明确点名某张牌、某个事件、某条规则的可选效果时，才转规则实现或规则 bug workflow。

当用户说“接入可选 / 接入可选能力 / 可选都接 / 把可选接上”且没有限定某一项时，默认触发**全量默认可选能力接入**，不是只审计、不是让用户再逐项选择、也不是只接日志/撤回/音效。默认全量包括：

- `action-log`：操作日志 / HUD 日志面板
- `undo-system`：撤回 / 撤回审批
- `audio-feedback`：事件音效 / BGM / UI 反馈音
- `game-ai-system`：本地 AI、强单机、AI 座位可玩性
- `tutorial-engine`：教学步骤 / 引导
- `debug-config`：仅开发态调试面板

只有用户明确说“只接 X”“暂不接 Y”“本轮跳过可选”或 OpenSpec 当前批准范围明确排除某项时，才允许从全量改成部分；被排除项必须写明现实影响和后续补回口径。

## 前提锁定

动手前写清四项：

- `gameId` 和入口文件：通常是 `src/games/<gameId>/game.ts`、`actionLog.ts`、`audio.config.ts`、`Board.tsx`。
- 本轮能力范围：`action-log`、`undo-system`、`audio-feedback`、`game-ai-system`、`tutorial-engine`、`debug-config` 中哪些要接入、哪些只审计；若用户说“接入可选”且没有限定，六项全部标为`本轮接入`。
- 真相来源：用户要求、OpenSpec / tasks、现有实现、对应主源规范和红测。
- 验收口径：目标测试、i18n 检查、类型检查、真实入口或截图是否需要。

## 实施流程

### 1. 能力盘点

逐项判定状态：`已接入` / `存在但不完整` / `本轮接入` / `明确跳过`。

- 不得因为 `createBaseSystems()` 默认包含 ActionLog / Undo，就判定游戏已经支持操作日志或撤回。
- 不得因为有 `audio.config.ts` 空壳，就判定音效已接入。
- 不得因为有 `ai.ts` 雏形、空 `tutorial.ts` 或开发态占位配置，就判定 AI、教程或调试配置已接入。
- 用户已触发“接入可选”全量语义时，六项默认都进入`本轮接入`；不能静默跳过任何一项。若某项做不了，必须报告现实阻塞、证据、影响和最小补救动作。
- 现有游戏只做兼容接入，不借机重做 UI、流程或表现合同。

### 2. 操作日志接入

按 `engine-action-log` 执行，最低门禁：

- 建立 `ACTION_LOG_ALLOWLIST`，覆盖所有有意义的玩家命令；内部系统、测试和作弊命令不得混入正式玩家日志。
- `formatEntry` 对每个 allowlist 命令返回 i18n `ActionLogSegment`，不得拼硬编码长文。
- 命令级日志只能在 `afterEventsRound === 0` 生成。
- 日志摘要不得复写私密参数、内部 ID、目标卡 ID、隐藏房间 ID 或调试字段；需要展示对象时先转为玩家可读名称或泛化摘要。
- 中英文 locale 必须同步补齐。

最低测试：

- 全部正式日志命令都有公开摘要。
- 日志序列化后不包含私密 payload 片段。
- 至少一条真人动作能写入玩家可见操作记录。

### 3. 撤回接入

按架构 §5.5 和 `undo-auto-advance` 执行，最低门禁：

- `UNDO_ALLOWLIST` 必须独立声明；禁止直接复用 `ACTION_LOG_ALLOWLIST` 或同一个数组引用。
- `UNDO_ALLOWLIST` 只包含玩家独立决策点命令。
- 纯确认、自动连锁、系统推进、UI / DEV / CHEAT 命令默认不进入撤回快照。
- 某个命令是前一操作的后续动作时，优先用 `_noSnapshot: true` 与前一个决策点共享撤回点。
- Board 不新建第二套撤回 UI；撤回入口由通用 GameHUD / FAB 承载。

最低测试：

- 真人独立动作产生撤回快照。
- AI 座位动作不占真人撤回快照。
- 撤回后操作日志和领域状态一起回退。
- 纯确认命令不在撤回白名单中；如确需进入，必须写明它为什么是玩家独立决策。

### 4. 音效接入

按 `audio-assets` 和 `audio-integration` 执行，先分类再接线：

- `ui`：按钮点击、拒绝音等本地交互走 GameButton / `playDeniedSound()`。
- `immediate`：无动画的游戏事件走 `feedbackResolver` 返回 registry 完整 key。
- `fx`：有动画或冲击帧的事件走 FX / `onImpact`，`feedbackResolver` 返回 `null`。
- `silent`：纯确认、状态同步、无玩家反馈价值的事件明确静音。

最低门禁：

- 音效 key 只来自 `public/assets/common/audio/registry.json`，禁止短 key、禁止手写 `compressed/`。
- 同一动作只能有一条播放路径，避免 UI 点击音和游戏事件音重复。
- 关键音效进入 `criticalSounds` 或按现有音频 workflow 预热。

最低测试：

- 需要即时反馈的事件能解析到目标 key。
- 需要动画驱动的事件在 `feedbackResolver` 返回 `null`。
- 配置 key 在 registry 和本地压缩实体中存在。

### 5. HUD / UI 承载检查

- 操作日志和撤回默认由通用 GameHUD / FAB 展示。
- 具体游戏 Board 只负责接入系统数据和必要状态，不重复实现完整日志面板、最近操作列表或撤回按钮。
- 若日志本身是当前规则结算主结果，可以在主视线区域展示该结果摘要；这不等于复制完整操作日志。

### 6. AI 接入路由

按 `game-ai-adaptation` 执行，本 skill 只做范围触发和收口检查：

- 若用户触发“接入可选”全量语义，`game-ai-system` 默认进入本轮接入；不能只保留测试 helper 后宣称 AI 已接入。
- 明确支持本地 AI / AI 座位 / 自动响应 / watchdog 中哪些能力，不能把其中一项通过外推出完整 AI。
- AI 合法动作必须来自规则动作合同和状态机，不能从按钮、DOM 或临时 UI 状态反推。

最低测试：

- 至少一条代表性 AI 座位能产生合法动作或合法跳过。
- AI 行为不占真人撤回快照。
- 若只完成测试友好最低 AI 路径，必须明确它不是完整 `game-ai-system`。

### 7. 教程接入路由

按 `tutorial-workflow` 与 `tutorial-design` 执行，本 skill 只做范围触发和收口检查：

- 若用户触发“接入可选”全量语义，`tutorial-engine` 默认进入本轮接入。
- 教程必须走项目教程引擎和游戏 `tutorial.ts` / 对应 manifest，不得用一次性提示文字冒充正式教程。
- 教程步骤必须绑定真实玩家入口或明确的演示状态；不得用隐藏调试命令替代玩家可见操作。

最低测试：

- 教程配置可加载，步骤引用的目标和文案存在。
- 至少一条教程链能从真实游戏入口进入并推进关键步骤，或明确记录当前缺少的真实入口阻塞。

### 8. 调试配置接入

调试配置只服务开发态，不进入正式玩家 UI：

- 若用户触发“接入可选”全量语义，`debug-config` 默认进入本轮接入；至少审查是否需要 `createCheatSystem`、`CheatModifier` 或等价开发态面板。
- 调试入口必须限定开发态或测试场景，不能作为正式玩法入口、E2E 正式玩家动作或教程完成证据。
- 如果该游戏规则没有可安全修改的资源、阶段或对象，允许标记为`本轮明确跳过`，但必须写明为什么不需要。

最低测试：

- 开发态调试配置不会出现在正式玩家主 UI。
- 若接入 `CheatModifier`，至少验证一个读写动作不会破坏核心状态结构。

## 收口验证

按改动范围选择最小充分命令：

- 操作日志 / 撤回：对应游戏的 action log / undo 测试，或新增最小合同测试。
- 音效：对应 `audio.config.test.ts`；没有时补最小 resolver + registry 测试。
- AI：对应 `ai` / 自动响应 / watchdog 测试，或新增最小合法动作测试。
- 教程：对应 tutorial 配置与真实入口推进测试。
- 调试配置：开发态入口或 `CheatModifier` 最小测试。
- i18n：改 locale 时跑 `npm run i18n:check`。
- 类型：涉及 TS 类型或 allowlist 时跑 `npm run typecheck`。
- 真实入口：用户要求“能看到 / 能撤 / 能听到”时，补真实 UI 入口或截图 / 试听证据。

最终汇报必须明确：

- 哪些支撑能力已接入；若用户触发“接入可选”，必须逐项覆盖六项默认能力。
- 哪些能力本轮明确跳过，以及现实影响。
- 哪些测试证明了日志、撤回、音效、AI、教程、调试配置各自成立；测试只能证明它覆盖的能力，不得外推。

## 禁止

- 禁止把“可选能力”误读成规则牌面里的 optional choice，除非用户明确点名规则对象。
- 禁止在用户说“接入可选”时只审计、不实施、只接部分能力或要求用户再逐项选择。
- 禁止用 `createBaseSystems()` 的默认存在替代功能验收。
- 禁止让操作日志和撤回共用同一个白名单。
- 禁止把私密 payload 原样写进操作日志。
- 禁止为了让音效“有声音”而在 UI 里硬编码游戏态音效。
- 禁止用音效配置测试通过证明操作日志或撤回已接入。
- 禁止用 AI / 教程 / 调试配置的占位文件证明对应能力已接入。
