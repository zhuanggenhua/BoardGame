# Smash Up 计分时场上来源到目标交互专项

## 基本信息

- 对象：Smash Up 计分窗口中“场上来源对象 -> 目标对象”和“场上来源对象自身可选执行”的可发动效果交互族；当前 UI 已消费 `随从 -> 基地`、`随从 -> 随从`、`持续行动/行动 -> 基地`、`持续行动 -> 随从`、`泰坦 -> 基地`、`泰坦 -> 随从`、`随从 -> 自身执行` 七个分支
- 日期：2026-08-17
- 文档类型：audit
- 结论等级：代表性玩法已验证
- 主目标：回答“计分时效果是否都要审计”，并把本轮已经验证的共享交互族、全量 L1 清单和仍需逐牌深审的计分效果分开。

## 审计范围

### 本轮覆盖

- 共享交互合同：`buildFieldSourceTargetOptions(...)` + `buildFieldSourceTargetPromptConfig(...)`
- 场上来源自身执行合同：`buildFieldSourceActionOptions(...)` + `buildFieldSourceActionPromptConfig(...)`
- 目标基地包装入口：`buildFieldSourceToBaseTargetOptions(...)`
- 目标随从包装入口：`buildFieldSourceToMinionTargetOptions(...)`
- UI 消费链：
  - 来源-目标：来源对象本体高亮 -> 点击来源 -> 目标对象高亮 -> 点击目标提交；当前 Board 支持 `source=minion,target=base`、`source=minion,target=minion`、`source=ongoing/action,target=base`、`source=ongoing,target=minion`、`source=titan,target=base` 与 `source=titan,target=minion`
  - 来源自身执行：来源对象本体高亮 -> 点击来源直接提交；跳过 / 不发动 / 留在基地仍用按钮承载；当前代表对象为 `alien_scout_return`
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
  - `munchkin_clerics_bin_and_gone_minion`
  - `titan_mega_troopers_megabot_move`
  - `titan_tornados_category_5_move`
  - `titan_pirates_the_kraken_choose_minion`
  - `alien_scout_return`

### 本轮不覆盖

- 不把所有 `beforeScoring` / `whenScoring` / `afterScoring` 触发都改成“先点来源”。本轮最新 AST 扫描登记到 102 个计分时运行时调用点、101 个唯一来源表达式，其中 `afterScoring` 69 个、`beforeScoring` 30 个、`whenScoring` 3 个；它们包含强制自动效果、基地效果、手牌响应、持续行动、泰坦、目标随从、目标手牌和纯确认分支，职责不同。
- 不声明全牌库计分时效果已经逐牌深审完成。本轮只更新 L1 清单快照：运行时 102 个调用点 / 101 个唯一来源表达式，数据定义层文本级扫描至少 179 个计分时机标记 / 166 个最近 id；全量深审仍需要逐项拆规则子句、入口、目标、最终状态和证据层级。

