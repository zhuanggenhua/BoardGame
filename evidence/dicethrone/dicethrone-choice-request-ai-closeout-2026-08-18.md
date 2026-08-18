# DiceThrone Choice Request AI 交互闭环证据（2026-08-18）

## 基本信息

- 对象：DiceThrone / 王权骰铸的通用 `CHOICE_REQUESTED` 选择桥、AI 合法动作、响应窗口重开边界和旧状态命令拒绝。
- 日期：2026-08-18。
- 作者：Codex。
- 文档类型：`closeout`。
- 关联需求 / PR / 任务：[Choice Request 迁移提案](../../openspec/changes/refactor-choice-request-interface/proposal.md)、[迁移任务](../../openspec/changes/refactor-choice-request-interface/tasks.md)、[迁移账本](../../openspec/changes/refactor-choice-request-interface/request-ledger.md)。
- 当前状态口径：本地代码、测试、类型检查、目标 lint、OpenSpec 校验和 DiceThrone 黄金浏览器流程均通过；线上发布、反馈状态回写和生产 revision 不由本文证明。

## 审计范围

- 本轮覆盖的文件：
  - [ChoiceRequest.ts](../../src/engine/ChoiceRequest.ts)。
  - [ChoiceRequestSimpleChoiceAdapter.ts](../../src/engine/systems/ChoiceRequestSimpleChoiceAdapter.ts)。
  - [systems.ts](../../src/games/dicethrone/domain/systems.ts)。
  - [ai.ts](../../src/games/dicethrone/ai.ts)。
  - [responseWindowGuards.ts](../../src/games/dicethrone/domain/responseWindowGuards.ts)。
  - [server.ts](../../src/engine/transport/server.ts)。
  - [choice-interaction-anchor-contract.test.ts](../../src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts)。
  - [basic-commands-coverage.test.ts](../../src/games/dicethrone/__tests__/basic-commands-coverage.test.ts)。
  - [server.test.ts](../../src/engine/transport/__tests__/server.test.ts)。
  - [dicethrone-golden-full-flow.e2e.ts](../../e2e/dicethrone/dicethrone-golden-full-flow.e2e.ts)。
  - [GameHints.tsx](../../src/games/dicethrone/ui/GameHints.tsx)。
- 本轮覆盖的模块：
  - DiceThrone 通用选择事件到 Choice Request，再投影到 legacy simple-choice 视觉面。
  - AI legalActions 对同一批选择候选的消费、跳过 / 多选 / 缺少当前 actor 的 fail-close 行为。
  - `afterRollConfirmed` 响应窗口签名，区分普通攻击、防御能力和奖励骰来源。
  - 防御方改进攻骰、攻击方重新确认、防御骰被改后防御方重新确认、二次响应窗口、伤害和回合交接。
  - 旧浏览器或旧 UI 命令携带 `expectedStateID` 时的服务端拒绝。
- 本轮覆盖的共享链路：Choice Request 投影、InteractionSystem simple-choice 兼容面、ResponseWindowSystem 门控、GameTransportServer 命令前置状态校验、DiceThrone 黄金 E2E。
- 明确不在本轮范围内的对象：Cardia；Mage Wars；Qidahen；Betrayal；Smash Up；Summoner Wars；DiceThrone bonus dice / defender selection 的全面迁移；线上部署和反馈后台状态。

### 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞当前本地验证口径 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| DiceThrone 通用 `CHOICE_REQUESTED` 仍由 simple-choice 视觉面承载 | `非阻塞扩展` | 否 | 否 | 当前范围内通过 adapter 兼容；业务候选由 Choice Request 拥有 | 后续直接对象选择 adapter 分批迁移 |
| Cardia 迁移 | `非阻塞扩展` | 否 | 否 | 用户已明确不动旧项目 | 新任务另行锁定 |
| Mage Wars / Qidahen / Betrayal 迁移 | `非阻塞扩展` | 否 | 否 | 用户本轮改为只处理 DiceThrone / 王权骰铸 | 后续新游戏框架任务 |
| 生产部署和反馈状态回写 | `审计留档缺口` | 否 | 否 | 本文只证明本地代码验证 | 发布任务或反馈收口任务 |
| DiceThrone 全部英雄全部 Choice Request 组合 | `非阻塞扩展` | 否 | 否 | 本轮以通用桥、代表性 AI 选择、响应窗口和黄金全流程证明 | 后续专项深审 |

