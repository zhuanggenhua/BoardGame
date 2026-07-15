# 召唤师战争莫古重核录入与漏审复盘

- 日期：2026-07-14
- 范围：召唤师战争新派系莫古全卡重核录入准备与线上反馈归因
- 当前结论等级：当前代码验证口径已收口；未代表已部署到生产
- 当前状态：已完成 slot 0-10 完整单卡主裁图核录入和 slot 11-15 空槽合同；已修正静态配置字段、聚焦领域测试和莫古真实入口 E2E；线上反馈点名链路均有等价最小复现与真实入口验证；2026-07-15 追加效果审计发现并修复畸形巨怪“最终形态”缺少指定 5+ 充能菌化野兽门禁的问题，新增领域回归与真实入口 E2E；当前树 isolated 聚合复跑莫古整文件 E2E 12/12 通过；线上莫古相关反馈 2 条已回写为 `resolved`

## 审计范围

| 范围层级 | 本轮覆盖 | 当前状态 |
| --- | --- | --- |
| 录入对象全集 | 莫古 `cards.jpg` slot 0-10 共 11 张卡；slot 11-15 空白占位 | S0 合同已锁 |
| 静态配置入口 | `src/games/summonerwars/config/factions/mogu.ts` 中英雄、士兵、事件牌字段 | S1 静态修正已完成 |
| 行为测试入口 | `src/games/summonerwars/__tests__/abilities-mogu.test.ts`、`src/games/summonerwars/__tests__/factions.test.ts` | L2 聚焦测试通过；2026-07-15 当前树 45/45 通过 |
| 真实入口夹具 | `e2e/summonerwars/summonerwars-mogu.e2e.ts` 的莫古阶段/费用夹具 | 已去掉旧假 `event` 阶段；2026-07-15 当前树 isolated 聚合复跑 12/12 通过，覆盖畸形巨怪最终形态、命令横向额外攻击、腐坏到爆裂/菌化变异、感染替换等关键链路 |
| 旧证据回写 | `evidence/summonerwars/summonerwars-mogu-full-implementation-2026-07-12.md` | 已降级为旧结论失效 |
| 线上反馈状态回写 | 莫古相关反馈 `6a55a4c8f48e169cd48103cc`、`6a55df19f48e169cd4810561` | 已通过生产 Mongo 真实数据源回写为 `resolved`，并通过线上 HTTP 列表回读确认 |
| 未覆盖范围 | 生产环境部署 | 本文证明当前代码、测试、审计证据与线上反馈状态已收口；生产部署仍需发布流程另行证明 |

## 全面审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | passed | `逐卡字段合同表` 覆盖 slot 0-10 莫古对象；slot 11-15 空槽单列不生成运行时对象 |
| 规则子句表 | passed | 每个对象拆出 C1/C2/C3 等原子子句，含时机、目标、主效果、替代入口、例外和清理 |
| 完整技能流程矩阵 | passed | `当前实现对照`、`L0-L4 层级矩阵`、`D 维度命中记录` 写清触发前条件、执行入口、主效果、分支/否定和后续清理 |
| L0-L4 证据层级 | passed | L0 图源、L1 静态配置、L2 领域测试、L3 真实入口 E2E、L4 阶段/死亡/替换收口均已登记 |
| 命中 D 维度 | passed | D1/D3/D5/D8/D12/D14/D18/D23/D52 已登记到 `D 维度命中记录` |
| 真实入口 E2E 与截图核验 | passed | 莫古整文件当前树 isolated 聚合复跑 12/12 通过；截图由 `summonerwars-mogu.e2e.ts` 写入 `test-results/evidence-screenshots/summonerwars/` |
| 残余范围声明 | passed | `审计范围` 与 `当前边界` 明确生产部署不在本文证明范围内；本地代码/测试/evidence/反馈状态已收口 |
| 旧 evidence / 旧结论对账回写 | passed | `旧结论失效记录` 已回写 `summonerwars-mogu-full-implementation-2026-07-12.md` 的旧收口失效原因与当前替代入口 |

## 旧结论失效记录

| 项 | 结论 |
| --- | --- |
| 旧结论 | `evidence/summonerwars/summonerwars-mogu-full-implementation-2026-07-12.md` 曾写莫古对象级审计按当前发布口径收口 |
| 失效原因 | 线上反馈和完整单卡主裁图复核推翻了旧录入字段与旧代表链证据：费用、战力、事件阶段、事件类型、跨阶段消费、额外攻击后消灭和死亡替换收口均存在漏项 |
| 当前替代入口 | 本文档的逐卡字段合同表、L0-L4 层级矩阵、当前实现对照、修正表、莫古真实入口 E2E 与 2026-07-15 新增畸形巨怪最终形态 E2E；旧文档只保留为历史快照 |
| 降级后当前状态 | 旧结论失效；当前以本文档为新收口证据，支撑 S0/S1/L2/L3/L4 当前代码验证口径 |

## 前提锁定

| 项 | 当前结论 |
| --- | --- |
| 问题对象 | 莫古新派系：托恩、共生自愈、命令、玛硕达、菌袍疫病体等已被线上反馈点名；同图集其他卡一并进入重核清单 |
| 真相来源 | 主真相源为 `public/assets/i18n/zh-CN/summonerwars/hero/mogu/cards.jpg`；旧代码、旧测试、旧 evidence 只能作为对照源 |
| 目标入口 | 当前仓库 `D:\gongzuo\webgame\BoardGame`，运行配置入口为 `src/games/summonerwars/config/factions/mogu.ts` 与莫古机制链路 |
| 验收口径 | 录入层必须有完整单卡主裁图和字段合同；机制层必须证明最终棋盘状态、阶段收口、死亡替换和负向路径 |

## 单卡主裁图清单