### 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞本轮结论 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| 四个 `随从 -> 基地` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 本文证据 + 对应 E2E |
| 两个 `随从 -> 随从` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 警长 E2E + 世界冠军行为测试；麦克尔定向行为测试 |
| 三个 `持续行动/行动 -> 基地` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 沉船湾/墓碑领域测试与现成 E2E 截图链 + 飞天猴领域/队列测试 |
| 一个 `持续行动 -> 随从` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 垃圾处理定向行为测试 + 现成 Munchkin E2E 链 |
| 两个 `泰坦 -> 基地` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 超级佐德 E2E + 泰坦 smoke / owner context |
| 一个 `泰坦 -> 随从` 来源-目标效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 克拉肯救随从第一段 E2E；第二段目标基地选择单独收口 |
| 一个 `随从 -> 自身执行` 场上来源效果 | 当前范围验证 | 否 | 否 | 当前范围内 | 侦察兵现成复杂 E2E 链 |
| 102 个计分时运行时调用点 / 101 个唯一来源表达式 L1 清单 | 当前范围验证 | 否 | 否 | 当前范围内 | 本文“计分时效果全量审计裁定” |
| 179 个数据定义层计分时机标记 / 166 个最近 id L1 清单 | 当前范围验证 | 否 | 否 | 当前范围内 | 本文“计分时效果全量审计裁定” |
| 计分窗口 `button` targetType 的职责门禁 | 当前范围验证 | 否 | 否 | 当前范围内 | `interactionTargetTypeAudit.test.ts` |
| 全部 102 个计分时运行时调用点逐项深审 | 当前范围验证缺口 | 否 | 是，若要使用“全部计分时效果已审完”口径 | 当前范围外 | 另建 full-audit 对象矩阵 |
| 数据定义层计分时机牌/场上 special 逐牌深审 | 当前范围验证缺口 | 否 | 是，若要使用“全部计分时效果的牌已审完”口径 | 当前范围外 | 另建 full-audit 对象矩阵 |
| 其它计分效果是否需要改交互第一入口 | 当前范围外 | 未判断 | 不阻塞本族 | 先按职责分流 | 逐牌审查时进入交互入口语义矩阵 |
| 旧 2026-08-16 标注图中“大副直接选基地”的历史画面 | 审计留档缺口 | 否 | 否，本文已降级 | 历史证据，不作当前正向图 | 当前以 2026-08-17 新截图目录为准 |

## 结论等级

代表性玩法已验证。

判定理由：

- 本轮共享族分两类：一类规则动作是“场上来源对象本体可发动，再选择目标对象”；另一类规则动作是“场上来源对象本体可发动，但没有第二目标，点击来源本体即执行”。来源可以是随从、持续行动/行动或泰坦；目标可以是基地，也可以是另一张随从；第一入口仍应是来源对象本体，不是目标对象，也不是提示区按钮。
- 当前实现把十三个 sourceId 统一到 `targetType: 'field-source-target'`，并通过 `buildFieldSourceTargetOptions(...)` / `buildFieldSourceToBaseTargetOptions(...)` / `buildFieldSourceToMinionTargetOptions(...)` 输出同一条来源-目标合同；`随从 -> 基地` 包装继续显式输出 `fieldInteractionType: 'source-target'`、`fieldSourceType: 'minion'`、`fieldTargetType: 'base'`，警长和麦克尔分支输出 `fieldSourceType: 'minion'`、`fieldTargetType: 'minion'` 与 `targetMinionUid`，沉船湾/墓碑/飞天猴分支输出 `fieldSourceType: 'ongoing'` 或 `fieldSourceType: 'action'` 与 `fieldTargetType: 'base'`，垃圾处理分支输出 `fieldSourceType: 'ongoing'` 与 `fieldTargetType: 'minion'`，超级佐德/五级风暴分支输出 `fieldSourceType: 'titan'` 与 `fieldTargetType: 'base'`，克拉肯救随从第一段输出 `fieldSourceType: 'titan'` 与 `fieldTargetType: 'minion'`。
- 侦察兵 `alien_scout_return` 统一到 `targetType: 'field-source-action'`，并通过 `buildFieldSourceActionOptions(...)` 输出 `fieldInteractionType: 'source-action'`、`fieldSourceType: 'minion'`、`sourceUid/minionUid`。该效果没有第二目标，因此点击侦察兵本体即代表“发动返回手牌”；“留在基地”仍是按钮。
- `src/games/smashup/ui/fieldSourceTargetInteraction.ts` 统一解析这两套选项值并生成来源高亮、目标高亮和提交映射；Board 只在 prompt 声明 `field-source-target` 或 `field-source-action` 时消费对应模型。未点击来源前只高亮来源对象；来源-目标类点击来源后才把合法目标基地或目标随从转成可选；来源自身执行类点击来源直接提交当前 live prompt option。
- 复杂链路 E2E 覆盖海盗王、大副、手牌响应、托尔图加后续移动和最终无残留；单独 E2E 覆盖世界冠军木乃伊从来源点击到埋葬落地；警长 E2E 覆盖来源随从到目标随从再进入决斗；沉船湾/墓碑复用现成 E2E 文件覆盖持续行动来源本体高亮、点击来源后目标基地高亮；超级佐德复用现成泰坦 E2E 文件覆盖泰坦来源本体高亮、点击泰坦后目标基地高亮、点击基地后移动落地；垃圾处理和克拉肯复用现成复杂 E2E 文件补上 `持续行动 -> 随从` 与 `泰坦 -> 随从` 的来源先点、目标后亮链路；侦察兵复用现成核心流程 E2E 文件补上“触发排序 -> 侦察兵本体高亮 -> 点击本体回手 -> 第二只留在基地 -> 无残留”链路。
- 仍有残余范围：全牌库所有计分时效果的逐牌行为深审没有在本文完成，不能用十三个来源-目标 sourceId 加一个来源自身执行 sourceId 外推其它职责不同的效果。

