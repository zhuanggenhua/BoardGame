# 大杀四方 Munchkin 矮人对象级审计收口

## 基本信息

- 对象：Smash Up / 大杀四方 `munchkin_dwarves`（Munchkin 矮人）
- 日期：2026-09-01
- 文档类型：`closeout`
- 关联旧文档：`evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md`

## 审计范围

- 本轮覆盖：矮人 12 张牌 + 2 个基地，即 `src/games/smashup/data/factions/munchkin.ts` 中 `MUNCHKIN_DWARVES_CARDS` 和 `MUNCHKIN_DWARVES_BASES` 的完整对象清单。
- 本轮覆盖的规则链路：持续力量修正、天赋回收、任意数量弃牌、至多三张宝藏额外打出、计分前特殊行动、二选一抽 / 回收宝藏、宝藏牌库检索、摧毁附着行动、附着宝藏替代回手、Munchkin 基地怪物和宝藏触发。
- 本轮目标入口 / 环境：本地工作区 `D:\gongzuo\webgame\BoardGame`；领域测试覆盖最终权威状态；Playwright 既有矮人对象级截图链覆盖真实页面第一入口和交互收口。
- 明确不在本轮范围内：Munchkin 其它普通派系、公共宝藏牌堆逐卡最终 closeout、公共怪物牌堆最终 closeout、Munchkin 整扩展统一 closeout、服务器资源重新上传 / URL 哈希回查。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 矮人 12 张牌 + 2 个基地已在旧 Munchkin 总账对象矩阵列满。 |
| 真相源状态 | `passed` | 主真相源为 Munchkin 已锁规则图和当前 `munchkin.ts` 静态定义；本轮未临时新增规则真相源。 |
| 原子语义断言 | `passed` | 旧总账“矮人规则原文与子句锁定”逐对象写明 C 子句；本文重列完整对象结论。 |
| 实现消费链 | `passed` | `abilities/munchkin.ts` 的 handler / interaction、`ongoingModifiers`、`baseAbilities` 和 Munchkin 事件归约均被对应测试消费。 |
| 最终权威结果 | `passed` | `munchkinMechanics.test.ts` 覆盖手牌、弃牌堆、牌库、宝藏牌库、公共宝藏弃牌、VP、有效力量、附着行动、计分清场和交互清空。 |
| 交互真实入口 | `passed` | 旧 Munchkin 总账已登记 `smashup-munchkin-monster-treasure-ui.e2e.ts` 的矮人对象级 57-97 截图链；本轮复跑并修正了此前卡住的三条矮人关键链：任意数量弃牌、至多三张宝藏额外打出、计分前狡猾计划。 |
| 验证证据 | `passed` | 本轮复跑定向 Vitest、静态 intake/config 状态测试，以及三条矮人关键真实入口 E2E；其余矮人对象真实入口仍引用旧总账登记的 57-97 截图链。 |
| 共享影响与代表链依据 | `passed` | 判等依据：本文不以单个代表对象替代矮人对象全集；矮人引用 Munchkin 公共宝藏 / 怪物共享链时，每个矮人对象仍有自己的对象行、最终状态证据和真实入口证据。 |
| 缺口分类与范围裁定 | `passed` | 其它 Munchkin 派系和整扩展残余范围明确列为当前范围外，不阻塞矮人摘牌。 |
| 旧 evidence / 旧结论回写 | `passed` | 旧 Munchkin 总账顶部追加 2026-09-01 回写，S0 矮人行改为 `configured`。 |
| 残余范围声明 | `passed` | 本文“缺口分类与范围裁定”和“对外汇报口径”禁止外推到 Munchkin 整体。 |

## 结论等级

结论等级：`当前范围已收口`。

判定理由：矮人当前锁定范围内的 14 个对象都有规则子句、实现消费点、最终权威状态和真实入口证据；本轮将 `munchkin_dwarves` 从 `SMASHUP_FACTION_IMPLEMENTATION_STATUS` 移除，并补静态状态回归，确保派系选择和配置审查不再把矮人显示为“实施中”。

## 权威来源

- 主真相源：`D:\gongzuo\webgame\gameasset\Smash Up! by Mervil (2833984701)-汉化图\新6扩小白\矮人\*.jpg/png`，旧 Munchkin 总账已记录完整规则子句。
- 实现源：`src/games/smashup/data/factions/munchkin.ts` 与 `src/games/smashup/abilities/munchkin.ts`。
- 状态源：`src/games/smashup/domain/ids.ts` 的 `SMASHUP_FACTION_IMPLEMENTATION_STATUS`。
- 旧审计来源：`evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md`。
- 合同状态：`locked`。本轮没有发现卡名、数量、图集索引、能力标签或基地元信息需要回到 intake 重新裁定。

## 图片合同证据