- 主真相源：`public/assets/i18n/zh-CN/summonerwars/hero/mogu/cards.jpg`
- 主图尺寸：8088x1454
- 主图 SHA256：`3492708C7039DAAFB454E8E1C4A4D3E2917256ACDD58F84D73773D3BA0E7A985`
- 裁图方式：按 8 列 x 2 行，每格 1011x727，从主真相源直接裁完整单卡；未使用降采样图定稿字段。
- 裁图目录：`temp/summonerwars-mogu-reentry-2026-07-14/`

| slot | 裁图文件 | 尺寸 | 大小 |
| ---: | --- | ---: | ---: |
| 0 | `00-托恩.jpg` | 1011x727 | 172522 |
| 1 | `01-命令.jpg` | 1011x727 | 233107 |
| 2 | `02-共生自愈.jpg` | 1011x727 | 246536 |
| 3 | `03-枯萎法师.jpg` | 1011x727 | 244477 |
| 4 | `04-狂热菌菇.jpg` | 1011x727 | 222752 |
| 5 | `05-畸形巨怪.jpg` | 1011x727 | 246654 |
| 6 | `06-鲜血萨满.jpg` | 1011x727 | 243760 |
| 7 | `07-玛硕达.jpg` | 1011x727 | 254259 |
| 8 | `08-释放菌袍.jpg` | 1011x727 | 225434 |
| 9 | `09-菌化野兽.jpg` | 1011x727 | 270521 |
| 10 | `10-菌袍疫病体.jpg` | 1011x727 | 286751 |
| 11 | `11-空白占位.jpg` | 1011x727 | 6701 |
| 12 | `12-空白占位.jpg` | 1011x727 | 5723 |
| 13 | `13-空白占位.jpg` | 1011x727 | 5677 |
| 14 | `14-空白占位.jpg` | 1011x727 | 5802 |
| 15 | `15-空白占位.jpg` | 1011x727 | 5796 |

### 裁图 SHA256 留档

| slot | 裁图文件 | SHA256 |
| ---: | --- | --- |
| 0 | `00-托恩.jpg` | `54DCAF594B2FB5E41F006C9D94A4184AB0EC765895D595CC0ACD981B06B9A4B9` |
| 1 | `01-命令.jpg` | `15DE89A38472A7F15A4C6B8C6CD183AAA0DF864029EBE0CC53CAAB8EA5472222` |
| 2 | `02-共生自愈.jpg` | `DA82675972461D01E36D3AB5905ED14DFAD187A55C455C5FE1805357D11B99F9` |
| 3 | `03-枯萎法师.jpg` | `6B0E57B3CF52C84DF27B0F8EA30B0ED114D9FC15BB6BB735F8E42DAB3A872F7C` |
| 4 | `04-狂热菌菇.jpg` | `97429D8B23CC37E5EBD0A1978A5BE1CAD273F4BD059438E8E6FCEB9F66DE5A40` |
| 5 | `05-畸形巨怪.jpg` | `A0E50AC2013C92220DF5531A89EF94C0AAD80C886A80EDA4C60B165ADD705DAE` |
| 6 | `06-鲜血萨满.jpg` | `0EC909B4A8F808E0B43BD98FD19C0C395F6413DF69672EA5FC11DA59CB70161D` |
| 7 | `07-玛硕达.jpg` | `36FEBB14E87824F5801E9ABDEB6318BC968A480CC69C2824291DD0CB9349EA7B` |
| 8 | `08-释放菌袍.jpg` | `8717AF94BBD9CB67FE37A6C3D020904AB94686F9D406B396C53E5C359C004E66` |
| 9 | `09-菌化野兽.jpg` | `80BA51360BB060510C25A39FDE51104FDB5AD901F392179D81C417153D93975B` |
| 10 | `10-菌袍疫病体.jpg` | `7400826CE70882E8909450DE6D4E6EFA1297139E93EEB34CD599DBCFB56C01EE` |
| 11 | `11-空白占位.jpg` | `5B2605C1DD070D1918DE817814680F4C0C9EC7D98ECA85A2BFA94E8CF6054CCB` |
| 12 | `12-空白占位.jpg` | `07972AA5A54F4E18EFA1F8515A64D2746D6BAF2F13F1C8095D4316A2CDC07AA8` |
| 13 | `13-空白占位.jpg` | `F06D9F48C2A6421C20BDB34B4C2EE14A5086EF0F1BDE8281154773B644CE5FAA` |
| 14 | `14-空白占位.jpg` | `FCF21CB4D6EBD5088E0A40F913CE9B14A8AD9DD1395BB6D9CC4E011ABCB9797D` |
| 15 | `15-空白占位.jpg` | `7FEA46F37EFAC1C024DA3AE08A74A576075648E0018E9306598971D555588A37` |

## 逐卡字段合同表

> 本表只使用完整单卡主裁图锁定字段；旧代码、旧测试、旧 evidence 只作为对照源。slot 11-15 只作为图集空槽合同，不生成运行时对象。

