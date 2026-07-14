# Change: 实装大杀四方《环游世界：文化冲击》四派系

## Why

用户提供了一张大杀四方中文卡牌图集，并要求把图中的派系正式实装进游戏。经图片分块和 TTS 模组元数据核对，这张图不是三个派系，而是以下四个完整派系：

- 阿南西传说（`anansi_tales`）
- 格林童话（`grimms_fairy_tales`）
- 俄罗斯童话（`russian_fairy_tales`）
- 古代印加人（`ancient_incas`）

当前仓库没有这四个派系的正式注册、静态牌表、基地、双语文案和玩法实现。此次变更必须从图片 intake 一路完成正式玩法、资源发布、对象级审计和真实入口 E2E，不能把“派系选择可见”或“卡图能显示”误报成派系完成。

## Approval

- [x] 用户于 2026-07-10 在当前任务中明确回复“批准提案，继续实装”。

## What Changes

- 新增阿南西传说完整牌组：13 个唯一卡面、20 张实体牌、2 张基地。
- 新增格林童话完整牌组：18 个唯一卡面、20 张实体牌、2 张基地。
- 新增俄罗斯童话完整牌组：16 个唯一卡面、20 张实体牌、2 张基地。
- 新增古代印加人完整牌组：12 个唯一卡面、20 张实体牌、2 张基地。
- 接入用户提供的共享卡牌 atlas：
  - 尺寸 `4096 x 3454`
  - 网格 `10 x 6`
  - 槽位 `0-58` 为 59 个唯一卡面
  - 槽位 `59` 为 Smash Up 标识，不得注册成卡牌
- 接入 TTS 模组中的《文化冲击》基地 atlas：
  - 网格 `4 x 3`
  - 本 change 使用 8 张基地
  - 与已存在的 `add-smashup-polynesian-voyagers-penguins` change 共享同一基地 atlas，最终只能注册一个共享 atlas 合同
- 为 59 个唯一卡面和 8 张基地建立逐对象来源合同、规则子句表、effect atom 矩阵和 L0-L4 证据状态。
- 补齐 faction ID、card/base ID、atlas metadata、静态数据、双语 locale、派系选择 metadata、关键图片预加载、manifest 与 R2/CDN 发布。
- 逐派系完成全部能力、持续效果、触发器、交互、基地能力、可选/强制分支和清理时机。
- 逐派系补定向领域测试、真实入口 E2E、截图证据和对象级审计文档。

## Source Contract

- 中文卡牌图面与卡牌效果主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1177076490642124867E9F9B732BA5D238B9B282C3E9F60BA0B8F67CCBE.png`
  - SHA-256：`5CA8838ED9C57F1A53C2C864837E56D2279ECE101E1FE39E74BE74828B61F08E`
- 牌组归属、canonical 英文名、实体重复数量、CardID、atlas 槽位、基地归属和基地断点主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json`
  - SHA-256：`9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D`
- 英文规则正文与勘误：
  - intake 阶段逐卡对照官方卡牌资料或 Smash Up Wiki。
  - 若英文资料与中文图面存在冲突，必须在 evidence 中逐项记录并先裁定，不能静默覆盖。
- 本地轻量核对产物：
  - `temp/smashup-culture-shock-intake/overview.jpg`
  - `temp/smashup-culture-shock-intake/rows/`
  - `temp/smashup-culture-shock-intake/cards/`
  - `temp/smashup-culture-shock-intake/all-decks-summary.json`

## Coordination

- 当前工作区已有多批 Smash Up 未提交改动，并已修改 `cards.ts`、`ids.ts`、`atlasCatalog.ts`、`factionMeta.ts`、locale 和 manifest。
- 提案批准前，本 change 只新增独立 OpenSpec 与 evidence 文件，不修改上述共享运行时文件。
- 提案批准后，所有共享文件必须采用最小上下文增量补丁；不得回滚、覆盖、重排或格式化其他批次内容。
- 《文化冲击》基地 atlas 已被 `add-smashup-polynesian-voyagers-penguins` 提案引用。本 change 必须优先复用同一 atlas ID、资源路径和运行时合同，不能重复注册或反向覆盖该批次。
- 四派系玩法按“阿南西传说 → 格林童话 → 俄罗斯童话 → 古代印加人”逐个闭环，不同时写四个半成品派系。

## Impact

- Affected specs:
  - 新增 `smashup-culture-shock-factions`
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets after approval:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/data/bases.ts`
  - `src/games/smashup/abilities/`
  - `src/games/smashup/abilities/index.ts`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/`
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