### 自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | `passed` | 锁定为 DiceThrone / 王权骰铸通用选择桥、AI legalActions、响应窗口重开边界、旧状态命令拒绝和黄金全流程。 |
| 规则子句表 | `passed` | C1-C6 见逐项结论。 |
| 完整技能流程矩阵 | `passed` | 每项登记候选来源、入口、命令、后续清理和证据层级。 |
| L0-L4 证据层级 | `passed` | 见对象级层级矩阵，覆盖 L0/L1/L2/L3/L4。 |
| 命中 D 维度 | `passed` | D3、D5、D8、D23、D40、D48、D58。 |
| 关键组合矩阵 | `passed` | 跳过、多选、actor 不匹配取消、进攻骰被改后重确、防御骰被改后二次响应、旧状态拒绝。 |
| 真实入口 E2E 与截图核验 | `passed` | 黄金浏览器流程 29 张截图，关键节点 07、09、24、29 已人工核对。 |
| 测试语义对账 / 旧测试失效检查 | `passed` | 见“测试语义对账”。 |
| 同类扩审记录 | `passed` | 横向搜索 `CHOICE_REQUESTED`、`createSimpleChoiceFromChoiceRequest`、`currentResponderId`、`expectedStateID`，范围见“共享根因与范围外事项”。 |
| 缺口分类与范围裁定 | `passed` | 本节 2.0 表。 |
| 残余范围声明 | `passed` | 范围外事项已单列，不影响本地验证口径。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 旧 2026-04-12 文档保留历史说明，本文不覆盖其历史范围。 |

## 结论等级

- 结论等级：`代表性玩法已验证`。
- 判定理由：
  - 通用 `CHOICE_REQUESTED` 已从“simple-choice 自己拥有候选语义”改为“Choice Request 拥有候选语义，legacy simple-choice 只负责显示和提交”。
  - AI 在同一选择语义下能从 legalActions 生成真实 `SYS_INTERACTION_RESPOND`，无当前 actor 决策时走 `SYS_INTERACTION_CANCEL`，不会静默等待。
  - 响应窗口重开边界通过来源签名、当前响应者门控和黄金全流程证明：防御方改进攻骰后，攻击方重确不会立即重开同类响应窗口；防御骰被攻击方改后，防御方重确会合法打开攻击方二次响应窗口。
  - 旧状态命令通过 `expectedStateID` 在服务端领域管线前拒绝，避免旧 UI 点击打到新状态。
  - 本文不声明线上已部署、反馈已关闭或 DiceThrone 全英雄全部分支都完成深度审计。

## 权威来源

- 主真相源：[rule-driven-interaction-design.md](../../.spec/knowledge/standards/rule-driven-interaction-design.md) 对 Choice Request、权限、响应窗口和 AI 合法动作的要求。
- 对照源：
  - [game-ai-adaptation](../../.spec/skills/game-ai-adaptation/SKILL.md)。
  - [audit-evidence-template.md](../../.spec/knowledge/standards/audit-evidence-template.md)。
  - [e2e-verification.md](../../.spec/knowledge/standards/e2e-verification.md)。
  - [Choice Request 迁移账本](../../openspec/changes/refactor-choice-request-interface/request-ledger.md)。
- 关键裁定：
  - 真人 UI 和 AI 选择必须消费同一份候选语义，UI 面不是规则真相源。
  - `currentResponderId / responderQueue` 决定谁能响应；非当前 responder 的 AI 不得重复产生 `RESPONSE_PASS`。
  - `interactionId / sourceId` 必须贯穿 Choice Request、simple-choice 投影和 AI legalActions。
  - `playerView / isBlocked` 是 hidden interaction 诊断入口；本轮黄金链未命中 hidden interaction 卡住形态，因此不把 watchdog 当根因修复证据。
  - `unsatisfiable reason` 只用于诊断无解选择；本轮代码路径要求无当前 AI 决策时 fail-close 为取消命令，而不是空等。