| slot | 对象 | 运行时 id | 类型 | 费用 | 战力 | 生命 | 阶段/触发时机 | 目标范围 | 规则原文/能力原文 | 原子子句 | 合同状态 |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 0 | 托恩 | `mogu-tuo-en` | 英雄单位・菌化矮人 | 6 | 2 | 7 | 血腥狂怒：你的回合内单位被消灭；回合结束移除充能；力量强化：常驻战力修正 | 本单位 | 血腥狂怒：每当一个单位在你的回合中被消灭时，将本单位充能。在你的回合结束时，从本单位上移除2点充能。力量强化：本单位每有1点充能，则获得战力+1，至多为+5。 | C1 单位在你的回合中被消灭时本单位 +1 充能；C2 你的回合结束从本单位移除 2 充能；C3 每 1 充能 +1 战力；C4 战力加成最多 +5 | locked |
| 1 | 命令 | `mogu-command` | 传奇事件・攻击阶段 | 0 | N/A | N/A | 攻击阶段打出；额外攻击完成后再消灭目标 | 你的召唤师 3 个区格以内的一个友方士兵 | 指定你的召唤师3个区格以内的一个友方士兵为目标。目标可以进行一次额外的攻击。然后将目标消灭。 | C1 选择召唤师 3 格内友方士兵；C2 目标可进行一次额外攻击；C3 额外攻击完成后消灭目标；C4 打出事件时目标不应立即死亡 | locked |
| 2 | 共生自愈 | `mogu-symbiotic-self-healing` | 普通事件・移动阶段 | 0 | N/A | N/A | 移动阶段打出 | 任意数量已受伤害的友方士兵和英雄 | 指定任意数量已受伤害的友方士兵和英雄为目标。从每个目标上移除1点伤害，并且将每个目标充能。 | C1 可选任意数量目标；C2 目标必须是已受伤友方士兵或英雄；C3 每个目标移除 1 伤害；C4 每个目标 +1 充能；C5 空选不改变场上单位 | locked |
| 3 | 枯萎法师 | `mogu-withering-mage` | 士兵单位・菌化矮人 | 2 | 4 | 3 | 每回合一次，你的移动阶段主动 | 本单位 2 个区格以内一个友方单位 | 鲜血灌注：每回合一次，在你的移动阶段，可以指定本单位2个区格以内的一个友方单位为目标。将目标充能，然后对目标造成1点伤害。 | C1 每回合一次；C2 移动阶段；C3 选择 2 格内一个友方单位；C4 目标 +1 充能；C5 然后目标受 1 伤害 | locked |
| 4 | 狂热菌菇 | `mogu-fanatical-fungus` | 普通事件・召唤阶段・持续 | 0 | N/A | N/A | 召唤阶段打出为持续事件；之后在你移动一个单位后触发 | 刚移动的单位；可推拉 1 个区格 | 持续。在你移动一个单位之后，可以将其充能。如果你这样做，首先你可以将其推拉1个区格，然后你必须对其造成1点伤害。 | C1 持续事件；C2 在你移动一个单位之后可选择将其充能；C3 若充能，可先推拉 1 格；C4 然后必须对其造成 1 伤害；C5 可不执行该可选效果 | locked |
| 5 | 畸形巨怪 | `mogu-malformed-giant` | 英雄单位・菌化矮人 | 3 | 5 | 13 | 召唤本单位支付费用时 | 你控制的 5+ 充能友方菌化野兽 | 最终形态：当你为召唤本单位支付费用时，还必须消灭一个具有5点或更多充能的友方菌化野兽，并且使用本单位替换被消灭的单位。 | C1 召唤并支付费用时触发；C2 必须消灭一个 5+ 充能友方菌化野兽；C3 本单位替换被消灭单位的位置；C4 召唤原目标格不应额外放置本单位 | locked |
| 6 | 鲜血萨满 | `mogu-blood-shaman` | 士兵单位・菌化矮人 | 1 | 3 | 2 | 本单位移动之后 | 本单位 2 个区格以内一个或两个友方单位 | 传输：在本单位移动之后，可以指定其2个区格以内的一个或两个友方单位为目标。将任意数量充能从本单位移动到一个目标上，或从一个目标移动到另一个目标上。 | C1 本单位移动之后可触发；C2 选择 2 格内一个或两个友方单位；C3 可从本单位转移任意数量充能到一个目标；C4 或从一个目标转移到另一个目标；C5 0 充能路径不得改变状态 | locked |
| 7 | 玛硕达 | `mogu-ma-shuo-da` | 英雄单位・菌化矮人 | 3 | 3 | 8 | 你的移动阶段结束时 | 自身；若仍在场，相邻一个友方单位 | 腐坏：在你的移动阶段结束时，对本单位造成1点伤害。如果本单位依然在场上，则你可以指定一个相邻友方单位为目标。将2点充能放置到目标上。 | C1 移动阶段结束时自身受 1 伤害；C2 若本单位依然在场才继续；C3 可选择相邻友方单位；C4 目标获得 2 充能；C5 自伤死亡时不应继续给充能 | locked |
| 8 | 释放菌袍 | `mogu-release-spores` | 传奇事件・魔力阶段 | 0 | N/A | N/A | 魔力阶段打出 | 你的弃牌堆至多两张疫病体单位；你的召唤师相邻区格 | 从你的弃牌堆中拿取至多两张疫病体单位，放置到你的召唤师相邻的区格。 | C1 从你的弃牌堆拿取；C2 至多两张疫病体单位；C3 放到你的召唤师相邻区格；C4 可少选/空选；C5 被拿取单位必须从弃牌堆移除 | locked |
| 9 | 菌化野兽 | `mogu-fungal-beast` | 士兵单位・菌化矮人 | 3 | 3 | 5 | 感染：本单位消灭一个单位之后；寄生：你的攻击阶段结束时 | 感染目标为被消灭单位；寄生目标为本单位 | 感染：在本单位消灭一个单位之后，你可以使用你的弃牌堆中一个疫病体单位替换被消灭的单位。寄生：在你的攻击阶段结束时，消耗1点充能，或者对本单位造成1点伤害。 | C1 本单位消灭单位后可触发感染；C2 使用弃牌堆一个疫病体单位替换被消灭单位；C3 攻击阶段结束时优先消耗 1 充能；C4 没有充能时本单位受 1 伤害；C5 替换来源只消耗一次 | locked |
| 10 | 菌袍疫病体 | `mogu-spore-plague-body` | 士兵单位・菌化矮人 | 0 | 2 | 2 | 爆裂：你的魔力阶段结束时；菌化变异：本单位被消灭之后 | 本单位；弃牌堆一个菌化野兽 | 爆裂：在你的魔力阶段结束时，如果本单位具有3点或更多充能，则将其消灭。菌化变异：如果本单位具有3点或更多充能，则在本单位被消灭之后，如果可能，使用你的弃牌堆中一个菌化野兽替换本单位。 | C1 魔力阶段结束时检查 3+ 充能；C2 满足时消灭本单位；C3 3+ 充能的本单位被消灭后可菌化变异；C4 若可能用弃牌堆一个菌化野兽替换本单位；C5 2 充能不应爆裂；C6 替换来源只消耗一次 | locked |
| 11-15 | 空白占位 | N/A | 图集空槽 | N/A | N/A | N/A | N/A | N/A | 完整单卡裁图显示为空白/无卡面对象；运行时不得消费为空卡对象 | C1 不生成卡牌定义；C2 不进入牌组；C3 不进入 UI 可选卡 | locked |

