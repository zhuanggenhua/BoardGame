# Change: 实装大杀四方《环游世界：国际事件》四派系

## Why

用户提供了一张新的大杀四方中文卡牌图集，并要求按项目流程把图中的种族卡实装进游戏。经图片与本地 TTS 模组元数据核对，这张图对应《环游世界：国际事件》的四个完整派系：

- 相扑手（`sumo_wrestlers`）
- 火枪手（`musketeers`）
- 骑警（`mounties`）
- 摔角手（`luchadors`）

当前仓库审计表仍将这四个派系列为未实现。此次变更必须从图片 intake 一路完成正式玩法、资源发布、对象级审计和真实入口 E2E，不能把“派系选择可见”或“卡图能显示”误报成派系完成。

## Approval

- [x] 用户已于 2026-07-13 明确批准本提案，允许开始运行时代码实施。

## What Changes

- 新增相扑手完整牌组：12 个唯一卡面、20 张实体牌、2 张基地。
- 新增火枪手完整牌组：14 个唯一卡面、20 张实体牌、2 张基地。
- 新增骑警完整牌组：12 个唯一卡面、20 张实体牌、2 张基地。
- 新增摔角手完整牌组：13 个唯一卡面、20 张实体牌、2 张基地。
- 接入用户提供的共享卡牌 atlas：
  - 尺寸 `3332 x 4096`
  - 网格 `8 x 7`
  - 槽位 `0-50` 为 51 个唯一卡面
  - 槽位 `51-54` 为四张派系展示卡，槽位 `55` 为 Smash Up 标识，不得注册成手牌
- 接入 TTS 模组中的《国际事件》基地 atlas：
  - 尺寸 `4096 x 2914`
  - 网格 `4 x 4`
  - 本 change 使用 8 张基地
- 为 51 个唯一卡面和 8 张基地建立逐对象来源合同、规则子句表、effect atom 矩阵和 L0-L4 证据状态。
- 补齐 faction ID、card/base ID、atlas metadata、静态数据、双语 locale、派系选择 metadata、关键图片预加载、manifest 与 R2/CDN 发布。
- 逐派系完成全部能力、持续效果、触发器、交互、基地能力、可选/强制分支和清理时机。
- 逐派系补定向领域测试、真实入口 E2E、截图证据和对象级审计文档。

## Source Contract

- 中文卡牌图面与卡牌效果主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1013814147743915359FDEDF0FFA198E2214A624702AA00BF5C655A38E7.png`
  - SHA-256：`A04E696D6D3AB50A4FA5BDBC31C58C7385657E73CCBC36A3A7FDE6BA44D3CA55`
- 基地图面、基地槽位和基地 canonical 名称主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1013814147744231500252328AD5B44D4FBDE2EEBDAC57D135FB7750BC5.png`
  - SHA-256：`8D695587ADFC6FBCC64EB845D3F70D4A2CC3135B0B53F1F9A7B9E5EE4AD9B24E`
- 牌组归属、实体重复数量、CardID、atlas 槽位和 TTS kit 归属对照源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json`
  - SHA-256：`9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D`
- 英文规则正文与勘误：
  - intake 阶段逐卡对照官方卡牌资料或 Smash Up Wiki。
  - 若英文资料与中文图面存在冲突，必须在 evidence 中逐项记录并先裁定，不能静默覆盖。

## Coordination

- 当前工作区已有多批 Smash Up 未提交改动，并已修改 `cards.ts`、`ids.ts`、`atlasCatalog.ts`、`factionMeta.ts`、locale 和 manifest。
- 提案批准前，本 change 只新增独立 OpenSpec 与 evidence 文件，不修改上述共享运行时文件。
- 提案批准后，所有共享文件必须采用最小上下文增量补丁；不得回滚、覆盖、重排或格式化其他批次内容。
- 四派系玩法按“相扑手 → 火枪手 → 骑警 → 摔角手”逐个闭环，不同时写四个半成品派系。

## Impact

- Affected specs:
  - 新增 `smashup-international-incident-factions`
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
