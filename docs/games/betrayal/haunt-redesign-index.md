# 山屋惊魂 50 个作祟交互重设计索引

> 目的：把 50 个作祟全部纳入可追踪范围。本文是目录级索引，不替代逐作祟子账本。
> 真相源：`docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md`、`docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md`。

## 0. 当前抽取状态

- 英雄书 OCR 文本中命中 `Scenario Card:` 49 处。
- 叛徒书 OCR 文本中命中 `Scenario Card:` 43 处。
- 命中数低于 50 的原因是 OCR 格式不稳定、部分作祟在无叛徒 / 自由混战时只出现在一本书、部分行把标题 / 编号 / 触发条件粘连。
- 因此本文只能作为目录级索引；任何作祟进入实现前，必须回到对应页做逐条子账本。
- 官方源段页码和逐作祟合同门禁见 `docs/games/betrayal/haunt-contract-ledger.md`。本文中的 `source-mapped-contract-pending` 表示“来源已定位，但子账本未完成”，不再表示来源缺失。

## 1. 逐作祟子账本必填字段

| 字段 | 必须回答 |
| --- | --- |
| 识别 | 编号、标题、剧本卡、触发预兆、叛徒规则、英雄书页、叛徒书页 |
| 公开信息 | 必须对所有玩家朗读的介绍、公开设置、共同规则 |
| 私密信息 | 英雄 / 叛徒各自可见内容，以及使用时可公开要求朗读的段落 |
| 设置 | 双方 setup 顺序、房间、token、怪物、属性变化、牌堆搜索 |
| 目标 | 英雄、叛徒、无叛徒、隐藏叛徒或自由混战胜利条件 |
| 特殊规则 | 持续规则、触发规则、死亡规则、交易 / 移动 / 攻击限制 |
| 特殊行动 | 使用者、条件、目标、检定、次数限制、结果、UI 承接 |
| 指示物 | token 类型、数量、owner、位置、可见性、可移动 / 可攻击 / 可拾取 |
| 重要地点 | 目标房间、区域、搜索规则、未出现时如何处理 |
| 怪物盒 | 怪物属性、移动、攻击、受伤、击晕 / 杀死、行动顺序 |
| 终局 | If You Win 文本来源、胜方、展示方式 |
| 验证 | 单测、页面测试、E2E、截图和未覆盖边界 |

## 2. 目录级覆盖表