## 线上反馈分类

| 反馈对象 | 用户症状 | 当前归因 | 原因 |
| --- | --- | --- | --- |
| 托恩 | 费用应该是 6，但当前只要 1/旧录入不是 6 | 录入问题 | 当前代码已将托恩费用修为 6；旧证据显示静态录入曾依赖低分辨率 contact sheet，费用字段未按完整单卡主裁图锁定 |
| 共生自愈 | 显示只有召唤阶段可用，实际是移动阶段事件 | 录入问题 | 当前代码已将事件牌使用阶段修为移动阶段；旧录入阶段字段错误 |
| 腐坏 | 移动阶段结束自伤后若仍在场，应给相邻友方 2 充能，但未触发爆裂后续 | 机制/时序消费问题 | 腐坏本体是移动阶段结束触发；漏点是“充能写入后，后续魔力阶段结束的爆裂消费链”没有被旧审计打穿 |
| 爆裂/菌化变异 | 魔力阶段结束时 3+ 充能应消灭，并进入菌化替换链 | 机制/时序消费问题 | 旧审计停在阶段/死亡代表链，没有覆盖“腐坏加到 3 -> 后续魔力阶段结束 -> 爆裂 -> 菌化变异替换”的完整链 |
| 命令 | 友方士兵额外攻击后才消灭；横排攻击打不出来 | 机制/攻击收口问题 | 旧实现把目标在打出命令时立即消灭，导致没有额外攻击窗口；横排攻击属于额外攻击后的真实攻击合法性/收口验证缺口 |
| 对面死亡卡住变成菌化疫病体阶段 | 死亡替换阶段卡住 | 机制/死亡替换收口问题 | 当前已用真实攻击击杀后感染替换 E2E 覆盖：被消灭敌方位置替换为菌袍疫病体，弃牌堆来源移除，交互/阶段无残留 |

## 2026-07-15 追加效果审计发现

| 对象 | 新发现 | 根因类型 | 修复与证据 |
| --- | --- | --- | --- |
| 畸形巨怪・最终形态 | 旧审计只证明“存在 5+ 充能菌化野兽时能替换”，没有覆盖“没有指定合法菌化野兽时不得普通召唤”和“多个候选时必须替换玩家指定对象”。当前旧实现会在没有候选时按普通召唤格登场，有多个候选时自动取第一个。 | 实现/交互门禁漏审，不是录入字段错误 | `validate.ts` 增加 5+ 充能友方菌化野兽门禁；`execute.ts` 改为只消费 `sacrificeUnitId` 指定的合法菌化野兽；`useCellInteraction.ts` 选中畸形巨怪时高亮 5+ 充能菌化野兽并派发指定目标；`abilities-mogu.test.ts` 增加无候选/低充能/多候选指定断言；`summonerwars-mogu.e2e.ts` 增加真实入口替换 E2E |
| 库鞭克・血腥绽放 / 托恩・血腥狂怒 | 旧领域测试用不存在于来源单位身上的“鲜血灌注”直接制造死亡，只能证明死亡后处理，不足以证明真实合法技能入口。 | 审计证据薄弱，非当前实现错误 | 测试改为由真实枯萎法师发动鲜血灌注击杀友方单位，并先断言 `ACTIVATE_ABILITY` 验证通过，再观察库鞭克/托恩死亡触发最终状态 |

## 逐项结论：莫古重核录入批次清单

> 状态含义：`s0_locked` 表示完整单卡主裁图合同已锁；`s1_static_fixed` 表示静态配置已按合同修正并有聚焦单测；`l3_l4_verified` 表示已有真实入口或最终状态/时序链证据。本文档的“收口”只指当前代码验证口径，不代表生产已部署或反馈状态已回写。

| slot | 对象 | 类型 | 重核重点 | 当前状态 |
| ---: | --- | --- | --- | --- |
| 0 | 托恩 | 英雄 | 费用、生命、战力、能力子句、回合结束衰减 | s0_locked / s1_static_fixed / l2_verified |
| 1 | 命令 | 事件牌 | 使用阶段、目标范围、额外攻击窗口、攻击后消灭 | s0_locked / behavior_fixed / l3_l4_verified_real_horizontal_attack |
| 2 | 共生自愈 | 事件牌 | 使用阶段、目标集合、任意数量/空选、治疗和充能 | s0_locked / s1_static_fixed / l3_verified_move_phase_success_and_skip |
| 3 | 枯萎法师 | 普通单位 | 费用、阶段主动、目标范围、充能与自伤 | s0_locked / s1_static_fixed / l3_verified_real_ability_button |
| 4 | 狂热菌菇 | 事件牌 | 触发时机、推拉可选、充能和自伤、移动后交互收口 | s0_locked / s1_static_fixed / l3_verified_real_after_move_push |
| 5 | 畸形巨怪 | 英雄 | 召唤替换条件、5+ 充能菌化野兽、位置继承、多个候选时指定替换 | s0_locked / s1_static_fixed / l3_verified_real_final_form_replacement |
| 6 | 鲜血萨满 | 普通单位 | 费用、移动后传输、数量选择、0 充能路径 | s0_locked / s1_static_fixed / l3_verified_real_after_move_transmission |
| 7 | 玛硕达 | 英雄 | 腐坏移动阶段结束、自伤后仍在场判断、相邻友方 +2 充能 | s0_locked / behavior_fixed / l4_verified_decay_to_burst_chain |
| 8 | 释放菌袍 | 事件牌 | 至多两张、弃牌堆来源、召唤师相邻空格、空选 | s0_locked / s1_static_fixed / l3_verified_magic_phase_success_and_skip |
| 9 | 菌化野兽 | 普通单位 | 感染、寄生、攻击阶段结束充能消耗/自伤 | s0_locked / behavior_fixed / l4_verified_real_infection_replacement |
| 10 | 菌袍疫病体 | 普通单位 | 爆裂、菌化变异、3+ 充能魔力阶段结束、死亡替换链 | s0_locked / s1_static_fixed / l4_verified_decay_burst_mutation_chain |
| 11-15 | 空白占位 | 图集占位 | 确认空槽不被运行时消费 | s0_locked_display_only / no_runtime_object |

