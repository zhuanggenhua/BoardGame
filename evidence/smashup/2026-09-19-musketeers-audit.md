# 大杀四方火枪手对象级规则审计

## 基本信息

- 对象：火枪手 `musketeers`
- 日期：2026-09-19
- 文档类型：`audit`
- 主真相源：`src/games/smashup/data/factions/international_incident.ts`、`public/locales/zh-CN/game-smashup.json`
- 实现消费源：`src/games/smashup/abilities/international_incident.ts`、Smash Up 共享行动 / 触发 / 交互链
- 对照 evidence：`evidence/smashup/2026-07-15-international-incident-effect-atom-matrix.md`、`evidence/smashup/2026-09-18-international-incident-audit.md`
- 目标入口 / 环境：Smash Up 领域测试、真实浏览器牌桌入口；本地 E2E 测试环境 6174 / 20000 / 21000。

## 审计范围

本轮锁定火枪手 14 张唯一卡牌和 2 张基地，共 16 个对象。审计覆盖静态接入、规则消费、目标 / 权限 / 可选路径、最终权威状态、真实入口和生命周期清理；不把远端 R2 / CDN 发布链当作本地玩法正确性的替代证据。

对象全集：

`musketeers_on_a_roll`、`musketeers_make_way`、`musketeers_en_garde`、`musketeers_biding_time`、`musketeers_to_battle`、`musketeers_one_for_all`、`musketeers_last_stand`、`musketeers_all_for_one`、`musketeers_token_of_affection`、`musketeers_porthos`、`musketeers_athos`、`musketeers_young_musketeer`、`musketeers_dartagnan`、`musketeers_aramis`、`base_bastion_saint_gervais`、`base_the_golden_lily`。

## 结论等级

结论等级：`当前对象范围已收口；批次整体仍有残余`。

- 16 个对象的静态定义、注册入口、领域实现消费和最终权威状态已逐项核对。
- 领域行为测试本轮与前序火枪手修复合计 53 条通过；静态资源合同测试 5 条通过。
- 真实入口已覆盖火枪手的额外行动、直接影响随从、附着、计分前 special、反应窗口和两座基地的代表流程；多段选择均按“出现交互 -> 玩家选择 -> 下一段交互 / 结算”验证。
- 本轮列出的 4 个对象级独立浏览器 direct E2E 缺口已全部补齐：Porthos、Athos、D'Artagnan 和黄金百合花回合结束抽牌均已从真实入口完成保护过滤、直接影响触发、抽牌、额外行动和流程清理验证。其它对象仍可能有更复杂组合的扩展覆盖空间，但不再作为本轮缺口；批次残余仅是共享基线与远端资源链。
- 本轮真实入口曾两次超时，均为测试漏走玩家选择，不是基地能力自身失败：`廉价欢呼` 后漏选己方随从，`团队标记` 后漏选打出基地；补齐后圣热尔韦堡垒用例通过。

## 权威来源

- 静态卡牌 / 基地定义：`src/games/smashup/data/factions/international_incident.ts:30-47,114-122`。
- 中文玩家可见名称与效果：`public/locales/zh-CN/game-smashup.json:9740-9780`。
- 运行时注册和 handler：`src/games/smashup/abilities/international_incident.ts:1893-2130,3054-3075,3199-3279,3436-3495`。
- 既有原子矩阵：`evidence/smashup/2026-07-15-international-incident-effect-atom-matrix.md:49-64`。
- 合同状态：`locked`。本轮另修正 7 个静态 fallback 名称，使其与中文 locale 一致；页面卡牌名由 locale 覆盖，但行动候选、AI 和动作计数提示仍会读取静态名称。

## 图片合同证据

- 完整单卡主裁图：`public/assets/i18n/zh-CN/smashup/cards/international_incident.png` 是本批次 7 x 8 原始卡牌 atlas，火枪手 14 张唯一卡牌对应槽位 12-25；`public/assets/i18n/zh-CN/smashup/base/international_incident_bases.png` 是 4 x 4 基地 atlas，火枪手两座基地对应槽位 8 和 13。
- 裁图清单 / crop manifest：`src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts:27-42,82-112,135-165` 核对 atlas 类型、网格尺寸、火枪手槽位范围、唯一槽位连续性和基地槽位；`src/games/smashup/data/factions/international_incident.ts` 的每个 `previewRef.index` 负责把 16 个对象映射回主裁图。
- SHA256 / 图片合同表：`public/assets/i18n/zh-CN/smashup/assets-manifest.json` 与根级 manifest 对同一文件登记相同哈希；卡牌 PNG `a04e696d6d3ab50a4fa5bdbc31c58c7385657e73ccbc36a3a7fde6ba44d3ca55`，卡牌 WebP `c106174d2e747c89c7a02b5d3855be7ecd0cd2c7ed8df82bf267b94dad0ce685`，基地 PNG `8d695587adfc6fbcc64eb845d3f70d4a2cc3135b0b53f1f9a7b9e5ee4ad9b24e`，基地 WebP `d39752ae24bd9424d3a82d82464ec834039adae31aaced437a9386ebad921931`。
- 图片合同结论：本地原图、压缩图、manifest 哈希和 atlas 槽位均通过资源合同测试；这只证明本地资源合同成立，不把远端 R2 / CDN 公开状态误算成本地规则证据。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 火枪手 14 张唯一卡牌 + 2 张基地清单，与静态数组和资源合同一致。 |
| 真相源状态 | `passed` | 静态定义、中文 locale、旧原子矩阵和运行时注册逐项对账；7 个 fallback 名称漂移已修正。 |
| 原子语义断言 | `passed` | 每个对象均记录触发时机、主体、目标、可选 / 强制、数量、持续时间、负向路径。 |
| 实现消费链 | `passed` | 已追到 prompt / command、候选生成、trigger / protection、事件构造和 reducer 状态消费。 |
| 最终权威结果 | `passed` | 领域测试断言力量、临时力量、手牌、弃牌堆、附着、额外额度、VP、triggerQueue 和交互清理。 |
| 交互真实入口 | `passed` | 共享流程已逐项完成代表对象、触发 / 候选 / 权限 / payload / 执行 / 最终状态 / 清理判等；本轮列出的 Porthos、Athos、D'Artagnan 和黄金百合花独立 direct E2E 缺口已全部补齐，其它复杂组合仍按扩展覆盖管理。 |
| 验证证据 | `passed` | 当前完整国际事件领域测试文件 62 条通过，资源合同测试 5 条通过；圣热尔韦堡垒、连连获胜、让路、投入战斗！、情谊信物两条路径、Porthos 正负两条路径、Athos、D'Artagnan 和黄金百合花真实入口 direct E2E 均通过。 |
| 共享影响与代表链依据 | `passed` | `sharedFlowId` 表记录触发时机、候选生成、权限、payload、执行入口、最终状态和清理语义。 |
| 缺口分类与范围裁定 | `passed` | 已区分功能实现阻塞、静态命名漂移、当前范围验证缺口和批次外发布残余。 |
| 旧 evidence / 旧结论回写 | `passed` | 旧四派系审计文档新增火枪手当前回写，并指向本文件。 |
| 残余范围声明 | `passed` | 本轮对象级 direct E2E 已完成；远端发布链和四派系共享基线已明确登记，不再把它们写成火枪手对象缺口。 |

