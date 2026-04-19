# Smash Up 派系图片 intake 工作流

## 适用范围

适用于 Smash Up 新增一批派系图片后的 **intake** 流程，覆盖：

- 卡牌图集压缩
- 基地图集压缩
- atlas 注册
- faction/card/base 静态数据录入
- locale 文本录入
- UI faction metadata 接入
- R2 上传
- intake 阶段的 Vitest / E2E / evidence

本工作流面向“给定图片即可复刻录入”的场景，**不包含派系完整 gameplay ability handler 的实现**。

如果用户明确要求：

- “把这个派系做进游戏”
- “继续实现玩法”
- “从图片一路做到正式可玩”

则本工作流只负责前半段 intake；完成后必须继续进入：

- `docs/games/smashup/workflows/smashup-faction-implementation.md`

## 输入物

至少需要以下素材：

- 一张或多张派系卡牌 atlas 原图
- 一张或多张基地 atlas 原图
- 该批派系的英文 canonical 名称来源
- 该批派系的卡牌/基地效果文本来源

本次 Oops, You Did It Again 批次的权威分工如下（保留为案例）：

- 图片：切片顺序、中文图面、中文图内标题
- Smash Up Wiki：英文名称、英文效果文本
- TTS / atlas-config 源：canonical 英文基地名、deck/base 对应关系

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
- 远端 R2 / CDN 已上传并验证可访问

不能只用“git 里有没有图片文件”作为完成判据。

## 执行步骤

### 1. 锁定来源契约

先写一份 evidence/contract 文档，明确：

- 图片负责什么
- Wiki 负责什么
- TTS 负责什么
- 是否存在命名冲突
- 本轮 scope 是否只做 intake，还是要继续进入 implementation

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
- 必须额外做上传验证，否则本地可用但默认资源基址仍可能 404

### 4. 确认切片网格与索引

直接看图，不允许猜。

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

中文可基于图片和英文文本翻译，但必须保留英文权威来源可回查。

### 8. 接入 UI faction metadata

更新：

- `src/games/smashup/ui/factionMeta.ts`

至少补齐：

- 图标
- 主题色
- 名称 key
- 显示顺序

### 9. 上传 R2

如果默认资源基址仍是：

```text
https://assets.easyboardgame.top/official
```

则新 atlas 必须上传，否则默认运行态会 404。

本步骤的“是否必须上传、失败后如何汇报”按通用规则执行：

- `docs/ai-rules/data-entry.md` § 资源上传收口
- `docs/ai-rules/asset-pipeline.md` § R2 / CDN 上传收口规则（强制）

检查差异：

```bash
npm run assets:check
```

如果只想上传本次新增 atlas，建议用最小上传脚本或定向上传，避免把无关文件一起推送。

本次实际上传对象：

- `official/i18n/zh-CN/smashup/cards/compressed/aiji.webp`
- `official/i18n/zh-CN/smashup/base/compressed/aiji_base.webp`

上传后必须验证远端 `HEAD 200`。

### 10. 运行 intake 自动化验证

推荐命令：

```bash
npm run test -- src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts
npm run typecheck
openspec validate add-smashup-oops-faction-intake --strict --no-interactive
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops 四派系在派系选择与注入场景中都能显示资源"
```

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
- [ ] R2 已上传并验证
- [ ] Vitest 通过
- [ ] typecheck 通过
- [ ] OpenSpec 校验通过
- [ ] E2E 通过
- [ ] evidence 已留档
