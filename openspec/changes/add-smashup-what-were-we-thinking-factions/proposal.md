# Change: 实装大杀四方《我们到底在想什么？》四派系

## Why

用户提供了一张新的大杀四方中文卡牌图集，并要求按项目新增派系流程把图中的种族做进游戏。经图片与本地 TTS 模组元数据核对，这张图对应《我们到底在想什么？》的四个完整派系：

- 摇滚明星（`rock_stars`）
- 泰迪熊（`teddy_bears`）
- 外婆（`grannies`）
- 探险家（`explorers`）

当前仓库审计表仍将这四个派系列为未实现；代码里只已有探险家的泰坦相关入口，不等于探险家派系已完成。此次变更必须从图片 intake 一路完成正式玩法、正式资源随 PR/仓库交付、对象级审计和真实入口 E2E，不能把“派系选择可见”“泰坦已有实现”或“卡图能显示”误报成派系完成。

## Approval

- [x] 用户已在 2026-07-13 当前对话中明确批准本提案，允许开始修改运行时代码和正式资源树。

## What Changes

- 新增摇滚明星完整牌组：12 个唯一卡面、20 张实体牌、2 张基地。
- 新增泰迪熊完整牌组：12 个唯一卡面、20 张实体牌、2 张基地。
- 新增外婆完整牌组：12 个唯一卡面、20 张实体牌、2 张基地。
- 新增探险家完整牌组：12 个唯一卡面、20 张实体牌、2 张基地；同时把既有探险家泰坦入口纳入对象级审计，避免“泰坦已接入”与“派系已接入”混淆。
- 接入用户提供的共享卡牌 atlas：
  - 尺寸 `3886 x 4096`
  - TTS 图集合同 `8 x 6`
  - 槽位 `0-47` 为 48 个唯一卡面
  - 槽位 `0-11` 摇滚明星，`12-23` 泰迪熊，`24-35` 外婆，`36-47` 探险家
- 接入 TTS 模组中的《我们到底在想什么？》基地 atlas：
  - 尺寸 `4096 x 1458`
  - TTS 图集合同 `4 x 2`
  - 本 change 使用全部 8 张基地
- 为 48 个唯一卡面、8 张基地和相关探险家泰坦建立逐对象来源合同、规则子句表、effect atom 矩阵和 L0-L4 证据状态。
- 补齐 faction ID、card/base ID、atlas metadata、静态数据、双语 locale、派系选择 metadata、关键图片预加载、manifest，并按用户当前口径将 PNG/WebP 图片随 PR/仓库交付（不走 R2）。
- 逐派系完成全部能力、持续效果、触发器、交互、基地能力、可选/强制分支和清理时机。
- 逐派系补定向领域测试、真实入口 E2E、截图证据和对象级审计文档。

## Source Contract

- 中文卡牌图面与卡牌效果主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1177076490642128989313F82049BF302440B15F5FCC8A75039DFC3E002.png`
  - SHA-256：`A1530F6940431609CE42BFAD6908B3CE27F0DD783C507D880914D687FEAF76AA`
- 基地图面与基地槽位主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc11770764906421177680815B96840C0731AAEBBB3F26B196F7CAA0D2551.png`
  - SHA-256：`CFEDA490F5133A6F9A18C01831D4C809630F5171E3DC8C58E4FEC741F5F8F548`
- 牌组归属、实体重复数量、CardID、atlas 槽位、基地断点和 VP 主对照源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json`
  - SHA-256：`9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D`
- 英文规则正文与勘误：
  - intake 阶段逐卡对照官方卡牌资料或 Smash Up Wiki。
  - 若英文资料与中文图面存在冲突，必须在 evidence 中逐项记录并先裁定，不能静默覆盖。

## Coordination

- 当前工作区已有多批 Smash Up 未提交改动，并已修改 `cards.ts`、`ids.ts`、`atlasCatalog.ts`、`factionMeta.ts`、locale 和 manifest。
- 提案批准前，本 change 只新增独立 OpenSpec 文件，不修改上述共享运行时文件。
- 提案批准后，所有共享文件必须采用最小上下文增量补丁；不得回滚、覆盖、重排或格式化其他批次内容。
- 探险家已有泰坦数据、能力和测试痕迹；本 change 必须吸收这些既有内容作为探险家派系的一部分审计，而不是重写或删除它们。
- 四派系玩法按“摇滚明星 → 泰迪熊 → 外婆 → 探险家”逐个闭环，不同时写四个半成品派系。

## Impact

- Affected specs:
  - 新增 `smashup-what-were-we-thinking-factions`
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
