---
name: smashup-faction-intake
description: "Smash Up 派系图片、Wiki、卡牌、基地、资源和静态数据 intake workflow。"
---

# Smash Up 派系图片 intake 工作流

## 适用范围

适用于 Smash Up 新增一批派系图片后的 **intake** 流程，覆盖：

- 卡牌图集压缩
- 基地图集压缩
- atlas 注册
- faction/card/base 静态数据录入
- locale 文本录入
- UI faction metadata 接入
- 发布到服务器资源主源
- intake 阶段的 Vitest / E2E / evidence

本工作流面向“给定图片即可复刻录入”的场景，**不包含派系完整 gameplay ability handler 的实现**。

如果用户明确要求：

- “把这个派系做进游戏”
- “继续实现玩法”
- “从图片一路做到正式可玩”

则本工作流只负责前半段 intake；完成后必须继续进入：

- `.spec/skills/smashup-faction-implementation/SKILL.md`

## 输入物

至少需要以下素材：

- 一张或多张派系卡牌 atlas 原图
- 一张或多张基地 atlas 原图
- 该批派系的英文 canonical 名称来源
- 该批派系的卡牌/基地名称与效果文本主真相源

本次 Oops, You Did It Again 批次的权威分工如下（保留为案例）：

- 图片：切片顺序、中文图面、卡牌/基地名称、卡牌/基地正文
- Smash Up Wiki：英文 canonical 名称对照、图片看不清字段的辅助对照、count/power 对照
- TTS / atlas-config 源：canonical 英文基地名、deck/base 对应关系

强制说明：

- 只要卡牌/基地主裁图能清晰读出名称或正文，图片就是该字段的主真相源，`zh-CN` 与 `en` locale 都必须先回看图片核对。
- Wiki、脚本抓取结果、既有 `i18n`、既有实现只能作为对照源，不能覆盖图片正文。

### Wiki 对照工具（仅 intake 阶段）

- 触发场景：数据录入、数据核对、审计检查或效果描述查询，且图片 / 本地正式来源不足以独立完成英文 canonical 名称、count / power 等对照时。
- 抓取脚本：`scripts/scrape-wiki-with-descriptions.mjs`；代码对照脚本：`scripts/final-wiki-code-comparison.mjs`。
- 默认执行顺序：先运行 `node scripts/scrape-wiki-with-descriptions.mjs`，再运行 `node scripts/final-wiki-code-comparison.mjs`，最后根据差异报告回写 intake 合同或实现。
- 默认入口优先使用项目现有脚本与当前会话浏览能力；必要时再用 `agent-reach` 打开单页补证，不把 Firecrawl 当作常规入口。只有批量分页、动态站点交互、登录态或需要沉淀长期采集流水线时，才单独评估 Firecrawl。
- Wiki 文本与代码对照时要考虑弯引号 / 直引号和编码差异；Wiki 的勘误重复项要按当前官方 / 项目裁决保留唯一版本，不能把重复条目直接算成新增卡牌。

## intake 输出口径

intake 的目标不是“尽快改代码”，而是交付一份能安全进入 implementation 的 handoff 包。

至少应包含：

- 真相源表
- 切图表
- 核对合同表
- 对照表
- 冲突待裁定表
- implementation 交接清单

## 资源交付口径

这套仓库的资源交付不能只看 `git status`。

原因：

- `.gitignore` 默认忽略 `public/assets/**`
- `public/assets/i18n/zh-CN/*` 被当作本地资源工作区，不进入常规源码 diff
- 因此新 atlas 即使本地已生成，也不会自动出现在 git 变更列表里

所以本流程的“图片已完成”必须同时满足：

- 本地 `public/assets/i18n/.../compressed/*.webp` 文件存在
- 运行时引用已经接入代码
- `https://assets.easyboardgame.top/official/...` 公开资源域名已返回服务器主源内容，并验证可访问

不能只用“git 里有没有图片文件”作为完成判据。

## 执行步骤

### 1. 锁定来源契约

先写一份 evidence/contract 文档，明确：

- 图片负责什么
- Wiki 负责什么
- TTS 负责什么
- 是否存在命名冲突
- 本轮 scope 是否只做 intake，还是要继续进入 implementation

这里的“负责什么”必须细到字段级，不允许只写“图片负责中文、Wiki 负责英文”这类会把正文主真相源写偏的笼统分工。至少要单列：

- `nameZh`
- `nameEn`
- `effectTextZh`
- `effectTextEn`
- `count / power / breakpoint / vp`
- `atlas slot / row-major index`

其中：

- 只要图片可读，`nameZh / nameEn / effectTextZh / effectTextEn` 都必须先绑定到单卡/单基地主裁图。
- 如果 `nameEn` 或 `effectTextEn` 采用 canonical 英文或官方英文正文而不是图面原文，必须在 contract 里写明覆盖原因和适用范围。

如果存在图面英文和 canonical 英文不一致，必须先裁定：

