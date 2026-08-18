# Smash Up 计分时场上来源到目标交互专项

## 基本信息

- 对象：Smash Up 计分窗口中“场上来源对象 -> 目标对象”和“场上来源对象本体确认”的可发动效果交互族；当前 UI 已消费 `随从 -> 基地`、`随从 -> 随从`、`持续行动/行动 -> 基地`、`持续行动 -> 随从`、`泰坦 -> 基地`、`泰坦 -> 随从`、`随从来源确认 -> 直接回手`、`随从来源确认 -> 后续埋葬牌选择`、`随从来源确认 -> 后续目标/数量` 九个分支
- 日期：2026-08-17
- 文档类型：audit
- 结论等级：代表性玩法已验证
- 主目标：回答“计分时效果是否都要审计”，并把本轮已经验证的共享交互族、全量 L1 清单和仍需逐牌深审的计分效果分开。

## 审计范围

### 本轮覆盖

- 共享交互合同：`buildFieldSourceTargetOptions(...)` + `buildFieldSourceTargetPromptConfig(...)`
- 场上来源本体确认合同：`buildFieldSourceActionOptions(...)` + `buildFieldSourceActionPromptConfig(...)`
- 响应窗口职责合同：`smashup_reaction_choose` 只承担开放响应时机、跳过/触发排序和提交 live option；手牌响应选项必须是卡牌入口，场上 `activate_special` 必须是来源本体入口。
- 非计分同类治理：`giant_ant_killer_queen_pod_choose` 是“纯检索按钮 + 场上随从直选”的混合交互，不能整体声明为纯 `button`；当前改为 `targetType: 'minion'`，检索保留浮动按钮，场上随从选项继续点随从本体。
- 计分同类续审治理：`huluwawa_liu_wa_before_scoring` 曾是按钮窗口，并把六娃实例藏在 `continuationContext.minionUid` 里；当前改为 `field-source-action`，玩家点击六娃本体才表示取消天赋效果，`保留效果` 仍由按钮承载。
- 基地计分同类治理：`base_gingerbread_house` 曾把“两个同基地同力量己方随从”预组合成按钮选项；当前改为 `targetType: 'minion'` 多选，玩家直接点击两个合法随从本体，`不加力量` 仍由按钮承载。
- 全局按钮对象字段分流：新增守卫会同时扫描按钮选项值和同一 prompt 的 `continuationContext`。本轮把 1 个真实目标玩家选择改为 `targetType: 'player'`，其余已唯一确定对象后的确认/模式/已知卡牌处理按钮统一声明 `buttonIntent`，不再靠 sourceId 逐牌理由表放行。
- 通用弹窗治理：新增 `genericIntent` 与选项形状推导；带场上实体字段的 `generic` 必须归入牌池、埋葬牌、离场快照、复合上下文、模式、排序、卡牌与控制混合或定义选择等通用语义，不再维护逐牌 `sourceId` 理由表。
- 直选模式 UI 分流治理：`base` / `minion` / `hand` / `buried` / `ongoing` / `board` / `field-source-target` / `field-source-action` 的“目标对象 vs 浮动操作按钮”判定已收敛到 `getSmashUpDirectPromptExtraOptions(...)`，Board 不再为每一种直选模式各写一套 extra option 过滤规则。
- 目标基地包装入口：`buildFieldSourceToBaseTargetOptions(...)`
- 目标随从包装入口：`buildFieldSourceToMinionTargetOptions(...)`
- UI 消费链：
  - 来源-目标：来源对象本体高亮 -> 点击来源 -> 目标对象高亮 -> 点击目标提交；当前 Board 支持 `source=minion,target=base`、`source=minion,target=minion`、`source=ongoing/action,target=base`、`source=ongoing,target=minion`、`source=titan,target=base` 与 `source=titan,target=minion`
  - 来源本体确认：来源对象本体高亮 -> 点击来源提交当前 live option；提交后可以直接执行，也可以进入后续目标、数量、排序或非场上通用选择步骤；跳过 / 不发动 / 留在基地仍用按钮承载；当前计分代表对象为 `alien_scout_return`、`ancient_egyptians_pharaoh_before_scoring_choose_source`、`huluwawa_liu_wa_before_scoring`、`giant_ant_under_pressure_choose_source`、`giant_ant_we_are_the_champions_choose_source`
- 当前范围对象全集：
  - `pirate_king_move`
  - `pirate_first_mate_choose_base`
  - `ancient_egyptians_mummy_after_scoring`
  - `world_champs_sheriff_before_scoring`
  - `world_champs_mummy_after_scoring`
  - `mermaids_shipwreck_cove_after_scoring`
  - `skeletons_gravestones_after_scoring`
  - `cyborg_apes_flying_monkey_move`
  - `diy_killers_michael_myers`
  - `sharks_megalodon_before_scoring`
  - `munchkin_clerics_bin_and_gone_minion`
  - `titan_mega_troopers_megabot_move`
  - `titan_tornados_category_5_move`
  - `titan_pirates_the_kraken_choose_minion`
  - `alien_scout_return`
  - `ancient_egyptians_pharaoh_before_scoring_choose_source`
  - `huluwawa_liu_wa_before_scoring`
  - `giant_ant_under_pressure_choose_source`
  - `giant_ant_we_are_the_champions_choose_source`

### 本轮不覆盖

- 不把所有 `beforeScoring` / `whenScoring` / `afterScoring` 触发都改成“先点来源”。本轮最新 AST 扫描登记到 102 个计分时运行时调用点、101 个唯一来源表达式，其中 `afterScoring` 69 个、`beforeScoring` 30 个、`whenScoring` 3 个；它们包含强制自动效果、基地效果、手牌响应、持续行动、泰坦、目标随从、目标手牌和纯确认分支，职责不同。
- 不声明全牌库计分时效果已经逐牌深审完成。本轮只更新 L1 清单快照：运行时 102 个调用点 / 101 个唯一来源表达式，数据定义层文本级扫描至少 179 个计分时机标记 / 166 个最近 id；全量深审仍需要逐项拆规则子句、入口、目标、最终状态和证据层级。

### 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞本轮结论 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| 四个 `随从 -> 基地` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 本文证据 + 对应 E2E |
| 三个 `随从 -> 随从` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 警长 E2E + 世界冠军行为测试；麦克尔定向行为测试；巨齿鲨队列运行态测试 |
| 三个 `持续行动/行动 -> 基地` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 沉船湾/墓碑领域测试与现成 E2E 截图链 + 飞天猴领域/队列测试 |
| 一个 `持续行动 -> 随从` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 垃圾处理定向行为测试 + 现成 Munchkin E2E 链 |
| 两个 `泰坦 -> 基地` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 超级佐德 E2E + 泰坦 smoke / owner context |
| 一个 `泰坦 -> 随从` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 克拉肯救随从第一段 E2E；第二段目标基地选择单独收口 |
| 五个 `随从来源确认` 场上来源效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 侦察兵现成复杂 E2E 链 + 法老定向行为测试 + 六娃定向行为测试 + 巨蚁定向行为测试 |
| 102 个计分时运行时调用点 / 101 个唯一来源表达式 L1 清单 | 当前范围验证 | 否 | 否 | 当前范围内 | 本文“计分时效果全量审计裁定” |
| 179 个数据定义层计分时机标记 / 166 个最近 id L1 清单 | 当前范围验证 | 否 | 否 | 当前范围内 | 本文“计分时效果全量审计裁定” |
| 计分窗口 `button` targetType 的职责门禁 | 当前范围验证 | 否 | 否 | 当前范围内 | `interactionTargetTypeAudit.test.ts`；由通用 `buttonIntent` 守卫覆盖，不再维护 sourceId 理由表 |
| 全局 `button` targetType 携带场上对象字段门禁 | 当前范围验证 | 否 | 否 | 当前范围内 | `interactionTargetTypeAudit.test.ts` 新增守卫，防止非计分同类回归 |
| `giant_ant_killer_queen_pod_choose` 混合交互 | 非计分同类治理 | 否 | 否 | 当前范围旁证 | 巨蚁定向行为测试；不计入计分时效果完成数 |
| `base_gingerbread_house` 基地计分前随从成对加力 | 当前范围验证 | 否 | 否 | 当前范围内 | `grimms-fairy-tales.test.ts` 证明按钮组合已迁为随从本体多选 |
| `titan_ignobles_the_hill_that_strolls_choose_player` 目标玩家选择 | 非计分同类治理 | 否 | 否 | 当前范围旁证 | 已改为 `targetType: 'player'`，并由 smoke 锁定不能退回按钮 |
| 已唯一确定对象后的确认 / 模式 / 已知卡牌处理按钮 | 当前范围验证 | 否 | 否 | 当前范围内 | 已通过 `buttonIntent` 声明通用职责；只放过“是否执行/模式/放回上下文”，不放过真实目标选择 |
| 全局 `generic` 高风险上下文门禁 | 当前范围验证 | 否 | 否 | 当前范围内 | 由通用 `genericIntent` / 选项形状推导覆盖，不再维护 sourceId 理由表；当前只证明高风险门禁，不等于全游戏低风险 generic 已逐项深审 |
| 全部 102 个计分时运行时调用点逐项深审 | 当前范围验证缺口 | 否 | 是，若要使用“全部计分时效果已审完”口径 | 当前范围外 | 另建 full-audit 对象矩阵 |
| 数据定义层计分时机牌/场上 special 逐牌深审 | 当前范围验证缺口 | 否 | 是，若要使用“全部计分时效果的牌已审完”口径 | 当前范围外 | 另建 full-audit 对象矩阵 |
| 其它计分效果是否需要改交互第一入口 | 当前范围外 | 未判断 | 不阻塞本族 | 先按职责分流 | 逐牌审查时进入交互入口语义矩阵 |
| 旧 2026-08-16 标注图中“大副直接选基地”的历史画面 | 审计留档缺口 | 否 | 否，本文已降级 | 历史证据，不作当前正向图 | 当前以 2026-08-17 新截图目录为准 |

## 结论等级

代表性玩法已验证。

判定理由：

- 本轮共享族分两类：一类规则动作是“场上来源对象本体可发动，再选择目标对象”；另一类规则动作是“当前 prompt 只需要先确认场上来源对象本体”，点击来源后可能直接执行，也可能进入后续目标、数量或排序步骤。来源可以是随从、持续行动/行动或泰坦；目标可以是基地，也可以是另一张随从；第一入口仍应是来源对象本体，不是目标对象，也不是提示区按钮。
- 当前实现把十四个 sourceId 统一到 `targetType: 'field-source-target'`，并通过 `buildFieldSourceTargetOptions(...)` / `buildFieldSourceToBaseTargetOptions(...)` / `buildFieldSourceToMinionTargetOptions(...)` 输出同一条来源-目标合同；`随从 -> 基地` 包装继续显式输出 `fieldInteractionType: 'source-target'`、`fieldSourceType: 'minion'`、`fieldTargetType: 'base'`，警长、麦克尔和巨齿鲨计分前分支输出 `fieldSourceType: 'minion'`、`fieldTargetType: 'minion'` 与 `targetMinionUid`，沉船湾/墓碑/飞天猴分支输出 `fieldSourceType: 'ongoing'` 或 `fieldSourceType: 'action'` 与 `fieldTargetType: 'base'`，垃圾处理分支输出 `fieldSourceType: 'ongoing'` 与 `fieldTargetType: 'minion'`，超级佐德/五级风暴分支输出 `fieldSourceType: 'titan'` 与 `fieldTargetType: 'base'`，克拉肯救随从第一段输出 `fieldSourceType: 'titan'` 与 `fieldTargetType: 'minion'`。
- 侦察兵 `alien_scout_return`、法老 `ancient_egyptians_pharaoh_before_scoring_choose_source`、六娃 `huluwawa_liu_wa_before_scoring`、巨蚁 `giant_ant_under_pressure_choose_source` 和 `giant_ant_we_are_the_champions_choose_source` 统一到 `targetType: 'field-source-action'`，并通过 `buildFieldSourceActionOptions(...)` 输出 `fieldInteractionType: 'source-action'`、`fieldSourceType: 'minion'`、`sourceUid/minionUid`。侦察兵点击本体后直接回手；法老点击本体后进入埋葬牌 `genericIntent: 'buried-card'` 选择；六娃点击本体后取消自己的天赋减力效果；巨蚁两条 live 来源选择点击本体后进入后续目标 / 数量步骤。对应的跳过、留在基地、保留效果或不发动仍由按钮承载。
- 响应窗口 `smashup_reaction_choose` 不再整体按按钮窗口处理：手牌 `play_action` / `play_minion` 选项保持 `displayMode: 'card'`，场上 `activate_special` 选项迁入 `field-source-action` 来源本体入口，只有 `trigger` 排序项与 `pass` / 跳过项继续是按钮。
- `src/games/smashup/ui/fieldSourceTargetInteraction.ts` 统一解析这两套选项值并生成来源高亮、目标高亮和提交映射；Board 只在 prompt 声明 `field-source-target` 或 `field-source-action` 时消费对应模型。未点击来源前只高亮来源对象；来源-目标类点击来源后才把合法目标基地或目标随从转成可选；来源本体确认类点击来源直接提交当前 live prompt option，再由 handler 决定直接结算还是进入后续步骤。
- 复杂链路 E2E 覆盖海盗王、大副、手牌响应、托尔图加后续移动和最终无残留；单独 E2E 覆盖世界冠军木乃伊从来源点击到埋葬落地；警长 E2E 覆盖来源随从到目标随从再进入决斗；沉船湾/墓碑复用现成 E2E 文件覆盖持续行动来源本体高亮、点击来源后目标基地高亮；超级佐德复用现成泰坦 E2E 文件覆盖泰坦来源本体高亮、点击泰坦后目标基地高亮、点击基地后移动落地；垃圾处理和克拉肯复用现成复杂 E2E 文件补上 `持续行动 -> 随从` 与 `泰坦 -> 随从` 的来源先点、目标后亮链路；侦察兵复用现成核心流程 E2E 文件补上“触发排序 -> 侦察兵本体高亮 -> 点击本体回手 -> 第二只留在基地 -> 无残留”链路；法老补充行为测试证明“触发队列 -> 法老本体 source-action -> 埋葬牌 buried-card generic”；巨蚁 live 来源选择已有定向行为测试证明 source-action prompt 之后继续进入目标 / 数量步骤。
- 仍有残余范围：全牌库所有计分时效果的逐牌行为深审没有在本文完成，不能用十四个来源-目标 sourceId 加五个计分 source-action sourceId 外推其它职责不同的效果。