## 逐项结论

| 对象 | 规则子句 | 实现入口 | 共享链路 / 复用依据 | 命中维度 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| C1 Choice Request 语义投影 | `CHOICE_REQUESTED` 产生稳定候选；simple-choice 只显示和提交 | [systems.ts](../../src/games/dicethrone/domain/systems.ts)、[ChoiceRequestSimpleChoiceAdapter.ts](../../src/engine/systems/ChoiceRequestSimpleChoiceAdapter.ts) | `choice-request-simple-choice-adapter`；候选 ID、label、value、selection、sourceId 一次投影给 UI 与 AI | D3 D5 D23 D58 | L1/L2 | 通过 |
| C2 AI legalActions | AI 必须从同一候选生成响应、跳过、多选或取消 | [ai.ts](../../src/games/dicethrone/ai.ts)、[ChoiceRequest.ts](../../src/engine/ChoiceRequest.ts) | `semantic simple-choice` 决策描述；`interactionId / sourceId / actorPlayerId` 判等 | D5 D58 | L2 | 通过 |
| C3 响应窗口当前响应者 | 只有当前 responder 或 team direct interference 才能打响应；否则不得干扰真人 | [ai.ts](../../src/games/dicethrone/ai.ts)、[responseWindowGuards.ts](../../src/games/dicethrone/domain/responseWindowGuards.ts) | `currentResponderId / responderQueue` 门控 | D8 D40 D58 | L2/L3 | 通过 |
| C4 响应窗口重开签名 | 同一骰面和同一来源不得重复重开；来源变化时才合法再次打开 | [responseWindowGuards.ts](../../src/games/dicethrone/domain/responseWindowGuards.ts) | `afterRollConfirmed` 签名包含骰面、回合、玩家、攻击来源能力 ID、防御能力 ID、奖励骰来源 | D40 D58 | L2/L3/L4 | 通过 |
| C5 旧状态命令拒绝 | 旧 UI 命令不得越过服务端状态前置条件 | [server.ts](../../src/engine/transport/server.ts)、[server.test.ts](../../src/engine/transport/__tests__/server.test.ts) | `expectedStateID` 前置状态校验 | D8 D58 | L2/L4 | 通过 |
| C6 UI lint / 思考提示 | UI 修复不得引入 React static-components lint warning | [GameHints.tsx](../../src/games/dicethrone/ui/GameHints.tsx) | `ThinkingDot` 提到组件外，src 与 e2e/src 同步 | D48 | L1 | 通过 |

### 完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Choice Request 桥 | `CHOICE_REQUESTED` payload | `ChoiceRequest` requestId/playerId/sourceId/candidates/selection | legacy simple-choice modal | `SYS_INTERACTION_RESPOND` | N/A | `CHOICE_RESOLVED` 后回到领域效果 | actor 不匹配时取消；disabled 候选不进有效动作 | `sys.interaction.current` 解决后清空 | L1/L2 | 通过 |
| AI 选择 | semantic decision descriptor | `actorPlayerId`、`interactionId`、`sourceId` | legalActions | `SYS_INTERACTION_RESPOND` 或 `SYS_INTERACTION_CANCEL` | N/A | 选择候选或 fail-close | skip/multi/missing actor 边界均有断言 | 不返回空动作等待 | L2 | 通过 |
| 攻骰改后重确 | DiceThrone 投骰响应规则 | `afterRollConfirmed` 签名 | 攻击方确认按钮 | `CONFIRM_ROLL` | N/A | rollConfirmed=true | 防御方改进攻骰后，攻击方重确不立即重开同类窗口 | 无 responseWindow 残留，阶段可继续 | L2/L3/L4 | 通过 |
| 防骰改后二次响应 | DiceThrone 防御骰响应规则 | `afterRollConfirmed` 签名包含防御来源 | 防御方确认按钮 | `CONFIRM_ROLL` | N/A | 攻击方二次响应窗口合法出现 | 攻击方跳过后防御方可结束防御 | finalState 到伤害、弃牌、回合交接 | L3/L4 | 通过 |
| 旧状态拒绝 | 服务端权威状态 | `expectedStateID` | command/batch options | 领域管线前拒绝 | N/A | 不执行旧命令 | stale 命令返回 `stale_state` | 权威 stateID 保持最新 | L2/L4 | 通过 |

