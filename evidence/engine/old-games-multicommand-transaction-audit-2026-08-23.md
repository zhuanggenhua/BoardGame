# 老游戏多目标 / 多命令 / 多事件入口审计

## 基本信息

- 对象：旧游戏里“一次玩家或 AI 意图对应多个选择、多个命令、多个目标表现或多个事件消费”的入口
- 日期：2026-08-23
- 文档类型：audit / closeout
- 关联问题：DiceThrone 通用卡牌多选重骰曾出现“玩家多选多个骰子，但只有一个骰子播放重投动画、一个骰子触发重投”
- 作者：Codex

## 审计范围

- 本轮覆盖的游戏：`betrayal`、`cardia`、`fantasyrealms`、`mage-wars`、`qidahen`、`smashup`、`splendor`、`summonerwars`、`the-gang`、`tictactoe`。
- 本轮覆盖的共享链路：UI 同一函数多次 dispatch 候选、AI 单个 action 多命令候选、`simple-choice` 多选 payload、EventStream / 视觉事件消费、transport 业务事务批次。
- 本轮使用的目标入口 / 环境：`src/games/*` 正式代码扫描、候选点人工复核、Cardia 领域测试、Cardia AI 合法动作测试、老游戏 multi 意图合同静态门禁。
- 明确不在本轮范围内的对象：Smash Up 全牌库逐卡规则审计、Summoner Wars 全派系逐技能审计、所有旧 evidence 原地回写、每个游戏的真实浏览器 E2E 全覆盖。

## 结论等级

结论等级：仍有残余范围。

判定理由：

- DiceThrone 的同一玩家确认被拆成普通 dispatch 的问题，已经在共享 `SYS_TRANSPORT_BATCH`、本地 / 在线 Provider、服务端 batch、AI batch 和动画消费者层面收口；本轮旧游戏扫描没有发现其它正式游戏直接复用 DiceThrone 这条 `multistep-choice` 多命令入口。
- 本轮确实命中 Cardia 旧洞：卡牌多选 UI 和 AI 的 `simple-choice` 合同不闭合。人类多选原先会提交 `optionIds + mergedValue`，但 `SimpleChoiceSystem` 的 multi 响应禁止 `mergedValue`；AI 多选原先直接返回空动作，随后被兜底取消。
- Cardia 已修：卡牌多选交互现在声明 `multi`，UI 多选只提交 `optionIds`，Cardia 事件系统把引擎解析出的多个 option value 规范化回旧 handler 需要的 `{ cardUids }`，AI 多选生成合法 `optionIds` 响应。
- 追问“大杀四方也有多选”后，复核 Smash Up prompt 层又命中一个同形态 UI 口子：通用弹窗的 `skip` 控制项在若干 multi 分支会复用普通选项点击路径，玩家可以先选普通项再点跳过，形成“业务多选项 + 控制项”混合选择而非一个明确控制意图。已修为控制项直接提交 `optionIds: ['skip']`，并补 UI 回归测试。
- Mage Wars / Summoner Wars / The Gang / TicTacToe 的 UI 多 dispatch 静态命中，经本轮人工复核属于互斥分支、确认前本地选中态或单选 / 多选二选一提交，不是一次确认拆成多条业务命令。Smash Up 主多选确认路径不是只发一个，但本轮新增的 skip 控制项口子已按同形态问题修复。
- 第二层排查继续扫描正式代码 1080 个 `.ts/.tsx` 文件，multi 声明集中在 `cardia: 1`、`dicethrone: 1`、`qidahen: 1`、`smashup: 131`、`summonerwars: 10`；疑似“数组 value 只取第一项”交集已人工复核为 Cardia / DiceThrone / Smash Up / Summoner Wars 的单选兼容或已修共享入口，没有新增确定功能阻塞。
- 已新增老游戏 multi 意图合同静态测试：以后正式代码里同一响应对象同时提交 `optionIds` 和 `mergedValue` 会红；数组 value 只取第一项的兼容点必须在测试里显式登记为单选语义；Smash Up `PromptOverlay` 的 `skip` 控制项不得再接回普通多选 toggle 路径。
- 不能说“所有老游戏所有卡牌都全面收口”。Smash Up 和 Summoner Wars 的交互体量很大，本轮只是围绕该事故形态做入口级扩审和代表点复核。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 范围锁定为旧游戏入口级 UI 多 dispatch、AI 多命令、simple-choice multi 和视觉事件消费；明确不含全牌库逐卡审计 |
| 真相源状态 | passed | 使用项目规范和当前代码作为真相源；没有临时查外部规则替代合同 |
| 原子语义断言 | passed | 下方原子语义表逐项列出 |
| 实现消费链 | passed | Cardia 已追到 `Board`、`systems`、`SimpleChoiceSystem`、AI action 和 handler value；其它入口按候选点复核 |
| 最终权威结果 | passed | Cardia 多选入口有 handler value 断言；其它旧游戏只支持入口级结论，残余范围单列 |
| 交互真实入口 | passed | Cardia 覆盖系统交互链；其它旧游戏为正式代码入口人工复核，未冒充真实浏览器全覆盖 |
| 验证证据 | passed | Cardia 两个目标测试修后通过；新增老游戏 multi 意图合同静态测试通过；扫描和人工复核记录在本文 |
| 共享影响与代表链依据 | passed | 三个 sharedFlowId 已列，并在“代表链与一致性核对”写清触发、候选、payload、执行和清理语义 |
| 缺口分类与范围裁定 | passed | Cardia 功能阻塞已修；Smash Up 全牌库和 Summoner Wars trail id 明确为残余 |
| 旧 evidence / 旧结论对账回写 | passed | 本轮新增 engine evidence；旧 Smash Up / Summoner Wars evidence 不在本轮原地回写范围 |
| 残余范围声明 | passed | 本文明确禁止“所有老游戏全规则永久安全”口径 |

