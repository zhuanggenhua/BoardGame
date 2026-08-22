---
name: dicethrone-hero-intake
description: "Dice Throne 角色图片、骰面、Token、卡牌、裁图、资源上传与规则文档录入 workflow。"
---

# Dice Throne 角色图片录入工作流

## 适用范围

用于 Dice Throne 单个角色或一批新英雄的 intake：锁真相源、裁图、录入玩家板 / 提示板 / 骰面 / Token / 能力 / 卡牌、同步 i18n 和规则文档、重建 manifest、上传资源、补测试与 evidence。本流程只负责“已有素材与规则材料的正确录入”；复杂机制设计另走规则实现 workflow。

## 输入与真相源

最低输入：

- `player-board`、`tip`、`ability-cards`、`dice` 原图或等价骰面来源。
- 角色英文 canonical 名称来源。
- 角色对照源：官方规则书、官方 PDF、Wiki、FAQ 或用户指定来源。
- FAQ 裁定源：`docs/games/dicethrone/sources/faq/王权骰铸常见问题总览2.1.1.docx`。

权威分工：

- 汉化图 / 用户指定图：中文名、中文描述、图内顺序和裁图定位。
- 官方规则书 / PDF / 官方图：英文与规则裁定高优先级对照。
- FAQ：补充状态花费 / 移除、响应窗口、攻击是否成立、防御是否可用等边界；不替代图面主真相源。
- Wiki / Fandom / Rulepop：只能辅助英文名或冲突发现；若转成本地快照，必须保留来源链接和获取日期。
- 当前 worktree：本轮资源、裁图、manifest、发布结果和测试证据的唯一执行现场。

冲突处理：

- `public/assets/i18n/zh-CN/dicethrone/images/<hero>/compressed/ability-cards.webp` 或正式同源 atlas 是卡牌语义主真相源；`temp/dicethrone-intake/<hero>/...` 里的裁片只辅助读字。
- 用户口径、实现、i18n、测试快照或旧 evidence 任意两者冲突时，先回完整单卡、玩家板或提示板重录合同；不得把用户随口词直接写成官方卡名、分支名、规则字段或测试期望。
- 重新录入前必须先有最小字段合同：对象、正式图源、atlas/index 或槽位、单对象裁图、图面原文、分支 / 槽位结构、当前实现差异和合同状态。

## 玩家板与槽位合同

只要玩家板能看出技能槽、被动槽、防御槽、终极槽、展示槽或空槽，录入阶段必须建立 `玩家板图面合同`：

- 逐槽记录物理坐标、图面标题、运行时对象、允许状态和是否可交互。
- `slotId` 只表示物理位置，不能表示技能名；共享坐标不等于共享技能语义。
- 覆盖层、点击反查、高亮反查和测试断言必须消费同一份 `当前英雄 + 物理槽 -> 玩家板图面技能` 合同。
- 升级牌覆盖槽位必须对齐三件事：运行时 `replaceAbility(targetAbilityId)`、升级牌中文名、玩家板中文槽位标题。缺任一项只能标 `blocked / disputed`。
- 发现升级牌盖错槽、点错槽或和底图标题不一致时，必须横扫同英雄、同批次和同一共享槽位消费链：全部替换型升级牌、覆盖槽 helper、点击 / 高亮反查槽和真实升级稳定态。

## 资源完成判据

Dice Throne 资源常被 `.gitignore` 忽略，不能只看 `git status`。资源已完成至少满足：

- 本地 `public/assets/i18n/zh-CN/dicethrone/images/<hero>/compressed/*.webp` 存在。
- `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` 已重建。
- 运行时代码引用已接入。
- 代表性 `https://assets.easyboardgame.top/official/...` URL 返回 `200`，且内容来自服务器主源。
- 若有 Token / 状态图标，`status-icons-atlas.json` 被运行时真实消费，徽章命中 sprite，不退成纯色 fallback。

正式资源与核对产物必须分层：

- `temp/`：OCR、放大、normalized preview、单卡核对裁片和其它中间产物。
- `public/assets/.../compressed/`：正式运行时媒体。
- 本地 atlas JSON：按项目路径加载；不默认发布到服务器资源主源。

