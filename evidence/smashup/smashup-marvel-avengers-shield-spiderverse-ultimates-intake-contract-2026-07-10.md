# 大杀四方漫威首批四派系 intake 合同

## 当前结论

- `gameId`：`smashup`
- 工作区：`D:/GA/BoardGame-upstream-main-dev-20260601`
- 分支：`codex/upstream-main-dev-20260707`
- 范围：复仇者、神盾局、蜘蛛宇宙、终极战队四个派系的卡牌、玩法、资源与验证
- 当前阶段：`implementation-in-progress`（当前 card-only scope；intake 合同已 locked）
- 原因：atlas 几何、派系边界、英文名、牌型、重复数量、54 张卡的中文效果原文与原子子句均已锁定
- 运行时代码状态：静态数据、能力模块和代表性 L2 已接入；本轮资源交付改为 PR 提交给作者，不执行 R2 上传
- 详细规则合同：`evidence/smashup/smashup-marvel-card-rules-contract-2026-07-10.md`

## 主真相源

| 字段 | 来源 | 路径/定位 | 状态 |
| --- | --- | --- | --- |
| 中文卡图、中文名、力量、中文效果 | 用户提供的完整 atlas | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc162184881699211286628ECDB40DD1FA4B98292A3E8BD1AFD67F56DA52B.png` | locked |
| 网格、CardID、派系、英文名、牌型、数量 | TTS 模组 JSON | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json` | locked |
| 单卡核对裁图 | 从主真相源按 `9 x 6` 裁切 | `temp/smashup-marvel-intake/cards/` | locked |
| 分块核对图 | 从主真相源生成 | `temp/smashup-marvel-intake/contact-sheets/` | locked |
| 漫威基地 | 未提供 | 不在当前 atlas | not-applicable:不属于当前 card-only scope |

原图信息：

- 尺寸：`4399 x 4096`
- 文件大小：`36,067,834 bytes`
- SHA-256：`1D0E1BDFC79005AE2FDAC697C4D5AC47F5B00BB219E707C1E44258A4986D95E1`
- atlas：`9 x 6`
- 唯一卡面：`54`
- 总实体牌：`80`

## Atlas 可视合同

| atlas 区间 | 图上对象 | 运行时对象 | 允许状态 | 是否可交互 |
| --- | --- | --- | --- | --- |
| `0-17` | 复仇者卡牌 | `AVENGERS` 牌组 | 手牌/牌库/弃牌/基地随从/持续行动 | 按卡牌规则 |
| `18-29` | 神盾局卡牌 | `SHIELD` 牌组 | 手牌/牌库/弃牌/基地随从/持续行动 | 按卡牌规则 |
| `30-41` | 蜘蛛宇宙卡牌 | `SPIDER_VERSE` 牌组 | 手牌/牌库/弃牌/基地随从/持续行动 | 按卡牌规则 |
| `42-53` | 终极战队卡牌 | `ULTIMATES` 牌组 | 手牌/牌库/弃牌/基地随从/持续行动 | 按卡牌规则 |

## 卡牌索引合同

### 复仇者

| index | canonical 英文名 | 类型 | 数量 | 规则合同 |
| ---: | --- | --- | ---: | --- |
| 0 | Black Widow | Minion | 1 | locked |
| 1 | Captain America | Minion | 1 | locked |
| 2 | Hawkeye | Minion | 1 | locked |
| 3 | Hulk | Minion | 1 | locked |
| 4 | Iron Man | Minion | 1 | locked |
| 5 | Thor | Minion | 1 | locked |
| 6 | Avengers Assemble | Action | 2 | locked |
| 7 | Cap's Shield | Action | 1 | locked |
| 8 | Hawkeye's Arrows | Action | 1 | locked |
| 9 | Hulk Smash | Action | 1 | locked |
| 10 | J.A.R.V.I.S. | Action | 1 | locked |
| 11 | Mjolnir | Action | 1 | locked |
| 12 | Modular Tech | Action | 1 | locked |
| 13 | Repulsor Boots | Action | 1 | locked |
| 14 | Strategize | Action | 2 | locked |
| 15 | Tactical Advantage | Action | 1 | locked |
| 16 | Thunder and Lightning | Action | 1 | locked |
| 17 | Widow's Bite | Action | 1 | locked |