## 权威来源

- 项目交互规范：`.spec/knowledge/standards/rule-driven-interaction-design.md`
  - 卡牌型响应窗口：响应窗口只开放时机和跳过；手牌本体是打出响应牌的第一入口。
  - 场上可发动效果：可选 / 主动发动效果第一入口是来源对象本体；强制自动效果不需要玩家点来源。
- 当前实现入口：
  - `src/games/smashup/domain/abilityHelpers.ts`
  - `src/games/smashup/Board.tsx`
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
| `cyborg_apes_flying_monkey_move` | C1 计分后飞天猴可把宿主随从移动到另一基地并摧毁自身；C2 可跳过 | 飞天猴附着行动本体 | `sourceUid/cardUid/ongoingUid/actionUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 非源基地 | 可选，有跳过 | `sourceUid/cardUid/ongoingUid/sourceBaseIndex/baseDefId/minionUid/actionUid`，resolver 用 prompt 时快照拒绝伪造新目标 | L1/L2 | 领域与队列测试通过；L3 仍待补端到端截图 |
| `diy_killers_michael_myers` | C1 计分前麦克尔可摧毁同基地一个印刷力量不高于 3 的目标随从；C2 可跳过 | 麦克尔本体 | `sourceUid/minionUid` -> `targetMinionUid` -> `respondCurrentPrompt` | 同基地合法随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/targetMinionDefId` | L1/L2 | 定向行为测试覆盖；L3 仍待补端到端截图 |
| `munchkin_clerics_bin_and_gone_minion` | C1 计分后垃圾处理可把另一个基地的己方随从移动到这张持续行动所在基地；C2 可跳过 | 垃圾处理本体 | `sourceUid/ongoingUid` -> `targetMinionUid` -> `respondCurrentPrompt` | 其它基地己方随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/targetMinionDefId` | L1/L2/L3 | 通过现成 Munchkin E2E 复验 |
| `titan_mega_troopers_megabot_move` | C1 计分前超级佐德可移动到即将计分基地；C2 可留在原地 | 超级佐德泰坦本体 | `sourceUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 当前计分基地 | 可选，有留在原地 | `sourceUid/sourceBaseIndex/fromBaseIndex/scoringBaseDefId`，resolver 用 live 泰坦位置复核 | L1/L2/L3/L4 | 通过现成 E2E 复验 |
| `titan_tornados_category_5_move` | C1 计分前五级风暴可移动到即将计分基地；C2 可留在原地 | 五级风暴泰坦本体 | `sourceUid` -> `targetBaseIndex/baseIndex` -> `respondCurrentPrompt` | 当前计分基地 | 可选，有留在原地 | `sourceUid/sourceBaseIndex/fromBaseIndex/scoringBaseDefId`，resolver 用 live 泰坦位置复核 | L1/L2 | 结构与领域验证；L3 由同构超级佐德代表链覆盖 |
| `titan_pirates_the_kraken_choose_minion` | C1 计分后克拉肯可选择此处己方随从救走；C2 选择随从后再选择目标基地；C3 可跳过 | 克拉肯泰坦本体 | `sourceUid` -> `targetMinionUid` -> 后续 `titan_pirates_the_kraken_choose_base` | 同基地己方随从 | 可选，有跳过 | `sourceUid/sourceBaseIndex/targetMinionUid/targetMinionDefId`，后续步骤携带已选随从 | L1/L2/L3 | 第一段通过现成泰坦 E2E 复验；第二段仍是后续目标基地选择 |
| `alien_scout_return` | C1 计分后侦察兵可返回拥有者手牌；C2 玩家可留在基地 | 侦察兵本体 | `sourceUid/minionUid` -> `respondCurrentPrompt` | 来源侦察兵自身 | 可选，有“留在基地” | `sourceUid/sourceBaseIndex/minionDefId`，触发排序阶段用 `sourceCardUid` 精确选实例 | L1/L2/L3/L4 | 通过现成复杂 E2E 复验 |

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
| 飞天猴 / 细胞结合复制飞天猴 | 计分后可把宿主随从移到另一基地，然后本行动进弃牌堆 | `cyborg_apes_flying_monkey` / `shapeshifters_cellular_bonding` 注册 `afterScoring` | 飞天猴或复制飞天猴的附着行动本体先亮，其它基地后亮 | `buildValidatedMoveEvents(...)` + `detachOngoing(...)` | 跳过时按正常计分清场；prompt 后新增随从/行动/目的地不得伪造成候选 | 移动宿主并把行动送入真实拥有者弃牌堆 | L1-L2 | 已从计分按钮迁入共享来源-目标合同 |
| 麦克尔 | 计分前可摧毁同基地一个印刷力量不高于 3 的随从 | `diy_killers_michael_myers` 注册 `beforeScoring` | 麦克尔本体先亮，合法目标随从后亮 | `MINION_DESTROYED` / 保护过滤链 | 跳过；不满足目标条件的随从不可成为目标 | 目标随从进弃牌堆，交互关闭后计分继续 | L1-L2 | `随从 -> 随从` 已接共享合同；缺 L3 截图 |
| 垃圾处理 | 计分后可把其它基地己方随从移动到这张持续行动所在基地 | `munchkin_clerics_bin_and_gone` 注册 `afterScoring` | 垃圾处理本体先亮，合法目标随从后亮 | `MINION_MOVED` | 跳过；未点来源前目标随从不可提交；目标必须仍是合法己方随从 | 目标随从移动到来源基地，交互关闭 | L1-L3 | `持续行动 -> 随从` 代表通过 |
| 超级佐德 | 计分前可移动此泰坦到即将计分基地 | `mega_troopers_megabot` 注册 `beforeScoring` | 泰坦本体先亮，目标基地后亮 | `moveTitan(...)` | 留在原地；未选来源时基地不可提交；来源泰坦离开原基地则拒绝旧 prompt | 交互关闭，泰坦进入计分基地，回到出牌阶段 | L1-L4 | `泰坦 -> 基地` 代表通过 |
| 五级风暴 | 计分前可移动此泰坦到即将计分基地 | `tornados_category_5` 注册 `beforeScoring` | 泰坦本体先亮，目标基地后亮 | `moveTitan(...)` | 留在原地；来源泰坦离开原基地则拒绝旧 prompt | 领域测试覆盖泰坦移动和 stale prompt 拒绝 | L1-L2 | 同构入口已纳入静态门禁 |
| 克拉肯救随从第一段 | 计分后可选择此处己方随从并让其改去其它基地 | `pirates_the_kraken` 注册 `afterScoring` | 克拉肯泰坦本体先亮，己方随从后亮 | 第一段记录已选随从，第二段选择目标基地后移动 | 跳过；未点泰坦前目标随从不可提交；第二段基地选择不得被当成来源第一入口 | 随从从计分清场里救出并移动到目标基地，旧基地继续替换 | L1-L3 | `泰坦 -> 随从` 第一段通过；后续目标基地选择保留独立步骤 |
| 侦察兵 | 计分后可将此侦察兵返回手牌 | `alien_scout` 注册 `afterScoring` | 侦察兵本体先亮；没有第二目标 | `buildValidatedReturnEvents(...)` | 留在基地；不再保留“返回手牌”按钮代理主路径 | 返回手牌后，同一计分链继续处理下一只侦察兵或后续触发，最终交互关闭 | L1-L4 | `随从 -> 自身执行` 代表通过 |

