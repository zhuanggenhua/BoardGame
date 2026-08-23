# DiceThrone 多步骰子命令事务审计

## 基本信息

- 对象：DiceThrone 多步骰子交互、共享 transport 批量命令边界
- 日期：2026-08-23
- 文档类型：audit / closeout
- 关联问题：玩家一次多选重掷后，只有其中一颗骰子真实触发重投和动画

## 审计范围

- 本轮覆盖：DiceThrone 人类玩家 UI 的 `multistep-choice` 骰子改值 / 重掷链路；在线 Provider 与本地 Provider 对 `SYS_TRANSPORT_BATCH` 的消费；服务端批量命令执行与状态 / stateID / 随机游标回滚；在线 AI 与本地 AI 多命令批次失败恢复入口。
- 本轮覆盖的共享链路：`sharedFlowId = engine.multistep-choice.transaction-batch`。
- 目标入口 / 环境：DiceThrone 真实浏览器 E2E、本地 Vitest、在线 GameProvider transport mock、服务端 batch executor / coordinator 单测、本地 AI batch 单测。
- 明确不外推为本轮完成口径：全仓未来或未列出的自定义多命令实现；本轮只覆盖当前搜索命中的共享链路和正式消费入口。

## 结论等级

结论等级：当前范围已收口。

判定理由：

- DiceThrone 人类玩家入口的多选重掷 / 改骰链路已经补为显式业务事务批次，在线乐观待确认队列不再逐条吞掉后续命令。
- 重掷动画消费者已改为合并连续骰子事件，不再让后一颗骰子的动画覆盖前一颗。
- 服务端批量命令已有批次前快照、失败回滚、随机游标恢复、广播权威状态的实现和测试。
- 本地 AI 多命令动作已补批次失败时的状态 / 随机游标快照恢复入口，并由直接单测覆盖“第二条失败时不保留第一条副作用”。
- 当前范围可以说“已覆盖本轮命中的共享事务链路”；不能把它外推成“全仓任何未来多命令实现天然都安全”。

## 权威来源

- 主真相源：
  - `.spec/knowledge/standards/rule-driven-interaction-design.md`：一次玩家确认是一个玩家意图。
  - `.spec/knowledge/standards/engine-transport.md`：业务事务批次必须走显式批量入口并具备服务端原子性。
  - `.spec/knowledge/standards/description-to-implementation-audit.md`：审计必须追命令组事务边界。
- 规则合同状态：locked。
- 关键裁定：`card-i-can-again` / `card-just-this` 是一次确认前批量选择；`card-worthy-of-me` 才允许重复 / 分批累计；`card-me-too` 是改骰复制，不是重掷。

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 普通多选重掷 | 玩家一次选择多颗骰并确认，这组 `REROLL_DIE` 与交互关闭属于同一玩家意图，不应只执行第一颗 | `useMultistepInteraction` 将多命令包装为 `SYS_TRANSPORT_BATCH`；`useGameProviderRuntime` 直接 `sendBatch`，不走逐条乐观队列门控 | 多颗骰子都由服务端执行，交互按同批确认关闭 | `dicethrone-die-reroll.e2e.ts` 10 passed；transport 单测断言只调用一次 `sendBatch` | 功能实现已验证 | 玩家入口通过 |
| 改骰 / 复制骰 | 玩家一次确认可能生成多条 `MODIFY_DIE`，包含 `card-me-too` 复制源和目标骰 | 同一 `SYS_TRANSPORT_BATCH` 通道；本地 Provider 逐条执行批次并注入本地视角玩家 | 目标骰按规则变为源骰面，重复点源骰不会提前完成 | `dicethrone-die-modification.e2e.ts` 指定用例 1 passed；DiceThrone 规则回归 15 passed | 功能实现已验证 | 玩家入口通过 |
| 重掷动画 | 连续 `DIE_REROLLED` 事件应让所有相关骰子播放动画，后一颗不能覆盖前一颗 | `useDieRerollAnimationConsumer` 对当前滚动骰子和新事件骰子取并集 | 多颗骰子在同一动画窗口内保留滚动状态 | `useDieRerollAnimation.rollback.test.tsx` 新增连续不同骰事件断言 | 功能实现已验证 | 动画入口通过 |
| 服务端 batch | 批次中任一命令失败时必须回滚到批次前状态，不能留下第一条成功结果或随机游标推进 | `executeAuthoritativeCommandBatch` 快照 `state/stateID/randomCursor`，失败时恢复状态、stateID、tracked random 和可见状态缓存，再持久化回滚状态 | 服务端只广播最终确认态或回滚态；失败批次不污染后续随机序列 | `authoritativeBatchExecutor.test.ts` / `authoritativeBatchCoordinator.test.ts` 覆盖成功、命令失败回滚、状态前置失败和随机游标恢复 | 功能实现已验证 | 服务端原子性通过 |
| 本地 AI 多命令动作 | 一次 AI 决策产生多条命令时，商业口径应与在线 AI 一样具备事务边界 | `executeLocalAiCommandBatch` 在批次前保存状态 / 随机游标，命令被拒绝时通过 `restoreBatchSnapshot` 回退；`useLocalAiRuntime` 正式入口传入恢复函数 | 批次失败时不保留前序局部状态，也恢复本地随机游标 | `localAiCommandExecution.test.ts` 覆盖第一条成功、第二条拒绝后的状态和随机游标恢复 | 功能实现已验证 | 本地 AI 事务入口通过 |