- 图片合同表：`evidence/smashup/munchkin-intake-atlas-contract-2026-08-01.md` 已记录矮人手牌图集 `munchkin_dwarves_cards`、矮人基地图集 `munchkin_dwarves_bases`、正式源图路径、网格、单格尺寸、帧数和 SHA256 前缀。
- 完整单卡主裁图 / 裁图清单：同一 intake 合同逐项列出矮人 12 张手牌和 2 个基地的源图文件、实体张数、`previewRef` 第一索引、源图尺寸和 SHA256 前缀；本轮只做玩法摘牌，不改图片、图集几何或资源主源。

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 矮人王 / `munchkin_dwarves_dwarf_king` | 你的仆从身上的宝藏牌将进弃牌堆时，改为进你的手牌；非宝藏不回收，被压制时不生效。 | 附着行动离场替代目的地 + `munchkinMechanics.test.ts` 矮人王用例。 | 宝藏回到宿主控制者手牌，非宝藏按原去向处理。 | E2E 57-59：真实打出地牢规则书并选择尖刺靴后，尖刺靴进入手牌。 | 无 | `passed` |
| 宝藏爱好者 / `munchkin_dwarves_loot_lover` | 自身每有一张未被压制的宝藏附着牌，获得 +2 力量。 | 持续力量修正注册 + 矮人持续力量测试。 | 两张宝藏时显示 +4，旁观随从不加。 | E2E 62-63：真实附着摆动的盾牌和火箭靴后力量修正可见。 | 无 | `passed` |
| 黄金挖掘者 / `munchkin_dwarves_gold_digger` | 天赋从公共宝藏弃牌堆选择 1 张宝藏进手牌；空弃牌堆不可发动且不消耗天赋。 | 天赋 handler + `munchkin_dwarves_gold_digger_choose_treasure`。 | 选中宝藏生成实例进手牌，天赋标记已用。 | E2E 64-66：点击场上黄金挖掘者本体后选择尖刺靴回手。 | 无 | `passed` |
| 宝石抓取者 / `munchkin_dwarves_gem_grabber` | 自身至少有 1 张宝藏附着牌时获得 +2 力量。 | 持续力量修正注册 + 矮人持续力量测试。 | 有宝藏时 +2，无宝藏时不加。 | E2E 62-63：真实附着时间错乱的喷气背包后力量修正可见。 | 无 | `passed` |
| 为了钱什么都可以 / `munchkin_dwarves_anything_for_money` | 选择任意数量手牌弃掉；每弃 1 张抽 1 张宝藏；允许空选。 | onPlay + 手牌多选交互 + `CARDS_DISCARDED` / `MUNCHKIN_TREASURES_DRAWN`。 | 被选手牌进弃牌堆，按数量抽宝藏，空选不改状态。 | E2E 69-71：真实手牌多选两张并抽两张宝藏。 | 无 | `passed` |
| 套现 / `munchkin_dwarves_cash_out` | 从手牌选择至多三张宝藏，按牌型逐张作为额外牌打出；允许空选。 | onPlay + `munchkin_dwarves_cash_out_choose_treasures` + immediate extra play。 | 宝藏随从 / 行动按限制 UID 逐张打出，非宝藏保留。 | E2E 77-81：真实多选矮人雇佣兵和虎骑士，并连续打到矿洞。 | 无 | `passed` |
| 狡猾计划 / `munchkin_dwarves_cunning_plan` | 计分前特殊打出，抽 1 张宝藏；玩家可以立即打出刚抽到的宝藏，也可跳过。 | beforeScoring special + immediate extra play。 | 源牌进弃牌，刚抽宝藏按玩家选择打出或留手，计分流程继续收口。 | E2E 82-85：真实计分前响应后抽到许愿指环并立即打出。 | 无 | `passed` |
| 贪婪是好的 / `munchkin_dwarves_greed_is_good` | 抽 1 张宝藏或从公共宝藏弃牌回收 1 张；然后获得额外行动。 | 二选一交互 + 抽 / 回收宝藏事件 + `grantExtraAction`。 | 回收分支不误抽牌库，抽牌分支可用，无弃牌时直接抽。 | E2E 72-74：真实选择回收摆动的盾牌并获得额外行动。 | 无 | `passed` |
| 隐藏资产 / `munchkin_dwarves_hidden_assets` | 宝藏牌库顶三张进公共宝藏弃牌，抽 1 张普通牌，并获得额外行动。 | onPlay + 公共宝藏磨牌事件 + 普通抽牌 + `grantExtraAction`。 | 宝藏牌库减少、公共宝藏弃牌增加、普通牌进手牌。 | E2E 67-68：真实打出后宝藏小牌数量减少并抽到普通牌。 | 无 | `passed` |
| 我的！ / `munchkin_dwarves_mine` | 搜索宝藏牌库找可附着宝藏，打到你的一个仆从身上作为额外行动，并重洗宝藏牌库。 | onPlay + `munchkin_dwarves_mine_choose_treasure` + immediate extra action。 | 只列可附着宝藏和己方宿主，所选宝藏生成并附着到指定宿主。 | E2E 86-89：真实选择尖刺靴和己方宝藏爱好者后完成附着。 | 无 | `passed` |
| 不！我的宝贝！ / `munchkin_dwarves_no_my_precious` | 摧毁仆从身上的一个行动；若目标是宝藏，获得额外行动；非宝藏不授予。 | onPlay + `munchkin_dwarves_no_my_precious_destroy` + 附着行动摧毁。 | 宝藏附着行动进入拥有者弃牌，额外行动可继续打出。 | E2E 90-93：真实摧毁宝藏附着后打出许愿指环并收口。 | 无 | `passed` |
| 打捞 / `munchkin_dwarves_salvage` | 计分前特殊打出，从公共宝藏弃牌选择可附着宝藏，打到当前计分基地你的一个仆从身上。 | beforeScoring special + `munchkin_dwarves_salvage_choose_treasure` + immediate extra action。 | 宝藏先附着到当前基地己方宿主，再正常计分清场。 | E2E 94-97：真实计分前响应、选择尖刺靴并完成计分清场。 | 无 | `passed` |
| 矿洞 / `base_the_mines` | 基地 18 / 4-2-1 / 2 怪物；这里每个仆从身上的每张宝藏给该仆从 +1。 | 静态基地定义 + Munchkin 基地持续力量修正。 | 宿主同时获得尖刺靴 +1 与矿洞 +1，旁观随从不加。 | E2E 75-76：真实附着尖刺靴后目标显示 +2。 | 无 | `passed` |
| 宝藏池 / `base_treasure_bath` | 基地 12 / 2-0-0 / 1 怪物；每回合第一次你在这里打出仆从后抽 1 张宝藏。 | 静态基地定义 + `base_treasure_bath` onMinionPlayed 触发。 | 第一次在此打出仆从抽宝藏，第二次不重复抽。 | E2E 60-61：真实把入侵者打到宝藏池后抽到许愿指环。 | 无 | `passed` |

