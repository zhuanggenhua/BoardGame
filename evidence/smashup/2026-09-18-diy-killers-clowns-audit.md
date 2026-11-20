# 大杀四方 DIY 杀人狂 / 小丑批次审计回写

## 基本信息

- 对象：`diy_killers` 杀人狂、`diy_clowns` 小丑
- 日期：2026-09-18
- 主真相源：`src/games/smashup/data/factions/diy_killers.ts`、`src/games/smashup/data/factions/diy_clowns.ts`、`src/games/smashup/abilities/diy_killers.ts`、`src/games/smashup/abilities/diy_clowns.ts`
- 当前状态：两派系继续保持 `in_progress`。本轮完成对象范围、共享流程和领域最终状态对账，但没有把领域测试或 optional-trigger 代表证据冒充为每个对象的真实页面 L3/L4。

## 审计范围

- 杀人狂对象全集：`diy_killers_leatherface`、`diy_killers_freddy_krueger`、`diy_killers_jason`、`diy_killers_michael_myers`、`diy_killers_pinhead`、`diy_killers_captain_kirk_mask`、`diy_killers_savage_attack`、`diy_killers_cha_cha_cha_ha_ha_ha`、`diy_killers_chainsaw`、`diy_killers_clawed_glove`、`diy_killers_good_boy`、`diy_killers_laundry_room`、`diy_killers_improvised_weapon`、`diy_killers_machete`、`diy_killers_oh_no`、`diy_killers_origin_story`、`diy_killers_hell_puzzle_box`、`diy_killers_is_it_over`、`base_diy_killers_camp_crystal_lake`、`base_diy_killers_nightmare_world`。
- 小丑对象全集：`diy_clowns_slapstick_clown`、`diy_clowns_mrs_clown`、`diy_clowns_dancing_clown`、`diy_clowns_mcdonald_clown`、`diy_clowns_silent_clown`、`diy_clowns_clown_girl`、`diy_clowns_banana_peel`、`diy_clowns_clown_car`、`diy_clowns_jack_in_the_box`、`diy_clowns_clown_pyramid`、`diy_clowns_colorful_scarf`、`diy_clowns_confetti_bucket`、`diy_clowns_juggling`、`diy_clowns_pie_in_the_face`、`base_diy_clowns_clown_academy`、`base_diy_clowns_circus_tent`。
- 不在本轮范围：其它 DIY 派系、远端资源发布、未建立的完整派系级浏览器筛选 E2E。

## 结论等级

结论等级：`L2 已对账，L3/L4 仍有残余范围`。

- 杀人狂：领域对象行为、附着行动、基地触发、计分前响应和 optional trigger 提交后的最终状态已有证据；状态继续 `in_progress`，原因是没有整派系逐对象真实入口矩阵。
- 小丑：除领域对象行为外，已补派系详情，以及麦当劳小丑、金字塔、香蕉皮、小丑车、小丑夫人、小丑女、马戏篷、惊吓盒、彩色围巾、五彩纸屑桶、杂耍、馅饼砸脸、滑稽小丑、沉默小丑、跳舞小丑和小丑学院 16 个对象的真实入口；小丑对象级入口本轮已覆盖全集，但两派系整体仍保持 `in_progress`，杀人狂仍缺整派系逐对象入口矩阵，且本批次不包含派系级筛选与远端发布收口。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 本文列出两派系 36 个对象，直接对应两个正式 data 文件。 |
| 真相源状态 | `passed` | 当前 TS 数据、能力注册、领域测试和 optional-trigger 复审为主源；没有用历史截图代替规则源。 |
| 原子语义断言 | `passed` | 每个对象按 onPlay、talent、ongoing、special、基地触发和可选 / 空选分支归入共享流程。 |
| 实现消费链 | `passed` | 入口覆盖两个 ability 文件、interaction handler、ongoing / protection / trigger registry 和 reducer。 |
| 最终权威结果 | `passed` | 领域测试回到随从、行动、附着、弃牌堆、牌库、力量、行动额度、VP、triggerQueue 和交互清空。 |
| 交互真实入口 | `scoped_debt` | 小丑 16 个对象均已有直接页面链；整批仍缺杀人狂逐对象页面矩阵，且本批次不把派系级筛选和远端发布链纳入完成口径。 |
| 验证证据 | `passed_scoped` | 杀人狂 / 小丑定向能力测试与 intake 测试通过；`smashup-optional-reaction-trigger-reaudit-2026-09-16.md` 对 12 个新增直接对象和 55 个已有对象索引通过。 |
| 共享影响与代表链依据 | `passed` | `sharedFlowId` 见下表，区分共享框架通过与单对象真实入口缺口；代表对象、判等依据和配置差异见补充说明。 |
| 缺口分类与范围裁定 | `passed` | 当前缺口是 L3/L4 证据范围，不是由测试通过推导出的实现根因。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 旧 optional-trigger 证据继续有效，但只证明提交后 finalState，不改变两派系状态表。 |
| 残余范围声明 | `passed` | 明确不把 26 条定向领域测试、20 条小丑真实入口测试或杀人狂代表性入口外推为两派系整批完成。 |

## 共享流程审计与代表链依据

| sharedFlowId | 流程职责 | 一致性核对 | 当前裁定 |
| --- | --- | --- | --- |
| `smashup-optional-trigger-response-settlement` | 进入可选响应、玩家 / AI 提交、handler 执行、最终状态和队列清理。 | 触发时机、候选生成、权限判断、payload / command、执行入口、finalState、triggerQueue 清理均已在 optional-trigger 复审中核对。 | DIY 杀人狂 12 个直接对象和相关兄弟对象通过；不替代整派系页面入口。 |
| `smashup-diy-ongoing-attachment` | 持续行动附着到随从 / 基地、宿主约束、力量 / 保护 / 移动消费。 | 目标控制者、宿主区域、附着后持续效果、移除 / 摧毁后的去向和无目标分支由 `diy-killers.test.ts` / `diy-clowns.test.ts` 覆盖。 | L2 通过，L3/L4 仍为 scoped debt。 |
| `smashup-diy-base-trigger` | 水晶湖营地、梦魇世界、小丑学院、马戏篷的基地触发与每回合一次清理。 | 触发时机、力量阈值、单候选手选、回合结束 / 计分后清理和 `interactionSourceId` 已有领域断言。 | L2 通过，未升级为整派系真实入口收口。 |

### 共享流程代表链判等补充

- 代表对象：人皮脸与其依赖链中的电锯；共享流程引用对象是统一 `smashup_reaction_choose` 可选响应、触发队列消费和 interaction handler / reducer 收口链。
- 判等依据：逐项核对触发时机、候选生成、权限判断、payload / command、执行入口、最终权威状态和清理语义；人皮脸新增的差异只在卡牌来源、力量阈值、目标随从和 `diy_killers_leatherface` / `diy_killers_chainsaw` 的 source 定义，不把电锯的移动后续冒充为人皮脸自身能力。
- 仅配置不同的对象才能复用该代表链；若新增排序、多选、跨基地移动或其它后续交互，必须独立补真实入口。本轮人皮脸的电锯移动响应虽共享反应框架，但已在真实 E2E 中单独验证其后续交互。

### 图片合同边界

- 本文件的玩法审计主真相源是规则文本、`diy_killers.ts` / `diy_clowns.ts` 静态定义、ability 注册和最终状态测试；图集只用于验证真实页面入口，不把截图或图集通过当作规则实现通过。
- `src/games/smashup/__tests__/diyKillersClownsIntake.test.ts` 已核对 `previewRef` 的 atlasId / slot、基地图集路径、派系详情页面资源接线和双语 locale；完整单卡主裁图、裁图清单、crop manifest、SHA256 图片合同没有在本 evidence 中逐项复制。
- 因此图片合同属于独立的审计留档缺口，不影响本轮人皮脸规则链的功能判断，也不允许把本批次升级为资源 intake 或远端发布已完成。

## 原子语义与实现消费

| 派系 | 原子语义 / 实现消费 | 最终权威结果 | 直接证据 | 缺口分类 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 杀人狂 | 人皮脸、弗莱迪、杰森、麦克尔·麦尔斯等随从的 onPlay / special；电锯、爪子手套、大砍刀等持续附着与天赋；野蛮攻击、起源故事、简易武器、哦不等弃牌 / 回收 / 额外行动；两个基地的触发。 | 摧毁 / 移动目标、宿主附着、力量修正、弃牌 / 回收、额外行动和响应队列最终状态均有领域断言；人皮脸真实入口已验证检索电锯、附着、回合开始加指示物、摧毁低力量目标，以及电锯后续移动响应收口；弗莱迪真实入口已验证检索爪子手套、附着、天赋减力量、按减益后力量筛选目标、摧毁后爪子手套加力量指示物和下回合开始清除减益；杰森真实入口已验证检索并附着大砍刀、激活附着天赋移动宿主、进入杰森可选反应、只列力量不超过 3 的目标、摧毁后叠加杰森 +2 与大砍刀 +1，并在回合结束回收大砍刀和清除临时力量。 | `diy-killers.test.ts` 定向用例；optional-trigger 复审中的 `diy_killers_leatherface`、`diy_killers_chainsaw`；`smashup-diy-killers-real-entry.e2e.ts` 人皮脸、弗莱迪与杰森对象用例。 | 仍缺其它杀人狂对象的逐对象页面直测；爪子手套自身天赋仍未有独立真实入口。 | `in_progress` |
| 小丑 | 滑稽小丑 / 沉默小丑的额外行动与每回合一次；跳舞小丑弃牌堆随机行动；小丑学院第一次打入随从后的可选回收；麦当劳小丑、杂耍、小丑金字塔、彩色围巾、五彩纸屑桶、馅饼砸脸、小丑女的目标 / 多选 / 单候选路径；两个基地触发。 | 弃牌堆、牌库顶、行动额度、临时力量、目标随从和交互清理均有领域断言；滑稽小丑真实入口已确认从弃牌堆面板手动选择标准行动，按通常行动额度结算，行动离开弃牌堆并进入牌库底，交互关闭；沉默小丑已确认在无通常行动额度时仍可从真实弃牌堆面板额外打出标准行动，记录来源并回到牌库底；跳舞小丑已确认从真实天赋入口随机选出标准行动，玩家确认后作为额外行动打出，`actionsPlayed` 保持 0、天赋标记写入、行动进入牌库底；小丑学院已确认第一次打入随从后出现可选基地响应，接受时只把一张标准行动随机回收到手牌，非标准牌留在弃牌堆，同回合第二次打入不重复触发；杂耍真实入口已确认两名玩家依次选择各自牌库顶三张中的行动牌，选中牌进入弃牌堆，未选牌保持原顺序；馅饼砸脸真实入口已确认手牌来源 +2、弃牌堆来源 +4、只列己方随从、单一候选仍显式选择、弃牌堆来源回到牌库底；金字塔真实入口已确认先选基地、再手选单一己方随从并结算 +1 与额外行动；麦当劳、小丑女、马戏篷、小丑夫人、惊吓盒、彩色围巾和五彩纸屑桶已回到真实页面最终状态。 | `diy-clowns.test.ts`、`diyKillersClownsIntake.test.ts`、`e2e/smashup/smashup-diy-clowns-real-entry.e2e.ts`。 | 小丑对象级入口已覆盖全集；两派系整批收口仍受杀人狂逐对象入口、派系级筛选和远端发布范围限制。 | `in_progress` |
| 小丑 | 滑稽小丑 / 沉默小丑的额外行动与每回合一次；跳舞小丑弃牌堆随机行动；小丑学院第一次打入随从后的可选回收；麦当劳小丑、杂耍、小丑金字塔、彩色围巾、五彩纸屑桶、馅饼砸脸、小丑女的目标 / 多选 / 单候选路径；两个基地触发。 | 弃牌堆、牌库顶、行动额度、临时力量、目标随从和交互清理均有领域断言；滑稽小丑真实入口已确认从弃牌堆面板手动选择标准行动，按通常行动额度结算，行动离开弃牌堆并进入牌库底，交互关闭；沉默小丑已确认在无通常行动额度时仍可从真实弃牌堆面板额外打出标准行动，记录来源并回到牌库底；跳舞小丑已确认从真实天赋入口随机选出标准行动，玩家确认后作为额外行动打出，`actionsPlayed` 保持 0、天赋标记写入、行动进入牌库底；小丑学院已确认第一次打入随从后出现可选基地响应，接受时只把一张标准行动随机回收到手牌，非标准牌留在弃牌堆，同回合第二次打入不重复触发；杂耍真实入口已确认两名玩家依次选择各自牌库顶三张中的行动牌，选中牌进入弃牌堆，未选牌保持原顺序；馅饼砸脸真实入口已确认手牌来源 +2、弃牌堆来源 +4、只列己方随从、单一候选仍显式选择、弃牌堆来源回到牌库底；金字塔真实入口已确认先选基地、再手选单一己方随从并结算 +1 与额外行动；麦当劳、小丑女、马戏篷、小丑夫人、惊吓盒、彩色围巾和五彩纸屑桶已回到真实页面最终状态。 | `diy-clowns.test.ts`、`diyKillersClownsIntake.test.ts`、`e2e/smashup/smashup-diy-clowns-real-entry.e2e.ts`。 | 小丑对象级入口已覆盖全集；两派系整批真实入口仍受杀人狂逐对象入口、派系级筛选和远端发布范围限制。 | `in_progress` |

## 缺口分类与范围裁定

| 条目 | 分类 | 现实影响 | 最小补救 |
| --- | --- | --- | --- |
| 两派系整批浏览器真实入口 | 当前范围验证缺口 | 小丑 16 个对象均已从真实牌桌入口完成对象级验证；杀人狂仍只有代表性入口，且派系级筛选与远端发布不在本批次。 | 继续补齐杀人狂逐对象页面矩阵，再单独完成派系级筛选、全生命周期和资源公开回查。 |
| 远端资源公开回查 | 非本批次范围 | 不影响本地规则 L2，但会阻止资源发布链结论。 | 资源发布阶段单独按 `HEAD 200` 门禁验证。 |
| DIY 派系图片合同逐项留档 | 审计留档缺口 | 否 | 是：阻塞资源 intake / 视觉合同的独立收口，不阻塞本轮规则链判断 | 关联 `diyKillersClownsIntake.test.ts` 的 atlas slot / manifest 证据，并补齐完整单卡主裁图、裁图清单、crop manifest 与 SHA256 记录。 |

## 验证证据

- `npx vitest run src/games/smashup/__tests__/abilities/diy-clowns.test.ts src/games/smashup/__tests__/diyKillersClownsIntake.test.ts`：2 个文件、26 条测试通过；新增小丑学院接受、让过和同回合不重复触发断言，并继续覆盖馅饼砸脸手牌 / 弃牌堆来源差异、只列己方随从、单一候选显式选择、行动牌去向，以及彩色围巾、惊吓盒、五彩纸屑桶的来源 / 数量差异、额度上限、消费清理和多选边界。
- `npm run test:e2e:file -- e2e/smashup/smashup-diy-clowns-real-entry.e2e.ts`：20 条测试全部通过，覆盖派系详情、滑稽小丑、沉默小丑、跳舞小丑、小丑学院、麦当劳小丑、金字塔、香蕉皮、小丑车、小丑夫人、小丑女、马戏篷、惊吓盒、彩色围巾、馅饼砸脸、杂耍和五彩纸屑桶；最终状态断言手牌、弃牌堆、牌库、力量、行动额度、触发队列和交互清空。
- `npx tsc --noEmit --pretty false`：通过。
- `smashup-optional-reaction-trigger-reaudit-2026-09-16.md`：optional trigger 共享链 78 个注册 / 67 个唯一对象，12 个本轮直接 finalState 证据通过；DIY 相关对象包含人皮脸和电锯。
- 以上只证明 L2 / sharedFlow，不证明两派系逐对象浏览器入口已经完成；所以 `ids.ts` 中 `diy_killers`、`diy_clowns` 保持 `in_progress`。