## 共享影响与判等依据

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `engine.multistep-choice.transaction-batch` | 多步交互一次确认产生多条命令时保持同一业务事务 | `useMultistepInteraction`、`useGameProviderRuntime`、`useLocalProviderViewModel`、`executeAuthoritativeCommandBatch`、`executeLocalAiCommandBatch`、DiceThrone E2E | 触发时机：一次确认；候选生成：多步交互本地结果；权限判断：当前交互玩家；payload / command 结构：`commands[]`；命令组事务边界：显式 batch；执行入口：服务端 batch executor / 本地 AI batch executor；最终权威状态：骰值 / 交互清理 / 状态快照；清理语义：同批确认或回滚；AI / 自动推进：在线 AI 已有序列回滚，本地 AI 已补批次失败恢复入口和直接回归 | 数量上限、骰子 ID、改骰目标值、是否重复选择、是否带 `SYS_INTERACTION_CONFIRM` | DiceThrone 所有 `modifyDie` / `selectDie` 多步骰子交互；未来其它游戏若用 `useMultistepInteraction` 或本地 AI 多命令批次，也必须引用该流程 |

代表对象与判等依据：

- 代表对象：DiceThrone 普通多选重掷（`card-i-can-again`）和改骰复制（`card-me-too`）。
- 判等依据：触发时机、候选生成、权限判断、payload / command 结构、命令组事务边界、执行入口、最终权威状态和清理语义都落在 `engine.multistep-choice.transaction-batch`。
- 剩余差异：只在数量上限、骰子 ID、目标面值、是否允许重复选择、是否附带交互确认命令这些配置项上变化。
- 不可外推范围：未列入本轮搜索命中的自定义多命令实现，不能只因本共享链路通过就宣称全仓天然闭环。

同类扩审：

- 搜索了 `useMultistepInteraction`、`kind: 'multistep-choice'`、`toCommands:`、`confirmationMode: 'submitBatch'`。
- 正式运行消费点只命中 DiceThrone Board 的骰子多步交互；Summoner Wars / transport 里的命中是测试构造或交互状态夹具，不是当前玩家运行入口。
- 搜索了 `sendBatch`、普通待确认命令队列标记、`executeAuthoritativeCommandBatch`、`executeOnlineAiCommandSequence`、`executeLocalAiCommandBatch`。
- 命中结果：人类玩家在线入口、服务端 batch、在线 AI 序列和本地 AI batch 均已有状态 / 随机游标或等价快照恢复证据。

## 验证证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/systems/__tests__/useMultistepInteraction.test.ts src/engine/systems/__tests__/useMultistepInteraction.test.tsx src/engine/transport/__tests__/react.test.tsx src/engine/transport/__tests__/useLocalProviderViewModel.test.tsx src/games/dicethrone/__tests__/useDieRerollAnimation.rollback.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：5 files / 37 tests passed。
- 证明了什么：多步确认包装为内部 batch；在线 provider 只调用一次 `sendBatch`；本地 provider 识别 batch；动画事件合并。
- 没有证明什么：不单独证明本地 AI 多命令 batch 失败回滚；该证明由下方引擎事务单测覆盖。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/authoritativeBatchExecutor.test.ts src/engine/transport/__tests__/authoritativeBatchCoordinator.test.ts src/engine/transport/__tests__/localAiCommandExecution.test.ts src/engine/transport/__tests__/onlineAiExecutor.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：4 files / 10 tests passed。
- 证明了什么：服务端 batch 失败时恢复状态、stateID、随机游标和 tracked random；本地 AI batch 第二条命令拒绝时回滚第一条副作用并恢复本地随机游标；在线 AI 序列回滚保持原有保护。

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/card-flick-locked-dice.test.ts src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts -t "我又行了|就这|不愧是我|俺也一样|reroll up to N|copy 模式" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：3 files / 15 tests passed。
- 证明了什么：DiceThrone 点名卡牌的规则合同和命令链仍通过。