## 16 个对象逐项结论

| 对象 | 静态接入 | 原子语义与实现消费 | 最终权威结果 / 生命周期 | 真实入口与直接证据 | 当前缺口 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `musketeers_on_a_roll` 连连获胜 | `action / standard / onPlay / extra`，图集槽位 12，已注册 `onPlay`。 | 选择一个随从；通过 `runExtraActionsRestrictedToMinion` 授予 2 次额外行动，两个行动都限制到同一随从。 | 额外行动额度带 `restrictToMinionUid`；两次行动分别从真实候选中选取并结算，消费后行动数、手牌 / 弃牌堆、触发队列和交互态清理。 | 领域测试 `international-incident.test.ts:598-638`；direct E2E `smashup-international-incident-four-factions.e2e.ts:1736-1870`；截图 `50-56-连连获胜-*.jpg`。 | 无当前 direct E2E 或生命周期缺口；更复杂候选组合属于扩展覆盖。 | 功能实现与真实入口、生命周期均已验证。 |
| `musketeers_make_way` 让路 | `action / standard / onPlay / extra`，图集槽位 13，已注册 `onPlay`。 | 选择己方随从，再选择另一个基地移动；移动完成后才授予额外行动；无合法己方随从时反馈且不授额度。 | 随从基地位置更新；移动成功后额度从 1 提升到 2，额外行动消费后手牌 / 弃牌堆、触发队列和交互态清理。 | 领域测试 `international-incident.test.ts:3730-3836`；direct E2E `smashup-international-incident-four-factions.e2e.ts:1876-1994`；截图 `57-62-让路-*.jpg`。 | 无当前 direct E2E 或生命周期缺口；更复杂移动候选组合属于扩展覆盖。 | 功能实现与真实入口、生命周期均已验证。 |
| `musketeers_en_garde` 预备姿势 | `action / standard / onPlay / extra`，要求玩家选择随从，图集槽位 14，已注册 `onPlay`。 | 选择任意随从，回合结束前临时 +1，抽 1 张牌，再可额外打出 1 张行动。 | 临时力量写入目标随从；抽牌进入手牌；额外行动和交互清理由共享行动链完成。 | 领域测试 `international-incident.test.ts:808-899`；Porthos 负 / 正向 E2E 与 Athos direct E2E 均从真实手牌点击该行动并完成目标选择、抽牌、额外行动和清理。 | 无当前 direct E2E 或生命周期缺口；更复杂目标组合属于扩展覆盖。 | 功能实现与真实入口、生命周期均已验证。 |
| `musketeers_biding_time` 等待时机 | `action / standard / onPlay / extra`，要求玩家选择随从，图集槽位 15，已注册 `onPlay`。 | 选择随从并临时 +2；额外行动只允许打出直接影响该随从的行动，限制对象是随从而不是行动卡实例。 | 目标随从临时力量为 +2；额外行动消费后 `restrictToMinionUid` 清除，不残留 `restrictToCardUid`。 | 领域测试 `international-incident.test.ts:640-689`；真实 E2E `smashup-international-incident-four-factions.e2e.ts:1184-1258` 通过阿拉密斯反应窗口消费。 | 没有独立普通入口，但阿拉密斯链已经直接消费本卡并验证目标限制。 | 功能实现与代表入口均已验证。 |
| `musketeers_to_battle` 投入战斗！ | `action / standard / onPlay / extra`，图集槽位 16，已注册 `onPlay`。 | 立即获得额外随从；刚打出的随从可触发 1 次只影响它的额外行动；选牌或选基地跳过都必须清理额外随从待处理效果。 | 额外随从额度绑定 `grantExtraActionForPlayedMinion`；真实链路中额外随从进入黄金百合花，`预备姿势` 只能选择该随从，额外行动额度与待处理效果、交互态均清理。 | 领域测试 `international-incident.test.ts:691-899`；direct E2E `smashup-international-incident-four-factions.e2e.ts:1990-2078`；截图 `63-68-投入战斗-*.jpg`。最终 `actionLimit=3`、`actionsPlayed=2`、后续行动留在手牌、待处理额外随从效果为空、`triggerQueue=0` 且无交互。 | 无当前 direct E2E 或生命周期缺口；更复杂的跳过组合仍由领域测试覆盖。 | 功能实现、真实多段入口与生命周期均已验证。 |
| `musketeers_one_for_all` 一为全 | `action / standard / onPlay / extra`，图集槽位 19，已注册 `onPlay`。 | 选择有己方随从的基地；该基地所有己方随从回合内 +1，并授予额外行动；不能强化未选基地或敌方随从。 | 选中基地的己方随从临时力量更新，额外行动额度写入玩家回合状态；交互和队列清空。 | 领域测试 `international-incident.test.ts:1386-1438`；真实 E2E `smashup-international-incident-four-factions.e2e.ts:335-390` 选择黄金百合花并回查最终力量 / 额度。 | 无当前功能阻塞；更复杂多基地组合属于非阻塞扩展。 | 功能实现与真实入口均已验证。 |
| `musketeers_last_stand` 最后一搏 | `action / special / beforeScoring / specialNeedsBase`，图集槽位 21，已注册 special。 | 计分前选择计分基地上己方一个随从，临时 +2 并抽 1；没有己方合法目标时不抽牌、不伪造成功。 | 计分前反应窗口、目标随从临时力量、抽牌、基地计分 / VP、response session、triggerQueue 和 interaction 均收清。 | 领域测试 `international-incident.test.ts:3110-3209`；真实 E2E `smashup-international-incident-four-factions.e2e.ts:971-1110`。 | 无当前功能阻塞；更多响应轮次属于扩展覆盖。 | 功能实现与真实入口均已验证。 |
| `musketeers_all_for_one` 全为一 | `action / ongoing / onPlay`，附着目标为随从，图集槽位 23，已注册 onPlay + onMinionAffected + onTurnEnd。 | 先附着到一个随从并授额外行动；另一张由同一控制者直接影响宿主的行动使宿主 +1；本回合末销毁自身。 | 附着行动写入宿主；宿主临时力量与销毁标记更新；回合末行动脱离进入弃牌堆，interaction / triggerQueue 清理。 | 领域测试 `international-incident.test.ts:1440-1514`；真实 E2E `smashup-international-incident-four-factions.e2e.ts:1283-1360`，截图 `test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/全为一可从真实手牌附着、触发加力并在回合结束自毁/42-全为一-回合结束自毁后.jpg`。 | 无当前功能阻塞；宿主 / 行动组合扩展由共享触发器测试覆盖。 | 功能实现与真实入口、生命周期均已验证。 |
| `musketeers_token_of_affection` 情谊信物 | `action / standard / onPlay / extra`，图集槽位 24，已注册 `onPlay`。 | 从牌库和 / 或弃牌堆搜索直接影响随从的行动；可跳过；牌库取牌后重排剩余牌库；无候选时反馈且不授额外行动。 | 搜索结果进入手牌；弃牌堆候选走回收事件；剩余牌库重排；skip / 无候选不写额度。 | 领域测试 `international-incident.test.ts:1517-1693`；真实 E2E 覆盖牌库 / 弃牌堆候选、非法候选过滤、来源选择、取回后的额外行动和跳过路径；共享 `smashup-international-search-extra-action` 的候选过滤、来源区、payload 与清理已复核。 | 无当前功能阻塞；剩余更复杂的搜索组合属于扩展覆盖。 | 功能实现、真实入口、跳过路径和生命周期均已验证。 |
| `musketeers_porthos` 波尔托斯 | `minion / ongoing / power 4`，图集槽位 17，已注册 action protection。 | 只拒绝其他玩家的行动对本随从的影响；不拒绝己方行动，也不把非行动来源的消灭 / 其他事件误算为行动保护。 | protection validator 返回拒绝 / 放行结果，不改写最终状态；与其他玩家行动的拒绝路径不产生伪造成功事件。 | 领域测试 `international-incident.test.ts:3110-3120,3498-3533`；负向 direct E2E `smashup-international-incident-four-factions.e2e.ts:2234-2311` 验证 Porthos 不高亮、普通随从仍可选并完成结算；正向 direct E2E `:2324-2394` 验证控制者行动可选、Porthos +1、额外行动上限 `1 -> 3`、抽牌与清理。 | 无当前 direct E2E 或生命周期缺口；非行动来源和更复杂行动类型仍由领域负向测试覆盖。 | 功能实现、保护过滤、控制者放行、真实入口和生命周期均已验证。 |
| `musketeers_athos` 阿多斯 | `minion / ongoing / power 4`，图集槽位 18，已注册逐实例 `onMinionAffected` trigger。 | 同一基地内，己方玩家直接影响另一个己方随从后，那个被影响的随从临时 +1；不影响自身、不接受错误控制者或非直接影响事件。 | 目标随从临时力量增加；source controller、trigger base、目标控制者过滤有效；重复 / 错误来源不产事件。 | 领域测试 `international-incident.test.ts:978-1132` 的火枪手随从触发器组；Athos direct E2E `smashup-international-incident-four-factions.e2e.ts:2397-2482` 验证真实手牌、同基地目标、目标从 `+1` 叠到 `+2`、抽牌、额外行动和清理。 | 无当前 direct E2E 或生命周期缺口；错误控制者、跨基地和非直接影响路径仍由领域测试覆盖。 | 功能实现、触发过滤、真实入口和生命周期均已验证。 |
| `musketeers_young_musketeer` 年轻的火枪手 | `minion / ongoing / power 3`，图集槽位 20，注册逐实例一次 / 回合 `onMinionAffected` trigger。 | 每回合第一次由己方直接行动影响自身后临时 +1；同回合重复影响不得重复加力，错误控制者和非当前回合不得触发。 | 写入一次 / 回合元数据并增加临时力量；回合生命周期和重复触发被阻止。 | 领域测试 `international-incident.test.ts:978-1132`；真实最后一搏 E2E 使用己方年轻的火枪手完成计分前加力和最终 VP。 | 独立浏览器负向覆盖仍可扩展，但当前已有代表入口与同回合重复拒绝的领域证据。 | 功能实现与代表入口均已验证。 |
| `musketeers_dartagnan` 达达尼昂 | `minion / ongoing / power 4`，图集槽位 22，注册逐实例 `onMinionAffected` trigger。 | 己方直接行动影响自身后抽 1；目标必须是该实例，错误控制者和非直接影响事件不得抽牌。 | 抽牌事件只写入来源控制者手牌；目标实例、来源控制者和直接影响过滤有效。 | 领域测试 `international-incident.test.ts:978-1132` 的触发器组；D'Artagnan direct E2E `smashup-international-incident-four-factions.e2e.ts:2474-2544` 验证真实手牌、自身目标、行动本身抽 1 加触发器抽 1、弃牌和清理。 | 无当前 direct E2E 或生命周期缺口；错误控制者和非直接影响路径仍由领域测试覆盖。 | 功能实现、触发过滤、真实入口和生命周期均已验证。 |
| `musketeers_aramis` 阿拉密斯 | `minion / ongoing / power 4`，图集槽位 25，注册逐实例 `onMinionAffected` trigger + 当前回合限制。 | 本回合一次；己方当前回合中直接行动影响阿拉密斯后，出现强制反应，授予只能直接影响阿拉密斯的即时额外行动。 | 记录一次 / 回合元数据；反应窗口、额外行动候选、目标限制、行动弃牌和临时力量结算后清理。 | 领域测试 `international-incident.test.ts:1295-1384`；真实 E2E `smashup-international-incident-four-factions.e2e.ts:1184-1258`，覆盖反应窗口 -> 选反应 -> 选行动 -> 选阿拉密斯 -> 清理。 | 无当前功能阻塞；非当前玩家回合负向已由领域测试覆盖。 | 功能实现与真实入口、生命周期均已验证。 |
| `base_bastion_saint_gervais` 圣热尔韦堡垒 | `base / breakpoint 25 / VP 5,4,3`，图集槽位 13，注册 `onMinionAffected` trigger。 | 每回合按行动控制者一次；直接影响本基地己方随从后授予该行动控制者一个额外行动；不接受敌方随从或非直接影响事件。 | 写入按控制者分桶的一次 / 回合元数据；额外行动额度可被第二张行动消费，interaction / triggerQueue 清空。 | 领域测试 `international-incident.test.ts:2549-2673,3213-3274`；真实 E2E `smashup-international-incident-four-factions.e2e.ts:1560-1655`，已补齐 `廉价欢呼` 选己方随从和 `团队标记` 选目标基地；截图 `D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动/47-圣热尔韦堡垒-消费额外行动后.jpg`。 | 本轮超时原因为测试漏走两段选择，已修复并重新通过；无当前玩法阻塞。 | 功能实现与真实入口、生命周期均已验证。 |
| `base_the_golden_lily` 黄金百合花 | `base / breakpoint 18 / VP 3,2,2`，图集槽位 8，回合结束 trigger 已注册。 | 你的回合结束时，如果基地上仍有你的随从，抽 1；没有己方随从时不抽牌。 | 抽牌进入手牌；无己方随从路径不生成抽牌事件，回合结束流程不残留交互。 | 领域测试 `international-incident.test.ts:2549-2575,3185-3212`；黄金百合花 direct E2E `smashup-international-incident-four-factions.e2e.ts:2550-2601` 验证真实结束回合、己方随从条件、抽牌和清理。 | 无当前 direct E2E 或生命周期缺口；无己方随从路径仍由领域测试覆盖。 | 功能实现、真实入口和生命周期均已验证。 |