### 语义门禁快照

| 对象 | 承接语义 | 触发时机 | 效果宿主 | 作用范围 | 触发后清理 | 不应发生什么 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DiceThrone 选择桥 | Choice Request → simple-choice adapter | 领域事件后处理 | 当前决策玩家 | 单个选择请求 | interaction resolve 后清理 | 不应让 simple-choice 成为第二套 AI 真相源 | 通过 |
| Response window | 当前 responder 响应 / 跳过 | 攻击或防御投骰确认后 | `currentResponderId` | responderQueue 当前项 | pass 后推进或关闭 | 非当前 AI 不应替真人 pass；同类窗口不应立刻重开 | 通过 |
| Stale command | 服务端权威状态前置条件 | command / batch 进入领域管线前 | GameTransportServer | human 与 AI seat | 拒绝后不执行命令 | 旧 UI 点击不应改变新状态 | 通过 |

## 验证证据

### L1 结构证据

- 命令：`npm run spec:lint`。
- 结果：[dicethrone-spec-lint-after-evidence-20260818.log](../../temp/dicethrone-spec-lint-after-evidence-20260818.log) 记录 `spec-lint: OK`。
- 命令：`npm run openspec validate refactor-choice-request-interface -- --strict`。
- 结果：[dicethrone-openspec-validate-20260818.log](../../temp/dicethrone-openspec-validate-20260818.log) 记录 `Change 'refactor-choice-request-interface' is valid`。
- 结论：Choice Request 文档、迁移账本和项目规范结构当前可被工具识别。

### L2 领域行为证据

- 命令：`npm run test:dicethrone`。
- 结果：[dicethrone-test-dicethrone-20260818.log](../../temp/dicethrone-test-dicethrone-20260818.log) 记录 `157 passed` test files、`2343 passed / 1 skipped` tests。
- 重点断言：
  - [choice-interaction-anchor-contract.test.ts](../../src/games/dicethrone/__tests__/choice-interaction-anchor-contract.test.ts) 断言 `CHOICE_REQUESTED` 通过 Choice Request 语义投影给真人 UI 和 AI 选择。
  - [basic-commands-coverage.test.ts](../../src/games/dicethrone/__tests__/basic-commands-coverage.test.ts) 断言 semantic simple-choice 的 skip、多选和 actor 不匹配取消。
  - [server.test.ts](../../src/engine/transport/__tests__/server.test.ts) 断言 batch 与 human 单条旧状态命令被拒绝为 `stale_state` 且不执行旧命令。
- 结论：AI legalActions、响应窗口门控和服务端旧状态拒绝均有领域或服务端行为断言。

### L3 真实玩法证据

- 真实入口：DiceThrone 黄金浏览器流程。
- 命令：`node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-golden-full-flow.e2e.ts "DiceThrone 黄金全流程：覆盖开局、卖牌换CP、攻骰改骰、攻击修正奖励骰、防御响应、伤害、弃牌和回合交接"`。
- 结果：[dicethrone-golden-e2e-rerun-20260818.log](../../temp/dicethrone-golden-e2e-rerun-20260818.log) 记录 `1 passed`。
- 截图目录：[DiceThrone 黄金全流程截图](../../test-results/evidence-screenshots/dicethrone/dicethrone-golden-full-flow.e2e/DiceThrone-黄金全流程：覆盖开局、卖牌换CP、攻骰改骰、攻击修正奖励骰、防御响应、伤害、弃牌和回合交接/)。
- 人工观察结论：
  - `07-进攻骰确认后-防御方响应窗口出现.jpg`：防御方响应窗口可见，可响应 / 跳过入口存在。
  - `09-防御方改我投骰后-攻击方需要重新确认骰面.jpg`：攻击方确认改后骰，画面没有立即重复同类防御响应窗口。
  - `24-防御方重新确认后-攻击方二次响应窗口出现.jpg`：防御骰被攻击方改后，防御方重确后攻击方二次响应窗口合法出现。
  - `29-回合交接完成-防御方成为下一回合玩家.jpg`：伤害、弃牌和回合交接均完成。
