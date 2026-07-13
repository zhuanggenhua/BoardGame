# Smash Up Promo 绵羊与全明星 Intake Plan

## Scope

用户提供的卡牌图集经 TTS 模组元数据反查后确认承载两个 Promo 派系：

| 派系 | canonical id | TTS deck | 唯一卡面 | 实体牌 | 基地 |
| --- | --- | --- | ---: | ---: | --- |
| 绵羊 | `sheep` | `Sheep` | 12 | 20 | 牧场、绵羊神社 |
| 全明星 | `all_stars` | `All-Stars` | 20 | 20 | 更衣室、体育场 |

当前 OpenSpec proposal 已获用户批准，运行时代码、locale、正式本地资源、manifest、代表性 L2 行为测试与真实入口 E2E 均已实施。当前状态不是“全面审计完成”：R2 上传被凭据 `401 Unauthorized` 阻塞，`npm run i18n:check` 被并行派系的历史缺口阻塞，且部分复杂牌仍保留 scoped-debt（见下方 Mechanism Residual Scope）。

## Source Table

| 来源 | 角色 | 路径 / URL | 尺寸 | SHA-256 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 用户卡牌 atlas | 中文卡名、中文效果文本、卡图 row-major 索引 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1008186624533785764CDE30A9BF5891128CBDDE1660763A2882909B208.png` | `2914 x 4096` | `F01D0AB000A18F0E167045F1279372C9A54B13D16D9794CF02BC1640E4FBC7C3` | `locked/local-runtime-resource-added` |
| 用户基地 atlas | 基地中文图面、基地 row-major 索引 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1008186624533800673CE42AE6191F80AD7217450D3F687B93D092571D2.png` | `4096 x 2186` | `0E5697038ABF1228F096710F35373391AE95780A7616F7A1399B7799DBB0D044` | `locked/reuse-BASE4-slots-8-11` |
| TTS Workshop JSON | 牌组归属、canonical 英文名、CardID、重复数量、基地归属 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json` | `9,660,973 bytes` | `9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D` | `locked/static-count-contract` |

## Crop Table

所有录入裁片都只写入 `temp/`，不得进入 `public/assets/**` 或 manifest。

| 产物 | 路径 | 用途 |
| --- | --- | --- |
| 卡牌总览 | `D:/GA/BoardGame-upstream-main-dev-20260601/temp/smashup-promos-sheep-all-stars-intake/card-overview.jpg` | `6 x 6` 槽位与 display-only 区域复核 |
| 基地总览 | `D:/GA/BoardGame-upstream-main-dev-20260601/temp/smashup-promos-sheep-all-stars-intake/base-overview.jpg` | `4 x 3` 基地槽位复核 |
| 单卡裁片 | `D:/GA/BoardGame-upstream-main-dev-20260601/temp/smashup-promos-sheep-all-stars-intake/cards/card-00.jpg` ... `card-35.jpg` | 后续逐卡 OCR / 人工核对 |
| 单基地裁片 | `D:/GA/BoardGame-upstream-main-dev-20260601/temp/smashup-promos-sheep-all-stars-intake/bases/base-08.jpg` ... `base-11.jpg` | 后续逐基地 OCR / 人工核对 |
| 裁图摘要 | `D:/GA/BoardGame-upstream-main-dev-20260601/temp/smashup-promos-sheep-all-stars-intake/crop-summary.json` | 图片 hash、尺寸、网格、裁图坐标 |

## Atlas Contract

| atlas | grid | playable slots | display-only slots | status |
| --- | --- | --- | --- | --- |
| Promo cards | `6 x 6` | `0-11` 绵羊；`12-31` 全明星 | `32` 全明星随机阵营牌；`33` 绵羊随机阵营牌；`34-35` 牌背 / 标识 | `locked/runtime-atlas-registered` |
| Promo bases / existing `BASE4` candidate | `4 x 3` | `8` 牧场；`9` 绵羊神社；`10` 更衣室；`11` 体育场 | 其它槽位属于既有扩展/其它对象 | `locked/reuse-existing-BASE4` |

## Current Code Baseline

| 对象 | 当前代码状态 | 本轮处理 |
| --- | --- | --- |
| 牧场（`base_the_pasture`） | 已存在并保持复用；`cards.ts` 已切到 `SMASHUP_FACTION_IDS.SHEEP` | 复用并通过 Promo 集成测试与 E2E 截图对账 |
| 绵羊神社（`base_sheep_shrine`） | 已存在并保持复用；`cards.ts` 已切到 `SMASHUP_FACTION_IDS.SHEEP` | 复用并通过 Promo 集成测试对账 |
| 绵羊牌组 | 新增 `SMASHUP_FACTION_IDS.SHEEP`、`data/factions/sheep.ts`、`abilities/sheep.ts`、locale、metadata | 静态接入通过；代表性玩法 L2/L3 通过；你好，多莉与木材换羊关键复杂分支已补 L2 |
| 更衣室 / 体育场 | 新增 base def，复用 `BASE4` 槽位 `10-11`，并注册基地能力 | L2 行为测试覆盖更衣室回合开始抽牌、体育场摧毁后控制者抽牌；E2E 可见 |
| 全明星牌组 | 新增 `SMASHUP_FACTION_IDS.ALL_STARS`、`data/factions/all_stars.ts`、`abilities/all_stars.ts`、locale、metadata | 静态接入通过；代表性玩法 L2/L3 通过；复杂精确语义见 scoped-debt |

## Deck Inventory From TTS

### 绵羊

| slot | CardID | 英文名 | 类型 | 实体数量 | 合同状态 |
| ---: | ---: | --- | --- | ---: | --- |
| 0 | `26700` | Counting Sheep | Action | 1 | `locked/static+ongoing-representative` |
| 1 | `26701` | Hello, Dolly! | Action | 1 | `locked/L2-hand-reaction-copy-action-ability` |
| 2 | `26702` | Flock | Minion | 4 | `locked/L2-follow-move` |
| 3 | `26703` | Black Sheep | Minion | 3 | `locked/L2-auto-move` |
| 4 | `26704` | Ram | Minion | 2 | `locked/L2-talent-move-return` |
| 5 | `26705` | Little Bo Peep | Minion | 1 | `locked/static+talent; protection shared path registered` |
| 6 | `26706` | To Follow, or Not? | Action | 2 | `locked/L2-random-discard-action-play-or-return-choice+draw` |
| 7 | `26707` | On the Lamb | Action | 1 | `locked/L2-move-batch-representative` |
| 8 | `26708` | Shearing | Action | 1 | `locked/L2-draw-minus2-detach` |
| 9 | `26709` | Wood for Sheep | Action | 1 | `locked/L2-random-hand-action-or-minion-return-or-trade-play` |
| 10 | `26710` | Ewe Shall Pass | Action | 2 | `locked/L2+L3-move-draw-extra-action` |
| 11 | `26711` | In Sheep's Clothing | Action | 1 | `locked/L2-follow-move-detach-representative` |

### 全明星

| slot | CardID | 英文名 | 类型 | 实体数量 | 合同状态 |
| ---: | ---: | --- | --- | ---: | --- |
| 12 | `26712` | Square Deal | Action | 1 | `locked/L2-draw-contract` |
| 13 | `26713` | Favor of Dionysus | Action | 1 | `locked/L2-extra-action+power-representative` |
| 14 | `26714` | G.E.L.F. | Minion | 1 | `locked/L2-search-choice+self-into-deck+chosen-minion-play` |
| 15 | `26715` | Granny | Minion | 1 | `locked/L2-top-or-bottom-choice` |
| 16 | `26716` | King Rex | Minion | 1 | `locked/static-vanilla` |
| 17 | `26717` | Seeing Stars | Action | 1 | `locked/L2-destroy-low-power` |
| 18 | `26718` | Begin the Summoning | Action | 1 | `locked/L2-discard-minion-to-deck-top+extra-action` |
| 19 | `26719` | Ghostly Arrival | Action | 1 | `locked/L2-extra-minion+extra-action` |
| 20 | `26720` | Friendship Power | Action | 1 | `locked/L2-move+recover-action` |
| 21 | `26721` | Non-Infinite Loop | Action | 1 | `locked/L2-extra-standard-action-resolves+return-option; target metadata supported` |
| 22 | `26722` | Full Moon | Action | 1 | `locked/L2-ongoing-base-power` |
| 23 | `26723` | It's Astounding | Action | 1 | `locked/L2-discard-action-extra-play-representative` |
| 24 | `26724` | Ensign | Minion | 1 | `scoped-debt: redirect/protection text registered but not full resolver` |
| 25 | `26725` | Puck | Minion | 1 | `locked/L2-choice-extra-action-or-draw` |
| 26 | `26726` | Lab Assistant | Minion | 1 | `locked/L2-counter-on-other-minion` |
| 27 | `26727` | Prepare for Battle | Action | 1 | `locked/L2+L3-choose-one-bottom-other` |
| 28 | `26728` | Imperial Dragon | Minion | 1 | `locked/L2-play-or-move-here-draw` |
| 29 | `26729` | Sprout | Minion | 1 | `locked/L2-turn-start-destroy-search-representative` |
| 30 | `26730` | Fan | Minion | 1 | `locked/L2-hand-special-discard-draw` |
| 31 | `26731` | Servitor of Cthulhu | Minion | 1 | `locked/L2-destroy-self-action-to-deck-top` |

## Base Inventory From TTS

| slot | CardID | 英文名 | 派系 | 当前代码状态 | 合同状态 |
| ---: | ---: | --- | --- | --- | --- |
| 8 | `5908` | The Pasture | 绵羊 | 已存在 | `locked/reused-L2-existing+E2E-visible` |
| 9 | `5909` | Sheep Shrine | 绵羊 | 已存在 | `locked/reused-L2-existing` |
| 10 | `5910` | Locker Room | 全明星 | 已注册 | `locked/L2+E2E-visible` |
| 11 | `5911` | Stadium | 全明星 | 已注册 | `locked/L2+E2E-visible` |

## Batch Matrix

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 绵羊 | `passed` | `blocked:R2 401 for new card atlas; local+manifest passed` | `passed` | `representative-passed` | `passed` | `representative-playable; not full exact closeout` |
| 全明星 | `passed` | `blocked:R2 401 for shared card atlas; local+manifest passed` | `passed` | `representative-passed` | `passed` | `representative-playable; not full exact closeout` |

## Implementation Evidence

### Runtime Files

- 静态接入：`src/games/smashup/domain/ids.ts`、`src/games/smashup/domain/atlasCatalog.ts`、`src/games/smashup/data/factions/sheep.ts`、`src/games/smashup/data/factions/all_stars.ts`、`src/games/smashup/data/cards.ts`、`src/games/smashup/ui/factionMeta.ts`
- 玩法实现：`src/games/smashup/abilities/sheep.ts`、`src/games/smashup/abilities/all_stars.ts`、`src/games/smashup/abilities/index.ts`
- 资源：`public/assets/i18n/zh-CN/smashup/cards/promos_sheep_all_stars.png`、`public/assets/i18n/zh-CN/smashup/cards/compressed/promos_sheep_all_stars.webp`
- Manifest：`public/assets/i18n/assets-manifest.json`、`public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- 测试：`src/games/smashup/__tests__/promosSheepAllStarsIntegration.test.ts`、`src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts`、`src/games/smashup/__tests__/criticalImageResolver.test.ts`、`e2e/smashup/smashup-promos-sheep-all-stars.e2e.ts`

### Commands Run

| 命令 | 结果 | 归因 |
| --- | --- | --- |
| `openspec validate add-smashup-promos-sheep-all-stars --strict --no-interactive` | passed | 本 change |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts src/games/smashup/__tests__/promosSheepAllStarsIntegration.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/reactionQueueActionPlayedConstruction.test.ts --configLoader native` | passed, 37 tests | 本 change；含少尉可选 redirect/负向不触发、你好，多莉 ACTION_PLAYED 反应复制与 ACTION_PLAYED 构造审计 |
| `node -e "...JSON.parse(...game-smashup.json...)"` | passed | 本 change locale JSON 可解析 |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup` | passed | 本 change game-level manifest |
| `node -e "...manifest key check..."` | passed | 根级与游戏级 manifest 均含 Promo 新键 |
| `npx tsc --noEmit --pretty false --skipLibCheck` | passed | 本工作区类型检查 |
| `npm run test:e2e:ci:file -- e2e/smashup/smashup-promos-sheep-all-stars.e2e.ts` | passed, 2 tests | 本 change 真实入口 |
| `node scripts/assets/upload-to-r2.js --only official/i18n/zh-CN/smashup/cards/compressed/promos_sheep_all_stars.webp` | failed: `Unauthorized` / HTTP 401 | 精确上传仅处理 Promo 新卡图；环境 R2 凭据 blocker |
| `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/promos_sheep_all_stars.webp` | failed: 404 | 新资源尚未远端可用，受 R2 上传 blocker 影响 |
| `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/base4.webp` | passed: 200 | 复用 BASE4 远端资源已存在 |
| `npm run i18n:check` | failed: 38 missing keys + 79 warnings | 并行派系历史/未完成批次；输出未命中 `sheep.ts` / `all_stars.ts` 新缺口 |

### E2E Screenshots And Visual Observations

| 截图 | 路径 | 观察结论 |
| --- | --- | --- |
| 派系选择页共享图集 | `D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-promos-sheep-all-stars.e2e/派系选择页能看到绵羊、全明星，并加载共享-Promo-图集/01-绵羊全明星-派系选择页共享图集可见.jpg` | 真实派系选择 UI 中打开全明星详情；右侧可见共享 Promo atlas 的全明星卡图，不是 shimmer/占位。 |
| 绵羊派系预览 | `D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-promos-sheep-all-stars.e2e/真实选秀后可开局，并完成绵羊与全明星代表能力链/02-绵羊-派系预览.jpg` | 绵羊在真实选秀中可选择，预览卡图来自 Promo atlas。 |
| 全明星派系预览 | `D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-promos-sheep-all-stars.e2e/真实选秀后可开局，并完成绵羊与全明星代表能力链/03-全明星-派系预览.jpg` | 全明星在真实选秀中可选择，预览卡图来自 Promo atlas。 |
| 真实选秀开局完成 | `D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-promos-sheep-all-stars.e2e/真实选秀后可开局，并完成绵羊与全明星代表能力链/04-绵羊全明星-真实选秀开局完成.jpg` | 玩家 0 最终派系为绵羊 + 全明星，真实开局进入牌桌，未见 atlas shimmer。 |
| 母羊放行选择中 | `D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-promos-sheep-all-stars.e2e/真实选秀后可开局，并完成绵羊与全明星代表能力链/06-母羊放行-随从选择中.jpg` | 从真实手牌入口打出母羊放行，出现随从选择交互。 |
| 准备战斗选择后收口 | `D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-promos-sheep-all-stars.e2e/真实选秀后可开局，并完成绵羊与全明星代表能力链/09-准备战斗-选择后收口.jpg` | 牌桌显示牧场、更衣室、体育场；羊群已移动到更衣室；手牌含小精灵与仰慕者；准备战斗进入弃牌区，代表链可继续操作。 |

## Mechanism Residual Scope

| 对象 | 当前实现 | 残余范围 |
| --- | --- | --- |
| 少尉 | 已实现可选 replacement redirect；L2 覆盖选择改向与跳过 | 代表性 scoped-debt 已清；仍待对象级全面 L4 审计 |

## Next Gate

1. 补有效 R2 凭据后重跑 `node scripts/assets/upload-to-r2.js --only official/i18n/zh-CN/smashup/cards/compressed/promos_sheep_all_stars.webp`，并对 `promos_sheep_all_stars.webp` 执行 `HEAD 200` 回查。
2. 若本 PR 必须达到“全面精确玩法”而非代表性可玩，需要继续做对象级逐子句审计与全面 L4；少尉 redirect 不再是代表性 blocker。
3. `npm run i18n:check` 当前被并行派系历史缺口阻塞；本 change 不应擅自修复这些无关派系，除非用户扩大范围。