## 当前实现对照与修正

| 对象 | 完整单卡主裁图字段 | 重核前当前代码/测试风险 | 本轮处理 |
| --- | --- | --- | --- |
| 托恩 | 费用 6、战力 2、生命 7、英雄单位、两条能力 | 当前工作区旧值曾出现费用 2/战力 6 等错误录入；只测费用不足以防止战力错录 | `mogu.ts` 修为费用 6、战力 2、生命 7；`abilities-mogu.test.ts` 新增整批静态字段断言 |
| 共生自愈 | 普通事件・移动阶段，费用 0 | 旧录入/旧 UI 显示曾为召唤阶段 | `mogu.ts` 确认为移动阶段；莫古 E2E 夹具从假 `event` 阶段改为真实 `move` 阶段 |
| 枯萎法师 | 费用 2、战力 4、生命 3、远程士兵 | 旧代码费用/战力反置为费用 4、战力 2；E2E 夹具也沿用旧费用 | `mogu.ts` 修正费用 2、战力 4；E2E 夹具同步更新 |
| 狂热菌菇 | 普通事件・召唤阶段・持续，费用 0 | 旧代码和 E2E 夹具为移动阶段，容易掩盖“可在哪一阶段打出”错误 | `mogu.ts` 修为召唤阶段；E2E 夹具中主动事件卡阶段同步为召唤阶段 |
| 畸形巨怪 | 费用 3、战力 5、生命 13；最终形态必须消灭一个 5+ 充能友方菌化野兽并替换其位置 | 旧代码费用/战力反置为费用 5、战力 3；2026-07-15 追加效果审计发现最终形态无合法牺牲目标时仍可普通召唤，多个候选时无法指定 | `mogu.ts` 修正费用 3、战力 5；`validate.ts` / `execute.ts` / `useCellInteraction.ts` 增加最终形态合法目标门禁和指定目标消费；领域测试与真实入口 E2E 已补 |
| 鲜血萨满 | 费用 1、战力 3、生命 2、远程士兵 | 旧代码费用/战力反置为费用 3、战力 1；E2E 夹具也沿用旧费用 | `mogu.ts` 修正费用 1、战力 3；E2E 夹具同步更新 |
| 释放菌袍 | 传奇事件・魔力阶段，费用 0 | 旧代码为普通事件・召唤阶段；E2E 夹具用假 `event` 阶段 | `mogu.ts` 修为传奇事件・魔力阶段；E2E 夹具从假 `event` 阶段改为真实 `magic` 阶段 |
| 菌袍疫病体 | 费用 0、战力 2、生命 2 | 旧代码费用/战力反置为费用 2、战力 0 | `mogu.ts` 修正费用 0、战力 2 |

## L0-L4 层级矩阵

| 对象/范围 | L0 图源与对象 | L1 静态配置 | L2 领域行为 | L3 真实入口 | L4 时序/治理 | 当前结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 托恩 | locked | passed：费用/战力/生命已修 | passed：回合结束衰减领域测试 | N/A：本轮反馈命中字段录入 | N/A：字段问题以完整单卡合同 + 静态断言收口 | 当前代码验证口径已收口 |
| 命令 | locked | passed：攻击阶段传奇事件 | passed：额外攻击后消灭、横向相邻攻击领域测试 | passed：真实入口横向额外攻击后再消灭 | passed：授予 -> 执行攻击 -> 攻击后消灭目标士兵 | 当前代码验证口径已收口 |
| 共生自愈 | locked | passed：移动阶段普通事件 | passed：多目标、空选、合法目标领域测试 | passed：移动阶段真实入口成功与空选 | passed：不再显示为召唤阶段；交互收口后无残留 | 当前代码验证口径已收口 |
| 枯萎法师 | locked | passed：费用/战力/生命已修 | passed：移动阶段 2 格内充能自伤 | passed：真实棋盘能力按钮 | N/A | 当前代码验证口径已收口 |
| 狂热菌菇 | locked | passed：召唤阶段持续事件已修 | passed：推拉/不推拉领域测试 | passed：真实移动后触发推拉 | passed：持续事件跨移动后交互收口 | 当前代码验证口径已收口 |
| 畸形巨怪 | locked | passed：费用/战力/生命已修；最终形态门禁已接入验证/执行/UI | passed：5+ 充能菌化野兽替换召唤、无候选/低充能拒绝、多个候选只替换指定对象 | passed：真实入口选手牌畸形巨怪、点击指定 5+ 充能菌化野兽、替换登场 | passed：未指定合法目标不消耗魔力/不离手；指定目标被替换，未选中候选保持不变 | 当前代码验证口径已收口 |
| 鲜血萨满 | locked | passed：费用/战力/生命已修 | passed：传输和 0 充能负向路径 | passed：真实移动后传输交互 | passed：选择模式 -> 目标 -> 数量 -> 状态变化 | 当前代码验证口径已收口 |
| 玛硕达 | locked | passed | passed：腐坏自伤、死亡后不充能、跨到爆裂链领域测试 | passed：真实阶段结束链 | passed：移动阶段结束 +2 充能，后续魔力阶段触发爆裂 | 当前代码验证口径已收口 |
| 释放菌袍 | locked | passed：魔力阶段传奇事件已修 | passed：弃牌堆至多两张、空选、重复打出负向路径 | passed：魔力阶段真实入口成功与空选 | passed：弃牌堆来源移除、召唤师相邻放置、无残留交互 | 当前代码验证口径已收口 |
| 菌化野兽 | locked | passed | passed：感染替换、寄生消耗/自伤、来源移除 | passed：真实攻击击杀后替换敌方 | passed：菌袍疫病体从弃牌堆移除，阶段/交互无残留 | 当前代码验证口径已收口 |
| 菌袍疫病体 | locked | passed：费用/战力/生命已修 | passed：爆裂、菌化变异、2 充能负向、来源移除 | passed：真实阶段结束链 | passed：3+ 充能魔力阶段结束消灭并菌化变异替换 | 当前代码验证口径已收口 |
| slot 11-15 空槽 | locked | passed：无运行时对象 | N/A | N/A | N/A | 空槽合同完成 |