禁止把 `public/assets/.../crops/**`、临时 hand preview、未进 manifest 的裁片或后处理图接到正式 `cards.ts` 手牌图引用。只有正式 atlas 被证伪且用户明确批准时，才允许改 atlas 配置或启用正式单卡图方案。

## 禁止提前收口

用户要求“新增角色 / 两个新角色一起做 / 数据录入、上传、审计、端到端全流程”时，不得把“可选角 + 资源能显示 + smoke 测试通过”报成完成。完成口径必须同时清空：

- **数据录入**：每个角色有真相源表、技能 / Token 录入核对、卡牌录入核对；每张卡、每个技能、每个 Token 都有来源定位、图文要点、结构化字段和实现结论。
- **伤害语义**：伤害类技能 / 卡牌必须记录图面颜色 / 框色 / 伤害图标或关键词、是否攻击伤害、是否触发防御投、是否直接 / 附属 / 不可防御 / 终极伤害；不得只因产生伤害事件就归为可防御攻击。
- **防御重投**：防御技卡面写有“可重掷 / 可再投 / 至多 N 颗 / 再次投掷”时，必须证明共享消费字段（如 `rollLimit`）、`ABILITY_ACTIVATED -> defensiveRoll` 后的权威状态和真实 UI 的“保留部分骰子后继续重投”窗口；只证明掷出并结算 N 颗骰不能收口。
- **双面英雄**：两张面分别有玩家板槽位合同、对象矩阵、翻面语义和 completion audit；底图能显示不等于双面机制完成。
- **机制实现**：被动、Token、状态、攻击、防御、延迟结算、可选目标、响应时机逐项裁定；未实现项同步写入规则文档和 evidence。
- **资源发布**：本地资源、manifest、运行时代码引用、上传结果和远端回查逐项对上。
- **审计证据**：evidence 写清权威来源、对象矩阵、原子语义、实现消费、最终权威结果、测试 / 截图证据和剩余风险。
- **真实入口**：至少覆盖真实在线双玩家；Host / Guest 截图分别看到对应新角色玩家板、提示板、手牌 / 卡图和 HUD。最终说 E2E 通过时，必须给出本轮实际核对过的截图绝对路径。

只完成静态接入或领域行为验证，只能说“某层已完成”；不得写“发布级完成”或“全流程完成”。

## 执行流程

### 1. 锁定范围

开工前写清：

- `heroId` / 批次清单。
- 当前 worktree。
- 本轮是只做录入，还是包含机制实现。
- 每个角色状态矩阵：`pending / in_progress / passed / blocked / scoped-debt`。

用户说“继续”时，默认继续当前 evidence 里已列对象；新增兄弟对象必须有用户点名、共享消费者直接影响、新真相源冲突或整批范围证据。

### 2. 建立规则合同

在 `src/games/dicethrone/rule/` 下建立或更新：

- `<角色>真相源表.md`
- `<角色>录入核对.md`
- `<角色>卡牌录入核对.md`（如适用）

至少写清主真相源、对照源、获取日期、当前 worktree、本轮 scope、冲突项、已直接查看的完整单卡 / 玩家板槽位 / 提示板块，以及当前差异属于录入错、索引错还是运行时消费错。

### 3. 裁图与 atlas 裁决

先把整图切到单对象可读粒度：玩家板逐槽、提示板逐 Token / 关键词 / 骰面说明、卡图逐卡或逐 slot。优先复用：

- `npm run dicethrone:intake:crops -- --hero <heroId> --source ability-cards --max-index <n>`
- `scripts/games/dicethrone/assets/*`

裁图裁决：

- 默认优先复用原 `ability-cards` atlas。
- 临时裁片可辅助读字；若与正式 atlas 冲突，先重切高清裁片，再裁定。
- 核对图看起来异常时，先查裁图参数、后处理链、老角色同位和正式 UI；不得直接推翻 atlas 合同。
- `previewRef.type='atlas'` 表示正式 atlas + index；`previewRef.type='image'` 仅限用户批准的正式单卡图。

### 4. 复合升级门禁

只要原始 `ability-cards.webp`、用户反馈或老角色对照显示“一张物理牌含上下子区 / 多标题 / 升级标题 + 子技能区”，先进入阻断态：