## 共享流程审计与代表链依据

| sharedFlowId | 流程职责 | 一致性核对 | 允许复用的差异 | 失效影响面 |
| --- | --- | --- | --- | --- |
| `smashup-international-extra-action` | 额外行动额度、限制对象、消费、skip 和清理。 | 触发时机、候选生成、权限判断、payload / command、执行入口、最终权威状态、清理语义均由 `actionCounter` / `extraPlay` / reducer 与领域测试核对。 | 差异仅为额度数量、限制随从 / 基地 / 直接影响对象、来源 `reason`。 | 影响连连获胜、让路、预备姿势、等待时机、投入战斗、一为全、全为一、情谊信物、阿拉密斯和圣热尔韦堡垒。 |
| `smashup-international-minion-effect` | 选择随从并写入临时力量、抽牌、力量指示物和目标过滤。 | 触发时机、候选生成、权限判断、payload / command、执行入口、最终权威状态、清理语义均由 `runMinionEffect` / `addTempPower` / `buildStandardDrawEvents` 与测试核对。 | 差异仅为目标控制者、力量数值、是否抽牌和是否授额外行动。 | 影响预备姿势、等待时机、最后一搏和情谊信物取回后的直接影响行动。 |
| `smashup-international-minion-effect-trigger` | 直接影响随从后的 Athos、年轻的火枪手、D'Artagnan、Aramis 触发。 | 触发时机、来源控制者、目标实例、当前回合和重复触发过滤、payload / command、执行入口、最终权威状态、清理语义均由触发器组测试核对。 | 差异仅为奖励类型：+1、抽 1、反应窗口和一次 / 回合限制。 | 影响火枪手四张持续随从及所有直接影响随从的共享事件消费者。 |
| `smashup-international-response-window` | 计分前 special / 反应窗口、玩家选择、结算、VP 和窗口清理。 | 触发时机、候选生成、权限判断、payload / command、执行入口、最终权威状态、清理语义均由 reaction session、`last_stand` E2E 和领域测试核对。 | 差异仅为 response source、目标随从和奖励数值。 | 影响最后一搏和阿拉密斯；若共享 session 失效，计分前与强制反应链都会受影响。 |
| `smashup-international-base-ability` | 基地触发、按行动控制者限制、基地回合生命周期和最终清理。 | 触发时机、候选生成、权限判断、payload / command、执行入口、最终权威状态、清理语义均由 `baseBastionSaintGervaisMinionAffected`、`baseTheGoldenLilyTurnEnd`、base trigger executor 和 E2E / 领域测试核对。 | 差异仅为触发 timing、抽牌或额外行动效果、每回合元数据键。 | 影响圣热尔韦堡垒和黄金百合花。 |