## 权威来源

- 项目交互规范：`.spec/knowledge/standards/rule-driven-interaction-design.md`
  - 卡牌型响应窗口：响应窗口只开放时机和跳过；手牌本体是打出响应牌的第一入口。
  - 场上可发动效果：可选 / 主动发动效果第一入口是来源对象本体；强制自动效果不需要玩家点来源。
- 当前实现入口：
  - `src/games/smashup/domain/abilityHelpers.ts`
  - `src/games/smashup/domain/events.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/abilities/huluwawa.ts`
  - `src/games/smashup/abilities/pirates.ts`
  - `src/games/smashup/abilities/ancient_egyptians.ts`
  - `src/games/smashup/abilities/world_champs.ts`
  - `src/games/smashup/abilities/diy_killers.ts`
  - `src/games/smashup/abilities/mermaids.ts`
  - `src/games/smashup/abilities/skeletons.ts`
  - `src/games/smashup/abilities/munchkin_clerics.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/abilities/aliens.ts`
- 当前 E2E：
  - `e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts`
  - `e2e/smashup/smashup-world-champs-mummy-bury-other-base.e2e.ts`
  - `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
  - `e2e/smashup/smashup-alien-terraform.e2e.ts`
  - `e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts`
  - `e2e/smashup/smashup-gameplay.e2e.ts`

## 逐项结论

### 交互入口语义矩阵

| 对象 | 动作链 | 第一入口 | 字段/命令 | 目标归属 | 数量/可选 | 上下文携带 | 验证层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pirate_king_move` | C1 计分前海盗王可移动到即将计分基地；C2 玩家可不发动 | 海盗王本体 | `sourceUid/minionUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 当前计分基地 | 可选，有“不发动” | `sourceUid/fromBaseIndex/baseDefId` | L1/L2/L3/L4 | 通过代表链验证 |
| `pirate_first_mate_choose_base` | C1 计分后大副可移动到其它基地；C2 玩家可跳过 | 大副本体 | 同共享合同 | 非源基地 | 可选，有跳过 | `sourceUid/fromBaseIndex/baseDefId`，resolver 用 live 基地定位 | L1/L2/L3/L4 | 通过复杂链验证 |
| `ancient_egyptians_mummy_after_scoring` | C1 计分后木乃伊可埋到另一个基地；C2 可跳过 | 木乃伊本体 | 同共享合同 | 非源基地 | 可选，有跳过 | `sourceUid/fromBaseIndex/baseDefId` | L1/L2 | 结构与领域验证；L3 由同构木乃伊代表链覆盖 |
| `world_champs_sheriff_before_scoring` | C1 计分前警长可令自己与这里另一位玩家的一个随从决斗；C2 可跳过 | 警长本体 | `sourceUid/minionUid` -> `targetMinionUid` -> `respondCurrentPrompt` | 同基地敌方随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/sourceDefId` | L1/L2/L3/L4 | 通过专门 E2E 验证 |
| `world_champs_mummy_after_scoring` | C1 计分后木乃伊可埋到另一个基地；C2 可跳过 | 木乃伊本体 | 同共享合同 | 非源基地 | 可选，有跳过 | `sourceUid/fromBaseIndex/baseDefId`，resolver 用 live 基地定位 | L1/L2/L3/L4 | 通过专门 E2E 验证 |
| `mermaids_shipwreck_cove_after_scoring` | C1 计分后沉船湾可移到另一个基地；C2 可跳过 | 沉船湾本体 | `sourceUid/cardUid/ongoingUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 非源基地 | 可选，有跳过 | `sourceUid/cardUid/ongoingUid/sourceBaseIndex/baseDefId` | L1/L2/L3/L4 | 通过现成 E2E 复验 |
| `skeletons_gravestones_after_scoring` | C1 计分后墓碑可埋葬到另一个基地；C2 可跳过 | 墓碑本体 | `sourceUid/cardUid/ongoingUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 非源基地 | 可选，有跳过 | `sourceUid/cardUid/ongoingUid/sourceBaseIndex/baseDefId` | L1/L2/L3/L4 | 通过现成 E2E 复验 |
| `cyborg_apes_flying_monkey_move` | C1 计分后飞天猴可把宿主随从移动到另一基地并摧毁自身；C2 可跳过 | 飞天猴附着行动本体 | `sourceUid/cardUid/ongoingUid/actionUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 非源基地 | 可选，有跳过 | `sourceUid/cardUid/ongoingUid/sourceBaseIndex/baseDefId/minionUid/actionUid`，resolver 用 prompt 时快照拒绝伪造新目标 | L1/L2 + L3 代表链复用 | UI 入口复用沉船湾/墓碑的 `持续行动/行动 -> 基地` L3 链；独有“移动宿主并弃置行动”由领域与队列测试锁定，非默认逐图缺口 |
| `diy_killers_michael_myers` | C1 计分前麦克尔可摧毁同基地一个印刷力量不高于 3 的目标随从；C2 可跳过 | 麦克尔本体 | `sourceUid/minionUid` -> `targetMinionUid` -> `respondCurrentPrompt` | 同基地合法随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/targetMinionDefId` | L1/L2 + L3 代表链复用 | UI 入口复用警长的 `随从 -> 随从` L3 链；独有摧毁筛选和最终状态由定向行为测试锁定，非默认逐图缺口 |
| `sharks_megalodon_before_scoring` | C1 计分前巨齿鲨可消灭同基地一个力量不高于 3 的随从；C2 可跳过 | 巨齿鲨本体 | `sourceUid/minionUid` -> `targetMinionUid` -> `respondCurrentPrompt` | 同基地合法低力量随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/targetMinionDefId`，resolver 明确读取 `targetMinionUid`，不把来源 `minionUid` 误当目标 | L1/L2 + L3 代表链复用 | UI 入口复用警长的 `随从 -> 随从` L3 链；独有低力量过滤、目标摧毁和来源/目标不混淆由队列运行态测试锁定，非默认逐图缺口 |
| `munchkin_clerics_bin_and_gone_minion` | C1 计分后垃圾处理可把另一个基地的己方随从移动到这张持续行动所在基地；C2 可跳过 | 垃圾处理本体 | `sourceUid/ongoingUid` -> `targetMinionUid` -> `respondCurrentPrompt` | 其它基地己方随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/targetMinionDefId` | L1/L2/L3 | 通过现成 Munchkin E2E 复验 |
| `titan_mega_troopers_megabot_move` | C1 计分前超级佐德可移动到即将计分基地；C2 可留在原地 | 超级佐德泰坦本体 | `sourceUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 当前计分基地 | 可选，有留在原地 | `sourceUid/sourceBaseIndex/fromBaseIndex/scoringBaseDefId`，resolver 用 live 泰坦位置复核 | L1/L2/L3/L4 | 通过现成 E2E 复验 |
| `titan_tornados_category_5_move` | C1 计分前五级风暴可移动到即将计分基地；C2 可留在原地 | 五级风暴泰坦本体 | `sourceUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 当前计分基地 | 可选，有留在原地 | `sourceUid/sourceBaseIndex/fromBaseIndex/scoringBaseDefId`，resolver 用 live 泰坦位置复核 | L1/L2 | 结构与领域验证；L3 由同构超级佐德代表链覆盖 |
| `titan_pirates_the_kraken_choose_minion` | C1 计分后克拉肯可选择此处己方随从救走；C2 选择随从后再选择目标基地；C3 可跳过 | 克拉肯泰坦本体 | `sourceUid` -> `targetMinionUid` -> 后续 `titan_pirates_the_kraken_choose_base` | 同基地己方随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/targetMinionDefId`，后续步骤携带已选随从 | L1/L2/L3 | 第一段通过现成泰坦 E2E 复验；第二段仍是后续目标基地选择 |
| `alien_scout_return` | C1 计分后侦察兵可返回拥有者手牌；C2 玩家可留在基地 | 侦察兵本体 | `sourceUid/minionUid` -> `respondCurrentPrompt` | 来源侦察兵自身 | 可选，有“留在基地” | `sourceUid/sourceBaseIndex/minionDefId`，触发排序阶段用 `sourceCardUid` 精确选实例 | L1/L2/L3/L4 | 通过现成复杂 E2E 复验 |
| `ancient_egyptians_pharaoh_before_scoring_choose_source` -> `ancient_egyptians_pharaoh_before_scoring` | C1 计分前法老可发动；C2 发动后翻开这里自己的一张埋葬牌；C3 可不发动 | 法老本体；第二步是埋葬牌卡面 | `sourceUid/minionUid` -> `cardUid/baseIndex` -> `respondCurrentPrompt` | 法老所在计分基地的己方埋葬牌 | 可选，有跳过 | `sourceUid/sourceBaseIndex/baseIndex`；第二步声明 `genericIntent: 'buried-card'` 并用 live buried options 重建 | L1/L2 | 本轮修复：不再直接打开埋葬牌 generic；先点法老本体，再进入埋葬牌选择 |
| `huluwawa_liu_wa_before_scoring` | C1 计分前六娃可取消自己的天赋减力效果；C2 玩家可保留效果 | 六娃本体 | `sourceUid/minionUid` -> `respondCurrentPrompt` -> `su:timed_power_modifier_cancelled` + `PERMANENT_POWER_ADDED` | 来源六娃自身 | 可选，有“保留效果” | `sourceUid/sourceBaseIndex/minionDefId`；旧 `continuationContext.minionUid` 仅保留兼容旧测试夹具 | L1/L2 | 本轮从按钮窗口迁入 `field-source-action`；完整管线行为测试覆盖取消记录和恢复力量 |
| `giant_ant_under_pressure_choose_source` | C1 计分前手牌响应“承受压力”打出后，先选计分基地上转出力量指示物的己方来源随从；C2 后续选择其它基地接收随从；C3 再选数量 | 来源随从本体 | `sourceUid/minionUid` -> 后续 `giant_ant_under_pressure_choose_target` -> `giant_ant_under_pressure_choose_amount` | 己方有力量指示物的来源随从 | 必选来源；后续数量 1..来源指示物数 | `sourceUid/sourceBaseIndex/sourceCounterAmount/scoringBaseIndex` | L1/L2 | 本轮迁入 `field-source-action`；行为测试覆盖来源本体提交后进入目标和数量步骤 |
| `giant_ant_we_are_the_champions_choose_source` | C1 计分后手牌响应“我们乃最强”打出后，若来源仍在场，先选转出力量指示物的己方来源随从；C2 后续选择接收随从和数量 | 来源随从本体 | `sourceUid/minionUid` -> 后续 `giant_ant_we_are_the_champions_choose_target` -> `giant_ant_we_are_the_champions_choose_amount` | 己方有力量指示物的来源随从 | 必选来源；后续数量 1..来源指示物数 | `sourceUid/sourceBaseIndex/sourceCounterAmount/scoringBaseIndex`；计分后离场版本改走 snapshot generic | L1/L2 | 本轮迁入 live `field-source-action`；计分后快照 `giant_ant_we_are_the_champions_choose_snapshot_source` 保留 `generic` |

### 完整技能流程矩阵

| 对象 | 真相源语义 | 静态定义 | 候选/入口 | 命令/执行 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 海盗王 | 计分前可移动本随从到计分基地 | `pirate_king` 注册 `beforeScoring` | 来源本体先亮，目标基地后亮 | `buildValidatedMoveEvents(...)` | 不发动；未选来源时基地不可提交；非法基地不改变状态 | 后续进入手牌响应和计分链 | L1-L4 | 当前共享族代表通过 |
| 大副 | 计分后可移动本随从到其它基地 | `pirate_first_mate` 注册 `afterScoring` | 来源本体先亮，其它基地后亮 | `buildValidatedMoveEvents(...)` | 跳过；源基地不可作为目标 | 托尔图加后续和清场替换继续 | L1-L4 | 当前共享族代表通过 |
| 古埃及木乃伊 | 计分后可埋本随从到另一个基地 | `ancient_egyptians_mummy` 注册 `afterScoring` | 使用共享来源-目标合同 | `buildBuryCardEvents(...)` | 跳过；源基地排除 | 领域测试覆盖响应队列上下文 | L1-L2 | 同构入口已纳入静态门禁 |
| 警长 | 计分前可令本随从与同基地敌方随从决斗 | `world_champs_sheriff` 注册 `beforeScoring` | 来源本体先亮，敌方随从后亮 | `startDuelWithEvents(...)` | 跳过；未点来源前目标随从不可提交 | 决斗 prompt 打开，落败随从被摧毁，主动决斗态清空 | L1-L4 | `随从 -> 随从` 代表通过 |
| 世界冠军木乃伊 | 计分后可埋本随从到另一个基地 | `world_champs_mummy` 注册 `afterScoring` | 来源本体先亮，其它基地后亮 | `buildBuryCardEvents(...)` | 跳过；源基地不可作为目标 | 交互关闭，进入下一玩家出牌阶段 | L1-L4 | 专门真实入口验证通过 |
| 沉船湾 | 计分后可移动这张持续行动到另一个基地 | `mermaids_shipwreck_cove` 注册 `afterScoring` | 沉船湾本体先亮，其它基地后亮 | 通过持续行动来源的 shared prompt program 移动卡牌 | 跳过；源基地不可作为目标；未点来源前基地不可提交 | 交互关闭，沉船湾进入目标基地 | L1-L4 | `持续行动/行动 -> 基地` 代表通过 |
| 墓碑 | 计分后可把这张持续行动埋葬到另一个基地 | `skeletons_gravestones` 注册 `afterScoring` | 墓碑本体先亮，其它基地后亮 | 通过持续行动来源的 shared prompt program 埋葬卡牌 | 跳过；源基地不可作为目标；未点来源前基地不可提交 | 交互关闭，墓碑进入目标基地埋葬区 | L1-L4 | `持续行动/行动 -> 基地` 代表通过 |
| 飞天猴 / 细胞结合复制飞天猴 | 计分后可把宿主随从移到另一基地，然后本行动进弃牌堆 | `cyborg_apes_flying_monkey` / `shapeshifters_cellular_bonding` 注册 `afterScoring` | 飞天猴或复制飞天猴的附着行动本体先亮，其它基地后亮 | `buildValidatedMoveEvents(...)` + `detachOngoing(...)` | 跳过时按正常计分清场；prompt 后新增随从/行动/目的地不得伪造成候选 | 移动宿主并把行动送入真实拥有者弃牌堆 | L1-L2 + L3 代表链复用 | UI 入口复用沉船湾/墓碑；独有 copied/borrowed 来源归属、宿主移动和行动弃置由队列测试覆盖 |
| 麦克尔 | 计分前可摧毁同基地一个印刷力量不高于 3 的随从 | `diy_killers_michael_myers` 注册 `beforeScoring` | 麦克尔本体先亮，合法目标随从后亮 | `MINION_DESTROYED` / 保护过滤链 | 跳过；不满足目标条件的随从不可成为目标 | 目标随从进弃牌堆，交互关闭后计分继续 | L1-L2 + L3 代表链复用 | UI 入口复用警长；独有目标筛选和摧毁落地由定向行为测试覆盖 |
| 巨齿鲨 | 计分前可消灭同基地一个力量不高于 3 的随从 | `sharks_megalodon` 注册 `beforeScoring`，交互 sourceId 为 `sharks_megalodon_before_scoring` | 巨齿鲨本体先亮，合法目标随从后亮 | `buildValidatedDestroyEvents(...)` | 跳过；不满足力量条件的随从不可成为目标；resolver 不把来源本体误当目标 | 目标随从进弃牌堆，交互关闭后计分继续 | L1-L2 + L3 代表链复用 | UI 入口复用警长；独有低力量过滤和来源/目标不混淆由队列运行态测试覆盖 |
| 垃圾处理 | 计分后可把其它基地己方随从移动到这张持续行动所在基地 | `munchkin_clerics_bin_and_gone` 注册 `afterScoring` | 垃圾处理本体先亮，合法目标随从后亮 | `MINION_MOVED` | 跳过；未点来源前目标随从不可提交；目标必须仍是合法己方随从 | 目标随从移动到来源基地，交互关闭 | L1-L3 | `持续行动 -> 随从` 代表通过 |
| 超级佐德 | 计分前可移动此泰坦到即将计分基地 | `mega_troopers_megabot` 注册 `beforeScoring` | 泰坦本体先亮，目标基地后亮 | `moveTitan(...)` | 留在原地；未选来源时基地不可提交；来源泰坦离开原基地则拒绝旧 prompt | 交互关闭，泰坦进入计分基地，回到出牌阶段 | L1-L4 | `泰坦 -> 基地` 代表通过 |
| 五级风暴 | 计分前可移动此泰坦到即将计分基地 | `tornados_category_5` 注册 `beforeScoring` | 泰坦本体先亮，目标基地后亮 | `moveTitan(...)` | 留在原地；来源泰坦离开原基地则拒绝旧 prompt | 领域测试覆盖泰坦移动和 stale prompt 拒绝 | L1-L2 | 同构入口已纳入静态门禁 |
| 克拉肯救随从第一段 | 计分后可选择此处己方随从并让其改去其它基地 | `pirates_the_kraken` 注册 `afterScoring` | 克拉肯泰坦本体先亮，己方随从后亮 | 第一段记录已选随从，第二段选择目标基地后移动 | 跳过；未点泰坦前目标随从不可提交；第二段基地选择不得被当成来源第一入口 | 随从从计分清场里救出并移动到目标基地，旧基地继续替换 | L1-L3 | `泰坦 -> 随从` 第一段通过；后续目标基地选择保留独立步骤 |
| 侦察兵 | 计分后可将此侦察兵返回手牌 | `alien_scout` 注册 `afterScoring` | 侦察兵本体先亮；没有第二目标 | `buildValidatedReturnEvents(...)` | 留在基地；不再保留“返回手牌”按钮代理主路径 | 返回手牌后，同一计分链继续处理下一只侦察兵或后续触发，最终交互关闭 | L1-L4 | `随从来源确认 -> 直接回手` 代表通过 |
| 法老 | 计分前可翻开这里自己的一张埋葬牌 | `ancient_egyptians_pharaoh` / `ancient_egyptians_pharaoh_pod` 注册 `beforeScoring`，第一步交互 sourceId 为 `ancient_egyptians_pharaoh_before_scoring_choose_source` | 法老本体先亮；点击后才打开埋葬牌卡面选择 | `buildFieldSourceActionOptions(...)` 提交来源；第二步 `uncoverBuriedCard(...)` | 跳过；不点击法老前不直接高亮埋葬牌；第二步 `genericIntent: 'buried-card'`，不伪装成基地/随从直点 | 埋葬牌翻开事件按埋葬系统继续处理，触发队列归属仍为法老控制者 | L1-L2 | 本轮从直接 generic prompt 拆为来源本体确认 + 埋葬牌选择 |
| 六娃 | 计分前可取消自己的天赋减力效果 | `huluwawa_liu_wa` 注册 `beforeScoring` | 六娃本体先亮；没有第二目标 | `buildFieldSourceActionOptions(...)` 提交来源后取消待回退记录并恢复力量 | 保留效果；旧按钮不得直接代理取消 | 完整管线不混写 core，事件先取消记录再恢复力量 | L1-L2 | 本轮从按钮窗口迁入 `field-source-action` |
| 承受压力 live 来源 | 计分前手牌响应后，从计分基地己方随从转出力量指示物 | `giant_ant_under_pressure` special 进入 `giant_ant_under_pressure_choose_source` | 来源随从本体先亮；当前 prompt 没有并列目标 | `buildFieldSourceActionOptions(...)` 提交来源后进入目标随从，再进入数量确认 | 来源必须在计分基地、属于玩家且有力量指示物；目标不能在计分基地 | 转移后移除来源指示物、添加到目标随从，计分链继续 | L1-L2 | 已迁共享 `field-source-action`，不再是普通目标随从直选 |
| 我们乃最强 live 来源 | 计分后手牌响应后，从仍在场的己方随从转出力量指示物 | `giant_ant_we_are_the_champions` special 进入 live source program；离场来源走 snapshot program | 来源随从本体先亮；当前 prompt 没有并列目标 | `buildFieldSourceActionOptions(...)` 提交来源后进入目标随从和数量确认 | 来源必须仍在场、属于玩家且有力量指示物；snapshot 离场版本保留 generic | 转移后更新目标指示物；计分后清场/后续链继续 | L1-L2 | live 来源迁共享；snapshot generic 保留，避免把离场快照误当场上对象 |

## 同类分流

| 计分时效果类型 | 例子 | 应用交互原则 | 本轮裁定 |
| --- | --- | --- | --- |
| 强制自动效果 | `vampire_buffet`、`base_no_moon`、`base_unicrave` | 自动结算；只有规则要求选择目标/顺序时才开对应选择 | 不应要求点来源 |
| 来源随从 -> 直接回手 | `alien_scout_return` | 来源本体先亮；点击来源本体提交后直接回手；跳过 / 留在基地用按钮 | 本轮复用现成复杂 E2E 验证 |
| 来源随从 -> 后续埋葬牌选择 | `ancient_egyptians_pharaoh_before_scoring_choose_source` | 来源本体先亮；点击法老只表示发动，随后才打开埋葬牌 `genericIntent: 'buried-card'` 卡面选择；埋葬区不是场上目标对象 | 本轮补行为测试；不归入来源-目标基地/随从族 |
| 来源随从 -> 直接执行自身效果 | `huluwawa_liu_wa_before_scoring` | 来源本体先亮；点击来源本体提交后直接执行自身效果；否定分支用按钮 | 本轮已迁入 `field-source-action`，并补完整管线行为测试 |
| 来源随从 -> 后续目标/数量 | `giant_ant_under_pressure_choose_source`、`giant_ant_we_are_the_champions_choose_source` | 来源本体先亮；点击来源本体只确认来源并进入后续目标 / 数量步骤；目标不能在第一帧提前高亮 | 本轮已迁入 `field-source-action` 并补定向行为测试；离场快照版本不适用 |
| 手牌响应 | 忍者 / afterScoring 响应手牌 | 响应窗口只开放时机和跳过；合法手牌高亮，非响应手牌置灰；点手牌后再点目标 | 已在复杂链中验证 |
| 来源随从 -> 目标基地 | 本文四个对象 | 来源本体先亮；点来源后高亮合法基地 | 本轮重点验证 |
| 来源随从 -> 目标随从 | `world_champs_sheriff_before_scoring`、`diy_killers_michael_myers`、`sharks_megalodon_before_scoring` | 来源本体先亮；点来源后高亮合法目标随从 | 警长提供 L3 代表链；麦克尔和巨齿鲨复用入口链，独有摧毁/过滤语义由 L2 锁定；除非用户要求单卡验收图，否则不重复补截图 |
| 来源持续/行动 -> 目标基地 | `skeletons_gravestones_after_scoring`、`mermaids_shipwreck_cove_after_scoring`、`cyborg_apes_flying_monkey_move` | 来源本体先亮；点来源持续行动/行动后高亮合法基地 | 沉船湾/墓碑提供 L3 代表链；飞天猴复用入口链，独有宿主移动和行动弃置由 L2 锁定；除非用户要求单卡验收图，否则不重复补截图 |
| 来源持续/行动 -> 目标随从 | `munchkin_clerics_bin_and_gone_minion` | 来源本体先亮；点来源持续行动后高亮合法目标随从 | 本轮复用现成 Munchkin E2E 验证 |
| 来源泰坦 -> 目标基地 | `titan_mega_troopers_megabot_move`、`titan_tornados_category_5_move` | 来源泰坦本体先亮；点泰坦后高亮合法目标基地 | 本轮已纳入代表验证 |
| 来源泰坦 -> 目标随从 | `titan_pirates_the_kraken_choose_minion` | 来源泰坦本体先亮；点泰坦后高亮合法目标随从；后续再选择目标基地 | 克拉肯救随从第一段已纳入；第二段 `titan_pirates_the_kraken_choose_base` 是后续目标基地选择 |
| 基地能力 | `base_tortuga`、`base_greenhouse` 等 | 基地通常是来源或规则场所；第一入口可能是目标随从、牌库候选、手牌或确认 | 当前范围外，不能套随从来源合同 |
| 其它泰坦/特殊场上对象 | 未在本文列入的其它泰坦或场上对象 | 需要单独判定来源对象类型和目标对象类型；若是可选来源到目标，接入同一 source-target 合同 | 超级佐德/五级风暴/克拉肯第一段已纳入；其它仍逐牌分流 |
| 目标为手牌/玩家/牌库 | `mega_troopers_power_pose_pod_after_scoring` 等 | 第一入口按真实目标或来源动作链拆；不归入目标基地/随从族 | 当前范围外 |

## 计分时效果全量审计裁定

裁定：全部计分时效果都应该进入对象全集审计，但审计的第一步是职责分流，不是全部改成交互、不全部点来源、不全部跑同一种 E2E。

本轮新增的是 L1 清单快照，不能外推为逐牌深审完成。这里分两层：

1. **运行时注册点**：实际进入 `registerTrigger(...)` / `registerBaseAbility(...)` 的计分窗口效果。
2. **数据定义层牌/场上 special**：卡牌或场上对象声明了 `specialTiming`、`responseWindowTiming`、`beforeScoringPlayable` 或 `activatableAbilities.window` 的计分时机入口；它们不一定全部都有单独运行时注册点，部分会走响应窗口、普通打出链或共享 special 激活链。

运行时注册点快照：

| 范围 | 数量 | 现实含义 |
| --- | ---: | --- |
| `beforeScoring` | 30 | 计分前触发或开放响应窗口的效果 |
| `whenScoring` | 3 | 计分结算当下读取排名、战力或奖励的效果 |
| `afterScoring` | 69 | 计分后、清场前后或计分后响应链里的效果 |
| `registerTrigger` | 54 | 卡牌、泰坦、持续牌或等价来源对象触发 |
| `registerBaseAbility` | 48 | 基地自身计分时能力 |
| 总计 | 102 | 后续 full-audit 的 L1 调用点全集起点；唯一来源表达式为 101 |

数据定义层快照：

| 字段/入口 | 数量 | 现实含义 |
| --- | ---: | --- |
| `specialTiming: beforeScoring` | 67 | 手牌或场上 special 在计分前可发生 |
| `specialTiming: afterScoring` | 36 | 手牌或场上 special 在计分后可发生 |
| `responseWindowTiming: beforeScoring` | 32 | 响应窗口允许从手牌打出的计分前牌 |
| `responseWindowTiming: afterScoring` | 12 | 响应窗口允许从手牌打出的计分后牌 |
| `activatableAbilities.window: beforeScoring` | 21 | 场上对象在计分前开放可选发动窗口 |
| `activatableAbilities.window: afterScoring` | 6 | 场上对象在计分后开放可选发动窗口 |
| `beforeScoringPlayable: true` | 5 | 计分前可从手牌打出的随从 |
| 文本级标记总数 | 179 | 后续“全部计分时效果的牌” full-audit 的数据定义层入口起点；上述字段分组非互斥，166 个最近 id 中仍有 21 个需要后续 AST 解析回真实对象 |

按入口快照分组：

| 分组 | 数量 | sourceId 快照 |
| --- | ---: | --- |
| beforeScoring / trigger | 20 | `ancient_egyptians_pharaoh`, `ancient_egyptians_pharaoh_pod`, `cowboys_sheriff`, `cthulhu_chosen`, `diy_killers_michael_myers`, `dragons_bring_down_the_walls`, `elder_thing_dunwich_horror_pod`, `MAGIC_HELMET`, `huluwawa_liu_wa`, `base_great_white_north_eh`, `luchadors_capa_roja`, `mega_troopers_power_pose_pod`, `pirate_king`, `sharks_megalodon`, `mega_troopers_megabot`, `tornados_category_5`, `tornados_dust_devil`, `werewolf_loup_garou`, `werewolf_pack_alpha`, `world_champs_sheriff` |
| beforeScoring / base | 10 | `base_no_moon`, `base_unicrave`, `base_diy_killers_nightmare_world`, `base_gingerbread_house`, `base_q_point`, `base_juice_bar`, `base_palooza`, `base_out_in_the_woods`, `base_secret_volcano_headquarters`, `base_brood_hive` |
| afterScoring / trigger | 34 | `alien_scout`, `ancient_egyptians_mummy`, `ancient_egyptians_mummy_pod`, `giant_ant_we_are_the_champions`, `giant_ant_we_are_the_champions_pod`, `innsmouth_return_to_the_sea`, `masters_of_evil_baron_zemo`, `masters_of_evil_a_portent_of_doom`, `masters_of_evil_world_domination`, `sinister_six_cover_the_exits`, `mega_troopers_power_pose_pod`, `mermaids_shipwreck_cove`, `mermaids_shipwreck_cove_pod`, `THIEVES_CLEVER_DISTRACTION`, `BIN_AND_GONE`, `HELPING_HANDS`, `ZERO`, `SANDY_CLAWS_COSTUME`, `penguins_leaping_aboard`, `penguins_ice_slide`, `pirate_first_mate`, `princesses_happily_ever_after`, `EXCALIBUR`, `skeletons_gravestones`, `itty_critters_rainboroc`, `sphinx`, `defId`, `pirates_the_kraken`, `vampire_buffet`, `world_champs_mummy`, `shapeshifters_cellular_bonding`, `cyborg_apes_flying_monkey`, `vigilantes_the_revenge`, `disco_dancers_i_will_survive` |
| afterScoring / base | 35 | `base_goblin_caves`, `base_island_chain`, `BASE_THE_COFFERS`, `BASE_HOTEL_OF_HOLINESS`, `BASE_HALLOWEEN_TOWN`, `BASE_SPIRAL_HILL`, `base_retirement_community`, `BASE_THE_DUMP`, `base_portal_room`, `base_the_nexus`, `base_primate_park`, `base_isis_swingin_pad`, `base_haunted_house`, `base_dragons_lair`, `base_temple_of_goju`, `base_temple_of_goju_pod`, `base_great_library`, `base_golem_schloss`, `base_ritual_site`, `base_the_mothership`, `base_ninja_dojo`, `base_ninja_dojo_pod`, `base_pirate_cove`, `base_tortuga`, `base_wizard_academy`, `base_jungle_camp`, `base_time_traveling_car`, `base_wraithrustlers_hq`, `base_the_greasy_spoon`, `base_truck_stop`, `base_miskatonic_university_base`, `base_miskatonic_university_base_pod`, `base_greenhouse`, `base_inventors_salon`, `base_tabletop` |

快照说明：

- `defId` 是 `src/games/smashup/abilities/titans.ts:5786` 的动态注册入参，后续 full-audit 必须解析它的实际泰坦 sourceId；当前只登记为 L1 动态入口。
- 大写常量如 `MAGIC_HELMET`、`BASE_THE_COFFERS` 是代码里的注册常量名；逐牌深审时必须回到静态定义或常量声明解析中文牌名与真实 id。
- 这 102 个运行时调用点需要逐项审，但审计结论必须分成自动效果、手牌响应、基地效果、场上来源对象、泰坦/持续牌和目标选择等类型；只有“可选 / 主动发动的场上来源对象”才适用“先点来源本体，再点目标对象”的 UI 语义。

### 全量计分效果后续深审队列

续跑裁定：全部计分时效果都应该进入审计对象全集；当前本文只完成 L1 清单和场上来源-目标共享族代表验证，不能把它说成全牌库逐牌审完。

2026-08-17 本轮续跑机器扫描修正了旧口径：当前运行时是 102 个计分相关调用点、101 个唯一来源表达式。下面粗分组来自旧 L1 分流表，仍可作为排队线索，但下一轮 full-audit 必须用 102 个调用点重新回填每一行：

| 粗分组 | 数量 | 现实含义 | 后续处理 |
| --- | ---: | --- | --- |
| 基地能力 | 43 | 基地自身在计分时触发或开放选择 | 逐基地审目标、奖励、替换、清场和后续队列 |
| 自动 / 无玩家选择或旁路注册 | 23 | 当前扫描未见玩家目标选择；可能是自动效果、响应额度或旁路注册 | 逐项确认是否确实无需玩家入口，不能只靠“没有弹窗”判通过 |
| 场上来源对象 -> 目标对象 | 11 | 当前扫描命中共享 `field-source-target` 入口 | 继续用本文共享合同和 E2E / 行为测试补 L3/L4 |
| 其它目标选择 | 10 | 计分触发中会让玩家点目标或后续目标，但不属于本文共享族 | P0 深审；逐项判断是否应拆成来源先点、目标后点，或保留目标直选 |
| generic 复合选择 | 5 | 选择对象携带复合上下文，例如埋葬牌、牌名或计分后离场快照 | P0 深审；确认不是用 generic 掩盖仍在场的本体可点对象 |
| 手牌 / 卡牌选择或响应链 | 4 | 响应窗口、牌库/手牌卡面或额外打出链 | P0 深审；按“手牌本体第一入口”规范核对 |
| 纯按钮 / 模式或需确认 | 3 | 当前看起来是确认、跳过、是否替换或奖励分支 | P0 深审；按钮不得携带对象目标，也不得代替来源发动 |

P0 非共享族入口清单如下。这里的“P0”表示最先审，不表示已经判定为 bug：

| sourceId | 当前粗判 | 需要审的现实问题 |
| --- | --- | --- |
| `alien_scout` / `alien_scout_return` | 已从 P0 待审提升为本轮代表链 | 已迁入 `field-source-action`：侦察兵本体高亮，点击本体回手；“留在基地”按钮保留；已补无残留和跳过分支 E2E |
| `ancient_egyptians_pharaoh` / `ancient_egyptians_pharaoh_before_scoring` | 已从 P0 待审提升为本轮来源本体确认修复 | 已拆成两段：第一步 `ancient_egyptians_pharaoh_before_scoring_choose_source` 为 `field-source-action`，玩家先点法老本体；第二步 `ancient_egyptians_pharaoh_before_scoring` 保留 `genericIntent: 'buried-card'`，只选择埋葬区卡面 |
| `giant_ant_under_pressure` / `giant_ant_under_pressure_choose_source` | 已从 P0 待审提升为本轮共享族修复 | 已迁入 live `field-source-action`：先点计分基地上有力量指示物的来源随从本体，再进入其它基地接收随从与数量选择 |
| `giant_ant_we_are_the_champions` / `giant_ant_we_are_the_champions_choose_source` | live 来源选择已从 P0 待审提升为本轮共享族修复 | 来源仍在场时已迁入 `field-source-action`：先点转出来源随从本体，再进入接收随从和数量；`giant_ant_we_are_the_champions_choose_snapshot_source` 是计分后离场快照，继续保留 `generic` |
| `innsmouth_return_to_the_sea` | 已从 P0 待审降为手牌响应 + 定义选择链 | 第一入口是响应窗口中的手牌本体；若需先选同名组，`innsmouth_return_to_the_sea_choose_name` 声明 `genericIntent: 'definition-choice'`，随后 `targetType: 'minion'` 多选同名随从回手；不是场上来源本体发动 |
| `penguins_ice_slide` | 计分后强制自动抽牌链 | 已确认注册为 `mandatory: true`，效果按来源控制者自动抽牌；不应要求玩家点冰滑道来源 |
| `sharks_megalodon` / `sharks_megalodon_before_scoring` | 已从 P0 待审提升为本轮共享族修复 | 已迁入 `field-source-target`：巨齿鲨本体高亮，点击本体后才高亮同基地力量≤3目标随从；跳过按钮保留；入口 L3 复用警长代表链，独有低力量过滤与摧毁落地由队列运行态测试锁定 |
| `shapeshifters_cellular_bonding` | 已从 P0 待审降为飞天猴共享链复用项 | 复用 `cyborg_apes_flying_monkey_move` 的附着行动来源 -> 目标基地链；已有队列测试覆盖 copied/borrowed 细胞结合的当前控制者归属，残余只是不把它外推成全量计分效果收口 |
| `disco_dancers_i_will_survive` | 已从 P0 待审降为手牌响应 -> 目标随从链 | 第一入口是响应窗口中的手牌本体；打出后 `targetType: 'minion'` 选择计分基地己方随从回手；现有行为测试与 E2E 覆盖消耗、目标回手和窗口收口，不应改成场上来源点选 |

后续深审最低动作：每个 P0 行都必须拆成“规则子句 -> 第一入口 -> 命令/执行 -> 最终权威状态 -> 跳过/否定路径 -> 后续清理”，至少达到 L2；凡玩家真实入口可见，应补 L3 E2E 或写清代表链复用依据。只有对象存在独有 UI 时机、候选生成、入口顺序、目标类型、上下文携带或最终可见落点差异，才默认补单卡 L3 截图。

## 验证证据

### 类型检查

- 命令：`npm run typecheck`
- 结果：通过。

### L1 结构证据

- 命令：`node` 脚本扫描 `registerTrigger(...)` / `registerBaseAbility(...)` 的计分注册点。
- 结果：登记到 102 个计分时运行时调用点、101 个唯一来源表达式；`beforeScoring` 30 个，`whenScoring` 3 个，`afterScoring` 69 个；`registerTrigger` 54 个，`registerBaseAbility` 48 个。
- 结论：计分时效果必须全量建清单分流；当前共享族只是其中一类，不代表所有计分效果。

- 命令：`node` AST 脚本扫描 `src/games/smashup/data/factions/**/*.ts` 中的 `specialTiming` / `responseWindowTiming` / `beforeScoringPlayable` / `activatableAbilities.window`。
- 结果：登记到 179 个计分时机标记，最近 id 去重为 166 个；字段分组为 `specialTiming: beforeScoring` 67、`specialTiming: afterScoring` 36、`responseWindowTiming: beforeScoring` 32、`responseWindowTiming: afterScoring` 12、`activatableAbilities.window: beforeScoring` 21、`activatableAbilities.window: afterScoring` 6、`beforeScoringPlayable: true` 5；字段分组非互斥，且仍有 21 个最近 id 需后续 AST 深扫还原为真实对象。
- 结论：用户说“全部计分时效果的牌”时，审计范围不能只看 102 个运行时调用点，还必须覆盖数据定义层入口；但逐牌 L2/L3/L4 深审仍未完成。

### L1 / UI 合同证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/Board.interactionBars.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：通过，12 tests（2026-08-17 续审复跑）。
- 测试断言：
  - 响应手牌不能由窗口按钮代点，Board 中不应出现 `respondCurrentPrompt({ optionId: reactionOption.id })` 这类直接代理路径。
  - 场上可发动来源-目标效果必须读取 `fieldInteractionType/source-target` 三段合同。
  - 场上来源本体确认必须读取 `fieldInteractionType/source-action`，并声明 `targetType: 'field-source-action'`。
  - `fieldSourceTargetInteraction.ts` 统一生成来源高亮、目标高亮和 optionId 映射；Board 只在当前 prompt 声明 `targetType: 'field-source-target'` 或 `targetType: 'field-source-action'` 时进入对应消费链。
  - 来源对象可以是随从、持续行动、行动或泰坦；Board 必须把合法持续行动来源传给场上卡本体高亮，把合法泰坦来源传给泰坦本体高亮，而不是只支持随从。
  - 只有选中来源后，合法目标基地或目标随从才进入可提交状态。
  - Board 不得再读取旧 `fieldSourceTargetType` 兼容字段；UI 只能消费 `fieldInteractionType/source-target` + `fieldSourceType` + `fieldTargetType` 三段合同。
  - 共享模型行为测试覆盖 `随从 -> 基地`、`持续行动 -> 随从`、`泰坦 -> 随从` 和 `随从来源本体确认`：来源-目标类打开窗口时只给来源集合，点击来源后才给目标集合和提交 optionId；来源本体确认类打开窗口时给来源集合，点击来源直接提交 optionId。
  - `smashup_reaction_choose` 的手牌响应选项统一由 `reactionChoiceInteraction.ts` 解析；Board 不再本地定义 `ReactionChoicePromptOptionValue` / `isReactionHandPlayValue` / `getReactionChoiceBaseIndex` / `getReactionChoiceTargetMinionUid`，AI 也不再保留自己的 `SmashUpReactionChoiceValue` 解析。

### AI 合法动作证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：通过，10 tests。
- 测试断言：AI 不走玩家 UI 的“两步点击来源再点击目标”DOM 路径，而是从当前 live simple-choice 直接枚举合法 option；`field-source-target` 选项必须在 metadata 中保留 `fieldInteractionType/sourceUid/minionUid/targetBaseIndex/baseIndex`，并用当前 `interactionId + optionId` 提交 `SYS_INTERACTION_RESPOND`；同一窗口里的 `skip` 也仍是合法 AI 选项。

### L1 结构门禁证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "所有 createSimpleChoice"`
- 结果：通过，1 passed / 11 skipped。
- 本轮补充断言：
  - 牌库行动检索不能冒充手牌直选：`anansi_tales_the_perfect_gift` / `anansi_tales_anansi_the_spider` 改为 `targetType: 'generic'` 并按牌库 live 校验。
  - 其它基地场上行动卡选择不能冒充当前基地直点：`ancient_incas_llama` 保留 generic 复合上下文。
  - 选玩家交互必须声明玩家目标：`ignobles_give_control` 改为 `targetType: 'player'`。
  - 真正从手牌打出额外随从的交互必须标明来源：`paladins_heavenly_soldiers_descend` 与 `russian_fairy_tales_the_gray_wolf` 的手牌候选补 `_source: 'hand'`。
  - 混合弃牌堆卡面选择和额外行动按钮的 `princesses_griselda_pod` 保留 generic，并登记原因，避免被误收窄成纯按钮。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "场上来源"`
- 结果：通过，2 passed / 10 skipped。
- 测试断言：
  - 不再维护逐牌 `sourceId` 清单来证明同族交互存在；审计扫描从源码里自动发现使用 `buildFieldSourceTargetOptions(...)` / `buildFieldSourceToBaseTargetOptions(...)` / `buildFieldSourceToMinionTargetOptions(...)` 的交互。
  - 只要选项值出现“稳定来源对象 + 稳定目标对象”的形状，或出现三段字段 `fieldInteractionType/source/target`，就必须统一声明 `targetType: 'field-source-target'`，不能再用 `minion` / `ongoing` / `base` 让 UI 按目标类型反推来源。
  - 必须使用 field source-target 共享入口；`目标基地` 分支统一走 `buildFieldSourceToBaseTargetOptions(...)`，`目标随从` 分支统一走 `buildFieldSourceToMinionTargetOptions(...)`，需要更特殊目标时才下探到 `buildFieldSourceTargetOptions(...)`。
  - 只要选项值出现“稳定场上来源对象本体确认”的形状，或出现 `fieldInteractionType: 'source-action'`，就必须统一声明 `targetType: 'field-source-action'`，不能再把发动来源做成按钮主路径。
  - `field-source-action` 必须使用 `buildFieldSourceActionOptions(...)` 共享入口；当前覆盖侦察兵直接回手、巨蚁 live 来源进入后续目标/数量，以及同类非计分兵蚁 POD 来源选择守卫。
  - 能力/domain 层不得再产出旧 `fieldSourceTargetType`；Board UI 也不再读取旧字段，避免留下第二套来源-目标语义。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：通过，14 passed（2026-08-17 续审复跑）。
- 本轮补充断言：
  - 同一 `sourceId` 不能同时承载多种 `targetType` 语义；一锅豆子、模块化科技、合体超级佐德 POD、音乐会场地和力量城堡等已拆到步骤级或职责正确的来源 ID。
  - `smashup_reaction_choose` 的手牌响应必须保持 `displayMode: 'card'`，让玩家点击手牌本体；场上 `activate_special` 必须使用 `targetType: 'field-source-action'` 和来源本体入口；触发排序项、跳过项才允许保留按钮。
  - 新增 AST 守卫扫描 Smash Up 源码与测试夹具，禁止 `smashup_reaction_choose` 手写夹具继续声明 `targetType: 'button'`，也禁止 `play_action` / `play_minion` 响应牌继续用 `displayMode: 'button'`。
  - `button` targetType 携带对象字段时必须声明 `buttonIntent`，当前允许的通用职责是 `control`、`mode`、`confirm-known-object`、`known-card-action`、`known-card-placement`；守卫按职责判断对象字段是否只能作为已确定上下文，不能再靠 sourceId 白名单放行。
  - 计分窗口中的 `button` 只能承载纯控制、跳过、模式选择、已确定对象确认或已知卡牌处理；按钮选项值和 prompt `continuationContext` 不得无声明携带 `baseIndex`、`minionUid`、`sourceUid`、`targetBaseIndex`、`targetMinionUid`、`ongoingUid`、`targetPlayerId` 等对象字段来代理本体点击。
  - 已保留的计分按钮必须声明通用职责，例如援手选择是否获得 VP 是 `mode`，海怪是否替换基地是 `confirm-known-object`，枢纽选择奖励分支是 `mode`；这些都不能代理场上目标点击。飞天猴已从计分按钮登记中删除，迁入 `field-source-target` 家族。
  - `field-source-target` / `field-source-action` 家族不得再按 sourceId 逐牌登记到 `REQUIRED_SOURCE_CONFIGS`；这类共享交互必须由 option 形状和共享 helper 守卫自动覆盖，避免以后改同一交互类型时逐张牌改白名单。
  - AST 扫描已能识别 `value: moveChoices[choiceIndex]` 这类间接 payload；若按钮值通过数组变量携带 `actionUid/minionUid/fromBaseIndex/toBaseIndex`，也会被判为按钮代理对象目标。
  - AST 扫描已能识别嵌套 `options.push(...)` 和同一 `interaction` 变量后续写入的 `continuationContext`；不再只看 `createSimpleChoice` 直接数组字面量。
  - `button targetType` 携带对象字段时必须二选一：真实目标选择改成对象目标类型，或声明 `buttonIntent` 表示对象已由上一动作唯一确定、当前只是确认/模式/已知卡牌处理。`titan_ignobles_the_hill_that_strolls_choose_player` 已按真实目标玩家选择改为 `targetType: 'player'`；骷髅/泰坦的指示物确认、巨石是否跟随、月零零三放回顶/底等保留为纯确认或已知卡牌处理。
  - 带场上实体上下文的 `generic` 必须能由通用语义解释或声明 `genericIntent`，不得靠 sourceId 白名单；当前 allowed intents 是 `card-pool`、`buried-card`、`snapshot-field-object`、`composite-context`、`mode`、`order`、`mixed-card-and-control`、`definition-choice`。
  - `generic` 治理改为按通用语义放行：有棋盘实体上下文、动态刷新、场上来源目标、按钮与实体混合等会误导 UI 的交互必须进门禁；普通历史弹窗不再用“全部手写理由”的假白名单阻塞当前计分共享目标。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-chain-propagation.test.ts src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts src/games/smashup/__tests__/alien-scout-no-duplicate-scoring.test.ts src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "侦察兵|alien_scout|Alien Scout|Scout"`