## 同类分流

| 计分时效果类型 | 例子 | 应用交互原则 | 本轮裁定 |
| --- | --- | --- | --- |
| 强制自动效果 | `vampire_buffet`、`base_no_moon`、`base_unicrave` | 自动结算；只有规则要求选择目标/顺序时才开对应选择 | 不应要求点来源 |
| 来源随从 -> 自身执行 | `alien_scout_return` | 来源本体先亮；点击来源本体直接执行；跳过 / 留在基地用按钮 | 本轮复用现成复杂 E2E 验证 |
| 手牌响应 | 忍者 / afterScoring 响应手牌 | 响应窗口只开放时机和跳过；合法手牌高亮，非响应手牌置灰；点手牌后再点目标 | 已在复杂链中验证 |
| 来源随从 -> 目标基地 | 本文四个对象 | 来源本体先亮；点来源后高亮合法基地 | 本轮重点验证 |
| 来源随从 -> 目标随从 | `world_champs_sheriff_before_scoring`、`diy_killers_michael_myers` | 来源本体先亮；点来源后高亮合法目标随从 | 警长已有 L3；麦克尔已有 L2，L3 待补 |
| 来源持续/行动 -> 目标基地 | `skeletons_gravestones_after_scoring`、`mermaids_shipwreck_cove_after_scoring`、`cyborg_apes_flying_monkey_move` | 来源本体先亮；点来源持续行动/行动后高亮合法基地 | 本轮已纳入代表验证；飞天猴已有 L2，L3 截图待补 |
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
| generic 复合选择 | 5 | 选择对象携带复合上下文，例如埋葬牌、牌名或牌堆快照 | P0 深审；确认不是用 generic 掩盖本体可点对象 |
| 手牌 / 卡牌选择或响应链 | 4 | 响应窗口、牌库/手牌卡面或额外打出链 | P0 深审；按“手牌本体第一入口”规范核对 |
| 纯按钮 / 模式或需确认 | 3 | 当前看起来是确认、跳过、是否替换或奖励分支 | P0 深审；按钮不得携带对象目标，也不得代替来源发动 |

