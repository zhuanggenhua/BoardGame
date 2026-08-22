---
name: smashup-faction-intake
description: "Smash Up 派系图片、Wiki、卡牌、基地、资源和静态数据 intake workflow。"
---

# Smash Up 派系图片 Intake 工作流

## 适用范围

用于 Smash Up 新派系或新批次资源的 intake：卡牌 / 基地 atlas 压缩、atlas 注册、faction / card / base 静态数据、locale、UI faction metadata、资源上传、intake 阶段验证和 handoff。完整 gameplay ability handler 不在本流程内；用户要求“从图片做到正式可玩”时，intake 完成后继续进入 [`smashup-faction-implementation`](../smashup-faction-implementation/SKILL.md)。

## 输入与真相源

最低输入：

- 派系卡牌 atlas 原图。
- 基地 atlas 原图。
- 派系英文 canonical 名称来源。
- 卡牌 / 基地名称、数量、力量、胜利点和效果文本主真相源。

字段级分工必须写入 contract，不能只写“图片负责中文、Wiki 负责英文”：

| 字段 | 默认主源 |
| --- | --- |
| `nameZh / effectTextZh` | 单卡 / 单基地主裁图 |
| `nameEn / effectTextEn` | 图片可读时先绑定裁图；需要 canonical 英文时写清覆盖原因 |
| `count / power / breakpoint / vp` | 裁图可读时以裁图为主；Wiki / TTS 只作对照 |
| `atlas slot / row-major index` | 当前 atlas 图片和切片核对 |
| `defId / canonical name` | contract 裁定后的 canonical 名称 |

只要卡牌或基地主裁图能清晰读出名称、数值或正文，图片就是该字段的主真相源。Wiki、抓取结果、既有 i18n 和既有实现只能作对照源；若需要偏离图面，必须先写 contract 裁定或用户故事。

## Wiki 对照

Wiki 只在图片 / 本地正式来源不足以独立完成英文 canonical 名称、count / power 等对照时使用。优先使用项目现有脚本：

```bash
node scripts/scrape-wiki-with-descriptions.mjs
node scripts/final-wiki-code-comparison.mjs
```

脚本结果只能回写 intake contract 或实现差异表；不得把 Wiki 重复项、勘误项、编码差异或弯引号 / 直引号差异直接算成新增卡牌。

## Intake 输出

intake 目标是交付可安全进入 implementation 的 handoff 包，至少包含：

- 真相源表。
- 切图表：图像尺寸、行列、row-major 顺序、尾格 / 非卡牌格。
- 核对合同表：字段级主源、冲突和裁定。
- faction / card / base 静态数据接入状态。
- locale 对照表。
- 资源本地路径、manifest、上传和远端回查结果。
- implementation 交接清单：可复用机制、需新实现对象、高风险点。

## 资源完成判据

资源完成不能只看 `git status`，因为 `public/assets/**` 常被忽略。必须同时满足：

- 本地 `public/assets/i18n/zh-CN/smashup/**/compressed/*.webp` 存在。
- 运行时代码已引用新 atlas。
- 游戏级和根级 manifest 都出现对应键。
- 运行时会请求的公开资源 URL 返回 `HEAD 200`，且来自服务器主源。

如果某批基地实际复用既有 atlas，候选基地图不得留在正式运行时目录；应移到临时目录或删除，避免 `assets:upload` 误传。

## 执行流程

### 1. 锁定 contract

先建立 evidence / contract 文档，写清：

- 图片、Wiki、TTS / atlas-config 或其它对照源分别负责哪些字段。
- 本轮 scope 是只做 intake，还是继续 implementation。
- 命名冲突、图面英文与 canonical 英文差异、重复项和未决项。
- `defId`、`nameEn`、evidence 中如何记录图面差异。

范围或主源未锁定时，不得进入静态数据录入。

### 2. 落原图与压缩

原图落到：

- `public/assets/i18n/zh-CN/smashup/cards/`
- `public/assets/i18n/zh-CN/smashup/base/`

压缩：

```bash
npm run compress:images -- public/assets/i18n/zh-CN/smashup
```

期望产物：

- `public/assets/i18n/zh-CN/smashup/cards/compressed/<atlas>.webp`
- `public/assets/i18n/zh-CN/smashup/base/compressed/<atlas>.webp`

压缩产物默认不一定进入 git diff，后续必须做服务器资源主源发布与公开 URL 回查。

### 3. 切片核对