- 结果：通过，4 files；12 passed。
- 测试断言：
  - `alien_scout_return` 的 prompt targetType 是 `field-source-action`。
  - 返回手牌分支的 option value 包含 `fieldInteractionType: 'source-action'`、`fieldSourceType: 'minion'`、`sourceUid/minionUid`，不再用“返回手牌”按钮代理主路径。
  - 同一基地多只侦察兵会按触发队列逐个处理，不提前清掉来源基地，不重复计分，不残留旧 prompt。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/giant-ants.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "承受压力|Ant Soldier（POD）|我们乃最强"`
- 结果：通过，3 passed / 29 skipped。
- 测试断言：
  - `giant_ant_under_pressure_choose_source` 的 prompt targetType 是 `field-source-action`，来源选项携带 `fieldInteractionType: 'source-action'` 和 `sourceUid`，点击来源后进入目标随从，再进入数量确认。
  - `giant_ant_we_are_the_champions_choose_snapshot_source` 仍是 `generic`，因为计分后来源可能已离场，只能按快照卡面选择。
  - `giant_ant_soldier_pod_choose_source` 虽不是计分时效果，但属于同一 live 来源选择族；本轮把它也纳入 `field-source-action` 守卫，避免同类入口继续使用普通目标直选。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-rescoring.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "我们乃最强|巨蚁"`
