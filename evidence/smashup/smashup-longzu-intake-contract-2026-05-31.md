# Smash Up longzu intake contract（2026-05-31）

> 2026-06-03 纠偏：本文保留为 **2026-05-31 的历史 intake 快照**。其中“`base/longzu` 是当前批次阻塞项”的结论已失效。
>
> 当前真实口径：
>
> - longzu 三派系运行时基地合法复用 `shayu` 的 `smashup:base7`，不是 `base/longzu`。
> - `public/assets/i18n/zh-CN/smashup/base/longzu.png` 与 `base/compressed/longzu.webp` 已从正式资源树删除。
> - 本批真实资源 gate 是 `cards/longzu`：需要同时补齐根级/游戏级 manifest，并保证远端 `official/i18n/zh-CN/smashup/cards/compressed/longzu.webp` 可 `HEAD 200`。

## 范围

本轮用户已替换卡牌图集，当前素材位于：

- 卡牌图集：`public/assets/i18n/zh-CN/smashup/cards/longzu.png`
- 基地图集：`public/assets/i18n/zh-CN/smashup/base/longzu.png`

旧判断失效：此前把 `longzu` 识别为 `Cease and Desist` 四派系，是基于用户已确认给错的上一张卡图。该结论不得继续作为 intake、实现或审计依据。

## 当前图集核对

| 图集 | 当前尺寸 | 临时核对图 | 当前结论 |
| --- | --- | --- | --- |
| `cards/longzu.png` | `4096x3598` | `temp/smashup-longzu-intake/longzu-cards-overview.png` | 已替换为三派系：龙、超级英雄、极客 |
| `base/longzu.png` | `2878x4096` | `temp/smashup-longzu-intake/longzu-base-overview.png` | 仍是上一批错基地，不匹配龙、超级英雄、极客 |

临时核对图只用于 intake 读取，不是正式运行时资源。

卡图补充核对：

- 已生成 `temp/smashup-longzu-intake/longzu-cards-grid-5x8-numbered.png`
- 该预览按 `5 x 8` row-major 切片后，可以稳定读出：
  - `0-11` 龙
  - `12-24` 超级英雄
  - `25-37` 极客
  - `38-39` 为 `Dragons / Geeks` 分隔图
- 因此当前 `cards/longzu` 采用 `5 x 8` 作为**暂定图集网格**

## 当前卡牌派系判断

替换后的卡图可见三派系：

| 派系 | 英文对照 | 卡图状态 | 代码状态 |
| --- | --- | --- | --- |
| 龙 | Dragons | 可见卡牌块与 `Dragons` 分隔格 | 未接入 |
| 超级英雄 | Super Heroes | 可见完整卡牌块 | 未接入 |
| 极客 | Geeks | 可见卡牌块与 `Geeks` 分隔格 | 未接入 |

本轮未继续注册 `ids.ts`、`atlasCatalog.ts`、`data/factions/*.ts` 或 UI metadata，因为基地素材不匹配。若提前注册，会让缺基地的派系进入选择/牌堆流程，违反新增派系完整交付门禁。

为避免基地阻塞期间完全停工，本轮只做了**隐藏预接入**：

- 新增隐藏 faction ids：`dragons`、`superheroes`、`geeks`
- 新增隐藏 card atlas id：`smashup:cards12 -> smashup/cards/longzu`
- 已注册三派系卡牌静态 defs（仅名称 / 力量 / 数量 / 图集索引；玩法字段暂不宣称完成）
- 三个派系加入 `SMASHUP_IN_PROGRESS_FACTION_IDS`

这三项不会让派系进入真实选角 UI，但能为后续 cards/base/locale/ability 接入保留稳定代码入口。

## 基地阻塞

当前 `base/longzu.png` 低清总览可读到的基地仍是上一张错图对应的批次：

| 当前基地英文 | 当前基地中文图面 | 当前问题 |
| --- | --- | --- |
| Spikey Chair Room | 刺王座 | 不属于龙、超级英雄、极客 |
| No-Moon | 非月球 | 不属于龙、超级英雄、极客 |
| USS Undertaking | 联邦星舰 | 不属于龙、超级英雄、极客 |
| Unicrave | 宇宙大王 | 不属于龙、超级英雄、极客 |
| Wintersquashed | 雪覆城 | 不属于龙、超级英雄、极客 |
| Changing Room | 改造室 | 不属于龙、超级英雄、极客 |
| Neutral Space | 中立区 | 不属于龙、超级英雄、极客 |
| Hive of Scum and Villainy | 渣渣和坏蛋的老巢 | 不属于龙、超级英雄、极客 |

需要替换或补齐的三派系基地图如下；英文名来自本地 TTS/atlas-config 对照，仅用于指出缺口，最终中文图面仍应以用户提供图片为准：

| 派系 | 缺少基地 |
| --- | --- |
| 龙 | Wyrm's Desolation、Dragon's Lair |
| 超级英雄 | Crystal Fortress、Converted Cave |
| 极客 | The Con、TableTop |

## 资源链状态

已按当前卡图重建：

- `public/assets/i18n/zh-CN/smashup/cards/compressed/longzu.webp`

已更新并校验：

- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup`：通过

注意：manifest 只登记当前已确认正确的 `cards/longzu` 与 `cards/compressed/longzu`。`base/longzu.png` 和 `base/compressed/longzu.webp` 当前语义错误，未作为本批次有效资源登记，不能作为龙、超级英雄、极客的基地证据。

远端 R2/CDN 上传与 HEAD 回查尚未执行。由于基地素材不匹配，资源链不得标为完成。

## 批次矩阵

| 对象 | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 龙 | in_progress | blocked: 缺匹配基地图 | pending | pending | pending | blocked |
| 超级英雄 | in_progress | blocked: 缺匹配基地图 | pending | pending | pending | blocked |
| 极客 | in_progress | blocked: 缺匹配基地图 | pending | pending | pending | blocked |

## 下一步门禁

在继续静态接入或玩法实现前，需要把 `public/assets/i18n/zh-CN/smashup/base/longzu.png` 替换为匹配龙、超级英雄、极客的基地图。替换后必须重新压缩基地 WebP、更新 manifest、重新核对基地标题/数值/效果，再进入 `ids.ts`、`atlasCatalog.ts`、faction/card/base/locale/UI metadata 与玩法实现。