## 修订或失效记录

- 旧口径若只依据“能力测试通过”就摘牌，会把规则层最终状态误当成真实入口完成；本轮保留 `in_progress`，把缺口明确归类为 L3/L4 证据缺口。

## 残余范围声明

本文件完成 DIY 杀人狂 / 小丑的对象全集、共享消费链和当前最终状态对账，不宣称两派系整批真实入口或远端资源发布链完成。

## 2026-09-23 继续审计回写：柯克船长面具真实入口

- 原始审计对象：`diy_killers_captain_kirk_mask`，真实入口为“从手牌附着到己方随从 -> 打出野蛮攻击 -> 摧毁同基地对手随从 -> 回查面具力量累计与后续加力交互”。
- 规则真相源：中文卡面写明“这里的一个或更多仆从被摧毁后，这个仆从获得被摧毁仆从的总力量直到回合结束”；英文卡面同样没有玩家选择步骤。实现注册为 `onMinionDestroyed` 的非可选触发，领域测试已经证明摧毁后直接累计力量，再进入野蛮攻击的后续加力选择。
- 首次真实入口失败不是生产规则失败：E2E 在摧毁目标后错误等待不存在的 `smashup_reaction_choose`，因此 15 秒超时；页面入口尚未被证明卡住，生产代码也没有对应报错或状态回退证据。
- 最小修复落在测试夹具：删除不存在的可选反应窗口断言，改为直接断言面具宿主获得被摧毁随从的有效力量 `+3`、目标已离场，然后等待真实存在的 `diy_killers_savage_attack_boost` 后续交互。
- 修复后验证：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "柯克船长面具"` 通过，结果 `1 passed`；本次未修改生产规则实现，当前未发现柯克船长面具对应的产品规则缺陷。

## 2026-09-18 继续审计回写：杀人狂真实入口与额度消费修复

- 杀人狂新增真实入口 E2E：派系详情页图集、杰森从牌库检索大砍刀、简易武器抽取并实际打出限定附着行动，3/3 通过。
- 本轮在真实入口发现一个此前领域夹具未覆盖的状态问题：简易武器抽出的附着行动能够成功附着到随从，但打出后玩家状态仍残留“只能打出这张牌”的限定额外行动额度；这会让同一次额外行动被重复保留，并且没有把该牌按额外行动结算。
- 根本机制已定位：命令阶段找到了 `specificExtraActionPlays`，但生成 `ACTION_PLAYED` 事件时没有把手牌中的匹配项标记为额外行动；归约阶段又只在 `fromStored` 路径查找并消费该额度，因此简易武器从手牌打出时只落了牌区结果，没有消费限定额度。
- 修复已落在共享行动结算链：`ACTION_PLAYED` 生成时识别匹配的限定额外行动；`reduceActionPlayedEvent` 对手牌 / 暂存区的匹配项统一消费；简易武器的 `destroyAttachedActionAtTurnEnd` 以显式字段贯穿额度事件、暂存额度和待结算行动，不再依赖原因文字。
- 修复后验证：杀人狂 / 小丑领域与 intake 34/34 通过，`npx tsc --noEmit --pretty false` 通过，杀人狂真实入口 E2E 3/3 通过。
- 当前裁定：杀人狂从“只有 L2”升级为“代表性 L3/L4 已验证”，但由于仍没有逐对象覆盖 17 张牌 + 2 个基地的完整浏览器矩阵，派系状态继续保持 `in_progress`；小丑仍未进入本轮真实入口修复。

## 2026-09-18 继续审计回写：小丑真实入口、目标声明与交互文案修复

- 新增真实入口：`e2e/smashup/smashup-diy-clowns-real-entry.e2e.ts`，6/6 通过。
- 真实入口首次运行时发现功能阻塞：小丑金字塔从页面打出后直接进入弃牌堆，没有让玩家选择目标基地，因此后续“选择己方随从并按该基地己方随从数量加力量”的能力不会执行。页面失败快照显示牌已离手、基地上仍只有原随从、当前没有金字塔交互。
- 根本机制：`diy_clowns_clown_pyramid` 的 ability 读取 `ctx.targetBaseIndex`，但静态行动牌定义没有声明 `playNeedsBase: true`；真实出牌入口据此把它当成无目标行动，未生成基地选择参数。领域测试手工传入 `targetBaseIndex`，所以此前没有暴露这个入口缺陷。
- 修复：在 `src/games/smashup/data/factions/diy_clowns.ts` 为小丑金字塔补 `playNeedsBase: true`；在 `src/games/smashup/__tests__/diyKillersClownsIntake.test.ts` 增加静态回归断言。
- 发现并修正文案错配：小丑车原文案说移动随从，彩色围巾说转移动行动，五彩纸屑桶说把随从返回手牌，馅饼砸脸说让对手弃行动，小丑女说打出额外行动，小丑金字塔固定写 `+2`；实际能力分别是弃牌洗回牌库、弃手牌后抽牌、弃手牌后等量抽牌、己方随从加力量、从牌库弃置行动、按该基地己方随从数量每个 `+1`。中英文 `ui.*` 标题已全部改正。
- 修复后真实状态：麦当劳小丑抽到指定行动且另一张进入弃牌堆；金字塔单一候选仍要求玩家显式选择，结算 `tempPowerModifier = 1`、`actionLimit = 2`；小丑夫人抽牌后写入每回合使用标记并清空响应队列；小丑女行动进入弃牌堆；马戏篷展示行动并执行弃置分支；所有场景交互均关闭。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\小丑金字塔只有一个己方随从时仍要求显式选择并结算力量与额外行动\04-小丑-金字塔单候选仍需手选.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\小丑金字塔只有一个己方随从时仍要求显式选择并结算力量与额外行动\05-小丑-金字塔力量与额外行动收口.jpg`
- 当前裁定：小丑已从只有 L2 升级为“关键入口代表性 L3/L4 已验证”，但不宣称整派系完成；剩余 6 个对象及全量生命周期矩阵仍属于 `in_progress` 残余范围。

## 2026-09-18 继续审计回写：五彩纸屑桶对象级核对

- 规则语义已按中英文卡牌文本对账：玩家可以从手牌弃置至多四张牌，然后抽取与弃牌数量相同的牌；选择零张合法；没有其它手牌时不应生成无意义的选择窗口。
- 静态接入已核对：`diy_clowns_confetti_bucket` 是标准行动，数量 1，图集索引 16，能力注册和交互标题一致；该牌不需要基地目标，也不区分手牌 / 弃牌堆来源效果。
- 领域证据新增三条：选择四张时只弃四张并抽四张；选择零张时手牌和牌库不变；只有行动牌自身在手牌时直接结算且不生成空交互。三条均回到弃牌堆、手牌、牌库和交互关闭状态。
- 真实入口证据新增一条：从手牌进入多选窗口，明确看到 `0-4` 选择范围，手动选择两张、确认后抽取两张；E2E 覆盖截图 `20-小丑-五彩纸屑桶多选手牌`、`21-小丑-五彩纸屑桶弃牌抽牌收口`。
- 当前裁定：五彩纸屑桶未发现实现缺陷，移出小丑残余范围；小丑仍保持 `in_progress`，剩余 6 个对象不能由本对象证据外推完成。

## 2026-09-18 继续审计回写：惊吓盒领域合同收口

- 领域测试新增两条来源差异合同：手牌打出后额外随从力量上限为 3，从弃牌堆打出后上限为 4；两条都验证力量超限被拒绝、合法随从可以落地、额外上限在消费后清理，而共享行动额度仍保留已消费后的累计值。
- 这次领域夹具补齐了真实前提：玩家已先打出一个普通随从，再消费惊吓盒提供的额外随从额度；此前若保留普通额度，力量4可能被普通额度路径接受，不能证明惊吓盒的力量上限。
- 真实入口两条 E2E 已覆盖手牌和弃牌堆来源，12 条小丑真实入口测试全通过；本对象未发现能力源码缺陷。

## 2026-09-18 继续审计回写：彩色围巾对象级核对

- 规则语义已按中英文卡牌文本对账：手牌打出固定抽两张；从弃牌堆打出时先完成两张抽牌，再让玩家选择弃一张手牌额外抽一张，或明确跳过；弃牌堆出牌本身按共享合同回到牌库底。
- 静态接入已核对：`diy_clowns_colorful_scarf` 的行动类型、标准行动子类型、数量 2、图集索引 14、能力注册和交互标题均一致；该牌不需要基地目标。
- 领域证据新增三条：手牌分支抽两张且不生成额外选择；弃牌堆分支选择弃牌后额外抽一张；弃牌堆分支选择跳过时不额外抽牌。三条均回到手牌、弃牌堆、牌库、正常行动额度和交互关闭状态。
- 真实入口证据新增两条：手牌打出收口，以及从弃牌堆面板点击后进入“选择要弃掉的手牌，或跳过”，手动弃一张并完成额外抽牌；E2E 覆盖截图 `17-小丑-彩色围巾手牌抽两张收口`、`18-小丑-彩色围巾弃牌堆额外抽牌选择`、`19-小丑-彩色围巾弃牌堆额外抽牌收口`。
- 当前裁定：彩色围巾未发现实现缺陷，移出小丑残余范围；小丑仍保持 `in_progress`，剩余 7 个对象不能由本对象证据外推完成。

## 同类扩审与漏审归因

- 触发证据：金字塔真实页面首跑失败，说明领域测试手工提供的目标参数没有被真实出牌入口生成；同时真实交互标题与对应 ability 的实际动作不一致。
- 搜索范围：横向检查 `src/games/smashup/data/factions/diy_clowns.ts` 的 14 张行动 / 随从定义、`src/games/smashup/abilities/diy_clowns.ts` 的全部 `titleKey` 与交互 handler、`public/locales/zh-CN/game-smashup.json` / `public/locales/en/game-smashup.json` 的 DIY 小丑 UI 文案，以及 `diy-clowns.test.ts` 和新增真实入口 E2E。
- 命中项：1 个功能入口声明缺失（小丑金字塔缺 `playNeedsBase`）；6 个交互标题与实际能力错配（小丑车、金字塔、彩色围巾、五彩纸屑桶、馅饼砸脸、小丑女）。
- 排除项：香蕉皮、麦当劳小丑、跳舞小丑、马戏篷等同批对象的 handler / `titleKey` 已与当前 E2E 或领域语义核对；本轮没有把相似命名直接升级成跨派系修改。
- 漏审归因：旧测试主要从领域命令直接注入 `targetBaseIndex`，证据停在能力执行层，没有经过“牌定义目标声明 -> 真实页面基地选择 -> ability 消费”这一完整入口；交互文案也只有 locale 存在性检查，没有做 handler 动作与标题语义对账。
- 残余扩审：当前仍需补沉默小丑弃牌堆额外打出、跳舞小丑天赋和小丑学院基地触发的对象级真实页面证据；这些是下一轮残余范围，不是本轮已验证对象的失败结论。

## 2026-09-18 继续审计回写：杂耍对象级核对

- 规则语义已按当前中英文卡牌描述和领域实现对账：按回合顺序检查每名玩家自己的牌库顶三张；其中有行动牌时，由该玩家手动选择一张公开并弃置；没有行动牌时展示这几张牌后继续下一名玩家；未选行动牌保持原牌库顺序。
- 静态接入已核对：`diy_clowns_juggling` 的行动牌定义、能力注册、运行时交互来源和中英文交互标题一致；该牌不需要基地目标，也不是单一候选自动结算。
- 领域证据：`diy-clowns.test.ts` 新增两名玩家分别选择不同牌的断言，验证第一名玩家弃置 `p0-action-b`、第二名玩家弃置 `p1-action-a`，并验证未选牌分别仍按原顺序留在两名玩家牌库；最终交互为空。
- 真实入口证据：从真实手牌打出杂耍，先由第一名玩家看到并选择两张行动牌之一，再由第二名玩家看到并选择自己的两张行动牌之一；测试明确关闭每段展示层并继续等待下一段交互，最后回到两名玩家的弃牌堆、牌库顺序和交互关闭状态。
- 真实入口测试配置曾被本地 AI 自动接管第二名玩家，失败快照显示页面把该座位标成“AI 2 号位”；修复仅限 E2E 场景显式传入 `seat1=human` 和 `disableLocalAiAutomation=true`，没有改产品 AI 行为。
- 验证结果：`npm run test:e2e:file -- e2e/smashup/smashup-diy-clowns-real-entry.e2e.ts --grep "杂耍从真实打牌入口"` 通过；完整文件 14/14 通过；定向领域与 intake 测试 22/22 通过；`npx tsc --noEmit --pretty false` 通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\杂耍从真实打牌入口让两名玩家依次手选牌库顶三张中的行动牌\22-小丑-杂耍第一名玩家选择行动牌.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\杂耍从真实打牌入口让两名玩家依次手选牌库顶三张中的行动牌\23-小丑-杂耍第二名玩家选择行动牌.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\杂耍从真实打牌入口让两名玩家依次手选牌库顶三张中的行动牌\24-小丑-杂耍两名玩家弃置与牌库顺序收口.jpg`
- 当前裁定：杂耍未发现产品规则实现缺陷；对象级真实入口和生命周期证据已完成，移出小丑残余范围。小丑整体仍保持 `in_progress`，当前剩余 5 个对象：馅饼砸脸、滑稽小丑、沉默小丑、跳舞小丑、小丑学院。

## 2026-09-18 继续审计回写：馅饼砸脸对象级核对

- 规则语义已按当前中英文卡牌描述、静态定义和 ability 对账：从手牌打出时选择一个己方随从获得 +2 临时力量；从弃牌堆打出时选择一个己方随从获得 +4 临时力量，并按共享弃牌堆行动合同把该行动放回牌库底。
- 静态接入已核对：`diy_clowns_pie_in_the_face` 是标准行动，数量 2，图集索引 18，能力注册和交互标题一致；目标候选只来自当前玩家控制的己方随从，不把对手随从列入选项。
- 领域证据新增两条：手牌来源列出两个己方随从并排除对手随从，单一候选仍保留显式选择，结算 +2 后行动进入弃牌堆；弃牌堆来源只列一个己方随从，结算 +4 后行动离开弃牌堆并进入牌库底，交互清空。
- 真实入口证据新增两条：手牌来源展示己方随从选择并在收口截图中确认 +2；弃牌堆来源展示唯一己方候选并在收口截图中确认 +4 与牌库底。
- 验证结果：馅饼砸脸定向真实入口 2/2 通过；完整小丑真实入口 16/16 通过；小丑领域与 intake 24/24 通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\馅饼砸脸从手牌真实入口只让玩家选择己方随从并获得+2力量\20-小丑-馅饼砸脸手牌来源选择己方随从.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\馅饼砸脸从手牌真实入口只让玩家选择己方随从并获得+2力量\21-小丑-馅饼砸脸手牌来源力量收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\馅饼砸脸从弃牌堆真实入口改为+4并把行动放回牌库底\22-小丑-馅饼砸脸弃牌堆来源选择己方随从.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\馅饼砸脸从弃牌堆真实入口改为+4并把行动放回牌库底\23-小丑-馅饼砸脸弃牌堆来源力量与牌库收口.jpg`
- 当前裁定：馅饼砸脸未发现产品规则实现缺陷；对象级真实入口和生命周期证据已完成，移出小丑残余范围。小丑整体仍保持 `in_progress`，当前剩余 4 个对象：滑稽小丑、沉默小丑、跳舞小丑、小丑学院。