- 结果：通过，2 passed / 9 skipped。
- 测试断言：真实 afterScoring 链里，`giant_ant_we_are_the_champions_choose_source` 输出 `field-source-action` prompt；来源选项携带 `source-action/sourceUid`，提交来源后继续进入目标和数量步骤。

### L2 领域行为证据

- 命令：`node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\ancient-egyptians.test.ts src\games\smashup\__tests__\reactionQueueEventPlayerContext.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "Pharaoh|法老|ancient_egyptians_pharaoh"`
- 结果：通过，2 files；3 passed / 157 skipped。
- 测试断言：
  - 对手计分前的法老触发队列仍把选择权交给法老控制者。
  - 响应队列选择法老触发后，先出现 `targetType: 'field-source-action'` 的 `ancient_egyptians_pharaoh_before_scoring_choose_source`，来源选项携带 `fieldInteractionType: 'source-action'` 与 `minionUid: 'pharaoh-1'`。
  - 点击法老本体后才进入 `ancient_egyptians_pharaoh_before_scoring` 的埋葬牌选择；该窗口声明 `targetType: 'generic'` + `genericIntent: 'buried-card'`，不再用直接 generic 代替来源发动。

- 命令：`node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\abilities\innsmouth.test.ts src\games\smashup\__tests__\afterscoring-response-window-execution.test.ts src\games\smashup\__tests__\reactionQueueSourceRuntimeContext.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "innsmouth_return_to_the_sea|重返深海|Return to the Sea"`
- 结果：通过，3 files；5 passed / 112 skipped。
- 测试断言：
  - `innsmouth_return_to_the_sea` 仍由 afterScoring 响应窗口打出手牌后进入目标随从选择，不被改成场上来源本体发动。
  - 多同名组场景先进入定义/牌名选择，再进入 `targetType: 'minion'` 的同名随从多选回手。
  - 对手计分后的 queued afterScoring 选择权仍归 special 拥有者，响应窗口和后续 prompt 不被错误玩家接管。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/grimms-fairy-tales.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000`
- 结果：通过，18 passed。
- 测试断言：姜饼屋计分前不再把两个随从预组合成按钮；prompt 为 `targetType: 'minion'` 且 `multi: { min: 2, max: 2 }`，合法同基地同力量己方随从由随从本体多选，`不加力量` 才是按钮。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/skeletons.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000`
- 结果：通过，26 passed。
- 测试断言：骷髅挖掘后指示物确认窗口行为不变；本轮只把通用 helper 的 `sourceId` 从 AST 不可见参数改为两个显式 sourceId，方便守卫区分“纯确认按钮”。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts -t "titan_ignobles_the_hill_that_strolls_choose_player" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000`
- 结果：通过，1 passed / 202 skipped。
- 测试断言：移动的山“选择要交出控制权的玩家”prompt 必须是 `targetType: 'player'`；source titan 若在响应前离开基地，不会继续沿旧 prompt 交出随从控制权。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "pirate_king|first_mate|mummy|木乃伊|海盗王|大副"`
- 结果：通过，2 files；10 passed / 30 skipped。
- 测试断言：海盗王、大副、古埃及木乃伊的领域事件能落到移动/埋葬最终状态，并保留来源-目标字段。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/mermaids.test.ts src/games/smashup/__tests__/abilities/skeletons.test.ts src/games/smashup/__tests__/abilities/world-champs.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "shipwreck_cove|gravestones 计分后|对手计分|sheriff|mummy"`
- 结果：通过，3 files；8 passed / 37 skipped。
- 测试断言：警长与警长 POD 输出 `fieldSourceType: 'minion'`、`fieldTargetType: 'minion'`；沉船湾与墓碑输出 `fieldSourceType: 'ongoing'`、`fieldTargetType: 'base'`；三类分支均统一在 `targetType: 'field-source-target'` 下保留来源和目标字段。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueEventPlayerContext.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "Mummy|木乃伊|pirate_first_mate|pirate_king"`
- 结果：通过，3 passed / 150 skipped。
- 测试断言：计分响应队列中的来源玩家和后续上下文不会被错误玩家或错误基地污染。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "titan_mega_troopers_megabot_move|titan_tornados_category_5_move"`
- 结果：通过，2 passed / 201 skipped。
- 测试断言：超级佐德与五级风暴的计分前移动交互都输出 `field-source-target` 结构；来源泰坦若在响应前离开原基地，不应继续沿旧 prompt 移动泰坦。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/titans-owner-context.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "mega_troopers_megabot"`
- 结果：通过，1 passed / 2 skipped。
- 测试断言：超级佐德计分前交互归属给泰坦控制者，不能被错误玩家接管。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/munchkin-clerics.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "垃圾处理|bin_and_gone|Bin and Gone"`
- 结果：通过，1 passed / 13 skipped。
- 测试断言：垃圾处理计分后交互输出 `fieldSourceType: 'ongoing'`、`fieldTargetType: 'minion'`，目标随从移动到持续行动所在基地。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/abilities/titans-owner-context.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "Kraken|克拉肯|titan_pirates_the_kraken_choose_minion"`
- 结果：通过，6 passed / 200 skipped；`titans-owner-context` 文件本次无命中用例而 skipped。
- 测试断言：克拉肯救随从第一段输出 `fieldSourceType: 'titan'`、`fieldTargetType: 'minion'`；选择随从后才进入后续基地选择，不把后续基地当成第一入口。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/diy-killers.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "麦克尔|Michael|michael|diy_killers_michael_myers"`
- 结果：通过，1 passed / 11 skipped。
- 测试断言：麦克尔计分前交互输出 `fieldSourceType: 'minion'`、`fieldTargetType: 'minion'`，只允许同基地合法随从目标；当前只有 L2 行为证据，未写成 L3 截图验证。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueSourceRuntimeContext.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t sharks_megalodon`
- 结果：通过，1 passed / 87 skipped。
- 测试断言：巨齿鲨计分前 prompt 输出 `targetType: 'field-source-target'`；所有消灭选项都携带 `sourceUid: 'mega-0'`，目标随从通过 `targetMinionUid` 指向 `small-1/small-2`，不会把来源 `minionUid` 当成目标。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/sharks.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：通过，21 passed。
- 测试断言：鲨鱼派系普通出牌、天赋、消灭和移动链路仍通过；本轮只改变计分前巨齿鲨的场上来源入口，没有把普通巨齿鲨出牌后的目标选择改成场上来源发动。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --config vitest.config.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：通过，262 passed。
- 测试断言：飞天猴计分后移动宿主并把自身行动送入弃牌堆；跳过时按正常计分清场；borrowed 飞天猴和细胞结合复制飞天猴都把选择权交给当前控制者；handler 拒绝 prompt 后伪造的新随从、行动和目的地。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueSourceRuntimeContext.test.ts --config vitest.config.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "flying_monkey|飞猴|cellular_bonding"`
- 结果：通过，4 passed / 84 skipped。
- 测试断言：计分后排队触发的飞天猴、第二张 borrowed 飞天猴、细胞结合复制飞天猴都保留实例来源和当前控制者；不会回退到同基地第一张来源。
- 扩展说明：同一文件全量运行当前仍有 30 个非飞天猴的旧运行态来源上下文失败，说明“全部计分时效果逐项深审”仍未完成，不能用本轮飞天猴修复冒充全量收口。

### L3 真实入口 E2E 与截图核验

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts -g "复杂链路里海盗王可发动时应先点本体再高亮计分基地"`
- 结果：通过，1 test。
- 真实入口：浏览器页面进入复杂计分链，玩家先选托尔图加计分，再经历海盗王、手牌响应、大副、托尔图加和最终清场替换。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\复杂链路里海盗王可发动时应先点本体再高亮计分基地\complex-hand-response-02-pirate-king-available-source-highlight.jpg`
   - 海盗王本体绿色高亮。
   - 托尔图加和其它基地没有提前进入可选态。
   - 画面只给“不发动”分支，不存在“点按钮直接移动到基地”的主路径。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\复杂链路里海盗王可发动时应先点本体再高亮计分基地\complex-hand-response-03-pirate-king-after-source-click-target-base-highlight.jpg`
   - 海盗王被选中。
   - 目标计分基地托尔图加高亮。
   - 非目标基地变暗，非法点击不会移动海盗王。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\复杂链路里海盗王可发动时应先点本体再高亮计分基地\complex-hand-response-07-first-mate-source-highlight.jpg`
   - 大副本体高亮。
   - 基地未提前可选。
   - 截图中的“该基地不可选择”提示来自 E2E 负向点击，证明未选来源时基地不能提交。

4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\复杂链路里海盗王可发动时应先点本体再高亮计分基地\complex-hand-response-08-first-mate-target-base-highlight.jpg`
   - 大副被选中。
   - 两个其它基地高亮可选。
   - 源基地托尔图加不作为目标。

5. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\复杂链路里海盗王可发动时应先点本体再高亮计分基地\complex-hand-response-10-scoring-chain-complete.jpg`
   - 页面回到出牌阶段，交互条和响应手牌提示已关闭。
   - 记分板正常显示 P1=4、AI 2 号位=3。
   - 大副仍在其它基地，亚军随从已被托尔图加移动到替换基地，说明后续链继续跑完。

- 标准素材补齐：`node scripts/assets/download-from-server.js --game smashup`
  - 结果：失败，服务器返回 HTTP 530；本轮未能证明素材服务器同步链路。
- 命令：`$env:PW_SKIP_ASSET_BOOTSTRAP='true'; node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-world-champs-mummy-bury-other-base.e2e.ts "计分后可以把世界冠军木乃伊埋到其他基地"`
- 结果：通过，1 test。该结果证明本地页面的真实交互、高亮与埋葬落地，不证明素材下载链路。
- 真实入口：浏览器页面进入世界冠军木乃伊 afterScoring 交互，先点击木乃伊本体，再选择其它基地埋葬。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-world-champs-mummy-bury-other-base.e2e\计分后可以把世界冠军木乃伊埋到其他基地\world-champs-mummy-02-source-highlight.jpg`
   - 木乃伊本体绿色高亮。
   - 三座基地都没有提前进入目标选择态。
   - 画面只允许“跳过（不埋葬）”这个否定分支。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-world-champs-mummy-bury-other-base.e2e\计分后可以把世界冠军木乃伊埋到其他基地\world-champs-mummy-03-target-base-highlight.jpg`
   - 木乃伊已被选中。
   - 神秘花园和中央大脑两个目标基地本体均有绿色描边 / 发光，玩家能肉眼看出它们是可点目标。
   - 源基地绿洲丛林变暗，不会作为埋葬目标。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-world-champs-mummy-bury-other-base.e2e\计分后可以把世界冠军木乃伊埋到其他基地\world-champs-mummy-04-final-state.jpg`
   - 页面进入 AI 2 号位出牌阶段，交互关闭。
   - 目标基地神秘花园下方出现埋葬牌背。
   - 弃牌区数量为 1，领域断言同时证明木乃伊不在玩家弃牌堆。

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts -g "警长应在基地计分前发起决斗并摧毁落败随从"`
- 结果：通过，1 test。
- 真实入口：浏览器页面通过正式联机选秀进入世界冠军 + 机器人对局，注入计分局面后由基地计分真实拉起警长 beforeScoring 反应，再从警长本体进入敌方随从目标选择并打开决斗。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-source-highlight-2026-08-17.png`
   - 警长本体绿色高亮，表示“现在可以发动这个来源效果”。
   - 敌方目标随从没有提前高亮，未点击来源前不能直接提交目标。
   - 画面只保留“跳过（不决斗）”否定分支，不存在按钮直接代点随从或代打到目标的主路径。

2. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-target-minion-highlight-2026-08-17.png`
   - 点击警长后，警长显示已选中。
   - 同基地敌方随从变为绿色高亮目标。
   - 基地本体没有成为错误目标，说明 `随从 -> 随从` 分支没有退回旧 `随从 -> 基地` 语义。

3. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-duel-card-prompt-2026-04-26.png`
   - 点击目标随从后进入决斗提示，证明目标随从点击消费的是当前 live 交互选项。

4. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-duel-resolved-2026-04-26.png`
   - 决斗收口后敌方目标随从不在任何基地。
   - `activeDuel` 已清空，说明不是只打开提示，而是决斗链路落到最终权威状态。

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts -g "沉船湾应在基地计分后可移到另一个基地"`
- 结果：通过，1 test。
- 真实入口：复用现成机器人 + 悬浮机器人 E2E 文件，基地计分后拉起沉船湾 afterScoring 交互，先点击沉船湾本体，再选择目标基地。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-shipwreck-cove-source-highlight-2026-08-17.png`
   - 沉船湾牌本体绿色高亮，表示“现在可以发动这张场上持续行动”。
   - 基地没有提前高亮，未点击来源前不能直接提交目标基地。
   - 画面只保留“跳过”否定分支，不存在按钮直接把沉船湾移动到基地的主路径。

2. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-shipwreck-cove-target-base-highlight-2026-08-17.png`
   - 点击沉船湾后，沉船湾本体显示已选中。
   - 合法目标基地绿色高亮，源基地变暗，不会作为移动目标。
   - 目标点击消费的是当前 live 交互选项，而不是 UI 反推基地。

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts -g "墓碑应在基地计分后可把自己埋葬到另一个基地"`
- 结果：通过，1 test。
- 真实入口：复用现成机器人 + 悬浮机器人 E2E 文件，基地计分后拉起墓碑 afterScoring 交互，先点击墓碑本体，再选择目标基地。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-gravestones-source-highlight-2026-08-17.png`
   - 墓碑牌本体绿色高亮，表示“现在可以发动这张场上持续行动”。
   - 基地没有提前高亮，未点击来源前不能直接提交目标基地。
   - 画面只保留“跳过”否定分支，不存在按钮直接把墓碑埋到基地的主路径。