- `defId`
- `nameEn`
- evidence 中如何记录图面差异

### 2. 落原图

把原图放到：

- `public/assets/i18n/zh-CN/smashup/cards/`
- `public/assets/i18n/zh-CN/smashup/base/`

文件命名建议直接体现批次，例如：

- `aiji.png`
- `aiji_base.png`

### 3. 压缩

有原始 PNG 时执行：

```bash
npm run compress:images -- public/assets/i18n/zh-CN/smashup
```

期望得到：

- `public/assets/i18n/zh-CN/smashup/cards/compressed/<atlas>.webp`
- `public/assets/i18n/zh-CN/smashup/base/compressed/<atlas>.webp`

注意：

- 这些文件默认不会进入 git 变更列表
- 必须额外做服务器资源主源发布与公开 URL 回查，否则本地可用但默认资源基址仍可能 404

### 4. 确认切片网格与索引

直接看图，不允许猜。

但大图不能直接整张读：

- 先用脚本读取原图像素尺寸和文件大小。
- 若单边超过 `2500px`、总像素超过 `8MP`、或文件超过 `8MB`，必须先生成低清总览和分块图，再读取图片。
- 总览图只用于判断整体行列、尾格和批次边界；卡名、数值、效果文本必须裁到对应分块或单格后核对。
- 禁止把整张大 atlas 直接交给视觉工具反复查看；这容易触发视觉链路超时、返回体过大或 502，并且会把行列判断带偏。
- 分块/单格产物放在 `temp/<task>-intake/`，并在 evidence 里记录实际查看过的文件名。

至少确认：

- 图片像素尺寸
- 行列数
- row-major 顺序
- 是否有尾格 / logo 格 / 非卡牌格

本次 Oops 批次结论（案例，不是全局默认）：

- `aiji.png`：`7 x 7`，前 48 格为卡牌，第 49 格为 `Smash Up` 尾格
- `aiji_base.png`：`2 x 4`，共 8 张基地

### 5. 注册 atlas 元数据

更新：

- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/atlasCatalog.ts`

要求：

- 新 atlas id 要唯一
- `atlasCatalog` 里只记录 `id / image / rows / cols`
- 切片顺序以图片核对结论为唯一来源

### 6. 录入 faction / card / base 静态数据

新增 faction 文件到：

- `src/games/smashup/data/factions/`

并在：

- `src/games/smashup/data/cards.ts`

完成注册。

如果本轮只有 intake，不做完整玩法实现，则 card def 只录最小正确结构：

- `faction`
- `power`
- `count`
- `previewRef`
- `type`

不要伪造未实现的 `abilityTags` 或 handler 绑定。
`talent` / `special` 只在牌面明确写了可主动发动时才允许录入；截图/牌面没有写天赋、特技或等价主动发动语义，默认不得录成可点击能力。
`onPlay + special` 属于高风险少数组合，录入时必须逐张回看牌面；如果只是“打出时效果 + 后续触发器/翻开后触发”，不得伪造为可手动 `special`。

如果用户本轮后续还要继续实现玩法，则这里还应额外整理：

- 每个派系的关键机制关键词
- 每个派系明显可复用的已有共享机制
- 仍待 implementation 阶段裁定的高风险点

### 7. 录入 locale

同时更新：

- `public/locales/zh-CN/game-smashup.json`
- `public/locales/en/game-smashup.json`

要求：

- faction 名称
- card 名称与文本
- base 名称与文本

强制门禁：

- 每张 card/base 的 `name`、`effect`、`abilityText` 都必须能追溯到单卡/单基地主裁图，或追溯到 contract 中已明确声明的主真相源。
- `zh-CN` 和 `en` locale 不能按“中文看图片、英文抄 Wiki”分裂录入；只要图片清晰覆盖正文，两边都必须先回单卡主裁图逐词核对。
- 出现以下高风险限定词时，必须逐词回看主裁图，不得只看摘要、既有实现或 Wiki 对照：
  - `你的 / 其他 / 任意 / 至多 / 可以 / 改为 / 每个`
  - `your / other / any / up to / may / instead / each / one of`
- 若图面可读但图面与 Wiki/既有实现冲突，默认以图面为准；若本轮需要偏离图面，必须先落用户故事或 contract 裁定，再改 locale。
- `npm run i18n:check` 只能证明 key 完整、缺失项可见，不能证明文本语义正确。

中文可基于图片和英文文本翻译，但必须保留英文权威来源可回查；若英文正文可直接从图片读取，则图片本身就是英文正文的首要回查源。

### 8. 接入 UI faction metadata

更新：

- `src/games/smashup/ui/factionMeta.ts`

至少补齐：

- 图标
- 主题色
- 名称 key
- 显示顺序

### 9. 发布到服务器资源主源

如果默认资源基址仍是：

```text
https://assets.easyboardgame.top/official
```

则新 atlas 必须发布到服务器资源主源，否则默认运行态会 404。

本步骤的“是否必须发布、失败后如何汇报”按通用规则执行：

- `.spec/knowledge/standards/data-entry.md` § 资源上传收口
- `docs/deploy.md` § 生产素材域名：服务器主源

检查差异：

```bash
npm run assets:check
```

如果只想发布本次新增 atlas，建议用最小发布脚本或定向发布，避免把无关文件一起推送。

额外门禁：

- 新增 `cards/<atlas>` 或 `base/<atlas>` 后，除了游戏级 `public/assets/i18n/zh-CN/smashup/assets-manifest.json`，还必须确认根级 `public/assets/i18n/assets-manifest.json` 也已经出现对应键；不能只看 incremental validate 通过。
- 如果经旧派系对照确认某批基地实际复用既有 atlas，就不要再把“候选 longzu 基地图”留在 `public/assets/i18n/zh-CN/smashup/base/` 等正式运行时目录。错图/候选图必须移出或删除，再执行发布。
- 真实发布阻塞以运行时会请求的 URL 为准。像手牌卡图这类运行时 atlas，最终必须给出远端 `HEAD 200` 的完整路径，不能只证明本地 PNG/WebP 存在。

本次实际发布对象：

- `official/i18n/zh-CN/smashup/cards/compressed/aiji.webp`
- `official/i18n/zh-CN/smashup/base/compressed/aiji_base.webp`

发布后必须用公开资源域名验证远端 `HEAD 200`，并确认响应来自服务器主源。

### 10. 运行 intake 自动化验证

推荐命令：

```bash
npm run test -- src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts
npm run typecheck
openspec validate add-smashup-oops-faction-intake --strict --no-interactive
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops 四派系在派系选择与注入场景中都能显示资源"
```

补充说明：

- `cardI18nIntegrity`、`i18n:check`、typecheck 只能证明结构完整、key 对齐、运行时不会因缺 key 报错。
- 它们不能替代“逐张卡/逐基地回看主裁图核对文案语义”的人工门禁；限定词录错、作用对象录错、数量上限录错，仍必须靠 contract + 主裁图核对拦住。

### 11. 自审截图与 evidence

至少检查：

- 派系选择界面能看到新增派系卡图
- 状态注入后的棋盘能看到新增基地图与手牌图
- `.atlas-shimmer` 已清零

把结果写入：

- `evidence/<task>-contract.md`
- `evidence/<task>-e2e-test.md`

## implementation handoff 条件

只有在以下条件全部满足时，才允许从 intake 进入 implementation：

- [ ] 主真相源 / 对照源已经锁定
- [ ] atlas 几何与 row-major 索引已经锁定
- [ ] faction / card / base 的 canonical 名称已锁定
- [ ] locale 的 `name/effect/abilityText` 已能逐项回溯到主裁图或已声明真相源
- [ ] 冲突项已裁定，或已被明确登记为 blocker
- [ ] 资源链路（压缩 / 运行时接线 / 上传要求）已明确
- [ ] intake evidence 已留档
- [ ] 已形成 implementation 交接清单

若上述任一项缺失，则 implementation 不得把当前状态说成“已可以安全开工”。

## implementation 交接清单模板

进入 implementation 前，建议至少写清：

- 本批次 faction 清单
- 每个派系的 card / base 名单
- 每个派系的关键词摘要
- 哪些卡可能直接复用现有实现
- 哪些卡“名字像但还没核对语义”
- 哪些卡 / 基地必须全新实现
- 哪些共享层可能需要补洞

## Oops 批次特殊经验

### 图面英文与 canonical 英文不一致

武士基地图面是：

- `Kyuden Konbini`
- `Sakura Shigemi`

但 canonical 英文应使用：

- `Shogun's Palace`
- `Sakura Garden`

结论：

- `defId / nameEn` 用 canonical 名称
- 图面差异写入 evidence，避免后续二次 intake 时被误认为录错

### Atlas fallback 不能依赖多层 background-image

本轮实际踩到的渲染问题：

- 资源能下载
- atlas 切片坐标正确
- 但 `CardPreview` 以前用多层 `background-image` 充当 locale fallback
- 在 Playwright 截图和证据场景里会出现“白板卡图”

已修复方式：

- `AtlasCard` 改为选择“实际加载成功的单个 URL”作为 `backgroundImage`
- 不再把 primary/fallback 作为多层背景同时绘制

这条经验应作为后续 atlas intake 的默认规则。

## 交付完成清单

- [ ] 压缩产物存在
- [ ] atlas id / grid 已注册
- [ ] faction/card/base 静态数据已接入
- [ ] locale 已补齐
- [ ] faction metadata 已接入
- [ ] 服务器资源主源已发布并验证
- [ ] Vitest 通过
- [ ] typecheck 通过
- [ ] OpenSpec 校验通过
- [ ] E2E 通过
- [ ] evidence 已留档