| # | 标题 | 剧本卡 / 触发预兆 | 叛徒口径 | 当前状态 | 子账本要求 |
| ---: | --- | --- | --- | --- | --- |
| 1 | 堆积如柴 2：赤红杰克归来 | NONE / A Splash of Crimson | 作祟揭秘者 | `representative-slices-with-natural-jack-spirit-turn` | 子账本已建；已补非致死攻击伤害分配、杰克之灵路径 / 攻击代表链，以及叛徒死亡后上一名英雄结束回合自然进入杰克之灵速度 3 移动骰真实入口代表链；仍缺完整英雄 / 叛徒合同、逐边界回归和完整终局 / 驱魔 / 复活排列 |
| 2 | Friends Forever | Cursed! / Ring | 隐藏叛徒 | `source-mapped-contract-pending` | 建子账本 |
| 3 | The Dust | NONE / A Vial of Dust | 隐藏叛徒 | `feverish-end-turn-damage-and-forced-exchange-representatives` | 子账本已建；已补死亡叛徒变狂热病患后自然进入速度 5 移动骰、真实房间移动、攻击同房英雄和回合交接代表链；已补回合末未交换疾病时进入 2 骰一般伤害分配、玩家确认后交接、隐藏叛徒确认分配后才变狂热病患的代表链；已补当前探索者结束回合与多名同房探索者逐个强制交换疾病标记、不进入冲动伤害、编号 1 中间 / 最终持有人永久感染的代表链；仍缺主动控制冲动同意 / 拒绝、研究 / 治愈失败交换、隐藏编号完整可见性、研究 / 治愈全路径 UI、同时胜负政策和完整终局回归 |
| 4 | Free the Realtor | For Sale / Dog | 无叛徒 | `source-mapped-contract-pending` | 建子账本 |
| 5 | Blood from a Stone | Paranormal Investigators / Mask | 无叛徒 | `setup-player-choice-multi-placement-multi-gaze-and-natural-monster-turn-representative-slices` | 子账本已建；已补 setup 自动全量放置、视线外房间不足时玩家点击真实房间补放石像、缺口为 2 时同房重复补放、石像小天使视线移动、英雄进入新视线伤害、怪物回合结束凝视伤害首名英雄和多英雄连续分配真实入口、揭秘者结束英雄回合后自然进入石像小天使怪物回合并在凝视收口后交给下一玩家、“玩躲猫猫”成功成对移除代表链、失败伤害分配真实入口，以及移除最后两只后的英雄胜利 / 全部英雄死亡后的作祟胜利真实入口终局；仍缺逐作祟边界回归和其它自然怪物回合全排列 |
| 6 | Inheritance | A Mysterious Invitation / Dagger | 隐藏叛徒 | `source-mapped-contract-pending` | 建子账本 |
| 7 | Upon Reflection | NONE / Eerie Mirror | 无叛徒 | `source-mapped-contract-pending` | 建子账本 |
| 8 | Housekeeping | A Mysterious Invitation / Dog | 无叛徒 | `source-mapped-contract-pending` | 建子账本 |
| 9 | Let Bygones be Bygones | A Mysterious Invitation / Idol | 自由混战 | `source-mapped-contract-pending` | 建子账本 |
| 10 | A Serious Offer | For Sale / Armor | 自由混战 | `source-mapped-contract-pending` | 建子账本 |
| 11 | Don't Get Cooked | A Strange Disappearance / Dagger | 自由混战 | `source-mapped-contract-pending` | 建子账本 |
| 12 | The House is Hungry / Helping Hands | NONE / The House is Hungry | 自由混战 | `combat-control-runtime-e2e-verified-representative` | 已接入官方 setup、奇异护符换手控制权、力量攻击偷牌替代伤害、巨魔手力量 8 合击领域链、Board 组件里的伤害 / 偷牌选择和巨魔手合击入口，并补入力量攻击奖励选择、巨魔手力量 8 合击、护符换手控制权、无人持护符跳过提示的真实入口 E2E 与截图证据；旧 12 邪教徒链仍是错挂候选，不作 12 验收；仍缺完整怪物行动和完整终局 |
| 13 | Holy Ground | A Strange Disappearance / Holy Symbol | 作祟揭秘者 | `contract-ready-runtime-candidate-mismatch` | 子账本已建；现有邪教徒 / 仪式房 / 裂隙链更像此剧本，迁移前需逐条审计 |
| 14 | Object Permanence | For Sale / Book | 作祟揭秘者左侧玩家 | `source-mapped-contract-pending` | 建子账本 |
| 15 | Of Monsters and Mayhem | Paranormal Investigators / Dagger | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 16 | Come Play With Us | Paranormal Investigators / Book | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 17 | Forward This or Die | Cursed! / Dagger | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 18 | A Nice Ring to It | Paranormal Investigators / Ring | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 19 | Caught on Tape | Cursed! / Holy Symbol | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 20 | Don't Say It | Cursed! / Dog | 年龄最大角色 | `source-mapped-contract-pending` | 建子账本 |
| 21 | Spooky McMasters Presents... | A Strange Disappearance / Book | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 22 | Operation: Underground | For Sale / Skull | 作祟揭秘者左侧玩家 | `source-mapped-contract-pending` | 建子账本 |
| 23 | Intruder Alert | Cursed! / Idol | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 24 | The Shadow Masquerade | A Mysterious Invitation / Mask | 速度最高 | `source-mapped-contract-pending` | 建子账本 |
| 25 | Borrowed Time | A Strange Disappearance / Armor | 作祟揭秘者左侧玩家 | `source-mapped-contract-pending` | 建子账本 |
| 26 | The Family's Blessing | A Mysterious Invitation / Holy Symbol | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 27 | Words from the Stars | Cursed! / Mask | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 28 | We're Going to Need a Bigger House | Paranormal Investigators / Idol | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 29 | A Beautiful Garden | For Sale / Ring | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 30 | 'Til Death Do Us Part | A Strange Disappearance / Ring | 最低神志，排除作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 31 | A Ghost of a Chance | Paranormal Investigators / Holy Symbol | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 32 | The Catastrophe | Paranormal Investigators / Skull | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 33 | Smile for the Camera | NONE / Say Cheese | 见事件 | `representative-only` | 回填完整合同 |
| 34 | Down the Hall, Second | A Strange Disappearance / Idol | 最高知识 | `source-mapped-contract-pending` | 建子账本 |
| 35 | Space Slugs | A Strange Disappearance / Skull | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 36 | Finding Peace | For Sale / Holy Symbol | 最低神志 | `source-mapped-contract-pending` | 建子账本 |
| 37 | Out of Body | A Mysterious Invitation / Armor | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 38 | The Sinister Soiree | A Mysterious Invitation / Ring | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 39 | Hive Mind | Cursed! / Book | 最高知识，排除作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 40 | Return of the Fleshwalkers | For Sale / Mask | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 41 | A God in the Machine | For Sale / Idol | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 42 | Snack Attack | Paranormal Investigators / Dog | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 43 | Hide and Eat | A Strange Disappearance / Dog | 持有预兆最多 | `source-mapped-contract-pending` | 建子账本 |
| 44 | A Missing Seam | A Strange Disappearance / Mask | 作祟揭秘者左侧玩家 | `source-mapped-contract-pending` | 建子账本 |
| 45 | An Audacious Debut | A Mysterious Invitation / Book | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 46 | Ghost Hair | Cursed! / Skull | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 47 | A Knight to Remember | Paranormal Investigators / Armor | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 48 | Don't Upset the Host! | A Mysterious Invitation / Skull | 最高力量 | `source-mapped-contract-pending` | 建子账本 |
| 49 | Terms and Conditions | For Sale / Dagger | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |
| 50 | The Taste of Flesh and Metal | Cursed! / Armor | 作祟揭秘者 | `source-mapped-contract-pending` | 建子账本 |

## 3. 目录级禁止项

- 禁止把 `representative-only` 的作祟写成完整支持。
- 禁止只根据本索引的标题 / 触发条件实施作祟；必须读对应英雄书和叛徒书正文。
- 禁止只录英雄书或只录叛徒书，除非该作祟规则确认为无叛徒或自由混战且来源本身只在一本书。
- 禁止忽略 OCR 异常：大小写、换行、`Holy Symbol`、`Ring`、编号粘连、标题粘连都必须在子账本里人工核对。

