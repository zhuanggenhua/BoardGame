# Smash Up Oops 四派系 Intake 契约与审计

## 任务范围

本轮只做 `Oops, You Did It Again` 四个基础派系的 intake / 静态接入：

- Ancient Egyptians
- Cowboys
- Samurai
- Vikings

包含：

- 图片压缩
- atlas 注册
- faction/card/base 静态数据
- locale
- UI metadata
- R2 上传
- Vitest / E2E / evidence

不包含：

- 四个派系完整 gameplay ability handler / ongoing / trigger registry

## 权威来源分工

### 图片

负责：

- atlas 网格
- row-major 顺序
- 中文图面标题
- 中文图内效果文案

不负责：

- canonical 英文基地名裁定
- gameplay 实现是否完备

### Smash Up Wiki

负责：

- 英文 card / base 名称
- 英文效果描述

说明：

- 本地 `scripts/scrape-wiki-with-descriptions.mjs` 已补四派系映射
- 但 fandom 直抓当前会遇到 Cloudflare challenge
- 本轮文本录入实际采用 web 检索结果 + 本地映射脚本入口保留

### TTS / 项目 atlas-config 源

负责：

- 四派系 kit 对应关系
- canonical 英文基地名裁定
- deck/base 归属校核

## 切片契约

### 卡牌 atlas

- 文件：`public/assets/i18n/zh-CN/smashup/cards/aiji.png`
- 压缩产物：`public/assets/i18n/zh-CN/smashup/cards/compressed/aiji.webp`
- 网格：`7 x 7`
- 顺序：row-major
- 有效格：前 48 格
- 尾格：最后 1 格 `Smash Up`

索引区间：

- `0-11`：Vikings
- `12-23`：Samurai
- `24-35`：Ancient Egyptians
- `36-47`：Cowboys

### 基地 atlas

- 文件：`public/assets/i18n/zh-CN/smashup/base/aiji_base.png`
- 压缩产物：`public/assets/i18n/zh-CN/smashup/base/compressed/aiji_base.webp`
- 网格：`2 x 4`
- 顺序：row-major

索引对应：

- `0` `Saloon`
- `1` `So-So Corral`
- `2` `Pyramids`
- `3` `Star Portal`
- `4` `Kyuden Konbini`
- `5` `Sakura Shigemi`
- `6` `Drakkar`
- `7` `Longhouse`

## 命名裁定

### 武士基地命名冲突

图片图面：

- `Kyuden Konbini`
- `Sakura Shigemi`

canonical 英文：

- `Shogun's Palace`
- `Sakura Garden`

本轮裁定：

- `defId` 使用 `base_shoguns_palace` / `base_sakura_garden`
- `nameEn` 使用 canonical 英文
- 图面差异仅作为 evidence 保留，不反推改动 defId

## 代码接入落点

- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/data/factions/ancient_egyptians.ts`
- `src/games/smashup/data/factions/cowboys.ts`
- `src/games/smashup/data/factions/samurai.ts`
- `src/games/smashup/data/factions/vikings.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/ui/factionMeta.ts`
- `public/locales/zh-CN/game-smashup.json`
- `public/locales/en/game-smashup.json`
- `scripts/scrape-wiki-with-descriptions.mjs`

## 资源文件交付说明

本轮压缩产物本地存在，但不会体现在常规 git diff 中。

原因：

- `.gitignore` 忽略了 `public/assets/**`
- `public/assets/i18n/zh-CN/*` 作为本地资源工作区使用

所以本轮图片交付的真实判据是：

- 本地文件存在
- 代码已引用新 atlas
- R2 已上传
- 默认资源地址可访问

## 审计结论

### D1 描述与实现对齐

通过。

本轮 scope 明确收束为 intake，代码未把“未实现玩法”伪装成“已实现能力”。

### D3 引擎 API 契约

通过。

本轮没有新增 gameplay command / reducer / system 逻辑，只接入静态数据与预览资源。

### D7 验证层有效性

通过。

已补：

- atlas 命中测试
- faction 选秀 / 40 张牌库构建测试
- i18n 完整性测试
- E2E 资源可见性测试

### D12 写入-消耗对称

通过。

新 atlas id 与新 faction/base def 均已在运行时查询链路中被实际消费。

### D46 / D47 / D48 资源与 UI 渲染完整性

通过，但有一项关键实现修复：

- `CardPreview` 原先依赖多层 `background-image` 做 locale fallback
- 实测会在 E2E 截图中把 atlas 渲染成白板
- 本轮已改为选择单个已加载成功的 URL 作为实际背景图

## 上传验证

已上传：

- `official/i18n/zh-CN/smashup/cards/compressed/aiji.webp`
- `official/i18n/zh-CN/smashup/base/compressed/aiji_base.webp`

远端验证：

- `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/aiji.webp` → `200`
- `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/aiji_base.webp` → `200`

## 残留风险

- 英文 locale 下这批 atlas 暂无独立 `en` 图片；当前渲染层会自动选择实际加载成功的 zh-CN atlas URL，因此运行时可用，但英文专用图面仍未制作。
- Wiki 爬虫脚本入口已补，但 fandom 直抓仍受 Cloudflare challenge 影响；后续若要批量更新文本，建议补可替代抓取源或缓存层。
- 吸血鬼 POD 的埋葬体系已经有领域逻辑，但 UI 展示尚未补全；进入后续玩法实施阶段时，应把它作为同类机制 UI 的参考和补齐项。