## D 维度命中记录

| 维度 | 本轮命中对象 | 审计问题 | 当前证据 |
| --- | --- | --- | --- |
| D1 语义保真 | 托恩、共生自愈、命令、玛硕达、菌袍疫病体、鲜血萨满 | 中文卡面字段和实现语义是否一致，尤其是费用、阶段、然后/之后、目标限制 | 逐卡字段合同表 + `mogu.ts` 静态字段修正 + `abilities-mogu.test.ts` 领域断言 |
| D3 数据流闭环 | 命令、共生自愈、释放菌袍、鲜血萨满、狂热菌菇 | 定义、UI 可打出态、命令、执行、状态、测试是否闭环 | `mogu.ts`、`validate.ts`、`eventCards.ts`、`systems.ts`、`useEventCardModes.ts`、莫古真实入口 E2E |
| D5 交互完整 | 共生自愈、命令、释放菌袍、鲜血萨满、狂热菌菇、畸形巨怪 | 玩家选择入口是否真实存在，目标/空选/数量选择是否能完成 | 移动阶段共生自愈成功与空选、命令横向额外攻击、魔力阶段释放菌袍成功与空选、鲜血萨满传输、狂热菌菇推拉、畸形巨怪最终形态选择指定菌化野兽 E2E |
| D8 时序正确 | 命令、玛硕达、菌袍疫病体、菌化野兽 | 打出时、攻击完成后、移动阶段结束、魔力阶段结束、死亡后替换的顺序是否正确 | 命令授予额外攻击后再消灭；玛硕达腐坏写入充能后跨到魔力阶段爆裂；菌化野兽击杀后感染替换 E2E |
| D12 写入-消耗对称 | 命令、玛硕达、菌袍疫病体、释放菌袍 | 额外攻击标记、充能、弃牌堆来源是否被后续消费者正确读取和消耗 | `destroyAfterExtraAttackSource` 写入后由攻击收口消费；腐坏 +2 充能由爆裂消费；释放菌袍/感染替换检查弃牌堆来源移除 |
| D14 回合/阶段清理完整 | 命令、腐坏/爆裂、感染替换 | 交互和阶段推进后是否留下残留状态 | E2E 断言 `sys.interaction.current` 清空、阶段可继续、目标移除或替换完成 |
| D18 否定路径 | 命令、共生自愈、玛硕达、菌袍疫病体、鲜血萨满、释放菌袍、畸形巨怪 | 不该发生的路径是否锁住 | 命令打出时目标不立即死；共生自愈空选不改场；玛硕达自伤死亡后不给充能；2 充能不爆裂；鲜血萨满 0 充能不改状态；释放菌袍空选不错误放置；畸形巨怪无合法 5+ 菌化野兽时不应普通召唤、不应扣魔力或离手 |
| D23 架构假设一致性 | 命令横排攻击、阶段结束按钮 | 通用攻击合法性和 UI 阶段结束入口是否阻止特殊机制 | 横排相邻攻击 validate + 真实入口 E2E 通过；阶段结束按钮走 `SW_COMMANDS.END_PHASE` 后触发阶段结束效果 |
| D52 权威可视合同一致性 | 莫古 `cards.jpg` slot 0-15 | 图片直接可判定字段是否被完整登记，空槽是否被误消费 | 完整单卡主裁图、SHA256、slot 11-15 空槽合同、逐卡字段合同表 |

## 代表链判等依据

| 代表链口径 | 代表对象 | 判等依据 | 本轮裁定 |
| --- | --- | --- | --- |
| 旧阶段/死亡代表链 | 旧 evidence 曾用自动/被动对象按阶段、死亡、回合系统测试代表莫古自动链 | 线上反馈证明代表链没有覆盖腐坏加到 3 后的后续魔力阶段消费、爆裂替换、对面死亡替换卡住、命令额外攻击后收口 | 旧代表链判等失效；本轮不得用代表链宣称整批收口 |
| 新静态字段链 | slot 0-10 每张完整单卡主裁图 | 费用、战力、生命、阶段、事件类型均逐卡独立读取；没有用兄弟对象外推 | 支撑 S0/S1 字段锁定 |
| 新真实入口链 | 莫古 E2E 当前树整文件 12 条 + isolated 关键链路补验 | 直接覆盖选派系、枯萎法师、共生自愈、命令、腐坏到爆裂/菌化变异、菌化野兽感染替换、畸形巨怪最终形态、释放菌袍、鲜血萨满、狂热菌菇；最新当前树 isolated 聚合复跑 12/12 通过 | 支撑本轮反馈命中链路 L3/L4 收口 |