## 2026-09-18 继续审计回写：滑稽小丑对象级核对

- 规则语义已按当前中英文卡牌描述、弃牌堆出牌共享合同和 ability provider 对账：控制滑稽小丑的玩家可以从自己的弃牌堆选择一张标准行动，替代本回合通常行动打出；该行动结算后不留在手牌或弃牌堆，而是进入该玩家牌库底。
- 静态接入已核对：`diy_clowns_slapstick_clown` 是力量 5 的持续随从，数量 1，图集索引 0，能力注册为弃牌堆行动提供者；提供者只对当前玩家、己方场上滑稽小丑和标准行动开放，并按通常行动额度过滤。
- 领域证据：已有测试验证无目标标准行动可以从弃牌堆打出、消耗通常行动额度、离开弃牌堆并进入牌库底；共享 reducer 还验证小丑派系弃牌堆行动的牌库底去向。
- 真实入口证据：从真实牌桌打开弃牌堆面板，手动选择 `diy_clowns_confetti_bucket`，完成通常行动结算；收口状态为手牌为空、弃牌堆为空、该行动进入牌库底、`actionsPlayed = 1`、交互关闭。
- 首次失败说明：第一版场景误选了会继续生成自身后续交互的彩色围巾；失败页面显示“彩色围巾：选择要弃掉的手牌，或跳过”，说明滑稽小丑入口已命中但测试尚未完成被打出行动的生命周期。该失败是测试场景选择问题，不是产品规则缺陷；改用无后续交互的五彩纸屑桶后通过。
- 验证结果：滑稽小丑定向真实入口 1/1 通过；完整小丑真实入口当前应为 17/17；小丑领域与 intake 24/24 通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\滑稽小丑从真实弃牌堆入口用通常行动打出标准行动并放回牌库底\02-小丑-滑稽小丑弃牌堆标准行动入口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\滑稽小丑从真实弃牌堆入口用通常行动打出标准行动并放回牌库底\03-小丑-滑稽小丑通常行动与牌库底收口.jpg`
- 当前裁定：滑稽小丑未发现产品规则实现缺陷；对象级真实入口和生命周期证据已完成，移出小丑残余范围。小丑整体仍保持 `in_progress`，当前剩余 3 个对象：沉默小丑、跳舞小丑、小丑学院。

## 2026-09-18 继续审计回写：沉默小丑对象级核对

- 规则语义已按当前中英文卡牌描述、弃牌堆行动共享合同和 provider 实现对账：在控制沉默小丑且本回合尚未打出通常行动时，可以从自己的弃牌堆额外打出一张标准行动；这次额外打出不消耗通常行动额度，行动结算后按弃牌堆出牌合同进入牌库底，并记录该沉默小丑本回合已使用。
- 静态接入已核对：`diy_clowns_silent_clown` 是力量 3 的持续随从，数量 2，图集索引 4，能力注册为弃牌堆行动提供者；provider 只返回当前回合、当前玩家、己方控制的沉默小丑和标准行动候选，并以 `actionsPlayed === 0` 作为通常行动未使用条件。
- 真实入口证据：从真实弃牌堆面板手动选择标准行动，在 `actionLimit = 0` 的场景下额外打出；收口状态确认 `actionsPlayed` 保持 0、来源记录写入、行动进入牌库底、弃牌堆清空、交互关闭。
- 验证结果：沉默小丑定向真实入口 1/1 通过；小丑领域与 intake 测试通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\沉默小丑从真实弃牌堆入口在无通常行动额度时额外打出标准行动\04-小丑-沉默小丑无通常额度的弃牌堆入口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\沉默小丑从真实弃牌堆入口在无通常行动额度时额外打出标准行动\05-小丑-沉默小丑额外行动与牌库底收口.jpg`
- 当前裁定：沉默小丑未发现产品规则实现缺陷；对象级真实入口和生命周期证据已完成，移出小丑残余范围。小丑当前剩余 2 个对象：跳舞小丑、小丑学院。

## 2026-09-18 继续审计回写：跳舞小丑对象级核对

- 规则语义已按当前中英文卡牌描述、天赋执行器和弃牌堆行动共享合同对账：使用天赋后从弃牌堆随机选出一张标准行动，玩家必须在真实交互中确认是否额外打出；确认后不消耗通常行动额度，行动进入牌库底，天赋本回合标记写入。
- 静态接入已核对：`diy_clowns_dancing_clown` 是力量 4 的天赋随从，数量 1，图集索引 2，能力注册为 `talent`，并要求弃牌堆中至少有两张标准行动才可使用。
- 真实入口证据：从真实随从天赋入口打开弃牌堆面板，随机行动候选可见，玩家确认后作为额外行动打出；收口状态确认 `actionsPlayed = 0`、`talentUsed = true`、选中行动进入牌库底、另一张行动仍在弃牌堆、交互关闭。
- 验证结果：跳舞小丑定向真实入口 1/1 通过；小丑领域与 intake 测试通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\跳舞小丑从真实天赋入口随机选择标准行动并确认额外打出\06-小丑-跳舞小丑随机行动确认.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\跳舞小丑从真实天赋入口随机选择标准行动并确认额外打出\07-小丑-跳舞小丑额外行动与牌库底收口.jpg`
- 当前裁定：跳舞小丑未发现产品规则实现缺陷；对象级真实入口和生命周期证据已完成，移出小丑残余范围。小丑当前剩余 1 个对象：小丑学院。

## 2026-09-18 继续审计回写：小丑学院对象级核对

- 规则语义已按当前中英文基地描述、基地触发注册和反应队列对账：每回合第一次把随从打到小丑学院后，玩家可以从自己的弃牌堆随机把一张标准行动放入手牌；非标准牌不能被回收，同回合第二次打入不重复触发。
- 静态接入已核对：`base_diy_clowns_clown_academy` 的基地数据、中文 / 英文能力描述、`onMinionPlayed` 注册、`mandatory: false` 和 `minionsPlayedPerBase === 1` 条件一致；执行器只筛选当前玩家弃牌堆中的标准行动，并通过统一基地反应队列交给玩家接受或让过。
- 领域证据新增两条：接受分支只回收一张标准行动、非标准牌留在弃牌堆、第二次同回合打入不再生成该基地触发；让过分支不改变弃牌堆内容，触发队列和交互均清空。
- 真实入口证据：从真实手牌打出随从到小丑学院，页面出现统一 Smash Up 可选响应；玩家接受后回收到手牌的只有一张标准行动，另一张标准行动和非标准牌仍在弃牌堆；同回合第二次打入随从后不再出现小丑学院响应，最终基地、手牌、弃牌堆、`triggerQueue` 和交互状态均闭合。
- 验证结果：小丑学院定向真实入口 1/1 通过；完整小丑真实入口 20/20 通过；小丑领域与 intake 26/26 通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\小丑学院从真实打出随从入口可选回收标准行动且同回合只触发一次\01-小丑-小丑学院第一次打入后的可选响应.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\小丑学院从真实打出随从入口可选回收标准行动且同回合只触发一次\02-小丑-小丑学院回收标准行动收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-clowns-real-entry.e2e\小丑学院从真实打出随从入口可选回收标准行动且同回合只触发一次\03-小丑-小丑学院同回合第二次打入不重复触发.jpg`
- 当前裁定：小丑学院未发现产品规则实现缺陷；对象级真实入口和生命周期证据已完成，移出小丑残余范围。小丑对象级入口已覆盖全集；两派系整体仍保持 `in_progress`，下一步只剩杀人狂逐对象页面矩阵、派系级筛选 / 全生命周期补证和本批次之外的资源发布回查。

## 2026-09-19 继续审计回写：人皮脸对象级真实入口

- 规则语义已按中文规则、静态卡牌定义和能力注册对账：从真实手牌打出人皮脸后，从牌库检索电锯；再把电锯从手牌附着到人皮脸；下一次本人回合开始放置一枚 +1 力量指示物；之后进入统一可选响应窗口，玩家可以选择摧毁同基地力量 3 或以下的其它随从。
- 依赖链一并核对：人皮脸摧毁目标后，附着电锯会按其自身卡面再次进入统一可选响应窗口，玩家可以选择移动宿主；本轮真实入口明确选择“不移动”后才完成生命周期收口，不能把第一次摧毁选择后的电锯响应误判为测试卡死。
- 首次测试失败属于场景真值问题：使用水晶湖营地时，基地自身的 `onMinionPlayed` 可选响应会与人皮脸检索交互同时进入共享反应链，导致测试提交检索后仍停在无关基地响应；已改用只有计分触发的 `base_the_factory`，没有修改产品规则代码。
- 第二次测试失败属于测试断言过窄：人皮脸摧毁目标后真实状态仍有合法的电锯移动响应；E2E 已补齐“电锯响应窗口 -> 电锯移动选择 -> 明确不移动 -> 最终收口”的完整链路。
- 静态与最终状态：人皮脸进入基地并保持附着电锯；下一回合力量指示物为 1；力量 2 的目标随从被摧毁；人皮脸本回合已记录使用；电锯后续响应完成后当前交互、排队交互和 `triggerQueue` 均为空。
- 验证结果：`npm run test:e2e:file -- e2e/smashup/smashup-diy-killers-real-entry.e2e.ts --grep "人皮脸从真实打牌入口"`：1/1 通过；当前对象未发现产品规则实现缺陷。电锯的独立对象级入口仍保留为后续单独审计对象，本条只记录其作为人皮脸依赖链的真实响应已验证。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\人皮脸从真实打牌入口检索电锯并在下一回合触发摧毁\06-杀人狂-人皮脸检索电锯.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\人皮脸从真实打牌入口检索电锯并在下一回合触发摧毁\08-杀人狂-人皮脸下一回合反应窗口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\人皮脸从真实打牌入口检索电锯并在下一回合触发摧毁\10-杀人狂-人皮脸摧毁后电锯响应窗口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\人皮脸从真实打牌入口检索电锯并在下一回合触发摧毁\11-杀人狂-电锯移动宿主选择.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\人皮脸从真实打牌入口检索电锯并在下一回合触发摧毁\12-杀人狂-人皮脸摧毁目标并完成生命周期收口.jpg`
- 当前裁定：人皮脸对象级真实入口与生命周期证据已完成，移出杀人狂当前残余对象；杀人狂整体仍保持 `in_progress`，剩余 17 张牌 + 2 个基地，以及派系级筛选、全生命周期补证和本批次之外的资源发布回查。

## 2026-09-19 继续审计回写：弗莱迪对象级真实入口

- 规则语义已按中文 / 英文卡牌文本、静态定义和能力注册对账：弗莱迪打出时可以从牌库或弃牌堆获得爪子手套；天赋直到自己的下个回合开始让同基地其他玩家的仆从获得 -1 力量，并可以摧毁该基地力量 1 或更少的仆从。
- 依赖链一并核对：爪子手套附着后自身仍保留独立天赋；本轮真实入口用弗莱迪天赋摧毁对手随从，随后验证爪子手套的 `onMinionDestroyed` 触发给弗莱迪增加 1 枚力量指示物。爪子手套自身“选择一个仆从获得 -1”天赋仍作为独立对象保留在残余范围，不把依赖链观察外推为该对象完整收口。
- 静态接入已核对：`diy_killers_freddy_krueger` 的力量、`onPlay` / `talent` 标签、天赋入口、签名行动映射和 `diy_killers_freddy_krueger_destroy` 交互注册一致；`diy_killers_clawed_glove` 的附着约束、天赋注册和摧毁触发注册均已被现有领域测试与本轮真实依赖链命中。
- 真实入口覆盖：从真实手牌打出弗莱迪；在真实牌库检索交互中选择爪子手套；从手牌把爪子手套附着到弗莱迪；点击弗莱迪进入天赋交互；核对减益后的候选集合包含力量 2 经 -1 后为 1 的 `ghost_ghost`，不包含力量 3 经 -1 后为 2 的 `ghost_spirit`，并保留“不摧毁”选项；选择目标后回到最终状态。
- 最终状态核对：目标随从已被摧毁；未被选择的敌方随从仍在场并保留 `-1` 力量；弗莱迪 `talentUsed = true`；弗莱迪因爪子手套触发获得 1 枚 `+1` 力量指示物；当前交互、排队交互和 `triggerQueue` 均为空。
- 生命周期核对：领域测试额外发送控制者下回合开始事件，确认减益恢复为 0 且弗莱迪天赋使用标记重置；因此“直到你的下个回合开始”的时限没有只停留在事件生成层。
- 真实入口首次失败属于 E2E 读取层级错误：页面实际已经显示正确的减益和目标提示，但断言读取了 `current.options`，而项目交互合同把选项放在 `current.data.options`；修正断言读取位置后同一产品链路通过，没有修改产品规则代码。
- 验证结果：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/diy-killers.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：21 条通过；`node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "弗莱迪从真实打牌入口检索爪子手套并完成天赋摧毁生命周期"`：1/1 通过；`npx tsc --noEmit --pretty false`：通过；`git diff --check`：通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\弗莱迪从真实打牌入口检索爪子手套并完成天赋摧毁生命周期\13-杀人狂-弗莱迪检索爪子手套.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\弗莱迪从真实打牌入口检索爪子手套并完成天赋摧毁生命周期\15-杀人狂-弗莱迪天赋减力量后目标候选.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\弗莱迪从真实打牌入口检索爪子手套并完成天赋摧毁生命周期\16-杀人狂-弗莱迪摧毁目标并完成爪子手套触发收口.jpg`
- 当前裁定：弗莱迪对象级真实入口与生命周期证据完成，未发现弗莱迪本体产品规则实现缺陷，移出杀人狂当前残余对象；爪子手套自身天赋、其它 15 张杀人狂卡牌和 2 个基地仍未完成独立对象级真实入口，因此杀人狂整体继续保持 `in_progress`，当前残余范围为 16 个卡牌对象（含爪子手套）+ 2 个基地。

## 2026-09-19 继续审计回写：杰森与大砍刀对象级真实入口

- 规则语义已按中文 / 英文卡牌文本、静态定义和能力注册对账：杰森打出时从牌库检索大砍刀；大砍刀附着到杰森后可用天赋把宿主移动到有其他玩家仆从的基地；杰森移动到新基地后可以摧毁该处力量不超过 3 的其它仆从并获得 +2 力量；大砍刀在同基地仆从被摧毁后给己方仆从 +1 力量直到回合结束，并在杰森本回合摧毁过仆从时于回合结束回到手牌。
- 静态接入已核对：`diy_killers_jason` 的 `onPlay` / 签名装备检索、`diy_killers_machete` 的附着约束与 `talent` 入口、`diy_killers_machete` 的摧毁触发与回合结束回收注册均一致；领域测试覆盖基地移动、杰森摧毁标记和附着行动生命周期。
- 真实入口覆盖：从真实手牌打出杰森；在牌库交互中选择大砍刀；把大砍刀附着到杰森；先通过宿主真实悬停入口打开附着行动层，再点击大砍刀天赋；选择第二基地；进入统一 `smashup_reaction_choose` 响应窗口并选择杰森；候选只包含力量 3 或以下目标和跳过选项，不包含力量 4 目标。
- 最终状态核对：杰森移动到第二基地；弱目标被摧毁、力量 4 目标仍在；杰森临时力量为 +2，大砍刀触发的己方临时力量为 +1；杰森本回合使用标记写入；回合结束大砍刀回到手牌，临时力量清除，当前交互、排队交互和 `triggerQueue` 均为空。
- 首次测试失败属于 E2E 鼠标入口时序问题：测试鼠标仍停留在宿主区域时直接查找隐藏的附着层，覆盖层仍是不可点击状态；没有发现规则校验或产品状态错误。修复仅在 E2E 中先将鼠标移出再重新悬停，并断言附着层已实际可见后再点击，没有修改杰森或大砍刀产品规则。
- 验证结果：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "杰森从真实打牌入口完成大砍刀"`：1/1 通过；`npx vitest run src/games/smashup/__tests__/abilities/diy-killers.test.ts`：21 条通过；`npx tsc --noEmit --pretty false`：通过；`git diff --check`：通过。
- 截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\杰森从真实打牌入口完成大砍刀移动、反应摧毁和力量结算\04-杀人狂-杰森已附着大砍刀.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\杰森从真实打牌入口完成大砍刀移动、反应摧毁和力量结算\05-杀人狂-杰森大砍刀选择目标基地.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\杰森从真实打牌入口完成大砍刀移动、反应摧毁和力量结算\06-杀人狂-杰森移动后的反应窗口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\杰森从真实打牌入口完成大砍刀移动、反应摧毁和力量结算\07-杀人狂-杰森力量阈值目标候选.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\杰森从真实打牌入口完成大砍刀移动、反应摧毁和力量结算\08-杀人狂-杰森摧毁弱目标并叠加力量.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\杰森从真实打牌入口完成大砍刀移动、反应摧毁和力量结算\09-杀人狂-杰森回合结束大砍刀回手并清除临时力量.jpg`
- 当前裁定：杰森与大砍刀对象级真实入口和生命周期证据完成，未发现产品规则实现缺陷，移出杀人狂当前残余对象；爪子手套自身天赋、其它 12 张杀人狂卡牌和 2 个基地仍未完成独立对象级真实入口，因此杀人狂整体继续保持 `in_progress`。