P0 非共享族入口清单如下。这里的“P0”表示最先审，不表示已经判定为 bug：

| sourceId | 当前粗判 | 需要审的现实问题 |
| --- | --- | --- |
| `alien_scout` / `alien_scout_return` | 已从 P0 待审提升为本轮代表链 | 已迁入 `field-source-action`：侦察兵本体高亮，点击本体回手；“留在基地”按钮保留；已补无残留和跳过分支 E2E |
| `ancient_egyptians_pharaoh` / `ancient_egyptians_pharaoh_before_scoring` | 计分前翻开埋葬牌 | 源随从“法老”和目标埋葬牌是否被 UI 混成 generic；埋葬牌快照和 live 重验是否一致 |
| `giant_ant_we_are_the_champions` | 计分后从一个随从转出力量指示物，再选接收随从和数量 | 第一入口是转出来源随从，后续目标和数量是第二/第三步；需要审 source/target 上下文和计分清场后快照 |
| `innsmouth_return_to_the_sea` | 计分后选择同名随从回手 | 先选牌名再选随从的链路是否符合原文；多选、空选、同名分组和回手归属需逐项核对 |
| `penguins_ice_slide` | 计分后持续效果移动链 | 是否是自动触发还是玩家可选发动；如果玩家选择来源/目标，需审入口顺序和后续基地选择 |
| `sharks_megalodon` / `sharks_megalodon_before_scoring` | 计分前巨齿鲨可消灭低力量随从 | 源随从巨齿鲨是否应先点本体；目标随从直点是否被按钮或普通 minion 目标语义误代 |
| `shapeshifters_cellular_bonding` | 细胞结合复制飞天猴 afterScoring | 已纳入飞天猴共享族行为测试，但还需要单独证明复制来源、附着行动归属和弃牌去向 |
| `disco_dancers_i_will_survive` | 计分后把己方随从回手 | 这是目标随从直选还是来源行动先点；需要审 afterScoring special 消耗、目标集合和回手终点 |