## 权威来源

- 主真相源：
  - `.spec/knowledge/standards/rule-driven-interaction-design.md`：一次玩家确认就是一个玩家意图；多目标、多命令或“业务命令 + 关闭交互命令”必须保持同一批次。
  - `.spec/knowledge/standards/engine-transport.md`：业务事务批次必须走显式批量入口，服务端失败要回滚状态、stateID 和随机游标。
  - `.spec/knowledge/standards/description-to-implementation-audit.md`：审计必须追到命令组事务边界、最终权威状态、真实入口和 AI / 自动推进消费。
  - `.spec/knowledge/standards/engine-simple-choice.md`：旧 `simple-choice` 的 `multi` 必须显式声明在配置对象里，新增阻塞交互不应扩大旧弹窗职责。
- 合同状态：locked。
- 本轮裁定：Cardia 多选是旧兼容层消费缺口，不改共享 `SimpleChoiceSystem` 的 multi+mergedValue 禁止规则；修 Cardia adapter、UI 提交和 AI 适配器。

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| DiceThrone 多骰重掷 / 改骰 | 玩家一次确认选择多颗骰子时，多条骰子命令和交互确认属于同一玩家意图，不能只执行第一颗 | `src/engine/systems/useMultistepInteraction.ts` 发送 `SYS_TRANSPORT_BATCH`；`src/engine/transport/useGameProviderRuntime.ts` / `useLocalProviderViewModel.ts` 识别 batch；服务端 batch executor 回滚 | 多颗骰子的权威骰值和交互关闭同批落地；连续重骰动画合并消费 | 旧 evidence：`evidence/dicethrone/dicethrone-multistep-command-transaction-audit-2026-08-23.md`；本轮代码扫描确认旧游戏未直接复用该正式入口 | 功能实现已验证 | 当前共享入口收口 |
| Cardia 卡牌多选人类入口 | 玩家在同一弹窗里选择 2 张卡，应作为一次 `simple-choice` multi 响应进入旧 ability handler，handler 收到 `{ cardUids: [...] }` | `src/games/cardia/domain/systems.ts` 为 `card_selection maxSelect > 1` 声明 `multi`；`normalizeCardiaResolvedValue` 将 multi value 数组转为 `{ cardUids }`；`src/games/cardia/Board.tsx` 多选只提交 `optionIds` | `SimpleChoiceSystem` 接受多选并触发 `SYS_INTERACTION_RESOLVED`；Cardia handler 消费两张卡 UID | `src/games/cardia/__tests__/interaction.test.ts` 新增测试覆盖创建交互、multi 响应、handler value | 功能实现已验证 | 已修 |
| Cardia 卡牌多选 AI 入口 | AI 座位遇到多选 `simple-choice` 时，应生成合法 `optionIds` 响应，不能空动作后被紧急取消 | `src/games/cardia/ai.ts` 的 `buildSimpleChoiceActions` 多选分支选择满足 `multi.min/max` 的候选并发送 `SYS_INTERACTION_RESPOND` | AI 生成一条合法交互响应，不再生成 `SYS_INTERACTION_CANCEL` | `src/games/cardia/__tests__/ai-action-generation.test.ts` 新增测试覆盖 multi 响应 payload | 功能实现已验证 | 已修 |
| Mage Wars UI 多 dispatch 候选 | 同一点击函数里存在多个 dispatch，但每次真实点击只应进入一个互斥分支 | `src/games/mage-wars/Board.tsx` 的 `handleZoneSelect`、`handlePlayerSelect`、`handleGuard` | 单次点击只提交一个命令或本地选中态 | AST 扫描命中 3 个候选；人工复核分支均 `return` 或互斥 | 当前范围验证缺口 | 未发现同类拆批风险 |
| Smash Up UI 多 dispatch / 多选按钮候选 | 同一点击函数有多个 dispatch 或 prompt 响应，但多选目标先进入本地选中集合，确认按钮一次提交 `optionIds`；额外按钮为单选 / 多选二选一 | `src/games/smashup/Board.tsx`、`src/games/smashup/ui/BaseZone.tsx` | 单次确认提交一个 prompt 响应或一个正式业务命令 | AST 扫描命中 11 个候选；人工复核 `handleBaseClick`、`handleMinionSelect`、`handleOngoingSelect` 和浮动栏按钮为互斥分支 | 当前范围验证缺口 | 未发现同类拆批风险；仍需逐派系专项审计 |
| Smash Up PromptOverlay multi 控制项 | 玩家在 multi prompt 中点击跳过 / 控制项时，应表达“跳过”这个单独控制意图，不能把它加入普通业务选项集合 | `src/games/smashup/ui/PromptOverlay.tsx` 的 `handleControlOption`；multi 下直接 `lockedPromptRespond({ optionIds: [optionId] })`，普通业务项继续走本地选中态 | 先选普通项再点跳过时，只提交当前 interaction 的 `optionIds: ['skip']`；不会提交 `['target-a','skip']` 或等待再次确认 | `src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx` 新增 UI 组件回归；`src/games/__tests__/oldGameMultiIntentContract.test.ts` 新增静态门禁 | 功能实现已验证 | 已修 |
| Qidahen 多选 / mergedValue 候选 | 多选时不能携带 `mergedValue`；单选可用 `mergedValue` 补上下文 | `src/games/qidahen/Board.tsx`、`src/games/qidahen/domain/turnActionInteractionBuilders.ts`、`src/games/qidahen/ai.ts` | 手牌上限多选只提交 `optionIds`；其它 `mergedValue` 命中单选 `optionId` 上下文 | 代码复核：`resolveHandLimitDiscard` 只发 `optionIds`；AI 多选生成 `optionIds`；单选上下文仍用 `mergedValue` | 当前范围验证缺口 | 未发现 Cardia 同类 multi+mergedValue 阻塞 |
| Summoner Wars UI / AI 多选候选 | 多目标选择应由本地选择态积累，确认时发一个 `optionIds`；取消 / 单选响应不应和多选确认混成多命令 | `src/games/summonerwars/Board.tsx`、`src/games/summonerwars/ui/useCellInteraction.ts`、`src/games/summonerwars/ui/useEventCardModes.ts`、`src/games/summonerwars/ai.ts` | 多选响应为一条 `SYS_INTERACTION_RESPOND`；单选 / cancel / PLAY_EVENT 为互斥分支 | AST 扫描命中 11 个 UI 候选；人工复核 confirm / cancel / event direct play 分支互斥；AI payload 校验禁止 multi+mergedValue | 当前范围验证缺口 | 未发现同类拆批风险 |
| 老游戏 multi 意图合同静态门禁 | 正式代码不得再次把同一个多选响应写成 `optionIds + mergedValue`，也不得新增未复核的“数组 value 只取第一项”消费点 | `src/games/__tests__/oldGameMultiIntentContract.test.ts` 扫描 `src/games` 正式 `.ts/.tsx` 文件，排除测试和 debug config | 门禁对本事故形态给出可复跑红线；新增未复核同形态代码会使测试失败 | `node scripts/infra/vitest-cli-safe.mjs run src/games/__tests__/oldGameMultiIntentContract.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1` | 审计留档 / 回归保护 | 已补门禁 |
| Cardia / Mage Wars / Smash Up / Summoner Wars / The Gang 视觉事件消费 | 同批或连续事件不能被后一条覆盖前一条表现 | Cardia `useCardiaEventAnimations`；Mage Wars `useGameEvents`；Smash Up `useGameEvents` / `RevealOverlay`; Summoner Wars `useGameEvents` / `useMovementTrails`; The Gang chip transfer animation | 代表消费者使用 forEach、队列追加、sequence buffer 或 ref id 追加 | 人工复核代表文件；Summoner Wars `useMovementTrails` 仍有同毫秒同单位 key 候选风险 | 当前范围验证缺口 / 非阻塞扩展 | 未发现等同 DiceThrone 动画覆盖；保留残余风险 |