## 代表链判等依据

代表链只用于共享流程证据复用，不等同于每个对象都有独立浏览器 direct E2E。下表逐对象写出代表对象、判等依据、仅配置不同的内容和当前入口状态。

| 对象 | 代表对象 | 判等依据 | 仅配置不同 | 当前入口状态 |
| --- | --- | --- | --- | --- |
| `musketeers_on_a_roll` 连连获胜 | `musketeers_aramis` 阿拉密斯 | 同一额外行动授予、限制候选、消费和清理链。 | 额度数量、限制随从范围、触发来源。 | 共享流程证据；本对象 direct E2E 已独立通过并回写。 |
| `musketeers_make_way` 让路 | `musketeers_make_way` 领域主链 | 同一移动后授额外行动 handler；两段选择、移动完成后授予、额外行动消费和无目标拒绝已由领域测试 / direct E2E 核对。 | 移动来源、目的地过滤和移动数量。 | 本对象 direct E2E 已独立通过并回写。 |
| `musketeers_en_garde` 预备姿势 | `musketeers_all_for_one` 全为一 | 同一直接影响随从、临时力量、抽牌和额外行动消费链；真实附着链已让该行动进入宿主。 | 临时力量数值、是否附着、行动来源。 | 代表性真实入口通过；独立单卡入口覆盖缺口。 |
| `musketeers_biding_time` 等待时机 | `musketeers_aramis` 阿拉密斯 | 同一随从限定额外行动候选、目标过滤、消费和清理链。 | 初始临时力量、直接影响筛选和额度数量。 | 阿拉密斯真实反应链通过。 |
| `musketeers_to_battle` 投入战斗！ | `musketeers_to_battle` 领域主链 | 同一额外随从、额外行动关联、跳过和清理链；领域测试覆盖两条跳过分支，真实入口补齐四段选择和最终清理。 | 额外随从来源、后续行动绑定对象和提示文案。 | 领域主链与独立多段浏览器入口均通过。 |
| `musketeers_one_for_all` 一为全 | `musketeers_one_for_all` 真实入口 | 真实基地选择、基地内己方随从强化、额外行动和最终清理完全同构。 | 目标基地筛选、力量数值和实体数量。 | 真实入口通过。 |
| `musketeers_last_stand` 最后一搏 | `musketeers_last_stand` 真实入口 | 真实计分前响应窗、目标选择、临时力量、抽牌、VP 和窗口清理完全同构。 | 响应来源、目标随从和奖励数值。 | 真实入口与生命周期通过。 |
| `musketeers_all_for_one` 全为一 | `musketeers_all_for_one` 真实入口 | 真实附着、宿主直接影响触发、临时力量、回合末自毁和弃牌清理完全同构。 | 宿主对象、触发行动和力量数值。 | 真实入口与生命周期通过。 |
| `musketeers_token_of_affection` 情谊信物 | `musketeers_token_of_affection` 领域主链 | 同一牌库 / 弃牌堆搜索、候选过滤、跳过、回收和额外行动消费链。 | 来源区、候选数量和直接影响筛选参数。 | 领域主链与独立搜索 UI 入口、来源选择和跳过路径均通过。 |
| `musketeers_porthos` 波尔托斯 | `musketeers_porthos` 领域保护链 | 同一行动保护 validator、行动控制者判断、拒绝 / 放行结果和无伪造成功事件；两条 direct E2E 已验证真实手牌点击、目标高亮、结算和清理。 | 自身 / 其他玩家控制者分支。 | 领域负向链与正负两条独立浏览器入口均通过。 |
| `musketeers_athos` 阿多斯 | `musketeers_aramis` 阿拉密斯 | 同一直接影响随从逐实例触发器、来源控制者过滤、目标实例过滤和回合上下文。 | 奖励类型（+1 对即时额外行动）和一次 / 回合限制。 | 共享触发器证据与 Athos 独立 direct E2E 均通过。 |
| `musketeers_young_musketeer` 年轻的火枪手 | `musketeers_young_musketeer` 领域触发器组 | 同一逐实例直接影响触发器；领域测试核对首次触发、重复拒绝、控制者和回合过滤，真实最后一搏链使用该对象。 | 印制力量、每回合限制和奖励数值。 | 代表性真实入口与领域负向通过。 |
| `musketeers_dartagnan` 达达尼昂 | `musketeers_aramis` 阿拉密斯 | 同一直接影响随从逐实例触发器、来源控制者过滤和目标实例过滤。 | 奖励类型（抽牌）、重复限制和提示文案。 | 共享触发器证据与独立抽牌 direct E2E 均通过。 |
| `musketeers_aramis` 阿拉密斯 | `musketeers_aramis` 真实入口 | 反应窗口、限定额外行动、目标过滤、消费和生命周期清理完全同构。 | 触发行动和临时力量来源。 | 真实入口与生命周期通过。 |
| `base_bastion_saint_gervais` 圣热尔韦堡垒 | `base_bastion_saint_gervais` 真实入口 | 真实行动影响己方随从、按行动控制者每回合一次、额外行动消费和队列清理完全同构。 | 每回合元数据键、基地断点和 VP。 | 真实入口与生命周期通过。 |
| `base_the_golden_lily` 黄金百合花 | `base_the_golden_lily` 领域基地触发链 | 同一基地 trigger executor、回合结束时机、己方随从过滤、抽牌事件和流程清理。 | 触发 timing、抽牌数量和基地断点。 | 领域链与独立回合结束 direct E2E 均通过。 |