## 2026-09-19 继续审计回写：麦克尔与钉子头对象级真实入口

- 麦克尔真实入口复核：从真实计分前入口进入 `smashup_reaction_choose`，选择麦克尔特殊能力后，只列同基地印刷力量不超过 3 的目标；选择摧毁后继续计分；第二条入口选择跳过后保留原始计分结果。两条真实入口均通过。
- 麦克尔首次失败不是生产规则故障：E2E 场景同时把同一张麦克尔逻辑对象放在基地，又从手牌打出第二张麦克尔，真实计分前因此合法生成两个独立触发；点击一个后另一个仍待处理，造成测试等待超时。删除基地里的重复对象，并修正对手场上力量夹具后复跑通过；本轮没有发现对应的生产规则根因。
- 麦克尔验证结果：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "麦克尔"`：2/2 通过；截图证据为计分前响应窗口、印刷力量筛选、摧毁后计分收口、跳过选项和跳过后收口 5 张截图。
- 钉子头规则语义已按中英文卡牌文本、静态定义、能力注册和共享附着链对账：打出时可从牌库或弃牌堆获得地狱魔盒；天赋必须在“转移一个你的行动到另一个随从”和“摧毁一个带地狱魔盒的随从”之间作出实际选择。
- 钉子头领域证据新增：检索地狱魔盒；把己方附着行动从原随从转移到另一个随从且不产生重复附着；摧毁候选只包含带地狱魔盒的随从；地狱魔盒只压制非其控制者的随从能力；存活的地狱魔盒见证随从被消灭后由行动控制者抽一张牌。对应 `diy-killers.test.ts` 26 条测试通过。
- 钉子头真实入口证据：从真实手牌打出钉子头，手动检索地狱魔盒，点击真实随从天赋入口，选择把己方大砍刀转移到另一基地的对手随从；收口状态确认原宿主不再有该行动、目标随从只有一份该行动、地狱魔盒仍在手牌、钉子头天赋已使用、当前交互关闭。
- 钉子头首次 E2E 失败属于断言语义错误：`data-highlighted` 是当前“随从选择模式”的高亮标记，不代表天赋可发动；页面真实随从已存在且点击入口有效。修正为等待随从可见后直接点击真实入口，未修改生产规则。
- 钉子头验证结果：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "钉子头"`：1/1 通过；`src/games/smashup/__tests__/abilities/diy-killers.test.ts` 与 `src/games/smashup/__tests__/diyKillersClownsIntake.test.ts`：32/32 通过；`npx tsc --noEmit --pretty false`：通过；`git diff --check`：通过。
- 钉子头截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\钉子头从真实打牌入口检索地狱魔盒并转移己方行动\10-杀人狂-钉子头检索地狱魔盒.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\钉子头从真实打牌入口检索地狱魔盒并转移己方行动\11-杀人狂-钉子头转移行动目标选择.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-diy-killers-real-entry.e2e\钉子头从真实打牌入口检索地狱魔盒并转移己方行动\12-杀人狂-钉子头转移行动收口.jpg`
- 当前裁定：麦克尔与钉子头对象级真实入口和生命周期证据完成，未发现两者对应的生产规则实现缺陷，移出杀人狂当前残余对象；杀人狂剩余 12 个卡牌对象（含爪子手套自身天赋、其它附着行动和基地牌）与 2 个基地仍未完成独立真实入口，派系整体继续保持 `in_progress`。

## 2026-09-19 继续审计回写：柯克船长面具领域层

- 规则语义已按中英文卡牌文本、静态附着合同和 ongoing 触发注册对账：柯克船长面具附着在己方随从后，同基地一个或更多随从被摧毁时，宿主获得被摧毁随从的有效总力量，持续到回合结束。
- 领域证据新增：有效力量为印刷力量 2 加持续修正 1 时，面具给宿主增加 3；跨基地的摧毁事件不触发；宿主自身被摧毁不触发。`src/games/smashup/__tests__/abilities/diy-killers.test.ts` 当前 27/27 通过。
- 已补真实入口 E2E：从手牌把柯克船长面具附着到麦克尔，再用野蛮攻击摧毁同基地力量 3 的目标，进入 `smashup_reaction_choose` 选择面具触发，并在后续跳过野蛮攻击加力后检查宿主临时力量和队列清理。
- 当前阻塞不是产品规则报错：标准命令 `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "柯克船长面具"` 被项目运行门禁排队，原因是另一条 `e2e/qidahen/qidahen-closeout.e2e.ts` 仍占用同一 `shared-single` 测试 runtime 和全局 E2E 预算；当前证据显示 ownerPid `62840`、Playwright pid `106148` 仍在运行。本轮只停止了自己的排队包装进程，没有清理或接管外部运行。
- 现实影响：柯克船长面具的领域最终状态已验证，但浏览器真实入口、页面反应窗口和真实生命周期尚未验证，因此不能把该对象标为已完成。
- 最小补救：外部七大恨 E2E 结束并释放 `shared-single` runtime 后，沿同一命令重新运行该面具用例；无需改生产代码，也不能用本轮领域测试替代真实入口证据。
- 历史裁定（已于 2026-09-23 被后续证据替代）：当时把柯克船长面具当作可选反应，并将其保留在残余范围；见上方 2026-09-23 修订，该 E2E 已改为断言自动累计力量并记录 1/1 通过。此处的 12 张卡 + 2 个基地只是 2026-09-19 时点统计，不代表当前残余范围。

## 2026-10-23 续审：杀人狂对象覆盖与最新入口差异

- 当前正式对象数：5 张随从、13 种行动、2 张基地，共 20 个唯一对象；对应正式数组见 `src/games/smashup/data/factions/diy_killers.ts`。
- `diy-killers.test.ts` 中除 `diy_killers_cha_cha_cha_ha_ha_ha` 外，其余 19 个对象 ID 均可定位到领域测试源码；这只表示有领域测试入口引用，不能代替每个断言本身。恰-恰-恰 哈-哈-哈 的中文 / 英文卡面分别写明“移动一个你的仆从”以及可选“将本牌置于牌库顶 / 打出额外行动”；实现包含选己方随从、选目的基地、再选后续效果的三步链，但当前没有该对象的领域测试或 E2E。审计结论是规则链未被测试证明，尚无证据判为产品实现缺陷。
- 静态消费链对账：`diyKillersChacha` 从 `findOwnMovableMinions` 找己方随从；首步 `buildMinionTargetOptions` 显式用 `effectType: 'move'`，随后 `chachaChooseMinion` 只列其它基地；`chachaChooseBase` 经 `buildValidatedBaseMoveEvents` 以 `sourceKind: 'nonAction'` 重新验证移动保护；成功后 `queueChachaFollowup` 携带原 `cardUid`，`chachaFollowup` 再由 `resolveDeckTopOrExtraAction` 执行牌库顶或限定额外行动。静态链与卡面分支对齐，仍缺最终基地 / 牌区 / 额度状态的领域与真实入口证据。
- 当前 E2E 源码包含人皮脸、电锯、弗莱迪、杰森、大砍刀、麦克尔、钉子头、柯克船长面具、野蛮攻击、简易武器和爪子手套相关流程。钉子头用例只是把地狱魔盒检索到手牌后转移另一张行动，不证明地狱魔盒自身的持续效果；`Oh No!!!` 在简易武器夹具里只是非匹配卡，也不证明其触发效果。
- 尚无对象自身规则链 E2E 的对象：恰-恰-恰 哈-哈-哈、他是个好孩子、躲藏在洗衣间、哦 不！！！、起源故事、地狱魔盒、结束了?、水晶湖营地、梦魇世界。弗莱迪用例中的爪子手套只证明其依赖摧毁触发；独立天赋用例已加入当前 E2E 文件，但未见该新增用例的执行结果。
- 当前 E2E 文件于 2026-09-24（提交 `0fb2918d1`）更新：修正柯克船长面具自动累计力量断言，并新增爪子手套自身天赋生命周期用例。已有 2026-09-23 柯克船长面具单项 1/1 记录；当前 E2E 全文件尚未复跑，2026-10-23 的爪子手套单项真实入口复核失败，因此不将“测试源码存在”记作通过。
- 本轮运行资源检查：2026-10-23 `e2e-doctor` 发现另一条 Fate of Dominion E2E 正在占用隔离 runtime，CPU 100%、可用内存 0.46GB（门槛 1GB），`e2e-single.frontend` 端口 6174 仍被占用。本轮未启动或打断该任务。下一步是资源释放后重跑当前文件，并为恰-恰-恰 哈-哈-哈 与上述无自身规则入口对象补齐真实入口 / 生命周期证据。
- 当前裁定：DIY 小丑对象级入口结论不变；DIY 杀人狂仍为 `in_progress`。首个未完成规则证据项是恰-恰-恰 哈-哈-哈（L2 测试缺失），其余对象缺口集中在 9 个对象自身真实入口，以及当前 E2E 文件的最新变更尚未全量复跑。

### 2026-10-23 爪子手套附着天赋 E2E 复核

- 资源释放后使用隔离 runtime 运行单项：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "爪子手套从真实附着天赋入口给同基地仆从减力并在下回合开始清除"`。结果失败：附着天赋卡点击后 10 秒内未出现 `diy_killers_clawed_glove` 交互；失败位置为该用例等待交互处（源码约第 1234 行）。
- 失败时页面状态证明爪子手套仍附着在弗莱迪身上，基地内有两个对手仆从；但没有候选 prompt 或天赋结果。截图同时显示一张居中的“幽灵”卡牌特写。
- `CardSpotlightQueue` 外层与卡牌内容均为 `pointer-events-none`，因此现有证据不能把失败归因于特写遮挡。当前 E2E 对附着卡使用 `locator.click({ force: true })`，没有证明桌面玩家自然悬停宿主并点击实际可见附着卡的命中路径；所以本次失败标记为入口证据失败 / 原因未定，不判定产品规则缺陷，也不计为通过。
- 静态 UI 链显示附着天赋只有在 `validate(USE_TALENT)` 有效时才进入可用集合，点击可用附着卡后会 dispatch `USE_TALENT`。仍需自然输入复跑并记录附着卡可用标记、实际前景命中元素、交互源与候选；若自然点击仍不产生交互，再据此定位规则权限或命令链。
- 本次只运行爪子手套单项，没有复跑全文件。DIY 杀人狂仍为 `in_progress`；上一节的全文件复跑待办及 9 个对象自身真实入口 / 生命周期缺口继续有效。

#### 同日真实鼠标路径复核（覆盖上节“原因未定”）

- 将现有用例改为真实鼠标步骤：悬停弗莱迪、检测附着卡前景命中区域，再经 `page.mouse` 点击；未改游戏实现。当前用例在同一 1920×1080 桌面场景重跑两次，均未能命中附着卡。
- 第一次 `attachedGlove.hover()` 等待超时；Playwright 命中日志明确显示中心点被对手 P1 基地栏 `su-base-player-column-0-1` 内 `data-card-atlas-index=5` 卡片截获。第二次对附着卡可见矩形做 9×9 前景命中采样，81 个采样点均未命中 `data-attached-action-uid="glove-card"`，因此没有实际点击；截图：`test-results/playwright-artifacts/e2e-1792753508698-cevhpe/smashup-smashup-diy-killer-a0cb1-套从真实附着天赋入口给同基地仆从减力并在下回合开始清除-chromium/test-failed-1.png`。更早一次真实 hover 的 Playwright 证据：`test-results/playwright-artifacts/e2e-1792753195275-6rc0n7/smashup-smashup-diy-killer-a0cb1-套从真实附着天赋入口给同基地仆从减力并在下回合开始清除-chromium/test-failed-1.png`。
- 场景状态确认爪子手套仍附着在弗莱迪身上，天赋为可用态，同基地有两张对手随从；页面没有活动 interaction。屏幕里附着牌没有可真实命中的前景区域，对手随从卡盖住其 overlay。静态 `USE_TALENT` 候选 / handler 路径存在，但这不能代替玩家可操作性。
- 当前裁定更新：确认 `diy_killers_clawed_glove` 在该桌面基地布局中的唯一附着卡入口被邻座卡牌遮挡，属于 `功能实现阻塞（真实入口不可达）`，不是已证实的爪子手套规则结算错误。-1 力量和下个回合开始清除仍没有浏览器结果证据。最小补救是修正附着卡 overlay 与相邻玩家栏的层级 / 摆位，再重跑同一真实悬停、前景命中、点击、目标选择和回合开始清理链。
- 本次只复跑爪子手套单项，没有复跑 E2E 全文件；DIY 杀人狂仍为 `in_progress`。未覆盖对象、Ch-Ch-Ch Ha-Ha-Ha 领域测试和基地链缺口继续有效。

## 2026-11-20 杀人狂续审