- 结论：浏览器真实流程证明本轮高风险响应窗口链路能走到回合交接。

### L4 治理证据

- 代码验证：
  - `npx tsc --noEmit --pretty false --incremental false --project tsconfig.json`，结果见 [dicethrone-tsc-20260818.log](../../temp/dicethrone-tsc-20260818.log)，exit 0。
  - 目标 ESLint，结果见 [dicethrone-eslint-20260818.log](../../temp/dicethrone-eslint-20260818.log)，exit 0，仅 Babel 大文件提示。
- 任务完成 guard：
  - 命令：`python D:\codex-home\skills\task-completion-guard\scripts\check_completion.py --state temp\dicethrone-choice-request-task.json`。
  - 结果：交接记录为 `COMPLETE`，本文落盘后任务状态文件改为引用本文件。
- finalState / 生命周期：
  - 黄金 E2E 从主阶段、进攻投骰、响应、攻击修正奖励骰、防御响应、伤害、弃牌走到回合交接。
  - 关键断言覆盖 `sys.interaction.current` 与 responseWindow 退场、阶段可继续、流程收口、无残留。
- 结论：本轮不是单点按钮测试，而是用代码门禁、领域行为和浏览器流程共同证明链路闭环。

### Evidence 自检

- 命令：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-choice-request-ai-closeout-2026-08-18.md`。
- 结果：`[audit-evidence-completeness] checked files: 1; audit docs: 1`，`[audit-evidence-completeness] OK`。

### 生产反馈收口证据分层

| 状态轴 | 当前证据 | 当前口径 |
| --- | --- | --- |
| 本地已修 | 代码改动、DiceThrone 单测、类型检查、目标 lint、OpenSpec 校验和黄金 E2E 均通过 | 可说“本地代码验证完成” |
| 已推送 | 本文无 commit / push 证据 | 不可说“已推送” |
| 已部署 | 本文无生产 revision / health check 证据 | 不可说“线上已部署” |
| 已回写状态 | 本文无具体反馈 ID 和后台状态前后证据 | 不可说“反馈已关闭” |

## 测试语义对账

| 测试 | 断言了什么最终状态 / 命令 | 负向或边界 |
| --- | --- | --- |
| `CHOICE_REQUESTED 应通过 Choice Request 语义投影给真人 UI 和 AI 选择` | simple-choice data 中有 semantic decision；AI legalActions 产出 `SYS_INTERACTION_RESPOND` | 不把 UI 文案或顺序当 AI 真相源 |
| `semantic simple-choice 的 skip option 仍会生成 optional-skip hint` | skip 候选仍能成为可提交动作 | 跳过不是空等 |
| `semantic simple-choice 多选应生成 optionIds payload 并保留被选项 metadata` | 多选组合产出 `optionIds`，metadata 保留 sourceId | 数量边界覆盖 |
| `semantic simple-choice 缺少当前 AI actor 决策时应取消交互而不是返回空动作` | 产出 `SYS_INTERACTION_CANCEL`，reason 为 `missing-actions` | 不让 AI 座位卡在无动作状态 |
| `batch expectedStateID 落后于服务端权威 stateID` | batch 被 `stale_state` 拒绝，权威 stateID 保持新值 | 旧命令不进入领域执行 |
| `human 单条命令 expectedStateID 落后于服务端权威 stateID` | socket 收到 `stale_state`，executeSpy 调用次数不增加 | 旧 UI 点击不改变状态 |
| DiceThrone 黄金全流程 | 响应窗口、改骰、重确、二次响应、伤害、弃牌、回合交接均通过真实浏览器链路 | 不用注入单帧 prompt 冒充完整玩法 |

## 禁止假阳性检查

- 是否误用静态展示 E2E 充当玩法结论：否，黄金流程从真实浏览器链路跑到回合交接。
- 是否误用“测试里出现 ID”充当行为完整：否，测试语义对账列出实际命令和最终状态。
- 是否误用“有测试”充当语义正确：否，写明了 skip、多选、actor 不匹配、旧状态拒绝和响应窗口重开边界。
- 是否误用截图充当规则实现正确：否，截图只证明真实入口和画面现场；规则状态由 L2 / L4 命令断言支撑。
- 是否误用注入型 interaction E2E：否，黄金流程使用浏览器操作链和服务器状态断言。
- 是否只证明 prompt 出现：否，继续证明到伤害、弃牌和回合交接。

## 共享根因与范围外事项

- 共享根因项：
  - 根因分级：架构 / 时序 / 系统边界缺陷。
  - 现实机制：旧 simple-choice 既承担显示又被 AI 当成候选来源，UI 变化会让 AI 选择语义漂移；响应窗口来源签名不足时，同类确认可能被误判为同一个窗口或错误重开。
  - 本轮处置：让 Choice Request 拥有候选语义；让 AI legalActions 消费同一 request；让 response-window 签名包含来源能力；让旧状态命令在服务端领域管线前拒绝。
- 同类扩审记录：
  - 根因关键词 / 事件 / 状态字段 / helper / UI 入口：`CHOICE_REQUESTED`、`createSimpleChoiceFromChoiceRequest`、`currentResponderId`、`responderQueue`、`expectedStateID`、`legalActions`。
  - 搜索范围与命中项：`src/engine`、`src/games/dicethrone`、`e2e/dicethrone`、`openspec/changes/refactor-choice-request-interface`、`evidence/dicethrone`。
  - 已一并处理项：DiceThrone 通用选择桥、AI 当前响应者门控、afterRollConfirmed 来源签名、旧状态命令拒绝、GameHints lint warning。
  - 判定不受影响项及理由：Cardia 和其它游戏不在用户本轮范围；DiceThrone bonus dice、response windows、defender selection 是专用路径，没有在本轮改成 Choice Request。
  - 范围外事项：新游戏 Choice Request 直接对象选择 adapter、heavy legacy 游戏家族迁移、生产部署和反馈状态回写。
- 已登记的合法代表链复用：
  - 代表对象：DiceThrone 通用 `CHOICE_REQUESTED`。
  - 共享链名称：`choice-request-simple-choice-adapter`。
  - 判等依据：同一 requestId、playerId、sourceId、candidates、selection、resolution、semantic AI decision。
  - 仅剩配置差异：各英雄 choice option value 内容不同；本轮不外推为全部英雄深度审计。

## 修订 / 失效记录

- 旧文档路径：[dicethrone-response-window-retrigger-audit-2026-04-12.md](dicethrone-response-window-retrigger-audit-2026-04-12.md)。
- 旧结论：该文档是 2026-04-12 response-window 重触发 / 重复提示 / 音效循环历史专项，不是当前所有 DiceThrone response-window 问题的总证据。
- 本文与旧文档关系：本文新增 2026-08-18 当前 DiceThrone Choice Request / AI 交互闭环证据，不覆盖旧文档的历史范围。
- 替代旧结论的新证据：不替代旧文档整体结论；只补本轮锁定范围的代码、测试、E2E 和任务 guard 证据。
- 新增真实入口验证：[dicethrone-golden-full-flow.e2e.ts](../../e2e/dicethrone/dicethrone-golden-full-flow.e2e.ts) 生成 29 张截图并通过。

## 对外汇报口径

- 允许说：
  - DiceThrone / 王权骰铸本地代码验证完成，Choice Request 语义投影、AI legalActions、响应窗口重开边界、旧状态命令拒绝和黄金全流程 E2E 已通过。
  - 线上 watchdog 仍是兜底；本轮真正解决的是交互合同、AI 合法动作和响应窗口去重 / 重开边界。
  - 本轮没有改 Cardia，也没有把 Mage Wars / Qidahen / Betrayal / Smash Up / Summoner Wars 一并迁移。
- 禁止说：
  - 禁止说线上生产已部署，除非另有 production revision 和 health check 证据。
  - 禁止说反馈后台已关闭，除非另有具体反馈 ID 和状态回写前后证据。
  - 禁止说所有旧 simple-choice 游戏都迁移完成。
  - 禁止说 watchdog 是根因修复；watchdog 只能是异常兜底。
