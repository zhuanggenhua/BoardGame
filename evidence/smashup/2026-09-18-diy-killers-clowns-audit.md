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
- 当前裁定：柯克船长面具暂保留在杀人狂残余范围；杀人狂仍为 `in_progress`，当前未完成范围仍为 12 个卡牌对象与 2 个基地。
