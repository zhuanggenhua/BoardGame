# Change: 实装漫威反派侧四派系

## Why

用户提供了另一张大杀四方漫威扩展中文卡图 atlas，并确认它也属于漫威派系批次，需要按新增派系流程接入现有 Smash Up 游戏。

这张图不是首批已接入的复仇者 / 神盾局 / 蜘蛛宇宙 / 终极战队，而是反派侧四个完整 20 张实体牌组：

- 九头蛇（Hydra）
- 克里（Kree）
- 邪恶大师（Masters of Evil）
- 邪恶六人组（Sinister Six）

## What Changes

- 新增独立派系 `HYDRA`、`KREE`、`MASTERS_OF_EVIL`、`SINISTER_SIX`。
- 接入用户提供的 `9 x 6` 漫威反派卡牌 atlas，按 row-major 索引 `0-48` 锁定 49 张唯一卡面，后 5 格登记为空白 / 尾格。
- 为四派系建立逐卡合同，记录中文名、canonical 英文名、类型、力量、数量、atlas 索引与英文机制文本。
- 本轮主图中未发现漫威基地 atlas；四派系先复用现有公共基地池，不猜造漫威专属基地。
- 先完成 L1 静态接入：atlas、faction ID、card defs、双语 locale、metadata、资源合同测试与 evidence。
- 玩法 implementation 按派系继续推进；未完成 L2/L3/L4 前，派系 metadata 保留 `implementationStatus: 'in_progress'`，不得宣称玩法已完成。
- 资源链沿用首批漫威 PR handoff 口径：本地正式 PNG / WebP / manifest 进入交付，远端 R2/CDN `HEAD 200` 在 PR 合并或发布后回查。

## Source Contract

- 中文卡图主真相源：
  - 路径：`C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc162184953865180163720AEEBDBC9CD6DB431AAD40A1B6FAFE150B0815C.png`
  - 尺寸：`4399 x 4096`
  - 文件大小：`33,423,555 bytes`
  - SHA-256：`44ae80f5629ad1d33a2c438a2955112a38c1ae5d7addaa2d8ae44418ef15a5fb`
- 本地正式运行时资源：
  - `public/assets/i18n/zh-CN/smashup/cards/marvel_villains.png`
- 本地 intake 中间产物：
  - `temp/smashup-marvel-villains-intake/source-info.json`
  - `temp/smashup-marvel-villains-intake/contact-indexed.png`
  - `temp/smashup-marvel-villains-intake/cards/`
  - `temp/smashup-marvel-villains-intake/card-contract.json`
  - `temp/smashup-marvel-villains-intake/wiki-pages.json`
- 字段权威分工：
  - `atlas index / faction / count / type / power / canonical nameEn / effectTextEn`：Smash Up Wiki 与本地图集对照合同。
  - `nameZh / 图面归属 / atlas slot`：用户提供的完整单卡裁图。
  - `effectTextZh`：本轮先按英文机制文本翻译并标注为待中文图面逐字复核；不把中文正文标为完全锁定。

## Coordination

- 当前工作区已有首批漫威、POD 与其他 Smash Up 批次的未提交改动。
- 本 change 只新增反派侧 ID、资源、数据、locale、metadata、测试和 evidence；修改共享注册文件时必须增量合并，不覆盖已有并行新增项。
- 用户当轮已明确要求“按照流程实装这个”，本 proposal 与任务清单视为本轮实施授权入口；仍需在 evidence 中分层标注实际完成等级。

## Impact

- Affected specs:
  - 新增 `smashup-marvel-villain-factions`
  - `smashup-faction-registry`
  - `asset-manifest`
- Affected code and assets:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/hydra.ts`
  - `src/games/smashup/data/factions/kree.ts`
  - `src/games/smashup/data/factions/masters_of_evil.ts`
  - `src/games/smashup/data/factions/sinister_six.ts`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/cards/marvel_villains.png`
  - `public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_villains.webp`
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
  - `src/games/smashup/__tests__/marvelVillainsResourceContract.test.ts`
  - `evidence/smashup/`