后续深审最低动作：每个 P0 行都必须拆成“规则子句 -> 第一入口 -> 命令/执行 -> 最终权威状态 -> 跳过/否定路径 -> 后续清理”，至少达到 L2；凡玩家真实入口可见，再补 L3 E2E 或可复查截图链。

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
- 结果：通过，11 tests。
- 测试断言：
  - 响应手牌不能由窗口按钮代点，Board 中不应出现 `respondCurrentPrompt({ optionId: reactionOption.id })` 这类直接代理路径。
  - 场上可发动来源-目标效果必须读取 `fieldInteractionType/source-target` 三段合同。
  - 场上来源对象自身可选执行必须读取 `fieldInteractionType/source-action`，并声明 `targetType: 'field-source-action'`。
  - `fieldSourceTargetInteraction.ts` 统一生成来源高亮、目标高亮和 optionId 映射；Board 只在当前 prompt 声明 `targetType: 'field-source-target'` 或 `targetType: 'field-source-action'` 时进入对应消费链。
  - 来源对象可以是随从、持续行动、行动或泰坦；Board 必须把合法持续行动来源传给场上卡本体高亮，把合法泰坦来源传给泰坦本体高亮，而不是只支持随从。
  - 只有选中来源后，合法目标基地或目标随从才进入可提交状态。
  - Board 不得再读取旧 `fieldSourceTargetType` 兼容字段；UI 只能消费 `fieldInteractionType/source-target` + `fieldSourceType` + `fieldTargetType` 三段合同。
  - 共享模型行为测试覆盖 `随从 -> 基地`、`持续行动 -> 随从`、`泰坦 -> 随从` 和 `随从 -> 自身执行`：来源-目标类打开窗口时只给来源集合，点击来源后才给目标集合和提交 optionId；来源自身执行类打开窗口时给来源集合，点击来源直接提交 optionId。
  - `smashup_reaction_choose` 的手牌响应选项统一由 `reactionChoiceInteraction.ts` 解析；Board 不再本地定义 `ReactionChoicePromptOptionValue` / `isReactionHandPlayValue` / `getReactionChoiceBaseIndex` / `getReactionChoiceTargetMinionUid`，AI 也不再保留自己的 `SmashUpReactionChoiceValue` 解析。

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
  - 只要选项值出现“稳定场上来源对象自身执行”的形状，或出现 `fieldInteractionType: 'source-action'`，就必须统一声明 `targetType: 'field-source-action'`，不能再把发动来源做成按钮主路径。
  - `field-source-action` 必须使用 `buildFieldSourceActionOptions(...)` 共享入口；侦察兵 `alien_scout_return` 是当前代表链。
  - 能力/domain 层不得再产出旧 `fieldSourceTargetType`；Board UI 也不再读取旧字段，避免留下第二套来源-目标语义。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：通过，12 passed。