## 负向断言与生命周期证据

| 对象 / 链路 | 负向断言或不应发生什么 | 生命周期 / 无残留证据 |
| --- | --- | --- |
| 黄金挖掘者 | 无公共宝藏弃牌时不能发动天赋，且不应消耗天赋次数。 | `munchkinMechanics.test.ts` 黄金挖掘者负向用例返回“当前没有可选择的宝藏牌”；本轮 Vitest 126 条通过，该拒绝日志是预期路径。 |
| 为了钱什么都可以 | 空选不会弃牌或抽宝藏；多选时不应把未选手牌丢进弃牌堆。 | L2 空选用例 + 本轮 E2E 69-71；确认后手牌 / 弃牌 / 宝藏牌库状态落地，`triggerQueue / interaction / responseWindow` 无残留。 |
| 套现 | 空选不会生成立即额外打牌窗口；非宝藏手牌不应进入宝藏候选。 | L2 空选和非宝藏保留断言 + 本轮 E2E 77-81；两张宝藏随从连续打出后 `triggerQueue / interaction / responseWindow` 无残留。 |
| 狡猾计划 | 玩家可跳过刚抽到的宝藏；计分前响应不应停在旧响应窗口镜像或空交互。 | L2 跳过用例 + 本轮 E2E 82-85；Me First reaction session 打开、手牌本体响应、立即打出许愿指环、计分清场后流程收口。 |
| 打捞 | 无可附着宝藏或当前计分基地没有己方宿主时不能发动。 | L2 两个拒绝用例 + E2E 94-97；计分前响应、附着宝藏、基地计分和清场后 `triggerQueue / interaction / responseWindow` 无残留。 |
| 矮人王 / 不！我的宝贝！ | 矮人王不回收非宝藏行动，被压制时不会替代回收；摧毁非宝藏附着行动不应授予额外行动。 | L2 负向用例覆盖非宝藏、压制和额外行动拒绝；对应真实入口链收口后不留下临时交互、deferred 或响应交互。 |

## 共享影响与代表链判等