## 本轮修复与发现

### 已修复

1. 修复圣热尔韦堡垒 E2E 漏走的第一段真实选择：打出 `廉价欢呼` 后等待 `luchadors_cheap_pop`，选择 `bastion-ally`。
2. 修复同一 E2E 漏走的第二段真实选择：打出 `团队标记` 后等待 `luchadors_tag_team_base`，选择圣热尔韦堡垒。
3. 修复火枪手 7 个静态 fallback 名称与中文 locale 不一致的问题：等待时机、投入战斗！、情谊信物、波尔托斯、阿多斯、达达尼昂、阿拉密斯。
4. 新增资源合同测试，防止静态名称和中文本地化名称再次漂移。

### 前序已修复并在本轮复核

- `预备姿势` 的目标选择、抽牌和额外行动。
- `让路` 的移动完成后才授予额外行动，以及无目标拒绝。
- `最后一搏` 的计分前目标选择、+2、抽牌和窗口清理。
- `情谊信物` 的直接影响随从行动过滤、牌库 / 弃牌堆来源、skip 和额外行动。
- `投入战斗！` 的额外随从绑定、后续行动限制、选牌 / 选基地跳过清理。
- Athos、年轻的火枪手、D'Artagnan、Aramis 的来源控制者、目标实例、重复回合和非当前回合过滤。
- 圣热尔韦堡垒按行动控制者每回合一次的限制。