## 共享根因与生产外边界

| 漏审维度 | 实际问题 | 应固化的不变量 |
| --- | --- | --- |
| 录入真相源 | 费用和阶段字段没有回到完整单卡主裁图逐项锁定，旧代码/旧测试一致性被误当成正确 | 新派系字段定稿禁止依赖 contact sheet、缩略图或降采样图；费用、阶段、生命、战力、触发时机必须由完整单卡主裁图锁定 |
| 对象全集 | 用户点名字段修复前没有把同图集全卡建成清单 | 一张卡出错时，同图集/同批次全部进入 `locked / blocked / disputed` 清单 |
| 最终权威状态 | 旧测试证明“事件写入/能力触发”，但没有证明最终血量、充能、棋盘归属、弃牌堆移除和阶段继续 | 所有“效果没触发”类 bug 必须断言最终状态，而不是只看事件或按钮 |
| 时序收口 | 腐坏和爆裂横跨移动阶段结束与魔力阶段结束；旧审计没有覆盖写入后跨阶段消费 | 阶段结束能力必须覆盖“写入 -> 后续阶段消费 -> 清理/替换 -> 阶段可继续” |
| 攻击后续 | 命令的“额外攻击后消灭”被实现成“打出事件时消灭”，旧审计没测攻击完成后的后续收口 | 带“然后/之后”的额外攻击、额外行动必须拆成授予、执行、收口三段分别验 |
| 替换/牺牲入口 | 畸形巨怪最终形态只测了“有候选时自动替换”，没测无候选拒绝、低充能拒绝、多个候选指定和真实 UI 点击承接 | 带“必须消灭一个 / 替换”的召唤类效果必须覆盖候选门禁、指定对象、失败不扣费、不按普通召唤格兜底、真实入口高亮/点击 |
| 负向路径 | 没有断言“命令打出时目标不能立即死”“玛硕达自伤死亡后不能继续给充能”“腐坏加到 3 后必须由后续魔力阶段触发爆裂” | 每个高风险对象至少补一条不该发生的断言 |

### 当前边界

| 边界项 | 本轮口径 | 后续入口 |
| --- | --- | --- |
| 生产环境部署 | 本文证明当前代码、领域测试、真实入口 E2E、evidence 门禁和反馈状态回写；不证明线上 bundle 已更新 | 由发布/部署流程另行记录目标 revision、health check 或线上版本证据 |
| 线上反馈状态回写 | 已完成：两条莫古相关线上反馈均为 `resolved`，且 `closedReason/resolvedMethod` 已补全用户可读结论 | 通过生产 Mongo 回写，随后通过 `https://api.easyboardgame.top/admin/feedback` 线上列表回读确认 |

## 规范回代

- 已回代录入规范：`.codex/skill/data-entry-workflow/SKILL.md`、`docs/ai-rules/data-entry.md` 增加“缩略图/降采样图不得定稿字段”。
- 旧莫古收口文档已降级：`evidence/summonerwars/summonerwars-mogu-full-implementation-2026-07-12.md`。
- 后续重核录入必须先裁完整单卡主裁图到 `temp/**`，再把每张卡标成 `locked / blocked / disputed`；不能直接靠本文件把录入视为完成。

## 线上反馈回写证据

| 反馈内容 | 反馈 ID | 回写前状态 | 回写后状态 | 回写结论 |
| --- | --- | --- | --- | --- |
| 魔力费用显示出错，怪物召唤不出 | `6a55a4c8f48e169cd48103cc` | `resolved`，说明只覆盖托恩、共生自愈、命令，未覆盖腐坏、爆裂/菌化变异、死亡替换和鲜血萨满费用 | `resolved` | 已补全为莫古整批费用、阶段和结算链路：托恩费用 6、鲜血萨满费用 1、共生自愈移动阶段、命令额外攻击后消灭、腐坏到爆裂/菌化变异、感染替换均已验证 |
| 鲜血萨满魔力值出错，需要 3 魔力才能打出 | `6a55df19f48e169cd4810561` | `closed`，旧理由误写“鲜血萨满费用是 3” | `resolved` | 已按完整卡图复核并修正：鲜血萨满费用是 1，不是 3；2 点魔力可以召唤鲜血萨满，移动后的充能传输链路已通过回归验证 |

- 真实写入口：生产机 Mongo `feedbacks` 集合；使用 SSH 管道执行 `mongosh boardgame`，只更新上述两条反馈的 `status / closedReason / resolvedMethod / updatedAt`。
- 回读入口：`https://api.easyboardgame.top/admin/feedback` 线上 HTTP 列表；两条记录均回读为 `resolved`，更新时间 `2026-07-14T19:08:09.844Z`。
- 说明：本轮不是通过 HTTP PATCH 回写，因为当前本机没有可用 `BOARDGAME_FEEDBACK_TOKEN`；按反馈收口 skill 改走生产 Mongo 真实数据源。

## Evidence 留档机器门禁

- 命令：`npm run audit:evidence -- evidence/summonerwars/summonerwars-mogu-full-implementation-2026-07-12.md evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md`
- 结果：通过；旧收口文档按“旧结论失效”口径检查，本文件按“当前代码验证口径已收口”口径检查。
- 结论：当前 evidence 支撑“旧结论已降级 + S0 逐卡合同已锁 + S1 静态配置已修 + L2 聚焦测试通过 + L3/L4 莫古真实入口 E2E 通过 + 线上莫古反馈状态已回写”；生产部署不在本文证明范围内。

## 验证证据