## 共享流程审计与引用复用

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `engine-business-command-batch` | 一次玩家确认或一次 AI 决策产生多条业务命令时保持同一事务边界 | `TRANSPORT_BATCH_COMMAND`、Provider `sendBatch`、服务端 `authoritativeBatchExecutor`、本地 / 在线 AI batch executor、DiceThrone transaction evidence | 同一意图、同一 actor、同一批命令、失败整体回滚、随机游标恢复、权威状态广播 | 命令数量、命令类型、目标 ID、是否包含交互确认 | DiceThrone `multistep-choice`；未来任何旧游戏若从一次确认生成多条命令，也必须接入 |
| `simple-choice-multi-response` | 旧 `simple-choice` 多选响应用 `multi + optionIds` 表达，不用 multi+mergedValue | `SimpleChoiceSystem` multi 校验；Cardia 修复测试；Qidahen / Summoner Wars AI payload 复核 | `multi` 显式声明；payload 用 `optionIds`；下游从 resolved `value` 或 interactionData 取业务值；AI 不用 label 猜语义 | `min/max/ordered`、候选 value 形状、目标类型 | Cardia、Qidahen、Summoner Wars、Smash Up 的旧 simple-choice 多选入口 |
| `simple-choice-multi-control-option` | 多选弹窗里的跳过 / 取消 / 完成等控制项必须和业务多选项分流，不能进入同一个本地多选集合 | Smash Up `PromptOverlay` 修复和 UI 回归测试；AI 枚举已有 skip 不混业务项测试；静态门禁禁止 `handleAction(skipOption.id)` 回归 | 普通业务项可本地多选后确认；控制项点击即提交单一控制意图；不得出现控制项和业务项混合 optionIds | 控制项 label、是否 disabled、UI 分支位置 | Smash Up PromptOverlay；未来旧 simple-choice multi 若加入控制项也应复用该分流口径 |
| `visual-event-stream-sequence-consumption` | 连续多个表现事件逐条入队或合并，不能覆盖同批目标 | Cardia / Mage Wars / Smash Up / Summoner Wars / The Gang 代表消费者复核 | 按 event id / sequence / queue / ref id 消费；不得用单个挂起键覆盖所有目标 | 动画时长、队列上限、事件类型、目标 ID | 所有使用 EventStream 或本地动画队列的旧游戏 |