### 神盾局

| index | canonical 英文名 | 类型 | 数量 | 规则合同 |
| ---: | --- | --- | ---: | --- |
| 18 | Nick Fury | Minion | 1 | locked |
| 19 | Maria Hill | Minion | 2 | locked |
| 20 | Agent Coulson | Minion | 3 | locked |
| 21 | S.H.I.E.L.D. Agent | Minion | 4 | locked |
| 22 | Entry Point | Action | 1 | locked |
| 23 | Mission Debriefing | Action | 2 | locked |
| 24 | Proving Ground | Action | 2 | locked |
| 25 | Reassignment | Action | 1 | locked |
| 26 | Rescue Mission | Action | 1 | locked |
| 27 | Superior Firepower | Action | 1 | locked |
| 28 | Troop Drop | Action | 1 | locked |
| 29 | Work Together | Action | 1 | locked |

### 蜘蛛宇宙

| index | canonical 英文名 | 类型 | 数量 | 规则合同 |
| ---: | --- | --- | ---: | --- |
| 30 | Spider-Man | Minion | 1 | locked |
| 31 | Ghost-Spider | Minion | 2 | locked |
| 32 | Miles Morales | Minion | 3 | locked |
| 33 | Spider-Man 2099 | Minion | 4 | locked |
| 34 | ...Comes Great Responsibility | Action | 1 | locked |
| 35 | Spider Reflexes | Action | 1 | locked |
| 36 | Spider-Sense | Action | 1 | locked |
| 37 | Spider-Verse Bond | Action | 1 | locked |
| 38 | The View From Above | Action | 2 | locked |
| 39 | Webbed Up | Action | 1 | locked |
| 40 | With Great Power... | Action | 2 | locked |
| 41 | Your Friendly Neighborhood Hero | Action | 1 | locked |

### 终极战队

| index | canonical 英文名 | 类型 | 数量 | 规则合同 |
| ---: | --- | --- | ---: | --- |
| 42 | Captain Marvel | Minion | 1 | locked |
| 43 | Spectrum | Minion | 2 | locked |
| 44 | America Chavez | Minion | 3 | locked |
| 45 | Blue Marvel | Minion | 4 | locked |
| 46 | Aid from Allies | Action | 1 | locked |
| 47 | Coordinated Attack | Action | 1 | locked |
| 48 | Cosmic Knowledge | Action | 1 | locked |
| 49 | First to Arrive | Action | 2 | locked |
| 50 | Heroic Landing | Action | 1 | locked |
| 51 | Lift and Carry | Action | 1 | locked |
| 52 | Power and Speed | Action | 2 | locked |
| 53 | Scramble | Action | 1 | locked |

## 图片转写与抽样复核

54 张完整单卡均已读取。主线程额外复核了：

- 复仇者 `0-17` 两张 contact sheet，并单独放大雷神、美国队长盾牌和鹰眼箭。
- 神盾局 `18-26` contact sheet。
- 蜘蛛宇宙 `30-38` contact sheet。
- 终极战队 `42-50` contact sheet。

转写结果与抽样裁图一致。逐卡原文与 effect atom 见详细规则合同。

## 2026-07-11 资源与交付补充

- 已将主图源接入根级正式资源：`public/assets/smashup/cards/marvel_wave_one.png`。
- 已生成压缩资源：`public/assets/smashup/cards/compressed/marvel_wave_one.webp`。
- 已重建 `public/assets/smashup/assets-manifest.json`，新增 `cards/marvel_wave_one` 与 `cards/compressed/marvel_wave_one` 两个资源键。
- 本轮明确不走 R2 上传图集；交付方式为把正式资源、manifest、代码和 evidence 一起通过 PR 发给作者。
- 作者侧合并/发布后，再对远端代表 URL 做 `HEAD 200` 回查；PR 前的本地验证以文件 hash、manifest 键和定向测试为准。

## 待完成与阻塞

- `pending`：英文效果对照源或基于中文锁定合同的透明翻译。
- `pending`：共享机制复用矩阵和新机制清单。
- `pending`：实现阶段为每张可选牌补合法跳过/空选 L2/L3 证据。
- `not-applicable`：漫威专属基地未提供，不属于本 change 的 card-only scope。
- `gate`：OpenSpec 提案未批准前不得开始运行时代码。
