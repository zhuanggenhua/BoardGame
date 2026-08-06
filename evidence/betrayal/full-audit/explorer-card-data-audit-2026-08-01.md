# 小黑屋探索者牌图与角色数据专项审计（2026-08-01）

> 文档类型：探索者数据专项审计证据
> 当前状态：active / current evidence
> 现实结论：这不是单纯“没留档”。此前 setup 补审只证明“玩家选择的角色会被正式开局消费”，没有逐项审计 13 张探索者牌图、正式候选、token、属性轨和能力。本文补齐该专项矩阵，并记录专项验证闭合证据；不能把本文外推成山屋惊魂全游戏完成或 12 名基础角色独立 token 全量完成。

## 1. 真相源

| 现实含义 | 当前真相源 |
| --- | --- |
| 基础版正式角色数量 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md`：规则书说明可游玩 12 个角色、6 张双面角色板、6 个角色模型。 |
| 基础版 12 人起始四项 | `docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md` 第 49 页表格：表头是 `Hero Might Speed Sanity Knowledge`；运行时代码字段顺序是 `might / speed / knowledge / sanity`，所以第三列必须落到神志，第四列必须落到知识。 |
| 本地探索者牌图 | `public/assets/i18n/zh-CN/betrayal/explorers/`，当前 13 张 PNG。 |
| 本地探索者 token | `public/assets/i18n/zh-CN/betrayal/tokens/explorers/`，当前 6 个 PNG，其中 2 个是历史错名别名。 |
| 运行时正式候选 | `src/games/betrayal/scenarioConfig.ts` 的 `BETRAYAL_EXPLORER_CATALOG`。 |
| 运行时属性轨消费 | `src/games/betrayal/game.ts` 的 `buildTraitTracksFromTemplate()`、`normalizeExplorerTraitTracks()`、`moveExplorerTraitSteps()`、`healExplorerTraitToStart()`。 |
| 资源运行时索引 | `docs/games/betrayal/sources/image-index/runtime-resource-map.json`、`public/assets/i18n/zh-CN/betrayal/assets-manifest.json`。 |

## 2. 审计裁决

1. 基础版正式可选角色为 12 名，不是旧 catalog 里的 Rebecca / Darryl 占位，也不是把目录里所有 13 张图无条件塞进正式候选。
2. `sera-nguyen.png` 卡面是 Sara / Sera Nguyen，带 `Curse: werewolf`，当前没有命中基础版 12 人官方起始属性表；本轮裁决为非基础扩展素材，暂不进入基础正式候选。
3. 基础版 12 人没有规则特殊能力；运行时不允许再保留“大胆”“攻击 +1”等假能力。catalog 统一写为“无特殊能力”，现实含义是角色背景不改变规则。
4. 属性变化必须移动角色板夹子位置，再由所在格读数值；由于轨道里存在重复数字，“提升一格”不保证裸数值 +1。
5. token 不是 12 人全量完整：当前正式可用 token 为杰登、神父梁沃伦、米歇尔、斯蒂芬妮；米歇尔和斯蒂芬妮来自旧错名路径复制到正确语义路径。其它基础角色没有独立 token 时只能回退头像，不得声明 token 全量完成。

## 3. 13 张探索者素材矩阵

| 牌图文件 | 卡面 / 角色 | 基础正式候选 | 官方起始值（力/速/知/神） | portraitAsset | token 状态 | 能力裁决 | 运行时状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `xia.png` | Isa Valencia / 伊莎·瓦伦西亚 | 是 | 3 / 5 / 4 / 4 | `betrayal/explorers/xia` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `anita-hernandez.png` | Anita Hernandez / 安妮塔·赫南德兹 | 是 | 4 / 4 / 5 / 3 | `betrayal/explorers/anita-hernandez` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `father-warren-leung.png` | Father Warren Leung / 神父梁沃伦 | 是 | 3 / 4 / 4 / 5 | `betrayal/explorers/father-warren-leung` | `betrayal/tokens/explorers/father-warren-leung` | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `dan-nguyen-md.png` | Dan Nguyen, MD / 阮单 医学博士 | 是 | 4 / 3 / 5 / 4 | `betrayal/explorers/dan-nguyen-md` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `michelle-monroe.png` | Michelle Monroe / 米歇尔·梦露 | 是 | 5 / 4 / 4 / 3 | `betrayal/explorers/michelle-monroe` | `betrayal/tokens/explorers/michelle-monroe`；旧错名 `darryl-highla` 仅保留别名证据 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `beat-box-bowen.png` | Brittani “Beat Box” Bowen / 布里塔妮 “B-BOX” 鲍温 | 是 | 5 / 3 / 4 / 4 | `betrayal/explorers/beat-box-bowen` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `josef-hooper.png` | Joseph / Josef Hooper / 约瑟夫·霍珀 | 是 | 5 / 4 / 3 / 4 | `betrayal/explorers/josef-hooper` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `oliver-swift.png` | Oliver Swift / 奥利弗·斯威夫特 | 是 | 4 / 5 / 4 / 3 | `betrayal/explorers/oliver-swift` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `stephanie-richter.png` | Stephanie Richter / 斯蒂芬妮·里克特 | 是 | 4 / 3 / 4 / 5 | `betrayal/explorers/stephanie-richter` | `betrayal/tokens/explorers/stephanie-richter`；旧错名 `rebecca-allen` 仅保留别名证据 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `persephone-puleri.png` | Persephone Puleri / 珀尔塞福涅·普拉里 | 是 | 4 / 4 / 3 / 5 | `betrayal/explorers/persephone-puleri` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `sammy-angler.png` | Sammy Angler / 塞米·昂勒尔 | 是 | 4 / 5 / 3 / 4 | `betrayal/explorers/sammy-angler` | 无独立 token，运行时回退头像 | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `jade-jones.png` | Jaden Jones / 杰登·琼斯 | 是 | 3 / 4 / 5 / 4 | `betrayal/explorers/jade-jones` | `betrayal/tokens/explorers/jaden-jones` | 无特殊能力 | 已进入 catalog，属性轨已结构化 |
| `sera-nguyen.png` | Sara / Sera Nguyen / 莎拉·阮 | 否，本轮非基础扩展 | 未命中基础 12 人官方表 | `betrayal/explorers/sera-nguyen` | 无正式 token | 扩展规则未锁定 | 不进基础 catalog，后续需要扩展规则源才可启用 |

## 4. 属性轨字段裁决

| 字段 | 现实含义 | 当前裁决 |
| --- | --- | --- |
| `traits` | 当前夹子所在格读出的力 / 速 / 知 / 神数值 | 已按官方起始表落入 12 名基础角色；表格原文第三列是神志、第四列是知识，代码字段已按知识 / 神志语义落位。 |
| `traitTracks.values` | 角色卡某项属性轨从低到高的格值 | 已从本地角色牌图结构化进 catalog；后续若换高清源图，只需复核此字段，不应回退成线性假轨。 |
| `traitTracks.startPosition` | 绿色起始夹子所在格 | 已要求 `values[startPosition] === traits[trait]`；测试中必须断言位置变化，不再断言裸数值一定变化。 |
| `criticalPosition` | 作祟前最低可停留位置 | 运行时由轨道构造统一派生；作祟前属性不会落到骷髅死亡位。 |
| `skullPosition` | 作祟后死亡骷髅位 | 运行时统一为 `-1`；死亡保护和伤害测试必须按轨道位置断言。 |

## 5. token 裁决

| token 文件 | 当前裁决 | 证据 |
| --- | --- | --- |
| `jaden-jones.png` | 正式 token | runtime resource map 已列为杰登地图玩家指示物。 |
| `father-warren-leung.png` | 正式 token | runtime resource map 已列为神父梁沃伦地图玩家指示物。 |
| `michelle-monroe.png` | 正式 token | 由旧错名 `darryl-highla.png` 复制到正确语义路径；PNG 与旧源 hash 相同，WebP 已生成，manifest 校验通过。 |
| `stephanie-richter.png` | 正式 token | 由旧错名 `rebecca-allen.png` 复制到正确语义路径；PNG 与旧源 hash 相同，WebP 已生成，manifest 校验通过。 |
| `rebecca-allen.png` | 历史错名别名，不作为正式 catalog 角色 | runtime resource map 已改为 `deprecated-alias`，防止继续冒充基础版角色。 |
| `darryl-highla.png` | 历史错名别名，不作为正式 catalog 角色 | runtime resource map 已改为 `deprecated-alias`，防止继续冒充基础版角色。 |

## 6. 当前验证结论

已完成并验证闭合：

- 12 名基础角色已替换旧 7 人占位 catalog。
- Rebecca / Darryl 不再作为正式角色候选。
- 基础角色能力统一裁决为“无特殊能力”。
- 米歇尔、斯蒂芬妮 token 已补正式语义路径，压缩 WebP 已生成，asset manifest 已重新生成并通过校验。
- 领域测试报告 `temp/betrayal-firstScenarioRuntime-report.json` 显示 690/690 passed。
- 界面测试报告 `temp/betrayal-Board-foundation-report.json` 显示 180/180 passed。
- 任务状态文件 `temp/betrayal-explorer-data-completion-2026-08-01.json` 已由 completion guard 判定为 `COMPLETE`。

当前仍不能外推的边界：

- 本专项不声明“山屋惊魂全游戏完成”。
- 本专项不声明 12 名基础角色独立 token 全量完成；当前只有杰登、神父梁沃伦、米歇尔、斯蒂芬妮有正式 token，其它基础角色回退头像。
- 后续如果补入高清角色牌、扩展角色或新的正式 token，必须重新回到本矩阵、资源 manifest 和运行时测试验证。