1. 裁定它是“一张物理牌 + 复合升级语义”，还是“多张独立手牌”。
2. 和成熟老角色同类升级对照，确认是否遵守“同一基础技能逐级替换、同类取最高、子效果进入能力 variants”的共享合同。
3. 分层登记真相源裁图、临时核对图和正式运行时资源。

阻断态下禁止继续在 `cards.ts` 里维持或新增“两个子区 = 两张牌”的录入；禁止继续用 atlas/frame/`previewRef` 调整掩盖模型错误；禁止用 E2E 通过证明素材合同正确。

### 5. 录入数据与同步文档

按角色实际情况更新：

- `src/games/dicethrone/heroes/<hero>/diceConfig.ts`
- `src/games/dicethrone/heroes/<hero>/tokens.ts`
- `src/games/dicethrone/heroes/<hero>/abilities.ts`
- `src/games/dicethrone/heroes/<hero>/cards.ts`
- `src/games/dicethrone/heroes/<hero>/index.ts`
- `src/games/dicethrone/domain/ids.ts`
- `src/games/dicethrone/domain/characters.ts`
- `src/games/dicethrone/domain/index.ts`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`

硬规则：

- 卡图顺序只来自 `ability-cards` 裁图和合同表。
- 不得沿用旧角色 slot 顺序假设。
- 不得伪造未确认的 `abilityTags`、费用、数值或时机。
- `type='action'` 是打出后直接结算；`type='upgrade'` 是替换玩家板基础技能。
- `targetAbilityId` 必须指向基础技能 ID，不能指向变体、子集或临时 UI 槽位。
- 新角色若仍实施中，只使用既有 `implementation_in_progress` disabled overlay，不新建第二套实施中组件或样式。

### 6. 共享合同对比

录完新角色后，至少挑一个成熟老角色对照；若争议点是复合升级、复合排版、Token / 状态图标或头像图集，则挑同类老角色逐项对照：

- 手牌类别、升级状态落点、`previewRef` / atlas、通用卡索引。
- Token / 状态图标消费链：定义 ID、frame key、atlas id / path、视觉元数据、加载链、血条上方徽章是否命中 sprite。
- AI / 阶段门禁、UI 消费链、选择逻辑、被动能力建模和槽位展示 / 能力执行边界。
- 角色选择头像若改共享合同，必须列出受影响老角色并提供 PC 与移动端老角色选角截图；移动端异常优先查缓存、manifest hash、实际请求 URL 和响应体。

没有这步，不能说“新角色已和老角色一致 / 已全部收口”。

### 7. 发布与回查

发布前先重建 manifest：

```bash
node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id dicethrone
```

再检查正式媒体、manifest、运行时请求路径和临时产物分层。发布按通用资源规则执行：

```bash
npm run assets:check
npm run assets:upload
```

至少回查代表性公开 URL：`player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp`，如适用再加 `status-icons-atlas.webp`、共享背景和角色头像。任一代表 URL 为 `404`，资源 intake 不算完成。atlas JSON 若不上传，必须在 evidence 写清本地路径、构建结果和真实消费证据。

### 8. 机制实现前置

如果本轮包含技能或 Token 机制实现，先读 [`engine-systems`](../../knowledge/standards/engine-systems.md)，并完成术语到事件、决策点、冲突项裁定。禁止跳过建模，直接凭图片正文硬写 handler。

## 验证与交付

按改动面选择最小充分验证：

- 静态数据 / 机制实现：相关 Vitest。
- 资源引用 / 预加载：资源、manifest 或 resolver 测试。
- UI 卡图展示 / 手牌预览：真实 E2E 与截图证据；UI 展示改动必须人工看图。
- 新增角色最低包：ESLint、TypeScript、`npm run i18n:check`、角色 intake / registry / critical image 测试、`npm run assets:manifest`、`npm run assets:validate`、`npm run assets:upload` + URL 回查、`npm run build`、真实在线双玩家 E2E。

最终交付至少包含：

- 批次矩阵最终状态。
- 每个角色的数据录入覆盖表。
- 资源本地路径与远端回查表。
- 测试命令与结果。
- 每张关键截图的绝对路径与肉眼观察。
- 剩余风险；若无剩余风险，逐项说明为什么已清空。

需要格式参考时，优先查 `src/games/dicethrone/rule/` 下已完成角色的真相源表、录入核对和卡牌录入核对；只复用表结构，不复用角色结论。