## 代表链与一致性核对

| sharedFlowId | 代表对象 | 判等依据 / 一致性核对 | 触发时机 | 候选生成 | 权限判断 / 合法动作 | payload / command 结构 | 执行入口 | 最终权威状态 | 清理语义 | 仅配置差异 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `engine-business-command-batch` | DiceThrone 多骰重掷 / 改骰 | 一次玩家确认会同时产生多条业务命令和一个交互确认；这些命令必须同 actor、同 stateID、同随机游标提交 | 玩家在多步选择弹窗点确认；AI 生成同一决策动作 | 被选中的骰子或目标从同一交互上下文生成 | Provider / 服务端 batch executor 按同一玩家和当前状态校验 | `SYS_TRANSPORT_BATCH`，内部是同一批业务 command | 本地 / 在线 Provider、服务端 authoritative batch executor | 批次全部成功才广播新权威状态；失败整体回滚 | 交互关闭和业务命令同批完成，无残留 interaction | 命令数量、目标 ID 和命令类型不同 |
| `simple-choice-multi-response` | Cardia 卡牌多选、Qidahen 手牌上限弃牌、Summoner Wars multi simple-choice、Smash Up 多选 prompt 代表入口 | 交互配置显式声明 `multi`；响应只传 `optionIds`；下游从 resolved value 或 interactionData 取得业务对象 | 玩家确认多选弹窗；AI 为当前玩家构造合法响应 | UI 从本地选中集合映射 option id；AI 从 options 候选集合按 min / max 取值 | `SimpleChoiceSystem` 校验 interactionId、playerId、min / max 和 optionIds 有效性 | `SYS_INTERACTION_RESPOND`，payload 为 `interactionId + optionIds` | `SimpleChoiceSystem` resolver，游戏 adapter / handler 消费 resolved value | Cardia handler 收到 `{ cardUids }`；其它代表入口保持单条交互响应；Smash Up 控制项不混入业务多选 | 当前 interaction 被 resolved 并清空或推进队列 | 只允许 min / max、候选 value 形状、业务目标类型不同 |
| `visual-event-stream-sequence-consumption` | Cardia、Mage Wars、Smash Up、Summoner Wars、The Gang 的代表表现事件消费者 | 连续事件必须按 event id、sequence、queue 或 ref id 追加消费，不得被后一条覆盖前一条 | 领域事件进入 EventStream 或本地动画队列时 | 表现事件从领域事件列表逐条映射 | UI 消费层只读事件，不产生规则权限判断；合法性来自已提交的权威事件 | EventStream entry 或本地动画 item，带事件类型和目标 ID | 各游戏 `useGameEvents` / animation hook / overlay consumer | 表现队列逐条入队或合并展示，不改变规则权威状态 | 队列消费后移除对应事件或让动画自然结束 | 动画时长、队列上限、目标 ID、展示组件不同 |