- 判等依据：本文的完成口径不是“代表对象通过”；14 个矮人对象均有独立对象行，关键交互对象均有自己的最终状态断言和真实入口证据。
- 仅配置不同：公共宝藏 / 怪物共享链只用于牌种、公共牌库、基地补怪和宝藏回牌库底这类共用机制；矮人对象的触发时机、候选生成、权限判断、payload、执行入口、最终权威状态和清理语义已在各对象行或本节负向 / 生命周期表单独核对。
- 剩余影响面：如果后续公共宝藏 / 怪物牌堆总矩阵发现问题，只重审命中的共享链和引用对象；它不自动恢复矮人派系“实施中”状态，除非能证明矮人对象当前规则结果被直接影响。

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计 / 已收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| Munchkin 其它普通派系 | `非阻塞扩展` | 否 | 否 | 当前范围外；本轮只取消矮人“实施中”。 | 继续按状态表逐个派系做对象级审计，不批量取消。 |
| 公共宝藏 / 怪物整体验收 | `非阻塞扩展` | 否 | 否 | 当前范围外；矮人已引用必要共享链，但不声明公共牌堆全部 closeout。 | 在 Munchkin 统一 closeout 前单独补公共牌堆总矩阵。 |
| 服务器资源重新上传与公开 URL 哈希回查 | `非阻塞扩展` | 否 | 否 | 当前范围外；本文只证明本地玩法和 UI 实施状态。 | 进入发布或资源 closeout 时按资源链另跑。 |
| 旧 Munchkin 总账仍写矮人 `in_progress` | `审计留档缺口` -> 已补齐 | 否 | 是，补齐前会传播旧状态 | 当前范围内，已原地回写。 | 已追加 2026-09-01 状态回写并更新 S0 矮人行。 |

## 验证证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/munchkinMechanics.test.ts src/games/smashup/__tests__/munchkinIntake.test.ts src/games/smashup/__tests__/configReviewAdapter.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：本轮复跑通过。
- 证明了什么：矮人对象级最终状态、Munchkin 静态接入、矮人不再是“实施中”、配置审查表将矮人列为 `configured`。
- 没有证明什么：不证明 Munchkin 其它派系或公共宝藏 / 怪物整体验收完成。
- 命令：`node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts "为了钱什么都可以可真实多选手牌弃掉并按数量抽宝藏"`
- 结果：本轮复跑通过，1/1。
- 证明了什么：玩家从手牌打出“为了钱什么都可以”，在当前多选牌面弹窗中手动选择两张手牌，确认后按弃牌数量抽到两张宝藏。
- 命令：`node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts "套现可真实多选手牌宝藏并连续作为额外随从打出"`
- 结果：本轮复跑通过，1/1。
- 证明了什么：玩家从当前多选牌面弹窗选择两张手牌宝藏，非宝藏未列入候选，并连续把两张宝藏随从作为额外随从打到基地。
- 命令：`node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts "狡猾计划可从计分前响应窗口抽宝藏并立即打出"`
- 结果：本轮复跑通过，1/1。
- 证明了什么：计分前 Me First 响应窗口真实打开，玩家点击手牌本体打出“狡猾计划”，抽到“许愿指环”后再点击手牌本体立即打出；随后计分清场收口，怪物牌库 `x18` 与两座新“宝藏池”各补 1 个怪物的基地规则一致。
- 没有证明什么：这三条本轮 E2E 不证明 Munchkin 其它派系或公共宝藏 / 怪物整体验收完成，也不等价于服务器资源重新发布。
- 截图证据：本轮截图目录为 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\为了钱什么都可以可真实多选手牌弃掉并按数量抽宝藏\`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\套现可真实多选手牌宝藏并连续作为额外随从打出\`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\狡猾计划可从计分前响应窗口抽宝藏并立即打出\`；已抽查 `70`、`78`、`83`、`85` 关键帧。用户没有要求看图，本轮不打开图片给用户。

## 修订 / 失效记录

- 旧文档路径：`evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md`
- 旧结论：旧总账 S0 矮人行仍保持 `in_progress`，早期段落也写过矮人行动牌和 L3/L4 缺口。
- 失效原因：旧总账后续已补齐矮人 12 张牌 + 2 个基地的 L2/L3，打捞补到 L4；本轮已补状态源和回归测试，旧 `in_progress` 不再代表当前本地玩法状态。
- 替代旧结论的新证据：本文 + 上述 Vitest / E2E / 旧总账矮人对象级截图链。
- 新结论：矮人本地玩法对象级审计当前范围已收口；`munchkin_dwarves` 已从实施中派系列表移除。
- 是否需要修改旧文档正文中的误导行：已在旧文档顶部追加状态回写并更新 S0 矮人行；历史推进段落保留，不删除。

## 对外汇报口径

- 允许说：本轮完成 Munchkin 矮人这个派系的本地玩法对象级审计，并取消 `munchkin_dwarves` 的“实施中”状态。
- 允许说：矮人 12 张牌 + 2 个基地已有对象级 L2/L3，打捞包含计分前到清场的 L4 链路。
- 禁止说：Munchkin 新扩展整体完成。
- 禁止说：Munchkin 其它实施中派系已经取消。
- 禁止说：公共宝藏 / 怪物牌堆已经单独整体 closeout。
- 禁止说：服务器资源主源已重新发布并通过公开 URL 回查。