- 本轮补充断言：
  - 同一 `sourceId` 不能同时承载多种 `targetType` 语义；一锅豆子、模块化科技、合体超级佐德 POD、音乐会场地和力量城堡等已拆到步骤级或职责正确的来源 ID。
  - `smashup_reaction_choose` 的手牌响应必须保持 `displayMode: 'card'`，让玩家点击手牌本体；触发项、跳过项和当前仍待后续治理的场上 special 保持按钮/辅助入口，不能伪装成手牌。
  - 计分窗口中的 `button` 只能承载纯控制、跳过或模式选择；按钮选项值不得携带 `baseIndex`、`minionUid`、`sourceUid`、`targetBaseIndex`、`targetMinionUid`、`cardUid`、`ongoingUid` 等场上对象目标字段。
  - 已保留的计分按钮必须逐项登记现实理由，例如援手选择是否获得 VP、海怪是否替换基地、联结点选择基地弃牌堆定义；这些都不能代理场上目标点击。飞天猴已从计分按钮登记中删除，迁入 `field-source-target` 家族。
  - AST 扫描已能识别 `value: moveChoices[choiceIndex]` 这类间接 payload；若按钮值通过数组变量携带 `actionUid/minionUid/fromBaseIndex/toBaseIndex`，也会被判为按钮代理对象目标。
  - 带场上实体上下文的 `generic` 交互必须登记现实理由；`mythic_horses_teaching_power_order`、`polynesian_voyagers_growth_of_the_tribes`、`base_brood_hive` 已明确不是纯场上实体直点。
  - `generic` 治理改为高风险登记：有棋盘实体上下文、动态刷新、场上来源目标、按钮与实体混合等会误导 UI 的交互必须进门禁；普通历史弹窗不再用“全部手写理由”的假白名单阻塞当前计分共享目标。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-chain-propagation.test.ts src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts src/games/smashup/__tests__/alien-scout-no-duplicate-scoring.test.ts src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "侦察兵|alien_scout|Alien Scout|Scout"`
- 结果：通过，4 files；12 passed。
- 测试断言：
  - `alien_scout_return` 的 prompt targetType 是 `field-source-action`。
  - 返回手牌分支的 option value 包含 `fieldInteractionType: 'source-action'`、`fieldSourceType: 'minion'`、`sourceUid/minionUid`，不再用“返回手牌”按钮代理主路径。
  - 同一基地多只侦察兵会按触发队列逐个处理，不提前清掉来源基地，不重复计分，不残留旧 prompt。

### L2 领域行为证据

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

- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-world-champs-mummy-bury-other-base.e2e.ts`
- 结果：通过，1 test。
- 真实入口：浏览器页面进入世界冠军木乃伊 afterScoring 交互，先点击木乃伊本体，再选择其它基地埋葬。

关键截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-world-champs-mummy-bury-other-base.e2e\计分后可以把世界冠军木乃伊埋到其他基地\world-champs-mummy-02-source-highlight.jpg`
   - 木乃伊本体绿色高亮。
   - 三座基地都没有提前进入目标选择态。
   - 画面只允许“跳过（不埋葬）”这个否定分支。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-world-champs-mummy-bury-other-base.e2e\计分后可以把世界冠军木乃伊埋到其他基地\world-champs-mummy-03-target-base-highlight.jpg`
   - 木乃伊已被选中。
   - 其它两个基地高亮可选。
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

### L4 治理证据

- 共享根因项：之前容易把“可发动场上来源对象 -> 目标对象 / 自身执行”误建成按钮或直接目标选项；当前共享 helper 明确把来源、目标和自身执行拆成结构化字段，并用统一 `field-source-target` prompt 类型支持来源随从到目标基地、来源随从到目标随从、来源持续行动/行动到目标基地、来源持续行动到目标随从、来源泰坦到目标基地、来源泰坦到目标随从六个分支，用 `field-source-action` prompt 类型支持来源随从自身执行。计分窗口的按钮另加门禁：只能承载纯控制、跳过或模式选择，不能携带场上对象目标字段来代理目标点击。
- 命中 D 维度：D1 语义保真、D3 数据流闭环、D5 交互完整、D8 时序正确、D15 UI 状态同步、D34 交互选项渲染模式、D35 交互上下文快照、D36 延迟事件补发、D55 多消费者一致性、D58 可完成性。
- 流程收口证据：九条 E2E 都断言最终交互链不会残留；复杂链回到下一玩家出牌阶段；世界冠军木乃伊链回到 AI 2 号位出牌阶段；警长链进入决斗并清空 `activeDuel`；沉船湾和墓碑链分别从来源本体点击进入目标基地选择并收口；超级佐德链从泰坦本体点击进入目标基地选择，点击基地后移动到计分基地并回到出牌阶段；垃圾处理链从持续行动本体点击进入目标随从选择并移动落地；克拉肯救随从链从泰坦本体点击进入目标随从选择，再进入后续目标基地选择并移动落地；侦察兵链从触发排序进入来源本体高亮，点击侦察兵本体回手，第二只侦察兵走“留在基地”分支，最终回到出牌阶段。
- 同类扩审记录：
  - 根因关键词 / 共享调用点：`buildFieldSourceTargetOptions`、`buildFieldSourceToBaseTargetOptions`、`buildFieldSourceToMinionTargetOptions`、`buildFieldSourceTargetPromptConfig`、`buildFieldSourceActionOptions`、`buildFieldSourceActionPromptConfig`、`targetType: 'field-source-target'`、`targetType: 'field-source-action'`、`fieldInteractionType: 'source-target'`、`fieldInteractionType: 'source-action'`、`fieldSourceTargetInteraction.ts` 的共享 UI 模型、审计测试里的“来源对象 + 目标对象 / 来源对象自身执行”payload 形状扫描、Board 的来源选择、场上卡选择和基地提交读取。
  - 搜索范围：`src/games/smashup/abilities/**`、`src/games/smashup/domain/**`、`src/games/smashup/data/factions/**`、`src/games/smashup/Board.tsx`、Smash Up 相关 Vitest/E2E。
  - 命中项：四个 `随从 -> 基地` 来源-目标对象；两个 `随从 -> 随从` 来源-目标对象；三个 `持续行动/行动 -> 基地` 来源-目标对象；一个 `持续行动 -> 随从` 来源-目标对象；两个 `泰坦 -> 基地` 来源-目标对象；一个 `泰坦 -> 随从` 来源-目标对象；一个 `随从 -> 自身执行` 来源-action 对象；五个已登记为纯控制/模式选择的计分按钮。
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