## 静态扫描摘要

- 命令：`node` + TypeScript AST 扫描 `src/games`，排除 `__tests__` 和 debug config。
- 结果：当前正式代码扫描 1080 个 `.ts/.tsx` 文件。
- UI 多 dispatch 候选：`mage-wars: 3`、`smashup: 11`、`summonerwars: 11`、`the-gang: 1`、`tictactoe: 1`。
- AI 单 action 多命令候选：只命中 `dicethrone/ai.ts` 3 处；该类已由共享 AI batch / DiceThrone transaction evidence 覆盖。
- 传输 batch 搜索：`SYS_TRANSPORT_BATCH` 只命中引擎、transport、测试和 DiceThrone `useMultistepInteraction` 消费链，未发现其它旧游戏直接发同类多命令 batch。
- 多选 simple-choice 复核：Cardia 命中实际缺口并已修；Qidahen / Summoner Wars 多选代表入口使用 `optionIds`；Smash Up 体量较大，本轮只做入口代表复核，不宣称逐牌全量。
- 第二层 multi 声明扫描：正式代码 1080 个 `.ts/.tsx` 文件中，multi 声明分布为 `cardia: 1`、`dicethrone: 1`、`qidahen: 1`、`smashup: 131`、`summonerwars: 10`。
- 第二层疑似“只取第一项”交集：10 个近邻命中；Cardia / DiceThrone / Smash Up / Summoner Wars 的 AI 单选 payload 兼容均被 `SimpleChoiceSystem` 接受；Smash Up `munchkin_mages.ts` 为 `multi min=1/max=1` 的弃牌成本 helper；`miskatonic.ts` 为单选疯狂卡交互；Qidahen `[0]` 命中的是阶段性单选，不是 multi 响应。
- 新增静态门禁覆盖三条：同一响应对象不得同时含 `optionIds` 和 `mergedValue`；`Array.isArray(value) ? value[0] : value` 必须登记为单选兼容点；Smash Up `PromptOverlay` 的 `skip` 控制项不得复用普通选项 toggle 路径。