## 同类扩审记录与漏审归因

- 搜索范围：火枪手静态数组和 16 个 `defId`；`abilities/international_incident.ts` 的注册表、handler、trigger、protection 和基地执行器；`internationalIncidentResourceContract.test.ts`；火枪手领域测试；四派系浏览器 E2E；2026-09-18 旧审计文档和 2026-07-15 原子矩阵。
- 命中项：16 个对象均能在静态、资源、能力消费、领域测试和 evidence 逐项表中定位；共享流程命中 `smashup-international-extra-action`、`smashup-international-minion-effect`、`smashup-international-minion-effect-trigger`、`smashup-international-response-window` 和 `smashup-international-base-ability`；当前完整国际事件领域测试 62 条、资源合同测试 5 条、真实入口 direct E2E 11 条（圣热尔韦堡垒、连连获胜、让路、投入战斗！、情谊信物牌库 / 跳过两条路径、Porthos 正负两条路径、Athos、D'Artagnan 和黄金百合花）。
- 未命中项：本轮范围未发现新增的火枪手对象、重复 `defId`、未注册 handler、超出 12-25 的卡牌槽位、超出基地槽位 8 / 13 的火枪手基地或新的共享消费者；远端 R2 / CDN 只作为发布残余登记，不作为本地规则审计证据。
- 漏审归因：第一次和第二次圣热尔韦堡垒 E2E 超时，直接原因是用例在 `廉价欢呼` 和 `团队标记` 后调用 `waitForNoInteraction()`，没有继续完成真实的随从选择和基地选择；`让路` 首次直连 E2E 的失败是测试期望把未抽牌的 `技术奖` 错写成会留下牌库牌，修正期望为空手牌后重跑通过；静态名称漂移的直接原因是旧资源合同只核对 atlas / manifest / 数量，没有同时断言静态名称与中文 locale 名称。
- 同类扩审动作：已把相同的“真实入口必须走完每一段选择”和“静态名称必须与 locale 双向一致”扩展到当前火枪手 16 个对象；新增资源合同测试覆盖 7 个名称漂移点，并把共享流程的候选、权限、payload、执行、最终状态和清理列入代表链判等表。
- 残余扩审范围：本轮列出的 4 个对象级独立 direct E2E 入口缺口已全部关闭；更复杂的多对象组合、其它派系共享入口和远端资源发布链仍不属于本轮火枪手对象级玩法完成证据。

## 当前统计修订

- 上一条“命中项”统计记录的是连连获胜回写完成后的中间状态；本轮又补齐 `让路`、`投入战斗！`、`情谊信物` 两条路径、Porthos 正负两条路径、Athos、D'Artagnan 和黄金百合花，当前真实入口 direct E2E 共 11 条，本轮列出的对象级独立入口缺口已全部关闭。
- `情谊信物` 的最新验证命令、最终状态和 69-74 截图已列在本文件“验证证据”部分；后续引用本文件时以本节和对象逐项结论为准。

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞当前证据 / 对外收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 本轮列出的 4 个对象级 direct E2E 缺口 | 当前范围验证缺口 | 否 | 否 | 当前火枪手范围内，已关闭 | Porthos、Athos、D'Artagnan、黄金百合花回合结束抽牌均已有真实入口和截图；后续仅保留更复杂组合扩展。 |
| 7 个静态名称 fallback 漂移 | 语义不一致 | 曾经影响交互 / AI / 动作提示显示；现已修复 | 否 | 当前范围内已修复 | 保留资源合同测试，继续用 locale 与静态定义双向对账。 |
| 远端 R2 / CDN 公开资源回查 | 当前范围外发布链残余 | 否 | 是整批发布口径的阻塞 | 当前规则审计范围外 | 具备凭据后上传并验证代表 URL `HEAD 200`。 |
| 四派系共享 E2E 其它失败 | 非阻塞扩展 / 共享验证债务 | 否 | 是整批四派系发布口径的阻塞 | 本轮只记录，不归因到火枪手对象 | 另行修复共享选秀、其它派系响应窗口和目标类型基线。 |

## 验证证据

