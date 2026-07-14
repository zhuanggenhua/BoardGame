# Change: 实装漫威扩展首批四派系

## Why

用户提供了一张大杀四方漫威扩展中文卡图 atlas，希望把图中的派系接入现有 Smash Up 游戏并完成正式玩法实现。

本图不是单派系卡组，而是 `9 x 6` 共 54 个唯一卡面的合并图集。TTS 模组元数据证明它同时承载四个完整的 20 张实体牌组：

- 复仇者（Avengers）
- 神盾局（S.H.I.E.L.D.）
- 蜘蛛宇宙（Spider-Verse）
- 终极战队（Ultimates）

这四个派系在当前仓库中均不存在，不能通过 POD 变体或旧派系别名复用完成。它们需要独立的 faction/card ID、静态数据、规则能力、交互、双语文案、资源链、测试与 evidence。

## What Changes

- 新增独立派系 `AVENGERS`、`SHIELD`、`SPIDER_VERSE`、`ULTIMATES`。
- 接入用户提供的 `9 x 6` 漫威卡牌 atlas，按 TTS `CardID 19600-19653` 锁定 row-major 索引 `0-53`。
- 按 TTS `DeckIDs` 锁定每个派系 20 张实体牌的重复数量，不把重复牌错误录成多个运行时定义。
- 为 54 个唯一卡面建立逐卡来源合同，包含：
  - 中文名与 canonical 英文名
  - 类型、力量、数量与 atlas 索引
  - 中文牌面原文
  - 规则原子子句
  - 时机、目标、可选/强制、持续/天赋/特殊入口
  - 实现与 L0-L4 证据状态
- 每个派系独立建立数据文件与 ability 模块，按“配置复用、共享机制扩展、新交互与 E2E”三批推进。
- 只复用现有通用机制，例如移动、抽牌、弃牌、摧毁、额外打出、持续修正、计分前后窗口；不得用名称相似替代逐句语义核对。
- 补齐 faction metadata、双语 locale、关键图片预加载、manifest 和压缩资源；本轮不执行 R2 上传，交付方式改为通过 PR 提交给作者，作者合并/发布后再做远端回查。
- 为四派系分别补行为测试、真实入口 E2E、截图与对象级审计 evidence。
- 本图不包含漫威基地卡。四派系先使用现有公共基地池完成可玩接入；漫威专属基地与另外四个漫威派系不在本 change 中猜测或补造。

## Source Contract

- 中文卡图主真相源：
  - 路径：`C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc162184881699211286628ECDB40DD1FA4B98292A3E8BD1AFD67F56DA52B.png`
  - 尺寸：`4399 x 4096`
  - 文件大小：`36,067,834 bytes`
  - SHA-256：`1D0E1BDFC79005AE2FDAC697C4D5AC47F5B00BB219E707C1E44258A4986D95E1`
- TTS 结构与英文名称对照源：
  - 路径：`C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json`
  - 用途：锁定 `9 x 6` 网格、`CardID`、canonical 英文名、牌型、派系归属和实体牌数量。
- 本地 intake 中间产物：
  - `temp/smashup-marvel-intake/atlas-index.json`
  - `temp/smashup-marvel-intake/cards/`
  - `temp/smashup-marvel-intake/contact-sheets/`
  - 这些文件只用于核对，不进入正式资源目录。

字段权威分工：

- `atlas index / faction / count / type / nameEn`：TTS 模组元数据。
- `nameZh / printed power / effectTextZh / timing / optionality / target`：完整单卡裁图。
- `effectTextEn`：由锁定后的中文规则合同翻译并与 canonical 英文资料对照；缺官方英文对照时必须标记来源，不得伪称逐字官方原文。

## Coordination

- 当前工作区存在另一批 Smash Up POD 未提交改动，且已修改 `cards.ts`、`ids.ts`、`atlasCatalog.ts`、`factionMeta.ts`、locale 和 manifest。
- 本 change 在提案批准前只新增独立 OpenSpec 与 evidence 文件，不修改上述共享运行时文件。
- 提案批准后修改共享文件时，必须保留当前工作区已有新增项，采用增量注册，不覆盖或回滚并行内容。

## Impact

- Affected specs:
  - 新增 `smashup-marvel-factions`
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets after approval:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/abilities/`
  - `src/games/smashup/abilities/index.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/smashup/cards/marvel_wave_one.png`
  - `public/assets/smashup/cards/compressed/marvel_wave_one.webp`
  - `public/assets/smashup/assets-manifest.json`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