## 同类扩审与漏审归因

- 搜索范围：当前 `src/games` 正式代码 1080 个 `.ts/.tsx` 文件，排除 `__tests__`、`.test.ts(x)` 和 debug config；重点查 `optionIds + mergedValue`、`Array.isArray(value) ? value[0] : value`、Smash Up `skip` 控制项复用普通 toggle、UI 多 dispatch、AI 多命令候选。
- 横向搜索命令：`rg -n "optionIds.*mergedValue|mergedValue.*optionIds|handleAction\\(skipOption\\.id|Array\\.isArray\\(value\\)\\s*\\?\\s*value\\s*\\[\\s*0\\s*\\]\\s*:\\s*value" src/games -g "*.ts" -g "*.tsx"`；另由 `src/games/__tests__/oldGameMultiIntentContract.test.ts` 用 AST 复扫正式代码中的响应 payload。
- 命中项：Cardia multi+mergedValue 和 AI 空动作已修；Smash Up `PromptOverlay` multi 下 `skip` 控制项复用普通 toggle 已修；Smash Up `miskatonic.ts` 与 `munchkin_mages.ts` 的数组取第一项已登记为单选语义；正式代码当前没有未登记的同形态命中。
- 残余扩审范围：这不是 Smash Up 全牌库逐牌审计，也不是 Summoner Wars 全派系审计；未逐张证明每个 prompt 业务效果正确。若要升级到全牌库口径，需要按 Smash Up 专项逐派系 / prompt 对象全集继续审。
- 漏审归因：旧测试和旧审计证据停在主多选确认路径、AI 枚举和 `optionIds` payload，没有覆盖“先选业务项，再点跳过 / 完成这类控制项”的负向路径；这属于测试断言过窄加共享抽象没扩审到控制项。新门禁把该路径固定为回归保护。