| 命令 | 覆盖范围 | 结果 | 结论 |
| --- | --- | --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-mogu.test.ts src/games/summonerwars/__tests__/factions.test.ts --configLoader native` | 莫古静态录入字段、莫古机制领域行为、阵营/牌组基础接入；含畸形巨怪最终形态无候选/低充能/多候选指定，血腥绽放/血腥狂怒真实死亡入口 | 2 files passed；45 tests passed | S1/S2 聚焦验证通过 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-full-current-check-2'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts` | 莫古真实入口整文件：选派系、枯萎法师、共生自愈、命令横向额外攻击、腐坏到爆裂/菌化变异、菌化野兽感染替换、畸形巨怪最终形态、释放菌袍、鲜血萨满、狂热菌菇 | 12 passed；总耗时约 10.5m | 当前工作区 isolated 聚合回归通过，支撑 L3/L4 真实入口收口 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-decay-check'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "resolves Mogu Decay into Burst and Fungal Mutation across real phase endings"` | 玛硕达腐坏 -> 菌袍疫病体爆裂 -> 菌化变异跨真实阶段结束链 | 1 passed | 用户反馈的腐坏/爆裂链 isolated 真实入口通过 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-rest-check'; node scripts/infra/run-e2e-command.mjs default e2e/summonerwars/summonerwars-mogu.e2e.ts --grep "replaces a destroyed enemy\|plays Mogu Release Spores\|resolves Blood Shaman\|resolves Fanatical Fungus"` | 菌化野兽击杀后感染替换、释放菌袍成功/空选、鲜血萨满移动后传输、狂热菌菇移动后推拉 | 5 passed | 用户反馈的死亡替换链与剩余真实入口关键链路 isolated 批量通过 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-blood-shaman-current-check'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "resolves Blood Shaman Transmission after a real move interaction"` | 鲜血萨满当前真实入口：费用修正后的棋盘状态、真实移动后传输交互 | 1 passed | 当前工作区验证通过；对应线上鲜血萨满费用反馈已从错误关闭改为 `resolved` |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-decay-current-check'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "resolves Mogu Decay into Burst and Fungal Mutation across real phase endings"` | 玛硕达腐坏 -> 菌袍疫病体爆裂 -> 菌化变异跨真实阶段结束链当前复跑 | 1 passed | 当前工作区验证通过；覆盖用户点名“腐坏/爆裂没触发”链路 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-command-current-check'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "plays Mogu Command and resolves a horizontal extra attack before destroying the target"` | 命令当前真实入口：攻击阶段打出、选择友方士兵、横向相邻敌方单位可被攻击、攻击后命令目标被消灭且交互清空 | 1 passed | 当前工作区验证通过；E2E 验证用户链路和最终状态，固定骰面伤害值由领域测试覆盖 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-infection-current-check'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "replaces a destroyed enemy with Spore Plague Body after a real Fungal Beast attack"` | 菌化野兽当前真实入口：真实攻击击杀敌方单位后，敌方位置替换成我方菌袍疫病体，弃牌堆来源移除，交互/阶段无残留 | 1 passed | 当前工作区验证通过；覆盖用户点名“对面死亡卡在变成菌化疫病体阶段”链路 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-final-form-current-check'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "summons Malformed Giant by replacing the chosen 5-charge Fungal Beast from the real board entry"` | 畸形巨怪当前真实入口：手牌选中畸形巨怪，棋盘高亮 5+ 充能菌化野兽，点击指定目标后替换登场，另一只候选保持不变，魔力正确扣除 | 1 passed；截图：`test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/summons-Malformed-Giant-by-replacing-the-chosen-5-charge-Fungal-Beast-from-the-real-board-entry/mogu-final-form-targets-highlighted.jpg`、`.../mogu-final-form-resolved.jpg` | 当前工作区验证通过；覆盖追加审计发现的最终形态真实入口链 |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-full-current-check'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts` | 莫古 E2E 整文件当前树聚合回归第一次尝试 | 第一次尝试超出命令窗口；随后用 `mogu-full-current-check-2` 同一整文件命令完成复跑 | 记录中间执行事实；最终结论以上方 12/12 通过为准 |
| `npm run audit:evidence -- evidence/summonerwars/summonerwars-mogu-full-implementation-2026-07-12.md evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md` | 旧结论失效回写、新 evidence 留档结构、L0-L4、生产外边界 | checked files: 2；audit docs: 2；OK | 留档门禁通过 |
| 生产 Mongo 回写 + 线上 HTTP 列表回读 | 莫古相关反馈 `6a55a4c8f48e169cd48103cc`、`6a55df19f48e169cd4810561` | 两条均回读为 `resolved`；`closedReason/resolvedMethod` 已补全 | 线上反馈状态回写完成 |

## 下一步执行清单

1. 已完成：slot 0-10 字段表，包含名称、类型、费用、战力、生命、阶段、目标范围、触发时机、规则原文、原子子句、运行时 id、图集 slot。
2. 已完成：slot 11-15 空槽合同，当前不生成运行时对象。
3. 已完成：逐卡状态已写为 `locked` 或 `locked_display_only`，并已进入实现对照。
4. 已完成：更新后的莫古真实入口 E2E 在 2026-07-15 当前树 isolated 聚合复跑 12/12 通过，覆盖共生自愈移动阶段、释放菌袍魔力阶段、狂热菌菇持续事件、鲜血萨满移动后传输、命令横向额外攻击、腐坏到爆裂/菌化变异、感染替换和畸形巨怪最终形态。
5. 已完成：命令、腐坏、爆裂/菌化变异、感染替换均已补 L4 真实入口或等价最小链路，覆盖最终状态、跨阶段消费、死亡替换、弃牌堆来源移除、阶段/交互无残留。
6. 已完成：线上莫古相关反馈状态已回写并通过线上 HTTP 列表回读确认。
7. 本轮未覆盖：生产部署状态；必须由发布流程另行留档，不能由本地 evidence 冒充。