2. `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-gravestones-target-base-highlight-2026-08-17.png`
   - 点击墓碑后，墓碑本体显示已选中。
   - 合法目标基地绿色高亮，源基地变暗，不会作为埋葬目标。
   - 目标点击消费的是当前 live 交互选项，而不是 UI 反推基地。

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-alien-terraform.e2e.ts -g "超级佐德可在另一基地计分前"`
- 结果：通过，1 test。
- 真实入口：复用现成 Alien Terraform / 泰坦 E2E 文件，构造超级佐德已经在基地上的计分前局面；交互出现后先点击超级佐德本体，再点击即将计分的目标基地。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\超级佐德可在另一基地计分前通过交互移动到该基地\megabot-before-scoring-source-highlight.jpg`
   - 超级佐德本体发光高亮，表示“现在可以发动这个泰坦来源效果”。
   - 三座基地都没有提前高亮或进入可选态，未点击来源前不能直接提交目标基地。
   - 画面仍有“留在原地”否定分支，但不存在按钮直接代替“移动到基地”的主路径。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\超级佐德可在另一基地计分前通过交互移动到该基地\megabot-before-scoring-target-base-highlight.jpg`
   - 点击超级佐德后，超级佐德显示已选中。
   - 即将计分的母舰基地绿色高亮；来源所在家园和另一基地变暗，不会作为移动目标。
   - 目标点击消费的是当前 live `field-source-target` 选项，而不是 UI 根据基地名反推。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\超级佐德可在另一基地计分前通过交互移动到该基地\megabot-before-scoring-resolved.jpg`
   - 超级佐德已经移动到母舰基地上方，来源基地战力从 3 降为 2。
   - 页面回到出牌阶段，计分前交互已关闭。
   - 记分板和阶段按钮正常显示，说明不是只点击了 prompt，而是移动后流程继续收口。

- 命令：`npm run test:e2e:file -- e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts -g "牧师垃圾处理"`
- 结果：通过，1 test。
- 真实入口：复用现成 Munchkin 怪物与宝藏 UI E2E 文件，基地计分后拉起垃圾处理 afterScoring 交互；玩家先点击场上的垃圾处理持续行动，再点击另一个基地的己方随从。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\牧师垃圾处理在计分后从真实持续行动入口手动移动另一个基地的随从\牧师-垃圾处理-来源持续行动可发动.jpg`
   - 垃圾处理持续行动本体高亮，表示“现在可以发动这张场上持续行动”。
   - 另一个基地的入侵者随从未提前高亮，未点击来源前不能直接提交目标随从。
   - 画面只保留“不移动”否定分支，不存在按钮直接移动随从的主路径。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\牧师垃圾处理在计分后从真实持续行动入口手动移动另一个基地的随从\牧师-垃圾处理-点击来源后目标随从高亮.jpg`
   - 点击垃圾处理后，垃圾处理显示已选中。
   - 入侵者随从变为绿色高亮目标。
   - 基地本体没有被当成目标，说明 `持续行动 -> 随从` 分支没有退回旧基地选择语义。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\牧师垃圾处理在计分后从真实持续行动入口手动移动另一个基地的随从\牧师-垃圾处理-随从移动到持续行动基地.jpg`
   - 入侵者随从已经移动到垃圾处理所在的家园基地。
   - 右侧原基地不再保留该随从，源区和目标区都能肉眼核对。
   - 页面回到出牌阶段，说明移动后计分链无残留。

- 命令：`npm run test:e2e:file -- e2e/smashup/smashup-alien-terraform.e2e.ts -g "海怪克拉肯计分后可把此处己方随从"`
- 结果：通过，1 test。
- 真实入口：复用现成 Alien Terraform / 泰坦 E2E 文件，构造克拉肯与待救随从位于计分基地；玩家先点击克拉肯泰坦本体，再点击要救的随从，随后进入后续目标基地选择。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆\kraken-rescue-source-titan-highlight.jpg`
   - 克拉肯泰坦本体高亮，表示“现在可以发动这个泰坦来源效果”。
   - 大副随从未提前高亮，未点击泰坦前不能直接提交目标随从。
   - 画面只保留“跳过”否定分支，不存在按钮直接把随从移动到基地的主路径。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆\kraken-rescue-after-source-click-target-minion-highlight.jpg`
   - 点击克拉肯后，泰坦显示已选中。
   - 大副随从变为绿色高亮目标。
   - 基地本体仍不是当前步骤目标，说明第一段是 `泰坦 -> 随从`，不是直接目标基地。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆\kraken-rescue-choose-base.jpg`
   - 选中大副后才进入“选择要移动到的基地”第二段。
   - 母舰和丛林乐园高亮为合法目标基地，原计分基地变暗。
   - 该截图证明后续基地选择仍存在，但它不是来源第一入口。