## 禁止假阳性检查

- 没有把“按钮能点”当成交互正确；关键截图证明来源本体和目标对象分步出现。
- 没有把“按钮存在”扩大成合法主路径；计分按钮只有在选项值不携带场上对象目标字段、且已登记为纯控制/跳过/模式选择时才允许保留。
- 没有把“prompt 出现”当成最终状态；E2E 断言最终阶段推进、交互清空、响应窗口清空。
- 没有把十三个来源-目标 sourceId 加一个来源自身执行 sourceId 外推为所有计分时效果；本文明确保留全牌库逐牌深审为当前范围外。
- 没有用旧标注图替代当前截图；旧 2026-08-16 图组已降级。

## 共享根因与残余范围

- 共享根因项：来源和目标职责曾容易混在同一按钮/目标选项里，来源自身执行也曾容易被做成按钮主路径，导致玩家看不懂“是谁发动、作用到哪里”。当前共享合同把来源对象、目标对象和来源自身执行拆开。
- 已一并检查项：field source-target 共享 helper、field-source-action 共享 helper、三段字段、疑似手拼来源/目标 payload 形状、疑似来源自身执行 payload 形状、Board 消费路径、复杂链 E2E、世界冠军木乃伊 E2E、警长 E2E、沉船湾 E2E、墓碑 E2E、超级佐德 E2E、垃圾处理 E2E、克拉肯救随从 E2E、侦察兵 E2E、侦察兵领域测试、飞天猴领域与队列运行态测试、麦克尔定向行为测试。
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

- 可以说：本轮已经把“场上来源对象到目标对象”和“场上来源对象自身可选执行”的计分可发动效果收敛到共享合同；当前十三个来源-目标 sourceId 覆盖 `随从 -> 基地`、`随从 -> 随从`、`持续行动/行动 -> 基地`、`持续行动 -> 随从`、`泰坦 -> 基地`、`泰坦 -> 随从` 六个来源-目标分支，其中垃圾处理和克拉肯已用现成复杂 E2E 补了来源先点、目标后亮和最终落地截图；另有侦察兵 `alien_scout_return` 覆盖 `随从 -> 自身执行` 分支，已用现成核心流程 E2E 补了来源本体高亮、点击本体回手、留在基地分支和最终无残留。
- 可以说：麦克尔已完成 L1/L2 结构与行为验证，但还不能说它已有 L3 截图验收。
- 可以说：全部计分时效果都值得进对象全集审查，但必须先职责分流，不是全部都改成点来源。
- 不能说：全牌库所有计分时效果逐牌行为已经完成。
- 不能说：强制自动效果也要玩家点来源。
