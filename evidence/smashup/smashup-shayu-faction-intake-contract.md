# Smash Up shayu 三派系 intake 来源合同（2026-05-10）

## 任务范围

- 游戏：`smashup`（大杀四方）
- 批次标识：`shayu`
- 用户说明：已补充卡牌和基地素材，文件名都叫 `shayu`；先前 base 放错，用户已更正。
- 当前阶段：**intake：来源合同 + atlas 几何 + 静态数据接入**。
- 当前口径：只做派系素材、静态 card/base/faction、i18n、预览与预加载接入；**不声明完整 gameplay ability handler 已实现**。

## 工作树

- 新工作树：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions`
- 分支：`feat/smashup-shayu-factions`
- 说明：根工作区有其他任务改动；本任务只在上述 worktree 推进。

## 已锁定的本地素材来源

| 用途 | 新工作树路径 | SHA256 | 尺寸 | 结论 |
| --- | --- | --- | --- | --- |
| cards atlas | `public/assets/i18n/zh-CN/smashup/cards/shayu.png` | `2B8146E44FBD1E7EB79115E848F20EF30D323B8DBB924AB462B8432E64110FAC` | `4096x3598` | 已确认是卡牌 atlas |
| base atlas | `public/assets/i18n/zh-CN/smashup/base/shayu.png` | `BCE7B42D41111D454117C40B32EFAD6E13AE512D3F03980757793CA1E6EBD607` | `4096x3886` | 用户更正后与 cards 不同，已确认是基地 atlas |

## 对照源与适用范围

| 来源 | 适用字段 | 当前证据 |
| --- | --- | --- |
| 本地 shayu 图片 | 中文图面、atlas 几何、slot 顺序、base 数值 | `temp/smashup-shayu-intake/cards-grid-8x5.jpg`、`temp/smashup-shayu-intake/base-grid-3x4.jpg` |
| 项目 Wiki 爬虫 | 英文 canonical 名称、英文卡牌效果文本、count/power 对照 | `wiki-cards-with-descriptions.json`、`WIKI-CARDS-DETAILED-REPORT.md` |
| 既有 Smash Up 数据结构 | defId 命名、previewRef/atlas 注册模式 | `src/games/smashup/data/**`、`src/games/smashup/domain/atlasCatalog.ts` |

## 派系列表

| factionId | 英文 canonical | 中文显示名 | Wiki 卡牌统计 | 基地 |
| --- | --- | --- | --- | --- |
| `sharks` | Sharks | 鲨鱼 | 12 种 / 20 张 | `Shark Reef`、`The Deep` |
| `tornados` | Tornados | 龙卷风 | 12 种 / 20 张 | `Tornado Alley`、`Trailer Park` |
| `mythic_greeks` | Mythic Greeks | 希腊神话 | 15 种 / 20 张 | `Oracle at Delphi`、`Wooden Horse` |

## Cards atlas 合同

- 图集：`smashup/cards/shayu`
- atlasId：`smashup:cards9`
- grid：`5 x 8`（rows=5, cols=8）
- 索引：row-major，0-based
- 非牌组格：`39` 为 `Mythic Greeks` 封面/标题格，不录入牌组卡牌。

| index | faction | defId | nameEn | count | type | power | 备注 |
| ---: | --- | --- | --- | ---: | --- | ---: | --- |
| 0 | sharks | `sharks_megalodon` | Megalodon | 1 | minion | 5 | deck card |
| 1 | sharks | `sharks_great_white` | Great White | 2 | minion | 4 | deck card |
| 2 | sharks | `sharks_hammerhead` | Hammerhead | 3 | minion | 3 | deck card |
| 3 | sharks | `sharks_mako` | Mako | 4 | minion | 2 | deck card |
| 4 | sharks | `sharks_blood_in_the_water` | Blood in the Water | 2 | action | - | play on base ongoing |
| 5 | sharks | `sharks_week_of_sharks` | Week of Sharks | 2 | action | - | play on base ongoing |
| 6 | sharks | `sharks_torn_apart` | Torn Apart | 1 | action | - | standard |
| 7 | sharks | `sharks_chum` | Chum | 1 | action | - | play on minion ongoing |
| 8 | sharks | `sharks_dangerous_waters` | Dangerous Waters | 1 | action | - | play on base talent text；intake 不实现 handler |
| 9 | sharks | `sharks_feeding_frenzy` | Feeding Frenzy | 1 | action | - | standard |
| 10 | sharks | `sharks_air_jaws` | Air Jaws | 1 | action | - | standard |
| 11 | sharks | `sharks_freakin_laser_beam` | Freakin’ Laser Beam | 1 | action | - | standard |
| 12 | tornados | `tornados_monster_tornado` | Monster Tornado | 1 | minion | 5 | deck card |
| 13 | tornados | `tornados_cyclone` | Cyclone | 2 | minion | 4 | deck card |
| 14 | tornados | `tornados_twister` | Twister | 3 | minion | 3 | deck card |
| 15 | tornados | `tornados_dust_devil` | Dust Devil | 4 | minion | 2 | deck card |
| 16 | tornados | `tornados_trade_winds` | Trade Winds | 2 | action | - | standard |
| 17 | tornados | `tornados_carried_away` | Carried Away | 2 | action | - | standard |
| 18 | tornados | `tornados_whirlwinds` | Whirlwinds | 1 | action | - | standard |
| 19 | tornados | `tornados_gone_with_the_wind` | Gone with the Wind | 1 | action | - | afterScoring special |
| 20 | tornados | `tornados_ripped_off` | Ripped Off | 1 | action | - | standard |
| 21 | tornados | `tornados_picked_up` | Picked Up | 1 | action | - | beforeScoring special |
| 22 | tornados | `tornados_not_in_kansas` | Not in Kansas | 1 | action | - | standard |
| 23 | tornados | `tornados_over_the_rainbow` | Over the Rainbow | 1 | action | - | beforeScoring special |
| 24 | mythic_greeks | `mythic_greeks_odysseus` | Odysseus | 1 | minion | 5 | deck card |
| 25 | mythic_greeks | `mythic_greeks_argonaut` | Argonaut | 4 | minion | 2 | deck card |
| 26 | mythic_greeks | `mythic_greeks_jason` | Jason | 1 | minion | 4 | deck card |
| 27 | mythic_greeks | `mythic_greeks_favor_of_hades` | Favor of Hades | 1 | action | - | standard |
| 28 | mythic_greeks | `mythic_greeks_heracles` | Heracles | 1 | minion | 4 | deck card |
| 29 | mythic_greeks | `mythic_greeks_favor_of_ares` | Favor of Ares | 1 | action | - | standard |
| 30 | mythic_greeks | `mythic_greeks_spartan` | Spartan | 3 | minion | 3 | deck card |
| 31 | mythic_greeks | `mythic_greeks_favor_of_aphrodite` | Favor of Aphrodite | 1 | action | - | standard |
| 32 | mythic_greeks | `mythic_greeks_favor_of_dionysus` | Favor of Dionysus | 1 | action | - | standard |
| 33 | mythic_greeks | `mythic_greeks_favor_of_hera` | Favor of Hera | 1 | action | - | standard |
| 34 | mythic_greeks | `mythic_greeks_favor_of_athena` | Favor of Athena | 1 | action | - | standard |
| 35 | mythic_greeks | `mythic_greeks_favor_of_apollo` | Favor of Apollo | 1 | action | - | standard |
| 36 | mythic_greeks | `mythic_greeks_favor_of_hermes` | Favor of Hermes | 1 | action | - | standard |
| 37 | mythic_greeks | `mythic_greeks_favor_of_poseidon` | Favor of Poseidon | 1 | action | - | standard |
| 38 | mythic_greeks | `mythic_greeks_favor_of_zeus` | Favor of Zeus | 1 | action | - | standard |
| 39 | - | - | Mythic Greeks | - | cover | - | 非牌组封面格，不接入 `CardDef` |

## Base atlas 合同

- 图集：`smashup/base/shayu`
- atlasId：`smashup:base7`
- grid：`4 x 3`（rows=4, cols=3）
- 索引：row-major，0-based
- 本图包含 12 个基地，本次只接入目标三派系的 6 个基地；其余格记录为外部/非本轮 scope。

| index | 本轮接入 | defId | nameEn | breakpoint | VP | faction | 备注 |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 0 | 否 | - | TableTop | 20 | 4/2/1 | - | 非本轮三派系 |
| 1 | 否 | - | Wyrm's Desolation | 20 | 5/3/2 | - | 非本轮三派系 |
| 2 | 是 | `base_shark_reef` | Shark Reef | 20 | 4/2/1 | sharks | 接入 |
| 3 | 否 | - | The Con | 24 | 5/3/2 | - | 非本轮三派系 |
| 4 | 否 | - | Dragon's Lair | 18 | 2/2/1 | - | 非本轮三派系 |
| 5 | 是 | `base_oracle_at_delphi` | Oracle at Delphi | 18 | 4/2/1 | mythic_greeks | 接入 |
| 6 | 是 | `base_trailer_park` | Trailer Park | 20 | 4/2/1 | tornados | 接入 |
| 7 | 否 | - | Converted Cave | 18 | 4/3/2 | - | 非本轮三派系 |
| 8 | 是 | `base_wooden_horse` | Wooden Horse | 21 | 3/2/1 | mythic_greeks | 接入 |
| 9 | 是 | `base_the_deep` | The Deep | 16 | 3/2/2 | sharks | 接入 |
| 10 | 否 | - | Crystal Fortress | 19 | 3/1/1 | - | 非本轮三派系 |
| 11 | 是 | `base_tornado_alley` | Tornado Alley | 25 | 4/3/2 | tornados | 接入 |

## 当前裁定

- `cards/shayu.png` 与 `base/shayu.png` 已经不是同一文件；原 blocker 已解除。
- `cards` 使用 `8 x 5`；`base` 使用 `3 x 4`。运行时注册字段按 `{ rows, cols }` 写为 cards `{ rows: 5, cols: 8 }`、base `{ rows: 4, cols: 3 }`。
- Mythic Greeks 第 40 格是封面/标题格，不进入牌组数据。
- Sharks / Tornados 官方泰坦在既有 `englishAtlasMap.json` 中有 TTS 线索（`sharks_helicoprion`、`tornados_category_5`），但不在本次 `shayu` 图片范围内，本轮不接入为新 deck card。

## 收口项

- [x] 确认压缩产物：`cards/compressed/shayu.webp`、`base/compressed/shayu.webp`
- [x] 完成静态数据、i18n、faction metadata 接入
- [x] 运行静态/单测校验
- [x] 资源上传 R2/CDN 回查 200：本轮 `npm run assets:check` 显示远端已有且 MD5 一致，随后对两个 `shayu.webp` 执行 HEAD 均为 `200`
- [x] 补充 intake 验证 evidence：`evidence/smashup/smashup-shayu-faction-intake-verification.md`

## 仍需明确的边界

- 本轮是 intake / 静态接入，不声明三派系完整玩法 handler 已实现。
- `shayu.png` / `shayu.webp` 被 `.gitignore` 命中；后续提交资产时需显式 `git add -f`。