- 命令：`npx vitest run src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/abilities/international-incident.test.ts`
- 结果：2 个测试文件通过，58 条测试通过；其中 `international-incident.test.ts` 53 条通过，资源合同 5 条通过。
- 证明了什么：火枪手相关静态数组、图集槽位、locale 名称一致性、能力注册、目标过滤、额外行动限制、反应窗口、持续触发、基地 trigger 和负向路径的领域最终状态。
- 没有证明什么：没有证明 16 个对象都有独立浏览器页面链，也没有证明远端 R2 / CDN 已发布。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动"`
- 结果：1 条测试通过；完整链路为打出 `廉价欢呼` -> 选择 `bastion-ally` -> 获得额外行动 -> 打出 `团队标记` -> 选择圣热尔韦堡垒 -> actionLimit 从 1 到 2 -> 消费额外行动 -> interaction / triggerQueue 清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动/45-圣热尔韦堡垒-行动影响己方随从前.jpg`、`46-圣热尔韦堡垒-获得额外行动后.jpg`、`47-圣热尔韦堡垒-消费额外行动后.jpg`。
- 人工观察结论：页面先显示 `廉价欢呼` 的己方随从选择，再显示 `团队标记` 的基地选择；额外行动消费后没有残留交互或触发队列。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "连连获胜可从真实手牌入口授予两个限定额外行动"`
- 结果：1 条测试通过；完整链路为真实手牌打出 `连连获胜` -> 玩家选择限定随从 -> 获得 2 次同一随从限定的额外行动 -> 两次分别选择并结算直接影响该随从的行动 -> 额度归零、牌进入弃牌堆、`triggerQueue` 和交互态清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/连连获胜可从真实手牌入口授予两个限定额外行动/50-连连获胜-真实手牌入口前.jpg`、`51-连连获胜-选择限定目标随从.jpg`、`52-连连获胜-获得两个限定额外行动后.jpg`、`53-连连获胜-第一张额外行动候选中包含限定随从.jpg`、`54-连连获胜-第一张额外行动结算后.jpg`、`55-连连获胜-第二张额外行动作用于限定随从后.jpg`、`56-连连获胜-第二张额外行动结算并清理后.jpg`。
- 人工观察结论：真实牌桌先出现限定目标随从选择，再出现两次额外行动候选；候选均保留同一随从限制，第二次结算后没有残留额度、触发队列或交互。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "让路可从真实手牌入口移动己方随从并消费额外行动"`
- 结果：1 条测试通过；完整链路为真实手牌打出 `让路` -> 玩家选择己方随从 -> 玩家选择第二座基地 -> 随从移动成功并获得 1 次额外行动 -> 用 `技术奖` 选择已移动随从消费额度并增加 3 个力量指示物 -> 手牌 / 弃牌堆、`triggerQueue` 和交互态清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/让路可从真实手牌入口移动己方随从并消费额外行动/57-让路-真实手牌入口前.jpg`、`58-让路-选择己方随从.jpg`、`59-让路-选择目标基地.jpg`、`60-让路-移动并获得额外行动后.jpg`、`61-让路-额外行动消费时选择移动后的随从.jpg`、`62-让路-额外行动结算并清理后.jpg`。
- 人工观察结论：真实牌桌先出现己方随从选择，再出现目标基地选择；移动成功后额外行动可见并能被下一张行动消费，最终没有残留额度、触发队列或交互。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "投入战斗可从真实手牌入口打出额外随从并消费其限定额外行动"`
- 结果：1 条测试通过；完整链路为真实手牌打出 `投入战斗！` -> 选择额外随从 -> 选择目标基地 -> 选择只影响该随从的 `预备姿势` -> 选择该额外随从作为目标；最终行动额度从 1 增至 3、已使用行动数为 2，`预备姿势` 抽到的 `让路` 留在手牌，`投入战斗！` 与 `预备姿势` 进入弃牌堆，待处理额外随从效果、触发队列和交互态清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/投入战斗可从真实手牌入口打出额外随从并消费其限定额外行动/63-投入战斗-真实手牌入口前.jpg`、`64-投入战斗-选择额外随从.jpg`、`65-投入战斗-选择额外随从基地.jpg`、`66-投入战斗-选择限定额外行动.jpg`、`67-投入战斗-选择额外随从作为行动目标.jpg`、`68-投入战斗-额外随从与额外行动额度结算并清理后.jpg`。
- 人工观察结论：页面按顺序显示额外随从选择、基地选择、受限额外行动选择和目标随从选择；结算后年轻的火枪手显示累计临时加力，后续行动牌仍在手牌，右侧额度已增加且没有残留交互或触发队列。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "情谊信物可从真实手牌入口按来源检索直接影响随从的行动并获得额外行动"`
- 结果：1 条测试通过；完整链路为真实手牌打出 `情谊信物` -> 交互同时展示牌库和弃牌堆中的合法直接影响随从行动 -> 排除 `让路` 与其它无效候选 -> 选择牌库中的 `预备姿势` -> 行动进入手牌、剩余牌库重排、源卡进入弃牌堆、行动额度从 1 增至 2，交互和触发队列清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/情谊信物可从真实手牌入口按来源检索直接影响随从的行动并获得额外行动/69-情谊信物-真实手牌入口前.jpg`、`70-情谊信物-牌库与弃牌堆候选.jpg`、`71-情谊信物-取回行动并获得额外行动后.jpg`。
- 人工观察结论：页面展示“情谊信物：选择一个直接影响随从的行动加入手牌”，候选中可见牌库来源的 `预备姿势` 和弃牌堆来源的 `全为一`，并显示“跳过”；取回后 `预备姿势` 已进入手牌，页面提示获得 1 次额外行动，未残留交互或触发队列。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "情谊信物真实入口跳过搜索时保持牌区和行动额度不变"`
- 结果：1 条测试通过；完整链路为真实手牌打出 `情谊信物` -> 玩家选择“跳过” -> 牌库仍保留候选行动、弃牌堆仍保留候选行动、源卡进入弃牌堆、行动额度保持 1，交互和触发队列清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/情谊信物真实入口跳过搜索时保持牌区和行动额度不变/72-情谊信物-跳过路径入口前.jpg`、`73-情谊信物-跳过搜索交互.jpg`、`74-情谊信物-跳过后清理完成.jpg`。
- 人工观察结论：跳过交互只显示合法候选和“跳过”按钮；确认跳过后回到正常牌桌，没有残留弹窗、额外行动提示、交互或触发队列。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "波尔托斯从真实对手行动入口拒绝影响并保留普通随从目标"`
- 结果：1 条测试通过；真实手牌点击 `预备姿势` 后，Porthos 不高亮、普通己方随从仍高亮；点击普通随从后行动正常结算，Porthos 临时力量保持 0，普通随从临时力量为 1，行动牌进入弃牌堆，后续抽牌进入手牌，`actionsPlayed=1`、行动上限为 2，`interaction` 与 `triggerQueue` 清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/波尔托斯从真实对手行动入口拒绝影响并保留普通随从目标/75-波尔托斯-对手行动入口前.jpg`、`76-波尔托斯-对手行动目标过滤后.jpg`、`77-波尔托斯-对手行动被拒绝且普通随从正常受影响后.jpg`。
- 人工观察结论：目标过滤直接发生在真实牌桌入口；禁用的 Porthos 没有被强行点击，合法普通随从可继续完成行动，最终牌桌回到无交互状态。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "波尔托斯控制者可从真实手牌入口用行动影响自身并获得额外行动"`
- 结果：1 条测试通过；控制者从真实手牌打出 `预备姿势`，Porthos 高亮可选并完成目标选择，最终 Porthos 临时力量为 1，行动牌进入弃牌堆，抽牌进入手牌，`actionsPlayed=1`、行动上限从 1 提升到 3，`interaction` 与 `triggerQueue` 清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/波尔托斯控制者可从真实手牌入口用行动影响自身并获得额外行动/78-波尔托斯-控制者行动入口前.jpg`、`79-波尔托斯-控制者可选择自身目标.jpg`、`80-波尔托斯-控制者行动正常结算后.jpg`。
- 人工观察结论：控制者自己的行动仍可选 Porthos，结算后额外行动额度和牌区变化与规则一致，没有残留交互或触发队列。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "阿多斯从真实手牌入口在同基地内强化被直接影响的己方随从"`
- 结果：1 条测试通过；真实手牌点击 `预备姿势` 后，在黄金百合花同一基地内选择另一名己方随从，目标最终临时力量为 2（行动本身 `+1` 加 Athos 触发 `+1`），Athos 自身不被加力，行动牌进入弃牌堆，抽牌进入手牌，`actionsPlayed=1`、行动上限为 2，`interaction` 与 `triggerQueue` 清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/阿多斯从真实手牌入口在同基地内强化被直接影响的己方随从/81-阿多斯-控制者行动入口前.jpg`、`82-阿多斯-选择同基地己方目标.jpg`、`83-阿多斯-直接影响后目标获得双重加力并清理.jpg`。
- 人工观察结论：真实入口先完成手牌点击和同基地目标选择，再回查目标叠加加力与牌区变化；结算后没有残留交互或触发队列。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "达达尼昂从真实手牌入口被直接影响后抽两张牌并完成清理"`
- 结果：1 条测试通过；真实手牌点击 `预备姿势` 并选择 D'Artagnan 自身后，目标临时力量为 1，行动本身抽 1 张牌、D'Artagnan 触发再抽 1 张牌，两个指定牌进入手牌，行动牌进入弃牌堆，行动额度为 2，牌库、`interaction` 与 `triggerQueue` 均清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/达达尼昂从真实手牌入口被直接影响后抽两张牌并完成清理/84-达达尼昂-控制者行动入口前.jpg`、`85-达达尼昂-选择自身目标.jpg`、`86-达达尼昂-直接影响后抽两张牌并清理.jpg`。
- 人工观察结论：真实入口完成自身目标选择后，牌区直接显示两张抽牌结果，结算后无残留交互或触发队列。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "黄金百合花从真实结束回合入口在有己方随从时抽一张牌"`
- 结果：1 条测试通过；真实点击“结束回合”后，黄金百合花上存在己方随从的条件满足，指定牌进入手牌、牌库耗尽，`triggerQueue` 与 `interaction` 清空。
- 截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-international-incident-four-factions.e2e/黄金百合花从真实结束回合入口在有己方随从时抽一张牌/87-黄金百合花-结束回合入口前.jpg`、`88-黄金百合花-回合结束抽牌并清理.jpg`。
- 人工观察结论：抽牌发生在真实结束回合入口之后，满足己方随从条件，结算后页面没有残留交互或触发队列。
- 前序真实入口：`e2e/smashup/smashup-international-incident-four-factions.e2e.ts:335-390,971-1110,1184-1258,1283-1360`，覆盖一为全、最后一搏、阿拉密斯和全为一的直接玩家入口与生命周期。

## 修订或失效记录

- 旧文档：`evidence/smashup/2026-09-18-international-incident-audit.md`。
- 旧结论：火枪手只有共享流程和代表性真实入口，未有本派系当前对象级回写；圣热尔韦堡垒真实入口仍被测试超时阻断。
- 失效 / 修订原因：本轮补齐测试漏走的两个玩家选择；静态 fallback 名称也已与中文 locale 对齐；领域和真实入口重新验证通过。
- 替代证据：本文件 16 行对象表、`international-incident.test.ts` 当前 62 条通过、资源合同 5 条通过、圣热尔韦堡垒、连连获胜、让路、投入战斗！、情谊信物两条路径、Porthos 正负两条路径、Athos、D'Artagnan 和黄金百合花 direct E2E 均通过。
- 新结论：火枪手规则实现和本轮列出的真实入口缺口已验证闭环；Porthos、Athos、D'Artagnan 和黄金百合花已完成对象级 direct E2E 与生命周期回写，但本文件仍不能解释为四派系整体发布收口，因为共享四派系验证和远端资源发布链仍有残余。

## 对外汇报口径

- 允许说：火枪手 16 个对象已逐项完成静态、领域和共享流程审计；本轮列出的对象级 direct E2E 缺口已全部通过；圣热尔韦堡垒、连连获胜、让路、投入战斗！、情谊信物、Porthos、Athos、D'Artagnan 和黄金百合花真实入口已通过；静态名称漂移已修复。
- 禁止说：16 个对象都已有独立浏览器 E2E；四派系整体已收口；远端资源已经发布；圣热尔韦堡垒原能力实现曾被证明有 bug。

## 残余范围

当前火枪手派系本轮列出的对象级独立浏览器 direct E2E 缺口已全部关闭；仍有四派系共享验证和远端资源发布链残余。火枪手本地对象范围可以收口，批次整体仍保持 `in_progress`，直到共享 / 发布链另行闭合。