4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆\kraken-rescue-resolved.jpg`
   - 大副随从已移动到母舰基地。
   - 原计分基地已替换为 436-1337 工厂，说明计分清场和替换仍继续执行。
   - 页面回到出牌阶段，克拉肯已离开计分基地来源位；流程收口且没有残留交互。

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-gameplay.e2e.ts -g "Alien Scout 计分后可选返回手牌"`
- 结果：通过，1 test。
- 真实入口：复用现成核心流程 E2E 文件，构造同一计分基地上两只侦察兵和一只大法师；基地计分后先经过 `smashup_reaction_choose` 触发排序，再进入具体 `alien_scout_return` 交互；玩家点击第一只侦察兵本体回手，第二只选择“留在基地”。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路\legacy-or-alien-scout-source-highlighted.jpg`
   - 侦察兵本体绿色高亮，表示“现在可以发动这只侦察兵的回手效果”。
   - 画面只有“留在基地”按钮；没有“返回手牌”按钮代理主路径。
   - 右侧其它基地没有被当成目标，因为该效果没有第二目标。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路\legacy-or-alien-scout-return-in-hand.jpg`
   - 点击侦察兵本体后，侦察兵卡牌出现在玩家手牌区。
   - 该截图证明“返回手牌”由卡牌本体点击触发，而不是按钮直接完成。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Alien-Scout-计分后可选返回手牌或留在基地，并能走完整返回手牌链路\legacy-or-alien-scout-return-resolved.jpg`
   - 页面回到出牌阶段，当前交互关闭。
   - 大法师按计分结果进入弃牌区，说明计分清场继续执行。
   - 断言同时证明第一只侦察兵在玩家手牌中，且不再留在任何基地。

### 本轮用户开图组

- 图组目录：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-scoring-e2e-open-20260817\`
- 顺序索引：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-scoring-e2e-open-20260817\00-sequence-index.png`
- 07 号修后标注图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-scoring-e2e-open-20260817\07-labeled-world-champs-mummy-03-target-base-highlight.png`
- PASS 清单：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-scoring-e2e-open-20260817\pass-manifest.json`
- 标注源：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-scoring-e2e-open-20260817\label-source-manifest.json`
- 覆盖范围：仅覆盖本文已登记为 L3 / E2E 的 9 条截图链：海盗王/大副复杂链、世界冠军木乃伊、警长、沉船湾、墓碑、超级佐德、垃圾处理、克拉肯、侦察兵。
- 明确不覆盖：法老、六娃、巨蚁、飞天猴、麦克尔、巨齿鲨等当前只有 L2 或代表链证据的对象；这些对象不得因本图组打开而升级为 L3 截图验收。
- 图组生成命令：`python .spec/skills/show-image-to-user/scripts/label-image-sequence.py --manifest test-results/evidence-screenshots/smashup/smashup-scoring-e2e-open-20260817/label-source-manifest.json --out-dir test-results/evidence-screenshots/smashup/smashup-scoring-e2e-open-20260817 --overwrite`
- 开图校验命令：`node scripts/verify/open-verified-image.mjs --pass-manifest <pass-manifest.json> --viewer pureref --dry-run --paths <00-sequence-index.png> <01-labeled-*.png> ... <29-labeled-*.png>`
- 开图结果：`OPENED_WITH_PUREREF=C:\Program Files\PureRef\PureRef.exe`；已按 00-29 顺序一次性打开 30 张编号图。
- 2026-08-18 修后 07 核图：旧 07 标注图被用户指出“目标基地也没亮”；当前重跑后的 07 图面可见神秘花园和中央大脑两个目标基地均有绿色描边，满足“点击来源后目标对象本体必须肉眼可见高亮”的口径。

### 继续审计截图对账

- 对账命令：`node` 脚本解析本文所有原始 E2E 图片路径，并与 `label-source-manifest.json` / `pass-manifest.json` 对比。
- 对账结果：本文登记的原始 E2E 图片路径为 29 张，标注源清单为 29 张，PASS 清单为 30 张（含 1 张顺序索引）；`missingFromSourceManifest=[]`、`extraInSourceManifest=[]`、`nonexistentEvidencePaths=[]`、`nonexistentPassImages=[]`。
- 同主题文档排查：`evidence/smashup` 下存在早期计分 / afterScoring / Titan / 侦察兵等历史 evidence，它们记录的是旧链路、旧目录或其它对象范围；当前用户要求“有端到端的都打开截图”的执行口径以本文“本轮用户开图组”为总账，历史图不会自动升级成当前 PASS 图，也不会阻塞本文 9 条 L3/E2E 图组收口。
- P0 分流复核：本文 P0 非共享族入口清单已逐行分流；侦察兵、法老、巨蚁、巨齿鲨等已进入本轮合同或代表链，鹏鹅冰滑道判为强制自动，Innsmouth / Disco Dancers 判为手牌响应链，细胞结合判为飞天猴共享链复用。剩余的 102 个运行时调用点与 179 个数据定义层计分时机标记仍是 full-audit 范围外，不能据此宣称全牌库逐牌审完。

### L4 治理证据

- 共享根因项：之前容易把“可发动场上来源对象 -> 目标对象 / 来源本体确认”误建成按钮或直接目标选项；当前共享 helper 明确把来源、目标和来源本体确认拆成结构化字段，并用统一 `field-source-target` prompt 类型支持来源随从到目标基地、来源随从到目标随从、来源持续行动/行动到目标基地、来源持续行动到目标随从、来源泰坦到目标基地、来源泰坦到目标随从六个分支，用 `field-source-action` prompt 类型支持来源随从直接执行或确认来源后进入后续步骤。按钮另加通用职责门禁：带对象上下文时必须声明 `buttonIntent`，只能承载纯控制、跳过、模式选择、已确定对象确认或已知卡牌处理，不能携带场上对象目标字段来代理目标点击。
- 非计分同类项：Killer Queen POD 的检索分支是纯按钮，但“给本回合打出的随从和女皇各加 1 个指示物”是场上随从直选；当前 `targetType: 'minion'` 让随从本体承接主路径，检索按钮通过直选模式的 extra option 承接，避免新增一套 `mixed` 交互类型。
- 响应窗口收口项：`smashup_reaction_choose` 当前统一声明 `targetType: 'field-source-action'`，以允许场上可选 special 从来源本体发动；手牌响应仍由手牌区本体承接，非响应手牌置灰，窗口按钮只承载跳过、触发排序和纯控制。
- AI 收口项：自动玩家不是去模拟 UI 两次点击；它消费同一份 live option 清单。`field-source-target` 的每个 option 同时携带稳定来源和稳定目标，因此 AI 选择该 option 就等价于完成“来源 + 目标”这一条规则交互；新增 `ai-interaction-choice-enumeration.test.ts` 用世界冠军木乃伊式选项锁定 `interactionId + optionId` payload 和 `sourceUid/targetBaseIndex` 元数据。
- 命中 D 维度：D1 语义保真、D3 数据流闭环、D5 交互完整、D8 时序正确、D15 UI 状态同步、D34 交互选项渲染模式、D35 交互上下文快照、D36 延迟事件补发、D55 多消费者一致性、D58 可完成性。
- 流程收口证据：九条 E2E 都断言最终交互链不会残留；复杂链回到下一玩家出牌阶段；世界冠军木乃伊链回到 AI 2 号位出牌阶段；警长链进入决斗并清空 `activeDuel`；沉船湾和墓碑链分别从来源本体点击进入目标基地选择并收口；超级佐德链从泰坦本体点击进入目标基地选择，点击基地后移动到计分基地并回到出牌阶段；垃圾处理链从持续行动本体点击进入目标随从选择并移动落地；克拉肯救随从链从泰坦本体点击进入目标随从选择，再进入后续目标基地选择并移动落地；侦察兵链从触发排序进入来源本体高亮，点击侦察兵本体回手，第二只侦察兵走“留在基地”分支，最终回到出牌阶段。
- 同类扩审记录：
  - 根因关键词 / 共享调用点：`buildFieldSourceTargetOptions`、`buildFieldSourceToBaseTargetOptions`、`buildFieldSourceToMinionTargetOptions`、`buildFieldSourceTargetPromptConfig`、`buildFieldSourceActionOptions`、`buildFieldSourceActionPromptConfig`、`targetType: 'field-source-target'`、`targetType: 'field-source-action'`、`fieldInteractionType: 'source-target'`、`fieldInteractionType: 'source-action'`、`fieldSourceTargetInteraction.ts` 的共享 UI 模型、审计测试里的“来源对象 + 目标对象 / 来源对象本体确认”payload 形状扫描、Board 的来源选择、场上卡选择和基地提交读取。
  - 搜索范围：`src/games/smashup/abilities/**`、`src/games/smashup/domain/**`、`src/games/smashup/data/factions/**`、`src/games/smashup/Board.tsx`、Smash Up 相关 Vitest/E2E。
  - 命中项：四个 `随从 -> 基地` 来源-目标对象；三个 `随从 -> 随从` 来源-目标对象；三个 `持续行动/行动 -> 基地` 来源-目标对象；一个 `持续行动 -> 随从` 来源-目标对象；两个 `泰坦 -> 基地` 来源-目标对象；一个 `泰坦 -> 随从` 来源-目标对象；四个计分 `随从来源本体确认` 来源-action 对象；一个同类非计分兵蚁 POD 来源-action 守卫；四个已登记为纯控制/模式选择的计分按钮。
  - 判定不受影响项：自动效果、基地效果、手牌响应、目标手牌、目标玩家、牌库/弃牌堆定义选择，以及本文未列入本族的其它泰坦或场上对象，不复用本 `field source-target` 代表链；若它们属于场上可选发动，应接入通用合同并声明自己的来源/目标类型。
  - 残余扩审范围：102 个运行时调用点、101 个唯一来源表达式，以及数据定义层 179 个计分时机标记若要逐牌证明，需要另建 full-audit 矩阵。

## 修订或失效记录

- 旧文档路径：无需要原地修改的同名专项总账。
- 旧图路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\复杂链路里海盗王触发后应从手牌本体响应并高亮计分基地\_labeled-final-20260816-1945\`
- 旧结论：该旧图组里存在“大副直接选基地”的历史画面。
- 失效原因：它不满足当前交互规范中“可发动来源对象本体先高亮，点击来源后才高亮目标”的职责顺序。
- 替代证据：本文引用的 2026-08-17 新 `.jpg` 截图目录。
- 当前口径：旧图只能作为历史/对照材料，不作为当前正向验收图。

- 旧结论：旧 07 标注图曾被记为“世界冠军木乃伊点击后目标基地高亮 PASS”。
- 失效原因：旧图只明显高亮了木乃伊本体，目标基地本体没有玩家肉眼可见的描边 / 发光；这只能证明内部可选状态或弱提示，不满足当前目标对象高亮门槛。
- 替代证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-world-champs-mummy-bury-other-base.e2e\计分后可以把世界冠军木乃伊埋到其他基地\world-champs-mummy-03-target-base-highlight.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-scoring-e2e-open-20260817\07-labeled-world-champs-mummy-03-target-base-highlight.png`
- 新结论：当前重跑图达标；但因标准素材补齐入口返回 HTTP 530，本条只证明本地页面交互与目标基地高亮，不证明素材服务器同步链路。

## 禁止假阳性检查

- 没有把“按钮能点”当成交互正确；关键截图证明来源本体和目标对象分步出现。
- 没有把“按钮存在”扩大成合法主路径；计分按钮只有在选项值不携带场上对象目标字段、且已登记为纯控制/跳过/模式选择时才允许保留。
- 没有把“prompt 出现”当成最终状态；E2E 断言最终阶段推进、交互清空、响应窗口清空。
- 没有把十四个来源-目标 sourceId 加五个计分来源本体确认 sourceId 外推为所有计分时效果；本文明确保留全牌库逐牌深审为当前范围外。
- 没有用旧标注图替代当前截图；旧 2026-08-16 图组已降级。

## 共享根因与残余范围

- 共享根因项：来源和目标职责曾容易混在同一按钮/目标选项里，来源本体确认也曾容易被做成按钮主路径或普通目标直选，导致玩家看不懂“是谁发动、接下来选什么”。当前共享合同把来源对象、目标对象和来源本体确认拆开；直选模式的操作按钮分流也统一到 `interactionMode.ts`，避免每个目标类型各自维护一套“跳过 / 完成 / 取消”过滤。
- 已一并检查项：field source-target 共享 helper、field-source-action 共享 helper、三段字段、疑似手拼来源/目标 payload 形状、疑似来源本体确认 payload 形状、Board 消费路径、AI 合法动作枚举路径、直选模式 extra option 共享 helper、复杂链 E2E、世界冠军木乃伊 E2E、警长 E2E、沉船湾 E2E、墓碑 E2E、超级佐德 E2E、垃圾处理 E2E、克拉肯救随从 E2E、侦察兵 E2E、侦察兵领域测试、法老来源本体确认与埋葬牌选择行为测试、六娃完整管线行为测试、巨蚁 live 来源行为测试、兵蚁 POD 同类守卫、飞天猴领域与队列运行态测试、麦克尔定向行为测试、巨齿鲨队列运行态测试、姜饼屋随从本体多选测试、移动的山玩家目标类型 smoke、骷髅指示物确认窗口测试。
- 本轮新增守卫：`smashup_reaction_choose` 的手写夹具不得回退成按钮窗口；响应手牌不得回退成按钮模式；旧 `activate_special:minion/titan` 字符串只允许存在于禁用断言中；`field-source-target` / `field-source-action` 共享族不得再按单个 sourceId 加回逐牌白名单，必须由共享类型守卫统一覆盖；AI 必须能枚举携带来源和目标字段的 `field-source-target` live option；`button` targetType 不得在选项 value 或 prompt `continuationContext` 中无职责声明地携带随从、基地、持续行动、泰坦等场上对象字段来代理本体直选；按钮若只是已唯一确定对象后的确认、模式选择或已知卡牌处理，必须声明通用 `buttonIntent`，不能靠 sourceId 例外；真实目标玩家选择必须改成 `targetType: 'player'`，不能靠按钮例外放过；`generic` targetType 不得再按 sourceId 建白名单，高风险对象字段必须由 `genericIntent` 或 option 形状推导解释；Board 源码约束测试要求所有直选模式额外按钮统一调用 `getSmashUpDirectPromptExtraOptions(...)`。
- 当前范围外：
  - 全部 102 个运行时计分调用点逐项 L2/L3/L4 深审。
  - 数据定义层 179 个计分时机标记对应的牌 / 场上 special 逐牌 L2/L3/L4 深审。
  - 除沉船湾/墓碑/飞天猴/垃圾处理外，其它持续行动或行动来源若目标、时机或结算链不同，仍需逐牌判等。
  - 目标不是基地或随从的计分效果是否需要自己的来源-目标合同。
  - 除超级佐德/五级风暴/克拉肯第一段外，其它泰坦、基地、手牌、玩家、牌库等其它来源或目标类型的交互第一入口。
  - 全游戏所有低风险历史 `generic` 弹窗逐项语义深审仍是更宽的交互治理范围；当前只证明高风险 generic 门禁、同一 sourceId 语义门禁和场上来源目标门禁已通过。
- 下一步：若继续做“全部计分时效果”深审，以本文 102 个运行时调用点清单为起点，再按自动/来源随从/来源基地/来源持续或行动/来源泰坦/手牌响应/目标玩家或手牌等类别逐项推进。

## Evidence 自检

- 命令：`npm run audit:evidence:selfcheck -- evidence/smashup/smashup-scoring-source-target-interaction-audit-2026-08-17.md`
- 结果：通过，checked files: 1; audit docs: 1; OK。

## 对外汇报口径

- 可以说：本轮已经把“场上来源对象到目标对象”和“场上来源本体确认”的计分可发动效果收敛到共享合同；当前十四个来源-目标 sourceId 覆盖 `随从 -> 基地`、`随从 -> 随从`、`持续行动/行动 -> 基地`、`持续行动 -> 随从`、`泰坦 -> 基地`、`泰坦 -> 随从` 六个来源-目标分支，其中垃圾处理和克拉肯已用现成复杂 E2E 补了来源先点、目标后亮和最终落地截图；另有侦察兵 `alien_scout_return` 覆盖 `随从来源确认 -> 直接回手` 分支，法老 `ancient_egyptians_pharaoh_before_scoring_choose_source` 覆盖 `随从来源确认 -> 后续埋葬牌选择` 分支，六娃 `huluwawa_liu_wa_before_scoring` 覆盖 `随从来源确认 -> 直接执行自身效果` 分支，巨蚁 `under_pressure` / `we_are_the_champions` 覆盖 `随从来源确认 -> 后续目标/数量` 分支。
- 可以说：麦克尔已完成 L1/L2 结构与行为验证，但还不能说它已有 L3 截图验收。
- 可以说：全部计分时效果都值得进对象全集审查，但必须先职责分流，不是全部都改成点来源。
- 可以说：Killer Queen POD 已作为非计分同类按钮代理问题同步治理；它不计入计分时效果逐牌审计完成数。
- 不能说：全牌库所有计分时效果逐牌行为已经完成。
- 不能说：强制自动效果也要玩家点来源。