- 范围仍为杀人狂 20 个唯一对象；本次未重新审计小丑。当前工作树存在其他任务的共享 Smash Up 结算改动，以下是该工作树的局部验证，不外推到其他版本。
- 恰-恰-恰：按既有中英文合同，从正式 `PLAY_ACTION` 命令进入选择，验证仅列己方随从、选择另一基地后随从确实移动；分别选择回牌库顶和额外行动，断言已有牌前的牌库顶、弃牌堆、行动额度及交互关闭。新增 `src/games/smashup/__tests__/abilities/diy-killers-chacha.test.ts`，2/2 通过。该结果补领域最终状态证据，真实页面交互、无合法移动和其他边界仍待核，不能称对象审计完成。
- 爪子手套：隔离 runtime 复跑原 E2E，仍在附着后失败；81 个前景命中采样均不属于附着牌。当前失败截图 `test-results/playwright-artifacts/e2e-1795104978980-0un3df/smashup-smashup-diy-killer-a0cb1-套从真实附着天赋入口给同基地仆从减力并在下回合开始清除-chromium/test-failed-1.jpg`。原问题仍是玩家真实入口阻塞，尚未证明修复。
- 后续诊断复跑显示附着层的实际样式是 `opacity: 0; pointer-events: none`，宿主列为 `z-0`；上一次采样未证明已展开的附着层被邻座遮挡，因此旧“遮挡根因已确认”的说法应降为待核。测试此前没有保证鼠标先离开宿主再重新悬停，现补充这一真实鼠标步骤与浮层可命中状态断言，等待复跑；没有修改产品 UI。
- 重新悬停复跑结果：隔离 runtime `node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-diy-killers-real-entry.e2e.ts "爪子手套从真实附着天赋入口给同基地仆从减力并在下回合开始清除"` 为 1/1 通过。玩家鼠标移出并悬停宿主后，附着层可接收输入，真实命中并点击爪子手套，选取同基地目标，最终 -1 力量并在下回合开始清除，交互和触发队列清空。代表态为注入前置状态，不证明自然开局；这只覆盖该桌面场景，不证明其他布局均无覆盖问题。撤回前述“本场景已确认邻座遮挡导致产品功能阻塞”的裁定，也不把这条结果外推为整派系审计完成。
- `diy-killers.test.ts` 30/30 通过；`diyKillersClownsIntake.test.ts` 5/6 通过，失败项断言实施中派系不进入可选池，但当前 `getSmashUpSelectableFactionIds` 包含杀人狂。另一份国际事件测试要求实施中派系进入选择池；合同与历史变更仍需核对，不能直接改实现或把失败消掉。
- 历史补充：提交 `833d79ba83dfb3ce6c0d1a261d45cff4675ad352` 从参与池函数删除了实施中排除条件；提交说明未单独解释该产品决策，不能单靠代码历史断定旧断言或当前行为哪一个正确。
- 测试结构检查：`node scripts/infra/testing-structure-guard.mjs --base HEAD src/games/smashup/__tests__/abilities/diy-killers-chacha.test.ts e2e/smashup/smashup-diy-killers-real-entry.e2e.ts` 通过。E2E 增加的失败层级信息仅用于定位，不改变交互或断言。
- 结论：`仍有残余范围`。继续补恰-恰-恰及此前列出的九个对象入口和基地证据，核对参与池合同后处理失败测试。不得将本次领域绿灯和单个 E2E 外推为派系全面完成。

### 2026-11-20 恰-恰-恰后续复审

- 锁定合同：该行动强制移动自己的一个随从，随后玩家可以选择将本牌放回牌库顶或获得一次额外行动，也可以不使用可选后续。规则来源为已录入的中英文卡面；本轮不修改卡面语义。
- 发现一：原后续选择缺少拒绝选项。新增真实命令链领域用例先失败（找不到跳过），在 `queueKillerFollowupChoice` 增加 `skip` 后通过；跳过保留已完成的移动，本牌进入弃牌堆且不增加行动额度。AI 合法动作测试确认决策者可以枚举并提交跳过、非决策者不能操作。
- 发现二：目标基地选项使用 `toBaseIndex`，而牌桌基地直选消费 `baseIndex`。原始页面测试三条均在点击基地后停留在选择界面；失败截图显示基地未高亮且显示内部 ID 按钮。已将该对象选项及 handler 统一为 `baseIndex`，保留移动事件的目标参数；无产品 UI 重排。
- 验证：`diy-killers-chacha.test.ts` 与 `diy-killers.test.ts` 共 33/33 通过；`smashup-diy-killers-chacha.e2e.ts` 三条在代表态从真实手牌打出、真实点击随从和目标基地、分别点击跳过 / 回牌库顶 / 额外行动后通过，并核对位置、牌区、额度和队列。截图批次 `test-results/evidence-screenshots/smashup/smashup-diy-killers-chacha.e2e/` 下的 `_runs/e2e-1795106695305-qc2zuo`。看过基地选择原图：合法基地有可见高亮；后续按钮图仍需稳定画面复核，不记为视觉验收通过。该运行早于同文件后续对大砍刀和电锯的修改，最终收口时需以最新源码复跑。
- 同类核对命中大砍刀与电锯两个 `targetType: base` 选项也只携带 `toBaseIndex`；历史 E2E 使用 `selectInteractionOptionBy`，该 helper 实际直接发交互命令，旧“真实点击目标基地”表述失效。两处已按同一合同修正。大砍刀复跑 1/1：玩家点击基地后杰森移动并完成后续反应与清理；电锯复跑 2/2：分别在移动决策阶段真实点击跳过、点击基地移动宿主，并核对最终位置及交互 / 队列清理。电锯更早的反应和目标选择步骤仍由辅助命令驱动，本轮不将它们称为全程真实点击。
- 无己方随从边界领域测试已通过：无法移动时进入可选后续，跳过后对手随从保持不动、行动进入弃牌堆且无额外额度；尚未证明所有保护导致不可移动的情况。
- 最后源码复跑恰-恰-恰三条真实页面分支 3/3 通过，截图批次为 `_runs/e2e-1795107446601-syau4j`。抽看后续选择图：三个按钮确实可见，但按钮覆盖了刚移动的随从，基地选择绿色边框仍在退场；该图不得作为视觉 PASS，需在稳定态重新确认是否存在持续遮挡。三步交互目前仍使用既有 simple-choice，按现行多步 / AI 交互合同的 Choice Request 适配仍需审查，不能只凭 AI 跳过用例通过宣告合同收口。
- 稳定态复核证实按钮仍覆盖移动后的随从：当前玩家需要比较移动结果并选择后续，牌桌对象和按钮须同时可见。复用已有顶部停靠方式，按 `targetType: button` 与 `buttonIntent: mode` 表达共同模式选择语义，不按卡牌 ID 特判；桌面原图 `_runs/e2e-1795108400636-y7hbd2/03-预置代表态-选择后续效果.jpg` 复核可见三个选择、移动后的随从、基地及牌区，目标遮挡问题在该视口已消除。此为单状态图面结论，不代表整组截图或移动端视觉通过。受共享模式提示影响的骸骨之王与 Nexus 使用组件用例核对可提交，未作真实页面及移动端回归。
- 保护边界发现并修复：藤蔓缠绕保护所有己方随从时，旧实现先按所属玩家计算非空，过滤保护后仍创建空目标交互，领域红测直接复现卡住。现在先生成合法候选；为空时进入可选后续。领域测试分别覆盖全受保护和部分受保护；真实页面使用预置藤蔓缠绕状态打出本牌、点击跳过，确认随从留在原基地、行动进入弃牌堆、额度未增加且队列关闭。该代表态不证明自然获得保护的过程。
- 当前源码验证：杀人狂领域 36 项与提示组件 24 项共 60 项通过；恰-恰-恰真实页面 E2E 4/4 通过（预置保护态与三个后续分支），测试结构 guard 通过。截图批次 `_runs/e2e-1795108400636-y7hbd2`；按当前 UI 检查只核过上述一张后续选择图，未做全图组视觉验收。Choice Request 适配仍待审查；通用 adapter 当前未保留目标选项 `_source` / 单个 `_ai` 的原形，不能不经验证直接替换三段交互。
- 续审 Choice Request：后续模式决策已改为由 Choice Request 创建，`回牌库顶 / 额外行动 / 跳过` 是三项显式候选，必须提交其中一项，不允许另以取消绕过；跳过仍是不执行可选效果。此前领域测试中 Choice Request 快照缺失先红，改后快照的 AI 诊断为 `ok`、投影三项合法动作。AI 从正式打牌后依次重算、提交随从、基地与跳过，每步领域命令成功，最后随从位置、弃牌堆和队列均核对；非决策者无该交互动作。`diy-killers-chacha.test.ts` 7/7 与 `diy-killers.test.ts` 30/30 通过；真实页面四分支复跑 4/4，截图批次 `_runs/e2e-1795108987911-4q223v`。该变更把待续上下文写入创建的交互本体再入队，不再修改队列中可能属于其他决策的 current。
- Choice Request 范围仍不完整：前两步随从 / 基地选择仍为旧 simple-choice；项目适配器的候选投影与目标身份、`_source` / `_ai` 信息需要逐项确认，不能用后续模式迁移外推三步均已迁移。尚未核实可触发移动后的反应与后续模式并存时的完整 AI 连续链。
- 范围结论仍为 `仍有残余范围`：无合法移动边界、稳定图面复核、其它对象及本派系全量审计尚待完成。

### 2026-11-20 移动反应与选派合同复核

- 从正式打出恰-恰-恰的命令开始，AI 每步重新枚举并提交：移动杰森至有弱小敌方随从的基地、选择本行动回牌库顶、接受杰森移动反应并选择摧毁目标。领域回归断言杰森和目标的最终位置、本牌在牌库顶、交互队列 / 触发队列与反应会话均清理；每一步仅决策者有交互动作。`diy-killers-chacha.test.ts` 8/8 通过；这是预置状态下的领域链，浏览器真实操作尚在复验。
- 浏览器复验：首先错误地按同名按钮寻找杰森而超时；实际反应入口是牌桌上高亮的杰森本体，失败图已核对。改为点击牌桌随从后，同一预置代表态从手牌打出、点击随从和基地、选择回牌库顶、点击杰森及目标随从，1/1 通过；断言杰森在目标基地、目标进入弃牌堆、行动牌在牌库顶且两个队列为空，批次 `e2e-1795110477799-hq9ibd`。此链不证明自然开局或其它反应组合。
- 参与池测试冲突的合同已确认：`.spec/skills/add-new-faction/SKILL.md` 的玩家可见生命周期规定已开放的 `in_progress` 派系可以由玩家选择，保持实施中标记；`openspec/changes/refactor-game-ai-setup-composition-selection/design.md` 则要求 AI 自动选角过滤实施中对象。当前派系动作标注 `setupOptionStatus: in_progress`，共享 AI 决策上下文按此过滤；本轮静态核对消费链，不以玩家候选池推导 AI 已选或未选。
- 原 `diyKillersClownsIntake.test.ts` 将实施中派系从玩家可选池排除的断言与现行生命周期合同冲突；已改为检查关闭 DIY 扩展时这两个普通派系仍可选且保留实施中标记。该文件 6/6 通过。本次没有更改玩家或 AI 选角实现，也未移除标记；仍需真实选角入口证据与完整派系审计。

### 2026-11-20 他是个好孩子续审（进行中）

