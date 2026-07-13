# Change: 实装大杀四方 Promo 绵羊与全明星两派系

## Why

用户提供了一张新的大杀四方中文卡牌 atlas，并要求按项目流程加入游戏。TTS 模组元数据反查后确认，这张 `6 x 6` atlas 同时承载两个 Promo 派系：

- 绵羊（`sheep`）
- 全明星（`all_stars` / `All-Stars`）

当前仓库已存在绵羊的两张基地和基地能力，但绵羊牌组本体仍未注册；全明星牌组与基地均未完整注册。此次变更需要先完成图片 intake、来源合同、OpenSpec 审批，再进入运行时接入、玩法实现、审计与真实入口 E2E，不能把“图片已找到”或“基地局部存在”误报成派系完成。

## Approval

- 当前状态：**已获用户批准（2026-07-13）**。
- 用户已批准绵羊与全明星两派系整体实施，允许进入运行时代码、locale 与正式资源接入。

## What Changes

- 新增绵羊完整牌组：12 个唯一卡面、20 张实体牌、2 张基地。
- 新增全明星完整牌组：20 个唯一卡面、20 张实体牌、2 张基地。
- 接入用户提供的共享卡牌 atlas：
  - 尺寸 `2914 x 4096`
  - 网格 `6 x 6`
  - 槽位 `0-11`：绵羊唯一卡面
  - 槽位 `12-31`：全明星唯一卡面
  - 槽位 `32`：全明星随机阵营牌，仅 display-only
  - 槽位 `33`：绵羊随机阵营牌，仅 display-only
  - 槽位 `34-35`：牌背 / 标识图，仅 display-only
- 复用或核准现有 `BASE4` / `base4` 基地 atlas：
  - 槽位 `8`：牧场（`base_the_pasture`）
  - 槽位 `9`：绵羊神社（`base_sheep_shrine`）
  - 槽位 `10`：更衣室（`base_locker_room`，全明星）
  - 槽位 `11`：体育场（`base_stadium`，全明星）
- 补齐派系 ID、card/base 静态数据、atlas metadata、双语 locale、派系选择 metadata、关键图片预加载、manifest 与资源上传。
- 逐派系完成能力、持续效果、触发器、交互、基地能力、可选/强制分支、清理时机、领域测试、真实入口 E2E 和 evidence。

## Source Contract

- 中文卡牌图面、中文卡名、中文效果文本与 row-major 索引主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1008186624533785764CDE30A9BF5891128CBDDE1660763A2882909B208.png`
  - SHA-256：`F01D0AB000A18F0E167045F1279372C9A54B13D16D9794CF02BC1640E4FBC7C3`
- 中文基地图面与基地 row-major 索引主真相源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1008186624533800673CE42AE6191F80AD7217450D3F687B93D092571D2.png`
  - SHA-256：`0E5697038ABF1228F096710F35373391AE95780A7616F7A1399B7799DBB0D044`
- 牌组归属、canonical 英文名、实体重复数量、CardID、基地归属和 deck metadata 对照源：
  - `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json`
  - SHA-256：`9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D`
- 英文 canonical 效果文本、勘误与限定词：
  - intake 阶段按项目 Smash Up 专用抓取/权威文本回访流程逐卡锁定。
  - 若英文资料与用户提供中文图面冲突，必须在 evidence 中逐项记录并先裁定，不能静默覆盖。

## Coordination

- 当前工作区已有多批 Smash Up 未提交改动，并已修改 `cards.ts`、`ids.ts`、`atlasCatalog.ts`、`factionMeta.ts`、locale、manifest 与 evidence。
- 提案批准前，本 change 只新增独立 OpenSpec 与 evidence 文件，不修改共享运行时文件。
- 提案批准后，所有共享文件必须采用最小上下文增量补丁；不得回滚、覆盖、重排或格式化其他批次内容。
- 绵羊基地 `base_the_pasture` 与 `base_sheep_shrine` 已存在于当前代码和基地能力注册中；本 change 只复用并对账，不重写已正确的基地逻辑。
- 全明星包含大量跨派系致敬牌名，implementation 阶段必须逐张核语义；不得因名字像旧牌就自动复用旧 handler。
- 本批次状态记录使用 `evidence/smashup/2026-07-13-promos-sheep-all-stars-intake-plan.md`，避免混写根 `task_plan.md / findings.md / progress.md`。

## Impact

- Affected specs:
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
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
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