- 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts`
- 结果：10 passed。
- 证明了什么：真实浏览器入口下，多选重掷链路可从玩家入口完成。

- 命令：`npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-modification.e2e.ts "card-me-too 复制骰面时重复点源骰不会提前完成，点目标骰后才结算"`
- 结果：1 passed。
- 证明了什么：`card-me-too` 复制骰面入口没有被批量通道破坏。

- 命令：`npm run typecheck`
- 结果：通过。
- 证明了什么：新增内部批量命令类型没有破坏 TypeScript 编译面。

- 命令：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-multistep-command-transaction-audit-2026-08-23.md`
- 结果：OK。
- 证明了什么：当前 evidence 的范围、原子语义、实现消费链、缺口分类和对外口径结构完整。

- 命令：`npm run spec:lint`
- 结果：OK。
- 证明了什么：本轮 `.spec/knowledge/standards` 规范更新没有破坏项目规范索引和结构校验。

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞完成口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 旧测试只断言最终命令 / 事件，没断言传输事务边界 | 漏审归因 / 测试断言过窄 | 已通过本轮测试补齐玩家入口 | 是，若没有规范回代会复发 | 当前已补项目规范 | 保持 `engine-transport` 与 `description-to-implementation-audit` 的事务边界要求 |

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 范围锁定为 DiceThrone 人类玩家多步骰子交互 + transport batch + 在线 / 本地 AI 多命令事务入口；未列入搜索命中的未来自定义实现不外推 |
| 真相源状态 | passed | 规则合同和项目规范主源已列出 |
| 原子语义断言 | passed | 上方原子语义表逐项列出 |
| 实现消费链 | passed | `useMultistepInteraction` -> provider -> server batch / local AI batch -> animation consumer |
| 最终权威结果 | passed | DiceThrone 单测和 E2E 覆盖骰值、interaction 关闭 / 保留；引擎单测覆盖 batch 失败回滚和随机游标恢复 |
| 交互真实入口 | passed | DiceThrone E2E 10 + 1 passed |
| 验证证据 | passed | Vitest、E2E、typecheck 均记录 |
| 共享影响与代表链依据 | passed | `sharedFlowId`、一致性核对、失效影响面已列 |
| 缺口分类与范围裁定 | passed | 当前锁定链路无功能实现阻塞；只保留未列消费点不外推边界 |
| 旧 evidence / 旧结论回写 | passed | 未找到同主题旧 evidence 需要原地失效；旧测试口径已通过新增测试更新 |
| 残余范围声明 | passed | 当前锁定链路无残余；未列入搜索命中的未来自定义多命令实现不外推 |

## 修订或失效记录

- 旧测试口径：多步交互旧单测允许逐条 dispatch 多条 `REROLL_DIE` / `MODIFY_DIE`。
- 失效原因：逐条 dispatch 不能证明玩家一次确认在 transport 层保持事务边界，反而会掩盖乐观待确认队列吞后续命令的问题。
- 替代证据：新增 `SYS_TRANSPORT_BATCH` 断言、在线 provider `sendBatch` 断言、动画合并断言、服务端 / 本地 AI batch 回滚断言、DiceThrone E2E。
- 新结论：玩家入口的 DiceThrone 多步骰子交互应按业务事务批次验证；不能再用“最终状态里出现过多条命令 / 事件”替代事务验收。

## 对外汇报口径

- 允许说：DiceThrone 玩家多选重掷 / 改骰入口已经验证为批量事务发送，动画覆盖问题已修。
- 允许说：当前搜索命中的共享事务链路已经按玩家入口、在线 / 本地 provider、服务端 batch、在线 / 本地 AI 事务入口补齐并验证。
- 允许说：商业级实现不能只靠业务代码；必须有交互合同、传输事务规范、服务端回滚、真实入口 E2E 和审计证据。
- 禁止说：全仓任何未来自定义多命令实现天然都已覆盖。
- 禁止说：只要 `sendBatch` 被调用就等于业务事务完成。