- 已录入英文卡面为先从自己的弃牌堆回收一张随从，然后打出额外行动；中文卡面语义一致。正式消费点为 `diyKillersGoodBoy` / `goodBoyHandler`，只列本玩家弃牌堆中的随从，选择后回手并给予额外行动额度。
- 无随从边界：发行商 [Bigger Geekier Box 规则书](https://www.alderac.com/wp-content/uploads/2025/04/SmashUp_BiggerGeekierBox_Rulebook_Optimized.pdf) 第 12 页 Multiple Effects 明确“做 X 然后做 Y”属于独立效果，一部分无法执行时仍执行另一部分。故没有可回收随从仍可获得额外行动；该卡未把回收写成额外行动的条件或费用。第 13 页说明出牌阶段中此类不指定卡牌的额外行动可在本阶段稍后打出。
- 新增多候选 / 对手弃牌堆隔离与无候选领域用例，以及预置状态的真实页面回收并打出额外行动用例；截至本条写入时尚未记录执行结果，不记通过。
- 真实入口红测 `e2e-1795110627053-ptg13z`：手牌打出后弃牌面板显示唯一合法随从；实际点击杰森后仍停在交互中，界面提示“点击基地部署”。定位到该回手决策错误声明为 `discard_minion`，而 Board 将此类型用于随从部署、等待基地；回手选择应使用 `discard`。已先用领域断言复现旧类型失败，再改为 `discard`；新版杀人狂领域定向 32/32 通过。浏览器原路径修复复验尚在运行，结果未确认前不称入口修复通过。
- 真实入口修复复验 `e2e-1795111029374-gmzaiv` 1/1 通过：预置代表态从手牌打出本牌，在弃牌面板手点唯一合法随从并回手，再从手牌实际打出巫师的秘术学习，核对两张新手牌、已回收杰森、三张弃牌、已用行动数及队列清理。看过该批两张图：决策图中合法杰森有高亮、其余牌不高亮，结果图显示杰森和两张学徒在手；该证据只覆盖本桌面状态，不代表自然开局或整派系视觉通过。
- 同类检索中格林童话的大灰狼 / 青蛙王子也使用 `discard_minion`，但其规则是固定基地额外打出，是否有有效基地入口尚需在该派系真实场景验证；此处仅登记线索，不以静态相似性判定缺陷或改动。

### 2026-11-20 躲藏在洗衣间：来源疑点

- 已核对正式图集第 11 槽中文卡面，与中文 locale 一致：打到其他玩家随从，获得额外行动；杀人狂打入或移入后，“除非它的控制者”弃牌并移动“这个仆从”，否则牌的控制者可以摧毁该仆从。英文 locale 使用 “unless its controller ... moves this minion”。两者的代词均未明确指向刚进入的杀人狂还是被附着的随从；当前实现由被附着随从的控制者作逃离选择。尚未找到该自制派系更明确的独立原始规则说明，不把当前实现当作代词裁决，也不据主题猜测改规则。
- 上述指代疑点已由发行商 [Slashers 逐卡规则页](https://smashup-rulebook.alderac.com/wiki/Slashers) 的 Hide in the Laundry 原文解决：其语序将 `its controller` 紧接在 `this minion` 后，指被附着随从的控制者。此前向用户提出的指代问题不再需要回答；现有控制者选择与此一致。卡面译名和人物名与发行商原版不同，但该卡英文能力、卡图和派系结构对应；仍需核实时序与各分支，不能把指代解决当作全卡通过。
- 另一个待复核边界：逃离候选只按手牌和无杀人狂基地生成；若被附着随从受“不能移动”保护，选择是否会先弃牌却无法完成移动，尚需按真实命令链复现并裁定条件效果。现有移动触发领域测试不覆盖逃离分支或保护交互，也没有此卡真实页面完整生命周期。
- 保护边界领域红测已复现：预置附着和藤蔓缠绕，从正式 `PLAY_MINION` 打出杰森，宿主不可移动但仍进入 `laundry_room_escape`。按发行商规则书第 12 页，条件中的弃牌并移动必须完整做到才能避免摧毁；现将候选基地通过与正式移动一致的合法性检查，提交时也先确认实际产生移动事件，才弃牌。保护状态改为进入行动牌控制者的可选摧毁；领域测试核对对手手牌保留、宿主进入弃牌堆。未保护时，现行宿主控制者选择弃牌并移动仍成功。两项测试通过；这一修正不裁定前述控制者指代。真实页面复验进行中。
- 保护代表态浏览器复验 `e2e-1795111621823-j67mqy` 1/1：玩家真实打出洗衣间并附着对手随从，获得额外行动；打出杰森后直接进入可选摧毁，点击宿主后核对双方弃牌堆、对手手牌保留及交互 / 触发队列清空。审看该决策图，可见指令、目标高亮和跳过入口。该场景的藤蔓缠绕由状态预置，不代表自然获得保护或逃离分支通过。最新领域回归 32/32，包含 AI 枚举并提交摧毁和非决策者不能响应；ESLint 与测试结构 guard 通过。

### 2026-11-20 哦 不！！！续审（进行中）

- 卡面合同：己方一个随从本回合 +3；自己摧毁其他玩家随从后，可将此牌作为额外行动打出。领域测试从正式打出恰-恰-恰开始，AI 每步重算并移动杰森、摧毁对手随从、选择本牌特殊触发与己方强化目标，核对牌区和 +3，再推进回合验证清零；1/1 通过。
- 首次浏览器链 `e2e-1795112192321-15vb0y`：摧毁后反应窗中“哦 不！！！”按钮可见，但同一手牌置灰，真实点击手牌不能响应，未进入强化选择。原因是 Board 仅把 `play_action` / `play_minion` 反应映射到手牌，手牌来源的可选 `trigger` 被当作按钮；其触发队列已有来源卡 UID。
- 按来源 UID 将能唯一映射的手牌可选触发交给手牌本体承接，并移除重复按钮；同一牌有多个触发或同时具有直接出牌选项时保留独立选项，避免误选。规则执行与 AI 候选未更改。整理前版本的浏览器原路径复跑 `e2e-1795112688163-spqsn0` 1/1：点击高亮手牌、选己方目标，核对受害者 / 行动牌弃牌、+3、交互清理及真实结束回合后 +3 清零。共用映射已拆为纯函数，唯一映射、重复触发、直接出牌冲突、禁用 / 强制 / 非本人手牌 3 项测试通过；最终整理后浏览器复验尚在运行，暂不记最终版本的页面通过。
- 最终整理后原路径复验 `e2e-1795112919104-bbfzw1` 1/1 通过，已看两张状态图：反应时手牌高亮、提示点击手牌且无重复行动按钮；随后己方目标高亮并能选择。领域与映射测试 4/4、定向 ESLint（错误级）和测试结构 guard 通过。此证据是预置代表态、桌面视口，其他手牌触发类型及多响应冲突只有纯函数合同测试，没有被该图外推为全量页面通过。
- 共享影响复验 `e2e-1795113194547-2tgkjj` 1/1：原有计分后 `play_action` 手牌响应仍高亮合法牌、禁用普通牌、无重复代理按钮，并可让过后正常结束响应。该项没有点击打出旧响应牌，不能写成旧响应全生命周期回归。

### 2026-11-20 起源故事：来源与空牌库边界

- 发行商 [Slashers 官方逐卡规则](https://smashup-rulebook.alderac.com/wiki/Slashers) 对 Origin Story 明确：场上没有杀人狂时必须抽杀人狂，不是玩家任选普通随从；当前分支条件与此一致。中文图面与本地英文录入表达一致，但官方页另提供该消歧裁定。
- 发行商 Bigger Geekier Box 第 13 页规定开始抽牌时牌库为空，先将弃牌堆洗成新牌库。新增真实 `PLAY_ACTION` 领域用例：牌库为空、弃牌堆有杰森，验证洗牌、抽取及额外行动；执行结果待记录。对“从牌库顶抽指定类型”时未命中牌的处理，官方已检索到的明确释义针对的是“从牌库顶打出”，不能直接把其翻开与洗回规则外推为“抽取”；该差异继续查证。
- 上述空牌库测试先失败：未从弃牌堆抽到杰森。修复共用的指定卡抽取助手，在开始时牌库为空时调用项目洗牌事件链，再从洗后的牌查找；同时让简易武器保留洗出卡对象，避免抽到后丢失限定额外行动。领域测试 3/3：洗入并抽到杰森、洗后无杀人狂时牌仍在牌库且获得额外行动、简易武器抽到大砍刀并可实际额外附着。既有杀人狂领域回归 30/30 通过。
- 真实页面 `e2e-1795114004889-1ka930` 1/1：预置空牌库与弃牌堆中的杰森，实际打出起源故事，核对杰森入手、不在弃牌堆、额外行动额度和队列清理；两张桌面图已核，分别可见空牌库 / 弃牌与抽到手的杰森。只证明该代表态，不证明剩余牌洗牌顺序或未查明的牌库顶抽牌合同。

### 2026-11-20 地狱魔盒：批量摧毁未收口

- [发行商 Slashers 官方页](https://smashup-rulebook.alderac.com/wiki/Slashers) 的 Puzzle Box 合同：宿主不由行动牌控制者控制时取消宿主能力；一个或更多随从被摧毁后抽一张，不限定在本基地。
- 正式 `PLAY_ACTION` 领域链复现：魔盒附着于基地 A 的己方随从，玩家以侧翼开炮在基地 B 同时摧毁对手两个随从，两个目标均进入弃牌堆，但实际抽了两张；`diy-killers-puzzle-box.test.ts` 对“一批只抽一张”的断言失败。该用例证明跨基地有响应及同批重复抽牌；不是浏览器验收。
- 根因范围：`processDestroyTriggers` 当前为每个被摧毁随从各建立独立 `sourceEventId` 和反应实例，`MinionDestroyedEvent` 没有正式的同时摧毁批次身份。单凭时间戳、卡牌名或一个进程内去重表无法证明两个摧毁属于同一规则事实，尤其可能把连续两次独立摧毁合并；另需覆盖防止 / 延迟救援后恢复。尚未用局部跳过掩盖该问题，红测仍保留；需在正式事件 / 结算链建立批次身份并核对所有多目标摧毁来源及“一个或更多”消费者，再验证独立批次各触发一次。
- 同一真实侧翼开炮命令链扩测显示，爪子手套给宿主放了 2 个 +1 指示物、大砍刀给宿主 +2 力量，官方合同均为一批一个或更多摧毁后触发一次，应各为 1；3 个领域断言均红。柯克船长面具同样为“一个或更多”，但还需要从同批多个被摧毁随从中选择一个力量，尚未以多目标链复现，不把静态风险当成已验证现象。
- 柯克船长面具存在来源差异：发行商 Austin Kirk Mask 写选择其中一个被摧毁随从的力量，本地英文文案写被摧毁随从的总力量；中文文案也使用“总力量”。同批处理不能仅凭英文 Wiki 越过项目卡面来源裁决，须逐一对齐本地图册原文及派系来源，再决定是否改为玩家选择。

### 2026-11-20 水晶湖营地：消灭后的力量目标

- [发行商逐卡文本](https://smashup-rulebook.alderac.com/wiki/Slashers) 与项目中英文文案均写同基地的一个随从，并未限定该随从由消灭者控制。原实现只列己方随从，历史测试也错误断言不能选择对手。替换该断言后先红测，确认对手目标缺失；现改为同基地任一合法随从，消灭者仍负责选择。
- 定向领域链通过：真实 `PLAY_ACTION` 野蛮攻击，选择并摧毁对手随从，水晶湖反应选择另一个对手随从，后者获得被摧毁随从的 2 点力量。既有领域文件 30/30 在新增完整链之前通过，新增链单独 1/1；真实浏览器点击和图像证据尚在运行。
- 原路径桌面浏览器预置态 `e2e-1795115015745-h5xpgr` 1/1：点击摧毁目标、点击高亮的对手随从，结果显示 +2、力量总值正确且队列清空。选择时画面另出现未翻译的 `UI.SKIP_DESTROY_MINION` 按钮，属于前一步野蛮攻击的跳过文案；已补中英文文案，正在验证该按钮在下一交互是否及时消失，不能将首次截图记作完整视觉通过。
- 最终复跑 `e2e-1795115296990-pxvsnx` 1/1：野蛮攻击的跳过按钮显示中文；切换到水晶湖选择时该按钮在过渡后消失，再点击对手随从得到 +2。已审看新决策截图，两方目标高亮、标题和目标同屏，未再出现旧按钮。该项只覆盖桌面预置代表态。
- 额外来源差异待裁决：项目中文野蛮攻击文案写“你可以……摧毁”，发行商 Brutal Attack 英文第一段写“Destroy”，只对后续加力写 may；现有实现与旧测试允许跳过摧毁。需要核验本地卡面和该 DIY 重译版本与发行商规则之间的对应关系，不能单凭任一文本贸然删除跳过入口。
- 已裁看运行时中文图集第 5、6 格：面具卡面确为“被摧毁仆从的总力量”，野蛮攻击首段确为“你可以……摧毁”。这不是录入文案与图片不一致；与发行商英文对应卡存在实际来源分歧，须明确此 DIY 素材是独立合同还是移植 / 翻译后再统一，现暂保留本地卡面对应行为。

### 2026-11-20 结束了？指定额外行动时机

- [发行商规则书第 13 页](https://www.alderac.com/wp-content/uploads/2025/04/SmashUp_BiggerGeekierBox_Rulebook_Optimized.pdf) 规定指定某张牌的额外打出机会必须立即使用；The End? 允许玩家打出回收的那张附着行动。真实出牌及回收的领域测试先红：回收后没有立即选择，额度可留待之后。改为立即选择并允许放弃；打出与放弃两个完整分支正复验。简易武器同样引用抽出的特定牌，仍待核对和覆盖，不能把这一修正外推为两张卡都通过。
- 两个领域分支通过：回收大砍刀后立即选择使用并附着至宿主，或选择放弃后牌留手中且没有可暂存的限定额外行动；连同旧回收用例 3/3。对应真实浏览器路径正在复验。
- 真实页面预置态 `e2e-1795115719917-55ou4t` 1/1：从弃牌面板点击大砍刀、立即点击手牌、点击高亮宿主后附着，弃牌与额度正确；审看决策与结果图。该图是桌面代表态；结果截图仍包含消失动画中的旧按钮，不作为完整视觉通过。
- 简易武器以同一规则新增领域红测，确认先前也是暂存额度；改成立即选择后又发现即时出牌链没有把“回合结束摧毁”传入附着执行。现沿即时出牌执行上下文传递既有标记，不在牌局里增加第二套状态；领域回归 37/37，包含立即打出并验证回合结束处理、放弃后手牌保留、空牌库洗出目标。当前真实页面重新覆盖立即打出与结束回合，仍在运行。
- 页面 `e2e-1795116171875-sgwpdj` 在附着成功后结束回合失败：装备仍在场。完整领域命令复现，证实抽牌阶段把简易武器从弃牌堆洗入手牌，而原回合结束触发只在原牌仍处弃牌堆时收集，手动直接调用 trigger 的旧单测无法覆盖。现让延迟触发以附着装备的到期标记为依据，不依赖原行动牌位置；另防止此无牌区来源的延迟事实被自动 POD 别名重复注册，并过滤宿主未消灭任何随从时的大砍刀空反应。真实 `ADVANCE_PHASE`、洗牌回手及对手反制窗口让过两项领域测试通过；最终浏览器复跑中，不能将首轮失败说成页面通过。
- 修复后页面 `e2e-1795117111855-y518cl` 1/1：预置代表态下打出简易武器，从立即决策点手牌大砍刀、点宿主附着，再真实结束回合；状态核对装备离场并进入弃牌堆，队列为空。已看结束后的桌面截图；此证据不证明面具、保护或其他装备组合的所有时序。
- 最新杀人狂领域与空牌库回归 39/39，覆盖反制窗口让过、出牌机会放弃、真实结束回合洗回原行动牌；测试结构 guard 与相关 ESLint 错误级检查通过。独立的批量摧毁测试仍有 3 项红测，未包含在这 39 项通过数中。
- 共用触发对齐测试 14/14；额外运行 `ongoingEffects.test.ts` 为 46/47，其中失败断言涉及 `ghost_haunting_pod` 保护注册别名，不是本次简易武器触发路径。当前尚未做该失败的历史基线对照，因此不能断言其既有根因或将整个共用回归写成通过。
- 基线对照：将当前 HEAD 的 `ongoingEffects.ts` 单独复制为临时测试模块，使用当前工作区其余依赖重跑该幽灵断言，得到同样的 `ghost_haunting_pod` 不存在失败；临时模块及测试已移除。该对照排除了本轮该模块修改作为单独起因，但不是完整干净 HEAD 工作树对照，也不解释该幽灵行为的根因。
- 共享出牌与触发链修改后重跑 `smashup-diy-killers-real-entry.e2e.ts` 全文件，`e2e-1795117962474-axlbwl` 14/14；覆盖该文件内的派系详情、水晶湖、杰森、钉子头、面具、野蛮攻击、麦克尔、人皮脸、电锯、简易武器、弗莱迪和爪子手套。它不覆盖该文件外全部对象和场景，不覆盖三项批量摧毁红测，也不等于派系全面审计完成。

### 2026-11-20 梦魇世界并列最低值计分入口

- 中文图集、项目规则及发行商基地文本均要求计分前摧毁所有并列最低力量随从。首次页面 `e2e-1795117627314-e3yk3b` 已看到 5:0 和基地替换，但测试把牌库设空，后续抽牌洗走弃牌，故弃牌断言失败；不能据此推断摧毁事件失败。
- 调整预置牌库并增加领域事件断言后，真实页面 `e2e-1795117801706-1iof5q` 1/1：基地初始总力量 24 / 22，双方各一个力量 2 随从并列最低；真实结束回合后，事件流中梦魇世界各摧毁这两张，强随从因计分清场入弃牌，玩家 0 获 5 VP、玩家 1 为 0，基地替换、队列清理。已看计分前与计分后桌面图；没有装备、保护或防止摧毁的组合不能借该代表态推断通过。

### 2026-11-20 杀人狂对象覆盖矩阵（持续更新）

以下 `部分` 只表示列出的直接场景已验证，均不代表对象的全面审计通过；全体尚需按规则来源、边界、AI、交互、资源及共享链逐项补证。批次错误及中英文来源差异影响的对象仍明确保留缺口。

| 对象 | 已验证的直接场景 | 当前缺口 / 状态 |
| --- | --- | --- |
| 人皮脸 | 入场检索电锯、指示物后摧毁及电锯移动 / 让过，整文件页面回归通过 | 其他组合与边界未全部核对；部分 |
| 弗莱迪 | 入场检索、天赋减力及摧毁、减力清除，整文件页面回归通过 | 其他组合与边界未全部核对；部分 |
| 杰森 | 入场检索、移动、可选摧毁与结束回合，整文件页面回归通过 | 其他组合与边界未全部核对；部分 |
| 麦克尔·麦尔斯 | 计分前摧毁 / 让过与计分，整文件页面回归通过 | 其他组合与边界未全部核对；部分 |
| 钉子头 | 检索魔盒与转移己方行动，整文件页面回归通过 | 摧毁带魔盒宿主及其交互边界需继续核对；部分 |
| 柯克船长面具 | 单个摧毁按有效力量加成，整文件页面回归通过 | 本地图册与发行商英文同批合同不同，待来源裁定；部分 |
| 野蛮攻击 | 印刷力量筛选、摧毁与加力，整文件页面回归通过 | 本地图册与发行商英文首段可选性不同；部分 |
| 恰-恰-恰 | 移动、两种后续、让过及杰森反应的预置页面链 | 全部保护组合和来源一致性未闭合；部分 |
| 电锯 | 附着、人皮脸联动及移动 / 让过页面链 | 其他摧毁来源及跨基地边界未全部核对；部分 |
| 爪子手套 | 附着、减力、下回合清除页面链 | 同批多个摧毁重复加指示物，红测未修；失败 |
| 他是个好孩子 | 弃牌回收随从并实际打出额外行动的预置页面链 | 非自然开局与其他候选 / 保护边界未全部核对；部分 |
| 躲藏在洗衣间 | 受保护无法移动时可选摧毁；双客户端选牌后逃离 / 放弃及来源控制者让过；直接拒绝后控制者选择摧毁 | 顺序解释及所有保护组合未闭合；部分 |
| 简易武器 | 立即选择、附着、反制让过与结束回合摧毁；页面回归通过 | 从牌库抽指定类型的完整合同及其他装备组合仍需核对；部分 |
| 大砍刀 | 杰森移动、单次摧毁响应和回手页面链 | 同批多个摧毁重复加力，红测未修；失败 |
| 哦 不！！！ | 摧毁对手后点手牌响应并强化，预置页面链 | 其他摧毁来源与冲突响应页面覆盖未完成；部分 |
| 起源故事 | 空牌库洗入弃牌后抽杀人狂的预置页面链 | 从牌库顶抽指定类型时其他牌如何处理仍待查证；部分 |
| 地狱魔盒 | 检索 / 转移页面链，单次摧毁领域测试 | 同批多个摧毁重复抽牌，红测未修；失败 |
| 结束了？ | 弃牌回收、立即选择附着或放弃，领域两分支及页面打出链 | 其他目标 / 反制边界未全部核对；部分 |
| 水晶湖营地 | 摧毁后选择对手随从获得力量；随从、基地行动及泰坦栏打出触发并能摧毁加力；普通行动 / 随从附着不触发；下一玩家回合可再次使用 | 同时摧毁与更多保护组合需继续核对；部分 |
| 梦魇世界 | 计分前摧毁并列最低力量随从并完成计分页面链 | 保护、替代 / 救援和装备同时响应未覆盖；部分 |

### 2026-11-20 洗衣间对手逃离页面续审

- 单页测试用调试面板切换 P1 失败：界面仍为 P0 显示等待 P2，故该运行不作为线上逃离失败证据。改为实际建立双人测试房间，双方完成选派后注入代表态；首次双客户端运行已确认 P1 收到逃离选择，测试误把卡片候选按按钮查找而失败。
- 双客户端第二次运行 `e2e-1795119397222-5dvej2` 实际点选候选、弃牌及移动成功，但原始截图判 `REVISE`：同一张手牌因两个目的地重复出现，且此前候选显示的是宿主卡而非弃置卡、目的地原为截断的内部 ID；这会妨碍区分行动。
- 现改为由同一个 Choice Request 选择实际手牌，再由后续 Choice Request 点选安全基地；两步完成前不弃牌，第二步可放弃回到来源控制者的摧毁决定。领域测试已验证 AI 可以依次选择手牌与基地，最终状态正确；两步页面、第二步放弃及新截图仍在复验，不能沿用上次视觉通过。
- 双客户端预置态 `e2e-1795120701584-5yu2bk` 2/2：对手在自己页面选手牌、点安全基地，完成弃牌和移动；另一分支在选牌后点“不逃离”，手牌保留，行动牌控制者看到摧毁决定并可放过。领域用例同样覆盖 AI 两步和中途放弃。期间一次失败是旧手牌按钮的退出动画仍保留 DOM，等待其隐藏后复跑；不是将旧层误选作为通过。
- 桌面 1920×1080 视觉裁决 `PASS 95/100`，只覆盖洗衣间选手牌 / 选基地及放弃结果三态：玩家第一眼可按标题点高亮手牌或“不逃离”，随后点两个高亮基地；手牌本体只出现一次，基地名称以场上正式基地承接，不出现内部 ID。布局主次、两步目标对齐及分组均通过；卡图、手牌、基地和放弃入口各自承担单一职责，未见本轮硬失败。评分依次为任务 19/20、层级 14/15、识别 15/15、载体 14/15、布局 14/15、素材 10/10、操作 9/10。尚未覆盖移动端、更多手牌或多个无效基地，不能外推为全派系视觉通过。
- 最终两步改动后的杀人狂五份领域用例 50/50（含恰-恰-恰、哦不、洗衣间、起源故事）；结构 guard 与相关 ESLint 错误级检查通过。该数字不包含仍失败的批量摧毁红测。

### 2026-11-20 同批摧毁与雄蜂替代结算

- 从真实行动命令打出海盗齐射，对同一基地的两名忍者发起一次同时摧毁；巨蚁雄蜂在另一基地可逐个消耗指示物防止，地狱魔盒位于第三个基地。两次均不防止时，两名忍者实际进入弃牌堆，但魔盒错误抽两张（应为一张）；防止第一名、放行第二名时，只摧毁一名且抽一张。两次选择确实跨越了独立的玩家交互。
- 对照测试通过：同一回合两次独立打出齐射，各摧毁一名随从，魔盒应各触发一次并抽两张。因此不能以本回合、时间戳或来源牌名粗略去重。
- `diy-killers-puzzle-box.test.ts` 当前共有四项明确红测：魔盒、爪子手套、大砍刀对无防止的同时摧毁重复触发，以及雄蜂两次均放行后魔盒重复抽牌；防止一次及两次独立行动的对照各通过。修复需要以真实结算事务保留同批身份并覆盖替代选择，当前尚未修复。

### 2026-11-20 水晶湖打牌范围与文案

- 实际图集 `public/assets/i18n/zh-CN/smashup/base/compressed/diy_killers_bases.webp` 的第 0 张基地卡（图集 SHA-256 `7285f0152fee32a672611af3df22dc648b76df9ccd0694e6aae17941237fb08b`）写的是“你打出一张牌到这里后”。之前中英文录入遗漏“到这里”，已按卡图补齐；不能据错误录入判定其他基地漏触发。
- 真实领域命令链检查：随从打到其他基地、普通行动未指定基地时不触发；随从打到水晶湖、行动附着在该基地随从上时，均实际进入水晶湖可选反应并可进入摧毁选择。同回合使用摧毁后再打附着行动不再次触发，另一目标仍在场；若第一次选择不摧毁，则后续打牌仍可触发。水晶湖相关领域测试 10/10，整份杀人狂能力领域测试 42/42，通过不代表其他牌型与所有时序均完成。

### 2026-11-20 大砍刀与防止摧毁

- 从大砍刀天赋移动杰森，再选择摧毁对手随从；雄蜂实际防止后随从仍在场，旧实现仍写入“杰森本回合摧毁过随从”标记，导致结束回合错误满足回手条件。旧实现的标记在选择目标时写入，早于最终摧毁结果。
- 现通过确认后的摧毁事件携带实际来源实例，再由大砍刀的摧毁反应记录；雄蜂和九命之屋选择放行时保留原摧毁来源。领域测试覆盖两种救援各自的救下与放行，以及原有真实摧毁；杀人狂、巨蚁和待救援合同三个测试文件合计 84/84。两个双客户端页面分支正在验证，尚不能据领域通过推断页面通过。共享同批摧毁四项红测仍独立未修。
- 补测非杀人狂宿主：钉子头可以跨基地摧毁魔盒宿主；猫咪威斯克可装备大砍刀并通过自身天赋摧毁己方另一随从。前者在修复后通过；后者原能力选择链未传递威斯克实例，导致实际摧毁后不记账，已补齐普通 / POD 威斯克来源传递。杀人狂与猫咪两份领域测试 63/63；其他派系能力是否完整提供消灭来源仍需继续审计，不能外推为全部宿主通过。
- 双客户端首次进入杰森反应时，测试错误查找未渲染的选项按钮而超时；应点击场上杰森作为反应来源。该失败不证明规则失败，修正后重跑中。
- 继续补证发现卡面只说宿主“本回合摧毁过”，并不要求摧毁时已经装备：真实命令链先由钉子头摧毁、再装备大砍刀，旧逻辑在回合结束未回手。现已用 `turnDestroyedMinions` 既有正式回合事实保留来源实例，大砍刀直接检查该记录；此方案取代上文临时的随从标记方案，同时覆盖装备之前发生的真实摧毁和救援后未发生的摧毁。
- 另补杏子公主、大白鲨天赋的来源传递，技术魔法少女原链已带来源；与威斯克分别通过四个非杀人狂宿主代表测试。当前杀人狂能力文件 52/52；`ongoingMinionTriggerAudit.test.ts` 需使用 `vitest.config.audit.ts`，已按该配置 352/352。更广泛宿主组合仍须继续审计，不能仅凭代表测试认定全部覆盖。
- 第二次双客户端运行未进入选派界面，运行期间资源检查记录可用内存低于 1 GB；它未覆盖到大砍刀选择。资源恢复后第三次运行中，当前仍未有双客户端页面通过证据。
- 随后两次独立双客户端预置态通过：`e2e-1795123852659-0ei0nm` 玩家点大砍刀天赋、基地、杰森反应和目标，对手点雄蜂防止；结束回合后目标仍在、装备仍附着且未回手。`e2e-1795123980302-amdnpn` 对手点“不防止消灭”，目标离场，结束回合装备返回手牌。已查看两次原始截图，放行结果中手牌可见大砍刀；两个测试均是注入后的实际页面点击，不证明自然开局或全部宿主 / 替代组合。
- 正式摧毁记录增加来源字段后，六份共享回归首次为 146/147：唯一失败是制高点测试对记录完整对象的旧断言缺少现已真实保留的来源 UID。已把该事实补进断言，制高点和克苏鲁记录相关测试复跑 79/79；并非将首次六份测试误报为全部通过。目标测试结构 guard 通过。
- 全项目 `npm run typecheck` 当前失败：`src/pages/ExternalRoomPage.tsx:95` 调用参数错误，`vite.config.ts:26` 的未跟踪 `local-preview-public.mjs` 缺类型声明；两处均为当前工作区已有的其他改动，类型检查未报告本轮杀人狂相关文件错误，不能将整个项目类型检查写成通过。
- 回合记录方案完成后重跑同批摧毁文件，仍为 4 失败 / 2 通过，失败事实与前述一致；大砍刀回手修正不等于同批重复触发已修复。
- 追加生命周期反例：发行商[规则](https://smashup-rulebook.alderac.com/wiki/Detailed_Rules_for_Cards%2C_Abilities%2C_and_Other_Wackiness)规定牌离场再进入视为新牌。真实命令链让钉子头先摧毁、通过“从头来过”返回并重打，再装备大砍刀；仅按牌 UID 查询历史的中间方案错误地让装备回手。现改为在实际摧毁事件落地时给在场来源随从记录最近摧毁回合，随从离场时该实例事实随之消失；此方案取代上文 UID 历史查询，并保留先摧毁、后装备与救援防止的正确行为。杀人狂能力文件更新后 53/53；本改动后的双客户端两条路径还需重新运行，上述先前通过仅证明当时版本。
- 又确认 `turnNumber` 在同一轮不同玩家间相同；以轮数判断“本回合”会跨玩家误认。最终方案改为在场实例的布尔事实，所有玩家每次开始新回合时清除；真实命令链验证钉子头摧毁后交给下一玩家，即使轮数仍为 7，该事实也已清除。杀人狂能力文件 54/54，附着能力审计 352/352；此最终版本的双客户端复测仍待进行。

### 2026-11-20 水晶湖附着牌口径纠正

- 上文“行动附着在该基地随从上时触发”结论作废。发行商[规则](https://smashup-rulebook.alderac.com/wiki/Detailed_Rules_for_Cards%2C_Abilities%2C_and_Other_Wackiness)明确区分附着随从的行动与打在基地上的牌；水晶湖卡图写“打出一张牌到这里后”和“你在这个基地的牌的数量”。
- 实际命令链先复现两项错误：打出大砍刀到基地上的随从时错误触发水晶湖；基地有己方随从、附着行动和基地行动时错误把附着行动算入牌数，力量 3 的目标被错误列为合法。现按基地牌与随从附着分开计算和触发；基地行动 / 随从正向、附着行动负向、基地牌数、每回合一次及让过分支合计水晶湖相关 12/12。泰坦打出触发和各类其他牌型尚未核验，不能把此代表测试作为整基地收口。
- 后续领域测试验证在场泰坦与埋葬牌计入基地上的牌；真实 `ACTIVATE_SPECIAL` 打出泰坦的链路则暴露遗漏基地触发。现向公共泰坦打出事件链接入基地触发，水晶湖测试红转绿；仍需泰坦共享回归、页面及其他边界。
- 页面预置态 `e2e-1795125997532-ept1oq` 从手牌实际打出基地行动、点基地反应，力量 2 的目标高亮、力量 3 的目标不高亮；测试通过。截图抓到前一层“让过”退出动画与当前“跳过”暂时重叠，当前不可作为最终视觉通过，已加入等待过渡隐藏的断言，待重拍。
- 加入等待后复跑 `e2e-1795126198171-sh01a7` 1/1，原始截图确认旧“让过”消失，只保留“跳过”；力量 2 的目标有绿框，力量 3 的目标未高亮。桌面该选择态 `PASS 89/100`：任务 18/20、层级 13/15、识别 14/15、载体 13/15、布局 13/15、素材 10/10、操作 8/10；同一玩家的两张敌方随从有部分叠放，但可通过顶部力量与绿框识别当前合法目标。此裁决仅覆盖该预置桌面状态，不覆盖移动端或泰坦页面入口。
- 泰坦与杀人狂四份领域回归 72/72，包含实际打出泰坦后基地触发；埋葬牌 / 在场泰坦计数也各有代表链。页面测试只覆盖普通基地行动，不外推为泰坦页面操作通过。

- 追加普通行动反例：`penguins_a_wish_for_wings_that_work` 通过真实 `PLAY_ACTION` 指定水晶湖作为效果目标，错误地入队水晶湖触发；事件的 `targetType: base` 只表示选择效果目标，不能单独证明牌打在基地上。修正为核查被打出的牌实际在该基地的行动区，保留普通基地行动正向、随从附着行动负向与泰坦路径；水晶湖相关领域测试 16/16。此测试覆盖项目当前基地行动表示，其他特殊牌与页面路径仍须核验。
- 当前代码再次执行全项目 `npm run typecheck`，退出码 1，仍仅报告 `ExternalRoomPage.tsx:95` 参数和未跟踪的 `vite-plugins/local-preview-public.mjs` 类型声明两处工作区错误；因此全项目类型门禁未通过。本轮水晶湖与相关公共源文件定向 ESLint 已通过。
- 最终在场实例标记 / 每名玩家回合开始清除方案，双客户端页面复跑 `e2e-1795126708665-px5a8p` 2/2：雄蜂选择防止后目标与装备留场；选择放行后目标离场并在回合结束时将大砍刀返回手牌。已复核雄蜂选择及放行结果原图：防止目标绿色高亮、按钮为“不防止消灭”，结束后手牌可见大砍刀。此为桌面预置态及该两条路径证据，不覆盖全部宿主、自然开局和同批摧毁。
- 当前代码复跑杀人狂能力文件及泰坦共享三份文件，共 73/73；第一次命令给错两条文件路径，实际只执行 66 条，已以正确路径单独补跑 7 条，统计不包含未运行文件，也不覆盖同批摧毁失败文件。
- 洗衣间补充直接拒绝逃离与控制者选择摧毁：首次页面运行到摧毁选择后，测试误用基地属性 `data-selectable` 检查随从而失败；实际随从为 `data-highlighted=true`。修正测试后双客户端 `e2e-1795127051427-x3hly5` 1/1，真实点击“不逃离”和高亮宿主，宿主进入拥有者弃牌堆、对手手牌保留。已核看选择 / 结果桌面截图，目标高亮且“跳过”独立，结果场上宿主消失、附着行动进入拥有者弃牌堆；仅覆盖该预置态。
- 对“海盗齐射同时摧毁两个随从、两次雄蜂均放行”的真实命令链做临时跟踪：选择目标后有两个雄蜂防止交互排队、`sys.resolution.frames` 为空；第一次放行产生 enemy-1 的新 `MINION_DESTROYED`、一次魔盒触发及抽牌，第二次放行再产生 enemy-2 的新摧毁、一次触发及抽牌。原始同一效果与两次恢复之间没有共同结算帧，是跨交互去重不能仅靠当前事件数组解决的直接证据。跟踪日志在本地 `temp/smashup-destroy-batch-trace.log`，仅为诊断，不当成修复。
- 发行商 [World Tour: Culture Shock 规则书](https://www.alderac.com/wp-content/uploads/2019/08/SmashUp_WorldTourCultureShock_Rules_Rulebook_FINAL.pdf) 也区分普通行动与打在基地 / 随从上或埋葬并留场的行动，支持普通行动以基地为效果目标不能自动算作打到基地。另查到社区规则说明的“揭示直到找到某种牌”例外，但起源故事写的是抽取而非揭示；不能直接外推，相关未命中牌的处理仍待明确来源。
- 水晶湖泰坦页面：预置局面从实际泰坦栏打出 POD 巨人到水晶湖，选择基地反应后进入摧毁选择，力量 1 的微型机器人高亮；跳过后泰坦在基地、目标保留。首次 `e2e-1795127689885-yxomzi` 1/1 但截图处于提示过渡态，未判视觉通过；等待旧“让过”消失后复跑 `e2e-1795127774062-83lqp8` 1/1，已核看稳定截图，目标绿框和“跳过”清晰。此为桌面预置与跳过分支，未覆盖选择摧毁后的加力链。
- 泰坦页面扩展为跳过和实际摧毁后选择加力两个分支：`e2e-1795127913307-yum31n` 2/2，基地仅有己方泰坦时力量 1 目标可选、力量 3 目标不可选；摧毁后给对手剩余随从 +1。已核对截图，但加力选择图仍有前一层“跳过”退出残影，视觉判 `REVISE`；已增加等待该按钮隐藏，待复跑重拍。
- 泰坦摧毁与加力分支等待旧按钮退出后复跑 `e2e-1795128018100-gyodk4` 1/1；已核看稳定截图：上一步按钮消失、剩余对手随从绿框清晰，点击后领域状态为该随从 +1。该证据覆盖桌面单目标 / 单泰坦预置态，不替代其他保护和同时摧毁组合。
- 跟踪进一步显示，雄蜂放行生成的事件 `reason=giant_ant_drone_skip`、`sourceKind=nonAction`、`sourcePlayerId=1`（被救目标的控制者），而原齐射由玩家 0 作为行动造成；事件虽保留 `destroyerId=0`，但行动来源语义并未完整保留。后续事务设计需保存原始摧毁意图与替代选择结果，不能把放行当作一次新的非行动摧毁；具体保护 / 归因影响仍须独立复现，不能仅凭字段推断玩家故障。
- 水晶湖回合边界真实命令用例：玩家 0 打入随从、使用基地摧毁并选择加力，再实际结束回合；玩家 1 的回合仍为第 7 轮，打入随从后水晶湖触发恰好入队一次。最终断言版定向测试 1/1，覆盖相邻玩家回合，不外推全部额外回合或控制权变化。
- 按发行商[埋藏规则](https://smashup-rulebook.alderac.com/wiki/Special_Cards%2C_Counters_and_Other_Rules)，普通埋藏是放置；翻开时该牌才按额外出牌结算。真实命令用例从手牌打出封印坟墓，选择翻开水晶湖埋着的忍者随从；该随从进入基地，水晶湖反应恰好入队一次，1/1。自我埋藏行动是否视为“打到这里”，现有规则材料尚不能直接裁定，未据猜测修改。
- 追加正常埋葬反例：真实打出“失落知识”，选择手牌和水晶湖，目标牌实际埋下但未入队水晶湖打牌反应；与翻开随从、普通行动、基地行动和泰坦等一起复跑水晶湖相关用例 19/19。
- 同批根因排查的对照：无雄蜂时三种装备已分别复现重复；因此不能把问题仅归因于雄蜂。两次独立齐射必须各触发一次，排除了按回合、牌名或固定时间合并。跨雄蜂跟踪中两次 `sourceEventId` 明确各含不同目标 UID，故也不是同一个触发 ID 被重复消费。当前收敛到同时效果缺少可跨替代选择持有目标与结果的正式事务；仍须建立并验证完整生命周期。
- 大砍刀宿主来源静态探针：`buildValidatedDestroyEvents` 显式调用中有 52 处未写 `sourceCardUid` 的候选，但不能当成 52 个缺陷；抽查黑寡妇 / 大灰狼是入场能力，温和市民 / 克苏鲁仆从为自毁，另有行动、基地和泰坦来源。探针未覆盖别的事件构造方式，也未证明入场能力在所有重触发 / 响应组合下无影响；代表宿主之外仍保持未闭合。
- 当前代码完整复跑 `diy-killers.test.ts` 64 条和 `ancient-egyptians.test.ts` 8 条，合计 72/72；目标测试结构 guard 通过。该结果不包含四项同批摧毁失败测试。
- 追加来源归因测试先复现：杰森摧毁经雄蜂或九命之屋放行后，事件来源玩家 / 牌定义被写成救援方。现保留原事件的来源玩家、来源牌实例、定义、控制者、基地及行动类型；两种救下 / 放行共 4/4，海盗行动经九命之屋放行的独立用例 1/1。杀人狂、巨蚁、基地三份测试在追加下一项组合红测前为 115/115，定向 ESLint 通过。两种旧防止流程仍用特殊 reason 防重入，原始 reason 尚未完整保留，不能称来源语义全部修复；玩家页面重测待完成。
- 新增真实组合：杰森发起单次摧毁，目标同时有九命之屋与雄蜂可救援，玩家依次放行。观察到选择顺序为九命之屋、雄蜂、九命之屋，九命之屋重复出现；测试要求各询问一次，目前 1 项失败。此问题与同批摧毁的四项红测均涉及跨交互的原始摧毁事务，但尚未证明是完全相同的根因。
- 同一组合的救援分支新增红测：九命之屋先把目标移走后，目标已位于九命之屋，但交互队列仍弹出 `giant_ant_drone_prevent_destroy`，因此 `expectNoPrompt` 失败。该证据只证明旧选择残留，尚未声称错误扣除指示物或造成实际二次摧毁。当前组合相关为 2 项红测，另有 4 项同批摧毁红测。
- 来源字段兼容调整后的最终当前代码，双客户端 `e2e-1795129494959-mblrr5` 2/2：雄蜂救下与放行均完成，放行后手牌可见大砍刀。该回归只覆盖单个防止来源；九命之屋与雄蜂同时存在的两项新红测未被此结果覆盖。
- 两种防止效果组合的源码边界：`fireTriggers` 在 replacement 阶段遍历并执行所有符合条件的注册项，两个防止交互可在原摧毁尚未决定时同时排队；放行处理器重建摧毁，并通过各自的 `reason` 只跳过对应防止项。随后的后处理会重新发现另一项，而救援成功也未清理已排队的另一项。两条红测分别直接覆盖“重新发现”和“已救下仍有旧交互”，具体修复须由同一摧毁事务持有候选、决策与剩余结果。
- 当前版本三份回归包含新增组合红测后的实际结果是 116 通过 / 2 失败（共 118）；失败正是上述重复询问与救下后旧提示。另一个同批文件为 2 通过 / 4 失败；不能再沿用早于新增红测的 115/115 作为当前全套通过结论。
- 双人页面组合首次 `e2e-1795129919052-hzx075` 已进入九命之屋选择，但测试寻找“移动到九命之屋”，实际中文按钮是“移动到九命之家”，因此超时，尚未执行救援，不能作为旧提示的页面复现证据。已按真实页面文案修正用例并准备重跑；基地名称与按钮用词不一致是观察项，未扩大为本次 UI 修改。
- 本轮来源字段改动后再次执行全项目 `npm run typecheck`，仍退出 1，仅报告工作区已有的 `ExternalRoomPage.tsx:95` 调用参数和 `vite-plugins/local-preview-public.mjs` 类型声明两项；当前触及的源文件定向 ESLint 通过。全项目类型检查依然不能写成通过。
- 双客户端页面 `e2e-1795130085117-7o50ho` 实际复现：双方选派后预置杰森、大砍刀、目标、雄蜂和九命之家；玩家真实操作杰森摧毁，对手点击“移动到九命之家”。目标已到新基地，但 10 秒后当前交互仍是 `giant_ant_drone_prevent_destroy`，断言失败。已核对原始失败截图：目标与雄蜂同在九命之家，顶部仍要求雄蜂防止消灭。此为玩家可见缺陷，非测试定位错误或仅领域层推断。
- 页面复验 `e2e-1795130389156-kfn02o` 对旧雄蜂提示继续点实际雄蜂：目标仍在九命之家、雄蜂指示物仍为 1、交互关闭；最终因提示本不应出现而按预期失败。当前直接证据表明是额外无效选择，未观察到指示物误扣或目标二次离场；其他组合不得外推。
- 水晶湖 AI 合法动作链 1/1：从真实打牌后反应开始，AI 合法动作选择基地触发、力量 1 目标并给对手另一随从加 1；力量 3 的目标不在摧毁候选，非当前决策玩家没有合法交互动作，最终交互关闭。此为合法动作执行证据，不证明 AI 对所有局势的策略质量。
- 水晶湖单雄蜂防止路径 1/1：基地选择目标后对方移除指示物防止，目标保留，不出现摧毁后的加力交互；该次基地能力已标记使用，同回合再向基地打持续行动不会再次触发。此用例只覆盖单一防止来源，不能证明多个防止来源的组合。
- 待实现的事务收敛方向（方案，尚非修复）：用正式 ResolutionFrame 持有原摧毁事件、每个目标的防止机会及决定；选择放行时不重新发起一条无来源的摧毁，选择救下时清理同一目标尚未消费的选择；全部决定结束后才提交仍有效的原事件，再按明确标识的同一次效果收集“一个或更多”触发。需要同时覆盖雄蜂、九命之家、猫咪与海盗等不同替代路径，以及计分、嵌套触发和多个玩家；不能只按 UI 列表删一项或用牌名 / 时间戳去重。
- 同批来源离场边界：海盗齐射同时摧毁装备魔盒的己方宿主和另一己方随从。依据发行商[触发时点说明](https://smashup-rulebook.alderac.com/wiki/Detailed_Rules_for_Cards%2C_Abilities%2C_and_Other_Wackiness)，事件发生时在场的来源仍可在之后结算；真实命令链确认两张随从均离场，魔盒当前抽了两张而非一次触发应抽的一张。新增单测失败，说明未来批次修复须保留离场来源在触发时的快照；同批文件现为 5 项失败 / 2 项通过，具体数字待完整复跑确认。
- 同批七项文件完整复跑结果确认：5 失败 / 2 通过；两项通过分别为两次独立行动各触发一次，以及同一批只剩一个实际摧毁时触发一次。

### 2026-11-20 小丑当前工作区复审（进行中，未通过）

本轮逐一核对 `diy_clowns.webp` 的 14 个有效卡面和 `diy_clowns_bases.webp` 的两个基地；以下“页面通过”仅指对应预置状态和测试动作，不代表所有边界或派系组合通过。修复前的现有页面套件 `e2e-1795131759557-that4d` 为 20/20；其中沉默小丑的用例按错误的持续能力设置了场上状态，因此该绿灯不能证明牌面合同。

| 对象 | 牌面关键合同 | 当前直接覆盖与未结项 |
| --- | --- | --- |
| 滑稽小丑 | 从弃牌堆打出标准行动，替代通常行动，最终回牌库底 | 页面覆盖普通行动；原先误选自埋行动已修，真实页面组合 `e2e-1795132451631-25nfsq` 核实自埋牌不可选、普通行动可选并打出。反制和其他去向交互仍需专项复核。 |
| 小丑夫人 | 每回合一次，打出行动后可抽牌 | 页面覆盖接受分支；对手回合、多个实例及完整触发顺序仍需核实。 |
| 跳舞小丑 | 弃牌堆至少两张标准行动时随机选择，玩家可额外打出 | 页面覆盖普通目标及跳过；有目标行动、反制、行动自身交互和最终去向需核实。 |
| 麦当劳小丑 | 展示直到两行动，抽一弃一，其余重洗 | 页面覆盖两张行动及选择；少于两张和洗牌终态需补边界核验。 |
| 沉默小丑 | 无标签：打出时，若本回合未打过行动，可从弃牌堆选择并额外打出标准行动 | **失败**：当前实现为场上持续 provider，打出时没有选择，在后续回合仍开放；以 `actionsPlayed` 而非实际行动总数判断，已打过额外行动仍开放。新增两条真实 `PLAY_MINION` 领域测试均红，待修复并改写旧错误前提的测试和页面。 |
| 小丑女 | 可搜索牌库中的行动并弃置 | 页面覆盖选择；空库及拒绝分支待核实。 |
| 香蕉皮 | 至多两个己方随从从一个基地移动至另一个；从弃牌堆打出则可额外行动 | 页面覆盖两随从移动；零目标与额外行动时机待核实。 |
| 小丑车 | 弃牌堆至多两张重洗；从弃牌堆打出可额外行动 | 页面覆盖选两张；零张、来源牌及额外行动时机待核实。 |
| 惊吓盒 | 额外随从上限 3；从弃牌堆打出上限为 4 | 页面覆盖两来源和非法力量拒绝，额外出牌与跨效果干扰待核实。 |
| 小丑金字塔 | 一个基地己方随从数量为目标随从加力，可额外行动 | 页面覆盖单候选；多目标、空基地与额外行动时机待核实。 |
| 彩色围巾 | 抓二；从弃牌堆打出可弃一张额外抓一 | 页面覆盖两来源；弃牌堆来源的旧测试依赖沉默小丑错误持续 provider，必须在修复后按真实入口重测。 |
| 五彩纸屑桶 | 丢弃至多四手牌，等量抽牌 | 页面覆盖多选，领域覆盖零张；牌库耗尽等边界待核实。 |
| 杂耍 | 每名玩家查看顶三，弃一行动或展示没有行动，其余原顺序返回 | 页面覆盖双玩家选择行动；无行动公开展示与短牌库待核实。 |
| 馅饼砸脸 | 己方随从 +2；从弃牌堆打出改为 +4 | 页面覆盖两来源；来源状态测试受沉默小丑实现纠正影响，需要重测。 |
| 小丑学院 | 每回合首次打到此处后，可从弃牌堆随机取标准行动 | 页面覆盖接受和同回合第二次；随机候选及每玩家回合边界待核实。 |
| 马戏篷 | 打随从到此展示牌库顶，行动可选择弃置，否则放回 | 页面覆盖弃置分支，非行动展示、保留分支待核实。 |

共享标准行动分类：实际牌面要求标准行动，[发行商标准定义](https://smashup-rulebook.alderac.com/wiki/Terms_and_Phrases)明确自行埋葬的行动不属于标准行动。三种古埃及自埋牌和 POD 版本已有 `entersPlayOnPlay` 声明，小丑及其他已有标准行动判定使用共享函数。滑稽小丑与六个自埋版本的合法组合、普通行动对照已由领域回归覆盖；正确 `targetBaseIndex` 的命令被规则拒绝。小丑、古埃及、阿南西、奶油泡芙相关四份测试修改前 56/56；修正命令参数后小丑、公主、极客三份 85/85（均在新增沉默小丑红测之前）；目标文件 ESLint 和测试结构检查通过。此改动不是全部标准行动分类已完成审计：特殊行动的分类和其他真实组合仍需核实。

沉默小丑修复必须保留立即选择、可跳过、目标选择、行动结算、反制与牌库底替代等同一流程；不能以添加持续标记、拖延到下一次弃牌堆点击或只修计数掩盖无标签能力时机。

### 洗衣间控制者来源补查

2026-11-20 根据用户要求继续查来源：[发行商 Slashers 官方规则页的 Hide in the Laundry](https://smashup-rulebook.alderac.com/wiki/Slashers) 先写“you may destroy this minion”，随后写“unless its controller discards a card and moves this minion ...”；按正式版该句语序，`its controller` 指前面的被附着随从的控制者。官方该牌的 Clarifications 栏没有单独裁定，因此此处是对官方英文原句的语法解释，不声称存在明文 FAQ。项目 DIY 英文卡面将 unless 前移到 Killer 的后面，中文译文也使用“它”，单看 DIY 版本容易产生另一种指代；不把 DIY 文本写成官方原句。当前实现让被附着随从控制者决定弃牌和移动，与上述正式版解释一致；此前双客户端逃离 / 拒绝测试只覆盖当时局面，不自动证明第三方控制者等所有组合。暂保留语义来源差异记录，后续有更直接裁定再复核。
- 补充三人真实命令：行动牌控制者 P0、附着随从控制者 P1、打出杀人狂者 P2，`diy-killers-laundry.test.ts` 新增断言逃离交互及可弃手牌属于 P1；完整文件 3/3。此为领域命令证据，尚非三客户端页面证据。