## 验证证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/cardia/__tests__/interaction.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 首跑结果：新增 Cardia 多选测试失败，`current.data.multi` 为 `undefined`；这证明旧包装层没有把 `maxSelect > 1` 交给 `SimpleChoiceSystem`。
- 修后结果：1 file / 24 tests passed。
- 证明了什么：Cardia 卡牌多选从 `ABILITY_INTERACTION_REQUESTED` 到 `SYS_INTERACTION_RESPOND` 到旧 handler 的链路闭合，handler 收到 `{ cardUids: [...] }`。
- 没有证明什么：不证明 Cardia 每张具体卡牌的完整业务效果都逐张正确；只证明多选交互公共入口闭合。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/cardia/__tests__/ai-action-generation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 首跑结果：新增 Cardia AI 多选测试失败，AI 返回 `SYS_INTERACTION_CANCEL` 而不是 `SYS_INTERACTION_RESPOND`。
- 修后结果：1 file / 16 tests passed。
- 证明了什么：Cardia AI 对 multi `simple-choice` 生成合法 `optionIds` 响应。
- 没有证明什么：不证明 AI 策略选牌最优；只证明不会因多选交互无动作而取消阻塞选择。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 修后结果：1 file / 15 tests passed。
- 证明了什么：Smash Up multi prompt 中，玩家先点普通选项再点 `skip` 时，UI 只提交 `optionIds: ['skip']` 这个控制意图，不会把 `skip` 加入普通多选集合。
- 没有证明什么：不证明 Smash Up 每张牌、每个派系、每个 prompt 业务效果都逐项正确；只证明 PromptOverlay 这个控制项混入入口已修。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/__tests__/oldGameMultiIntentContract.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 修后结果：1 file / 3 tests passed。
- 证明了什么：正式旧游戏代码中没有同一响应 payload 同时提交 `optionIds` 和 `mergedValue`；数组 value 只取第一项的兼容点已显式登记为单选语义；Smash Up `PromptOverlay` 没有把 `skip` 控制项接回普通多选 toggle。
- 没有证明什么：不证明 Smash Up / Summoner Wars 的每张牌、每个派系、每个真实浏览器路径都逐项正确；只证明本事故形态的静态红线已可复跑。

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞当前审计口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| Cardia card_selection 多选未声明 `multi`，UI 发送 multi+mergedValue，AI 多选空动作 | 功能实现阻塞 | 修复前是；修复后否 | 修复前是；修复后否 | 当前范围内 | 已改 `systems.ts`、`Board.tsx`、`ai.ts` 并补两条回归测试 |
| Smash Up PromptOverlay multi 下 `skip` 控制项可走普通 toggle 路径 | 功能实现阻塞 | 修复前是；修复后否 | 修复前是；修复后否 | 当前范围内 | 已改 `PromptOverlay.tsx`，补 UI 组件回归和静态门禁 |
| 旧游戏 multi 意图合同原先只靠人工排查 | 审计留档缺口 / 回归保护缺口 | 否 | 否，但不利于后续防复发 | 当前范围内 | 已补 `oldGameMultiIntentContract.test.ts`，把本事故形态变成可复跑静态门禁 |
| Smash Up 全牌库 `simple-choice` / prompt 面很大，本轮没有逐派系逐牌复核 | 当前范围验证缺口 | 否，本轮没有命中同形态功能阻塞 | 是，阻止“全牌库已审完”口径 | 当前范围外残余 | 后续按 Smash Up 专项 skill 做逐派系 / 全牌库 prompt 审计 |
| Summoner Wars `useMovementTrails` 的 trail id 使用 `unitId + Date.now()` | 非阻塞扩展 | 否，未证明真实入口会同毫秒同单位多次长路径移动 | 否，但表现事件身份仍保留残余 | 当前范围外候选 | 若出现同单位连续移动表现覆盖，再补稳定自增 id 或 event id 测试 |
| 新游戏未来实现多目标 / 多命令入口 | 审计留档缺口 / 流程风险 | 否 | 可能 | 当前范围外 | 新游戏必须走 Choice Request / batch 事务合同，并在新游戏 intake / 实现阶段写对象矩阵和 tests |

## 修订或失效记录

- 旧 Cardia AI 结论失效：`src/games/cardia/ai.ts` 原 `TODO: 实现多选模式` 导致 multi `simple-choice` 不能生成合法响应。
- 旧 Cardia UI 结论失效：`src/games/cardia/Board.tsx` 原 multi 响应通过 `mergedValue` 把 `{ cardUids }` 送给 handler，但共享 `SimpleChoiceSystem` 的 multi 合同禁止 `mergedValue`。
- 新结论：Cardia 旧 handler 继续接收 `{ cardUids }`，但该值必须由 Cardia adapter 从引擎 resolved value 规范化得到，UI / AI 只提交 `optionIds`。
- 旧 Smash Up PromptOverlay 结论补充：主多选确认按钮原本不是只发一个，但若玩家点 `skip` 控制项，若干分支会复用普通 `handleAction`，在 multi 下变成 toggle。新结论：控制项必须走 `handleControlOption` 或等价直接响应，不进入普通业务多选集合。

## 对外汇报口径

- 允许说：旧游戏入口级审查没有发现 DiceThrone 同一个 `multistep-choice` 事务拆批问题在其它旧游戏直接复发。
- 允许说：本轮抓到并修了 Cardia 的老多选漏洞：人类多选和 AI 多选的 `simple-choice` 合同原来不闭合。
- 允许说：本轮追查 Smash Up 多选时又抓到并修了一个 UI 兼容口子：multi prompt 的跳过控制项可能混入普通多选集合；主多选确认路径本身不是“只能提交一个”。
- 允许说：商业级做法不能靠“代码里看着能跑”；必须把一次玩家意图、多选 payload、AI 合法动作、传输事务和表现事件身份都写成合同并配测试 / evidence。
- 禁止说：所有旧游戏、所有旧牌、所有未来新游戏都不会再出现同类问题。
- 禁止说：静态扫描没有命中就等于全规则正确；静态扫描只能作为候选入口筛查。