直接看图，不猜行列和索引。大 atlas 不直接整张反复读取：

- 单边超过 `2500px`、总像素超过 `8MP` 或文件超过 `8MB` 时，先生成低清总览和分块图。
- 总览只用于判断行列、尾格和批次边界；卡名、数值、效果文本必须裁到分块或单格核对。
- 分块 / 单格产物放 `temp/<task>-intake/`，并在 evidence 记录实际查看过的文件。

至少确认图片尺寸、行列数、row-major 顺序、尾格 / logo 格 / 非卡牌格。切片顺序以图片核对结论为唯一来源。

### 4. 注册 atlas

更新：

- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/atlasCatalog.ts`

要求：

- atlas id 唯一。
- `atlasCatalog` 只记录 `id / image / rows / cols`。
- 不用旧批次顺序或文件名猜索引。

### 5. 录入静态数据

新增或更新：

- `src/games/smashup/data/factions/`
- `src/games/smashup/data/cards.ts`

若本轮只做 intake，不实现完整玩法，则 card def 只录最小正确结构：`faction`、`power`、`count`、`previewRef`、`type`。不得伪造未实现的 `abilityTags` 或 handler 绑定。

`talent` / `special` 只在牌面明确写可主动发动时录入；`onPlay + special` 属高风险组合，必须逐张回看牌面。若只是“打出时效果 + 后续触发器 / 翻开后触发”，不得伪造成可手动 `special`。

### 6. 录入 locale

同步：

- `public/locales/zh-CN/game-smashup.json`
- `public/locales/en/game-smashup.json`

每张 card / base 的 `name`、`effect`、`abilityText` 都必须回溯到单卡 / 单基地主裁图或 contract 中声明的主源。`zh-CN` 和 `en` locale 不能分裂成“中文看图片、英文抄 Wiki”；图片清晰覆盖正文时，两边都先回主裁图核对。

高风险限定词必须逐词回看主裁图，不得只看摘要或既有实现：`你的 / 其他 / 任意 / 至多 / 可以 / 改为 / 每个`，以及 `your / other / any / up to / may / instead / each / one of`。

`npm run i18n:check` 只证明 key 完整，不证明文本语义正确。

### 7. 接入 UI faction metadata

更新 `src/games/smashup/ui/factionMeta.ts`，至少补齐图标、主题色、名称 key 和显示顺序。

### 8. 发布与回查

按资源规范执行：

- [`data-entry`](../../knowledge/standards/data-entry.md) 的资源上传收口。
- `docs/deploy.md` 的服务器主源说明。

先检查差异：

```bash
npm run assets:check
```

再按本轮新增 atlas 最小发布。发布后必须用运行时会请求的完整公开 URL 验证 `HEAD 200`；本地 PNG/WebP、manifest 或截图显示都不能替代远端资源闭环。

### 9. Intake 验证

按改动范围选择：

```bash
npm run test -- src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts
npm run typecheck
```

若 OpenSpec 有当前变更包，运行对应 `openspec validate ... --strict --no-interactive`。若本轮要证明资源在真实页面显示，再补最窄 E2E 和截图。

结构测试、i18n、typecheck 只能证明 key、类型和运行时引用完整；不能替代逐张卡 / 基地主裁图核对。

## 自审与 Evidence

至少检查：

- 派系选择界面能看到新增派系。
- 注入或真实入口牌桌能看到新增基地图与手牌图。
- atlas shimmer / fallback 状态已清零。
- `CardPreview` / atlas 渲染实际使用成功加载的单个 URL，不依赖多层 `background-image` fallback 冒充加载成功。

结果写入 `evidence/<task>-contract.md` 和 `evidence/<task>-e2e-test.md`，或当前任务指定的 evidence。

## Implementation Handoff 条件

全部满足后才允许进入 implementation：

- [ ] 主真相源 / 对照源已锁定。
- [ ] atlas 几何与 row-major 索引已锁定。
- [ ] faction / card / base canonical 名称已锁定。
- [ ] locale 字段可回溯到主裁图或已声明主源。
- [ ] 冲突项已裁定，或已登记为 blocker。
- [ ] 资源链路、上传要求和远端回查已明确。
- [ ] intake evidence 已留档。
- [ ] implementation 交接清单已形成：faction 清单、card / base 名单、关键词摘要、可复用实现、待新实现对象和共享层风险。

任一缺失时，implementation 不得说“已可以安全开工”。
